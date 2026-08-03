const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadMission } = require('./_load-mission');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const MISSION = loadMission();
const THREAD = loadThread();

const CTX = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null,     doors: ['shop', 'muster'], npc: null, garrison: true },
    // T-MSN-1B task 5 fix round: cond values are the REAL canon condition ids
    // (galaxy.conditions[].id — lowercase), not the old placeholder "Ruined". rebuild's
    // prefer_condition was fixed to match (see canon v1.27 note).
    { id: 'l2', name: 'Shattered Row', cond: 'ruined', doors: [],               npc: 'Magos Vex', garrison: false }
  ]
});
const CTX_NO_GARRISON = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null,     doors: ['shop', 'muster'], npc: null, garrison: false },
    { id: 'l2', name: 'Shattered Row', cond: 'ruined', doors: [],               npc: 'Magos Vex', garrison: false }
  ]
});
// T-MSN-1B task 5: a garrisoned, besieged location — for the defend/besieged condition-weight test.
const CTX_BESIEGED = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null,      doors: ['shop', 'muster'], npc: null, garrison: true },
    { id: 'l2', name: 'The Last Wall', cond: 'besieged', doors: ['muster'],      npc: null, garrison: true }
  ]
});
function mkState() {
  return { world: { missions: {}, missionSeedBase: 12345, missionDay: 0 } };
}

test('rng is deterministic', () => {
  const a = MISSION.rng(42), b = MISSION.rng(42);
  for (let i = 0; i < 5; i++) assert.strictEqual(a(), b());
});

test('payoutOf: family_base x size x prod_mult, size clamped', () => {
  // KILL base 10, norm 5. target 5 -> size 1 -> 10 * 1 * 2.0 = 20
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 5 }, 2.0, canon), 20);
  // target 1 -> raw size 0.2 -> clamped to 0.5 -> 10 * 0.5 * 1 = 5
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 1 }, 1.0, canon), 5);
  // huge target clamps at 4 -> 10 * 4 * 1 = 40
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 99 }, 1.0, canon), 40);
});

test('refillBoard fills to within [board_min, board_max] and faces every mission', () => {
  const r = MISSION.rng(7);
  const board = MISSION.refillBoard([], CTX(), canon, r, 0);
  assert.ok(board.length >= 4 && board.length <= 6, 'got ' + board.length);
  const rowsById = {};
  canon.missions.universal.forEach(rw => { rowsById[rw.id] = rw; });
  board.forEach(m => {
    assert.ok(['door', 'npc', 'notice'].indexOf(m.face.kind) >= 0);
    assert.ok(m.payout > 0);
    const tr = rowsById[m.mid].target_roll;
    assert.ok(m.target >= tr[0] && m.target <= tr[1],
      'target ' + m.target + ' must fall within ' + m.mid + "'s own target_roll " + JSON.stringify(tr));
    assert.strictEqual(m.accepted, false);
    assert.strictEqual(m.pl, 'testp');
  });
});

test('condition preference: a Ruined location draws rebuild', () => {
  // over many rolls, rebuild must appear and sit on the Ruined location
  const r = MISSION.rng(3);
  let sawRebuildOnRuins = false;
  for (let day = 0; day < 10 && !sawRebuildOnRuins; day++) {
    const board = MISSION.refillBoard([], CTX(), canon, r, day);
    sawRebuildOnRuins = board.some(m => m.mid === 'rebuild' && m.lid === 'l2');
  }
  assert.ok(sawRebuildOnRuins);
});

test('needs_hostiles missions only land on garrisoned locations', () => {
  const r = MISSION.rng(11);
  const garrisonedIds = CTX().locs.filter(l => l.garrison).map(l => l.id);
  let sawPurge = false;
  for (let day = 0; day < 10; day++) {
    const board = MISSION.refillBoard([], CTX(), canon, r, day);
    board.filter(m => m.mid === 'purge').forEach(m => {
      sawPurge = true;
      assert.ok(garrisonedIds.includes(m.lid), 'purge instance must sit on a garrisoned loc, got ' + m.lid);
    });
  }
  assert.ok(sawPurge, 'expected at least one purge instance over 10 days');
});

test('no garrisoned loc -> board never contains purge', () => {
  const r = MISSION.rng(11);
  for (let day = 0; day < 10; day++) {
    const board = MISSION.refillBoard([], CTX_NO_GARRISON(), canon, r, day);
    assert.ok(!board.some(m => m.mid === 'purge'), 'no purge should ever be minted without a garrison');
    assert.ok(board.length >= 4 && board.length <= 6, 'board still fills from the other rows, got ' + board.length);
  }
});

