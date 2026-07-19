const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadLoadout } = require('./_load-loadout');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const L = loadLoadout();

test('mitigate floors at 0 and subtracts per element', () => {
  const def = { Physical: 3, Corrosive: 0 };
  assert.strictEqual(L.mitigate(2, 'Physical', def), 0); // fully turned
  assert.strictEqual(L.mitigate(4, 'Physical', def), 1);
  assert.strictEqual(L.mitigate(2, 'Corrosive', def), 2); // 0 def = bypass
  assert.strictEqual(L.mitigate(3, 'Heat', def), 3); // missing element = 0 def
  assert.strictEqual(L.mitigate(1, 'Physical', null), 1); // no armour
});

test('slotCount = base + rank growth by class', () => {
  // Core base 2 at R1 -> 2; at R4 -> +2 -> 4
  assert.strictEqual(L.slotCount('Core', 1, 2, canon), 2);
  assert.strictEqual(L.slotCount('Core', 4, 2, canon), 4);
  // Armament base 2 at R5 -> +4 -> 6
  assert.strictEqual(L.slotCount('Armament', 5, 2, canon), 6);
});

test('legalItems filters by slot type; canEquip enforces match', () => {
  const inv = [{ cat: 'WEAPON', n: 'Bolter' }, { cat: 'ITEM', n: 'Stim' }];
  assert.strictEqual(L.legalItems('WEAPON', inv).length, 1);
  assert.ok(L.canEquip({ type: 'WEAPON', it: null }, { cat: 'WEAPON' }));
  assert.ok(!L.canEquip({ type: 'WEAPON', it: null }, { cat: 'ITEM' }));
  assert.ok(!L.canEquip({ type: null, it: null }, { cat: 'WEAPON' })); // untyped
});

test('retypeSlot returns displaced item and re-types', () => {
  const slot = { type: 'WEAPON', it: { cat: 'WEAPON', n: 'Bolter' } };
  const displaced = L.retypeSlot(slot, 'ITEM');
  assert.strictEqual(displaced.n, 'Bolter');
  assert.strictEqual(slot.type, 'ITEM');
  assert.strictEqual(slot.it, null);
});
