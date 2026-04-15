# Node.js HTTP/2 Zombie Session Bug — Investigation

## TL;DR

When a TCP connection silently dies (e.g., NAT timeout, network partition — no RST or FIN packet sent), Node.js never learns the socket is gone. The HTTP/2 session keeps thinking the connection is healthy, writes queue up indefinitely, and eventually the process crashes with a C++ assertion failure deep inside Node's TLS or HTTP/2 internals. The bug is **unfixed upstream** (nodejs/node#61304 is still open), and Kibana has no workarounds in place today.

---

## What's Happening

Think of an HTTP/2 session as a phone call. Normally, when one side hangs up, the other side hears the click (a TCP FIN or RST packet). But sometimes the line goes dead silently — the other side's phone was unplugged, or a router in the middle dropped the circuit without telling anyone.

When this happens:

1. The **OS kernel** eventually figures out the connection is dead (via TCP retransmission timeouts) and marks the socket as `CLOSED`.
2. **Node.js never gets the memo.** No `close` event fires. No `error` event fires. The HTTP/2 session reports `closed: false`, `destroyed: false`, `socket.writable: true`.
3. The session keeps **queuing outbound frames** — HTTP/2 requests, PING frames, GOAWAY frames — into a write buffer that will never drain.
4. Eventually, the queued writes trigger a **C++ assertion failure** and the process crashes.

In the original production discovery, the zombie session persisted for hours. All requests to the affected host silently failed (queued but never sent), while connections to other hosts worked fine. The session had 2,815 frames stuck in its outbound queue.

---

## Why It Happens

The root cause spans four layers. Here's the chain from bottom to top:

### Layer 1: The OS Kernel (TCP State Machine)

TCP is a *packet-driven* state machine. The local kernel only transitions socket state when it **receives a packet** (FIN, RST, ACK) or when a **local timer fires** (retransmission timeout, keepalive timeout).

| Scenario | Kernel behavior | Detection time |
|---|---|---|
| Peer sends FIN (clean shutdown) | Kernel gets packet, queues read event | Immediate |
| Peer sends RST (abort) | Kernel gets packet, queues error event | Immediate |
| NAT timeout / cable unplug / peer crash | No packet arrives. Nothing happens. | **Not detected** until local TCP retransmission timeout (default: 15–30 minutes on Linux) or keepalive probe fails |

In the silent-death case, the local kernel still thinks the connection is `ESTABLISHED`. It only transitions to `CLOSED` after retransmission attempts fail — and even then, the timing of *when* the application gets notified depends on whether it's actively reading or writing.

### Layer 2: libuv (Node's I/O Layer)

libuv uses **epoll** (Linux) or **kqueue** (macOS) to watch file descriptors. It is purely reactive — it never polls socket state. It only learns about changes when the kernel delivers an event:

```
epoll/kqueue event → uv__stream_io() → uv__read() → read() syscall
                                                         ↓
                                        returns 0 (FIN) → UV_EOF
                                        returns -1 (RST) → ECONNRESET
                                        returns -1 (timeout) → ETIMEDOUT
```

If no event arrives from the kernel (because no packet arrived), libuv sits idle. **There is no active health-checking mechanism built into libuv.** The socket file descriptor remains "valid" and libuv has no way to distinguish a healthy idle connection from a dead one.

### Layer 3: TLS (OpenSSL + Node's TLSWrap)

Node's TLS layer (`src/crypto/crypto_tls.cc`) wraps the TCP stream. It maintains a critical invariant: **only one write can be in flight at a time**, tracked by a `current_write_` pointer.

```cpp
// TLSWrap::DoWrite — starts a new write
CHECK(!current_write_);              // Assert: no write already in progress
current_write_.reset(w->GetAsyncWrap());  // Store the active write
// ... encrypt data via OpenSSL, push to TCP socket ...
```

When the write completes (TCP ACK received), `TLSWrap::OnStreamAfterWrite` clears `current_write_` and notifies the HTTP/2 layer above.

**With a zombie socket:** The first write goes out to the dead socket. It's technically "in flight" — the TCP stack is trying to retransmit, so the completion callback never fires. `current_write_` stays set. When the HTTP/2 layer tries to send *another* write (a PING, a new request, an RST_STREAM), `DoWrite` hits `CHECK(!current_write_)` and crashes:

```
Assertion failed: !current_write_
  at node::crypto::TLSWrap::DoWrite (src/crypto/crypto_tls.cc:1033)
```

### Layer 4: HTTP/2 (nghttp2 + Node's Http2Session)

The HTTP/2 session (`src/node_http2.cc`) has its own write pipeline with a similar one-at-a-time invariant tracked by `is_write_in_progress()`.

The `ClearOutgoing` method processes completed writes and can re-entrantly trigger new writes:

```cpp
void Http2Session::ClearOutgoing(int status) {
  set_sending(false);           // Clears re-entrancy guard FIRST
  // ... process completed write callbacks (calls into JS) ...
  if (!pending_rst_streams_.empty()) {
    SendPendingData();          // RE-ENTERS — can start a new write
  }
}
```

This re-entrant path can start a new write while the TLS layer still has the previous write in flight, violating the one-write-at-a-time invariant. The other crash:

```
Assertion failed: is_write_in_progress()
  at node::http2::Http2Session::OnStreamAfterWrite (src/node_http2.cc:1741)
```

This fires when a write-completion callback arrives but the session's `write_in_progress` flag was already cleared (by a synchronous error path or by `ClearOutgoing` processing).

### The Fundamental Problem

These four layers have a **shared assumption**: writes complete in bounded time, either successfully or with an error. A zombie socket violates this assumption — writes neither complete nor fail. They just hang forever, corrupting the state machines that assume serial write completion.

---

## When It Triggers

All of these conditions must hold simultaneously:

1. **Long-lived HTTP/2 connection** — short-lived connections are unlikely to hit a network event mid-session.

2. **Silent connection death** — the remote end (or a middlebox like a NAT, load balancer, or firewall) drops the connection without sending RST or FIN. Common causes:
   - **NAT/firewall timeout**: Stateful middleboxes evict idle connections after a timeout (often 5–30 minutes). The remote host still thinks the connection is alive, but the middlebox silently drops packets in both directions.
   - **Network partition**: A switch, cable, or route fails. No packets can traverse the path, so no RST/FIN is generated.
   - **Peer crash**: The remote process or machine crashes hard (kernel panic, OOM kill, power loss) without sending a TCP RST.
   - **Cloud infrastructure**: Cloud load balancers, VPN tunnels, and container networking overlays can all silently drop connections.

3. **No TCP keepalive** — TCP keepalive probes would detect the dead peer (kernel sends small probe packets and marks the socket as dead if no response), but Node.js HTTP/2 does **not** enable keepalive by default.

4. **No application-level health checks** — HTTP/2 has a PING frame mechanism, but Node.js does not send PINGs automatically. Without periodic pings, there's no way to detect that the connection is dead at the application layer.

5. **Continued write attempts** — the crash only happens when something tries to write to the zombie session. If the session sits completely idle, it just leaks resources without crashing.

---

## Impact on Kibana

### Direct Impact

- **Process crash**: The assertion failure kills the Node.js process. This is not a catchable exception — it's a C++ `CHECK` macro that calls `abort()`. No error handler, `process.on('uncaughtException')`, or domain can intercept it.

- **Silent request failures before crash**: Before the crash, all HTTP/2 requests routed through the zombie session queue up and never complete. Depending on Kibana's connection pooling, this could affect all requests to a specific Elasticsearch node.

- **Difficult to diagnose**: The session reports as healthy (`closed: false`, `destroyed: false`, `socket.writable: true`). Standard monitoring won't flag it. The only visible symptom is growing `outboundQueueSize` and requests that hang indefinitely.

### Where It Can Happen in Kibana

- **Elasticsearch client connections**: Kibana maintains long-lived connections to Elasticsearch via `@elastic/elasticsearch`. The agent manager (`src/core/packages/elasticsearch/client-server-internal/src/agent_manager.ts`) uses standard HTTPS agents with `keepAlive: true`, but this is HTTP-level keepalive (reusing connections), not TCP-level `SO_KEEPALIVE` (probing dead peers).

- **Serverless / cloud environments**: Particularly likely in environments with multiple network hops — cloud load balancers, VPN tunnels, NAT gateways, container networking — where silent connection drops are more common.

