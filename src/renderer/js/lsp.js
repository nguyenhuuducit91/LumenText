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
    window.lumenText.lspDidOpen(root, uri, buf.model.getLanguageId(), 1, buf.model.getValue());
  }
  function onChange(buf) {
    if (!available || !root || !eligible(buf)) return;
    const uri = uriOf(buf.path);
    clearTimeout(changeTimers.get(uri));
    changeTimers.set(uri, setTimeout(() => {
      changeTimers.delete(uri);
      const v = (versions.get(uri) || 1) + 1;
      versions.set(uri, v);
      window.lumenText.lspDidChange(root, uri, v, buf.model.getValue());
    }, 350));
  }

  // Flush a pending debounced didChange NOW, so completion/hover/definition
  // requests run against the text the server actually has (not stale content).
  function flush(uri, model) {
    if (!changeTimers.has(uri)) return;
    clearTimeout(changeTimers.get(uri));
    changeTimers.delete(uri);
    const v = (versions.get(uri) || 1) + 1;
    versions.set(uri, v);
    window.lumenText.lspDidChange(root, uri, v, model.getValue());
  }

  // A buffer was closed — tell the server and drop its bookkeeping so a later
  // reopen sends a fresh didOpen (not a duplicate on an already-open document).
  function onClose(buf) {
    if (!root || !buf || !buf.path) return;
    const uri = uriOf(buf.path);
    if (!versions.has(uri)) return;
    clearTimeout(changeTimers.get(uri));
    changeTimers.delete(uri);
    versions.delete(uri);
    if (available) window.lumenText.lspDidClose(root, uri);
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
        const uri = uriOf(buf.path);
        flush(uri, model); // send pending edits so the server sees current text
        const res = await window.lumenText.lspCompletion(root, uri,
          { line: position.lineNumber - 1, character: position.column - 1 });
        const items = (res && (res.items || res)) || [];
        const word = model.getWordUntilPosition(position);
        const defRange = {
          startLineNumber: position.lineNumber, endLineNumber: position.lineNumber,
          startColumn: word.startColumn, endColumn: word.endColumn
        };
        const SNIPPET = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
        return {
          suggestions: items.slice(0, 300).map((it) => {
            const label = typeof it.label === 'string' ? it.label : it.label.label;
            // Prefer the server's textEdit range/text when present, else the word range.
            const te = it.textEdit;
            const insertText = (te && te.newText) || it.insertText || label;
            let range = defRange;
            const r = te && (te.range || (te.insert));
            if (r) {
              range = {
                startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
                endLineNumber: r.end.line + 1, endColumn: r.end.character + 1
              };
            }
            // insertTextFormat 2 = Snippet — let Monaco expand $1/$0 tab-stops.
            const isSnippet = it.insertTextFormat === 2;
            return {
              label,
              kind: mapKind(it.kind),
              insertText,
              insertTextRules: isSnippet ? SNIPPET : undefined,
              detail: it.detail,
              documentation: it.documentation && (it.documentation.value || it.documentation),
              sortText: it.sortText,
              filterText: it.filterText,
              range
            };
          })
        };
      }
    });

    monaco.languages.registerHoverProvider(LANGS, {
      async provideHover(model, position) {
        const buf = bufForModel(model);
        if (!available || !root || !buf) return null;
        const uri = uriOf(buf.path);
        flush(uri, model);
        const res = await window.lumenText.lspHover(root, uri,
          { line: position.lineNumber - 1, character: position.column - 1 });
        if (!res || !res.contents) return null;
        const c = res.contents;
        let value;
        if (Array.isArray(c)) value = c.map((x) => (typeof x === 'string' ? x : x.value)).join('\n\n');
        else value = typeof c === 'string' ? c : c.value;
        return { contents: [{ value }] };
      }
    });

    // In-editor definition (Ctrl+Click / peek). Cross-file jumps go through
    // gotoDefinition() below, which can open a file Monaco doesn't have loaded.
    monaco.languages.registerDefinitionProvider(LANGS, {
      async provideDefinition(model, position) {
        const buf = bufForModel(model);
        if (!available || !root || !buf) return null;
        const uri = uriOf(buf.path);
        flush(uri, model);
        const res = await window.lumenText.lspDefinition(root, uri,
          { line: position.lineNumber - 1, character: position.column - 1 });
        return locsFromResult(res)
          .filter((l) => pathFromUri(l.uri) === buf.path) // only same-file for peek
          .map((l) => ({ uri: model.uri, range: toMonacoRange(l.range) }));
      }
    });
  }

  // Normalise Location | Location[] | LocationLink[] into [{uri, range}].
  function locsFromResult(res) {
    if (!res) return [];
    const arr = Array.isArray(res) ? res : [res];
    return arr.map((l) => l.targetUri
      ? { uri: l.targetUri, range: l.targetSelectionRange || l.targetRange }
      : { uri: l.uri, range: l.range }).filter((l) => l.uri && l.range);
  }
  function toMonacoRange(r) {
    return new monaco.Range(r.start.line + 1, r.start.character + 1, r.end.line + 1, r.end.character + 1);
  }

  // Goto Definition (F12): query the server and open the target file — works
  // across files, unlike Monaco's action which needs the model already loaded.
  async function gotoDefinition() {
    const ed = LUM.editor.activeEditor();
    const buf = LUM.editor.activeBuffer();
    if (!available || !root || !eligible(buf) || !ed) {
      // Non-LSP language: fall back to Monaco's word-based reveal.
      const a = ed && ed.getAction('editor.action.revealDefinition');
      if (a) a.run();
      return;
    }
    const pos = ed.getPosition();
    const uri = uriOf(buf.path);
    flush(uri, buf.model);
    const res = await window.lumenText.lspDefinition(root, uri,
      { line: pos.lineNumber - 1, character: pos.column - 1 });
    const locs = locsFromResult(res);
    if (!locs.length) { LUM.app.toast('No definition found'); return; }
    const loc = locs[0];
    const targetPath = pathFromUri(loc.uri);
    LUM.nav && LUM.nav.record();
    await LUM.editor.openPath(targetPath);
    const ed2 = LUM.editor.activeEditor();
    if (ed2 && ed2.setPosition) {
      const r = loc.range;
      ed2.setPosition({ lineNumber: r.start.line + 1, column: r.start.character + 1 });
      ed2.revealLineInCenter(r.start.line + 1);
      ed2.focus();
    }
  }

  async function init() {
    try { available = await window.lumenText.lspAvailable(); } catch { available = false; }
    window.lumenText.onLspDiagnostics(onDiagnostics);
    registerProviders();
    if (available) {
      const st = document.getElementById('status-lsp');
      if (st) { st.style.display = ''; }
    }
  }

  return { init, onFolderOpen, onOpen, onChange, onClose, gotoDefinition, get available() { return available; } };
})();
