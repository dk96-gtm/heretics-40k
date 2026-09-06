const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

const FACTIONS = D.factions.map(f => f.id);

test('canon: version is 1.39', () => {
  assert.equal(D.meta.version, '1.39');
});

test('hall door row exists with 20 per-faction skins and 3 tier lines', () => {
  const hall = D.galaxy.doors.filter(d => d.kind === 'hall')[0];
  assert.ok(hall, 'hall door row missing');
  assert.equal(hall.name, 'Hall');
  for (const f of FACTIONS) assert.ok(typeof hall.skins[f] === 'string' && hall.skins[f].length > 0, 'skin missing: ' + f);
  assert.equal(Object.keys(hall.skins).length, 20);
  for (const t of ['1', '2', '3']) assert.ok(hall.tiers[t], 'tier text missing: ' + t);
});

test('hall placed at the 16 inhabited location types, absent from the rest', () => {
  const HAS = ['hive','city','tradeport','village','manufactorum','forge_temple',
    'military_outpost','fortress','bulwark','shrine','lair','crown','plague_garden',
    'mek_shop','cult_sanctum','tomb_vault'];
  const NOT = ['ruins','warzone','webway_portal','space_station','orbital_dock','orbit','space'];
  for (const lt of D.galaxy.location_types) {
    const has = (lt.doors || []).indexOf('hall') >= 0;
    if (HAS.indexOf(lt.id) >= 0) assert.ok(has, lt.id + ' should carry a hall');
    if (NOT.indexOf(lt.id) >= 0) assert.ok(!has, lt.id + ' must NOT carry a hall (slice A)');
  }
});

test('hall tier-seeds at T3 on Hive Worlds', () => {
  assert.equal(D.rules.doors_tiering.t3_homes.hall, 'Hive World');
});

test('rules.hall: culture + names complete for all 20 factions', () => {
  const H = D.rules.hall;
  assert.ok(H, 'rules.hall missing');
  for (const f of FACTIONS) {
    const c = H.culture[f];
    assert.ok(c && c.flavor && c.commune && c.offer_label && c.offer && c.offer.kind, 'culture incomplete: ' + f);
    assert.ok(['cur', 'item', 'res'].indexOf(c.offer.kind) >= 0, 'bad offer kind: ' + f);
    const n = H.names[f];
    assert.ok(n && n.first.length >= 6 && n.epithets.length >= 4, 'name pool thin: ' + f);
  }
  assert.equal(H.culture.world_eaters.offer.accepts, 'REMAINS');
  assert.equal(H.culture.drukhari.offer.accepts, 'CAPTIVE');
  assert.equal(H.culture.tyranids.offer.res, 'Food');
});

test('rules.hall: pools cover every hall-bearing location type; events are the 4 mood rows', () => {
  const H = D.rules.hall;
  for (const lt of D.galaxy.location_types) {
    if ((lt.doors || []).indexOf('hall') < 0) continue;
    assert.ok(Array.isArray(H.pools[lt.id]) && H.pools[lt.id].length >= 3, 'pool thin: ' + lt.id);
    for (const p of H.pools[lt.id]) assert.ok(p.role && p.registers.length, 'bad pool row in ' + lt.id);
  }
  assert.deepEqual(H.events.map(e => e.id), ['famine_table', 'plague_night', 'good_season', 'holy_day']);
  assert.ok(H.status_roles.Sacked && H.status_roles.Besieged, 'status_roles missing');
});

test('civilians: one body per faction, low-PC, sexed', () => {
  for (const f of FACTIONS) {
    const c = D.civilians[f];
    assert.ok(c, 'civilian missing: ' + f);
    assert.ok(c.pc >= 2 && c.pc <= 8 && c.w >= 1 && c.w <= 2, 'civilian statline off: ' + f);
    assert.ok(['male', 'female', 'varied'].indexOf(c.sex) >= 0, 'bad sex rule: ' + f);
  }
  assert.equal(D.civilians.astartes.sex, 'male');
  assert.equal(D.civilians.custodes.sex, 'male');
  assert.equal(D.civilians.sororitas.sex, 'female');
});
