# Front Door + Persistence Backbone — Implementation Plan (T-FD1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the game a title screen and make the full game-state (`S`) survive reloads via a single local profile, so a player founds their own commander and the living-world/galaxy accumulation finally sticks.

**Architecture:** A new pure `/*<save-core>*/` region (`snapshot`/`relink`) is node-tested like the other cores; an impure shell adds a `STORE` adapter (LocalStore now, RemoteStore later), profile ops, a `hydrate()` that reuses `init()`'s existing ref-rebuild, a title-screen overlay, `commitFounding()` to wire the built-but-dead Founding rite, and a Settings screen. `init()` splits into `init()` (canon→profile→title) + `enterShell(S)` (today's post-`demoSave` body, unchanged).

**Tech Stack:** Vanilla ES5-style JS in a single `index.html`; `localStorage`; Node's built-in `node --test` (zero deps); the `vm`-based region-eval test harness in `tests/_load*.js`.

## Global Constraints

- **Baseline:** engine v18 · canon **data v1.11**. This task is **ENGINE-ONLY — zero edits to `heretics-40k-data-v1.json`** (the galaxy agent owns it live).
- **Terminology law:** always **"model"**, never "chassis" — in code, UI copy, comments.
- **🔥 engine lane is HOT:** `index.html` is edited by only ONE `in-progress` task at a time. Do NOT start any engine-lane task below until T-FD1 holds the lane (`in-progress` on the board) and no other engine task does. `tests/**` and `docs/**` work is parallel-safe.
- **Commit hygiene:** `git add <explicit paths>` — **NEVER `git add -A`/`.`**. Never stage `heretics-40k-data-v1.json`. Keep the tree `node --test`-green at every commit.
- **Preserve the tick:** `WORLD.catchUp(S,D,now)` runs once per boot and is idempotent. Do not change its math; only its digest *surfaces* on the title for returning players.
- **Pure core rule:** code inside `/*<save-core>*/` is DOM-free and uses no globals — `S`/canon/roster arrive as arguments (so `tests/_load-save.js` can eval it in the test realm).
- **Every commit message ends with:**
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File structure

- `index.html` — add `/*<save-core>*/` region (near the other cores, after `/*</world-core>*/`); add shell-side `STORE`/profile/`persist`/`hydrate`/`commitFounding`/title/settings; split `init()`→`init()`+`enterShell()`; split `demoSave()`→`foundingWorld()`+Kane fixture.
- `tests/_load-save.js` — **create**; mirror of `tests/_load.js`, extracts the `save-core` region → `SAVE`.
- `tests/save-core.test.js` — **create**; pure tests for `snapshot`/`relink` + a `MockStore` round-trip.

---

## Task 1: SAVE core — `snapshot(S)` (pure serialize)

**Files:**
- Create: `tests/_load-save.js`
- Create: `tests/save-core.test.js`
- Modify: `index.html` (add `/*<save-core>*/` region immediately after the `/*</world-core>*/` line)

**Interfaces:**
- Produces: `SAVE.snapshot(S) → cleanBlob` — a deep, JSON-safe clone of `S` with circular refs removed (`state.combatants[id].model`, `.armour`) and ephemerals dropped (`_digest`). Unknown top-level fields are preserved verbatim (schema-growth-safe).
- Produces: `SAVE.DENY = ['_digest']` (top-level ephemeral denylist).

- [ ] **Step 1: Write the region loader**

Create `tests/_load-save.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Extract the /*<save-core>*/ … /*</save-core>*/ region from index.html and run it
// in THIS realm (mirrors tests/_load.js) so deepStrictEqual sees shared prototypes.
function loadSave() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<save-core>\*\/([\s\S]*?)\/\*<\/save-core>\*\//);
  if (!m) throw new Error('save-core region not found in index.html');
  const SAVE = vm.runInThisContext('(function(){' + m[1] + '\n;return SAVE;})()');
  if (!SAVE) throw new Error('save-core did not define SAVE');
  return SAVE;
}

module.exports = { loadSave };
```

- [ ] **Step 2: Write the failing test**

