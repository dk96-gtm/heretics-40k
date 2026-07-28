const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

// Fix round 1 (T-CMB-1 task 5 review): the cond-staging engine glue (condTagsOf/condEffectsFor/
// livingAllies/cleanseReach/condIsHostile) lives OUTSIDE the thread-core region — it's UI glue, not
// pure core — but the reviewer asked for a real node test of the nl/nr wiring fix, which means
// actually calling condEffectsFor, not just replicating its output shape by hand. Extract its two
// small, self-contained marked regions from index.html (item-parse-glue: tierNum/parseItem/cap/
// ELEMFULL/RANGES; cond-staging-glue: condTagsOf/condEffectsFor/…) and eval them together against
// the real THREAD, same extract-and-vm.run technique tests/_load.js's loadThread() already uses.
function loadCondGlue(THREAD) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const parse = html.match(/\/\*<item-parse-glue>\*\/([\s\S]*?)\/\*<\/item-parse-glue>\*\//);
  const glue = html.match(/\/\*<cond-staging-glue>\*\/([\s\S]*?)\/\*<\/cond-staging-glue>\*\//);
  if (!parse) throw new Error('item-parse-glue region not found in index.html');
  if (!glue) throw new Error('cond-staging-glue region not found in index.html');
  const src = '(function(THREAD){' + parse[1] + '\n' + glue[1] +
    '\n;return {condTagsOf:condTagsOf,condEffectsFor:condEffectsFor,livingAllies:livingAllies,' +
    'cleanseReach:cleanseReach,condIsHostile:condIsHostile,parseItem:parseItem};})';
  return vm.runInThisContext(src)(THREAD);
}
const CONDGLUE = loadCondGlue(THREAD);

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

/* ── T-CMB-1 · Task 4 (remainder): npcTurn obeys its own condition mods ──
   Task 3 already pulled the validate hard gates forward; npcTurn itself was
   explicitly left untouched (see task-3-report.md) — this closes that gap. */
test('npcTurn: a slowed enemy closes distance at its condition-reduced speed', () => {
  const tiles = []; for (let i = 0; i < 10 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 10, h: 4, tiles, zones: {} };
  const wep = (c) => c.weps || [];
  const MELEE = { name: 'Claw', band: 'MELEE', ap: 1, damage: 2, element: 'Physical' };
  const state = {
    pools: { B: 9 },
    combatants: {
      ork:  { party: 'B', x: 5, y: 0, w: [12, 12], sight: 9, spd: 3,
              conds: [{ tag: 'Slowing', tier: 2, left: 1 }], weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, board, wep, canon);
  const mv = block.find((b) => b.effect && b.effect.kind === 'move');
  assert.ok(mv, 'still tries to close');
  assert.strictEqual(mv.effect.to.x, 4, 'spd 3 − Slowing 2 = 1 cell of movement (5→4)');
});

test('npcTurn: without a canon arg, defaults safely (legacy 4-arg callers keep working)', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const wep = (c) => c.weps || [];
  const MELEE = { name: 'Chainsword', band: 'MELEE', ap: 3, damage: 4, element: 'Physical' };
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 1, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 5, spd: 4, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, board, wep);   // no 5th arg
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'legacy call site still stages the attack');
});

/* ── T-CMB-1 · Task 5: application path — applyCond ──────────────────────
   Immunity check → same-tag rule (higher tier replaces / equal-lower
   refreshes) → else push; instants (Draining/Cleanse) resolve through the
   registry, nothing stored; nl/nr/by are STAMPED at application. */
test('applyCond: no stacking — higher tier replaces, equal/lower refreshes the clock', () => {
  const state = { pools: {}, combatants: { m: combatant({}) } };
  THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 2, src: 'Bile', el: 'Corrosive' }, canon);
  assert.strictEqual(state.combatants.m.conds.length, 1);
  state.combatants.m.conds[0].left = 1;                                       // nearly over
  const r1 = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 1, src: 'Sting', el: null }, canon);
  assert.strictEqual(r1.refreshed, true);
  assert.strictEqual(state.combatants.m.conds[0].tier, 2);                    // lower did NOT downgrade
  assert.strictEqual(state.combatants.m.conds[0].left, THREAD.condDur('DoT', 2));
  const r2 = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 3, src: 'Plague', el: 'Corrosive' }, canon);
  assert.strictEqual(r2.replaced, true);
  assert.strictEqual(state.combatants.m.conds.length, 1);
  assert.strictEqual(state.combatants.m.conds[0].tier, 3);
});

