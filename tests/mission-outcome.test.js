const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function seed(objective, combatants, pools) {
  return { id: 'm', type: 'MISSION', n: 'm', turn: 'you',
           forces: ['Mine'],
           seedState: { objective: objective, combatants: combatants || {}, pools: pools || {}, joined: true } };
}
const HOSTILE = () => ({ w: [1, 1], conds: [], party: 'Foe', armour: null,
                         gen: { id: 'e0', n: 'Cultist', cls: 'Core', pc: 10 } });
const MINE = () => ({ w: [4, 4], conds: [], party: 'Mine', armour: null });

test('combat mission exposes the combat catalog', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0, params: {}, done: false },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const acts = THREAD.catalog(t, t.state, ['m1'], canon);
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
