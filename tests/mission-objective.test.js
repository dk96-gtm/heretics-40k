const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function purgeSeed(target) {
  return {
    id: 'mp', type: 'MISSION', n: 'Purge test', turn: 'you',
    seedState: {
      objective: { kind: 'count_kill', target: target, progress: 0,
                   params: { filter: 'hostile' }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Cultist 1', cls: 'Core', pc: 10 } },
        e1: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e1', n: 'Cultist 2', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('count_kill: hostile kills increment progress; own deaths do not', () => {
  const t = THREAD.create(purgeSeed(2), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
  // own model dies: no progress
  THREAD.apply(t, t.state,
    [{ actor: 'e1', cost: 1, effect: { kind: 'damage', to: 'm1', amount: 9, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
  // second hostile down -> target met
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.deepStrictEqual(THREAD.evalObjective(t.state), { won: true, progress: 2, target: 2 });
});

test('count_kill: a kill never double-counts (damage on an already-dead model)', () => {
  const t = THREAD.create(purgeSeed(3), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
});

test('collect_item: deliver effect adds qty', () => {
  const t = THREAD.create({
    id: 'mi', type: 'MISSION', n: 'Item test', turn: 'you',
    seedState: { objective: { kind: 'collect_item', target: 3, progress: 0, params: { item_n: 'Combat Blade' }, done: false } }
  }, canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'deliver', qty: 2 } }], canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'deliver', qty: 1 } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

test('restore: work posts count only at/above min_words', () => {
  const t = THREAD.create({
    id: 'mr', type: 'MISSION', n: 'Rebuild test', turn: 'you',
    seedState: { objective: { kind: 'restore', target: 2, progress: 0, params: { min_words: 40 }, done: false } }
  }, canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 39 } }], canon);
  assert.strictEqual(t.state.objective.progress, 0);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 40 } }], canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 200 } }], canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

test('evalObjective is null-safe on non-mission state', () => {
  const t = THREAD.create({ id: 'x', type: 'SKIRMISH', n: 'x', seedState: {} }, canon);
  assert.strictEqual(THREAD.evalObjective(t.state), null);
});

// ── T-MSN-1B task 2: named/class kill filters ──────────────────────────
function namedSeed() {
  return {
    id: 'mb', type: 'MISSION', n: 'Bounty test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: 1, progress: 0,
                   params: { filter: 'named', target_name: 'Varkon the Flayed' }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Varkon the Flayed', cls: 'Assault', pc: 30 } },
        e1: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e1', n: 'Random Grunt', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('named-filter kill: only the named target increments progress', () => {
  const t = THREAD.create(namedSeed(), canon);
  // wrong target dies first -> no progress
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }], canon);
  assert.strictEqual(t.state.objective.progress, 0);
  // named target dies -> progress + done
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e0' } }], canon);
  assert.strictEqual(t.state.objective.progress, 1);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

function classSeed() {
  return {
    id: 'mc', type: 'MISSION', n: 'Kill-Team test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: 1, progress: 0,
                   params: { filter: 'class', cls: 'Assault' }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Core Grunt', cls: 'Core', pc: 10 } },
        e1: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e1', n: 'Assault Brute', cls: 'Assault', pc: 12 } }
      },
      joined: true
    }
  };
}

test('class-filter kill: only a matching-class kill increments progress', () => {
  const t = THREAD.create(classSeed(), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e0' } }], canon);
  assert.strictEqual(t.state.objective.progress, 0, 'Core kill does not match cls:Assault');
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }], canon);
  assert.strictEqual(t.state.objective.progress, 1);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

