# Capture & Remains Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make taking enemies alive (Non-Lethal → Capture → CAPTIVE) and taking the dead (aftermath loot → REMAINS) real, per `docs/superpowers/specs/2026-07-24-capture-remains-design.md` (T-MISC-1 + T-ITEM-1 as one slice).

**Architecture:** Extend-the-core. Canon gains 2 registry tags, 4 catalog entries, 3 retrofits and a `rules.spoils` block (v1.20). The pure `THREAD` core gains `capture`/`loot`/`free` effects, a Non-Lethal damage floor, an `aftermath` phase and snapshot builders. Engine glue: standing CAPTURE action, corpse markers, aftermath banner + END THREAD, conclude conversions, item-card verbs, sell pricing.

**Tech Stack:** Vanilla ES5 in `index.html` (single-file engine), canon JSON, Node built-in test runner (`node --test`, zero deps).

## Global Constraints

- **Terminology law: always "model", never "chassis"** (all copy, code, data).
- Multi-agent board: claim rows in `BACKLOG.md` before working; **`git add <explicit paths>` only — NEVER `-A`/`.`**; 🔥 engine lane = only one in-progress task.
- `node --test` must pass at every pause; never commit red.
- Canon changes: edit `heretics-40k-data-v1.json`, bump `meta.version` to `"1.20"`. Engine logic never embeds canon.
- THREAD core (`/*<thread-core>*/…/*</thread-core>*/` in `index.html`) stays pure: no DOM, no globals; canon/state arrive as arguments. Tests load it via `tests/_load.js` `loadThread()`.
- ES5 style matching the file (no arrow functions, no `let`/`const` in the engine).
- Push is gated to Daak — final state is `ready-to-push`, never push.
- The user runs the local server; browser-verify with Playwright MCP before declaring done (0 console errors).

**Shared shapes used throughout (from the audit — verified in code):**
- Combatant: `state.combatants[id] = {party, model, w:[cur,max], x, y, dead, conds, band, sight, spd, gen?, killElement?, revivalWindow?, permaDeath?}`
- Model slots: `c.model.loadout.slots = [{type|k, it}]`; an **empty slot** is one with `!s.it`.
- Inventory: `S.inv` = flat array of `{n, cat, d, pc, origin, …}`.
- Items carry rules in the `d` string (e.g. `"Phys 2 - Melee - 1 AP - Suppressing I"`); tags referenced by name.
- Core export list is the `return {…}` at the end of the IIFE (~line 758) — every new core function must be added there.

---

### Task 0: Claim the board

**Files:**
- Modify: `BACKLOG.md` (rows T-MISC-1 and T-ITEM-1 only)

- [ ] **Step 1: Sync** — `git pull --ff-only` (expect `Already up to date.` or fast-forward).
- [ ] **Step 2: Claim** — in both rows set `status` → `in-progress`, `owner` → `spoils · sess:<your-session-uuid>`, `Updated` → today. Touch nothing else in the file.
- [ ] **Step 3: Commit**
```bash
git add BACKLOG.md
git commit -m "backlog: claim T-MISC-1 + T-ITEM-1 (capture & remains slice)"
```
If the commit conflicts on pull, someone beat you — pull and re-check the lane.

---

### Task 1: Canon v1.20 — tags, gear, spoils block (+ guard test)

**Files:**
- Modify: `heretics-40k-data-v1.json`
- Test: `tests/canon-spoils.test.js`

**Interfaces:**
- Produces: `D.tags.weapon` entry `Non-Lethal`; `D.tags.item` entry `Capture` (tiers I/II/III); `D.rules.spoils` (shape below); catalog items `Shock Maul`, `Shackles`, `Slaver's Snare`, `Abduction Kit`; `Non-Lethal` appended to three weapon `d` strings and to `equipment_alpha.forge_affinities.drukhari/gsc`.

- [ ] **Step 1: Write the failing guard test**

```js
// tests/canon-spoils.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('canon v1.20: Non-Lethal weapon tag registered', () => {
  const t = D.tags.weapon.find(x => x.tag === 'Non-Lethal');
  assert.ok(t, 'Non-Lethal missing from tags.weapon');
  assert.match(t.mechanic, /below 1 wound/i);
});
test('canon v1.20: Capture item tag registered with 3 AP tiers', () => {
  const t = D.tags.item.find(x => x.tag === 'Capture');
  assert.ok(t, 'Capture missing from tags.item');
  assert.strictEqual(t.tiers.length, 3);
});
test('canon v1.20: rules.spoils block complete', () => {
  const s = D.rules.spoils;
  assert.deepStrictEqual(s.capture_ap_by_tier, { I: 3, II: 2, III: 1 });
  assert.strictEqual(s.capture_range, 1);
  assert.strictEqual(s.capture_target_wounds, 1);
  assert.strictEqual(s.loot_ap, 1);
  assert.strictEqual(s.free_captive_ap, 1);
  assert.deepStrictEqual(s.sell_mult, { REMAINS: 0.5, CAPTIVE: 1.0 });
});
test('canon v1.20: retrofits carry Non-Lethal', () => {
  ['Agoniser', 'Webber', 'Concussion Maul'].forEach(n => {
    const w = D.weapons.find(x => x.n === n);
    assert.ok(w && /Non-Lethal/.test(w.d), n + ' lacks Non-Lethal');
  });
});
test('canon v1.20: minted gear exists', () => {
  const sm = D.weapons.find(x => x.n === 'Shock Maul');
  assert.ok(sm && !sm.faction && /Non-Lethal/.test(sm.d));
  const sh = D.items.find(x => x.n === 'Shackles');
  assert.ok(sh && !sh.faction && /Capture I(?!I)/.test(sh.d));
  const sn = D.items.find(x => x.n === "Slaver's Snare");
  assert.ok(sn && sn.faction === 'drukhari' && /Capture II(?!I)/.test(sn.d));
  const ak = D.items.find(x => x.n === 'Abduction Kit');
  assert.ok(ak && ak.faction === 'gsc' && /Capture II(?!I)/.test(ak.d));
});
test('canon v1.20: forge affinities + version bump', () => {
  assert.ok(D.equipment_alpha.forge_affinities.drukhari.includes('Non-Lethal'));
  assert.ok(D.equipment_alpha.forge_affinities.gsc.includes('Non-Lethal'));
  assert.strictEqual(D.meta.version, '1.20');
});
```

