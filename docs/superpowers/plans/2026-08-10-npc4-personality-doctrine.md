# T-NPC-4 — Personality Combat Doctrine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every NPC commander fights by a faction-seeded personality — three loud styles (ONSLAUGHT / CULLING / DECAPITATION), pragmatism-driven retreat through the minted escape rule, honor conduct, and personality nudges in lapse-battle arithmetic.

**Architecture:** Mint the 20-faction `ai.behavior_matrix` + `rules.doctrine` into canon; add pure `AXES.rollFor` / `doctrineOf` / `shouldRetreat` and style-aware `npcTurn` to the THREAD core (optional trailing args — legacy callers unchanged); ULT lapse math gains an optional behavior argument (glue rolls and passes it — regions never cross-call); glue stamps `state.behavior` lazily in `npcRespond` and routes NPC retreat into the existing aftermath flow via a new `withdrawal` outcome kind.

**Tech Stack:** vanilla JS single-file engine (`index.html`), canon JSON, Node built-in test runner (`node --test`), Playwright MCP for browser E2E.

**Spec:** `docs/superpowers/specs/2026-08-10-npc4-personality-combat-doctrine-design.md` (LOCKED, incl. §4a planning addendum).

## Global Constraints

- **⚠ LANE GATE: do NOT start until T-TERR-2 releases the 🔥 engine + canon lanes** (check `BACKLOG.md`). Claim the T-NPC-4 build in BACKLOG.md first; commit the claim before any other edit.
- Terminology law: always "model", never "chassis".
- Canon `meta.version`: bump by one minor from whatever HEAD holds at build time (expected **v1.35** after T-TERR-2's v1.34 — VERIFY, version-ladder rule) + add a `meta.scope_notes`-style changelog line matching the existing array's format (check the actual key name at the top of the JSON; it's the array of "v1.x: …" strings).
- `git add <explicit paths>` only — NEVER `git add -A` / `git add .` (shared working folder).
- `node --test` must be green at every pause/commit. Run from repo root.
- Doctrine is HIDDEN: no UI labels, no doctrine names in any player-facing string (RECORD arithmetic lines in lapse battles are the ONLY sanctioned surface, and they name axes, not styles).
- All tunables come from `rules.doctrine` with the code defaults shown here (canon absent → same numbers).
- Style ids are lowercase strings: `'onslaught'`, `'culling'`, `'decapitation'`. Axis keys: `ferocity, cunning, pragmatism, honor, supremacism`.

---

### Task 1: Canon — behavior_matrix + rules.doctrine + guard tests

**Files:**
- Modify: `heretics-40k-data-v1.json` (add `ai.behavior_matrix`, `rules.doctrine`, bump `meta.version`, changelog line)
- Create: `tests/canon-doctrine.test.js`

**Interfaces:**
- Produces: `canon.ai.behavior_matrix[facId][axis] = {base, spread, plasticity, floor, ceiling}` for all 20 faction ids; `canon.rules.doctrine = {styles, retreat:{base}, honor:{high,low}, lapse:{cun_p_per_point, fer_margin_per_point, honor_loot_per_point, honor_loot_min}}`.

- [ ] **Step 1: Write the failing guard test** — `tests/canon-doctrine.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const AXES = ['ferocity','cunning','pragmatism','honor','supremacism'];

// spec §1 table — style = argmax(FER, CUN, SUP), tie order FER > CUN > SUP
const EXPECT_STYLE = {
  black_legion:'decapitation', death_guard:'onslaught', world_eaters:'onslaught',
  thousand_sons:'culling', emperors_children:'decapitation', daemons:'onslaught',
  astartes:'onslaught', militarum:'culling', mechanicus:'culling', sororitas:'onslaught',
  custodes:'decapitation', tyranids:'onslaught', orks:'onslaught', necrons:'culling',
  aeldari:'culling', drukhari:'culling', tau:'culling', gsc:'culling',
  votann:'decapitation', harlequins:'culling'
};

test('doctrine: all 20 factions carry a complete, bounded behavior_matrix row', () => {
  const M = D.ai.behavior_matrix;
  assert.ok(M, 'ai.behavior_matrix exists');
  const facIds = D.factions.map(f => f.id);
  assert.strictEqual(facIds.length, 20);
  for (const id of facIds) {
    const row = M[id];
    assert.ok(row, `row for ${id}`);
    for (const ax of AXES) {
      const a = row[ax];
      assert.ok(a, `${id}.${ax}`);
      for (const k of ['base','spread','plasticity','floor','ceiling'])
        assert.strictEqual(typeof a[k], 'number', `${id}.${ax}.${k} numeric`);
      assert.ok(a.floor >= 0 && a.ceiling <= 100 && a.floor <= a.base && a.base <= a.ceiling,
        `${id}.${ax} bounded (floor<=base<=ceiling in [0,100])`);
    }
  }
});

test('doctrine: style census matches the locked spec table (7/9/4)', () => {
  const M = D.ai.behavior_matrix;
  const styleOf = row => {
    const fer = row.ferocity.base, cun = row.cunning.base, sup = row.supremacism.base;
    return (fer >= cun && fer >= sup) ? 'onslaught' : (cun >= sup) ? 'culling' : 'decapitation';
  };
  const census = { onslaught:0, culling:0, decapitation:0 };
  for (const [id, want] of Object.entries(EXPECT_STYLE)) {
    const got = styleOf(M[id]);
    assert.strictEqual(got, want, `${id} style`);
    census[got]++;
  }
  assert.deepStrictEqual(census, { onslaught:7, culling:9, decapitation:4 });
});

test('doctrine: rules.doctrine tunables block shape', () => {
  const d = D.rules.doctrine;
  assert.ok(d, 'rules.doctrine exists');
  assert.deepStrictEqual(d.styles, { ferocity:'onslaught', cunning:'culling', supremacism:'decapitation' });
  assert.strictEqual(d.retreat.base, 110);
  assert.deepStrictEqual(d.honor, { high:70, low:30 });
  assert.strictEqual(d.lapse.cun_p_per_point, 0.001);
  assert.strictEqual(d.lapse.fer_margin_per_point, 0.001);
  assert.strictEqual(d.lapse.honor_loot_per_point, 0.005);
  assert.strictEqual(d.lapse.honor_loot_min, 0.75);
});

test('doctrine: world_eaters ferocity lore floor is 80', () => {
  assert.strictEqual(D.ai.behavior_matrix.world_eaters.ferocity.floor, 80);
});
```

- [ ] **Step 2: Run it to verify it fails** — `node --test tests/canon-doctrine.test.js` → FAIL (`ai.behavior_matrix` undefined).

- [ ] **Step 3: Mint the canon block** — run this one-off script from the repo root (deterministic derivation from the spec table; deletes itself from nothing — it's not committed):

```python
# python3 mint_doctrine.py  (temp file in the SCRATCHPAD, not the repo)
import json, collections
P = 'heretics-40k-data-v1.json'
d = json.load(open(P), object_pairs_hook=collections.OrderedDict)
# spec §1 bases, order: FER CUN PRAG HON SUP
T = {
 'black_legion':(65,70,60,25,75), 'death_guard':(55,45,35,40,45), 'world_eaters':(95,25,10,30,40),
 'thousand_sons':(30,90,65,45,70), 'emperors_children':(70,60,30,25,75), 'daemons':(85,40,5,5,50),
 'astartes':(65,60,45,70,55), 'militarum':(45,55,75,55,30), 'mechanicus':(35,80,70,30,60),
 'sororitas':(75,45,15,60,50), 'custodes':(70,75,35,80,80), 'tyranids':(90,55,0,0,40),
 'orks':(90,30,20,45,60), 'necrons':(40,75,75,50,55), 'aeldari':(45,85,80,55,45),
 'drukhari':(55,90,75,5,45), 'tau':(25,80,70,60,35), 'gsc':(50,75,65,20,30),
 'votann':(55,65,60,65,70), 'harlequins':(60,88,55,70,40)
}
AX = ['ferocity','cunning','pragmatism','honor','supremacism']
M = collections.OrderedDict()
for fac, bases in T.items():
    row = collections.OrderedDict()
    for ax, b in zip(AX, bases):
        row[ax] = collections.OrderedDict(
            base=b, spread=12, plasticity=12,
            floor=max(0, b-25), ceiling=min(100, b+25))
    M[fac] = row
M['world_eaters']['ferocity']['floor'] = 80   # lore floor (spec §1)
d['ai']['behavior_matrix'] = M
d['rules']['doctrine'] = collections.OrderedDict([
    ('styles', collections.OrderedDict([('ferocity','onslaught'),('cunning','culling'),('supremacism','decapitation')])),
    ('retreat', {'base': 110}),
    ('honor', collections.OrderedDict([('high',70),('low',30)])),
    ('lapse', collections.OrderedDict([('cun_p_per_point',0.001),('fer_margin_per_point',0.001),
                                       ('honor_loot_per_point',0.005),('honor_loot_min',0.75)]))
])
json.dump(d, open(P,'w'), indent=1, ensure_ascii=False)
print('minted', len(M), 'rows')
```

Then bump `meta.version` (one minor above HEAD's current — expected `"1.35"`) and append the changelog line to the meta array of `"v1.x: …"` strings (match its exact key + string style):
`"v1.35: T-NPC-4 personality combat doctrine — ai.behavior_matrix (20 faction rows, 5 axes as base/spread/plasticity/floor/ceiling) + rules.doctrine (styles onslaught/culling/decapitation, retreat curve, honor gates, lapse nudge tunables)."`

- [ ] **Step 4: Run the guard test + full suite** — `node --test tests/canon-doctrine.test.js` → PASS, then `node --test` → ALL PASS. If any canon pin test counts top-level `rules` keys or `ai` keys, update that pin (count-pins rule: adjust the count, don't weaken the assertion).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-doctrine.test.js
git commit -m "canon: T-NPC-4 behavior_matrix (20 factions) + rules.doctrine (vX.XX)"
```

---

### Task 2: THREAD core — AXES.rollFor, doctrineOf, shouldRetreat (pure)

**Files:**
- Modify: `index.html` — inside `/*<thread-core>*/`, insert directly ABOVE `function npcTurn(` (~line 1258); extend the THREAD return object (~line 1393)
- Create: `tests/doctrine-core.test.js` (loads the core via `tests/_load.js`, same as `tests/npc-turn.test.js` — copy its require/setup lines)

**Interfaces:**
- Produces: `THREAD.AXES.rollFor(facId, seedStr, canon)` → `{ferocity,cunning,pragmatism,honor,supremacism}` (plain numbers); `THREAD.doctrineOf(behavior, canon)` → `{style, honorMode:'high'|'none'|'low', retreatAt:number}`; `THREAD.shouldRetreat(side, state, canon)` → boolean.
- Consumes: `canon.ai.behavior_matrix`, `canon.rules.doctrine` (Task 1).

- [ ] **Step 1: Write failing tests** — `tests/doctrine-core.test.js`:

```js
// same harness prelude as tests/npc-turn.test.js (THREAD loaded via ./_load)
const test = require('node:test');
const assert = require('node:assert');
const { THREAD } = require('./_load');

const CANON = { ai: { behavior_matrix: {
    testfac: { ferocity:{base:80,spread:10,plasticity:12,floor:60,ceiling:95},
               cunning:{base:30,spread:10,plasticity:12,floor:5,ceiling:55},
               pragmatism:{base:50,spread:10,plasticity:12,floor:25,ceiling:75},
               honor:{base:50,spread:10,plasticity:12,floor:25,ceiling:75},
               supremacism:{base:40,spread:10,plasticity:12,floor:15,ceiling:65} } } },
  rules: { doctrine: { styles:{ferocity:'onslaught',cunning:'culling',supremacism:'decapitation'},
    retreat:{base:110}, honor:{high:70,low:30}, lapse:{} } } };

test('AXES.rollFor: deterministic, bounded, faction-shaped', () => {
  const a = THREAD.AXES.rollFor('testfac', 'thread:t1', CANON);
  const b = THREAD.AXES.rollFor('testfac', 'thread:t1', CANON);
  assert.deepStrictEqual(a, b, 'same seed → same roll');
  const c = THREAD.AXES.rollFor('testfac', 'thread:t2', CANON);
  assert.notDeepStrictEqual(a, c, 'different seed → different roll');
  for (const [ax, v] of Object.entries(a)) {
    const row = CANON.ai.behavior_matrix.testfac[ax];
    assert.ok(v >= row.floor && v <= row.ceiling, `${ax} within [floor,ceiling]`);
  }
});

test('AXES.rollFor: unknown faction → flat 50s', () => {
  const a = THREAD.AXES.rollFor('nope', 'x', CANON);
  assert.deepStrictEqual(a, {ferocity:50,cunning:50,pragmatism:50,honor:50,supremacism:50});
});

test('doctrineOf: style argmax with FER>CUN>SUP tie order; honor gates; retreat curve', () => {
  const d1 = THREAD.doctrineOf({ferocity:80,cunning:30,pragmatism:90,honor:75,supremacism:40}, CANON);
  assert.strictEqual(d1.style, 'onslaught');
  assert.strictEqual(d1.honorMode, 'high');
  assert.ok(Math.abs(d1.retreatAt - 0.20) < 1e-9);
  const d2 = THREAD.doctrineOf({ferocity:30,cunning:80,pragmatism:10,honor:20,supremacism:80}, CANON);
  assert.strictEqual(d2.style, 'culling', 'CUN ties SUP → culling');
  assert.strictEqual(d2.honorMode, 'low');
  assert.ok(d2.retreatAt >= 1, 'prag 10 → never retreats');
  const d3 = THREAD.doctrineOf(null, CANON);
  assert.strictEqual(d3.style, 'onslaught');   // flat 50s tie → FER wins
  assert.strictEqual(d3.honorMode, 'none');
});

function mkSide(pcs) {   // helper: side 'B' combatants with given [pc, dead] pairs
  const C = {};
  pcs.forEach(([pc, dead], i) => { C['b'+i] = { party:'B', dead:!!dead, model:{pc:pc}, x:0, y:i }; });
  C['p0'] = { party:'A', dead:false, model:{pc:10}, x:5, y:5 };
  return { combatants:C, behavior:{ B:{ferocity:50,cunning:50,pragmatism:90,honor:50,supremacism:50} } };
}

test('shouldRetreat: fires at the pragmatism threshold, once, never without behavior', () => {
  // prag 90 → retreatAt 0.20. 100 PC total, 30 dead → L=0.30 ≥ 0.20 → retreat
  const st = mkSide([[70,false],[30,true]]);
  assert.strictEqual(THREAD.shouldRetreat('B', st, CANON), true);
  st.retreatTried = 1;
  assert.strictEqual(THREAD.shouldRetreat('B', st, CANON), false, 'one attempt per battle');
  const fresh = mkSide([[90,false],[10,true]]);   // L=0.10 < 0.20 → holds
  assert.strictEqual(THREAD.shouldRetreat('B', fresh, CANON), false);
  const noBeh = mkSide([[10,false],[90,true]]); delete noBeh.behavior;
  assert.strictEqual(THREAD.shouldRetreat('B', noBeh, CANON), false, 'no behavior → never');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/doctrine-core.test.js` → FAIL (`AXES` undefined).

- [ ] **Step 3: Implement in the THREAD core** — insert above `function npcTurn(`:

```js
  /* ── T-NPC-4 · personality axes + doctrine (spec 2026-08-10) ──────────
     Self-contained (own hash/rng): regions are standalone-extracted for tests
     and must not lean on mission-core/ULT copies. */
  var AXES=(function(){
    function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
    function rng(seed){var a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
    var AXIS=['ferocity','cunning','pragmatism','honor','supremacism'];
    function rollFor(facId,seedStr,canon){
      var M=(canon&&canon.ai&&canon.ai.behavior_matrix)||{},row=M[facId],out={},r=rng(hashStr('axes:'+facId+':'+seedStr));
      AXIS.forEach(function(ax){
        var a=row&&row[ax];
        if(!a){out[ax]=50;return;}
        var sp=(a.spread!=null?a.spread:12);
        var v=Math.round(a.base+(r()*2-1)*sp);
        var fl=(a.floor!=null?a.floor:0),ce=(a.ceiling!=null?a.ceiling:100);
        out[ax]=Math.max(fl,Math.min(ce,v));});
      return out;}
    return {rollFor:rollFor,AXIS:AXIS};
  })();
  function doctrineOf(behavior,canon){
    var b=behavior||{},d=(canon&&canon.rules&&canon.rules.doctrine)||{};
    var fer=(b.ferocity!=null?b.ferocity:50),cun=(b.cunning!=null?b.cunning:50),sup=(b.supremacism!=null?b.supremacism:50);
    var style=(fer>=cun&&fer>=sup)?'onslaught':(cun>=sup)?'culling':'decapitation';   // tie order FER > CUN > SUP
    var hg=d.honor||{},hi=(hg.high!=null?hg.high:70),lo=(hg.low!=null?hg.low:30);
    var hon=(b.honor!=null?b.honor:50);
    var base=((d.retreat||{}).base!=null)?d.retreat.base:110;
    var prag=(b.pragmatism!=null?b.pragmatism:50);
    return {style:style,honorMode:(hon>=hi?'high':hon<=lo?'low':'none'),retreatAt:(base-prag)/100};
  }
  function shouldRetreat(side,state,canon){
    var beh=state&&state.behavior&&state.behavior[side];if(!beh)return false;
    if(state.retreatTried)return false;
    var doc=doctrineOf(beh,canon);if(doc.retreatAt>=1)return false;
    var C=state.combatants||{},tot=0,alive=0,id;
    for(id in C){var c=C[id];if(c.party!==side)continue;var pc=(c.model&&c.model.pc)||0;
      tot+=pc;if(!c.dead&&!c.captured)alive+=pc;}
    if(!tot)return false;
    return (1-alive/tot)>=doc.retreatAt;
  }
```

Extend the THREAD return object (line ~1393): add `AXES:AXES, doctrineOf:doctrineOf, shouldRetreat:shouldRetreat,` after `npcTurn:npcTurn,`.

- [ ] **Step 4: Run** — `node --test tests/doctrine-core.test.js` → PASS; `node --test` → ALL PASS (npcTurn untouched so far).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/doctrine-core.test.js
git commit -m "engine: T-NPC-4 task 2 - AXES.rollFor + doctrineOf + shouldRetreat (pure THREAD core)"
```

---

### Task 3: npcTurn — style targeting, movement intent, honor conduct

**Files:**
- Modify: `index.html` — `function npcTurn(side,state,board,weaponsOf,canon)` (~1258–1296)
- Test: extend `tests/doctrine-core.test.js` (board fixtures mirroring `tests/npc-turn.test.js` setup — copy its board/combatant helpers)

**Interfaces:**
- Produces: `npcTurn(side,state,board,weaponsOf,canon,behavior)` — new optional 6th arg; absent → reads `state.behavior[side]`; absent both → flat-50 doctrine = onslaught (legacy behavior, existing tests stay green).
- Consumes: `doctrineOf` (Task 2), existing `spottedEnemies/reachable/cheb/bandOf/actionCap/condMods/NPC_RANK`.

Behavioral contract (spec §3/§5):
- **onslaught** — per-model target = NEAREST spotted enemy (today's rule); movement/attack logic unchanged.
- **culling** — SIDE target = spotted enemy with fewest current wounds (`c.w[0]`, tiebreak lower id); models that can already reach and have an adjacent enemy (cheb ≤ 1) KITE: move to the reachable cell that maximizes min-distance to all spotted enemies while keeping the target within the model's best weapon band (band max cells: melee 1, short 3, medium 6, long unlimited); otherwise close as today.
- **decapitation** — SIDE target = spotted enemy with highest `model.pc` (tiebreak lower id); movement = today's close-the-gap toward that target.
- **honor high** — the side's commander model (its own highest `model.pc` alive) overrides its target to the enemy leader (spotted enemy with highest `model.pc`); ALL models exclude Critical targets (`c.w && c.w[0] <= 1` — same predicate as `actionCap`) from attacks; if every spotted enemy is Critical, the side moves but stages NO attacks (hold-fire pin).
- **honor low** — if any spotted enemy is Critical, retarget all models to the Critical enemy chosen by the style's own metric (culling: fewest wounds; others: nearest for onslaught / highest pc for decapitation among Critical).

- [ ] **Step 1: Write failing tests** — add to `tests/doctrine-core.test.js` (reuse the board/`weaponsOf` fixture pattern from `tests/npc-turn.test.js`; a flat 8×8 board, side 'B' NPCs vs side 'A' targets):

```js
// Fixture sketch (adapt the exact helper names from tests/npc-turn.test.js):
// - board: THREAD.genBoard-compatible flat board (no terrain), or the same literal
//   board object npc-turn.test.js already builds.
// - weaponsOf: c => [{name:'Gun', band:'medium', ap:1, damage:2, element:null}]
// - state.combatants: b0 (B, pc 10, at 0,0) · a0 (A, pc 5, w [3,3], at 4,0)
//   · a1 (A, pc 20, w [1,3], at 7,7)  — a1 is both WEAKEST (w 1) and BIGGEST (pc 20).
// All A models pre-spotted (copy the fog/spotted setup npc-turn.test.js uses).

test('npcTurn culling: side targets the fewest-wounds enemy', () => {
  // behavior cunning-dominant → culling; expect b0's damage effect .to === 'a1'
});
test('npcTurn decapitation: side targets the highest-pc enemy', () => {
  // behavior supremacism-dominant; a1.w = [3,3] so wounds don't coincide; expect .to === 'a1'
  // then swap pcs so a0 is biggest → expect .to === 'a0'
});
test('npcTurn onslaught: nearest, legacy behavior (no behavior arg, no state.behavior)', () => {
  // no behavior anywhere → expect .to === 'a0' (nearest) — the pre-NPC-4 result
});
test('npcTurn honor high: commander duels the enemy leader; Critical spared; all-Critical holds fire', () => {
  // honor 80: set a0 Critical (w [1,3]), a1 healthy → attacks must NOT hit a0;
  // commander (highest-pc B model) must target a1 (leader);
  // then set BOTH a0+a1 Critical → block contains moves only, zero damage effects
});
test('npcTurn honor low: finishes the wounded first', () => {
  // honor 10, onslaught side, a1 Critical at distance, a0 healthy nearby → target a1
});
test('npcTurn culling kite: adjacent enemy → steps back, keeps target in band', () => {
  // b0 at 3,3 with medium gun (band max 6); a0 adjacent at 3,4; a1 at 3,6 weakest
  // → expect a move effect increasing min-distance to spotted, target still within 6
});
```

Write these as REAL tests against the fixture (assert on `block` contents: `effect.kind`, `.to`, move destinations). The sketch comments above define the scenarios; the assertions are exact.

- [ ] **Step 2: Run to verify failures** — `node --test tests/doctrine-core.test.js` → new tests FAIL (npcTurn ignores behavior).

- [ ] **Step 3: Implement** — rewrite `npcTurn` (keeping every existing mechanism: fog-honesty, pools, action caps, rider fanouts, move-then-attack order):

```js
  var BAND_MAX={melee:1,short:3,medium:6,long:1e9};
  function npcTurn(side,state,board,weaponsOf,canon,behavior){
    canon=canon||{rules:{}};
    var C=state.combatants||{},block=[],id;
    var pool=(state.pools&&state.pools[side]!=null)?state.pools[side]:0;
    var spotted=board?spottedEnemies(side,state,board):[];
    if(!spotted.length)return block;
    var beh=behavior||(state.behavior&&state.behavior[side])||null;
    var doc=doctrineOf(beh,canon);
    var isCrit=function(eid){var e=C[eid];return !!(e&&e.w&&e.w[0]<=1);};   // same predicate as actionCap
    var live=spotted.filter(function(eid){var e=C[eid];return e&&!e.dead;});
    // honor conduct reshapes the candidate pool (spec §5)
    var cands=live;
    if(doc.honorMode==='high'){cands=live.filter(function(eid){return !isCrit(eid);});}
    else if(doc.honorMode==='low'&&live.some(isCrit)){cands=live.filter(isCrit);}
    var holdFire=(doc.honorMode==='high'&&cands.length===0);   // all Critical → mercy holds
    var pickBy=function(list,metric){var best=null;list.forEach(function(eid){var e=C[eid];if(!e)return;
      var k=metric(e,eid);if(!best||k<best.k||(k===best.k&&eid<best.id))best={id:eid,k:k};});
      return best&&best.id;};
    // side-level style target (culling/decapitation); onslaught stays per-model nearest
    var sideTgt=null,pool0=cands.length?cands:live;
    if(doc.style==='culling')sideTgt=pickBy(pool0,function(e){return (e.w&&e.w[0]!=null)?e.w[0]:1e9;});
    else if(doc.style==='decapitation')sideTgt=pickBy(pool0,function(e){return -((e.model&&e.model.pc)||0);});
    var leaderTgt=pickBy(pool0,function(e){return -((e.model&&e.model.pc)||0);});   // enemy leader = biggest
    // commander of MY side = highest-pc living model (honor-high duel seeker)
    var cmdr=null,cbest=-1;
    for(id in C){var cc=C[id];if(cc.party!==side||cc.dead||cc.x==null)continue;
      var cpc=(cc.model&&cc.model.pc)||0;if(cpc>cbest){cbest=cpc;cmdr=id;}}
    var pos={};for(id in C)if(C[id].x!=null)pos[id]={x:C[id].x,y:C[id].y};
    var _staged={};
    for(var aid in C){var me=C[aid];
      if(me.party!==side||me.dead||me.x==null)continue;
      var tgt=null;
      if(doc.honorMode==='high'&&aid===cmdr&&leaderTgt)tgt=leaderTgt;      // the duel
      else if(sideTgt)tgt=sideTgt;
      else {var td=Infinity;(cands.length?cands:live).forEach(function(eid){var e=C[eid];if(!e||e.dead)return;
        var d=cheb(pos[aid],pos[eid]);if(d<td){td=d;tgt=eid;}});}
      if(!tgt)continue;
      var weps=weaponsOf(me)||[];
      var reach=weps.reduce(function(m,w){var r=NPC_RANK[w.band];return r>m?r:m;},-1);
      var myMax=weps.reduce(function(m,w){return Math.max(m,BAND_MAX[w.band]||1);},0);
      var mySpd=Math.max(0,(me.spd||0)+condMods(me).speed);
      var occ=[];for(var oid in pos)if(oid!==aid&&C[oid]&&!C[oid].dead)occ.push(pos[oid]);
      var nearest=Infinity;live.forEach(function(eid){var d=cheb(pos[aid],pos[eid]);if(d<nearest)nearest=d;});
      if(doc.style==='culling'&&weps.length&&nearest<=1&&myMax>1){          // KITE: step back, keep reach
        var rs=reachable(pos[aid],mySpd,board,occ),bc=null,bs=-1,k;
        for(k in rs){var xy=k.split(','),cell={x:+xy[0],y:+xy[1]};
          if(cheb(cell,pos[tgt])>myMax)continue;
          var md=Infinity;live.forEach(function(eid){var d=cheb(cell,pos[eid]);if(d<md)md=d;});
          if(md>bs){bs=md;bc=cell;}}
        if(bc&&bs>nearest){block.push({actor:aid,cost:0,effect:{kind:'move',who:aid,to:bc}});pos[aid]=bc;}
      } else if(weps.length&&!npcReaches(reach,pos[aid],pos[tgt])){          // close the gap (as today)
        var reachSet=reachable(pos[aid],mySpd,board,occ),bestCell=null,bestD=cheb(pos[aid],pos[tgt]),k2;
        for(k2 in reachSet){var xy2=k2.split(','),cell2={x:+xy2[0],y:+xy2[1]},d2=cheb(cell2,pos[tgt]);
          if(d2<bestD){bestD=d2;bestCell=cell2;}}
        if(bestCell){block.push({actor:aid,cost:0,effect:{kind:'move',who:aid,to:bestCell}});pos[aid]=bestCell;}
      }
      if(holdFire)continue;                                                  // mercy: move only
      if((_staged[aid]||0)>=actionCap(me,canon))continue;
      var db=bandOf(cheb(pos[aid],pos[tgt])),pick=null;
      weps.forEach(function(w){if(NPC_RANK[w.band]>=NPC_RANK[db]&&(w.ap||0)<=pool){
        if(!pick||(w.damage||0)>(pick.damage||0))pick=w;}});
      if(pick){block.push({actor:aid,cost:pick.ap||0,effect:{kind:'damage',to:tgt,amount:pick.damage||0,element:pick.element||null,noRevival:!!pick.noRevival,nonLethal:!!pick.nonLethal,weapon:pick.name||null,band:db}});pool-=(pick.ap||0);_staged[aid]=(_staged[aid]||0)+1;
        (pick.conds||[]).forEach(function(ct){
          block.push({actor:aid,cost:0,fanout:true,effect:{kind:'cond',
            add:{tag:ct.tag,tier:ct.tier,src:pick.name||null,el:pick.element||null,nl:!!pick.nonLethal,nr:!!pick.noRevival,band:pick.band},to:tgt}});});
      }
    }
    return block;
  }
```

- [ ] **Step 4: Run** — `node --test tests/doctrine-core.test.js tests/npc-turn.test.js` → PASS (legacy tests must pass UNCHANGED — flat-50 doctrine reproduces old nearest-target behavior); then full `node --test` → ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/doctrine-core.test.js
git commit -m "engine: T-NPC-4 task 3 - npcTurn styles (onslaught/culling/decapitation) + honor conduct"
```

---

### Task 4: ULT — lapse nudges + loot restraint (pure)

**Files:**
- Modify: `index.html` — `/*<agency-core>*/` `resolveLapse` (~2375) and `lootOf` (~2386)
- Test: extend `tests/agency-core.test.js`

**Interfaces:**
- Produces: `ULT.resolveLapse(attackPC, defensePC, scale, r, canon, behavior)` — optional 6th arg; nudges applied and PRINTED in `.arith`; `ULT.lootOf(level, prodMult, r, canon, behavior)` — optional 5th arg, honor restraint on `cur`.
- Consumes: `canon.rules.doctrine.lapse` (Task 1). Behavior arrives as a PLAIN object — ULT never calls AXES (standalone-extraction law).

- [ ] **Step 1: Write failing tests** — add to `tests/agency-core.test.js` (reuse its existing `canon` fixture, adding a `rules.doctrine.lapse` block, and its `mk(roll)` fixed-rng helper):

```js
test('N4: cunning nudges p, capped ±0.05, printed in arith', () => {
  const beh = {cunning:100, ferocity:50, honor:50};
  const base = ULT.resolveLapse(500, 500, 'invasion', mk(0.50), canon);
  const nudged = ULT.resolveLapse(500, 500, 'invasion', mk(0.50), canon, beh);
  assert.ok(Math.abs((nudged.p - base.p) - 0.05) < 1e-9, 'cun 100 → p +0.05');
  assert.match(nudged.arith, /cunning 100 → p \+0\.05/);
  assert.strictEqual(base.arith.includes('cunning'), false, 'no behavior → no nudge line');
});

test('N4: ferocity shrinks both margins — decisive both ways', () => {
  // pick a roll where margin sits just outside decisive_margin (0.25): fer 100 shrinks
  // margins by 0.05 → the same roll now lands 'captured' instead of 'sacked'
  const beh = {cunning:50, ferocity:100, honor:50};
  const base = ULT.resolveLapse(600, 400, 'invasion', mk(0.38), canon);      // margin ≈ +0.22 < 0.25 → sacked
  const nudged = ULT.resolveLapse(600, 400, 'invasion', mk(0.38), canon, beh); // dm 0.20 → captured
  assert.strictEqual(base.outcome, 'sacked');
  assert.strictEqual(nudged.outcome, 'captured');
  assert.match(nudged.arith, /ferocity 100/);
});

test('N4: honor restrains sack loot, floored at 0.75', () => {
  const base = ULT.lootOf(4, 1, mk(0.5), canon);
  const restrained = ULT.lootOf(4, 1, mk(0.5), canon, {honor:100});
  assert.strictEqual(restrained.cur, Math.round(base.cur * 0.75));
  const mid = ULT.lootOf(4, 1, mk(0.5), canon, {honor:50});
  assert.strictEqual(mid.cur, base.cur, 'honor ≤50 → no restraint');
});

test('N4: legacy 5-arg resolveLapse calls are byte-identical (no behavior, no lines)', () => {
  const a = ULT.resolveLapse(600, 625, 'invasion', mk(0.60), canon);
  assert.strictEqual(a.outcome, 'repelled_losses');   // the existing N1 pin still holds
});
```

- [ ] **Step 2: Run to verify failures** — `node --test tests/agency-core.test.js` → new tests FAIL (6th arg ignored).

- [ ] **Step 3: Implement** — replace `resolveLapse` and `lootOf`:

```js
  function _doctLapse(canon){return ((canon.rules&&canon.rules.doctrine&&canon.rules.doctrine.lapse)||{});}
  function resolveLapse(attackPC,defensePC,scale,r,canon,behavior){
    var o=U(canon).outcome||{},lm=o.loss_margin||0.25,dm=o.decisive_margin||0.25;
    var p=attackPC/(attackPC+defensePC),lines=[];
    if(behavior){var L=_doctLapse(canon);
      var cun=(behavior.cunning!=null?behavior.cunning:50),fer=(behavior.ferocity!=null?behavior.ferocity:50);
      var dp=(cun-50)*(L.cun_p_per_point!=null?L.cun_p_per_point:0.001);
      if(dp){p=Math.min(0.99,Math.max(0.01,p+dp));lines.push('cunning '+cun+' → p '+(dp>0?'+':'')+dp.toFixed(2));}
      var dmg=(fer-50)*(L.fer_margin_per_point!=null?L.fer_margin_per_point:0.001);
      if(dmg){lm=Math.max(0.05,lm-dmg);dm=Math.max(0.05,dm-dmg);
        lines.push('ferocity '+fer+' → margins '+(dmg>0?'−':'+')+Math.abs(dmg).toFixed(2));}}
    var roll=r(),m=p-roll,outcome;
    if(m<-lm)outcome='repelled';
    else if(m<0)outcome='repelled_losses';
    else if(m<dm||scale==='raid')outcome='sacked';
    else outcome='captured';
    var NAMES={repelled:'REPELLED',repelled_losses:'REPELLED WITH LOSSES',sacked:'SACKED',captured:'CAPTURED'};
    var arith=attackPC+' PC vs '+defensePC+' PC (defender-favored)'+
      (lines.length?' · '+lines.join(' · '):'')+' → p '+p.toFixed(2)+
      ' · roll '+roll.toFixed(2)+' · margin '+(m>=0?'+':'')+m.toFixed(2)+' → '+NAMES[outcome];
    return {outcome:outcome,p:p,roll:roll,margin:m,arith:arith};}
  function lootOf(level,prodMult,r,canon,behavior){
    var L=U(canon).loot||{},base=L.base||15,rpl=L.res_per_level||2,lv=level||1;
    var res={};['Food','Material','Fuel'].forEach(function(k){res[k]=Math.round(rpl*lv*r());});
    var cur=Math.round(base*lv*(prodMult||1)*(0.75+0.5*r()));
    if(behavior&&behavior.honor!=null&&behavior.honor>50){var DL=_doctLapse(canon);
      var per=(DL.honor_loot_per_point!=null?DL.honor_loot_per_point:0.005);
      var mn=(DL.honor_loot_min!=null?DL.honor_loot_min:0.75);
      cur=Math.round(cur*Math.max(mn,1-(behavior.honor-50)*per));}
    return {cur:cur,res:res};}
```

⚠ Note the ORDER pin: `roll=r()` must stay AFTER the nudge computation only if the nudges never consume `r` — they don't (deterministic from behavior). The rng call sequence is unchanged vs N1 → all existing seeded outcomes without behavior stay byte-identical. In `lootOf`, honor scales AFTER both existing `r()` draws for the same reason.

- [ ] **Step 4: Run** — `node --test tests/agency-core.test.js` → PASS (new + all N1 pins); full `node --test` → ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/agency-core.test.js
git commit -m "engine: T-NPC-4 task 4 - lapse personality nudges (cunning/ferocity/honor) printed in arith"
```

---

### Task 5: Glue — behavior stamping, NPC retreat, lapse/tribute wiring

**Files:**
- Modify: `index.html` — `npcRespond` (~4298), `concludeThread` resolution line (~3658 block), lapse call site (~3782–3790), `counterTribute` behavior fallback (~3860)

**Interfaces:**
- Consumes: `THREAD.AXES.rollFor`, `THREAD.shouldRetreat` (Task 2), `ULT.resolveLapse/lootOf` behavior args (Task 4).
- Produces: `state.behavior[side]` stamped lazily; `{kind:'withdrawal'}` outcomes; `_npcFacIdOf(t, side)` helper.

- [ ] **Step 1: Faction resolution helper + lazy stamping.** Above `npcRespond`, add:

```js
/* T-NPC-4: which faction commands a thread's NPC side — mission rows carry t.mFaction;
   otherwise derive from the local NPC force (same source counterTribute uses). */
function _npcFacIdOf(t){
  if(t.mFaction)return t.mFaction;                                   // mission threads (check the actual field name on mission-spawned threads — grep `mFaction\|faction` in acceptMission — and use that)
  var loc=fLoc(t.pl,t.lid);
  var fr=loc?npcForceAt(t.pl,loc.name):null,facN=fr?npcFactionOf(fr.desc):null,fac=facN?facByName(facN):null;
  return fac?fac.id:null;
}
```

In `npcRespond`, right after `var foe=...; if(!foe)return;` insert:

```js
  // T-NPC-4: lazily stamp the NPC side's rolled personality (deterministic off thread id
  // → same roll every reload even pre-persist; covers every seed path incl. legacy saves)
  st.behavior=st.behavior||{};
  if(!st.behavior[foe]){
    var _fid=_npcFacIdOf(t);
    st.behavior[foe]=THREAD.AXES.rollFor(_fid||'none','doctrine:'+t.id,D);
    // placed-NPC override: if the sole co-located placed NPC has authored behavior, its
    // .value axes win (spec §2) — mirror counterTribute's unwrap:
    var _npc=npcsAt(t.pl,t.lid)[0],_nst=_npc&&S.npcState&&S.npcState[_npc.id];
    if(_nst&&_nst.behavior){var _b={};THREAD.AXES.AXIS.forEach(function(ax){
      var v=_nst.behavior[ax]&&_nst.behavior[ax].value;_b[ax]=(v!=null?v:st.behavior[foe][ax]);});
      st.behavior[foe]=_b;}
  }
```

- [ ] **Step 2: NPC retreat routing.** In `npcRespond`, after the stamping block and BEFORE `var block=THREAD.npcTurn(...)`:

```js
  // T-NPC-4 §4/§4a: pragmatic withdrawal — SKIRMISH/INVASION only, never duels/missions
  if((t.type==='SKIRMISH'||t.type==='INVASION')&&!/duel/i.test(t.n||'')&&st.phase==='battle'
     &&THREAD.shouldRetreat(foe,st,D)){
    st.retreatTried=1;
    var _spdMax=function(party){var m=0;for(var id2 in st.combatants){var c2=st.combatants[id2];
      if(c2.party===party&&!c2.dead&&!c2.captured&&c2.x!=null)m=Math.max(m,c2.spd||0);}return m;};
    var who2=bfFoeName(st,foe);
    if(!t.posts)t.posts=[];
    if(_spdMax(foe)>_spdMax(playerParty)){                       // escaped — strictly faster
      for(var id3 in st.combatants){var c3=st.combatants[id3];
        if(c3.party===foe&&!c3.dead&&!c3.captured){c3.fled=1;c3.x=null;c3.y=null;}}
      st.phase='aftermath';
      st.pendingOutcome={kind:'withdrawal',victor:playerParty,defeated:[foe]};
      t.posts.push({who:'THE RECORD',tag:'',stamp:nowStamp(),
        body:'⚑ '+esc(who2)+' breaks contact and quits the field — too swift to run down. The ground is yours: loot the fallen (1 AP each), then END THREAD.'});
    } else {                                                      // caught — cornered, fights on
      t.posts.push({who:'THE RECORD',tag:'',stamp:nowStamp(),
        body:'⚑ '+esc(who2)+' wheels for the perimeter — but you are faster. Cornered, they turn back to the line.'});
    }
    persist();return;                                             // the attempt consumes the turn
  }
```

- [ ] **Step 3: concludeThread withdrawal line.** In `concludeThread`'s resolution-line ternary, add before the default branch:

```js
  :oc.kind==='withdrawal'?'⚑ RESOLUTION — '+(oc.defeated||[]).join(', ')+' quits the field. <b>'+oc.victor+'</b> holds the ground.'
```

- [ ] **Step 4: Lapse + tribute behavior wiring.** At the lapse site (~3782), before `ULT.resolveLapse`, roll the aggressor's behavior and pass it through both calls (`u.faction` below = whatever field the lapse glue already reads for the aggressor faction id — it's in the same function; reuse it verbatim):

```js
  var beh=THREAD.AXES.rollFor(u.faction,'agg:'+u.faction+':'+t.lid,D);
  var res=ULT.resolveLapse(att,def,u.scale,r,D,beh);
  ...
  var loot=ULT.lootOf(l.level,fp.p.prod_mult||1,r,D,beh);
```

In `counterTribute` (~3860), replace the flat-50 fallback so unmet defenders use their faction roll:

```js
 var beh=(rawBeh&&rawBeh.pragmatism&&rawBeh.pragmatism.value!=null)
   ?{pragmatism:rawBeh.pragmatism.value}
   :(defFacId?{pragmatism:THREAD.AXES.rollFor(defFacId,'trib:'+t.id,D).pragmatism}:{pragmatism:50});
```

- [ ] **Step 5: Full suite + syntax proxy** — `node --test` → ALL PASS (incl. `tests/engine-syntax.test.js`).

- [ ] **Step 6: Browser E2E (Playwright MCP, `python3 -m http.server 8765`, `window._noPersist=true` FIRST).** Verify: ① start a SKIRMISH vs a culling-faction NPC force (e.g. on a Drukhari world) — enemy posts show repositioning away + focus-fire on the most wounded model; ② force a retreat: whittle the NPC side past its threshold with a slow player force → "quits the field" post, aftermath loot works, END THREAD concludes with the withdrawal line, thread done; ③ same but with a fast player force → "cornered" post and the battle continues, no second attempt; ④ 0 console errors throughout.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "engine: T-NPC-4 task 5 - behavior stamping, NPC withdrawal via escape rule, lapse/tribute wiring"
```

---

### Task 6: Close-out — style-visibility E2E sweep, docs, backlog

**Files:**
- Modify: `CLAUDE.md` (engine bullet), `BACKLOG.md` (T-NPC-4 row → ready-to-push)

- [ ] **Step 1: Loudness E2E (spec ruling 5 verification).** In the browser, fight one short battle against each style (pick factions: Orks = onslaught, Drukhari = culling, Black Legion = decapitation — use door-demo-free real locations). Confirm each is visibly distinct within 2 enemy posts (onslaught closes hard on nearest; culling kites + hits the weakest; decapitation crosses toward your biggest model). Confirm NO doctrine label appears anywhere in the UI. 0 console errors, all 7 screens swept.
- [ ] **Step 2: Full `node --test`** — final count recorded.
- [ ] **Step 3: CLAUDE.md** — add an engine bullet under the shipped list: personality combat doctrine (styles + conduct + lapse nudges + behavior_matrix), canon version, hidden-doctrine note, tunables flagged.
- [ ] **Step 4: BACKLOG.md** — T-NPC-4 row → `ready-to-push`, list exact paths + commits, note tunables flagged for Daak (retreat curve, honor gates, nudge sizes, all 100 table numbers).
- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md BACKLOG.md
git commit -m "docs: T-NPC-4 built - doctrine live, backlog ready-to-push"
```