test('expiry replaces stale unaccepted missions but never accepted ones', () => {
  const r = MISSION.rng(9);
  const board = MISSION.refillBoard([], CTX(), canon, r, 0);
  board[0].accepted = true;
  const keepIid = board[0].iid;
  const later = MISSION.refillBoard(board, CTX(), canon, r, 99); // way past expiry_days
  assert.ok(later.some(m => m.iid === keepIid), 'accepted mission survives expiry');
  assert.ok(later.filter(m => !m.accepted).every(m => m.day === 99), 'unaccepted stale ones replaced');
});

test('catchUpBoards is deterministic AND chunk-independent (seeded-roll discipline)', () => {
  const s1 = mkState(), s2 = mkState();
  const ctxOf = () => CTX();
  // 3 days in one call vs 1 + 2 across two calls: identical boards
  MISSION.catchUpBoards(s1, canon, 3, () => ['testp'], ctxOf);
  MISSION.catchUpBoards(s2, canon, 1, () => ['testp'], ctxOf);
  MISSION.catchUpBoards(s2, canon, 2, () => ['testp'], ctxOf);
  assert.deepStrictEqual(s1.world.missions, s2.world.missions);
  assert.strictEqual(s1.world.missionDay, 3);
  assert.strictEqual(s1.world.missionSeedBase, 12345, 'base seed never mutates');
  // zero ticks: no-op
  const before = JSON.stringify(s1.world.missions);
  MISSION.catchUpBoards(s1, canon, 0, () => ['testp'], ctxOf);
  assert.strictEqual(JSON.stringify(s1.world.missions), before);
});

// ── T-MSN-1B task 3: named-target spawn + Liberation/Defend seeding ──

const FAC_MODELS = [
  { n: 'Grunt', cls: 'Core', pc: 10, w: 2, sp: 4, sl: 1 },
  { n: 'Trooper', cls: 'Core', pc: 12, w: 2, sp: 4, sl: 1 },
  { n: 'Heavy', cls: 'Assault', pc: 30, w: 4, sp: 3, sl: 2 },
  { n: 'Warlord', cls: 'Armament', pc: 60, w: 6, sp: 3, sl: 3 }
];
const WEP = { n: 'Rending Claws', cat: 'WEAPON', d: 'Phys 2 - Melee' };

test('rollMission seeds a deterministic target_name for named-filter rows (bounty_hunt/assassination)', () => {
  const bountyRow = canon.missions.universal.find(rw => rw.id === 'bounty_hunt');
  const names = canon.rules.missions.bounty_names;
  assert.ok(names && names.length > 0);
  const r1 = MISSION.rng(4242);
  const inst1 = MISSION.rollMission(bountyRow, CTX(), r1, 0, canon);
  assert.ok(names.includes(inst1.params.target_name));
  // same seed -> same name
  const r2 = MISSION.rng(4242);
  const inst2 = MISSION.rollMission(bountyRow, CTX(), r2, 0, canon);
  assert.strictEqual(inst1.params.target_name, inst2.params.target_name);
  // assassination is filter:'named' too, and keeps its 'alone' flag through the deep clone
  const assRow = canon.missions.universal.find(rw => rw.id === 'assassination');
  const r3 = MISSION.rng(4242);
  const inst3 = MISSION.rollMission(assRow, CTX(), r3, 0, canon);
  assert.ok(names.includes(inst3.params.target_name));
  assert.strictEqual(inst3.params.alone, true);
});

test('a different seed CAN pick a different target_name (not hardcoded to one index)', () => {
  const bountyRow = canon.missions.universal.find(rw => rw.id === 'bounty_hunt');
  const seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    const r = MISSION.rng(seed);
    const inst = MISSION.rollMission(bountyRow, CTX(), r, 0, canon);
    seen.add(inst.params.target_name);
  }
  assert.ok(seen.size > 1, 'expected variety across seeds, got only ' + [...seen].join(', '));
});

test('non-named rows never get a target_name', () => {
  const purgeRow = canon.missions.universal.find(rw => rw.id === 'purge');
  const r = MISSION.rng(99);
  const inst = MISSION.rollMission(purgeRow, CTX(), r, 0, canon);
  assert.strictEqual(inst.params.target_name, undefined);
});

test('genHostiles: named branch spawns ONE named boss (highest-pc model, x1.5) + a reduced escort', () => {
  const params = { filter: 'named', target_name: 'Varkon the Flayed' };
  const specs = MISSION.genHostiles(params, 4, FAC_MODELS, WEP);
  const boss = specs.filter(s => s.id === 'e0')[0];
  assert.ok(boss, 'expected a boss entry at e0');
  assert.strictEqual(boss.n, 'Varkon the Flayed', 'gen.n must carry the exact target_name trackKill reads');
  assert.strictEqual(boss.named, true);
  assert.strictEqual(boss.pc, Math.round(60 * 1.5), 'boss pc = highest-pc model (Warlord, 60) x1.5');
  // escort = half the generic count (mineCount 4 -> generic n = 4 -> escort = 2), min 1
  const escort = specs.filter(s => s.id !== 'e0');
  assert.strictEqual(escort.length, 2);
  escort.forEach(e => assert.notStrictEqual(e.named, true));
});

