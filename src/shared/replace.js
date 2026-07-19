'use strict';

// ===========================================================================
// Pure replacement-template expansion for Find/Replace. Shared between the
// find bar (src/renderer/js/find.js) and node:test. No DOM / Monaco.
//   unescape(tpl)          -> interpret \n \t \r \0 \\ escapes (Sublime-style)
//   expandRepl(tpl, groups)-> expand $1..$99 / $& / $$ and \1..\99 back-refs
//                              against capture groups, then unescape.
//   matchCase(sample, repl)-> mirror ALL-CAPS / lower / Title of `sample`.
// ===========================================================================
(function (root) {
  function unescape(tpl) {
    return String(tpl).replace(/\\([ntr0\\])/g, (m, c) =>
      c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c === '0' ? '\0' : '\\');
  }

  function expandRepl(tpl, groups) {
    const withGroups = String(tpl).replace(/\$(\$|&|\d{1,2})|\\(\d{1,2})/g, (m, p, bs) => {
      if (p === '$') return '$';
      if (p === '&') return groups[0] != null ? groups[0] : '';
      const n = +(p != null ? p : bs);
      return groups[n] != null ? groups[n] : '';
    });
    return unescape(withGroups);
  }

  function matchCase(sample, repl) {
    if (sample === sample.toUpperCase() && sample !== sample.toLowerCase()) return repl.toUpperCase();
    if (sample === sample.toLowerCase()) return repl.toLowerCase();
    if (sample[0] === sample[0].toUpperCase()) return repl.charAt(0).toUpperCase() + repl.slice(1);
    return repl;
  }

  const api = { unescape, expandRepl, matchCase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.LUM = root.LUM || {}; root.LUM.replace = api; }
})(typeof window !== 'undefined' ? window : null);
