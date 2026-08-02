# Economy — Typed Resources, Sinks & Combat Cargo (design)

> **Status:** design LOCKED with Daak across the 2026-07-26/27 session. This is the economy
> spine: three typed resources, production by planet type, location-share ownership, storage,
> force cargo, battlefield cargo (baggage train), and the sink family (tithe, door leveling,
> wear, consumables, services, ransom/bribes).
> **Why:** the shipped flywheel only pours currency IN (production, tithes, loot). Without
> outflows a persistent world inflates until money is meaningless. Sinks are designed to feel
> like the setting breathing down your neck, not like taxes.
> **Scale:** this is a PROGRAM spec — implementation is three phases (below), each with its
> own plan. Do not build it as one slice.

## Locked decisions (session log)

| Axis | Decision |
|------|----------|
| Resource model | **Typed from the start (Path B): Food · Material · Fuel.** No "Rarities" type. |
| Production authoring | **Per planet TYPE, not per planet** — 20 authored rows (`resource_output`), every planet inherits its type's profile. The point table below IS the canon data; the old `prod_mult` scaffold no longer derives it (mult keeps its other uses). |
| Where production lives | **Locations produce; the planet is the sum** (Option 2). The type's output is a budget split across the planet's productive SURFACE locations, weighted by location tier. Rule a location → earn its share. Partial conquest siphons output mid-war. Orbit locations produce nothing. |
| Consumption | Population eats Food per tick. Hive/Forge worlds are net Food importers by design — the Imperium's logistics nightmare, on purpose. |
| Storage | Per-location, per-resource caps by location tier. **Overflow is LOST at tick** (spoilage/pilferage). Tradeport door adds capacity. |
| Force cargo | Per-force hold, **resources only** (gear inventory stays shared account-wide for the alpha). Slots scale with force CP. Stack size ×40. |
| Full item break-up | Per-force ITEM inventories (Waulers hauling grenade stacks etc.) is the designed end-state but **DEFERRED to the ships/space era**, when cargo gets re-architected anyway. Recorded, not dropped. |
| Combat cargo | Cargo materializes on the battlefield: CP-slot stacks = an immobile **baggage train** object; Wauler stacks ride the mule model. Seize mirrors the Capture grammar. Aftermath: the victor loots freely, capacity-limited. |
| Consumables | Simplest model: sold in packs (×3/×5/×10, small bulk discount), **destroyed on use**, rebuy at shops. (GLOSS "single use — destroyed once spent" stays TRUE.) |
| Wear | Armour wears by damage absorbed; weapons wear by attacks made (quarter rate). Wear lives ON the item forever; assessed only at thread conclusion (any conclusion, fleeing included); repaired for fees. |
| Augmetics | **VETOED for now** (Daak 2026-07-26). Bring back as its own later discussion. |
| Blessing oils | Scratched. Armoury gets melt-down instead. |
| Door services | Tier-gated: tier 1 = buy/sell only · tier 2 = services · tier 3 = grand rites. |

## 1 · The three resources

`FOOD` · `MATERIAL` · `FUEL`. Integer points. Displayed with theming at two layers:

- **Production label** comes from the planet type: an Agri World's Food is "grain-tithe", a
  Mining World's Material is "ore", a Frontier World's Fuel is "promethium". Flavor text only —
  mechanically one Food is one Food.
- **Demand voice** comes from the player's faction: Imperials pay "the Tithe", Orks feed
  "da Loot Pile", Tyranids accrue "Biomass". Same numbers, faction language.

## 2 · Production — the authored 20-type table

Points per planet per in-game day (one WORLD tick), before modifiers. This table is canon:
each `planet_types` entry gains `resource_output: {food, material, fuel}`.

