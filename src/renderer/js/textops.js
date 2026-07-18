'use strict';
window.LUM = window.LUM || {};

// ===========================================================================
// Text operations bridge (Batch A): applies the pure helpers in
// src/shared/{textcase,permute,wrap}.js onto the active Monaco editor's
// selections. Follows the DEV_REQUIREMENTS multi-selection edit pattern.
// ===========================================================================
LUM.textops = (function () {
  function ed() { return LUM.editor.activeEditor(); }

  // Apply fn(text)->text to each selection; empty selections expand to the
  // word under the caret (matching Sublime's behaviour).
  function applyToSelections(fn) {
    const e = ed(); if (!e) return;
    const model = e.getModel(); if (!model) return;
    const sels = e.getSelections() || [];
    const edits = [];
    for (const sel of sels) {
      let range = sel;
      if (sel.isEmpty()) {
        const w = model.getWordAtPosition(sel.getStartPosition());
        if (!w) continue;
        range = new monaco.Range(sel.startLineNumber, w.startColumn, sel.startLineNumber, w.endColumn);
      }
      edits.push({ range, text: fn(model.getValueInRange(range)), forceMoveMarkers: true });
    }
    if (edits.length) e.executeEdits('stp', edits);
  }

  function applyCase(mode) { applyToSelections((t) => LUM.textcase.toCase(t, mode)); }
  function rot13() { applyToSelections((t) => LUM.textcase.rot13(t)); }

  // The line span the command should act on: the union of the selections, or
  // the whole document if there is no real selection.
  function lineSpan(e, model) {
    const sels = (e.getSelections() || []).filter((s) => !s.isEmpty());
    if (!sels.length) return [1, model.getLineCount()];
    return [
      Math.min(...sels.map((s) => s.startLineNumber)),
      Math.max(...sels.map((s) => s.endLineNumber))
    ];
  }

  // Permute Lines: reverse | unique | shuffle | sort | sortCS
  function permuteLines(op) {
    const e = ed(); if (!e) return;
    const model = e.getModel(); if (!model) return;
    const [startLine, endLine] = lineSpan(e, model);
    const lines = [];
    for (let l = startLine; l <= endLine; l++) lines.push(model.getLineContent(l));
    let out;
    if (op === 'reverse') out = LUM.permute.reverse(lines);
    else if (op === 'unique') out = LUM.permute.unique(lines);
    else if (op === 'shuffle') out = LUM.permute.shuffle(lines);
    else if (op === 'sort') out = LUM.permute.sortStrings(lines, false);
    else if (op === 'sortCS') out = LUM.permute.sortStrings(lines, true);
    else return;
    const range = new monaco.Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
    e.executeEdits('stp', [{ range, text: out.join('\n'), forceMoveMarkers: true }]);
  }

  // Permute Selections: sort | sortCS | reverse | unique | shuffle
  function permuteSelections(op) {
    const e = ed(); if (!e) return;
    const model = e.getModel(); if (!model) return;
    const sels = (e.getSelections() || []).filter((s) => !s.isEmpty());
    if (sels.length < 2) { LUM.app.toast('Select multiple regions first'); return; }
    const ordered = sels.slice().sort((a, b) =>
      a.startLineNumber - b.startLineNumber || a.startColumn - b.startColumn);
    const texts = ordered.map((s) => model.getValueInRange(s));
    let out;
    if (op === 'sort') out = LUM.permute.sortStrings(texts, false);
    else if (op === 'sortCS') out = LUM.permute.sortStrings(texts, true);
    else if (op === 'reverse') out = LUM.permute.reverse(texts);
    else if (op === 'shuffle') out = LUM.permute.shuffle(texts);
    else if (op === 'unique') {
      // replace 2nd+ duplicate occurrences with empty text (deletes them)
      const seen = new Set();
      out = texts.map((t) => { if (seen.has(t)) return ''; seen.add(t); return t; });
    } else return;
    const edits = ordered.map((s, i) => ({ range: s, text: out[i] != null ? out[i] : texts[i], forceMoveMarkers: true }));
    e.executeEdits('stp', edits);
  }

  function wrapParagraph() {
    const e = ed(); if (!e) return;
    const model = e.getModel(); if (!model) return;
    let width = 80;
    try {
      const rulers = e.getOption(monaco.editor.EditorOption.rulers);
      if (rulers && rulers[0]) width = (typeof rulers[0] === 'number' ? rulers[0] : rulers[0].column) || 80;
    } catch { /* keep default */ }
    const sel = e.getSelection();
    if (sel && !sel.isEmpty()) {
      applyToSelections((t) => LUM.wrap.wrapText(t, width));
    } else {
      const text = model.getValue();
      const full = model.getFullModelRange();
      e.executeEdits('stp', [{ range: full, text: LUM.wrap.wrapText(text, width), forceMoveMarkers: true }]);
    }
  }

  return { applyCase, rot13, permuteLines, permuteSelections, wrapParagraph };
})();