test('genHostiles: escort never drops below 1 even for a 2-model mineCount', () => {
  const params = { filter: 'named', target_name: 'The Rustling Man' };
  const specs = MISSION.genHostiles(params, 2, FAC_MODELS, WEP);
  assert.strictEqual(specs.length, 2, 'boss + 1 escort, never zero escort');
});

test('genHostiles: generic (non-named) spawn is unchanged - no named flag anywhere', () => {
  const specs = MISSION.genHostiles({ filter: 'hostile' }, 3, FAC_MODELS, WEP);
  assert.strictEqual(specs.length, 3);
  specs.forEach(s => assert.notStrictEqual(s.named, true));
});

test('targetFor: Liberation (clear_all) live target IS the spawned hostile count', () => {
  const libRow = canon.missions.universal.find(rw => rw.id === 'liberation');
  assert.deepStrictEqual(libRow.target_roll, [0, 0], 'liberation always mints a floored 0 target at generation');
  const inst = { kind: 'count_kill', target: 0, params: { filter: 'any', clear_all: true }, family: 'KILL' };
  const specs = MISSION.genHostiles(inst.params, 3, FAC_MODELS, WEP);
  assert.ok(specs.length > 0);
  assert.strictEqual(MISSION.targetFor(inst, specs.length), specs.length,
    'live target must equal the actual spawn count, not the old Math.max(1,...) floor of the 0 roll');
});

test('targetFor: plain count_kill clamps the rolled target down to what actually spawned, floor 1', () => {
  const inst = { kind: 'count_kill', target: 6, params: { filter: 'hostile' }, family: 'KILL' };
  assert.strictEqual(MISSION.targetFor(inst, 2), 2);
  assert.strictEqual(MISSION.targetFor(inst, 0), 1, 'floored at 1 even if nothing spawned');
  assert.strictEqual(MISSION.targetFor(inst, 99), 6, 'never clamps UP past the roll');
});

test('targetFor: survive_rounds (Defend) is untouched - target stays the rolled round count', () => {
  const defendRow = canon.missions.universal.find(rw => rw.id === 'defend');
  const r = MISSION.rng(321);
  const inst = MISSION.rollMission(defendRow, CTX(), r, 0, canon);
  assert.ok(inst.target >= defendRow.target_roll[0] && inst.target <= defendRow.target_roll[1]);
  assert.strictEqual(MISSION.targetFor(inst, 3), inst.target, 'hostile count must never clamp a round target');
  assert.strictEqual(MISSION.targetFor(inst, 0), inst.target);
});

test('Defend accept produces real combatants + a real board, round target straight from the roll', () => {
  const defendRow = canon.missions.universal.find(rw => rw.id === 'defend');
  const r = MISSION.rng(654);
  const inst = MISSION.rollMission(defendRow, CTX(), r, 0, canon);
  assert.ok(THREAD.combatKind(inst.kind),
    'survive_rounds must be a combatKind, or acceptMission never calls seedCombat for Defend');
  // simulate the two pure halves acceptMission/seedCombat wire together at accept time
  const specs = MISSION.genHostiles(inst.params, 3, FAC_MODELS, WEP);
  assert.ok(specs.length > 0, 'Defend must actually spawn hostiles to defend against');
  const combatants = { mine1: { w: [3, 3], conds: [], party: 'you', armour: null } };
  specs.forEach(s => { combatants[s.id] = { w: [s.w, s.w], conds: [], party: 'Hostiles', gen: s, armour: null }; });
  assert.ok(Object.keys(combatants).length > 1, 'state.combatants must be populated');
  const board = THREAD.genBoard(
    { w: 14, h: 10, density: 0.16, palette: ['forest', 'ruins', 'mtn', 'fort'], zoneDepth: 2 },
    MISSION.rng(1)
  );
  assert.ok(board && board.tiles && board.tiles.length, 'state.board must be truthy once combatants exist');
  assert.strictEqual(MISSION.targetFor(inst, specs.length), inst.target,
    'round target comes straight from the roll, never re-derived from hostile count');
});

// ── fix round: pickForce replaces aloneGateReason (must not silently bind whichever idle
// force happened to be first — prefer an exactly-1-model idle force, else refuse by name) ──