| Type | Food | Material | Fuel | Why |
|---|---|---|---|---|
| Forge World | — | 18 | 2 | A planet that IS a factory. Top prize in the game. |
| Hive World | — | 14 | 4 | Billions of hands; hungriest world there is (pop 5). |
| Industrial World | — | 11 | 5 | Volume production anyone can hold. The workhorse. |
| Kin Hold | — | 10 | 6 | Votann deep-crust industry, fuel-rich. |
| Agri World | 14 | — | — | Feeds the sector; the Famine threshold knows it. |
| Mining World | — | 8 | 6 | Ore and promethium; regenerating deposits. |
| Sept World | 4 | 6 | 2 | T'au efficiency — managed balance. |
| Civilized World | 4 | 4 | 2 | Baseline control case. |
| Frontier World | 4 | 2 | 4 | Homesteaders feed themselves; rigs chase promethium. |
| Xenos World | 3 | 3 | 2 | Inscrutable mixed economies. |
| Fortress World | — | 3 | 5 | A bastion HOARDS fuel — shields and tanks drink it. |
| Daemon World | — | 3 | 5 | Raw warpstuff burns. Chaos-only per canon effect. |
| Feudal World | 6 | 3 | — | Harvest-rich Knight fiefs; organic abundance. |
| Shrine World | 2 | 2 | 2 | Pilgrim tithes; the wealth here is faith. |
| Exodite World | 4 | 2 | — | Aeldari pastoral abundance by choice. |
| War World | — | 3 | 2 | Salvage economy — the battlefield is the mine. |
| Feral World | 3 | 1 | — | Beast-herds, hides, tribute. |
| Death World | 2 | — | 1 | Survivors and rare extracts. |
| Tomb World | — | 1 | 1 | Nearly silent until it wakes. |
| Dead World | — | — | — | Exterminatus output. Nothing, forever. |

Modifiers multiply on top exactly as production already does: Rift home bonus, holding
status, location conditions (Besieged/Sacked/…), sector status. **Faction world types remain
governable by anyone** — the faction tag gates unique doors/effects and full value
(T-FAC-1 Govern-vs-Annihilate), never ownership.

**Homeless factions are homeless on purpose.** Astartes/Custodes recruit rather than own;
Astra Militarum is at home on every standard world; Tyranids consume (Infested + Amass
Biomass); GSC parasitize; Drukhari/Harlequins raid from the webway. Their income identities
are named in the T-FAC-1 pass — predation by design, not a gap.

### Location shares

**Every non-orbit location counts as productive.** A planet's `resource_output` divides
across them **weighted by location tier** (tier III carries three shares, II two, I one;
integer-rounded, remainder to the highest-tier location). Ruling a location earns its share on each tick. Example — Hive
World (—/14/4): Hive Primus III → —/7/2 · Manufactorum II → —/5/1 · Underworks I → —/2/1 ·
Orbital Dock → nothing.

### Consumption

Each location demands Food per tick equal to its **population rank step** (the canon 0–5
ladder). Fed: normal. Underfed: population pressure — feeds the Famine/status machinery via
T-STAT-1 (this spec defines the demand; T-STAT-1 owns the consequences). Net effect: the
biggest Material producers cannot feed themselves — trade or starve.

## 3 · Storage — stockpiles with walls