Create `tests/save-core.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const { loadSave } = require('./_load-save');
const SAVE = loadSave();

// A tiny S with the two things snapshot must handle: a circular combatant.model
// ref back into roster, and an ephemeral _digest.
function fixtureS() {
  const kane = { id: 'kane', n: 'Kane', loadout: { armour: { it: { def: { Physical: 2 } } } } };
  const S = {
    player: { name: 'Kane', faction: 'death_guard' },
    roster: [kane],
    threads: [{ id: 't1', state: { combatants: { kane: { band: 'MELEE', model: kane, armour: { Physical: 2 } } } } }],
    world: { met: ['vess'] },
    time: { epoch: 1000, lastTick: 1000 },
    _digest: { lines: ['ephemeral'] },
    someFutureField: { grown: true },   // schema-growth guard
  };
  return { S, kane };
}

test('snapshot strips the circular combatant.model and .armour refs', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  const c = blob.threads[0].state.combatants.kane;
  assert.strictEqual(c.model, undefined, 'model ref removed');
  assert.strictEqual(c.armour, undefined, 'armour ref removed');
  assert.strictEqual(c.band, 'MELEE', 'other combatant fields kept');
  // must be JSON-safe (no throw, no cycle)
  assert.doesNotThrow(() => JSON.stringify(blob));
});

test('snapshot drops _digest but preserves unknown fields', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  assert.strictEqual(blob._digest, undefined, '_digest dropped');
  assert.deepStrictEqual(blob.someFutureField, { grown: true }, 'unknown field preserved');
});

test('snapshot is a deep clone — mutating the blob does not touch S', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);
  blob.world.met.push('X');
  assert.deepStrictEqual(S.world.met, ['vess'], 'original untouched');
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test tests/save-core.test.js`
Expected: FAIL — `save-core region not found in index.html`.

- [ ] **Step 4: Add the region to `index.html`**

Immediately after the `/*</world-core>*/` line, insert:

```js
/*<save-core>*/
/* Pure, DOM-free save serialization. S/canon arrive as arguments; no globals, no localStorage.
   snapshot() = S → JSON-safe clone minus circular refs + ephemerals. relink() (Task 2) is the inverse. */
var SAVE=(function(){
  var DENY=['_digest'];                       // top-level ephemerals never persisted
  function clone(v){                          // structural deep clone (JSON-safe input only)
    if(v===null||typeof v!=='object')return v;
    if(Array.isArray(v))return v.map(clone);
    var o={};for(var k in v){if(Object.prototype.hasOwnProperty.call(v,k))o[k]=clone(v[k]);}return o;
  }
  function snapshot(S){
    var out={};
    for(var k in S){ if(!Object.prototype.hasOwnProperty.call(S,k))continue;
      if(DENY.indexOf(k)>=0)continue;         // drop ephemerals
      out[k]=clone(S[k]); }
    // strip circular refs that relink() rebuilds from roster
    (out.threads||[]).forEach(function(t){
      if(t&&t.state&&t.state.combatants){
        Object.keys(t.state.combatants).forEach(function(id){
          var c=t.state.combatants[id]; if(c){ delete c.model; delete c.armour; }
        });
      }
    });
    return out;
  }
  return { DENY:DENY, snapshot:snapshot };
})();
/*</save-core>*/
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test tests/save-core.test.js`
Expected: PASS (3/3).

- [ ] **Step 6: Run the full suite (nothing else broke)**

Run: `node --test`
Expected: all green (the new region is inert until wired).

- [ ] **Step 7: Commit**

```bash
git add tests/_load-save.js tests/save-core.test.js index.html
git commit -m "save-core: pure snapshot() — strip circular refs + ephemerals (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: SAVE core — `relink(S)` (pure ref-rebuild)

**Files:**
- Modify: `index.html` (`/*<save-core>*/` region — add `relink`)
- Modify: `tests/save-core.test.js` (add relink tests)

**Interfaces:**
- Consumes: `SAVE.snapshot` (Task 1).
- Produces: `SAVE.relink(S) → S` — for every `state.combatants[id]`, re-attach `.model` = the roster model whose `id===id`, and `.armour` = that model's `loadout.armour.it.def` (or `null`). Mutates and returns `S`. Pure (no globals/DOM). This is the circular half of hydration; the full shell `hydrate()` (Task 5) also runs `migrateLoadout`/`THREAD.create` around it.

- [ ] **Step 1: Write the failing test**

Append to `tests/save-core.test.js`:

```js
test('relink re-attaches combatant.model from roster by id, and armour def', () => {
  const { S } = fixtureS();
  const blob = SAVE.snapshot(S);                 // refs stripped
  // simulate a fresh load: blob is the persisted S with no combatant.model
  const loaded = JSON.parse(JSON.stringify(blob));
  SAVE.relink(loaded);
  const c = loaded.threads[0].state.combatants.kane;
  assert.strictEqual(c.model, loaded.roster[0], 'model re-points at the roster instance');
  assert.deepStrictEqual(c.armour, { Physical: 2 }, 'armour def rebuilt from loadout');
});

