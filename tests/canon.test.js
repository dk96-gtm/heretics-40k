const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('canon is v1.6', () => {
  assert.strictEqual(canon.meta.version, '1.6');
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

test('v1.5 revival windows are travel-tuned', () => {
  const w = canon.rules.death.revival_window.windows;
  assert.strictEqual(w.Physical, 8);
  assert.strictEqual(w.Energy, 8);
  assert.strictEqual(w.Heat, 3);
  assert.strictEqual(w.Warp, 3);
  // harsh minimum >= same-sector travel + 1
  assert.ok(w.Heat >= canon.travel.same_sector.posts + 1);
});

test('canon defines a no-revival tag set and an Annihilation forge tag', () => {
  const nr = canon.rules.death.revival_window.no_revival;
  assert.ok(Array.isArray(nr.tags) && nr.tags.includes('Annihilation'));
  const ann = canon.equipment_alpha.forge_tags_alpha.find(t => t.tag === 'Annihilation');
  assert.ok(ann, 'Annihilation forge tag present');
});

test('canon: ai block present and well-formed', () => {
  assert.equal(canon.meta.version, '1.6');
  assert.ok(canon.ai && typeof canon.ai.model === 'string' && canon.ai.model.length);
  assert.ok(typeof canon.ai.directives === 'string' && canon.ai.directives.length > 40);
});

test('canon: time block present with 8 phases / 4 blocks', () => {
  assert.ok(canon.time && typeof canon.time.block_minutes === 'number');
  assert.equal(canon.time.phases.length, 8);
  assert.equal(canon.time.blocks.length, 4);
});

test('canon: each allegiance carries prime_drive + lens frames', () => {
  ['chaos', 'imperial', 'xenos'].forEach(k => {
    const a = canon.allegiances[k];
    assert.ok(a, 'missing allegiance ' + k);
    assert.ok(typeof a.prime_drive === 'string' && a.prime_drive.length > 10, k + ' prime_drive');
    assert.ok(typeof a.lens === 'string' && a.lens.length > 10, k + ' lens');
  });
});
