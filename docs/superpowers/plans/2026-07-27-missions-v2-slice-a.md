# Missions V2 — Slice A (Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MISSION threads winnable and paid: objective tracker in the THREAD core, a deterministic per-planet mission generator on the world tick, boards + accept flow in the UI, payout + world effects at conclude — plus the T-THR-5 reload fix this all depends on.

**Architecture:** Tracker lives INSIDE the existing `thread-core` region (objectives are thread state; `apply` already owns every combat mutation — no cross-region calls). A NEW pure `mission-core` region owns generation: seeded PRNG, board refill/expiry, face attribution, payout math. Glue calls `MISSION.catchUpBoards` right after `WORLD.catchUp` and pays out in `concludeThread`. Spec: `docs/superpowers/specs/2026-07-26-missions-v2-design.md` (§1–§3, §5 Slice A). One deviation from spec §1: `track`/`evaluate` live in thread-core, not mission-core — `apply` has no event bus and adding one would be plumbing for its own sake.

**Tech Stack:** Vanilla JS single-file engine (`index.html`), canon JSON, Node built-in test runner (`node --test tests/*.test.js`, zero deps).

## Global Constraints

- Always "model", never "chassis" — all code, copy, data.
- Canon changes → `heretics-40k-data-v1.json`, bump `meta.version` to **1.21** (filename stays `-v1.json`). Engine changes → `index.html` only.
- Pure regions read NO globals — canon/state arrive as arguments. No `Date.now()` / `Math.random()` inside pure regions (world replayability).
- `git add <explicit paths>` only — NEVER `-A` (multi-agent shared folder).
- `node --test tests/*.test.js` green (223 baseline) at every pause. The bare `tests/` dir form does NOT work — use the glob.
- 🔥 `index.html` is the HOT lane — claim `T-THR-5` + `T-MSN-1A` rows in `BACKLOG.md` (status/owner/timestamp, `git add BACKLOG.md`, commit `backlog: claim T-THR-5 + T-MSN-1A`) BEFORE Task 1, per CLAUDE.md Multi-Agent Coordination. If T-CMB-1 landed on `THREAD.apply` since 7b31908, re-read `apply` before Tasks 3 — its condition branches add effect kinds but do not reshape the damage/slay/kill code this plan hooks.
- Before EVERY commit: re-check `git log` for parallel-session commits touching your files; rebase-style pull first if so.

## Cross-program alignment (2026-07-27 design push)

Five sibling designs locked on 2026-07-27 (economy, background agency, death/succession, diplomacy, social contract). Contracts this plan honors:

- **Seeded-roll discipline (agency spec):** all tick randomness uses STATELESS per-event seeds (`seed = day ⊕ entity-id-hash ⊕ world-base`), never an advancing stored seed — results must be identical however catch-up days are chunked. Task 5 implements this.
- **Payout stays currency:** the economy's sink family (tithes, repairs, door fees) needs currency faucets; missions are one. `prod_mult` "keeps its other uses" (economy spec) — the payout formula's use is one of them. Typed-resource mission variants (deliver Food×N) are a Slice B option once T-ECN-1 ships.
- **T-TIME-1 (clock unification, locked):** `lastTick` becomes a single day-index. `mission-core` takes `day` as an argument, so when T-TIME-1 lands only the glue's `missionDay` bookkeeping folds into the unified index — no core change.
- **T-ECN-1 (economy E1, open):** also adds WORLD-tick glue + `S` seeding. 🔥 lane serialization decides order; whichever lands second re-reads `init()` (~2710) before editing.
- **Strategium (agency N3):** will list mission objective clocks in Active Clocks — Slice B's round-caps feed it; nothing needed in Slice A.

---

### Task 1: T-THR-5 — persisted thread state survives hydrate

**Files:**
- Modify: `index.html:517-523` (`THREAD.create` in thread-core)
- Test: `tests/thread-hydrate.test.js` (new)

**Interfaces:**
- Consumes: `THREAD.create(seed, canon)`, `THREAD.initState(thread, canon)`, `THREAD.apply` (all existing).
- Produces: `THREAD.create` now PREFERS an existing `seed.state` over re-seeding. Every later task relies on `t.state.objective` surviving reload through this guarantee.

- [ ] **Step 1: Write the failing test**

```js
// tests/thread-hydrate.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function mkCombatSeed() {
  return {
    id: 't1', type: 'SKIRMISH', n: 'test fight', turn: 'you',
    seedState: {
      pools: { Mine: 10, Foe: 8 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null, x: 1, y: 1 },
        e0: { w: [3, 3], conds: [], party: 'Foe',  armour: null, x: 5, y: 5,
              gen: { id: 'e0', n: 'Cultist 1', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('T-THR-5: create() keeps a persisted mutated state instead of re-seeding', () => {
  const t = THREAD.create(mkCombatSeed(), canon);
  // mutate mid-battle: e0 takes 2 damage
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 2, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.combatants.e0.w[0], 1);

  // simulate SAVE.snapshot -> JSON -> hydrate: state rides the blob
  const blob = JSON.parse(JSON.stringify(t));
  const t2 = THREAD.create(blob, canon);
  assert.strictEqual(t2.state.combatants.e0.w[0], 1,
    'persisted wounds must survive create()');
  assert.strictEqual(t2.state.pools.Mine, 9, 'spent AP pool must survive create()');
});

test('T-THR-5: create() still seeds fresh state when none persisted', () => {
  const t = THREAD.create(mkCombatSeed(), canon);
  assert.strictEqual(t.state.combatants.e0.w[0], 3);
  assert.ok(t.state.pools.Foe === 8);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/thread-hydrate.test.js`
Expected: FAIL — first test asserts `1`, gets `3` (state was re-seeded from `seedState`).

- [ ] **Step 3: Minimal implementation**

In `index.html` `THREAD.create` (line ~517), the current last line of the function is:

```js
    t.state=initState(t,canon);
```

Replace with:

```js
    if(!t.state)t.state=initState(t,canon);   // T-THR-5: persisted live state wins over re-seeding
```

