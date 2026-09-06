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