test('pickForce: assassination prefers the first idle force with exactly 1 living member', () => {
  const idleForces = [
    { n: 'Alpha', memberCount: 3 },
    { n: 'Bravo', memberCount: 1 },
    { n: 'Charlie', memberCount: 1 }
  ];
  const pick = MISSION.pickForce({ alone: true }, idleForces);
  assert.strictEqual(pick.reason, null);
  assert.strictEqual(pick.force.n, 'Bravo', 'first exactly-1-model idle force wins, not just the first idle force');
});

test('pickForce: refuses and names the checked (first idle) force when none qualifies', () => {
  const idleForces = [{ n: 'Alpha', memberCount: 3 }, { n: 'Bravo', memberCount: 2 }];
  const pick = MISSION.pickForce({ alone: true }, idleForces);
  assert.strictEqual(pick.force, null);
  assert.strictEqual(pick.reason, 'Alpha counts 3 models — this commission demands a lone visitor.');
});

test('pickForce: non-alone missions just take the first idle force', () => {
  const idleForces = [{ n: 'Alpha', memberCount: 3 }, { n: 'Bravo', memberCount: 1 }];
  const pick = MISSION.pickForce({ filter: 'hostile' }, idleForces);
  assert.strictEqual(pick.reason, null);
  assert.strictEqual(pick.force.n, 'Alpha');
});

test('pickForce: no idle forces at all -> no force, no reason (engine\'s separate "all committed" gate applies)', () => {
  const pick = MISSION.pickForce({ alone: true }, []);
  assert.strictEqual(pick.force, null);
  assert.strictEqual(pick.reason, null);
});

// ── fix round item 1 (CRITICAL): needs_hostiles must cover every combat-flavored row, not
// just purge, or bounty_hunt/kill_team/assassination/liberation/defend mint on garrison-less
// planets and can NEVER be accepted (permanent "stale notice") ──

test('canon: all five other combat-flavored rows are marked needs_hostiles (purge already was)', () => {
  ['bounty_hunt', 'kill_team', 'assassination', 'liberation', 'defend'].forEach(id => {
    const row = canon.missions.universal.find(rw => rw.id === id);
    assert.strictEqual(row.needs_hostiles, true, id + ' must require a garrison to mint');
  });
});

test('needs_hostiles: no garrisoned loc -> board NEVER contains any combat-flavored row', () => {
  const r = MISSION.rng(11);
  const combatIds = ['purge', 'bounty_hunt', 'kill_team', 'assassination', 'liberation', 'defend'];
  for (let day = 0; day < 15; day++) {
    const board = MISSION.refillBoard([], CTX_NO_GARRISON(), canon, r, day);
    combatIds.forEach(id => {
      assert.ok(!board.some(m => m.mid === id), id + ' must never mint without a garrison, got it on day ' + day);
    });
    assert.ok(board.length >= 4 && board.length <= 6, 'board still fills from the other rows, got ' + board.length);
  }
});

// ── fix round item 2: genHostiles must fall back to a deterministic name when a 'named' row
// somehow reaches accept with no target_name (stale/pre-1B board row) ──

test('genHostiles: falls back to the first canon bounty name when target_name is missing', () => {
  const specs = MISSION.genHostiles({ filter: 'named' }, 3, FAC_MODELS, WEP, canon);
  const boss = specs.find(s => s.id === 'e0');
  assert.ok(boss);
  assert.strictEqual(boss.n, canon.rules.missions.bounty_names[0]);
  assert.strictEqual(boss.named, true);
});

test('genHostiles: guards a missing/partial weapon (wep.n falls back to \'Claws\')', () => {
  const specs = MISSION.genHostiles({ filter: 'hostile' }, 2, FAC_MODELS, null);
  specs.forEach(s => assert.strictEqual(s.sl[0].it.n, 'Claws'));
});

// ── fix round item 4: named missions pay a premium on top of the plain family/size floor ──

test('payoutOf: named missions pay rules.missions.named_premium x their family floor', () => {
  assert.strictEqual(canon.rules.missions.named_premium, 1.5);
  const named = { family: 'KILL', target: 1, params: { filter: 'named', target_name: 'Test' } };
  // KILL base 10, norm 5, target 1 -> raw size 0.2 -> clamped to floor 0.5 -> 10*0.5=5 -> x1.5 -> 7.5 -> round 8
  assert.strictEqual(MISSION.payoutOf(named, 1.0, canon), 8);
  const plain = { family: 'KILL', target: 1, params: { filter: 'hostile' } };
  assert.strictEqual(MISSION.payoutOf(plain, 1.0, canon), 5, 'a non-named mission at the same target/family must not get the premium');
});

