/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

/* eslint-disable no-loop-func */

/* eslint-disable no-empty */

/* eslint-disable prettier/prettier */
/* eslint-disable strict */
/* eslint-disable no-restricted-syntax */

/**
 * reproduce_zombie_http2.js (Linux / Docker version)
 *
 * Reproduces the Node.js HTTP/2 zombie session bug (nodejs/node#61304)
 * using iptables to create a network black hole.
 *
 * REQUIRES: root (iptables needs CAP_NET_ADMIN)
 * PLATFORM: Linux only (uses iptables)
 *
 * Usage:
 *   node reproduce_zombie_http2.js                # Demonstrate zombie state only
 *   node reproduce_zombie_http2.js --crash        # Also trigger the assertion crash
 *   node reproduce_zombie_http2.js --port 9443    # Use a custom port
 *   node reproduce_zombie_http2.js --help
 *
 * Docker usage:
 *   docker build -t zombie-http2 .
 *   docker run --cap-add=NET_ADMIN zombie-http2              # observe mode
 *   docker run --cap-add=NET_ADMIN zombie-http2 --crash      # crash mode
 *
 * What it does:
 *   1. Starts an HTTP/2 server (child process) with self-signed TLS certs
 *   2. Connects an HTTP/2 client and verifies the connection works
 *   3. Activates iptables rules to silently drop all packets to the server port
 *      (no RST, no FIN — packets just vanish, like a NAT timeout or network partition)
 *   4. Sends HTTP/2 requests into the black hole and monitors the session state
 *   5. Shows that the session reports as healthy while writes queue up forever
 *   6. Optionally triggers the assertion crash by writing directly to the TLS socket
 *   7. Cleans up the iptables rules (even on crash, via signal handlers)
 *
 * Cleanup:
 *   The script registers signal handlers and an exit hook to remove the iptables rules.
 *   If the process crashes hard (SIGKILL), run manually:
 *     iptables -D INPUT  -p tcp --dport 18443 -j DROP 2>/dev/null
 *     iptables -D OUTPUT -p tcp --dport 18443 -j DROP 2>/dev/null
 */

'use strict';

const http2 = require('http2');
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ARGS = process.argv.slice(2);

