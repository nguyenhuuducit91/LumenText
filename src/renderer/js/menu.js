'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Shared themed context menu (not the OS native menu, so it matches the theme).
// LUM.menu.show(items, x, y) where items = [{label, run, disabled} | {separator}]
// ===========================================================================
LUM.menu = (function () {
  let cur = null;

  function close() {
    if (cur) { cur.remove(); cur = null; }
    document.removeEventListener('mousedown', onDoc, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', close);
  }
  function onDoc(e) { if (cur && !cur.contains(e.target)) close(); }
  function onKey(e) {
    if (!cur) return;
    const items = [...cur.querySelectorAll('.stp-menu-item:not(.disabled)')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[(i + 1) % items.length] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[(i - 1 + items.length) % items.length] || items[0]).focus(); }
    else if (e.key === 'Enter' && document.activeElement.classList.contains('stp-menu-item')) {
      e.preventDefault(); document.activeElement.click();
    }
  }

  function show(items, x, y) {
    close();
    const menu = document.createElement('div');
    menu.className = 'stp-menu';
    items.forEach((it) => {
      if (it.separator) {
        const s = document.createElement('div');
        s.className = 'stp-menu-sep';
        menu.appendChild(s);
        return;
      }
      const el = document.createElement('div');
      el.className = 'stp-menu-item' + (it.disabled ? ' disabled' : '');
      el.tabIndex = it.disabled ? -1 : 0;
      el.textContent = it.label;
      if (it.accel) {
        const a = document.createElement('span');
        a.className = 'stp-menu-accel';
        a.textContent = it.accel;
        el.appendChild(a);
      }
      if (!it.disabled) el.addEventListener('click', () => { close(); if (it.run) it.run(); });
      menu.appendChild(el);
    });
    document.body.appendChild(menu);
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(2, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
    menu.style.top = Math.max(2, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
    cur = menu;
    setTimeout(() => {
      document.addEventListener('mousedown', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      window.addEventListener('blur', close);
    }, 0);
  }

  return { show, close };
})();
