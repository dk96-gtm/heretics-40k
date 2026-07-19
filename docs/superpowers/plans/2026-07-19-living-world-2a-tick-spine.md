# Living-World Slice 2a — Tick Spine + Digest — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic world-tick spine — a lazy catch-up on boot that advances the galaxy per in-game day (production + taint drift), bounded for long absences, emitting a templated World Digest — with a pure node-tested `WORLD` core. NPC agency and sieges are slice 2b; thread timers are 2c.

**Architecture:** New DOM-free `/*<world-core>*/` region in `index.html` (a `WORLD` object) sitting beside `/*<thread-core>*/` / `/*<loadout-core>*/` / `/*<ai-core>*/`, passed canon + state as arguments, extract-and-eval'd by a `tests/_load-world.js` loader. Boot calls `WORLD.catchUp(S, D, Date.now())` after the existing migration step; a `renderDigest()` shows the result. Canon gains a `tick` block; save-state gains `S.time.lastTick` and a taint overlay.

**Tech Stack:** Vanilla JS (single HTML file), JSON canon, Node built-in test runner (zero deps). No build step. Served via `python3 -m http.server 8765`.

**Parent spec:** `docs/superpowers/specs/2026-07-19-living-world-time-architecture-design.md` (see its **§Coordination — touch-points** before editing shared code).

## Global Constraints

- Terminology law: always **"model"**, never "chassis".
- Canon changes bump `meta.version`. **The number is a HOT collision point** — a sibling session also bumps it. At implementation time, read the current `meta.version` and bump to the next free number (do NOT hardcode; the spec's "v1.11" is indicative). Reconcile if the sibling took it.
- The pure `WORLD` core reads NO globals and uses **no `Date.now()` / `Math.random()`** — `nowMs` is always an argument (determinism + replayability).
- `tests/` is dev-only, never shipped. Only `index.html` + the JSON deploy.
- Keep the tree `node --test`-green at **every commit** (a concurrent `git add -A` sweep of a green tree is harmless; a sweep mid-break is not — see memory: concurrent-sessions-share-main).
- Commit JSON-only / test-only work by **explicit path**. **The assistant commits; the user pushes.**
- Branch: work continues on `migrate-notion-catalogs` (per user, 2026-07-19).

---

### Task 1: Canon `tick` block

**Files:**
- Modify: `heretics-40k-data-v1.json` (new top-level `tick`, `meta.version` bump)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: `canon.tick = { cadence:"day", day_minutes:Number, max_catchup_days:Number, production_per_day:Number, taint_per_day:Number }`.

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('tick: living-world cadence block present', () => {
  const t = canon.tick;
  assert.ok(t, 'canon.tick present');
  assert.strictEqual(t.cadence, 'day');
  assert.strictEqual(t.day_minutes, 240);          // 4 real hours
  assert.ok(t.max_catchup_days >= 1, 'catch-up cap');
  assert.strictEqual(typeof t.production_per_day, 'number');
  assert.strictEqual(typeof t.taint_per_day, 'number');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL (`canon.tick` undefined).

- [ ] **Step 3: Edit canon.** Read the current `meta.version`, bump it to the next free number (coordinate — see Global Constraints). Add a new top-level `tick` key (place it near `time`):

```json
"tick": {
  "cadence": "day",
  "day_minutes": 240,
  "max_catchup_days": 30,
  "production_per_day": 25,
  "taint_per_day": 1,
  "note": "Deterministic world-tick cadence. day_minutes = one in-game day in real minutes (4h). max_catchup_days bounds lazy catch-up; excess is compressed into a digest summary. Rates are per owned holding per day (slice 2a uses flat demo rates until territory migration lands)."
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js` — Expected: PASS. Also run `node --test` (full) to confirm no version-dependent test broke; if a `meta.version` assertion exists, update it to the new number.

- [ ] **Step 5: Commit** (explicit paths)

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon: add living-world tick block (cadence/day_minutes/catchup/rates)"
```

---

### Task 2: Pure `WORLD` core + tests

**Files:**
- Modify: `index.html` (add `/*<world-core>*/ … /*</world-core>*/` after the `/*</loadout-core>*/` or `/*</ai-core>*/` region marker)
- Create: `tests/_load-world.js`, `tests/world-core.test.js`

**Interfaces:**
- Produces:
  - `WORLD.dayMs(canon)` → `Number` (`day_minutes*60000`)
  - `WORLD.ticksElapsed(state, canon, nowMs)` → `Number` (floor of elapsed days, ≥0)
  - `WORLD.stepDay(state, canon, events)` → mutates `state`, pushes typed events. Slice 2a: `produce` + `driftTaint` only.
  - `WORLD.catchUp(state, canon, nowMs)` → `{ events:Array, ticks:Number, compressed:Number }`; advances `state.time.lastTick` by the FULL elapsed time; idempotent.
  - `WORLD.digest(events)` → `{ lines:Array<string> }` (templated, relevance-ordered).
- Consumes: `state.time.lastTick` (Number ms), `state.cur` (currency), `state.world.stats` (taint overlay, Task 3).

- [ ] **Step 1: Write the loader** — `tests/_load-world.js` (mirror `tests/_load.js`):

```js
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
function loadWorld() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<world-core>\*\/([\s\S]*?)\/\*<\/world-core>\*\//);
  if (!m) throw new Error('world-core region not found');
  return vm.runInThisContext('(function(){' + m[1] + '\n;return WORLD;})()');
}
module.exports = { loadWorld };
```

- [ ] **Step 2: Write the failing tests** — `tests/world-core.test.js`:

```js
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { loadWorld } = require('./_load-world');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname,'..','heretics-40k-data-v1.json'),'utf8'));
const W = loadWorld();
const DAY = canon.tick.day_minutes * 60000;

