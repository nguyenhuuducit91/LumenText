'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Git integration: sidebar status colours, current branch in the status bar,
// and incremental diff markers in the editor gutter (added/modified/deleted
// vs HEAD), computed with an LCS line diff.
// ===========================================================================
LUM.git = (function () {
  let repo = null;               // repo root, or null
  let statusMap = {};            // absPath -> 'XY' porcelain code
  let branchName = '';
  const headCache = new Map();   // absPath -> HEAD content (string) or null
  const decoState = new WeakMap(); // editor -> decoration ids
  const hunkState = new WeakMap(); // editor -> [{kind, bStart, bEnd, head:[]}]
  let diffTimer = null;

  // ---- repo lifecycle -----------------------------------------------------
  async function onFolderOpen(dir) {
    repo = await window.lumenText.gitRoot(dir);
    headCache.clear();
    if (!repo) {
      statusMap = {};
      branchName = '';
      updateBranchUI();
      decorateSidebar();
      return;
    }
    await refresh();
  }

  async function refresh() {
    if (!repo) return;
    const s = await window.lumenText.gitStatus(repo);
    statusMap = s ? s.files : {};
    branchName = s ? s.branch : '';
    headCache.clear();
    updateBranchUI();
    decorateSidebar();
    updateDiff(); // active editor may have changed vs HEAD
  }

  // ---- sidebar status colours --------------------------------------------
  // Prefer the work-tree column, fall back to the index column.
  function classForCode(code) {
    if (!code) return null;
    if (code === '??') return 'git-untracked';
    if (code.includes('U') || code === 'AA' || code === 'DD') return 'git-conflict';
    const c = code[1] !== ' ' ? code[1] : code[0];
    if (c === 'M') return 'git-modified';
    if (c === 'A') return 'git-added';
    if (c === 'D') return 'git-deleted';
    if (c === 'R' || c === 'C') return 'git-modified';
    return 'git-modified';
  }

  function statusClassFor(absPath) {
    return classForCode(statusMap[absPath]);
  }

  function decorateSidebar() {
    document.querySelectorAll('.tree-row').forEach((row) => {
      row.classList.remove('git-modified', 'git-added', 'git-deleted', 'git-untracked', 'git-conflict', 'git-dirty-dir');
      const p = row.dataset.path;
      if (!p) return;
      const cls = statusClassFor(p);
      if (cls) row.classList.add(cls);
      else if (row.classList.contains('is-dir') && dirHasChanges(p)) row.classList.add('git-dirty-dir');
    });
  }

  function dirHasChanges(dirPath) {
    const prefix = dirPath + (window.lumenText.sep || '/');
    for (const p in statusMap) if (p.startsWith(prefix)) return true;
    return false;
  }

  // ---- branch in status bar ----------------------------------------------
  function updateBranchUI() {
    const el = document.getElementById('status-branch');
    if (!el) return;
    if (repo && branchName) {
      el.textContent = '⎇ ' + branchName; // branch glyph
      el.style.display = '';
    } else {
      el.textContent = '';
      el.style.display = 'none';
    }
  }

  // ---- gutter diff (LCS line diff vs HEAD) --------------------------------
  const MAX_DIFF_LINES = 4000;

  // LCS line diff → contiguous hunks (see src/shared/linediff.js — pure + tested).
  function diffHunks(aLines, bLines) { return LUM.linediff.diffHunks(aLines, bLines, MAX_DIFF_LINES); }
  const hunkAnchor = LUM.linediff.hunkAnchor;

  function scheduleDiff() {
    clearTimeout(diffTimer);
    diffTimer = setTimeout(updateDiff, 350);
  }

  async function updateDiff() {
    if (!LUM.editor || !LUM.editor.panes) return;
    for (const pane of LUM.editor.panes) {
      await updatePaneDiff(pane);
    }
  }

  async function updatePaneDiff(pane) {
    const ed = pane.editor;
    const buf = LUM.editor.buffers.get(pane.currentId);
    const clear = () => {
      const old = decoState.get(ed) || [];
      if (old.length) decoState.set(ed, ed.deltaDecorations(old, []));
    };
    if (!repo || !buf || buf.kind !== 'text' || !buf.path) { clear(); return; }

    let head = headCache.get(buf.path);
    if (head === undefined) {
      head = await window.lumenText.gitHeadFile(repo, buf.path);
      headCache.set(buf.path, head);
    }
    // The pane may have switched buffers during the await — bail if so, otherwise
    // we'd diff this file's HEAD against a different file's current text.
    if (pane.currentId !== buf.id) return;
    const model = ed.getModel();
    if (!model || model !== buf.model) return;
    if (head == null) {
      // new/untracked file: mark all lines as added
      const count = model.getLineCount();
      const decos = [];
      for (let l = 1; l <= Math.min(count, MAX_DIFF_LINES); l++) {
        decos.push({ range: new monaco.Range(l, 1, l, 1), options: { linesDecorationsClassName: 'git-gutter-add', isWholeLine: false } });
      }
      decoState.set(ed, ed.deltaDecorations(decoState.get(ed) || [], decos));
      hunkState.set(ed, count ? [{ kind: 'add', bStart: 1, bEnd: count, head: [] }] : []);
      return;
    }
    const aLines = head.replace(/\r\n/g, '\n').split('\n');
    const bLines = model.getValue().replace(/\r\n/g, '\n').split('\n');
    const { hunks } = diffHunks(aLines, bLines);
    hunkState.set(ed, hunks);
    const decos = [];
    for (const h of hunks) {
      if (h.kind === 'del') {
        decos.push(deco(hunkAnchor(h), 'git-gutter-del'));
      } else {
        const cls = h.kind === 'add' ? 'git-gutter-add' : 'git-gutter-mod';
        for (let l = h.bStart; l <= h.bEnd; l++) decos.push(deco(l, cls));
      }
    }
    decoState.set(ed, ed.deltaDecorations(decoState.get(ed) || [], decos));
  }

  // ---- hunk navigation + revert (Sublime's History commands) --------------
  function activeHunks() {
    const ed = LUM.editor.activeEditor && LUM.editor.activeEditor();
    if (!ed) return { ed: null, hunks: [] };
    return { ed, hunks: (hunkState.get(ed) || []).slice().sort((a, b) => hunkAnchor(a) - hunkAnchor(b)) };
  }

  function gotoModification(dir) {
    const { ed, hunks } = activeHunks();
    if (!ed || !ed.getPosition) return;
    if (!hunks.length) { LUM.app.toast('No changes vs HEAD in this file'); return; }
    const cur = ed.getPosition().lineNumber;
    let target = null;
    if (dir > 0) target = hunks.find((h) => hunkAnchor(h) > cur) || hunks[0];
    else { const before = hunks.filter((h) => hunkAnchor(h) < cur); target = before[before.length - 1] || hunks[hunks.length - 1]; }
    const ln = hunkAnchor(target);
    ed.setPosition({ lineNumber: ln, column: 1 });
    ed.revealLineInCenter(ln);
    ed.focus();
  }

  function hunkContains(h, line) {
    if (h.bEnd >= h.bStart) return line >= h.bStart && line <= h.bEnd;
    return line === h.bStart || line === Math.max(1, h.bStart - 1);
  }

  // Revert just the hunk under the caret to its HEAD text (Ctrl+K Ctrl+Z).
  function revertHunk() {
    const { ed, hunks } = activeHunks();
    if (!ed) return;
    if (!hunks.length) { LUM.app.toast('No changes to revert'); return; }
    const model = ed.getModel();
    const cur = ed.getPosition().lineNumber;
    const h = hunks.find((x) => hunkContains(x, cur)) || hunks.find((x) => hunkAnchor(x) >= cur) || hunks[0];
    const lineCount = model.getLineCount();
    let range, text;
    if (h.bEnd >= h.bStart) {
      if (h.bEnd < lineCount) {
        range = new monaco.Range(h.bStart, 1, h.bEnd + 1, 1);
        text = h.head.length ? h.head.join('\n') + '\n' : '';
      } else {
        range = new monaco.Range(h.bStart, 1, h.bEnd, model.getLineMaxColumn(h.bEnd));
        text = h.head.join('\n');
      }
    } else {
      // pure deletion — re-insert the removed HEAD lines
      if (h.bStart <= lineCount) {
        range = new monaco.Range(h.bStart, 1, h.bStart, 1);
        text = h.head.join('\n') + '\n';
      } else {
        const last = model.getLineMaxColumn(lineCount);
        range = new monaco.Range(lineCount, last, lineCount, last);
        text = '\n' + h.head.join('\n');
      }
    }
    ed.executeEdits('git-revert-hunk', [{ range, text }]);
    ed.setPosition({ lineNumber: Math.min(h.bStart, ed.getModel().getLineCount()), column: 1 });
    scheduleDiff();
    LUM.app.toast('Reverted hunk');
  }

  function deco(line, cls) {
    return { range: new monaco.Range(line, 1, line, 1), options: { linesDecorationsClassName: cls, isWholeLine: false } };
  }

  // revert the active file to its HEAD contents
  async function revertFile() {
    const buf = LUM.editor.activeBuffer();
    if (!repo || !buf || !buf.path || buf.kind !== 'text') return;
    const head = await window.lumenText.gitHeadFile(repo, buf.path);
    if (head == null) { LUM.app.toast('No HEAD version to revert to'); return; }
    buf.model.setValue(head);
    LUM.app.toast('Reverted to HEAD: ' + buf.name);
  }

  function init() {
    window.addEventListener('focus', () => { if (repo) refresh(); });
  }

  return { init, onFolderOpen, refresh, scheduleDiff, updateDiff, decorateSidebar, revertFile,
    gotoModification, revertHunk,
    statusClassFor, get repo() { return repo; } };
})();
