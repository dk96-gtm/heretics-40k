# The Hall — Slice B2 Implementation Plan (T-SOC-1 · the CONTEST verb + hall law)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hall's fourth verb real. **CONTEST** — the culture's native trial of
worth — resolves through exactly two engines: **BRAWL** (a real non-lethal 1v1 on the
battlefield grid, reusing the shipped duel machinery) and **MATCH** (a new pure seeded
opposed roll with a wager and an optional CHEAT). Winning, losing well, cheating cleanly or
getting caught all emit the trust acts the Slice B1 judge already scores but nothing yet
produces. Alongside it ships **hall law**: the Hall is bound ground, and un-challenged
violence inside it costs standing with the ruling faction and bars you from the door for a
number of days — except in Da Grog Den, where the unsanctioned scrap *is* the contest.

**Architecture:** Two new pure helpers land in the existing DOM-free `/*<hall-core>*/`
region — `matchResolve` (seeded opposed roll + cheat + catch risk) and the small law/act
readers around it — following the Slice A/B1 idiom exactly (canon and a primitive `ctx`
arrive as arguments; determinism seeds off `ctx.seedBase`; no `Date.now()`, no
`Math.random()`). The BRAWL side invents no combat: it mints a one-hostile SKIRMISH thread
against the Champion by name through the shipped `genHostCombatants(...,{duel:true,
filter:'named',target_name})` path, and the whole bout is made non-lethal by a single new
thread-level `state.nonLethal` flag read at the two places the THREAD core already honors a
weapon's own Non-Lethal floor. Every contest conclusion routes through the shipped
`hallTrustRecord(hc, role, act)`, so trust movement is B1's judge, unchanged. Hall law
writes to the shipped 20×20 standing ledger (`S.world.standing` via `SEAT.moveStanding`)
and to one new tiny save key, `S.social.bar`.

**Tech Stack:** vanilla ES5 JS in `index.html` (no deps) · canon JSON · Node built-in test
runner (`node --test`, zero dependencies) · Playwright MCP for the browser E2E.

