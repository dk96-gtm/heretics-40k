const test = require('node:test');
const assert = require('node:assert');
const { loadCadence } = require('./_load-cadence');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const CAD = loadCadence();
const ULT = loadAgency();

test('pOf clamps: floor, linear, cap', () => {
  assert.strictEqual(CAD.pOf(0, D), 0.005);
  assert.strictEqual(CAD.pOf(40, D), 0.1);
  assert.strictEqual(CAD.pOf(999, D), 0.25);
});

test('rollDay is deterministic and day-independent per sector', () => {
  const a = CAD.rollDay('sol', 100, 7, 40, ULT.rng, D);
  const b = CAD.rollDay('sol', 100, 7, 40, ULT.rng, D);
  assert.strictEqual(a, b);
  // over many days, hit rate tracks p (~10% at conflict 40)
  let hits = 0;
  for (let d = 0; d < 2000; d++) if (CAD.rollDay('sol', d, 7, 40, ULT.rng, D)) hits++;
  assert.ok(hits > 100 && hits < 320, 'hit rate ' + hits + '/2000 not ~10%');
});

test('pickAggressor favors ferocity, deterministic', () => {
  const present = [{ facId: 'world_eaters', ferocity: 90 }, { facId: 'tau', ferocity: 15 }];
  let we = 0;
  for (let d = 0; d < 500; d++)
    if (CAD.pickAggressor(present, d, 7, 'sol', ULT.rng, D) === 'world_eaters') we++;
  assert.ok(we > 350, 'ferocity weighting too weak: ' + we + '/500');
  assert.strictEqual(CAD.pickAggressor(present, 42, 7, 'sol', ULT.rng, D),
                     CAD.pickAggressor(present, 42, 7, 'sol', ULT.rng, D));
  assert.strictEqual(CAD.pickAggressor([], 1, 7, 'sol', ULT.rng, D), null);
});

test('legalTargets: matrix gate — imperial pairs never legal, WAR outweighs HOSTILE', () => {
  const cands = [
    { key: 'a', facId: 'militarum', isPlayer: false, garrisonPC: 200, crossRift: false },
    { key: 'b', facId: 'black_legion', isPlayer: false, garrisonPC: 200, crossRift: false },
    { key: 'c', facId: 'orks', isPlayer: false, garrisonPC: 200, crossRift: false }
  ];
  const fromAstartes = CAD.legalTargets('astartes', cands, D);
  assert.ok(!fromAstartes.some(t => t.key === 'a'), 'astartes may not target militarum (ALLIED)');
  const bl = fromAstartes.filter(t => t.key === 'b')[0]; // astartes↔black_legion = WAR (−3)
  const ok = fromAstartes.filter(t => t.key === 'c')[0]; // astartes↔orks = HOSTILE (−2)
  assert.ok(bl.w === ok.w * D.rules.cadence.war_weight, 'WAR weight must be ×war_weight');
});

test('legalTargets: weakness — more garrison, less weight (monotone)', () => {
  const mk = (pc) => [{ key: 'x', facId: 'orks', isPlayer: false, garrisonPC: pc, crossRift: false }];
  const thin = CAD.legalTargets('astartes', mk(100), D)[0].w;
  const thick = CAD.legalTargets('astartes', mk(800), D)[0].w;
  assert.ok(thin > thick, 'stationing must deter');
});

test('applyPlayerCap retargets deterministically, else drops', () => {
  const list = [
    { key: 'p', isPlayer: true, w: 9 },
    { key: 'n1', isPlayer: false, w: 5 },
    { key: 'n2', isPlayer: false, w: 7 }
  ];
  assert.strictEqual(CAD.applyPlayerCap(list, list[0], 2, D).key, 'n2');
  assert.strictEqual(CAD.applyPlayerCap(list, list[0], 1, D).key, 'p');
  assert.strictEqual(CAD.applyPlayerCap([list[0]], list[0], 2, D), null);
});

test('scaleFor: invasion needs 2× muster AND a planet target', () => {
  assert.strictEqual(CAD.scaleFor(900, 400, true, D), 'INVASION');
  assert.strictEqual(CAD.scaleFor(700, 400, true, D), 'SKIRMISH');
  assert.strictEqual(CAD.scaleFor(900, 400, false, D), 'SKIRMISH');
});

/* ── N2 final fix wave (M5): the imperial↔imperial invariant as a full-matrix property sweep,
   not the single sampled pair the shipped tests covered. Every ordered pair of imperial
   factions must be un-targetable: canon's standing matrix never puts two imperial factions at
   or below the cadence gate, so the Imperium never raids itself on the far lane. ── */
test('legalTargets: NO imperial↔imperial pair is ever a legal target (full matrix)', () => {
  const imperial = D.factions.filter(f => f.allegiance === 'imperial').map(f => f.id);
  assert.ok(imperial.length >= 5, 'canon should carry the 5 imperial factions, got ' + imperial.length);
  imperial.forEach(agg => {
    imperial.forEach(tgt => {
      const cands = [{ key: tgt, facId: tgt, isPlayer: false, garrisonPC: 200, crossRift: false }];
      const legal = CAD.legalTargets(agg, cands, D);
      assert.strictEqual(legal.length, 0,
        'imperial pair became legal: ' + agg + ' → ' + tgt);
    });
  });
});

test('legalTargets: the sweep is a real gate, not a vacuous pass (a cross-allegiance pair IS legal)', () => {
  const legal = CAD.legalTargets('militarum',
    [{ key: 'x', facId: 'black_legion', isPlayer: false, garrisonPC: 200, crossRift: false }], D);
  assert.strictEqual(legal.length, 1, 'militarum must still be able to raid the Black Legion');
});
