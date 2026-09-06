const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');
const { loadCondGlue } = require('./_condglue');
const D = require('../heretics-40k-data-v1.json');

// T-NPC-3.5 task 6: node-level coverage for the engine glue that CAN be extracted (kitOfFor
// lives inside the /*<cond-staging-glue>*/ region _condglue.js already loads for real, with
// THREAD wired in). genHostCombatants/seedCombat/mintNpcClock/mintDrama read D/S/ULT/KIT as
// bare globals and boot a full save-state to reach — not reachable through this extraction
// technique; those are covered by tests/engine-syntax.test.js (compiles) + the task-6 report's
// browser E2E (actually spawns, mints, and drains a kit live).

const THREAD = loadThread();
const G = loadCondGlue(THREAD);

function kitCombatant(kit, usedKit) {
  return { gen: { kit: kit }, usedKit: usedKit || {} };
}

const BLIGHT_GRENADE = { n: 'Blight Grenade', cat: 'ITEM',
  d: 'Phys 2 - Short - Multihit II - DoT I - 1 AP - Consumable', pc: 6, faction: 'death_guard' };
const BRING_IT_DOWN = { n: 'Bring It Down', cat: 'ABILITY',
  d: 'Apply Marked I to an Armament model - 1 AP - CD 2', pc: 8, faction: null };
const TELEKINETIC_GRIP = { n: 'Telekinetic Grip', cat: 'CAST',
  d: 'R2 - Target: Slowing II + Suppressing I - 2 AP - CD 2', pc: 10, faction: null };
const STIMM_INJECTOR = { n: 'Stimm-Injector', cat: 'ITEM',
  d: 'Stimm - 1 AP - Consumable', pc: 5, faction: null }; // no cond tag → never a kitOf entry

test('kitOfFor: a player model (no gen.kit) always gets []', () => {
  const kitOf = G.kitOfFor({});
  assert.deepStrictEqual(kitOf({ model: { n: 'Kane' } }), []);
  assert.deepStrictEqual(kitOf(null), []);
});

test('kitOfFor: kind derives from cat (CAST/ABILITY/ITEM), ap via apMod, payload via condTagsOf+condIsHostile', () => {
  const kitOf = G.kitOfFor({});
  const c = kitCombatant({ items: [BLIGHT_GRENADE], abilities: [BRING_IT_DOWN], casts: [TELEKINETIC_GRIP] });
  const entries = kitOf(c);
  assert.strictEqual(entries.length, 3, 'all three carry a stageable cond tag');

  const grenade = entries.filter(e => e.item.n === 'Blight Grenade')[0];
  assert.strictEqual(grenade.kind, 'item');
  assert.strictEqual(grenade.ap, 1); // explicit "1 AP" wins over the ITEM default of 0
  assert.strictEqual(grenade.consumed, true); // ITEM + /consumable|stimm|grenade/i on its `d`
  assert.strictEqual(grenade.payload.length, 1);
  assert.strictEqual(grenade.payload[0].tag, 'DoT');
  assert.strictEqual(grenade.payload[0].hostile, true);
  assert.strictEqual(grenade.payload[0].el, 'Physical');

  const ability = entries.filter(e => e.item.n === 'Bring It Down')[0];
  assert.strictEqual(ability.kind, 'ability');
  assert.strictEqual(ability.ap, 1); // explicit "1 AP"
  assert.strictEqual(ability.consumed, false); // never consumed — not an ITEM-kind row
  assert.strictEqual(ability.payload[0].tag, 'Marked');
  assert.strictEqual(ability.payload[0].hostile, true);

  const cast = entries.filter(e => e.item.n === 'Telekinetic Grip')[0];
  assert.strictEqual(cast.kind, 'cast');
  assert.strictEqual(cast.ap, 2);
  assert.strictEqual(cast.consumed, false);
  assert.strictEqual(cast.payload.length, 2); // Slowing II + Suppressing I
  assert.ok(cast.payload.every(p => p.hostile === true));
});

test('kitOfFor: a kit row with no stageable cond tag is dropped entirely (not a pair)', () => {
  const kitOf = G.kitOfFor({});
  const c = kitCombatant({ items: [STIMM_INJECTOR], abilities: [], casts: [] });
  assert.deepStrictEqual(kitOf(c), []);
});

test('kitOfFor: c.usedKit filters an entry out by name — depletion contract', () => {
  const kitOf = G.kitOfFor({});
  const c = kitCombatant({ items: [BLIGHT_GRENADE], abilities: [BRING_IT_DOWN], casts: [] },
    { 'Blight Grenade': true });
  const entries = kitOf(c);
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].item.n, 'Bring It Down');
});

test('_kitApMod mirrors THREAD apMod exactly (CAST 2 / ABILITY 1 / ITEM 0, effortless → 0, explicit AP wins)', () => {
  assert.strictEqual(G._kitApMod({ cat: 'CAST', d: 'no AP text here' }), 2);
  assert.strictEqual(G._kitApMod({ cat: 'ABILITY', d: 'no AP text here' }), 1);
  assert.strictEqual(G._kitApMod({ cat: 'ITEM', d: 'no AP text here' }), 0);
  assert.strictEqual(G._kitApMod({ cat: 'CAST', d: 'effortless — always on' }), 0);
  assert.strictEqual(G._kitApMod({ cat: 'ITEM', d: '3 AP - Consumable' }), 3);
});

// npcSpecRk lives outside the cond-staging-glue region (beside genHostCombatants) and is
// self-contained (reads only its own params, no engine globals) — extract it standalone.
function loadNpcSpecRk() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/function npcSpecRk[\s\S]*?\n}\n/);
  if (!m) throw new Error('npcSpecRk not found in index.html');
  const vm = require('node:vm');
  return vm.runInThisContext('(function(){' + m[0] + '\n;return npcSpecRk;})()');
}
const npcSpecRk = loadNpcSpecRk();

test('npcSpecRk: an explicit spec.rk always wins', () => {
  assert.strictEqual(npcSpecRk({ models: [] }, { rk: 4 }, D), 4);
});

test('npcSpecRk: an unscaled generic spawn (ratio 1.0) resolves to rank 1', () => {
  const fac = { models: [{ n: 'Legionary', cls: 'Core', pc: 20 }] };
  const spec = { n: 'Legionary 1', sub: 'Legionary — hostile', pc: 20 };
  assert.strictEqual(npcSpecRk(fac, spec, D), 1);
});

test('npcSpecRk: a named boss (1.5x pc premium) resolves to the nearest curve rank (2)', () => {
  const fac = { models: [{ n: 'Legionary', cls: 'Core', pc: 20 }] };
  const spec = { n: 'Some Warlord', sub: 'Legionary — named target', pc: 30 };
  assert.strictEqual(npcSpecRk(fac, spec, D), 2);
});

test('npcSpecRk: no matching canonical row → defaults to rank 1', () => {
  const fac = { models: [{ n: 'Legionary', cls: 'Core', pc: 20 }] };
  const spec = { n: 'Ghost', sub: 'Nobody Here — hostile', pc: 99 };
  assert.strictEqual(npcSpecRk(fac, spec, D), 1);
});
