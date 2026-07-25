# Combat Conditions — Tick, Apply, Expire (T-CMB-1)

> **Status:** design LOCKED with Daak, 2026-07-25. Replaces the cosmetic `conds.push` with a
> real per-model condition engine inside the pure THREAD core.
> **Scope decision:** COMBAT TAG-CONDITIONS ONLY. The 9 `galaxy.conditions` (Intact/Fortified/
> Cursed/…) and `galaxy.status_effects` (Thriving/Warring/…) are LOCATION/SECTOR state and stay
> with **T-STAT-1** — including their combat hooks (e.g. Cursed "Imperial models take attrition
> each post"), which T-STAT-1 should wire through the seam this spec creates.

## The problem

`THREAD.apply` handles a `cond` effect by pushing a string onto `combatants[id].conds` — and
nothing ever reads it back. Regen never heals, DoT never bites, Suppressing never pins,
durations don't exist. Worse, the staged effect built at the action-block layer pushes the
**button label** ("Cast: Catalyst") instead of the condition, and always onto **self**, even
for targeted buffs. The GLOSS tooltips promise precise mechanics the engine doesn't deliver —
a gap that becomes visible the moment any player (human or AI) leans on it.

## Locked decisions

| Axis | Decision |
|------|----------|
| Scope | Combat tag-conditions only; location conditions → T-STAT-1 |
| Tick anchor | The **afflicted side's post**: a side's conditions tick when that side posts, BEFORE its staged actions resolve |
| Tick order | **FIFO** — instances fire in the order they were applied (DoT-then-Regen kills a 1-wound model; Regen-then-DoT saves it) |
| Enforcement | **Hard gates everywhere** — `validate` rejects blocks that exceed condition-reduced speed, actions, or AP |
| Stacking | **None, ever.** One instance per tag per model. Re-application: higher tier replaces; equal/lower refreshes the clock. (Overrides GLOSS "DoT stacks with itself" — that text is corrected.) |
| Suppressing cap | Never robs more than **1 action**; tier extends the pin's DURATION instead (tier t = t posts) |
| Tier scaling | All scaling tags scale by tier (table below); Regen's unspecified duration = 2+t (symmetric with DoT) |
| Extensibility | The registry is additive — new tags are one new entry; **unknown tags are inert but displayed** (no crash, no effect, still visible on the card) |

## Data shape

A condition is an **instance object** in `state.combatants[id].conds` (same array as today):

```js
{ tag:'DoT', tier:2, left:4, src:'Bile Launcher' }
// tag  — registry key (capitalised, matches the GLOSS/D.tags name)
// tier — 1..5 (roman numerals normalised to numbers)
// left — posts remaining; Infinity = lasts the thread / until consumed
// src  — item name that inflicted it (element lookups for DoT kills; report text)
```

**Legacy healing:** `normCond(x)` (pure) converts old string entries on first read —
`'Regen II'` → a fresh full-duration instance; unparseable strings (the "Cast: …" labels)
are dropped. No migration step; hydration self-heals.

## The CONDS registry (pure, in the THREAD-core region)

One entry per tag. An entry may define `duration(t)`, `onTick(inst, model)`, `mods(inst)`,
and `instant(inst, state, target)`. Adding a future tag = adding one entry; nothing else
changes. Tags with no entry are cosmetic until they get one.

| tag | duration(t) | per-post tick | mods (validate/damage read) | notes |
|---|---|---|---|---|
| DoT | 2+t | −t wounds | — | a DoT kill flows through the existing kill path: element from `src` item → revival window / `no_revival` permadeath |
| Regen | 2+t | +t wounds (capped at max) | — | GLOSS gap filled: 2+t posts, refresh on recast |
| Slowing | 1 | — | speed −t (floor 0) | |
| Suppressing | t | — | actions −1 (**hard cap: never more**) | tier = pin length, not pin depth |
| Charging | 1 | — | melee damage +t | granted by Charge action |
| Rally | 1 | — | outgoing damage +t | applied side-wide by the Rally action |
| Marked | 2+t | — | incoming damage +t (attackers vs bearer) | |
| Draining | instant | — | — | side AP pool −t at application; no instance stored |
| Cleanse | instant | — | — | splices all **negative** instances (DoT, Slowing, Suppressing, Marked) from target(s); reach (self/touch/Force-wide) by tier |
| Immunity | thread | — | — | blocks application of its stated tag |

**Derived, never stored:** Injured (≤ half wounds → max 2 actions) and Critical (last band →
max 1 action) are computed from `w[0]/w[1]` at validate time. Derived state cannot drift.

**Phase 2 (same spec, second implementation phase):** the damage-step trio — Shield (absorb
pool, then depleted), Ward (per-element reduction), Decoy (next-t-attacks miss). These hook
the existing `LOADOUT.mitigate`/damage seam, not the post clock.

**Explicitly out of this slice:** on-hit instants (Leech, Reclaim, Refund, Momentum, Slayer,
Ambush, Grudge — they belong to the damage/kill step), and Revive/Blink/Stimm (actions, not
conditions).

## Tick pipeline

New pure `THREAD.tickConds(side, state, canon)`:

1. Runs at the **top of `apply`** for the posting side, before staged effects.
2. For each living model of that side, walk `conds` **in array order** (FIFO): resolve
   `onTick` (DoT can kill — full revival/permadeath semantics; Regen heals to cap), then
   `left -= 1`, then splice expired instances.
3. Returns a tick report `[{who, tag, delta, expired}]` which `apply` folds into the battle
   report — the mechanical truth always prints next to the fiction (the prose-vs-blocks
   defence, for free).

## Validate gates (hard)

Pure `THREAD.condMods(model)` sums active instances → `{speed, actions, dmgOut, dmgIn}`.
`validate` consumes it:

- `reachable()` is called with `spd + mods.speed` — a Slowed model's illegal move is rejected.
- Per-model action count ≤ `base + mods.actions`, then capped by Injured (2) / Critical (1).
- AP pool unchanged (Draining already bit it at application).
- Damage staging reads `dmgOut` (Charging/Rally) and the target's `dmgIn` (Marked).

`npcTurn` reads the same mods — the deterministic enemy obeys its own pins automatically.
Rejections reuse the existing readable-reason UX.

## Application path

The staged `cond` effect carries a real payload:

```js
{ kind:'cond', add:{tag:'Regen', tier:2}, to:'<targetId>', src:'Catalyst' }
```

- Built from the item's **parsed tags** (via the existing `parseItem` grammar), not the
  action label — fixes the label bug.
- Buffs get an explicit **target picker** (ally selection); harmful conditions ride the
  existing attack-target flow. (Today everything lands on self.)
- On apply: Immunity check → same-tag check (higher tier replaces / equal-lower refreshes
  `left` to full) → else push a new instance. Multi-tag items apply each condition-tag.
- Instant tags (Draining/Cleanse) resolve immediately through their registry `instant`
  handler; nothing is stored.

## Engine glue (display)

- Model overview + battle cards + the board tooltip (currently joins raw strings) render
  instances as `TAG TIER · N posts` with the GLOSS tooltip attached.
- Battle report gains tick lines: "Threshjaw regenerates 2 · Morvax suffers 2 (DoT, Bile
  Launcher) · Suppression on Gharn ends."