> If `forge_affinities` is keyed differently (inspect with `jq '.equipment_alpha.forge_affinities | keys' heretics-40k-data-v1.json` — it may key by faction id or wrap in a `map` object), adapt the last test's paths to the real shape **before** first run, then keep it fixed.

- [ ] **Step 2: Run it — expect FAIL** — `node --test tests/canon-spoils.test.js` → every test red (missing keys).
- [ ] **Step 3: Edit the canon JSON** (Edit tool, surgical):
  1. `tags.weapon` array — append:
```json
{ "tag": "Non-Lethal", "mechanic": "Strikes from this weapon cannot reduce a target below 1 wound.", "forgeable": true }
```
  2. `tags.item` array — append:
```json
{ "tag": "Capture", "mechanic": "Grants the Capture special action: adjacent (Chebyshev <=1) to an enemy at exactly 1 wound, spend AP by tier to take it captive. The captive occupies an empty slot on this model.", "tiers": ["I - 3 AP", "II - 2 AP", "III - 1 AP"] }
```
  3. Weapons `Agoniser`, `Webber`, `Concussion Maul`: append `" - Non-Lethal"` to each `d`.
  4. `weapons` array — append: `{ "n": "Shock Maul", "cat": "WEAPON", "d": "Phys 1 - Melee - 1 AP - Non-Lethal", "pc": 5 }`
  5. `items` array — append:
```json
{ "n": "Shackles", "cat": "ITEM", "d": "Capture I - carried restraints for a subdued foe", "pc": 6 },
{ "n": "Slaver's Snare", "cat": "ITEM", "d": "Capture II - barbed monofilament net-lash", "pc": 12, "faction": "drukhari" },
{ "n": "Abduction Kit", "cat": "ITEM", "d": "Capture II - soporifics, hood and cord", "pc": 10, "faction": "gsc" }
```
  6. `equipment_alpha.forge_affinities`: add `"Non-Lethal"` to the drukhari and gsc lists.
  7. `rules` — add key:
```json
"spoils": {
  "capture_ap_by_tier": { "I": 3, "II": 2, "III": 1 },
  "capture_range": 1,
  "capture_target_wounds": 1,
  "loot_ap": 1,
  "free_captive_ap": 1,
  "sell_mult": { "REMAINS": 0.5, "CAPTIVE": 1.0 },
  "note": "Capture & Remains tuning - spec docs/superpowers/specs/2026-07-24-capture-remains-design.md"
}
```
  8. `meta.version` → `"1.20"`.
- [ ] **Step 4: Run — expect PASS** — `node --test tests/canon-spoils.test.js` all green, then full `node --test` (188 + new all green; existing `tests/canon.test.js` guards must stay green).
- [ ] **Step 5: Commit**
```bash
git add heretics-40k-data-v1.json tests/canon-spoils.test.js
git commit -m "canon v1.20: Non-Lethal + Capture tags, capture gear, rules.spoils (T-MISC-1/T-ITEM-1)"
```

---

### Task 2: Non-Lethal damage floor (core)

**Files:**
- Modify: `index.html` — THREAD core `apply()`, damage branch (`e.kind==='damage'`, ~L582)
- Test: `tests/spoils-nonlethal.test.js`

**Interfaces:**
- Consumes: existing `apply` damage effect `{kind:'damage', to, amount, element, weapon, noRevival}`.
- Produces: damage effects honour a new optional flag `nonLethal:true` — target wounds floor at 1, never dies from that hit.

- [ ] **Step 1: Write the failing test**

```js
// tests/spoils-nonlethal.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { death: { revival_window: { windows: { Physical: 8 } } } } };

function mkState(w) {
  return { pools: { A: 9, B: 9 }, combatants: {
    atk: { party: 'A', w: [4, 4], model: { loadout: { slots: [] } } },
    tgt: { party: 'B', w: [w, 4], model: { loadout: { slots: [] } } }
  }, fog: {} };
}
const T = { type: 'SKIRMISH' };

test('non-lethal hit floors at 1 wound, never kills', () => {
  const s = mkState(3);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical', nonLethal: true } }], CANON);
  assert.strictEqual(s.combatants.tgt.w[0], 1);
  assert.ok(!s.combatants.tgt.dead);
});
test('non-lethal hit on a 1-wound target changes nothing', () => {
  const s = mkState(1);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical', nonLethal: true } }], CANON);
  assert.strictEqual(s.combatants.tgt.w[0], 1);
  assert.ok(!s.combatants.tgt.dead);
});
test('lethal hit still kills (no regression)', () => {
  const s = mkState(2);
  THREAD.apply(T, s, [{ actor: 'atk', cost: 1,
    effect: { kind: 'damage', to: 'tgt', amount: 9, element: 'Physical' } }], CANON);
  assert.ok(s.combatants.tgt.dead);
});
```

- [ ] **Step 2: Run — expect FAIL** — `node --test tests/spoils-nonlethal.test.js` (floor test: `w[0]` is 0 and dead).
- [ ] **Step 3: Implement** — in `apply()`, damage branch, immediately after `var _taken=Math.max(0,e.amount-_dv-_cov);` insert:

```js
        if(e.nonLethal)_taken=Math.min(_taken,Math.max(0,c.w[0]-1)); // Non-Lethal floor: never below 1 wound
```

- [ ] **Step 4: Run — expect PASS** — targeted file, then full `node --test`.
- [ ] **Step 5: Commit**
```bash
git add index.html tests/spoils-nonlethal.test.js
git commit -m "core: Non-Lethal damage floor - strikes never drop a target below 1 wound"
```

---

### Task 3: Capture — tier parse, snapshot builder, validate + apply, catalog entry (core)

