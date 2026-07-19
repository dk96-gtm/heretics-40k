# Living-World Time Architecture — Design (NPC Slice 2)

**The deterministic world-tick that makes the galaxy advance in real time — realized in Stage-1 as a lazy catch-up on load, the same tick relocating to the Stage-2 server unchanged in shape.**

> Parent vision: `2026-07-18-npc-living-world-vision.md` (this is its **Slice 2 — Living
> world: W1 mobility + W2 background sim + World Digest**). Reconciled to canon **v1.10**
> (sibling session migrated tags/gear/rosters through v1.8–v1.10 concurrently). Builds on
> the shipped Slice-1 time spine: `NPCAI.stampAt/between`, `S.time = {epoch, blockMinutes}`,
> per-post phase stamping, and the 5-axis behavior seeds in `npcs_alpha`.

## Goal

Answer the foundational question — *what is the galaxy doing while no one is interacting?* —
with a **fully deterministic day-tick**: NPCs pursue goals, territory changes hands,
production and taint move, all as cheap replayable math. On open, a lazy catch-up runs the
ticks that elapsed since last visit and shows a **World Digest** ("since you last looked…").
The world feels alive in Stage-1 with **no server and zero AI cost**; when the Stage-2
backend lands the identical tick becomes continuous and shared.

### Locked decisions (from brainstorm 2026-07-19)

| # | Decision |
|---|---|
| Master clock | **Ⓐ real-time master** — wall-clock anchors the world; Stage-1 via lazy catch-up on load. |
| Tick cadence | Per **in-game DAY** (= 4 real hours at 60-min blocks). Display clock stays at phases. |
| Determinism | Background tick is **100% deterministic** — $0, no API key, replayable. AI stays **foreground-only** (player-present summons). |
| NPC agency | **Goal + utility**, scored through the 5 behavior axes + situation. No RNG. |
| Offline shield | Your **models are safe** (never die in absentia); your **territory is contestable** (siege / hold%). |

### In scope

- Pure DOM-free `WORLD` tick core (`catchUp` / `stepDay` / `npcDecide` / `resolveAction` /
  `digest`), node-tested like `THREAD`/`LOADOUT`.
- Deterministic day-tick: production, taint/sector-stat drift, NPC agency, sieges, thread-
  timer expiry — each emitting a typed event.
- Goal+utility NPC decision model driven by the existing behavior axes.
- Territory siege model (hold%; land flips, models retreat, never die).
- Catch-up on boot with a bound + compression for long absences.
- World Digest panel (relevance-ordered, templated) + a persisted scrollable log.
- Thread response timers (24/48/96/Open, real-hours, anchored to last post) evaluated in the
  tick; expiry flags the double-post entitlement (visual only).
- Canon block for tick rates/rules; save-state for `lastTick`, overlays, event log.

### Out of scope (explicit — Stage-2 or later)

- The **always-on server tick** (world advancing with nobody logged in; shared across
  players) — the whole point of Stage-2; a seam is left, not built.
- **Enforced** double-posts / miss penalties — Stage-2 with real opponents.
- **PvP action rate-caps** — single-player fairness is inherent (see §7).
- **AI-narrated digest flavor** — the "batched + occasional" option from the vision; the
  digest is templated for now.
- **Real territory/production data** — the flywheel binds to demo world-overlays (`S.world`)
  until the map/territory migration (vision/CLAUDE.md **migration slices 4–6, not started**)
  lands; the tick reads whatever territory model exists.

## Architecture

### Unit 1 — Pure `WORLD` tick core

A new `/*<world-core>*/ … /*</world-core>*/` region in `index.html`, DOM-free, canon + state
passed as arguments, extracted-and-eval'd by a `tests/_load-world.js` mirror of `_load.js`.

