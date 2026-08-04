const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');
const { loadMission } = require('./_load-mission');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();
const MISSION = loadMission();

function seed(objective, combatants, pools) {
  return { id: 'm', type: 'MISSION', n: 'm', turn: 'you',
           forces: ['Mine'],
           seedState: { objective: objective, combatants: combatants || {}, pools: pools || {}, joined: true } };
}
const HOSTILE = () => ({ w: [1, 1], conds: [], party: 'Foe', armour: null,
                         gen: { id: 'e0', n: 'Cultist', cls: 'Core', pc: 10 } });
const MINE = () => ({ w: [4, 4], conds: [], party: 'Mine', armour: null });

test('combat mission exposes the combat catalog', () => {
  const mine = { w: [4, 4], conds: [], party: 'Mine', armour: null,
    model: { id: 'm1', n: 'Test Marine', cls: 'Core', pc: 10,
             sl: [{ k: 'WEAPON', it: { n: 'Combat Blade', cat: 'WEAPON', d: '2 Physical' } }] } };
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0, params: {}, done: false },
         { m1: mine, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const acts = THREAD.catalog(t, t.state, 'Mine', canon);
  assert.ok(acts.length > 0, 'MISSION with combatants must not return []');
});

test('non-combat mission catalog stays empty (deliver/work are glue buttons)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 2, progress: 0, params: { min_words: 40 }, done: false }), canon);
  assert.deepStrictEqual(THREAD.catalog(t, t.state, [], canon), []);
});

test('outcome: objective done -> mission_won with player party as victor', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1, params: {}, done: true },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

test('outcome: player side annihilated in a combat mission -> mission_lost', () => {
  const dead = MINE(); dead.w = [0, 4]; dead.dead = true;
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 3, progress: 0, params: {}, done: false },
         { m1: dead, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_lost', victor: 'Foe', defeated: ['Mine'] });
});

test('outcome: unfinished non-combat mission -> null (runs on)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 3, progress: 1, params: {}, done: false }), canon);
  assert.strictEqual(THREAD.outcome(t, t.state), null);
});

/* T-MSN-1B task 4: modifier picker payout stacking. concludeThread's mission-won branch
   (index.html, not a pure core) is glue: var mc=THREAD.modCheck(t.state,t.mods||[],D,
   (t.posts||[]).length); payout=MISSION.finalPayout(t.mission.payout,mc.valid.length,D).
   These tests exercise the two pure functions that do the actual math. */

test('MISSION.finalPayout stacks modifier_mult per valid id (x1.5^n)', () => {
  assert.strictEqual(MISSION.finalPayout(100, 0, canon), 100);
  assert.strictEqual(MISSION.finalPayout(100, 1, canon), Math.round(100 * 1.5));
  assert.strictEqual(MISSION.finalPayout(100, 2, canon), Math.round(100 * 1.5 * 1.5));
  assert.strictEqual(MISSION.finalPayout(100, 3, canon), Math.round(100 * Math.pow(1.5, 3)));
});

test('conclude payout composition: a voided modifier is excluded from the exponent', () => {
  // lone_wolf holds (exactly 1 living model); understrength voids (over pc_max 150)
  const state = { acceptPC: 999, acceptModels: 1, combatants: {},
                   objective: { kind: 'count_kill', target: 1 } };
  const mc = THREAD.modCheck(state, ['understrength', 'lone_wolf'], canon, 1);
  assert.deepStrictEqual(mc.valid, ['lone_wolf']);
  assert.deepStrictEqual(mc.voided, ['understrength']);
  const payout = MISSION.finalPayout(100, mc.valid.length, canon);
  assert.strictEqual(payout, Math.round(100 * 1.5), 'only the 1 valid id should multiply the base');
});

test('conclude payout composition: every chosen modifier voided -> base payout, no stacking', () => {
  // understrength voids (over pc_max); lone_wolf voids (2 living models, wants exactly 1)
  const state = { acceptPC: 999, acceptModels: 2, combatants: {},
                   objective: { kind: 'count_kill', target: 1 } };
  const mc = THREAD.modCheck(state, ['understrength', 'lone_wolf'], canon, 1);
  assert.deepStrictEqual(mc.valid, []);
  assert.deepStrictEqual(mc.voided, ['understrength', 'lone_wolf']);
  assert.strictEqual(MISSION.finalPayout(100, mc.valid.length, canon), 100);
});

