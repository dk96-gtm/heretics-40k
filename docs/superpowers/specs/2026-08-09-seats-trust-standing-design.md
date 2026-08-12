# T-TERR-2 — Seats, Trust & Standing — Design (LOCKED 2026-08-09)

**Status:** DESIGN LOCKED with Daak 2026-08-09 (re-drafted after session loss; all rulings re-confirmed).
**Builds after:** T-NPC-3 N1 (ultimatum clocks, canon v1.33) — this spec rides its garrison math, condition ladder, lapse resolution, and tribute channel.
**Canon target:** data v1.34. Engine lane: HOT (index.html).

## 1. Overview

Commanders can hold **seats** — named locations on planets ruled by their **own sub-faction** — earned through service (per-planet WORK), granted by petition at the Throne Room, and paid for in currency. A seat pays tax and production share, can be built up, and can be defended by stationing ONE force. A per-sub-faction **STANDING ledger** (seeded from an authored 20×20 relations matrix) gates the social side; raiding kin drops you to WAR. Holding a **majority of seats** on a planet opens the **BUYOUT** path to planetary rule at the sector crown world.

**Overrule carried in (Daak 2026-08-09):** the economy-spec "Muster garrison hire" is struck. Muster recruits the roster only; holdings are bolstered by stationing your own force.

## 2. Standing (table ❶ — LOCKED)

### 2.1 Ladder

| code | name | value |
|---|---|---|
| A | ALLIED | +2 |
| W | WARM | +1 |
| n | NEUTRAL | 0 |
| c | COLD | −1 |
| H | HOSTILE | −2 |
| X | WAR | −3 |

Actions move the needle. **Kin-raid floor:** raiding a holding of your own sub-faction (or any faction) drops that standing to WAR (−3) immediately.

### 2.2 The authored 20×20 matrix

Full authored matrix — every pair a deliberate lore fact, stored verbatim in canon as `rules.standing.matrix`. Symmetric; diagonal is null (self).

Faction codes: BL black_legion · DG death_guard · WE world_eaters · TS thousand_sons · EC emperors_children · DM daemons · AS astartes · AM militarum · ME mechanicus · SR sororitas · CU custodes · TY tyranids · OR orks · NE necrons · AE aeldari · DR drukhari · TA tau · GS gsc · VO votann · HQ harlequins.

```
     BL DG WE TS EC DM AS AM ME SR CU TY OR NE AE DR TA GS VO HQ
BL │  ·  W  W  W  W  W  X  X  X  X  X  X  H  H  H  H  H  H  H  H
DG │  W  ·  n  n  n  W  X  X  X  X  X  X  H  H  H  H  H  H  H  H
WE │  W  n  ·  c  H  W  X  X  X  X  X  X  H  H  H  H  H  H  H  H
TS │  W  n  c  ·  n  W  X  X  X  X  X  X  H  H  H  H  H  H  H  H
EC │  W  n  H  n  ·  W  X  X  X  X  X  X  H  H  X  X  H  H  H  X
DM │  W  W  W  W  W  ·  X  X  X  X  X  X  H  H  X  H  H  H  H  X
AS │  X  X  X  X  X  X  ·  A  A  A  A  X  H  H  c  H  c  H  c  c
AM │  X  X  X  X  X  X  A  ·  A  A  A  X  H  H  c  H  c  H  c  c
ME │  X  X  X  X  X  X  A  A  ·  W  A  X  H  H  c  H  c  H  H  c
SR │  X  X  X  X  X  X  A  A  W  ·  A  X  H  H  c  H  c  H  c  c
CU │  X  X  X  X  X  X  A  A  A  A  ·  X  H  H  c  H  c  H  c  c
TY │  X  X  X  X  X  X  X  X  X  X  X  ·  X  X  X  X  X  A  X  X
OR │  H  H  H  H  H  H  H  H  H  H  H  X  ·  H  H  H  H  H  H  H
NE │  H  H  H  H  H  H  H  H  H  H  H  X  H  ·  H  H  c  H  c  H
AE │  H  H  H  H  X  X  c  c  c  c  c  X  H  H  ·  c  n  H  c  A
DR │  H  H  H  H  X  H  H  H  H  H  H  X  H  H  c  ·  H  H  H  W
TA │  H  H  H  H  H  H  c  c  c  c  c  X  H  c  n  H  ·  H  n  c
GS │  H  H  H  H  H  H  H  H  H  H  H  A  H  H  H  H  H  ·  c  H
VO │  H  H  H  H  H  H  c  c  H  c  c  X  H  c  c  H  n  c  ·  c
HQ │  H  H  H  H  X  X  c  c  c  c  c  X  H  H  A  W  c  H  c  ·
```

