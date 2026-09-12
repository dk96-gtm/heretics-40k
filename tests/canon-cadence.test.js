const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('rules.cadence exists with the locked N2 shape', () => {
  const c = D.rules.cadence;
  assert.ok(c, 'rules.cadence missing');
  assert.strictEqual(c.p_divisor, 400);
  assert.strictEqual(c.p_floor, 0.005);
  assert.strictEqual(c.p_cap, 0.25);
  assert.strictEqual(c.ferocity_pivot, 50);
  assert.strictEqual(c.matrix_gate, -2);
  assert.strictEqual(c.war_weight, 3);
  assert.strictEqual(c.weakness_pivot, 200);
  assert.strictEqual(c.rift_mult, 2);
  assert.strictEqual(c.invasion_ratio, 2);
  assert.strictEqual(c.player_clock_cap, 2);
  assert.strictEqual(c.drama_cap, 1);
  assert.strictEqual(c.chronicle_cap, 30);
  assert.strictEqual(c.tribute_valuation.own_model_mult, 2);
  assert.strictEqual(c.tribute_valuation.demand_mult, 1.2);
});

test('meta.version is 1.41', () => {
  assert.strictEqual(D.meta.version, '1.41');
});
