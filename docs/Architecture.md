# Architecture

Lumen is an Electron application with a strict main/renderer split.
The renderer owns the UI and the Monaco editor; the main process owns all
filesystem, dialog and OS access. They talk only through a small, typed IPC
surface exposed by `preload.js` as `window.lumen`.

```
┌─────────────────────────── main process (Node) ───────────────────────────┐
│ main.js         window/menu lifecycle, IME switches, IPC handlers          │
│ src/main/store.js      atomic JSON state (settings / session / recent)     │
│ src/main/largefile.js  streaming engine for GB..100GB files (sparse index) │
└───────────────────────────────▲───────────────────────────────────────────┘
                                 │ ipcRenderer.invoke / .send  (contextBridge)
┌───────────────────────────────▼──── renderer (Chromium) ───────────────────┐
│ index.html   loads Monaco (AMD) then boots Lumen                             │
│ js/commands.js   command registry                                          │
│ js/editor.js     buffers, panes, tabs, IO, split, large-buffer routing     │
│ js/largefile.js  virtualised viewer over the streaming engine              │
│ js/sidebar.js    project tree                                              │
│ js/palette.js    command palette / goto-anything (fuzzy)                   │
│ js/app.js        orchestration, keybindings, themes, session restore       │
└────────────────────────────────────────────────────────────────────────────┘
```

## Process boundary

`preload.js` runs with `contextIsolation: true` and exposes exactly the calls
the renderer needs (file read/write/readdir/walk/stat, dialogs, persistent
state, the large-file engine, window management, and two inbound events:
`menu-command`, `open-path`). The renderer never touches `fs` directly.

## Text model

Normal-sized files load into a Monaco `ITextModel` (rope-backed, multi-cursor,
undo, syntax). Files at or above `LARGE_FILE_BYTES` (24 MB) are **not** loaded
into a model — they are streamed (see below).

## Large-file engine (`src/main/largefile.js`)

The hard part of "open a 100 GB file without freezing":

- The file is opened once (`fd`) and only the byte ranges on screen are read.
- A background streaming scan builds a **sparse line index**: the byte offset of
  every `CHECKPOINT_EVERY` (4096th) line, plus the total line count. Memory is
  `O(lines / 4096)` — a 100 GB / ~1e9-line file needs a few MB, not gigabytes.
- To fetch lines `[start, start+count)` the engine seeks to the nearest
  checkpoint and scans forward, splitting on `\n`. `0x0A` never appears inside a
  UTF-8 multi-byte sequence, so byte-splitting is UTF-8 safe (emoji included).
- Over-long lines are capped at `MAX_LINE_BYTES` (64 KB) so one pathological line
  can never exhaust memory.

The renderer (`js/largefile.js`) is a virtualised read-only viewer: it renders
only a screenful, and for files taller than the browser's max element height it
maps the scrollbar range proportionally onto the line range (klogg-style).

Measured on a 3.22 GB / 31.8 M-line file (2-core i5-4278U, cold cache):
index 12.7 s (0.25 GB/s, ~0.1 MB index RAM), random screenful read p50 12 ms.

Verified by `test/largefile.test.js` (7 cases) and `scripts/bench-largefile.js`.

## Persistence & session (`src/main/store.js`)

A single `state.json` under `app.getPath('userData')` holds `settings`,
`session` and `recent`. Writes are debounced and atomic (temp file + rename) so
a crash can never truncate it. On quit the store is flushed and large-file fds
are closed (`will-quit`).

Session = `{ folder, files[], active{path,line,col} }`. It is saved (debounced)
whenever tabs or the project folder change, and once more on `beforeunload`. On
launch **without** a CLI path argument, the renderer restores it — reopening the
folder, the tabs, the active file and its cursor (hot exit).

## Vietnamese input (fcitx)

On Linux the main process opts into inline IME: `enable-wayland-ime` +
`wayland-text-input-version=3`, and ensures `GTK_IM_MODULE/QT_IM_MODULE/
XMODIFIERS=fcitx`. Monaco's hidden textarea receives composition events, so the
preedit string is drawn inline at the caret rather than in a popup.

## Roadmap (honest)

Done: core editing, command palette, goto-anything (`@`/`#`/`:`), sidebar/project,
split, themes (One Dark cohesive default + Monokai), minimap, fcitx inline input,
**large-file streaming**, **session/hot exit**, persistent state layer,
**Find-in-Files** (project search with regex/case/word), file-type icons,
**Phase 1 editor ops** (move/duplicate/delete/join/sort lines, indent/outdent,
toggle line & block comment, case transform, transpose, expand/shrink selection,
Find Next/Prev, incremental find) — wired to Monaco actions + Sublime keybindings
via the Electron menu + `monaco.editor.addKeybindingRules` (chords).

