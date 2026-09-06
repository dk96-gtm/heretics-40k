# The Hall — Slice B1 Implementation Plan (T-SOC-1 · regulars, trust ladder, faction judge)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Hall's persistent people and the relationship that grows with them — 1-3
scheduled **regulars** per Hall (Host / Broker / Champion, present only in their day-phase
blocks), a 4-rung per-regular **trust ladder**, and a **faction judge** that scores your acts
differently per culture (derived from the shipped doctrine axes, with four authored overrides
and the Tyranid recognition-ladder reskin).

**Architecture:** Extend the pure `/*<hall-core>*/` region with regular scheduling + the trust
ladder + the act judge (all deterministic, DOM-free — the Slice A idiom). Extend `S.social`
with a `reg` sub-ledger keyed by location+role. Canon gains `rules.hall.regulars` (per-skin
role names + role weights) and `rules.hall.trust` (rung names, thresholds, act base weights,
the axis-derivation constants, the 4 overrides, the Tyranid ladder). Engine glue renders
regulars as pinned rows above the crowd and gates the rung-② rumor upgrade already latent in
`rumorFor`. **CONTEST (BRAWL/MATCH) + hall law penalties are Slice B2 — NOT this plan;** this
slice ships the substrate they build on, so the act ledger accepts WIN/NOBLE-LOSS/CHEAT acts
as an API even though B2 is what will *emit* them from real contests.

**Tech Stack:** vanilla ES5 JS in `index.html` · canon JSON · Node built-in test runner
(`node --test`) · Playwright MCP for the browser check.

**Spec:** `docs/superpowers/specs/2026-09-06-social-door-design.md` §6 (regulars, trust ladder,
judge, overrides, Tyranid ladder). Implements the §12 "Slice B" scope minus contests/hall-law.

## Global Constraints

- Canon version: bump `meta.version` ONCE in Task 1 to the next free number **at execution
  time** — read the current `meta.version` first (a concurrent session has been minting
  versions; do NOT hardcode; pick current+0.01 or the next integer step the file is using).
- Terminology law: always **"model"**, never "chassis".
- The `/*<hall-core>*/` region stays PURE: canon + state as arguments; NO `Date.now()`, NO
  `Math.random()`; determinism seeds off `ctx.seedBase`.
