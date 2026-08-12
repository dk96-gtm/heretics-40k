# T-TERR-2 — Seats, Trust & Standing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Commander-held seats on own-faction planets — standing ledger, WORK trust, petition/price, tick income, stationing with real casualties, and planetary buyout — per the locked spec `docs/superpowers/specs/2026-08-09-seats-trust-standing-design.md`.

**Architecture:** Canon v1.34 adds `rules.standing` (20×20 matrix) + `rules.seats`; a new pure `/*<seat-core>*/` region in `index.html` (DOM-free, no `Date.now()`/`Math.random()`, same discipline as `agency-core`) holds all seat/standing/casualty math; thin engine glue wires founding/init seeding, the Throne-Room petition panel, tick income, stationing into the N1 lapse path, and buyout.

**Tech Stack:** Vanilla ES5 in `index.html`, JSON canon, Node built-in test runner (`node --test`), Playwright MCP for browser E2E.

## Global Constraints

- It is always **"model"**, never "chassis" — all copy, code, data.
- Canon changes go in `heretics-40k-data-v1.json` + bump `meta.version` to `"1.34"`. Engine changes go in `index.html` only.
- Pure-core regions read NO globals: canon/state arrive as arguments; NO `Date.now()` / `Math.random()` inside.
- New `S.world` keys must be seeded in BOTH `foundingWorld()` (`index.html:2621`) and `init()` backfills (`index.html:~4915`). `S.world.standing` needs the player faction, so it seeds in `commitFounding` + `init()` instead — see Task 4.
- `git add <explicit paths>` only — NEVER `git add -A`. Keep `node --test` green at every commit. Do not push (Daak pushes).
- Baseline: **579/579 tests pass** before Task 1. Every engine task ends with a browser E2E sweep (`python3 -m http.server 8765`, Playwright, `window._noPersist=true` FIRST, 0 console errors).
- ES5 style (`var`, `function`), match surrounding idiom.

---

### Task 1: Canon v1.34 — `rules.standing` + `rules.seats` + crown-world audit

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version`, `rules.standing`, `rules.seats`, 2 crown designations)
- Create: `tests/canon-standing.test.js`, `tests/canon-seats.test.js`
- Modify: `tests/canon.test.js` (version pin `1.33` → `1.34`)

**Interfaces:**
- Produces: `D.rules.standing = {ladder, matrix, kin_raid_floor, own_seed}` and `D.rules.seats = {base_by_type, work_gates, not_seatable, tax, upkeep, casualties, buyout, work_earn}` — every later task reads these exact keys.

- [ ] **Step 1: Write the failing canon guard tests**

`tests/canon-standing.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

const FACS = D.factions.map(f => f.id);

test('rules.standing exists with ladder, matrix, floors', () => {
  const st = D.rules.standing;
  assert.ok(st, 'rules.standing missing');
  assert.strictEqual(st.ladder.length, 6);
  const values = st.ladder.map(r => r.value).sort((a,b)=>a-b);
  assert.deepStrictEqual(values, [-3,-2,-1,0,1,2]);
  assert.strictEqual(st.kin_raid_floor, -3);
  assert.strictEqual(st.own_seed, 2);
});

test('matrix is exactly 20×19, symmetric, no self-cells, all values on the ladder', () => {
  const m = D.rules.standing.matrix;
  assert.deepStrictEqual(Object.keys(m).sort(), FACS.slice().sort());
  for (const a of FACS) {
    const row = m[a];
    assert.strictEqual(Object.keys(row).length, 19, a + ' row must have 19 cells');
    assert.ok(!(a in row), a + ' must not have a self-cell');
    for (const b of Object.keys(row)) {
      assert.ok(FACS.includes(b), a + ' has unknown faction ' + b);
      assert.ok([-3,-2,-1,0,1,2].includes(row[b]), a + '↔' + b + ' off-ladder: ' + row[b]);
      assert.strictEqual(m[b][a], row[b], a + '↔' + b + ' asymmetric');
    }
  }
});

test('the 13 authored lore calls hold', () => {
  const m = D.rules.standing.matrix;
  assert.strictEqual(m.world_eaters.emperors_children, -2);   // Skalathrax
  assert.strictEqual(m.world_eaters.thousand_sons, -1);
  assert.strictEqual(m.emperors_children.aeldari, -3);         // She Who Thirsts
  assert.strictEqual(m.daemons.harlequins, -3);
  assert.strictEqual(m.drukhari.emperors_children, -3);
  assert.strictEqual(m.drukhari.daemons, -2);
  assert.strictEqual(m.mechanicus.sororitas, 1);
  assert.strictEqual(m.mechanicus.votann, -2);
  assert.strictEqual(m.tyranids.gsc, 2);
  assert.strictEqual(m.orks.tyranids, -3);
  assert.strictEqual(m.aeldari.drukhari, -1);
  assert.strictEqual(m.aeldari.harlequins, 2);
  assert.strictEqual(m.astartes.gsc, -2);                      // hidden war, not open
  // Tyranids: WAR with everyone except GSC
  for (const b of Object.keys(m.tyranids))
    if (b !== 'gsc') assert.strictEqual(m.tyranids[b], -3, 'tyranids↔' + b);
});
```

`tests/canon-seats.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('rules.seats shape', () => {
  const s = D.rules.seats;
  assert.ok(s, 'rules.seats missing');
  assert.deepStrictEqual(s.not_seatable.sort(), ['crown','orbit','space','warzone']);
  assert.strictEqual(s.tax.per_level, 3);
  assert.strictEqual(s.upkeep.pc_divisor, 250);
  assert.deepStrictEqual(s.casualties.pools,
    { repelled:0.15, repelled_losses:0.35, sacked:0.6, captured:1.0 });
  assert.strictEqual(s.casualties.carried_off, 0.5);
  assert.strictEqual(s.casualties.revival_element, 'Physical');
  assert.strictEqual(s.casualties.anchor, 'lapse_day');
  assert.strictEqual(s.buyout.premium, 2);
  assert.strictEqual(s.buyout.standing_min, 1);
  assert.strictEqual(s.petition_standing_min, 0);
});

test('base_by_type covers every seat-able location type, and no non-seat-able one', () => {
  const s = D.rules.seats;
  const all = D.galaxy.location_types.map(t => t.id);
  for (const t of all) {
    if (s.not_seatable.includes(t)) {
      assert.ok(!(t in s.base_by_type), t + ' is not seat-able but priced');
      assert.ok(!(t in s.work_gates), t + ' is not seat-able but work-gated');
    } else {
      assert.ok(s.base_by_type[t] > 0, t + ' has no seat_base');
      assert.ok(s.work_gates[t] > 0, t + ' has no work_gate');
    }
  }
});

