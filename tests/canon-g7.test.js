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