**Files:**
- Modify: `index.html` — THREAD core: new helpers + `combatCatalog` + `validate` + `apply` + `outcome` + export list (~L758)
- Test: `tests/spoils-capture.test.js`

**Interfaces:**
- Consumes: `rules.spoils` (Task 1), `cheb` (existing), slots shape.
- Produces (exported): `captureTier(item)` → `'I'|'II'|'III'|null`; `mkCaptive(c, cid, meta)` → CAPTIVE item; effect `{kind:'capture', to:<targetId>}` with block entry `{actor, cost, item}`; `outcome()` treats `captured` combatants as not alive; `combatCatalog` lists a standing `Capture` action for Capture-item holders.

- [ ] **Step 1: Write the failing tests**

```js
// tests/spoils-capture.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: {
  spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
            capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1,
            sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8 } } } } };
const SHACKLES = { n: 'Shackles', cat: 'ITEM', d: 'Capture I - restraints' };

function mkState() {
  return { pools: { A: 9, B: 9 }, fog: {},
    board: { w: 10, h: 10, tiles: null },   // tile-less board = all open (existing convention)
    combatants: {
      atk: { party: 'A', w: [4, 4], x: 2, y: 2, model: { n: 'Captor', pc: 10, cls: 'Core',
        loadout: { slots: [{ type: 'ITEM', it: SHACKLES }, { type: 'ITEM', it: null }] } } },
      tgt: { party: 'B', w: [1, 4], x: 3, y: 2, model: { n: 'Victim', pc: 8, cls: 'Core',
        loadout: { slots: [] } } }
    } };
}
const T = { type: 'SKIRMISH' };
function capBlock(cost) {
  return [{ actor: 'atk', cost: cost == null ? 3 : cost, item: SHACKLES,
            effect: { kind: 'capture', to: 'tgt' } }];
}

test('captureTier parses I/II/III', () => {
  assert.strictEqual(THREAD.captureTier(SHACKLES), 'I');
  assert.strictEqual(THREAD.captureTier({ d: 'Capture III - x' }), 'III');
  assert.strictEqual(THREAD.captureTier({ d: 'Phys 2 - Melee' }), null);
});
test('valid capture passes validate and applies', () => {
  const s = mkState();
  assert.ok(THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
  THREAD.apply(T, s, capBlock(), CANON);
  const tgt = s.combatants.tgt;
  assert.ok(tgt.captured); assert.strictEqual(tgt.x, null);
  const slot = s.combatants.atk.model.loadout.slots[1];
  assert.ok(slot.it && slot.it.cat === 'CAPTIVE');
  assert.strictEqual(slot.it.ref.cid, 'tgt');
  assert.match(slot.it.n, /Victim/);
});
test('validate rejects: target not at exactly 1 wound', () => {
  const s = mkState(); s.combatants.tgt.w = [2, 4];
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: out of melee range', () => {
  const s = mkState(); s.combatants.tgt.x = 6;
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: no Capture item in the block', () => {
  const s = mkState();
  const b = capBlock(); b[0].item = { n: 'Sword', d: 'Phys 2 - Melee - 1 AP' };
  assert.ok(!THREAD.validate(T, s, 'A', b, CANON).ok);
});
test('validate rejects: no empty slot on the captor', () => {
  const s = mkState();
  s.combatants.atk.model.loadout.slots[1].it = { n: 'Rock', cat: 'ITEM', d: '' };
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(), CANON).ok);
});
test('validate rejects: wrong AP cost for tier', () => {
  const s = mkState();
  assert.ok(!THREAD.validate(T, s, 'A', capBlock(1), CANON).ok);   // Capture I costs 3
});
test('capturing the last standing enemy ends the battle', () => {
  const s = mkState();
  THREAD.apply(T, s, capBlock(), CANON);
  const oc = THREAD.outcome({ type: 'SKIRMISH' }, s);
  assert.ok(oc && oc.kind === 'annihilation' && oc.victor === 'A');
});
test('combatCatalog lists a standing Capture action for the holder', () => {
  const s = mkState();
  const acts = THREAD.catalog(T, s, 'A', CANON);
  const cap = acts.find(a => a.kind === 'capture');
  assert.ok(cap && cap.actor === 'atk' && cap.cost === 3);
});
```

- [ ] **Step 2: Run — expect FAIL** — `THREAD.captureTier is not a function`.
- [ ] **Step 3: Implement in the core** (all inside the IIFE, before the `return`):

```js
  /* ── Capture & Remains (spec 2026-07-24) ── */
  function captureTier(item){var m=((item&&item.d)||'').match(/Capture\s+(III|II|I)\b/i);
    return m?m[1].toUpperCase():null;}
  function captureAP(canon,tier){var s=canon.rules&&canon.rules.spoils;
    return (s&&s.capture_ap_by_tier&&s.capture_ap_by_tier[tier])||3;}
  function emptySlotOf(c){var sl=(c.model&&c.model.loadout&&c.model.loadout.slots)||[];
    for(var i=0;i<sl.length;i++)if(!sl[i].it)return sl[i];return null;}
  function snapOf(c,cid){var m=c.model||{};
    return {cid:cid,name:m.n||cid,faction:m.faction||null,cls:m.cls||null,rank:m.rank||1,
      pc:m.pc||0,wounds:(c.w&&c.w[1])||0,kills:m.kills||0,lore:m.lore||null,
      loadout:((m.loadout&&m.loadout.slots)||[]).filter(function(s){return s.it})
        .map(function(s){return s.it.n})};}
  function mkCaptive(c,cid,meta){meta=meta||{};
    return {cat:'CAPTIVE',n:'Captive: '+((c.model&&c.model.n)||cid),
      d:'A living prize, bound and carried. Ransom, sell, execute or release.',
      ref:snapOf(c,cid),owner_cmdr:meta.owner||null,origin:meta.origin||null,takenDay:meta.day||null};}
```