Deliberate authored calls (the rest follows the obvious lore grain):

1. Black Legion WARM with every traitor legion — Abaddon's banner unites.
2. World Eaters ↔ Emperor's Children HOSTILE — the Skalathrax grudge.
3. World Eaters ↔ Thousand Sons COLD — berzerkers despise sorcery.
4. Emperor's Children + Daemons at WAR with Aeldari + Harlequins — She Who Thirsts; the soul-hate cuts both ways.
5. Drukhari ↔ Emperor's Children WAR, but Drukhari ↔ Daemons only HOSTILE — Commorragh fears Slaanesh specifically.
6. Mechanicus ↔ Sororitas WARM, not Allied — faith vs machine friction.
7. Mechanicus ↔ Votann HOSTILE (the rest of the Imperium is COLD) — abominable intelligence.
8. Tyranids WAR with ALL; GSC ↔ Tyranids ALLIED — the worshipped Devourer. No diplomacy row is possible with Tyranids.
9. Orks HOSTILE with all, WAR with Tyranids only — a proppa fight, not policy.
10. Aeldari ↔ Drukhari COLD, not hostile — estranged kin still trade.
11. Aeldari ↔ Harlequins ALLIED · Drukhari ↔ Harlequins WARM — Cegorach walks both courts.
12. Imperials ↔ T'au / Aeldari / Votann / Harlequins COLD — the truce-able xenos band; this is the diplomacy design space.
13. Imperials ↔ GSC HOSTILE, not WAR — the cult is a hidden war.

### 2.3 Player ledger

`S.world.standing[facId]` — the player's standing with each of the 20 sub-factions, **seeded from the matrix row of the player's own faction** at founding (and back-filled for existing saves in `init()`). Standing with the player's OWN faction (the null diagonal) seeds at **ALLIED (+2)** — it is the ledger the kin-raid floor punishes, and the one §3.5's petition gate reads. Clamped to [−3, +2]. Standing moves on actions (kin-raid floor above; further movers land with diplomacy T-DIP-1 and aggressor N2).

The matrix itself also serves faction↔faction politics (N2 aggressor targeting reads it later); this slice only wires the player ledger.

## 3. Seats (table ❷ — LOCKED)

### 3.1 What a seat is

A commander-held **named location** on a planet ruled by his own sub-faction. Player-only in this slice (single-player alpha). A seat **falls with the planet** — if the planet's ruler changes (capture, INVASION), every seat on it is cleared.

### 3.2 Price formula

```
price = seat_base[type] × level × condition_mult
```

`condition_mult` **reuses the N1 garrison ladder**: Fortified 1.25 · Intact 1.0 · Sacked 0.6 · Ruined 0.3. A battered seat is a fixer-upper discount.

### 3.3 Base price + work gate by location type

