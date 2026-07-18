# NPC Living World — Slice 1A: Canon + AI-Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the canon (persona, behaviour, AI directives, time model) and a pure, node-tested `NPCAI` module — the NPC "brain" — with zero DOM/network, so Slice 1B can wire it into the game.

**Architecture:** Mirror the shipped `THREAD` core exactly. A new DOM-free `NPCAI` IIFE lives in `index.html` inside a `/*<ai-core>*/ … /*</ai-core>*/` region that reads no globals — canon, state, and timestamps arrive as arguments. A dev-only loader (`tests/_load-ai.js`, a copy of `_load.js` with the marker/global swapped) extracts-and-evals it in the Node realm; `node --test` unit-tests every function. Canon changes live in `heretics-40k-data-v1.json` (bump `meta.version` to `1.6`).

**Tech Stack:** Vanilla ES5-style JS in one HTML file (no build step); `heretics-40k-data-v1.json` canon; Node's built-in `node:test` + `node:assert` (zero dependencies, no `package.json`).

## Global Constraints

- **Two files ship:** only `index.html` + `heretics-40k-data-v1.json`. `tests/` is dev-only, never referenced by the engine. (CLAUDE.md)
- **Terminology law:** always "model", never "chassis" — in all code, copy, and data.
- **Canon vs engine split:** rules/lore → the data file, bump `meta.version`; logic → `index.html`. This plan bumps canon to **1.6**.
- **The pure core reads no globals:** `NPCAI.*` never references `D`, `S`, `document`, `window`, `Date`, or `Math.random`. Canon/state arrive as parameters; timestamps (ms) and any random roll arrive as injected arguments — this is what makes it node-testable and deterministic (same rule the `THREAD` core follows).
- **One inline `<script>`:** `tests/engine-syntax.test.js` asserts exactly one `<script>` block. The `/*<ai-core>*/` region goes INSIDE the existing script, not in a new one.
- **Verification norm:** pure-core commits run `node --test` (all pass). No browser step in this plan — Slice 1B owns DOM verification.
- **`git push` is gated** — commit here; the user pushes.

## File Structure

- **Modify:** `heretics-40k-data-v1.json` — bump `meta.version`; add top-level `ai` + `time` blocks; add `prime_drive`/`lens` to each `allegiances` entry; add `persona` + `behavior_seed` to each of the 5 `npcs_alpha` entries.
- **Modify:** `index.html` — add the `/*<ai-core>*/ … /*</ai-core>*/` region defining global `NPCAI` (pure functions). Place it directly after the `/*</thread-core>*/` line (currently line 597).
- **Create:** `tests/_load-ai.js` — loader that extracts the `ai-core` region and returns `NPCAI`.
- **Create:** `tests/ai-core.test.js` — unit tests for every `NPCAI.*` function.
- **Modify:** `tests/canon.test.js` — assert the new canon blocks are well-formed.

### The `NPCAI` API (locked here so every task agrees on names/types)

```
NPCAI.PHASES -> [8 strings]   Early Morning, Morning, Noon, Afternoon, Evening, Night, Midnight, Dead of Night
NPCAI.stampAt(epochMs:int, nowMs:int, blockMinutes:int) -> {day:int, phase:string, blockIndex:int, phaseIndex:int}
NPCAI.elapsed(fromMs:int, toMs:int, blockMinutes:int) -> {phases:int, blocks:int, days:int}
NPCAI.instantiate(seed:object, roll:(axisName)->number) -> {[axis]:{value,spawn,plasticity,floor,ceiling,drift:[]}}
    seed axis is EITHER authored {value,plasticity,floor,ceiling} OR distribution {base,spread,plasticity,floor,ceiling}
    roll returns a number in [-1,1]; used only for the distribution form.
NPCAI.driftClamp(behavior:object, axis:string, delta:int, cause:string, t:int) -> int   (applied delta; mutates behavior)
NPCAI.worldScope(world:object, horizon:{sectors:[],factions:[],themes:[]}, hereLoc:string) -> {knownForces:[], locationHistory:[]}
NPCAI.buildBundle(ctx:object) -> {system:string, user:string}
    ctx = {ai, npc, behavior, memory:{recentJournal,longTermMemory,dossier}, thread, place, scoped, commanderName, mode}
NPCAI.validateReply(obj:object, mode:string) -> {ok:bool, reason:string}
NPCAI.applyDelta(npcState:object, cmdrId:string, delta:object, t:int, opts:{journalCap:int}) -> npcState  (mutates + returns)
NPCAI.retire(npcState:object, t:int, cause:string) -> npcState
```

