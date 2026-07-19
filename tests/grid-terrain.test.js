const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

/* ── Slice B · terrain + generator ────────────────────────────────────
   Terrain-aware movement (difficult costs 2, impassable blocks), LOS
   blocking by opaque terrain, cover lookup, and a deterministic board
   generator driven by an injected seeded RNG. Terrain config is built-in
   (canon-sourcing deferred). No fog yet (Slice C). */

// seeded PRNG for deterministic generator tests (mulberry32) — lives in the
// test, not the core; genBoard consumes an injected rng() so it stays pure.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// hand-author a small board: map is {'x,y':'terrainKey'}, rest 'open'
function board(w, h, map) {
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push({ t: (map && map[x + ',' + y]) || 'open' });
  return { w, h, tiles };
}

test('reachable: difficult terrain (forest/ruins) costs 2 to enter', () => {
  const b = board(5, 1, { '1,0': 'forest' });
  const r = THREAD.reachable({ x: 0, y: 0 }, 2, b, []);
  assert.ok(r['1,0'], 'forest tile reachable — entry cost 2 equals Speed');
  assert.ok(!r['2,0'], 'beyond the forest costs 3 (2+1) > Speed 2');
});

test('reachable: impassable terrain blocks entry and passage', () => {
  const b = board(5, 1, { '1,0': 'mtn' });
  const r = THREAD.reachable({ x: 0, y: 0 }, 4, b, []);
  assert.ok(!r['1,0'], 'cannot enter a mountain');
  assert.ok(!r['2,0'], 'cannot pass the wall to reach beyond it');
});

test('reachable: impassable can be gone around in 2D', () => {
  const b = board(3, 3, { '1,1': 'fort' });
  const r = THREAD.reachable({ x: 1, y: 0 }, 2, b, []);
  assert.ok(!r['1,1'], 'cannot enter the fort');
  assert.ok(r['1,2'], 'reached via a diagonal path around it (cost 2)');
});

test('reachable: open board with no tiles behaves as Slice A (backward-compatible)', () => {
  const r = THREAD.reachable({ x: 5, y: 5 }, 2, { w: 10, h: 10 }, []);
  assert.strictEqual(Object.keys(r).length, 24);
});

test('lineOfSight: clear across open ground', () => {
  assert.strictEqual(THREAD.lineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, board(5, 1, {})), true);
});

test('lineOfSight: opaque terrain between the two blocks sight', () => {
  assert.strictEqual(THREAD.lineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, board(5, 1, { '2,0': 'mtn' })), false);
});

test('lineOfSight: non-opaque terrain (forest) does not block', () => {
  assert.strictEqual(THREAD.lineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, board(5, 1, { '2,0': 'forest' })), true);
});

test('lineOfSight: opaque terrain ON an endpoint does not block (target visible on cover)', () => {
  assert.strictEqual(THREAD.lineOfSight({ x: 0, y: 0 }, { x: 4, y: 0 }, board(5, 1, { '4,0': 'mtn' })), true);
});

test('coverMod: none / light / heavy per terrain', () => {
  const b = board(3, 1, { '0,0': 'forest', '1,0': 'ruins' });
  assert.strictEqual(THREAD.coverMod({ x: 0, y: 0 }, b), 1, 'forest = light cover');
  assert.strictEqual(THREAD.coverMod({ x: 1, y: 0 }, b), 2, 'ruins = heavy cover');
  assert.strictEqual(THREAD.coverMod({ x: 2, y: 0 }, b), 0, 'open = no cover');
});

test('coverMod: fortification grants heavy cover', () => {
  assert.strictEqual(THREAD.coverMod({ x: 0, y: 0 }, board(2, 1, { '0,0': 'fort' })), 2);
});

test('genBoard: correct dimensions and only valid terrain keys', () => {
  const g = THREAD.genBoard({ w: 12, h: 10, density: 0.2, palette: ['forest', 'ruins', 'mtn', 'fort'] }, mulberry32(42));
  assert.strictEqual(g.w, 12);
  assert.strictEqual(g.h, 10);
  assert.strictEqual(g.tiles.length, 120);
  const valid = { open: 1, forest: 1, ruins: 1, mtn: 1, fort: 1 };
  assert.ok(g.tiles.every((t) => valid[t.t]), 'every tile has a valid terrain key');
});

test('genBoard: deterministic — same seed yields an identical board', () => {
  const cfg = { w: 12, h: 10, density: 0.25, palette: ['forest', 'mtn'] };
  assert.deepStrictEqual(THREAD.genBoard(cfg, mulberry32(7)), THREAD.genBoard(cfg, mulberry32(7)));
});

test('genBoard: different seeds produce different terrain', () => {
  const cfg = { w: 12, h: 10, density: 0.25, palette: ['forest', 'mtn'] };
  assert.notDeepStrictEqual(THREAD.genBoard(cfg, mulberry32(1)).tiles, THREAD.genBoard(cfg, mulberry32(2)).tiles);
});

test('genBoard: deployment zones on opposite edges, in-bounds, kept passable', () => {
  const g = THREAD.genBoard({ w: 12, h: 10, density: 0.5, palette: ['mtn', 'fort'], zoneDepth: 2 }, mulberry32(99));
  assert.deepStrictEqual(g.zones.A, { x0: 0, y0: 0, x1: 1, y1: 9 }, 'zone A hugs the left edge');
  assert.deepStrictEqual(g.zones.B, { x0: 10, y0: 0, x1: 11, y1: 9 }, 'zone B hugs the right edge');
  const clear = (z) => {
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) {
      const t = g.tiles[y * g.w + x].t;
      if (t === 'mtn' || t === 'fort') return false;
    }
    return true;
  };
  assert.ok(clear(g.zones.A) && clear(g.zones.B), 'zones free of impassable terrain even at high density');
});

test('genBoard: palette respected — only listed terrain (plus open) appears', () => {
  const g = THREAD.genBoard({ w: 10, h: 10, density: 0.3, palette: ['forest'], zoneDepth: 2 }, mulberry32(5));
  assert.ok(g.tiles.every((t) => t.t === 'open' || t.t === 'forest'), 'only open + forest present');
});