In `combatCatalog`, inside the slots loop, extend the `ITEM` handling — replace the existing `else if(k==='ITEM'&&…)` branch with:

First change `combatCatalog(state,party)` → `combatCatalog(state,party,canon)` and its single call site in `catalog()` → `return combatCatalog(state,party,canon)`. Then:

```js
        else if(k==='ITEM'&&captureTier(it))
          out.push({actor:id,action:'Capture ('+captureTier(it)+')',group:'x',
                    cost:captureAP(canon||{rules:{}},captureTier(it)),kind:'capture',item:it});
        else if(k==='ITEM'&&/consumable|stimm|grenade/i.test(it.d||''))
          out.push({actor:id,action:'Use '+it.n,group:'a',cost:apMod(it),kind:'cond',item:it});
```

In `validate`, inside the combat branch (after the fog gate), add:

```js
      for(var ci=0;ci<block.length;ci++){var cb=block[ci],ce=cb.effect;
        if(!ce||ce.kind!=='capture')continue;
        var sp=(canon.rules&&canon.rules.spoils)||{};
        var actor=state.combatants[cb.actor],tgt=state.combatants[ce.to];
        var tier=captureTier(cb.item);
        if(!actor||!tgt)return {ok:false,reason:'Capture: no such model'};
        if(!tier)return {ok:false,reason:'Capture: no Capture-tagged item equipped'};
        if(tgt.dead||tgt.captured)return {ok:false,reason:'Capture: target is beyond taking'};
        if(tgt.w[0]!==(sp.capture_target_wounds||1))
          return {ok:false,reason:'Capture: target must be at exactly 1 wound'};
        if(actor.x==null||tgt.x==null||cheb(actor,tgt)>(sp.capture_range||1))
          return {ok:false,reason:'Capture: not in melee range'};
        if(!emptySlotOf(actor))return {ok:false,reason:'Capture: no empty slot to hold the captive'};
        if((cb.cost||0)!==captureAP(canon,tier))
          return {ok:false,reason:'Capture: costs '+captureAP(canon,tier)+' AP at tier '+tier};}
```

In `apply`, add a branch after the `slay` branch:

```js
      else if(e.kind==='capture'&&c){
        var _cap=state.combatants[b.actor];
        var _slot=_cap&&emptySlotOf(_cap);
        if(_slot){_slot.it=mkCaptive(c,e.to,e.meta||{});
          c.captured=true;c.heldBy=b.actor;c.x=null;c.y=null;}}
```

In `outcome`, change the alive line:

```js
      parties[c.party]=1;if(!c.dead&&!c.captured)alive[c.party]=1;});
```

Add to the export list: `captureTier:captureTier, mkCaptive:mkCaptive, emptySlotOf:emptySlotOf,`.

- [ ] **Step 4: Run — expect PASS** — targeted file, then full `node --test` (grid/npc/outcome suites must stay green — `outcome` change only affects states containing `captured`).
- [ ] **Step 5: Commit**
```bash
git add index.html tests/spoils-capture.test.js
git commit -m "core: Capture action - tier parse, validate gate, apply, captured-out ends battle"
```

---

### Task 4: Carrier down — free the captive (core)

**Files:**
- Modify: `index.html` — THREAD core `validate` + `apply`
- Test: `tests/spoils-free.test.js`

**Interfaces:**
- Consumes: CAPTIVE slot items (`ref.cid` link), `spoils.free_captive_ap`.
- Produces: effect `{kind:'free', corpse:<carrierId>, cid:<captiveId>}` — captive returns at 1 wound on the carrier's square. Carried CAPTIVE persists on a dead carrier (no code needed — slots ride the model) and is lootable in Task 5.

- [ ] **Step 1: Write the failing tests**

```js
// tests/spoils-free.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
  capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1, sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8 } } } } };
const T = { type: 'SKIRMISH' };

function capturedState() {
  // B's 'tgt' already captured, held by A's 'carrier' (now dead at 4,4); B's 'buddy' stands adjacent
  const captive = { party: 'B', w: [1, 4], x: null, y: null, captured: true, heldBy: 'carrier',
                    model: { n: 'Victim', pc: 8, loadout: { slots: [] } } };
  const cap = { cat: 'CAPTIVE', n: 'Captive: Victim', d: '', ref: { cid: 'tgt' } };
  return { pools: { A: 9, B: 9 }, fog: {}, board: { w: 10, h: 10, tiles: null }, combatants: {
    carrier: { party: 'A', w: [0, 4], x: 4, y: 4, dead: true,
      model: { n: 'Captor', loadout: { slots: [{ type: 'ITEM', it: cap }] } } },
    buddy: { party: 'B', w: [3, 3], x: 5, y: 4, model: { n: 'Buddy', loadout: { slots: [] } } },
    tgt: captive } };
}
function freeBlock() {
  return [{ actor: 'buddy', cost: 1, effect: { kind: 'free', corpse: 'carrier', cid: 'tgt' } }];
}

test('ally frees the captive from the dead carrier', () => {
  const s = capturedState();
  assert.ok(THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
  THREAD.apply(T, s, freeBlock(), CANON);
  const tgt = s.combatants.tgt;
  assert.ok(!tgt.captured);
  assert.deepStrictEqual([tgt.x, tgt.y, tgt.w[0]], [4, 4, 1]);
  assert.strictEqual(s.combatants.carrier.model.loadout.slots[0].it, null);
});
test('validate rejects: freeing from a living carrier', () => {
  const s = capturedState(); s.combatants.carrier.dead = false; s.combatants.carrier.w = [2, 4];
  assert.ok(!THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
});
test('validate rejects: not adjacent to the corpse', () => {
  const s = capturedState(); s.combatants.buddy.x = 9;
  assert.ok(!THREAD.validate(T, s, 'B', freeBlock(), CANON).ok);
});
test("validate rejects: enemy of the captive can't 'free' it", () => {
  const s = capturedState();
  s.combatants.buddy.party = 'A';
  assert.ok(!THREAD.validate(T, s, 'A', freeBlock(), CANON).ok);
});
```