- Storage decision (deliberate, deviates from spec's "npcState entry" wording): trust rides
  `S.social.reg`, NOT `npcState`. Rationale — Slice A already established `S.social` as the
  Hall's own ledger (`S.social.pat`); regulars are Hall-scoped; one ledger keeps the Hall
  self-contained and the Stage-3 AI seam is unaffected (a regular's record is still a stable
  keyed object). New `S.social` sub-keys must not break the Slice A `{pat:{}}` shape — extend
  to `{pat:{}, reg:{}}` and seed `reg` in BOTH the defaults literal AND `init()` backfill.
- SHARED WORKTREE: a concurrent session (T-NPC-3.5) edits `index.html`/canon/`CLAUDE.md`/
  `BACKLOG.md` too. **Do NOT begin engine execution until the controller confirms the hot
  lane is released.** When editing shared files, `git add -p` your own hunks only — never
  `git add -A`, never stage brain/npc_kit/kit/enumeratePairs content. Verify each commit with
  `git show --stat` + a brain-leak grep.
- Green-gate: `node --test $(ls tests/*.test.js | grep -v canon-npcbrain | grep -v kit-core | grep -v brain-core)` (excludes the peer's in-flight files if they are mid-task; if the full suite is green, use it).
- All numbers are flagged-for-review defaults (spec §13), not locked balance.

## File Structure

- `heretics-40k-data-v1.json` — `rules.hall.regulars`, `rules.hall.trust`, `meta.version`.
- `index.html` — extend `/*<hall-core>*/` (regularsAt, rungOf, judgeAct, culture judge
  resolution); `S.social.reg` seeding (defaults literal + init()); regular render rows +
  rung-gated rumor in the `hall` renderDoor branch; a small trust-record helper in the glue.
- `tests/hall-core.test.js` — extend (regular scheduling, ladder, judge per culture).
- `tests/canon-hall.test.js` — extend (regulars/trust canon completeness pins).

---

### Task 1: Canon — `rules.hall.regulars` + `rules.hall.trust`

**Files:**
- Modify: `heretics-40k-data-v1.json`
- Test: `tests/canon-hall.test.js` (extend)

**Interfaces:**
- Produces: `rules.hall.regulars` = `{roles:['host','broker','champion'], names:{[facId]:{host,broker,champion}},
  weights:{[facId]:{host,broker,champion}} , phase_blocks:{host:[...],broker:[...],champion:[...]}}`
  (phase_blocks = arrays of the 8 phase indices each role is present in).
- Produces: `rules.hall.trust` = `{rungs:['stranger','known','trusted','sworn'],
  thresholds:[0,3,8,15], act_base:{offer:1,win:2,noble_loss:1,cheat_caught:-2,cheat_clean:1,
  job_done:2,job_dropped:-2,lawbreak:-4,presence:1}, axis:{honor_pivot:60,cunning_pivot:60,
  ferocity_pivot:60,pragmatism_pivot:60,supremacism_pivot:60}, overrides:{daemons:{...},
  necrons:{...},harlequins:{...}}, tyranid:{rungs:['prey_shaped','tasted','patterned',
  'assimilated_adjacent'], recognition:true}}` plus per-skin rung display names.

- [ ] **Step 1: Write the failing canon pins**

Append to `tests/canon-hall.test.js`:

```js
test('rules.hall.regulars: roles, names, weights, phase blocks complete for 20 factions', () => {
  const R = D.rules.hall.regulars;
  assert.ok(R, 'rules.hall.regulars missing');
  assert.deepEqual(R.roles, ['host', 'broker', 'champion']);
  for (const f of FACTIONS) {
    for (const role of R.roles) {
      assert.ok(R.names[f] && typeof R.names[f][role] === 'string' && R.names[f][role].length > 0, 'regular name missing: ' + f + '/' + role);
      assert.ok(R.weights[f] && typeof R.weights[f][role] === 'number', 'regular weight missing: ' + f + '/' + role);
    }
  }
  for (const role of R.roles) {
    assert.ok(Array.isArray(R.phase_blocks[role]) && R.phase_blocks[role].length >= 1, 'phase block missing: ' + role);
    for (const p of R.phase_blocks[role]) assert.ok(p >= 0 && p <= 7, 'bad phase index for ' + role);
  }
});

test('rules.hall.trust: rungs, thresholds, act weights, judge axis, overrides, tyranid ladder', () => {
  const T = D.rules.hall.trust;
  assert.ok(T, 'rules.hall.trust missing');
  assert.deepEqual(T.rungs, ['stranger', 'known', 'trusted', 'sworn']);
  assert.equal(T.thresholds.length, 4);
  assert.equal(T.thresholds[0], 0);
  for (let i = 1; i < 4; i++) assert.ok(T.thresholds[i] > T.thresholds[i - 1], 'thresholds must ascend');
  for (const act of ['offer', 'win', 'noble_loss', 'cheat_caught', 'cheat_clean', 'job_done', 'job_dropped', 'lawbreak', 'presence'])
    assert.ok(typeof T.act_base[act] === 'number', 'act_base missing: ' + act);
  assert.ok(T.act_base.lawbreak < 0 && T.act_base.cheat_caught < 0, 'penalties must be negative');
  for (const ov of ['daemons', 'necrons', 'harlequins']) assert.ok(T.overrides[ov], 'override missing: ' + ov);
  assert.deepEqual(T.tyranid.rungs, ['prey_shaped', 'tasted', 'patterned', 'assimilated_adjacent']);
  assert.equal(T.tyranid.recognition, true);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test tests/canon-hall.test.js` → FAIL (regulars/trust missing).

- [ ] **Step 3: Author the canon** (add under `rules.hall`, sibling of `pools`/`culture`/`events`)

```json
"regulars":{
 "roles":["host","broker","champion"],
 "phase_blocks":{"host":[1,2,3,4,5],"broker":[4,5,6,7],"champion":[4,5,6]},
 "names":{
  "black_legion":{"host":"the Warband-Keeper","broker":"the Spoils-Broker","champion":"the Trophy-Champion"},
  "death_guard":{"host":"the Feast-Warden","broker":"the Blight-Peddler","champion":"the Endurance-Champion"},
  "world_eaters":{"host":"the Pit-Master","broker":"the Meat-Broker","champion":"the Pit-Champion"},
  "thousand_sons":{"host":"the Curator","broker":"the Whisper-Merchant","champion":"the Riddlemaster"},
  "emperors_children":{"host":"the Salonnier","broker":"the Procurer","champion":"the Virtuoso"},
  "daemons":{"host":"the Ringmaster","broker":"the Bargain-Keeper","champion":"the Reveller-Champion"},
  "astartes":{"host":"the Saga-Warden","broker":"the Scrounger","champion":"the Cage-Champion"},
  "militarum":{"host":"the Quartermaster-Sergeant","broker":"the Fixer","champion":"the Regimental Champion"},
  "mechanicus":{"host":"the Fane-Keeper","broker":"the Data-Broker","champion":"the Logic-Champion"},
  "sororitas":{"host":"the Refectorian","broker":"the Almoner","champion":"the Champion of Faith"},
  "custodes":{"host":"the Watch-Keeper","broker":"the Seneschal","champion":"the Blade-Champion"},
  "tyranids":{"host":"the Synapse-Node","broker":"a Lictor-Shadow","champion":"the Broodguard Alpha"},
  "orks":{"host":"da Brewboss","broker":"da Sneaky-Git","champion":"da Pit-Champ"},
  "necrons":{"host":"the Chamberlain","broker":"the Reclaimer","champion":"the Regicide-Master"},
  "aeldari":{"host":"the Dome-Keeper","broker":"the Path-Broker","champion":"the Blade-Dancer"},
  "drukhari":{"host":"the Gallery-Master","broker":"the Flesh-Broker","champion":"the Duellist"},
  "tau":{"host":"the Hall-Steward","broker":"the Kroot Envoy","champion":"the Strategy-Champion"},
  "gsc":{"host":"the Congregation-Elder","broker":"the Cell-Broker","champion":"the Kin-Champion"},
  "votann":{"host":"the Hearth-Keeper","broker":"the Prospect-Broker","champion":"the Grudge-Champion"},
  "harlequins":{"host":"the Troupe-Master","broker":"the Bargain-Player","champion":"the Lead"}
 },
 "weights":{
  "black_legion":{"host":1,"broker":1,"champion":1},"death_guard":{"host":1,"broker":1,"champion":1},
  "world_eaters":{"host":1,"broker":0.5,"champion":1},"thousand_sons":{"host":1,"broker":1,"champion":1},
  "emperors_children":{"host":1,"broker":1,"champion":1},"daemons":{"host":1,"broker":1,"champion":1},
  "astartes":{"host":1,"broker":0.5,"champion":1},"militarum":{"host":1,"broker":1,"champion":1},
  "mechanicus":{"host":1,"broker":1,"champion":0.5},"sororitas":{"host":1,"broker":0.5,"champion":1},
  "custodes":{"host":1,"broker":0.25,"champion":1},"tyranids":{"host":1,"broker":1,"champion":1},
  "orks":{"host":1,"broker":1,"champion":1},"necrons":{"host":1,"broker":0.5,"champion":1},
  "aeldari":{"host":1,"broker":1,"champion":1},"drukhari":{"host":1,"broker":1,"champion":1},
  "tau":{"host":1,"broker":1,"champion":1},"gsc":{"host":1,"broker":1,"champion":0.5},
  "votann":{"host":1,"broker":1,"champion":1},"harlequins":{"host":1,"broker":1,"champion":1}
 }
},
"trust":{
 "rungs":["stranger","known","trusted","sworn"],
 "thresholds":[0,3,8,15],
 "act_base":{"offer":1,"win":2,"noble_loss":1,"cheat_caught":-2,"cheat_clean":1,"job_done":2,"job_dropped":-2,"lawbreak":-4,"presence":1},
 "axis":{"pivot":60,"honor_noble_bonus":1,"honor_cheat_penalty":-3,"cunning_clean_bonus":2,"ferocity_only_win":true,"pragmatism_job_bonus":2,"supremacism_offer_mult":2},
 "overrides":{
  "daemons":{"note":"trust is a priced bargain","offer":2,"lawbreak":-2},
  "necrons":{"note":"protocol above all","offer":3,"lawbreak":-8,"win":1},
  "harlequins":{"note":"a stylish caught-cheat still climbs","cheat_caught":1}
 },
 "tyranid":{"rungs":["prey_shaped","tasted","patterned","assimilated_adjacent"],"recognition":true,"offer":2,"win":2}
},
```

- [ ] **Step 4: Run tests** — `node --test tests/canon-hall.test.js` PASS; full `node --test` green (bump `meta.version`, update any version-pin that fails by exactly the delta).

- [ ] **Step 5: Commit** (`git add -p` the canon hunks + the test file; verify no brain content)

```bash
git add heretics-40k-data-v1.json tests/canon-hall.test.js
git commit -m "canon: rules.hall.regulars + rules.hall.trust — Hall slice B1 (roles/names/weights, 4-rung ladder, judge axes, 3 overrides, Tyranid recognition ladder)"
```

---

### Task 2: HALL core — `regularsAt` (scheduled fixtures)

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Produces: `HALL.regularsAt(ctx, canon) -> [{role, name, present, fac}]` — the location's
  regulars, deterministic per location; `present` = whether `ctx.phaseIndex` is in the role's
  `phase_blocks` AND the role's `weights[fac][role] > 0` (weight 0 = this culture doesn't
  staff that role at all; weight <1 = present but rarer — seeded off `ctx.seedBase^locId^role`).
- Consumes: `rules.hall.regulars` (Task 1); Slice A's `rng`/`hashStr`/`pick`.

- [ ] **Step 1: Failing tests** (append to `tests/hall-core.test.js`)

```js
test('regularsAt: deterministic; returns the 3 roles with present flags by phase', () => {
  const a = HALL.regularsAt(ctx({ phaseIndex: 4 }), D);
  assert.deepEqual(a, HALL.regularsAt(ctx({ phaseIndex: 4 }), D));
  const roles = a.map(r => r.role).sort();
  assert.deepEqual(roles, ['broker', 'champion', 'host']);
  for (const r of a) assert.ok(r.name.length > 3 && ['host','broker','champion'].indexOf(r.role) >= 0);
});

test('regularsAt: host present in the day, broker only later phases', () => {
  const noon = HALL.regularsAt(ctx({ phaseIndex: 2, fac: 'militarum' }), D);
  const night = HALL.regularsAt(ctx({ phaseIndex: 6, fac: 'militarum' }), D);
  assert.equal(noon.filter(r => r.role === 'host')[0].present, true);   // host block includes 2
  assert.equal(noon.filter(r => r.role === 'broker')[0].present, false); // broker block starts at 4
  assert.equal(night.filter(r => r.role === 'broker')[0].present, true);
});

test('regularsAt: a zero-weight role is never present (custodes barely staff a broker)', () => {
  // custodes broker weight is 0.25 (rare) — over many locations, some present some not, never always
  let everPresent = false, everAbsent = false;
  for (let i = 0; i < 40; i++) {
    const r = HALL.regularsAt(ctx({ locId: 'loc' + i, phaseIndex: 5, fac: 'custodes' }), D).filter(x => x.role === 'broker')[0];
    if (r.present) everPresent = true; else everAbsent = true;
  }
  assert.ok(everAbsent, 'a rare broker should sometimes be absent');
});
```

- [ ] **Step 2: Run — FAIL** (`regularsAt is not a function`).

- [ ] **Step 3: Implement** (inside the region, before `return`)

```js
  /* regularsAt: the location's persistent fixtures. Deterministic per (seedBase, locId,
     role). present = phase is in the role's block AND a weight roll passes (weight>=1 always
     present; 0<weight<1 seeded-rare; weight 0 never). */
  function regularsAt(ctx,canon){
    var R=(H(canon).regulars)||{},roles=R.roles||[],out=[];
    var names=(R.names||{})[ctx.fac]||{},wts=(R.weights||{})[ctx.fac]||{},blocks=R.phase_blocks||{};
    for(var i=0;i<roles.length;i++){
      var role=roles[i],w=(wts[role]==null?1:wts[role]);
      var inPhase=(blocks[role]||[]).indexOf(ctx.phaseIndex)>=0;
      var present=false;
      if(w>0&&inPhase){
        if(w>=1)present=true;
        else{var r=rng((ctx.seedBase>>>0)^hashStr('reg:'+ctx.locId+':'+role));present=r()<w;}
      }
      out.push({role:role,name:names[role]||role,present:present,fac:ctx.fac});
    }
    return out;
  }
```

Add `regularsAt:regularsAt` to the return object.

- [ ] **Step 4: Run tests** — PASS; full suite green.

- [ ] **Step 5: Commit** (`git add -p`; index.html + test only)

```bash
git add index.html tests/hall-core.test.js
git commit -m "engine: hall-core regularsAt — deterministic scheduled fixtures (phase blocks + culture role weights)"
```

---

### Task 3: HALL core — trust ladder (`rungOf`) + act judge (`judgeAct`)

**Files:**
- Modify: `index.html` (inside `/*<hall-core>*/`)
- Test: `tests/hall-core.test.js` (extend)

**Interfaces:**
- Produces: `HALL.rungOf(score, ctx, canon) -> {index:0..3, name:string}` — resolves a raw
  trust score to a rung, using the Tyranid rung names when `ctx.fac==='tyranids'`.
- Produces: `HALL.judgeAct(act, ctx, axes, canon) -> number` — the trust delta for an act,
  = `act_base[act]` adjusted by the culture's doctrine `axes` (an object
  `{ferocity,cunning,pragmatism,honor,supremacism}` 0-100, handed in by the glue from
  `AXES`/`behavior_matrix`) and by any authored `overrides[fac]`. Tyranids ignore cheat acts
  (return 0 — "cheating doesn't parse").
