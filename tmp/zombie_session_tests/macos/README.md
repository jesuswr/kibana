# Reproducing the HTTP/2 Zombie Session Bug on macOS

This script reproduces [nodejs/node#61304](https://github.com/nodejs/node/issues/61304) — a bug where Node.js HTTP/2 sessions become "zombies" after a silent network failure. The session thinks it's healthy, but the connection is dead. Writes queue up forever, and eventually the process crashes.

Tracked internally at [elastic/kibana-team#3039](https://github.com/elastic/kibana-team/issues/3039).

## Prerequisites

- **macOS** (the script uses `pfctl`, the macOS packet filter firewall)
- **Node.js v22+** (the bug exists in all current Node.js versions)
- **sudo access** (firewall manipulation requires root)
- **Kibana repo checked out** (the script uses Kibana's test TLS certificates)

Nothing else to install — the script uses only Node.js built-in modules (`http2`, `fs`, `path`, `child_process`).

Verify your setup:

```bash
# Check Node version (must be v22+)
node --version

# Check that the test certs exist
ls src/platform/packages/shared/kbn-dev-utils/certs/kibana.{crt,key}

# Check that pfctl is available (should be on any macOS)
which pfctl
```

## Quick start

```bash
cd /path/to/kibana

# Safe mode: observe the zombie state without crashing
sudo node scripts/reproduce_zombie_http2.js

# Crash mode: also trigger the C++ assertion failure
sudo node scripts/reproduce_zombie_http2.js --crash
```

## What the script does

The test has 6 phases. All line references below point to `./reproduce_zombie_http2.js`.

### Phase 1 — Start an HTTP/2 server

`startServer()` (line 184) spawns a child process running a minimal HTTP/2 server. The server code is defined inline (lines 185–216) — it calls `http2.createSecureServer()` with Kibana's self-signed test certificates (cert/key paths configured at lines 70–72) and responds `"ok"` to every request. It runs as a child process so its event loop is independent from the client.

### Phase 2 — Connect a client and verify the connection works

Lines 281–305: an HTTP/2 client connects with `http2.connect()` (line 281) and event listeners are registered for `error`, `close`, `goaway`, and `timeout` (lines 286–290). A health-check request (lines 296–303) proves the connection is working before we break it.

### Phase 3 — Create a network black hole

`pfBlockPort()` (line 106) temporarily replaces the macOS pf ruleset with one that **silently drops** all TCP packets on loopback in both directions for the server port:

```
block drop quick on lo0 proto tcp from any to 127.0.0.1 port 18443
block drop quick on lo0 proto tcp from 127.0.0.1 port 18443 to any
```

We have to replace the main ruleset (rather than use an anchor) because macOS's default `/etc/pf.conf` only evaluates anchors under `com.apple/*` — a custom anchor would be silently ignored. The temporary config preserves Apple's anchor points and adds `pass all` so everything else keeps working. On cleanup, `/etc/pf.conf` is restored.

`block drop` means packets vanish — no TCP RST, no FIN, no ICMP unreachable. This is what happens during a NAT timeout, network partition, or silent peer crash in production.

### Phase 4 — Send requests into the void

Lines 330–339: a loop sends 5 HTTP/2 requests via `session.request()`. They're serialized into HTTP/2 frames, encrypted by TLS, and pushed to the TCP socket — where the kernel tries to deliver them, fails (firewall drops the packets), and silently retransmits. Error handlers are attached (line 332) so unhandled rejections don't mask the real behavior. The requests never reach the server.

### Phase 5 — Monitor the zombie

Lines 354–404: a 15-second monitoring loop prints the session state every second. Each iteration reads `session.closed`, `session.destroyed`, and `session.state.outboundQueueSize` (lines 384–388) and checks whether the collected `events` array is still empty. At `t=3s`, a PING is sent via `session.ping()` (lines 362–367) — its callback will never fire. You'll see output like:

```
  ┌─────────────────────────────────────────────────────────────
  │ [1.5s]  ZOMBIE | closed=false destroyed=false queueSize=6 events=none
  │ [2.5s]  ZOMBIE | closed=false destroyed=false queueSize=6 events=none
  │ [3.5s]  ZOMBIE | closed=false destroyed=false queueSize=6 events=none
  │         ping=sent (callback pending...)
  │ ...
  │ [15.5s] ZOMBIE | closed=false destroyed=false queueSize=6 events=none
  └─────────────────────────────────────────────────────────────
```

Key things to notice:

| Indicator | Expected (healthy) | Actual (zombie) |
|---|---|---|
| `session.closed` | `true` | `false` |
| `session.destroyed` | `true` | `false` |
| `outboundQueueSize` | `0` | growing (frames stuck) |
| Events (close/error) | at least one fires | **none** |
| `session.ping()` callback | responds in ~ms | **never fires** |

The session looks completely healthy to any code that checks it. But no data is flowing.

### Phase 6 (with `--crash`) — Trigger the assertion failure

Lines 435–468: if you pass `--crash`, the script retrieves the real TLS socket hidden behind a Symbol on the session (lines 445–447) and writes raw data directly to it (line 462). This bypasses HTTP/2's own write queue and creates a **concurrent write** at the TLS layer while HTTP/2 already has a write in flight. Node.js enforces a one-write-at-a-time invariant with a C++ assertion:

```
Assertion failed: !current_write_
  at node::crypto::TLSWrap::DoWrite (src/crypto/crypto_tls.cc:1033)
```

This kills the process. It's not a catchable JavaScript exception — it's a C++ `abort()`.

## Options

| Flag | Description |
|---|---|
| `--crash` | Also trigger the assertion failure (process will abort) |
| `--port <n>` | Use a different port (default: 18443) |
| `--help` | Show usage information |

## Cleanup

The script registers cleanup hooks (lines 171–178) for `exit`, `SIGINT` (Ctrl+C), `SIGTERM`, and uncaught exceptions. The `cleanup()` function (line 156) restores `/etc/pf.conf` via `pfCleanup()` (line 102) and kills the server child process.

If something goes wrong and the rules persist (e.g., the process was `kill -9`'d), restore the default pf config manually:

```bash
sudo pfctl -f /etc/pf.conf
```

You can verify the block rules are gone with:

```bash
sudo pfctl -s rules | grep block
```

## Why pfctl?

The bug requires a **true packet black hole** — packets must vanish without any response. This is different from closing a socket (which sends FIN) or resetting a connection (which sends RST). Both of those would be detected by Node.js immediately.

Real-world scenarios that create black holes:
- **NAT/firewall timeout**: a stateful middlebox evicts an idle connection mapping. Packets from either side are now dropped or sent to the wrong place.
- **Network partition**: a switch/cable fails. No packets can traverse the path.
- **Peer crash**: the remote machine loses power or kernel-panics without sending RST.
- **Cloud infrastructure**: load balancers, VPN tunnels, and overlay networks can all silently drop connections.

On macOS, `pfctl` is the only way to create this condition on loopback. Alternatives like a TCP proxy wouldn't work because the client-to-proxy TCP connection would remain alive at the OS level — there would be no zombie.

## Interpreting the results

**Success (zombie reproduced):** The monitoring phase shows `ZOMBIE` status — `closed=false`, `destroyed=false`, `events=none`, and a growing `queueSize`. This confirms the bug: Node.js doesn't know the connection is dead.

**Success (crash reproduced, with `--crash`):** The process aborts with the assertion failure. The exit code will be non-zero and you'll see the native stack trace. The cleanup hook will still remove the firewall rule.

**Partial success (events fire during monitoring):** If you see `close` or `error` events, the TCP retransmission timeout kicked in before the monitoring finished. The zombie state existed briefly but was resolved by the kernel. This is normal — it means the zombie window was shorter than 15 seconds on your system. You can adjust `MONITOR_SECONDS` (line 351) in the script to observe it within the window.

## Relation to Kibana

In production, Kibana maintains long-lived HTTP/2 connections to Elasticsearch. If one of these connections hits a silent network failure (especially in cloud/serverless environments with NAT gateways and load balancers), the connection becomes a zombie:

- All requests routed through that session hang silently
- No error events fire, so Kibana's monitoring doesn't detect it
- The outbound queue grows until the process eventually crashes

See `INVESTIGATION.md` in the repo root for the full technical analysis, impact assessment, and potential workarounds.
