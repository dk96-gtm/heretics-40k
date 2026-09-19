# HERETICS 40K — AGENT BACKLOG

**The single source of truth for who is building what.** Read this first, every session.
Coordination rules live in `CLAUDE.md → Multi-Agent Coordination`; the short version is below.

> **Cleaned 2026-09-11** (canon **v1.40**). Every row was re-checked against git and the code.
> The full history of every task — build reports, rulings, commit ranges, carry-overs — moved
> word-for-word to **`docs/backlog-archive.md`**. Rows here stay short and point to their spec.

---

## HOW TO USE THIS BOARD

**The board is sorted by readiness, not by file.** Pick from the highest section you can:

```
IN FLIGHT ........... someone is working on it right now — hands off
SHIP QUEUE .......... built and verified, waiting for Daak's push
❶ READY TO BUILD .... locked spec exists → write the plan (if missing) → build
❶b SMALL FIXES ...... the row itself is the spec — just do it
❷ NEEDS A SHORT SIT . design half-done; the open questions are listed — needs Daak
❸ NEEDS A FULL SESSION  never designed — needs a brainstorm with Daak
❹ RULINGS & TUNING .. numbers and yes/no calls for Daak, not specs
PARKED .............. deliberately deferred — do not pick up
DONE ................ one line each; history in docs/backlog-archive.md
```

**Every live row carries five facts:** what it is (one line) · **Lane** (the files it edits) ·
**Spec** (the locked design doc) · **Plan** (the build checklist — `✓ <file>` or `to write`) ·
**Blocked by** (`—` = nothing).

**The claim flow (full rules in CLAUDE.md):**
1. **Sync first** — `git pull` / check `git log`; re-read this board.
2. **Claim** — edit only your row: status `claimed`, owner `<name> · sess:<uuid>`, date. Commit
   `backlog: claim <ID>` with `git commit BACKLOG.md -m …` (path-scoped). First commit wins.
3. **Respect lanes** — 🔥 `index.html` is HOT: only ONE `in-progress` task may hold it at a time.
4. **Commit hygiene** — never `git add -A` / `git add .`; stage your own hunks with `git add -p`;
   commit path-scoped (`git commit <paths> -m …`); keep `node --test` green at every pause.
5. **Push is Daak's** — when done, move your row to SHIP QUEUE with its exact paths. Never push.
6. **Finish the row** — once pushed, move it to DONE as one line; put the long report in the
   archive or `.superpowers/sdd/`, not on the board.

**BUILD LAW — no tech debt, leverage what exists.** Every feature extends a shipped system
(the pure cores `LOADOUT`/`THREAD`/`WORLD`/`ULT`/`CAD`/`KIT`/`HALL`…, the `LocalStore`→`RemoteStore`
seam, `doorCatalog`, the galaxy readers, the world tick). Stage 2 must drop in at a seam, never
force a rewrite.

### Lane legend

| Lane | Files | Contention |
|------|-------|-----------|
| 🔥 `engine` | `index.html` | **HOT — one `in-progress` task at a time.** |
| `canon` | `heretics-40k-data-v1.json` | Warm — one editor at a time; bump `meta.version`. |
| `tests` | `tests/**` | Cool — parallel-safe. |
| `docs` | `docs/**`, `*.md` | Cool — parallel-safe. |
| `lab` | `lab/**`, `lore/**`, `tools/**` | Cool — parallel-safe, never shipped. |

### Status legend

`open` → `claimed` → `in-progress` → `ready-to-push` → `merged` · plus `blocked`, `paused`, `hold`
(`hold` = buildable, but Daak asked to wait).

---

## IN FLIGHT

| ID | Task | Lane | Spec | Status · Owner | Next step |
|----|------|------|------|----------------|-----------|
| T-BIBLE-1 | **Universe Lore Bible** — `/lore` as the foundation layer driving visuals, factions, NPCs, battles | docs + lab | `specs/2026-09-10-universe-lore-bible-design.md` | `paused` since 2026-09-10 23:19 · opus · sess:0ff564a6-609b-4b3d-bcff-8a5f254e3a43 | Phases 0–5 done, P6 validation slice rendered. Rebuild the Aeldari + Tyranid door recipes from each culture's `art/<culture>/PLANVIEW.md`, then fan out. |

