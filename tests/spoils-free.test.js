// tests/spoils-free.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
  capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1, sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8 } } } } };
const T = { type: 'SKIRMISH' };

function capturedState() {
  // B's 'tgt' already captured, held by A's 'carrier' (now dead at 4,4); B's 'buddy' stands adjacent
  const captive = { party: 'B', w: [1, 4], x: null, y: null, captured: true, heldBy: 'carrier',
                    model: { n: 'Victim', pc: 8, loadout: { slots: [] } } };
  const cap = { cat: 'CAPTIVE', n: 'Captive: Victim', d: '', ref: { cid: 'tgt' } };
  return { pools: { A: 9, B: 9 }, fog: {}, board: { w: 10, h: 10, tiles: null }, combatants: {
    carrier: { party: 'A', w: [0, 4], x: 4, y: 4, dead: true,
      model: { n: 'Captor', loadout: { slots: [{ type: 'ITEM', it: cap }] } } },
    buddy: { party: 'B', w: [3, 3], x: 5, y: 4, model: { n: 'Buddy', loadout: { slots: [] } } },
    tgt: captive } };
}
function freeBlock() {
  return [{ actor: 'buddy', cost: 1, effect: { kind: 'free', corpse: 'carrier', cid: 'tgt' } }];
}

test('ally frees the captive from the dead carrier', () => {
  const s = capturedState();
  assert.ok(THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
  THREAD.apply(T, s, freeBlock(), CANON);
  const tgt = s.combatants.tgt;
  assert.ok(!tgt.captured);
  assert.deepStrictEqual([tgt.x, tgt.y, tgt.w[0]], [4, 4, 1]);
  assert.strictEqual(s.combatants.carrier.model.loadout.slots[0].it, null);
});
test('validate rejects: freeing from a living carrier', () => {
  const s = capturedState(); s.combatants.carrier.dead = false; s.combatants.carrier.w = [2, 4];
  assert.ok(!THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
});
test('validate rejects: not adjacent to the corpse', () => {
  const s = capturedState(); s.combatants.buddy.x = 9;
  assert.ok(!THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
});
test("validate rejects: enemy of the captive can't 'free' it", () => {
  const s = capturedState();
  s.combatants.buddy.party = 'A';
  assert.ok(!THREAD.validate(T, s, 'A', freeBlock(), CANON).ok);
});
