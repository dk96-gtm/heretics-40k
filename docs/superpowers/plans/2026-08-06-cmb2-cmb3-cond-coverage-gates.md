# T-CMB-2 (Cond Coverage Sweep) + T-CMB-3 (Validate Cond-Gating) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every condition tag printed on canon gear mechanically true (T-CMB-2), then close the fog/range/allegiance/action-count gates on `kind:'cond'` effects so `validate()` is exploit-tight for its Stage-2 server-authority role (T-CMB-3).

**Architecture:** Two serialized board rows in one session. Phase A (Tasks 1–5, T-CMB-2) extends the SHIPPED T-CMB-1 staging path — `parseItem` grammar → `condTagsOf` → `condEffectsFor`/new `weaponCondEffects` → `applyCond` — so weapon-borne hostile conds and previously-unparseable canon phrasings stage for real. Phase B (Tasks 6–10, T-CMB-3) hardens the pure `THREAD.validate` with allegiance/fog/range gates on cond effects plus the all-fanout ≥1-action rule, and mirrors the range gate in the battle UI. Task 11 is the cross-row lifecycle final review.

**Tech Stack:** Vanilla JS single-file engine (`index.html`), pure regions extracted-and-eval'd by zero-dep `node --test` tests, Playwright MCP for browser E2E.

## Global Constraints

- **Scope law: COMBAT TAGS ONLY.** Shield/Ward/Decoy = T-CMB-4 (parked). Location/sector conditions (`galaxy.conditions`, `status_effects`) = T-STAT-1. Do NOT touch either. `condTagsOf` filters to `THREAD.CONDS`-registered tags, which enforces this automatically — Shield/Decoy/Stimm items parse for *display* but never become stageable.
- **No new rules.** Auras ("Enemies in Melee range take DoT I each post"), weapon-mod grants ("Melee weapon gains DoT I"), on-kill triggers ("Death's Jest"), attack-rider grants ("Sonic Assault"), usage limits ("1/thread"), and cooldowns ("CD 2") stay unwired. This plan only makes *already-shipped* mechanics reachable.
- **Rulings that bind (Daak 2026-07-28, spec addendum):** NL-sourced DoT floors ticks at 1 wound · aftermath/deploy freeze conds · DoT kills carry full credit/permadeath · **hostile conds gate by the item's stated range band, default SHORT; buffs stay range-free** (§4).
- **Rulings you must not disturb (T-MSN-1C, 2026-08-05):** DoT-tick kills do NOT credit streaks the same as blows where excluded; arena-door combats spawn exactly ONE champion (duel) — do not touch `genHostiles`/duel spawn paths; `concludeThread` AND `exitThread`'s flee path both tick streaks — do not touch either.
- **Canon is v1.31, suite baseline 516/516.** No canon (`heretics-40k-data-v1.json`) edits are planned in this run. If a fix wave forces one: bump `meta.version` to `1.32` AND update every `1\.31` pin site (grep across the 5 canon test files).
- **Terminology law:** always "model", never "chassis".
- **Pure logic lives in the marked regions** (`/*<thread-core>*/`, `/*<item-parse-glue>*/`, `/*<cond-staging-glue>*/`) — DOM-free, reads no globals. Engine glue outside regions may use `THREAD`/`D`/DOM.
- **`node --test` green at EVERY pause.** Browser-verify (Playwright, 0 console errors) before each engine commit. `window._noPersist=true` before touching any profile state in E2E.
- **Git:** explicit paths only, NEVER `-A`. Commit per task. **Daak pushes; you do not.**
- **New `S`/`S.world` keys** would need seeding in BOTH `foundingWorld()` and `init()` — this plan adds none (thread state lives on `t.state`, already persisted).

## Known false-position inventory (verified against canon v1.31 before planning)

The `;` splitter change (Task 1) touches exactly these gear rows — all outcomes verified as improvements or no-ops, none regress an existing parse (element/range/AP/tag branches are whole-segment anchored, so any `;`-containing segment was previously a `.notes` blob):

- Chaos Icon / Banner of Blood / War Hymn → their `Rally I` now parses; trailing clauses become notes.
- 'Eadbanger / Solar Pulse / Ancestral Judgement / Banishment → range/Multihit display tags now parse (display-only bonus).
- Mirror-Polish Plate / Praesidium Shield / Holo-Field / Shadowfield / Domino Field / Combat Drugs / Butcher's Nails → Shield/Decoy/Stimm parse as display tags; NOT stageable (no CONDS entry — T-CMB-4 scope law holds).
- Charge → `gain Charging (+1 dmg this post)` now parses via the `gains?` prefix + parenthetical strip → Charging becomes a stageable self-buff (registry entry + mods shipped in T-CMB-1; staging it then a melee attack in the same block applies the +tier melee bonus, which is exactly what the ability text promises).
- Legendaries with `;` → long prose sub-segments stay notes. No behavior change.

Deliberately still-dead text (out of scope, listed so the final review doesn't flag them): Censer Bearer's Kit, Nurgle's Gift, Death's Jest, Sonic Assault, Toxin Sacs, Warpflame Ichor, Power From Pain, Lingering Agony, Reckless Charge's "+2 dmg", Node-Spore legendary, "1/thread" limits, "CD n" cooldowns, canon duration phrases that disagree with registry durations ("for 2 posts" vs Regen's 2+t — registry wins, locked).

---

# PHASE A — T-CMB-2 · Cond Coverage Sweep (board row `in-progress`, engine lane)

### Task 1: parseItem grammar normalization

**Files:**
- Modify: `index.html` — `/*<item-parse-glue>*/` region (~line 4654–4738): hoist tag regex to `TAGRE`, add `;` to the splitter, add the normalization retry branch.
- Create: `tests/_condglue.js` — shared extract-and-eval loader (extended export list).
- Create: `tests/cond-coverage.test.js`

**Interfaces:**
- Consumes: existing `parseItem(it)`, `tierNum`, `cap`, `RANGES`, `ELEMFULL` (item-parse-glue); `THREAD` via `tests/_load.js`.
- Produces: `parseItem` newly recognises prefixed/suffixed tag segments; `tests/_condglue.js` exports `loadCondGlue(THREAD)` returning `{condTagsOf, condEffectsFor, livingAllies, cleanseReach, condIsHostile, parseItem, bfCondItemsOf, weaponCondEffects}` — **the last two exist only after Tasks 2–3; the loader must tolerate them being absent until then (`typeof x==='undefined'?null:x` pattern), so it can ship complete in this task.**

- [ ] **Step 1: Write `tests/_condglue.js`** (new file, modeled on the `loadCondGlue` in `tests/conds.test.js:18-28` — do NOT modify `conds.test.js`):

```js
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');

// Extracts the two marked glue regions from index.html and evals them against the real
// THREAD — same technique as tests/_load.js. Extended export list for T-CMB-2/3; names
// that don't exist yet (bfCondItemsOf, weaponCondEffects land in later tasks) resolve null.
function loadCondGlue(THREAD) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const parse = html.match(/\/\*<item-parse-glue>\*\/([\s\S]*?)\/\*<\/item-parse-glue>\*\//);
  const glue = html.match(/\/\*<cond-staging-glue>\*\/([\s\S]*?)\/\*<\/cond-staging-glue>\*\//);
  if (!parse) throw new Error('item-parse-glue region not found in index.html');
  if (!glue) throw new Error('cond-staging-glue region not found in index.html');
  const names = ['condTagsOf', 'condEffectsFor', 'livingAllies', 'cleanseReach',
    'condIsHostile', 'parseItem', 'bfCondItemsOf', 'weaponCondEffects'];
  const ret = names.map(n => n + ':(typeof ' + n + '==="undefined"?null:' + n + ')').join(',');
  const src = '(function(THREAD){' + parse[1] + '\n' + glue[1] + '\n;return {' + ret + '};})';
  return vm.runInThisContext(src)(THREAD);
}
module.exports = { loadCondGlue };
```

