# T-NPC-3.5 — Full-Loadout NPC Combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NPC forces spawn with full rank-scaled kits and choose actions through a scored, doctrine-tilted, seeded brain — abilities, warp casts, items, and tags finally matter in every AI battle — then the Balance Lab re-runs over the whole design space.

**Architecture:** A pure `KIT` generator mints faction-legal loadouts at every NPC spawn site. Inside the pure THREAD core, `npcTurn`'s action pick is replaced by a six-step brain (perceive → enumerate action+target pairs → score against canon bands → axis tilt → seeded top-band draw → stage+trace); kit payloads reach the core via an injected `kitOf` function, mirroring the existing injected `weaponsOf`. Two lab-found core bugs (corpse-vision, move-validate ordering) are fixed first so the brain perceives honestly. Statistical battles gain a small seeded kit nudge. Finally `tools/arena.js` swaps to the new brain and the WARBAND tournament re-runs.

**Tech Stack:** Vanilla ES5 in `index.html` (pure regions + glue), JSON canon, `node --test`, Playwright MCP browser E2E, `tools/arena.js` (node, dev-only).

**Spec:** `docs/superpowers/specs/2026-09-06-npc35-full-loadout-combat-design.md` — read it FIRST; its §0 rulings and §3 six-step brain are law. Research provenance: `docs/research/ai-action-selection/`.

## Global Constraints

- Read `CLAUDE.md` before anything: multi-agent board rules (claim your row in `BACKLOG.md`, engine lane is HOT), "model" never "chassis", canon vs engine separation.
- Canon: `heretics-40k-data-v1.json`, bump `meta.version` "1.37" → "1.38". Textual edits only — NEVER a python json.dump rewrite of the 1.5MB file. New blocks `rules.npc_kit` and `rules.npc_brain` sit beside `rules.cadence`.
- Engine: `index.html` only. ES5 (`var`/`function`) everywhere in it. Pure regions (`/*<thread-core>*/`, `/*<cadence-core>*/`, the new `/*<kit-core>*/`) read NO globals — canon/state/rng arrive as arguments; NO `Date.now()`/`Math.random()` inside.
- Seeds ride the established discipline: `ULT.rng`/`ULT.seedFor` (exposed from `/*<agency-core>*/`) or `CAD.seed`. Chunk-independence is LAW: any per-day effect must replay identically daily-vs-chunked.
- `git add <explicit paths>` only — NEVER `-A`/`.`. Suite baseline **646/646** (`node --test`, zero deps) — every commit ends green with new tests added. Do NOT push — mark `ready-to-push`; Daak pushes.
- Browser E2E per engine task: `python3 -m http.server 8765`, Playwright MCP, `window._noPersist=true` FIRST (protects the real save), real profile flow (title → NEW COMMANDER → Rites; `demoSave()` is dead code and throws). 0 console errors, full screen sweep at task end.
- Commit messages end with:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

**Seam map (grep to confirm exact lines; they drift):**
- `npcTurn(side,state,board,weaponsOf,canon,behavior)` — pure core, ~index.html:1326; `weaponsOf(c)` is INJECTED (the pattern this plan extends with `kitOf`).
- `spottedEnemies(side,state,board)` ~1087 (the corpse-vision fix site); `validate` move-reachability (grep `reachable(` inside validate).
- `condEffectsFor(item,casterId,chosenTarget,state,party)` ~5479 — ENGINE-side payload builder the player UI uses; `condTagsOf`, `condIsHostile`, `livingAllies`, `cleanseReach` beside it. The glue task builds `kitOf` from these; the core never calls them directly.
- `apMod(it)` ~586: CAST costs 2 AP, ABILITY 1, ITEM 0. `DOOR.castRank(d)` ~1957 parses `R5`-style rank gates. `doorCatalog(kind,tier)` ~6970 shows the faction-legal filter (`pick()` = commons + own faction).
- `MISSION.genHostiles` ~2161 mints NPC model specs; `genHostCombatants` (grep) is the shared NPC-side spawn helper (sieges/dramas); `seedCombat` ~3001 the mission-thread spawn.
- `THREAD.AXES.rollFor(facId,seedStr,canon)` → `{ferocity,cunning,pragmatism,honor,supremacism}`; `THREAD.doctrineOf`.
- Lapse arithmetic: `resolveUltLapses` (grep) + `resolveFarBattle` — the §4 nudge sites.
- Arena: `tools/arena.js` (T-QA-2, commit cfdb674) — the Lab v2 task rewires its driver.

