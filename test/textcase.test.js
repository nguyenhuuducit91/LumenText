'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { toCase, rot13, tokenize } = require('../src/renderer/js/textcase');

test('tokenize: camelCase', () => {
  assert.deepStrictEqual(tokenize('getUserName'), ['get', 'User', 'Name']);
});
test('tokenize: acronym boundary', () => {
  assert.deepStrictEqual(tokenize('HTTPServerID'), ['HTTP', 'Server', 'ID']);
});
test('tokenize: snake + kebab + space', () => {
  assert.deepStrictEqual(tokenize('hello_world-foo bar'), ['hello', 'world', 'foo', 'bar']);
});

test('snake_case from camel', () => {
  assert.strictEqual(toCase('getUserName', 'snake'), 'get_user_name');
});
test('kebab-case from camel', () => {
  assert.strictEqual(toCase('getUserName', 'kebab'), 'get-user-name');
});
test('lowerCamel from snake', () => {
  assert.strictEqual(toCase('hello_world', 'lowerCamel'), 'helloWorld');
});
test('upperCamel from kebab', () => {
  assert.strictEqual(toCase('hello-world', 'upperCamel'), 'HelloWorld');
});
test('swap case', () => {
  assert.strictEqual(toCase('Hello World 123', 'swap'), 'hELLO wORLD 123');
});
test('snake preserves acronym split', () => {
  assert.strictEqual(toCase('parseHTMLString', 'snake'), 'parse_html_string');
});

test('rot13 is reversible', () => {
  assert.strictEqual(rot13('Hello, World!'), 'Uryyb, Jbeyq!');
  assert.strictEqual(rot13(rot13('Hello, World!')), 'Hello, World!');
});
