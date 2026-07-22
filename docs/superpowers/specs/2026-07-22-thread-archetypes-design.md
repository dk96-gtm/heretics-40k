# Thread Archetypes — Design Spec (T-THR-2)

**Status:** DRAFT for review · 2026-07-22
**Goal:** Define every way a Commander interacts with the world through a Thread — clearly enough to drop into the game. The engine runs 5 generic parent types today; canon lists 15+ subtypes across two disagreeing blocks. This spec reconciles them, reduces them to **5 archetypes**, and defines each subtype's *definition · resolution · options · world-effect*.

> A **Thread** is one typed, turn-based conversation attached to a place. It carries live `state`, runs through the one `threadView` loop, and now (T-TERR-1) reaches an **outcome** that mutates the world on conclude. This spec defines what "outcome" means for every kind of thread.

---

## 0. Canon reconciliation (do this first)

The subtypes live in two blocks that disagree. **Resolve to one source of truth** — a new `rules.thread_archetypes` block (or fold into `thread_scales`). The reconciled set:

| Parent | Archetype | Subtypes (canonical) |
|--------|-----------|----------------------|
| Skirmish | **Battle** | Duel, Raid |
| Invasion | **Battle** | Expansion (PvE), Domination (PvPvE), Exterminatus, Crusade (sector) |
| Mission | **Objective** | Defend, Convoy, Evacuation, Rebuild, Purge, Consecration, Desecration, Blockade |
| Diplomacy | **Parley** | Trade, Alliance, Tribute, Ceasefire *(3 proposed new — DECISION 1)* |
| Travel | **Transit** | *(none — leg structure is T-THR-3)* |
| Events | **World Event** | Tithe, Warp Storm, Resource Strike, Husk, Awakening |

A thread gains a `subtype` field. `startThread(pid, loc, type, subtype, npcId)`. The name-string "Duel" hack (`/duel/i` in `exitThread`) is removed in favour of the real field.

---

## 1. The shared primitive: **post budget + threshold resolution**

The audit's key finding: **battles can only end by annihilation** — nothing codes the "hold the ground when the posts run out" rule the UI promises. Both Battle *and* Objective need the same missing primitive:

- **Post/turn budget** — a thread has `postCap` (per scale: location ~6, planet ~10, sector ~16). Each side's turn consumes budget.
- **Threshold check on each post + at budget expiry** — the archetype defines a `resolve(state)` that returns `{winner, kind}` or `null`. `THREAD.outcome` becomes archetype-dispatched, not hardcoded to alive-count.
- **Expiry tiebreak** — when the budget runs out with no decisive result, the archetype's tiebreak decides (Battle: who holds the field / most PC alive; Objective: was the target met).

Build this once; every archetype plugs into it. This is **slice 1** and it retro-fixes the annihilation-only battle.

---

## 2. ARCHETYPE A — BATTLE  *(Skirmish + Invasion)*

**Definition.** A contested grid engagement between two or more Forces on a generated battlefield. Already built: blind deploy → Lock In → fog-of-war grid combat (move/attack/ability/cast) → per-model wounds, armour, kills, revival windows.

**What resolves it.**
1. **Annihilation** — a side has no living model *(built)*.
2. **Rout / Exit** — a side breaks contact; recorded a defeat, pursuit may open *(built)*.
3. **Hold the field** — post budget expires; the side holding the objective square / with more surviving PC wins *(NEW — slice 1)*.
4. **Mutual** — both wiped, no victor *(built)*.

**Options each side has (the action catalog — built).** Move (speed flood-fill), Attack (weapon by range band), Ability, Warp Cast, Use item. NPCs act via `THREAD.npcTurn`. Fog gates targeting. *Gap to add:* an explicit **Objective/hold action** for hold-the-field, and **Retreat** as a first-class move (today Exit is a thread-level button).

**World effect on conclude (canon `thread_scales.effect`).** Skirmish `conflict +5`; Invasion `conflict +15, prosperity −5`. Winner reward: Currency + Dominance (+Influence for Invasion). Kills stamp element revival windows *(built)*.

### Subtypes

