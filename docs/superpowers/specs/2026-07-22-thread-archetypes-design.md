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
- **Payout:** **all joined forces** receive the **completion bonus** (Influence + Currency + Dominance) the moment the Major Hub choice is made; forces that **fought in actual battles** additionally keep their **battle rewards** (per-raid loot/currency). *(Reconcile: earlier draft gated the completion bonus on "≥ half the raid threads" — the latest word is all joined forces get it. Confirm which.)*

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
