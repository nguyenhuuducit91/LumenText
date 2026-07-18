'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { reverse, unique, shuffle, sortStrings } = require('../src/renderer/js/permute');

test('reverse', () => {
  assert.deepStrictEqual(reverse(['a', 'b', 'c']), ['c', 'b', 'a']);
});
test('reverse does not mutate input', () => {
  const src = ['a', 'b'];
  reverse(src);
  assert.deepStrictEqual(src, ['a', 'b']);
});

test('unique keeps first-occurrence order', () => {
  assert.deepStrictEqual(unique(['b', 'a', 'b', 'c', 'a']), ['b', 'a', 'c']);
});

test('shuffle with fixed rnd is deterministic', () => {
  // rnd cycling through fixed values → a predictable permutation
  const seq = [0.9, 0.1, 0.5, 0.3];
  let i = 0;
  const rnd = () => seq[i++ % seq.length];
  const a = shuffle(['1', '2', '3', '4'], rnd);
  const b = shuffle(['1', '2', '3', '4'], (() => { let j = 0; return () => seq[j++ % seq.length]; })());
  assert.deepStrictEqual(a, b); // same rnd stream → same result
  assert.strictEqual(a.length, 4);
  assert.deepStrictEqual([...a].sort(), ['1', '2', '3', '4']); // permutation
});

test('sortStrings case-insensitive', () => {
  assert.deepStrictEqual(sortStrings(['banana', 'Apple', 'cherry'], false), ['Apple', 'banana', 'cherry']);
});
test('sortStrings case-sensitive puts uppercase first', () => {
  assert.deepStrictEqual(sortStrings(['banana', 'Apple', 'cherry'], true), ['Apple', 'banana', 'cherry']);
});
test('sortStrings case-sensitive distinguishes case', () => {
  assert.deepStrictEqual(sortStrings(['b', 'B', 'a', 'A'], true), ['A', 'B', 'a', 'b']);
});
