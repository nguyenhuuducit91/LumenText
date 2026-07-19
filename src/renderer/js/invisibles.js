'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// View > Show Symbol — render invisibles the way Notepad++ (Scintilla) does.
//   • Show Space and Tab   -> space '·' (mid-dot) and tab '→' arrow
//   • Show End of Line      -> a coloured "CRLF" / "LF" / "CR" box at each line end
//   • Show All Characters   -> Space/Tab + End of Line + non-printing control chars
//   • Show Indent Guide     -> vertical indent guide lines
//   • Show Wrap Symbol      -> word wrap on + wrap marker on wrapped rows
// State persists across sessions via the main-process store.
// ===========================================================================
LUM.invisibles = (function () {
  const state = {
    whitespace: false,
    eol: false,
    control: false,
    guides: true,   // shown by default, like Notepad++
    wrap: false
  };
  // Per-pane EOL decoration collections + which editors already have scroll/
  // content listeners wired (so panes split AFTER first enable still refresh).
  const eolCollections = new WeakMap();
  const eolWired = new WeakSet();

  function baseWhitespace() {
    return (LUM.settings && LUM.settings.get) ? LUM.settings.get('render_whitespace', 'selection') : 'selection';
  }
  function baseWrap() {
    return (LUM.settings && LUM.settings.get && LUM.settings.get('word_wrap', false)) ? 'on' : 'off';
  }

  function optionPatch() {
    return {
      // Space -> '·', Tab -> '→' (Monaco's 'all' renders both, matching N++).
      renderWhitespace: state.whitespace ? 'all' : baseWhitespace(),
      // Non-printing control characters shown as their Unicode picture glyphs.
      renderControlCharacters: state.control,
      guides: { indentation: state.guides, highlightActiveIndentation: state.guides, bracketPairs: false },
      wordWrap: state.wrap ? 'on' : baseWrap()
    };
  }

  function applyOptions() {
    if (!LUM.editor || !LUM.editor.panes) return;
    const patch = optionPatch();
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions(patch));
    document.body.classList.toggle('show-wrap-symbol', state.wrap);
    refreshEol();
  }

  // ---- End-of-line markers (viewport-aware, Notepad++ CRLF/LF/CR boxes) -----
  // Monaco normalises a model to a single EOL sequence, so every terminator in
  // the buffer is the same kind; we label each line break with that kind.
  function eolLabel(model) {
    return model.getEOL() === '\r\n' ? 'CRLF' : 'LF';
  }

  function eolDecosFor(editor) {
    const model = editor.getModel();
    if (!model) return [];
    const lineCount = model.getLineCount();
    const label = eolLabel(model);
    const cls = 'lum-eol-mark lum-eol-' + label.toLowerCase();
    const ranges = editor.getVisibleRanges ? editor.getVisibleRanges() : [];
    const decos = [];
    for (const r of ranges) {
      const from = Math.max(1, r.startLineNumber - 2);
      // A line has a terminator only if another line follows it; the final line
      // (or the trailing empty line after a newline) gets no marker — like N++.
      const to = Math.min(lineCount - 1, r.endLineNumber + 2);
      for (let ln = from; ln <= to; ln++) {
        const col = model.getLineMaxColumn(ln);
        decos.push({
          range: new monaco.Range(ln, col, ln, col),
          options: { after: { content: label, inlineClassName: cls }, showIfCollapsed: true }
        });
      }
    }
    return decos;
  }

  function refreshEol() {
    if (!LUM.editor || !LUM.editor.panes) return;
    LUM.editor.panes.forEach((p) => {
      const ed = p.editor;
      if (!ed) return;
      let col = eolCollections.get(ed);
      if (!col) { col = ed.createDecorationsCollection(); eolCollections.set(ed, col); }
      col.set(state.eol ? eolDecosFor(ed) : []);
      // Wire per-editor listeners exactly once — so a pane created after the
      // first enable still re-renders its markers on scroll/edit.
      if (!eolWired.has(ed)) {
        eolWired.add(ed);
        ed.onDidScrollChange(() => { if (state.eol) refreshEol(); });
        ed.onDidChangeModelContent(() => { if (state.eol) refreshEol(); });
      }
    });
  }

  function persist() {
    try { window.lumen.stateSet('invisibles', { ...state }); } catch { /* ignore */ }
  }

  const LABELS = {
    whitespace: 'Show Space and Tab',
    eol: 'Show End of Line',
    control: 'Show All Characters',
    guides: 'Show Indent Guide',
    wrap: 'Show Wrap Symbol'
  };

  // "Show All Characters" is the union of Space/Tab + End of Line + control chars.
  const ALL_KEYS = ['whitespace', 'eol', 'control'];
  function allOn() { return ALL_KEYS.every((k) => state[k]); }

  function toggle(key) {
    if (key === 'all') return toggleAll();
    if (!(key in state)) return;
    state[key] = !state[key];
    applyOptions();
    persist();
    LUM.app && LUM.app.toast((state[key] ? '✓ ' : '') + (LABELS[key] || key) + (state[key] ? '' : ' — off'));
  }

  function toggleAll() {
    const next = !allOn();
    ALL_KEYS.forEach((k) => { state[k] = next; });
    applyOptions();
    persist();
    LUM.app && LUM.app.toast((next ? '✓ ' : '') + 'Show All Characters' + (next ? '' : ' — off'));
  }

  function get(key) {
    if (key === 'all') return allOn();
    return !!state[key];
  }

  // Restore persisted state on boot and apply to the editors.
  async function init() {
    try {
      const saved = await window.lumen.stateGet('invisibles', null);
      if (saved && typeof saved === 'object') {
        // Only pull keys we still recognise (drops obsolete flags cleanly).
        for (const k of Object.keys(state)) if (k in saved) state[k] = !!saved[k];
      }
    } catch { /* keep defaults */ }
    applyOptions();
  }

  // Re-apply to a newly created pane (splits) so toggles stay consistent.
  function reapply() { applyOptions(); }

  return { toggle, toggleAll, get, init, reapply, state };
})();
