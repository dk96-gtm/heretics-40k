const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

const FACTIONS = D.factions.map(f => f.id);

test('canon: version is 1.38', () => {
  assert.equal(D.meta.version, '1.38');
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
