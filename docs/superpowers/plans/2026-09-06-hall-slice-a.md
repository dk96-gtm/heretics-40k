# The Hall — Slice A Implementation Plan (T-SOC-1 · crowd, rumors, mood events)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Hall door's first playable layer — the 20-culture social door with a
day-seeded crowd, TRUE rumors read from real world state, the COMMUNE and OFFER verbs, and
the four mood events — plus the T-MOD-1 civilian model mint that gives patrons bodies.

**Architecture:** One new pure DOM-free `/*<hall-core>*/` region (`HALL`) generates patrons,
routes rumors, and evaluates mood events deterministically (mulberry32 seeds, zero
`Date.now()`/`Math.random()` — the mission-core idiom verbatim). Engine glue builds a context
snapshot from existing accessors (`doorTierAt`, `effCond`, `WORLD.sectorStatus`,
`NPCAI.stampAtProfile`, chronicle, mission boards) and renders one new `renderDoor` branch.
Canon gains the `hall` door row (per-sub-faction skins — the existing reader at
`index.html:417` already prefers `skins[facId]`), a `rules.hall` block, and a `civilians`
block. Regulars/trust (Slice B) and powers/jobs/interaction events (Slice C) are LATER plans.

**Tech Stack:** vanilla JS in `index.html` (ES5 style, no deps) · canon JSON · Node built-in
test runner (`node --test`, zero deps) · Playwright MCP for browser E2E.

**Spec:** `docs/superpowers/specs/2026-09-06-social-door-design.md` (LOCKED 2026-09-06 — the
plan implements spec §2–§5, §7 mood rows, §10, §11; §12 slice A scope).

## Global Constraints

- Canon version target: `meta.version` **1.38** (branch is at 1.37; bump ONCE, in Task 1; the
  other canon tasks edit content only). Cross-plan rule: version-ladder by execution order.
- Terminology law: it is always **"model"**, never "chassis" — all text, code, data.
- The pure core reads NO globals: canon + state arrive as arguments; no `Date.now()`, no
  `Math.random()` inside `/*<hall-core>*/`.
