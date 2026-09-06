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

test('enumeratePairs: a hostile kit payload is reach-gated exactly like validate gates it (finding 2)', () => {
  // validate rejects a hostile cond whose target is out of the ITEM's stated band
  // (condBandOf, default SHORT — ruling §4). enumeratePairs must apply the SAME gate
  // on the hostile branch only, so the brain never enumerates a pair the validator
  // would bounce. Friendly payloads are never range-gated (validate doesn't gate them).
  const SUPPRESS = {
    item: { n: 'Warp Chains' }, kind: 'cast', ap: 1, consumed: false,
    payload: [{ tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' }],
  };
  // no explicit band on the item and no description range word → condBandOf defaults
  // to SHORT (rank 1). SHORT covers Chebyshev distance <= 3.
  const far = {
    pools: { B: 5 },
    combatants: {
      sorc: { party: 'B', x: 0, y: 0, w: [8, 8], sight: 11, spd: 4, kit: [SUPPRESS] },
      hero: { party: 'A', x: 9, y: 0, w: [10, 10], sight: 11, spd: 4 },   // dist 9 → LONG, out of SHORT reach
    },
  };
  const farPairs = THREAD.enumeratePairs('B', far, openBoard(12, 4), wep, kit, CANON);
  assert.strictEqual(farPairs.filter((p) => p.kind === 'kit').length, 0,
    'a Suppressing cast vs an enemy 9 tiles away yields no pair');

  const near = {
    pools: { B: 5 },
    combatants: {
      sorc: { party: 'B', x: 0, y: 0, w: [8, 8], sight: 11, spd: 4, kit: [SUPPRESS] },
      hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 11, spd: 4 },   // dist 1 → MELEE, within SHORT reach
    },
  };
  const nearPairs = THREAD.enumeratePairs('B', near, openBoard(12, 4), wep, kit, CANON);
  assert.strictEqual(nearPairs.filter((p) => p.kind === 'kit').length, 1,
    'the same cast vs an adjacent enemy yields one pair');
});

// final review Critical #1 / Ruling R11 — redundant kit pairs are PRUNED at enumeration
// (not down-scored): with the canon bands as authored, ANY kit pair (band floor >= 20)
// outscores EVERY basic_attack (ceiling <= 12), so a down-scored recast still wins the
// draw over the weapon. Only removing the pair lets the weapon win once the cond is up.
test('enumeratePairs: a redundant kit pair is pruned while the recipient already carries it at >= tier with duration left (Ruling R11, finding 1)', () => {
  const SUPPRESS = {
    item: { n: 'Warp Chains' }, kind: 'cast', ap: 1, consumed: false,
    payload: [{ tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' }],
  };
  const UPGRADE = {   // same tag, a HIGHER tier — never redundant against a lower-tier carry
    item: { n: 'Greater Warp Chains' }, kind: 'cast', ap: 1, consumed: false,
    payload: [{ tag: 'Suppressing', tier: 2, hostile: true, el: 'Warp' }],
  };
  function pairsWith(kitList, heroConds) {
    const state = {
      pools: { B: 5 },
      combatants: {
        sorc: { party: 'B', x: 0, y: 0, w: [8, 8], sight: 11, spd: 4, kit: kitList },
        hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 11, spd: 4, conds: heroConds },   // dist 1, within SHORT reach
      },
    };
    return THREAD.enumeratePairs('B', state, openBoard(12, 4), wep, kit, CANON).filter((p) => p.kind === 'kit');
  }
  assert.strictEqual(pairsWith([SUPPRESS], []).length, 1, 'no existing cond → the cast is a legal candidate');
  assert.strictEqual(pairsWith([SUPPRESS], [{ tag: 'Suppressing', tier: 1, left: 2 }]).length, 0,
    'already carries Suppressing I with 2 turns left → the recast is pruned');
  assert.strictEqual(pairsWith([SUPPRESS], [{ tag: 'Suppressing', tier: 1, left: Infinity }]).length, 0,
    'an Infinity `left` (permanent) still counts as duration left');
  assert.strictEqual(pairsWith([SUPPRESS], [{ tag: 'Suppressing', tier: 1, left: 0 }]).length, 1,
    'left has hit 0 (expired) → legal again');
  assert.strictEqual(pairsWith([UPGRADE], [{ tag: 'Suppressing', tier: 1, left: 5 }]).length, 1,
    'the payload tier (2) is higher than the carried tier (1) → not redundant, still legal');
});

// final review Minor #5 — a payload mixing hostile and friendly tags in ONE entry can never
// legally land: validate's allegiance gate rejects the whole staged block regardless of which
// side it's aimed at, and npcRespond then swallows that rejection silently (a mute NPC post).
// 0 such catalog rows exist today — this pins the hardening, not a live regression.
test('enumeratePairs: a mixed-polarity kit payload (hostile + friendly tags in one entry) is dropped entirely (finding 5)', () => {
  const MIXED = {
    item: { n: 'Cursed Chains' }, kind: 'cast', ap: 1, consumed: false,
    payload: [
      { tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' },
      { tag: 'Regen', tier: 1, hostile: false, el: null },
    ],
  };
  const state = {
    pools: { B: 5 },
    combatants: {
      sorc: { party: 'B', x: 0, y: 0, w: [8, 8], sight: 11, spd: 4, kit: [MIXED] },
      hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 11, spd: 4 },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, openBoard(12, 4), wep, kit, CANON);
  assert.strictEqual(pairs.filter((p) => p.kind === 'kit').length, 0,
    'a mixed-polarity entry is dropped at enumeration — never staged on the enemy OR an ally');
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
  //   normalized by the target's MAX wounds (10)   → C1 = 0.2
  // AP efficiency (R6, inside the geometric mean): 1/max(1, ap 1) = C_AP = 1
  // gm = sqrt(0.2 * 1) = 0.4472135954999579
  // basic_attack [8,12] → 8 + 0.4472135954999579*(12-8) = 9.788854381999831 (no post-band divisor)
  const s = THREAD.scorePair(atk, state, CANON);
  const expS = 8 + Math.sqrt(0.2 * 1) * 4;
  assert.ok(Math.abs(s - expS) < 1e-9, `expected ${expS}, got ${s}`);
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
  // grunt (1 weapon, 1/4 wounds → actionCap floors to 1):
  //   (1/3) x (8/10) x (1/3) = 0.8/9 = 0.0888888...
  // AP efficiency (R6): both are 1 AP → C_AP = 1/max(1,1) = 1
  // veteran: gm = sqrt(0.8 * 1) = 0.8944271909999159
  //   offensive [20,40] → 20 + 0.8944271909999159*20 = 37.88854381999832 (no post-band divisor)
  // grunt:   gm = sqrt(0.0888888... * 1) = 0.29814239699997197
  //   → 20 + 0.29814239699997197*20 = 25.962847939999438
  const sv = THREAD.scorePair(onVet, state, CANON);
  const sg = THREAD.scorePair(onGrunt, state, CANON);
  const expSv = 20 + Math.sqrt(0.8 * 1) * 20;
  const expSg = 20 + Math.sqrt((0.8 / 9) * 1) * 20;
  assert.ok(Math.abs(sv - expSv) < 1e-9, `expected ${expSv}, got ${sv}`);
  assert.ok(Math.abs(sg - expSg) < 1e-9, `expected ${expSg}, got ${sg}`);
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
  // AP efficiency (R6): 1 AP → C_AP = 1/max(1,1) = 1
  // gm = (0.5 * 0.8333333... * 1)^(1/3) = 0.4166666...^(1/3) = 0.7469273620861783
  // 50 + 0.7469273620861783 * (70-50) = 64.93801582185722 (no post-band divisor)
  const sh = THREAD.scorePair(heal, state, CANON);
  const expH = 50 + Math.pow(0.5 * (1 - 1 / 6) * 1, 1 / 3) * 20;
  assert.ok(Math.abs(sh - expH) < 1e-9, `expected ${expH}, got ${sh}`);
  assert.ok(sh >= 50 && sh <= 70, 'an emergency heal sits in the reaction band');

  // BUFF on a full-health model → Rally is not an emergency tag → support band [25,45].
  // Only C3 applies (Rally has no wound tick, no denial): peril = 1 - 8/8 = 0,
  //   floored to EPS 0.01 so it can never hard-zero a geometric mean.
  // AP efficiency (R6): 1 AP → C_AP = 1
  // gm = sqrt(0.01 * 1) = 0.1 → 25 + 0.1*(45-25) = 27 (no post-band divisor)
  const sb = THREAD.scorePair(buff, state, CANON);
  const expB = 25 + Math.sqrt(0.01 * 1) * 20;
  assert.ok(Math.abs(sb - expB) < 1e-9, `expected ${expB}, got ${sb}`);
  assert.ok(sb < (25 + 45) / 2, 'buffing full health scores below support mid-band');
  assert.ok(sh > sb, 'the emergency heal outbids the vanity buff');
});

test('scorePair R6: a 2-AP reaction-band pair strictly outscores any 1-AP support-band pair on the same fixture (band hierarchy holds under AP pressure — finding 1)', () => {
  // Regression pin for the pre-R6 bug: the old post-band /max(1,ap) divisor let a
  // cheap 1-AP support play (25-45) beat an expensive 2-AP reaction play (50-70).
  // Under R6, AP efficiency lives INSIDE the geometric mean, so raw = lo + gm*(hi-lo)
  // never leaves [lo,hi] regardless of ap — a reaction-band floor (50) always beats
  // a support-band ceiling (45), full stop.
  const board = openBoard(8, 4);
  const HEAL2 = {
    item: { n: 'Greater Salve' }, kind: 'ability', ap: 2, consumed: false,
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
      medic:   { party: 'B', x: 0, y: 0, w: [5, 5], sight: 5, spd: 4, kit: [HEAL2, BUFF] },
      wounded: { party: 'B', x: 1, y: 0, w: [1, 6], sight: 5, spd: 4 },
      hale:    { party: 'B', x: 2, y: 0, w: [8, 8], sight: 5, spd: 4 },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const heal2 = pairs.find((p) => p.kind === 'kit' && p.ap === 2 && p.target === 'wounded');
  const buff1 = pairs.find((p) => p.kind === 'kit' && p.ap === 1 && p.target === 'hale');
  assert.ok(heal2 && buff1, 'both a 2-AP emergency heal and a 1-AP vanity buff enumerate');

  const sh2 = THREAD.scorePair(heal2, state, CANON);
  const sb1 = THREAD.scorePair(buff1, state, CANON);
  assert.ok(sh2 >= 50 && sh2 <= 70, `the 2-AP heal still lands in the reaction band, got ${sh2}`);
  assert.ok(sb1 >= 25 && sb1 <= 45, `the 1-AP buff still lands in the support band, got ${sb1}`);
  assert.ok(sh2 > sb1, 'R6: a 2-AP reaction play always outscores a 1-AP support play — bands never overlap');
});

test('scorePair R6: AP efficiency lives INSIDE the geometric mean — a pricier action scores lower but never leaves its band (finding 1)', () => {
  // Pre-R6 this test was "same effect at 2 AP scores half the 1 AP value" (a plain
  // post-band /max(1,ap) divisor). R6 removes that divisor: AP efficiency is now
  // just another (0,1]-normalized consideration folded into the geometric mean, so
  // 2 AP no longer means "exactly half" — it means "the same expected-wounds
  // consideration, geometric-meaned against a weaker AP-efficiency consideration."
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

  // both deal 4 unarmoured to a 10/10 target → C1 = 4/10 = 0.4
  // 1 AP → C_AP = 1/max(1,1) = 1        → gm = sqrt(0.4*1)   = 0.6324555320336759
  //   8 + 0.6324555320336759*4 = 10.529822128134704
  // 2 AP → C_AP = 1/max(1,2) = 0.5      → gm = sqrt(0.4*0.5) = 0.4472135954999579
  //   8 + 0.4472135954999579*4 = 9.788854381999831
  const s1 = THREAD.scorePair(a1, state, CANON);
  const s2 = THREAD.scorePair(a2, state, CANON);
  const exp1 = 8 + Math.sqrt(0.4 * 1) * 4;
  const exp2 = 8 + Math.sqrt(0.4 * 0.5) * 4;
  assert.ok(Math.abs(s1 - exp1) < 1e-9, `expected ${exp1}, got ${s1}`);
  assert.ok(Math.abs(s2 - exp2) < 1e-9, `expected ${exp2}, got ${s2}`);
  assert.ok(s2 < s1, 'the pricier action still scores lower — AP-efficiency pressure survives R6');
  assert.ok(s1 >= 8 && s1 <= 12 && s2 >= 8 && s2 <= 12, 'both stay inside basic_attack — R6 never lets AP cost leave the band');
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
  // 4 dmg / 10 max wounds = C1 = 0.4 ; 1 AP → C_AP = 1
  // gm = sqrt(0.4*1) = 0.6324555320336759 → 100 + 0.6324555320336759*100 = 163.2455532033676
  const expC = 100 + Math.sqrt(0.4 * 1) * 100;
  assert.ok(Math.abs(c - expC) < 1e-9, `expected ${expC}, got ${c}`);
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
  //   clean:  0/3 → floored to EPS 0.01
  //   cursed: 2/3 = 0.6666666...
  // AP efficiency (R6): 1 AP → C_AP = 1, folded in as a THIRD consideration
  //   clean:  gm = (0.375*0.01*1)^(1/3)        = 0.15533...
  //   cursed: gm = (0.375*0.6666666...*1)^(1/3) = 0.25^(1/3) = 0.6299605249474366
  const sClean = THREAD.scorePair(onClean, state, CANON);
  const sCursed = THREAD.scorePair(onCursed, state, CANON);
  const expClean = 25 + Math.pow(0.375 * 0.01 * 1, 1 / 3) * 20;
  const expCursed = 25 + Math.pow(0.375 * (2 / 3) * 1, 1 / 3) * 20;
  assert.ok(Math.abs(sClean - expClean) < 1e-9, `expected ${expClean}, got ${sClean}`);
  assert.ok(Math.abs(sCursed - expCursed) < 1e-9, `expected ${expCursed}, got ${sCursed}`);
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
  // AP efficiency (R6): 1 AP → C_AP = 1, folded in → gm = sqrt(0.8*1) = 0.8944271909999159
  // offensive [20,40] → 20 + 0.8944271909999159*20 = 37.88854381999832
  const marked = {
    actor: 'a', kind: 'kit', item: { n: 'Hex' }, target: 'z', ap: 1,
    meta: { hostile: true, tags: ['Marked'], payload: [{ tag: 'Marked', tier: 2, hostile: true }], tgtWeapons: 1 },
  };
  const expMarked = 20 + Math.sqrt(0.8 * 1) * 20;
  assert.ok(Math.abs(THREAD.scorePair(marked, state, CANON) - expMarked) < 1e-9);

  // Immunity carries an Infinity duration — the friendly path is peril-weighted (C3), so
  // warding a full-health model floors C3 to EPS 0.01. AP efficiency (R6) folds in as a
  // second consideration: gm = sqrt(0.01*1) = 0.1 → 25 + 0.1*20 = 27 (no post-band divisor)
  const ward = {
    actor: 'a', kind: 'kit', item: { n: 'Ward' }, target: 'a', ap: 1,
    meta: { hostile: false, self: true, tags: ['Immunity'], payload: [{ tag: 'Immunity', tier: 1, hostile: false }] },
  };
  const expWard = 25 + Math.sqrt(0.01 * 1) * 20;
  assert.ok(Math.abs(THREAD.scorePair(ward, state, CANON) - expWard) < 1e-9);
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

  // canon-less scorePair falls back to the shipped band table: 5 dmg / 10 max = C1 = 0.5
  // AP efficiency (R6): 1 AP → C_AP = 1 → gm = sqrt(0.5*1) = 0.7071067811865476
  // 8 + 0.7071067811865476*4 = 10.82842712474619 (no post-band divisor)
  const atk = { actor: 'a', kind: 'attack', item: { damage: 5, element: 'Physical', ap: 1 }, target: 'z', ap: 1, meta: { band: 'MELEE' } };
  const st = { pools: {}, combatants: { a: { party: 'B', x: 0, y: 0, w: [5, 5] }, z: { party: 'A', x: 1, y: 0, w: [10, 10] } } };
  const expAtk = 8 + Math.sqrt(0.5 * 1) * 4;
  assert.ok(Math.abs(THREAD.scorePair(atk, st) - expAtk) < 1e-9, `expected ${expAtk}`);
  assert.strictEqual(THREAD.scorePair({ kind: 'wat', ap: 1 }, st, CANON), 0, 'an unknown kind can never be drawn');
  assert.strictEqual(THREAD.scorePair(null, st, CANON), 0);
});

test('scorePair R6: NPCB_MOVE_FACTOR bound — a move scores below even the WORST-CASE real action (finding 3)', () => {
  // The pre-R6 comment claimed "a move can never outbid a real action," but with the
  // post-band divisor a 3-AP action at its band floor scored 8/3 < move's 4 — false.
  // R6's real bound: a real action's worst case is gm = NPCB_EPS across every
  // consideration it has (including AP efficiency), so its floor is
  // band[0] + NPCB_EPS*(band[1]-band[0]). For basic_attack that is 8 + 0.01*4 = 8.04,
  // still comfortably above a move's 8*0.5 = 4.
  const board = openBoard(6, 3);
  // 0 damage → C1 floors to EPS; ap 200 → 1/max(1,200) = 0.005, which ALSO floors to
  // EPS (npcNorm clamps anything <= EPS up to EPS) → gm = sqrt(EPS*EPS) = EPS exactly.
  const DUD = { name: 'Dud', band: 'MELEE', ap: 200, damage: 0, element: 'Physical' };
  const state = {
    board,
    pools: { B: 250 },
    combatants: {
      ork:  { party: 'B', x: 0, y: 0, w: [12, 12], sight: 5, spd: 4, weps: [DUD] },
      hero: { party: 'A', x: 1, y: 0, w: [10, 10], sight: 5, spd: 4 },
    },
  };
  const pairs = THREAD.enumeratePairs('B', state, board, wep, kit, CANON);
  const atk = pairs.find((p) => p.kind === 'attack');
  const mv = pairs.find((p) => p.kind === 'move');
  assert.ok(atk && mv);

  const sAtk = THREAD.scorePair(atk, state, CANON);
  const sMv = THREAD.scorePair(mv, state, CANON);
  const expAtk = 8 + 0.01 * 4;   // 8.04 — the theoretical floor of the basic_attack band
  assert.ok(Math.abs(sAtk - expAtk) < 1e-9, `expected ${expAtk}, got ${sAtk}`);
  assert.strictEqual(sMv, 4, 'the move is unaffected — no considerations, no AP division');
  assert.ok(sMv < sAtk, 'even the worst-case real action outscores the move fallback');
});

/* ── T-NPC-3.5 · Task 5 — brain part 2: TILT + DRAW + TRACE ───────────
   THREAD.tiltScores(pairs, behavior, canon) → pairs   (filtered; scores multiplied in place)
   THREAD.drawAction(pairs, rng, lastKind, canon) → pair|null
   npcTurn(side,state,board,weaponsOf,kitOf,canon,behavior) — six-step integration

   THE TILT FORMULA (stated here because it IS the contract):
     mult(axis,pivot,max) = clamp(1 + (axis-pivot)/(100-pivot) * (max-1), 1/max, max)
   Linear, symmetric about the pivot: at the pivot exactly 1.0, at 100 exactly
   max_mult, and DOWN below the pivot to a floor of 1/max_mult. Monotone
   non-decreasing in the axis, so raising an axis can never lower the rank of a
   pair that axis favors.

   PAIR CLASSES (canon rules.npc_brain.tilt):
     ferocity    'melee_close'  → attack pairs at MELEE band + move pairs (intent close)
     cunning     'denial_ranged'→ kit pairs carrying Suppressing/Slowing + non-MELEE attacks
     supremacism 'leader'       → any pair flagged meta.leader (npcTurn stamps it)
     honor >= honor_high        → hostile DoT kit pairs REMOVED (cruelty veto);
                                  leader pairs multiplied (duel preference)
     honor <= honor_low         → hostile DoT kit pairs multiplied UP (cruelty favored)
     pragmatism                 → consumable item kit pairs, pivot pragmatism_item_pivot */

const BRAIN_CANON = {
  rules: {
    combat: { actions_per_post: 3 },
    npc_brain: {
      bands: { basic_attack: [8, 12], offensive: [20, 40], support: [25, 45], reaction: [50, 70] },
      draw_cutoff: 0.7,
      inertia_bonus: 0.15,
      tilt: {
        ferocity: { targets: 'melee_close', pivot: 50, max_mult: 1.6 },
        cunning: { targets: 'denial_ranged', pivot: 50, max_mult: 1.6 },
        supremacism: { targets: 'leader', pivot: 50, max_mult: 1.6 },
        honor_high: 70, honor_low: 30, pragmatism_item_pivot: 50,
      },
    },
  },
};
const FLAT = { ferocity: 50, cunning: 50, pragmatism: 50, honor: 50, supremacism: 50 };
const beh = (over) => Object.assign({}, FLAT, over);
// hand-built pairs: tiltScores/drawAction read only .kind/.score/.meta/.item
const denialPair = (score) => ({ actor: 'b0', kind: 'kit', item: { n: 'Warp Chains' }, target: 'a0', ap: 1,
  score, meta: { kitKind: 'cast', hostile: true, tags: ['Suppressing'], consumable: false } });
const dotPair = (score) => ({ actor: 'b0', kind: 'kit', item: { n: 'Plague Censer' }, target: 'a0', ap: 1,
  score, meta: { kitKind: 'cast', hostile: true, tags: ['DoT'], consumable: false } });
const meleePair = (score) => ({ actor: 'b0', kind: 'attack', item: { name: 'Chainsword' }, target: 'a0', ap: 1,
  score, meta: { band: 'MELEE', dist: 1, weapon: 'Chainsword' } });
const rangedPair = (score) => ({ actor: 'b0', kind: 'attack', item: { name: 'Boltgun' }, target: 'a0', ap: 1,
  score, meta: { band: 'MEDIUM', dist: 5, weapon: 'Boltgun' } });
const consumablePair = (score) => ({ actor: 'b0', kind: 'kit', item: { n: 'Stimm Shot' }, target: 'b0', ap: 0,
  score, meta: { kitKind: 'item', hostile: false, tags: ['Regen'], consumable: true, self: true } });

test('tiltScores: the linear form — pivot is 1.0, 100 is max_mult, floor is 1/max_mult', () => {
  const at = (cun) => THREAD.tiltScores([denialPair(10)], beh({ cunning: cun }), BRAIN_CANON)[0].score;
  assert.ok(Math.abs(at(50) - 10) < 1e-9, 'at the pivot the score is untouched');
  assert.ok(Math.abs(at(100) - 16) < 1e-9, 'cunning 100 → x1.6');
  assert.ok(Math.abs(at(75) - 13) < 1e-9, 'cunning 75 → 1 + 0.5x0.6 = x1.3');
  assert.ok(Math.abs(at(0) - 10 / 1.6) < 1e-9, 'cunning 0 → clamped to the 1/max_mult floor');
});

test('tiltScores monotonicity: raising cunning never lowers a denial pair\'s rank', () => {
  let prevRatio = -1;
  for (let cun = 0; cun <= 100; cun += 5) {
    const out = THREAD.tiltScores([denialPair(10), meleePair(10)], beh({ cunning: cun }), BRAIN_CANON);
    const d = out.find((p) => p.meta.tags && p.meta.tags[0] === 'Suppressing').score;
    const m = out.find((p) => p.kind === 'attack').score;
    const ratio = d / m;
    assert.ok(ratio >= prevRatio - 1e-12, 'denial/melee ratio never falls as cunning rises (cun ' + cun + ')');
    prevRatio = ratio;
  }
});

test('tiltScores: ferocity lifts melee attacks, cunning lifts ranged ones', () => {
  const fer = THREAD.tiltScores([meleePair(10), rangedPair(10)], beh({ ferocity: 100 }), BRAIN_CANON);
  assert.ok(fer[0].score > fer[1].score, 'ferocity 100 → the melee pair outranks the ranged one');
  const cun = THREAD.tiltScores([meleePair(10), rangedPair(10)], beh({ cunning: 100 }), BRAIN_CANON);
  assert.ok(cun[1].score > cun[0].score, 'cunning 100 → the ranged pair outranks the melee one');
});

test('tiltScores: supremacism lifts pairs aimed at the enemy leader', () => {
  const p = [meleePair(10), Object.assign(meleePair(10), { target: 'boss', meta: { band: 'MELEE', leader: true } })];
  const out = THREAD.tiltScores(p, beh({ supremacism: 100 }), BRAIN_CANON);
  assert.ok(out[1].score > out[0].score, 'the leader-targeted pair is lifted');
});

test('tiltScores honor veto: honor 80 → zero hostile DoT pairs survive', () => {
  const out = THREAD.tiltScores([dotPair(30), denialPair(30), meleePair(10)], beh({ honor: 80 }), BRAIN_CANON);
  assert.ok(!out.some((p) => p.meta.tags && p.meta.tags.indexOf('DoT') >= 0), 'the cruelty pair is removed entirely');
  assert.strictEqual(out.length, 2, 'the other pairs survive');
});

test('tiltScores honor: high honor prefers the duel, low honor favors cruelty', () => {
  const lead = () => Object.assign(meleePair(10), { target: 'boss', meta: { band: 'MELEE', leader: true } });
  const hi = THREAD.tiltScores([lead()], beh({ honor: 100, supremacism: 50 }), BRAIN_CANON)[0].score;
  assert.ok(hi > 10, 'honor 100 → the leader duel is preferred (' + hi + ' > 10)');
  const lo = THREAD.tiltScores([dotPair(10)], beh({ honor: 0 }), BRAIN_CANON)[0].score;
  assert.ok(lo > 10, 'honor 0 → DoT/cruelty is favored (' + lo + ' > 10)');
  const mid = THREAD.tiltScores([dotPair(10)], beh({ honor: 50 }), BRAIN_CANON)[0].score;
  assert.ok(Math.abs(mid - 10) < 1e-9, 'honor 50 → neither vetoed nor boosted');
});

test('tiltScores pragmatism gate: prag 10 collapses a consumable below the draw cutoff', () => {
  const out = THREAD.tiltScores([consumablePair(10), meleePair(10)], beh({ pragmatism: 10 }), BRAIN_CANON);
  const item = out.find((p) => p.kind === 'kit'), atk = out.find((p) => p.kind === 'attack');
  assert.ok(item.score < atk.score * 0.7, 'the consumable falls under draw_cutoff x best (' + item.score + ')');
  // and the draw itself must then never pick it, whatever the rng says
  for (let i = 0; i < 20; i++) {
    const pick = THREAD.drawAction(out, () => i / 20, null, BRAIN_CANON);
    assert.strictEqual(pick.kind, 'attack', 'a collapsed consumable is never drawn');
  }
  const hi = THREAD.tiltScores([consumablePair(10)], beh({ pragmatism: 100 }), BRAIN_CANON)[0].score;
  assert.ok(hi > 10, 'prag 100 → consumables are spent freely (' + hi + ')');
});

test('drawAction: drops everything below draw_cutoff x best, keeps the band', () => {
  const pairs = [meleePair(10), rangedPair(7.5), denialPair(6.9)];   // cutoff = 7.0
  const seen = {};
  for (let i = 0; i < 50; i++) seen[THREAD.drawAction(pairs, () => i / 50, null, BRAIN_CANON).meta.weapon || 'kit'] = 1;
  assert.ok(seen.Chainsword && seen.Boltgun, 'both survivors get drawn');
  assert.ok(!seen.kit, 'the 6.9 pair is below 0.7 x 10 and never drawn');
});

test('drawAction: deterministic for a given rng, and null on an empty list', () => {
  const pairs = [meleePair(10), rangedPair(9.5)];
  const mk = () => { let n = 0; return () => [0.1, 0.9][n++ % 2]; };
  const a = THREAD.drawAction(pairs, mk(), null, BRAIN_CANON);
  const b = THREAD.drawAction(pairs, mk(), null, BRAIN_CANON);
  assert.strictEqual(a.meta.weapon, b.meta.weapon, 'same rng stream → same pick');
  assert.strictEqual(THREAD.drawAction([], () => 0.5, null, BRAIN_CANON), null, 'empty → null');
  assert.strictEqual(THREAD.drawAction(null, () => 0.5, null, BRAIN_CANON), null, 'null → null');
});

test('drawAction distribution: two near-equal candidates BOTH get picked over 200 seeds', () => {
  const pairs = [meleePair(10), rangedPair(9.5)];   // within 10%
  let a = 0, b = 0;
  for (let s = 0; s < 200; s++) {
    const r = ((s * 2654435761) % 4294967296) / 4294967296;   // a spread of seeds in [0,1)
    const pick = THREAD.drawAction(pairs, () => r, null, BRAIN_CANON);
    if (pick.meta.weapon === 'Chainsword') a++; else b++;
  }
  assert.ok(a >= 20 && b >= 20, 'each of the top-2 is picked at least 10% of 200 draws (' + a + '/' + b + ')');
});

test('drawAction inertia: repeating the previous line wins a near-tie it would otherwise lose', () => {
  // the inertia KEY of a kit pair is its item kind ('cast'), of any other pair its .kind
  // ('attack') — so a cast following a cast, or a shot following a shot, gets the bonus.
  const pairs = [denialPair(10), rangedPair(10.5)];
  // no inertia: weights 10 / 10.5, total 20.5 — rng 0.5 → 10.25 lands in the SECOND bucket
  assert.strictEqual(THREAD.drawAction(pairs, () => 0.5, null, BRAIN_CANON).kind, 'attack');
  // inertia: the cast repeats last turn's line → 10 + 0.15x10 = 11.5, total 22
  //          rng 0.5 → 11.0 now lands in the FIRST bucket
  assert.strictEqual(THREAD.drawAction(pairs, () => 0.5, 'cast', BRAIN_CANON).kind, 'kit');
  // and the key really is the ITEM kind, not the literal string 'kit'
  assert.strictEqual(THREAD.drawAction(pairs, () => 0.5, 'kit', BRAIN_CANON).kind, 'attack');
  // an attack repeating an attack takes the bonus the same way
  const both = [rangedPair(10), denialPair(10.5)];
  assert.strictEqual(THREAD.drawAction(both, () => 0.5, null, BRAIN_CANON).kind, 'kit');
  assert.strictEqual(THREAD.drawAction(both, () => 0.5, 'attack', BRAIN_CANON).kind, 'attack');
});

/* ── the six-step npcTurn ─────────────────────────────────────────── */
const bwep = (c) => c.weps || [];
const bkit = (c) => c.kit || [];
const STUB_KIT = function () { return []; };
const SUPPRESS_CAST = {
  item: { n: 'Warp Chains', cat: 'CAST', d: 'Short range. Binds the target in place.' },
  kind: 'cast', ap: 1, consumed: false,
  payload: [{ tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' }],
};
function duelState() {
  return {
    id: 't-brain', round: 1,
    pools: { B: 10, A: 10 },
    combatants: {
      b0: { party: 'B', x: 2, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], model: { pc: 10 },
            weps: [SHORT1], kit: [SUPPRESS_CAST] },
      a0: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], model: { pc: 10 }, weps: [SHORT1] },
    },
  };
}

test('npcTurn: the six-step brain stages kit actions too, and every block validates', () => {
  // NOTE (R6): the canon bands make an offensive cast (20-40) strictly outrank a
  // basic attack (8-12), so once a legal cast exists the shot falls below
  // draw_cutoff x best and is not a co-candidate. What is pinned here is that the
  // kit action is REACHED AT ALL (the weapons-only brain never could) and that every
  // block the brain produces survives the real validator.
  let sawCond = false;
  for (let r = 1; r <= 40; r++) {
    const st = duelState(); st.round = r;
    const block = THREAD.npcTurn('B', st, openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT);
    assert.ok(block.length, 'round ' + r + ': the NPC acts');
    const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'B', block, BRAIN_CANON);
    assert.ok(v.ok, 'round ' + r + ': block passes the real validator — ' + v.reason);
    if (block.some((b) => b.effect.kind === 'cond')) sawCond = true;
  }
  assert.ok(sawCond, 'the NPC actually casts its Suppressing cast');
  // and with no kit at all it still fights with its gun
  const st2 = duelState();
  const b2 = THREAD.npcTurn('B', st2, openBoard(10, 4), bwep, STUB_KIT, BRAIN_CANON, FLAT);
  assert.ok(b2.some((b) => b.effect.kind === 'damage'), 'weapons-only side still shoots');
});

test('npcTurn: a staged kit action carries its item so consumables can be depleted', () => {
  let entry = null;
  for (let r = 1; r <= 40 && !entry; r++) {
    const st = duelState(); st.round = r;
    const block = THREAD.npcTurn('B', st, openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT);
    entry = block.find((b) => b.effect.kind === 'cond' && !b.fanout) || null;
  }
  assert.ok(entry, 'a kit action was staged somewhere in the 40 seeds');
  assert.strictEqual(entry.cost, 1, 'the kit entry carries the AP cost');
  assert.strictEqual(entry.item.n, 'Warp Chains', 'block entry carries item {n,cat,d} for Task 6');
  assert.strictEqual(entry.effect.item.n, 'Warp Chains', 'mirrored on the effect');
  assert.strictEqual(entry.effect.add.tag, 'Suppressing');
  assert.strictEqual(entry.effect.add.band, 'SHORT', 'the cond band is stamped for validate\'s range gate');
  assert.notStrictEqual(entry.effect.add, SUPPRESS_CAST.payload[0], 'a FRESH payload object — meta.payload is by reference');
  assert.deepStrictEqual(SUPPRESS_CAST.payload, [{ tag: 'Suppressing', tier: 1, hostile: true, el: 'Warp' }],
    'the source payload was never mutated');
});

// final review Critical #1 reproduction, as a pin (Ruling R11): pre-fix, every band floor sat
// above basic_attack's ceiling and scorePair had no redundancy term, so the SAME cast landed on
// the SAME target every post, forever, and the weapon never fired again — reproduced by the
// reviewer over 12 rounds with real validate/apply (one NPC with a Suppressing cast + a gun vs
// one enemy: "cond ok=true a0 conds=[\"Suppressing1/1\"] a0 w=10" every round, zero damage).
// Post-fix: cast once, then the pruned-redundant cast frees the weapon to fire every round after.
test('npcTurn: fix wave finding 1 — a kit-carrying NPC casts once then keeps shooting, never re-applying the same active cond (12-round reproduction)', () => {
  const st = duelState();   // persisted across rounds — NOT rebuilt each round, unlike the six-step test above
  let condCount = 0, damageCount = 0;
  for (let r = 1; r <= 12; r++) {
    st.round = r;
    const block = THREAD.npcTurn('B', st, openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT);
    assert.ok(block.length, 'round ' + r + ': the NPC acts');
    const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'B', block, BRAIN_CANON);
    assert.ok(v.ok, 'round ' + r + ': block passes the real validator — ' + v.reason);
    THREAD.apply({ type: 'SKIRMISH' }, st, block, BRAIN_CANON, 'B');
    block.forEach((b) => {
      if (b.effect.kind === 'cond') condCount++;
      if (b.effect.kind === 'damage') damageCount++;
    });
    if (st.combatants.a0.dead) break;
  }
  assert.strictEqual(condCount, 1, 'Suppressing is applied exactly once across the run — never re-cast while it is still active');
  assert.ok(damageCount > 0, 'the freed-up turns actually land weapon damage on the enemy');
  assert.ok(st.combatants.a0.w[0] < st.combatants.a0.w[1] || st.combatants.a0.dead,
    'the enemy took real wounds over the run — not the pre-fix zero-damage lockup');
});

test('npcTurn: determinism — same state, same seed, same block', () => {
  const b1 = THREAD.npcTurn('B', duelState(), openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT);
  const b2 = THREAD.npcTurn('B', duelState(), openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(b1)), JSON.parse(JSON.stringify(b2)));
});

