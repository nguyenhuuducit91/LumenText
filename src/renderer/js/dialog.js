'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Async themed modal dialog — replaces window.confirm/alert/prompt.
// LUM.dialog.confirm({message, detail, buttons:[{label,value,kind}], default, cancel})
//   -> Promise<value>. Keyboard: Enter=default, Esc=cancel, focus-trapped.
// ===========================================================================
LUM.dialog = (function () {
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function confirm(opts) {
    const buttons = opts.buttons || [{ label: 'OK', value: true }];
    const def = 'default' in opts ? opts.default : (buttons[0] && buttons[0].value);
    const cancel = 'cancel' in opts ? opts.cancel : null;
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'stp-modal';
      overlay.innerHTML =
        '<div class="stp-modal-box" role="dialog" aria-modal="true">' +
        '<div class="stp-modal-msg">' + esc(opts.message) + '</div>' +
        (opts.detail ? '<div class="stp-modal-detail">' + esc(opts.detail) + '</div>' : '') +
        '<div class="stp-modal-btns"></div></div>';
      const btnBox = overlay.querySelector('.stp-modal-btns');

      function done(v) {
        overlay.remove();
        document.removeEventListener('keydown', onKey, true);
        const ed = LUM.editor && LUM.editor.activeEditor && LUM.editor.activeEditor();
        if (ed) ed.focus();
        resolve(v);
      }
      const btnEls = buttons.map((b) => {
        const el = document.createElement('button');
        el.className = 'stp-modal-btn' + (b.value === def ? ' default' : '') + (b.kind === 'danger' ? ' danger' : '');
        el.textContent = b.label;
        el.addEventListener('click', () => done(b.value));
        btnBox.appendChild(el);
        return el;
      });
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); done(cancel); }
        else if (e.key === 'Enter') { e.preventDefault(); done(def); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const i = btnEls.indexOf(document.activeElement);
          const next = (i + (e.shiftKey ? -1 : 1) + btnEls.length) % btnEls.length;
          btnEls[next].focus();
        }
      }
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      const focusEl = overlay.querySelector('.stp-modal-btn.default') || btnEls[0];
      if (focusEl) focusEl.focus();
    });
  }

  function alert(message, detail) {
    return confirm({ message, detail, buttons: [{ label: 'OK', value: true }], default: true, cancel: true });
  }

  return { confirm, alert };
})();
