# Door Tiers + Signature Doors — Design (LOCKED with Daak 2026-07-29→31)

Completes the design layer the alpha depends on: the universal 3-tier door system (D11),
the planet-type table that governs it, and the remaining open decisions on the 20
signature doors (T-FAC-1). Supersedes the D11 notes in
`2026-07-22-thread-archetypes-design.md` where they conflict; carves §6b (door leveling)
out of `2026-07-27-economy-resources-sinks-design.md` into this arc.

## 1 — Scope & sequencing

| Arc slice | Ships |
|---|---|
| **T-ECN-1** (elevated into the alpha spine, first domino) | typed resources (Food/Material/Fuel), tick production, stockpiles — unchanged scope, spec §7 Phase E1 of the economy design |
| **T-DOOR-1** (NEW — this spec; blocked on T-ECN-1) | tier state + tier gating on all 12 common doors · upgrade flow (full cost formula, no interim version) · world-profile tier seeding · 35-type planet registry |
| **T-FAC-1** (next arc, after alpha) | the 20 signature doors — all open design decisions closed by this spec (§6) |
| **T-GX-G7** (NEW — canon lane, parallel-safe) | galaxy re-run: reassign planet types across the 87 minted planets, author worlds for the 21 subfaction types, verify named locations carry the doors the seeding rule expects |
| **T-ECN-2** (shrinks) | keeps §6c wear/repair, §6d consumables, §6e tier-gated door *services*; §6b door leveling moves here |

Daak rulings 2026-07-30/31 folded in: no faction-wide Mechanicus exceptions (both
scratched — see §6.3); tier-III homes live on STANDARD planet types only; Shop and
signature doors are the two "tier III anywhere" exceptions; dormant planet-type effect
strings are stripped and replaced with standardized lore.

## 2 — The standard/subfaction line (core principle)

**Standard worlds fit inside ANY subfaction's empire. Subfaction worlds belong to their
subfaction.** Game logic beats strict 40k flavor for standard content (a Tyranid "shop"
is the Trophy Pile skin — the skins system already implements this). Consequences:

- Universal Tier-III homes sit ONLY on standard (untagged) planet types.
- Subfaction-tagged types carry no universal Tier III; their worth = subfaction lore
  interaction + the Tier-III signature door + future unique effects.
- The old `faction` tags naming non-playable factions (Ecclesiarchy, Imperial Knights)
  were invalid and are removed. Forge World is de-Mechanicused into a standard type;
  Mechanicus gains Explorator World as its subfaction type.

## 3 — Tier caps & Tier-III homes

Default cap **Tier II** everywhere. Exceptions:

- **Shop → Tier III on ANY world** (invest enough and it becomes a proper trade hub).
- **Signature door → Tier III on any world its subfaction rules.**
- Each remaining door kind has exactly one home type (two for Altar-sharing Shrine):

| Door | Tier-III home |
|---|---|
| Forge, Armoury | Forge World |
| Apothecarion | Hive World |
| Shipyard | Industrial World |
| Relay | Civilized World |
| Throne Room | Fortress World |
| Altar, Reliquary | Shrine World |
| Arena | War World |
| Muster | Feudal World |
| Warp Gate | Frontier World |

- **Death World, Dead World, dormant Tomb World cap at Tier I.**
- Chaos's route to Altar III is conquering (and desecrating) a Shrine World — no Daemon
  World shortcut. Every allegiance climbs the same ladder: take and hold the type.

Canon reword: Forge World's old "ONLY route to Tier III equipment" becomes "the only
place where top-grade arms and armour are **made**" — Shop III can *sell* tier-III gear
anywhere, but forging to III, armour-hardening to III, and Heavy armour stock exist only
on Forge Worlds (buying vs making).

What each tier means per door is the locked D11 ladder (unchanged): Shop gear tiers ·
Forge forge/harden depth · Altar cast ranks R1-2 / R3 / R4-R5 (R5 casts exist in canon; Daak ruling 2026-07-31: Tier III sells them) · Armoury Light/Medium/Heavy ·
Reliquary one/both/re-forge (§6.4) · Muster classes+ranks+bulk · Apothecarion
cost/wounds/window · Shipyard system/warp/capital · Relay sector/segmentum/galaxy ·
Arena local/cross-sector/galaxy · Warp Gate same-segmentum/cross/any · Throne Room
planet/discount/sector-events.

## 4 — Planet-type registry (canon edit: 35 types, replaces the 20)

All 35 minted into `galaxy.planet_types` NOW (the 21 subfaction types exist in the
registry before any planet uses them; T-GX-G7 assigns them worlds). Dormant `effect`
strings are REPLACED by the standardized `lore` lines below (pattern: what the world is ·
what it means in play). `prod_mult` stays live; `mission_value` / `pop_ceiling` remain as
dormant tuning data. `faction` tags only on subfaction types, only playable subfactions.