test('npcTurn: aiTrace records every decision, JSON-safe, capped at 40', () => {
  const st = duelState();
  for (let r = 1; r <= 45; r++) { st.round = r; THREAD.npcTurn('B', st, openBoard(10, 4), bwep, bkit, BRAIN_CANON, FLAT); }
  const tr = st.aiTrace;
  assert.ok(Array.isArray(tr), 'state.aiTrace is an array');
  assert.strictEqual(tr.length, 40, 'ring buffer capped at 40');
  const e = tr[tr.length - 1];
  assert.strictEqual(e.actor, 'b0');
  assert.ok(e.chosen && typeof e.chosen.kind === 'string' && typeof e.chosen.score === 'number');
  assert.ok(Array.isArray(e.top) && e.top.length >= 1 && e.top.length <= 5, 'top-5 candidates');
  assert.ok(typeof e.top[0].action === 'string' && typeof e.top[0].score === 'number');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(tr)), tr, 'the whole trace is JSON-safe');
});

test('npcTurn: the legacy arity (side,state,board,weaponsOf,canon,behavior) still works', () => {
  const st = duelState();
  const block = THREAD.npcTurn('B', st, openBoard(10, 4), bwep, BRAIN_CANON, FLAT);   // no kitOf
  assert.ok(block.some((b) => b.effect.kind === 'damage'), 'weapons-only legacy call still fights');
  assert.ok(!block.some((b) => b.effect.kind === 'cond'), 'and mints no kit action without a kitOf');
});