---

### Task 1: Canon v1.38 — `rules.npc_kit` + `rules.npc_brain`

**Files:**
- Modify: `heretics-40k-data-v1.json`
- Create: `tests/canon-npcbrain.test.js`
- Modify: every test pinning `'1.37'` (grep `-rn "'1.37'" tests/` — expect ~6 files)

**Interfaces:**
- Produces: `D.rules.npc_kit` and `D.rules.npc_brain` exactly as below — every later task reads these keys verbatim.

- [ ] **Step 1: Failing canon test** — `tests/canon-npcbrain.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('meta.version is 1.38', () => { assert.strictEqual(D.meta.version, '1.38'); });

test('rules.npc_kit shape', () => {
  const k = D.rules.npc_kit;
  assert.deepStrictEqual(k.depth_by_rank, {
    "1": {items: 0.5, abilities: 0, casts: false},
    "2": {items: 1,   abilities: 1, casts: false},
    "3": {items: 1,   abilities: 1, casts: true},
    "4": {items: 1,   abilities: 1, casts: true},
    "5": {items: 1,   abilities: 1, casts: true}
  });
});

test('rules.npc_brain shape', () => {
  const b = D.rules.npc_brain;
  assert.deepStrictEqual(b.bands, {
    basic_attack: [8, 12], offensive: [20, 40], support: [25, 45], reaction: [50, 70] });
  assert.strictEqual(b.draw_cutoff, 0.7);
  assert.strictEqual(b.inertia_bonus, 0.15);
  assert.deepStrictEqual(b.tilt, {
    ferocity:   {targets: "melee_close", pivot: 50, max_mult: 1.6},
    cunning:    {targets: "denial_ranged", pivot: 50, max_mult: 1.6},
    supremacism:{targets: "leader", pivot: 50, max_mult: 1.6},
    honor_high: 70, honor_low: 30,
    pragmatism_item_pivot: 50 });
  assert.deepStrictEqual(b.lapse_kit_nudge, {per_caster: 0.004, per_ability: 0.002, cap: 0.03});
});
```

- [ ] **Step 2: Run → FAIL** (`node --test tests/canon-npcbrain.test.js`).
- [ ] **Step 3: Author canon** — bump `meta.version` to `"1.38"`, `"updated"` to today; insert beside `rules.cadence` (values above are the single source; note field flagged tunables):

```json
"npc_kit": {
 "note": "T-NPC-3.5. Depth ladder LOCKED shape (Daak 2026-09-06); values are flagged tunables. items = seeded probability of one item (1 = always); abilities = count for rank>=2; casts gated additionally by the model having a cast-capable slot and DOOR.castRank vs model rk.",
 "depth_by_rank": {
  "1": {"items": 0.5, "abilities": 0, "casts": false},
  "2": {"items": 1, "abilities": 1, "casts": false},
  "3": {"items": 1, "abilities": 1, "casts": true},
  "4": {"items": 1, "abilities": 1, "casts": true},
  "5": {"items": 1, "abilities": 1, "casts": true}
 }
},
"npc_brain": {
 "note": "T-NPC-3.5. Six-step brain (spec §3). Bands per DA:I authoring contract; draw per Battle Brothers; ALL values flagged tunables.",
 "bands": {"basic_attack": [8, 12], "offensive": [20, 40], "support": [25, 45], "reaction": [50, 70]},
 "draw_cutoff": 0.7,
 "inertia_bonus": 0.15,
 "tilt": {
  "ferocity": {"targets": "melee_close", "pivot": 50, "max_mult": 1.6},
  "cunning": {"targets": "denial_ranged", "pivot": 50, "max_mult": 1.6},
  "supremacism": {"targets": "leader", "pivot": 50, "max_mult": 1.6},
  "honor_high": 70, "honor_low": 30,
  "pragmatism_item_pivot": 50
 },
 "lapse_kit_nudge": {"per_caster": 0.004, "per_ability": 0.002, "cap": 0.03}
},
```

