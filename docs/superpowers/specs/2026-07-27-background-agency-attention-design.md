# Background Agency & the Attention Layer (design)

> **Status:** design LOCKED with Daak, 2026-07-27. Resolves **Spike G** (NPC-initiated
> thread resolution) and sets the direction for **T-NPC-3** (NPC agency on the world-tick),
> plus the player-facing **attention layer** (severity tiers, the Strategium screen,
> banners). Spike G was board-owned by the `opus` design session "resolving with Daak" —
> this session IS that resolution; fold it into the spike row rather than forking it.
> **Constraint:** everything runs on the existing WORLD tick (deterministic, seeded,
> replayable, `Date.now`-free) and the THREAD spine. Stage-1 solo first; Stage-2 relocates
> the same shapes server-side.

## Locked decisions

| Axis | Decision |
|------|----------|
| Resolution model | **The layered hybrid.** Your holdings → a real deferred thread that WAITS (an Ultimatum window); expiry → garrison-favored statistical roll. Far galaxy → statistical only, digest/feed-reported. Named-NPC dramas / crown worlds → occasionally auto-played into a readable NPC-vs-NPC thread (rare, budgeted). |
| The two clocks | **Ultimatum** = respond-by window BEFORE a thread is joined, set by the INITIATOR at creation. **Objective clock** = the round counter inside a running thread (already designed — archetypes spec 2026-07-22; untouched here). |
| Ultimatum agency | The initiator (player OR NPC) chooses the window inside per-scale bands; NPC choice is personality-driven (ferocity → short ultimatums, cunning → long strangles). Bands: **Raid 4–8 · Skirmish 8–16 · Invasion 12–24 game days** (6 game days ≈ 1 real day at 240 min/day). Same mechanic both directions — player-initiated threads against NPCs carry Ultimatums too. |
| Attention model | **Three severity tiers** (Urgent / Notable / Ambient). ALL events of every tier land in ONE place (the Strategium feed) — nothing exists only as a banner. Urgent additionally gets a slim all-screens banner strip, **click-dismissible per event** (dismiss = acknowledged; the item lives on in feed + map until its clock resolves). Map markers per news item, click-through both ways. |
| Banner rule | Only events with a **running clock the player can still act on** (their own Ultimatums, succession events) earn the banner. The game never cries wolf. |

## The Strategium (new screen)

A dedicated screen: **Active Clocks** on top (the player's Ultimatums and mission deadlines,
sorted by time remaining, click → jump to thread), the **Feed** below (every event, all
tiers, filterable by severity and sector, each item linked to its map marker). This is the
single source of truth the attention tiers point INTO.

Severity homes:

- **⚠ Urgent** — Ultimatums on the player's holdings, succession events. Banner strip on
  all screens (max ~2 lines; multiple events collapse to "N holdings under threat ▸"),
  plus feed + map marker.
- **◆ Notable** — production drops, wars adjacent to the player's borders, moves by NPCs
  the player has met. Top of the World Digest + feed + map marker. Never interrupts.
- **· Ambient** — the far galaxy's churn. Feed (and the existing World Log) only.

## Cadence — where the galaxy churns

Per tick, per sector: event likelihood scales with the sector's **Conflict score** (existing
meter). Peaceful sectors sleep for weeks; warzones churn. Pacing guards: **max one active
Ultimatum per holding**, and a galaxy-wide throttle on player-facing deferred events (a bad
week is two fronts, never nine). Far-galaxy statistical churn is not throttled, only
summarized (Ambient).

## Target selection (alpha heuristic)

When an NPC faction acts, targets are picked by weighted draw:

1. **Adjacency** — bordering enemies first;
2. **Weakness** — thin garrisons / low CP invite raids;
3. **Instability** — the succession flag (death & succession design) is an explicit
   multiplier: a realm mid-succession is when the jackals come;
4. **Rift standing** — cross-side hostility outweighs same-side friction.

Faction personality scales aggression frequency and Ultimatum length (behaviour-matrix base
values: World Eaters roll often and short; T'au probe rarely and deliberately). This whole
heuristic is a **seam**: T-LG-3's grand-strategy goals replace it later without changing the
event/Ultimatum machinery.

## Statistical resolution (timer lapse + far galaxy)

- Attacker strength: a mustered detachment per the existing opposition-muster rules.
- Defense: garrison + fortification bonuses (Fortified condition, Fortress-world effect) +
  ruling-faction home bonus.
- **Defender-favored ×1.25** (locked earlier in the Spike G discussion).
- Outcome bands: **repelled · repelled with losses · sacked · captured** — mapped onto the
  existing conquest/`Sacked` machinery.
- Rolls are **seeded and deterministic** (seed = tick day ⊕ holding id ⊕ aggressor id) —
  same discipline as `WORLD.catchUp`; a replayed history tells the same story.
- Every resolution writes to the feed **with its arithmetic shown** — the player can always
  see why they lost.

## Auto-played dramas (the rare B-tier)

Budgeted, occasional: a named NPC vs named NPC conflict at a crown world or story-heavy
location actually plays through the THREAD spine (`npcTurn` both sides; AI-dressed later at
Stage 3) and leaves a readable public thread. Cap: at most one active auto-played drama at
a time in Stage 1. These are set-pieces, not the economy of the system.

## Integration map

- **WORLD tick** — hosts cadence rolls, Ultimatum countdowns, lapse resolution, feed
  writes. All catch-up-safe and bounded by `max_catchup_days` like everything else.
- **THREAD spine** — deferred events are real threads (seeded like opposition musters);
  Ultimatum is thread metadata; expiry resolution reuses `outcome`/conquest paths.
- **T-TIME-1** (clock unification, design locked) — prerequisite: one epoch spine before
  Ultimatums count real time. Build order: T-TIME-1 → this.
- **Death & succession** — Instability flag consumed here (elevated targeting).
- **Economy (T-ECN-*)** — sacked/captured outcomes hit stockpiles and production shares.
- **T-LG program** — Spike G: RESOLVED (this spec). Target heuristic is the placeholder for
  System ③ goals; the scheduler shape here feeds System ⑤.

## Implementation notes

Three slices, each its own plan, all 🔥 engine + canon + tests:

- **N1 — clocks & Ultimatums:** T-TIME-1 fold (prerequisite), Ultimatum metadata on
  threads, initiator-set windows w/ bands, lapse → statistical resolver, seeded rolls.
- **N2 — the aggressor:** cadence rolls per sector, target heuristic, deferred-thread
  creation (siege appears as a joinable INVASION/RAID at your holding), pacing guards.
- **N3 — Strategium & attention:** the screen (clocks + feed + filters), severity tagging
  of all existing digest/log events, banner strip + per-event dismiss, map markers
  click-through. (N3 can land before N2 — the feed is useful the moment ANY event exists.)

## Deferred

- Auto-played dramas beyond the single-slot cap; AI narrative dressing (Stage 3).
- Out-of-game reach (email/push) — Stage 2+, explicitly not now.
- Grand-strategy targeting (T-LG-3) replaces the heuristic at its own pace.
