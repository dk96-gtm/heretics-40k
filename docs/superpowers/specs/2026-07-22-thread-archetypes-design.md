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