if (ARGS.includes('--help') || ARGS.includes('-h')) {
  console.log(fs.readFileSync(__filename, 'utf8').match(/\/\*\*([\s\S]*?)\*\//)[0]);
  process.exit(0);
}

const TRIGGER_CRASH = ARGS.includes('--crash');
const PORT_IDX = ARGS.indexOf('--port');
const PORT = PORT_IDX !== -1 ? parseInt(ARGS[PORT_IDX + 1], 10) : 18443;

// Certs are copied into the container at /app/certs/
const CERTS_DIR = path.resolve(__dirname, 'certs');
const CERT_PATH = path.join(CERTS_DIR, 'kibana.crt');
const KEY_PATH = path.join(CERTS_DIR, 'kibana.key');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const log = (tag, ...args) => {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}] [${tag}]`, ...args);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs a shell command, swallowing stderr.
 * Returns true if the command succeeded.
 */
function sh(cmd) {
  try {
    execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Firewall management (Linux iptables)
//
// iptables -j DROP silently discards packets — no RST, no FIN, no ICMP.
// This is the Linux equivalent of macOS "block drop".
// We add rules to both INPUT and OUTPUT chains to fully simulate a
// network partition on loopback.
// ---------------------------------------------------------------------------

function iptablesCleanup() {
  // Remove our rules (ignore errors if they don't exist)
  sh(`iptables -D INPUT  -p tcp --dport ${PORT} -j DROP 2>/dev/null`);
  sh(`iptables -D OUTPUT -p tcp --dport ${PORT} -j DROP 2>/dev/null`);
  sh(`iptables -D INPUT  -p tcp --sport ${PORT} -j DROP 2>/dev/null`);
  sh(`iptables -D OUTPUT -p tcp --sport ${PORT} -j DROP 2>/dev/null`);
}

function iptablesBlockPort(port) {
  // Block all TCP traffic to/from the port in both directions.
  // -j DROP = silently discard (no RST, no ICMP unreachable).
  // We block both dport and sport to cover both directions on loopback.
  const rules = [
    `iptables -A INPUT  -p tcp --dport ${port} -j DROP`,
    `iptables -A OUTPUT -p tcp --dport ${port} -j DROP`,
    `iptables -A INPUT  -p tcp --sport ${port} -j DROP`,
    `iptables -A OUTPUT -p tcp --sport ${port} -j DROP`,
  ];

  for (const rule of rules) {
    try {
      execSync(rule, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString().trim() : '(no output)';
      throw new Error(`iptables rule failed: ${rule}\n${stderr}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

function preflight() {
  if (process.platform !== 'linux') {
    console.error('This script uses Linux iptables. For macOS, use the pfctl version instead.');
    process.exit(1);
  }

  if (process.getuid() !== 0) {
    console.error('This script requires root for iptables manipulation.');
    console.error('Run with: docker run --cap-add=NET_ADMIN zombie-http2');
    process.exit(1);
  }

  // Verify iptables is available
  if (!sh('which iptables')) {
    console.error('iptables not found. Install with: apt-get install iptables');
    process.exit(1);
  }

  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    console.error(`Test certificates not found at ${CERTS_DIR}`);
    console.error('Expected kibana.crt and kibana.key');
    process.exit(1);
  }

  // Clean up any leftover rules from a previous run
  iptablesCleanup();
  // Kill anything on our port from a previous run
  sh(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`);
}

// ---------------------------------------------------------------------------
// Cleanup on exit (critical — leftover iptables rules break networking)
// ---------------------------------------------------------------------------

let serverProcess = null;
let cleaned = false;

function cleanup() {
  if (cleaned) return;
  cleaned = true;

  log('CLEANUP', 'Removing iptables rules...');
  iptablesCleanup();

  if (serverProcess && !serverProcess.killed) {
    log('CLEANUP', 'Killing server process...');
    serverProcess.kill('SIGKILL');
  }

  log('CLEANUP', 'Done.');
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
process.on('uncaughtException', (err) => {
  log('CRASH', err.message);
  cleanup();
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Server (runs as child process so its event loop is independent)
// ---------------------------------------------------------------------------

function startServer() {
  const serverCode = `
    const http2 = require('http2');
    const fs = require('fs');

    const server = http2.createSecureServer({
      key: fs.readFileSync(${JSON.stringify(KEY_PATH)}),
      cert: fs.readFileSync(${JSON.stringify(CERT_PATH)}),
      allowHTTP1: true,
    });

    let requestCount = 0;

    server.on('stream', (stream, headers) => {
      requestCount++;
      const p = headers[':path'];
      stream.respond({ ':status': 200, 'content-type': 'text/plain' });
      stream.end('ok from server: ' + p);
    });

    server.on('error', (err) => {
      console.error('[SERVER ERROR]', err.message);
    });

    server.listen(${PORT}, '127.0.0.1', () => {
      console.log('READY');
    });

    // Keep alive and log stats
    setInterval(() => {
      console.log('SERVER_STATS requests=' + requestCount);
    }, 5000);
  `;

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', serverCode], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess = child;

    child.stderr.on('data', (d) => {
      log('SERVER:ERR', d.toString().trim());
    });

    child.on('exit', (code) => {
      log('SERVER', `Exited with code ${code}`);
    });

    // Wait for the "READY" signal
    child.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg === 'READY') {
        log('SERVER', `Listening on https://127.0.0.1:${PORT}`);
        resolve(child);
      } else if (msg.startsWith('SERVER_STATS')) {
        // silently consume stats
      } else {
        log('SERVER', msg);
      }
    });

    setTimeout(() => reject(new Error('Server failed to start within 5s')), 5000);
  });
}

// ---------------------------------------------------------------------------
// Main reproduction flow
// ---------------------------------------------------------------------------