- Consumes: `rules.hall.trust` (Task 1).

- [ ] **Step 1: Failing tests** (append)

```js
const AX = { honor: 80, cunning: 20, ferocity: 50, pragmatism: 50, supremacism: 50 };
const AX_CUNNING = { honor: 20, cunning: 85, ferocity: 50, pragmatism: 50, supremacism: 50 };

test('rungOf maps score to the 4 rungs by canon thresholds', () => {
  assert.equal(HALL.rungOf(0, ctx(), D).name, 'stranger');
  assert.equal(HALL.rungOf(3, ctx(), D).name, 'known');
  assert.equal(HALL.rungOf(8, ctx(), D).name, 'trusted');
  assert.equal(HALL.rungOf(99, ctx(), D).name, 'sworn');
  assert.equal(HALL.rungOf(99, ctx(), D).index, 3);
});

test('rungOf uses the Tyranid recognition names for the broodpool', () => {
  assert.equal(HALL.rungOf(0, ctx({ fac: 'tyranids' }), D).name, 'prey_shaped');
  assert.equal(HALL.rungOf(99, ctx({ fac: 'tyranids' }), D).name, 'assimilated_adjacent');
});

test('judgeAct: high honor rewards a noble loss and punishes any cheat', () => {
  const nobleHonor = HALL.judgeAct('noble_loss', ctx(), AX, D);
  const nobleFerocity = HALL.judgeAct('noble_loss', ctx(), { honor: 20, cunning: 20, ferocity: 90, pragmatism: 20, supremacism: 20 }, D);
  assert.ok(nobleHonor > nobleFerocity, 'honor should value a noble loss more than ferocity does');
  assert.ok(HALL.judgeAct('cheat_clean', ctx(), AX, D) < 0, 'high honor: even a clean cheat falls');
});

test('judgeAct: high cunning rewards a clean cheat', () => {
  assert.ok(HALL.judgeAct('cheat_clean', ctx(), AX_CUNNING, D) > 0, 'cunning admires a clean cheat');
  assert.ok(HALL.judgeAct('cheat_caught', ctx(), AX_CUNNING, D) < 0, 'but a botched one still falls');
});

test('judgeAct: authored overrides win — Necrons weigh a remembrance offer heavily, lawbreak brutally', () => {
  assert.ok(HALL.judgeAct('offer', ctx({ fac: 'necrons' }), AX, D) >= 3, 'necron offer override');
  assert.ok(HALL.judgeAct('lawbreak', ctx({ fac: 'necrons' }), AX, D) <= -8, 'necron lawbreak override');
});

test('judgeAct: Tyranids do not parse cheating (returns 0)', () => {
  assert.equal(HALL.judgeAct('cheat_clean', ctx({ fac: 'tyranids' }), AX, D), 0);
  assert.equal(HALL.judgeAct('cheat_caught', ctx({ fac: 'tyranids' }), AX, D), 0);
  assert.ok(HALL.judgeAct('offer', ctx({ fac: 'tyranids' }), AX, D) > 0, 'but biomass offers still register');
});
```

