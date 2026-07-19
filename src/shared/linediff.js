'use strict';

// ===========================================================================
// Pure LCS line diff → contiguous hunks. Shared between the renderer git gutter
// (src/renderer/js/git.js) and node:test. No DOM / Monaco dependency.
//
// diffHunks(aLines, bLines, maxLines?) -> { hunks, skipped }
//   a = HEAD lines, b = current-buffer lines
//   hunk = { kind:'add'|'del'|'mod', bStart, bEnd, head:[] }
//     bStart..bEnd : 1-based buffer lines changed (bEnd < bStart ⇒ pure deletion)
//     head[]       : the HEAD lines this hunk replaced (empty for a pure add)
// ===========================================================================
(function (root) {
  const DEFAULT_MAX = 4000;

  function diffHunks(aLines, bLines, maxLines) {
    const cap = maxLines || DEFAULT_MAX;
    const n = aLines.length, m = bLines.length;
    if (n > cap || m > cap) return { hunks: [], skipped: true };

    // LCS length table (row-reversed so backtracking walks forward).
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const ops = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (aLines[i] === bLines[j]) { ops.push('eq'); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push('del'); i++; }
      else { ops.push('ins'); j++; }
    }
    while (i < n) { ops.push('del'); i++; }
    while (j < m) { ops.push('ins'); j++; }

    const hunks = [];
    let ai = 0, bi = 0, k = 0;
    while (k < ops.length) {
      if (ops[k] === 'eq') { ai++; bi++; k++; continue; }
      const aStart = ai, bStart = bi;
      let dels = 0, ins = 0;
      while (k < ops.length && ops[k] !== 'eq') {
        if (ops[k] === 'del') { ai++; dels++; } else { bi++; ins++; }
        k++;
      }
      hunks.push({
        kind: (dels && ins) ? 'mod' : ins ? 'add' : 'del',
        bStart: bStart + 1,
        bEnd: bi,
        head: aLines.slice(aStart, ai)
      });
    }
    return { hunks, skipped: false };
  }

  // The gutter line a hunk anchors to (deletions render on the line above).
  function hunkAnchor(h) {
    return h.bEnd >= h.bStart ? h.bStart : Math.max(1, h.bStart - 1);
  }

  const api = { diffHunks, hunkAnchor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.LUM = root.LUM || {}; root.LUM.linediff = api; }
})(typeof window !== 'undefined' ? window : null);
