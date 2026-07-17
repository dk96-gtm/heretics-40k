# HERETICS 40K — CLAUDE.md

Project context and orientation for anyone (human or AI) working in this repo. Development lives here now; the Notion workspace is a read-only design archive.

**Live:** https://dk96-gtm.github.io/heretics-40k/ · **Repo:** github.com/dk96-gtm/heretics-40k (public)
**Current state:** engine **v15**, canon **data v1.3** — deployed and running.

## What this is

Heretics 40K: a persistent play-by-post forum wargame in the Warhammer 40K universe with a custom ruleset. Players are Commanders who build armies of individual models, fight and negotiate in typed forum Threads, and conquer territory on a galaxy map. Long-term vision: a forum "videogame" with custom menus and an AI-driven map/NPC/referee layer.

**Terminology law: it is always "model", never "chassis".** Applies to all rules text, UI copy, code, and data.

## Architecture — two files

The game = DATA + ENGINE. Nothing else ships.

- `heretics-40k-data-v1.json` — **THE CANON.** Single machine-readable source of truth: rules constants, factions, models, equipment, galaxy, travel, location types, doors, conditions, planet-type effects, NPCs. All lore/mechanics changes are edits here; bump `meta.version`. The filename stays `...-v1.json` across the whole v1.x series — the real version is `meta.version`; git carries history.
- `index.html` — **THE ENGINE.** Zero embedded canon. Fetches `./heretics-40k-data-v1.json` on load (into global `D`) and renders everything from it. Contains rendering logic, rules execution, and the demo **SAVE-STATE** (global `S`: player roster, forces, threads, world overlays). Save-state is game *state*, not canon — the part a backend replaces in Stage 2.
- Both files sit in the same folder, served over HTTP. `file://` blocks the fetch; the boot screen says so.

## Deploy & iteration workflow

- **Local test:** `python3 -m http.server 8765` in the repo, open `localhost:8765`. Browser-test with the Playwright MCP; every round is verified with `window` error capture + exercising each screen before commit.
- **Deploy:** commit, then push. GitHub Pages rebuilds in ~1 min and serves the new files.
- **⚠ `git push` is gated for the assistant in this environment** — it must be run by the user (they type `! git push`, or run it in their own terminal). The assistant commits; the user pushes.
- **⚠ JSON cache gotcha:** the engine fetches a fixed filename, so browsers cache the JSON. After a canon change, the local rail may show the old version until cache clears; the live CDN serves fresh to new sessions. Verify canon changes on the live URL, not a warm local tab.
- Git identity on this repo uses the GitHub noreply email (no personal email in history).

## What is IN canon (data v1.0 → v1.3)

- **Rules constants:** AP bands (PC→AP), Named/Commander premiums & deltas, rank growth curves (`rules.growth`: PC ×1.0/1.4/1.9/2.5/3.2, wounds %/rank by class, speed/slot gains), combat framework, death & succession (+ `revival_window`), economy, Force size tags, thread types, comms, both rites.
- **20 factions** (6 Chaos / 5 Imperial / 9 Xenos) each with backgrounds, appearances, origin perks, currency, and alpha model subsets (3 each).
- **v1.1 — location system:** `location_types` (16 standard + 5 faction-specific), `doors` (11 kinds with per-faction skins), `conditions` (9), `planet_types` (20, each with a prod_mult + a unique EFFECT), `population_ranks` (6 grouped ladders), `status_readings` (one state, three allegiance readings), `status_effects`, `scores`/`thread_scales`/`world_enders` (specced; need Stage 2 persistence to run live). Death `revival_window` (killing element sets the window; body must reach an Apothecarion in time).
- **v1.2 — Orbit & Space:** every planet has an Orbit location (tier `orbit`, holds ships); every sector has a `space` layer.
- **v1.3 — NPCs:** 5 placed NPCs with overview sheets.
- Alpha galaxy: Vigilus Sector, Pallid Reach, Kraith Drift populated; rest sealed. Travel ladder + Travel-Thread arrival. Alpha equipment + forge tags.

## What the ENGINE does (built across v6 → v15)