- **Behind reverse proxies**: The base path proxy (`packages/kbn-cli-dev-mode/src/base_path_proxy/http2.ts`) uses HTTP/2 connections that could become zombies.

### Current Kibana Defenses (or Lack Thereof)

Based on codebase analysis:

- **Socket timeout**: 120s server-side (`server.socketTimeout`), 60s client-side (`elasticsearch.idleSocketTimeout`). These are *idle* timeouts — they fire when no data flows. A zombie session with queued writes may not trigger idle timeout because the session thinks it's actively writing.
- **Max sockets/idle sockets**: 800 max sockets, 256 max idle. Limits pool growth but doesn't detect zombies.
- **No TCP keepalive**: Not explicitly configured on HTTP/2 sockets.
- **No PING-based health checks**: No periodic HTTP/2 PING frames.
- **No references to the bug**: No mentions of issue #61304 or zombie session workarounds in the codebase.

---

## Known Workarounds and Potential Fixes

### Upstream (Node.js)

**Status: Unfixed.** Issue nodejs/node#61304 remains open. The only fix attempt (PR #61702 by @suuuuuuminnnnnn) was closed because the author couldn't produce a CI-friendly reproduction — the bug requires real network conditions (packet black-holes) that are hard to simulate on loopback interfaces.

Previously fixed related issues did not address this root cause:
- **PR #49327** (merged 2023): Fixed segfault when socket is *destroyed*, but zombie sockets aren't destroyed — they're silently dead.
- **PR #18987** (closed): Handled writes after SSL destroy, but the zombie SSL layer doesn't know it should be destroyed.
- **Issue #30896**: Same assertion, attributed to memory exhaustion, not zombie sessions.

### Workaround 1: TCP Keepalive (Recommended)

Enable `SO_KEEPALIVE` on the underlying TCP socket with aggressive timers. This makes the kernel periodically send probe packets and detect dead peers.

```js
// Before creating the HTTP/2 session, or on the underlying socket:
socket.setKeepAlive(true, 60);  // First probe after 60s idle
```

On Linux, tune the kernel defaults for faster detection:
```
net.ipv4.tcp_keepalive_time = 60    # Seconds idle before first probe
net.ipv4.tcp_keepalive_intvl = 10   # Seconds between probes
net.ipv4.tcp_keepalive_probes = 6   # Failed probes before declaring dead
```

This gives ~120s worst-case detection time (60s idle + 6 probes * 10s).

**Caveat**: Node.js HTTP/2 blocks `setKeepAlive` on the proxied socket object. You must set it on the real underlying `net.Socket` or `tls.TLSSocket` *before* passing it to the HTTP/2 session, or access it via `session.socket` (the unwrapped socket).

### Workaround 2: Application-Level PING Health Checks

Send periodic HTTP/2 PING frames and destroy the session if the ping callback doesn't fire within a timeout:

```js
const PING_INTERVAL = 30_000;  // 30 seconds
const PING_TIMEOUT = 10_000;   // 10 seconds to respond

const interval = setInterval(() => {
  if (session.destroyed || session.closed) {
    clearInterval(interval);
    return;
  }

  let responded = false;
  const timeout = setTimeout(() => {
    if (!responded) {
      session.destroy(new Error('HTTP/2 ping timeout — possible zombie session'));
    }
  }, PING_TIMEOUT);

  session.ping((err, duration) => {
    responded = true;
    clearTimeout(timeout);
    if (err) {
      session.destroy(err);
    }
  });
}, PING_INTERVAL);
```

**Note**: In a zombie session, `session.ping()` returns `true` (ping "sent") but the callback **never fires** — the ping frame is queued behind the stuck writes. The timeout catch is essential.

### Workaround 3: Session Max Lifetime

Destroy and recreate HTTP/2 sessions after a maximum lifetime, regardless of whether they appear healthy:

```js
const MAX_SESSION_LIFETIME = 10 * 60 * 1000; // 10 minutes
setTimeout(() => {
  if (!session.destroyed) {
    session.destroy();
    // Reconnect logic here
  }
}, MAX_SESSION_LIFETIME);
```

This is a blunt instrument but provides an upper bound on how long a zombie can persist.

### Workaround 4: Outbound Queue Monitoring