---

## SHIP QUEUE — waiting for Daak

**Nothing below is on the live site yet.** Local `main` and `status-alpha-dev-recap` point at the
same commit; GitHub's `main` is 147 commits behind them.

| Stage | What | Canon | Where it sits |
|-------|------|-------|---------------|
| **A** — pushed, not merged | T-NPC-3 **N2 The Aggressor** + the Chronicle | v1.36 | remote branch `status-alpha-dev-recap` (67 commits ahead of GitHub `main`) |
| **A** | T-NPC-3.5 **Full-loadout NPC combat** + final fix wave | v1.39 | same |
| **A** | T-SOC-1 **Hall slices A + B1** (the social door, regulars, trust ladder) | v1.38 → v1.40 | same |
| **A** | T-QA-1 first sweep fix — the disband escape-dodge (`78e5c19`) | — | same |
| **B** — local only, never pushed | T-VIS-1 **Overnight visual layer** — 594 backdrops, 372 battlefield recipes, 474 door interiors | — | local `main` only. ⚠ `lab/procgen/render/fixups.sh` (re-render of 2 repaired Khorne arenas) still to run once the render queue is clear. 5 open questions for Daak: report §5 at the top of `lab/procgen/RUNLOG.md`. |
| **B** | T-BIBLE-1 phases 0–5, Hall B2 plan, research docs, this board cleanup | — | local `main` only |
| **B** | T-SOC-1 **Hall slice B2** — the CONTEST verb (BRAWL + MATCH), hall law, Champion rungs ③/④ — built + final fix wave applied, 788/788 green | v1.42 | **merged into local `main`** 2026-09-12 (clean fast-forward `97c0125..b7e8a51`; local `main` and `status-alpha-dev-recap` point at the same commit again, as they did before this slice). Still unpushed — `origin/main` is 148 commits behind local `main`. **Pushed separately 2026-09-19 on branch `hall-b2`:** the 16 code commits cherry-picked onto the already-pushed base (engine, canon and tests byte-identical to the reviewed build) plus this docs commit and the full rulings ledger at `docs/superpowers/records/2026-09-12-hall-b2-rulings-ledger.md` — so it ships without the ~1 GB of unpushed render art. Commits `832f8af..0f57bcf` plus this close-out docs commit (the range was stale at `..0860cd6`: two fix-round commits and the whole final fix wave sat outside it). Paths: `heretics-40k-data-v1.json`, `index.html`, `tests/hall-core.test.js`, `tests/canon-hall.test.js`, `tests/thread-core.test.js`, `tests/conds.test.js`, `tests/npc-turn.test.js`, the seven other canon version-pin files, `CLAUDE.md`, `BACKLOG.md`. Tunables + 9 open questions for Daak: block under the `❶ READY TO BUILD` table (T-SOC-1 C sits there, `blocked` on this). |

---

## ❶ READY TO BUILD — locked spec

Suggested order (by what it unlocks): **Hall B2 → Death & Succession → Diplomacy D1 → Economy E2
→ Shield/Ward/Decoy → Strategium → Economy E3**, then the chained rows once their blockers land.
All paths below are under `docs/superpowers/`.

