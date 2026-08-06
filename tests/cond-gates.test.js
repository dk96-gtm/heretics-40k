const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');
const { loadCondGlue } = require('./_condglue');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const G = loadCondGlue(THREAD);

function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}
function openBoard(w, h) {
  const tiles = []; for (let i = 0; i < w * h; i++) tiles.push({ t: 'open' });
  return { w, h, tiles, zones: {} };
}

/* ── Task 6: hostility + band helpers ── */

test('condHostile: the five hostile tags true; buffs, instants-buffs, unknown tags false', () => {
  ['DoT', 'Slowing', 'Suppressing', 'Marked', 'Draining'].forEach(t =>
    assert.strictEqual(THREAD.condHostile(t), true, t));
  ['Regen', 'Rally', 'Cleanse', 'Immunity', 'Charging', 'Burning', 'NoSuchTag'].forEach(t =>
    assert.strictEqual(THREAD.condHostile(t), false, t));
});

test('condIsHostile (glue) delegates to the core — one source of truth', () => {
  assert.strictEqual(G.condIsHostile('Marked'), true);
  assert.strictEqual(G.condIsHostile('Regen'), false);
});

test('condBandOf: explicit band wins; item range word next; default SHORT (ruling §4)', () => {
  assert.strictEqual(THREAD.condBandOf({ band: 'LONG' }), 'LONG');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'Corr 3 - Med - 2 AP - DoT I' } }), 'MEDIUM');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'Energy 3 - Melee - 2 AP - Suppressing I' } }), 'MELEE');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'R2 - Target: Slowing II + Suppressing I - 2 AP' } }), 'SHORT');
  assert.strictEqual(THREAD.condBandOf({}), 'SHORT');
  assert.strictEqual(THREAD.condBandOf(null), 'SHORT');
});

test('condBandOf: "at Long range" phrasing reaches LONG via the description scan (Target Uplink)', () => {
  const tu = (canon.casts || []).filter(x => x.n === 'Target Uplink')[0];
  assert.strictEqual(THREAD.condBandOf({ item: tu }), 'LONG');
});