test('LOST missions are a distinct outcome kind from WON (concludeThread only multiplies payout '
  + 'under mission_won — a lost mission never reaches MISSION.finalPayout, so it pays nothing '
  + 'regardless of chosen modifiers)', () => {
  const dead = MINE(); dead.w = [0, 4]; dead.dead = true;
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 3, progress: 0, params: {}, done: false },
         { m1: dead, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.strictEqual(oc.kind, 'mission_lost');
  assert.notStrictEqual(oc.kind, 'mission_won');
});

/* T-MSN-1B task 4 fix round: an unknown/bogus modifier id must fail closed (voided), never
   default into valid — modCheck's if/else-if chain used to leave the shared `ok` at its
   initial value for any id matching none of the five known branches; that initial value is
   now `false` (with an explicit trailing `else{ok=false}` for readability), and `low_tech`
   (the one branch that relies on "innocent until a violation is found") now sets `ok=true`
   itself at branch entry instead of inheriting the old shared default. */
test('modCheck: an unknown modifier id is voided, not valid (fails closed)', () => {
  const state = { acceptPC: 0, acceptModels: 0, combatants: {}, objective: { kind: 'count_kill', target: 1 } };
  const mc = THREAD.modCheck(state, ['bogus_id'], canon, 1);
  assert.deepStrictEqual(mc.valid, []);
  assert.deepStrictEqual(mc.voided, ['bogus_id']);
});

test('modCheck: a mixed known+bogus array voids only the bogus id', () => {
  const state = { acceptPC: 0, acceptModels: 0, combatants: {}, objective: { kind: 'count_kill', target: 1 } };
  // ironman is an effect, always valid; bogus_id matches no branch -> voided
  const mc = THREAD.modCheck(state, ['ironman', 'bogus_id'], canon, 1);
  assert.deepStrictEqual(mc.valid, ['ironman']);
  assert.deepStrictEqual(mc.voided, ['bogus_id']);
  assert.strictEqual(mc.valid.length, 1);
});

test('modCheck: low_tech still validates correctly after the fail-closed default change '
  + '(regression guard on the ok=true-at-branch-entry fix)', () => {
  const cheapGear = { pc: 5 }; // tier 1 by default gear_tier_pc thresholds
  const state = {
    acceptPC: 0, acceptModels: 1,
    combatants: { m1: { gen: false, model: { loadout: { slots: [{ it: cheapGear }], armour: null } } } },
    objective: { kind: 'count_kill', target: 1 },
  };
  const mc = THREAD.modCheck(state, ['low_tech'], canon, 1);
  assert.deepStrictEqual(mc.valid, ['low_tech']);
  assert.deepStrictEqual(mc.voided, []);
});

/* T-MSN-1C task 3: MISSION.constraintCheck(state, params) — the pure conclude-constraint
   evaluator for the 6 constraint kinds Task 1 minted onto the signature rows (the Few/
   Meatgrinder/Flawless/Martyrdom/Auxiliary/ec_perfect_kill). mineC/foeC mirror the real
   seedCombat shapes: a "mine" combatant carries `model` (roster model, has .pc, optionally
   .fac for Task 5's not-yet-landed recruit stamp); a "foe" carries `gen` (generated hostile,
   has .pc) — same shape trackKill/outcome already read elsewhere in this file. */
function mineC(pc, wCur, wMax, extra) {
  return Object.assign({ w: [wCur, wMax], conds: [], party: 'Mine', armour: null,
                          model: { pc: pc } }, extra || {});
}
function foeC(pc, extra) {
  return Object.assign({ w: [1, 1], conds: [], party: 'Foe', armour: null,
                          gen: { pc: pc } }, extra || {});
}

test('constraintCheck: no constraint param on the objective -> always ok (untouched missions)', () => {
  const r = MISSION.constraintCheck({ combatants: {} }, {});
  assert.deepStrictEqual(r, { ok: true, why: null });
});

// ── no_ally_deaths (ec_perfect_kill) ──────────────────────────────────────────────
test('constraintCheck no_ally_deaths: ok when no ally is dead', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'no_ally_deaths' }).ok, true);
});
test('constraintCheck no_ally_deaths: fails when an ally died', () => {
  const state = { combatants: { m1: mineC(10, 0, 4, { dead: true }), m2: mineC(10, 4, 4), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'no_ally_deaths' }).ok, false);
});
test('constraintCheck no_ally_deaths: a dead ENEMY (gen) never trips the gate', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'no_ally_deaths' }).ok, true);
});

