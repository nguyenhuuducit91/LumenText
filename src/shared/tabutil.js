'use strict';

// ===========================================================================
// Pure tab helpers — shared between the renderer and node:test. No DOM / Monaco.
// ===========================================================================
(function (root) {
  // After closing `closingId`, which remaining id should become active?
  //   close middle tab  -> the tab to its right
  //   close last tab    -> the tab to its left
  //   (caller keeps the active id unchanged when a non-active tab is closed)
  function pickNeighbor(order, closingId) {
    const pos = order.indexOf(closingId);
    if (pos < 0) return null;
    const rest = order.slice(0, pos).concat(order.slice(pos + 1));
    if (!rest.length) return null;
    return rest[Math.min(pos, rest.length - 1)];
  }

  // Move `fromId` so it lands at `toIndex` within the array (post-removal index).
  function reorder(order, fromId, toIndex) {
    const arr = order.slice();
    const from = arr.indexOf(fromId);
    if (from < 0) return arr;
    arr.splice(from, 1);
    const t = Math.max(0, Math.min(toIndex, arr.length));
    arr.splice(t, 0, fromId);
    return arr;
  }

  // VSCode-style: show basenames, but when two tabs share a basename add the
  // shortest distinguishing trailing path segments ("a/app.js" vs "b/app.js").
  function disambiguateLabels(paths) {
    const segsOf = (p) => String(p || '').replace(/\\/g, '/').split('/').filter(Boolean);
    const all = paths.map(segsOf);
    const labels = all.map((s) => s[s.length - 1] || '');
    const groups = new Map();
    labels.forEach((b, i) => { if (!groups.has(b)) groups.set(b, []); groups.get(b).push(i); });
    for (const [, idxs] of groups) {
      if (idxs.length < 2) continue;
      idxs.forEach((i) => {
        const s = all[i];
        let L = 2;
        for (; L <= s.length; L++) {
          const suf = s.slice(s.length - L).join('/');
          const collides = idxs.some((j) => j !== i && all[j].slice(all[j].length - L).join('/') === suf);
          if (!collides) break;
        }
        labels[i] = s.slice(Math.max(0, s.length - L)).join('/');
      });
    }
    return labels;
  }

  const api = { pickNeighbor, reorder, disambiguateLabels };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.LUM = root.LUM || {}; root.LUM.tabutil = api; }
})(typeof window !== 'undefined' ? window : null);
