# HERETICS 40K — AGENT BACKLOG

**The single source of truth for who is building what.** Every agent reads this file
*first*, before touching anything else. The coordination rules that govern this board live
in `CLAUDE.md → Multi-Agent Coordination` — read them once per session.

- **Isolation model:** shared working folder, everyone commits to `main`. There is no
  structural wall — this board + the lane rule ARE the wall. Respect them.
- **Push is gated to Daak.** Agents never push. Mark a task `ready-to-push`; Daak pushes;
  then every agent re-syncs.
- **Session-link:** the `Owner` cell carries `sess:<uuid>`. Any agent can read a live
  session's work at `~/.claude/projects/-Users-daak-Projects-heretics-40k/<uuid>.jsonl`
  (`tail` it) to see what the owner is doing right now — without interrupting them.

---

## Lane legend

A task's **lane** is the set of files it will touch. Overlapping lanes collide.

| Lane | Files | Contention |
|------|-------|-----------|
| 🔥 `engine` | `index.html` | **HOT — only ONE `in-progress` task may hold it at a time.** Others wait in `open`/`blocked`. |
| `canon` | `heretics-40k-data-v1.json` | Warm — coordinate; prefer one editor at a time. |
| `tests` | `tests/**` | Cool — parallel-safe. |
| `docs` | `docs/**`, `*.md`, `*.pdf` | Cool — parallel-safe. |

**Design tasks to avoid the 🔥 lane when you can** (JSON-only / tests-only / docs-only work
runs fully parallel). If two tasks both need `index.html`, they serialize — that is the point.

## Status legend

`open` → `claimed` → `in-progress` → `ready-to-push` → `merged` &nbsp;·&nbsp; plus `blocked`, `paused`

---

## BOARD