- [ ] **Step 2: Run — FAIL.**

- [ ] **Step 3: Implement**

```js
  function T_(canon){return (H(canon).trust)||{};}
  function rungOf(score,ctx,canon){
    var T=T_(canon),th=T.thresholds||[0,3,8,15];
    var names=(ctx.fac==='tyranids'&&T.tyranid)?T.tyranid.rungs:(T.rungs||['stranger','known','trusted','sworn']);
    var idx=0;for(var i=0;i<th.length;i++){if(score>=th[i])idx=i;}
    return {index:idx,name:names[idx]};
  }
  /* judgeAct: base act weight, reshaped by the culture's doctrine axes, then any authored
     override. Pure — axes handed in by the glue. Tyranids: cheat acts don't parse. */
  function judgeAct(act,ctx,axes,canon){
    var T=T_(canon),ax=T.axis||{},pivot=ax.pivot||60,a=axes||{};
    var ov=(T.overrides||{})[ctx.fac]||{};
    // tyranid recognition ladder: cheating is meaningless
    if(ctx.fac==='tyranids'){
      if(act==='cheat_clean'||act==='cheat_caught')return 0;
      var ty=T.tyranid||{};
      if(act==='offer'&&ty.offer!=null)return ty.offer;
      if(act==='win'&&ty.win!=null)return ty.win;
    }
    // authored override wins outright for the acts it names
    if(ov[act]!=null)return ov[act];
    var base=(T.act_base||{})[act];if(base==null)base=0;
    var v=base;
    // axis reshaping (only above the pivot does an axis assert itself)
    if(act==='noble_loss'&&(a.honor||0)>pivot)v+=(ax.honor_noble_bonus||0);
    if((act==='cheat_clean'||act==='cheat_caught')&&(a.honor||0)>pivot)v+=(ax.honor_cheat_penalty||0);
    if(act==='cheat_clean'&&(a.cunning||0)>pivot)v+=(ax.cunning_clean_bonus||0);
    if(act==='job_done'&&(a.pragmatism||0)>pivot)v+=(ax.pragmatism_job_bonus||0);
    if(act==='offer'&&(a.supremacism||0)>pivot)v=v*(ax.supremacism_offer_mult||1);
    if(ax.ferocity_only_win&&(a.ferocity||0)>pivot&&act!=='win'&&act!=='lawbreak'&&v>0)v=0;
    return v;
  }
```

