# T-NPC-3 N2 — The Aggressor — Design (LOCKED 2026-08-16)

**Status:** DESIGN LOCKED with Daak 2026-08-16. Addendum to the parent spec `2026-07-27-background-agency-attention-design.md` (§Cadence, §Target selection, §Statistical resolution, §Auto-played dramas) — this document closes the gaps the parent could not know about: the standing matrix, seats/stationing, doctrine axes, tribute, and the kin-raid ruling.
**Builds on:** N1 (ultimatum clocks/lapse/tribute, canon v1.33), T-TERR-2 (seats/standing/casualties, canon v1.35), T-NPC-4 (doctrine axes).
**Canon target:** data v1.36. Engine lane: HOT.

## 0. Daak rulings this sit (2026-08-16)

1. **Scope: BOTH lanes** — near-player real deferred ultimatums AND far-galaxy NPC↔NPC statistical churn, as the parent spec locked.
2. **Kin-raid ruling (closes the T-TERR-2 park): the standing floor follows the faction you FIGHT, not the planet's ruler.** The player's combat-thread standing floor moves onto the faction of the opposing force. Fighting squatters on kin ground never punishes kin standing; fighting the ruler's own garrison is the kin-raid.
3. **Player-side tribute: FULL palette** — currency, planet stock, gear items, CAPTIVE/REMAINS return.
4. **Auto-played drama SHIPS in this slice** (cap 1 live), not deferred to N3.

## 1. Cadence — where the galaxy churns

Per tick day, per sector, one seeded roll (`day ⊕ sector id ⊕ 'cad'`):

```
p(event/day) = clamp(Conflict / 400, 0.005, 0.25)
```

Peace (Conflict 10) ≈ one event per 40 days; Warring (80) ≈ one per 5 days. When a sector fires, an **aggressor faction** is drawn from factions present in the sector (planet rulers + homed factions), weighted by doctrine **ferocity** (`fer/50` → ×0.2..×2.0 frequency multiplier).

**Throttles:**
- ≤ 1 active clock per location (N1 guard, exists).
- ≤ 2 active player-facing clocks galaxy-wide — a bad week is two fronts, never nine. A roll that would breach the throttle **retargets to the heaviest-weighted non-player candidate in the same draw**; if the draw has none, the event drops. Deterministic — same seed stream, no re-roll.
- ≤ 1 live drama.
- Far churn is unthrottled, only summarized.

## 2. Targeting — the weighted draw

**Gate (new since the parent spec): the authored standing matrix.** An aggressor may only target factions at ≤ HOSTILE (−2) on `rules.standing.matrix`. Weight ×1 at −2, ×3 at WAR (−3). Imperial↔imperial pairs can never fire; Tyranids fire at everyone. The matrix is the who-attacks-whom law.

Weighted draw over candidate holdings in the firing sector:

| factor | weight |
|---|---|
| adjacency | same-sector targets only in this slice (cross-sector = T-LG-3 seam) |
| weakness | × `1 / max(1, garrisonPC/200)` — garrisonPC includes level × condition AND the player's stationed force: stationing literally deters |
| rift | × 2 cross-side (Sanctus vs Nihilus) |
| instability | × 1.0 stub — succession design not built; explicit seam |

**Scale:** INVASION if the aggressor's muster PC ≥ 2× the target garrison, else RAID (SKIRMISH). INVASION only against planets (it can transfer the crown).

## 3. Near vs far — how events land

