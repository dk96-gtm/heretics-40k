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