test('applyCond: Immunity blocks its stated tag', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'Immunity', tier: 1, left: Infinity, src: null, el: null, of: 'DoT' }] }) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 2, src: null, el: null }, canon);
  assert.strictEqual(r.blocked, true);
  assert.strictEqual(state.combatants.m.conds.length, 1);
});

test('applyCond: Immunity also blocks an instant tag (e.g. Immunity: Draining) before it fires', () => {
  const state = { pools: { B: 5 }, combatants: {
    m: combatant({ party: 'B', conds: [{ tag: 'Immunity', tier: 1, left: Infinity, src: null, el: null, of: 'Draining' }] }) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'Draining', tier: 2, src: null, el: null }, canon);
  assert.strictEqual(r.blocked, true);
  assert.strictEqual(state.pools.B, 5, 'the pool must not be touched — Immunity gates before the instant handler runs');
});

test('applyCond: Draining bites the AP pool immediately, stores nothing', () => {
  const state = { pools: { B: 5 }, combatants: { m: combatant({ party: 'B' }) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'Draining', tier: 2, src: null, el: null }, canon);
  assert.strictEqual(r.instant, true);
  assert.strictEqual(state.pools.B, 3);
  assert.strictEqual(state.combatants.m.conds.length, 0);
});

test('applyCond: Cleanse strips the negative set, leaves buffs', () => {
  const state = { pools: {}, combatants: { m: combatant({ conds: [
    { tag: 'DoT', tier: 1, left: 2 }, { tag: 'Regen', tier: 1, left: 2 },
    { tag: 'Suppressing', tier: 1, left: 1 }, { tag: 'Marked', tier: 2, left: 3 }] }) } };
  THREAD.applyCond(state, 'm', { tag: 'Cleanse', tier: 1, src: null, el: null }, canon);
  assert.deepStrictEqual(state.combatants.m.conds.map((c) => c.tag), ['Regen']);
});

test('applyCond: unknown tags still apply as inert instances (left:Infinity) — extensibility', () => {
  const state = { pools: {}, combatants: { m: combatant({}) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'Burning', tier: 4, src: 'Promethium' }, canon);
  assert.strictEqual(r.applied, true);
  const inst = state.combatants.m.conds[0];
  assert.strictEqual(inst.tag, 'Burning');
  assert.strictEqual(inst.left, Infinity);
});

test('applyCond: nl/nr/by are STAMPED at application — nl/nr resolved from the src item, by from the actor', () => {
  const state = { pools: {}, combatants: { atk: combatant({}), tgt: combatant({ party: 'B' }) } };
  const nlItem = { n: 'Stun Baton', d: 'Physical DoT II - Non-Lethal - Melee' };
  THREAD.applyCond(state, 'tgt', { tag: 'DoT', tier: 2, src: nlItem.n, item: nlItem }, canon, 'atk');
  const inst = state.combatants.tgt.conds[0];
  assert.strictEqual(inst.nl, true, 'Non-Lethal tag on the src item floors the DoT (ruling 1a)');
  assert.strictEqual(inst.by, 'atk', 'applying actor is stamped for weapon-kill credit');
  assert.strictEqual(inst.el, 'Physical', 'element derived the same way damage staging derives it');

  const state2 = { pools: {}, combatants: { atk: combatant({}), tgt: combatant({ party: 'B' }) } };
  const nrItem = { n: 'Annihilator Round', d: 'Plasma DoT III - Annihilation' };
  THREAD.applyCond(state2, 'tgt', { tag: 'DoT', tier: 3, src: nrItem.n, item: nrItem }, canon, 'atk');
  assert.strictEqual(state2.combatants.tgt.conds[0].nr, true, 'no_revival source stamps nr (ruling 1c)');
});

test('applyCond: explicit nl/nr/el in the payload win over item-derivation (staging can supply them directly)', () => {
  const state = { pools: {}, combatants: { m: combatant({}) } };
  THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 1, src: 'x', el: 'Heat', nl: true, nr: false }, canon, 'someActor');
  const inst = state.combatants.m.conds[0];
  assert.strictEqual(inst.el, 'Heat');
  assert.strictEqual(inst.nl, true);
  assert.strictEqual(inst.by, 'someActor');
});

