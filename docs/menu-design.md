# LumenText — Menu Design (Sublime Text parity)

Goal: make the native application menu mirror Sublime Text 4 as closely as is
sensible for a Monaco-based editor, exposing the commands that already exist and
filling the notable gaps with new ones.

Legend for the "Status" column below:
- ✅ already implemented **and** in the menu
- 🟡 command already exists — only needs to be wired into the menu
- 🟢 **new** — command implemented as part of this work
- ⛔ intentionally out of scope (needs infra Lumen doesn't have)

---

## File
| Sublime item | Command | Status |
|---|---|---|
| New File | `file.new` | ✅ |
| New Window | `file.newWindow` | ✅ |
| Open File… | `file.open` | ✅ |
| Open Folder… | `file.openFolder` | ✅ |
| Open Recent ▸ | `file.openRecent` | ✅ |
| Reopen Closed File `Ctrl+Shift+T` | `file.reopenClosed` | 🟢 |
| Revert File | `file.revert` | 🟢 |
| Save / Save As / Save All | `file.save*` | ✅ |
| New View into File | — | ⛔ (single view per buffer) |
| Line Endings ▸ (CRLF / LF / CR) | `file.eol*` | 🟡+🟢 (CR is new) |
| Close File `Ctrl+W` | `file.closeTab` | ✅ |
| Close All Files | `tab.closeAll` | 🟡 |
| Close Window `Ctrl+Shift+W` | `file.closeWindow` | 🟢 |
| Quit | role:quit | ✅ |

## Edit
| Sublime item | Command | Status |
|---|---|---|
| Undo / Redo | role | ✅ |
| Undo Selection ▸ (Soft Undo/Redo) | `edit.softUndo/softRedo` | 🟡 |
| Cut / Copy / Paste | role | ✅ |
| Paste and Indent `Ctrl+Shift+V` | `edit.pasteAndIndent` | 🟢 |
| Line ▸ (move/dup/delete/join/indent/reindent) | `edit.*` | 🟡 (adds reindent) |
| Comment ▸ | `edit.commentLine/blockComment` | ✅ |
| Text ▸ (insert line before/after, delete word/line ends, transpose) | `edit.*` | 🟡 (mostly new to menu) |
| Convert Case ▸ (upper/lower/title/swap + camel/snake/kebab) | `edit.*` | 🟡 |
| Wrap ▸ (Wrap Paragraph) | `edit.wrapParagraph` | 🟡 |
| Code Folding ▸ (fold/unfold/all/level) | `edit.fold*` | 🟡 |
| Sort Lines / Sort (Case Sensitive) | `edit.sortAsc/sortDesc` | 🟡 |
| Permute Lines ▸ / Permute Selections ▸ | `edit.permute*`, `sel.permute*` | 🟡 |
| Trim Trailing White Space | `edit.trimTrailing` | 🟡 |
| Format Document | `edit.format` | ✅ |

## Selection
| Sublime item | Command | Status |
|---|---|---|
| Split into Lines | `sel.splitLines` | ✅ |
| Add Previous / Next Line | `sel.addCursorUp/Down` | 🟡 |
| Single Selection | `sel.single` | 🟢 |
| Invert Selection | `sel.invert` | 🟢 |
| Select All | `sel.selectAll` | 🟢 |
| Expand Selection to Word / Line / Brackets / Scope | `sel.expand*` | 🟡 |
| Expand / Shrink Selection | `sel.expand/shrink` | ✅ |
| Add Next Occurrence / Select All Occurrences | `edit.selectNext`, `sel.selectAllOcc` | ✅ |

## Find
| Sublime item | Command | Status |
|---|---|---|
| Find / Replace / Find Next / Prev / Incremental | `edit.find*`, `edit.replace` | ✅ |
| Use Selection for Find `Ctrl+E` | `find.useSelection` | 🟢 |
| Find in Files… | `find.inFiles` | ✅ |

## View
| Sublime item | Command | Status |
|---|---|---|
| Side Bar ▸ (Sidebar / Tabs / Minimap / Status Bar) | `view.toggle*` | 🟡+🟢 |
| Enter Distraction Free Mode | `view.zen` | ✅ |
| Layout ▸ (Single / 2 / 3 columns) | `view.split1/2/3` | 🟡 |
| Syntax ▸ (language list) | `lang.setTo`, `lang.set` | 🟢 |
| Indentation ▸ (spaces toggle, tab width, convert, guess) | `edit.toggleSpaces/setTabWidth/to*/detectIndent` | 🟡+🟢 |
| Line Endings ▸ | `file.eol*` | 🟡+🟢 |
| Word Wrap | `view.wordWrap` | 🟡 |
| Ruler ▸ | `view.rulers` | ✅ (cycle) |
| Font ▸ (Larger / Smaller / Reset) | `view.font*` | 🟢 |
| Show Symbol ▸ | `view.show*` | ✅ |
| Fullscreen / Zoom / DevTools | role | ✅ |

## Goto
| Sublime item | Command | Status |
|---|---|---|
| Goto Anything / Symbol / Symbol in Project / Line / Word | `goto.*` | ✅ |
| Goto Definition `F12` | `goto.definition` | 🟢 |
| Jump Back / Forward | `nav.back/forward` | ✅ |
| Jump to Matching Bracket | `sel.jumpBracket` | 🟡 |
| Bookmarks ▸ | `bm.*` | ✅ |

## Tools
| Sublime item | Command | Status |
|---|---|---|
| Command Palette… | `goto.command` | 🟡 (adds to Tools) |
| Snippets… | `snippet.insert` | 🟡 |
| Macros ▸ (record/playback) | `macro.*` | ✅ |
| Build System ▸ / Build / Cancel | `build.*` | ✅ |
| Install Package Control | — | ⛔ (no package system) |

## Project
All items already implemented (`project.*`) ✅ — kept as-is.

## Preferences
| Sublime item | Command | Status |
|---|---|---|
| Settings / Key Bindings / Snippets | `prefs.*`, `snippet.edit` | ✅ |
| Color Scheme… | `view.theme` | ✅ |
| Font ▸ | `view.font*` | 🟢 |
| Auto Save ▸ | `prefs.autosave.*` | ✅ |

## Help
`help.about`, `help.ime` ✅ — kept.

---

## New commands & helpers to implement

**editor.js**
- `setEOL('CR')` support (currently only LF/CRLF).
- Closed-tab stack + `reopenClosed()` (push path on close).
- `revertActive()` — reload the active buffer from disk.
- `setLanguage(id)` — set a buffer's syntax.
- `setTabWidth(n)`, `toggleInsertSpaces()`.

**app.js** (new `def(...)`)
- `file.reopenClosed` (`Ctrl+Shift+T`), `file.closeWindow` (`Ctrl+Shift+W`), `file.revert`, `file.eolCR`.
- `edit.pasteAndIndent` (`Ctrl+Shift+V`), `edit.deleteWordForward/Backward`.
- `sel.selectAll`, `sel.single`, `sel.invert`.
- `find.useSelection` (`Ctrl+E`).
- `goto.definition` (`F12`).
- `view.fontLarger` (`Ctrl+=`), `view.fontSmaller` (`Ctrl+-`), `view.fontReset` (`Ctrl+0`), `view.toggleStatusBar`, `view.toggleTabs`.
- `lang.setTo` (arg), `edit.setTabWidth` (arg), `edit.toggleSpaces`.

**main.js** — rebuild the whole template + submenu builders: `syntaxSubmenu`, `lineEndingSubmenu`, `indentationSubmenu`, `fontSubmenu`, `sideBarSubmenu`.

**styles.css** — `body.hide-statusbar #statusbar`, `body.hide-tabs .tab-strip { display:none }`.
