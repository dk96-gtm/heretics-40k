# Free-Form Slots + Armour System — Design

**Slot-model rebuild + a per-element Armour system + a galaxy-wide armour catalog.**

> Distilled from a co-developer session (loadout / battlefield notes). Reconciled to
> shipped **engine v16 / canon v1.6**. The typed-slot model (`S.roster[].sl = [{k,it}]`,
> equip filter at `index.html:938`, damage apply at `index.html:559`, `damageOf` at
> `index.html:1316`, doors at `galaxy.doors`, growth at `rules.growth`) is the spine this
> slice rebuilds and extends. First of the co-dev-notes slices; siblings (battlefield grid,
> time/offline, living sector) are separate specs.

## Goal

Replace the fixed weapon/item/ability slot split with a **fully free-form** loadout — the
player owns each slot's type — and give every model a separate **hard Armour slot** driving
a **per-element damage-mitigation** system, purchasable at a new Armoury door and hardened
at the Forge. After this slice a player can: shape any model's slots (assign type → equip),
see rank-ups grant new settable slots, field models that ship with class+faction default
armour, and watch armour turn or fail to turn hits by element in live combat.

### In scope

- **Slot rebuild (Approach ❷):** loadout capacity derived from canon (`base sl + rank
  growth`), a fresh `{slots:[{type,item}], armour:{item}}` state shape, universal slot
  typing (player assigns `Weapon|Item|Ability|Warp Cast`, then equips), full interactive UI.
- **Armour slot:** one extra hard slot per model, always present, outside the general
  budget, holds only `cat:ARMOUR`. Pre-filled with a class+faction default.
- **Armour item:** full per-element Defense profile (6 values) — `Physical, Heat, Warp,
  Corrosive, Plasma, Energy`.
- **Combat mitigation:** `taken = max(0, dealt − def[element])`, floored at 0, per hit.
  Corrosive bypass is expressed as data (`def.Corrosive:0`), not a hardcoded rule.
- **Armour catalog:** ~143 pieces across all 20 factions — per-faction × per-class defaults
  (80) + a per-faction Light/Med/Heavy buyable ladder (60) + a small universal baseline.
- **Armoury door** (12th door type): buy / sell / fit armour; per-faction skins.
- **Forge armour path:** `+1` to a chosen element's Defense per tier (I–III), at cost.
- **Pure core + tests:** a DOM-free `LOADOUT`/`ARMOUR` helper region, `node --test`, mirroring
  the `THREAD` core.
- **Migration:** demo save-state `{k,it}[] → {slots,armour}`; `NAMED` slots → untyped;
  every model's armour slot seeded from its class+faction default.
- **Canon → v1.7:** `rules.loadout`, `rules.armour`, numeric slot-growth, `D.armour`
  catalog, the `armoury` door, forge armour rules.

### Out of scope (explicit — deferred)

- **Legendaries** — hand-crafted effects outside the tag system (own slice). Freed-up
  universal slots will host them later; no reserved legendary slot is kept.
- **Consumables-on-use** mechanic — own slice.
- **Item lineage / acquisition history** — own slice.
- **Battlefield grid, fog of war, terrain** — armour is the *stat* those notes call for;
  the grid that also cites it is a separate spec. Armour must not depend on grid state.
- **Rank-up notification flourish** — the slot *grant* is in scope (it falls out of
  count-from-rank); a dedicated ceremony/toast is not.
- **Deep shop economy** (escrow, haggling) — armour buys reuse the existing cart/sell path.
- **Psyker gating of Warp Cast slots** — waived by decision; slots are universal.

## Decisions locked (from brainstorming)

| Question | Decision |
|---|---|
| Slot purity | Fully universal — player types a slot, then equips into it. No psyker gate, no legendary slot. |
| Slice scope | Full free-form interactive UI now; presets are a seed the player can change. |
| Slot-model approach | ❷ Full rebuild — capacity derived from canon `base sl + growth`. |
| Armour reduction | Flat soak, floored at 0 (a weak hit vs heavy armour deals nothing). |
| Defense shape | Full per-element, all 6 values hand-set per piece. |
| Corrosive bypass | Data, not rule (`def.Corrosive` low/0). A rare acid-proof plate can exist. |
| Catalog scope | All 20 factions now. |
| Default armour | Per Faction **×** per Model Class (Core/Assault/Flying/Armament). |
| Armour buying | New **Armoury** door. |
| Armour upgrade | **Forge** — +1 Defense to a chosen element per tier. |
| Loadout edits | Gated to models **not in an active thread** (mirrors Force-edit rule). |
| Canon bump | v1.6 → **v1.7**. |

## Architecture

### Unit 1 — Slot model (state + count)

**Canon.** Model definitions keep integer `sl` (base slot count). Add a **numeric**
slot-growth encoding so capacity is computable (today `rules.growth.slot_gains` is prose,
e.g. `"+1 at R2 and R4"`):

