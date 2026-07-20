'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Absolute file:// URL to the local Monaco AMD bundle, consumed by the loader
// in index.html. Shipped inside the app (see package.json build.files).
const vsBase = pathToFileURL(
  path.join(__dirname, 'node_modules', 'monaco-editor', 'min', 'vs')
).href;

const initialArg = process.argv.find((a) => a.startsWith('--stp-initial='));
// A window launched in "config mode" boots straight into a Default | User split
// for the named config ('settings' or 'keymap'), Sublime-style.
const configArg = process.argv.find((a) => a.startsWith('--stp-config='));

contextBridge.exposeInMainWorld('lumenText', {
  vsBase,
  platform: process.platform,
  sep: path.sep,
  initialPath: initialArg ? initialArg.slice('--stp-initial='.length) : null,
  openConfigOnStart: configArg ? configArg.slice('--stp-config='.length) : null,

  // path helpers (renderer has no `path` module)
  basename: (p) => path.basename(p),
  dirname: (p) => path.dirname(p),
  extname: (p) => path.extname(p),
  join: (...parts) => path.join(...parts),
  resolve: (...parts) => path.resolve(...parts),
  isAbsolute: (p) => path.isAbsolute(p),
  relative: (from, to) => path.relative(from, to),

  // Resolve the absolute filesystem path of a dropped File (drag & drop).
  // File.path was removed in Electron 32+, so webUtils.getPathForFile is the
  // only supported way to recover it from a File object in the renderer.
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },

  // dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  saveFileDialog: (defaultPath) => ipcRenderer.invoke('dialog:saveFile', defaultPath),

  // filesystem
  readFile: (p, encoding) => ipcRenderer.invoke('fs:read', p, encoding),
  writeFile: (p, c, encoding) => ipcRenderer.invoke('fs:write', p, c, encoding),
  readDir: (p) => ipcRenderer.invoke('fs:readdir', p),
  walk: (root, limit) => ipcRenderer.invoke('fs:walk', root, limit),
  stat: (p) => ipcRenderer.invoke('fs:stat', p),
  mkdir: (p) => ipcRenderer.invoke('fs:mkdir', p),
  rename: (a, b) => ipcRenderer.invoke('fs:rename', a, b),
  copy: (a, b) => ipcRenderer.invoke('fs:copy', a, b),
  move: (a, b) => ipcRenderer.invoke('fs:move', a, b),
  trash: (p) => ipcRenderer.invoke('fs:delete', p),
  showItem: (p) => ipcRenderer.invoke('shell:showItem', p),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // windows
  newWindow: (openPath) => ipcRenderer.invoke('win:new', openPath),
  newConfigWindow: (name) => ipcRenderer.invoke('win:newConfig', name),
  closeWindow: () => ipcRenderer.invoke('win:close'),

  // recent projects (drives the native Project > Open Recent submenu)
  projectRecent: () => ipcRenderer.invoke('project:recent'),
  projectAddRecent: (p) => ipcRenderer.invoke('project:addRecent', p),
  projectClearRecent: () => ipcRenderer.invoke('project:clearRecent'),

  // persistent state (settings / session / recent)
  stateGet: (key, fallback) => ipcRenderer.invoke('state:get', key, fallback),
  stateSet: (key, value) => ipcRenderer.invoke('state:set', key, value),

  // config files (settings / keymap)
  userDataPath: () => ipcRenderer.invoke('app:userDataPath'),
  // Broadcast/receive a config change ('settings' | 'keymap') so a save in the
  // Preferences window live-applies to every other open window (Sublime-style).
  notifyConfigChanged: (kind) => ipcRenderer.invoke('config:changed', kind),
  onConfigReload: (cb) => ipcRenderer.on('config-reload', (_e, kind) => cb(kind)),
  configEnsure: (name, template) => ipcRenderer.invoke('config:ensure', name, template),
  configWriteDefault: (name, content) => ipcRenderer.invoke('config:writeDefault', name, content),

  // project-wide search
  searchInFiles: (root, query, opts) => ipcRenderer.invoke('search:inFiles', root, query, opts),

  // git
  gitRoot: (dir) => ipcRenderer.invoke('git:root', dir),
  gitStatus: (repo) => ipcRenderer.invoke('git:status', repo),
  gitHeadFile: (repo, absPath) => ipcRenderer.invoke('git:headFile', repo, absPath),

  // build / process runner
  procRun: (id, cmd, cwd) => ipcRenderer.invoke('proc:run', id, cmd, cwd),
  procKill: (id) => ipcRenderer.invoke('proc:kill', id),
  onProcData: (cb) => ipcRenderer.on('proc:data', (_e, id, chunk) => cb(id, chunk)),
  onProcExit: (cb) => ipcRenderer.on('proc:exit', (_e, id, code) => cb(id, code)),

  // LSP
  lspAvailable: () => ipcRenderer.invoke('lsp:available'),
  lspDidOpen: (root, uri, langId, version, text) => ipcRenderer.invoke('lsp:didOpen', root, uri, langId, version, text),
  lspDidChange: (root, uri, version, text) => ipcRenderer.invoke('lsp:didChange', root, uri, version, text),
  lspDidClose: (root, uri) => ipcRenderer.invoke('lsp:didClose', root, uri),
  lspCompletion: (root, uri, position) => ipcRenderer.invoke('lsp:completion', root, uri, position),
  lspHover: (root, uri, position) => ipcRenderer.invoke('lsp:hover', root, uri, position),
  lspDefinition: (root, uri, position) => ipcRenderer.invoke('lsp:definition', root, uri, position),
  onLspDiagnostics: (cb) => ipcRenderer.on('lsp:diagnostics', (_e, uri, diags) => cb(uri, diags)),

  // large-file streaming engine
  lfOpen: (filePath) => ipcRenderer.invoke('lf:open', filePath),
  lfLines: (id, start, count) => ipcRenderer.invoke('lf:lines', id, start, count),
  lfMeta: (id) => ipcRenderer.invoke('lf:meta', id),
  lfClose: (id) => ipcRenderer.invoke('lf:close', id),
  onLfProgress: (cb) => ipcRenderer.on('lf:progress', (_e, id, p) => cb(id, p)),

  // events from main -> renderer
  onMenuCommand: (cb) => ipcRenderer.on('menu-command', (_e, cmd, arg) => cb(cmd, arg)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (_e, p) => cb(p))
});
