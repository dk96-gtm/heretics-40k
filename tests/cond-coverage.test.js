const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');
const { loadCondGlue } = require('./_condglue');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const G = loadCondGlue(THREAD);

function gear(cat, n) {
  const r = (canon[cat] || []).filter(x => x.n === n)[0];
  assert.ok(r, cat + ' has ' + n);
  return r;
}
function tagsOf(it) { return G.parseItem(it).tags.map(t => t.tag + (t.tier ? ' ' + t.tier : '')); }

/* ── T-CMB-2 Task 1: grammar normalization against real canon ── */

test('grammar: "applies DoT II" phrasing parses (Curse of the Leper)', () => {
  assert.ok(tagsOf(gear('casts', 'Curse of the Leper')).indexOf('DoT II') >= 0);
});

test('grammar: "Ally:" prefix + "for N posts" suffix parse (Catalyst, Fecund Vigour, Ichor Injection)', () => {
  assert.ok(tagsOf(gear('casts', 'Catalyst')).indexOf('Regen II') >= 0);
  assert.ok(tagsOf(gear('casts', 'Fecund Vigour')).indexOf('Regen II') >= 0);
  assert.ok(tagsOf(gear('casts', 'Ichor Injection')).indexOf('Regen I') >= 0);
});

test('grammar: "Target:" prefix parses both tags of Telekinetic Grip', () => {
  const t = tagsOf(gear('casts', 'Telekinetic Grip'));
  assert.ok(t.indexOf('Slowing II') >= 0);
  assert.ok(t.indexOf('Suppressing I') >= 0);
});

test('grammar: "Apply Marked II to a target" parses (Markerlight, Doom, Bring It Down)', () => {
  assert.ok(tagsOf(gear('items', 'Markerlight')).indexOf('Marked II') >= 0);
  assert.ok(tagsOf(gear('abilities', 'Doom')).indexOf('Marked II') >= 0);
  assert.ok(tagsOf(gear('abilities', 'Bring It Down')).indexOf('Marked I') >= 0);
});

test('grammar: "at Long range" suffix parses AND recovers the range (Target Uplink)', () => {
  const p = G.parseItem(gear('casts', 'Target Uplink'));
  assert.ok(p.tags.some(t => t.tag === 'Marked' && t.tier === 'II'));
  assert.strictEqual(p.range, 'Long');
});

test('grammar: trailing parenthetical strips (Living Metal, War Hymn via ; split)', () => {
  assert.ok(tagsOf(gear('abilities', 'Living Metal')).indexOf('Regen I') >= 0);
  assert.ok(tagsOf(gear('abilities', 'War Hymn')).indexOf('Rally I') >= 0);
});

test('grammar: semicolon splitting frees the leading tag (Chaos Icon, Banner of Blood)', () => {
  assert.ok(tagsOf(gear('items', 'Chaos Icon')).indexOf('Rally I') >= 0);
  assert.ok(tagsOf(gear('items', 'Banner of Blood')).indexOf('Rally I') >= 0);
});

test('grammar: "gain Charging (...)" parses — Charge stages its own Charging buff', () => {
  assert.ok(tagsOf(gear('abilities', 'Charge')).indexOf('Charging') >= 0);
});

test('grammar: Immunity segments are exempt from normalization — condTagsOf recovery still yields of', () => {
  const ct = G.condTagsOf(gear('items', 'Rebreather'));
  assert.deepStrictEqual(ct, [{ tag: 'Immunity', tier: 1, of: 'DoT' }]);
  const ii = G.condTagsOf(gear('casts', 'Ichor Injection'));
  assert.ok(ii.some(c => c.tag === 'Immunity' && c.of === 'DoT'));
});

test('grammar: prefix-stripped Immunity ("gain Immunity (DoT)") preserves of via recovery', () => {
  const synthetic = {n:'X', cat:'item', d:'gain Immunity (DoT)'};
  const ct = G.condTagsOf(synthetic);
  assert.deepStrictEqual(ct, [{ tag: 'Immunity', tier: 1, of: 'DoT' }]);
});

