# Sublime Text 4 — Toàn bộ tính năng & Prompt cho Claude Code

> Tài liệu này gồm 2 phần:
> **Phần A** — danh sách đầy đủ tính năng Sublime Text 4 (build 4100+/4200), nhóm theo chức năng, có đánh dấu trạng thái so với code hiện tại của `Lumen`.
> **Phần B** — prompt hoàn chỉnh để dán cho Claude Code, yêu cầu xây tiếp trên source Electron + Monaco đang có.

---

## PHẦN A — Danh sách tính năng Sublime Text 4

Chú thích trạng thái trong project hiện tại:
- ✅ Đã có · 🟡 Có một phần · ⬜ Chưa có

### 1. Soạn thảo lõi (Core editing)
- ✅ Multi-cursor / multiple selections (Ctrl+D chọn từ tiếp theo, Ctrl+Click)
- 🟡 Column / block selection (kéo chuột giữa, chọn theo cột)
- ✅ Split selection into lines (Ctrl+Shift+L)
- ✅ Line operations: move/duplicate/delete/join/sort lines, indent/outdent
- ✅ Case transform (upper/lower/title) — Ctrl+K Ctrl+U / Ctrl+K Ctrl+L
- ✅ Bracket matching + auto-close brackets/quotes
- ✅ Toggle comment (line Ctrl+/ & block Ctrl+Shift+/)
- ✅ Code folding (Monaco + Fold All/Unfold All commands)
- ✅ Word wrap
- 🟡 Auto-indent + phát hiện indent của file (Monaco auto-detect; hiển thị ở status bar)
- ✅ Reindent / Convert indentation (to spaces/tabs, detect)
- ✅ Transpose, Join lines, Sort lines (ascending/descending)
- ✅ Bookmarks / Marks (Ctrl+F2 toggle, F2/Shift+F2 next/prev, glyph margin)
- ✅ Macros — record & playback (gõ + chuỗi lệnh; Ctrl+Q record, Ctrl+Shift+Q play)

### 2. Điều hướng & Tìm kiếm
- ✅ Goto Anything (Ctrl+P) — fuzzy file
- ✅ Goto Anything mở rộng: `@symbol`, `#word`, `:line`
- ✅ Command Palette (Ctrl+Shift+P)
- ✅ Find & Replace trong file (Monaco widget: regex/case/word/in-selection) + Find Next/Prev (F3/Shift+F3)
- ✅ **Find in Files** (tìm toàn project, panel kết quả gom theo file, regex/case/word)
- ✅ Incremental find (Ctrl+I)
- 🟡 Goto Definition / Reference — qua LSP (hover/diagnostics đã có; goto-def wiring tiếp)
- ✅ Goto Symbol in file (Ctrl+R)  ·  ✅ in project (Ctrl+Shift+R)
- ✅ Symbol indexing toàn project (walk + regex, cache, invalidate khi save)
- ✅ Jump back/forward (Alt+Left/Right, lịch sử con trỏ)

### 3. Giao diện & Layout
- ✅ Tabs
- 🟡 Multi-select tabs (chọn nhiều tab một lúc — ST4)
- ✅ Split panes / groups (grid, columns, rows)
- ✅ Minimap
- ✅ Themes (color scheme + UI theme)
- ✅ Adaptive theme — "Adaptive (follow system)" tự động sáng/tối theo `prefers-color-scheme`
- ⬜ Hot-reload color scheme / theme khi sửa file cấu hình
- ✅ Distraction-free mode (Shift+F11 ẩn sidebar/tab/status)  ·  F11 fullscreen
- ✅ Indent guides (Monaco) + rulers (Toggle Rulers: 80 / 120)
- 🟡 Highlight tab chưa lưu (dot dirty)  ·  ⬜ highlight dòng đã sửa
- 🟡 GPU rendering (Electron/Chromium đã accelerate — không cần tự viết)
- ⬜ Layout presets (Alt+Shift+1/2/3…), tab groups linh hoạt