- Git hygiene: `git add <explicit paths>` only — NEVER `git add -A` (multi-agent repo).
- The tree stays test-passing (`node --test`) at every commit.
- New save-state keys seed in BOTH the `S` defaults literal AND `init()` backfill
  (established gotcha; `S.social` is this plan's new key).
- Browser E2E: set `window._noPersist=true` FIRST in any page-eval session that founds or
  mutates a profile; verify 0 console errors on every screen touched.
- All numbers below are flagged-for-review defaults (spec §13), not locked balance.

## File Structure

- `heretics-40k-data-v1.json` — hall door row (`galaxy.doors`), `location_types[].doors`
  additions, `rules.doors_tiering.t3_homes.hall`, new `rules.hall` block, new top-level
  `civilians` block, `meta.version` 1.38.
- `index.html` — new `/*<hall-core>*/` region (after `/*</cadence-core>*/`, line ~2815);
  `hallCtxOf`/`renderHall`/handlers in the door-glue area near `renderDoor` (~6990); one
  `else if(kind==='hall')` branch; `S.social` seeding (defaults literal ~5498 + `init()`);
  GLOSS entries (~6689).
- `tests/_load-hall.js` — region extractor (copy of `_load-cadence.js` shape).
- `tests/hall-core.test.js` — pure-core behavior.
- `tests/canon-hall.test.js` — canon completeness pins.

---

### Task 1: Canon — the hall door row, placement, tier seeding, version bump

**Files:**
- Modify: `heretics-40k-data-v1.json` (`galaxy.doors`, `galaxy.location_types`,
  `rules.doors_tiering.t3_homes`, `meta.version`)
- Test: `tests/canon-hall.test.js` (create)

**Interfaces:**
- Produces: door kind id `'hall'`; `skins` keyed by the 20 faction ids (plain strings — the
  generic reader `index.html:417` `d.skins[facId]||d.skins[alleg]` resolves them untouched).
- Produces for Task 6: `hall` present in 16 location types' `doors` arrays;
  `t3_homes.hall === "Hive World"`.

- [ ] **Step 1: Write the failing canon pins**

Create `tests/canon-hall.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

const FACTIONS = D.factions.map(f => f.id);

test('canon: version is 1.38', () => {
  assert.equal(D.meta.version, '1.38');
});

test('hall door row exists with 20 per-faction skins and 3 tier lines', () => {
  const hall = D.galaxy.doors.filter(d => d.kind === 'hall')[0];
  assert.ok(hall, 'hall door row missing');
  assert.equal(hall.name, 'Hall');
  for (const f of FACTIONS) assert.ok(typeof hall.skins[f] === 'string' && hall.skins[f].length > 0, 'skin missing: ' + f);
  assert.equal(Object.keys(hall.skins).length, 20);
  for (const t of ['1', '2', '3']) assert.ok(hall.tiers[t], 'tier text missing: ' + t);
});

test('hall placed at the 16 inhabited location types, absent from the rest', () => {
  const HAS = ['hive','city','tradeport','village','manufactorum','forge_temple',
    'military_outpost','fortress','bulwark','shrine','lair','crown','plague_garden',
    'mek_shop','cult_sanctum','tomb_vault'];
  const NOT = ['ruins','warzone','webway_portal','space_station','orbital_dock','orbit','space'];
  for (const lt of D.galaxy.location_types) {
    const has = (lt.doors || []).indexOf('hall') >= 0;
    if (HAS.indexOf(lt.id) >= 0) assert.ok(has, lt.id + ' should carry a hall');
    if (NOT.indexOf(lt.id) >= 0) assert.ok(!has, lt.id + ' must NOT carry a hall (slice A)');
  }
});

test('hall tier-seeds at T3 on Hive Worlds', () => {
  assert.equal(D.rules.doors_tiering.t3_homes.hall, 'Hive World');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/canon-hall.test.js`
Expected: FAIL — hall door row missing, version 1.37.

- [ ] **Step 3: Edit the canon**

In `heretics-40k-data-v1.json`:

1. `meta.version`: `"1.37"` → `"1.38"`.
2. Append to `galaxy.doors` (after the `throne_room` row):

```json
{"kind":"hall","name":"Hall","does":"the social space — meet the crowd, hear true rumors, make the culture's offering","rarity":"common",
 "skins":{"black_legion":"The Trophy Hall","death_guard":"The Poxfeast","world_eaters":"The Skullpit","thousand_sons":"The Athenaeum","emperors_children":"The Salon","daemons":"The Carnival","astartes":"The Saga-Hall","militarum":"The Mess","mechanicus":"The Communion","sororitas":"The Refectory","custodes":"The Vigil","tyranids":"The Broodpool","orks":"Da Grog Den","necrons":"The Court","aeldari":"The Dome","drukhari":"The Gallery","tau":"The Hall of Unity","gsc":"The Congregation","votann":"The Hearthhold","harlequins":"The Masque"},
 "tiers":{"1":"the back room — a handful of souls, small talk","2":"the establishment — a real crowd, real news","3":"the institution — where the famous drink and the big nights happen"}}
```

3. Add `"hall"` to the `doors` array of exactly these 16 `location_types` rows: `hive`,
   `city`, `tradeport`, `village`, `manufactorum`, `forge_temple`, `military_outpost`,
   `fortress`, `bulwark`, `shrine`, `lair`, `crown`, `plague_garden`, `mek_shop`,
   `cult_sanctum`, `tomb_vault` (append at the end of each array).
4. In `rules.doors_tiering.t3_homes` add `"hall": "Hive World"`.

- [ ] **Step 4: Run tests — new pins pass, nothing else broke**

Run: `node --test tests/canon-hall.test.js` → PASS (4/4).
Run: `node --test` → full suite green. ⚠ If any existing canon pin counts doors-per-type or
doors-total, update that pin in the same commit (expected candidates: `tests/canon.test.js`,
`tests/canon-doors.test.js` — search them for door-count assertions and bump by the exact
number of `hall` additions).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-hall.test.js tests/canon.test.js tests/canon-doors.test.js
git commit -m "canon: v1.38 — the Hall door (T-SOC-1 slice A): 20 sub-faction skins, 16-type placement, Hive World T3 home"
```

(Include the two existing test files only if their pins actually changed.)

---

### Task 2: Canon — `rules.hall` (cultures, pools, names, mood events) + `civilians`

**Files:**
- Modify: `heretics-40k-data-v1.json` (new `rules.hall`, new top-level `civilians`)
- Test: `tests/canon-hall.test.js` (extend)

**Interfaces:**
- Produces for Task 3+: `rules.hall.crowd` (tier→[min,max]), `rules.hall.offer` (constants),
  `rules.hall.pools[locTypeId]` = array of `{role, registers}`, `rules.hall.status_roles`,
  `rules.hall.culture[facId]` = `{flavor, commune, offer_label, offer:{kind,...}}`,
  `rules.hall.names[facId]` = `{first:[…], epithets:[…]}`, `rules.hall.events` (4 mood rows),
  `civilians[facId]` = `{n, pc, w, sp, sl, sex}`.

- [ ] **Step 1: Extend the failing canon pins**

Append to `tests/canon-hall.test.js`:

```js
test('rules.hall: culture + names complete for all 20 factions', () => {
  const H = D.rules.hall;
  assert.ok(H, 'rules.hall missing');
  for (const f of FACTIONS) {
    const c = H.culture[f];
    assert.ok(c && c.flavor && c.commune && c.offer_label && c.offer && c.offer.kind, 'culture incomplete: ' + f);
    assert.ok(['cur', 'item', 'res'].indexOf(c.offer.kind) >= 0, 'bad offer kind: ' + f);
    const n = H.names[f];
    assert.ok(n && n.first.length >= 6 && n.epithets.length >= 4, 'name pool thin: ' + f);
  }
  assert.equal(H.culture.world_eaters.offer.accepts, 'REMAINS');
  assert.equal(H.culture.drukhari.offer.accepts, 'CAPTIVE');
  assert.equal(H.culture.tyranids.offer.res, 'Food');
});

test('rules.hall: pools cover every hall-bearing location type; events are the 4 mood rows', () => {
  const H = D.rules.hall;
  for (const lt of D.galaxy.location_types) {
    if ((lt.doors || []).indexOf('hall') < 0) continue;
    assert.ok(Array.isArray(H.pools[lt.id]) && H.pools[lt.id].length >= 3, 'pool thin: ' + lt.id);
    for (const p of H.pools[lt.id]) assert.ok(p.role && p.registers.length, 'bad pool row in ' + lt.id);
  }
  assert.deepEqual(H.events.map(e => e.id), ['famine_table', 'plague_night', 'good_season', 'holy_day']);
  assert.ok(H.status_roles.Sacked && H.status_roles.Besieged, 'status_roles missing');
});

test('civilians: one body per faction, low-PC, sexed', () => {
  for (const f of FACTIONS) {
    const c = D.civilians[f];
    assert.ok(c, 'civilian missing: ' + f);
    assert.ok(c.pc >= 2 && c.pc <= 8 && c.w >= 1 && c.w <= 2, 'civilian statline off: ' + f);
    assert.ok(['male', 'female', 'varied'].indexOf(c.sex) >= 0, 'bad sex rule: ' + f);
  }
  assert.equal(D.civilians.astartes.sex, 'male');
  assert.equal(D.civilians.custodes.sex, 'male');
  assert.equal(D.civilians.sororitas.sex, 'female');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/canon-hall.test.js` → FAIL (rules.hall missing).

- [ ] **Step 3: Author the canon blocks**

Add to `rules` (sibling of `rules.missions`):

```json
"hall":{
 "crowd":{"1":[2,4],"2":[4,6],"3":[6,8]},
 "offer":{"cost":3,"disp":1,"good_season_cost_mult":0.75,"famine_food_disp_mult":3,"holy_day_disp_mult":2},
 "holy_day_mod":23,"taint_plague_gte":60,
 "pools":{
  "hive":[{"role":"Dock Hand","registers":["trade","state"]},{"role":"Off-shift Enforcer","registers":["state","ground"]},{"role":"Tithe Clerk","registers":["trade","state"]},{"role":"Ganger","registers":["ground","war"]},{"role":"Spire Runner","registers":["trade","war"]}],
  "city":[{"role":"Merchant","registers":["trade","state"]},{"role":"Watchman","registers":["state","ground"]},{"role":"Scribe","registers":["state","war"]},{"role":"Laborer","registers":["trade","ground"]}],
  "tradeport":[{"role":"Cargo Master","registers":["trade","war"]},{"role":"Void-hand","registers":["trade","state"]},{"role":"Tally-keeper","registers":["trade","state"]},{"role":"Drifter","registers":["ground","war"]}],
  "village":[{"role":"Farmhand","registers":["state","ground"]},{"role":"Elder","registers":["ground","state"]},{"role":"Peddler","registers":["trade","state"]}],
  "manufactorum":[{"role":"Line Worker","registers":["trade","state"]},{"role":"Overseer","registers":["state","war"]},{"role":"Scrap-hauler","registers":["trade","ground"]}],
  "forge_temple":[{"role":"Lay Artisan","registers":["trade","state"]},{"role":"Vat Tender","registers":["state","ground"]},{"role":"Supplicant","registers":["ground","war"]}],
  "military_outpost":[{"role":"Sentry","registers":["war","state"]},{"role":"Quarter-hand","registers":["trade","war"]},{"role":"Signalman","registers":["war","ground"]}],
  "fortress":[{"role":"Garrison Trooper","registers":["war","ground"]},{"role":"Armorer's Mate","registers":["trade","war"]},{"role":"Messenger","registers":["war","state"]},{"role":"Veteran","registers":["ground","war"]}],
  "bulwark":[{"role":"Wall Sentry","registers":["war","state"]},{"role":"Sapper","registers":["war","ground"]},{"role":"Medicae Orderly","registers":["state","ground"]},{"role":"Supply Runner","registers":["trade","war"]}],
  "shrine":[{"role":"Pilgrim","registers":["ground","state"]},{"role":"Lay Sister","registers":["state","ground"]},{"role":"Reliquary Sweep","registers":["ground","trade"]}],
  "lair":[{"role":"Camp Follower","registers":["ground","war"]},{"role":"Scavver","registers":["trade","ground"]},{"role":"Pit Tout","registers":["war","trade"]}],
  "crown":[{"role":"Courtier","registers":["state","war"]},{"role":"Petitioner","registers":["state","ground"]},{"role":"Household Guard","registers":["war","ground"]},{"role":"Envoy","registers":["trade","state"]}],
  "plague_garden":[{"role":"Blight Tender","registers":["state","ground"]},{"role":"Pox Cantor","registers":["ground","war"]},{"role":"Gravekeeper","registers":["ground","state"]}],
  "mek_shop":[{"role":"Grease Grot","registers":["trade","ground"]},{"role":"Yoof","registers":["war","ground"]},{"role":"Teef Counter","registers":["trade","war"]}],
  "cult_sanctum":[{"role":"Initiate","registers":["ground","state"]},{"role":"Watcher at the Door","registers":["state","war"]},{"role":"Kin of the Third Curl","registers":["ground","trade"]}],
  "tomb_vault":[{"role":"Awakened Menial","registers":["ground","state"]},{"role":"Cryptek's Attendant","registers":["state","war"]},{"role":"Silent Herald","registers":["ground","war"]}]
 },
 "status_roles":{
  "Sacked":[{"role":"Looter","registers":["ground","trade"]},{"role":"Refugee","registers":["state","ground"]}],
  "Besieged":[{"role":"Deserter","registers":["war","ground"]},{"role":"Hoarder","registers":["trade","state"]}]
 },
 "culture":{
  "black_legion":{"flavor":"Claimed glories line the walls; every trophy is a threat.","commune":"Trade words","offer_label":"Show plunder","offer":{"kind":"cur"}},
  "death_guard":{"flavor":"The Grandfather's table groans — jolly, generous, rotting.","commune":"Share the table","offer_label":"Share a brew","offer":{"kind":"cur"}},
  "world_eaters":{"flavor":"The pit is the parlor. Talk quickly.","commune":"Talk between bouts","offer_label":"Toss a worthy skull","offer":{"kind":"item","accepts":"REMAINS"}},
  "thousand_sons":{"flavor":"Dust and whispers; every shelf watches you back.","commune":"Whisper","offer_label":"Offer a secret","offer":{"kind":"cur"}},
  "emperors_children":{"flavor":"Exquisite excess, arranged just so.","commune":"Mingle","offer_label":"Gift a novel sensation","offer":{"kind":"cur"}},
  "daemons":{"flavor":"The Carnival pitches where the veil is thin. Everything is for sale.","commune":"Listen to the barkers","offer_label":"Feed the Carnival","offer":{"kind":"cur"}},
  "astartes":{"flavor":"Feast benches and old sagas; deeds are the only coin that matters.","commune":"Hear the sagas","offer_label":"Stand the feast","offer":{"kind":"cur"}},
  "militarum":{"flavor":"Amasec, dice, smokes — the one honest pub in the galaxy.","commune":"Shoot the breeze","offer_label":"Buy a round","offer":{"kind":"cur"}},
  "mechanicus":{"flavor":"The Communion hums; data flows like oil, oil like data.","commune":"Exchange data","offer_label":"Tithe a data-morsel","offer":{"kind":"cur"}},
  "sororitas":{"flavor":"The Refectory is quiet devotion; even the bread is a hymn.","commune":"Sit the vigil","offer_label":"Light a candle","offer":{"kind":"cur"}},
  "custodes":{"flavor":"A sparse hall of watchers. Few words, all of them weighed.","commune":"Stand the watch","offer_label":"Give an account of duty","offer":{"kind":"cur"}},
  "tyranids":{"flavor":"The pool stirs. It has already tasted you.","commune":"Touch the synapse","offer_label":"Yield biomass","offer":{"kind":"res","res":"Food"}},
  "orks":{"flavor":"Grog, squig-bets, and at least one proppa scrap a night.","commune":"Talk loud","offer_label":"Grog for da ladz","offer":{"kind":"cur"}},
  "necrons":{"flavor":"The Court remembers protocol older than your species.","commune":"Observe protocol","offer_label":"Tribute of remembrance","offer":{"kind":"cur"}},
  "aeldari":{"flavor":"Paths cross beneath the Dome; memory-songs hang in the air.","commune":"Share a memory-song","offer_label":"Weave a memory","offer":{"kind":"cur"}},
  "drukhari":{"flavor":"Box seats above the agonies. Applause is optional; attention is not.","commune":"Trade barbs","offer_label":"Present a captive","offer":{"kind":"item","accepts":"CAPTIVE"}},
  "tau":{"flavor":"The communal meal is earnest, warm, and quietly watched.","commune":"Join the discourse","offer_label":"Fund the communal meal","offer":{"kind":"cur"}},
  "gsc":{"flavor":"The family gathers below; everyone here is a cousin, somehow.","commune":"Meet the family","offer_label":"Tithe to the family fund","offer":{"kind":"cur"}},
  "votann":{"flavor":"The Hearthhold: ancestors watching, grudges ledgered, ale honest.","commune":"Drink with the kin","offer_label":"Toast the ancestors","offer":{"kind":"cur"}},
  "harlequins":{"flavor":"The Masque is already underway. You may already be in it.","commune":"Watch the performance","offer_label":"Play the role offered","offer":{"kind":"cur"}}
 },
 "names":{
  "black_legion":{"first":["Vharkos","Dessek","Morvael","Skarn","Ulyx","Hexad"],"epithets":["the Unbowed","Iron-Tongue","of the Ninth Siege","the Twice-Marked"]},
  "death_guard":{"first":["Morgax","Phelgm","Urgott","Vessic","Bubon","Grelch"],"epithets":["the Generous","Pox-Kind","of the Seventh Bloom","Ever-Smiling"]},
  "world_eaters":{"first":["Kharvek","Skalla","Brakkus","Vorna","Drex","Hurn"],"epithets":["Skull-Counter","the Pit-Born","Red-Handed","of the Long Rage"]},
  "thousand_sons":{"first":["Amon-Set","Kheperu","Thessaly","Ankhu","Merodach","Sivane"],"epithets":["the Dust-Read","Ninth-Sighted","of the Silent Shelf","the Unwritten"]},
  "emperors_children":{"first":["Lucine","Vexandre","Melisse","Ory","Cadelle","Sylvax"],"epithets":["the Exquisite","of the Third Chord","Silk-Voiced","the Unsated"]},
  "daemons":{"first":["Skitterwhisper","Bilehope","Candlegrin","Vex-of-Nine","Marrowlight","Gigglestitch"],"epithets":["the Bargain-Made","Twice-Named","of the Thin Veil","the Borrowed"]},
  "astartes":{"first":["Brakan","Theol","Vastus","Herek","Ossian","Dathe"],"epithets":["of the Third Company","Shield-Sworn","the Unyielding","Oath-Keeper"]},
  "militarum":{"first":["Vasquez","Odo","Petra","Kell","Marn","Ilsa"],"epithets":["of the 8th","Two-Tours","the Lucky","Rations-Rich"]},
  "mechanicus":{"first":["Theta-Vox","Kryllia","Binar","Ossix","Datum-Kel","Rho-Jun"],"epithets":["of the Ninth Fane","Oil-Blessed","the Calibrated","Half-Converted"]},
  "sororitas":{"first":["Serapha","Elgiva","Maren","Cateline","Honora","Ysolt"],"epithets":["of the Candle","the Devoted","Hymn-Voiced","the Unbent"]},
  "custodes":{"first":["Aquillon","Vared","Kastor","Helion","Tyvar","Ordan"],"epithets":["of the Long Watch","the Unsleeping","Gold-Bound","the Measured"]},
  "tyranids":{"first":["Node-Shape","The Pale Swimmer","Chitin-Voice","The Tasting One","Spiral-Growth","The Near Mouth"],"epithets":["of the Pool","synapse-adjacent","new-budded","of the old strain"]},
  "orks":{"first":["Grubsnik","Dakkat","Wazgor","Snikkle","Mogrok","Bogrot"],"epithets":["da Loud","Teef-Rich","da Sneaky","One-Ear"]},
  "necrons":{"first":["Ahmontekh","Szeret","Nephrekh-Ka","Otekh","Vashtorr-Il","Semnat"],"epithets":["of the Third Dynasty","the Long-Sleeping","Protocol-Keeper","the Remembered"]},
  "aeldari":{"first":["Ilyande","Sethriel","Maelor","Yvienne","Corael","Thandriel"],"epithets":["of the Winding Path","Song-Keeper","the Twice-Walked","Dome-Born"]},
  "drukhari":{"first":["Vessaine","Kheradruakh-Min","Sylsk","Araqiel","Morvyx","Lilhaerys"],"epithets":["the Attentive","of the Lower Boxes","Poison-Kind","the Patient"]},
  "tau":{"first":["Shas'la Kovash","Por'ui Denva","Fio'el Kais","Ui'Taro","La'Vesa","El'Ordan"],"epithets":["of the Third Sphere","the Earnest","Bond-Sworn","of the Greater Good"]},
  "gsc":{"first":["Cousin Hale","Mother Sedge","Brind","Cousin Ottel","Aunt Verey","Old Kesh"],"epithets":["Third-Curl","of the Family","the Blessed","First-Generation"]},
  "votann":{"first":["Dothi","Ymir-Kel","Brokkr","Astrid","Ulf","Hetta"],"epithets":["of the Hearth","Grudge-Keeper","the Prospected","Kin-Right"]},
  "harlequins":{"first":["The Laughing Third","Mirthless","The Turned Card","Half-Mask","The Winter Player","Cadence"],"epithets":["of the Masque","role-bound","the Rehearsed","who exits early"]}
 },
 "events":[
  {"id":"famine_table","trigger":"famine","crowd_delta":-2,"banner":"The Famine Table — thin faces, thinner soup. Food is worth more than gold tonight."},
  {"id":"plague_night","trigger":"taint","crowd_delta":-1,"banner":"Plague Night — coughing in the corners; nobody sits close."},
  {"id":"good_season","trigger":"thriving","crowd_delta":2,"banner":"The Good Season — the room is loud, generous, and spending."},
  {"id":"holy_day","trigger":"calendar","crowd_delta":2,"banner":"A Holy Day — the culture's own feast; offerings honored double."}
 ]
},
```

Add top-level `civilians` (sibling of `npcs_alpha`):

```json
"civilians":{
 "black_legion":{"n":"Chattel-Thrall","pc":4,"w":1,"sp":4,"sl":0,"sex":"varied"},
 "death_guard":{"n":"Pox-Tender","pc":5,"w":2,"sp":3,"sl":0,"sex":"varied"},
 "world_eaters":{"n":"Pit-Serf","pc":5,"w":1,"sp":5,"sl":0,"sex":"varied"},
 "thousand_sons":{"n":"Dust-Scribe","pc":4,"w":1,"sp":4,"sl":1,"sex":"varied"},
 "emperors_children":{"n":"Salon Attendant","pc":4,"w":1,"sp":5,"sl":0,"sex":"varied"},
 "daemons":{"n":"Veil-Touched Drudge","pc":5,"w":1,"sp":4,"sl":0,"sex":"varied"},
 "astartes":{"n":"Chapter Serf","pc":5,"w":1,"sp":4,"sl":1,"sex":"male"},
 "militarum":{"n":"Civilian Laborer","pc":4,"w":1,"sp":4,"sl":0,"sex":"varied"},
 "mechanicus":{"n":"Menial-Servitor","pc":5,"w":2,"sp":3,"sl":0,"sex":"varied"},
 "sororitas":{"n":"Lay Sister","pc":5,"w":1,"sp":4,"sl":1,"sex":"female"},
 "custodes":{"n":"Palace Menial","pc":4,"w":1,"sp":4,"sl":0,"sex":"male"},
 "tyranids":{"n":"Drone-Organism","pc":6,"w":2,"sp":5,"sl":0,"sex":"varied"},
 "orks":{"n":"Grot Civvie","pc":3,"w":1,"sp":5,"sl":0,"sex":"varied"},
 "necrons":{"n":"Awakened Menial","pc":6,"w":2,"sp":3,"sl":0,"sex":"varied"},
 "aeldari":{"n":"Path-Walker","pc":5,"w":1,"sp":6,"sl":1,"sex":"varied"},
 "drukhari":{"n":"Sub-Kabal Drudge","pc":5,"w":1,"sp":6,"sl":0,"sex":"varied"},
 "tau":{"n":"Earth-Caste Worker","pc":4,"w":1,"sp":4,"sl":1,"sex":"varied"},
 "gsc":{"n":"Cult Neophyte","pc":6,"w":2,"sp":5,"sl":1,"sex":"varied"},
 "votann":{"n":"Hold Kinsman","pc":6,"w":2,"sp":4,"sl":1,"sex":"varied"},
 "harlequins":{"n":"Stagehand","pc":5,"w":1,"sp":6,"sl":0,"sex":"varied"}
},
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/canon-hall.test.js` → PASS. Run `node --test` → full suite green
(watch for any pin asserting the exact set of top-level canon keys or `rules` keys — update
in the same commit if one exists).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-hall.test.js
git commit -m "canon: rules.hall (20 cultures, pools, names, 4 mood events) + civilians block (T-MOD-1 fold-in)"
```

---

### Task 3: HALL core — region, seeding, `patronsAt`

**Files:**
- Modify: `index.html` — insert the new region immediately after `/*</cadence-core>*/`
- Create: `tests/_load-hall.js`, `tests/hall-core.test.js`

**Interfaces:**
- Produces: global `HALL` with `rng(seed)`, `hashStr(s)`,
  `patronsAt(ctx, canon) -> [{name, role, registers, sex, fac, model}]`, and (Tasks 4–5)
  `rumorFor`, `moodEventAt`, `offerEval`. `ctx` = `{locId, locType, tier, phaseIndex, day,
  fac, cond, status, seedBase}` — all primitive, engine-glue-built (Task 6).
- Consumes: `rules.hall.*` and `civilians` from Tasks 1–2.

- [ ] **Step 1: Write the loader + failing tests**

Create `tests/_load-hall.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadHall() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<hall-core>\*\/([\s\S]*?)\/\*<\/hall-core>\*\//);
  if (!m) throw new Error('hall-core region not found in index.html');
  const result = vm.runInThisContext('(function(){' + m[1] + '\n;return HALL;})()');
  if (!result || !result.patronsAt) throw new Error('hall-core did not define HALL');
  return result;
}
module.exports = { loadHall };
```

Create `tests/hall-core.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadHall } = require('./_load-hall');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const HALL = loadHall();

function ctx(over) {
  const base = { locId: 'vigilus/sanctum', locType: 'hive', tier: 2, phaseIndex: 5,
    day: 40, fac: 'militarum', cond: 'Intact', status: 'Peace', seedBase: 12345 };
  return Object.assign(base, over || {});
}

test('patronsAt is deterministic: same ctx, same crowd, forever', () => {
  const a = HALL.patronsAt(ctx(), D);
  const b = HALL.patronsAt(ctx(), D);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 4 && a.length <= 7, 'tier-2 night crowd size, got ' + a.length);
});

test('patrons carry the full shape: role from the loc-type pool, name from the culture pool, a body', () => {
  const ps = HALL.patronsAt(ctx(), D);
  const roles = D.rules.hall.pools.hive.map(p => p.role)
    .concat(D.rules.hall.status_roles.Sacked.map(p => p.role))
    .concat(D.rules.hall.status_roles.Besieged.map(p => p.role));
  for (const p of ps) {
    assert.ok(roles.indexOf(p.role) >= 0, 'unknown role ' + p.role);
    assert.ok(p.name.length > 3, 'no name');
    assert.ok(p.registers.length >= 1, 'no registers');
    assert.ok(['male', 'female'].indexOf(p.sex) >= 0, 'unresolved sex: ' + p.sex);
    assert.equal(p.model.n, D.civilians.militarum.n, 'body should be the culture civilian');
  }
});

test('day and phase change the crowd; a different location differs', () => {
  const a = JSON.stringify(HALL.patronsAt(ctx(), D));
  assert.notEqual(JSON.stringify(HALL.patronsAt(ctx({ day: 41 }), D)), a);
  assert.notEqual(JSON.stringify(HALL.patronsAt(ctx({ locId: 'nurth/garden' }), D)), a);
});

test('phase drives size: dead-of-night thinner than evening at the same tier', () => {
  const night = HALL.patronsAt(ctx({ phaseIndex: 4 }), D).length;
  const dead = HALL.patronsAt(ctx({ phaseIndex: 7 }), D).length;
  assert.ok(dead <= night, 'dead-of-night should not out-crowd evening');
});

test('Sacked ground pulls looters/refugees into the pool', () => {
  let seen = false;
  for (let d = 1; d < 30 && !seen; d++) {
    const ps = HALL.patronsAt(ctx({ cond: 'Sacked', day: d }), D);
    seen = ps.some(p => p.role === 'Looter' || p.role === 'Refugee');
  }
  assert.ok(seen, 'status roles never surfaced across 30 days of Sacked');
});

test('sex honors the culture rule: sororitas hall seeds female patrons', () => {
  const ps = HALL.patronsAt(ctx({ fac: 'sororitas' }), D);
  for (const p of ps) assert.equal(p.sex, 'female');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/hall-core.test.js` → FAIL ("hall-core region not found").

- [ ] **Step 3: Implement the region**

In `index.html`, immediately after `/*</cadence-core>*/`, insert:

```js
/*<hall-core>*/
/* T-SOC-1 slice A — pure, DOM-free Hall generation: patrons, rumors, mood events.
   Canon/ctx arrive as arguments. NO Date.now()/Math.random(): determinism comes from
   mulberry32 seeded off persisted ctx.seedBase (missionSeedBase), day, location, phase.
   Spec: docs/superpowers/specs/2026-09-06-social-door-design.md */
var HALL=(function(){
  function rng(seed){var a=seed>>>0;return function(){
    a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){
    h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function H(canon){return (canon.rules&&canon.rules.hall)||{};}
  function pick(arr,r){return arr[Math.floor(r()*arr.length)%arr.length];}
  function poolOf(ctx,canon){
    var base=(H(canon).pools||{})[ctx.locType]||[];
    var st=(H(canon).status_roles||{})[ctx.cond]||[];
    return base.concat(st);   // status roles join (never replace) the native pool
  }
  function sexOf(fac,canon,r){
    var civ=(canon.civilians||{})[fac]||{};
    if(civ.sex==='male'||civ.sex==='female')return civ.sex;
    return r()<0.5?'male':'female';
  }
  function nameOf(fac,canon,r){
    var n=(H(canon).names||{})[fac]||{first:['Nameless'],epithets:['the Quiet']};
    return pick(n.first,r)+' '+pick(n.epithets,r);
  }
  function crowdSize(ctx,canon,r){
    var band=(H(canon).crowd||{})[String(ctx.tier)]||[2,4];
    var n=band[0]+Math.floor(r()*(band[1]-band[0]+1));
    if(ctx.phaseIndex===4||ctx.phaseIndex===5||ctx.phaseIndex===6)n+=1;   // evening/night/midnight
    if(ctx.phaseIndex===0||ctx.phaseIndex===7)n-=1;                       // early morning/dead of night
    return Math.max(band[0],Math.min(band[1],n));
  }
  /* patronsAt: tonight's crowd — a pure function of (seedBase, locId, day, phaseIndex,
     tier, locType, cond, fac). Same inputs = same faces, forever (tier-1 RENDERED on the
     materialization ladder: recomputed, never stored). */
  function patronsAt(ctx,canon){
    var r=rng((ctx.seedBase>>>0)^hashStr('hall:'+ctx.locId+':'+ctx.day+':'+ctx.phaseIndex));
    var pool=poolOf(ctx,canon);if(!pool.length)return [];
    var n=crowdSize(ctx,canon,r),out=[],civ=(canon.civilians||{})[ctx.fac]||null;
    for(var i=0;i<n;i++){
      var row=pick(pool,r);
      out.push({name:nameOf(ctx.fac,canon,r),role:row.role,
        registers:row.registers.slice(),sex:sexOf(ctx.fac,canon,r),
        fac:ctx.fac,model:civ});
    }
    return out;
  }
  return {rng:rng,hashStr:hashStr,patronsAt:patronsAt,poolOf:poolOf,crowdSize:crowdSize};
})();
/*</hall-core>*/
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/hall-core.test.js` → PASS (6/6). Run `node --test` → suite green
(`tests/engine-syntax.test.js` is the headless boot proxy — it will catch any syntax slip in
the inserted region).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/_load-hall.js tests/hall-core.test.js
git commit -m "engine: hall-core region — deterministic patron seeding (pools x status x culture, phase-sized crowds)"
```

---

### Task 4: HALL core — `rumorFor` (true-rumor routing)

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Produces: `HALL.rumorFor(patron, wctx, ctx, canon) -> {register, line}` — deterministic per
  (patron, day). `wctx` = `{war:[{loc,fac,days}], state:[{name,status}], trade:[{planet,
  mission}], ground:[title,…]}` — arrays of primitives, glue-built in Task 6; EMPTY arrays
  are legal (quiet galaxy).
- Consumes: Task 3's `rng`/`hashStr`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/hall-core.test.js`:

```js
const WCTX = {
  war: [{ loc: 'Garden of Cysts', fac: 'Black Legion', days: 3 }],
  state: [{ name: 'Pallid Reach', status: 'Famine' }],
  trade: [{ planet: 'Nurth', mission: 'Purge the Warrens' }],
  ground: ['The Sack of the Sanctum'],
};

test('rumorFor routes through the patron\'s registers and speaks real state', () => {
  const trooper = { name: 'Kell of the 8th', role: 'Garrison Trooper', registers: ['war', 'ground'] };
  const r = HALL.rumorFor(trooper, WCTX, ctx(), D);
  assert.equal(r.register, 'war');
  assert.ok(r.line.indexOf('Garden of Cysts') >= 0 && r.line.indexOf('3') >= 0, 'war rumor must cite the real clock: ' + r.line);
});

test('rumorFor falls through empty registers to the next one with data', () => {
  const trooper = { name: 'Kell', role: 'Trooper', registers: ['war', 'ground'] };
  const quiet = { war: [], state: [], trade: [], ground: ['The Sack of the Sanctum'] };
  const r = HALL.rumorFor(trooper, quiet, ctx(), D);
  assert.equal(r.register, 'ground');
  assert.ok(r.line.indexOf('The Sack of the Sanctum') >= 0);
});

test('rumorFor with a totally quiet galaxy returns the no-news line', () => {
  const p = { name: 'Odo', role: 'Merchant', registers: ['trade'] };
  const r = HALL.rumorFor(p, { war: [], state: [], trade: [], ground: [] }, ctx(), D);
  assert.equal(r.register, 'none');
  assert.ok(r.line.length > 10);
});

test('rumorFor is stable within a day, changes across days', () => {
  const p = { name: 'Kell', role: 'Trooper', registers: ['war', 'state', 'trade', 'ground'] };
  const a = HALL.rumorFor(p, WCTX, ctx(), D);
  assert.deepEqual(HALL.rumorFor(p, WCTX, ctx(), D), a);
  const many = new Set();
  for (let d = 1; d <= 20; d++) many.add(HALL.rumorFor(p, WCTX, ctx({ day: d }), D).line);
  assert.ok(many.size > 1, 'rumor should vary across days');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/hall-core.test.js` → FAIL (`HALL.rumorFor is not a function`).

- [ ] **Step 3: Implement inside the region**

Add before the `return` of the HALL IIFE, and export it:

```js
  /* rumorFor: TRUE rumors — every line cites real world state handed in via wctx.
     Register priority = the patron's own order; first register with data wins.
     Seeded per (patron, day, loc): the same soul tells the same tale all day. */
  var RUMOR_TPL={
    war:function(e,r){return pick([
      'mutters of war — '+e.fac+' presses '+e.loc+'; the clock stands at '+e.days+' days.',
      'says '+e.loc+' is under the gun: '+e.fac+', '+e.days+' days to answer.'],r);},
    state:function(e,r){return pick([
      'says the '+e.name+' reads '+e.status+' — you can feel it from here.',
      'heard the '+e.name+' has gone '+e.status+'.'],r);},
    trade:function(e,r){return pick([
      'says there is work posted on '+e.planet+' — "'+e.mission+'", they say.',
      'heard coin moves on '+e.planet+': '+e.mission+'.'],r);},
    ground:function(e,r){return pick([
      'remembers this ground: '+e+'.',
      'will tell anyone who buys: '+e+'.'],r);}
  };
  function rumorFor(patron,wctx,ctx,canon){
    var r=rng((ctx.seedBase>>>0)^hashStr('rum:'+ctx.locId+':'+ctx.day+':'+patron.name));
    for(var i=0;i<patron.registers.length;i++){
      var reg=patron.registers[i],entries=(wctx||{})[reg]||[];
      if(!entries.length)continue;
      var e=pick(entries,r);
      return {register:reg,line:patron.name+' '+RUMOR_TPL[reg](e,r)};
    }
    return {register:'none',line:patron.name+' has nothing for you tonight — quiet days, thank the powers.'};
  }
```

Add `rumorFor:rumorFor` to the returned object.

- [ ] **Step 4: Run tests**

Run: `node --test tests/hall-core.test.js` → PASS. Full `node --test` green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/hall-core.test.js
git commit -m "engine: hall-core rumorFor — register-routed TRUE rumors (war/state/trade/ground), day-stable seeding"
```

---

### Task 5: HALL core — `moodEventAt` + `offerEval`

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Produces: `HALL.moodEventAt(ctx, wctx2, canon) -> {id, banner, crowd_delta}|null` where
  `wctx2` = `{status, taint}` (`status` = THIS location's sector status string, `taint` =
  0–100 sector taint score). Priority = canon row order (famine > plague > good_season >
  holy_day); max one per day. `HALL.offerEval(event, ctx, canon) -> {kind, cost, accepts,
  res, disp, label}` — the OFFER verb's priced outcome under tonight's event.
- Consumes: `rules.hall.events`, `rules.hall.offer`, `rules.hall.culture` (Task 2).

- [ ] **Step 1: Write the failing tests**

Append to `tests/hall-core.test.js`:

```js
test('moodEventAt: famine outranks thriving-adjacent noise; taint fires plague; quiet peace = null or holy day only', () => {
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Famine', taint: 10 }, D).id, 'famine_table');
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Warring', taint: 80 }, D).id, 'plague_night');
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Thriving', taint: 10 }, D).id, 'good_season');
  const quiet = HALL.moodEventAt(ctx(), { status: 'Peace', taint: 10 }, D);
  assert.ok(quiet === null || quiet.id === 'holy_day');
});

test('holy_day fires on the culture calendar, deterministically', () => {
  const mod = D.rules.hall.holy_day_mod;
  const facDay = HALL.hashStr('militarum') % mod;
  let day = facDay === 0 ? mod : facDay;   // find a day that matches the culture's slot
  while (day % mod !== facDay) day++;
  const hit = HALL.moodEventAt(ctx({ day: day }), { status: 'Peace', taint: 0 }, D);
  assert.ok(hit && hit.id === 'holy_day', 'expected holy_day on day ' + day);
  const miss = HALL.moodEventAt(ctx({ day: day + 1 }), { status: 'Peace', taint: 0 }, D);
  assert.ok(miss === null, 'expected quiet on day ' + (day + 1));
});

test('offerEval prices the culture offering under tonight\'s event', () => {
  const base = HALL.offerEval(null, ctx(), D);
  assert.equal(base.kind, 'cur');
  assert.equal(base.cost, D.rules.hall.offer.cost);
  assert.equal(base.disp, D.rules.hall.offer.disp);
  const good = HALL.offerEval({ id: 'good_season' }, ctx(), D);
  assert.ok(good.cost < base.cost, 'good season discounts the round');
  const holy = HALL.offerEval({ id: 'holy_day' }, ctx(), D);
  assert.equal(holy.disp, base.disp * D.rules.hall.offer.holy_day_disp_mult);
  const famineFood = HALL.offerEval({ id: 'famine_table' }, ctx({ fac: 'tyranids' }), D);
  assert.equal(famineFood.kind, 'res');
  assert.equal(famineFood.disp, base.disp * D.rules.hall.offer.famine_food_disp_mult);
  const skulls = HALL.offerEval(null, ctx({ fac: 'world_eaters' }), D);
  assert.equal(skulls.kind, 'item');
  assert.equal(skulls.accepts, 'REMAINS');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/hall-core.test.js` → FAIL (`moodEventAt is not a function`).

- [ ] **Step 3: Implement inside the region**

```js
  /* moodEventAt: max ONE event per hall per day; canon row order IS priority
     (hardship outranks celebration). Pure — no rng needed: triggers are state
     predicates, holy_day is calendar math (hash(fac) mod holy_day_mod). */
  function moodEventAt(ctx,w,canon){
    var rows=H(canon).events||[],i,e;
    for(i=0;i<rows.length;i++){e=rows[i];
      if(e.trigger==='famine'&&w.status==='Famine')return e;
      if(e.trigger==='taint'&&(w.taint||0)>=(H(canon).taint_plague_gte||60))return e;
      if(e.trigger==='thriving'&&w.status==='Thriving')return e;
      if(e.trigger==='calendar'){
        var mod=H(canon).holy_day_mod||23,slot=hashStr(ctx.fac)%mod;
        if(ctx.day%mod===slot)return e;
      }
    }
    return null;
  }
  /* offerEval: the OFFER verb priced under tonight's event. Returns everything the
     renderer + handler need: what it costs (cur|item|res), what it pays (disp). */
  function offerEval(event,ctx,canon){
    var O=H(canon).offer||{},cul=(H(canon).culture||{})[ctx.fac]||{},of=cul.offer||{kind:'cur'};
    var cost=O.cost||3,disp=O.disp||1;
    if(event&&event.id==='good_season')cost=Math.max(1,Math.round(cost*(O.good_season_cost_mult||1)));
    if(event&&event.id==='holy_day')disp=disp*(O.holy_day_disp_mult||1);
    if(event&&event.id==='famine_table'&&of.kind==='res'&&of.res==='Food')
      disp=disp*(O.famine_food_disp_mult||1);
    return {kind:of.kind,cost:cost,accepts:of.accepts||null,res:of.res||null,
      disp:disp,label:cul.offer_label||'Make an offering'};
  }
```

Export both: add `moodEventAt:moodEventAt,offerEval:offerEval` to the return.

- [ ] **Step 4: Run tests**

Run: `node --test tests/hall-core.test.js` → PASS. Full `node --test` green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/hall-core.test.js
git commit -m "engine: hall-core moodEventAt (state-triggered, one/day, priority order) + offerEval (culture offering priced under the event)"
```

---

### Task 6: Engine glue — `hallCtxOf`, `renderHall`, COMMUNE/OFFER handlers, `S.social`

**Files:**
- Modify: `index.html` — door glue near `renderDoor` (~line 6990–7140), the `S` defaults
  literal (~5498), `init()` backfill (near the `S.world.unrest` backfill, ~6431)

**Interfaces:**
- Consumes: `HALL.*` (Tasks 3–5); existing accessors — `fPl(pid)`, `fLoc(pid,lid)`,
  `LT(typeId)`, `doorTierAt(pl,loc,kind)`, `effCond(loc)`, `pRuler(pl)`,
  `doorFactionId()` (culture follows the RULER — shipped door-culture precedent),
  `WORLD.sectorStatus(scores,D)` + `liveScores(sid)`, `NPCAI.stampAtProfile(...)` (phaseIndex
  + day), `S.world.missionSeedBase`, `S.world.missions` (boards), `S.world.chronicle` +
  `CHRON.titleOf`, `S.threads` (`t.ultimatum` clocks), `spendStock/stockOf` (Food offers),
  `toast(...)`, `esc(...)`, `GLOSS`/`annotate` idioms.
- Produces: `S.social = {pat:{}}` — key `locId+'/'+name` →
  `{disp:int, offers:int, lastDay:int, communed:{}}`; the Slice-B trust ladder reads this.

- [ ] **Step 1: Seed `S.social` (both sites — the established gotcha)**

In the `S` defaults literal (the object containing `npcState:{},active:'cmdr',cart:[]`), add:

```js
 social:{pat:{}},
```

In `init()`, next to the existing `if(!S.world.unrest)S.world.unrest={};` backfill, add:

```js
  if(!S.social)S.social={pat:{}};
```

- [ ] **Step 2: Build the context glue**

Near `renderDoor` (door glue area), add:

```js
/* T-SOC-1 slice A: one snapshot of everything the Hall reads. The Hall invents no
   state — it is the first door that reads ALL of it at once (spec §1). */
function hallCtxOf(h){
  var pl=fPl(S.pos.pl),loc=fLoc(S.pos.pl,S.pos.sp);
  var st=NPCAI.stampAtProfile(S.time.epoch,Date.now(),D,curProfile());
  var scores=liveScores(pl.sid)||{};
  var ctx={locId:S.pos.pl+'/'+S.pos.sp,locType:loc.type,tier:h.tier,
    phaseIndex:st.phaseIndex,day:st.day,fac:doorFactionId()||'militarum',
    cond:effCond(loc),status:WORLD.sectorStatus(scores,D),
    seedBase:(S.world.missionSeedBase||0)};
  // wctx: TRUE rumor sources — every entry is real, live state
  var war=[];(S.threads||[]).forEach(function(t){
    if(t.ultimatum&&!t.done)war.push({loc:t.loc||'contested ground',
      fac:(FAC(t.ultimatum.aggressor)||{}).name||t.ultimatum.aggressor||'someone',
      days:Math.max(0,(t.ultimatum.expiresDay||0)-st.day)});});
  var state=[];D.galaxy.segmentums.forEach(function(sg){(sg.sectors||[]).forEach(function(sec){
    var ss=WORLD.sectorStatus(liveScores(sec.id)||{},D);
    if(ss==='Famine'||ss==='Warring'||ss==='Thriving')state.push({name:sec.name,status:ss});});});
  var trade=[];Object.keys(S.world.missions||{}).forEach(function(pid){
    if(pid===S.pos.pl)return;
    (S.world.missions[pid]||[]).slice(0,1).forEach(function(m){
      var p=fPl(pid);if(p&&p.p)trade.push({planet:p.p.name,mission:m.name||m.family});});});
  var ground=((S.world.chronicle||{})[S.pos.sp]||[]).slice(0,3).map(function(rec){
    return CHRON.titleOf(rec,loc.name);});
  var taint=scores.taint||0;
  return {ctx:ctx,wctx:{war:war,state:state,trade:trade,ground:ground},
    wctx2:{status:ctx.status,taint:taint},pl:pl,loc:loc};
}
```

⚠ Verify each accessor name at wiring time (they all exist today — `FAC`, `liveScores`,
`curProfile`, `fPl().sid`/`fPl().p` shapes): `grep -n "function liveScores\|function FAC(\|function curProfile" index.html`.
If `fPl(pid)` returns `{p,sid}` (it does at the throne-room call site `fPl(S.pos.pl).p.crown`),
keep the `.p`/`.sid` reads as written; adjust only if the grep shows otherwise.

- [ ] **Step 3: The renderer + handlers**

Add the branch in `renderDoor`'s kind chain (after the `arena` branch):

```js
 else if(kind==='hall'){
  if(S.pos.pl==null||h.id==null){c.insertAdjacentHTML('beforeend',
    '<div class="d">The door-demo sandbox has no crowd — visit a real Hall.</div>');}
  else{
   var hc=hallCtxOf({tier:tier}),cul=(D.rules.hall.culture||{})[hc.ctx.fac]||{};
   var ev=HALL.moodEventAt(hc.ctx,hc.wctx2,D);
   if(ev)hc.ctx.crowdEvent=ev.crowd_delta;
   var pats=HALL.patronsAt(hc.ctx,D);
   if(ev&&ev.crowd_delta)pats=ev.crowd_delta<0?pats.slice(0,Math.max(1,pats.length+ev.crowd_delta)):pats;
   var off=HALL.offerEval(ev,hc.ctx,D);
   var hh='<div class="d" style="margin-bottom:6px"><i>'+esc(cul.flavor||'A gathering place.')+'</i></div>';
   if(ev)hh+='<div class="d" style="border-left:3px solid var(--blh);padding-left:8px;margin-bottom:6px">'+esc(ev.banner)+'</div>';
   hh+=pats.map(function(p,i){return '<div class="lrow">'+esc(p.name)+' — <span style="color:var(--dim)">'+esc(p.role)+'</span>'
     +' <button class="bsm" data-hallcom="'+i+'">'+esc(cul.commune||'Talk')+'</button>'
     +' <button class="bsm" data-halloff="'+i+'">'+esc(off.label)+' ('+(off.kind==='cur'?off.cost+'c':off.kind==='res'?'1 '+off.res:'1 '+off.accepts)+')</button></div>';}).join('');
   hh+='<div class="d" id="hallout" style="margin-top:8px;color:var(--dim)"></div>';
   c.insertAdjacentHTML('beforeend',hh);
   c.querySelectorAll('[data-hallcom]').forEach(function(b){b.onclick=function(){
     hallCommune(pats[+b.dataset.hallcom],hc);};});
   c.querySelectorAll('[data-halloff]').forEach(function(b){b.onclick=function(){
     hallOffer(pats[+b.dataset.halloff],hc,off);};});
  }
 }
```

And the two handlers next to `hallCtxOf`:

```js
function hallPatKey(hc,p){return hc.ctx.locId+'/'+p.name}
function hallCommune(p,hc){
  var out=document.getElementById('hallout');if(!p||!out)return;
  var r=HALL.rumorFor(p,hc.wctx,hc.ctx,D);
  out.innerHTML=esc(r.line);
  var k=hallPatKey(hc,p),rec=S.social.pat[k]||(S.social.pat[k]={disp:0,offers:0,lastDay:0,communed:{}});
  rec.communed[hc.ctx.day]=r.register;rec.lastDay=hc.ctx.day;
  if(!window._noPersist)saveProfile(S);
}
function hallOffer(p,hc,off){
  var out=document.getElementById('hallout');if(!p||!out)return;
  if(off.kind==='cur'){
    if((S.cur||0)<off.cost){toast('Not enough currency.');return;}
    S.cur-=off.cost;
  }else if(off.kind==='res'){
    if(!spendStock(S.pos.pl,(function(o){o={};o[off.res]=1;return o;})())){toast('No '+off.res+' stocked on this world.');return;}
  }else if(off.kind==='item'){
    var idx=-1;for(var i=0;i<(S.inv||[]).length;i++){var it=S.inv[i];
      if(it.cat===off.accepts||(off.accepts==='REMAINS'&&/^Remains of /.test(it.n||''))
        ||(off.accepts==='CAPTIVE'&&(it.cat==='CAPTIVE'))){idx=i;break;}}
    if(idx<0){toast('You carry no fitting offering ('+off.accepts+').');return;}
    S.inv.splice(idx,1);
  }
  var k=hallPatKey(hc,p),rec=S.social.pat[k]||(S.social.pat[k]={disp:0,offers:0,lastDay:0,communed:{}});
  rec.disp+=off.disp;rec.offers++;rec.lastDay=hc.ctx.day;
  out.innerHTML=esc(p.name)+' accepts. ('+esc(p.name.split(' ')[0])+' disposition +'+off.disp+')';
  updateHUD&&updateHUD();
  if(!window._noPersist)saveProfile(S);
}
```

⚠ Before wiring the item branch, verify the REMAINS/CAPTIVE mint shape:
`grep -n "CAPTIVE\|Remains of" index.html | head -12` — confirm whether spoils items carry
`cat:'CAPTIVE'`/`cat:'REMAINS'` or are name-prefixed only, and align the filter to what is
actually minted (keep both checks if both exist). Also verify `spendStock`'s signature at its
definition (`grep -n "function spendStock" index.html`) — it takes `(planetId, resources)`
per the T-DOOR-1 close-out; adjust the call if the real shape differs.

- [ ] **Step 4: Node suite + browser E2E**

Run: `node --test` → green (engine-syntax proxy compiles the new glue).

Browser (Playwright MCP against `python3 -m http.server 8765`):
1. `window._noPersist=true` FIRST.
2. Found (or load) a commander; travel/stand at a location whose type carries `hall`
   (crown works: every crown has one now).
3. Open Requisition → the Hall door renders: skin name (ruler culture), flavor line, patron
   rows with the culture's commune/offer labels.
4. Click COMMUNE → a rumor line renders; reload the page (same day) → SAME patrons, SAME
   rumor (determinism visible).
5. Click OFFER with funds → currency drops by cost, disposition message renders; click
   with `S.cur=0` → refusal toast, no state change.
6. In-console: force a Famine reading by picking any sector currently Famine (or eval
   `HALL.moodEventAt` with `{status:'Famine',taint:0}`) → famine banner renders when live.
7. Door-demo sandbox (Requisition demo mode) → shows the no-crowd line, zero patron buttons.
8. Sweep all 7 screens + title → 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: the Hall renders — hallCtxOf world snapshot, crowd + COMMUNE (true rumors) + OFFER (culture-priced), S.social seeding, mood banners"
```

---

### Task 7: GLOSS, docs, board close-out, full sweep

**Files:**
- Modify: `index.html` (GLOSS object ~6689), `CLAUDE.md` (engine bullets), `BACKLOG.md`
  (T-SOC-1 row)

**Interfaces:** none new — close-out only.

- [ ] **Step 1: GLOSS entries**

Add to the `GLOSS` object (exact keys):

```js
 'Hall':'The social door — the culture\'s gathering space. Meet the crowd, hear true rumors drawn from real events, and make the culture\'s offering.',
 'Offering':'The Hall\'s social gesture — each culture accepts its own (a round, a data-tithe, a worthy skull, a captive). Paying it warms a patron\'s disposition.',
 'Rumor':'Hall talk is TRUE — every rumor cites live world state: war clocks, sector conditions, posted work, or this ground\'s own chronicle.',
```

Wire `annotate()`-style `.tipable` spans on: the Hall door header in Requisition (key
`'Hall'`), the offer button (`'Offering'`), and the `#hallout` rumor line (`'Rumor'`) —
follow the `doorTierTip` wiring pattern at the Requisition door header.

- [ ] **Step 2: CLAUDE.md + BACKLOG**

- `CLAUDE.md`: add one engine bullet after the N2 bullet — the Hall (T-SOC-1 slice A): new
  `hall` door kind (canon v1.38, 20 per-sub-faction skins, 16-type placement, Hive World T3
  home), pure `/*<hall-core>*/` (deterministic patrons off pools × status × culture,
  register-routed TRUE rumors, state-triggered mood events, culture-priced offerings),
  `S.social.pat` disposition ledger (Slice-B trust ladder reads it), `civilians` block
  (T-MOD-1 folded in). Note Slices B/C remain.
- `BACKLOG.md` T-SOC-1 row: status → `in-progress` → on completion `ready-to-push` with
  slice-A commit range, test count, paths list (this plan's five files), and "Slices B/C
  open" note.

- [ ] **Step 3: Full verification sweep**

Run: `node --test` → record the exact final count (expect ~660+: prior suite + ~13 new).
Browser: repeat the Task 6 sweep once more end-to-end after the GLOSS wiring (tooltips render
on hover; 0 console errors on all screens + title + door demo).

- [ ] **Step 4: Commit**

```bash
git add index.html CLAUDE.md BACKLOG.md
git commit -m "engine+docs: Hall slice-A close-out — GLOSS entries, CLAUDE.md bullet, backlog ready-to-push"
```

---

## Self-Review (run before handoff)

1. **Spec coverage:** §2 skins → T1; §3 crowd/pools/ladder/civilians → T2+T3; §4 COMMUNE/OFFER
   (CONTEST/PETITION are B/C by §12) → T5+T6; §5 rumors → T4; §7 mood rows → T5 (interaction
   rows are C); §10 placement/tiers/t3 → T1; §11 shapes → T2/T3/T6. Deferred by design:
   regulars, trust rungs, contests, powers, social missions, interaction events.
2. **Placeholder scan:** none — every step carries real code or an exact command; the two ⚠
   verify-then-wire steps name the exact grep and the expected shapes.
3. **Type consistency:** `patronsAt` patron shape `{name,role,registers,sex,fac,model}` is
   consumed by `rumorFor` (name, registers) and the renderer (name, role) — consistent.
   `offerEval` output `{kind,cost,accepts,res,disp,label}` consumed by `hallOffer` and the
   renderer — consistent. `ctx` primitives match between `hallCtxOf` and all HALL functions.
