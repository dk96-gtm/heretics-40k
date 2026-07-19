const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── Slice D1 · grid state plumbing ───────────────────────────────────
   initState carries the engine-generated board plus phase and per-side
   fog through into thread state. The board itself is produced by engine
   wiring (genBoard with a real rng) and handed in via seedState — the
   pure core just adopts it. */

test('initState: a grid combat seed carries board, phase, and fog', () => {
  const board = { w: 12, h: 10, tiles: [], zones: { A: {}, B: {} } };
  const t = { type: 'SKIRMISH', seedState: { board, phase: 'deploy', pools: { A: 26 }, combatants: {} } };
  const s = THREAD.initState(t, canon);
  assert.strictEqual(s.board, board, 'board carried through');
  assert.strictEqual(s.phase, 'deploy', 'phase carried through');
  assert.deepStrictEqual(s.fog, {}, 'fog starts empty');
});

test('initState: a non-grid thread has null board and null phase', () => {
  const s = THREAD.initState({ type: 'DIPLOMACY', seedState: {} }, canon);
  assert.strictEqual(s.board, null);
  assert.strictEqual(s.phase, null);
  assert.deepStrictEqual(s.fog, {});
});

test('initState: preserves existing seed fog (resumed thread)', () => {
  const fog = { A: { seen: ['X'], lastKnown: { X: { x: 3, y: 2 } } } };
  const s = THREAD.initState({ type: 'SKIRMISH', seedState: { board: { w: 1, h: 1, tiles: [] }, fog } }, canon);
  assert.deepStrictEqual(s.fog, fog);
});
