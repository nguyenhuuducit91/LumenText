# Lumen — Phase 7–12: Đánh bóng tiểu tiết (Polish & Detail)

> Tài liệu này nối tiếp `SUBLIME_FEATURES_AND_PROMPT.md` (Phase 0–6, các tính năng
> "khung xương" đã dựng: keybinding engine, find/replace, find-in-files, settings,
> git gutter/sidebar, bookmarks, snippets…). Các phase dưới đây **không thêm subsystem
> mới lớn** mà đi sâu vào **từng chi tiết nhỏ** của những phần đã có — tabs, sidebar,
> editor gutter, status bar, dialog — để phần mềm chạm mức "chỉn chu như Sublime/VSCode".
>
> **Về độ giống Sublime trên MẶT HÌNH ẢNH** (màu, dáng tab, sidebar, quick panel, font, caret cam…):
> xem tài liệu chuyên biệt `docs/SUBLIME_UI_FIDELITY.md` — pixel spec đổi theme sang **Mariana +
> Adaptive** cho đúng "look" ST4. Nên áp UI Fidelity **trước hoặc song song** Phase 7–12.
>
> Mỗi mục là một increment verify được độc lập. Triết lý giữ nguyên:
> **code thật → đăng ký command + keybinding → UI → persist (nếu cần) → test → verify ảnh chụp.**
> Không mock, không pseudocode, không báo "xong" khi chưa chụp ảnh kiểm chứng.

---

## Ràng buộc kỹ thuật (nhắc lại — đọc trước khi code)

- Giữ ranh giới main/renderer, `contextIsolation: true`. Mọi thao tác OS mới (trash, rename,
  reveal, watch) phải thêm handler ở `main.js` + expose qua `preload.js` (`window.lumen`), **không**
  đụng `fs` trong renderer.
- Chạy: `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron . --no-sandbox`.
  Tắt: `killall -9 electron`. Ảnh verify: `LUMEN_SCREENSHOT=/path.png`. `sleep` foreground bị chặn →
  `read -t N _ < /dev/null`.
- Không phá: large-file streaming, session/hot-exit, fcitx inline IME.
- Sau mỗi phase: cập nhật `docs/Architecture.md`, thêm command vào palette, thêm `npm test` cho
  logic thuần (fuzzy, path ops, diff, reducer…).

## Nợ kỹ thuật cần dọn trước (bug đã lộ trong code hiện tại)

Sửa các lỗi này **trước** khi thêm tính năng của Phase 7 — chúng nằm ngay trong đường đi sắp mở rộng:

1. **`editor.js` `closeBuffer()` có nhánh chết** ([editor.js:247-257](../src/renderer/js/editor.js#L247-L257)):
   vòng lặp `panes.forEach` tính `nextId` rồi có comment `// temporarily remove then show neighbor`
   nhưng **không làm gì** — buffer kế tiếp được chọn lại ở khối `panes.forEach` thứ hai bằng
   `order[Math.min(pos, len-1)]`, dễ nhảy sai tab (không phải tab liền kề đang xem). Viết lại thành
   một hàm chọn-neighbor rõ ràng, có test: đóng tab giữa → active nhảy sang tab bên phải, đóng tab
   cuối → nhảy sang trái, đóng tab đang không active → active không đổi.
2. **`confirm()` chặn UI thread** ([editor.js:243](../src/renderer/js/editor.js#L243)) — thay bằng
   modal bất đồng bộ của Phase 12 (dialog "Save / Don't Save / Cancel" 3 nút), không dùng
   `window.confirm/alert/prompt` ở bất kỳ đâu.
3. **`renderTabs()` xoá sạch rồi dựng lại toàn bộ DOM mỗi lần** ([editor.js:281-307](../src/renderer/js/editor.js#L281-L307))
   — chấp nhận được bây giờ, nhưng drag-reorder (7.1) cần node ổn định; chuyển sang cập nhật theo
   `id` (reconcile) hoặc ít nhất giữ node đang kéo.

---

## PHASE 7 — Tabs hoàn chỉnh (thanh tab như Sublime/VSCode)

Hiện tại tab chỉ có: icon + tên + nút ✕, click để chọn, middle-click để đóng. Thiếu gần như toàn bộ
tương tác "tiểu tiết". Làm tuần tự 7.1 → 7.9.

### 7.1 Kéo–thả sắp xếp lại tab (drag reorder)
- `draggable=true` cho `.tab`. Trong `dragstart` lưu `id` đang kéo; `dragover` tính vị trí chèn theo
  midpoint của tab dưới con trỏ (trái/phải), vẽ **đường chỉ báo chèn** (thanh dọc 2px accent).
- `drop` → cập nhật mảng `order` (splice), `renderTabs()`, lưu session. Kéo ra ngoài rồi thả lại chỗ
  cũ = no-op. Auto-scroll thanh tab khi kéo tới mép (7.5).
- Test thuần: hàm `reorder(order, fromId, toIndex)` — trước/sau, đầu/cuối, kéo lên chính nó.

### 7.2 Kéo tab sang pane khác (di chuyển giữa nhóm split)
- Thả tab vào vùng một `.pane` khác → `showBuffer(id, targetPaneIdx)`, gỡ khỏi pane nguồn nếu pane
  nguồn không còn tab nào hiển thị thì chọn neighbor. Giữ `Ctrl` khi thả = **copy view** (mở cùng
  buffer ở cả hai pane, mỗi pane giữ viewState riêng — đã có `pane.viewState` per-pane).
- Vẽ overlay mờ trên pane đích khi dragover để báo "thả vào đây".

### 7.3 Context menu chuột phải trên tab
Menu (component menu tái dùng ở Phase 8 & 12 — viết một `LUM.menu` dùng chung, **không** dùng menu
native của OS để đồng bộ theme):
- Close · Close Others · Close Tabs to the Right · Close All · Close Saved (chỉ tab không dirty).
- Pin / Unpin Tab (7.6).
- Copy Path · Copy Relative Path · Reveal in Sidebar (cuộn tree tới file + highlight) · Reveal in
  File Manager (main process `shell.showItemInFolder`).
- Split: Move to New Group (Right/Down) — dựng split rồi chuyển tab qua.
- Mỗi mục ánh xạ tới một command id (`tab_close_others`, `tab_close_right`, `tab_copy_path`…) để cũng
  gọi được từ Command Palette.

### 7.4 Preview tab (single-click mở tạm, italic)
- Sublime/VSCode: click 1 lần ở sidebar mở tab **preview** (tên in nghiêng, tái sử dụng cùng một ô
  tab); double-click hoặc bắt đầu gõ = "ghim" thành tab thường. Thêm cờ `buf.preview`.
- Mở file thứ hai bằng single-click thay thế tab preview hiện tại thay vì mở thêm tab.
- Persist: tab preview **không** lưu vào session (hoặc lưu kèm cờ để khôi phục đúng trạng thái).

### 7.5 Tràn tab & cuộn (overflow)
- Khi tổng bề rộng tab > thanh: cho `#tabbar` cuộn ngang bằng `wheel` (dọc→ngang), **không** hiện
  scrollbar hệ thống. Tab đang active luôn tự cuộn vào tầm nhìn (`scrollIntoView` khi `showBuffer`).
- Nút **▾ dropdown** (đã có ở [app.js:379](../src/renderer/js/app.js#L379)) liệt kê mọi tab, đánh dấu
  tab tràn khỏi màn hình; chọn = nhảy tới. Thêm chấm "dirty" trong dropdown.
- Tuỳ chọn settings `tabs.wrap` (xuống nhiều hàng) như VSCode — mặc định tắt.

### 7.6 Pin tab
- Tab pinned: gom về **đầu thanh**, thu nhỏ (chỉ icon, ẩn tên & nút ✕), không bị "Close Others/Right"
  đụng tới, không bị preview thay thế. Lưu `buf.pinned` vào session.

### 7.7 Multi-select tab (ST4)
- `Ctrl+click` thêm/bớt tab vào tập chọn; `Shift+click` chọn dải. Tập chọn tô nền nhạt.
- Thao tác hàng loạt: đóng nhiều tab, kéo cả cụm, "Close" áp cho toàn bộ tập chọn.
- `Esc` hoặc click tab đơn xoá tập chọn.

### 7.8 Chỉ báo trạng thái trên tab (tiểu tiết hình ảnh)
- **Dirty**: hiện tại đổi class `dirty`. Chuẩn hoá: khi chưa hover hiện **chấm tròn ●** thay cho ✕;
  hover vào tab mới đổi chấm thành ✕. (CSS thuần, không JS mỗi frame.)
- Màu chữ tab theo **git status** (tái dùng màu sidebar Phase 3): modified = vàng, untracked/added =
  xanh, deleted không áp (tab đã đóng). Tô nhạt tên tab của file **read-only** hoặc đã bị xoá trên đĩa.
- Tooltip tab: đường dẫn đầy đủ + trạng thái ("Modified", "Read-only", "Deleted on disk").
- **Xử lý trùng tên**: hai file cùng tên khác thư mục → thêm hậu tố phân biệt đường dẫn ngắn nhất
  (`app.js` / `web/app.js`) như VSCode. Viết hàm thuần `disambiguateLabels(paths[])` + test.

### 7.9 Đóng tab an toàn & khôi phục
- `Ctrl+Shift+T` mở lại tab vừa đóng (đã nêu Phase 0 — kiểm tra hoạt động, có **stack** nhiều bậc,
  khôi phục cả vị trí trong `order` và con trỏ).
- Đóng tab dirty → dialog 3 nút của Phase 12 (không `confirm`). "Save" lưu rồi đóng; file chưa có path
  → mở Save As.
- Đóng tab preview không hỏi. Đóng cửa sổ khi còn nhiều tab dirty → dialog liệt kê **danh sách file
  chưa lưu**, Save All / Discard All / Cancel.

---

## PHASE 8 — Sidebar / cây dự án hoàn chỉnh

Hiện `sidebar.js` chỉ: mở folder, lazy-expand, click file để mở, git decorate. Thiếu toàn bộ thao tác
file, bàn phím, kéo-thả, multi-root. Đây là phần "đi sâu tiểu tiết" lớn nhất.

### 8.1 Context menu chuột phải (thao tác file/folder)
Dùng `LUM.menu` chung (7.3). Menu theo ngữ cảnh (file vs folder vs vùng trống):
- **New File** · **New Folder** (tạo inline, xem 8.2).
- **Rename** (inline, 8.2) · **Delete** (đưa vào **Trash** qua `shell.trashItem`, không xoá vĩnh viễn;
  Shift = xoá hẳn có xác nhận) · **Duplicate**.
- **Cut / Copy / Paste** (8.4) · **Copy Path** · **Copy Relative Path**.
- **Reveal in File Manager** (`shell.showItemInFolder`) · **Open in Terminal** (khi Phase 4 terminal có).
- **Find in Folder…** (mở find-in-files giới hạn ở thư mục này).
- **Add Folder to Project** / **Remove Folder from Project** (8.7 multi-root).
- Tất cả qua command id để gọi từ palette; thao tác OS mới đi qua main process handler.

### 8.2 Tạo / đổi tên inline (không dùng prompt())
- New File/Folder/Rename → chèn **ô input inline** ngay tại vị trí trong tree, tự chọn phần tên
  (không gồm đuôi mở rộng khi rename file). `Enter` xác nhận, `Esc` huỷ.
- Validate: tên rỗng, ký tự cấm, trùng tên (hiện lỗi đỏ dưới ô, chưa commit). Đổi tên file đang mở →
  cập nhật `buf.path`, `buf.name`, tiêu đề tab, session; ngôn ngữ Monaco set lại theo đuôi mới.
- Tạo file mới → mở luôn trong tab. Tạo folder → giữ trạng thái expand.

### 8.3 Điều hướng bằng bàn phím trong tree
- Focus được vào tree (`focus_side_bar` `ctrl+0` từ Phase 0). Mũi tên ↑/↓ di chuyển hàng, →/← mở/đóng
  hoặc nhảy vào/ra folder, `Enter` mở file, `Space` preview, phím chữ = type-ahead nhảy tới tên khớp.
- Hàng đang focus có outline; đồng bộ với "active file" nhưng tách biệt (focus ≠ selection).
- `Delete` = xoá (vào trash), `F2` = rename, `Ctrl+C/X/V` = copy/cut/paste.

### 8.4 Kéo–thả & cắt/dán để di chuyển file
- Kéo file/folder trong tree sang folder khác = **move** (main process `fs.rename`, fallback copy+unlink
  khác ổ đĩa). Giữ `Ctrl` = copy. Vẽ đường/nền chỉ báo folder đích, chặn thả folder vào chính con nó.
- Kéo file **từ ngoài OS** thả vào tree/editor = copy vào project (dùng `webUtils.getPathForFile`).
- Cut/Paste tương đương move; Copy/Paste tạo bản sao (`copy 2` khi trùng tên).
- Sau mọi thao tác: cập nhật `cache`, git decorate, file-index của palette, và các **tab đang mở** trỏ
  tới path cũ (đổi path hoặc đánh dấu "deleted on disk").

### 8.5 Multi-select trong tree
- `Ctrl/Shift+click` chọn nhiều mục; thao tác Delete/Cut/Copy/Drag áp cho cả tập. Menu chuột phải hiện
  đúng ngữ cảnh "N mục đã chọn".

### 8.6 Ô lọc / tìm nhanh trong sidebar
- Ô "filter" trên đỉnh tree: gõ để **lọc** hiển thị (khớp fuzzy, tự expand nhánh chứa kết quả, tô đậm
  ký tự khớp). `Esc` xoá lọc. Tuỳ chọn "chỉ hiện file đang mở" và "follow active file" (auto-reveal
  file đang sửa, auto-scroll — như VSCode "Reveal Active File").

### 8.7 Multi-root & `.sublime-project`
- Cho phép **nhiều thư mục gốc** trong một cửa sổ (mỗi root là một nhóm collapsible ở đỉnh, có tên).
  `root` biến từ một chuỗi thành mảng roots; cập nhật session, palette file-index (gộp mọi root),
  find-in-files (quét mọi root), git (mỗi root có repo riêng).
- Đọc/ghi `.sublime-project` tối giản: `{ folders: [{path, folder_exclude_patterns, name}] }`.
  "Save Project As", "Open Project", "Recent Projects".

### 8.8 Exclude patterns & file ẩn
- Tôn trọng `folder_exclude_patterns` / `file_exclude_patterns` (mặc định `node_modules`, `.git`,
  `dist`…) trong render tree, find-in-files, và file-index palette. Toggle "Show hidden files"
  (dotfiles) trong menu. Áp dụng cùng bộ lọc ở mọi nơi (một hàm `isExcluded(path)` dùng chung + test).

### 8.9 Đồng bộ sống với đĩa (file watcher)
- `fs.watch`/`chokidar-lite` ở main process theo dõi các folder đang expand → tạo/xoá/đổi tên bên
  ngoài phản ánh vào tree (debounce), cập nhật git + tab (file đang mở bị xoá/đổi ngoài → cảnh báo
  trên tab, hỏi reload nếu đổi nội dung). Chỉ watch nhánh đang mở để nhẹ.

### 8.10 Tiểu tiết hình ảnh sidebar
- Indent guide dọc theo depth; twisty (▸/▾) căn giữa, animate xoay; icon folder mở/đóng khác nhau
  (đã có). Hover row nền nhạt; hàng active viền trái accent. Cuộn ngang khi tên dài + tooltip full path.
- Header sidebar: nút **Collapse All**, **New File**, **New Folder**, **Refresh** hiện khi hover.
- Trạng thái rỗng ("chưa mở folder") có nút "Open Folder".

---

## PHASE 9 — Editor: tiểu tiết vùng soạn thảo & gutter

### 9.1 Indent guides & rulers
- Bật indent guides (Monaco `guides.indentation`, `guides.highlightActiveIndentation`). Rulers cột giới
  hạn từ settings (`rulers: [80, 120]`) → Monaco `rulers`. Toggle qua command.

### 9.2 Reindent / Convert Indentation (Phase 1 còn ⬜)
- `reindent` (tính lại thụt lề theo ngôn ngữ), `convert_tabs_to_spaces` / `spaces_to_tabs`, "Set indent
  width" từ status bar (click `status-indent` → quick panel 2/4/8/tab). Phát hiện indent hỗn hợp → gợi ý.

### 9.3 Whitespace & ký tự vô hình
- Toggle `render_whitespace` (none/boundary/selection/all). **Highlight trailing whitespace** (đỏ nhạt)
  + command "Trim Trailing Whitespace" + tuỳ chọn `trim_trailing_white_space_on_save`.
  "Ensure newline at EOF on save".

### 9.4 Sticky scroll & breadcrumbs
- Bật Monaco sticky scroll (header scope dính trên cùng). Breadcrumb đường dẫn symbol trên đầu editor
  (dùng document symbols đã có cho Goto Symbol), click để nhảy.

### 9.5 Column/block selection & multi-cursor tiểu tiết
- Kiện toàn kéo giữ chuột giữa = column selection (Phase A ghi 🟡). Middle-drag, `Ctrl+Alt+↑/↓` thêm
  cursor trên/dưới, `Ctrl+Alt+←/→`. "Add cursor to line ends" cho block đã chọn.

### 9.6 Encoding & line ending (Phase 2 còn 🟡/⬜)
- **Encoding detect** khi mở (BOM, UTF-8/16, latin1) + "Reopen with Encoding" + "Save with Encoding"
  (`iconv-lite` ở main process). Status `status-enc` bấm được. Convert LF↔CRLF đã có — thêm phát hiện
  EOL hỗn hợp và cảnh báo.

### 9.7 Zoom & khả năng đọc
- Font zoom `Ctrl +/-/0` áp **toàn app** (editor + UI) hoặc chỉ editor (settings). Lưu mức zoom.
  "Toggle High Contrast", cỡ chữ minimap, `renderLineHighlight` gutter+line.

### 9.8 Read-only & file lớn
- Buffer read-only (file không quyền ghi hoặc large-file viewer) khoá chỉnh sửa, tab hiện khoá 🔒,
  status bar "Read-Only", chặn lệnh sửa. "Toggle Read-Only".

### 9.9 Word/selection count & goto
- Status bar hiện số dòng/từ/ký tự khi có selection. Đã có `(N sel)` — bổ sung "X chars selected".
  `Ctrl+G` goto line còn nhận `line:col` và số âm (từ cuối file).

---

## PHASE 10 — Status bar, Command Palette, Quick Panel (đánh bóng)

### 10.1 Status bar tương tác
- Mọi mục thành **nút bấm**: `status-lang` → quick panel chọn ngôn ngữ (set cho buffer); `status-indent`
  → menu indent (9.2); `status-eol` → LF/CRLF (đã có); `status-enc` → encoding (9.6); vị trí con trỏ →
  Goto Line. Thêm: git branch (đã có) bấm để đổi branch; chỉ báo Find-in-Files đang chạy; số lỗi/cảnh
  báo (khi có LSP — Phase 5).

### 10.2 Command Palette tiểu tiết
- Hiển thị **keybinding** bên phải mỗi lệnh (đã nêu Phase 0 — kiểm chứng). Nhóm/most-recently-used lên
  đầu. Fuzzy khớp có tô đậm ký tự; `Enter` chạy, ↑/↓ điều hướng, giữ query khi mở lại (tuỳ chọn).
  Lệnh có tham số (Set Indent, Change Language…) chuyển sang **input mode** trong cùng palette.

### 10.3 Goto Anything tiểu tiết
- `Ctrl+P` fuzzy file: xếp hạng theo recent + số lần mở + khớp liên tục; hiện đường dẫn phụ, icon, và
  **preview** nội dung khi di chuyển (mở tab preview tạm, `Esc` không chọn = quay lại). `@`/`#`/`:` kết
  hợp (`file@symbol`, `:line:col`). Hàng "không kết quả" gợi ý tạo file.

### 10.4 Thông báo (toast) & progress
- `LUM.app.toast` hiện chỉ text. Nâng: nhiều mức (info/warn/error), nút hành động (Undo, Reload),
  auto-dismiss có thanh thời gian, xếp chồng góc dưới-phải, và **progress toast** cho tác vụ dài
  (indexing large-file, find-in-files, git) — không chặn UI.

---

## PHASE 11 — Find / Replace & Find in Files (đánh bóng)

### 11.1 Find trong file
- Kiểm chứng đủ: regex/case/word/in-selection, `Ctrl+I` incremental (Phase 1), `F3/Shift+F3`,
  `Alt+F3` find-all. Thêm: đếm "n of m", giữ history tìm kiếm (↑/↓ trong ô), "Preserve Case" khi replace,
  bôi vàng mọi kết quả trong minimap + gutter.

### 11.2 Find in Files
- Panel kết quả (đã có) bổ sung: **replace-all có preview + undo**, collapse theo file, hiện +/- context
  lines, đếm tổng, click nhảy đúng cột, `F4/Shift+F4` next/prev result (Phase 1 ⬜), lọc include/exclude
  glob, tôn trọng exclude patterns (8.8), huỷ giữa chừng, tiến trình qua progress toast (10.4).

### 11.3 Clipboard history (Phase 2 `ctrl+k ctrl+v`)
- Vòng đệm N mục copy gần nhất; quick panel dán từ history; persist trong phiên.

---

## PHASE 12 — Cửa sổ, dialog, session & hoàn thiện chung

### 12.1 Hệ thống dialog/modal thống nhất (thay `confirm/alert/prompt`)
- Một `LUM.dialog` bất đồng bộ theo theme: `confirm({message, buttons:[…], default, cancel})` trả về
  promise. Dùng cho: đóng tab dirty (3 nút), xoá file, ghi đè khi Save As, "file đã đổi trên đĩa —
  reload?". Bàn phím đầy đủ (Tab, Enter=default, Esc=cancel), focus trap, overlay mờ.

### 12.2 Phát hiện thay đổi ngoài & xung đột lưu
- So `mtimeMs` khi focus lại cửa sổ / trước khi lưu. File đổi ngoài + buffer sạch = tự reload (giữ con
  trỏ); + buffer dirty = dialog "Keep mine / Reload theirs / Diff". Đã có `buf.mtimeMs` — nối vào watcher 8.9.

### 12.3 Distraction-free / Zen & fullscreen (Phase 6)
- `F11` fullscreen, `Shift+F11` distraction-free (ẩn sidebar/tab/status, canh giữa, wrap). Nhớ layout
  trước đó để phục hồi. Toggle từng phần: `toggle_side_bar`, `toggle_status_bar`, `toggle_tabs`,
  `toggle_menu`, toggle minimap.

### 12.4 Theme tiểu tiết (Phase 6)
- Adaptive auto sáng/tối theo `nativeTheme.shouldUseDarkColors` + lắng nghe đổi. Hot-reload color scheme
  khi lưu file theme. Đồng bộ màu **UI chrome** (sidebar/tab/status) với color scheme Monaco (hiện tách
  rời) để không lệch tông.

### 12.5 Window & session hoàn thiện
- Multi-window (mỗi window một project/workspace, session riêng theo window id). "New Window", "Close
  Window" (`ctrl+shift+n` / `ctrl+shift+w` — Phase 0 ⬜). Khôi phục vị trí/kích thước/maximize cửa sổ.
  Khôi phục cả **layout split** + tab per-pane + pinned + preview + scroll (mở rộng session hiện tại,
  giữ tương thích ngược khi đọc state cũ).

### 12.6 Menu ứng dụng & mouse map
- Rà `main.js` menu khớp với command id + phím thật (một nguồn sự thật). Menu chuột phải trong editor
  (Cut/Copy/Paste/Command Palette/Go to Definition…) dùng `LUM.menu` chung. Tuỳ biến mouse map cơ bản.

### 12.7 Khả năng tiếp cận & i18n
- Focus ring nhìn rõ, `aria-*` cho tree/tab/dialog, điều hướng bàn phím thoát-được mọi widget, tôn
  trọng `prefers-reduced-motion` (tắt smooth caret/scroll). Chuẩn bị khung i18n (chuỗi UI gom một chỗ),
  giữ tiếng Việt fcitx hoạt động ở mọi ô input mới (tree filter, rename, dialog).

---

## Thứ tự đề xuất & tiêu chí "xong"

1. **Dọn nợ kỹ thuật** (closeBuffer, bỏ `confirm`, chuẩn bị reconcile tabs) → nền cho 7 & 12.1.
2. **Phase 12.1 (dialog) + 7.3/8.1 (`LUM.menu` chung)** làm sớm vì nhiều phase phụ thuộc.
3. Rồi **Phase 7 (tabs)** → **Phase 8 (sidebar)** → **Phase 9 (editor)** → **10 → 11 → 12** còn lại.

**Xong một mục** = command + keybinding đăng ký, UI hoạt động thật, `npm test` phủ logic thuần
(reorder/disambiguate/isExcluded/neighbor-select/encoding-detect…), và **một ảnh `LUMEN_SCREENSHOT`**
chứng minh tương tác. Cập nhật `docs/Architecture.md` + bảng coverage trong `SUBLIME_FEATURES_AND_PROMPT.md`
(🟡/⬜ → ✅) sau mỗi phase. Báo cáo trung thực phần nào chỉ mới nối phần khung, phần nào đã đầy đủ.