test('apply: cond effects route through applyCond (end-to-end) — real payload, by stamped from the actor', () => {
  const state = { pools: { A: 5 }, combatants: {
    caster: combatant({}), ally: combatant({}) } };
  THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'caster', cost: 2, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2, src: 'Catalyst', el: null }, to: 'ally' } }],
    canon, 'A');
  const inst = state.combatants.ally.conds[0];
  assert.strictEqual(inst.tag, 'Regen');
  assert.strictEqual(inst.left, THREAD.condDur('Regen', 2));
  assert.strictEqual(inst.src, 'Catalyst');
  assert.strictEqual(inst.by, 'caster');
});

test('apply: a legacy un-migrated string cond effect does not crash (fallback wrap)', () => {
  // Per the plan's documented fallback: a raw label string is wrapped verbatim as
  // {tag:String(add),tier:1} — it does NOT get parsed by normCond's regex (normCond
  // passes any object with a truthy .tag straight through), so it lands as an inert,
  // never-expiring instance rather than crashing. This is a "doesn't crash" safety
  // net for un-migrated staged effects, not a normalisation guarantee.
  const state = { pools: { A: 5 }, combatants: { m: combatant({}) } };
  assert.doesNotThrow(() => THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: 'Regen II', to: 'm' } }], canon, 'A'));
  const inst = state.combatants.m.conds[0];
  assert.strictEqual(inst.tag, 'Regen II');
  assert.strictEqual(inst.left, Infinity);
});

/* ── T-CMB-1 · Task 5 (staging glue): drift item 7 — band stamping ───────
   Task 3 review found that NO staging site set `effect.band`, so the damage
   branch's `e.band==='MELEE'` check for Charging's dmgOutMelee bonus was dead
   code in live play. npcTurn is the one construction site that lives inside
   the pure core (the action-block builder and the board-attack builder are
   engine glue, verified only by the boot-proxy + upcoming browser E2E task).
   These tests confirm: (1) npcTurn's own staged damage effect carries the
   real engagement band (bandOf the actual distance, not the weapon's max
   reach), and (2) feeding that block through apply produces the Charging
   bonus at melee range and withholds it at long range — "Charge→melee
   attack in one block applies +t; ranged attack does not". */
test('npcTurn: stamps band on its staged damage effect — melee engagement', () => {
  const tiles = []; for (let i = 0; i < 10 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 10, h: 4, tiles, zones: {} };
  const wep = (c) => c.weps || [];
  const CLAW = { name: 'Claw', band: 'MELEE', ap: 1, damage: 2, element: 'Physical' };
  const state = {
    pools: { B: 9 },
    combatants: {
      ork:  { party: 'B', x: 5, y: 0, w: [12, 12], sight: 9, spd: 3,
              conds: [{ tag: 'Charging', tier: 2, left: 1 }], weps: [CLAW] },
      hero: { party: 'A', x: 4, y: 0, w: [10, 10], sight: 9, spd: 3, weps: [CLAW] },   // adjacent
    },
  };
  const block = THREAD.npcTurn('B', state, board, wep, canon);
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'npc attacks at melee range');
  assert.strictEqual(atk.effect.band, 'MELEE');
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.strictEqual(state.combatants.hero.w[0], 6);   // 10 − (2 base + 2 Charging tier)
});

test('npcTurn: a long-range attack is NOT stamped MELEE — Charging bonus withheld', () => {
  const tiles = []; for (let i = 0; i < 10 * 2; i++) tiles.push({ t: 'open' });
  const board = { w: 10, h: 2, tiles, zones: {} };
  const wep = (c) => c.weps || [];
  const LASGUN = { name: 'Lasgun', band: 'LONG', ap: 1, damage: 3, element: 'Physical' };
  const state = {
    pools: { B: 9 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 9, spd: 3,
              conds: [{ tag: 'Charging', tier: 2, left: 1 }], weps: [LASGUN] },
      hero: { party: 'A', x: 7, y: 0, w: [10, 10], sight: 9, spd: 3, weps: [LASGUN] },   // 7 sq → LONG
    },
  };
  const block = THREAD.npcTurn('B', state, board, wep, canon);
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'npc attacks at long range without needing to close');
  assert.notStrictEqual(atk.effect.band, 'MELEE');
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.strictEqual(state.combatants.hero.w[0], 7);   // 10 − 3 base only; Charging is melee-only
});

