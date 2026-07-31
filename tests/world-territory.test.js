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

test('sideOfFaction resolves the Rift seat from a faction id', () => {
  assert.strictEqual(W.sideOfFaction('death_guard', canon), 'Nihilus');
  assert.strictEqual(W.sideOfFaction('custodes', canon), 'Sanctus');
  assert.strictEqual(W.sideOfFaction('necrons', canon), null);
});

test('produce: holdings accrue typed stock + drain currency via upkeep; events itemized', () => {
  const s = { time: { lastTick: 0 }, cur: 500, player: { faction: 'death_guard' },
              world: { stats: {}, holdings: ['nurth'], stock: {}, unrest: {}, rulers: {} } };
  const ev = [];
  W.produce(s, canon, ev);
  const f = W.findPlanet(canon, 'nurth');
  const side = W.sideOfFaction('death_guard', canon);
  const y = W.typedYield(f.p, canon, side);
  const keep = W.upkeepOf(f.p, canon);
  const st = s.world.stock.nurth;
  assert.strictEqual(st.Fuel, y.Fuel); // Death World yields Fuel; nothing eats it, so it's the raw typed gain
  assert.strictEqual(s.cur, 500 - keep); // dropped by upkeepOf(...) — was: grew
  const resEv = ev.filter(e => e.kind === 'resources');
  assert.strictEqual(resEv.length, 1);
  assert.strictEqual(resEv[0].planet, 'Nurth');
  assert.strictEqual(f.sector, 'pallid');
  assert.ok(typeof s.world.stats.pallid.prosperity === 'number', 'prosperity tracked');
});

test('produce via catchUp: multi-tick accrues typed yield per day, lastTick fully advances', () => {
  const s = { time: { lastTick: 0 }, cur: 1000, player: { faction: 'death_guard' },
              world: { stats: {}, holdings: ['nurth'], stock: {}, unrest: {}, rulers: {} } };
  const r = W.catchUp(s, canon, DAY * 3);
  assert.strictEqual(r.ticks, 3);
  const f = W.findPlanet(canon, 'nurth');
  const side = W.sideOfFaction('death_guard', canon);
  const y = W.typedYield(f.p, canon, side); // Fuel:1×1.25→1/day, never eaten, well under cap
  assert.strictEqual(s.world.stock.nurth.Fuel, y.Fuel * 3, '3 days of Fuel accrue linearly');
  assert.strictEqual(s.time.lastTick, DAY * 3);
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