test('every sub-faction-ruled sector designates a crown world', () => {
  for (const sg of D.galaxy.segmentums)
    for (const z of sg.zones)
      for (const sec of z.sectors) {
        const ruled = (sec.planets || []).some(p => p.ruler && p.ruler.faction);
        if (!ruled) continue;
        const hasCrown = (sec.planets || []).some(p => p.crown === true);
        assert.ok(hasCrown, 'sector ' + sec.id + ' is ruled but has no crown world');
      }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test tests/canon-standing.test.js tests/canon-seats.test.js`
Expected: FAIL — `rules.standing missing`, `rules.seats missing`, and (likely) the crown-audit test names the 2 sector ids. **Record which 2 sectors fail** — Step 3 fixes exactly those.

- [ ] **Step 3: Author the canon**

In `heretics-40k-data-v1.json`, bump `meta.version` to `"1.34"`, then add to `rules` (beside `rules.ultimatum`):

```json
"standing": {
 "note": "T-TERR-2. Ladder+matrix LOCKED (Daak 2026-08-09). All 190 cells are authored lore facts; the 13 flagged calls are the ones to watch in play.",
 "ladder": [
  {"id":"war","name":"WAR","value":-3},
  {"id":"hostile","name":"HOSTILE","value":-2},
  {"id":"cold","name":"COLD","value":-1},
  {"id":"neutral","name":"NEUTRAL","value":0},
  {"id":"warm","name":"WARM","value":1},
  {"id":"allied","name":"ALLIED","value":2}
 ],
 "kin_raid_floor": -3,
 "own_seed": 2,
 "matrix": {
  "black_legion":{"death_guard":1,"world_eaters":1,"thousand_sons":1,"emperors_children":1,"daemons":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-2},
  "death_guard":{"black_legion":1,"world_eaters":0,"thousand_sons":0,"emperors_children":0,"daemons":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-2},
  "world_eaters":{"black_legion":1,"death_guard":0,"thousand_sons":-1,"emperors_children":-2,"daemons":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-2},
  "thousand_sons":{"black_legion":1,"death_guard":0,"world_eaters":-1,"emperors_children":0,"daemons":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-2},
  "emperors_children":{"black_legion":1,"death_guard":0,"world_eaters":-2,"thousand_sons":0,"daemons":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-3,"drukhari":-3,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-3},
  "daemons":{"black_legion":1,"death_guard":1,"world_eaters":1,"thousand_sons":1,"emperors_children":1,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-3,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-3},
  "astartes":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"militarum":2,"mechanicus":2,"sororitas":2,"custodes":2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-1,"harlequins":-1},
  "militarum":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"astartes":2,"mechanicus":2,"sororitas":2,"custodes":2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-1,"harlequins":-1},
  "mechanicus":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"astartes":2,"militarum":2,"sororitas":1,"custodes":2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-2,"harlequins":-1},
  "sororitas":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"astartes":2,"militarum":2,"mechanicus":1,"custodes":2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-1,"harlequins":-1},
  "custodes":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"astartes":2,"militarum":2,"mechanicus":2,"sororitas":2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-1,"harlequins":-1},
  "tyranids":{"black_legion":-3,"death_guard":-3,"world_eaters":-3,"thousand_sons":-3,"emperors_children":-3,"daemons":-3,"astartes":-3,"militarum":-3,"mechanicus":-3,"sororitas":-3,"custodes":-3,"orks":-3,"necrons":-3,"aeldari":-3,"drukhari":-3,"tau":-3,"gsc":2,"votann":-3,"harlequins":-3},
  "orks":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-2,"daemons":-2,"astartes":-2,"militarum":-2,"mechanicus":-2,"sororitas":-2,"custodes":-2,"tyranids":-3,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"gsc":-2,"votann":-2,"harlequins":-2},
  "necrons":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-2,"daemons":-2,"astartes":-2,"militarum":-2,"mechanicus":-2,"sororitas":-2,"custodes":-2,"tyranids":-3,"orks":-2,"aeldari":-2,"drukhari":-2,"tau":-1,"gsc":-2,"votann":-1,"harlequins":-2},
  "aeldari":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-3,"daemons":-3,"astartes":-1,"militarum":-1,"mechanicus":-1,"sororitas":-1,"custodes":-1,"tyranids":-3,"orks":-2,"necrons":-2,"drukhari":-1,"tau":0,"gsc":-2,"votann":-1,"harlequins":2},
  "drukhari":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-3,"daemons":-2,"astartes":-2,"militarum":-2,"mechanicus":-2,"sororitas":-2,"custodes":-2,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":-1,"tau":-2,"gsc":-2,"votann":-2,"harlequins":1},
  "tau":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-2,"daemons":-2,"astartes":-1,"militarum":-1,"mechanicus":-1,"sororitas":-1,"custodes":-1,"tyranids":-3,"orks":-2,"necrons":-1,"aeldari":0,"drukhari":-2,"gsc":-2,"votann":0,"harlequins":-1},
  "gsc":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-2,"daemons":-2,"astartes":-2,"militarum":-2,"mechanicus":-2,"sororitas":-2,"custodes":-2,"tyranids":2,"orks":-2,"necrons":-2,"aeldari":-2,"drukhari":-2,"tau":-2,"votann":-1,"harlequins":-2},
  "votann":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-2,"daemons":-2,"astartes":-1,"militarum":-1,"mechanicus":-2,"sororitas":-1,"custodes":-1,"tyranids":-3,"orks":-2,"necrons":-1,"aeldari":-1,"drukhari":-2,"tau":0,"gsc":-1,"harlequins":-1},
  "harlequins":{"black_legion":-2,"death_guard":-2,"world_eaters":-2,"thousand_sons":-2,"emperors_children":-3,"daemons":-3,"astartes":-1,"militarum":-1,"mechanicus":-1,"sororitas":-1,"custodes":-1,"tyranids":-3,"orks":-2,"necrons":-2,"aeldari":2,"drukhari":1,"tau":-1,"gsc":-2,"votann":-1}
 }
},
"seats": {
 "note": "T-TERR-2. Formula shape LOCKED; base/work/pool/premium VALUES are defaults — FLAGGED FOR DAAK play-tuning.",
 "base_by_type": {
  "ruins":8,"lair":12,"village":12,
  "military_outpost":20,"mek_shop":20,"cult_sanctum":20,"plague_garden":20,"shrine":25,"tomb_vault":25,
  "city":30,"manufactorum":30,"bulwark":30,"fortress":40,"tradeport":40,
  "orbital_dock":45,"space_station":45,"forge_temple":50,"hive":60,"webway_portal":60
 },
 "work_gates": {
  "ruins":2,"lair":2,"village":2,
  "military_outpost":4,"mek_shop":4,"cult_sanctum":4,"plague_garden":4,"shrine":4,"tomb_vault":4,
  "city":6,"manufactorum":6,"bulwark":6,"fortress":6,"tradeport":6,
  "orbital_dock":10,"space_station":10,"forge_temple":10,"hive":10,"webway_portal":10
 },
 "not_seatable": ["crown","warzone","orbit","space"],
 "petition_standing_min": 0,
 "tax": {"per_level": 3},
 "upkeep": {"pc_divisor": 250, "unrest_per_miss": 1, "unrest_wound_every": 3},
 "work_earn": {"mission": 1, "rebuild_mission": 2, "manual": 1},
 "casualties": {
  "pools": {"repelled":0.15,"repelled_losses":0.35,"sacked":0.6,"captured":1.0},
  "carried_off": 0.5,
  "revival_element": "Physical",
  "anchor": "lapse_day"
 },
 "buyout": {"premium": 2, "standing_min": 1}
},
```

Then designate the 2 missing crown worlds (the sector ids come from Step 2's failure output): in each named sector, pick its highest-`level` ruled planet and add `"crown": true` to that planet object. Check first that no other planet in that sector already carries `crown:true`.

- [ ] **Step 4: Update the version pin and run the full suite**

In `tests/canon.test.js` find the assertion pinning `meta.version` (currently `'1.33'`) and bump to `'1.34'`.

Run: `node --test`
Expected: ALL PASS (579 baseline + the new canon tests). If the symmetry test fails, the two named cells disagree — fix the JSON, not the test (the plan matrix above is symmetric by construction).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-standing.test.js tests/canon-seats.test.js tests/canon.test.js
git commit -m "canon: v1.34 — rules.standing (20×20 authored matrix) + rules.seats + crown-world audit fixes (T-TERR-2 task 1)"
```

---

### Task 2: `seat-core` pure region — standing + seat economics

**Files:**
- Modify: `index.html` — insert a new `/*<seat-core>*/ … /*</seat-core>*/` region immediately AFTER `/*</agency-core>*/` (line ~2415)
- Create: `tests/_load-seat.js`, `tests/seat-core.test.js`

**Interfaces:**
- Consumes: canon shapes from Task 1; `garrison_mult` off `canon.galaxy.conditions` (same read as `ULT.garrisonMult`).
- Produces (later tasks call these exact names):
  `SEAT.seedStanding(facId, canon) → {facId: int}` ·
  `SEAT.moveStanding(ledger, facId, delta) → int` ·
  `SEAT.kinRaid(ledger, facId, canon) → int` ·
  `SEAT.standingName(value, canon) → string` ·
  `SEAT.seatable(type, canon) → bool` ·
  `SEAT.condMult(cond, canon) → number` ·
  `SEAT.priceOf(loc, cond, canon) → int|null` ·
  `SEAT.taxOf(loc, cond, canon) → int` ·
  `SEAT.gateReason(o, canon) → string|null` (o = `{loc, cond, ruledByOwn, held, work, standing, cur}`) ·
  `SEAT.workEarn(mission, canon) → int` ·
  `SEAT.upkeepOf(forcePC, canon) → int`

