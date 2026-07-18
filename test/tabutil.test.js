'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { pickNeighbor, reorder, disambiguateLabels } = require('../src/shared/tabutil.js');

test('pickNeighbor: closing middle tab selects the right neighbour', () => {
  assert.strictEqual(pickNeighbor([1, 2, 3, 4], 2), 3);
});
test('pickNeighbor: closing the last tab selects the left neighbour', () => {
  assert.strictEqual(pickNeighbor([1, 2, 3, 4], 4), 3);
});
test('pickNeighbor: closing the first tab selects the new first', () => {
  assert.strictEqual(pickNeighbor([1, 2, 3], 1), 2);
});
test('pickNeighbor: single/absent → null', () => {
  assert.strictEqual(pickNeighbor([9], 9), null);
  assert.strictEqual(pickNeighbor([1, 2], 5), null);
});

test('reorder: move first to index 2', () => {
  assert.deepStrictEqual(reorder([1, 2, 3, 4], 1, 2), [2, 3, 1, 4]);
});
test('reorder: move last to front', () => {
  assert.deepStrictEqual(reorder([1, 2, 3], 3, 0), [3, 1, 2]);
});
test('reorder: move to same place is stable-ish', () => {
  assert.deepStrictEqual(reorder([1, 2, 3], 2, 1), [1, 2, 3]);
});
test('reorder: clamps out-of-range index', () => {
  assert.deepStrictEqual(reorder([1, 2, 3], 1, 99), [2, 3, 1]);
});
test('reorder: unknown id returns a copy unchanged', () => {
  assert.deepStrictEqual(reorder([1, 2, 3], 8, 0), [1, 2, 3]);
});

test('disambiguateLabels: unique basenames stay bare', () => {
  assert.deepStrictEqual(disambiguateLabels(['/a/main.js', '/a/util.js']), ['main.js', 'util.js']);
});
test('disambiguateLabels: duplicates get one distinguishing parent', () => {
  assert.deepStrictEqual(disambiguateLabels(['/a/app.js', '/b/app.js']), ['a/app.js', 'b/app.js']);
});
test('disambiguateLabels: extends until unique', () => {
  assert.deepStrictEqual(
    disambiguateLabels(['/x/a/app.js', '/y/a/app.js']),
    ['x/a/app.js', 'y/a/app.js']
  );
});
test('disambiguateLabels: mixed group', () => {
  const out = disambiguateLabels(['/proj/src/index.ts', '/proj/test/index.ts', '/proj/readme.md']);
  assert.deepStrictEqual(out, ['src/index.ts', 'test/index.ts', 'readme.md']);
});
