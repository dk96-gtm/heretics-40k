// tests/spoils-loot.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
  capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1, sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8, Warp: 3 } } } } };
const T = { type: 'SKIRMISH' };

function afterState() {
  return { pools: { A: 9 }, fog: {}, phase: 'aftermath', board: { w: 10, h: 10, tiles: null },
    combatants: {
      me: { party: 'A', w: [4, 4], x: 4, y: 4, model: { n: 'Winner', pc: 10,
        loadout: { slots: [{ type: 'ITEM', it: null }] } } },
      corpse: { party: 'B', w: [0, 4], x: 5, y: 4, dead: true, killElement: 'Warp',
        revivalWindow: 3, permaDeath: false, model: { n: 'Fallen', pc: 8, loadout: { slots: [
          { type: 'WEAPON', it: { n: 'Rustblade', cat: 'WEAPON', d: 'Phys 2 - Melee - 1 AP' } } ] } } } } };
}
test('loot gear: pieces move to state.spoils, corpse keeps its body', () => {
  const s = afterState();
  const b = [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }];
  assert.ok(THREAD.validate(T, s, 'A', b, CANON).ok);
  THREAD.apply(T, s, b, CANON);
  assert.strictEqual(s.spoils.length, 1);
  assert.strictEqual(s.spoils[0].n, 'Rustblade');
  assert.strictEqual(s.combatants.corpse.model.loadout.slots[0].it, null);
  assert.ok(!s.combatants.corpse.looted);   // body still there - gear and body loot are separate
});
test('loot body: REMAINS fills an empty slot, window carries the kill element', () => {
  const s = afterState();
  const b = [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body', meta: { day: 100 } } }];
  THREAD.apply(T, s, b, CANON);
  const it = s.combatants.me.model.loadout.slots[0].it;
  assert.ok(it && it.cat === 'REMAINS');
  assert.match(it.n, /Fallen/);
  assert.deepStrictEqual(it.window, { element: 'Warp', expiresDay: 103 });
  assert.ok(s.combatants.corpse.looted);
});
test('permadeath body: REMAINS has no revival window', () => {
  const s = afterState();
  s.combatants.corpse.permaDeath = true; s.combatants.corpse.revivalWindow = 0;
  THREAD.apply(T, s, [{ actor: 'me', cost: 1,
    effect: { kind: 'loot', corpse: 'corpse', what: 'body', meta: { day: 100 } } }], CANON);
  assert.strictEqual(s.combatants.me.model.loadout.slots[0].it.window, null);
});
test('validate rejects: looting outside the aftermath', () => {
  const s = afterState(); s.phase = null;
  assert.ok(!THREAD.validate(T, s, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }], CANON).ok);
});
test('validate rejects: body loot with no empty slot', () => {
  const s = afterState();
  s.combatants.me.model.loadout.slots[0].it = { n: 'Rock', cat: 'ITEM', d: '' };
  assert.ok(!THREAD.validate(T, s, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } }], CANON).ok);
});
test('validate rejects: looting a living model or twice-looted body', () => {
  const s1 = afterState(); s1.combatants.corpse.dead = false;
  assert.ok(!THREAD.validate(T, s1, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }], CANON).ok);
  const s2 = afterState(); s2.combatants.corpse.looted = true;
  assert.ok(!THREAD.validate(T, s2, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } }], CANON).ok);
});
test('validate rejects: two body-loots of the SAME corpse in one block (no double REMAINS)', () => {
  const s = afterState();
  s.combatants.other = { party: 'A', w: [4, 4], x: 6, y: 4,
    model: { n: 'Other', pc: 10, loadout: { slots: [{ type: 'ITEM', it: null }] } } };
  const b = [
    { actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } },
    { actor: 'other', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } }];
  assert.ok(!THREAD.validate(T, s, 'A', b, CANON).ok);
  assert.ok(!s.combatants.corpse.looted);   // mixed-integrity: rejected block never touched state
});
test('validate rejects: one actor with one empty slot body-looting two DIFFERENT corpses', () => {
  const s = afterState();
  s.combatants.corpse2 = { party: 'B', w: [0, 4], x: 4, y: 5, dead: true, killElement: 'Warp',
    revivalWindow: 3, permaDeath: false, model: { n: 'Fallen2', pc: 8, loadout: { slots: [] } } };
  const b = [
    { actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } },
    { actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse2', what: 'body' } }];
  assert.ok(!THREAD.validate(T, s, 'A', b, CANON).ok);
});