- **Rules-text correction:** GLOSS `DoT` drops "Stacks with itself"; if the canon `D.tags`
  registry repeats the claim, correct it there too (canon edit → bump `meta.version`;
  engine-only GLOSS edit needs no canon bump).

## Testing (`tests/conds.test.js`, node --test, zero-dep)

- `normCond`: legacy strings, labels dropped, roman/decimal tiers.
- Tick math per tag; Regen cap; expiry splice; FIFO order (the 1-wound DoT+Regen both ways).
- Refresh vs replace vs ignore on re-application.
- DoT kill → element-correct revival window; `no_revival` source → permadeath.
- Hard gates: slowed over-move rejected; suppressed extra action rejected; Injured/Critical
  caps; Draining bit the pool.
- Cleanse reach by tier; Immunity blocks application.
- Unknown-tag inertness (applies, displays, does nothing, expires never — `left:Infinity`).
- One end-to-end `apply` case: post ticks → actions resolve → report contains tick lines.
- `tests/engine-syntax.test.js` boot proxy stays green.

## Coordination

- **Lanes:** spec = docs (parallel-safe, this commit). Implementation = 🔥 engine + tests —
  queues behind the in-progress capture/remains slice (`spoils` session) for the hot lane.
- **Board edits (with this commit):** T-CMB-1 row re-scoped to combat tags + spec pointer;
  T-STAT-1 row gains the location-condition combat hooks note (Cursed attrition, Fortified
  AP tax, Besieged) as *its* consumption-side work, riding the `condMods` seam.
- Implementation plan: next step via the writing-plans flow → `docs/superpowers/plans/`.
