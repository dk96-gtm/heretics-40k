const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── Slice C · true per-side fog ──────────────────────────────────────
   sightOf (band → radius), spottedEnemies (radius + LOS, live friendlies
   only, union), refreshFog (per-side seen/lastKnown + ghost data), and
   the validate targeting gate (can't attack an unseen enemy). Pure;
   combatants carry a plain `sight` value so fog is decoupled from the
   loadout shape — the model→band→sight wiring lands in Slice D. */

function board(w, h, map) {
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push({ t: (map && map[x + ',' + y]) || 'open' });
  return { w, h, tiles };
}

test('sightOf: weapon band → sight radius in squares, plus scout bonus', () => {
  assert.strictEqual(THREAD.sightOf('MELEE', 0), 2);
  assert.strictEqual(THREAD.sightOf('SHORT', 0), 4);
  assert.strictEqual(THREAD.sightOf('MEDIUM', 0), 7);
  assert.strictEqual(THREAD.sightOf('LONG', 0), 11);
  assert.strictEqual(THREAD.sightOf('MEDIUM', 3), 10, 'scout/aspect bonus adds to radius');
});

test('spottedEnemies: within a friendly sight radius + clear LOS → spotted', () => {
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 7 }, X: { party: 'B', x: 5, y: 0 } } };
  assert.deepStrictEqual(THREAD.spottedEnemies('A', state, board(12, 1, {})), ['X']);
});

test('spottedEnemies: beyond the sight radius → not spotted', () => {
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 4 }, X: { party: 'B', x: 6, y: 0 } } };
  assert.deepStrictEqual(THREAD.spottedEnemies('A', state, board(12, 1, {})), []);
});

test('spottedEnemies: opaque terrain blocks LOS even within radius', () => {
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 9 }, X: { party: 'B', x: 6, y: 0 } } };
  assert.deepStrictEqual(THREAD.spottedEnemies('A', state, board(12, 1, { '3,0': 'mtn' })), []);
});

test('spottedEnemies: dead friendlies provide no vision', () => {
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 9, dead: true }, X: { party: 'B', x: 5, y: 0 } } };
  assert.deepStrictEqual(THREAD.spottedEnemies('A', state, board(12, 1, {})), []);
});

test('spottedEnemies: union across friendlies; unseen enemy stays hidden', () => {
  const state = { combatants: {
    a: { party: 'A', x: 0, y: 0, sight: 4 },
    b: { party: 'A', x: 0, y: 2, sight: 4 },
    X: { party: 'B', x: 3, y: 0 },   // in a's sight
    Y: { party: 'B', x: 11, y: 2 }   // in nobody's sight
  } };
  assert.deepStrictEqual(THREAD.spottedEnemies('A', state, board(12, 3, {})).sort(), ['X']);
});

test('refreshFog: records seen + lastKnown; a lost enemy becomes a ghost at last-seen', () => {
  const b = board(12, 1, {});
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 7 }, X: { party: 'B', x: 5, y: 0 } } };
  let r = THREAD.refreshFog('A', state, b);
  assert.deepStrictEqual(r.spotted, ['X']);
  assert.deepStrictEqual(r.ghosts, []);
  assert.deepStrictEqual(state.fog.A.lastKnown.X, { x: 5, y: 0 });
  assert.ok(state.fog.A.seen.indexOf('X') >= 0);

  state.combatants.X.x = 11;                 // X walks out of sight
  r = THREAD.refreshFog('A', state, b);
  assert.deepStrictEqual(r.spotted, []);
  assert.deepStrictEqual(r.ghosts, [{ id: 'X', x: 5, y: 0 }], 'ghost sits at last-known, not current pos');
});

test('refreshFog: a never-seen enemy is absent, not a ghost', () => {
  const state = { combatants: { a: { party: 'A', x: 0, y: 0, sight: 4 }, X: { party: 'B', x: 11, y: 0 } } };
  const r = THREAD.refreshFog('A', state, board(12, 1, {}));
  assert.deepStrictEqual(r.spotted, []);
  assert.deepStrictEqual(r.ghosts, []);
});

test('validate: attacking an unseen enemy is rejected (fog targeting gate)', () => {
  const b = board(12, 1, {});
  const state = { board: b, pools: { A: 10 }, combatants: {
    a: { party: 'A', x: 0, y: 0, sight: 4 },
    X: { party: 'B', x: 2, y: 0 },    // spotted (dist 2 ≤ 4)
    Y: { party: 'B', x: 10, y: 0 }    // unseen (dist 10 > 4)
  } };
  const thread = { type: 'SKIRMISH' };
  const ok = [{ actor: 'a', cost: 2, effect: { kind: 'damage', to: 'X', amount: 3 } }];
  const bad = [{ actor: 'a', cost: 2, effect: { kind: 'damage', to: 'Y', amount: 3 } }];
  assert.strictEqual(THREAD.validate(thread, state, 'A', ok, canon).ok, true);
  assert.strictEqual(THREAD.validate(thread, state, 'A', bad, canon).ok, false);
});

test('validate: no board (legacy combat) skips the targeting gate', () => {
  const state = { pools: { A: 10 }, combatants: { a: { party: 'A' }, X: { party: 'B' } } };
  const thread = { type: 'SKIRMISH' };
  const block = [{ actor: 'a', cost: 2, effect: { kind: 'damage', to: 'X', amount: 3 } }];
  assert.strictEqual(THREAD.validate(thread, state, 'A', block, canon).ok, true);
});
