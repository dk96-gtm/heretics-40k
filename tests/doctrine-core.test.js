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

test('shouldRetreat: an annihilated side (no living deployed models) never retreats', () => {
  // whole-branch review FIX 1 defense-in-depth: alive===0 must short-circuit even with
  // high pragmatism and no prior retreat attempt — a wiped side cannot flee.
  const allDead = mkSide([[70,true],[30,true]]);   // 100 PC total, 0 alive
  assert.strictEqual(THREAD.shouldRetreat('B', allDead, CANON), false, 'all dead → false');

  // captured models count as "lost" (not counted alive) same as dead — a side left with
  // only captured + dead models is equally annihilated for retreat purposes.
  const C = {
    b0: { party: 'B', dead: false, captured: true, model: { pc: 70 }, x: 0, y: 0 },
    b1: { party: 'B', dead: true, model: { pc: 30 }, x: 0, y: 1 },
    p0: { party: 'A', dead: false, model: { pc: 10 }, x: 5, y: 5 },
  };
  const capturedPlusDead = { combatants: C, behavior: { B: { ferocity:50,cunning:50,pragmatism:90,honor:50,supremacism:50 } } };
  assert.strictEqual(THREAD.shouldRetreat('B', capturedPlusDead, CANON), false, 'captured+dead only → false');
});

/* ── T-NPC-4 Task 3 · npcTurn style targeting + honor conduct ─────────
   board/weaponsOf fixtures mirror tests/npc-turn.test.js: an all-open
   board (LOS always clear, every tile passable), weaponsOf(c) reading a
   test-attached `.weps` list. `model:{pc}` is added for doctrine's
   pc-based picks (decapitation / honor-high leader / commander). */
function openBoard(w, h) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'open' });
  return { w, h, tiles, zones: {} };
}
const wep = (c) => c.weps || [];
const SHORT_W = { name: 'Bolt Pistol', band: 'SHORT', ap: 2, damage: 3, element: 'Physical' };
// production-shaped uppercase band (matches bfItemBand's live output) — BAND_MAX's
// myMax lookup lowercases before reading the table, so this exercises the kite
// branch through the same data shape the live engine feeds npcTurn.
const MEDIUM_W = { name: 'Autocannon', band: 'MEDIUM', ap: 1, damage: 2, element: null };
const NCANON = { rules: {} };
const cheb2 = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

