# ANTIMATTER — Research Dossier

**Subject:** *Antimatter* (Steam app 1343010) — a solo-developed 4X/RPG in a fully simulated
galaxy, by Geoffroy Pirard (France). Researched 2026-08-11 → 2026-08-16 as design intelligence
for Heretics 40K. This document aggregates EVERYTHING excavated; the `raw/` folder holds the
primary sources (devlog texts, Kickstarter archives, video transcripts) so future sessions can
re-verify or dig deeper without re-fetching.

**Why we care (Daak's verdict):** "This game is sooo much of what we want." Antimatter is the
maximalist real-time version of the Heretics 40K dream — a living galaxy where factions,
characters, economy, and politics run without the player. We are building the **story-first,
written-forum** version of the same dream. This dossier feeds the steal-list.

---

## 1 · Hard facts

| Fact | Value |
|---|---|
| Developer | Geoffroy Pirard, solo, part-time (military-simulation software engineer; part-time since 2025-03) |
| First line of code | 2020-04-10 |
| Kickstarter (2020-09/10) | goal €2,500 → raised **€11,765** from 355 backers (470%); stretch: €10k terraforming, €12.5k game editor/modding |
| Status | Unreleased, date "TBA". Private alpha since 2025-04 (KS backers). 6 public weekend "demos" 2025-08 → 2026-07. Playtest #7 before **2026-10-01** via Steam Playtest + Discord waitlist, NDA'd |
| Platforms | Windows & Linux (no Mac). Min spec: Pentium 4, 2 GB RAM |
| Multiplayer | **Never planned** |
| Publisher | Refuses publishers; no pre-orders/donations |
| Modding | Top priority: exposed JSON-like data, Lua scripting, ship editor, save-file editing; even historical generation moddable (events/triggers) |
| Community | Steam forum (pinned FAQ/bugs/suggestions), Discord (waitlist + sneak peeks), brand-new GitHub tracker `Geoffroypir/Antimatter-BugsAndRequests` |
| Inspirations (his list) | X4, Aurora 4X, Stellaris, Crusader Kings, Dwarf Fortress, Mount & Blade, Distant Worlds, RimWorld, Kenshi, Star Ruler, Star Control, Freelancer |

**Dev history shape:** ~6 years engine-first ("Antimatter was first developed as a simulation,
then a game" — his words). April 2026: "the last alpha primarily focused on the engine";
since then gameplay/content/UI accelerates. A hidden **second game** exists: the planetary
side-view was branched out and will share/communicate with the main game's simulation.

---

## 2 · The thesis

> "You don't play the Empire — you play as a **person** inside a living galaxy.
> The universe lives around you and you find your place in it."
> — "Crusader Kings meets Mount & Blade, in space."

Everything below serves that idea. It is the same thesis as Heretics 40K's Commander,
independently arrived at. His delivery mechanism is real-time simulation; ours is
story-first forum threads + deterministic seeded resolution. Steal the *structures*,
not the simulation.

---

## 3 · History generation & the five eras  ← DAAK LOVE #1

- Galaxy is generated, then **actually simulated for centuries/millennia before play**.
  Player chooses duration + how populated/chaotic/big.
- Full accuracy during histogen: *every tile on every planet* simulated; every city runs a
  simplified economy loop. Benchmark: 15,132 systems / 737,252 bodies / 1,500 years /
  57 trillion humans / 757 colonized worlds — generated fine.
- **Fixed dramatic arc in 5 named eras**, each with its own generation dynamic:
  1. **Age of Exploration** — ~1,000yr antimatter-fueled colonization boom
  2. **Replicant's Invasion** — machine swarm tries to seize the antimatter source
  3. **The Reconstruction** — rebuild amid ideological turmoil
  4. **Urghogh Age** — giant worms put humanity under harsh tutelage; the "Antimatter
     crisis" kills interstellar travel; every city outside core worlds ravaged
  5. **Eridani's Rise** — rebellion; **the player starts here**
- Collapse is *simulated, not narrated*: barren mining colonies starve into social collapse;
  survivors get secessions, wars, technological regression.
- **Ruins have provenance**: each ruin = the tracked corpse of a specific destroyed tile
  development. Exploration = reading real history. Ruins can be quarried for materials and
  block redevelopment. Design goal (verbatim): "believable worlds **without smoke and mirrors**."
- **Primitive populations**: survivors simulated abstractly, retain historically-generated
  character, can re-evolve into full nations mid-game past a development threshold.
- **Guided randomness**: moddable template system injects authored cities/organizations
  wherever criteria match — flavor without scripting.
- Persistence creed: no data loss, no procedural regeneration; new character in the same
  universe; can even take over an existing AI character.

**Heretics mapping:** our galaxy (87 planets, 287 locations) is minted but *ahistorical*. A
seeded "Five Ages of the Scar" histogen pass could stamp per-location history entries, ruins
with provenance, population character. Receiving structures already live: location conditions
(Fortified/Intact/Sacked/Ruined), remains system, Rebuild missions, mulberry32 seeded
generation, T-LORE-1 (Chronicle) is the natural home.

---

## 4 · Backgrounds  ← DAAK LOVE #2

- Pick 1 of 6 playable factions → **faction determines available backgrounds**.
- Background = starting conditions **and** difficulty: large-debt start, large ship, whole
  fleet, governor of a territory, or "The Rim" — ruler of your own underdeveloped colony
  under a giant worm's shadow.
- **Gating rule (the elegant part):** a faction can only offer what it actually has in the
  simulation. Weak Uhmrane can't offer a fleet start; landless factions can't offer governor.
- Demo 4+ granularized it: pick starting ship (private vs allocated!), wingmen, cash **or
  debt**, influence, rank; allocated points condition achievements. Demo 6: spawn a fully
  customized organization at start.

**Heretics mapping:** Rites of Creation currently gives every commander the same doorstep.
Faction-gated backgrounds (debtor-under-tribute, garrison holder of a named location,
frontier exile, void-fleet) plug into T-TERR-2 named holdings + death/succession spec.
Gate backgrounds by what the faction *actually holds in our minted galaxy*.

---

## 5 · Organizations & politics

- **Policies ARE the organization**: org ethics are *computed from enacted policies*;
  members' personal ethics pressure which policies pass. Policies cover internal politics,
  goals, administration, succession, regime, representation, finances.
- **15 regime templates**: absolute kingdom, holy empire, authoritarian republic, democratic
  republic, empire, feudal kingdom, horde, parliamentary monarchy, corporation, private
  company, public company, outcasts, pillagers, privateer, slavers. Templates drive policy
  sets, rank titles, chamber names, even flag/emblem aesthetics (colors match ethics).
- **Chambers**: low / high / supreme + leader; each with privileges, requirements
  (e.g. Religious Order policy → religious-education trait to hold a seat), voting power.
  Every seat is held by an actual simulated character.
- **Voting model**: a member votes by (1) his ethics vs the reform package, (2) opinion of
  the proponent, (3) above all, personal benefit. Debates run weeks/months. Political parties
  = ethics clusters with policy agendas ("Urghost party opposes almost everything").
- **Influence = capital in the org** (stock-like). Earned: missions, profitable trade,
  destroying enemies, direct cash injection. Lost: failures, debts, losing allocated assets.
  Influence gates asset allocation (bigger ship needs more influence).
- **Cabinet roles gate powers** (Demo 6): Leader, Marshal (theatres + fleet assignment),
  Minister of Industry (shipyards/procurement), Minister of Colonial Affairs (colonies +
  governor nominations), Planet Governor, Minister of Science. "Sharpen your bootlicking skills."
- **Action Points** (replaced "Political Points"): daily personal-effort pool spent on
  political actions, founding stations, colonizing, lifestyles; passively trains skills,
  fights corruption, builds influence/reputation; hard to accumulate — decays at high values.
- **Personal vs org finances** strictly separated; shares/dividends system with dilution and
  floating corporate share reserves; loans exist.

**Heretics mapping:** our 20 factions are fixed identities (right for 40K), but NPC warbands/
sub-factions could mint from regime archetypes. Influence-as-capital is a Stage-2 idea for
player standing *inside* factions (we have the 20×20 standing matrix as the between-factions
layer). Cabinet roles → Strategium/N3 vocabulary.

---

## 6 · Ownership doctrine: private property vs allocated assets  ⭐ core steal

| | Private property | Allocated asset |
|---|---|---|
| Acquired with | your own money | influence spend |
| Owner | you | the organization |
| On leaving org | keep it | lose it |
| On destruction | no influence penalty | influence penalty = its value |
| Profits | cash to you | influence, not money |

"4X as a character": you command empire-scale forces *without owning them*, and the
separation is mechanical, not cosmetic. **Heretics mapping:** faction-granted forces/relics
vs personal spoils; "allocated assets vanish on defection" is a ready-made Oathbreaker
consequence (T-DIP-3).

---

## 7 · Military & command

- **Theatres**: paint an objective onto any map object — Strike on a system = conquer it;
  on a planet = orbital bombardment; on a ship = search-and-destroy. Fleets self-assign.
  With automation OFF, the AI still *suggests* theatres; one click adopts a suggestion.
- **Command Points**: theatres + rallies cost CP (from Command & Control buildings +
  policies); exceeding the cap bloats empire size/administration.
- **Marshal**: appointed or elected per policy; sets theatres; call-to-arms rallies nearby
  commanders (obedient under Unified Command; voluntary-but-free under Local Command Authority).
- **Fleet templates** with auto-replenish thresholds; roles decide which theatres a fleet
  takes; formations (core/escort/interception/strike); parasites (carrier wings) auto-managed.
- Doctrine/Rules-of-Engagement per ship; "Fated" trait = RNG-immunity for essential
  characters (always reaches the escape pod).
- **Sensor-signature model** (no binary detection): every object has a signature from size,
  reflectivity, star proximity, transponder/shields/engines/active sensors. Detection is
  gradual and per-object; identification is separate from detection (friend-or-foe doubt is
  gameplay). Going dark = transponder off + passive sensors + slow. Cheap scouts probe;
  listening posts give passive early warning.
- **Missiles as doctrine**: travel for days, accumulate velocity, terminal guidance, disrupt
  hyperdrive; ammunition physically resupplied; countered by countermeasures, point defense,
  outrunning, agility — or by not fighting ("choose your fights").
- **Boarding**: requires target neutralized/immobilized (module position + armor matter);
  party-vs-party close combat system reused for ALL ground/encounter fights; captured
  officers → ransom or slavery.
- **Orbital bombardment**: hits specific tiles/cities; casualties incl. natives; raises
  **soot** (high-atmosphere black carbon → years-long global cooling → agricultural collapse)
  + radiation (tile or planet-wide habitability loss). A bombardment can permanently ruin a
  biosphere. War tracks military vs civilian casualties separately (future revanchism/war
  crimes); war exhaustion + war goals; peace negotiable any time among main belligerents.

**Heretics mapping:** theatres/CP/Marshal → Strategium (N3) + ultimatum system vocabulary;
sensor signature → per-model signature deepening our grid fog (loud Armament vs quiet scout);
war exhaustion → pacts/diplomacy specs; soot/permanent ruin → world-ender flavor.

---

## 8 · Economy

- **Trade nodes** = local supply/demand markets everywhere (cities, stations, outposts,
  even native settlements). Everything produced and consumed has physical presence; goods
  move because industries need them; migrants move because they chose to. Emergent
  blockades/piracy.
- **Trade lines** ⭐: routes computed + scored across volume scenarios; every re-validation
  raises a **stability** rating; AI traders prefer stable lines; your factories organically
  attract third-party traders over time.
- **Passengers are cargo contracts**: migrants/tourists/soldiers ride the same trade-node
  system as goods.
- **Migration** driven by happiness (needs fulfillment: vital → basic → luxury ladder) +
  political friction (ethics distance population↔regime); immigration can radicalize a
  population's ethics; all arrivals hit the capital region first (slum spiral risk).
- **Subsistence** is an industry: self-sufficiency floor, sets implicit minimum wage, quality
  depends on the land ("sewer rats" vs lush coast); can export surplus.
- **Jobs & classes**: populations = job × race; education gates promotion; jobless demote
  over time; education has a propaganda↔instruction dial; slavery as policy with heavy
  ethics shift ("beggars slowly promoted to slave jobs — a society where being poor is illegal").
- Money has no fixed value — inflation/deflation simulated; VAT replaced profit tax
  ("economy accurately tracks value added").
- **Ore realism**: surface deposits finite/easy, deep deposits infinite/increasingly hard;
  cryosphere blocks access ("space Greenland"); coal/petrol only where a historical biosphere
  existed; deposit richness from simulated planet formation (accretion, radiogenic/tidal heat).
- **The Gate / feed-the-threat economy** ⭐: a discoverable artifact acting as an infinitely
  profitable trade node; feeding it hull components + microchips ACTIVATES the machine-swarm
  invasion. Greedy merchants profit while dooming the galaxy; slowing the swarm means
  interdicting *neutral* traders. (Chaos-taint flywheel, verbatim.)

**Heretics mapping:** trade-line stability → travel-route safety emerging from raids vs
patrols (pairs with sector turmoil); feed-the-threat → tribute/taint sinks; T-TRD-1 sector
markets is our version of node pricing.

---

## 9 · Map & UI (Daak love #3)

**One unbroken instrument, five zoom floors, no loading screens:**
GALAXY (named stars, nebulae) → SYSTEM (orbital rings; every planet/station/fleet a glyph;
ownership as colored rings; header shows **Turmoil %**) → PLANET (globe + data cards:
colonies, lifeforms grid, geology richness table, survey %) → PLANISPHERE (hex-tile surface:
biomes, ore icons, volcanoes, cities, roads, regions) → SIDE VIEW (per-tile living diorama —
the branched second game).

- **Display-mode lenses**: system view toggles Normal / Ore / Habitability / Energy;
  planisphere overlays population density, moisture, region boundaries, migration
  attractiveness. Same geometry, swappable meaning.
- **Survey tiers**: 3 discovery levels (land/sea → relief → full topo + hidden sites);
  cloud cover slows scans; scanning loudly can wake replicant nests.
- **Territory painted, not listed**: influence borders render and re-arbitrate continuously
  from patrol presence.
- UI grammar: everything is a widget with tooltips; smart cursor (context orders: attack /
  join fleet / dock / salvage; Alt = menu; Shift = queue); universal search (Ctrl+F);
  offscreen indicators; measure tool; time controls (pause → ×5, in-game date year ~3585).
- Tech note: seamlessness required a custom coordinate system (floating-point drift);
  400 ships can fight simultaneously across systems; wrecks + escape pods persist.

**Heretics mapping:** we have the zoom ladder (galaxy/segmentum/sector/orbit/surface).
Missing: **lenses** (togglable overlays reusing the same chart — Prosperity/Conflict/Taint
as map-paint instead of header meters) and **status-as-paint** (ownership rings, Besieged
markers, turmoil at a glance). Survey tiers → intel levels on auspex/locations.

---

## 10 · Exploration & content

- **Landing risk model**: atmosphere density (hull heat), relief, flora density, surface
  gravity vs crew skill, survey level, landing pads. Failure grounds or crashes the ship —
  stranding you. Any penetrating damage wounds/kills crew.
- **Expeditions**: crew becomes a land party; camp/mine/harvest/visit; encounters en route.
- **Regional features** (persistent POIs): worm tunnels, fungal caverns, aquifer caves,
  magmatic caves, abandoned mineshafts, stashes, pocket-civilization devices; region-wide
  cumulative bonuses/maluses; some visible from orbit, others need boots on the ground.
  Even replicant nests are exploitable (produce parts, occasionally ships).
- **Encounters** (non-persistent): contextual events during travel/time; skill/trait rolls;
  loot, codex entries, recruitable people; can reveal new areas (rock shelter → underground
  ruined city).
- **Codex** ⭐: knowledge as first-class object — maps, stories, secrets (reputation
  weapons), tech/designs; owned by character, organization, or culture; unlocks dialogue
  paths and missions; ~70-entry tech tree from primitive → spacefaring; planned tradable.
- **Specimens**: a lifeform must be studied (needs very high local habitability) before
  industry/agriculture/terraforming can use it. 100+ lifeforms; methane/ammonia/oxygen
  metabolisms; flora/fauna/microbe synergy; "seed strength" means life must be *introduced*
  and can fail — biodiversity is earned.
- 5 technological eras of buildings (primitive → medieval → industrial → modern → spacefaring)
  with per-era equivalents.

**Heretics mapping:** regional features + encounters = the missing "wonder layer" on our
missions/locations; codex → Chronicle/Rumor (T-LORE-1) + tradable intel; specimens →
relic-study rite flavor.

---

## 11 · NPC layer (the Gamund proof)

His most engaging video is an unscripted NPC biography: **Gamund** — generated with chronic
alcoholism, bad temper, questionable morality → bought a ship → founded a corporation →
scavenged a wreck into a fortune → built a commercial fleet → (bold + stupid) attacked the
replicants → lost everything → now drifting in cryo-sleep, *rescuable by the player*, will
rebuild if rescued. "None of this was scripted. The simulation god decided his fate."

- **Adventurers**: self-financed named NPCs with named ships + skilled crews; join orgs on
  their own terms or found their own; proactively upgrade ships; compete with the player for
  POIs/wrecks; future condition for pirate-faction emergence; part of a personal friend/foe
  system.
- Captain traits drive ALL ship AI ("boldness has an antagonistic relationship with life
  expectancy"); crews evaluate balance-of-power and flee; destroyed ships leave "presence"
  fear that repels civilian traffic long after.
- **Control/police/extortion loop**: patrol presence = control = policing capacity; pirates
  extort unpoliced systems (proto-taxation), victims call police if strong locally; pirates
  fly home for a "paint job" to turn clean — also purchasable by the player. Turmoil per
  system rises with ship kills + pirate activity; high turmoil repels trade and station
  construction; decays over time.

**Heretics mapping:** validation of our whole NPC program (doctrine axes = captain traits;
tiered memory = presences). Gamund-style accumulating biographies = T-LORE-1 Chronicle +
N2 aggressor cadence. The marketing lesson: emergent NPC life stories are the best content.

---

## 12 · Dev practice (meta-features worth stealing)

- **Demo cadence**: weekend-length public alphas ~quarterly; every cycle = roadmap → demo →
  debrief → next roadmap, all public. "A good game is not created out of orchestrated hype…
  keep emotions in the locker."
- **Playtest #7 structure**: Steam Playtest feature + Discord waitlist; free; NDA (no public
  footage; discussion only on official channels); revocable seats; explicit "this is an alpha,
  do not expect a game."
- **Scenario system**: Lua-scripted starts/triggers/tutorial questlines decoupled from the
  sandbox; used to iterate on focused slices (prologue = Sol system, 2 centuries).
- **Public GitHub issue tracker** separate from private code (the repo Daak found).
- **GPT auto-translation pipeline**: FR/EN core, 7 more languages machine-translated via a
  program he wrote against the GPT API; single-file localization.
- Benchmarks as marketing; "I am not paid by resolved ticket count."

---

## 13 · Consolidated steal-list seeds (⭐ ranked)

| # | Steal | Antimatter source | Heretics landing zone |
|---|---|---|---|
| 1 | Five Ages histogen — seeded history pass stamping every location with era scars, ruins-with-provenance, population character | §3 | new task; feeds T-LORE-1 Chronicle; uses existing conditions/remains/mulberry32 |
| 2 | Faction-gated Backgrounds at Rites of Creation (debt / garrison / exile / fleet), gated by real faction holdings | §4 | Rites of Creation + T-TERR-2 holdings + succession spec |
| 3 | Map lenses + status-as-paint (Prosperity/Conflict/Taint overlays, ownership rings, Besieged markers, turmoil %) | §9 | Map screen (engine lane) |
| 4 | Private vs allocated assets — faction-granted forces lost on defection | §6 | economy + T-DIP-3 Oathbreaker |
| 5 | Turmoil that *does something* — repels trade/missions, decays | §11 | sector status → mission boards/pricing |
| 6 | Theatre suggestions — NPC AI proposes objectives the player one-click adopts | §7 | Strategium N3 |
| 7 | Trade-line stability — route safety emerging from raids vs patrols | §8 | travel + T-TRD-1 |
| 8 | Regional features + encounters — persistent POIs & seeded travel events with rolls/loot/lore | §10 | locations + missions "wonder layer" |
| 9 | Codex — knowledge as ownable/tradable object unlocking hooks | §10 | T-LORE-1 + comms |
| 10 | Per-model sensor signature — loud/quiet models deepening fog | §7 | grid fog (engine) |
| 11 | Feed-the-threat economy — profitable heresy accelerating the doom clock | §8 | taint/tribute flywheel |
| 12 | NPC biographies — accumulated life stories, Fated-style survivability | §11 | N2 + T-LORE-1 |
| 13 | Regime templates for NPC warbands/sub-factions | §5 | NPC layer |
| 14 | Playtest machinery (waitlist, NDA, weekend builds, public tracker) | §12 | Heretics alpha ops, someday |

**The translation constraint (for the crossing discussion):** Heretics 40K is a story-first
written forum. Antimatter's outputs are pixels at 60fps; ours must be *sentences at post
cadence*. Every steal must answer: *how does this surface as written fiction in a thread,
a location page, or a digest — advanced by the day-tick and player posts, resolved
deterministically?* His real-time simulation is the one thing we must never copy.

---

## 14 · Access & next steps

- **No key exists to buy.** Playtest #7 (free) before 2026-10-01: join Discord
  → post in "Playtest wait list" forum topic. NDA: no public footage; private analysis fine.
- Game is Windows/Linux; on Daak's Mac → CrossOver/Whisky or a Windows box (min spec: potato).
- When the build lands: **mine the data files** (exposed JSON + Lua = his entire design,
  machine-readable) + screenshot-driven play sessions against a shot list.
- Unmined veins: Discord history, the playtest itself.

## 15 · Sources & raw files

Primary (in `raw/`):
- `antimatter-devlogs.md` — 24 major Steam devlogs, cleaned full text (2022→2026)
- `antimatter-devlogs-2.md` — 22 further Steam devlogs (demo cycles, roadmaps, updates)
- `yt-transcripts.md` — 27 YouTube devlog/tutorial transcripts (auto-captions, cleaned)
- `ks-2020-posts.txt` / `ks-2021-posts.txt` / `ks-2022-posts.txt` — Kickstarter updates
  recovered via Wayback-archived Atom feeds (incl. **Universe & history generation** full text)
- `ks-organisations.txt` — Organisations devlog (Wayback full-page recovery)
- `ks-atom-posts.txt` — 10 newest Kickstarter posts from the live Atom feed (incl. "The road
  ahead for Antimatter")

Live:
- Steam: <https://store.steampowered.com/app/1343010/> · news <https://steamcommunity.com/app/1343010/allnews/> · FAQ thread `discussions/0/720115848603274896`
- Site/press kit: <https://www.antimatter4x.space/> · Kicktraq: <https://www.kicktraq.com/projects/geopi/antimatter-a-city-builder-and-4x-game/>
- YouTube channel: `UCwtf5J0SyeL_H-42ravBzDQ` · Discord invite `discord.com/invite/2v42fgS`
- Bug tracker: <https://github.com/Geoffroypir/Antimatter-BugsAndRequests>

Method note: Kickstarter post pages 403 all scrapers; full texts were recovered via
Wayback-archived **Atom feed** snapshots (2020/2021/2022) + one archived full page. Steam
news via `ISteamNews` API. Video transcripts via `yt-dlp` (android player client) — installed
in Daak's user Python.
