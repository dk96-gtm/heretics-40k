# Battlefield Grid — Remaining Work & Cross-Agent Handoff

**Date:** 2026-07-19
**Author:** battlefield workstream
**Status:** core feature shipped (slices A–E, engine v18) — this doc tracks what's
left and what other workstreams can pick up.
**Companion docs:** `2026-07-19-battlefield-grid-system-design.md` (the full design).

---

## 0. Where the feature stands (shipped & verified)

Grid combat runs end-to-end inside combat threads: procedural board → **blind deploy →
Lock In (freeze) → true per-side fog battle** where the board **is** the Action Block
(select → reachable → move; spot enemy → target → fire), all flowing through the pure,
node-tested `THREAD` core. Verified live against canon v1.10 with real models/weapons
(gharn's Bubotic Axe hit through the fog-gate → validate → apply → armour pipeline).

```
  A geometry ✓   B terrain+gen ✓   C fog ✓   D1–D4 ✓   E deploy+freeze ✓
```

Pure helpers in the THREAD core (all tested in `tests/grid-*.test.js`):
`cheb · bandOf · reachable · lineOfSight · coverMod · genBoard · sightOf ·
spottedEnemies · refreshFog` + the `move` effect in `apply`.
Engine glue (outside the core, in `index.html`): `bfSetup · bfDeployUI · bfCombatUI ·
bfBoardEl(retired) · bfWeaponsOf · bfItemBand · bfStaged · bfCellLabel`.

---

## 1. Remaining work I intend to do (with the concrete HOW)

Ordered by value-to-effort. Items ①–③ close gaps against the approved design; the rest
are enhancements.

### ① Wire cover into the damage step  — small, closes a spec gap
`coverMod()` is written and tested but **not** applied. Terrain cover is currently
display-only.
**How:** in `THREAD.apply`'s `kind==='damage'` branch (index.html), the current line is
`_taken = max(0, e.amount − armour[element])`. Add a cover term when a board is present:
```js
var cov = state.board ? coverMod({x:c.x,y:c.y}, state.board) : 0;
var _taken = Math.max(0, e.amount - ((_def && _def[e.element]) || 0) - cov);
```
**Test:** target standing on ruins (heavy) takes 2 less than on open ground. TDD in
`tests/grid-state.test.js` or a new `grid-damage` test.
**Effort:** ~2 lines + 1 test.

### ② Board derived from planet ⊕ location  — the galaxy tie-in (see §2)
`bfSetup` hardcodes the board cfg:
`genBoard({w:14,h:10,density:0.16,palette:['forest','ruins','mtn','fort'],zoneDepth:2}, Math.random)`.
The locked design is **board size + terrain from `planet_type ⊕ location_type` + RNG**.
**How:**
1. Add a resolver `bfBoardCfg(planetType, locationType, canon)` → `{w,h,density,palette,zoneDepth}`.
   e.g. interior/bastion location → 8×8, high `fort` density; open plains planet →
   20×20, sparse; forest world → high `forest` density.
2. Resolve `(planetType, locationType)` from the thread's location (the thread carries
   `t.loc`; need the galaxy accessors — see §2).
3. Drive it from canon data, not hardcoded branches — a `rules.grid.generation` table
   keyed by planet/location type (folds into ③).
**Effort:** medium. **Blocked on:** the galaxy/notion workstream settling the
planet/location data shape (§2). *Until then the hardcoded cfg is a safe default — the
feature is fully decoupled and won't break as planets are minted.*

### ③ Move terrain/grid config from engine into canon  — data, tunable
The `TERRAIN` table (pass/cost/cover/opaque) and the band/sight/cover thresholds are
**built-in constants** in the THREAD core (deferred out of canon.json to avoid collisions
with the concurrent armour/notion canon edits).
**How:** add a `rules.grid` block + `terrain_types` to canon.json:
```
rules.grid = { bands:{melee:[0,1],short:[2,3],medium:[4,6],long:7},
               sight:{MELEE:2,SHORT:4,MEDIUM:7,LONG:11},
               cover:{none:0,light:1,heavy:2}, move_cost:{open:1,difficult:2},
               scout_sight_bonus:3 }
terrain_types = { open:{pass,cost,cover,opaque}, forest:…, ruins:…, mtn:…, fort:… }
```
Then have `bandOf/sightOf/reachable/coverMod/genBoard` read from the passed `canon`
with the current constants as fallback (keeps tests green during migration).
**Effort:** medium. **Coordinate** the canon.json edit with whoever else is editing it.

