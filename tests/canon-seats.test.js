const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('rules.seats shape', () => {
  const s = D.rules.seats;
  assert.ok(s, 'rules.seats missing');
  assert.deepStrictEqual(s.not_seatable.sort(), ['crown','orbit','space','warzone']);
  assert.strictEqual(s.tax.per_level, 3);
  assert.strictEqual(s.upkeep.pc_divisor, 250);
  assert.deepStrictEqual(s.casualties.pools,
    { repelled:0.15, repelled_losses:0.35, sacked:0.6, captured:1.0 });
  assert.strictEqual(s.casualties.carried_off, 0.5);
  assert.strictEqual(s.casualties.revival_element, 'Physical');
  assert.strictEqual(s.casualties.anchor, 'lapse_day');
  assert.strictEqual(s.buyout.premium, 2);
  assert.strictEqual(s.buyout.standing_min, 1);
  assert.strictEqual(s.petition_standing_min, 0);
  assert.deepStrictEqual(s.commission, { base: 30, days: 7 });
});

test('base_by_type covers every seat-able location type, and no non-seat-able one', () => {
  const s = D.rules.seats;
  const all = D.galaxy.location_types.map(t => t.id);
  for (const t of all) {
    if (s.not_seatable.includes(t)) {
      assert.ok(!(t in s.base_by_type), t + ' is not seat-able but priced');
      assert.ok(!(t in s.work_gates), t + ' is not seat-able but work-gated');
    } else {
      assert.ok(s.base_by_type[t] > 0, t + ' has no seat_base');
      assert.ok(s.work_gates[t] > 0, t + ' has no work_gate');
    }
  }
});

test('every sub-faction-ruled sector designates a crown world', () => {
  for (const sg of D.galaxy.segmentums)
    for (const z of sg.zones)
      for (const sec of z.sectors) {
        const ruled = (sec.planets || []).some(p => p.ruler && p.ruler.faction);
        if (!ruled) continue;
        const hasCrown = (sec.planets || []).some(p => p.crown === true);
        assert.ok(hasCrown, 'sector ' + sec.id + ' is ruled but has no crown world');
      }
});
