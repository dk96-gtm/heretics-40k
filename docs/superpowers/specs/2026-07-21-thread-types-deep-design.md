# Thread Types — Deep Design (WORK IN PROGRESS)

**Status:** partial. 4 of 6 types LOCKED; 4 remaining OPEN (Invasion overlaps combat, so listed
separately). This is the durable capture of the brainstorming session on 2026-07-21 — it
supersedes the session scratchpad. Backlog task: **T-THR-2**.

**Purpose:** give every agent one clear contract for what each thread type *is*, how it hooks
into the other systems (travel, territory, economy, map, NPCs, persistence), what NPCs do in it,
what other PCs do in it, and how it resolves. Feeds `rules.thread_types` (canon) + the `THREAD`
core (`index.html`).

```
LOCKED (2026-07-21)          OPEN / TO EXPAND (T-THR-2)
─────────────────────        ──────────────────────────
✓ TRAVEL                     ◑ DIPLOMACY  (has terms state; refine)
✓ SKIRMISH                   ○ INVASION   (reuses grid; territory-flip = meat)
✓  ├─ DUEL   (subtype)       ○ MISSION    ★ deepest net-new (shell today)
✓  └─ RAID   (subtype)       ○ EVENTS     (largely Stage-3 AI referee)
```

---

## The spine (all types share this)

Every type runs ONE loop: `header → read posts → compose → optional ACTION BLOCK → post →
await`. What differs per type is (a) the action block, (b) the win/resolve condition, (c) which
world systems it reads and writes. The rules live in the pure DOM-free `THREAD` core
(`create` / `initState` / `catalog` / `validate` / `apply`).

Canonical types (`rules.thread_types`): **Diplomacy, Mission, Skirmish, Invasion, Events, Travel.**
Reward currencies in play: **Currency · Dominance · Influence** (Diplomacy skews Influence;
combat skews Currency+Dominance; Invasion touches all three + land).

---

# ✓ LOCKED TYPES

## ❶ TRAVEL — the connective toll

The journey rendered as a thread; **auto-spawned by movement**, never opened by hand.

- **Layered posting (NEW):** a move that crosses map layers requires **one post per layer
  crossed** — `Named Location → Planet → Sector → Segmentum`. The passage cost is **split
  across the layers**, so switching layers imposes a **minimum post count** and gives each
  layer its own beat for "something to happen."
- Within a single layer, the word-count meter may be filled in **one OR many** posts.
- **Arrival challenge fires PER LAYER** — each layer crossing can trigger its own arrival
  event. Deliberate: makes it HARD to simply "appear" in a heavily contested Named Location —
  you run the gauntlet layer by layer.
- **UI must make the current LAYER/LEVEL explicit** at all times.
- **Show the FORCE ROSTER** in the thread — who am I traveling with.
- Passage cost stays force-scaled (`tier.base × force PC ÷ 250`); **Exit refunds** (per-layer
  refund implied); free through a Warp Gate.

**NPC action:** a system's standing garrison can meet you at a layer's arrival challenge.
**Other-PC action:** interception on the route → can branch into a Skirmish (hook; not yet wired).
**World hooks:** map/galaxy (tier + adjacency), economy (passage/refund), time/tick (long jumps
should burn in-game days), Warp Gates (waiver), territory (owned vs hostile greeting).
**Resolution:** arrival = you're now *at* the destination; no Currency/Dom/Infl reward (it's a toll).
**State carried:** `transit{ tier, wordsReq, wordsWritten }`, `passage`, per-layer progression.

## ❷ SKIRMISH — the fight over a location

Most common battle type; combat between **two or more forces**. Runs the full v18 grid
(board, fog of war, terrain, LOS, cover).

- **Start:** must **declare a target** = another **Force in the same location**. The Skirmish
  is carried out in **that location**.
