# Combat Conditions (T-CMB-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make combat tag-conditions (DoT, Regen, Slowing, Suppressing, …) actually tick, gate, and expire per the locked spec `docs/superpowers/specs/2026-07-25-combat-conditions-design.md`.

**Architecture:** A pure `CONDS` registry + `normCond`/`condMods`/`tickConds`/`applyCond` inside the existing `/*<thread-core>*/` region of `index.html`; `apply` ticks the posting side before staged effects; `validate` gains hard gates (actions/speed); thin engine glue for staging payloads and display. Node-tested via the existing extract-and-eval harness.

**Tech Stack:** Vanilla ES5 inside the thread-core region (match surrounding style — `function(){}`, no arrows/let/const in core); Node built-in test runner (`node --test`, zero dependencies) for tests.

## Global Constraints

- **⚠ LANE:** every task below edits `index.html` → 🔥 **hot engine lane**. The `spoils` session (capture/remains) holds it now — **do not start implementation until that task is `ready-to-push` and the lane is released.** Claim T-CMB-1 on `BACKLOG.md` (edit only its row, `git add BACKLOG.md`, commit `backlog: claim T-CMB-1`) before Task 1.
- Terminology law: always "model", never "chassis".
- Line numbers drift — **re-locate every edit anchor by the quoted code content**, not by line number.
- `git add <explicit paths>` only — NEVER `git add -A`.
- Keep `node --test` green at every commit. Do not push — Daak pushes.
- Spec values are law: no stacking (higher tier replaces, equal/lower refreshes), FIFO tick order, Suppressing = −1 action always (tier t = pin lasts t posts), Regen duration 2+t, hard gates everywhere, unknown tags inert-but-displayed.
- Base actions per model per post: `(canon.rules.combat && canon.rules.combat.actions_per_post) || 3`.

## File Structure

- `index.html` — all core code (inside `/*<thread-core>*/…/*</thread-core>*/`) + engine glue (staging, display). One file by project design; region discipline keeps it testable.
- `tests/conds.test.js` — new; all condition tests (registry, tick, gates, application, phase 2).
- `tests/_load.js` — unchanged (existing extract-and-eval loader).
- `heretics-40k-data-v1.json` — only if `D.tags` text repeats "stacks" claims (Task 6 checks; bump `meta.version` if edited).
- `BACKLOG.md` — claim row at start; `ready-to-push` row at end.

---

### Task 1: CONDS registry + normCond + condMods (pure core)

**Files:**
- Modify: `index.html` — inside the thread-core region, insert directly ABOVE the line `function npcTurn(side,state,board,weaponsOf){`
- Modify: `index.html` — the core's return object (the line beginning `return { passageCost:passageCost, wordCount:wordCount,`)
- Test: `tests/conds.test.js` (create)

