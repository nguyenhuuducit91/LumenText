'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { unescape, expandRepl, matchCase } = require('../src/shared/replace.js');

test('unescape interprets \\n \\t \\r \\\\', () => {
  assert.strictEqual(unescape('a\\nb'), 'a\nb');
  assert.strictEqual(unescape('a\\tb'), 'a\tb');
  assert.strictEqual(unescape('a\\\\b'), 'a\\b');
});

test('expandRepl: $1 group with a literal newline escape', () => {
  // find (\w+),(\w+) replace "$1\n$2" against groups ['foo,bar','foo','bar']
  assert.strictEqual(expandRepl('$1\\n$2', ['foo,bar', 'foo', 'bar']), 'foo\nbar');
});

test('expandRepl: \\1 back-ref style', () => {
  assert.strictEqual(expandRepl('\\2-\\1', ['ab', 'a', 'b']), 'b-a');
});

test('expandRepl: $& is the whole match, $$ is a literal dollar', () => {
  assert.strictEqual(expandRepl('[$&]', ['hit']), '[hit]');
  assert.strictEqual(expandRepl('$$1', ['x', 'y']), '$1');
});

test('expandRepl: missing group expands to empty', () => {
  assert.strictEqual(expandRepl('a$3b', ['m', 'g1']), 'ab');
});

test('matchCase mirrors ALL CAPS / lower / Title', () => {
  assert.strictEqual(matchCase('HELLO', 'world'), 'WORLD');
  assert.strictEqual(matchCase('hello', 'World'), 'world');
  assert.strictEqual(matchCase('Hello', 'world'), 'World');
});
