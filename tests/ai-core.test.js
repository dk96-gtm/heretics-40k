const test = require('node:test');
const assert = require('node:assert');
const { loadAI } = require('./_load-ai');
const NPCAI = loadAI();

test('ai-core: loads and exposes NPCAI', () => {
  assert.ok(NPCAI && typeof NPCAI === 'object');
  assert.ok(Array.isArray(NPCAI.PHASES) && NPCAI.PHASES.length === 8);
});