**Interfaces:**
- Produces: `THREAD.CONDS` (registry object), `THREAD.normCond(x) → instance|null`, `THREAD.normConds(c)` (heals a combatant's array in place), `THREAD.condMods(c) → {speed,actions,dmgOut,dmgOutMelee,dmgIn}`, `THREAD.actionCap(c,canon) → int`.
- Instance shape (used by every later task): `{tag:'DoT', tier:2, left:4, src:'Bile Launcher', el:'Corrosive'}` (`el` may be null; `left:Infinity` = thread-long/unknown).

- [ ] **Step 1: Write the failing tests**

```js
// tests/conds.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

/* ── T-CMB-1 · Task 1: registry, normalisation, mods ── */

test('normCond: legacy tier strings become instances with full clocks', () => {
  assert.deepStrictEqual(THREAD.normCond('Regen II'),
    { tag: 'Regen', tier: 2, left: 4, src: null, el: null });   // duration 2+t
  assert.deepStrictEqual(THREAD.normCond('DoT III'),
    { tag: 'DoT', tier: 3, left: 5, src: null, el: null });
  assert.strictEqual(THREAD.normCond('Cast: Catalyst'), null);  // label junk drops
  const inst = { tag: 'Marked', tier: 1, left: 2, src: 'x', el: null };
  assert.strictEqual(THREAD.normCond(inst), inst);              // instances pass through
});

test('normCond: unknown tags become inert instances (left Infinity)', () => {
  const b = THREAD.normCond('Burning IV');
  assert.strictEqual(b.tag, 'Burning');
  assert.strictEqual(b.left, Infinity);
});

test('condMods: sums penalties and bonuses across instances', () => {
  const c = { conds: [
    { tag: 'Slowing', tier: 2, left: 1 },
    { tag: 'Suppressing', tier: 3, left: 3 },   // −1 action regardless of tier
    { tag: 'Rally', tier: 2, left: 1 },
    { tag: 'Charging', tier: 1, left: 1 },
    { tag: 'Marked', tier: 2, left: 3 },
    { tag: 'Burning', tier: 4, left: Infinity }, // unknown: contributes nothing
  ], w: [10, 10] };
  assert.deepStrictEqual(THREAD.condMods(c),
    { speed: -2, actions: -1, dmgOut: 2, dmgOutMelee: 1, dmgIn: 2 });
});

test('actionCap: base 3, Suppressing −1, Injured caps at 2, Critical at 1', () => {
  const fresh = { conds: [], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(fresh, canon), 3);
  const pinned = { conds: [{ tag: 'Suppressing', tier: 1, left: 1 }], w: [10, 10] };
  assert.strictEqual(THREAD.actionCap(pinned, canon), 2);
  const injured = { conds: [], w: [5, 10] };                    // ≤ half → Injured
  assert.strictEqual(THREAD.actionCap(injured, canon), 2);
  const critical = { conds: [], w: [1, 10] };                   // last band → Critical
  assert.strictEqual(THREAD.actionCap(critical, canon), 1);
  const both = { conds: [{ tag: 'Suppressing', tier: 2, left: 2 }], w: [1, 10] };
  assert.strictEqual(THREAD.actionCap(both, canon), 1);         // caps don't stack below 1
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/conds.test.js`
Expected: FAIL — `THREAD.normCond is not a function`.

- [ ] **Step 3: Implement in the thread-core region**

Insert above `function npcTurn(side,state,board,weaponsOf){`:

```js
  /* ── T-CMB-1 · combat conditions (spec 2026-07-25) ─────────────────
     Instance {tag,tier,left,src,el}. One per tag per model, no stacking.
     Registry is ADDITIVE: a new tag = one new entry; unknown tags are
     inert (no effect) but preserved & displayed. */
  var COND_DUR={DoT:function(t){return 2+t},Regen:function(t){return 2+t},
    Slowing:function(){return 1},Suppressing:function(t){return t},
    Charging:function(){return 1},Rally:function(){return 1},
    Marked:function(t){return 2+t},Immunity:function(){return Infinity}};
  var CONDS={
    DoT:{tick:function(i){return {dw:-i.tier}}},
    Regen:{tick:function(i){return {dw:+i.tier}}},
    Slowing:{mods:function(i){return {speed:-i.tier}}},
    Suppressing:{mods:function(){return {actions:-1}}},          // capped: never more
    Charging:{mods:function(i){return {dmgOutMelee:i.tier}}},
    Rally:{mods:function(i){return {dmgOut:i.tier}}},
    Marked:{mods:function(i){return {dmgIn:i.tier}}},
    Immunity:{},
    Draining:{instant:function(i,state,c){var p=c&&c.party;if(p!=null)state.pools[p]=Math.max(0,(state.pools[p]||0)-i.tier)}},
    Cleanse:{instant:function(i,state,c){if(!c||!c.conds)return;var NEG={DoT:1,Slowing:1,Suppressing:1,Marked:1};
      for(var k=c.conds.length-1;k>=0;k--)if(NEG[c.conds[k].tag])c.conds.splice(k,1)}}
  };
  function condDur(tag,tier){var f=COND_DUR[tag];return f?f(tier):Infinity}
  function normCond(x){
    if(x&&typeof x==='object'&&x.tag)return x;
    if(typeof x!=='string')return null;
    var m=x.match(/^([A-Za-z][A-Za-z ]*?)\s*(I{1,3}|IV|V|\d)?$/);
    if(!m)return null;
    var tag=m[1].trim(),tv=m[2]||'I';
    if(/[:.]/.test(x)||/\s{2,}/.test(x))return null;
    var tier=/^\d$/.test(tv)?parseInt(tv,10):({I:1,II:2,III:3,IV:4,V:5}[tv.toUpperCase()]||1);
    tag=tag.charAt(0).toUpperCase()+tag.slice(1);
    return {tag:tag,tier:tier,left:condDur(tag,tier),src:null,el:null};
  }
  function normConds(c){if(!c||!c.conds)return;
    for(var i=c.conds.length-1;i>=0;i--){var n=normCond(c.conds[i]);
      if(n)c.conds[i]=n;else c.conds.splice(i,1)}}
  function condMods(c){
    var out={speed:0,actions:0,dmgOut:0,dmgOutMelee:0,dmgIn:0};
    ((c&&c.conds)||[]).forEach(function(i){
      if(!i||!i.tag)return;var d=CONDS[i.tag];if(!d||!d.mods)return;
      var m=d.mods(i);for(var k in m)out[k]=(out[k]||0)+m[k]});
    return out;
  }
  function actionCap(c,canon){
    var base=(canon&&canon.rules&&canon.rules.combat&&canon.rules.combat.actions_per_post)||3;
    var n=base+condMods(c).actions;
    if(c.w&&c.w[1]){if(c.w[0]<=1)n=Math.min(n,1);           // Critical
      else if(c.w[0]<=c.w[1]/2)n=Math.min(n,2)}             // Injured
    return Math.max(1,Math.min(n, c.w&&c.w[1]?(c.w[0]<=1?1:(c.w[0]<=c.w[1]/2?2:n)):n));
  }
```

Then add to the core's return object (append before the closing `}`):
`, CONDS:CONDS, normCond:normCond, normConds:normConds, condMods:condMods, actionCap:actionCap, condDur:condDur`

- [ ] **Step 4: Run to verify pass**

Run: `node --test tests/conds.test.js` → all Task-1 tests PASS.
Run: `node --test` → whole suite green (boot proxy included).

Note: the `actionCap` line above double-guards the Critical/Injured caps; simplify to a single `Math.min` chain if the test stays green — final form:

```js
  function actionCap(c,canon){
    var base=(canon&&canon.rules&&canon.rules.combat&&canon.rules.combat.actions_per_post)||3;
    var n=base+condMods(c).actions;
    if(c.w&&c.w[1]){if(c.w[0]<=1)n=Math.min(n,1);else if(c.w[0]<=c.w[1]/2)n=Math.min(n,2)}
    return Math.max(1,n);
  }
```

(Critical still yields 1 because `Math.min(n,1)` runs before the floor.)

- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core: CONDS registry + normCond/condMods/actionCap (T-CMB-1 task 1)"
```

---

### Task 2: kill-stamp extraction + tickConds

**Files:**
- Modify: `index.html` — apply's damage branch (anchor: `if(c.w[0]<=0&&!c.dead){c.dead=true;c.killElement=e.element||null;`) and new core function below `actionCap`
- Test: `tests/conds.test.js` (append)

**Interfaces:**
- Consumes: `CONDS`, `normConds` (Task 1).
- Produces: `THREAD.stampKill(c, element, noRevival, canon)` (shared by apply + tickConds); `THREAD.tickConds(party, state, canon) → [{who,tag,delta,expired,died}]`.

- [ ] **Step 1: Write the failing tests**

```js
/* ── Task 2: the tick ── */
function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}

test('tickConds: DoT bites, Regen heals to cap, durations count down, expiry splices', () => {
  const state = { pools: {}, combatants: {
    a: combatant({ conds: [{ tag: 'DoT', tier: 2, left: 1, src: 'Bile', el: 'Corrosive' },
                           { tag: 'Regen', tier: 1, left: 3, src: null, el: null }] }),
    b: combatant({ party: 'B', conds: [{ tag: 'DoT', tier: 5, left: 4, src: null, el: null }] }),
  } };
  const rep = THREAD.tickConds('A', state, canon);
  const a = state.combatants.a;
  assert.strictEqual(a.w[0], 9);                       // −2 DoT, +1 Regen
  assert.strictEqual(a.conds.length, 1);               // DoT hit left:0 → spliced
  assert.strictEqual(a.conds[0].tag, 'Regen');
  assert.strictEqual(a.conds[0].left, 2);
  assert.strictEqual(state.combatants.b.w[0], 10);     // other side untouched
  assert.ok(rep.some(r => r.who === 'a' && r.tag === 'DoT' && r.delta === -2));
  assert.ok(rep.some(r => r.who === 'a' && r.tag === 'DoT' && r.expired));
});

test('tickConds: FIFO order decides life or death at 1 wound', () => {
  const mk = (conds) => ({ pools: {}, combatants: { m: combatant({ w: [1, 10], conds }) } });
  const dotFirst = mk([{ tag: 'DoT', tier: 1, left: 3, src: 'Venom', el: 'Corrosive' },
                       { tag: 'Regen', tier: 1, left: 3, src: null, el: null }]);
  THREAD.tickConds('A', dotFirst, canon);
  assert.strictEqual(dotFirst.combatants.m.dead, true);          // died before the heal
  assert.strictEqual(dotFirst.combatants.m.killElement, 'Corrosive');
  assert.ok(dotFirst.combatants.m.revivalWindow > 0);            // element-timed window stamped
  const regenFirst = mk([{ tag: 'Regen', tier: 1, left: 3, src: null, el: null },
                         { tag: 'DoT', tier: 1, left: 3, src: 'Venom', el: 'Corrosive' }]);
  THREAD.tickConds('A', regenFirst, canon);
  assert.ok(!regenFirst.combatants.m.dead);                      // healed to 2, bitten to 1
  assert.strictEqual(regenFirst.combatants.m.w[0], 1);
});

test('tickConds: Regen never exceeds max wounds; dead models do not tick', () => {
  const state = { pools: {}, combatants: {
    full: combatant({ w: [10, 10], conds: [{ tag: 'Regen', tier: 3, left: 2, src: null, el: null }] }),
    gone: combatant({ w: [0, 10], dead: true, conds: [{ tag: 'DoT', tier: 1, left: 2, src: null, el: null }] }),
  } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.full.w[0], 10);
  assert.strictEqual(state.combatants.gone.conds[0].left, 2);    // untouched
});

test('tickConds: unknown tags are inert and never expire', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'Burning', tier: 4, left: Infinity, src: null, el: null }] }) } };
  THREAD.tickConds('A', state, canon);
  assert.strictEqual(state.combatants.m.w[0], 10);
  assert.strictEqual(state.combatants.m.conds.length, 1);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/conds.test.js` → FAIL (`tickConds is not a function`).

- [ ] **Step 3: Implement**

(a) In apply's damage branch, replace the kill block (from `if(c.w[0]<=0&&!c.dead){` down to the end of the revival-window stamping, KEEPING the weapon-credit lines that follow inside it) with a call — extract exactly the existing semantics into:

```js
  function stampKill(c,element,noRevival,canon){
    c.dead=true;c.killElement=element||null;
    var RWd=(canon.rules&&canon.rules.death&&canon.rules.death.revival_window)||{};
    if(noRevival){c.revivalWindow=0;c.permaDeath=true;}
    else{var Wd=RWd.windows||{};c.revivalWindow=(element&&Wd[element])||Wd.Physical||3;c.permaDeath=false;}
  }
```

so the damage branch reads `if(c.w[0]<=0&&!c.dead){stampKill(c,e.element,e.noRevival,canon); …weapon-credit lines unchanged… }`.

(b) Add below `actionCap`:

```js
  function tickConds(party,state,canon){
    var rep=[];
    Object.keys(state.combatants).forEach(function(id){
      var c=state.combatants[id];
      if(!c||c.party!==party||c.dead)return;
      normConds(c);var conds=c.conds||[];
      for(var i=0;i<conds.length;i++){var inst=conds[i],d=CONDS[inst.tag];
        if(d&&d.tick&&!c.dead){var r=d.tick(inst,c);
          if(r&&r.dw){var nw=Math.max(0,Math.min(c.w[1],c.w[0]+r.dw));
            rep.push({who:id,tag:inst.tag,delta:nw-c.w[0],expired:false,died:false});
            c.w=[nw,c.w[1]];
            if(nw<=0&&!c.dead){stampKill(c,inst.el,false,canon);
              rep[rep.length-1].died=true;}}}
        if(inst.left!==Infinity)inst.left-=1;}
      for(var k=conds.length-1;k>=0;k--)if(conds[k].left<=0&&conds[k].left!==Infinity){
        rep.push({who:id,tag:conds[k].tag,delta:0,expired:true,died:false});
        conds.splice(k,1);}
    });
    return rep;
  }
```

(c) Export both: append `, stampKill:stampKill, tickConds:tickConds` to the return object.

- [ ] **Step 4: Run to verify pass** — `node --test tests/conds.test.js` then `node --test` (full suite; the extraction must not break `grid-damage`/`thread-outcome`/`canon-spoils` tests).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core: stampKill extraction + tickConds (FIFO, expiry, DoT kills) (T-CMB-1 task 2)"
```

---

### Task 3: wire the tick into apply (optional party arg) + damage-step mods

**Files:**
- Modify: `index.html` — `function apply(thread,state,block,canon){` and its damage branch
- Test: `tests/conds.test.js` (append)

**Interfaces:**
- Consumes: `tickConds`, `condMods` (Tasks 1–2).
- Produces: `THREAD.apply(thread,state,block,canon,party)` — 5th arg optional; when given (combat threads), the posting side's conditions tick FIRST and apply returns the tick report array (else `undefined`, preserving old callers). Damage branch now adds attacker `dmgOut` (+`dmgOutMelee` when `e.band==='MELEE'`) and target `dmgIn` before armour/cover.

- [ ] **Step 1: Write the failing tests**

```js
/* ── Task 3: tick-then-act inside apply + damage mods ── */
test('apply with party: posting side ticks BEFORE staged effects resolve', () => {
  const state = { pools: { A: 5 }, combatants: {
    hero: combatant({ conds: [{ tag: 'Regen', tier: 2, left: 2, src: null, el: null }], w: [3, 10] }),
    foe: combatant({ party: 'B' }),
  } };
  const rep = THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'hero', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 2, element: 'Physical' } }],
    canon, 'A');
  assert.strictEqual(state.combatants.hero.w[0], 5);   // regen landed first
  assert.strictEqual(state.combatants.foe.w[0], 8);    // then the attack
  assert.ok(Array.isArray(rep) && rep.length === 1);   // tick report returned
});

test('apply without party: legacy 4-arg behaviour unchanged (no tick)', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'DoT', tier: 1, left: 2, src: null, el: null }] }) } };
  const rep = THREAD.apply({ type: 'SKIRMISH' }, state, [], canon);
  assert.strictEqual(state.combatants.m.w[0], 10);
  assert.strictEqual(rep, undefined);
});

test('apply: Rally/Marked/Charging shift damage through condMods', () => {
  const base = () => ({ pools: { A: 9 }, combatants: {
    atk: combatant({ conds: [{ tag: 'Rally', tier: 2, left: 1 }, { tag: 'Charging', tier: 1, left: 1 }] }),
    tgt: combatant({ party: 'B', conds: [{ tag: 'Marked', tier: 1, left: 2 }] }),
  } });
  let s = base();   // ranged: Rally +2 and Marked +1 apply; Charging (melee-only) does not
  THREAD.apply({ type: 'SKIRMISH' }, s,
    [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'tgt', amount: 3, element: 'Physical' } }], canon, 'A');
  assert.strictEqual(s.combatants.tgt.w[0], 4);        // 10 − (3+2+1)
  s = base();       // melee: Charging +1 joins in
  THREAD.apply({ type: 'SKIRMISH' }, s,
    [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'tgt', amount: 3, element: 'Physical', band: 'MELEE' } }], canon, 'A');
  assert.strictEqual(s.combatants.tgt.w[0], 3);        // 10 − (3+2+1+1)
});
```

- [ ] **Step 2: Run to verify failure** — the first and third tests fail (no 5th arg handling; damage ignores mods).

- [ ] **Step 3: Implement**

(a) Change the signature to `function apply(thread,state,block,canon,party){` and insert as the FIRST lines of the body:

```js
    var tickRep;
    if(party!=null&&(thread.type==='SKIRMISH'||thread.type==='INVASION'))
      tickRep=tickConds(party,state,canon);
```

and make the function end with `return tickRep;` (after the existing `block.forEach` loop and any trailing logic).

(b) In the damage branch, immediately before the line `var _dv=(_def&&_def[e.element])||0;` insert:

```js
        var _am=state.combatants[b.actor]?condMods(state.combatants[b.actor]):{dmgOut:0,dmgOutMelee:0};
        var _tm=condMods(c);
        var _amt=e.amount+(_am.dmgOut||0)+((e.band==='MELEE')?(_am.dmgOutMelee||0):0)+(_tm.dmgIn||0);
```

and replace every subsequent use of `e.amount` in that branch with `_amt` (the `_taken` line and the `_abs` line).

- [ ] **Step 4: Run to verify pass** — `node --test` full suite. The legacy cover/armour tests still pass because models without conds get all-zero mods.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core: apply ticks posting side first (optional party arg) + cond damage mods (T-CMB-1 task 3)"
```

---

### Task 4: hard gates in validate + npcTurn obeys its own conditions

**Files:**
- Modify: `index.html` — `function validate(thread,state,party,block,canon){` (combat branch) and `function npcTurn(side,state,board,weaponsOf){`
- Test: `tests/conds.test.js` (append)

**Interfaces:**
- Consumes: `condMods`, `actionCap`.
- Produces: validate rejections — `'Suppressed/wounded: <id> has only N action(s) this post'` and `'Slowed: move exceeds reduced speed'`. `npcTurn` moves with `spd + mods.speed` and stages at most `actionCap` costed actions per model.

- [ ] **Step 1: Write the failing tests**

```js
/* ── Task 4: hard gates ── */
test('validate: action count is capped by Suppressing and wounds', () => {
  const state = { pools: { A: 99 }, combatants: {
    m: combatant({ conds: [{ tag: 'Suppressing', tier: 1, left: 1 }] }),   // cap 2
    foe: combatant({ party: 'B' }),
  } };
  const act = () => ({ actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } });
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', [act(), act()], canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', [act(), act(), act()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});

test('validate: free moves do not count against the action cap', () => {
  const state = { pools: { A: 99 }, combatants: {
    m: combatant({ w: [1, 10] }),                                          // Critical: cap 1
    foe: combatant({ party: 'B' }),
  } };
  const block = [
    { actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x: 1, y: 0 } } },
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', block, canon).ok);
});

test('validate: a Slowed model cannot move beyond its reduced speed', () => {
  const tiles = []; for (let i = 0; i < 8 * 8; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 8, tiles };
  const state = { pools: { A: 99 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, spd: 3, conds: [{ tag: 'Slowing', tier: 2, left: 1 }] }) } };
  const move = (x) => [{ actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x, y: 0 } } }];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', move(1), canon).ok);   // 3−2=1 ok
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', move(2), canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /slow/i);
});

