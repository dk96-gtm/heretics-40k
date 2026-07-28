const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── T-CMB-1 · Task 1: registry, normalisation, mods ── */

test('normCond: legacy tier strings become instances with full clocks', () => {
  assert.deepStrictEqual(THREAD.normCond('Regen II'),
    { tag: 'Regen', tier: 2, left: 4, src: null, el: null });   // duration 2+t
  assert.deepStrictEqual(THREAD.normCond('DoT III'),
    { tag: 'DoT', tier: 3, left: 5, src: null, el: null });
  assert.strictEqual(THREAD.normCond('Cast: Catalyst'), null);  // label junk drops
  const inst = { tag: 'Marked', tier: 1, left: 2, src: 'x', el: null };
  assert.strictEqual(THREAD.normCond(inst), inst);              // instances pass through
});

test('normCond: unknown tags become inert instances (left Infinity)', () => {
  const b = THREAD.normCond('Burning IV');
  assert.strictEqual(b.tag, 'Burning');
  assert.strictEqual(b.left, Infinity);
});

test('condMods: sums penalties and bonuses across instances', () => {
  const c = { conds: [
    { tag: 'Slowing', tier: 2, left: 1 },
    { tag: 'Suppressing', tier: 3, left: 3 },   // −1 action regardless of tier
    { tag: 'Rally', tier: 2, left: 1 },
    { tag: 'Charging', tier: 1, left: 1 },
    { tag: 'Marked', tier: 2, left: 3 },
    { tag: 'Burning', tier: 4, left: Infinity }, // unknown: contributes nothing
  ], w: [10, 10] };
  assert.deepStrictEqual(THREAD.condMods(c),
    { speed: -2, actions: -1, dmgOut: 2, dmgOutMelee: 1, dmgIn: 2 });
});

test('actionCap: base 3, Suppressing −1, Injured caps at 2, Critical at 1', () => {
  const fresh = { conds: [], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(fresh, canon), 3);
  const pinned = { conds: [{ tag: 'Suppressing', tier: 1, left: 1 }], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(pinned, canon), 2);
  const injured = { conds: [], w: [5, 10] };                    // ≤ half → Injured
  assert.strictEqual(THREAD.actionCap(injured, canon), 2);
  const critical = { conds: [], w: [1, 10] };                   // last band → Critical
  assert.strictEqual(THREAD.actionCap(critical, canon), 1);
  const both = { conds: [{ tag: 'Suppressing', tier: 2, left: 2 }], w: [1, 10] };
  assert.strictEqual(THREAD.actionCap(both, canon), 1);         // caps don't stack below 1
});

/* ── Task 2: the tick ── */
function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}

test('tickConds: DoT bites, Regen heals to cap, durations count down, expiry splices', () => {
  const state = { pools: {}, combatants: {
    a: combatant({ conds: [{ tag: 'DoT', tier: 2, left: 1, src: 'Bile', el: 'Corrosive' },
                           { tag: 'Regen', tier: 1, left: 3, src: null, el: null }] }),
    b: combatant({ party: 'B', conds: [{ tag: 'DoT', tier: 5, left: 4, src: null, el: null }] }),
  } };
  const rep = THREAD.tickConds('A', state, canon);
  const a = state.combatants.a;
  assert.strictEqual(a.w[0], 9);                       // −2 DoT, +1 Regen
  assert.strictEqual(a.conds.length, 1);               // DoT hit left:0 → spliced
  assert.strictEqual(a.conds[0].tag, 'Regen');
  assert.strictEqual(a.conds[0].left, 2);
  assert.strictEqual(state.combatants.b.w[0], 10);     // other side untouched
  assert.ok(rep.some(r => r.who === 'a' && r.tag === 'DoT' && r.delta === -2));
  assert.ok(rep.some(r => r.who === 'a' && r.tag === 'DoT' && r.expired));
});

test('tickConds: FIFO order decides life or death at 1 wound', () => {
  const mk = (conds) => ({ pools: {}, combatants: { m: combatant({ w: [1, 10], conds }) } });
  const dotFirst = mk([{ tag: 'DoT', tier: 1, left: 3, src: 'Venom', el: 'Corrosive' },
                       { tag: 'Regen', tier: 1, left: 3, src: null, el: null }]);
  THREAD.tickConds('A', dotFirst, canon);
  assert.strictEqual(dotFirst.combatants.m.dead, true);          // died before the heal
  assert.strictEqual(dotFirst.combatants.m.killElement, 'Corrosive');
  assert.ok(dotFirst.combatants.m.revivalWindow > 0);            // element-timed window stamped
  const regenFirst = mk([{ tag: 'Regen', tier: 1, left: 3, src: null, el: null },
                         { tag: 'DoT', tier: 1, left: 3, src: 'Venom', el: 'Corrosive' }]);
  THREAD.tickConds('A', regenFirst, canon);
  assert.ok(!regenFirst.combatants.m.dead);                      // healed to 2, bitten to 1
  assert.strictEqual(regenFirst.combatants.m.w[0], 1);
});

