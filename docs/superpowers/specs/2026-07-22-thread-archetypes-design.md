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
  - *Canon status:* the **Arena location exists** (`kind:"arena"`, "hosts Duel threads", per-faction skins e.g. Drukhari "The Arena of Pain") + flavour gear ("Arena Purse", "Arena Beloved", "Palatine Duelist"). **But the hail-with-prizes mechanic is NOT written down** — the arena door just opens a plain Skirmish today. → needs defining (challenge flow, wager/prize escrow, accept/decline).

### D7 — Invasion & Crusade ✅ *(Daak dump 2026-07-22 — several pieces still OPEN)*
**Invasion** — take a whole planet.
- **Launched from a Major Hub.** Pick a target planet → the Invasion opens.
- It becomes a set of **open, Raid-like threads** on the planet's named locations, which PCs & NPCs of the **same sub-faction** may join (special case: **Chaos Space Marine sub-factions**, and **the greater Imperium**, may pool at *faction* level, not just sub-faction).
- **Win condition:** the invading force holds the **majority of PC on the planet** — i.e. the **largest total model Point Cost present** (the biggest army) — **AND** has **raided the Named Location that holds the planet's Major Hub** → planet control flips to the invader. *(PC = Point Cost, an existing core stat: every model has `pc`; a Force sums it. NOT a new "CP" system — the earlier CP note was a mishear.)*
- **Post-win choice** (made only by the commander who *began* the invasion, on entering the freshly-claimed Major Hub) — the planet is **kept** either way:
  - **Annihilate** — the population is slaughtered: all populations → 0; named locations take a status *(likely `Ruined` — confirm)*; a **rebuild ticker** starts — all doors drop to **tier 0** and must be rebuilt by investing resources; the Major Hub is re-settled at the **new ruling faction's lowest population rank**; skins change to the new faction; the planet must then be governed. (Scorched but yours.)
  - **Govern** — the planet stays as it was (same faction doors, resource tick, population) and becomes the new faction's holding, **keeping the old faction's skin**; the new ruler must manage it. (Intact but foreign.)
- **Payout:** each battlefield pays out like a Raid; **plus** every Force of the winning faction on-planet that took part in **≥ half the raid threads** receives a **bonus of Influence + Currency + Dominance**, paid the moment the Major Hub choice is made.

**Exterminatus** — the literal **destruction** of a planet: it is **removed from the map**, along with everything on it. A distinct, high-bar invasion mode (NOT the same as Annihilate — Annihilate scorches-but-keeps; Exterminatus deletes).
- **Declared at a sector throne world's Major Hub**, and only if the declaring commander has enough **Domination**.
- Spawns an invasion of the target planet with the **special rule: ALL named locations must be captured** (not just PC-majority + Major Hub).
- Then, at that planet's Major Hub, the invading force **declares Exterminatus** (the method/rite is **different per sub-faction**) → the planet is entirely destroyed and leaves the map.

**Crusade** — the sector-scale version; a major **sub-faction / faction event**.
- Claim an **entire sector** through multiple Invasions against its planets.
- **Win condition:** a **majority of the sector's planets** AND the **main hub of the sector's throne world** come under the invading faction's control.
- The Annihilate/Govern choice is made per-planet on each planet's Major Hub as its invasion completes.
- **Payout much higher** than a single invasion, on completion.
- Both factions' PCs & NPCs are present in a sector under crusade; **each faction has its own skin** for the crusade state.

**RESOLVED since first pass:**
- ~~CP undefined~~ → it's **PC (Point Cost)**, an existing stat. Win = biggest total model PC present + Major Hub raided. No new system.
- **Invasion subtype structure** clarified: PvE/PvP/Domination = **emergent from who joins**; **Annihilate/Govern = post-win choice** (planet kept); **Exterminatus = a separate high-bar invasion mode** (destroys the planet); **Crusade = the sector wrapper**. So Invasion is one flow + one variant (Exterminatus) + one wrapper (Crusade).

**OPEN / UNDEFINED (for the follow-up discussion):**
1. **Major Hub door** — canon has `throne_room` (12 doors, no `major_hub`). Is the **Major Hub just the `throne_room` door** (same thing; sector throne worlds = `throne_room` on a `crown` world), or a new distinct door? *(leaning: reuse `throne_room`.)*
2. **Govern trade-off needs a tooth** — Govern keeps a working planet with a foreign skin; without a downside (conquered-population loyalty/unrest?) it strictly beats Annihilate. Cosmetic skin only, or a real unrest mechanic?
3. **Defender's side / failure** — how does an invasion **fail or expire**? Time limit? Can the defender counter-raid to reclaim PC-majority or re-take a raided location?
4. **Exterminatus edge cases** — what a removed-from-map planet does to (a) the sector's planet count for a Crusade majority, (b) neighbours/travel routes; can a **crown/throne world** itself be Exterminatus'd?
5. Join-eligibility (sub-faction vs faction, incl. the Chaos-SM / greater-Imperium pooling) → a clean co-belligerence table.
6. Rebuild ticker specifics (cost/time to bring tier-0 doors back after Annihilate).
7. Duel hail-with-prizes flow (arena location exists; the wager/challenge mechanic doesn't).
8. Named-location status on Annihilate = likely **`Ruined`** — confirm.