/* ── T-CMB-1 · Task 5 fix round 1 (reviewer findings) ─────────────────── */

test('fix round 1: livingAllies/cleanseReach exclude captured models from Rally/Cleanse fan-out', () => {
  const state = { pools: { A: 9 }, combatants: {
    caster: combatant({ x: 0, y: 0 }),
    ally: combatant({ x: 1, y: 0 }),
    downed: combatant({ x: 0, y: 1, dead: true }),
    taken: combatant({ x: 1, y: 1, captured: true }),   // alive, but off the field — must never fan to it
  } };
  assert.deepStrictEqual(CONDGLUE.livingAllies(state, 'A').sort(), ['ally', 'caster']);
  assert.deepStrictEqual(CONDGLUE.cleanseReach(state, 'A', 'caster', 2).sort(),   // touch (tier II)
    ['ally', 'caster']);
  assert.deepStrictEqual(CONDGLUE.cleanseReach(state, 'A', 'caster', 3).sort(),   // force-wide (tier III)
    ['ally', 'caster']);
});

test('fix round 1: condEffectsFor threads the real item through — a Non-Lethal item stamps nl via the ACTUAL staging path, not a hand-built payload', () => {
  const state = { pools: { A: 9 }, combatants: { caster: combatant({}), ally: combatant({}) } };
  const nlItem = { n: 'Stun Baton', d: 'Phys 2 - DoT I - Non-Lethal' };
  const effs = CONDGLUE.condEffectsFor(nlItem, 'caster', 'ally', state, 'A');
  assert.strictEqual(effs.length, 1);
  assert.ok(effs[0].add.item, 'condEffectsFor must thread the source item into add.item');
  const block = [{ actor: 'caster', cost: 1, effect: effs[0] }];
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  const inst = state.combatants.ally.conds[0];
  assert.strictEqual(inst.tag, 'DoT');
  assert.strictEqual(inst.nl, true, 'nl must be stamped from add.item through the real condEffectsFor payload');
});

test('fix round 1: a Rally fan-out (built the way the engine glue actually builds it) counts as ONE action; a genuine 4-action block still fails', () => {
  const state = { pools: { A: 99 }, combatants: {
    caster: combatant({}), a1: combatant({}), a2: combatant({}),
    foe: combatant({ party: 'B' }),
  } };
  const rallyItem = { n: 'Warcry', d: 'Rally I - 2 AP - 1/thread' };
  const effs = CONDGLUE.condEffectsFor(rallyItem, 'caster', null, state, 'A');
  assert.strictEqual(effs.length, 3, 'fans to caster + 2 living allies');
  const rallyBlock = effs.map((ef, i) => ({ actor: 'caster', cost: i === 0 ? 2 : 0, fanout: i > 0, effect: ef }));
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', rallyBlock, canon).ok,
    'Rally fanned to 3 allies is still ONE action against the actionCap');
  const act = () => ({ actor: 'caster', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } });
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', [act(), act(), act(), act()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});

test('fix round 2: fanout:true only exempts cond-kind entries — a hand-built damage/capture entry tagged fanout:true still counts toward the action cap', () => {
  const state = { pools: { A: 99 }, combatants: {
    m: combatant({}),                    // actionCap 3 (fresh, no conds, full wounds)
    foe: combatant({ party: 'B' }),
  } };
  const dmg = () => ({ actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } });
  // A hand-built block spoofing fanout:true on damage entries to try to dodge the action-count gate.
  const spoofed = [dmg(), { ...dmg(), fanout: true }, { ...dmg(), fanout: true }, { ...dmg(), fanout: true }];
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', spoofed, canon);
  assert.strictEqual(v.ok, false, 'fanout on a non-cond effect must NOT exempt it from the action cap');
  assert.match(v.reason, /action/i);
  // Same shape but genuinely capture-kind — also must not be exempt.
  const cap = () => ({ actor: 'm', cost: 1, effect: { kind: 'capture', to: 'foe' } });
  const spoofedCap = [cap(), { ...cap(), fanout: true }, { ...cap(), fanout: true }, { ...cap(), fanout: true }];
  const v2 = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', spoofedCap, canon);
  assert.strictEqual(v2.ok, false, 'fanout on a capture effect must NOT exempt it from the action cap either');
});
