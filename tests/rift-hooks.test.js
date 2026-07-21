const test = require('node:test');
const assert = require('node:assert');
const { loadRift } = require('./_load-rift');

const RIFT = loadRift();

/* ── T-RIFT-1b · felt hooks: the two "one-line consumer" seams ─────────
   travelCost(base, force, loc, sector, canon) → round(base × travelMult)
   reqPrice (base, force, loc, sector, canon)  → round(base × reqMult)
   Both compose standing()→mods() so the engine hook stays a single call.
   loc carries .rift (in the live game that is the PLANET object); sector .owner. */

const canon = { rules: { rift: {
  neutral_factions: ['Necrons', 'Genestealer Cults', 'Harlequins', 'Drukhari'],
  home: { comms_tier: 1, travel_mult: 0.75, muster_mult: 0.75, revival_delta: 1, prod_mult: 1.25 },
  away: { comms_tier: -1, travel_mult: 1.25, muster_mult: 1.25, revival_delta: -1, req_mult: 1.25 } } } };

const sororitas = { faction: 'Adepta Sororitas', side: 'Sanctus' };
const homeLoc = { rift: 'Sanctus' }, awayLoc = { rift: 'Nihilus' };
const ownSector = { owner: 'Imperial - Adepta Sororitas' };
const foeSector = { owner: 'Chaos - Black Legion' };

// ── travelCost ──
test('travelCost: home-side passage is 25% cheaper (100 → 75)', () => {
  assert.strictEqual(RIFT.travelCost(100, sororitas, homeLoc, ownSector, canon), 75);
});

test('travelCost: cross-Rift passage is 25% dearer (100 → 125)', () => {
  assert.strictEqual(RIFT.travelCost(100, sororitas, awayLoc, foeSector, canon), 125);
});

test('travelCost: rounds to a whole cost (10 home → 8)', () => {
  assert.strictEqual(RIFT.travelCost(10, sororitas, homeLoc, ownSector, canon), 8);
});

test('travelCost: a zero/undefined base stays 0', () => {
  assert.strictEqual(RIFT.travelCost(0, sororitas, homeLoc, ownSector, canon), 0);
  assert.strictEqual(RIFT.travelCost(undefined, sororitas, awayLoc, foeSector, canon), 0);
});

// ── reqPrice ──
test('reqPrice: cross-Rift requisition is 25% dearer (40 → 50)', () => {
  assert.strictEqual(RIFT.reqPrice(40, sororitas, awayLoc, foeSector, canon), 50);
});

test('reqPrice: home requisition has NO surcharge (away tax only — 40 → 40)', () => {
  assert.strictEqual(RIFT.reqPrice(40, sororitas, homeLoc, ownSector, canon), 40);
});

test('reqPrice: rounds to a whole price (7 away → 9)', () => {
  assert.strictEqual(RIFT.reqPrice(7, sororitas, awayLoc, foeSector, canon), 9);
});

// ── neutral ground: no modifier either way ──
test('neutral standing leaves both hooks at the base cost', () => {
  const necron = { faction: 'Necrons', side: null };
  const neutralHome = { rift: 'Sanctus' }, unowned = { owner: 'Imperial - Astra Militarum' };
  // sided visitor on unowned imperial turf that isn't its own side owner → neutral for the necron
  assert.strictEqual(RIFT.travelCost(100, necron, neutralHome, unowned, canon), 100);
  assert.strictEqual(RIFT.reqPrice(40, necron, neutralHome, unowned, canon), 40);
});
