'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Jump back / forward — a browser-style navigation history of cursor
// locations. `record()` is called right before an explicit navigation (open
// file, goto line/symbol, search jump) so Alt+Left / Alt+Right can retrace.
// ===========================================================================
LUM.nav = (function () {
  const hist = [];
  let idx = -1;
  let suppress = false;

  function current() {
    const ed = LUM.editor.activeEditor();
    const buf = LUM.editor.activeBuffer();
    if (!ed || !buf || !buf.path || buf.kind !== 'text' || !ed.getPosition) return null;
    const p = ed.getPosition();
    return { path: buf.path, line: p.lineNumber, col: p.column };
  }

  // Capture the current location before navigating away.
  function record() {
    if (suppress) return;
    const c = current();
    if (!c) return;
    const top = hist[idx];
    if (top && top.path === c.path && Math.abs(top.line - c.line) <= 1) {
      hist[idx] = c; // same neighbourhood — just refresh
      return;
    }
    hist.splice(idx + 1); // drop any forward history
    hist.push(c);
    idx = hist.length - 1;
    if (hist.length > 200) { hist.shift(); idx--; }
  }

  async function goTo(entry) {
    suppress = true;
    try {
      await LUM.editor.openPath(entry.path);
      const ed = LUM.editor.activeEditor();
      if (ed && ed.setPosition) {
        ed.setPosition({ lineNumber: entry.line, column: entry.col });
        ed.revealLineInCenter(entry.line);
        ed.focus();
      }
    } finally {
      suppress = false;
    }
  }

  async function back() {
    if (idx <= 0) { LUM.app.toast('No previous location'); return; }
    // make sure the spot we're leaving is retained as "forward"
    const c = current();
    if (c && idx === hist.length - 1) {
      const top = hist[idx];
      if (!top || top.path !== c.path || Math.abs(top.line - c.line) > 1) { hist.push(c); }
    }
    idx--;
    await goTo(hist[idx]);
  }

  async function forward() {
    if (idx >= hist.length - 1) { LUM.app.toast('No next location'); return; }
    idx++;
    await goTo(hist[idx]);
  }

  return { record, back, forward };
})();
