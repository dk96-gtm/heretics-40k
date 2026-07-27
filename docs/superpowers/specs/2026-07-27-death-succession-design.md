# Death & Succession — The Experience (design)

> **Status:** design LOCKED with Daak, 2026-07-27. Canon already rules the *numbers* of death
> (revival windows, `no_revival`, succession as a line item). This spec designs the
> *experience*: the Heir, the two succession paths, Instability, and the Funeral Rite.
> **Tone target:** the Imperium endures; you do not. Death must be feared, survivable as a
> dynasty, and entirely your own fault when it ruins you.

## Locked decisions

| Axis | Decision |
|------|----------|
| Trigger | Succession fires on **permanent** Commander death only — revival window expired, `no_revival` kill, or failed recovery. While the body can still reach an Apothecarion in time, there is no succession, only a rescue. |
| Heir eligibility | **Inherit from anywhere** — including mid-battle at the Commander's side. If the heir permanently died in the same event, fall through to the no-heir path. |
| No-heir path | **Scrub-tier replacement** (harshest option, chosen deliberately): a fresh rank-1 Commander takes the banner. |
| Instability | Prepared: 3 in-game days. Unprepared: 7. During it: holdings produce at **half rate** and are elevated targets for NPC reconquest pressure (hook consumed by T-NPC-3 when it lands). |
| Influence loss | Prepared: **25%**. Unprepared: **50%**. Loyalty was personal. |
| Funeral Rite | Fires on every permanent Commander death, both paths. One-post ceremony thread; publishes to location history; can enshrine the remains if held. |

## The Heir

- Any **Named** model in the roster can be designated Heir — one button on the model
  overview, changeable at any time, marked visibly in the roster (a small sigil by the name).
- One heir at a time. Designation is free — the cost of not doing it is the point.
- If the heir dies permanently before the Commander, the seat empties and the game says so
  **loudly** (digest line + persistent roster warning). No silent lapse into the scrub path.
- NPC commanders use the same machinery when NPC succession matters later (seam left, not
  built).

## Path 1 — prepared succession (heir named)

The heir's model leaves the roster and **becomes the Commander**: their stats, rank, kills,
loadout, and history carry over, with the canon Commander premium applied on top. Their old
Named slot is gone — the person is now the office.

| Keeps | Loses |
|---|---|
| All holdings, stockpiles, vault, gear | 25% of Influence |
| All forces and models | The heir's former roster slot |
| The heir's own progression & battle record | Stability: 3 days of Instability |

## Path 2 — unprepared succession (no heir)

A stranger picks up the banner: a **fresh rank-1 Commander** of the same faction. The player
names them — that is the only choice they get.

- **50% Influence loss** and **7 days of Instability**.
- Holdings, stockpiles, vault, and models survive — but **every force disbands**: the models
  remain in the roster, the org chart burns. The new Commander must re-form forces from
  scratch (normal force-raising rules), representing troops who owe this nobody nothing yet.
- Politically close to starting over while keeping the material world. Brutal, avoidable,
  self-inflicted.

## Instability

A succession being tested, either path:

- Holdings produce at **half rate** for the duration (multiplies with all other modifiers).
- Holdings are flagged as elevated targets for the NPC-agency layer (T-NPC-3 consumes this;
  until it ships, the flag exists and does nothing beyond production).
- Shown on the Ledger and map (a black-banded marker — the realm knows the throne shook).

## The Funeral Rite

Fires automatically on any permanent Commander death:

- A **one-post ceremony thread** at a location the dynasty rules (crown world by default;
  player may choose another held location before posting).
- The player writes the eulogy — the post *is* the rite. It publishes into that location's
  permanent history: the world remembers.
- **Enshrinement:** if the player's side holds the Commander's REMAINS (the spoils system's
  body item), the rite may enshrine them — a permanent monument line on that location's
  panel, forever. A shrine is small, but it is *yours* and it does not decay.
- **If the enemy holds the body**, the rite happens anyway — angrier. The remains stay out
  there as a normal REMAINS item in enemy hands (tradeable, ransomable, desecratable per the
  spoils design), and recovering them for a proper enshrinement becomes a standing personal
  goal with **no timer**. A shrine can wait forever. Vengeance keeps.

## Integration map

- **Spoils/Remains (T-ITEM-1/T-MISC-1):** the Commander's body is a REMAINS item like any
  other — possession decides enshrinement; ransom/desecration flows apply. The fight over
  the corpse is the prologue to the succession story.
- **Revival (canon death rules):** untouched. Succession is strictly the post-window path.
- **Economy (T-ECN-*):** Instability's half-production is a holding modifier like any other;
  Influence loss uses the existing Influence pool.
- **T-NPC-3:** consumes the elevated-target flag for reconquest pressure.
- **Threads:** the Funeral Rite is a minimal new thread shape (one post, no state, publishes
  + optional enshrine effect) — spine-compatible, no new core mechanics.

## Implementation notes

Single slice (🔥 engine + tests, small canon addition for succession constants
`rules.death.succession = {influence_loss: .25/.50, instability_days: 3/7, prod_mult: .5}`):
heir designation UI + `S` field · permadeath hook → succession resolver (both paths) ·
instability timer on holdings (WORLD tick reads it) · funeral thread shape + enshrinement ·
digest/warning lines. Queue behind current engine-lane work; no dependency on the economy
phases (Influence and production hooks exist today; stockpile keeps simply no-op until E1).

## Deferred

- NPC dynastic succession (seam noted above).
- Heir-specific gameplay (regency powers, rival claimants, succession-crisis events) — rich
  soil for post-alpha drama; deliberately not in the first slice.
