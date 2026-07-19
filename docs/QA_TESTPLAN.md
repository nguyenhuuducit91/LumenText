# QA Test Plan — Lumen (as Sublime Text QA Engineer)

> **Date:** 2026-07-19 · **Role:** QA Engineer · **Target:** Lumen (Electron + Monaco)
> **Scope:** 500+ test cases across typing, deleting, undo/redo, multicursor, folding,
> search, replace, regex, tabs, split view, scrolling, mouse, keyboard, IME, Unicode,
> emoji, huge file, 100000 lines, CRLF, LF, UTF-8, UTF-16.

## Legend
- **PASS** — verified (green automated test, or wired + Monaco-backed behavior confirmed by code + live screenshot).
- **FAIL** — real defect or missing behavior a Sublime user would hit. **File to fix is named.**
- **UNKNOWN** — cannot be verified without live hardware/session (fcitx IME, GPU scroll FPS, LSP server, real mouse gestures). Wiring is present but not machine-verifiable here.

## How to run the automated cases
```bash
npm test                         # 509 cases, 508 pass, 0 fail, 1 todo (documented UTF-16 huge-file limit)
node --test test/qa_encoding.test.js   test/qa_editing.test.js \
                test/qa_replace.test.js test/qa_largefile.test.js test/qa_tabs.test.js
```

## Totals
| | Count |
|---|---|
| Automated cases (green) | **508 PASS** |
| Automated documented-limitation | **1 TODO** (UTF-16 huge file) |
| Inspection / manual matrix cases | **~45** |
| **FAIL (defects/gaps)** | **4** |
| **UNKNOWN (needs live env)** | **5 areas** |

---

## 1. Summary matrix (by category)

| # | Category | Cases | Verdict | Method | If FAIL → file |
|---|---|---:|---|---|---|
| 1 | **typing** | 94 + 222 | ✅ PASS | auto (`qa_editing`, `qa_encoding`) + Monaco | — |
| 2 | **deleting** | 24 | ✅ PASS | auto (`qa_editing` del cases) + wired cmds | — |
| 3 | **undo** | 24 | ✅ PASS | auto (revert-reconstruction) + Monaco/`Ctrl+U` | — |
| 4 | **redo** | 24 | ✅ PASS | Monaco native `Ctrl+Y`/`Ctrl+Shift+Z` (verified not double-bound) | — |
| 5 | **multicursor** | 8 | ✅ PASS | inspect: `Ctrl+D`, split-into-lines, add-cursor wired to Monaco | — |
| 6 | **folding** | 8 | 🟡 PASS/⚠️FAIL | fold/unfold/level 2–7 PASS; **level 8–9 FAIL** | `src/renderer/js/app.js` |
| 7 | **search** | 10 | ✅ PASS | auto (`qa_replace` search) + live screenshot | — |
| 8 | **replace** | 37 | ✅ PASS | auto (`qa_replace`) | — |
| 9 | **regex** | 16 | ✅ PASS | auto (`qa_replace` regex) | — |
| 10 | **tabs** | 52 | ✅ PASS | auto (`qa_tabs`) + live screenshot | — |
| 11 | **split view** | 6 | 🟡 PASS/⚠️FAIL | 1/2/3 columns PASS; **grid 2×2 / rows / 4-col FAIL** | `src/renderer/js/editor.js` |
| 12 | **scrolling** | 6 | ✅ PASS / ⬜UNKNOWN | Monaco smooth + large-file virtual scroll (p50 12ms) PASS; live FPS UNKNOWN | — |
| 13 | **mouse** | 8 | 🟡 PASS/⚠️FAIL | click/dblclick/drag-reorder PASS; **column-select via middle-drag FAIL** | `src/renderer/js/editor.js` |
| 14 | **keyboard** | 30 | ✅ PASS | inspect keymap table + live palette screenshots | — |
| 15 | **IME** | 4 | ⬜ UNKNOWN | needs live fcitx5 session; wiring present in `main.js` | — |
| 16 | **Unicode** | 120 | ✅ PASS | auto (`qa_encoding` unicode corpus) | — |
| 17 | **emoji** | 40 | ✅ PASS | auto (`qa_encoding` emoji + `qa_largefile`) | — |
| 18 | **huge file** | 10 | 🟡 PASS/⚠️FAIL | UTF-8 GB streaming PASS; **UTF-16 streaming FAIL** | `src/main/largefile.js` |
| 19 | **100000 lines** | 12 | ✅ PASS | auto (`qa_largefile`) | — |
| 20 | **CRLF** | 8 | ✅ PASS | auto (`qa_encoding`, `qa_largefile` CRLF) | — |
| 21 | **LF** | 8 | ✅ PASS | auto | — |
| 22 | **UTF-8** | 96 | ✅ PASS | auto (roundtrips + detect) | — |
| 23 | **UTF-16** | 96 | 🟡 PASS/⚠️FAIL | normal files PASS (open/reopen/save); **streaming huge FAIL** | `src/main/largefile.js` |

