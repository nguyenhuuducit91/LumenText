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
      stickyScroll: { enabled: true },
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
  function makeBuffer(name, content, language, filePath, mtimeMs) {
    const id = bufferSeq++;
    const model = monaco.editor.createModel(content, language || detectLanguage(name));
    const buf = { id, name, kind: 'text', path: filePath || null, model, dirty: false, mtimeMs: mtimeMs || null, language: model.getLanguageId() };
    model.onDidChangeContent(() => {
      if (!buf.dirty) {
        buf.dirty = true;
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

  function showBuffer(id, paneIdx = activePane) {
    const pane = panes[paneIdx];
    const buf = buffers.get(id);
    if (!pane || !buf) return;
    // save current view state (text buffers only)
    if (pane.currentId != null && pane.currentId !== id) {
      const prev = buffers.get(pane.currentId);
      if (prev && prev.kind === 'text') pane.viewState.set(pane.currentId, pane.editor.saveViewState());
    }
    pane.currentId = id;

    if (buf.kind === 'large') {
      // Hand the pane region over to the streaming viewer.
      LUM.largefile.show(buf.lf);
      renderTabs();
      updateStatus();
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
  }

  function newFile() {
    const n = order.filter((id) => !buffers.get(id).path).length + 1;
    const buf = makeBuffer('untitled-' + n, '', 'plaintext', null);
    showBuffer(buf.id);
    return buf;
  }

  async function openPath(filePath) {
    if (LUM.nav) LUM.nav.record(); // remember where we were before navigating
    // already open?
    for (const id of order) {
      const b = buffers.get(id);
      if (b.path === filePath) {
        showBuffer(id);
        return b;
      }
    }
    try {
      const st = await window.lumen.stat(filePath);
      if (st.exists && st.large) {
        // Route huge files to the streaming viewer instead of a Monaco model.
        await LUM.largefile.openInTab(filePath);
        return activeBuffer();
      }
      const { content, mtimeMs } = await window.lumen.readFile(filePath);
      const name = window.lumen.basename(filePath);
      const buf = makeBuffer(name, content, detectLanguage(name), filePath, mtimeMs);
      showBuffer(buf.id);
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
    const { mtimeMs } = await window.lumen.writeFile(buf.path, buf.model.getValue());
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
    const suggested = buf.path || (LUM.sidebar.root ? window.lumen.join(LUM.sidebar.root, buf.name) : buf.name);
    const target = await window.lumen.saveFileDialog(suggested);
    if (!target) return;
    await window.lumen.writeFile(target, buf.model.getValue());
    buf.path = target;
    buf.name = window.lumen.basename(target);
    const lang = detectLanguage(buf.name);
    monaco.editor.setModelLanguage(buf.model, lang);
    buf.language = lang;
    buf.dirty = false;
    const st = await window.lumen.stat(target);
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

    // pick which tab becomes active in any pane that was showing this one
    const neighbor = LUM.tabutil.pickNeighbor(order, id);
    order.splice(order.indexOf(id), 1);

    if (buf.kind === 'large') {
      LUM.largefile.hide();
      window.lumen.lfClose(buf.lf.id);
    } else if (buf.model) {
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
    const sep = window.lumen.sep;
    let changed = false;
    for (const id of order) {
      const b = buffers.get(id);
      if (!b || !b.path) continue;
      let np = null;
      if (b.path === oldPath) np = newPath;
      else if (b.path.startsWith(oldPath + sep)) np = newPath + b.path.slice(oldPath.length);
      if (np == null) continue;
      b.path = np;
      b.name = window.lumen.basename(np);
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
    const sep = window.lumen.sep;
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
      const ico = LUM.icons ? LUM.icons.file(b.name) : '';
      const name = labels.get(id) || b.name;
      el.innerHTML =
        `<span class="tab-ico">${ico}</span>` +
        `<span class="tab-name">${escapeHtml(name)}</span>` +
        `<span class="tab-close" title="Close">✕</span>`;
      el.addEventListener('mousedown', (e) => {
        if (e.button === 1) { e.preventDefault(); closeBuffer(id); return; }
        if (e.target.classList.contains('tab-close')) return;
        showBuffer(id);
      });
      el.querySelector('.tab-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeBuffer(id);
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
    buf.model.setEOL(kind === 'CRLF' ? monaco.editor.EndOfLineSequence.CRLF : monaco.editor.EndOfLineSequence.LF);
    updateStatus();
    LUM.app.toast('Line endings: ' + kind);
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
    setLayout, layout, setTheme, languageLabel
  };
})();
