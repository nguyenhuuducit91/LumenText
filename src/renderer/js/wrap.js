'use strict';
// ===========================================================================
// Pure paragraph reflow for "Wrap Paragraph at Ruler" (Batch A/A5).
// Paragraphs are separated by blank lines; text inside a paragraph is soft-
// wrapped greedily so no line exceeds `width` columns (unless a single word is
// longer than width, which is kept intact on its own line).
// IIFE-wrapped so locals don't collide in the shared classic-script scope.
// ===========================================================================
(function () {
  function wrapParagraph(para, width) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    const lines = [];
    let line = '';
    for (const w of words) {
      if (!line) { line = w; continue; }
      if (line.length + 1 + w.length <= width) line += ' ' + w;
      else { lines.push(line); line = w; }
    }
    if (line) lines.push(line);
    return lines.join('\n');
  }

  // Reflow full text, preserving paragraph boundaries (one or more blank lines).
  function wrapText(text, width) {
    width = width > 0 ? width : 80;
    // Split into paragraphs on blank-line boundaries, preserving the separators.
    const blocks = String(text).split(/(\n[ \t]*\n)/);
    return blocks
      .map((b) => (/^\n[ \t]*\n$/.test(b) ? b : wrapParagraph(b, width)))
      .join('');
  }

  const api = { wrapText, wrapParagraph };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') { window.LUM = window.LUM || {}; window.LUM.wrap = api; }
})();
