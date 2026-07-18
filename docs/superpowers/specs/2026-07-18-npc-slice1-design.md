# NPC Living World — Slice 1 Design

**Foundations + Foreground loop + Combat + Hailing** (F1 + F2 + F3 + P1 + P2)

> Parent vision: `2026-07-18-npc-living-world-vision.md`.
> **Reconciled to shipped engine v16 / canon v1.5** (2026-07-18 push): the unified thread
> core is live (`index.html:473`) — combat types `SKIRMISH`/`INVASION`, `catalog`/
> `validate`/`apply`, and the human staging path `effFor`/`damageOf` (`index.html:1159`)
> are the real spine this slice plugs the AI into. v1.5 element-timed revival + `no_revival`
> permadeath feed NPC memory. See `## P2` for the exact binding.

## Goal

Prove the whole spine end to end, on a static Stage-1 app: **find an NPC → talk or fight
it → it remembers → time advances with every post.** After this slice a player can summon
a faction-true NPC in a thread, negotiate or fight a PvE/PvEvP engagement the deterministic
engine resolves, hail an NPC remotely, and see the in-game clock move.

### In scope

- F1 AI plumbing: browser-direct call, key entry + settings, the grounding-bundle
  assembler, one **single structured call** per summon.
- F2 NPC mind: persona canon block, 3-frame behaviour matrix (distribution+physics),
  tiered memory, drift.
- F3 Time model: 4 blocks × 2 phases, wall-clock bucketing, post stamping, phase
  ambience/combat hooks. (The background world-tick + World Digest are **slice 2** — this
  slice lays the time spine they sit on.)
- P1 Foreground talk: summon-to-post in Threads; Map as discovery/entry; Comms hailing.
- P2 Combat: NPC force templates, infested-planet garrisons, PvE + PvEvP, AI choosing
  catalog actions the shipped `THREAD` core validates and applies.

### Out of scope (explicit — deferred)

- W1 mobility (mobile locations, travelling NPCs) — slice 2.
- W2 background simulation + the World Digest — slice 2 (time spine seeded here).
- Binding trades / currency / territory transfer — Stage 2 persistence.
- Autonomous NPC initiation (an NPC hails *you* unprompted) — a seam is left, not built.
- Narrative **refereeing** (AI adjudicating outcomes) — the engine resolves; not the AI.
- Wireframe art — parallel track A1.

## Architecture: the grounding bundle

Everything the AI does is a function of one assembled bundle, built at click-time from
`D` (canon) + `S` (state) + the thread. **Assembly is pure and node-testable**; the AI
fetch is injected so assembly is exercised with zero network.

```
SYSTEM     AI directives (canon): 40K heretical tone · ruleset voice · "model" law
           · forum-post format · stay in-frame · combat-vs-social mode note
MATRIX     this NPC's instantiated behaviour values (5 axes) + prime_drive + lens
PERSONA    authored individual brief (canon)
MEMORY     longTermMemory (all) + recentJournal (last N) + THIS commander's dossier
SCENE      thread IC header + posts so far   (absent for a cold Comms hail)
PLACE      location type · planet-type EFFECT · conditions · current in-game phase
WORLD      public + relevant only, read through the NPC's lens:
           sector prosperity/conflict/taint · factions openly at war · active conflicts
           filtered by the NPC's knowledge_horizon; player force intel only if
           auspex/encounter rules already exposed it
COMBAT*    (SKIRMISH/INVASION only) the NPC party's force from state.combatants
           (model/loadout/w/band/conds) · known enemy combatants · AP pool
           state.pools[party] · the LEGAL ACTION LIST from THREAD.catalog(t,state,party,D)
```

## F1 — AI plumbing (engine only)

- **Call.** `fetch('https://api.anthropic.com/v1/messages', …)` with headers
  `x-api-key` (from `localStorage`), `anthropic-version: 2023-06-01`,
  `anthropic-dangerous-direct-browser-access: true`, `content-type: application/json`.
- **Model.** Default from a canon `ai` block; a Settings picker overrides. Default a
  mid-tier model (player pays per token) with a higher tier available.
