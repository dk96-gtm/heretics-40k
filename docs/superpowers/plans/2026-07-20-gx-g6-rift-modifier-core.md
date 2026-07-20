# T-GX-G6 Slice 1 — Rift Home/Away Modifier Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the locked §4.1 Rift "home/away" model — a pure modifier core plus its first live hook (the production-flywheel coupling) — so a faction's heartland is measurably richer and its cross-Rift expeditions measurably costlier.

**Architecture:** A new pure, DOM-free `RIFT` core region inside `index.html` (mirroring the `THREAD`/`LOADOUT`/`WORLD` cores) computes a Force's *standing* at a location (`home`/`away`/`neutral`) and the corresponding *modifiers*, reading magnitudes from a new `canon.rules.rift` block. The `WORLD` day-tick production stream then multiplies the owner's home bonus into accrual — the emergent §4.1 loop. Travel/comms/muster/requisition hooks follow in later steps but are stubbed here via the same `RIFT.mods` return shape so they are one-line consumers later.

**Tech Stack:** Vanilla ES5-style JS (match the existing cores), Node's built-in test runner (`node --test`, zero deps), the `tests/_load.js` region-extractor pattern.

## Global Constraints

- Terminology law: always "model", never "chassis" — applies to all copy/comments.
- Canon changes bump `meta.version`; filename stays `heretics-40k-data-v1.json`.
- The pure core reads NO globals — canon + state arrive as arguments (matches `THREAD`).
- **BUILD LAW:** extend shipped systems. The production hook couples into the EXISTING `WORLD.catchUp` tick stream (canon v1.11) — do not add a parallel accrual path.
- Neutral factions (never suffer the away penalty; home only in sectors they own): **Genestealer Cults, Necrons, Harlequins, Drukhari** (verbatim faction names from `D.factions`).
- Magnitudes (locked, tunable): HOME → comms +1 tier, travel −25%, muster −25%, revival +1, production +25%. AWAY → comms −1 tier, travel +25%, muster +25%, revival −1, requisition +25%. Home swaps away's requisition surcharge for the production bonus (never double-levered).
- Dev-only `tests/` — never shipped. Only `index.html` + the JSON deploy.

---

### Task 1: Canon `rules.rift` block

**Files:**
- Modify: `heretics-40k-data-v1.json` (add `rules.rift`, bump `meta.version`)
- Test: `tests/canon.test.js` (append)

**Interfaces:**
- Produces: `canon.rules.rift = { neutral_factions:[...], home:{comms_tier,travel_mult,muster_mult,revival_delta,prod_mult}, away:{comms_tier,travel_mult,muster_mult,revival_delta,req_mult} }`

- [ ] **Step 1: Write the failing test**

```js
test('rules.rift: home/away magnitudes + neutral factions present', () => {
  const r = canon.rules.rift;
  assert.ok(r, 'rules.rift exists');
  assert.deepStrictEqual(r.neutral_factions.sort(),
    ['Drukhari', 'Genestealer Cults', 'Harlequins', 'Necrons'].sort());
  assert.strictEqual(r.home.prod_mult, 1.25);
  assert.strictEqual(r.away.travel_mult, 1.25);
  assert.strictEqual(r.home.comms_tier, 1);
  assert.strictEqual(r.away.comms_tier, -1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL — `rules.rift exists` (r is undefined).

- [ ] **Step 3: Add the canon block**

In `heretics-40k-data-v1.json`, inside `rules`, add:

```json
"rift": {
  "neutral_factions": ["Genestealer Cults", "Necrons", "Harlequins", "Drukhari"],
  "home": { "comms_tier": 1, "travel_mult": 0.75, "muster_mult": 0.75, "revival_delta": 1, "prod_mult": 1.25 },
  "away": { "comms_tier": -1, "travel_mult": 1.25, "muster_mult": 1.25, "revival_delta": -1, "req_mult": 1.25 }
}
```

Bump `meta.version` to the next patch (e.g. `1.15` → `1.16`) and update the `canon is vX` version test accordingly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon: add rules.rift home/away magnitudes (T-GX-G6 slice 1)"
```

---

### Task 2: `RIFT.standing` — pure home/away/neutral resolver

**Files:**
- Modify: `index.html` (new `/*<rift-core>*/ … /*</rift-core>*/` region; export `RIFT`)
- Test: `tests/_load-rift.js` (region loader, copy of `_load.js` pattern), `tests/rift-core.test.js`

**Interfaces:**
- Consumes: `canon.rules.rift`, `canon.allegiances` (for side lookup)
- Produces: `RIFT.standing(force, loc, sector, canon) → 'home' | 'away' | 'neutral'` where `force = {faction, allegiance, side}` (side = 'Sanctus'|'Nihilus'|null), `loc = {rift}` (side tag), `sector = {owner}` (`"<Allegiance> - <Faction>"`).

