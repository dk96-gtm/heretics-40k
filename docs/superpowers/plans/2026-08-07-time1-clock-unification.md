# T-TIME-1 — Clock Unification + Per-Planet Day Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the two clocks (NPCAI phase clock anchored on `S.time.epoch`, WORLD tick clock anchored on `S.time.lastTick` ms) onto ONE elapsed-since-epoch spine, and stamp every planet with an approved 8-slot `day_profile` that carves its 240-minute day into per-planet phase lengths.

**Architecture:** Canon first (day_profile stamps, v1.31→v1.32, pin bumps), then the world-core fold (`lastTick` becomes an int day-index derived from `epoch`), then the ai-core profile-aware stamp, then engine glue (HUD/stamp call sites read the CURRENT planet's profile; `S.time.blockMinutes` retired from all call sites). Day LENGTH stays global (`canon.tick.day_minutes` = 240) — all per-planet variation lives inside the day.

**Tech Stack:** Single-file engine (`index.html`) with marked pure regions (`/*<world-core>*/`, `/*<ai-core>*/`), canon JSON, zero-dep `node --test` (extraction loaders `tests/_load-world.js`, `tests/_load-ai.js`), Playwright MCP for E2E.

## Global Constraints

- **Design LOCKED (Daak 2026-07-21 row + 2026-08-07 content approval):** authored profiles for 8 types; 87-planet stamp table approved verbatim 2026-08-07 ("love it go for it") — the values in `<workspace>/day-profiles-approved.json` are FROZEN; transcribe, never re-derive or re-roll.
- **Canon bump:** `meta.version` `"1.31"` → `"1.32"`. Update every `1\.31` pin: exactly 5 files — `tests/canon.test.js`, `tests/canon-doors.test.js`, `tests/canon-missions.test.js`, `tests/canon-resources.test.js`, `tests/canon-spoils.test.js`.
- **Determinism law:** no `Date.now()`/`Math.random()` inside the pure regions (world-core/ai-core are replay-extracted); `nowMs` always arrives as an argument. The engine glue may call `Date.now()` as today.
- **Day-index consistency invariant:** after the fold, `NPCAI` stamp `day` === WORLD day-index + 1 for every `nowMs` (both derive from `floor((now−epoch)/dayMs)`). A test must pin this.
- **Save migration:** old saves carry `lastTick` as an ms timestamp seeded at `epoch` and advanced in whole-`dayMs` multiples. `init()` converts it once to an int day-index; `foundingWorld()` seeds `lastTick: 0`. New/changed `S.time` keys seed in BOTH sites (house rule).
- **Back-compat:** legacy `NPCAI.stampAt(epoch, now, bm)` keeps its exact current behavior (ai-core tests pin it); the profile-aware variant is NEW. Absent/malformed `day_profile` → behave as the even profile.
- **Terminology law:** "model", never "chassis". Pure logic stays in the marked regions. `node --test` green at EVERY pause (baseline 555/555). Browser-verify before engine commits; `window._noPersist=true` in E2E. git add EXPLICIT paths, never `-A`. Daak pushes; you do not.
- **Untouched:** `genHostiles`/duel spawns, streak ticks (conclude + flee), mission board seeds' semantics (`missionSeedBase`/`missionDay` untouched by this plan — they consume `curDay()` whose values stay identical for even-profile saves).

---

### Task 1: Canon — day_profile stamps + v1.32

**Files:**
- Modify: `heretics-40k-data-v1.json` — `meta.version`; 8 entries of `galaxy.planet_types`; all 87 planets.
- Modify: the 5 pin files listed in Global Constraints (version pins only).
- Test: `tests/canon.test.js` (append)

**Interfaces:**
- Consumes: `<workspace>/day-profiles-approved.json` — array of `{id, name, type, src, profile}` for all 87 planets (the controller placed it there; it is the approved content).
- Produces: every planet object gains `"day_profile": [i0..i7]` (ints, Σ=240); the 8 authored `planet_types` entries (`Death World`, `Daemon World`, `Tomb World`, `Forge World`, `Agri World`, `Shrine World`, `Pleasure World`, `Vigil World`) gain the same-named `"day_profile"` field with their type profile (mint-source for future planets):

```
Death World      [20,25,25,20,30,40,45,35]
Daemon World     [15,20,20,15,25,45,55,45]
Tomb World       [20,20,25,20,25,35,40,55]
Forge World      [35,40,40,40,35,20,15,15]
Agri World       [30,40,45,40,35,20,15,15]
Shrine World     [45,35,30,25,30,25,25,25]
Pleasure World   [20,25,25,30,50,40,30,20]
Vigil World      [25,25,25,25,30,35,40,35]
```

- [ ] **Step 1: Write the failing canon tests** (append to `tests/canon.test.js`, reuse its existing canon-loading pattern):

```js
/* ── T-TIME-1: per-planet day profiles ── */
test('T-TIME-1: every planet carries a valid day_profile (8 slots, ≥10 min each, Σ=240)', () => {
  const all = [];
  canon.galaxy.segmentums.forEach(g => g.zones.forEach(z => z.sectors.forEach(s =>
    (s.planets || []).forEach(p => all.push(p)))));
  assert.strictEqual(all.length, 87);
  all.forEach(p => {
    assert.ok(Array.isArray(p.day_profile) && p.day_profile.length === 8, p.id + ' has 8 slots');
    p.day_profile.forEach(m => assert.ok(Number.isInteger(m) && m >= 10, p.id + ' slot ≥10'));
    assert.strictEqual(p.day_profile.reduce((a, b) => a + b, 0), 240, p.id + ' sums to 240');
  });
});
test('T-TIME-1: authored types stamp their type profile onto every planet of that type', () => {
  const AUTH = {
    'Death World': [20,25,25,20,30,40,45,35], 'Daemon World': [15,20,20,15,25,45,55,45],
    'Tomb World': [20,20,25,20,25,35,40,55], 'Forge World': [35,40,40,40,35,20,15,15],
    'Agri World': [30,40,45,40,35,20,15,15], 'Shrine World': [45,35,30,25,30,25,25,25],
    'Pleasure World': [20,25,25,30,50,40,30,20], 'Vigil World': [25,25,25,25,30,35,40,35] };
  Object.keys(AUTH).forEach(t => {
    const pt = canon.galaxy.planet_types.filter(x => x.name === t)[0];
    assert.deepStrictEqual(pt.day_profile, AUTH[t], t + ' type profile');
  });
  canon.galaxy.segmentums.forEach(g => g.zones.forEach(z => z.sectors.forEach(s =>
    (s.planets || []).forEach(p => { if (AUTH[p.type]) assert.deepStrictEqual(p.day_profile, AUTH[p.type], p.id); }))));
});
test('T-TIME-1: approved spot pins — one STD, one VAR (frozen 2026-08-07)', () => {
  const find = id => { let r; canon.galaxy.segmentums.forEach(g => g.zones.forEach(z =>
    z.sectors.forEach(s => (s.planets || []).forEach(p => { if (p.id === id) r = p; })))); return r; };
  assert.deepStrictEqual(find('terra').day_profile, [30,30,30,30,30,30,30,30]);
  const solsAnvil = canon.galaxy.segmentums.flatMap(g => g.zones).flatMap(z => z.sectors)
    .flatMap(s => s.planets || []).filter(p => p.name === "Sol's Anvil")[0];
  assert.deepStrictEqual(solsAnvil.day_profile, [32,38,18,31,24,30,35,32]);
});
```

(Adapt the `test`/`assert`/`canon` symbol names to what `tests/canon.test.js` already uses — read its header first.)

- [ ] **Step 2: Run to verify failures** — `node --test tests/canon.test.js`.

- [ ] **Step 3: Implement the stamp with a script** (write to `<workspace>/stamp-profiles.py`, run once, do NOT commit the script): load the canon JSON, load `day-profiles-approved.json`, set `p['day_profile']` on each planet by id (assert all 87 ids match, fail loudly on any mismatch), set `day_profile` on the 8 authored `planet_types` entries, set `meta.version = "1.32"`, dump with `indent=1, ensure_ascii=False` and a trailing newline (match the file's existing formatting — inspect before dumping; `git diff --stat` must show ONLY the intended insertions, not a whole-file reformat. If the dump reformats the file, patch the JSON textually instead).

- [ ] **Step 4: Bump the 5 pin files** — in each, replace the `1.31` version-pin assertion value with `1.32` (grep `1\.31` to find them; they are version pins only).

- [ ] **Step 5: Full suite** — `node --test` — all green (556+ with the 3 new).

- [ ] **Step 6: Commit**
```bash
git add heretics-40k-data-v1.json tests/canon.test.js tests/canon-doors.test.js tests/canon-missions.test.js tests/canon-resources.test.js tests/canon-spoils.test.js
git commit -m "canon v1.32: T-TIME-1 day_profile stamped on all 87 planets + 8 authored planet types"
```

### Task 2: World-core fold — lastTick becomes an int day-index off epoch

**Files:**
- Modify: `index.html` — `/*<world-core>*/` (`ticksElapsed`, `catchUp`); engine `init()` seed/migration (~line 4537: `S.time=S.time||{...}`); `foundingWorld()` time seed (~line 4621).
- Test: `tests/world-core.test.js` (fixtures + new tests); check `tests/world-resources.test.js`, `tests/world-territory.test.js`, `tests/mission-save.test.js` for `lastTick` fixtures and migrate them identically.

**Interfaces:**
- Consumes: `state.time.epoch` (ms, already persisted), `canon.tick.day_minutes`.
- Produces: `WORLD.dayIndexAt(state, canon, nowMs) -> int` (exported); `state.time.lastTick` is now "last day-index processed" (int ≥ 0); `WORLD.catchUp` semantics otherwise unchanged (cap, compression, events, return shape).

- [ ] **Step 1: Write the failing tests** (append to `tests/world-core.test.js`, reuse its loader + fixture style — read the file first; also UPDATE existing fixtures that set `state.time.lastTick` to an ms value: they become `{epoch: 0, lastTick: <int days processed>}` with `nowMs` expressed as `days * 240*60000`. Do not weaken any assertion — the same production/taint/cap expectations must hold under the new fixtures):

```js
test('T-TIME-1: dayIndexAt derives from epoch; ticks = dayIndex − lastTick', () => {
  const DM = 240 * 60000;
  const state = { time: { epoch: 1000, lastTick: 2 } };
  assert.strictEqual(WORLD.dayIndexAt(state, canon, 1000 + 5 * DM), 5);
  assert.strictEqual(WORLD.dayIndexAt(state, canon, 999), 0);          // pre-epoch clamps
  const st2 = { time: { epoch: 0, lastTick: 2 }, world: {} };
  const r = WORLD.catchUp(st2, canon, 5 * DM);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(st2.time.lastTick, 5);                            // int day-index, not ms
});
test('T-TIME-1: catchUp cap still compresses; lastTick lands on the current day-index', () => {
  const DM = 240 * 60000;
  const cap = (canon.tick && canon.tick.max_catchup_days) || 30;
  const st = { time: { epoch: 0, lastTick: 0 }, world: {} };
  const r = WORLD.catchUp(st, canon, (cap + 10) * DM);
  assert.strictEqual(r.ticks, cap);
  assert.strictEqual(r.compressed, 10);
  assert.strictEqual(st.time.lastTick, cap + 10);
});
test('T-TIME-1: day-index consistency — WORLD dayIndex + 1 === NPCAI stamp day', () => {
  const DM = 240 * 60000;
  [0, 1, 7, 29, 100].forEach(d => {
    const now = 1234 + d * DM + 17;                                    // mid-day offsets too
    assert.strictEqual(
      WORLD.dayIndexAt({ time: { epoch: 1234 } }, canon, now) + 1,
      NPCAI.stampAt(1234, now, 60).day);
  });
});
```

(`NPCAI` loads via `tests/_load-ai.js` — import it alongside the world loader in this file.)

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement.** In world-core:

```js
  function dayIndexAt(state,canon,nowMs){
    var ep=(state.time&&state.time.epoch)||0;
    var e=Math.floor((nowMs-ep)/dayMs(canon));
    return e>0?e:0;
  }
  function ticksElapsed(state,canon,nowMs){
    var last=(state.time&&state.time.lastTick)||0;
    var e=dayIndexAt(state,canon,nowMs)-last;
    return e>0?e:0;
  }
```

and in `catchUp` replace `state.time.lastTick=(state.time.lastTick||0)+elapsed*dayMs(canon);` with `state.time.lastTick=(state.time.lastTick||0)+elapsed;` — export `dayIndexAt` on the WORLD return object.

Engine `init()` (~4537) becomes:

```js
  S.time=S.time||{epoch:Date.now()};
  // T-TIME-1 migration: pre-fold saves carry lastTick as an ms timestamp (seeded at epoch,
  // advanced in whole-day multiples). Convert once to the int day-index the fold uses.
  if(S.time.lastTick===undefined)S.time.lastTick=0;
  else if(S.time.lastTick>1e10)S.time.lastTick=Math.max(0,Math.floor((S.time.lastTick-(S.time.epoch||S.time.lastTick))/(((D.tick&&D.tick.day_minutes)||240)*60000)));
```

(The old line also seeded `blockMinutes` — stop seeding it; old saves keep the field, nothing reads it after Task 4.) `foundingWorld()` (~4621): `time:{epoch:Date.now(),lastTick:0},`.

- [ ] **Step 4: Full suite** — `node --test`. Every world/resources/territory/mission-save fixture must be green under the new int semantics.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/world-core.test.js tests/world-resources.test.js tests/world-territory.test.js tests/mission-save.test.js
git commit -m "engine: T-TIME-1 task 2 - lastTick folds onto the epoch spine as an int day-index (+ save migration)"
```
(Drop unchanged test files from the add list.)

### Task 3: AI-core — profile-aware stamp

**Files:**
- Modify: `index.html` — `/*<ai-core>*/` (new `stampAtProfile`, exported; `stampAt` untouched).
- Test: `tests/ai-core.test.js` (append)

**Interfaces:**
- Consumes: `canon.tick.day_minutes`; a planet's `day_profile` array (or null).
- Produces: `NPCAI.stampAtProfile(epochMs, nowMs, canon, profile) -> {day, phase, blockIndex, phaseIndex}` — day = `floor((now−epoch)/dayMs)+1` (global); phase = cumulative walk of the profile weights across the day (proportional to Σweights, so any weight vector is safe); null/short profile → even 8-way split; negative elapsed clamps to day 1 phase 0.

- [ ] **Step 1: Write the failing tests** (append to `tests/ai-core.test.js`, matching its loader/style):

```js
test('T-TIME-1: stampAtProfile with even/null profile matches legacy stampAt exactly', () => {
  const DM = 240 * 60000;
  for (let k = 0; k < 24; k++) {
    const now = 5000 + k * (DM / 16) + 7;                    // sweeps phases + days
    const a = NPCAI.stampAt(5000, now, 60);
    const b = NPCAI.stampAtProfile(5000, now, canon, null);
    assert.deepStrictEqual({ day: b.day, phaseIndex: b.phaseIndex }, { day: a.day, phaseIndex: a.phaseIndex });
  }
});
test('T-TIME-1: a night-heavy profile stretches the night phases', () => {
  const DM = 240 * 60000, daemon = [15,20,20,15,25,45,55,45];
  const at = min => NPCAI.stampAtProfile(0, min * 60000, canon, daemon);
  assert.strictEqual(at(0).phaseIndex, 0);
  assert.strictEqual(at(14).phaseIndex, 0);                  // Early Morning: 0–15
  assert.strictEqual(at(15).phaseIndex, 1);
  assert.strictEqual(at(94).phaseIndex, 4);                  // Evening: 70–95
  assert.strictEqual(at(140).phaseIndex, 6);                 // Midnight: 140–195
  assert.strictEqual(at(239).phaseIndex, 7);                 // Dead of Night to the wire
  assert.strictEqual(at(240).day, 2);                        // next day rolls
  assert.strictEqual(at(240).phaseIndex, 0);
});
test('T-TIME-1: malformed profiles fall back to even; negative elapsed clamps', () => {
  assert.strictEqual(NPCAI.stampAtProfile(0, 30 * 60000, canon, [1, 2, 3]).phaseIndex, 1); // short → even
  const b = NPCAI.stampAtProfile(9999, 0, canon, null);
  assert.deepStrictEqual({ day: b.day, phaseIndex: b.phaseIndex }, { day: 1, phaseIndex: 0 });
});
```

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement** in ai-core (below `stampAt`), and export on the NPCAI return object:

```js
  /* T-TIME-1: profile-aware stamp — day length is GLOBAL (canon.tick.day_minutes); the
     planet's 8-slot day_profile carves the day into per-planet phase lengths. Weights are
     used proportionally (any Σ is safe); null/short profiles read as the even split, so
     an unstamped planet behaves exactly like the legacy clock. */
  function stampAtProfile(epochMs,nowMs,canon,profile){
    var dm=(((canon||{}).tick&&canon.tick.day_minutes)||240)*60000;
    var el=nowMs-epochMs;if(el<0)el=0;
    var day=Math.floor(el/dm),into=el-day*dm;
    var w=(profile&&profile.length===8)?profile:[1,1,1,1,1,1,1,1];
    var sum=0,i;for(i=0;i<8;i++)sum+=w[i];
    var acc=0,pi=7;
    for(i=0;i<8;i++){acc+=w[i];if(into<dm*acc/sum){pi=i;break;}}
    return {day:day+1,phase:PHASES[pi],blockIndex:Math.floor(pi/2),phaseIndex:pi};
  }
```

- [ ] **Step 4: Full suite** — `node --test` — green.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/ai-core.test.js
git commit -m "engine: T-TIME-1 task 3 - profile-aware stampAtProfile in ai-core"
```

### Task 4: Engine glue — call sites read the current planet's profile

**Files:**
- Modify: `index.html` — `nowStamp()` (~2443), `curDay()` (~2445), the location-HUD stamp site (~2448); new `curProfile()` helper beside them.

**Interfaces:**
- Consumes: `fPl(id)` (existing, ~line 488), `S.pos.pl`, `NPCAI.stampAtProfile` (Task 3).
- Produces: every displayed stamp uses the CURRENT planet's `day_profile`; `curDay()` uses the profile-independent global day; NOTHING reads `S.time.blockMinutes` anymore (grep must return only the historical comment, if any).

- [ ] **Step 1: Implement** (no new node tests — glue is covered by the boot proxy + Task 5 E2E; the pure math is Task 3's):

```js
/* T-TIME-1: the phase you see is the phase where you STAND — the current planet's
   day_profile carves the global day. Off-planet (no pos) reads the even clock. */
function curProfile(){var f=(S.pos&&S.pos.pl)?fPl(S.pos.pl):null;return (f&&f.p&&f.p.day_profile)||null;}
function nowStamp(){if(!S.time)return '';var s=NPCAI.stampAtProfile(S.time.epoch,Date.now(),D,curProfile());return 'Day '+s.day+' · '+s.phase;}
function curDay(){return S.time?NPCAI.stampAtProfile(S.time.epoch,Date.now(),D,null).day:0}
```

and at the ~2448 site replace `NPCAI.stampAt(S.time.epoch,Date.now(),S.time.blockMinutes)` with `NPCAI.stampAtProfile(S.time.epoch,Date.now(),D,curProfile())` (keep the surrounding expression shape).

- [ ] **Step 2: Verify retirement** — `grep -n "blockMinutes" index.html` → no remaining READ sites (seeding was already removed in Task 2).

- [ ] **Step 3: Suite** — `node --test` — green (boot proxy compiles the glue).

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "engine: T-TIME-1 task 4 - stamps read the current planet's day_profile; blockMinutes retired"
```

### Task 5: E2E + lifecycle review + board close-out

**Files:**
- Modify: `BACKLOG.md` (T-TIME-1 row)

- [ ] **Step 1: Browser E2E** (serve on :8765, `window._noPersist=true`, console capture): boot fresh → HUD shows `Day 1 · <phase>`; visit a Daemon World location (e.g. Malefic's Reach) vs a standard world and confirm the stamp renders from each planet's profile (evaluate `NPCAI.stampAtProfile(S.time.epoch,Date.now(),D,curProfile())` at both to cross-check the HUD text); World Digest still fires on a stale `lastTick` (simulate: set `S.time.lastTick=0` with an old epoch via evaluate, reload path or call the boot catch-up, digest renders); full screen sweep; ZERO console errors.
- [ ] **Step 2: Lifecycle review** (final reviewer, most capable model): walk (1) fresh founding → days advance → world tick and displayed day NEVER disagree; (2) an OLD save shape (`lastTick` ms, `blockMinutes` present) through `init()` → converted once, no double-tick, no lost days, digest sane; (3) a mission accepted pre-fold (board seeded off `curDay`) → still concludes; (4) travel/thread stamps (`nowStamp` in posts) on profiled planets. Plus: grep-proof that spawns/duels/streaks are untouched.
- [ ] **Step 3: Fix wave if findings** (tests first), else close: T-TIME-1 row → `ready-to-push` with exact paths + note "unblocks T-NPC-3 N1". Commit `backlog: T-TIME-1 built + reviewed, ready-to-push`.
