'use strict';
// ===========================================================================
// Pure list permutations for "Permute Lines / Permute Selections" (Batch A/A2).
// shuffle() takes a rnd()->[0,1) function so tests are deterministic.
// IIFE-wrapped so locals don't collide in the shared classic-script scope.
// ===========================================================================
(function () {
  function reverse(items) {
    return items.slice().reverse();
  }

  // Keep first occurrence order; drop later duplicates.
  function unique(items) {
    const seen = new Set();
    const out = [];
    for (const x of items) {
      if (seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  }

  // Fisher–Yates using an injected rnd (defaults to Math.random in the app).
  function shuffle(items, rnd) {
    const r = typeof rnd === 'function' ? rnd : Math.random;
    const a = items.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function sortStrings(items, caseSensitive) {
    const a = items.slice();
    if (caseSensitive) {
      a.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
    } else {
      a.sort((x, y) => {
        const lx = x.toLowerCase(), ly = y.toLowerCase();
        return lx < ly ? -1 : lx > ly ? 1 : (x < y ? -1 : x > y ? 1 : 0);
      });
    }
    return a;
  }

  const api = { reverse, unique, shuffle, sortStrings };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.LUM = window.LUM || {}; window.LUM.permute = api; }
})();