### 4. Git & Diff (điểm mới nổi bật của ST4)
- ✅ **Incremental diff ở gutter** — marker thêm (xanh lá) / sửa (xanh dương) / xoá (tam giác đỏ) so với HEAD (LCS line-diff)
- 🟡 Revert: ✅ revert cả file về HEAD  ·  ⬜ revert từng hunk
- ✅ Git status trong sidebar (màu: modified vàng / untracked-added xanh / deleted đỏ / conflict)
- ✅ Badge dirty trên folder chứa thay đổi
- ✅ Hiển thị branch hiện tại ở status bar
- ⬜ (mở rộng) Blame inline, diff view, stage/commit

### 5. Ngôn ngữ & Thông minh
- ✅ Syntax highlighting nhiều ngôn ngữ (Monaco/TextMate)
- 🟡 Auto-completion (Monaco cơ bản; ST4 có fuzzy context-aware)
- ✅ Snippets (JSON, tab-stops/placeholders `$1 ${2:x} $0`, completion provider theo scope)
- 🟡 **LSP client** — typescript-language-server qua stdio (JSON-RPC): ✅ diagnostics, ✅ hover, ✅ completion; ⬜ rename/format/goto
- ✅ TypeScript/JSX/TSX first-class (Monaco + LSP tsserver)
- ⬜ Spell check
- ⬜ Emmet (mở rộng)

### 6. Build & Chạy
- 🟡 Build Systems — auto-detect npm scripts / Makefile / run current file + custom command (Ctrl+Shift+B); ⬜ `.sublime-build` file
- ✅ Build variants qua picker (Ctrl+Shift+B) + re-run (F7)
- ✅ Output panel: stream stdout/stderr, exit code, **click `file:line` nhảy tới dòng**
- ⬜ **Integrated terminal** (node-pty) — cần biên dịch native (node-gyp/electron headers); môi trường hiện chặn install script → tạm dùng Build/Output panel

### 7. Dự án, phiên & Cấu hình
- ✅ Sidebar / project tree, thao tác file/folder
- ⬜ File/folder exclude patterns (`folder_exclude_patterns`)
- ✅ Session / hot-exit (khôi phục folder + tabs + con trỏ)
- ✅ Persistent state layer (settings/session/recent, ghi atomic)
- 🟡 `.sublime-project` — save/open (folders + settings); ⬜ nhiều folder / workspace riêng
- ✅ **Settings GUI + JSON** — 2 pane Default|User, live-apply (font/tab/wrap/theme/minimap…), persist
- ✅ **Keybinding profiles** — user keymap JSON, chord bindings (`ctrl+k, ctrl+u`), dispatcher
- ⬜ Mouse map / menu tuỳ biến
- ✅ Recent files / folders menu (Ctrl+Shift+T)
- ✅ Auto-save (on focus change / after delay) — điều khiển qua settings
- 🟡 Line-ending LF/CRLF convert + hiển thị ở status bar  ·  ⬜ encoding detect/convert

### 8. File lớn & Hiệu năng
- ✅ **Large-file streaming engine** (GB→100GB, sparse index, viewer ảo hoá) — điểm mạnh hiện có, vượt ST ở mảng file cực lớn
- ✅ Đọc screenful ngẫu nhiên p50 ~12ms trên 3.2GB/31.8M dòng

### 9. Mở rộng / Plugin (dài hạn)
- ⬜ Plugin API (đăng ký command, event listener, sandbox JS/WASM)
- ⬜ Package manager kiểu Package Control
- ⬜ Vintage/Vim mode
- ⬜ (rất dài hạn) AI assistant, REST/DB/SSH/Docker/K8s tools

### 10. Tiếng Việt (đặc thù project — ST không có)
- ✅ Nhập tiếng Việt inline qua fcitx (composition vẽ tại caret)

---

## PHẦN B — PROMPT CHO CLAUDE CODE

> Dán nguyên khối dưới đây vào Claude Code trong thư mục project.

---

Bạn đang làm việc trong project **Lumen** tại
`/home/duc-nguyenuu/DATA/PROJECT_ME/SublimeTextPlus` — một code editor kiểu Sublime Text
viết bằng **Electron + Monaco** (Monaco nạp qua AMD loader từ `node_modules`, không bundle).

### Bối cảnh & ràng buộc (đọc kỹ trước khi code)
- **KHÔNG** viết lại native/C++/Rust. Tiếp tục trên chính source Electron hiện tại.
- Kiến trúc: main/renderer tách nghiêm ngặt, `contextIsolation: true`. Renderer KHÔNG
  đụng `fs` trực tiếp — mọi truy cập OS đi qua `preload.js` (`window.lumen`) → IPC.
  Tôn trọng ranh giới này khi thêm tính năng.
