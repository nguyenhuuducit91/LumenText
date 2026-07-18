# Đối chiếu Sublime Text 4 ↔ Lumen — Tài liệu phát triển tiếp

> **Ngày lập:** 2026-07-19
> **Sublime tham chiếu:** build **4200** (`/opt/sublime_text`, `dpkg: sublime-text 4200`)
> **Cách lập:** trích trực tiếp `Default.sublime-package` của Sublime đang cài trên máy
> — `Main.sublime-menu` (991 dòng), `Default.sublime-commands` (162 mục Command Palette),
> `Default (Linux).sublime-keymap` — rồi đối chiếu với **registry lệnh thực tế** của project
> (`app.js::registerCommands` + các module `src/renderer/js/*`, `main.js` IPC handlers).
>
> Trạng thái: ✅ Đã có (đúng hành vi Sublime) · 🟡 Có một phần / khác Sublime · ⬜ Chưa có
>
> Tài liệu này **thay thế phần đối chiếu** trong `SUBLIME_FEATURES_AND_PROMPT.md` (bản đó lập
> trước Phase 8) và phản ánh trạng thái code **hiện tại**. Roadmap ưu tiên ở cuối.

---

## 0. Tổng quan mức độ giống

| Nhóm | Sublime | Đã làm | Ghi chú |
|---|---|---|---|
| Command Palette (mục lệnh chuẩn ST) | 162 | ~70 lệnh app | phủ ~43% số lệnh, nhưng lệch nhóm |
| Editing lõi (Monaco lo) | rất rộng | ✅ phần lớn | thiếu biến thể case/permute/mark |
| Điều hướng (Goto Anything) | ✅ | ✅ | ngang Sublime |
| Encoding / Line-ending | đầy đủ | 🟡 chỉ LF/CRLF | **thiếu toàn bộ bảng encoding** |
| Layout / panes | grid đầy đủ | 🟡 1/2/3 cột | thiếu grid 2x2, rows, focus_group |
| Git / History diff | ✅ (dấu ấn ST4) | 🟡 gutter + revert file | **thiếu revert/next hunk, inline diff** |
| LSP (goto-def/rename/format) | qua LSP package | 🟡 diag/hover/completion | **chưa nối goto-def/rename/format** |
| Terminal | ⬜ (ST không có sẵn) | ⬜ | node-pty bị chặn build |
| Plugin API / Package Control | ✅ (điểm mạnh ST) | ⬜ | khoảng cách lớn nhất, dài hạn |
| File cực lớn | (ST kém) | ✅✅ | **Lumen vượt Sublime** |
| Gõ tiếng Việt inline | ⬜ | ✅ | **Lumen có, ST không** |

**3 khoảng cách khiến "chưa hoàn hảo":**
1. **Encoding & biến thể lệnh Edit** — cả một mảng lệnh nhỏ nhưng đông (encoding, case biến thể, permute, mark, wrap paragraph, trim whitespace, paste-history).
2. **Git History diff theo hunk + LSP goto/rename/format** — hai thứ Sublime 4 nổi bật mà Lumen mới làm dở.
3. **Layout đa pane + Plugin ecosystem** — grid/focus-group; và Package Control/Plugin API (rất dài hạn).

---

## 1. File / Window

| Sublime | Phím | Lumen | Việc cần làm |
|---|---|---|---|
| New / Open File / Open Folder | Ctrl+N/O | ✅ | — |
| Open Recent + Clear Items | — | 🟡 | có `openRecent`; thêm submenu + Clear Items |
| **Reopen Closed File** | Ctrl+Shift+T | 🟡 | hiện map vào Open Recent, **chưa phải reopen tab vừa đóng** |
| **Reopen with Encoding** (≈40 bảng mã) | — | ⬜ | đọc lại buffer, decode bằng `iconv-lite` (thêm dep) |
| **Save with Encoding** (UTF-8 BOM, UTF-16 LE/BE ±BOM) | — | ⬜ | encode qua `iconv-lite`; lưu BOM |
| **Reopen as Image / as Text / Hexadecimal** | — | ⬜ | image view (đã có icon logic); hex view = viewer riêng |
| New Window / Close Window | Ctrl+Shift+N | ✅ / 🟡 | có new; thêm close window |
| **Revert File** (nạp lại từ đĩa) | — | ⬜ | khác `git.revertFile`; đọc lại path, cảnh báo mất thay đổi |
| Close File / Close All Files | Ctrl+W | ✅ | — |
| **New View into File** (2 view cùng file) | — | ⬜ | Monaco: 2 editor share 1 model |
| **Split View** (tách file hiện tại sang pane) | — | 🟡 | có layout cột; thêm "move file to new group" |
| **Print / Copy as HTML** | Ctrl+P(print) | ⬜ | render HTML có màu → cửa sổ in |
| Exit / Quit | Ctrl+Q | 🟡 | có menu; thêm command `exit` + confirm dirty |