**NEAR — target is a player holding or seat:** the NPC opens a REAL combat thread with `t.ultimatum` (window via `pickWindow` off the aggressor's doctrine axes — exists), Besieged overlay, countdown. The player answers:
- **FIGHT** — join the thread; normal combat.
- **PAY** — §4 player-side tribute.
- **IGNORE** — N1 lapse resolution fires with the T-TERR-2 table-❸ stationed casualties.

**FAR — NPC↔NPC:** resolves INSTANTLY on the tick day it fires (no clock object): attacker muster PC vs `ULT.garrisonPC`, defender ×1.25, N1 outcome ladder, seeded (`day ⊕ holding ⊕ aggressor`). Outcomes write location conditions, sacked loot evaporates into the world (no player credit), and **captures transfer rulers** via a new `npcCapture(pid, faction)` — a generalization of `captureOnVictory` that writes the rulers overlay for ANY victor and fires `sweepSeatsOn` (the dormant sweep goes live: a player's seat on an NPC-lost world falls, with the T-TERR-2 casualty rules if a force was stationed). Digest/World Log carry every resolution with its arithmetic shown.

## 3b. The Chronicle — places remember their wars (Daak ruling 2026-08-18)

**Store the record, render the story.** Every resolution path — near lapse, far NPC↔NPC battle, capture, tribute settlement, drama conclusion — appends a compact record to `S.world.chronicle[locId]`:

```
{day, kind, att, def, outcome, arith, seed}
```

**Read:** the location panel's History section lists the location's records newest-first (one line each: name of the clash, day, sides, outcome). Opening a record renders a **full thread-styled war account** — posts from both sides tracing the tide of the fight, the RECORD arithmetic at the bottom — generated deterministically from `record + seed` through templated battle narration. It reads like a concluded public thread but is never stored; the same record always tells the same story, and Stage 3 can re-dress the same records with real AI prose without touching data.

**Remember:** NPCs at a location get its recent chronicle records injected into their context (approach-in-person and comms lines) via the existing NPCAI tiered-memory seam — what happened at a place is a fact its people speak from.

**Cap:** `chronicle_cap` (default 30) records per location, oldest evicted — the T-LORE-1 "memory fades" design later replaces blunt eviction with eclipse/rumor mechanics over this same ledger. Dramas remain real threads while live; their conclusion writes a chronicle record like every other resolution.

New save-state: `S.world.chronicle` (seeded in BOTH `foundingWorld()` and `init()`).

## 4. Player-side tribute (full palette)

When defending a clocked holding, the player assembles an offer from four sources:

| source | valuation |
|---|---|
| currency (`S.cur`) | face value |
| planet stock (Food/Material/Fuel at the besieged planet) | face value per `rules.resources` exchange sell rates |
| gear items (`S.inv`) | pc-derived value (same `pc` the shop sell path uses) |
| CAPTIVE/REMAINS return | base value × appetite premium ×2 if the model belongs to the aggressor faction |

The NPC evaluates offer-total against its demand (N1 `tributeOffer` sizing for the clock's scale) through the existing appetite + pragmatism math (`evalCounter` family), and: **accepts** (clock lifts, Besieged clears, offer transfers), **refuses** (clock keeps running), or **counters ×1.5 / ×2 once** — the player accepts the counter or the clock keeps running. All seeded, phase-gated to pre-Lock-In, mirroring N1's flow.

## 5. Kin-raid re-ruling (engine change)

The T-TERR-2 `startThread` hook moves: the standing floor is applied to the **faction of the opposing force seeded into the thread**, not `pRuler(planet).faction`. Consequences: fighting Tyranid squatters on a Death Guard world floors Tyranids (no-op at −3); attacking the ruler's own garrison floors the ruler (the true kin-raid); defending your own clocked holding never touches standing (the NPC initiated, not you).

## 6. The drama (cap 1)

When a FAR event lands on a **crown or story-flagged location** and no drama is live: instead of instant statistical resolution, spawn a real PUBLIC thread — both sides auto-deploy on the generated grid (seeded positions), auto-Lock-In, and `npcTurn` plays **one exchange per tick day** until the thread reaches an outcome, which then feeds the exact same resolution machinery (conditions/capture/log). The player can open the thread and read the war as it happens. `S.world.drama = {tid}` is a nullable pointer (cleared on conclusion); see §7 for the full new-key list.

## 7. Canon & save-state (v1.36)

**Canon `rules.cadence`:** `p_divisor: 400`, `p_floor: 0.005`, `p_cap: 0.25`, `ferocity_pivot: 50`, `matrix_gate: -2`, `war_weight: 3`, `weakness_pivot: 200`, `rift_mult: 2`, `invasion_ratio: 2`, `player_clock_cap: 2`, `drama_cap: 1` + `tribute_valuation` (sell-rate source, pc-derived items, captive `own_model_mult: 2`). ALL flagged tunables.

**Save-state:** `S.world.drama` (nullable pointer) + `S.world.chronicle` (per-location record lists, §3b) — both seeded in BOTH `foundingWorld()` and `init()`. Far churn itself is stateless (seeded per day); player-facing clocks are threads. Canon gains `rules.cadence.chronicle_cap: 30`.

## 8. Tests

- Pure `/*<cadence-core>*/` (CAD): `roll(sector, day, seedBase, canon)`, `pickAggressor`, `pickTarget`, `scaleOf`, `npcMusterPC` — seeded, chunk-independent (13 daily === one 13-day), node-tested.
- Guards: imperial↔imperial never fires (property test over the matrix); throttle invariants (never >2 player clocks, never >1 drama); weakness monotonicity (more stationed PC → lower weight).
- `npcCapture` + `sweepSeatsOn` integration; player-side tribute valuation math; drama driver on fixtures (auto-deploy → npcTurn exchanges → outcome feeds resolution).
- Chronicle: every resolution path writes a record (property test over all kinds); cap eviction; account rendering is deterministic (same record+seed → identical text) and DOM-free in the pure core.
- Browser E2E per engine task, 0 console errors.

## 9. Seams & out of scope

- Instability multiplier stub ×1.0 (succession design lands later).
- Cross-sector targeting (T-LG-3 grand strategy replaces the heuristic wholesale).
- Drama AI-dressing (Stage 3); more than one live drama.
- NPC↔NPC standing DRIFT from these wars (matrix stays static this slice).

## 10. Tunables flagged for Daak

Every §7 number; the ferocity frequency curve; the ×2 own-model captive premium; the invasion 2× ratio; the crown/story drama trigger set.
