const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('N1: rules.ultimatum carries the locked bands + scale mapping', () => {
  const u = canon.rules.ultimatum;
  assert.deepStrictEqual(u.bands, { raid: [4, 8], skirmish: [8, 16], invasion: [12, 24] });
  assert.deepStrictEqual(u.scale_of, { SKIRMISH: 'raid', INVASION: 'invasion' });
  assert.strictEqual(u.defender_mult, 1.25);
  assert.ok(Number.isInteger(u.garrison_pc_per_level) && u.garrison_pc_per_level > 0);
  assert.ok(u.outcome.loss_margin > 0 && u.outcome.decisive_margin > 0);
});
test('N1: the 4 ladder conditions carry the locked garrison_mult', () => {
  const gm = {};
  canon.galaxy.conditions.forEach(c => { if (c.garrison_mult !== undefined) gm[c.id] = c.garrison_mult; });
  assert.deepStrictEqual(gm, { fortified: 1.25, intact: 1.0, sacked: 0.6, ruined: 0.3 });
});
test('N1: heal pacing blocks Warring/Famine, runs elsewhere', () => {
  const h = canon.rules.ultimatum.heal.days_per_step;
  assert.strictEqual(h.Warring, 0);
  assert.strictEqual(h.Famine, 0);
  ['Thriving', 'Peace', 'Corrupted'].forEach(k => assert.ok(h[k] > 0, k));
});
test('N1: faction_appetite covers exactly the 20 canon faction ids', () => {
  const ids = canon.factions.map(f => f.id).sort();
  const keys = Object.keys(canon.rules.ultimatum.tribute.faction_appetite).sort();
  assert.deepStrictEqual(keys, ids);
  keys.forEach(k => { const v = canon.rules.ultimatum.tribute.faction_appetite[k];
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, k); });
});
test('N1: rebuild mission repairs the condition (+1 step)', () => {
  const row = canon.missions.universal.filter(m => m.id === 'rebuild' || m.mid === 'rebuild' || /rebuild/i.test(m.n || m.name || ''))[0];
  assert.ok(row, 'rebuild row exists');
  assert.strictEqual(row.world_effect.repair_step, 1);
  assert.strictEqual(row.world_effect.prosperity, 4);
});
