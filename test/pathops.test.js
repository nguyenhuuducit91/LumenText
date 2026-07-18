'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { splitName, dedupeName, validateName } = require('../src/shared/pathops');

test('splitName: plain file splits stem/ext', () => {
  assert.deepStrictEqual(splitName('app.js'), { stem: 'app', ext: '.js' });
});
test('splitName: no extension', () => {
  assert.deepStrictEqual(splitName('Makefile'), { stem: 'Makefile', ext: '' });
});
test('splitName: dotfile keeps leading dot in stem', () => {
  assert.deepStrictEqual(splitName('.gitignore'), { stem: '.gitignore', ext: '' });
});
test('splitName: multi-dot uses last dot', () => {
  assert.deepStrictEqual(splitName('archive.tar.gz'), { stem: 'archive.tar', ext: '.gz' });
});

test('dedupeName: no collision returns as-is', () => {
  assert.strictEqual(dedupeName(['a.js', 'b.js'], 'c.js'), 'c.js');
});
test('dedupeName: first collision appends " copy" before ext', () => {
  assert.strictEqual(dedupeName(['a.js'], 'a.js'), 'a copy.js');
});
test('dedupeName: second collision numbers the copy', () => {
  assert.strictEqual(dedupeName(['a.js', 'a copy.js'], 'a.js'), 'a copy 2.js');
});
test('dedupeName: bumps an existing " copy" name', () => {
  assert.strictEqual(dedupeName(['a copy.js'], 'a copy.js'), 'a copy 2.js');
});
test('dedupeName: works for folders (no ext)', () => {
  assert.strictEqual(dedupeName(['src'], 'src'), 'src copy');
});

test('validateName: empty is rejected', () => {
  assert.ok(validateName('   ', []));
});
test('validateName: slashes rejected', () => {
  assert.ok(validateName('a/b', []));
});
test('validateName: illegal chars rejected', () => {
  assert.ok(validateName('a<b', []));
});
test('validateName: collision rejected', () => {
  assert.ok(validateName('a.js', ['a.js']));
});
test('validateName: renaming to own name is allowed', () => {
  assert.strictEqual(validateName('a.js', ['a.js', 'b.js'], 'a.js'), null);
});
test('validateName: valid new name passes', () => {
  assert.strictEqual(validateName('new.js', ['a.js']), null);
});
