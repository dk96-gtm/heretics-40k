# HERETICS 40K — CLAUDE.md

Project context and orientation for anyone (human or AI) working in this repo. Development lives here now; the Notion workspace is a read-only design archive.

**Live:** https://dk96-gtm.github.io/heretics-40k/ · **Repo:** github.com/dk96-gtm/heretics-40k (public)
**Current state:** engine **v17**, canon **data v1.7** — deployed and running.

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

## Multi-Agent Coordination

**Multiple agents build this repo at once, sharing ONE working folder and committing to `main`.**
There is no branch isolation (one folder = one git HEAD; switching branches yanks every
session). So the discipline below IS the safety layer. The live board is **`BACKLOG.md`** at
the repo root — read it first, every session.

**The lifecycle:** `open → claimed → in-progress → ready-to-push → merged` (+ `blocked`, `paused`).

1. **Sync first.** `git pull` (or check `git log`) to get the newest `main` + newest `BACKLOG.md`
   before doing anything. Re-sync periodically — watch for upstream commits that touch *your* files.
2. **Claim before you work.** Pick an `open` task whose **lane is free**, edit *only its row* in
   `BACKLOG.md` → `status`, `owner` = `<name> · sess:<your-session-uuid>`, timestamp. Then
   `git add BACKLOG.md` (never `-A`) → commit `backlog: claim <ID>`. **First commit wins** — if it
   conflicts, someone beat you; pull and pick another task.
3. **Respect lanes.** A task's lane = the files it touches (see `BACKLOG.md` lane legend). 🔥 **The
   `index.html` (engine) lane is HOT — only ONE `in-progress` task may hold it at a time.** Others
   wait. JSON-only / tests-only / docs-only lanes run fully parallel. Design tasks to avoid the hot
   file when you can.
4. **Commit hygiene (this is what makes an accidental sweep harmless):**
   - **`git add <explicit paths>` — NEVER `git add -A` / `git add .`.** That command sweeps other
     sessions' work into your commit (verified: it has stolen whole commits + messages here).
   - Commit promptly and **keep the tree test-passing (`node --test`) at every pause** — a swept
     clean tree is merely misattributed, not broken.
5. **Session-link.** Your claim's `sess:<uuid>` lets any other agent read your live progress at
   `~/.claude/projects/-Users-daak-Projects-heretics-40k/<uuid>.jsonl`. Blocked on someone's lane?
   Read their session instead of guessing or interrupting.
6. **Push is gated to Daak.** When a task is verified done, set it `ready-to-push` in `BACKLOG.md`
   and list the exact paths in your commits. **Do not push.** After Daak pushes, **every agent
   re-syncs** (`git pull`) before continuing — post-push drift (local `main` behind remote) is the
   other known hazard.
7. **Finish the row.** On merge, move the task to the DONE table (trim it periodically).

## What is IN canon (data v1.0 → v1.5)

- **Rules constants:** AP bands (PC→AP), Named/Commander premiums & deltas, rank growth curves (`rules.growth`: PC ×1.0/1.4/1.9/2.5/3.2, wounds %/rank by class, speed/slot gains), combat framework, death & succession (+ `revival_window`), economy, Force size tags, thread types, comms, both rites.
- **20 factions** (6 Chaos / 5 Imperial / 9 Xenos) each with backgrounds, appearances, origin perks, currency, and alpha model subsets (3 each).
- **v1.1 — location system:** `location_types` (16 standard + 5 faction-specific), `doors` (11 kinds with per-faction skins), `conditions` (9), `planet_types` (20, each with a prod_mult + a unique EFFECT), `population_ranks` (6 grouped ladders), `status_readings` (one state, three allegiance readings), `status_effects`, `scores`/`thread_scales`/`world_enders` (specced; need Stage 2 persistence to run live). Death `revival_window` (killing element sets the window; body must reach an Apothecarion in time).
- **v1.2 — Orbit & Space:** every planet has an Orbit location (tier `orbit`, holds ships); every sector has a `space` layer.
- **v1.3 — NPCs:** 5 placed NPCs with overview sheets.
- **v1.4 — Travel passage-cost model:** `travel` tiers gain `base` + `words`, a `force_divisor` (250), the finer `same_sector_space` rung, and an explicit Warp-Gate waiver. Passage = `tier.base × (force total PC ÷ force_divisor)`; free through a Warp Gate.
- **v1.5 — Element-sourced revival + no-revival:** `rules.death.revival_window.windows` retuned to travel time (Physical/Energy 8, Heat/Corrosive/Plasma/Warp 3 — harsh minimum = same-sector ride + 1); a `no_revival` tag set (+ an `Annihilation` forge tag) whose kills are permanent.
- **v1.7 — Free-form slots + per-element armour:** `rules.loadout` (universal player-typed slots — no fixed weapon/item/ability split), `rules.growth.slot_gains_by_rank` (numeric slot growth), `rules.armour` (per-element Defense; a hit deals `max(0, dmg − def[element])`, corrosive-bypass expressed as data), a galaxy-wide `armour` catalog (143 pieces: 20 factions × class defaults + Light/Med/Heavy ladders + universal baseline), a 12th **Armoury** door, and a Forge `armour_upgrade` path (+1 Defense/element per tier I–III).
- Alpha galaxy: Vigilus Sector, Pallid Reach, Kraith Drift populated; rest sealed. Travel ladder + Travel-Thread arrival. Alpha equipment + forge tags. (No planet has a charted Warp-Gate/webway location yet — free gate travel is plumbed but has no destinations until portals are minted.)