Add `rungOf:rungOf, judgeAct:judgeAct` to the return object.

- [ ] **Step 4: Run tests** — PASS; full suite green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/hall-core.test.js
git commit -m "engine: hall-core trust ladder (rungOf) + faction judge (judgeAct) — doctrine-axis weights, 3 overrides, Tyranid recognition (cheat inert)"
```

---

### Task 4: Engine glue — render regulars, record trust, gate the rung-② rumor

**Files:**
- Modify: `index.html` (the `hall` renderDoor branch + a trust-record helper near the handlers;
  `S.social.reg` seeding at both sites)

**Interfaces:**
- Consumes: `HALL.regularsAt/rungOf/judgeAct` (Tasks 2-3), Slice A's `hallCtxOf`,
  `hallCommune`, `HALL.rumorFor`; the shipped doctrine axes — resolve the culture's axes via
  the existing `AXES`/`ai.behavior_matrix` reader (grep `behavior_matrix`/`AXES` to confirm
  the accessor; if a per-faction base-axis read exists use it, else read
  `D.ai.behavior_matrix[fac]` and map each axis's `base` to a 0-100 number).
- Produces: `S.social.reg[locId+'/'+role] = {score:int, acts:{}, lastSeen:int}`; a
  `hallTrustRecord(hc, role, act)` helper the OFFER handler (and, later, B2 contests) calls to
  apply `judgeAct` and advance the score.

- [ ] **Step 1: Seed `S.social.reg` at both sites**

Defaults literal (currently `social:{pat:{}}`) → `social:{pat:{},reg:{}}`.
`init()` backfill: after the Slice A `if(!S.social)S.social={pat:{}};` line, ensure the sub-key:
`if(!S.social.reg)S.social.reg={};` (and keep `if(!S.social.pat)S.social.pat={};` defensively).

- [ ] **Step 2: Render present regulars as pinned rows above the crowd**

In the `hall` branch, after computing `hc`/`ev`, before the patron rows, add:

```js
   var regs=HALL.regularsAt(hc.ctx,D).filter(function(r){return r.present;});
   if(regs.length)hh+=regs.map(function(rg){
     var key=hc.ctx.locId+'/'+rg.role,rec=(S.social.reg||{})[key]||{score:0};
     var rung=HALL.rungOf(rec.score||0,hc.ctx,D);
     return '<div class="lrow" style="border-left:2px solid var(--acc)">★ '+esc(rg.name)
       +' <span style="color:var(--dim)">— '+esc(rung.name)+'</span>'
       +' <button class="btn gh sm" data-hallcom="reg:'+esc(rg.role)+'">'+esc(cul.commune||'Talk')+'</button></div>';
   }).join('');