**Phase 2 config** (`src/renderer/js/{settings,keymap}.js`): Settings as JSON with
a 2-pane Default|User view, live-applied to every editor and persisted to
`<userData>/Preferences.sublime-settings` (re-applied on save and at startup);
user keybinding profiles (`Preferences.sublime-keymap`) with chord support via a
canonicalising dispatcher that layers over the built-in menu keys; auto-save
(after-delay / on-focus-change); recent files/folders; LF/CRLF convert + status.

**Phase 3 Git** (`src/main/git.js` + `src/renderer/js/git.js`): the main process
shells out to the `git` CLI (root/status/branch/HEAD-blob — no native lib); the
renderer paints sidebar status colours, the current branch in the status bar, and
incremental gutter markers (add/modified/deleted vs HEAD) from an LCS line diff.
Refreshes on folder open, save and window focus; `Git: Revert File to HEAD`.

**Phase 5/6** (`src/renderer/js/{snippets,bookmarks}.js`): snippets as Monaco
completions expanding with tab-stops (user JSON at `<userData>/Snippets.json`);
per-buffer bookmarks in the glyph margin with wrap-around nav; distraction-free
(zen) mode, rulers (settings-driven), and `automaticLayout` so the editor
relayouts on any container change (a `grid-column: 3` pin keeps #main in the
1fr track when the sidebar/resizer are hidden).

**Build + Macros** (`src/renderer/js/{build,macros}.js`): the main process
`spawn`s shell commands (`proc:run`, cleared of ELECTRON_RUN_AS_NODE) and streams
stdout/stderr to a bottom output panel that reports the exit code and linkifies
`file:line[:col]` to jump; build variants auto-detect npm scripts / Makefile /
run-current-file plus a custom command. Macros record typed text (Monaco
`onDidType`) and executed commands (via `LUM.commands.onRun`) and replay them.

**Batch: nav / adaptive / symbols / LSP** (`src/renderer/js/{nav,symbols,lsp}.js`,
`src/main/lsp.js`): jump back/forward cursor history (Alt+←/→); adaptive theme
following `prefers-color-scheme`; project symbol index + Goto Symbol in Project
(Ctrl+Shift+R); reindent/convert-indentation; `.sublime-project` save/open; and a
real LSP client — spawns typescript-language-server via Electron-as-Node, JSON-RPC
over stdio (Content-Length framing), rendering diagnostics as Monaco markers plus
completion + hover for JS/TS (optionalDependencies).

**Phase 7 polish foundations** (`src/shared/tabutil.js` + `src/renderer/js/{dialog,menu}.js`):
pure, unit-tested tab helpers (`pickNeighbor`, `reorder`, `disambiguateLabels`);
an async themed `LUM.dialog` (replaces blocking `confirm` — 3-button save/discard/
cancel on close-dirty) and a shared `LUM.menu` context menu; tabs now disambiguate
duplicate basenames (VSCode-style), colour by git status, drag to reorder, and
carry a right-click menu (close others/right/saved/all, pin, copy path, reveal).

