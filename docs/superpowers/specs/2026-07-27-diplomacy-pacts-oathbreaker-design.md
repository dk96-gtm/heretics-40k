# Diplomacy — Pacts, Term Primitives & the Oathbreaker System (design)

> **Status:** design LOCKED with Daak, 2026-07-27. Gives diplomacy teeth: today a Diplomacy
> thread stages terms as text and nothing enforces them. This spec defines the **pact**
> object, a small **machine-readable term vocabulary** the engine executes, **escrow**
> (closing T-ENG-2's unsafe trade), and the generalized **Oathbreaker** treachery system.
> **Design law:** betrayal is always POSSIBLE (this is 40K) — the engine never hard-blocks a
> breach; it prices one. Hard where stakes are hard, social where they're soft.

## Locked decisions

| Axis | Decision |
|------|----------|
| Enforcement model | **Two layers:** structured term primitives the engine executes + tracks, AND freeform prose terms that live on honor and NPC memory. |
| Breach handling | **Allow and brand** — a breaching action resolves normally; the breaker forfeits escrow and takes the Oathbreaker mark. No validate-blocking of betrayal. |
| Oathbreaker scope | **Generalized** (Daak): one treachery status earned by ANY betrayal of a bonded agreement — pact breach, ransom double-cross, passage ambush, contract advance-theft, surrender-terms violation. Not a ceasefire-only feature. |
| Where pacts form | Diplomacy threads (formal, multi-term) and quick Comms deals (single-term). Same pact object underneath. |
| Visibility | Active pacts show in the **Strategium** with their clocks, beside Ultimatums. |

## 1 · The pact object

`S.world.pacts[]`: `{id, parties, terms[], prose, stakes, formed, expires, status}`.
Formed when all parties accept in a Diplomacy thread (extends the existing `terms` staging)
or a Comms deal. The tick executes recurring terms and expiries. Pact history persists —
a completed pact is part of both parties' record.

## 2 · Term vocabulary (v1 — additive registry, grows like CONDS)

| Term | Shape | Engine behaviour |
|---|---|---|
| Tribute | `{amount, kind: currency\|food\|material\|fuel, cadence: once\|per_day, days}` | Transfers on seal; recurring rides the WORLD tick. |
| Ceasefire | `{days}` | Real clock; combat threads between parties tracked against it; initiating one = breach. |
| Passage | `{territory, days}` | Travel through grantor space without garrison/arrival hostility. Binds BOTH ways — ambushing a passing force is the grantor's breach. |
| Cede | `{holding}` | Ownership flips on seal via the existing conquest machinery. |
| Release | `{item}` (CAPTIVE/REMAINS) | Spoils item transfers; ransom deals are pacts automatically. |
| Bonded Trade | `{give[], receive[]}` | Simultaneous escrowed swap — **closes T-ENG-2**. |

Prose terms: free text on the pact, unenforced, but visible in dossiers — NPCs remember what
was promised even when the engine can't execute it.

## 3 · Escrow — the oath-bond

Optional stake on any pact: currency, resources, or items deposited by each side at seal.
Clean completion returns stakes. **Breach forfeits the breaker's stake to the victim,
instantly.** Stakes demanded scale with the proposer's trust in you (see §4 — an
Oathbreaker bonds triple).

## 4 · The Oathbreaker system

Earned by any betrayal of a bonded agreement. Per-victim-faction, stacking marks:

- **Escrow forfeits** to the victim immediately.
- **Dossier grudge** — durable `longTermMemory`/dossier entries for that faction's NPCs.
- **Standing crater** and **door price spike** with the victim faction (+25% per mark,
  compounding on the Rift/ruler pricing seam).
- **Future pacts cost more:** NPCs of that faction demand multiplied stakes ("your word is
  void — bond triple") or refuse outright at high mark counts.
- **Allies hear:** factions allied/aligned with the victim take a smaller standing dent
  (feed event, Notable).
- **The victim gets an ⚠ Urgent Strategium event.** Betrayal is news.

**Redemption is faction-shaped.** Marks decay very slowly on their own. Active penance is
faster: a blood-price Tribute pact to the victim, a completed mission for them, or an
absolution rite at a tier-3 Altar (door-services layer). BUT honor-cultures forgive
differently or never — redemption willingness and price derive from the faction's
personality axes (honor/pragmatism); the Votann keep a literal Grudge ledger and some marks
never close. Forgiveness is data, not a constant.

**It points both ways.** NPCs propose, accept, and BREAK pacts through the same personality
matrix (cunning/ferocity drive betrayal odds; honor restrains it). An NPC breaking a pact
takes the Oathbreaker mark toward the player, visible on its sheet/dossier — and the
Relay's paid intel becomes spycraft: learn who keeps their word before you treat.

## 5 · Integration map

- **THREAD** — Diplomacy `terms` staging extends into typed term entries; `apply` seals
  pacts; combat-thread creation checks active ceasefires/passages to TAG breaches (never to
  block them) → Oathbreaker pipeline.
- **WORLD tick** — recurring tribute, pact expiry, mark decay.
- **Economy (T-ECN-*)** — typed resources in Tribute/stakes; ransom/bribe flows from the
  economy spec §6f become pact instances (one machinery, not two).
- **Spoils** — Release terms move CAPTIVE/REMAINS items.
- **Strategium** — active-pacts panel with clocks; breach events Urgent to the victim.
- **NPC mind** — grudges ride the existing dossier/longTermMemory; behavior axes drive
  propose/accept/break and redemption pricing.
- **T-ENG-2** — closed by Bonded Trade (D1).

## 6 · Implementation slices (each its own plan)

- **D1 — pact core:** pact object + term registry + escrow + Bonded Trade + tick hooks +
  Diplomacy-thread term staging UI + Strategium panel (or interim list pre-N3). Closes
  T-ENG-2. Lane: 🔥 engine + canon + tests.
- **D2 — Oathbreaker:** breach tagging on combat creation, mark storage, standing/door/
  stake effects, ally propagation, decay + penance paths (Altar rite rides door services).
  Lane: 🔥 engine + canon + tests.
- **D3 — NPC pact behaviour:** propose/accept/counter/break via the matrix; NPC-side marks;
  Relay intel surfaces trustworthiness. Lane: 🔥 engine + tests.

Dependencies: D1 free-standing (Strategium panel degrades gracefully pre-N3). D2 needs D1.
D3 needs D1+D2 and prefers the NPC-agency slices (N1/N2) for NPCs that initiate.

## 7 · Deferred

- Alliance/joint-war terms (multi-party pacts) — v2 vocabulary.
- Player↔player pacts — Stage 2 (same objects, shared world).
- AI-judged prose-term compliance — Stage 3 flavor, never authoritative.