test('rollMission: bounty_hunt\'s minted payout already carries the named premium', () => {
  const bountyRow = canon.missions.universal.find(rw => rw.id === 'bounty_hunt');
  const r = MISSION.rng(77);
  const inst = MISSION.rollMission(bountyRow, CTX(), r, 0, canon);
  const plainEquivalent = MISSION.payoutOf(
    { family: inst.family, target: inst.target, params: { filter: 'hostile' } },
    CTX().pl.prod_mult, canon
  );
  assert.strictEqual(inst.payout, Math.round(plainEquivalent * canon.rules.missions.named_premium));
});

// ── T-MSN-1B task 5: condition-weighted picks extended to besieged/infested + allegiance
// gating (player-agnostic generation, gated at render+accept) + face priority for new rows ──

test('canon: prefer_condition values are real galaxy.conditions ids, not placeholders', () => {
  const realIds = canon.galaxy.conditions.map(c => c.id);
  ['rebuild', 'liberation', 'defend'].forEach(id => {
    const row = canon.missions.universal.find(rw => rw.id === id);
    assert.ok(realIds.includes(row.prefer_condition),
      row.id + '.prefer_condition (' + row.prefer_condition + ') must be a real condition id');
  });
  const row = canon.missions.universal.find(rw => rw.id === 'rebuild');
  assert.strictEqual(row.prefer_condition, 'ruined');
  assert.strictEqual(canon.missions.universal.find(rw => rw.id === 'liberation').prefer_condition, 'infested');
  assert.strictEqual(canon.missions.universal.find(rw => rw.id === 'defend').prefer_condition, 'besieged');
});

test('condition preference: a besieged, garrisoned location prefers defend', () => {
  // mirrors the existing "Ruined location draws rebuild" mechanism/test shape exactly,
  // just against the besieged/defend pairing added this task
  const r = MISSION.rng(5);
  let sawDefendOnSiege = false;
  for (let day = 0; day < 10 && !sawDefendOnSiege; day++) {
    const board = MISSION.refillBoard([], CTX_BESIEGED(), canon, r, day);
    sawDefendOnSiege = board.some(m => m.mid === 'defend' && m.lid === 'l2');
  }
  assert.ok(sawDefendOnSiege, 'defend must land on the besieged location within 10 rolls');
});

test('gateReason: allegiance-gated rows (consecration/desecration) refuse the wrong allegiance, admit the right one', () => {
  const consecration = canon.missions.universal.find(rw => rw.id === 'consecration');
  const desecration = canon.missions.universal.find(rw => rw.id === 'desecration');
  assert.strictEqual(MISSION.gateReason(consecration, 'chaos'), 'The rite is not yours to perform.');
  assert.strictEqual(MISSION.gateReason(consecration, 'imperial'), null);
  assert.strictEqual(MISSION.gateReason(desecration, 'imperial'), 'The rite is not yours to perform.');
  assert.strictEqual(MISSION.gateReason(desecration, 'chaos'), null);
  // xenos gets neither RITUAL rite
  assert.ok(MISSION.gateReason(consecration, 'xenos'));
  assert.ok(MISSION.gateReason(desecration, 'xenos'));
});

test('gateReason: ungated rows (e.g. purge) never refuse, for any allegiance', () => {
  const purgeRow = canon.missions.universal.find(rw => rw.id === 'purge');
  ['imperial', 'chaos', 'xenos'].forEach(al => assert.strictEqual(MISSION.gateReason(purgeRow, al), null));
});

test('rollMission carries the row\'s gates forward onto the minted instance (so accept can gate on inst alone)', () => {
  const consecration = canon.missions.universal.find(rw => rw.id === 'consecration');
  const r = MISSION.rng(1);
  const inst = MISSION.rollMission(consecration, CTX(), r, 0, canon);
  assert.deepStrictEqual(inst.gates, { allegiance: 'imperial' });
  assert.strictEqual(MISSION.gateReason(inst, 'chaos'), 'The rite is not yours to perform.');
});

test('faceOf via rollMission: consecration resolves to the altar door when one is present', () => {
  const consecration = canon.missions.universal.find(rw => rw.id === 'consecration');
  const ctxWithAltar = {
    pl: { id: 'testp', type: 'Shrine World', prod_mult: 1 },
    locs: [{ id: 'l1', name: 'The Reliquary', cond: null, doors: ['altar'], npc: null, garrison: false }]
  };
  const r = MISSION.rng(2);
  const inst = MISSION.rollMission(consecration, ctxWithAltar, r, 0, canon);
  assert.deepStrictEqual(inst.face, { kind: 'door', label: 'altar at The Reliquary' });
});

