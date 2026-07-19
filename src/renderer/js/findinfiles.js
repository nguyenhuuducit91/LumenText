'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Find in Files: project-wide search with a results panel (Ctrl+Shift+F).
// The heavy lifting (walking + matching) happens in the main process; this
// module drives the UI and renders grouped, clickable results.
// ===========================================================================
LUM.findInFiles = (function () {
  const opts = { caseSensitive: false, wholeWord: false, regex: false };
  let els = null;
  let running = false;
  let scopeDir = null; // when set, search is limited to this folder instead of the project root
  let flat = [];       // flat [{path, line, col}] for F4/Shift+F4 result navigation
  let cursor = -1;     // index into `flat` of the last-visited result

  function grab() {
    if (els) return els;
    els = {
      panel: document.getElementById('find-panel'),
      query: document.getElementById('find-query'),
      summary: document.getElementById('find-summary'),
      results: document.getElementById('find-results'),
      caseBtn: document.getElementById('find-case'),
      wordBtn: document.getElementById('find-word'),
      regexBtn: document.getElementById('find-regex'),
      closeBtn: document.getElementById('find-close')
    };
    return els;
  }

  function init() {
    grab();
    els.closeBtn.addEventListener('click', hide);
    els.caseBtn.addEventListener('click', () => toggle('caseSensitive', els.caseBtn));
    els.wordBtn.addEventListener('click', () => toggle('wholeWord', els.wordBtn));
    els.regexBtn.addEventListener('click', () => toggle('regex', els.regexBtn));
    els.query.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); run(); }
      else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    });
  }

  function toggle(key, btn) {
    opts[key] = !opts[key];
    btn.classList.toggle('on', opts[key]);
    if (els.query.value.trim()) run();
  }

  function open(dir) {
    grab();
    scopeDir = dir && dir !== LUM.sidebar.root ? dir : null;
    if (!scopeDir && !LUM.sidebar.root) {
      LUM.app.toast('Open a folder first (Ctrl+Shift+O) to search in files');
      return;
    }
    els.panel.classList.remove('hidden');
    els.query.placeholder = scopeDir ? 'Find in ' + window.lumen.basename(scopeDir) + '…' : 'Find in Files…';
    // seed from current selection if any
    const ed = LUM.editor.activeEditor();
    if (ed && ed.getModel) {
      const sel = ed.getSelection && ed.getSelection();
      if (sel && !sel.isEmpty()) {
        els.query.value = ed.getModel().getValueInRange(sel).split('\n')[0];
      }
    }
    els.query.focus();
    els.query.select();
    LUM.editor.layout();
  }

  function hide() {
    if (els) els.panel.classList.add('hidden');
    const ed = LUM.editor.activeEditor();
    if (ed) ed.focus();
    LUM.editor.layout();
  }

  function isOpen() {
    return els && !els.panel.classList.contains('hidden');
  }

  async function run() {
    const q = els.query.value;
    if (!q.trim() || running) return;
    running = true;
    els.summary.textContent = 'Searching…';
    els.results.innerHTML = '';
    try {
      // Multi-root: when no explicit scope folder, search EVERY project root and
      // aggregate — otherwise Ctrl+Shift+F only ever hits the first folder.
      const roots = scopeDir ? [scopeDir] : LUM.sidebar.roots;
      let agg = { files: [], total: 0, scanned: 0, truncated: false };
      for (const root of roots) {
        const res = await window.lumen.searchInFiles(root, q, opts);
        if (res && res.error) { els.summary.textContent = res.error; return; }
        if (!res) continue;
        agg.files.push(...res.files);
        agg.total += res.total || 0;
        agg.scanned += res.scanned || 0;
        agg.truncated = agg.truncated || !!res.truncated;
      }
      render(agg);
    } catch (e) {
      els.summary.textContent = 'Search failed: ' + (e && e.message ? e.message : e);
    } finally {
      running = false; // never leave the panel wedged after a failed search
    }
  }

  function esc(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function highlight(text, ranges) {
    let out = '', last = 0;
    for (const [a, b] of ranges) {
      out += esc(text.slice(last, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>';
      last = b;
    }
    out += esc(text.slice(last));
    return out;
  }

  function render(res) {
    els.summary.textContent =
      `${res.total.toLocaleString()} match${res.total === 1 ? '' : 'es'} in ` +
      `${res.files.length.toLocaleString()} file${res.files.length === 1 ? '' : 's'} ` +
      `(${res.scanned.toLocaleString()} scanned)` + (res.truncated ? ' — results limited' : '');
    flat = []; cursor = -1;
    const frag = document.createDocumentFragment();
    for (const f of res.files) {
      const head = document.createElement('div');
      head.className = 'find-file';
      const ico = LUM.icons ? LUM.icons.file(window.lumen.basename(f.path)) : '';
      head.innerHTML = `<span class="tree-ico">${ico}</span>${esc(f.rel)} <span class="fc">${f.matches.length}</span>`;
      head.addEventListener('click', () => openAt(f.path, f.matches[0].line, f.matches[0].col));
      frag.appendChild(head);
      for (const m of f.matches) {
        const idx = flat.length;
        flat.push({ path: f.path, line: m.line, col: m.col });
        const row = document.createElement('div');
        row.className = 'find-match';
        row.dataset.idx = idx;
        row.innerHTML =
          `<span class="ln">${m.line}</span>` +
          `<span class="tx">${highlight(m.text.replace(/\t/g, '  '), adjust(m.text, m.ranges))}</span>`;
        row.addEventListener('click', () => { cursor = idx; markActive(); openAt(f.path, m.line, m.col); });
        frag.appendChild(row);
      }
    }
    els.results.innerHTML = '';
    els.results.appendChild(frag);
  }

  // tabs were expanded to 2 spaces for display; shift match ranges to match
  function adjust(text, ranges) {
    const upto = (idx) => {
      let extra = 0;
      for (let i = 0; i < idx && i < text.length; i++) if (text[i] === '\t') extra += 1;
      return idx + extra;
    };
    return ranges.map(([a, b]) => [upto(a), upto(b)]);
  }

  async function openAt(filePath, line, col) {
    await LUM.editor.openPath(filePath);
    const ed = LUM.editor.activeEditor();
    if (ed && ed.setPosition) {
      ed.setPosition({ lineNumber: line, column: col || 1 });
      ed.revealLineInCenter(line);
      ed.focus();
    }
    LUM.sidebar.highlightActive && LUM.sidebar.highlightActive();
  }

  // Highlight the current result row and scroll it into view in the panel.
  function markActive() {
    if (!els) return;
    els.results.querySelectorAll('.find-match.current').forEach((r) => r.classList.remove('current'));
    const row = els.results.querySelector(`.find-match[data-idx="${cursor}"]`);
    if (row) { row.classList.add('current'); row.scrollIntoView({ block: 'nearest' }); }
  }

  // F4 / Shift+F4 — jump to the next / previous result across all files.
  function nextResult() { return step(1); }
  function prevResult() { return step(-1); }
  function step(dir) {
    if (!flat.length) return false;
    cursor = (cursor + dir + flat.length) % flat.length;
    const r = flat[cursor];
    markActive();
    openAt(r.path, r.line, r.col);
    return true;
  }
  function hasResults() { return flat.length > 0; }

  return { init, open, hide, isOpen, nextResult, prevResult, hasResults };
})();
