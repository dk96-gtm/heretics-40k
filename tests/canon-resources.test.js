const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('canon v1.25: every planet type carries resource_output; spec rows exact', () => {
  assert.strictEqual(D.meta.version, '1.33');
  for (const p of D.galaxy.planet_types)
    assert.ok(p.resource_output && ['food','material','fuel'].every((k) => typeof p.resource_output[k] === 'number'), p.name);
  const by = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p.resource_output]));
  assert.deepStrictEqual(by['Forge World'], { food: 0, material: 18, fuel: 2 });
  assert.deepStrictEqual(by['Agri World'], { food: 14, material: 0, fuel: 0 });
  assert.deepStrictEqual(by['Civilized World'], { food: 4, material: 4, fuel: 2 });
  assert.deepStrictEqual(by['Dead World'], { food: 0, material: 0, fuel: 0 });
});

test('rules.resources constants', () => {
  const r = D.rules.resources;
  assert.deepStrictEqual(r.types, ['Food', 'Material', 'Fuel']);
  assert.strictEqual(r.stack, 40);
  assert.strictEqual(r.storage_cap_per_level, 40);
  assert.strictEqual(r.cargo_slots_per_cp, 5);
  assert.strictEqual(r.upkeep_per_level, 2);
});

test('rules.resources.exchange: T-ECN-2a shop valve, exact pin', () => {
  assert.deepStrictEqual(D.rules.resources.exchange, {
    note: 'T-ECN-2a: shop Exchange section. Lots of 10 points; buy costs currency per lot by shop tier, sell pays currency per lot. Unfavorable by design — the valve, not the economy.',
    lot: 10,
    buy_per_lot: { '1': 40, '2': 30, '3': 20 },
    sell_per_lot: { '1': 5, '2': 8, '3': 10 },
  });
});

test('galaxy.doors shop record: Exchange text wired into does + tier ladders', () => {
  const shop = D.galaxy.doors.find((d) => d.kind === 'shop');
  assert.match(shop.does, /exchange resources/);
  assert.match(shop.tiers['1'], /Exchange \(poor rates\)/);
  assert.match(shop.tiers['3'], /best Exchange rates/);
});
