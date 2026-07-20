const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('canon is v1.17', () => {
  assert.strictEqual(canon.meta.version, '1.17');
});

test('tick: living-world cadence block present', () => {
  const t = canon.tick;
  assert.ok(t, 'canon.tick present');
  assert.strictEqual(t.cadence, 'day');
  assert.strictEqual(t.day_minutes, 240); // 4 real hours
  assert.ok(t.max_catchup_days >= 1, 'catch-up cap');
  assert.strictEqual(typeof t.production_per_day, 'number');
  assert.strictEqual(typeof t.taint_per_day, 'number');
});

test('v1.7: numeric slot growth is present for every class', () => {
  const g = canon.rules.growth.slot_gains_by_rank;
  ['Core', 'Assault', 'Flying', 'Armament'].forEach((c) => {
    assert.ok(Array.isArray(g[c]) && g[c].length === 5, `${c} slot growth`);
    assert.strictEqual(g[c][0], 0, `${c} rank 1 gains 0`);
  });
  assert.strictEqual(g.Armament[4], 4, 'Armament gains a slot every rank');
});

test('v1.7: armour rules block exists with 6 elements', () => {
  assert.deepStrictEqual(canon.rules.armour.elements,
    ['Physical', 'Heat', 'Warp', 'Corrosive', 'Plasma', 'Energy']);
  assert.ok(/max\(0/.test(canon.rules.armour.mitigation));
  assert.ok(canon.rules.loadout && canon.rules.loadout.slot_types.length === 4);
});

test('armour catalog: 143 pieces, valid shape, 80 faction defaults', () => {
  const A = canon.armour;
  assert.ok(Array.isArray(A) && A.length === 143, `got ${A && A.length}`);
  const ELEMS = ['Physical', 'Heat', 'Warp', 'Corrosive', 'Plasma', 'Energy'];
  A.forEach((p) => {
    ELEMS.forEach((e) => assert.strictEqual(typeof p.def[e], 'number', `${p.n} ${e}`));
    assert.ok(typeof p.pc === 'number' && p.n && p.tier);
  });
  const defaults = A.filter((p) => p.tier === 'default' && p.faction);
  assert.strictEqual(defaults.length, 80, `defaults ${defaults.length}`);
});

test('armoury door exists with per-faction skins', () => {
  const d = canon.galaxy.doors.find((x) => x.kind === 'armoury');
  assert.ok(d, 'armoury door present');
  assert.ok(d.skins && d.skins.chaos && d.skins.imperial, 'armoury skins');
});

test('forge can upgrade armour', () => {
  assert.ok(canon.equipment_alpha.forge_rules.armour_upgrade, 'armour_upgrade rule');
});

test('every travel tier has base + words', () => {
  const tiers = ['same_planet', 'same_sector', 'same_sector_space',
                 'cross_sector_same_segmentum', 'cross_segmentum'];
  for (const k of tiers) {
    assert.ok(canon.travel[k], `missing tier ${k}`);
    assert.strictEqual(typeof canon.travel[k].base, 'number', `${k}.base`);
    assert.strictEqual(typeof canon.travel[k].words, 'number', `${k}.words`);
  }
});

test('travel has a force_divisor and warp-gate waiver', () => {
  assert.strictEqual(canon.travel.force_divisor, 250);
  assert.match(canon.travel.warp_gate_waiver, /warp gate/i);
});

test('bases and words climb with distance', () => {
  const t = canon.travel;
  assert.ok(t.same_planet.base < t.same_sector.base);
  assert.ok(t.same_sector.base < t.cross_sector_same_segmentum.base);
  assert.ok(t.cross_sector_same_segmentum.base < t.cross_segmentum.base);
  assert.ok(t.same_planet.words < t.cross_segmentum.words);
});

test('v1.5 revival windows are travel-tuned', () => {
  const w = canon.rules.death.revival_window.windows;
  assert.strictEqual(w.Physical, 8);
  assert.strictEqual(w.Energy, 8);
  assert.strictEqual(w.Heat, 3);
  assert.strictEqual(w.Warp, 3);
  // harsh minimum >= same-sector travel + 1
  assert.ok(w.Heat >= canon.travel.same_sector.posts + 1);
});

test('canon defines a no-revival tag set and an Annihilation forge tag', () => {
  const nr = canon.rules.death.revival_window.no_revival;
  assert.ok(Array.isArray(nr.tags) && nr.tags.includes('Annihilation'));
  const ann = canon.equipment_alpha.forge_tags_alpha.find(t => t.tag === 'Annihilation');
  assert.ok(ann, 'Annihilation forge tag present');
});

test('canon: ai block present and well-formed', () => {
  assert.equal(canon.meta.version, '1.17');
  assert.ok(canon.ai && typeof canon.ai.model === 'string' && canon.ai.model.length);
  assert.ok(typeof canon.ai.directives === 'string' && canon.ai.directives.length > 40);
});

test('canon: time block present with 8 phases / 4 blocks', () => {
  assert.ok(canon.time && typeof canon.time.block_minutes === 'number');
  assert.equal(canon.time.phases.length, 8);
  assert.equal(canon.time.blocks.length, 4);
});

test('canon: each allegiance carries prime_drive + lens frames', () => {
  ['chaos', 'imperial', 'xenos'].forEach(k => {
    const a = canon.allegiances[k];
    assert.ok(a, 'missing allegiance ' + k);
    assert.ok(typeof a.prime_drive === 'string' && a.prime_drive.length > 10, k + ' prime_drive');
    assert.ok(typeof a.lens === 'string' && a.lens.length > 10, k + ' lens');
  });
});

test('canon: every placed NPC has a persona and behavior_seed', () => {
  const AXES = ['cunning', 'ferocity', 'pragmatism', 'honor', 'supremacism'];
  canon.npcs_alpha.forEach(n => {
    const p = n.persona;
    assert.ok(p, n.id + ' missing persona');
    assert.ok(typeof p.voice === 'string' && p.voice.length > 10, n.id + ' voice');
    assert.ok(Array.isArray(p.motivations) && p.motivations.length, n.id + ' motivations');
    assert.ok(Array.isArray(p.red_lines), n.id + ' red_lines');
    assert.ok(p.knowledge_horizon && Array.isArray(p.knowledge_horizon.sectors), n.id + ' horizon');
    const b = n.behavior_seed;
    assert.ok(b, n.id + ' missing behavior_seed');
    AXES.forEach(ax => {
      assert.ok(b[ax] && typeof b[ax].value === 'number', n.id + ' axis ' + ax);
      assert.ok(b[ax].floor <= b[ax].value && b[ax].value <= b[ax].ceiling, n.id + ' ' + ax + ' in range');
    });
  });
});

test('v1.8: tag registry migrated (weapon 22, item 11, cast_gate 7)', () => {
  const t = canon.tags;
  assert.ok(t, 'D.tags present');
  assert.strictEqual(t.weapon.length, 22, 'weapon tags');
  assert.strictEqual(t.item.length, 11, 'item tags');
  assert.strictEqual(t.cast_gate.length, 7, 'cast-gate tags');
  t.weapon.forEach((w) => assert.ok(w.tag && w.mechanic, 'weapon tag shape ' + w.tag));
});

test('v1.8: forge affinities cover all 20 factions', () => {
  const aff = canon.equipment_alpha.forge_affinities;
  assert.ok(aff, 'forge_affinities present');
  canon.factions.forEach((f) => {
    assert.ok(Array.isArray(aff[f.id]) && aff[f.id].length, 'affinity for ' + f.id);
  });
  assert.deepStrictEqual(aff.black_legion, ['ALL'], 'Black Legion broad access');
});

test('v1.9: gear catalogs migrated with correct counts', () => {
  assert.strictEqual(canon.weapons.length, 102, 'standard weapons');
  assert.strictEqual(canon.items.length, 75, 'standard items');
  assert.strictEqual(canon.abilities.length, 67, 'abilities');
  assert.strictEqual(canon.casts.length, 71, 'casts');
  assert.strictEqual(canon.legendaries.length, 40, 'legendaries (20 weapons + 20 items)');
});

test('v1.9: every gear entry has the {n,cat,d,pc,faction} shape', () => {
  const CATS = { weapons: 'WEAPON', items: 'ITEM', abilities: 'ABILITY',
                 casts: 'CAST', legendaries: 'LEGENDARY' };
  const facIds = new Set(canon.factions.map((f) => f.id));
  Object.keys(CATS).forEach((key) => {
    canon[key].forEach((it) => {
      assert.ok(it.n && typeof it.n === 'string', key + ' name');
      assert.strictEqual(it.cat, CATS[key], key + ' cat ' + it.n);
      assert.ok(typeof it.d === 'string', key + ' d ' + it.n);
      assert.strictEqual(typeof it.pc, 'number', key + ' pc ' + it.n);
      assert.ok(it.faction === null || facIds.has(it.faction), key + ' faction ' + it.n);
    });
  });
});

test('v1.9: legendaries are one weapon + one item per faction', () => {
  const byFac = {};
  canon.legendaries.forEach((l) => { byFac[l.faction] = (byFac[l.faction] || 0) + 1; });
  canon.factions.forEach((f) => {
    assert.strictEqual(byFac[f.id], 2, 'two legendaries for ' + f.id);
  });
});

test('v1.9: faction-null "common" gear exists for shop/altar filtering', () => {
  assert.ok(canon.weapons.some((w) => w.faction === null), 'common weapons');
  assert.ok(canon.items.some((i) => i.faction === null), 'common items');
  assert.ok(canon.abilities.some((a) => a.faction === null), 'common abilities');
  assert.ok(canon.casts.some((c) => c.faction === null), 'common casts');
});

test('v1.10: every faction fields the full 5-model roster (100 total)', () => {
  let total = 0;
  canon.factions.forEach((f) => {
    assert.strictEqual(f.models.length, 5, f.id + ' roster size');
    total += f.models.length;
  });
  assert.strictEqual(total, 100, 'full 100-model roster');
});

test('v1.10: every model has the {n,cls,pc,w,sp,sl} shape and 2/1/1/1 class mix', () => {
  const CLS = ['Core', 'Assault', 'Flying', 'Armament'];
  canon.factions.forEach((f) => {
    const mix = { Core: 0, Assault: 0, Flying: 0, Armament: 0 };
    f.models.forEach((m) => {
      assert.ok(m.n && typeof m.n === 'string', f.id + ' model name');
      assert.ok(CLS.includes(m.cls), f.id + ' class ' + m.cls);
      ['pc', 'w', 'sp', 'sl'].forEach((k) =>
        assert.ok(typeof m[k] === 'number' && m[k] >= 0, f.id + ' ' + m.n + ' ' + k));
      mix[m.cls]++;
    });
    assert.deepStrictEqual(mix, { Core: 2, Assault: 1, Flying: 1, Armament: 1 },
      f.id + ' class composition');
  });
});

test('v1.10: Death Guard demo base models survive the roster migration', () => {
  const dg = canon.factions.find((f) => f.id === 'death_guard');
  const names = new Set(dg.models.map((m) => m.n));
  ['Plague Marine', 'Poxwalker', 'Blightlord Terminator', 'Foetid Bloat-Drone']
    .forEach((n) => assert.ok(names.has(n), 'demo references ' + n));
});

// ── T-GX-G1: Segmentum Solar authored to the minting contract (v1.12) ──
function solarSegmentum() {
  return canon.galaxy.segmentums.find((g) => g.id === 'solar');
}
function solarPlanets() {
  const out = [];
  solarSegmentum().zones.forEach((z) => z.sectors.forEach((s) =>
    (s.planets || []).forEach((p) => out.push({ p, s }))));
  return out;
}

test('G1: Solar has 3 populated sectors and 10 planets', () => {
  const solar = solarSegmentum();
  const sectors = solar.zones.flatMap((z) => z.sectors);
  assert.strictEqual(sectors.length, 3, 'Solar sector count');
  sectors.forEach((s) => {
    assert.ok(!s.sealed, s.id + ' should be unsealed');
    assert.ok(s.space && s.space.type === 'space', s.id + ' has a space layer');
    assert.ok(typeof s.owner === 'string' && s.owner.length, s.id + ' owner');
    assert.ok((s.planets || []).length >= 3, s.id + ' has planets');
  });
  assert.strictEqual(solarPlanets().length, 10, 'Solar planet count');
});

test('G1: every Solar planet obeys the minting contract', () => {
  const planetTypes = new Set(canon.galaxy.planet_types.map((p) => p.name));
  const LT = Object.fromEntries(canon.galaxy.location_types.map((l) => [l.id, l]));
  const facNames = new Set(canon.factions.map((f) => f.name));
  const seenIds = new Set();
  solarPlanets().forEach(({ p }) => {
    assert.ok(planetTypes.has(p.type), p.id + ' valid planet type');
    assert.strictEqual(p.rift, 'Sanctus', p.id + ' is Sanctus');
    assert.ok(p.ruler && facNames.has(p.ruler.faction), p.id + ' ruler is a canon faction');
    assert.strictEqual(typeof p.resources, 'number', p.id + ' resources');
    const primaryOrbit = p.locations.filter((l) => l.type === 'orbit');
    const surface = p.locations.filter((l) => l.tier === 'surface');
    assert.strictEqual(primaryOrbit.length, 1, p.id + ' has exactly one primary orbit');
    assert.ok(surface.length >= 2, p.id + ' has >=2 surface locations');
    p.locations.forEach((l) => {
      assert.ok(!seenIds.has(l.id), 'unique location id ' + l.id);
      seenIds.add(l.id);
      const lt = LT[l.type];
      assert.ok(lt, l.id + ' known location type ' + l.type);
      const legal = lt.planet_types || ['*'];
      assert.ok(legal.includes('*') || legal.includes(p.type),
        l.id + ' (' + l.type + ') legal on ' + p.type);
      assert.ok(!l.doors, l.id + ' must NOT store doors (derived from type)');
      Object.keys(l.door_names || {}).forEach((k) =>
        assert.ok((lt.doors || []).includes(k), l.id + ' door_names ' + k + ' is a real door'));
    });
  });
});

test('G1: each Solar sector has exactly one crown capital', () => {
  solarSegmentum().zones.forEach((z) => z.sectors.forEach((s) => {
    const crowns = (s.planets || []).filter((p) => p.crown);
    assert.strictEqual(crowns.length, 1, s.id + ' has one crown');
    const cr = crowns[0].locations.filter((l) => l.type === 'crown');
    assert.ok(cr.length >= 1, s.id + ' crown planet holds a crown location');
  }));
});

// ── T-GX-G2: Segmentum Pacificus authored to the minting contract ─────
// (minted sector-by-sector; invariants below check only POPULATED sectors so
//  they stay green while the un-minted baseline stub still sits in the zone)
function pacificusSegmentum() {
  return canon.galaxy.segmentums.find((g) => g.id === 'pacificus');
}
function pacificusPlanets() {
  const out = [];
  (pacificusSegmentum().zones || []).forEach((z) => z.sectors.forEach((s) =>
    (s.planets || []).forEach((p) => out.push({ p, s }))));
  return out;
}
function pacificusMintedSectors() {
  return pacificusSegmentum().zones
    .flatMap((z) => z.sectors)
    .filter((s) => (s.planets || []).length > 0);
}

test('G2: every Pacificus planet obeys the minting contract', () => {
  const planetTypes = new Set(canon.galaxy.planet_types.map((p) => p.name));
  const LT = Object.fromEntries(canon.galaxy.location_types.map((l) => [l.id, l]));
  pacificusPlanets().forEach(({ p }) => {
    assert.ok(planetTypes.has(p.type), p.id + ' valid planet type');
    const primaryOrbit = p.locations.filter((l) => l.type === 'orbit');
    assert.strictEqual(primaryOrbit.length, 1, p.id + ' has exactly one primary orbit');
    const surface = p.locations.filter((l) => l.tier === 'surface');
    assert.ok(surface.length >= 2, p.id + ' has >=2 surface locations');
    assert.ok(p.locations.length >= 3 && p.locations.length <= 5, p.id + ' has 3-5 locations');
    p.locations.forEach((l) => {
      const lt = LT[l.type];
      assert.ok(lt, p.id + ' location type ' + l.type + ' exists');
      const legal = lt.planet_types || ['*'];
      assert.ok(legal.includes('*') || legal.includes(p.type),
        l.id + ' (' + l.type + ') legal on ' + p.type);
    });
  });
});

test('G2: each minted Pacificus sector has one crown capital + plurality owner', () => {
  pacificusMintedSectors().forEach((s) => {
    const crowns = s.planets.filter((p) => p.crown);
    assert.strictEqual(crowns.length, 1, s.id + ' has one crown');
    assert.ok(crowns[0].locations.some((l) => l.type === 'crown'),
      s.id + ' crown planet holds a crown location');
    const tally = {};
    s.planets.forEach((p) => { tally[p.ruler.faction] = (tally[p.ruler.faction] || 0) + 1; });
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    assert.ok(s.owner.includes(top), s.id + " owner '" + s.owner + "' matches plurality " + top);
  });
});

test('G2: Pacificus fully minted — 6 sectors, 20 planets, no sealed stubs', () => {
  const sectors = pacificusSegmentum().zones.flatMap((z) => z.sectors);
  assert.strictEqual(sectors.length, 6, 'Pacificus sector count');
  assert.strictEqual(pacificusPlanets().length, 20, 'Pacificus planet count');
  sectors.forEach((s) =>
    assert.ok(!s.sealed && (s.planets || []).length > 0, s.id + ' minted, not a sealed stub'));
});

// ── T-GX-G3: Segmentum Obscurus authored (v1.14) — folds in the demo sectors ──
function obscurusSegmentum() {
  return canon.galaxy.segmentums.find((g) => g.id === 'obscurus');
}
function obscurusSectors() {
  return obscurusSegmentum().zones.flatMap((z) => z.sectors);
}

test('G3: Obscurus preserves the 3 demo sectors and adds 4 new (7 total)', () => {
  const ids = obscurusSectors().map((s) => s.id);
  ['vigsec', 'pallid', 'kraith'].forEach((demo) =>
    assert.ok(ids.includes(demo), 'demo sector preserved: ' + demo));
  ['despoiler', 'skallax', 'prosperine', 'greenrok'].forEach((n) =>
    assert.ok(ids.includes(n), 'new sector present: ' + n));
  assert.strictEqual(obscurusSectors().length, 7, 'Obscurus sector count');
});

test('G3: every NEW Obscurus sector obeys the minting contract (Nihilus)', () => {
  const planetTypes = new Set(canon.galaxy.planet_types.map((p) => p.name));
  const LT = Object.fromEntries(canon.galaxy.location_types.map((l) => [l.id, l]));
  const facNames = new Set(canon.factions.map((f) => f.name));
  const NEW = new Set(['despoiler', 'skallax', 'prosperine', 'greenrok']);
  obscurusSectors().filter((s) => NEW.has(s.id)).forEach((s) => {
    assert.ok(s.space && s.space.type === 'space', s.id + ' has a space layer');
    let crowns = 0;
    (s.planets || []).forEach((p) => {
      assert.ok(planetTypes.has(p.type), p.id + ' valid planet type');
      assert.strictEqual(p.rift, 'Nihilus', p.id + ' is Nihilus');
      assert.ok(p.ruler && facNames.has(p.ruler.faction), p.id + ' ruler is a canon faction');
      assert.strictEqual(p.locations.filter((l) => l.type === 'orbit').length, 1, p.id + ' one orbit');
      assert.ok(p.locations.filter((l) => l.tier === 'surface').length >= 2, p.id + ' >=2 surface');
      p.locations.forEach((l) => {
        const lt = LT[l.type];
        assert.ok(lt, l.id + ' known location type');
        const legal = lt.planet_types || ['*'];
        assert.ok(legal.includes('*') || legal.includes(p.type), l.id + ' legal on ' + p.type);
        assert.ok(!l.doors, l.id + ' must not store doors');
      });
      if (p.crown) crowns++;
    });
    assert.strictEqual(crowns, 1, s.id + ' has one crown');
  });
});

// ── galaxy-wide integrity guard (protects every authored segmentum, cross-session) ──
test('galaxy: every planet/location/sector id is globally unique', () => {
  const ids = [];
  canon.galaxy.segmentums.forEach((g) => g.zones.forEach((z) => z.sectors.forEach((s) => {
    ids.push(s.id);
    if (s.space) ids.push(s.space.id);
    (s.planets || []).forEach((p) => {
      ids.push(p.id);
      p.locations.forEach((l) => ids.push(l.id));
    });
  })));
  const seen = new Set(), dupes = new Set();
  ids.forEach((id) => (seen.has(id) ? dupes.add(id) : seen.add(id)));
  assert.deepStrictEqual([...dupes], [], 'duplicate galaxy ids: ' + [...dupes].join(', '));
});

// ── T-GX-G4: Segmentum Tempestus authored (v1.15) — Nihilus heartland ──
function tempestusSegmentum() {
  return canon.galaxy.segmentums.find((g) => g.id === 'tempestus');
}
function tempestusSectors() {
  return tempestusSegmentum().zones.flatMap((z) => z.sectors);
}

test('G4: Tempestus fully minted — 5 sectors, 16 planets, no sealed stubs', () => {
  const sectors = tempestusSectors();
  assert.strictEqual(sectors.length, 5, 'Tempestus sector count');
  const planets = sectors.flatMap((s) => s.planets || []);
  assert.strictEqual(planets.length, 16, 'Tempestus planet count');
  sectors.forEach((s) => {
    assert.ok(!s.sealed && (s.planets || []).length > 0, s.id + ' minted, not a sealed stub');
    assert.ok(s.space && s.space.type === 'space', s.id + ' has a space layer');
  });
});

test('G4: every Tempestus planet obeys the contract (Nihilus) + one crown/sector', () => {
  const planetTypes = new Set(canon.galaxy.planet_types.map((p) => p.name));
  const LT = Object.fromEntries(canon.galaxy.location_types.map((l) => [l.id, l]));
  const facNames = new Set(canon.factions.map((f) => f.name));
  tempestusSectors().forEach((s) => {
    let crowns = 0;
    (s.planets || []).forEach((p) => {
      assert.ok(planetTypes.has(p.type), p.id + ' valid planet type');
      assert.strictEqual(p.rift, 'Nihilus', p.id + ' is Nihilus');
      assert.ok(p.ruler && facNames.has(p.ruler.faction), p.id + ' ruler is a canon faction');
      assert.strictEqual(p.locations.filter((l) => l.type === 'orbit').length, 1, p.id + ' one orbit');
      assert.ok(p.locations.filter((l) => l.tier === 'surface').length >= 2, p.id + ' >=2 surface');
      p.locations.forEach((l) => {
        const lt = LT[l.type];
        assert.ok(lt, l.id + ' known location type');
        const legal = lt.planet_types || ['*'];
        assert.ok(legal.includes('*') || legal.includes(p.type), l.id + ' legal on ' + p.type);
        assert.ok(!l.doors, l.id + ' must not store doors');
      });
      if (p.crown) crowns++;
    });
    assert.strictEqual(crowns, 1, s.id + ' has one crown');
  });
});

test('G4: Tempestus seats Emperor\'s Children — all 8 Nihilus factions now homed', () => {
  const nihilusFactions = ['Black Legion', 'Death Guard', 'World Eaters', 'Thousand Sons',
    "Emperor's Children", 'Daemons', 'Tyranids', 'Orks'];
  const rulers = new Set();
  canon.galaxy.segmentums.forEach((g) => g.zones.forEach((z) => z.sectors.forEach((s) =>
    (s.planets || []).forEach((p) => p.ruler && rulers.add(p.ruler.faction)))));
  nihilusFactions.forEach((f) =>
    assert.ok(rulers.has(f), f + ' has a foothold in the minted galaxy'));
});

// ── T-GX-G5: Segmentum Ultima (the Front) — the galaxy-mint finale (v1.16) ──
function ultimaSectors() {
  return canon.galaxy.segmentums.find((g) => g.id === 'ultima').zones.flatMap((z) => z.sectors);
}

test('G5: Ultima fully minted — 6 sectors, 24 planets, no sealed stubs', () => {
  const sectors = ultimaSectors();
  assert.strictEqual(sectors.length, 6, 'Ultima sector count');
  assert.strictEqual(sectors.flatMap((s) => s.planets || []).length, 24, 'Ultima planet count');
  sectors.forEach((s) => {
    assert.ok(!s.sealed && (s.planets || []).length > 0, s.id + ' minted');
    assert.ok(s.space && s.space.type === 'space', s.id + ' has a space layer');
  });
});

test('G5: Ultima is a MIXED-rift front (both Sanctus and Nihilus worlds)', () => {
  const rifts = new Set(ultimaSectors().flatMap((s) => s.planets || []).map((p) => p.rift));
  assert.ok(rifts.has('Sanctus') && rifts.has('Nihilus'),
    'the Front holds worlds on both sides of the Rift');
  // the Cicatrix Scar is genuinely contested (not owned by one faction)
  const scar = ultimaSectors().find((s) => s.id === 'cicatrix');
  assert.ok(scar && /contested/i.test(scar.owner), 'the Cicatrix Scar is contested');
});

test('G5: every Ultima planet obeys the contract + one crown/sector', () => {
  const planetTypes = new Set(canon.galaxy.planet_types.map((p) => p.name));
  const LT = Object.fromEntries(canon.galaxy.location_types.map((l) => [l.id, l]));
  ultimaSectors().forEach((s) => {
    let crowns = 0;
    (s.planets || []).forEach((p) => {
      assert.ok(planetTypes.has(p.type), p.id + ' valid planet type');
      assert.ok(['Sanctus', 'Nihilus'].includes(p.rift), p.id + ' rift');
      assert.strictEqual(p.locations.filter((l) => l.type === 'orbit').length, 1, p.id + ' one orbit');
      assert.ok(p.locations.filter((l) => l.tier === 'surface').length >= 2, p.id + ' >=2 surface');
      p.locations.forEach((l) => {
        const lt = LT[l.type];
        assert.ok(lt, l.id + ' known type');
        const legal = lt.planet_types || ['*'];
        assert.ok(legal.includes('*') || legal.includes(p.type), l.id + ' legal on ' + p.type);
        assert.ok(!l.doors, l.id + ' must not store doors');
      });
      if (p.crown) crowns++;
    });
    assert.strictEqual(crowns, 1, s.id + ' has one crown');
  });
});

test('GALAXY MINT COMPLETE: all 20 factions homed across 5 minted segmentums', () => {
  const rulers = new Set();
  let planets = 0, sectors = 0;
  canon.galaxy.segmentums.forEach((g) => g.zones.forEach((z) => z.sectors.forEach((s) => {
    sectors++;
    (s.planets || []).forEach((p) => { planets++; if (p.ruler) rulers.add(p.ruler.faction); });
  })));
  canon.factions.forEach((f) =>
    assert.ok(rulers.has(f.name), f.name + ' has a foothold'));
  // five segmentums each carry at least one populated sector
  canon.galaxy.segmentums.forEach((g) => {
    const pl = g.zones.flatMap((z) => z.sectors).flatMap((s) => s.planets || []);
    assert.ok(pl.length > 0, g.id + ' is populated');
  });
  assert.ok(sectors >= 27, 'galaxy has 27+ minted sectors, got ' + sectors);
  assert.ok(planets >= 80, 'galaxy has 80+ planets, got ' + planets);
});

// ── T-GX-G6 slice 1 · rules.rift home/away magnitudes ────────────────
test('rules.rift: home/away magnitudes + neutral factions present', () => {
  const r = canon.rules.rift;
  assert.ok(r, 'rules.rift exists');
  assert.deepStrictEqual(r.neutral_factions.slice().sort(),
    ['Drukhari', 'Genestealer Cults', 'Harlequins', 'Necrons']);
  assert.strictEqual(r.home.prod_mult, 1.25);
  assert.strictEqual(r.away.travel_mult, 1.25);
  assert.strictEqual(r.home.comms_tier, 1);
  assert.strictEqual(r.away.comms_tier, -1);
});
