'use strict';
// ===========================================================================
// Pure text-case transforms for the "Convert Case: …" commands (Batch A/A1).
// No DOM/Electron — unit-tested with plain node. Wrapped in an IIFE so its
// locals (api, helpers) don't leak into the shared classic-script global scope
// and collide with other modules' top-level `const`s.
// ===========================================================================
(function () {
  // Split an arbitrary string into word tokens, understanding camelCase,
  // snake_case, kebab-case and whitespace boundaries.
  //   "getUserName" -> ["get","User","Name"]
  //   "HTTPServerID" -> ["HTTP","Server","ID"]
  function tokenize(s) {
    return String(s)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')       // camel hump
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')    // ACRONYMWord -> ACRONYM Word
      .split(/[\s_\-]+/)
      .filter(Boolean);
  }

  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }

  function swapCase(s) {
    let out = '';
    for (const ch of String(s)) {
      const lo = ch.toLowerCase(), up = ch.toUpperCase();
      out += ch === lo && ch !== up ? up : (ch === up && ch !== lo ? lo : ch);
    }
    return out;
  }

  // mode ∈ swap | lowerCamel | upperCamel | snake | kebab
  function toCase(text, mode) {
    if (mode === 'swap') return swapCase(text);
    const words = tokenize(text);
    if (!words.length) return text;
    switch (mode) {
      case 'lowerCamel':
        return words.map((w, i) => (i === 0 ? w.toLowerCase() : cap(w))).join('');
      case 'upperCamel':
        return words.map(cap).join('');
      case 'snake':
        return words.map((w) => w.toLowerCase()).join('_');
      case 'kebab':
        return words.map((w) => w.toLowerCase()).join('-');
      default:
        return text;
    }
  }

  // ROT13 — rotate ASCII letters by 13; non-letters untouched.
  function rot13(text) {
    return String(text).replace(/[a-zA-Z]/g, (c) => {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
  }

  const api = { tokenize, toCase, swapCase, rot13 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.LUM = window.LUM || {}; window.LUM.textcase = api; }
})();