**Phase 8 sidebar file operations** (`src/shared/pathops.js` + `src/renderer/js/sidebar.js`):
the project tree now carries the full file-management surface. A shared themed
right-click menu (`LUM.menu`) offers New File/Folder, Rename, Duplicate, Delete,
Copy Path / Copy Relative Path, Reveal in File Manager and (on folders) Find in
Folder…; the same actions are registered as `side.*` commands for the palette,
and a `#file-tree` background right-click gives the root-level menu. New/rename
use an **inline input** rendered in the tree (validated live, stem-only selection,
Enter commits / Esc cancels / blur commits) instead of `prompt()`. Delete goes to
Trash behind an async confirm dialog; Duplicate/paste-collision names come from the
unit-tested `pathops.dedupeName` ("app copy.js", "app copy 2.js"). All OS mutations
route through new main handlers (`fs:copy`, `fs:move` with EXDEV copy+trash
fallback, plus the existing mkdir/rename/delete/showItem); open buffers are kept in
sync via `editor.applyPathChange` (file or parent-folder rename) and
`editor.markPathDeleted`. Header hover-actions (New File/Folder, Collapse All,
Refresh), an empty-state "Open Folder" panel, and `revealInSidebar` (expand
ancestors + scroll + flash, wired to the tab menu's "Reveal in Sidebar") round it
out. Pure helpers covered by `test/pathops.test.js` (15 cases: splitName,
dedupeName, validateName). Still open in Phase 8: in-tree keyboard navigation
(8.3), drag-and-drop move (8.4), multi-select (8.5), filter box (8.6), multi-root
(8.7) and the disk watcher (8.9).

**Phase 8.7 Projects & multi-root** (`src/renderer/js/project.js` + a native
**Project menu** in `main.js`): the sidebar `root` became `roots[]` — several
folders open at once, each a collapsible group header (`.root-row`); single-folder
keeps the flat look. `LUM.project` owns the `.sublime-project` file (JSON
`{folders:[{path}],settings}`): Open / Switch / **Quick Switch** (Ctrl+Alt+P quick
panel of recents) / Save As / Save / Close / Edit / Add Folder / Remove all Folders
/ Refresh Folders — all as `project.*` commands and menu items. Folder paths
serialize **relative to the project file** when possible ("." for its own folder,
`../x` avoided → absolute), and resolve back on open. Recent projects live in the
main-process store and drive a **dynamic native "Open Recent" submenu** (rebuilt via
`buildMenu()` on `project:addRecent`). The palette file-index and session now span
all roots (session persists `folders[]` + `project`, back-compat with old
`folder`). New main handlers: `fs:copy`, `fs:move`; new path helpers in preload
(`resolve`/`isAbsolute`/`relative`). Verified: multi-root render screenshot +
save→reopen round-trip (relative "." + absolute sibling resolve correctly) + 35
`npm test`.

**Batch A — Edit/Selection command fill-in** (`src/renderer/js/{textcase,permute,wrap}.js`
pure helpers + `textops.js` Monaco bridge): ~29 new palette commands with Sublime
captions. Convert Case variants (Swap / lowerCamel / UpperCamel / snake / kebab) and
`Rot13 Selection` apply per-selection (empty selection → word under caret); Permute
Lines (Reverse/Unique/Shuffle) and Permute Selections (Sort/Sort CS/Reverse/Unique/
Shuffle) operate on the selected line span or region set; plus Trim Trailing White
Space, Insert Line Before/After, Delete to BOL/EOL, Soft Undo/Redo, Fold Level 2–7,
Wrap Paragraph at Ruler, Show Completions, Expand-to Line/Brackets/Scope, Add
cursor above/below, Jump to Matching Bracket. Sublime editor keys are bound via
`monaco.editor.addKeybindingRules` (Ctrl+Enter, Ctrl+U, Ctrl+L, Ctrl+M, Alt+Shift+↑/↓,
Ctrl+K Ctrl+2..7, …). Pure helpers covered by `test/{textcase,permute,wrap}.test.js`
(21 cases). **Gotcha recorded:** classic `<script>` files share ONE global lexical
scope, so two files with a top-level `const api = …` throw a redeclaration
SyntaxError and the second silently fails to load — every shared helper is now
IIFE-wrapped. Verified live: snake/kebab/camel/swap/rot13/reverse/unique via a
driven editor + palette screenshot.

**UI Fidelity — Mariana/Adaptive theme** (per docs/SUBLIME_UI_FIDELITY.md): the
default look is now Sublime Text 4's **Mariana** (navy `#303841`, orange caret
`#f9ae58`) instead of One-Dark. `:root` chrome tokens + a new
`defineTheme('stp-mariana')` Monaco scheme (default in `LUM.state`, settings, and
`baseOptions`); editor tuned to ST habits (bracket-pair colourisation off,
`renderLineHighlight:'line'`, orange 2px caret, sticky scroll, minimap
`showSlider:'mouseover'`, indent guides). Chrome corrected to Adaptive: active tab
blends into the editor with a thin orange underline (no blue top bar), quick-panel
& menu & sidebar active items use the **muted `--sel` fill** (not solid blue),
fuzzy-match marks are bold/bright, dirty-dot is neutral, thin 10px overlay
scrollbars, 22px status bar reordered to ST (Ln/Col · indent · encoding · EOL ·
language, clickable). Verified against the Mariana reference via screenshots.

**View > Show Symbol — invisibles** (`src/renderer/js/invisibles.js`): a native
checkbox submenu + `view.show*` commands toggling Space and Tab
(`renderWhitespace:'all'`), End of Line (viewport-aware injected `¬` glyphs),
Non-Printing Character (`renderControlCharacters`), Control Character + Unicode EOL
(`unicodeHighlight`), Indent Guide (`guides.indentation`), and Wrap Symbol (word
wrap + `.show-wrap-symbol`). State persists in the main store (drives the menu
checkmarks) and re-applies on boot and to new split panes.

Next candidates, in rough priority: rest of Phase 8 (tree keyboard nav, drag-move,
filter, per-root git/search, disk watcher), Batch B (encoding, revert, reopen-closed),
integrated terminal
(real PTY needs node-pty native build — blocked here), tab pin/preview/multi-select,
hunk-level git revert. The full commercial-grade
feature set (LSP for all languages, plugin sandbox, AI agent, remote/DB tools)
is a long, multi-phase road — each phase shipped as real, tested increments, not
mocks.