test('npcTurn culling: side targets the fewest-wounds enemy', () => {
  const behavior = { ferocity: 10, cunning: 90, pragmatism: 50, honor: 50, supremacism: 10 };
  const state = {
    pools: { B: 10 },
    combatants: {
      b0: { party: 'B', x: 0, y: 0, w: [10, 10], sight: 20, spd: 8, model: { pc: 10 }, weps: [SHORT_W] },
      a0: { party: 'A', x: 4, y: 0, w: [3, 3], sight: 20, spd: 0, model: { pc: 5 } },
      a1: { party: 'A', x: 7, y: 7, w: [1, 3], sight: 20, spd: 0, model: { pc: 20 } }, // fewest wounds, biggest pc
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack');
  assert.strictEqual(atk.effect.to, 'a1', 'targets the fewest-wounds enemy over the nearer, healthier a0');
});

test('npcTurn decapitation: side targets the highest-pc enemy', () => {
  const behavior = { ferocity: 10, cunning: 10, pragmatism: 50, honor: 50, supremacism: 90 };
  function mk(a0pc, a1pc) {
    return {
      pools: { B: 10 },
      combatants: {
        b0: { party: 'B', x: 0, y: 0, w: [10, 10], sight: 20, spd: 8, model: { pc: 10 }, weps: [SHORT_W] },
        a0: { party: 'A', x: 4, y: 0, w: [3, 3], sight: 20, spd: 0, model: { pc: a0pc } },
        a1: { party: 'A', x: 7, y: 7, w: [3, 3], sight: 20, spd: 0, model: { pc: a1pc } }, // wounds tie — pc decides
      },
    };
  }
  let state = mk(5, 20);
  let block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  let atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack');
  assert.strictEqual(atk.effect.to, 'a1', 'targets the bigger a1 (pc 20)');

  state = mk(20, 5);   // swap the biggest model to a0
  block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack');
  assert.strictEqual(atk.effect.to, 'a0', 'target follows pc, not identity — now the bigger a0 (pc 20)');
});

test('npcTurn onslaught: nearest, legacy behavior (no behavior arg, no state.behavior)', () => {
  const state = {
    pools: { B: 10 },
    combatants: {
      b0: { party: 'B', x: 0, y: 0, w: [10, 10], sight: 20, spd: 8, model: { pc: 10 }, weps: [SHORT_W] },
      a0: { party: 'A', x: 2, y: 0, w: [3, 3], sight: 20, spd: 0, model: { pc: 5 } },   // nearest
      a1: { party: 'A', x: 7, y: 7, w: [1, 3], sight: 20, spd: 0, model: { pc: 20 } },  // fewest wounds AND biggest — ignored
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON);   // no behavior arg at all
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack');
  assert.strictEqual(atk.effect.to, 'a0', 'nearest enemy targeted — the pre-NPC-4 result');
});

test('npcTurn honor high: commander duels the enemy leader; Critical spared; all-Critical holds fire', () => {
  const behavior = { ferocity: 50, cunning: 50, pragmatism: 50, honor: 80, supremacism: 50 };
  function mk(a0w, a1w) {
    return {
      pools: { B: 10 },
      combatants: {
        b0: { party: 'B', x: 0, y: 0, w: [10, 10], sight: 20, spd: 8, model: { pc: 10 }, weps: [SHORT_W] },
        a0: { party: 'A', x: 1, y: 0, w: a0w, sight: 20, spd: 0, model: { pc: 5 } },    // adjacent — a tempting nearest
        a1: { party: 'A', x: 7, y: 7, w: a1w, sight: 20, spd: 0, model: { pc: 20 } },   // the leader (highest pc)
      },
    };
  }
  // phase 1: a0 Critical, a1 healthy → the commander duels the leader (a1); a0 is never hit
  let state = mk([1, 3], [3, 3]);
  let block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  const dmgs = block.filter((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(dmgs.length >= 1, 'stages an attack');
  assert.ok(dmgs.every((b) => b.effect.to === 'a1'), 'the commander duels the leader a1, never the Critical a0');

  // phase 2: BOTH Critical → mercy holds fire — moves only, zero damage effects
  state = mk([1, 3], [1, 3]);
  block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  assert.strictEqual(block.filter((b) => b.effect && b.effect.kind === 'damage').length, 0,
    'all spotted enemies Critical → hold-fire pin, zero damage effects');
});

test('npcTurn honor low: finishes the wounded first', () => {
  const behavior = { ferocity: 50, cunning: 50, pragmatism: 50, honor: 10, supremacism: 50 };
  const state = {
    pools: { B: 10 },
    combatants: {
      b0: { party: 'B', x: 0, y: 0, w: [10, 10], sight: 20, spd: 8, model: { pc: 10 }, weps: [SHORT_W] },
      a0: { party: 'A', x: 1, y: 0, w: [3, 3], sight: 20, spd: 0, model: { pc: 5 } },   // adjacent, healthy — nearest
      a1: { party: 'A', x: 7, y: 7, w: [1, 3], sight: 20, spd: 0, model: { pc: 20 } },  // Critical, distant
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 10), wep, NCANON, behavior);
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack');
  assert.strictEqual(atk.effect.to, 'a1', 'retargets to the Critical a1 over the nearer, healthy a0');
});

test('npcTurn culling kite: adjacent enemy → steps back, keeps target in band', () => {
  const behavior = { ferocity: 10, cunning: 90, pragmatism: 50, honor: 50, supremacism: 10 };
  const state = {
    pools: { B: 10 },
    combatants: {
      b0: { party: 'B', x: 3, y: 3, w: [10, 10], sight: 20, spd: 5, model: { pc: 10 }, weps: [MEDIUM_W] },
      a0: { party: 'A', x: 3, y: 4, w: [3, 3], sight: 20, spd: 0, model: { pc: 5 } },   // adjacent (cheb 1)
      a1: { party: 'A', x: 3, y: 6, w: [1, 3], sight: 20, spd: 0, model: { pc: 20 } },  // weakest — the culling target
    },
  };
  const before = { x: 3, y: 3 };
  const nearestBefore = Math.min(cheb2(before, { x: 3, y: 4 }), cheb2(before, { x: 3, y: 6 }));
  assert.strictEqual(nearestBefore, 1, 'sanity: b0 starts adjacent to a0');

  const block = THREAD.npcTurn('B', state, openBoard(8, 8), wep, NCANON, behavior);
  const mv = block.find((b) => b.effect && b.effect.kind === 'move');
  assert.ok(mv, 'stages a kiting move');
  const to = mv.effect.to;
  const minDistAfter = Math.min(cheb2(to, { x: 3, y: 4 }), cheb2(to, { x: 3, y: 6 }));
  assert.ok(minDistAfter > nearestBefore, 'the move increases min-distance to all spotted enemies');
  assert.ok(cheb2(to, { x: 3, y: 6 }) <= 6, 'target (a1, medium band max 6) stays within reach of the new cell');
});
