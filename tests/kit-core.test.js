const test = require('node:test');
const assert = require('node:assert');
const { loadKit } = require('./_load-kit');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const KIT = loadKit(); const ULT = loadAgency();

test('legalFor: commons + own faction only, never another faction', () => {
  const rows = KIT.legalFor('death_guard', 'ITEM', D);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(r => !r.faction || r.faction === 'death_guard'));
});

test('mint respects the depth ladder and cast rank gates', () => {
  const grunt = KIT.mint('orks', {rk:1, cls:'Core', sub:'Boy - R1 - 1 slot'}, 7, ULT.rng, D);
  assert.strictEqual(grunt.abilities.length, 0);
  assert.strictEqual(grunt.casts.length, 0);
  assert.ok(grunt.items.length <= 1);
  const vet = KIT.mint('thousand_sons', {rk:4, cls:'Core', sub:'Rubric - R4 - 5 slots'}, 7, ULT.rng, D);
  assert.strictEqual(vet.abilities.length, 1);
  assert.ok(vet.casts.every(c => (function(){var m=/^R(\d+)\b/.exec(c.d||'');return (m?+m[1]:1)<=4;})()),
    'no cast above the model rank');
});

test('mint is deterministic per seed and varies across seeds', () => {
  const a = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, 42, ULT.rng, D);
  const b = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, 42, ULT.rng, D);
  assert.deepStrictEqual(a, b);
  let differed = false;
  for (let s = 0; s < 20 && !differed; s++) {
    const c = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, s, ULT.rng, D);
    if (JSON.stringify(c) !== JSON.stringify(a)) differed = true;
  }
  assert.ok(differed, 'different seeds must be able to mint different kits');
});

test('property: all 20 factions mint only faction-legal gear at every rank', () => {
  D.factions.forEach(f => { for (let rk = 1; rk <= 5; rk++) {
    const kit = KIT.mint(f.id, {rk, cls:'Core', sub:'x'}, rk * 31 + 7, ULT.rng, D);
    ['items','abilities','casts'].forEach(k =>
      kit[k].forEach(it => assert.ok(!it.faction || it.faction === f.id,
        f.id + ' rank ' + rk + ' minted foreign ' + k + ': ' + it.n)));
  }});
});

// T-NPC-3.5 task 7 — the pinned failing case from the brief: 2 casters / 3 ability carriers
// against canon's rules.npc_brain.lapse_kit_nudge {per_caster:0.004, per_ability:0.002, cap:0.03}
// ⇒ 1 + min(0.03, 2*0.004 + 3*0.002) = 1.014 exactly, and the printed arithmetic reads "kit ×1.01".
test('kitMult: 2 casters/3 ability carriers ⇒ ×1.014 exactly (canon-read, never hardcoded)', () => {
  const mult = KIT.kitMult({ casters: 2, abilityCarriers: 3 }, D);
  assert.strictEqual(mult, 1.014);
  const arith = KIT.kitNudgeArith(mult, false);
  assert.ok(/kit ×1\.01(?!\d)/.test(arith), 'arith must contain "kit ×1.01": ' + arith);
});

test('kitMult: caps at rules.npc_brain.lapse_kit_nudge.cap, never exceeds it', () => {
  const mult = KIT.kitMult({ casters: 50, abilityCarriers: 50 }, D);
  assert.strictEqual(mult, 1.03);
});

test('kitMult: zero depth is a true no-op (×1, no floating drift)', () => {
  assert.strictEqual(KIT.kitMult({ casters: 0, abilityCarriers: 0 }, D), 1);
  assert.strictEqual(KIT.kitMult({}, D), 1);
});

test('kitDepth feeds kitMult directly off minted NPC combatants', () => {
  const combatants = {
    a: { gen: { kit: { casts: [{ n: 'x' }], abilities: [] } } },
    b: { gen: { kit: { casts: [{ n: 'y' }], abilities: [{ n: 'z' }] } } },
    c: { gen: { kit: { casts: [], abilities: [{ n: 'w' }] } } },
    p: { model: { n: 'Player Model' } }               // a player combatant — no gen.kit, never counted
  };
  const depth = KIT.kitDepth(combatants);
  assert.deepStrictEqual(depth, { casters: 2, abilityCarriers: 2 });
  assert.strictEqual(KIT.kitMult(depth, D), 1 + Math.min(0.03, 2 * 0.004 + 2 * 0.002));
});

// resolveFarBattle has no real combatants to measure (no detachment is ever spawned for a
// far-lane roll) — the brief's approximation sizes depth off the muster PC alone, mirroring
// mintNpcClock's own avg-Core-pc sizing discipline elsewhere in the engine.
test('syntheticDepth: approximates kit depth from muster alone (round(muster/600), round(muster/300))', () => {
  assert.deepStrictEqual(KIT.syntheticDepth(600), { casters: 1, abilityCarriers: 2 });
  assert.deepStrictEqual(KIT.syntheticDepth(1800), { casters: 3, abilityCarriers: 6 });
  assert.deepStrictEqual(KIT.syntheticDepth(0), { casters: 0, abilityCarriers: 0 });
});

test('kitNudgeArith: synthetic note is stated inline, never silently folded in', () => {
  const arith = KIT.kitNudgeArith(1.02, true);
  assert.ok(/kit ×1\.02/.test(arith));
  assert.ok(/synthetic/i.test(arith), 'must say synthetic: ' + arith);
});
