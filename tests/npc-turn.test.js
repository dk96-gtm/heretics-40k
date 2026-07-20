const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

/* ── T-NPC-2b · pure NPC combat-turn decision fn ──────────────────────
   npcTurn(side, state, board, weaponsOf) → a staged block the enemy side
   posts through the existing validate→apply pipeline. Fog-honest (acts
   only on spottedEnemies), AP-bounded, greedy tactician: close then hit.
   weaponsOf(combatant) → [{name,band,ap,damage,element,noRevival}] is
   injected so the core stays pure/testable. */

// all-open board so LOS is always clear and every tile is passable
function openBoard(w, h) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'open' });
  return { w, h, tiles, zones: {} };
}
const MELEE = { name: 'Chainsword', band: 'MELEE', ap: 3, damage: 4, element: 'Physical' };
const SHORT = { name: 'Bolt Pistol', band: 'SHORT', ap: 2, damage: 3, element: 'Physical' };
// weaponsOf reads a test-attached `.weps` list off each combatant
const wep = (c) => c.weps || [];

test('npcTurn: a spotted enemy in melee range → stages an attack that spends AP', () => {
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:   { party: 'B', x: 1, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [MELEE] },
      hero:  { party: 'A', x: 0, y: 0, w: [10, 10], sight: 5, spd: 4, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(8, 4), wep);
  const atk = block.find((b) => b.effect && b.effect.kind === 'damage');
  assert.ok(atk, 'stages an attack on the in-range enemy');
  assert.strictEqual(atk.effect.to, 'hero', 'targets the spotted enemy');
  assert.strictEqual(atk.cost, 3, 'attack costs the weapon AP');
  assert.ok(!block.some((b) => b.effect.kind === 'move'), 'no move needed when already in range');
});

test('npcTurn: an out-of-range enemy → moves toward it (closing distance)', () => {
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 6, y: 0, w: [12, 12], sight: 9, spd: 2, weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 2, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 4), wep);
  const mv = block.find((b) => b.effect && b.effect.kind === 'move');
  assert.ok(mv, 'stages a move when the enemy is out of weapon range');
  const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  assert.ok(cheb(mv.effect.to, { x: 0, y: 0 }) < 6, 'the move gets closer to the enemy');
});

test('npcTurn: fog-honest — never targets an enemy it cannot see', () => {
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 2, spd: 4, weps: [SHORT] },
      hero: { party: 'A', x: 7, y: 0, w: [10, 10], sight: 2, spd: 4, weps: [SHORT] }, // far outside sight 2
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 4), wep);
  assert.ok(!block.some((b) => b.effect && b.effect.kind === 'damage'),
    'no attack is staged against an unseen enemy');
});

test('npcTurn: respects the AP pool — no attack it cannot afford', () => {
  const state = {
    pools: { B: 2 }, // less than the MELEE weapon's ap of 3
    combatants: {
      ork:  { party: 'B', x: 1, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 5, spd: 4, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(8, 4), wep);
  assert.ok(!block.some((b) => b.effect && b.effect.kind === 'damage'),
    'cannot afford the attack → none staged');
});

test('npcTurn: total attack cost never exceeds the shared AP pool', () => {
  const state = {
    pools: { B: 5 }, // only one MELEE (ap 3) fits
    combatants: {
      orkA: { party: 'B', x: 1, y: 0, w: [12, 12], sight: 6, spd: 4, weps: [MELEE] },
      orkB: { party: 'B', x: 1, y: 2, w: [12, 12], sight: 6, spd: 4, weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 1, w: [10, 10], sight: 6, spd: 4, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(8, 5), wep);
  const spent = block.reduce((a, b) => a + (b.cost || 0), 0);
  assert.ok(spent <= 5, 'staged AP (' + spent + ') within pool of 5');
  // and the whole block must pass the real validator
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, { rules: { combat: {} } });
  assert.ok(v.ok, 'npc block passes validate: ' + v.reason);
});

// ── end-to-end: the enemy actually fights back (npcTurn → validate → apply) ──
test('npcTurn→apply: an in-range enemy deals damage to the player model', () => {
  const canon = { rules: { combat: {}, death: { revival_window: { windows: {} } } } };
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 1, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [MELEE] },
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 5, spd: 4, weps: [MELEE] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(8, 4), wep);
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.strictEqual(state.combatants.hero.w[0], 6, 'hero took the 4-damage melee hit (10→6)');
  assert.strictEqual(state.pools.B, 7, 'foe pool spent the attack AP (10→7)');
});

test('npcTurn→apply: a distant enemy closes AND strikes in one turn', () => {
  const canon = { rules: { combat: {}, death: { revival_window: { windows: {} } } } };
  const state = {
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 4, y: 0, w: [12, 12], sight: 9, spd: 3, weps: [SHORT] }, // SHORT reaches ≤3
      hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, weps: [SHORT] },
    },
  };
  const block = THREAD.npcTurn('B', state, openBoard(10, 4), wep);
  assert.ok(block.some((b) => b.effect.kind === 'move'), 'closes the gap');
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.ok(state.combatants.ork.x < 4, 'ork advanced toward the player');
  assert.ok(state.combatants.hero.w[0] < 10, 'and landed a hit after closing');
});
