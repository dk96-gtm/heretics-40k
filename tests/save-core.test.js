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

test('relink re-attaches combatant.model from roster by id, and armour def', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);                 // refs stripped
  // simulate a fresh load: blob is the persisted S with no combatant.model
  const loaded = JSON.parse(JSON.stringify(blob));
  SAVE.relink(loaded);
  const c = loaded.threads[0].state.combatants.kane;
  assert.strictEqual(c.model, loaded.roster[0], 'model re-points at the roster instance');
  assert.deepStrictEqual(c.armour, { Physical: 2 }, 'armour def rebuilt from loadout');
});

test('relink tolerates a combatant with no matching roster id', () => {
  const loaded = { roster: [], threads: [{ state: { combatants: { ghost: { band: 'LONG' } } } }] };
  assert.doesNotThrow(() => SAVE.relink(loaded));
  assert.strictEqual(loaded.threads[0].state.combatants.ghost.model, undefined);
});

test('a snapshot round-trips through an in-memory store unchanged', () => {
  const { S } = fixtureS();
  const mem = {};
  const MockStore = {
    get: (k) => (k in mem ? JSON.parse(mem[k]) : null),
    set: (k, o) => { mem[k] = JSON.stringify(o); },
    del: (k) => { delete mem[k]; },
    keys: () => Object.keys(mem),
  };
  MockStore.set('heretics_profile_v1', SAVE.snapshot(S));
  const back = MockStore.get('heretics_profile_v1');
  assert.strictEqual(back.player.name, 'Kane');
  assert.strictEqual(back.threads[0].state.combatants.kane.model, undefined);
  assert.deepStrictEqual(MockStore.keys(), ['heretics_profile_v1']);
});