- [ ] **Step 2: Write the failing tests** in `tests/cond-coverage.test.js`. Test against REAL canon rows pulled from the loaded JSON (house pattern: canon is the fixture), plus synthetic edge strings:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');
const { loadCondGlue } = require('./_condglue');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const G = loadCondGlue(THREAD);

function gear(cat, n) {
  const r = (canon[cat] || []).filter(x => x.n === n)[0];
  assert.ok(r, cat + ' has ' + n);
  return r;
}
function tagsOf(it) { return G.parseItem(it).tags.map(t => t.tag + (t.tier ? ' ' + t.tier : '')); }

/* ── T-CMB-2 Task 1: grammar normalization against real canon ── */

test('grammar: "applies DoT II" phrasing parses (Curse of the Leper)', () => {
  assert.ok(tagsOf(gear('casts', 'Curse of the Leper')).indexOf('DoT II') >= 0);
});

test('grammar: "Ally:" prefix + "for N posts" suffix parse (Catalyst, Fecund Vigour, Ichor Injection)', () => {
  assert.ok(tagsOf(gear('casts', 'Catalyst')).indexOf('Regen II') >= 0);
  assert.ok(tagsOf(gear('casts', 'Fecund Vigour')).indexOf('Regen II') >= 0);
  assert.ok(tagsOf(gear('casts', 'Ichor Injection')).indexOf('Regen I') >= 0);
});

test('grammar: "Target:" prefix parses both tags of Telekinetic Grip', () => {
  const t = tagsOf(gear('casts', 'Telekinetic Grip'));
  assert.ok(t.indexOf('Slowing II') >= 0);
  assert.ok(t.indexOf('Suppressing I') >= 0);
});

test('grammar: "Apply Marked II to a target" parses (Markerlight, Doom, Bring It Down)', () => {
  assert.ok(tagsOf(gear('items', 'Markerlight')).indexOf('Marked II') >= 0);
  assert.ok(tagsOf(gear('abilities', 'Doom')).indexOf('Marked II') >= 0);
  assert.ok(tagsOf(gear('abilities', 'Bring It Down')).indexOf('Marked I') >= 0);
});

test('grammar: "at Long range" suffix parses AND recovers the range (Target Uplink)', () => {
  const p = G.parseItem(gear('casts', 'Target Uplink'));
  assert.ok(p.tags.some(t => t.tag === 'Marked' && t.tier === 'II'));
  assert.strictEqual(p.range, 'Long');
});

test('grammar: trailing parenthetical strips (Living Metal, War Hymn via ; split)', () => {
  assert.ok(tagsOf(gear('abilities', 'Living Metal')).indexOf('Regen I') >= 0);
  assert.ok(tagsOf(gear('abilities', 'War Hymn')).indexOf('Rally I') >= 0);
});

test('grammar: semicolon splitting frees the leading tag (Chaos Icon, Banner of Blood)', () => {
  assert.ok(tagsOf(gear('items', 'Chaos Icon')).indexOf('Rally I') >= 0);
  assert.ok(tagsOf(gear('items', 'Banner of Blood')).indexOf('Rally I') >= 0);
});

test('grammar: "gain Charging (...)" parses — Charge stages its own Charging buff', () => {
  assert.ok(tagsOf(gear('abilities', 'Charge')).indexOf('Charging') >= 0);
});

test('grammar: Immunity segments are exempt from normalization — condTagsOf recovery still yields of', () => {
  const ct = G.condTagsOf(gear('items', 'Rebreather'));
  assert.deepStrictEqual(ct, [{ tag: 'Immunity', tier: 1, of: 'DoT' }]);
  const ii = G.condTagsOf(gear('casts', 'Ichor Injection'));
  assert.ok(ii.some(c => c.tag === 'Immunity' && c.of === 'DoT'));
});

