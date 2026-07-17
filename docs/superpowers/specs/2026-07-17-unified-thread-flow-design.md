# Unified Thread Flow — Design

**Date:** 2026-07-17
**Status:** Approved, ready for implementation planning
**Scope:** Engine only (`index.html`). No canon change, no `meta.version` bump.
**Baseline:** engine v15, canon data v1.3

## Problem

Threads are the loop players live in, and there are four of them.

`openT(id)` dispatches on hardcoded thread IDs rather than on thread type:

| Branch | Builder | Posts stored | Action block | Sidebar | Exit |
|---|---|---|---|---|---|
| `id==='ash'` | `bBattle` | DOM only | Full AP builder | Battle report | Yes |
| `id==='bar'` | `bDiplo` | DOM only | 3 fixed buttons | None | No |
| `MISSION` unaccepted | briefing gate | — | — | None | Decline |
| else | `bGeneric` | `t.posts` | None | None | Yes |
| no thread | `bTravel` | Nowhere | None | None | No |

`bGeneric` is the only builder that treats a thread as data. The two richest
experiences — the Ash Ravine skirmish and the Carrion Bargain — are hand-built
demos. Their posts never reach `t.posts`, their combatants are literal HTML,
and their pools (`pool = 26`, `EN[]`) are module-level globals. Because they
cannot generalize, Travel — which canon defines as a real thread type spawned
by movement, where arrival procedures resolve — degraded into a single button
that decrements a counter.

The consequence beyond code tidiness: nothing a player does in a thread
changes anything. Posting an action block subtracts from a module-level
variable and appends a `<div>`. No wounds move. The battle report is a
tableau.

## Goals

1. One code path, one loop, every thread type.
2. Threads carry live state that posted action blocks actually mutate.
3. Travel and Diplomacy gain the loop they never had.
4. The demo content survives intact — converted to seed data, not deleted.
5. The state object is shaped as the thing Stage 2 will persist.

## Non-goals

