const { test } = require('node:test');
const assert = require('node:assert');
const { loadSave } = require('./_load-save');
const SAVE = loadSave();

// A tiny S with the two things snapshot must handle: a circular combatant.model
// ref back into roster, and an ephemeral _digest.
function fixtureS() {
  const kane = { id: 'kane', n: 'Kane', loadout: { armour: { it: { def: { Physical: 2 } } } } };
  const S = {
    player: { name: 'Kane', faction: 'death_guard' },
    roster: [kane],
    threads: [{ id: 't1', state: { combatants: { kane: { band: 'MELEE', model: kane, armour: { Physical: 2 } } } } }],
    world: { met: ['vess'] },
    time: { epoch: 1000, lastTick: 1000 },
    _digest: { lines: ['ephemeral'] },
    someFutureField: { grown: true },   // schema-growth guard
  };
  return { S, kane };
}

test('snapshot strips the circular combatant.model and .armour refs', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  const c = blob.threads[0].state.combatants.kane;
  assert.strictEqual(c.model, undefined, 'model ref removed');
  assert.strictEqual(c.armour, undefined, 'armour ref removed');
  assert.strictEqual(c.band, 'MELEE', 'other combatant fields kept');
  // must be JSON-safe (no throw, no cycle)
  assert.doesNotThrow(() => JSON.stringify(blob));
});

test('snapshot drops _digest but preserves unknown fields', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  assert.strictEqual(blob._digest, undefined, '_digest dropped');
  assert.deepStrictEqual(blob.someFutureField, { grown: true }, 'unknown field preserved');
});

test('snapshot is a deep clone — mutating the blob does not touch S', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  blob.world.met.push('X');
  assert.deepStrictEqual(S.world.met, ['vess'], 'original untouched');
});