---

## 2. Edit — nhóm thiếu nhiều nhất

### 2.1 Đã có ✅
Undo/redo, cut/copy/paste, move/duplicate/delete/join line, indent/outdent, toggle comment
(line + block), sort asc/desc, transpose, reindent, convert indentation (spaces/tabs/detect),
case upper/lower/title, format document, fold all / unfold all.

### 2.2 Chưa có ⬜ / một phần 🟡

| Sublime | Phím | Lumen | Ghi chú triển khai |
|---|---|---|---|
| **Undo Selection / Soft Undo** | Ctrl+U | ⬜ | Monaco `cursorUndo` |
| **Paste from History** (clipboard ring) | Ctrl+K Ctrl+V | ⬜ | tự giữ mảng N clipboard gần nhất |
| **Paste and Indent** | Ctrl+Shift+V | 🟡 | Monaco `pasteAs`/reindent sau paste |
| **Insert Line Before / After** | Ctrl+Shift+Enter / Ctrl+Enter | ⬜ | Monaco `insertLineBefore/After` |
| **Delete to BOL / EOL** | — | ⬜ | Monaco `deleteAllLeft/Right` |
| **Convert Case:** Swap / lowerCamel / UpperCamel / snake / kebab | — | ⬜ | 5 biến thể còn thiếu; tự viết transform |
| **Wrap Paragraph at ruler / 70/72/78/80/100/120** | — | ⬜ | tự viết reflow text |
| **Sort/Permute Lines:** Reverse / Unique / Shuffle | — | ⬜ | tự viết (Monaco chỉ có asc/desc) |
| **Permute Selections:** Sort/Reverse/Unique/Shuffle | — | ⬜ | thao tác trên nhiều selection |
| **Trim Trailing White Space** | — | ⬜ | Monaco `trimTrailingWhitespace` |
| **Mark / Select to Mark / Delete to Mark / Swap / Clear Mark** | Ctrl+K Ctrl+Space… | ⬜ | dấu mark kiểu Emacs; lưu vị trí + thao tác |
| **Fold Level 2–9 / Fold Tag Attributes** | Ctrl+K Ctrl+2..9 | ⬜ | Monaco `editor.foldLevelN` |
| **HTML: Wrap Selection With Tag / Expand to Tag / Encode Special Chars** | — | ⬜ | Emmet-lite; xử lý chuỗi |
| **Show Completions** | Ctrl+Space | 🟡 | có (Monaco/LSP) nhưng chưa gắn phím ST |
| **Arithmetic / Rot13** | — | ⬜ | tiện ích nhỏ, dễ viết |

---

## 3. Selection

| Sublime | Lumen | Ghi chú |
|---|---|---|
| Multi-cursor (Ctrl+D), Split into Lines, Select All Occurrences | ✅ | — |
| Expand Selection (generic) / Shrink | ✅ | Monaco smartSelect |
| **Expand to: Line/Word/Block/Paragraph/Scope/Brackets/Indentation** | ⬜ | ST có lệnh riêng từng loại; Monaco chỉ smart-expand chung |
| **Add Previous / Next Line** (thêm cursor trên/dưới) | 🟡 | Monaco `insertCursorAbove/Below` — chưa gắn phím ST |
| **Column / Block selection** (kéo chuột giữa) | 🟡 | Monaco có column-select bằng Shift+Alt+drag; cần map middle-drag |
| Single selection (Escape thu về 1) | 🟡 | Monaco mặc định |