- **Win decided when:** all enemy models killed, OR one side chooses to **Exit via escape**.
- **Reward (winner):**
  - a **%** of the **two forces' combined Currency**;
  - **Dominance & Influence** scaled by the **ratio** of his force vs the defeated force
    (beating a bigger force pays more);
  - **wins the board**; may **loot fallen enemy models' loadout**;
  - may **revive his own killed models** — on-site via other models' items, OR after exiting
    (element-specific revival window).
- **Loser:** forced to **Exit** the thread.
- **Escape cost = pursuit-RISK (no fee).** Exiting via escape triggers a ranked-speed check;
  if the enemy is faster → CAUGHT → a fresh Skirmish opens "on worse ground." That risk *is*
  the cost. (Impl needs the full ranked-speed rule; `enemySpd=3` is a first-pass stub.)

**NPC action:** full AI via `npcTurn` (3-frame matrix × 5-axis faction personality).
**Other-PC action:** third parties can join a public Skirmish as a new side, or spectate.
**World hooks:** grid/terrain (board from planet⊕location⊕RNG), economy (payout), death/revival
(kills stamp windows), persistence (wounds/kills must survive reload — Stage 2).
**State carried:** `board`, `combatants{x,y,wounds,…}`, `pools` (AP/side), `fog`, `phase`.

### ❸ DUEL — Skirmish subtype

**1v1**, one model vs one model, on a battlegrid.

- **Start in an Arena.** Either fight a **local random model** derived from that Named Location,
  OR **hail an NPC or Commander** from your comms list to accept a challenge.
- **Stake:** set a **Currency price**; the opponent **matches** it or **declines**. Decline
  **cancels** the match. **Winner takes all** (the pooled stake).
- All duels are **public** and re-readable in that **Arena thread archive**.

### ❹ RAID — Skirmish subtype

Started at a **Named Location**; opens a battle board vs a **locally-derived force** whose
strength depends on that location's **"strength" / rank**.

- **Win:** the location's **current resources → converted to Currency** for the raider; plus
  **Dominion & Influence** scaled by the size of the forces defeated on the board.
- **Also hits the Named Location's population and other status** — a real wound to the holding,
  not just a payday.
- **Target = ANY Named Location, including your own kind** — betrayal (raiding an allied /
  same-faction holding) is explicitly allowed.
- **Visibility scales with target rank:**
  - low-ranking location → Raid **starts PRIVATE**, may be made public;
  - larger / higher-ranking location → Raid is **ALWAYS PUBLIC**.
  - Consequence: treachery is quiet only against small targets; hitting anything major is seen
    by all. (Rank ties to canon `population_ranks` / location strength.)

---

# ○ OPEN TYPES — to expand (T-THR-2)

Not yet defined to the fidelity above. Current state + what's known + what's undefined.

## ◑ DIPLOMACY — the fight without weapons *(refine)*

**Known:** every face-to-face non-combat negotiation between commanders — trade, alliance,
tribute, ultimatum. (Remote messaging is *Comms*; Diplomacy is co-located, formal, staked.)
Subtype: **Trade**. Engine has a real terms tray: `Offer / Demand / Accept / Walk away`, staged
in `state.terms` until both Accept, then executed. Reward: **Influence** (+ whatever terms move).
**Hooks:** economy (moves Currency/items, tribute streams), Influence, comms (remote hail →
co-located Diplomacy), territory (cede/trade land without a fight), NPC memory.
**Undefined / to design:** NPC evaluation of offers against faction personality axes; multi-party
negotiation; **Protocols** (published treaties others can read); failed-diplomacy → Skirmish
escalation seam; how tribute streams persist on the tick.

## ○ INVASION — taking the ground itself