- **Single structured call.** One round trip per summon returns a validated object (via
  the API's structured-output / `output_config.format`), not free text — schema below.
  Prompt-caching wired on the stable bundle prefix so the future streaming two-call
  variant costs ~nothing extra.
- **Settings surface.** Paste key · pick model · clear key. Key never leaves the browser.
- **Graceful degradation.** No key → summon button explains where to add it. API/parse
  error → readable message in the thread; the thread and save-state survive untouched.

### Single structured call — output schema

```
{
  post: string,                              // in-character forum post (dialogue OR combat narration)
  combatPicks: [ {action, target} ] | null,  // combat mode only — CHOICES from THREAD.catalog
                                             // (action = catalog label/index; target = enemy id / band / self).
                                             // The engine stages + resolves them. null in social mode.
  dossierDelta: {
    newJournalEntry: string,                 // always — feeds recentJournal (fades)
    promoteToLongTerm: string | null,        // when the NPC judges the event durably significant
    commanderUpdates: {                      // for the commander(s) it interacted with
      standing: int,                         // signed delta, clamped
      addFacts: string[], addGoals: string[], addGrudges: string[]
    },
    axisShift: { axis, delta, reason } | null  // only on a longTerm promotion; engine clamps to plasticity + floor/ceiling
  }
}
```

The engine **clamps** everything the model returns: `axisShift` to the axis's plasticity
window and faction floor/ceiling; `combatPicks` are staged via the *player's own*
`effFor`/`damageOf` path then run through `THREAD.validate` (an over-budget or illegal
move is rejected and re-prompted or dropped, never applied); `standing` to its range.
**The AI never authors a damage number or an effect — it only chooses catalog actions
+ targets.**

## F2 — NPC mind

### Canon additions (bump `meta.version`)

- Per NPC: a `persona` block — `voice`, `motivations`, `red_lines`, `tells`,
  `disposition_to_outsiders`, `knowledge_horizon` (`sectors`/`factions`/`themes` the NPC
  tracks). Named NPCs (the 5 placed in v1.3) may also carry an authored `behavior_seed`
  that pins their starting axis values (an authored soul).
- Per faction: `behavior_matrix` — the 5 axes each as `{base, spread, plasticity, floor,
  ceiling}`, plus `prime_drive` (string) and `lens` (string). Race/allegiance baselines
  (the 6 Chaos / 5 Imperial / 9 Xenos groupings) that factions inherit and override, to
  bound authoring to 20 faction rows.
- A top-level `ai` block — reusable system-directive text (tone/law/format) + default
  model. Authored as lore, editable without touching code.

### Behaviour model — distribution + physics

Axes: **cunning · ferocity · pragmatism · honor · supremacism** (0–100). Canon holds the
faction distribution; on first activation the engine **instantiates** an NPC into `S`:
each axis `value = base ± spread`, copying `plasticity`/`floor`/`ceiling`. Named NPCs seed
from their authored `behavior_seed` instead of rolling. Values then **drift** over life,
only via `axisShift` on a long-term-memory promotion, clamped to plasticity + bounds —
so a World Eater can harden or slightly soften but never fall below its ferocity floor.

### Tiered memory (in `S`)

```
S.npcState[npcId] = {
  behavior:   { [axis]: { value, spawn, plasticity, floor, ceiling, drift:[{t,±,cause}] } },
  recentJournal:  [ {t, text} ],                    // capped (~12), verbatim, FIFO
  longTermMemory: [ {t, summary, tags} ],           // durable, consolidated, never auto-dropped
  commanders:     { [cmdrId]: { standing, facts[], goals[], grudges[] } },
  position:       <locationId>,                      // present now; MOVES in slice 2
  retired:        false                              // set true on permadeath — mind can no longer be summoned
}
```

Bundle memory = `longTermMemory` (all — consolidated, so small) + last N `recentJournal`
+ this commander's `dossier`. Input stays near-flat as the NPC ages. Persisted to
`localStorage` so a mind survives reloads.

## F3 — Time model

- **In-game day = 4 blocks × 2 phases** (8 phases): Morning `[Early Morning, Morning]`,
  Noon `[Noon, Afternoon]`, Evening `[Evening, Night]`, Midnight `[Midnight, Dead of
  Night]`. Phase/block/day names + `block_minutes` (default **60**) live in a canon
  `time` block — one constant tunes world speed.
- **Clock.** Real wall-clock buckets each post into the phase its timestamp falls in.
  The clock advances ("clicks") on activity: the span between last activity and now is
  measured in elapsed phases/blocks/days. `S` holds the current in-game clock + a
  last-tick marker.
- **Deep integration now** (even before the background tick): every post stamps
  `Day N · <phase>`; phase drives ambience + combat modifiers (e.g. night-fighting);
  canon can key NPC availability / conditions to phases.
- **Seam for slice 2.** Crossing a block/day boundary is where the world-tick will fire
  and emit the World Digest. This slice computes elapsed time and exposes the boundary
  hook; it does not yet run background NPC actions.

## P1 — Foreground talk + hailing

- **Threads (primary).** A "Prompt [NPC] to respond" control in `threadView` (picker when
  2+ NPCs are present). Renders the NPC's post as a bylined forum post, marked AI-authored.
  Generic threads have an empty `catalog` (social-only) — dialogue posts, no action block.
- **Map (entry).** Click a location → NPCs present → open sheet + dossier (journal +
  standing toward you); "start a thread here with [NPC]". Discovery + entry only, no
  posting on the map.
- **Comms (hailing).** Remote hail reuses the same posting engine with a remote frame;
  the bundle's SCENE layer is empty/cold (no thread history), PLACE reflects remote
  distance. Same single structured call, same memory writes, no combat.

## P2 — Combat (AI-as-tactician) — reconciled to shipped v16

The shipped `THREAD` core makes combat concrete. Combat threads are **`SKIRMISH`** (fights)
and **`INVASION`** (planet assault → the PvE mode). The AI drives one **party** per summon;
that party's models live in `state.combatants[id]` (`{party, model, w:[cur,max], band,
dead, conds, killElement, revivalWindow, permaDeath}`) and its AP budget is
`state.pools[party]`.

- **Canon.** NPC **force templates** per faction/tier (models with loadouts, reusing the
  existing model/equipment canon → the `model.sl` slots `combatCatalog` reads) and
  **planet-infestation templates** (which planet holds what garrison, at what strength).
  A PvE assault seeds an `INVASION` thread with the garrison as the NPC party's combatants.
- **The loop — the AI is a player on the player's own rails.**
  1. Summon fires the single structured call in *combat mode*; the bundle's COMBAT layer
     carries the NPC party's force, known enemy, live battle state, AP pool, and the legal
     action list from `THREAD.catalog(t, state, party, D)` — `Attack - <weapon>` / ability
     / cast / use-item / `Move`, each with its AP `cost`.
  2. The model returns `combatPicks: [{action, target}]` — choices *from that catalog*,
     within `state.pools[party]`. Behaviour biases them: `ferocity` presses the attack,
     `cunning` manages distance bands, `pragmatism` disengages.
  3. The engine stages the picks through the **extracted** `effFor`/`damageOf` helper
     (the exact function the human composer uses at `index.html:1159`), producing real
     `{actor, cost, effect}` blocks — deterministic `damageOf`, `THREAD.elementOf`,
     `THREAD.isNoRevival`.
  4. `THREAD.validate` (AP budget) → `THREAD.apply` mutate state, then the block posts
     through the same `posts.push` path the player uses (`index.html:1244`). **The engine
     computes every outcome; the AI never authors a number.**
- **Death, revival & permadeath (v1.5) → memory.** `apply` stamps `killElement` +
  `revivalWindow` (element-timed: Physical/Energy 8, Heat/Corrosive/Plasma/Warp 3) or, for
  a `no_revival`/`Annihilation` source, `permaDeath`. These are maximal-salience events:
  a kill the NPC deals or suffers → `promoteToLongTerm` and usually an `axisShift`. A
  **permakilled NPC's mind is retired** (`S.npcState[id].retired = true`; its persona stays
  in canon; it can no longer be summoned).
- **PvE / PvEvP.** `INVASION` PvE = PCs vs one NPC garrison party. `PvEvP` = multiple NPC +
  PC parties in one `SKIRMISH`/`INVASION`; each NPC party is driven by its own mind/bundle.
  One summon resolves one NPC party's move.

## Engine changes (`index.html`)

- New pure region (marked, node-testable — same pattern as the `THREAD` core): the
  **grounding-bundle assembler**, **world-scoping** (public+relevant filter),
  **dossier-merge/clamp**, **behaviour instantiate + drift-clamp**, **time math**
  (bucket/elapsed/stamp). Reads no globals; canon/state/thread arrive as arguments.
- **Extract the block-staging path.** Lift `effFor` + `damageOf` out of the DOM closure
  `threadBlockBuilder` (`index.html:1142`) into a shared, pure `stageBlock(t, party,
  picks, D)` so the human composer *and* the AI produce byte-identical `{actor, cost,
  effect}` blocks. This is the one refactor to the shipped v16 combat path; it changes no
  behaviour for the player (the builder calls the extracted helper).
- The **AI-call module** (impure — `fetch`, key, model): injected into the summon flow so
  the pure assembler is tested without network.
- DOM wiring: summon control in `threadView`; NPC dossier in the NPC overview overlay;
  Settings key/model panel; post in-game stamp rendering; the NPC's staged combat block
  posts through the same `THREAD.validate`→`apply`→`posts.push` path the player uses
  (`index.html:1233`).

## Canon & state change summary

- **Canon (`heretics-40k-data-v1.json`, bump `meta.version`):** per-NPC `persona`
  (+ optional `behavior_seed`); per-faction `behavior_matrix`; top-level `ai` block;
  `time` block; NPC force templates; planet-infestation templates.
- **State (`S`, persisted to `localStorage`):** `S.npcState[npcId]` (behaviour values +
  drift, tiered memory, dossier, position, retired flag); in-game clock + last-tick
  marker; NPC combat parties seeded into thread `state.combatants`/`state.pools`.

## Error handling / graceful degradation

- Missing/invalid key → non-blocking notice at the summon point; no call made.
- API error / network fail → readable in-thread message; thread + `S` untouched.
- Structured-output parse/validation fail → one retry, then a graceful "the NPC does not
  respond" with the error surfaced; never a broken thread or corrupt `S`.
- Illegal/over-budget `combatPicks` → rejected by `THREAD.validate` after staging;
  re-prompt once, else drop the move (the NPC "hesitates"). The engine is authoritative;
  a bad AI choice can never produce an illegal game state.
- Every mutation to `S` (memory, drift, standing, clock, retired) is clamped and validated
  before write.

## Testing

- **Pure functions → Node built-in test runner** (zero deps, dev-only `tests/`, same as
  the existing `thread-core` gate): bundle assembly, world-scoping, dossier merge/clamp,
  behaviour instantiate + drift-clamp (respects plasticity + floor/ceiling), time
  bucket/elapsed/stamp, structured-output shape validation. **Block parity:** feeding the
  same `combatPicks` through the extracted `stageBlock` yields the identical
  `{actor, cost, effect}` block the human composer produces, and over-budget picks are
  rejected by `THREAD.validate`. **Permadeath memory:** a `no_revival` kill produces a
  `promoteToLongTerm` + `axisShift` and, when the victim is an NPC, retires its mind.
- **Browser (Playwright MCP)** with a **stubbed key + mocked `fetch`** returning a canned
  structured response: exercise summon → post → memory write → in-game stamp, and an
  `INVASION` PvE move (stage→validate→apply→battle report) — 0 JS errors, each affected
  screen exercised before commit, per CLAUDE.md's verification norm.
- Canon well-formedness test (extend the existing `canon.test.js`): every NPC has a
  persona; every in-play faction has a full `behavior_matrix`; force/infestation templates
  reference valid models/locations.

## Open tunables (one-line, safe to flip after playtest)

- `time.block_minutes` (default 60) — world speed.
- Default AI model in the `ai` block.
- `recentJournal` cap (default ~12).
- Behaviour `spread`/`plasticity` magnitudes per faction.
