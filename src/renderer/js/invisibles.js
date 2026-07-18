'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// View > Show Symbol — render invisibles (Sublime's draw_white_space family).
//   • Space and Tab            -> renderWhitespace: 'all'
//   • Non Printing Character   -> renderControlCharacters
//   • Control Char + unicode   -> unicodeHighlight (invisible + ambiguous)
//   • Indent Guide             -> guides.indentation
//   • End of Line              -> injected '¬' glyph at each visible line end
//   • Wrap Symbol              -> word wrap on + '↪' marker style on wrapped rows
// State persists across sessions via the main-process store.
// ===========================================================================
LUM.invisibles = (function () {
  const state = {
    whitespace: false,
    control: false,
    unicode: false,
    guides: true,   // Sublime shows indent guides by default
    eol: false,
    wrap: false
  };
  // Per-pane EOL decoration collections.
  const eolCollections = new WeakMap();
  let eolListeners = false;

  function baseWhitespace() {
    return (LUM.settings && LUM.settings.get) ? LUM.settings.get('render_whitespace', 'selection') : 'selection';
  }
  function baseWrap() {
    return (LUM.settings && LUM.settings.get && LUM.settings.get('word_wrap', false)) ? 'on' : 'off';
  }

  function optionPatch() {
    return {
      renderWhitespace: state.whitespace ? 'all' : baseWhitespace(),
      renderControlCharacters: state.control,
      guides: { indentation: state.guides, highlightActiveIndentation: state.guides, bracketPairs: false },
      unicodeHighlight: {
        invisibleCharacters: state.unicode,
        ambiguousCharacters: state.unicode,
        nonBasicASCII: false
      },
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

  // ---- End-of-line markers (viewport-aware injected text) ------------------
  function eolDecosFor(editor) {
    const model = editor.getModel();
    if (!model) return [];
    const ranges = editor.getVisibleRanges ? editor.getVisibleRanges() : [];
    const decos = [];
    for (const r of ranges) {
      const from = Math.max(1, r.startLineNumber - 2);
      const to = Math.min(model.getLineCount(), r.endLineNumber + 2);
      for (let ln = from; ln <= to; ln++) {
        const col = model.getLineMaxColumn(ln);
        decos.push({
          range: new monaco.Range(ln, col, ln, col),
          options: { after: { content: '¬', inlineClassName: 'lum-eol-mark' }, showIfCollapsed: true }
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
    });
    // Re-render EOL markers as the viewport changes (attach once).
    if (state.eol && !eolListeners) {
      eolListeners = true;
      LUM.editor.panes.forEach((p) => {
        if (!p.editor) return;
        p.editor.onDidScrollChange(() => { if (state.eol) refreshEol(); });
      });
    }
  }

  function persist() {
    try { window.lumen.stateSet('invisibles', { ...state }); } catch { /* ignore */ }
  }

  const LABELS = {
    whitespace: 'Show Space and Tab',
    eol: 'Show End of Line',
    control: 'Show Non Printing Character',
    unicode: 'Show Control Character and Unicode EOL',
    guides: 'Show Indent Guide',
    wrap: 'Show Wrap Symbol'
  };

  function toggle(key) {
    if (!(key in state)) return;
    state[key] = !state[key];
    applyOptions();
    persist();
    LUM.app && LUM.app.toast((state[key] ? '✓ ' : '') + (LABELS[key] || key) + (state[key] ? '' : ' — off'));
  }

  function get(key) { return !!state[key]; }

  // Restore persisted state on boot and apply to the editors.
  async function init() {
    try {
      const saved = await window.lumen.stateGet('invisibles', null);
      if (saved && typeof saved === 'object') Object.assign(state, saved);
    } catch { /* keep defaults */ }
    applyOptions();
  }

  // Re-apply to a newly created pane (splits) so toggles stay consistent.
  function reapply() { applyOptions(); }

  return { toggle, get, init, reapply, state };
})();