Monitor `session.state.outboundQueueSize` — a growing queue with static `bytesWritten` is a strong zombie indicator:

```js
let lastBytesWritten = 0;
const monitor = setInterval(() => {
  const state = session.state;
  if (state.outboundQueueSize > 100 && state.bytesWritten === lastBytesWritten) {
    session.destroy(new Error('Zombie session detected: queue growing, no bytes written'));
  }
  lastBytesWritten = state.bytesWritten;
}, 5_000);
```

### Workaround 5: Write Timeout Guard

Wrap writes to detect the stuck condition before the assertion fires. This is more invasive but directly addresses the crash:

```js
// Set socket write timeout — if the underlying socket can't flush data,
// destroy the session before the assertion fires
session.socket.setTimeout(30_000, () => {
  session.destroy(new Error('Socket write timeout — connection may be dead'));
});
```

### Potential Upstream Fix

The ideal fix would be in Node.js itself, in one of these forms:

1. **Convert assertions to graceful errors**: Change `CHECK(is_write_in_progress())` and `CHECK(!current_write_)` to return error codes instead of aborting. This doesn't fix the zombie, but prevents the crash.

2. **Propagate socket state proactively**: Have the TLS or HTTP/2 layer periodically check the underlying fd's state (e.g., `getsockopt(SO_ERROR)`) rather than waiting for events.

3. **Guard re-entrant writes**: Fix `ClearOutgoing` to not call `SendPendingData` while a write is in flight in the TLS layer.

---

## Key References

### Issues
- **nodejs/node#61304** — Primary upstream bug report. Open, unfixed. Contains detailed reproduction steps, debugging evidence, and crash traces. https://github.com/nodejs/node/issues/61304
- **elastic/kibana-team#3039** — Kibana tracking issue for reproducing the bug. Open. https://github.com/elastic/kibana-team/issues/3039
- **nodejs/node#49307** — Related: HTTP/2 segfault if socket unexpectedly closed (fixed by PR #49327, different root cause). https://github.com/nodejs/node/issues/49307
- **nodejs/node#30896** — Related: TLS assertion error in DoWrite (same assertion, attributed to memory exhaustion). https://github.com/nodejs/node/issues/30896

### Pull Requests
- **nodejs/node#61702** — Attempted fix for #61304, closed without merge (couldn't reproduce in CI). https://github.com/nodejs/node/pull/61702
- **nodejs/node#49327** — Fixed socket-destroyed segfault (merged 2023, doesn't cover zombie case). https://github.com/nodejs/node/pull/49327
- **nodejs/node#18987** — Handled writes after SSL destroy (closed, doesn't cover zombie case). https://github.com/nodejs/node/pull/18987

### Source Files (Node.js `main` branch)
- **`src/node_http2.cc`** — `Http2Session::OnStreamAfterWrite` (~line 1775), `ClearOutgoing` (~line 1858), `SendPendingData` (~line 1925). The crash site and the re-entrant write path.
- **`src/crypto/crypto_tls.cc`** — `TLSWrap::DoWrite` (~line 1066), `TLSWrap::OnStreamAfterWrite`. The one-write-at-a-time invariant and second crash site.
- **`lib/internal/http2/core.js`** — `socketOnClose` (~line 3560), `socketOnError` (~line 3241). JS-level event handlers that never fire in the zombie case.

### Kibana Source Files
- **`src/core/packages/elasticsearch/client-server-internal/src/agent_manager.ts`** — HTTP agent pooling for Elasticsearch connections.
- **`src/core/packages/elasticsearch/client-server-internal/src/client_config.ts`** — Elasticsearch client options (timeout, keepalive, max sockets).
- **`src/platform/packages/shared/kbn-server-http-tools/src/get_listener.ts`** — HTTP/2 server listener setup.
- **`packages/kbn-cli-dev-mode/src/base_path_proxy/http2.ts`** — HTTP/2 proxy (dev mode).

### libuv Internals
- **`src/unix/stream.c`** — `uv__stream_io()`, `uv__read()`, `uv__stream_eof()`. The event-driven I/O loop that only reacts to kernel events.
- **`src/unix/tcp.c`** — `uv_tcp_keepalive()`. TCP keepalive support in libuv.