| Subtype | Definition | Resolution twist | World effect on win |
|---------|-----------|------------------|---------------------|
| **Duel** | 1v1. Exactly one model per side; a matter of honour. | No flee (a duel can't be fled — already half-coded). Ends when one model falls or yields. | No territory. Winner: Dominance/Influence + kill credit; the mob remembers. Loser's model wounded/slain per normal. |
| **Raid** | Strike a *named owned location* to loot it, not hold it. | Attacker wins by breaking the defender **or** by holding long enough to seize the cache, then may Exit *with spoils*. | Steal a % of the location owner's stored currency and/or one item (DECISION 2). `conflict +5`. No ownership change. |
| **Expansion (PvE)** | Take an unclaimed / NPC-held planet. | Standard Battle vs the mustered NPC garrison. | **Conquest** — planet → your holdings *(built, this is today's default Invasion)*. |
| **Domination (PvPvE)** | A planet contested by several Forces (PCs + NPCs) at once. | Multi-party; the planet goes to whoever holds the field at resolution. | Conquest to the victor; others recorded defeated. |
| **Exterminatus** | Don't take the planet — **end** it. | Battle to break the defender; on win the planet is *destroyed*, not captured. | Planet → **Dead**: taint→max (or a `dead` status), `prod_mult→0`, population→0, **all holdings there wiped — including the loser's and any third party's**. Influence-gated (900, per the throne-room stub). Reversible? — DECISION 3. |
| **Crusade (sector)** | A sector-scale campaign, not one fight. | A **meta-thread** that spawns a chain of Expansion/Domination sub-battles across the sector's contested planets; the crusade resolves when a majority fall. | Flips the sector. Highest Influence cost. Structure — DECISION 4. |

---

## 3. ARCHETYPE B — OBJECTIVE  *(Mission — 8 subtypes)*

**Definition.** Objective-based play where the win-condition is *reaching a target*, not killing everyone. May carry combat *pressure* (NPC interference) but you win by the objective. Mission is the parent that currently has **no real mechanic** — this archetype is the biggest new unlock.

**What resolves it.** Each subtype defines a **target metric** and reaching it within the post budget = success; budget expiry short of target = failure. Accept-gate exists *(built)*. Progress accrues per post (word-count and/or a staged action, mirroring the Travel meter).

**Options.** Post to advance the objective (a progress action + prose), plus optional **Defend** actions if NPC pressure is present (light combat sub-step, reusing the grid or an abstract exchange). Opposition (NPC or an opposing PC) posts to *set back* the metric.

**World effect.** Success: `prosperity += base × planet.prod_mult` (canon) + Currency/Dominance reward; taint subtypes shift taint. Failure: posts wasted; some raise conflict.

### Subtypes — grouped by family

**Sustain / Protect** *(win = reach a survive/deliver threshold)*
| Subtype | Target metric | On success |
|---------|--------------|-----------|
| **Defend** | Hold the location for N posts against NPC assault — it must not fall. | prosperity ↑, conflict ↓. **This is the player-facing half of an NPC siege (T-NPC-3).** |
| **Convoy** | Escort cargo A→B across N legs; arrive intact (ambush risk). | Currency reward; ties to travel legs (T-THR-3). |
| **Evacuation** | Extract X population/models before a deadline. | prosperity ↑ on the destination; the source may still fall. |
| **Rebuild** | Accrue N "work" posts to repair a damaged location. | Restores location `condition`; prosperity ↑. |

**Cleanse / Corrupt** *(win = shift taint)*
| Subtype | Target metric | On success |
|---------|--------------|-----------|
| **Purge** | Reduce taint at a location (clear infestation/cultists) by X. | taint ↓. Imperial-flavoured. |
| **Consecration** | Ritual (casts / word-count) to sanctify. | taint ↓, prosperity ↑. |
| **Desecration** | The Chaos inverse — a dark rite. | taint ↑, prosperity ↓. Reward: Influence for Chaos. |

**Deny**
| Subtype | Target metric | On success |
|---------|--------------|-----------|
| **Blockade (planet)** | Suppress a planet's supply/reinforcement for N posts; defenders try to break it. | Cuts the planet's production/garrison regen while held; planet-scale. |

**PC/NPC interaction.** A mission is offered (NPC posts it, or a door/board lists it) → player accepts → posts to progress. NPCs oppose per subtype (assault the Defend, ambush the Convoy, resist the Purge) via a light `npcTurn`. Missions can be PvE or open (an opposing PC takes the counter-objective — e.g. one PC's Consecration vs another's Desecration on the same location).

---

## 4. ARCHETYPE C — PARLEY  *(Diplomacy)*

**Definition.** Non-combat negotiation between parties (PC↔PC, PC↔NPC). Resolves by agreed terms — the staged Offer/Demand/Accept/Walk-away system *(built)*.

**What resolves it.** Both parties **Accept** → terms enact, thread closes. **Walk away** → closes with nothing (DECISION 5: does walk-away from a hostile parley escalate into a Skirmish?).

**Options.** Offer, Demand, Accept, Walk away *(built)*. Each subtype shapes *what the terms are*.

**World effect (canon).** `prosperity +1, conflict −3`. Reward: Influence.

### Subtypes *(only Trade is in canon — 3 proposed, DECISION 1)*
| Subtype | Terms shape | On accord |
|---------|------------|-----------|
| **Trade** | A concrete swap: currency ⇄ items ⇄ models. | Inventories transfer. Ties to T-ECO-1 hauls + T-ENG-2 escrow. |
| **Alliance** *(proposed)* | A pact: non-aggression or mutual-defence for N days. | Parties can't open Battle threads against each other while it holds; may reinforce. |
| **Tribute** *(proposed)* | One pays the other (currency/models) for peace or passage. | Payer buys off a stronger power; conflict ↓ between them. |
| **Ceasefire** *(proposed)* | End an active conflict without a winner. | Closes hostilities on a contested location; conflict ↓ sharply. |

---

## 5. ARCHETYPE D — TRANSIT  *(Travel)*

**Definition.** Movement resolution. Built: word-count arrival meter, force-scaled passage, arrival-at-controlled-planet procedures. **No subtypes**; the leg/post-per-layer structure is **T-THR-3**.

**What resolves it.** Arrival when the word target is met. Arrival at a hostile-controlled planet may spawn an **interception** → chains into a Battle (Skirmish). Warp-Gate departure waives passage *(plumbed; needs charted gates — T-GX-WG)*.

---

## 6. ARCHETYPE E — WORLD EVENT  *(Events — 5 subtypes)*

**Definition.** System-fired threads — the **world acting on the player**, not player-initiated. Fired by the world-tick or by conditions (**this is the payoff seam for T-NPC-3 agency**). Moderator-run at Stage 3; simple ones can fire from the tick now (DECISION 6).

**What resolves it.** Each event opens with a **response window** (in days/posts). The player responds; failing to respond in time resolves the event *against* them.

| Subtype | Trigger | What happens | Player response |
|---------|---------|-------------|-----------------|
| **Tithe** | Your hierarchy / a ruling power demands resources. | Pay currency/models by a deadline or take a standing/prosperity penalty. | Pay, negotiate (→ Parley), or refuse (→ standing hit / Battle). |
| **Warp Storm** | Rift flares over a region. | Travel/comms to affected sectors blocked or ×cost-spiked for N days. | Weather it, or risk passage at penalty. Ties to Rift + travel. |
| **Resource Strike** | A vein/wreck/cache surfaces. | A **timed opportunity** — race NPCs/PCs to claim. | Travel there + claim (may chain into a Raid/Battle). Reward: currency/gear. |
| **Husk** | A derelict appears (ghost ship, dead hive). | An explorable salvage site; risk/reward, may hold hostiles. | Board it → Objective (salvage) + possible Battle. |
| **Awakening** | Something stirs (Necron tomb, daemon incursion, Tyranid tendril). | Spawns a hostile Force → **Invasion pressure / siege** on nearby holdings. | Defend (→ Objective/Defend) or fight (→ Battle). The world's teeth. |

**PC/NPC interaction.** The event surfaces in the **World Digest** → becomes an **actionable thread** the player opens → responds. NPCs are the drivers (the tithe-collector, the storm, the awakened force). This is where T-NPC-3 and the thread system meet.

---

## 7. Decisions for Daak (the real taste-calls)

1. **Diplomacy subtypes** — expand beyond canon's lone "Trade" to add Alliance / Tribute / Ceasefire? *(recommend yes — Parley is thin with only Trade.)*
2. **Raid loot** — what's stealable (currency %? one stored item? gear off the defender?) and how much?
3. **Exterminatus reversibility** — is a Dead planet dead *forever*, or slowly recoverable (terraform/consecration over many ticks)?
4. **Crusade structure** — a meta-thread that spawns sub-battles, or one big sector-scale thread? (Meta-thread is cleaner but more work.)
5. **Hostile walk-away** — does abandoning a hostile Parley escalate into a Skirmish, or just close?
6. **Events now vs Stage 3** — do simple Events (Warp Storm, Tithe, Awakening) fire from the tick in Stage 1 (via T-NPC-3), or wait for the Stage-3 moderator/AI?
7. **Mission opposition** — are missions always NPC-contested, or can some be uncontested "just do the work" objectives?

## 8. Suggested build order (each a shippable slice)

1. **Canon reconcile + `subtype` field + post-budget/threshold primitive** — retro-fixes battle "hold the field"; pure-core testable. *(foundation)*
2. **Battle stakes** — Duel (1v1/no-flee), Raid (loot-on-win), Exterminatus (planet death). Reuses `concludeThread`.
3. **Objective engine** — the Mission archetype; Defend + Purge as first two subtypes (Defend doubles as the T-NPC-3 siege defence).
4. **Parley subtypes** — Alliance/Tribute/Ceasefire on the terms system.
5. **World Events** — folds into T-NPC-3; Warp Storm + Awakening first.
