# Free-Form Slots + Armour System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed typed slots with a fully free-form loadout (player assigns each slot's type, then equips) and add a per-model hard Armour slot driving per-element damage mitigation, sold at a new Armoury door and hardened at the Forge, with a galaxy-wide armour catalog.

**Architecture:** Two-file game (`heretics-40k-data-v1.json` = canon, `index.html` = engine). Rules live in a pure DOM-free `/*<thread-core>*/` region unit-tested with `node --test`; this plan adds a sibling `/*<loadout-core>*/` region. Combat damage is applied in `thread-core` `apply()` — armour mitigation slots in there. Save-state `S` is the demo game state; models migrate from `m.sl` to `m.loadout = {slots, armour}`.

**Tech Stack:** Vanilla JS (single HTML file), JSON canon, Node built-in test runner (zero deps), `md-to-pdf` for docs. No build step. Served over HTTP (`python3 -m http.server 8765`).

## Global Constraints

- Terminology law: always **"model"**, never "chassis" — in all code, copy, data.
- Canon changes bump `meta.version`; this feature ships **v1.7**. Engine-only changes never touch canon.
- Elements are exactly: `Physical, Heat, Warp, Corrosive, Plasma, Energy`.
- Model classes are exactly: `Core, Assault, Flying, Armament`.
- `tests/` is dev-only, never shipped. Only `index.html` + the JSON deploy.
- Every iteration is a git commit. Browser-verify (0 JS errors, screens exercised) before the final commit. **The assistant commits; the user pushes** (`git push` is gated).
- Pure regions read NO globals — canon and state arrive as arguments.
- The approved catalog data is at `docs/superpowers/specs/2026-07-19-armour-catalog.json` (143 pieces).

---

