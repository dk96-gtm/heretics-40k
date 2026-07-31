const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadDoor } = require('./_load-door');
const DOOR = loadDoor();
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('gearTier bands and castRank parsing', () => {
  assert.strictEqual(DOOR.gearTier(3, D), 1);
  assert.strictEqual(DOOR.gearTier(12, D), 2);
  assert.strictEqual(DOOR.gearTier(20, D), 3);
  assert.strictEqual(DOOR.gearTier(36, D), 3);
  assert.strictEqual(DOOR.castRank('R1 - Warp 2 - Medium - 2 AP'), 1);
  assert.strictEqual(DOOR.castRank('R4 - Warp 6 - Long - 5 AP'), 4);
  assert.strictEqual(DOOR.castRank('no rank prefix'), 1);
});

test('tierCap: homes 3, shop anywhere 3, floor types 1, dormant tomb 1, default 2', () => {
  assert.strictEqual(DOOR.tierCap('Forge World', 'forge', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Forge World', 'armoury', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Forge World', 'altar', D, false), 2);
  assert.strictEqual(DOOR.tierCap('Agri World', 'shop', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Death World', 'shop', D, false), 1);
  assert.strictEqual(DOOR.tierCap('Dead World', 'forge', D, false), 1);
  assert.strictEqual(DOOR.tierCap('Tomb World', 'shop', D, true), 1);
  assert.strictEqual(DOOR.tierCap('Tomb World', 'shop', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Feudal World', 'muster', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Sept World', 'relay', D, false), 2);
});

test('seedTier: 1 default, 2 on top-2 pop rungs, 3 on home doors, cap always wins', () => {
  assert.strictEqual(DOOR.seedTier('Agri World', 0, 'forge', D, false), 1);
  assert.strictEqual(DOOR.seedTier('Agri World', 4, 'forge', D, false), 2);
  assert.strictEqual(DOOR.seedTier('Forge World', 0, 'forge', D, false), 3);
  assert.strictEqual(DOOR.seedTier('Hive World', 5, 'apothecarion', D, false), 3);
  assert.strictEqual(DOOR.seedTier('Agri World', 5, 'shop', D, false), 2);   // shop III is built, never seeded
  assert.strictEqual(DOOR.seedTier('Death World', 5, 'shop', D, false), 1);
});

test('doorTier: sparse overlay beats seed but never lowers it', () => {
  const st = { world: { doorTiers: {} } };
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 1), 1);
  st.world.doorTiers[DOOR.key('locA', 'shop')] = 2;
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 1), 2);
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 3), 3); // re-typed world raised the seed
});

test('upgradeCost: D11 currency x tier + E2 resources + days; throne_room by kind', () => {
  assert.deepStrictEqual(DOOR.upgradeCost('shop', 'common', 2, D), { currency: 200, resources: { Material: 120, Fuel: 30 }, days: 3 });
  assert.deepStrictEqual(DOOR.upgradeCost('reliquary', 'rarest', 3, D), { currency: 1200, resources: { Material: 300, Fuel: 100 }, days: 7 });
  assert.strictEqual(DOOR.upgradeCost('throne_room', 'one per ruled world', 2, D).currency, 400);
});

test('canUpgrade gate ladder', () => {
  const cost = { currency: 200, resources: { Material: 120, Fuel: 30 }, days: 3 };
  const base = { tier: 1, cap: 3, building: false, rules: true, funds: { currency: 500, Material: 200, Fuel: 50 }, cost: cost };
  assert.strictEqual(DOOR.canUpgrade(base).ok, true);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { tier: 3 })).why, /Tier III/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { tier: 2, cap: 2 })).why, /cannot support/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { building: true })).why, /underway/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { rules: false })).why, /ruler/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { funds: { currency: 10, Material: 200, Fuel: 50 } })).why, /currency/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { funds: { currency: 500, Material: 10, Fuel: 50 } })).why, /Material/);
});

test('startBuild + tickBuilds: counts days, applies tier, idempotent finish, JSON round-trip', () => {
  const st = { world: {} };
  DOOR.startBuild(st, 'locA', 'shop', 2, 3);
  assert.strictEqual(DOOR.tickBuilds(st).length, 0);
  assert.strictEqual(DOOR.tickBuilds(st).length, 0);
  const st2 = JSON.parse(JSON.stringify(st));         // persist mid-build
  const done = DOOR.tickBuilds(st2);
  assert.deepStrictEqual(done, [{ loc: 'locA', kind: 'shop', to: 2 }]);
  assert.strictEqual(st2.world.doorTiers[DOOR.key('locA', 'shop')], 2);
  assert.deepStrictEqual(st2.world.doorBuilds, {});
  assert.strictEqual(DOOR.tickBuilds(st2).length, 0);
});