function freshState(lastTick) {
  return { time:{ lastTick }, cur: 100, world:{ stats:{ vigilus:{ taint: 10 } } } };
}

test('ticksElapsed = floor(elapsed / day), never negative', () => {
  const s = freshState(0);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY*3), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY*3 + 5), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, -100), 0);   // clock skew → 0
});

test('catchUp runs ticks, accrues production, drifts taint, advances lastTick fully', () => {
  const s = freshState(0);
  const r = W.catchUp(s, canon, DAY*3);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(s.cur, 100 + 3*canon.tick.production_per_day);
  assert.strictEqual(s.world.stats.vigilus.taint, 10 + 3*canon.tick.taint_per_day);
  assert.strictEqual(s.time.lastTick, DAY*3);
  assert.ok(r.events.length >= 1);
});

test('catchUp is idempotent within the same day', () => {
  const s = freshState(0);
  W.catchUp(s, canon, DAY*2);
  const curAfter = s.cur;
  const r2 = W.catchUp(s, canon, DAY*2 + 10);   // same day, <1 tick more
  assert.strictEqual(r2.ticks, 0);
  assert.strictEqual(s.cur, curAfter);
});

test('long absence is capped and compressed, lastTick still advances fully', () => {
  const s = freshState(0);
  const away = canon.tick.max_catchup_days + 10;
  const r = W.catchUp(s, canon, DAY*away);
  assert.strictEqual(r.ticks, canon.tick.max_catchup_days);
  assert.strictEqual(r.compressed, 10);
  assert.strictEqual(s.time.lastTick, DAY*away);   // no permanent drift
});