- [ ] **Step 2: Run — expect FAIL** (`free` unhandled: validate ok:true but apply does nothing → first assertion on `captured` fails… the validate rejects also fail).
- [ ] **Step 3: Implement** — in `validate`'s combat branch, extend the per-entry loop from Task 3 with a `free` case:

```js
        if(ce&&ce.kind==='free'){
          var fsp=(canon.rules&&canon.rules.spoils)||{};
          var fac=state.combatants[cb.actor],fco=state.combatants[ce.corpse],fcv=state.combatants[ce.cid];
          if(!fac||!fco||!fcv)return {ok:false,reason:'Free: no such model'};
          if(!fco.dead)return {ok:false,reason:'Free: the carrier still stands'};
          if(!fcv.captured)return {ok:false,reason:'Free: that model is not held'};
          if(fac.party!==fcv.party)return {ok:false,reason:'Free: only their own side can free them'};
          if(fac.x==null||fco.x==null||cheb(fac,fco)>1)return {ok:false,reason:'Free: not adjacent to the fallen carrier'};
          if((cb.cost||0)!==(fsp.free_captive_ap||1))return {ok:false,reason:'Free: costs '+(fsp.free_captive_ap||1)+' AP'};}
```

In `apply`, add after the capture branch:

```js
      else if(e.kind==='free'){
        var _fc=state.combatants[e.corpse],_fv=state.combatants[e.cid];
        if(_fc&&_fv){var _fsl=(_fc.model&&_fc.model.loadout&&_fc.model.loadout.slots)||[];
          for(var _fi=0;_fi<_fsl.length;_fi++){var _fit=_fsl[_fi].it;
            if(_fit&&_fit.cat==='CAPTIVE'&&_fit.ref&&_fit.ref.cid===e.cid){_fsl[_fi].it=null;break;}}
          _fv.captured=false;_fv.heldBy=null;_fv.w=[1,_fv.w[1]];_fv.x=_fc.x;_fv.y=_fc.y;}}
```

- [ ] **Step 4: Run — expect PASS**, then full `node --test`.
- [ ] **Step 5: Commit**
```bash
git add index.html tests/spoils-free.test.js
git commit -m "core: free-the-captive - 1 AP adjacent rescue from a fallen carrier"
```

---

### Task 5: Aftermath phase + looting (core)

**Files:**
- Modify: `index.html` — THREAD core: `mkRemains`, `validate`, `apply`, export list
- Test: `tests/spoils-loot.test.js`

**Interfaces:**
- Consumes: `spoils.loot_ap`, `emptySlotOf`, `snapOf`, combatant `killElement`/`revivalWindow`/`permaDeath`.
- Produces (exported): `mkRemains(c, cid, meta)` → REMAINS item with `window`; effects `{kind:'loot', corpse, what:'gear'|'body', meta}` gated to `state.phase==='aftermath'`; looted gear accumulates in `state.spoils` (array); corpse flagged `looted`. Engine (Task 7) sets `phase='aftermath'` and converts.

- [ ] **Step 1: Write the failing tests**

```js
// tests/spoils-loot.test.js
const test = require('node:test');
const assert = require('node:assert');
const { loadThread } = require('./_load');
const THREAD = loadThread();
const CANON = { rules: { spoils: { capture_ap_by_tier: { I: 3, II: 2, III: 1 }, capture_range: 1,
  capture_target_wounds: 1, loot_ap: 1, free_captive_ap: 1, sell_mult: { REMAINS: 0.5, CAPTIVE: 1.0 } },
  combat: {}, death: { revival_window: { windows: { Physical: 8, Warp: 3 } } } } };
const T = { type: 'SKIRMISH' };

function afterState() {
  return { pools: { A: 9 }, fog: {}, phase: 'aftermath', board: { w: 10, h: 10, tiles: null },
    combatants: {
      me: { party: 'A', w: [4, 4], x: 4, y: 4, model: { n: 'Winner', pc: 10,
        loadout: { slots: [{ type: 'ITEM', it: null }] } } },
      corpse: { party: 'B', w: [0, 4], x: 5, y: 4, dead: true, killElement: 'Warp',
        revivalWindow: 3, permaDeath: false, model: { n: 'Fallen', pc: 8, loadout: { slots: [
          { type: 'WEAPON', it: { n: 'Rustblade', cat: 'WEAPON', d: 'Phys 2 - Melee - 1 AP' } } ] } } } } };
}
test('loot gear: pieces move to state.spoils, corpse keeps its body', () => {
  const s = afterState();
  const b = [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }];
  assert.ok(THREAD.validate(T, s, 'A', b, CANON).ok);
  THREAD.apply(T, s, b, CANON);
  assert.strictEqual(s.spoils.length, 1);
  assert.strictEqual(s.spoils[0].n, 'Rustblade');
  assert.strictEqual(s.combatants.corpse.model.loadout.slots[0].it, null);
  assert.ok(!s.combatants.corpse.looted);   // body still there - gear and body loot are separate
});
test('loot body: REMAINS fills an empty slot, window carries the kill element', () => {
  const s = afterState();
  const b = [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body', meta: { day: 100 } } }];
  THREAD.apply(T, s, b, CANON);
  const it = s.combatants.me.model.loadout.slots[0].it;
  assert.ok(it && it.cat === 'REMAINS');
  assert.match(it.n, /Fallen/);
  assert.deepStrictEqual(it.window, { element: 'Warp', expiresDay: 103 });
  assert.ok(s.combatants.corpse.looted);
});
test('permadeath body: REMAINS has no revival window', () => {
  const s = afterState();
  s.combatants.corpse.permaDeath = true; s.combatants.corpse.revivalWindow = 0;
  THREAD.apply(T, s, [{ actor: 'me', cost: 1,
    effect: { kind: 'loot', corpse: 'corpse', what: 'body', meta: { day: 100 } } }], CANON);
  assert.strictEqual(s.combatants.me.model.loadout.slots[0].it.window, null);
});
test('validate rejects: looting outside the aftermath', () => {
  const s = afterState(); s.phase = null;
  assert.ok(!THREAD.validate(T, s, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }], CANON).ok);
});
test('validate rejects: body loot with no empty slot', () => {
  const s = afterState();
  s.combatants.me.model.loadout.slots[0].it = { n: 'Rock', cat: 'ITEM', d: '' };
  assert.ok(!THREAD.validate(T, s, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } }], CANON).ok);
});
test('validate rejects: looting a living model or twice-looted body', () => {
  const s1 = afterState(); s1.combatants.corpse.dead = false;
  assert.ok(!THREAD.validate(T, s1, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'gear' } }], CANON).ok);
  const s2 = afterState(); s2.combatants.corpse.looted = true;
  assert.ok(!THREAD.validate(T, s2, 'A',
    [{ actor: 'me', cost: 1, effect: { kind: 'loot', corpse: 'corpse', what: 'body' } }], CANON).ok);
});
```

