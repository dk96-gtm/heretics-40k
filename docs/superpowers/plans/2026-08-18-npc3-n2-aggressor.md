# T-NPC-3 N2 — The Aggressor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NPC factions initiate wars on the world tick — real ultimatum threads against the player, instant statistical battles NPC↔NPC, a per-location Chronicle that remembers every clash, the full player-side tribute palette, and one watchable auto-played drama — per the locked spec `docs/superpowers/specs/2026-08-16-npc3-n2-aggressor-design.md`.

**Architecture:** Canon v1.36 adds `rules.cadence`; a new pure `/*<cadence-core>*/` region (`CAD`) holds roll/aggressor/target/scale math; a pure `CHRON` section (same region) holds chronicle records + templated account rendering. Engine glue follows the N1 lapse pattern: a per-day `npcAggression(day)` runs inside `init()`'s tick-interleaved loop (seeded, chunk-independent), minting near-lane threads and resolving far-lane battles via a generalized `npcCapture`. Tribute-palette UI, drama driver, and Chronicle UI ride existing seams (`tributeOffer`/`evalCounter`, `npcTurn`, location panel History).

**Tech Stack:** Vanilla ES5 in `index.html`, JSON canon, `node --test`, Playwright MCP browser E2E.

## Global Constraints

- Always "model", never "chassis".
- Canon: `heretics-40k-data-v1.json`, bump `meta.version` "1.35" → "1.36". Engine: `index.html` only. ES5 (`var`/`function`) inside index.html.
- Pure regions read NO globals; no `Date.now()`/`Math.random()` inside. Seeds ride `ULT.rng`/`ULT.seedFor` (already exposed).
- New `S.world` keys (`chronicle`, `drama`) seed in BOTH `foundingWorld()` (~index.html:2731) and `init()` backfill (~index.html:5150s).
- Chunk-independence is LAW: 13 daily boots === one 13-day boot for every new per-day effect. N2's per-day work runs inside `init()`'s existing per-day loop, interleaved with `resolveUltLapses`/heal/seat passes, seeded off absolute day indices.
- `git add <explicit paths>` only. Suite baseline **622/622** — every commit ends green with new tests added. Browser E2E per engine task (`python3 -m http.server 8765`, Playwright, `window._noPersist=true` FIRST, 0 console errors, 7-screen sweep). `demoSave()` is dead code — E2E via the real profile flow (see `.superpowers/sdd/2026-08-10-terr2-seats-trust-standing/task-5-report.md` §E2E for the working pattern).
- Commit messages end with:

```
Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
```

**Key existing seams (grep to confirm exact lines before editing):**
- `ULT` core `/*<agency-core>*/` (~2400): `rng, hashStr, seedFor, garrisonPC, resolveLapse, lootOf, pickWindow, stepDown, tributeOffer, evalCounter`.
- `SEAT` core: `condMult, priceOf, distribute, poolOf, carryOff, captiveSplit`; engine `stationedPCAt(lid)`, `sweepSeatsOn(pid)` (~4249), `captureOnVictory` (~4245+), `resolveUltLapses` (~3960+).
- `THREAD.AXES.rollFor(facId, seedStr, canon)` → behavior axes; `THREAD.doctrineOf`; `THREAD.npcTurn`.
- `MISSION.genHostiles(params, count, models, wep, canon, target)` — detachment generator; `npcWeaponFor(facId)`; `facByName(name)`; `FAC(id)`; `fPl(pid)` → `{g,z,s,p}`; `sectorOfPlanet(pid)`; `liveScores(sid)`; `WORLD.sectorStatus`; `pRuler(pl)`; `effCond(l)`; `lById(lid[,withPid])`.
- `startThread(pid,l,type,npcId,opts)` (~3037); `seedCombat` (~3001); thread shape `{id,type,n,loc,pl,lid,turn,vis,initiator,about,forces,posts,state,ultimatum}`.
- `S.world.stats[sid]` sector scores; `S.world.rulers` overlay; `S.world.holdings`; `S.world.locConds`.

---

### Task 1: Canon v1.36 — `rules.cadence` + pins

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version`, new `rules.cadence`)
- Create: `tests/canon-cadence.test.js`
- Modify: version pins `'1.35'` → `'1.36'` in `tests/canon.test.js`, `tests/canon-missions.test.js`, `tests/canon-resources.test.js`, `tests/canon-spoils.test.js`, `tests/canon-doors.test.js` (grep `'1.35'` across tests/ to catch all)

**Interfaces:**
- Produces: `D.rules.cadence` = `{p_divisor:400, p_floor:0.005, p_cap:0.25, ferocity_pivot:50, matrix_gate:-2, war_weight:3, weakness_pivot:200, rift_mult:2, invasion_ratio:2, player_clock_cap:2, drama_cap:1, chronicle_cap:30, tribute_valuation:{own_model_mult:2}}`.

- [ ] **Step 1: Write the failing canon test**

`tests/canon-cadence.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

test('rules.cadence exists with the locked N2 shape', () => {
  const c = D.rules.cadence;
  assert.ok(c, 'rules.cadence missing');
  assert.strictEqual(c.p_divisor, 400);
  assert.strictEqual(c.p_floor, 0.005);
  assert.strictEqual(c.p_cap, 0.25);
  assert.strictEqual(c.ferocity_pivot, 50);
  assert.strictEqual(c.matrix_gate, -2);
  assert.strictEqual(c.war_weight, 3);
  assert.strictEqual(c.weakness_pivot, 200);
  assert.strictEqual(c.rift_mult, 2);
  assert.strictEqual(c.invasion_ratio, 2);
  assert.strictEqual(c.player_clock_cap, 2);
  assert.strictEqual(c.drama_cap, 1);
  assert.strictEqual(c.chronicle_cap, 30);
  assert.strictEqual(c.tribute_valuation.own_model_mult, 2);
});