(`create` shallow-copies all seed keys first, so a hydrated blob's `t.state` is already on `t`. `SAVE.relink` — called right after the `hydrate()` map at index.html:2707 — re-attaches the stripped `c.model`/`c.armour` refs; no change needed there.)

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js`
Expected: 225 pass (223 baseline + 2 new), 0 fail. If any existing test constructed a thread by passing a stale `.state` on the seed and relied on re-seeding, fix THAT test's seed (it was depending on the bug).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/thread-hydrate.test.js
git commit -m "fix: T-THR-5 - persisted thread state survives hydrate (create prefers live state over seedState)"
```

---

### Task 2: Canon v1.21 — `rules.missions` + 3 pilot mission rows

**Files:**
- Modify: `heretics-40k-data-v1.json` (add `rules.missions`, add top-level `missions`, bump `meta.version` → `"1.21"`, `meta.updated` → `"2026-07-27"`)
- Modify: `tests/canon.test.js` (version pin `'1.20'` → `'1.21'`; check `tests/canon-spoils.test.js` for a second pin and bump if present)
- Test: `tests/canon-missions.test.js` (new)

**Interfaces:**
- Produces: `D.rules.missions` (all tunables) and `D.missions.universal` (pilot rows) with the exact shapes below — Tasks 3–8 read these verbatim.

- [ ] **Step 1: Write the failing test**

```js
// tests/canon-missions.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('rules.missions tuning block is complete', () => {
  const M = canon.rules.missions;
  assert.ok(M, 'rules.missions exists');
  assert.strictEqual(M.board_min, 4);
  assert.strictEqual(M.board_max, 6);
  assert.strictEqual(M.accept_cap, 3);
  assert.strictEqual(M.expiry_days, 5);
  assert.deepStrictEqual(M.family_bases, { KILL: 10, HOLD: 12, LOGISTICS: 8, RITUAL: 10 });
  assert.deepStrictEqual(M.family_norms, { KILL: 5, HOLD: 5, LOGISTICS: 5, RITUAL: 5 });
  assert.deepStrictEqual(M.size_clamp, [0.5, 4]);
  assert.strictEqual(M.modifier_mult, 1.5);
  assert.strictEqual(M.signature_premium, 1.5);
  assert.deepStrictEqual(M.face_doors, { KILL: 'muster', HOLD: 'throne', LOGISTICS: 'shop', RITUAL: 'altar' });
});

test('pilot mission rows: purge, item_request, rebuild', () => {
  const U = canon.missions.universal;
  assert.ok(Array.isArray(U) && U.length === 3);
  const byId = {};
  U.forEach(m => { byId[m.id] = m; });
  assert.deepStrictEqual(Object.keys(byId).sort(), ['item_request', 'purge', 'rebuild']);
  U.forEach(m => {
    ['id', 'n', 'family', 'kind', 'target_roll', 'params', 'world_effect', 'flavor'].forEach(k =>
      assert.ok(k in m, m.id + ' has ' + k));
    assert.ok(Array.isArray(m.target_roll) && m.target_roll.length === 2);
  });
  assert.strictEqual(byId.purge.kind, 'count_kill');
  assert.strictEqual(byId.item_request.kind, 'collect_item');
  assert.strictEqual(byId.rebuild.kind, 'restore');
  assert.strictEqual(byId.rebuild.prefer_condition, 'Ruined');
});

test('canon is v1.21', () => {
  assert.strictEqual(canon.meta.version, '1.21');
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/canon-missions.test.js` → FAIL (`rules.missions` undefined).

- [ ] **Step 3: Edit canon**

Into `rules` (sibling of `rules.spoils`):

```json
"missions": {
  "board_min": 4, "board_max": 6, "accept_cap": 3, "expiry_days": 5,
  "family_bases": { "KILL": 10, "HOLD": 12, "LOGISTICS": 8, "RITUAL": 10 },
  "family_norms": { "KILL": 5, "HOLD": 5, "LOGISTICS": 5, "RITUAL": 5 },
  "size_clamp": [0.5, 4],
  "modifier_mult": 1.5,
  "signature_premium": 1.5,
  "face_doors": { "KILL": "muster", "HOLD": "throne", "LOGISTICS": "shop", "RITUAL": "altar" }
}
```

New top-level key `missions` (sibling of `weapons`/`items`):

```json
"missions": {
  "universal": [
    { "id": "purge", "n": "Purge", "family": "KILL", "kind": "count_kill",
      "target_roll": [3, 6], "params": { "filter": "hostile" },
      "world_effect": { "taint": -4 },
      "flavor": "Hostile elements fester here. Root them out — every kill is a knife drawn from this ground." },
    { "id": "item_request", "n": "Item Request", "family": "LOGISTICS", "kind": "collect_item",
      "target_roll": [2, 4], "params": {},
      "world_effect": { "prosperity": 2 },
      "flavor": "A local quartermaster posts a want-list. Deliver the goods, take the coin." },
    { "id": "rebuild", "n": "Rebuild", "family": "HOLD", "kind": "restore",
      "target_roll": [3, 5], "params": { "min_words": 40 }, "prefer_condition": "Ruined",
      "world_effect": { "prosperity": 4 },
      "flavor": "This place is rubble and memory. Direct the work-gangs; write it back into being." }
  ],
  "signatures": {}
}
```

Bump `meta.version` to `"1.21"`, `meta.updated` to `"2026-07-27"`. Fix the pin in `tests/canon.test.js` (and `tests/canon-spoils.test.js` if it also pins).

- [ ] **Step 4: Run** `node --test tests/*.test.js` — all green (canon pin included).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-missions.test.js tests/canon.test.js
git commit -m "canon: v1.21 - rules.missions tuning block + 3 pilot mission rows (purge, item_request, rebuild)"
```

---

### Task 3: Objective tracker in thread-core (init + apply + evaluate)

**Files:**
- Modify: `index.html` thread-core — `initState` (~503), `apply` (~628: damage-kill site, slay site, new `deliver`/`work` effect kinds), exports (~866)
- Test: `tests/mission-objective.test.js` (new)

**Interfaces:**
- Consumes: `seedState.objective` placed by the accept flow (Task 6): `{ kind, target, progress, params, done }`.
- Produces: `state.objective` (same shape, live); new apply effect kinds `{kind:'deliver', qty}` and `{kind:'work', words}`; exported `THREAD.evalObjective(state) -> {won:boolean, progress, target} | null`. Task 4's `outcome` branch and Task 8's payout consume `evalObjective`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/mission-objective.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function purgeSeed(target) {
  return {
    id: 'mp', type: 'MISSION', n: 'Purge test', turn: 'you',
    seedState: {
      objective: { kind: 'count_kill', target: target, progress: 0,
                   params: { filter: 'hostile' }, done: false },
      pools: { Mine: 20, Foe: 10 },
      combatants: {
        m1: { w: [4, 4], conds: [], party: 'Mine', armour: null },
        e0: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e0', n: 'Cultist 1', cls: 'Core', pc: 10 } },
        e1: { w: [1, 1], conds: [], party: 'Foe', armour: null,
              gen: { id: 'e1', n: 'Cultist 2', cls: 'Core', pc: 10 } }
      },
      joined: true
    }
  };
}

test('count_kill: hostile kills increment progress; own deaths do not', () => {
  const t = THREAD.create(purgeSeed(2), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
  // own model dies: no progress
  THREAD.apply(t, t.state,
    [{ actor: 'e1', cost: 1, effect: { kind: 'damage', to: 'm1', amount: 9, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
  // second hostile down -> target met
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'slay', to: 'e1' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.deepStrictEqual(THREAD.evalObjective(t.state), { won: true, progress: 2, target: 2 });
});

test('count_kill: a kill never double-counts (damage on an already-dead model)', () => {
  const t = THREAD.create(purgeSeed(3), canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  THREAD.apply(t, t.state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical' } }],
    canon);
  assert.strictEqual(t.state.objective.progress, 1);
});

test('collect_item: deliver effect adds qty', () => {
  const t = THREAD.create({
    id: 'mi', type: 'MISSION', n: 'Item test', turn: 'you',
    seedState: { objective: { kind: 'collect_item', target: 3, progress: 0, params: { item_n: 'Combat Blade' }, done: false } }
  }, canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'deliver', qty: 2 } }], canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.strictEqual(THREAD.evalObjective(t.state).won, false);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'deliver', qty: 1 } }], canon);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

test('restore: work posts count only at/above min_words', () => {
  const t = THREAD.create({
    id: 'mr', type: 'MISSION', n: 'Rebuild test', turn: 'you',
    seedState: { objective: { kind: 'restore', target: 2, progress: 0, params: { min_words: 40 }, done: false } }
  }, canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 39 } }], canon);
  assert.strictEqual(t.state.objective.progress, 0);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 40 } }], canon);
  THREAD.apply(t, t.state, [{ actor: 'cmdr', effect: { kind: 'work', words: 200 } }], canon);
  assert.strictEqual(t.state.objective.progress, 2);
  assert.strictEqual(THREAD.evalObjective(t.state).won, true);
});

test('evalObjective is null-safe on non-mission state', () => {
  const t = THREAD.create({ id: 'x', type: 'SKIRMISH', n: 'x', seedState: {} }, canon);
  assert.strictEqual(THREAD.evalObjective(t.state), null);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test tests/mission-objective.test.js` → FAIL (`objective` undefined / `evalObjective` not a function).

- [ ] **Step 3: Implement in thread-core**

3a. `initState` (~503): add `objective` to the seeded state object:

```js
        objective:seed.objective?{kind:seed.objective.kind,target:seed.objective.target,
          progress:seed.objective.progress||0,params:seed.objective.params||{},
          done:!!seed.objective.done}:null,
```

3b. New helpers just above `apply` (inside thread-core):

```js
  /* ── mission objective tracker (Missions V2 slice A) ── */
  function trackKill(state,victim){
    var ob=state.objective;
    if(!ob||ob.done||ob.kind!=='count_kill')return;
    if(!victim||!victim.gen)return;              // 'hostile' filter: generated foes only
    ob.progress+=1;if(ob.progress>=ob.target)ob.done=true;
  }
  function evalObjective(state){
    var ob=state&&state.objective;if(!ob)return null;
    return {won:ob.progress>=ob.target,progress:ob.progress,target:ob.target};
  }
```

3c. In `apply`'s damage branch, the kill site currently reads `if(c.w[0]<=0&&!c.dead){c.dead=true;...}` — add `trackKill(state,c);` as the LAST statement inside that `if` block. In the `slay` branch (`else if(e.kind==='slay'&&c){...}`), guard double-count and track: change the branch head to `else if(e.kind==='slay'&&c){var _wasDead=c.dead;` and append `if(!_wasDead)trackKill(state,c);` at its end.

3d. New effect branches, after the `loot` branch inside `apply`:

```js
      else if(e.kind==='deliver'){var _ob=state.objective;
        if(_ob&&!_ob.done&&_ob.kind==='collect_item'){_ob.progress+=(e.qty||0);
          if(_ob.progress>=_ob.target)_ob.done=true;}}
      else if(e.kind==='work'){var _ob2=state.objective;
        if(_ob2&&!_ob2.done&&_ob2.kind==='restore'){
          var _mw=(_ob2.params&&_ob2.params.min_words)||0;
          if((e.words||0)>=_mw){_ob2.progress+=1;if(_ob2.progress>=_ob2.target)_ob2.done=true;}}}
```

3e. Export: add `evalObjective:evalObjective` to the THREAD export object (~866).

- [ ] **Step 4: Run** `node --test tests/*.test.js` — all green.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/mission-objective.test.js
git commit -m "engine: mission objective tracker in thread-core - count_kill/collect_item/restore, deliver+work effects, evalObjective"
```

---

### Task 4: MISSION becomes winnable — catalog + outcome branches

**Files:**
- Modify: `index.html` thread-core — `catalog` (~546), `validate` (~558 region), `outcome` (~703)
- Test: `tests/mission-outcome.test.js` (new)

**Interfaces:**
- Consumes: `state.objective` (Task 3), `combatCatalog` (existing internal).
- Produces: `catalog` returns combat actions for MISSION threads whose objective kind is `count_kill` and that have combatants; `outcome` returns `{kind:'mission_won'|'mission_lost', victor, defeated}` — `victor` is the PLAYER party name on a win (so `concludeThread`'s `myForceNames().indexOf(oc.victor)` works), the hostile party on a loss. Task 8 consumes these kinds.

- [ ] **Step 1: Write the failing tests**

```js
// tests/mission-outcome.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

function seed(objective, combatants, pools) {
  return { id: 'm', type: 'MISSION', n: 'm', turn: 'you',
           forces: ['Mine'],
           seedState: { objective: objective, combatants: combatants || {}, pools: pools || {}, joined: true } };
}
const HOSTILE = () => ({ w: [1, 1], conds: [], party: 'Foe', armour: null,
                         gen: { id: 'e0', n: 'Cultist', cls: 'Core', pc: 10 } });
const MINE = () => ({ w: [4, 4], conds: [], party: 'Mine', armour: null });

test('combat mission exposes the combat catalog', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0, params: {}, done: false },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const acts = THREAD.catalog(t, t.state, ['m1'], canon);
  assert.ok(acts.length > 0, 'MISSION with combatants must not return []');
});

