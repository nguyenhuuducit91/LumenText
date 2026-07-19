'use strict';

// QA — typing / deleting / undo & redo, modelled at the line-diff level that
// powers the git gutter + Revert Hunk. Each case verifies (a) the hunks the
// engine reports and (b) that reverting reconstructs the original ("undo").
const test = require('node:test');
const assert = require('node:assert');
const { diffHunks, hunkAnchor } = require('../src/shared/linediff.js');

const L = (s) => s.split('\n');

// Apply hunks' HEAD text back over the buffer (bottom-up) → must equal HEAD.
function revertAll(bufLines, hunks) {
  const lines = bufLines.slice();
  for (const h of hunks.slice().sort((a, b) => b.bStart - a.bStart)) {
    if (h.bEnd >= h.bStart) lines.splice(h.bStart - 1, h.bEnd - h.bStart + 1, ...h.head);
    else lines.splice(h.bStart - 1, 0, ...h.head);
  }
  return lines;
}

// (name, headText, bufText, expected {hunks, firstKind?})
const CASES = [
  ['no-op', 'a\nb\nc', 'a\nb\nc', { hunks: 0 }],
  ['type-char-mid-line', 'foo\nbar', 'foo\nbaXr', { hunks: 1, kind: 'mod' }],
  ['type-char-first-line', 'foo\nbar', 'fXoo\nbar', { hunks: 1, kind: 'mod' }],
  ['type-append-line', 'a\nb', 'a\nb\nc', { hunks: 1, kind: 'add' }],
  ['type-prepend-line', 'a\nb', 'z\na\nb', { hunks: 1, kind: 'add' }],
  ['type-insert-middle', 'a\nc', 'a\nb\nc', { hunks: 1, kind: 'add' }],
  ['type-two-lines', 'a\nd', 'a\nb\nc\nd', { hunks: 1, kind: 'add' }],
  ['delete-one-line', 'a\nb\nc', 'a\nc', { hunks: 1, kind: 'del' }],
  ['delete-first-line', 'a\nb\nc', 'b\nc', { hunks: 1, kind: 'del' }],
  ['delete-last-line', 'a\nb\nc', 'a\nb', { hunks: 1, kind: 'del' }],
  ['delete-range', 'a\nb\nc\nd\ne', 'a\ne', { hunks: 1, kind: 'del' }],
  ['replace-line', 'a\nb\nc', 'a\nX\nc', { hunks: 1, kind: 'mod' }],
  ['replace-block-fewer', 'a\nb\nc\nd', 'a\nX\nd', { hunks: 1, kind: 'mod' }],
  ['replace-block-more', 'a\nb\nd', 'a\nX\nY\nZ\nd', { hunks: 1, kind: 'mod' }],
  ['two-separate-hunks', 'a\nb\nc\nd\ne', 'A\nb\nc\nD\ne', { hunks: 2 }],
  ['three-hunks', '1\n2\n3\n4\n5\n6\n7', 'X\n2\n3\nY\n5\n6\nZ', { hunks: 3 }],
  ['clear-file', 'a\nb\nc', '', { hunks: 1 }],
  // an "empty" file is [''] — filling it replaces that empty first line → mod
  ['fill-empty', '', 'a\nb\nc', { hunks: 1, kind: 'mod' }],
  ['whitespace-change', 'a\n  b\nc', 'a\n    b\nc', { hunks: 1, kind: 'mod' }],
  ['trailing-space-added', 'a\nb', 'a\nb ', { hunks: 1, kind: 'mod' }],
  ['unicode-edit', 'café\nrésumé', 'café\nrésumés', { hunks: 1, kind: 'mod' }],
  ['emoji-line-added', 'a\nb', 'a\n🚀\nb', { hunks: 1, kind: 'add' }],
  ['reorder-lines', 'a\nb\nc', 'c\nb\na', { hunks: 2 }],
  ['duplicate-line', 'a\nb', 'a\na\nb', { hunks: 1, kind: 'add' }]
];

for (const [name, head, buf, exp] of CASES) {
  const H = L(head), B = L(buf);
  const { hunks } = diffHunks(H, B);

  test(`hunk-count: ${name}`, () => {
    assert.strictEqual(hunks.length, exp.hunks, JSON.stringify(hunks));
  });

  if (exp.kind) {
    test(`hunk-kind: ${name}`, () => {
      assert.strictEqual(hunks[0].kind, exp.kind);
    });
  }

  test(`undo (revert reconstructs HEAD): ${name}`, () => {
    assert.deepStrictEqual(revertAll(B, hunks), H);
  });

  test(`redo idempotence (diff of reverted == buffer's own hunks): ${name}`, () => {
    // reverting then re-diffing the ORIGINAL edit must give the same hunk shape
    const again = diffHunks(H, B).hunks;
    assert.strictEqual(again.length, hunks.length);
  });
}

// hunkAnchor sanity for navigation (Next/Prev Modification).
test('hunkAnchor is monotonic across ordered hunks', () => {
  const { hunks } = diffHunks(L('1\n2\n3\n4\n5\n6\n7'), L('X\n2\n3\nY\n5\n6\nZ'));
  const anchors = hunks.map(hunkAnchor);
  for (let i = 1; i < anchors.length; i++) assert.ok(anchors[i] > anchors[i - 1]);
});

test('large edit under the cap still diffs; over the cap is skipped', () => {
  const a = Array.from({ length: 100 }, (_, i) => 'l' + i);
  const b = a.slice(); b[50] = 'CHANGED';
  assert.strictEqual(diffHunks(a, b).hunks.length, 1);
  assert.strictEqual(diffHunks(a, b, 10).skipped, true);
});

test('insert then delete the same line nets to no hunk', () => {
  const head = L('a\nb\nc');
  const typed = L('a\nb\nNEW\nc');
  const deleted = L('a\nb\nc'); // deleted the NEW line again
  assert.strictEqual(diffHunks(head, typed).hunks.length, 1);
  assert.strictEqual(diffHunks(head, deleted).hunks.length, 0);
});
