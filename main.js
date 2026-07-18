'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');

const { Store } = require('./src/main/store.js');
const largefile = require('./src/main/largefile.js');
const git = require('./src/main/git.js');
const lsp = require('./src/main/lsp.js');

const isDev = process.argv.includes('--dev');

// Files at or above this size open in the streaming Large-File viewer instead
// of being loaded into an editor model.
const LARGE_FILE_BYTES = 24 * 1024 * 1024; // 24 MB

/** Persistent state store (settings, session, recent). Assigned on app ready. */
let store = null;

// ---------------------------------------------------------------------------
// IME / fcitx support
// ---------------------------------------------------------------------------
// Chromium reads GTK_IM_MODULE on X11 and shows inline (over-the-spot) preedit
// inside text fields automatically. On Wayland we must opt into the text-input
// protocol so fcitx5 can draw the preedit string inline instead of a popup.
if (process.platform === 'linux') {
  // Harmless on X11, required for inline IME on Wayland.
  app.commandLine.appendSwitch('enable-wayland-ime');
  app.commandLine.appendSwitch('wayland-text-input-version', '3');
  // Make sure the GTK input module is honoured even if launched from a
  // minimal environment (desktop launchers sometimes strip these).
  if (!process.env.GTK_IM_MODULE) process.env.GTK_IM_MODULE = 'fcitx';
  if (!process.env.QT_IM_MODULE) process.env.QT_IM_MODULE = 'fcitx';
  if (!process.env.XMODIFIERS) process.env.XMODIFIERS = '@im=fcitx';
}

/** @type {Set<BrowserWindow>} */
const windows = new Set();

const APP_ICON = nativeImage.createFromPath(path.join(__dirname, 'build', 'icons', '512x512.png'));

function createWindow(openPath) {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 640,
    minHeight: 400,
    backgroundColor: '#272822',
    title: 'Lumen',
    icon: APP_ICON.isEmpty() ? undefined : APP_ICON,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // Passed into the renderer's process.argv so boot can read the initial
      // path synchronously (no race with session restore).
      additionalArguments: openPath ? ['--stp-initial=' + openPath] : [],
      // Local Monaco assets + workers are loaded over file:// / data: URIs.
      // Relaxing webSecurity keeps the worker importScripts calls working for
      // a purely local desktop app (no remote content is ever loaded).
      webSecurity: false,
      spellcheck: false
    }
  });

  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  win.webContents.on('did-finish-load', () => {
    // Initial path is read synchronously by the renderer via additionalArguments;
    // this event now only carries the dev screenshot hook.
    // Dev-only visual verification hook.
    if (process.env.LUMEN_SCREENSHOT) {
      const delay = parseInt(process.env.LUMEN_SHOT_DELAY || '3000', 10);
      setTimeout(async () => {
        try {
          if (process.env.LUMEN_EXEC) {
            await win.webContents.executeJavaScript(process.env.LUMEN_EXEC, true);
            await new Promise((r) => setTimeout(r, 1000)); // let async render settle
          }
          const img = await win.webContents.capturePage();
          await fsp.writeFile(process.env.LUMEN_SCREENSHOT, img.toPNG());
        } catch (e) {
          console.error('screenshot failed', e);
        }
      }, delay);
    }
  });

  win.on('closed', () => windows.delete(win));
  windows.add(win);

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function focusedWin() {
  return BrowserWindow.getFocusedWindow() || [...windows][0];
}

// ---------------------------------------------------------------------------
// Application menu (mirrors common Sublime menu items -> renderer commands)
// ---------------------------------------------------------------------------
function send(cmd, arg) {
  const win = focusedWin();
  if (win) win.webContents.send('menu-command', cmd, arg);
}

// Build the dynamic "Project > Open Recent" submenu from persisted state.
function recentProjectsSubmenu() {
  const recent = (store && store.get('recentProjects', [])) || [];
  const items = recent.slice(0, 10).map((p) => ({
    label: path.basename(p).replace(/\.sublime-project$/, ''),
    sublabel: p,
    click: () => send('project.openPath', p)
  }));
  if (!items.length) return [{ label: 'No Recent Projects', enabled: false }];
  items.push({ type: 'separator' });
  items.push({ label: 'Clear Items', click: () => send('project.clearRecent') });
  return items;
}

