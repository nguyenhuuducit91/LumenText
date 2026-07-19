<div align="center">

<img src="img/icon.png" alt="Lumen" width="96" />

# Lumen

### A fast, lean **Sublime Text-style** code editor.

Built with **Electron + Monaco** (the editor core of VS Code), running on **Ubuntu/Linux**, with **inline Vietnamese input (preedit) via fcitx5** — no popup. Opens files from **a few KB up to 100 GB** without freezing.

![Electron](https://img.shields.io/badge/Electron-33-47848f)
![Monaco](https://img.shields.io/badge/editor-Monaco-0098ff)
![Linux](https://img.shields.io/badge/platform-Ubuntu%20%2F%20Linux-e95420)
![License](https://img.shields.io/badge/license-MIT-blue)
![Made in Vietnam](https://img.shields.io/badge/made%20in-Vietnam%20%F0%9F%87%BB%F0%9F%87%B3-red)

</div>

---

## ✨ Why you'll love Lumen

- ⚡ **Light & fast** — instant startup, minimal UI true to Sublime Text.
- 🎨 **Cohesive One Dark theme** — chrome (sidebar/tab/status) and editor share one color tone.
- 🧭 **Goto Anything** (`Ctrl+P`) — fuzzy-find files across the project; supports `:line` and `@symbol`.
- 🎛️ **Command Palette** (`Ctrl+Shift+P`) — run **every** command from the keyboard.
- 🔍 **Sublime-style Find & Replace** — a search bar at the **bottom of the editor** with regex / case / whole-word / **wrap** / **in-selection** / **highlight**, an input with **history**, **Find / Find Prev / Find All** buttons, and an *"x of N matches"* counter.
- 🗂️ **Find in Files** (`Ctrl+Shift+F`) — search the whole project, results grouped by file, click to jump.
- 🧬 **Multiple cursors** — `Ctrl+D` to add the next occurrence, `Ctrl+Shift+L` to split into lines, `Alt+Shift+↑/↓` to add a caret.
- 🧮 **VS Code-style line tools** — duplicate (`Ctrl+Shift+D`), move (`Ctrl+Shift+↑/↓`), delete line (`Ctrl+Shift+K`), join, sort, permute.
- 🧱 **Code folding**, **format document**, line/block comments, convert case, trim, wrap paragraph.
- 🖼️ **File-type icons in the sidebar** (VS Code-style) and **Sublime-style tabs** — no icon in tabs, italic **preview** tabs, scrollable when there are many tabs.
- 🔠 **Notepad++-style Show Symbol** — show space/tab, **CRLF/LF** at line ends, indent guides.
- 🪟 **Split panes** 1 / 2 / 3 columns, minimap, word wrap, rulers, distraction-free mode.
- 🧰 **Build system + macros** — run build commands, record/playback macros.
- 🧾 **Large File Mode** — open files **GB → 100 GB** without loading them into RAM (streaming + sparse index).
- 🇻🇳 **Inline Vietnamese input** via **fcitx5** — preedit drawn right at the caret, no popup.
- 🔒 **Private** — runs 100% offline, no trackers, no network calls.

---

## 🚀 Install on Ubuntu

**Option 1 — `.deb` package:**
```bash
sudo apt install ./dist/"Lumen-0.1.0-x64.deb"
# then open from the app menu, or: lumen <path>
```

**Option 2 — AppImage (no install needed):**
```bash
chmod +x "dist/Lumen-0.1.0-x64.AppImage"
./"dist/Lumen-0.1.0-x64.AppImage"
```

**Run from source:**
```bash
npm install
npm start          # or: npm run dev  (opens with DevTools)
```

**Uninstall:**
```bash
sudo ./scripts/uninstall.sh          # remove the app, keep your settings
sudo ./scripts/uninstall.sh --purge  # also delete ~/.config/Lumen (settings + session)
```

> If `npm install` can't fetch the Electron binary (a sandbox blocking postinstall),
> run: `node node_modules/electron/install.js` or `npm rebuild electron`.

---

## ⌨️ Keyboard shortcuts

`Ctrl` = `Cmd` on macOS.

### File & window
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+N` | New File | `Ctrl+Shift+N` | New Window |
| `Ctrl+O` | Open File | `Ctrl+Shift+O` | Open Folder |
| `Ctrl+S` | Save | `Ctrl+Shift+S` | Save As |
| `Ctrl+Alt+S` | Save All | `Ctrl+Shift+T` | Reopen Closed File |
| `Ctrl+W` | Close File | `Ctrl+Shift+W` | Close Window |

### Editing
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo | `Ctrl+U` / `Ctrl+Shift+U` | Soft Undo / Redo |
| `Ctrl+X / C / V` | Cut / Copy / Paste | `Ctrl+Shift+V` | Paste and Indent |
| `Ctrl+]` / `Ctrl+[` | Indent / Unindent | `Ctrl+/` | Toggle Comment |
| `Ctrl+Shift+/` | Toggle Block Comment | `Ctrl+Alt+F` | Format Document |
| `Ctrl+Shift+↑ / ↓` | Move Line Up / Down | `Ctrl+Shift+D` | Duplicate Line |
| `Ctrl+Shift+K` | Delete Line | `Ctrl+J` | Join Lines |
| `Ctrl+Enter` | Insert Line After | `Ctrl+Shift+Enter` | Insert Line Before |
| `Ctrl+Shift+[` / `]` | Fold / Unfold | `Ctrl+K Ctrl+0` | Unfold All |
| `F9` / `Ctrl+F9` | Sort Lines / (Case Sens.) | `Ctrl+K Ctrl+U/L` | Upper / Lower Case |

### Selection & multiple cursors
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+D` | Add Next Occurrence | `Alt+F3` | Select All Occurrences |
| `Ctrl+Shift+L` | Split into Lines | `Ctrl+A` | Select All |
| `Alt+Shift+↑ / ↓` | Add Cursor Above / Below | `Ctrl+L` | Expand Selection to Line |
| `Shift+Alt+→ / ←` | Expand / Shrink Selection | `Ctrl+Shift+M` | Expand to Brackets |

### Find
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+F` | Find (bottom bar) | `Ctrl+H` | Replace |
| `F3` / `Shift+F3` | Find Next / Previous | `Ctrl+I` | Incremental Find |
| `Ctrl+F3` / `Ctrl+Shift+F3` | Find Under (word at caret) | `Ctrl+E` | Use Selection for Find |
| `Ctrl+Shift+F` | Find in Files | `F4` / `Shift+F4` | Next / Prev Result |
| `Enter` / `Shift+Enter` | Next / prev match (in Find box) | `Alt+Enter` | Find All (multi-cursor) |

> The replace field interprets `\n`, `\t`, `\1`-style back-refs and `$1` groups.

### Navigation (Goto)
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+P` | Goto Anything (file) | `Ctrl+Shift+P` | Command Palette |
| `Ctrl+G` | Goto Line (`:line:col`) | `Ctrl+R` | Goto Symbol |
| `Ctrl+;` | Goto Word in File | `Ctrl+Shift+R` | Goto Symbol in Project |
| `F12` | Goto Definition (LSP, cross-file) | `Ctrl+M` | Jump to Matching Bracket |
| `Alt+← / →` | Jump Back / Forward | `Ctrl+F2` | Toggle Bookmark |
| `F2` / `Shift+F2` | Next / Prev Bookmark | `Ctrl+. / Ctrl+Shift+.` | Next / Prev Git Modification |

### View & tools
| Shortcut | Action | Shortcut | Action |
|---|---|---|---|
| `Ctrl+B` | Toggle Side Bar | `Alt+Z` | Word Wrap |
| `Alt+Shift+1 / 2 / 3` | Layout 1 / 2 / 3 columns | `Shift+F11` | Distraction Free Mode |
| `Ctrl+= / - / 0` | Font larger / smaller / reset | `Ctrl+,` | Settings |
| `Ctrl+Shift+B` | Build System | `F7` | Re-run Last Build |
| `Ctrl+Alt+Q` / `Ctrl+Alt+Shift+Q` | Record / Playback Macro | `Ctrl+Alt+P` | Quick Switch Project |
| `Alt+1…9` | Select Tab by Index | `Ctrl+PageUp / PageDown` | Previous / Next Tab |
| `Ctrl+Tab` | Cycle Tabs (most-recent) | `Ctrl+Space` | Toggle Vietnamese input (fcitx) |

> Every command is searchable in the **Command Palette** (`Ctrl+Shift+P`), and keys are customizable in **Preferences → Key Bindings**.

---

## 💛 Support the developer

Lumen is **free and open-source**. If it helps you code faster, please consider buying me a coffee — every contribution directly funds new features and fixes. 🙏

<div align="center">

<table>
<tr>
<td align="center"><img src="img/qr-code-bank-donate.png" alt="Bank transfer QR code" width="200" /><br/><b>Bank</b></td>
<td align="center"><img src="img/paypal.png" alt="PayPal QR code" width="200" /><br/><b>PayPal</b></td>
</tr>
</table>

**Scan to donate** · Nguyễn Hữu Đức

</div>

You can also support by ⭐ **starring the repo** and sharing Lumen with friends!

---

## 👤 Author

**Nguyễn Hữu Đức** — Software Developer @ **VIETIS**

- 📧 Email: [nguyenhuuduc.it.91@gmail.com](mailto:nguyenhuuduc.it.91@gmail.com) · [duc.nguyenhuu@vietis.com.vn](mailto:duc.nguyenhuu@vietis.com.vn)
- 📱 Phone / Zalo: **0964 589 910**

Found a bug or have an idea? [Open an issue](https://github.com/nguyenhuuducit91/LumenText/issues) or reach out — feedback is always welcome.

---

## 🧾 Large File Mode

- Opens files **GB → 100 GB** without freezing, **without loading the whole file into RAM**.
- Streaming + a **sparse line index** (a 100 GB file needs only ~a few MB of RAM for the index).
- Virtual scrolling: jump to any line among tens of millions instantly.
- UTF-8 / emoji safe; extremely long lines are split to avoid running out of memory.
- Real benchmark: 3.22 GB / 31.8M lines → index in 12.7s, one screen read p50 **12ms**.

```bash
npm test                              # unit tests for the large-file engine (node:test)
npm run bench                         # generate a big file + measure index & read speed
node scripts/bench-largefile.js 5120  # benchmark with a 5 GB file
```

---

## 📦 Packaging for Ubuntu

```bash
node scripts/generate-icon.js   # generate the icon (if missing)
npm run dist                    # .deb + AppImage → dist/
npm run dist:deb                # .deb only
npm run dist:appimage           # AppImage only
```

Artifacts land in `dist/`: `Lumen-0.1.0-x64.deb`, `Lumen-0.1.0-x64.AppImage`.

---

## 🇻🇳 Vietnamese input not working?

1. Install & enable fcitx5 + an engine (Unikey/Bamboo):
   ```bash
   sudo apt install fcitx5 fcitx5-unikey fcitx5-configtool
   fcitx5-configtool   # add "Unikey" to Input Method
   ```
2. Add the environment variables to `~/.pam_environment` or `~/.xprofile`:
   ```
   GTK_IM_MODULE=fcitx
   QT_IM_MODULE=fcitx
   XMODIFIERS=@im=fcitx
   ```
3. Log back in, then press **Ctrl+Space** in the editor to enable input.

---

## 🗂️ Project structure

```
Lumen/
├── main.js                 # Electron main: window, menu, IPC, IME flags
├── preload.js              # secure contextBridge (window.lumen)
├── src/main/
│   ├── store.js            # durable state.json (atomic write)
│   └── largefile.js        # large-file streaming engine (sparse index)
├── src/renderer/
│   ├── index.html          # loads Monaco (AMD loader) + boots the app
│   ├── styles.css          # One Dark theme for the UI
│   └── js/
│       ├── icons.js        # SVG file/folder icons by type
│       ├── editor.js       # buffers, panes, tabs, IO, split, preview tabs
│       ├── find.js         # Sublime-style Find/Replace bar
│       ├── invisibles.js   # Show Symbol (CRLF/LF, space/tab, guides)
│       ├── palette.js      # Command Palette / Goto Anything (fuzzy)
│       ├── findinfiles.js  # Find in Files (results panel)
│       ├── sidebar.js      # project file tree
│       └── app.js          # orchestration, keybindings, themes, session
├── docs/                   # Architecture.md, menu-design.md
├── test/, scripts/         # unit tests + benchmarks
└── LICENSE                 # MIT
```

See [docs/Architecture.md](docs/Architecture.md) for the process boundaries, large-file engine, and session mechanism; [docs/menu-design.md](docs/menu-design.md) for the Sublime-style menu design.

## 🛠️ Tech

**Electron 33** + **Monaco Editor** (VS Code's core) + **plain JavaScript** (no framework). The large-file engine is hand-written with Node streaming; Vietnamese input runs through **fcitx5** with Monaco's inline preedit.

---

<div align="center">

Made with ♥ in Vietnam · MIT License · © 2026 Nguyễn Hữu Đức

**If Lumen saves you time, a ⭐ and a ☕ go a long way!**

</div>
