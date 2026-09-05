# T-NPC-3.5 — Full-Loadout NPC Combat — Design (LOCKED 2026-09-06)

**Status:** DESIGN LOCKED with Daak 2026-09-06 after a research sit (see §1). Successor to the nulled Balance Lab v1 verdict: the game's NPC combat brain only ever fires weapons, so abilities/casts/items/tags are inert in every AI-driven battle. This slice makes NPCs fight with their whole kit, then re-runs the Balance Lab.
**Builds on:** THREAD core combat (v18 grid/fog/AP/CONDS), T-NPC-4 doctrine axes, T-NPC-3 N1/N2 (clocks, dramas, statistical battles), T-QA-2 arena harness.
**Canon target:** data v1.38. Engine lane: HOT.
**Research provenance:** `docs/research/ai-action-selection/` (utility-school, case-studies, architectures-and-personality). The design below is the industry-convergent shape: Battle Brothers' scored-utility loop with Dragon Age: Inquisition's designer-facing authoring contract; alternatives (BT/GOAP/HTN/MCTS) evaluated and rejected there with reasons.

## 0. Daak rulings this sit

1. **Doctrine-flavored choices** — personality tilts a tactically-sound scorer; never a script, never personality-blind optimal play. (Refined by the research sit: the scorer is the design, the lore layer is a thin data tilt — Daak: "the lore axis isn't the key.")
2. **Rank-scaled kits** — NPC forces spawn with faction-legal slots filled, depth by rank; casts obey the player rank gates (R3/R5).
3. **Pragmatism-gated consumables** — high-pragmatism forces spend items early and correctly; low-pragmatism forces barely remember them. Consumables genuinely deplete.
4. **Statistical battles get a small seeded kit nudge** — same order as the T-NPC-4 doctrine nudges, printed in the arithmetic.
5. **The two lab-found engine bugs ride along** (corpse-vision, move-validate rejection); **the mercy-lock stays** as canon behavior.
6. Approved battle shape: the six-step turn (§3) exactly as presented ("go for it this sounds great").

## 1. What the research settled (the one-paragraph version)

Every well-regarded tactics AI surveyed runs: gate legal actions → score each action+target pair → pick weighted-randomly among the top scorers. Personality across the industry is a data weight-set over ONE shared brain (Civ agendas, XCOM behavior sets, Nemesis traits) — never forked code. The public failure case (Age of Wonders 4) scored abilities without their targets. Difficulty is built from stats/budgets, never a deliberately dumber scorer (XCOM Legendary). Dragon Age: Inquisition's two exportable lessons: designer-readable score BANDS per action class, and a full per-turn score trace as the debugging backbone.

## 2. Kit minting — NPCs spawn armed like people