// View > Show Symbol — checkbox items reflecting the persisted invisibles state.
function showSymbolSubmenu() {
  const inv = (store && store.get('invisibles', {})) || {};
  const item = (key, label, cmd) => ({
    label, type: 'checkbox', checked: !!inv[key], click: () => send(cmd)
  });
  return [
    item('whitespace', 'Show Space and Tab', 'view.showWhitespace'),
    item('eol', 'Show End of Line', 'view.showEol'),
    item('control', 'Show Non Printing Character', 'view.showControl'),
    item('unicode', 'Show Control Character and Unicode EOL', 'view.showUnicode'),
    { type: 'separator' },
    item('guides', 'Show Indent Guide', 'view.showIndentGuides'),
    item('wrap', 'Show Wrap Symbol', 'view.showWrapSymbol')
  ];
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New File', accelerator: 'CmdOrCtrl+N', click: () => send('file.new') },
        { label: 'New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow() },
        { type: 'separator' },
        { label: 'Open File…', accelerator: 'CmdOrCtrl+O', click: () => send('file.open') },
        { label: 'Open Folder…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('file.openFolder') },
        { label: 'Open Recent…', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('file.openRecent') },
        { type: 'separator' },
        { label: 'Open Project…', click: () => send('project.open') },
        { label: 'Save Project As…', click: () => send('project.save') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file.save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file.saveAs') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+Alt+S', click: () => send('file.saveAll') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => send('file.closeTab') },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Line',
          submenu: [
            { label: 'Move Line Up', accelerator: 'CmdOrCtrl+Shift+Up', click: () => send('edit.moveLineUp') },
            { label: 'Move Line Down', accelerator: 'CmdOrCtrl+Shift+Down', click: () => send('edit.moveLineDown') },
            { label: 'Duplicate Line', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('edit.duplicateLine') },
            { label: 'Delete Line', accelerator: 'CmdOrCtrl+Shift+K', click: () => send('edit.deleteLine') },
            { label: 'Join Lines', accelerator: 'CmdOrCtrl+J', click: () => send('edit.joinLines') },
            { type: 'separator' },
            { label: 'Indent', accelerator: 'CmdOrCtrl+]', click: () => send('edit.indent') },
            { label: 'Outdent', accelerator: 'CmdOrCtrl+[', click: () => send('edit.outdent') },
            { type: 'separator' },
            { label: 'Sort Lines Ascending', accelerator: 'F9', click: () => send('edit.sortAsc') },
            { label: 'Sort Lines Descending', accelerator: 'CmdOrCtrl+F9', click: () => send('edit.sortDesc') }
          ]
        },
        {
          label: 'Comment',
          submenu: [
            { label: 'Toggle Line Comment', accelerator: 'CmdOrCtrl+/', click: () => send('edit.commentLine') },
            { label: 'Toggle Block Comment', accelerator: 'CmdOrCtrl+Shift+/', click: () => send('edit.blockComment') }
          ]
        },
        {
          label: 'Convert Case',
          submenu: [
            { label: 'Upper Case  (Ctrl+K Ctrl+U)', click: () => send('edit.upperCase') },
            { label: 'Lower Case  (Ctrl+K Ctrl+L)', click: () => send('edit.lowerCase') },
            { label: 'Title Case', click: () => send('edit.titleCase') },
            { label: 'Transpose', click: () => send('edit.transpose') }
          ]
        },
        { type: 'separator' },
        { label: 'Format Document', accelerator: 'CmdOrCtrl+Alt+F', click: () => send('edit.format') }
      ]
    },
    {
      label: 'Selection',
      submenu: [
        { label: 'Add Cursor: Next Occurrence', accelerator: 'CmdOrCtrl+D', click: () => send('edit.selectNext') },
        { label: 'Select All Occurrences', accelerator: 'Alt+F3', click: () => send('sel.selectAllOcc') },
        { label: 'Split Into Lines', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('sel.splitLines') },
        { type: 'separator' },
        { label: 'Expand Selection', accelerator: 'Shift+Alt+Right', click: () => send('sel.expand') },
        { label: 'Shrink Selection', accelerator: 'Shift+Alt+Left', click: () => send('sel.shrink') }
      ]
    },
    {
      label: 'Find',
      submenu: [
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => send('edit.find') },
        { label: 'Replace…', accelerator: 'CmdOrCtrl+H', click: () => send('edit.replace') },
        { label: 'Find Next', accelerator: 'F3', click: () => send('edit.findNext') },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: () => send('edit.findPrev') },
        { label: 'Incremental Find', accelerator: 'CmdOrCtrl+I', click: () => send('edit.incrementalFind') },
        { type: 'separator' },
        { label: 'Find in Files…', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('find.inFiles') }
      ]
    },
    {
      label: 'Goto',
      submenu: [
        { label: 'Goto Anything…', accelerator: 'CmdOrCtrl+P', click: () => send('goto.anything') },
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('goto.command') },
        { label: 'Goto Line…', accelerator: 'CmdOrCtrl+G', click: () => send('goto.line') },
        { label: 'Goto Symbol…', accelerator: 'CmdOrCtrl+R', click: () => send('goto.symbol') },
        { label: 'Goto Symbol in Project…', accelerator: 'CmdOrCtrl+Shift+R', click: () => send('goto.projectSymbol') },
        { label: 'Goto Word in File… (#)', click: () => send('goto.word') },
        { type: 'separator' },
        { label: 'Jump Back', accelerator: 'Alt+Left', click: () => send('nav.back') },
        { label: 'Jump Forward', accelerator: 'Alt+Right', click: () => send('nav.forward') },
        { type: 'separator' },
        {
          label: 'Bookmarks',
          submenu: [
            { label: 'Toggle Bookmark', accelerator: 'CmdOrCtrl+F2', click: () => send('bm.toggle') },
            { label: 'Next Bookmark', accelerator: 'F2', click: () => send('bm.next') },
            { label: 'Previous Bookmark', accelerator: 'Shift+F2', click: () => send('bm.prev') },
            { label: 'Clear Bookmarks', accelerator: 'CmdOrCtrl+Shift+F2', click: () => send('bm.clear') }
          ]
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        { label: 'Build System…', accelerator: 'CmdOrCtrl+Shift+B', click: () => send('build.run') },
        { label: 'Re-run Last Build', accelerator: 'F7', click: () => send('build.rerun') },
        { label: 'Cancel Build', click: () => send('build.cancel') },
        { type: 'separator' },
        { label: 'Record / Stop Macro', accelerator: 'CmdOrCtrl+Q', click: () => send('macro.toggle') },
        { label: 'Playback Macro', accelerator: 'CmdOrCtrl+Shift+Q', click: () => send('macro.play') }
      ]
    },
    {
      label: 'Project',
      submenu: [
        { label: 'Open Project…', click: () => send('project.open') },
        { label: 'Switch Project…', click: () => send('project.switch') },
        { label: 'Quick Switch Project…', accelerator: 'CmdOrCtrl+Alt+P', click: () => send('project.quickSwitch') },
        { label: 'Open Recent', submenu: recentProjectsSubmenu() },
        { type: 'separator' },
        { label: 'Save Project As…', click: () => send('project.saveAs') },
        { label: 'Close Project', click: () => send('project.close') },
        { label: 'Edit Project', click: () => send('project.edit') },
        { type: 'separator' },
        { label: 'Add Folder to Project…', click: () => send('project.addFolder') },
        { label: 'Remove all Folders from Project', click: () => send('project.removeAllFolders') },
        { label: 'Refresh Folders', click: () => send('project.refreshFolders') }
      ]
    },
    {
      label: 'Preferences',
      submenu: [
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('prefs.settings') },
        { label: 'Key Bindings', click: () => send('prefs.keymap') },
        { label: 'Snippets', click: () => send('snippet.edit') },
        { label: 'Color Scheme…', click: () => send('view.theme') },
        { type: 'separator' },
        { label: 'Auto Save: Off', click: () => send('prefs.autosave.off') },
        { label: 'Auto Save: After Delay', click: () => send('prefs.autosave.delay') },
        { label: 'Auto Save: On Focus Change', click: () => send('prefs.autosave.focus') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: () => send('view.toggleSidebar') },
        { label: 'Toggle Minimap', click: () => send('view.toggleMinimap') },
        { label: 'Show Symbol', submenu: showSymbolSubmenu() },
        { label: 'Distraction-Free Mode', accelerator: 'Shift+F11', click: () => send('view.zen') },
        { label: 'Toggle Rulers (80 / 120)', click: () => send('view.rulers') },
        { label: 'Split: Two Columns', accelerator: 'Alt+Shift+2', click: () => send('view.split2') },
        { label: 'Split: Single', accelerator: 'Alt+Shift+1', click: () => send('view.split1') },
        { type: 'separator' },
        { label: 'Command Palette: Color Scheme', click: () => send('view.theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Lumen', click: () => send('help.about') },
        { label: 'Vietnamese Input (fcitx) Help', click: () => send('help.ime') }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// IPC: filesystem operations (renderer has no direct fs access)
// ---------------------------------------------------------------------------
ipcMain.handle('dialog:openFile', async () => {
  const win = focusedWin();
  const res = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections']
  });
  return res.canceled ? [] : res.filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
  const win = focusedWin();
  const res = await dialog.showOpenDialog(win, { properties: ['openDirectory'] });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_e, defaultPath) => {
  const win = focusedWin();
  const res = await dialog.showSaveDialog(win, { defaultPath: defaultPath || undefined });
  return res.canceled ? null : res.filePath;
});

