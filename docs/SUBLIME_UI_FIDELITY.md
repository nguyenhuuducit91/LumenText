# Lumen — Đặc tả trung thực giao diện Sublime Text 4 (UI Fidelity Spec)

> **Mục tiêu:** làm cho Lumen **trông và cảm giác giống hệt Sublime Text 4 mới nhất
> (build 4200)** khi mở lần đầu — không chỉ đúng chức năng mà đúng **màu, khoảng cách, hình dáng,
> font, chuyển động**. Tài liệu này là "pixel spec" để Claude Code chỉnh `styles.css`,
> `index.html`, `icons.js`, và phần theme trong `app.js`.
>
> **Chuẩn tham chiếu = mặc định của Sublime Text 4 ngay sau khi cài:**
> - **Color scheme:** `Mariana` (mặc định ST4 — tông xanh navy `#303841`, KHÔNG phải One-Dark).
> - **UI theme:** `Adaptive` (chrome tự lấy tông từ color scheme) — với dáng tab/sidebar của theme
>   `Default`.
> - **Điểm khác biệt lớn nhất so với code hiện tại:** app đang dùng One-Dark `#282c34` (xám-xanh lá)
>   → phải đổi sang **Mariana `#303841` (xanh navy)**. Đây là thứ khiến "nhìn chưa giống".
>
> **Cách verify:** mở ST4 thật (nếu có) hoặc dùng ảnh tham chiếu trong tài liệu, rồi so ảnh
> `LUMEN_SCREENSHOT` cạnh nhau. "Xong" = đặt hai ảnh cạnh nhau khó phân biệt phần chrome.

---

## 0. Nguyên tắc & phạm vi

- Giữ nguyên kiến trúc; đây thuần là lớp **trình bày** (CSS + vài DOM + theme JSON). Không phá
  large-file/session/fcitx.
- Bọc mọi thay đổi trong một **UI theme mới `stp-sublime`** (mặc định bật) song song theme One-Dark
  hiện có, để có thể so sánh/hoàn tác. Color scheme mới `stp-mariana` đăng ký qua
  `monaco.editor.defineTheme`.
- Mọi con số px/hex dưới đây là **giá trị đích cụ thể** — code thẳng, đừng "ước lượng".

---

## 1. Bảng màu chuẩn (thay toàn bộ `:root` trong `styles.css`)

### 1.1 Color scheme "Mariana" cho Monaco (vùng soạn thảo)
Đăng ký `monaco.editor.defineTheme('stp-mariana', …)` với token màu **chính xác** của Mariana:

| Vai trò | Hex | Dùng cho |
|---|---|---|
| background | `#303841` | nền editor |
| foreground | `#d8dee9` | chữ thường |
| caret | `#f9ae58` | con trỏ (cam đặc trưng ST) |
| selection | `#4f5b66` | vùng chọn |
| selection (inactive) | `#404b54` | vùng chọn khi mất focus |
| line highlight | `#3b444d` | dòng hiện tại (rất nhẹ) |
| gutter fg | `#65737e` | số dòng |
| gutter fg active | `#d8dee9` | số dòng của dòng hiện tại |
| indent guide | `#3b444d` | · active `#5c6773` |
| comment | `#a6acb9` (xám nhạt) | comment |
| keyword / storage | `#c594c5` (tím-hồng) | `if`, `function`, `const` |
| string | `#99c794` (xanh lá) | chuỗi |
| number / constant | `#f9ae58` (cam) | số, `true/false/null` |
| function name | `#6699cc` (xanh dương) | tên hàm |
| class / type / tag | `#5fb3b3` (teal) | class, tag HTML |
| variable / punctuation | `#d8dee9` | biến, dấu câu |
| operator | `#5fb3b3` | `+ - = =>` |
| invalid / error | `#ec5f67` (đỏ) | lỗi |
| find highlight | `#f9ae5866` | nền kết quả tìm (cam mờ) |
| bracket match | viền `#5fb3b3` | cặp ngoặc khớp |

> Mariana palette biến phụ: blue `#6699cc`, green `#99c794`, orange `#f9ae58`, orange2 `#f97b58`,
> purple `#c594c5`, teal `#5fb3b3`, red `#ec5f67`, grey `#65737e`, white2 `#d8dee9`, white3 `#a6acb9`.

### 1.2 UI chrome tokens (thay khối `:root` hiện tại)
Chrome của ST Adaptive = tông tối hơn editor một chút, cùng gốc navy. Thay giá trị One-Dark bằng:

```css
:root {
  /* Mariana / Adaptive — chrome + editor cùng gốc navy #303841 */
  --bg:        #303841;   /* editor + main content (Mariana background) */
  --bg-dark:   #2a3138;   /* sidebar, tab strip (tối hơn ~8%) */
  --bg-elev:   #353d47;   /* panel/quick panel nổi */
  --bg-hover:  #3b444d;   /* hover row */
  --sel:       #4f5b66;   /* selection / active row */
  --sel-strong:#5a6673;
  --fg:        #a6acb9;   /* chữ chrome thường (hơi dim) */
  --fg-bright: #d8dee9;   /* chữ nổi bật */
  --fg-dim:    #65737e;   /* chữ mờ (label, số dòng) */
  --border:    #21272e;   /* viền tối */
  --border-soft:#2a3138;
  --accent:    #6699cc;   /* xanh dương ST (highlight chọn) */
  --accent-2:  #99c794;   /* xanh lá */
  --accent-orange:#f9ae58;/* cam — caret, badge, active tab underline (tuỳ chọn) */
  --warn:      #f9ae58;
  --danger:    #ec5f67;
  --purple:    #c594c5;
  --teal:      #5fb3b3;
  --tab-active:  #303841;  /* tab active = nền editor (liền mạch) */
  --tab-inactive:#2a3138;
  --sidebar-w: 240px;
  --font-ui:   "Noto Sans", "Segoe UI", "Ubuntu", system-ui, sans-serif;
  --font-mono: "Menlo", "Consolas", "DejaVu Sans Mono", "JetBrains Mono", monospace;
  --shadow: 0 12px 40px rgba(0,0,0,.5);
}
```

