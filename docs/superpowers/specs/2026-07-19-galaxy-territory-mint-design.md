# Galaxy & Territory Mint — G0 Foundation Spec

**Status:** Draft for review · **Date:** 2026-07-19 · **Builds on:** canon **v1.11**
**Migration context:** slices 1–3 (tags, gear, rosters) are done. This is the galaxy/territory
work — the last un-migrated block — but it is **design/authoring, not extraction**: the Notion
"Galaxy & Territory — v1" page is a systems dictation whose own closing line is *"mint the actual
planets, populate the map, and assign territory ownership (not started)."* All the galaxy *systems*
(20 planet types, 23 location types, 12 doors, 9 conditions, sector statuses, ownership rule,
travel ladder, scores, and the new `tick` living-world spine) already sit in canon. What is missing
is the **minted board**: concrete planets, their locations, and who holds what.

## 1. Goal & shape (locked with the user)

Build a **believable galactic territory map that tells a war story and feeds the flywheel.**

| Decision | Locked value |
|---|---|
| Scale | ~**100 custom planets** · ~**27 sectors** · 5 segmentums |
| Depth | **Fully walkable everywhere** — every planet: orbit + 3–4 sited surface locations, live doors, conditions (~400–500 locations total) |
| Fidelity | **Mostly custom**; Sol/Terra (and a few real sector names) as recognisable anchors |
| Ownership | **Realistic + every faction has a foothold** — Imperial-dominant Core, Chaos/Xenos Expanses, all 20 factions hold ≥1 world |
| Traits | **Define** Nihilus/Sanctus effects **and** per-faction ruling traits (mechanics, not just tags) |
| Build approach | **Contract-first, region-parallel** — this G0 spec locks the contract + war-map + traits; authoring slices (G1–G5) fill regions against it; G6 wires trait mechanics |

Non-goals / deferred: live flywheel *accumulation* (needs Stage-2 persistence — the map shows demo
constants meanwhile, same caveat as scores); Warp-Gate destination linking (still no charted portals).

## 2. The Minting Contract

The rules every planet and location obeys, so region-parallel authoring stays coherent.

### 2.1 Records (must match the engine's `fPl`/`fLoc` readers)

*(record shapes verified against the demo schema during G1 — a location does **not** store its doors.)*
```
PLANET   { id, name, type(∈ 20 planet_types), rift: "Nihilus"|"Sanctus"|null,
           canon: bool, ruler: { allegiance, faction } | null, desc: lore,
           locations: [ … ], resources: int, status: null, crown?: true }
SECTOR   { id, name, status, owner: "<Allegiance> - <Faction>", planets: [ … ],
           space: { id, name, type:"space", tier:"space", condition, level:0, forces:[], desc } }
LOCATION { id, name, type(∈ 23 location_types), tier: "orbit"|"surface",
           condition(∈ 9), level: int, desc: lore, ships?: [ … ] (orbit only),
           door_names?: { <doorKind>: "<custom name>" } }
```

### 2.2 Rules

1. **Every planet has exactly one primary Orbit** (`type:"orbit"`, `tier:"orbit"`) plus **≥2 surface
   locations**; it may also carry **orbital stations** (`space_station`/`orbital_dock` at `tier:"orbit"`).
   Target 3–5 locations per planet. **Every sector carries a `space` layer** (fleets translate there first).
   One planet per sector is the **`crown:true`** capital (holds a `crown`-type location).
2. **Location type must be legal for the planet type.** This is data-driven: `location_types[].planet_types`
   lists the planet types a location type may appear on (`"*"` = any). Authors pick only legal types.