test('npcTurn: a suppressed enemy stages fewer attacks; a slowed one closes less ground', () => {
  const tiles = []; for (let i = 0; i < 10; i++) tiles.push({ t: 'open' });
  const board = { w: 10, h: 1, tiles };
  const weps = () => [{ name: 'Claw', band: 'MELEE', ap: 1, damage: 2, element: 'Physical' }];
  const state = { pools: { B: 9 }, board, fog: { B: { spotted: { m: 1 }, ghosts: {} } }, combatants: {
    m: combatant({ x: 0, y: 0 }),
    e: combatant({ party: 'B', x: 5, y: 0, spd: 3, conds: [{ tag: 'Slowing', tier: 2, left: 1 }] }),
  } };
  const block = THREAD.npcTurn('B', state, board, weps);
  const mv = block.find(b => b.effect && b.effect.kind === 'move');
  assert.ok(mv, 'npc still tries to close');
  assert.ok(Math.abs(mv.effect.to.x - 0) >= 4, 'slowed npc moved at most 1 cell (from x=5 to x≥4)');
});
```

Note: the `fog` shape for `npcTurn`/`spottedEnemies` must match the existing helpers — copy the fog fixture pattern from `tests/grid-fog.test.js` (or the nearest grid test) if it differs from the shape above, keeping the assertion targets identical.

- [ ] **Step 2: Run to verify failure** — action-cap and slow-move tests FAIL (validate has no such gates today).

- [ ] **Step 3: Implement**

(a) In validate's combat branch, after the AP-pool check insert:

```js
      var _acts={};
      for(var ai=0;ai<block.length;ai++){var ab=block[ai],ae=ab.effect;
        if(ae&&ae.kind==='move')continue;                       // moves are free
        if(ab.cost==null&&!ae)continue;
        _acts[ab.actor]=(_acts[ab.actor]||0)+1;}
      for(var aid in _acts){var am=state.combatants[aid];if(!am)continue;
        var cap=actionCap(am,canon);
        if(_acts[aid]>cap)return {ok:false,
          reason:'Suppressed/wounded: '+aid+' has only '+cap+' action'+(cap>1?'s':'')+' this post'};}
      if(state.board){
        for(var mi=0;mi<block.length;mi++){var mb=block[mi],me=mb.effect;
          if(!me||me.kind!=='move')continue;
          var mm=state.combatants[me.who||mb.actor];if(!mm||mm.x==null)continue;
          var msp=Math.max(0,(mm.spd||0)+condMods(mm).speed);
          var occ=[];for(var oid in state.combatants){var oc=state.combatants[oid];
            if(oid!==(me.who||mb.actor)&&oc&&!oc.dead&&oc.x!=null)occ.push({x:oc.x,y:oc.y});}
          var rs=reachable({x:mm.x,y:mm.y},msp,state.board,occ);
          if(!rs[me.to.x+','+me.to.y])return {ok:false,reason:'Slowed: move exceeds reduced speed'};}}
