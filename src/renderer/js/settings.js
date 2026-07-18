'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Settings: JSON defaults + user overrides, applied live to all editors.
// Files live under app userData:
//   Default.sublime-settings    (read-only reference, regenerated each open)
//   Preferences.sublime-settings (user-editable; saving it re-applies live)
// ===========================================================================
LUM.settings = (function () {
  const DEFAULTS = {
    font_size: 13,
    font_family: 'JetBrains Mono, Fira Code, Cascadia Code, Ubuntu Mono, monospace',
    font_ligatures: true,
    tab_size: 4,
    translate_tabs_to_spaces: true,
    word_wrap: false,
    theme: 'stp-mariana',
    minimap: true,
    line_numbers: true,
    render_whitespace: 'selection',
    rulers: [],
    highlight_line: true,
    cursor_blink: 'smooth',
    auto_save: 'off',            // 'off' | 'afterDelay' | 'onFocusChange'
    auto_save_delay_ms: 1000
  };

  let current = Object.assign({}, DEFAULTS);
  let userFile = null;
  let defaultFile = null;

  function editorOptions(s) {
    s = s || current;
    return {
      fontSize: s.font_size,
      fontFamily: s.font_family,
      fontLigatures: s.font_ligatures,
      tabSize: s.tab_size,
      insertSpaces: s.translate_tabs_to_spaces,
      wordWrap: s.word_wrap ? 'on' : 'off',
      minimap: { enabled: s.minimap, renderCharacters: true, showSlider: 'mouseover', maxColumn: 80 },
      lineNumbers: s.line_numbers ? 'on' : 'off',
      renderWhitespace: s.render_whitespace,
      rulers: Array.isArray(s.rulers) ? s.rulers : [],
      renderLineHighlight: s.highlight_line ? 'line' : 'none',
      cursorBlinking: s.cursor_blink
    };
  }

  function apply(s) {
    current = s;
    LUM.state.minimap = !!s.minimap;
    const opts = editorOptions(s);
    LUM.editor.panes.forEach((p) => p.editor.updateOptions(opts));
    LUM.editor.buffers.forEach((b) => {
      if (b.model) b.model.updateOptions({ tabSize: s.tab_size, insertSpaces: s.translate_tabs_to_spaces });
    });
    if (s.theme) LUM.app.applyTheme(s.theme);
    if (s.font_family) document.documentElement.style.setProperty('--font-mono', s.font_family);
    LUM.autosave.configure(s.auto_save, s.auto_save_delay_ms);
    if (LUM.editor.updateStatus) LUM.editor.updateStatus();
  }

  // tolerant JSONC: drop /* */ and // comments and trailing commas
  function parseJsonc(text) {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:"'\\])\/\/.*$/gm, '$1')
      .replace(/,(\s*[}\]])/g, '$1')
      .trim();
    return stripped ? JSON.parse(stripped) : {};
  }

  async function ensurePaths() {
    if (userFile) return;
    const template =
      '// User settings — override defaults here. See the left pane for all keys.\n' +
      '{\n  "font_size": 14,\n  "tab_size": 4\n}\n';
    userFile = await window.lumen.configEnsure('Preferences.sublime-settings', template);
    defaultFile = await window.lumen.configWriteDefault(
      'Default.sublime-settings',
      '// Default settings (read-only reference — edit the User pane on the right)\n' +
        JSON.stringify(DEFAULTS, null, 2) + '\n'
    );
  }

  async function load() {
    await ensurePaths();
    let user = {};
    try {
      const { content } = await window.lumen.readFile(userFile);
      user = parseJsonc(content) || {};
    } catch (e) {
      console.warn('settings parse failed, using defaults', e);
      user = {};
    }
    apply(Object.assign({}, DEFAULTS, user));
  }

  // called after any save; re-applies if the settings file changed
  async function reloadIfSettingsFile(filePath) {
    if (filePath && filePath === userFile) {
      try {
        await load();
        LUM.app.toast('Settings applied');
      } catch (e) {
        LUM.app.toast('Settings error: ' + e.message);
      }
    }
  }

  async function openUI() {
    await ensurePaths();
    LUM.editor.setLayout(2);
    LUM.editor.setActivePane(0);
    await LUM.editor.openPath(defaultFile);
    LUM.editor.setActivePane(1);
    await LUM.editor.openPath(userFile);
    const ed = LUM.editor.activeEditor();
    if (ed) ed.focus();
  }

  function get(k) {
    return current[k];
  }

  // Read-modify-write a single key in the user settings file, then re-apply.
  async function set(key, value) {
    await ensurePaths();
    let user = {};
    try {
      const { content } = await window.lumen.readFile(userFile);
      user = parseJsonc(content) || {};
    } catch (e) {
      user = {};
    }
    user[key] = value;
    await window.lumen.writeFile(userFile, JSON.stringify(user, null, 2) + '\n');
    await load();
  }

  return { DEFAULTS, editorOptions, apply, load, openUI, reloadIfSettingsFile, get, set,
    userFilePath: () => userFile };
})();

// ===========================================================================
// Auto-save driven by settings.auto_save.
// ===========================================================================
LUM.autosave = (function () {
  let mode = 'off';
  let delay = 1000;
  let timer = null;

  function configure(m, d) {
    mode = m || 'off';
    delay = d || 1000;
  }
  function notify(buf) {
    if (mode !== 'afterDelay' || !buf || !buf.path || buf.kind !== 'text') return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (buf.dirty) LUM.editor.saveBuffer(buf);
    }, delay);
  }
  function saveAllDirty() {
    LUM.editor.order.forEach((id) => {
      const b = LUM.editor.buffers.get(id);
      if (b && b.dirty && b.path && b.kind === 'text') LUM.editor.saveBuffer(b);
    });
  }
  function onBlur() {
    if (mode === 'onFocusChange') saveAllDirty();
  }
  function init() {
    window.addEventListener('blur', onBlur);
  }
  return { configure, notify, init, get mode() { return mode; } };
})();
