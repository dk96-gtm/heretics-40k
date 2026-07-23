# Thread Archetypes — Decisions Log (WIP)

**Status:** IN DISCUSSION · 2026-07-22 · Daak + assistant
**Method:** we walk the agenda one point at a time; agreed calls are recorded here as we go.
The final **spec** (which drives the canon/engine updates) gets composed from these decisions once locked — this file is the running record until then, not the spec.

> Locked upstream: the **5-archetype reduction** is agreed — Battle · Objective · Parley · Transit · World Event. Subtypes become data plugged into an archetype.

---

## Agenda

**Foundations** — 1. resolution model ✅ · 2. canon reconciliation
**Battle** — 3. resolution paths + tiebreak · 4. Duel · 5. Raid (loot) · 6. Expansion vs Domination · 7. Exterminatus · 8. Crusade
**Objective/Mission** — 9. objective resolution model · 10. the 8 subtypes · 11. contested vs uncontested
**Parley** — 12. subtypes · 13. walk-away escalation
**World Events** — 14. the 5 events · 15. fire-now vs Stage-3
*(Transit deferred to T-THR-3.)*

---

## Agreed decisions

### D1 — Round counter, not a round clock ✅
- Every **battle** carries a **round counter** (`state.round`), incremented once per full cycle (player post + enemy response), and it is **shown in the UI**.
- The counter **does NOT end a battle.** Battles end only by existing conditions: annihilation, rout/Exit, mutual. (Rationale: there are already enough ways to win or leave a fight; a hard timeout would be redundant/annoying.)
- The counter becomes a **deadline only for objective-bearing threads** — Missions, and any battle that carries an objective — where the resolution is "reach the target by round N". So: counter universal + visible; cap opt-in per objective.
- Implementation: `state.round` lives in the pure THREAD core (testable, persisted); rendered in the battle sidebar/HUD.

### D2 — Consolidate canon to one block, backed by real definitions ✅
- Merge the two contradicting blocks (`rules.thread_types` + `galaxy.thread_scales`) into **one** `rules.thread_archetypes`, carrying per parent: archetype · subtype roster · scale · world-effect · rewards. Richer subtype list wins; old blocks removed or aliased.
- **Not just a data merge:** every subtype kept in the roster must ship with a concrete, working in-game definition (resolution + options + effect). A subtype with no defined mechanic doesn't go in the roster. The per-archetype points below produce those definitions.

### D3 — How a Battle ends (the losing slope) ✅
Scope: **battlefield only.** Nothing here touches planets/territory — that's a separate topic.
A battle ends by one of three outcomes, which form a single escalation ladder — you can Yield → be denied → Escape → be caught → be Annihilated:

- **Annihilation** — a **win condition** (NOT a thread type). Fires when one side kills **all** of the other's models.
- **Yield** — the losing side **proposes** it to the opponent, offering currency and/or items. If the opponent **accepts**: opponent is declared winner and gains Influence + Dominance **plus the offered tribute** — but does **not hold the ground**, so the yielding side **keeps its dead** (recoverable) and is **not looted**. If **denied**, the battle continues (→ the yielder may then Escape).
- **Escape** (was "Rout") — exits the thread; every escaping figure takes **one wound**. If the opponent can **catch up**, a **new battlefield** spawns and the pursuers get the **first strike** (anti-loop — you can't safely repeat Escape). If not caught → clean getaway.
- **Mutual — CUT.** Not possible / not wanted.

**"Keep the ground"** (what winning by Annihilation earns): the winner does **not** exit the thread immediately — they may keep posting to **loot the dead enemies** and **revive their own fallen** (if they carry revival items). A post-victory phase on the battlefield.

### D4 — Looting (the keep-the-ground phase) ✅
- A killed model can be looted for its **entire loadout** — every equipped item (weapons, armour, items, abilities, casts).
- **CP, AP, and currency are never lootable.** Stated explicitly for **commanders / named characters**: even those kills surrender only their loadout, never their command resources. (A dead enemy commander's legendary weapon *can* be taken; their points/coin cannot.)
- Applies to generated NPC foes too — looting one yields its generated weapon.
- **Destination:** looted gear goes **straight into the looter's inventory** (`S.inv`) to equip or sell later.
- **UI:** two ways per corpse — **select a specific piece**, or **toggle "take entire loadout"** to grab it all at once.

### D5 — Reviving / healing in the keep-the-ground phase ✅ *(exact tier numbers TBD)*
- **The post-victory phase is not a special mode — the action economy simply continues.** After a decisive win the thread stays open and the winner's models keep their **AP**; they may spend it on the same **items / casts / abilities** (heal, revive) they'd use mid-battle, plus loot, until the player chooses to exit.
- Revive already exists (the `Revive` item tag + Simulacrum Imperialis, Resurrection Orb, Reanimation Protocols/Surge, Phylactery of Aeons, etc.). No new mechanic — the phase just lets you keep using them.
- **Revive is TIERED — higher tier returns more wounds** (not a flat 1). Proposed mapping, following the existing I/II/III = magnitude convention (Regen/DoT): **Revive N → return at N wounds**. *(exact numbers pending Daak.)*
- **Canon fix required:** Simulacrum Imperialis and Resurrection Orb are labelled *"Revive III"* but read *"at 1 wound"* — inconsistent. Reconcile so tier actually scales the wounds returned. (Touches the gear catalogs + the `Revive` tag definition; overlaps T-CMB-1 tag-mechanics.)
- **Permadeath is absolute:** a model killed by damage from a **Permadeath-tagged** source can **never** be revived — not in this phase, not at the Apothecarion. No Revive item/cast/ability overrides it.

### D6 — Skirmish & its subtypes ✅ *(Daak dump 2026-07-22)*
- **Skirmish** = a "normal" battle — two or more Forces clash. The **most common** combat thread. The base Battle.
- **Raid** = a Skirmish orchestrated **against a Named Location**. When you start a thread at a named location, "attack the Named Location" is an option that lets the Force assault it. (Raid is the loot-a-location flavour of a Skirmish.)
- **Duel** = 1 model vs 1 model, mostly staged in an **Arena**. You can **hail** an NPC or PC into the fight, with **set prizes/wager**.
  - *Canon status:* the **Arena location exists** (`kind:"arena"`, "hosts Duel threads", per-faction skins e.g. Drukhari "The Arena of Pain") + flavour gear ("Arena Purse", "Arena Beloved", "Palatine Duelist").
  - **Wager (resolved):** a Duel is a **matched-pot wager**. You either **host** one — put up prize money — or **accept** an open one (Arena NPCs post duels with a set prize). The challenger **matches the host's contribution**; the **winner takes the full pot** (both stakes). Needs building: the host/accept flow + matched-stake escrow + payout to the victor.

### D7 — Invasion & Crusade ✅ *(Daak dump 2026-07-22 — several pieces still OPEN)*
**Invasion** — take a whole planet.
- **Launched from a Major Hub.** Pick a target planet → the Invasion opens.
- It becomes a set of **open, Raid-like threads** on the planet's named locations, which PCs & NPCs of the **same sub-faction** may join (special case: **Chaos Space Marine sub-factions**, and **the greater Imperium**, may pool at *faction* level, not just sub-faction).
- **Each named location may be attacked only ONCE per invasion** (one-shot raids).
- **Each named location has a garrison Force with a PC value = its weight in the "majority of PC" tally.** The **base garrison is calculated from the location itself** — its status, doors, type, population, etc. (a richer/more-populous/fortified location fields a bigger garrison). A defender can **reinforce** a location by **sending Forces to it**; those reinforcements join the battle when that location's raid-skirmish triggers. Winning the raid flips the location (and its garrison PC) to the invader. *(Extends the existing `seedCombat` muster — today it pulls a generic NPC detachment; this makes the garrison a real function of the location.)*
- **Defending = winning the raids.** The defenders repel the invasion by winning the raid-skirmishes at their locations; because each location is one-shot, a successfully-defended location is **locked for the rest of that invasion** (the attacker can't retry it). If the defenders hold the decisive locations — enough to deny PC-majority, or the Major Hub itself — the **invasion fails and the attacker is repelled.**
- **Win condition:** the invading force holds the **majority of PC on the planet** — i.e. the **largest total model Point Cost present** (the biggest army) — **AND** has **raided the Named Location that holds the planet's Major Hub** → planet control flips to the invader. *(PC = Point Cost, an existing core stat: every model has `pc`; a Force sums it. NOT a new "CP" system — the earlier CP note was a mishear.)*
- **Post-win choice** (made only by the commander who *began* the invasion, on entering the freshly-claimed Major Hub) — the planet is **kept** either way:
  - **Annihilate = start over as your own faction.** Population → 0; named locations take a status *(likely `Ruined`)*; a **rebuild ticker** starts — all doors drop to **tier 0**, rebuilt by investing resources; Major Hub re-settles at **your faction's lowest population rank**; skins become yours. Slow and costly, but the world becomes **culturally yours** — full production, and **your faction-unique interactions work here** (see below).
  - **Govern = hold it for what the old faction makes.** The planet stays intact — you **inherit the existing door tiers** (no rebuild) — and, crucially, keep access to that **faction's unique outputs** (an item / model / warp cast only they can produce). The price: **reduced production** on a world that isn't your faction's, and **your own faction-unique bonuses do NOT work here**. You govern a foreign world specifically to harvest what only it can make.

  **→ This depends on a NEW system (own topic): FACTION-UNIQUE WORLD INTERACTIONS.** Every sub-faction should have one or more unique ways to interact with *their own* worlds — a special door, a special production method, a unique resource, etc. Owning a planet **not** of your sub-faction does **not** let you use that bonus there. This is the tooth that makes Govern-vs-Annihilate a real choice (hold foreign worlds for *their* unique output; annihilate to make a world fully yours). **Ticketed separately — needs its own design pass across all 20 sub-factions.**
- **Who can join (resolved):** PC/NPC of the **same sub-faction** join by going to the **Major Hub the invasion launched from** and joining. **Chaos & Imperial** factions may join **faction-wide** (across their sub-factions). **Any non-enemy force** that can enter the Major Hub may **request** to join; the **launching commander approves**. Same rules for a Crusade.
- **Payout ✅:** the **completion bonus** (Influence + Currency + Dominance) goes to every force that **took part in ≥ half the raid threads** — this threshold applies to **both Invasion and Crusade** (a crusade measures against its full set of raids). Forces that **fought** additionally keep their **battle rewards** (per-raid loot/currency).

**Exterminatus** — the literal **destruction** of a planet: it is **removed from the map**, along with everything on it. A distinct, high-bar invasion mode (NOT the same as Annihilate — Annihilate scorches-but-keeps; Exterminatus deletes).
- **Declared at a sector throne world's Major Hub**, and only if the declaring commander has enough **Domination**.
- Spawns an invasion of the target planet with the **special rule: ALL named locations must be captured** (not just PC-majority + Major Hub).
- Then, at that planet's Major Hub, the invading force **declares Exterminatus** (the method/rite is **different per sub-faction**) → the planet is entirely destroyed and leaves the map.
- **Edge cases (resolved):** **any** world can be Exterminatus'd. When one is destroyed, the **sector-wide math re-computes** without it (planet counts for Crusade majority, travel routes, etc.). If a **throne world** is destroyed, another planet's **Major Hub can be levelled up into a new Throne World** (a promotion action from that hub) so the sector keeps a seat. *(New mechanic: promote Major Hub → Throne World.)*

**Crusade** — the sector-scale version; a major **sub-faction / faction event**.
- Claim an **entire sector** through multiple Invasions against its planets.
- **Win condition:** a **majority of the sector's planets** AND the **main hub of the sector's throne world** come under the invading faction's control.
- The Annihilate/Govern choice is made per-planet on each planet's Major Hub as its invasion completes.
- **Payout much higher** than a single invasion, on completion.
- Both factions' PCs & NPCs are present in a sector under crusade; **each faction has its own skin** for the crusade state.

**RESOLVED since first pass:**
- ~~CP undefined~~ → it's **PC (Point Cost)**, an existing stat. Win = biggest total model PC present + Major Hub raided. No new system.
- **Invasion subtype structure** clarified: PvE/PvP/Domination = **emergent from who joins**; **Annihilate/Govern = post-win choice** (planet kept); **Exterminatus = a separate high-bar invasion mode** (destroys the planet); **Crusade = the sector wrapper**. So Invasion is one flow + one variant (Exterminatus) + one wrapper (Crusade).

**RESOLVED (cont.):**
- **Major Hub = the `throne_room` door.** No new door. A sector's throne-world hub = `throne_room` on a `crown` world (already gets sector-scale powers).
- **Defender's side = win the one-shot raids.** Invasion fails when defenders hold enough locations (or the Major Hub) to deny the win. No separate defender system.

**RESOLVED (cont.):** Govern-vs-Annihilate trade-off (via faction-unique outputs + foreign-world production penalty) · Exterminatus edge cases (any world; sector re-computes; throne-world→promote another Major Hub) · join-eligibility (sub-faction at launch hub; Chaos/Imperial faction-wide; non-enemy request→commander approves) · Duel matched-pot wager.

**STILL OPEN:**
1. **NEW SYSTEM — faction-unique world interactions** (special door / production / resource per sub-faction; only on your own worlds). The tooth behind Govern-vs-Annihilate. **Own design pass across all 20 sub-factions → ticketed (T-FAC-1).**
2. **Payout reconciliation** — does the **completion bonus** go to *all joined forces* (latest word) or only those in *≥ half the raids* (earlier draft)?
3. **Foreign-world production penalty** — how much lower is output on a Governed non-faction world (a flat %? scales with population/loyalty?).
4. **Promote Major Hub → Throne World** — trigger/cost when a sector loses its throne world.
5. Garrison formula (which location props contribute how much) — tuning.
6. Rebuild ticker cost/time after Annihilate — tuning.
7. Annihilate named-location status = likely **`Ruined`** — confirm.

---

## D8 — Faction-unique production (forge affinities) + one signature door per sub-faction
*Scope per Daak: only the two hooks we already have — forge affinities + a signature door. No other global sub-faction mechanic for now.*

### 8.1 The production system that already exists (forge affinities)
- **The Forge door** (`kind:"forge"` — "craft and upgrade equipment, tiers I–III") is a **common door, skinned per faction** (Forge Temple / Soul-Forge / Bio-Vat / Mek Shop / Canoptek Forge / Bonesinger Hall / Haemonculus Atelier / Earth Caste Bay / Cult Workshop / Ancestral Forge).
- **What it does:** (a) **forge an affinity weapon-tag** onto a weapon (I–III), (b) **harden armour** (+1 Defense to an element, I–III). Both cost the faction currency.
- **Faction-unique part = `forge_affinities`:** each faction can only forge **its own tag set** (Death Guard DoT/Suppressing · World Eaters Momentum/Refund · Custodes Dual-profile/First-Strike · Harlequins First-Strike/Free-Move/Ambush · … Black Legion = ALL). Canon rule already written: **cross-faction forging needs access to that faction's forge (alliance / diplomacy / — now — governing their world).**
- **Location-gated tiers:** **Tier III** equipment is reachable **only at a Forge World** (Forge Temples) — "the ONLY route to Tier III equipment"; **Shrine Worlds** are the one non-forge Tier-III route (altars).
- **This IS the Govern payoff:** hold/govern a Death Guard world → its Soul-Forge lets you craft DoT/Suppressing; hold a Mechanicus **Forge World** → the only place you reach Tier III. **T-FAC-1 wiring = a governed world grants access to its faction's forge affinity (and its tier gate).** Your *own* affinities do **not** apply on a foreign-governed world.

### 8.2 Signature doors — DRAFT (one per sub-faction, each a use-case grounded in existing verbs)
Each is a door only that sub-faction's worlds carry; owning a foreign world does **not** grant *your* door there (it may grant *theirs*, if you Govern). Uses only existing systems: currency, models, gear, warp casts, revival, taint, biomass, travel.

| Sub-faction | Signature door | Use-case (draft) |
|---|---|---|
| Black Legion | **The Warmaster's Table** | War-council: launch invasions at reduced Domination cost; muster Chaos-Undivided elites. |
| Death Guard | **The Plague Garden** | Cultivate over ticks: brew DoT/Blight consumables; render battlefield dead into free Poxwalkers. |
| World Eaters | **The Skull Throne Altar** | Offer kills/corpses to Khorne → Dominance + rage boons; summon Berzerker (Assault) models. |
| Thousand Sons | **The Cyclopean Library** | Scribe & upgrade Warp Casts (their Draining/Bypass); bind daemons into Rubricae. |
| Emperor's Children | **The Rapturous Court** | Spend Influence for combat-drug buffs + sonic (Slowing/Multihit) gear. |
| Daemons | **The Warp Rift** | Summon daemon models for Corruption, **scaled to the planet's taint** (higher taint = stronger). |
| Adeptus Astartes | **The Reclusiam** | Recover gene-seed of fallen Marines (recruit/replace); swear pre-battle oath buffs. |
| Astra Militarum | **The Departmento Muster** | Convert currency into **large numbers of cheap low-PC Guard** — cheap garrison mass. |
| Adeptus Mechanicus | **The Forge Temple** | The **Tier-III** forge; build robot/servitor models; upgrade door tiers. |
| Adepta Sororitas | **The Shrine of the Saint** | Purge taint on-planet; craft Miracle warp-casts; Act-of-Faith revives. |
| Adeptus Custodes | **The Golden Vault** | No mass recruit — forge supreme artificer relics (Dual-profile/First-Strike); few, peerless models. |
| Tyranids | **The Digestion Pool** | Consume battlefield dead + population → **Biomass**; spawn/evolve organisms (pairs with Annihilate). |
| Orks | **The Mek Shop** | Craft cheap kustom Rapid/Momentum gear from battle-scrap; build Deffdreads; scales with fighting. |
| Necrons | **The Tomb Vault** | Reanimate dormant Necron models free over ticks; can reawaken even **permadeath'd Robotic** models. |
| Aeldari | **The Webway Portal** | **Free travel** between Aeldari-held portals (ties T-GX-WG); recover Souls from the dead. |
| Drukhari | **The Haemonculus Atelier** | Turn captured enemy models (slaves) into Souls + regeneration; Ambush/Suppressing gear (ties T-ECO-1). |
| T'au | **The Earth Caste Bay** | Mass-produce Guided drones/gear at a **discount**; efficient tier-climbing; auxiliaries. |
| Leagues of Votann | **The Ancestral Vault** | Bank Shares for **interest over ticks**; forge Grudge/Slayer gear vs a marked enemy faction. |
| Genestealer Cults | **The Cult Sanctum** | **Seed a hidden cult on a foreign world** (their unique: covert presence on enemy planets) → garrison bonus when it rises during an invasion. |
| Harlequins | **The Black Library Waystation** | No forge — buy **any faction's** Warp Casts (trade in Masques/secrets); free webway movement. |

**Open for discussion:** these are drafts to react to; the exact outputs/costs are unset. Also: some signature doors overlap the forge skin (Mek Shop, Forge Temple) — decide whether the signature door **is** the faction's forge or a **second** door alongside it.

### 8.3 Doors are distinct (Daak) ✅
Every faction's signature door is its **OWN door**, not a reskin of the common forge. So a faction world can carry both the (skinned) common Forge **and** its distinct signature door.

### D9 — "Remains of the dead" — a lootable body item ✅
When a model dies and is looted, alongside its loadout the corpse yields a **Remains item**: e.g. **"Remains of R4 Plague Marine — Morvax."**
- Appears in the **garrison / equipment** section like any item.
- **Clicking it opens that model's full overview** (threads fought, lore, stats, kills) — the Remains carry the dead model's record.
- Can be **traded, sold, or used at doors** — enables a **body trade** and "offering of the dead" (feeds the faction signature doors that consume corpses: World Eaters' Skull Throne, Tyranid Digestion Pool, Drukhari Atelier, Necron Tomb Vault, etc.).
- (Implementation: a new item category `REMAINS` carrying a snapshot ref to the dead model; renders as an item, opens the model overlay on click.)

### D10 — Civilian model per sub-faction + gender field ✅
- **Every sub-faction gets a "Civilian" model** — the lowest populace unit, what a planet's population is made of (ties to `population_ranks`). Non/barely-combatant (~1–3 PC). Spec'd in table 8.6 below.
- **Gender field on models (male/female), varying — especially for NPCs.** Fixed where lore dictates (Astartes-lineage & Custodes = male; Sororitas = female); **varied/randomised elsewhere**, and NPCs especially should draw a gender so the world reads as populated by real people. (Implementation: a `sex` field on a model; NPC/civilian generation rolls it.)

### 8.4 Forge tags per sub-faction (exact, from canon `forge_affinities`)
| Sub-faction | Forgeable tags |
|---|---|
| Black Legion | **ALL** |
| Death Guard | DoT · Suppressing |
| World Eaters | Momentum · Refund |
| Thousand Sons | Draining · Bypass |
| Emperor's Children | Multihit · Slowing |
| Daemons | Leech · Reclaim |
| Adeptus Astartes | Slayer · Rapid |
| Astra Militarum | Venting · Multihit |
| Adeptus Mechanicus | DoT · Bypass |
| Adepta Sororitas | Slayer · Multihit |
| Adeptus Custodes | Dual-profile · First Strike |
| Tyranids | DoT · Reclaim · Multihit |
| Orks | Rapid · Momentum |
| Necrons | Draining · Bypass · DoT |
| Aeldari | First Strike · Guided |
| Drukhari | DoT · Suppressing · Ambush |
| T'au | Guided · Slayer |
| Genestealer Cults | Ambush · Suppressing |
| Leagues of Votann | Grudge · Slayer |
| Harlequins | First Strike · Free Move · Ambush |

### 8.5 Signature doors (draft — see 8.2 for use-cases)
(unchanged from 8.2; each is a distinct door, not a forge reskin.)

### 8.6 Civilian model per sub-faction (DRAFT)
| Sub-faction | Civilian model | Note |
|---|---|---|
| Black Legion | Renegade Thrall | press-ganged mortal serving the warband |
| Death Guard | Plague Serf | rot-ridden peasant, half-poxwalker |
| World Eaters | Blood-Chained Slave | captive kept for the arenas & the offering |
| Thousand Sons | Cult Acolyte | Prosperine scholar-servant of the Cabal |
| Emperor's Children | Bondsman | pleasure-bonded servant of the court |
| Daemons | The Damned | mortal cultist-husk, barely a vessel |
| Adeptus Astartes | Chapter Serf | bonded human tending the fortress-monastery |
| Astra Militarum | Imperial Citizen | hab-block worker; the tithe made flesh |
| Adeptus Mechanicus | Menial Servitor | lobotomised drone-labourer |
| Adepta Sororitas | Frateris Lay-Sister | pilgrim/hospitaller of the shrine |
| Adeptus Custodes | Palace Aspirant | chosen youth serving the Golden Palace |
| Tyranids | Feeder Organism | mindless bio-form rendering matter to biomass |
| Orks | Grot | snivelling gretchin runt; expendable menial |
| Necrons | Crypt-Thrall | bound servant-shell tending the tomb |
| Aeldari | Craftworld Citizen | artisan of the domes, Guardian at need |
| Drukhari | Kabal Slave | broken captive — currency and cattle both |
| T'au | Gue'vesa Auxiliary | human worker sworn to the Greater Good |
| Leagues of Votann | Hearthkin | working member of the Kin; prospector/crafter |
| Genestealer Cults | Mining Neophyte | hidden cultist passing as an ordinary worker |
| Harlequins | Novice Player | young Troupe member yet to earn a mask |

### 8.7 REVISION (Daak review 2026-07-22) — supersedes 8.2/8.5/8.6 doors + adds tag effects
**Forge tags all go onto WEAPONS** (Forge only applies weapon tags + hardens armour). Effects (from canon `tags.weapon`): DoT (1 dmg/post X posts, stacks) · Suppressing (+X AP to target's next action) · Momentum (+1 dmg/consecutive post, cap +X) · Refund (kill→refund X AP) · Draining (target loses X AP) · Bypass (ignores a named tag's defence) · Multihit (hits up to X models) · Slowing (−X Speed next post) · Leech (heal X per hit) · Reclaim (kill→heal X) · Slayer (+X vs named tag) · Rapid (extra attacks) · Venting (X-post cooldown, downside) · Dual-profile (two statlines) · First Strike (resolves before response) · Guided (ignores Stealth) · Ambush (+X from Stealth) · Grudge (+X vs Forces that hurt yours) · Free Move (kill→free move).

**Black Legion affinity ≠ ALL (canon change):** proposed **Slayer · Bypass · Rapid · Grudge** (generalist breadth, no one else's exact set). ALT considered: "one tag from each Chaos faction." → Daak to confirm.

**Signature doors — LOCKED 7 (Daak-defined) + 13 reworked:**
| Sub-faction | Door | Use-case |
|---|---|---|
| Death Guard ✅ | Plague Garden | brew a consumable that turns battle-dead **allied** models into Poxwalkers |
| World Eaters ✅ | Skull Throne | offer dead models → currency, **scaled by the model's rank** |
| Daemons ✅ | Warp Rift | **sacrifice living models → raise Taint** |
| Astartes ✅ | Reclusiam | Astartes **Remains + a living Astartes → living one inherits its rank** |
| Tyranids ✅ | Digestion Pool | trade **dead non-Tyranid** models → currency |
| Aeldari ✅ | Webway Portal | travel to **any** other webway door, discovered or not |
| Drukhari ✅ | Haemonculus Atelier | trade **living non-Drukhari** models → Influence |
| Black Legion | Trophy Hall | Remains of a slain enemy **Named/Commander** → big Influence + Dominance |
| Thousand Sons | Sorcerers' Cabal | Remains → craft/upgrade a Warp Cast (soul fuels it) |
| Emperor's Children | The Sensorium | sacrifice a living captive → permanent stat buff on one of your models |
| Astra Militarum | Conscription Office | pay currency → instantly raise a batch of cheap low-PC Guard |
| Mechanicus | Cortex Vault | Remains of any model → convert into a Servitor you own |
| Sororitas | Reliquary of Martyrs | Remains of a fallen Imperial model → a relic item / faith buff |
| Custodes | The Blood Games | a Custodes model climbs rank by beating escalating NPC champions |
| Orks | Da Scrap Pit | feed dead models/wreckage (incl. your own) → Teeth + a random kustom weapon |
| Necrons | Reanimation Chamber | Remains of a Necron model → rebuild it fully, even if permadeath'd |
| T'au | Ethereal Council | pay Influence → recruit auxiliary models of other species |
| Votann | Grudge Ledger | mark an enemy faction → Grudge gear hits harder + currency bounty per marked kill |
| GSC | Sanctum Cell | plant a hidden cult on any world (even foreign) → rises as a free garrison when invaded |
| Harlequins | The Masque | don a neutral disguise (enter enemy hubs / buy any faction's casts) + free webway move |

**Civilian models — full stats `{cls,pc,w,sp,sl}`:**
| Civilian | Faction | cls | pc | w | sp | sl |
|---|---|---|--:|--:|--:|--:|
| Renegade Thrall | black_legion | Core | 2 | 1 | 5 | 1 |
| Plague Serf | death_guard | Core | 2 | 2 | 3 | 1 |
| Blood-Chained Slave | world_eaters | Core | 1 | 1 | 5 | 1 |
| Cult Acolyte | thousand_sons | Core | 2 | 1 | 5 | 1 |
| Bondsman | emperors_children | Core | 2 | 1 | 5 | 1 |
| The Damned | daemons | Core | 1 | 1 | 4 | 1 |
| Chapter Serf | astartes | Core | 2 | 1 | 5 | 1 |
| Imperial Citizen | militarum | Core | 1 | 1 | 5 | 1 |
| Menial Servitor | mechanicus | Core | 2 | 1 | 3 | 1 |
| Frateris Lay-Sister | sororitas | Core | 2 | 1 | 5 | 1 |
| Palace Aspirant | custodes | Core | 3 | 2 | 6 | 1 |
| Feeder Organism | tyranids | Core | 1 | 1 | 4 | 1 |
| Grot | orks | Core | 1 | 1 | 6 | 1 |
| Crypt-Thrall | necrons | Core | 2 | 1 | 3 | 1 |
| Craftworld Citizen | aeldari | Core | 2 | 1 | 7 | 1 |
| Kabal Slave | drukhari | Core | 1 | 1 | 6 | 1 |
| Gue'vesa Auxiliary | tau | Core | 2 | 1 | 5 | 1 |
| Hearthkin | votann | Core | 2 | 2 | 4 | 1 |
| Mining Neophyte | gsc | Core | 2 | 1 | 5 | 1 |
| Novice Player | harlequins | Core | 3 | 1 | 8 | 1 |

**Note — heavy use of the `REMAINS` item (D9):** many locked/reworked doors consume dead models (World Eaters, Tyranids, Black Legion, Thousand Sons, Mechanicus, Sororitas, Orks, Necrons) or living models (Daemons, Drukhari, Emperor's Children) — so the Remains item + a "sacrifice a living model" action are shared primitives these doors all build on.

### 8.8 REVISION 2 (Daak review 2026-07-22) — full tags, door updates, civilian fix
**Faction-exclusive forge tags (7):** Venting=Militarum · Slowing=Emperor's Children · Leech=Daemons · Refund=World Eaters · Grudge=Votann · Dual-profile=Custodes · Free Move=Harlequins. Not-forgeable (inherent): Unwieldy, Reach, Overcharge. All other weapon tags shared 2–5 factions.
**Faction-exclusive cast schools (7, via cast_gate):** Faithful=Sororitas · Bloodbound=World Eaters · Technomancer=Necrons · Networked=T'au · Fleshcrafted=Drukhari · Ancestral=Votann · Pariah=Custodes.
Item tags (11, not forge-gated): Shield, Ward, Regen, Cleanse, Revive, Decoy, Blink, Immunity, Marked, Stimm, Rally.

**Signature doors — updated:**
| Faction | Door | Use-case | status |
|---|---|---|---|
| Death Guard | Plague Garden | dead allied → Poxwalkers (consumable) | ✅ |
| World Eaters | Skull Throne | dead **non-WE** → **Dominance × rank** | ✅ upd |
| Daemons | Warp Rift | sacrifice living **non-Daemon** → raise Taint | ✅ upd |
| Astartes | Reclusiam | Astartes Remains + living Astartes → inherit rank | ✅ |
| Tyranids | Digestion Pool | dead non-Tyranid → currency | ✅ |
| Aeldari | Webway Portal | travel to any webway door | ✅ |
| Drukhari | Haemonculus Atelier | living non-Drukhari → Influence | ✅ |
| Thousand Sons | Sorcerers' Cabal | feed PC of ONE sub-faction to a meter → craft a Warp Cast from that sub-faction | ✅ upd |
| Astra Militarum | Departmento | −1 population at location + pick a **Core** model → **10× it at rank 1** | ✅ upd |
| Necrons | Tomb Vault | **Tomb World only** — conscript **5 free Core models / in-game day** | ✅ upd |
| Votann | Grudge Ledger | mark enemy faction → Grudge bonus + bounty | ✅ loved |
| Harlequins | The Masque | forge weak **disguise-armour**; move **as** a faction only if the **whole Force** wears it | ✅ upd |
| Black Legion | Warmaster's Muster | recruit from **any Chaos sub-faction** roster (Corruption) | redo |
| Emperor's Children | Chem-Gardens | living captives → **Stimm/combat-drug consumables** | redo |
| Mechanicus | Fabricator's Sanctum | **raise the tier of any door** on this world | redo |
| Sororitas | Convent Sanctorum | the only door that **lowers world Taint** (faith over ticks) | redo |
| Custodes | Aquilan Bastion | **hardens all garrisons** on this world (+PC) | redo |
| Orks | Da Waaagh Banner | Teeth → mob **scaling with the sector's Conflict** | redo |
| T'au | Greater Good Assembly | on a Governed world, recruit **native civilians as Gue'vesa** | redo |
| GSC | Cult Cell | plant a sleeper cell → **reduces garrison PC** when you invade that world | redo |

**Civilian models — FIXED:** all `cls:Core, pc:1, w:1, sl:1`. Speed low: **Sp 2** default; **Sp 3** only the fleet few (Grot, Kabal Slave, Craftworld Citizen, Novice Player). *(Daak may flatten to all Sp 2.)*

### 8.9 REVISION 3 (Daak 2026-07-22) — door redos resolved, EC drug list, civilians flat
**LOCKED doors:**
- **Black Legion — Warmaster's Muster:** recruit models from any Chaos sub-faction's roster, **Astartes models only**, paid in Corruption.
- **Emperor's Children — Chem-Gardens:** craft **combat-drug consumables**, each +1 to one stat / −1 to another (full loop):
  | Drug | + | − |
  |---|---|---|
  | Frenzon | +1 Damage | −1 Defense |
  | Hypex | +1 Speed | −1 Wound (max) |
  | Spur | +1 AP | −1 Speed |
  | Grave-Lotus | +1 Defense | −1 Damage |
  | Adrenalight | +1 Wound | −1 AP |
- **Sororitas — Convent Sanctorum:** craft a **consumable that lowers Taint** on a planet you own.
- **T'au — Greater Good Assembly:** convert any **non-T'au model into a T'au model of the same Type** (Core→Core, Flying→Flying…); the converted model **keeps its loadout**.
- **GSC — Cult Cell:** craft an item that converts any **door-less named location into a specific GSC door**. When GSC later invades that planet, **raiding that location = a free victory**, plus **free models up to the PC the location's garrison would have had**.
- **Votann — Grudge Ledger** (loved, unchanged).

**PROPOSED (awaiting Daak):**
- **Custodes — The Null Sanctum:** a Custodes-held world **cannot gain Taint** (hard 0) and enemy **Warp Casts are dampened** in threads there. (Sororitas lower taint; Custodes prevent it.)
- **Orks — Da Kustom Mek:** a **gamble forge** — slap a **random** weapon tag on for cheap; may roll a boon or a downside (e.g. Venting). Everyone else forges chosen affinity; Orks roll.

**Civilians:** flat **Sp 2** for ALL (no fleet exceptions). Final: every civilian = `cls:Core, pc:1, w:1, sp:2, sl:1`.

### 8.10 REVISION 4 (Daak 2026-07-22) — final door locks (Sor/Custodes swapped, Orks locked)
- **Adepta Sororitas — anti-psyker ability:** the door crafts an **equippable ability** that, while equipped, **multiplies the AP cost of any Warp Cast the bearer faces/uses by ×3** (warp-suppression, portable). *(Swapped: taint-lowering moved to Custodes.)*
- **Adeptus Custodes:** the door lets you **spend currency to lower the world's Taint**. *(Swapped from the Null Sanctum idea.)*
- **Orks — Da Kustom Mek:** roll a **random tag onto any weapon OR armour** (cheap gamble; may roll a boon or a downside).
- **Emperor's Children — Chem-Gardens drug list:** LOCKED as in 8.9 (Frenzon/Hypex/Spur/Grave-Lotus/Adrenalight).
- **Adeptus Mechanicus — Fabricator's Sanctum** (raise the tier of any door on this world): standing from 8.7/8.8 — never objected → treat as locked unless Daak revisits.

**→ All 20 sub-faction signature doors now have a defined mechanic (T-FAC-1 design complete at the concept level; exact costs/values are tuning).**