### ④ Scout / aspect sight bonus
`sightOf(band, bonus)` supports and tests the bonus; `bfSetup` passes `0`.
**How:** in `bfSetup`, scan the model's ability slots for a scout/recon tag and pass
`rules.grid.scout_sight_bonus`. Depends on the ability-tag data shape (armour/notion
tag registry — the `Scout`/`Stealth` tags exist in GLOSS now).
**Effort:** small once the tag lookup is settled.

### ⑤ Deploy "last respec" drill-in + full freeze gating
`bfDeployUI` shows a roster tray but tapping a model doesn't open its overview/Armoury,
and the freeze is only a flag (`state.locked={loadout:true}`).
**How:** from the deploy tray, open the existing model-overview overlay + Armoury equip
(reuse the Barracks flow). Gate equip by phase: **allow during `phase==='deploy'`, block
once `state.locked`** (extend the existing active-thread lock, which already blocks refit
for `DEPLOYED` models, to relax during deploy). 
**Effort:** medium; reuses existing overview + Armoury UI.

### Polish (low priority)
- Retire the standalone **screen-VIII** prototype (fold its `bf-*` CSS into the main
  stylesheet, remove the nav button + `#s-battle` + `go()` dispatch). Kept for now as a
  fixtures sandbox and because `bfCombatUI/bfDeployUI` reuse its CSS.
- `lineOfSight` is DDA-sampled (v1) — upgrade to full supercover for corner cases.
- Exit **pursuit** still uses the old flat speed heuristic — make it grid/position aware.
- Panel-beside-board layout wraps on narrow widths; difficult-terrain reach could show a
  cost hint.

---

## 2. OPEN FOR OTHER AGENTS — clean pickup points

### 2a. Galaxy / world-building workstream (planets, named locations)
**No conflict today** — the battlefield reads zero planet/location data (hardcoded board
cfg). Your expansion is the *input* for remaining-work ②.
**What would let me wire ②:**
- A stable accessor to get, for a thread's location, its **`planet_type`** and
  **`location_type`** keys. (Threads carry `t.loc`; I'll resolve through the galaxy
  accessors — please keep `fPl(pid).p.type` / `fLoc(pid,sid).type`-style fields, or tell
  me the shape you settle on.)
- **Optional but ideal:** put a `board` hint on each `location_type` in canon — e.g.
  `board:{ size:'small'|'medium'|'large', palette:['forest','fort'], density:0.2 }`. Then
  my resolver is pure data-lookup instead of hardcoded type→cfg branches, and every new
  location you mint gets a sensible battlefield for free.
- Warp-gate / webway locations: when minted, they feed the (already plumbed) free-gate
  travel — unrelated to the grid, but worth flagging as they land.

### 2b. NPC / AI workstream (living world, combat referee)
The grid exposes everything an AI opponent needs to take a combat turn — no new engine
surface required:
- `THREAD.reachable(pos, speed, board, occupied)` → legal moves for a model.
- `THREAD.spottedEnemies(side, state, board)` → what the AI side can see (fog-honest).
- `THREAD.bandOf(THREAD.cheb(a,b))` + weapon band → is a target in range.
- Build a staged block (`[{actor,cost,effect:{kind:'move'|'damage',…}}]`) and call
  `THREAD.apply`, then post as the enemy side. This is the missing half of the
  **alternating side-turn** loop (already built on the player side).
**Pickup:** an "NPC combat turn" that picks moves + attacks from the above and posts —
slots directly into the existing `threadView` post pipeline. This is what makes the enemy
actually fight back.

### 2c. Stage-2 persistence workstream
- **Private fog:** today each post renders the poster's `refreshFog` view, but the thread
  log is public, so a reader can reconstruct both sides. True hidden info needs
  per-account rendering (only your side sees your view). Hook: `refreshFog(side,…)` is
  already per-side; Stage-2 just needs to scope who sees which render.
- **True blind-simultaneous deploy:** today is single-player (you place, enemy
  auto-hidden). Real 2-player needs a commit/reveal on `phase==='deploy'` before battle.

