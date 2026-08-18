const test = require('node:test');
const assert = require('node:assert');
const { loadChron } = require('./_load-cadence');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const CHRON = loadChron();
const ULT = loadAgency();

function st() { return { world: { chronicle: {} } }; }
const REC = { day: 214, kind: 'far', att: 'Orks', def: 'Astra Militarum', outcome: 'sacked', arith: '800 PC vs 500 PC → SACKED', seed: 12345 };

test('record appends, creates array, returns rec', () => {
  const s = st();
  const r = CHRON.record(s, 'hivep', REC, D);
  assert.strictEqual(s.world.chronicle.hivep.length, 1);
  assert.strictEqual(r, REC);
});

test('record evicts oldest past chronicle_cap', () => {
  const s = st();
  for (let i = 0; i < 35; i++) CHRON.record(s, 'x', { ...REC, day: i }, D);
  assert.strictEqual(s.world.chronicle.x.length, D.rules.cadence.chronicle_cap);
  assert.strictEqual(s.world.chronicle.x[0].day, 5); // oldest 5 evicted
});

test('titleOf maps outcomes', () => {
  assert.match(CHRON.titleOf(REC, 'Hive Primus'), /Sack of Hive Primus/);
  assert.match(CHRON.titleOf({ ...REC, outcome: 'captured' }, 'X'), /Fall of X/);
  assert.match(CHRON.titleOf({ ...REC, outcome: 'repelled' }, 'X'), /Defense of X/);
});

test('account is deterministic, ends with THE RECORD arithmetic', () => {
  const a1 = CHRON.account(REC, 'Hive Primus', ULT.rng);
  const a2 = CHRON.account(REC, 'Hive Primus', ULT.rng);
  assert.deepStrictEqual(a1, a2);
  assert.ok(a1.length >= 4 && a1.length <= 7);
  assert.strictEqual(a1[a1.length - 1].who, 'THE RECORD');
  assert.match(a1[a1.length - 1].body, /800 PC vs 500 PC/);
  assert.ok(a1.some(p => p.who === 'Orks') && a1.some(p => p.who === 'Astra Militarum'),
    'both sides must speak');
});

test('different seeds tell different stories', () => {
  const a = CHRON.account(REC, 'X', ULT.rng);
  const b = CHRON.account({ ...REC, seed: 999 }, 'X', ULT.rng);
  assert.notDeepStrictEqual(a.slice(0, -1), b.slice(0, -1));
});
