const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function mkCombatSeed() {
  return {
    id: 't1', type: 'SKIRMISH', n: 'test fight', turn: 'you',
    seedState: {
      pools: { Mine: 10, Foe: 8 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null, x: 1, y: 1 },
        e0: { w: [3, 3], conds: [], party: 'Foe',  armour: null, x: 5, y: 5,
              gen: { id: 'e0', n: 'Cultist 1', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('T-THR-5: create() keeps a persisted mutated state instead of re-seeding', () => {
  const t = THREAD.create(mkCombatSeed(), canon);
  // mutate mid-battle: e0 takes 2 damage
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 2, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.combatants.e0.w[0], 1);

  // simulate SAVE.snapshot -> JSON -> hydrate: state rides the blob
  const blob = JSON.parse(JSON.stringify(t));
  const t2 = THREAD.create(blob, canon);
  assert.strictEqual(t2.state.combatants.e0.w[0], 1,
    'persisted wounds must survive create()');
  assert.strictEqual(t2.state.pools.Mine, 9, 'spent AP pool must survive create()');
});

test('T-THR-5: create() still seeds fresh state when none persisted', () => {
  const t = THREAD.create(mkCombatSeed(), canon);
  assert.strictEqual(t.state.combatants.e0.w[0], 3);
  assert.ok(t.state.pools.Foe === 8);
});
