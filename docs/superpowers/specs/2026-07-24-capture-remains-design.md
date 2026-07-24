# Capture & Remains — Design (LOCKED)

**Date:** 2026-07-24 · **Status:** locked with Daak · **Tickets:** T-MISC-1 (Subdue/Capture) + T-ITEM-1 (Remains) — build as one slice.
**Feeds:** Drukhari Slave Raid, GSC Gene-Harvest, Astartes rescue, Necron Reclamation, DG Harvest of Rot, the four corpse/slave doors (T-FAC-1), mission tracker `collect_item(captive)` (D13).

The two missing battlefield primitives that most of the D12 mission catalog and six signature
doors hang on: taking enemies **alive** (Non-Lethal → Capture → CAPTIVE item) and taking the
**dead** (aftermath looting → REMAINS item). Build shape: **extend-the-core** — registry tags,
runtime items, new `THREAD` apply effects, one new thread phase. No new subsystems.

---

## 1. Locked decisions (the record)

| Question | Decision |
|---|---|
| Acquisition | **Tag + gear.** Non-Lethal = weapon tag (retrofit + forgeable by affinity). Capture = tiered item/ability tag. |
| Capture gate | Target at **exactly 1 wound** — the Non-Lethal floor. |
| Capture cost | Set by **tag tier**: I = 3 AP · II = 2 AP · III = 1 AP. Melee range (Chebyshev ≤ 1). |
| Capture UX | A **standing special action** — always in the action menu for a model whose gear grants it; fails validation when criteria unmet. Never a conditionally-revealed button. |
| Captive in battle | **Carried on the capturing model** in an **empty slot**. Converts to inventory only when the carrier exits alive or the thread concludes. |
| Carrier slain | CAPTIVE (or carried REMAINS) lies on the carrier's corpse. An **ally of the captive** adjacent may spend **1 AP to free** them → model returns at 1 wound on that square. Otherwise lootable in the aftermath. |
| Loot timing | **Aftermath only.** No mid-battle looting. |
| Carry rules | Looted **body → occupies an empty slot** on the looter (symmetric with CAPTIVE). Looted **gear → straight to force inventory** (D4). |
| Targets | **Everyone — PCs included.** Captured/looted PC models grey out of the owner's roster while held. |
| Revival clash | **Possession = the body.** The revival window ticks wherever the Remains is; whoever holds it can race it to an Apothecarion. Lapsed window → permanent commodity. |
| Captive fate | **Full menu:** Ransom · Sell/Feed (doors) · Execute → REMAINS · Release. |

## 2. Canon changes (data file → `meta.version` 1.20)

### 2.1 Registry tags

```
tags.weapon += { tag: "Non-Lethal",
  mechanic: "Strikes from this weapon cannot reduce a target below 1 wound.",
  forgeable: true }          // affinity: drukhari, gsc (extendable later)

tags.item += { tag: "Capture",
  mechanic: "Grants the Capture special action: adjacent (Chebyshev ≤1) to an
             enemy at exactly 1 wound, spend AP by tier to take it captive.
             The captive occupies an empty slot on this model.",
  tiers: ["I — 3 AP", "II — 2 AP", "III — 1 AP"] }
```

`equipment_alpha.forge_affinities`: add `"Non-Lethal"` to **drukhari** and **gsc**.

### 2.2 Catalog: retrofits + mints

Catalog scan found exactly **3 natural Non-Lethal fits** (everything else is chainaxes and
power klaws); retrofit those and mint one common subdual weapon so every faction can buy in:

| Action | Item | Faction | Line |
|---|---|---|---|
| retrofit | **Agoniser** | drukhari | append `- Non-Lethal` (pain without death — signature) |
| retrofit | **Webber** | gsc | append `- Non-Lethal` (ensnaring) |
| retrofit | **Concussion Maul** | votann | append `- Non-Lethal` |
| mint | **Shock Maul** | common | `Phys 1 - Melee - 1 AP - Non-Lethal` — WEAPON, cheap |
| mint | **Shackles** | common | ITEM · `Capture I` — buyable at any shop |
| mint | **Slaver's Snare** | drukhari | ITEM · `Capture II` |
| mint | **Abduction Kit** | gsc | ITEM · `Capture II` |

Capture III ships in the registry but on no item yet — reserved design space for future
faction gear / forge upgrades.

### 2.3 `rules.spoils` — every number in one tunable block

```json
"spoils": {
  "capture_ap_by_tier": { "I": 3, "II": 2, "III": 1 },
  "capture_range": 1,
  "capture_target_wounds": 1,
  "loot_ap": 1,
  "free_captive_ap": 1,
  "sell_mult": { "REMAINS": 0.5, "CAPTIVE": 1.0 },
  "sell_basis": "effective PC (base pc × rank growth mult), rounded",
  "execute_window": "element of the weapon used; unarmed = Physical;
                     no_revival source = permadeath",
  "aftermath": {
    "own_dead": "field-holder auto-recovers its own dead at conclude",
    "unlooted_enemy_dead": "auto-return to owner, revival window unchanged"
  }
}
```

## 3. Runtime items — never catalog entries

CAPTIVE and REMAINS are generated at capture/loot time, carrying a frozen snapshot:

```json
{ "cat": "CAPTIVE" | "REMAINS",
  "n": "Remains of R4 Plague Marine — Morvax",
  "ref": { "name":…, "faction":…, "cls":…, "rank":…, "pc":…, "wounds":…,
           "loadout":[…], "kills":…, "lore":… },
  "owner_cmdr": "<victim commander/NPC id>",
  "origin": "Ossuar Flats, Nurth", "takenDay": …,
  "window": { "element": "Physical", "expiresDay": … }   // REMAINS only
}
```

Clicking either opens the model's full overview rendered from the snapshot (D9 behaviour).
The victim's roster keeps the model, greyed **CAPTURED** / **TAKEN** — loss is visible,
rescue is motivated.

## 4. Combat flow (THREAD core)

- **Non-Lethal floor** — in the damage step, after armour mitigation and cover: if the
  weapon carries Non-Lethal, cap damage so the target never drops below 1 wound. One line;
  fog, AP, range bands untouched.
- **Capture** — standing action. `validate`: Chebyshev ≤ 1 · `target.w === 1` · actor has a
  Capture-tagged item/ability equipped · actor has an empty slot · AP ≥ tier cost.
  `apply`: target leaves `state.combatants` · CAPTIVE item fills the actor's slot · victim's
  roster model greys.
- **Carrier slain** — carried CAPTIVE/REMAINS stays on the corpse. Adjacent ally of the
  captive: 1 AP `free` → model returns to the board at 1 wound on that square. Unfreed →
  aftermath loot like any carried gear.
- **Aftermath phase** — victory (annihilation, or all enemies exited) sets
  `phase:'aftermath'` instead of concluding. No enemies; winner's models keep posting with
  normal AP; adjacent to an enemy corpse, `loot` (1 AP): gear pieces → inventory, body →
  empty slot as REMAINS. **END THREAD** concludes.
- **Conclude conversions** — carried CAPTIVE/REMAINS → `S.inv`; field-holder auto-recovers
  own dead (existing revival flow unchanged — looting is the aggressive override, never a
  chore); unlooted enemy dead auto-return to their owner, window still ticking.
- **Early exit** — a carrier who exits the thread alive converts its carried items
  immediately.

## 5. Post-battle economy

**CAPTIVE verbs** (item card): **Ransom** — Comms offer to the owner (rides the existing
trade widget) · **Sell/Feed** — at doors declaring `accepts: CAPTIVE` (generic hook now;
Drukhari Atelier, Daemons Warp Rift, T'au Assembly snap on with T-FAC-1) · **Execute** —
converts to REMAINS, fresh revival window stamped from the weapon used (no_revival →
permadeath) · **Release** — model returns to owner, un-greys.

**REMAINS verbs**: **Revive** — race the window to an Apothecarion; the owner gets their
model back; a stranger reviving gains a captive-equivalent to ransom · **Sell** — any shop ·
**Offer** — doors declaring `accepts: REMAINS` (Skull Throne, Digestion Pool, Reclusiam,
Necron reanimation later).

**Pricing baseline**: sell value = `round(effective_PC × sell_mult)` — REMAINS 0.5,
CAPTIVE 1.0 (living prize worth double). Neighbours the existing 60%-of-base gear-sell rule.

**NPC symmetry (solo alpha)**: NPCs with capture gear can shackle player models via the
existing NPC combat turn. Player gets a digest entry + ransom demand in Comms — or raids to
rescue. The Astartes-rescue mission hook arrives free. NPC factions without a purse skip
ransom offers.

## 6. Engine wiring (thin glue)

- CAPTURE standing action button in the board action block; corpse markers rendered from
  already-dead combatants (position already in state).
- Aftermath banner + END THREAD action in `threadView`.
- Item cards for CAPTIVE/REMAINS with the verb menus; snapshot overview reuses the existing
  model-overview overlay.
- Door panels: generic `accepts` check — sell/feed/offer appears when the door takes that
  category.
- Roster: greyed CAPTURED/TAKEN state, gated from force-building while held.

## 7. Tests (`tests/spoils-*.test.js`, node runner, pure core)

- Capture validation matrix — each failing criterion (range, wounds≠1, no tag, no slot, AP).
- Non-Lethal floor — never below 1 wound, incl. multihit/DoT interactions.
- Carrier-death chain — slay carrier → free (returns at 1 w) vs unfreed → aftermath loot.
- Aftermath — no loot before victory; loot costs; body-needs-slot; gear-to-inventory.
- Conclude — conversions, own-dead auto-recovery, unlooted auto-return, roster greying.
- Execute → REMAINS window stamp (element + no_revival permadeath).
- Ransom/Release round-trip — roster un-grey, currency movement.
- Canon guard — capture items' tags exist in registry; spoils block complete.

## 8. Out of scope (deliberate)

- Board-entity body sim (drop/drag/fight-over mid-battle) — layerable later, mostly PvP value.
- The 20 signature doors themselves (T-FAC-1) — this spec only ships the `accepts` hook.
- PvP ransom escrow (T-ENG-2 / Stage 2) — alpha ransom is NPC-side + trust-based Comms.
- Yield/tribute and tiered-revive (D3/D5) — separate slice of the battle-end ladder.