test('non-combat mission catalog stays empty (deliver/work are glue buttons)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 2, progress: 0, params: { min_words: 40 }, done: false }), canon);
  assert.deepStrictEqual(THREAD.catalog(t, t.state, [], canon), []);
});

test('outcome: objective done -> mission_won with player party as victor', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1, params: {}, done: true },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

test('outcome: player side annihilated in a combat mission -> mission_lost', () => {
  const dead = MINE(); dead.w = [0, 4]; dead.dead = true;
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 3, progress: 0, params: {}, done: false },
         { m1: dead, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_lost', victor: 'Foe', defeated: ['Mine'] });
});

test('outcome: unfinished non-combat mission -> null (runs on)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 3, progress: 1, params: {}, done: false }), canon);
  assert.strictEqual(THREAD.outcome(t, t.state), null);
});
```

- [ ] **Step 2: Run to verify failure** — catalog returns `[]`, outcome returns `null` for MISSION.

- [ ] **Step 3: Implement**

3a. `catalog` — insert BEFORE the final `return [];`:

```js
    if(thread.type==='MISSION'&&state&&state.objective&&state.objective.kind==='count_kill'
       &&state.combatants&&Object.keys(state.combatants).length)
      return combatCatalog(state,party,canon);
```

3b. `validate` — MISSION combat blocks must pass the same gates as skirmish blocks. Find the early-exit line `if(thread.type==='TRAVEL'||thread.type==='DIPLOMACY')return {ok:true,reason:''};` and the combat branch condition below it (`thread.type==='SKIRMISH'||thread.type==='INVASION'`). Extend the combat condition:

```js
    var _combatMission=thread.type==='MISSION'&&state.objective&&state.objective.kind==='count_kill';
    if(thread.type==='SKIRMISH'||thread.type==='INVASION'||_combatMission){
```

(`deliver`/`work` effects arrive from glue-staged blocks with no cost gates; they fall through to the permissive default — fine for slice A.)

3c. `outcome` — insert AFTER the DIPLOMACY branch, BEFORE `if(thread.type!=='SKIRMISH'&&...)return null;`:

```js
    if(thread.type==='MISSION'){
      var ob=state.objective;if(!ob)return null;
      var myParty=(thread.forces&&thread.forces[0])||null;
      var parties={};Object.keys(state.combatants||{}).forEach(function(id){
        var c=state.combatants[id];parties[c.party]=parties[c.party]||{alive:0};
        if(!c.dead&&!c.captured)parties[c.party].alive++;});
      if(ob.progress>=ob.target){
        var others=Object.keys(parties).filter(function(p){return p!==myParty;});
        return {kind:'mission_won',victor:myParty,defeated:others};
      }
      if(myParty&&parties[myParty]&&parties[myParty].alive===0){
        var foes=Object.keys(parties).filter(function(p){return p!==myParty;});
        return {kind:'mission_lost',victor:foes[0]||null,defeated:[myParty]};
      }
      return null;
    }
```

- [ ] **Step 4: Run** `node --test tests/*.test.js` — all green. Pay attention to existing `thread-core.test.js` outcome tests — the new branch sits before the combat guard and must not change SKIRMISH/INVASION/DIPLOMACY results.

- [ ] **Step 5: Commit**

```bash
git add index.html tests/mission-outcome.test.js
git commit -m "engine: MISSION threads winnable - combat catalog for count_kill, mission_won/mission_lost outcomes"
```

---

### Task 5: mission-core region — PRNG, roll, refill, expiry, payout

**Files:**
- Modify: `index.html` — new pure region `/*<mission-core>*/ ... /*</mission-core>*/` directly after the world-core region (after line ~1146)
- Create: `tests/_load-mission.js`
- Test: `tests/mission-core.test.js` (new)

**Interfaces:**
- Consumes: canon `rules.missions`, `missions.universal`, `galaxy.planet_types[i].{prod_mult,mission_value}`.
- Produces (exported as `MISSION`):
  - `rng(seedInt) -> fn()->float[0,1)` — mulberry32, deterministic.
  - `hashStr(s) -> int` — small string hash for entity-id seeds.
  - `payoutOf(inst, prodMult, canon) -> integer`
  - `rollMission(row, ctx, r, day) -> instance` — `instance = {iid, mid, n, family, kind, target, params, face:{kind,label}, payout, pl, lid, day, accepted:false}`
  - `refillBoard(board, ctx, canon, r, day) -> board` (mutates+returns; respects board_min/board_max, expiry)
  - `catchUpBoards(state, canon, ticks, planetIdsOf, ctxOf) -> {added, expired}` — advances `state.world.missionDay`; per planet-day rolls use a STATELESS seed `missionSeedBase ⊕ day ⊕ hashStr(planetId)` (the agency spec's locked seeded-roll discipline — results identical however catch-up is chunked); fills `state.world.missions[planetId]`. `ctxOf(planetId) -> ctx` is injected by glue.
  - `ctx = {pl:{id, type, prod_mult}, locs:[{id, name, cond, doors:[doorKinds], npc}]}` — glue builds it (Task 6).

- [ ] **Step 1: Write the failing tests**

```js
// tests/_load-mission.js  (copy the _load.js template, swap the region + return)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function loadMission() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<mission-core>\*\/([\s\S]*?)\/\*<\/mission-core>\*\//);
  if (!m) throw new Error('mission-core region not found in index.html');
  const MISSION = vm.runInThisContext('(function(){' + m[1] + '\n;return MISSION;})()');
  if (!MISSION) throw new Error('mission-core did not define MISSION');
  return MISSION;
}
module.exports = { loadMission };
```

```js
// tests/mission-core.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadMission } = require('./_load-mission');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const MISSION = loadMission();

