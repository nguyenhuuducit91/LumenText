'use strict';

const { spawn } = require('child_process');
const path = require('path');

// ===========================================================================
// Minimal LSP client over stdio. Spawns typescript-language-server (pure JS)
// via Electron-as-Node and speaks JSON-RPC with Content-Length framing.
// One server per workspace root. Diagnostics are pushed to the renderer;
// completion/hover are request/response.
// ===========================================================================
const APP_DIR = path.join(__dirname, '..', '..');
const LS_ENTRY = path.join(APP_DIR, 'node_modules', 'typescript-language-server', 'lib', 'cli.mjs');
const TSSERVER = path.join(APP_DIR, 'node_modules', 'typescript', 'lib', 'tsserver.js');

class Server {
  constructor(root, onNotify) {
    this.root = root;
    this.onNotify = onNotify;
    this.seq = 1;
    this.pending = new Map();
    this.buf = Buffer.alloc(0);
    this.initialized = false;
    this.queue = [];
    const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
    this.child = spawn(process.execPath, [LS_ENTRY, '--stdio'], { cwd: root, env });
    this.child.stdout.on('data', (d) => this._onData(d));
    this.child.stderr.on('data', () => {});
    this.child.on('exit', () => { this.pending.clear(); this.initialized = false; });
    this.child.on('error', () => {});
    this._initialize();
  }

  _write(msg) {
    if (!this.child || this.child.killed) return;
    const body = Buffer.from(JSON.stringify(msg), 'utf8');
    try {
      this.child.stdin.write('Content-Length: ' + body.length + '\r\n\r\n');
      this.child.stdin.write(body);
    } catch {}
  }
  notify(method, params) { this._write({ jsonrpc: '2.0', method, params }); }
  request(method, params) {
    const id = this.seq++;
    this._write({ jsonrpc: '2.0', id, method, params });
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      setTimeout(() => { if (this.pending.delete(id)) resolve(null); }, 6000);
    });
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const headerEnd = this.buf.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = this.buf.slice(0, headerEnd).toString('utf8');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) { this.buf = this.buf.slice(headerEnd + 4); continue; }
      const len = parseInt(m[1], 10);
      const start = headerEnd + 4;
      if (this.buf.length < start + len) break;
      const body = this.buf.slice(start, start + len).toString('utf8');
      this.buf = this.buf.slice(start + len);
      let msg;
      try { msg = JSON.parse(body); } catch { continue; }
      this._dispatch(msg);
    }
  }
  _dispatch(msg) {
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const r = this.pending.get(msg.id);
      if (r) { this.pending.delete(msg.id); r(msg.error ? null : msg.result); }
    } else if (msg.method) {
      if (msg.id !== undefined) {
        // server->client request (configuration, registerCapability…): reply minimally
        this._write({ jsonrpc: '2.0', id: msg.id, result: msg.method === 'workspace/configuration' ? [{}] : null });
      } else {
        try { this.onNotify(msg.method, msg.params); } catch {}
      }
    }
  }

  async _initialize() {
    const rootUri = 'file://' + this.root;
    await this.request('initialize', {
      processId: process.pid,
      rootUri,
      workspaceFolders: [{ uri: rootUri, name: 'workspace' }],
      initializationOptions: { tsserver: { path: TSSERVER }, preferences: {} },
      capabilities: {
        workspace: { configuration: true, workspaceFolders: true },
        textDocument: {
          synchronization: { didSave: true, dynamicRegistration: false },
          completion: { completionItem: { snippetSupport: true, documentationFormat: ['markdown', 'plaintext'] } },
          hover: { contentFormat: ['markdown', 'plaintext'] },
          publishDiagnostics: { relatedInformation: false }
        }
      }
    });
    this.notify('initialized', {});
    this.initialized = true;
    this.queue.forEach((f) => { try { f(); } catch {} });
    this.queue = [];
  }
  whenReady(fn) { if (this.initialized) fn(); else this.queue.push(fn); }
  dispose() { try { this.notify('shutdown'); this.child.kill('SIGTERM'); } catch {} }
}

const servers = new Map();
function get(root, onNotify) {
  let s = servers.get(root);
  if (!s) { s = new Server(root, onNotify); servers.set(root, s); }
  else if (onNotify) s.onNotify = onNotify; // keep the latest window sender
  return s;
}
function existing(root) { return servers.get(root); }
function disposeAll() { for (const s of servers.values()) s.dispose(); servers.clear(); }

module.exports = { get, existing, disposeAll, available: () => require('fs').existsSync(LS_ENTRY) && require('fs').existsSync(TSSERVER) };