> **Lưu ý màu chọn:** ST Adaptive KHÔNG tô nền xanh đặc như VSCode cho hàng/tab active. Hàng active
> ở sidebar và item quick-panel active dùng nền `--sel` (#4f5b66) **mờ**, chữ sáng — **không** phải
> nền xanh `--accent` như code hiện tại (đang tô `#61afef` đặc). Đây là điểm sai rõ nhất (mục 5.2).

---

## 2. Sidebar — dáng Sublime (khác VSCode nhất)

Sublime Default/Adaptive sidebar **rất tối giản** — đây là nơi app hiện đang "giống VSCode hơn ST".

### 2.1 Đặc điểm bắt buộc để giống ST
- **KHÔNG có file-type icon mặc định.** ST chỉ hiện: tam giác ▸/▾ cho folder, và **chữ trơn** cho
  file (không icon màu). → Thêm setting `sidebar.file_icons` (mặc định **off** = giống ST; on = giống
  VSCode dùng `icons.js` hiện có). Khi off, cột icon co lại, tên file lùi sát tam giác.
- **Folder in HOA/đậm nhẹ?** Không — ST hiển thị tên thư mục thường, chỉ tam giác phân biệt. Tên
  **project root** ở header mới in HOA (đã đúng).
- **Row cao ~22px** (ST đặc hơn hiện tại 24px một chút), font **13px**, indent mỗi cấp **16px** với
  **indent guide dọc mờ** (`#3b444d`) — ST vẽ đường guide theo mỗi cấp lồng nhau.
- **Hàng chọn:** nền `--sel` (#4f5b66) bo nhẹ, **không** có thanh accent trái (ST không có; bỏ
  `.tree-row.active::before` accent bar khi ở theme sublime — đó là kiểu VSCode).
- **File đang mở** hiển thị chữ sáng hơn (`--fg-bright`) so với file chưa mở (`--fg`); file active =
  nền `--sel`. Đây là cách ST phân biệt, thay cho icon.
- Twisty tam giác: màu `--fg-dim`, cỡ ~9px, xoay mượt 0.1s (đã có).
- Padding trên của tree ~4px; không có đường kẻ giữa các item.

### 2.2 Header sidebar
- ST không có nút "＋" to; header chỉ là tên FOLDER (uppercase, letter-spacing, `--fg-dim`, 11px).
  Giữ nút mở-folder nhưng làm mờ, chỉ rõ khi hover (đã gần đúng). Không viền dưới header.

### 2.3 Scrollbar sidebar
- Overlay mảnh (mục 8), track trong suốt, thumb `#3b444d`.

---

## 3. Tab bar — dáng tab Sublime

### 3.1 Kích thước & hình dáng
- **Chiều cao tab strip: 40px** (ST khoảng đó; hiện 37px — tăng nhẹ). Tab **không bo góc** ở theme
  Adaptive (theme Default có góc trên bo 3px — chọn Adaptive: vuông, phẳng).
- Tab active = nền `--tab-active` **trùng nền editor** (#303841) → cảm giác tab "dính" liền vào vùng
  soạn thảo. Tab inactive tối hơn (`--tab-inactive` #2a3138). Đây đã đúng hướng, chỉ cần đổi hex.
- **Đường phân tab:** ST dùng khe hở tối 1px giữa các tab (border-right `--border`). Tab active
  **không** có viền phải.
- **Accent trên tab active:** ST Adaptive **không** kẻ vạch xanh trên đỉnh tab. → Bỏ `.tab.active::before`
  (vạch accent) ở theme sublime, hoặc đổi thành đường **dưới đáy trùng nền editor** để "nối". Nếu muốn
  giữ dấu nhận biết, dùng vạch **rất mảnh 1px màu `--accent-orange`** ở đáy (kiểu ST build mới) — tuỳ
  chọn `tabs.active_underline`.
- Padding tab: trái 14px, phải 8px; gap icon–tên 8px. `min-width` ~ 100px, `max-width` 240px, tên
  cắt ellipsis.

### 3.2 Nút đóng & dirty (ST rất đặc trưng)
- Nút đóng ST là **hình tròn nhỏ**, chỉ hiện khi hover tab; hover vào nút → nền tròn `--sel-strong`.
- **File chưa lưu:** thay ✕ bằng **chấm tròn đặc** (●) màu `--fg` (ST dùng chấm trắng-xám, KHÔNG phải
  xanh accent như code hiện tại đang để `--accent`). Hover tab → chấm biến thành ✕ tròn. (Logic CSS
  hiện có gần đúng, chỉ đổi màu chấm sang `--fg-bright`/`--fg`, không dùng xanh.)
- Icon file trên tab: theo setting `tabs.file_icons` (ST mặc định **có** icon nhỏ mờ trên tab — khác
  với sidebar không icon). Giữ icon tab, opacity ~0.85.

### 3.3 Nút "+" và menu tab
- ST có nút "+" nhỏ cuối dải tab để tạo tab mới, và tab tràn thì cuộn. Giữ `tab-new` (＋) và `tab-menu`
  (▾) nhưng style mờ như chrome, hover mới sáng. Không viền trái đậm.

---

## 4. Vùng editor (Monaco) — cấu hình cho giống ST

Trong `baseOptions()` ([editor.js:41](../src/renderer/js/editor.js#L41)), đổi để khớp thói quen ST:

- `theme: 'stp-mariana'` (mặc định).
- **Font:** ST mặc định dùng font hệ thống mono; đặt `fontSize: 13`, `lineHeight: 20` (ST thoáng hơn
  hiện 21 chỉ chút — giữ 20–21). `letterSpacing: 0`.
- `renderLineHighlight: 'line'` (ST chỉ tô nền dòng, không tô cả gutter mạnh) — hiện để `'all'`.
- `cursorBlinking: 'smooth'` + **caret cam** `#f9ae58` (đặc trưng ST). Bề rộng caret 2px.
- `renderWhitespace: 'selection'` (đã đúng).
- `guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false }` — ST vẽ
  indent guide mảnh, **không** vẽ bracket-pair guide màu mè.
- `bracketPairColorization.enabled: false` — ST mặc định KHÔNG tô cặp ngoặc nhiều màu (VSCode mới có).
  Để giống ST, **tắt**; giữ bracket-match highlight (viền teal) thôi.
- `minimap`: bật, `renderCharacters: true`, `showSlider: 'mouseover'`, `maxColumn: 80`. Viewport
  minimap ST tô một khối mờ — Monaco tự lo.
- `scrollbar`: thumb mảnh (mục 8), `verticalScrollbarSize: 12`.
- `stickyScroll.enabled: true` (ST4 có), nhưng nền sticky = `--bg` hơi tối hơn.
- `overviewRulerLanes` giữ để marker git/find hiện bên phải như ST.
- Tắt `renderLineHighlightOnlyWhenFocus` để dòng active luôn thấy.

---

## 5. Command Palette / Quick Panel — dáng ST

ST "quick panel" (Ctrl+P / Ctrl+Shift+P / Goto Symbol) là bộ mặt đặc trưng nhất. Chỉnh
`.palette*` cho khớp:

### 5.1 Hộp & vị trí
- Overlay **không làm mờ nền mạnh**: ST chỉ tối nền nhẹ `rgba(0,0,0,.25)`, **không blur** (bỏ
  `backdrop-filter: blur` để giống ST). Hộp rộng `min(600px, 90vw)`, canh giữa, cách đỉnh ~10vh.
- Nền hộp `--bg-elev`, viền `--border` 1px, bo góc **4px** (ST góc nhỏ, không bo 10px như hiện tại),
  đổ bóng vừa `--shadow`.
- Input: nền tối hơn `--bg-dark`, chữ `--fg-bright` 14px, padding 8px 12px, không viền trong, có 1
  đường ngăn dưới `--border`.

### 5.2 Item danh sách (điểm sai màu quan trọng)
- Item active của ST **KHÔNG** phải nền xanh dương đặc. Đổi `.palette-item.active` từ nền `--accent`
  (#61afef) sang **nền `--sel` (#4f5b66)** + chữ `--fg-bright`. (Hiện đang tô xanh chói — sai so ST.)
- Item **2 dòng** (ST): dòng trên = tên (14px), dòng dưới = đường dẫn/subtitle (11px `--fg-dim`).
  Hiện đang xếp ngang một dòng — đổi sang xếp dọc cho Goto Anything (giữ 1 dòng cho command palette
  nếu muốn, nhưng ST cũng 2 dòng: tên + phím tắt bên phải).
- **Ký tự khớp fuzzy:** ST **tô đậm + màu sáng** (không gạch chân) các ký tự trùng. Đổi
  `.palette-item mark` sang `color: --fg-bright; font-weight: 700; background: transparent`. Trong item
  active vẫn sáng, không đổi thành cam.
- Phím tắt hiển thị bên phải: font mono 11px, màu `--fg-dim`, mỗi phím trong khung nhẹ (tuỳ chọn
  vẽ "kbd" viền mờ).
- Chiều cao item ~ 36px (2 dòng), padding 6px 12px, bo 4px, gap dòng 2px.
- Danh sách cao tối đa ~48vh, cuộn mảnh.

### 5.3 Preview khi di chuyển
- ST mở preview file khi di chuyển trong Ctrl+P (đã ghi ở POLISH_PHASES 10.3) — style không đổi, chỉ
  đảm bảo overlay không che editor phía sau quá tối.

---

## 6. Status bar — thứ tự & tối giản kiểu ST

ST status bar rất phẳng, chữ nhỏ mờ. Sắp lại cho đúng:

- **Chiều cao 22px** (hiện 26 — giảm), nền `--bg-dark`, chữ `--fg-dim` 11px, không viền trên đậm (ST
  gần như liền màu).
- **Bố cục ST:** bên **trái** thường trống hoặc hiện tên/hint; bên **phải** theo thứ tự:
  `Line X, Column Y` · `Spaces: 4` (hoặc `Tab Width: 4`) · `Encoding (UTF-8)` · `Line ending (LF)` ·
  `Language (Plain Text)`. → Sắp `#status-right` đúng thứ tự này (hiện đang lang → pos → indent → eol →
  enc, hơi khác). Git branch để bên trái (ST plugin thường để trái).
- Mọi mục hover sáng lên `--fg-bright`, bấm mở quick panel tương ứng (mục 10 POLISH_PHASES).
- Bỏ gạch chân/màu chói; `IME: fcitx` giữ nhưng tông `--accent-2` nhạt.

---

## 7. Panel Find-in-Files / Output — khớp tông

- Nền panel `--bg-dark`, viền trên `--border`, không đổ bóng mạnh (ST panel phẳng hơn — giảm shadow
  còn `0 -6px 18px rgba(0,0,0,.3)`).
- Toggle nút (Aa / W / .*): khi bật, ST tô nền `--sel` + chữ sáng (KHÔNG nền xanh chói). Sửa
  `.find-toggle.on` từ nền `--accent` sang `--sel`/`--accent` **nhạt**.
- Kết quả find: tên file màu `--accent` (xanh dương ST), số dòng `--fg-dim`, match highlight nền
  `--accent-orange` mờ (`#f9ae5840`) chữ giữ nguyên — ST tô cam nhạt, không vàng.
- Header file/output dùng mono 12px.

---

## 8. Scrollbar — overlay mảnh kiểu ST

- ST scrollbar mảnh, mờ, overlay. Đổi `::-webkit-scrollbar` width/height **10px**, thumb `#3b444d`
  bo 6px, viền 3px trùng nền, hover `#4a5560`, track trong suốt. Thân minimap/editor để Monaco tự vẽ
  nhưng chỉnh `scrollbar` option cùng tông.

---

## 9. Font, khoảng cách & chuyển động (cảm giác tổng thể)

- **Font UI:** ST Linux dùng gần với "Noto Sans"/system — đặt `--font-ui` như 1.2. Cỡ nền body 13px.
- **Font editor:** để người dùng đổi; mặc định mono hệ thống, 13px.
- Bỏ bớt bo góc lớn (ST dùng góc 3–4px ở panel/hộp, KHÔNG 10px).
- **Chuyển động:** ST rất ít animation. Giữ smooth caret + smooth scroll (đã có) nhưng bỏ hiệu ứng
  thừa; tôn trọng `prefers-reduced-motion`.
- **Selection màu:** vùng chọn `#4f5b66` (xanh xám ST), KHÔNG xanh dương chói.

---

## 10. Danh sách sửa cụ thể trong code (checklist đối chiếu)

Đối chiếu với `styles.css`/`editor.js` hiện tại — mỗi dòng là một sửa đổi rõ ràng:

1. `:root` — thay toàn bộ palette One-Dark bằng **Mariana/Adaptive** (mục 1.2). *(sai màu gốc → ưu tiên #1)*
2. `defineTheme('stp-mariana')` — thêm color scheme Mariana cho Monaco (mục 1.1); đặt làm mặc định
   trong `baseOptions()` và trong `settings` mặc định.
3. `.palette-item.active` — nền `--accent` → `--sel`; item 2 dòng cho Goto Anything. *(mục 5.2)*
4. `.palette-item mark` — bỏ màu accent/gạch chân → đậm + `--fg-bright`. *(mục 5.2)*
5. `.palette` — bỏ `backdrop-filter: blur`; overlay `rgba(0,0,0,.25)`; `.palette-box` bo 10px → 4px. *(5.1)*
6. `.tab.active::before` — bỏ vạch xanh (hoặc đổi thành underline cam mảnh tuỳ chọn). *(3.1)*
7. `.tab.dirty …::after` — chấm ● đổi `--accent` → `--fg`/`--fg-bright`. *(3.2)*
8. `.tab-strip` height 37 → 40; `.statusbar` height 26 → 22; thứ tự `#status-right` theo ST. *(3.1, 6)*
9. `.tree-row.active::before` (thanh accent trái) — bỏ ở theme sublime; hàng active nền `--sel`, file
   đang mở chữ sáng. Thêm setting `sidebar.file_icons=false` (ẩn icon → giống ST). *(2.1)*
10. `.find-toggle.on` — nền `--accent` → `--sel`; match mark cam nhạt `#f9ae5840`. *(7)*
11. `baseOptions()` — `bracketPairColorization:false`, `renderLineHighlight:'line'`,
    `guides.bracketPairs:false`, caret cam, `stickyScroll:true`, `showSlider:'mouseover'`. *(4)*
12. `::-webkit-scrollbar` width 12 → 10, thumb `#3b444d`. *(8)*
13. `--sidebar-w` 250 → 240; row tree 24 → 22px, indent 14 → 16px + indent guide. *(2.1)*

---

## 11. Tuỳ chọn theme & khả năng chuyển đổi

- Thêm vào Settings: `"ui_theme": "stp-sublime" | "stp-onedark"` và `"color_scheme": "stp-mariana" |
  …`, live-apply (đã có hạ tầng settings). Mặc định cả hai = Sublime/Mariana.
- Đăng ký thêm vài color scheme "chính chủ" ST để chọn nhanh: **Mariana** (mặc định), **Monokai**
  (nền `#272822`, xanh lá/hồng), **Breakers/Sixteen** — nhưng ưu tiên Mariana trước.
- Adaptive: khi hệ thống sáng, cung cấp biến thể **Mariana Light**/`Breakers` (nền sáng) để
  `prefers-color-scheme` đổi cả chrome (nối mục 12.4 POLISH_PHASES).

---

## 12. Tiêu chí "giống Sublime" (verify)

Sau khi áp mục 10:
1. Chụp `LUMEN_SCREENSHOT` màn hình có: sidebar mở project, 3–4 tab (1 tab dirty), 1 file code đang
   highlight, command palette mở với vài kết quả.
2. Đặt cạnh ảnh ST4 thật (Mariana + Adaptive). Kiểm 5 điểm: **tông nền navy #303841**, **tab active
   liền nền editor không vạch xanh**, **sidebar không icon + hàng chọn xám mờ**, **quick panel item
   active xám không xanh chói**, **caret cam**.
3. `npm test` cho các hàm màu/theme thuần nếu tách được (vd map token → hex).
4. Báo cáo trung thực phần nào đã khớp, phần nào còn lệch (đặc biệt chrome hex của Adaptive không được
   ST công bố chính thức — giá trị ở đây là khớp-thị-giác tốt nhất, tinh chỉnh theo ảnh so sánh).
