const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadRift } = require('./_load-rift');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const RIFT = loadRift();

// T-RIFT-1b: the felt multipliers — travel passage and requisition pricing

test('applyTravel: home −25%, away +25%, neutral unchanged (canon magnitudes)', () => {
  assert.strictEqual(RIFT.applyTravel(100, 'home', canon), 75);
  assert.strictEqual(RIFT.applyTravel(100, 'away', canon), 125);
  assert.strictEqual(RIFT.applyTravel(100, 'neutral', canon), 100);
});

test('applyTravel rounds to whole currency and preserves zero', () => {
  assert.strictEqual(RIFT.applyTravel(101, 'home', canon), 76); // 75.75 → 76
  assert.strictEqual(RIFT.applyTravel(1, 'home', canon), 1);    // 0.75 → 1, never free
  assert.strictEqual(RIFT.applyTravel(0, 'away', canon), 0);    // free stays free (warp gate)
});

test('applyReq: away +25%; home and neutral pay list price', () => {
  assert.strictEqual(RIFT.applyReq(100, 'away', canon), 125);
  assert.strictEqual(RIFT.applyReq(100, 'home', canon), 100);
  assert.strictEqual(RIFT.applyReq(100, 'neutral', canon), 100);
  assert.strictEqual(RIFT.applyReq(7, 'away', canon), 9);       // 8.75 → 9
});

test('felt hooks agree with the shipped mods table', () => {
  const h = RIFT.mods('home', canon), a = RIFT.mods('away', canon);
  assert.strictEqual(RIFT.applyTravel(400, 'home', canon), Math.round(400 * h.travelMult));
  assert.strictEqual(RIFT.applyTravel(400, 'away', canon), Math.round(400 * a.travelMult));
  assert.strictEqual(RIFT.applyReq(400, 'away', canon), Math.round(400 * a.reqMult));
});
