# REVIEW — Lumen ↔ Sublime Text 4

> **Ngày review:** 2026-07-19
> **Người review:** Senior Software Architect / Editor Engineer / UX Engineer
> **Đối tượng:** toàn bộ project `Lumen` (Electron + Monaco) so với **Sublime Text 4 (build 4200)**
> **Phạm vi:** hành vi, UX, keyboard, rendering, performance, kiến trúc, bug, feature gap, roadmap.
> **Mục tiêu định hướng:** giống hành vi Sublime > code đẹp. Không refactor. Chỉ review.

---

## ✅ CẬP NHẬT (2026-07-19) — Đã sửa trong đợt STABILIZE + FEATURE-CORE

> Sau bản review này, một đợt vá + thêm tính năng đã được thực hiện. Trạng thái các mục:

**Bug đã vá (mục 7):**
`B1` Goto Line crash (guard `label || ''`) · `B2` Find-in-Files kẹt (try/finally) ·
`B3` path-traversal `config:*` (sanitize basename) · `B6` git diff race (kiểm `pane.currentId`/model sau await) ·
`B7` sidebar re-entrant (render generation token) · `B8` inline commit 2 lần (cờ `committing`) ·
`B9` Ctrl+Q macro (đổi sang Ctrl+Alt+Q) · `B10` suffix `@`/`:`/`#` khi Enter (lưu `curSuffix`) ·
`B11` palette open race (openSeq token) · `B12` find stale scope (reset khi close) ·
`B13`/`B14` keymap chord leak + guard input chrome · `B16` LSP didClose + flush + version ·
`B17` symbols multi-root + huỷ build cũ · `B18` remove-folder không lưu (gọi onFoldersChanged) ·
`B19` EOL marker pane mới (WeakSet per-editor) · `B24` lọc dotfile chết ·
`B25` bookmarks map leak (dispose khi đóng tab) · `B28` fuzzy không search `sub` (đã search) ·
`B30` EOL CR label (giữ giới hạn Monaco) · `B31` LSP rootUri URL-encode · bookmarks drift sau edit (đọc từ decoration) ·
build rerun orphan process (kill trước) · build ANSI escape (strip) · snippet completion literal (`insertTextRules`).

**Feature mới:** Goto Definition LSP cross-file (F12) · Git hunk nav (Ctrl+. / Ctrl+Shift+.) + **Revert Hunk** ·
Find Under (Ctrl+F3/Ctrl+Shift+F3) · Next/Prev Result (F4/Shift+F4) · Tab nav (Alt+1–9, Ctrl+PageUp/Down, Ctrl+Tab MRU) ·
Goto Word (Ctrl+;) · Ctrl+Alt+S = Save All (bỏ shadow) · Ctrl+Shift+R chặn hard-reload ·
theme persist + `settings.apply` không revert toggle · **light theme chrome** (sidebar/tab/status) ·
replace hiểu `\n \t \1 $1` · fuzzy camelCase + basename-weight · Goto Anything `:line:col` + `@`/`#` current-file.

**Test thuần mới:** `test/linediff.test.js` (11), `test/replace.test.js` (6), `test/fuzzy.test.js` (7) — tổng **80 test pass**.
Logic thuần tách vào `src/shared/{linediff,replace,fuzzy}.js`.

**Còn lại (chưa làm — ưu tiên kế tiếp):** encoding đầy đủ · LCS diff → worker (B5) · disk watcher ·
layout grid đa pane · replace-all Find-in-Files · terminal · `.sublime-build` · fs:read cap (B4) · webSecurity (B23).

---

## 0. TL;DR — Tóm tắt điều hành

**Lumen KHÔNG phải editor viết từ đầu.** Nó là một lớp UX/feature Sublime-style **xây trên Monaco (engine của VS Code)**. Điều này quyết định toàn bộ bản chất của "parity":

- **Những gì Monaco lo** (caret, selection, multi-cursor, undo, syntax highlight, folding, minimap, smooth scroll, IME) → parity cao **tự động**, nhưng lệch Sublime ở những chi tiết Monaco làm theo phong cách VS Code (modifier column-select, expand-to-scope, minimap slider, auto-complete behavior).
- **Những gì Lumen tự viết** (command palette, find bar, find-in-files, large-file engine, sidebar, git gutter, session, tabs, keymap dispatcher, LSP client) → nơi có **giá trị thật** và cũng là nơi **bug tập trung**.

**Điểm mạnh vượt Sublime:** large-file streaming (GB→100GB), gõ tiếng Việt inline (fcitx5), nền GPU/HiDPI.

**Điểm số tổng thể (feature+UX parity, có trọng số):** **≈ 84–86%**.