```

(b) In `npcTurn`: where the move computes `reachable(pos[aid],me.spd||0,board,occ)` change the speed argument to `Math.max(0,(me.spd||0)+condMods(me).speed)`; and wrap the attack push in a per-model counter so a model never stages more than `actionCap(me,canon)` costed actions — `npcTurn` gains `canon` as a new trailing parameter (`function npcTurn(side,state,board,weaponsOf,canon)`), defaulted safely (`canon=canon||{rules:{}}`) so the existing engine call site keeps working, then pass `canon` through from the engine's `npcRespond` glue.

- [ ] **Step 4: Run to verify pass** — `node --test` full suite (the T-NPC-2b tests must stay green with the defaulted param).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core: hard condition gates in validate + npcTurn obeys mods (T-CMB-1 task 4)"
```

---

### Task 5: application path — real payloads, Immunity, refresh-or-replace, instants

**Files:**
- Modify: `index.html` — apply's cond branch (anchor: `else if(e.kind==='cond'&&c){c.conds=c.conds||[];c.conds.push(e.add);}`), new core `applyCond`, and the engine staging line (anchor: `if(a.group==='y'||a.group==='a')return {kind:'cond',add:a.action,to:a.actor};`)
- Test: `tests/conds.test.js` (append)

**Interfaces:**
- Consumes: `CONDS`, `normCond`, `condDur`.
- Produces: `THREAD.applyCond(state, targetId, add, canon) → {applied|refreshed|replaced|blocked|instant}` where `add = {tag, tier, src, el}`. Staged cond effects now carry `{kind:'cond', add:{tag,tier,src,el}, to:targetId}` — the engine builds `add` from the item's parsed tags (`parseItem`), one staged effect per condition-tag, targets chosen by the player (allies for buffs via a picker; the attack target for hostile tags). Rally expands at staging to one effect per living ally.

