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

test('castRank parses R5 and all canon casts correctly', () => {
  assert.strictEqual(DOOR.castRank('R5 - Warp 5 - Long - 5 AP'), 5);
  // Data-driven: every cast in canon parses correctly
  let hasR5 = false;
  (D.casts || []).forEach(c => {
    const m = /^R(\d+)/.exec(c.d || '');
    const expected = m ? +m[1] : 1;
    assert.strictEqual(DOOR.castRank(c.d), expected, `cast "${c.d}" should yield rank ${expected}`);
    if (expected === 5) hasR5 = true;
  });
  assert.strictEqual(hasR5, true, 'canon must have at least one R5 cast');
});

test('canUpgrade with undefined funds returns refusal (no throw)', () => {
  const cost = { currency: 200, resources: { Material: 120, Fuel: 30 }, days: 3 };
  const base = { tier: 1, cap: 3, building: false, rules: true, cost: cost };
  const result = DOOR.canUpgrade(base); // funds undefined
  assert.strictEqual(result.ok, false);
  assert.match(result.why, /currency/);
});

test('startBuild returns boolean: false on no world, false on duplicate, true on success', () => {
  const noWorld = {};
  assert.strictEqual(DOOR.startBuild(noWorld, 'locA', 'shop', 2, 3), false);

  const st = { world: {} };
  const firstOk = DOOR.startBuild(st, 'locA', 'shop', 2, 3);
  assert.strictEqual(firstOk, true);

  const left1 = st.world.doorBuilds[DOOR.key('locA', 'shop')].left;
  const dupOk = DOOR.startBuild(st, 'locA', 'shop', 3, 5);
  assert.strictEqual(dupOk, false);
  assert.strictEqual(st.world.doorBuilds[DOOR.key('locA', 'shop')].left, left1, 'first build untouched');
});

test('canon: altar_rank_by_tier includes R5', () => {
  assert.deepStrictEqual(D.rules.doors_tiering.altar_rank_by_tier, {1:2, 2:3, 3:5});
});

test('exchangeRates: tier-scaled buy/sell in lots of 10 (T-ECN-2a)', () => {
  assert.deepStrictEqual(DOOR.exchangeRates(1, D), { lot: 10, buy: 40, sell: 5 });
  assert.deepStrictEqual(DOOR.exchangeRates(2, D), { lot: 10, buy: 30, sell: 8 });
  assert.deepStrictEqual(DOOR.exchangeRates(3, D), { lot: 10, buy: 20, sell: 10 });
});

test('exchangeRates: safe default shape when canon lacks the exchange block', () => {
  assert.deepStrictEqual(DOOR.exchangeRates(1, {}), { lot: 10, buy: 40, sell: 5 });
  assert.deepStrictEqual(DOOR.exchangeRates(3, { rules: {} }), { lot: 10, buy: 40, sell: 5 });
  assert.deepStrictEqual(DOOR.exchangeRates(undefined, D), { lot: 10, buy: 40, sell: 5 });
});

test('overlay + builds survive a JSON persist round-trip mid-build', () => {
  const st = { world: { doorTiers: {}, doorBuilds: {} } };
  DOOR.startBuild(st, 'vighive', 'muster', 2, 3);
  st.world.doorTiers[DOOR.key('vigport', 'shop')] = 3;
  const thawed = JSON.parse(JSON.stringify(st));
  assert.deepStrictEqual(thawed.world.doorBuilds[DOOR.key('vighive', 'muster')], { to: 2, left: 3 });
  assert.strictEqual(DOOR.doorTier(thawed, 'vigport', 'shop', 1), 3);
});

test('T-GX-G7e tombDormant: crown Tomb Worlds never sleep; others wake at the conflict threshold', () => {
  // quiet sector (conflict 10 < 40): a non-crown Tomb World sleeps
  assert.strictEqual(DOOR.tombDormant('Tomb World', false, 10, D), true);
  // war (>= tomb_dormant_conflict 40) wakes it
  assert.strictEqual(DOOR.tombDormant('Tomb World', false, 40, D), false);
  // a crown Tomb World is never dormant, however quiet the sector
  assert.strictEqual(DOOR.tombDormant('Tomb World', true, 10, D), false);
  assert.strictEqual(DOOR.tombDormant('Tomb World', true, null, D), false);
  // no live scores at all (null conflict): non-crown sleeps
  assert.strictEqual(DOOR.tombDormant('Tomb World', false, null, D), true);
  // non-Tomb types are never dormant regardless of crown/conflict
  assert.strictEqual(DOOR.tombDormant('Hive World', false, 10, D), false);
});

test('T-MST-1 musterList: ruler roster shelf, class-gated by tier, bulk rate at III', () => {
  const orks = D.factions.find((f) => f.id === 'orks');
  const t1 = DOOR.musterList(D, 'orks', 1);
  assert.ok(t1.length >= 1 && t1.every((r) => r.cls === 'Core'), 'tier I is Core-only');
  const t2 = DOOR.musterList(D, 'orks', 2);
  assert.strictEqual(t2.length, orks.models.length, 'tier II opens the whole roster');
  assert.ok(t2.every((r) => r.price === r.pc), 'tier II pays full pc');
  const bulk = D.rules.doors_tiering.muster_bulk_discount || 0.85;
  const t3 = DOOR.musterList(D, 'orks', 3);
  assert.ok(t3.every((r) => r.price === Math.max(1, Math.round(r.pc * bulk))), 'tier III bulk rate');
  assert.ok(t3.every((r) => r.faction === 'orks'), 'rows carry the shelf faction');
  assert.deepStrictEqual(DOOR.musterList(D, null, 3), [], 'no ruler, no shelf');
});

test('T-MST-1 canRecruit: same-allegiance only, never cross', () => {
  assert.strictEqual(DOOR.canRecruit(D, 'tau', 'orks').ok, true);
  assert.strictEqual(DOOR.canRecruit(D, 'militarum', 'astartes').ok, true);
  assert.strictEqual(DOOR.canRecruit(D, 'death_guard', 'black_legion').ok, true);
  assert.strictEqual(DOOR.canRecruit(D, 'orks', 'orks').ok, true);
  const x = DOOR.canRecruit(D, 'aeldari', 'death_guard');
  assert.strictEqual(x.ok, false);
  assert.ok(x.why && x.why.length > 0, 'refusal carries a reason');
  assert.strictEqual(DOOR.canRecruit(D, 'black_legion', 'custodes').ok, false);
  assert.strictEqual(DOOR.canRecruit(D, 'orks', null).ok, false);
});
