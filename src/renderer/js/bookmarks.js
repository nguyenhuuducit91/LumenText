'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Bookmarks (marks): per-buffer bookmarked lines shown in the glyph margin,
// with wrap-around navigation. Decorations live on the model so they survive
// pane/tab switches. In-memory for the session.
// ===========================================================================
LUM.bookmarks = (function () {
  // bufferId -> decoration ids on the MODEL. The decorations (not a static line
  // Set) are the source of truth, so marks ride along when text is inserted or
  // deleted above them.
  const map = new Map();

  function decoFor(line) {
    return {
      range: new monaco.Range(line, 1, line, 1),
      options: {
        glyphMarginClassName: 'stp-bookmark-glyph',
        glyphMarginHoverMessage: { value: 'Bookmark — F2 next, Shift+F2 previous' },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    };
  }

  function active() {
    const ed = LUM.editor.activeEditor();
    const buf = LUM.editor.activeBuffer();
    if (!ed || !buf || buf.kind !== 'text' || !buf.model) return null;
    return { ed, buf, model: buf.model };
  }

  // Current bookmarked line numbers, read live from the decorations.
  function linesOf(buf) {
    const model = buf.model;
    if (!model) return [];
    const ids = map.get(buf.id) || [];
    const set = new Set();
    for (const id of ids) { const r = model.getDecorationRange(id); if (r) set.add(r.startLineNumber); }
    return [...set].sort((a, b) => a - b);
  }

  function toggle() {
    const a = active();
    if (!a) return;
    const line = a.ed.getPosition().lineNumber;
    const ids = map.get(a.buf.id) || [];
    const onLine = ids.filter((id) => { const r = a.model.getDecorationRange(id); return r && r.startLineNumber === line; });
    if (onLine.length) {
      a.model.deltaDecorations(onLine, []); // remove the mark(s) on this line
      map.set(a.buf.id, ids.filter((id) => !onLine.includes(id)));
      LUM.app.toast('Bookmark removed');
    } else {
      const added = a.model.deltaDecorations([], [decoFor(line)]);
      map.set(a.buf.id, ids.concat(added));
      LUM.app.toast('Bookmark added (Ln ' + line + ')');
    }
  }

  function go(dir) {
    const a = active();
    if (!a) return;
    const lines = linesOf(a.buf);
    if (!lines.length) { LUM.app.toast('No bookmarks in this file'); return; }
    const cur = a.ed.getPosition().lineNumber;
    let target;
    if (dir > 0) target = lines.find((l) => l > cur);
    else { const before = lines.filter((l) => l < cur); target = before[before.length - 1]; }
    if (target == null) target = dir > 0 ? lines[0] : lines[lines.length - 1]; // wrap
    a.ed.setPosition({ lineNumber: target, column: 1 });
    a.ed.revealLineInCenter(target);
    a.ed.focus();
  }

  function clearAll() {
    const a = active();
    if (!a) return;
    const ids = map.get(a.buf.id) || [];
    if (ids.length) a.model.deltaDecorations(ids, []);
    map.set(a.buf.id, []);
    LUM.app.toast('Bookmarks cleared');
  }

  // Drop a buffer's bookmark bookkeeping when its tab closes (model disposal
  // invalidates the decoration ids anyway).
  function dispose(bufId) { map.delete(bufId); }

  return { toggle, next: () => go(1), prev: () => go(-1), clearAll, dispose };
})();
