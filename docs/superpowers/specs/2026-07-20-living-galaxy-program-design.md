# THE LIVING GALAXY — Program Design Map

**Status:** DESIGN IN PROGRESS (2026-07-20). This is the **parent design doc** for a
multi-system program. It captures the vision, the system breakdown, cross-system
implications, and the open design spikes. Each System below gets its **own** spec → plan →
build cycle; this map is the trunk they branch from.

**Owner:** opus · sess:b87383b0-7074-4df6-a4dd-093277cd57c6
**Backlog group:** `LIVING GALAXY` program (see `BACKLOG.md`).

---

## 1. Vision

Heretics 40K's galaxy is **alive**. Every planet is governed. Every sub-faction pursues a
goal. Every NPC is an actor with drives. Things happen everywhere, all the time — not just
where the player stands. The player is **one force among many** inside a self-running
strategic world, and every playthrough is unique yet legible because all factions pursue
consistent, understandable goals.

This supersedes the original `T-TERR-1` ("player production flywheel"). Production is now
the *second* layer of a much larger structure: a **territorial-control spine** underneath a
**living strategic simulation**.

---

## 2. The Ownership Spine — the Major Hub primitive

One primitive repeats at every scale: the **Major Hub**. Ownership is a ladder built from it.

### 2.1 Major Hub (new universal primitive)
- **One Named Location per planet** is designated the planet's Major Hub.
- It has access to a **Throne Room door** (reframes the existing stubbed Throne Room, T-ENG-1).
- It is the single chokepoint where:
  - the planet's **Production & Resource-Spend** are allocated;
  - **threads are initiated** (mission / diplomacy / skirmish / raid…), **gated by CP** —
    a Commander needs enough CP to launch a given thread type.

### 2.2 The control ladder
```
MAJOR HUB (per planet — Throne Room, production/spend, thread-init)
   │
PLANET     owned by:  majority CP on-world  +  control of its Major Hub
   │ roll up
SECTOR     owned by:  most planets in sector  +  the SECTOR CAPITAL WORLD
   │                  (special planet; its Major Hub — a stronghold/fortress —
   │                   MANAGES every other hub in the sector; can launch great
   │                   thread types, e.g. INVASIONS, and manage sector resource/production)
   │ roll up
SEGMENTUM  if one sub-faction holds the MAJORITY OF SECTORS → it may designate a
           CROWN WORLD, whose Major Hub manages every planet-hub across the segmentum.
```

Three designations layer on the universal hub: **Major Hub** (every planet), **Sector
Capital** (one per sector), **Crown World** (one per segmentum, *earned* by dominance).

---

## 3. The Five Systems

```
① TERRITORIAL CONTROL   Major Hub primitive · planet/sector/segmentum ownership
   (the spine)          resolvers · capital & crown designation · hub-management UI
                        · CP-gated thread initiation.  BUILD FIRST — all else needs it.

② ECONOMY               per-planet production allocated at hubs · resource spend ·
   (reshaped T-TERR-1)   sector/crown aggregation · war/status multipliers.  ON ①.

③ FACTION GRAND-STRATEGY each sub-faction's GOAL (Tyranids=exterminate,
   (the "why")           Imperium=maximize empire…) · the IMPERIUM-AS-ONE rule (all
                         Imperium sub-factions share ONE empire; each Chaos/Xenos
                         sub-faction builds its OWN) · empire bookkeeping & trajectory.

④ NPC AGENCY             atomic actors: an NPC wants to raise a force of specific models ·
   (the "who/what")      seek XP via combat · ransack a Named Location — and LOCAL FORCES
                         aligned to that location fight back.  Extends the T-NPC line.

⑤ SIMULATION ENGINE      the scheduler that runs ③+④ galaxy-wide at a chosen FIDELITY,
   (the "how much")      keeps playthroughs unique yet goal-consistent, surfaces
                         off-screen events.  Extends the living-world WORLD tick.
```

---

## 4. Dependency & build order