test('grammar: aura/weapon-mod phrasings deliberately stay notes (scope law)', () => {
  assert.strictEqual(G.condTagsOf(gear('items', 'Toxin Sacs')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', "Censer Bearer's Kit")).length, 0);
  assert.strictEqual(G.condTagsOf(gear('abilities', 'Sonic Assault')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', 'Warpflame Ichor')).length, 0);
});

test('grammar: Shield/Decoy/Stimm parse for display but are NOT stageable (T-CMB-4 scope law)', () => {
  assert.ok(G.parseItem(gear('items', 'Mirror-Polish Plate')).tags.some(t => t.tag === 'Decoy'));
  assert.strictEqual(G.condTagsOf(gear('items', 'Mirror-Polish Plate')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', 'Combat Drugs')).length, 0);
});

test('grammar: plain weapon tag segments unchanged (regression guard)', () => {
  assert.ok(tagsOf(gear('weapons', 'Thunder Hammer')).indexOf('Suppressing I') >= 0);
  const p = G.parseItem(gear('weapons', 'Venom Cannon'));
  assert.strictEqual(p.element, 'Corrosive');
  assert.strictEqual(p.range, 'Long');
  assert.ok(p.tags.some(t => t.tag === 'DoT' && t.tier === 'II'));
});

/* ── Task 2: passive cond items stageable ── */

function slotModel(items) {
  return { model: { n: 'Bearer', loadout: { slots: items.map(it => ({ type: 'ITEM', it })) } } };
}

test('bfCondItemsOf: passive Immunity/Regen/Rally ITEMs pass the filter (Rebreather, Unholy Vigour, Battle Standard, Markerlight)', () => {
  const c = slotModel([gear('items', 'Rebreather'), gear('items', 'Unholy Vigour'),
    gear('items', 'Battle Standard'), gear('items', 'Markerlight')]);
  assert.deepStrictEqual(G.bfCondItemsOf(c).map(i => i.n).sort(),
    ['Battle Standard', 'Markerlight', 'Rebreather', 'Unholy Vigour']);
});

test('bfCondItemsOf: consumable grenades still pass; capture/tagless items still do not', () => {
  const blight = gear('items', 'Blight Grenade');
  const c = slotModel([blight, { n: 'Shackle Collar', cat: 'ITEM', d: 'Capture II - 1 AP' },
    { n: 'Plain Rock', cat: 'ITEM', d: 'A rock' }]);
  assert.deepStrictEqual(G.bfCondItemsOf(c).map(i => i.n), ['Blight Grenade']);
});

test('combatCatalog: a non-consumable cond ITEM yields a Use row (core condTaggyItem)', () => {
  const state = { pools: { A: 9 }, combatants: {
    m: { party: 'A', w: [10, 10], conds: [],
      model: { n: 'Bearer', loadout: { slots: [{ type: 'ITEM', it: gear('items', 'Rebreather') }] } } } } };
  const rows = THREAD.catalog({ type: 'SKIRMISH' }, state, 'A', canon);
  assert.ok(rows.some(r => r.kind === 'cond' && r.item && r.item.n === 'Rebreather'));
});

test('inventory pin: the exact post-sweep stageable set across all canon gear (audit the class)', () => {
  const stageable = [];
  ['weapons', 'items', 'abilities', 'casts', 'legendaries'].forEach(cat =>
    (canon[cat] || []).forEach(r => { if (G.condTagsOf(r).length) stageable.push(r.n); }));
  // Pin the exact set: any canon or grammar drift that silently adds/removes a stageable
  // item must fail here and be consciously re-pinned.
  assert.deepStrictEqual(stageable.sort(), [
    'Agoniser', 'And They Shall Know No Fear', 'Banner of Blood', 'Battle Standard',
    'Blight Grenade', 'Blood Icon', 'Bring It Down', 'Canticles of the Omnissiah',
    'Catalyst', 'Chaos Icon', 'Charge', 'Concussion Maul', 'Cult Icon',
    'Curse of the Leper', 'Cybork Body', 'Deathspitter', 'Doom', 'Dust-Sealed Plate',
    'Eviscerator', 'Fecund Vigour', 'Fleshborer', 'Gauss Blaster', 'Gauss Cannon',
    'Gauss Flayer', 'Heavy Rock Drill', 'Ichor Injection', 'Iron Arm', 'Living Metal',
    'Markerlight', 'Mental Fortitude', 'Mirror of Minds', 'Neuro Disruptor',
    'Nightmare Toxins', 'Power Claw / Dozer Ram', 'Psychic Scream', 'Rad-Bombs',
    'Rebreather', 'Regenerative Flesh', 'Rusted Industrial Rig', 'Seismic Cannon',
    'Shardcarbine', 'Shotgun', 'Shrieker Cannon', 'Splinter Cannon', 'Splinter Pistol',
    'Splinter Rifle', 'Stikkbombz', 'Symphony of Pain', 'Synapse', 'Target Uplink',
    'Telekinetic Grip', 'Thunder Hammer', 'Unholy Vigour', 'Venom Cannon',
    'Void Armour', 'Vox-Caster', 'War Hymn', 'Warp-Spawned', 'Webber',
  ]);
});

/* ── Task 3: weapon riders ── */

function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}

test('weaponCondEffects: hostile weapon tags become rider cond payloads; non-hostile/mechanic tags do not', () => {
  const th = gear('weapons', 'Thunder Hammer');       // Suppressing I + Unwieldy
  const effs = G.weaponCondEffects(th, 'victim');
  assert.strictEqual(effs.length, 1);
  assert.strictEqual(effs[0].kind, 'cond');
  assert.deepStrictEqual({ tag: effs[0].add.tag, tier: effs[0].add.tier, to: effs[0].to },
    { tag: 'Suppressing', tier: 1, to: 'victim' });
  assert.strictEqual(effs[0].add.item, th, 'threads the source item for nl/nr stamping');
  assert.strictEqual(G.weaponCondEffects({ n: 'Plain Bolter', cat: 'WEAPON', d: 'Phys 2 - Med - 1 AP' }, 'v').length, 0);
});

test('weaponCondEffects: no target → no riders (never a self-cond)', () => {
  assert.strictEqual(G.weaponCondEffects(gear('weapons', 'Eviscerator'), null).length, 0);
});

test('riders end-to-end: an Eviscerator hit leaves a DoT instance that ticks on the victim\'s post', () => {
  const ev = gear('weapons', 'Eviscerator');
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B', w: [10, 10] }) } };
  const block = [
    { actor: 'atk', cost: 2, effect: { kind: 'damage', to: 'victim', amount: 3, element: 'Physical', weapon: ev.n, band: 'MELEE' } }
  ].concat(G.weaponCondEffects(ev, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  const inst = state.combatants.victim.conds.filter(c => c.tag === 'DoT')[0];
  assert.ok(inst, 'DoT instance landed with the hit');
  assert.strictEqual(inst.src, 'Eviscerator');
  assert.strictEqual(inst.by, 'atk');
  const before = state.combatants.victim.w[0];
  THREAD.tickConds('B', state, canon);
  assert.strictEqual(state.combatants.victim.w[0], before - 1, 'DoT I bites 1 on the victim\'s post');
});

test('riders: the Forge NL+DoT combo is live — a Non-Lethal DoT weapon floors its ticks at 1 wound (ruling 1a)', () => {
  const slaver = { n: 'Slaver Flail', cat: 'WEAPON', d: 'Phys 2 - Melee - 1 AP - DoT II - Non-Lethal' };
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B', w: [2, 10] }) } };
  const block = [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'victim', amount: 0, element: 'Physical', nonLethal: true, weapon: slaver.n, band: 'MELEE' } }]
    .concat(G.weaponCondEffects(slaver, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  const inst = state.combatants.victim.conds.filter(c => c.tag === 'DoT')[0];
  assert.strictEqual(inst.nl, true, 'nl stamped from the rider\'s add.item');
  THREAD.tickConds('B', state, canon);
  THREAD.tickConds('B', state, canon);
  assert.strictEqual(state.combatants.victim.w[0], 1, 'floored at 1 — captureable, never killed');
  assert.ok(!state.combatants.victim.dead);
});

test('riders: an Agoniser (Suppressing + Non-Lethal) pin costs the victim an action next post', () => {
  const ag = gear('weapons', 'Agoniser');
  const state = { pools: { A: 9, B: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B' }) } };
  const block = [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'victim', amount: 2, element: 'Energy', nonLethal: true, weapon: ag.n, band: 'MELEE' } }]
    .concat(G.weaponCondEffects(ag, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  assert.strictEqual(THREAD.actionCap(state.combatants.victim, canon), 2, 'Suppressing I: 3 → 2 actions');
});

/* ── Task 4: NPC rider parity ── */

test('npcTurn: a cond-tagged weapon cap stages a hostile rider behind the attack', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical',
    nonLethal: true, noRevival: false, conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [12, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  const rider = block.find(b => b.effect && b.effect.kind === 'cond');
  assert.ok(rider, 'rider staged');
  assert.strictEqual(rider.fanout, true);
  assert.strictEqual(rider.cost, 0);
  assert.deepStrictEqual(
    { tag: rider.effect.add.tag, tier: rider.effect.add.tier, nl: rider.effect.add.nl, band: rider.effect.add.band, to: rider.effect.to },
    { tag: 'Slowing', tier: 2, nl: true, band: 'SHORT', to: 'hero' });
  assert.ok(block.indexOf(block.find(b => b.effect.kind === 'damage')) < block.indexOf(rider),
    'rider follows its attack');
});

test('npcTurn riders: block passes validate and the victim is Slowed after apply', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical',
    nonLethal: true, conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, board, fog: {}, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [12, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'B');
  const inst = state.combatants.hero.conds.filter(c => c.tag === 'Slowing')[0];
  assert.ok(inst, 'Slowing landed');
  assert.strictEqual(inst.nl, true);
  assert.strictEqual(THREAD.condMods(state.combatants.hero).speed, -2);
});

test('npcTurn riders: obeys the action cap — riders are free, the attack still counts once', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical', conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [1, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },   // Critical: cap 1
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  assert.strictEqual(block.filter(b => b.effect.kind === 'damage').length, 1);
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
});