async function main() {
  preflight();

  console.log('');
  console.log('='.repeat(70));
  console.log(' HTTP/2 Zombie Session Reproduction (Linux / Docker)');
  console.log(' Node.js:', process.version, '| PID:', process.pid);
  console.log(' Mode:', TRIGGER_CRASH ? 'CRASH (will trigger assertion failure)' : 'OBSERVE (demonstrate zombie state)');
  console.log('='.repeat(70));
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 1: Start server
  // -----------------------------------------------------------------------

  log('PHASE 1', 'Starting HTTP/2 server...');
  await startServer();

  // Small delay to ensure server is fully ready
  await sleep(500);

  // -----------------------------------------------------------------------
  // Phase 2: Connect client and verify connection
  // -----------------------------------------------------------------------

  log('PHASE 2', 'Connecting HTTP/2 client...');

  const session = http2.connect(`https://127.0.0.1:${PORT}`, {
    rejectUnauthorized: false,
  });

  // Collect events for observability
  const events = [];
  session.on('error', (e) => { events.push(`error: ${e.message}`); log('EVENT', 'error:', e.message); });
  session.on('close', () => { events.push('close'); log('EVENT', 'close'); });
  session.on('goaway', (code) => { events.push(`goaway: ${code}`); log('EVENT', 'goaway:', code); });
  session.on('timeout', () => { events.push('timeout'); log('EVENT', 'timeout'); });

  await new Promise((resolve) => session.on('connect', resolve));
  log('PHASE 2', 'Connected. Verifying with initial request...');

  // Make an initial request to prove the connection works
  const initResponse = await new Promise((resolve, reject) => {
    const req = session.request({ ':path': '/health-check' });
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
    req.end();
  });

  log('PHASE 2', `Initial request succeeded: "${initResponse}"`);

  // -----------------------------------------------------------------------
  // Phase 3: Create the black hole
  // -----------------------------------------------------------------------

  log('PHASE 3', 'Activating iptables black hole...');
  log('PHASE 3', `  Rules: DROP all TCP to/from port ${PORT}`);
  log('PHASE 3', '  Effect: packets silently disappear (no RST, no FIN, no ICMP)');
  log('PHASE 3', '  This simulates: NAT timeout, network partition, peer crash');

  iptablesBlockPort(PORT);

  log('PHASE 3', 'Black hole ACTIVE. Connection is now silently broken.');
  console.log('');

  // -----------------------------------------------------------------------
  // Phase 4: Send requests into the black hole
  // -----------------------------------------------------------------------

  log('PHASE 4', 'Sending HTTP/2 requests into the black hole...');
  log('PHASE 4', '(These requests will never reach the server)');

  const pendingRequests = [];
  let responsesReceived = 0;

  for (let i = 1; i <= 5; i++) {
    const req = session.request({ ':path': `/zombie-request-${i}` });
    req.on('error', () => { }); // Suppress unhandled error
    req.on('response', () => { responsesReceived++; log('REQ', `Request ${i} got response (unexpected!)`); });
    req.end();
    pendingRequests.push(req);

    log('PHASE 4', `  Sent request ${i}/5`);
    await sleep(300);
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Phase 5: Monitor the zombie state
  // -----------------------------------------------------------------------

  log('PHASE 5', 'Monitoring zombie session state...');
  log('PHASE 5', 'Watch: session thinks it\'s healthy, but writes are stuck');
  console.log('');

  const MONITOR_SECONDS = 15;
  const startTime = Date.now();
  let pingStatus = 'not attempted';

  for (let i = 1; i <= MONITOR_SECONDS; i++) {
    await sleep(1000);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Try a ping — it will "succeed" (return true) but the callback never fires
    if (i === 3) {
      const pingResult = session.ping((err, duration) => {
        // This callback will NEVER fire for a zombie session
        pingStatus = 'responded!';
        log('PING', err ? `failed: ${err.message}` : `responded in ${duration}ms`);
      });
      pingStatus = pingResult ? 'sent (callback pending...)' : 'failed to send';
    }

    const isZombie =
      !session.closed &&
      !session.destroyed &&
      events.length === 0 &&
      responsesReceived === 0;

    if (i === 1) {
      console.log('  ┌──────────────────────────────────────────────────────────────────────────');
    }

    const statusIcon = isZombie ? 'ZOMBIE' : 'OK';
    console.log(`  │ [${elapsed}s] ${statusIcon} | closed=${session.closed} destroyed=${session.destroyed} responses=${responsesReceived}/${pendingRequests.length} events=${events.length === 0 ? 'none' : events.join(',')}`);

    if (i === 3) {
      console.log(`  │         ping=${pingStatus}`);
    }

    if (i === MONITOR_SECONDS) {
      console.log('  └──────────────────────────────────────────────────────────────────────────');
    }
  }

  console.log('');

  // -----------------------------------------------------------------------
  // Summary of zombie state
  // -----------------------------------------------------------------------

  const finalState = session.state || {};

  log('RESULT', '--- Zombie Session Evidence ---');
  log('RESULT', `  session.closed:    ${session.closed}    (should be true, but isn't)`);
  log('RESULT', `  session.destroyed: ${session.destroyed} (should be true, but isn't)`);
  log('RESULT', `  responses:         ${responsesReceived}/${pendingRequests.length}    (requests vanished into the black hole)`);
  log('RESULT', `  events received:   ${events.length === 0 ? 'NONE' : events.join(', ')}  (no close, no error)`);
  log('RESULT', `  ping callback:     ${pingStatus === 'responded!' ? 'responded (connection is alive!)' : 'never fired'}`);
  log('RESULT', `  outboundQueueSize: ${finalState.outboundQueueSize ?? 'N/A'}    (0 is normal — small requests fit in kernel TCP buffer)`);
  log('RESULT', '');
  if (responsesReceived === 0 && events.length === 0) {
    log('RESULT', '  The session is a ZOMBIE: the OS connection is broken,');
    log('RESULT', '  but Node.js has no idea. All APIs report "healthy".');
  } else if (responsesReceived > 0) {
    log('RESULT', '  FIREWALL DID NOT BLOCK TRAFFIC — requests got responses.');
    log('RESULT', '  Check that iptables rules loaded correctly.');
  }

  if (events.length > 0) {
    console.log('');
    log('NOTE', 'Some events DID fire — the zombie state may not have fully');
    log('NOTE', 'formed. This can happen if TCP retransmission timed out.');
    log('NOTE', 'Try increasing MONITOR_SECONDS or disabling TCP keepalive.');
  }

  // -----------------------------------------------------------------------
  // Phase 6 (optional): Trigger the assertion crash
  // -----------------------------------------------------------------------

  if (TRIGGER_CRASH) {
    console.log('');
    log('PHASE 6', '!!! TRIGGERING ASSERTION CRASH !!!');
    log('PHASE 6', 'Writing directly to TLS socket to create concurrent write...');
    log('PHASE 6', 'This will crash with: Assertion failed: !current_write_');
    log('PHASE 6', '  at node::crypto::TLSWrap::DoWrite (src/crypto/crypto_tls.cc)');
    console.log('');

    // Get the real TLS socket (not the HTTP/2 proxy socket).
    // HTTP/2 sessions hide the real socket behind a Symbol.
    const syms = Object.getOwnPropertySymbols(session);
    const socketSym = syms.find((s) => s.toString().includes('socket'));
    const tlsSocket = socketSym ? session[socketSym] : session.socket;

    if (!tlsSocket) {
      log('ERROR', 'Could not find underlying TLS socket');
      cleanup();
      process.exit(1);
    }

    log('PHASE 6', `  TLS socket: destroyed=${tlsSocket.destroyed} writable=${tlsSocket.writable}`);
    log('PHASE 6', '  Writing raw data to TLS socket NOW...');

    // This write bypasses HTTP/2's write queue and goes directly to TLSWrap.
    // If HTTP/2 already has a write in flight (from the queued requests),
    // this creates a CONCURRENT write at the TLS layer, violating the
    // CHECK(!current_write_) assertion.
    tlsSocket.write('this-triggers-the-crash');

    // If we get here, the crash didn't happen (unlikely with the iptables approach)
    await sleep(2000);
    log('PHASE 6', 'No crash occurred. The write may have completed synchronously.');
    log('PHASE 6', 'This can happen if the TCP send buffer had space.');
    log('PHASE 6', 'The zombie state is still demonstrated above.');
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  console.log('');
  log('DONE', 'Reproduction complete. Cleaning up...');
  session.destroy();
  cleanup();
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch((err) => {
  log('FATAL', err.stack || err.message);
  cleanup();
  process.exit(1);
});