const CTX = () => ({
  pl: { id: 'testp', type: 'Forge World', prod_mult: 2.0 },
  locs: [
    { id: 'l1', name: 'The Foundry', cond: null,     doors: ['shop', 'muster'], npc: null },
    { id: 'l2', name: 'Shattered Row', cond: 'Ruined', doors: [],               npc: 'Magos Vex' }
  ]
});
function mkState() {
  return { world: { missions: {}, missionSeedBase: 12345, missionDay: 0 } };
}

test('rng is deterministic', () => {
  const a = MISSION.rng(42), b = MISSION.rng(42);
  for (let i = 0; i < 5; i++) assert.strictEqual(a(), b());
});

test('payoutOf: family_base x size x prod_mult, size clamped', () => {
  // KILL base 10, norm 5. target 5 -> size 1 -> 10 * 1 * 2.0 = 20
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 5 }, 2.0, canon), 20);
  // target 1 -> raw size 0.2 -> clamped to 0.5 -> 10 * 0.5 * 1 = 5
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 1 }, 1.0, canon), 5);
  // huge target clamps at 4 -> 10 * 4 * 1 = 40
  assert.strictEqual(MISSION.payoutOf(
    { family: 'KILL', target: 99 }, 1.0, canon), 40);
});

test('refillBoard fills to within [board_min, board_max] and faces every mission', () => {
  const r = MISSION.rng(7);
  const board = MISSION.refillBoard([], CTX(), canon, r, 0);
  assert.ok(board.length >= 4 && board.length <= 6, 'got ' + board.length);
  board.forEach(m => {
    assert.ok(['door', 'npc', 'notice'].indexOf(m.face.kind) >= 0);
    assert.ok(m.payout > 0);
    assert.ok(m.target >= 2, 'targets come from target_roll');
    assert.strictEqual(m.accepted, false);
    assert.strictEqual(m.pl, 'testp');
  });
});

