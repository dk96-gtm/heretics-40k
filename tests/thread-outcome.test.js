const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');

const THREAD = loadThread();

function combatState(overrides) {
  const s = {
    pools: { A: 10, B: 10 },
    combatants: {
      a1: { party: 'A', w: [3, 3], dead: false },
      a2: { party: 'A', w: [2, 2], dead: false },
      b1: { party: 'B', w: [4, 4], dead: false }
    },
    joined: true, phase: 'battle', fog: {}
  };
  return Object.assign(s, overrides || {});
}

test('outcome: ongoing battle (both sides alive) → null', () => {
  const t = { type: 'SKIRMISH' };
  assert.strictEqual(THREAD.outcome(t, combatState()), null);
});

test('outcome: one side wiped → annihilation, victor + defeated named', () => {
  const t = { type: 'SKIRMISH' };
  const s = combatState();
  s.combatants.b1.dead = true;
  const o = THREAD.outcome(t, s);
  assert.strictEqual(o.kind, 'annihilation');
  assert.strictEqual(o.victor, 'A');
  assert.deepStrictEqual(o.defeated, ['B']);
});

test('outcome: mutual annihilation → kind mutual, no victor, all defeated', () => {
  const t = { type: 'INVASION' };
  const s = combatState();
  Object.keys(s.combatants).forEach(id => { s.combatants[id].dead = true; });
  const o = THREAD.outcome(t, s);
  assert.strictEqual(o.kind, 'mutual');
  assert.strictEqual(o.victor, null);
  assert.deepStrictEqual(o.defeated.sort(), ['A', 'B']);
});

test('outcome: deploy phase never concludes, even with a side down', () => {
  const t = { type: 'SKIRMISH' };
  const s = combatState({ phase: 'deploy' });
  s.combatants.b1.dead = true;
  assert.strictEqual(THREAD.outcome(t, s), null);
});

test('outcome: single-party state (no opponent seeded) → null', () => {
  const t = { type: 'SKIRMISH' };
  const s = combatState();
  delete s.combatants.b1;
  assert.strictEqual(THREAD.outcome(t, s), null);
});

test('outcome: already-concluded thread → null (idempotent gate)', () => {
  const t = { type: 'SKIRMISH', done: { kind: 'annihilation', victor: 'A' } };
  const s = combatState();
  s.combatants.b1.dead = true;
  assert.strictEqual(THREAD.outcome(t, s), null);
});

test('outcome: diplomacy concludes on agreed terms → accord', () => {
  const t = { type: 'DIPLOMACY' };
  assert.strictEqual(THREAD.outcome(t, { terms: null }), null);
  assert.strictEqual(THREAD.outcome(t, { terms: { agreed: false } }), null);
  const o = THREAD.outcome(t, { terms: { agreed: true, detail: 'trade pact' } });
  assert.strictEqual(o.kind, 'accord');
  assert.strictEqual(o.victor, null);
});

test('outcome: non-resolving types (TRAVEL/MISSION/generic) → null', () => {
  assert.strictEqual(THREAD.outcome({ type: 'TRAVEL' }, { transit: { wordsWritten: 999, wordsReq: 10 } }), null);
  assert.strictEqual(THREAD.outcome({ type: 'MISSION' }, combatState()), null);
});

test('outcome ignores dead-flag on models with no party (spectators)', () => {
  const t = { type: 'SKIRMISH' };
  const s = combatState();
  s.combatants.x = { w: [1, 1], dead: true }; // no party — must not create a phantom side
  s.combatants.b1.dead = true;
  const o = THREAD.outcome(t, s);
  assert.strictEqual(o.victor, 'A');
});