Rules (from §4.1):
- Neutral faction (in `rift.neutral_factions`): `home` iff it owns `sector` (owner faction === force.faction); else `neutral` (never `away`).
- Sided faction (has `force.side`): `home` iff `loc.rift === force.side`; `away` iff `loc.rift` is the opposite side; else `neutral`.
- Entering a **neutral-owned** sector (owner faction is a neutral faction and not the force's own): `away` for everyone (neutral turf is hostile to all visitors) — this overrides a sided faction's home.

- [ ] **Step 1: Write the failing test**

```js
const canon = { rules: { rift: { neutral_factions: ['Necrons','Genestealer Cults','Harlequins','Drukhari'] } } };
test('standing: sided faction is home on its own side', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Imperial - Adepta Sororitas' }, canon), 'home');
});
test('standing: sided faction is away across the Rift', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Nihilus' }, { owner: 'Chaos - Black Legion' }, canon), 'away');
});
test('standing: neutral faction is home only in a sector it owns', () => {
  const f = { faction: 'Necrons', side: null };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Xenos - Necrons' }, canon), 'home');
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Imperial - Adepta Sororitas' }, canon), 'neutral');
});
test('standing: a neutral-owned sector is away for a sided visitor', () => {
  const f = { faction: 'Adepta Sororitas', side: 'Sanctus' };
  assert.strictEqual(RIFT.standing(f, { rift: 'Sanctus' }, { owner: 'Xenos - Necrons' }, canon), 'away');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/rift-core.test.js`
Expected: FAIL — `RIFT` / `RIFT.standing` is not defined.

- [ ] **Step 3: Write minimal implementation**

Add a `/*<rift-core>*/` region in `index.html` near the `THREAD` core:

```js
/*<rift-core>*/
var RIFT=(function(){
  function ownerFaction(sector){ // "<Allegiance> - <Faction>" → faction
    var o=(sector&&sector.owner)||''; var i=o.indexOf(' - '); return i<0?'':o.slice(i+3);
  }
  function isNeutral(faction,canon){
    var n=(canon.rules.rift&&canon.rules.rift.neutral_factions)||[];
    return n.indexOf(faction)>=0;
  }
  function standing(force,loc,sector,canon){
    var of=ownerFaction(sector);
    // neutral-owned sector = hostile ground to every non-owner visitor
    if(isNeutral(of,canon)&&of!==force.faction) return 'away';
    if(isNeutral(force.faction,canon)) return of===force.faction ? 'home' : 'neutral';
    if(force.side){
      if(loc&&loc.rift===force.side) return 'home';
      if(loc&&loc.rift&&loc.rift!==force.side) return 'away';
    }
    return 'neutral';
  }
  return { standing:standing };
})();
/*</rift-core>*/
```

Create `tests/_load-rift.js` mirroring `tests/_load.js` but extracting the `rift-core` region and returning `RIFT`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/rift-core.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/_load-rift.js tests/rift-core.test.js
git commit -m "rift-core: pure home/away/neutral standing resolver (T-GX-G6 slice 1)"
```

---

### Task 3: `RIFT.mods` — standing → effect modifiers

**Files:**
- Modify: `index.html` (`rift-core` region)
- Test: `tests/rift-core.test.js` (append)

**Interfaces:**
- Consumes: `canon.rules.rift`
- Produces: `RIFT.mods(standing, canon) → { commsTier, travelMult, musterMult, revivalDelta, prodMult, reqMult }` — `home` uses `prodMult:1.25, reqMult:1`; `away` uses `reqMult:1.25, prodMult:1`; `neutral` is all-neutral (1s and 0s).

- [ ] **Step 1: Write the failing test**

```js
const C = { rules: { rift: {
  home: { comms_tier:1, travel_mult:0.75, muster_mult:0.75, revival_delta:1, prod_mult:1.25 },
  away: { comms_tier:-1, travel_mult:1.25, muster_mult:1.25, revival_delta:-1, req_mult:1.25 } } } };
test('mods: home gives the production bonus, no requisition surcharge', () => {
  const m = RIFT.mods('home', C);
  assert.strictEqual(m.prodMult, 1.25);
  assert.strictEqual(m.reqMult, 1);
  assert.strictEqual(m.commsTier, 1);
});
test('mods: away gives the requisition surcharge, no production bonus', () => {
  const m = RIFT.mods('away', C);
  assert.strictEqual(m.reqMult, 1.25);
  assert.strictEqual(m.prodMult, 1);
  assert.strictEqual(m.travelMult, 1.25);
});
test('mods: neutral is all-neutral', () => {
  const m = RIFT.mods('neutral', C);
  assert.deepStrictEqual(m, { commsTier:0, travelMult:1, musterMult:1, revivalDelta:0, prodMult:1, reqMult:1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/rift-core.test.js`
Expected: FAIL — `RIFT.mods is not a function`.

- [ ] **Step 3: Write minimal implementation**

Inside the `rift-core` IIFE, add and export `mods`:

```js
function mods(st,canon){
  var R=canon.rules.rift;
  if(st==='home')  return { commsTier:R.home.comms_tier, travelMult:R.home.travel_mult, musterMult:R.home.muster_mult, revivalDelta:R.home.revival_delta, prodMult:R.home.prod_mult, reqMult:1 };
  if(st==='away')  return { commsTier:R.away.comms_tier, travelMult:R.away.travel_mult, musterMult:R.away.muster_mult, revivalDelta:R.away.revival_delta, prodMult:1, reqMult:R.away.req_mult };
  return { commsTier:0, travelMult:1, musterMult:1, revivalDelta:0, prodMult:1, reqMult:1 };
}
// …add mods to the returned object: return { standing:standing, mods:mods };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/rift-core.test.js`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/rift-core.test.js
git commit -m "rift-core: standing→modifiers map (T-GX-G6 slice 1)"
```

---

### Task 4: Couple the home production bonus into the WORLD tick (the flywheel)

**Files:**
- Modify: `index.html` — the `WORLD` production accrual (the `/*<world-core>*/` region's per-sector production step) OR its engine caller if the per-owner faction is only known at the call site.
- Test: `tests/world-core.test.js` (append)

**Interfaces:**
- Consumes: `RIFT.mods('home',canon).prodMult`, the sector's `owner`, the per-sector `rift`/side.
- Produces: production accrual for a sector owned by a faction *on its home side* is multiplied by `prodMult` (1.25); away/neutral unchanged.

**Design note:** `WORLD.catchUp` currently accrues flat `production_per_day`. Extend its per-sector production so an owner-on-home-side sector yields `base × RIFT.mods('home').prodMult`. Pass the rift-multiplier in via the canon/state already available to the tick — do NOT reach into DOM. If `WORLD` cannot see faction sides, compute the per-sector multiplier at the engine caller and pass it into `catchUp` as part of the sector production input (keep `WORLD` pure).

- [ ] **Step 1: Write the failing test**

```js
test('tick: an owner-on-home-side sector accrues +25% production', () => {
  // two identical sectors, one flagged home (prodMult 1.25), one neutral (1.0)
  const state = seedTwoSectorState(); // helper: home sector 'h', neutral sector 'n', equal base
  const canon = tickCanonWithRift(); // production_per_day set, rules.rift present
  WORLD.catchUp(state, canon, ONE_DAY_MS);
  assert.ok(state.sectors.h.resources > state.sectors.n.resources,
    'home-side production outpaced neutral for the same base');
  assert.strictEqual(
    Math.round(state.sectors.h.resources / state.sectors.n.resources * 100) / 100, 1.25);
});
```

(Author `seedTwoSectorState`/`tickCanonWithRift` helpers in the test file to match the real `WORLD.catchUp` state shape — read the existing `tests/world-core.test.js` seed helpers and mirror them.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/world-core.test.js`
Expected: FAIL — home and neutral accrue equally (ratio 1.0, not 1.25).

- [ ] **Step 3: Write minimal implementation**

In the `WORLD` production step, multiply a sector's per-day production by its `riftProdMult` (default 1). The engine caller computes `riftProdMult = RIFT.standing(ownerForce, ..., sector, canon)==='home' ? RIFT.mods('home',canon).prodMult : 1` and stores it on the sector (or passes it into `catchUp`). Keep `WORLD` pure: it reads a number, it does not know about factions.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/world-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/world-core.test.js
git commit -m "world+rift: home-side production +25% flywheel coupling (T-GX-G6 slice 1)"
```

---

## Follow-on slices (separate plans)

- **§4.1 remaining hooks** — travel word-count/passage (`passageCost` ×`travelMult`), comms range (±`commsTier`), muster & apothecarion cost (×`musterMult`, revival ±`revivalDelta`), `doorCatalog` pricing (×`reqMult`). Each is a one-line consumer of `RIFT.mods` at its existing hook — a task apiece.
- **§4.2 home-turf ruling trait** — parameterised ruler-keyed rule (generalise the Drukhari forge-access precedent): F-aligned discount/affinity, hostile surcharge + interception, same-allegiance baseline.
- **§4.3 arrival & garrison** — contested-descent Travel Thread branch + the economy-coupled garrison-strength formula (pop_ceiling + prod_mult + hoard/divisor × fortification × sector-status).

## Verification (whole slice)

- `node --test` fully green (rift-core + canon + world-core suites).
- Browser: load a combat/travel flow at a home-side vs cross-Rift location; confirm 0 console errors and that the tick digest shows the richer home accrual. (Deferred if the shared browser is held — note it in the backlog row.)

## Blocking note

T-GX-G6 is `blocked` until galaxy authoring **G5 (Ultima)** lands (needs the full sector/owner/rift data) AND the 🔥 engine lane frees (Tasks 2–4 touch `index.html`). Task 1 (canon-only) can land as soon as the canon lane frees after G5. Execute top-down when unblocked.