### Standard (14 — no tag; any empire; carry all universal Tier IIIs)

| Type | prod | Tier III | Lore |
|---|--:|---|---|
| Forge World | 2.0 | Forge · Armoury | A world given over entirely to weapons manufacture. The only place where top-grade arms and armour are made. |
| Hive World | 1.8 | Apothecarion | Continent-sized cities house populations in the billions. The galaxy's largest source of labor, recruits, and trained medicae. |
| Industrial World | 1.6 | Shipyard | Factories and orbital docks cover the surface. Produces bulk goods and ship hulls in volume. |
| Agri World | 1.4 | — | Farmland spans the whole planet. Feeds the surrounding sector; losing one starves it. |
| Mining World | 1.4 | — | Deep excavation of ore and fuel. Supplies the raw material every other industry depends on. |
| Civilized World | 1.0 | Relay | Established cities, trade routes, and functioning institutions. The communication hubs that bind a sector run from here. |
| Fortress World | 0.8 | Throne Room | The entire planet is built for defense. Command over a region is traditionally seated behind its walls. |
| Frontier World | 0.8 | Warp Gate | A half-settled world at the edge of charted space. Old warp gates and unclaimed finds draw prospectors. |
| Shrine World | 0.6 | Altar · Reliquary | A place of pilgrimage covered in cathedrals and relic vaults. Holy to millions and a target for their enemies. |
| War World | 0.5 | Arena | A battlefield that never ended. Its arenas and standing warzones are known across segmentums. |
| Feudal World | 0.4 | Muster | Isolated societies at pre-industrial technology, ruled by martial houses. Produces disciplined soldiers in great numbers. |
| Feral World | 0.4 | — | Tribal cultures on an untamed world. Produces hardened recruits and little else. |
| Death World | 0.3 | cap I | The environment itself kills the unprepared. Whatever lives here makes formidable stock. |
| Dead World | 0.0 | cap I | A planet stripped of life, usually by Exterminatus. Produces nothing and never recovers. |

### Subfaction (21 — tagged; no universal Tier III)

| Type | prod | tag | Lore |
|---|--:|---|---|
| Kin Hold | 1.6 | votann | A Votann settlement cut deep into rock around an Ancestor Core. Steady industry under old guidance. |
| Sept World | 1.2 | tau | A planned T'au colony built to the Greater Good. Order, growth, and negotiation are its exports. |
| Garrison World | 0.9 | militarum | A depot world of the Astra Militarum. Whole regiments are raised, drilled, and shipped from here. |
| Cult World | 0.9 | gsc | An ordinary world whose population hides a genestealer cult. The infection surfaces only when it is ready. |
| Pleasure World | 0.8 | emperors_children | A world the Emperor's Children devoted to sensation and excess. Every trade here serves appetite. |
| Daemon World | 0.8 | daemons | A world absorbed into the warp, where daemons hold court. Physical law is negotiable; allegiance is not. |
| Xenos World | 0.8 | (xenos, generic) | An untamed world of lairs and hunting grounds. Claimed by no charted power. |
| Anchorage World | 0.7 | black_legion | A staging port for the Black Legion's crusade fleets. Warbands gather here to refit and swear their oaths. |
| Explorator World | 0.7 | mechanicus | A Mechanicus expedition world of archeotech excavation. Its vaults hold technology older than the Imperium. |
| Plague Garden World | 0.6 | death_guard | A world remade by the Death Guard into Nurgle's garden. Blight is cultivated here like a crop. |
| Athenaeum World | 0.6 | thousand_sons | A silent library-world of the Thousand Sons. Forbidden lore is gathered, warded, and studied here. |
| Convent World | 0.6 | sororitas | Seat of a Sororitas Order's motherhouse. Faith is organized here as thoroughly as any army. |
| Exodite World | 0.6 | aeldari | A pastoral Aeldari colony threaded with webway roots. Its keepers defend the land as kin. |
| Raider's Nest | 0.6 | drukhari | A hidden Drukhari anchorage between raids. Its markets price everything in captives. |
| Chapter World | 0.5 | astartes | Home to an Astartes fortress-monastery. Its harsh population supplies the Chapter's aspirants. |
| Scrap World | 0.5 | orks | An Ork world of mek yards and fighting pits. Its junk mountains supply endless crude machinery. |
| Crossroads World | 0.5 | harlequins | A webway junction kept open by Harlequin masques. All travelers pass through; none linger. |
| Slaughter World | 0.4 | world_eaters | A killing ground consecrated to Khorne by the World Eaters. Nothing is built here; the fighting is the point. |
| Vigil World | 0.4 | custodes | A watch-post of the Adeptus Custodes. Few are stationed here, and nothing passes them. |
| Infested World | 0.3 | tyranids | A world partly consumed by a Tyranid splinter fleet. What remains of its biosphere feeds the swarm. |
| Tomb World | 0.2 | necrons | A quiet surface above sleeping Necron vaults. Disturbing it wakes the owners. |

