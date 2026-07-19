const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('canon is v1.9', () => {
  assert.strictEqual(canon.meta.version, '1.9');
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
  assert.equal(canon.meta.version, '1.9');
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
