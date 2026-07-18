'use strict';

const fs = require('fs');

// ===========================================================================
// Large-file engine.
//
// Opens files far bigger than RAM (GB..100GB) without loading them into memory.
// Strategy:
//   * Keep the file open (fd) and read only the byte ranges we need.
//   * Build a SPARSE line index in a background streaming scan: record the byte
//     offset of every Nth line (a "checkpoint"). Memory stays tiny — a 100GB
//     file with ~100-byte lines yields ~1e9 lines but only ~1e9/N checkpoints
//     (N=4096 -> ~240k checkpoints -> ~2MB), plus the total line count.
//   * To fetch lines [start, start+count): seek to the nearest checkpoint at or
//     before `start`, then scan forward splitting on '\n'. '\n' (0x0A) never
//     occurs inside a UTF-8 multi-byte sequence, so byte-splitting is UTF-8 safe.
//   * Over-long lines (minified blobs) are truncated to MAX_LINE_BYTES so a
//     single pathological line can never exhaust memory.
// ===========================================================================

const CHECKPOINT_EVERY = 4096;       // record 1 offset per this many lines
const SCAN_CHUNK = 4 * 1024 * 1024;  // 4 MB streaming read window
const MAX_LINE_BYTES = 64 * 1024;    // truncate lines longer than this (display)
const NL = 0x0a;

let seq = 1;
/** @type {Map<number, Session>} */
const sessions = new Map();

class Session {
  constructor(filePath) {
    this.id = seq++;
    this.path = filePath;
    this.fd = fs.openSync(filePath, 'r');
    const st = fs.fstatSync(this.fd);
    this.size = st.size;
    this.mtimeMs = st.mtimeMs;
    this.checkpoints = [0];   // checkpoints[k] = byte offset where line (k*CHECKPOINT_EVERY) starts
    this.lineCount = 0;       // grows during indexing; final when `indexed` is true
    this.indexed = false;
    this.endsWithNewline = true;
    this.aborted = false;
  }

  // Streaming background scan that fills `checkpoints` and `lineCount`.
  // Calls onProgress({ lineCount, bytes, size, done }) periodically.
  async buildIndex(onProgress) {
    const buf = Buffer.allocUnsafe(SCAN_CHUNK);
    let pos = 0;
    let lines = 0;
    let lastByte = NL;
    let lastReport = 0;

    while (pos < this.size && !this.aborted) {
      const bytes = fs.readSync(this.fd, buf, 0, SCAN_CHUNK, pos);
      if (bytes <= 0) break;
      for (let i = 0; i < bytes; i++) {
        if (buf[i] === NL) {
          lines++;
          if (lines % CHECKPOINT_EVERY === 0) {
            this.checkpoints.push(pos + i + 1); // offset where the next line begins
          }
        }
      }
      lastByte = buf[bytes - 1];
      pos += bytes;
      this.lineCount = lines + 1; // +1 for the trailing partial line
      if (pos - lastReport >= SCAN_CHUNK * 8) {
        lastReport = pos;
        onProgress && onProgress({ lineCount: this.lineCount, bytes: pos, size: this.size, done: false });
        await new Promise((r) => setImmediate(r)); // yield to keep UI responsive
      }
    }
    this.endsWithNewline = lastByte === NL;
    // If the file ends with a newline, the final "line" is empty; keep count consistent.
    this.lineCount = this.endsWithNewline ? lines : lines + 1;
    if (this.size === 0) this.lineCount = 0;
    this.indexed = true;
    onProgress && onProgress({ lineCount: this.lineCount, bytes: this.size, size: this.size, done: true });
  }

  // Byte offset where `line` (0-based) starts, using the nearest checkpoint then
  // scanning forward. Returns { offset, atLine } — atLine <= line.
  _nearestCheckpoint(line) {
    const k = Math.min(Math.floor(line / CHECKPOINT_EVERY), this.checkpoints.length - 1);
    return { offset: this.checkpoints[k], atLine: k * CHECKPOINT_EVERY };
  }

  // Read `count` lines starting at 0-based `start`. Returns array of strings.
  readLines(start, count) {
    const out = [];
    if (start < 0) start = 0;
    if (count <= 0 || this.size === 0) return out;

    let { offset, atLine } = this._nearestCheckpoint(start);
    let cur = atLine;                 // line number at `offset`
    const buf = Buffer.allocUnsafe(SCAN_CHUNK);
    let lineBytes = [];               // Buffers composing the current line
    let lineLen = 0;
    let truncated = false;

    // Append bytes to the current line, capping total at MAX_LINE_BYTES so a
    // pathological multi-GB single line cannot exhaust memory.
    const appendSeg = (seg) => {
      if (seg.length === 0) return;
      if (lineLen >= MAX_LINE_BYTES) {
        truncated = true;
        return;
      }
      const take = Math.min(seg.length, MAX_LINE_BYTES - lineLen);
      lineBytes.push(Buffer.from(seg.subarray(0, take)));
      lineLen += take;
      if (take < seg.length) truncated = true;
    };

    const pushLine = () => {
      const s = Buffer.concat(lineBytes, lineLen).toString('utf8');
      if (cur >= start && out.length < count) out.push(truncated ? s + ' …[truncated]' : s);
      lineBytes = [];
      lineLen = 0;
      truncated = false;
      cur++;
    };

    let pos = offset;
    while (pos < this.size && out.length < count) {
      const n = fs.readSync(this.fd, buf, 0, SCAN_CHUNK, pos);
      if (n <= 0) break;
      let lineStart = 0;
      for (let i = 0; i < n; i++) {
        if (buf[i] === NL) {
          appendSeg(buf.subarray(lineStart, i));
          pushLine();
          lineStart = i + 1;
          if (out.length >= count) break;
        }
      }
      if (out.length < count && lineStart < n) {
        // carry the tail (partial line, no newline yet) into the next read
        appendSeg(buf.subarray(lineStart, n));
      }
      pos += n;
    }
    // flush a final line with no trailing newline
    if (out.length < count && (lineLen > 0 || (!this.endsWithNewline && cur >= start && pos >= this.size))) {
      pushLine();
    }
    return out;
  }

  close() {
    this.aborted = true;
    try {
      fs.closeSync(this.fd);
    } catch {
      /* already closed */
    }
  }
}

function open(filePath) {
  const s = new Session(filePath);
  sessions.set(s.id, s);
  return s;
}
function get(id) {
  return sessions.get(id);
}
function close(id) {
  const s = sessions.get(id);
  if (s) {
    s.close();
    sessions.delete(id);
  }
}
function closeAll() {
  for (const s of sessions.values()) s.close();
  sessions.clear();
}

module.exports = { open, get, close, closeAll, CHECKPOINT_EVERY, MAX_LINE_BYTES };
