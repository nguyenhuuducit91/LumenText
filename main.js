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

// View > Show Symbol — checkbox items mirroring Notepad++'s submenu, reflecting
// the persisted invisibles state.
function showSymbolSubmenu() {
  const inv = (store && store.get('invisibles', {})) || {};
  const item = (checked, label, cmd) => ({
    label, type: 'checkbox', checked: !!checked, click: () => send(cmd)
  });
  // "Show All Characters" is the union of Space/Tab + End of Line + control chars.
  const allOn = !!(inv.whitespace && inv.eol && inv.control);
  return [
    item(inv.whitespace, 'Show Space and Tab', 'view.showWhitespace'),
    item(inv.eol, 'Show End of Line', 'view.showEol'),
    item(allOn, 'Show All Characters', 'view.showAllChars'),
    { type: 'separator' },
    item(inv.guides, 'Show Indent Guide', 'view.showIndentGuides'),
    item(inv.wrap, 'Show Wrap Symbol', 'view.showWrapSymbol')
  ];
}

// View > Syntax — a curated list of common languages (full list via the picker).
function syntaxSubmenu() {
  const LANGS = [
    ['plaintext', 'Plain Text'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
    ['json', 'JSON'], ['html', 'HTML'], ['css', 'CSS'], ['scss', 'SCSS'],
    ['markdown', 'Markdown'], ['python', 'Python'], ['rust', 'Rust'], ['go', 'Go'],
    ['c', 'C'], ['cpp', 'C++'], ['java', 'Java'], ['csharp', 'C#'], ['php', 'PHP'],
    ['ruby', 'Ruby'], ['shell', 'Shell Script'], ['yaml', 'YAML'], ['xml', 'XML'],
    ['sql', 'SQL'], ['dockerfile', 'Dockerfile']
  ];
  const items = LANGS.map(([id, label]) => ({ label, click: () => send('lang.setTo', id) }));
  items.push({ type: 'separator' });
  items.push({ label: 'More Syntaxes…', click: () => send('lang.set') });
  return items;
}

// View / File > Line Endings.
function lineEndingSubmenu() {
  return [
    { label: 'Windows (CRLF)', click: () => send('file.convertCRLF') },
    { label: 'Unix (LF)', click: () => send('file.convertLF') },
    { label: 'Mac OS 9 (CR)', click: () => send('file.convertCR') }
  ];
}

// View > Indentation.
function indentationSubmenu() {
  const widths = [1, 2, 3, 4, 8].map((n) => ({
    label: 'Tab Width: ' + n, click: () => send('edit.setTabWidth', n)
  }));
  return [
    { label: 'Indent Using Spaces', click: () => send('edit.toggleSpaces') },
    { type: 'separator' },
    ...widths,
    { type: 'separator' },
    { label: 'Guess Settings From Buffer', click: () => send('edit.detectIndent') },
    { label: 'Convert Indentation to Spaces', click: () => send('edit.toSpaces') },
    { label: 'Convert Indentation to Tabs', click: () => send('edit.toTabs') }
  ];
}

// View / Preferences > Font.  Pass accel=false on the second copy so the same
// accelerator is not registered twice (Electron ignores duplicate accelerators).
function fontSubmenu(accel = true) {
  return [
    { label: 'Larger', accelerator: accel ? 'CmdOrCtrl+=' : undefined, click: () => send('view.fontLarger') },
    { label: 'Smaller', accelerator: accel ? 'CmdOrCtrl+-' : undefined, click: () => send('view.fontSmaller') },
    { label: 'Reset', accelerator: accel ? 'CmdOrCtrl+0' : undefined, click: () => send('view.fontReset') }
  ];
}

// View > Side Bar — visibility toggles for the main UI chrome.
function sideBarSubmenu() {
  return [
    { label: 'Toggle Side Bar', accelerator: 'CmdOrCtrl+B', click: () => send('view.toggleSidebar') },
    { label: 'Toggle Tabs', click: () => send('view.toggleTabs') },
    { label: 'Toggle Minimap', click: () => send('view.toggleMinimap') },
    { label: 'Toggle Status Bar', click: () => send('view.toggleStatusBar') }
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
        { label: 'Open Recent…', click: () => send('file.openRecent') },
        { label: 'Reopen Closed File', accelerator: 'CmdOrCtrl+Shift+T', click: () => send('file.reopenClosed') },
        { type: 'separator' },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('file.save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('file.saveAs') },
        { label: 'Save All', accelerator: 'CmdOrCtrl+Alt+S', click: () => send('file.saveAll') },
        { label: 'Revert File', click: () => send('file.revert') },
        { type: 'separator' },
        { label: 'Line Endings', submenu: lineEndingSubmenu() },
        { type: 'separator' },
        { label: 'Close File', accelerator: 'CmdOrCtrl+W', click: () => send('file.closeTab') },
        { label: 'Close All Files', click: () => send('tab.closeAll') },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+Shift+W', click: () => send('file.closeWindow') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        {
          label: 'Undo Selection',
          submenu: [
            { label: 'Soft Undo', accelerator: 'CmdOrCtrl+U', click: () => send('edit.softUndo') },
            { label: 'Soft Redo', accelerator: 'CmdOrCtrl+Shift+U', click: () => send('edit.softRedo') }
          ]
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { label: 'Paste and Indent', accelerator: 'CmdOrCtrl+Shift+V', click: () => send('edit.pasteAndIndent') },
        { type: 'separator' },
        {
          label: 'Line',
          submenu: [
            { label: 'Indent', accelerator: 'CmdOrCtrl+]', click: () => send('edit.indent') },
            { label: 'Unindent', accelerator: 'CmdOrCtrl+[', click: () => send('edit.outdent') },
            { label: 'Reindent Lines', click: () => send('edit.reindent') },
            { type: 'separator' },
            { label: 'Swap Line Up', accelerator: 'CmdOrCtrl+Shift+Up', click: () => send('edit.moveLineUp') },
            { label: 'Swap Line Down', accelerator: 'CmdOrCtrl+Shift+Down', click: () => send('edit.moveLineDown') },
            { label: 'Duplicate Line', accelerator: 'CmdOrCtrl+Shift+D', click: () => send('edit.duplicateLine') },
            { label: 'Delete Line', accelerator: 'CmdOrCtrl+Shift+K', click: () => send('edit.deleteLine') },
            { label: 'Join Lines', accelerator: 'CmdOrCtrl+J', click: () => send('edit.joinLines') }
          ]
        },
        {
          label: 'Comment',
          submenu: [
            { label: 'Toggle Comment', accelerator: 'CmdOrCtrl+/', click: () => send('edit.commentLine') },
            { label: 'Toggle Block Comment', accelerator: 'CmdOrCtrl+Shift+/', click: () => send('edit.blockComment') }
          ]
        },
        {
          label: 'Text',
          submenu: [
            { label: 'Insert Line Before', accelerator: 'CmdOrCtrl+Shift+Enter', click: () => send('edit.insertLineBefore') },
            { label: 'Insert Line After', accelerator: 'CmdOrCtrl+Enter', click: () => send('edit.insertLineAfter') },
            { type: 'separator' },
            { label: 'Delete Word Forward', click: () => send('edit.deleteWordForward') },
            { label: 'Delete Word Backward', click: () => send('edit.deleteWordBackward') },
            { label: 'Delete to End of Line', click: () => send('edit.deleteToEOL') },
            { label: 'Delete to Beginning of Line', click: () => send('edit.deleteToBOL') },
            { type: 'separator' },
            { label: 'Transpose', click: () => send('edit.transpose') }
          ]
        },
        {
          label: 'Convert Case',
          submenu: [
            { label: 'Upper Case  (Ctrl+K Ctrl+U)', click: () => send('edit.upperCase') },
            { label: 'Lower Case  (Ctrl+K Ctrl+L)', click: () => send('edit.lowerCase') },
            { label: 'Title Case', click: () => send('edit.titleCase') },
            { label: 'Swap Case', click: () => send('edit.swapCase') },
            { type: 'separator' },
            { label: 'lowerCamelCase', click: () => send('edit.camelLower') },
            { label: 'UpperCamelCase', click: () => send('edit.camelUpper') },
            { label: 'snake_case', click: () => send('edit.snake') },
            { label: 'kebab-case', click: () => send('edit.kebab') }
          ]
        },
        {
          label: 'Wrap',
          submenu: [
            { label: 'Wrap Paragraph at Ruler', click: () => send('edit.wrapParagraph') }
          ]
        },
        {
          label: 'Code Folding',
          submenu: [
            { label: 'Fold', accelerator: 'CmdOrCtrl+Shift+[', click: () => send('edit.fold') },
            { label: 'Unfold', accelerator: 'CmdOrCtrl+Shift+]', click: () => send('edit.unfold') },
            { label: 'Fold All', click: () => send('edit.foldAll') },
            { label: 'Unfold All', accelerator: 'CmdOrCtrl+K CmdOrCtrl+0', click: () => send('edit.unfoldAll') },
            { type: 'separator' },
            { label: 'Fold Level 2', click: () => send('edit.foldLevel2') },
            { label: 'Fold Level 3', click: () => send('edit.foldLevel3') },
            { label: 'Fold Level 4', click: () => send('edit.foldLevel4') },
            { label: 'Fold Level 5', click: () => send('edit.foldLevel5') },
            { label: 'Fold Level 6', click: () => send('edit.foldLevel6') },
            { label: 'Fold Level 7', click: () => send('edit.foldLevel7') }
          ]
        },
        { type: 'separator' },
        { label: 'Sort Lines', accelerator: 'F9', click: () => send('edit.sortAsc') },
        { label: 'Sort Lines (Case Sensitive)', accelerator: 'CmdOrCtrl+F9', click: () => send('edit.sortDesc') },
        {
          label: 'Permute Lines',
          submenu: [
            { label: 'Reverse', click: () => send('edit.permuteReverse') },
            { label: 'Unique', click: () => send('edit.permuteUnique') },
            { label: 'Shuffle', click: () => send('edit.permuteShuffle') }
          ]
        },
        {
          label: 'Permute Selections',
          submenu: [
            { label: 'Sort', click: () => send('sel.permuteSort') },
            { label: 'Sort (Case Sensitive)', click: () => send('sel.permuteSortCS') },
            { label: 'Reverse', click: () => send('sel.permuteReverse') },
            { label: 'Unique', click: () => send('sel.permuteUnique') },
            { label: 'Shuffle', click: () => send('sel.permuteShuffle') }
          ]
        },
        { label: 'Trim Trailing White Space', click: () => send('edit.trimTrailing') },
        { type: 'separator' },
        { label: 'Format Document', accelerator: 'CmdOrCtrl+Alt+F', click: () => send('edit.format') }
      ]
    },
    {
      label: 'Selection',
      submenu: [
        { label: 'Split into Lines', accelerator: 'CmdOrCtrl+Shift+L', click: () => send('sel.splitLines') },
        { label: 'Add Previous Line', accelerator: 'Alt+Shift+Up', click: () => send('sel.addCursorUp') },
        { label: 'Add Next Line', accelerator: 'Alt+Shift+Down', click: () => send('sel.addCursorDown') },
        { label: 'Single Selection', click: () => send('sel.single') },
        { label: 'Invert Selection', click: () => send('sel.invert') },
        { type: 'separator' },
        { role: 'selectAll' },
        { label: 'Expand Selection', accelerator: 'Shift+Alt+Right', click: () => send('sel.expand') },
        { label: 'Shrink Selection', accelerator: 'Shift+Alt+Left', click: () => send('sel.shrink') },
        { label: 'Expand Selection to Line', accelerator: 'CmdOrCtrl+L', click: () => send('sel.expandToLine') },
        { label: 'Expand Selection to Brackets', accelerator: 'CmdOrCtrl+Shift+M', click: () => send('sel.expandToBrackets') },
        { label: 'Expand Selection to Scope', click: () => send('sel.expandToScope') },
        { type: 'separator' },
        { label: 'Add Next Occurrence', accelerator: 'CmdOrCtrl+D', click: () => send('edit.selectNext') },
        { label: 'Select All Occurrences', accelerator: 'Alt+F3', click: () => send('sel.selectAllOcc') }
      ]
    },
    {
      label: 'Find',
      submenu: [
        { label: 'Find…', accelerator: 'CmdOrCtrl+F', click: () => send('edit.find') },
        { label: 'Find Next', accelerator: 'F3', click: () => send('edit.findNext') },
        { label: 'Find Previous', accelerator: 'Shift+F3', click: () => send('edit.findPrev') },
        { label: 'Incremental Find', accelerator: 'CmdOrCtrl+I', click: () => send('edit.incrementalFind') },
        { type: 'separator' },
        { label: 'Replace…', accelerator: 'CmdOrCtrl+H', click: () => send('edit.replace') },
        { type: 'separator' },
        { label: 'Use Selection for Find', accelerator: 'CmdOrCtrl+E', click: () => send('find.useSelection') },
        { type: 'separator' },
        { label: 'Find in Files…', accelerator: 'CmdOrCtrl+Shift+F', click: () => send('find.inFiles') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Side Bar', submenu: sideBarSubmenu() },
        { label: 'Show Symbol', submenu: showSymbolSubmenu() },
        { type: 'separator' },
        { label: 'Enter Distraction Free Mode', accelerator: 'Shift+F11', click: () => send('view.zen') },
        {
          label: 'Layout',
          submenu: [
            { label: 'Single', accelerator: 'Alt+Shift+1', click: () => send('view.split1') },
            { label: 'Columns: 2', accelerator: 'Alt+Shift+2', click: () => send('view.split2') },
            { label: 'Columns: 3', accelerator: 'Alt+Shift+3', click: () => send('view.split3') }
          ]
        },
        { type: 'separator' },
        { label: 'Syntax', submenu: syntaxSubmenu() },
        { label: 'Indentation', submenu: indentationSubmenu() },
        { label: 'Line Endings', submenu: lineEndingSubmenu() },
        { type: 'separator' },
        { label: 'Word Wrap', accelerator: 'Alt+Z', click: () => send('view.wordWrap') },
        { label: 'Toggle Rulers (80 / 120)', click: () => send('view.rulers') },
        { label: 'Font', submenu: fontSubmenu(true) },
        { type: 'separator' },
        { label: 'Color Scheme…', click: () => send('view.theme') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Goto',
      submenu: [
        { label: 'Goto Anything…', accelerator: 'CmdOrCtrl+P', click: () => send('goto.anything') },
        { label: 'Goto Symbol…', accelerator: 'CmdOrCtrl+R', click: () => send('goto.symbol') },
        { label: 'Goto Symbol in Project…', accelerator: 'CmdOrCtrl+Shift+R', click: () => send('goto.projectSymbol') },
        { label: 'Goto Definition', accelerator: 'F12', click: () => send('goto.definition') },
        { label: 'Goto Line…', accelerator: 'CmdOrCtrl+G', click: () => send('goto.line') },
        { label: 'Goto Word in File… (#)', click: () => send('goto.word') },
        { type: 'separator' },
        { label: 'Jump Back', accelerator: 'Alt+Left', click: () => send('nav.back') },
        { label: 'Jump Forward', accelerator: 'Alt+Right', click: () => send('nav.forward') },
        { label: 'Jump to Matching Bracket', accelerator: 'CmdOrCtrl+M', click: () => send('sel.jumpBracket') },
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
        { label: 'Command Palette…', accelerator: 'CmdOrCtrl+Shift+P', click: () => send('goto.command') },
        { label: 'Snippets…', click: () => send('snippet.insert') },
        { type: 'separator' },
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
        { type: 'separator' },
        { label: 'Color Scheme…', click: () => send('view.theme') },
        { label: 'Font', submenu: fontSubmenu(false) },
        { type: 'separator' },
        {
          label: 'Auto Save',
          submenu: [
            { label: 'Off', click: () => send('prefs.autosave.off') },
            { label: 'After Delay', click: () => send('prefs.autosave.delay') },
            { label: 'On Focus Change', click: () => send('prefs.autosave.focus') }
          ]
        }
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
  // Keep the View > Show Symbol checkboxes in sync when toggled from anywhere.
  if (key === 'invisibles') buildMenu();
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
ipcMain.handle('win:close', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.close();
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