test('tickConds: Regen never exceeds max wounds; dead models do not tick', () => {
  const state = { pools: {}, combatants: {
    full: combatant({ w: [10, 10], conds: [{ tag: 'Regen', tier: 3, left: 2, src: null, el: null }] }),
    gone: combatant({ w: [0, 10], dead: true, conds: [{ tag: 'DoT', tier: 1, left: 2, src: null, el: null }] }),
  } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.full.w[0], 10);
  assert.strictEqual(state.combatants.gone.conds[0].left, 2);    // untouched
});

test('tickConds: unknown tags are inert and never expire', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'Burning', tier: 4, left: Infinity, src: null, el: null }] }) } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.m.w[0], 10);
  assert.strictEqual(state.combatants.m.conds.length, 1);
});

/* ── Task 2 · Drift-alignment BINDING rulings (2026-07-28) ── */

test('DAAK RULING 1a: a Non-Lethal-sourced DoT floors ticks at 1 wound — never kills, target stays captureable', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ w: [1, 10], conds: [{ tag: 'DoT', tier: 5, left: 2, src: 'Stun Lash', el: 'Physical', nl: true }] }),
  } };
  const rep = THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.m.w[0], 1);       // floored at 1, not 0
  assert.ok(!state.combatants.m.dead);                  // never killed
  assert.ok(!state.combatants.m.killElement);
  assert.ok(rep.some(r => r.who === 'm' && r.tag === 'DoT' && r.died === false));
});

test('DAAK RULING 1a: nl DoT still bites for its full amount when there is headroom above 1 wound', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ w: [5, 10], conds: [{ tag: 'DoT', tier: 2, left: 2, src: 'Stun Lash', el: 'Physical', nl: true }] }),
  } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.m.w[0], 3);       // full −2, plenty of headroom above 1
});

test('DAAK RULING 1b: tickConds never runs when state.phase is aftermath or deploy (defense in depth)', () => {
  const mkState = (phase) => ({ phase, pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'DoT', tier: 3, left: 2, src: null, el: null }] }) } });
  const s1 = mkState('aftermath');
  assert.deepStrictEqual(THREAD.tickConds('A', s1, canon), []);
  assert.strictEqual(s1.combatants.m.w[0], 10);
  assert.strictEqual(s1.combatants.m.conds[0].left, 2);          // not even ticked down
  const s2 = mkState('deploy');
  assert.deepStrictEqual(THREAD.tickConds('A', s2, canon), []);
  assert.strictEqual(s2.combatants.m.w[0], 10);
  assert.strictEqual(s2.combatants.m.conds[0].left, 2);
});

test('DAAK RULING 1c: a DoT killing blow runs the full kill path — revival window, count_kill objective, weapon credit', () => {
  const gunner = combatant({ model: { n: 'Gunner', loadout: { slots: [{ it: { n: 'Bile Launcher', cat: 'WEAPON', kills: 0 } }] } } });
  const victim = combatant({ w: [1, 10], party: 'B', gen: true,
    conds: [{ tag: 'DoT', tier: 1, left: 3, src: 'Bile Launcher', el: 'Corrosive', by: 'gunner' }] });
  const state = { pools: {}, objective: { kind: 'count_kill', target: 1, progress: 0, done: false },
    combatants: { gunner: gunner, victim: victim } };
  const rep = THREAD.tickConds('B', state, canon);
  assert.strictEqual(state.combatants.victim.dead, true);
  assert.strictEqual(state.combatants.victim.killElement, 'Corrosive');
  assert.ok(state.combatants.victim.revivalWindow > 0);          // element-timed window, not permaDeath
  assert.ok(!state.combatants.victim.permaDeath);
  assert.strictEqual(state.objective.progress, 1);                // trackKill fired
  assert.strictEqual(state.objective.done, true);
  assert.strictEqual(gunner.model.loadout.slots[0].it.kills, 1);   // src weapon credited
  assert.ok(rep.some(r => r.who === 'victim' && r.tag === 'DoT' && r.died === true));
});
