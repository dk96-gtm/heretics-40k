const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── T-CMB-1 · Task 1: registry, normalisation, mods ── */

test('normCond: legacy tier strings become instances with full clocks', () => {
  assert.deepStrictEqual(THREAD.normCond('Regen II'),
    { tag: 'Regen', tier: 2, left: 4, src: null, el: null });   // duration 2+t
  assert.deepStrictEqual(THREAD.normCond('DoT III'),
    { tag: 'DoT', tier: 3, left: 5, src: null, el: null });
  assert.strictEqual(THREAD.normCond('Cast: Catalyst'), null);  // label junk drops
  const inst = { tag: 'Marked', tier: 1, left: 2, src: 'x', el: null };
  assert.strictEqual(THREAD.normCond(inst), inst);              // instances pass through
});

test('normCond: unknown tags become inert instances (left Infinity)', () => {
  const b = THREAD.normCond('Burning IV');
  assert.strictEqual(b.tag, 'Burning');
  assert.strictEqual(b.left, Infinity);
});

test('condMods: sums penalties and bonuses across instances', () => {
  const c = { conds: [
    { tag: 'Slowing', tier: 2, left: 1 },
    { tag: 'Suppressing', tier: 3, left: 3 },   // −1 action regardless of tier
    { tag: 'Rally', tier: 2, left: 1 },
    { tag: 'Charging', tier: 1, left: 1 },
    { tag: 'Marked', tier: 2, left: 3 },
    { tag: 'Burning', tier: 4, left: Infinity }, // unknown: contributes nothing
  ], w: [10, 10] };
  assert.deepStrictEqual(THREAD.condMods(c),
    { speed: -2, actions: -1, dmgOut: 2, dmgOutMelee: 1, dmgIn: 2 });
});

test('actionCap: base 3, Suppressing −1, Injured caps at 2, Critical at 1', () => {
  const fresh = { conds: [], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(fresh, canon), 3);
  const pinned = { conds: [{ tag: 'Suppressing', tier: 1, left: 1 }], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(pinned, canon), 2);
  const injured = { conds: [], w: [5, 10] };                    // ≤ half → Injured
  assert.strictEqual(THREAD.actionCap(injured, canon), 2);
  const critical = { conds: [], w: [1, 10] };                   // last band → Critical
  assert.strictEqual(THREAD.actionCap(critical, canon), 1);
  const both = { conds: [{ tag: 'Suppressing', tier: 2, left: 2 }], w: [1, 10] };
  assert.strictEqual(THREAD.actionCap(both, canon), 1);         // caps don't stack below 1
});