`mission_value` / `pop_ceiling` for the 21 new types: assigned at mint mirroring
comparable existing rows (tuning data, dormant).

## 5 — Upgrade economy (D11 × E2 merged; ships AFTER T-ECN-1, never an interim form)

- **currency = door_base × target_tier** (D11 locked; base by rarity: common 100 ·
  uncommon 150 · rare 250 · rarest/reliquary 400 · throne_room 200).
- **resources: →II 120 Material + 30 Fuel · →III 300 Material + 100 Fuel** (E2 §6b;
  Altar rites may substitute Food for Material at equal points).
- **build time: →II 3 in-game days · →III 7 days** — construction rides the world tick;
  the door serves its OLD tier while building; completion surfaces in the World Digest.
- **gates:** you must rule the world (territory overlay) · planet-type caps (§3) always
  apply · one upgrade in progress per door.
- Tiers never decay in this arc (conquest inherits them per the locked Govern rule;
  destruction mechanics are a later design).

## 6 — Signature doors: design completion (build = T-FAC-1, next arc)

1. **Spawn: crown world, tier I** — every subfaction's signature door exists at its crown
   world from founding. **Buildable elsewhere** on any world the subfaction rules, via
   the same upgrade economy. Signature doors take the **rare cost class (base 250)** for
   both building and tier upgrades, and may reach **Tier III on any ruled world**.
2. **Conquest:** per the locked Govern rule, a conqueror who governs inherits door tiers
   and keeps access to the old faction's unique outputs; signature doors survive.
3. **Mechanicus — both faction-wide exceptions SCRATCHED** (Daak 2026-07-30): no
   faction-wide PC payment, no faction-wide Tier-III-anywhere. The **Fabricator's
   Sanctum** mechanic, localized: OTHER doors at the Sanctum's named location may be
   upgraded by feeding sacrificed-model PC INSTEAD of the currency+resource bill (whole
   bill converted at 1 PC = 1 point; rate is tuning). Location-scoped, cannot upgrade
   itself, tier caps still apply.
4. **Reliquary Tier III = relic re-forge, defined:** re-forge a legendary you own into a
   personalized relic — rename it + add one forge-tag from your faction affinity,
   permanently (heirloom-maker; feeds succession stories).
5. All 20 door mechanics remain as locked in thread-archetypes §8.7–8.10; exact
   costs/outputs are T-FAC-1 tuning.

## 7 — Tier seeding (deterministic, derived — nothing stored)

Pure function `seedTier(planet, doorKind, canon)`:

1. default **1**
2. planet population in the **top 2 rungs** of the `population_ranks` ladder → **2**
3. `doorKind` is a **home door of the planet's type** (§3 table) → **3**
   (day one: Forge Worlds already forge at III, Shrine Worlds bless at III — the
   lived-in galaxy IS the conquest bait)
4. clamp to the planet-type cap (Death/Dead/dormant-Tomb → 1); Shop follows rungs 1–2
   (its "anywhere III" is player investment, never seeded)

Effective tier = `S.world.doorTiers[locId]?.[doorKind] ?? seedTier(...)` — a **sparse
overlay**; only player-built changes persist. New `S.world` keys (`doorTiers`,
`doorBuilds`) seed in **BOTH `foundingWorld()` and `init()`** (known gotcha).

## 8 — Engine wiring (T-DOOR-1)

- Pure helpers in a DOM-free core region (node-tested): `tierCap(planetType,doorKind)`,
  `seedTier`, `doorTier(state,loc,kind,canon)`, `upgradeCost(door,targetTier)`,
  `canUpgrade(state,player,loc,kind)` (rule + cap + funds + no build in progress),
  `startUpgrade`/tick-completion (rides `WORLD.catchUp`).
- Requisition: each door shows its tier (I/II/III pips) + an Upgrade block (cost,
  duration, gate reasons — mirrors the closed-door-reasons pattern). Gear/service
  catalogs filter by tier per the D11 ladder (`doorCatalog`, altar ranks, armoury
  weights, apothecarion pricing, muster depth…).
- World Digest: construction-complete lines. Map location panel: door tier pips.
- Canon: doors[] entries gain a `tiers` ladder (per-tier `does` text) + `door_base`
  rarity mapping already present as `rarity`; planet_types replaced per §4.
- Tests: canon pins (35 types, tags only playable subfactions, tier-III homes standard-
  only) · tierCap/seedTier truth tables · upgradeCost table vs D11 · overlay round-trip
  through JSON persist · engine-syntax boot proxy.

## 9 — Out of scope (parked where they belong)

- Signature door builds (T-FAC-1) · tier-gated door SERVICES + wear/consumables
  (T-ECN-2) · galaxy re-run + minting worlds for new types (T-GX-G7) · door
  destruction/decay · Warp-Gate charted destinations (portal minting) · space combat.