### Task 1: Canon v1.7 rules scaffolding

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version`, `rules.growth`, new `rules.loadout`, `rules.armour`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: `canon.rules.growth.slot_gains_by_rank[cls]` → `number[5]` (cumulative slots gained over base, index = rank−1); `canon.rules.loadout` (doc block); `canon.rules.armour.elements` → `string[6]`, `canon.rules.armour.mitigation` (formula doc), `canon.rules.armour.default_by_faction_class` (bool doc).

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('v1.7: numeric slot growth is present for every class', () => {
  const g = canon.rules.growth.slot_gains_by_rank;
  ['Core','Assault','Flying','Armament'].forEach(c => {
    assert.ok(Array.isArray(g[c]) && g[c].length === 5, `${c} slot growth`);
    assert.strictEqual(g[c][0], 0, `${c} rank 1 gains 0`);
  });
  assert.strictEqual(g.Armament[4], 4, 'Armament gains a slot every rank');
});
test('v1.7: armour rules block exists with 6 elements', () => {
  assert.strictEqual(canon.meta.version, '1.7');
  assert.deepStrictEqual(canon.rules.armour.elements,
    ['Physical','Heat','Warp','Corrosive','Plasma','Energy']);
  assert.ok(/max\(0/.test(canon.rules.armour.mitigation));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL (`canon.rules.growth.slot_gains_by_rank` undefined / version mismatch).

- [ ] **Step 3: Edit canon.** Set `meta.version` to `"1.7"`. Under `rules.growth` add:

```json
"slot_gains_by_rank": {
  "Core":     [0,1,1,2,2],
  "Assault":  [0,1,1,2,2],
  "Flying":   [0,1,1,2,2],
  "Armament": [0,1,2,3,4]
}
```

Add a new `rules.loadout`:

```json
"loadout": {
  "model": "Free-form universal slots. A model has (base sl + slot_gains_by_rank[class][rank-1]) GENERAL slots plus one separate hard ARMOUR slot. The player assigns each general slot a type (Weapon/Item/Ability/Warp Cast), then equips a matching item. Any slot may take any type — no psyker gate, no reserved legendary slot. Re-typing/equipping is allowed only while the model is NOT in an active thread.",
  "slot_types": ["WEAPON","ITEM","ABILITY","CAST"],
  "armour_slot": "Every model has one extra hard Armour slot, always present, outside the general budget; holds only cat:ARMOUR. Pre-filled with a class+faction default."
}
```

Add a new `rules.armour`:

```json
"armour": {
  "elements": ["Physical","Heat","Warp","Corrosive","Plasma","Energy"],
  "mitigation": "Per hit: taken = max(0, dealt - def[element]). Floored at 0, so heavy armour can fully turn a weak hit. Applied per hit (multi-hit resolves each hit separately). The killing element still sets the revival window.",
  "corrosive_note": "There is no hardcoded bypass rule. Corrosive-bypass is expressed as data: most armour carries a low or 0 Corrosive defense.",
  "default_by_faction_class": true,
  "tiers": ["default","light","medium","heavy"]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.7: free-form loadout + armour rules + numeric slot growth"
```

---

### Task 2: Bake the armour catalog into canon

**Files:**
- Modify: `heretics-40k-data-v1.json` (new top-level `armour`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: `canon.armour` → array of `{faction:string|null, cls:string|null, tier:string, n:string, pc:number, def:{6 elements}, d:string}`.

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('armour catalog: 143 pieces, valid shape, every element present', () => {
  const A = canon.armour;
  assert.ok(Array.isArray(A) && A.length === 143, `got ${A && A.length}`);
  const ELEMS = ['Physical','Heat','Warp','Corrosive','Plasma','Energy'];
  A.forEach(p => {
    ELEMS.forEach(e => assert.strictEqual(typeof p.def[e], 'number', `${p.n} ${e}`));
    assert.ok(typeof p.pc === 'number' && p.n && p.tier);
  });
  // every faction+class default exists: 20 factions x 4 classes = 80 defaults
  const defaults = A.filter(p => p.tier === 'default' && p.faction);
  assert.strictEqual(defaults.length, 80, `defaults ${defaults.length}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js`
Expected: FAIL (`canon.armour` undefined).

- [ ] **Step 3: Insert the catalog.** Copy the array from `docs/superpowers/specs/2026-07-19-armour-catalog.json` verbatim as a new top-level `"armour"` key in the canon JSON. (It is already validated: 80 faction defaults + 60 ladder + 3 universal = 143.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.7: bake 143-piece galaxy-wide armour catalog"
```

---

### Task 3: Armoury door + Forge armour-upgrade rule (canon)

**Files:**
- Modify: `heretics-40k-data-v1.json` (`galaxy.doors`, two `galaxy.location_types[].doors`, `equipment_alpha.forge_rules`)
- Test: `tests/canon.test.js`

**Interfaces:**
- Produces: a `galaxy.doors` entry `{kind:"armoury", ...}`; `equipment_alpha.forge_rules.armour_upgrade` doc.

- [ ] **Step 1: Write the failing test** — append to `tests/canon.test.js`:

```js
test('armoury door exists with per-faction skins', () => {
  const d = canon.galaxy.doors.find(x => x.kind === 'armoury');
  assert.ok(d, 'armoury door present');
  assert.ok(d.skins && d.skins.chaos && d.skins.imperial, 'armoury skins');
});
test('forge can upgrade armour', () => {
  assert.ok(canon.equipment_alpha.forge_rules.armour_upgrade, 'armour_upgrade rule');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/canon.test.js` — Expected: FAIL.

- [ ] **Step 3: Edit canon.** Append to `galaxy.doors`:

```json
{ "kind":"armoury", "name":"Armoury", "does":"buy and fit Armour", "rarity":"common",
  "skins":{ "imperial":"The Panoply", "chaos":"Panoply of Spite", "tyranids":"Moult-Pit",
    "orks":"Mek's Plate-Shack", "necrons":"Reclamation Vault", "aeldari":"Wargear Shrine",
    "drukhari":"Flesh-Fitters", "tau":"Fitting Bay", "votann":"Ancestor Armoury",
    "harlequins":"Costume Vault", "default":"Armoury" } }
```

Add `"armoury"` to the `doors` array of two alpha `location_types` — the **stronghold** and **muster** entries (search `location_types` for `"kind":"muster"`/stronghold-class; add `{"kind":"armoury"}` to their `doors` lists, matching the existing door-entry shape used there).

Under `equipment_alpha.forge_rules` add:

```json
"armour_upgrade": {
  "does": "+1 Defense to one chosen element per tier",
  "tiers": ["I","II","III"],
  "cost": "currency, rising per tier (base_cost x tier)"
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/canon.test.js` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js
git commit -m "canon v1.7: Armoury door + Forge armour-upgrade rule"
```

---

### Task 4: Pure LOADOUT core + tests

**Files:**
- Modify: `index.html` (add `/*<loadout-core>*/ … /*</loadout-core>*/` region near the thread-core, exposing `LOADOUT`)
- Create: `tests/_load-loadout.js` (extractor), `tests/loadout-core.test.js`

**Interfaces:**
- Produces:
  - `LOADOUT.slotCount(cls, rank, baseSl, canon)` → `number`
  - `LOADOUT.legalItems(slotType, inventory)` → filtered array (`it.cat === slotType`)
  - `LOADOUT.canEquip(slot, item)` → `bool` (slot typed and `item.cat === slot.type`)
  - `LOADOUT.retypeSlot(slot, newType)` → mutates: sets `slot.type=newType`, returns the displaced item (or null) so the caller returns it to inventory
  - `LOADOUT.mitigate(raw, element, def)` → `Math.max(0, raw - ((def && def[element]) || 0))`

- [ ] **Step 1: Write the extractor** — `tests/_load-loadout.js` (mirror `tests/_load.js`):

```js
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
function loadLoadout() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<loadout-core>\*\/([\s\S]*?)\/\*<\/loadout-core>\*\//);
  if (!m) throw new Error('loadout-core region not found');
  return vm.runInThisContext('(function(){' + m[1] + '\n;return LOADOUT;})()');
}
module.exports = { loadLoadout };
```

- [ ] **Step 2: Write the failing tests** — `tests/loadout-core.test.js`:

```js
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { loadLoadout } = require('./_load-loadout');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname,'..','heretics-40k-data-v1.json'),'utf8'));
const L = loadLoadout();

