// tests/spoils-capture.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: {
  spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
            capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1,
            sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8 } } } } };
const SHACKLES = { n: 'Shackles', cat: 'ITEM', d: 'Capture I - restraints' };

function mkState() {
  return { pools: { A: 9, B: 9 }, fog: {},
    board: { w: 10, h: 10, tiles: null },   // tile-less board = all open (existing convention)
    combatants: {
      atk: { party: 'A', w: [4, 4], x: 2, y: 2, sight: 2, model: { n: 'Captor', pc: 10, cls: 'Core',
        loadout: { slots: [{ type: 'ITEM', it: SHACKLES }, { type: 'ITEM', it: null }] } } },
      tgt: { party: 'B', w: [1, 4], x: 3, y: 2, model: { n: 'Victim', pc: 8, cls: 'Core',
        loadout: { slots: [] } } }
    } };
}
const T = { type: 'SKIRMISH' };
function capBlock(cost) {
  return [{ actor: 'atk', cost: cost == null ? 3 : cost, item: SHACKLES,
            effect: { kind: 'capture', to: 'tgt' } }];
}

test('captureTier parses I/II/III', () => {
  assert.strictEqual(THREAD.captureTier(SHACKLES), 'I');
  assert.strictEqual(THREAD.captureTier({ d: 'Capture III - x' }), 'III');
  assert.strictEqual(THREAD.captureTier({ d: 'Phys 2 - Melee' }), null);
});
test('valid capture passes validate and applies', () => {
  const s = mkState();
  assert.ok(THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
  THREAD.apply(T, s, capBlock(), CANON);
  const tgt = s.combatants.tgt;
  assert.ok(tgt.captured); assert.strictEqual(tgt.x, null);
  const slot = s.combatants.atk.model.loadout.slots[1];
  assert.ok(slot.it && slot.it.cat === 'CAPTIVE');
  assert.strictEqual(slot.it.ref.cid, 'tgt');
  assert.match(slot.it.n, /Victim/);
});
test('validate rejects: target not at exactly 1 wound', () => {
  const s = mkState(); s.combatants.tgt.w = [2, 4];
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: out of melee range', () => {
  const s = mkState(); s.combatants.tgt.x = 6;
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: no Capture item in the block', () => {
  const s = mkState();
  const b = capBlock(); b[0].item = { n: 'Sword', d: 'Phys 2 - Melee - 1 AP' };
  assert.ok(!THREAD.validate(T, s, 'A', b, CANON).ok);
});
test('validate rejects: no empty slot on the captor', () => {
  const s = mkState();
  s.combatants.atk.model.loadout.slots[1].it = { n: 'Rock', cat: 'ITEM', d: '' };
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: wrong AP cost for tier', () => {
  const s = mkState();
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(1), CANON).ok);   // Capture I costs 3
});
test('capturing the last standing enemy ends the battle', () => {
  const s = mkState();
  THREAD.apply(T, s, capBlock(), CANON);
  const oc = THREAD.outcome({ type: 'SKIRMISH' }, s);
  assert.ok(oc && oc.kind === 'annihilation' && oc.victor === 'A');
});
test('combatCatalog lists a standing Capture action for the holder', () => {
  const s = mkState();
  const acts = THREAD.catalog(T, s, 'A', CANON);
  const cap = acts.find(a => a.kind === 'capture');
  assert.ok(cap && cap.actor === 'atk' && cap.cost === 3);
});

// ── Finding 1: capture must honour fog of war ──
test('validate rejects: capture target not spotted (fog of war)', () => {
  const s = mkState();
  s.combatants.atk.sight = 0;   // no friendly can see anything -> spottedEnemies returns []
  const res = THREAD.validate(T, s, 'A', capBlock(), CANON);
  assert.ok(!res.ok);
  assert.match(res.reason, /fog of war/);
});

// ── Finding 2: multi-entry block validate/apply asymmetry ──
test('validate rejects: one captor, one empty slot, two capture entries', () => {
  const s = mkState();
  s.combatants.tgt2 = { party: 'B', w: [1, 4], x: 2, y: 3, model: { n: 'Victim2', pc: 8, cls: 'Core',
    loadout: { slots: [] } } };
  const block = [
    { actor: 'atk', cost: 3, item: SHACKLES, effect: { kind: 'capture', to: 'tgt' } },
    { actor: 'atk', cost: 3, item: SHACKLES, effect: { kind: 'capture', to: 'tgt2' } },
  ];
  assert.ok(!THREAD.validate(T, s, 'A', block, CANON).ok);
});
test('validate rejects: two captors targeting the same captive in one block', () => {
  const s = mkState();
  s.combatants.atk2 = { party: 'A', w: [4, 4], x: 4, y: 2, sight: 2, model: { n: 'Captor2', pc: 10, cls: 'Core',
    loadout: { slots: [{ type: 'ITEM', it: SHACKLES }, { type: 'ITEM', it: null }] } } };
  const block = [
    { actor: 'atk', cost: 3, item: SHACKLES, effect: { kind: 'capture', to: 'tgt' } },
    { actor: 'atk2', cost: 3, item: SHACKLES, effect: { kind: 'capture', to: 'tgt' } },
  ];
  assert.ok(!THREAD.validate(T, s, 'A', block, CANON).ok);
});
