const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

function planets() {
  const out = [];
  for (const seg of D.galaxy.segmentums)
    for (const z of seg.zones)
      for (const sec of z.sectors)
        for (const pl of sec.planets) out.push(pl);
  return out;
}
const byId = Object.fromEntries(planets().map((p) => [p.id, p]));

test('G7 crown sweep: the 16 seats (Daak 2026-08-03)', () => {
  const seats = {
    nurth: 'Plague Garden World', masque: 'Crossroads World',
    karzhorn: 'Anchorage World', prosperinep: 'Athenaeum World',
    skallaxp: 'Slaughter World', screamsink: 'Pleasure World',
    gorkamorka: 'Scrap World', shaadom: "Raider's Nest",
    devourermaw: 'Infested World', cadmus: 'Garrison World',
    hydraphur: 'Convent World', metalica_reach: 'Explorator World',
    sanctumprime: 'Cult World', macragge: 'Chapter World',
    saimhael: 'Exodite World', custodwatch: 'Vigil World',
  };
  for (const [pid, type] of Object.entries(seats))
    assert.strictEqual(byId[pid].type, type, pid);
  // explicitly unchanged
  assert.strictEqual(byId.terra.type, 'Hive World');
});

test('G7: every subfaction type is inhabited (>=1 minted planet)', () => {
  const have = new Set(planets().map((p) => p.type));
  for (const pt of D.galaxy.planet_types.filter((p) => p.faction))
    assert.ok(have.has(pt.name), pt.name + ' has at least one minted planet');
});

test('G7: legality lists carry no ghost planet types', () => {
  const names = new Set(D.galaxy.planet_types.map((p) => p.name));
  for (const lt of D.galaxy.location_types)
    for (const t of lt.planet_types || [])
      assert.ok(t === '*' || names.has(t), lt.id + ' legality ghost: ' + t);
});

test('G7 resource rows: the 8 tuned rows exact (Daak 2026-08-03)', () => {
  const by = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p.resource_output]));
  assert.deepStrictEqual(by['Plague Garden World'], { food: 6, material: 2, fuel: 1 });
  assert.deepStrictEqual(by['Crossroads World'], { food: 0, material: 1, fuel: 2 });
  assert.deepStrictEqual(by['Infested World'], { food: 3, material: 1, fuel: 1 });
  assert.deepStrictEqual(by['Exodite World'], { food: 4, material: 2, fuel: 1 });
  assert.deepStrictEqual(by['Vigil World'], { food: 0, material: 2, fuel: 3 });
  assert.deepStrictEqual(by['Scrap World'], { food: 0, material: 7, fuel: 2 });
  assert.deepStrictEqual(by['Athenaeum World'], { food: 1, material: 2, fuel: 3 });
  assert.deepStrictEqual(by['Convent World'], { food: 3, material: 2, fuel: 1 });
});

test('G7 crown floor rule: every type hosting a crown yields Material AND Fuel (Daak 2026-08-02)', () => {
  const by = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p.resource_output]));
  for (const p of planets().filter((p) => p.crown)) {
    const ro = by[p.type];
    assert.ok(ro.material > 0, p.id + ' (' + p.type + ') crown yields Material');
    assert.ok(ro.fuel > 0, p.id + ' (' + p.type + ') crown yields Fuel');
  }
});

test('G7 routes: every homed door kind reachable at Tier III (criterion 1 + reliquary addendum)', () => {
  const LT = Object.fromEntries(D.galaxy.location_types.map((l) => [l.id, l]));
  const homes = D.rules.doors_tiering.t3_homes;
  for (const [kind, home] of Object.entries(homes)) {
    const ok = planets().some((p) => p.type === home &&
      p.locations.some((l) => (LT[l.type] && LT[l.type].doors || []).includes(kind)));
    assert.ok(ok, kind + ': some ' + home + ' planet carries a granting location');
  }
});

test('G7 routes: the three authored locations exist with correct tier', () => {
  const konor = byId.konor.locations.find((l) => l.type === 'orbital_dock');
  const ironr = byId.ironreliquary.locations.find((l) => l.type === 'orbital_dock');
  const gate = byId.dalyth.locations.find((l) => l.type === 'webway_portal');
  assert.ok(konor && konor.tier === 'orbit' && konor.condition === 'intact');
  assert.ok(ironr && ironr.tier === 'orbit' && ironr.condition === 'intact');
  assert.ok(gate && gate.tier === 'surface' && gate.condition === 'intact');
  const ids = planets().flatMap((p) => p.locations.map((l) => l.id));
  assert.strictEqual(ids.length, new Set(ids).size, 'location ids unique galaxy-wide');
});
