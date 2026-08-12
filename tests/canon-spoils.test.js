const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('canon v1.21: Non-Lethal weapon tag registered', () => {
  const t = D.tags.weapon.find(x => x.tag === 'Non-Lethal');
  assert.ok(t, 'Non-Lethal missing from tags.weapon');
  assert.match(t.mechanic, /below 1 wound/i);
});
test('canon v1.21: Capture item tag registered with 3 AP tiers', () => {
  const t = D.tags.item.find(x => x.tag === 'Capture');
  assert.ok(t, 'Capture missing from tags.item');
  assert.strictEqual(t.tiers.length, 3);
});
test('canon v1.21: rules.spoils block complete', () => {
  const s = D.rules.spoils;
  assert.deepStrictEqual(s.capture_ap_by_tier, { I: 3, II: 2, III: 1 });
  assert.strictEqual(s.capture_range, 1);
  assert.strictEqual(s.capture_target_wounds, 1);
  assert.strictEqual(s.loot_ap, 1);
  assert.strictEqual(s.free_captive_ap, 1);
  assert.deepStrictEqual(s.sell_mult, { REMAINS: 0.5, CAPTIVE: 1.0 });
});
test('canon v1.21: retrofits carry Non-Lethal', () => {
  ['Agoniser', 'Webber', 'Concussion Maul'].forEach(n => {
    const w = D.weapons.find(x => x.n === n);
    assert.ok(w && /Non-Lethal/.test(w.d), n + ' lacks Non-Lethal');
  });
});
test('canon v1.21: minted gear exists', () => {
  const sm = D.weapons.find(x => x.n === 'Shock Maul');
  assert.ok(sm && !sm.faction && /Non-Lethal/.test(sm.d));
  const sh = D.items.find(x => x.n === 'Shackles');
  assert.ok(sh && !sh.faction && /Capture I(?!I)/.test(sh.d));
  const sn = D.items.find(x => x.n === "Slaver's Snare");
  assert.ok(sn && sn.faction === 'drukhari' && /Capture II(?!I)/.test(sn.d));
  const ak = D.items.find(x => x.n === 'Abduction Kit');
  assert.ok(ak && ak.faction === 'gsc' && /Capture II(?!I)/.test(ak.d));
});
test('canon v1.21: forge affinities + version bump', () => {
  assert.ok(D.equipment_alpha.forge_affinities.drukhari.includes('Non-Lethal'));
  assert.ok(D.equipment_alpha.forge_affinities.gsc.includes('Non-Lethal'));
  assert.strictEqual(D.meta.version, '1.35');
});