**3 việc chặn "hoàn hảo":**
1. **Một chùm bug hành vi thật** (mục 7) — trong đó **1 crash** (Goto Line + phím mũi tên), **1 tính năng chết vĩnh viễn** (Find-in-Files sau lần lỗi đầu), và **các race** khi diff git / render sidebar / chọn palette bằng bàn phím.
2. **Lỗ hổng an toàn main-process** (path traversal config, `fs:read` không giới hạn, `webSecurity:false`).
3. **Nhóm feature còn thiếu**: encoding, layout grid đa pane, LSP goto/rename/format, terminal, plugin ecosystem.

Ưu tiên tuyệt đối trước khi làm feature mới: **vá crash + tính năng chết + race** ở mục 7.

---

## 1. Feature parity (theo nhóm, có %)

> ✅ giống · 🟡 một phần/khác · ⬜ thiếu. % là mức "cảm giác giống Sublime" của nhóm.

| Nhóm | % | Đã giống | Chưa giống / Thiếu |
|---|---:|---|---|
| **Editing lõi** | **94%** | undo/redo, cut/copy/paste, move/dup/delete/join line, indent, comment line+block, sort, transpose, reindent, convert indent, case up/low/title + swap/camel/snake/kebab, rot13, permute lines & selections, trim, wrap paragraph, fold level 2–7 | Paste-from-history (clipboard ring), Mark (Emacs-style), Arithmetic, HTML wrap-tag/encode |
| **Selection / Multi-cursor** | **90%** | Ctrl+D, split-into-lines, select-all-occurrences, expand/shrink, add cursor above/below, invert, single | Column/block select chỉ qua **Shift+Alt+drag** (Monaco), không middle-drag như ST; expand-to-Word/Paragraph/Indentation riêng lẻ (Monaco chỉ có smart-expand chung) |
| **Find / Replace (in-file)** | **86%** | bottom bar đúng kiểu ST, regex/case/word/wrap/in-sel/preserve-case, x-of-N, incremental highlight, history, replace $1..$9 | Incremental Find "thật" (Ctrl+I chỉ alias), Find Under / Find All Under / Skip; counter sai khi >100k match (cap thầm lặng); **stale-scope bug** (7) |
| **Find in Files** | **80%** | panel gom theo file, click nhảy dòng, regex/case/word, báo truncated | **Replace-all-in-project + preview** thiếu; Next/Prev Result (F4); **bug `running` kẹt vĩnh viễn** (7) |
| **Goto / Navigation** | **95%** | Goto Anything (`@`/`#`/`:`), Command Palette, Goto Symbol file+project, Goto Line, jump back/forward | suffix `@`/`:`/`#` **bị bỏ qua khi chọn bằng bàn phím** (7); goto-definition chỉ Monaco (chưa nối LSP thật) |
| **Tabs** | **88%** | context menu đầy đủ, pin, preview (italic), disambiguate tên trùng, drag reorder, git màu, MRU-none | Alt+1..9 chọn tab, Ctrl+PageUp/Down, Ctrl+Tab MRU, multi-select tab, kéo sang pane khác |
| **Layout / Panes** | **60%** | cột 1/2/3, focus theo click, zen mode | grid 2×2, rows, 4 cột, focus_group Ctrl+1..9, move_to_group, new/close pane động |
| **Sidebar / Project** | **85%** | tree, file ops đầy đủ (new/rename/dup/delete/copy-path/reveal), inline input, multi-root, .sublime-project | tree keyboard-nav, drag-move, filter box, disk watcher; **remove-folder không lưu vào project** (7) |
| **Git / History** | **62%** | gutter add/mod/del vs HEAD (LCS), status màu sidebar, branch ở status bar, revert file | next/prev modification, revert **hunk**, inline diff; **diff freeze + race** (7) |
| **Syntax highlight / Theme** | **90%** | Mariana default đúng màu ST, Monokai, One-Dark, adaptive; TextMate-grammar qua Monaco | scope granularity của Monaco ≠ .tmTheme của ST (một số token gộp/khác màu) |
| **Build system** | **70%** | auto-detect npm/Makefile/run-file, output panel, linkify file:line, cancel/rerun | `.sublime-build` (biến `$file`…), Show Build Results / Next-Prev error |
| **LSP / Ngôn ngữ** | **45%** | diagnostics, hover, completion (JS/TS) | goto-def/reference qua LSP, rename, format, signature help, code action, spell check |
| **Preferences / Keymap** | **88%** | Settings JSON (Default\|User, live-apply), keymap JSON + chord, auto-save, session/hot-exit | syntax-specific settings, mouse bindings, distraction-free settings riêng |
| **Encoding / Line-ending** | **35%** | LF/CRLF convert + hiển thị | **toàn bộ bảng encoding** (reopen/save with encoding, BOM, UTF-16, hex view) |
| **Terminal** | **0%** | — | integrated terminal (node-pty bị chặn build môi trường này) |
| **Plugin / Package Control** | **0%** | — | plugin API, package registry, Vim mode |
| **Large file** | **110%** | streaming GB→100GB, sparse index, virtualized viewer | *(vượt Sublime)* — read-only, off-by-1 nhỏ ở chế độ clamped (7) |
| **Vietnamese IME** | **∞** | fcitx5 inline preedit tại caret | *(Sublime không có)* |

