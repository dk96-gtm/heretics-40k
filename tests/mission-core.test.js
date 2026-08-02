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
    { id: 'l2', name: 'Shattered Row', cond: 'Ruined', doors: [],               npc: 'Magos Vex', garrison: false }
  ]
});
const CTX_NO_GARRISON = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null,     doors: ['shop', 'muster'], npc: null, garrison: false },
    { id: 'l2', name: 'Shattered Row', cond: 'Ruined', doors: [],               npc: 'Magos Vex', garrison: false }
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

test('aloneGateReason: assassination refuses a 2-model force, accepts exactly 1', () => {
  const assRow = canon.missions.universal.find(rw => rw.id === 'assassination');
  assert.strictEqual(assRow.params.alone, true);
  assert.strictEqual(typeof MISSION.aloneGateReason(assRow.params, 2), 'string', 'refused for 2 models');
  assert.strictEqual(MISSION.aloneGateReason(assRow.params, 1), null, 'accepted for exactly 1');
});

test('aloneGateReason: missions without an alone param never gate on force size', () => {
  const purgeRow = canon.missions.universal.find(rw => rw.id === 'purge');
  assert.strictEqual(MISSION.aloneGateReason(purgeRow.params, 5), null);
  assert.strictEqual(MISSION.aloneGateReason(undefined, 5), null);
});
