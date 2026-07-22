const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

// T-ECO-1 prereq: gear keeps a battle record — weapons count kills,
// armour counts damage absorbed. Tracked in apply(), the one damage path.

function fixture() {
  const bolt = { n: 'Boltgun', cat: 'WEAPON', d: 'Phys 2 - Med - 1 AP' };
  const plate = { n: 'Rotplate', cat: 'ARMOUR', def: { Physical: 2 } };
  return {
    bolt, plate,
    thread: { type: 'SKIRMISH' },
    state: {
      pools: { A: 20, B: 20 },
      combatants: {
        a1: { party: 'A', w: [5, 5], model: { n: 'Hero', loadout: { slots: [{ type: 'WEAPON', it: bolt }], armour: { it: null } } } },
        b1: { party: 'B', w: [3, 3], armour: { Physical: 2 },
              model: { n: 'Foe', loadout: { slots: [], armour: { it: plate } } } }
      }, fog: {}
    }
  };
}

test('armour records damage absorbed (capped at its defense, after cover)', () => {
  const f = fixture();
  THREAD.apply(f.thread, f.state, [{ actor: 'a1', cost: 1,
    effect: { kind: 'damage', to: 'b1', amount: 4, element: 'Physical', weapon: 'Boltgun' } }], canon);
  assert.deepStrictEqual(f.state.combatants.b1.w, [1, 3]); // 4 − 2 def = 2 taken
  assert.strictEqual(f.plate.absorbed, 2);
  assert.strictEqual(f.bolt.kills || 0, 0);               // wounded, not killed
});

test('weapon credits the kill; armour keeps accumulating', () => {
  const f = fixture();
  const hit = amt => THREAD.apply(f.thread, f.state, [{ actor: 'a1', cost: 1,
    effect: { kind: 'damage', to: 'b1', amount: amt, element: 'Physical', weapon: 'Boltgun' } }], canon);
  hit(4); hit(9); // second hit: 7 taken → dead
  assert.strictEqual(f.state.combatants.b1.dead, true);
  assert.strictEqual(f.bolt.kills, 1);
  assert.strictEqual(f.plate.absorbed, 4); // 2 + 2
  hit(9); // corpse-kicking never double-credits
  assert.strictEqual(f.bolt.kills, 1);
});

test('no weapon attribution → no crash, no phantom credit', () => {
  const f = fixture();
  THREAD.apply(f.thread, f.state, [{ actor: 'a1', cost: 1,
    effect: { kind: 'damage', to: 'b1', amount: 99, element: 'Physical' } }], canon);
  assert.strictEqual(f.state.combatants.b1.dead, true);
  assert.strictEqual(f.bolt.kills || 0, 0);
});

test('element the armour cannot stop absorbs nothing', () => {
  const f = fixture();
  THREAD.apply(f.thread, f.state, [{ actor: 'a1', cost: 1,
    effect: { kind: 'damage', to: 'b1', amount: 2, element: 'Warp', weapon: 'Boltgun' } }], canon);
  assert.strictEqual(f.plate.absorbed || 0, 0);
  assert.deepStrictEqual(f.state.combatants.b1.w, [1, 3]);
});