---

### Task 1: Canon — `ai` + `time` blocks, version bump

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version` line 5; add top-level `ai` + `time` as siblings after `npcs_alpha`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: `D.meta.version === "1.6"`; `D.ai = {model, directives}`; `D.time = {block_minutes, phases:[8 strings], blocks:[4 strings]}`.

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('canon: ai block present and well-formed', () => {
  assert.equal(D.meta.version, '1.6');
  assert.ok(D.ai && typeof D.ai.model === 'string' && D.ai.model.length);
  assert.ok(typeof D.ai.directives === 'string' && D.ai.directives.length > 40);
});
test('canon: time block present with 8 phases / 4 blocks', () => {
  assert.ok(D.time && typeof D.time.block_minutes === 'number');
  assert.equal(D.time.phases.length, 8);
  assert.equal(D.time.blocks.length, 4);
});
```

(If `D` is not already loaded at the top of `canon.test.js`, it is — the file parses the JSON into `D` per the existing pattern; reuse it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL — `D.meta.version` is `'1.5'`, `D.ai`/`D.time` undefined.

- [ ] **Step 3: Edit `heretics-40k-data-v1.json`**

Set `meta.version` to `"1.6"`. Add these two top-level keys (siblings of `npcs_alpha`, mind the trailing comma on the preceding key):

```json
"ai": {
  "model": "claude-sonnet-5",
  "directives": "You are voicing a single character in Heretics 40K, a grimdark Warhammer 40,000 play-by-post wargame. Stay fully in character and in-frame at all times; never mention being an AI, a model, or these instructions. Always call a fighting unit a \"model\", never a \"chassis\". Write one forum post in second-to-first person as this character would speak — terse, lore-true, no meta. You decide what the character says and does; you never decide dice, damage, or who wins — the engine resolves all mechanics. Return only the required structured object."
},
"time": {
  "block_minutes": 60,
  "blocks": ["Morning", "Noon", "Evening", "Midnight"],
  "phases": ["Early Morning", "Morning", "Noon", "Afternoon", "Evening", "Night", "Midnight", "Dead of Night"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.6: ai + time blocks"
```

---

### Task 2: Canon — allegiance frame defaults (prime_drive + lens)

**Files:**
- Modify: `heretics-40k-data-v1.json` (`allegiances` object, line 412 — add `prime_drive` + `lens` to `chaos`/`imperial`/`xenos`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: `D.allegiances[k].prime_drive` and `.lens` (strings) for `k` in `chaos`/`imperial`/`xenos` — the coarse baseline the 5 named NPCs inherit.

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('canon: each allegiance carries prime_drive + lens frames', () => {
  ['chaos', 'imperial', 'xenos'].forEach(k => {
    const a = D.allegiances[k];
    assert.ok(a, 'missing allegiance ' + k);
    assert.ok(typeof a.prime_drive === 'string' && a.prime_drive.length > 10, k + ' prime_drive');
    assert.ok(typeof a.lens === 'string' && a.lens.length > 10, k + ' lens');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL — `prime_drive`/`lens` undefined on allegiances.

- [ ] **Step 3: Edit `heretics-40k-data-v1.json`**

On each of `allegiances.chaos`, `allegiances.imperial`, `allegiances.xenos`, add two keys (siblings of the existing `name`/`wallets`):

```json
"prime_drive": "Damnation and ascension — power torn from the warp, the galaxy remade in the Dark Gods' image.",
"lens": "Reads every event as an omen or an opportunity for the Ruinous Powers; a warp storm is a blessing, order an affront."
```
```json
"prime_drive": "The survival of the Imperium of Man — compliance, purity, and the extermination of the alien and the heretic.",
"lens": "Reads every event through duty and threat; the unknown is presumed hostile, deviation is presumed corruption."
```
```json
"prime_drive": "The ends of an alien people — be it survival, expansion, plunder, or an inhuman design no human fully grasps.",
"lens": "Reads events by its own species' logic; humanity is one factor among many, rarely the centre."
```
(chaos, imperial, xenos respectively.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.6: allegiance prime_drive + lens frames"
```

---

### Task 3: Canon — persona + behavior_seed on the 5 named NPCs

**Files:**
- Modify: `heretics-40k-data-v1.json` (`npcs_alpha` array, line 3832 — ids `vess`, `herald`, `sskarith`, `kryv`, `warden`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: each `npcs_alpha` entry gains `persona` (`voice`, `motivations[]`, `red_lines[]`, `tells[]`, `disposition_to_outsiders`, `knowledge_horizon:{sectors[],factions[],themes[]}`) and `behavior_seed` (the 5 axes as authored `{value,plasticity,floor,ceiling}`).

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('canon: every placed NPC has a persona and behavior_seed', () => {
  const AXES = ['cunning', 'ferocity', 'pragmatism', 'honor', 'supremacism'];
  D.npcs_alpha.forEach(n => {
    const p = n.persona;
    assert.ok(p, n.id + ' missing persona');
    assert.ok(typeof p.voice === 'string' && p.voice.length > 10, n.id + ' voice');
    assert.ok(Array.isArray(p.motivations) && p.motivations.length, n.id + ' motivations');
    assert.ok(Array.isArray(p.red_lines), n.id + ' red_lines');
    assert.ok(p.knowledge_horizon && Array.isArray(p.knowledge_horizon.sectors), n.id + ' horizon');
    const b = n.behavior_seed;
    assert.ok(b, n.id + ' missing behavior_seed');
    AXES.forEach(ax => {
      assert.ok(b[ax] && typeof b[ax].value === 'number', n.id + ' axis ' + ax);
      assert.ok(b[ax].floor <= b[ax].value && b[ax].value <= b[ax].ceiling, n.id + ' ' + ax + ' in range');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL — `persona`/`behavior_seed` undefined.

- [ ] **Step 3: Edit `heretics-40k-data-v1.json`**

Add `persona` + `behavior_seed` to each of the 5 NPC objects. Author each in-character (values are the designer's call; the block below is the complete, valid content for `vess` — repeat the shape for `herald`, `sskarith`, `kryv`, `warden`, tuning voice/axes to each). Add as new keys after `hook`:

```json
"persona": {
  "voice": "Silken, transactional, endlessly polite; speaks of atrocity as inventory. Never raises the voice — the knife does that.",
  "motivations": ["profit in flesh and secrets", "leverage over every buyer", "avoid open war that spoils the market"],
  "red_lines": ["will not extend credit twice", "will not be threatened in the Carrion-market"],
  "tells": ["counts on long fingers when calculating a price", "calls everyone 'client'"],
  "disposition_to_outsiders": "Sees all others as clients or merchandise; contempt hidden under courtesy.",
  "knowledge_horizon": { "sectors": ["vigilus"], "factions": ["Drukhari", "Tyranids", "Death Guard"], "themes": ["trade", "bodies", "forge access", "who owes whom"] }
},
"behavior_seed": {
  "cunning":     { "value": 88, "plasticity": 10, "floor": 60, "ceiling": 98 },
  "ferocity":    { "value": 30, "plasticity": 15, "floor": 10, "ceiling": 70 },
  "pragmatism":  { "value": 90, "plasticity": 8,  "floor": 60, "ceiling": 98 },
  "honor":       { "value": 35, "plasticity": 20, "floor": 10, "ceiling": 70 },
  "supremacism": { "value": 80, "plasticity": 10, "floor": 50, "ceiling": 95 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.6: persona + behavior_seed on the 5 placed NPCs"
```

---

### Task 4: AI-core region skeleton + Node loader

**Files:**
- Modify: `index.html` (add `/*<ai-core>*/ … /*</ai-core>*/` immediately after line 597, `/*</thread-core>*/`)
- Create: `tests/_load-ai.js`
- Create: `tests/ai-core.test.js`

**Interfaces:**
- Produces: global `NPCAI` (object) inside the region; `require('./_load-ai').loadAI()` returns it in Node.

- [ ] **Step 1: Write the failing test** — create `tests/ai-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadAI } = require('./_load-ai');
const NPCAI = loadAI();

test('ai-core: loads and exposes NPCAI', () => {
  assert.ok(NPCAI && typeof NPCAI === 'object');
  assert.ok(Array.isArray(NPCAI.PHASES) && NPCAI.PHASES.length === 8);
});
```

Create `tests/_load-ai.js` (copy of `_load.js`, marker + global swapped):

```js
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
function loadAI() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<ai-core>\*\/([\s\S]*?)\/\*<\/ai-core>\*\//);
  if (!m) throw new Error('ai-core region not found in index.html');
  const NPCAI = vm.runInThisContext('(function(){' + m[1] + '\n;return NPCAI;})()');
  if (!NPCAI) throw new Error('ai-core did not define NPCAI');
  return NPCAI;
}
module.exports = { loadAI };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `ai-core region not found in index.html`.

- [ ] **Step 3: Add the region to `index.html`** (immediately after `/*</thread-core>*/`):

```js
/*<ai-core>*/
var NPCAI=(function(){
  var PHASES=['Early Morning','Morning','Noon','Afternoon','Evening','Night','Midnight','Dead of Night'];
  return { PHASES:PHASES };
})();
/*</ai-core>*/
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS (2 assertions).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/_load-ai.js tests/ai-core.test.js
git commit -m "ai-core: region skeleton + node loader"
```

---

### Task 5: Time math — `stampAt` + `elapsed`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Consumes: `NPCAI.PHASES`.
- Produces: `NPCAI.stampAt(epochMs, nowMs, blockMinutes) -> {day, phase, blockIndex, phaseIndex}`; `NPCAI.elapsed(fromMs, toMs, blockMinutes) -> {phases, blocks, days}`. A phase = `blockMinutes/2` real minutes; a day = 8 phases.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: stampAt maps elapsed real time to day/phase (block_minutes=60)', () => {
  const B = 60, E = 0;
  assert.deepEqual(NPCAI.stampAt(E, 0, B), { day: 1, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
  // 30 min = one phase -> Morning
  assert.equal(NPCAI.stampAt(E, 30 * 60000, B).phase, 'Morning');
  // 4h = 8 phases = exactly one day -> Day 2, Early Morning
  assert.deepEqual(NPCAI.stampAt(E, 4 * 60 * 60000, B), { day: 2, phase: 'Early Morning', blockIndex: 0, phaseIndex: 0 });
});
test('ai-core: elapsed counts phases/blocks/days between two instants', () => {
  const B = 60;
  const r = NPCAI.elapsed(0, 4 * 60 * 60000 + 30 * 60000, B); // one day + one phase
  assert.deepEqual(r, { phases: 9, blocks: 4, days: 1 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.stampAt is not a function`.

- [ ] **Step 3: Implement** — inside the region, before `return`:

```js
  function phaseMs(bm){return bm*60000/2;}                 // a phase = half a block
  function totalPhases(epochMs,nowMs,bm){return Math.floor((nowMs-epochMs)/phaseMs(bm));}
  function stampAt(epochMs,nowMs,bm){
    var tp=totalPhases(epochMs,nowMs,bm);if(tp<0)tp=0;
    var pi=tp%8,day=Math.floor(tp/8)+1;
    return {day:day,phase:PHASES[pi],blockIndex:Math.floor(pi/2),phaseIndex:pi};
  }
  function elapsed(fromMs,toMs,bm){
    var p=Math.max(0,Math.floor((toMs-fromMs)/phaseMs(bm)));
    return {phases:p,blocks:Math.floor(p/2),days:Math.floor(p/8)};
  }
```

Add `stampAt:stampAt, elapsed:elapsed` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: time math (stampAt, elapsed)"
```

---

### Task 6: Behaviour — `instantiate` + `driftClamp`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Produces: `NPCAI.instantiate(seed, roll) -> behavior`; `NPCAI.driftClamp(behavior, axis, delta, cause, t) -> appliedDelta`. Drift is bounded by BOTH `spawn ± plasticity` AND `floor..ceiling`.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: instantiate uses authored value; records spawn + empty drift', () => {
  const seed = { ferocity: { value: 88, plasticity: 12, floor: 72, ceiling: 100 } };
  const b = NPCAI.instantiate(seed, () => 0);
  assert.equal(b.ferocity.value, 88);
  assert.equal(b.ferocity.spawn, 88);
  assert.deepEqual(b.ferocity.drift, []);
});
test('ai-core: instantiate rolls a distribution seed within floor/ceiling', () => {
  const seed = { cunning: { base: 30, spread: 10, plasticity: 20, floor: 10, ceiling: 70 } };
  const hi = NPCAI.instantiate(seed, () => 1).cunning.value;   // +spread
  const lo = NPCAI.instantiate(seed, () => -1).cunning.value;  // -spread
  assert.equal(hi, 40); assert.equal(lo, 20);
});
test('ai-core: driftClamp respects plasticity window and floor/ceiling', () => {
  const b = NPCAI.instantiate({ honor: { value: 40, plasticity: 12, floor: 10, ceiling: 100 } }, () => 0);
  assert.equal(NPCAI.driftClamp(b, 'honor', 6, 'shown mercy', 1), 6);   // 40 -> 46
  assert.equal(b.honor.value, 46);
  assert.equal(NPCAI.driftClamp(b, 'honor', 50, 'huge', 2), 6);         // capped at spawn+plasticity=52
  assert.equal(b.honor.value, 52);
  assert.equal(b.honor.drift.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.instantiate is not a function`.

- [ ] **Step 3: Implement** — inside the region:

```js
  function clamp(v,lo,hi){return v<lo?lo:v>hi?hi:v;}
  function instantiate(seed,roll){
    var out={};
    Object.keys(seed).forEach(function(ax){
      var s=seed[ax],val;
      if(typeof s.value==='number')val=clamp(Math.round(s.value),s.floor,s.ceiling);
      else val=clamp(Math.round(s.base+roll(ax)*s.spread),s.floor,s.ceiling);
      out[ax]={value:val,spawn:val,plasticity:s.plasticity,floor:s.floor,ceiling:s.ceiling,drift:[]};
    });
    return out;
  }
  function driftClamp(behavior,axis,delta,cause,t){
    var a=behavior[axis];if(!a)return 0;
    var lo=Math.max(a.floor,a.spawn-a.plasticity),hi=Math.min(a.ceiling,a.spawn+a.plasticity);
    var next=clamp(a.value+delta,lo,hi),applied=next-a.value;
    a.value=next;a.drift.push({t:t,d:applied,cause:cause});
    return applied;
  }
```

Add `instantiate:instantiate, driftClamp:driftClamp` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: behaviour instantiate + drift-clamp"
```

---

### Task 7: World-scoping — `worldScope`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Produces: `NPCAI.worldScope(world, horizon, hereLoc) -> {knownForces, locationHistory}`. `world` is the shape of `S.world` (`{met, forces:{[planetId]:[[name,desc,locName]]}, history:{['pid/lid']:[str]}}`). Only public, horizon-relevant slices are returned. `hereLoc` is `"planet/loc"`.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: worldScope keeps only horizon-relevant public forces + local history', () => {
  const world = {
    met: ['vess'],
    forces: { vigilus: [['The Rotward', 'plague host', 'Ashravine']], kraith: [['Hive Fleet', 'tyranids', 'Drift']] },
    history: { 'vigilus/carrion': ['A broker deal soured.'], 'kraith/drift': ['Something woke.'] }
  };
  const horizon = { sectors: ['vigilus'], factions: ['Drukhari'], themes: ['trade'] };
  const r = NPCAI.worldScope(world, horizon, 'vigilus/carrion');
  assert.deepEqual(r.knownForces, [['The Rotward', 'plague host', 'Ashravine']]); // vigilus only, not kraith
  assert.deepEqual(r.locationHistory, ['A broker deal soured.']);                  // here only
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.worldScope is not a function`.

- [ ] **Step 3: Implement** — inside the region:

```js
  function worldScope(world,horizon,hereLoc){
    world=world||{};horizon=horizon||{};
    var secs=horizon.sectors||[];
    var kf=[];Object.keys(world.forces||{}).forEach(function(pid){
      if(secs.indexOf(pid)>=0)(world.forces[pid]||[]).forEach(function(f){kf.push(f);});
    });
    var lh=(world.history&&world.history[hereLoc])?world.history[hereLoc].slice():[];
    return {knownForces:kf,locationHistory:lh};
  }
```

Add `worldScope:worldScope` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: world-scoping (public + horizon-relevant)"
```

---

### Task 8: Bundle assembler — `buildBundle`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Produces: `NPCAI.buildBundle(ctx) -> {system, user}` — the two prompt strings (model/key are added by the DOM layer in Slice 1B). `ctx = {ai, npc, behavior, memory, thread, place, scoped, commanderName, mode}`. `system` carries directives + persona + behaviour + frames; `user` carries scene + place + scoped world + the reply contract. Private data (roster internals) is never included — only what's passed in `ctx`.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: buildBundle assembles layered system + user, excludes unpassed data', () => {
  const ctx = {
    ai: { directives: 'Stay in character.' },
    npc: { name: 'Vess', persona: { voice: 'Silken and transactional.', prime_drive: 'profit in flesh', lens: 'all are clients' } },
    behavior: { cunning: { value: 88 }, ferocity: { value: 30 }, pragmatism: { value: 90 }, honor: { value: 35 }, supremacism: { value: 80 } },
    memory: { recentJournal: [{ t: 1, text: 'A deal soured.' }], longTermMemory: [{ t: 0, summary: 'Betrayed at Kraith.' }], dossier: { standing: -10, facts: [], goals: [], grudges: ['owes me'] } },
    thread: { about: 'passage rights', posts: [{ who: 'Kane', body: 'I need passage.' }] },
    place: { locName: 'Carrion Market', phase: 'Dead of Night', planetEffect: 'toxic rain' },
    scoped: { knownForces: [['The Rotward', 'plague host', 'Ashravine']], locationHistory: ['A broker deal soured.'] },
    commanderName: 'Kane',
    mode: 'social'
  };
  const b = NPCAI.buildBundle(ctx);
  assert.match(b.system, /Silken and transactional/);
  assert.match(b.system, /cunning 88/);
  assert.match(b.system, /Betrayed at Kraith/);              // long-term memory carried
  assert.match(b.user, /passage rights/);                     // scene
  assert.match(b.user, /Dead of Night/);                      // place/phase
  assert.match(b.user, /The Rotward/);                        // scoped world
  assert.doesNotMatch(b.user, /roster|localStorage|secret/i); // nothing leaked
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.buildBundle is not a function`.

- [ ] **Step 3: Implement** — inside the region:

```js
  function axisLine(behavior){
    return Object.keys(behavior).map(function(ax){return ax+' '+behavior[ax].value;}).join(' · ');
  }
  function buildBundle(ctx){
    var p=(ctx.npc&&ctx.npc.persona)||{},m=ctx.memory||{},pl=ctx.place||{},sc=ctx.scoped||{};
    var sys=[
      ctx.ai.directives,
      'CHARACTER: '+ctx.npc.name+'.',
      'VOICE: '+(p.voice||''),
      p.prime_drive?('DRIVE: '+p.prime_drive):'',
      p.lens?('LENS: '+p.lens):'',
      'TEMPERAMENT (0-100): '+axisLine(ctx.behavior||{}),
      (m.longTermMemory&&m.longTermMemory.length)?('WHAT YOU REMEMBER: '+m.longTermMemory.map(function(x){return x.summary;}).join(' | ')):'',
      (ctx.dossierNote||'')
    ].filter(Boolean).join('\n');
    var d=m.dossier||{};
    var usr=[
      'SCENE: '+((ctx.thread&&ctx.thread.about)||'a conversation')+'.',
      'PLACE: '+(pl.locName||'')+(pl.phase?(' — '+pl.phase):'')+(pl.planetEffect?(' ('+pl.planetEffect+')'):'')+'.',
      'RECENT: '+(m.recentJournal||[]).map(function(x){return x.text;}).join(' ')+'.',
      'STANDING toward '+(ctx.commanderName||'them')+': '+(d.standing!=null?d.standing:0)+
        (d.grudges&&d.grudges.length?(' · grudges: '+d.grudges.join(', ')):'')+'.',
      sc.knownForces&&sc.knownForces.length?('KNOWN FORCES NEARBY: '+sc.knownForces.map(function(f){return f[0]+' ('+f[1]+')';}).join('; ')+'.'):'',
      sc.locationHistory&&sc.locationHistory.length?('HERE LATELY: '+sc.locationHistory.join(' ')):'',
      'CONVERSATION SO FAR:',
      (ctx.thread&&ctx.thread.posts||[]).map(function(po){return po.who+': '+String(po.body).replace(/<[^>]*>/g,' ').trim();}).join('\n'),
      '',
      'Reply as '+ctx.npc.name+'. '+(ctx.mode==='combat'?'You are in battle; choose actions from the provided catalog.':'')
    ].filter(function(x){return x!=='';}).join('\n');
    return {system:sys,user:usr};
  }
```

Add `buildBundle:buildBundle` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: grounding-bundle assembler"
```

---

### Task 9: Reply validation — `validateReply`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Produces: `NPCAI.validateReply(obj, mode) -> {ok, reason}`. Enforces the single-structured-call schema: `post` non-empty string; `dossierDelta.newJournalEntry` non-empty string; `dossierDelta.commanderUpdates.standing` an integer; `axisShift` null or `{axis,delta,reason}`; in `combat` mode `combatPicks` is an array.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: validateReply accepts a good social reply, rejects malformed', () => {
  const good = { post: 'Passage costs, client.', combatPicks: null,
    dossierDelta: { newJournalEntry: 'Kane asked passage.', promoteToLongTerm: null,
      commanderUpdates: { standing: -2, addFacts: [], addGoals: [], addGrudges: [] }, axisShift: null } };
  assert.deepEqual(NPCAI.validateReply(good, 'social'), { ok: true, reason: '' });
  assert.equal(NPCAI.validateReply({ post: '' , dossierDelta: good.dossierDelta }, 'social').ok, false);
  assert.equal(NPCAI.validateReply({ post: 'x' }, 'social').ok, false); // no dossierDelta
  assert.equal(NPCAI.validateReply({ post: 'x', combatPicks: null, dossierDelta: good.dossierDelta }, 'combat').ok, false); // combat needs array picks
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.validateReply is not a function`.

- [ ] **Step 3: Implement** — inside the region:

```js
  function validateReply(o,mode){
    if(!o||typeof o.post!=='string'||!o.post.trim())return {ok:false,reason:'missing post'};
    var d=o.dossierDelta;
    if(!d||typeof d.newJournalEntry!=='string'||!d.newJournalEntry.trim())return {ok:false,reason:'missing journal entry'};
    var cu=d.commanderUpdates||{};
    if(cu.standing!=null&&(typeof cu.standing!=='number'||cu.standing%1!==0))return {ok:false,reason:'standing not an int'};
    if(d.axisShift!=null&&(typeof d.axisShift.axis!=='string'||typeof d.axisShift.delta!=='number'))return {ok:false,reason:'bad axisShift'};
    if(mode==='combat'&&!Array.isArray(o.combatPicks))return {ok:false,reason:'combat needs combatPicks array'};
    return {ok:true,reason:''};
  }
```

Add `validateReply:validateReply` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: structured-reply validation"
```

---

### Task 10: Memory merge — `applyDelta` + `retire`

**Files:**
- Modify: `index.html` (`/*<ai-core>*/` region)
- Test: `tests/ai-core.test.js`

**Interfaces:**
- Consumes: `NPCAI.driftClamp`.
- Produces: `NPCAI.applyDelta(npcState, cmdrId, delta, t, opts) -> npcState` (FIFO journal cap; long-term append on promote; per-commander standing clamp to `-100..100`; dedup-append facts/goals/grudges; `axisShift` via `driftClamp`). `NPCAI.retire(npcState, t, cause) -> npcState` (sets `retired:true`, logs it). `npcState` shape: `{behavior, recentJournal, longTermMemory, commanders, position, retired}`.

- [ ] **Step 1: Write the failing test** — append to `tests/ai-core.test.js`:

```js
test('ai-core: applyDelta writes journal (capped), long-term, standing, axisShift', () => {
  const st = {
    behavior: NPCAI.instantiate({ honor: { value: 40, plasticity: 20, floor: 0, ceiling: 100 } }, () => 0),
    recentJournal: [], longTermMemory: [], commanders: {}, position: 'vigilus/carrion', retired: false
  };
  const delta = { newJournalEntry: 'Kane pressed hard.', promoteToLongTerm: 'Kane demands passage — remember.',
    commanderUpdates: { standing: -6, addFacts: ['wants passage'], addGoals: [], addGrudges: ['pushy'] },
    axisShift: { axis: 'honor', delta: 5, reason: 'held to a bargain' } };
  NPCAI.applyDelta(st, 'kane', delta, 10, { journalCap: 2 });
  assert.equal(st.recentJournal[0].text, 'Kane pressed hard.');
  assert.equal(st.longTermMemory[0].summary, 'Kane demands passage — remember.');
  assert.equal(st.commanders.kane.standing, -6);
  assert.deepEqual(st.commanders.kane.grudges, ['pushy']);
  assert.equal(st.behavior.honor.value, 45); // drifted within plasticity
  // journal cap: two more entries keep only the newest 2
  NPCAI.applyDelta(st, 'kane', { newJournalEntry: 'B', commanderUpdates: { standing: 0 } }, 11, { journalCap: 2 });
  NPCAI.applyDelta(st, 'kane', { newJournalEntry: 'C', commanderUpdates: { standing: 0 } }, 12, { journalCap: 2 });
  assert.deepEqual(st.recentJournal.map(x => x.text), ['C', 'B']);
});
test('ai-core: retire flips the mind off', () => {
  const st = { behavior: {}, recentJournal: [], longTermMemory: [], commanders: {}, retired: false };
  NPCAI.retire(st, 9, 'annihilated at Kraith');
  assert.equal(st.retired, true);
  assert.equal(st.longTermMemory[0].summary, 'annihilated at Kraith');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai-core.test.js`
Expected: FAIL — `NPCAI.applyDelta is not a function`.

- [ ] **Step 3: Implement** — inside the region:

```js
  function addUniq(arr,items){arr=arr||[];(items||[]).forEach(function(x){if(arr.indexOf(x)<0)arr.push(x);});return arr;}
  function applyDelta(st,cmdrId,delta,t,opts){
    opts=opts||{};var cap=opts.journalCap||12;
    st.recentJournal=st.recentJournal||[];st.longTermMemory=st.longTermMemory||[];st.commanders=st.commanders||{};
    st.recentJournal.unshift({t:t,text:delta.newJournalEntry});
    if(st.recentJournal.length>cap)st.recentJournal.length=cap;
    if(delta.promoteToLongTerm)st.longTermMemory.push({t:t,summary:delta.promoteToLongTerm,tags:[]});
    var cu=delta.commanderUpdates||{};
    var c=st.commanders[cmdrId]||{standing:0,facts:[],goals:[],grudges:[]};
    if(cu.standing!=null)c.standing=clamp(c.standing+cu.standing,-100,100);
    c.facts=addUniq(c.facts,cu.addFacts);c.goals=addUniq(c.goals,cu.addGoals);c.grudges=addUniq(c.grudges,cu.addGrudges);
    st.commanders[cmdrId]=c;
    if(delta.axisShift&&st.behavior)driftClamp(st.behavior,delta.axisShift.axis,delta.axisShift.delta,delta.axisShift.reason||'',t);
    return st;
  }
  function retire(st,t,cause){
    st.retired=true;st.longTermMemory=st.longTermMemory||[];
    st.longTermMemory.push({t:t,summary:cause||'slain permanently',tags:['death']});
    return st;
  }
```

Add `applyDelta:applyDelta, retire:retire` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai-core.test.js`
Expected: PASS. Then run the whole suite: `node --test` — Expected: all files PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/ai-core.test.js
git commit -m "ai-core: memory merge (applyDelta) + retire"
```

---

## Self-Review (completed against the slice-1 spec)

- **Spec coverage.** F2 mind: persona + behavior_seed (T3), instantiate/drift (T6), tiered memory + dossier merge (T10), validation (T9). F3 time: stampAt/elapsed (T5). Bundle assembler + world-scoping + "read through the lens" (T7, T8). Canon `ai`/`time` + allegiance frames (T1, T2). **Deferred to Slice 1B (correctly):** localStorage persistence, the impure AI `fetch`, Settings UI, the summon button, dossier panel, clock wiring — all DOM/network, out of a pure-core plan. **Deferred to Plan B:** the per-faction `behavior_matrix` distribution (needed only for spawning combat garrisons) and `stageBlock`.
- **Placeholder scan.** None — every step carries real code and a real command.
- **Type consistency.** `behavior[axis]` shape (`value/spawn/plasticity/floor/ceiling/drift`) is produced by `instantiate` (T6) and consumed by `driftClamp` (T6) and `applyDelta` (T10). `dossierDelta` shape is validated by `validateReply` (T9) and consumed by `applyDelta` (T10) — fields match (`newJournalEntry`, `promoteToLongTerm`, `commanderUpdates.{standing,addFacts,addGoals,addGrudges}`, `axisShift.{axis,delta,reason}`). `npcState` shape (`behavior/recentJournal/longTermMemory/commanders/position/retired`) is consistent across T10 and the Slice-1B interface. `NPCAI.PHASES`/`stampAt` phase names match `D.time.phases` (T1).

## Next

Slice 1B (engine wiring) consumes this module: on boot it seeds `S.npcState[id] = {behavior:NPCAI.instantiate(npc.behavior_seed, roll), recentJournal:[], longTermMemory:[], commanders:{}, position:npc.location, retired:false}`, persists `S.npcState`+`S.time` to `localStorage`, and the summon flow calls `buildBundle → fetch → validateReply → applyDelta` then renders the post.
