'use strict';

// QA — search / replace / regex. Drives the real replacement engine
// (src/shared/replace.js) with capture groups from actual RegExp matches,
// exercising $1/\1 groups, $&/$$, \n\t escapes, preserve-case and Unicode.
const test = require('node:test');
const assert = require('node:assert');
const { unescape, expandRepl, matchCase } = require('../src/shared/replace.js');

// Match `input` with `re`, return Monaco-style groups array [full, g1, g2, …].
function groupsOf(re, input) {
  const m = re.exec(input);
  return m ? Array.from(m) : null;
}

// (name, regex, input, template, expected) — regex-mode replacement of the first match.
const REGEX = [
  ['swap-two', /(\w+),(\w+)/, 'foo,bar', '$2,$1', 'bar,foo'],
  ['swap-newline', /(\w+),(\w+)/, 'foo,bar', '$1\\n$2', 'foo\nbar'],
  ['tab-between', /(\w+) (\w+)/, 'a b', '$1\\t$2', 'a\tb'],
  ['backref-style', /(\w)(\w)/, 'ab', '\\2\\1', 'ba'],
  ['whole-match', /\d+/, 'x42y', '[$&]', '[42]'],
  ['literal-dollar', /x/, 'x', '$$', '$'],
  ['dollar-then-digit-literal', /(a)/, 'a', '$$1', '$1'],
  ['missing-group-empty', /(a)/, 'a', 'x$3y', 'xy'],
  ['group-zero-is-full', /a(b)c/, 'abc', '<$0>', '<abc>'],
  ['crlf-escape', /(a)(b)/, 'ab', '$1\\r\\n$2', 'a\r\n$2'.replace('$2', 'b')],
  ['nested-groups', /((a)(b))/, 'ab', '$2-$3-$1', 'a-b-ab'],
  ['email-parts', /(\w+)@(\w+)\.(\w+)/, 'me@site.com', '$3.$2/$1', 'com.site/me'],
  ['unicode-group', /(\p{L}+)/u, 'café', '<$1>', '<café>'],
  ['emoji-preserved', /(x)/, 'x', '🚀$1🚀', '🚀x🚀'],
  ['backslash-literal', /(a)/, 'a', '$1\\\\end', 'a\\end'],
  ['multi-space-collapse', /(\S+)\s+(\S+)/, 'a    b', '$1 $2', 'a b']
];

for (const [name, re, input, tpl, expected] of REGEX) {
  test(`regex-replace: ${name}`, () => {
    const groups = groupsOf(re, input);
    assert.ok(groups, 'pattern should match');
    assert.strictEqual(expandRepl(tpl, groups), expected);
  });
}

// unescape() alone.
const ESCAPES = [
  ['a\\nb', 'a\nb'],
  ['a\\tb', 'a\tb'],
  ['a\\rb', 'a\rb'],
  ['a\\\\b', 'a\\b'],
  ['no-escapes', 'no-escapes'],
  ['trailing\\', 'trailing\\'],
  ['\\n\\t\\r', '\n\t\r'],
  ['tab\\tand\\nnewline', 'tab\tand\nnewline']
];
for (const [inp, out] of ESCAPES) {
  test(`unescape: ${JSON.stringify(inp)}`, () => assert.strictEqual(unescape(inp), out));
}

// preserve-case.
const CASE = [
  ['HELLO', 'world', 'WORLD'],
  ['hello', 'World', 'world'],
  ['Hello', 'world', 'World'],
  ['HELLO', 'WoRlD', 'WORLD'],
  ['h', 'X', 'x'],
  ['ABC123', 'xyz', 'XYZ'],
  ['MixedCase', 'replacement', 'Replacement']
];
for (const [sample, repl, out] of CASE) {
  test(`matchCase: ${sample} → ${repl}`, () => assert.strictEqual(matchCase(sample, repl), out));
}

// Literal (non-regex) replacement still interprets escapes.
test('literal replace interprets \\n', () => {
  assert.strictEqual(unescape('first\\nsecond'), 'first\nsecond');
});

// Sanity: JS RegExp semantics the find bar relies on (search category).
test('search: case-insensitive flag matches', () => {
  assert.ok(/foo/i.test('a FOO b'));
});
test('search: whole-word boundary', () => {
  assert.ok(/\bcat\b/.test('a cat b'));
  assert.ok(!/\bcat\b/.test('category'));
});
test('search: global match count', () => {
  assert.strictEqual('a.a.a'.match(/a/g).length, 3);
});
test('search: unicode property escape', () => {
  assert.strictEqual('café123'.match(/\p{L}/gu).length, 4);
});
test('search: zero-width match does not hang (guarded by caller)', () => {
  const re = /(?=x)/g; let n = 0, m;
  while ((m = re.exec('xxx')) && n < 10) { n++; re.lastIndex++; }
  assert.ok(n > 0 && n <= 10);
});