- **7 screens:** Rites of Creation, Commander HQ, Barracks (Roster / Armoury / Forces tabs), Requisition, Map, Threads, Comms.
- **Model as a first-class entity:** full overview overlay (framed portrait, stats incl. Kills, lore, threads fought, loadout grouped by slot-type, rank-development table). Reachable from Barracks, HQ (leader switcher), battle state, forces.
- **Universal inspection:** game-wide hover tooltips (tier-aware, with durations) via `GLOSS`/`annotate`; callable entity cards for any weapon/item/ability/cast via `parseItem`/`itemStatsHTML` (full labeled stats + plain-language tag descriptions).
- **Armoury:** columns table of all owned gear (equipped/in-store) with filters.
- **Forces:** raise/edit/disband, member management, total AP+CP, active-in-thread locking, leader-tag rule, creation gated to non-active leaders.
- **Floating profile HUD:** compact static bar on every non-HQ screen.
- **Requisition:** all 11 door types functional (shop/altar/reliquary catalogs + cart + sell; forge; muster; apothecarion; shipyard; relay; arena; warp gate; throne room). Location gating + closed-door reasons. Door demo mode.
- **Map:** procedural charts at galaxy/segment/sector levels; readable sector header (Prosperity/Conflict/Taint meters); Orbit vs Surface split; Deep Space as a travelable node; clickable location panel (doors → requisition, forces → auspex intel, history → summaries, NPCs → sheets); in-location "start a thread" / "enter requisition".
- **Threads:** IC headers (location, initiator, forces, about); public/private with participant gating; thread board (accepted + objectives, available, sector conflicts); forum view (scrollable posts, pinned composer, foldable battle report); mission accept → reader+composer; Exit + costs + pursuit; one-Force-per-thread.
- **Comms:** remote hail; unsafe trade (transfer currency/item); publish conversation as Protocol; NPC approach-in-person when co-located.
- **Force intel / auspex:** encountered forces show last-known composition.

## First-pass / stubbed (need deepening or Stage 2/3)

These are functional but not the deep versions — flagged in-UI where relevant:
- Exit **pursuit** uses a simple speed comparison, not the full ranked-speed rule.
- **Trade** transfers gear but has no escrow / dispute→combat resolution.
- **AI thread summaries** are templates (real AI is a Stage 3 / backend + API feature).
- Throne Room world-enders and Warp Gate travel acknowledge the action but don't resolve — they depend on the thread/travel rebuilds.
- **Scores/production/resources** (the flywheel) are specced in canon but need persistence (Stage 2) to actually accumulate; the map shows demo constants.
- **Art:** all image slots (portraits, door/location/space art, map card backgrounds) are wireframe placeholders. Filling them is its own conversation (procedural vs asset-pack vs generated).

## Open design question (parked)

A **unified thread flow** — one consistent loop (open → read → compose, with an optional action block → post → await reply) across battle / diplomacy / generic threads, which currently behave differently. Worth a deliberate brainstorm rather than more incremental patching.

## Roadmap

- **Stage 1 (now):** local project + static GitHub Pages deploy. Single-player sandbox; iterate here.
- **Stage 2:** persistence backend (Supabase/Firebase class) — accounts, shared world, real threads. The data file becomes server seed content; the flywheel scores go live.
- **Stage 3:** AI layer — NPC posting + Action Block refereeing + real thread summaries via API.

## Still un-migrated from Notion (canon not yet extracted)

The full catalogs still live only on the Notion archive and have NOT been pulled into the data file:
- Full 5-model rosters (100 statted models) — "Base Model Rosters"
- ~100 weapons + Tag Registry + Named/Legendary — "Tags" / "Basic Weapons" / "Named Weapons"
- Full items (75) + abilities (55) — "Basic Items" / "Named & Legendary Items" / "Abilities"
- Full casts (8 families) — "Warp Casting"
- Minted planets / populated map / territory ownership — "Galaxy & Territory — v1"

## Notion archive pointers

Main hub: notion.so "Heretics 40K" (1680ced7-f13e-8005-8062-cf936daaab13) — Allegiances / Thread Types / Model Overview / Elements / Planet Types. Key children: Workbench · Models (Evolution System, growth curves) · Base Model Rosters · Tags / Basic Weapons / Named Weapons · Basic Items / Named & Legendary Items · Abilities · Warp Casting · Commander · Galaxy & Territory — v1 · Experience & UI — Design v1 · Game Build — Foundation (ARCHIVED; holds the original data v1.0 + engine v6 handoff) · TO DO.

## Working rules

1. Canon changes → edit the data file, bump `meta.version`. UX/logic changes → engine only. The two append independently.
2. Every iteration is a git commit; verify in-browser (0 JS errors, screens exercised) before committing; the user pushes.
3. The Notion workspace is frozen as archive — consult it for un-migrated catalogs and rationale; do not develop in it.
