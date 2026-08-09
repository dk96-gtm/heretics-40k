# T-NPC-3 Slice N1 — Clocks & Ultimatums Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ultimatum clocks on combat threads (initiator-set windows in canon bands), lapse → seeded garrison-favored auto-battle with the 4-rung outcome ladder writing location condition down, Besieged while a clock runs, condition self-heal on the world tick paced by sector state, Rebuild repairs (+1 step, mission conclude AND manual no-payout actions), and TRIBUTE as the third ultimatum response.

**Architecture:** Canon first (v1.33: `rules.ultimatum` + `garrison_mult` on the 4 ladder conditions + rebuild `repair_step`), then a NEW pure DOM-free region `/*<agency-core>*/` (`ULT` object — bands, ladder, garrison math, seeded lapse resolver, heal tick, tribute math) node-tested via its own extraction loader, then engine glue in three waves (creation+Besieged+countdown UI → lapse wiring+outcome application → heal/rebuild/tribute). Everything deterministic: seeds derive from persisted `S.world.missionSeedBase` ⊕ expiry-day ⊕ prefix-tagged ids — chunk-independent replay, same discipline as `MISSION.catchUpBoards`.

**Tech Stack:** Single-file engine (`index.html`) with marked pure regions, canon JSON, zero-dep `node --test` (extraction loaders in `tests/`), Playwright MCP for E2E (`window._noPersist=true`).

## Global Constraints