test('npcTurn: the stub kitOf reproduces weapons-only behavior', () => {
  const st = duelState();
  const block = THREAD.npcTurn('B', st, openBoard(10, 4), bwep, STUB_KIT, BRAIN_CANON, FLAT);
  assert.ok(block.some((b) => b.effect.kind === 'damage'));
  assert.ok(!block.some((b) => b.effect.kind === 'cond'));
});

/* ── Fix round 1 (review finding) — the draw seed's "thread id" component was dead
   in production: state.id was never stamped anywhere outside this test file's own
   duelState() fixture, so String(state.id||'') was always '' and two concurrent
   combat threads at the same (side, round, actor) drew from the same rng roll. The
   fix stamps state.id in THREAD.initState (the one seam every combat state passes
   through) and drops the dead state.posts half of the turnIx ternary. These pins
   exercise BOTH halves of the seed: the thread-id component (cross-thread
   independence) and the round component (turn-index advance). Both need a REAL
   choice to observe, so the two weapons here are tied on every scoring input
   (same band/ap/damage/element) — scorePair is deterministic, so they always
   survive draw_cutoff together and the draw is a genuine 50/50 on the rng roll. */
const WEP_A = { name: 'Chainsword', band: 'MELEE', ap: 1, damage: 4, element: 'Physical' };
const WEP_B = { name: 'Power Fist', band: 'MELEE', ap: 1, damage: 4, element: 'Physical' };
function tiedDuelState(id) {
  return {
    id: id, round: 1,
    pools: { B: 10, A: 10 },
    combatants: {
      b0: { party: 'B', x: 1, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], model: { pc: 10 },
            weps: [WEP_A, WEP_B], kit: [] },
      a0: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], model: { pc: 10 }, weps: [SHORT1] },
    },
  };
}
function drawnWeapon(side, state) {
  const block = THREAD.npcTurn(side, state, openBoard(10, 4), bwep, STUB_KIT, BRAIN_CANON, FLAT);
  const hit = block.find((b) => b.effect.kind === 'damage');
  return hit ? hit.effect.weapon : null;
}