test('condition preference: a Ruined location draws rebuild', () => {
  // over many rolls, rebuild must appear and sit on the Ruined location
  const r = MISSION.rng(3);
  let sawRebuildOnRuins = false;
  for (let day = 0; day < 10 && !sawRebuildOnRuins; day++) {
    const board = MISSION.refillBoard([], CTX(), canon, r, day);
    sawRebuildOnRuins = board.some(m => m.mid === 'rebuild' && m.lid === 'l2');
  }
  assert.ok(sawRebuildOnRuins);
});

test('expiry replaces stale unaccepted missions but never accepted ones', () => {
  const r = MISSION.rng(9);
  const board = MISSION.refillBoard([], CTX(), canon, r, 0);
  board[0].accepted = true;
  const keepIid = board[0].iid;
  const later = MISSION.refillBoard(board, CTX(), canon, r, 99); // way past expiry_days
  assert.ok(later.some(m => m.iid === keepIid), 'accepted mission survives expiry');
  assert.ok(later.filter(m => !m.accepted).every(m => m.day === 99), 'unaccepted stale ones replaced');
});

test('catchUpBoards is deterministic AND chunk-independent (seeded-roll discipline)', () => {
  const s1 = mkState(), s2 = mkState();
  const ctxOf = () => CTX();
  // 3 days in one call vs 1 + 2 across two calls: identical boards
  MISSION.catchUpBoards(s1, canon, 3, () => ['testp'], ctxOf);
  MISSION.catchUpBoards(s2, canon, 1, () => ['testp'], ctxOf);
  MISSION.catchUpBoards(s2, canon, 2, () => ['testp'], ctxOf);
  assert.deepStrictEqual(s1.world.missions, s2.world.missions);
  assert.strictEqual(s1.world.missionDay, 3);
  assert.strictEqual(s1.world.missionSeedBase, 12345, 'base seed never mutates');
  // zero ticks: no-op
  const before = JSON.stringify(s1.world.missions);
  MISSION.catchUpBoards(s1, canon, 0, () => ['testp'], ctxOf);
  assert.strictEqual(JSON.stringify(s1.world.missions), before);
});
```

(Note `catchUpBoards(state, canon, ticks, planetIdsOf, ctxOf)` — planet enumeration injected too, keeping the region canon-galaxy-agnostic and the test tiny.)

- [ ] **Step 2: Run to verify failure** — region not found.

- [ ] **Step 3: Implement the region** (after `/*</world-core>*/`):

```js
/*<mission-core>*/
/* Missions V2 slice A — pure, DOM-free mission generation + payout.
   Canon/state arrive as arguments. NO Date.now()/Math.random(): determinism
   comes from mulberry32 seeded off persisted state.world.missionSeed. */