- [ ] **Step 1: Write the failing tests**

```js
/* ── Task 5: application rules ── */
test('applyCond: no stacking — higher tier replaces, equal/lower refreshes the clock', () => {
  const state = { pools: {}, combatants: { m: combatant({}) } };
  THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 2, src: 'Bile', el: 'Corrosive' }, canon);
  assert.strictEqual(state.combatants.m.conds.length, 1);
  state.combatants.m.conds[0].left = 1;                                       // nearly over
  const r1 = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 1, src: 'Sting', el: null }, canon);
  assert.strictEqual(r1.refreshed, true);
  assert.strictEqual(state.combatants.m.conds[0].tier, 2);                    // lower did NOT downgrade
  assert.strictEqual(state.combatants.m.conds[0].left, THREAD.condDur('DoT', 2));
  const r2 = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 3, src: 'Plague', el: 'Corrosive' }, canon);
  assert.strictEqual(r2.replaced, true);
  assert.strictEqual(state.combatants.m.conds.length, 1);
  assert.strictEqual(state.combatants.m.conds[0].tier, 3);
});

test('applyCond: Immunity blocks its stated tag', () => {
  const state = { pools: {}, combatants: {
    m: combatant({ conds: [{ tag: 'Immunity', tier: 1, left: Infinity, src: null, el: null, of: 'DoT' }] }) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'DoT', tier: 2, src: null, el: null }, canon);
  assert.strictEqual(r.blocked, true);
  assert.strictEqual(state.combatants.m.conds.length, 1);
});

test('applyCond: Draining bites the AP pool immediately, stores nothing', () => {
  const state = { pools: { B: 5 }, combatants: { m: combatant({ party: 'B' }) } };
  const r = THREAD.applyCond(state, 'm', { tag: 'Draining', tier: 2, src: null, el: null }, canon);
  assert.strictEqual(r.instant, true);
  assert.strictEqual(state.pools.B, 3);
  assert.strictEqual(state.combatants.m.conds.length, 0);
});

test('applyCond: Cleanse strips the negative set, leaves buffs', () => {
  const state = { pools: {}, combatants: { m: combatant({ conds: [
    { tag: 'DoT', tier: 1, left: 2 }, { tag: 'Regen', tier: 1, left: 2 },
    { tag: 'Suppressing', tier: 1, left: 1 }, { tag: 'Marked', tier: 2, left: 3 }] }) } };
  THREAD.applyCond(state, 'm', { tag: 'Cleanse', tier: 1, src: null, el: null }, canon);
  assert.deepStrictEqual(state.combatants.m.conds.map(c => c.tag), ['Regen']);
});

test('apply: cond effects route through applyCond (end-to-end)', () => {
  const state = { pools: { A: 5 }, combatants: {
    caster: combatant({}), ally: combatant({}) } };
  THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'caster', cost: 2, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2, src: 'Catalyst', el: null }, to: 'ally' } }],
    canon, 'A');
  const inst = state.combatants.ally.conds[0];
  assert.strictEqual(inst.tag, 'Regen');
  assert.strictEqual(inst.left, THREAD.condDur('Regen', 2));
  assert.strictEqual(inst.src, 'Catalyst');
});
```