test('initState/create stamp state.id from the owning thread\'s id', () => {
  const s = THREAD.initState({ id: 'thread-alpha', type: 'SKIRMISH', seedState: {} }, BRAIN_CANON);
  assert.strictEqual(s.id, 'thread-alpha', 'initState carries the thread id onto the state it builds');
  const t = THREAD.create({ id: 'thread-beta', type: 'SKIRMISH', n: 'x', seedState: {} }, BRAIN_CANON);
  assert.strictEqual(t.state.id, 'thread-beta', 'create (no persisted state yet) carries it through too');
  const noId = THREAD.initState({ type: 'SKIRMISH', seedState: {} }, BRAIN_CANON);
  assert.strictEqual(noId.id, '', 'a thread with no id yet degrades to the empty-string fallback, not undefined/null');
});

test('npcTurn draw seed: two states identical except thread id draw independently', () => {
  let sawDifference = false;
  for (let r = 1; r <= 30; r++) {
    const wA = drawnWeapon('B', Object.assign(tiedDuelState('thread-A'), { round: r }));
    const wB = drawnWeapon('B', Object.assign(tiedDuelState('thread-B'), { round: r }));
    if (wA !== wB) { sawDifference = true; break; }
  }
  assert.ok(sawDifference, 'at least one round drew a different weapon between two otherwise-identical thread ids');
});

test('npcTurn draw seed: the round (turn index) advances the draw', () => {
  // rounds 2 and 3 are the concrete pair verified to diverge for this fixture — the
  // spirit of the pin (any two round values CAN draw differently) is what matters.
  const s2 = tiedDuelState('thread-same-2v3'); s2.round = 2;
  const s3 = tiedDuelState('thread-same-2v3'); s3.round = 3;
  const at2 = drawnWeapon('B', s2), at3 = drawnWeapon('B', s3);
  assert.notStrictEqual(at2, at3, 'round 2 and round 3 draw different weapons for the same thread/actor');
});