---

## 4. Find / Replace

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Find / Replace trong file (regex/case/word/in-sel) | Ctrl+F/H | ✅ | Monaco widget |
| Find Next/Prev | F3/Shift+F3 | ✅ | — |
| Find in Files (panel gom theo file, click nhảy) | Ctrl+Shift+F | ✅ | — |
| **Incremental Find (thật)** | Ctrl+I | 🟡 | hiện alias sang find thường |
| **Find Under / Find All Under / Find Under Expand Skip** | Ctrl+F3 / Alt+F3 / Ctrl+K Ctrl+D | 🟡 | có Alt+F3; thiếu 2 cái kia |
| **Next Result / Prev Result** (nhảy giữa kết quả find/build) | F4 / Shift+F4 | ⬜ | cần khi có build errors + find-in-files |
| **Replace All có preview** trong Find in Files | ⬜ | replace toàn project + xem trước |
| Regex/Case/Word/Wrap/In-selection toggles trong panel | 🟡 | Monaco widget có; panel Find-in-Files cần đủ toggle |

---

## 5. View / Layout / Panes

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Toggle Side Bar | Ctrl+K Ctrl+B | ✅ (Ctrl+B) | thêm chord ST |
| **Toggle Tabs / Status Bar / Menu** | — | ⬜ | ẩn/hiện từng thanh |
| **Toggle Open Files in Side Bar** | — | ⬜ | mục "OPEN FILES" đầu sidebar |
| Toggle Minimap | ✅ | — |
| **Full Screen** | F11 | ⬜ | `win.setFullScreen`; hiện chỉ có Zen (Shift+F11) |
| Distraction Free | Shift+F11 | 🟡 | có Zen; ST ẩn cả chrome + settings riêng |
| Layout **1/2/3 cột** | Alt+Shift+1/2/3 | ✅ | — |
| **Layout 4 cột / grid 2x2 / rows 2,3** | Alt+Shift+4/5/8/9 | ⬜ | mở rộng `setLayout` sang grid |
| **focus_group / move_to_group** | Ctrl+1..9 / Ctrl+Shift+1..9 | ⬜ | chuyển focus & đẩy file giữa pane |
| **new_pane / close_pane / destroy_pane** | Ctrl+K Ctrl+↑/↓ | ⬜ | thêm/bớt pane động |
| Rulers | ✅ (toggle 80/120) | — |
| Indent guides / Whitespace render | 🟡 | Monaco có; bổ sung toggle whitespace |
| Sticky scroll | ⬜ | Monaco `stickyScroll` (bật là xong) |

---

## 6. Tabs

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Context menu (close others/right/all, pin, copy path, reveal) | ✅ | đầy đủ |
| **Select tab theo số** | Alt+1..9 | ⬜ | `select_by_index` |
| **Next/Prev tab (Ctrl+PageUp/Down) + MRU (Ctrl+Tab)** | ⬜ | thêm lệnh + phím |
| **Multi-select tabs** (chọn nhiều tab thao tác) | ⬜ | ST4; cần state chọn nhiều |
| Drag-drop reorder / drag sang pane khác | 🟡 | reorder có?; kéo sang group khác chưa |
| New tab (＋) | ✅ | — |

---

## 7. Git & History (dấu ấn ST4)

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Diff marker ở gutter (thêm/sửa/xoá vs HEAD) | ✅ | LCS diff, có màu |
| Git status màu trong sidebar + branch ở status bar | ✅ | — |
| **History: Next / Previous Modification** | Ctrl+Shift+. / , | ⬜ | nhảy giữa các hunk |
| **History: Revert Hunk / Revert Modification** | — | ⬜ | revert từng hunk (đang chỉ revert cả file) |
| **History: Toggle Inline Diff** | — | ⬜ | hiện diff HEAD inline trong editor |
| Sublime Merge integration (Blame/File History) | ⬜ | N/A (không có ST Merge) — có thể bỏ hoặc dùng `git blame` panel |

---