- [ ] **Step 1: Write the loader**

`tests/_load-seat.js` (mirror of `tests/_load-agency.js`):

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSeat() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<seat-core>\*\/([\s\S]*?)\/\*<\/seat-core>\*\//);
  if (!m) throw new Error('seat-core region not found in index.html');
  const SEAT = vm.runInThisContext('(function(){' + m[1] + '\n;return SEAT;})()');
  if (!SEAT) throw new Error('seat-core did not define SEAT');
  return SEAT;
}

module.exports = { loadSeat };
```

- [ ] **Step 2: Write the failing tests**

`tests/seat-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadSeat } = require('./_load-seat');
const D = require('../heretics-40k-data-v1.json');

const SEAT = loadSeat();

test('seedStanding: own faction ALLIED, others from the matrix row', () => {
  const led = SEAT.seedStanding('death_guard', D);
  assert.strictEqual(led.death_guard, 2);                       // own_seed
  assert.strictEqual(led.black_legion, 1);                      // matrix row
  assert.strictEqual(led.astartes, -3);
  assert.strictEqual(Object.keys(led).length, 20);
});

test('moveStanding clamps at [-3, +2]; kinRaid floors to WAR', () => {
  const led = SEAT.seedStanding('death_guard', D);
  assert.strictEqual(SEAT.moveStanding(led, 'black_legion', 5), 2);
  assert.strictEqual(SEAT.moveStanding(led, 'astartes', -5), -3);
  assert.strictEqual(SEAT.kinRaid(led, 'death_guard', D), -3);
  assert.strictEqual(led.death_guard, -3);
});

test('standingName maps values to ladder names', () => {
  assert.strictEqual(SEAT.standingName(-3, D), 'WAR');
  assert.strictEqual(SEAT.standingName(2, D), 'ALLIED');
});

test('priceOf = base × level × condition_mult; taxOf = 3 × level × cond', () => {
  const hive = { type: 'hive', level: 3 };
  assert.strictEqual(SEAT.priceOf(hive, 'intact', D), 180);      // 60×3×1
  assert.strictEqual(SEAT.priceOf(hive, 'fortified', D), 225);   // 60×3×1.25
  assert.strictEqual(SEAT.priceOf(hive, 'sacked', D), 108);      // 60×3×0.6
  assert.strictEqual(SEAT.priceOf({ type: 'crown', level: 3 }, 'intact', D), null);
  assert.strictEqual(SEAT.taxOf(hive, 'intact', D), 9);
  assert.strictEqual(SEAT.taxOf(hive, 'fortified', D), 11);      // round(9×1.25)
});

test('seatable honors not_seatable', () => {
  assert.ok(SEAT.seatable('ruins', D));
  assert.ok(!SEAT.seatable('warzone', D));
  assert.ok(!SEAT.seatable('orbit', D));
});

test('gateReason: fail-closed ladder of refusals, null when grantable', () => {
  const loc = { type: 'village', level: 1 };
  const base = { loc, cond: 'intact', ruledByOwn: true, held: false, work: 5, standing: 2, cur: 100 };
  assert.strictEqual(SEAT.gateReason(base, D), null);
  assert.match(SEAT.gateReason(Object.assign({}, base, { ruledByOwn: false }), D), /own kin/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { held: true }), D), /already held/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { work: 1 }), D), /WORK 1\/2/);
  assert.match(SEAT.gateReason(Object.assign({}, base, { standing: -1 }), D), /standing/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { cur: 3 }), D), /currency/i);
  assert.match(SEAT.gateReason(Object.assign({}, base, { loc: { type: 'warzone', level: 1 } }), D), /cannot be held/i);
});

test('workEarn: mission 1 · rebuild mission 2 · manual (payout 0) 1', () => {
  assert.strictEqual(SEAT.workEarn({ payout: 4, world_effect: {} }, D), 1);
  assert.strictEqual(SEAT.workEarn({ payout: 4, world_effect: { repair_step: 1 } }, D), 2);
  assert.strictEqual(SEAT.workEarn({ payout: 0, world_effect: { repair_step: 1 } }, D), 1);
  assert.strictEqual(SEAT.workEarn({ payout: 0, world_effect: { clear_condition: true } }, D), 1);
});

test('upkeepOf = ceil(force PC / 250), minimum 1', () => {
  assert.strictEqual(SEAT.upkeepOf(500, D), 2);
  assert.strictEqual(SEAT.upkeepOf(251, D), 2);
  assert.strictEqual(SEAT.upkeepOf(100, D), 1);
  assert.strictEqual(SEAT.upkeepOf(0, D), 1);
});
```

- [ ] **Step 3: Run to verify they fail**

Run: `node --test tests/seat-core.test.js`
Expected: FAIL — `seat-core region not found in index.html`.

- [ ] **Step 4: Implement the region**

Insert directly after `/*</agency-core>*/` in `index.html`:

```js
/*<seat-core>*/
/* T-TERR-2 — Seats, Trust & Standing. Pure + DOM-free: canon/state arrive as arguments;
   NO Date.now()/Math.random(). Casualty math (task 3) rides ULT.rng/seedFor discipline. */
var SEAT=(function(){
  function R(canon){return (canon.rules&&canon.rules.seats)||{};}
  function ST(canon){return (canon.rules&&canon.rules.standing)||{};}
  /* ── standing ── */
  function seedStanding(facId,canon){
    var m=ST(canon).matrix||{},row=m[facId]||{},out={};
    Object.keys(m).forEach(function(f){
      out[f]=(f===facId)?(ST(canon).own_seed!=null?ST(canon).own_seed:2)
                        :(row[f]!=null?row[f]:0);});
    return out;}
  function moveStanding(led,facId,delta){
    led[facId]=Math.min(2,Math.max(-3,(led[facId]||0)+delta));return led[facId];}
  function kinRaid(led,facId,canon){
    led[facId]=(ST(canon).kin_raid_floor!=null?ST(canon).kin_raid_floor:-3);return led[facId];}
  function standingName(v,canon){
    var l=ST(canon).ladder||[];
    for(var i=0;i<l.length;i++)if(l[i].value===v)return l[i].name;
    return String(v);}
  /* ── seat economics ── */
  function condMult(cond,canon){ /* same ladder read as ULT.garrisonMult */
    var rows=(canon.galaxy&&canon.galaxy.conditions)||[];
    for(var i=0;i<rows.length;i++)if(rows[i].id===cond)return rows[i].garrison_mult!=null?rows[i].garrison_mult:1;
    return 1;}
  function seatable(type,canon){return (R(canon).base_by_type||{})[type]!=null;}
  function priceOf(loc,cond,canon){
    var b=(R(canon).base_by_type||{})[loc.type];if(b==null)return null;
    return Math.round(b*(loc.level||1)*condMult(cond,canon));}
  function taxOf(loc,cond,canon){
    var t=R(canon).tax||{};
    return Math.round((t.per_level!=null?t.per_level:3)*(loc.level||1)*condMult(cond,canon));}
  function gateReason(o,canon){
    if(!seatable(o.loc.type,canon))return 'This ground cannot be held as a seat.';
    if(o.held)return 'This seat is already held.';
    if(!o.ruledByOwn)return 'Only a world ruled by your own kin grants seats.';
    var wg=(R(canon).work_gates||{})[o.loc.type]||0;
    if((o.work||0)<wg)return 'The ruler demands more service here — WORK '+(o.work||0)+'/'+wg+'.';
    var ps=(R(canon).petition_standing_min!=null?R(canon).petition_standing_min:0);
    if((o.standing!=null?o.standing:0)<ps)return 'Your standing with your kin bars the petition.';
    var p=priceOf(o.loc,o.cond,canon);
    if((o.cur||0)<p)return 'Not enough currency — '+p+' required.';
    return null;}
  function workEarn(mission,canon){
    var e=R(canon).work_earn||{},we=(mission&&mission.world_effect)||{};
    if(we.repair_step)return (mission.payout>0)?(e.rebuild_mission!=null?e.rebuild_mission:2)
                                               :(e.manual!=null?e.manual:1);
    return (e.mission!=null?e.mission:1);}
  function upkeepOf(forcePC,canon){
    var d=((R(canon).upkeep||{}).pc_divisor)||250;
    return Math.max(1,Math.ceil((forcePC||0)/d));}
  return {seedStanding:seedStanding,moveStanding:moveStanding,kinRaid:kinRaid,
          standingName:standingName,condMult:condMult,seatable:seatable,priceOf:priceOf,
          taxOf:taxOf,gateReason:gateReason,workEarn:workEarn,upkeepOf:upkeepOf};
})();
/*</seat-core>*/
```

- [ ] **Step 5: Run tests + engine syntax proxy**

Run: `node --test tests/seat-core.test.js tests/engine-syntax.test.js`
Expected: PASS. Then `node --test` — full suite green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/_load-seat.js tests/seat-core.test.js
git commit -m "engine: T-TERR-2 task 2 — pure seat-core (standing ledger, seat pricing/gates/tax, work earn, upkeep)"
```

