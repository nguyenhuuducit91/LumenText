'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Sublime-style single-file Find / Replace bar.
//   • Bottom-of-editor panel (pushes the editor up), not Monaco's corner popup.
//   • Toggles: regex, case, whole word, wrap, in-selection, highlight (+ preserve
//     case in replace mode).
//   • Buttons: Find (next), Find Prev, Find All (multi-cursor), Replace, Replace All.
//   • "x of N matches" counter; incremental highlight while typing.
// Drives Monaco's own search engine via model.findMatches — no popup widget.
// ===========================================================================
LUM.find = (function () {
  const WORD_SEP = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

  const state = {
    query: '', replaceValue: '',
    regex: false, caseSensitive: false, wholeWord: false,
    wrap: true, inSelection: false, highlight: true, preserveCase: false
  };

  let visible = false;
  let replaceMode = false;
  let matches = [];          // Range[]
  let current = -1;          // index into matches
  let invalidRegex = false;
  let scopeRanges = null;    // Range[] limiting the search (in-selection)
  let anchorPos = null;      // where the search started (keeps incremental find stable)
  let decos = null;          // decorations collection on the active editor
  let decoEditor = null;     // the editor `decos` belongs to
  const history = [];
  let histIdx = -1;

  // ---- DOM ----------------------------------------------------------------
  let el, input, replaceInput, countEl;
  function $(id) { return document.getElementById(id); }

  function editor() { return LUM.editor.activeEditor(); }
  function model() { const b = LUM.editor.activeBuffer(); return (b && b.model) ? b.model : null; }

  function init() {
    el = $('sfind');
    input = $('sfind-input');
    replaceInput = $('sfind-replace');
    countEl = $('sfind-count');
    if (!el) return;

    // Toggle buttons (data-flag).
    el.querySelectorAll('.sfind-tg').forEach((btn) => {
      btn.addEventListener('click', () => toggleFlag(btn.dataset.flag));
    });
    $('sfind-next').addEventListener('click', () => move(1));
    $('sfind-prev').addEventListener('click', () => move(-1));
    $('sfind-all').addEventListener('click', findAll);
    $('sfind-close').addEventListener('click', close);
    $('sfind-rep').addEventListener('click', replaceOne);
    $('sfind-repall').addEventListener('click', replaceAll);

    input.addEventListener('input', () => { state.query = input.value; recompute(false); });
    input.addEventListener('keydown', onInputKey);
    replaceInput.addEventListener('input', () => { state.replaceValue = replaceInput.value; });
    replaceInput.addEventListener('keydown', onReplaceKey);
    syncToggleButtons();
  }

  function onInputKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.altKey ? findAll() : move(e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); histNav(-1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); histNav(1); }
    else if (e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); toggleFlag('regex'); }
    else if (e.altKey && e.key.toLowerCase() === 'c') { e.preventDefault(); toggleFlag('caseSensitive'); }
    else if (e.altKey && e.key.toLowerCase() === 'w') { e.preventDefault(); toggleFlag('wholeWord'); }
  }
  function onReplaceKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); replaceOne(); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  // ---- toggles ------------------------------------------------------------
  function toggleFlag(flag) {
    if (!(flag in state)) return;
    state[flag] = !state[flag];
    if (flag === 'inSelection') captureScope();
    syncToggleButtons();
    if (flag === 'highlight') paint();
    else recompute(false);
    input && input.focus();
  }
  function syncToggleButtons() {
    if (!el) return;
    el.querySelectorAll('.sfind-tg').forEach((btn) => {
      btn.classList.toggle('on', !!state[btn.dataset.flag]);
    });
  }

  // Capture the scope for "in selection" from the current non-empty selections.
  function captureScope() {
    const ed = editor();
    if (!state.inSelection || !ed) { scopeRanges = null; return; }
    const sels = ed.getSelections() || [];
    const nonEmpty = sels.filter((s) => !s.isEmpty());
    scopeRanges = nonEmpty.length ? nonEmpty.map((s) => toRange(s)) : null;
    if (!scopeRanges) state.inSelection = false;
  }
  function toRange(sel) {
    return new monaco.Range(sel.startLineNumber, sel.startColumn, sel.endLineNumber, sel.endColumn);
  }

  // ---- search -------------------------------------------------------------
  function recompute(keepIndex) {
    const m = model();
    matches = [];
    invalidRegex = false;
    if (!m || !state.query) { current = -1; render(); paint(); return; }
    const scope = (state.inSelection && scopeRanges) ? scopeRanges : null;
    const wordSep = state.wholeWord ? WORD_SEP : null;
    try {
      const found = m.findMatches(state.query, scope, state.regex, state.caseSensitive, wordSep, false, 100000);
      matches = found.map((f) => f.range);
    } catch (e) {
      invalidRegex = true; current = -1; render(); paint(); return;
    }
    if (!matches.length) { current = -1; render(); paint(); return; }
    if (keepIndex && current >= 0) {
      current = Math.min(current, matches.length - 1);
    } else {
      const from = anchorPos || (editor() && editor().getPosition());
      current = from ? firstAtOrAfter(from) : 0;
    }
    revealCurrent(false);
    render(); paint();
  }

  function firstAtOrAfter(pos) {
    for (let i = 0; i < matches.length; i++) {
      const r = matches[i];
      if (r.startLineNumber > pos.lineNumber ||
        (r.startLineNumber === pos.lineNumber && r.startColumn >= pos.column)) return i;
    }
    return 0; // wrap to first
  }

  function posCmp(a, b) { return a.lineNumber - b.lineNumber || a.column - b.column; }

  // Navigate to the nearest match in `dir` relative to the editor selection, so
  // Find Next lands ON the next match (never skipping one), like Sublime.
  function move(dir) {
    if (!state.query) return;
    if (!matches.length) { recompute(false); if (!matches.length) return; }
    const ed = editor();
    const sel = ed && ed.getSelection();
    let idx = -1;
    if (!sel) { idx = 0; }
    else if (dir > 0) {
      const end = { lineNumber: sel.endLineNumber, column: sel.endColumn };
      for (let i = 0; i < matches.length; i++) {
        if (posCmp(matches[i].getStartPosition(), end) >= 0) { idx = i; break; }
      }
      if (idx === -1) idx = state.wrap ? 0 : -1;
    } else {
      const start = { lineNumber: sel.startLineNumber, column: sel.startColumn };
      for (let i = matches.length - 1; i >= 0; i--) {
        if (posCmp(matches[i].getEndPosition(), start) <= 0) { idx = i; break; }
      }
      if (idx === -1) idx = state.wrap ? matches.length - 1 : -1;
    }
    if (idx === -1) return;
    current = idx;
    revealCurrent(true);
    render(); paint();
  }

  function findAll() {
    if (!matches.length) return;
    const ed = editor();
    if (!ed) return;
    ed.setSelections(matches.map((r) => new monaco.Selection(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)));
    ed.revealRangeInCenterIfOutsideViewport(matches[matches.length - 1]);
    ed.focus();
  }

  function revealCurrent(center) {
    const ed = editor();
    if (!ed || current < 0 || !matches[current]) return;
    const r = matches[current];
    ed.setSelection(r);
    if (center) ed.revealRangeInCenterIfOutsideViewport(r);
    else ed.revealRange(r);
  }

  // ---- replace ------------------------------------------------------------
  function replacementFor(range) {
    const m = model();
    const matched = m.getValueInRange(range);
    let out;
    if (state.regex) {
      const flags = 'u' + (state.caseSensitive ? '' : 'i');
      try { out = matched.replace(new RegExp(state.query, flags), state.replaceValue); }
      catch { out = state.replaceValue; }
    } else {
      out = state.replaceValue;
    }
    if (state.preserveCase && !state.regex) out = matchCase(matched, out);
    return out;
  }
  // Mirror the casing pattern of `sample` onto `repl` (ALL CAPS / lower / Title).
  function matchCase(sample, repl) {
    if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return repl.toUpperCase();
    if (sample === sample.toLowerCase()) return repl.toLowerCase();
    if (sample[0] === sample[0].toUpperCase()) return repl.charAt(0).toUpperCase() + repl.slice(1);
    return repl;
  }

  function replaceOne() {
    const ed = editor();
    if (!ed || current < 0 || !matches[current]) { move(1); return; }
    const r = matches[current];
    ed.executeEdits('sfind', [{ range: r, text: replacementFor(r), forceMoveMarkers: true }]);
    // Re-search and select the next match at/after where we just replaced.
    anchorPos = ed.getPosition();
    recompute(false);
  }

  function replaceAll() {
    const ed = editor();
    if (!ed || !matches.length) return;
    const edits = matches.map((r) => ({ range: r, text: replacementFor(r), forceMoveMarkers: true }));
    ed.executeEdits('sfind', edits);
    const n = edits.length;
    recompute(false);
    LUM.app && LUM.app.toast('Replaced ' + n + ' occurrence' + (n === 1 ? '' : 's'));
  }

  // ---- decorations + counter ----------------------------------------------
  function ensureDecos() {
    const ed = editor();
    if (!ed) return null;
    if (decoEditor !== ed) {
      if (decos) decos.clear();
      decos = ed.createDecorationsCollection();
      decoEditor = ed;
    }
    return decos;
  }
  function paint() {
    const col = ensureDecos();
    if (!col) return;
    if (!visible || !matches.length) { col.set([]); return; }
    const out = [];
    if (state.highlight) {
      matches.forEach((r, i) => {
        if (i === current) return;
        out.push({ range: r, options: { className: 'sfind-hl', stickiness: 1 } });
      });
    }
    if (current >= 0 && matches[current]) {
      out.push({ range: matches[current], options: { className: 'sfind-hl-current', stickiness: 1 } });
    }
    col.set(out);
  }
  function render() {
    if (!countEl) return;
    if (invalidRegex) { countEl.textContent = 'Invalid regex'; countEl.classList.add('err'); return; }
    countEl.classList.remove('err');
    if (!state.query) { countEl.textContent = ''; return; }
    if (!matches.length) { countEl.textContent = 'No results'; return; }
    countEl.textContent = (current + 1) + ' of ' + matches.length + ' match' + (matches.length === 1 ? '' : 'es');
  }

  // ---- history ------------------------------------------------------------
  function pushHistory(q) {
    if (!q) return;
    const i = history.indexOf(q);
    if (i !== -1) history.splice(i, 1);
    history.unshift(q);
    if (history.length > 50) history.pop();
    histIdx = -1;
  }
  function histNav(dir) {
    if (!history.length) return;
    histIdx = Math.max(-1, Math.min(history.length - 1, histIdx + dir));
    input.value = histIdx === -1 ? '' : history[histIdx];
    state.query = input.value;
    recompute(false);
  }

  // ---- open / close -------------------------------------------------------
  function open(withReplace) {
    if (!el) init();
    replaceMode = !!withReplace;
    el.classList.toggle('with-replace', replaceMode);
    el.classList.remove('hidden');
    visible = true;

    const ed = editor();
    anchorPos = ed ? ed.getPosition() : null;

    // Seed from the current selection (single line = query, multiline = scope).
    if (ed) {
      const sel = ed.getSelection();
      if (sel && !sel.isEmpty()) {
        if (sel.startLineNumber === sel.endLineNumber) {
          state.query = ed.getModel().getValueInRange(sel);
        } else {
          state.inSelection = true;
        }
      }
    }
    captureScope();
    syncToggleButtons();
    input.value = state.query;
    replaceInput.value = state.replaceValue;
    setTimeout(() => LUM.editor.layout(), 0); // editor shrinks to fit the bar
    input.focus();
    input.select();
    recompute(false);
  }

  function close() {
    if (!el) return;
    if (state.query) pushHistory(state.query);
    el.classList.add('hidden');
    visible = false;
    anchorPos = null; // so a later F3 searches from the live cursor
    if (decos) decos.set([]);
    setTimeout(() => LUM.editor.layout(), 0);
    const ed = editor();
    if (ed) ed.focus();
  }

  function isOpen() { return visible; }

  // F3 / Shift+F3 — find next/prev even when the bar is closed, using last query.
  function next() { if (!visible && state.query) { recompute(false); } move(1); if (!visible) revealCurrent(true); }
  function prev() { if (!visible && state.query) { recompute(false); } move(-1); if (!visible) revealCurrent(true); }

  // Use the editor's selection as the search term and jump to the next match.
  function useSelection() {
    const ed = editor();
    if (!ed) return;
    const sel = ed.getSelection();
    if (sel && !sel.isEmpty()) state.query = ed.getModel().getValueInRange(sel);
    if (!visible) open(false); else { input.value = state.query; recompute(false); }
  }

  return { init, open, close, isOpen, next, prev, useSelection, toggleReplace: () => open(true) };
})();