## What the ENGINE does (built across v6 → v16)

- **7 screens:** Rites of Creation, Commander HQ, Barracks (Roster / Armoury / Forces tabs), Requisition, Map, Threads, Comms.
- **Model as a first-class entity:** full overview overlay (framed portrait, stats incl. Kills, lore, threads fought, loadout grouped by slot-type, rank-development table). Reachable from Barracks, HQ (leader switcher), battle state, forces.
- **Universal inspection:** game-wide hover tooltips (tier-aware, with durations) via `GLOSS`/`annotate`; callable entity cards for any weapon/item/ability/cast via `parseItem`/`itemStatsHTML` (full labeled stats + plain-language tag descriptions).
- **Armoury:** columns table of all owned gear (equipped/in-store) with filters.
- **Forces:** raise/edit/disband, member management, total AP+CP, active-in-thread locking, leader-tag rule, creation gated to non-active leaders.
- **Floating profile HUD:** compact static bar on every non-HQ screen.
- **Requisition:** all 12 door types functional (shop/altar/reliquary catalogs + cart + sell; forge; muster; apothecarion; shipyard; relay; arena; warp gate; throne room; **armoury** — buy/fit/sell armour). Location gating + closed-door reasons. Door demo mode.
- **Free-form loadout + armour (v17):** every model's slots are universal — the player assigns each slot a type (Weapon/Item/Ability/Warp Cast) then equips into it; slot count derives from `base sl + rank growth`; edits gated to non-active models. Every model also has one hard **Armour slot** pre-filled with a class+faction default; armour carries a per-element Defense profile that `THREAD.apply` subtracts from incoming damage (`max(0, dmg − def[element])`, floored). Buy/fit armour at an Armoury door; harden a chosen element at the Forge. Pure `LOADOUT` core (`slotCount`/`legalItems`/`canEquip`/`retypeSlot`/`mitigate`) is node-tested.
- **Map:** procedural charts at galaxy/segment/sector levels; readable sector header (Prosperity/Conflict/Taint meters); Orbit vs Surface split; Deep Space as a travelable node; clickable location panel (doors → requisition, forces → auspex intel, history → summaries, NPCs → sheets); in-location "start a thread" / "enter requisition".
- **Threads (unified spine, v16):** every type — battle / diplomacy / travel / mission / generic — runs through ONE `threadView` loop (header → read posts → compose → optional action block → post → await), driven by a pure, node-tested `THREAD` core (`create`/`initState`/`catalog`/`validate`/`apply`; see below). Threads carry live `state` (per-model wounds, distance bands, per-force AP pools, terms, transit meter) that posted action blocks actually mutate: combat spends AP and drops wounds on a state-driven battle report; a kill stamps the element-specific revival window (or permadeath for a no-revival source); diplomacy stages terms; travel fills a word-count arrival meter and charges force-scaled passage. Public/private gating, thread board, mission accept-gate, Exit (reads `state.joined`; travel exit refunds passage) all preserved. The old hardcoded `bBattle`/`bDiplo`/`bTravel` builders and the `S.tr` transit global are gone.
- **Comms:** remote hail; unsafe trade (transfer currency/item); publish conversation as Protocol; NPC approach-in-person when co-located.
- **Force intel / auspex:** encountered forces show last-known composition.

## First-pass / stubbed (need deepening or Stage 2/3)

These are functional but not the deep versions — flagged in-UI where relevant:
- Exit **pursuit** uses a simple speed comparison, not the full ranked-speed rule.
- **Trade** transfers gear but has no escrow / dispute→combat resolution.
- **AI thread summaries** are templates (real AI is a Stage 3 / backend + API feature).
- **Travel now resolves** (v16): real Travel thread with a word-count arrival meter + force-scaled passage cost. Throne Room world-enders still acknowledge but don't resolve. Warp-Gate free travel is plumbed (`passageCost` waives it) but has no charted portal destinations yet — needs galaxy data (minted webway/warp-gate locations), not engine work.
- Exit **pursuit** still uses a simple speed comparison (`enemySpd=3`), not the full ranked-speed rule — now reads real state but the pursuit heuristic is unchanged.
- **Scores/production/resources** (the flywheel) are specced in canon but need persistence (Stage 2) to actually accumulate; the map shows demo constants.
- **Art:** all image slots (portraits, door/location/space art, map card backgrounds) are wireframe placeholders. Filling them is its own conversation (procedural vs asset-pack vs generated).

## Thread core & tests (v16)

The thread rules live in a pure, DOM-free `THREAD` object inside `index.html`, wrapped in a `/*<thread-core>*/ … /*</thread-core>*/` region (reads no globals — canon and state arrive as arguments). A **dev-only `tests/` folder** unit-tests it with Node's built-in runner: `node --test` (zero dependencies, no `package.json`). `tests/_load.js` extracts-and-evals the region in the host realm; `tests/engine-syntax.test.js` is a headless boot proxy (compiles the inline `<script>` via `vm.Script`). `tests/` is **dev-only and never shipped** — only `index.html` + the JSON deploy. Design/plan docs live in `docs/superpowers/`.

The previously-parked **unified thread flow** design question is now RESOLVED and shipped (see the Threads bullet above).

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