ipcMain.handle('fs:read', async (_e, filePath) => {
  const content = await fsp.readFile(filePath, 'utf8');
  const stat = await fsp.stat(filePath);
  return { content, mtimeMs: stat.mtimeMs };
});

ipcMain.handle('fs:write', async (_e, filePath, content) => {
  await fsp.writeFile(filePath, content, 'utf8');
  const stat = await fsp.stat(filePath);
  return { mtimeMs: stat.mtimeMs };
});

ipcMain.handle('fs:readdir', async (_e, dirPath) => {
  const entries = await fsp.readdir(dirPath, { withFileTypes: true });
  return entries
    .map((e) => ({
      name: e.name,
      path: path.join(dirPath, e.name),
      isDir: e.isDirectory()
    }))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
});

// Recursively list files under a folder (for Goto Anything). Skips heavy dirs.
const IGNORE = new Set(['.git', 'node_modules', '.cache', 'dist', 'build', '.venv', '__pycache__', '.idea', '.vscode']);
ipcMain.handle('fs:walk', async (_e, root, limit = 20000) => {
  const out = [];
  async function walk(dir) {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (out.length >= limit) return;
      if (e.name.startsWith('.') && e.name !== '.env') {
        if (IGNORE.has(e.name)) continue;
      }
      if (IGNORE.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else out.push({ name: e.name, path: full });
    }
  }
  await walk(root);
  return out;
});

