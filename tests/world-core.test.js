const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadWorld } = require('./_load-world');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const W = loadWorld();
const DAY = canon.tick.day_minutes * 60000;

function freshState(lastTick) {
  return { time: { lastTick }, cur: 100, world: { stats: { vigilus: { taint: 10 } } } };
}

test('ticksElapsed = floor(elapsed / day), never negative', () => {
  const s = freshState(0);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY * 3), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY * 3 + 5), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, -100), 0); // clock skew → 0
});

test('catchUp runs ticks, accrues production, drifts taint, advances lastTick fully', () => {
  const s = freshState(0);
  const r = W.catchUp(s, canon, DAY * 3);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(s.cur, 100 + 3 * canon.tick.production_per_day);
  assert.strictEqual(s.world.stats.vigilus.taint, 10 + 3 * canon.tick.taint_per_day);
  assert.strictEqual(s.time.lastTick, DAY * 3);
  assert.ok(r.events.length >= 1);
});

test('catchUp is idempotent within the same day', () => {
  const s = freshState(0);
  W.catchUp(s, canon, DAY * 2);
  const curAfter = s.cur;
  const r2 = W.catchUp(s, canon, DAY * 2 + 10); // same day, <1 tick more
  assert.strictEqual(r2.ticks, 0);
  assert.strictEqual(s.cur, curAfter);
});

test('long absence is capped and compressed, lastTick still advances fully', () => {
  const s = freshState(0);
  const away = canon.tick.max_catchup_days + 10;
  const r = W.catchUp(s, canon, DAY * away);
  assert.strictEqual(r.ticks, canon.tick.max_catchup_days);
  assert.strictEqual(r.compressed, 10);
  assert.strictEqual(s.time.lastTick, DAY * away); // no permanent drift
});

test('digest returns relevance-ordered lines from events', () => {
  const d = W.digest([
    { kind: 'taint', sector: 'vigilus', delta: 3 },
    { kind: 'production', amount: 75 },
  ]);
  assert.ok(Array.isArray(d.lines) && d.lines.length >= 1);
});

test('digest aggregates taint per sector into one line, not per tick', () => {
  const d = W.digest([
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'nurth', delta: 1 },
  ]);
  const vig = d.lines.filter((l) => /vigilus/.test(l));
  assert.strictEqual(vig.length, 1, 'one vigilus line');
  assert.match(vig[0], /rose 3 in vigilus/);
  assert.strictEqual(d.lines.filter((l) => /nurth/.test(l)).length, 1);
});
