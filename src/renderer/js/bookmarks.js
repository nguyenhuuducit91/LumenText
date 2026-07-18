'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Bookmarks (marks): per-buffer bookmarked lines shown in the glyph margin,
// with wrap-around navigation. Decorations live on the model so they survive
// pane/tab switches. In-memory for the session.
// ===========================================================================
LUM.bookmarks = (function () {
  const map = new Map(); // bufferId -> { lines:Set<number>, ids:string[] }

  function entry(buf) {
    if (!map.has(buf.id)) map.set(buf.id, { lines: new Set(), ids: [] });
    return map.get(buf.id);
  }

  function render(buf, ed) {
    const e = entry(buf);
    const decos = [...e.lines].sort((a, b) => a - b).map((l) => ({
      range: new monaco.Range(l, 1, l, 1),
      options: {
        glyphMarginClassName: 'stp-bookmark-glyph',
        glyphMarginHoverMessage: { value: 'Bookmark — F2 next, Shift+F2 previous' },
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    }));
    e.ids = ed.deltaDecorations(e.ids, decos);
  }

  function active() {
    const ed = LUM.editor.activeEditor();
    const buf = LUM.editor.activeBuffer();
    if (!ed || !buf || buf.kind !== 'text') return null;
    return { ed, buf };
  }

  function toggle() {
    const a = active();
    if (!a) return;
    const line = a.ed.getPosition().lineNumber;
    const e = entry(a.buf);
    if (e.lines.has(line)) e.lines.delete(line);
    else e.lines.add(line);
    render(a.buf, a.ed);
    LUM.app.toast(e.lines.has(line) ? 'Bookmark added (Ln ' + line + ')' : 'Bookmark removed');
  }

  function go(dir) {
    const a = active();
    if (!a) return;
    const lines = [...entry(a.buf).lines].sort((x, y) => x - y);
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
    entry(a.buf).lines.clear();
    render(a.buf, a.ed);
    LUM.app.toast('Bookmarks cleared');
  }

  return { toggle, next: () => go(1), prev: () => go(-1), clearAll };
})();
