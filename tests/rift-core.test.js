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