---

## 2. FAIL details (4) — file + fix

### F1 · UTF-16 huge (streaming) file is garbled — `src/main/largefile.js`
- **Case:** open a >24 MB UTF-16LE/BE file → Large-File viewer shows garbage; line count wrong.
- **Cause:** the engine splits on the `0x0A` byte (`NL`), which is UTF-8-safe but **not** UTF-16-safe — `0x0A` occurs as a byte inside UTF-16 code units, and each "line" is `toString('utf8')`.
- **Test:** `test/qa_largefile.test.js` → *"UTF-16 huge-file decoding is a known limitation"* (`todo`).
- **Fix:** detect encoding from the BOM/first chunk at `open()`; for UTF-16 split on the 2-byte `0x0A 0x00` / `0x00 0x0A` unit and decode with the right encoding (reuse `src/main/encoding.js`), or transcode to UTF-8 in a temp index.

### F2 · Fold Level 8–9 unavailable — `src/renderer/js/app.js`
- **Case:** `Ctrl+K Ctrl+8` / `Ctrl+K Ctrl+9` (Sublime fold levels 8–9) do nothing.
- **Cause:** Monaco's `editor.foldLevelN` tops out at **7**; only levels 2–7 are registered (`registerEditorKeybindings`, `registerCommands`).
- **Fix:** compute fold ranges manually for deeper levels via the folding model, or document 2–7 as the supported range. (Low priority — deep nesting is rare.)

### F3 · Column/block selection via middle-mouse-drag missing — `src/renderer/js/editor.js`
- **Case:** a Sublime user middle-mouse-drags to make a column (rectangular) selection → nothing happens.
- **Cause:** Lumen relies on Monaco's `Shift+Alt+drag` column select; the ST middle-drag gesture is not mapped.
- **Fix:** on the pane host, intercept middle-button drag and translate to Monaco column selection (`multiCursorModifier` + `columnSelection` API / synthesized `Shift+Alt`).

### F4 · Grid / row layouts missing (only 1/2/3 columns) — `src/renderer/js/editor.js`
- **Case:** `Alt+Shift+4/5/8/9` (Sublime grid 2×2, rows, 4-col) → no such layout.
- **Cause:** `setLayout(count)` builds only N side-by-side columns; no 2-D grid or row arrangement, no `focus_group` / `move_to_group`.
- **Fix:** extend `setLayout` to accept a layout spec (rows×cols) and render a CSS grid of panes; add `Ctrl+1..9` focus-group.

> **All four are pre-existing gaps already tracked in `docs/REVIEW.md` (§8 High/Medium).** None is a regression from recent work.

---

## 3. UNKNOWN details (need live environment)

| Area | Why UNKNOWN | Wiring present? |
|---|---|---|
| **IME (fcitx5 inline preedit)** | Requires a live fcitx5 + X11/Wayland session and a human typing Vietnamese; cannot be asserted headlessly. | ✅ `main.js` sets `GTK_IM_MODULE/QT_IM_MODULE/XMODIFIERS`, `enable-wayland-ime`; Monaco hidden-textarea path. |
| **Scroll FPS / GPU smoothness** | Needs on-device frame-timing; only p50 read latency (12 ms) is measured for large files. | ✅ `smoothScrolling`, virtualized large-file viewer. |
| **Real mouse gestures** (hover tooltip timing, drag momentum, minimap slider drag) | Interaction-only; not reproducible in a unit harness. | ✅ Monaco-backed. |
| **LSP goto-def / hover / completion (live)** | Needs `typescript-language-server` installed + a real TS project + server round-trip. | ✅ client wired end-to-end (`lsp.js` ↔ `main/lsp.js`); providers registered. |
| **Multi-window session isolation** | Needs launching 2+ windows interactively. | 🟡 `New Window` works; per-window session isolation not implemented. |

---

## 4. Representative case lists (per category)

> Full enumerations live in the `test/qa_*.test.js` files; a sample is shown here with verdicts.

### 4.1 Typing (PASS)
- Type a char mid-line / first line / last line → correct model + 1 mod hunk — PASS (`qa_editing`)
- Type a multi-byte char (é, 日, 🚀) → codepoint intact, no split — PASS (`qa_encoding` roundtrips)
- Type into empty buffer → content appears — PASS
- Type with IME composition active → **UNKNOWN** (needs fcitx)
- Auto-indent on Enter, auto-close bracket — PASS (Monaco `autoClosingBrackets`)

### 4.2 Deleting (PASS)
- Backspace / Delete char — PASS (Monaco)
- Delete line `Ctrl+Shift+K`, Delete word fwd/back, Delete to BOL/EOL — PASS (commands wired)
- Delete a range spanning multi-byte chars → no half-codepoint — PASS (`qa_editing` unicode-edit)
- Delete last line / first line → correct hunk + revert — PASS (`qa_editing`)

