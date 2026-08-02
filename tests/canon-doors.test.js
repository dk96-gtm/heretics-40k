const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

const PLAYABLE = new Set(['black_legion','death_guard','world_eaters','thousand_sons','emperors_children','daemons','astartes','militarum','mechanicus','sororitas','custodes','tyranids','orks','necrons','aeldari','drukhari','tau','votann','gsc','harlequins']);

test('canon v1.25: 35 planet types, 14 standard / 21 tagged', () => {
  assert.strictEqual(D.meta.version, '1.25');
  const pts = D.galaxy.planet_types;
  assert.strictEqual(pts.length, 35);
  const tagged = pts.filter((p) => p.faction);
  assert.strictEqual(tagged.length, 21);
  for (const p of pts) {
    assert.ok(p.lore && p.lore.length > 20, p.name + ' has a lore line');
    assert.ok(p.effect === undefined, p.name + ' dormant effect string stripped');
    assert.ok(typeof p.prod_mult === 'number' && typeof p.mission_value === 'number' && typeof p.pop_ceiling === 'number', p.name + ' numeric fields');
    if (p.faction && p.faction !== 'xenos') assert.ok(PLAYABLE.has(p.faction), p.name + ' tag is a playable subfaction: ' + p.faction);
  }
});

test('tier-III homes sit on standard types only; every door kind covered', () => {
  const c = D.rules.doors_tiering;
  const byName = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p]));
  for (const [kind, home] of Object.entries(c.t3_homes)) {
    assert.ok(byName[home], kind + ' home exists: ' + home);
    assert.ok(!byName[home].faction, kind + ' home is standard (untagged): ' + home);
  }
  const kinds = D.galaxy.doors.map((d) => d.kind);
  for (const k of kinds) {
    const covered = c.t3_homes[k] || c.t3_anywhere.includes(k);
    assert.ok(covered, k + ' has a route to Tier III');
    assert.ok(D.galaxy.doors.find((d) => d.kind === k).tiers['3'], k + ' has a tier-3 ladder line');
  }
});

test('upgrade economy constants match the locked D11×E2 merge', () => {
  const c = D.rules.doors_tiering;
  assert.deepStrictEqual(c.currency_base, { common: 100, uncommon: 150, rare: 250, rarest: 400 });
  assert.deepStrictEqual(c.currency_base_by_kind, { throne_room: 200 });
  assert.deepStrictEqual(c.resource_cost, { 2: { Material: 120, Fuel: 30 }, 3: { Material: 300, Fuel: 100 } });
  assert.deepStrictEqual(c.build_days, { 2: 3, 3: 7 });
  assert.deepStrictEqual(c.tier1_types, ['Death World', 'Dead World']);
  assert.deepStrictEqual(c.t3_anywhere, ['shop']);
});
