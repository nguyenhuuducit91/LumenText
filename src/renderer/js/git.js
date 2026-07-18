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
  let diffTimer = null;

  // ---- repo lifecycle -----------------------------------------------------
  async function onFolderOpen(dir) {
    repo = await window.lumen.gitRoot(dir);
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
    const s = await window.lumen.gitStatus(repo);
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
    const prefix = dirPath + (window.lumen.sep || '/');
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

  function lineDiff(aLines, bLines) {
    const n = aLines.length, m = bLines.length;
    const added = new Set(), modified = new Set(), deleted = new Set();
    if (n > MAX_DIFF_LINES || m > MAX_DIFF_LINES) return { added, modified, deleted, skipped: true };

    // LCS length table
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = aLines[i] === bLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    // backtrack into an op list
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (aLines[i] === bLines[j]) { ops.push('eq'); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push('del'); i++; }
      else { ops.push('ins'); j++; }
    }
    while (i < n) { ops.push('del'); i++; }
    while (j < m) { ops.push('ins'); j++; }

    // map ops to current-buffer (b) line markers
    let bj = 0, k = 0;
    while (k < ops.length) {
      if (ops[k] === 'eq') { bj++; k++; continue; }
      let dels = 0; const ins = [];
      while (k < ops.length && ops[k] !== 'eq') {
        if (ops[k] === 'del') dels++;
        else { ins.push(bj); bj++; }
        k++;
      }
      if (ins.length && dels) ins.forEach((x) => modified.add(x + 1));
      else if (ins.length) ins.forEach((x) => added.add(x + 1));
      else if (dels) deleted.add(Math.max(1, Math.min(bj + 1, m)) || 1);
    }
    return { added, modified, deleted, skipped: false };
  }

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
      head = await window.lumen.gitHeadFile(repo, buf.path);
      headCache.set(buf.path, head);
    }
    const model = ed.getModel();
    if (!model) return;
    if (head == null) {
      // new/untracked file: mark all lines as added
      const count = model.getLineCount();
      const decos = [];
      for (let l = 1; l <= Math.min(count, MAX_DIFF_LINES); l++) {
        decos.push({ range: new monaco.Range(l, 1, l, 1), options: { linesDecorationsClassName: 'git-gutter-add', isWholeLine: false } });
      }
      decoState.set(ed, ed.deltaDecorations(decoState.get(ed) || [], decos));
      return;
    }
    const aLines = head.replace(/\r\n/g, '\n').split('\n');
    const bLines = model.getValue().replace(/\r\n/g, '\n').split('\n');
    const { added, modified, deleted } = lineDiff(aLines, bLines);
    const decos = [];
    added.forEach((l) => decos.push(deco(l, 'git-gutter-add')));
    modified.forEach((l) => decos.push(deco(l, 'git-gutter-mod')));
    deleted.forEach((l) => decos.push(deco(l, 'git-gutter-del')));
    decoState.set(ed, ed.deltaDecorations(decoState.get(ed) || [], decos));
  }

  function deco(line, cls) {
    return { range: new monaco.Range(line, 1, line, 1), options: { linesDecorationsClassName: cls, isWholeLine: false } };
  }

  // revert the active file to its HEAD contents
  async function revertFile() {
    const buf = LUM.editor.activeBuffer();
    if (!repo || !buf || !buf.path || buf.kind !== 'text') return;
    const head = await window.lumen.gitHeadFile(repo, buf.path);
    if (head == null) { LUM.app.toast('No HEAD version to revert to'); return; }
    buf.model.setValue(head);
    LUM.app.toast('Reverted to HEAD: ' + buf.name);
  }

  function init() {
    window.addEventListener('focus', () => { if (repo) refresh(); });
  }

  return { init, onFolderOpen, refresh, scheduleDiff, updateDiff, decorateSidebar, revertFile,
    statusClassFor, get repo() { return repo; } };
})();