test('relink tolerates a combatant with no matching roster id', () => {
  const loaded = { roster: [], threads: [{ state: { combatants: { ghost: { band: 'LONG' } } } }] };
  assert.doesNotThrow(() => SAVE.relink(loaded));
  assert.strictEqual(loaded.threads[0].state.combatants.ghost.model, undefined);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/save-core.test.js`
Expected: FAIL — `SAVE.relink is not a function`.

- [ ] **Step 3: Add `relink` to the region**

Inside the `save-core` IIFE, before the `return`, add:

```js
  function relink(S){
    var roster=S.roster||[];
    (S.threads||[]).forEach(function(t){
      if(!t||!t.state||!t.state.combatants)return;
      Object.keys(t.state.combatants).forEach(function(id){
        var c=t.state.combatants[id]; if(!c)return;
        var m=null;for(var i=0;i<roster.length;i++){if(roster[i].id===id){m=roster[i];break;}}
        if(m){ c.model=m;
          var a=m.loadout&&m.loadout.armour&&m.loadout.armour.it;
          c.armour=a?a.def:null; }
      });
    });
    return S;
  }
```

And update the return line to expose it:

```js
  return { DENY:DENY, snapshot:snapshot, relink:relink };
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/save-core.test.js`
Expected: PASS (5/5).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/save-core.test.js
git commit -m "save-core: pure relink() — rebuild combatant model/armour refs from roster (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: STORE adapter + profile ops + `persist()` (shell)

**Files:**
- Modify: `index.html` (add shell-side code near the existing `LS_NPC` block, ~line 867)
- Modify: `tests/save-core.test.js` (MockStore round-trip — proves the adapter contract)

**Interfaces:**
- Consumes: `SAVE.snapshot` (Task 1).
- Produces (shell, not in the pure region):
  - `LocalStore = { get(k)→obj|null, set(k,obj), del(k), keys()→[k] }` — JSON per key over `localStorage`, all wrapped in try/catch.
  - `STORE` = `LocalStore` (the swap point; `RemoteStore` replaces this later).
  - `PROFILE_KEY='heretics_profile_v1'`.
  - `hasProfile()→bool`, `loadProfile()→blob|null`, `saveProfile(S)`, `clearProfile()`.
  - `persist()` — debounced (800ms) `saveProfile(S)` of the active `S`; plus a `beforeunload` flush.

- [ ] **Step 1: Write the failing test (adapter contract, in-realm MockStore)**

Append to `tests/save-core.test.js`:

```js
test('a snapshot round-trips through an in-memory store unchanged', () => {
  const { S } = fixtureS();
  const mem = {};
  const MockStore = {
    get: (k) => (k in mem ? JSON.parse(mem[k]) : null),
    set: (k, o) => { mem[k] = JSON.stringify(o); },
    del: (k) => { delete mem[k]; },
    keys: () => Object.keys(mem),
  };
  MockStore.set('heretics_profile_v1', SAVE.snapshot(S));
  const back = MockStore.get('heretics_profile_v1');
  assert.strictEqual(back.player.name, 'Kane');
  assert.strictEqual(back.threads[0].state.combatants.kane.model, undefined);
  assert.deepStrictEqual(MockStore.keys(), ['heretics_profile_v1']);
});
```

- [ ] **Step 2: Run to verify it passes** (this test only exercises Task 1's `snapshot` + a local mock — it should PASS immediately, locking the adapter method shape)

Run: `node --test tests/save-core.test.js`
Expected: PASS (6/6).

- [ ] **Step 3: Add the shell STORE + profile ops to `index.html`**

Immediately BEFORE the `var LS_NPC='heretics_npc_state_v1';` line, insert:

```js
/* ---- persistence shell (impure: localStorage; CALLS the pure SAVE core) ---- */
var PROFILE_KEY='heretics_profile_v1';
var LocalStore={
  get:function(k){try{var r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch(e){return null;}},
  set:function(k,o){try{localStorage.setItem(k,JSON.stringify(o));return true;}catch(e){return false;}},
  del:function(k){try{localStorage.removeItem(k);}catch(e){}},
  keys:function(){try{var a=[];for(var i=0;i<localStorage.length;i++)a.push(localStorage.key(i));return a;}catch(e){return [];}}
};
var STORE=LocalStore;                    // swap point: RemoteStore drops in here later
function hasProfile(){return !!STORE.get(PROFILE_KEY);}
function loadProfile(){return STORE.get(PROFILE_KEY);}
function saveProfile(s){return STORE.set(PROFILE_KEY,SAVE.snapshot(s||S));}
function clearProfile(){STORE.del(PROFILE_KEY);}
var _persistT=null;
function persist(){ if(_persistT)clearTimeout(_persistT);
  _persistT=setTimeout(function(){_persistT=null;saveProfile(S);},800); }
try{window.addEventListener('beforeunload',function(){if(S&&S.player)saveProfile(S);});}catch(e){}
```

- [ ] **Step 4: Run the full suite**

Run: `node --test`
Expected: all green (shell code is inert until Task 5 calls it; the boot proxy still compiles the inline script — verifies no syntax error).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/save-core.test.js
git commit -m "save: LocalStore adapter + single-profile ops + debounced persist() (shell)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Split `demoSave()` → `foundingWorld()` + Kane fixture

**Files:**
- Modify: `index.html` (`demoSave()` ~line 977)

**Interfaces:**
- Produces: `foundingWorld()` → the faction-agnostic **starting world** object `{ met, stats, log, forces, history, … }` — exactly the `world:` sub-object `demoSave()` returns today. Any new commander drops into it.
- `demoSave()` is kept intact (now building its `world:` from `foundingWorld()`) as a **test/dev fixture only** — it is no longer on the boot path after Task 5.

- [ ] **Step 1: Extract the world object**

In `index.html`, locate the `world:{ … }` literal inside `demoSave()`'s returned object (starts `world:{` with `met:[…]`, `stats:{…}`, `log:[]`, `forces:{…}`, `history:{…}`). Cut that entire object value and define, immediately ABOVE `function demoSave(){`:

```js
/* the shared Pass-1 starting sector — any new commander drops in here (Pass 2: per-faction homeworlds) */
function foundingWorld(){return { /* …the exact object literal previously inline in demoSave().world… */ };}
```

Then in `demoSave()`, replace the inline `world:{…}` with `world:foundingWorld(),`.

- [ ] **Step 2: Verify no behavior change**

Run: `node --test`
Expected: all green (the boot-syntax proxy compiles; `demoSave()` returns an identical shape).

- [ ] **Step 3: Browser smoke (lane held)**

Serve locally (`python3 -m http.server 8765`) and load `localhost:8765`. Expected: game boots exactly as before (demo still loads via current `init()`), 0 console errors. *(This is the last commit where boot is unchanged.)*

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "save: extract foundingWorld() from demoSave() (no behavior change)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Split `init()` → `init()` + `enterShell(S)` + `hydrate()`

**Files:**
- Modify: `index.html` (`init()` ~lines 1966–2001)

**Interfaces:**
- Consumes: `SAVE.relink` (Task 2), `hasProfile`/`loadProfile`/`saveProfile`/`persist` (Task 3), `foundingWorld` (Task 4), `WORLD.catchUp`/`WORLD.digest` (existing).
- Produces:
  - `hydrate(blob) → S` — `S=blob`; run the SAME rebuild the old `init()` did: `migrateLoadout` per roster model, `THREAD.create` per thread, then `SAVE.relink(S)`; returns `S` ready for `WORLD.catchUp`.
  - `enterShell(S)` — everything the old `init()` did AFTER the `S=demoSave()` + rebuild block (the `enrichRoster()…renderDigest()` tail, incl. the `boot→shell` show-hide). Assumes `S` is already hydrated + ticked.
  - `init()` — canon-ready → nothing else yet (title wiring comes in Task 6). For now: `if(hasProfile()){S=hydrate(loadProfile());var _wc=WORLD.catchUp(S,D,Date.now());S._digest=_wc.ticks>0?WORLD.digest(_wc.events):null;} else {S=demoSave();/*temporary until Task 6/7*/ …rebuild… } enterShell(S);` — see Step 1. (Task 6 replaces the else-branch with the title screen.)

- [ ] **Step 1: Refactor**

Replace the whole `function init(){ … }` (lines ~1966–2001) with:

```js
/* rebuild a loaded/created S's live refs — mirrors the old init() sequence exactly */
function hydrate(blob){
  S=blob;
  S.roster.forEach(function(m){migrateLoadout(m,S.player.faction);});
  S.threads=(S.threads||[]).map(function(t){return THREAD.create(t,D)});
  SAVE.relink(S);
  return S;
}
function init(){
  if(hasProfile()){
    hydrate(loadProfile());
    S.time=S.time||{epoch:Date.now(),blockMinutes:(D.time&&D.time.block_minutes)||60};
    if(S.time.lastTick===undefined)S.time.lastTick=S.time.epoch||Date.now();
    var _wc=WORLD.catchUp(S,D,Date.now());
    S._digest=(_wc.ticks>0)?WORLD.digest(_wc.events):null;
  } else {
    hydrate(demoSave());            // TEMP: replaced by the title screen in Task 6
    S.time=S.time||{epoch:Date.now(),blockMinutes:(D.time&&D.time.block_minutes)||60};
    if(S.time.lastTick===undefined)S.time.lastTick=S.time.epoch;
  }
  enterShell(S);
}
function enterShell(S){
  enrichRoster();fixLeaderTags();mkOverview();initTips();mkEntity();mkHUD();mkCart();
  S.active=S.active||'kane';S.cart=S.cart||[];
  seedNPCState();
  var f=fPl(S.pos.pl);MV={lv:'sector',seg:f.g.id,sec:f.s.id,pl:S.pos.pl,lc:S.pos.sp};
  document.getElementById('rname').textContent=S.player.name.split(',')[0];
  document.getElementById('rdata').textContent='Canon: '+D.meta.format+' v'+D.meta.version;
  CLASSES().forEach(function(c){document.getElementById('fc').add(new Option(c,c))});
  var ff=document.getElementById('ff');S.forces.forEach(function(fo){ff.add(new Option(fo.n,fo.n))});ff.add(new Option('— direct command','—'));
  ['fq','fc','fs','ff'].forEach(function(i){document.getElementById(i).addEventListener('input',rRos)});
  document.querySelectorAll('.navbtn').forEach(function(b){b.onclick=function(){go(b.dataset.s)}});
  document.querySelectorAll('.tab').forEach(function(b){b.onclick=function(){document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('on',x===b)});document.querySelectorAll('.sub').forEach(function(v){v.classList.remove('on')});document.getElementById('b-'+b.dataset.b).classList.add('on');if(b.dataset.b==='forces')rF();if(b.dataset.b==='armoury')rArm()}});
  mkPicker();mkRite();
  document.getElementById('boot').style.display='none';
  document.getElementById('shell').style.display='flex';
  rHQ();rRos();rLoad();rMap();rTL();rComms();rShop();
  var _gear=E('button','btn gh sm','⚙ AI');_gear.style.cssText='position:fixed;right:12px;bottom:12px;z-index:60';_gear.onclick=openSettings;document.body.appendChild(_gear);
  saveProfile(S);          // first write so a demo/founded session persists
  renderDigest();
}
```

> Note: the old `init()`'s `loadNPC()`/`saveNPC()` lines are dropped — `npcState`+`time` now persist inside the profile (Task 3). `seedNPCState()` still seeds minds for met NPCs.

- [ ] **Step 2: Full suite**

Run: `node --test`
Expected: green (boot-syntax proxy compiles the new `init`/`enterShell`/`hydrate`).

- [ ] **Step 3: Browser verify — persistence works end-to-end**

Serve + load. First load: demo world appears (no profile yet), and `saveProfile` writes one. Reload: `hasProfile()` true → `hydrate(loadProfile())` path runs → same state returns. In devtools: `localStorage['heretics_profile_v1']` exists; `S.threads[0].state.combatants` have live `.model` again. Back-date `localStorage`, set `S.time.lastTick` back 2 days via a quick eval, reload → catch-up digest still fires. 0 console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "save: split init→init+enterShell+hydrate — full-S profile persistence live

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Title screen overlay + wire CONTINUE + digest-on-title

**Files:**
- Modify: `index.html` — add `#title` markup near `#boot` (~line 342); add `showTitle()`/`renderTitleDigest()`; change `init()` to show the title instead of auto-entering.

**Interfaces:**
- Consumes: `hasProfile`/`loadProfile`, `hydrate`, `WORLD.catchUp`/`digest`, `enterShell`, `commitFounding` (Task 7 — reference by name; until Task 7 lands, `NEW COMMANDER` calls the existing `document.getElementById('r-found').onclick` path).
- Produces: `showTitle()` — builds/reveals the title overlay with rows gated by `hasProfile()`; `CONTINUE`→`enterShell(S)`; `NEW COMMANDER`→founding flow; digest banner from `S._digest`.

- [ ] **Step 1: Add the title markup**

Immediately AFTER the `<div id="boot">…</div>` line, add:

```html
<div id="title" style="display:none;position:fixed;inset:0;background:var(--void);z-index:90;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px">
  <h1 style="color:var(--brh);letter-spacing:.18em;font-size:26px;margin-bottom:6px">HERETICS 40K</h1>
  <div style="color:var(--dim);font-size:11px;letter-spacing:.2em;margin-bottom:22px">▓ THE LONG WAR ▓</div>
  <div id="titlemenu" style="display:flex;flex-direction:column;gap:10px;min-width:280px"></div>
  <div id="titledigest" style="max-width:360px;margin-top:20px;color:var(--brh);font-size:11px;line-height:1.6"></div>
  <div style="color:var(--dim);font-size:10px;margin-top:22px">local sandbox · saved to this browser</div>
</div>
```

- [ ] **Step 2: Add `showTitle()` and change `init()`**

Replace the body of `init()` from Task 5 with a version that stops before `enterShell` and shows the title:

```js
function init(){
  if(hasProfile()){
    hydrate(loadProfile());
    S.time=S.time||{epoch:Date.now(),blockMinutes:(D.time&&D.time.block_minutes)||60};
    if(S.time.lastTick===undefined)S.time.lastTick=S.time.epoch||Date.now();
    var _wc=WORLD.catchUp(S,D,Date.now());
    S._digest=(_wc.ticks>0)?WORLD.digest(_wc.events):null;
  }
  document.getElementById('boot').style.display='none';
  showTitle();
}
function showTitle(){
  var t=document.getElementById('title');t.style.display='flex';
  var menu=document.getElementById('titlemenu');menu.innerHTML='';
  function row(label,sub,fn){var b=E('button','btn bl','<b>'+label+'</b>'+(sub?' <span style="opacity:.6;font-size:11px">'+sub+'</span>':''));b.style.textAlign='left';b.onclick=fn;menu.appendChild(b);}
  if(hasProfile()){
    var p=S.player;
    row('CONTINUE', (p.name.split(',')[0])+' · '+FAC(p.faction).name+' · R'+(p.cmdRank||1), function(){t.style.display='none';enterShell(S);});
  }
  row('NEW COMMANDER','found a lineage',function(){
    if(hasProfile()&&!confirm('This replaces your current commander ('+S.player.name.split(',')[0]+'). Export your save first from Settings if you want to keep them. Continue?'))return;
    t.style.display='none';document.getElementById('r-found').click();   // Task 7 swaps this for commitFounding
  });
  row('SETTINGS','AI · saves · about',function(){openSettings();});
  var dg=document.getElementById('titledigest');
  dg.innerHTML=(hasProfile()&&S._digest&&S._digest.lines.length)
    ? '⚠ while you were away —<br>'+S._digest.lines.map(function(l){return '· '+l;}).join('<br>') : '';
}
```

- [ ] **Step 3: Browser verify**

Serve + load. **First run** (clear `localStorage` first): title shows `NEW COMMANDER` + `SETTINGS` only (no CONTINUE). **Returning** (after a founded/demo save exists): title shows `CONTINUE <name…>` + `NEW COMMANDER` + `SETTINGS`; back-date `lastTick` → the "while you were away" banner renders under CONTINUE. CONTINUE → shell loads. 0 console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "save: title screen — CONTINUE + digest-on-title + first-run gating

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `commitFounding(cc)` — wire the Founding rite to spawn a real profile

**Files:**
- Modify: `index.html` — `rNext()` Founding finish (~line 1889–1890); add `commitFounding(cc)`; point title `NEW COMMANDER` at it.

**Interfaces:**
- Consumes: the existing `RS.cc` shape + the step-6 profile math (index.html ~1865–1871), `foundingWorld` (Task 4), `saveProfile`/`hydrate`/`enterShell`.
- Produces: `commitFounding(cc) → void` — builds a fresh `S` (commander model + 2 founding-force base models from the faction roster + a Force led by the commander + starting economy + `pos` at the alpha start + `world:foundingWorld()` + fresh `time`), `saveProfile(S)`, then `enterShell(S)`.

- [ ] **Step 1: Add `commitFounding`**

Add near `rNext` (reuse the exact step-6 derivation for the commander's `w/sp/sl/cur/tags`):

```js
function commitFounding(cc){
  var A=AK[cc.al],F=FACS(A)[cc.fa],m=F.models[cc.md];
  var cd=D.rules.deltas.commander[m.cls]||{w:0,sp:0,sl:0};
  var w=m.w+cd.w,sp=m.sp+cd.sp,sl=m.sl+cd.sl,eco=D.rules.economy.founding_start,cur=eco.currency,tags=['Leader','Commander'];
  cc.pk.forEach(function(i){var fx=F.origin_perks[i][1];if(fx==='w')w++;if(fx==='sp')sp++;if(fx==='sl')sl++;if(fx==='cur')cur+=250;if(fx==='psy')tags.push('Psyker');if(fx==='dem')tags.push('DEMON');});
  var cmdrPc=Math.round(m.pc*D.rules.premiums.commander_pc_multiplier);
  var slots=[];for(var i=0;i<sl;i++)slots.push({type:null,it:null});
  var commander={id:'cmdr',n:cc.nm.trim(),tag:'Commander',cls:m.cls,rk:1,pc:cmdrPc,w:w+'/'+w,st:'GARRISON',loc:'—',fo:'The Founding',sub:m.n+' - R1 - '+sl+' slots',spd:sp,loadout:{slots:slots,armour:null}};
  // two rank-1 base models from the faction roster (skip the chosen commander model) → a starter Force
  var base=F.models.filter(function(x,ix){return ix!==cc.md;}).slice(0,2).map(function(bm,ix){
    return {id:'fm'+ix,n:bm.n+' '+(ix+1),tag:'',cls:bm.cls,rk:1,pc:bm.pc,w:bm.w+'/'+bm.w,st:'GARRISON',loc:'—',fo:'The Founding',sub:bm.n+' - R1',spd:bm.sp,loadout:{slots:[{type:null,it:null}],armour:null}};
  });
  S={
    player:{name:cc.nm.trim(),allegiance:A,faction:F.id,model:m.n,cmdRank:1,mdlRank:1,w:w+'/'+w,xp:'0/40'},
    pos:{pl:'vigilus',sp:'ashravine'},           // Pass 2: seed faction homeworld
    cur:cur,infl:eco.influence,dom:eco.dominance,army:0,
    roster:[commander].concat(base),
    forces:[{id:'founding',n:'The Founding',lead:'cmdr',ap:26}],
    succ:[{n:commander.n,fid:'founding'}],
    threads:[], world:foundingWorld(),
    time:{epoch:Date.now(),blockMinutes:(D.time&&D.time.block_minutes)||60,lastTick:Date.now()},
    npcState:{}, active:'cmdr', cart:[]
  };
  S.roster.forEach(function(mm){migrateLoadout(mm,F.id);});
  saveProfile(S);
  T(commander.n+' is founded. The saga begins.');
  enterShell(S);
}
```

- [ ] **Step 2: Fire it from the rite finish**

In `rNext()`, the Founding branch's final step currently ends with:
`RB.classList.remove('on');T(c.nm.trim()+' awakens. The first thread begins.');go('threads');return}}`
Replace that success tail with:
`RB.classList.remove('on');commitFounding(c);return}}`

- [ ] **Step 3: Point the title at the rite (unchanged click is fine)**

`NEW COMMANDER` already calls `document.getElementById('r-found').click()` (Task 6) which opens the Founding wizard; on finish it now runs `commitFounding`. No further change needed.

- [ ] **Step 4: Browser verify — the onramp**

Clear `localStorage`. Load → title shows NEW COMMANDER only → click → Founding wizard → complete all 7 steps with a NON-Death-Guard faction → on finish, a NEW profile with YOUR commander + a 2-model "The Founding" force enters HQ. Reload → CONTINUE shows your commander, not Kane. Check Barracks/Forces populated. 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "save: commitFounding() — Founding rite now spawns a real saved commander

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Settings screen (AI moved in + save management + about)

**Files:**
- Modify: `index.html` — upgrade `openSettings()`/the settings overlay (the existing `ENT`/`aikey`/`aimodel` block ~lines 826–839 area) to a tabbed panel.

**Interfaces:**
- Consumes: `aiKey`/`aiModel` (existing), `SAVE.snapshot`, `saveProfile`/`clearProfile`/`hydrate`/`showTitle`, `PROFILE_KEY`/`STORE`.
- Produces: an upgraded settings overlay with three groups: **AI** (existing key/model, unchanged behavior), **Save** (Export JSON download, Import JSON, Delete profile, Return to title), **About** (canon/engine version + links).

- [ ] **Step 1: Add Save-management helpers**

Add near the persistence shell (Task 3):

```js
function exportSave(){
  if(!hasProfile()){T('No save to export.');return;}
  var blob=STORE.get(PROFILE_KEY),name=(blob.player&&blob.player.name||'commander').split(',')[0].replace(/\W+/g,'_');
  var a=document.createElement('a');
  a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(blob,null,2));
  a.download='heretics_'+name+'.json';document.body.appendChild(a);a.click();a.remove();
}
function importSaveText(txt){
  try{var blob=JSON.parse(txt);
    if(!blob||!blob.player||!blob.roster)throw new Error('not a Heretics save');
    STORE.set(PROFILE_KEY,blob);T('Save imported. Reloading…');location.reload();
  }catch(e){T('Import failed: '+e.message);}
}
function deleteProfile(){ if(!confirm('Permanently delete this commander from this browser?'))return;
  clearProfile();T('Save deleted.');location.reload(); }
```

- [ ] **Step 2: Extend `openSettings()`**

Augment the existing settings overlay body (which today holds `aikey`/`aimodel`/`aisave`/`aiclear`) by appending a Save section and About section, and wiring:

```js
// inside openSettings(), after the AI controls are built, append:
var save=E('div','card','<h3>Save</h3>');
var xp=E('button','btn gh sm','⬇ Export save');xp.onclick=exportSave;
var im=E('button','btn gh sm','⬆ Import save');var fi=E('input');fi.type='file';fi.accept='.json';fi.style.display='none';
im.onclick=function(){fi.click();};fi.onchange=function(){var f=fi.files[0];if(!f)return;var r=new FileReader();r.onload=function(){importSaveText(r.result);};r.readAsText(f);};
var del=E('button','btn bl sm','✕ Delete profile');del.onclick=deleteProfile;
var ret=E('button','btn gh sm','⌂ Return to title');ret.onclick=function(){ENT.classList.remove('on');saveProfile(S);location.reload();};
[xp,im,fi,del,ret].forEach(function(el){save.appendChild(el);});
var about=E('div','card','<h3>About</h3><div style="font-size:11px;color:var(--dim)">Canon '+D.meta.version+' · engine v18 · local sandbox. <a href="https://dk96-gtm.github.io/heretics-40k/" style="color:var(--brh)">live</a></div>');
ENT.querySelector('.rite,.card,div').appendChild(save);   // append into the settings body container
ENT.querySelector('.rite,.card,div').appendChild(about);
```

> Adjust the final two `appendChild` targets to the actual settings-body element id used by `openSettings()` (inspect the existing overlay markup when implementing; the existing `aikey` input's parent is the body).

- [ ] **Step 3: Browser verify**

Open Settings from the floating gear AND from the title. AI key still saves/clears as before. Export downloads a JSON with your commander. Import of that file reloads into the same commander. Delete profile → reload → title shows first-run (NEW COMMANDER only). Return to title → title screen. 0 console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "save: Settings screen — export/import/delete profile + return-to-title + about

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Retire legacy `LS_NPC`, final verification, mark ready-to-push

**Files:**
- Modify: `index.html` — remove `saveNPC()`/`loadNPC()` calls left unused; one-time absorb of an old `LS_NPC` blob.

- [ ] **Step 1: One-time migration of an old LS_NPC**

In `init()`, in the `else`/first-run path (no profile yet), before showing the title, absorb any legacy blob so returning demo players keep their NPC memory once:

```js
if(!hasProfile()){var _old=null;try{_old=JSON.parse(localStorage.getItem('heretics_npc_state_v1'));}catch(e){}
  if(_old){/* seeds absorbed on first founded/entered save; safe to ignore if absent */}}
```

Remove the now-unused `saveNPC()` definition and any remaining call sites (search `saveNPC(`/`loadNPC(`); NPC state now round-trips through the profile. Keep `LS_KEY`/`LS_MODEL` (AI settings are separate, intentionally not part of the game save).

- [ ] **Step 2: Full regression**

Run: `node --test`
Expected: all green. Then browser: found a new commander → play (buy gear, move on map) → reload → everything persists → open a combat thread → deploy → reload mid-thread → thread + grid state survive. 0 console errors on every screen.

- [ ] **Step 3: Commit + mark ready-to-push**

```bash
git add index.html
git commit -m "save: retire legacy LS_NPC (npcState now rides the profile save)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Then edit `BACKLOG.md` T-FD1 row → status `ready-to-push`, list the commits; `git add BACKLOG.md` (explicit) → commit `backlog: T-FD1 ready-to-push`. **Do not push** — Daak pushes.

---

## Self-review — spec coverage

- Title screen (plain-verb/grimdark, CONTINUE/NEW/SETTINGS, first-run gating) → Task 6 ✓
- Digest-on-title (living dashboard) → Task 6 ✓
- Single active profile + full-S persist (snapshot/relink/STORE/persist) → Tasks 1–3, 5 ✓
- Storage-adapter seam (LocalStore/STORE swap point) → Task 3 ✓
- Founding rite → real profile (commitFounding, starter Force) → Task 7 ✓
- Settings (AI moved + export/import/delete/return-to-title + about) → Task 8 ✓
- Demo retired; foundingWorld() as shared start → Tasks 4, 7 ✓
- Boot reseq preserves idempotent WORLD.catchUp→digest → Task 5 ✓ (digest surfaces on title, Task 6)
- Unify/retire legacy LS_NPC → Task 9 ✓
- Overwrite guard on NEW COMMANDER → Task 6 ✓
- Corruption/quota safety → Task 3 (try/catch STORE) ✓; Import validation → Task 8 ✓
- Engine-only, no canon; explicit-path commits; tree green each pause → Global Constraints, every task ✓

**Deferred (sequel spec):** RemoteStore/online, per-faction homeworlds, NPC-grid combat, multiple profiles.