**Known:** the type that **flips territory ownership** — Skirmish is over a spot, Invasion is
over the *land*. Runs the same v18 grid; the stakes are territorial. Subtypes:
`Invasion (PvP)` · `Expansion (PvE, claim neutral/NPC land)` · `Domination (PvPvE, 3+ sides)` ·
`Exterminatus (destroy the planet — world-ender class)`. Win by breaking the defender below
"Crusade strength" → the location's ownership record changes hands. Reward: **Currency +
Dominance + Influence + the land**.
**Hooks:** territory (★ ownership flip — blocked on Stage-2 persistence / T-TERR-1), economy
(captured land feeds the flywheel), map (re-colors sector; shifts Prosperity/Conflict/Taint),
Exterminatus (removes a planet → world-ender), time/tick (new holdings produce next tick).
**Undefined / to design:** "Crusade strength" threshold; ownership-transfer terms in state;
NPC-launched invasions (sieges — NPC Slice 2b); reinforcement / counter-invasion; how
Exterminatus routes into an Event.

## ○ MISSION — the objective op ★ deepest net-new work

**Known (thin):** an **objective-driven operation** — "do a specific job at a place before the
posts run out." Win condition is a *stated goal* (retrieve / hold / escort / sabotage /
assassinate / survive / salvage), NOT "beat the enemy" (Skirmish) or "own the land" (Invasion).
Canon: "objective-based, allies **AND** opponents" → natural home for **co-op** and PvE-with-a-twist.
Reward: **Currency + (Dominance & Influence)**.
**Current reality = SHELL.** UI has an accept-gate briefing, a map listing of "available missions
at reachable locations," and one flavor sentence — but the THREAD core `catalog()` returns `[]`.
**No objective state, no post-limit clock, no completion check, no payout.**
**Undefined / to design (the whole subsystem):**
```
◌ objective model     what KINDS of objectives exist + how each is tracked in state
◌ post-limit clock    "before the posts expire" — enforce it (tie to world tick?)
◌ combat-or-not       does a Mission use the board? optionally? no board at all?
◌ adjudication        who declares it DONE — mechanics / referee / Stage-3 AI
◌ mission generation  who authors them — NPC-seeded? procedural? moderator?
◌ co-op & failure     allies share reward? partial credit? explicit fail state?
◌ reward payout       Currency + (Dominance & Influence) — formula
```
**Hooks:** map (surfaces at reachable locations), NPCs (givers seed them; opponents oppose them),
economy (Currency payout → flywheel), time/tick (the post clock / expiry), territory (salvage/hold
objectives touch holdings).

## ○ EVENTS — the moderator / AI hand

**Known:** top-down, world-driving threads no player opens — Warp storm, splinter fleet,
Throne-Room world-ender. Canon: "moderator-run"; in our roadmap that moderator is the **Stage-3
AI referee**. Fired by the world tick / a referee / a Throne-Room world-ender. Can involve an
entire region; the event *is* the NPC (posts prompts, spawns opposition, adjudicates).
**Hooks:** time/tick (triggers), world-enders (Throne Room escalates here), map (reshapes sectors
— taint spikes, blockades), all types (an Event can spawn Missions/Skirmishes as children).
**Undefined / to design:** almost everything mechanical — largely blocked on the Stage-3 AI layer.
Least urgent for the solo alpha.

---

## Coverage snapshot

```
DEEP    ● Skirmish  ● Invasion   (v18 grid built; Invasion needs territory-flip)
MID     ◑ Travel    ◑ Diplomacy  (real state; Travel now spec-locked, Diplomacy to refine)
THIN    ○ Mission                (shell — the main net-new subsystem)
STAGE3  ○ Events                 (needs AI referee)
```

## Open design questions (for the OPEN types only — locked types have none)

1. **Mission** — the entire objective/adjudication/generation subsystem (see list above). Biggest.
2. **Invasion** — "Crusade strength" definition + ownership-transfer state; NPC sieges.
3. **Diplomacy** — Protocols, multi-party, failed-diplomacy→combat escalation, tribute persistence.
4. **Events** — deferred until Stage-3 AI; note the tick/world-ender triggers now so they're reserved.

## Next step

Resume brainstorming on ONE open type at a time (recommended order: **Invasion → Diplomacy →
Mission**, saving Events for Stage-3). Then finalize this doc, spec-self-review, and hand to
writing-plans for the engine/canon implementation.
