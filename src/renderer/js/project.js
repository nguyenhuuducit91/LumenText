'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Project management (.sublime-project): open / switch / save / close / edit,
// add & remove folders (multi-root), recent projects, quick switch. The set of
// root folders lives in LUM.sidebar; this module owns the project *file* and
// the persisted recent-projects list (which drives the native Open Recent menu).
// ===========================================================================
LUM.project = (function () {
  let projectPath = null; // path to the active .sublime-project, or null

  function name() {
    if (projectPath) return window.lumen.basename(projectPath).replace(/\.sublime-project$/, '');
    const roots = LUM.sidebar.roots;
    if (roots.length === 1) return window.lumen.basename(roots[0]);
    if (roots.length > 1) return 'Untitled Project';
    return null;
  }

  function updateLabel() {
    const n = name();
    LUM.sidebar.setLabel(n ? n.toUpperCase() : 'NO FOLDER OPEN');
  }

  // Resolve folder entries (which may be relative to the project file) to
  // absolute directory paths.
  function resolveFolders(proj, projFilePath) {
    const dir = window.lumen.dirname(projFilePath);
    return (proj.folders || [])
      .map((f) => f.path)
      .filter(Boolean)
      .map((p) => (window.lumen.isAbsolute(p) ? p : window.lumen.resolve(dir, p)));
  }

  function serialize() {
    // Store folder paths relative to the project file when possible (portable),
    // else absolute.
    const dir = projectPath ? window.lumen.dirname(projectPath) : null;
    const folders = LUM.sidebar.roots.map((p) => {
      let rel = p;
      if (dir) {
        const r = window.lumen.relative(dir, p);
        if (r === '') rel = '.';                    // the project-file's own folder
        else if (!r.startsWith('..')) rel = r;      // a descendant → keep relative
        // else: outside the project dir → keep absolute
      }
      return { path: rel };
    });
    return { folders, settings: {} };
  }

  async function openPath(p) {
    try {
      const { content } = await window.lumen.readFile(p);
      const proj = JSON.parse(content);
      const folders = resolveFolders(proj, p);
      if (!folders.length) { LUM.app.toast('Project has no folders'); return; }
      await LUM.sidebar.setRoots(folders);
      projectPath = p;
      updateLabel();
      await window.lumen.projectAddRecent(p);
      LUM.app.pushRecent && LUM.app.pushRecent(p, 'file');
      LUM.app.toast('Project: ' + (name() || window.lumen.basename(p)));
    } catch (e) {
      LUM.app.toast('Not a valid .sublime-project file');
      console.error('openProject', e);
    }
  }

  async function open() {
    const paths = await window.lumen.openFileDialog();
    if (paths && paths[0]) await openPath(paths[0]);
  }

  async function quickSwitch() {
    const list = (await window.lumen.projectRecent()) || [];
    if (!list.length) { LUM.app.toast('No recent projects'); return; }
    const entries = list.map((p) => ({
      label: window.lumen.basename(p).replace(/\.sublime-project$/, ''),
      sub: p,
      run: () => openPath(p)
    }));
    LUM.app.inlinePicker(entries, 'Switch Project');
  }

  async function saveAs() {
    const roots = LUM.sidebar.roots;
    const base = name() || (roots[0] ? window.lumen.basename(roots[0]) : 'project');
    const suggestedDir = roots[0] || null;
    const suggested = base + '.sublime-project';
    const target = await window.lumen.saveFileDialog(suggestedDir ? window.lumen.join(suggestedDir, suggested) : suggested);
    if (!target) return;
    projectPath = target; // set first so serialize() writes relative paths
    await window.lumen.writeFile(target, JSON.stringify(serialize(), null, 2) + '\n');
    updateLabel();
    await window.lumen.projectAddRecent(target);
    LUM.app.pushRecent && LUM.app.pushRecent(target, 'file');
    LUM.app.toast('Project saved: ' + window.lumen.basename(target));
  }

  async function save() {
    if (!projectPath) return saveAs();
    await window.lumen.writeFile(projectPath, JSON.stringify(serialize(), null, 2) + '\n');
    updateLabel();
    LUM.app.toast('Project saved: ' + window.lumen.basename(projectPath));
  }

  // Silently persist folder changes if a project file is open.
  async function onFoldersChanged() {
    if (projectPath) {
      try { await window.lumen.writeFile(projectPath, JSON.stringify(serialize(), null, 2) + '\n'); } catch {}
    }
  }

  async function close() {
    projectPath = null;
    await LUM.sidebar.removeAllFolders();
    updateLabel();
    LUM.app.toast('Project closed');
  }

  async function edit() {
    if (!projectPath) { LUM.app.toast('No project file yet — use Save Project As… first'); return; }
    await LUM.editor.openPath(projectPath);
  }

  async function addFolder() {
    const dir = await window.lumen.openFolderDialog();
    if (!dir) return;
    await LUM.sidebar.addFolder(dir);
    updateLabel();
    await onFoldersChanged();
  }

  async function removeAllFolders() {
    await LUM.sidebar.removeAllFolders();
    projectPath && await onFoldersChanged();
    updateLabel();
  }

  function refreshFolders() { LUM.sidebar.refresh(); }

  async function clearRecent() {
    await window.lumen.projectClearRecent();
    LUM.app.toast('Recent projects cleared');
  }

  return {
    get path() { return projectPath; },
    set path(p) { projectPath = p; },
    name, updateLabel, serialize,
    open, openPath, quickSwitch, save, saveAs, close, edit,
    addFolder, removeAllFolders, refreshFolders, onFoldersChanged, clearRecent
  };
})();
