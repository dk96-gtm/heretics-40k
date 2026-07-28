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

test('DAAK RULING 1c (fix round 1): a DoT from a no_revival source permadeaths via the nr carrier', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ w: [1, 10], conds: [{ tag: 'DoT', tier: 1, left: 3, src: 'Annihilator', el: 'Warp', nr: true }] }),
  } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.m.dead, true);
  assert.strictEqual(state.combatants.m.permaDeath, true);
  assert.strictEqual(state.combatants.m.revivalWindow, 0);
});

/* ── T-CMB-1 · Task 3: tick-then-act inside apply + damage mods ── */
test('apply with party: posting side ticks BEFORE staged effects resolve', () => {
  const state = { pools: { A: 5 }, combatants: {
    hero: combatant({ conds: [{ tag: 'Regen', tier: 2, left: 2, src: null, el: null }], w: [3, 10] }),
    foe: combatant({ party: 'B' }),
  } };
  const rep = THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'hero', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 2, element: 'Physical' } }],
    canon, 'A');
  assert.strictEqual(state.combatants.hero.w[0], 5);   // regen landed first
  assert.strictEqual(state.combatants.foe.w[0], 8);    // then the attack
  assert.ok(Array.isArray(rep) && rep.length === 1);   // tick report returned
});

test('apply without party: legacy 4-arg behaviour unchanged (no tick)', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'DoT', tier: 1, left: 2, src: null, el: null }] }) } };
  const rep = THREAD.apply({ type: 'SKIRMISH' }, state, [], canon);
  assert.strictEqual(state.combatants.m.w[0], 10);
  assert.strictEqual(rep, undefined);
});

test('apply: Rally/Marked/Charging shift damage through condMods', () => {
  // NOTE: Rally/Charging seeded with left:2, not the brief's literal left:1 — a
  // fresh instance's own duration() is 1, so left:1 expires on THIS same-call
  // tick (spec pipeline: onTick, then left-=1, then splice — Task 2, locked)
  // before condMods is read for the block's damage, which would zero out the
  // exact mods this test is trying to exercise. left:2 survives the tick
  // (becomes 1, not spliced) so the damage-mods plumbing is what's under
  // test, not an incidental same-tick expiry race.
  const base = () => ({ pools: { A: 9 }, combatants: {
    atk: combatant({ conds: [{ tag: 'Rally', tier: 2, left: 2 }, { tag: 'Charging', tier: 1, left: 2 }] }),
    tgt: combatant({ party: 'B', conds: [{ tag: 'Marked', tier: 1, left: 2 }] }),
  } });
  let s = base();   // ranged: Rally +2 and Marked +1 apply; Charging (melee-only) does not
  THREAD.apply({ type: 'SKIRMISH' }, s,
    [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'tgt', amount: 3, element: 'Physical' } }], canon, 'A');
  assert.strictEqual(s.combatants.tgt.w[0], 4);        // 10 − (3+2+1)
  s = base();       // melee: Charging +1 joins in
  THREAD.apply({ type: 'SKIRMISH' }, s,
    [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'tgt', amount: 3, element: 'Physical', band: 'MELEE' } }], canon, 'A');
  assert.strictEqual(s.combatants.tgt.w[0], 3);        // 10 − (3+2+1+1)
});

test('apply: drift item 2 — a MISSION count_kill combat with live combatants ticks the posting side too', () => {
  const state = { pools: { A: 5 }, objective: { kind: 'count_kill', target: 5, progress: 0, done: false },
    combatants: {
      hero: combatant({ conds: [{ tag: 'Regen', tier: 1, left: 2, src: null, el: null }], w: [5, 10] }),
      foe: combatant({ party: 'B' }),
    } };
  const rep = THREAD.apply({ type: 'MISSION' }, state,
    [{ actor: 'hero', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } }],
    canon, 'A');
  assert.strictEqual(state.combatants.hero.w[0], 6);   // regen ticked (+1) before the attack landed
  assert.ok(Array.isArray(rep) && rep.length === 1);
});

test('apply: drift item 2 — a non-combat MISSION post (deliver/work) never ticks conditions', () => {
  const state = { pools: {}, objective: { kind: 'collect_item', target: 3, progress: 0, done: false },
    combatants: {
      m: combatant({ conds: [{ tag: 'DoT', tier: 3, left: 2, src: null, el: null }] }),
    } };
  const rep = THREAD.apply({ type: 'MISSION' }, state,
    [{ actor: 'm', effect: { kind: 'deliver', qty: 1 } }], canon, 'A');
  assert.strictEqual(state.combatants.m.w[0], 10);     // DoT never ticked — not a combat mission
  assert.strictEqual(rep, undefined);
});

/* ── T-CMB-1 · Task 3: hard validate gates (action cap, speed) ── */
test('validate: action count is capped by Suppressing and wounds', () => {
  const state = { pools: { A: 99 }, combatants: {
    m: combatant({ conds: [{ tag: 'Suppressing', tier: 1, left: 1 }] }),   // cap 2
    foe: combatant({ party: 'B' }),
  } };
  const act = () => ({ actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } });
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', [act(), act()], canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', [act(), act(), act()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});

test('validate: free moves do not count against the action cap', () => {
  const state = { pools: { A: 99 }, combatants: {
    m: combatant({ w: [1, 10] }),                                          // Critical: cap 1
    foe: combatant({ party: 'B' }),
  } };
  const block = [
    { actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x: 1, y: 0 } } },
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', block, canon).ok);
});

test('validate: a Slowed model cannot move beyond its reduced speed', () => {
  const tiles = []; for (let i = 0; i < 8 * 8; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 8, tiles };
  const state = { pools: { A: 99 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, spd: 3, conds: [{ tag: 'Slowing', tier: 2, left: 1 }] }) } };
  const move = (x) => [{ actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x, y: 0 } } }];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', move(1), canon).ok);   // 3−2=1 ok
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', move(2), canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /slow/i);
});

test('validate: drift item 2 — MISSION count_kill combat gets the same action-cap gate', () => {
  const state = { pools: { A: 99 }, objective: { kind: 'count_kill', target: 3, progress: 0, done: false },
    combatants: {
      m: combatant({ conds: [{ tag: 'Suppressing', tier: 1, left: 1 }] }),   // cap 2
      foe: combatant({ party: 'B' }),
    } };
  const act = () => ({ actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } });
  const v = THREAD.validate({ type: 'MISSION' }, state, 'A', [act(), act(), act()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});
