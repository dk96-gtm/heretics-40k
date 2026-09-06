const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

/* ── T-NPC-3.5 · Task 4 — brain part 1: enumerate + score ─────────────
   THREAD.enumeratePairs(side,state,board,weaponsOf,kitOf,canon) → [pair]
   THREAD.scorePair(pair,state,canon) → number

   pair = {actor, kind:'attack'|'kit'|'move', item?, target?, ap, meta}

   Both are PURE and DETERMINISTIC — no Math.random, no Date.now. All
   variety enters at Task 5's seeded draw. These tests ARE the formula's
   spec: every band placement and every consideration is pinned to a
   computed number with the arithmetic shown in a comment. */

// all-open board so LOS is always clear, every tile passable, cover 0
function openBoard(w, h) {
  const tiles = [];
  for (let i = 0; i < w * h; i++) tiles.push({ t: 'open' });
  return { w, h, tiles, zones: {} };
}

// canon v1.39 rules.npc_brain.bands verbatim + the actions_per_post the
// denial consideration reads through actionCap.
const CANON = {
  rules: {
    combat: { actions_per_post: 3 },
    npc_brain: {
      bands: {
        basic_attack: [8, 12],
        offensive: [20, 40],
        support: [25, 45],
        reaction: [50, 70],
      },
    },
  },
};

// injected accessors — fixtures hang their lists off the combatant
const wep = (c) => c.weps || [];
const kit = (c) => c.kit || [];

const MELEE1 = { name: 'Chainsword', band: 'MELEE', ap: 1, damage: 4, element: 'Physical' };
const SHORT1 = { name: 'Bolt Pistol', band: 'SHORT', ap: 1, damage: 3, element: 'Physical' };

/* ─────────────────────────────────────────────────────────────────── */

