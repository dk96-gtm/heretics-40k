const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── T-BF1 · terrain cover in the damage step ─────────────────────────
   coverMod() reads a tile's cover; apply()'s damage branch must subtract
   it (after armour, floored at 0) when the fight is on a board. A model
   in ruins/fortification (heavy cover 2) soaks 2 more than open ground. */

// hand-author a small board: map is {'x,y':'terrainKey'}, rest 'open'
function board(w, h, map) {
  const tiles = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) tiles.push({ t: (map && map[x + ',' + y]) || 'open' });
  return { w, h, tiles };
}
const hit = (to, amount, element) => [{ actor: 'atk', effect: { kind: 'damage', to, amount, element: element || 'Physical' } }];

test('apply: heavy terrain cover reduces incoming damage', () => {
  const state = {
    board: board(2, 1, { '0,0': 'ruins' }),          // (0,0) heavy cover 2, (1,0) open
    combatants: { hero: { x: 0, y: 0, w: [10, 10], party: 'A' } },
    pools: {},
  };
  THREAD.apply({ type: 'SKIRMISH' }, state, hit('hero', 5), canon);
  assert.strictEqual(state.combatants.hero.w[0], 7, 'ruins (cover 2) turns a 5-dmg hit into 3');
});

test('apply: open ground applies full damage (no over-subtraction)', () => {
  const state = {
    board: board(2, 1, { '0,0': 'ruins' }),
    combatants: { grunt: { x: 1, y: 0, w: [10, 10], party: 'B' } }, // on open
    pools: {},
  };
  THREAD.apply({ type: 'SKIRMISH' }, state, hit('grunt', 5), canon);
  assert.strictEqual(state.combatants.grunt.w[0], 5, 'open ground = full 5 damage');
});

test('apply: cover + armour stack and floor at 0, never negative', () => {
  const state = {
    board: board(1, 1, { '0,0': 'fort' }),           // fortification = heavy cover 2
    combatants: { tank: { x: 0, y: 0, w: [10, 10], party: 'A', armour: { Physical: 1 } } },
    pools: {},
  };
  THREAD.apply({ type: 'SKIRMISH' }, state, hit('tank', 2), canon); // 2 - armour1 - cover2 = -1 → floored 0
  assert.strictEqual(state.combatants.tank.w[0], 10, 'armour+cover fully soak a small hit, floored at 0');
});

test('apply: non-grid combat (null board) takes full damage, no crash', () => {
  const state = { board: null, combatants: { x: { w: [10, 10], party: 'A' } }, pools: {} };
  THREAD.apply({ type: 'SKIRMISH' }, state, hit('x', 4), canon);
  assert.strictEqual(state.combatants.x.w[0], 6, 'no board → cover term is 0');
});