**Bình quân có trọng số (bỏ 2 nhóm "vượt"):** **≈ 84%.**

---

## 2. UX parity — so sánh hành vi chi tiết

| Khía cạnh | Sublime 4 | Lumen | Nhận xét |
|---|---|---|---|
| **Caret movement** | smooth, animated | ✅ `cursorSmoothCaretAnimation:'on'`, blink `smooth`, orange 2px | Rất sát ST. Đây là điểm Monaco làm tốt. |
| **Caret màu** | orange `#f9ae58` (Mariana) | ✅ đúng | — |
| **Mouse selection** | drag chọn | ✅ Monaco | ngang nhau |
| **Double click** | chọn word | ✅ | ngang |
| **Triple click** | chọn line | ✅ Monaco | ngang |
| **Rectangular / column** | **middle-drag** hoặc Shift+RMB drag | 🟡 chỉ **Shift+Alt+drag** (Monaco) | **Lệch rõ** — người quen ST bấm middle-drag sẽ không ra column-select |
| **Multi-cursor add** | Ctrl+Click | ✅ `multiCursorModifier:'ctrlCmd'` | ngang |
| **Smooth scrolling** | có | ✅ `smoothScrolling:true` | ngang |
| **Scroll beyond last line** | có | ✅ `scrollBeyondLastLine:true` | ngang |
| **Auto-scroll khi kéo chọn** | có | ✅ Monaco | ngang |
| **Center cursor** | Ctrl+K Ctrl+C? / reveal-center | 🟡 dùng `revealLineInCenter` ở goto | không có lệnh "center current line" riêng gắn phím |
| **Minimap** | chữ thật, slider on-hover | ✅ `renderCharacters:true, showSlider:'mouseover', maxColumn:80` | rất sát; màu slider hơi khác |
| **Command palette** | fuzzy, `>`prefix | ✅ fuzzy subsequence + highlight | **KHÁC**: ST tách Goto (Ctrl+P) và Command (Ctrl+Shift+P); Lumen cũng tách — OK. Nhưng `sub`/category **không được đưa vào fuzzy** (1) |
| **Viewport khi mở file** | nhớ vị trí | ✅ viewState per-buffer per-pane | tốt |
| **Overlay scrollbar** | mảnh | ✅ 12px + overlay CSS | sát |
| **Status bar** | Ln/Col · indent · encoding · EOL · lang, click được | ✅ đúng thứ tự ST, clickable | rất sát; thiếu click vào encoding (chưa có encoding thật) |

**Kết luận UX:** phần "cảm giác gõ" (caret, scroll, selection cơ bản) **rất sát** nhờ Monaco. Điểm lệch UX đáng kể duy nhất về thao tác chuột là **column-select bằng middle-drag** — nên map lại để giống ST.

---

## 3. Keyboard parity

### 3.1 Cơ chế (quan trọng để hiểu bug)
Phím được xử lý qua **4 tầng** — dễ chồng chéo:
1. **Electron menu accelerators** (`main.js`) — tầng "thật" cho phần lớn phím.
2. **`installKeybindings()`** (`app.js`) — hardcode Ctrl+P/Shift+P/G/R/B/S/N/O/W/F/H/F3 ở capture phase.
3. **Monaco `addKeybindingRules`** (`app.js`) — chord editor (Ctrl+K …, Ctrl+U, Ctrl+L, Ctrl+M, Alt+Shift+↑↓, fold level).
4. **`keymap.js` dispatcher** — user keymap JSON, chord.

> ⚠️ Trường `keybind` trong `def(id,title,cat,keybind,run)` phần lớn **chỉ để hiển thị** trong palette + sinh Default keymap; **không tự bind**. Nên vài lệnh có "phím" trong palette nhưng **bấm không ăn** trừ khi cũng có ở menu/Monaco.

