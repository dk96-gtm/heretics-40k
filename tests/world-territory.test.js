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

function heldState(faction, holdings) {
  return {
    time: { lastTick: 0 }, cur: 0,
    player: { faction },
    world: { stats: {}, holdings, rulers: {} }
  };
}

// Nurth (Death Guard crown): 35 res × 0.3 Death World = 10.5 → /3 = 3.5 → round 4
// → floored up to holding_min_per_day 8 → Nihilus home ×1.25 = 10
test('holdingYield: poor crown world hits the floor, then the Rift home bonus', () => {
  const f = W.findPlanet(canon, 'nurth');
  assert.ok(f, 'nurth found');
  assert.strictEqual(f.sector, 'pallid');
  assert.strictEqual(W.holdingYield(f.p, canon, 'Nihilus'), 10);
  assert.strictEqual(W.holdingYield(f.p, canon, 'Sanctus'), 8); // wrong side: no bonus
});

// Terra: 220 × 1.8 Hive World = 396 → /3 = 132 → Sanctus home ×1.25 = 165
test('holdingYield: rich world scales with resources × prod_mult ÷ divisor', () => {
  const f = W.findPlanet(canon, 'terra');
  assert.strictEqual(W.holdingYield(f.p, canon, 'Sanctus'), 165);
  assert.strictEqual(W.holdingYield(f.p, canon, null), 132); // neutral free-mover
});

test('sideOfFaction resolves the Rift seat from a faction id', () => {
  assert.strictEqual(W.sideOfFaction('death_guard', canon), 'Nihilus');
  assert.strictEqual(W.sideOfFaction('custodes', canon), 'Sanctus');
  assert.strictEqual(W.sideOfFaction('necrons', canon), null);
});

test('produce: holdings feed currency + seed sector prosperity; events itemized', () => {
  const s = heldState('death_guard', ['nurth']);
  const r = W.catchUp(s, canon, DAY * 3);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(s.cur, 30); // 10/day × 3
  const ev = r.events.filter(e => e.kind === 'production');
  assert.strictEqual(ev.length, 3);
  assert.strictEqual(ev[0].planet, 'Nurth');
  assert.strictEqual(ev[0].sector, 'pallid');
  assert.ok(typeof s.world.stats.pallid.prosperity === 'number', 'prosperity tracked');
});

test('produce: no holdings → flat demo fallback unchanged', () => {
  const s = { time: { lastTick: 0 }, cur: 0, world: { stats: {} } };
  W.catchUp(s, canon, DAY);
  assert.strictEqual(s.cur, canon.tick.production_per_day);
});

test('drift: conflict cools, prosperity creeps up (clamped), taint climbs', () => {
  const s = heldState('death_guard', []);
  s.world.stats = { vigilus: { taint: 10, conflict: 5, prosperity: 99 } };
  W.catchUp(s, canon, DAY * 3);
  const st = s.world.stats.vigilus;
  assert.strictEqual(st.taint, 13);
  assert.strictEqual(st.conflict, 0); // −2/day, floored at 0
  assert.strictEqual(st.prosperity, 100); // +1/day, capped at 100
});

test('sectorStatus derives from canon thresholds', () => {
  assert.strictEqual(W.sectorStatus({ taint: 80 }, canon), 'Corrupted');
  assert.strictEqual(W.sectorStatus({ taint: 10, conflict: 70 }, canon), 'Warring');
  assert.strictEqual(W.sectorStatus({ prosperity: 20 }, canon), 'Famine');
  assert.strictEqual(W.sectorStatus({ prosperity: 80, conflict: 5 }, canon), 'Thriving');
  assert.strictEqual(W.sectorStatus({ prosperity: 50, conflict: 30 }, canon), 'Peace');
});

test('digest itemizes holdings tithe by planet', () => {
  const d = W.digest([
    { kind: 'production', amount: 10, planet: 'Nurth', sector: 'pallid' },
    { kind: 'production', amount: 10, planet: 'Nurth', sector: 'pallid' },
    { kind: 'production', amount: 132, planet: 'Terra', sector: 'sol' }
  ]);
  const line = d.lines.filter(l => /tithed/.test(l))[0];
  assert.ok(line, 'tithe line present');
  assert.match(line, /152/);
  assert.match(line, /Nurth 20/);
  assert.match(line, /Terra 132/);
});