## 8. Goto / Ngôn ngữ (LSP)

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Goto Anything file / `@symbol` / `:line` / `#word` | Ctrl+P | ✅ | ngang Sublime |
| Command Palette | Ctrl+Shift+P | ✅ | — |
| Goto Symbol in file / in project | Ctrl+R / Ctrl+Shift+R | ✅ | index tự viết |
| Jump back / forward | Alt+←/→ | ✅ | — |
| **Goto Definition / Reference** | F12 / Shift+F12 | ⬜ | LSP client đã có; **cần nối `textDocument/definition`** |
| **LSP Rename / Format / Signature Help / Code Action** | — | ⬜ | mở rộng `src/main/lsp.js` + renderer |
| Auto-complete context-aware | 🟡 | Monaco cơ bản + LSP completion |
| **Spell check** | F6 | ⬜ | dùng từ điển + Monaco decorations |
| Emmet / Close Tag | — | ⬜ | package ngoài ở ST; ở đây tự viết |

---

## 9. Build & Terminal

| Sublime | Phím | Lumen | Ghi chú |
|---|---|---|---|
| Build (auto npm/make/run file) | Ctrl+Shift+B | 🟡 | có auto-detect; **thiếu `.sublime-build`** |
| Re-run / Cancel build | F7 | ✅ / ✅ | — |
| Output panel click `file:line` → nhảy dòng | ✅ | — |
| **Show Build Results / Next-Prev error** | F4 | ⬜ | điều hướng lỗi build |
| **`.sublime-build` file** (biến `$file/$folder/$file_base_name`) | ⬜ | parser + biến thay thế |
| **Integrated terminal** (`Ctrl+\``) | ⬜ | node-pty bị chặn build trong môi trường này — cần headers electron; tạm dùng Build panel |

---

## 10. Preferences / Project / Session

| Sublime | Lumen | Ghi chú |
|---|---|---|
| Settings GUI (Default \| User JSON, live-apply) | ✅ | — |
| Key Bindings (JSON + chord) | ✅ | — |
| **Settings – Syntax Specific** | ⬜ | settings per-ngôn ngữ |
| **Settings – Distraction Free** | ⬜ | settings riêng chế độ zen |
| **Mouse Bindings** | ⬜ | `.sublime-mousemap` |
| **UI: Customize Color Scheme / Theme** | ⬜ | override màu qua JSON |
| Auto-save (off/delay/focus) | ✅ | — |
| Recent files/folders | ✅ | — |
| Session / hot-exit (folder + tabs + con trỏ) | ✅ | — |
| `.sublime-project` open/save | 🟡 | 1 folder; **thiếu multi-folder / workspace** |
| **Project: Add Folder (multi-root)** | ⬜ | sidebar nhiều gốc |
| **folder_exclude_patterns / file_exclude_patterns** | ⬜ | lọc walk / find-in-files |
| **Disk watcher** (tự refresh khi file đổi ngoài app) | ⬜ | `fs.watch` ở main → IPC |

---

## 11. Plugin / Ecosystem (dài hạn — khoảng cách lớn nhất)

| Sublime | Lumen | Ghi chú |
|---|---|---|
| **Plugin API** (Python: command, EventListener, view API) | ⬜ | ST viết bằng Python nhúng; ở đây có thể mở API JS/WASM sandbox |
| **Package Control** (cài package cộng đồng) | ⬜ | rất lớn |
| **Vintage (Vim) mode** | ⬜ | có thể tích hợp `monaco-vim` |
| **Command từ package hiện trong palette** | ⬜ | phụ thuộc plugin API |

---

## 12. Điểm Lumen đã VƯỢT / KHÁC Sublime (giữ, đừng bỏ)

- ✅ **Large-File streaming engine** (GB→100GB, sparse index) — Sublime mở file cực lớn kém hơn.
- ✅ **Gõ tiếng Việt inline qua fcitx5** (preedit tại caret) — Sublime **không có**.
- ✅ Nền Electron/Chromium → GPU render, HiDPI sẵn.

---

## 13. Roadmap ưu tiên (đề xuất)

Sắp theo **tỉ lệ giống/công sức** — làm nhóm rẻ-mà-đông trước.