test('grammar: aura/weapon-mod phrasings deliberately stay notes (scope law)', () => {
  assert.strictEqual(G.condTagsOf(gear('items', 'Toxin Sacs')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', "Censer Bearer's Kit")).length, 0);
  assert.strictEqual(G.condTagsOf(gear('abilities', 'Sonic Assault')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', 'Warpflame Ichor')).length, 0);
});

test('grammar: Shield/Decoy/Stimm parse for display but are NOT stageable (T-CMB-4 scope law)', () => {
  assert.ok(G.parseItem(gear('items', 'Mirror-Polish Plate')).tags.some(t => t.tag === 'Decoy'));
  assert.strictEqual(G.condTagsOf(gear('items', 'Mirror-Polish Plate')).length, 0);
  assert.strictEqual(G.condTagsOf(gear('items', 'Combat Drugs')).length, 0);
});

test('grammar: plain weapon tag segments unchanged (regression guard)', () => {
  assert.ok(tagsOf(gear('weapons', 'Thunder Hammer')).indexOf('Suppressing I') >= 0);
  const p = G.parseItem(gear('weapons', 'Venom Cannon'));
  assert.strictEqual(p.element, 'Corrosive');
  assert.strictEqual(p.range, 'Long');
  assert.ok(p.tags.some(t => t.tag === 'DoT' && t.tier === 'II'));
});
```

- [ ] **Step 3: Run to verify the new tests fail** — `node --test tests/cond-coverage.test.js` — expect failures on the grammar tests (Curse of the Leper, Catalyst, etc.); the regression-guard and scope-law tests may already pass.

- [ ] **Step 4: Implement in `index.html` item-parse-glue.** Three edits:

(a) Change the splitter (line ~4726):
```js
var d=(it.d||''),parts=d.split(/\s*[-·+;]\s*/).map(...)
```

(b) Hoist the tag regex — immediately above `function parseItem(it)`:
```js
/* T-CMB-2: the one tag-shape regex, shared by the bare branch and the normalised retry */
var TAGRE=/^(DoT|Multihit|Rapid|Venting|Regen|Suppressing|Unwieldy|Consumable|Stimm|Slowing|Draining|Leech|Reclaim|Refund|Momentum|Ambush|Grudge|Guided|Reach|First Strike|Free Move|Overcharge|Bypass|Shield|Ward|Decoy|Blink|Immunity|Marked|Rally|Cleanse|Revive|Charging|Injured|Critical)\s*(I{1,3}|IV|V|\d+)?$/i;
```
and change the existing tag branch to `if(m=p.match(TAGRE)){...}` (body unchanged).

(c) Replace the bare `out.notes.push(p)` tail with the normalization retry:
```js
  // T-CMB-2 grammar sweep: canon phrases that are tag-shaped but not bare — "applies DoT II",
  // "Ally: Regen II for 3 posts", "Apply Marked II to a target", "gain Charging (+1 dmg …)",
  // "Regen I (Robotic)", "Apply Marked II at Long range" (range recovered). Immunity segments
  // are exempt: condTagsOf's own recovery reads "Immunity (Tag — note)" whole, incl. the of.
  if(!/^immunity\b/i.test(p)){
    var p2=p.replace(/^(?:applies|apply|gains?|ally:|self:|target:)\s+/i,'');
    var rm=p2.match(/\s+at\s+(melee|short|medium|med|long)\s+range$/i);
    if(rm)p2=p2.replace(/\s+at\s+[a-z]+\s+range$/i,'');
    p2=p2.replace(/\s+for\s+\d+\s+posts?$/i,'').replace(/\s+to\s+an?\b.*$/i,'').replace(/\s*\([^)]*\)$/,'').trim();
    if(p2!==p&&(m=p2.match(TAGRE))){
      if(rm&&!out.range)out.range=/^med/i.test(rm[1])?'Medium':cap(rm[1].toLowerCase());
      var tv2=m[2]||'';var roman2=/^\d+$/.test(tv2)?['','I','II','III','IV','V'][parseInt(tv2,10)]||tv2:tv2.toUpperCase();
      out.tags.push({tag:cap(m[1]),tier:roman2});return}
  }
  out.notes.push(p)
```

- [ ] **Step 5: Run the new file, then the whole suite** — `node --test tests/cond-coverage.test.js` (all pass) then `node --test` (516 baseline + new, 0 fail).

- [ ] **Step 6: Commit**
```bash
git add index.html tests/_condglue.js tests/cond-coverage.test.js
git commit -m "engine: T-CMB-2 task 1 - parseItem grammar sweep (prefixes, suffixes, ; splitter)"
```

### Task 2: Passive cond items become stageable (Rebreather-class fix)

**Files:**
- Modify: `index.html` — move `bfCondItemsOf` (currently ~line 3800–3805, OUTSIDE the marked region) into the END of `/*<cond-staging-glue>*/` (before the close marker) and widen its ITEM branch; widen `combatCatalog`'s ITEM branch in thread-core (~line 577) via a new core helper `condTaggyItem`; filter tagless cond rows in `threadBlockBuilder` (~line 3662).
- Test: `tests/cond-coverage.test.js` (append)

**Interfaces:**
- Consumes: `condTagsOf` (glue), `CONDS` registry (core), `THREAD.catalog`.
- Produces: `bfCondItemsOf(c)` exported via the glue region (test-reachable through `tests/_condglue.js`); core `condTaggyItem(it)` (exported on the THREAD return object at ~line 1333); catalog offers `Use <item>` rows for ANY cond-tagged ITEM.

- [ ] **Step 1: Write failing tests** (append to `tests/cond-coverage.test.js`):

```js
/* ── Task 2: passive cond items stageable ── */

function slotModel(items) {
  return { model: { n: 'Bearer', loadout: { slots: items.map(it => ({ type: 'ITEM', it })) } } };
}

test('bfCondItemsOf: passive Immunity/Regen/Rally ITEMs pass the filter (Rebreather, Unholy Vigour, Battle Standard, Markerlight)', () => {
  const c = slotModel([gear('items', 'Rebreather'), gear('items', 'Unholy Vigour'),
    gear('items', 'Battle Standard'), gear('items', 'Markerlight')]);
  assert.deepStrictEqual(G.bfCondItemsOf(c).map(i => i.n).sort(),
    ['Battle Standard', 'Markerlight', 'Rebreather', 'Unholy Vigour']);
});

test('bfCondItemsOf: consumable grenades still pass; capture/tagless items still do not', () => {
  const blight = gear('items', 'Blight Grenade');
  const c = slotModel([blight, { n: 'Shackle Collar', cat: 'ITEM', d: 'Capture II - 1 AP' },
    { n: 'Plain Rock', cat: 'ITEM', d: 'A rock' }]);
  assert.deepStrictEqual(G.bfCondItemsOf(c).map(i => i.n), ['Blight Grenade']);
});

test('combatCatalog: a non-consumable cond ITEM yields a Use row (core condTaggyItem)', () => {
  const state = { pools: { A: 9 }, combatants: {
    m: { party: 'A', w: [10, 10], conds: [],
      model: { n: 'Bearer', loadout: { slots: [{ type: 'ITEM', it: gear('items', 'Rebreather') }] } } } } };
  const rows = THREAD.catalog({ type: 'SKIRMISH' }, state, 'A', canon);
  assert.ok(rows.some(r => r.kind === 'cond' && r.item && r.item.n === 'Rebreather'));
});

test('inventory pin: the exact post-sweep stageable set across all canon gear (audit the class)', () => {
  const stageable = [];
  ['weapons', 'items', 'abilities', 'casts', 'legendaries'].forEach(cat =>
    (canon[cat] || []).forEach(r => { if (G.condTagsOf(r).length) stageable.push(r.n); }));
  // Pin the exact set: any canon or grammar drift that silently adds/removes a stageable
  // item must fail here and be consciously re-pinned.
  assert.deepStrictEqual(stageable.sort(), [
    /* fill with the actual sorted list produced by the implementation — verify each name
       against the "known false-position inventory" section before pinning */
  ]);
});
```

**Note on the inventory pin:** run the loop once after implementing, eyeball every name against the plan's inventory section (weapons with hostile tags now count as cond-tagged — that is correct and expected; they feed Task 3), then freeze the literal list into the assertion. A wrong-looking name at this step is a grammar bug — fix it, don't pin it.

- [ ] **Step 2: Run to verify failures** — `node --test tests/cond-coverage.test.js` — bfCondItemsOf tests fail (null export), catalog test fails.

- [ ] **Step 3: Implement.**

(a) MOVE the `bfCondItemsOf` function (with its leading comment) from ~line 3800 to just before `/*</cond-staging-glue>*/`, and widen the ITEM branch — any ITEM is eligible; `condTagsOf` decides:
```js
// T-CMB-1 Task 5 / T-CMB-2 Task 2: equipped ABILITY/CAST/ITEM slots that actually carry a
// condition tag — the grid battle's ability/cast buttons. T-CMB-2 dropped the consumable-only
// ITEM filter: passive cond gear (Rebreather's Immunity, Unholy Vigour's Regen, icons' Rally,
// Markerlight's Marked) is stageable; condTagsOf-empty items still never show.
function bfCondItemsOf(c){var out=[];if(!c.model)return out;
  ((c.model.loadout&&c.model.loadout.slots)||c.model.sl||[]).forEach(function(s){if(!s.it)return;
    var ty=s.type||s.k;
    if(ty==='ABILITY'||ty==='CAST'||ty==='WARP CAST'||ty==='ITEM')
      if(condTagsOf(s.it).length)out.push(s.it);});
  return out;}
```

(b) In thread-core, add `condTaggyItem` near `combatCatalog` (~line 565) and export it in the THREAD return object (~line 1333):
```js
  // T-CMB-2 Task 2: core-side "might this ITEM stage a condition?" — the core can't call the
  // glue's parseItem, so it word-tests the description against the CONDS registry keys. False
  // positives (an item merely MENTIONING a tag, e.g. Toxin Sacs' weapon-mod text) are filtered
  // at the composer layer by the exact condTagsOf; a false positive here only costs a
  // catalog row the composer then drops.
  function condTaggyItem(it){var d=(it&&it.d)||'';
    if(/consumable|stimm|grenade/i.test(d))return true;
    for(var tag in CONDS)if(new RegExp('\\b'+tag+'\\b','i').test(d))return true;
    return false;}
```
and change line ~577 from `else if(k==='ITEM'&&/consumable|stimm|grenade/i.test(it.d||''))` to `else if(k==='ITEM'&&condTaggyItem(it))`.

(c) In `threadBlockBuilder` (~line 3662), filter the exact set — after `var acts=THREAD.catalog(t,t.state,party,D);` add:
```js
  // T-CMB-2 Task 2: drop cond rows whose item stages nothing (condTagsOf is the exact test the
  // core's word-heuristic can't run) — they could only ever warn "No valid target".
  acts=acts.filter(function(a){return a.kind!=='cond'||!a.item||condTagsOf(a.item).length;});
```

- [ ] **Step 4: Fill the inventory pin.** Add a temporary `console.log(JSON.stringify(stageable.sort()))` (or run the loop in `node -e`), verify every name against the inventory section, paste the literal array into the test, delete the log.

- [ ] **Step 5: Full suite** — `node --test` — all green.

- [ ] **Step 6: Commit**
```bash
git add index.html tests/cond-coverage.test.js
git commit -m "engine: T-CMB-2 task 2 - passive cond items stageable (bfCondItemsOf/catalog filter fix)"
```

### Task 3: Weapon-borne hostile cond riders (player staging, both composers)

**Files:**
- Modify: `index.html` — new `weaponCondEffects` at the end of `/*<cond-staging-glue>*/`; wire the board attack handler (`data-atk` click, ~line 4069–4072) and the dropdown composer (`add.onclick` in `threadBlockBuilder`, ~line 3707–3721).
- Test: `tests/cond-coverage.test.js` (append)

**Interfaces:**
- Consumes: `condTagsOf`, `condIsHostile`, `THREAD.elementOf`, `condLabelShort` (engine glue, display only), `THREAD.apply`/`applyCond` contract: `{kind:'cond',add:{tag,tier,src,el,item},to}` — `add.item` lets `applyCond` stamp `nl`/`nr` (T-CMB-1 fix round 1).
- Produces: `weaponCondEffects(item, targetId) -> [{kind:'cond',add:{...},to}]` (hostile tags only). Staged rider entries are `{actor, action, cost:0, fanout:true, effect}` — the attack is ONE action; `validate`'s counter already exempts fanout cond entries.

- [ ] **Step 1: Write failing tests** (append to `tests/cond-coverage.test.js`):

```js
/* ── Task 3: weapon riders ── */

function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}

test('weaponCondEffects: hostile weapon tags become rider cond payloads; non-hostile/mechanic tags do not', () => {
  const th = gear('weapons', 'Thunder Hammer');       // Suppressing I + Unwieldy
  const effs = G.weaponCondEffects(th, 'victim');
  assert.strictEqual(effs.length, 1);
  assert.strictEqual(effs[0].kind, 'cond');
  assert.deepStrictEqual({ tag: effs[0].add.tag, tier: effs[0].add.tier, to: effs[0].to },
    { tag: 'Suppressing', tier: 1, to: 'victim' });
  assert.strictEqual(effs[0].add.item, th, 'threads the source item for nl/nr stamping');
  assert.strictEqual(G.weaponCondEffects({ n: 'Plain Bolter', cat: 'WEAPON', d: 'Phys 2 - Med - 1 AP' }, 'v').length, 0);
});

test('weaponCondEffects: no target → no riders (never a self-cond)', () => {
  assert.strictEqual(G.weaponCondEffects(gear('weapons', 'Eviscerator'), null).length, 0);
});

test('riders end-to-end: an Eviscerator hit leaves a DoT instance that ticks on the victim\'s post', () => {
  const ev = gear('weapons', 'Eviscerator');
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B', w: [10, 10] }) } };
  const block = [
    { actor: 'atk', cost: 2, effect: { kind: 'damage', to: 'victim', amount: 3, element: 'Physical', weapon: ev.n, band: 'MELEE' } }
  ].concat(G.weaponCondEffects(ev, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  const inst = state.combatants.victim.conds.filter(c => c.tag === 'DoT')[0];
  assert.ok(inst, 'DoT instance landed with the hit');
  assert.strictEqual(inst.src, 'Eviscerator');
  assert.strictEqual(inst.by, 'atk');
  const before = state.combatants.victim.w[0];
  THREAD.tickConds('B', state, canon);
  assert.strictEqual(state.combatants.victim.w[0], before - 1, 'DoT I bites 1 on the victim\'s post');
});

test('riders: the Forge NL+DoT combo is live — a Non-Lethal DoT weapon floors its ticks at 1 wound (ruling 1a)', () => {
  const slaver = { n: 'Slaver Flail', cat: 'WEAPON', d: 'Phys 2 - Melee - 1 AP - DoT II - Non-Lethal' };
  const state = { pools: { A: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B', w: [2, 10] }) } };
  const block = [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'victim', amount: 0, element: 'Physical', nonLethal: true, weapon: slaver.n, band: 'MELEE' } }]
    .concat(G.weaponCondEffects(slaver, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  const inst = state.combatants.victim.conds.filter(c => c.tag === 'DoT')[0];
  assert.strictEqual(inst.nl, true, 'nl stamped from the rider\'s add.item');
  THREAD.tickConds('B', state, canon);
  THREAD.tickConds('B', state, canon);
  assert.strictEqual(state.combatants.victim.w[0], 1, 'floored at 1 — captureable, never killed');
  assert.ok(!state.combatants.victim.dead);
});

test('riders: an Agoniser (Suppressing + Non-Lethal) pin costs the victim an action next post', () => {
  const ag = gear('weapons', 'Agoniser');
  const state = { pools: { A: 9, B: 9 }, combatants: {
    atk: combatant({}), victim: combatant({ party: 'B' }) } };
  const block = [{ actor: 'atk', cost: 1, effect: { kind: 'damage', to: 'victim', amount: 2, element: 'Energy', nonLethal: true, weapon: ag.n, band: 'MELEE' } }]
    .concat(G.weaponCondEffects(ag, 'victim').map(ef => ({ actor: 'atk', cost: 0, fanout: true, effect: ef })));
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'A');
  assert.strictEqual(THREAD.actionCap(state.combatants.victim, canon), 2, 'Suppressing I: 3 → 2 actions');
});
```

(If canon has no weapon literally named `Boltgun`, keep the inline fallback object as written — the assertion only needs a condless weapon.)

- [ ] **Step 2: Run to verify failures** — `weaponCondEffects` is null → TypeErrors.

- [ ] **Step 3: Implement.**

(a) At the end of `/*<cond-staging-glue>*/` (after `condEffectsFor`):
```js
/* T-CMB-2 Task 3: hostile rider conds a WEAPON's own tags inflict on the model it hits.
   The attack stays ONE action — riders stage as cost:0 fanout:true entries behind the damage
   entry (validate's counter already exempts fanout cond entries). Buff-shaped weapon tags
   never ride: a weapon cannot buff its victim. add.item threads the weapon itself so
   applyCond stamps nl/nr (Non-Lethal floor / no_revival permadeath) — the Forge combo path. */
function weaponCondEffects(item,targetId){
  if(!item||!targetId)return [];
  var el=THREAD.elementOf(item),out=[];
  condTagsOf(item).forEach(function(ct){
    if(!condIsHostile(ct.tag))return;
    out.push({kind:'cond',add:{tag:ct.tag,tier:ct.tier,src:item.n,el:el,item:item},to:targetId});
  });
  return out;
}
```

(b) Board attack handler (~line 4069–4072) — inside the `if(BF_RANK[...]>=BF_RANK[bnd2])` body, after the existing `ui.acts.push({...damage...})`, add:
```js
          weaponCondEffects(it,ui.tgt).forEach(function(ef){
            ui.acts.push({actor:ui.sel,action:it.n+' ('+condLabelShort(ef.add)+') → '+bfTag(ui.tgt,C[ui.tgt]),
              cost:0,fanout:true,effect:ef});});
```
(Brace balance: the damage push and the rider loop sit inside the same `if`.)

(c) Dropdown composer — in `add.onclick` (~line 3707), add a group-`'e'` branch BEFORE the generic tail push:
```js
    if(a.group==='e'){
      staged.push({actor:a.actor,action:a.action,cost:a.cost,effect:effFor(a,tgt),tgtLabel:tgtLabel});
      // T-CMB-2 Task 3: the weapon's own hostile tags ride the hit — free fanout entries
      weaponCondEffects(a.item,tgt).forEach(function(ef){
        staged.push({actor:a.actor,action:a.item.n+' ('+condLabelShort(ef.add)+')',cost:0,fanout:true,
          effect:ef,tgtLabel:nameOf(ef.to)});});
      redraw();return;
    }
```

- [ ] **Step 4: Full suite** — `node --test` — green.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/cond-coverage.test.js
git commit -m "engine: T-CMB-2 task 3 - weapon-borne hostile cond riders (board + composer staging)"
```

### Task 4: NPC weapon riders (npcTurn parity)

**Files:**
- Modify: `index.html` — `bfWeaponCaps` (~line 3838–3840) gains `band` consumers' `conds`; `npcTurn` in thread-core (~line 1230–1233) appends rider effects.
- Test: `tests/cond-coverage.test.js` (append)

**Interfaces:**
- Consumes: `condTagsOf`/`condIsHostile` (glue, at caps-build time), `applyCond`'s explicit-field contract (`add.nl`/`add.nr`/`add.el` win over item-derivation — tested in conds.test.js).
- Produces: weapon caps gain `conds:[{tag,tier}]`; `npcTurn` blocks may contain `{actor,cost:0,fanout:true,effect:{kind:'cond',add:{tag,tier,src,el,nl,nr,band},to}}` entries right after their damage entry. `add.band` = the weapon's band string (consumed by Task 8's range gate for item-less core payloads).

- [ ] **Step 1: Write failing tests** (append):

```js
/* ── Task 4: NPC rider parity ── */

test('npcTurn: a cond-tagged weapon cap stages a hostile rider behind the attack', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical',
    nonLethal: true, noRevival: false, conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [12, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  const rider = block.find(b => b.effect && b.effect.kind === 'cond');
  assert.ok(rider, 'rider staged');
  assert.strictEqual(rider.fanout, true);
  assert.strictEqual(rider.cost, 0);
  assert.deepStrictEqual(
    { tag: rider.effect.add.tag, tier: rider.effect.add.tier, nl: rider.effect.add.nl, band: rider.effect.add.band, to: rider.effect.to },
    { tag: 'Slowing', tier: 2, nl: true, band: 'SHORT', to: 'hero' });
  assert.ok(block.indexOf(block.find(b => b.effect.kind === 'damage')) < block.indexOf(rider),
    'rider follows its attack');
});

test('npcTurn riders: block passes validate and the victim is Slowed after apply', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical',
    nonLethal: true, conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, board, fog: {}, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [12, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon, 'B');
  const inst = state.combatants.hero.conds.filter(c => c.tag === 'Slowing')[0];
  assert.ok(inst, 'Slowing landed');
  assert.strictEqual(inst.nl, true);
  assert.strictEqual(THREAD.condMods(state.combatants.hero).speed, -2);
});

test('npcTurn riders: obeys the action cap — riders are free, the attack still counts once', () => {
  const tiles = []; for (let i = 0; i < 8 * 4; i++) tiles.push({ t: 'open' });
  const board = { w: 8, h: 4, tiles, zones: {} };
  const WEBBER = { name: 'Webber', band: 'SHORT', ap: 1, damage: 1, element: 'Physical', conds: [{ tag: 'Slowing', tier: 2 }] };
  const state = { pools: { B: 9 }, combatants: {
    ork:  { party: 'B', x: 2, y: 0, w: [1, 12], sight: 9, spd: 3, conds: [], weps: [WEBBER] },   // Critical: cap 1
    hero: { party: 'A', x: 0, y: 0, w: [10, 10], sight: 9, spd: 3, conds: [], weps: [] },
  } };
  const block = THREAD.npcTurn('B', state, board, c => c.weps || [], canon);
  assert.strictEqual(block.filter(b => b.effect.kind === 'damage').length, 1);
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'B', block, canon).ok);
});
```

- [ ] **Step 2: Run to verify failures** — no rider entries staged.

- [ ] **Step 3: Implement.**

(a) `bfWeaponCaps` (~line 3838) — add the conds field:
```js
function bfWeaponCaps(c){return bfWeaponsOf(c).map(function(it){return {
  name:it.n,band:bfItemBand(it),ap:bfAP(it),damage:damageOf(it),
  element:THREAD.elementOf(it),noRevival:THREAD.isNoRevival(it,D),nonLethal:/non-?lethal/i.test(it.d||''),
  conds:condTagsOf(it).filter(function(ct){return condIsHostile(ct.tag);})};});}   // T-CMB-2 Task 4: hostile riders
```

(b) `npcTurn` (~line 1233) — right after the existing `if(pick){block.push({...damage...});pool-=...;_staged[aid]...;}` extend the `if(pick)` body (keep everything already there):
```js
      if(pick){block.push({actor:aid,cost:pick.ap||0,effect:{kind:'damage',to:tgt,amount:pick.damage||0,element:pick.element||null,noRevival:!!pick.noRevival,nonLethal:!!pick.nonLethal,weapon:pick.name||null,band:db}});pool-=(pick.ap||0);_staged[aid]=(_staged[aid]||0)+1;
        // T-CMB-2 Task 4: the weapon's hostile tags ride the hit — free fanout entries, same
        // contract as the player composers. add carries explicit el/nl/nr (no item object in
        // caps) — applyCond's explicit-fields-win rule stamps them; band feeds the range gate.
        (pick.conds||[]).forEach(function(ct){
          block.push({actor:aid,cost:0,fanout:true,effect:{kind:'cond',
            add:{tag:ct.tag,tier:ct.tier,src:pick.name||null,el:pick.element||null,nl:!!pick.nonLethal,nr:!!pick.noRevival,band:pick.band},to:tgt}});});
      }
```

- [ ] **Step 4: Full suite** — `node --test` — green. (Watch the two existing `npcTurn` band-stamp tests in conds.test.js — their weapon caps carry no `conds` field, so `(pick.conds||[])` must no-op.)

- [ ] **Step 5: Commit**
```bash
git add index.html tests/cond-coverage.test.js
git commit -m "engine: T-CMB-2 task 4 - NPC weapon riders (bfWeaponCaps conds + npcTurn parity)"
```

### Task 5: T-CMB-2 browser E2E + board row

**Files:**
- Modify: `BACKLOG.md` (T-CMB-2 row only)

- [ ] **Step 1: Serve + boot** — `python3 -m http.server 8765` (background), Playwright to `http://localhost:8765`, set `window._noPersist=true` immediately after load, capture console errors (must stay 0 throughout).
- [ ] **Step 2: E2E script** — found a commander, reach a combat thread with the demo flow (same route the T-CMB-1 E2E used: start a SKIRMISH from a location panel, deploy, Lock In). Verify:
  - A cond-tagged weapon attack (equip a Thunder Hammer-class weapon via demo gear if available, else assert on whatever cond weapon the demo roster carries) stages BOTH the attack and its rider chip in "Staged this turn"; post it; the battle report shows the victim's cond chip (`Suppressing I · 1p` style).
  - A passive cond item (equip Rebreather if reachable through the Shop demo, else verify via the Abilities/Casts panel of any model with a passive cond item) renders as a stageable button.
  - The next enemy post's tick line prints for any DoT applied.
  - 0 console errors across every screen exercised.
- [ ] **Step 3: If any failure** → fix, re-run suite + E2E, commit fix with explicit paths.
- [ ] **Step 4: Board row** — edit ONLY the T-CMB-2 row in `BACKLOG.md`: `status` → `ready-to-push` (note: "pending pair final review — fix wave folds into T-CMB-3's lane hold"), list exact commit paths (`index.html`, `tests/_condglue.js`, `tests/cond-coverage.test.js`, `BACKLOG.md`, plan doc). Flip the T-CMB-3 row `claimed` → `in-progress` (same owner/session) — the engine lane hand-off happens in this single commit.
- [ ] **Step 5: Commit**
```bash
git add BACKLOG.md docs/superpowers/plans/2026-08-06-cmb2-cmb3-cond-coverage-gates.md
git commit -m "backlog: T-CMB-2 browser-verified ready-to-push; T-CMB-3 takes the engine lane"
```

---

# PHASE B — T-CMB-3 · Validate Cond-Gating (board row `in-progress` from Task 5 on)

### Task 6: Core hostility + band helpers

**Files:**
- Modify: `index.html` thread-core — `CONDS` registry entries gain `hostile:1`; new `condHostile(tag)` + `condBandOf(add)`; export both at ~line 1333. Glue: `condIsHostile` delegates; delete the `HOSTILE_CONDS` map.
- Test: `tests/cond-gates.test.js` (create)

**Interfaces:**
- Consumes: `CONDS` registry, `NPC_RANK` (~line 1203).
- Produces: `THREAD.condHostile(tag) -> boolean` (DoT/Slowing/Suppressing/Marked/Draining true; everything else — incl. unknown tags — false); `THREAD.condBandOf(add) -> 'MELEE'|'SHORT'|'MEDIUM'|'LONG'` (priority: valid `add.band` → first range word in `add.item.d` → `'SHORT'` per ruling §4). Glue `condIsHostile(tag)` === `THREAD.condHostile(tag)` (single source of truth).

- [ ] **Step 1: Write failing tests** in new `tests/cond-gates.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('path');
const { loadThread } = require('./_load');
const { loadCondGlue } = require('./_condglue');

const THREAD = loadThread();
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const G = loadCondGlue(THREAD);

function combatant(over) {
  const c = { w: [10, 10], party: 'A', conds: [], model: { n: 'Test' } };
  for (const k in over) c[k] = over[k];
  return c;
}
function openBoard(w, h) {
  const tiles = []; for (let i = 0; i < w * h; i++) tiles.push({ t: 'open' });
  return { w, h, tiles, zones: {} };
}

/* ── Task 6: hostility + band helpers ── */

test('condHostile: the five hostile tags true; buffs, instants-buffs, unknown tags false', () => {
  ['DoT', 'Slowing', 'Suppressing', 'Marked', 'Draining'].forEach(t =>
    assert.strictEqual(THREAD.condHostile(t), true, t));
  ['Regen', 'Rally', 'Cleanse', 'Immunity', 'Charging', 'Burning', 'NoSuchTag'].forEach(t =>
    assert.strictEqual(THREAD.condHostile(t), false, t));
});

test('condIsHostile (glue) delegates to the core — one source of truth', () => {
  assert.strictEqual(G.condIsHostile('Marked'), true);
  assert.strictEqual(G.condIsHostile('Regen'), false);
});

test('condBandOf: explicit band wins; item range word next; default SHORT (ruling §4)', () => {
  assert.strictEqual(THREAD.condBandOf({ band: 'LONG' }), 'LONG');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'Corr 3 - Med - 2 AP - DoT I' } }), 'MEDIUM');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'Energy 3 - Melee - 2 AP - Suppressing I' } }), 'MELEE');
  assert.strictEqual(THREAD.condBandOf({ item: { d: 'R2 - Target: Slowing II + Suppressing I - 2 AP' } }), 'SHORT');
  assert.strictEqual(THREAD.condBandOf({}), 'SHORT');
  assert.strictEqual(THREAD.condBandOf(null), 'SHORT');
});

test('condBandOf: "at Long range" phrasing reaches LONG via the description scan (Target Uplink)', () => {
  const tu = (canon.casts || []).filter(x => x.n === 'Target Uplink')[0];
  assert.strictEqual(THREAD.condBandOf({ item: tu }), 'LONG');
});
```

- [ ] **Step 2: Run to verify failures** — `condHostile`/`condBandOf` undefined.

- [ ] **Step 3: Implement.**

(a) In the `CONDS` registry (thread-core), add `hostile:1` to the DoT, Slowing, Suppressing, Marked, and Draining entries (read the literal first; add the property without disturbing existing fields).

(b) Below the registry:
```js
  // T-CMB-3 Task 6: hostility is a registry fact, not a glue-side list — validate's
  // allegiance/fog/range gates and the staging glue read the same bit.
  function condHostile(tag){var e=CONDS[tag];return !!(e&&e.hostile);}
  // Ruling §4 (2026-07-28): a hostile cond gates by its ITEM's stated range band, default
  // SHORT. Priority: an explicit staged band (core-built payloads, e.g. npcTurn riders) →
  // the first range word in the item's own description → SHORT.
  function condBandOf(add){
    if(add){
      if(add.band&&NPC_RANK[String(add.band).toUpperCase()]!=null)return String(add.band).toUpperCase();
      var d=(add.item&&add.item.d)||'',m=d.match(/\b(melee|short|medium|med|long)\b/i);
      if(m)return /^med/i.test(m[1])?'MEDIUM':m[1].toUpperCase();
    }
    return 'SHORT';
  }
```

(c) Export both in the THREAD return object (~line 1333): add `condHostile:condHostile, condBandOf:condBandOf,`.

(d) Glue (~line 3586–3587): replace
```js
var HOSTILE_CONDS={DoT:1,Slowing:1,Suppressing:1,Marked:1,Draining:1};
function condIsHostile(tag){return !!HOSTILE_CONDS[tag];}
```
with
```js
// T-CMB-3 Task 6: hostility now lives on the CONDS registry entries — one source of truth.
function condIsHostile(tag){return THREAD.condHostile(tag);}
```

- [ ] **Step 4: Full suite** — `node --test` — green (conds.test.js's CONDGLUE tests exercise the delegation).

- [ ] **Step 5: Commit**
```bash
git add index.html tests/cond-gates.test.js
git commit -m "engine: T-CMB-3 task 6 - condHostile/condBandOf core helpers, glue delegation"
```

### Task 7: validate — allegiance + fog gates on cond effects

**Files:**
- Modify: `index.html` thread-core `validate` (~line 603–692): extend the fog loop (~line 631–637), add the allegiance loop.
- Test: `tests/cond-gates.test.js` (append)

**Interfaces:**
- Consumes: `condHostile`, `spottedEnemies`, existing readable-reason contract (`{ok:false,reason}`).
- Produces: in combat threads — a hostile cond targeting the actor's own side rejects (`Condition: <tag> targets your own side`); a buff targeting the enemy rejects (`Condition: buffs cannot target the enemy`); with a board, a hostile cond on an unspotted enemy rejects (`Condition: target not in sight - fog of war`). Unknown/absent target ids are left to the apply-layer no-op (matches existing damage-gate behavior).

- [ ] **Step 1: Write failing tests** (append to `tests/cond-gates.test.js`):

```js
/* ── Task 7: allegiance + fog gates ── */

test('allegiance: a hostile cond aimed at your own side is rejected (boardless too)', () => {
  const state = { pools: { A: 9 }, combatants: { m: combatant({}), ally: combatant({}) } };
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'DoT', tier: 1, src: 'x', el: null }, to: 'ally' } }], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /own side/i);
});

test('allegiance: a buff aimed at the enemy is rejected; at an ally it passes', () => {
  const state = { pools: { A: 9 }, combatants: {
    m: combatant({}), ally: combatant({}), foe: combatant({ party: 'B' }) } };
  const bad = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'foe' } }], canon);
  assert.strictEqual(bad.ok, false);
  assert.match(bad.reason, /buff/i);
  const good = THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'ally' } }], canon);
  assert.ok(good.ok);
});

test('allegiance: the legacy string-cond fallback (unknown tag, self target) still passes', () => {
  const state = { pools: { A: 9 }, combatants: { m: combatant({}) } };
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: 'Regen II', to: 'm' } }], canon).ok);
});

test('fog: a hostile cond on an unspotted enemy is rejected; a spotted one passes', () => {
  const board = openBoard(12, 2);
  const state = { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 3, weps: [] }),
    near: combatant({ party: 'B', x: 2, y: 0 }),
    far: combatant({ party: 'B', x: 11, y: 1 }),
  } };
  const eff = (to) => [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Marked', tier: 1, item: { d: 'Apply Marked I at Long range' } }, to } }];
  const spotted = THREAD.spottedEnemies('A', state, board);
  assert.ok(spotted.indexOf('near') >= 0 && spotted.indexOf('far') < 0, 'fixture: near seen, far unseen');
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, state, 'A', eff('near'), canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'A', eff('far'), canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /sight|fog/i);
});
```

**Fixture note:** `sightOf`/`spottedEnemies` semantics come from the grid tests — if `sight:3` doesn't produce near-seen/far-unseen exactly as asserted, adapt the fixture distances (the inline `spotted` assertion is there to catch that early); do not weaken the gate assertions.

- [ ] **Step 2: Run to verify failures.**

- [ ] **Step 3: Implement.** In `validate`, inside the combat branch:

(a) Extend the fog loop (~line 633–636) — add a cond clause alongside damage/capture:
```js
        for(var gi=0;gi<block.length;gi++){var ge=block[gi].effect;
          if(ge&&(ge.kind==='damage'||ge.kind==='capture')&&ge.to&&vis.indexOf(ge.to)<0)
            return {ok:false,reason:ge.kind==='capture'?
              'Capture: target not in sight - fog of war':'Target not in sight - fog of war'};
          if(ge&&ge.kind==='cond'&&ge.add&&condHostile(ge.add.tag)&&ge.to&&vis.indexOf(ge.to)<0)
            return {ok:false,reason:'Condition: target not in sight - fog of war'};}   // T-CMB-3 Task 7
```

(b) After the fog block (works boardless — party data always exists), add:
```js
      // T-CMB-3 Task 7: allegiance gate — hostile conds land on enemies, buffs on your own
      // side; unknown tags read as buffs (inert-but-displayed contract) so the legacy string
      // fallback (self-target) keeps passing. Stage-2: validate is the server authority.
      for(var yi=0;yi<block.length;yi++){var yb=block[yi],ye=yb.effect;
        if(!ye||ye.kind!=='cond')continue;
        var ytag=ye.add&&ye.add.tag,ya=state.combatants[yb.actor],yt=state.combatants[ye.to];
        if(!ya||!yt)continue;
        if(condHostile(ytag)){
          if(yt.party===ya.party)return {ok:false,reason:'Condition: '+ytag+' targets your own side'};
        }else if(yt.party!==ya.party)return {ok:false,reason:'Condition: buffs cannot target the enemy'};}
```

- [ ] **Step 4: Full suite** — `node --test`. The Phase-A rider tests (hostile → enemy, spotted) and every conds.test.js cond staging test (buffs → own side) must stay green — they are the regression net for these gates.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/cond-gates.test.js
git commit -m "engine: T-CMB-3 task 7 - allegiance + fog gates on cond effects in validate"
```

### Task 8: validate — range gate (ruling §4) + all-fanout ≥1 action

**Files:**
- Modify: `index.html` thread-core `validate`.
- Test: `tests/cond-gates.test.js` (append)

**Interfaces:**
- Consumes: `condHostile`, `condBandOf`, `NPC_RANK`, `bandOf`, `cheb`.
- Produces: with a board — a hostile cond whose engagement band exceeds `condBandOf(add)` rejects (`Condition: <tag> is out of range (<BAND>)`); positions are tracked through earlier staged `move` effects in block order, so move-then-cast validates from the post-move square. The action counter counts ≥1 for any actor whose block contains fanout cond entries but zero counted actions.

- [ ] **Step 1: Write failing tests** (append):

```js
/* ── Task 8: range gate + all-fanout ≥1 ── */

const dotItem = { n: 'Splinter Pistol', d: 'Corr 1 - Short - 1 AP - DoT I' };

function rangeState(dist) {
  const board = openBoard(12, 2);
  return { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 12, spd: 3, weps: [] }),
    foe: combatant({ party: 'B', x: dist, y: 0 }),
  } };
}
const hostileCond = () => ({ actor: 'm', cost: 1,
  effect: { kind: 'cond', add: { tag: 'DoT', tier: 1, src: dotItem.n, item: dotItem }, to: 'foe' } });

test('range: a SHORT-band hostile cond at medium distance rejects; at short range passes (ruling §4)', () => {
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, rangeState(3), 'A', [hostileCond()], canon).ok);
  const v = THREAD.validate({ type: 'SKIRMISH' }, rangeState(5), 'A', [hostileCond()], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /out of range/i);
});