### 🔥 engine lane (index.html) — serialize: only one `in-progress` at a time

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-FD1 | **Front Door + persistence backbone** — title screen (`CONTINUE` + "while-you-were-away" digest · `NEW COMMANDER` · `SETTINGS`; plain-verb/grimdark skin, **demo retired**), **single active profile** save = full-`S` serialize/hydrate behind a **storage-adapter seam** (`LocalStore` now → `RemoteStore` drop-in later), Settings (AI · save mgmt · export/import · about), and wire the built-but-dead **Founding rite** → `commitFounding(cc)`. Unblocks live accumulation the living-world tick + galaxy both defer as "needs Stage-2 persistence". | 🔥 engine + tests + docs | `in-progress` | frontdoor · sess:ceba401d-bd17-42e8-ba28-878c120b9d89 | 2026-07-20 | 🔥 LANE HELD. Building inline from `docs/superpowers/plans/2026-07-20-front-door-persistence.md` (9 TDD tasks). Pure SAVE core first (tests). Digest relocates to title (idempotent `catchUp`) — flag if living-world mid-edit. |
| T-BF4 | **Scout/aspect sight bonus** — `bfSetup` passes `0`; scan ability slots for scout/recon tag, pass `rules.grid.scout_sight_bonus` | 🔥 engine | `open` | — | — | Small once tag lookup settled; `Scout`/`Stealth` tags exist in GLOSS. |
| T-BF5 | **Deploy respec drill-in + freeze gating** — deploy tray opens model overview + Armoury equip; gate equip to `phase==='deploy'`, block on `state.locked` | 🔥 engine | `open` | — | — | Medium; reuses Barracks overview + Armoury flow. |
| T-BF2 | **Board from planet ⊕ location** — replace hardcoded `bfSetup` cfg with `bfBoardCfg(planetType,locationType,canon)` | 🔥 engine | `blocked` | — | — | **Blocked on T-GX galaxy accessors + `location_type.board` hint shape.** Safe default holds meanwhile. |
| T-NPC-2b | **NPC combat turn** — enemy AI picks moves+attacks via `reachable`/`spottedEnemies`/`bandOf`, stages a block, posts through `threadView`. Makes the enemy fight back. | 🔥 engine | `open` | — | — | No new engine surface needed — grid already exposes everything. |
| T-THR-1 | **Speaker-attributed thread log** — a readable in-thread speech/thought convention so conversations (NPC↔PC, OC↔OC, multiple models of one PC) are legible about *who says what to whom* | 🔥 engine | `open` | — | — | See the **Log formatting convention** block below for the full rule. High value, well-specced. |
| T-ENG-1 | **Throne Room world-ender** resolution (acknowledges but doesn't resolve) | 🔥 engine | `open` | — | — | Stubbed; needs design pass. |
| T-ENG-2 | **Trade escrow / dispute→combat** — Comms trade transfers gear with no escrow | 🔥 engine | `open` | — | — | Stubbed; Stage-2-adjacent. |
| T-ENG-3 | **Grid-aware Exit pursuit** — replace flat `enemySpd=3` heuristic with position/speed-ranked rule | 🔥 engine | `open` | — | — | Low priority polish. |

### canon lane (heretics-40k-data-v1.json)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-BF3 | **Move terrain/grid config into canon** — add `rules.grid` + `terrain_types`; helpers read from canon w/ current constants as fallback | canon + 🔥 engine + tests | `open` | — | — | Touches `index.html` too → takes the 🔥 lane. Coordinate the canon edit. |
| T-GX-G6 | **Wire G0 trait mechanics** — cross-Rift supply penalty, home-turf ruling trait, arrival & garrison scaling | canon + 🔥 engine | `blocked` | — | — | Blocked until authoring slices G1–G5 land the planet/location data. |

### canon + tests lane — galaxy authoring (parallel-safe per segmentum)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-GX-G1 | Author **Solar** segmentum planets/locations against the G0 minting contract | canon + tests | `ready-to-push` | galaxy · sess:406f1b0a-8f6e-4674-95ec-6d43178f11bd | 2026-07-20 | ✅ commit `3316733` · canon **v1.12** · 10 planets / 34 loc / 3 sectors · 121/121 tests. Reference done — validated the contract (fixed 2 spec errors: locations don't store `doors`; orbital stations allowed). **Template for G2-G5.** |
| T-GX-G2 | Author **Pacificus** segmentum | canon + tests | `in-progress` | pacificus · sess:970009ad-d34c-4f64-9a2d-cd52fc53aac8 | 2026-07-20 | CANON LANE HELD (one editor). Following G1 template `3316733` (no `doors` on locations; orbital stations OK). Extend `tests/canon.test.js`. |
| T-GX-G3 | Author **Obscurus** segmentum | canon + tests | `open` | — | — | |
| T-GX-G4 | Author **Tempestus** segmentum | canon + tests | `open` | — | — | |
| T-GX-G5 | Author **Ultima** segmentum | canon + tests | `open` | — | — | Enrich richer sectors toward the ~100-planet target. |

### docs lane (parallel-safe)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-DOC-1 | **Compendium PDF → v1.8** fold-in (battlefield grid + armour + slots already at 58pp; add tag registry + gear catalogs) | docs | `open` | — | — | `md-to-pdf`; source in `docs/superpowers/specs/`. |
| T-DOC-2 | Retire the standalone **screen-VIII prototype** doc/notes once the engine prototype is folded in | docs | `open` | — | — | Pairs with an engine polish task; docs half only here. |

---

## Log formatting convention (spec for T-THR-1)

The thread log needs to make **dialogue and inner life legible** — who is speaking, to
whom, and what a model is thinking — across NPC↔PC talk, two OCs, or several models of one
Commander in the same thread.

**The three signals:**

```
● **bold**      = SPOKEN WORD — anything said aloud: conversation, monologue, a shout,
                   a hail. If a model's mouth is making it, it's bold.
● *italics*     = INTERNAL THOUGHT — inner monologue, what a model (NPC or PC) is thinking
                   but not saying. Never heard by others in-fiction.
● speech COLOR  = SPEAKER IDENTITY — every model that can speak picks a colour on its
                   **model overview**; that colour tints its spoken (bold) lines so a
                   multi-speaker exchange is instantly attributable to the right mouth.
```

**Implementation shape (for whoever claims it):**
- **Colour is per-model instance state** (save-state `S`, not canon) — a `speechColor`
  field set from the model-overview overlay (a small swatch/picker next to the name).
  Default: assign a distinct colour per model on first speak, editable by the player.
- **Model overview:** add the colour picker; gate to models the player owns (NPC colours
  are authored/assigned server-side later — Stage 2/3).
- **Thread renderer:** when rendering a post, colourise `**bold**` runs with the speaking
  model's `speechColor`; leave `*italics*` in a neutral "thought" style (dimmed/muted, not
  colourised — thought has no audience). Plain text = narration/action, unstyled.
- **Attribution:** a post is authored by a Commander, but a single post may voice several
  of their models — so colour resolves per **speaker**, not per post. Consider a lightweight
  inline speaker tag (e.g. the model's colour swatch + name) when a post switches speakers.
- Keep it inside the existing `threadView` render path; no THREAD-core rule change needed
  (this is presentation, not state). Verify 0 console errors + a multi-speaker sample thread.

---

## DONE (recent — trim periodically)

| ID | Task | Merged |
|----|------|--------|
| T-BF1 | Wire terrain cover into the damage step (+ `tests/grid-damage.test.js`, 4 tests) | committed `cf6f266` · push pending |
| — | Battlefield grid slices A–E (engine v18) | shipped |
| — | Living-world tick + Digest (NPC Slice 2a, canon v1.11) | shipped |
| — | Catalog migration slices 1–3 (tags/gear/rosters, canon v1.8–v1.10) | shipped |
| — | Free-form slots + per-element armour (canon v1.7, engine v17) | shipped |