| ID | Task | Lane | Spec | Plan | Blocked by | Status |
|----|------|------|------|------|------------|--------|
| T-DTH-1 | **Death & Succession** — heir designation, two-path succession (prepared / scrub-tier), the instability window, the funeral-rite thread. Instability also fills N2's stubbed ×1.0 instability factor in NPC targeting. *(New ID — this locked spec never had a board row.)* | 🔥 engine + canon + tests | `specs/2026-07-27-death-succession-design.md` | to write (spec says: single slice) | — | `open` |
| T-DIP-1 | **Diplomacy D1 — pact core** — pact object, term registry (Tribute/Ceasefire/Passage/Cede/Release/Bonded Trade), escrow, tick hooks, term-staging UI. Closes T-ENG-2. | 🔥 engine + canon + tests | `specs/2026-07-27-diplomacy-pacts-oathbreaker-design.md` §6 D1 | to write | — | `open` |
| T-ECN-2 | **Economy E2 — sinks** — gear wear + repair + melt-down, consumable packs, tier-gated door services (Altar blessings ride CONDS) | 🔥 engine + canon + tests | `specs/2026-07-27-economy-resources-sinks-design.md` §6c–e | to write | — *(T-ECN-1 + T-DOOR-1 both shipped — old "blocked" was stale)* | `open` |
| T-CMB-4 | **Conditions Phase 2 — Shield / Ward / Decoy** — the damage-step trio on the mitigate seam; unlocks richer Altar blessings for E2 | 🔥 engine + tests | `specs/2026-07-25-combat-conditions-design.md` §Phase 2 | to write | — | `open` |
| T-NPC-3 N3 | **Strategium screen** — your active clocks (ultimatums, mission deadlines) over a filterable galaxy news feed; urgent items get a dismissible banner | 🔥 engine | `specs/2026-07-27-background-agency-attention-design.md` (N3) | to write | — | `open` |
| T-ECN-3 | **Economy E3 — combat cargo** — force cargo hold, Supply Wauler, container tiers, baggage train on the battlefield, Seize + aftermath claim; ransom/bribe via Comms | 🔥 engine + canon + tests | `specs/2026-07-27-economy-resources-sinks-design.md` §4–5, §6f | to write | — *(prefers T-MISC-2 for the train object; can build without)* | `open` |
| T-DIP-2 | **Diplomacy D2 — Oathbreaker** — breach tagging, stacking marks, standing/door/stake effects, ally propagation, faction-shaped redemption | 🔥 engine + canon + tests | same diplomacy spec §4 | to write | T-DIP-1 | `blocked` |
| T-DIP-3 | **Diplomacy D3 — NPC pact behaviour** — NPCs propose/accept/counter/break by personality; NPC-side marks; Relay trust intel | 🔥 engine + tests | same diplomacy spec §6 D3 | to write | T-DIP-1, T-DIP-2 | `blocked` |
| T-SOC-1 C | **Hall — powers, jobs, interaction events** — Local Powers, the jobs generator, the 15 event families | 🔥 engine + canon + tests | `specs/2026-09-06-social-door-design.md` §7–9, §12 | to write | T-SOC-1 B2 | `blocked` |
| T-FAC-1 | **Signature doors** — one unique door per sub-faction (spawn at crown world tier I, buildable on ruled worlds; Govern inherits them) | 🔥 engine + canon + tests | `specs/2026-07-31-door-tiers-signature-doors-design.md` §6 + `specs/2026-07-22-thread-archetypes-design.md` §8.7–8.10 | to write | Daak: "build after alpha" | `hold` |

