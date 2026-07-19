'use strict';

// ===========================================================================
// Pure fuzzy subsequence matcher used by the Command Palette / Goto Anything.
// Shared with node:test. No DOM.
//   fuzzy(query, text) -> { score, positions } | null   (positions index text)
//   scorePath(query, path) -> best of full-path vs basename match (higher =
//     better), so `cli` ranks `client/cli.js` above `client/models.js`.
// ===========================================================================
(function (root) {
  function fuzzy(query, text) {
    if (!query) return { score: 0, positions: [] };
    const q = query.toLowerCase();
    const t = text.toLowerCase();
    let qi = 0, ti = 0, score = 0, prevMatch = -2;
    const positions = [];
    while (qi < q.length && ti < t.length) {
      if (q[qi] === t[ti]) {
        positions.push(ti);
        score += 1;
        if (ti === prevMatch + 1) score += 5;                 // consecutive run
        const camel = ti > 0 && /[a-z0-9]/.test(text[ti - 1] || '') && /[A-Z]/.test(text[ti] || '');
        if (ti === 0 || /[/_\-. ]/.test(t[ti - 1]) || camel) score += 8; // word start
        prevMatch = ti;
        qi++;
      }
      ti++;
    }
    if (qi < q.length) return null;
    score -= (t.length - positions.length) * 0.02;            // slight length penalty
    return { score, positions };
  }

  // Best match across the full label and its basename (a trailing suffix). The
  // basename bonus makes a clean filename match beat an incidental mid-path one.
  function scorePath(query, label) {
    if (!query) return { score: 0, positions: [] };
    let best = fuzzy(query, label);
    const slash = label.lastIndexOf('/');
    if (slash >= 0) {
      const bres = fuzzy(query, label.slice(slash + 1));
      if (bres) {
        const mapped = { score: bres.score + 6, positions: bres.positions.map((p) => p + slash + 1) };
        if (!best || mapped.score > best.score) best = mapped;
      }
    }
    return best;
  }

  const api = { fuzzy, scorePath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.LUM = root.LUM || {}; root.LUM.fuzzy = api; }
})(typeof window !== 'undefined' ? window : null);