### 3.2 Xung đột / sai phím (thật)
| Phím | Vấn đề | Mức |
|---|---|---|
| **Ctrl+Q** | `role:'quit'` (native Linux) **và** Tools ▸ Record/Stop Macro (`CmdOrCtrl+Q`). Quit thắng → **bấm Ctrl+Q để ghi macro lại thoát app**. | 🔴 cao |
| **F2** | Next Bookmark (menu accel, chạy thật) **vs** Sidebar Rename (chỉ `def` cosmetic + nhãn menu chuột phải). **F2 không bao giờ rename**. | 🟠 vừa |
| **Ctrl+B** | Lumen = Toggle Sidebar; ST = Ctrl+K Ctrl+B (Ctrl+B của ST là "Build"). Chủ ý lệch, nhưng khác ST. | 🟡 nhẹ |
| **Chord tiền tố** | Nhấn `Ctrl+K` (đợi chord) **rò sang Monaco** (thiếu `stopPropagation` ở nhánh pending) → Monaco chạy action Ctrl+K của nó trước khi chord hoàn tất. | 🟠 vừa |
| **Keymap khi gõ Find** | dispatcher chỉ né khi palette mở; **không né** ô Find/Find-in-Files → binding chữ cái nuốt ký tự đang gõ. | 🟠 vừa |
| **Ctrl+Space** | Show Completions **và** thường là phím bật/tắt fcitx. Trên máy có bộ gõ VN → tranh chấp. | 🟡 nhẹ |

### 3.3 Thiếu shortcut so với ST
Alt+1..9 (chọn tab), Ctrl+PageUp/Down, Ctrl+Tab (MRU), Ctrl+1..9 (focus group), F4/Shift+F4 (next/prev result), F11 (fullscreen — hiện chỉ role togglefullscreen ở View), Ctrl+F3/Alt+F3 (find under — có Alt+F3), Ctrl+K Ctrl+D (find-under-skip), F6 (spell), Ctrl+Shift+A (expand to tag).

---

