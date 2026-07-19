# Sublime Text Fidelity Audit — pixel/interaction, scored

> **Reviewer:** Sublime Text dev team (uncompromising). **Reference:** ST4 build 4200,
> Mariana color scheme + Adaptive theme + default `Preferences.sublime-settings`
> (values extracted verbatim from `/opt/sublime_text/Packages/*`).
> **Rule:** any behavior different from Sublime is a defect. Exact fix named per item.
> **Correction to a prior claim:** the orange caret `#F9AE58` IS the real Mariana caret —
> Lumen is correct here (earlier suspicion withdrawn).

**Overall score: 6.6 / 10.** The colors that matter most (background, caret, string,
number, keyword, comment) are pixel-exact. The misses are: current-line-highlight default,
caret animation/width, tab metrics, sidebar heading casing, and TextMate-scope granularity
(a Monaco-vs-ST engine limit).

---

## Scorecard

| # | Item | ST (exact) | Lumen (exact) | Score | Verdict |
|---|---|---|---|---:|---|
| 1 | Editor background | `#303841` | `#303841` | 10 | ✅ exact |
| 2 | Editor foreground | `#D8DEE9` | `#d8dee9` | 10 | ✅ exact |
| 3 | Caret color | `#F9AE58` | `#f9ae58` | 10 | ✅ exact |
| 4 | Caret width | 1px (`caret_extra_width:1`) | `cursorWidth: 2` | 5 | ❌ 2px too thick |
| 5 | Caret blink/animation | `caret_style:"solid"` (hard, no fade); caret **jumps** (no position glide) | `cursorBlinking:'smooth'` (fade) + `cursorSmoothCaretAnimation:'on'` (glides) | 3 | ❌ ST does neither |
| 6 | Current-line highlight | `highlight_line:false` (only gutter) | `renderLineHighlight:'line'` (full line bg) | 3 | ❌ wrong default |
| 7 | Selection fill | `#596673` @0.70 | `#4f5b66` (solid) | 7 | 🟡 ~close, no alpha, no border |
| 8 | Inactive selection | `#596673` @0.70 (same as active) | `#404b54` (dimmer) | 6 | 🟡 dimmed |
| 9 | Active indent guide | `#5FB4B4` teal — **and only if `draw_active` set** (default: normal only) | `#5c6773` gray, always highlighted | 5 | ❌ color + default wrong |
| 10 | Bracket match | underline, `#F9AE58` | box border, `#5fb3b3` teal | 4 | ❌ style + color |
| 11 | Syntax: comment | `#A6ACB9`, **not italic** | `#a6acb9` **italic** | 8 | 🟡 color exact, italic wrong |
| 12 | Syntax: string | `#99C794` | `#99c794` | 10 | ✅ exact |
| 13 | Syntax: number | `#F9AE58` | `#f9ae58` | 10 | ✅ exact |
| 14 | Syntax: keyword | `#C695C6` | `#c594c5` | 9 | ✅ ~exact (±1) |
| 15 | Syntax: storage (const/let/var) | `#EC5F66` red | `#c594c5` pink (Monaco lumps into keyword) | 4 | ❌ engine limit |
| 16 | Syntax: constant.language | `#EC5F66` italic | `#f9ae58` orange | 4 | ❌ |
| 17 | Syntax: operator | `#F97B58` salmon | `#5fb3b3` teal | 3 | ❌ |
| 18 | Syntax: function name (def) | `#5FB4B4` teal | `#6699cc` blue | 5 | 🟡 (matches ST *call* color, not *def*) |
| 19 | Syntax: member variable / parameter | `#EC5F66` / `#F9AE58` | `#d8dee9` default fg | 4 | ❌ engine limit |
| 20 | Tag | `#EC5F66` | `#ec5f67` | 9 | ✅ ~exact |
| 21 | Tab height | 32px (rounded) | 40px | 5 | ❌ +8px |
| 22 | Tab label font | 11px | 12.5px | 6 | ❌ +1.5px |
| 23 | Tab padding | `[16,5,11,4]` | `0 8 0 14` | 6 | 🟡 L/R swapped-ish |
| 24 | Tab shape / overlap | rounded, `tab_overlap:10`, connector | flat rects, border-right, no overlap | 5 | ❌ different silhouette |
| 25 | Tab close button | always visible @0.5 opacity, smoothstep speed 4 | hidden until hover | 5 | ❌ hover-only |
| 26 | Preview/transient tab | italic | italic | 10 | ✅ |
| 27 | Sidebar heading (project) | 13px **bold, mixed-case** ("LumenText") | 10.5px **UPPERCASE** + letter-spacing | 4 | ❌ ST never uppercases |
| 28 | Sidebar label font | 12px | 13px | 7 | 🟡 +1px |
| 29 | Sidebar indent | 12px (`indent:12`) | 14px | 7 | 🟡 +2px |
| 30 | Sidebar row selected tint | white @0.18 | `#4f5b66` solid | 7 | 🟡 |
| 31 | Quick panel dim / blur | dim, **no blur** | `rgba(0,0,0,.25)`, no blur | 10 | ✅ |
| 32 | Quick panel row height | `[6,4,6,4]` | `6 12 6 12` | 8 | 🟡 wider L/R |
| 33 | Quick panel label font | 13px | 13px | 10 | ✅ |
| 34 | Quick panel selected row | white @0.15 (subtle) | `#4f5b66` solid muted | 6 | 🟡 heavier |
| 35 | Status bar font | 11px | 11px | 10 | ✅ exact |
| 36 | Status bar height | ~20–22 (8px margins + 11px) | 22px | 9 | ✅ |
| 37 | Default font size (Linux) | 10, `font_face:"Monospace"` | 13–14, Menlo→DejaVu | 5 | ❌ deliberate deviation |
| 38 | Indent default | `translate_tabs_to_spaces:false` (tabs) | `true` (spaces) | 5 | ❌ ST inserts tabs |
| 39 | Word wrap default | `"auto"` | `off` | 7 | 🟡 |
| 40 | Mouse: click/dbl/triple/drag | ✅ | ✅ (Monaco) | 9 | ✅ |
| 41 | Mouse: middle-drag column select | ✅ | ❌ missing | 3 | ❌ |
| 42 | Keyboard/shortcuts parity | baseline | ~90%, macro `Ctrl+Alt+Q` now **matches ST** | 8 | 🟡 missing focus-group/F11/chord |
| 43 | Menu structure | baseline | close parity | 8 | 🟡 |