> **T-SOC-1 B2 hand-off (task 8 close-out, 2026-09-12) — tunables + open questions for Daak.**
>
> **Tunables — every flagged-for-review default this slice authored:** `contest.match.base_win`
> 0.45 · `cheat_shift` 0.30 · `catch_base` 0.35 · `cunning_pivot` 60 · `cunning_relief` 0.6 ·
> `wager_by_tier` 25/50/100 · `wagered_rung_min` 1 · `law.barred_days` 5 · `law.standing_penalty`
> -1 · `champion.train` {Rally I, cost_mult 3, days 3, rung_min 2} · `champion.title` {rung_min 3,
> standing_notch 1, stake_mult 4} · the 20 authored contest names and the 8-brawl/12-match
> resolver split · the brawl wager's ×2 win return. **Measured, not just authored:** cheating
> nets only ~5 points of win rate as authored (5000-draw sim: honest 44.1%, cheat 49.2%, a
> high-cunning culture 54.7%) — with a clean uncaught cheat taking a Champion's title outright
> and a caught one costing nothing extra, cheating reads as a SOCIAL gamble (worth it only where
> the culture's judge rewards `cheat_clean`), not an odds gamble — confirm that's the intent.
>
> **Design facts, not bugs, worth knowing:** the YIELD win condition (driven to 1 wound in a
> non-lethal bout → out, alive) was invented this slice, not specified — alternatives: first
> blood, a round limit, best-of-three. A bout is a true 1v1 (only the Force leader fights). A
> bout moves no war meter, no mission streak, and writes no Chronicle record.
>
> **Nine open questions, none blocking the push:**
> 1. **The rung-② split** — a challenge is open at rung ① (STRANGER) unwagered; only the
>    *wagered* bout is the rung-② unlock (`wagered_rung_min: 1`). This is deliberate: gating the
>    whole contest at rung ② would leave the 8 high-ferocity factions (whose judge zeroes every
>    non-win act) permanently unable to climb — B2's win path is the intended fix. Confirm the
>    split, or retune `rules.hall.trust.axis.ferocity_only_win` instead.
> 2. **The Gallery's crowd** (spec §4) — "the Gallery watches an Ambush as theater — crowd never
>    intervenes there" belongs to the Ambush event (Slice C); no `crowd_intervenes` flag was
>    minted here — it would be dead data until Ambush lands.
> 3. **The title fight's disposition payoff is missing** (spec §6 promised chronicle + hall-wide
>    disposition + a standing notch — only the standing notch shipped). `S.social.pat` is keyed
>    per (location, tonight's regenerated patron), so goodwill on tonight's crowd can't persist to
>    tomorrow's — needs a location-level "hall cred" field that doesn't exist yet. Deferred to C.
> 4. **The title fight writes no Chronicle record** — `CHRON` is war-only (titleOf keys a war-title
>    table, account narrates from a siege-prose pool); a title record today would make every NPC
>    at the Hall recite a fabricated siege. Proposal: a `bout`/`title` record KIND with its own
>    hall-voiced lines — its own CHRON + canon task.
> 5. **Should an ordinary bout be remembered at all?** Same reasoning as Q4, one tier down —
>    today a bout leaves no Chronicle trace.
> 6. **Should a bout count toward duel-flavoured mission streaks?** Deliberately does not (a
>    social contest on bound ground isn't a war action) — a one-line change if wanted.
> 7. **NPC spawn rank / kit depth** — pre-existing, not from this slice; already tracked on
>    T-BAL-1 above, not duplicated here.
> 8. **The training buff is `Rally` tier I for every culture** — should each culture train in its
>    own idiom (Necron protocol, Ork enthusiasm, …) instead of one condition for all 20?
> 9. **Should a barred player be able to buy their way back in**, or is five days always five?
>
> **KNOWN DEFECT, parked deliberately (found by the final whole-branch re-review, NOT fixed):**
> a purchased Champion **training buff is silently destroyed if you open a thread and then back
> out before Lock In.** `hallBout` (and `seedCombat` on the ordinary path) consumes
> `S.social.train` at mint, stamping the condition onto the thread's `seedState`; every
> pre-Lock-In exit then splices that thread away, so the 75-300 currency spent on training is
> gone with nothing to show. The Hall exit now correctly refunds the *wager*, which makes the
> loss more visible, not newly caused. **It was parked rather than patched because the defect is
> engine-wide, not Hall-specific** — the identical shape exists on the ordinary `seedCombat`
> path in code this slice never touched, and a Hall-only patch would close the visible third of
> it and leave the rest, which is exactly the partial-audit mistake this slice already made once.
> **Fix shape:** restore a consumed training stamp on ANY pre-Lock-In exit (carry it on the
> thread so the exit path can hand it back), not just the Hall's.

## ❶b SMALL FIXES & POLISH — the row is the spec

| ID | Task | Lane | Status |
|----|------|------|--------|
| T-FIX-1 | **Carry-over sweep** (collected from final reviews; sources in the archive rows T-NPC-3, T-NPC-3.5, T-DOOR-2, T-MSN-1B): ⓐ `bfSetup` board-gen uses `Math.random` → seed it, so a drama battle replays identically · ⓑ `ULT.evalPlayerTribute` has no unit pin · ⓒ a live drama's location is missing from the `_bsg` besieged heal-pause set · ⓓ `avgCorePc` duplicated inside `mintDrama`; inert `t.drama` field · ⓔ N1 M2 (Rebuild during your own clock, overlay edge) + M3 (one-clock guard lives only in the UI, not `startThread`) · ⓕ NPC-3.5: `normConds` at the top of `enumeratePairs`; pin `npcExpDamage` against `apply`; NPC side silently mutes on any `validate` rejection · ⓖ armour items never carry `cat:'ARMOUR'`, so the Barracks fit-from-inventory picker and the Shop's sell-armour path are reachable but inert · ⓗ run the still-outstanding live two-thread **Defend** accept-loop E2E | 🔥 engine + tests | `open` |
| T-MSN-2 | **Mission board hygiene** — abandoning must restore the board row (abandoned signature rows block a planet's one signature slot forever); `votann_grudge` mint/accept drifts on a ruler flip | 🔥 engine | `open` |
| T-BF4 | **Scout sight bonus** — `bfSetup` passes `0`; scan ability slots for a scout/recon tag and pass a canon `scout_sight_bonus` | 🔥 engine + canon | `open` |
| T-BF5 | **Deploy respec** — the deploy tray opens model overview + Armoury equip; equip gated to `phase==='deploy'`, blocked on `state.locked` | 🔥 engine | `open` |
| T-BF3 | **Grid config → canon** — `rules.grid` + `terrain_types`; helpers read canon with today's constants as fallback | canon + 🔥 engine + tests | `open` |
| T-ENG-3 | **Grid-aware Exit pursuit** — replace the flat `enemySpd=3` with a position/speed-ranked rule | 🔥 engine | `open` (low) |
| T-MOD-1 | **Model sex field** — the remainder: civilians already shipped with Hall slice A. Add `sex` to models, fixed where lore dictates (Astartes/Custodes male, Sororitas female), varied for NPCs elsewhere. Spec: `specs/2026-07-22-thread-archetypes-design.md` §8.6 / D10 | canon + 🔥 engine | `open` |
| T-DOC-1 | **Compendium PDF regen** — the player-facing rules PDF is ~30 canon versions behind (built at v1.8/v1.24; canon is v1.40). Use `md-to-pdf`. | docs | `open` |
| T-DOC-2 | **Retire the screen-VIII prototype** doc/notes now that the grid lives in the engine | docs | `open` |
| T-QA-1 | **Red-team sweep** (recurring) — 4 personas + economy auditor; every confirmed exploit → fix + regression pin. Playbook `docs/superpowers/playbooks/red-team-and-balance.md`. Next sweep: against the trunk once the SHIP QUEUE lands. | QA (browser + docs) | `open` |

---

## ❷ NEEDS A SHORT SIT — open questions for Daak

| ID | Task | Spec so far | Open questions |
|----|------|-------------|----------------|
| T-THR-4 · T-ENG-1 · T-CONQ-1 | **Invasion family** — Invasion / Crusade / Exterminatus, the Throne-Room world-ender buttons (pure stubs today; canon `world_enders` has 0 engine refs), and the 15 `thread_scales` subtypes as real mechanics | `specs/2026-07-22-thread-archetypes-design.md` D7 ("STILL OPEN") · `specs/2026-07-21-thread-types-deep-design.md` §INVASION | ① completion bonus to *all joined forces* or only those in ≥½ the raids? ② production penalty on a Governed foreign world ③ promote Major Hub → Throne World: trigger + cost ④ garrison formula — reconcile with N1's shipped `level × condition` garrison ⑤ rebuild ticker cost/time after Annihilate ⑥ Annihilated locations become `Ruined`? ⑦ how T-CONQ-1's hub+PC-majority flip relates to the INVASION conquest already shipped ⑧ win condition + effect for each subtype |
| T-THR-3 | **Travel in legs** — one post per leg; canon `travel[tier].posts` (1/2/2/3/5) is authored but unread | Daak ruling 2026-07-21 (archive row) | ① how a journey splits into legs ② the word target per leg ③ what can happen between legs (interception, exit, refund)? |
| T-ECO-1 | **Trade contracts** — doors post faction-flavoured haul contracts; delivery pays currency + Influence | archive row (Daak decisions 2026-07-21) | ① what is left now that the Trade Haul mission shipped (T-MSN-1B)? ② generation: canon `rules.trade.contracts`, tick-refreshed? ③ payout curve ④ slave-stock variant (delivering living models) ⑤ relic contracts (need per-subfaction kill attribution) |
| T-STAT-1 | **Sector status effects bite** — `status_resolution` + `status_effects` + the 9 `galaxy.conditions` stop being display-only (Cursed attrition, Fortified AP tax, Famine…), riding the `condMods` seam | archive row | ① which effects bite ② how hard ③ the combat hooks vs the economy hooks |
| T-THR-2 | **Diplomacy thread leftovers** | `specs/2026-07-21-thread-types-deep-design.md` §DIPLOMACY | ① Protocols (published treaties) ② 3+-party negotiation ③ failed diplomacy → Skirmish escalation — check overlap with the pacts spec first |
| T-BF2 | **Board from planet ⊕ location** — replace the hardcoded `bfSetup` config | archive row | ① the shape of a `location_type.board` hint (the galaxy accessors it waited on now exist) |
| T-GX-G6 | **Galaxy traits, the rest** — home-turf ruling (§4.2) + arrival & garrison scaling (§4.3); the Rift core + felt penalties already shipped | `specs/2026-07-19-galaxy-territory-mint-design.md` §4 | ① is §4.3 still needed, or did N1's garrison formula supersede it? ② home-turf: what the ruling trait does |
| T-UI-1 | **Engine re-skin** — cogitator-era hardware UI; `lab/uikit` v1 approved 2026-09-08 | `docs/ui-kit/HANDOFF.md` · `docs/research/ux-immersive-writing-ui/DOSSIER.md` §8 | ① composer register ② Daak re-opens the task → then 9-slice + sprite-sheet export → re-skin `index.html` |

## ❸ NEEDS A FULL DESIGN SESSION

| ID | Task | What exists already |
|----|------|---------------------|
| T-S2-1 | **Stage-2 backend** — accounts, one shared world, `validate()` as server authority, syncing `S`. *(New ID — no spec exists.)* | Constraints: `specs/2026-07-27-stage2-social-contract-design.md` (PvP law), `specs/2026-07-20-cloudflare-ai-proxy-design.md`, the `LocalStore`→`RemoteStore` seam, T-CMB-3's three client-trust residuals (archive row T-CMB-3). |
| T-LG-R | **Living Galaxy re-baseline** — spikes A–F have been frozen since 2026-07-20; much of their ground was built another way (flywheel, seats, N1/N2 cadence). Re-scope what of T-LG-1…5 and T-CC-1 still needs building. *(New ID; replaces the 7 stale spike rows.)* | `specs/2026-07-20-living-galaxy-program-design.md`; Spike G resolved into the background-agency spec. |
| T-TRD-1 | **Sector markets** — per-sector supply/demand → scarcity pricing; one model for buy/sell/exchange (revisit Rift ±25%); kill the no-holdings 25/day currency fallback | archive row (Daak 2026-08-09) |
| T-LORE-1 | **Chronicle & Rumor — information travel** — who knows what, spread via sub-faction/planet networks; memory fading as bigger events eclipse | Partly built: the Chronicle (N2) and Hall rumors (slice A). Re-scope to the remaining "information travels" layer. |
| T-SPACE-1 | **Space combat** — void battles, blockades, orbital superiority gating ground invasions | Orbits, space layers and ships exist in canon; no mechanic. The Blockade mission waits here. |
| T-MISC-2 | **Destructible battlefield objects** — pieces with HP to attack/protect | Nothing yet. Unlocks the Daemons Warp-Rift signature mission and E3's baggage train. Small session. |
| T-STORY-1 | **Victory arc / story mode** — what a solo Commander plays *toward* | Daak deferred it "until the alpha runs". |

## ❹ RULINGS & TUNING — one balance sit

| ID | Task | Inputs |
|----|------|--------|
| T-BAL-1 | **Balance sit** — ① NPC spawn rank: generic spawns are rank 1 (7.4% carry a usable kit) — scale with difficulty? ② weight `KIT.mint` toward condition-carrying rows? ③ band dominance: should a kit action outrank a weapon attack at any AP cost? ④ walk the flagged-for-review numbers: `rules.ultimatum`, `rules.cadence`, `rules.seats`, `rules.doctrine` + `ai.behavior_matrix`, `rules.npc_kit`, `rules.npc_brain`, the Hall tunables, mission `named_premium`. *(New ID.)* | Balance Lab v2 report `.superpowers/sdd/2026-09-06-lab-v2/balance-warband-v2.md`, `tools/arena.js`; the tunables lists in CLAUDE.md and each spec's "Tunables" section. |

---

## PARKED — do not pick up

| ID | Task | Why parked |
|----|------|-----------|
| T-AI-1 | Real AI summaries + NPC posting + Action-Block refereeing | Stage 3; needs T-S2-1 first. |
| — | Events thread type (warp storms, splinter fleets) | Stage 3 AI referee. |
| T-ENG-2 | Trade escrow / dispute → combat | Folds into T-DIP-1 (Bonded Trade term); close when D1 ships. |
| T-WALK-1 | Walkable ASCII location interiors | Paused mid-brainstorm; `docs/research/ascii-walkable-city/NOTE.md`. |
| T-ART-1 | Art pass for placeholder slots | Being absorbed by `lab/procgen` + `lab/uikit` (T-VIS-1, T-BIBLE-1, T-UI-1). |
| — | Augmetics · per-force item inventories | Vetoed for now / ships era. |

---

## DONE (full reports in `docs/backlog-archive.md`)

| ID | Task | Canon | Landed |
|----|------|-------|--------|
| T-TERR-2 (seats) | Seats, Trust & Standing | v1.35 | PR #1 `95ef9d7` |
| T-NPC-4 | Personality combat doctrine | v1.34 | pushed `563d628` |
| T-NPC-3 N1 | Ultimatum clocks, tribute, the world fights back | v1.33 | pushed `e6df3af` |
| T-TIME-1 | Per-planet day structure + one clock | v1.32 | merged |
| T-CMB-2 · T-CMB-3 | Weapon-borne conditions + condition range/fog gating | — | merged 2026-08-06 |
| T-MSN-1C | Streaks + 18 signature missions | v1.31 | pushed `8f44cf8` |
| T-MST-1 | Open recruitment + local forge traditions | v1.30 | pushed `a26c6bd` |
| T-GX-G7 · G7e | Galaxy re-run (types, doors, routes) · crown worlds never sleep | v1.29 | pushed `c5cf109` · `4e18d72` |
| T-MSN-1B | 8 more universal missions, modifiers, named targets + rulings slice | v1.27–1.28 | pushed |
| T-ECN-2a | Early Tradeport exchange valve | v1.25 | pushed `f89d24f` |
| T-DOOR-1 · T-DOOR-2 | Door tiers · Armoury merged into Shop/Forge | v1.24 | pushed `87e8c44` |
| T-ECN-1 | Economy E1 — typed resources | v1.23 | pushed `87e8c44` |
| T-CMB-1 | Combat conditions tick & apply | v1.22 | pushed `f6a32af` |
| T-MSN-1A · T-THR-5 | Missions spine · live thread state survives reload | v1.21 | pushed `6690929` |
| T-ITEM-1 · T-MISC-1 | Remains + Capture | v1.20 | pushed `7a6e58d` |
| T-TERR-1 · T-RIFT-1b | The flywheel (territory + production) · felt Rift penalties | v1.19 | merged |
| T-TERR-2 (founding) | Crown-world founding *(same ID reused by the seats task above)* | — | merged |
| T-GX-G6 slice 1a | RIFT core | v1.18 | merged |
| T-GX-G1…G5 | Galaxy mint — 5 segmentums, 27 sectors, 87 planets, 287 locations | v1.12–1.16 | merged |
| T-LG-SG | Spike G — NPC-initiated threads (layered hybrid) | — | resolved into the background-agency spec |
| T-LG-0 | Living Galaxy program design map | — | merged |
| T-QA-2 | Balance Lab v1 (superseded by Lab v2, shipped with T-NPC-3.5) | — | done |
| T-NPC-2b · T-THR-1 · T-FD1 | Enemy AI turns · speaker-coloured thread log · front door + persistence | — | merged |
| T-BF1 | Terrain cover in the damage step | — | merged |
| — | Battlefield grid slices A–E · living-world tick · catalog migration · free-form slots + armour | v1.7–v1.11 | shipped |
