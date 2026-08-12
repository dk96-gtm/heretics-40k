const test = require('node:test');
const assert = require('node:assert');
const { loadSeat } = require('./_load-seat');
const D = require('../heretics-40k-data-v1.json');

const SEAT = loadSeat();

test('seedStanding: own faction ALLIED, others from the matrix row', () => {
  const led = SEAT.seedStanding('death_guard', D);
  assert.strictEqual(led.death_guard, 2);                       // own_seed
  assert.strictEqual(led.black_legion, 1);                      // matrix row
  assert.strictEqual(led.astartes, -3);
  assert.strictEqual(Object.keys(led).length, 20);
});

test('moveStanding clamps at [-3, +2]; kinRaid floors to WAR', () => {
  const led = SEAT.seedStanding('death_guard', D);
  assert.strictEqual(SEAT.moveStanding(led, 'black_legion', 5), 2);
  assert.strictEqual(SEAT.moveStanding(led, 'astartes', -5), -3);
  assert.strictEqual(SEAT.kinRaid(led, 'death_guard', D), -3);
  assert.strictEqual(led.death_guard, -3);
});

test('standingName maps values to ladder names', () => {
  assert.strictEqual(SEAT.standingName(-3, D), 'WAR');
  assert.strictEqual(SEAT.standingName(2, D), 'ALLIED');
});

test('priceOf = base × level × condition_mult; taxOf = 3 × level × cond', () => {
  const hive = { type: 'hive', level: 3 };
  assert.strictEqual(SEAT.priceOf(hive, 'intact', D), 180);      // 60×3×1
  assert.strictEqual(SEAT.priceOf(hive, 'fortified', D), 225);   // 60×3×1.25
  assert.strictEqual(SEAT.priceOf(hive, 'sacked', D), 108);      // 60×3×0.6
  assert.strictEqual(SEAT.priceOf({ type: 'crown', level: 3 }, 'intact', D), null);
  assert.strictEqual(SEAT.taxOf(hive, 'intact', D), 9);
  assert.strictEqual(SEAT.taxOf(hive, 'fortified', D), 11);      // round(9×1.25)
});

test('seatable honors not_seatable', () => {
  assert.ok(SEAT.seatable('ruins', D));
  assert.ok(!SEAT.seatable('warzone', D));
  assert.ok(!SEAT.seatable('orbit', D));
});

test('gateReason: fail-closed ladder of refusals, null when grantable', () => {
  const loc = { type: 'village', level: 1 };
  const base = { loc, cond: 'intact', ruledByOwn: true, held: false, work: 5, standing: 2, cur: 100 };
  assert.strictEqual(SEAT.gateReason(base, D), null);
  assert.match(SEAT.gateReason(Object.assign({}, base, { ruledByOwn: false }), D), /own kin/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { held: true }), D), /already held/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { work: 1 }), D), /WORK 1\/2/);
  assert.match(SEAT.gateReason(Object.assign({}, base, { standing: -1 }), D), /standing/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { cur: 3 }), D), /currency/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { loc: { type: 'warzone', level: 1 } }), D), /cannot be held/i);
});

test('workEarn: mission 1 · rebuild mission 2 · manual (payout 0) 1', () => {
  assert.strictEqual(SEAT.workEarn({ payout: 4, world_effect: {} }, D), 1);
  assert.strictEqual(SEAT.workEarn({ payout: 4, world_effect: { repair_step: 1 } }, D), 2);
  assert.strictEqual(SEAT.workEarn({ payout: 0, world_effect: { repair_step: 1 } }, D), 1);
  assert.strictEqual(SEAT.workEarn({ payout: 0, world_effect: { clear_condition: true } }, D), 1);
});

test('upkeepOf = ceil(force PC / 250), minimum 1', () => {
  assert.strictEqual(SEAT.upkeepOf(500, D), 2);
  assert.strictEqual(SEAT.upkeepOf(251, D), 2);
  assert.strictEqual(SEAT.upkeepOf(100, D), 1);
  assert.strictEqual(SEAT.upkeepOf(0, D), 1);
});

// deterministic rng stand-in for pure-math tests: cycles a fixed tape
function tape(vals){ let i = 0; return () => vals[i++ % vals.length]; }

test('poolOf: outcome fraction of total wounds, rounded', () => {
  assert.strictEqual(SEAT.poolOf('repelled', 40, D), 6);          // 15%
  assert.strictEqual(SEAT.poolOf('repelled_losses', 40, D), 14);  // 35%
  assert.strictEqual(SEAT.poolOf('sacked', 40, D), 24);           // 60%
  assert.strictEqual(SEAT.poolOf('captured', 40, D), 40);         // 100%
  assert.strictEqual(SEAT.poolOf('nonsense', 40, D), 0);          // unknown = 0, fail-closed
});

test('distribute: pool-exact, round-robin spread, chaff downs first, deterministic', () => {
  const members = [{ id: 'a', w: 5 }, { id: 'b', w: 2 }, { id: 'c', w: 1 }];
  const out = SEAT.distribute(members, 4, tape([0.1, 0.5, 0.9]));
  const dealt = out.reduce((s, m) => s + m.hit, 0);
  assert.strictEqual(dealt, 4);                                   // pool-exact
  const c = out.find(m => m.id === 'c');
  assert.ok(c.hit >= 1 && c.down, '1-wound model downs on the first pass that reaches it');
  // deterministic: same tape → same result
  const out2 = SEAT.distribute(members, 4, tape([0.1, 0.5, 0.9]));
  assert.deepStrictEqual(out, out2);
});

test('distribute: pool larger than total wounds downs everyone, never negative', () => {
  const out = SEAT.distribute([{ id: 'a', w: 2 }, { id: 'b', w: 1 }], 99, tape([0.4]));
  assert.ok(out.every(m => m.w === 0 && m.down));
  assert.strictEqual(out.reduce((s, m) => s + m.hit, 0), 3);      // stops at total wounds
});

test('carryOff: attacker takes floor(half), seeded, partition is exact', () => {
  const downed = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const { taken, left } = SEAT.carryOff(downed, tape([0.3, 0.7, 0.1]), D);
  assert.strictEqual(taken.length, 2);                            // floor(5×0.5)
  assert.strictEqual(taken.length + left.length, 5);
  const ids = taken.concat(left).map(m => m.id).sort();
  assert.deepStrictEqual(ids, ['a', 'b', 'c', 'd', 'e']);
});

test('captiveSplit partitions the downed into captive/slain', () => {
  const downed = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const { captive, slain } = SEAT.captiveSplit(downed, tape([0.2, 0.8, 0.4, 0.6]));
  assert.strictEqual(captive.length + slain.length, 4);
  assert.ok(captive.length >= 1 && slain.length >= 1);            // tape guarantees a mix
});

test('buyoutPrice = sum of unheld prices × premium', () => {
  assert.strictEqual(SEAT.buyoutPrice([30, 60, 12], D), 204);     // 102×2
  assert.strictEqual(SEAT.buyoutPrice([], D), 0);
});