- File chính: `main.js` (window/menu/IPC/fcitx), `preload.js` (contextBridge),
  `src/main/{store.js, largefile.js}`, `src/renderer/js/{app,editor,sidebar,palette,commands,largefile,icons}.js`,
  `src/renderer/{index.html, styles.css}`. Đọc `docs/Architecture.md` để hiểu tổng thể.
- **Chạy/verify:** môi trường có `ELECTRON_RUN_AS_NODE=1` → phải chạy
  `env -u ELECTRON_RUN_AS_NODE ./node_modules/electron/dist/electron . --no-sandbox`.
  Tắt bằng `killall -9 electron` (KHÔNG dùng `pkill -f electron`). Chụp màn hình verify
  qua env `LUMEN_SCREENSHOT=/path.png`. `sleep` foreground bị chặn → dùng `read -t N _ < /dev/null`.
- **Chất lượng:** code thật, chạy được, có test (`npm test` dùng `node --test`) và verify bằng
  ảnh chụp. KHÔNG mock, KHÔNG pseudocode, KHÔNG báo "đã xong" khi chưa verify. Mỗi tính năng
  là một increment hoàn chỉnh: đăng ký command + keybinding + UI + persist (nếu cần) + test.
- Sau mỗi phase: cập nhật `docs/Architecture.md`, thêm command vào command palette, và
  bảo đảm không phá session/large-file/fcitx đang chạy.

### Đã có (đừng làm lại)
Core editing, multi-cursor, Command Palette, Goto Anything (fuzzy file), sidebar/project tree,
split panes, tabs, themes, minimap, nhập tiếng Việt fcitx inline, **large-file streaming engine**,
**session/hot-exit**, **persistent store** (`src/main/store.js`).

### Mục tiêu: hiện thực các tính năng còn thiếu của Sublime Text 4, theo phase

**Phase 0 — Keybinding engine + wire toàn bộ Monaco built-ins theo phím Sublime (LÀM TRƯỚC)**

Đây là nền tảng bắt buộc: hiện tại `app.js` chỉ hard-code ~16 phím global và phần còn lại
phụ thuộc phím MẶC ĐỊNH của Monaco (khác Sublime). Rất nhiều binding Sublime là **chord**
(`ctrl+k, ctrl+b`) nên hiện bất khả thi.

0.1 **Keybinding engine** (`src/renderer/js/keymap.js`):
- Đọc keybindings từ JSON (mặc định đóng gói theo `Default (Linux).sublime-keymap` của Sublime
  + file User ghi đè qua `store.js`). Dùng nguyên bộ mặc định `Default (Linux).sublime-keymap`
  của Sublime Text làm nguồn chuẩn cho tên command + phím; PHẦN C bên dưới là bảng đối chiếu
  trạng thái từng nhóm so với code hiện tại.
- Hỗ trợ **chord** (2 phím liên tiếp, có timeout ~1s reset), modifier `ctrl/alt/shift/super`,
  và các phím đặc biệt (`f1..f12`, `keypad_*`, `escape`, `tab`, dấu câu).
- Hỗ trợ **context** tối thiểu: `panel_has_focus`, `overlay_visible`, `auto_complete_visible`,
  `num_selections`, `selection_empty`, `setting.<x>` — để phím đúng ngữ cảnh (vd `escape`,
  `tab`, `enter`).
- Phân giải xung đột theo thứ tự Sublime (context khớp trước; User đè Default).
- Map mỗi binding tới một **command id** trong `LUM.commands`; hiển thị phím trong Command Palette.
- Tự tắt các default-keybinding của Monaco bị trùng để tránh double-fire
  (`editor.addCommand` override hoặc `keybindingService`).

0.2 **Wire toàn bộ lệnh Monaco đã-có-sẵn vào đúng phím Sublime** (đăng ký command + map phím):
- Line ops: `swap_line_up/down` (ctrl+shift+↑/↓), `duplicate_line` (ctrl+shift+d),
  `join_lines` (ctrl+shift+j), `delete_line` (ctrl+shift+k).
