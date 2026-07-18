'use strict';
window.LUM = window.LUM || {};

// Central command registry. Each command: { id, title, category, keybind?, run() }
LUM.commands = (function () {
  const list = [];
  const byId = new Map();
  const runListeners = [];

  function register(cmd) {
    if (byId.has(cmd.id)) return;
    byId.set(cmd.id, cmd);
    list.push(cmd);
  }

  // Notified with each command id as it runs (used by the macro recorder).
  function onRun(cb) {
    runListeners.push(cb);
  }

  function run(id, ...args) {
    const c = byId.get(id);
    if (!c) return console.warn('Unknown command', id);
    for (const cb of runListeners) {
      try { cb(id); } catch (e) { /* ignore listener errors */ }
    }
    try {
      return c.run(...args);
    } catch (e) {
      console.error('Command failed:', id, e);
    }
  }

  function all() {
    return list.slice();
  }

  return { register, run, all, byId, onRun };
})();
