'use strict';

// QA — tabs: reorder (drag), neighbour-selection on close, and duplicate-name
// disambiguation. Pure logic in src/shared/tabutil.js.
const test = require('node:test');
const assert = require('node:assert');
const { pickNeighbor, reorder, disambiguateLabels } = require('../src/shared/tabutil.js');

// reorder invariants: exhaustive over a 5-tab strip.
const BASE = [1, 2, 3, 4, 5];
for (const id of BASE) {
  for (let to = 0; to <= BASE.length; to++) {
    test(`reorder invariants: move ${id} → ${to}`, () => {
      const out = reorder(BASE, id, to);
      assert.strictEqual(out.length, BASE.length, 'length preserved');
      assert.strictEqual(new Set(out).size, BASE.length, 'no duplicates/drops');
      assert.ok(out.includes(id), 'moved id still present');
      // relative order of the untouched tabs is preserved
      const rest = out.filter((x) => x !== id);
      const baseRest = BASE.filter((x) => x !== id);
      assert.deepStrictEqual(rest, baseRest, 'other tabs keep their order');
    });
  }
}

test('reorder: unknown id is a no-op copy', () => {
  assert.deepStrictEqual(reorder(BASE, 99, 0), BASE);
  assert.notStrictEqual(reorder(BASE, 99, 0), BASE); // returns a copy
});

// pickNeighbor: closing each position in a 5-tab strip.
const NEIGHBOR = [
  [[1, 2, 3, 4, 5], 1, 2],
  [[1, 2, 3, 4, 5], 2, 3],
  [[1, 2, 3, 4, 5], 3, 4],
  [[1, 2, 3, 4, 5], 4, 5],
  [[1, 2, 3, 4, 5], 5, 4],
  [[7], 7, null],
  [[1, 2], 1, 2],
  [[1, 2], 2, 1],
  [[1, 2, 3], 8, null]
];
for (const [order, close, expect] of NEIGHBOR) {
  test(`pickNeighbor([${order}], ${close}) → ${expect}`, () => {
    assert.strictEqual(pickNeighbor(order, close), expect);
  });
}

// disambiguateLabels: many duplicate-name scenarios.
const DISAMBIG = [
  [['/a/main.js', '/a/util.js'], ['main.js', 'util.js']],
  [['/a/app.js', '/b/app.js'], ['a/app.js', 'b/app.js']],
  [['/x/a/app.js', '/y/a/app.js'], ['x/a/app.js', 'y/a/app.js']],
  [['/proj/src/index.ts', '/proj/test/index.ts', '/proj/readme.md'], ['src/index.ts', 'test/index.ts', 'readme.md']],
  [['/only/one.js'], ['one.js']],
  [[], []],
  [['/a/b/c/x.js', '/a/b/d/x.js'], ['c/x.js', 'd/x.js']],
  [['/win\\proj\\a.js', '/win\\proj2\\a.js'], ['proj/a.js', 'proj2/a.js']],
  [['/p/index.js', '/q/index.js', '/r/main.js'], ['p/index.js', 'q/index.js', 'main.js']]
];
for (let i = 0; i < DISAMBIG.length; i++) {
  const [paths, expect] = DISAMBIG[i];
  test(`disambiguateLabels #${i}`, () => {
    assert.deepStrictEqual(disambiguateLabels(paths), expect);
  });
}

test('disambiguate: three-way same basename all get distinct labels', () => {
  const out = disambiguateLabels(['/a/x/f.js', '/b/y/f.js', '/c/z/f.js']);
  assert.strictEqual(new Set(out).size, 3);
  out.forEach((l) => assert.ok(l.endsWith('f.js')));
});

test('select-tab-by-index math (Alt+1..9): index 9 = last', () => {
  const order = [10, 20, 30];
  const byIndex = (n) => (n >= 9 ? order[order.length - 1] : order[Math.min(n, order.length) - 1]);
  assert.strictEqual(byIndex(1), 10);
  assert.strictEqual(byIndex(2), 20);
  assert.strictEqual(byIndex(9), 30);
  assert.strictEqual(byIndex(5), 30); // clamps to last when fewer tabs
});

test('positional next/prev tab wraps (Ctrl+PageDown/Up)', () => {
  const order = [1, 2, 3];
  const step = (cur, dir) => order[(order.indexOf(cur) + dir + order.length) % order.length];
  assert.strictEqual(step(3, 1), 1);  // next wraps to first
  assert.strictEqual(step(1, -1), 3); // prev wraps to last
  assert.strictEqual(step(1, 1), 2);
});
