'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Overlay palette used for: Command Palette, Goto Anything (files),
// Goto Line, Goto Symbol. Fuzzy subsequence matching with highlight.
// ===========================================================================
LUM.palette = (function () {
  const overlay = () => document.getElementById('palette');
  const input = () => document.getElementById('palette-input');
  const listEl = () => document.getElementById('palette-list');

  let mode = null;         // 'command' | 'file' | 'line' | 'symbol'
  let items = [];          // current candidate list [{label, sub, key, run}]
  let filtered = [];
  let active = 0;
  let fileIndex = null;    // cached walk result

  // ---- fuzzy matcher ------------------------------------------------------
  // Returns {score, positions} or null. Higher score = better.
  function fuzzy(query, text) {
    if (!query) return { score: 0, positions: [] };
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0, ti = 0, score = 0, prevMatch = -2;
    const positions = [];
    while (qi < q.length && ti < t.length) {
      if (q[qi] === t[ti]) {
        positions.push(ti);
        score += 1;
        if (ti === prevMatch + 1) score += 5;                    // consecutive
        if (ti === 0 || /[\/_\-. ]/.test(t[ti - 1])) score += 8; // word start
        prevMatch = ti;
        qi++;
      }
      ti++;
    }
    if (qi < q.length) return null;
    score -= (t.length - positions.length) * 0.02; // slight length penalty
    return { score, positions };
  }

  function highlight(text, positions) {
    if (!positions || !positions.length) return escapeHtml(text);
    const set = new Set(positions);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = escapeHtml(text[i]);
      out += set.has(i) ? `<mark>${ch}</mark>` : ch;
    }
    return out;
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---- open/close ---------------------------------------------------------
  function open(newMode, prefill = '') {
    mode = newMode;
    overlay().classList.remove('hidden');
    const inp = input();
    inp.value = prefill;
    prepareItems().then(() => {
      refilter();
      inp.focus();
      inp.select();
    });
  }

  function close() {
    overlay().classList.add('hidden');
    mode = null;
    const ed = LUM.editor.activeEditor();
    if (ed) ed.focus();
  }

  function isOpen() {
    return !overlay().classList.contains('hidden');
  }

  async function prepareItems() {
    if (mode === 'command') {
      items = LUM.commands.all().map((c) => ({
        label: c.title,
        sub: c.category || '',
        key: c.keybind || '',
        run: () => LUM.commands.run(c.id)
      }));
    } else if (mode === 'file') {
      const idx = await getFileIndex();
      items = idx.map((f) => ({
        label: f.rel,
        sub: '',
        run: () => LUM.editor.openPath(f.path)
      }));
    } else if (mode === 'symbol') {
      items = collectSymbols();
    } else if (mode === 'word') {
      items = collectLines();
    } else if (mode === 'line') {
      items = []; // handled specially
    }
  }

  // Every non-blank line of the current file, for Goto Anything's `#` search.
  function collectLines() {
    const ed = LUM.editor.activeEditor();
    const model = ed && ed.getModel();
    if (!model) return [];
    const out = [];
    const lines = model.getLinesContent();
    for (let i = 0; i < lines.length && out.length < 50000; i++) {
      const t = lines[i].trim();
      if (t) out.push({ label: t, sub: 'Ln ' + (i + 1), run: () => gotoLine(i + 1) });
    }
    return out;
  }

  async function getFileIndex() {
    if (fileIndex) return fileIndex;
    const roots = LUM.sidebar.roots;
    if (!roots.length) {
      fileIndex = [];
      return fileIndex;
    }
    const multi = roots.length > 1;
    const seen = new Set();
    const out = [];
    for (const root of roots) {
      const files = await window.lumen.walk(root);
      const prefix = multi ? window.lumen.basename(root) + '/' : '';
      for (const f of files) {
        if (seen.has(f.path)) continue;
        seen.add(f.path);
        out.push({
          path: f.path,
          rel: prefix + (f.path.startsWith(root) ? f.path.slice(root.length + 1) : f.path)
        });
      }
    }
    fileIndex = out;
    return fileIndex;
  }

  function invalidateFileIndex() {
    fileIndex = null;
  }

  function collectSymbols() {
    const ed = LUM.editor.activeEditor();
    const model = ed && ed.getModel();
    if (!model) return [];
    // Lightweight symbol scan: functions, classes, headings, etc.
    const out = [];
    const lines = model.getLinesContent();
    const re = /(?:^|\s)(?:function|class|def|interface|type|const|let|var|public|private|export)\s+([A-Za-z_$][\w$]*)|^\s*([A-Za-z_$][\w$]*)\s*(?:\([^)]*\))?\s*\{|^(#{1,6})\s+(.+)$/;
    lines.forEach((line, i) => {
      const m = line.match(re);
      if (m) {
        const name = m[1] || m[2] || (m[4] ? m[4].trim() : null);
        if (name && name.length > 1) {
          out.push({
            label: name,
            sub: 'Ln ' + (i + 1),
            run: () => gotoLine(i + 1)
          });
        }
      }
    });
    return out;
  }

  function gotoLine(lineNo, col = 1) {
    const ed = LUM.editor.activeEditor();
    if (!ed) return;
    ed.revealLineInCenter(lineNo);
    ed.setPosition({ lineNumber: lineNo, column: col });
    ed.focus();
  }

  // ---- filtering / render -------------------------------------------------
  function refilter() {
    const raw = input().value;

    if (mode === 'line') {
      renderLineMode(raw);
      return;
    }

    // Goto Anything supports "@symbol", "#word" and ":line" suffixes like Sublime.
    let query = raw;
    let suffix = null;
    if (mode === 'file') {
      const at = raw.indexOf('@');
      const hash = raw.indexOf('#');
      const colon = raw.indexOf(':');
      if (at >= 0) { query = raw.slice(0, at); suffix = { type: 'symbol', val: raw.slice(at + 1) }; }
      else if (hash >= 0) { query = raw.slice(0, hash); suffix = { type: 'word', val: raw.slice(hash + 1) }; }
      else if (colon >= 0) { query = raw.slice(0, colon); suffix = { type: 'line', val: raw.slice(colon + 1) }; }
    }

    const scored = [];
    for (const it of items) {
      const hay = it.label + (it.sub ? ' ' + it.sub : '');
      const res = fuzzy(query.trim(), it.label);
      if (res || !query.trim()) {
        scored.push({ it, score: res ? res.score : 0, positions: res ? res.positions : [] });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.slice(0, 500);
    active = 0;
    renderList(suffix);
  }

  function renderLineMode(raw) {
    const n = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    const model = LUM.editor.activeEditor() && LUM.editor.activeEditor().getModel();
    const max = model ? model.getLineCount() : 1;
    listEl().innerHTML = `<li class="palette-item active"><span class="pi-main">Go to line ${
      isNaN(n) ? '…' : Math.min(n, max)
    } (of ${max})</span></li>`;
    filtered = [{
      it: { run: () => { if (!isNaN(n)) gotoLine(Math.min(n, max)); } },
      positions: []
    }];
    active = 0;
  }

  function renderList(suffix) {
    const ul = listEl();
    ul.innerHTML = '';
    filtered.forEach((row, i) => {
      const li = document.createElement('li');
      li.className = 'palette-item' + (i === active ? ' active' : '');
      const main = highlight(row.it.label, row.positions);
      li.innerHTML =
        `<span class="pi-main">${main}${row.it.sub ? ` <span class="pi-sub">${escapeHtml(row.it.sub)}</span>` : ''}</span>` +
        (row.it.key ? `<span class="pi-key">${escapeHtml(row.it.key)}</span>` : '');
      li.addEventListener('click', () => choose(i, suffix));
      ul.appendChild(li);
    });
  }

  function move(delta) {
    if (!filtered.length) return;
    active = (active + delta + filtered.length) % filtered.length;
    renderList();
    const el = listEl().children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  async function choose(i, suffix) {
    if (i != null) active = i;
    const row = filtered[active];
    if (!row) { close(); return; }
    const run = row.it.run;
    close();
    if (run) await run();
    // apply :line / @symbol suffix after opening the file
    if (suffix) {
      setTimeout(() => {
        if (suffix.type === 'line') {
          const n = parseInt(suffix.val, 10);
          if (!isNaN(n)) gotoLine(n);
        } else if (suffix.type === 'symbol') {
          open('symbol', suffix.val);
        } else if (suffix.type === 'word') {
          open('word', suffix.val);
        }
      }, 40);
    }
  }

  // ---- key handling -------------------------------------------------------
  function onKeydown(e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(); }
  }

  function init() {
    input().addEventListener('input', refilter);
    document.addEventListener('keydown', onKeydown, true);
    overlay().addEventListener('mousedown', (e) => {
      if (e.target === overlay()) close();
    });
  }

  return { init, open, close, isOpen, invalidateFileIndex, gotoLine };
})();