// ── no_damage_taken (harlequins_flawless) ─────────────────────────────────────────
test('constraintCheck no_damage_taken: ok at full wounds, no deaths', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), m2: mineC(8, 3, 3), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'no_damage_taken' }).ok, true);
});
test('constraintCheck no_damage_taken: fails on a single wound taken', () => {
  const state = { combatants: { m1: mineC(10, 3, 4), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'no_damage_taken' }).ok, false);
});

// ── min_wounds_taken (sororitas_martyrdom) — boundary exactly-6 ──────────────────
test('constraintCheck min_wounds_taken: exactly 6 wounds taken -> ok (boundary, >=)', () => {
  // m1 took 6 wounds (10-4), m2 took 0 -> sum 6
  const state = { combatants: { m1: mineC(10, 4, 10), m2: mineC(10, 8, 8), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_wounds_taken', wounds: 6 }).ok, true);
});
test('constraintCheck min_wounds_taken: 5 wounds taken -> fails (just under the boundary)', () => {
  const state = { combatants: { m1: mineC(10, 5, 10), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_wounds_taken', wounds: 6 }).ok, false);
});
test('constraintCheck min_wounds_taken: a dead ally counts its FULL w[1], not w[1]-w[0] '
  + '(the slay effect path never zeroes w[0], so a stale w[0] must not undercount the tally)', () => {
  const state = { combatants: { m1: mineC(10, 4, 8, { dead: true }), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_wounds_taken', wounds: 8 }).ok, true);
});

// ── outnumbered (astartes_the_few) — boundary exactly-2:1 ────────────────────────
test('constraintCheck outnumbered: enemy PC exactly 2x own PC -> ok (boundary, >=)', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10), e1: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'outnumbered', ratio: 2 }).ok, true);
});
test('constraintCheck outnumbered: enemy PC just under 2x own PC -> fails', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10), e1: foeC(9) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'outnumbered', ratio: 2 }).ok, false);
});
test('constraintCheck outnumbered: LOCKED-IN totals — a wiped enemy side still counts full PC', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }), e1: foeC(10, { dead: true }) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'outnumbered', ratio: 2 }).ok, true);
});

// ── outnumbering (am_meatgrinder) — boundary exactly-2:1 ─────────────────────────
test('constraintCheck outnumbering: own PC exactly 2x enemy PC -> ok (boundary, >=)', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), m2: mineC(10, 4, 4), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'outnumbering', ratio: 2 }).ok, true);
});
test('constraintCheck outnumbering: own PC just under 2x enemy PC -> fails', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), m2: mineC(9, 4, 4), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'outnumbering', ratio: 2 }).ok, false);
});

