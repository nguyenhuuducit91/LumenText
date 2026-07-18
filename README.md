# Lumen

Trình soạn thảo code nhanh, gọn theo phong cách **Sublime Text**, xây dựng bằng
**Electron + Monaco** (nhân editor của VS Code). Chạy trên **Ubuntu/Linux**, hỗ
trợ **gõ tiếng Việt inline (preedit) qua fcitx5** — không dùng popup.

![icon](build/icons/128x128.png)

## Tính năng

**Core editing**
- Mở / lưu / Save As / Save All, nhiều tab, tab bẩn (dấu ●)
- Syntax highlighting cho ~90 ngôn ngữ (Monaco), theme Monokai mặc định
- **Multiple cursors** (Ctrl+D chọn từ tiếp theo, Ctrl+Shift+L tách dòng)
- Find & Replace (Ctrl+F / Ctrl+H), fold code, format document
- Minimap, tự nhận diện ngôn ngữ & indent, word wrap

**Điều hướng kiểu Sublime**
- **Goto Anything** (Ctrl+P): fuzzy tìm file trong project; hỗ trợ `:dòng` và `@symbol`
- **Command Palette** (Ctrl+Shift+P): chạy mọi lệnh
- **Find in Files** (Ctrl+Shift+F): tìm toàn project, regex/case/whole-word, kết quả nhóm theo file, highlight, click để nhảy
- Goto Line (Ctrl+G), Goto Symbol (Ctrl+R)

**Giao diện**
- Theme **One Dark** cohesive (chrome + editor đồng bộ), tối thiểu ngang Sublime gốc
- Icon theo loại file ở sidebar & tab, tab active có accent, nút ＋/menu tab
- Status bar: đường dẫn, ngôn ngữ, vị trí, indent, encoding, trạng thái IME

**Project & giao diện**
- Sidebar cây thư mục, mở folder như một project (Ctrl+Shift+O)
- Split panes: 1/2/3 cột (Alt+Shift+1/2/3)
- Toggle sidebar (Ctrl+B), toggle minimap, chọn Color Scheme, chọn Syntax
- Status bar: đường dẫn, ngôn ngữ, vị trí con trỏ, indent, trạng thái IME

**Large File Mode (core engine)**
- Mở file **GB → 100GB** không treo, **không nạp vào RAM**
- Streaming + **sparse line-index** (100GB chỉ tốn ~vài MB RAM cho index)
- Virtual scrolling: nhảy tới bất kỳ dòng nào trong hàng chục triệu dòng tức thì
- UTF-8/emoji an toàn, cắt dòng siêu dài để chống cạn bộ nhớ
- Benchmark thực đo: 3.22 GB / 31.8M dòng → index 12.7s, đọc 1 màn hình p50 **12ms**

**Workspace / Session (hot exit)**
- Tự lưu & khôi phục folder, tab, file đang mở, vị trí con trỏ khi mở lại
- Lớp state bền vững (`state.json`, ghi atomic) làm nền cho Settings/Keybindings

**Gõ tiếng Việt (fcitx5)**
- Preedit hiển thị **inline ngay tại con trỏ**, không popup
- Tự set `GTK_IM_MODULE/QT_IM_MODULE/XMODIFIERS=fcitx` khi khởi động
- Bật cờ `enable-wayland-ime` để hoạt động cả trên Wayland

## Phím tắt chính

| Lệnh | Phím |
|---|---|
| New / Open / Save | Ctrl+N / Ctrl+O / Ctrl+S |
| Open Folder | Ctrl+Shift+O |
| Goto Anything (files) | Ctrl+P |
| Command Palette | Ctrl+Shift+P |
| Goto Line / Symbol | Ctrl+G / Ctrl+R |
| Find / Replace (trong file) | Ctrl+F / Ctrl+H |
| **Find in Files** (toàn project) | Ctrl+Shift+F |
| Format Document | Ctrl+Alt+F |
| Add cursor (next match) | Ctrl+D |
| Split into lines | Ctrl+Shift+L |
| Toggle comment | Ctrl+/ |
| Toggle sidebar | Ctrl+B |
| Split 1 / 2 / 3 cột | Alt+Shift+1 / 2 / 3 |
| Bật/tắt gõ tiếng Việt | Ctrl+Space (fcitx) |

## Chạy từ mã nguồn (development)

```bash
npm install
npm start
```

> Nếu `npm install` không tự tải được Electron binary (môi trường chặn
> postinstall), chạy: `node node_modules/electron/install.js` hoặc
> `npm rebuild electron`.

## Kiểm thử & benchmark

```bash
npm test                        # unit test engine file lớn (node:test, 7 cases)
npm run bench                    # tạo file lớn + đo tốc độ index & đọc dòng
node scripts/bench-largefile.js 5120   # benchmark với file 5 GB
```

## Đóng gói cho Ubuntu

```bash
# Tạo icon (nếu chưa có)
node scripts/generate-icon.js

# Đóng gói .deb + AppImage vào thư mục dist/
npm run dist

# Chỉ .deb:       npm run dist:deb
# Chỉ AppImage:   npm run dist:appimage
```

Sản phẩm nằm trong `dist/`:
- `Lumen-0.1.0-x64.deb`
- `Lumen-0.1.0-x64.AppImage`

## Cài đặt trên Ubuntu

**Cách 1 — gói .deb:**
```bash
sudo apt install ./dist/"Lumen-0.1.0-x64.deb"
# sau đó mở từ menu ứng dụng, hoặc: lumen <path>
```

**Cách 2 — AppImage (không cần cài):**
```bash
chmod +x "dist/Lumen-0.1.0-x64.AppImage"
./"dist/Lumen-0.1.0-x64.AppImage"
```

## Gõ tiếng Việt không hoạt động?

1. Cài & bật fcitx5 + engine (Unikey/Bamboo):
   ```bash
   sudo apt install fcitx5 fcitx5-unikey fcitx5-configtool
   fcitx5-configtool   # thêm "Unikey" vào Input Method
   ```
2. Đảm bảo biến môi trường (thêm vào `~/.pam_environment` hoặc `~/.xprofile`):
   ```
   GTK_IM_MODULE=fcitx
   QT_IM_MODULE=fcitx
   XMODIFIERS=@im=fcitx
   ```
3. Đăng nhập lại, nhấn **Ctrl+Space** trong editor để bật bộ gõ.

## Kiến trúc

```
main.js                 # Electron main: cửa sổ, menu, IPC, cờ IME
preload.js              # contextBridge an toàn (window.stp)
src/main/
  store.js              # state.json bền vững (atomic write)
  largefile.js          # engine stream file lớn (sparse index)
src/renderer/
  index.html            # nạp Monaco (AMD loader) + boot app
  styles.css            # theme Monokai cho UI
  js/icons.js           # icon SVG file/folder theo loại
  js/commands.js        # registry lệnh
  js/editor.js          # buffers, panes, tabs, IO, split, route file lớn
  js/largefile.js       # viewer virtual-scroll cho file lớn
  js/sidebar.js         # cây thư mục project
  js/palette.js         # Command Palette / Goto Anything (fuzzy)
  js/findinfiles.js     # Find in Files (panel kết quả)
  js/app.js             # điều phối, keybindings, themes, session restore
test/largefile.test.js  # unit test engine (node:test)
scripts/bench-largefile.js, scripts/generate-icon.js
docs/Architecture.md    # kiến trúc chi tiết
```

Xem [docs/Architecture.md](docs/Architecture.md) để hiểu ranh giới process,
engine file lớn và cơ chế session.

## License
MIT
