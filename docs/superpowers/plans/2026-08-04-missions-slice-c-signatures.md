# T-MSN-1C — Streaks + 18 Signature Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Missions V2 Slice C per `docs/superpowers/specs/2026-07-26-missions-v2-design.md` §4 + the Slice-C rulings addendum (Daak 2026-08-04): the `S.progress.streaks` primitive, 18 faction-signature mission rows, faction-gated generation, ×1.5 signature premium.

**Architecture:** Canon rows land in the existing empty `D.missions.signatures` array (same row schema as `universal`). Engine work extends the pure THREAD/MISSION cores (kill-credit filters, a new conclude-constraints evaluator, streak classification) plus glue (concludeThread streak tick, generator injection, recruit faction stamp). Tests ride the existing house pattern (`tests/mission-*.test.js`, canon pins).

**Tech Stack:** python3 stdlib json for canon edits · Node built-in test runner (zero deps) · Playwright MCP for the E2E gate.

## Global Constraints

- Baseline at plan time: **canon v1.30, 424 pass / 0 fail**. Suite green at EVERY commit; version bumps to **1.31** ONLY in Task 6 (all test pins move in that same commit — grep `1\.30` in `tests/`, expect ~10 sites, zero hits after).
- JSON edits: `json.dump(D, f, indent=1, ensure_ascii=False)` then `f.write('\n')` (trailing newline). `git diff --stat` after every canon edit — a whole-file diff means broken formatting: checkout and redo.
- `git add <explicit paths>` only — NEVER `-A`/`.`. Do not push.
- Pure-core edits go INSIDE the marked regions (`/*<thread-core>*/`, `/*<mission-core>*/`, `/*<door-core>*/`) — they are extracted-and-eval'd by `tests/_load*.js`; no DOM, no globals, canon/state as arguments.
- New `S`-state keys seed in BOTH `foundingWorld()` (index.html ~2170) AND `init()`/load-backfill (~4066 area) — known gotcha, tested.
- Terminology: "model", never "chassis".

## Locked design values (from the addendum — verbatim law)

- signature premium: `rules.missions.signature_premium = 1.5`
- streak length 3, keys: `combat_wins` (BL) · `duel_wins` (Orks) · `named_duel_wins` (Custodes) · `annihilations` (Tyranids). Consecutive; qualifying loss resets; `{count,best}` shape; tick at concludeThread only.
- Constraints: The Few = enemy PC ≥ 2× yours at lock-in · Meatgrinder = your PC ≥ 2× enemy at lock-in · Flawless = zero wounds lost by your side · Martyrdom = ≥6 own wounds lost · Auxiliary = ≥2 non-T'au models fielded. All ALSO require the mission won.
- Targets: WE melee 6–10 · Votann grudge-faction 5–8 · Drukhari live captures 2–3 · GSC named capture 1 · TS tome 1 · Aeldari soulstones 3 · Mechanicus tier-II+ loots 2.

---

### Task 1: Canon — 18 signature rows + signature_premium (stays v1.30)

**Files:**
- Modify: `heretics-40k-data-v1.json` (`missions.signatures` — currently `[]`; `rules.missions.signature_premium`)
- Modify: `tests/canon-missions.test.js` (append block)

**Interfaces:**
- Produces: `D.missions.signatures` = 18 rows, schema identical to `missions.universal` rows (`{id,n,family,kind,target_roll,params,needs_hostiles,world_effect,flavor,faces,gates}`) PLUS `gates.faction` (the owning faction id) and `signature:true`.
- Consumed by Tasks 2–5 (filters/constraints/streaks/generator read `params` shapes minted here).

- [ ] **Step 1: Append the failing canon test** to `tests/canon-missions.test.js`:

