# Galaxy Re-run — Planet Types + Doors (T-GX-G7 design, LOCKED with Daak 2026-08-03)

Executes the galaxy half of the door-tiers arc: reassigns planet types across the 87
minted planets so the 35-type registry (T-DOOR-1, `2026-07-31-door-tiers-signature-doors-design.md`
§4) is actually inhabited, opens the missing Tier-III door routes, satisfies the crown
floor rule (Daak 2026-08-02), and cleans the legality ghosts. Canon lane only
(`heretics-40k-data-v1.json` + docs) — **zero engine edits in this slice**; the one
engine-touching decision is filed as its own backlog row (§2).

Supersedes the OBSOLETE parts of the T-GX-G7 acceptance criteria: the "zero Forge
Worlds grant armoury" criterion died with the Armoury door (T-DOOR-2, canon v1.24);
the `kraithv` retype was fixed in `cf98b9d`.

## 1 — Crown sweep (16 retypes · 87 planets · crown-only depth)

**Policy (Daak):** every faction's crown moves to its subfaction type unless lore
forbids it; each of the 14 empty subfaction types gets EXACTLY ONE world (the crown, or
a lore-fit non-crown where the crown is exempt). No new planets minted; no non-crown
subfaction satellites. Runtime type-conversion (blighting, infestation, Exterminatus →
Dead World) is a future design, noted but out of scope.

| Faction | Planet (sector) | Type change |
|---|---|---|
| Death Guard | Nurth (pallid) | Death World → **Plague Garden World** |
| Harlequins | The Masque (carnival) | Exodite World → **Crossroads World** |
| Black Legion | Kar Zhorn (despoiler) | Daemon World → **Anchorage World** |
| Thousand Sons | Prosperine Ash (prosperine) | Daemon World → **Athenaeum World** |
| World Eaters | Skallax (skallax) | War World → **Slaughter World** |
| Emperor's Children | The Screaming Sinks (screamingsinks) | Daemon World → **Pleasure World** |
| Orks | Gorkamorka (greenrok) | Xenos World → **Scrap World** |
| Drukhari | Shaa-Dom (commorrite) | Xenos World → **Raider's Nest** |
| Tyranids | The Devourer's Maw (hivefleetverge) | Xenos World → **Infested World** |
| Astra Militarum | Cadmus Prime (solmarches) | Fortress World → **Garrison World** |
| Adepta Sororitas | Hydraphur (hydra) | Shrine World → **Convent World** |
| Adeptus Mechanicus | Metalica-Reach (cogmarches) | Forge World → **Explorator World** |
| Genestealer Cults | Sanctum Prime (infestus) | Hive World → **Cult World** |
| Adeptus Astartes | Macragge (ultra) | Fortress World → **Chapter World** |
| Aeldari | Saim-Reach (saimreach) | Xenos World → **Exodite World** |
| Adeptus Custodes | Custodian's Watch (sol) — **non-crown seat** | Fortress World → **Vigil World** |

Explicitly unchanged: **Terra stays Hive World** (the Throneworld is not a thin
watch-post — Custodes seat their type on Custodian's Watch instead); **Bakka Prime
stays Hive World** (EC's second crown carries the economy; the Slaaneshi daemon-realm
crown takes Pleasure); **Aurelian's Rest + Aurelis Hold stay Fortress crowns**
(Macragge is THE fortress-monastery world); T'au ×2 Sept, Votann Kin Hold, Daemons
Veilworld, Necrons ×2 Tomb already sit on their types.

**Desc consistency pass:** planet/location `desc` strings that name or lean on the old
type get one-line lore touch-ups (e.g. Nurth reads as Nurgle's garden, not a generic
death world). Content edits only; ids, names, structure untouched.

## 2 — Necron crowns: dormancy ruling

Sepulchre Nought + Zapedra **stay Tomb Worlds**. The dormancy freeze (conflict starts
10, tombs wake at `tomb_dormant_conflict` 40 → both crowns boot Tier-I-capped) is
resolved by a **new backlog row, engine lane, NOT this slice**:

> **T-GX-G7e — crown worlds never sleep:** `tombDormant(pl)` gains a `!pl.crown`
> guard — a phaeron's court is already awake. Non-crown Tomb Worlds keep the full
> wakes-with-war mechanic. One-line engine edit + test.

Rationale: canon-only alternatives either neuter dormancy galaxy-wide (lowering the
threshold) or break crown-on-own-type for exactly one faction (retyping).

## 3 — Tier-III door routes (acceptance criterion ❶)

`seedTier` grants Tier III only where the door kind is home on the planet's type — so
each home type must actually carry a granting location. Fixes:

- **Shipyard → Industrial World:** add an `orbital_dock` location to **Konor** (ultra,
  Imperial side — lore-famous shipyards) and **The Iron Reliquary** (despoiler, Chaos
  side — crusade-fleet dock). One Tier-III shipyard per home side; Xenos already reach
  shipyards via Mek Shops at I–II.
- **Arena:** the door had NO granting location type at all. Add `arena` to the door
  lists of **Warzone** (whose lore line literally names arenas; all 3 remaining War
  Worlds carry one → Tier-III route lives) and **Lair** (Drukhari wych-pits, Ork
  fight-clubs at I–II). No new location type — doors live in location-type door lists.
- **Warp Gate → Frontier World:** add ONE `webway_portal` location to **Dal'yth Verge**
  (kestar) — the galaxy's only Tier-III (travel-anywhere, passage-free) gate, T'au-held
  at boot. Deliberate conquest bait; scarcity protects the passage-cost economy.
  The location instance gets a T'au-appropriate authored name (an old gate the
  earth-caste fences off), not Aeldari skinning.