### Đợt A — "nhặt đủ lệnh Edit/Selection" (rẻ, tăng % giống nhanh) — ✅ DONE (2026-07-19)
1. ✅ Case biến thể: swap/lowerCamel/UpperCamel/snake/kebab (`textcase.js` + test).
2. ✅ Permute Lines (Reverse/Unique/Shuffle) + Permute Selections (Sort/Sort CS/Reverse/Unique/Shuffle) (`permute.js` + test).
3. ✅ Trim Trailing Whitespace, Insert Line Before/After, Delete to BOL/EOL, Soft Undo/Redo (Ctrl+U/Ctrl+Shift+U).
4. ✅ Fold Level 2–7 (Monaco tops out at 7; Ctrl+K Ctrl+2..7), Show Completions (Ctrl+Space), Wrap Paragraph (`wrap.js` + test).
5. ✅ Expand-to Line/Brackets/Scope, Add Previous/Next Line (Alt+Shift+↑/↓), Jump to Bracket (Ctrl+M).
6. ✅ Rot13. ⬜ Arithmetic (bỏ — quá rìa).
   → *29 command mới, 3 helper thuần IIFE-wrapped (21 test), Sublime keys qua `addKeybindingRules`.
   Đã verify live (snake/kebab/camel/swap/rot13/reverse/unique) + ảnh palette "Convert Case:".*
   > **Bài học:** file `<script>` cổ điển dùng chung 1 global lexical scope → hai file cùng khai
   > `const api` ở top-level ném SyntaxError, file sau **âm thầm không chạy**. Bọc mọi helper trong IIFE.

### Đợt B — Encoding & File (đông người dùng cần)
7. `iconv-lite` → Reopen with Encoding + Save with Encoding (BOM), status bar hiện encoding.
8. Revert File (reload từ đĩa), Reopen as Text/Image/Hex.
9. Reopen Closed File **thật** (stack tab vừa đóng, Ctrl+Shift+T).

### Đợt C — Layout & Tabs (giống ST về "cảm giác")
10. Layout grid: 4 cột, 2x2, rows (Alt+Shift+4/5/8/9); focus_group Ctrl+1..9; move_to_group.
11. Select tab theo số Alt+1..9; next/prev tab Ctrl+PageUp/Down + MRU Ctrl+Tab.
12. Toggle Tabs/Status Bar/Menu; Full Screen F11; sticky scroll.
13. Multi-select tabs; drag file sang pane khác.

### Đợt D — Git History & LSP (dấu ấn ST4)
14. History: Next/Prev Modification, Revert Hunk, Toggle Inline Diff (mở rộng `git.js`).
15. LSP: nối Goto Definition/Reference (F12/Shift+F12), Rename, Format, Code Action, Signature Help.
16. Next/Prev Result (F4) dùng chung cho Find-in-Files + Build errors.

### Đợt E — Project & Watcher
17. Multi-root project + folder/file_exclude_patterns (áp cho walk + find-in-files).
18. Disk watcher (`fs.watch` → refresh sidebar/buffer, cảnh báo external change).
19. Settings – Syntax Specific / Distraction Free; Mouse Bindings.

### Đợt F — Dài hạn (product-scale)
20. `.sublime-build` parser; Build Results navigation.
21. Integrated terminal (giải node-pty: build electron headers, hoặc thử `xterm.js` + shell qua pty native).
22. Spell check (F6), Emmet/Close Tag.
23. Plugin API (JS/WASM sandbox) + package registry; Vim mode (`monaco-vim`).

---

## 14. Cách xác minh (nhắc lại quy ước project)

- Chạy: `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron . --no-sandbox`
- Kill: `killall -9 electron` (KHÔNG `pkill -f electron`).
- Chụp verify: env `LUMEN_SCREENSHOT=/path.png` (+ `LUMEN_EXEC='<js>'` để lái UI trước khi chụp).
- Test logic thuần: `npm test` (`node --test`). Mỗi lệnh mới nên có test cho helper.
- So sánh trực quan với Sublime thật: mở `/opt/sublime_text/sublime_text` cạnh app.

> **Nguồn chuẩn khi cần tên lệnh/phím Sublime:** giải nén
> `/opt/sublime_text/Packages/Default.sublime-package` (là file zip) → đọc
> `Default.sublime-commands`, `Main.sublime-menu`, `Default (Linux).sublime-keymap`.