test('range: a band-less cond item defaults to SHORT (ruling §4 default)', () => {
  const bare = { n: 'Grip', d: 'R2 - Target: Slowing II - 2 AP' };
  const st = rangeState(5);
  const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Slowing', tier: 2, item: bare }, to: 'foe' } }], canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /out of range/i);
});

test('range: move-then-cast validates from the post-move square', () => {
  const st = rangeState(6);   // SHORT item, target at 6 (MEDIUM) — but we move to x=3 first (dist 3 → SHORT)
  const block = [
    { actor: 'm', cost: 0, effect: { kind: 'move', who: 'm', to: { x: 3, y: 0 } } },
    hostileCond(),
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, st, 'A', block, canon).ok);
});

test('range: buffs are range-free — a Regen on a far ally passes (ruling §4)', () => {
  const board = openBoard(12, 2);
  const st = { pools: { A: 9 }, board, fog: {}, combatants: {
    m: combatant({ x: 0, y: 0, sight: 12, weps: [] }),
    ally: combatant({ x: 11, y: 1 }),
  } };
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 2, effect: { kind: 'cond', add: { tag: 'Regen', tier: 2 }, to: 'ally' } }], canon).ok);
});

test('range: a LONG weapon rider at melee distance passes (band is max reach, not exact)', () => {
  const st = rangeState(1);
  const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'A',
    [{ actor: 'm', cost: 1, effect: { kind: 'cond', add: { tag: 'Draining', tier: 1, band: 'LONG' }, to: 'foe' } }], canon);
  assert.ok(v.ok);
});