- **Design LOCKED** (spec `docs/superpowers/specs/2026-07-27-background-agency-attention-design.md` + BACKLOG T-NPC-3 row "N1 scope additions", Daak sits 2026-08-07→09). Locked values: bands **Raid 4–8 · Skirmish 8–16 · Invasion 12–24 game days**; condition garrison mults **Fortified 1.25 / Intact 1.0 / Sacked 0.6 / Ruined 0.3**; **defender ×1.25**; seed = **day ⊕ holding ⊕ aggressor**; outcome ladder **repelled / repelled-with-losses(−1 step) / sacked(−1 step + loot) / captured(planet transfer)**; arithmetic shown in the feed line; Besieged while a clock runs; self-heal paced by sector prosperity/conflict (none in Warring/Famine, pauses while Besieged); Rebuild conclude +1 step; manual Rebuild/Liberate at own damaged holdings (no payout); TRIBUTE third response (defender offers currency/resources/items/captives → attacker accepts/declines/counter-demands by personality + faction appetite).
- **Scale mapping (data-driven):** engine `SKIRMISH` threads are location-anchored assaults = the **raid** scale (canon `thread_scales`: Skirmish subtypes = Duel + Raid; archetypes spec: "Raid = a Skirmish orchestrated against a Named Location"). `INVASION` = **invasion** scale. The `skirmish` band (8–16) is minted in canon and mapped by `rules.ultimatum.scale_of` — remapping is a canon edit, never engine work. FLAGGED FOR DAAK in the close-out report.
- **Tunables flagged, not locked:** `garrison_pc_per_level` 200, outcome margins 0.25/0.25, loot base, heal days-per-step, tribute sizing, the 20-faction `faction_appetite` values. All are canon data; each carries a `"note"` marking it FLAGGED FOR DAAK REVIEW (precedent: `named_premium`).
- **Canon bump:** `meta.version` `"1.32"` → `"1.33"` in Task 1. Update every `1\.32` pin: exactly 5 files — `tests/canon.test.js`, `tests/canon-doors.test.js`, `tests/canon-missions.test.js`, `tests/canon-resources.test.js`, `tests/canon-spoils.test.js`.
- **Determinism law:** no `Date.now()`/`Math.random()` inside `/*<agency-core>*/`. `nowMs`/day indexes arrive as arguments; rng = mulberry32 seeded off persisted state. Chunk-independence: a 30-day catch-up in one chunk must resolve identically to 30 single-day loads (seed derives from the clock's own `expiresDay`, never from "days processed so far").
- **New S.world key:** `condHeal` (`{locId:int}`) seeds in **BOTH** `foundingWorld()` (~index.html:2546) **AND** `init()` backfill (~4565–4575) — house rule.
- **Pacing guard (spec):** max ONE active Ultimatum per location. Enforced at creation.
- **Do NOT touch:** `genHostiles`/duel spawns, streak ticks (`tickStreaksAndSync` call sites index.html:3418 and :3496), mission board seeds (`missionSeedBase`/`missionDay` semantics). Lapse resolution uses its OWN conclude path, never `concludeThread`'s mission/streak machinery.
- **Terminology law:** "model", never "chassis". Sub-faction = data key `faction` (e.g. Death Guard); Faction = `allegiance` (Chaos) — Daak's terms in prose, data keys in code.
- **Suite green (`node --test`, baseline 564/564) at EVERY pause. Browser-verify (0 console errors, `window._noPersist=true`) before each engine commit. `git add` explicit paths, NEVER `-A`. JSON keeps its trailing newline. Daak pushes; you do not.**
- Line numbers below are anchors measured pre-slice; tasks run serially in the hot engine lane, so **grep for the quoted code, don't trust raw numbers** after Task 2.

---

### Task 1: Canon v1.33 — `rules.ultimatum` + ladder `garrison_mult` + rebuild `repair_step`

**Files:**
- Modify: `heretics-40k-data-v1.json` — `meta.version`; new `rules.ultimatum`; 4 entries of `galaxy.conditions`; the `rebuild` row of `missions.universal`.
- Modify: the 5 pin files (version pins only).
- Test: `tests/canon-ultimatum.test.js` (new)

**Interfaces:**
- Produces (consumed by Tasks 2–6): `canon.rules.ultimatum` with this exact shape:

```json
"ultimatum": {
 "note": "T-NPC-3 N1. Bands/mults/ladder LOCKED (Daak 2026-08-07..09). garrison_pc_per_level, outcome margins, loot, heal pacing, tribute sizing + faction_appetite are DEFAULTS — FLAGGED FOR DAAK REVIEW.",
 "bands": { "raid": [4, 8], "skirmish": [8, 16], "invasion": [12, 24] },
 "scale_of": { "SKIRMISH": "raid", "INVASION": "invasion" },
 "scale_note": "Engine SKIRMISH threads are location-anchored assaults = the raid scale (thread_scales: Skirmish subtypes Duel+Raid). The skirmish band awaits the Duel/field-battle split — remap here, never in engine.",
 "garrison_pc_per_level": 200,
 "defender_mult": 1.25,
 "outcome": { "loss_margin": 0.25, "decisive_margin": 0.25 },
 "loot": { "base": 15, "res_per_level": 2 },
 "heal": { "days_per_step": { "Thriving": 4, "Peace": 6, "Corrupted": 9, "Famine": 0, "Warring": 0 } },
 "tribute": {
  "offer_base": 20,
  "res_per_level": 2,
  "scale_mult": { "raid": 1, "invasion": 3 },
  "counter_options": [1.5, 2],
  "faction_appetite": {
   "black_legion": 45, "death_guard": 30, "world_eaters": 10, "thousand_sons": 55, "emperors_children": 40, "chaos_daemons": 5,
   "astartes": 25, "astra_militarum": 60, "adeptus_mechanicus": 70, "adepta_sororitas": 15, "adeptus_custodes": 5,
   "tyranids": 0, "orks": 35, "necrons": 20, "aeldari": 50, "drukhari": 65, "tau_empire": 75, "leagues_of_votann": 80, "genestealer_cults": 55, "harlequins": 45
  }
 }
}
```

**⚠ The 20 `faction_appetite` keys above are illustrative — Step 2 REPLACES them with the actual 20 faction `id` values read from the canon file** (`D.factions[].id`). Values by flavor: fanatics/devourers low (Tyranids 0, Daemons/Custodes 5, World Eaters 10, Sororitas 15), mercantile/pragmatic high (Votann 80, T'au 75, Mechanicus 70, Drukhari 65), middle for the rest — keep the value-to-flavor pairing above, re-key to real ids.

- Produces: `galaxy.conditions` — the 4 ladder rows gain `"garrison_mult"`: `fortified` 1.25, `intact` 1.0, `sacked` 0.6, `ruined` 0.3 (other 5 rows untouched — absent means 1.0).
- Produces: the `rebuild` mission row's `world_effect` gains `"repair_step": 1` (beside its existing `"prosperity": 4`).

- [ ] **Step 1: Write the failing canon tests** — new file `tests/canon-ultimatum.test.js`, reusing the loading pattern from `tests/canon-resources.test.js` (read its header first — plain `require('node:test')` + `JSON.parse(fs.readFileSync(...))`):

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('N1: rules.ultimatum carries the locked bands + scale mapping', () => {
  const u = canon.rules.ultimatum;
  assert.deepStrictEqual(u.bands, { raid: [4, 8], skirmish: [8, 16], invasion: [12, 24] });
  assert.deepStrictEqual(u.scale_of, { SKIRMISH: 'raid', INVASION: 'invasion' });
  assert.strictEqual(u.defender_mult, 1.25);
  assert.ok(Number.isInteger(u.garrison_pc_per_level) && u.garrison_pc_per_level > 0);
  assert.ok(u.outcome.loss_margin > 0 && u.outcome.decisive_margin > 0);
});
test('N1: the 4 ladder conditions carry the locked garrison_mult', () => {
  const gm = {};
  canon.galaxy.conditions.forEach(c => { if (c.garrison_mult !== undefined) gm[c.id] = c.garrison_mult; });
  assert.deepStrictEqual(gm, { fortified: 1.25, intact: 1.0, sacked: 0.6, ruined: 0.3 });
});
test('N1: heal pacing blocks Warring/Famine, runs elsewhere', () => {
  const h = canon.rules.ultimatum.heal.days_per_step;
  assert.strictEqual(h.Warring, 0);
  assert.strictEqual(h.Famine, 0);
  ['Thriving', 'Peace', 'Corrupted'].forEach(k => assert.ok(h[k] > 0, k));
});
test('N1: faction_appetite covers exactly the 20 canon faction ids', () => {
  const ids = canon.factions.map(f => f.id).sort();
  const keys = Object.keys(canon.rules.ultimatum.tribute.faction_appetite).sort();
  assert.deepStrictEqual(keys, ids);
  keys.forEach(k => { const v = canon.rules.ultimatum.tribute.faction_appetite[k];
    assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, k); });
});
test('N1: rebuild mission repairs the condition (+1 step)', () => {
  const row = canon.missions.universal.filter(m => m.id === 'rebuild' || m.mid === 'rebuild' || /rebuild/i.test(m.n || m.name || ''))[0];
  assert.ok(row, 'rebuild row exists');
  assert.strictEqual(row.world_effect.repair_step, 1);
  assert.strictEqual(row.world_effect.prosperity, 4);
});
```

(Adapt the rebuild-row lookup to the row's real id field — inspect `canon.missions.universal` first; the row is the one with `prefer_condition:"ruined"`.)

- [ ] **Step 2: Run to verify failures** — `node --test tests/canon-ultimatum.test.js`.

- [ ] **Step 3: Implement with a script** (write to the session scratchpad, run once, do NOT commit the script): load the JSON, read the real 20 `factions[].id` values and build `faction_appetite` from the flavor pairing above, insert `rules.ultimatum` (after `rules.missions` or wherever `rules` ends — inspect), patch the 4 condition rows, patch the rebuild row, set `meta.version="1.33"`. **Patch textually or dump with the file's exact existing formatting** — inspect `json.dump` indent by diffing; `git diff --stat` must show only intended insertions, not a whole-file reformat. Preserve the trailing newline.

- [ ] **Step 4: Bump the 5 pin files** — `grep -rn '1\.32' tests/` → replace the version-pin value with `1.33` in the 5 canon test files (they are version pins only).

- [ ] **Step 5: Full suite** — `node --test` — all green (564 baseline + 5 new = 569).

- [ ] **Step 6: Commit**
```bash
git add heretics-40k-data-v1.json tests/canon-ultimatum.test.js tests/canon.test.js tests/canon-doors.test.js tests/canon-missions.test.js tests/canon-resources.test.js tests/canon-spoils.test.js
git commit -m "canon v1.33: T-NPC-3 N1 - rules.ultimatum (bands/garrison/ladder/heal/tribute) + condition garrison_mult + rebuild repair_step"
```

### Task 2: The `ULT` agency-core — bands, ladder, garrison, seeded lapse resolver, heal, tribute math

**Files:**
- Modify: `index.html` — new `/*<agency-core>*/ … /*</agency-core>*/` region directly after `/*</mission-core>*/` (~line 2335).
- Create: `tests/_load-agency.js` (copy `tests/_load-world.js`, swap the region markers, export `loadAgency()` → `ULT`).
- Test: `tests/agency-core.test.js` (new)

**Interfaces:**
- Consumes: `canon.rules.ultimatum`, `canon.galaxy.conditions` (via arguments only — the region reads NO globals).
- Produces (exact exported names, used by Tasks 3–6):
  - `ULT.rng(seed)` / `ULT.hashStr(s)` — self-contained mulberry32 + FNV-1a copies (precedent: WORLD duplicates `sideOfFaction`; keeps the region loader-extractable without mission-core).
  - `ULT.scaleOf(threadType, canon) -> 'raid'|'invasion'|null` (null = type carries no clock).
  - `ULT.bandOf(scale, canon) -> [min,max]`.
  - `ULT.pickWindow(band, behavior, r) -> int` — NPC window choice: ferocity→short, cunning→long (N2-ready; node-tested now).
  - `ULT.stepDown(cond)` / `ULT.stepUp(cond)` — the ladder `fortified → intact → sacked → ruined`; non-ladder conditions (consecrated/cursed/infested/besieged/drifting) enter at the `intact` index; `stepUp` ceiling is `intact` (fortified is mission-granted, never healed into).
  - `ULT.garrisonMult(cond, canon) -> number` — condition row's `garrison_mult`, absent → 1.0.
  - `ULT.garrisonPC(level, cond, stationedPC, canon) -> number` — `level × garrison_pc_per_level × garrisonMult(cond) + stationedPC` (stationedPC is the seam for T-TERR-2 stationing + T-GX-G6 arrivals; always ≥0, pass 0 today).
  - `ULT.seedFor(base, day, locId, aggressorId) -> uint32` — `(base ^ (day*2654435761) ^ hashStr('hold:'+locId) ^ hashStr('agg:'+aggressorId)) >>> 0` (prefix tags break XOR symmetry between the two id namespaces).
  - `ULT.resolveLapse(attackPC, defensePC, scale, r, canon) -> {outcome, p, roll, margin, arith}` — `p = att/(att+def)` where def arrives already ×`defender_mult`; `margin = p − roll`; ladder: `margin < −loss_margin` → `'repelled'`; `< 0` → `'repelled_losses'`; `< decisive_margin` → `'sacked'`; else `'captured'` (raid scale caps at `'sacked'`). `arith` = the human-readable feed string, e.g. `"620 PC vs 500×1.25=625 → p 0.50 · roll 0.72 · margin −0.22 → REPELLED WITH LOSSES"`.
  - `ULT.lootOf(level, prodMult, r, canon) -> {cur, res:{Food,Material,Fuel}}` — `cur = round(loot.base × level × prodMult × (0.75+0.5·r()))`, each resource `= round(loot.res_per_level × level × r())`.
  - `ULT.healTick(state, locId, statusLabel, besieged, canon) -> event|null` — reads `state.world.locConds[locId]`; returns null unless the condition is `sacked`/`ruined`; besieged or `days_per_step[statusLabel]` 0/absent → resets nothing, accrues nothing (paused); else `state.world.condHeal[locId]=(+1)`; when the counter reaches `days_per_step[statusLabel]` → `stepUp`, write `locConds` (delete the override when the result is `intact` — canon baseline resumes), delete/reset the counter, return `{kind:'cond_heal', loc:locId, to:<newCond>}`.
  - `ULT.tributeOffer(level, prodMult, scale, r, canon) -> {cur, res:{Food,Material,Fuel}}` — `cur = round(offer_base × level × prodMult × scale_mult[scale] × (0.8+0.4·r()))`, resources as `lootOf` but ×`scale_mult`.
  - `ULT.evalCounter(mult, behavior, appetite, r) -> boolean` — willingness `= 0.6·appetite + 0.4·(behavior.pragmatism ?? 50)` (0–100); accept iff `(willingness/100) × (0.9+0.2·r()) >= (mult−0.5)/2`.

- [ ] **Step 1: Write the failing tests** — `tests/agency-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { loadAgency } = require('./_load-agency');
const fs = require('node:fs'); const path = require('node:path');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const ULT = loadAgency();

test('N1: scaleOf + bandOf read canon', () => {
  assert.strictEqual(ULT.scaleOf('SKIRMISH', canon), 'raid');
  assert.strictEqual(ULT.scaleOf('INVASION', canon), 'invasion');
  assert.strictEqual(ULT.scaleOf('DIPLOMACY', canon), null);
  assert.deepStrictEqual(ULT.bandOf('raid', canon), [4, 8]);
  assert.deepStrictEqual(ULT.bandOf('invasion', canon), [12, 24]);
});
test('N1: pickWindow — ferocity shortens, cunning stretches, always in band', () => {
  const fer = ULT.pickWindow([4, 8], { ferocity: 95, cunning: 10 }, ULT.rng(1));
  const cun = ULT.pickWindow([4, 8], { ferocity: 10, cunning: 95 }, ULT.rng(1));
  assert.ok(fer >= 4 && fer <= 8 && cun >= 4 && cun <= 8);
  assert.ok(fer < cun, 'ferocity ' + fer + ' < cunning ' + cun);
});
test('N1: the condition ladder steps down and heals up to intact only', () => {
  assert.strictEqual(ULT.stepDown('fortified'), 'intact');
  assert.strictEqual(ULT.stepDown('intact'), 'sacked');
  assert.strictEqual(ULT.stepDown('sacked'), 'ruined');
  assert.strictEqual(ULT.stepDown('ruined'), 'ruined');
  assert.strictEqual(ULT.stepDown('infested'), 'sacked');   // non-ladder enters at intact
  assert.strictEqual(ULT.stepUp('ruined'), 'sacked');
  assert.strictEqual(ULT.stepUp('sacked'), 'intact');
  assert.strictEqual(ULT.stepUp('intact'), 'intact');       // never heals into fortified
});
test('N1: garrisonPC = level × per-level × cond mult + stationed', () => {
  assert.strictEqual(ULT.garrisonPC(3, 'fortified', 0, canon), Math.round(3 * 200 * 1.25));
  assert.strictEqual(ULT.garrisonPC(1, 'ruined', 0, canon), Math.round(1 * 200 * 0.3));
  assert.strictEqual(ULT.garrisonPC(2, 'intact', 150, canon), 2 * 200 + 150);
  assert.strictEqual(ULT.garrisonPC(2, 'cursed', 0, canon), 2 * 200); // absent mult → 1.0
});
test('N1: seedFor is order-sensitive and deterministic', () => {
  const a = ULT.seedFor(7, 12, 'ashravine', 'death_guard');
  assert.strictEqual(a, ULT.seedFor(7, 12, 'ashravine', 'death_guard'));
  assert.notStrictEqual(a, ULT.seedFor(7, 12, 'death_guard', 'ashravine')); // prefix tags break symmetry
  assert.notStrictEqual(a, ULT.seedFor(7, 13, 'ashravine', 'death_guard'));
});
test('N1: resolveLapse walks the full ladder with margins; raid caps at sacked', () => {
  // p with att=600 def=625 → ~0.49; drive roll through the rungs
  const mk = x => () => x;
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.99), canon).outcome, 'repelled');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.60), canon).outcome, 'repelled_losses');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.40), canon).outcome, 'sacked');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.01), canon).outcome, 'captured');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'raid', mk(0.01), canon).outcome, 'sacked'); // raid cap
  const r = ULT.resolveLapse(600, 625, 'invasion', mk(0.40), canon);
  assert.ok(/625/.test(r.arith) && /SACKED/i.test(r.arith), 'arithmetic shown: ' + r.arith);
});
test('N1: healTick paces by sector status, pauses besieged, heals to canon baseline', () => {
  const st = { world: { locConds: { x1: 'sacked' }, condHeal: {} } };
  assert.strictEqual(ULT.healTick(st, 'x1', 'Warring', false, canon), null);   // war: no heal
  assert.strictEqual(st.world.condHeal.x1, undefined);
  assert.strictEqual(ULT.healTick(st, 'x1', 'Famine', false, canon), null);    // misery: no heal
  assert.strictEqual(ULT.healTick(st, 'x1', 'Peace', true, canon), null);      // besieged: paused
  for (let i = 0; i < 5; i++) assert.strictEqual(ULT.healTick(st, 'x1', 'Peace', false, canon), null);
  const ev = ULT.healTick(st, 'x1', 'Peace', false, canon);                    // 6th day (Peace=6)
  assert.deepStrictEqual(ev, { kind: 'cond_heal', loc: 'x1', to: 'intact' });
  assert.strictEqual(st.world.locConds.x1, undefined);                         // intact = overlay deleted
  const st2 = { world: { locConds: { x2: 'ruined' }, condHeal: {} } };
  for (let i = 0; i < 3; i++) ULT.healTick(st2, 'x2', 'Thriving', false, canon);
  const ev2 = ULT.healTick(st2, 'x2', 'Thriving', false, canon);               // 4th day (Thriving=4)
  assert.deepStrictEqual(ev2, { kind: 'cond_heal', loc: 'x2', to: 'sacked' });
  assert.strictEqual(st2.world.locConds.x2, 'sacked');
});
test('N1: tribute — offer scales by band, counter eval follows appetite+pragmatism', () => {
  const lo = ULT.tributeOffer(2, 1, 'raid', () => 0.5, canon);
  const hi = ULT.tributeOffer(2, 1, 'invasion', () => 0.5, canon);
  assert.ok(hi.cur > lo.cur, 'invasion offer outweighs raid');
  assert.ok(ULT.evalCounter(1.5, { pragmatism: 90 }, 80, () => 0.5), 'greedy pragmatist pays 1.5x');
  assert.ok(!ULT.evalCounter(2, { pragmatism: 20 }, 10, () => 0.5), 'proud zealot refuses 2x');
});
```

- [ ] **Step 2: Create `tests/_load-agency.js`** (copy `tests/_load-world.js` verbatim, replace the region markers with `/*<agency-core>*/` / `/*<\/agency-core>*/`, export `loadAgency` returning `ULT`), then run `node --test tests/agency-core.test.js` — everything fails (region missing).

- [ ] **Step 3: Implement the region** in `index.html`, immediately after `/*</mission-core>*/`:

```js
/*<agency-core>*/
/* T-NPC-3 N1 — Ultimatum clocks, lapse resolution, condition ladder, tribute math.
   Pure + DOM-free: canon/state arrive as arguments; NO Date.now()/Math.random().
   Seeds derive from persisted state (missionSeedBase) ⊕ the clock's own expiry day
   ⊕ prefix-tagged ids — chunk-independent replay, same discipline as mission boards. */
