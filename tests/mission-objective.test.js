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
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
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

test('survive_rounds: reaching the round target does not win if the player side was wiped', () => {
  const t = THREAD.create(surviveSeed(2), canon);
  THREAD.tickRound(t.state); THREAD.tickRound(t.state);
  THREAD.apply(t, t.state, [{ actor: 'e0', cost: 1, effect: { kind: 'slay', to: 'm1' } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false, 'player side is wiped');
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_lost', victor: 'Foe', defeated: ['Mine'] });
});

// ── T-MSN-1B task 2: modCheck predicate truth table ─────────────────────
test('modCheck: understrength valid at/under pc_max (150), voided over it', () => {
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 140 }, ['understrength'], canon),
    { valid: ['understrength'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 160 }, ['understrength'], canon),
    { valid: [], voided: ['understrength'] });
});

test('modCheck: lone_wolf valid at exactly 1 model, voided at 2', () => {
  assert.deepStrictEqual(THREAD.modCheck({ acceptModels: 1 }, ['lone_wolf'], canon),
    { valid: ['lone_wolf'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptModels: 2 }, ['lone_wolf'], canon),
    { valid: [], voided: ['lone_wolf'] });
});

test('modCheck: low_tech valid when every player item is gear-tier 1, voided if any is tier 3', () => {
  const lowGearState = { combatants: { m1: { model: { sl: [{ it: { pc: 8 } }] } },
                                        e0: { gen: { id: 'e0' }, model: { sl: [{ it: { pc: 30 } }] } } } };
  const highGearState = { combatants: { m1: { model: { sl: [{ it: { pc: 20 } }] } } } };
  assert.deepStrictEqual(THREAD.modCheck(lowGearState, ['low_tech'], canon),
    { valid: ['low_tech'], voided: [] }, 'pc 8 => tier 1; enemy-side gear is ignored');
  assert.deepStrictEqual(THREAD.modCheck(highGearState, ['low_tech'], canon),
    { valid: [], voided: ['low_tech'] }, 'pc 20 => tier 3 > gear_tier_max 1');
});

test('modCheck: blitz valid within the post budget, voided over it', () => {
  const under = { blitzCap: 20, posts: new Array(10) };
  const over = { blitzCap: 20, posts: new Array(30) };
  assert.deepStrictEqual(THREAD.modCheck(under, ['blitz'], canon), { valid: ['blitz'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck(over, ['blitz'], canon), { valid: [], voided: ['blitz'] });
});

test('modCheck: ironman is always valid - it is an effect, not a predicate', () => {
  assert.deepStrictEqual(THREAD.modCheck({}, ['ironman'], canon), { valid: ['ironman'], voided: [] });
  assert.deepStrictEqual(THREAD.modCheck({ acceptPC: 99999 }, ['ironman'], canon), { valid: ['ironman'], voided: [] });
});

test('modCheck: a full mixed roster evaluates each modifier independently', () => {
  const state = { acceptPC: 140, acceptModels: 1, blitzCap: 20, posts: new Array(5),
    combatants: { m1: { model: { sl: [{ it: { pc: 8 } }] } } } };
  const mods = ['understrength', 'lone_wolf', 'low_tech', 'ironman', 'blitz'];
  assert.deepStrictEqual(THREAD.modCheck(state, mods, canon), { valid: mods, voided: [] });
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