// ---- Find in Files --------------------------------------------------------
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildMatcher(query, opts) {
  let pattern = opts.regex ? query : escapeRegExp(query);
  if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
  const flags = 'g' + (opts.caseSensitive ? '' : 'i');
  return new RegExp(pattern, flags);
}
ipcMain.handle('search:inFiles', async (_e, root, query, opts) => {
  const MAX_FILES = 600, MAX_TOTAL = 5000, MAX_PER_FILE = 300, MAX_FILE_BYTES = 5 * 1024 * 1024;
  if (!root || !query) return { files: [], total: 0, scanned: 0, truncated: false };
  let re;
  try {
    re = buildMatcher(query, opts || {});
  } catch (err) {
    return { error: 'Invalid regular expression: ' + err.message, files: [], total: 0, scanned: 0 };
  }

  const files = [];
  let total = 0, scanned = 0, truncated = false;

  async function walk(dir) {
    if (truncated) return;
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (truncated) return;
      if (IGNORE.has(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(full);
      } else if (ent.isFile()) {
        let st;
        try {
          st = await fsp.stat(full);
        } catch {
          continue;
        }
        if (st.size > MAX_FILE_BYTES || st.size === 0) continue;
        let buf;
        try {
          buf = await fsp.readFile(full);
        } catch {
          continue;
        }
        if (buf.includes(0)) continue; // binary
        scanned++;
        const text = buf.toString('utf8');
        const lines = text.split('\n');
        const matches = [];
        for (let i = 0; i < lines.length && matches.length < MAX_PER_FILE; i++) {
          const line = lines[i];
          if (line.length > 2000) continue;
          re.lastIndex = 0;
          let m, ranges = [];
          while ((m = re.exec(line)) !== null) {
            ranges.push([m.index, m.index + m[0].length]);
            if (m[0].length === 0) re.lastIndex++;
            if (ranges.length > 20) break;
          }
          if (ranges.length) {
            matches.push({ line: i + 1, col: ranges[0][0] + 1, text: line.slice(0, 500), ranges });
            total++;
            if (total >= MAX_TOTAL) { truncated = true; break; }
          }
        }
        if (matches.length) {
          files.push({ path: full, rel: full.startsWith(root) ? full.slice(root.length + 1) : full, matches });
          if (files.length >= MAX_FILES) truncated = true;
        }
      }
    }
  }

  await walk(root);
  return { files, total, scanned, truncated };
});

