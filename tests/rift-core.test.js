const test = require('node:test');
const assert = require('node:assert');
const { loadRift } = require('./_load-rift');

const RIFT = loadRift();

/* ── T-GX-G6 slice 1 · pure Rift home/away/neutral resolver ───────────
   standing(force, loc, sector, canon) → 'home' | 'away' | 'neutral'
   force  = { faction, side: 'Sanctus'|'Nihilus'|null }
   loc    = { rift: 'Sanctus'|'Nihilus' }   sector = { owner: "<Alleg> - <Faction>" } */

const canon = { rules: { rift: { neutral_factions: ['Necrons', 'Genestealer Cults', 'Harlequins', 'Drukhari'] } } };

test('standing: a sided faction is HOME on its own side', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Imperial - Adepta Sororitas' }, canon), 'home');
});

test('standing: a sided faction is AWAY across the Rift', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Nihilus' }, { owner: 'Chaos - Black Legion' }, canon), 'away');
});

test('standing: a neutral faction is HOME only in a sector it owns, else NEUTRAL', () => {
  const f = { faction: 'Necrons', side: null };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Xenos - Necrons' }, canon), 'home');
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Imperial - Adepta Sororitas' }, canon), 'neutral');
});

test('standing: a neutral-owned sector is AWAY for a sided visitor (hostile turf to all)', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Xenos - Necrons' }, canon), 'away');
});

// ── mods(standing, canon) → effect multipliers ──
const modCanon = { rules: { rift: {
  home: { comms_tier: 1, travel_mult: 0.75, muster_mult: 0.75, revival_delta: 1, prod_mult: 1.25 },
  away: { comms_tier: -1, travel_mult: 1.25, muster_mult: 1.25, revival_delta: -1, req_mult: 1.25 } } } };

test('mods: home gives the production bonus, no requisition surcharge', () => {
  const m = RIFT.mods('home', modCanon);
  assert.strictEqual(m.prodMult, 1.25);
  assert.strictEqual(m.reqMult, 1);
  assert.strictEqual(m.commsTier, 1);
  assert.strictEqual(m.travelMult, 0.75);
});

test('mods: away gives the requisition surcharge, no production bonus', () => {
  const m = RIFT.mods('away', modCanon);
  assert.strictEqual(m.reqMult, 1.25);
  assert.strictEqual(m.prodMult, 1);
  assert.strictEqual(m.travelMult, 1.25);
  assert.strictEqual(m.revivalDelta, -1);
});

test('mods: neutral is all-neutral', () => {
  assert.deepStrictEqual(RIFT.mods('neutral', modCanon),
    { commsTier: 0, travelMult: 1, musterMult: 1, revivalDelta: 0, prodMult: 1, reqMult: 1 });
});