- Comment: `toggle_comment` line (ctrl+/) ✅ và **block** (ctrl+shift+/).
- Case: `upper_case`/`lower_case` (ctrl+k ctrl+u / ctrl+k ctrl+l), `transpose` (ctrl+t).
- Selection: `find_under_expand_skip` (ctrl+k ctrl+d), expand to scope/brackets
  (ctrl+shift+space / ctrl+shift+m), `move_to brackets` (ctrl+m), `find_all_under` (alt+f3).
- Fold: `fold`/`unfold` (ctrl+shift+[ / ]), `fold_by_level` (ctrl+k ctrl+1..9),
  `unfold_all` (ctrl+k ctrl+0/j).
- Find: `find_next/prev` (f3/shift+f3), `find_under` (ctrl+f3).
- Tabs/panes: `select_by_index` alt+1..9 (nhảy tab theo số), next/prev tab
  (ctrl+pageup/pagedown, ctrl+tab), `focus_group` ctrl+1..9, `focus_side_bar` ctrl+0,
  layout đủ bộ alt+shift+1..9 (thêm 4 cột, grid 2x2, rows).
- Misc: `soft_undo/redo` (ctrl+u), font size (ctrl++/-), `toggle_overwrite` (insert),
  `wrap_lines` (alt+q).
- Bổ sung lệnh Monaco **không có sẵn**: `sort_lines` (f9, có/không phân biệt hoa thường qua
  ctrl+f9) — tự viết vì Monaco thiếu.

0.3 **Reopen last closed tab** (ctrl+shift+t) + **switch_file** header↔source (alt+o).

**Định nghĩa xong Phase 0**: mọi phím trong bảng coverage (PHẦN C) chuyển từ 🟡→✅ hoặc được
gắn command id sẵn sàng cho các phase sau; còn ⬜ (git/bookmarks/macros/build/terminal/…) để
lại đúng phase tương ứng.

**Phase 1 — Hoàn thiện editor lõi & Find (ưu tiên cao)**
1. Line operations: move/duplicate/delete/join/sort lines, indent/outdent, toggle comment
   (line & block), case transform. Bind phím kiểu Sublime.
2. Find & Replace UI kiểu Sublime trong file: regex, case, whole-word, in-selection,
   find-all, incremental find (Ctrl+I).
3. **Find in Files** toàn project: chạy tìm ở main process (stream, tôn trọng exclude
   patterns), panel kết quả gom theo file, click nhảy tới dòng, replace-all có preview.
4. Goto Symbol trong file (Ctrl+R) và mở rộng Goto Anything: `@symbol`, `#word`, `:line`.

**Phase 2 — Cấu hình & Keybindings (xây trên `store.js`)**
5. Settings: mở dạng 2 pane `Default | User` (JSON), áp dụng live (font, tab size, word wrap,
   theme, auto-save…). Hỗ trợ per-project settings.
6. Keybinding profiles: file JSON người dùng sửa được, hỗ trợ **chord** (`ctrl+k, ctrl+b`),
   giải quyết xung đột, hiển thị phím trong command palette.
7. Auto-save (on-focus-lost / delay), recent files/folders, encoding & line-ending convert.

**Phase 3 — Git & Diff (đặc trưng ST4)**
8. Incremental diff ở gutter: marker thêm/sửa/xoá so với đĩa và so với Git HEAD; revert hunk.
9. Git status trong sidebar (màu theo trạng thái), branch ở status bar, badge số thay đổi.
   Đọc git qua main process (spawn `git`, không phụ thuộc lib nặng).

**Phase 4 — Terminal & Build**
10. Integrated terminal bằng `node-pty` + xterm.js: nhiều phiên, panel resize, mở ở folder project.
11. Build Systems: `.sublime-build` tối giản (biến `$file/$folder`), chạy qua palette,
    output panel bắt lỗi click nhảy tới dòng.

**Phase 5 — Thông minh ngôn ngữ**
12. Snippets (JSON, tab-stops/placeholders, mở rộng theo scope).
13. **LSP client** qua stdio: completion/hover/goto-definition/diagnostics/rename/format;
    khởi động server theo ngôn ngữ (bắt đầu với TS/JS bằng `typescript-language-server`).

**Phase 6 — Hoàn thiện UI/UX**
14. Distraction-free mode, indent guides + rulers, highlight tab chưa lưu, adaptive theme
    (auto sáng/tối theo hệ thống), hot-reload theme.