```js
test('T-MSN-1C: 18 signature rows, faction-gated, premium constant', () => {
  const S = canon.missions.signatures;
  assert.strictEqual(S.length, 18);
  assert.strictEqual(canon.rules.missions.signature_premium, 1.5);
  const byId = Object.fromEntries(S.map((r) => [r.id, r]));
  const expect = {
    we_skulls: ['world_eaters', 'count_kill'], votann_grudge: ['votann', 'count_kill'],
    ec_perfect_kill: ['emperors_children', 'count_kill'], astartes_the_few: ['astartes', 'count_kill'],
    am_meatgrinder: ['militarum', 'count_kill'], harlequins_flawless: ['harlequins', 'count_kill'],
    sororitas_martyrdom: ['sororitas', 'count_kill'], tau_auxiliary: ['tau', 'count_kill'],
    drukhari_slave_raid: ['drukhari', 'count_kill'], gsc_gene_harvest: ['gsc', 'count_kill'],
    astartes_none_left_behind: ['astartes', 'count_kill'],
    ts_forbidden_lore: ['thousand_sons', 'collect_item'], aeldari_soul_tithe: ['aeldari', 'collect_item'],
    mechanicus_tech_reclamation: ['mechanicus', 'collect_item'],
    bl_long_war: ['black_legion', 'streak'], orks_might_right: ['orks', 'streak'],
    custodes_blood_games: ['custodes', 'streak'], tyranids_amass_biomass: ['tyranids', 'streak'],
  };
  for (const [id, [fac, kind]] of Object.entries(expect)) {
    assert.ok(byId[id], id + ' exists');
    assert.strictEqual(byId[id].gates.faction, fac, id + ' faction gate');
    assert.strictEqual(byId[id].kind, kind, id + ' kind');
    assert.strictEqual(byId[id].signature, true, id + ' signature flag');
  }
  const streakKeys = ['combat_wins', 'duel_wins', 'named_duel_wins', 'annihilations'];
  const sRows = S.filter((r) => r.kind === 'streak');
  assert.deepStrictEqual(sRows.map((r) => r.params.streak_key).sort(), streakKeys.sort());
  assert.ok(sRows.every((r) => r.target_roll[0] === 3 && r.target_roll[1] === 3));
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/canon-missions.test.js` → signatures.length 0.