| group | type | seat_base | work_gate |
|---|---|---|---|
| WILD | ruins | 8 | 2 |
| WILD | lair | 12 | 2 |
| WILD | village | 12 | 2 |
| STANDARD | military_outpost | 20 | 4 |
| STANDARD | mek_shop | 20 | 4 |
| STANDARD | cult_sanctum | 20 | 4 |
| STANDARD | plague_garden | 20 | 4 |
| STANDARD | shrine | 25 | 4 |
| STANDARD | tomb_vault | 25 | 4 |
| MAJOR | city | 30 | 6 |
| MAJOR | manufactorum | 30 | 6 |
| MAJOR | bulwark | 30 | 6 |
| MAJOR | fortress | 40 | 6 |
| MAJOR | tradeport | 40 | 6 |
| GRAND | orbital_dock | 45 | 10 |
| GRAND | space_station | 45 | 10 |
| GRAND | forge_temple | 50 | 10 |
| GRAND | hive | 60 | 10 |
| GRAND | webway_portal | 60 | 10 |

**Not seat-able:** `crown` (the ruler's own seat — that's the BUYOUT path), `warzone` (contested ground; nobody grants title to an active battlefield), `orbit` / `space` (tiers, not named holdings).

Deliberate calls: **webway_portal priced GRAND** (strategic infrastructure — free-travel termini once portals are charted) and **ruins cheapest on the board** (the "buy the wreck, Rebuild it up" career path, feeding the Rebuild/Commission powers).

### 3.4 WORK (per-planet trust)

`S.world.work[pid]` — integer counter per planet. Earned ONLY by serving the planet:

| act | work |
|---|---|
| any mission concluded on that planet | +1 |
| a Rebuild mission concluded there | +2 |
| manual Rebuild or Liberate at that world | +1 |

Nothing else grants WORK — you earn a seat by service, not by shopping.

### 3.5 Petition flow

At the **Throne Room door** of a planet ruled by the player's own sub-faction, a seat panel lists the planet's seat-able locations with price / work gate / held-status. Gates (all fail-closed, refusal reasons shown):

1. Planet ruler = player's sub-faction.
2. `S.world.work[pid] ≥ work_gate[type]`.
3. Standing with the ruling sub-faction ≥ NEUTRAL (0).
4. Currency ≥ price.

On grant: currency spent, `S.world.seats[locId] = {pid, since}`.

### 3.6 Seat powers

| power | wiring |
|---|---|
| seat TAX | `3 × level × condition_mult` currency/day on the world tick |
| production share | the seat location's share of planet production (T-ECN-1 shares) accrues to the player |
| door tier-upgrades | the existing `DOOR.startBuild` upgrade flow, permission extended to the seat holder at their seat |
| COMMISSION | build a door the location lacks, via the same build-timer seam (new build kind). **Plan amendment 2026-08-10 (tunable): 30 currency flat + 7-day build.** |
| Rebuild / Liberate | N1's manual no-payout actions, extended to held seats |
| station ONE force | §4 |
| ultimatum-able | seats are locations; the N1 clock/Besieged machinery already applies |

## 4. Stationing & casualties (table ❸ — LOCKED)

### 4.1 Stationing

ONE force may be stationed at a held seat. While stationed it is locked (like thread-active), its PC adds to the ULT garrison defense of that location, and its **upkeep swallows ALL currency first** — the location takes the money; on non-payment, unrest wounds the **LOCATION's condition** (never the force).

**Upkeep amount (plan amendment 2026-08-10, tunable):** `ceil(force PC ÷ 250)` currency per day — rides the existing travel `force_divisor` scale. Each missed day adds +1 unrest to the planet; every 3rd miss steps the seat location's condition down one rung.

### 4.2 Casualty ladder — keyed to the N1 lapse outcomes

| outcome | force wound pool | deaths & worse |
|---|---|---|
| REPELLED (def wins big) | 15% of total force wounds | none — wounds only |
| REPELLED W/LOSSES (def wins narrow) | 35% | only by wound spill (model hits 0 → down) |
| SACKED (att wins narrow) | 60% | attacker carries off a seeded HALF of the downed as CAPTIVE / REMAINS loot |
| CAPTURED (invasion, att wins big) | 100% — overrun | every model downed; seeded CAPTIVE-vs-slain split; force disbands with the planet |

### 4.3 Supporting rules