---

### Task 3: `seat-core` casualty + buyout math

**Files:**
- Modify: `index.html` (extend the `/*<seat-core>*/` region — add the functions and the return-object keys)
- Modify: `tests/seat-core.test.js` (append tests)

**Interfaces:**
- Consumes: `ULT.rng(seed)` — Task 6's glue seeds it via `ULT.seedFor(base, day, lid, 'cas:'+aggressor)`.
- Produces:
  `SEAT.poolOf(outcome, totalWounds, canon) → int` ·
  `SEAT.distribute(members, pool, r) → [{id, hit, w, down}]` (members = `[{id, w}]`, `r` = an `ULT.rng` stream) ·
  `SEAT.carryOff(downed, r, canon) → {taken:[…], left:[…]}` ·
  `SEAT.captiveSplit(downed, r) → {captive:[…], slain:[…]}` ·
  `SEAT.buyoutPrice(unheldPrices, canon) → int`

- [ ] **Step 1: Append the failing tests**

Append to `tests/seat-core.test.js`:

```js
// deterministic rng stand-in for pure-math tests: cycles a fixed tape
function tape(vals){ let i = 0; return () => vals[i++ % vals.length]; }

test('poolOf: outcome fraction of total wounds, rounded', () => {
  assert.strictEqual(SEAT.poolOf('repelled', 40, D), 6);          // 15%
  assert.strictEqual(SEAT.poolOf('repelled_losses', 40, D), 14);  // 35%
  assert.strictEqual(SEAT.poolOf('sacked', 40, D), 24);           // 60%
  assert.strictEqual(SEAT.poolOf('captured', 40, D), 40);         // 100%
  assert.strictEqual(SEAT.poolOf('nonsense', 40, D), 0);          // unknown = 0, fail-closed
});

test('distribute: pool-exact, round-robin spread, chaff downs first, deterministic', () => {
  const members = [{ id: 'a', w: 5 }, { id: 'b', w: 2 }, { id: 'c', w: 1 }];
  const out = SEAT.distribute(members, 4, tape([0.1, 0.5, 0.9]));
  const dealt = out.reduce((s, m) => s + m.hit, 0);
  assert.strictEqual(dealt, 4);                                   // pool-exact
  const c = out.find(m => m.id === 'c');
  assert.ok(c.hit >= 1 && c.down, '1-wound model downs on the first pass that reaches it');
  // deterministic: same tape → same result
  const out2 = SEAT.distribute(members, 4, tape([0.1, 0.5, 0.9]));
  assert.deepStrictEqual(out, out2);
});

test('distribute: pool larger than total wounds downs everyone, never negative', () => {
  const out = SEAT.distribute([{ id: 'a', w: 2 }, { id: 'b', w: 1 }], 99, tape([0.4]));
  assert.ok(out.every(m => m.w === 0 && m.down));
  assert.strictEqual(out.reduce((s, m) => s + m.hit, 0), 3);      // stops at total wounds
});

test('carryOff: attacker takes floor(half), seeded, partition is exact', () => {
  const downed = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const { taken, left } = SEAT.carryOff(downed, tape([0.3, 0.7, 0.1]), D);
  assert.strictEqual(taken.length, 2);                            // floor(5×0.5)
  assert.strictEqual(taken.length + left.length, 5);
  const ids = taken.concat(left).map(m => m.id).sort();
  assert.deepStrictEqual(ids, ['a', 'b', 'c', 'd', 'e']);
});

test('captiveSplit partitions the downed into captive/slain', () => {
  const downed = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const { captive, slain } = SEAT.captiveSplit(downed, tape([0.2, 0.8, 0.4, 0.6]));
  assert.strictEqual(captive.length + slain.length, 4);
  assert.ok(captive.length >= 1 && slain.length >= 1);            // tape guarantees a mix
});

test('buyoutPrice = sum of unheld prices × premium', () => {
  assert.strictEqual(SEAT.buyoutPrice([30, 60, 12], D), 204);     // 102×2
  assert.strictEqual(SEAT.buyoutPrice([], D), 0);
});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `node --test tests/seat-core.test.js`
Expected: earlier tests PASS, new ones FAIL (`SEAT.poolOf is not a function`).

- [ ] **Step 3: Implement**

Inside the `seat-core` region, before the `return`:

```js
  /* ── stationed casualties (table ❸) ── */
  function poolOf(outcome,totalWounds,canon){
    var p=((R(canon).casualties||{}).pools||{})[outcome];
    if(!p)return 0;
    return Math.round(totalWounds*p);}
  function shuffled(list,r){
    var o=list.slice();
    for(var i=o.length-1;i>0;i--){var j=Math.floor(r()*(i+1));var t=o[i];o[i]=o[j];o[j]=t;}
    return o;}
  function distribute(members,pool,r){
    var order=shuffled(members,r),hits={},left=pool;
    function alive(m){return (m.w-(hits[m.id]||0))>0;}
    while(left>0&&order.some(alive)){
      for(var k=0;k<order.length&&left>0;k++){var m=order[k];
        if(!alive(m))continue;hits[m.id]=(hits[m.id]||0)+1;left--;}}
    return members.map(function(m){var h=hits[m.id]||0;
      return {id:m.id,hit:h,w:Math.max(0,m.w-h),down:h>0&&(m.w-h)<=0};});}
  function carryOff(downed,r,canon){
    var half=(R(canon).casualties||{}).carried_off;if(half==null)half=0.5;
    var order=shuffled(downed,r),n=Math.floor(downed.length*half);
    return {taken:order.slice(0,n),left:order.slice(n)};}
  function captiveSplit(downed,r){
    var captive=[],slain=[];
    downed.forEach(function(m){(r()<0.5?captive:slain).push(m);});
    return {captive:captive,slain:slain};}
  /* ── buyout ── */
  function buyoutPrice(unheldPrices,canon){
    var prem=((R(canon).buyout||{}).premium)||2,s=0;
    for(var i=0;i<unheldPrices.length;i++)s+=unheldPrices[i];
    return Math.round(s*prem);}
```

Add to the return object: `poolOf:poolOf,distribute:distribute,carryOff:carryOff,captiveSplit:captiveSplit,buyoutPrice:buyoutPrice`.

- [ ] **Step 4: Full suite**

Run: `node --test`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/seat-core.test.js
git commit -m "engine: T-TERR-2 task 3 — casualty math (pools, seeded round-robin distribute, carry-off, captive split) + buyout price"
```

---

### Task 4: Glue A — save-state seeding, WORK earn, kin-raid floor

