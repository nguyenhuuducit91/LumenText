'use strict';
window.LUM = window.LUM || {};

LUM.state = { theme: 'stp-mariana', sidebar: true, minimap: true };

LUM.app = (function () {
  // ---- toast --------------------------------------------------------------
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById('status-left');
    if (!el) return;
    const prev = el.textContent;
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => LUM.editor.updateStatus(), 1800);
  }

  // ---- themes -------------------------------------------------------------
  function defineThemes() {
    // Default: Mariana — Sublime Text 4's out-of-the-box color scheme (navy #303841,
    // orange caret). Chrome (CSS :root) shares the same base for a seamless look.
    monaco.editor.defineTheme('stp-mariana', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: 'a6acb9', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c594c5' },
        { token: 'keyword.operator', foreground: '5fb3b3' },
        { token: 'storage', foreground: 'c594c5' },
        { token: 'string', foreground: '99c794' },
        { token: 'number', foreground: 'f9ae58' },
        { token: 'constant', foreground: 'f9ae58' },
        { token: 'constant.language', foreground: 'f9ae58' },
        { token: 'regexp', foreground: '99c794' },
        { token: 'type', foreground: '5fb3b3' },
        { token: 'class', foreground: 'fac863' },
        { token: 'function', foreground: '6699cc' },
        { token: 'variable', foreground: 'd8dee9' },
        { token: 'variable.predefined', foreground: 'ec5f67' },
        { token: 'operator', foreground: '5fb3b3' },
        { token: 'delimiter', foreground: 'd8dee9' },
        { token: 'tag', foreground: 'ec5f67' },
        { token: 'attribute.name', foreground: 'f9ae58' },
        { token: 'attribute.value', foreground: '99c794' }
      ],
      colors: {
        'editor.background': '#303841',
        'editor.foreground': '#d8dee9',
        'editor.lineHighlightBackground': '#3b444d80',
        'editor.selectionBackground': '#4f5b66',
        'editor.inactiveSelectionBackground': '#404b54',
        'editor.selectionHighlightBackground': '#4f5b6680',
        'editor.findMatchBackground': '#f9ae5866',
        'editor.findMatchHighlightBackground': '#f9ae5833',
        'editor.wordHighlightBackground': '#4f5b6655',
        'editorCursor.foreground': '#f9ae58',
        'editorLineNumber.foreground': '#65737e',
        'editorLineNumber.activeForeground': '#d8dee9',
        'editorIndentGuide.background1': '#3b444d',
        'editorIndentGuide.activeBackground1': '#5c6773',
        'editorWhitespace.foreground': '#3f4852',
        'editorGutter.background': '#303841',
        'editorBracketMatch.background': '#00000000',
        'editorBracketMatch.border': '#5fb3b3',
        'minimap.background': '#303841',
        'scrollbarSlider.background': '#3b444daa',
        'scrollbarSlider.hoverBackground': '#4a5560cc',
        'scrollbarSlider.activeBackground': '#5c6773cc',
        'editorWidget.background': '#2a3138',
        'editorSuggestWidget.background': '#2a3138',
        'editorSuggestWidget.selectedBackground': '#4f5b66',
        'editorSuggestWidget.border': '#21272e',
        'editorHoverWidget.background': '#2a3138',
        'editorHoverWidget.border': '#21272e',
        'input.background': '#242a30',
        'focusBorder': '#6699cc',
        'editorError.foreground': '#ec5f67',
        'editorWarning.foreground': '#f9ae58',
        'editorStickyScroll.background': '#2a3138'
      }
    });
    // Default cohesive theme — chrome (CSS) and editor share the One-Dark base.
    monaco.editor.defineTheme('stp-onedark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '7f848e', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c678dd' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'regexp', foreground: '56b6c2' },
        { token: 'type', foreground: 'e5c07b' },
        { token: 'class', foreground: 'e5c07b' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'e06c75' },
        { token: 'variable.predefined', foreground: 'd19a66' },
        { token: 'constant', foreground: 'd19a66' },
        { token: 'operator', foreground: '56b6c2' },
        { token: 'delimiter', foreground: 'abb2bf' },
        { token: 'tag', foreground: 'e06c75' },
        { token: 'attribute.name', foreground: 'd19a66' }
      ],
      colors: {
        'editor.background': '#282c34',
        'editor.foreground': '#abb2bf',
        'editor.lineHighlightBackground': '#2c313a',
        'editor.selectionBackground': '#3e4451',
        'editor.inactiveSelectionBackground': '#3a3f4b',
        'editorCursor.foreground': '#528bff',
        'editorLineNumber.foreground': '#4b5263',
        'editorLineNumber.activeForeground': '#abb2bf',
        'editorIndentGuide.background1': '#2f343d',
        'editorIndentGuide.activeBackground1': '#4b5263',
        'editorWhitespace.foreground': '#3b4048',
        'editorGutter.background': '#282c34',
        'minimap.background': '#282c34',
        'scrollbarSlider.background': '#3a3f4b80',
        'scrollbarSlider.hoverBackground': '#4b515faa',
        'editorWidget.background': '#21252b',
        'editorSuggestWidget.background': '#21252b',
        'editorSuggestWidget.selectedBackground': '#2c313a',
        'input.background': '#1b1d23',
        'focusBorder': '#61afef'
      }
    });
    monaco.editor.defineTheme('stp-monokai', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'f92672' },
        { token: 'string', foreground: 'e6db74' },
        { token: 'number', foreground: 'ae81ff' },
        { token: 'type', foreground: '66d9ef', fontStyle: 'italic' },
        { token: 'function', foreground: 'a6e22e' },
        { token: 'variable', foreground: 'f8f8f2' },
        { token: 'constant', foreground: 'ae81ff' }
      ],
      colors: {
        'editor.background': '#272822',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#3e3d32',
        'editor.selectionBackground': '#49483e',
        'editorCursor.foreground': '#f8f8f0',
        'editorLineNumber.foreground': '#90908a',
        'editorLineNumber.activeForeground': '#f8f8f2',
        'editorIndentGuide.background1': '#3b3a32',
        'minimap.background': '#272822'
      }
    });
    monaco.editor.defineTheme('stp-light', {
      base: 'vs', inherit: true, rules: [],
      colors: { 'editor.background': '#fafafa' }
    });
  }

  const THEMES = [
    { id: 'auto', label: 'Adaptive (follow system)' },
    { id: 'stp-mariana', label: 'Mariana (default)' },
    { id: 'stp-onedark', label: 'One Dark' },
    { id: 'stp-monokai', label: 'Monokai (Sublime)' },
    { id: 'vs-dark', label: 'Dark (Visual Studio)' },
    { id: 'hc-black', label: 'High Contrast Dark' },
    { id: 'stp-light', label: 'Light' },
    { id: 'vs', label: 'Light (Visual Studio)' }
  ];

  function systemPrefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme(id) {
    LUM.state.theme = id;
    const resolved = id === 'auto' ? (systemPrefersDark() ? 'stp-mariana' : 'vs') : id;
    LUM.editor.setTheme(resolved);
    const light = resolved === 'vs' || resolved === 'stp-light';
    document.documentElement.classList.toggle('light', light);
  }

  // Sublime-style chord keybindings that the Electron menu can't express.
  function registerEditorKeybindings() {
    const K = monaco.KeyMod, C = monaco.KeyCode;
    const rules = [
      { keybinding: K.chord(K.CtrlCmd | C.KeyK, K.CtrlCmd | C.KeyU), command: 'editor.action.transformToUppercase' },
      { keybinding: K.chord(K.CtrlCmd | C.KeyK, K.CtrlCmd | C.KeyL), command: 'editor.action.transformToLowercase' },
      // Batch A — Sublime editor keys
      { keybinding: C.Enter | K.CtrlCmd, command: 'editor.action.insertLineAfter' },
      { keybinding: C.Enter | K.CtrlCmd | K.Shift, command: 'editor.action.insertLineBefore' },
      { keybinding: C.KeyU | K.CtrlCmd, command: 'cursorUndo' },
      { keybinding: C.KeyU | K.CtrlCmd | K.Shift, command: 'cursorRedo' },
      { keybinding: C.KeyL | K.CtrlCmd, command: 'editor.action.expandLineSelection' },
      { keybinding: C.KeyM | K.CtrlCmd, command: 'editor.action.jumpToBracket' },
      { keybinding: C.KeyM | K.CtrlCmd | K.Shift, command: 'editor.action.selectToBracket' },
      { keybinding: C.UpArrow | K.Alt | K.Shift, command: 'editor.action.insertCursorAbove' },
      { keybinding: C.DownArrow | K.Alt | K.Shift, command: 'editor.action.insertCursorBelow' },
      { keybinding: K.chord(K.CtrlCmd | C.KeyK, K.CtrlCmd | C.Digit0), command: 'editor.unfoldAll' }
    ];
    // Fold Level 2..7 → Ctrl+K Ctrl+2..7 (Monaco tops out at level 7)
    const digit = { 2: C.Digit2, 3: C.Digit3, 4: C.Digit4, 5: C.Digit5, 6: C.Digit6, 7: C.Digit7 };
    for (let n = 2; n <= 7; n++) {
      rules.push({ keybinding: K.chord(K.CtrlCmd | C.KeyK, K.CtrlCmd | digit[n]), command: 'editor.foldLevel' + n });
    }
    monaco.editor.addKeybindingRules(rules);
  }

  // ---- commands -----------------------------------------------------------
  function registerCommands() {
    const C = LUM.commands;
    const E = LUM.editor;
    const P = LUM.palette;
    const def = (id, title, category, keybind, run) => C.register({ id, title, category, keybind, run });

    def('file.new', 'New File', 'File', 'Ctrl+N', () => E.newFile());
    def('file.open', 'Open File…', 'File', 'Ctrl+O', openFiles);
    def('file.openFolder', 'Open Folder…', 'File', '', openFolder);
    def('file.save', 'Save', 'File', 'Ctrl+S', () => E.saveBuffer());
    def('file.saveAs', 'Save As…', 'File', 'Ctrl+Shift+S', () => E.saveBufferAs());
    def('file.saveAll', 'Save All', 'File', 'Ctrl+Alt+S', () => E.saveAll());
    def('file.closeTab', 'Close Tab', 'File', 'Ctrl+W', () => E.closeBuffer());
    def('file.newWindow', 'New Window', 'File', 'Ctrl+Shift+N', () => window.lumenText.newWindow());
    def('file.openRecent', 'Open Recent…', 'File', '', openRecent);
    def('file.reopenClosed', 'Reopen Closed File', 'File', 'Ctrl+Shift+T', () => E.reopenClosed());
    def('file.closeWindow', 'Close Window', 'File', 'Ctrl+Shift+W', () => window.lumenText.closeWindow());
    def('file.revert', 'Revert File', 'File', '', () => E.revertActive());
    def('file.reopenEncoding', 'Reopen with Encoding…', 'File', '', () => pickEncoding('reopen'));
    def('file.saveEncoding', 'Save with Encoding…', 'File', '', () => pickEncoding('save'));
    def('file.convertLF', 'Line Endings: Convert to LF (Unix)', 'File', '', () => E.setEOL('LF'));
    def('file.convertCRLF', 'Line Endings: Convert to CRLF (Windows)', 'File', '', () => E.setEOL('CRLF'));

    // Sidebar file operations (also reachable from the tree context menu).
    const S = LUM.sidebar;
    const sideDir = async () => { const t = S.commandTarget(); return (await S.isDirPath(t)) ? t : window.lumenText.dirname(t); };
    def('side.newFile', 'New File in Folder', 'Sidebar', '', async () => S.startCreate(await sideDir(), false));
    def('side.newFolder', 'New Folder', 'Sidebar', '', async () => S.startCreate(await sideDir(), true));
    // No default key: F2 is Next Bookmark (Sublime). Rename via context menu / palette.
    def('side.rename', 'Rename File/Folder', 'Sidebar', '', async () => { const t = S.commandTarget(); if (t && t !== S.root) S.startRename(t, await S.isDirPath(t)); });
    def('side.delete', 'Delete File/Folder', 'Sidebar', '', async () => { const t = S.commandTarget(); if (t && t !== S.root) S.doDelete(t, await S.isDirPath(t)); });
    def('side.duplicate', 'Duplicate File/Folder', 'Sidebar', '', async () => { const t = S.commandTarget(); if (t && t !== S.root) S.doDuplicate(t, await S.isDirPath(t)); });
    def('side.copyPath', 'Copy Path', 'Sidebar', '', () => { const t = S.commandTarget(); if (t) S.copyPath(t, false); });
    def('side.copyRelPath', 'Copy Relative Path', 'Sidebar', '', () => { const t = S.commandTarget(); if (t) S.copyPath(t, true); });
    def('side.reveal', 'Reveal in File Manager', 'Sidebar', '', () => { const t = S.commandTarget(); if (t) S.reveal(t); });
    def('side.collapseAll', 'Sidebar: Collapse All', 'Sidebar', '', () => S.collapseAll());
    def('side.refresh', 'Sidebar: Refresh', 'Sidebar', '', () => S.refresh());
    def('side.revealActive', 'Reveal Active File in Sidebar', 'Sidebar', '', () => { const b = E.activeBuffer(); if (b && b.path) S.revealInSidebar(b.path); });

    // Preferences / configuration
    def('prefs.settings', 'Preferences: Settings', 'Preferences', 'Ctrl+,', () => LUM.settings.openUI());
    def('prefs.keymap', 'Preferences: Key Bindings', 'Preferences', '', () => LUM.keymap.openUI());
    def('prefs.autosave.off', 'Auto Save: Off', 'Preferences', '', () => setAutoSave('off'));
    def('prefs.autosave.delay', 'Auto Save: After Delay', 'Preferences', '', () => setAutoSave('afterDelay'));
    def('prefs.autosave.focus', 'Auto Save: On Focus Change', 'Preferences', '', () => setAutoSave('onFocusChange'));

    def('goto.anything', 'Goto Anything (files)', 'Goto', 'Ctrl+P', () => P.open('file'));
    def('goto.command', 'Command Palette', 'Goto', 'Ctrl+Shift+P', () => P.open('command', ''));
    def('goto.line', 'Goto Line…', 'Goto', 'Ctrl+G', () => P.open('line'));
    def('goto.symbol', 'Goto Symbol…', 'Goto', 'Ctrl+R', () => P.open('symbol'));
    def('goto.projectSymbol', 'Goto Symbol in Project…', 'Goto', 'Ctrl+Shift+R', () => LUM.symbols.goto());
    def('nav.back', 'Jump Back', 'Goto', 'Alt+Left', () => LUM.nav.back());
    def('nav.forward', 'Jump Forward', 'Goto', 'Alt+Right', () => LUM.nav.forward());

    // Find / Replace (in-file) — Sublime-style bottom bar (LUM.find)
    def('edit.find', 'Find', 'Find', 'Ctrl+F', () => LUM.find.open(false));
    def('edit.replace', 'Replace', 'Find', 'Ctrl+H', () => LUM.find.open(true));
    def('edit.findNext', 'Find Next', 'Find', 'F3', () => LUM.find.next());
    def('edit.findPrev', 'Find Previous', 'Find', 'Shift+F3', () => LUM.find.prev());
    def('edit.incrementalFind', 'Incremental Find', 'Find', 'Ctrl+I', () => LUM.find.open(false));
    def('find.inFiles', 'Find in Files…', 'Find', 'Ctrl+Shift+F', () => LUM.findInFiles.open());

    // Multi-cursor / selection
    def('edit.selectNext', 'Add Next Occurrence to Selection', 'Selection', 'Ctrl+D', () => triggerAction('editor.action.addSelectionToNextFindMatch'));
    def('sel.selectAllOcc', 'Select All Occurrences', 'Selection', 'Alt+F3', () => triggerAction('editor.action.selectHighlights'));
    def('sel.splitLines', 'Split Selection Into Lines', 'Selection', 'Ctrl+Shift+L', () => triggerAction('editor.action.insertCursorAtEndOfEachLineSelected'));
    def('sel.expand', 'Expand Selection', 'Selection', 'Shift+Alt+Right', () => triggerAction('editor.action.smartSelect.expand'));
    def('sel.shrink', 'Shrink Selection', 'Selection', 'Shift+Alt+Left', () => triggerAction('editor.action.smartSelect.shrink'));

    // Line operations
    def('edit.moveLineUp', 'Move Line Up', 'Line', 'Ctrl+Shift+Up', () => triggerAction('editor.action.moveLinesUpAction'));
    def('edit.moveLineDown', 'Move Line Down', 'Line', 'Ctrl+Shift+Down', () => triggerAction('editor.action.moveLinesDownAction'));
    def('edit.duplicateLine', 'Duplicate Line', 'Line', 'Ctrl+Shift+D', () => triggerAction('editor.action.copyLinesDownAction'));
    def('edit.deleteLine', 'Delete Line', 'Line', 'Ctrl+Shift+K', () => triggerAction('editor.action.deleteLines'));
    def('edit.joinLines', 'Join Lines', 'Line', 'Ctrl+J', () => triggerAction('editor.action.joinLines'));
    def('edit.indent', 'Indent Lines', 'Line', 'Ctrl+]', () => triggerAction('editor.action.indentLines'));
    def('edit.outdent', 'Outdent Lines', 'Line', 'Ctrl+[', () => triggerAction('editor.action.outdentLines'));
    def('edit.sortAsc', 'Sort Lines Ascending', 'Line', 'F9', () => triggerAction('editor.action.sortLinesAscending'));
    def('edit.sortDesc', 'Sort Lines Descending', 'Line', 'Ctrl+F9', () => triggerAction('editor.action.sortLinesDescending'));
    def('edit.transpose', 'Transpose', 'Line', '', () => triggerAction('editor.action.transpose'));
    def('edit.reindent', 'Reindent Lines', 'Line', '', () => triggerAction('editor.action.reindentlines'));
    def('edit.toSpaces', 'Convert Indentation to Spaces', 'Line', '', () => triggerAction('editor.action.indentationToSpaces'));
    def('edit.toTabs', 'Convert Indentation to Tabs', 'Line', '', () => triggerAction('editor.action.indentationToTabs'));
    def('edit.detectIndent', 'Detect Indentation', 'Line', '', () => triggerAction('editor.action.detectIndentation'));

    // Comments
    def('edit.commentLine', 'Toggle Line Comment', 'Edit', 'Ctrl+/', () => triggerAction('editor.action.commentLine'));
    def('edit.blockComment', 'Toggle Block Comment', 'Edit', 'Ctrl+Shift+/', () => triggerAction('editor.action.blockComment'));

    // Case transforms
    def('edit.upperCase', 'Convert to Upper Case', 'Edit', 'Ctrl+K Ctrl+U', () => triggerAction('editor.action.transformToUppercase'));
    def('edit.lowerCase', 'Convert to Lower Case', 'Edit', 'Ctrl+K Ctrl+L', () => triggerAction('editor.action.transformToLowercase'));
    def('edit.titleCase', 'Convert to Title Case', 'Edit', '', () => triggerAction('editor.action.transformToTitlecase'));

    def('edit.format', 'Format Document', 'Edit', 'Ctrl+Alt+F', () => triggerAction('editor.action.formatDocument'));
    // Monaco-backed undo/redo so the Edit menu (mouse) hits the model's undo
    // stack, not the native webContents undo (which ignores Monaco).
    def('edit.undo', 'Undo', 'Edit', 'Ctrl+Z', () => triggerAction('undo'));
    def('edit.redo', 'Redo', 'Edit', 'Ctrl+Y', () => triggerAction('redo'));
    def('edit.fold', 'Fold', 'Edit', 'Ctrl+Shift+[', () => triggerAction('editor.fold'));
    def('edit.unfold', 'Unfold', 'Edit', 'Ctrl+Shift+]', () => triggerAction('editor.unfold'));
    def('edit.foldAll', 'Fold All', 'Edit', '', () => triggerAction('editor.foldAll'));
    def('edit.unfoldAll', 'Unfold All', 'Edit', 'Ctrl+K Ctrl+0', () => triggerAction('editor.unfoldAll'));

    // ===== Batch A: extra Convert Case / Permute / Edit ops (palette-first) ===
    const T = LUM.textops;
    // A1/A7 — Convert Case variants (Sublime captions, palette-only)
    def('edit.swapCase', 'Convert Case: Swap Case', 'Edit', '', () => T.applyCase('swap'));
    def('edit.camelLower', 'Convert Case: lowerCamelCase', 'Edit', '', () => T.applyCase('lowerCamel'));
    def('edit.camelUpper', 'Convert Case: UpperCamelCase', 'Edit', '', () => T.applyCase('upperCamel'));
    def('edit.snake', 'Convert Case: snake_case', 'Edit', '', () => T.applyCase('snake'));
    def('edit.kebab', 'Convert Case: kebab-case', 'Edit', '', () => T.applyCase('kebab'));
    def('edit.rot13', 'Rot13 Selection', 'Edit', '', () => T.rot13());
    // A2 — Permute Lines
    def('edit.permuteReverse', 'Permute Lines: Reverse', 'Edit', '', () => T.permuteLines('reverse'));
    def('edit.permuteUnique', 'Permute Lines: Unique', 'Edit', '', () => T.permuteLines('unique'));
    def('edit.permuteShuffle', 'Permute Lines: Shuffle', 'Edit', '', () => T.permuteLines('shuffle'));
    // A2 — Permute Selections
    def('sel.permuteSort', 'Permute Selections: Sort', 'Selection', '', () => T.permuteSelections('sort'));
    def('sel.permuteSortCS', 'Permute Selections: Sort (Case Sensitive)', 'Selection', '', () => T.permuteSelections('sortCS'));
    def('sel.permuteReverse', 'Permute Selections: Reverse', 'Selection', '', () => T.permuteSelections('reverse'));
    def('sel.permuteUnique', 'Permute Selections: Unique', 'Selection', '', () => T.permuteSelections('unique'));
    def('sel.permuteShuffle', 'Permute Selections: Shuffle', 'Selection', '', () => T.permuteSelections('shuffle'));
    // A3 — Trim / line insert / delete-to / soft undo (Monaco actions)
    def('edit.trimTrailing', 'Trim Trailing White Space', 'Edit', '', () => triggerAction('editor.action.trimTrailingWhitespace'));
    def('edit.insertLineAfter', 'Insert Line After', 'Edit', 'Ctrl+Enter', () => triggerAction('editor.action.insertLineAfter'));
    def('edit.insertLineBefore', 'Insert Line Before', 'Edit', 'Ctrl+Shift+Enter', () => triggerAction('editor.action.insertLineBefore'));
    def('edit.deleteToEOL', 'Delete to End of Line', 'Edit', '', () => triggerAction('deleteAllRight'));
    def('edit.deleteToBOL', 'Delete to Beginning of Line', 'Edit', '', () => triggerAction('deleteAllLeft'));
    def('edit.softUndo', 'Soft Undo', 'Edit', 'Ctrl+U', () => triggerAction('cursorUndo'));
    def('edit.softRedo', 'Soft Redo', 'Edit', 'Ctrl+Shift+U', () => triggerAction('cursorRedo'));
    // A4 — Fold by level (Monaco supports up to level 7)
    for (let n = 2; n <= 7; n++) {
      def('edit.foldLevel' + n, 'Code Folding: Fold Level ' + n, 'Edit', 'Ctrl+K Ctrl+' + n, ((lvl) => () => triggerAction('editor.foldLevel' + lvl))(n));
    }
    // A5 — Wrap paragraph / show completions
    def('edit.wrapParagraph', 'Wrap Paragraph at Ruler', 'Edit', '', () => T.wrapParagraph());
    def('edit.showCompletions', 'Show Completions', 'Edit', 'Ctrl+Space', () => triggerAction('editor.action.triggerSuggest'));
    // A6 — Expand selection variants + add-line cursors + jump bracket
    def('sel.expandToLine', 'Expand Selection to Line', 'Selection', 'Ctrl+L', () => triggerAction('editor.action.expandLineSelection'));
    def('sel.expandToBrackets', 'Expand Selection to Brackets', 'Selection', 'Ctrl+Shift+M', () => triggerAction('editor.action.selectToBracket'));
    def('sel.expandToScope', 'Expand Selection to Scope', 'Selection', '', () => triggerAction('editor.action.smartSelect.expand'));
    def('sel.addCursorUp', 'Add Previous Line (cursor above)', 'Selection', 'Alt+Shift+Up', () => triggerAction('editor.action.insertCursorAbove'));
    def('sel.addCursorDown', 'Add Next Line (cursor below)', 'Selection', 'Alt+Shift+Down', () => triggerAction('editor.action.insertCursorBelow'));
    def('sel.jumpBracket', 'Jump to Matching Bracket', 'Selection', 'Ctrl+M', () => triggerAction('editor.action.jumpToBracket'));
    def('sel.selectAll', 'Select All', 'Selection', 'Ctrl+A', () => triggerAction('editor.action.selectAll'));
    def('sel.single', 'Single Selection', 'Selection', '', () => triggerAction('removeSecondaryCursors'));
    // No default key: Ctrl+Shift+I is DevTools. Reachable via palette / Selection menu.
    def('sel.invert', 'Invert Selection', 'Selection', '', invertSelection);

    // Text editing (Sublime's Edit > Text submenu)
    def('edit.pasteAndIndent', 'Paste and Indent', 'Edit', 'Ctrl+Shift+V', pasteAndIndent);
    def('edit.deleteWordForward', 'Delete Word Forward', 'Edit', '', () => triggerAction('deleteWordRight'));
    def('edit.deleteWordBackward', 'Delete Word Backward', 'Edit', '', () => triggerAction('deleteWordLeft'));

    // Find using current selection
    def('find.useSelection', 'Use Selection for Find', 'Find', 'Ctrl+E', () => LUM.find.useSelection());
    def('find.underNext', 'Find Under', 'Find', 'Ctrl+F3', () => LUM.find.findUnder(1));
    def('find.underPrev', 'Find Under (Previous)', 'Find', 'Ctrl+Shift+F3', () => LUM.find.findUnder(-1));
    def('find.nextResult', 'Next Result', 'Find', 'F4', nextResult);
    def('find.prevResult', 'Previous Result', 'Find', 'Shift+F4', prevResult);

    // Tab navigation
    def('tab.next', 'Next Tab', 'Tabs', 'Ctrl+PageDown', () => LUM.editor.stepTab(1));
    def('tab.prev', 'Previous Tab', 'Tabs', 'Ctrl+PageUp', () => LUM.editor.stepTab(-1));
    def('tab.mruNext', 'Cycle Tabs (Most Recent)', 'Tabs', 'Ctrl+Tab', () => LUM.editor.mruCycle(1));
    def('tab.mruPrev', 'Cycle Tabs (Most Recent, Reverse)', 'Tabs', 'Ctrl+Shift+Tab', () => LUM.editor.mruCycle(-1));

    // Scroll the caret line to the vertical centre (Sublime Ctrl+K Ctrl+C).
    def('edit.centerLine', 'Scroll to Center', 'View', '', () => {
      const ed = LUM.editor.activeEditor();
      if (ed && ed.getPosition) ed.revealLineInCenter(ed.getPosition().lineNumber);
    });

    // Goto definition (LSP cross-file, else Monaco's word-based reveal)
    def('goto.definition', 'Goto Definition', 'Goto', 'F12', () => (LUM.lsp ? LUM.lsp.gotoDefinition() : triggerAction('editor.action.revealDefinition')));

    // View: font size + UI element toggles
    def('view.fontLarger', 'Font: Larger', 'View', 'Ctrl+=', () => bumpFont(1));
    def('view.fontSmaller', 'Font: Smaller', 'View', 'Ctrl+-', () => bumpFont(-1));
    def('view.fontReset', 'Font: Reset', 'View', 'Ctrl+0', () => setFontSize(LUM.settings.DEFAULTS.font_size));
    def('view.fontChoose', 'Font: Choose…', 'View', '', chooseFont);
    def('view.toggleStatusBar', 'Toggle Status Bar', 'View', '', () => document.body.classList.toggle('hide-statusbar'));
    def('view.toggleTabs', 'Toggle Tabs', 'View', '', () => { document.body.classList.toggle('hide-tabs'); setTimeout(() => LUM.editor.layout(), 0); });

    // Parameterised commands driven by the native submenus (Syntax / Indentation)
    def('lang.setTo', 'Set Syntax (to language)', 'Language', '', (langId) => LUM.editor.setLanguage(langId));
    def('edit.setTabWidth', 'Indentation: Set Tab Width', 'Line', '', (n) => LUM.editor.setTabWidth(n));
    def('edit.toggleSpaces', 'Indentation: Indent Using Spaces', 'Line', '', () => LUM.editor.toggleInsertSpaces());

    // Goto word in current file (# prefix in Goto Anything)
    def('goto.word', 'Goto Word in File… (#)', 'Goto', 'Ctrl+;', () => LUM.palette.open('word'));

    def('view.toggleSidebar', 'Toggle Sidebar', 'View', 'Ctrl+B', toggleSidebar);
    def('view.toggleMinimap', 'Toggle Minimap', 'View', '', toggleMinimap);
    def('view.toggleStickyScroll', 'Toggle Sticky Scroll', 'View', '', toggleStickyScroll);
    def('view.split1', 'Layout: Single', 'View', 'Alt+Shift+1', () => E.setLayout(1));
    def('view.split2', 'Layout: Columns: 2', 'View', 'Alt+Shift+2', () => E.setLayout(2));
    def('view.split3', 'Layout: Columns: 3', 'View', 'Alt+Shift+3', () => E.setLayout(3));
    def('view.theme', 'Color Scheme…', 'View', '', chooseTheme);
    def('view.wordWrap', 'Toggle Word Wrap', 'View', 'Alt+Z', toggleWordWrap);

    // View > Show Symbol — render invisibles (Sublime draw_white_space family)
    def('view.showWhitespace', 'Show: Space and Tab', 'View', '', () => LUM.invisibles.toggle('whitespace'));
    def('view.showEol', 'Show: End of Line', 'View', '', () => LUM.invisibles.toggle('eol'));
    def('view.showAllChars', 'Show: All Characters', 'View', '', () => LUM.invisibles.toggle('all'));
    def('view.showIndentGuides', 'Show: Indent Guide', 'View', '', () => LUM.invisibles.toggle('guides'));
    def('view.showWrapSymbol', 'Show: Wrap Symbol', 'View', '', () => LUM.invisibles.toggle('wrap'));

    // Language selection
    def('lang.set', 'Set Syntax…', 'Language', '', chooseLanguage);

    // Build / run  (Ctrl+B is Toggle Sidebar here, so build uses F7 / Ctrl+Shift+B)
    def('build.run', 'Build: Choose Build System…', 'Build', 'Ctrl+Shift+B', () => LUM.build.chooseBuild());
    def('build.rerun', 'Build: Re-run Last', 'Build', 'F7', () => LUM.build.rerun());
    def('build.cancel', 'Build: Cancel', 'Build', '', () => LUM.build.stop());

    // Macros
    def('macro.toggle', 'Macro: Start/Stop Recording', 'Macro', 'Ctrl+Alt+Q', () => LUM.macros.toggle());
    def('macro.play', 'Macro: Playback', 'Macro', 'Ctrl+Alt+Shift+Q', () => LUM.macros.play());

    // Tabs
    def('tab.closeOthers', 'Close Other Tabs', 'Tabs', '', () => LUM.editor.closeOthers(activeId()));
    def('tab.closeRight', 'Close Tabs to the Right', 'Tabs', '', () => LUM.editor.closeToRight(activeId()));
    def('tab.closeSaved', 'Close Saved Tabs', 'Tabs', '', () => LUM.editor.closeSaved());
    def('tab.closeAll', 'Close All Tabs', 'Tabs', '', () => LUM.editor.closeAll());
    def('tab.copyPath', 'Copy File Path', 'Tabs', '', () => copyPath(false));
    def('tab.copyRelPath', 'Copy Relative Path', 'Tabs', '', () => copyPath(true));
    def('tab.reveal', 'Reveal in File Manager', 'Tabs', '', () => { const b = LUM.editor.activeBuffer(); if (b && b.path) window.lumenText.showItem(b.path); });
    def('tab.pin', 'Pin / Unpin Tab', 'Tabs', '', () => togglePin(activeId()));

    // Project files (.sublime-project) — see LUM.project
    const PR = LUM.project;
    def('project.open', 'Project: Open Project…', 'Project', '', () => PR.open());
    def('project.switch', 'Project: Switch Project…', 'Project', '', () => PR.open());
    def('project.quickSwitch', 'Project: Quick Switch Project…', 'Project', 'Ctrl+Alt+P', () => PR.quickSwitch());
    def('project.openPath', 'Project: Open Recent Project', 'Project', '', (p) => PR.openPath(p));
    def('project.saveAs', 'Project: Save Project As…', 'Project', '', () => PR.saveAs());
    def('project.save', 'Project: Save Project As…', 'Project', '', () => PR.saveAs()); // legacy id
    def('project.close', 'Project: Close Project', 'Project', '', () => PR.close());
    def('project.edit', 'Project: Edit Project', 'Project', '', () => PR.edit());
    def('project.addFolder', 'Project: Add Folder to Project…', 'Project', '', () => PR.addFolder());
    def('project.removeAllFolders', 'Project: Remove all Folders from Project', 'Project', '', () => PR.removeAllFolders());
    def('project.refreshFolders', 'Project: Refresh Folders', 'Project', '', () => PR.refreshFolders());
    def('project.clearRecent', 'Project: Clear Recent Projects', 'Project', '', () => PR.clearRecent());

    // Git
    def('git.refresh', 'Git: Refresh Status', 'Git', '', () => LUM.git.refresh());
    def('git.revertFile', 'Git: Revert File to HEAD', 'Git', '', () => LUM.git.revertFile());
    def('git.nextMod', 'History: Next Modification', 'Git', 'Ctrl+.', () => LUM.git.gotoModification(1));
    def('git.prevMod', 'History: Previous Modification', 'Git', 'Ctrl+Shift+.', () => LUM.git.gotoModification(-1));
    def('git.revertHunk', 'History: Revert Hunk', 'Git', '', () => LUM.git.revertHunk());

    // Snippets
    def('snippet.insert', 'Snippet: Insert…', 'Snippets', '', () => LUM.snippets.pickAndInsert());
    def('snippet.edit', 'Snippet: Edit User Snippets', 'Snippets', '', () => LUM.snippets.openUI());

    // Bookmarks
    def('bm.toggle', 'Toggle Bookmark', 'Bookmarks', 'Ctrl+F2', () => LUM.bookmarks.toggle());
    def('bm.next', 'Next Bookmark', 'Bookmarks', 'F2', () => LUM.bookmarks.next());
    def('bm.prev', 'Previous Bookmark', 'Bookmarks', 'Shift+F2', () => LUM.bookmarks.prev());
    def('bm.clear', 'Clear Bookmarks', 'Bookmarks', 'Ctrl+Shift+F2', () => LUM.bookmarks.clearAll());

    // Distraction-free + rulers
    def('view.zen', 'Toggle Distraction-Free Mode', 'View', 'Shift+F11', toggleZen);
    def('view.rulers', 'Toggle Rulers (80 / 120)', 'View', '', cycleRulers);

    def('help.about', 'About Lumen Text', 'Help', '', showAbout);
    def('help.donate', 'Support / Donate', 'Help', '', showAbout);
    def('help.ime', 'Vietnamese Input (fcitx) Help', 'Help', '', showImeHelp);
  }

  function triggerAction(actionId) {
    const ed = LUM.editor.activeEditor();
    if (!ed) return;
    const a = ed.getAction(actionId);
    if (a) a.run();
    else ed.trigger('stp', actionId, null);
  }

  // ---- command implementations -------------------------------------------
  async function openFiles() {
    const paths = await window.lumenText.openFileDialog();
    for (const p of paths) { await LUM.editor.openPath(p); pushRecent(p, 'file'); }
    LUM.sidebar.highlightActive();
  }

  // ---- tab helpers + context menu -----------------------------------------
  function activeId() { const b = LUM.editor.activeBuffer(); return b ? b.id : null; }
  async function copyPath(rel, buf) {
    buf = buf || LUM.editor.activeBuffer();
    if (!buf || !buf.path) return;
    let p = buf.path;
    if (rel && LUM.sidebar.root && p.startsWith(LUM.sidebar.root + window.lumenText.sep)) p = p.slice(LUM.sidebar.root.length + 1);
    try { await navigator.clipboard.writeText(p); } catch {}
    toast('Copied: ' + p);
  }
  function togglePin(id) {
    const b = LUM.editor.buffers.get(id);
    if (!b) return;
    b.pinned = !b.pinned;
    LUM.editor.renderTabs();
    toast(b.pinned ? 'Tab pinned' : 'Tab unpinned');
  }
  function buildTabMenu(id, x, y) {
    const b = LUM.editor.buffers.get(id);
    if (!b) return;
    LUM.menu.show([
      { label: 'Close', run: () => LUM.editor.closeBuffer(id) },
      { label: 'Close Others', run: () => LUM.editor.closeOthers(id) },
      { label: 'Close to the Right', run: () => LUM.editor.closeToRight(id) },
      { label: 'Close Saved', run: () => LUM.editor.closeSaved() },
      { label: 'Close All', run: () => LUM.editor.closeAll() },
      { separator: true },
      { label: b.pinned ? 'Unpin Tab' : 'Pin Tab', run: () => togglePin(id) },
      { separator: true },
      { label: 'Copy File Path', disabled: !b.path, run: () => copyPath(false, b) },
      { label: 'Copy Relative Path', disabled: !b.path, run: () => copyPath(true, b) },
      { label: 'Reveal in Sidebar', disabled: !b.path, run: () => { if (b.path) LUM.sidebar.revealInSidebar(b.path); } },
      { label: 'Reveal in File Manager', disabled: !b.path, run: () => { if (b.path) window.lumenText.showItem(b.path); } }
    ], x, y);
  }
  async function openFolder() {
    const dir = await window.lumenText.openFolderDialog();
    if (dir) await LUM.sidebar.openFolder(dir);
  }

  // Project open/save/switch/etc. now live in LUM.project (src/js/project.js).
  function toggleSidebar() {
    LUM.state.sidebar = !LUM.state.sidebar;
    document.getElementById('app').classList.toggle('no-sidebar', !LUM.state.sidebar);
    setTimeout(() => LUM.editor.layout(), 0);
  }
  function toggleMinimap() {
    LUM.state.minimap = !LUM.state.minimap;
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions({ minimap: { enabled: LUM.state.minimap } }));
    // Persist so a later settings re-apply (font bump, autosave change) doesn't
    // snap the minimap back to the saved baseline.
    LUM.settings.set('minimap', LUM.state.minimap);
  }
  function toggleStickyScroll() {
    const next = !LUM.settings.get('sticky_scroll', false);
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions({ stickyScroll: { enabled: next } }));
    LUM.settings.set('sticky_scroll', next); // persist so it survives a settings re-apply
    toast('Sticky scroll: ' + (next ? 'on' : 'off'));
  }
  function toggleWordWrap() {
    const next = !LUM.settings.get('word_wrap', false);
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions({ wordWrap: next ? 'on' : 'off' }));
    LUM.settings.set('word_wrap', next); // persist so it survives a settings re-apply
    toast('Word wrap: ' + (next ? 'on' : 'off'));
  }
  // Font size is tracked in-memory and persisted debounced, so holding Ctrl+= /
  // Ctrl+- doesn't interleave read-modify-write on the settings file and lose steps.
  let fontSizeCur = null;
  let fontPersistTimer = null;
  function setFontSize(n) {
    n = Math.max(6, Math.min(40, Math.round(n)));
    fontSizeCur = n;
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions({ fontSize: n }));
    toast('Font size: ' + n);
    clearTimeout(fontPersistTimer);
    fontPersistTimer = setTimeout(() => LUM.settings.set('font_size', n), 300);
  }
  function bumpFont(delta) {
    if (fontSizeCur == null) fontSizeCur = LUM.settings.get('font_size', LUM.settings.DEFAULTS.font_size) || 13;
    setFontSize(fontSizeCur + delta);
  }

  // The first family in the configured font stack (what "current" means to the user).
  function currentFontFamily() {
    const ff = LUM.settings.get('font_family', LUM.settings.DEFAULTS.font_family) || '';
    return (ff.split(',')[0] || '').replace(/["']/g, '').trim();
  }
  // Is a font family actually installed? Measure a probe string against the three
  // generic fallbacks; if any width changes when the family is prepended, it rendered.
  function fontAvailable(family) {
    const ctx = fontAvailable._ctx || (fontAvailable._ctx = document.createElement('canvas').getContext('2d'));
    const text = 'mmmmmmmmmmlliI0Oo1', px = '72px';
    return ['monospace', 'serif', 'sans-serif'].some((g) => {
      ctx.font = `${px} ${g}`;
      const base = ctx.measureText(text).width;
      ctx.font = `${px} "${family}", ${g}`;
      return ctx.measureText(text).width !== base;
    });
  }
  function applyFontFamily(family) {
    LUM.editor.panes.forEach((p) => p.editor && p.editor.updateOptions({ fontFamily: family }));
    document.documentElement.style.setProperty('--font-mono', family);
    LUM.settings.set('font_family', family); // persist so it survives restarts / re-applies
    toast('Font: ' + family);
  }
  // Font > Choose…: pick an installed monospace font (or type a custom family / size).
  function chooseFont() {
    const cur = currentFontFamily();
    const CANDIDATES = [
      'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Cascadia Mono', 'Source Code Pro',
      'Hack', 'Ubuntu Mono', 'DejaVu Sans Mono', 'Liberation Mono', 'Roboto Mono',
      'IBM Plex Mono', 'Inconsolata', 'Noto Sans Mono', 'Menlo', 'Monaco', 'Consolas', 'Courier New'
    ];
    const entries = [];
    const seen = new Set();
    const add = (f, label) => {
      const key = f.toLowerCase();
      if (!f || seen.has(key)) return;
      seen.add(key);
      entries.push({ label: label || (f + (f.toLowerCase() === cur.toLowerCase() ? '  ✓' : '')), run: () => applyFontFamily(f) });
    };
    if (cur) add(cur);                                   // current first
    CANDIDATES.filter(fontAvailable).forEach((f) => add(f)); // only installed fonts
    add('monospace');                                    // system default, always valid
    entries.push({ label: 'Custom Font Family…', run: () =>
      inlineInput('Font family (e.g. Fira Code)', (v) => { if (v && v.trim()) applyFontFamily(v.trim()); }) });
    entries.push({ label: 'Font Size…', run: () =>
      inlineInput('Font size (6–40)', (v) => { const n = parseInt(v, 10); if (!isNaN(n)) setFontSize(n); }) });
    openPicker(entries, 'Choose Font');
  }
  // Paste over the selection, then reindent the PASTED block (Sublime behaviour).
  async function pasteAndIndent() {
    const ed = LUM.editor.activeEditor();
    const buf = LUM.editor.activeBuffer();
    if (!ed || !buf || buf.kind !== 'text' || !buf.model) return;
    const start = ed.getSelection(); // where the paste begins
    const paste = ed.getAction('editor.action.clipboardPasteAction');
    if (!paste) return;
    await paste.run();
    // Select from the paste start to the post-paste caret, then reindent that span
    // (Monaco collapses the selection to a caret after pasting).
    const end = ed.getPosition();
    if (start && end) {
      ed.setSelection(new monaco.Selection(start.startLineNumber, start.startColumn, end.lineNumber, end.column));
    }
    const reindent = ed.getAction('editor.action.reindentselectedlines');
    if (reindent) await reindent.run();
  }
  // Invert the selection: select everything that is currently NOT selected.
  function invertSelection() {
    const ed = LUM.editor.activeEditor();
    const model = ed && ed.getModel();
    if (!ed || !model) return;
    const full = model.getFullModelRange();
    const sels = ed.getSelections().slice().sort((a, b) =>
      a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    const Sel = monaco.Selection;
    const out = [];
    let pos = { lineNumber: full.startLineNumber, column: full.startColumn };
    for (const s of sels) {
      if (pos.lineNumber < s.startLineNumber || (pos.lineNumber === s.startLineNumber && pos.column < s.startColumn)) {
        out.push(new Sel(pos.lineNumber, pos.column, s.startLineNumber, s.startColumn));
      }
      pos = { lineNumber: s.endLineNumber, column: s.endColumn };
    }
    if (pos.lineNumber < full.endLineNumber || (pos.lineNumber === full.endLineNumber && pos.column < full.endColumn)) {
      out.push(new Sel(pos.lineNumber, pos.column, full.endLineNumber, full.endColumn));
    }
    if (out.length) ed.setSelections(out);
  }
  function toggleZen() {
    document.body.classList.toggle('zen');
    setTimeout(() => LUM.editor.layout(), 0);
  }
  function cycleRulers() {
    const cur = LUM.settings.get('rulers') || [];
    const next = cur.length === 0 ? [80] : cur.length === 1 ? [80, 120] : [];
    LUM.settings.set('rulers', next);
    toast('Rulers: ' + (next.length ? next.join(', ') : 'off'));
  }
  function chooseTheme() {
    // Apply immediately for instant feedback, and persist so it sticks across
    // restarts and later settings re-applies.
    openPicker(THEMES.map((t) => ({
      label: t.label,
      run: () => { applyTheme(t.id); LUM.settings.set('theme', t.id); }
    })), 'Color Scheme');
  }
  function chooseLanguage() {
    const buf = LUM.editor.activeBuffer();
    if (!buf) return;
    const langs = monaco.languages.getLanguages()
      .map((l) => ({ id: l.id, label: (l.aliases && l.aliases[0]) || l.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
    openPicker(langs.map((l) => ({
      label: l.label,
      run: () => { monaco.editor.setModelLanguage(buf.model, l.id); buf.language = l.id; LUM.editor.updateStatus(); }
    })), 'Set Syntax');
  }

  // Reopen / Save with a chosen encoding (VS Code-style two-step).
  function pickEncoding(mode) {
    const buf = LUM.editor.activeBuffer();
    if (!buf || buf.kind !== 'text') { toast('No text file active'); return; }
    const verb = mode === 'reopen' ? 'Reopen as ' : 'Save as ';
    const entries = LUM.editor.encodings().map((e) => ({
      label: verb + e.label + (buf.encoding === e.id ? '  ✓' : ''),
      run: () => mode === 'reopen' ? LUM.editor.reopenWithEncoding(e.id) : LUM.editor.saveWithEncoding(e.id)
    }));
    openPicker(entries, mode === 'reopen' ? 'Reopen with Encoding' : 'Save with Encoding');
  }

  // Generic picker reusing the palette overlay with an ad-hoc list.
  function openPicker(entries, title) {
    inlinePicker(entries, title);
  }

  // Minimal standalone picker (independent of palette internals).
  function inlinePicker(entries, title) {
    const overlay = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    const listEl = document.getElementById('palette-list');
    overlay.classList.remove('hidden');
    input.value = '';
    input.placeholder = title || '';
    let active = 0;
    let filtered = entries.slice();
    function render() {
      listEl.innerHTML = '';
      filtered.forEach((e, i) => {
        const li = document.createElement('li');
        li.className = 'palette-item' + (i === active ? ' active' : '');
        li.innerHTML = `<span class="pi-main">${escapeHtml(e.label)}` +
          (e.sub ? ` <span class="pi-sub">${escapeHtml(e.sub)}</span>` : '') + `</span>`;
        li.addEventListener('click', () => pick(i));
        listEl.appendChild(li);
      });
    }
    function pick(i) {
      const e = filtered[i != null ? i : active];
      cleanup();
      if (e && e.run) e.run();
    }
    function cleanup() {
      overlay.classList.add('hidden');
      input.placeholder = '';
      input.removeEventListener('input', onInput);
      document.removeEventListener('keydown', onKey, true);
      const ed = LUM.editor.activeEditor();
      if (ed) ed.focus();
    }
    function onInput() {
      const q = input.value.toLowerCase();
      filtered = entries.filter((e) => e.label.toLowerCase().includes(q));
      active = 0; render();
    }
    function onKey(e) {
      if (overlay.classList.contains('hidden')) return;
      if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % filtered.length; render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + filtered.length) % filtered.length; render(); }
      else if (e.key === 'Enter') { e.preventDefault(); pick(); }
    }
    input.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey, true);
    render();
    input.focus();
  }

  // Free-text prompt reusing the palette overlay (Electron blocks window.prompt).
  function inlineInput(placeholder, onSubmit) {
    const overlay = document.getElementById('palette');
    const input = document.getElementById('palette-input');
    const listEl = document.getElementById('palette-list');
    overlay.classList.remove('hidden');
    input.value = '';
    input.placeholder = placeholder || '';
    listEl.innerHTML = '';
    function cleanup() {
      overlay.classList.add('hidden');
      input.placeholder = '';
      input.removeEventListener('keydown', onKey);
      const ed = LUM.editor.activeEditor();
      if (ed) ed.focus();
    }
    function onKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); const v = input.value; cleanup(); onSubmit(v); }
      else if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    }
    input.addEventListener('keydown', onKey);
    input.focus();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // About / Donate modal — built once, then shown/hidden. Mirrors the RichNote
  // dialog: logo + version, feature chips, developer info, and donate QR codes.
  let aboutEl = null;
  function buildAboutModal() {
    const back = document.createElement('div');
    back.className = 'lum-modal-backdrop';
    back.innerHTML =
      '<div class="lum-modal about-modal" role="dialog" aria-label="About Lumen Text">' +
        '<button class="lum-modal-close" aria-label="Close">&times;</button>' +
        '<div class="about-hero">' +
          '<div class="about-logo"><img src="img/icon.png" alt="Lumen Text" /></div>' +
          '<h2 class="about-title">Lumen Text</h2>' +
          '<span class="about-ver">v0.1.0</span>' +
          '<p class="about-tagline">A fast, Sublime-style code editor — Electron + Monaco</p>' +
        '</div>' +
        '<div class="about-body">' +
          '<div class="about-chips">' +
            '<span class="about-chip">Sublime-style</span>' +
            '<span class="about-chip">Monaco</span>' +
            '<span class="about-chip">Multiple cursors</span>' +
            '<span class="about-chip">Find &amp; Replace</span>' +
            '<span class="about-chip">Find in Files</span>' +
            '<span class="about-chip">Large File Mode</span>' +
            '<span class="about-chip">fcitx VN input</span>' +
          '</div>' +
          '<div class="about-section">' +
            '<h3 class="about-h3">Developer</h3>' +
            '<div class="about-rows">' +
              '<div class="about-row">' +
                '<span class="about-row-ico">👤</span>' +
                '<span class="about-row-main"><b>Nguyễn Hữu Đức</b><small>Software Developer · VIETIS</small></span>' +
              '</div>' +
              '<a class="about-row" href="mailto:nguyenhuuduc.it.91@gmail.com"><span class="about-row-ico">✉️</span><span class="about-row-val">nguyenhuuduc.it.91@gmail.com</span></a>' +
              '<a class="about-row" href="tel:0964589910"><span class="about-row-ico">📱</span><span class="about-row-val">0964 589 910</span></a>' +
              '<a class="about-row" href="https://github.com/nguyenhuuducit91/LumenText" target="_blank" rel="noopener noreferrer"><span class="about-row-ico">🔗</span><span class="about-row-val">github.com/nguyenhuuducit91/LumenText</span></a>' +
            '</div>' +
          '</div>' +
          '<div class="about-section about-donate">' +
            '<h3 class="about-h3">♥ Support the developer</h3>' +
            '<p class="about-donate-text">If Lumen Text helps you code faster, a small coffee keeps it improving. Thank you! 🙏</p>' +
            '<div class="about-qr-row">' +
              '<figure class="about-qr-item"><img class="about-qr" src="img/qr-code-bank-donate.png" alt="Bank donate QR" onerror="this.closest(\'.about-qr-item\').style.display=\'none\'" /><figcaption class="about-qr-cap">Bank</figcaption></figure>' +
              '<figure class="about-qr-item"><img class="about-qr" src="img/paypal.png" alt="PayPal donate QR" onerror="this.closest(\'.about-qr-item\').style.display=\'none\'" /><figcaption class="about-qr-cap">PayPal</figcaption></figure>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="about-foot">MIT License · Made with ♥ in Vietnam · © 2026 Nguyễn Hữu Đức</div>' +
      '</div>';
    document.body.appendChild(back);

    const close = () => back.classList.remove('open');
    back.querySelector('.lum-modal-close').addEventListener('click', close);
    back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
    back.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    // Open mailto:/tel:/https: links in the system browser, never in-window.
    back.querySelectorAll('a.about-row').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        try { window.lumenText.openExternal(a.getAttribute('href')); } catch { /* ignore */ }
      });
    });
    aboutEl = back;
    return back;
  }
  function showAbout() {
    const back = aboutEl || buildAboutModal();
    back.classList.add('open');
    back.setAttribute('tabindex', '-1');
    back.focus();
  }
  function showImeHelp() {
    const lines = [
      'Gõ tiếng Việt (fcitx5): nhấn Ctrl+Space để bật/tắt bộ gõ.',
      'Preedit hiển thị inline ngay tại con trỏ (không popup).',
      'Nếu chưa gõ được: chạy `fcitx5-configtool`, thêm Unikey/Bamboo.',
      'Đảm bảo GTK_IM_MODULE=fcitx (đã tự set khi khởi động).'
    ];
    inlinePicker(lines.map((l) => ({ label: l, run: () => {} })), 'Vietnamese Input Help');
  }

  // ---- global keybindings (non-editor: overlay + app-level) ---------------
  // A declarative table keyed by a canonical "ctrl+alt+shift+key" combo. Each
  // value is a command id, or { cmd|fn, stop } where `stop` also stops the event
  // reaching Monaco (used for Find, so our bottom bar opens instead of the popup).
  // Precise modifier matching (every combo lists exactly its modifiers) fixes the
  // old chain where Ctrl+Alt+S fell through to Ctrl+S, etc.
  function comboOf(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');
    parts.push((e.key || '').toLowerCase());
    return parts.join('+');
  }
  // F4 / Shift+F4 route to whichever result set is live: Find-in-Files, else build.
  function nextResult() {
    if (LUM.findInFiles && LUM.findInFiles.hasResults && LUM.findInFiles.hasResults()) LUM.findInFiles.nextResult();
    else if (LUM.build && LUM.build.nextError) LUM.build.nextError();
  }
  function prevResult() {
    if (LUM.findInFiles && LUM.findInFiles.hasResults && LUM.findInFiles.hasResults()) LUM.findInFiles.prevResult();
    else if (LUM.build && LUM.build.prevError) LUM.build.prevError();
  }

  function installKeybindings() {
    const T = {
      'ctrl+p': 'goto.anything',
      'ctrl+shift+p': 'goto.command',
      'ctrl+g': 'goto.line',
      'ctrl+r': 'goto.symbol',
      'ctrl+shift+r': 'goto.projectSymbol', // was un-intercepted → hard reload
      'ctrl+;': 'goto.word',
      'ctrl+b': 'view.toggleSidebar',
      'ctrl+s': 'file.save',
      'ctrl+shift+s': 'file.saveAs',
      'ctrl+alt+s': 'file.saveAll',         // was shadowed by ctrl+s
      'ctrl+n': 'file.new',
      'ctrl+o': 'file.open',
      'ctrl+w': 'file.closeTab',
      // (Ctrl+Shift+Z / Ctrl+Y redo are handled natively by Monaco — not re-bound
      //  here, which would double-apply the redo.)
      'ctrl+shift+f': 'find.inFiles',
      // Find keys: stop propagation so Monaco's own widget never opens.
      'ctrl+f': { cmd: 'edit.find', stop: true },
      'ctrl+h': { cmd: 'edit.replace', stop: true },
      'f3': { fn: () => LUM.find.next(), stop: true },
      'shift+f3': { fn: () => LUM.find.prev(), stop: true },
      'ctrl+f3': { fn: () => LUM.find.findUnder(1), stop: true },
      'ctrl+shift+f3': { fn: () => LUM.find.findUnder(-1), stop: true },
      'f4': { fn: nextResult, stop: true },
      'shift+f4': { fn: prevResult, stop: true },
      // Tab navigation
      'ctrl+pagedown': { fn: () => LUM.editor.stepTab(1), stop: true },
      'ctrl+pageup': { fn: () => LUM.editor.stepTab(-1), stop: true },
      'ctrl+tab': { fn: () => LUM.editor.mruCycle(1), stop: true },
      'ctrl+shift+tab': { fn: () => LUM.editor.mruCycle(-1), stop: true }
    };
    document.addEventListener('keydown', (e) => {
      if (LUM.palette.isOpen()) return; // palette handles its own keys
      // Alt+1..9 selects a tab by index (Alt+9 = last), Sublime-style.
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
        e.preventDefault(); e.stopPropagation();
        LUM.editor.selectTabByIndex(+e.key);
        return;
      }
      // Git hunk nav: Ctrl+. / Ctrl+Shift+. — matched by key CODE so it's robust
      // across layouts and never collides with Ctrl+, (Settings).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.code === 'Period') {
        e.preventDefault(); e.stopPropagation();
        LUM.commands.run(e.shiftKey ? 'git.prevMod' : 'git.nextMod');
        return;
      }
      const entry = T[comboOf(e)];
      if (!entry) return;
      e.preventDefault();
      if (typeof entry === 'object' && entry.stop) e.stopPropagation();
      if (typeof entry === 'string') LUM.commands.run(entry);
      else if (entry.cmd) LUM.commands.run(entry.cmd);
      else if (entry.fn) entry.fn();
    }, true);
  }

  // dropdown listing open tabs (the ▾ button on the tab strip)
  function openTabsMenu() {
    const E = LUM.editor;
    const entries = E.order.map((id) => {
      const b = E.buffers.get(id);
      return { label: (b.dirty ? '● ' : '') + b.name, sub: b.path || '', run: () => E.showBuffer(id) };
    });
    if (entries.length) inlinePicker(entries, 'Open Tabs');
  }

  // ---- menu command routing (from main process) ---------------------------
  let openedExplicit = false;
  function installMenuBridge() {
    window.lumenText.onMenuCommand((cmd, arg) => LUM.commands.run(cmd, arg));
    window.lumenText.onOpenPath(async (p) => {
      openedExplicit = true; // a path/folder was passed on the command line
      const st = await window.lumenText.stat(p);
      if (st.exists && st.isDir) await LUM.sidebar.openFolder(p);
      else await LUM.editor.openPath(p);
    });
  }

  // Open a dropped/CLI path: folders go to the sidebar, files open as tabs.
  async function openExternalPath(p) {
    if (!p) return;
    const st = await window.lumenText.stat(p);
    if (!st.exists) { toast('No longer exists: ' + p); return; }
    openedExplicit = true;
    if (st.isDir) await LUM.sidebar.openFolder(p);
    else await LUM.editor.openPath(p);
  }

  // Ctrl + mouse wheel => zoom the editor font in/out. Routes through bumpFont so
  // it stays in sync with Ctrl+= / Ctrl+- and persists to the font_size setting.
  function installWheelZoom() {
    let accum = 0;
    const STEP = 60; // wheel pixels per 1px font change (keeps trackpads from over-zooming)
    window.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault(); // stop page/webframe zoom; we zoom the font instead
      accum += e.deltaY;
      while (accum <= -STEP) { bumpFont(1); accum += STEP; }   // scroll up = zoom in
      while (accum >= STEP) { bumpFont(-1); accum -= STEP; }   // scroll down = zoom out
    }, { passive: false, capture: true });
  }

  // ---- drag & drop (files/folders onto the window) ------------------------
  function installDragDrop() {
    const overlay = document.createElement('div');
    overlay.id = 'drag-overlay';
    overlay.innerHTML = '<div class="drag-overlay-inner">⤓ Drop files to open in Lumen Text</div>';
    document.body.appendChild(overlay);

    let depth = 0;
    const isFileDrag = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1;
    const hide = () => { depth = 0; overlay.classList.remove('visible'); };

    window.addEventListener('dragenter', (e) => {
      if (!isFileDrag(e)) return;
      e.preventDefault(); e.stopPropagation();
      depth++;
      overlay.classList.add('visible');
    }, true);
    window.addEventListener('dragover', (e) => {
      if (!isFileDrag(e)) return;
      // preventDefault stops the webview from navigating to the file; stopPropagation
      // keeps Monaco / tab-reorder / sidebar drop targets from also handling it.
      e.preventDefault(); e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }, true);
    window.addEventListener('dragleave', (e) => {
      if (!isFileDrag(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) hide();
    }, true);
    window.addEventListener('drop', (e) => {
      if (!isFileDrag(e)) return; // let Monaco handle internal text drops
      e.preventDefault(); e.stopPropagation();
      hide();
      // Read dataTransfer.files synchronously — it is invalidated once this
      // handler returns, so resolve every path before awaiting anything.
      const paths = Array.from(e.dataTransfer.files || [])
        .map((f) => window.lumenText.pathForFile(f))
        .filter(Boolean);
      if (!paths.length) { toast('Could not open the dropped item'); return; }
      (async () => {
        for (const p of paths) {
          try { await openExternalPath(p); } catch (err) { console.error('drop open failed', p, err); }
        }
      })();
    }, true);
  }

  // ---- recent files / folders ---------------------------------------------
  let recentList = [];
  async function loadRecent() {
    recentList = (await window.lumenText.stateGet('recent', [])) || [];
  }
  function pushRecent(p, kind) {
    if (!p) return;
    recentList = recentList.filter((r) => r.path !== p);
    recentList.unshift({ path: p, kind });
    if (recentList.length > 25) recentList.length = 25;
    window.lumenText.stateSet('recent', recentList);
  }
  function openRecent() {
    if (!recentList.length) { toast('No recent files or folders'); return; }
    const entries = recentList.map((r) => ({
      label: (r.kind === 'folder' ? '▸ ' : '') + window.lumenText.basename(r.path),
      sub: r.path,
      run: async () => {
        const st = await window.lumenText.stat(r.path);
        if (!st.exists) { toast('No longer exists: ' + r.path); return; }
        if (st.isDir) await LUM.sidebar.openFolder(r.path);
        else await LUM.editor.openPath(r.path);
      }
    }));
    inlinePicker(entries, 'Open Recent');
  }

  // ---- auto-save ----------------------------------------------------------
  async function setAutoSave(mode) {
    await LUM.settings.set('auto_save', mode);
    toast('Auto Save: ' + mode);
  }

  // ---- session / hot-exit --------------------------------------------------
  let sessionTimer = null;
  function captureSession() {
    const E = LUM.editor;
    const files = [];
    for (const id of E.order) {
      const b = E.buffers.get(id);
      if (b && b.path) files.push({ path: b.path }); // skip untitled buffers
    }
    let active = null;
    const cur = E.activeBuffer();
    if (cur && cur.path) {
      active = { path: cur.path };
      const ed = E.activeEditor();
      if (cur.kind === 'text' && ed && ed.getPosition) {
        const p = ed.getPosition();
        active.line = p.lineNumber;
        active.col = p.column;
      }
    }
    const roots = LUM.sidebar.roots;
    return {
      folder: roots[0] || null, // back-compat
      folders: roots,
      project: LUM.project ? LUM.project.path : null,
      files, active
    };
  }
  function saveSessionSoon() {
    // A dedicated config window (Settings / Key Bindings) must never overwrite
    // the shared session, or its split would return on the next normal launch.
    if (window.lumenText.openConfigOnStart) return;
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => window.lumenText.stateSet('session', captureSession()), 600);
  }
  async function restoreSession() {
    const s = await window.lumenText.stateGet('session', null);
    if (!s) return false;
    // Restore project file if present, else the raw root folder(s).
    if (s.project) {
      const st = await window.lumenText.stat(s.project);
      if (st.exists && !st.isDir) await LUM.project.openPath(s.project);
    } else {
      const dirs = (s.folders && s.folders.length) ? s.folders : (s.folder ? [s.folder] : []);
      const existing = [];
      for (const d of dirs) {
        const st = await window.lumenText.stat(d);
        if (st.exists && st.isDir) existing.push(d);
      }
      if (existing.length) await LUM.sidebar.setRoots(existing);
    }
    for (const f of s.files || []) {
      const st = await window.lumenText.stat(f.path);
      if (st.exists && !st.isDir) await LUM.editor.openPath(f.path);
    }
    if (s.active) {
      for (const id of LUM.editor.order) {
        const b = LUM.editor.buffers.get(id);
        if (b && b.path === s.active.path) {
          LUM.editor.showBuffer(id);
          if (s.active.line && b.kind === 'text') {
            const ed = LUM.editor.activeEditor();
            if (ed) {
              ed.setPosition({ lineNumber: s.active.line, column: s.active.col || 1 });
              ed.revealLineInCenter(s.active.line);
            }
          }
          break;
        }
      }
    }
    return (s.files && s.files.length > 0) || !!s.folder || !!s.project || (s.folders && s.folders.length > 0);
  }

  // ---- sidebar resizer ----------------------------------------------------
  function installResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    let dragging = false;
    resizer.addEventListener('mousedown', () => { dragging = true; document.body.style.cursor = 'col-resize'; });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = Math.max(140, Math.min(560, e.clientX));
      document.documentElement.style.setProperty('--sidebar-w', w + 'px');
      LUM.editor.layout();
    });
    window.addEventListener('mouseup', () => { dragging = false; document.body.style.cursor = ''; });
    window.addEventListener('resize', () => LUM.editor.layout());
  }

  // ---- boot ---------------------------------------------------------------
  function boot() {
    LUM.tabmenu = buildTabMenu;
    defineThemes();
    registerEditorKeybindings();
    applyTheme(LUM.state.theme);
    LUM.editor.createPane(document.getElementById('editor-0'));
    LUM.editor.setActivePane(0);
    registerCommands();
    LUM.palette.init();
    LUM.largefile.init();
    LUM.findInFiles.init();
    LUM.find.init();
    LUM.autosave.init();
    LUM.keymap.init();
    LUM.git.init();
    LUM.build.init();
    LUM.macros.init();
    installKeybindings();
    installMenuBridge();
    installResizer();

    // adaptive theme: re-resolve when the OS light/dark preference changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => { if (LUM.state.theme === 'auto') applyTheme('auto'); });
    }

    // load persistent config (settings apply live to the editors)
    loadRecent();
    LUM.settings.load()
      .catch((e) => console.error('settings load failed', e))
      .finally(() => { if (LUM.invisibles) LUM.invisibles.init(); }); // apply invisibles after settings baseline
    // Re-read config when another window (the Preferences window) saves it.
    window.lumenText.onConfigReload((kind) => {
      if (kind === 'keymap') { if (LUM.keymap) LUM.keymap.load(); }
      else LUM.settings.load().catch((e) => console.error('settings reload failed', e));
    });
    LUM.snippets.load().catch((e) => console.error('snippets load failed', e));
    if (LUM.lsp) LUM.lsp.init();

    // sidebar + tab-strip buttons
    document.getElementById('open-folder-btn').addEventListener('click', () => LUM.commands.run('file.openFolder'));
    document.getElementById('side-new-file').addEventListener('click', () => LUM.sidebar.startCreate(LUM.sidebar.root, false));
    document.getElementById('side-new-folder').addEventListener('click', () => LUM.sidebar.startCreate(LUM.sidebar.root, true));
    document.getElementById('side-collapse').addEventListener('click', () => LUM.sidebar.collapseAll());
    document.getElementById('side-refresh').addEventListener('click', () => LUM.sidebar.refresh());
    // Right-click on empty tree space → root-level menu (New File/Folder).
    document.getElementById('file-tree').addEventListener('contextmenu', (e) => {
      if (e.target.closest('.tree-row')) return; // row menus handle themselves
      if (!LUM.sidebar.root) return;
      e.preventDefault();
      LUM.sidebar.showContextMenu(null, e.clientX, e.clientY);
    });
    document.getElementById('tab-new').addEventListener('click', () => LUM.editor.newFile());
    document.getElementById('tab-menu').addEventListener('click', openTabsMenu);
    document.getElementById('status-eol').addEventListener('click', () => {
      const b = LUM.editor.activeBuffer();
      if (b && b.model) LUM.editor.setEOL(b.model.getEOL() === '\r\n' ? 'LF' : 'CRLF');
    });
    // Clickable status items open the relevant quick panel (Sublime behaviour).
    document.getElementById('status-pos').addEventListener('click', () => LUM.commands.run('goto.line'));
    document.getElementById('status-lang').addEventListener('click', () => LUM.commands.run('lang.set'));
    document.getElementById('status-enc').addEventListener('click', (e) => {
      LUM.menu.show([
        { label: 'Reopen with Encoding…', run: () => pickEncoding('reopen') },
        { label: 'Save with Encoding…', run: () => pickEncoding('save') }
      ], e.clientX, e.clientY);
    });

    // Detect files changed/deleted outside the app when the window regains focus,
    // so external edits reload (clean) or prompt (dirty) instead of being lost.
    window.addEventListener('focus', () => { if (LUM.editor.checkExternalChanges) LUM.editor.checkExternalChanges(); });

    // ---- Drag & drop: drop files/folders onto the window to open them --------
    // Files -> open as tabs; folders -> open in the sidebar. Uses capture phase
    // so it wins over Monaco's own drop handling; internal text drags (no
    // 'Files' type) pass straight through untouched.
    installDragDrop();
    installWheelZoom();

    // Persist session on quit as a last-chance safety net (in addition to the
    // debounced saves triggered by tab/folder changes).
    window.addEventListener('beforeunload', () => {
      if (window.lumenText.openConfigOnStart) return; // config window: don't clobber the shared session
      window.lumenText.stateSet('session', captureSession());
    });

    // Initial content: settings window > explicit CLI arg > restored session >
    // empty document. The initial path is read synchronously (no session race).
    const initial = window.lumenText.initialPath;
    LUM.editor.updateStatus();
    (async () => {
      try {
        const cfg = window.lumenText.openConfigOnStart;
        if (cfg === 'settings' || cfg === 'keymap') {
          openedExplicit = true; // dedicated Preferences window — don't restore a session here
          if (cfg === 'settings') await LUM.settings.buildSettingsView();
          else await LUM.keymap.buildKeymapView();
        } else if (initial) {
          openedExplicit = true;
          const st = await window.lumenText.stat(initial);
          if (st.exists && st.isDir) await LUM.sidebar.openFolder(initial);
          else if (st.exists) await LUM.editor.openPath(initial);
        } else {
          await restoreSession();
        }
      } catch (e) {
        console.error('initial open failed', e);
      }
      if (LUM.editor.order.length === 0) LUM.editor.newFile();
      LUM.editor.updateStatus();
    })();
  }

  return { boot, toast, applyTheme, saveSessionSoon, pushRecent, inlinePicker, inlineInput };
})();

// entry point invoked by the Monaco loader callback in index.html
LUM.boot = function () { LUM.app.boot(); };
