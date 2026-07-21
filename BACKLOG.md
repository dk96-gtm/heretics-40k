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

## 🎯 PRIORITY FOCUS — MILESTONE A: PLAYABLE SOLO ALPHA

> **North Star:** a real player can go **title → NEW COMMANDER (Rites) → play → it saves →
> come back → CONTINUE** — a persistent single-player run on the live URL. Every task on this
> board is ranked by how directly it moves us to that. When you claim, prefer a higher tier.

**BUILD LAW — no tech debt, leverage what exists.** Every feature must **extend a system we
already shipped**, not bolt a parallel one beside it. Reuse the pure cores (`LOADOUT` /
`THREAD` / `WORLD`), the storage-adapter seam (`LocalStore`→`RemoteStore`), `doorCatalog`, the
galaxy readers (`fPl`/`fLoc`), the living-world tick. If a task tempts a shortcut that will
need unpicking later, stop and compose with the existing seam instead. Build so Stage-2
(backend/multiplayer) is a **drop-in at a seam**, never a rewrite.

**Already landed (the hard part of "log in & play"):**
```
✓ full-S profile persistence (localStorage serialize/hydrate)   85ee1a6
✓ title screen — CONTINUE + digest + first-run gating           9b2efb0
✓ Founding rite → spawns a REAL saved commander                 2e37b3b
✓ galaxy live at v1.13 (Solar + Pacificus minted)               G1 + G2
```

**Priority ladder to Milestone A** (claim top-down):