// ── T-MSN-1B task 2: clear_all (Liberation) ─────────────────────────────
function clearAllSeed() {
  return {
    id: 'ml', type: 'MISSION', n: 'Liberation test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: 0, progress: 0,
                   params: { filter: 'any', clear_all: true }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Grunt 1', cls: 'Core', pc: 10 } },
        e1: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e1', n: 'Grunt 2', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('clear_all: won only once every enemy-side combatant is gone', () => {
  const t = THREAD.create(clearAllSeed(), canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false);
  THREAD.apply(t, t.state, [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e0' } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, 'one hostile remains');
  assert.strictEqual(THREAD.outcome(t, t.state), null);
  THREAD.apply(t, t.state, [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true, 'enemy side wiped');
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

// ── T-MSN-1B task 2: state.round (a round = one enemy post) ────────────
test('state.round: tickRound increments explicitly; a normal apply() never bumps it', () => {
  const t = THREAD.create(namedSeed(), canon);
  assert.strictEqual(t.state.round, 0);
  THREAD.apply(t, t.state, [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }], canon);
  assert.strictEqual(t.state.round, 0, 'a player post alone must not advance the round');
  assert.strictEqual(THREAD.tickRound(t.state), 1);
  assert.strictEqual(THREAD.tickRound(t.state), 2);
  assert.strictEqual(t.state.round, 2);
});

// ── T-MSN-1B task 2: survive_rounds (Defend) ────────────────────────────
function surviveSeed(target) {
  return {
    id: 'md', type: 'MISSION', n: 'Defend test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'survive_rounds', target: target, progress: 0, params: {}, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null,
              model: { id: 'm1', n: 'Test Marine', cls: 'Core', pc: 10,
                       sl: [{ k: 'WEAPON', it: { n: 'Combat Blade', cat: 'WEAPON', d: '2 Physical' } }] } },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Grunt', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('survive_rounds: progress tracks state.round; wins at target with the player side alive', () => {
  const t = THREAD.create(surviveSeed(3), canon);
  assert.deepStrictEqual(THREAD.evalObjective(t.state), { won: false, progress: 0, target: 3 });
  assert.strictEqual(THREAD.outcome(t, t.state), null);
  THREAD.tickRound(t.state); THREAD.tickRound(t.state);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, '2 of 3 rounds survived');
  THREAD.tickRound(t.state);
  assert.deepStrictEqual(THREAD.evalObjective(t.state), { won: true, progress: 3, target: 3 });
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

// ── T-MSN-1B final fix wave · CRITICAL 2: npcRespond early-returns with no living foe, so
// state.round can never reach the round target once the attackers are wiped — Defend must
// ALSO win on enemy wipe (reuses clear_all's own _enemyAliveCount clause), same as Liberation,
// as long as the player side still stands. Mirrored in both evalObjective and outcome. ──
test('CRITICAL 2: survive_rounds wins on enemy wipe even before the round target is reached', () => {
  const t = THREAD.create(surviveSeed(4), canon);
  THREAD.tickRound(t.state); THREAD.tickRound(t.state); // round 2 of 4 — nowhere near the target
  assert.strictEqual(THREAD.evalObjective(t.state).won, false);
  THREAD.apply(t, t.state, [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e0' } }], canon);
  assert.deepStrictEqual(THREAD.evalObjective(t.state), { won: true, progress: 2, target: 4 },
    'enemy side wiped at round 2 of 4 -> won, independent of the round count');
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

test('CRITICAL 2: enemy wipe does not win if the player side was ALSO wiped in the same exchange', () => {
  const t = THREAD.create(surviveSeed(4), canon);
  THREAD.apply(t, t.state, [
    { actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e0' } },
    { actor: 'e0', cost: 1, effect: { kind: 'slay', to: 'm1' } }
  ], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, 'mutual wipe is not a Defend win');
});

test('survive_rounds: reaching the round target does not win if the player side was wiped', () => {
  const t = THREAD.create(surviveSeed(2), canon);
  THREAD.tickRound(t.state); THREAD.tickRound(t.state);
  THREAD.apply(t, t.state, [{ actor: 'e0', cost: 1, effect: { kind: 'slay', to: 'm1' } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, 'player side is wiped');
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_lost', victor: 'Foe', defeated: ['Mine'] });
});

test('survive_rounds: reaching the round target does not win if the player side is entirely captured', () => {
  const t = THREAD.create(surviveSeed(2), canon);
  THREAD.tickRound(t.state); THREAD.tickRound(t.state);
  t.state.combatants.m1.captured = true;
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, 'captured, not dead - still not "alive" for survive_rounds');
});

test('survive_rounds: tickRound keeps objective.progress in sync (all three readers agree)', () => {
  const t = THREAD.create(surviveSeed(3), canon);
  THREAD.tickRound(t.state);
  assert.strictEqual(t.state.objective.progress, 1, 'the board meter reads objective.progress directly');
  THREAD.tickRound(t.state); THREAD.tickRound(t.state);
  assert.strictEqual(t.state.objective.progress, 3);
  assert.strictEqual(THREAD.evalObjective(t.state).progress, 3);
});

// ── T-MSN-1B fix round: survive_rounds is combat-flavored (combatKind gates) ──
test('combatKind gates: survive_rounds gets the combat catalog, not an empty one', () => {
  const t = THREAD.create(surviveSeed(3), canon);
  const acts = THREAD.catalog(t, t.state, 'Mine', canon);
  assert.ok(acts.length > 0, 'survive_rounds MISSION with live combatants must expose combat actions');
});

test('combatKind gates: validate enforces the AP pool on a survive_rounds thread', () => {
  const t = THREAD.create(surviveSeed(3), canon);
  const overspend = THREAD.validate(t, t.state, 'Mine',
    [{ actor: 'm1', cost: 999, effect: { kind: 'damage', to: 'e0', amount: 1, element: 'Physical' } }], canon);
  assert.strictEqual(overspend.ok, false, 'survive_rounds must be gated like any other combat mission');
});

test('combatKind gates: apply ticks the posting side\'s conditions on a survive_rounds thread', () => {
  const t = THREAD.create(surviveSeed(3), canon);
  t.state.combatants.m1.conds = [{ tag: 'DoT', tier: 1, left: 2, src: null, el: null }];
  THREAD.apply(t, t.state, [], canon, 'Mine');
  assert.strictEqual(t.state.combatants.m1.w[0], 3, 'DoT ticked for -1 - proves tickConds ran for this party');
});

// ── T-MSN-1B fix round: seedState -> live state carries mods/snapshots through ──
test('seedState mods/snapshots survive THREAD.create/initState promotion (the acceptMission path)', () => {
  const t = THREAD.create({
    id: 'mi2', type: 'MISSION', n: 'Ironman test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: 1, progress: 0, params: { filter: 'hostile' }, done: false },
      mods: ['ironman'], acceptPC: 40, acceptModels: 1,
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Cultist', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  }, canon);
  assert.deepStrictEqual(t.state.mods, ['ironman'], 'initState must whitelist seedState.mods through to live state');
  assert.strictEqual(t.state.acceptPC, 40);
  assert.strictEqual(t.state.acceptModels, 1);
  THREAD.apply(t, t.state,
    [{ actor: 'e0', cost: 1, effect: { kind: 'damage', to: 'm1', amount: 9, element: 'Physical' } }], canon);
  assert.strictEqual(t.state.combatants.m1.permaDeath, true, 'Ironman fires on a player kill reached via the real seedState path');
});

// ── T-MSN-1B task 2: modCheck predicate truth table ─────────────────────
test('modCheck: understrength valid at/under pc_max (150), voided over it', () => {
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 140 }, ['understrength'], canon),
    { valid: ['understrength'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 160 }, ['understrength'], canon),
    { valid: [], voided: ['understrength'] });
});

test('modCheck: lone_wolf valid at exactly 1 model, voided at 2 (and voided with no snapshot)', () => {
  assert.deepStrictEqual(THREAD.modCheck({ acceptModels: 1 }, ['lone_wolf'], canon),
    { valid: ['lone_wolf'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptModels: 2 }, ['lone_wolf'], canon),
    { valid: [], voided: ['lone_wolf'] });
  assert.deepStrictEqual(THREAD.modCheck({}, ['lone_wolf'], canon),
    { valid: [], voided: ['lone_wolf'] }, 'fail-closed: no acceptModels snapshot -> 0 -> !==1 -> voided');
});

test('modCheck: low_tech valid when every player item AND armour is gear-tier 1, voided if any is tier 3', () => {
  const lowGearState = { combatants: { m1: { model: { sl: [{ it: { pc: 8 } }], loadout: { armour: { it: { pc: 8 } } } } },
                                        e0: { gen: { id: 'e0' }, model: { sl: [{ it: { pc: 30 } }] } } } };
  const highGearState = { combatants: { m1: { model: { sl: [{ it: { pc: 20 } }] } } } };
  const highArmourState = { combatants: { m1: { model: { sl: [{ it: { pc: 8 } }], loadout: { armour: { it: { pc: 25 } } } } } } };
  assert.deepStrictEqual(THREAD.modCheck(lowGearState, ['low_tech'], canon),
    { valid: ['low_tech'], voided: [] }, 'pc 8 weapon + pc 8 armour => tier 1; enemy-side gear is ignored');
  assert.deepStrictEqual(THREAD.modCheck(highGearState, ['low_tech'], canon),
    { valid: [], voided: ['low_tech'] }, 'pc 20 weapon => tier 3 > gear_tier_max 1');
  assert.deepStrictEqual(THREAD.modCheck(highArmourState, ['low_tech'], canon),
    { valid: [], voided: ['low_tech'] }, 'armour is its own hard slot - a heavy-tier plate voids low_tech too');
});

test('modCheck: blitz fails CLOSED when postCount is absent, even under a generous cap', () => {
  const state = { blitzCap: 999 };
  assert.deepStrictEqual(THREAD.modCheck(state, ['blitz'], canon),
    { valid: [], voided: ['blitz'] }, 'no real post count supplied -> void, never silently valid');
});

test('modCheck: blitz valid within the real post-count budget, voided over it', () => {
  const state = { blitzCap: 20 };
  assert.deepStrictEqual(THREAD.modCheck(state, ['blitz'], canon, 10), { valid: ['blitz'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck(state, ['blitz'], canon, 30), { valid: [], voided: ['blitz'] });
});

test('modCheck: blitz fallback cap = objective.target * 4 * modifiers.blitz.post_mult when state.blitzCap is unset', () => {
  const pm = canon.rules.missions.modifiers.blitz.post_mult; // 0.6
  // kind: 'count_kill' - a real accepted mission's objective always carries a kind; blitz
  // is combat-only (Slice-B ruling), so a kindless fixture would now be voided outright.
  const state = { objective: { kind: 'count_kill', target: 10 } };  // fallback cap = 10*4*0.6 = 24
  assert.deepStrictEqual(THREAD.modCheck(state, ['blitz'], canon, Math.floor(10 * 4 * pm)),
    { valid: ['blitz'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck(state, ['blitz'], canon, Math.ceil(10 * 4 * pm) + 5),
    { valid: [], voided: ['blitz'] });
});

test('modCheck: ironman is always valid - it is an effect, not a predicate', () => {
  assert.deepStrictEqual(THREAD.modCheck({}, ['ironman'], canon), { valid: ['ironman'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 99999 }, ['ironman'], canon), { valid: ['ironman'], voided: [] });
});

test('modCheck: a full mixed roster evaluates each modifier independently', () => {
  const state = { acceptPC: 140, acceptModels: 1, blitzCap: 20,
    combatants: { m1: { model: { sl: [{ it: { pc: 8 } }] } } } };
  const mods = ['understrength', 'lone_wolf', 'low_tech', 'ironman', 'blitz'];
  assert.deepStrictEqual(THREAD.modCheck(state, mods, canon, 5), { valid: mods, voided: [] });
});

// ── T-MSN-1B task 2: Ironman kill hook ──────────────────────────────────
test('ironman: a mod-flagged mission permadeaths the player\'s own kill (damage branch)', () => {
  const t = THREAD.create(namedSeed(), canon);
  t.state.mods = ['ironman'];
  THREAD.apply(t, t.state,
    [{ actor: 'e0', cost: 1, effect: { kind: 'damage', to: 'm1', amount: 9, element: 'Physical' } }],
    canon);
  const mine = t.state.combatants.m1;
  assert.strictEqual(mine.dead, true);
  assert.strictEqual(mine.permaDeath, true, 'ironman forces permadeath even without a no_revival source');
  assert.strictEqual(mine.revivalWindow, 0);
});

test('ironman: never permadeaths a generated hostile (mods only bind the player side)', () => {
  const t = THREAD.create(namedSeed(), canon);
  t.state.mods = ['ironman'];
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }], canon);
  const foe = t.state.combatants.e1;
  assert.strictEqual(foe.permaDeath, false, 'hostiles keep their normal revival window - ironman binds the player only');
});

test('ironman: absent mods list behaves exactly as before (no regression)', () => {
  const t = THREAD.create(namedSeed(), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'e0', cost: 1, effect: { kind: 'damage', to: 'm1', amount: 9, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.combatants.m1.permaDeath, false);
  assert.strictEqual(t.state.combatants.m1.revivalWindow, canon.rules.death.revival_window.windows.Physical);
});

// ── Slice-B rulings addendum (Daak sit 2026-08-03) · capture counts, dead or alive ──
const SHACKLES = { n: 'Shackles', cat: 'ITEM', d: 'Capture I - restraints' };
function captureBountySeed() {
  return {
    id: 'mcap', type: 'MISSION', n: 'Bounty capture test', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: 1, progress: 0,
                   params: { filter: 'named', target_name: 'Varkon the Flayed' }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null, x: 2, y: 2,
              model: { n: 'Captor', pc: 10, cls: 'Core',
                loadout: { slots: [{ type: 'ITEM', it: SHACKLES }, { type: 'ITEM', it: null }] } } },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null, x: 3, y: 2,
              gen: { id: 'e0', n: 'Varkon the Flayed', cls: 'Assault', pc: 30 } }
      },
      joined: true
    }
  };
}
function captureBlock() {
  return [{ actor: 'm1', cost: 3, item: SHACKLES, effect: { kind: 'capture', to: 'e0' } }];
}
test('capture completes a named-target objective exactly like a kill: progress 1/1, mission_won', () => {
  const t = THREAD.create(captureBountySeed(), canon);
  assert.ok(THREAD.validate(t, t.state, 'Mine', captureBlock(), canon).ok);
  THREAD.apply(t, t.state, captureBlock(), canon);
  const tgt = t.state.combatants.e0;
  assert.ok(tgt.captured, 'the target is held, not slain');
  assert.strictEqual(tgt.dead, undefined, 'captured is not dead - the player keeps the CAPTIVE');
  assert.strictEqual(t.state.objective.progress, 1);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});
test('capture never double-counts: a stray damage effect against an already-captured model is a no-op for progress', () => {
  const t = THREAD.create(captureBountySeed(), canon);
  THREAD.apply(t, t.state, captureBlock(), canon);
  assert.strictEqual(t.state.objective.progress, 1);
  // objective.done already true - trackKill's own guard makes any further call inert
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 9, element: 'Physical' } }], canon);
  assert.strictEqual(t.state.objective.progress, 1, 'progress must not climb past target from a second hit on the same model');
});
test('capture: a captured model is excluded from further DoT ticks (no post-capture second stampKill/trackKill)', () => {
  const t = THREAD.create(captureBountySeed(), canon);
  // give the about-to-be-captured target a lingering DoT from before capture
  t.state.combatants.e0.conds = [{ tag: 'DoT', tier: 1, left: 3, src: 'Blight', el: 'Corrosive' }];
  THREAD.apply(t, t.state, captureBlock(), canon);
  assert.strictEqual(t.state.objective.progress, 1);
  const rep = THREAD.tickConds('Foe', t.state, canon);
  assert.deepStrictEqual(rep, [], 'a captured combatant must never still tick - it is off the field');
  assert.strictEqual(t.state.objective.progress, 1, 'no second kill-credit from a DoT that outlived the capture');
  assert.strictEqual(t.state.combatants.e0.dead, undefined, 'still captured, never also flagged dead');
});

// ── Slice-B rulings addendum (Daak sit 2026-08-03) · modifiers are combat-only ──
test('modCheck: a non-combat objective (e.g. restore/collect_item) voids every modifier outright', () => {
  const restoreState = { objective: { kind: 'restore', target: 3 }, acceptPC: 50, acceptModels: 1 };
  const mods = ['understrength', 'lone_wolf', 'low_tech', 'ironman', 'blitz'];
  assert.deepStrictEqual(THREAD.modCheck(restoreState, mods, canon, 1), { valid: [], voided: mods });
  const collectState = { objective: { kind: 'collect_item', target: 4 } };
  assert.deepStrictEqual(THREAD.modCheck(collectState, ['ironman'], canon), { valid: [], voided: ['ironman'] });
});
test('modCheck: a combat objective (count_kill/survive_rounds) is unaffected by the non-combat gate', () => {
  const state = { objective: { kind: 'count_kill', target: 3 }, acceptPC: 50, acceptModels: 1 };
  assert.deepStrictEqual(THREAD.modCheck(state, ['understrength', 'lone_wolf'], canon),
    { valid: ['understrength', 'lone_wolf'], voided: [] });
  const state2 = { objective: { kind: 'survive_rounds', target: 5 } };
  assert.deepStrictEqual(THREAD.modCheck(state2, ['ironman'], canon), { valid: ['ironman'], voided: [] });
});