ipcMain.handle('fs:stat', async (_e, filePath) => {
  try {
    const stat = await fsp.stat(filePath);
    return {
      exists: true,
      isDir: stat.isDirectory(),
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      large: !stat.isDirectory() && stat.size >= LARGE_FILE_BYTES
    };
  } catch {
    return { exists: false };
  }
});

// ---- build / process runner -----------------------------------------------
const procs = new Map();
ipcMain.handle('proc:run', (e, id, cmd, cwd) => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE; // never leak node-mode into spawned children
  delete env.ELECTRON_NO_ATTACH_CONSOLE;
  let child;
  try {
    child = spawn(cmd, { cwd: cwd || undefined, shell: true, env });
  } catch (err) {
    e.sender.send('proc:data', id, 'Failed to start: ' + err.message + '\n');
    e.sender.send('proc:exit', id, -1);
    return false;
  }
  procs.set(id, child);
  const send = (chunk) => { if (!e.sender.isDestroyed()) e.sender.send('proc:data', id, chunk.toString()); };
  child.stdout.on('data', send);
  child.stderr.on('data', send);
  child.on('error', (err) => send('Error: ' + err.message + '\n'));
  child.on('close', (code) => {
    procs.delete(id);
    if (!e.sender.isDestroyed()) e.sender.send('proc:exit', id, code);
  });
  return true;
});
ipcMain.handle('proc:kill', (_e, id) => {
  const c = procs.get(id);
  if (c) { try { c.kill('SIGTERM'); } catch {} }
  return true;
});

// ---- LSP (typescript-language-server over stdio) --------------------------
function lspNotify(sender, method, params) {
  if (method === 'textDocument/publishDiagnostics' && sender && !sender.isDestroyed()) {
    sender.send('lsp:diagnostics', params.uri, params.diagnostics || []);
  }
}
ipcMain.handle('lsp:available', () => lsp.available());
ipcMain.handle('lsp:didOpen', (e, root, uri, languageId, version, text) => {
  if (!lsp.available()) return false;
  const s = lsp.get(root, (m, p) => lspNotify(e.sender, m, p));
  s.whenReady(() => s.notify('textDocument/didOpen', { textDocument: { uri, languageId, version, text } }));
  return true;
});
ipcMain.handle('lsp:didChange', (_e, root, uri, version, text) => {
  const s = lsp.existing(root);
  if (s) s.whenReady(() => s.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: [{ text }] }));
});
ipcMain.handle('lsp:didClose', (_e, root, uri) => {
  const s = lsp.existing(root);
  if (s) s.whenReady(() => s.notify('textDocument/didClose', { textDocument: { uri } }));
});
ipcMain.handle('lsp:completion', (_e, root, uri, position) => {
  const s = lsp.existing(root);
  if (!s) return null;
  return new Promise((res) => s.whenReady(async () => res(await s.request('textDocument/completion', { textDocument: { uri }, position }))));
});
ipcMain.handle('lsp:hover', (_e, root, uri, position) => {
  const s = lsp.existing(root);
  if (!s) return null;
  return new Promise((res) => s.whenReady(async () => res(await s.request('textDocument/hover', { textDocument: { uri }, position }))));
});

// ---- git ------------------------------------------------------------------
ipcMain.handle('git:root', (_e, dir) => git.root(dir));
ipcMain.handle('git:status', (_e, repo) => git.status(repo));
ipcMain.handle('git:headFile', (_e, repo, absPath) => git.headFile(repo, absPath));

ipcMain.handle('app:userDataPath', () => app.getPath('userData'));