1. **Distribution** — seeded round-robin: 1 wound per living model per pass until the pool is spent. Damage spreads across the line; chaff drops first, champions fall last. Seed = the lapse-roll seed family ⊕ member id → chunk-independent, deterministic, pool-exact.
2. **The downed** — a model at 0 wounds is slain in the defense. Body = REMAINS at the location. Standard Physical revival window (8 days), **anchored at the LAPSE game-day** (Daak ruling 2026-08-09: the HARSH anchor — the clock ran while you were away; return 10 days late and they are permanently dead). N1's Besieged pill + countdown make this fair: casualties are the cost of ignoring, never a surprise tax.
3. **Carried off** — on SACKED, the attacker takes a seeded half of the downed (CAPTIVE if capturable, else REMAINS as loot). These feed N1's existing tribute "return of a TAKEN model" channel — buy-back diplomacy, already plumbed.
4. **Survivors** — stay stationed, wounded, still swallowing upkeep. Wounds heal only via Apothecarion; a mauled garrison is a real liability, not a self-solving one.

## 5. Buyout & ruler NPCs

- **Ruler NPCs** — a deterministic ruler NPC seeded per ruled planet (id-seeded, no save bloat) — the face you petition at the Throne Room. Door-keeper NPCs follow in a later slice.
- **BUYOUT** — at the **sector crown-world** Throne Room. Gates: majority of the planet's seat-able locations held + sector-wide work + standing with the ruling sub-faction ≥ WARM (+1). Price = **sum of the remaining unheld seat prices × 2** (a deliberate premium: rule-by-purchase costs more than seat-by-seat service). Grants planet rule: `S.world.rulers` overlay moves + a governor flag for the player.
- **Crown audit** — canon fix: every sub-faction-ruled sector must designate a crown world; 2 sectors currently lack one — author them in v1.34.

## 6. Canon & save-state shapes

**Canon (data v1.34):**
- `rules.standing` — `ladder` (six rungs, −3..+2), `matrix` (20×20, symmetric, diagonal null), `kin_raid_floor: -3`.
- `rules.seats` — `base_by_type`, `work_gates`, `not_seatable`, `tax` (3/lvl/day formula constants), `casualties` (pool % per outcome, carried-off ½, revival element Physical, anchor lapse-day), `buyout` (majority + work + standing gates, ×2 premium).
- Galaxy: the 2 missing crown-world designations.

**Save-state (seed in BOTH `foundingWorld()` and `init()` — the S.world gotcha):**
- `S.world.standing[facId]` — int, seeded from the player faction's matrix row.
- `S.world.work[pid]` — int, default 0.
- `S.world.seats[locId]` — `{pid, since, stationedForceId?}`.

## 7. Tests

- **Canon guards:** matrix is exactly 20×20 · symmetric · diagonal-null · all cells on the ladder; `base_by_type` covers every seat-able type and no non-seat-able one; every sub-faction-ruled sector has a crown world (the audit pin).
- **SEAT core (pure, node-tested):** price/gates/tax; petition refusal reasons; buyout gate math.
- **Casualty core:** seeded distribution is deterministic, pool-exact, chaff-first, chunk-independent; carried-off split; lapse-day anchor.
- **Standing core:** seeding from row, movement clamps at [−3,+2], kin-raid floor.
- Browser E2E per engine task (0 console errors), per house SDD practice.

## 8. Tunables (defaults, NOT locked — flagged for play-tuning)

- All 190 matrix cells (the 13 authored calls are the ones to watch).
- seat_base / work_gate tables; the ×level × condition_mult formula shape is locked, values are not.
- Casualty pool percentages 15/35/60/100 and the carried-off ½.
- Buyout ×2 premium; standing gates NEUTRAL (petition) / WARM (buyout).

## 9. Out of scope (parked)

- Sub-planet ownership on OTHER sub-factions' planets — the bigger territorial redesign.
- Player↔player seats and multi-claimant petitions — Stage 2.
- Door-keeper NPCs (follow ruler NPCs later; T-SOC-1 territory).
- Faction↔faction standing DRIFT (N2 reads the matrix statically for now).