- [ ] **Step 3: Mint the 18 rows.** Use the universal rows as the schema reference (read one first). Exact content per row (family per nearest universal analog — KILL for combat, COLLECT for collect, and streak rows use family `KILL` with `needs_hostiles:false`; world_effect conflict −2 on combat rows, prosperity +1 on collect rows, none on streak rows; each row's `faces.notice` and `flavor` are one authored 40K-flavored line — write them in-voice, e.g. WE "THE SKULL COUNT RISES", Harlequins "the dance admits no wound"):

| id | kind | target_roll | params | needs_hostiles |
|---|---|---|---|---|
| we_skulls | count_kill | [6,10] | `{filter:'melee'}` | true |
| votann_grudge | count_kill | [5,8] | `{filter:'faction'}` (grudge faction seeded at mint — Task 5) | true |
| ec_perfect_kill | count_kill | [1,1] | `{filter:'named', constraint:'no_ally_deaths'}` | true |
| astartes_the_few | count_kill | [1,1] | `{clear_all:true, constraint:'outnumbered', ratio:2}` | true |
| am_meatgrinder | count_kill | [1,1] | `{clear_all:true, constraint:'outnumbering', ratio:2}` | true |
| harlequins_flawless | count_kill | [1,1] | `{clear_all:true, constraint:'no_damage_taken'}` | true |
| sororitas_martyrdom | count_kill | [1,1] | `{clear_all:true, constraint:'min_wounds_taken', wounds:6}` | true |
| tau_auxiliary | count_kill | [1,1] | `{clear_all:true, constraint:'min_foreign_models', count:2}` | true |
| drukhari_slave_raid | count_kill | [2,3] | `{filter:'capture'}` | true |
| gsc_gene_harvest | count_kill | [1,1] | `{filter:'named', capture_only:true}` | true |
| astartes_none_left_behind | count_kill | [1,1] | `{filter:'named', rescue:true}` (flavor carries the freed brother) | true |
| ts_forbidden_lore | collect_item | [1,1] | `{item:'Prohibited Tome'}` | true |
| aeldari_soul_tithe | collect_item | [3,3] | `{item:'Soulstone'}` | true |
| mechanicus_tech_reclamation | collect_item | [2,2] | `{loot_gear_tier:2}` | true |
| bl_long_war | streak | [3,3] | `{streak_key:'combat_wins'}` | false |
| orks_might_right | streak | [3,3] | `{streak_key:'duel_wins'}` | false |
| custodes_blood_games | streak | [3,3] | `{streak_key:'named_duel_wins'}` | false |
| tyranids_amass_biomass | streak | [3,3] | `{streak_key:'annihilations'}` | false |

Every row also carries `signature:true` and `gates:{faction:'<owner id>'}` per the Step-1 table. Add `rules.missions.signature_premium: 1.5`. Version stays **1.30**.

- [ ] **Step 4: Full suite green** — expect **425 / 0** (424 + 1). If mission-core generator tests fail on the new rows, STOP and report (the generator should ignore rows it isn't told to mint — Task 5 wires them; a failure here means the generator eagerly mints unknown rows and the task order must flip — escalate to the controller).

- [ ] **Step 5: Commit** — `git add heretics-40k-data-v1.json tests/canon-missions.test.js` → `canon: T-MSN-1C 18 signature rows + signature_premium (rows dormant until generator wiring)`

---

### Task 2: THREAD core — kill-credit filters: melee, faction, capture

**Files:**
- Modify: `index.html` (thread-core region — the credit function holding the `filt` switch at ~line 699, and its call sites in `apply`)
- Test: `tests/mission-objective.test.js` (append)

**Interfaces:**
- Consumes: Task 1's params shapes (`filter:'melee'|'faction'|'capture'`, `capture_only:true`).
- Produces: the credit function honors: `melee` (credit only when the killing attack's band === 'melee'); `faction` (credit only when `victim.gen.faction === ob.params.grudge_faction`); `capture` (credit ONLY capture events, kills never credit); `capture_only` on a named filter (named target must be captured, not killed). Capture events already credit objectives (Slice-B counted-victim flag) — extend, don't duplicate.

- [ ] **Step 1 (survey, no code):** Read the credit function and BOTH its call sites in `apply` (kill path and capture path). Establish: (a) the exact function name; (b) whether the attack `band` reaches the kill call site (damage effects carry `band` since T-CMB-1 — verify); (c) whether generated hostiles carry `gen.faction` (check `genHostiles`; if absent, stamping it at spawn is part of THIS task). Write findings into the report before editing.

- [ ] **Step 2: Failing tests** — append table-driven cases to `tests/mission-objective.test.js` (follow the file's existing fixture style; build minimal state fixtures with a combatant victim + objective):

```js
// melee: band 'melee' credits, band 'long' does not
// faction: victim.gen.faction match credits, mismatch does not
// capture filter: a capture credits, a kill does NOT credit
// capture_only + named: killing the named target does NOT complete; capturing does
// existing behaviors unchanged: 'named' kill still credits, counted-victim flag still blocks double credit
```

Write the actual asserts against the surveyed function signature. Run: expect the new cases to FAIL.

- [ ] **Step 3: Implement minimally** inside the thread-core region — extend the `filt` switch; thread `band` through the kill call site if the survey found it missing; stamp `gen.faction` at spawn if missing. No behavior change for existing filters.

- [ ] **Step 4: Full suite green** (baseline + new cases). **Step 5: Commit** both files: `engine: T-MSN-1C kill-credit filters - melee/faction/capture (+capture_only named)`.

---

### Task 3: MISSION core — conclude constraints evaluator

**Files:**
- Modify: `index.html` (mission-core region: new pure `constraintCheck(state, params)`; thread-core `evalObjective`/outcome path calls it)
- Test: `tests/mission-outcome.test.js` (append)

**Interfaces:**
- Consumes: Task 1 constraint params (`constraint`, `ratio`, `wounds`, `count`).
- Produces: `MISSION.constraintCheck(state, params) -> {ok, why}` — pure, reads only `state`. Constraint definitions (from the addendum, exact):
  - `no_ally_deaths`: no non-gen combatant has `dead`.
  - `no_damage_taken`: Σ over non-gen combatants of `(w[1] - w[0])` === 0 and none dead.
  - `min_wounds_taken`: that same Σ (dead models count their full `w[1]`) ≥ `params.wounds`.
  - `outnumbered`: at lock-in, enemy PC total ≥ `ratio` × own PC total.
  - `outnumbering`: own PC total ≥ `ratio` × enemy PC total.
  - `min_foreign_models`: ≥ `params.count` non-gen combatants whose roster model's `fac` differs from the player faction (see Task 5's recruit stamp; models without `fac` count as own-faction).
- A mission with a `constraint` param wins ONLY if the base objective is won AND `constraintCheck(...).ok`.

- [ ] **Step 1 (survey):** verify what lock-in freezes today — find the lock/`state.locked` handling and whether per-side PC totals (or the combatant `pc`) survive into `state.combatants`. If PC is already on each combatant, the ratio checks derive from `state.combatants` alone (dead included — the LOCKED-IN totals, so sum regardless of `dead`); only if absent does this task add a lock-in `state.lockTotals={mine,enemy}` snapshot (seed-versioned, absent-tolerated for old saves). Record findings first.

- [ ] **Step 2: Failing tests** — table-driven fixtures per constraint (both pass and fail sides of each boundary: exactly-2:1 ratios, exactly-6 wounds, exactly-2 foreign). Also: objective won but constraint failed → mission NOT won.

- [ ] **Step 3: Implement** pure `constraintCheck` + the win-side AND-gate where MISSION outcome is decided (survey the exact site: the `evalObjective` consumers / `concludeThread` mission-won branch). **Step 4: suite green. Step 5: commit** `engine: T-MSN-1C conclude constraints - the Few/Meatgrinder/Flawless/Martyrdom/Auxiliary evaluator`.

---

### Task 4: Streaks — S.progress.streaks primitive + streak-kind missions

**Files:**
- Modify: `index.html` (mission-core: pure `streakTick(streaks, result)` + streak objective sync; glue: concludeThread calls it; `foundingWorld()` + init backfill seed `S.progress`)
- Test: `tests/mission-save.test.js` (append round-trip) + `tests/mission-outcome.test.js` (classification table)

**Interfaces:**
- Produces: `S.progress = { streaks: { <key>: {count,best} } }`; pure `MISSION.streakTick(streaks, result)` where `result = {won, combat, myModels, enemyWiped, enemyNamed, oneVsOne}` — classification (addendum law):
  - `combat_wins`: any `combat && won` +1; `combat && !won` resets.
  - `duel_wins`: `combat && myModels===1 && oneVsOne`: won +1, lost resets. Non-duel threads DON'T touch it.
  - `named_duel_wins`: as duel_wins AND `enemyNamed`; a named duel loss resets; unnamed duels don't touch it.
  - `annihilations`: `combat && won && enemyWiped` +1; `combat && won && !enemyWiped` RESETS (a non-wipe win breaks the chain); a loss also resets.
  - Every +1 updates `best = max(best, count)`.
- Streak MISSION rows (`kind:'streak'`): `objective.progress` mirrors `S.progress.streaks[key].count` (synced in the glue at conclude + board/log render); `evalObjective` unchanged (progress ≥ target wins).
- concludeThread (glue) builds `result` from the thread it just closed and calls `streakTick` BEFORE evaluating streak-mission objectives, so a qualifying win completes its own mission.

- [ ] **Step 1: Failing tests** — pure classification table (all 4 keys × win/loss/wipe/non-wipe/duel/named permutations, ~12 cases) + snapshot round-trip (`S.progress` survives `SAVE.snapshot`→relink; absent key → treated as empty, old saves load clean).
- [ ] **Step 2: Implement** pure first, then the two seeding sites (BOTH `foundingWorld()` and the init backfill — the known gotcha, assert both in tests by loading each path), then the concludeThread glue.
- [ ] **Step 3: suite green. Step 4: commit** `engine: T-MSN-1C streak primitive - S.progress.streaks, 4 keys, conclude tick`.

---

### Task 5: Generator injection + signature premium + recruit faction stamp

**Files:**
- Modify: `index.html` (mission-core: board mint injects signature rows; `payoutOf` premium; the T-MST-1 muster recruit gains `fac:rec.faction`; MISSION.gateReason covers `gates.faction`)
- Test: `tests/mission-core.test.js` (append)

**Interfaces:**
- Consumes: Tasks 1–4 (rows, filters, constraints, streaks).
- Produces:
  - Board mint: signature rows mint alongside universal picks, player-agnostic (1B pattern), gated by `gates.faction` at BOTH render (hidden from other factions) and accept (defense in depth) via the existing `gateReason` seam — extend it: `gates.faction` mismatch → reason string. At most ONE signature row per board (slot budget unchanged — it takes a normal slot).
  - `votann_grudge` mint seeds `params.grudge_faction` from the same rng stream + local hostile-faction context the named-boss mint already uses; a board location with no hostile faction context doesn't mint the row (eligibility, like needs_hostiles).
  - `payoutOf`: `inst.signature` → multiply by `M.signature_premium||1` (exactly the named_premium pattern at index.html:1687).
  - Muster recruit `nm` gains `fac: rec.faction` (one line in the T-MST-1 glue); Task 3's `min_foreign_models` reads it.
  - **Collect acquisition (no dead content):** rows with `params.item` (tome, soulstones) mint a CARRIER — one spawned hostile (prefer the highest-pc) carries the quest item ×1 (soulstone rows: every spawned hostile carries one until the target count is coverable); on that hostile's death the item joins its lootable corpse via the existing spoils/loot seam (survey `lootCorpseAdjacent` + `state.spoils`), and looting it ticks `objective.progress` (collect hook). `loot_gear_tier` rows (Mechanicus) tick progress whenever looted gear's `DOOR.gearTier(pc) >= params.loot_gear_tier`. Both hooks live at the loot-credit site, tested with fixtures.
- [ ] **Step 1 (survey):** read the board-mint function (~line 1950 region) and `gateReason`; record where universal picks happen and what the rng stream offers. **Step 2: failing tests** — determinism (same seed+day → same boards incl. signature row), faction gating (row absent for wrong-faction render, accept refused), grudge seeding deterministic, payout premium math, one-signature-per-board cap. **Step 3: implement. Step 4: suite green. Step 5: commit** `engine: T-MSN-1C generator injection + signature premium + recruit faction stamp`.

---

### Task 6: v1.31 + E2E + BACKLOG ready-to-push

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version` 1.31, `meta.updated`, `meta.notes` append) · every test pin (`grep -rn "1\.30" tests/` → all sites → 1.31, zero hits after) · `BACKLOG.md` (T-MSN-1C row only)

- [ ] **Step 1:** bump version + notes line (`v1.31: T-MSN-1C streaks + 18 signature missions - S.progress.streaks, faction-gated generation, signature_premium 1.5.`) + all pins; full suite green.
- [ ] **Step 2: Browser E2E** (Playwright MCP, `python3 -m http.server 8765`, `window._noPersist=true` FIRST): boot 0 console errors, rail v1.31 · as the demo commander open a board and confirm the faction's signature row renders (and a wrong-faction row does NOT) · accept the signature where possible and verify the tracker meter renders · verify `S.progress.streaks` exists on a fresh founding AND on the loaded save. Kill the server.
- [ ] **Step 3:** BACKLOG T-MSN-1C → `ready-to-push` with commit list + paths. Commit explicit paths: `canon v1.31: T-MSN-1C complete - version + pins, ready-to-push`.