test('faceOf via rollMission: bounty_hunt wants its OWN declared door (relay), not the KILL family default (muster)', () => {
  const bountyRow = canon.missions.universal.find(rw => rw.id === 'bounty_hunt');
  // location has muster (the KILL family default) open but NOT relay (bounty_hunt's declared door)
  const ctxMusterOnly = {
    pl: { id: 'testp', type: 'Hive World', prod_mult: 1 },
    locs: [{ id: 'l1', name: 'Sump District', cond: null, doors: ['muster'], npc: null, garrison: true }]
  };
  const r = MISSION.rng(6);
  const inst = MISSION.rollMission(bountyRow, ctxMusterOnly, r, 0, canon);
  assert.notStrictEqual(inst.face.kind, 'door', 'must not fall back to the family door bounty_hunt did not declare');
  assert.strictEqual(inst.face.kind, 'notice');
  assert.strictEqual(inst.face.label, 'WANTED — by name');
});

test('faceOf via rollMission: assassination (faces:{npc:true}, no door) goes NPC-first even when the KILL family door (muster) is open', () => {
  const assRow = canon.missions.universal.find(rw => rw.id === 'assassination');
  const ctxNpcAndMuster = {
    pl: { id: 'testp', type: 'Hive World', prod_mult: 1 },
    locs: [{ id: 'l1', name: 'Backroom', cond: null, doors: ['muster'], npc: 'The Broker', garrison: true }]
  };
  const r = MISSION.rng(9);
  const inst = MISSION.rollMission(assRow, ctxNpcAndMuster, r, 0, canon);
  assert.deepStrictEqual(inst.face, { kind: 'npc', label: 'The Broker' });
});

// ── T-MSN-1B final fix wave · CRITICAL 1: Kill-Team (class filter) was unwinnable —
// genHostiles' generic branch only ever spawned Core, but trackKill's 'class' filter only
// counts victim.gen.cls === params.cls (Assault). Fixed: genHostiles guarantees >= target
// matching-class spawns; targetFor clamps against the matching-class count, not total. ──

test('canon: kill_team is a class-filter row targeting Assault', () => {
  const kt = canon.missions.universal.find(rw => rw.id === 'kill_team');
  assert.deepStrictEqual(kt.params, { filter: 'class', cls: 'Assault' });
  assert.strictEqual(kt.needs_hostiles, true);
});

test('genHostiles: class-filter branch spawns at least `target` matching-class models', () => {
  const specs = MISSION.genHostiles({ filter: 'class', cls: 'Assault' }, 2, FAC_MODELS, WEP, canon, 4);
  const assaults = specs.filter(s => s.cls === 'Assault');
  assert.ok(assaults.length >= 4, 'expected >=4 Assault spawns, got ' + assaults.length);
  specs.forEach(s => assert.notStrictEqual(s.named, true, 'class-filter spawns are not named bosses'));
});

test('genHostiles: class-filter pads out to the usual generic headcount with Core when target is small', () => {
  const specs = MISSION.genHostiles({ filter: 'class', cls: 'Assault' }, 4, FAC_MODELS, WEP, canon, 1);
  // generic n = max(2,min(4,mineCount=4)) = 4; wantClassed = max(1,1) = 1; total = max(4,1) = 4
  assert.strictEqual(specs.length, 4);
  assert.strictEqual(specs.filter(s => s.cls === 'Assault').length, 1);
  assert.strictEqual(specs.filter(s => s.cls === 'Core').length, 3);
});

test('genHostiles: class-filter falls back to a reskinned highest-pc model when the roster genuinely lacks the class', () => {
  const noAssault = [
    { n: 'Grunt', cls: 'Core', pc: 10, w: 2, sp: 4, sl: 1 },
    { n: 'Warlord', cls: 'Armament', pc: 60, w: 6, sp: 3, sl: 3 }
  ];
  const specs = MISSION.genHostiles({ filter: 'class', cls: 'Assault' }, 2, noAssault, WEP, canon, 2);
  const assaults = specs.filter(s => s.cls === 'Assault');
  assert.strictEqual(assaults.length, 2, 'fallback must still tag the reskinned spawns with the wanted class');
  assaults.forEach(a => assert.strictEqual(a.pc, 60, 'fallback reskins the highest-pc model (Warlord)'));
});

test('targetFor: class-filter clamps against the MATCHING-CLASS spawn count, not total hostiles', () => {
  const inst = { kind: 'count_kill', target: 6, params: { filter: 'class', cls: 'Assault' }, family: 'KILL' };
  assert.strictEqual(MISSION.targetFor(inst, 10, 3), 3, 'clamped to the classed count even though total hostiles is higher');
  assert.strictEqual(MISSION.targetFor(inst, 10, 99), 6, 'never clamps UP past the roll');
  assert.strictEqual(MISSION.targetFor(inst, 10), 6, 'no classCount supplied -> falls back to hostileCount, still clamped to the roll');
});