test('meta.version is 1.36', () => {
  assert.strictEqual(D.meta.version, '1.36');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/canon-cadence.test.js` → FAIL (`rules.cadence missing`).

- [ ] **Step 3: Author the canon** — bump `meta.version` to `"1.36"`; insert beside `rules.seats` (textual edit, never a python json.dump rewrite):

```json
"cadence": {
 "note": "T-NPC-3 N2. Shape LOCKED (Daak 2026-08-16/18); every value is a flagged tunable, not final balance.",
 "p_divisor": 400, "p_floor": 0.005, "p_cap": 0.25,
 "ferocity_pivot": 50,
 "matrix_gate": -2, "war_weight": 3,
 "weakness_pivot": 200, "rift_mult": 2,
 "invasion_ratio": 2,
 "player_clock_cap": 2, "drama_cap": 1,
 "chronicle_cap": 30,
 "tribute_valuation": {"own_model_mult": 2}
},
```

- [ ] **Step 4: Sweep pins, full suite** — grep `'1.35'` in tests/, bump all to `'1.36'`. `node --test` → 622 baseline + 2 new, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-cadence.test.js tests/canon.test.js tests/canon-missions.test.js tests/canon-resources.test.js tests/canon-spoils.test.js tests/canon-doors.test.js
git commit -m "canon: v1.36 — rules.cadence (N2 aggressor tunables) (T-NPC-3 N2 task 1)"
```

---

### Task 2: `cadence-core` — CAD pure region (roll, aggressor, target, scale)

**Files:**
- Modify: `index.html` — new `/*<cadence-core>*/ … /*</cadence-core>*/` region immediately AFTER `/*</seat-core>*/`
- Create: `tests/_load-cadence.js` (mirror `tests/_load-seat.js`, matching `cadence-core`, returning `CAD`)
- Create: `tests/cadence-core.test.js`

**Interfaces:**
- Consumes: an injected `rng(seed)` function (glue passes `ULT.rng`); canon.
- Produces (exact names, later tasks call these):
  - `CAD.pOf(conflict, canon) → number` — clamp(conflict/p_divisor, p_floor, p_cap)
  - `CAD.rollDay(sectorId, day, seedBase, conflict, rngFn, canon) → bool` — seeded `seedBase ⊕ day ⊕ 'cad:'+sectorId`
  - `CAD.pickAggressor(present, day, seedBase, sectorId, rngFn, canon) → facId|null` — `present` = `[{facId, ferocity}]`, weight `ferocity/ferocity_pivot` clamped [0.2, 2.0]
  - `CAD.legalTargets(aggFacId, candidates, canon) → [{...c, w}]` — `candidates` = `[{key, facId, isPlayer, garrisonPC, crossRift}]`; matrix gate ≤ matrix_gate via `canon.rules.standing.matrix` (Tyranids row is all −3 so no special case); weight = (standing===−3 ? war_weight : 1) × `1/max(1, garrisonPC/weakness_pivot)` × (crossRift ? rift_mult : 1)
  - `CAD.drawTarget(list, rngFn, seed) → item|null` — weighted draw, seeded
  - `CAD.applyPlayerCap(list, drawn, activePlayerClocks, canon) → item|null` — if drawn.isPlayer && activePlayerClocks ≥ player_clock_cap → heaviest-weight non-player item, else null
  - `CAD.scaleFor(musterPC, garrisonPC, isPlanet, canon) → 'INVASION'|'SKIRMISH'` — INVASION iff musterPC ≥ invasion_ratio×garrisonPC && isPlanet

- [ ] **Step 1: Loader** — copy `tests/_load-seat.js`, swap region name to `cadence-core` and export `loadCadence()` returning `CAD`.

- [ ] **Step 2: Failing tests** — `tests/cadence-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadCadence } = require('./_load-cadence');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const CAD = loadCadence();
const ULT = loadAgency();

test('pOf clamps: floor, linear, cap', () => {
  assert.strictEqual(CAD.pOf(0, D), 0.005);
  assert.strictEqual(CAD.pOf(40, D), 0.1);
  assert.strictEqual(CAD.pOf(999, D), 0.25);
});

test('rollDay is deterministic and day-independent per sector', () => {
  const a = CAD.rollDay('sol', 100, 7, 40, ULT.rng, D);
  const b = CAD.rollDay('sol', 100, 7, 40, ULT.rng, D);
  assert.strictEqual(a, b);
  // over many days, hit rate tracks p (~10% at conflict 40)
  let hits = 0;
  for (let d = 0; d < 2000; d++) if (CAD.rollDay('sol', d, 7, 40, ULT.rng, D)) hits++;
  assert.ok(hits > 100 && hits < 320, 'hit rate ' + hits + '/2000 not ~10%');
});

test('pickAggressor favors ferocity, deterministic', () => {
  const present = [{ facId: 'world_eaters', ferocity: 90 }, { facId: 'tau', ferocity: 15 }];
  let we = 0;
  for (let d = 0; d < 500; d++)
    if (CAD.pickAggressor(present, d, 7, 'sol', ULT.rng, D) === 'world_eaters') we++;
  assert.ok(we > 350, 'ferocity weighting too weak: ' + we + '/500');
  assert.strictEqual(CAD.pickAggressor(present, 42, 7, 'sol', ULT.rng, D),
                     CAD.pickAggressor(present, 42, 7, 'sol', ULT.rng, D));
  assert.strictEqual(CAD.pickAggressor([], 1, 7, 'sol', ULT.rng, D), null);
});

test('legalTargets: matrix gate — imperial pairs never legal, WAR outweighs HOSTILE', () => {
  const cands = [
    { key: 'a', facId: 'militarum', isPlayer: false, garrisonPC: 200, crossRift: false },
    { key: 'b', facId: 'black_legion', isPlayer: false, garrisonPC: 200, crossRift: false },
    { key: 'c', facId: 'orks', isPlayer: false, garrisonPC: 200, crossRift: false }
  ];
  const fromAstartes = CAD.legalTargets('astartes', cands, D);
  assert.ok(!fromAstartes.some(t => t.key === 'a'), 'astartes may not target militarum (ALLIED)');
  const bl = fromAstartes.filter(t => t.key === 'b')[0]; // astartes↔black_legion = WAR (−3)
  const ok = fromAstartes.filter(t => t.key === 'c')[0]; // astartes↔orks = HOSTILE (−2)
  assert.ok(bl.w === ok.w * D.rules.cadence.war_weight, 'WAR weight must be ×war_weight');
});

test('legalTargets: weakness — more garrison, less weight (monotone)', () => {
  const mk = (pc) => [{ key: 'x', facId: 'orks', isPlayer: false, garrisonPC: pc, crossRift: false }];
  const thin = CAD.legalTargets('astartes', mk(100), D)[0].w;
  const thick = CAD.legalTargets('astartes', mk(800), D)[0].w;
  assert.ok(thin > thick, 'stationing must deter');
});

test('applyPlayerCap retargets deterministically, else drops', () => {
  const list = [
    { key: 'p', isPlayer: true, w: 9 },
    { key: 'n1', isPlayer: false, w: 5 },
    { key: 'n2', isPlayer: false, w: 7 }
  ];
  assert.strictEqual(CAD.applyPlayerCap(list, list[0], 2, D).key, 'n2');
  assert.strictEqual(CAD.applyPlayerCap(list, list[0], 1, D).key, 'p');
  assert.strictEqual(CAD.applyPlayerCap([list[0]], list[0], 2, D), null);
});

test('scaleFor: invasion needs 2× muster AND a planet target', () => {
  assert.strictEqual(CAD.scaleFor(900, 400, true, D), 'INVASION');
  assert.strictEqual(CAD.scaleFor(700, 400, true, D), 'SKIRMISH');
  assert.strictEqual(CAD.scaleFor(900, 400, false, D), 'SKIRMISH');
});
```

- [ ] **Step 3: Run → FAIL** (region not found). 

- [ ] **Step 4: Implement** — insert after `/*</seat-core>*/`:

```js
/*<cadence-core>*/
/* T-NPC-3 N2 — aggression cadence. Pure + DOM-free; rng arrives as an argument
   (glue passes ULT.rng); seeds ride absolute day indices — chunk-independent. */
var CAD=(function(){
  function C(canon){return (canon.rules&&canon.rules.cadence)||{};}
  function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){
    h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function seed(base,day,tag){return ((base>>>0)^(day*2654435761)^hashStr(tag))>>>0;}
  function pOf(conflict,canon){var c=C(canon);
    return Math.min(c.p_cap||0.25,Math.max(c.p_floor||0.005,(conflict||0)/(c.p_divisor||400)));}
  function rollDay(sectorId,day,seedBase,conflict,rngFn,canon){
    return rngFn(seed(seedBase,day,'cad:'+sectorId))()<pOf(conflict,canon);}
  function pickAggressor(present,day,seedBase,sectorId,rngFn,canon){
    if(!present||!present.length)return null;
    var piv=C(canon).ferocity_pivot||50,tot=0,ws=present.map(function(p){
      var w=Math.min(2,Math.max(0.2,(p.ferocity!=null?p.ferocity:50)/piv));tot+=w;return w;});
    var r=rngFn(seed(seedBase,day,'agg:'+sectorId))()*tot;
    for(var i=0;i<present.length;i++){r-=ws[i];if(r<=0)return present[i].facId;}
    return present[present.length-1].facId;}
  function legalTargets(aggFacId,candidates,canon){
    var m=(canon.rules&&canon.rules.standing&&canon.rules.standing.matrix)||{};
    var row=m[aggFacId]||{},c=C(canon),out=[];
    (candidates||[]).forEach(function(t){
      if(t.facId===aggFacId)return;
      var st=row[t.facId];if(st==null||st>(c.matrix_gate!=null?c.matrix_gate:-2))return;
      var w=(st<=-3?(c.war_weight||3):1);
      w*=1/Math.max(1,(t.garrisonPC||0)/(c.weakness_pivot||200));
      if(t.crossRift)w*=(c.rift_mult||2);
      var o={};for(var k in t)o[k]=t[k];o.w=w;out.push(o);});
    return out;}
  function drawTarget(list,rngFn,sd){
    if(!list||!list.length)return null;
    var tot=0;list.forEach(function(t){tot+=t.w;});
    var r=rngFn(sd)()*tot;
    for(var i=0;i<list.length;i++){r-=list[i].w;if(r<=0)return list[i];}
    return list[list.length-1];}
  function applyPlayerCap(list,drawn,activePlayerClocks,canon){
    if(!drawn)return null;
    if(!drawn.isPlayer||activePlayerClocks<(C(canon).player_clock_cap||2))return drawn;
    var best=null;list.forEach(function(t){if(!t.isPlayer&&(!best||t.w>best.w))best=t;});
    return best;}
  function scaleFor(musterPC,garrisonPC,isPlanet,canon){
    return (isPlanet&&musterPC>=(C(canon).invasion_ratio||2)*garrisonPC)?'INVASION':'SKIRMISH';}
  return {pOf:pOf,rollDay:rollDay,pickAggressor:pickAggressor,legalTargets:legalTargets,
          drawTarget:drawTarget,applyPlayerCap:applyPlayerCap,scaleFor:scaleFor,
          seed:seed,hashStr:hashStr};
})();
/*</cadence-core>*/
```

- [ ] **Step 5: Full suite** — `node --test tests/cadence-core.test.js tests/engine-syntax.test.js`, then full `node --test` → green.

- [ ] **Step 6: Commit**

```bash
git add index.html tests/_load-cadence.js tests/cadence-core.test.js
git commit -m "engine: T-NPC-3 N2 task 2 — pure cadence-core (seeded roll, ferocity aggressor pick, matrix-gated weighted targeting, player cap, scale)"
```

---

### Task 3: Chronicle core — records + templated war accounts

**Files:**
- Modify: `index.html` — extend the `/*<cadence-core>*/` region with a `CHRON` object (exported alongside CAD: change the region to return both — `var CAD=...; var CHRON=...;` — and update `tests/_load-cadence.js` to also export `loadChron()` extracting CHRON)
- Modify: `tests/_load-cadence.js`, create tests in `tests/chronicle-core.test.js`

**Interfaces:**
- Produces:
  - `CHRON.record(state, lid, rec, canon) → rec` — pushes `{day,kind,att,def,outcome,arith,seed}` onto `state.world.chronicle[lid]` (creates array), evicts oldest past `chronicle_cap`, returns rec
  - `CHRON.titleOf(rec, locName) → string` — e.g. `"The Sack of <loc>"` by outcome (`repelled`→"The Defense of", `repelled_losses`→"The Bloody Defense of", `sacked`→"The Sack of", `captured`→"The Fall of", `tribute`→"The Ransom of", `drama`→"The Battle of")
  - `CHRON.account(rec, locName, rngFn) → [{who,body}]` — 4-6 deterministic posts: opening (attacker arrives, styled by kind), 2-3 middle beats seeded from `rec.seed` (template pools; same rec → same story), closing (outcome line), final `{who:'THE RECORD', body: rec.arith}`

- [ ] **Step 1: Failing tests** — `tests/chronicle-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadChron } = require('./_load-cadence');
const { loadAgency } = require('./_load-agency');
const D = require('../heretics-40k-data-v1.json');
const CHRON = loadChron();
const ULT = loadAgency();

function st() { return { world: { chronicle: {} } }; }
const REC = { day: 214, kind: 'far', att: 'Orks', def: 'Astra Militarum', outcome: 'sacked', arith: '800 PC vs 500 PC → SACKED', seed: 12345 };

test('record appends, creates array, returns rec', () => {
  const s = st();
  const r = CHRON.record(s, 'hivep', REC, D);
  assert.strictEqual(s.world.chronicle.hivep.length, 1);
  assert.strictEqual(r, REC);
});

test('record evicts oldest past chronicle_cap', () => {
  const s = st();
  for (let i = 0; i < 35; i++) CHRON.record(s, 'x', { ...REC, day: i }, D);
  assert.strictEqual(s.world.chronicle.x.length, D.rules.cadence.chronicle_cap);
  assert.strictEqual(s.world.chronicle.x[0].day, 5); // oldest 5 evicted
});

test('titleOf maps outcomes', () => {
  assert.match(CHRON.titleOf(REC, 'Hive Primus'), /Sack of Hive Primus/);
  assert.match(CHRON.titleOf({ ...REC, outcome: 'captured' }, 'X'), /Fall of X/);
  assert.match(CHRON.titleOf({ ...REC, outcome: 'repelled' }, 'X'), /Defense of X/);
});

test('account is deterministic, ends with THE RECORD arithmetic', () => {
  const a1 = CHRON.account(REC, 'Hive Primus', ULT.rng);
  const a2 = CHRON.account(REC, 'Hive Primus', ULT.rng);
  assert.deepStrictEqual(a1, a2);
  assert.ok(a1.length >= 4 && a1.length <= 7);
  assert.strictEqual(a1[a1.length - 1].who, 'THE RECORD');
  assert.match(a1[a1.length - 1].body, /800 PC vs 500 PC/);
  assert.ok(a1.some(p => p.who === 'Orks') && a1.some(p => p.who === 'Astra Militarum'),
    'both sides must speak');
});

test('different seeds tell different stories', () => {
  const a = CHRON.account(REC, 'X', ULT.rng);
  const b = CHRON.account({ ...REC, seed: 999 }, 'X', ULT.rng);
  assert.notDeepStrictEqual(a.slice(0, -1), b.slice(0, -1));
});
```

- [ ] **Step 2: Run → FAIL.** 

- [ ] **Step 3: Implement** — inside the cadence-core region after CAD:

```js
var CHRON=(function(){
  function cap(canon){return ((canon.rules&&canon.rules.cadence)||{}).chronicle_cap||30;}
  function record(state,lid,rec,canon){
    var w=state.world;w.chronicle=w.chronicle||{};
    var list=w.chronicle[lid]=w.chronicle[lid]||[];
    list.push(rec);while(list.length>cap(canon))list.shift();
    return rec;}
  var TITLES={repelled:'The Defense of ',repelled_losses:'The Bloody Defense of ',
    sacked:'The Sack of ',captured:'The Fall of ',tribute:'The Ransom of ',drama:'The Battle of '};
  function titleOf(rec,locName){return (TITLES[rec.outcome]||'The Clash at ')+locName;}
  var OPEN=['{att} came out of the void without herald or parley, and {loc} answered with every gun it had.',
    'The first warning {loc} had of {att} was the sky going dark.',
    '{att} moved on {loc} at dawn, banners black against the smoke.'];
  var MID_A=['The outer line broke twice and was twice retaken, the dead stacked for barricades.',
    'For a day and a night the issue hung on a single gate, and neither side would give it.',
    'The defenders fired until the barrels glowed, and still the tide came on.'];
  var MID_B=['{def} held the inner ring with everything that could still stand.',
    '{def} counter-charged into the breach, and for an hour the field belonged to no one.',
    '{def} fell back street by street, selling each one at cost.'];
  var CLOSE={repelled:'When it ended, {att} was gone and {loc} still stood, barely marked.',
    repelled_losses:'{att} withdrew at last — but {loc} buried too many to call it clean.',
    sacked:'{att} took what could be carried and burned what could not. {loc} smoulders.',
    captured:'By nightfall the banners over {loc} had changed. It belongs to {att} now.',
    tribute:'No walls fell. The price was counted out at the gate, and {att} turned away.',
    drama:'The field fell silent at last over {loc}.'};
  function fill(t,rec,locName){return t.replace(/\{att\}/g,rec.att).replace(/\{def\}/g,rec.def).replace(/\{loc\}/g,locName);}
  function account(rec,locName,rngFn){
    var r=rngFn((rec.seed>>>0)^0x5EED);
    function pick(arr){return arr[Math.floor(r()*arr.length)];}
    var out=[{who:rec.att,body:fill(pick(OPEN),rec,locName)},
      {who:rec.def,body:fill(pick(MID_B),rec,locName)},
      {who:rec.att,body:fill(pick(MID_A),rec,locName)}];
    if(r()<0.5)out.push({who:rec.def,body:fill(pick(MID_B),rec,locName)});
    out.push({who:rec.outcome==='repelled'||rec.outcome==='repelled_losses'?rec.def:rec.att,
      body:fill(CLOSE[rec.outcome]||CLOSE.drama,rec,locName)});
    out.push({who:'THE RECORD',body:rec.arith});
    return out;}
  return {record:record,titleOf:titleOf,account:account};
})();
```

Update `tests/_load-cadence.js`: extract the region once, eval `'(function(){'+body+'\n;return {CAD:CAD,CHRON:CHRON};})()'`, export `loadCadence()` → `.CAD` and `loadChron()` → `.CHRON`.

- [ ] **Step 4: Full suite** → green. **Step 5: Commit**

```bash
git add index.html tests/_load-cadence.js tests/chronicle-core.test.js
git commit -m "engine: T-NPC-3 N2 task 3 — CHRON chronicle core (capped per-location records, deterministic templated war accounts)"
```

---

### Task 4: Far lane — `npcAggression(day)` + `npcCapture` + digest

**Files:**
- Modify: `index.html`: new engine fn `npcAggression(day)` near `resolveUltLapses`; generalize capture into `npcCapture(pid,facId,viaText)`; call inside `init()`'s per-day loop; digest lines; `S.world.chronicle` seeding (BOTH sites); chronicle writes into `resolveUltLapses` + tribute + conclude paths.
- Test: extend `tests/world-core.test.js`-style coverage is NOT possible (engine fn) — verification is suite + E2E; the pure parts are already tested (Tasks 2-3).

**Interfaces:**
- Consumes: CAD/CHRON, `ULT.rng/garrisonPC/resolveLapse`, `THREAD.AXES.rollFor` (ferocity), `sweepSeatsOn`, `liveScores`, `fPl`, `sectorOfPlanet`.
- Produces: `npcAggression(day) → events[]` (kinds `far_battle`, `near_clock`); `npcCapture(pid, facId, viaText)`; every resolution path writes CHRON records.

- [ ] **Step 1: Seed the key** — `chronicle:{},` in `foundingWorld()` beside `seatMiss`; `if(!S.world.chronicle)S.world.chronicle={};` in `init()` backfill.

- [ ] **Step 2: `npcCapture`** — near `captureOnVictory` (~4245):

```js
/* N2: ruler transfer for ANY victor (captureOnVictory stays the player-facing wrapper).
   Writes the overlay, fires the seat sweep (T-TERR-2), logs. */
function npcCapture(pid,facId,viaText){
 var fp=fPl(pid);if(!fp)return;
 var f=FAC(facId);if(!f)return;
 var cur=pRuler(fp.p);if(cur&&cur.faction===f.name)return;
 S.world.rulers=S.world.rulers||{};
 S.world.rulers[pid]={allegiance:f.allegiance,faction:f.name};
 // losing the planet costs the PLAYER its holding/governor row if it was theirs
 var ix=(S.world.holdings||[]).indexOf(pid);
 if(ix>=0){S.world.holdings.splice(ix,1);delete (S.world.governor||{})[pid];}
 sweepSeatsOn(pid);
 S.world.log=S.world.log||[];
 S.world.log.unshift(nowStamp()+' — CONQUEST: '+fp.p.name+' falls to '+f.name+(viaText?(' — '+viaText):'')+'.');
}
```

Then refactor `captureOnVictory` to delegate: keep its gates/RECORD/toast, but perform the ruler+holdings write via `npcCapture(t.pl, S.player.faction, ...)`? **NO — careful:** `npcCapture` REMOVES the pid from holdings; the player-capture path ADDS it. Keep `captureOnVictory` as-is (it already works and sweeps) and use `npcCapture` only for NPC victors. Add one line to `captureOnVictory` docs-comment noting the pair.

- [ ] **Step 3: `npcAggression(day)`** — beside `resolveUltLapses`:

```js
/* N2: one cadence pass for ONE absolute day index. Runs inside init()'s per-day loop,
   interleaved with lapses/heal/seat passes — chunk-independent by construction. */
function npcAggression(day){
 var out=[],base=S.world.missionSeedBase||1;
 var activePlayerClocks=S.threads.filter(function(t){return t.ultimatum&&!t.done&&t.npcClock;}).length;
 D.galaxy.segmentums.forEach(function(g){g.zones.forEach(function(z){z.sectors.forEach(function(sec){
  var sc=liveScores(sec.id),conflict=sc?sc.conflict:10;
  if(!CAD.rollDay(sec.id,day,base,conflict,ULT.rng,D))return;
  // factions present: planet rulers in this sector
  var present={},cands=[];
  (sec.planets||[]).forEach(function(p){
   var r=pRuler(p);if(!r||!r.faction)return;
   var f=facByName(r.faction);if(!f)return;
   if(!present[f.id])present[f.id]={facId:f.id,
     ferocity:THREAD.AXES.rollFor(f.id,'cadfer:'+sec.id,D).ferocity};
   (p.locations||[]).forEach(function(l){
    if(l.type==='orbit')return;
    var mine=(S.world.holdings||[]).indexOf(p.id)>=0||!!(S.world.seats&&S.world.seats[l.id]);
    cands.push({key:l.id,pid:p.id,lid:l.id,facId:f.id,isPlayer:mine,
      garrisonPC:ULT.garrisonPC(l.level,effCond(l),stationedPCAt(l.id),D),
      crossRift:false,isPlanet:true,loc:l,planet:p});});});
  var pl=Object.keys(present).map(function(k){return present[k];});
  var agg=CAD.pickAggressor(pl,day,base,sec.id,ULT.rng,D);
  if(!agg)return;
  // cross-rift flag now that we know the aggressor's side
  var aggSide=(FAC(agg)||{}).allegiance==='imperial'?'Sanctus':null; // planets carry .rift
  cands.forEach(function(c){c.crossRift=!!(c.planet.rift&&aggSide&&c.planet.rift!==aggSide);});
  var legal=CAD.legalTargets(agg,cands.filter(function(c){return !activeUltAt(c.lid);}),D);
  var drawn=CAD.drawTarget(legal,ULT.rng,CAD.seed(base,day,'tgt:'+sec.id));
  drawn=CAD.applyPlayerCap(legal,drawn,activePlayerClocks,D);
  if(!drawn)return;
  var muster=Math.round(drawn.garrisonPC*(0.8+1.6*ULT.rng(CAD.seed(base,day,'mus:'+sec.id+':'+agg))()));
  var scale=CAD.scaleFor(muster,drawn.garrisonPC,drawn.isPlanet,D);
  if(drawn.isPlayer){activePlayerClocks++;out.push(mintNpcClock(drawn,agg,scale,muster,day));}
  else out.push(resolveFarBattle(drawn,agg,scale,muster,day));
 });});});
 return out;}
```

NOTE for the implementer: `aggSide` derivation above is a sketch — derive the aggressor's rift side the way the RIFT core does (`RIFT.sideOf` exists; grep its signature and use it), not by allegiance guesswork. Planets carry `.rift` ("Sanctus"/"Nihilus"); `crossRift = planet.rift !== RIFT side of aggressor` where determinable, else false.

- [ ] **Step 4: `resolveFarBattle`** —

```js
function resolveFarBattle(c,agg,scale,muster,day){
 var base=S.world.missionSeedBase||1;
 var def=Math.round(c.garrisonPC*((D.rules.ultimatum||{}).defender_mult||1.25));
 var r=ULT.rng(ULT.seedFor(base,day,c.lid,'far:'+agg));
 var res=ULT.resolveLapse(muster,def,scale==='INVASION'?'invasion':'raid',r,D);
 var defFacName=(pRuler(c.planet)||{}).faction||'the garrison';
 // condition ladder, same writes as the lapse site (grep resolveUltLapses and mirror)
 var prev=effCond(c.loc),end=prev;
 if(res.outcome==='repelled_losses'||res.outcome==='sacked')end=ULT.stepDown(prev);
 if(end!==prev){S.world.locConds=S.world.locConds||{};S.world.locConds[c.lid]=end;}
 if(res.outcome==='captured')npcCapture(c.pid,agg,'a '+scale.toLowerCase()+' out of the void');
 var rec=CHRON.record(S,c.lid,{day:day,kind:'far',att:(FAC(agg)||{}).name||agg,
   def:defFacName,outcome:res.outcome,arith:res.arith,
   seed:ULT.seedFor(base,day,c.lid,'far:'+agg)},D);
 S.world.log=S.world.log||[];
 S.world.log.unshift(nowStamp()+' — WAR: '+CHRON.titleOf(rec,c.loc.name)+' — '+res.arith);
 return {kind:'far_battle',loc:c.loc.name,outcome:res.outcome,att:rec.att};}
```

- [ ] **Step 5: Wire the per-day loop** — in `init()`'s `for(_db=0;_db<_wc.ticks;_db++)` loop, AFTER the lapse resolution line, add `npcAggression(_startDay+_db+1).forEach(function(e){_wc.events.push(e);});` (mintNpcClock lands in Task 5 — for THIS task, have `mintNpcClock` return a stub event `{kind:'near_clock_stub'}` and never mint; implement fully next task. State that in the report.) Digest: add to `WORLD.digest` an aggregate far-battle line: `⚔ N battles scorched the far galaxy.` plus one line for any capture events already carried via world log.

- [ ] **Step 6: Chronicle back-fill on N1 paths** — add `CHRON.record` writes at: `resolveUltLapses` outcome (kind `'lapse'`), tribute acceptance (kind `'tribute'`, outcome `'tribute'`), and player thread `concludeThread` combat outcomes at a location (kind `'thread'`, outcome from victor — grep the conclude path and write a compact record with the thread's own id string in `arith`).

- [ ] **Step 7: Suite + E2E** — `node --test` green. Browser: `_noPersist=true`; force `S.world.stats[<sector>]={conflict:100}`, roll `S.time.lastTick` back ~30 days, re-run init glue → digest shows far battles; a location panel shows changed condition; `S.world.chronicle` populated; a captured planet's ruler changed + player seat on it swept. 0 console errors.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "engine: T-NPC-3 N2 task 4 — far-lane aggression on the tick (seeded cadence pass, resolveFarBattle, npcCapture, chronicle writes, digest)"
```

---

### Task 5: Near lane — NPC clocks on player holdings + kin-raid re-ruling

**Files:**
- Modify: `index.html`: real `mintNpcClock`; kin-raid hook move in `startThread`; thread-board/location UI for NPC-initiated threads.

**Interfaces:**
- Consumes: `ULT.pickWindow`, `THREAD.AXES.rollFor`, `seedCombat`'s NPC detachment path, thread shape, `WORLD.dayIndexAt`.
- Produces: NPC-initiated combat threads carrying `t.npcClock=true`, `t.ultimatum={expiresDay,prev,aggressor,scale}` (EXACT same shape as player-minted clocks — grep `t.ultimatum=` and mirror field-for-field), Besieged overlay via the existing locConds path.

- [ ] **Step 1: `mintNpcClock(c,agg,scale,muster,day)`** — mints a real thread: type SKIRMISH/INVASION per scale, `initiator` = a seeded warlord name of the aggressor faction (reuse `rulerFaceOf`-style pools or the faction name), `about` = one templated line ("<faction> has issued terms: submit, pay, or burn."), `forces` = the NPC detachment name, `vis:'public'`, `npcClock:true`, `t.ultimatum` mirroring the player-minted shape with `pickWindow` over the aggressor's rolled axes, `prev` = current effCond. Seed the NPC side via the same detachment generator `seedCombat` uses (pass no player force — the player joins later via the normal join path; verify `seedCombat`'s host-only path or split its NPC half into a helper if needed — implementer's call, note it in the report). Write the Besieged overlay exactly as the player-minted path does (grep how creation stamps it). Push a THE RECORD post announcing the ultimatum with the countdown. World-log + digest line (`⏳ <faction> has clocked <loc> — N days.`).
- [ ] **Step 2: Un-stub Task 4's call.** The lapse of an npcClock thread flows through `resolveUltLapses` UNCHANGED (it reads `t.ultimatum` agnostically — verify by read; the stationed-casualty block already fires for seats).
- [ ] **Step 3: Kin-raid re-ruling** — in `startThread`, replace the T-TERR-2 ruler-floor block: after `seedCombat` has seeded the host, read the opposing faction (`host.faction` → `facByName(...).id`; grep where the host/gen faction is reachable post-seed — `t.seedState.combatants`' gen.faction works) and apply `SEAT.kinRaid(S.world.standing, thatFacId, D)` instead of the ruler's. Keep the own-kin toast. If no NPC side was seeded (social thread), no floor.
- [ ] **Step 4: Suite + E2E** — force a near event (console: high conflict + player holding as only candidate), verify: thread appears with countdown + Besieged pill; joining it works (deploy vs the NPC detachment); ignoring it (roll clock past expiry) fires the lapse with casualties; kin-raid: start a SKIRMISH vs a Tyranid-squatter location on a kin world → standing with kin unchanged, Tyranids floored. 0 console errors.
- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: T-NPC-3 N2 task 5 — NPC-initiated ultimatum threads (near lane), kin-raid floor follows the faction fought"
```

---

### Task 6: Player-side tribute palette

**Files:**
- Modify: `index.html`: tribute panel on npcClock threads (pre-Lock-In), valuation, evaluate/counter via existing math.

**Interfaces:**
- Consumes: `ULT.tributeOffer` (demand sizing), `ULT.evalCounter`, `THREAD.AXES.rollFor` (aggressor pragmatism), `D.rules.ultimatum.tribute.faction_appetite`, `D.rules.resources.exchange` sell rates, `S.inv`, `stockOf/spendStock/addStock`, TAKEN/CAPTIVE/REMAINS items.
- Produces: an offer builder UI + `evalPlayerTribute(offerValue, demandValue, aggFacId, seed) → 'accept'|'counter'|'refuse'` with counter ×1.5/×2 once.

- [ ] **Step 1: Demand + valuation.** Demand = `ULT.tributeOffer(loc.level, planet.prod_mult, scaleKey, r, D)` totalized (cur + resources at sell rates) × 1.2 (the aggressor asks MORE than a defender would offer — flagged tunable, add `demand_mult:1.2` to `rules.cadence.tribute_valuation` + canon pin in `tests/canon-cadence.test.js`). Offer sources valued per spec §4 table: currency 1:1; stock at exchange sell rates; gear at its `pc`; CAPTIVE/REMAINS at `pc × (own faction? own_model_mult : 1)`.
- [ ] **Step 2: Panel.** On an open npcClock thread pre-Lock-In: "OFFER TRIBUTE" section — number input for currency, per-resource steppers (bounded by stock), checkbox list of inventory gear + captives/remains, live offer-total vs a "their patience" hint (never the exact demand — fog). Submit → seeded eval: accept if `offerValue >= demand`; else if `offerValue >= demand/1.5` → counter (seeded ×1.5 or ×2 of remaining gap, once, via `ULT.evalCounter`-style pragmatism+appetite math); else refuse. Accept: transfer everything (cur/stock/items out; TAKEN models offered as return are removed from roster or handed over as their item), clock + Besieged lift, `t.done={kind:'tribute'}`, CHRON record kind `'tribute'`, RECORD post with the ledger shown, digest line. Counter: RECORD post with the counter-demand; player may accept (same transfer at the counter total) — the offer panel relocks after one counter. Refuse: RECORD post, clock keeps running.
- [ ] **Step 3: Suite + E2E** — full flow in browser: build an offer short of demand → counter → accept counter → siege lifts, goods moved, chronicle written. Refusal path leaves the clock live. 0 console errors.
- [ ] **Step 4: Commit**

```bash
git add index.html heretics-40k-data-v1.json tests/canon-cadence.test.js
git commit -m "engine: T-NPC-3 N2 task 6 — player-side tribute palette (currency/stock/gear/captive-return, seeded counter x1.5/x2)"
```

---

### Task 7: The drama (cap 1)

**Files:**
- Modify: `index.html`: drama spawn in the far path, per-day driver, conclusion feed; `S.world.drama` seeding (BOTH sites).

**Interfaces:**
- Consumes: `THREAD.npcTurn` (both sides), `genBoard`/deploy machinery (grep how mission threads auto-deploy NPC sides), `resolveFarBattle`'s resolution writes.
- Produces: `S.world.drama={tid}|null`; drama threads are real public threads, one npcTurn exchange per side per tick day.

- [ ] **Step 1: Spawn.** In the far path (Task 4), when `drawn.loc` is a crown location (`drawn.planet.crown===true`) AND `!S.world.drama` → instead of `resolveFarBattle`, mint a public thread with BOTH sides NPC (two detachments via the generator, attacker sized by `muster`), auto-deploy both (seeded positions via the existing deploy plumbing — grep how `seedCombat`+deploy phase place NPC models and mirror for two sides; auto-Lock-In immediately), `S.world.drama={tid}`. World-log + digest (`🎭 War comes to <loc> — the battle is joined in the open.`).
- [ ] **Step 2: Driver.** In the per-day loop, if `S.world.drama`: play ONE exchange (npcTurn for side A, then side B) on the drama thread via the existing npc-post path (grep `npcRespond`/how npcTurn posts land). When `THREAD.outcome` reports a victor (or 60 in-game days pass — hard cap, seeded draw counts as `repelled`): write the same resolution a far battle would (conditions/capture via victor faction), CHRON record kind `'drama'`, clear `S.world.drama`, digest line.
- [ ] **Step 3: Suite + E2E** — force-spawn a drama on a crown world (console), advance days, watch posts accumulate in the public thread; run it to conclusion; verify resolution + chronicle + drama slot cleared. 0 console errors.
- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "engine: T-NPC-3 N2 task 7 — auto-played drama (cap 1): two-sided npcTurn war thread on crown worlds, daily exchanges, resolution feeds the world"
```

---

### Task 8: Chronicle UI + NPC memory + close-out

**Files:**
- Modify: `index.html`: location panel History section reads chronicle; account overlay view; NPC context injection; `CLAUDE.md` bullet; `BACKLOG.md` row.

**Interfaces:**
- Consumes: `CHRON.titleOf/account`, the location panel's existing History block (`S.world.history` stub — grep `history` in the map panel), NPC approach/comms context assembly (grep the NPCAI prompt/context builder — `axisLine`/ctx assembly ~1514-1525).

- [ ] **Step 1: History panel.** In the location panel, render the location's chronicle newest-first above/replacing the demo `S.world.history` lines: `⚔ <titleOf> · day N · <att> vs <def> · <OUTCOME>`. Click → overlay styled like a concluded thread read (reuse post-rendering markup) showing `CHRON.account(rec, locName, ULT.rng)`, title + day header. Keep the old demo-history lines below (labeled ARCHIVE) — do not delete data.
- [ ] **Step 2: NPC memory.** Where NPC approach/comms context is assembled, inject the location's last 3 chronicle records as fact lines (`'This ground remembers: '+titleOf(...)+' ('+outcome+', day '+day+')'`) so templated NPC lines (and Stage-3 prompts later) carry them. Keep it to the context/ctx string — no new NPC state.
- [ ] **Step 3: Docs.** `CLAUDE.md`: one N2 engine bullet (house style, canon v1.36, the four rulings, chronicle, tunables flagged). `BACKLOG.md`: T-NPC-3 row → N2 ✅ built, `ready-to-push`, paths + commit range + tunables + N3 remains; carry-overs from the N2 brief (spatial pin, `_bsg` snapshot) stay listed.
- [ ] **Step 4: Full suite + 7-screen E2E sweep** — 0 console errors; chronicle panel + account overlay verified on a location with records; NPC approach line references a past battle.
- [ ] **Step 5: Commit**

```bash
git add index.html CLAUDE.md BACKLOG.md
git commit -m "engine: T-NPC-3 N2 task 8 — Chronicle UI (history list + rendered war accounts), NPC memory injection, close-out docs"
```

---

## Post-plan verification (whole-branch)

Lifecycle review on the most capable model, walking:
A. A far battle's full life: cadence roll → target draw → resolve → condition/capture → chronicle → digest — replayed twice (determinism) and chunked-vs-daily (equivalence).
B. A near clock's full life: mint → Besieged → fight/pay/ignore ×3 branches → chronicle — incl. the ≤2 player-clock cap under pressure.
C. npcCapture vs captureOnVictory: holdings/governor/seat symmetry both directions; a player seat on an NPC↔NPC captured world.
D. Kin-raid re-ruling: squatter fight, ruler-garrison fight, defense of own clocked ground (no floor).
E. Tribute palette: valuation exactness, counter-once invariant, transfer atomicity (nothing moves on refuse).
F. Drama: cap 1 invariant, driver under multi-day catch-up, conclusion resolution parity with resolveFarBattle.
G. Ledger triage of deferred minors.
