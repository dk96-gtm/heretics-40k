# ALPHA V2 HANDOFF — session prompt (2026-07-26)

Paste this to the next agent working in /Users/daak/Projects/heretics-40k.

---

You are working on **Heretics 40K** (persistent play-by-post wargame; two files ship: `index.html` engine + `heretics-40k-data-v1.json` canon). Read `CLAUDE.md` (especially Multi-Agent Coordination) and `BACKLOG.md` first, then `git pull`. Rules that are non-negotiable: claim your task's row in BACKLOG.md before touching code; 🔥 `index.html` lane = one in-progress task at a time; `git add <explicit paths>` only, NEVER `-A`; `node --test` green at every pause; Daak pushes, you never do; always "model", never "chassis".

## Where the project stands

**Milestone A (playable solo alpha) is DONE and pushed** (`7a6e58d`, canon v1.20, 223/223 tests): title→found→play→save→CONTINUE on the live URL; full 87-planet galaxy; grid combat with fog; NPC fights back; INVASION conquest → holdings → production flywheel; Rift ±25%; speaker colours; travel.

**Just shipped (2026-07-26): the Capture & Remains spine** (T-MISC-1+T-ITEM-1, one slice, browser-verified E2E, 0 console errors):
- Canon v1.20: `Non-Lethal` weapon tag (floors damage at 1 wound), `Capture` item tag (tiers I/II/III = 3/2/1 AP), gear (common Shock Maul + Shackles; Drukhari Slaver's Snare; GSC Abduction Kit), `rules.spoils` tuning block.
- THREAD core (pure, node-tested): `capture` effect (fog-gated, exactly-1-wound gate, empty-slot carry, in-block duplication guards), `free` (rescue captive from a fallen carrier; heldBy-bound), aftermath `loot` (gear→spoils, body→REMAINS with revival window; shared slot accounting).
- Engine: standing Capture button, corpse ☠ markers (fog.seen-gated), aftermath phase + END THREAD, Loot gear / Take the body buttons, conversions to `S.inv`, TAKEN roster greying, Armoury verb cards (Inspect/Release/Execute), sell pricing (`ref.pc×` REMAINS 0.5 / CAPTIVE 1.0), Apothecarion revive (charges `max(6,pc*2)`; foreign → revive-as-captive), NPC ransom both directions in Comms.
- Spec: `docs/superpowers/specs/2026-07-24-capture-remains-design.md` · plan: `docs/superpowers/plans/2026-07-24-capture-remains.md`.

**Full design↔reality audit (2026-07-24)** found the content layer is the gap: the battle/territory spine is real, but missions/subtypes/doors-tiers/civilians/destructibles/space exist only in `docs/superpowers/specs/2026-07-22-thread-archetypes-design.md` (D1–D13) + `2026-07-21-thread-types-deep-design.md`.

## The Alpha V2 ladder — work top-down

1. **T-CMB-1 — conditions tick in combat.** SHOVEL-READY: locked spec `docs/superpowers/specs/2026-07-25-combat-conditions-design.md` + 8-task TDD plan `docs/superpowers/plans/2026-07-25-combat-conditions.md` (authored by a parallel session — read both before claiming). Today `THREAD.apply` only does `conds.push`; nothing ticks or expires.
2. **T-THR-5 — live thread state must survive reload.** Ticketed on BACKLOG (found during the spoils slice, pre-existing): `hydrate()` maps threads through `THREAD.create`→`initState`, which rebuilds `t.state` from static `seedState` — a mid-battle/mid-aftermath reload silently resets the fight. `SAVE.snapshot` already serializes `t.state`; fix on the hydrate side (prefer persisted state, then `SAVE.relink`), + a persist→reload round-trip test on a mutated combat thread. Real players WILL hit this.
3. **MISSIONS — the biggest concept→real gap. DESIGN-GATED: do NOT build without Daak.** Engine reality: `THREAD.catalog` returns `[]` for MISSION, `THREAD.outcome` excludes it — missions render+accept but cannot be won or paid. The design (D12.1–D12.3, locked): 14 universal mission families + 5 modifiers + 20 sub-faction signature missions; D13 defines the objective-tracker spine (`objective={kind,target,progress,params,done}`, ~10 tracker archetypes: count_kill, collect_item, survive_rounds/waves, protect_entity, force_composition, wounds_taken, streak, produce, restore/ritual). **Open decisions Daak must make first (cluster ❺+❼): who posts missions (doors? day-tick?), how many live at once, the payout formula, and which ~6 universal missions make the V2 cut.** Run a brainstorming design sit → spec → plan → build (2 slices: tracker spine + MISSION outcome/payout, then the mission content).
4. **DOORS — tiers + first signature doors. PARTIALLY DESIGN-GATED.** D11 (locked): every door has 3 tiers; upgrade cost = door_base × target_tier (base by rarity 100/150/250/400/200); Mechanicus-only Tier III off Forge/Shrine worlds; Mechanicus pays in sacrificed-model PC. All 20 signature-door mechanics are locked in thread-archetypes-design 8.7–8.10. **Open decision for Daak: where signature doors spawn (crown world only? every faction-ruled world?) and whether existing worlds start at tier 1.** Wave-1 candidates needing only shipped primitives: Skull Throne (dead→Dominance), Digestion Pool (dead→currency), Haemonculus Atelier (CAPTIVE→Influence), Grudge Ledger. The `doorSells` function in the engine is the `accepts:` hook the corpse/slave doors plug into.
5. **DEFER (post-V2, by design):** civilians+gender (T-MOD-1), destructibles (T-MISC-2), survival waves, streak counters, invasion deepening/Govern-vs-Annihilate (T-FAC-1/D7 — note D7's payout contradiction is still unresolved), space combat (T-SPACE-1), trade contracts (T-ECO-1), Events, real-AI summaries (T-AI-1).

## Known minor debt (roll into whatever slice touches the area)

Capture tag `tiers` is an array while sibling registry entries use strings (GLOSS render risk); `Non-Lethal` is `forgeable:true` with no `forge_cost` (needed before the Forge can offer it); UI duplicates `capture_ap_by_tier`/`free_captive_ap` reads (core doesn't export `captureAP`); `.tc.tkn` CSS mixes colour pairs; `sellPrice` fallback collapses missing CAPTIVE mult to 0.5; NPC multi-model turn posts labeled with first actor's name; Armoury Type column shows "undefined" for ARMOUR rows (pre-existing); Compendium PDF is 12 versions stale (T-DOC-1).

## Process that worked (keep it)

Brainstorm with Daak (one question at a time, AskUserQuestion) → spec in `docs/superpowers/specs/` → TDD plan in `docs/superpowers/plans/` → subagent-per-task with a reviewer gate per task → browser E2E (narrow, scoped runs — long Playwright sessions stall) → BACKLOG row `ready-to-push` → Daak pushes. Treat plan-embedded code as unverified (10 review findings last slice were plan-authored). Check review ranges for parallel-session commits before dispatching reviewers.