Each host planet goes 3 → 4 locations (inside the 3–5 test bound; surface-count ≥2
holds on all three). All three new locations are authored (id, name, condition
`intact`, desc). Tier follows minted precedent: the two `orbital_dock`s are tier
**orbit** (like all 3 space_stations — and orbit locations produce nothing, so the
docks don't dilute production shares), the Dal'yth Verge `webway_portal` is tier
**surface** (like all 8 minted portals).

## 4 — Resource rows (crown floor rule, 8 edits)

Ruling (Daak 2026-08-02): every type hosting a crown world yields nonzero Material AND
Fuel. Edits to `resource_output` (F/M/Fu):

| Type | Old | New | Note |
|---|---|---|---|
| Plague Garden World | 6/2/0 | **6/2/1** | blight-gas burns |
| Crossroads World | 0/0/2 | **0/1/2** | passage-tolls in kind |
| Infested World | 3/0/0 | **3/1/1** | chitin + bio-ichor |
| Exodite World | 4/2/0 | **4/2/1** | tapped webway seeps |
| Vigil World | 0/1/1 | **0/2/3** | fuel-leaning watch-post (Daak pick) |
| Scrap World | 0/8/4 | **0/7/2** | Daak's number — material-heavy, fuel-poor |
| Athenaeum World | 2/2/2 | **1/2/3** | fuel-leaning warp-industry, total stays 6 |
| Convent World | 2/2/2 | **3/2/1** | food-leaning pilgrim fields, total stays 6 |

The other 7 derived rows (Garrison 4/4/4 · Cult 4/4/2 · Pleasure 4/2/2 · Anchorage
0/3/5 · Explorator 0/6/4 · Raider's Nest 2/2/4 · Chapter 2/3/2 · Slaughter 0/3/2) ship
as minted — reviewed and kept. Tomb World stays 0/1/1: floor-clean at the minimum,
lean-until-war is the Necron identity.

## 5 — Legality lists + ghost cleanup (acceptance criterion ❺, derived from §1)

`location_types[].planet_types` edits — every minted planet must validate (canon test):

- `lair` += Anchorage World, Athenaeum World, Pleasure World, Scrap World, Raider's Nest
- `plague_garden`: ghost "Plague World" → **Plague Garden World**
- `shrine`: drop ghosts "Chapel World" + "Cemetery World"; += Convent World
- `forge_temple`: ghost "Frontier Forge World" → **Explorator World** (Metalica-Reach
  keeps its forge_temple legally; the ghost plainly meant an expedition forge)
- `manufactorum` += Explorator World
- `cult_sanctum` += Cult World · `hive` += Cult World

No speculative extensions beyond what minted planets and evident lore require.

## 6 — Starting conditions (5 seats — wakes Defend/Liberation mission weighting)

| Location | Planet (sector) | Condition |
|---|---|---|
| city | Vigilus (vigsec) | **besieged** |
| hive | Sump-Haven (haloz) | **infested** |
| shrine | Solace (cicatrix) | **besieged** |
| fortress | Mordath (cicatrix) | **besieged** |
| space_station | Kraith Verge (kraith) | **infested** |

Never on a crown; each seat is a place where the condition's door pain (gates shut /
shops offline) IS the story. Three segmentums covered.

## 7 — Discipline & verification

- Canon `meta.version` 1.28 → **1.29**; bump EVERY test pin (grep `1.28`/`v1.28` —
  ~5–7 files incl. `tests/canon*.test.js` + the JSON itself).
- Surgical python json edits; preserve the trailing newline; filename stays
  `heretics-40k-data-v1.json`.
- `node --test` green at every commit (baseline 412). Canon tests will newly enforce
  §5 legality via the retypes; expect and fix pins that assert old types (e.g. any
  test naming the DG crown a Death World).
- `git add` explicit paths only. Push gated to Daak. BACKLOG row updated through the
  lifecycle; add the T-GX-G7e engine-lane row (§2) while editing.
- Locations derive doors from `location_types` — never store doors on locations.

## 8 — Out of scope (recorded)

- Runtime planet-type conversion (terraforming/corruption arc) — future design.
- T-GX-G7e engine guard (§2) — separate row, engine lane.
- Warp-Gate charted portal destinations — still galaxy data for a later mint.
- Non-crown subfaction satellites — deliberately none (crown-only ruling); revisit as
  content drops.
