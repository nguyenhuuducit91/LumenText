# Yêu cầu phát triển chi tiết — Đưa Lumen tiệm cận Sublime Text 4

> **Ngày lập:** 2026-07-19 · **Nguồn đối chiếu:** Sublime build 4200 (phím/tên lệnh trích từ
> `Default (Linux).sublime-keymap` + `Default.sublime-commands`).
> **Đọc trước:** [SUBLIME_GAP_ANALYSIS.md](SUBLIME_GAP_ANALYSIS.md) (bảng khoảng cách) và
> [Architecture.md](Architecture.md) (kiến trúc main/renderer).
>
> Tài liệu này là **đặc tả thực thi**: mỗi task nêu rõ `command id`, tiêu đề, **phím Sublime thật**,
> Monaco action (hoặc helper cần tự viết + thuật toán), file phải sửa, tiêu chí nghiệm thu, test.
> Làm **tuần tự theo đợt A→F**. Mỗi task là 1 increment verify được độc lập.

---

## 0. Prompt khởi động (dán cho phiên Claude Code mới)

```
Bạn làm việc trong project Lumen (Electron + Monaco) tại
/home/duc-nguyenuu/DATA/PROJECT_ME/SublimeTextPlus.
Đọc docs/DEV_REQUIREMENTS.md và docs/SUBLIME_GAP_ANALYSIS.md.
Thực thi ĐỢT A trước, tuần tự từng task. Với mỗi task:
  1. code (tôn trọng ranh giới main/renderer, contextIsolation — renderer KHÔNG đụng fs,
     mọi OS access đi qua window.lumen → IPC trong preload.js/main.js);
  2. đăng ký command bằng def(id,title,category,keybind,run) trong
     src/renderer/js/app.js::registerCommands + map phím trong keymap nếu cần;
  3. logic thuần tách ra src/shared/*.js và viết test (test/*.test.js, chạy `node --test`);
  4. verify bằng ảnh: LUMEN_SCREENSHOT=/path.png (+ LUMEN_EXEC='<js>' để lái UI) —
     chạy `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron . --no-sandbox`,
     kill bằng `killall -9 electron`;
  5. báo cáo trung thực (test pass mấy/mấy, ảnh chụp cho thấy gì). KHÔNG mock, KHÔNG
     báo "xong" khi chưa verify.
Sau mỗi đợt: cập nhật docs/Architecture.md và đánh dấu ✅ trong SUBLIME_GAP_ANALYSIS.md.
KHÔNG viết lại native. KHÔNG phá session/large-file/fcitx đang chạy.
```

---

## 1. Quy ước chung (đọc 1 lần)

