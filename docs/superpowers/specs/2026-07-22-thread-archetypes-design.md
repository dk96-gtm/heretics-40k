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

### D3 — How a Battle ends (the losing slope) ✅ *(one linked Q still open)*
A battle ends by one of three outcomes. They form a single escalation ladder — you can Yield → be denied → Escape → be caught → be Annihilated:

- **Annihilation** — a *victory condition*, not a thread type. Fires when one side kills **all** of the other's models. The victor **keeps the ground** and may **loot freely** (the fallen are on the field they hold). Full world-effect + rewards.
- **Yield** — the losing side **proposes** it to the opponent, offering currency and/or items. If the opponent **accepts**: opponent is declared winner and gains Influence + Dominance **plus the offered tribute** — but does **not take the field**, so the yielding side **keeps its dead** (recoverable) and is **not looted**. If **denied**, the battle continues (→ the yielder may then Escape).
- **Escape** (was "Rout") — exits the thread; every escaping figure takes **one wound**. If the opponent can **catch up**, a **new battlefield** spawns and the pursuers get the **first strike** (anti-loop — you can't safely repeat Escape). If not caught → clean getaway, field abandoned.
- **Mutual — CUT.** Not possible / not wanted.

**Open follow-up (Invasion/territory):** "keeps the ground" implies a planet flips only when the field is actually held — i.e. on **Annihilation** and on an **uncaught Escape by the defender** (they abandoned the field), but **NOT on a Yield** (field never taken → the defender buys their world back with tribute). *Pending Daak confirm.*
