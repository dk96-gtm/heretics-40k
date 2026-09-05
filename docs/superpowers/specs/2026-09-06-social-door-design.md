# T-SOC-1 — The Hall (The Social Door) — Design (LOCKED 2026-09-06)

**Status:** DESIGN LOCKED with Daak across the 2026-09-05/06 sit (rulings dated below).
**Builds on:** door tiers (T-DOOR-1), npcState minds (NPC AI v1.6), day profiles (T-TIME-1),
doctrine axes (T-NPC-4), standing/WORK/seats (T-TERR-2), Chronicle + far churn (T-NPC-3 N2),
mission generator incl. modifiers/named premiums/faction-filtered kills (T-MSN-1A/B/C),
non-lethal + CAPTIVE/REMAINS (T-MISC-1/T-ITEM-1), CONDS (T-CMB-1).
**Absorbs:** T-MOD-1 (civilian models fold into this slice — Daak 2026-09-05).
**Feeds (seams, not builds):** T-LORE-1 Chronicle & Rumor, Stage-3 AI NPC dialogue,
Living Galaxy local politics, seat-holder petitions.
**Canon target:** data v1.38+ (branch already minted v1.37; version-ladder by execution order).
**Lanes:** canon + 🔥 engine + tests + docs.

---

## 0. Daak rulings this sit

1. **Hybrid door** — Crowd + Regulars + Events are three layers of ONE room, not rival designs.
2. **True rumors** — patrons speak real world state (chronicle, sector statuses, war clocks,
   off-planet mission boards), never pure flavor text.
3. **Regulars run on day-phase schedules** — miss the phase block, miss the character.
4. **Dynamic NPCs are location-scoped now, with a traveler seam** in the data shape
   (`home`/`current` split) so promoting named souls to travelers later is an upgrade, not a rewrite.
5. **Patron pools key off location type × location status × ruling faction** — a hive city's
   crowd is not a military outpost's.
6. **Scale via the materialization ladder** — NPCs are seed-math until touched; only met NPCs
   store state; only named souls are ever simulated.
7. **T-MOD-1 folds in** — the ~20 civilian model rows mint in this slice; patrons have bodies
   from day one (brawls, pit fights, captures all legal).
8. **Verbs and names grow from the 20 cultures** — the generic pub verb set was rejected;
   per-sub-faction skins + four universal verb atoms with faction expressions (§4).
9. **Trust is judged by the culture** — act weights derive from doctrine axes, with four
   authored overrides; Tyranids get the recognition-ladder reinterpretation (§6).
10. **Event roster v2 blessed** — Muster Call cut; Ambush, Notable, Herald, Fugitive, Good
    Season added; 15 families at two depth tiers (§7).
11. **One mission generator, two surfaces** — social jobs are real mission rows surfaced
    through people, never a parallel system (§8).
12. **The giver, not the channel, shapes the job** — flat off-book premium rejected; giver
    profiles + seeded Local Powers carry pay/consequence/tone (§8–§9).
13. **Local Powers blessed in full** — labels with profiles, not simulated actors; feuds are
    weather, not war; promotion seam reserved (§9).
14. **Plumbing blessed** — standard tiers I–III (tier = social gravity), seat-commissionable,
    common at inhabited types, no orbit/space this slice, tomb-dormancy respected (§10).

---

## 1. Vision & architectural identity

The Hall is the social front-end of the NPC layer: the place where stories, missions, intel,
and consequences surface **through people**. Its architectural identity: **the first door whose
content outranks its catalog.** Every other door sells things off a price list; the Hall's
stock is people and happenings, seeded from world state. It invents almost no state — it is
the first surface that READS all of it at once: day phase, location condition, sector status,
chronicle, standing, trust, unrest, local powers.

Design laws honored:
- **No parallel systems.** Jobs ride the mission generator; fights ride the battlefield grid;
  memory rides npcState; records ride the Chronicle; buffs ride CONDS.
