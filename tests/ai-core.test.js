const test = require('node:test');
const assert = require('node:assert');
const { loadAI } = require('./_load-ai');
const NPCAI = loadAI();

test('ai-core: loads and exposes NPCAI', () => {
  assert.ok(NPCAI && typeof NPCAI === 'object');
  assert.ok(Array.isArray(NPCAI.PHASES) && NPCAI.PHASES.length === 8);
});

test('ai-core: stampAt maps elapsed real time to day/phase (block_minutes=60)', () => {
  const B = 60, E = 0;
  assert.deepEqual(NPCAI.stampAt(E, 0, B), { day: 1, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
  // 30 min = one phase -> Morning
  assert.equal(NPCAI.stampAt(E, 30 * 60000, B).phase, 'Morning');
  // 4h = 8 phases = exactly one day -> Day 2, Early Morning
  assert.deepEqual(NPCAI.stampAt(E, 4 * 60 * 60000, B), { day: 2, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
});

test('ai-core: elapsed counts phases/blocks/days between two instants', () => {
  const B = 60;
  const r = NPCAI.elapsed(0, 4 * 60 * 60000 + 30 * 60000, B); // one day + one phase
  assert.deepEqual(r, { phases: 9, blocks: 4, days: 1 });
});

test('ai-core: instantiate uses authored value; records spawn + empty drift', () => {
  const seed = { ferocity: { value: 88, plasticity: 12, floor: 72, ceiling: 100 } };
  const b = NPCAI.instantiate(seed, () => 0);
  assert.equal(b.ferocity.value, 88);
  assert.equal(b.ferocity.spawn, 88);
  assert.deepEqual(b.ferocity.drift, []);
});

test('ai-core: instantiate rolls a distribution seed within floor/ceiling', () => {
  const seed = { cunning: { base: 30, spread: 10, plasticity: 20, floor: 10, ceiling: 70 } };
  const hi = NPCAI.instantiate(seed, () => 1).cunning.value;   // +spread
  const lo = NPCAI.instantiate(seed, () => -1).cunning.value;  // -spread
  assert.equal(hi, 40);
  assert.equal(lo, 20);
});

test('ai-core: driftClamp respects plasticity window and floor/ceiling', () => {
  const b = NPCAI.instantiate({ honor: { value: 40, plasticity: 12, floor: 10, ceiling: 100 } }, () => 0);
  assert.equal(NPCAI.driftClamp(b, 'honor', 6, 'shown mercy', 1), 6);   // 40 -> 46
  assert.equal(b.honor.value, 46);
  assert.equal(NPCAI.driftClamp(b, 'honor', 50, 'huge', 2), 6);         // capped at spawn+plasticity=52
  assert.equal(b.honor.value, 52);
  assert.equal(b.honor.drift.length, 2);
});
