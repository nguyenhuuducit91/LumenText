'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Project symbol index — walk the open folder, extract definitions with a
// lightweight regex, and offer a fuzzy "Goto Symbol in Project" (Ctrl+Shift+R).
// Cached after the first build; invalidated when files are saved.
// ===========================================================================
LUM.symbols = (function () {
  let index = null;          // [{ name, kind, path, rel, line }]
  let building = null;
  let gen = 0;               // bumped by invalidate() to cancel an in-flight build

  const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.go', '.rs', '.py',
    '.java', '.c', '.h', '.cpp', '.hpp', '.cc', '.rb', '.php', '.cs', '.kt', '.swift', '.lua']);

  // capture: [modifiers…] DECLARATOR NAME — modifiers (export/async/static/…) may
  // precede the real declarator keyword, which is what we record as the "kind".
  // Prevents `async function foo` capturing kind=async/name=function.
  const RE = /(?:^|\s)(?:(?:export|default|public|private|protected|static|async|final|abstract)\s+)*(function\*?|class|interface|type|struct|enum|def|func|fn|trait|impl|const|let|var)\s+([A-Za-z_$][\w$]*)/;
  const MD_RE = /^(#{1,6})\s+(.+?)\s*$/;
  const COMMENT_RE = /^\s*(\/\/|\*|\/\*|#(?!!))/;

  function invalidate() { index = null; gen++; } // cancels any in-flight build

  async function build() {
    const roots = LUM.sidebar.roots;
    if (!roots.length) return [];
    if (index) return index;
    if (building) return building;
    const myGen = gen;
    const sep = window.lumen.sep;
    const multi = roots.length > 1;
    building = (async () => {
      const out = [];
      const seen = new Set();
      outer:
      for (const root of roots) {
        const prefix = multi ? window.lumen.basename(root) + '/' : '';
        const files = await window.lumen.walk(root, 8000);
        if (myGen !== gen) return index || []; // invalidated mid-build
        for (const f of files) {
          if (seen.has(f.path)) continue;
          seen.add(f.path);
          const ext = window.lumen.extname(f.name).toLowerCase();
          const isMd = ext === '.md' || ext === '.markdown';
          if (!CODE_EXT.has(ext) && !isMd) continue;
          let content;
          try {
            const st = await window.lumen.stat(f.path);
            if (!st.exists || st.size > 2 * 1024 * 1024) continue;
            content = (await window.lumen.readFile(f.path)).content;
          } catch { continue; }
          if (myGen !== gen) return index || [];
          const rel = prefix + (f.path.startsWith(root + sep) ? f.path.slice(root.length + 1) : f.path);
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length > 400) continue;
            if (isMd) {
              const m = line.match(MD_RE);
              if (m) out.push({ name: m[2].trim(), kind: 'heading', path: f.path, rel, line: i + 1 });
              continue;
            }
            if (COMMENT_RE.test(line)) continue; // skip commented-out declarations
            const m = line.match(RE);
            if (m && m[2] && m[2].length > 1) out.push({ name: m[2], kind: m[1], path: f.path, rel, line: i + 1 });
          }
          if (out.length > 60000) break outer;
        }
      }
      building = null;
      if (myGen !== gen) return index || []; // don't cache a stale build
      index = out;
      return out;
    })();
    return building;
  }

  async function goto() {
    if (!LUM.sidebar.root) { LUM.app.toast('Open a folder to index symbols'); return; }
    LUM.app.toast('Indexing project symbols…');
    const syms = await build();
    if (!syms.length) { LUM.app.toast('No symbols found'); return; }
    const entries = syms.map((s) => ({
      label: s.name,
      sub: s.kind + '  ·  ' + s.rel + ':' + s.line,
      run: () => {
        LUM.nav && LUM.nav.record();
        open(s);
      }
    }));
    LUM.app.inlinePicker(entries, 'Goto Symbol in Project (' + syms.length + ')');
  }

  async function open(s) {
    await LUM.editor.openPath(s.path);
    const ed = LUM.editor.activeEditor();
    if (ed && ed.setPosition) {
      ed.setPosition({ lineNumber: s.line, column: 1 });
      ed.revealLineInCenter(s.line);
      ed.focus();
    }
  }

  return { build, goto, invalidate };
})();
