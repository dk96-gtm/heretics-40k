# Battlefield Grid System — Design Spec

**Date:** 2026-07-19
**Status:** Design approved (brainstorm complete) — ready for slice plans
**Engine baseline:** v16 · **Canon baseline:** data v1.7 (in flight)
**Prototype:** screen VIII visual mock shipped in `9a893d1` (retired by this design — see §10)

---

## 1. Goal

Replace combat's single abstract distance scalar (`combatant.band ∈ {MELEE,SHORT,MEDIUM,LONG}`)
with a real **square grid battlefield**. Models occupy `(x,y)` cells; distance between two models
*derives* the range band the existing weapon catalog already speaks. Movement, line-of-sight fog,
terrain, and blind deployment all build on the grid. The whole thing lives **inside the combat
thread** — the grid is the input surface for the existing Action Block, not a separate screen.

Non-negotiable design law carried through: it is always **"model"**, never "chassis".

---

## 2. Decisions locked (this session)

| Axis | Decision |
|---|---|
| Grid geometry | Square grid, **Chebyshev** distance (diagonals count as 1) |
| Board size + terrain | **Procedurally generated** from `planet_type ⊕ location_type` + seeded RNG (size *and* terrain are one generator) |
| Distance → band | Fixed absolute thresholds: **0–1 MELEE · 2–3 SHORT · 4–6 MEDIUM · 7+ LONG**. A band-X weapon reaches band X and everything nearer. Thresholds live in canon (tuned once). |
| Movement economy | **Speed = free move radius** per turn (0…Speed squares, any direction). AP pool is spent only on actions (attack/ability/cast/item). Move and act are independent budgets. |
| Turn loop | **Alternating side-turns.** One post = one side moves *all* its models + stages actions, spends AP, posts. Other side responds. Maps onto today's one-action-block-per-post. |
| Fog of war | **True per-side fog.** Each post renders the poster's knowledge only. Enemy models beyond your sight are hidden; last-seen ones show as a **ghost** at last-known position. Target only what you currently see. Terrain blocks LOS. |
| Sight range | = the model's equipped weapon band, in squares; extended by scout/aspect abilities. |
| Terrain depth | **Full:** movement (difficult / impassable) + LOS blocking + **cover modifies damage** (light/heavy → damage reduction in `apply`). |
| Deployment | **Blind simultaneous.** Each side drag-drops within its own zone without seeing the enemy line; revealed only through fog once battle begins. Zones generated with the board (opposite edges, depth scaled to size). |
| Home of the UI | **Inside `threadView`**, for any combat thread (SKIRMISH / INVASION). Board + Action Block + AP are one merged UI. Standalone screen VIII is retired. |
| Loadout / roster | Deployment is the **last chance to respec** a model's loadout. **Lock In freezes** per-model loadout *and* force roster until the thread closes. |

---

## 3. Where it lives (architecture)

The grid is **not** a new screen. It is rendered by `threadView(V,t)` when `t` is a combat thread,
and it drives the existing composer stack:

```
  threadView(V,t)                       combat thread
   ├─ BOARD (new)          ← grid render from t.state.board + fog, INPUT surface
   ├─ threadComposer       ← the post text field (unchanged)
   │   └─ threadBlockBuilder  = THE ACTION BLOCK — board clicks stage into it
   │        · click your model → reachable squares light
   │        · click a square    → stages a MOVE (free)
   │        · click a spotted foe → sets attack target
   │        · slot dropdown      → ability / cast / item (as today)
   │        · AP pool + validate + POST  (as today, from state.pools)
   └─ threadSidebar        ← Battle Report: per-model wounds/AP, now position-aware
```