```json
"rules.growth.slot_gains_by_rank": {
  "Core":     [0,1,1,2,2],
  "Assault":  [0,1,1,2,2],
  "Flying":   [0,1,1,2,2],
  "Armament": [0,1,2,3,4]
}
```

Index = rank−1; value = cumulative slots gained over base. `Armament` gains every rank
(matches existing prose). The prose `slot_gains` stays as human-readable doc.

**State.** Per model in save-state `S`:

```js
m.loadout = {
  slots:  [ { type: null|'WEAPON'|'ITEM'|'ABILITY'|'CAST', it: null|{…} }, … ],
  armour: { it: {…armour piece…}|null }
}
// slots.length === base sl + slot_gains_by_rank[cls][rank-1]
```

`type:null` = an untyped/unassigned slot (freshly granted or migrated). A slot must be
typed before it can hold an item. Rank-up grows `slots.length`; new entries are `{type:null,
it:null}` — the player sets them.

### Unit 2 — Armour item + per-element Defense

```js
{ n:"Ceramite War-Plate", cat:"ARMOUR", faction:"death_guard"|null,
  cls:"Core"|null,            // set on defaults; null on ladder/universal
  tier:"default"|"light"|"medium"|"heavy",
  pc: <points cost>,
  def:{ Physical:3, Heat:1, Warp:1, Corrosive:0, Plasma:1, Energy:1 },
  d:"flavour / summary string" }
```

`parseItem` (`index.html:1723`) gains an `ARMOUR` branch that reads `def` instead of a
weapon damage string; `itemStatsHTML` renders a 6-element Defense row. Armour never parses
as a weapon.

### Unit 3 — Combat mitigation (pure)

`THREAD.initState` reads each model's equipped armour → stores `c.armour = {…def}` on the
combatant. `apply` (`index.html:559`) mitigates before subtracting wounds:

```js
// was: c.w[0] - e.amount
var raw = e.amount;
var def = (c.armour && c.armour[e.element]) || 0;
var taken = Math.max(0, raw - def);
c.w = [Math.max(0, c.w[0] - taken), c.w[1]];
```

- Floored at 0 — armour can fully negate.
- Multi-hit / rapid weapons resolve as multiple `damage` effects → mitigated **per hit**.
- The **element still sets the revival window** on the killing blow (unchanged) — even a
  0-damage-history model that finally drops takes its window from the *fatal* element.
- No corrosive special-case: `def.Corrosive` (usually 0) does the work.
- Order vs health-state multiplier: `dealt` is the post-multiplier number; armour subtracts
  last.

The mitigation math (`mitigate(raw, element, def)`) plus slot helpers live in a pure region:

```
/*<loadout-core>*/  LOADOUT = {
  slotCount(cls, rank, baseSl, canon),   // base + slot_gains_by_rank
  legalItems(slotType, inventory),        // filter by cat
  canEquip(slot, item), retypeSlot(slot), // rules for the UI + tests
  mitigate(raw, element, def)             // max(0, raw-def)
}  /*</loadout-core>*/
```

Tests in `tests/loadout-core.test.js` (`node --test`): mitigation floors & bypass,
per-hit behaviour, slot-count-by-rank per class, retype clears the item, legal-item filter.

### Unit 4 — Armour catalog (`D.armour`)

New top-level `D.armour` array. Each faction contributes:

- **4 defaults** — one per class (Core/Assault/Flying/Armament), `tier:"default"`,
  `pc` low. These are what a model of that faction+class ships with.
- **3 ladder** pieces — `tier: light|medium|heavy`, `faction` set, `cls:null` (any class of
  that faction may buy), rising `pc` and Defense.
- Plus a shared **universal baseline** set (`faction:null`) — a floor anyone can buy.

Faction *slant* is the design signature (all 6 numbers hand-set), e.g.:

| Faction | Signature slant |
|---|---|
| Death Guard | Corrosive-proof, Warp-strong, slow physical |
| Tau | Energy-hard, melee/physical-soft |
| Necron | Physical-brutal, self-repairing feel |
| Thousand Sons | Warp-hard, physical-brittle |
| Custodes | High everything, few pieces, premium `pc` |

Authoring is ~143 hand-set profiles — parallelizable by allegiance/faction during
implementation (subagents), each returning validated `def` objects to merge.

> Reconciliation note: the Notion Compendium stats 75 *items* but Armour is a **net-new**
> system (a separate stat, per the notes). Authoring is fresh; cross-check only that no
> existing item duplicates an armour name.

### Unit 5 — Armoury door + Forge armour path

**Armoury door** — appended to `galaxy.doors`:

```json
{ "kind":"armoury", "name":"Armoury", "does":"buy and fit Armour",
  "rarity":"common",
  "skins":{ "imperial":"Panoply", "chaos":"Panoply of Spite",
            "necrons":"Reclamation Vault", "tau":"Fitting Bay", … all 20 } }
```