15. Bookmarks, macros (record/playback), multi-select tabs.

### Cách làm việc mong đợi
- Trước khi bắt đầu Phase, khảo sát file liên quan và trình bày kế hoạch ngắn gọn.
- Làm **tuần tự từng phase**, mỗi mục là một commit/increment có thể verify độc lập.
- Với mỗi mục: (a) code, (b) đăng ký command + keybinding, (c) thêm test khi có logic thuần,
  (d) chạy app + chụp `LUMEN_SCREENSHOT` để verify, (e) báo cáo trung thực kết quả.
- Nếu một tính năng quá lớn (LSP, terminal), chia nhỏ và giao tài liệu/kiến trúc trước.

**Bắt đầu bằng Phase 0** (keybinding engine + wire Monaco built-ins). Hãy khảo sát
`src/renderer/js/{app.js, editor.js, commands.js, palette.js}` và đối chiếu với bảng coverage
ở PHẦN C, rồi đề xuất kế hoạch trước khi viết code. Sau khi Phase 0 xong (mọi 🟡 → ✅) mới
sang Phase 1.

---

## PHẦN C — Bảng đối chiếu coverage với keybinding mặc định Sublime

> Đối chiếu ~200 binding mặc định của Sublime Text (Linux) với code hiện tại.
> **Ước lượng phủ ~35–40% tính năng.** Chú thích: ✅ đủ · 🟡 Monaco có nhưng CHƯA nối đúng
> phím Sublime (xử lý ở **Phase 0**) · ⬜ chưa có (xử lý ở phase tương ứng).
>
> Gốc rễ: `app.js` chỉ hard-code ~16 phím global ([app.js:280-298]), phần còn lại dựa vào phím
> mặc định của Monaco (khác Sublime) → cần **keybinding engine** ở Phase 0.

### 1. File / Window
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| new/open/save/save as/close tab | ctrl+n/o/s/shift+s/w | ✅ | — |
| new_window | ctrl+shift+n | ✅ | — |
| exit, close_window | ctrl+q, ctrl+shift+w | ⬜ | 0 |
| reopen_last_file (mở lại tab đã đóng) | ctrl+shift+t | ⬜ | 0 |
| switch_file (header↔source) | alt+o | ⬜ | 0 |
| toggle_side_bar (chord) | ctrl+k, ctrl+b | 🟡 (chưa hỗ trợ chord) | 0 |
| toggle_full_screen / distraction_free | f11 / shift+f11 | ⬜ | 6 |

