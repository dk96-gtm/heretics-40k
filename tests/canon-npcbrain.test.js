const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('meta.version is 1.39', () => { assert.strictEqual(D.meta.version, '1.39'); });

test('rules.npc_kit shape', () => {
  const k = D.rules.npc_kit;
  assert.deepStrictEqual(k.depth_by_rank, {
    "1": {items: 0.5, abilities: 0, casts: false},
    "2": {items: 1,   abilities: 1, casts: false},
    "3": {items: 1,   abilities: 1, casts: true},
    "4": {items: 1,   abilities: 1, casts: true},
    "5": {items: 1,   abilities: 1, casts: true}
  });
});

test('rules.npc_brain shape', () => {
  const b = D.rules.npc_brain;
  assert.deepStrictEqual(b.bands, {
    basic_attack: [8, 12], offensive: [20, 40], support: [25, 45], reaction: [50, 70] });
  assert.strictEqual(b.draw_cutoff, 0.7);
  assert.strictEqual(b.inertia_bonus, 0.15);
  assert.deepStrictEqual(b.tilt, {
    ferocity:   {targets: "melee_close", pivot: 50, max_mult: 1.6},
    cunning:    {targets: "denial_ranged", pivot: 50, max_mult: 1.6},
    supremacism:{targets: "leader", pivot: 50, max_mult: 1.6},
    honor_high: 70, honor_low: 30,
    pragmatism_item_pivot: 50 });
  assert.deepStrictEqual(b.lapse_kit_nudge, {per_caster: 0.004, per_ability: 0.002, cap: 0.03});
});
