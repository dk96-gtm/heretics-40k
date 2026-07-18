const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

test('passageCost scales continuously on PC', () => {
  // base(cross_sector)=120, divisor=250. 500 PC -> x2 -> 240.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_sector_same_segmentum', 500, false), 240);
  // base(cross_segmentum)=300. 6000 PC -> x24 -> 7200.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, false), 7200);
});

test('no threshold cliff: one extra PC costs a little more, never a jump', () => {
  const a = THREAD.passageCost(canon, 'cross_segmentum', 3000, false);
  const b = THREAD.passageCost(canon, 'cross_segmentum', 3001, false);
  assert.ok(b >= a && b - a <= 2, `smooth, got ${a} -> ${b}`);
});

test('Warp Gate waives passage entirely', () => {
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, true), 0);
});

test('wordCount strips HTML and counts words', () => {
  assert.strictEqual(THREAD.wordCount('<b>The</b> ravine walls wept ash'), 5);
  assert.strictEqual(THREAD.wordCount('  spaced   out  '), 2);
  assert.strictEqual(THREAD.wordCount('<br>'), 0);
  assert.strictEqual(THREAD.wordCount(''), 0);
});

test('forcePC sums model point costs', () => {
  assert.strictEqual(THREAD.forcePC([{pc:120},{pc:80},{pc:300}]), 500);
  assert.strictEqual(THREAD.forcePC([]), 0);
});