```

Wire the `data-hallcom="reg:<role>"` buttons to a regular-commune path that (a) records a
PRESENCE act via `hallTrustRecord`, (b) calls `HALL.rumorFor` but at rung ②+ passes a flag for
a second rumor (the "two-source" HOST unlock — render two lines when `rung.index>=1` and the
regular is the host). Keep it minimal: the deeper rung-③/④ unlocks (sanctuary WORK grant,
fence, introductions, training, title fight) are Slice B2/C — this slice ships the rung display
+ presence accrual + the host two-rumor unlock only. Gate-comment the rest as TODO(B2).

- [ ] **Step 3: The trust-record helper**

```js
function hallTrustRecord(hc,role,act){
  var key=hc.ctx.locId+'/'+role;
  var rec=S.social.reg[key]||(S.social.reg[key]={score:0,acts:{},lastSeen:0});
  var axes=hallAxesOf(hc.ctx.fac);           // resolve doctrine axes for the ruling culture
  rec.score=(rec.score||0)+HALL.judgeAct(act,hc.ctx,axes,D);
  if(rec.score<0)rec.score=0;                // floor: trust never negative (a fresh stranger)
  rec.acts[act]=(rec.acts[act]||0)+1;rec.lastSeen=hc.ctx.day;
  persist();
  return HALL.rungOf(rec.score,hc.ctx,D);
}
```

Implement `hallAxesOf(fac)` reading the shipped `D.ai.behavior_matrix[fac]` (map each axis's
`base` to a plain number) — grep the existing `AXES`/`doctrineOf` region first; if a helper
already turns a faction id into axis numbers, reuse it instead of re-reading canon.

Have Slice A's `hallOffer` also call `hallTrustRecord(hc,'host','offer')` (or the nearest
present regular) so making an offering advances trust with the room's keeper — the first live
trust-accrual path. PRESENCE accrues once per day per regular (guard on `rec.lastSeen!==day`).

- [ ] **Step 4: Browser E2E** (only once the controller says the hot lane is free)

Serve, `window._noPersist=true`, found a commander, open a Hall in an evening/night phase so
regulars are present: confirm ★ regular rows render with a rung label; commune with the host
shows a rumor; make an offering and confirm the host's rung advances after enough offers;
reload same-day shows the same regulars; 0 console errors across screens. Record it.

- [ ] **Step 5: Commit** (`git add -p` index.html only)

```bash
git add index.html
git commit -m "engine: Hall regulars render + trust accrual — scheduled ★ rows with rung labels, hallTrustRecord (judgeAct-driven), host two-rumor unlock at KNOWN+"
```

---

### Task 5: GLOSS, docs, backlog, sweep

**Files:** `index.html` (GLOSS), `CLAUDE.md`, `BACKLOG.md`

- [ ] **Step 1:** GLOSS entries: `'Regular'` (the Hall's persistent fixtures, present only in
  their hours), `'Trust'` (the 4-rung per-person ladder; how you climb depends on the
  culture). Wire `.tipable` on the regular rows + rung label (the Slice A tooltip pattern).
- [ ] **Step 2:** CLAUDE.md: one bullet — Hall slice B1 (canon vN: rules.hall.regulars/trust;
  hall-core regularsAt/rungOf/judgeAct; S.social.reg; scheduled regulars + trust accrual;
  doctrine-axis judge + overrides + Tyranid recognition; CONTEST/hall-law = B2). BACKLOG:
  update T-SOC-1 row noting B1 shipped, B2 (contests + hall law) + C (powers/jobs/interaction
  events) still open.
- [ ] **Step 3:** Full `node --test` (or filtered if peer mid-flight) green; light browser
  re-check that tooltips render.
- [ ] **Step 4:** Commit (`git add -p`; index.html + CLAUDE.md + BACKLOG.md, own hunks only).

---

## Self-Review

1. **Spec coverage:** §6 regulars (roles/names/weights/schedule) → T1+T2; 4-rung ladder →
   T1+T3; act ledger + doctrine-axis judge + 3 overrides + Tyranid recognition → T1+T3;
   regular render + trust accrual + host two-rumor unlock → T4. Deferred to B2 (flagged in
   T4): rung-③/④ deep unlocks (sanctuary WORK, fence, introductions, training, title fight)
   and all of CONTEST/hall-law. Deferred to C: powers/jobs/interaction events.
2. **Placeholder scan:** none — the only TODO(B2) markers are deliberate scope fences named in
   the task text with their target slice.
3. **Type consistency:** `ctx` reused from Slice A (adds nothing); `regularsAt` row
   `{role,name,present,fac}`; `rungOf` `{index,name}`; `judgeAct` → number; `S.social.reg`
   entry `{score,acts,lastSeen}` — consistent across T2/T3/T4.