```
① TERRITORIAL CONTROL ─┬─► ② ECONOMY
   (spine — first)      │
                        ├─► ③ FACTION GOALS ──┐
                        │                      ├─► ⑤ SIM ENGINE
                        └─► ④ NPC AGENCY ──────┘
                                    ▲
   ⑤'s SCALE decision (SPIKE-A) ────┘  decide EARLY — caps the cost of ③ & ④.

feeders:  T-CC-1  (start-holdings by background)  → seeds ①'s ownership
          T-CONQ-1 (conquest)  → now = "take the Major Hub + win CP majority" on ①
```

**Recommended sequence:** resolve the spikes (§6) → spec & build ① → fold ② onto it →
design ③ + ⑤-scale together → build ④ at the chosen fidelity → wire ⑤ scheduler + surfacing.

---

## 5. Implications & integration (how this touches what already ships)

This program reshapes several shipped systems. Each is a **connection to design deliberately**,
not a bolt-on (per the BUILD LAW — extend the existing seam).

- **THREAD core / `threadView`** — threads become **initiated from a Major Hub Throne Room,
  CP-gated**, and **NPCs initiate threads too** (agency → thread instances), not only the
  player. New thread types: **ransack**, **invasion**. Local-force **reaction** extends the
  shipped `T-NPC-2b` (enemy-fights-back) from the *combat-turn* level up to the
  *thread-creation* level. → touches `THREAD.create/catalog/validate`, `threadView`.
- **WORLD tick (`/*<world-core>*/`)** — grows from flat production+taint into the **host of
  the Simulation Engine**: a scheduler that advances faction goals + NPC drives galaxy-wide,
  doing **different work near vs. far** from the player (LOD). Stays pure/replayable.
- **NPC AI (`NPCAI`, `npcState`, T-NPC line)** — the existing per-NPC minds become the
  **HIGH-fidelity near-player layer**; a new **faction/statistical layer** models the far
  galaxy. They must compose cleanly (same goal vocabulary).
- **Save-state `S`** — significant expansion: per-planet Major-Hub control, dynamic Sector
  Capital / Crown designations, faction treasuries (allocated at hubs), faction empire +
  goal-progress state, NPC drive/objective state. **Ownership is largely DERIVED** (CP
  majority + hub control) rather than a stored flag — see SPIKE-E. All rides the
  `LocalStore→RemoteStore` storage-adapter seam; Stage-2 backend implications are real.
- **RIFT core** — already feeds the economy (home/away mult). Note its **sides**
  (Sanctus/Nihilus) are **not** the same axis as the **Imperium-as-one empire grouping**
  (an allegiance/empire concept) — we need a distinct `faction → empire` resolver (SPIKE-F).
- **Galaxy canon + readers (`fPl`/`fLoc`)** — canon must mark, per planet, **which Named
  Location is the Major Hub** (often a stronghold/fortress `location_type`); per sector, the
  **Sector Capital**; per segmentum, a **default Crown**. Partially exists: `crown:true` on
  25 planets (SPIKE-D reconciles this with the *earned* rule).
- **CP / Forces** — "majority CP" requires **real CP totals per planet per faction**. Today
  `S.world.forces` holds presence *strings*. This must become CP-bearing force records so an
  ownership resolver can compute the majority. → connects to the Forces system + army CP.
- **Character creation (Rites)** — `T-CC-1`: background + sub-faction decide **if/what world
  (and hub/seat)** a new commander starts owning. Feeds ①'s ownership seed.
- **doorCatalog / Throne Room door** — the Throne Room becomes the Major Hub's
  thread-initiation + resource-management interface. Reframes `T-ENG-1`.
- **Map UI** — must render ownership at every tier (planet/sector/segmentum), Major Hubs,
  capitals, crowns, and live off-screen events.

### 5.1 New seams/connections this program must create
```
● faction → empire resolver        (Imperium-as-one; Chaos/Xenos = self)
● CP-majority ownership resolver    (forces on a planet → owner)
● Major Hub registry               (planet → its hub Named Location)
● goal-pursuit engine              (faction goal → desired actions this tick)
● NPC-thread generation seam       (NPC drive → a thread instance)
● event scheduler + LOD zoning     (near/far from player → fidelity)
● treasury/allocation model        (production banked at hub; sector/crown aggregate)
```