Per location, per resource: **cap = 40 × location tier** (I 40 · II 80 · III 160). A
**Tradeport** door adds +40 × its door tier to its location. Planet capacity = sum of its
locations. **Production past cap is lost at tick** — spend it, haul it, or build storage.
(The Sacked condition's `resources: −20` now has a real stockpile to bite.)

## 4 · Force cargo — the hold

New per-force state (`cargo`), resources only:

- **Slots:** 1 per 5 force CP, minimum 1. One slot = one resource stack, **×40 max**.
- **Supply Wauler** (new item): occupies a model's equipment slot; grants +1 cargo slot;
  that stack physically rides the mule model in combat. Teeth-for-logistics trade.
- Deposit/withdraw freely at locations you rule; foreign tradeports take an exchange cut.
- In transit, cargo is on the force: a loaded force is a target.
- Visible in the Forces tab beside AP/CP; a loaded force reads as loaded.

## 5 · Cargo in combat — the baggage train

When a cargo-carrying force enters a combat thread:

- **CP-slot stacks → the baggage train:** an immobile battlefield object in the deploy zone
  (rides the T-MISC-2 destructible-objects seam). Container tier is bought gear and sets its
  wounds: **Crates I (4 HP, cheap) · Armoured II (8 HP) · Vaulted III (12 HP)**. Raiders can
  see what you cheaped out on.
- **Wauler stacks → on the mule:** move with the model; if it dies or is captured, the stack
  drops as a lootable pile where it fell.
- **SEIZE (standing action, mirrors Capture):** requires a **Cargo Rig** tagged item
  (tiers I/II/III → AP 3/2/1, same ladder as Capture), adjacency to a train/pile/drop, and
  free cargo capacity. One stack per action. No rig → no mid-battle theft.
- **Destruction:** attack the train — denial warfare when you can't haul it.
- **Exit:** drag the train (pursuit-odds penalty) or abandon it and run clean.
- **Aftermath:** the standing force claims all field cargo, **no equipment needed, capacity
  limited**, in the same aftermath window as spoils looting. Excess flows into the location's
  stockpile if the victor rules it; in the wilds it scatters and is lost. Nothing teleports.

## 6 · The sink family

### 6a · The Tithe (holding upkeep)
Each held location costs per tick: **2 × location tier in currency** (garrison + faction
tithe) plus its population's Food demand (§2). Unpaid/unfed accrues **Unrest** on the
holding; sustained Unrest drifts the location toward rebellion/loss via the status machinery
(consequence mechanics owned by T-STAT-1). Empires become self-limiting: expansion beyond
your economy means garrisons go unpaid and worlds slip.

**§6a addendum (Daak rulings 2026-07-31, shipped with T-ECN-1):** Unrest is a
RECOVERABLE pressure gauge — on any tick where a holding is BOTH fed and fully tithed,
its counter decays by 1; at 0 the key clears and the digest announces recovery
("Unrest subsides"). Unhealthy days keep the +1s (famine and unpaid tithe count
separately). The alpha-window squeeze (all 20 crown worlds food-negative until the E2
trade valve) ships AS DESIGNED — no crown-world feeding, no digest muting.

### 6b · Door leveling
Doors level with currency + typed resources, and construction takes ticks:
**tier II = 200 currency + 120 Material + 30 Fuel, 3 days · tier III = 500 currency +
300 Material + 100 Fuel, 7 days.** (Altar rites may substitute Food for Material at equal
points — offerings feed pilgrims.) Higher tiers unlock services (§6e) and raise the
location's production share (§2) and storage (§3) — the two economy tracks feed each other.

### 6c · Battle attrition (wear & repair)
- Wear counters live **on the item**, forever — they travel with the piece through store,
  trade, and sale (price battered gear accordingly). Separate from the battle-record stats.
- **Armour** wear += damage absorbed. Thresholds: 20 absorbed → **Worn** (−1 all defenses),
  50 → **Battered** (−2). **Weapons** wear += attacks made, at a quarter rate: 40 attacks →
  **Fouled** (−1 damage), 100 → **Failing** (−2). Named/relic gear wears at half rate
  (machine-spirits remember).
- **Assessed at thread conclusion only** — never mid-battle; stats are stable inside a
  fight. Every conclusion counts, fleeing through pursuit included: escape with your life
  and a repair bill.
- **Repair:** Armoury (armour) / Forge (weapons), fee scales with wear state; resets wear,
  keeps the battle record. **Melt-down:** Forge melts weapons, Armoury melts armour, either
  returns ~30% of the piece's value **in Material**.

### 6d · Consumables
Shops sell packs: ×3 / ×5 / ×10 at ~5%/10% bulk discount. Used = destroyed = gone; rebuy at
shops. Store inventory stacks identical consumables with a count (UI grouping only).

### 6e · Door services (the offerings layer)
Gated by door tier — **tier 1 buys and sells, tier 2 opens services, tier 3 opens grand
rites**:

| Door | Tier 2 service | Tier 3 grand rite |
|---|---|---|
| Altar | cleanse taint (price scales w/ amount) · pre-battle blessing = a bought temporary condition (rides the T-CMB-1 CONDS system: Ward, Regen…) | Consecration rite (flips location condition) |
| Forge | weapon repair · melt-down | — |
| Armoury | armour repair · melt-down | — |
| Apothecarion | healing fees between threads · revival fees | *(augmetics VETOED — parked)* |
| Muster | garrison hire (bolsters holding defense; ties §6a) | — |
| Relay | buy intel (scout report on a sector's forces) · propaganda (currency → Influence) | — |
| Arena | stake wagers · paid training bouts | — |
| Throne Room | — | Festival/Triumph: big spend → prosperity + population bump |
| Tradeport | exchange valve Food/Material/Fuel ↔ currency at unfavorable rates | — |

### 6f · Ransom & bribes
- **They take yours:** captured model → captor faction sets ransom (PC/rank-scaled, greed-
  colored) → Comms hail with a deadline → pay = release + travel home; lapse = the faction
  decides the fate in character (Drukhari arenas, Chaos altars, Ork pits) — some fates spawn
  a timed rescue-mission thread. Losing someone opens gameplay.
- **You take theirs:** hail the owning faction, demand a price; the NPC answers through its
  personality matrix and dossier standing; or sell to a third party (Drukhari flesh-markets
  buy anyone) at a standing cost with the victim's faction.
- **Bribes:** door bribes (hostile door serves you at a markup), passage bribes (slip a
  blockade inside a travel thread), gift diplomacy (currency → standing — except honor-bound
  factions, where a bribe is an insult that costs standing; Relay intel tells you who's who).

**Early-valve ruling (Daak 2026-08-02):** the Tradeport currency↔resource exchange is
pulled FORWARD out of full E2 as its own small slice (T-ECN-2a) — every faction can buy
Material/Fuel with currency at unfavorable rates, so no crown-world resource mix is a
hard wall. Pairs with T-GX-G7's crown floor rule (every crown type yields nonzero
Material AND Fuel).

## 7 · Implementation phases (each gets its own plan)

- **Phase E1 — resource core:** canon `resource_output` + `rules.resources` (types, stack 40,
  caps, cargo slots per 5 CP, upkeep constants) · WORLD tick: location-share production,
  Food consumption, upkeep, overflow loss · holdings stockpiles in `S` · Ledger view at HQ ·
  map/location panels show stocks. Lane: canon + 🔥 engine + tests.
- **Phase E2 — sinks at doors:** door leveling costs/timers · wear counters + assessment at
  thread conclusion + repair/melt-down · consumable packs · tier-gated services (blessings
  ride CONDS — **after T-CMB-1 ships**) · Tradeport exchange + storage bonus. Lane: canon +
  🔥 engine + tests.
- **Phase E3 — combat cargo & flows:** force cargo hold + Wauler + container items + baggage
  train (with/behind T-MISC-2) + Seize + aftermath claim (extends the spoils aftermath
  window) · ransom/bribe flows (rides Comms hails + NPC matrix). Lane: 🔥 engine + canon +
  tests.

Dependencies: E1 is self-contained. E2 needs E1 (resources exist) and T-CMB-1 (blessings).
E3 needs E1 + the spoils slice (aftermath window) and prefers T-MISC-2 (train object).

## 8 · Deferred (recorded, not dropped)

- **Augmetics** — vetoed for now; own discussion later (Apothecarion tier 3 is reserved).
- **Item-per-force break-up** — full per-force item inventories + Waulers hauling gear
  stacks; do it ONCE, in the ships/space era, when cargo is re-architected anyway.
- **Typed-resource deepening** (trade routes, per-planet profile overrides) — the type table
  supports per-planet overrides later without redesign.
- **Second-hand pricing** of worn gear at shops — flavor follow-on to §6c.
