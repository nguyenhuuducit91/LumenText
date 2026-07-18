'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// LSP client (renderer side). Wires JS/TS buffers to typescript-language-server
// through the main process: pushes document sync, renders diagnostics as Monaco
// markers, and provides completion + hover from the server.
// ===========================================================================
LUM.lsp = (function () {
  const LANGS = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'];
  const LANGSET = new Set(LANGS);
  let root = null;
  let available = false;
  const versions = new Map();       // uri -> version
  const changeTimers = new Map();

  function uriOf(p) { return 'file://' + encodeURI(p).replace(/#/g, '%23'); }
  function pathFromUri(uri) {
    try { return decodeURIComponent(uri.replace(/^file:\/\//, '')); }
    catch { return uri.replace(/^file:\/\//, ''); }
  }
  function eligible(buf) {
    return buf && buf.kind === 'text' && buf.path && buf.model && LANGSET.has(buf.model.getLanguageId());
  }

  function onFolderOpen(dir) { root = dir; }

  function onOpen(buf) {
    if (!available || !root || !eligible(buf)) return;
    const uri = uriOf(buf.path);
    versions.set(uri, 1);
    window.lumen.lspDidOpen(root, uri, buf.model.getLanguageId(), 1, buf.model.getValue());
  }
  function onChange(buf) {
    if (!available || !root || !eligible(buf)) return;
    const uri = uriOf(buf.path);
    clearTimeout(changeTimers.get(uri));
    changeTimers.set(uri, setTimeout(() => {
      const v = (versions.get(uri) || 1) + 1;
      versions.set(uri, v);
      window.lumen.lspDidChange(root, uri, v, buf.model.getValue());
    }, 350));
  }

  function bufForModel(model) {
    for (const id of LUM.editor.order) {
      const b = LUM.editor.buffers.get(id);
      if (b && b.model === model) return b;
    }
    return null;
  }
  function bufForUri(uri) {
    const p = pathFromUri(uri);
    for (const id of LUM.editor.order) {
      const b = LUM.editor.buffers.get(id);
      if (b && b.path === p) return b;
    }
    return null;
  }

  function severity(s) {
    return s === 1 ? monaco.MarkerSeverity.Error
      : s === 2 ? monaco.MarkerSeverity.Warning
      : s === 3 ? monaco.MarkerSeverity.Info : monaco.MarkerSeverity.Hint;
  }
  function onDiagnostics(uri, diags) {
    const buf = bufForUri(uri);
    if (!buf || !buf.model) return;
    const markers = (diags || []).map((d) => ({
      startLineNumber: d.range.start.line + 1,
      startColumn: d.range.start.character + 1,
      endLineNumber: d.range.end.line + 1,
      endColumn: d.range.end.character + 1,
      message: d.message + (d.code ? ' (' + d.code + ')' : ''),
      severity: severity(d.severity),
      source: d.source || 'ts'
    }));
    monaco.editor.setModelMarkers(buf.model, 'lsp', markers);
  }

  // LSP CompletionItemKind (1..25) -> Monaco CompletionItemKind
  function mapKind(k) {
    const C = monaco.languages.CompletionItemKind;
    const map = {
      1: C.Text, 2: C.Method, 3: C.Function, 4: C.Constructor, 5: C.Field, 6: C.Variable,
      7: C.Class, 8: C.Interface, 9: C.Module, 10: C.Property, 11: C.Unit, 12: C.Value,
      13: C.Enum, 14: C.Keyword, 15: C.Snippet, 16: C.Color, 17: C.File, 18: C.Reference,
      19: C.Folder, 20: C.EnumMember, 21: C.Constant, 22: C.Struct, 23: C.Event,
      24: C.Operator, 25: C.TypeParameter
    };
    return map[k] || C.Text;
  }

  function registerProviders() {
    monaco.languages.registerCompletionItemProvider(LANGS, {
      triggerCharacters: ['.', '"', "'", '/', '@', '<', ' '],
      async provideCompletionItems(model, position) {
        const buf = bufForModel(model);
        if (!available || !root || !buf) return { suggestions: [] };
        const res = await window.lumen.lspCompletion(root, uriOf(buf.path),
          { line: position.lineNumber - 1, character: position.column - 1 });
        const items = (res && (res.items || res)) || [];
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn
        };
        return {
          suggestions: items.slice(0, 300).map((it) => ({
            label: typeof it.label === 'string' ? it.label : it.label.label,
            kind: mapKind(it.kind),
            insertText: it.insertText || (typeof it.label === 'string' ? it.label : it.label.label),
            detail: it.detail,
            documentation: it.documentation && (it.documentation.value || it.documentation),
            sortText: it.sortText,
            range
          }))
        };
      }
    });

    monaco.languages.registerHoverProvider(LANGS, {
      async provideHover(model, position) {
        const buf = bufForModel(model);
        if (!available || !root || !buf) return null;
        const res = await window.lumen.lspHover(root, uriOf(buf.path),
          { line: position.lineNumber - 1, character: position.column - 1 });
        if (!res || !res.contents) return null;
        const c = res.contents;
        let value;
        if (Array.isArray(c)) value = c.map((x) => (typeof x === 'string' ? x : x.value)).join('\n\n');
        else value = typeof c === 'string' ? c : c.value;
        return { contents: [{ value }] };
      }
    });
  }

  async function init() {
    try { available = await window.lumen.lspAvailable(); } catch { available = false; }
    window.lumen.onLspDiagnostics(onDiagnostics);
    registerProviders();
    if (available) {
      const st = document.getElementById('status-lsp');
      if (st) { st.style.display = ''; }
    }
  }

  return { init, onFolderOpen, onOpen, onChange, get available() { return available; } };
})();