var MISSION=(function(){
  function rng(seed){var a=seed>>>0;return function(){
    a|=0;a=(a+0x6D2B79F5)|0;var t=Math.imul(a^(a>>>15),1|a);
    t=(t+Math.imul(t^(t>>>7),61|t))^t;return ((t^(t>>>14))>>>0)/4294967296;};}
  function hashStr(s){var h=2166136261;for(var i=0;i<s.length;i++){
    h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function R(canon){return (canon.rules&&canon.rules.missions)||{};}
  function payoutOf(inst,prodMult,canon){
    var M=R(canon);var base=(M.family_bases||{})[inst.family]||10;
    var norm=(M.family_norms||{})[inst.family]||5;
    var clamp=M.size_clamp||[0.5,4];
    var size=Math.max(clamp[0],Math.min(clamp[1],inst.target/norm));
    return Math.round(base*size*(prodMult||1));
  }
  function faceOf(row,loc,canon){
    var M=R(canon);var want=(M.face_doors||{})[row.family];
    if(want&&loc.doors&&loc.doors.indexOf(want)>=0)
      return {kind:'door',label:want+' at '+loc.name};
    if(loc.npc)return {kind:'npc',label:loc.npc};
    return {kind:'notice',label:'Anonymous notice — '+loc.name};
  }
  function rollMission(row,ctx,r,day){
    // location: honor prefer_condition first, else uniform
    var locs=ctx.locs||[];var loc=null;
    if(row.prefer_condition){
      var pref=locs.filter(function(l){return l.cond===row.prefer_condition;});
      if(pref.length)loc=pref[Math.floor(r()*pref.length)];
    }
    if(!loc)loc=locs[Math.floor(r()*locs.length)]||{id:null,name:'?',doors:[],npc:null};
    var tr=row.target_roll||[3,5];
    var target=tr[0]+Math.floor(r()*(tr[1]-tr[0]+1));
    var inst={iid:ctx.pl.id+'-'+row.id+'-'+day+'-'+Math.floor(r()*1e6),
      mid:row.id,n:row.n,family:row.family,kind:row.kind,
      target:target,params:JSON.parse(JSON.stringify(row.params||{})),
      face:faceOf(row,loc,canonRef),world_effect:row.world_effect||null,
      flavor:row.flavor||'',pl:ctx.pl.id,lid:loc.id,day:day,accepted:false};
    inst.payout=payoutOf(inst,ctx.pl.prod_mult,canonRef);
    return inst;
  }
  var canonRef=null; // set per-call; regions take canon as an argument, this keeps rollMission's arity small
  function refillBoard(board,ctx,canon,r,day){
    canonRef=canon;var M=R(canon);
    var keep=board.filter(function(m){
      return m.accepted||((day-m.day)<(M.expiry_days||5));});
    var lo=M.board_min||4,hi=M.board_max||6;
    var want=lo+Math.floor(r()*(hi-lo+1));
    var rows=(canon.missions&&canon.missions.universal)||[];
    // condition-preferring rows first so ruins actually get their rebuild
    var ordered=rows.slice().sort(function(a,b){
      return (b.prefer_condition?1:0)-(a.prefer_condition?1:0);});
    while(keep.length<want&&rows.length){
      var row=null;
      for(var i=0;i<ordered.length&&!row;i++){
        var cand=ordered[i];
        if(cand.prefer_condition&&(ctx.locs||[]).some(function(l){return l.cond===cand.prefer_condition;})
           &&!keep.some(function(k){return k.mid===cand.id&&!k.accepted;})){row=cand;}
      }
      if(!row)row=rows[Math.floor(r()*rows.length)];
      keep.push(rollMission(row,ctx,r,day));
    }
    board.length=0;Array.prototype.push.apply(board,keep);
    return board;
  }
  function catchUpBoards(state,canon,ticks,planetIdsOf,ctxOf){
    var res={added:0,expired:0};if(!ticks)return res;
    var w=state.world;w.missions=w.missions||{};
    var base=(w.missionSeedBase>>>0)||1;
    for(var d=0;d<ticks;d++){
      w.missionDay=(w.missionDay||0)+1;
      var pids=planetIdsOf(state)||[];
      for(var p=0;p<pids.length;p++){
        var pid=pids[p];var ctx=ctxOf(pid);if(!ctx)continue;
        // STATELESS per-planet-day seed (agency-spec discipline): chunk-independent replay
        var r=rng((base^(w.missionDay*2654435761)^hashStr(pid))>>>0);
        var before=(w.missions[pid]||[]).length;
        w.missions[pid]=refillBoard(w.missions[pid]||[],ctx,canon,r,w.missionDay);
        res.added+=Math.max(0,w.missions[pid].length-before);
      }
    }
    return res;
  }
  return {rng:rng,hashStr:hashStr,payoutOf:payoutOf,
          rollMission:function(row,ctx,r,day,canon){canonRef=canon;return rollMission(row,ctx,r,day);},
          refillBoard:refillBoard,catchUpBoards:catchUpBoards};
})();
/*</mission-core>*/
```

(If the `canonRef` juggling reads poorly during implementation, thread `canon` as a proper argument through `rollMission`/`faceOf` instead — behavior identical, tests unchanged except `rollMission` arity.)

- [ ] **Step 4: Run** `node --test tests/*.test.js` — all green, incl. `engine-syntax.test.js` (the headless boot proxy must still compile the enlarged inline script).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/_load-mission.js tests/mission-core.test.js
git commit -m "engine: mission-core pure region - seeded PRNG, board refill/expiry, face attribution, payout math"
```

---

### Task 6: Glue — boards on the world tick, S seeding, digest line

**Files:**
- Modify: `index.html` — `init()` (~2710–2724: S-key seeding + the `WORLD.catchUp` call site ~2719), new glue helpers `missionCtxOf(pid)` / `missionPlanets()` near the other world glue, digest merge
- Test: extend `tests/mission-core.test.js` is NOT needed; this task is glue — verified by `tests/engine-syntax.test.js` + a browser smoke in Task 9. Add one save-shape test: `tests/mission-save.test.js`

**Interfaces:**
- Consumes: `MISSION.catchUpBoards` (Task 5), `WORLD.catchUp` result `_wc.ticks` (existing, index.html:2719).
- Produces: `S.world.missions` (persisted boards, keyed by planet id), `S.world.missionSeedBase` (rolled once at seeding, never mutated), `S.world.missionDay` — Task 7's UI reads `S.world.missions`.

- [ ] **Step 1: Write the failing save-shape test**

```js
// tests/mission-save.test.js — boards ride snapshot/restore untouched
const test = require('node:test');
const assert = require('node:assert');
const { loadSave } = require('./_load-save');
const SAVE = loadSave();

test('S.world.missions and seed/day survive snapshot round-trip', () => {
  const S = { world: { missions: { p1: [{ iid: 'x', mid: 'purge', accepted: true, target: 3, progress: 0 }] },
                       missionSeedBase: 999, missionDay: 4 },
              threads: [], roster: [] };
  const blob = JSON.parse(JSON.stringify(SAVE.snapshot(S)));
  assert.deepStrictEqual(blob.world.missions.p1[0].mid, 'purge');
  assert.strictEqual(blob.world.missionSeedBase, 999);
  assert.strictEqual(blob.world.missionDay, 4);
});
```

- [ ] **Step 2: Run it** — this may PASS already (snapshot clones all non-DENY keys). If it passes, keep it as a regression pin and move on; the failing-first discipline applies to behavior tests, this one is a shape pin.

- [ ] **Step 3: Implement glue**

3a. In `init()` after the existing seeding lines (`if(!S.world.rulers)...` ~2717):

```js
  if(!S.world.missions)S.world.missions={};
  if(S.world.missionSeedBase===undefined)S.world.missionSeedBase=((S.time&&S.time.epoch)||1)%2147483647;
  if(!S.world.missionDay)S.world.missionDay=0;
```

3b. After the `WORLD.catchUp` call (`var _wc=WORLD.catchUp(S,D,Date.now());` ~2719):

```js
  var _mc=MISSION.catchUpBoards(S,D,_wc.ticks,missionPlanets,missionCtxOf);
  if(_mc.added>0&&S._digest)S._digest.lines.push('◈ '+_mc.added+' new missions posted across the sector boards.');
```

3c. Glue helpers (near the other world/map glue, around `rMap`'s helpers). `missionPlanets` limits generation to the planets the alpha actually opens (the demo sector set) — the full 87-planet spread costs nothing extra but keep it total anyway:

```js
 function missionPlanets(){return (D.galaxy.planets||[]).map(function(p){return p.id});}
 function missionCtxOf(pid){
  var p=(D.galaxy.planets||[]).filter(function(x){return x.id===pid})[0];if(!p)return null;
  var pt=(D.galaxy.planet_types||[]).filter(function(t){return t.name===p.type})[0]||{};
  return { pl:{id:p.id,type:p.type,prod_mult:pt.prod_mult||1},
    locs:(p.locations||[]).map(function(l){
      return {id:l.id,name:l.name,cond:l.condition||null,
        doors:doorKindsOf(l),          // reuse the same derivation rMap's Doors section uses (~line 1886)
        npc:npcNameAt(p.id,l.name)};   // D.npcs_alpha placement match, null if none
    })};
 }
```

`doorKindsOf(l)` / `npcNameAt(pid,lname)`: extract these two small helpers from the existing code paths — `rMap`'s door listing (~1886) and the NPC row builder (~1892) — rather than re-deriving. If the existing code inlines the derivations, factor the minimal lookup out and call it from both places (no behavior change to rMap).

**Planet id/locations reality check:** the exact canon paths (`D.galaxy.planets[i].locations[j].condition` etc.) must be read from the JSON before coding — adjust key names to what v1.21 actually holds; the galaxy mint (v1.12–1.16) defined them. Do not guess: `grep '"planets"' heretics-40k-data-v1.json | head` first.

- [ ] **Step 4: Run** `node --test tests/*.test.js` — green (syntax proxy compiles the new glue).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/mission-save.test.js
git commit -m "engine: mission boards generate on the world tick - S.world.missions seeding, catchUpBoards glue, digest line"
```

---

### Task 7: Location panel Missions section + accept flow (cap 3)

**Files:**
- Modify: `index.html` — `rMap` location page (`h2 +=` chain, between history ~1890 and NPCs ~1892; wire rows ~1901–1904), new `acceptMission(inst)` glue near `startThread` (~1462)
- Test: glue — `tests/engine-syntax.test.js` covers compile; behavior lands in Task 9's browser E2E. No new node test file.

**Interfaces:**
- Consumes: `S.world.missions[pid]` (Task 6), `THREAD.create` via the existing `S.threads.push` pattern (`startThread` 1462–1473), `seedCombat` (1435) for `count_kill` missions, `rules.missions.accept_cap`.
- Produces: MISSION threads whose `seedState.objective` is set and `accepted=true` (skips the briefing gate at 2094 — accepting from the board IS the briefing); `inst.accepted=true` + `inst.tid` on the board row. Task 8 relies on `t.mission` carrying `{iid, mid, payout, world_effect, pl, lid, n}`.

- [ ] **Step 1: Render the board section.** In `rMap`'s location page string, after the history `.lsec` (~1890):

```js
 var _mb=(S.world.missions[pl.id]||[]).filter(function(m){return m.lid===l.id&&!m.accepted});
 if(_mb.length){h2+='<div class="lsec"><h5>Missions — posted here ('+_mb.length+')</h5>'+
  _mb.map(function(m,i){return '<div class="lrow" data-mission="'+i+'"><b>'+m.n+'</b> · '+
   m.face.label+' · target '+m.target+' · pays '+m.payout+
   '<div class="d">'+m.flavor+'</div></div>';}).join('')+'</div>';}
```

- [ ] **Step 2: Wire the click + accept.** With the other `p.querySelectorAll` wirings (~1901–1904):

```js
 p.querySelectorAll('.lrow[data-mission]').forEach(function(r){r.onclick=function(){
  acceptMission(_mb[+r.getAttribute('data-mission')],pl,l)};});
```

New glue fn (below `startThread`):

```js
 function acceptMission(inst,pl,l){
  var cap=(D.rules.missions&&D.rules.missions.accept_cap)||3;
  var live=S.threads.filter(function(t){return t.type==='MISSION'&&t.accepted&&!t.done}).length;
  if(live>=cap){T('Mission cap reached ('+cap+') — finish or abandon one first.');return;}
  var force=S.forces.filter(function(f){return !threadActive(f.n)})[0]||S.forces[0];
  var id='m'+Date.now().toString(36);
  var t={id:id,type:'MISSION',n:inst.n+' — '+l.name,loc:pl.name+' · '+l.name,pl:pl.id,lid:l.id,
   turn:'you',vis:'public',initiator:'You',about:inst.flavor,accepted:true,
   forces:force?[force.n]:[],
   mission:{iid:inst.iid,mid:inst.mid,payout:inst.payout,world_effect:inst.world_effect,pl:inst.pl,lid:inst.lid,n:inst.n},
   seedState:{objective:{kind:inst.kind,target:inst.target,progress:0,params:inst.params,done:false}}};
  if(inst.kind==='count_kill')seedCombat(t,pl.id,l,null,force);
  S.threads.push(t);inst.accepted=true;inst.tid=id;
  persist();T('Mission accepted: '+inst.n);openT(id);
 }
```

**Adaptation notes for the implementer:** (a) `seedCombat` writes `t.seedState={pools,combatants,joined:false}` wholesale (line 1459) — it will CLOBBER the objective key; either add the objective AFTER the `seedCombat` call (`t.seedState.objective={...}`) or patch `seedCombat` to extend rather than replace. Write it accepting-after: set objective after seedCombat. (b) `threadActive(f.n)` — reuse whatever force-lock helper `startThread`'s callers use; if none exists, `S.forces[0]` is the slice-A fallback. (c) `openT` at 2089 already lazy-inits state; since `seedState.objective` is present, `initState` (Task 3) picks it up.

- [ ] **Step 3: Deliver / work buttons.** In `threadView`'s action-block area (where the loot/aftermath buttons live, ~2500-2533), for open MISSION threads:

```js
 if(t.type==='MISSION'&&t.state&&t.state.objective&&!t.state.objective.done){
  var ob=t.state.objective;
  if(ob.kind==='collect_item'){
   var have=S.inv.filter(function(it){return !ob.params.item_n||it.n===ob.params.item_n}).length;
   var db=E('button','btn sm','Deliver items ('+have+' held)');
   db.disabled=!have;
   db.onclick=function(){var give=Math.min(have,ob.target-ob.progress);
    /* remove `give` matching items from S.inv, then: */
    THREAD.apply(t,t.state,[{actor:S.active,effect:{kind:'deliver',qty:give}}],D);
    persist();openT(t.id);};
   V.appendChild(db);
  }
 }