test('digest returns relevance-ordered lines from events', () => {
  const d = W.digest([{kind:'taint', sector:'vigilus', delta:3},{kind:'production', amount:75}]);
  assert.ok(Array.isArray(d.lines) && d.lines.length >= 1);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/world-core.test.js`
Expected: FAIL (world-core region not found).

- [ ] **Step 4: Add the region** to `index.html` immediately after the `/*</loadout-core>*/` marker (or after `/*</ai-core>*/` if loadout-core is absent on this branch — place it beside the other pure regions):

```js
/*<world-core>*/
var WORLD=(function(){
  function dayMs(canon){return ((canon.tick&&canon.tick.day_minutes)||240)*60000;}
  function ticksElapsed(state,canon,nowMs){
    var last=(state.time&&state.time.lastTick)||0;
    var e=Math.floor((nowMs-last)/dayMs(canon));
    return e>0?e:0;
  }
  function produce(state,canon,events){
    var rate=(canon.tick&&canon.tick.production_per_day)||0;
    state.cur=(state.cur||0)+rate;
    if(rate)events.push({kind:'production',amount:rate});
  }
  function driftTaint(state,canon,events){
    var rate=(canon.tick&&canon.tick.taint_per_day)||0;
    var stats=(state.world&&state.world.stats)||{};
    Object.keys(stats).forEach(function(sec){
      if(typeof stats[sec].taint==='number'){stats[sec].taint+=rate;
        if(rate)events.push({kind:'taint',sector:sec,delta:rate});}
    });
  }
  function stepDay(state,canon,events){
    produce(state,canon,events);
    driftTaint(state,canon,events);
  }
  function catchUp(state,canon,nowMs){
    var events=[];
    var elapsed=ticksElapsed(state,canon,nowMs);
    var cap=(canon.tick&&canon.tick.max_catchup_days)||30;
    var run=Math.min(elapsed,cap);
    for(var i=0;i<run;i++)stepDay(state,canon,events);
    var compressed=Math.max(0,elapsed-run);
    if(compressed>0)events.push({kind:'compressed',days:compressed});
    // advance lastTick by the FULL elapsed time so the clock never drifts
    if(!state.time)state.time={};
    state.time.lastTick=(state.time.lastTick||0)+elapsed*dayMs(canon);
    return {events:events,ticks:run,compressed:compressed};
  }
  function digest(events){
    var order={production:2,taint:2,compressed:3};   // slice 2b adds holdings(0)/faction(1)
    var lines=[];
    var prod=events.filter(function(e){return e.kind==='production';})
                   .reduce(function(a,e){return a+e.amount;},0);
    if(prod)lines.push('Production banked: '+prod+'.');
    events.filter(function(e){return e.kind==='taint';}).forEach(function(e){
      lines.push('Taint rose '+e.delta+' in '+e.sector+'.');});
    var comp=events.filter(function(e){return e.kind==='compressed';})[0];
    if(comp)lines.push('Over ~'+comp.days+' earlier cycles the frontier settled quietly.');
    return {lines:lines};
  }
  return { dayMs:dayMs, ticksElapsed:ticksElapsed, stepDay:stepDay,
           catchUp:catchUp, digest:digest };
})();
/*</world-core>*/
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/world-core.test.js` — Expected: PASS (all 5). Then `node --test tests/engine-syntax.test.js` to confirm the inline script still compiles.

- [ ] **Step 6: Commit** (explicit paths)

```bash
git add index.html tests/_load-world.js tests/world-core.test.js
git commit -m "world-core: deterministic catch-up tick spine (production+taint) + tests"
```

---

### Task 3: Save-state — `lastTick` + taint overlay

**Files:**
- Modify: `index.html` (`demoSave` and/or `S.time` init)

**Interfaces:**
- Consumes: `D.tick`.
- Produces: `S.time.lastTick` (Number ms, seeded at first boot), `S.world.stats` (per-sector `{taint}` overlay seeded from demo constants).

- [ ] **Step 1: Seed `lastTick`.** Find where `S.time` is initialised (`S.time = S.time || {epoch:..., blockMinutes:...}`). Add `lastTick`:

```js
S.time = S.time || {epoch:Date.now(), blockMinutes:(D.time&&D.time.block_minutes)||60};
if(S.time.lastTick===undefined) S.time.lastTick = S.time.epoch;   // first boot: no catch-up owed
```

- [ ] **Step 2: Seed the taint overlay** in `demoSave`'s `world:{…}` object (or immediately after building `S`). Add a `stats` map keyed by the demo sectors already present in `S.world` (e.g. `vigilus`, `sangua`, `nurth`, `kraithv`):

```js
// inside world:{ … } add:
stats:{ vigilus:{taint:12}, sangua:{taint:4}, nurth:{taint:20}, kraithv:{taint:16} },
```

- [ ] **Step 3: Browser sanity.** Serve, open, confirm `S.time.lastTick` and `S.world.stats` exist in the console with no errors (`python3 -m http.server 8765`, then evaluate `S.time.lastTick` / `S.world.stats`).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "state: seed S.time.lastTick + S.world.stats taint overlay"
```

---

### Task 4: Wire `catchUp` into boot

**Files:**
- Modify: `index.html` (`init()`)

**Interfaces:**
- Consumes: `WORLD.catchUp`, `S`, `D`.
- Produces: `S._digest` (the pending digest `{lines}`) for Task 5 to render.

- [ ] **Step 1: Call catch-up** in `init()` AFTER the existing migration line (`S.roster.forEach(migrateLoadout…)` if present on this branch) and before first render:

```js
var _wc = WORLD.catchUp(S, D, Date.now());
S._digest = (_wc.ticks>0) ? WORLD.digest(_wc.events) : null;
```

- [ ] **Step 2: Browser test.** In the console, back-date `S.time.lastTick -= 3*240*60000`, run `init()` (or reload after persisting), and confirm `S.cur` grew by `3×production_per_day`, taint rose, and `S._digest.lines` is populated. 0 console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "engine: run WORLD.catchUp on boot, stash pending digest"
```

---

### Task 5: World Digest panel + World Log

**Files:**
- Modify: `index.html` (`renderDigest()` new function; a mount; a persisted log appended to `S.world.log`)

**Interfaces:**
- Consumes: `S._digest`, `S.world.log`.
- Produces: a dismissible boot panel when `S._digest` is set; a scrollable World Log (append lines to `S.world.log`, surface in the Comms screen `#s-comms` / `rComms`).

- [ ] **Step 1: Add `renderDigest()`** — a lightweight overlay (reuse the existing overlay/boot panel styling). When `S._digest` has lines, show them titled "Since you last looked…", with a Dismiss button. On dismiss, append the lines to `S.world.log` (create `[]` if absent) with the current `nowStamp()` and clear `S._digest`.

```js
function renderDigest(){
  if(!S._digest || !S._digest.lines.length) return;
  S.world.log = S.world.log || [];
  var body = S._digest.lines.map(function(l){return '<div class="mr">'+l+'</div>';}).join('');
  var ov = E('div','ov on','<div class="movc" style="max-width:520px"><h3>Since you last looked…</h3>'
    + body + '<button class="btn" id="digx" style="margin-top:12px">Acknowledged</button></div>');
  document.body.appendChild(ov);
  document.getElementById('digx').onclick=function(){
    S._digest.lines.forEach(function(l){S.world.log.unshift(nowStamp()+' — '+l);});
    S._digest=null; ov.remove();
  };
}
```

- [ ] **Step 2: Call it** at the end of `init()` (after first screen render): `renderDigest();`

- [ ] **Step 3: Surface the World Log** in `rComms()` — append a section listing the most recent `S.world.log` entries (guard for empty). This gives the digest a persistent home after dismissal.

- [ ] **Step 4: Browser verify.** Back-date `lastTick` 3 days, reload: the Digest panel appears with production + taint lines; Acknowledge dismisses it and the lines appear in Comms → World Log; reload again with no elapsed time → no panel. 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: World Digest boot panel + persistent World Log in Comms"
```

---

### Task 6: Verification + docs

**Files:**
- Modify: `CLAUDE.md` (canon + engine notes), `index.html` (engine version label if this session owns it)

- [ ] **Step 1: Full suite.** `node --test` — all green (canon, world-core, engine-syntax, plus existing).

- [ ] **Step 2: Browser smoke** with `window` error capture: fresh boot (no digest), back-dated boot (digest shows, dismiss → Comms log), long back-date (compressed line appears, no thousands-of-ticks hang). Zero JS errors.

- [ ] **Step 3: Update `CLAUDE.md`** — add a canon bullet (the `tick` block + version) and an engine bullet (deterministic world-tick catch-up + World Digest, slice 2a; 2b agency/sieges + 2c timers pending). Coordinate the version number with any sibling edit to the same line.

- [ ] **Step 4: Commit, then hand off for push.**

```bash
git add index.html CLAUDE.md
git commit -m "living-world 2a: tick spine + Digest — verified, docs updated"
```

Report to the user: tests green, digest verified in-browser, commits ready — they run `git push`.

---

## Self-Review

**Spec coverage (2a scope):** catch-up tick spine (T2) · production + taint (T2) · bounds/compression (T2) · lastTick + overlay (T3) · boot wiring (T4) · World Digest + Log (T5) · canon tick block (T1). NPC agency/sieges (2b) and thread timers (2c) are explicitly out of this plan — their own plans follow.

**Placeholder scan:** rates are concrete demo constants (`production_per_day:25`, `taint_per_day:1`) — set here, tunable later; no TBD. Version number is intentionally not hardcoded (collision-avoidance) with an explicit "read current + bump" instruction.

**Type consistency:** `WORLD.catchUp(state,canon,nowMs)→{events,ticks,compressed}`, `digest(events)→{lines}`, `S.time.lastTick:Number`, `S.world.stats[sector].taint:Number`, `S._digest:{lines}|null` used consistently T2→T5. Pure core takes `nowMs` as an argument everywhere (no `Date.now` inside the region).

**Concurrency:** every task commits by explicit path; only T2/T3/T4/T5 touch the shared `index.html` (additive region + `init()` + `demoSave` + one new function); the version-bump hot-spot is called out in T1 and Global Constraints.