- [ ] **Step 2: Run to verify failure** — `applyCond is not a function`; the end-to-end case pushes a raw object without a clock.

- [ ] **Step 3: Implement**

(a) Core, below `tickConds`:

```js
  function applyCond(state,targetId,add,canon){
    var c=state.combatants[targetId];if(!c)return {blocked:true};
    c.conds=c.conds||[];normConds(c);
    var d=CONDS[add.tag];
    if(d&&d.instant){d.instant({tag:add.tag,tier:add.tier||1},state,c);return {instant:true};}
    for(var i=0;i<c.conds.length;i++)
      if(c.conds[i].tag==='Immunity'&&c.conds[i].of===add.tag)return {blocked:true};
    var inst={tag:add.tag,tier:add.tier||1,left:condDur(add.tag,add.tier||1),
              src:add.src||null,el:add.el||null};
    if(add.of)inst.of=add.of;
    for(var j=0;j<c.conds.length;j++)if(c.conds[j].tag===add.tag){
      if(inst.tier>c.conds[j].tier){c.conds[j]=inst;return {replaced:true};}
      c.conds[j].left=condDur(c.conds[j].tag,c.conds[j].tier);return {refreshed:true};}
    c.conds.push(inst);return {applied:true};
  }
```

Export: append `, applyCond:applyCond` to the return object.

