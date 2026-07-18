'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Build systems + output panel. Runs a shell command in the main process,
// streams stdout/stderr into a bottom panel, reports the exit code, and makes
// "file:line[:col]" references in the output clickable to jump to the location.
// ===========================================================================
LUM.build = (function () {
  let els = null;
  let seq = 1;
  let curId = null;
  let lastCmd = null, lastCwd = null, lastTitle = null;
  let raw = '';

  function grab() {
    if (els) return els;
    els = {
      panel: document.getElementById('output-panel'),
      title: document.getElementById('output-title'),
      status: document.getElementById('output-status'),
      body: document.getElementById('output-body'),
      rerun: document.getElementById('output-rerun'),
      stop: document.getElementById('output-stop'),
      close: document.getElementById('output-close')
    };
    return els;
  }

  function init() {
    grab();
    els.close.addEventListener('click', close);
    els.stop.addEventListener('click', stop);
    els.rerun.addEventListener('click', () => { if (lastCmd) run(lastCmd, lastCwd, lastTitle); });
    window.lumen.onProcData((id, chunk) => { if (id === curId) append(chunk); });
    window.lumen.onProcExit((id, code) => {
      if (id !== curId) return;
      append('\n[exited with code ' + code + ']\n');
      els.status.textContent = code === 0 ? 'done ✓' : 'exit ' + code;
      els.status.className = 'output-status ' + (code === 0 ? 'ok' : 'err');
      curId = null;
      linkify();
    });
  }

  function open() { grab().panel.classList.remove('hidden'); LUM.editor.layout(); }
  function close() { grab().panel.classList.add('hidden'); LUM.editor.layout(); }
  function stop() { if (curId != null) window.lumen.procKill(curId); }

  function append(text) {
    raw += text;
    els.body.appendChild(document.createTextNode(text));
    els.body.scrollTop = els.body.scrollHeight;
  }

  function esc(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

  // Turn file:line[:col] references into clickable links (after the run ends).
  function linkify() {
    const re = /([\w./\\+-]+\.[A-Za-z]{1,6}):(\d+)(?::(\d+))?/g;
    let out = '', last = 0, m;
    while ((m = re.exec(raw)) !== null) {
      out += esc(raw.slice(last, m.index));
      out += `<a class="out-link" data-file="${esc(m[1])}" data-line="${m[2]}" data-col="${m[3] || 1}">${esc(m[0])}</a>`;
      last = m.index + m[0].length;
    }
    out += esc(raw.slice(last));
    els.body.innerHTML = out;
    els.body.querySelectorAll('.out-link').forEach((a) => {
      a.addEventListener('click', () => jump(a.dataset.file, +a.dataset.line, +a.dataset.col));
    });
    els.body.scrollTop = els.body.scrollHeight;
  }

  async function jump(file, line, col) {
    let p = file;
    if (!(window.lumen.platform === 'win32' ? /^[a-zA-Z]:/ : /^\//).test(file)) {
      p = window.lumen.join(lastCwd || LUM.sidebar.root || '.', file);
    }
    const st = await window.lumen.stat(p);
    if (!st.exists) return LUM.app.toast('Not found: ' + p);
    await LUM.editor.openPath(p);
    const ed = LUM.editor.activeEditor();
    if (ed && ed.setPosition) {
      ed.setPosition({ lineNumber: line, column: col || 1 });
      ed.revealLineInCenter(line);
      ed.focus();
    }
  }

  function run(cmd, cwd, title) {
    grab();
    open();
    lastCmd = cmd; lastCwd = cwd; lastTitle = title || cmd;
    raw = '';
    els.body.innerHTML = '';
    els.title.textContent = lastTitle;
    els.status.textContent = 'running…';
    els.status.className = 'output-status';
    append('$ ' + cmd + (cwd ? '   (' + cwd + ')' : '') + '\n\n');
    curId = seq++;
    window.lumen.procRun(curId, cmd, cwd);
  }

  // Build variants from the project + current file, then a custom command.
  async function chooseBuild() {
    const root = LUM.sidebar.root;
    const variants = [];
    if (root) {
      const pkg = await window.lumen.stat(window.lumen.join(root, 'package.json'));
      if (pkg.exists) {
        try {
          const { content } = await window.lumen.readFile(window.lumen.join(root, 'package.json'));
          const scripts = (JSON.parse(content).scripts) || {};
          Object.keys(scripts).forEach((s) =>
            variants.push({ label: 'npm run ' + s, run: () => run('npm run ' + s, root, 'npm run ' + s) }));
        } catch {}
      }
      for (const mk of ['Makefile', 'makefile']) {
        const st = await window.lumen.stat(window.lumen.join(root, mk));
        if (st.exists) { variants.push({ label: 'make', run: () => run('make', root, 'make') }); break; }
      }
    }
    const buf = LUM.editor.activeBuffer();
    if (buf && buf.path && buf.kind === 'text') {
      const ext = window.lumen.extname(buf.path).toLowerCase();
      const dir = window.lumen.dirname(buf.path);
      const runners = { '.js': 'node', '.mjs': 'node', '.py': 'python3', '.sh': 'bash', '.rb': 'ruby', '.go': 'go run', '.ts': 'npx ts-node' };
      if (runners[ext]) {
        const cmd = runners[ext] + ' "' + buf.path + '"';
        variants.push({ label: 'Run current file (' + runners[ext] + ')', run: () => run(cmd, dir, buf.name) });
      }
    }
    variants.push({ label: 'Custom command…', run: promptCustom });
    if (variants.length === 1) return promptCustom();
    LUM.app.inlinePicker(variants, 'Build System');
  }

  function promptCustom() {
    LUM.app.inlineInput('Enter a shell command to run…', (cmd) => {
      if (cmd && cmd.trim()) run(cmd.trim(), LUM.sidebar.root || undefined, cmd.trim());
    });
  }

  function rerun() { if (lastCmd) run(lastCmd, lastCwd, lastTitle); else chooseBuild(); }

  return { init, run, chooseBuild, rerun, stop, open, close };
})();