---

## 3. Interfaces other agents should NOT break

If you're editing `index.html` / canon, these are the battlefield contracts:
- **THREAD core region** `/*<thread-core>*/…/*</thread-core>*/` stays pure/DOM-free; the
  grid helpers there are node-tested — run `node --test` after touching it.
- `state.combatants[id]` carries `{x,y,sight,spd}` for grid combat; `apply` handles a
  `move` effect and `validate` gates attacks to `spottedEnemies`. Don't reintroduce a
  `band` scalar on combatants — band is *derived* from positions now.
- `state.board / state.phase / state.zones / state.fog / state.locked` are grid state on
  the thread; `initState` carries them from `seedState`.
- `bfSetup(t)` is idempotent (one board per thread) and reads a model's `spd` + weapon
  band + `loadout.slots` — keep those model fields stable.

---

## 3.5 FUTURE EPIC — Multi-layer battlefields (nested + destructible environment)

A whole new dimension, bigger than the ❶–❺ items above. Three interlocking systems:

**① Nested grids (enterable environment).** Some environment types are *portals*, not just
cover. A model can **Enter** an enterable piece (building/space) → a **new interior
battlegrid** is generated. The interior is a **sealed** combat space — only models that
entered fight there; the exterior can't target inside and vice-versa. The battlefield
becomes a **tree of grids**: the main board + N interiors linked by portal tiles.

**② Destructible environment (terrain has HP).** Every environment feature — mountain,
tree, lake, building — carries **Wounds** and is a valid attack target. Destroying it
mutates the tile (cover removed, LOS opened, passability changed; building → rubble,
forest → cleared).

**③ Collapse-death (① × ② collide).** Destroying an enterable piece's *exterior* HP while
models occupy its *interior* → the structure collapses → **everyone inside dies** (new
death cause, no revival — buried). You can't shoot into a sealed building, but you can
bring it down on the occupants.

### How it extends the shipped grid
```
  terrain tile   {t}          → {t, hp, maxHp, enterable?, interiorId?}
  state.board    (one grid)   → state.boards {id → grid}; combatant gains a `layer`/boardId
  apply          + 'enter' (portal traverse) + 'damage-terrain' + collapse cascade
  catalog        + "Enter <space>" + "Attack terrain"
  fog            per-board, per-side (each interior has its own fog)
  death          + cause 'interior collapse'
  reachable / bandOf / lineOfSight / refreshFog  already operate per-board — reuse as-is,
    scoped to the combatant's current board. The new work is the BOARD GRAPH + terrain-
    as-target + the collapse cascade.
```

### Open design questions (resolve at build time — brainstorm first)
- **Which types are enterable?** Buildings clearly. Forests (into the woods)? Lakes
  (underwater layer)? Mountains (caves)? Or only "structure" types?
- **Interior size:** fixed-small, or scaled to the piece's footprint on the parent grid?
- **HP coverage:** all tiles, or only feature tiles (open ground stays indestructible)?
- **Cross-layer:** fully sealed (enter/exit only) vs. shoot-in-through-windows. The vision
  implies sealed + collapse-only.
- **Nesting depth:** can an interior hold its own sub-spaces (basement)? Cap at 1 level?
- **HP scale / balance:** a tree (~2) vs a mountain (~effectively indestructible); do some
  feature types have so much HP they're only cosmetically destructible?
- **Action economy:** Enter costs a move? Attack-terrain costs AP like an attack?

### Sequencing
This epic depends on the base grid (shipped) but is **independent of ❶–❺** — it can be
brainstormed and built as its own spec → plan → slices cycle. Suggest tackling it AFTER
❶ (cover-into-damage) and ③ (terrain config → canon), since terrain-with-HP is a natural
extension of the terrain_types canon block. Big enough to warrant its own design doc.

## 4. Suggested order when picked back up
1. ① cover-into-damage (tiny, finishes the damage model).
2. ③ terrain config → canon (unblocks ② and ④ being data-driven).
3. ② board from planet⊕location (once galaxy shape is settled — §2a).
4. ⑤ deploy drill-in + freeze gating.
5. ④ scout sight bonus.
6. NPC combat turn (§2b) — the biggest gameplay unlock, but owned by the AI workstream.
