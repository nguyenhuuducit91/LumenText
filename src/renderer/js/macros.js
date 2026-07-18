'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Macros: record typed text (Monaco onDidType) and executed LUM commands, then
// replay them. A pragmatic, real macro that covers the common Sublime workflow
// (type + run editor commands). Recording state shows in the status bar.
// ===========================================================================
LUM.macros = (function () {
  let recording = false;
  let macro = [];
  let disposers = [];

  function indicator() {
    const el = document.getElementById('status-macro');
    if (el) { el.style.display = recording ? '' : 'none'; }
  }

  function attach() {
    detach();
    disposers = LUM.editor.panes.map((p) =>
      p.editor.onDidType((text) => { if (recording) macro.push({ t: 'type', text }); })
    );
  }
  function detach() {
    disposers.forEach((d) => d.dispose());
    disposers = [];
  }

  function start() {
    macro = [];
    recording = true;
    attach();
    indicator();
    LUM.app.toast('Macro: recording… (run commands / type, then stop)');
  }
  function stop() {
    if (!recording) return;
    recording = false;
    detach();
    indicator();
    LUM.app.toast('Macro: recorded ' + macro.length + ' step(s)');
  }
  function toggle() { recording ? stop() : start(); }

  function play() {
    if (recording) stop();
    const ed = LUM.editor.activeEditor();
    if (!ed || !macro.length) { LUM.app.toast('No macro recorded'); return; }
    for (const step of macro) {
      if (step.t === 'type') ed.trigger('macro', 'type', { text: step.text });
      else if (step.t === 'cmd') LUM.commands.run(step.id);
    }
    LUM.app.toast('Macro: played ' + macro.length + ' step(s)');
  }

  // command run hook (registered via LUM.commands.onRun)
  function onCommand(id) {
    if (recording && !id.startsWith('macro.')) macro.push({ t: 'cmd', id });
  }

  function init() {
    LUM.commands.onRun(onCommand);
    indicator();
  }

  return { init, start, stop, toggle, play, get recording() { return recording; } };
})();