**Đăng ký lệnh** — trong [app.js:126](../src/renderer/js/app.js#L126) `registerCommands()`:
```js
def('edit.swapCase', 'Convert Case: Swap Case', 'Edit', '', () => LUM.textops.applyCase('swap'));
```
- `id` theo namespace hiện có (`edit.` `sel.` `view.` `git.` `tab.` `goto.` …).
- `title` **dùng đúng caption Sublime** (xem `Default.sublime-commands`) để palette khớp ST,
  vd `Convert Case: snake_case`, `Permute Lines: Unique`, `History: Revert Hunk`.
- `keybind` là chuỗi hiển thị (vd `Ctrl+K Ctrl+U`); **binding thật** khai trong keymap engine.

**Gọi Monaco action** — đã có helper `triggerAction(actionId)` ([app.js:277](../src/renderer/js/app.js#L277)).
Nếu Monaco có sẵn action → chỉ cần `def(... () => triggerAction('editor.action.xxx'))`.

**Logic thuần** (biến đổi text, sort, diff…) → tách ra `src/shared/*.js`, export testable,
theo mẫu [pathops.js](../src/shared/pathops.js) + [test/pathops.test.js](../test/pathops.test.js).

**Áp text lên nhiều selection** — dùng mẫu:
```js
const ed = LUM.editor.activeEditor(), model = ed.getModel();
const edits = ed.getSelections().map(sel => ({
  range: sel, text: transform(model.getValueInRange(sel)), forceMoveMarkers: true
}));
ed.executeEdits('stp', edits);
```

**Định nghĩa Done cho mỗi task:** (a) command chạy đúng trên ≥2 selection & 1 cursor;
(b) hiện trong Command Palette đúng caption; (c) phím ST hoạt động (nếu có); (d) test pass nếu
có logic thuần; (e) 1 ảnh LUMEN_SCREENSHOT chứng minh; (f) không lỗi console.

**Lưu ý xung đột phím:** Lumen đang dùng `Ctrl+B`=sidebar (ST dùng `Ctrl+K Ctrl+B`),
`F7`=build, `Ctrl+Q`=macro record. Khi phím ST đụng phím Lumen hiện có → **giữ phím ST làm chuẩn**
nếu ô đó đang trống; nếu đụng, ghi chú trong keymap và ưu tiên hành vi ST cho lệnh mới, hoặc
đưa vào chord `ctrl+k` như Sublime. Ghi rõ mọi quyết định lệch vào `docs/Architecture.md`.

---

## ĐỢT A — Lệnh Edit/Selection còn thiếu (rẻ, tăng % giống nhanh)

> Mục tiêu: nhặt hết các lệnh nhỏ mà Command Palette Sublime có. Phần lớn là helper thuần +
> Monaco action. Ưu tiên làm trước vì rẻ và test dễ.

### A1. Convert Case — 5 biến thể còn thiếu
- **Có sẵn:** upper (`Ctrl+K Ctrl+U`), lower (`Ctrl+K Ctrl+L`), title.
- **Thêm:** `Swap Case`, `lowerCamelCase`, `UpperCamelCase`, `snake_case`, `kebab-case`.
- **Phím ST:** chỉ upper/lower có phím; 5 cái này **chỉ ở palette** (không phím).
- **Việc:** tạo `src/shared/textcase.js` export `toCase(text, mode)` với mode ∈
  `swap|lowerCamel|upperCamel|snake|kebab`. Quy tắc:
  - `swap`: đảo hoa/thường từng ký tự.
  - camel/snake/kebab: tách token theo ranh giới `[ _\-]`, chữ hoa giữa từ (camelCase),
    số; rồi ghép lại. `lowerCamel`: từ đầu thường; `upperCamel`: từ đầu hoa; `snake`: nối `_`
    thường; `kebab`: nối `-` thường.
- **Command:** `edit.swapCase`, `edit.camelLower`, `edit.camelUpper`, `edit.snake`, `edit.kebab`
  — caption `Convert Case: …` đúng ST.
- **Test:** `test/textcase.test.js` — `helloWorld/hello_world/hello-world/HELLO` qua các mode.
- **Nghiệm thu:** bôi `getUserName` → snake ra `get_user_name`; kebab ra `get-user-name`.

### A2. Permute Lines & Permute Selections
- **Thêm (Lines):** `Permute Lines: Reverse` / `Unique` / `Shuffle`.
  **(Selections):** `Permute Selections: Sort` / `Sort (Case Sensitive)` / `Reverse` / `Unique` / `Shuffle`.
- **Phím ST:** không (palette-only).
- **Việc:** `src/shared/permute.js` export `reverse(lines)`, `unique(lines)`, `shuffle(lines, rnd)`
  (nhận hàm random để test được), `sortStrings(arr, caseSensitive)`. Lines thao tác trên toàn
  bộ (hoặc vùng chọn nếu có); Selections thao tác trên mảng text của các selection rồi ghi lại.
- **Command:** `edit.permuteReverse/Unique/Shuffle`, `sel.permuteSort/SortCS/Reverse/Unique/Shuffle`.
- **Test:** `test/permute.test.js` — unique giữ thứ tự xuất hiện đầu; shuffle với rnd cố định
  cho kết quả xác định; reverse đảo đúng.

### A3. Trim / Whitespace / Line insert / Soft undo
| Command id | Caption | Phím ST | Monaco action / helper |
|---|---|---|---|
| `edit.trimTrailing` | Trim Trailing White Space | — | `editor.action.trimTrailingWhitespace` |
| `edit.insertLineAfter` | Insert Line After | Ctrl+Enter | `editor.action.insertLineAfter` |
| `edit.insertLineBefore` | Insert Line Before | Ctrl+Shift+Enter | `editor.action.insertLineBefore` |
| `edit.deleteToEOL` | Delete to End | — | `deleteAllRight` |
| `edit.deleteToBOL` | Delete to Beginning | — | `deleteAllLeft` |
| `edit.softUndo` | Soft Undo | Ctrl+U | `cursorUndo` |
| `edit.softRedo` | Soft Redo | Ctrl+Shift+U | `cursorRedo` |
- **Nghiệm thu:** Soft Undo lùi từng bước con trỏ (không hoàn tác text) — khác Undo thường.

### A4. Fold theo cấp
- **Thêm:** `Fold Level 2..9` (`Ctrl+K Ctrl+2..9`), `Fold All`, `Unfold All` (đã có), `Fold Tag Attributes`.
- **Monaco:** `editor.foldLevel1`..`editor.foldLevel7` (⚠️ Monaco chỉ tới **7**; level 8–9 map về 7
  và ghi chú giới hạn). Fold Tag Attributes: Monaco không có → có thể bỏ hoặc ghi ⬜.
- **Command:** `edit.foldLevel2..7` caption `Code Folding: Fold Level N`.

### A5. Wrap paragraph & Show completions
| Command | Caption | Phím ST | Ghi chú |
|---|---|---|---|
| `edit.wrapLines` | Word Wrap: Toggle | Alt+Q(ST=wrap_lines) | Lumen đã có `Alt+Z` toggle wrap — thêm caption ST |
| `edit.wrapParagraph` | Wrap Paragraph at Ruler | — | helper reflow: gom đoạn, cắt ở ≤N cột (N=ruler đầu hoặc 80) |
| `edit.showCompletions` | Show Completions | Ctrl+Space | `editor.action.triggerSuggest` |
- **Việc wrapParagraph:** `src/shared/wrap.js` `wrapText(text, width)` giữ nguyên xuống dòng đôi
  (ranh giới đoạn), gói mềm trong đoạn. Test các mép từ.

### A6. Expand Selection biến thể + Add line cursor
| Command | Caption | Phím ST | Monaco |
|---|---|---|---|
| `sel.expandToLine` | Selection: Expand to Line | Ctrl+L | `editor.action.expandLineSelection` |
| `sel.expandToBrackets` | Selection: Expand to Brackets | Ctrl+Shift+M | `editor.action.selectToBracket` |
| `sel.expandToScope` | Selection: Expand to Scope | Ctrl+Shift+Space | `smartSelect.expand` (xấp xỉ) |
| `sel.addCursorUp` | (Add Previous Line) | Alt+Shift+Up | `editor.action.insertCursorAbove` |
| `sel.addCursorDown` | (Add Next Line) | Alt+Shift+Down | `editor.action.insertCursorBelow` |
| `sel.jumpBracket` | Jump to Matching Bracket | Ctrl+M | `editor.action.jumpToBracket` |

### A7. Tiện ích nhỏ (lấp palette cho giống)
- `edit.rot13` — `HTML: Rot13`… thực ra ST caption `Rot13 Selection`; helper thuần trong `textcase.js`.
- `edit.arithmetic` — `Arithmetic` (ST): nhập biểu thức áp cho mỗi selection (số). Có thể để ⬜ nếu
  quá rìa; ưu tiên thấp.

**Kết thúc Đợt A:** ≥20 command mới trong palette đúng caption ST; 3 file shared có test;
`npm test` xanh; 1 ảnh palette lọc `Convert Case:` cho thấy đủ 8 mục.

---

## ĐỢT B — Encoding & File

### B1. Reopen / Save with Encoding
- **Dep:** thêm `iconv-lite` (thuần JS, không native — an toàn với môi trường chặn build).
- **Main:** thêm IPC `fs:readEncoded(path, enc)` và `fs:writeEncoded(path, content, enc, bom)`
  trong [main.js](../main.js) + preload bridge. Decode/encode qua `iconv.decode/encode`.
- **Renderer:** menu **Reopen with Encoding** & **Save with Encoding** dựng từ danh sách ST
  (UTF-8, UTF-8 BOM, UTF-16 LE/BE ±BOM, Windows-1258 Vietnamese, ISO-8859-1/15, Windows-1252,
  … — lấy list từ `Encoding.sublime-menu`). Status bar bấm được để đổi encoding (như ST).
- **Command:** `file.reopenEncoding`, `file.saveEncoding` (mở submenu chọn), lưu `buffer.encoding`.
- **Nghiệm thu:** mở file Windows-1258 hiển thị đúng tiếng Việt; lưu UTF-16 LE BOM rồi mở lại đúng.

### B2. Revert File (nạp lại từ đĩa)
- `file.revert` — caption `File: Revert`. Đọc lại `buffer.path` từ đĩa, nếu buffer dirty thì
  confirm qua `LUM.dialog`. Khác hoàn toàn `git.revertFile` (về HEAD).

### B3. Reopen Closed File (thật)
- `file.reopenClosed` — `Ctrl+Shift+T` (hiện đang trỏ nhầm sang Open Recent).
- **Việc:** giữ **stack các tab vừa đóng** (path + viewState + cursor) trong `editor.js`; khi
  đóng tab push vào stack; lệnh này pop và mở lại đúng vị trí con trỏ.
- **Nghiệm thu:** đóng tab đang ở dòng 120 → reopen về đúng dòng 120.

### B4. Reopen as Text / Image / Hex
- `file.reopenAsText`, `file.reopenAsImage` (đã có icon logic — render `<img>` view),
  `file.reopenAsHex` (viewer hex đơn giản: offset | bytes | ascii, tái dùng large-file streaming
  để không nạp hết RAM). Ưu tiên: Text > Image > Hex.

---

## ĐỢT C — Layout & Tabs (cảm giác ST)

### C1. Layout grid đầy đủ
- **Hiện:** `setLayout(1|2|3)` chỉ cột. **Thêm:** 4 cột, **grid 2x2**, **rows 2/3**.
- **Phím ST (giữ đúng args cells):**
  - `Alt+Shift+4` 4 cột · `Alt+Shift+5` grid 2x2 · `Alt+Shift+8` 2 hàng · `Alt+Shift+9` 3 hàng.
- **Việc:** tổng quát hoá `editor.setLayout` sang mô hình `{cols, rows, cells}` như ST (mỗi cell
  = một group chứa tab). Cập nhật CSS grid trong [styles.css](../src/renderer/styles.css).

### C2. Focus / Move to group
- `view.focusGroupN` `Ctrl+1..9` (focus group 0..8); `view.moveToGroupN` `Ctrl+Shift+1..9`
  (đẩy tab hiện tại sang group). `view.newPane` `Ctrl+K Ctrl+Up`, `view.closePane` `Ctrl+K Ctrl+Down`.
- ⚠️ `Ctrl+1..9` hiện chưa dùng — OK. Ghi rõ vào keymap.

### C3. Điều hướng tab
- `tab.selectByIndex` `Alt+1..8` (nhảy tab theo số, index 0..7).
- `tab.next` `Ctrl+PageDown`, `tab.prev` `Ctrl+PageUp`.
- `tab.mruNext` `Ctrl+Tab`, `tab.mruPrev` `Ctrl+Shift+Tab` (theo thứ tự truy cập gần nhất — giữ
  MRU stack trong editor.js).

### C4. Toggle chrome + Full screen
- `view.toggleTabs`, `view.toggleStatusBar`, `view.toggleMenu`, `view.fullScreen` (`F11`,
  qua IPC `win:setFullScreen`), `view.stickyScroll` (Monaco `stickyScroll.enabled`).
- Caption đúng ST: `View: Toggle Tabs` / `Toggle Status Bar` / `Toggle Menu` / `Toggle Full Screen`.

### C5. Multi-select tabs (ST4)
- Ctrl/Shift-click chọn nhiều tab; thao tác Close/Move áp cho tập chọn. Giữ `selectedTabIds:Set`
  trong editor.js; render viền chọn; cập nhật context menu tab.

---

## ĐỢT D — Git History & LSP (dấu ấn ST4)

### D1. History diff theo hunk
- **Hiện:** gutter diff (LCS) + revert cả file. **Thêm:** điều hướng & revert từng hunk.
- **Việc:** trong [git.js (renderer)](../src/renderer/js/git.js) đã tính hunks cho gutter → tái dùng.
  - `git.nextMod` `Ctrl+.` (caption `History: Next Modification`) — nhảy con trỏ tới hunk kế.
  - `git.prevMod` `Ctrl+,` (`History: Previous Modification`).
  - `git.revertHunk` `Ctrl+K Ctrl+Shift+Z` (`History: Revert Hunk`) — thay đoạn hiện tại bằng
    text HEAD tương ứng (đã có `git:headFile` IPC).
  - `git.toggleInlineDiff` `Ctrl+K Ctrl+/` (`History: Toggle Inline Diff`) — hiện dòng HEAD
    xoá/sửa dạng decoration inline.
- **Nghiệm thu:** sửa 1 dòng, `Ctrl+.` nhảy tới, `Ctrl+K Ctrl+Shift+Z` phục hồi đúng dòng HEAD.

### D2. LSP: nối Goto/Rename/Format/Action
- **Hiện:** [lsp.js](../src/main/lsp.js) có diagnostics/hover/completion. **Thêm** request:
  - `textDocument/definition` → `edit.gotoDef` `F12` (`Goto Definition`); side-by-side `Ctrl+F12`.
  - `textDocument/references` → `edit.gotoRef` `Shift+F12` (`Goto Reference`) — panel kết quả
    (tái dùng UI Find-in-Files).
  - `textDocument/rename` → `edit.rename` (`F2`? — ST không map; để palette `Rename Symbol`).
    ⚠️ `F2` hiện = bookmark next; giữ bookmark, rename để palette-only hoặc chord.
  - `textDocument/formatting` → nối vào `edit.format` (đang dùng Monaco format; ưu tiên LSP nếu có).
  - `textDocument/codeAction` → `edit.codeAction` (`Ctrl+.`? đụng nextMod — để palette).
  - `textDocument/signatureHelp` → hiện khi gõ `(`.
- **Việc main:** mở rộng JSON-RPC trong lsp.js + IPC `lsp:definition/references/rename/format`.

### D3. Next/Prev Result dùng chung
- `nav.nextResult` `F4`, `nav.prevResult` `Shift+F4` — điều hướng giữa: kết quả Find-in-Files,
  lỗi build (output panel), và references LSP. Một "result list" chung trong `nav.js`.

---

## ĐỢT E — Project, Watcher, Settings nâng cao

### E1. Multi-root + exclude patterns
- `project.addFolder` (`Project: Add Folder`) — sidebar nhiều gốc; sửa `sidebar.js` render nhiều
  root; `store.js` lưu mảng folders.
- `folder_exclude_patterns` / `file_exclude_patterns` (mặc định `.git`, `node_modules`, …) áp cho
  `fs:walk` (main) và `search:inFiles`. Đọc từ settings + `.sublime-project`.

### E2. Disk watcher
- Main: `fs.watch`/`chokidar`-lite trên các root → IPC `fs:changed(path,type)`. Renderer:
  refresh nhánh sidebar; nếu buffer mở bị đổi ngoài app → cảnh báo reload (như ST).

### E3. Settings nâng cao
- `Preferences: Settings – Syntax Specific` (settings theo `buffer.language`, merge lên default).
- `Preferences: Settings – Distraction Free`. `Preferences: Mouse Bindings` (đọc `.sublime-mousemap`).
- `UI: Customize Color Scheme / Theme` (override màu qua JSON, live-apply).

---

## ĐỢT F — Dài hạn (product-scale, mỗi mục là 1 sub-project)

- **F1 `.sublime-build`**: parser + biến `$file $file_path $folder $file_base_name $file_extension`;
  build variants; `File: … Build Results` + F4 navigation (dùng D3).
- **F2 Integrated terminal**: giải node-pty (build electron headers) hoặc thử pty thuần + xterm.js;
  panel resize, mở ở cwd project, `Ctrl+\``. (Môi trường hiện chặn native build → cần xử lý riêng.)
- **F3 Spell check** `F6` (`toggle_setting spell_check`): từ điển + Monaco decorations + gợi ý sửa.
- **F4 Emmet / Close Tag** (`Alt+.`): expand abbreviation, đóng tag tự động.
- **F5 Plugin API**: sandbox JS/WASM đăng ký command + event listener; registry package.
- **F6 Vim mode**: tích hợp `monaco-vim` sau keybinding engine.

---

## 2. Ma trận phím Sublime (tham chiếu nhanh — đã verify từ keymap 4200)

| Lệnh | Phím ST thật | Đợt |
|---|---|---|
| upper/lower case | `ctrl+k ctrl+u` / `ctrl+k ctrl+l` | A (có) |
| sort lines / case-sensitive | `f9` / `ctrl+f9` | A (có) |
| soft_undo / soft_redo | `ctrl+u` / `ctrl+shift+u` | A |
| insert line after / before | `ctrl+enter` / `ctrl+shift+enter` | A |
| fold / unfold | `ctrl+shift+[` / `ctrl+shift+]` | A (có) |
| fold_by_level 1..9 | `ctrl+k ctrl+1..9` | A |
| unfold_all | `ctrl+k ctrl+0` (hoặc `ctrl+k ctrl+j`) | A |
| wrap_lines | `alt+q` | A |
| show completions | `ctrl+space` | A |
| expand to line / brackets / scope | `ctrl+l` / `ctrl+shift+m` / `ctrl+shift+space` | A |
| add cursor up / down | `alt+shift+up` / `alt+shift+down` | A |
| jump to bracket | `ctrl+m` | A |
| paste_from_history | `ctrl+k ctrl+v` | A/B |
| set_mark / select / delete / swap / yank | `ctrl+k ctrl+space` / `ctrl+a` / `ctrl+w` / `ctrl+x` / `ctrl+y` | A/B |
| reopen closed file | `ctrl+shift+t` | B |
| set_layout 1/2/3/4/grid/rows | `alt+shift+1/2/3/4/5/8/9` | C |
| focus_group 1..9 | `ctrl+1..9` | C |
| move_to_group 1..9 | `ctrl+shift+1..9` | C |
| new_pane / close_pane | `ctrl+k ctrl+up` / `ctrl+k ctrl+down` | C |
| select tab by index | `alt+1..8` | C |
| next/prev view | `ctrl+pagedown` / `ctrl+pageup` | C |
| MRU next/prev | `ctrl+tab` / `ctrl+shift+tab` | C |
| next/prev modification | `ctrl+.` / `ctrl+,` | D |
| revert_hunk | `ctrl+k ctrl+shift+z` | D |
| toggle_inline_diff | `ctrl+k ctrl+/` | D |
| goto_definition / reference | `f12` / `shift+f12` | D |
| next/prev result | `f4` / `shift+f4` | D |
| find_under / all_under / expand_skip | `ctrl+f3` / `alt+f3` / `ctrl+k ctrl+d` | D |
| goto word (#) | `ctrl+;` | có |
| spell check toggle | `f6` | F |
| close_tag | `alt+.` | F |

> ⚠️ **Xung đột với binding Lumen hiện tại** cần quyết định khi làm: `ctrl+.`(nextMod) vs codeAction;
> `f2`(bookmark next) vs rename; `f4`(nextResult) vs prevMod của ST (ST prev_modification map lạ ở
> một số layout). Luôn **ưu tiên phím ST chuẩn ở bảng trên**; ghi mọi ngoại lệ vào Architecture.md.

---

## 3. Thứ tự đề xuất & ước lượng

| Đợt | Nội dung | Công sức | Giá trị "giống ST" |
|---|---|---|---|
| A | ~20 lệnh Edit/Selection + 3 helper test | Thấp | Cao (palette đầy) |
| B | Encoding + Revert + Reopen closed/as-X | Trung | Cao (đúng nhu cầu thực) |
| C | Layout grid + tabs nav + toggle chrome | Trung | Cao (cảm giác ST) |
| D | Git hunk + LSP goto/rename/format | Cao | Rất cao (dấu ấn ST4) |
| E | Multi-root + watcher + settings sâu | Cao | Trung |
| F | build/terminal/spell/emmet/plugin/vim | Rất cao | Trung–cao (dài hạn) |

**Bắt đầu: ĐỢT A, task A1.** Sau mỗi task cập nhật ✅ vào
[SUBLIME_GAP_ANALYSIS.md](SUBLIME_GAP_ANALYSIS.md) và commit-style increment.