```

`restore` needs no button: in the post handler (~2496–2500), after a post lands on a MISSION restore thread, stage the work effect from the post's own word count:

```js
 if(t.type==='MISSION'&&t.state.objective&&t.state.objective.kind==='restore')
  THREAD.apply(t,t.state,[{actor:S.active,effect:{kind:'work',words:THREAD.wordCount(txt)}}],D);
```

(`txt` = the just-posted body html — reuse the variable the post handler already word-counts for travel transit.)

- [ ] **Step 4: Run** `node --test tests/*.test.js` — green (syntax).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: mission boards on the location panel - accept flow w/ cap 3, deliver button, restore work-posts"
```

---

### Task 8: concludeThread — payout, world effect, Mission Log

**Files:**
- Modify: `index.html` — `concludeThread` (2012–2039: payout between sector-effects ~2034 and `captureOnVictory` 2035), the outcome hookup in `threadView`'s post handler (~2500–2509: route `mission_won` through the same gate), `rTL` (1931–1956: real Mission Log)
- Test: `tests/mission-outcome.test.js` extension is NOT possible for glue — concludeThread is not in a pure region. Verified via syntax test + Task 9 E2E. Add the world-effect math as a pin test only if you extract it; otherwise browser-verify.

**Interfaces:**
- Consumes: `oc.kind==='mission_won'|'mission_lost'` (Task 4), `t.mission` (Task 7), `S.world.stats` shape (existing, world-core `driftScores` uses it).
- Produces: currency payout to `S.cur`, sector stat deltas, board row removal, World Log line.

- [ ] **Step 1: Payout in `concludeThread`.** After the sector-scale effect block (~2034), before `captureOnVictory` (2035):

```js
  if(t.type==='MISSION'&&t.mission){
   if(oc.kind==='mission_won'){
    S.cur+=t.mission.payout;
    var we=t.mission.world_effect||{};var sec=sectorOfPlanet(t.mission.pl);
    if(sec&&S.world.stats[sec]){var st=S.world.stats[sec];
     if(typeof we.taint==='number')st.taint=Math.max(0,(st.taint||0)+we.taint);
     if(typeof we.prosperity==='number')st.prosperity=(st.prosperity||0)+we.prosperity;}
    S.world.log.unshift('◈ MISSION COMPLETE — '+t.mission.n+' ('+t.mission.payout+' paid)');
   } else if(oc.kind==='mission_lost'){
    S.world.log.unshift('◈ MISSION FAILED — '+t.mission.n);
   }
   // either way the board row is spent
   var bd=S.world.missions[t.mission.pl]||[];
   S.world.missions[t.mission.pl]=bd.filter(function(m){return m.iid!==t.mission.iid});
  }
```

`sectorOfPlanet(pid)`: reuse the existing planet→sector lookup (world-core's `findPlanet` is exported — `WORLD.findPlanet`; check its return shape and use its sector id). If the glue already has one (rMap uses one to render sector headers), call that instead — do not write a third.

- [ ] **Step 2: Route mission outcomes at the post-handler gate** (~2500–2509). The current gate defers aftermath only for `mineWon && oc.kind==='annihilation'`; mission outcomes conclude immediately:

```js
 if(oc&&t.state.phase!=='aftermath'){
  if(mineWon&&oc.kind==='annihilation'){t.state.phase='aftermath';t.state.pendingOutcome=oc;}
  else concludeThread(t,oc);   // mission_won / mission_lost land here — immediate conclude
 }
```

(That is likely ALREADY the else-branch behavior — verify by reading the live code; if so this step is a read-and-confirm, not an edit. Combat-mission aftermath looting is deliberately Slice B.)

Also check `npcRespond`'s early-return list (~2239) treats MISSION combat like skirmish so the NPC fights back — it keys off phase, not type; confirm and leave alone if so.

- [ ] **Step 3: Mission Log in `rTL`** (1931–1956). Replace the history-scrape "Available missions" section (~1945–1946) with the real boards, and add meters to accepted mission threads in the "Your threads" section (~1937):

```js
 // accepted, with progress meter
 var mine=S.threads.filter(function(t){return t.type==='MISSION'&&t.accepted&&!t.done});
 // per row: (t.state&&t.state.objective)?(' · '+t.state.objective.progress+'/'+t.state.objective.target):''
 // available nearby: flatten S.world.missions into rows 'name · planet · pays N', click -> jump to rMap location
```

Keep the exact card/`.lsec` markup conventions of the surrounding code; the meter string is `progress + '/' + target` (plain text — the bar visual is Slice B polish).

- [ ] **Step 4: Run** `node --test tests/*.test.js` — green.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: mission conclude pays out - currency + world effect + board removal + real Mission Log in rTL"
```

---

### Task 9: Browser E2E (narrow), BACKLOG close-out

**Files:**
- Modify: `BACKLOG.md` (T-THR-5 + T-MSN-1A rows → `ready-to-push`; add `T-MSN-1B` / `T-MSN-1C` open rows)
- No engine changes expected; fix-forward anything E2E surfaces (each fix = its own commit).

**Interfaces:** none — verification task.

- [ ] **Step 1: Serve + boot.** `python3 -m http.server 8765` in the repo; drive with the Playwright MCP in NARROW scoped runs (long sessions stall — one scenario per run, close between). Capture `window` errors on every page — 0 tolerated.

- [ ] **Step 2: Scenario A — reload persistence (T-THR-5).** Found commander → start a skirmish → deal damage → reload page → reopen thread → wounds/board/phase preserved (not reset).

- [ ] **Step 3: Scenario B — mission loop.** Advance the clock (temporarily set a near-past `S.time.lastTick` via the console, or wait a tick day at `day_minutes` if a dev shortcut exists) → boards populate → digest line shows → open a location → Missions section lists posted missions with faces → accept a Purge → combat seeds → kill the target count → `mission_won` → currency increased by exactly `payout` → World Log line → board row gone → Mission Log meter reflected along the way.

- [ ] **Step 4: Scenario C — caps + non-combat.** Accept 3 missions → 4th refused with toast. Accept an Item Request → Deliver button counts inventory → delivering completes it. Post 40+ words in a Rebuild thread → progress ticks.

- [ ] **Step 5: BACKLOG + final green.** `node --test tests/*.test.js` (expect ~233+, 0 fail). Update `BACKLOG.md`: T-THR-5 → `ready-to-push` (list commits), T-MSN-1A → `ready-to-push` (list all commit paths), add rows `T-MSN-1B` (universals — remaining 8 rows + modifier picker + named-target params; canon-heavy) and `T-MSN-1C` (streaks + 18 signatures; hot). Commit:

```bash
git add BACKLOG.md
git commit -m "backlog: T-THR-5 + T-MSN-1A ready-to-push; T-MSN-1B/1C queued (missions slices B/C)"
```

Do NOT push — Daak pushes.

---

## Self-review notes (done at write time)

- **Spec coverage:** §1 tracker (T3/T4) ✓ · §2 generator/boards/faces/expiry/surfaces (T5/T6/T7) ✓ · §3 payout/lifecycle/world-effects (T5 payoutOf, T8) ✓ · §5 T-THR-5 prereq (T1) ✓, pilots ✓, round-trip test (T1) ✓, determinism test (T5) ✓, narrow E2E (T9) ✓. Modifiers UI, abandon-restores-board, and aftermath-looting on combat missions are **Slice B** (spec §5 puts the modifier picker there; abandon: `exitThread` on an accepted mission currently just exits — B ships abandon semantics).
- **Type consistency:** `evalObjective` (T3) consumed by T4's outcome via inline logic (outcome reads `ob.progress>=ob.target` directly — same predicate, no drift) and T8 reads only `oc.kind`. `inst` shape (T5) matches `acceptMission` reads (T7) and `t.mission` writes consumed in T8. `catchUpBoards(state,canon,ticks,planetIdsOf,ctxOf)` arity consistent between T5 tests and T6 glue.
- **Honesty markers:** T6/T7/T8 contain explicit read-before-edit checkpoints where the plan cites line numbers that parallel sessions may shift (T-CMB-1 on `apply`; galaxy JSON key names). Plan-embedded code is unverified until its task's tests pass — per house lesson, reviewers gate every task.