// Ensure a config file exists (create with a template if missing); return path.
ipcMain.handle('config:ensure', async (_e, name, template) => {
  const dir = app.getPath('userData');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  try {
    await fsp.access(file);
  } catch {
    await fsp.writeFile(file, template != null ? template : '{\n}\n', 'utf8');
  }
  return file;
});
// Overwrite a config file (used for the read-only "Default" panes).
ipcMain.handle('config:writeDefault', async (_e, name, content) => {
  const dir = app.getPath('userData');
  await fsp.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fsp.writeFile(file, content, 'utf8');
  return file;
});

// ---- persistent state (settings / session / recent) ----------------------
ipcMain.handle('state:get', (_e, key, fallback) => (store ? store.get(key, fallback) : fallback));
ipcMain.handle('state:set', (_e, key, value) => {
  if (store) store.set(key, value);
  return true;
});

// ---- large-file streaming engine -----------------------------------------
ipcMain.handle('lf:open', (e, filePath) => {
  const s = largefile.open(filePath);
  // Build the sparse line index in the background, streaming progress back.
  s.buildIndex((p) => {
    if (!e.sender.isDestroyed()) e.sender.send('lf:progress', s.id, p);
  }).catch((err) => console.error('index error', err));
  return { id: s.id, size: s.size, path: filePath, threshold: LARGE_FILE_BYTES };
});
ipcMain.handle('lf:lines', (_e, id, start, count) => {
  const s = largefile.get(id);
  return s ? s.readLines(start, count) : [];
});
ipcMain.handle('lf:meta', (_e, id) => {
  const s = largefile.get(id);
  return s ? { lineCount: s.lineCount, indexed: s.indexed, size: s.size } : null;
});
ipcMain.handle('lf:close', (_e, id) => {
  largefile.close(id);
  return true;
});

ipcMain.handle('fs:mkdir', async (_e, dirPath) => {
  await fsp.mkdir(dirPath, { recursive: true });
  return true;
});

ipcMain.handle('fs:rename', async (_e, from, to) => {
  await fsp.rename(from, to);
  return true;
});

// Copy a file or directory (recursive). Used by Duplicate / paste in the tree.
ipcMain.handle('fs:copy', async (_e, from, to) => {
  await fsp.cp(from, to, { recursive: true, errorOnExist: true, force: false });
  return true;
});

// Move across filesystems: try rename, fall back to copy+trash on EXDEV.
ipcMain.handle('fs:move', async (_e, from, to) => {
  try {
    await fsp.rename(from, to);
  } catch (err) {
    if (err && err.code === 'EXDEV') {
      await fsp.cp(from, to, { recursive: true, errorOnExist: true, force: false });
      await fsp.rm(from, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
  return true;
});

ipcMain.handle('fs:delete', async (_e, target) => {
  await shell.trashItem(target);
  return true;
});

ipcMain.handle('shell:showItem', (_e, target) => {
  shell.showItemInFolder(target);
  return true;
});

ipcMain.handle('win:new', async (_e, openPath) => {
  createWindow(openPath);
});

// Recent projects: persisted in the store; drives the native Open Recent submenu.
ipcMain.handle('project:recent', () => (store ? store.get('recentProjects', []) : []));
ipcMain.handle('project:addRecent', (_e, projectPath) => {
  if (!store || !projectPath) return [];
  const list = store.get('recentProjects', []).filter((p) => p !== projectPath);
  list.unshift(projectPath);
  const trimmed = list.slice(0, 15);
  store.set('recentProjects', trimmed);
  buildMenu(); // rebuild so the submenu reflects the new entry
  return trimmed;
});
ipcMain.handle('project:clearRecent', () => {
  if (store) { store.set('recentProjects', []); buildMenu(); }
  return [];
});

// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  store = new Store(path.join(app.getPath('userData'), 'state.json'), {
    session: null,
    recent: [],
    settings: {}
  });
  buildMenu();
  // Support: `lumen <path>` (skip flags and the "." app-root arg)
  const arg = process.argv
    .slice(1)
    .find((a) => !a.startsWith('-') && a !== '.' && path.resolve(a) !== __dirname && fs.existsSync(a));
  createWindow(arg ? path.resolve(arg) : undefined);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  largefile.closeAll();
  lsp.disposeAll();
  for (const c of procs.values()) { try { c.kill('SIGKILL'); } catch {} }
  if (store) store.flush();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