### 2. Soạn thảo cơ bản (Monaco lo phần lớn)
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| di chuyển/chọn con trỏ, word, home/end, page | — | ✅ Monaco | — |
| undo/redo, cut/copy/paste, select all | — | ✅ | — |
| delete word ctrl+bs/del | — | ✅ | — |
| indent/unindent ctrl+]/[ , tab | — | ✅ | — |
| delete_line ctrl+shift+k | — | ✅ (trùng Monaco) | — |
| expand to line ctrl+l, find_under_expand ctrl+d | — | ✅ | — |
| soft_undo/redo | ctrl+u | ⬜ | 0 |
| paste_and_indent | ctrl+shift+v | 🟡 | 0 |
| paste_from_history (clipboard history) | ctrl+k, ctrl+v | ⬜ | 1 |
| toggle_overwrite | insert | ⬜ | 0 |
| subword move | alt+←/→ | 🟡 | 0 |

### 3. Line operations (Monaco có, chưa nối phím ST)
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| swap_line_up/down | ctrl+shift+↑/↓ | 🟡 (Monaco Alt+↑/↓) | 0 |
| duplicate_line | ctrl+shift+d | 🟡 | 0 |
| join_lines | ctrl+shift+j | 🟡 | 0 |
| toggle_comment block | ctrl+shift+/ | 🟡 (line ✅) | 0 |
| upper/lower case | ctrl+k ctrl+u/l | 🟡 (chord) | 0 |
| transpose | ctrl+t | 🟡 | 0 |
| sort_lines | f9 / ctrl+f9 | ⬜ (Monaco thiếu, tự viết) | 0 |
| wrap_lines | alt+q | ⬜ | 0 |

### 4. Điều hướng & Tìm kiếm
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| Goto file/command/line/symbol | ctrl+p/shift+p/g/r | ✅ | — |
| goto word trong file (#) | ctrl+; | ⬜ | 1 |
| goto_definition / goto_reference | f12 / shift+f12 | ⬜ (cần LSP) | 5 |
| goto_symbol_in_project | ctrl+shift+r | ⬜ | 1 |
| jump_back / forward | alt+- | 🟡 | 0 |
| find / replace | ctrl+f / ctrl+h | ✅ (widget Monaco) | — |
| incremental_find | ctrl+i | ⬜ | 1 |
| find_next/prev, find_all_under | f3 / alt+f3 | 🟡 | 0 |
| find_in_files | ctrl+shift+f | ✅ | — |
| next_result / prev_result | f4 / shift+f4 | ⬜ | 1 |

### 5. Hệ thống con HOÀN TOÀN CHƯA CÓ
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| Git diff gutter: next/prev_modification, revert_hunk, toggle_inline_diff | ctrl+./, · ctrl+k ctrl+z | ⬜ | 3 |
| Bookmarks | f2, ctrl+f2 | ⬜ | 6 |
| Marks (Emacs-style) | ctrl+k ctrl+space/a/w/x/y | ⬜ | 6 |
| Macros record/playback | ctrl+alt+q | ⬜ | 6 |
| Build system | f7, ctrl+b, ctrl+shift+b | ⬜ | 4 |
| Console/terminal | ctrl+` | ⬜ | 4 |
| Snippets + expand, close_tag | tab · alt+. · "/" | ⬜ | 5 |
| Spell check | f6 | ⬜ | 5 |
| Font size | ctrl++/- | ⬜ | 0 |

### 6. Panes / Tabs / Layout
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| Layout columns 1–3 | alt+shift+1/2/3 | ✅ | — |
| Layout 4 cột, grid 2x2, rows | alt+shift+4/5/8/9 | ⬜ | 0 |
| focus_group / move_to_group | ctrl+1..9 / ctrl+shift+1..9 | ⬜ | 0 |
| focus_side_bar | ctrl+0 | ⬜ | 0 |
| new_pane / close_pane (chord) | ctrl+k ctrl+↑/↓ | ⬜ | 0 |
| switch tab theo số (select_by_index) | alt+1..9 | ⬜ | 0 |
| next/prev tab | ctrl+pgup/pgdn, ctrl+tab | ⬜ | 0 |
| multi-select tabs | ctrl+j … | ⬜ | 6 |

### 7. Code folding
| Tính năng | Phím ST | Trạng thái | Phase |
|---|---|---|---|
| fold / unfold | ctrl+shift+[ / ] | ✅ (trùng Monaco) | — |
| fold_by_level, unfold_all | ctrl+k ctrl+1..9 / ctrl+k ctrl+0 | 🟡 (bật chord) | 0 |

> **Giống Sublime trên mặt HÌNH ẢNH:** xem `docs/SUBLIME_UI_FIDELITY.md` — pixel spec đổi theme sang
> **Mariana + Adaptive** (nền navy `#303841`, tab liền nền, sidebar không icon, quick panel xám, caret
> cam) để chrome trông giống hệt ST4 build 4200.
>
> **Tiếp theo Phase 0–6:** xem `docs/POLISH_PHASES.md` — Phase 7–12 đi sâu vào **tiểu tiết** của
> tabs (kéo-thả, context menu, pin, preview, multi-select, overflow), sidebar (thao tác file inline,
> kéo-thả, multi-root, watcher), editor (indent guides, whitespace, encoding, sticky scroll), status
> bar/palette, find, và dialog/window — để chạm mức chỉn chu Sublime/VSCode.

### Ba khoảng trống lớn nhất khiến "chưa đủ"
1. **Chưa có keybinding engine thật** — không đọc JSON, không chord, không context. Nhiều binding
   ST là chord nên hiện bất khả thi → **Phase 0**.
2. **Line-ops / case / transpose / sort / duplicate / join / block-comment** — Monaco có sẵn
   nhưng chưa map phím ST → **Phase 0**.
3. **Subsystem lớn vắng mặt**: Git diff, bookmarks, marks, macros, build, terminal, snippets,
   goto-definition, spell check → các Phase 3–6.

---
