# Unified Thread Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four divergent thread builders in `index.html` with one spine driven by a pure, testable thread core, and make threads carry live state that posted action blocks actually mutate.

**Architecture:** The pure rules logic (create/normalize, init state, action catalog, validate, apply, travel cost) lives inside `index.html` in a marked `/*<thread-core>*/…/*</thread-core>*/` region that assigns to a global `THREAD` object. That region touches no DOM and reads no globals — every input arrives as an argument — so a dev-only `tests/` folder extracts-and-evals it with Node's built-in test runner. The DOM layer (`openT` → `threadView`) renders every thread type through the same spine and calls `THREAD.*` for all rules. One scoped canon extension adds the travel passage-cost model to the data file.

**Tech Stack:** Vanilla ES5-style JS in one HTML file (no build step); `heretics-40k-data-v1.json` canon; Node 23 built-in `node:test` + `node:assert` for unit tests (zero dependencies, no `package.json`); Playwright MCP for browser verification.

## Global Constraints

- **Two files ship:** only `index.html` and `heretics-40k-data-v1.json` are served. The `tests/` folder is dev-only and never referenced by the engine. (CLAUDE.md)
- **Terminology law:** always "model", never "chassis" — in all code, copy, and data.
- **Canon vs engine split:** rules/lore changes go in the data file and bump `meta.version`; logic/UX changes go in `index.html`. This plan bumps canon to **1.4** (travel extension) and engine to **v16**.
- **The pure core reads no globals:** `THREAD.*` functions never reference `D`, `S`, `document`, or `window`. Canon and state arrive as parameters. This is what makes them node-testable.
- **Verification norm:** before every engine commit, exercise the affected screens in the browser (Playwright MCP) with `window` error capture; 0 JS errors. Pure-core commits additionally run `node --test`.
- **`git push` is gated** for the assistant — commits are made here; the user pushes.
- **JSON cache gotcha:** the engine fetches a fixed filename; verify canon changes on the live URL or after a hard reload, not a warm local tab.

---

## File Structure

- **Modify:** `index.html`
  - Add the `/*<thread-core>*/…/*</thread-core>*/` region defining global `THREAD` (pure rules).
  - Rewrite the thread DOM layer (`openT`, add `threadView`, `threadSidebar`, `threadComposer`, `threadBlockBuilder`); retire `bBattle`, `bDiplo`, `bTravel`, and fold `bGeneric` into the spine.
  - Rewrite `exitThread` to read `state.joined`.
  - Migrate the seed threads (`ash`, `bar`, travel) in the `S` init block to carry `posts[]` and `state{}`.
- **Modify:** `heretics-40k-data-v1.json`
  - Extend `travel` with per-tier `base` + `words`, a `force_divisor`, the finer `same_sector_space` rung, and an explicit Warp-Gate waiver note. Bump `meta.version` to `1.4`.
- **Create (dev-only):** `tests/_load.js` — extracts the thread-core region from `index.html` and returns the `THREAD` object.
- **Create (dev-only):** `tests/thread-core.test.js` — unit tests for every `THREAD.*` function.
- **Create (dev-only):** `tests/canon.test.js` — asserts the travel extension is well-formed.

### The `THREAD` API (locked here so every task agrees on names/types)

```
THREAD.wordCount(html: string) -> int
    Strip HTML tags, count whitespace-delimited words.

THREAD.forcePC(models: Array<{pc:int}>) -> int
    Sum of pc across models.

THREAD.passageCost(canon, tierKey: string, forcePC: int, viaWarpGate: bool) -> int
    viaWarpGate ? 0 : round(canon.travel[tierKey].base * (forcePC / canon.travel.force_divisor))

THREAD.create(seed: object) -> thread
    Return seed with defaults filled: posts:[], vis:'public', and state via initState.

THREAD.initState(thread, canon) -> state
    Build { pools, combatants, joined, terms, transit, passage } from thread.seedState (if present) or empty defaults per type.

THREAD.catalog(thread, state, party: string, canon) -> Array<action>
    action = { actor, action, group, cost, effectTemplate }
    Combat: from each model's equipped slots. Diplomacy: Offer/Demand/Accept/Walk away.
    Travel: Transit post / Arrival challenge. Mission & generic: [].

THREAD.validate(thread, state, party, block: Array<staged>, canon) -> { ok: bool, reason: string }
    staged = { actor, action, cost, effect }
    Combat/diplomacy: sum(cost) <= pool, plus per-type rules. Travel: no drain (always ok; arrival gated separately).

THREAD.apply(thread, state, block, canon) -> state    (mutates and returns state)
    Reads each staged.effect and mutates combatants/pools/terms/transit.
    effect.kind ∈ 'damage'|'band'|'cond'|'slay'|'terms'|'transit'|null

THREAD.arrivalReady(state) -> bool
    Travel: state.transit.wordsWritten >= state.transit.wordsReq
```

---

## Task 1: Canon travel extension (data v1.4)