(b) Replace apply's cond branch body with:

```js
      else if(e.kind==='cond'&&c){
        applyCond(state,e.to,(e.add&&e.add.tag)?e.add:{tag:String(e.add),tier:1},canon);}
```

(the string fallback keeps any un-migrated staged effect from crashing — `normCond` semantics via the `{tag:String}` wrap are acceptable because tickConds normalises on its next pass).

(c) Engine staging (outside the core; anchor `if(a.group==='y'||a.group==='a')return {kind:'cond',add:a.action,to:a.actor};`): replace with a builder that runs the item through the existing `parseItem`, takes its first condition-tag (tags whose name is a `CONDS` key or any `Tag Tier` pair), and returns `{kind:'cond',add:{tag,tier,src:it.n,el:elementOf(it)},to:target}` where `target` is: the staged enemy target for hostile tags (DoT/Slowing/Suppressing/Marked/Draining), else a picker-chosen ally defaulting to self. Rally expands to one effect per living same-side model. The picker is the same minimal chooser UI pattern used by the existing capture-target flow — reuse it.

- [ ] **Step 4: Run to verify pass** — `node --test` full suite; then boot proxy (`tests/engine-syntax.test.js`) confirms the engine edit parses.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core+engine: applyCond (immunity/refresh/replace/instants) + real staged cond payloads (T-CMB-1 task 5)"
```

---

### Task 6: display glue + rules-text corrections + browser verify

**Files:**
- Modify: `index.html` — GLOSS entries (`'DoT'`, `'Suppressing'`), the board tooltip line (anchor: `o.c.conds&&o.c.conds.length?' · '+o.c.conds.join(', ')`), model overview cond rendering, battle-report assembly at the `apply` call sites (render the returned tick report)
- Modify: `heretics-40k-data-v1.json` — ONLY if `D.tags` text claims stacking (check: `python3 -c "import json;d=json.load(open('heretics-40k-data-v1.json'));import re;print([t for t in json.dumps(d.get('tags',{})).split(',') if 'tack' in t])"`); if edited, bump `meta.version`
- Test: none new (display); full suite must stay green

**Interfaces:**
- Consumes: instance shape, `apply`'s tick-report return, GLOSS.

- [ ] **Step 1: GLOSS corrections** — `'DoT'` entry: remove the sentence "Stacks with itself." and append "Does not stack — a stronger hit replaces it, a weaker one resets the clock."; `'Suppressing'` entry becomes: `function(t){t=t||1;return 'Pins the target: it loses 1 action per post for '+t+' post'+(t>1?'s':'')+' (tier '+t+').'}`. Apply the same corrections in canon `D.tags` if the check above finds matching text (then bump `meta.version` and note it in the commit).
- [ ] **Step 2: Cond formatting** — one small engine helper `condLabel(i)` → `i.tag+' '+['','I','II','III','IV','V'][i.tier]+(i.left!==Infinity?' · '+i.left+'p':'')`; use it in the board tooltip join and the model-overview cond row.
- [ ] **Step 3: Battle report** — at each combat `apply` call site in `threadView`/`npcRespond`, pass the poster's party as the 5th arg and prepend the returned report to the post's battle-report lines: healing → `'<who> regenerates N'`, damage → `'<who> suffers N (<tag>, <src>)'`, `died` → the existing kill phrasing, `expired` → `'<tag> on <who> ends'`.
- [ ] **Step 4: Verify** — `node --test` green; then `python3 -m http.server 8765`, exercise: found a skirmish → use a Regen-granting cast on an ally → confirm the picker, the card countdown, the tick line next post, the expiry line; use a DoT weapon → confirm tick damage and a DoT death stamps a revival window; 0 console errors (Playwright MCP if the shared browser is free — else mark UNVERIFIED in the backlog row like T-NPC-2b did).
- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: condition display + tick battle-report lines + GLOSS stacking/suppressing corrections (T-CMB-1 task 6)"
# plus heretics-40k-data-v1.json in the add list IF canon text was edited (say so in the message)
```

