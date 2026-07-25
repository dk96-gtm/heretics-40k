// tests/spoils-nonlethal.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { death: { revival_window: { windows: { Physical: 8 } } } } };

function mkState(w) {
  return { pools: { A: 9, B: 9 }, combatants: {
    atk: { party: 'A', w: [4, 4], model: { loadout: { slots: [] } } },
    tgt: { party: 'B', w: [w, 4], model: { loadout: { slots: [] } } }
  }, fog: {} };
}
const T = { type: 'SKIRMISH' };

test('non-lethal hit floors at 1 wound, never kills', () => {
  const s = mkState(3);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical', nonLethal: true } }], CANON);
  assert.strictEqual(s.combatants.tgt.w[0], 1);
  assert.ok(!s.combatants.tgt.dead);
});
test('non-lethal hit on a 1-wound target changes nothing', () => {
  const s = mkState(1);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical', nonLethal: true } }], CANON);
  assert.strictEqual(s.combatants.tgt.w[0], 1);
  assert.ok(!s.combatants.tgt.dead);
});
test('lethal hit still kills (no regression)', () => {
  const s = mkState(2);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical' } }], CANON);
  assert.ok(s.combatants.tgt.dead);
});