**Files:**
- Modify: `index.html`:
  - `foundingWorld()` (line ~2621): add `work:{},seats:{}` to the returned object (standing needs the faction — next bullet)
  - `commitFounding` (search `function commitFounding`): after the save object is assembled, `S.world.standing=SEAT.seedStanding(S.player.faction,D);`
  - `init()` backfills (line ~4915 block): add the three older-save backfills
  - mission-conclude `mission_won` branch (line ~3694 `if(t.type==='MISSION'&&t.mission){`): WORK earn
  - `startThread` (line ~2776 area, where the thread is committed): kin-raid standing floor
  - `GLOSS` dictionary (search `var GLOSS=`): add `Standing`, `WORK`, `Seat` entries
- Test: `tests/world-territory.test.js` is untouched; verification is suite + browser E2E

**Interfaces:**
- Consumes: `SEAT.seedStanding`, `SEAT.workEarn`, `SEAT.kinRaid` (Tasks 2–3); `pRuler(pl)` (`index.html:3757`); `FAC(id)` (existing faction lookup).
- Produces: `S.world.standing` (facId→int), `S.world.work` (pid→int), `S.world.seats` (locId→`{pid,since,stationedForceId}`) — Tasks 5–7 read these exact shapes.

- [ ] **Step 1: Seed + backfill**

In `foundingWorld()`'s returned object, after `condHeal:{},`:

```js
 work:{},seats:{},                 // T-TERR-2 (standing seeds in commitFounding — needs the faction)
```

In `commitFounding`, immediately after the new save's `world` exists (search for where it assigns `world:foundingWorld()` or equivalent; add after that assignment completes):

```js
 S.world.standing=SEAT.seedStanding(S.player.faction,D);   // T-TERR-2: ledger from the matrix row
```

In `init()`'s backfill block (after the `condHeal` line at ~4922):

```js
  if(!S.world.standing)S.world.standing=SEAT.seedStanding(S.player.faction,D); // T-TERR-2: older saves
  if(!S.world.work)S.world.work={};
  if(!S.world.seats)S.world.seats={};
```

- [ ] **Step 2: WORK earn at mission conclude**

In the `mission_won` branch (after the `S.world.log.unshift('◈ MISSION COMPLETE …')` line, ~3739):

```js
   // T-TERR-2: WORK — trust earned by serving the planet (board mission 1 · Rebuild 2 · manual 1)
   S.world.work=S.world.work||{};
   S.world.work[t.mission.pl]=(S.world.work[t.mission.pl]||0)+SEAT.workEarn(t.mission,D);
```

- [ ] **Step 3: Kin-raid floor at thread start**

In `startThread`, at the point the combat thread is definitively created (after the `t` object is pushed / the `T(type+' thread opened…')` toast at ~2806), add:

```js
 // T-TERR-2: raising your hand against a ruled world floors standing with its ruler — kin or not
 if((type==='SKIRMISH'||type==='INVASION')){
  var _rl=pRuler(fPl(S.pos.pl).p);
  if(_rl&&_rl.faction){var _rf=D.factions.filter(function(x){return x.name===_rl.faction})[0];
   if(_rf){S.world.standing=S.world.standing||{};SEAT.kinRaid(S.world.standing,_rf.id,D);
    if(_rf.id===S.player.faction)T('⚑ You have raised your hand against your own kin — standing falls to WAR.');}}}
```

- [ ] **Step 4: GLOSS entries**

In the `GLOSS` dictionary add:

```js
'Standing':'Your ledger with each sub-faction, −3 WAR to +2 ALLIED. Seeded by lore, moved by your acts. Raiding a ruled world floors you to WAR with its ruler.',
'WORK':'Per-planet trust, earned by concluding missions there (Rebuild counts double). Gates seat petitions — you earn a seat by service, not by shopping.',
'Seat':'A named location held by a Commander on a world his own kin rules. Pays tax and production share; can be built, garrisoned, and lost with the planet.',
```

- [ ] **Step 5: Full suite + browser E2E**

Run: `node --test` — ALL PASS.
Browser (`python3 -m http.server 8765`, Playwright, `window._noPersist=true` FIRST): boot the demo save → console: `S.world.standing.death_guard===2`, `S.world.standing.black_legion===1`, `S.world.work` and `S.world.seats` exist; conclude nothing — instead run a REAL fresh founding (title → NEW COMMANDER → Rites) and verify the three keys exist immediately post-founding; 0 console errors, 7-screen sweep.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "engine: T-TERR-2 task 4 — standing/work/seats seeding (founding + init backfill), WORK earn at conclude, kin-raid floor, GLOSS"
```

---

### Task 5: Glue B — Throne-Room petition panel, seat display, tick income

**Files:**
- Modify: `index.html`:
  - `renderDoor` throne_room branch (line ~5573): petition panel
  - location panel (map screen, ~3387–3454 where `_shares`/Rebuild buttons render): "YOUR SEAT" chip + tax/share line
  - `init()` per-tick-day loop (line ~4930, beside `DOOR.tickBuilds`): seat income
- Test: none new (pure math already covered); browser E2E

**Interfaces:**
- Consumes: `SEAT.gateReason/priceOf/taxOf/seatable/standingName` (Task 2); `WORLD.locShares(planet,canon)` (`index.html:1612`); `effCond(l)` (existing condition reader); `addStock(pid,res)` (T-ECN-2a); `pRuler`, `fPl`, `lById`.
- Produces: `seatTickIncome()` — engine helper Task 6 leaves alone; `S.world.seats[locId]` rows minted by the petition buy.

- [ ] **Step 1: Petition panel in the throne_room branch**

Inside `else if(kind==='throne_room'){…}` (after the existing events block), append:

```js
  /* T-TERR-2: seat petition — every seat-able location on THIS planet, gates fail-closed */
  var _tpl=fPl(S.pos.pl).p,_tr=pRuler(_tpl),_me=FAC(S.player.faction);
  var _own=!!(_tr&&_tr.faction===_me.name);
  c.insertAdjacentHTML('beforeend','<div class="lsec" style="margin-top:14px"><h5>'+annotate('Petition for a Seat')+'</h5></div>');
  if(!_own)c.insertAdjacentHTML('beforeend','<div class="d">Only a world ruled by your own kin grants seats.</div>');
  else (_tpl.locations||[]).forEach(function(_sl){
   if(!SEAT.seatable(_sl.type,D))return;
   var _sc=effCond(_sl),_price=SEAT.priceOf(_sl,_sc,D);
   var _o={loc:_sl,cond:_sc,ruledByOwn:_own,held:!!(S.world.seats&&S.world.seats[_sl.id]),
     work:(S.world.work||{})[_tpl.id]||0,standing:(S.world.standing||{})[S.player.faction],cur:S.cur};
   var _why=SEAT.gateReason(_o,D);
   var _row=E('div','shopc','<div style="display:flex;justify-content:space-between;align-items:center"><span><b>'+_sl.name+'</b> <span class="mono" style="font-size:11px;color:var(--dim)">'+((LT(_sl.type)||{}).name||_sl.type)+' · L'+(_sl.level||1)+'</span></span><span class="mono" style="font-size:11px">'+(_o.held?'HELD':_price+' '+curName()+' · WORK '+(D.rules.seats.work_gates[_sl.type]||0))+'</span></div>');
   var _bt=E('button','btn gh sm',_o.held?'Yours':'Petition');_bt.style.marginTop='5px';_bt.disabled=_o.held;
   _bt.onclick=function(){_o.cur=S.cur;var w=SEAT.gateReason(_o,D);if(w){T(w);return}   // re-read funds at click, not render
    S.cur-=_price;S.world.seats=S.world.seats||{};
    S.world.seats[_sl.id]={pid:_tpl.id,since:WORLD.dayIndexAt(S,D,Date.now())};
    S.world.log=S.world.log||[];
    S.world.log.unshift(nowStamp()+' — SEAT GRANTED: '+_sl.name+' on '+_tpl.name+' ('+_price+' paid).');
    T('👑 '+_sl.name+' is your seat.');rShop();};
   _row.appendChild(_bt);c.appendChild(_row);});