---

### Task 7: Phase 2 — Shield, Ward, Decoy in the damage step

**Files:**
- Modify: `index.html` — CONDS registry entries + apply's damage branch (before armour), COND_DUR entries
- Test: `tests/conds.test.js` (append)

**Interfaces:**
- Consumes: instance shape, damage branch `_amt` from Task 3.
- Produces: damage interception order **Decoy → Shield → Ward → armour → cover**; Shield instance carries `pool` (absorb remaining: tier→[0,1,2,4][t]); Decoy carries `charges:t`; Ward reduces `_amt` by tier when `inst.el===e.element`. All three are `left:Infinity` (until consumed / thread end).

- [ ] **Step 1: Write the failing tests**

```js
/* ── Task 7: the damage-step trio ── */
const dmg = (to, amount, element) =>
  [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to, amount, element: element || 'Physical' } }];

test('Decoy: eats whole attacks, then is spent', () => {
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), tgt: combatant({ party: 'B',
      conds: [{ tag: 'Decoy', tier: 1, left: Infinity, charges: 1 }] }) } };
  THREAD.apply({ type: 'SKIRMISH' }, state, dmg('tgt', 4), canon, 'A');
  assert.strictEqual(state.combatants.tgt.w[0], 10);            // missed entirely
  THREAD.apply({ type: 'SKIRMISH' }, state, dmg('tgt', 4), canon, 'A');
  assert.strictEqual(state.combatants.tgt.w[0], 6);             // decoy spent
  assert.ok(!state.combatants.tgt.conds.some(c => c.tag === 'Decoy'));
});

test('Shield: absorbs its pool then depletes; Ward shaves matching-element damage', () => {
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), tgt: combatant({ party: 'B', conds: [
      { tag: 'Shield', tier: 2, left: Infinity, pool: 2 },
      { tag: 'Ward', tier: 1, left: Infinity, el: 'Heat' }] }) } };
  THREAD.apply({ type: 'SKIRMISH' }, state, dmg('tgt', 3, 'Heat'), canon, 'A');
  // 3 − Ward 1 = 2 → Shield eats 2 → 0 through
  assert.strictEqual(state.combatants.tgt.w[0], 10);
  assert.ok(!state.combatants.tgt.conds.some(c => c.tag === 'Shield'), 'shield depleted');
  THREAD.apply({ type: 'SKIRMISH' }, state, dmg('tgt', 3, 'Physical'), canon, 'A');
  assert.strictEqual(state.combatants.tgt.w[0], 7);             // Ward is Heat-only
});
```

- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** — in the damage branch after `_amt` is computed and before `_dv`:

```js
        var _iv=(c.conds||[]),_skip=false;
        for(var _ci=_iv.length-1;_ci>=0;_ci--){var _in=_iv[_ci];
          if(_in.tag==='Decoy'&&_in.charges>0){_in.charges-=1;_skip=true;
            if(_in.charges<=0)_iv.splice(_ci,1);break;}}
        if(_skip)return;
        for(var _wi=0;_wi<_iv.length;_wi++)if(_iv[_wi].tag==='Ward'&&_iv[_wi].el===e.element)
          _amt=Math.max(0,_amt-_iv[_wi].tier);
        for(var _si=_iv.length-1;_si>=0;_si--){var _sh=_iv[_si];
          if(_sh.tag!=='Shield')continue;var _eat=Math.min(_sh.pool||0,_amt);
          _amt-=_eat;_sh.pool-=_eat;if(_sh.pool<=0)_iv.splice(_si,1);}
```

Add COND_DUR entries `Shield/Ward/Decoy: function(){return Infinity}` and make `applyCond` stamp `pool:[0,1,2,4][tier]||tier` on Shield and `charges:tier` on Decoy when creating the instance.

- [ ] **Step 4: Run to verify pass** — `node --test` full suite.
- [ ] **Step 5: Commit**

```bash
git add index.html tests/conds.test.js
git commit -m "core: Shield/Ward/Decoy damage-step interception (T-CMB-1 phase 2)"
```

---

### Task 8: finish — full verify + board row

**Files:**
- Modify: `BACKLOG.md` (T-CMB-1 row only)

- [ ] **Step 1:** `node --test` — entire suite green; record the count.
- [ ] **Step 2:** Browser pass per Task 6 Step 4 if not yet done (or carry the UNVERIFIED flag honestly).
- [ ] **Step 3:** Update the T-CMB-1 row: `ready-to-push`, owner/session, test count, the exact commit list, and the browser-verification status. `git add BACKLOG.md && git commit -m "backlog: T-CMB-1 ready-to-push"`. **Do not push.**