---

## 6. Open design spikes (resolve TOGETHER before implementation)

> These are unresolved on purpose. We work them collaboratively next. Ordered by leverage.

- **SPIKE-A · Simulation scale / fidelity.** *How alive is the far galaxy, cheaply?*
  Recommended direction: **Level-of-Detail** — HIGH fidelity near the player (individual
  NPCs, real threads, real reactions), LOW fidelity afar (factions as statistical pressure;
  a weighted scheduler fires a *bounded* number of significant events/tick, seeded per
  playthrough → uniqueness, steered by faction goals → consistency). *Keystone — caps ③/④.*
- **SPIKE-B · Major Hub as the single control chokepoint.** Confirm/define that production,
  resource-spend, **and** thread-initiation all happen at the hub — nowhere else. Define the
  hub's data shape and how one Named Location per planet is chosen/marked.
- **SPIKE-C · CP-gating thresholds.** How much CP to launch which thread type (skirmish <
  mission < ransack < invasion < world-ender). Where the thresholds live (canon), how CP is
  measured (force totals present at the hub).
- **SPIKE-D · Crown/Capital canon reconciliation.** 25 authored `crown:true` planets vs the
  new *earned* rule (Crown = segmentum-majority) + the new Sector Capital designation. Likely
  outcome: authored crowns become **default/historical seats** that the dynamic rules then
  move; author Sector Capitals; define re-designation triggers. (Note: a few factions have 2
  authored crowns; one crown sits on a *Contested* sector.)
- **SPIKE-E · Ownership: derived vs stored.** Ownership = CP-majority + hub control. Is it
  **recomputed** each tick from forces (pure, always-consistent) or **stored & mutated** on
  events (cheaper, risks drift)? Determines the save-state shape and the tick cost.
- **SPIKE-F · Faction → empire model.** Where the Imperium-as-one grouping lives; how
  "largest empire" is measured across shared sub-factions; how goals attach to empires vs
  sub-factions.
- **SPIKE-G · NPC-initiated thread resolution.** When an NPC launches a thread with no human
  to drive `threadView`, how does it resolve? Options: statistical auto-resolve (far/LOD),
  auto-referee heuristic, or defer to a real player if one is present. Ties to SPIKE-A and
  Stage-3 AI. Governs whether the far galaxy "plays" threads or just *reports outcomes*.

*(Spikes E–G surfaced from the §5 implications analysis; A–D were the originals.)*

---

## 7. Workstream → backlog task map

| System / spike | Backlog ID | Kind |
|---|---|---|
| Program design map (this doc) | `T-LG-0` | docs |
| Spike A — simulation scale/LOD | `T-LG-SA` | design |
| Spike B — Major Hub chokepoint | `T-LG-SB` | design |
| Spike C — CP-gating thresholds | `T-LG-SC` | design |
| Spike D — crown/capital reconciliation | `T-LG-SD` | design |
| Spike E — ownership derived vs stored | `T-LG-SE` | design |
| Spike F — faction→empire model | `T-LG-SF` | design |
| Spike G — NPC-thread resolution | `T-LG-SG` | design |
| ① Territorial Control spine | `T-LG-1` | canon + engine |
| ② Economy on hubs (T-TERR-1 folds in) | `T-LG-2` | engine + canon |
| ③ Faction grand-strategy & goals | `T-LG-3` | engine + canon |
| ④ NPC agency | `T-LG-4` | engine (+THREAD/NPC) |
| ⑤ Simulation engine / scheduler | `T-LG-5` | engine |
| Character-creation start-holdings (feeder) | `T-CC-1` | engine + canon |
| Conquest → hub/CP flip (feeder) | `T-CONQ-1` | engine (+THREAD) |

---

## 8. Out of scope / deferred (kept clean)
- Real multiplayer / shared world → Stage 2 backend (the storage seam anticipates it).
- Real AI-refereed threads / NPC posting → Stage 3 (SPIKE-G picks the interim).
- Art for hubs/capitals/crowns → the art conversation (procedural/leverage, not asset-debt).