```

(`LT` is the existing location-type lookup used at `index.html:3397`; `rShop` is the requisition re-render already used by the door handlers in this scope — match whatever the sibling handlers in `renderDoor` call.)

- [ ] **Step 2: Seat chip in the location panel**

In the map location panel where the Rebuild/Liberate buttons render (~3445–3454), add above them:

```js
var _seat=(S.world.seats||{})[l.id];
if(_seat)h2+='<div style="margin:5px 0"><span class="pill" style="border-color:var(--acc)">👑 YOUR SEAT</span> <span class="mono" style="font-size:11px;color:var(--dim)">tax '+SEAT.taxOf(l,effCond(l),D)+'/day'+(_seat.stationedForceId?' · garrisoned':'')+'</span></div>';
```

Also extend the manual Rebuild/Liberate gate `_held` (line ~3445-3449) so a held seat qualifies:
`var _heldOrSeat=_held||!!(S.world.seats&&S.world.seats[l.id]);` and use `_heldOrSeat` in `_canRebuild`/`_canLiberate`.

- [ ] **Step 3: Tick income**

Add an engine helper near `resolveUltLapses` (~3771):

```js
/* T-TERR-2: one in-game day of seat revenue — tax always; the location's production
   share only when the planet is NOT already a holding (holdings accrue whole-planet
   production in WORLD.catchUp — double-pay guard). */
function seatTickIncome(){
 var lines=[];
 Object.keys(S.world.seats||{}).forEach(function(lid){
  var lp=lById(lid,true);if(!lp.l||!lp.pid)return;
  var tax=SEAT.taxOf(lp.l,effCond(lp.l),D);
  S.cur=(S.cur||0)+tax;
  var got=tax+'c tax';
  if((S.world.holdings||[]).indexOf(lp.pid)<0){
   var pl=fPl(lp.pid).p,sh=WORLD.locShares(pl,D).filter(function(x){return x.id===lid})[0];
   if(sh){addStock(lp.pid,sh.share);got+=' · +'+sh.share.Food+'F/'+sh.share.Material+'M/'+sh.share.Fuel+'Fu';}}
  lines.push({kind:'seat_income',loc:lp.l.name,detail:got});});
 return lines;}
```

Call it inside `init()`'s per-tick-day loop (beside `DOOR.tickBuilds`, ~4932):

```js
    seatTickIncome().forEach(function(e){_wc.events.push(e);});
```

Then teach the digest: in `WORLD.digest` (inside the world-core region — find where it formats `door_built` events) add a `seat_income` line ONLY as an aggregate (`n seats paid their dues`) — one line per catch-up, not per seat per day:

```js
    var seatEv=events.filter(function(e){return e.kind==='seat_income';});
    if(seatEv.length)lines.push('👑 Your seats paid their dues ('+seatEv.length+' payments).');
```

- [ ] **Step 4: COMMISSION a missing door at a held seat**

In Requisition, when standing at a held seat (`S.world.seats[h.id]`), the door list already renders the location's existing doors. Below them, add a Commission block (in the same function that lays out the door cards — the `dz.filter(...).forEach(...renderDoor...)` site at ~3291 receives `h`; add after the loop):

```js
/* T-TERR-2: seat holders may commission a door the ground lacks — same build-timer seam
   as tier upgrades (DOOR.startBuild to tier 1, 'commission:' key prefix distinguishes new-build) */
if(S.world.seats&&S.world.seats[h.id]){
 var _have={};dz.forEach(function(d){_have[d.kind]=true});
 var _missing=D.galaxy.doors.filter(function(d){return !_have[d.kind]&&d.kind!=='throne_room'});
 if(_missing.length){
  w.insertAdjacentHTML('beforeend','<div class="lsec" style="margin-top:12px"><h5>'+annotate('Commission a door')+'</h5></div>');
  _missing.forEach(function(d){
   var _cc=(D.rules.seats.commission||{}).base||30;                 // flat commission cost, tunable
   var _cd=(D.rules.seats.commission||{}).days||7;
   var _cr=E('div','shopc','<div style="display:flex;justify-content:space-between;align-items:center"><span><b>'+d.kind.replace(/_/g,' ')+'</b></span><span class="mono" style="font-size:11px">'+_cc+' '+curName()+' · '+_cd+'d build</span></div>');
   var _cb=E('button','btn gh sm','Commission');_cb.style.marginTop='5px';
   _cb.onclick=function(){if(S.cur<_cc){T('Not enough '+curName()+'.');return}
    if(!DOOR.startBuild(S,h.id,d.kind,1,_cd)){T('Construction already underway here.');return}
    S.cur-=_cc;T('🔨 '+d.kind.replace(/_/g,' ')+' commissioned — '+_cd+' days.');rShop();};
   _cr.appendChild(_cb);w.appendChild(_cr);});}}
```

Add to canon `rules.seats` (Task 1 already shipped the block — append here, it's the same task family): `"commission": {"base": 30, "days": 7}` and pin it in `tests/canon-seats.test.js` (`assert.deepStrictEqual(s.commission, {base:30, days:7})`). A commissioned door completes through the existing `DOOR.tickBuilds` path and surfaces in the digest as `door_built` — zero new tick plumbing. NOTE: check `DOOR.tickBuilds`' finish path — a build to tier 1 on a door the location doesn't have must WRITE `S.world.doorTiers[key]=1` so the door starts existing; if `doorTierAt` derives existence purely from canon, extend the door-listing site (`dz` assembly) to also include overlay-only doors (`S.world.doorTiers` keys for this location). Verify in the E2E below.

- [ ] **Step 5: Full suite + browser E2E**

Run: `node --test` — ALL PASS (world-core tests guard `digest`; if the new line breaks a pin, extend the pin, don't delete it).
Browser E2E (`window._noPersist=true` FIRST): demo save is Death Guard; travel-free check — in console force a scenario: `S.world.work['nurth']=10; S.pos={pl:'nurth',sp:<its throne-room location id>}` (find the DG crown world's throne room via `fPl('nurth')`), open Requisition → Throne Room → petition panel lists seat-able locations with prices; buy the cheapest (fund `S.cur` if needed) → toast + `S.world.seats` row; map location panel shows 👑 YOUR SEAT; roll `S.time.lastTick` back 2 days → reload path (`init` glue re-run) → digest shows the seats-paid line and `S.cur` grew by 2×tax. Gates: drop `S.world.work` to 0 → petition refuses with the WORK reason; set `S.world.standing[S.player.faction]=-1` → refuses on standing. 0 console errors, 7-screen sweep.

Also E2E the commission: at the held seat, commission a missing door → currency drops, build appears in `S.world.doorBuilds` with the `commission:` semantics, roll the tick days forward → door exists and renders.

- [ ] **Step 6: Commit**

```bash
git add index.html heretics-40k-data-v1.json tests/canon-seats.test.js
git commit -m "engine: T-TERR-2 task 5 — Throne-Room seat petition (fail-closed gates), seat chip + rebuild rights, tick tax/share income, door commission"
```

---

### Task 6: Glue C — stationing, lapse defense, casualties, seats fall

**Files:**
- Modify: `index.html`:
  - location panel seat chip (Task 5's block): Station/Recall buttons
  - `resolveUltLapses` (line ~3771): stationed PC into the defense; casualties after the roll
  - `captureOnVictory` (line ~3941): clear seats on the captured planet
  - `init()` per-tick-day loop: upkeep swallow
- Test: `tests/seat-core.test.js` already covers the math; browser E2E for the glue

**Interfaces:**
- Consumes: `SEAT.upkeepOf/poolOf/distribute/carryOff/captiveSplit` (Tasks 2–3); `ULT.garrisonPC(level,cond,stationedPC,canon)` — the third arg exists and is currently passed `0` at `index.html:3780`; `threadOfForce(name)` (~2776); roster model states `'DEAD'`/`'TAKEN'` (spoils system); `D.rules.death.revival_window.windows.Physical`.
- Produces: `S.world.seats[lid].stationedForceId`; `stationedPCAt(lid) → int`.

- [ ] **Step 1: Station / Recall UI**

In the location-panel seat block (Task 5 Step 2), when standing at the location (`S.pos.sp===l.id`), render:

```js
if(_seat&&S.pos.pl===_seat.pid&&S.pos.sp===l.id){
 if(!_seat.stationedForceId){
  var _idle=S.forces.filter(function(f){return !threadOfForce(f.n)&&!stationedThreadLockOf(f.id);});
  if(_idle.length)h2+='<button class="btn gh" id="locstation">🛡 Station '+_idle[0].n+' here</button>';
 } else h2+='<button class="btn gh" id="locrecall">↩ Recall the garrison</button>';
}
```

with handlers (wired where `loclib`/`locreb` handlers are wired):

```js
function stationedThreadLockOf(fid){ // a stationed force is locked exactly like a thread-committed one
 var hit=null;Object.keys(S.world.seats||{}).forEach(function(lid){
  if(S.world.seats[lid].stationedForceId===fid)hit=lid;});return hit;}