---

## Exact fixes (file → change)

### A. Caret & line-highlight & guides — `src/renderer/js/editor.js` `baseOptions()` (~L43–72)
```diff
- cursorBlinking: 'smooth',
- cursorSmoothCaretAnimation: 'on',
- cursorWidth: 2,
+ cursorBlinking: 'blink',              // ST caret_style "solid" → hard blink, no fade
+ cursorSmoothCaretAnimation: 'off',    // ST caret JUMPS; it never glides
+ cursorWidth: 1,                       // ST caret_extra_width 1
...
- renderLineHighlight: 'line',
+ renderLineHighlight: 'gutter',        // ST highlight_line:false, highlight_gutter:true
...
- guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
+ guides: { indentation: true, highlightActiveIndentation: false, bracketPairs: false }, // ST default draws normal guides only
```
> Note (#38): `insertSpaces` in `baseOptions` and `settings.js` `translate_tabs_to_spaces` should be `false` for exact ST default. Many teams keep spaces on purpose — flag, don't silently change.

### B. Theme colors — `src/renderer/js/app.js` `defineThemes()` `stp-mariana` (~L46–80)
```diff
- 'editor.selectionBackground': '#4f5b66',
- 'editor.inactiveSelectionBackground': '#404b54',
+ 'editor.selectionBackground': '#596673b3',       // #596673 @ 0.70 (ST blue2)
+ 'editor.inactiveSelectionBackground': '#596673b3',// ST inactive == active
+ 'editor.selectionHighlightBorder': '#647382',    // ST selection_border blue4
...
- 'editorIndentGuide.activeBackground1': '#5c6773',
+ 'editorIndentGuide.activeBackground1': '#5fb4b4', // ST active_guide teal (if active guides kept)
...
- 'editorBracketMatch.border': '#5fb3b3',
+ 'editorBracketMatch.border': '#f9ae58',           // ST brackets_foreground orange (underline unavailable in Monaco → color only)
```

### C. Syntax rules — `src/renderer/js/app.js` `stp-mariana.rules` (~L25–45)
Adjust the Monaco tokens that ARE emitted (const/let/var can't be split from keyword — engine limit, note it):
```diff
- { token: 'comment', foreground: 'a6acb9', fontStyle: 'italic' },
+ { token: 'comment', foreground: 'a6acb9' },                 // ST comment not italic
- { token: 'keyword.operator', foreground: '5fb3b3' },
- { token: 'operator', foreground: '5fb3b3' },
+ { token: 'keyword.operator', foreground: 'f97b58' },        // ST operators salmon
+ { token: 'operator', foreground: 'f97b58' },
+ { token: 'delimiter', foreground: 'd8dee9' },               // keep punctuation as fg
- { token: 'storage', foreground: 'c594c5' },
+ { token: 'storage', foreground: 'ec5f66' },                 // ST storage red
- { token: 'constant.language', foreground: 'f9ae58' },
+ { token: 'constant.language', foreground: 'ec5f66', fontStyle: 'italic' },
- { token: 'function', foreground: '6699cc' },
+ { token: 'function', foreground: '5fb4b4' },                // ST entity.name.function teal
+ { token: 'variable.function', foreground: '6699cc' },       // function CALL blue
```
> **Engine limit (cannot be pixel-exact without replacing the tokenizer):** Monaco's Monarch
> grammars emit coarse tokens — `const/let/var` are `keyword`, member variables and parameters
> are plain `variable`. ST's TextMate grammar distinguishes them. Full parity needs
> `monaco-textmate` + the real `.tmLanguage` grammars (architectural — out of scope for a color tweak).

### D. Tabs — `src/renderer/styles.css`
```diff
.tab-strip { ... height: 40px; }          → height: 32px;            /* ST tab_height 32 */
.tab { ... padding: 0 8px 0 14px; font-size: 12.5px; }
                                            → padding: 0 11px 0 16px; font-size: 11px;  /* ST content_margin [16,_,11,_], font_size_sm 11 */
.tab .tab-close { color: transparent; }    → color: var(--fg-dim); opacity: .5;        /* ST close always visible @0.5 */
.tab:hover .tab-close { ... }              → .tab .tab-close:hover { opacity: .9; }     /* ST hover 0.9, smoothstep */
```
> Rounded overlapping tabs with connectors (ST `tab_overlap:10`) are a different silhouette;
> approximate with a small negative margin + matching radius, or accept the flat style as a deliberate look.

### E. Sidebar heading casing — `src/renderer/js/sidebar.js` + `src/renderer/styles.css`
```diff
// sidebar.js refreshLabel(): remove the forced upper-case (ST shows "LumenText", not "LUMENTEXT")
- setLabel(roots[0] ? window.lumen.basename(roots[0]).toUpperCase() : 'NO FOLDER OPEN');
+ setLabel(roots[0] ? window.lumen.basename(roots[0]) : 'No folder open');
// also project.js updateLabel() and sidebar.renderRootHeader() drop .toUpperCase()
```
```diff
/* styles.css .sidebar-header */
- font-size: 10.5px; letter-spacing: .1em; ... text-transform: uppercase;
+ font-size: 13px; font-weight: 700;        /* ST sidebar_heading font_size_lg 13, bold, mixed-case */
/* .tree-row */
- font-size: 13px;   → font-size: 12px;      /* ST sidebar_label 12 */
```
```diff
// sidebar.js renderDir(): indent 14 → 12 (ST indent:12)
- row.style.paddingLeft = 6 + depth * 14 + 'px';
+ row.style.paddingLeft = 6 + depth * 12 + 'px';
```

### F. Font default (optional, strict-ST) — `src/renderer/js/settings.js` DEFAULTS
```diff
- font_size: 13,
- font_family: 'JetBrains Mono, Fira Code, Cascadia Code, Ubuntu Mono, monospace',
+ font_size: 10,                     // ST Linux default (small; consider 12 as a compromise)
+ font_family: 'Monospace, DejaVu Sans Mono, monospace',
```
> `10px` is ST-exact but hard to read on modern displays — recommend `12` as the pragmatic middle, and document the deviation.

### G. Mouse: middle-drag column select — `src/renderer/js/editor.js`
Add a middle-button drag handler on each pane host that synthesizes Monaco column
(rectangular) selection (Monaco: `Shift+Alt+drag` / `editor.updateOptions({ columnSelection })`),
mapping ST's middle-mouse-drag gesture.

---

## What is already Sublime-exact (keep, don't touch)
Background, foreground, **caret color**, string/number/keyword/comment(color)/tag colors,
quick-panel no-blur dim, status-bar 11px font, preview-tab italic, macro `Ctrl+Alt+Q`,
selection ≈ (within 2 rgb of exact), no bracket-pair rainbow (`bracketPairColorization:false`).

## Priority to raise the score
1. **#6 line-highlight `'gutter'`** + **#5 caret `blink`/no-glide/1px** — biggest "feels like ST" wins, 2-line edit.
2. **#27 sidebar heading casing** — the most visible chrome error ("LUMENTEXT" vs "LumenText").
3. **#21–25 tab metrics** — height 32, font 11, close-always-visible.
4. **#7/#9/#10 selection alpha, guide teal, bracket orange** — theme value edits.
5. **#15–19 syntax scopes** — partial via token tweaks; full parity needs `monaco-textmate`.
