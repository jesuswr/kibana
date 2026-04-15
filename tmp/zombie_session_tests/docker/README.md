# HTTP/2 Zombie Session — Docker Reproduction

Reproduces [nodejs/node#61304](https://github.com/nodejs/node/issues/61304) in a Docker container using Linux `iptables` to create a network black hole.

Tracked internally at [elastic/kibana-team#3039](https://github.com/elastic/kibana-team/issues/3039).

## Prerequisites

- Docker

That's it. Everything else (Node.js 22, iptables, certs) is inside the container.

## Build

```bash
cd tmp/zombie_session_tests
docker build -t zombie-http2 .
```

## Run

```bash
# Observe mode — demonstrate the zombie state without crashing
docker run --cap-add=NET_ADMIN zombie-http2

# Crash mode — also trigger the C++ assertion failure
docker run --cap-add=NET_ADMIN zombie-http2 --crash

# Custom port
docker run --cap-add=NET_ADMIN zombie-http2 --port 9443
```

`--cap-add=NET_ADMIN` is required because `iptables` needs the `CAP_NET_ADMIN` capability to manipulate firewall rules.

## What it does

1. Starts an HTTP/2 server inside the container with Kibana's test TLS certs
2. Connects an HTTP/2 client and verifies the connection works
3. Adds `iptables -j DROP` rules to silently discard all TCP packets on the server port (no RST, no FIN — packets vanish)
4. Sends HTTP/2 requests into the black hole and monitors session state for 15 seconds
5. Shows that Node.js reports the session as healthy while all requests silently fail
6. With `--crash`: triggers the `CHECK(!current_write_)` assertion failure

## Expected output

**Observe mode:** 15 seconds of `ZOMBIE` status lines showing `closed=false destroyed=false responses=0/5 events=none`, followed by a summary confirming the zombie state. The process exits cleanly.

**Crash mode:** Same as above, plus a native stack trace ending with:
```
Assertion failed: is_write_in_progress()
  at node::http2::Http2Session::OnStreamAfterWrite (src/node_http2.cc:1774)
```

## Differences from the macOS version

| | macOS (`scripts/reproduce_zombie_http2.js`) | Docker (this version) |
|---|---|---|
| Firewall | `pfctl` (packet filter) | `iptables -j DROP` |
| Platform | macOS only | Any machine with Docker |
| Root access | `sudo` required | `--cap-add=NET_ADMIN` |
| Certs | Read from Kibana source tree | Copied into container at build time |
| Cleanup | Restores `/etc/pf.conf` | Removes iptables rules (container-scoped) |

## Cleanup

The iptables rules are scoped to the container's network namespace, so they vanish when the container exits. No host-level cleanup is needed.

If running outside Docker for some reason:
```bash
sudo iptables -D INPUT  -p tcp --dport 18443 -j DROP
sudo iptables -D OUTPUT -p tcp --dport 18443 -j DROP
sudo iptables -D INPUT  -p tcp --sport 18443 -j DROP
sudo iptables -D OUTPUT -p tcp --sport 18443 -j DROP
```
