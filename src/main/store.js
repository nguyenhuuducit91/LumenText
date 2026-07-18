'use strict';

const fs = require('fs');
const path = require('path');

// ===========================================================================
// Persistent JSON state store (settings, session, recent list).
// Synchronous load at startup; debounced atomic async writes afterwards.
// ===========================================================================
class Store {
  constructor(filePath, defaults = {}) {
    this.file = filePath;
    this.data = { ...defaults };
    this._timer = null;
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      this.data = { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* first run or corrupt -> defaults */
    }
  }

  get(key, fallback) {
    return key in this.data ? this.data[key] : fallback;
  }

  set(key, value) {
    this.data[key] = value;
    this._scheduleWrite();
  }

  merge(obj) {
    Object.assign(this.data, obj);
    this._scheduleWrite();
  }

  _scheduleWrite() {
    if (this._timer) return;
    this._timer = setTimeout(() => this.flush(), 250);
  }

  // Atomic write: temp file + rename, so a crash never truncates state.json.
  flush() {
    clearTimeout(this._timer);
    this._timer = null;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error('Store flush failed:', e);
    }
  }
}

module.exports = { Store };