// ── min_foreign_models (tau_auxiliary) — boundary exactly-2 ──────────────────────
// T-MSN-1C fix round 1: Task 5 stamps `fac` on EVERY muster recruit, same-faction included —
// "foreign" now requires state.locked.playerFac (snapshotted at blind-deploy lock-in,
// index.html ~3656) as the comparison basis; a bare truthy fac is no longer sufficient.
test('constraintCheck min_foreign_models: exactly 2 foreign models -> ok (boundary, >=)', () => {
  const state = { locked: { loadout: true, playerFac: 'tau' }, combatants: {
    m1: mineC(10, 4, 4, { model: { pc: 10, fac: 'kroot' } }),
    m2: mineC(10, 4, 4, { model: { pc: 10, fac: 'vespid' } }),
    m3: mineC(10, 4, 4),   // no fac stamped -> counts as own-faction, per the addendum default
    e0: foeC(10),
  } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_foreign_models', count: 2 }).ok, true);
});
test('constraintCheck min_foreign_models: only 1 foreign model -> fails (just under the boundary)', () => {
  const state = { locked: { loadout: true, playerFac: 'tau' }, combatants: {
    m1: mineC(10, 4, 4, { model: { pc: 10, fac: 'kroot' } }),
    m2: mineC(10, 4, 4),
    e0: foeC(10),
  } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_foreign_models', count: 2 }).ok, false);
});
test('constraintCheck min_foreign_models: a foreign-stamped ENEMY (gen) never counts toward the tally', () => {
  const state = { locked: { loadout: true, playerFac: 'tau' }, combatants: {
    m1: mineC(10, 4, 4, { model: { pc: 10, fac: 'kroot' } }),
    e0: foeC(10, { model: { pc: 10, fac: 'kroot' }, gen: { pc: 10, fac: 'kroot' } }),
  } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_foreign_models', count: 2 }).ok, false);
});
test('constraintCheck min_foreign_models: a fac-stamped SAME-faction recruit does NOT count '
  + '(Task 5 stamps every recruit, not just foreign ones — a Tau player recruiting a Tau model '
  + 'must not satisfy an auxiliary constraint)', () => {
  const state = { locked: { loadout: true, playerFac: 'tau' }, combatants: {
    m1: mineC(10, 4, 4, { model: { pc: 10, fac: 'tau' } }),   // same faction as playerFac
    m2: mineC(10, 4, 4, { model: { pc: 10, fac: 'kroot' } }), // genuinely foreign
    e0: foeC(10),
  } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_foreign_models', count: 2 }).ok, false,
    'only 1 genuinely-foreign model (kroot) — the tau-stamped one matches playerFac and must not count');
});
test('constraintCheck min_foreign_models: legacy state with no state.locked/playerFac — '
  + 'fac-stamped models never count as foreign (no comparison basis; fails toward "not foreign", '
  + 'never silently easier on an old save)', () => {
  const state = { combatants: {   // no `locked` at all — pre-fix save
    m1: mineC(10, 4, 4, { model: { pc: 10, fac: 'kroot' } }),
    m2: mineC(10, 4, 4, { model: { pc: 10, fac: 'vespid' } }),
    e0: foeC(10),
  } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'min_foreign_models', count: 2 }).ok, false);
});

// ── unknown constraint id fails closed (mirrors modCheck's fail-closed default) ──
test('constraintCheck: an unknown constraint id fails closed, never silently passes', () => {
  const state = { combatants: { m1: mineC(10, 4, 4), e0: foeC(10) } };
  assert.strictEqual(MISSION.constraintCheck(state, { constraint: 'bogus_constraint' }).ok, false);
});

/* ── the AND-gate: THREAD.outcome(thread, state, checkConstraint) ─────────────────
   A mission with a `constraint` param wins ONLY if the base objective is won AND
   constraintCheck(...).ok. checkConstraint is injected (MISSION.constraintCheck at
   both real index.html call sites) rather than referenced by bare name, since
   thread-core is loaded standalone by tests/_load.js with no mission-core in scope. */
test('outcome: clear_all objective won but outnumbered constraint failed -> mission NOT won '
  + '(falls through to null, not mission_won — the thread simply runs on)', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0,
           params: { clear_all: true, constraint: 'outnumbered', ratio: 2 }, done: false },
         { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }) }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state, MISSION.constraintCheck);
  assert.strictEqual(oc, null);
});
test('outcome: clear_all objective won AND outnumbered constraint satisfied -> mission_won', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0,
           params: { clear_all: true, constraint: 'outnumbered', ratio: 2 }, done: false },
         { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }), e1: foeC(10, { dead: true }) },
         { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state, MISSION.constraintCheck);
  assert.deepStrictEqual(oc, { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});
test('outcome: named-kill objective done but no_ally_deaths violated -> mission NOT won '
  + '(non-clear_all base-won path, not just the clear_all branch)', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1,
           params: { filter: 'named', constraint: 'no_ally_deaths' }, done: true },
         { m1: mineC(10, 0, 4, { dead: true }), m2: mineC(10, 4, 4), e0: foeC(10, { dead: true }) },
         { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state, MISSION.constraintCheck);
  assert.strictEqual(oc, null);
});
test('outcome: a constraint param set but NO checkConstraint injected fails closed '
  + '(never silently grants a signature win an evaluator never actually ran)', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1, params: { constraint: 'no_ally_deaths' }, done: true },
         { m1: mineC(10, 4, 4), e0: foeC(10, { dead: true }) }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);   // no 3rd arg
  assert.strictEqual(oc, null);
});
test('outcome: unconstrained mission is completely unaffected by the new gate (regression guard)', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1, params: {}, done: true },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state, MISSION.constraintCheck);
  assert.deepStrictEqual(oc, { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});
