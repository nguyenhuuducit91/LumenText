'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Editor core: buffers (open documents), panes (split editors), tabs, IO.
// ===========================================================================
LUM.editor = (function () {
  /** @typedef {{id:number, name:string, path:?string, model:any, dirty:boolean, mtimeMs:?number, language:string}} Buffer */

  let bufferSeq = 1;
  /** @type {Map<number, Buffer>} */
  const buffers = new Map();
  /** buffer display order for the tab bar */
  const order = [];
  /** recently closed files, for Reopen Closed File: {path, line, col, index} */
  const closedStack = [];

  /** @type {{editor:any, host:HTMLElement, currentId:?number, viewState:Map<number,any>}[]} */
  const panes = [];
  let activePane = 0;

  let langByExt = null;

  // ---- language detection -------------------------------------------------
  function buildLangMap() {
    langByExt = new Map();
    for (const l of monaco.languages.getLanguages()) {
      (l.extensions || []).forEach((ext) => langByExt.set(ext.toLowerCase(), l.id));
      (l.filenames || []).forEach((fn) => langByExt.set(fn.toLowerCase(), l.id));
    }
  }
  function detectLanguage(name) {
    if (!langByExt) buildLangMap();
    if (!name) return 'plaintext';
    const lower = name.toLowerCase();
    if (langByExt.has(lower)) return langByExt.get(lower);
    const dot = lower.lastIndexOf('.');
    const ext = dot >= 0 ? lower.slice(dot) : '';
    return langByExt.get(ext) || 'plaintext';
  }

  // ---- Monaco base options ------------------------------------------------
  function baseOptions() {
    const base = {
      theme: LUM.state ? LUM.state.theme : 'stp-mariana',
      lineHeight: 20,
      minimap: { enabled: true, renderCharacters: true, showSlider: 'mouseover', maxColumn: 80 },
      renderWhitespace: 'selection',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      cursorWidth: 2,
      smoothScrolling: true,
      multiCursorModifier: 'ctrlCmd',
      tabSize: 4,
      insertSpaces: true,
      // Sublime does NOT rainbow-colour bracket pairs; keep just the match highlight.
      bracketPairColorization: { enabled: false },
      guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
      autoClosingBrackets: 'languageDefined',
      renderLineHighlight: 'line', // ST highlights the line, not the whole gutter
      stickyScroll: { enabled: false }, // controlled by the sticky_scroll setting (see settings.js)
      scrollBeyondLastLine: true,
      wordWrap: 'off',
      glyphMargin: true, // bookmarks live here
      automaticLayout: true, // relayout on container resize (zen mode, splits, sidebar)
      scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
      fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim(),
      fontSize: 13,
      // Inline IME (fcitx) preedit is handled natively by Monaco's hidden
      // textarea; no popup, the composition string is drawn at the caret.
      fixedOverflowWidgets: true
    };
    // Live user settings win over the built-in defaults.
    if (LUM.settings && LUM.settings.editorOptions) Object.assign(base, LUM.settings.editorOptions());
    return base;
  }

  // ---- pane management ----------------------------------------------------
  function createPane(host) {
    const editor = monaco.editor.create(host, baseOptions());
    const pane = { editor, host, currentId: null, viewState: new Map() };
    const idx = panes.length;
    editor.onDidChangeCursorPosition(() => {
      if (activePane === idx) updateStatus();
    });
    editor.onDidFocusEditorText(() => {
      setActivePane(idx);
    });
    panes.push(pane);
    return pane;
  }

  function setActivePane(idx) {
    if (idx < 0 || idx >= panes.length) return;
    activePane = idx;
    document.querySelectorAll('.pane').forEach((p, i) =>
      p.classList.toggle('active-pane', i === idx)
    );
    renderTabs();
    updateStatus();
  }

  function activeEditor() {
    return panes[activePane] && panes[activePane].editor;
  }
  function activeBuffer() {
    const p = panes[activePane];
    return p && p.currentId != null ? buffers.get(p.currentId) : null;
  }

  // ---- buffers ------------------------------------------------------------
  // Human labels for the encodings the main process can emit (see src/main/encoding.js).
  const ENC_LABELS = { utf8: 'UTF-8', utf8bom: 'UTF-8 BOM', utf16le: 'UTF-16 LE', utf16be: 'UTF-16 BE', latin1: 'Latin-1' };
  function encLabel(enc) { return ENC_LABELS[enc] || 'UTF-8'; }

  function makeBuffer(name, content, language, filePath, mtimeMs, encoding) {
    const id = bufferSeq++;
    const model = monaco.editor.createModel(content, language || detectLanguage(name));
    const buf = { id, name, kind: 'text', path: filePath || null, model, dirty: false, mtimeMs: mtimeMs || null, language: model.getLanguageId(), encoding: encoding || 'utf8' };
    model.onDidChangeContent(() => {
      if (!buf.dirty) {
        buf.dirty = true;
        buf.preview = false; // editing a preview tab makes it permanent (Sublime)
        renderTabs();
      }
      if (LUM.autosave) LUM.autosave.notify(buf);
      if (LUM.git) LUM.git.scheduleDiff();
      if (LUM.lsp) LUM.lsp.onChange(buf);
    });
    buffers.set(id, buf);
    order.push(id);
    if (LUM.lsp) LUM.lsp.onOpen(buf);
    return buf;
  }

  // A tab backed by the streaming Large-File viewer (no Monaco model).
  function makeLargeBuffer(name, filePath, lf) {
    const id = bufferSeq++;
    const buf = { id, name, kind: 'large', path: filePath, model: null, dirty: false, mtimeMs: null, language: 'plaintext', lf };
    buffers.set(id, buf);
    order.push(id);
    showBuffer(id);
    return buf;
  }

  // ---- tab MRU (Ctrl+Tab) -------------------------------------------------
  const mru = [];              // buffer ids, most-recently-active first
  let cyclingMru = false;      // suppress reshuffling while walking the MRU
  let mruTimer = null;
  function touchMru(id) {
    if (cyclingMru || id == null) return;
    const i = mru.indexOf(id);
    if (i >= 0) mru.splice(i, 1);
    mru.unshift(id);
  }
  function mruCycle(dir) {
    const live = mru.filter((id) => buffers.has(id));
    mru.length = 0; mru.push(...live);
    if (mru.length < 2) return;
    cyclingMru = true;
    const cur = panes[activePane] ? panes[activePane].currentId : mru[0];
    let idx = mru.indexOf(cur);
    if (idx < 0) idx = 0;
    idx = (idx + (dir < 0 ? -1 : 1) + mru.length) % mru.length;
    showBuffer(mru[idx]);
    clearTimeout(mruTimer);
    // Commit the landing tab to the front of the MRU shortly after cycling stops.
    mruTimer = setTimeout(() => {
      cyclingMru = false;
      touchMru(panes[activePane] ? panes[activePane].currentId : null);
    }, 700);
  }
  // Positional next/prev tab (Ctrl+PageDown / Ctrl+PageUp).
  function stepTab(dir) {
    if (order.length < 2) return;
    const cur = panes[activePane] ? panes[activePane].currentId : order[0];
    let i = order.indexOf(cur);
    if (i < 0) i = 0;
    i = (i + (dir < 0 ? -1 : 1) + order.length) % order.length;
    showBuffer(order[i]);
  }
  // Select a tab by 1-based index; index 9 selects the LAST tab (Sublime Alt+9).
  function selectTabByIndex(n) {
    if (!order.length) return;
    const id = n >= 9 ? order[order.length - 1] : order[Math.min(n, order.length) - 1];
    if (id != null) showBuffer(id);
  }

  function showBuffer(id, paneIdx = activePane) {
    const pane = panes[paneIdx];
    const buf = buffers.get(id);
    if (!pane || !buf) return;
    if (paneIdx === activePane) touchMru(id);
    // save current view state (text buffers only)
    if (pane.currentId != null && pane.currentId !== id) {
      const prev = buffers.get(pane.currentId);
      if (prev && prev.kind === 'text') pane.viewState.set(pane.currentId, pane.editor.saveViewState());
    }
    pane.currentId = id;

    if (buf.kind === 'large') {
      // Hand the pane region over to the streaming viewer. Detach the previous
      // text model so editor actions (Format, Sort, Paste-and-Indent, …) can't
      // silently mutate a hidden buffer while a large file is shown.
      pane.editor.setModel(null);
      LUM.largefile.show(buf.lf);
      renderTabs();
      updateStatus();
      if (LUM.find && LUM.find.isOpen && LUM.find.isOpen()) LUM.find.refresh();
      return;
    }

    LUM.largefile.hide();
    pane.editor.setModel(buf.model);
    const vs = pane.viewState.get(id);
    if (vs) pane.editor.restoreViewState(vs);
    pane.editor.focus();
    renderTabs();
    updateStatus();
    if (LUM.git) LUM.git.scheduleDiff();
    if (LUM.find && LUM.find.isOpen && LUM.find.isOpen()) LUM.find.refresh();
  }

  function newFile() {
    const n = order.filter((id) => !buffers.get(id).path).length + 1;
    const buf = makeBuffer('untitled-' + n, '', 'plaintext', null);
    showBuffer(buf.id);
    return buf;
  }

  // The single preview (italic) tab, if any — Sublime keeps at most one.
  function currentPreviewId() {
    for (const id of order) if (buffers.get(id).preview) return id;
    return null;
  }

  // opts.preview: open as a transient preview tab (single click). A second
  // open of the same file, or an explicit non-preview open, makes it permanent.
  // Public entry: dedupe concurrent opens of the same path. A physical
  // double-click fires click,click,dblclick — without this guard each pass runs
  // openPath's "already open?" check before the async read resolves, so several
  // buffers get created for one file. We collapse them onto one in-flight open,
  // and if any caller wants a permanent (non-preview) tab, the result is promoted.
  const inflightOpens = new Map(); // path -> { promise, permanent }
  function openPath(filePath, opts = {}) {
    const preview = !!(opts && opts.preview);
    const existing = inflightOpens.get(filePath);
    if (existing) {
      if (!preview) existing.permanent = true;
      return existing.promise;
    }
    const entry = { permanent: !preview };
    entry.promise = (async () => {
      const buf = await _openPath(filePath, opts);
      if (buf && entry.permanent && buf.preview) { buf.preview = false; renderTabs(); }
      return buf;
    })().finally(() => inflightOpens.delete(filePath));
    inflightOpens.set(filePath, entry);
    return entry.promise;
  }

  async function _openPath(filePath, opts = {}) {
    const preview = !!opts.preview;
    if (LUM.nav) LUM.nav.record(); // remember where we were before navigating
    // already open?
    for (const id of order) {
      const b = buffers.get(id);
      if (b.path === filePath) {
        if (!preview && b.preview) { b.preview = false; renderTabs(); } // promote
        showBuffer(id);
        return b;
      }
    }
    // A new preview replaces the existing preview tab, in its place.
    const replaceId = preview ? currentPreviewId() : null;
    try {
      const st = await window.lumenText.stat(filePath);
      if (st.exists && st.large) {
        // Route huge files to the streaming viewer instead of a Monaco model.
        await LUM.largefile.openInTab(filePath);
        const lb = activeBuffer();
        if (lb && preview) lb.preview = true;
        if (replaceId != null && lb && replaceId !== lb.id) await closeBuffer(replaceId);
        return lb;
      }
      const { content, mtimeMs, encoding } = await window.lumenText.readFile(filePath);
      const name = window.lumenText.basename(filePath);
      const buf = makeBuffer(name, content, detectLanguage(name), filePath, mtimeMs, encoding);
      if (preview) buf.preview = true;
      if (replaceId != null && replaceId !== buf.id) {
        // Slot the new tab where the old preview was, then discard the old one.
        const idx = order.indexOf(replaceId);
        order.splice(order.indexOf(buf.id), 1);
        order.splice(idx, 0, buf.id);
        showBuffer(buf.id);
        await closeBuffer(replaceId); // preview tabs are clean → no save prompt
      } else {
        showBuffer(buf.id);
      }
      return buf;
    } catch (e) {
      LUM.app.toast('Cannot open: ' + filePath);
      console.error(e);
    }
  }

  async function saveBuffer(buf) {
    buf = buf || activeBuffer();
    if (!buf) return;
    if (!buf.path) return saveBufferAs(buf);
    const { mtimeMs } = await window.lumenText.writeFile(buf.path, buf.model.getValue(), buf.encoding);
    buf.mtimeMs = mtimeMs;
    buf.dirty = false;
    renderTabs();
    LUM.app.toast('Saved ' + buf.name);
    if (LUM.settings) LUM.settings.reloadIfSettingsFile(buf.path);
    if (LUM.keymap) LUM.keymap.reloadIfKeymapFile(buf.path);
    if (LUM.snippets) LUM.snippets.reloadIfSnippetFile(buf.path);
    if (LUM.git) LUM.git.refresh();
    if (LUM.symbols) LUM.symbols.invalidate();
  }

  async function saveBufferAs(buf) {
    buf = buf || activeBuffer();
    if (!buf) return;
    const suggested = buf.path || (LUM.sidebar.root ? window.lumenText.join(LUM.sidebar.root, buf.name) : buf.name);
    const target = await window.lumenText.saveFileDialog(suggested);
    if (!target) return;
    await window.lumenText.writeFile(target, buf.model.getValue(), buf.encoding);
    buf.path = target;
    buf.name = window.lumenText.basename(target);
    const lang = detectLanguage(buf.name);
    monaco.editor.setModelLanguage(buf.model, lang);
    buf.language = lang;
    buf.dirty = false;
    const st = await window.lumenText.stat(target);
    buf.mtimeMs = st.mtimeMs;
    renderTabs();
    updateStatus();
    if (LUM.sidebar.root && target.startsWith(LUM.sidebar.root)) LUM.sidebar.refresh();
    LUM.app.toast('Saved ' + buf.name);
  }

  async function saveAll() {
    for (const id of order) {
      const b = buffers.get(id);
      if (b.dirty && b.path) await saveBuffer(b);
    }
  }

  async function closeBuffer(id) {
    id = id != null ? id : (activeBuffer() && activeBuffer().id);
    if (id == null) return;
    const buf = buffers.get(id);
    if (!buf) return;
    if (buf.dirty && buf.kind === 'text' && !buf.preview) {
      const choice = await LUM.dialog.confirm({
        message: `Save changes to "${buf.name}" before closing?`,
        detail: "Your changes will be lost if you don't save them.",
        buttons: [
          { label: 'Save', value: 'save' },
          { label: "Don't Save", value: 'discard', kind: 'danger' },
          { label: 'Cancel', value: 'cancel' }
        ],
        default: 'save',
        cancel: 'cancel'
      });
      if (choice === 'cancel') return;
      if (choice === 'save') { await saveBuffer(buf); if (buf.dirty) return; } // save-as cancelled
    }

    // remember path-backed closes so they can be reopened (Ctrl+Shift+T) with
    // their tab position and caret restored, not just re-opened at the end.
    if (buf.path && !buf.preview) {
      const dup = closedStack.findIndex((e) => e.path === buf.path);
      if (dup !== -1) closedStack.splice(dup, 1); // dedupe: most-recent wins
      const pos = cursorOf(id);
      closedStack.push({
        path: buf.path,
        index: order.indexOf(id),
        line: pos ? pos.lineNumber : null,
        col: pos ? pos.column : null
      });
      if (closedStack.length > 50) closedStack.shift();
    }

    // pick which tab becomes active in any pane that was showing this one
    const neighbor = LUM.tabutil.pickNeighbor(order, id);
    order.splice(order.indexOf(id), 1);

    if (buf.kind === 'large') {
      LUM.largefile.hide();
      window.lumenText.lfClose(buf.lf.id);
    } else if (buf.model) {
      if (LUM.lsp && LUM.lsp.onClose) LUM.lsp.onClose(buf); // notify LSP before disposal
      if (LUM.bookmarks && LUM.bookmarks.dispose) LUM.bookmarks.dispose(id);
      buf.model.dispose();
    }
    buffers.delete(id);

    panes.forEach((p, i) => {
      p.viewState.delete(id);
      if (p.currentId === id) {
        p.currentId = null;
        if (neighbor != null) showBuffer(neighbor, i);
      }
    });
    if (order.length === 0) newFile();
    renderTabs();
    updateStatus();
  }

  // Reflect a filesystem rename/move into any open buffer. Handles both a file
  // being renamed and a parent folder being renamed (path-prefix match).
  function applyPathChange(oldPath, newPath) {
    const sep = window.lumenText.sep;
    let changed = false;
    for (const id of order) {
      const b = buffers.get(id);
      if (!b || !b.path) continue;
      let np = null;
      if (b.path === oldPath) np = newPath;
      else if (b.path.startsWith(oldPath + sep)) np = newPath + b.path.slice(oldPath.length);
      if (np == null) continue;
      b.path = np;
      b.name = window.lumenText.basename(np);
      b.deletedOnDisk = false;
      if (b.model) {
        const lang = detectLanguage(b.name);
        monaco.editor.setModelLanguage(b.model, lang);
        b.language = lang;
      }
      changed = true;
    }
    if (changed) { renderTabs(); updateStatus(); }
  }

  // Mark buffers under a deleted path as gone-on-disk (kept open, now unsaved).
  function markPathDeleted(delPath) {
    const sep = window.lumenText.sep;
    let changed = false;
    for (const id of order) {
      const b = buffers.get(id);
      if (!b || !b.path) continue;
      if (b.path === delPath || b.path.startsWith(delPath + sep)) {
        b.deletedOnDisk = true;
        b.dirty = true; // so the content can be re-saved
        changed = true;
      }
    }
    if (changed) { renderTabs(); updateStatus(); }
  }

  // Bulk close helpers used by the tab context menu / commands.
  async function closeOthers(keepId) {
    for (const id of order.slice()) if (id !== keepId && !buffers.get(id).pinned) await closeBuffer(id);
  }
  async function closeToRight(fromId) {
    const start = order.indexOf(fromId);
    for (const id of order.slice(start + 1)) if (!buffers.get(id).pinned) await closeBuffer(id);
  }
  async function closeSaved() {
    for (const id of order.slice()) { const b = buffers.get(id); if (b && !b.dirty && !b.pinned) await closeBuffer(id); }
  }
  async function closeAll() {
    for (const id of order.slice()) if (!buffers.get(id).pinned) await closeBuffer(id);
  }

  // ---- tabs ---------------------------------------------------------------
  function computeLabels() {
    // disambiguate duplicate basenames among path-backed buffers (VSCode style)
    const pathIds = order.filter((id) => buffers.get(id).path);
    const dis = LUM.tabutil.disambiguateLabels(pathIds.map((id) => buffers.get(id).path));
    const map = new Map();
    pathIds.forEach((id, i) => map.set(id, dis[i]));
    return map;
  }

  let dragId = null;
  let lastScrolledId = null; // active tab last scrolled into view (avoid yanking the strip)
  function renderTabs() {
    const bar = document.getElementById('tabbar');
    const curId = panes[activePane] ? panes[activePane].currentId : null;
    const labels = computeLabels();
    bar.innerHTML = '';
    for (const id of order) {
      const b = buffers.get(id);
      const gitCls = (b.path && LUM.git && LUM.git.statusClassFor) ? LUM.git.statusClassFor(b.path) : null;
      const el = document.createElement('div');
      el.className = 'tab' + (id === curId ? ' active' : '') + (b.dirty ? ' dirty' : '') +
        (b.pinned ? ' pinned' : '') + (b.preview ? ' preview' : '') + (gitCls ? ' ' + gitCls : '');
      el.title = (b.path || b.name) + (b.dirty ? '  •  Modified' : '');
      el.draggable = true;
      // Sublime Text shows only the filename in the tab (no file-type icon).
      const name = labels.get(id) || b.name;
      el.innerHTML =
        `<span class="tab-name">${escapeHtml(name)}</span>` +
        `<span class="tab-close" title="Close">✕</span>`;
      el.addEventListener('mousedown', (e) => {
        if (e.button === 1) { e.preventDefault(); closeBuffer(id); return; }
        if (e.target.classList.contains('tab-close')) return;
        // Don't re-render the strip when the tab is already active — otherwise the
        // first mousedown of a double-click destroys the node the gesture is on,
        // breaking dblclick-to-promote and flickering the bar.
        if (id !== curId) showBuffer(id);
      });
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeBuffer(id);
      });
      // Double-clicking a preview (italic) tab makes it permanent, like Sublime.
      el.addEventListener('dblclick', (e) => {
        if (e.target.classList.contains('tab-close')) return;
        const b = buffers.get(id);
        if (b && b.preview) { b.preview = false; renderTabs(); }
      });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showBuffer(id);
        LUM.tabmenu && LUM.tabmenu(id, e.clientX, e.clientY);
      });
      // drag reorder
      el.addEventListener('dragstart', (e) => {
        dragId = id;
        el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        dragId = null;
        el.classList.remove('dragging');
        bar.querySelectorAll('.tab').forEach((t) => t.classList.remove('drop-before', 'drop-after'));
      });
      el.addEventListener('dragover', (e) => {
        if (dragId == null || dragId === id) return;
        e.preventDefault();
        const r = el.getBoundingClientRect();
        const after = e.clientX > r.left + r.width / 2;
        bar.querySelectorAll('.tab').forEach((t) => t.classList.remove('drop-before', 'drop-after'));
        el.classList.add(after ? 'drop-after' : 'drop-before');
      });
      el.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragId == null || dragId === id) return;
        const r = el.getBoundingClientRect();
        const after = e.clientX > r.left + r.width / 2;
        let target = order.indexOf(id);
        // index within the array AFTER removing the dragged tab
        const fromPos = order.indexOf(dragId);
        if (after) target += 1;
        if (fromPos < target) target -= 1;
        const next = LUM.tabutil.reorder(order, dragId, target);
        order.length = 0; order.push(...next);
        dragId = null;
        renderTabs();
      });
      bar.appendChild(el);
    }
    // Let the mouse wheel scroll the tab strip horizontally (attach once), so a
    // full row of tabs can be scrolled instead of squeezing the names — Sublime.
    if (!bar.dataset.wheelBound) {
      bar.dataset.wheelBound = '1';
      bar.addEventListener('wheel', (e) => {
        if (e.deltaX !== 0) return; // trackpads already scroll horizontally
        if (bar.scrollWidth <= bar.clientWidth) return;
        e.preventDefault();
        bar.scrollLeft += (e.deltaY || 0);
      }, { passive: false });
    }
    // Scroll the active tab into view only when it actually changed — otherwise
    // background re-renders (autosave, pin, edit) would yank the strip back while
    // the user is scrolling through distant tabs.
    if (curId !== lastScrolledId) {
      lastScrolledId = curId;
      const activeEl = bar.querySelector('.tab.active');
      if (activeEl) activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (LUM.app && LUM.app.saveSessionSoon) LUM.app.saveSessionSoon();
  }

  function updateStatus() {
    const buf = activeBuffer();
    const ed = activeEditor();
    const left = document.getElementById('status-left');
    const lang = document.getElementById('status-lang');
    const pos = document.getElementById('status-pos');
    const indent = document.getElementById('status-indent');
    if (buf) {
      left.textContent = buf.path || buf.name;
      lang.textContent = languageLabel(buf.language);
    } else {
      left.textContent = '';
    }
    if (buf && buf.kind === 'large') {
      const lc = buf.lf.lineCount || 0;
      pos.textContent = `${lc.toLocaleString()} lines`;
      lang.textContent = 'Large File';
      indent.textContent = buf.lf.indexed ? 'Indexed' : 'Indexing…';
      return;
    }
    const eol = document.getElementById('status-eol');
    const encEl = document.getElementById('status-enc');
    if (encEl && buf) encEl.textContent = encLabel(buf.encoding);
    if (ed && ed.getPosition) {
      const p = ed.getPosition();
      const sel = ed.getSelections() || [];
      const selCount = sel.reduce((n, s) => n + (s.isEmpty() ? 0 : 1), 0);
      pos.textContent = `Ln ${p.line || p.lineNumber}, Col ${p.column}` + (selCount > 1 ? ` (${selCount} sel)` : '');
      const model = ed.getModel();
      const opts = model ? model.getOptions() : { insertSpaces: true, tabSize: 4 };
      indent.textContent = (opts.insertSpaces ? 'Spaces: ' : 'Tab Size: ') + opts.tabSize;
      if (eol && model) eol.textContent = model.getEOL() === '\r\n' ? 'CRLF' : 'LF';
    }
  }

  function setEOL(kind) {
    const buf = activeBuffer();
    if (!buf || !buf.model) return;
    // Monaco models only carry LF or CRLF; CR (classic Mac) is normalised to LF.
    const seq = kind === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF;
    buf.model.setEOL(seq);
    updateStatus();
    LUM.app.toast('Line endings: ' + kind);
  }

  // Set the syntax (language) of the active buffer — powers the View > Syntax menu.
  function setLanguage(langId) {
    if (!langId) return;
    const buf = activeBuffer();
    if (!buf || !buf.model) return;
    monaco.editor.setModelLanguage(buf.model, langId);
    buf.language = langId;
    updateStatus();
    if (LUM.lsp) LUM.lsp.onOpen(buf);
    LUM.app.toast('Syntax: ' + languageLabel(langId));
  }

  // Indentation controls for the View > Indentation menu.
  function setTabWidth(n) {
    if (!n) return;
    const buf = activeBuffer();
    if (!buf || !buf.model) return;
    buf.model.updateOptions({ tabSize: n });
    updateStatus();
    LUM.app.toast('Tab width: ' + n);
  }
  function toggleInsertSpaces() {
    const buf = activeBuffer();
    if (!buf || !buf.model) return;
    const cur = buf.model.getOptions().insertSpaces;
    buf.model.updateOptions({ insertSpaces: !cur });
    updateStatus();
    LUM.app.toast(!cur ? 'Indent using spaces' : 'Indent using tabs');
  }

  // Reload the active buffer from disk, discarding unsaved changes.
  async function revertActive() {
    const buf = activeBuffer();
    if (!buf || !buf.path || buf.kind !== 'text') return;
    try {
      const { content, mtimeMs } = await window.lumenText.readFile(buf.path, buf.encoding);
      const ed = activeEditor();
      const vs = ed && ed.saveViewState();
      buf.model.setValue(content);
      buf.mtimeMs = mtimeMs;
      buf.dirty = false;
      if (ed && vs) ed.restoreViewState(vs);
      renderTabs();
      updateStatus();
      LUM.app.toast('Reverted ' + buf.name);
    } catch (e) {
      LUM.app.toast('Cannot revert: ' + buf.name);
    }
  }

  // The caret position of a buffer (from whichever pane shows it, or its saved
  // view state) — captured at close time so Reopen can restore it.
  function cursorOf(id) {
    for (const p of panes) {
      if (p.currentId === id && p.editor && p.editor.getPosition) return p.editor.getPosition();
      const vs = p.viewState.get(id);
      const cs = vs && vs.cursorState && vs.cursorState[0];
      if (cs && cs.position) return cs.position;
    }
    return null;
  }

  // Reload a buffer's content from disk, preserving the caret/scroll of any pane
  // showing it. onDidChangeContent flips dirty=true during setValue, so we clear
  // it afterwards.
  async function reloadFromDisk(b) {
    try {
      const { content, mtimeMs } = await window.lumenText.readFile(b.path, b.encoding);
      let ed = null, vs = null;
      for (const p of panes) if (p.currentId === b.id) { ed = p.editor; vs = ed.saveViewState(); }
      b.model.setValue(content);
      b.mtimeMs = mtimeMs;
      b.dirty = false;
      b.deletedOnDisk = false;
      if (ed && vs) ed.restoreViewState(vs);
      renderTabs();
      updateStatus();
      LUM.app.toast('Reloaded (changed on disk): ' + b.name);
    } catch { /* file vanished mid-reload; leave the buffer as-is */ }
  }

  // Detect files changed/deleted outside the app (called when the window regains
  // focus). Clean buffers reload silently; dirty buffers prompt so edits are
  // never silently lost or silently overwritten.
  let checkingExternal = false;
  async function checkExternalChanges() {
    if (checkingExternal) return;
    checkingExternal = true;
    try {
      for (const id of order.slice()) {
        const b = buffers.get(id);
        if (!b || !b.path || b.kind !== 'text') continue;
        let st;
        try { st = await window.lumenText.stat(b.path); } catch { continue; }
        if (!st.exists) {
          if (!b.deletedOnDisk) { b.deletedOnDisk = true; b.dirty = true; renderTabs(); updateStatus(); }
          continue;
        }
        if (b.deletedOnDisk) { b.deletedOnDisk = false; renderTabs(); }
        if (b.mtimeMs == null || st.mtimeMs == null || st.mtimeMs <= b.mtimeMs) continue;
        if (!b.dirty) {
          await reloadFromDisk(b);
        } else {
          const choice = await LUM.dialog.confirm({
            message: `"${b.name}" changed on disk.`,
            detail: 'It also has unsaved changes here. Reload from disk (discarding your changes) or keep your version?',
            buttons: [
              { label: 'Reload', value: 'reload', kind: 'danger' },
              { label: 'Keep Mine', value: 'keep' }
            ],
            default: 'keep',
            cancel: 'keep'
          });
          if (choice === 'reload') await reloadFromDisk(b);
          else b.mtimeMs = st.mtimeMs; // accept the disk mtime so we stop re-prompting
        }
      }
    } finally {
      checkingExternal = false;
    }
  }

  // The encodings offered in the Reopen/Save-with-Encoding pickers.
  function encodings() { return Object.keys(ENC_LABELS).map((id) => ({ id, label: ENC_LABELS[id] })); }

  // Re-read the active file, forcing a specific encoding (fixes a mis-detected
  // file — e.g. a Latin-1 file read as UTF-8). Discards unsaved changes.
  async function reopenWithEncoding(enc) {
    const buf = activeBuffer();
    if (!buf || !buf.path || buf.kind !== 'text') return;
    try {
      const { content, mtimeMs } = await window.lumenText.readFile(buf.path, enc);
      const ed = activeEditor();
      const vs = ed && ed.saveViewState();
      buf.model.setValue(content);
      buf.encoding = enc;
      buf.mtimeMs = mtimeMs;
      buf.dirty = false;
      if (ed && vs) ed.restoreViewState(vs);
      renderTabs();
      updateStatus();
      LUM.app.toast('Reopened as ' + encLabel(enc));
    } catch (e) {
      LUM.app.toast('Cannot reopen: ' + buf.name);
    }
  }

  // Set the active buffer's encoding and write it out with that encoding.
  async function saveWithEncoding(enc) {
    const buf = activeBuffer();
    if (!buf || buf.kind !== 'text') return;
    buf.encoding = enc;
    await saveBuffer(buf); // saveBuffer/saveBufferAs write with buf.encoding
    updateStatus();
  }

  // Reopen the most recently closed path-backed file (Sublime's Ctrl+Shift+T),
  // restoring its tab position within the strip and the caret line/column.
  async function reopenClosed() {
    while (closedStack.length) {
      const info = closedStack.pop();
      if (order.some((id) => buffers.get(id).path === info.path)) continue; // already reopened
      const exists = await window.lumenText.stat(info.path).then((s) => s.exists).catch(() => false);
      if (!exists) continue;
      const buf = await openPath(info.path);
      if (!buf) continue;
      // put the tab back where it was in the strip
      if (info.index != null) {
        const cur = order.indexOf(buf.id);
        if (cur !== -1) {
          order.splice(cur, 1);
          order.splice(Math.min(info.index, order.length), 0, buf.id);
          renderTabs();
        }
      }
      // restore the caret
      if (info.line && buf.kind === 'text') {
        const ed = activeEditor();
        if (ed && ed.setPosition) {
          ed.setPosition({ lineNumber: info.line, column: info.col || 1 });
          ed.revealLineInCenter(info.line);
          ed.focus();
        }
      }
      return buf;
    }
    LUM.app.toast('No recently closed files');
  }

  function languageLabel(id) {
    const l = monaco.languages.getLanguages().find((x) => x.id === id);
    return (l && (l.aliases && l.aliases[0])) || id || 'Plain Text';
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ---- split panes --------------------------------------------------------
  function setLayout(count) {
    const container = document.getElementById('editors');
    const cur = panes.length;
    if (count === cur) return;
    if (count > cur) {
      for (let i = cur; i < count; i++) {
        const paneEl = document.createElement('div');
        paneEl.className = 'pane';
        paneEl.dataset.pane = i;
        const hostEl = document.createElement('div');
        hostEl.className = 'editor-host';
        hostEl.id = 'editor-' + i;
        paneEl.appendChild(hostEl);
        container.appendChild(paneEl);
        const pane = createPane(hostEl);
        const showId = (panes[0] && panes[0].currentId) || order[0];
        if (showId != null) showBuffer(showId, i);
      }
    } else {
      for (let i = cur - 1; i >= count; i--) {
        const pane = panes.pop();
        pane.editor.dispose();
        pane.host.parentElement.remove();
      }
      if (activePane >= count) setActivePane(count - 1);
    }
    layout();
    if (LUM.invisibles) LUM.invisibles.reapply(); // keep Show-Symbol toggles on new panes
  }

  function layout() {
    panes.forEach((p) => p.editor.layout());
  }

  function setTheme(theme) {
    monaco.editor.setTheme(theme);
  }

  return {
    createPane, panes, get activePane() { return activePane; }, setActivePane,
    activeEditor, activeBuffer, buffers, order,
    newFile, openPath, saveBuffer, saveBufferAs, saveAll, closeBuffer,
    closeOthers, closeToRight, closeSaved, closeAll,
    applyPathChange, markPathDeleted,
    showBuffer, makeLargeBuffer, renderTabs, updateStatus, detectLanguage, setEOL,
    setLanguage, setTabWidth, toggleInsertSpaces, revertActive, reopenClosed,
    setLayout, layout, setTheme, languageLabel,
    mruCycle, stepTab, selectTabByIndex,
    encodings, reopenWithEncoding, saveWithEncoding, checkExternalChanges
  };
})();
