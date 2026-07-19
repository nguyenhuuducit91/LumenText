'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Sidebar: project file tree. Supports MULTIPLE root folders (multi-root
// projects), lazy-expands directories and provides the full set of file
// operations (new / rename / delete / duplicate / copy path / reveal /
// find-in-folder) via a shared themed context menu and inline inputs.
// All OS access goes through window.lumen (main process); no fs in the renderer.
// ===========================================================================
LUM.sidebar = (function () {
  /** @type {string[]} project root folders */
  let roots = [];
  const expanded = new Set(); // dir paths currently open
  /** cache: dirPath -> entries */
  const cache = new Map();
  // Inline editing state: null, or { mode:'create'|'rename', dir, path, isDir }
  let edit = null;
  // Last file/folder the user acted on (for palette-invoked commands).
  let contextPath = null;
  // Monotonic render token: a newer render() cancels an in-flight older one so
  // two concurrent expands can't interleave rows into the same live element.
  let renderSeq = 0;

  // Remap/prune `expanded` entries when a folder is renamed or deleted, so open
  // descendants follow the rename and stale paths don't leak forever.
  function remapExpanded(oldPath, newPath) {
    const sep = window.lumen.sep;
    for (const p of [...expanded]) {
      if (p === oldPath || p.startsWith(oldPath + sep)) {
        expanded.delete(p);
        if (newPath != null) expanded.add(newPath + p.slice(oldPath.length));
      }
    }
  }

  function setLabel(text) {
    document.getElementById('project-name').textContent = text;
  }
  function refreshLabel() {
    if (LUM.project) LUM.project.updateLabel();
    else setLabel(roots[0] ? window.lumen.basename(roots[0]).toUpperCase() : 'NO FOLDER OPEN');
  }

  // Open a single folder (replaces the whole project) — the common entry point.
  async function openFolder(dir) {
    await setRoots([dir]);
    LUM.app && LUM.app.pushRecent && LUM.app.pushRecent(dir, 'folder');
  }

  // Replace the set of root folders wholesale (used by project open/switch).
  // Clears any active project file; LUM.project.openPath re-sets it afterwards.
  async function setRoots(dirs) {
    if (LUM.project) LUM.project.path = null;
    roots = dirs.slice();
    expanded.clear();
    cache.clear();
    edit = null;
    roots.forEach((r) => expanded.add(r));
    refreshLabel();
    await render();
    afterRootsChanged();
    LUM.git && LUM.git.onFolderOpen(roots[0]);
  }

  async function addFolder(dir) {
    if (roots.includes(dir)) return;
    roots.push(dir);
    expanded.add(dir);
    refreshLabel();
    await render();
    afterRootsChanged();
    if (roots.length === 1) LUM.git && LUM.git.onFolderOpen(roots[0]);
  }

  async function removeFolder(dir) {
    roots = roots.filter((r) => r !== dir);
    expanded.delete(dir);
    refreshLabel();
    await render();
    afterRootsChanged();
    // Persist the change into the .sublime-project so a removed folder doesn't
    // come back when the project is reopened.
    if (LUM.project && LUM.project.onFoldersChanged) LUM.project.onFoldersChanged();
  }

  async function removeAllFolders() {
    roots = [];
    expanded.clear();
    cache.clear();
    refreshLabel();
    await render();
    afterRootsChanged();
  }

  function afterRootsChanged() {
    LUM.palette && LUM.palette.invalidateFileIndex();
    LUM.app && LUM.app.saveSessionSoon && LUM.app.saveSessionSoon();
    LUM.symbols && LUM.symbols.invalidate();
    LUM.lsp && roots[0] && LUM.lsp.onFolderOpen(roots[0]);
  }

  async function entriesOf(dir) {
    if (cache.has(dir)) return cache.get(dir);
    const list = await window.lumen.readDir(dir);
    cache.set(dir, list);
    return list;
  }
  async function siblingNames(dir) {
    try { return (await entriesOf(dir)).map((e) => e.name); } catch { return []; }
  }

  async function render() {
    const gen = ++renderSeq;
    const treeEl = document.getElementById('file-tree');
    treeEl.innerHTML = '';
    if (!roots.length) {
      const empty = document.createElement('div');
      empty.className = 'tree-empty';
      empty.innerHTML = '<div>No folder open</div>';
      const btn = document.createElement('button');
      btn.textContent = 'Open Folder';
      btn.addEventListener('click', () => LUM.commands.run('file.openFolder'));
      empty.appendChild(btn);
      treeEl.appendChild(empty);
      return;
    }
    if (roots.length === 1) {
      await renderDir(roots[0], 0, treeEl, gen);
    } else {
      // multi-root: each folder is a collapsible group header.
      for (const r of roots) {
        if (gen !== renderSeq) return; // a newer render superseded us
        renderRootHeader(r, treeEl);
        if (expanded.has(r)) await renderDir(r, 1, treeEl, gen);
      }
    }
    if (gen !== renderSeq) return;
    if (LUM.git) LUM.git.decorateSidebar();
    const pending = edit && document.querySelector('.tree-input');
    if (pending) pending.focus();
  }

  function renderRootHeader(dir, container) {
    const row = document.createElement('div');
    row.className = 'tree-row root-row is-dir';
    const isOpen = expanded.has(dir);
    row.innerHTML =
      `<span class="twisty">${isOpen ? '▼' : '▶'}</span>` +
      `<span class="tname">${escapeHtml(window.lumen.basename(dir).toUpperCase())}</span>`;
    row.dataset.path = dir;
    row.dataset.dir = '1';
    row.title = dir;
    row.addEventListener('click', async () => {
      contextPath = dir;
      if (expanded.has(dir)) expanded.delete(dir); else expanded.add(dir);
      await render();
    });
    row.addEventListener('contextmenu', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      contextPath = dir;
      showContextMenu({ path: dir, isDir: true, isRoot: true }, ev.clientX, ev.clientY);
    });
    container.appendChild(row);
  }

  async function renderDir(dir, depth, container, gen) {
    // A "create" input row shows at the top of its parent folder's contents.
    if (edit && edit.mode === 'create' && edit.dir === dir) {
      container.appendChild(makeInlineRow(depth, edit.isDir, ''));
    }
    let list;
    try {
      list = await entriesOf(dir);
    } catch {
      return;
    }
    if (gen != null && gen !== renderSeq) return; // superseded during the await
    for (const e of list) {
      if (edit && edit.mode === 'rename' && edit.path === e.path) {
        container.appendChild(makeInlineRow(depth, e.isDir, e.name));
        if (e.isDir && expanded.has(e.path)) await renderDir(e.path, depth + 1, container, gen);
        continue;
      }
      const row = document.createElement('div');
      row.className = 'tree-row' + (e.isDir ? ' is-dir' : '');
      row.style.paddingLeft = 6 + depth * 14 + 'px';
      const isOpen = expanded.has(e.path);
      const twisty = e.isDir ? (isOpen ? '▼' : '▶') : '';
      const ico = e.isDir ? LUM.icons.folder(isOpen) : LUM.icons.file(e.name);
      row.innerHTML =
        `<span class="twisty">${twisty}</span>` +
        `<span class="tree-ico">${ico}</span>` +
        `<span class="tname">${escapeHtml(e.name)}</span>`;
      row.dataset.path = e.path;
      row.dataset.dir = e.isDir ? '1' : '';
      row.title = e.path;
      const cur = LUM.editor.activeBuffer && LUM.editor.activeBuffer();
      if (cur && cur.path === e.path) row.classList.add('active');

      row.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        contextPath = e.path;
        if (e.isDir) {
          if (expanded.has(e.path)) expanded.delete(e.path);
          else expanded.add(e.path);
          await render();
        } else {
          // Single click = transient preview tab (italic); double click below
          // (or editing) promotes it to a permanent tab — Sublime Text style.
          await LUM.editor.openPath(e.path, { preview: true });
          LUM.app && LUM.app.pushRecent && LUM.app.pushRecent(e.path, 'file');
          highlightActive();
        }
      });
      if (!e.isDir) {
        row.addEventListener('dblclick', async (ev) => {
          ev.stopPropagation();
          await LUM.editor.openPath(e.path); // permanent
          highlightActive();
        });
      }
      row.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        contextPath = e.path;
        showContextMenu(e, ev.clientX, ev.clientY);
      });
      container.appendChild(row);

      if (e.isDir && isOpen) {
        await renderDir(e.path, depth + 1, container, gen);
      }
    }
  }

  // --- inline create / rename input row -----------------------------------
  function makeInlineRow(depth, isDir, value) {
    const row = document.createElement('div');
    row.className = 'tree-row editing';
    row.style.paddingLeft = 6 + depth * 14 + 'px';
    const ico = isDir ? LUM.icons.folder(false) : LUM.icons.file(value || 'x.txt');
    row.innerHTML = `<span class="twisty"></span><span class="tree-ico">${ico}</span>`;
    const input = document.createElement('input');
    input.className = 'tree-input';
    input.type = 'text';
    input.value = value;
    input.spellcheck = false;
    const err = document.createElement('div');
    err.className = 'tree-input-err';
    row.appendChild(input);
    row.appendChild(err);

    let done = false, committing = false;
    const cancel = () => { if (done || committing) return; done = true; edit = null; render(); };
    const commit = async () => {
      // `committing` guards the async validation window so Enter-then-blur can't
      // run performInline twice (double writeFile / mkdir, or a second rename that
      // throws because the path already moved).
      if (done || committing) return;
      committing = true;
      const name = input.value.trim();
      const validation = await validateInline(name);
      if (validation) { committing = false; err.textContent = validation; err.classList.add('show'); return; }
      done = true; committing = false;
      const target = edit;
      edit = null;
      await performInline(target, name);
    };

    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') { ev.preventDefault(); commit(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); cancel(); }
    });
    input.addEventListener('input', () => { err.classList.remove('show'); });
    input.addEventListener('blur', () => { setTimeout(() => { if (!done) commit().catch(cancel); }, 0); });

    // Select the stem (not the extension) so renames feel natural.
    setTimeout(() => {
      input.focus();
      if (value) {
        const { stem } = LUM.pathops.splitName(value);
        input.setSelectionRange(0, isDir ? value.length : stem.length);
      }
    }, 0);
    return row;
  }

  async function validateInline(name) {
    if (!edit) return null;
    if (edit.mode === 'create') {
      return LUM.pathops.validateName(name, await siblingNames(edit.dir));
    }
    const parent = window.lumen.dirname(edit.path);
    const original = window.lumen.basename(edit.path);
    return LUM.pathops.validateName(name, await siblingNames(parent), original);
  }

  async function performInline(target, name) {
    try {
      if (target.mode === 'create') {
        const full = window.lumen.join(target.dir, name);
        if (target.isDir) {
          await window.lumen.mkdir(full);
          expanded.add(full);
        } else {
          await window.lumen.writeFile(full, '');
        }
        cache.delete(target.dir);
        await render();
        afterFsChange();
        if (!target.isDir) await LUM.editor.openPath(full);
      } else {
        const parent = window.lumen.dirname(target.path);
        const dest = window.lumen.join(parent, name);
        if (dest === target.path) { await render(); return; }
        await window.lumen.rename(target.path, dest);
        if (target.isDir) remapExpanded(target.path, dest); // follow open descendants
        LUM.editor.applyPathChange(target.path, dest);
        cache.delete(parent);
        await render();
        afterFsChange();
      }
    } catch (e) {
      LUM.app.toast('Failed: ' + (e && e.message ? e.message : e));
      await render();
    }
  }

  function startCreate(dir, isDir) {
    dir = dir || roots[0];
    if (!dir) return;
    expanded.add(dir);
    edit = { mode: 'create', dir, isDir };
    render();
  }
  function startRename(path, isDir) {
    if (!path) return;
    edit = { mode: 'rename', path, isDir };
    render();
  }

  // --- destructive / clipboard ops ----------------------------------------
  async function doDelete(path, isDir) {
    const name = window.lumen.basename(path);
    const choice = await LUM.dialog.confirm({
      message: `Delete "${name}"?`,
      detail: isDir ? 'The folder and its contents will be moved to Trash.' : 'The file will be moved to Trash.',
      buttons: [
        { label: 'Move to Trash', value: 'ok', kind: 'danger' },
        { label: 'Cancel', value: 'cancel' }
      ],
      default: 'ok',
      cancel: 'cancel'
    });
    if (choice !== 'ok') return;
    try {
      await window.lumen.trash(path);
      LUM.editor.markPathDeleted(path);
      cache.delete(window.lumen.dirname(path));
      remapExpanded(path, null); // prune the folder and all its open descendants
      await render();
      afterFsChange();
      LUM.app.toast('Moved to Trash: ' + name);
    } catch (e) {
      LUM.app.toast('Delete failed: ' + (e && e.message ? e.message : e));
    }
  }

  async function doDuplicate(path, isDir) {
    const parent = window.lumen.dirname(path);
    const name = window.lumen.basename(path);
    const dest = window.lumen.join(parent, LUM.pathops.dedupeName(await siblingNames(parent), name));
    try {
      await window.lumen.copy(path, dest);
      cache.delete(parent);
      await render();
      afterFsChange();
      if (!isDir) await LUM.editor.openPath(dest);
    } catch (e) {
      LUM.app.toast('Duplicate failed: ' + (e && e.message ? e.message : e));
    }
  }

  // Find the root folder that contains `path` (for relative-path display).
  function rootOf(path) {
    return roots.find((r) => path === r || path.startsWith(r + window.lumen.sep)) || null;
  }

  async function copyPath(path, relative) {
    let p = path;
    if (relative) {
      const r = rootOf(path);
      if (r && p.startsWith(r + window.lumen.sep)) p = p.slice(r.length + 1);
    }
    try { await navigator.clipboard.writeText(p); } catch {}
    LUM.app.toast('Copied: ' + p);
  }

  function reveal(path) { window.lumen.showItem(path); }

  // Expand ancestors of `path` and scroll it into view (used by tab menu).
  async function revealInSidebar(path) {
    const r = rootOf(path);
    if (!r) return;
    const rel = path.slice(r.length).split(window.lumen.sep).filter(Boolean);
    expanded.add(r);
    let cur = r;
    for (let i = 0; i < rel.length - 1; i++) {
      cur = window.lumen.join(cur, rel[i]);
      expanded.add(cur);
    }
    contextPath = path;
    await render();
    const row = document.querySelector(`.tree-row[data-path="${cssEscape(path)}"]`);
    if (row) {
      row.scrollIntoView({ block: 'nearest' });
      row.classList.add('flash');
      setTimeout(() => row.classList.remove('flash'), 900);
    }
  }

  function collapseAll() {
    expanded.clear();
    roots.forEach((r) => expanded.add(r));
    render();
  }

  async function refresh() {
    cache.clear();
    await render();
    LUM.palette && LUM.palette.invalidateFileIndex();
  }

  function afterFsChange() {
    LUM.palette && LUM.palette.invalidateFileIndex();
    LUM.git && LUM.git.refresh && LUM.git.refresh();
    LUM.symbols && LUM.symbols.invalidate();
    LUM.app && LUM.app.saveSessionSoon && LUM.app.saveSessionSoon();
  }

  // --- context menu --------------------------------------------------------
  function showContextMenu(entry, x, y) {
    const isDir = entry && entry.isDir;
    const path = entry && entry.path;
    const isRoot = entry && entry.isRoot;
    const targetDir = !entry ? roots[0] : (isDir ? path : window.lumen.dirname(path));
    const items = [];
    items.push({ label: 'New File', run: () => startCreate(targetDir, false) });
    items.push({ label: 'New Folder', run: () => startCreate(targetDir, true) });
    if (entry) {
      items.push({ separator: true });
      if (!isRoot) {
        items.push({ label: 'Rename', accel: 'F2', run: () => startRename(path, isDir) });
        items.push({ label: 'Duplicate', run: () => doDuplicate(path, isDir) });
        items.push({ label: 'Delete', accel: 'Del', run: () => doDelete(path, isDir) });
        items.push({ separator: true });
      }
      items.push({ label: 'Copy Path', run: () => copyPath(path, false) });
      items.push({ label: 'Copy Relative Path', run: () => copyPath(path, true) });
      items.push({ label: 'Reveal in File Manager', run: () => reveal(path) });
      if (isDir) {
        items.push({ separator: true });
        items.push({ label: 'Find in Folder…', run: () => LUM.findInFiles.open(path) });
      }
      if (isRoot) {
        items.push({ separator: true });
        items.push({ label: 'Remove Folder from Project', run: () => removeFolder(path) });
      }
    }
    items.push({ separator: true });
    items.push({ label: 'Add Folder to Project…', run: () => LUM.project && LUM.project.addFolder() });
    items.push({ label: 'Refresh', run: () => refresh() });
    LUM.menu.show(items, x, y);
  }

  function highlightActive() {
    const cur = LUM.editor.activeBuffer && LUM.editor.activeBuffer();
    document.querySelectorAll('.tree-row').forEach((r) =>
      r.classList.toggle('active', cur && r.dataset.path === cur.path)
    );
  }

  // Resolve the target for a palette-invoked command.
  function commandTarget() {
    if (contextPath) return contextPath;
    const b = LUM.editor.activeBuffer && LUM.editor.activeBuffer();
    if (b && b.path) return b.path;
    return roots[0] || null;
  }
  async function isDirPath(p) {
    if (roots.includes(p)) return true;
    try { const st = await window.lumen.stat(p); return !!st.isDir; } catch { return false; }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function cssEscape(s) { return s.replace(/["\\]/g, '\\$&'); }

  return {
    get root() { return roots[0] || null; },
    get roots() { return roots.slice(); },
    openFolder, setRoots, addFolder, removeFolder, removeAllFolders,
    refresh, render, highlightActive, collapseAll, revealInSidebar, setLabel, rootOf,
    startCreate, startRename, doDelete, doDuplicate, copyPath, reveal,
    showContextMenu, commandTarget, isDirPath
  };
})();