```js
WORLD.catchUp(state, canon, nowMs) → { events:[…], ticks:Number, compressed:Number }
  // mutates `state` in place; returns the event log for the Digest.
  dayMs      = (canon.tick.day_minutes||240) * 60000
  elapsed    = floor((nowMs - state.time.lastTick) / dayMs)
  run        = min(elapsed, canon.tick.max_catchup_days||30)
  for i in 0..run:  stepDay(state, canon, events)
  compressed = max(0, elapsed - run)            // summarized, not simulated
  state.time.lastTick += elapsed * dayMs         // consume ALL elapsed time
  return { events, ticks: run, compressed }

WORLD.stepDay(state, canon, events):
  produce(state, canon, events)     // holdings → resources
  driftStats(state, canon, events)  // taint accrues; Prosperity/Conflict/Taint move
  for npc in activeNpcs(state):      // deterministic order (by id)
    act = npcDecide(npc, state, canon)
    resolveAction(npc, act, state, canon, events)
  advanceSieges(state, canon, events)
  checkThreadTimers(state, canon, nowMsOf(state), events)
```

`lastTick` advances by the **full** elapsed time even when catch-up is capped, so the clock
never falls permanently behind (the excess is compressed into a digest summary, not lost).
Idempotent: calling `catchUp` twice with the same `nowMs` does nothing the second time
(`elapsed` = 0).

### Unit 2 — NPC utility model (deterministic)

```js
WORLD.npcDecide(npc, state, canon) → { verb, target }
  goal   = goalOf(npc)                     // from prime_drive/motivations →
                                           //   'expand' | 'profit' | 'purge' | 'hold'
  legal  = legalActions(npc, state)        // move · seize · raid · trade · fortify · produce
  score  = a => utility(a, npc.behavior, situation(npc, state), goal)
  return argmax(legal, score)              // ties broken by a stable key → replayable
```

Axis→verb weighting (the seeds finally drive the world):

| Axis high | pulls toward |
|---|---|
| ferocity | raid, seize |
| supremacism | expand (claim new ground) |
| cunning | trade, opportunistic seize of the weakest target |
| pragmatism | fortify, produce (bank strength) |
| honor | keep pacts; avoid raiding allies / backstab |

No `Math.random` (banned in the pure core anyway). Any needed variation is derived from
`(npc.id, tick index)` so a replay of the same elapsed window yields the same world.

### Unit 3 — Territory & siege (from the offline-shield decision)

```
each holding overlay carries: { owner, hold: 0..100, siege: null | {by, rate} }
stepDay:
  a besieger with power > garrison starts/continues a siege →
    hold -= canon.tick.siege_rate  (slowed by fortification tier)
  hold <= 0  → land flips to besieger; the losing owner's MODELS retreat to a
               safe holding they still control (they NEVER die in absentia)
  owner present & acting → may reinforce (hold += ) or lift the siege
```

Player holdings: **models are shielded** (retreat, never die) but **land is live** — you can
return mid-siege and act. NPC-vs-NPC sieges resolve the same way. Abstract power comparison
only — full `THREAD` combat is reserved for when a player is present (foreground).

### Unit 4 — Catch-up bounds & the World Digest

- **Bounds:** `min(elapsed, max_catchup_days)` ticks simulated; the remainder is compressed
  into one summary event ("Over the ~N cycles before that, the frontier settled…"). Prevents
  a year-away visit from running thousands of ticks. Logged, never silent (per repo norms).
- **Digest:** on load, if `ticks > 0`, render a dismissible panel, relevance-ordered:
  1. **⚠ Your holdings & threats** — sieges on you, land lost/retaken, forces displaced.
  2. **Notable faction moves** — seizures, new sieges, trades among NPCs you know.
  3. **Ambient** — production banked, taint/stat drift.
  Templated from the typed event log. Also appended to a persistent, scrollable **World Log**
  (surfaced in Comms or HQ) so nothing is lost on dismiss.

### Unit 5 — Thread response timers (folded in)