test('all-fanout floor: legit rider and fan-out blocks pass unchanged; the floor holds the counter at ≥1', () => {
  // HONESTY NOTE (bind the reviewer to this): actionCap floors at 1 ("caps don't stack below
  // 1", T-CMB-1), so an all-fanout-only actor counting 1 instead of 0 cannot flip any verdict
  // TODAY — no black-box rejection test exists. The floor is defense-in-depth for the
  // counter's semantics (deferral's letter: "all-fanout blocks count ≥1 action"): if a future
  // cond ever drops a cap to 0, or Stage-2 recounts server-side, the fanout exemption can
  // never again read "acted zero times". What IS assertable: every legitimate flow is
  // unchanged, at the tightest cap.
  const mk = () => ({ pools: { A: 99 }, combatants: {
    m: combatant({ w: [1, 10] }),                 // Critical: cap 1
    ally: combatant({}), foe: combatant({ party: 'B' }),
  } });
  // attack + its weapon riders = ONE action — fits cap 1
  const riders = [
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
    { actor: 'm', cost: 0, fanout: true, effect: { kind: 'cond', add: { tag: 'DoT', tier: 1 }, to: 'foe' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', riders, canon).ok);
  // a lone all-fanout buff group = ONE action (floored, not zero) — fits cap 1
  const allFan = [
    { actor: 'm', cost: 2, fanout: true, effect: { kind: 'cond', add: { tag: 'Rally', tier: 1 }, to: 'm' } },
    { actor: 'm', cost: 0, fanout: true, effect: { kind: 'cond', add: { tag: 'Rally', tier: 1 }, to: 'ally' } },
  ];
  assert.ok(THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', allFan, canon).ok);
  // two counted actions still reject at cap 1 (the counter itself is not weakened)
  const two = [
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
    { actor: 'm', cost: 1, effect: { kind: 'damage', to: 'foe', amount: 1, element: 'Physical' } },
  ];
  const v = THREAD.validate({ type: 'SKIRMISH' }, mk(), 'A', two, canon);
  assert.strictEqual(v.ok, false);
  assert.match(v.reason, /action/i);
});
```

**Reviewer note (binding):** the floor's enforceable invariant is *an actor whose entries are all fanout-cond counts exactly 1 action, never 0*. Because `actionCap` floors at 1, this is verdict-neutral today — the deliverable is the corrected counter semantics plus the regression net above, NOT a new rejection path. Separately: an attack + spoofed-fanout cast group is shape-identical to an attack + legitimate weapon riders and is deliberately not rejected — that residual needs server-side block reconstruction; record it as a Stage-2 note on the T-CMB-3 board row (Task 11 does this).

- [ ] **Step 2: Run to verify failures** — range tests fail (no gate), all-fanout probes fail on the counter.

- [ ] **Step 3: Implement.** In `validate`'s combat branch:

(a) Action counter (~line 612–617) — track fanout-cond actors and floor them to 1:
```js
      var _acts={},_condFan={};                     // T-CMB-1 Task 3 + T-CMB-3 Task 8
      for(var ai=0;ai<block.length;ai++){var ab=block[ai],ae=ab.effect;
        if(ae&&ae.kind==='move')continue;                       // moves are free
        if(ab.fanout&&ae&&ae.kind==='cond'){_condFan[ab.actor]=1;continue;}   // exempt, but remembered
        if(ab.cost==null&&!ae)continue;
        _acts[ab.actor]=(_acts[ab.actor]||0)+1;}
      for(var fi in _condFan)if(!_acts[fi])_acts[fi]=1;   // T-CMB-3 Task 8: an all-fanout block is still ONE action, never zero
```
(The existing cap-check loop over `_acts` follows unchanged.)

(b) After the fog/allegiance gates, add the range gate:
```js
      if(state.board){   // T-CMB-3 Task 8: hostile cond range — the item's stated band, default
        // SHORT (ruling §4). Walk the block in order so a staged move re-positions its actor
        // before later cond entries are measured (same trust model as apply's ordering).
        var _pos={};for(var pid in state.combatants){var pc=state.combatants[pid];
          if(pc&&pc.x!=null)_pos[pid]={x:pc.x,y:pc.y};}
        for(var ri=0;ri<block.length;ri++){var rb=block[ri],re=rb.effect;
          if(re&&re.kind==='move'&&_pos[re.who||rb.actor])_pos[re.who||rb.actor]=re.to;
          if(!re||re.kind!=='cond'||!re.add||!condHostile(re.add.tag))continue;
          var rap=_pos[rb.actor],rtp=_pos[re.to];
          if(!rap||!rtp)continue;
          var rneed=condBandOf(re.add);
          if(NPC_RANK[rneed]<NPC_RANK[bandOf(cheb(rap,rtp))])
            return {ok:false,reason:'Condition: '+re.add.tag+' is out of range ('+rneed+')'};}
      }
```

- [ ] **Step 4: Full suite** — `node --test`. Watch specifically: the Phase-A NPC rider validate test (rider `band` = weapon band, in range by construction) and conds.test.js's Rally fan-out test (buff — range-free) must stay green.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/cond-gates.test.js
git commit -m "engine: T-CMB-3 task 8 - hostile cond range gate (ruling s4) + all-fanout counts one action"
```

### Task 9: UI range gating for hostile cond buttons

**Files:**
- Modify: `index.html` — `bfCombatUI`'s cond button render (~line 4008–4012) and the `data-cond` click handler (~line 4053–4064).

**Interfaces:**
- Consumes: `THREAD.condBandOf`, `THREAD.cheb`, `THREAD.bandOf`, `BF_RANK`, `posOf` (in-scope in `bfCombatUI`), `condTagsOf`, `condIsHostile`.
- Produces: hostile cond buttons disable with `✗ out of range (BAND)` when the chosen target sits beyond the item's stated band (measured from the model's staged-move square, same as attack buttons); the click handler re-guards (defense in depth — the disabled attribute is spoofable).

- [ ] **Step 1: Implement the render gate.** Replace the `ok` line in `condItems.forEach` (~line 4009–4011):
```js
      condItems.forEach(function(it,i){
        var tags=condTagsOf(it),hostile=tags.some(function(ct){return condIsHostile(ct.tag);});
        var ok=true,why='';
        if(hostile){
          if(!ui.tgt){ok=false;why=' (target an enemy first)';}
          else{var cb=THREAD.condBandOf({item:it}),cd=THREAD.cheb(posOf(ui.sel),posOf(ui.tgt));   // T-CMB-3 Task 9: ruling §4 range gate, mirrored from validate
            if(BF_RANK[cb]<BF_RANK[THREAD.bandOf(cd)]){ok=false;why=' ✗ out of range ('+cb+')';}}
        }
        panel+='<button class="btn sm" data-cond="'+i+'"'+(ok?'':' disabled')+' style="margin:5px 5px 0 0">'+it.n+' · '+tags.map(condLabelShort).join(', ')+' · '+bfAP(it)+'AP'+why+'</button>';
      });
```

- [ ] **Step 2: Guard the click handler.** In the `data-cond` branch (~line 4054–4056), after `var chosen=hostile?ui.tgt:(ui.allyTgt||ui.sel);` extend the guard:
```js
        if(hostile&&!chosen)return openT(t.id);   // guard — button is disabled for this case anyway
        if(hostile&&chosen&&BF_RANK[THREAD.condBandOf({item:cit})]<BF_RANK[THREAD.bandOf(THREAD.cheb(posOf(ui.sel),posOf(chosen)))])return openT(t.id);   // T-CMB-3 Task 9: range re-guard
```

- [ ] **Step 3: Suite + boot proxy** — `node --test` (engine-syntax boot proxy compiles the edited script).

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "engine: T-CMB-3 task 9 - UI range gating for hostile cond buttons"
```

### Task 10: T-CMB-3 browser E2E + board row

**Files:**
- Modify: `BACKLOG.md` (T-CMB-3 row only)

- [ ] **Step 1: Playwright E2E** (`window._noPersist=true`, console capture on):
  - In a grid combat: select a model with a hostile cond item/cast, target a distant enemy → the cond button shows `✗ out of range` and is disabled; close distance (stage a move) → button enables.
  - Stage and post a legal hostile cond → applies; verify the chip on the target.
  - Attempt (via the composer path if reachable, else assert the validate reason surfaces) a buff aimed at an enemy is impossible in the UI (picker only lists allies) — the gate is the tested layer; the UI just shouldn't contradict it.
  - 0 console errors across Rites → HQ → Barracks → Map → Threads → the combat.
- [ ] **Step 2: Fix anything found; suite + E2E re-run; commit with explicit paths.**
- [ ] **Step 3: Board row** — T-CMB-3 row: note browser-verified, keep `in-progress` (it holds the lane through the pair final review).
- [ ] **Step 4: Commit** — `git add BACKLOG.md` + commit `backlog: T-CMB-3 browser-verified, holding lane for pair final review`.

---

### Task 11: PAIR FINAL REVIEW — lifecycle walk (not a diff review)

**Files:** none planned (fix wave only if findings).

This is the stage that catches what per-task reviews cannot (house lesson: the unwinnable-duels bug and the dead-content bug both fell out ONLY here). Walk LIFECYCLES end-to-end across BOTH rows' changes, in the running system model:

- [ ] **Lifecycle 1 — a cond-tagged weapon, cradle to grave:** bought at Shop → equipped → attack staged (riders present) → validate (action count, fog, range with the rider's band) → apply (damage, then rider cond via applyCond — nl/nr stamped) → victim's next post ticks (NL floor / kill credit / no_revival) → expiry → aftermath freeze. Check EVERY consumer of `conds`: battle report chips, tick lines, model overview, board tooltip, `condMods`, `actionCap`, `npcTurn`.
- [ ] **Lifecycle 2 — a passive cond item:** equipped Rebreather → appears in bfCondItemsOf AND combatCatalog → staged (Immunity of:DoT, left:Infinity) → blocks a later DoT application → survives JSON round-trip (Infinity persistence fix) → thread conclude.
- [ ] **Lifecycle 3 — an NPC with a cond weapon:** genHostiles/duel spawn (MUST be undisturbed — one champion for arena) → npcTurn stages riders → validate passes its own gates (fog from NPC sight, range from add.band, allegiance) → player is pinned/slowed → player's tick → streaks on conclude AND on flee (both paths intact).
- [ ] **Lifecycle 4 — a hostile cast through the new gates:** grammar-parsed tag (Curse of the Leper) → stageable button → range-gated in UI → move-then-cast in one block → validate pos-tracking → apply → MISSION-combat parity (gates fire in MISSION count_kill/survive_rounds threads identically).
- [ ] **Cross-checks:** the Charge ability's new Charging self-buff feeds `dmgOutMelee` in the same block; `spoofable` seams list (add.band client-stamped, attack+fanout-cast residual) written into the T-CMB-3 row as Stage-2 notes; no `genHostiles`, `concludeThread`, `exitThread`, streak, or duel-spawn line was touched (`git diff <baseline>..HEAD -- index.html | grep -n` those symbols to prove it).
- [ ] **Fix wave if findings** — new tests first, fixes second, re-run the SAME lifecycle that surfaced each finding plus a sweep for the same bug class elsewhere (house lesson: fix waves mint new exploits).
- [ ] **Close out:** full `node --test` + one last browser pass. Board: T-CMB-3 → `ready-to-push` with exact paths; T-CMB-2 row note "pair-reviewed". Commit `backlog: T-CMB-2/3 pair final review complete - both ready-to-push`.
