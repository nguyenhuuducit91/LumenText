'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Keybinding profiles. A user-editable JSON keymap adds/overrides bindings for
// LUM commands, with chord support ("ctrl+k, ctrl+u"). The Default keymap pane
// is generated read-only from the command registry for reference.
//
// User bindings are ADDITIVE — they layer on top of the built-in menu/app keys,
// so remapping never breaks the defaults it doesn't touch.
// ===========================================================================
LUM.keymap = (function () {
  let userFile = null;
  let defaultFile = null;
  let seqs = [];           // { seq: ['ctrl+k','ctrl+u'], command: 'edit.upperCase' }
  let pending = [];
  let timer = null;

  const KEYALIAS = {
    ' ': 'space', arrowup: 'up', arrowdown: 'down', arrowleft: 'left',
    arrowright: 'right', escape: 'esc', delete: 'del'
  };

  function comboOf(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    let k = (e.key || '').toLowerCase();
    if (['control', 'shift', 'alt', 'meta'].includes(k)) return null;
    k = KEYALIAS[k] || k;
    parts.push(k);
    return parts.join('+');
  }
  // Canonical modifier order so "shift+alt+right" === "alt+shift+right".
  function canon(combo) {
    const parts = combo.split('+').filter(Boolean);
    const key = parts.pop();
    const order = { ctrl: 0, cmd: 0, alt: 1, shift: 2 };
    const mods = [...new Set(parts.map((m) => (m === 'cmd' || m === 'meta' ? 'ctrl' : m)))]
      .sort((a, b) => (order[a] ?? 9) - (order[b] ?? 9));
    return [...mods, key].join('+');
  }
  function normSeq(keys) {
    // keys may be array (["ctrl+k","ctrl+u"]) or string ("ctrl+k, ctrl+u")
    const arr = Array.isArray(keys) ? keys : String(keys).split(',');
    return arr.map((s) => canon(s.trim().toLowerCase().replace(/\s+/g, '')));
  }
  const eqArr = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const isPrefix = (p, full) => p.length < full.length && p.every((x, i) => x === full[i]);

  function reset() {
    pending = [];
    clearTimeout(timer);
  }

  function onKeydown(e) {
    if (!seqs.length) return;
    if (LUM.palette && LUM.palette.isOpen()) return;
    // Don't let a user keybinding swallow characters typed into a chrome input
    // (Find bar, tree rename, dialogs). The Monaco editor's own textarea lives
    // inside .monaco-editor and is intentionally NOT excluded.
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && !ae.closest('.monaco-editor')) return;
    const combo = comboOf(e);
    if (!combo) return;

    const trial = pending.concat(combo);
    const exact = seqs.find((s) => eqArr(s.seq, trial));
    if (exact) {
      e.preventDefault(); e.stopPropagation();
      reset();
      LUM.commands.run(exact.command);
      return;
    }
    // A user-defined chord prefix: stop propagation so Monaco's own Ctrl+K action
    // doesn't fire before the chord completes (only fires when the user actually
    // defined a chord starting with this combo).
    if (seqs.some((s) => isPrefix(trial, s.seq))) {
      e.preventDefault(); e.stopPropagation();
      pending = trial;
      clearTimeout(timer);
      timer = setTimeout(reset, 1300);
      return;
    }
    // no continuation — start fresh from this combo
    reset();
    const one = seqs.find((s) => s.seq.length === 1 && s.seq[0] === combo);
    if (one) {
      e.preventDefault(); e.stopPropagation();
      LUM.commands.run(one.command);
    } else if (seqs.some((s) => s.seq.length > 1 && s.seq[0] === combo)) {
      e.preventDefault(); e.stopPropagation();
      pending = [combo];
      timer = setTimeout(reset, 1300);
    }
  }

  function parseJsonc(text) {
    const s = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    return s ? JSON.parse(s) : [];
  }

  // "Ctrl+K Ctrl+U" -> ["ctrl+k","ctrl+u"]; "Ctrl+Shift+D" -> ["ctrl+shift+d"]
  function mergeChord(kb) {
    return kb.trim().toLowerCase().split(/\s+/);
  }
  function defaultKeymapText() {
    const rows = LUM.commands.all()
      .filter((c) => c.keybind)
      .map((c) => '  { "keys": ' + JSON.stringify(mergeChord(c.keybind)) + ', "command": "' + c.id + '" }');
    return (
      '// Default key bindings (read-only reference). Copy lines into the User\n' +
      '// pane on the right to override. Chords use two entries: ["ctrl+k","ctrl+u"].\n[\n' +
      rows.join(',\n') + '\n]\n'
    );
  }

  async function ensurePaths() {
    if (userFile) return;
    const tmpl =
      '// User key bindings (JSON array). Example:\n' +
      '// [ { "keys": ["ctrl+alt+u"], "command": "edit.upperCase" },\n' +
      '//   { "keys": ["ctrl+k", "ctrl+d"], "command": "edit.duplicateLine" } ]\n[\n]\n';
    userFile = await window.lumen.configEnsure('Preferences.sublime-keymap', tmpl);
    defaultFile = await window.lumen.configWriteDefault('Default.sublime-keymap', defaultKeymapText());
  }

  async function load() {
    await ensurePaths();
    let arr = [];
    try {
      const { content } = await window.lumen.readFile(userFile);
      arr = parseJsonc(content) || [];
    } catch (e) {
      console.warn('keymap parse failed', e);
      arr = [];
    }
    seqs = arr
      .filter((r) => r && r.keys && r.command)
      .map((r) => ({ seq: normSeq(r.keys), command: r.command }));
  }

  async function reloadIfKeymapFile(filePath) {
    if (filePath && filePath === userFile) {
      await load();
      LUM.app.toast(`Key bindings reloaded (${seqs.length} user binding${seqs.length === 1 ? '' : 's'})`);
    }
  }

  async function openUI() {
    await ensurePaths();
    LUM.editor.setLayout(2);
    LUM.editor.setActivePane(0);
    await LUM.editor.openPath(defaultFile);
    LUM.editor.setActivePane(1);
    await LUM.editor.openPath(userFile);
    const ed = LUM.editor.activeEditor();
    if (ed) ed.focus();
  }

  function init() {
    document.addEventListener('keydown', onKeydown, true);
    load();
  }

  return { init, load, openUI, reloadIfKeymapFile, userFilePath: () => userFile,
    _dispatch: onKeydown };
})();