3. **Doors are NOT stored on the location** — the engine derives them from the location type via `doorsAt()`
   (`location_types[l.type].doors`, minus the condition's `doors_offline`). To rename a specific door, use the
   optional `door_names: { <kind>: "<name>" }` map. A Hive grants `shop, shop, muster, armoury`; a Forge Temple
   grants `forge, reliquary`; etc.
4. **Condition** defaults `intact`; war-torn sectors seed degraded conditions (`besieged`/`sacked`/`ruined`/`infested`)
   consistent with sector status and the ruling war.
5. **IDs:** planet id = short slug (`vigilus`); location id = planet slug + site (`vigilusashravine`), matching
   the existing demo convention.
6. **Naming/lore:** mostly custom, 40K-toned. Each planet gets a 1–2 sentence lore `desc`; each location a
   short evocative `desc`. Real names only as the agreed anchors.
7. **Terminology law:** always "model", never "chassis".

## 3. Territory War-Map

### 3.1 The Rift — three home categories (locked)

Every faction is homed to one side of the Great Rift, **or is Rift-neutral**. This is a canon property
(added per faction) and drives the trait in §4.1.

| Category | Factions |
|---|---|
| **Sanctus** (lit, ordered) — 8 | Adeptus Astartes, Astra Militarum, Adeptus Mechanicus, Adepta Sororitas, Adeptus Custodes, Aeldari, T'au, Leagues of Votann |
| **Nihilus** (dark, torn) — 8 | Black Legion, Death Guard, World Eaters, Thousand Sons, Emperor's Children, Daemons, Tyranids, Orks |
| **Neutral** (free-movers) — 4 | Genestealer Cults, Necrons, Harlequins, Drukhari |

**Neutral = Rift-agnostic mobility:** the cross-Rift penalty never applies to them anywhere; they still
own worlds and get the home-turf trait. Lore-perfect: Necron tombs everywhere, GSC hidden cults, Harlequin
& Drukhari webway mobility.

### 3.2 Geography — two heartlands + a burning front (locked)

```
SANCTUS heartland   Segmentum Solar (Throne — Custodes/Imperium core)
                    Segmentum Pacificus (Imperium + Aeldari/T'au/Votann holds)
NIHILUS heartland   Segmentum Obscurus (Chaos + Tyranids/Orks — the DEMO lives here)
                    Segmentum Tempestus (deep Chaos / predator space)
THE FRONT           Ultima Segmentum — the Rift tears through it; both sides hold
                    sectors, neutrals roam, the grand war is hottest here
NEUTRAL holdings    scattered across all sides (Necron tombs, GSC cults,
                    Drukhari webway-ports, Harlequin enclaves)
```

### 3.3 Ownership rule (from the Notion doc)

`sector.owner` = the allegiance+faction ruling the **most locations** in the sector; **independent of
sector status** (a faction can own a Famine sector). A sector may contain worlds under different rulers —
that is how minor factions get a foothold without owning a whole sector.

### 3.4 Sector-allocation framework (DRAFT — the redline surface)

~27 sectors, ~100 planets, every faction with a foothold. The 3 existing demo sectors are **preserved as-is**.
Sector names are mostly custom placeholders; real anchors marked ⚓. Planet counts are targets for the
authoring slices. **This table is what the user reviews/redlines.**

| Segmentum | Side | Sector | Status | Dominant owner | Foothold factions | Planets |
|---|---|---|---|---|---|---|
| Solar | Sanctus | Sol Sector ⚓ | Peace | Custodes | Custodes, Astartes | 4 |
| Solar | Sanctus | Solar Marches | Peace | Militarum | Militarum, Mechanicus | 3 |
| Solar | Sanctus | Sanctus Approaches | Thriving | Astartes | Astartes, Sororitas | 3 |
| Pacificus | Sanctus | Hydraphur Sector ⚓ | Thriving | Sororitas | Sororitas, Militarum | 4 |
| Pacificus | Sanctus | Cog-Marches | Peace | Mechanicus | Mechanicus | 4 |
| Pacificus | Sanctus | Saim-Reach (craftworld) | Peace | Aeldari | Aeldari | 3 |
| Pacificus | Sanctus | Kes'tar Sphere (sept) | Thriving | T'au | T'au | 3 |
| Pacificus | Sanctus | Grymhold Deep (kin) | Peace | Votann | Votann | 3 |
| Pacificus | Sanctus (Expanse) | The Halo Zone | Corrupted | Contested | Necrons◇, GSC◇ | 3 |
| Obscurus | Nihilus | Vigilus Sector ⚓ | Warring | Contested (Imperial plurality) | *(demo — as-is)* | 2 |
| Obscurus | Nihilus (Ghost Stars) | Pallid Reach | Corrupted | Death Guard | *(demo — as-is)* | 1 |
| Obscurus | Nihilus (Halo Stars) | Kraith Drift | Famine | Tyranids | *(demo — as-is)* | 1 |
| Obscurus | Nihilus | The Despoiler's Wake | Warring | Black Legion | Black Legion | 4 |
| Obscurus | Nihilus | Skallax Warring | Warring | World Eaters | World Eaters | 3 |
| Obscurus | Nihilus | Prosperine Ash | Corrupted | Thousand Sons | Thousand Sons | 3 |
| Obscurus | Nihilus | Da Great Green Rok | Warring | Orks | Orks | 3 |
| Tempestus | Nihilus | Bakka Marches ⚓ | Warring | Emperor's Children | Emperor's Children | 4 |
| Tempestus | Nihilus (Veiled Region) | Veil Reach | Warring | Daemons | Daemons | 3 |
| Tempestus | Nihilus | The Screaming Sinks | Corrupted | Emperor's Children | Emperor's Children, Daemons | 3 |
| Tempestus | Nihilus | Commorrite Approach | Peace | Drukhari◇ | Drukhari◇ | 3 |
| Tempestus | Nihilus | Hive-Fleet Verge | Famine | Tyranids | Tyranids | 3 |
| Ultima | Front | Ultramar Sector ⚓ | Thriving | Astartes | Astartes, Militarum | 4 |
| Ultima | Front (Ghoul Stars) | Ghoul Fringe | Famine | Necrons◇ | Necrons◇ | 3 |
| Ultima | Front (Eastern Fringe) | Fringe March | Warring | T'au | T'au, contested | 4 |
| Ultima | Front | The Cicatrix Scar | Warring | Contested | mixed (both sides) | 4 |
| Ultima | Front | Sanctum Infestus | Corrupted | GSC◇ | GSC◇ | 3 |
| Ultima | Front | The Black Carnival | Peace | Harlequins◇ | Harlequins◇ | 3 |

◇ = Rift-neutral holding. Totals at the minimums shown: **27 sectors, ~84 planets** (including the 4 existing
demo worlds). Authoring slices enrich toward the **~100 target** by adding 3rd–5th worlds to the richer sectors
(Hive/Forge/Crown sectors carry more). All 20 factions hold ≥1 sector-dominant or foothold world.

## 4. Trait Subsystems (define + wire)

### 4.1 The Rift — home/away model (locked)

Stored as a `canon.rules.rift` block; each location carries its `rift` tag and each sector its `owner`.
Effects are **relational** — computed from the acting Force's faction (home side, or neutral) against the
location's side and the sector's owner. Two forces are in play, a **home bonus** and an **away penalty**;
they never double-stack the same lever (take the single better/worse value).

**Sided factions (Sanctus / Nihilus):**
```
On your HOME side (anywhere on it)     → HOME BONUS
Across the Rift (the opposite side)    → AWAY PENALTY
```

**Rift-neutral factions (GSC, Necrons, Harlequins, Drukhari):**
```
Anywhere                 → never suffer the AWAY penalty (free-movers)
In sectors THEY own      → HOME BONUS (their concentrated turf)
Their owned sectors      → impose the AWAY PENALTY on every non-owner visitor,
                           regardless of that visitor's side (hostile ground to all)
```

**HOME BONUS** (each moderate):
```
  · Comms range              +1 tier
  · Travel word-count        −25%
  · Muster cost −25%   ·   Apothecarion revival window +1
  · Production               +25%   (couples to the v1.11 tick production stream)
```

**AWAY PENALTY** (each moderate):
```
  · Comms range              −1 tier
  · Travel word-count/passage +25%
  · Muster cost +25%   ·   Apothecarion revival window −1
  · Requisition (shop/forge)  +25%
```

Home swaps the away's *requisition surcharge* for a *production bonus* — intentional. Note the emergent loop:
home **production +25%** feeds the tick hoard, which (via §4.3) fields a bigger **garrison** — a faction's
heartland is both richer and harder to invade. Magnitudes are tunable in G0's trait-design step.

Scope: a sided faction's home bonus applies **anywhere on its home side**; a neutral faction's applies **only
in sectors it owns**. The away penalty is **side-relative** for sided factions and **sector-relative** (neutral
turf) for everyone entering a neutral-owned sector.

Engine hooks: comms range calc, `passageCost`/travel words, muster & apothecarion cost, `doorCatalog` pricing,
and the tick production rate. Effects apply to the Force's controlling faction / the sector owner.

### 4.2 Home-turf ruling trait (locked)

At a location ruled by faction **F**:

```
F-aligned visitor  → local Forge offers F's forge-affinity tags · −10% prices · guided landing
hostile visitor    → arrival opens an interception Travel Thread (§4.3) · +25% prices if they trade
same-allegiance    → permitted but watched · baseline
neutral/other      → baseline, guarded
```

Generalised from the existing Drukhari forge-access precedent — one parameterised rule keyed on the ruler,
not 20 bespoke ones. Composes with §4.1 (the Rift requisition surcharge stacks additively with the hostile
home-turf surcharge).

### 4.3 Arrival & garrison — the Travel Thread (locked)

Arriving at a **ruled** planet opens a Travel Thread (canon already stubs `travel.arrival_at_controlled_planet`)
that branches on the arriving Force's standing with the ruler:

```
same faction / allied   → guided landing: any location, home-turf perks, no contest
same allegiance         → permitted but watched: public locations, baseline
neutral                 → challenged: pay a landing toll (Currency/Influence) or be held to orbit
hostile (enemy)         → CONTESTED DESCENT: arrive in Orbit; a garrison hailing from the
                          sector/planet owner intercepts; the ruler (+ allies in comms range) is alerted
```

**Garrison strength — economy-coupled (locked).** The interception Force scales so that rich, productive,
well-stocked prize worlds field armies and spent worlds barely resist:

```
garrison muster capacity ≈
     effective population          (canon planet_types.pop_ceiling)
   + production output             (canon planet_types.prod_mult, and the tick production stream)
   + stored resources / divisor    (the world's hoard, from the v1.11 tick system)
   × fortification(planet type)     (Fortress/Crown/Forge/Hive high; Death/Dead/Frontier low)
   × sector-status modifier         (Thriving strong · Famine/Corrupted weak — reuse status multipliers)
```

Dependency: the stored-resources term rides the `tick`/flywheel accumulation. Until Stage-2 persistence it
uses demo constants (same caveat as the score flywheel); the formula is authored now, live numbers land with
persistence. This couples defense to worth — you cannot take the crown jewels on the cheap.

## 5. Engine-readiness (verification, part of G0)

Before/with authoring, confirm the engine scales from 3 → ~27 sectors and 14 → ~400 locations, and that the
demo is untouched:

- **Map charts** (`galaxyChart`, segment/sector renderers) render ~27 sectors and dense planet lists without
  layout breakage or unbounded width; add paging/scroll if needed.
- **`travelTier`** resolves every new sector/segmentum pair to a valid ladder tier (same-sector … cross-segmentum);
  cross-Rift travel applies the +25% from §4.1.
- **Save-state demo** (`S`, Vexos Kane at `vigilus/ashravine`) is untouched — all new data is additive and every
  existing planet/location id is preserved. `fPl`/`fLoc`/`forcesAt`/`histAt` keep resolving.
- **JSON size** — ~400 locations grows the file but fetch/parse stays fine (verify load + boot, 0 JS errors).
- Any required engine fix surfaced here becomes its own tracked item, not silent scope creep.

## 6. Decomposition & execution

```
G0  (this spec)  contract + war-map framework + trait DESIGN.
                 Lands in canon now: rules.rift + rules.home_turf + rules.arrival/garrison blocks;
                 per-faction `rift` home-side property; engine-readiness verified.
G1–G5  AUTHOR    one segmentum per slice (Solar, Pacificus, Obscurus, Tempestus, Ultima), minting
                 that region's sectors/planets/locations to the contract + war-map table.
                 Parallelisable across subagents — all follow this spec, so output stays coherent.
G6  WIRE         implement the trait mechanics in the engine: Rift cross-side hooks, home-turf
                 pricing/forge/landing, arrival Travel Thread + scaled garrison.
```

**Testing (per slice):** extend `tests/canon.test.js` — planet/location counts, every planet has exactly one
orbit, doors valid for each location type, location types legal per planet type, every faction has a foothold,
ownership computes to the stated sector owner, rift tags present. Bump `meta.version` per slice; keep
`node --test` green.

**Concurrency:** a sibling agent is actively building the engine/tick layer in `index.html`/canon. Commit
migration files by explicit path, keep the tree test-passing at every pause, and coordinate on shared files
(see the `concurrent-sessions-share-main` playbook). G6 (engine wiring) especially will touch `index.html` —
sequence it to avoid clobbering the sibling's live work.

## 7. Open items (flagged, not blocking)

- Sector names in §3.4 are DRAFT placeholders — the user's redline pass sets the final set (which real anchors to keep).
- Exact planet counts per sector are targets; authoring tunes to ~100 total.
- Nihilus/Sanctus *flavor* beyond the four-lever penalty is intentionally minimal (kept as a coordination axis, not a combat buff).
- Fortification ratings per planet type (§4.3) and the `stored-resources` divisor are tuning constants to be set in the trait-design step of G0.