- Ranked-speed pursuit (stub stays; this design unblocks it, doesn't fix it).
- Trade escrow / dispute→combat (gains an obvious home; not built here).
- AI thread summaries or referee adjudication (Stage 3).
- Art, scores/production persistence, throne-room world-enders.
- Any canon edit. Thread types, AP bands, desperation, and revival window
  already exist in data v1.3 — this design reads them, it does not add them.

## Decisions

Four decisions were taken during design, recorded here with their reasoning
so the implementation doesn't relitigate them.

**D1 — Redesign the loop, not just the plumbing.** Every type gets the same
spine; the action block becomes a pluggable module. Rejected: a
behavior-preserving refactor, which would leave the loops diverging for the
player while only helping the maintainer.

**D2 — The action block is ONE abstraction.** `actor → action → target →
cost → effect`, staged into a list, validated against a pool, attached to a
post.
Combat spends AP; diplomacy spends currency/influence; travel spends a leg.
A diplomatic offer *is* a costed, targeted commitment — the same shape as an
attack, wearing different clothes. One builder, one validator, one renderer;
types declare only their catalog and pool. Rejected: type-specific block
widgets on a shared spine (four widgets to maintain, and the abstraction
here is real rather than forced).

**D3 — Threads carry state.** Per-model wounds, distance bands, per-force
pools, plus type-specific fields. The sidebar renders *from* state. Rejected:
declarative-only blocks with cosmetic state, which leaves the battle report
dishonest and death/succession unable to fire.

**D4 — The poster asserts, the state applies.** A block declares its effect
(`Crushing Claws → Gharn, 4 dmg`) and state applies it: wounds really drop.
This is how play-by-post works — trust plus referee oversight — and the
existing demo block is already written this way. The Stage 3 referee becomes
a validator layered on top, not a prerequisite. Rejected: deferring damage
until the referee exists, which blocks death/succession indefinitely.

## Architecture

The ID dispatch is deleted. `openT(id)` loads a thread and renders one spine.
`bBattle` / `bDiplo` / `bTravel` / `bGeneric` cease to exist as builders; what
was valuable in them becomes data or catalog entries.

Five units. The dependency arrow points one way only.

```
  threadView  →  actionCatalog  →  threadState  →  threadModel
       ↓
  threadSidebar
```

| Unit | Purpose | Depends on | DOM? |
|---|---|---|---|
| `threadModel` | Create, seed, normalize a thread. Owns the canonical shape. | — | No |
| `threadState` | Init state from parties. Validate a block. Apply a block → new state. | `threadModel` | No |
| `actionCatalog` | Per type: `(thread, state, party)` → available actions. | `threadState` | No |
| `threadView` | The spine: header → posts → composer → block builder → post. Type-agnostic. | `actionCatalog` | Yes |
| `threadSidebar` | Party status, rendered from `state`. Generalizes the battle report. | `threadState` | Yes |

Nothing below `threadView` touches the DOM. The rules become testable without
a browser — the first time that is true in this codebase.

### The thread object

```js
{
  id, type, n, loc, about, initiator,
  vis: 'public' | 'private',
  turn: 'you' | <party>,
  accepted: <bool>,              // MISSION gate
  parties: [ ... ],
  forces: [ ... ],
  posts: [
    { who, body, tag, block: [ { actor, action, target, cost, effect } ] }
  ],
  state: {                       // NEW
    pools:      { "The Rotward": 26, "Sskarith's Brood": 14 },
    combatants: { <id>: { w: [4, 8], band: 'MELEE', conds: [], party } },
    joined:     <bool>,          // has combat begun — drives exit cost
    terms:      { ... },         // DIPLOMACY only
    legs:       { ... }          // TRAVEL only
  },
  summary
}
```

`state` is deliberately shaped as the object Stage 2 will persist. This design
is partly a schema rehearsal for the backend.

`state.joined` replaces the current guess in `exitThread`
(`type==='SKIRMISH' || type==='INVASION'`). That guess is why exit costs are
wrong today: a diplomacy thread that turns violent should cost you to flee,
and a skirmish where nobody has swung yet should not.

## The loop

Five beats, every thread, every type.

```
  ❶ OPEN     gate check → header (type, location, initiator, forces, about)
              ├─ private + not a participant → sealed
              └─ MISSION + not accepted      → briefing → accept / decline
  ❷ READ     posts render from t.posts. always. no DOM-only posts.
  ❸ COMPOSE  rich-text fiction. always present.
  ❹ BLOCK    optional — shown only when the type's catalog is non-empty.
              stage → validate against pool → attach
  ❺ POST     apply block to state → append post → turn passes → await
```

### Beat ❹ — one builder, four catalogs

| Type | Pool | Actor | Actions | Cost unit |
|---|---|---|---|---|
| `SKIRMISH`, `INVASION` | force AP | model | from equipped slots: Attack / Cast / Ability / Move | AP |
| `DIPLOMACY` | your currency | you | Offer · Demand · Accept · Walk away | currency / influence |
| `TRAVEL` | legs remaining | force | Transit post · Arrival challenge | 1 leg |
| `MISSION`, generic | none | — | catalog empty → no block rendered | — |

Combat's catalog is built from the model's equipped slots — the existing
`abmFor` logic survives here largely intact, as does `apMod` reading the AP
modifier from the item's own text. Movement remains 0 AP.

### The `effect` field — what the poster asserts

Per D4, a staged action carries the effect its poster claims. `cost` is what
you pay; `effect` is what you assert happens. `threadState.apply` reads
`effect` and mutates `state`.

```js
effect: { kind: 'damage',  amount: 4,  to: <combatantId> }   // wounds drop
effect: { kind: 'band',    to: 'SHORT', who: <combatantId> } // reposition
effect: { kind: 'cond',    add: 'Regen II', to: <id> }       // condition on
effect: { kind: 'slay',    to: <id>, intact: true }          // → revival_window
effect: { kind: 'terms',   agreed: true }                    // DIPLOMACY
effect: { kind: 'leg' }                                      // TRAVEL
effect: null                                                 // fiction only
```

Two constraints on this, both load-bearing:

- The UI **pre-fills** `effect` from the catalog entry and the item's own
  canon text wherever it can be derived. The poster is asserting, not
  free-typing arbitrary numbers into the state.
- `effect.kind: 'slay'` must route through the existing death and succession
  path including `rules.revival_window` — the killing element sets the
  window. This is the one place where a thread action reaches out of the
  thread, and it is why D3/D4 were worth taking.

### The validator

One function across all catalogs: **staged cost ≤ pool**, plus per-catalog
rules:

- Combat: per-model act limit (`wounds are actions`), once-per-post per
  action except Move.
- Diplomacy: one live offer at a time.

Exceeding the pool in combat does not hard-block — it surfaces
`D.rules.combat.desperation_action`, which the current builder already does
and which this design preserves.

## What falls out

These are consequences of the spine, not additional work.

**Travel becomes a real thread.** Canon defines Travel as spawned by movement
with arrival procedures resolving in-thread. Today: a button. With the spine:
a thread you write — transit posts carrying fiction, legs as the pool, the
arrival challenge as a catalog action. The type most improved by this work,
at no extra cost.

**Diplomacy stops being one hardcoded bargain.** Vess's
`Accept — 250 + 2 bodies` becomes a seeded offer in `state.terms` rather than
an `if (S.cur < 250)` inside a click handler. Any NPC can bargain. Trade
escrow gains an obvious later home.

**Exit and pursuit go honest.** `exitThread` reads `state.joined` instead of
guessing from type, and reads real wounds and speeds from `state.combatants`
instead of the hardcoded `enemySpd = 3`.

## Migration

The demos survive as seed data, not code.

| Today | Becomes |
|---|---|
| Sskarith's hardcoded opening posts | seeded `t.posts` on thread `ash` |
| Threshjaw 7/10 + Regen II, Gharn 4/8 (literal HTML) | seeded `state.combatants` |
| `pool = 26` (module global) | `state.pools["The Rotward"]` |
| `EN[]` (module global) | derived from `state.combatants` by party |
| Vess's `Accept — 250 + 2 bodies` handler | seeded `state.terms` on thread `bar` |
| `S.tr` transit object | a `TRAVEL` thread with `state.legs` |

**Migration success criterion:** the Ash Ravine plays *identically* on day one.
Then it plays *correctly* for the first time when you actually post.

## Verification

Per the project working rule — 0 JS errors, screens exercised, before commit.

- `threadState` is pure. TDD the validator and the apply function first, with
  no browser. That is where the rules bite.
- Playwright pass: every type opens · post with block · post without block ·
  private gate holds against a non-participant · mission accept → composer ·
  exit on both sides of `state.joined`.
- Regression: the Ash Ravine reads identically pre/post migration.
- `window` error capture across all 7 screens — threads reach into HQ,
  Map, and Barracks.

## Risks

**The abstraction is wrong.** D2 asserts that a diplomatic offer and an attack
are the same shape. If diplomacy's catalog starts needing escape hatches, that
is the signal the abstraction was forced. Mitigation: build combat and travel
catalogs first (most and least demanding); diplomacy third, as the real test.
A bad shared abstraction is worse than none — if it fails, fall back to D2's
rejected option for diplomacy only.

**Migration drift.** The Ash Ravine is the best content in the engine and it
is currently untyped HTML. Converting it to seed data risks quiet loss.
Mitigation: the identical-render regression check, done before any behavior
change lands.

**Scope creep into Stage 2.** `state` is shaped for persistence but this work
does not persist anything — it stays in the `S` save-state global. Resist
backend work here.
