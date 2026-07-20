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
  let projectData = {};   // the full parsed .sublime-project (settings, build_systems, …)

  function name() {
    if (projectPath) return window.lumenText.basename(projectPath).replace(/\.sublime-project$/, '');
    const roots = LUM.sidebar.roots;
    if (roots.length === 1) return window.lumenText.basename(roots[0]);
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
    const dir = window.lumenText.dirname(projFilePath);
    return (proj.folders || [])
      .map((f) => f.path)
      .filter(Boolean)
      .map((p) => (window.lumenText.isAbsolute(p) ? p : window.lumenText.resolve(dir, p)));
  }

  function serialize() {
    // Store folder paths relative to the project file when possible (portable),
    // else absolute.
    const dir = projectPath ? window.lumenText.dirname(projectPath) : null;
    const folders = LUM.sidebar.roots.map((p) => {
      let rel = p;
      if (dir) {
        const r = window.lumenText.relative(dir, p);
        if (r === '') rel = '.';                    // the project-file's own folder
        else if (!r.startsWith('..')) rel = r;      // a descendant → keep relative
        // else: outside the project dir → keep absolute
      }
      // Preserve any per-folder keys (name, *_exclude_patterns, follow_symlinks)
      // that were on the original folder entry for this path.
      const prev = (projectData.folders || []).find((f) => {
        const abs = window.lumenText.isAbsolute(f.path) ? f.path : window.lumenText.resolve(dir || '.', f.path);
        return abs === p || f.path === rel;
      });
      return Object.assign({}, prev, { path: rel });
    });
    // Merge folders back into the full project object so settings, build_systems,
    // and other keys survive a save instead of being clobbered with {}.
    return Object.assign({}, projectData, { folders });
  }

  async function openPath(p) {
    try {
      const { content } = await window.lumenText.readFile(p);
      const proj = JSON.parse(content);
      const folders = resolveFolders(proj, p);
      if (!folders.length) { LUM.app.toast('Project has no folders'); return; }
      await LUM.sidebar.setRoots(folders); // nulls project.path (clears projectData)
      projectData = proj; // retain settings / build_systems / exclude patterns
      projectPath = p;
      updateLabel();
      await window.lumenText.projectAddRecent(p);
      LUM.app.pushRecent && LUM.app.pushRecent(p, 'file');
      LUM.app.toast('Project: ' + (name() || window.lumenText.basename(p)));
    } catch (e) {
      LUM.app.toast('Not a valid .sublime-project file');
      console.error('openProject', e);
    }
  }

  async function open() {
    const paths = await window.lumenText.openFileDialog();
    if (paths && paths[0]) await openPath(paths[0]);
  }

  async function quickSwitch() {
    const list = (await window.lumenText.projectRecent()) || [];
    if (!list.length) { LUM.app.toast('No recent projects'); return; }
    const entries = list.map((p) => ({
      label: window.lumenText.basename(p).replace(/\.sublime-project$/, ''),
      sub: p,
      run: () => openPath(p)
    }));
    LUM.app.inlinePicker(entries, 'Switch Project');
  }

  async function saveAs() {
    const roots = LUM.sidebar.roots;
    const base = name() || (roots[0] ? window.lumenText.basename(roots[0]) : 'project');
    const suggestedDir = roots[0] || null;
    const suggested = base + '.sublime-project';
    const target = await window.lumenText.saveFileDialog(suggestedDir ? window.lumenText.join(suggestedDir, suggested) : suggested);
    if (!target) return;
    projectPath = target; // set first so serialize() writes relative paths
    await window.lumenText.writeFile(target, JSON.stringify(serialize(), null, 2) + '\n');
    updateLabel();
    await window.lumenText.projectAddRecent(target);
    LUM.app.pushRecent && LUM.app.pushRecent(target, 'file');
    LUM.app.toast('Project saved: ' + window.lumenText.basename(target));
  }

  async function save() {
    if (!projectPath) return saveAs();
    await window.lumenText.writeFile(projectPath, JSON.stringify(serialize(), null, 2) + '\n');
    updateLabel();
    LUM.app.toast('Project saved: ' + window.lumenText.basename(projectPath));
  }

  // Silently persist folder changes if a project file is open.
  async function onFoldersChanged() {
    if (projectPath) {
      try { await window.lumenText.writeFile(projectPath, JSON.stringify(serialize(), null, 2) + '\n'); } catch {}
    }
  }

  async function close() {
    projectPath = null;
    projectData = {};
    await LUM.sidebar.removeAllFolders();
    updateLabel();
    LUM.app.toast('Project closed');
  }

  async function edit() {
    if (!projectPath) { LUM.app.toast('No project file yet — use Save Project As… first'); return; }
    await LUM.editor.openPath(projectPath);
  }

  async function addFolder() {
    const dir = await window.lumenText.openFolderDialog();
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
    await window.lumenText.projectClearRecent();
    LUM.app.toast('Recent projects cleared');
  }

  return {
    get path() { return projectPath; },
    set path(p) { projectPath = p; if (p == null) projectData = {}; },
    name, updateLabel, serialize,
    open, openPath, quickSwitch, save, saveAs, close, edit,
    addFolder, removeAllFolders, refreshFolders, onFoldersChanged, clearRecent
  };
})();
