const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('canon is v1.4', () => {
  assert.strictEqual(canon.meta.version, '1.4');
});

test('every travel tier has base + words', () => {
  const tiers = ['same_planet', 'same_sector', 'same_sector_space',
                 'cross_sector_same_segmentum', 'cross_segmentum'];
  for (const k of tiers) {
    assert.ok(canon.travel[k], `missing tier ${k}`);
    assert.strictEqual(typeof canon.travel[k].base, 'number', `${k}.base`);
    assert.strictEqual(typeof canon.travel[k].words, 'number', `${k}.words`);
  }
});

test('travel has a force_divisor and warp-gate waiver', () => {
  assert.strictEqual(canon.travel.force_divisor, 250);
  assert.match(canon.travel.warp_gate_waiver, /warp gate/i);
});

test('bases and words climb with distance', () => {
  const t = canon.travel;
  assert.ok(t.same_planet.base < t.same_sector.base);
  assert.ok(t.same_sector.base < t.cross_sector_same_segmentum.base);
  assert.ok(t.cross_sector_same_segmentum.base < t.cross_segmentum.base);
  assert.ok(t.same_planet.words < t.cross_segmentum.words);
});