A pure, seeded generator (`KIT` in a new `/*<kit-core>*/` region or folded beside CAD — implementer's structural call) runs wherever NPC detachments spawn (siege clocks, dramas, mission hostiles, drama defenders):

- Fills each generated model's slots **faction-legally**: weapons as today; items/abilities from the faction-legal catalog (commons + own-faction rows, mirroring `doorCatalog`'s filter); casts only on caster-slotted models, gated by the player rank rules (`castRank` R3/R5 vs the model's rk).
- **Depth by rank:** rank 1 → weapon + (seeded ~50%) one item; rank 2-3 → + one ability; rank 3+ casters → casts per rank gate. Exact ladder is a canon table (`rules.npc_kit.depth_by_rank`), a flagged tunable.
- Seeded off the spawn's existing seed stream (`ULT.seedFor` family ⊕ model id) — same siege, same day, same kit; chunk-independent.
- Applies to the Balance Lab's build generator too (the lab samples kits through the same function — one source of truth).

## 3. The brain — six steps per NPC turn

Replaces `npcTurn`'s weapons-only action pick; movement/targeting doctrine styles (ONSLAUGHT/CULLING/DECAPITATION) remain as movement shaping, now fed by the same scorer.

1. **PERCEIVE** — legal knowledge only: the side's own fog via `spottedEnemies`, **living enemies only** (fixes lab bug 1: corpses no longer count as spotted).
2. **ENUMERATE** — every legal action+target pair per model with AP: each weapon × each visible enemy; each equipped cond-carrying cast/ability/item × each legal recipient (self/ally/enemy per its parsed payload, reusing the player-side `condEffectsFor` machinery); movement candidates. Typical space: 10-40 pairs.
3. **SCORE** — each pair starts at its **canon band** and slides within it by concrete considerations, combined multiplicatively with a geometric-mean compensation (utility-school standard):
   - expected wounds after armour (attacks, damage conds over duration vs target's remaining life)
   - actions/movement denied (Suppressing/Slowing valued by what the target would have done)
   - damage prevented/restored (buffs/heals valued by the recipient's actual peril — buffing full-health scores low)
   - AP efficiency (score per AP; casts cost 2, abilities 1, items 0 — unchanged)
4. **TILT** — the force's rolled five-axis profile multiplies scores continuously: ferocity × closing/melee, cunning × denial/ranged, supremacism × leader-targeted, honor ≥70 vetoes DoT/cruelty tags (≤30 favors them), pragmatism scales consumable willingness (ruling 3). Data-only; no per-faction code.
5. **DRAW** — discard candidates below a cutoff fraction of the best score; seeded weighted draw among survivors; small **inertia bonus** to the previously chosen line (anti-dither). Deterministic per seed; varied across seeds.
6. **STAGE + TRACE** — chosen actions flow through the SAME `validate` → `apply` pipeline a player post uses (no private physics; fixes lab bug 2 by validating moves in assignment order — see §5). Every scored candidate is appended to a per-turn **trace** (`state.aiTrace`, capped ring buffer) — the debugging/tuning backbone and Lab v2's analysis feed.

### Canon score bands (`rules.npc_brain`, all flagged tunables)

| band | class | range |
|---|---|---|
| basic_attack | any weapon attack | ~10 base |
| offensive | damage/debuff cast, ability, or hostile item on an enemy | 20-40 |
| support | buff/heal/cleanse on self or ally | 25-45 |
| reaction | emergency plays (heal a dying model, counter a leader threat) | 50-70 |

Plus: `draw_cutoff` (fraction of best score that survives to the draw), `inertia_bonus`, the tilt multiplier curves per axis, and the consumable-willingness curve over pragmatism.

## 4. Statistical battles — the kit nudge (ruling 4)

`ULT.resolveLapse` callers compute a small seeded kit-depth modifier per side (casters and ability-carriers tilt the roll a few percent, same magnitude family as the T-NPC-4 doctrine nudges) and print it in the arithmetic line. One canon tunable family (`rules.npc_brain.lapse_kit_nudge`).

## 5. The two engine fixes riding along (ruling 5)

1. **Corpse-vision:** `spottedEnemies`/the sighting path no longer counts dead combatants as spotted; the harness's workaround becomes the engine's truth. Affects live dramas today.
2. **Move-validate ordering:** `validate` accepts an NPC block whose moves are consistent **in assignment order** (a model may step into a cell another staged move vacates earlier in the same block). Player-staged blocks are unaffected (the UI already prevents this shape). The harness's strip-moves fallback is then removed.
3. **Mercy-lock stays** — two high-honor forces sparing each other's wounded is intended canon; dramas already resolve via the 60-day cap; the Lab counts it a draw.

## 6. Balance Lab v2

When the brain ships: `tools/arena.js` swaps its driver to the full six-step brain and kit-minted builds, and the WARBAND tournament re-runs measuring the real design space (casts, abilities, items, tags, armour, forge combos). Fresh Warband Ledger artifact; v1 stays archived under its null banner. The trace feeds per-combo analytics (which casts actually swung fights, not just which were carried).

## 7. Tests

- Pure cores: KIT (legality — nothing off-faction/off-rank ever minted, property-tested over all 20 factions; depth ladder; determinism), the scorer (band placement, consideration math incl. denial/peril valuation, geometric-mean combination), TILT (axis monotonicity: more cunning → denial rank never falls), DRAW (cutoff, inertia, determinism, distribution sanity over many seeds).
- Engine-fix pins: corpse-vision (a side seeing only corpses stages a real action), move-ordering (a leapfrog block validates).
- Doctrine integration: the T-NPC-4 doctrine tests keep passing (movement styles unchanged).
- Statistical nudge: arithmetic line pins + chunk-equivalence holds.
- Browser E2E per engine task; a full drama run in-browser with kit actions visibly landing in posts.

## 8. Tunables flagged for Daak

Everything in `rules.npc_kit` and `rules.npc_brain` (§3 table + curves), the lapse kit nudge, and the kit-depth ladder. The trace exists precisely so tuning sits argue from evidence.

## 9. Out of scope (parked)

- Intent telegraphing (Into the Breach-style "the warband readies a charge" preview posts) — noted as a beautiful future fit for play-by-post; not this slice.
- Squad-level coordinated plans (HTN-style multi-model combos) — the force-level doctrine + model-level scorer approximates this; explicit coordination is a later slice if play demands it.
- Player-facing AI difficulty settings; NPC gear economy (kits are minted free — NPCs don't buy).
- Seeding `bfSetup`'s board generation (the pre-existing Math.random ticket) — separate, still open.
