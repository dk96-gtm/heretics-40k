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