```
t.timer = { window: null | 24 | 48 | 96 }        // hours; null = Open (default)
posts stamped with ms; anchor = last post ms (or thread create ms)
deadline = anchor + window*3600000               // resets every post
checkThreadTimers (in stepDay, and on render):
  now > deadline & window set → t.timer.expired = true
  entitled = side opposite t.turn  (the side being waited on gains a double-post credit)
  → VISUAL badge + entitlement only; no enforcement (Stage-2). Countdown shown on the
    thread board (index.html:1403) and thread-view header; a [24h][48h][96h][Open]
    picker on thread creation.
```

## Canon vs State (canon → next bump, **v1.11+** on the v1.10 baseline)

```
CANON (heretics-40k-data-v1.json)
  tick: {
    cadence: "day", day_minutes: 240, max_catchup_days: 30,
    production_rate: …, taint_rate: …, siege_rate: …,
    npc_action_menu: […], utility_weights: { axis→verb },
    thread_response_windows: [24, 48, 96]           // + Open (null) default
  }
STATE (S, localStorage → backend)
  S.time.lastTick (ms) · territory overlays {owner,hold,siege} · NPC positions/goals ·
  world event log · pending digest · per-thread t.timer
ENGINE (index.html)
  /*<world-core>*/ WORLD {…} · catchUp() call on boot after migration · Digest renderer ·
  thread-timer UI (board + header + creation picker)
```

> **Data dependency:** production/territory need the populated map (migration slices 4–6,
> not started). Until then the tick operates on the existing demo `S.world` overlays and
> demo constants; the flywheel goes fully live when territory canon lands. The tick's shape
> does not change when it does.

## Data flow

```
boot ─► migrate ─► WORLD.catchUp(S, D, now)
                      │   stepDay × ticks (deterministic)
                      ├─► mutates S: overlays · positions · resources · timers
                      └─► events[] ─► Digest panel + World Log
player acts in a thread ─► post ─► foreground AI (unchanged) ─► timers reset
```

## Error / edge handling

- `lastTick` missing/future (clock skew) → treat elapsed as 0; never simulate negative time.
- `max_catchup_days` cap always advances `lastTick` by full elapsed → no permanent drift.
- Siege on a holding with no garrison data → treated as hold-only, no crash (fail-safe).
- Digest with zero events → no panel (silent, expected).
- Thread with `window:null` → no timer, no badge (Open is the default and the no-op).
- Determinism guard: the pure core uses no `Date.now`/`Math.random`; `nowMs` is an argument.

## Testing

- **Pure `tests/world-core.test.js`** (`node --test`): elapsed→ticks math + idempotency;
  cap + compression advances `lastTick` fully; `npcDecide` picks the axis-consistent verb
  (ferocity-high → seize; cunning-high → trade); siege reduces hold then flips at ≤0 with
  models retreating (not dying); Open timer = no expiry; expired timer flags entitled =
  opposite of turn; production/taint accrue by rate.
- **Boot proxy** `engine-syntax.test.js` still compiles the inline script.
- **In-browser (pre-commit):** set `S.time.lastTick` back N days, reload, confirm the Digest
  renders relevance-ordered, a border siege appears, resources/taint moved, 0 console errors;
  a thread with a 24h window shows a live countdown and an EXPIRED badge when back-dated.

## Suggested implementation sub-slices

1. **2a — Tick spine + Digest:** `WORLD` core (`catchUp`/`stepDay`/`produce`/`driftStats`/
   `digest`), catch-up on boot, Digest panel + World Log, canon `tick` block. (No NPC agency
   yet — stepDay runs production/taint only.) Tests + browser verify.
2. **2b — NPC agency + sieges:** `npcDecide` utility model, `resolveAction`, `advanceSieges`,
   territory overlays, offline shield. Tests + browser verify.
3. **2c — Thread timers:** `t.timer`, creation picker, board + header countdown/expiry,
   `checkThreadTimers`. Tests + browser verify.

Each sub-slice is JSON+own-code where possible to minimize collision with the sibling
session on `index.html` (see memory: concurrent-sessions-share-main).
