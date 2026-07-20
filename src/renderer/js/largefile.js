'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Large-file viewer (renderer). Virtualised, read-only view over a file that
// is streamed from the main process — never loaded into a Monaco model.
//
// Scroll model: for files whose pixel height would exceed the browser's max
// element height, the scrollbar range is mapped proportionally onto the line
// range (like klogg / VS Code's large-file mode). Only the visible screenful
// of lines is ever fetched and rendered.
// ===========================================================================
LUM.largefile = (function () {
  const LINE_H = 18;
  const MAX_PX = 15000000; // safe below browser element-height limits
  const OVERSCAN = 4;

  let el = null;          // { root, scroll, spacer, content, gutter, text, header }
  /** @type {?object} */
  let current = null;     // active large buffer's lf descriptor
  let fetchToken = 0;
  let cache = { start: -1, lines: [] };

  function build() {
    if (el) return el;
    const root = document.createElement('div');
    root.className = 'lfv hidden';
    root.innerHTML =
      '<div class="lfv-header"><span class="lfv-title"></span><span class="lfv-info"></span></div>' +
      '<div class="lfv-body">' +
      '  <div class="lfv-scroll"><div class="lfv-spacer"></div></div>' +
      '  <div class="lfv-content"><div class="lfv-gutter"></div><pre class="lfv-text"></pre></div>' +
      '</div>';
    document.getElementById('editors').appendChild(root);
    el = {
      root,
      header: root.querySelector('.lfv-header'),
      title: root.querySelector('.lfv-title'),
      info: root.querySelector('.lfv-info'),
      scroll: root.querySelector('.lfv-scroll'),
      spacer: root.querySelector('.lfv-spacer'),
      content: root.querySelector('.lfv-content'),
      gutter: root.querySelector('.lfv-gutter'),
      text: root.querySelector('.lfv-text')
    };
    let raf = 0;
    el.scroll.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        render();
      });
    });
    window.addEventListener('resize', () => { if (current) layout(); });
    return el;
  }

  function fmtSize(bytes) {
    if (bytes >= 1e9) return (bytes / 1e9).toFixed(2) + ' GB';
    if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB';
    if (bytes >= 1e3) return (bytes / 1e3).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  // Open a large file as a tab-backed viewer.
  async function openInTab(filePath) {
    build();
    const info = await window.lumenText.lfOpen(filePath); // { id, size, path }
    const lf = {
      id: info.id,
      path: filePath,
      size: info.size,
      lineCount: 0,
      indexed: false,
      scrollTop: 0
    };
    LUM.editor.makeLargeBuffer(window.lumenText.basename(filePath), filePath, lf);
  }

  function show(lf) {
    build();
    current = lf;
    cache = { start: -1, lines: [] };
    el.root.classList.remove('hidden');
    el.title.textContent = window.lumenText.basename(lf.path);
    layout();
    el.scroll.scrollTop = lf.scrollTop || 0;
    render();
  }

  function hide() {
    if (el) el.root.classList.add('hidden');
    current = null;
  }

  function layout() {
    if (!current) return;
    const total = Math.max(1, current.lineCount);
    const contentPx = total * LINE_H;
    el.spacer.style.height = Math.min(contentPx, MAX_PX) + 'px';
  }

  function viewportLines() {
    return Math.ceil(el.scroll.clientHeight / LINE_H) + OVERSCAN;
  }

  function firstVisibleLine() {
    const total = current.lineCount;
    const vis = viewportLines();
    const contentPx = total * LINE_H;
    const st = el.scroll.scrollTop;
    if (contentPx <= MAX_PX) {
      return { line: Math.floor(st / LINE_H), subpx: st - Math.floor(st / LINE_H) * LINE_H };
    }
    // clamped: map scrollbar range proportionally onto the line range
    const scrollable = Math.max(1, el.spacer.offsetHeight - el.scroll.clientHeight);
    const ratio = Math.min(1, st / scrollable);
    const line = Math.round(ratio * Math.max(0, total - vis + OVERSCAN));
    return { line, subpx: 0 };
  }

  async function render() {
    if (!current) return;
    current.scrollTop = el.scroll.scrollTop;
    const { line, subpx } = firstVisibleLine();
    const count = viewportLines();
    el.content.style.transform = `translateY(${-subpx}px)`;

    let lines = fromCache(line, count);
    if (!lines) {
      const token = ++fetchToken;
      lines = await window.lumenText.lfLines(current.id, line, count);
      if (token !== fetchToken || !current) return; // superseded
      cache = { start: line, lines };
    }
    paint(line, lines);
  }

  function fromCache(line, count) {
    if (cache.start < 0) return null;
    if (line >= cache.start && line + count <= cache.start + cache.lines.length) {
      return cache.lines.slice(line - cache.start, line - cache.start + count);
    }
    return null;
  }

  function esc(s) {
    return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function paint(firstLine, lines) {
    const total = current.lineCount;
    let gut = '';
    let txt = '';
    for (let i = 0; i < lines.length; i++) {
      const ln = firstLine + i + 1;
      if (ln > total) break;
      gut += ln + '\n';
      txt += esc(lines[i].replace(/\r$/, '')) + '\n';
    }
    el.gutter.textContent = gut;
    el.text.innerHTML = txt;
    updateInfo(firstLine);
  }

  function updateInfo(firstLine) {
    const lf = current;
    const status = lf.indexed ? 'Read-only' : 'Indexing…';
    el.info.textContent =
      `${fmtSize(lf.size)}  ·  ${lf.lineCount.toLocaleString()} lines  ·  ` +
      `top: ${(firstLine + 1).toLocaleString()}  ·  ${status}  ·  Large-File Mode`;
  }

  // progress from the background indexer
  function onProgress(id, p) {
    // find the buffer with this lf id
    for (const bid of LUM.editor.order) {
      const b = LUM.editor.buffers.get(bid);
      if (b && b.kind === 'large' && b.lf.id === id) {
        b.lf.lineCount = p.lineCount;
        b.lf.indexed = p.done;
        if (current && current.id === id) {
          layout();
          render();
          LUM.editor.updateStatus();
        }
        break;
      }
    }
  }

  function init() {
    window.lumenText.onLfProgress(onProgress);
  }

  return { init, openInTab, show, hide, LINE_H };
})();