- **Seed-math scale.** Thousands of encounterable NPCs, near-zero storage (§3).
- **Stage-3 AI seam.** All dialogue is templated line-picking in Stage 1; the same NPC +
  memory + disposition upgrade to generated conversation later without a data reshape.

## 2. The door kind — `hall` — and its 20 skins

Generic kind name: **Hall** (terse, fits Shop/Forge/Altar/Muster). Unlike other doors' skins
(imperial/chaos blocks + per-xenos), the Hall carries **per-sub-faction skins** — the social
space IS the culture. Skins also carry: verb labels, offering spec, contest form + resolver,
hall-law flag, rung names, regular-role names, trust-code override (where authored).

| faction | hall name | what it is |
|---|---|---|
| Black Legion | The Trophy Hall | warband hall of claimed glory |
| Death Guard | The Poxfeast | the Grandfather's groaning table — jolly, rotting |
| World Eaters | The Skullpit | the pit IS the parlor |
| Thousand Sons | The Athenaeum | dust-quiet hall of whispered lore |
| Emperor's Children | The Salon | chamber of exquisite excess |
| Daemons | The Carnival | warp-carnival, pitched where the veil is thin |
| Adeptus Astartes | The Saga-Hall | feast benches, deeds sung |
| Astra Militarum | The Mess | amasec, dice, smokes — the one literal pub |
| Adeptus Mechanicus | The Communion | data-exchange congregation, oil libations |
| Adepta Sororitas | The Refectory | convent table + hymnal vigil |
| Adeptus Custodes | The Vigil | sparse hall of watchers |
| Tyranids | The Broodpool | synapse-communion pool |
| Orks | Da Grog Den | grog, squig-bets, scrappin' |
| Necrons | The Court | dead dynasty's antechamber — protocol and remembrance |
| Aeldari | The Dome | paths cross, memory-songs |
| Drukhari | The Gallery | box seats above agonies, poison salons |
| T'au | The Hall of Unity | communal meal, earnest civics |
| Genestealer Cults | The Congregation | the family's basement meeting |
| Leagues of Votann | The Hearthhold | ancestor-hall kin-drink |
| Harlequins | The Masque | the performance that is also the meeting |

## 3. Who is in the room — three sources, one materialization ladder

A visit renders a mixed cast from three sources:

- **★ SCHEDULED REGULARS** — 1–3 persistent fixtures (per tier, §10) with npcState minds,
  present only during their authored day-phase blocks (read against the planet's `day_profile`).
- **◈ DYNAMIC NPCs** — a small persistent seeded population of the NAMED LOCATION itself
  (5–10 souls) who shift between its spots by phase; the Hall is where they concentrate.
  Data shape carries `home`/`current` (ruling 4) — location-bound this slice.
- **○ THE CROWD** — day-seeded rotating patron texture, 2–8 by tier and phase.

**Pools:** patron archetype tables keyed by **location type × location condition/status ×
ruling faction** (ruling 5). A Sacked hive pub fills with looters and refugees; a Besieged one
is half-empty and nervous. Population rank feeds texture (endless faces vs the same six).

**The materialization ladder (ruling 6):**

| tier | state | storage cost |
|---|---|---|
| 0 POTENTIAL | population = seed ⊕ pool table | 0 bytes |
| 1 RENDERED | tonight's room = seed(loc ⊕ day ⊕ phase) | 0 bytes (recomputed) |
| 2 MET | interacted-with patron gets a mind (existing npcState rule: only met NPCs get a mind, never re-seed) | ~1 small save entry |
| 3 NAMED SOUL | regulars + rare promoted travelers; only these are ever simulated | whereabouts on the tick |

**Bodies (ruling 7):** T-MOD-1 mints ~20 civilian model rows (one low-PC populace model per
sub-faction; 1–2 wounds) + a `sex` field on models (fixed where lore dictates — Astartes/
Custodes male, Sororitas female — varied/seeded elsewhere). A patron = seeded face + archetype
role + civilian model ref → every patron is a legal combatant; hall violence, pit bouts,
captures, and chronicle records of them all work with zero new combat machinery.

## 4. The verbs — four universal atoms, faction expressions

Four verb MECHANICS engine-wide; label, cost, and flavor per skin (canon data).

**❶ COMMUNE** — hear what this soul knows. Free. The true-rumor verb; what a patron knows
routes through role + culture (a docker knows cargo, a trooper knows the war, the Court
recites the dynasty's records). Sources in §5.

**❷ OFFER** — the culture's authentic gesture, spending something real for disposition/trust.
Per-skin offering spec makes this an economy sink keyed to faction: currency (Mess amasec,
Communion data-tithe, Grog Den rounds), **items** (Skullpit: a worthy skull = REMAINS;
Gallery: a CAPTIVE — the Drukhari slave-stock demand channel), resources (Broodpool biomass;
Famine-state Food offers, §7).

**❸ PETITION** — ask for work / offer service. The mission-surfacing verb (§8).

**❹ CONTEST** — the culture's native contest, resolving through exactly two engines:

- **⚔ BRAWL** — real non-lethal fight on the battlefield grid (existing duel + non-lethal +
  capture machinery). Skullpit fight, Trophy Hall blade-duel, Saga-Hall cage spar, Vigil
  forms, a proppa scrap, Hearthhold grudge-bout, Gallery knife-duel, Dome blade-art.
- **⚁ MATCH** — new small pure helper: seeded opposed roll + wager + optional CHEAT choice
  (better odds, seeded catch risk; judgment per trust code §6). Mess dice, Athenaeum
  riddle-duel, Communion logic-bout, Refectory devotion, Court regicide, Hall of Unity
  strategy game, Masque dance-trial, Salon one-upmanship, Poxfeast endurance, Carnival
  soul-wager, Congregation kin-cards, Broodpool dominance.

Winning either pays the same social currencies: disposition/trust, hall cred, intel from the
loser, wager stakes.

**Hall law:** the Hall is bound ground. Violence inside the contest frame is sacred; violence
outside it (attacking un-challenged) = standing hit with the ruling faction + barred from the
door N days. Per-skin exception flag (`hall_law:false`): in Da Grog Den unsanctioned scrapping
IS the contest. The Gallery watches an Ambush (§7) as theater — crowd never intervenes there.

## 5. True rumors — the intel routing table

COMMUNE draws from REAL state (ruling 2). Sources, each a "register":

| register | reads | example |
|---|---|---|
| war | live ultimatum clocks, recent chronicle records | "the Pallid Reach burns — a clock ticks on Garden's Gate" |
| trade/work | off-planet mission boards (real rows, §8) | "purge work posted on Nurth" |
| state | sector statuses, planet conditions | "the Reach is starving" (sectorStatus === Famine) |
| local politics | local-power feuds + ledger (§9) | "Vashk moves against the Rifles" |
| ground memory | this location's chronicle (already injected into NPC talk by N2 §3b) | "this ground remembers…" |

A patron's role + affiliation picks the register and the angle (the enforcer and the clansman
describe the same theft differently). Rendering is templated Stage-1 (CHRON.account pattern);
Stage-3 AI narrates from the same record data.

## 6. Regulars, the trust ladder, and the faction judge

**Three universal roles, named per skin:**
- **★ HOST** — keeper of the space and its memory (Quartermaster-Sergeant, Curator,
  Chamberlain, da Brewboss). Channel: knowledge.
- **★ BROKER** — dealer in access (the Scrounger, Whisper-Merchant, Bargain-Keeper, a Kroot
  envoy). Channel: access.
- **★ CHAMPION** — embodiment of the contest (Pit-Champion, Riddlemaster, card-shark,
  the Masque's Lead). Channel: glory.

Role presence weighted per skin + tier (the Vigil may staff only a Host; the Gallery's Broker
outweighs its Champion). Regulars are seeded-archetype NPCs riding npcState; crown/story
locations may carry hand-authored ones above the generated layer (the 5 alpha NPCs pattern).

**The ladder — four rungs, per-regular per-commander** (stored on the regular's npcState entry):

```
④ SWORN    they act for you — the outward bridge
③ TRUSTED  the back room opens — the role's real service
② KNOWN    better versions of the four verbs
① STRANGER the public face
```

**Role unlocks:** HOST ② two-source rumors → ③ full ground memory + early warnings (war-clock
intel ahead of the digest) → ④ sanctuary: a one-time WORK grant at this location (the
seat-petition road). BROKER ② off-book PETITION rows → ③ the fence (sell CAPTIVE/REMAINS/hot
goods at better rates; off-catalog oddments) → ④ introductions (a hidden NPC, a closed door,
a standing bump). CHAMPION ② formal wagered bouts → ③ training (purchasable temporary CONDS
buff, expires, no permanent creep) → ④ the title fight (beat them in their own form: chronicle
record written, hall-wide disposition up, ruling-faction standing +1 notch).
**Design law: rung ④ is never a bigger discount — always a bridge into another system.**

**The act ledger** (universal acts; WORTH is faction data):
OFFER · WIN · NOBLE LOSS · CHEAT-CAUGHT · CHEAT-CLEAN · JOB DONE · JOB DROPPED · LAWBREAK ·
PRESENCE (repeated visits in the regular's phase).

**The judge (ruling 9):** default act-weights derive from the T-NPC-4 doctrine axes via one
formula — high **honor**: NOBLE LOSS ≈ win, any CHEAT falls hard; high **cunning**:
CHEAT-CLEAN climbs (the deception was the demonstration), CHEAT-CAUGHT falls for incompetence;
high **ferocity**: only WINs move the needle; high **pragmatism**: JOB DONE outweighs
sentiment; high **supremacism**: OFFERs/deference weigh double. The battlefield personality
and the barroom judge are the same data — behavior stays coherent game-wide.

**Four authored overrides:** **Daemons** (trust is a bargain — rungs are priced, climbing is a
transaction with stakes) · **Necrons** (protocol is everything; a perfect OFFER of remembrance
outweighs ten wins; LAWBREAK nearly unforgivable) · **Harlequins** (a STYLISH caught-cheat
climbs — the performance mattered) · **Tyranids** (below).

**The Tyranid recognition-ladder:** the hive cannot trust; the ladder measures the Hive Mind's
RECOGNITION of you as a useful organism. Same rungs/storage, renamed per skin:
① PREY-SHAPED → ② TASTED → ③ PATTERNED → ④ ASSIMILATED-ADJACENT. Climb ≈ OFFER (biomass) +
WIN (dominance, hunts); cheating doesn't parse (no rules in the pool, only outcomes); COMMUNE
at high rungs returns the hive's sensorium (what the swarm has tasted/seen across the sector).
Regulars: the Synapse-Node (Host), a Lictor-Shadow (Broker — brokers hunts and prey-locations),
the Broodguard Alpha (Champion).

## 7. Events — 15 families, two depth tiers

An event family = a canon row with a **trigger pattern** over real state + a seeded ambient
chance (mission-board pattern: day ⊕ location seeds, deterministic, chunk-independent).
Max ONE event per Hall per day; triggered outranks ambient. Faction expression rides the skin
(one flavor line per family per allegiance + the weird four), never new families.

**WORLD-REACTIVE** (the world-mood mirror — walk in and read the ground's state from the room):

| family | trigger | effect sketch |
|---|---|---|
| ❋ THE GOOD SEASON | sector/planet Thriving | crowd swells and spends; rich wagers; OFFERs cost less; Auction/peddlers likelier; ambitious jobs |
| ✗ THE FAMINE TABLE | Famine state | thin desperate crowd; Food OFFERs worth ×3 trust; ugly jobs |
| ☣ THE PLAGUE NIGHT | taint high | sickness, dread; apothecary-flavored jobs |
| ⚑ THE SHAKEDOWN | unrest high | the ruling-aligned power's enforcers sweep (named, §9); tithes/papers; hides the Fugitive risk |
| ▼ THE WAKE | battle lost / ground sacked nearby ≤~5 days (chronicle) | grief; fallen-honoring OFFERs ×2; mourner carries a revenge job at the ACTUAL aggressor faction |
| ▲ THE VICTORY FEAST | battle won / siege repelled nearby ≤~5 days | first OFFER free; rich wagers; the cheapest night to climb; the room drinks to the player if it was their war |

**PLAYER-REACTIVE** (your record walks in):

| family | trigger | effect sketch |
|---|---|---|
| ⚔ THE AMBUSH | a faction at WAR standing with you, OR a crossed local power (§9), + seeded roll | killers hit you IN the hall — real fight on a small interior board; attackers broke hall law → crowd/regulars side with you (Gallery excepted); chronicle record on survival |
| ☠ THE GRUDGE | chronicle attribution: a patron lost kin in one of your battles | "You were at Kraith Drift." Fork: face them in the hall's contest form / pay weregild / refuse and feed a later Ambush roll |

**VISITORS:**

| family | trigger | effect sketch |
|---|---|---|
| ◈ THE STRANGER | ambient | off-book job, peddler, or informant; drawn dark on war-touched worlds |
| ★ THE NOTABLE | ambient, calm-weighted | a famous LOCAL visits — the planet's ruler (rulerFaceOf exists), a seat governor, a hero named in a recent local victory record; once-only petition/audience access |
| ⚡ THE HERALD | a big-magnitude galaxy event ≤~3 days (capture/planet transfer/drama conclusion) | news bursts in — the whole room hears it; THE information-travels seed for T-LORE-1 |
| ◎ THE FUGITIVE | ambient, war/unrest-weighted | a hunted soul begs sanctuary: hide (Shakedown risk, standing hit with hunters) or sell out (standing with hunters, hall trust collapse if known) |

**AMBIENT / CALENDAR:**

| family | trigger | effect sketch |
|---|---|---|
| ⚁ CONTEST NIGHT | ambient, evening/night phases | formal bracket in the native form; bigger stakes; trust ③+ = title-fight access |
| ✦ THE HOLY DAY | per-faction seeded calendar | festival; OFFER/trust bonuses; unique rumors |
| ◇ THE AUCTION | ambient rare + Broker ②+, power-sponsored | rare-goods channel; Gallery flesh-auction, Communion relic bidding |

**Two depth tiers (ruling 10):** mood rows (Good Season, Famine Table, Plague Night, Holy Day)
= crowd + verb modifiers + flavor, no new interactions. Interaction rows (the other 11) each
carry ONE real encounter or fork. Full breadth at launch, nothing a stub, authoring
concentrated where the player acts. Post-alpha growth = adding rows (faction festivals, GSC
infiltration nights, a Masque performance that is secretly a prophecy).

## 8. Jobs — one generator, two surfaces; the giver shapes the deal

**One generator (ruling 11).** The mission machinery is the ONLY job source. Rows carry a
surface channel: `board` (public location panel, ships today) vs `social` (never on the
board; reachable only through people — PETITION, Broker ②+, Stranger/event rows). Same
payouts, objectives, threads, and the global accept-cap of 3.

- **Event-bound params:** the Wake's revenge job targets the actual aggressor faction from the
  chronicle record (faction-filtered kill objectives exist, T-MSN-1C); Famine jobs are
  food-shaped; the Fugitive IS the job.
- **Rumor-revealed boards:** COMMUNE intel can reveal a real row on another planet's board —
  information, not exclusivity; travel to accept.

**The giver, not the channel (ruling 12).** Every social job carries a giver whose PROFILE
sets pay curve, consequence type, and tone. The flat off-book premium is dead. The clan's
broker pays high cash now with legality smell and disowns you on failure; the Lord-General
pays modest but lands ruling-faction WORK + standing, and failure "never happened". Trust
gates WHICH givers talk business (① the desperate and strangers → ②–③ the local powers' real
work → ④ the powerful ask for you by name); the giver sets the terms.

## 9. Local Powers

**Anatomy:** a named LABEL with a profile, never a simulated actor. Per named location, seed
1–3 powers (loc id ⊕ archetype table — deterministic forever, zero storage):
`{name (generated), archetype, profile (pay style · consequence style · favored mission
families · legality smell), relations (seeded stance toward the location's other powers:
allied / cold / feud), ledger (per-commander, only once touched: jobs done FOR · jobs that
CROSSED)}`.

**Archetype tables** keyed by location type × ruling faction (spec authors the full grid;
blessed sample): imperial hive — clans, cartels, a noble house, the enforcer precinct, a
redemptionist sect · Militarum fortress — regiments, command staff, the commissariat, a
quartermaster ring · Mechanicus forge — forge-fanes, magi covens, data-cults · Sororitas
shrine — orders, pilgrim brotherhoods, relic wardens · World Eaters hold — rival PIT-STABLES
owning the Skullpit's champions · Drukhari port — kabal cells, wych cults, haemonculus covens ·
Orks — rival mobs, mek shops, a squig syndicate · T'au — the caste offices, politely
competing · Daemon world — courts of the Four, feuding · GSC — cult cells by generation,
brood circles · Votann — kinhold leagues, prospect guilds, the grudge-keepers · Tyranids —
tendril-lineages (competing bio-strains, competing appetites) · Harlequins — troupes, whose
rivalries ARE performances.

**Five hooks (all into existing systems):**
1. **They give the jobs** (giver profiles, §8).
2. **They color the room** — regulars/patrons carry affiliation tags; COMMUNE takes the
   power's angle; the Broker's introductions lean toward their power's friends.
3. **They feud, and you get caught in it** — a job FOR one is often quietly AGAINST another
   (the card names the giver; the fine print is who it crosses). Crossing past a threshold
   turns that power hostile: givers dry up, patrons stonewall, and →
4. **They feed events** — the Shakedown's enforcers are the ruling-aligned power BY NAME; the
   Auction has a sponsor; the Ambush's best fuel is a crossed local power (consequences stay
   local, personal, named); the Grudge can wear a power's colors.
5. **They are rumor subjects** — the local-politics register (§5); pre-made subjects for
   T-LORE-1.

**Boundary (ruling 13):** powers do NOT act on the tick, hold territory, accumulate strength,
or resolve their feuds — weather, not war. **Promotion seam** (reserved, unbuilt): a power can
be promoted to a real actor (named leader materializes; N2 churn could animate a feud), and a
seat/governor future has powers petitioning the PLAYER (T-TERR-2 flow-up).

## 10. Plumbing — tiers, placement, commission

**Tiers I–III, standard ladder** (upgrade flow, build timers, world seeding, home doors at
T-III). Tier = SOCIAL GRAVITY:

| tier | crowd | regulars | events & extras |
|---|---|---|---|
| I "the back room" | 2–4 | Host only | mood events + small contests · 1 power visible |
| II "the establishment" | 4–6 | Host + one (Broker/Champion by skin weight) | full roster · 2 powers active |
| III "the institution" | 6–8 | all three | title fights · Auctions · Notables · all 3 powers · festival-scale Holy Days |

**Placement:** common door at inhabited location types (hive cities, settlements, fortresses,
shrine/forge/agri/mining, ports). None in orbit/space this slice; none at uninhabited
wilderness/warzone types; Necron tomb sites follow existing dormancy (the Court convenes only
where the tomb wakes — `tombDormant`). Day phase drives crowd size (night-heavy worlds have
packed long nights); population rank drives texture.

**Seat-commissionable: yes** — standard commission flow (a governor raising a feast-hall to
bind a population is exactly what commissioning is for).

## 11. Data & engine shapes

**Canon (v1.38+):**
- `galaxy.doors` += the `hall` row: kind/name/does/rarity/tiers + per-sub-faction `skins`
  carrying: hall name, verb labels, offering spec `{kind: currency|item|resource, accepts,
  cost}`, contest `{name, resolver: brawl|match}`, `hall_law` flag, rung names, role names,
  role weights.
- `rules.hall`: trust ladder (rungs, climb/fall act values default formula constants),
  act ledger ids, trust-code overrides (daemons/necrons/harlequins/tyranids), event family
  rows `{id, tier: mood|interaction, trigger, effects, flavor per allegiance}`, patron pool
  tables (location type × status × faction archetypes), local-power archetype tables +
  relation seeds, giver-profile archetypes, MATCH resolver constants (odds, cheat shift,
  catch chance vs cunning), hall-law penalty (standing hit + barred days).
- `location_types`: add `hall` to inhabited types' door lists.
- **T-MOD-1 payload:** ~20 civilian model rows (one per faction, low PC, 1–2 wounds) +
  `sex` field on models (lore-fixed or seeded-varied).
- Missions: social-eligible family rows gain `surface` semantics (default `board`).

**Engine:**
- Pure `/*<hall-core>*/` HALL region (DOM-free, node-tested): patron seeding (pools ⊕
  materialization), regular scheduling vs `day_profile`, trust ladder + act judgment
  (axis-derived weights + overrides), MATCH resolver (seeded opposed roll + wager + cheat),
  event trigger evaluation + selection (one/day, triggered > ambient), local-power seeding +
  relations + ledger thresholds, rumor source routing (returns typed intel the renderer
  templates).
- Renderer in the requisition path (door framework), reusing entity-overlay/threadView card
  idioms; interior Ambush/brawl boards ride `genBoard` with a small-interior config.
- **Save state:** regular minds + rungs ride `S.npcState` (existing shape, extended fields);
  `S.social = {powers:{[locId]:{[powerId]:{done,crossed}}}, metPatrons…}` — ⚠ new S keys seed
  in BOTH `foundingWorld()` AND `init()` (established gotcha).
- Jobs surface through `MISSION` rows (surface channel + giver ref); accepting spawns threads
  through the existing pipeline untouched.

**Tests:** `tests/hall-core.test.js` (seeding determinism/chunk-independence, trust judgment
per culture incl. overrides, MATCH resolver + cheat odds, event trigger matrix, power ledger
thresholds), `tests/canon-hall.test.js` (20 skins complete, verb/offering/contest/rung/role
coverage per skin, pool + power tables cover all inhabited types, civilian rows ×20, pins).

## 12. Slicing (for the implementation plan)

Suggested build order (plan doc decides finals): **Slice A** — canon mint (door row + skins +
civilians + pools) + hall-core seeding + renderer + COMMUNE/OFFER + true rumors + mood events.
**Slice B** — regulars + trust ladder + faction judges + CONTEST (both resolvers) + hall law.
**Slice C** — local powers + giver profiles + social mission surface + interaction events
(Ambush/Grudge/Stranger/Notable/Herald/Fugitive/Auction/Contest Night/Wake/Feast/Shakedown).
Each slice ships browser-verified with 0 console errors per working rules.

## 13. Tunables flagged for Daak (defaults, not locked)

Crowd sizes per tier/phase · trust climb/fall act values + the axis-derivation constants ·
MATCH odds + cheat catch curve · offering costs + Famine ×3 / Wake ×2 multipliers · event
ambient rates + trigger windows (~5-day chronicle recency, ~3-day Herald magnitude) ·
power-crossing hostility threshold · hall-law barred-days + standing penalty · title-fight
standing notch · training-buff price/duration · civilian model statlines.

## 14. Open questions deliberately deferred

- Traveler promotion (which souls, what cadence) — the `home`/`current` seam waits for it.
- Powers petitioning a governor player — waits for a seats follow-up.
- Stage-3 AI dialogue — the record/template seam is cut (§1, §5); nothing to build now.
- T-LORE-1 will formalize rumor SPREAD (who knows what, when); the Hall ships rumor SOURCING.