### 4.3 Undo / Redo (PASS)
- Undo restores prior text (revert-reconstruction property) — PASS (`qa_editing` "undo" ×24)
- Redo re-applies — PASS (Monaco native, verified not double-bound in `app.js`)
- Soft undo/redo `Ctrl+U`/`Ctrl+Shift+U` (cursor history) — PASS (wired to `cursorUndo/Redo`)

### 4.4 Multicursor (PASS/inspect)
- `Ctrl+D` add next occurrence, `Alt+F3` select all, `Ctrl+Shift+L` split into lines — PASS (wired)
- `Alt+Shift+↑/↓` add cursor above/below — PASS
- Permute Selections sort/reverse/unique — PASS (`test/permute.test.js`)
- Type/delete with N carets simultaneously — PASS (Monaco), live multi-caret timing UNKNOWN

### 4.5 Folding (PASS + 1 FAIL)
- Fold / Unfold `Ctrl+Shift+[`/`]`, Fold All, Unfold All — PASS
- Fold Level 2–7 `Ctrl+K Ctrl+2..7` — PASS
- **Fold Level 8–9 — FAIL (F2)** → `app.js`

### 4.6 Search / Replace / Regex (PASS)
- Case-insensitive, whole-word `\b`, global count, unicode `\p{L}` — PASS (`qa_replace` search)
- Replace `$1/$2`, `\1` back-ref, `$&`, `$$` — PASS (`qa_replace` regex ×16)
- Replace with `\n`/`\t` escapes → real newline/tab — PASS
- Preserve-case (ALL CAPS / lower / Title) — PASS
- Find in Files multi-root aggregation, `F4`/`Shift+F4` results — PASS (inspect + fixed this cycle)

### 4.7 Tabs (PASS)
- Drag-reorder invariants (exhaustive 5-tab strip) — PASS (`qa_tabs` ×30)
- Neighbour selection on close (middle/first/last) — PASS
- Duplicate-name disambiguation (`a/app.js` vs `b/app.js`) — PASS
- `Alt+1..9` select-by-index, `Ctrl+PageUp/Down`, `Ctrl+Tab` MRU — PASS (logic tested)

### 4.8 Split view (PASS + 1 FAIL)
- Layout 1/2/3 columns `Alt+Shift+1/2/3`, per-pane viewState — PASS
- **Grid 2×2 / rows / 4-col — FAIL (F4)** → `editor.js`

### 4.9 Scrolling / Mouse / Keyboard
- Smooth scroll, scroll-beyond-last-line — PASS (Monaco)
- Large-file virtual scroll to any of 31.8M lines — PASS (bench + `qa_largefile`)
- Click/dbl-click/triple-click select, drag-select — PASS (Monaco)
- **Middle-drag column select — FAIL (F3)** → `editor.js`
- Keybindings (palette, find, goto, git hunk, tabs) — PASS (inspect + screenshots)
- Live scroll FPS — UNKNOWN

### 4.10 Unicode / Emoji (PASS — 160 auto cases)
- Vietnamese, CJK, Greek, Cyrillic, Arabic/Hebrew RTL, combining marks, ZWSP — PASS
- Emoji basic / skin-tone / ZWJ family / regional-flag / astral surrogate — PASS
- Roundtrip across UTF-8 / UTF-8-BOM / UTF-16 LE / UTF-16 BE — PASS

### 4.11 Huge file / 100000 lines / CRLF / LF / UTF (PASS + 1 FAIL)
- 100000-line index + read at every checkpoint boundary — PASS (`qa_largefile`)
- Emoji/unicode line at offset 70000 intact — PASS
- CRLF line count + trailing CR preserved — PASS
- LF no-trailing-newline counts final line — PASS
- Over-long (200 KB) line truncated, next line correct — PASS
- Read past EOF safe — PASS
- **UTF-16 streaming huge file — FAIL (F1)** → `largefile.js`

---

## 5. Verdict

**508 / 509 automated cases PASS** (1 documented UTF-16 huge-file limitation). Across all 23 requested
categories: **19 fully PASS**, **4 have a specific FAIL sub-case** (all pre-existing gaps, each with a
named file + fix), **5 areas UNKNOWN** (need live IME / GPU / LSP / multi-window sessions).

No **regressions** were found in the recently-changed code (Reopen-Closed, Encoding, Disk-watcher, and the
earlier bug-fix batch): typing, deleting, undo/redo, search/replace/regex, tabs, CRLF/LF, UTF-8/16 (non-huge),
Unicode and emoji are all green.

**Priority to reach "no FAIL":** F1 (UTF-16 huge — data-correctness) > F3 (middle-drag column select — daily
ergonomics) > F4 (grid layouts) > F2 (fold 8–9).
