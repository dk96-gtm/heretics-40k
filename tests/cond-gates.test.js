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

/* ── Task 7: allegiance + fog gates ── */

test('allegiance: a hostile cond aimed at your own side is rejected (boardless too)', () => {
  const state = { pools: { A: 9 }, combatants: { m: combatant({}), ally: combatant({}) } };
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'DoT', tier: 1, src: 'x', el: null }, to: 'ally' } }], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /own side/i);
});

test('allegiance: a buff aimed at the enemy is rejected; at an ally it passes', () => {
  const state = { pools: { A: 9 }, combatants: {
    m: combatant({}), ally: combatant({}), foe: combatant({ party: 'B' }) } };
  const bad = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'foe' } }], canon);
  assert.strictEqual(bad.ok, false);
  assert.match(bad.reason, /buff/i);
  const good = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'ally' } }], canon);
  assert.ok(good.ok);
});

test('allegiance: the legacy string-cond fallback (unknown tag, self target) still passes', () => {
  const state = { pools: { A: 9 }, combatants: { m: combatant({}) } };
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: 'Regen II', to: 'm' } }], canon).ok);
});

test('fog: a hostile cond on an unspotted enemy is rejected; a spotted one passes', () => {
  const board = openBoard(12, 2);
  const state = { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 3, weps: [] }),
    near: combatant({ party: 'B', x: 2, y: 0 }),
    far: combatant({ party: 'B', x: 11, y: 1 }),
  } };
  const eff = (to) => [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Marked', tier: 1, item: { d: 'Apply Marked I at Long range' } }, to } }];
  const spotted = THREAD.spottedEnemies('A', state, board);
  assert.ok(spotted.indexOf('near') >= 0 && spotted.indexOf('far') < 0, 'fixture: near seen, far unseen');
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', eff('near'), canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', eff('far'), canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /sight|fog/i);
});