**Files:**
- Modify: `heretics-40k-data-v1.json` (the `travel` object and `meta.version`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `canon.travel[tierKey].base:int`, `.words:int` for tiers `same_planet`, `same_sector`, `same_sector_space`, `cross_sector_same_segmentum`, `cross_segmentum`; `canon.travel.force_divisor:int`; `canon.travel.warp_gate_waiver:string`.

- [ ] **Step 1: Write the failing test**

Create `tests/canon.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('canon is v1.4', () => {
  assert.strictEqual(canon.meta.version, '1.4');
});

test('every travel tier has base + words', () => {
  const tiers = ['same_planet', 'same_sector', 'same_sector_space',
                 'cross_sector_same_segmentum', 'cross_segmentum'];
  for (const k of tiers) {
    assert.ok(canon.travel[k], `missing tier ${k}`);
    assert.strictEqual(typeof canon.travel[k].base, 'number', `${k}.base`);
    assert.strictEqual(typeof canon.travel[k].words, 'number', `${k}.words`);
  }
});

test('travel has a force_divisor and warp-gate waiver', () => {
  assert.strictEqual(canon.travel.force_divisor, 250);
  assert.match(canon.travel.warp_gate_waiver, /warp gate/i);
});

test('bases and words climb with distance', () => {
  const t = canon.travel;
  assert.ok(t.same_planet.base < t.same_sector.base);
  assert.ok(t.same_sector.base < t.cross_sector_same_segmentum.base);
  assert.ok(t.cross_sector_same_segmentum.base < t.cross_segmentum.base);
  assert.ok(t.same_planet.words < t.cross_segmentum.words);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL — `meta.version` is `1.3`, no `base`/`words`/`force_divisor` fields.

- [ ] **Step 3: Edit the canon travel object**

In `heretics-40k-data-v1.json`, set `meta.version` to `"1.4"`, and replace the `travel` object with (preserving existing keys, adding `base`, `words`, the new `same_sector_space` rung, `force_divisor`, and `warp_gate_waiver`):

```json
"travel": {
  "same_planet": { "mode": "ground", "posts": 1, "base": 10, "words": 50, "cost": 0 },
  "same_sector": { "mode": "system vessel", "posts": 2, "base": 40, "words": 150, "requires": "system-capable vessel" },
  "same_sector_space": { "mode": "system vessel", "posts": 2, "base": 60, "words": 200, "requires": "system-capable vessel", "note": "planet <-> space within a sector" },
  "cross_sector_same_segmentum": { "mode": "warp", "posts": 3, "base": 120, "words": 400, "requires": "warp vessel or charter" },
  "cross_segmentum": { "mode": "warp", "posts": 5, "base": 300, "words": 800, "requires": "warp vessel or charter", "note": "base/words are placeholder - canon TBD" },
  "force_divisor": 250,
  "warp_gate_waiver": "Departing through a Warp Gate waives passage entirely (passage = 0) and skips the travel ladder - portal to portal, free.",
  "passage_formula": "passage = tier.base * (force total PC / force_divisor); off-planet tiers require a vessel; Warp Gate waives it.",
  "arrival_at_controlled_planet": {
    "rule": "opens a Travel Thread with entry procedures",
    "friendly": "allied colors recognized: land at any location, draw garrison resupply",
    "hostile": "enemy colors: interception by garrison on approach; ruling faction alerted"
  },
  "forces_tag": "every Force carries a location tag, updated on enter/exit",
  "location_thread_history": "locations keep thread pages of all activity; movable locations (ships, stations) carry their history with them"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Validate the JSON parses in the browser path**

Run: `node -e "JSON.parse(require('fs').readFileSync('heretics-40k-data-v1.json','utf8')); console.log('canon parses OK')"`
Expected: `canon parses OK`

- [ ] **Step 6: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.4: travel passage-cost model (base, words, force_divisor, warp-gate waiver)"
```

---

## Task 2: Thread-core region + test loader + `passageCost`

**Files:**
- Modify: `index.html` (add the marked thread-core region near the other canon helpers, ~after line 467)
- Create: `tests/_load.js`
- Create: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `canon.travel` from Task 1.
- Produces: global `THREAD` object; `THREAD.passageCost(canon, tierKey, forcePC, viaWarpGate)`.

- [ ] **Step 1: Write the test loader**

Create `tests/_load.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<thread-core>*/ ... /*</thread-core>*/ region from index.html
// and evaluate it in a sandbox, returning the THREAD global it defines.
function loadThread() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<thread-core>\*\/([\s\S]*?)\/\*<\/thread-core>\*\//);
  if (!m) throw new Error('thread-core region not found in index.html');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + '\n;this.THREAD = THREAD;', sandbox);
  if (!sandbox.THREAD) throw new Error('thread-core did not define THREAD');
  return sandbox.THREAD;
}

module.exports = { loadThread };
```

- [ ] **Step 2: Write the failing test**

Create `tests/thread-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

test('passageCost scales continuously on PC', () => {
  // base(cross_sector)=120, divisor=250. 500 PC -> x2 -> 240.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_sector_same_segmentum', 500, false), 240);
  // base(cross_segmentum)=300. 6000 PC -> x24 -> 7200.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, false), 7200);
});

test('no threshold cliff: one extra PC costs a little more, never a jump', () => {
  const a = THREAD.passageCost(canon, 'cross_segmentum', 3000, false);
  const b = THREAD.passageCost(canon, 'cross_segmentum', 3001, false);
  assert.ok(b >= a && b - a <= 2, `smooth, got ${a} -> ${b}`);
});