```
P0 · THE GATE — finish before "playable at all"
  └─ T-FD1 ✅ MERGED — full-S persistence · title/CONTINUE/digest · Founding onramp · Settings · demo+LS_NPC retired  (pushed 8a8f61d)

P1 · MAKES SOLO WORTH PLAYING — the world must respond to a lone player
  ├─ T-NPC-2b ✅ MERGED — enemy AI takes combat turns (fights back)
  ├─ galaxy G1–G5 ✅ MERGED (v1.16) · T-GX-G6 slice 1a ✅ RIFT core (v1.18)
  ├─ T-RIFT-1b  felt Rift penalties (travel/requisition ±25%) — shovel-ready on the RIFT core
  └─ T-TERR-1   territory persistence + per-sector production = THE FLYWHEEL (the "world
                accumulates" payoff). NB: G6's production bonus is blocked on THIS, not on galaxy authoring.

P2 · DEPTH & FEEL — elevate the loop, extend existing cores only
  ├─ T-THR-1   Speaker-attributed thread log (core to the play-by-post feel; presentation-only)
  ├─ T-BF4 / T-BF5   Combat depth (scout sight, deploy respec) — reuse Barracks/Armoury UI
  └─ T-BF3     Grid config → canon (tunable, zero debt)

DEFER · not blocking the alpha — don't over-invest, don't accrue debt
  └─ T-ENG-1/2/3 stubs (throne-room, trade escrow, pursuit) · art (wireframe → procedural/leverage, not asset-debt)
```

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
| T-FD1 | **Front Door + persistence backbone** — title screen (`CONTINUE` + "while-you-were-away" digest · `NEW COMMANDER` · `SETTINGS`; plain-verb/grimdark skin, **demo retired**), **single active profile** save = full-`S` serialize/hydrate behind a **storage-adapter seam** (`LocalStore` now → `RemoteStore` drop-in later), Settings (AI · save mgmt · export/import · about), and wire the built-but-dead **Founding rite** → `commitFounding(cc)`. Unblocks live accumulation the living-world tick + galaxy both defer as "needs Stage-2 persistence". | 🔥 engine + tests + docs | `merged` | frontdoor · sess:ceba401d-bd17-42e8-ba28-878c120b9d89 | 2026-07-20 | ✅ DONE @ `008ba9b..6f013dc` (9 TDD tasks). **🔥 LANE RELEASED.** Full-`S` persistence + title (CONTINUE/NEW/SETTINGS) + digest-on-title + `commitFounding` onramp + Settings (export/import/delete) live; **demo retired**; **LS_NPC retired** (npcState rides profile). 133/133 tests; browser-verified end-to-end (found commander → play → reload persists; combat-thread+grid round-trips; 0 console errors). **Awaiting Daak push.** |
| T-BF4 | **Scout/aspect sight bonus** — `bfSetup` passes `0`; scan ability slots for scout/recon tag, pass `rules.grid.scout_sight_bonus` | 🔥 engine | `open` | — | — | Small once tag lookup settled; `Scout`/`Stealth` tags exist in GLOSS. |
| T-BF5 | **Deploy respec drill-in + freeze gating** — deploy tray opens model overview + Armoury equip; gate equip to `phase==='deploy'`, block on `state.locked` | 🔥 engine | `open` | — | — | Medium; reuses Barracks overview + Armoury flow. |
| T-BF2 | **Board from planet ⊕ location** — replace hardcoded `bfSetup` cfg with `bfBoardCfg(planetType,locationType,canon)` | 🔥 engine | `blocked` | — | — | **Blocked on T-GX galaxy accessors + `location_type.board` hint shape.** Safe default holds meanwhile. |
| T-NPC-2b | **NPC combat turn** — enemy AI picks moves+attacks via `reachable`/`spottedEnemies`/`bandOf`, stages a block, posts through `threadView`. Makes the enemy fight back. | 🔥 engine | `ready-to-push` | npcturn · sess:970009ad-d34c-4f64-9a2d-cd52fc53aac8 | 2026-07-20 | ✅ DONE · pure `THREAD.npcTurn` + `npcRespond` glue · 7 tests (incl. end-to-end apply: player takes damage, foe advances) · 143/143. **🔥 LANE RELEASED.** ⚠ live browser render UNVERIFIED (shared browser held all session) — needs a manual combat-thread pass. Awaiting Daak push. |
| T-THR-1 | **Speaker-attributed thread log** — a readable in-thread speech/thought convention so conversations (NPC↔PC, OC↔OC, multiple models of one PC) are legible about *who says what to whom* | 🔥 engine | `ready-to-push` | frontdoor · sess:ceba401d-bd17-42e8-ba28-878c120b9d89 | 2026-07-20 | ✅ DONE (4 tasks · 150/150 tests). **🔥 LANE RELEASED.** Full-identity speaker colours: per-model `speechColor` in S tints spoken `<b>` + name label + left-accent bar; `<i>`=dimmed thought; plain=narration. 8-swatch picker on model overview (owned-gated, persisted). Browser-verified: 3 distinct speakers in one thread, colour survives reload, 0 console errors. Awaiting Daak push. |
| T-ENG-1 | **Throne Room world-ender** resolution (acknowledges but doesn't resolve) | 🔥 engine | `open` | — | — | Stubbed; needs design pass. |
| T-ENG-2 | **Trade escrow / dispute→combat** — Comms trade transfers gear with no escrow | 🔥 engine | `open` | — | — | Stubbed; Stage-2-adjacent. |
| T-ENG-3 | **Grid-aware Exit pursuit** — replace flat `enemySpd=3` heuristic with position/speed-ranked rule | 🔥 engine | `open` | — | — | Low priority polish. |
| T-RIFT-1b | **Rift supply penalties — felt hooks (G6 slice 1b)** — apply the shipped `RIFT` core at existing seams so the Rift is felt in play | 🔥 engine | `ready-to-push` | opus · sess:6e18d3b6-86ef-44ae-a594-6561cd9987e8 | 2026-07-21 | ✅ DONE. **🔥 LANE RELEASED.** Two pure consumers added to the RIFT core — `RIFT.travelCost`/`RIFT.reqPrice` (compose `standing`→`mods`, round×mult) — + `tests/rift-hooks.test.js` (8 tests). Engine glue: `riftPassage`/`riftPrice` helpers resolve dest/current planet⊕sector + player force; wired at **travel** (`passagePreview`+`travel` → travelMult) and **requisition** (`doorCatalog` shop/altar/reliquary pricing → reqMult). 169/169 tests. Browser-verified vs live canon: Terra(Sanctus)=home → travel 100→75, req 40→40; Vigilus(Nihilus)=away → travel 100→125, req 40→50; adrift/pre-founding guard falls through to base; 0 console errors. NB `sellPrice` (60%) now follows the local market (buys +25% away → sells at 0.75× base) — coherent. Muster/apothecarion (`musterMult`) + comms (`commsTier`) remain as separate §4.1 hooks. Awaiting Daak push. |
| T-CONQ-1 | **Conquest → territory flip** — winning combat/mission/invasion at a world reassigns ownership by **taking its Major Hub + winning CP majority** (System ① rules); losing reverses it. Ties thread outcomes to the ownership spine. | 🔥 engine (+ THREAD core) | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | **Now part of the LIVING GALAXY program** — reframed onto Major-Hub/CP ownership (was: `claimHolding` on per-planet holdings). Feeder → depends on **T-LG-1** (Territorial Control spine) + combat threads. Deferred; pick up after the spine lands. |
| T-TERR-1 | **Territory persistence + per-sector production (THE FLYWHEEL)** — save-state ownership of sectors/worlds so the living-world tick accrues by HOLDINGS, not a flat demo constant | 🔥 engine + canon | `paused` | — | 2026-07-20 | **⚠ ABSORBED into the LIVING GALAXY program (design in progress 2026-07-20).** Reshaped: production now sits ON TOP of a territorial-control spine (Major Hub → planet → sector-capital → segmentum-crown ownership). Blocked on that spine. **🔥 LANE RELEASED** during program design. Original note ↓ **P1 — the "world accumulates" payoff + unblocks G6 production coupling & §4.3 garrison.** (1) add owned-holdings to `S`; (2) drive `WORLD` production per-sector from `planet_types.prod_mult` × holdings × `RIFT.mods('home').prodMult`; (3) surface in the Digest. Extends the shipped `WORLD` tick + storage-adapter seam (real accumulation lands with Stage-2 persistence; structure buildable now). |

### canon lane (heretics-40k-data-v1.json)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-BF3 | **Move terrain/grid config into canon** — add `rules.grid` + `terrain_types`; helpers read from canon w/ current constants as fallback | canon + 🔥 engine + tests | `open` | — | — | Touches `index.html` too → takes the 🔥 lane. Coordinate the canon edit. |
| T-GX-G6 | **Wire G0 trait mechanics** — cross-Rift supply penalty, home-turf ruling trait, arrival & garrison scaling | canon + 🔥 engine | `ready-to-push` | rift · sess:970009ad-d34c-4f64-9a2d-cd52fc53aac8 | 2026-07-20 | ✅ **Slice 1a (RIFT core) DONE** · canon v1.18 · pure `RIFT.standing/mods/sideOf/forceOf` + `rules.rift` (magnitudes + 8/8/4 seating) · 11 tests · 161/161. **LANES RELEASED.** ⚠ **FINDING:** the production FLYWHEEL is blocked on **territory persistence (Stage 2)** — tick production is a flat demo constant, no per-sector/owner stream to boost. Wireable-now hooks (travel/requisition ±25% via the core) = slice 1b; §4.2 ruling / §4.3 garrison = follow-on. |

### canon + tests lane — galaxy authoring (parallel-safe per segmentum)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-GX-G1 | Author **Solar** segmentum planets/locations against the G0 minting contract | canon + tests | `ready-to-push` | galaxy · sess:406f1b0a-8f6e-4674-95ec-6d43178f11bd | 2026-07-20 | ✅ commit `3316733` · canon **v1.12** · 10 planets / 34 loc / 3 sectors · 121/121 tests. Reference done — validated the contract (fixed 2 spec errors: locations don't store `doors`; orbital stations allowed). **Template for G2-G5.** |
| T-GX-G2 | Author **Pacificus** segmentum | canon + tests | `ready-to-push` | pacificus · sess:970009ad-d34c-4f64-9a2d-cd52fc53aac8 | 2026-07-20 | ✅ DONE · canon **v1.13** · 6 sectors / 20 planets / 65 loc · 130/130 tests · 6 sector-by-sector commits. Populated baseline stubs `hydra`/`haloz` + 4 new sectors. **CANON LANE RELEASED** → G3 clear to inject. Awaiting Daak push. |
| T-GX-G3 | Author **Obscurus** segmentum | canon + tests | `ready-to-push` | galaxy · sess:406f1b0a-8f6e-4674-95ec-6d43178f11bd | 2026-07-20 | ✅ DONE · commit `bcdc1e7` · canon **v1.14** · 7 sectors / 17 planets / 58 loc · 133/133. Folded demo Vigilus/Pallid/Kraith unchanged + 4 Nihilus sectors (Black Legion/World Eaters/Thousand Sons/Daemons/Orks). **⚠ also fixed a cross-session dup: G2's `kestar` sector+planet id clash → planet renamed `kestarp`** (0 engine refs); added a galaxy-wide global-id-uniqueness guard test. **CANON LANE RELEASED** → G4/G5 clear. Awaiting Daak push. |
| T-GX-G4 | Author **Tempestus** segmentum | canon + tests | `ready-to-push` | galaxy · sess:406f1b0a-8f6e-4674-95ec-6d43178f11bd | 2026-07-20 | ✅ DONE · commit `41cb41e` · canon **v1.15** · 5 sectors / 16 planets / 53 loc · 141/141. Seats Emperor's Children → **all 8 Nihilus factions homed** + Daemons/Drukhari◇/Tyranids. Galaxy now **63/~100** across 4 segmentums. **CANON LANE RELEASED** → G5 clear. Only **G5 Ultima** (the Front + last 3 neutrals: Necrons/GSC/Harlequins) remains to complete the mint. Awaiting Daak push. |
| T-GX-G5 | Author **Ultima** segmentum | canon + tests | `ready-to-push` | galaxy · sess:406f1b0a-8f6e-4674-95ec-6d43178f11bd | 2026-07-20 | ✅ DONE · commit `fff27dc` · canon **v1.16** · 6 sectors / 24 planets / 77 loc · 150/150. The Front: mixed rift (14 Sanctus/10 Nihilus) + a contested Scar; seats Necrons/GSC/Harlequins. **🎉 GALAXY MINT COMPLETE — all 20 factions homed · 5 segmentums · 27 sectors · 87 planets · 287 locations.** G6 data-dependency now satisfied. **CANON LANE RELEASED.** Awaiting Daak push. |

### 🌌 LIVING GALAXY program (parent design map + workstreams)

**A self-running strategic world: every planet governed via Major Hubs, every sub-faction
pursuing goals, every NPC an actor.** Absorbs `T-TERR-1`. Parent design map:
`docs/superpowers/specs/2026-07-20-living-galaxy-program-design.md`. **Spikes A–G are being
resolved WITH Daak before any implementation.** All owned by the `opus` design session; the
System epics are `blocked` (not holding the 🔥 lane) until their spikes + upstream systems land.

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-LG-0 | **Program design map** — vision · ownership spine (Major Hub → planet → sector-capital → segmentum-crown) · 5 systems · implications/integration · open spikes | docs | `ready-to-push` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | ✅ Written & committed. The trunk every System spec branches from. Awaiting Daak push. |
| T-LG-SA | **Spike A — simulation scale / fidelity** (the keystone; caps ③/④ cost) | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Recommended: Level-of-Detail (high near player · statistical afar · weighted seeded scheduler). Resolving with Daak. |
| T-LG-SB | **Spike B — Major Hub as single control chokepoint** (production + spend + thread-init) | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Define hub data shape + how one Named Location/planet is chosen. Resolving with Daak. |
| T-LG-SC | **Spike C — CP-gating thresholds** for thread initiation (skirmish<mission<ransack<invasion<world-ender) | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Where thresholds live (canon); how CP is measured at the hub. Resolving with Daak. |
| T-LG-SD | **Spike D — crown/capital canon reconciliation** — 25 authored `crown:true` vs *earned* segmentum-crown + new sector-capital designation | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Authored crowns → default seats the dynamic rules move; author sector capitals. Resolving with Daak. |
| T-LG-SE | **Spike E — ownership derived vs stored** (recompute from CP each tick vs mutate on events) | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Determines save-state shape + tick cost. Resolving with Daak. |
| T-LG-SF | **Spike F — faction→empire model** (Imperium-as-one; measuring "largest empire") | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Distinct axis from RIFT sides. Resolving with Daak. |
| T-LG-SG | **Spike G — NPC-initiated thread resolution** (statistical vs auto-referee vs defer-to-player) | design/docs | `in-progress` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Governs whether the far galaxy plays threads or reports outcomes. Ties to Spike A + Stage-3. Resolving with Daak. |
| T-LG-1 | **System ① Territorial Control spine** — Major Hub primitive · planet/sector/segmentum ownership resolvers · capital & crown designation · hub UI · CP-gated init | canon + 🔥 engine | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | **Build FIRST — all else needs it.** Blocked on spikes B/C/D/E. Own spec pending. |
| T-LG-2 | **System ② Economy on hubs** — per-planet production allocated at hubs · spend · sector/crown aggregation · war multipliers (**T-TERR-1 folds in here**) | 🔥 engine + canon | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Blocked on T-LG-1. Absorbs paused T-TERR-1. Own spec pending. |
| T-LG-3 | **System ③ Faction grand-strategy & goals** — per-sub-faction optimization goals + Imperium-as-one empire rule + empire bookkeeping | 🔥 engine + canon | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Blocked on T-LG-1 + Spike A/F. Own spec pending. |
| T-LG-4 | **System ④ NPC agency** — atomic NPC drives (raise force / seek XP / ransack) → thread generation + local-force reaction | 🔥 engine (+THREAD/NPC) | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Blocked on T-LG-1 + Spike A/G. Extends T-NPC line. Own spec pending. |
| T-LG-5 | **System ⑤ Simulation engine / scheduler** — LOD zoning · weighted seeded event scheduler · off-screen surfacing · hosts ③+④ galaxy-wide | 🔥 engine | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Blocked on T-LG-3/4 + Spike A. Extends WORLD tick. Own spec pending. |
| T-CC-1 | **Character-creation start-holdings** — background + sub-faction decide if/what world (+ hub/seat) a new commander starts owning; expands the Rites | 🔥 engine + canon | `blocked` | opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6 | 2026-07-20 | Feeder → seeds T-LG-1 ownership. Blocked on T-LG-1. |

### docs lane (parallel-safe)

| ID | Task | Lane | Status | Owner · session | Updated | Notes |
|----|------|------|--------|-----------------|---------|-------|
| T-DOC-1 | **Compendium PDF → v1.8** fold-in (battlefield grid + armour + slots already at 58pp; add tag registry + gear catalogs) | docs | `open` | — | — | `md-to-pdf`; source in `docs/superpowers/specs/`. |
| T-DOC-2 | Retire the standalone **screen-VIII prototype** doc/notes once the engine prototype is folded in | docs | `open` | — | — | Pairs with an engine polish task; docs half only here. |
| T-THR-2 | **Thread-types deep spec — adapt/expand remaining types.** Travel/Skirmish/Duel/Raid **LOCKED** (2026-07-21). This task = deepen the rest to the same fidelity: **Invasion, Diplomacy, Mission, Events** — each anchored in world hooks, NPC action, other-PC action, resolution/rewards. **Mission is the deepest net-new work** (shell today: `catalog()`→`[]`, no objective state/clock/payout). Recommended order: Invasion → Diplomacy → Mission (Events deferred to Stage-3). Feeds `rules.thread_types` canon + THREAD core. | docs → canon | `open` | — | — | **Durable spec: `docs/superpowers/specs/2026-07-21-thread-types-deep-design.md`** (locked types full; open types flagged w/ known-state + design Qs). Resume brainstorming one open type at a time. |

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
