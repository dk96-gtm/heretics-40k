const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadWorld } = require('./_load-world');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const W = loadWorld();

function planetOf(pid) { let r = null;
  canon.galaxy.segmentums.forEach((g) => g.zones.forEach((z) => z.sectors.forEach((s) => (s.planets || []).forEach((p) => { if (p.id === pid) r = p; }))));
  return r; }
const terra = planetOf('terra');            // Hive World, has orbit + surface locations

test('resOut reads the authored table; unknown type is all-zero', () => {
  assert.deepStrictEqual(W.resOut('Agri World', canon), { Food: 14, Material: 0, Fuel: 0 });
  assert.deepStrictEqual(W.resOut('Nope World', canon), { Food: 0, Material: 0, Fuel: 0 });
});

test('typedYield applies the Rift home bonus per resource', () => {
  const base = W.typedYield(terra, canon, null);
  assert.deepStrictEqual(base, { Food: 0, Material: 14, Fuel: 4 });
  const mult = canon.rules.rift.home.prod_mult;
  const homed = W.typedYield(terra, canon, terra.rift);
  assert.strictEqual(homed.Material, Math.round(14 * mult));
});

test('locShares: surface-only, level-weighted, integer shares summing to the planet total', () => {
  const shares = W.locShares(terra, canon);
  assert.ok(shares.every((s) => s.level >= 1));
  assert.ok(!shares.some((s) => s.id === 'terraorbit'), 'orbit locations never produce');
  const sum = shares.reduce((a, s) => a + s.share.Material, 0);
  assert.strictEqual(sum, 14, 'shares sum exactly to the type output (remainder placed)');
});

test('planetCap / foodDemand / upkeepOf derive from surface levels and pop_base', () => {
  const levels = terra.locations.filter((l) => l.tier !== 'orbit').map((l) => l.level || 1);
  assert.strictEqual(W.planetCap(terra, canon), 40 * levels.reduce((a, b) => a + b, 0));
  assert.ok(W.foodDemand(terra, canon) > 0, 'a Hive World is hungry');
  assert.strictEqual(W.upkeepOf(terra, canon), 2 * levels.reduce((a, b) => a + b, 0));
});

test('produce: typed gain into stock, Food eaten, upkeep drains currency, overflow lost, shortfall = unrest', () => {
  const s = { time: { lastTick: 0 }, cur: 500, player: { faction: 'custodes' },
              world: { holdings: ['terra'], stock: {}, unrest: {}, stats: {} } };
  const ev = [];
  W.produce(s, canon, ev);
  const st = s.world.stock.terra;
  assert.ok(st.Material > 0, 'material accrued');
  assert.ok(s.cur < 500, 'upkeep charged');
  assert.ok(ev.some((e) => e.kind === 'resources'), 'itemized event');
  // Hive World produces no Food → demand unmet → unrest ticks
  assert.ok((s.world.unrest.terra || 0) >= 1, 'starving world accrues unrest');
  // overflow: pre-fill past cap, next tick clamps and reports loss
  st.Material = W.planetCap(terra, canon);
  const ev2 = [];
  W.produce(s, canon, ev2);
  assert.strictEqual(st.Material, W.planetCap(terra, canon), 'clamped at cap');
  assert.ok(ev2.some((e) => e.kind === 'overflow'), 'loss reported');
});

test('produce: no holdings → flat currency demo fallback unchanged', () => {
  const s = { time: { lastTick: 0 }, cur: 0, world: { stats: {} } };
  W.produce(s, canon, []);
  assert.strictEqual(s.cur, canon.tick.production_per_day);
});