var ULT=(function(){
  function rng(seed){var a=seed>>>0;return function(){
    a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){
    h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function U(canon){return (canon.rules&&canon.rules.ultimatum)||{};}
  function scaleOf(type,canon){return (U(canon).scale_of||{})[type]||null;}
  function bandOf(scale,canon){return (U(canon).bands||{})[scale]||[4,8];}
  function pickWindow(band,behavior,r){
    var b=behavior||{},fer=(b.ferocity!=null?b.ferocity:50),cun=(b.cunning!=null?b.cunning:50);
    var t=(cun-fer+100)/200;                       // 0 = all ferocity (short), 1 = all cunning (long)
    t=Math.min(1,Math.max(0,t+(r()-0.5)*0.2));
    return band[0]+Math.round(t*(band[1]-band[0]));}
  var LADDER=['fortified','intact','sacked','ruined'];
  function ladderIx(cond){var i=LADDER.indexOf(cond);return i<0?1:i;}   // non-ladder conds enter at intact
  function stepDown(cond){return LADDER[Math.min(LADDER.length-1,ladderIx(cond)+1)];}
  function stepUp(cond){return LADDER[Math.max(1,ladderIx(cond)-1)];}   // floor 1: never heals into fortified
  function garrisonMult(cond,canon){
    var rows=(canon.galaxy&&canon.galaxy.conditions)||[];
    for(var i=0;i<rows.length;i++)if(rows[i].id===cond)return rows[i].garrison_mult!=null?rows[i].garrison_mult:1;
    return 1;}
  function garrisonPC(level,cond,stationedPC,canon){
    return Math.round((level||1)*(U(canon).garrison_pc_per_level||200)*garrisonMult(cond,canon))+(stationedPC||0);}
  function seedFor(base,day,locId,aggressorId){
    return ((base>>>0)^(day*2654435761)^hashStr('hold:'+locId)^hashStr('agg:'+aggressorId))>>>0;}
  function resolveLapse(attackPC,defensePC,scale,r,canon){
    var o=U(canon).outcome||{},lm=o.loss_margin||0.25,dm=o.decisive_margin||0.25;
    var p=attackPC/(attackPC+defensePC),roll=r(),m=p-roll,outcome;
    if(m<-lm)outcome='repelled';
    else if(m<0)outcome='repelled_losses';
    else if(m<dm||scale==='raid')outcome='sacked';
    else outcome='captured';
    var NAMES={repelled:'REPELLED',repelled_losses:'REPELLED WITH LOSSES',sacked:'SACKED',captured:'CAPTURED'};
    var arith=attackPC+' PC vs '+defensePC+' PC (defender-favored) → p '+p.toFixed(2)+
      ' · roll '+roll.toFixed(2)+' · margin '+(m>=0?'+':'')+m.toFixed(2)+' → '+NAMES[outcome];
    return {outcome:outcome,p:p,roll:roll,margin:m,arith:arith};}
  function lootOf(level,prodMult,r,canon){
    var L=U(canon).loot||{},base=L.base||15,rpl=L.res_per_level||2,lv=level||1;
    var res={};['Food','Material','Fuel'].forEach(function(k){res[k]=Math.round(rpl*lv*r());});
    return {cur:Math.round(base*lv*(prodMult||1)*(0.75+0.5*r())),res:res};}
  function healTick(state,locId,statusLabel,besieged,canon){
    var lc=state.world&&state.world.locConds;if(!lc)return null;
    var cond=lc[locId];if(cond!=='sacked'&&cond!=='ruined')return null;
    if(besieged)return null;                                        // clocked ground does not mend
    var per=((U(canon).heal||{}).days_per_step||{})[statusLabel];
    if(!per)return null;                                            // 0/absent = no heal (Warring/Famine)
    state.world.condHeal=state.world.condHeal||{};
    var n=(state.world.condHeal[locId]||0)+1;
    if(n<per){state.world.condHeal[locId]=n;return null;}
    var to=stepUp(cond);delete state.world.condHeal[locId];
    if(to==='intact')delete lc[locId];else lc[locId]=to;            // intact = canon baseline resumes
    return {kind:'cond_heal',loc:locId,to:to};}
  function tributeOffer(level,prodMult,scale,r,canon){
    var T=U(canon).tribute||{},sm=(T.scale_mult||{})[scale]||1,lv=level||1;
    var res={};['Food','Material','Fuel'].forEach(function(k){res[k]=Math.round((T.res_per_level||2)*lv*sm*r());});
    return {cur:Math.round((T.offer_base||20)*lv*(prodMult||1)*sm*(0.8+0.4*r())),res:res};}
  function evalCounter(mult,behavior,appetite,r){
    var prag=(behavior&&behavior.pragmatism!=null)?behavior.pragmatism:50;
    var will=0.6*(appetite||0)+0.4*prag;
    return (will/100)*(0.9+0.2*r())>=(mult-0.5)/2;}
  return {rng:rng,hashStr:hashStr,scaleOf:scaleOf,bandOf:bandOf,pickWindow:pickWindow,
          stepDown:stepDown,stepUp:stepUp,garrisonMult:garrisonMult,garrisonPC:garrisonPC,
          seedFor:seedFor,resolveLapse:resolveLapse,lootOf:lootOf,healTick:healTick,
          tributeOffer:tributeOffer,evalCounter:evalCounter};
})();
/*</agency-core>*/
```

(Note `tributeOffer` reads `T.res_per_level` — add `"res_per_level": 2` inside the canon `tribute` block in Task 1; the Task 1 shape above must include it. If Task 1 already committed without it, add it in this task's canon touch-up and note it in the commit.)

- [ ] **Step 4: Full suite** — `node --test` — green (569 + 9 new = 578). The boot proxy (`tests/engine-syntax.test.js`) compiles the new region.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/_load-agency.js tests/agency-core.test.js heretics-40k-data-v1.json
git commit -m "engine: N1 task 2 - ULT agency-core (bands, ladder, garrison, seeded lapse resolver, heal, tribute math)"
```
(Drop the JSON from the add list if it needed no touch-up.)

### Task 3: Creation glue — window picker, Ultimatum metadata, Besieged, countdown UI

**Files:**
- Modify: `index.html` — thread-start menu (~3322–3328), `startThread` (~2693–2702), `foundingWorld()` (~2546) + `init()` backfill (~4574 area) for `condHeal`, thread board row (~3355–3375), `threadHeader` (~3616–3621), GLOSS entries.

**Interfaces:**
- Consumes: `ULT.scaleOf/bandOf` (Task 2), `WORLD.dayIndexAt` (existing), `effCond` (index.html:425), `lById` (:491).
- Produces (consumed by Tasks 4–6): `t.ultimatum = {scale, windowDays, expiresDay, aggressor, prev, offer:null, offerState:null}` on every SKIRMISH/INVASION thread the player starts — `expiresDay` = `WORLD.dayIndexAt(S,D,Date.now()) + windowDays` (int, epoch-derived); `prev` = the `effCond` of the location at creation (what Besieged replaces, what garrison math reads); `aggressor` = `S.player.faction`. Helper `activeUltAt(lid) -> thread|null` (first non-done thread whose `ultimatum` targets `lid`). Helper `ultDaysLeft(t) -> int` (`t.ultimatum.expiresDay − WORLD.dayIndexAt(S,D,Date.now())`).

- [ ] **Step 1: Implement the helpers** (beside `pRuler` ~3568):

```js
/* T-NPC-3 N1: one active Ultimatum per location (spec pacing guard). */
function activeUltAt(lid){for(var i=0;i<S.threads.length;i++){var t=S.threads[i];
  if(t.ultimatum&&!t.done&&t.lid===lid)return t;}return null}
function ultDaysLeft(t){return t.ultimatum.expiresDay-WORLD.dayIndexAt(S,D,Date.now())}
```

- [ ] **Step 2: The window picker.** In the thread-start menu handler (~3322–3328: `['Diplomacy','Mission','Skirmish','Invasion']` → `startThread(pl.id,l,ty)`): when the picked type maps to a scale (`ULT.scaleOf(ty.toUpperCase(),D)`), instead of calling `startThread` directly, render three buttons into the `#loctm` slot — `Short (Nd)` / `Standard (Nd)` / `Long (Nd)` where N = band min / round((min+max)/2) / max — each calling `startThread(pl.id,l,ty,null,{ultDays:N})`. If `activeUltAt(l.id)` is truthy, render the dim line `'A clock already runs against this ground.'` instead of the picker and do not start the thread. DIPLOMACY/MISSION paths unchanged.

- [ ] **Step 3: Stamp the metadata in `startThread`** (~2693; it already takes `(pid,l,type,npcId,opts)`): after the thread literal is built and before `S.threads.push(t)`:

```js
  var _sc=ULT.scaleOf(t.type,D);
  if(_sc&&opts&&opts.ultDays){
    var _pv=effCond(l);
    t.ultimatum={scale:_sc,windowDays:opts.ultDays,
      expiresDay:WORLD.dayIndexAt(S,D,Date.now())+opts.ultDays,
      aggressor:S.player.faction,prev:_pv,offer:null,offerState:null};
    S.world.locConds=S.world.locConds||{};S.world.locConds[l.id]='besieged';
  }
```
The Besieged pill then renders for free at the existing sites (:3267 panel pill, :3253 grid badge) via `effCond`.

- [ ] **Step 4: Seed `condHeal` in BOTH sites** — `foundingWorld()` line ~2546: extend `doorTiers:{},doorBuilds:{},locConds:{},` with `condHeal:{},`; `init()` backfill block (~4574): add `if(!S.world.condHeal)S.world.condHeal={};` beside the `locConds` backfill.

- [ ] **Step 5: Countdown UI.** (a) `threadHeader` (~3616–3621): when `t.ultimatum && !t.done`, append to `.thhdr-meta`: `'⏳ Ultimatum: '+Math.max(0,ultDaysLeft(t))+' game days — lapse resolves by garrison roll'` (wrap in the existing `annotate`/GLOSS pattern). (b) The thread-board row template (~3371): add the same compact `'⏳ 'N+'d'` mono chip when `t.ultimatum && !t.done`. (c) GLOSS: add `Ultimatum` — "A respond-by clock set when the thread opens. If it lapses unresolved, the assault resolves by a seeded garrison-favored roll — the defenders' ground and readiness against the force you committed." and `Besieged` (quote the canon condition row's effects: doors close, output −20%, tier −1).

- [ ] **Step 6: Suite + browser E2E** — `node --test` green; serve `:8765`, `window._noPersist=true`: found a commander → map → own/foreign location → start a Skirmish → picker shows 4/6/8 → pick Standard → thread opens with the ⏳ header; location pill reads Besieged; second thread attempt at the same location shows the already-clocked line; board row shows the chip; 0 console errors.

- [ ] **Step 7: Commit**
```bash
git add index.html
git commit -m "engine: N1 task 3 - ultimatum stamped at creation (band picker), Besieged while clocked, countdown UI, condHeal seeded both sites"
```

### Task 4: Lapse resolution — boot catch-up + live check, outcome ladder applied

**Files:**
- Modify: `index.html` — new glue `resolveUltLapses()` beside `activeUltAt`; call sites in `init()` (after the door-build loop ~4577–4580, pushing into `_wc.events` BEFORE `WORLD.digest` runs at ~4581) and at the top of `openT` (~3631) + `rTL` (~3348); `WORLD.digest` (~1706–1742) gains the aggregate line for `{kind:'ult_lapse'}` + `{kind:'cond_heal'}` events.
- Test: `tests/agency-core.test.js` (append — digest lines), plus a new glue-shape test is NOT possible (DOM) — covered by boot proxy + E2E.

**Interfaces:**
- Consumes: `ULT.seedFor/rng/resolveLapse/garrisonPC/stepDown/lootOf`, `fpc` (:2986), `fPl` (:488), `lById` (:491), `captureOnVictory` (:3600), `addStock` (:3580), `statBase`, `liveScores`.
- Produces: `resolveUltLapses(nowMs) -> events[]` — resolves EVERY non-done clocked thread with `expiresDay <= WORLD.dayIndexAt(S,D,nowMs)`; each resolution is fully deterministic from persisted state (seed uses the clock's own `expiresDay`, so resolving late ≠ different roll). Emits `{kind:'ult_lapse', loc, planet, outcome, arith}` events for the digest/feed.

- [ ] **Step 1: Implement `resolveUltLapses`:**

```js
/* T-NPC-3 N1: lapse = the seeded auto-battle. Deterministic off persisted state —
   seed uses the clock's own expiresDay (day ⊕ holding ⊕ aggressor), so a 30-day
   catch-up chunk and a same-day live check tell the identical story. Own conclude
   path: never concludeThread (no mission payout, no streak ticks). */
function resolveUltLapses(nowMs){
  var today=WORLD.dayIndexAt(S,D,nowMs),out=[];
  S.threads.forEach(function(t){
    var u=t.ultimatum;if(!u||t.done||u.expiresDay>today)return;
    var fp=fPl(t.pl),l=fLoc(t.pl,t.lid);if(!fp||!l)return;
    var att=0;(t.forces||[]).forEach(function(fn){var f=S.forces.filter(function(x){return x.n===fn})[0];if(f)att+=fpc(f);});
    if(!att)att=1;                                             // an abandoned thread still resolves
    var def=Math.round(ULT.garrisonPC(l.level,u.prev,0,D)*((D.rules.ultimatum||{}).defender_mult||1.25));
    var r=ULT.rng(ULT.seedFor(S.world.missionSeedBase,u.expiresDay,t.lid,u.aggressor));
    var res=ULT.resolveLapse(att,def,u.scale,r,D);
    // condition: besieged lifts; ladder writes down from prev
    var end=u.prev;
    if(res.outcome==='repelled_losses'||res.outcome==='sacked')end=ULT.stepDown(u.prev);
    if(end==='intact'&&!lById(t.lid).condition)delete S.world.locConds[t.lid];
    else if(end===l.condition)delete S.world.locConds[t.lid];
    else S.world.locConds[t.lid]=end;
    if(res.outcome==='sacked'){var loot=ULT.lootOf(l.level,fp.p.prod_mult||1,r,D);
      S.cur=(S.cur||0)+loot.cur;
      if(S.world.holdings.length)addStock(S.world.holdings[0],loot.res);
      res.arith+=' · loot '+loot.cur+'c';}
    if(res.outcome==='captured')captureOnVictory(t,{kind:'lapse'},true);
    t.done={kind:'ult_lapse',victor:res.outcome==='sacked'||res.outcome==='captured'?'attacker':'defender',at:Date.now()};
    t.posts.push({who:'THE RECORD',tag:'',stamp:nowStamp(),
      body:'⏳ THE CLOCK RUNS OUT — '+l.name+'. '+res.arith});
    S.world.log=S.world.log||[];
    S.world.log.unshift(nowStamp()+' — ULTIMATUM LAPSED at '+l.name+': '+res.arith);
    out.push({kind:'ult_lapse',loc:l.name,planet:fp.p.name,outcome:res.outcome,arith:res.arith});
  });
  if(out.length)persist();
  return out;
}
```
(Note: `t.state` untouched — no combatant mutation, no spoils, no streaks. The `end===l.condition` branch keeps the overlay sparse when the outcome lands back on the canon-authored value.)

- [ ] **Step 2: Wire the call sites.** (a) `init()`: after the door-build loop and BEFORE `S._digest=...`: `resolveUltLapses(Date.now()).forEach(function(e){_wc.events.push(e);});` (b) `openT` (~3631) and `rTL` (~3348) tops: `resolveUltLapses(Date.now());` — a live session crossing an expiry sees it resolve on next look, identical roll.

- [ ] **Step 3: Digest lines.** In `WORLD.digest` (~1738, before the compressed line): `ult_lapse` events → one line each (they are rare, door_built precedent): `'⏳ '+e.loc+' ('+e.planet+') — the clock ran out: '+e.arith`; `cond_heal` events → aggregate per loc: `'🔧 '+loc+' mends — now '+to+'.'` Append matching asserts to `tests/agency-core.test.js`... **`digest` lives in world-core, so the asserts go in `tests/world-core.test.js`** (its loader already extracts WORLD):

```js
test('N1: digest renders ult_lapse + cond_heal lines', () => {
  const d = WORLD.digest([
    { kind: 'ult_lapse', loc: 'The Bastion', planet: 'Vigilus', outcome: 'sacked', arith: '600 PC vs 625 PC (defender-favored) → p 0.49 · roll 0.40 · margin +0.09 → SACKED' },
    { kind: 'cond_heal', loc: 'x1', to: 'intact' }]);
  assert.ok(d.lines.some(l => /Bastion/.test(l) && /SACKED/.test(l)));
  assert.ok(d.lines.some(l => /mends/.test(l)));
});
```

- [ ] **Step 4: Suite + browser E2E** — `node --test` green (579). E2E (`window._noPersist=true`): start a Skirmish with the Short window at an NPC-garrisoned location; in console set `S.time.epoch-=9*D.tick.day_minutes*60000` (drive 9 days past), call `resolveUltLapses(Date.now())` → thread carries the RECORD post with the full arithmetic; location condition stepped per outcome; World Log line present; re-running resolves nothing (idempotent — `t.done` set). Reload path: boot with the same shifted epoch → digest shows the ⏳ line. 0 console errors.

- [ ] **Step 5: Commit**
```bash
git add index.html tests/world-core.test.js
git commit -m "engine: N1 task 4 - lapse resolution (seeded garrison roll, outcome ladder, loot/capture, feed arithmetic) on boot + live check"
```

### Task 5: Self-heal on the tick + Rebuild repairs (+1 step) + manual Rebuild/Liberate + clocked-fight cleanup

**Files:**
- Modify: `index.html` — `init()` per-tick glue loop (beside the door-build loop ~4577–4580), `concludeThread` world_effect block (~3536–3548) + ultimatum cleanup, location panel `atHere` block (~3300–3304) + handler wiring (~3315–3328).
- Test: `tests/agency-core.test.js` (heal loop already covered in Task 2; append the repair-step glue test to `tests/mission-outcome.test.js` ONLY if a pure seam exists — otherwise E2E covers it, note in report).

**Interfaces:**
- Consumes: `ULT.healTick/stepUp`, `WORLD.sectorStatus`, `liveScores` (:460), `activeUltAt` (Task 3), `lById`, `sectorOfPlanet` (:493), `startThread`, `MISSION.genHostiles` path via `seedCombat` (:2657).
- Produces: per-tick heal events into `_wc.events`; `we.repair_step` honored at mission conclude; `manualRestore(pl,l,kind)` glue (`kind` = `'rebuild'|'liberate'`).

- [ ] **Step 1: The tick loop.** In `init()`, inside/beside the existing `for(_db=0;_db<_wc.ticks;_db++)` door loop (extend the same loop — one pass per tick):

```js
    Object.keys(S.world.locConds||{}).forEach(function(lid){
      var _l=lById(lid);if(!_l)return;
      var _pid=null;D.galaxy.segmentums.forEach(function(g){g.zones.forEach(function(z){z.sectors.forEach(function(s){
        (s.planets||[]).forEach(function(p){if((p.locations||[]).some(function(x){return x.id===lid}))_pid=p.id;});});});});
      if(!_pid)return;
      var _sid=sectorOfPlanet(_pid);
      var _stt=WORLD.sectorStatus(liveScores(_sid)||{},D);
      var _ev=ULT.healTick(S,lid,_stt,!!activeUltAt(lid),D);
      if(_ev){_ev.loc=_l.name;_wc.events.push(_ev);}
    });
```
(Perf note: the walk only touches overlaid locations — the sparse damaged set, not 290. Hoist a `locPlanetOf(lid)` helper beside `lById` if one doesn't exist rather than inlining the triple loop; `lById` already does this walk — extend IT to also return the planet id as `lById(id,true) -> {l,pid}` and use that, keeping one canonical walker.)

- [ ] **Step 2: Rebuild conclude repairs.** In the mission world_effect block (~3545–3548), beside `clear_condition`:

```js
   // repair_step (Rebuild): the mission actually mends the ground — +1 ladder step
   if(we.repair_step&&t.mission.lid){
    var _rc=effCond(lById(t.mission.lid)||{});var _to=ULT.stepUp(_rc);
    S.world.locConds=S.world.locConds||{};
    if(_to==='intact'&&!((lById(t.mission.lid)||{}).condition&&(lById(t.mission.lid)||{}).condition!=='intact'))delete S.world.locConds[t.mission.lid];
    else S.world.locConds[t.mission.lid]=_to;
    delete (S.world.condHeal||{})[t.mission.lid];}
```

- [ ] **Step 3: Clocked-fight cleanup.** In `concludeThread` (after `captureOnVictory` ~3561): if `t.ultimatum` — the fight resolved before the clock; restore the ground: `if(S.world.locConds[t.lid]==='besieged'){if(t.ultimatum.prev==='intact'&&!(lById(t.lid)||{}).condition)delete S.world.locConds[t.lid];else S.world.locConds[t.lid]=t.ultimatum.prev;}` Same restore in `exitThread`'s removal path (~3420, AFTER the streak tick at 3418 — do not touch the tick itself): abandoning a clocked thread lifts the siege only when the thread dies there (pursuit/flee path keeps `t` alive? — inspect: `exitThread` splices the thread at 3420, so restore just before the splice).

- [ ] **Step 4: Manual Rebuild/Liberate.** In the `atHere` action block (~3300–3304), when `S.world.holdings.indexOf(pl.id)>=0`:
  - `effCond(l)` is `sacked`/`ruined` → button `🔧 Rebuild (no payout)`;
  - `effCond(l)` is `infested` AND `npcForceAt(pl.id,l.name)` → button `⚔ Liberate (no payout)`.
  Handler `manualRestore(pl,l,kind)` mirrors the `acceptMission` thread literal (~2781–2784) with: `type:'MISSION'`, `mission:{iid:'man_'+Date.now(),mid:kind==='rebuild'?'rebuild':'liberation',payout:0,world_effect:kind==='rebuild'?{repair_step:1}:{conflict:-4,clear_condition:true},pl:pl.id,lid:l.id,n:(kind==='rebuild'?'Rebuild ':'Liberate ')+l.name}`, objective from the matching canon universal row (`restore` w/ its `params` for rebuild; `clear_all` + `seedCombat` hostiles for liberate — reuse the exact accept-path calls at ~2789–2800, payout 0). No board row involved (nothing to remove at conclude — the removal filter at 3558 no-ops on an absent iid; verify, don't assume).

- [ ] **Step 5: Suite + browser E2E** — `node --test` green. E2E: sack a location via a lapse (Task 4 flow), then advance days on a Peace sector → digest shows the 🔧 mend line and the pill steps `Sacked → Intact`; at an own sacked holding the Rebuild button spawns the no-payout thread, 3 work posts conclude it, condition steps up, `S.cur` unchanged (payout 0); a Warring-sector sack does NOT mend (drive `S.world.stats[sid].conflict=70` first). 0 console errors.

- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "engine: N1 task 5 - condition self-heal on the tick (sector-paced, siege-paused), rebuild +1 step (mission + manual), clocked-fight cleanup"
```

### Task 6: TRIBUTE — the third response

> **Scope note (record in the close-out report):** the locked payment palette is currency/resources/items/captives/bodies. In N1 the only reachable defender is the NPC side (players cannot yet BE defenders — NPC-initiated ultimatums are N2), so the offer generator covers currency + resources + captive-return (a TAKEN model coming home). The player-side payment composer (picking items/CAPTIVE/REMAINS objects out of `S.inv` to buy off an attacker) becomes reachable — and gets built — with N2's NPC-initiated clocks.

**Files:**
- Modify: `index.html` — `startThread` (seed the offer), `threadView` action area (~4237–4241 composer region — insert the tribute panel above the composer while `t.state.phase!=='battle'` or pre-join), handlers; GLOSS `Tribute`.
- Test: `tests/agency-core.test.js` (offer/eval already pure-tested in Task 2 — append one integration-shape test for offer seeding determinism).

**Interfaces:**
- Consumes: `ULT.tributeOffer/evalCounter/rng/seedFor`, `t.ultimatum` (Task 3), `S.npcState` behavior (index.html:2414–2423), `D.rules.ultimatum.tribute.faction_appetite`, TAKEN models (`S.roster[].st==='TAKEN'`), `addStock` (:3580).
- Produces: `t.ultimatum.offer = {cur, res, captive:modelId|null}`, `t.ultimatum.offerState = 'open'|'declined'|'countered'|'accepted'|'withdrawn'`, conclude kind `'tribute'`.

- [ ] **Step 1: Seed the offer at creation.** In the Task 3 `startThread` stamp, after `t.ultimatum` is built — the defender's opening offer is deterministic off the same seed base (day 0 of the clock, distinct tag):

```js
    var _or=ULT.rng(ULT.seedFor(S.world.missionSeedBase,t.ultimatum.expiresDay,l.id,'tribute:'+t.ultimatum.aggressor));
    var _off=ULT.tributeOffer(l.level,fPl(pid).p.prod_mult||1,_sc,_or,D);
    var _tk=S.roster.filter(function(m){return m.st==='TAKEN'})[0];
    t.ultimatum.offer={cur:_off.cur,res:_off.res,captive:_tk?_tk.id:null};
    t.ultimatum.offerState='open';
```
And push the defender's offer post: `t.posts.push({who:'THE DEFENDERS',tag:'',stamp:nowStamp(),body:'🕊 TRIBUTE OFFERED — withdraw, and take '+_off.cur+' currency'+(+_off.res.Food+_off.res.Material+_off.res.Fuel>0?' + '+_off.res.Food+'/'+_off.res.Material+'/'+_off.res.Fuel+' (Food/Material/Fuel)':'')+(_tk?' + the return of '+_tk.n:'')+'. The offer stands while the clock runs.'});`

- [ ] **Step 2: The response panel.** In `threadView`, when `t.ultimatum && !t.done && t.ultimatum.offerState==='open'||t.ultimatum.offerState==='countered'` is pending — render above the composer a compact 3-button block (mirror the aftermath END THREAD button style ~4368–4381): **Accept tribute** · **Decline** (fight on — clock keeps running) · **Counter-demand ×1.5 / ×2** (two sub-buttons from `counter_options`). Rules: counter allowed ONCE (`offerState==='open'` only); after `'declined'`/`'withdrawn'` the panel collapses to a dim one-liner.

- [ ] **Step 3: Handlers.**
  - **Accept:** `S.cur+=offer.cur; if(S.world.holdings.length)addStock(S.world.holdings[0],offer.res);` captive: the TAKEN model returns (`m.st='GARRISON';m.loc=posTxt();` — the exact release idiom at :2932). Restore the location per the Task 5 cleanup (besieged → prev). `t.done={kind:'tribute',victor:'accord',at:Date.now()}`; RECORD post `'🕊 TRIBUTE — the defenders buy peace: '+...`; World Log line; `persist()`.
  - **Decline:** `offerState='declined'`; RECORD post; the clock keeps running (lapse still armed).
  - **Counter ×m:** deterministic eval — defender NPC's behavior if the location has a placed NPC (`npcsAt(t.pl,t.lid)[0]` → `S.npcState[id].behavior`, values object), else `{pragmatism:50}`; appetite = `faction_appetite[defFacId]` where `defFacId` = `npcFactionOf(npcForceAt(t.pl,l.name).desc).id` (the exact mint-time chain at :2666–2670 — reuse, don't re-derive); `var cr=ULT.rng(ULT.seedFor(S.world.missionSeedBase,t.ultimatum.expiresDay,t.lid,'counter:'+m));` accept → offer scales (`cur*=m`, res ×m rounded), `offerState='countered'` with an updated offer post, and the Accept button now pays the scaled offer; refuse → `offerState='withdrawn'`, RECORD post `'The defenders withdraw their offer. Steel will answer.'`
- GLOSS `Tribute`: "The third answer to an Ultimatum: fight, ignore, or pay. Defenders may buy peace with currency, resources, or the return of the taken; the attacker names the price — or the clock does."

- [ ] **Step 4: Determinism test** (append to `tests/agency-core.test.js`):

```js
test('N1: tribute offer + counter eval are seed-stable', () => {
  const r1 = ULT.rng(ULT.seedFor(9, 15, 'x1', 'tribute:death_guard'));
  const r2 = ULT.rng(ULT.seedFor(9, 15, 'x1', 'tribute:death_guard'));
  assert.deepStrictEqual(ULT.tributeOffer(2, 1, 'raid', r1, canon), ULT.tributeOffer(2, 1, 'raid', r2, canon));
});
```

- [ ] **Step 5: Suite + browser E2E** — `node --test` green (580). E2E: start a clocked Skirmish → defender's 🕊 post present with concrete numbers; Counter ×1.5 vs a high-appetite defender (e.g. T'au ground) → scaled offer; Accept → `S.cur` rises by exactly the scaled amount, location pill back to prev, thread reads done/tribute, board row clock gone; a second run with the same state produces identical offer numbers. Decline path: clock still ticks (lapse from Task 4 still fires later). 0 console errors.

- [ ] **Step 6: Commit**
```bash
git add index.html tests/agency-core.test.js
git commit -m "engine: N1 task 6 - TRIBUTE third response (seeded defender offer, accept/decline/counter by personality + faction appetite)"
```

### Task 7: Whole-slice LIFECYCLE review + fix wave + board close-out

**Files:**
- Modify: `BACKLOG.md` (T-NPC-3 row), `CLAUDE.md` (N1 bullet), `docs/superpowers/plans/2026-08-09-npc3-n1-clocks-ultimatums.md` (checkboxes).

- [ ] **Step 1: Full-suite + E2E sweep** — `node --test` green; browser sweep of all 7 screens + a clocked thread + a lapse + a tribute accept, 0 console errors.
- [ ] **Step 2: LIFECYCLE review** (final reviewer, most capable model — walks lifecycles, NOT diffs; house lesson: cross-task bugs only fall out here):
  1. **Fresh founding → clock → lapse across catch-up chunks:** found, start clocked thread, quit; reload 3 days later, quit; reload 10 days later vs ONE 13-day reload — identical outcome, identical arithmetic (chunk-independence).
  2. **Save/reload mid-clock:** `t.ultimatum` survives snapshot/relink; Besieged pill persists; `condHeal` counters persist; no double offer post on rehydrate (`THREAD.create` shallow-copy — verify posts aren't re-seeded).
  3. **Tribute accept → no leaks:** clock cleared, besieged restored, lapse never fires on the done thread, counter-then-accept pays the SCALED amount exactly once.
  4. **Fight-to-conclusion on a clocked thread:** win/lose/flee before expiry — besieged restored, no lapse post, streak ticks untouched (diff-proof :3418/:3496 unchanged).
  5. **Heal loop:** sack → Warring sector never mends → conflict falls → mends stepwise ruined→sacked→intact → overlay deleted at intact; besieged pause verified; manual Rebuild mid-heal resets the counter.
  6. **Old save (pre-N1):** boots clean — `condHeal` backfilled, no clocked threads, nothing fires.
  7. **Grep-proofs:** `genHostiles` call sites unchanged; `tickStreaksAndSync` exactly 2 call sites; `missionSeedBase`/`missionDay` writers unchanged; no `Date.now`/`Math.random` inside `/*<agency-core>*/`.
- [ ] **Step 3: Fix wave if findings** (tests first; re-review the fix wave for the same bug class elsewhere — house lesson), else close out: BACKLOG T-NPC-3 row → `ready-to-push` (N1) with exact paths + the tunables-for-Daak list (garrison base 200, margins, loot, heal days, tribute sizing, 20 appetites, SKIRMISH→raid mapping); CLAUDE.md gains the N1 bullet; commit `backlog: T-NPC-3 N1 built + reviewed, ready-to-push`.
