'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { fuzzy, scorePath } = require('../src/shared/fuzzy.js');

test('non-subsequence returns null', () => {
  assert.strictEqual(fuzzy('xyz', 'hello'), null);
});

test('empty query scores 0 with no positions', () => {
  assert.deepStrictEqual(fuzzy('', 'anything'), { score: 0, positions: [] });
});

test('consecutive run beats a scattered non-boundary match', () => {
  const consecutive = fuzzy('app', 'app.js').score;      // contiguous
  const scattered = fuzzy('app', 'axpxp').score;         // no boundaries between
  assert.ok(consecutive > scattered, 'contiguous run should score higher');
});

test('camelCase humps count as word starts', () => {
  const r = fuzzy('gp', 'getProject');
  assert.ok(r && r.positions.length === 2);
  // 'g' at 0 (start, +9) and 'P' at 3 (hump, +9) minus a small length penalty
  assert.ok(r.score >= 17, 'two boundary bonuses expected');
});

test('scorePath: basename match beats an incidental mid-path match', () => {
  const cli = scorePath('cli', 'client/cli.js').score;
  const models = scorePath('cli', 'client/models.js');
  // "client/models.js": c-l...i must be found; if it matches at all it should
  // score below the clean basename match on cli.js.
  assert.ok(!models || cli > models.score, 'client/cli.js should win for "cli"');
});

test('scorePath maps basename positions back onto the full label', () => {
  const r = scorePath('cli', 'client/cli.js');
  // basename "cli.js" starts at index 7 → positions should point at 7,8,9
  assert.deepStrictEqual(r.positions, [7, 8, 9]);
});

test('scorePath falls back to full-path match when basename does not match', () => {
  const r = scorePath('cli', 'cli/models.js'); // query only in the directory part
  assert.ok(r && r.positions[0] === 0);
});