function stationedPCAt(lid){
 var s=(S.world.seats||{})[lid];if(!s||!s.stationedForceId)return 0;
 var f=S.forces.filter(function(x){return x.id===s.stationedForceId})[0];if(!f)return 0;
 return S.roster.filter(function(m){return m.fo===f.n&&m.st!=='DEAD'&&m.st!=='TAKEN'})
  .reduce(function(sum,m){return sum+(m.pc||0);},0);}
```

Station sets `S.world.seats[l.id].stationedForceId=f.id` (refuse if the force is thread-committed — reuse the `threadOfForce` refusal copy at ~2776); Recall deletes the key. Also add the stationed-lock to the two force-availability gates: the mission idle-force filter (~2868) and force edit/disband gating (search the Forces tab for the active-in-thread lock and add `||stationedThreadLockOf(f.id)` with the toast `'…is standing garrison at <loc>. Recall it first.'`).

- [ ] **Step 2: Stationed PC into the lapse defense**

At `index.html:3780` change the `0` third argument:

```js
  var def=Math.round(ULT.garrisonPC(l.level,u.prev,stationedPCAt(t.lid),D)*((D.rules.ultimatum||{}).defender_mult||1.25));
```

- [ ] **Step 3: Casualties after the roll**

Immediately after the outcome ladder writes conditions (after the `captured→captureOnVictory` line ~3793), add:

```js
  /* T-TERR-2 table ❸: the stationed force bleeds by outcome — seeded, offscreen, honest */
  var _sfid=(S.world.seats[t.lid]||{}).stationedForceId;
  if(_sfid){
   var _sf=S.forces.filter(function(x){return x.id===_sfid})[0];
   var _mem=_sf?S.roster.filter(function(m){return m.fo===_sf.n&&m.st!=='DEAD'&&m.st!=='TAKEN'}):[];
   if(_mem.length){
    var _cr=ULT.rng(ULT.seedFor(S.world.missionSeedBase,u.expiresDay,t.lid,'cas:'+u.aggressor));
    var _tw=_mem.reduce(function(s,m){return s+parseInt(m.w,10);},0);   // current wounds ("3/5"→3)
    var _pool=SEAT.poolOf(res.outcome,_tw,D);
    var _hits=SEAT.distribute(_mem.map(function(m){return {id:m.id,w:parseInt(m.w,10)};}),_pool,_cr);
    var _downed=[];
    _hits.forEach(function(h){var m=S.roster.filter(function(x){return x.id===h.id})[0];
     var mx=m.w.split('/')[1];m.w=h.w+'/'+mx;
     if(h.down){_downed.push(m);}});
    var _winDay=u.expiresDay+((D.rules.death.revival_window.windows||{}).Physical||8);
    function _slay(m,bodyHeld){m.st='DEAD';m.fo='—';
     m.loc=l.name+' — fell in the defense'+(bodyHeld?'':' (body carried off)');
     if(bodyHeld)S.inv.push({cat:'REMAINS',n:'Remains of '+m.n,d:'Fell defending '+l.name+'.',
      ref:{cid:m.id},window:{element:'Physical',expiresDay:_winDay}});}
    if(res.outcome==='repelled'||res.outcome==='repelled_losses'){
     _downed.forEach(function(m){_slay(m,true);});}                    // ground held: bodies recoverable
    else if(res.outcome==='sacked'){
     var _co=SEAT.carryOff(_downed,_cr,D);
     _co.taken.forEach(function(m){m.st='TAKEN';m.fo='—';m.loc=l.name+' — taken in the sack';});
     _co.left.forEach(function(m){_slay(m,true);});}
    else if(res.outcome==='captured'){
     var _cs=SEAT.captiveSplit(_downed,_cr);
     _cs.captive.forEach(function(m){m.st='TAKEN';m.fo='—';m.loc=l.name+' — taken with the planet';});
     _cs.slain.forEach(function(m){_slay(m,false);});}                 // planet lost: bodies lost with it
    res.arith+=' · garrison: '+_hits.reduce(function(s,h){return s+h.hit;},0)+' wounds, '+_downed.length+' down';
   }
  }
```

(`TAKEN` models are exactly what N1's tribute captive-return reads — `S.roster.filter(m=>m.st==='TAKEN')` at ~2794 — so carried-off garrison feeds the existing buy-back channel with zero extra plumbing.)

- [ ] **Step 4: Seats fall with the planet + upkeep swallow**

In `captureOnVictory` (~3941), before the RECORD post, clear enemy seats is N/A (seats are player-only) — but when the PLAYER'S planet is captured via a lapse the same function does not run (it only grants TO the player). Instead, add the fall at the lapse site: in the `captured` branch of `resolveUltLapses` (right after `captureOnVictory(t,{kind:'lapse'},true)`), add:

```js
   Object.keys(S.world.seats||{}).forEach(function(lid){
    if(S.world.seats[lid].pid===t.pl){delete S.world.seats[lid];
     S.world.log.unshift(nowStamp()+' — SEAT LOST: the fall of the planet swept it away.');}});
```

Upkeep — in `init()`'s per-tick-day loop (after `seatTickIncome()`):

```js
    // T-TERR-2: stationed upkeep — the location swallows it; non-payment wounds the GROUND
    Object.keys(S.world.seats||{}).forEach(function(lid){
     var up=stationedPCAt(lid);if(!up)return;
     var due=SEAT.upkeepOf(up,D);
     if((S.cur||0)>=due){S.cur-=due;return}
     var lp=lById(lid,true);if(!lp.l)return;
     S.world.unrest[lp.pid]=(S.world.unrest[lp.pid]||0)+((D.rules.seats.upkeep||{}).unrest_per_miss||1);
     if(S.world.unrest[lp.pid]%((D.rules.seats.upkeep||{}).unrest_wound_every||3)===0){
      S.world.locConds[lid]=ULT.stepDown(effCond(lp.l));
      _wc.events.push({kind:'seat_unrest',loc:lp.l.name});}});
```

And a digest line beside the Task 5 aggregate: `if(events.some(function(e){return e.kind==='seat_unrest'}))lines.push('⚠ An unpaid garrison let a seat decay.');`

- [ ] **Step 5: Full suite + browser E2E**

Run: `node --test` — ALL PASS.
Browser E2E (`window._noPersist=true` FIRST): buy a seat (Task 5 path) → Station the demo idle force (`Sarghul`'s garrison members are `st:'GARRISON'` with `fo:'—'` — raise a small force first if needed) → force is refused in mission-accept (locked toast); set up a live ultimatum on the seat's location via console (mirror `tests`' shape: `t.ultimatum={expiresDay:<past day>,…}`), run `resolveUltLapses(Date.now())` → RECORD shows `garrison: N wounds, M down`, roster models wounded/DEAD/TAKEN per outcome, REMAINS items in `S.inv` with `expiresDay = lapse day + 8`; drain `S.cur=0`, roll a tick day → unrest climbs, third miss steps the condition down. 0 console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "engine: T-TERR-2 task 6 — station/recall + force lock, stationed PC in lapse defense, table-❸ casualties (REMAINS/TAKEN), seats fall with the planet, upkeep swallow"
```

