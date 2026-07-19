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
  let curSuffix = null;    // parsed `:line`/`@symbol`/`#word` suffix for the pending choice
  let openSeq = 0;         // generation token: a newer open() cancels a slower one

  // ---- fuzzy matcher (pure logic in src/shared/fuzzy.js) ------------------
  const fuzzy = (q, t) => LUM.fuzzy.fuzzy(q, t);

  // Score a candidate against its label + basename (via scorePath) and its
  // category/sub text, so `cli` ranks `client/cli.js` above `client/models.js`
  // and command categories are searchable. Positions are relative to `label`.
  function scoreItem(query, it) {
    if (!query) return { score: 0, positions: [] };
    let best = LUM.fuzzy.scorePath(query, it.label);
    // Category / sub text (e.g. "Git", "Ln 42") — searchable but not highlighted.
    if (!best && it.sub) {
      const sres = fuzzy(query, it.sub);
      if (sres) best = { score: sres.score - 4, positions: [] };
    }
    return best;
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
    const gen = ++openSeq;
    overlay().classList.remove('hidden');
    const inp = input();
    inp.value = prefill;
    prepareItems(gen).then(() => {
      if (gen !== openSeq) return; // a newer open() replaced this one
      refilter();
      inp.focus();
      inp.select();
    });
  }

  function close() {
    overlay().classList.add('hidden');
    mode = null;
    curSuffix = null;
    const ed = LUM.editor.activeEditor();
    if (ed) ed.focus();
  }

  function isOpen() {
    return !overlay().classList.contains('hidden');
  }

  async function prepareItems(gen) {
    let built = [];
    if (mode === 'command') {
      built = LUM.commands.all().map((c) => ({
        label: c.title,
        sub: c.category || '',
        key: c.keybind || '',
        run: () => LUM.commands.run(c.id)
      }));
    } else if (mode === 'file') {
      const idx = await getFileIndex();
      built = idx.map((f) => ({
        label: f.rel,
        sub: '',
        run: () => LUM.editor.openPath(f.path)
      }));
    } else if (mode === 'symbol') {
      built = collectSymbols();
    } else if (mode === 'word') {
      built = collectLines();
    } else if (mode === 'line') {
      built = []; // handled specially
    }
    // Only publish if a newer open() hasn't superseded this one (a slow file
    // walk must not overwrite the command list the user switched to).
    if (gen != null && gen !== openSeq) return;
    items = built;
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

  // Control-flow / non-declaration words that look like `name(...) {` but are not
  // symbols. Keeps Goto Symbol from listing `if`, `for`, `while`, `switch`, …
  const NOT_SYMBOL = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'do',
    'try', 'return', 'function', 'class', 'const', 'let', 'var', 'async', 'await',
    'with', 'case', 'new', 'typeof', 'delete', 'void', 'in', 'of']);

  function collectSymbols() {
    const ed = LUM.editor.activeEditor();
    const model = ed && ed.getModel();
    if (!model) return [];
    // Lightweight symbol scan: functions, classes, headings, etc.
    const out = [];
    const lines = model.getLinesContent();
    // 1) declaration keyword + name; 2) `name(args) {` method-style; 3) markdown heading
    const re = /(?:^|\s)(?:export\s+)?(?:default\s+)?(?:function\*?|class|def|interface|type|struct|enum|func|fn)\s+([A-Za-z_$][\w$]*)|^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$|^(#{1,6})\s+(.+)$/;
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      // Skip obvious comment lines to avoid indexing commented-out code.
      if (/^(\/\/|\*|#(?!#*\s))/.test(trimmed) && !/^#{1,6}\s/.test(trimmed)) return;
      const m = line.match(re);
      if (m) {
        const name = m[1] || m[2] || (m[4] ? m[4].trim() : null);
        if (name && name.length > 1 && !NOT_SYMBOL.has(name)) {
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
    curSuffix = suffix;

    // A bare suffix with no file part (":40", "@sym", "#word") targets the
    // CURRENT file directly — Sublime jumps within the open file, not a random one.
    if (suffix && !query.trim()) {
      renderSuffixOnCurrent(suffix);
      return;
    }

    const scored = [];
    for (const it of items) {
      const res = scoreItem(query.trim(), it);
      if (res || !query.trim()) {
        scored.push({ it, score: res ? res.score : 0, positions: res ? res.positions : [] });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.slice(0, 500);
    active = 0;
    renderList();
  }

  // Bare "@"/"#"/":" in file mode → operate on the current file/editor.
  function renderSuffixOnCurrent(suffix) {
    if (suffix.type === 'line') { renderLineMode(suffix.val); return; }
    const src = suffix.type === 'symbol' ? collectSymbols() : collectLines();
    const q = (suffix.val || '').trim();
    const scored = [];
    for (const it of src) {
      const res = q ? fuzzy(q, it.label) : { score: 0, positions: [] };
      if (res) scored.push({ it, score: res.score, positions: res.positions });
    }
    scored.sort((a, b) => b.score - a.score);
    curSuffix = null; // items already run gotoLine directly
    filtered = scored.slice(0, 500);
    active = 0;
    renderList();
  }

  function renderLineMode(raw) {
    // Accept "120" and "120:8" (line:col); ignore any other characters.
    const mm = String(raw).match(/(\d+)(?:\s*[:,]\s*(\d+))?/);
    const n = mm ? parseInt(mm[1], 10) : NaN;
    const col = mm && mm[2] ? parseInt(mm[2], 10) : 1;
    const model = LUM.editor.activeEditor() && LUM.editor.activeEditor().getModel();
    const max = model ? model.getLineCount() : 1;
    const target = isNaN(n) ? NaN : Math.max(1, Math.min(n, max));
    listEl().innerHTML = `<li class="palette-item active"><span class="pi-main">Go to line ${
      isNaN(target) ? '…' : target
    }${col > 1 ? ', col ' + col : ''} (of ${max})</span></li>`;
    filtered = [{
      it: { run: () => { if (!isNaN(target)) gotoLine(target, col); } },
      positions: []
    }];
    active = 0;
  }

  function renderList() {
    const ul = listEl();
    ul.innerHTML = '';
    filtered.forEach((row, i) => {
      const li = document.createElement('li');
      li.className = 'palette-item' + (i === active ? ' active' : '');
      const main = highlight(row.it.label || '', row.positions);
      li.innerHTML =
        `<span class="pi-main">${main}${row.it.sub ? ` <span class="pi-sub">${escapeHtml(row.it.sub)}</span>` : ''}</span>` +
        (row.it.key ? `<span class="pi-key">${escapeHtml(row.it.key)}</span>` : '');
      li.addEventListener('click', () => choose(i));
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

  async function choose(i) {
    if (i != null) active = i;
    const row = filtered[active];
    if (!row) { close(); return; }
    const suffix = curSuffix; // captured before close() clears state
    const run = row.it.run;
    close();
    if (run) await run();
    // apply :line / @symbol / #word suffix after opening the chosen file
    if (suffix) {
      setTimeout(() => {
        if (suffix.type === 'line') {
          const mm = String(suffix.val).match(/(\d+)(?:\s*[:,]\s*(\d+))?/);
          if (mm) gotoLine(Math.max(1, parseInt(mm[1], 10)), mm[2] ? parseInt(mm[2], 10) : 1);
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