test('enumeratePairs lists weapon x enemy and kit x recipient pairs, fog-honest', () => {
  const state = {
    pools: { B: 10, A: 10 },
    combatants: {
      // side B: one actor, one weapon, one friendly (self-buff) kit entry
      ork: {
        party: 'B', x: 0, y: 0, w: [12, 12], sight: 3, spd: 4,
        weps: [MELEE1],
        kit: [{
          item: { n: 'Stimm Shot' }, kind: 'item', ap: 0, consumed: true,
          payload: [{ tag: 'Regen', tier: 1, hostile: false, el: null }],
        }],
      },
      // side A
      hero:   { party: 'A', x: 1, y: 0, w: [10, 10], sight: 5, spd: 4, weps: [MELEE1] },
      corpse: { party: 'A', x: 1, y: 1, w: [0, 8],  sight: 5, spd: 4, dead: true, weps: [MELEE1] },
      ghost:  { party: 'A', x: 9, y: 0, w: [8, 8],  sight: 5, spd: 4, weps: [MELEE1] }, // dist 9 > sight 3
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, openBoard(12, 4), wep, kit, CANON);

  // fog honesty: never a pair against a corpse or an unspotted model
  assert.ok(!pairs.some((p) => p.target === 'corpse'), 'no pair targets the dead');
  assert.ok(!pairs.some((p) => p.target === 'ghost'), 'no pair targets an unspotted enemy');

  const atk = pairs.filter((p) => p.kind === 'attack');
  assert.strictEqual(atk.length, 1, 'one weapon x one visible enemy = one attack pair');
  assert.deepStrictEqual(
    { actor: atk[0].actor, kind: atk[0].kind, target: atk[0].target, ap: atk[0].ap, band: atk[0].meta.band },
    { actor: 'ork', kind: 'attack', target: 'hero', ap: 1, band: 'MELEE' },
    'attack pair shape'
  );
  assert.strictEqual(atk[0].item, MELEE1, 'attack pair carries the weapon as .item');

  const kits = pairs.filter((p) => p.kind === 'kit');
  assert.strictEqual(kits.length, 1, 'a friendly payload with no living allies = one self pair');
  assert.strictEqual(kits[0].target, 'ork', 'self-buff targets the actor');
  assert.strictEqual(kits[0].meta.self, true);
  assert.strictEqual(kits[0].meta.hostile, false);
  assert.strictEqual(kits[0].meta.consumable, true);
  assert.deepStrictEqual(kits[0].meta.tags, ['Regen']);

  const mv = pairs.filter((p) => p.kind === 'move');
  assert.strictEqual(mv.length, 1, 'at most ONE move pair per actor');
  assert.strictEqual(mv[0].meta.toward, 'hero', 'the move closes on the nearest visible enemy');
  assert.strictEqual(mv[0].ap, 0);

  // a move can never outbid a real action: bottom of basic_attack x 0.5 = 8 * 0.5 = 4
  assert.strictEqual(THREAD.scorePair(mv[0], state, CANON), 4);
});

test('enumeratePairs: an unaffordable or out-of-reach weapon yields no pair', () => {
  const state = {
    pools: { B: 1 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 9, spd: 4,
              weps: [{ name: 'Big Gun', band: 'SHORT', ap: 5, damage: 6, element: 'Physical' }, MELEE1] },
      hero: { party: 'A', x: 3, y: 0, w: [10, 10], sight: 9, spd: 4, weps: [MELEE1] },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, openBoard(10, 4), wep, kit, CANON);
  // Big Gun reaches (SHORT covers dist 3) but costs 5 > pool 1 → dropped.
  // Chainsword is affordable but MELEE cannot reach dist 3 → dropped.
  assert.strictEqual(pairs.filter((p) => p.kind === 'attack').length, 0);
  assert.strictEqual(pairs.filter((p) => p.kind === 'move').length, 1, 'the move fallback survives');
});

test('scorePair: an attack on a tough target scores in the basic_attack band', () => {
  const board = openBoard(10, 4);
  const state = {
    board,
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 9, spd: 4, weps: [SHORT1] },
      hero: { party: 'A', x: 2, y: 0, w: [10, 10], sight: 9, spd: 4, weps: [MELEE1],
              armour: { Physical: 1 } },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const atk = pairs.find((p) => p.kind === 'attack');
  assert.ok(atk, 'the SHORT weapon reaches dist 2');

  // expected wounds after armour = max(0, 3 dmg - 1 Physical Defense - 0 cover) = 2
  //   capped by the target's remaining wounds (10) → 2
  //   normalized by the target's MAX wounds (10)   → 0.2
  // one consideration → gm = 0.2^(1/1) = 0.2
  // basic_attack [8,12] → 8 + 0.2*(12-8) = 8.8 ; / max(1, ap 1) = 8.8
  const s = THREAD.scorePair(atk, state, CANON);
  assert.ok(Math.abs(s - 8.8) < 1e-9, `expected 8.8, got ${s}`);
  assert.ok(s >= 8 && s <= 12, 'a plain 1-AP shot sits inside the basic_attack band');
});

test('scorePair: suppressing a 3-weapon model outscores suppressing a dying grunt', () => {
  const board = openBoard(12, 4);
  const SUPPRESS = {
    item: { n: 'Warp Chains' }, kind: 'cast', ap: 1, consumed: false,
    payload: [{ tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' }],
  };
  const state = {
    board,
    pools: { B: 5, A: 8 },
    poolsBase: { B: 10, A: 10 },
    combatants: {
      sorc:    { party: 'B', x: 0, y: 0, w: [8, 8], sight: 11, spd: 4, kit: [SUPPRESS] },
      veteran: { party: 'A', x: 2, y: 0, w: [10, 10], sight: 9, spd: 4,
                 weps: [MELEE1, SHORT1, { name: 'Plasma', band: 'MEDIUM', ap: 2, damage: 5, element: 'Plasma' }] },
      grunt:   { party: 'A', x: 3, y: 0, w: [1, 4], sight: 9, spd: 4, weps: [MELEE1] },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const onVet = pairs.find((p) => p.kind === 'kit' && p.target === 'veteran');
  const onGrunt = pairs.find((p) => p.kind === 'kit' && p.target === 'grunt');
  assert.ok(onVet && onGrunt, 'a hostile payload enumerates against every visible enemy');
  assert.strictEqual(onVet.meta.tgtWeapons, 3, 'enumeration stamps the target weapon count');
  assert.strictEqual(onGrunt.meta.tgtWeapons, 1);

  // denial = (weapons/3 capped at 1) x (remaining AP share) x (actionCap/actions_per_post)
  // veteran: (3/3) x (8/10) x (3/3)                     = 0.8
  //   offensive [20,40] → 20 + 0.8*20 = 36 ; / ap 1     = 36
  // grunt (1 weapon, 1/4 wounds → actionCap floors to 1):
  //   (1/3) x (8/10) x (1/3) = 0.8/9 = 0.0888888...
  //   → 20 + 0.0888888*20 = 21.777777... ; / ap 1
  const sv = THREAD.scorePair(onVet, state, CANON);
  const sg = THREAD.scorePair(onGrunt, state, CANON);
  assert.ok(Math.abs(sv - 36) < 1e-9, `expected 36, got ${sv}`);
  assert.ok(Math.abs(sg - (20 + (0.8 / 9) * 20)) < 1e-9, `expected 21.7777..., got ${sg}`);
  assert.ok(sv > sg, 'denying a fully-armed veteran beats denying a dying grunt');
  assert.ok(sv >= 20 && sv <= 40 && sg >= 20 && sg <= 40, 'both sit in the offensive band');
});

test('scorePair: healing a model at 1/6 wounds lands in the reaction band; buffing full health scores below support mid-band', () => {
  const board = openBoard(8, 4);
  const HEAL = {
    item: { n: 'Salve' }, kind: 'ability', ap: 1, consumed: false,
    payload: [{ tag: 'Regen', tier: 1, hostile: false, el: null }],
  };
  const BUFF = {
    item: { n: 'Warcry' }, kind: 'ability', ap: 1, consumed: false,
    payload: [{ tag: 'Rally', tier: 1, hostile: false, el: null }],
  };
  const state = {
    board,
    pools: { B: 6 },
    combatants: {
      medic:   { party: 'B', x: 0, y: 0, w: [5, 5], sight: 5, spd: 4, kit: [HEAL, BUFF] },
      wounded: { party: 'B', x: 1, y: 0, w: [1, 6], sight: 5, spd: 4 },
      hale:    { party: 'B', x: 2, y: 0, w: [8, 8], sight: 5, spd: 4 },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const heal = pairs.find((p) => p.kind === 'kit' && p.meta.tags[0] === 'Regen' && p.target === 'wounded');
  const buff = pairs.find((p) => p.kind === 'kit' && p.meta.tags[0] === 'Rally' && p.target === 'hale');
  assert.ok(heal && buff, 'friendly payloads enumerate on self + every living ally');

  // HEAL on a model at 1/6 → Regen is an emergency tag and the recipient is at <= 2 wounds
  //   → reaction band [50,70].
  // C1 wound swing: Regen I heals tier 1 per tick for condDur(Regen,1) = 2+1 = 3 ticks = 3
  //   capped by MISSING wounds (6-1 = 5) → 3 ; normalized by max wounds 6 → 0.5
  // C3 peril: 1 - 1/6 = 0.8333333...
  // gm = sqrt(0.5 * 0.8333333) = sqrt(0.4166666...) = 0.6454972243679028
  // 50 + 0.6454972243679028 * (70-50) = 62.909944487358056 ; / ap 1
  const sh = THREAD.scorePair(heal, state, CANON);
  const expH = 50 + Math.sqrt(0.5 * (1 - 1 / 6)) * 20;
  assert.ok(Math.abs(sh - expH) < 1e-9, `expected ${expH}, got ${sh}`);
  assert.ok(sh >= 50 && sh <= 70, 'an emergency heal sits in the reaction band');

  // BUFF on a full-health model → Rally is not an emergency tag → support band [25,45].
  // Only C3 applies (Rally has no wound tick, no denial): peril = 1 - 8/8 = 0,
  //   floored to EPS 0.01 so it can never hard-zero a geometric mean.
  // 25 + 0.01 * (45-25) = 25.2 ; / ap 1
  const sb = THREAD.scorePair(buff, state, CANON);
  assert.ok(Math.abs(sb - 25.2) < 1e-9, `expected 25.2, got ${sb}`);
  assert.ok(sb < (25 + 45) / 2, 'buffing full health scores below support mid-band');
  assert.ok(sh > sb, 'the emergency heal outbids the vanity buff');
});

test('scorePair: same effect at 2 AP scores half the 1 AP value', () => {
  const board = openBoard(8, 4);
  const CHEAP = { name: 'Knife', band: 'MELEE', ap: 1, damage: 4, element: 'Physical' };
  const DEAR = { name: 'Heavy Maul', band: 'MELEE', ap: 2, damage: 4, element: 'Physical' };
  const state = {
    board,
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [CHEAP, DEAR] },
      hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 5, spd: 4 },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const a1 = pairs.find((p) => p.kind === 'attack' && p.ap === 1);
  const a2 = pairs.find((p) => p.kind === 'attack' && p.ap === 2);
  assert.ok(a1 && a2);

  // both deal 4 unarmoured to a 10/10 target → 4/10 = 0.4 ; 8 + 0.4*4 = 9.6
  //   1 AP → 9.6 / 1 = 9.6 ; 2 AP → 9.6 / 2 = 4.8
  const s1 = THREAD.scorePair(a1, state, CANON);
  const s2 = THREAD.scorePair(a2, state, CANON);
  assert.ok(Math.abs(s1 - 9.6) < 1e-9, `expected 9.6, got ${s1}`);
  assert.ok(Math.abs(s2 - 4.8) < 1e-9, `expected 4.8, got ${s2}`);
  assert.ok(Math.abs(s2 * 2 - s1) < 1e-9, 'AP efficiency divides by max(1, ap) exactly');
});

test('scorePair: deterministic and canon-driven — reruns match, bands come from canon', () => {
  const board = openBoard(8, 4);
  const state = {
    board,
    pools: { B: 10 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [MELEE1] },
      hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 5, spd: 4 },
    },
  };
  const atk = THREAD.enumeratePairs('B', state, board, wep, kit, CANON).find((p) => p.kind === 'attack');
  const a = THREAD.scorePair(atk, state, CANON);
  const b = THREAD.scorePair(atk, state, CANON);
  assert.strictEqual(a, b, 'scoring is deterministic');

  // move the band in canon and the score moves with it — nothing is hardcoded
  const shifted = JSON.parse(JSON.stringify(CANON));
  shifted.rules.npc_brain.bands.basic_attack = [100, 200];
  const c = THREAD.scorePair(atk, state, shifted);
  // 4 dmg / 10 max wounds = 0.4 → 100 + 0.4*100 = 140
  assert.ok(Math.abs(c - 140) < 1e-9, `expected 140, got ${c}`);
});

test('scorePair: a Cleanse on a clean model scores low; on a poisoned model it scores higher', () => {
  const board = openBoard(8, 4);
  const CLEANSE = {
    item: { n: 'Purity Seal' }, kind: 'ability', ap: 1, consumed: false,
    payload: [{ tag: 'Cleanse', tier: 1, hostile: false, el: null }],
  };
  const state = {
    board,
    pools: { B: 6 },
    combatants: {
      priest: { party: 'B', x: 0, y: 0, w: [6, 6], sight: 5, spd: 4, kit: [CLEANSE] },
      clean:  { party: 'B', x: 1, y: 0, w: [5, 8], sight: 5, spd: 4, conds: [] },
      cursed: { party: 'B', x: 2, y: 0, w: [5, 8], sight: 5, spd: 4,
                conds: [{ tag: 'DoT', tier: 1, left: 3 }, { tag: 'Slowing', tier: 1, left: 1 }] },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const onClean = pairs.find((p) => p.kind === 'kit' && p.target === 'clean');
  const onCursed = pairs.find((p) => p.kind === 'kit' && p.target === 'cursed');
  assert.ok(onClean && onCursed, 'a Cleanse is enumerated even where it is pointless');

  // both are at 5/8 → C3 peril = 1 - 5/8 = 0.375 ; support band [25,45] (Cleanse IS an
  // emergency tag but neither recipient is at <= 2 wounds, so no reaction band here).
  // C4 cleanse relevance = hostile conds carried / CLEANSE_CAP 3
  //   clean:  0/3 → floored to EPS 0.01 → gm = sqrt(0.375*0.01) = 0.0612372...
  //   cursed: 2/3 = 0.6666666...        → gm = sqrt(0.375*0.6666666) = 0.5
  const sClean = THREAD.scorePair(onClean, state, CANON);
  const sCursed = THREAD.scorePair(onCursed, state, CANON);
  assert.ok(Math.abs(sClean - (25 + Math.sqrt(0.375 * 0.01) * 20)) < 1e-9, `got ${sClean}`);
  assert.ok(Math.abs(sCursed - (25 + 0.5 * 20)) < 1e-9, `expected 35, got ${sCursed}`);
  assert.ok(sCursed > sClean, 'a Cleanse is worth more where there is something to cleanse');
});

test('scorePair: a payload that neither ticks, denies nor supports falls back to raw magnitude', () => {
  const state = {
    pools: {},
    combatants: {
      a: { party: 'B', x: 0, y: 0, w: [5, 5] },
      z: { party: 'A', x: 1, y: 0, w: [10, 10] },
    },
  };
  // Marked has mods but no tick and is not a denial tag → the C5 generic-magnitude
  // fallback: tier 2 x min(condDur(Marked,2)=4, MAG_DUR_CAP 5) = 8 ; 8 / MAG_TIER_DUR_CAP 10 = 0.8
  // offensive [20,40] → 20 + 0.8*20 = 36 ; / ap 1
  const marked = {
    actor: 'a', kind: 'kit', item: { n: 'Hex' }, target: 'z', ap: 1,
    meta: { hostile: true, tags: ['Marked'], payload: [{ tag: 'Marked', tier: 2, hostile: true }], tgtWeapons: 1 },
  };
  assert.ok(Math.abs(THREAD.scorePair(marked, state, CANON) - 36) < 1e-9);

  // Immunity carries an Infinity duration — the friendly path is peril-weighted (C3), so
  // warding a full-health model still scores at the support floor: 25 + 0.01*20 = 25.2
  const ward = {
    actor: 'a', kind: 'kit', item: { n: 'Ward' }, target: 'a', ap: 1,
    meta: { hostile: false, self: true, tags: ['Immunity'], payload: [{ tag: 'Immunity', tier: 1, hostile: false }] },
  };
  assert.ok(Math.abs(THREAD.scorePair(ward, state, CANON) - 25.2) < 1e-9);
});

test('enumeratePairs/scorePair degrade cleanly: no board, no injected accessors, no canon', () => {
  const solo = { pools: { B: 5 }, combatants: { a: { party: 'B', x: 0, y: 0, w: [5, 5], sight: 5 } } };
  // no board → nothing is legally seen → no pairs at all (not a throw)
  assert.deepStrictEqual(THREAD.enumeratePairs('B', solo, null, () => [], () => [], CANON), []);

  const duel = {
    pools: { B: 5 },
    combatants: {
      a: { party: 'B', x: 0, y: 0, w: [5, 5], sight: 5 },
      z: { party: 'A', x: 1, y: 0, w: [5, 5], sight: 5 },
    },
  };
  // weaponsOf/kitOf omitted entirely → only the move fallback survives
  const pairs = THREAD.enumeratePairs('B', duel, openBoard(6, 3), null, null, CANON);
  assert.deepStrictEqual(pairs.map((p) => p.kind), ['move']);

  // canon-less scorePair falls back to the shipped band table: 5 dmg / 10 max = 0.5 → 8 + 0.5*4 = 10
  const atk = { actor: 'a', kind: 'attack', item: { damage: 5, element: 'Physical', ap: 1 }, target: 'z', ap: 1, meta: { band: 'MELEE' } };
  const st = { pools: {}, combatants: { a: { party: 'B', x: 0, y: 0, w: [5, 5] }, z: { party: 'A', x: 1, y: 0, w: [10, 10] } } };
  assert.strictEqual(THREAD.scorePair(atk, st), 10);
  assert.strictEqual(THREAD.scorePair({ kind: 'wat', ap: 1 }, st, CANON), 0, 'an unknown kind can never be drawn');
  assert.strictEqual(THREAD.scorePair(null, st, CANON), 0);
});