## 4. Rendering parity

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|
| **Font rendering** | ✅ | antialiased; `--font-mono` (Menlo/Consolas/JetBrains) — ⚠️ **lệch nội bộ**: `baseOptions` lấy từ CSS var, `settings.DEFAULTS.font_family` lại là "JetBrains Mono, Fira Code…". Settings ghi đè lúc load nên OK, nhưng nên đồng bộ. |
| **Line height** | ✅ | `lineHeight:20` với `fontSize:13` — hơi thoáng, gần ST. |
| **Tab width** | ✅ | `tabSize:4`, đổi được per-buffer, hiển thị status bar. |
| **Whitespace render** | ✅ | `renderWhitespace:'selection'` mặc định + toggle "Show Space and Tab" (`all`). |
| **Indent guide** | ✅ | `guides.indentation:true`, active highlight. Sát ST. |
| **Gutter** | ✅ | line number + glyph margin (bookmark + git). Màu `#65737e`/active `#d8dee9` đúng Mariana. |
| **Folding** | ✅ | Monaco fold + fold level 2–7 (ST tới 9, Monaco tối đa 7 → **thiếu 8,9**). |
| **Selection highlight** | ✅ | `#4f5b66` muted (đúng ST, KHÔNG xanh accent). |
| **Bracket match** | ✅ | chỉ viền teal, **không** rainbow (đúng ST — `bracketPairColorization:false`). |
| **Cursor animation** | ✅ | smooth caret — dấu ấn ST, có. |
| **EOL marker (`¬`)** | 🟡 | tự vẽ qua injected glyph, viewport-aware; hàm `eolLabel` **chỉ trả CRLF/LF** — file CR cổ điển bị gán nhầm LF (7). |
| **Sticky scroll** | ✅ | bật (Monaco) — ST4 cũng có. |
| **Whitespace/EOL trên split pane mới** | 🔴 | pane split **sau khi** bật EOL **không** được gắn listener refresh (7-#invisibles). |

**Kết luận rendering:** rất sát Sublime Mariana. Vấn đề rendering là **hành vi động** (EOL trên pane mới, CR label), không phải tĩnh.

---

## 5. Performance

### 5.1 Bottleneck đã xác định
1. **Git LCS diff chạy trên UI thread** (`git.js`) — bảng DP `(n+1)×(m+1)` Uint16Array, O(n·m) **đồng bộ**, gọi lại **mỗi 350ms khi gõ**. File ~3000 dòng tracked → mỗi nhịp debounce **freeze vài trăm ms**. 🔴 Nghiêm trọng nhất về perf.
2. **`readLines` large-file đồng bộ** (`largefile.js`) — `fs.readSync` chunk 4MB; khi index chưa xong và nhảy tới dòng xa checkpoint → có thể quét đồng bộ phần lớn file GB **block main process**.
3. **Find-in-Files chạy trên main thread** — walk + `readFile` toàn bộ + regex `exec` tuần tự; **ReDoS** với regex user (`(a+)+$`) treo UI.
4. **`git status` + diff toàn pane mỗi lần focus cửa sổ** — repo lớn lặp việc nặng.
5. **`build.js raw`** tích lũy không giới hạn với process stream dài (vd `npm run dev`) → phình bộ nhớ + linkify chỉ chạy khi exit (server không bao giờ linkify).
6. **Typing latency** — nhìn chung tốt (Monaco), NHƯNG mỗi keystroke kích: `dirty`+renderTabs, `autosave.notify`, `git.scheduleDiff`, `lsp.onChange` — chuỗi này cộng với (1) là nguồn giật khi gõ trên file tracked.

### 5.2 Đề xuất tối ưu (không đổi kiến trúc)
- **Chuyển LCS diff sang Web Worker** hoặc dùng thuật toán Myers O(ND) + hạ ngưỡng, và **hủy diff cũ** khi có diff mới (AbortController/token). Ưu tiên #1.
- **`readLines` async** (`fs.read` promise) + trả "đang tải" cho vùng chưa index thay vì quét đồng bộ.
- **Find-in-Files:** thêm timeout/step-guard cho regex (hoặc `RE2`), cân nhắc chạy trong `utilityProcess`/worker; stream kết quả thay vì đợi cả walk.
- **Debounce git-on-focus** + chỉ diff pane đang hiển thị.
- **Cap `build.raw`** (giữ N MB cuối, rolling) + linkify incremental.
- **Memory leaks cần dọn** (mục 7): `bookmarks.map`, `lsp.changeTimers/versions`, `headCache`, preload listeners, decorations collection, invisibles disposables.

### 5.3 FPS scroll & large file
- Scroll thường: Monaco GPU, mượt.
- Large-file viewer: virtualized + rAF-throttle scroll + cache screenful — thiết kế tốt; đo được p50 12ms/screenful trên 3.22GB. Vượt Sublime.

---

## 6. Architecture

**Đánh giá: vững, đúng chuẩn Electron, KHÔNG cần refactor.** Main/renderer tách bạch, IPC qua `contextBridge` (`contextIsolation:true`, `nodeIntegration:false`). Registry lệnh trung tâm sạch. Module hoá theo `LUM.*` rõ ràng.

| Thành phần | Đánh giá |
|---|---|
| **Editor core** | Dựa Monaco `ITextModel`; buffer/pane/tab tự quản. Tách text vs large-buffer hợp lý. `showBuffer` detach model khi large → tránh mutate ẩn. Tốt. |
| **Event system** | Monaco events + `document` capture listeners + IPC events. **Rủi ro:** nhiều listener global capture-phase không gỡ (palette, keymap) — chấp nhận vì singleton, nhưng dispatcher keymap thiếu guard input (7). |
| **Rendering** | Monaco lo editor; chrome bằng CSS grid. `automaticLayout:true` + gọi `layout()` thủ công. Ổn. |
| **Command system** | `LUM.commands` registry + `run()` bắt lỗi + macro hook. **Điểm yếu:** trường `keybind` gây hiểu nhầm là đã bind (mục 3.1). |
| **State management** | `store.js` atomic temp+rename, debounced. **Thiếu `fsync`** trước rename (7-low). Session/hot-exit tốt. |
| **Plugin system** | Chưa có (gap lớn nhất so ST, dài hạn). |

**Rủi ro kiến trúc thực sự:** không phải cấu trúc, mà là **thiếu ranh giới an toàn** — `webSecurity:false` + IPC toàn quyền (`fs:*`, `proc:run shell:true`) + **path traversal** ở `config:*`. Bất kỳ code-exec phía renderer nào leo thẳng lên arbitrary FS write + command exec (mục 7).

---

## 7. Bug hunting — findings (đã xác minh qua đọc mã)

> Sắp theo mức độ. `file:line`. Đây là phần **quan trọng nhất** — nên vá trước mọi feature mới.

### 🔴 CRASH / CAO

| # | Vị trí | Bug & kịch bản | Mức |
|---|---|---|---|
| B1 | `palette.js:245-251` (+216-228) | **Goto Line + phím mũi tên = crash.** Line-mode tạo item **không có `label`**; ArrowUp/Down đi qua `move()`→`renderList()`→`highlight(row.it.label)`→`escapeHtml(undefined)`→`TypeError`. Ctrl+G rồi bấm ↓ → palette chết. | crash |
| B2 | `findinfiles.js:81-94` | **Find-in-Files chết vĩnh viễn sau 1 lần lỗi.** `running=true` rồi `await searchInFiles` **không try/catch**; IPC reject (folder bị xoá giữa chừng…) → `running` kẹt `true` mãi → mọi search sau bị guard bỏ qua tới khi reload app. | cao |
| B3 | `main.js:745-763` | **Path traversal `config:ensure`/`config:writeDefault`.** `path.join(userData, name)` không kiểm `name`; `../../…/.bashrc` thoát userData và ghi `content` do renderer kiểm soát → ghi đè file tuỳ ý. | cao (bảo mật) |
| B4 | `main.js:525-529` | **`fs:read` không giới hạn kích thước.** Đọc nguyên file vào 1 string ở main; nếu qua mặt ngưỡng large (symlink swap/race) → OOM/crash main, hoặc `ERR_STRING_TOO_LONG` (~512MB). | cao |
| B5 | `git.js:93-107` | **LCS diff freeze UI** (xem 5.1-#1). O(n·m) đồng bộ mỗi keystroke. | cao (perf) |
| B6 | `git.js:157-176` | **Diff nhầm file sau `await`.** Bắt `buf.path`, `await gitHeadFile`, rồi mới đọc `ed.getModel().getValue()`. Đổi tab trong lúc await → **diff HEAD của A với nội dung B** → gutter add/mod/del sai bét trên B. | cao |
| B7 | `sidebar.js:95-121` | **`render()` re-entrant.** `innerHTML=''` rồi `await entriesOf` nhiều lần, không guard in-flight. Hai render chồng nhau (openFolder + click folder khác / blur-commit giữa walk) → **hàng cây trùng/thiếu, mất trạng thái expand**. | cao |
| B8 | `sidebar.js:234-251` | **Inline create/rename commit 2 lần.** `done` chỉ set `true` **sau** `await validateInline`; Enter → commit (đang await) → blur → commit thứ 2 vượt qua check `done` → **2 lần writeFile/mkdir**, hoặc rename lần 2 trúng path đã đổi → throw. | cao |

### 🟠 VỪA

| # | Vị trí | Bug & kịch bản |
|---|---|---|
| B9 | `app.js:402` + `main.js:231,451` | **Ctrl+Q: Quit đè Macro.** Bấm Ctrl+Q để ghi macro → thoát app. |
| B10 | `palette.js:253-273,281` | **Suffix `@`/`:`/`#` bị bỏ qua khi Enter.** `choose()` từ bàn phím không nhận `suffix` (chỉ click mới có). Gõ `file.js:120` + Enter → mở file nhưng **không nhảy dòng 120**. |
| B11 | `palette.js:58-103` | **Race open/prepareItems.** Ctrl+P (file, đang walk) rồi Ctrl+Shift+P (command): list command hiện, sau đó walk resolve **ghi đè bằng file items** dù `mode==='command'`. Không có request-token. |
| B12 | `find.js:334-344,364-375` | **F3 sau khi đóng "in selection" dùng scope cũ.** `close()` không reset `state.inSelection`/`scopeRanges`; F3 lúc đóng vẫn giới hạn trong vùng chọn cũ (toạ độ có thể đã stale). |
| B13 | `keymap.js:71-88` | **Phím tiền tố chord rò sang Monaco** (thiếu `stopPropagation` nhánh pending) → Monaco chạy action Ctrl+K của nó. |
| B14 | `keymap.js:57-59` | **Dispatcher chạy khi gõ trong ô Find.** Chỉ né palette; binding chữ cái nuốt ký tự trong Find/Find-in-Files. Nên guard `document.activeElement`. |
| B15 | `macros.js:19-28` | **Macro chỉ bắt pane có sẵn lúc bắt đầu.** Split/mở tab sau `start()` → gõ ở đó **không được ghi**; pane bị thay không qua `detach()` → rò `onDidType`. |
| B16 | `lsp.js:34-43` | **Không có `didClose`; `changeTimers`/`versions` rò mãi;** timer debounce gọi `buf.model.getValue()` sau khi model có thể đã dispose (đóng tab trong 350ms) → throw; đổi tên file → `didChange` cho uri chưa từng `didOpen`. |
| B17 | `symbols.js:20-62` | **`invalidate()` giữa lúc build → index stale.** Không huỷ promise đang chạy; `if(building) return building` phát promise cũ → goto cache & hiện symbol trước-save. Multi-root: chỉ index `roots[0]`. |
| B18 | `project.js` + `sidebar.js:446` | **Remove folder không lưu.** Menu chuột phải gọi `sidebar.removeFolder` trực tiếp, không gọi `project.onFoldersChanged` → mở lại project folder bị xoá **quay lại**. |
| B19 | `invisibles.js:82-100` | **EOL marker không refresh trên pane split mới** (`eolListeners` one-shot boolean); disposables scroll/content **không được lưu/gỡ**. |
| B20 | `main.js:579-584,636` | **ReDoS Find-in-Files** (xem 5.1-#3). |
| B21 | `largefile.js:35` + `main.js:775-794` | **Rò fd khi renderer reload/crash.** Session (fd) ở main chỉ đóng qua `lf:close`/quit; reload dev không gọi `lfClose` → orphan fd tích luỹ. |
| B22 | `lsp.js:110-118` | **LSP server không dispose tới khi quit.** Mỗi root spawn `typescript-language-server`(+tsserver); mở nhiều root → tích process/memory. |
| B23 | `main.js:66` | **`webSecurity:false` + IPC toàn quyền** → blast radius lớn (xem mục 6). |

### 🟡 THẤP (chọn lọc)

| # | Vị trí | Bug |
|---|---|---|
| B24 | `main.js:562-565` | **Lọc dotfile chết** — khối trong là no-op; `.ssh`/`.hidden` (không thuộc IGNORE) vẫn bị walk/index. |
| B25 | `bookmarks.js:10` | `map` theo bufferId **không xoá khi đóng tab** → rò nhỏ (bufferSeq không tái dùng). |
| B26 | `git.js:13` / `symbols` line | `headCache` không giới hạn giữa refresh; symbol `s.line` stale sau khi sửa. |
| B27 | `find.js:113-128,283` | `findMatches(...100000)` cap thầm; counter/Find-All sai khi >100k, không báo "giới hạn". |
| B28 | `palette.js:204-208` | `hay=label+' '+sub` nhưng fuzzy chỉ chạy trên `label`; **`sub`/category không được search** (biến chết). |
| B29 | `find.js:230-237` | `replaceOne` khi chưa có match → chỉ `move(1)`, phải bấm Replace lần 2. Lệch UX ST. |
| B30 | `invisibles.js:54-56` | `eolLabel` không bao giờ trả `CR` → file CR gán nhầm LF. |
| B31 | `lsp.js:85` | `rootUri='file://'+root` **không URL-encode**; root có dấu cách/non-ASCII/Windows `C:\` → LSP hỏng thầm. |
| B32 | `preload.js:78-99` | `on*` subscriptions không dedup/gỡ → đăng ký lại là chồng listener. |
| B33 | `lsp.js:47-49` | timer timeout 6s không `clearTimeout` khi có response → churn timer. |
| B34 | `store.js:43-54` | không `fsync` trước rename; `JSON.stringify` throw để lại `.tmp` cũ. |
| B35 | `largefile.js:118` | chế độ clamped: `ratio*(total-vis+OVERSCAN)` cộng OVERSCAN 2 lần → screenful cuối hơi khó chạm. |
| B36 | `nav.js:57-60` | `back()` push không áp cap 200; double-back nhanh có thể skip entry (race qua `suppress`). |

**Tổng: 8 cao/crash, 15 vừa, 13 thấp.** Ưu tiên vá: **B1, B2** (chết ngay), **B3, B4** (bảo mật/crash), **B5, B6, B7, B8** (freeze/hỏng dữ liệu hiển thị).

---

## 8. Missing features (so với Sublime, theo ưu tiên)

### 🔴 Critical (chặn "editor dùng thật hằng ngày")
- **Encoding đầy đủ** — Reopen/Save with Encoding, BOM, UTF-16, `iconv-lite`, hiển thị+click ở status bar. (nhóm 35%)
- **Reopen Closed File "thật"** — hiện có `reopenClosed` stack path, nhưng cần kiểm chứng khôi phục đúng tab/con trỏ.
- **Disk watcher** — tự phát hiện file đổi ngoài app (`fs.watch`), cảnh báo external-change (hiện không có → dễ ghi đè mất dữ liệu).

### 🟠 High
- **LSP goto-definition/reference/rename/format/signature/code-action** (đang 45%).
- **Layout grid** 2×2 / rows / 4 cột + focus_group Ctrl+1..9 + move_to_group.
- **Git hunk-level**: next/prev modification (Ctrl+Shift+. / ,), revert hunk, inline diff.
- **Tab navigation ST**: Alt+1..9, Ctrl+PageUp/Down, Ctrl+Tab MRU, multi-select.
- **Next/Prev Result (F4)** dùng chung Find-in-Files + build errors.
- **Replace-all trong Find-in-Files** (+ preview).

### 🟡 Medium
- **`.sublime-build`** parser + biến `$file/$folder/$file_base_name`.
- **Column-select bằng middle-drag** (map lại cho giống ST).
- **Toggle Tabs/Status/Menu** (đã có Toggle Tabs/Status; thiếu Menu), **Full Screen F11**.
- **Fold Level 8–9** (Monaco tối đa 7 — cần tự viết).
- **Expand-to Word/Paragraph/Indentation** riêng lẻ.
- **Paste from History** (clipboard ring), **Mark** (Emacs-style).
- **Syntax-specific settings**, **Mouse bindings** (`.sublime-mousemap`).
- **Multi-root**: index symbol + git + search cho **mọi** root (hiện chỉ roots[0]).

### 🟢 Low (dài hạn / product-scale)
- **Integrated terminal** (giải node-pty).
- **Spell check (F6)**, **Emmet / Close Tag**.
- **Plugin API + Package Control**, **Vim mode** (`monaco-vim`).
- **Print / Copy as HTML**, **Hex view**, **Image view**.

---

## 9. Roadmap để đạt %

> Nguyên tắc: **vá bug hành vi trước feature** — vì crash/tính-năng-chết kéo tụt cảm giác "giống ST" mạnh hơn thiếu feature.

### → **90%** (Đợt STABILIZE — bắt buộc trước tiên)
1. Vá **B1** (Goto Line crash), **B2** (Find-in-Files kẹt), **B10** (suffix bàn phím) — palette/find phải đúng.
2. Vá **B3, B4** (traversal + fs:read cap) — bảo mật/crash.
3. Vá **B6, B7, B8** (git diff race, sidebar re-entrant, double-commit) — chống hỏng dữ liệu/hiển thị.
4. Vá **B9** (Ctrl+Q), **B13, B14** (chord rò + guard input Find).
5. Đưa **LCS diff ra worker + hủy diff cũ** (B5).

### → **95%** (Đợt FEATURE-CORE)
6. **Encoding** đầy đủ (`iconv-lite`) + status bar.
7. **Disk watcher** + external-change guard.
8. **LSP**: goto-def/reference (F12/Shift+F12), rename, format, signature, code-action.
9. **Git hunk**: next/prev modification, revert hunk, inline diff.
10. **Tab nav ST** (Alt+1..9, Ctrl+PageUp/Down, Ctrl+Tab MRU) + **F4 next/prev result**.
11. Column-select **middle-drag**; dọn memory leaks (B16, B21, B22, B25, B32).

### → **98%** (Đợt PARITY-DEEP)
12. **Layout grid** 2×2/rows/4-cột + focus_group + move_to_group.
13. **Replace-all Find-in-Files + preview**; **`.sublime-build`**.
14. **Multi-root** cho symbol/git/search (bỏ giới hạn roots[0]).
15. Expand-to variants, Paste-from-History, Mark, Fold 8–9, Full Screen F11, syntax-specific settings, mouse bindings.

### → **99%** (Đợt POLISH)
16. Spell check (F6), Emmet/Close Tag, Print/Copy-as-HTML, Hex/Image view.
17. Micro-fidelity: token màu Monaco ↔ .tmTheme ST, minimap slider màu, các off-by nhỏ (B30, B35, B36).

### → **100%** (Đợt ECOSYSTEM — product-scale, dài hạn)
18. **Integrated terminal** (node-pty / xterm.js).
19. **Plugin API (JS/WASM sandbox) + package registry**.
20. **Vim mode** (`monaco-vim`).
21. Kiến trúc bảo mật: bỏ `webSecurity:false` (custom protocol + CSP), sanitize `config:*`, sandbox `proc:run`.

---

## 10. Kết luận

Lumen đã ở mức **~84–86% parity** với Sublime Text 4 — một nền **rất tốt**: UX gõ/caret/scroll sát nhờ Monaco, chrome Mariana đúng màu, command palette + goto-anything + large-file + session ngang hoặc vượt ST, cộng 2 điểm **vượt** (large-file, IME tiếng Việt).

Khoảng cách tới "hoàn hảo" **không chủ yếu là thiếu feature**, mà là **một chùm bug hành vi thật** (crash Goto Line, Find-in-Files chết, các race git/sidebar/palette) và **lỗ hổng an toàn main-process**. Đây phải là việc làm **trước** mọi feature mới — đúng tinh thần "ưu tiên hành vi giống Sublime".

**Đã review xong. Chưa sửa code.** Chờ lệnh tiếp theo — gợi ý bắt đầu từ **Đợt STABILIZE (B1, B2, B3, B4, B6, B7, B8)**.

---

*Phụ lục — nguồn đối chiếu: `docs/SUBLIME_GAP_ANALYSIS.md`, `docs/Architecture.md`, và `/opt/sublime_text/Packages/Default.sublime-package` (keymap/menu/commands). Bug được xác minh bằng đọc mã trực tiếp trong `src/renderer/js/*`, `src/main/*`, `main.js`, `preload.js`.*
