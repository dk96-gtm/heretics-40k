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
