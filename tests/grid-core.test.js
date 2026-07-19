const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

/* ── Slice A · core geometry ──────────────────────────────────────────
   Pure grid math: Chebyshev distance, distance→band, speed-radius
   reachability. No terrain yet (Slice B), no fog (Slice C).
   Thresholds use built-in spec defaults; canon-sourcing lands later. */

test('cheb: Chebyshev distance — diagonals count as one step', () => {
  assert.strictEqual(THREAD.cheb({ x: 0, y: 0 }, { x: 3, y: 3 }), 3);   // pure diagonal
  assert.strictEqual(THREAD.cheb({ x: 0, y: 0 }, { x: 0, y: 5 }), 5);   // straight line
  assert.strictEqual(THREAD.cheb({ x: 2, y: 2 }, { x: 2, y: 2 }), 0);   // same square
  assert.strictEqual(THREAD.cheb({ x: 1, y: 4 }, { x: 5, y: 1 }), 4);   // max(|Δx|,|Δy|)
  assert.strictEqual(THREAD.cheb({ x: 5, y: 1 }, { x: 1, y: 4 }), 4);   // symmetric
});

test('bandOf: Chebyshev distance maps onto the four canon bands', () => {
  assert.strictEqual(THREAD.bandOf(0), 'MELEE');
  assert.strictEqual(THREAD.bandOf(1), 'MELEE');
  assert.strictEqual(THREAD.bandOf(2), 'SHORT');
  assert.strictEqual(THREAD.bandOf(3), 'SHORT');
  assert.strictEqual(THREAD.bandOf(4), 'MEDIUM');
  assert.strictEqual(THREAD.bandOf(6), 'MEDIUM');
  assert.strictEqual(THREAD.bandOf(7), 'LONG');
  assert.strictEqual(THREAD.bandOf(20), 'LONG');
});

test('reachable: open board, within Speed, excludes own square, in-bounds', () => {
  const board = { w: 10, h: 10 };
  const r = THREAD.reachable({ x: 5, y: 5 }, 2, board, []);
  assert.strictEqual(Object.keys(r).length, 24);   // 5×5 box minus center
  assert.ok(r['3,3'] && r['7,7'], 'diagonal corners reachable at Speed 2');
  assert.ok(r['5,3'] && r['5,7'], 'straight edges reachable');
  assert.ok(!r['5,5'], 'own square is not a move');
  assert.ok(!r['8,8'], 'Chebyshev distance 3 is beyond Speed 2');
});

test('reachable: clips at board edges', () => {
  const r = THREAD.reachable({ x: 0, y: 0 }, 2, { w: 10, h: 10 }, []);
  assert.strictEqual(Object.keys(r).length, 8);    // quarter 3×3 box minus self
  assert.ok(!r['-1,0'] && !r['0,-1'], 'no out-of-bounds cells');
  assert.ok(r['2,2'] && r['0,2'] && r['2,0'], 'in-bounds cells present');
});

test('reachable: excludes occupied cells', () => {
  const occ = [{ x: 6, y: 5 }, { x: 4, y: 4 }];
  const r = THREAD.reachable({ x: 5, y: 5 }, 1, { w: 10, h: 10 }, occ);
  assert.ok(!r['6,5'] && !r['4,4'], 'occupied cells are not reachable');
  assert.ok(r['5,6'] && r['4,5'], 'free adjacent cells reachable');
  assert.strictEqual(Object.keys(r).length, 6);    // 3×3 box (8) minus 2 occupied
});
