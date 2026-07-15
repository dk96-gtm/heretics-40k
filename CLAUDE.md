# HERETICS 40K — PROJECT.md

Project context and handoff document. This file lives at the root of the local project and is the single orientation point for anyone (human or AI assistant) working on the game. As of 2026-07-15, development has moved OFF Notion into this local project. The Notion workspace is a read-only design archive.

## What this is

Heretics 40K: a persistent play-by-post forum wargame in the Warhammer 40K universe with a custom ruleset. Players are Commanders who build armies of individual models, fight and negotiate in typed forum Threads, and conquer territory on a galaxy map. Long-term vision: forum "videogame" with custom menus and an AI-driven map/NPC/referee layer.

**Terminology law: it is always "model", never "chassis".** Applies to all rules text, UI copy, code, and data.

## Architecture

Two-file split. The game = DATA + ENGINE.

- `heretics-40k-data-v1.json` — THE CANON. Single machine-readable source of truth: rules constants, factions, models, equipment, galaxy, travel, thread types, NPCs. All lore/mechanics changes are edits to this file (bump the version). The engine renders it; the game cannot disagree with it.
- `index.html` — THE ENGINE (v6). Zero embedded canon. Fetches `./heretics-40k-data-v1.json` on load and renders everything from it. Contains only rendering logic, rules execution, and the demo SAVE-STATE (player roster, forces, threads, world overlays like forces-present and per-location thread history). Save-state is game *state*, not canon — it is the part a backend replaces in Stage 2.
- Both files must sit in the same folder, served over HTTP (file:// blocks the fetch; the engine boot screen explains this). Local test: `python -m http.server` → localhost:8000.

## File versions

- Engine: v6 (first data-driven build — UNTESTED at handoff; treat first load as playtest round one)
- Data: v1.0
- Prototype history (superseded, kept for reference): v4, v5 single-file prototypes on the Notion "Experience & UI — Design v1" page.

## What is IN data v1.0

Complete rules constants: AP bands (PC→AP), Named/Commander premiums (×1.25/×1.5), Named/Commander deltas per class (Core/Assault/Flying/Armament), rank growth curves (PC ×1.0/1.4/1.9/2.5/3.2; wounds % by archetype; XP-to-rank = current PC; Force XP averaging), combat framework (3 action types; actions = min(wounds,3); once-per-post equipment; additive AP; Movement 0 AP; Desperation Actions; MELEE/SHORT/MEDIUM/LONG bands; Healthy/Injured/Vulnerable damage states; 6 elements; anti-warp counters hit Warp+Bloodrage only), death & succession (killing element decides body state; Physical/Energy revivable; Commander permadeath; AP-holding Named heir inherits Commander layer + 33% Currency & Influence; 50% field recovery), economy (Currency/Dominance/Influence; founding start 300/30/350), Force size tags (SQUAD→CRUSADE), thread types (Diplomacy/Mission/Skirmish/Invasion+subtypes/Events/Travel), Comms rule (in-character remote relay, different planet/sector only; face-to-face = Threads), corrected rites (Founding 7 steps; Naming = automatic class delta + repeat of faction Origin choice, no cost, no freeform ability, no Psyker purchase).

All 20 factions (Chaos 6: Black Legion, Death Guard, World Eaters, Thousand Sons, Emperor's Children, Daemons · Imperial 5: Astartes, Militarum, Mechanicus, Sororitas, Custodes · Xenos 9: Tyranids, Orks, Necrons, Aeldari, Drukhari, T'au, GSC, Votann, Harlequins) each with currency name, 3 backgrounds, 3 appearances, 4 origin perks, and an ALPHA SUBSET of 3 statted models.

Alpha galaxy per Galaxy & Territory v1: Segmentum → Core/Expanse zones → Sector → Planet → Named Locations (planets always inside a Sector). Location tags (Nihilus/Sanctus, Canon/Custom, Ruler), sector statuses (Peace/Warring/Thriving/Famine/Corrupted, ownership = absolute majority, independent of status). Populated: Vigilus Sector (Warring; Vigilus + Sangua Tertius), Pallid Reach (Corrupted; Nurth), Kraith Drift (Famine; Kraith Verge); rest sealed. Travel ladder (ground 1 post / system vessel 2 / cross-sector warp 3, charter 350 / cross-Segmentum 5, charter 550, toll 200 placeholder) + controlled-planet arrival = Travel Thread with friendly/hostile branches. Alpha equipment (6 shop items, forge rules + 4 tags w/ faction access gating), 3 NPCs (Vess, Herald, Sskarith).

## What is NOT yet migrated (still only in the Notion archive — DO NOT LOSE)

Migration queue (also in the data file's meta block). Source pages in the Notion workspace:

- v1.1 — Full statted rosters, 5 models × 20 factions → "Base Model Rosters" page (Statted Rosters v1)
- v1.2 — Full weapons: Tag Registry v1 (tiers I–III) → "Tags" page; ~100 Standard Weapons w/ wielder lists → "Basic Weapons"; forging rules + 20 Legendary weapons → "Named Weapons"
- v1.3 — Items: 15 commons + 60 faction → "Basic Items"; 20 Legendary → "Named & Legendary Items". Abilities: 7 commons + 48 faction → "Abilities" page
- v1.4 — Casts v1: 8 families (Warp, Faith, Bloodrage, Technomancy, Protocols, Flesh-craft, Ancestral Rites, Null Wards), 14 commons + 57 discipline → "Warp Casting" page
- v1.5 — Mint planets, populate map, assign territory ownership (design task, per "Galaxy & Territory — v1" page)

## Review state (carried over)

- Rites of Creation: rebuilt to full spec in v5/v6 — needs another playtest pass.
- Commander HQ: approved. Barracks/Forces: approved with the v5 fixes (individual models, filters, status tag chips, named Forces w/ member lists + size tags).
- Map: rebuilt on the real structure — needs playtest.
- Requisition: reported broken by the user ("doesn't work, can't …" — sentence never completed). PARKED awaiting the failure description. Kept v4-era behavior.
- Battle State: deferred, untouched by request.
- Threads/Comms: corrected model implemented (typed threads; Diplomacy is a thread; Comms = IC remote relay only).

## Roadmap

- Stage 1 (now): local project + static deploy (GitHub Pages recommended — repo doubles as version control for data/engine iterations; Netlify Drop for quick tests). Single-player sandbox; testing/rebuild/lore rounds happen here.
- Stage 2: persistence backend (Supabase/Firebase class) — accounts, shared world, real threads. Data file becomes server seed content.
- Stage 3: AI layer — NPC posting + Action Block refereeing via API (the Action Block is machine-readable by design as the socket for this).

## Open design questions

Nihilus/Sanctus traits (undefined) · per-faction ruler traits at locations (undefined) · Segmentum-crossing toll (200 is placeholder) · confirm City/Bulwark/Space Station as a site-level axis distinct from the ~30-type Planet Types library · Legendary casts per faction · forge station network (types, locations, tier access) · Commander Rank 6+ milestones · starship rules (Named vs unnamed transport, space battles) · xenos Dominance/Influence naming per faction.

## Working rules

1. Canon changes → new data version (v1.x). UX/logic changes → new engine build (v7, v8…). The two append independently.
2. Every iteration is a git commit. Playtest on the deployed URL, feed findings back, ship the next version.
3. The Notion workspace (main page "Heretics 40K" and children) is frozen as archive: consult it for the un-migrated catalogs and design rationale; do not develop in it.

## Notion archive pointers

Main hub: notion.so page "Heretics 40K" (1680ced7-f13e-8005-8062-cf936daaab13) — Allegiances/Thread Types/Model Overview/Elements/Planet Types. Key children: Workbench (combat + death v1) · Models (Evolution System v1, growth curves, Forces) · Base Model Rosters (100 statted models) · Tags / Basic Weapons / Named Weapons · Basic Items / Named & Legendary Items · Abilities · Warp Casting (Casts v1) · Commander (schema v1) · Galaxy & Territory — v1 · Experience & UI — Design v1 (UI spec + v4/v5 prototypes) · Game Build — Foundation (data v1.0 + engine v6 attachments, deployment guide) · TO DO.