test('mitigate floors at 0 and subtracts per element', () => {
  const def = {Physical:3, Corrosive:0};
  assert.strictEqual(L.mitigate(2,'Physical',def), 0);   // fully turned
  assert.strictEqual(L.mitigate(4,'Physical',def), 1);
  assert.strictEqual(L.mitigate(2,'Corrosive',def), 2);  // 0 def = bypass
  assert.strictEqual(L.mitigate(3,'Heat',def), 3);       // missing element = 0 def
  assert.strictEqual(L.mitigate(1,'Physical',null), 1);  // no armour
});
test('slotCount = base + rank growth by class', () => {
  // Core base 2 at R1 -> 2; at R4 -> +2 -> 4
  assert.strictEqual(L.slotCount('Core',1,2,canon), 2);
  assert.strictEqual(L.slotCount('Core',4,2,canon), 4);
  // Armament base 2 at R5 -> +4 -> 6
  assert.strictEqual(L.slotCount('Armament',5,2,canon), 6);
});
test('legalItems filters by slot type; canEquip enforces match', () => {
  const inv = [{cat:'WEAPON',n:'Bolter'},{cat:'ITEM',n:'Stim'}];
  assert.strictEqual(L.legalItems('WEAPON',inv).length, 1);
  assert.ok(L.canEquip({type:'WEAPON',it:null},{cat:'WEAPON'}));
  assert.ok(!L.canEquip({type:'WEAPON',it:null},{cat:'ITEM'}));
  assert.ok(!L.canEquip({type:null,it:null},{cat:'WEAPON'}));  // untyped
});
test('retypeSlot returns displaced item and re-types', () => {
  const slot = {type:'WEAPON', it:{cat:'WEAPON',n:'Bolter'}};
  const displaced = L.retypeSlot(slot,'ITEM');
  assert.strictEqual(displaced.n,'Bolter');
  assert.strictEqual(slot.type,'ITEM');
  assert.strictEqual(slot.it,null);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/loadout-core.test.js`
Expected: FAIL (loadout-core region not found).

- [ ] **Step 4: Add the region** to `index.html` immediately after the `/*</thread-core>*/` line (597):

```js
/*<loadout-core>*/
var LOADOUT = (function(){
  function slotCount(cls, rank, baseSl, canon){
    var g=(canon.rules.growth.slot_gains_by_rank||{})[cls]||[];
    return (baseSl||0) + (g[(rank||1)-1]||0);
  }
  function legalItems(slotType, inventory){
    return (inventory||[]).filter(function(it){return it.cat===slotType;});
  }
  function canEquip(slot, item){
    return !!(slot && slot.type && item && item.cat===slot.type);
  }
  function retypeSlot(slot, newType){
    var displaced = slot.it || null;
    slot.type = newType; slot.it = null;
    return displaced;
  }
  function mitigate(raw, element, def){
    return Math.max(0, (raw||0) - ((def && def[element]) || 0));
  }
  return { slotCount:slotCount, legalItems:legalItems, canEquip:canEquip,
           retypeSlot:retypeSlot, mitigate:mitigate };
})();
/*</loadout-core>*/
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/loadout-core.test.js` — Expected: PASS (all 4).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/_load-loadout.js tests/loadout-core.test.js
git commit -m "loadout-core: pure slotCount/legalItems/canEquip/retypeSlot/mitigate + tests"
```

---

### Task 5: Wire armour mitigation into thread-core combat

**Files:**
- Modify: `index.html` thread-core: `combatCatalog` (515-517, read new slot shape with back-compat), `initState` (488-499, load armour onto combatants), `apply` damage branch (559)
- Test: `tests/thread-core.test.js`

**Interfaces:**
- Consumes: `LOADOUT.mitigate` is NOT used inside thread-core (thread-core stays self-contained); inline the same `max(0, …)` math. Combatant gains `c.armour` = `{def}` or null.
- Produces: `apply()` mitigates damage by `c.armour[element]`; `combatCatalog` reads `model.loadout.slots` (falling back to `model.sl`).

- [ ] **Step 1: Write the failing test** — append to `tests/thread-core.test.js`:

```js
test('armour mitigates damage by element, floored at 0', () => {
  const thread = { type:'SKIRMISH', seedState:{ joined:true,
    pools:{ y:100, e:100 },
    combatants:{
      hero:{ party:'y', model:{n:'Hero'}, w:[6,6], armour:{Physical:3,Corrosive:0} },
      foe:{ party:'e', model:{n:'Foe'}, w:[6,6] } } } };
  const t = THREAD.create(thread, canon);
  // Physical 2 vs Physical-3 armour -> 0 taken
  THREAD.apply(t, t.state, [{actor:'foe',effect:{kind:'damage',amount:2,to:'hero',element:'Physical'}}], canon);
  assert.strictEqual(t.state.combatants.hero.w[0], 6);
  // Corrosive 2 vs Corrosive-0 armour -> full 2 taken
  THREAD.apply(t, t.state, [{actor:'foe',effect:{kind:'damage',amount:2,to:'hero',element:'Corrosive'}}], canon);
  assert.strictEqual(t.state.combatants.hero.w[0], 4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/thread-core.test.js`
Expected: FAIL (armour ignored — hero takes 2 on the Physical hit).

- [ ] **Step 3: Edit the `apply` damage branch** (line 559). Replace:

```js
if(e.kind==='damage'&&c){c.w=[Math.max(0,c.w[0]-e.amount),c.w[1]];
```

with:

```js
if(e.kind==='damage'&&c){
  var def=c.armour||null;
  var taken=Math.max(0, e.amount - ((def && def[e.element])||0));
  c.w=[Math.max(0,c.w[0]-taken),c.w[1]];
```

(The death/window logic below is unchanged — the killing `e.element` still sets the window. Note `c.w[0]<=0` now keys off the mitigated total.)

- [ ] **Step 4: Edit `initState`** (line 490) so seeded combatants keep an `armour` field, and add an armour-hydration in `create`/where the model is attached. In `initState`, `combatants:seed.combatants||{}` already preserves a seeded `armour`. Add a helper the engine calls when attaching a model to a combatant (line 1598 region, outside the core) — but for the pure test, seeded `armour` suffices. No core change needed beyond preserving the field (already preserved). Confirm by re-running the test.

- [ ] **Step 5: Edit `combatCatalog`** (line 515) for the new slot shape, back-compatible:

```js
var slots=(c.model.loadout&&c.model.loadout.slots)||c.model.sl||[];
slots.forEach(function(s){if(!s.it)return;var it=s.it;var k=s.type||s.k;
  if(k==='WEAPON')out.push({actor:id,action:'Attack - '+it.n,group:'e',cost:apMod(it),kind:'damage',item:it});
  else if(k==='ABILITY')out.push({actor:id,action:it.n,group:'y',cost:apMod(it),kind:'cond',item:it});
```

(Continue the existing branches, swapping `s.k` → `k`.)

- [ ] **Step 6: Run all tests**

Run: `node --test`
Expected: PASS (armour test green; all prior thread-core tests still green).

- [ ] **Step 7: Commit**

```bash
git add index.html tests/thread-core.test.js
git commit -m "thread-core: armour mitigation in apply() + loadout-shape combatCatalog"
```

---

### Task 6: State migration + default-armour seeding

**Files:**
- Modify: `index.html` — add `migrateLoadout(m)` + `defaultArmourFor(faction,cls)` helpers; call during `demoSave`/boot; update the demo roster models to the new shape.

**Interfaces:**
- Consumes: `D.armour`, `LOADOUT.slotCount`.
- Produces: every `S.roster[]` model has `m.loadout = {slots:[{type,it}], armour:{it}}`; `m.sl` removed (or left as legacy — prefer removed once migrated). `defaultArmourFor(faction,cls)` → an armour piece object (copy) or the universal light piece.

- [ ] **Step 1: Add helpers** near `demoSave` (line 793). `defaultArmourFor` finds the `tier:"default"` piece for the faction+class; falls back to any faction default, then to the universal `Salvaged Flak Weave`:

```js
function defaultArmourFor(faction,cls){
  var A=D.armour||[];
  var hit=A.filter(function(p){return p.faction===faction&&p.cls===cls&&p.tier==='default';})[0]
        ||A.filter(function(p){return p.faction===faction&&p.tier==='default';})[0]
        ||A.filter(function(p){return p.faction===null&&p.tier==='light';})[0];
  return hit?JSON.parse(JSON.stringify(hit)):null;
}
function migrateLoadout(m,faction){
  if(m.loadout)return m;
  var slots=(m.sl||[]).map(function(s){
    var type=s.k==='WARP CAST'?'CAST':(s.k==='NAMED'?null:s.k);
    return {type:type,it:s.it||null};
  });
  var want=LOADOUT.slotCount(m.cls,m.rk,(m.sl||[]).length? (m.sl.length - 0):2, D);
  while(slots.length<want) slots.push({type:null,it:null});
  m.loadout={ slots:slots, armour:{ it:defaultArmourFor(faction,m.cls) } };
  delete m.sl;
  return m;
}
```

Note: base slot count for demo models is taken as the current `m.sl.length` (they are already at their rank's count); `slotCount` is used going forward for rank-ups. Keep `want = m.sl.length` to avoid double-counting growth on already-grown demo models — set `var want=(m.sl||[]).length;`.

- [ ] **Step 2: Call migration** at the end of `demoSave` before returning `S`:

```js
S.roster.forEach(function(m){ migrateLoadout(m, S.player.faction); });
```

- [ ] **Step 3: Verify in browser.** Serve (`python3 -m http.server 8765`), open Barracks. Expected: every model shows an Armour line with a Death Guard default (e.g. "Plague-Cured Plate"); slots render with their migrated types; 0 JS console errors. (UI polish lands in Tasks 7–8; here just confirm no crash and data shape.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "engine: migrate roster to m.loadout {slots,armour} + seed class/faction default armour"
```

---

### Task 7: Loadout UI — assign type, equip, retype, armour slot, gating

**Files:**
- Modify: `index.html` — `rLoad` (924), `pick` (934), `afterEquip` (943); the `#b-loadout`/`#sg` render.

**Interfaces:**
- Consumes: `LOADOUT.legalItems`, `LOADOUT.canEquip`, `LOADOUT.retypeSlot`; `sel.loadout`.
- Produces: interactive general-slot grid + a distinct armour-slot row; edits blocked when `sel` is in an active thread.

- [ ] **Step 1: Add an active-thread guard** helper (reuse the Force-edit check). Find the existing "leader in active thread" predicate; expose `modelInActiveThread(m)` → bool. If none exists, implement: a model is locked if any thread in `S.threads` has `state.joined` and lists the model's force as active.

- [ ] **Step 2: Rewrite `rLoad`** to render from `sel.loadout.slots` plus the armour slot. Each general slot:
  - untyped (`type===null`): card shows `＋ Assign type`; click → type chooser (Weapon/Item/Ability/Warp Cast buttons) → sets `type`, re-render.
  - typed empty: shows type label + "Empty — click to equip"; click → `pick(i)`.
  - typed filled: shows item; a `✎ type` control (calls retype) and click-to-swap.
  Armour slot rendered separately below the grid: shows the piece name + a 6-element Defense readout (`P3 H1 W1 C0 Pl0 E1`), click opens an ARMOUR-only picker (`legalItems('ARMOUR', S.inv)` plus currently-fitted).
  All click handlers no-op with a toast (`T('Loadout is locked while this model is in an active thread.')`) when `modelInActiveThread(sel)`.

- [ ] **Step 3: Rewrite `pick(i)`** to use the slot's assigned `type` (not `s.k`): filter inventory via `LOADOUT.legalItems(slot.type, S.inv)`; equip/unequip as today. For retype, call `LOADOUT.retypeSlot(slot,newType)` and push any displaced item back to `S.inv`.

- [ ] **Step 4: Browser-verify** on the Barracks → Loadout tab: assign a type to an untyped slot, equip an item, retype a filled slot (item returns to inventory), fit/swap armour, and confirm the armour Defense readout. Confirm lock behaviour on an in-thread model. 0 console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: free-form loadout UI — assign type, equip, retype, armour slot, active-thread gating"
```

---

### Task 8: Model-overview slot grid + armour row

**Files:**
- Modify: `index.html` — `openModel` slot-grid block (1661-1667)

**Interfaces:**
- Consumes: `m.loadout`.
- Produces: overview groups slots by assigned type; untyped slots under "Unassigned"; an Armour row with the Defense profile.

- [ ] **Step 1: Replace the grid block** (1662-1667) to iterate `m.loadout.slots`, grouping by `s.type` with labels `{WEAPON:'Weapons',ITEM:'Items',ABILITY:'Abilities',CAST:'Warp Casts'}` and a final `null → 'Unassigned'` group. Render the armour slot as its own labelled card showing `m.loadout.armour.it` name + the 6 defense values (0-values dimmed to signal "bypass").

- [ ] **Step 2: Browser-verify** the model overview overlay from Barracks and HQ. Slots grouped correctly; armour card shows the profile; 0 console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "engine: model overview — type-grouped slots + armour Defense card"
```

---

### Task 9: Armoury door + requisition handler

**Files:**
- Modify: `index.html` — door dispatch (near 1914, where `kind==='forge'` routes) + a new `renderArmoury(container, door)`.

**Interfaces:**
- Consumes: `D.armour`, `S.pos`/location faction, the existing cart/sell/`S.inv`/`S.cur` plumbing used by `renderShop`.
- Produces: `renderArmoury` lists armour for the location faction + universal, with buy (adds to `S.inv` as `cat:'ARMOUR'`), sell, and **fit** (equips into `sel.loadout.armour.it`, returning the old piece to `S.inv`).

- [ ] **Step 1: Add the dispatch branch.** Where doors route (`else if(kind==='forge'){renderForge(...)}`), add `else if(kind==='armoury'){renderArmoury(c,dr)}`.

- [ ] **Step 2: Implement `renderArmoury`** mirroring `renderShop`'s structure: filter `D.armour` to `p.faction===locFaction || p.faction===null`; group by tier; each row shows name, the 6-element Defense, `pc`, and Buy/Fit buttons. Buy: `S.cur-=pc; S.inv.push(copy)`. Fit (to the selected model): return current `armour.it` to `S.inv`, set `armour.it=copy`, remove from `S.inv`. Sell: standard sell path.

- [ ] **Step 3: Browser-verify.** Enter a location with the Armoury door → Requisition. Buy a piece, fit it to a model (armour slot updates, old piece returns to inventory), sell a piece. 0 console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "engine: Armoury door + requisition handler (buy/fit/sell armour)"
```

---

### Task 10: Forge armour-upgrade mode

**Files:**
- Modify: `index.html` — `renderForge` (1944-1965)

**Interfaces:**
- Consumes: `equipment_alpha.forge_rules.armour_upgrade`, an equipped/owned `cat:'ARMOUR'` piece.
- Produces: an "Upgrade Armour" mode that raises one element's Defense by +1 at a rising currency cost.

- [ ] **Step 1: Add a mode toggle** in `renderForge` (Weapon tag / Armour upgrade). In Armour mode: list owned `cat:'ARMOUR'` pieces (inventory + fitted); choose one → choose an element → show cost (`base_cost × tier`) → on pay: `piece.def[element] += 1`, spend `S.cur`, toast. Re-render.

- [ ] **Step 2: Browser-verify.** Forge door → Upgrade Armour → pick piece + element → pay → Defense increments; currency decrements. 0 console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "engine: Forge armour-upgrade mode (+1 Defense per element per tier)"
```

---

### Task 11: Full verification + docs + version stamp

**Files:**
- Modify: `CLAUDE.md` (state line + feature notes), `index.html` (bump the engine version label to v17)

- [ ] **Step 1: Run the full test suite.** `node --test` — Expected: all green (canon, thread-core, loadout-core, engine-syntax).

- [ ] **Step 2: Browser smoke pass** with `window` error capture: Rites → HQ → Barracks (loadout assign/equip/retype/fit) → Requisition (Armoury buy/fit, Forge upgrade) → Map → Threads (start a battle, confirm armour turns/fails a hit by element in the report) → Comms. Zero JS errors on every screen.

- [ ] **Step 3: Update `CLAUDE.md`** — bump "engine **v17** / canon **data v1.7**"; add a "v1.7 — free-form slots + per-element armour" bullet to the canon list and an engine bullet describing the Armoury door + Forge armour upgrade + loadout rebuild. Bump the `index.html` version label to v17.

- [ ] **Step 4: Commit**

```bash
git add index.html CLAUDE.md
git commit -m "v17 / canon v1.7: free-form slots + armour system — verified, docs updated"
```

- [ ] **Step 5: Hand off for push.** Report to the user: tests green, screens exercised, commits ready — they run `git push`.

---

## Self-Review

**Spec coverage:** slot rebuild (T4,T6,T7,T8) · armour item+slot (T2,T6,T7,T8) · per-element mitigation (T4,T5) · catalog (T2) · Armoury door (T3,T9) · Forge upgrade (T3,T10) · pure core+tests (T4,T5) · migration+seeding (T6) · canon v1.7 (T1,T2,T3) · active-thread gating (T7). All spec sections map to a task.

**Placeholder scan:** UI tasks (T7–T10) specify exact functions, inputs, and behaviours with the key code; DOM string-building is browser-verified per repo convention rather than unit-tested — consistent with CLAUDE.md. No TBD/TODO.

**Type consistency:** slot shape `{type,it}` used uniformly (T4 canEquip/retypeSlot, T5 combatCatalog, T6 migration, T7/T8 render). `m.loadout={slots,armour:{it}}` consistent T6–T10. `def` is the 6-element object throughout (T2 catalog, T4 mitigate, T5 apply, T9 fit). `LOADOUT.mitigate` is the tested reference; thread-core inlines the same `max(0,…)` math (noted in T5) to keep the core self-contained.