The Action Block **is** the staged turn. The board only produces two things the block already
understands: a **Move** effect (`{kind:'move', who, to:{x,y}}`, replacing today's `band` effect)
and a **target** for an attack (a spotted enemy id). Everything else in the block — cost, staging
chips, `THREAD.validate`, `THREAD.apply`, posting — is unchanged in shape.

---

## 4. Data model (THREAD core)

All state changes stay inside the pure, DOM-free `THREAD` core (`/*<thread-core>*/`), keeping it
node-testable. Canon and state continue to arrive as arguments.

### 4.1 `state.combatants[id]`
```
  REMOVE  band                     (now derived from positions)
  ADD     x, y                     integer cell coordinates
  KEEP    party, model, w:[cur,max], conds, dead, killElement, revivalWindow, permaDeath
```

### 4.2 `state` additions
```
  board   { w, h,
            tiles: [ {t:'open'|'forest'|'ruins'|'mtn'|'fort'} ]   // row-major, length w*h
            zones: { <partyA>:{x0,y0,x1,y1}, <partyB>:{...} },
            planet, loc, seed }
  phase   'deploy' | 'battle'
  fog     { <party>: { seen:[enemyId…], lastKnown:{ enemyId:{x,y} } } }   // per side
  turn    integer;  side  <party currently to move>
  locked  { loadout:true } once both sides Lock In  (snapshot taken at lock)
```

`initState` seeds `board` from `thread.seedState` (a generated board) and starts `phase:'deploy'`
for a fresh combat thread. `pools` (AP) is unchanged in location but **refreshes to each force's
AP at the start of that side's turn** (new rule — today it seeds once).

### 4.3 Canon additions (data v1.x, bump `meta.version`)
```
  rules.grid = {
    bands:   { melee:[0,1], short:[2,3], medium:[4,6], long:7 },   // long = 7+
    sight:   { MELEE:2, SHORT:4, MEDIUM:7, LONG:11 },              // weapon band → sight sq
    cover:   { none:0, light:1, heavy:2 },                         // damage reduction
    move_cost:{ open:1, difficult:2 },                            // difficult = forest/ruins
    scout_sight_bonus: 3                                           // scout/aspect ability adds (tunable)
  }
  terrain_types = {                                               // preset property bundles
    open :{ pass:true,  cover:'none',  opaque:false, difficult:false },
    forest:{ pass:true, cover:'light', opaque:false, difficult:true  },
    ruins:{ pass:true,  cover:'heavy', opaque:false, difficult:true  },
    mtn  :{ pass:false, cover:'none',  opaque:true,  difficult:false },
    fort :{ pass:false, cover:'heavy', opaque:true,  difficult:false }
  }
  generation: per planet_type + location_type → { size range, terrain palette + density }
```

---

## 5. Pure helpers (new, all in THREAD core, all unit-tested)

| Helper | Contract |
|---|---|
| `genBoard(planet, loc, rng)` | Deterministic given `rng` (seedable). Returns `{w,h,tiles,zones,seed}`. Size + terrain palette/density chosen from `planet_type ⊕ location_type`. |
| `cheb(a,b)` | Chebyshev distance in squares. |
| `bandOf(d)` | `d → 'MELEE'|'SHORT'|'MEDIUM'|'LONG'` per `rules.grid.bands`. |
| `reachable(model, board, occupancy)` | **Cost-based flood-fill** (not raw radius): entry cost 1 open / 2 difficult, impassable blocked, budget = Speed, diagonals allowed. Returns set of `{x,y}`. Occupied cells excluded. |
| `lineOfSight(a, b, tiles)` | Supercover line a→b; `false` if any `opaque` tile intervenes. |
| `sightOf(model, canon)` | Weapon band → `rules.grid.sight` squares, + scout/aspect bonus. |
| `visibleEnemies(party, state, canon)` | Union of the side's living models' sight (radius **and** LOS). Returns spotted enemy ids; updates `seen` + `lastKnown`. |
| `coverMod(target, board, canon)` | Target tile cover → damage reduction. |

`reachable` uses cost-based flood-fill so **difficult terrain genuinely shortens reach** — the
prototype's raw Chebyshev radius was a mock simplification and is replaced here.

---

## 6. Catalog / validate / apply changes

**`catalog`** (combat) — the `Move` action (group `'b'`) changes target semantics: today it lists
`→ MELEE/SHORT/MEDIUM/LONG`; now a Move stages a **destination square** chosen on the board. Attack
actions (group `'e'`) list **only spotted enemies** (fog gate). Ability/cast/item slots unchanged.

**`validate`** adds, for a staged block:
- each Move: destination ∈ `reachable(actor)` and in-bounds (else reject).
- each attack: target is currently **spotted** by the acting side, **and** weapon band rank ≥
  `bandOf(cheb(actor,target))` (in-range). Out-of-range or unseen → reject.
- AP: unchanged (`spent ≤ pool`).

**`apply`** adds:
- `move` effect → set `combatant.x,y`; after the block, recompute fog (`visibleEnemies`) for the
  acting side.
- `damage` effect → subtract `coverMod(target)` from damage before applying wounds. Element /
  revival-window / permadeath logic unchanged.

---

## 7. Fog model (per side)

- Rendered board = the **poster's** knowledge. Own models always shown. Enemy models on a currently
  **visible** tile (in sight radius + clear LOS of any living friendly) shown solid. Previously-seen
  enemy now unseen → **ghost** at `lastKnown`. Never-seen enemy → absent.
- Terrain is always visible (you can see the landscape); fog hides enemy **models**, not the map.
- Open forum caveat: the thread log is public, so a reader could reconstruct both partial views over
  time. That is a *social* metagaming issue, not an engine one; Stage 2 accounts hide the private
  view. Documented, accepted.

---

## 8. Deployment + loadout/roster freeze

### 8.1 Deploy phase (inside the thread, `phase:'deploy'`)
- A **roster view**: each model in the committed force, with **[overview ▸]** (reuse the existing
  model-overview overlay) and **[equip ▾]** (reuse the Armoury equip flow, scoped to this battle's
  models). This is the **last chance to respec loadout**.
- **Blind simultaneous placement**: drag/click models into your own zone only. You never see the
  enemy's placement; their line is revealed only through fog once battle begins.
- **Lock In** (per side): when both sides lock, `phase → 'battle'`.

### 8.2 The freeze (on Lock In)
- Snapshot each model's loadout into `state.locked`. From Lock In until the thread closes:
  - per-model **equip controls disabled** (Armoury edits blocked for models in this battle),
  - **force roster frozen** (no add/remove members).
- Built on the **existing** force lock: a Force may already be raised/edited only when its leader is
  *not in an active thread* (`threadView` 946 / 1011, `isForceLead`). This design **extends** that
  same lock to cover per-model equip during a combat thread.

---

## 9. Turn loop & AP

- Alternating side-turns. `state.side` tracks who moves. One post = that side moves all its models
  (each ≤ Speed) + stages actions; `validate`; `apply`; append post; hand turn to the other side.
- AP pool **refreshes to the force's AP at the start of each of that side's turns** (new rule).
- Battle Report sidebar (`threadSidebar`) becomes position-aware: shows each model's cell + derived
  nearest-enemy band instead of the old free-standing `band`.

---

## 10. Prototype relationship (screen VIII → retired)

`9a893d1` shipped a standalone **screen VIII** visual prototype (deploy tray, fog board, move-then-
act composer) from hardcoded fixtures. Its job was to validate the UI — done. This design **retires
screen VIII**: its render/CSS helpers are salvaged and **rehomed into `threadView`**. The nav button,
`#s-battle` section, and the `go()` dispatch line added in `9a893d1` are removed as part of Slice D.
(Prototype-only simplifications being replaced: raw-radius fog with no LOS, non-persistent ghosts,
display-only cover/AP.)

---

## 11. Build slices (decomposition)

Each slice is independently shippable, TDD'd against the pure core, browser-verified before commit.

```
  A · CORE GEOMETRY (pure)      x,y state · cheb · bandOf · reachable(cost-based) ·
                                catalog Move→square · validate/apply moves ·
                                derive band. Combat still omniscient. + tests
  B · TERRAIN + GENERATOR (pure) terrain_types · genBoard(planet,loc,rng) ·
                                passability in reachable · cover in damage ·
                                lineOfSight. + tests (deterministic seed)
  C · FOG (pure + data)         per-side seen/lastKnown · visibleEnemies(LOS) ·
                                targeting gate in validate · ghost data. + tests
  D · THREAD UI MERGE           render board in threadView · wire Action Block
                                clicks (move/target) · per-turn AP · position-aware
                                Battle Report · RETIRE screen VIII
  E · DEPLOY + FREEZE           deploy sub-phase (roster + overview + Armoury equip) ·
                                blind placement · Lock In → phase battle + freeze
                                loadout/roster (extend force active-lock)
```

Dependency: A → B → C are the pure spine (each builds on the prior). D depends on A–C. E depends on D.
A–C ship behind the existing UI (omniscient, then terrain, then fog) with tests; D–E surface it in
the thread.

---

## 12. Testing

- All new logic lands in the pure `THREAD` core and is unit-tested with `node --test` (zero deps),
  same as the v16 thread core. `genBoard` is deterministic under a seeded RNG so board/terrain are
  reproducible in tests.
- New test files under `tests/` (dev-only, never shipped): geometry, reachability (incl. difficult
  terrain), LOS, fog visibility/ghosts, cover damage, generator determinism.
- Browser verification per slice: 0 JS errors, deploy→battle→move→target→attack exercised live.

---

## 13. Out of scope / deferred

- **Warp-gate / webway** interaction with the grid — no charted portals exist yet.
- **Pursuit on Exit** still uses the simple speed heuristic; ranked-speed pursuit is separate.
- **Elevation / verticality** — flat grid only for v1.
- **Simultaneous hidden orders** — rejected in favor of alternating side-turns.
- **Per-viewer private rendering** (true hidden info) — a Stage 2 concern once accounts exist.
- **Marvel armour class** and the **Notion catalog import** are separate concurrent workstreams;
  this design only assumes models carry a weapon with a range band and slots (already true).