test('CRITICAL 1: Kill-Team full lifecycle — genHostiles spawns winnable Assault targets, killing them wins the mission', () => {
  const kt = canon.missions.universal.find(rw => rw.id === 'kill_team');
  const target = 5;
  const specs = MISSION.genHostiles(kt.params, 3, FAC_MODELS, WEP, canon, target);
  const assaults = specs.filter(s => s.cls === 'Assault');
  assert.ok(assaults.length >= target, 'expected at least ' + target + ' Assault spawns, got ' + assaults.length);
  const ct = MISSION.targetFor({ kind: 'count_kill', target, params: kt.params }, specs.length, assaults.length);
  assert.strictEqual(ct, target, 'the live objective target must equal the guaranteed classed spawn count');
  const combatants = { m1: { w: [4, 4], conds: [], party: 'Mine', armour: null } };
  specs.forEach(s => { combatants[s.id] = { w: [s.w, s.w], conds: [], party: 'Foe', armour: null, gen: s }; });
  const t = THREAD.create({
    id: 'ktlc', type: 'MISSION', n: 'Kill-Team lifecycle', turn: 'you', forces: ['Mine'],
    seedState: {
      objective: { kind: 'count_kill', target: ct, progress: 0, params: kt.params, done: false },
      pools: { Mine: 99, Foe: 99 }, combatants, joined: true
    }
  }, canon);
  assaults.forEach(a => {
    THREAD.apply(t, t.state, [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: a.id } }], canon);
  });
  assert.strictEqual(t.state.objective.progress, target);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

// ── T-MSN-1B final fix wave · CRITICAL 3: Trade Haul's params.granted:true grant mechanic ──

test('canon: trade_haul is a granted collect_item row with a named consignment item', () => {
  const th = canon.missions.universal.find(rw => rw.id === 'trade_haul');
  assert.strictEqual(th.kind, 'collect_item');
  assert.strictEqual(th.params.granted, true);
  assert.strictEqual(th.params.item_n, 'Consignment Crate');
});

test('grantItems: returns `target` plain-ITEM crates for a granted row, shaped for the deliver seam', () => {
  const inst = { target: 4, params: { granted: true, item_n: 'Consignment Crate' } };
  const items = MISSION.grantItems(inst);
  assert.strictEqual(items.length, 4);
  items.forEach(it => {
    assert.strictEqual(it.cat, 'ITEM');
    assert.strictEqual(it.n, 'Consignment Crate');
    assert.strictEqual(it.pc, 1, 'worthless to sell above delivery value - not the player\'s own goods');
  });
});

test('grantItems: a non-granted row (e.g. item_request) grants nothing', () => {
  const inst = { target: 3, params: {} };
  assert.deepStrictEqual(MISSION.grantItems(inst), []);
});

test('grantItems: defaults the item name to "Consignment Crate" if a granted row somehow carries no item_n', () => {
  const inst = { target: 2, params: { granted: true } };
  const items = MISSION.grantItems(inst);
  assert.strictEqual(items.length, 2);
  items.forEach(it => assert.strictEqual(it.n, 'Consignment Crate'));
});

test('CRITICAL 3: granted crates match the deliver seam\'s named-item filter exactly, and deliver completes the mission', () => {
  const inst = { target: 3, params: { granted: true, item_n: 'Consignment Crate' } };
  const granted = MISSION.grantItems(inst);
  // mirror the engine's _plainDeliverable predicate (index.html): item_n set -> match by exact name
  const ob = { params: inst.params };
  const plainDeliverable = it => (ob.params.item_n ? it.n === ob.params.item_n : it.cat === 'ITEM');
  assert.strictEqual(granted.filter(plainDeliverable).length, 3, 'every granted crate must match the deliver seam\'s own filter');
  const t = THREAD.create({
    id: 'thlc', type: 'MISSION', n: 'Trade Haul lifecycle', turn: 'you',
    seedState: { objective: { kind: 'collect_item', target: inst.target, progress: 0, params: inst.params, done: false } }
  }, canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'deliver', qty: granted.length } }], canon);
  assert.strictEqual(t.state.objective.progress, 3);
  assert.deepStrictEqual(THREAD.outcome(t, t.state), { kind: 'mission_won', victor: null, defeated: [] });
});

// ── Slice-B rulings addendum (Daak sit 2026-08-03) · Trade Haul destination gate ──