Added to a small set of alpha `location_types` (stronghold / muster-class). Engine gets a
`renderArmoury(loc)` requisition handler: lists `D.armour` filtered to the location faction
+ universal, with buy (cart/`pc`), sell, and **fit** (equip into the armour slot). Reuses
the shop cart/sell plumbing.

**Forge** — `equipment_alpha.forge_rules` gains an armour path:

```json
"armour_upgrade": { "per_tier":"+1 Defense to one chosen element",
                    "tiers":["I","II","III"], "cost":"currency, rising per tier" }
```

Forge UI adds an "Upgrade Armour" mode: pick the equipped armour → pick an element → pay →
`def[element] += 1`. Buy base @ Armoury → harden @ Forge is the progression loop.

### Unit 6 — UI (loadout screen + model overview)

- **Untyped slot** → `＋ Assign` → type chooser (Weapon/Item/Ability/Warp Cast) → becomes
  typed+empty.
- **Typed empty slot** → shows type label + "Empty — click to equip"; picker filters
  inventory to that type.
- **Typed filled slot** → item card; click to unequip/swap; a "change type" affordance
  (re-typing returns the equipped item to inventory first).
- **Armour slot** → rendered distinctly (its own row), only accepts `ARMOUR`, shows the
  Defense profile.
- Model-overview slot grid groups by assigned type; untyped slots fall under "Unassigned".
- All edits gated: disabled when the model is in an active thread (reuse the Force-edit
  active check).

### Unit 7 — Migration + seeding

On boot / save-state build:

1. Each `m.sl = [{k,it}]` → `m.loadout.slots = [{type: k==='NAMED'? null : normalize(k),
   it}]`. `WARP CAST`→`CAST`. `NAMED` empty slots → `{type:null,it:null}`.
2. Ensure `slots.length` matches `slotCount(cls, rank, baseSl)`; pad with untyped slots.
3. Seed `m.loadout.armour.it` from the faction+class default in `D.armour` (every model
   ships armoured).
4. Preset alpha starts define initial slot types + items (the seed the player can change).

## Data flow

```
canon D.armour ─┐
                ├─► preset seed ─► S.roster[].loadout ─► loadout UI (assign/equip/fit)
model sl+growth ┘                        │
                                         ├─► THREAD.initState → c.armour
Armoury door ─► buy ─► inventory ─► fit ─┘        │
Forge ─► upgrade ─► def[element]+1                ▼
                                    apply(): taken = max(0, dealt − def[el])
```

## Error / edge handling

- Equip attempt on an untyped slot → forced through the type chooser first.
- `mitigate` with unknown element or missing `def` → treats Defense as 0 (fail-open to
  full damage; never negative).
- Rank-down (revival/debug) never *removes* a filled slot's item silently — extra slots
  beyond capacity are marked over-capacity and locked, not discarded.
- Armour slot can be emptied (unarmoured = all-0) — legal state, not an error.
- Selling/unfitting an armour mid-management is fine; blocked only while in an active thread.

## Testing

- **Pure:** `tests/loadout-core.test.js` — mitigation (floor, bypass, per-hit), slot-count
  by class/rank, retype, legal-item filter.
- **Boot proxy:** existing `tests/engine-syntax.test.js` must still compile the inline
  script after the rebuild.
- **In-browser (pre-commit, per CLAUDE.md):** 0 JS errors; exercise Barracks loadout
  (assign type, equip, retype, fit armour), a combat thread showing armour turning/failing
  a hit by element, the Armoury door (buy/fit), the Forge armour upgrade, and a rank-up
  granting a settable slot.

## Canon changes (v1.6 → v1.7)

- `rules.loadout` — the free-form universal-slot model, in words (Stage-2 backend seed).
- `rules.armour` — mitigation formula, floored-at-0, corrosive-as-data, the hard armour
  slot rule, default-armour-per-faction-per-class.
- `rules.growth.slot_gains_by_rank` — numeric slot growth.
- `D.armour` — the ~143-piece catalog.
- `galaxy.doors[+armoury]` + armoury entries on relevant `location_types`.
- `equipment_alpha.forge_rules.armour_upgrade`.
- `meta.version` → `1.7`.

## Suggested build order

1. Canon: `slot_gains_by_rank`, `rules.loadout`, `rules.armour` scaffolding, `meta` bump.
2. Pure `LOADOUT` core + tests (mitigation, slot count, retype, legal filter) — TDD.
3. State migration + default-armour seeding + preset starts.
4. Loadout UI rebuild (assign/equip/retype/fit) with active-thread gating.
5. Combat wiring (`initState` armour read, `apply` mitigation).
6. Armour catalog authoring (parallelizable by faction/allegiance).
7. Armoury door + requisition handler; Forge armour-upgrade mode.
8. In-browser verification pass, then commit.
