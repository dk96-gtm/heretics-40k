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

### D5 — Reviving / healing in the keep-the-ground phase ✅ *(tier numbers + permadeath TBD)*
- **The post-victory phase is not a special mode — the action economy simply continues.** After a decisive win the thread stays open and the winner's models keep their **AP**; they may spend it on the same **items / casts / abilities** (heal, revive) they'd use mid-battle, plus loot, until the player chooses to exit.
- Revive already exists (the `Revive` item tag + Simulacrum Imperialis, Resurrection Orb, Reanimation Protocols/Surge, Phylactery of Aeons, etc.). No new mechanic — the phase just lets you keep using them.
- **Revive is TIERED — higher tier returns more wounds** (not a flat 1). Proposed mapping, following the existing I/II/III = magnitude convention (Regen/DoT): **Revive N → return at N wounds**. *(exact numbers pending Daak.)*
- **Canon fix required:** Simulacrum Imperialis and Resurrection Orb are labelled *"Revive III"* but read *"at 1 wound"* — inconsistent. Reconcile so tier actually scales the wounds returned. (Touches the gear catalogs + the `Revive` tag definition; overlaps T-CMB-1 tag-mechanics.)
- *Open:* does a **permadeath / no-revival kill** stay unrevivable even in this phase? (assumed yes — confirm.)