test('Warp Gate waives passage entirely', () => {
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, true), 0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `thread-core region not found in index.html`.

- [ ] **Step 4: Add the thread-core region to `index.html`**

Immediately after the world-overlay helpers (after line 467, before `/* ---- demo save ---- */`), insert:

```html
<!-- pure thread rules: no DOM, no globals; every input is an argument (node-tested) -->
/*<thread-core>*/
var THREAD=(function(){
  function passageCost(canon,tierKey,forcePC,viaWarpGate){
    if(viaWarpGate)return 0;
    var t=canon.travel[tierKey];if(!t)return 0;
    return Math.round(t.base*(forcePC/canon.travel.force_divisor));
  }
  return { passageCost:passageCost };
})();
/*</thread-core>*/
```

Note: this lives inside the existing `<script>` block, so the `/*…*/` markers are ordinary JS comments to the browser and delimiters to the test loader. Do not add a second `<script>` tag.

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Verify the engine still boots (no syntax break)**

Start a server and load the page in the browser (Playwright MCP): `python3 -m http.server 8765`, open `http://localhost:8765`. Confirm the boot screen resolves to the game and `window` reports 0 JS errors.

- [ ] **Step 7: Commit**

```bash
git add index.html tests/_load.js tests/thread-core.test.js
git commit -m "engine: thread-core region + test loader + THREAD.passageCost"
```

---

## Task 3: `wordCount` and `forcePC`

**Files:**
- Modify: `index.html` (inside the thread-core region)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `THREAD` from Task 2.
- Produces: `THREAD.wordCount(html)`, `THREAD.forcePC(models)`.

- [ ] **Step 1: Add the failing tests**

Append to `tests/thread-core.test.js`:

```js
test('wordCount strips HTML and counts words', () => {
  assert.strictEqual(THREAD.wordCount('<b>The</b> ravine walls wept ash'), 5);
  assert.strictEqual(THREAD.wordCount('  spaced   out  '), 2);
  assert.strictEqual(THREAD.wordCount('<br>'), 0);
  assert.strictEqual(THREAD.wordCount(''), 0);
});

test('forcePC sums model point costs', () => {
  assert.strictEqual(THREAD.forcePC([{pc:120},{pc:80},{pc:300}]), 500);
  assert.strictEqual(THREAD.forcePC([]), 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `THREAD.wordCount is not a function`.

- [ ] **Step 3: Implement inside the thread-core region**

Add these functions inside the IIFE and to the returned object:

```js
  function wordCount(html){
    var txt=String(html==null?'':html).replace(/<[^>]*>/g,' ').replace(/&[a-z]+;/gi,' ');
    var parts=txt.trim().split(/\s+/).filter(function(w){return w.length});
    return parts.length;
  }
  function forcePC(models){
    return (models||[]).reduce(function(a,m){return a+(m.pc||0)},0);
  }
```

And extend the return: `return { passageCost:passageCost, wordCount:wordCount, forcePC:forcePC };`

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "engine: THREAD.wordCount + THREAD.forcePC"
```

---

## Task 4: `initState` + `create`

**Files:**
- Modify: `index.html` (thread-core region)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `THREAD` from Task 3.
- Produces: `THREAD.initState(thread, canon)`, `THREAD.create(seed)`.
- State shape produced:
  `{ pools:{}, combatants:{}, joined:bool, terms:null|object, transit:null|{tier,wordsReq,wordsWritten}, passage:0 }`

- [ ] **Step 1: Add failing tests**

Append to `tests/thread-core.test.js`:

```js
test('create fills defaults and attaches state', () => {
  const t = THREAD.create({ id:'x', type:'SKIRMISH', n:'Test', parties:['A','B'] }, canon);
  assert.deepStrictEqual(t.posts, []);
  assert.strictEqual(t.vis, 'public');
  assert.ok(t.state, 'state attached');
  assert.strictEqual(t.state.joined, false);
});

test('initState seeds combatants and pools from seedState', () => {
  const t = { type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
    seedState:{ pools:{'The Rotward':26,"Sskarith's Brood":14},
      combatants:{ gharn:{ w:[4,8], band:'MELEE', party:'The Rotward' } }, joined:true } };
  const s = THREAD.initState(t, canon);
  assert.strictEqual(s.pools['The Rotward'], 26);
  assert.deepStrictEqual(s.combatants.gharn.w, [4,8]);
  assert.strictEqual(s.joined, true);
});

test('initState for TRAVEL sets the word meter from the tier', () => {
  const t = { type:'TRAVEL', parties:['A'],
    seedState:{ transit:{ tier:'cross_segmentum' }, passage:7200 } };
  const s = THREAD.initState(t, canon);
  assert.strictEqual(s.transit.wordsReq, 800);   // canon cross_segmentum.words
  assert.strictEqual(s.transit.wordsWritten, 0);
  assert.strictEqual(s.passage, 7200);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `THREAD.create is not a function`.

- [ ] **Step 3: Implement in the thread-core region**

```js
  function initState(thread,canon){
    var seed=thread.seedState||{};
    var s={ pools:seed.pools||{}, combatants:seed.combatants||{},
            joined:!!seed.joined, terms:seed.terms||null,
            transit:null, passage:seed.passage||0 };
    if(thread.type==='TRAVEL'&&seed.transit){
      var tier=seed.transit.tier;
      s.transit={ tier:tier,
        wordsReq:(canon.travel[tier]&&canon.travel[tier].words)||0,
        wordsWritten:seed.transit.wordsWritten||0 };
    }
    return s;
  }
  function create(seed,canon){
    var t={};for(var k in seed)t[k]=seed[k];
    if(!t.posts)t.posts=[];
    if(!t.vis)t.vis='public';
    t.state=initState(t,canon);
    return t;
  }
```

Extend the return object with `initState:initState, create:create`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "engine: THREAD.initState + THREAD.create"
```

---

## Task 5: `catalog` — actions per type

**Files:**
- Modify: `index.html` (thread-core region)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `THREAD` from Task 4.
- Produces: `THREAD.catalog(thread, state, party, canon) -> Array<{actor, action, group, cost, kind}>`.
- Combat action groups mirror the existing engine convention: `group` ∈ `'e'|'y'|'a'|'b'` (enemy/buff/area-self/move). This replaces the old `abmFor`/`apMod` inline logic; the AP modifier is read from the item text exactly as `apMod` did.

- [ ] **Step 1: Add failing tests**

```js
const combatThread = {
  type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
  seedState:{ pools:{'The Rotward':26}, combatants:{
    gharn:{ w:[8,8], band:'SHORT', party:'The Rotward',
      model:{ id:'gharn', n:'Gharn', pc:180, sl:[
        {k:'WEAPON', it:{n:'Bolt Pistol', d:'Rapid fire. 1 AP.', cat:'WEAPON'}},
        {k:'ABILITY', it:{n:'Rage', d:'Melee bonus. 1 AP.', cat:'ABILITY'}} ] } } }, joined:true }
};

test('combat catalog draws actions from a model\'s equipped slots + Move', () => {
  const t = THREAD.create(combatThread, canon);
  const acts = THREAD.catalog(t, t.state, 'The Rotward', canon);
  const names = acts.map(a => a.action);
  assert.ok(names.some(n => /Bolt Pistol/.test(n)), 'weapon action present');
  assert.ok(names.some(n => /Rage/.test(n)), 'ability action present');
  assert.ok(names.some(n => /Move/.test(n)), 'Move always present');
  const move = acts.find(a => /Move/.test(a.action));
  assert.strictEqual(move.cost, 0, 'Move is 0 AP');
});

test('diplomacy catalog offers terms actions', () => {
  const t = THREAD.create({ type:'DIPLOMACY', parties:['You','Vess'], seedState:{terms:null} }, canon);
  const names = THREAD.catalog(t, t.state, 'You', canon).map(a => a.action);
  assert.deepStrictEqual(names, ['Offer','Demand','Accept','Walk away']);
});

test('travel catalog offers Transit post and Arrival challenge', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon);
  const names = THREAD.catalog(t, t.state, 'A', canon).map(a => a.action);
  assert.ok(names.includes('Transit post'));
  assert.ok(names.includes('Arrival challenge'));
});

test('mission and generic have empty catalogs', () => {
  const m = THREAD.create({ type:'MISSION', parties:['A'] }, canon);
  const g = THREAD.create({ type:'GENERIC', parties:['A'] }, canon);
  assert.strictEqual(THREAD.catalog(m, m.state, 'A', canon).length, 0);
  assert.strictEqual(THREAD.catalog(g, g.state, 'A', canon).length, 0);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `THREAD.catalog is not a function`.

- [ ] **Step 3: Implement in the thread-core region**

```js
  function apMod(it){var s=it.d||'';if(/effortless/i.test(s))return 0;
    var m=s.match(/(\d+)\s*AP/);if(m)return parseInt(m[1],10);
    return it.cat==='CAST'?2:it.cat==='ABILITY'?1:it.cat==='ITEM'?0:1;}
  function combatCatalog(state,party){
    var out=[];
    Object.keys(state.combatants).forEach(function(id){
      var c=state.combatants[id];if(c.party!==party||!c.model)return;
      (c.model.sl||[]).forEach(function(s){if(!s.it)return;var it=s.it;
        if(s.k==='WEAPON')out.push({actor:id,action:'Attack - '+it.n,group:'e',cost:apMod(it),kind:'damage'});
        else if(s.k==='ABILITY')out.push({actor:id,action:it.n,group:'y',cost:apMod(it),kind:'cond'});
        else if(s.k==='WARP CAST')out.push({actor:id,action:'Cast: '+it.n,group:'a',cost:apMod(it),kind:'cond'});
        else if(s.k==='ITEM'&&/consumable|stimm|grenade/i.test(it.d||''))
          out.push({actor:id,action:'Use '+it.n,group:'a',cost:apMod(it),kind:'cond'});
      });
      out.push({actor:id,action:'Move',group:'b',cost:0,kind:'band'});
    });
    return out;
  }
  function catalog(thread,state,party,canon){
    if(thread.type==='SKIRMISH'||thread.type==='INVASION')return combatCatalog(state,party);
    if(thread.type==='DIPLOMACY')return [
      {actor:party,action:'Offer',group:'t',cost:0,kind:'terms'},
      {actor:party,action:'Demand',group:'t',cost:0,kind:'terms'},
      {actor:party,action:'Accept',group:'t',cost:0,kind:'terms'},
      {actor:party,action:'Walk away',group:'t',cost:0,kind:null} ];
    if(thread.type==='TRAVEL')return [
      {actor:party,action:'Transit post',group:'m',cost:0,kind:'transit'},
      {actor:party,action:'Arrival challenge',group:'m',cost:0,kind:null} ];
    return [];
  }
```

Extend the return object with `catalog:catalog`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (12 tests total).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "engine: THREAD.catalog - actions per thread type"
```

---

## Task 6: `validate` — pool math and per-type rules

**Files:**
- Modify: `index.html` (thread-core region)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `THREAD` from Task 5.
- Produces: `THREAD.validate(thread, state, party, block, canon) -> {ok, reason}` where `block` is an array of `{actor, action, cost, effect}`.

- [ ] **Step 1: Add failing tests**

```js
test('validate rejects a block that exceeds the AP pool', () => {
  const t = THREAD.create(combatThread, canon);   // pool The Rotward = 26
  const over = [{actor:'gharn',action:'Attack',cost:20,effect:null},
                {actor:'gharn',action:'Cast',cost:10,effect:null}]; // 30 > 26
  const r = THREAD.validate(t, t.state, 'The Rotward', over, canon);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /pool|desperation/i);
});

test('validate accepts a block within pool', () => {
  const t = THREAD.create(combatThread, canon);
  const ok = [{actor:'gharn',action:'Attack',cost:9,effect:null}];
  assert.strictEqual(THREAD.validate(t, t.state, 'The Rotward', ok, canon).ok, true);
});

test('travel never drains a pool - always valid', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon);
  const blk = [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:200}}];
  assert.strictEqual(THREAD.validate(t, t.state, 'A', blk, canon).ok, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `THREAD.validate is not a function`.

- [ ] **Step 3: Implement in the thread-core region**

```js
  function validate(thread,state,party,block,canon){
    if(thread.type==='TRAVEL'||thread.type==='DIPLOMACY')return {ok:true,reason:''};
    if(thread.type==='SKIRMISH'||thread.type==='INVASION'){
      var pool=state.pools[party]||0;
      var spent=block.reduce(function(a,b){return a+(b.cost||0)},0);
      if(spent>pool)return {ok:false,
        reason:'Exceeds AP pool ('+spent+'/'+pool+') - '+
               ((canon.rules.combat&&canon.rules.combat.desperation_action)||'desperation')};
    }
    return {ok:true,reason:''};
  }
```

Extend the return object with `validate:validate`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (15 tests total).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "engine: THREAD.validate - pool math + travel/diplomacy exemptions"
```

---

## Task 7: `apply` — the poster asserts, the state mutates

**Files:**
- Modify: `index.html` (thread-core region)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `THREAD` from Task 6.
- Produces: `THREAD.apply(thread, state, block, canon) -> state` (mutates), and `THREAD.arrivalReady(state) -> bool`.
- Effect kinds handled: `damage` `{amount,to}`, `band` `{to,who}`, `cond` `{add,to}`, `slay` `{to,intact}`, `terms` `{agreed}`, `transit` `{words}`, `null`.
- `slay` sets `state.combatants[id].dead=true` and stamps `revivalWindow` from `canon.rules.revival_window`; the DOM layer (Task 12) reads that flag to fire death/succession.

- [ ] **Step 1: Add failing tests**

```js
function freshCombat(){ return THREAD.create({
  type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
  seedState:{ pools:{'The Rotward':26}, joined:true, combatants:{
    gharn:{ w:[8,8], band:'SHORT', conds:[], party:'The Rotward' },
    thresh:{ w:[10,10], band:'MELEE', conds:[], party:"Sskarith's Brood" } } } }, canon); }

test('apply damage lowers wounds and spends the pool', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state,
    [{actor:'gharn',action:'Attack',cost:9,effect:{kind:'damage',amount:4,to:'thresh'}}], canon);
  assert.deepStrictEqual(t.state.combatants.thresh.w, [6,10]);
  assert.strictEqual(t.state.pools['The Rotward'], 17);   // 26 - 9
});

test('apply band repositions a combatant', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Move',cost:0,effect:{kind:'band',to:'MELEE',who:'gharn'}}], canon);
  assert.strictEqual(t.state.combatants.gharn.band, 'MELEE');
});

test('apply cond adds a condition', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'thresh',action:'Regen',cost:5,effect:{kind:'cond',add:'Regen II',to:'thresh'}}], canon);
  assert.ok(t.state.combatants.thresh.conds.includes('Regen II'));
});

test('apply slay marks dead and stamps the revival window', () => {
  const t = freshCombat();
  t.state.combatants.thresh.w = [1,10];
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,effect:{kind:'slay',to:'thresh',intact:true}}], canon);
  assert.strictEqual(t.state.combatants.thresh.dead, true);
  assert.ok(t.state.combatants.thresh.revivalWindow != null);
});

test('apply transit accrues words and arrivalReady flips at target', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon); // words=50
  THREAD.apply(t, t.state, [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:30}}], canon);
  assert.strictEqual(t.state.transit.wordsWritten, 30);
  assert.strictEqual(THREAD.arrivalReady(t.state), false);
  THREAD.apply(t, t.state, [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:25}}], canon);
  assert.strictEqual(t.state.transit.wordsWritten, 55);
  assert.strictEqual(THREAD.arrivalReady(t.state), true);
});

test('apply terms records agreement', () => {
  const t = THREAD.create({ type:'DIPLOMACY', parties:['You','Vess'] }, canon);
  THREAD.apply(t, t.state, [{actor:'You',action:'Accept',cost:0,effect:{kind:'terms',agreed:true}}], canon);
  assert.strictEqual(t.state.terms.agreed, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL — `THREAD.apply is not a function`.

- [ ] **Step 3: Implement in the thread-core region**

```js
  function apply(thread,state,block,canon){
    var party=null;
    block.forEach(function(b){
      var c=b.effect&&b.effect.to?state.combatants[b.effect.to]:null;
      // spend the pool (combat only): find the actor's party
      if((thread.type==='SKIRMISH'||thread.type==='INVASION')&&b.cost){
        var actor=state.combatants[b.actor];
        if(actor){party=actor.party;state.pools[party]=(state.pools[party]||0)-b.cost;}
      }
      var e=b.effect;if(!e)return;
      if(e.kind==='damage'&&c){c.w=[Math.max(0,c.w[0]-e.amount),c.w[1]];}
      else if(e.kind==='band'){var w=state.combatants[e.who];if(w)w.band=e.to;}
      else if(e.kind==='cond'&&c){c.conds=c.conds||[];c.conds.push(e.add);}
      else if(e.kind==='slay'&&c){c.dead=true;c.intact=!!e.intact;
        c.revivalWindow=(canon.rules&&canon.rules.revival_window)||null;}
      else if(e.kind==='terms'){state.terms=state.terms||{};state.terms.agreed=!!e.agreed;
        if(e.detail)state.terms.detail=e.detail;}
      else if(e.kind==='transit'&&state.transit){
        state.transit.wordsWritten+=(e.words||0);}
    });
    return state;
  }
  function arrivalReady(state){
    return !!(state.transit&&state.transit.wordsWritten>=state.transit.wordsReq);
  }
```

Extend the return object with `apply:apply, arrivalReady:arrivalReady`.

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/thread-core.test.js`
Expected: PASS (21 tests total).

- [ ] **Step 5: Run the whole suite once**

Run: `node --test`
Expected: PASS — all of `canon.test.js` and `thread-core.test.js` green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "engine: THREAD.apply + arrivalReady - state mutation for every effect kind"
```

---

## Task 8: Migrate seed threads to carry `posts[]` + `seedState` (regression gate)

**Files:**
- Modify: `index.html` (the `S` init `threads:[…]` block, ~lines 509–512, and the demo-save assembly)

**Interfaces:**
- Consumes: `THREAD.create` from Task 4 (each seed thread is passed through it during init so `.state` is attached).
- Produces: `S.threads` entries where `ash` and `bar` have `posts:[…]` and `seedState:{…}`; all threads have `.state` after init.

This task changes data only, not the renderer yet. The Ash Ravine and Carrion Bargain must still render through the *old* builders unchanged after this task — this is the migration-drift regression gate from the spec. (The renderer swap happens in Tasks 9–12.)

- [ ] **Step 1: Add `posts` + `seedState` to the `ash` thread**

In the `S` init `threads:` array, extend the `ash` entry (line ~509) with the seeded posts and combat state lifted from the current hardcoded `bBattle` demo:

```js
{id:'ash',type:'SKIRMISH',n:'Skirmish at the Ash Ravine',loc:'Vigilus · The Ash Ravine',turn:'you',vis:'public',initiator:"Brood-Tyrant Sskarith (NPC · Tyranids)",about:"Sskarith's brood boiled up out of the black sand to contest the Ash Ravine. Whoever still holds the ground when the posts run dry claims the field — and the Ravine feeds the sector's Conflict either way.",forces:['The Rotward',"Sskarith's Brood"],
 posts:[
  {who:'Brood-Tyrant Sskarith',tag:'',body:"The Ash Ravine was quiet until the sand began to breathe. Sskarith's vanguard breached the crust at dusk — the brood declaring this black gutter theirs."},
  {who:'Brood-Tyrant Sskarith',tag:'',body:"The ravine walls wept ash as the brood came on — Threshjaw first, chitin grinding like tectonic sin, gaunts spilling around its legs…",
   block:[{actor:'thresh',action:'Crushing Claws → Gharn',cost:9,effect:{kind:'damage',amount:4,to:'gharn'}},
          {actor:'sskarith',action:'Cast: Catalyst → Threshjaw',cost:5,effect:{kind:'cond',add:'Regen II',to:'thresh'}}]}
 ],
 seedState:{ pools:{'The Rotward':26,"Sskarith's Brood":14}, joined:true, combatants:{
   gharn:{ w:[4,8], band:'MELEE', conds:[], party:'The Rotward' },
   thresh:{ w:[7,10], band:'MELEE', conds:['Regen II'], party:"Sskarith's Brood" },
   sskarith:{ w:[8,8], band:'MEDIUM', conds:[], party:"Sskarith's Brood" } } } },
```

- [ ] **Step 2: Add `posts` + `seedState` to the `bar` thread**

Extend the `bar` entry (line ~510) with the seeded diplomacy posts lifted from `bDiplo`:

```js
{id:'bar',type:'DIPLOMACY',n:'The Carrion Bargain',loc:'Vigilus · The Carrion Market',turn:'you',vis:'public',initiator:'Vess the Carrion-Broker (Wild Named · Drukhari)',about:'Vess dangles Drukhari toxin-craft for your forge list — and names her price in intact Tyranid bodies. Terms are still open; Influence is the reward for closing them.',forces:['The Rotward'],
 posts:[
  {who:'Vess the Carrion-Broker',tag:'',body:'"You want my toxin-craft on your forge list, rot-lord? My price: 300, and one intact Tyranid body. <i>Intact</i>, mind — no flame, no acid."'},
  {who:'Vess',tag:'',body:'"250. And if your Commander dies before delivery… I negotiate with your successor at double."'}
 ],
 seedState:{ terms:{ agreed:false, detail:'250 + 2 intact bodies → Drukhari forge access' } } },
```

- [ ] **Step 3: Pass every seed thread through `THREAD.create` during init**

Find where `S` is finalized before first render (the demo-save assembly near the end of the init path, before `rTL()` at line ~1185). Add a normalization pass:

```js
S.threads = S.threads.map(function(t){ return THREAD.create(t, D); });
```

Place it immediately after `S` is assigned and `D` is available (inside `init()`), before any `rTL()` call.

- [ ] **Step 4: Verify identical render (regression gate)**

Serve and open the app (Playwright MCP). Open the Threads screen → the Ash Ravine. Confirm it looks and reads the same as before this task (same posts, same battle report), and the Carrion Bargain likewise. Capture `window` errors: expect 0. The old builders are still in play — this only proves the seed data is well-formed and `THREAD.create` doesn't throw.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: migrate ash + bar seed threads to posts[] + seedState (renderer unchanged)"
```

---

## Task 9: `threadView` spine — header, gate, posts, composer (replaces `bGeneric`)

**Files:**
- Modify: `index.html` (add `threadView`, `threadComposer`; rewrite `openT` to route generic/mission through `threadView`; keep `bBattle`/`bDiplo`/`bTravel` reachable for now)

**Interfaces:**
- Consumes: `THREAD.catalog`, `t.posts`, `t.state`; helpers `E`, `activeModel`, `threadHeader`, `tools`.
- Produces: `threadView(V, t)` renders the full spine for a thread with an empty catalog (mission/generic); `threadComposer(t, onPost)` returns the composer element.

- [ ] **Step 1: Add `threadComposer` and `threadView`**

```js
function threadComposer(t,onPost){
  var cp=E('div','comp');
  cp.innerHTML='<div class="ch">Your post — '+activeModel().n.split(',')[0]+' · <span class="tp '+t.type+'" style="margin:0">'+t.type+'</span></div>';
  cp.appendChild(tools());
  var fic=E('div','fic');fic.contentEditable=true;
  fic.setAttribute('data-ph','Write your post — advance the story, make your move…');
  cp.appendChild(fic);
  var pb=E('button','btn bl','Post to thread');pb.style.cssText='width:100%;margin:9px 0 0';
  pb.onclick=function(){var v=fic.innerHTML.trim();if(!v||v==='<br>'){T('Write something first.');return}
    onPost(v);};
  cp.appendChild(pb);
  return {el:cp, field:fic};
}
function threadView(V,t){
  var wrap=E('div','tw solo');
  var scroll=E('div','threadscroll');
  (t.posts||[]).forEach(function(p,i){
    scroll.insertAdjacentHTML('beforeend',
      '<div class="post"><div class="ph"><span class="who '+(p.tag==='you'?'you':'en')+'">'+p.who+'</span>'+
      '<span class="mono" style="color:var(--dim)">Post '+(i+1)+'</span></div><div class="body">'+p.body+'</div>'+
      (p.block?'<div class="ab"><div class="ah">Action Block</div><ul>'+p.block.map(function(b){
        return '<li><b>'+b.action+'</b>'+(b.cost?' ('+b.cost+' AP)':'')+'</li>'}).join('')+'</ul></div>':'')+'</div>');
  });
  wrap.appendChild(scroll);
  var comp=threadComposer(t,function(v){
    t.posts.push({who:activeModel().n.split(',')[0],body:v,tag:'you'});
    openT(t.id);
    var sc=document.querySelector('#tv .threadscroll');if(sc)sc.scrollTop=sc.scrollHeight;
    T('Posted to '+t.n+'.');
  });
  wrap.appendChild(comp.el);
  V.appendChild(wrap);
  var xb=E('button','btn gh','Exit thread');xb.style.marginTop='10px';
  xb.onclick=function(){exitThread(t)};V.appendChild(xb);
}
```

- [ ] **Step 2: Route generic + mission-accepted threads through `threadView`**

In `openT`, replace the `else bGeneric(V,t);` branch (line ~934) with `else threadView(V,t);`. Leave the `id==='ash'`→`bBattle` and `id==='bar'`→`bDiplo` branches in place for now (they are retired in Tasks 10–11).

- [ ] **Step 3: Verify a generic/mission thread in the browser**

Serve and open the app. Threads → accept "The Sunken Vox-Bastion" (MISSION) → confirm the briefing gate still appears, Accept reveals the composer, and posting appends a post that persists (it's now in `t.posts`). Reopen the thread: the post is still there. `window` errors: 0.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "engine: threadView spine (header/posts/composer) replaces bGeneric"
```

---

## Task 10: Block builder — wire combat through `THREAD.catalog/validate/apply` (retire `bBattle`)

**Files:**
- Modify: `index.html` (add `threadBlockBuilder`; extend `threadView` to render it when the catalog is non-empty; add `threadSidebar`; route `ash` through `threadView`; delete `bBattle`, `buildABM`, `abmFor`, `apMod`, `tgs`, `EN`, `pool`, `blk` globals)

**Interfaces:**
- Consumes: `THREAD.catalog/validate/apply/arrivalReady`, `t.state`.
- Produces: `threadBlockBuilder(t, party, onAttach) -> {el, staged, clear}`; `threadSidebar(t) -> element`. `threadView` gains a `block` region and a battle-report sidebar for combat threads.

- [ ] **Step 1: Add `threadBlockBuilder`**

```js
function threadBlockBuilder(t,party){
  var staged=[];
  var box=E('div','abld','<div style="font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--br);margin-bottom:7px">Action Block</div>');
  var acts=THREAD.catalog(t,t.state,party,D);
  var row=E('div','arow');var sel=E('select');
  acts.forEach(function(a,i){sel.add(new Option(a.action+(a.cost?' — '+a.cost+' AP':''),i))});
  var add=E('button','btn gh sm','Add');row.appendChild(sel);row.appendChild(add);box.appendChild(row);
  var chips=E('div');box.appendChild(chips);var warn=E('div','warn');box.appendChild(warn);
  var pool=(t.state.pools&&t.state.pools[party]!=null)?t.state.pools[party]:null;
  if(pool!=null)box.insertAdjacentHTML('beforeend','<div class="apt"><span style="font-size:11px;color:var(--dim)">AP pool: <span class="mono">'+pool+'</span></span><span class="n" id="bbtot">0 AP</span></div>');
  function redraw(){chips.innerHTML='';var tot=0;
    staged.forEach(function(s,i){tot+=s.cost;
      var c=E('span','chip','<b style="color:var(--brh)">'+s.action+'</b> · '+s.cost+' AP <button>✕</button>');
      c.querySelector('button').onclick=function(){staged.splice(i,1);redraw()};chips.appendChild(c)});
    var el=document.getElementById('bbtot');if(el)el.textContent=tot+' AP';
    var v=THREAD.validate(t,t.state,party,staged,D);warn.textContent=v.ok?'':v.reason;}
  add.onclick=function(){var a=acts[sel.value];
    staged.push({actor:a.actor,action:a.action,cost:a.cost,effect:defaultEffect(a)});redraw();};
  return {el:box, staged:staged, clear:function(){staged.length=0;redraw();}, redraw:redraw};
}
// Pre-fill the asserted effect from the catalog entry (the poster asserts; UI does not free-type numbers).
function defaultEffect(a){
  if(a.kind==='damage')return {kind:'damage',amount:1,to:null};
  if(a.kind==='band')return {kind:'band',to:'SHORT',who:a.actor};
  if(a.kind==='cond')return {kind:'cond',add:a.action,to:a.actor};
  if(a.kind==='transit')return {kind:'transit',words:0};
  if(a.kind==='terms')return {kind:'terms',agreed:/Accept/.test(a.action)};
  return null;
}
```

Note: full target-picking UI (choosing the damage target/amount) is a refinement; this task wires the pipeline end-to-end with a default effect so posting mutates state. Target selectors can be deepened later without changing the `THREAD` API.

- [ ] **Step 2: Add `threadSidebar` (battle report rendered from state)**

```js
function threadSidebar(t){
  var sb=E('div','thsidebar');
  var byParty={};Object.keys(t.state.combatants).forEach(function(id){
    var c=t.state.combatants[id];(byParty[c.party]=byParty[c.party]||[]).push({id:id,c:c})});
  var html='<div class="card foldcard on" id="report"><h3 class="foldh">Battle Report <span class="foldar">▾</span></h3><div class="foldbody">';
  Object.keys(byParty).forEach(function(p){
    html+='<div class="fg"><h4>'+p+' · '+(t.state.pools[p]!=null?t.state.pools[p]+' AP':'')+'</h4>';
    byParty[p].forEach(function(o){var pct=Math.round(100*o.c.w[0]/o.c.w[1]);
      html+='<div class="mr"><div class="n"><span>'+(o.c.model?o.c.model.n:o.id)+(o.c.dead?' ✝':'')+'</span><span class="a">'+o.c.w[0]+'/'+o.c.w[1]+' W</span></div>'+
        '<div class="hp'+(pct<=50?' lo':'')+'"><i style="width:'+pct+'%"></i></div><div class="band">'+o.c.band+(o.c.conds&&o.c.conds.length?' · '+o.c.conds.join(', '):'')+'</div></div>';});
    html+='</div>';});
  html+='</div></div>';sb.insertAdjacentHTML('beforeend',html);
  sb.querySelector('.foldh').onclick=function(){document.getElementById('report').classList.toggle('on')};
  return sb;
}
```

- [ ] **Step 3: Extend `threadView` to render the block builder + sidebar**

In `threadView`, after building `comp` and before appending the exit button, insert:

```js
  var party=partyOf(t);              // the player's party name in this thread
  var cat=THREAD.catalog(t,t.state,party,D);
  var builder=null;
  if(cat.length){ builder=threadBlockBuilder(t,party); comp.el.appendChild(builder.el); }
  // override the composer's post handler to attach the staged block + apply
  var pb=comp.el.querySelector('.btn.bl');
  pb.onclick=function(){var v=comp.field.innerHTML.trim();if(!v||v==='<br>'){T('Write something first.');return}
    var staged=builder?builder.staged:[];
    var val=THREAD.validate(t,t.state,party,staged,D);
    if(!val.ok){T(val.reason);return}
    THREAD.apply(t,t.state,staged,D);
    t.posts.push({who:activeModel().n.split(',')[0],body:v,tag:'you',block:staged.slice()});
    openT(t.id);T('Posted to '+t.n+'.');};
```

And where combat threads need the sidebar, wrap the layout: if `Object.keys(t.state.combatants).length`, build `var w=E('div','tw')`, append the left column (`scroll`+`comp.el`) and `threadSidebar(t)` instead of the `solo` wrapper. Add the helper:

```js
function partyOf(t){
  // the force in this thread that the player owns
  var mine=(t.forces||[]).filter(function(f){return S.forces.some(function(x){return x.n===f})});
  return mine[0]||(t.forces&&t.forces[0])||'You';
}
```

- [ ] **Step 4: Route `ash` through `threadView`; delete `bBattle` and its globals**

In `openT`, remove the `if(id==='ash')bBattle(V);` branch so `ash` falls through to `threadView`. Delete the `bBattle`, `buildABM`, `abmFor`, `tgs` functions and the module-level `pool`, `blk`, `EN`, `ABM` globals (lines ~953–1033). `apMod` now lives in the thread-core region (Task 5); delete the old top-level `apMod` (line ~956) to avoid a duplicate.

- [ ] **Step 5: Verify the Ash Ravine plays — and now mutates**

Serve and open. Threads → Ash Ravine. Confirm: the seeded posts and battle report render (from state). Stage an Attack action, write fiction, Post. Confirm the post appends with its block, and the sidebar wound bar for the target drops (state mutated). Over-stage past 26 AP → the desperation warning shows and Post is blocked. `window` errors: 0.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "engine: unified block builder + state-driven battle report; retire bBattle"
```

---

## Task 11: Diplomacy through the spine (retire `bDiplo`)

**Files:**
- Modify: `index.html` (route `bar` through `threadView`; delete `bDiplo`; port the Vess forge-unlock side effect into a terms-agreed hook)

**Interfaces:**
- Consumes: `THREAD.catalog/apply`, `t.state.terms`.
- Produces: diplomacy threads render posts + a terms block through `threadView`; on `terms.agreed`, the existing forge-unlock (`S.dru=true`) fires.

- [ ] **Step 1: Add a terms-agreed side effect hook**

In the `threadView` post handler, after `THREAD.apply(...)`, add:

```js
    if(t.type==='DIPLOMACY'&&t.state.terms&&t.state.terms.agreed&&!t._closed){
      t._closed=true;
      if(/Vess|Carrion/.test(t.initiator||'')){S.dru=true;S.cur=Math.max(0,S.cur-250);rW();
        T('Terms struck — Drukhari forge access unlocked.');}
    }
```

- [ ] **Step 2: Route `bar` through `threadView`; delete `bDiplo`**

In `openT`, remove the `else if(id==='bar')bDiplo(V);` branch so `bar` falls through to `threadView`. Delete the `bDiplo` function (lines ~1034–1052).

- [ ] **Step 3: Verify the Carrion Bargain**

Serve and open. Threads → The Carrion Bargain. Confirm the seeded Vess posts render, the terms block offers Offer/Demand/Accept/Walk away, and choosing Accept + posting sets terms agreed, unlocks the forge (check a forge/requisition door reflects Drukhari access), and deducts 250. `window` errors: 0.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "engine: diplomacy through the spine; retire bDiplo"
```

---

## Task 12: Travel through the spine — word meter, passage cost, Warp Gate (retire `bTravel`, `S.tr`)

**Files:**
- Modify: `index.html` (create a TRAVEL thread on movement charging passage; render travel via `threadView` with a word-meter; delete `bTravel`; migrate `S.tr` reads)

**Interfaces:**
- Consumes: `THREAD.passageCost/forcePC/catalog/apply/arrivalReady`, `canon.travel`.
- Produces: `startTravel(destPl, destSp, tierKey, viaWarpGate)` creates a TRAVEL thread, charges passage, and opens it; travel threads render a word-count meter and gate the Arrival challenge on `arrivalReady`.

- [ ] **Step 1: Add `startTravel` and a passage-cost gate**

```js
function travelTier(fromPl,fromSp,toPl,toSp){
  // minimal classifier; deepen with real galaxy topology later
  if(fromPl===toPl&&!fromSp&&!toSp)return 'same_planet';
  if(fromPl===toPl)return 'same_sector_space';
  var a=fPl(fromPl),b=fPl(toPl);
  if(a&&b&&a.s===b.s)return 'same_sector';
  if(a&&b&&a.g===b.g)return 'cross_sector_same_segmentum';
  return 'cross_segmentum';
}
function startTravel(toPl,toSp,viaWarpGate){
  var tier=travelTier(S.pos.pl,S.pos.sp,toPl,toSp);
  var force=S.roster.filter(function(m){return m.st==='DEPLOYED'});
  var pc=THREAD.forcePC(force);
  var cost=THREAD.passageCost(D,tier,pc,!!viaWarpGate);
  if(cost>S.cur){T('Passage costs '+cost+' '+curName()+' — not enough.');return false;}
  S.cur-=cost;rW();
  var dest=fLoc(toPl,toSp)?fLoc(toPl,toSp).name:toSp;
  var t=THREAD.create({id:'travel_'+Date.now(),type:'TRAVEL',n:'Transit — '+dest,
    loc:'The void between',turn:'you',vis:'public',initiator:'You',
    forces:S.forces.map(function(f){return f.n}),
    about:'Passage to '+dest+' — '+(viaWarpGate?'via Warp Gate (free)':cost+' '+curName()+' paid')+'.',
    seedState:{ transit:{ tier:tier }, passage:cost }}, D);
  t._dest={pl:toPl,sp:toSp};
  S.threads.push(t);openT(t.id);return true;
}
```

- [ ] **Step 2: Render the travel meter + arrival gate in `threadView`**

Add, for `t.type==='TRAVEL'`, a meter above the composer and gate the Arrival action:

```js
  if(t.type==='TRAVEL'&&t.state.transit){
    var tr=t.state.transit;
    var meter=E('div','card');
    meter.innerHTML='<h3>Transit</h3><div style="font-size:12px;color:var(--dim)">Write your journey — '+
      tr.wordsWritten+' / '+tr.wordsReq+' words to arrival.</div>'+
      '<div class="hp'+(THREAD.arrivalReady(t.state)?'':' lo')+'"><i style="width:'+
      Math.min(100,Math.round(100*tr.wordsWritten/tr.wordsReq))+'%"></i></div>';
    V.insertBefore(meter, V.firstChild.nextSibling);
  }
```

In the post handler, for TRAVEL set the transit effect's word count from the fiction and check arrival:

```js
    if(t.type==='TRAVEL'&&t.state.transit){
      THREAD.apply(t,t.state,[{actor:party,action:'Transit post',cost:0,
        effect:{kind:'transit',words:THREAD.wordCount(v)}}],D);
      if(THREAD.arrivalReady(t.state)&&t._dest){
        S.pos={pl:t._dest.pl,sp:t._dest.sp};
        S.threads=S.threads.filter(function(x){return x.id!==t.id});
        T('Arrived: '+(fLoc(t._dest.pl,t._dest.sp)?fLoc(t._dest.pl,t._dest.sp).name:t._dest.sp)+'.');
        rHQ();rW();go('threads');rTL();return;
      }
    }
```

- [ ] **Step 3: Delete `bTravel` and migrate `S.tr` callers**

Delete `bTravel` (lines ~1053–1058) and the `id==='tr'` synthetic entry in `rTL` (line ~877). Replace the movement trigger that set `S.tr` (the map "travel" action, ~line 1057 caller and wherever `S.tr` is assigned) with a `startTravel(destPl,destSp,viaWarpGate)` call. Search `grep -n "S.tr" index.html` and update each: the map travel button calls `startTravel`; the HUD "in transit" check becomes "is there an open TRAVEL thread".

- [ ] **Step 4: Verify travel end-to-end**

Serve and open. Map → pick a reachable location → travel. Confirm: passage cost is deducted (and blocked if you can't afford it), a TRAVEL thread opens with a word meter, writing posts fills the meter, and hitting the word target arrives you (position updates, thread closes). Try a Warp Gate departure → passage 0. `window` errors: 0.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: travel through the spine - passage cost + word meter + Warp Gate; retire bTravel/S.tr"
```

---

## Task 13: `exitThread` reads `state.joined`; final dispatch cleanup + full sweep

**Files:**
- Modify: `index.html` (`exitThread`, `openT`)

**Interfaces:**
- Consumes: `t.state.joined`, `t.state.combatants`.
- Produces: `openT` dispatches purely on type through `threadView` (only the MISSION accept-gate and the private-gate remain as pre-checks); `exitThread` costs are driven by real state.

- [ ] **Step 1: Rewrite `exitThread` to read state**

Replace the combat guess with the state flag and real wounds/speeds:

```js
function exitThread(t){
  var joined=!!(t.state&&t.state.joined), duel=/duel/i.test(t.n||'');
  if(!joined){S.threads=S.threads.filter(function(x){return x.id!==t.id});
    T('You withdraw from the '+t.type+' at '+t.loc+' — no cost; combat had not begun.');go('threads');rTL();return;}
  var mine=Object.keys(t.state.combatants).map(function(id){return t.state.combatants[id]})
    .filter(function(c){return S.forces.some(function(f){return f.n===c.party})&&!c.dead});
  mine.forEach(function(c){c.w=[Math.max(0,c.w[0]-1),c.w[1]];if(c.w[0]<=0)c.dead=true;});
  var curCost=Math.round(S.army*0.05);S.cur=Math.max(0,S.cur-curCost);
  S.threads=S.threads.filter(function(x){return x.id!==t.id});rW();rRos();
  T('You break contact at '+t.loc+' — '+mine.length+' model(s) wounded, '+curCost+' '+curName()+' spent. '+
    (duel?'A duel cannot be fled — your opponent is declared victor.':'The enemy holds the field.'));
  go('threads');rTL();
}
```

- [ ] **Step 2: Simplify `openT` to a single spine dispatch**

`openT` now: back button → load `t` → private gate → MISSION accept-gate → `threadView(V,t)`. Remove any remaining `id===` special cases. Confirm no references to deleted functions remain: `grep -nE "bBattle|bDiplo|bTravel|buildABM|abmFor|\bABM\b|\bEN\b\s*=" index.html` returns nothing.

- [ ] **Step 3: Run the full unit suite**

Run: `node --test`
Expected: PASS — canon + thread-core suites green (21+ tests).

- [ ] **Step 4: Full browser regression sweep (all 7 screens)**

Serve and open. Exercise, capturing `window` errors after each (expect 0 throughout):
- Threads: Ash Ravine (post + block mutates sidebar), Carrion Bargain (accept terms), a Mission (accept + post), a Travel thread (meter → arrival), exit a thread on both sides of `joined` (before combat = free; Ash Ravine = wounds + currency).
- HQ, Barracks (Roster/Armoury/Forces), Requisition, Map, Comms: open each, confirm no errors and that leader/force/model overlays still open (they read `S.roster`/`S.forces`, untouched).

- [ ] **Step 5: Bump engine version marker and commit**

Update the visible engine version string (rail footer / boot, current "v15") to **v16**. Then:

```bash
git add index.html
git commit -m "engine v16: unified thread dispatch; exitThread reads state.joined; full sweep green"
```

---

## Task 14: Docs — reflect v16 / canon 1.4 in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the state line and feature notes**

Set the header state to `engine **v16**, canon **data v1.4**`. Under "What the ENGINE does", replace the Threads bullet's divergent-builder description with the unified spine (one `threadView`, `THREAD` pure core, state-driven battle report, word-meter travel with passage cost). Move "unified thread flow" out of the "Open design question (parked)" section — it's done. Add a line under canon noting the v1.4 travel passage-cost model. Add a one-line note that `tests/` holds dev-only `node --test` unit tests for the thread core (not shipped).

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md to engine v16 / canon v1.4 (unified thread flow live)"
```

---

## Self-Review Notes (author check against the spec)

- **Spec coverage:** ID-dispatch removed (T13); one spine `threadView` (T9); action block as one abstraction actor→action→target→cost→effect (T5–T7, `catalog`/`validate`/`apply`); threads carry state (T4); poster asserts + state applies incl. `slay`→revival window (T7, T10 hook); five pure units (`threadModel`=create/initState T4, `threadState`=validate/apply T6–7, `actionCatalog` T5, `threadView` T9, `threadSidebar` T10); migration of ash/bar/travel as seed data (T8, T12) with the identical-render gate (T8 step 4, T10 step 5); travel cost model incl. PC÷250 continuous, word gate, vessel + Warp Gate (T1 canon, T12 engine); verification incl. node unit tests + Playwright sweep (throughout, T13 step 4).
- **Type consistency:** `THREAD` API names/signatures fixed in the File Structure block and used identically in every task. `state` shape (`pools/combatants/joined/terms/transit/passage`) consistent T4→T13. `effect.kind` set matches between `apply` (T7) and `defaultEffect` (T10).
- **Known deepenings (explicitly deferred, not gaps):** damage target/amount picker UI (T10 note) — pipeline works with a default effect; `travelTier` topology classifier is minimal (T12) — real galaxy distance later; ranked-speed pursuit still stubbed (spec non-goal). These match the spec's "first-pass/stubbed" posture and don't block the unified loop.
