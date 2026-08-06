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

/* ── Task 8: range gate + all-fanout ≥1 ── */

const dotItem = { n: 'Splinter Pistol', d: 'Corr 1 - Short - 1 AP - DoT I' };

function rangeState(dist) {
  const board = openBoard(12, 2);
  return { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 12, spd: 3, weps: [] }),
    foe: combatant({ party: 'B', x: dist, y: 0 }),
  } };
}
const hostileCond = () => ({ actor: 'm', cost: 1,
  effect: { kind: 'cond', add: { tag: 'DoT', tier: 1, src: dotItem.n, item: dotItem }, to: 'foe' } });

test('range: a SHORT-band hostile cond at medium distance rejects; at short range passes (ruling §4)', () => {
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, rangeState(3), 'A', [hostileCond()], canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, rangeState(5), 'A', [hostileCond()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /out of range/i);
});

test('range: a band-less cond item defaults to SHORT (ruling §4 default)', () => {
  const bare = { n: 'Grip', d: 'R2 - Target: Slowing II - 2 AP' };
  const st = rangeState(5);
  const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Slowing', tier: 2, item: bare }, to: 'foe' } }], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /out of range/i);
});

test('range: move-then-cast validates from the post-move square', () => {
  const st = rangeState(6);   // SHORT item, target at 6 (MEDIUM) — but we move to x=3 first (dist 3 → SHORT)
  const block = [
    { actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x: 3, y: 0 } } },
    hostileCond(),
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, st, 'A', block, canon).ok);
});

test('range: buffs are range-free — a Regen on a far ally passes (ruling §4)', () => {
  const board = openBoard(12, 2);
  const st = { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 12, weps: [] }),
    ally: combatant({ x: 11, y: 1 }),
  } };
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 2, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'ally' } }], canon).ok);
});

test('range: a LONG weapon rider at melee distance passes (band is max reach, not exact)', () => {
  const st = rangeState(1);
  const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Draining', tier: 1, band: 'LONG' }, to: 'foe' } }], canon);
  assert.ok(v.ok);
});

test('all-fanout floor: legit rider and fan-out blocks pass unchanged; the floor holds the counter at ≥1', () => {
  // HONESTY NOTE (bind the reviewer to this): actionCap floors at 1 ("caps don't stack below
  // 1", T-CMB-1), so an all-fanout-only actor counting 1 instead of 0 cannot flip any verdict
  // TODAY — no black-box rejection test exists. The floor is defense-in-depth for the
  // counter's semantics (deferral's letter: "all-fanout blocks count ≥1 action"): if a future
  // cond ever drops a cap to 0, or Stage-2 recounts server-side, the fanout exemption can
  // never again read "acted zero times". What IS assertable: every legitimate flow is
  // unchanged, at the tightest cap.
  const mk = () => ({ pools: { A: 99 }, combatants: {
    m: combatant({ w: [1, 10] }),                 // Critical: cap 1
    ally: combatant({}), foe: combatant({ party: 'B' }),
  } });
  // attack + its weapon riders = ONE action — fits cap 1
  const riders = [
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
    { actor: 'm', cost: 0, fanout: true, effect: { kind: 'cond', add: { tag: 'DoT', tier: 1 }, to: 'foe' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', riders, canon).ok);
  // a lone all-fanout buff group = ONE action (floored, not zero) — fits cap 1
  const allFan = [
    { actor: 'm', cost: 2, fanout: true, effect: { kind: 'cond', add: { tag: 'Rally', tier: 1 }, to: 'm' } },
    { actor: 'm', cost: 0, fanout: true, effect: { kind: 'cond', add: { tag: 'Rally', tier: 1 }, to: 'ally' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', allFan, canon).ok);
  // two counted actions still reject at cap 1 (the counter itself is not weakened)
  const two = [
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
  ];
  const v = THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', two, canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});