- [ ] **Step 4: Sweep pins** — grep `'1.37'` in `tests/`, bump all to `'1.38'` (also `v1.37` in test names). Full `node --test` → 646 + new, 0 fail.
- [ ] **Step 5: Commit** — `git add heretics-40k-data-v1.json tests/canon-npcbrain.test.js <each pin file>`; message `"canon: v1.38 — rules.npc_kit + rules.npc_brain (T-NPC-3.5 task 1)"`.

---

### Task 2: Core fixes — corpse-vision + move-validate ordering

**Files:**
- Modify: `index.html` (`/*<thread-core>*/`: `spottedEnemies` ~1087, `validate`'s move check)
- Modify: `tests/grid-fog.test.js`, `tests/thread-core.test.js` (new pins)
- Modify: `tools/arena.js` (REMOVE its two workarounds once the core is honest — grep `corpse`/`retry` comments in it; its self-checks must still pass)

**Interfaces:**
- Produces: `spottedEnemies` returns LIVING enemies only; `validate` accepts a block whose moves are consistent in assignment order. Task 5's brain depends on both.

- [ ] **Step 1: Failing pins.** In `tests/grid-fog.test.js` add (mirror the file's existing state-fixture style — read its helpers first and reuse them):

```js
test('spottedEnemies excludes the dead (T-NPC-3.5 fix 1)', () => {
  // fixture: two sides; enemy A dead (dead:true, w:[0,x]) at close range with clear LOS,
  // enemy B alive but out of sight range. Build with the file's existing mkState/board helpers.
  const spotted = THREAD.spottedEnemies('mine', st, board);
  assert.ok(!spotted.includes(deadId), 'a corpse must not be spotted');
});
```

In `tests/thread-core.test.js` add a leapfrog pin: model M1 staged to move from cell a→b, M2 staged b→c in the SAME block, both moves individually legal in that order — `THREAD.validate` must accept (today it rejects because M2's source-cell check sees b occupied). Build the block in the file's existing action-block shape (read a passing move test and extend it).

- [ ] **Step 2: Run → both FAIL.**
- [ ] **Step 3: Implement.** (a) In `spottedEnemies`, filter candidates to `!c.dead && c.w[0]>0` before the sight/LOS checks — read how the `live` filter inside `npcTurn` does it (~1330s) and use the same predicate. (b) In `validate`'s move loop, process staged moves against a WORKING position map: start from state positions, apply each accepted move to the map before checking the next (assignment order). Player-staged single-move blocks behave identically (one move = no interaction). Keep every other check (reachability radius, terrain, occupancy by NON-moving models) unchanged.
- [ ] **Step 4: Arena cleanup.** In `tools/arena.js` remove the corpse-blind-advance special-case and the strip-moves retry fallback (grep the Methodology-notes wording from `.superpowers` reports if unclear); run `node tools/arena.js` — the startup determinism self-check must pass and a small tournament must complete without stalls.
- [ ] **Step 5: Full suite + commit** — `git add index.html tests/grid-fog.test.js tests/thread-core.test.js tools/arena.js`; message `"engine: T-NPC-3.5 task 2 — corpse-vision + move-order validate fixes (lab-found core bugs)"`.

---

### Task 3: `kit-core` — the KIT generator

**Files:**
- Modify: `index.html` — new `/*<kit-core>*/ … /*</kit-core>*/` region immediately AFTER `/*</cadence-core>*/`
- Create: `tests/_load-kit.js` (mirror `tests/_load-cadence.js`; extract `kit-core`, return `KIT`)
- Create: `tests/kit-core.test.js`

**Interfaces:**
- Consumes: canon (`rules.npc_kit`, `D.weapons/items/abilities/casts`, faction rosters), an rng factory (caller passes `ULT.rng`).
- Produces: `KIT.mint(facId, model, seed, rngFn, canon) → {items:[it], abilities:[it], casts:[it]}` — `model` = `{rk, cls, sub}` (a generated-spec shape); `it` = catalog rows `{n,cat,d,pc,faction}`. Also `KIT.legalFor(facId, cat, canon) → [rows]` (commons + own-faction, mirroring doorCatalog's filter) and `KIT.kitDepth(state_side_combatants) → {casters, abilityCarriers}` (used by Task 7's nudge).

- [ ] **Step 1: Failing tests** — `tests/kit-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadKit } = require('./_load-kit');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const KIT = loadKit(); const ULT = loadAgency();

test('legalFor: commons + own faction only, never another faction', () => {
  const rows = KIT.legalFor('death_guard', 'ITEM', D);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(r => !r.faction || r.faction === 'death_guard'));
});

test('mint respects the depth ladder and cast rank gates', () => {
  const grunt = KIT.mint('orks', {rk:1, cls:'Core', sub:'Boy - R1 - 1 slot'}, 7, ULT.rng, D);
  assert.strictEqual(grunt.abilities.length, 0);
  assert.strictEqual(grunt.casts.length, 0);
  assert.ok(grunt.items.length <= 1);
  const vet = KIT.mint('thousand_sons', {rk:4, cls:'Core', sub:'Rubric - R4 - 5 slots'}, 7, ULT.rng, D);
  assert.strictEqual(vet.abilities.length, 1);
  assert.ok(vet.casts.every(c => (function(){var m=/^R(\d+)\b/.exec(c.d||'');return (m?+m[1]:1)<=4;})()),
    'no cast above the model rank');
});

test('mint is deterministic per seed and varies across seeds', () => {
  const a = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, 42, ULT.rng, D);
  const b = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, 42, ULT.rng, D);
  assert.deepStrictEqual(a, b);
  let differed = false;
  for (let s = 0; s < 20 && !differed; s++) {
    const c = KIT.mint('aeldari', {rk:3, cls:'Assault', sub:'x'}, s, ULT.rng, D);
    if (JSON.stringify(c) !== JSON.stringify(a)) differed = true;
  }
  assert.ok(differed, 'different seeds must be able to mint different kits');
});

test('property: all 20 factions mint only faction-legal gear at every rank', () => {
  D.factions.forEach(f => { for (let rk = 1; rk <= 5; rk++) {
    const kit = KIT.mint(f.id, {rk, cls:'Core', sub:'x'}, rk * 31 + 7, ULT.rng, D);
    ['items','abilities','casts'].forEach(k =>
      kit[k].forEach(it => assert.ok(!it.faction || it.faction === f.id,
        f.id + ' rank ' + rk + ' minted foreign ' + k + ': ' + it.n)));
  }});
});
```

- [ ] **Step 2: Run → FAIL** (region not found). 
- [ ] **Step 3: Implement** the region (ES5, pure; whole-kit seeded off `(seed ⊕ hashStr(facId+rk))` via the passed rngFn; casts additionally gated by a local R-prefix parse identical to `DOOR.castRank`'s regex — copy the one-liner, do not import DOOR). `legalFor` filters `D.items/abilities/casts` by `!row.faction || row.faction===facId`. `mint`: items with probability `depth.items` (one seeded pick), `depth.abilities` picks, casts only when `depth.casts` AND the roll grants (one cast at rank 3-4, seeded chance of a second at rank 5) AND rank gate passes. `kitDepth` counts, over a combatants map, models whose gen kit carries ≥1 cast (casters) / ≥1 ability (abilityCarriers).
- [ ] **Step 4: Full suite → green. Step 5: Commit** — `git add index.html tests/_load-kit.js tests/kit-core.test.js`; `"engine: T-NPC-3.5 task 3 — pure KIT generator (rank-scaled, faction-legal, seeded)"`.

---

### Task 4: Brain part 1 — enumerate + score (pure THREAD core)

**Files:**
- Modify: `index.html` `/*<thread-core>*/` — new functions beside `npcTurn`; export via the THREAD return object
- Create: `tests/brain-core.test.js` (+ reuse `tests/_load.js`)

**Interfaces:**
- Consumes: `spottedEnemies` (Task 2 semantics), injected `weaponsOf(c)`, NEW injected `kitOf(c) → [{item, kind:'cast'|'ability'|'item', ap, payload:{tag,tier,hostile,el}[] , consumed:bool}]` (the glue builds it in Task 6; tests build fixtures by hand — the shape here is the contract).
- Produces (exact names):
  - `THREAD.enumeratePairs(side, state, board, weaponsOf, kitOf, canon) → [pair]` where `pair = {actor, kind:'attack'|'kit'|'move', item?, target?, ap, meta}`
  - `THREAD.scorePair(pair, state, canon) → number` — band-based (§3): band from `canon.rules.npc_brain.bands` (attack→basic_attack; hostile kit payload→offensive; friendly→support; heal/cleanse on a model at ≤2 wounds→reaction), slid within the band by considerations combined via geometric mean: expected wounds after armour (attacks and damage-carrying conds over duration, capped by target's remaining wounds), denial value (Suppressing/Slowing: the target's plausible actions denied — approximate as target's weapon count × remaining AP share), peril-weighted support value (buff/heal × (1 − targetWounds/maxWounds)), all divided by `max(1, ap)` for AP efficiency.

- [ ] **Step 1: Failing tests** — build small hand-rolled state fixtures (two sides, 2-3 models each, explicit wounds/armour/positions; copy the fixture style from `tests/npc-turn.test.js`). Pin at minimum:

```js
test('enumeratePairs lists weapon×enemy and kit×recipient pairs, fog-honest', ...);
  // dead enemy → no pairs against it; unspotted enemy → none; kit self-buff pairs exist
test('scorePair: an attack on a tough target scores in basic_attack band', ...);
  // assert 8 <= s <= 12 for a plain shot with modest expected wounds
test('scorePair: suppressing a 3-weapon model outscores suppressing a dying grunt', ...);
test('scorePair: healing a model at 1/6 wounds lands in the reaction band; buffing full-health scores below support mid-band', ...);
test('scorePair: same effect at 2 AP scores half the 1 AP value', ...);
```

Write real assertions with computed expected numbers once the formulas below are fixed — the test IS the formula's spec; show your arithmetic in comments.

- [ ] **Step 2: Run → FAIL. Step 3: Implement** `enumeratePairs` + `scorePair` exactly per the Interfaces block (band placement rules verbatim; geometric mean = `Math.pow(product, 1/n)` over n considerations, each normalized to (0,1] against caps stated in code comments). No `Math.random` — scoring is deterministic; ALL variety enters at Task 5's draw.
- [ ] **Step 4: Full suite → green. Step 5: Commit** — `"engine: T-NPC-3.5 task 4 — brain: pair enumeration + band scoring (pure, deterministic)"`.

---

### Task 5: Brain part 2 — tilt + draw + trace + the new npcTurn

**Files:**
- Modify: `index.html` `/*<thread-core>*/` — `tiltScores`, `drawAction`, rewrite `npcTurn`'s action-selection to the six steps (movement doctrine shaping stays)
- Create/extend: `tests/brain-core.test.js`, extend `tests/npc-turn.test.js`, keep `tests/doctrine-core.test.js` green untouched

**Interfaces:**
- Produces:
  - `THREAD.tiltScores(pairs, behavior, canon) → pairs` (score multiplied per `rules.npc_brain.tilt`: axis value vs pivot → linear mult up to max_mult on matching pair classes; honor ≥ honor_high removes hostile-DoT/cruelty pairs and adds leader-duel preference, ≤ honor_low boosts them; pragmatism scales `kind:'item'&&consumed` pairs around pragmatism_item_pivot)
  - `THREAD.drawAction(pairs, rng, lastKind, canon) → pair|null` (drop below `draw_cutoff × best`; add `inertia_bonus × score` when `pair.kind===lastKind`; seeded weighted draw)
  - `npcTurn(side, state, board, weaponsOf, kitOf, canon, behavior)` — signature GAINS `kitOf` (audit and update every caller: `npcRespond`, drama driver, `tools/arena.js` in Task 8; until Task 6 the engine passes a stub `function(){return []}` so behavior is weapons-only-identical)
  - `state.aiTrace` — ring buffer (cap 40 entries) of `{day?, actor, chosen, top:[{action,score}...≤5]}` appended per npcTurn call
- [ ] **Step 1: Failing tests** — tilt monotonicity (raising cunning never lowers a denial pair's rank), honor veto (honor 80 → zero DoT pairs survive), pragmatism gate (prag 10 → consumable pair scores ~collapse), draw determinism (same seed same pick), draw distribution (over 200 seeds, the top-2 candidates both get picked ≥10% when within 10% score), inertia (same-kind followup wins a near-tie), trace shape + cap.
- [ ] **Step 2: FAIL → Step 3: implement → Step 4: suite green** (esp. `tests/doctrine-core.test.js` and `tests/npc-turn.test.js` — with the stub `kitOf`, existing behavior pins must still hold; where a pin asserted the OLD "always best weapon" pick and the draw now legitimately varies, extend the pin to accept the drawn set, never delete it — flag each such change in the report).
- [ ] **Step 5: Commit** — `"engine: T-NPC-3.5 task 5 — brain: axis tilt, seeded top-band draw, aiTrace; npcTurn six-step integration (kitOf stubbed)"`.

---

### Task 6: Glue — kitOf injection, spawn minting, consumables, E2E

**Files:**
- Modify: `index.html` (glue): a real `kitOf` builder near `condEffectsFor` (~5479); kit minting wired into `genHostCombatants` (grep) and `seedCombat`'s NPC half; consumable depletion; every `npcTurn(`/`npcRespond` call site passes the real `kitOf`.

**Interfaces:**
- Consumes: `KIT.mint`, `condTagsOf`/`condEffectsFor` machinery, `apMod` (CAST 2/ABILITY 1/ITEM 0).
- Produces: NPC combatants' `gen` gains `kit` (the minted `{items,abilities,casts}`); engine `kitOfFor(state)` returns the injectable `kitOf(c)` that reads `c.gen.kit` (NPCs) — player models' equipped slots are NOT routed through the NPC brain (players stage their own actions; kitOf returns [] for them); consumable use marks `c.usedKit[n]` and depletes.

- [ ] **Step 1:** Mint at spawn: in `genHostCombatants` (and any spawn site it doesn't cover — grep `gen={id:spec.id` for all), after the gen object is built: `gen.kit = KIT.mint(fac.id, {rk: spec.rk||1, cls: spec.cls, sub: spec.sub}, <the spawn's existing seed ⊕ spec.id hash>, ULT.rng, D);` — derive rk from the spec if present, else from the model's canonical row (state the choice in the report).
- [ ] **Step 2:** `kitOfFor(state)` builds, per combatant with `c.gen&&c.gen.kit`, the pair-ready entries: for each kit row, `kind` by cat, `ap=apMod(row)`, `payload` from `condTagsOf(row)` (+hostility via `condIsHostile`), `consumed` true for ITEM rows whose name/d mark consumability (grep how `x2`/Consumable rows are recognized in the player path — mirror it; if no marker exists, treat all ITEM-kind kit rows as consumable and say so in the report). Filter out entries in `c.usedKit`.
- [ ] **Step 3:** Depletion: where the brain's chosen kit action lands in `apply` (the staged effects carry `item`), mark `c.usedKit[item.n]=true` for consumed kinds — engine-side after apply, mirroring how spent AP is handled; NOT in the pure core.
- [ ] **Step 4:** Swap every stubbed `kitOf` for the real one (`npcRespond`, drama driver). Full suite green.
- [ ] **Step 5: Browser E2E** (protocol per Global Constraints): force a siege (high conflict, console), join it, watch the NPC side: a cast/ability action appears in an NPC post (RECORD/battle report line names the cast), `state.aiTrace` populated (inspect via console), a consumable used once does not repeat, 0 console errors, screen sweep. Run one drama for a few days (console day-rolls) and confirm both sides use kit actions.
- [ ] **Step 6: Commit** — `"engine: T-NPC-3.5 task 6 — kit minting at spawn, kitOf injection, consumable depletion; NPCs fight with full kits live"`.

---

### Task 7: Statistical kit nudge

**Files:**
- Modify: `index.html`: the `att`/`def` computation in `resolveUltLapses` and `resolveFarBattle`; `WORLD.digest` untouched (arith line carries it)
- Extend: `tests/agency-core.test.js` or `tests/world-core.test.js` (whichever hosts the closest fixtures — read both first)

**Interfaces:**
- Consumes: `KIT.kitDepth` (Task 3). For thread-backed lapses, depth over the NPC side's combatants; for `resolveFarBattle` (no combatants exist), a seeded synthetic depth from the muster size: `casters = round(muster/600)`, `abilityCarriers = round(muster/300)` — state this approximation in the arith line note and the report.
- Produces: multiplier `1 + min(cap, casters*per_caster + abilityCarriers*per_ability)` applied to that side's PC in the roll, printed in the arithmetic (` · kit ×1.02`).

- [ ] Steps: failing pin (a lapse fixture with 2 casters/3 ability carriers → att multiplied by exactly 1.014, arith contains `kit ×1.01`), implement, chunk-equivalence sanity (the nudge derives from seeded state only — assert a 13-day chunk equals daily replay on a far-battle fixture, extending the existing equivalence test), full suite, commit `"engine: T-NPC-3.5 task 7 — seeded kit nudge in statistical battles, arithmetic shown"`.

---

### Task 8: Balance Lab v2 + close-out

**Files:**
- Modify: `tools/arena.js` (driver → six-step brain with real kitOf built from minted kits; build generator samples kits via `KIT.mint`)
- Create: `.superpowers/sdd/<run-date>-lab-v2/balance-warband-v2.md` (report; gitignored dir is fine)
- Modify: `CLAUDE.md` (T-NPC-3.5 engine bullet, house style, factually checked), `BACKLOG.md` (row → built + `ready-to-push`, tunables list, Lab v2 headline numbers)

- [ ] **Step 1:** Arena rewiring: builds carry minted kits; the battle loop passes a fixture `kitOf` mirroring Task 6's shape; determinism self-check still passes; consumables deplete across a battle.
- [ ] **Step 2:** Re-run the WARBAND tournament (same shape as v1: 6 builds × 20 factions, 2-round Swiss, 25 trials) + NEW analytics from `aiTrace`: per cast/ability/item — battles appeared, times chosen, win-rate delta of builds carrying it. Report: tier table, best builds, kit-outlier tables (legend on every table), degenerate flags, v1-vs-v2 movement (who rose/fell once kits mattered), engine findings if any.
- [ ] **Step 3:** Close-out docs (CLAUDE.md bullet: canon v1.38, six-step brain, kit minting, nudge, the two core fixes, Lab v2 headline, tunables flagged; BACKLOG row ready-to-push, commits + paths listed). Full suite + full screen-sweep E2E one last time.
- [ ] **Step 4: Commit** — `"tools+docs: T-NPC-3.5 task 8 — Balance Lab v2 (full-kit tournament + aiTrace analytics), close-out"`.

---

## Post-plan verification (whole-branch)

Final lifecycle review on the most capable model, walking:
A. A kit's life: minted at spawn (seeded, legal) → enumerated → scored → tilted → drawn → staged through validate/apply → depleted → traced. Determinism end-to-end (same siege day = same kit = same battle).
B. The stub window: between Tasks 5 and 6 the engine ran with a stubbed kitOf — verify no call site still passes the stub.
C. Doctrine continuity: T-NPC-4 movement styles and retreat unchanged; doctrine tests untouched-and-green; the tilt uses axes without double-counting movement shaping.
D. The two core fixes: corpse-vision and move-ordering against live dramas (not just fixtures); arena workarounds fully removed.
E. Fog honesty: no brain path reads unspotted enemies; player-side behavior utterly unchanged (players never route through kitOf).
F. Statistical nudge: chunk-equivalence, cap respected, arith printed on every path.
G. Ledger triage of deferred minors; CLAUDE.md factual audit against shipped code (the N2 lesson: docs claims get review-checked).