---

### Task 7: Glue D — Buyout, ruler NPC face, close-out

**Files:**
- Modify: `index.html` (throne_room branch again; `pRuler` face), `CLAUDE.md` (engine bullet), `BACKLOG.md` (T-TERR-2 row)

**Interfaces:**
- Consumes: `SEAT.buyoutPrice/priceOf/seatable/standingName` ; `pRuler`, `secOwner`, `sectorOfPlanet`, `fPl`; `S.world.rulers/holdings/governor`.
- Produces: `S.world.governor[pid]=true` rows; ruler-NPC display name via `rulerFaceOf(planet)`.

- [ ] **Step 1: Ruler NPC face**

Near `pRuler` (~3757):

```js
/* T-TERR-2: deterministic ruler face — seeded off the planet id, no save bloat */
function rulerFaceOf(pl){
 var r=pRuler(pl);if(!r||!r.faction)return null;
 var rng=ULT.rng(ULT.seedFor(S.world.missionSeedBase||1,0,pl.id,'ruler:'+r.faction));
 var TITLES={chaos:['Despoiler-Regent','Dark Castellan','Plague Warden','Sorcerer-Regent'],
  imperial:['Planetary Governor','Lord Castellan','Canoness-Regent','Arch-Magos'],
  xenos:['Overlord','Warboss-Mek','Autarch-Regent','Ethereal Envoy']};
 var pool=TITLES[r.allegiance]||TITLES.xenos;
 var NAMES=['Vhorak','Sette','Maulkin','Dravenna','Oskarr','Threx','Iyanna','Ghazkull-Nadd','Calpernia','Vect-Sar'];
 return pool[Math.floor(rng()*pool.length)]+' '+NAMES[Math.floor(rng()*NAMES.length)]+' ('+r.faction+')';}
```

Show it in the throne_room branch header (Task 5's panel): `c.insertAdjacentHTML('beforeend','<div class="d" style="margin-bottom:8px">You stand before <b>'+(rulerFaceOf(_tpl)||'an empty throne')+'</b>.</div>');`

- [ ] **Step 2: Buyout panel**

In the throne_room branch, after the petition panel — rendered ONLY when the current planet is the sector's crown world (`fPl(S.pos.pl).p.crown===true`):

```js
  /* T-TERR-2: planetary BUYOUT — majority seats + sector work + WARM standing, ×2 premium */
  if(_tpl.crown){
   var _sec=fPl(S.pos.pl).s;
   c.insertAdjacentHTML('beforeend','<div class="lsec" style="margin-top:14px"><h5>Petition for Planetary Rule</h5></div>');
   (_sec.planets||[]).forEach(function(_bp){
    var _br=pRuler(_bp);if(!_br||_br.faction!==_me.name)return;                 // own-kin worlds only
    if((S.world.holdings||[]).indexOf(_bp.id)>=0)return;                        // already yours
    var _seatable=(_bp.locations||[]).filter(function(x){return SEAT.seatable(x.type,D)});
    if(!_seatable.length)return;
    var _held=_seatable.filter(function(x){return S.world.seats&&S.world.seats[x.id]});
    var _unheld=_seatable.filter(function(x){return !(S.world.seats&&S.world.seats[x.id])});
    var _bprice=SEAT.buyoutPrice(_unheld.map(function(x){return SEAT.priceOf(x,effCond(x),D)}),D);
    var _secWork=0;(_sec.planets||[]).forEach(function(p){_secWork+=(S.world.work||{})[p.id]||0});
    var _sMin=(D.rules.seats.buyout||{}).standing_min||1;
    var _why=null;
    if(_held.length*2<=_seatable.length)_why='Hold the majority of its seats first ('+_held.length+'/'+_seatable.length+').';
    else if(_secWork<20)_why='The sector demands more service — WORK '+_secWork+'/20 across its worlds.';
    else if(((S.world.standing||{})[S.player.faction]||0)<_sMin)_why='Only the '+SEAT.standingName(_sMin,D)+' are granted worlds.';
    else if((S.cur||0)<_bprice)_why='Not enough currency — '+_bprice+' required.';
    var _row=E('div','shopc','<div style="display:flex;justify-content:space-between;align-items:center"><span><b>'+_bp.name+'</b> <span class="mono" style="font-size:11px;color:var(--dim)">seats '+_held.length+'/'+_seatable.length+'</span></span><span class="mono" style="font-size:11px">'+_bprice+' '+curName()+'</span></div>');
    var _bb=E('button','btn gh sm','Buy out');_bb.style.marginTop='5px';
    _bb.onclick=function(){if(_why){T(_why);return}
     S.cur-=_bprice;
     S.world.holdings.push(_bp.id);
     S.world.governor=S.world.governor||{};S.world.governor[_bp.id]=true;
     S.world.log.unshift(nowStamp()+' — BUYOUT: '+_bp.name+' is granted to you. Its tithe now flows to your coffers.');
     T('👑 '+_bp.name+' is yours by right of coin and service.');rShop();};
    _row.appendChild(_bb);c.appendChild(_row);});}
```

Also add the `governor` backfill in `init()`: `if(!S.world.governor)S.world.governor={};` and `governor:{},` in `foundingWorld()` (both-sites rule). Note the sector-work gate `20` is a first-number default — record it in the tunables note in canon (`rules.seats.buyout.sector_work_min: 20`, read it instead of the literal, and pin it in `tests/canon-seats.test.js` with `assert.strictEqual(s.buyout.sector_work_min, 20)`).

- [ ] **Step 3: Full suite + browser E2E**

Run: `node --test` — ALL PASS.
Browser E2E (`window._noPersist=true` FIRST): stand on the DG sector crown world's throne room; console-arrange majority seats on a sibling DG planet (mint `S.world.seats` rows), `S.world.work` across the sector ≥20, standing +2, fund `S.cur` → Buy out succeeds → planet enters `S.world.holdings`, governor flag set, tithe accrues next tick; each gate refusal message verified by removing one gate input at a time. Ruler face renders and is IDENTICAL across two reloads (determinism). Full 7-screen sweep, 0 console errors.

- [ ] **Step 4: Close-out docs**

- `CLAUDE.md`: add a T-TERR-2 engine bullet (seats, standing, WORK, stationing/casualties, buyout — one paragraph in the house style, canon v1.34).
- `BACKLOG.md`: T-TERR-2 row → `ready-to-push`, list exact paths + commits, note tunables flagged for Daak (matrix cells, seat bases/work gates, pools, buyout premium + sector_work_min 20, upkeep divisor).

- [ ] **Step 5: Commit**

```bash
git add index.html heretics-40k-data-v1.json tests/canon-seats.test.js CLAUDE.md BACKLOG.md
git commit -m "engine: T-TERR-2 task 7 — planetary buyout at the crown throne, seeded ruler faces, governor flag, close-out docs"
```

---

## Post-plan verification (whole-branch)

After Task 7: run the standard **lifecycle review** (per `sdd-review-loop-lessons`): walk a seat's whole life across tasks — petition → income → station → lapse casualties → capture-fall → buyout — looking for cross-task breaks (the per-task reviews won't catch them). Known watch-points:

1. **Double-pay:** a bought-out planet enters `holdings` — its seat rows must stop drawing `locShares` (the Task 5 guard covers it; verify after buyout, not just before).
2. **Stationed lock vs capture-fall:** when a seat is deleted on planet capture, its `stationedForceId` lock must not orphan (the force must become free — Task 6's casualty branch disbands `captured`; verify the `sacked` path leaves a recallable force).
3. **Chunk-independence:** upkeep/income run inside the same per-day loop as lapses and heals — 13 daily boots must equal one 13-day boot (extend `tests/world-core.test.js` style if a divergence appears).
4. **Standing seed for the demo save:** the demo profile skips `commitFounding` — `init()`'s backfill must cover it (Task 4 E2E asserts it).
