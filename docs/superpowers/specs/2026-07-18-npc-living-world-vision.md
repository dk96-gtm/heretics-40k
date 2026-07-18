# NPC Living World — Vision & Decomposition

> **Status:** design north-star. Captures the full platform agreed in the 2026-07-18
> brainstorm, reconciled to shipped **engine v16 / canon v1.5**. Individual slices get
> their own detailed spec (see `## Slices`).
> **Constraint:** Stage 1 — two files ship (`index.html` + `heretics-40k-data-v1.json`),
> static GitHub Pages, no backend. Everything here must run client-side today and
> relocate to the Stage 2 backend later **unchanged in shape**.

## What this is

A living-world AI layer for Heretics 40K: persistent, faction-shaped NPC minds that
**talk, negotiate, fight, remember, move, and act in the background** — turning the
static sandbox into a world that *exists as players post*. This is the "AI-driven
NPC/referee layer" from CLAUDE.md's long-term vision (Stage 3), pulled forward into
Stage 1 via browser-direct calls with the player's own API key.

The vehicle is a summon: an NPC is prompted to write a forum post — but that post can be
in-character dialogue, a negotiation move, or a combat **action block**, and every
interaction updates the NPC's evolving mind.

## Two layers of AI determinism

```
FOREGROUND AI   in a thread, player present   — summon → post / fight → remember
BACKGROUND AI   between posts, off-screen      — the world-tick moves & acts NPCs
```

- **Foreground** is synchronous, player-triggered, one NPC (or one party on a front) per
  summon. Fully in slice 1.
- **Background** is the world-tick: lazy, batched, fired when the player advances time.
  Slice 2.

## The AI is a player, not a referee

The deterministic `THREAD` engine (**shipped in v16**, `index.html:473`) resolves **all**
mechanics — legality, AP, damage, element-timed revival, `no_revival` permadeath —
identically for PC and NPC across the combat types `SKIRMISH`/`INVASION`. The AI only
**chooses catalog actions + targets**; the engine's own `effFor`/`damageOf` staging path
(`index.html:1159`) turns those choices into effects, then `THREAD.validate`→`apply`
mutate state. It keeps combat fair, testable, and reuses the player's exact rails. The AI
is never trusted with math or fairness.

```
THREAD engine (deterministic, shipped)         AI (the NPC's mind)
catalog → validate → apply                      reads battle state + its force + intel
effFor/damageOf resolve amount/element/kill ◄── CHOOSES catalog actions + targets
same rules for PC and NPC                        behaviour matrix drives HOW it fights
```

## Stage-1 unlock: the client-side world-tick, powered by post-as-time

The world feels alive with **no server**. Real wall-clock buckets posts into time
blocks; the gap since last activity is measured in elapsed blocks/days; opening or
posting fires a lazy tick that catches the world up — "the world catches up when you
look at it" — and emits the **World Digest** (`"since you last posted…"`). Background
AI calls are batched and occasional (cost-controlled). When the Stage 2 backend lands,
the identical tick relocates server-side and becomes continuous + shared. Same shape.

## Subsystem decomposition

```
FOUNDATIONS  (everything depends on these)
 F1 · AI plumbing     browser-direct call · key/settings · grounding-bundle assembler
 F2 · NPC mind        persona + 3-frame matrix + tiered memory/dossier + drift
 F3 · Time model      post-as-time · 4 blocks × 2 phases/day · the tick spine
PLAYER-FACING LOOP
 P1 · Foreground talk  summon→post in Threads (social) + Map entry + Comms hailing
 P2 · Combat          NPC forces (canon) · infested planets · PvE/PvEvP · AI-as-tactician
LIVING WORLD
 W1 · Mobility        mobile locations (orbital stations) · travelling NPCs · position model
 W2 · Background sim   the world-tick · off-screen NPC actions · World Digest
CROSS-CUTTING
 A1 · Wireframe art    image placeholders across all surfaces (its own track, per CLAUDE.md)
```

```
DEPENDENCY ORDER
 F1 ─┐
 F2 ─┼─►  P1 ─►  P2
 F3 ─┘     └───►  W1 ─►  W2
 A1  ─ parallel art track ─
```

## Slices

- **Slice 1** — *Foundations + Foreground loop + Combat + Hailing.* F1 + F2 + F3 + P1 +
  P2. Detailed in `2026-07-18-npc-slice1-design.md`. Proves the entire spine end to end:
  find an NPC, talk or fight it, it remembers, time advances with every post.
- **Slice 2** — *Living world.* W1 (mobility) + W2 (background sim + World Digest). Builds
  on the slice-1 time spine and NPC mind.
- **Parallel** — A1 wireframe art. Its own conversation (per CLAUDE.md), not gating.

## Core models (summary — detail lives in slice specs)

- **NPC mind.** Persona (canon seed) + a **3-frame behaviour model**: *temperament*
  (5 axes: cunning · ferocity · pragmatism · honor · supremacism), *motivation*
  (`prime_drive`), *lens* (`worldview`). The matrix is a **distribution + physics**, not
  fixed values: per faction each axis carries `{base, spread, plasticity, floor,
  ceiling}`; each NPC is a unique sample that **drifts** through its lived history,
  clamped to faction bounds. Drift is gated to long-term-memory promotions and
  engine-clamped.
- **Tiered memory.** `recentJournal` (rolling, fades) + `longTermMemory` (durable,
  consolidated, never auto-dropped) + per-commander `dossier` (standing/facts/goals/
  grudges). Solves the "long-lived NPC gets dementia" problem.
- **Time.** Post-as-time; 4 blocks × 2 phases per in-game day; wall-clock buckets posts,
  the tick resolves the gap.
- **World Digest.** The player-facing output of the background tick (slice 2).

## Canon vs State law (the D/S split, unchanged)

| Lives in **canon** (`heretics-40k-data-v1.json`, `D`) | Lives in **save-state** (`S`, localStorage now → backend later) |
|---|---|
| persona blocks · behaviour matrix (distribution) · faction voice · AI directives + default model | per-NPC instantiated behaviour values + drift log |
| NPC force **templates** · planet-infestation templates | tiered memory (journal / long-term / dossier) |
| time constants (`block_minutes`, phase names) | NPC positions · live thread/combat state · retired-mind tombstones |
| location-mobility schedules (canon shape) | current in-game clock · last-tick marker |

Rule of thumb (from CLAUDE.md working rules): authored lore/mechanics → canon (bump
`meta.version`); evolving per-instance state → `S`; rendering/logic → `index.html`.
