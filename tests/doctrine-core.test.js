const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

const CANON = { ai: { behavior_matrix: {
    testfac: { ferocity:{base:80,spread:10,plasticity:12,floor:60,ceiling:95},
               cunning:{base:30,spread:10,plasticity:12,floor:5,ceiling:55},
               pragmatism:{base:50,spread:10,plasticity:12,floor:25,ceiling:75},
               honor:{base:50,spread:10,plasticity:12,floor:25,ceiling:75},
               supremacism:{base:40,spread:10,plasticity:12,floor:15,ceiling:65} } } },
  rules: { doctrine: { styles:{ferocity:'onslaught',cunning:'culling',supremacism:'decapitation'},
    retreat:{base:110}, honor:{high:70,low:30}, lapse:{} } } };

test('AXES.rollFor: deterministic, bounded, faction-shaped', () => {
  const a = THREAD.AXES.rollFor('testfac', 'thread:t1', CANON);
  const b = THREAD.AXES.rollFor('testfac', 'thread:t1', CANON);
  assert.deepStrictEqual(a, b, 'same seed → same roll');
  const c = THREAD.AXES.rollFor('testfac', 'thread:t2', CANON);
  assert.notDeepStrictEqual(a, c, 'different seed → different roll');
  for (const [ax, v] of Object.entries(a)) {
    const row = CANON.ai.behavior_matrix.testfac[ax];
    assert.ok(v >= row.floor && v <= row.ceiling, `${ax} within [floor,ceiling]`);
  }
});

test('AXES.rollFor: unknown faction → flat 50s', () => {
  const a = THREAD.AXES.rollFor('nope', 'x', CANON);
  assert.deepStrictEqual(a, {ferocity:50,cunning:50,pragmatism:50,honor:50,supremacism:50});
});

test('doctrineOf: style argmax with FER>CUN>SUP tie order; honor gates; retreat curve', () => {
  const d1 = THREAD.doctrineOf({ferocity:80,cunning:30,pragmatism:90,honor:75,supremacism:40}, CANON);
  assert.strictEqual(d1.style, 'onslaught');
  assert.strictEqual(d1.honorMode, 'high');
  assert.ok(Math.abs(d1.retreatAt - 0.20) < 1e-9);
  const d2 = THREAD.doctrineOf({ferocity:30,cunning:80,pragmatism:10,honor:20,supremacism:80}, CANON);
  assert.strictEqual(d2.style, 'culling', 'CUN ties SUP → culling');
  assert.strictEqual(d2.honorMode, 'low');
  assert.ok(d2.retreatAt >= 1, 'prag 10 → never retreats');
  const d3 = THREAD.doctrineOf(null, CANON);
  assert.strictEqual(d3.style, 'onslaught');   // flat 50s tie → FER wins
  assert.strictEqual(d3.honorMode, 'none');
});

function mkSide(pcs) {   // helper: side 'B' combatants with given [pc, dead] pairs
  const C = {};
  pcs.forEach(([pc, dead], i) => { C['b'+i] = { party:'B', dead:!!dead, model:{pc:pc}, x:0, y:i }; });
  C['p0'] = { party:'A', dead:false, model:{pc:10}, x:5, y:5 };
  return { combatants:C, behavior:{ B:{ferocity:50,cunning:50,pragmatism:90,honor:50,supremacism:50} } };
}

test('shouldRetreat: fires at the pragmatism threshold, once, never without behavior', () => {
  // prag 90 → retreatAt 0.20. 100 PC total, 30 dead → L=0.30 ≥ 0.20 → retreat
  const st = mkSide([[70,false],[30,true]]);
  assert.strictEqual(THREAD.shouldRetreat('B', st, CANON), true);
  st.retreatTried = 1;
  assert.strictEqual(THREAD.shouldRetreat('B', st, CANON), false, 'one attempt per battle');
  const fresh = mkSide([[90,false],[10,true]]);   // L=0.10 < 0.20 → holds
  assert.strictEqual(THREAD.shouldRetreat('B', fresh, CANON), false);
  const noBeh = mkSide([[10,false],[90,true]]); delete noBeh.behavior;
  assert.strictEqual(THREAD.shouldRetreat('B', noBeh, CANON), false, 'no behavior → never');
});