- [ ] **Step 2: Run — expect FAIL**.
- [ ] **Step 3: Implement** — core helper next to `mkCaptive`:

```js
  function mkRemains(c,cid,meta){meta=meta||{};
    var win=null;
    if(!c.permaDeath&&(c.revivalWindow||0)>0&&meta.day!=null)
      win={element:c.killElement||'Physical',expiresDay:meta.day+c.revivalWindow};
    return {cat:'REMAINS',n:'Remains of '+((c.model&&c.model.n)||cid),
      d:'The dead, carried from the field. Revive within the window, sell, or offer at a door.',
      ref:snapOf(c,cid),owner_cmdr:meta.owner||null,origin:meta.origin||null,
      takenDay:meta.day!=null?meta.day:null,window:win};}
```

`validate` — extend the same per-entry loop:

```js
        if(ce&&ce.kind==='loot'){
          var lsp=(canon.rules&&canon.rules.spoils)||{};
          if(state.phase!=='aftermath')return {ok:false,reason:'Loot: only in the aftermath - the field must be won first'};
          var lac=state.combatants[cb.actor],lco=state.combatants[ce.corpse];
          if(!lac||!lco)return {ok:false,reason:'Loot: no such model'};
          if(!lco.dead)return {ok:false,reason:'Loot: they still breathe'};
          if(ce.what==='body'&&lco.looted)return {ok:false,reason:'Loot: this body is already taken'};
          if(lac.x==null||lco.x==null||cheb(lac,lco)>1)return {ok:false,reason:'Loot: not adjacent to the fallen'};
          if(ce.what==='body'&&!emptySlotOf(lac))return {ok:false,reason:'Loot: no empty slot to carry the body'};
          if((cb.cost||0)!==(lsp.loot_ap||1))return {ok:false,reason:'Loot: costs '+(lsp.loot_ap||1)+' AP'};}
```

`apply` — after the `free` branch:

```js
      else if(e.kind==='loot'){
        var _lc=state.combatants[e.corpse],_la=state.combatants[b.actor];
        if(_lc&&_la){
          if(e.what==='gear'){state.spoils=state.spoils||[];
            var _lsl=(_lc.model&&_lc.model.loadout&&_lc.model.loadout.slots)||[];
            _lsl.forEach(function(s){if(s.it){state.spoils.push(s.it);s.it=null;}});
            var _lar=_lc.model&&_lc.model.loadout&&_lc.model.loadout.armour;
            if(_lar&&_lar.it){state.spoils.push(_lar.it);_lar.it=null;}}
          else if(e.what==='body'){var _lslot=emptySlotOf(_la);
            if(_lslot){_lslot.it=mkRemains(_lc,e.corpse,e.meta||{});_lc.looted=true;}}}}
```

Export: add `mkRemains:mkRemains,`.

- [ ] **Step 4: Run — expect PASS**, then full `node --test`.
- [ ] **Step 5: Commit**
```bash
git add index.html tests/spoils-loot.test.js
git commit -m "core: aftermath looting - gear to spoils, body to a carried REMAINS with revival window"
```

---

### Task 6: Engine glue — staging capture/non-lethal on the board

**Files:**
- Modify: `index.html` — engine (outside the core): attack staging, NPC `weaponsOf` glue, board render

**Interfaces:**
- Consumes: `THREAD.captureTier`, `THREAD.emptySlotOf`, the staged-block pipeline (board click → stage → post → validate → apply).
- Produces: damage effects carry `nonLethal` when the weapon's `d` matches `/non-?lethal/i`; a standing **Capture** button per capture-item holder; corpse markers (`☠`) rendered at dead combatants' squares; a **Free captive** button when your model stands adjacent to a corpse carrying your side's CAPTIVE.

> No pure-core change here, so no new node test — the engine-syntax proxy (`tests/engine-syntax.test.js`) is the regression gate, plus browser verification in Task 9. Find the anchors by grep, not line number (they drift).

- [ ] **Step 1: Non-Lethal flag on staged attacks** — grep `kind:'damage'` **outside** the thread-core region (the board staging code and the `weaponsOf` glue used by `npcRespond`). At every place a damage effect is built from an item `it` (player staging) or a weapon list entry (NPC glue), add the flag:

```js
nonLethal:/non-?lethal/i.test((it.d||''))
```
(For the NPC `weaponsOf` glue: include `nonLethal` in the weapon descriptor and copy it into the effect where `npcTurn`'s block is consumed — `npcTurn` already passes through `noRevival`; mirror that pattern by extending the descriptor mapping and the effect construction.)

- [ ] **Step 2: Standing Capture button** — where the action block UI lists a selected model's attack buttons (grep `Attack - ` or the `combatCatalog` consumption), the new `kind:'capture'` catalog rows from Task 3 already surface. Wire their click: staging a capture requires a selected spotted enemy target `tid`:

```js
if(a.kind==='capture'){stageEffect({actor:a.actor,cost:a.cost,item:a.item,
  effect:{kind:'capture',to:tid,meta:{origin:locName(),day:curDay(),owner:'you'}}});}
```
Use the same staging helper the damage buttons use (grep how a weapon button pushes into the pending block and mirror it exactly, whatever its local name is). `locName()`/`curDay()`: reuse the location-name and world-day helpers already used by `concludeThread`/`WORLD` glue (grep `S.time` for the day counter). The button is ALWAYS rendered for holders (standing action); on invalid use the existing `validate` refusal path shows the reason string — do not pre-hide it.

- [ ] **Step 3: Corpse markers + Free button** — in the board cell renderer (grep the function that draws combatant glyphs per cell), render dead combatants at their square as a dim `☠` (they currently vanish or render as dead—verify). When the player's selected model is adjacent to a corpse whose slots hold a CAPTIVE with `ref.cid` belonging to the player's side, render a **Free captive (1 AP)** button that stages:

```js
{actor:selId,cost:D.rules.spoils.free_captive_ap,effect:{kind:'free',corpse:corpseId,cid:cap.ref.cid}}
```

- [ ] **Step 4: Verify** — `node --test` (engine-syntax proxy compiles), then a quick manual smoke: start a skirmish in the browser, confirm the Capture button renders for a Shackles-holder and a refused capture shows the validate reason. (Full E2E in Task 9.)
- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "engine: stage non-lethal flag, standing Capture action, corpse markers + Free captive"
```

---

### Task 7: Engine glue — aftermath flow + conclude conversions

**Files:**
- Modify: `index.html` — the post-pipeline outcome check (grep `THREAD.outcome(`), `concludeThread`, roster rendering

**Interfaces:**
- Consumes: `THREAD.outcome`, `concludeThread(t,oc)` (existing), `state.spoils`, CAPTIVE/REMAINS slot items.
- Produces: player victory → `state.phase='aftermath'` + RECORD banner + **END THREAD** button (calls `concludeThread` with the stored outcome); conversions on conclude; roster greying `TAKEN`; NPC-victor immediate conclude (NPCs don't loot in alpha).

- [ ] **Step 1: Defer the player-victory conclude** — at the outcome check after a post (grep `THREAD.outcome(`; it currently flows straight into `concludeThread(t,oc)`), replace with:

```js
var oc=THREAD.outcome(t,t.state);
if(oc){
  var mineWon=oc.victor&&myForceNames().indexOf(oc.victor)>=0;
  if(mineWon&&oc.kind==='annihilation'&&t.state.phase!=='aftermath'){
    t.state.phase='aftermath';t.state.pendingOutcome=oc;
    t.posts.push({who:'THE RECORD',tag:'',stamp:nowStamp(),
      body:'☠ THE FIELD IS YOURS - the enemy is broken. Walk the ground: loot the fallen (1 AP each), then END THREAD to withdraw with your spoils.'});
  } else concludeThread(t,oc);
}
```
Render an **END THREAD** button in `threadView` whenever `t.state.phase==='aftermath'`:

```js
var eb=E('button','btn','END THREAD - withdraw with your spoils');
eb.onclick=function(){concludeThread(t,t.state.pendingOutcome);openT(t.id)};
```

- [ ] **Step 2: Conversions in `concludeThread`** — after the wounds-sync loop and before `captureOnVictory`, add:

```js
 /* spoils conversion: carried CAPTIVE/REMAINS + looted gear -> inventory; greying */
 if(t.state&&t.state.spoils)t.state.spoils.forEach(function(it){S.inv.push(it)});
 Object.keys(C).forEach(function(id){var c=C[id];
  var sl=(c.model&&c.model.loadout&&c.model.loadout.slots)||[];
  var mineC=S.roster.some(function(r){return r.id===id});
  sl.forEach(function(s){var it=s.it;if(!it||(it.cat!=='CAPTIVE'&&it.cat!=='REMAINS'))return;
   if(mineC&&!c.dead){S.inv.push(it);s.it=null;
    T((it.cat==='CAPTIVE'?'⛓ ':'☠ ')+it.n+' — secured to your holdings.');}});
  if(c.captured&&!c.gen){var vm=S.roster.filter(function(r){return r.id===id})[0];
   if(vm){vm.st='TAKEN';vm.loc='held by the enemy';
    S.world.log.unshift(nowStamp()+' — '+vm.n.split(',')[0]+' was TAKEN alive. A ransom may follow.');}}});
```
(My dead models keep the existing `DEAD … recoverable` path — own-dead auto-recovery IS the current behaviour, unchanged. Unlooted enemy `gen` combatants simply vanish with the thread — auto-return needs no code for NPCs.)

- [ ] **Step 3: Early exit converts too (spec §4)** — in `exitThread` (grep it; the escape path around L1809-1822), before the force is released: run the same carried-CAPTIVE/REMAINS → `S.inv` conversion from Step 2 for **my surviving combatants only** — a carrier who exits the thread alive walks out with its cargo. Factor Step 2's slot-scan into a small helper `convertSpoils(t)` called from both `concludeThread` and `exitThread` rather than duplicating it.
- [ ] **Step 4: Roster greying** — in the Barracks roster render and force-builder eligibility (grep `st==='DEAD'` for the pattern), treat `st==='TAKEN'` the same as DEAD for force-building/equip gating, rendered with a `⛓ TAKEN` pill instead of the dead styling.
- [ ] **Step 5: Verify** — `node --test` green; manual smoke: win a skirmish → aftermath banner appears, thread does NOT conclude until END THREAD.
- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "engine: aftermath phase on victory, END THREAD, spoils conversion + TAKEN greying"
```

---

### Task 8: Inventory cards, verbs, pricing, Apothecarion revive

**Files:**
- Modify: `index.html` — inventory render (~L1432 Armoury `S.inv` loop), `sellPrice` (~L2828), `renderDoor` apothecarion + shop-sell branches, Comms ransom entry

**Interfaces:**
- Consumes: CAPTIVE/REMAINS items in `S.inv` (`ref` snapshot, `window`), `D.rules.spoils.sell_mult`, `sellPrice`, `doorSells`, apothecarion door branch, Comms trade widget.
- Produces: item cards with verb buttons; `sellPrice` handles the two categories; REMAINS revive at an Apothecarion; ransom via Comms.

- [ ] **Step 1: `sellPrice` extension** — replace the function body's first line so spoils price by snapshot:

```js
function sellPrice(it){
 if(it.cat==='CAPTIVE'||it.cat==='REMAINS'){
  var sm=(D.rules.spoils&&D.rules.spoils.sell_mult)||{REMAINS:0.5,CAPTIVE:1.0};
  return Math.max(1,Math.round(((it.ref&&it.ref.pc)||6)*(sm[it.cat]||0.5)));}
 var pc=it.pc||0;if(!pc){var c=doorCatalog('shop').concat(doorCatalog('altar')).filter(function(x){return x.n===it.n})[0];pc=c?c.pc:6}
 return Math.max(1,Math.round(pc*0.6))}
```
Also extend `doorSells` (grep it) so `kind==='shop'` accepts `'CAPTIVE'` and `'REMAINS'`. `doorSells` IS the spec's generic `accepts` hook for now — when the T-FAC-1 signature doors land, they declare their own accepted categories through this same function.

- [ ] **Step 2: Inventory cards with verbs** — in the Armoury/inventory loop (L1432 area), when `it.cat==='CAPTIVE'||it.cat==='REMAINS'`, render an extended card: name, snapshot line (`ref.cls · rank ref.rank · pc PC`), window line for REMAINS (`window ? 'Revival window: day '+it.window.expiresDay+' ('+it.window.element+')' : 'Beyond revival'`), an **Inspect** button opening the model overview from `ref` (reuse the overview overlay — grep the model-overview open function and feed it a synthetic model object built from `ref`), plus verbs:
  - CAPTIVE: **Release** — if `ref.cid` matches a roster model with `st==='TAKEN'` restore it (`st` recomputed like a revived model, `loc` cleared); always: remove item, log line. **Execute** — replace item with `mkRemainsFromCaptive(it)`:

```js
function mkRemainsFromCaptive(it){var w=(D.rules.death.revival_window.windows||{});
 return {cat:'REMAINS',n:it.n.replace(/^Captive: /,'Remains of '),d:'Executed in captivity.',
  ref:it.ref,owner_cmdr:it.owner_cmdr,origin:it.origin,takenDay:curDay(),
  window:{element:'Physical',expiresDay:curDay()+(w.Physical||8)}};}
```
  - Both: **Sell** appears only inside a shop door (existing sell list now includes them via Step 1).
- [ ] **Step 3: Apothecarion revive** — in `renderDoor`'s apothecarion branch (grep `apothecarion`), list `S.inv` REMAINS with a live window (`it.window && it.window.expiresDay >= curDay()`):
  - If `ref.cid` matches your roster model with `st==='DEAD'` or `'TAKEN'`-free: **Revive** → model returns (`st` cleared, `w='1/'+max`), item removed, toast.
  - Foreign remains (NPC snapshot): **Revive as captive** → item becomes a CAPTIVE (same `ref`, `cat` swap, name swap) — the stranger-revival rule.
  - Expired window: render disabled with `Beyond the window`.
- [ ] **Step 4: NPC ransom (both directions, minimal)** — in Comms (grep the trade widget block L2317-2333):
  - Player-held CAPTIVE of an NPC model: **Demand ransom** button → pays `Math.round(sellPrice(it)*1.5)` currency, removes item, log (`the enemy buys back its own`).
  - NPC-held (your `TAKEN` model): render a standing Comms entry per TAKEN roster model: **Pay ransom (`cost`)** where `cost=Math.round(m.pcEff*1.0)||sell-basis` → restores the model, deducts currency. Grep how currency deduction + toast are done in the shop cart (`S.cur-=`) and mirror.
- [ ] **Step 5: Verify + commit** — `node --test` green; smoke the verbs in-browser.
```bash
git add index.html
git commit -m "engine: CAPTIVE/REMAINS cards + verbs, spoils pricing, apothecarion revive, NPC ransom"
```

---

### Task 9: End-to-end browser verification

**Files:** none modified (fixes go to their owning task's files if found)

- [ ] **Step 1:** Ask Daak to serve (`! python3 -m http.server 8765`) or confirm it's already running; open `localhost:8765` via Playwright MCP with console-error capture.
- [ ] **Step 2:** Full loop: found/continue commander → buy **Shock Maul** + **Shackles** at a shop → start a skirmish → non-lethal a foe to exactly 1 wound (verify it cannot die from Shock Maul hits) → **Capture** (verify AP charge + slot fill + enemy leaves board) → win → aftermath banner → walk to a corpse, loot gear then body → **END THREAD** → verify `S.inv` holds CAPTIVE + REMAINS + gear → Armoury cards + Inspect overlay → shop sell price = spoils formula → apothecarion revive path → execute + release verbs → reload page → all of it persisted.
- [ ] **Step 3:** Verify the failure paths surface reasons: capture at 2 wounds, capture out of range, loot mid-battle, body-loot with full slots.
- [ ] **Step 4:** Zero console errors across all screens; `node --test` final run — record the passing count.
- [ ] **Step 5:** Commit any fixes (explicit paths), then Task 10.

---

### Task 10: Release the board

**Files:**
- Modify: `BACKLOG.md` (your two rows)

- [ ] **Step 1:** Set T-MISC-1 + T-ITEM-1 → `ready-to-push`, note the commit range, test count, browser-verification result, and exact paths touched (`index.html`, `heretics-40k-data-v1.json`, `tests/canon-spoils.test.js`, `tests/spoils-nonlethal.test.js`, `tests/spoils-capture.test.js`, `tests/spoils-free.test.js`, `tests/spoils-loot.test.js`, `BACKLOG.md`).
- [ ] **Step 2:**
```bash
git add BACKLOG.md
git commit -m "backlog: T-MISC-1 + T-ITEM-1 ready-to-push (capture & remains spine live)"
```
- [ ] **Step 3:** Tell Daak it awaits his push. Do NOT push.