**Spec:** `docs/superpowers/specs/2026-09-06-social-door-design.md` — §4 (the CONTEST verb,
both resolvers, and the hall-law rules), §6 (the Champion's rung ②/③/④ unlocks), §13
(tunables). This plan implements the remainder of the spec's §12 "Slice B" scope: everything
B1 explicitly fenced off as `TODO(B2)`.

## Global Constraints

- **Canon version:** bump `meta.version` ONCE, in Task 1. **Read the current value first at
  execution time and ladder to the next step — do NOT hardcode.** (At planning time the file
  reads `1.40` and the next step is `1.41`, but a concurrent session may have moved it.)
  Version pins live in 8 test files today — `tests/canon.test.js` (two pins),
  `tests/canon-hall.test.js`, `tests/canon-doors.test.js`, `tests/canon-missions.test.js`
  (two pins), `tests/canon-resources.test.js`, `tests/canon-spoils.test.js`,
  `tests/canon-cadence.test.js`, `tests/canon-npcbrain.test.js`. Sweep every pin that fails,
  by exactly the delta, in the same commit as the bump.
- **The pure `/*<hall-core>*/` region stays pure:** DOM-free, deterministic, canon and state
  arrive as arguments; NO `Date.now()`, NO `Math.random()`. All randomness seeds off
  `ctx.seedBase` through the region's own `rng`/`hashStr`.
- **Terminology law:** it is always **"model"**, never "chassis" — in rules text, UI copy,
  code, comments, and data.
- **SHARED WORKTREE.** Another session recently finished T-NPC-3.5 in these same files.
  `git add <explicit paths>` ONLY — never `git add -A`, never `git add .`. On
  `index.html`, `heretics-40k-data-v1.json`, `CLAUDE.md` and `BACKLOG.md`, use
  `git add -p <file>` to stage only your own hunks (an explicit whole-file `git add` still
  sweeps another session's unstaged hunks in that file — this has already stolen ~230 lines
  once in this repo). After **every** commit verify the leak is zero:

  ```bash
  git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
  ```

- **Green-gate:** `node --test` from the repo root must be green at every commit. Baseline at
  planning time: **749 tests, 749 passing, 0 failing.**
- **Every UI-touching task ends with a Playwright browser E2E**: serve with
  `python3 -m http.server 8765`, set `window._noPersist=true` FIRST in any page-eval session
  that founds or mutates a profile, exercise the surface, and confirm **0 console errors**
  across the screens touched — the Slice A/B1 discipline.
- **New save-state keys seed in BOTH sites** — the `S` defaults literal (`index.html:7482`)
  AND the `init()` backfill (`index.html:7352-7354`). This slice's new key is
  `S.social.bar`.
- **All numbers in this plan are flagged-for-review defaults (spec §13), not locked
  balance** — MATCH odds, the cheat shift and catch curve, wager sizing by tier, hall-law
  barred days and standing penalty, the title-fight standing notch, and the training-buff
  price/duration. They are authored to be playable and legible, and every one of them is
  listed for Daak in Task 8's close-out.

## Known open decision — flag for Daak, do NOT resolve in this slice

B1 shipped a judge (`HALL.judgeAct`) whose `axis.ferocity_only_win` rule zeroes every
non-`win` positive act for a high-ferocity culture. Because B1's only climb-acts were
`presence` and `offer` (neither is a win), **8 high-ferocity factions could not climb trust
at all.** B2's CONTEST win path is the intended fix: winning a brawl or a match emits
`'win'`, which those cultures do reward. Task 4 and Task 5 therefore both route their
victory through `hallTrustRecord(hc, 'champion', 'win')`.

One consequence must be flagged rather than silently designed around: if the *formal wagered
bout* were gated at rung ② (KNOWN) as spec §6 words it, a high-ferocity culture could never
reach rung ② in the first place (presence is worth 0 there), so the fix would never unlock.
**This plan therefore splits the gate:** a *challenge* is open at rung ① (STRANGER) and
unwagered; the *wagered* bout is the rung-② unlock (canon key
`rules.hall.contest.wagered_rung_min: 1`). This is a faithful reading of §6 ("formal wagered
bouts" is the unlock — not "bouts"), but it is a design call made inside the plan, and Daak
should confirm it. Whether the deeper fix is instead to retune `ferocity_only_win` is **not**
decided here.

## File Structure

- `heretics-40k-data-v1.json` — `contest` + `hall_law` added to each of the 20
  `rules.hall.culture[fac]` skin rows; new `rules.hall.contest` (MATCH constants, wager
  ladder, wagered-rung gate), new `rules.hall.law` (barred days + standing penalty), new
  `rules.hall.champion` (training buff + title fight); `meta.version` bump.
- `index.html` —
  - `/*<hall-core>*/` gains `contestOf`, `wagerFor`, `matchResolve`, `brawlAct`,
    `lawPenalty`, `barCheck`, `trainOffer`, `titleGate` (all pure, all exported).
  - `/*<thread-core>*/` gains ONE new thread-level flag: `state.nonLethal`, read at the two
    existing Non-Lethal-floor sites (`apply`'s damage branch ~L882 and `npcExpDamage` ~L1679)
    and carried through `initState` (~L567).
  - Door glue near `hallCtxOf` (~L7926-8030): `hallContest`, `hallBout`, `hallStrike`,
    `hallTrain`, `hallBarred` + the `hall` renderDoor branch (~L8167) gains the Champion
    CONTEST/TRAIN/TITLE controls, the patron STRIKE control, and the barred gate.
  - `concludeThread` (~L5098) gains the `t.hall` settlement hook.
  - `S.social.bar` seeded at both sites; GLOSS entries.
- `tests/hall-core.test.js` — extend (contest data, MATCH resolver + cheat/catch, brawl act
  classification, law penalty, bar check, training/title gates).
- `tests/canon-hall.test.js` — extend (contest/hall_law completeness across 20 skins, the
  three new rules blocks, version pin).
- `tests/thread-core.test.js` — extend (thread-level non-lethal floor).

---

### Task 1: Canon — per-skin contests, hall-law flags, and the three new rules blocks

**Files:**
- Modify: `heretics-40k-data-v1.json` (`rules.hall.culture` ×20, new `rules.hall.contest`,
  `rules.hall.law`, `rules.hall.champion`, `meta.version`)
- Test: `tests/canon-hall.test.js` (extend)

**Interfaces:**
- Produces: `rules.hall.culture[fac].contest = {name:string, resolver:'brawl'|'match'}` for
  all 20 faction ids, and `rules.hall.culture[fac].hall_law = boolean` (true everywhere
  except `orks`).
- Produces: `rules.hall.contest = {wagered_rung_min:1, wager_by_tier:{'1':25,'2':50,'3':100},
  match:{base_win:0.45, cheat_shift:0.30, catch_base:0.35, cunning_pivot:60,
  cunning_relief:0.6}}`.
- Produces: `rules.hall.law = {barred_days:5, standing_penalty:-1}`.
- Produces: `rules.hall.champion = {train:{rung_min:2, tag:'Rally', tier:1, cost_mult:3,
  days:3}, title:{rung_min:3, standing_notch:1, stake_mult:4}}`.
- Consumed by: Tasks 2, 3, 4, 5, 6, 7.

- [ ] **Step 1: Write the failing canon pins**

Append to `tests/canon-hall.test.js`:

```js
test('every hall skin declares a contest (name + legal resolver) and a hall-law flag', () => {
  const cul = D.rules.hall.culture;
  for (const f of FACTIONS) {
    const row = cul[f];
    assert.ok(row, 'culture row missing: ' + f);
    assert.ok(row.contest && typeof row.contest.name === 'string' && row.contest.name.length > 2,
      'contest name missing: ' + f);
    assert.ok(row.contest.resolver === 'brawl' || row.contest.resolver === 'match',
      'contest resolver must be brawl|match: ' + f);
    assert.equal(typeof row.hall_law, 'boolean', 'hall_law flag missing: ' + f);
  }
  // spec §4: both engines are actually used across the 20 cultures
  const resolvers = FACTIONS.map(f => cul[f].contest.resolver);
  assert.ok(resolvers.indexOf('brawl') >= 0 && resolvers.indexOf('match') >= 0);
  // spec §4: Da Grog Den is the authored exception — brawling IS the contest there
  assert.equal(cul.orks.hall_law, false, 'orks must set hall_law:false');
  assert.equal(cul.orks.contest.resolver, 'brawl');
  const lawless = FACTIONS.filter(f => cul[f].hall_law === false);
  assert.deepEqual(lawless, ['orks'], 'orks is the only authored hall-law exception');
});

test('rules.hall.contest: wager ladder by tier, match odds, cheat + catch curve', () => {
  const C = D.rules.hall.contest;
  assert.ok(C, 'rules.hall.contest missing');
  assert.equal(C.wagered_rung_min, 1);
  for (const t of ['1', '2', '3']) assert.ok(C.wager_by_tier[t] > 0, 'wager missing for tier ' + t);
  assert.ok(C.wager_by_tier['3'] > C.wager_by_tier['1'], 'wagers must climb with tier');
  const M = C.match;
  assert.ok(M.base_win > 0 && M.base_win < 1, 'base_win must be a probability');
  assert.ok(M.cheat_shift > 0, 'cheating must improve the odds');
  assert.ok(M.base_win + M.cheat_shift <= 1, 'cheating must not guarantee a win');
  assert.ok(M.catch_base > 0 && M.catch_base < 1, 'catch_base must be a probability');
  assert.ok(M.cunning_pivot >= 0 && M.cunning_pivot <= 100);
  assert.ok(M.cunning_relief > 0 && M.cunning_relief <= 1, 'cunning relief is a fraction of catch_base');
});

test('rules.hall.law: a barred window and a negative standing notch', () => {
  const L = D.rules.hall.law;
  assert.ok(L, 'rules.hall.law missing');
  assert.ok(L.barred_days >= 1, 'barred_days must bar for at least a day');
  assert.ok(L.standing_penalty < 0, 'hall-law standing penalty must be negative');
});

test('rules.hall.champion: rung-gated training buff and title fight', () => {
  const CH = D.rules.hall.champion;
  assert.ok(CH, 'rules.hall.champion missing');
  assert.equal(CH.train.rung_min, 2);          // TRUSTED
  assert.equal(CH.title.rung_min, 3);          // SWORN
  assert.ok(D.rules.hall.trust.rungs.length === 4, 'rung gates index into the B1 ladder');
  assert.ok(CH.train.cost_mult > 0 && CH.train.days > 0, 'training must cost and must expire');
  assert.equal(typeof CH.train.tag, 'string');
  assert.ok(CH.title.standing_notch > 0, 'a title win notches standing upward');
  assert.ok(CH.title.stake_mult > 1, 'a title fight stakes more than a normal bout');
});
```

Also update the version pin already at the top of this file (`assert.equal(D.meta.version,
'1.40')`) to the new value in Step 3.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/canon-hall.test.js`
Expected: FAIL — `contest name missing: black_legion`, `rules.hall.contest missing`,
`rules.hall.law missing`, `rules.hall.champion missing`.

- [ ] **Step 3: Author the canon**

First read the live version so the ladder is correct:

```bash
python3 -c "import json;print(json.load(open('heretics-40k-data-v1.json'))['meta']['version'])"
```

Bump `meta.version` to the next step (planning-time value `1.40` → `1.41`; use whatever the
read above returns + one step). Then add `contest` and `hall_law` to each of the 20 rows in
`rules.hall.culture`. The 20 rows already carry `flavor`/`commune`/`offer_label`/`offer` —
these two keys join them, they do not replace anything:

```
black_legion       "Trophy Hall blade-duel"   brawl   hall_law true
death_guard        "The endurance table"      match   hall_law true
world_eaters       "Skullpit bout"            brawl   hall_law true
thousand_sons      "Riddle-duel"              match   hall_law true
emperors_children  "One-upmanship"            match   hall_law true
daemons            "Soul-wager"               match   hall_law true
astartes           "Cage spar"                brawl   hall_law true
militarum          "Dice at the Mess"         match   hall_law true
mechanicus         "Logic-bout"               match   hall_law true
sororitas          "Trial of devotion"        match   hall_law true
custodes           "The forms"                brawl   hall_law true
tyranids           "Dominance display"        match   hall_law true
orks               "A proppa scrap"           brawl   hall_law FALSE
necrons            "Regicide"                 match   hall_law true
aeldari            "Blade-art"                brawl   hall_law true
drukhari           "Gallery knife-duel"       brawl   hall_law true
tau                "Strategy game"            match   hall_law true
gsc                "Kin-cards"                match   hall_law true
votann             "Grudge-bout"              brawl   hall_law true
harlequins         "Dance-trial"              match   hall_law true
```

Each row gains exactly this shape (world_eaters shown; repeat per faction with its own two
values from the table above):

```json
"world_eaters":{
 "flavor":"The pit is the parlor. Talk quickly.",
 "commune":"Talk between bouts",
 "offer_label":"Toss a worthy skull",
 "offer":{"kind":"item","accepts":"REMAINS"},
 "contest":{"name":"Skullpit bout","resolver":"brawl"},
 "hall_law":true
},
```

Then add the three new blocks under `rules.hall`, as siblings of `regulars`/`trust`:

```json
"contest":{
 "wagered_rung_min":1,
 "wager_by_tier":{"1":25,"2":50,"3":100},
 "match":{"base_win":0.45,"cheat_shift":0.30,"catch_base":0.35,
          "cunning_pivot":60,"cunning_relief":0.6}
},
"law":{"barred_days":5,"standing_penalty":-1},
"champion":{
 "train":{"rung_min":2,"tag":"Rally","tier":1,"cost_mult":3,"days":3},
 "title":{"rung_min":3,"standing_notch":1,"stake_mult":4}
}
```

Reading of the MATCH numbers, in plain words: an honest contestant wins 45% of the time (the
Champion is better than you and that is the point); cheating lifts that to 75% but risks a
35% catch, and a genuinely cunning culture's own deceit-tolerance shaves up to 60% off that
catch chance. `cost_mult`/`stake_mult` multiply the tier's base wager: training costs 3× a
wager, a title fight stakes 4×.

- [ ] **Step 4: Run tests**

Run: `node --test tests/canon-hall.test.js` → PASS.
Run: `node --test` → green. Fix every failing version pin (the 8 files listed in Global
Constraints) by the exact delta of the bump — nothing else.

- [ ] **Step 5: Commit**

Stage your own hunks only, then verify no peer content rode along:

```bash
git add -p heretics-40k-data-v1.json
git add tests/canon-hall.test.js tests/canon.test.js tests/canon-doors.test.js \
        tests/canon-missions.test.js tests/canon-resources.test.js \
        tests/canon-spoils.test.js tests/canon-cadence.test.js tests/canon-npcbrain.test.js
git commit -m "canon: Hall B2 — per-skin contests (8 brawl / 12 match) + hall_law flags, rules.hall.contest/law/champion"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 2: HALL core — `contestOf`, `wagerFor`, `matchResolve`

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`, before the region's `return`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Consumes: `rules.hall.contest` + `rules.hall.culture[fac].contest/hall_law` (Task 1);
  the region's own `rng`/`hashStr`/`H(canon)` (shipped in Slice A); the `ctx` object
  `{locId, locType, tier, phaseIndex, day, fac, cond, status, seedBase}` built by
  `hallCtxOf` (shipped Slice A).
- Produces: `HALL.contestOf(ctx, canon) -> {name:string, resolver:'brawl'|'match',
  hallLaw:boolean}`.
- Produces: `HALL.wagerFor(ctx, canon) -> number` — the tier's base wager (tier 1/2/3).
- Produces: `HALL.matchResolve(ctx, canon, opts) -> {won, cheated, caught, act, stake,
  payout, roll, catchRoll}` where `opts = {wager:number, cheat:boolean, nonce:string,
  axes:{ferocity,cunning,pragmatism,honor,supremacism}}`. `act` is one of `'win'`,
  `'noble_loss'`, `'cheat_clean'`, `'cheat_caught'`, or `null`; `payout` is signed currency
  (`+stake` on a settled win, `-stake` otherwise).

- [ ] **Step 1: Write the failing tests**

Append to `tests/hall-core.test.js` (the file's existing `ctx(over)` helper and `D`/`HALL`
bindings are already in scope from Slice A):

```js
const AX_PLAIN = { honor: 50, cunning: 50, ferocity: 50, pragmatism: 50, supremacism: 50 };
const AX_SLY = { honor: 20, cunning: 95, ferocity: 50, pragmatism: 50, supremacism: 50 };

test('contestOf reads the skin: name, resolver, hall-law flag', () => {
  const we = HALL.contestOf(ctx({ fac: 'world_eaters' }), D);
  assert.equal(we.resolver, 'brawl');
  assert.ok(we.name.length > 2);
  assert.equal(we.hallLaw, true);
  const mil = HALL.contestOf(ctx({ fac: 'militarum' }), D);
  assert.equal(mil.resolver, 'match');
  const ork = HALL.contestOf(ctx({ fac: 'orks' }), D);
  assert.equal(ork.hallLaw, false, 'Da Grog Den is bound by no hall law');
});

test('wagerFor climbs with the door tier', () => {
  assert.ok(HALL.wagerFor(ctx({ tier: 1 }), D) > 0);
  assert.ok(HALL.wagerFor(ctx({ tier: 3 }), D) > HALL.wagerFor(ctx({ tier: 1 }), D));
});

test('matchResolve is deterministic: same ctx + same nonce + same cheat flag, same result', () => {
  const o = { wager: 50, cheat: false, nonce: 'bout1', axes: AX_PLAIN };
  const a = HALL.matchResolve(ctx(), D, o);
  const b = HALL.matchResolve(ctx(), D, o);
  assert.deepEqual(a, b);
  // and a different bout on the same night is a different draw
  const c = HALL.matchResolve(ctx(), D, Object.assign({}, o, { nonce: 'bout2' }));
  assert.ok(a.roll !== c.roll, 'a second bout must draw its own roll');
});

test('matchResolve honest path: win pays the stake, loss forfeits it, acts are win/noble_loss', () => {
  let sawWin = false, sawLoss = false;
  for (let i = 0; i < 60; i++) {
    const r = HALL.matchResolve(ctx({ day: 40 + i }), D, { wager: 50, cheat: false, nonce: 'n', axes: AX_PLAIN });
    assert.equal(r.cheated, false);
    assert.equal(r.caught, false);
    assert.equal(r.stake, 50);
    if (r.won) { sawWin = true; assert.equal(r.act, 'win'); assert.equal(r.payout, 50); }
    else { sawLoss = true; assert.equal(r.act, 'noble_loss'); assert.equal(r.payout, -50); }
  }
  assert.ok(sawWin && sawLoss, 'an honest match must be able to go either way');
});

test('matchResolve: cheating raises the win rate and introduces a catch risk', () => {
  let honestWins = 0, cheatWins = 0, caught = 0;
  for (let i = 0; i < 200; i++) {
    const c = ctx({ day: 100 + i });
    if (HALL.matchResolve(c, D, { wager: 10, cheat: false, nonce: 'x', axes: AX_PLAIN }).won) honestWins++;
    const r = HALL.matchResolve(c, D, { wager: 10, cheat: true, nonce: 'x', axes: AX_PLAIN });
    if (r.won) cheatWins++;
    if (r.caught) caught++;
  }
  assert.ok(cheatWins > honestWins, 'cheating must actually improve the odds');
  assert.ok(caught > 0 && caught < 200, 'catching must be a real risk, not a certainty');
});

test('matchResolve: a caught cheat forfeits the stake and is judged cheat_caught', () => {
  let found = null;
  for (let i = 0; i < 300 && !found; i++) {
    const r = HALL.matchResolve(ctx({ day: 500 + i }), D, { wager: 30, cheat: true, nonce: 'c', axes: AX_PLAIN });
    if (r.caught) found = r;
  }
  assert.ok(found, 'expected at least one caught cheat in 300 draws');
  assert.equal(found.won, false, 'a caught cheat never keeps the win');
  assert.equal(found.act, 'cheat_caught');
  assert.equal(found.payout, -30);
});

test('matchResolve: an uncaught winning cheat reads cheat_clean; an uncaught losing cheat is judged not at all', () => {
  let clean = null, quiet = null;
  for (let i = 0; i < 300 && !(clean && quiet); i++) {
    const r = HALL.matchResolve(ctx({ day: 900 + i }), D, { wager: 20, cheat: true, nonce: 'q', axes: AX_SLY });
    if (r.caught) continue;
    if (r.won && !clean) clean = r;
    if (!r.won && !quiet) quiet = r;
  }
  assert.ok(clean, 'expected an uncaught winning cheat');
  assert.equal(clean.act, 'cheat_clean');
  assert.equal(clean.payout, 20);
  assert.ok(quiet, 'expected an uncaught losing cheat');
  assert.equal(quiet.act, null, 'nobody saw it and nobody won — there is nothing to judge');
});

test('matchResolve: a cunning culture catches its own cheats less often', () => {
  let plain = 0, sly = 0;
  for (let i = 0; i < 200; i++) {
    const c = ctx({ day: 2000 + i });
    if (HALL.matchResolve(c, D, { wager: 10, cheat: true, nonce: 'k', axes: AX_PLAIN }).caught) plain++;
    if (HALL.matchResolve(c, D, { wager: 10, cheat: true, nonce: 'k', axes: AX_SLY }).caught) sly++;
  }
  assert.ok(sly < plain, 'high cunning must relieve the catch risk (' + sly + ' vs ' + plain + ')');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/hall-core.test.js`
Expected: FAIL — `HALL.contestOf is not a function`.

- [ ] **Step 3: Implement**

Insert inside `/*<hall-core>*/`, immediately before the region's `return {...}` line:

```js
  /* ── T-SOC-1 B2: the CONTEST verb ──────────────────────────────────────────────
     contestOf: the skin's own trial of worth. Every culture declares one (canon
     Task 1); the resolver decides which engine runs it — 'brawl' is a real
     non-lethal fight on the grid, 'match' is the seeded opposed roll below. */
  function contestOf(ctx,canon){
    var cul=(H(canon).culture||{})[ctx.fac]||{},c=cul.contest||{};
    return {name:c.name||'a contest',resolver:c.resolver==='brawl'?'brawl':'match',
            hallLaw:cul.hall_law!==false};
  }
  function CN(canon){return (H(canon).contest)||{};}
  /* wagerFor: what this room plays for. Tier IS social gravity (spec §10) — the
     institution's table is richer than the back room's. */
  function wagerFor(ctx,canon){
    var w=(CN(canon).wager_by_tier||{})[String(ctx.tier)];
    return w==null?25:w;
  }
  /* matchResolve: the MATCH engine. One seeded stream per (seedBase, locId, day,
     nonce) draws BOTH rolls unconditionally — the win roll and the catch roll — so
     the stream stays stable whether or not the player cheats, and replays identically
     forever. Cheating lifts the win odds by cheat_shift and exposes a catch roll whose
     chance is catch_base, relieved by up to cunning_relief of itself as the culture's
     own cunning rises past its pivot (a deceitful culture polices deceit poorly).
     A caught cheat forfeits: the win is void and the stake is lost.
     Acts fed to the B1 judge: win / noble_loss / cheat_clean / cheat_caught — and null
     for an uncaught cheat that also lost, where there is nothing for the room to judge. */
  function matchResolve(ctx,canon,opts){
    opts=opts||{};
    var M=CN(canon).match||{},ax=opts.axes||{};
    var stake=opts.wager||0,cheat=!!opts.cheat;
    var r=rng((ctx.seedBase>>>0)^hashStr('match:'+ctx.locId+':'+ctx.day+':'+(opts.nonce||'')));
    var roll=r(),catchRoll=r();
    var p=(M.base_win==null?0.45:M.base_win)+(cheat?(M.cheat_shift||0):0);
    if(p>1)p=1;if(p<0)p=0;
    var won=roll<p;
    var caught=false;
    if(cheat){
      var pivot=(M.cunning_pivot==null?60:M.cunning_pivot);
      var over=Math.max(0,Math.min(100,(ax.cunning||0)-pivot))/100;
      var relief=1-over*(M.cunning_relief||0);
      caught=catchRoll<((M.catch_base||0)*relief);
    }
    if(caught)won=false;                                  // forfeit: the win does not stand
    var act=caught?'cheat_caught':(cheat?(won?'cheat_clean':null):(won?'win':'noble_loss'));
    return {won:won,cheated:cheat,caught:caught,act:act,stake:stake,
            payout:won?stake:-stake,roll:roll,catchRoll:catchRoll};
  }
```

Add `contestOf:contestOf, wagerFor:wagerFor, matchResolve:matchResolve` to the region's
`return {...}` object.

- [ ] **Step 4: Run tests**

Run: `node --test tests/hall-core.test.js` → PASS.
Run: `node --test` → green (749 + the new pins).

- [ ] **Step 5: Commit**

```bash
git add -p index.html
git add tests/hall-core.test.js
git commit -m "engine: hall-core CONTEST readers + MATCH resolver — seeded opposed roll, cheat shift, cunning-relieved catch risk"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 3: HALL core — `brawlAct`, `lawPenalty`, `barCheck`

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Consumes: `rules.hall.law` + `rules.hall.culture[fac].hall_law` (Task 1); `contestOf`
  (Task 2).
- Produces: `HALL.brawlAct(mineWon, enemyHurt) -> 'win'|'noble_loss'|null` — classifies a
  concluded bout into a trust act. A win is a win; a loss in which you drew blood is a noble
  loss; a loss in which you never touched them earns nothing.
- Produces: `HALL.lawPenalty(ctx, canon) -> {standing:number, days:number}|null` — `null`
  where the skin sets `hall_law:false` (no law to break).
- Produces: `HALL.barCheck(bar, locId, day) -> {barred:boolean, left:number}` where `bar` is
  the plain `S.social.bar` map of `locId -> untilDay`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/hall-core.test.js`:

```js
test('brawlAct: a win is a win; a bloodied loss is noble; a bloodless loss earns nothing', () => {
  assert.equal(HALL.brawlAct(true, true), 'win');
  assert.equal(HALL.brawlAct(true, false), 'win');
  assert.equal(HALL.brawlAct(false, true), 'noble_loss');
  assert.equal(HALL.brawlAct(false, false), null);
});

test('lawPenalty: standing hit + barred days under hall law, nothing in Da Grog Den', () => {
  const p = HALL.lawPenalty(ctx({ fac: 'militarum' }), D);
  assert.ok(p, 'a lawful hall must punish un-challenged violence');
  assert.ok(p.standing < 0, 'the ruling faction takes offence');
  assert.ok(p.days >= 1, 'and shuts the door for a while');
  assert.equal(HALL.lawPenalty(ctx({ fac: 'orks' }), D), null, 'Da Grog Den has no hall law to break');
});

test('barCheck: reads the bar ledger and counts the days left', () => {
  const bar = { 'vigilus/sanctum': 45 };
  assert.deepEqual(HALL.barCheck(bar, 'vigilus/sanctum', 40), { barred: true, left: 5 });
  assert.deepEqual(HALL.barCheck(bar, 'vigilus/sanctum', 45), { barred: false, left: 0 });
  assert.deepEqual(HALL.barCheck(bar, 'vigilus/sanctum', 99), { barred: false, left: 0 });
  assert.deepEqual(HALL.barCheck(bar, 'somewhere/else', 40), { barred: false, left: 0 });
  assert.deepEqual(HALL.barCheck(null, 'vigilus/sanctum', 40), { barred: false, left: 0 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/hall-core.test.js`
Expected: FAIL — `HALL.brawlAct is not a function`.

- [ ] **Step 3: Implement**

Insert inside `/*<hall-core>*/`, after `matchResolve`:

```js
  /* brawlAct: how the room judges a concluded bout. The BRAWL engine is a real fight,
     so the classification reads what actually happened on the grid rather than a roll:
     a win is a win; losing after drawing blood is the NOBLE LOSS the honor-heavy
     cultures respect; being beaten without landing a wound is simply not a story. */
  function brawlAct(mineWon,enemyHurt){
    return mineWon?'win':(enemyHurt?'noble_loss':null);
  }
  /* lawPenalty: the Hall is bound ground (spec §4). Violence inside the contest frame
     is sacred; violence outside it costs standing with the ruling faction and shuts the
     door for a window of days. A skin with hall_law:false (Da Grog Den) returns null —
     there is no law there to break, because the unsanctioned scrap IS the contest. */
  function lawPenalty(ctx,canon){
    if(!contestOf(ctx,canon).hallLaw)return null;
    var L=(H(canon).law)||{};
    return {standing:(L.standing_penalty==null?-1:L.standing_penalty),
            days:(L.barred_days==null?5:L.barred_days)};
  }
  /* barCheck: is this door shut to us today, and for how much longer. Pure read of the
     plain {locId:untilDay} ledger the glue persists at S.social.bar. */
  function barCheck(bar,locId,day){
    var until=(bar||{})[locId]||0;
    return (until>day)?{barred:true,left:until-day}:{barred:false,left:0};
  }
```

Add `brawlAct:brawlAct, lawPenalty:lawPenalty, barCheck:barCheck` to the region's `return`.

- [ ] **Step 4: Run tests**

Run: `node --test tests/hall-core.test.js` → PASS. Run `node --test` → green.

- [ ] **Step 5: Commit**

```bash
git add -p index.html
git add tests/hall-core.test.js
git commit -m "engine: hall-core brawl act classification + hall-law penalty + bar check"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 4: Engine glue — the MATCH contest on the Champion row

**Files:**
- Modify: `index.html` — new `hallContest`/`hallMatch` handlers next to `hallCommuneReg`
  (~L7983); the Champion row in the `hall` renderDoor branch (~L8183-8192)
- Test: browser E2E (this task ships no new pure code)

**Interfaces:**
- Consumes: `HALL.contestOf/wagerFor/matchResolve/rungOf` (Tasks 2-3); the shipped
  `hallCtxOf(h) -> {ctx,wctx,wctx2,pl,loc}`, `hallAxesOf(fac) -> the 5 doctrine axes`,
  `hallTrustRecord(hc, role, act) -> {index,name}`, `HALL.regularsAt`; the engine's
  `T(msg)` toast, `curName()`, `persist()`, `rW()`, `esc()`, `rShop()` (the door
  re-render — the same call the tier-upgrade button already uses).
- Produces: `hallContest(rg, hc)` — the single CONTEST entry point; dispatches on the
  skin's resolver to `hallMatch` (this task) or `hallBout` (Task 5).
- Produces: `hallMatch(rg, hc, cheat)` — resolves a MATCH, moves currency, records the act.

- [ ] **Step 1: Add the handlers**

Next to `hallCommuneReg`, add:

```js
/* T-SOC-1 B2: CONTEST — the culture's own trial of worth. One entry point; the skin's
   declared resolver decides which engine runs (canon rules.hall.culture[fac].contest).
   Rung gate (see the plan's open-decision note): a CHALLENGE is open to anyone — that is
   deliberately how a high-ferocity culture, whose judge zeroes every non-win act, can ever
   climb at all — but the WAGERED bout is the Champion's rung-② unlock. */
function hallWagerFor(hc,rg){
 var key=hc.ctx.locId+'/'+rg.role,rec=(S.social.reg||{})[key]||{score:0};
 var rung=HALL.rungOf(rec.score||0,hc.ctx,D);
 var min=((D.rules.hall.contest||{}).wagered_rung_min);
 return (rung.index>=(min==null?1:min))?HALL.wagerFor(hc.ctx,D):0;
}
function hallContest(rg,hc,cheat){
 var con=HALL.contestOf(hc.ctx,D);
 if(con.resolver==='brawl')hallBout(rg,hc);
 else hallMatch(rg,hc,!!cheat);
}
function hallMatch(rg,hc,cheat){
 var out=document.getElementById('hallout');if(!rg||!out)return;
 var con=HALL.contestOf(hc.ctx,D),wager=hallWagerFor(hc,rg);
 if(wager&&(S.cur||0)<wager){T('You cannot cover the wager — '+wager+' '+curName()+'.');return}
 /* nonce: one bout per regular per day is a distinct draw, and a rematch after a
    resolved bout draws again — the counter lives on the trust record's act tally, which
    is already persisted, so a reload never re-rolls a bout that already happened. */
 var key=hc.ctx.locId+'/'+rg.role;
 var rec=S.social.reg[key]||(S.social.reg[key]={score:0,acts:{},lastSeen:0});
 var n=(rec.acts.win||0)+(rec.acts.noble_loss||0)+(rec.acts.cheat_clean||0)+(rec.acts.cheat_caught||0);
 var res=HALL.matchResolve(hc.ctx,D,{wager:wager,cheat:!!cheat,nonce:rg.role+':'+n,
   axes:hallAxesOf(hc.ctx.fac)});
 if(wager)S.cur=Math.max(0,(S.cur||0)+res.payout);
 var rung=res.act?hallTrustRecord(hc,rg.role,res.act):HALL.rungOf(rec.score||0,hc.ctx,D);
 var line=esc(con.name)+' — '
  +(res.caught?'caught. The room saw the trick, and the '+esc(rg.name)+' says nothing at all.'
   :res.won?'you take it.':'the '+esc(rg.name)+' takes it.');
 if(wager)line+=' Stake '+(res.payout>0?'won +':'lost ')+Math.abs(res.payout)+' '+curName()+'.';
 line+=' <span style="color:var(--dim)">('+esc(rung.name)+')</span>';
 out.innerHTML=line;
 rW();persist();
}
```

Note: `hallTrustRecord` already calls `persist()` itself; the extra `persist()` here covers
the currency move on a `null`-act bout. Both are cheap and idempotent.

- [ ] **Step 2: Render the CONTEST controls on the Champion row**

Inside the `hall` renderDoor branch, in the `regs.map(...)` callback that builds each
regular row, append the contest controls **only for the champion** (leave Host/Broker rows
exactly as B1 shipped them):

```js
     var _con=HALL.contestOf(hc.ctx,D),_wag=hallWagerFor(hc,rg),_ctl='';
     if(rg.role==='champion'){
       var _conTip='<b>Contest</b> — '+GLOSS['Contest'];
       _ctl=' <button class="btn gh sm" data-hallcon="'+esc(rg.role)+'"><span class="tipable" data-tip="'+_conTip.replace(/"/g,'&quot;')+'">'+esc(_con.name)+'</span>'
         +(_wag?' ('+_wag+' '+curName()+')':' (no stake)')+'</button>';
       if(_con.resolver==='match')_ctl+=' <button class="btn gh sm" data-hallcheat="'+esc(rg.role)+'">Palm the odds</button>';
     }
```

and add `+_ctl` to the row's returned HTML, immediately after the existing commune button.
Then wire the two new data-attributes next to the existing `[data-hallcom]` wiring:

```js
   c.querySelectorAll('[data-hallcon]').forEach(function(b){b.onclick=function(){
     var rg=null;regs.forEach(function(r){if(r.role===b.dataset.hallcon)rg=r;});
     hallContest(rg,hc,false);};});
   c.querySelectorAll('[data-hallcheat]').forEach(function(b){b.onclick=function(){
     var rg=null;regs.forEach(function(r){if(r.role===b.dataset.hallcheat)rg=r;});
     hallContest(rg,hc,true);};});
```

- [ ] **Step 3: Add the GLOSS entry the tooltip reads**

In the `GLOSS` object (`index.html:7613`), add:

```js
 'Contest':'the culture\'s own trial of worth — a brawl or a match. Win, lose well, or cheat: the room judges all three, and the judging is the culture\'s, not yours.',
```

- [ ] **Step 4: Browser E2E**

Serve (`python3 -m http.server 8765`) and drive with Playwright MCP:

1. `window._noPersist=true` FIRST.
2. Found or load a commander whose ruling culture resolves to **match** — the Astra
   Militarum Mess is the readable case (`militarum`); stand at a location whose type carries
   a hall (every crown world does).
3. Open Requisition → the Hall. In an evening/night phase the ★ Champion row renders with a
   contest button labelled with the culture's contest name and `(no stake)` at STRANGER.
4. Click it → an outcome line renders naming the contest; the rung label in the line matches
   the row's. Repeat until the rung reaches KNOWN → the button now shows the wager amount.
5. Click "Palm the odds" with funds → currency moves by exactly the wager, and the outcome
   line reads either a clean take or a caught trick.
6. Reload the page (same day) and re-run one bout → the *next* bout draws its own result
   (the act tally advanced), and no error is thrown.
7. Sweep all 7 screens + the title screen → **0 console errors**. Record the result.

- [ ] **Step 5: Commit**

```bash
git add -p index.html
git commit -m "engine: the Hall's MATCH contest — Champion challenge + cheat option, tier wagers, trust acts through the B1 judge"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 5: The BRAWL contest — a non-lethal bout on the grid, settled at conclude

**Files:**
- Modify: `index.html` — `/*<thread-core>*/`: `initState` (~L567), `apply`'s damage branch
  (~L882), `npcExpDamage` (~L1679); glue: `hallBout` next to `hallMatch`;
  `concludeThread` (~L5098) settlement hook
- Test: `tests/thread-core.test.js` (extend), browser E2E

**Interfaces:**
- Consumes: `HALL.contestOf/wagerFor/brawlAct` (Tasks 2-3), `hallWagerFor`/`hallCtxOf`/
  `hallTrustRecord` (Task 4 + B1); the shipped `genHostCombatants(fac, hostName, mineCount,
  missionParams, missionTarget, seed)`, `MISSION.genHostiles`' `{duel:true, filter:'named',
  target_name}` contract, `activeModel()`, `S.forces`, `threadOfForce`,
  `stationedThreadLockOf`, `ULT.seedFor`, `WORLD.dayIndexAt`, `facByName`/`FAC`,
  `openT(id)`, `go('threads')`, `rTL()`.
- Produces: thread-core `state.nonLethal` (boolean, rides `seedState.nonLethal` through
  `initState`) — when true, EVERY damage effect in that thread is floored at 1 wound, not
  only those from a weapon whose own description says Non-Lethal.
- Produces: `hallBout(rg, hc)` — mints the bout thread and stamps
  `t.hall = {locId, role, fac, wager, day}`.
- Produces: the `concludeThread` hook — reads `t.hall`, settles the wager, emits the act.

**Why the bout cannot reuse `startThread`:** `startThread` routes combat seeding through
`seedCombat`, which returns early unless an NPC *garrison force* is present at the location
(`if(!fac)return;`) and, for SKIRMISH threads, floors your standing with whoever it seeded
(the kin-raid rule). A sanctioned bout has no garrison and is not a raid. `hallBout`
therefore builds its thread object directly and seeds it itself — exactly the pattern
`manualRestore` (~L4249) already uses for the same reason.

- [ ] **Step 1: Write the failing thread-core test**

Append to `tests/thread-core.test.js` (reuse the file's existing THREAD binding, canon `D`,
and its established state-building helpers; the shape below matches the file's other
`apply` pins):

```js
test('thread-level nonLethal floors every damage effect at 1 wound', () => {
  const mk = () => ({ id: 'brawl1', pools: { You: 10, Them: 10 },
    combatants: {
      m1: { w: [4, 4], conds: [], party: 'You', model: { n: 'Mine' } },
      e0: { w: [3, 3], conds: [], party: 'Them', model: { n: 'Theirs' }, gen: { n: 'Theirs' } } },
    joined: true, board: null, phase: 'battle', fog: {}, round: 1 });
  const block = [{ actor: 'm1', cost: 1,
    effect: { kind: 'damage', to: 'e0', amount: 99, element: 'Physical', weapon: 'Fist' } }];

  const lethal = mk();
  THREAD.apply(lethal, block, D);
  assert.equal(lethal.combatants.e0.w[0], 0, 'without the flag a 99-damage hit kills');
  assert.equal(lethal.combatants.e0.dead, true);

  const bout = mk(); bout.nonLethal = true;
  THREAD.apply(bout, block, D);
  assert.equal(bout.combatants.e0.w[0], 1, 'a bout never drops a combatant below 1 wound');
  assert.ok(!bout.combatants.e0.dead, 'and nobody dies in a sanctioned bout');
});

test('initState carries seedState.nonLethal onto the live state', () => {
  const s = THREAD.initState({ id: 'b1', type: 'SKIRMISH', seedState: { nonLethal: true, pools: {}, combatants: {} } }, D);
  assert.equal(s.nonLethal, true);
  const plain = THREAD.initState({ id: 'b2', type: 'SKIRMISH', seedState: { pools: {}, combatants: {} } }, D);
  assert.equal(plain.nonLethal, false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — the bout combatant reaches 0 wounds and `s.nonLethal` is `undefined`.

- [ ] **Step 3: Implement the three core edits**

`initState` (~L567) — add the field to the state literal, next to `joined`:

```js
            joined:!!seed.joined, nonLethal:!!seed.nonLethal, terms:seed.terms||null,
```

`apply`'s damage branch (~L882) — widen the existing Non-Lethal floor:

```js
        // T-SOC-1 B2: a thread-level flag (a sanctioned Hall bout) floors EVERY effect,
        // not only weapons whose own description reads Non-Lethal.
        if(e.nonLethal||state.nonLethal)_taken=Math.min(_taken,Math.max(0,c.w[0]-1));
```

`npcExpDamage` (~L1679) — mirror it, so the NPC brain scores the physics the pipeline will
actually deliver (the function's own comment already promises this mirroring):

```js
    if(w.nonLethal||(state&&state.nonLethal))taken=Math.min(taken,Math.max(0,t.w[0]-1));
```

- [ ] **Step 4: Run the core tests**

Run: `node --test tests/thread-core.test.js` → PASS.
Run: `node --test` → green. ⚠ This task touches the hot THREAD core: if any existing
grid/npc-turn/cond pin moves, STOP and read it — a green suite is the gate for continuing.

- [ ] **Step 5: Commit the core change on its own**

```bash
git add -p index.html
git add tests/thread-core.test.js
git commit -m "engine: thread-level nonLethal — a sanctioned bout floors every effect at 1 wound (apply + npcExpDamage + initState)"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

- [ ] **Step 6: Add `hallBout` (the glue)**

Next to `hallMatch`, add:

```js
/* T-SOC-1 B2: the BRAWL engine. A pit bout is a non-lethal 1v1 against the Champion by
   name, fought on the ordinary battlefield grid — no new combat machinery. The thread is
   built here rather than through startThread because startThread seeds via seedCombat,
   which needs an NPC garrison at the location (a Hall has none) and floors standing with
   whoever it seeds (a sanctioned bout is not a raid). Same direct-mint pattern as
   manualRestore. genHostiles' duel+named contract spawns exactly ONE model, no escort. */
function hallBout(rg,hc){
 var am=activeModel(),force=S.forces.filter(function(f){return f.lead===am.id})[0];
 if(!force){T('No Force to fight with.');return}
 var other=threadOfForce(force.n);
 if(other){T(force.n+' is already committed to "'+other.n+'". One Force can only be in one thread at a time.');return}
 var _slk=stationedThreadLockOf(force.id);
 if(_slk){T(force.n+' is standing garrison at '+((lById(_slk)||{}).name||_slk)+'. Recall it first.');return}
 var wager=hallWagerFor(hc,rg);
 if(wager&&(S.cur||0)<wager){T('You cannot cover the wager — '+wager+' '+curName()+'.');return}
 var fac=FAC(hc.ctx.fac);if(!fac){T('No one here will stand against you.');return}
 var con=HALL.contestOf(hc.ctx,D),l=hc.loc,pl=hc.pl.p;
 var mine=S.roster.filter(function(m){return m.fo===force.n&&m.st!=='DEAD'&&m.st!=='TAKEN'});
 if(!mine.length){T('No model in '+force.n+' can stand up.');return}
 var C={},pools={};
 mine.forEach(function(m){var p=(m.w||'1/1').split('/');
  C[m.id]={w:[parseInt(p[0],10)||1,parseInt(p[1],10)||1],conds:[],party:force.n,model:m,
   armour:(m.loadout&&m.loadout.armour&&m.loadout.armour.it)?m.loadout.armour.it.def:null};});
 pools[force.n]=force.ap;
 var hostName=rg.name;
 var seed=ULT.seedFor(S.world.missionSeedBase||1,hc.ctx.day,l.id,'bout:'+rg.role);
 var g=genHostCombatants(fac,hostName,1,{duel:true,filter:'named',target_name:rg.name},1,seed);
 if(!g.specs.length){T('The '+rg.name+' will not be drawn out tonight.');return}
 for(var k in g.C)C[k]=g.C[k];
 pools[hostName]=g.ap;
 var id='bout_'+l.id+'_'+S.threads.length;
 var t={id:id,type:'SKIRMISH',n:con.name+' — '+rg.name,loc:pl.name+' · '+l.name,pl:pl.id,lid:l.id,
  turn:'you',vis:'public',initiator:'You ('+am.n.split(',')[0]+')',
  about:'A sanctioned '+con.name+' in '+l.name+'. Nobody dies here: every blow is floored at a single wound, and the room is watching.',
  forces:[force.n,hostName],npc:null,
  hall:{locId:hc.ctx.locId,role:rg.role,fac:hc.ctx.fac,wager:wager,day:hc.ctx.day}};
 t.seedState={pools:pools,combatants:C,joined:false,nonLethal:true};
 if(wager)S.cur=Math.max(0,(S.cur||0)-wager);          // stake goes down on the table now
 S.threads.push(t);
 var hkey=pl.id+'/'+l.id;if(!S.world.history[hkey])S.world.history[hkey]=[];
 S.world.history[hkey].unshift('SKIRMISH — '+t.n+' · ACTIVE (you)');
 persist();T(con.name+' called — '+force.n+' committed'+(wager?', '+wager+' '+curName()+' on the table':'')+'.');
 go('threads');rTL();openT(id);
}
```

- [ ] **Step 7: Settle the bout at conclude**

In `concludeThread(t,oc)`, insert **immediately after the RESOLUTION post is pushed** — the
`t.posts.push({who:'THE RECORD',...})` line at ~L5119. That position matters for two
reasons: `mineWon` is already computed above it, and `t.posts` is only initialized on the
line just before it (`if(!t.posts)t.posts=[];`), so an earlier insertion would push onto
`undefined`. Add:

```js
 /* T-SOC-1 B2: a Hall bout settles socially, not territorially — the wager returns
    doubled on a win or stays on the table on a loss, and the room's judgement of how you
    fought rides the B1 judge (win / noble_loss / nothing at all). Guarded on t.hall, so
    every other thread in the game reaches this line and does nothing. */
 if(t.hall){
  var _hb=t.hall,_hC=(t.state&&t.state.combatants)||{},_hurt=false;
  Object.keys(_hC).forEach(function(id){var c=_hC[id];
   if(c.gen&&c.w&&c.w[0]<c.w[1])_hurt=true;});
  if(_hb.wager&&mineWon)S.cur=(S.cur||0)+_hb.wager*2;
  var _act=HALL.brawlAct(mineWon,_hurt);
  if(_act){
   var _hc={ctx:{locId:_hb.locId,fac:_hb.fac,day:_hb.day}};
   hallTrustRecord(_hc,_hb.role,_act);
  }
  t.posts.push({who:'THE HALL',tag:'',stamp:nowStamp(),
   body:'⚁ THE BOUT — '+(mineWon?'you hold the floor.':_hurt?'you are put down, but you made them work for it.':'you are put down without landing a blow.')
     +(_hb.wager?(mineWon?' The stake comes back doubled: +'+(_hb.wager*2)+'.':' The stake stays on the table.'):'')});
 }
```

⚠ `hallTrustRecord` reads only `hc.ctx.locId`, `hc.ctx.fac` and `hc.ctx.day` (verify at the
function, `index.html:7962`) — the minimal `_hc` above is deliberate: at conclude time the
player may be standing anywhere, so rebuilding a live `hallCtxOf` would key the trust record
to the wrong Hall. If `hallTrustRecord` has grown to read more of `ctx` by execution time,
extend `t.hall` with those fields at mint time rather than widening the read.

- [ ] **Step 8: Browser E2E**

1. `window._noPersist=true` FIRST.
2. Load a commander whose ruling culture resolves to **brawl** — World Eaters (`world_eaters`,
   the Skullpit) or Orks (`orks`, Da Grog Den) are the readable cases. Raise a Force with the
   active model as its leader and leave it idle.
3. Open the Hall → the Champion row's contest button reads the culture's bout name. Click it.
4. The Threads screen opens on a new SKIRMISH named `<contest> — <champion name>`, with
   exactly ONE hostile on the enemy side, carrying the champion's own name.
5. Fight it out on the grid. Confirm: no combatant on either side ever drops below 1 wound
   and nothing is ever marked DEAD, no matter the damage dealt.
6. Conclude the thread → THE HALL post renders with the outcome; return to the Hall and
   confirm the Champion's rung label moved (a win) or held (a bloodless loss).
7. With a wager live (rung KNOWN+), confirm currency drops by the stake at the call and
   returns doubled on a win.
8. Sweep all 7 screens → **0 console errors**.

- [ ] **Step 9: Commit**

```bash
git add -p index.html
git commit -m "engine: the Hall's BRAWL contest — non-lethal named 1v1 vs the Champion, wager staked at call and settled at conclude"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 6: Hall law — un-challenged violence, the standing hit, and the barred door

**Files:**
- Modify: `index.html` — `S.social.bar` seeding (defaults literal ~L7482 + `init()`
  ~L7352-7354); `hallStrike` next to `hallBout`; the `hall` renderDoor branch (barred gate +
  the patron STRIKE control)
- Test: browser E2E (the pure law helpers were pinned in Task 3)

**Interfaces:**
- Consumes: `HALL.lawPenalty/barCheck/contestOf` (Task 3), `hallBout` (Task 5),
  `SEAT.moveStanding(ledger, facId, delta)` and `SEAT.standingName(value, canon)` (shipped
  T-TERR-2), `S.world.standing` (the shipped 20×20 ledger, keyed by faction id).
- Produces: `S.social.bar = {[locId]: untilDay}` — a new save key, seeded at BOTH sites.
- Produces: `hallStrike(p, hc)` — un-challenged violence against a patron.

- [ ] **Step 1: Seed the new save key at both sites**

Defaults literal (`index.html:7482`): `social:{pat:{},reg:{}},` → `social:{pat:{},reg:{},bar:{}},`

`init()` backfill (next to the two existing `S.social` guards at ~L7353-7354):

```js
  if(!S.social.bar)S.social.bar={};                                      // T-SOC-1 B2: hall-law bars
```

- [ ] **Step 2: Add the strike handler**

Next to `hallBout`, add:

```js
/* T-SOC-1 B2 — hall law (spec §4). The Hall is bound ground: violence INSIDE the contest
   frame is sacred, violence outside it is a crime against the house. Striking an
   un-challenged patron costs standing with the ruling faction and shuts the door for a
   window of days. Where the skin sets hall_law:false (Da Grog Den), lawPenalty returns
   null and the scrap simply IS the contest — it routes to hallBout instead, and the
   room's Champion judges it like any other bout. */
function hallStrike(p,hc){
 var out=document.getElementById('hallout');if(!p||!out)return;
 var pen=HALL.lawPenalty(hc.ctx,D);
 if(!pen){                                       // lawless hall: this is just how they contest
  var regs=HALL.regularsAt(hc.ctx,D).filter(function(r){return r.present&&r.role==='champion';});
  if(regs.length)hallBout(regs[0],hc);
  else out.innerHTML='You swing. Half the room joins in. Nobody here minds.';
  return;
 }
 S.world.standing=S.world.standing||{};
 var was=(S.world.standing[hc.ctx.fac]||0);
 var now=SEAT.moveStanding(S.world.standing,hc.ctx.fac,pen.standing);
 S.social.bar=S.social.bar||{};
 S.social.bar[hc.ctx.locId]=hc.ctx.day+pen.days;
 hallTrustRecord(hc,'host','lawbreak');          // the keeper of the space remembers first
 out.innerHTML='You strike '+esc(p.name)+' un-challenged. The room goes silent, then closes on you. '
  +'Standing with '+esc((FAC(hc.ctx.fac)||{}).name||hc.ctx.fac)+' falls to '+esc(SEAT.standingName(now,D))
  +(was!==now?'':' (already at the floor)')+', and you are barred from this hall for '+pen.days+' days.';
 rW();persist();
}
```

- [ ] **Step 3: Gate the door when barred, and add the STRIKE control**

At the very top of the `hall` renderDoor branch's `else` block (right after `var hc=hallCtxOf({tier:tier})`),
add the gate:

```js
   var _bar=HALL.barCheck(S.social.bar,hc.ctx.locId,hc.ctx.day);
   if(_bar.barred){
    c.insertAdjacentHTML('beforeend','<div class="d" style="border-left:3px solid var(--blh);padding-left:8px">'
      +'The doorway fills before you reach it. You are barred from this hall for '+_bar.left
      +(_bar.left===1?' more day':' more days')+' — the house has not forgotten.</div>');
   }else{
```

…and close that `else` at the end of the branch (before the branch's existing closing `}`).
Keep the whole B1 render inside it untouched — a barred door renders the notice and nothing
else: no crowd, no regulars, no verbs.

On each patron row (the `pats.map(...)` callback), append a strike control after the offer
button:

```js
     +' <button class="btn gh sm" data-hallhit="'+i+'">'+esc(HALL.contestOf(hc.ctx,D).hallLaw?'Strike':'Start somethin\'')+'</button>'
```

and wire it next to the other patron handlers:

```js
   c.querySelectorAll('[data-hallhit]').forEach(function(b){b.onclick=function(){
     hallStrike(pats[+b.dataset.hallhit],hc);};});
```

- [ ] **Step 4: Add the GLOSS entry**

In `GLOSS`:

```js
 'Hall law':'the Hall is bound ground: a fight inside the contest frame is sacred, a fight outside it is a crime against the house — standing with the ruling faction falls and the door shuts for days. Da Grog Den keeps no such law.',
```

Wire it as a `.tipable` on the barred notice and on the Strike button, using the same
`data-tip` pattern the B1 rows already use.

- [ ] **Step 5: Browser E2E**

1. `window._noPersist=true` FIRST.
2. On a lawful culture (Astra Militarum), open the Hall and note the current standing on the
   HQ/profile readout. Click **Strike** on a patron.
3. Confirm: the outcome line names the standing drop and the barred window; `S.world.standing`
   for that faction fell by exactly the canon penalty; `S.social.bar` carries
   `locId -> day + barred_days`.
4. Re-open the Hall → the barred notice renders and NO crowd, regulars, or verb buttons are
   present. Confirm the day counter reads down correctly.
5. On an Ork hall (`orks`, hall_law:false), click the strike control → no standing change, no
   bar; if a Champion is present it opens a real bout thread instead.
6. Sweep all 7 screens → **0 console errors**.

- [ ] **Step 6: Commit**

```bash
git add -p index.html
git commit -m "engine: hall law — un-challenged violence costs ruling-faction standing and bars the door; Da Grog Den exempt (the scrap IS the contest)"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 7: The Champion's deep unlocks — rung ③ training, rung ④ title fight

**Files:**
- Modify: `index.html` — `/*<hall-core>*/` (`trainOffer`, `titleGate`); glue `hallTrain` +
  the title-fight branch in `hallBout`/`hallContest`; the Champion row controls
- Test: `tests/hall-core.test.js` (extend), browser E2E

**Interfaces:**
- Consumes: `rules.hall.champion` (Task 1), `HALL.rungOf` (B1), `HALL.wagerFor` (Task 2),
  `hallBout` (Task 5), `THREAD.condDur(tag, tier)` (shipped), `CHRON.record(S, lid, rec,
  canon)` (shipped), `SEAT.moveStanding` (shipped), `ULT.seedFor` (shipped).
- Produces: `HALL.trainOffer(ctx, canon, rungIndex) -> {tag, tier, days, cost}|null` — null
  below the canon rung gate.
- Produces: `HALL.titleGate(rungIndex, canon) -> boolean`.
- Produces: `S.social.train = {tag, tier, untilDay}` — a pending buff consumed by the next
  combat thread the player opens.

**Scope decision (recommended, and taken here):** the title fight ships in B2 rather than
deferring to Slice C. It is the Champion's whole payoff, it rides the CONTEST machinery
Tasks 4-5 just built, and every system it writes to — the Chronicle, the standing ledger —
is already shipped. Deferring it would leave rung ④ as a visible dead end.

- [ ] **Step 1: Write the failing core tests**

Append to `tests/hall-core.test.js`:

```js
test('trainOffer is gated at the canon rung and prices off the tier wager', () => {
  assert.equal(HALL.trainOffer(ctx(), D, 0), null, 'a stranger buys no training');
  assert.equal(HALL.trainOffer(ctx(), D, 1), null, 'nor does an acquaintance');
  const t = HALL.trainOffer(ctx({ tier: 2 }), D, 2);
  assert.ok(t, 'TRUSTED unlocks training');
  assert.equal(typeof t.tag, 'string');
  assert.ok(t.tier >= 1);
  assert.ok(t.days >= 1, 'the buff must expire — no permanent creep');
  assert.equal(t.cost, HALL.wagerFor(ctx({ tier: 2 }), D) * D.rules.hall.champion.train.cost_mult);
  const t3 = HALL.trainOffer(ctx({ tier: 3 }), D, 3);
  assert.ok(t3.cost > t.cost, 'the institution charges more than the establishment');
});

test('titleGate opens only at the top rung', () => {
  assert.equal(HALL.titleGate(0, D), false);
  assert.equal(HALL.titleGate(2, D), false);
  assert.equal(HALL.titleGate(3, D), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/hall-core.test.js` → FAIL (`HALL.trainOffer is not a function`).

- [ ] **Step 3: Implement the core helpers**

Inside `/*<hall-core>*/`, after `barCheck`:

```js
  /* trainOffer: the Champion's rung-③ service (spec §6) — a purchasable, EXPIRING
     combat buff, never a permanent gain. Priced off the room's own wager ladder so a
     grander hall trains dearer. Returns null below the canon rung gate. */
  function trainOffer(ctx,canon,rungIndex){
    var T=((H(canon).champion)||{}).train||{};
    if(rungIndex<(T.rung_min==null?2:T.rung_min))return null;
    return {tag:T.tag||'Rally',tier:T.tier||1,days:T.days||3,
            cost:wagerFor(ctx,canon)*(T.cost_mult||3)};
  }
  /* titleGate: the rung-④ payoff — beat them in their own form. Design law (spec §6):
     rung ④ is never a bigger discount, always a bridge into another system. This one
     bridges into the Chronicle and the standing ledger. */
  function titleGate(rungIndex,canon){
    var TI=((H(canon).champion)||{}).title||{};
    return rungIndex>=(TI.rung_min==null?3:TI.rung_min);
  }
```

Add `trainOffer:trainOffer, titleGate:titleGate` to the region's `return`.

- [ ] **Step 4: Run the core tests**

Run: `node --test tests/hall-core.test.js` → PASS. Run `node --test` → green.

- [ ] **Step 5: Wire the training purchase (glue)**

Seed the new key at BOTH sites — defaults literal `social:{pat:{},reg:{},bar:{},train:null},`
and in `init()`: `if(S.social.train===undefined)S.social.train=null;`.

Next to `hallStrike`, add:

```js
/* T-SOC-1 B2: the Champion's rung-③ training. Buys ONE expiring buff, stored as a pending
   stamp; the next combat thread you open picks it up and it is spent. Rides the shipped
   CONDS registry (no new condition kinds) and the shipped duration table, so the buff
   ticks down and lapses exactly like every other condition in the game. */
function hallTrain(rg,hc){
 var out=document.getElementById('hallout');if(!rg||!out)return;
 var key=hc.ctx.locId+'/'+rg.role,rec=(S.social.reg||{})[key]||{score:0};
 var rung=HALL.rungOf(rec.score||0,hc.ctx,D);
 var off=HALL.trainOffer(hc.ctx,D,rung.index);
 if(!off){T('The '+rg.name+' does not train strangers.');return}
 if((S.cur||0)<off.cost){T('Training costs '+off.cost+' '+curName()+'.');return}
 S.cur-=off.cost;
 S.social.train={tag:off.tag,tier:off.tier,untilDay:hc.ctx.day+off.days};
 out.innerHTML='The '+esc(rg.name)+' takes you through the forms. '+esc(off.tag)+' '+off.tier
  +' rides your next fight — it lapses in '+off.days+' days if you do not use it.';
 rW();persist();
}
```

Consume it where player combatants are built. In BOTH `seedCombat` (after the
`mine.forEach(...)` loop that fills `C`) and `hallBout` (after its own identical loop), add:

```js
 // T-SOC-1 B2: a purchased Hall training rides the next fight, then is spent.
 var _tr=S.social&&S.social.train;
 if(_tr&&_tr.untilDay>WORLD.dayIndexAt(S,D,Date.now())){
  for(var _tk in C){if(C[_tk].gen)continue;
   C[_tk].conds.push({tag:_tr.tag,tier:_tr.tier,left:THREAD.condDur(_tr.tag,_tr.tier),
     src:'Hall training',el:null,nl:false,nr:false});}
  S.social.train=null;
 }else if(_tr)S.social.train=null;                 // lapsed unused
```

- [ ] **Step 6: Wire the title fight (glue)**

The title fight is a CONTEST at rung ④ with a bigger stake, and on a win it writes a
Chronicle record and notches ruling-faction standing. In `hallBout`, replace the flat
`var wager=hallWagerFor(hc,rg);` with a title-aware stake, and stamp the flag on `t.hall`:

```js
 var _rkey=hc.ctx.locId+'/'+rg.role,_rrec=(S.social.reg||{})[_rkey]||{score:0};
 var _rung=HALL.rungOf(_rrec.score||0,hc.ctx,D);
 var _title=HALL.titleGate(_rung.index,D);
 var wager=hallWagerFor(hc,rg);
 if(_title)wager=wager*(((D.rules.hall.champion||{}).title||{}).stake_mult||4);
```

and add `title:_title` to the `t.hall` object literal (and prefix the thread name with
`'TITLE — '` when `_title` is true, so the thread board reads what it is).

Then in `concludeThread`'s `t.hall` block (Task 5, Step 7), after the act is recorded, add
the title payoff:

```js
  if(_hb.title&&mineWon){
   var _tn=((D.rules.hall.champion||{}).title||{}).standing_notch||1;
   S.world.standing=S.world.standing||{};
   SEAT.moveStanding(S.world.standing,_hb.fac,_tn);
   var _tday=WORLD.dayIndexAt(S,D,Date.now());
   CHRON.record(S,t.lid,{day:_tday,kind:'title',
     att:'You ('+(activeModel()||{n:'the challenger'}).n.split(',')[0]+')',
     def:(_hC[Object.keys(_hC).filter(function(k){return !!_hC[k].gen;})[0]]||{model:{n:'the Champion'}}).model.n,
     outcome:'repelled',
     arith:t.n+' — the title taken in the house\'s own form; standing +'+_tn,
     seed:ULT.seedFor(S.world.missionSeedBase,_tday,t.lid,t.id)},D);
   t.posts.push({who:'THE HALL',tag:'',stamp:nowStamp(),
     body:'★ THE TITLE — the room stands. The form is yours now, and the house says so out loud. Standing with '
       +((FAC(_hb.fac)||{}).name||_hb.fac)+' rises a notch.'});
  }
```

⚠ `CHRON.record`'s `outcome` field keys `CHRON.titleOf`'s title table; `'repelled'` is the
existing key that reads correctly for a victory ("The Defense of …"). If a dedicated title
key is wanted, that is a canon/CHRON change and belongs in its own task, not here.

- [ ] **Step 7: Render the two controls**

In the Champion row's `_ctl` (Task 4, Step 2), append after the contest button:

```js
       var _tOff=HALL.trainOffer(hc.ctx,D,HALL.rungOf(((S.social.reg||{})[hc.ctx.locId+'/'+rg.role]||{score:0}).score||0,hc.ctx,D).index);
       if(_tOff)_ctl+=' <button class="btn gh sm" data-halltrain="'+esc(rg.role)+'">Train ('+_tOff.cost+' '+curName()+')</button>';
```

and wire it:

```js
   c.querySelectorAll('[data-halltrain]').forEach(function(b){b.onclick=function(){
     var rg=null;regs.forEach(function(r){if(r.role===b.dataset.halltrain)rg=r;});
     hallTrain(rg,hc);};});
```

The title fight needs no separate button — at rung ④ the existing contest button's label
gains the stake automatically. Make that legible: when `HALL.titleGate(rung.index,D)` is
true, prefix the contest button's label with `'TITLE FIGHT — '`.

- [ ] **Step 8: Browser E2E**

1. `window._noPersist=true` FIRST.
2. Drive a Champion's trust to TRUSTED (in-console: set
   `S.social.reg['<locId>/champion']={score:8,acts:{},lastSeen:0}` then re-render the door).
   Confirm the **Train** button appears with the tier-scaled price, and buying it drops
   currency and renders the buff line.
3. Open any combat thread → confirm the player's models carry the training condition on the
   first post, and that `S.social.train` is now `null` (spent).
4. Set the score to 15 (SWORN) → confirm the contest button reads **TITLE FIGHT** with the
   larger stake. Fight and win it.
5. Confirm: THE HALL title post renders; ruling-faction standing rose by the canon notch; the
   location's Chronicle section lists the new record and it opens as a readable account.
6. Sweep all 7 screens → **0 console errors**.

- [ ] **Step 9: Commit**

```bash
git add -p index.html
git add tests/hall-core.test.js
git commit -m "engine: Champion deep unlocks — rung-III expiring training buff, rung-IV title fight (chronicle record + standing notch)"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

### Task 8: GLOSS sweep, docs, backlog, and the tunables hand-off

**Files:** `index.html` (GLOSS), `CLAUDE.md`, `BACKLOG.md`

- [ ] **Step 1: GLOSS completeness**

Confirm all three new entries exist and are wired as `.tipable` where they appear:
`'Contest'` (Task 4), `'Hall law'` (Task 6), plus a new `'Bout'`:

```js
 'Bout':'a sanctioned Hall fight on the ordinary battlefield grid, made non-lethal — every blow is floored at a single wound, so nobody dies and nobody is taken.',
```

Wire `'Bout'` on the bout thread's own header via the existing tooltip idiom, and re-verify
the B1 entries (`Hall`, `Offering`, `Rumor`, `Regular`, `Trust`) still render.

- [ ] **Step 2: CLAUDE.md**

Add one bullet to the engine section, in the voice of the existing slice bullets: Hall slice
B2 (canon vN: per-skin `contest` + `hall_law`, `rules.hall.contest/law/champion`; hall-core
`contestOf`/`wagerFor`/`matchResolve`/`brawlAct`/`lawPenalty`/`barCheck`/`trainOffer`/
`titleGate`; thread-level `state.nonLethal`; the CONTEST verb through both engines; hall law
with the Ork exemption; Champion rung ③ training + rung ④ title fight; contest outcomes emit
the B1 trust acts). Name Slice C (local powers, giver profiles, social mission surface,
interaction events) as what remains.

- [ ] **Step 3: BACKLOG.md**

Update the `T-SOC-1` row: B2 built, the canon version, the test count, the exact commit
hashes and the exact paths touched (`heretics-40k-data-v1.json`, `index.html`,
`tests/hall-core.test.js`, `tests/canon-hall.test.js`, `tests/thread-core.test.js`,
`CLAUDE.md`, `BACKLOG.md`), status `ready-to-push`, and **Slice C still open**.

- [ ] **Step 4: Write the tunables hand-off into the backlog row**

List every flagged-for-review default this slice authored, verbatim, so Daak can tune from
one place: `contest.match.base_win` 0.45 · `cheat_shift` 0.30 · `catch_base` 0.35 ·
`cunning_pivot` 60 · `cunning_relief` 0.6 · `wager_by_tier` 25/50/100 ·
`wagered_rung_min` 1 · `law.barred_days` 5 · `law.standing_penalty` -1 ·
`champion.train` {Rally I, cost_mult 3, days 3, rung_min 2} ·
`champion.title` {rung_min 3, standing_notch 1, stake_mult 4} · the 20 authored contest
names and the 8-brawl/12-match resolver split · the brawl wager's ×2 win return.

Also record the two **open questions for Daak**, unresolved by design:
1. **The rung-② split** (see this plan's open-decision section): a challenge is open at
   STRANGER and only the *wager* is the rung-② unlock, because gating the whole contest at
   rung ② would leave the 8 high-ferocity factions permanently unable to climb — their judge
   zeroes every non-win act, and B2's win path is the intended fix. Confirm the split, or
   retune `rules.hall.trust.axis.ferocity_only_win` instead.
2. **The Gallery's crowd** (spec §4): "the Gallery watches an Ambush as theater — crowd never
   intervenes there." That behavior belongs to the Ambush event, which is Slice C, so no
   `crowd_intervenes` flag was minted in B2 — minting it now would be dead data. Confirm it
   lands with the Ambush.

- [ ] **Step 5: Full green-gate and a light browser re-check**

Run `node --test` → green. Re-open a Hall in the browser and confirm every tooltip renders
and the door still draws cleanly at tiers I, II and III (**0 console errors**).

- [ ] **Step 6: Commit**

```bash
git add -p index.html
git add -p CLAUDE.md
git add -p BACKLOG.md
git commit -m "docs: T-SOC-1 slice B2 close-out — GLOSS entries, CLAUDE.md engine bullet, backlog row + tunables hand-off"
git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"   # must print 0
```

---

## Self-Review

**1. Spec coverage.**

| Spec requirement | Task |
|---|---|
| §4 CONTEST — the fourth verb, per-culture name | 1 (canon), 4 (render + entry point) |
| §4 BRAWL resolver — real non-lethal fight, reusing duel machinery | 5 |
| §4 MATCH resolver — new pure helper, seeded opposed roll + wager + CHEAT with catch risk | 2 (core), 4 (glue) |
| §4 "Winning either pays the same social currencies" | 4 + 5 (both route through `hallTrustRecord`) |
| §4 Hall law — standing hit + barred N days for un-challenged violence | 1 (canon), 3 (core), 6 (glue) |
| §4 `hall_law:false` exception — Da Grog Den | 1 (canon flag), 3 (`lawPenalty` returns null), 6 (routes to a bout instead) |
| §6 CHAMPION rung ② formal wagered bouts | 1 (`wagered_rung_min`), 4 (`hallWagerFor`) |
| §6 CHAMPION rung ③ training — purchasable temporary CONDS buff, expires, no permanent creep | 1, 7 |
| §6 CHAMPION rung ④ title fight — chronicle record + ruling-faction standing +1 notch | 1, 7 |
| §6 act ledger emits win / noble_loss / cheat_clean / cheat_caught | 2 (`matchResolve.act`), 3 (`brawlAct`), 4 + 5 (emission) |
| §13 tunables flagged, not locked | Global Constraints + Task 8 Step 4 |

Deliberately **not** in B2, each named with its destination: the Gallery's non-intervening
crowd (rides the Ambush event, Slice C); local powers, giver profiles, the social mission
surface, and the 11 interaction event rows (Slice C); HOST rung ③/④ and BROKER rung ③/④
unlocks (Slice C — they bridge into the mission/fence systems that Slice C builds, not into
contests).

**2. Placeholder scan.** Clean. Every code step carries the actual code. The only `⚠` notes
are verification instructions against named live line numbers, each with a stated fallback.
No "TBD", no "similar to Task N", no "handle edge cases".

**3. Type consistency.**
- `ctx` is Slice A's object unchanged — `{locId, locType, tier, phaseIndex, day, fac, cond,
  status, seedBase}`; B2 adds no fields to it.
- `HALL.contestOf` → `{name, resolver, hallLaw}` — consumed identically in Tasks 4, 5, 6.
- `HALL.matchResolve` → `{won, cheated, caught, act, stake, payout, roll, catchRoll}`; only
  `act`, `payout` and `caught`/`won` are read by the glue (Task 4).
- `HALL.brawlAct` → `'win'|'noble_loss'|null`; `HALL.lawPenalty` → `{standing, days}|null`;
  `HALL.barCheck` → `{barred, left}`; `HALL.trainOffer` → `{tag, tier, days, cost}|null`;
  `HALL.titleGate` → boolean. Each is consumed with exactly that shape.
- The four act ids (`'win'`, `'noble_loss'`, `'cheat_clean'`, `'cheat_caught'`) match
  `rules.hall.trust.act_base` as B1 authored them, plus `'lawbreak'` (also already in
  `act_base`) for the hall-law strike — so `HALL.judgeAct` needs no change at all.
- `t.hall` is minted in Task 5 as `{locId, role, fac, wager, day}` and gains `title` in
  Task 7; `concludeThread` reads exactly those six fields.
- `S.social` grows from B1's `{pat, reg}` to `{pat, reg, bar, train}`, seeded at both sites
  in Tasks 6 and 7.
- `hallTrustRecord(hc, role, act)` is called with a full `hc` everywhere except
  `concludeThread`, which passes the deliberate minimal `{ctx:{locId,fac,day}}` — flagged in
  Task 5 Step 7 with the verification to run and what to do if the function has grown.
