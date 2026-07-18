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