const TRADE_ROW = canon.missions.universal.find(rw => rw.id === 'trade_haul');
const CTX_TWO_SHOPS = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null, doors: ['shop', 'muster'], npc: null, garrison: true },
    { id: 'l2', name: 'Trade Row',   cond: null, doors: ['shop'],           npc: null, garrison: false },
    { id: 'l3', name: 'Barracks',    cond: null, doors: ['muster'],         npc: null, garrison: true }
  ]
});
// exactly one shop-door location on the planet: a valid mint still exists (origin = the
// non-shop location, dest = the lone shop) but the shop location itself can never be origin.
const CTX_ONE_SHOP = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null, doors: ['shop'], npc: null, garrison: false },
    { id: 'l2', name: 'Barracks',    cond: null, doors: [],       npc: null, garrison: false }
  ]
});
const CTX_NO_SHOP = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'Barracks',    cond: null, doors: [],        npc: null, garrison: false },
    { id: 'l2', name: 'Muster Yard', cond: null, doors: ['muster'], npc: null, garrison: false }
  ]
});
// origin-only planet: a single location, even though it carries a shop door itself.
const CTX_SOLO_SHOP = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null, doors: ['shop'], npc: null, garrison: false }
  ]
});

test('canon: trade_haul declares needs_destination (mirrors needs_hostiles)', () => {
  assert.strictEqual(TRADE_ROW.needs_destination, true);
});

test('rollMission: trade_haul mints a destination distinct from the origin, on a location with a shop door', () => {
  const ctx = CTX_TWO_SHOPS();
  const inst = MISSION.rollMission(TRADE_ROW, ctx, MISSION.rng(777), 1, canon);
  assert.ok(inst.params.dest_loc, 'a destination must be minted');
  assert.notStrictEqual(inst.params.dest_loc, inst.lid, 'destination must not be the origin');
  const destLoc = ctx.locs.find(l => l.id === inst.params.dest_loc);
  assert.ok(destLoc, 'dest_loc must be a real location on this planet');
  assert.ok(destLoc.doors.indexOf('shop') >= 0, 'destination must carry a shop door');
  assert.strictEqual(inst.params.dest_name, destLoc.name);
});

test('rollMission: destination pick is deterministic for a given seed/day/ctx', () => {
  const a = MISSION.rollMission(TRADE_ROW, CTX_TWO_SHOPS(), MISSION.rng(42), 3, canon);
  const b = MISSION.rollMission(TRADE_ROW, CTX_TWO_SHOPS(), MISSION.rng(42), 3, canon);
  assert.strictEqual(a.lid, b.lid);
  assert.strictEqual(a.params.dest_loc, b.params.dest_loc);
});

test('rollMission: with only one shop on the planet, that shop is never the origin (else no valid dest)', () => {
  const ctx = CTX_ONE_SHOP();
  for (let seed = 1; seed < 60; seed++) {
    const inst = MISSION.rollMission(TRADE_ROW, ctx, MISSION.rng(seed), 1, canon);
    assert.notStrictEqual(inst.lid, 'l1', 'l1 is the only shop - picking it as origin would strand the mission');
    assert.strictEqual(inst.params.dest_loc, 'l1');
  }
});

test('refillBoard: a planet with no shop door anywhere never mints trade_haul', () => {
  const board = MISSION.refillBoard([], CTX_NO_SHOP(), canon, MISSION.rng(9), 1);
  assert.ok(!board.some(m => m.mid === 'trade_haul'), 'trade_haul must never appear with zero shop-door locations');
});

test('refillBoard: a single-location planet never mints trade_haul, even if that lone location has a shop', () => {
  const board = MISSION.refillBoard([], CTX_SOLO_SHOP(), canon, MISSION.rng(9), 1);
  assert.ok(!board.some(m => m.mid === 'trade_haul'), 'a lone shop location has no distinct destination to send crates to');
});

test('refillBoard: a two-location planet with exactly one shop CAN mint trade_haul', () => {
  let minted = false;
  for (let seed = 1; seed < 200 && !minted; seed++) {
    const board = MISSION.refillBoard([], CTX_ONE_SHOP(), canon, MISSION.rng(seed), 1);
    if (board.some(m => m.mid === 'trade_haul')) minted = true;
  }
  assert.ok(minted, 'trade_haul should mint at least once across many seeded refills when a valid dest exists');
});

// ── MISSION.deliverGate — pure destination gate the deliver-button render/click seam drives ──

test('deliverGate: ungated when params carry no dest_loc (e.g. item_request)', () => {
  assert.strictEqual(MISSION.deliverGate({}, { pl: 'x', sp: 'anywhere' }), true);
});

test('deliverGate: refuses at the origin (or anywhere but the destination)', () => {
  const params = { dest_loc: 'l2', dest_name: 'Trade Row' };
  assert.strictEqual(MISSION.deliverGate(params, { pl: 'testp', sp: 'l1' }), false);
  assert.strictEqual(MISSION.deliverGate(params, { pl: 'testp', sp: null }), false);
});

test('deliverGate: accepts exactly at the destination location', () => {
  const params = { dest_loc: 'l2', dest_name: 'Trade Row' };
  assert.strictEqual(MISSION.deliverGate(params, { pl: 'testp', sp: 'l2' }), true);
});
