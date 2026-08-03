# Missions V2 — Design (LOCKED, Daak sit 2026-07-26)

Closes the mission opens from D12/D13 (`2026-07-22-thread-archetypes-design.md`) and the
Alpha V2 handoff (cluster ❺+❼). Everything below was decided with Daak in the 2026-07-26
design sit. Supersedes nothing — it *instantiates* the locked D12.2/D12.3 content and the
D13 spine.

## Decisions (the four opens + two scope calls)

| Open | Decision |
|---|---|
| Who posts missions | **One generator, three faces.** The day-tick generates all missions from location/world state; each mission is *attributed* to a poster at generation: a fitting door if present, a co-located NPC if present, else an anonymous board notice. Faces are diegetic labels in V2 (no NPC agency required — that deepens in NPC Slice 2b without rework). |
| How many live at once | **Abundant.** Every populated planet keeps a board of 4–6 live missions, refilled by the tick. Missions are a staple, not a treat. |
| Player accept cap | **3 concurrently accepted** per Commander. Finish or abandon to take more. |
| Payout formula | **Scale-anchored:** `payout = family_base × size × planet prod_mult × modifier stack` (see Payout). |
| Universal V2 cut | **All 11 feasible universals** (everything except the primitive-gated three). |
| Signatures | **Everything including streaks:** the streak primitive ships in this arc; **18 signature missions ship, covering 17 factions** (Astartes fields two); 3 factions wait on their primitives (Daemons / Death Guard / Necrons). |

## 1 — The objective tracker (pure MISSION core)

New DOM-free region in `index.html` (same pattern as `THREAD`/`WORLD`/`LOADOUT`), node-tested:

```
objective = { kind, target, progress, params, done }

MISSION.track(objective, event)  → mutates progress from a normalized event
MISSION.evaluate(objective)      → { won, progress, target } at conclude
```

Events flow from exactly **two existing choke points** — no new plumbing per mission:
1. `THREAD.apply` — combat events (kill, damage, wounds-taken, capture), tagged with
   attacker/victim/filter data the trackers need.
2. Door / thread actions — deliveries, purchases, ritual posts, restore work-posts.

`concludeThread` calls `evaluate()`; MISSION joins `THREAD.outcome` so mission threads
can be **won, lost, and paid** (today MISSION is excluded and unwinnable).

**Tracker kinds shipped in this arc (8):**

| kind | reads | used by |
|---|---|---|
| `count_kill(filter)` | apply kills (filter: name / class / melee-only / any) | Purge, Bounty Hunt, Kill-Team, Assassination, Liberation, WE, Votann |
| `survive_rounds(n)` | round counter | Defend |
| `wounds_taken(cmp,X)` | apply damage to own/allied models | EC (allies=0), Sororitas (≥X), Harlequins (=0) |
| `collect_item(filter,qty)` | loot/buy/deliver events | Trade Haul, Item Request, TS, Mechanicus, Aeldari |
| `force_composition(pred)` | force state at lock-in / accept | Assassination (alone), Astartes The Few, AM Meatgrinder, T'au, + all modifiers |
| `capture(filter,qty)` | shipped capture events | Drukhari Slave Raid, GSC Gene-Harvest, Astartes None Left Behind |
| `streak(key,n)` | `S.progress.streaks` (see §4) | BL, Orks, Custodes, Tyranids |
| `restore(posts)` | qualifying posts in-thread | Rebuild, Consecration, Desecration |

`protect_entity` and `survive_waves` are **specced shape, not built** — they arrive with
civilians (Evacuation) and waves (Survival) post-V2. The `objective` shape already
accommodates them (no migration later).

**Every mission is a canon data row** — `{ id, n, family, kind, target_roll, params,
faces, gates, world_effect, flavor }` in `D.missions.universal[]` and
`D.missions.signatures{faction:[…]}`. Adding a mission after this arc = data only.

## 2 — Generator, boards, faces (WORLD tick + UI)

Runs inside `WORLD.catchUp` — deterministic, `Date.now`-free, replayable; offline days
generate and expire exactly as if watched.

Per populated planet per tick-day:
1. **Refill:** if the board holds fewer than `board_min` (4) live missions, roll new ones
   up to a random point in `[board_min, board_max]` (4–6).
2. **Condition-weighted picks:** location conditions get first claim — Ruined → Rebuild,
   Infested → Purge, enemy-occupied → Liberation, Besieged → Defend — then the baseline
   weight table over the rest of the pool. Signature missions inject only for factions
   present/relevant (§4).
3. **Face it at generation:** fitting door at the location (Rebuild → Throne Room,
   Item Request → the vendor door…) → door-posted; else co-located NPC → NPC-offered
   (their name on the notice); else anonymous notice.
4. **Expiry:** unaccepted missions older than `expiry_days` (5) are replaced. An
   **accepted** mission never expires from the board timer.

**State home:** `S.world.missions[planetId] = [missionInstance…]` — save-state (world
state, not canon), snapshotted like all of `S.world`.

**Surfaces:** the location panel gains a **Missions** section (browse + accept, shows
face/poster, objective, payout, modifiers picker); the thread board doubles as the
**Mission Log** for accepted missions with a progress meter (`progress/target`).
Accepting (cap-checked ≤3) spawns a real MISSION thread seeded with the `objective`.

## 3 — Payout, modifiers, lifecycle

```
payout = family_base × size × prod_mult × Π(modifier_mult)
```

- `family_base` (canon defaults, tunable): KILL 10 · HOLD 12 · LOGISTICS 8 · RITUAL 10
  (currency of the payer's faction).
- `size` = objective target ÷ family norm (norms: 5 kills / 5 rounds / 5 items /
  5 posts), clamped to [0.5, 4].
- `prod_mult` = the mission planet's existing canon `prod_mult` (rich worlds pay more).
- Modifiers (D12.1, locked): Understrength · Lone Wolf · Low-Tech · Ironman · Blitz —
  chosen at accept, **×1.5 each, multiplicative stacking**; their gates are
  `force_composition`-style predicates validated during play (violating a gate voids the
  modifier bonus, not the mission).
- Signature missions pay `family_base` of their underlying family **× 1.5 signature
  premium** (they're harder and flavour-priced).

**Lifecycle:**

```
board ──accept(≤3)──▶ ACTIVE ──conclude──▶ WON  → payout + world_effect
  ▲                     │                ▶ LOST → no payout, removed
  └────── abandon ──────┘   (returns to the board, no penalty in V2)
```

Fail conditions per kind (round-cap exceeded, `wounds_taken` predicate broken at
conclude, target left the location, etc.) are `params`, not code. **World effects** fire
through the shipped score-drift machinery: Purge → taint↓ · Rebuild → prosperity↑ +
condition cleared · Consecration → taint↓ prosperity↑ · Desecration → taint↑
prosperity↓ · Defend → conflict↓ … Missions are the second player lever on the
flywheel, alongside conquest.

**All tunables in one canon block** `rules.missions`: `board_min:4, board_max:6,
accept_cap:3, expiry_days:5, family_bases{…}, family_norms{…}, size_clamp:[0.5,4],
modifier_mult:1.5, signature_premium:1.5`.

## 4 — Streak primitive + signature roster

**`S.progress.streaks = { key: { count, best } }`** on the Commander — the one genuinely
new primitive. Updated **only at `concludeThread`** (win a qualifying thread → increment,
lose/break → reset to 0). Survives reload via the normal snapshot. Streak missions are
plain `streak(key,n)` tracker rows reading it.

**Signature generation is faction-gated:** a sub-faction's signature missions appear only
on boards for Commanders of that faction (injected by the generator alongside universal
picks) and are gated at accept.

**Ships in V2 (18 rows / 17 factions):** WE Skulls for the Throne (melee count_kill) · Votann Settle the
Grudge · EC The Perfect Kill (allies=0) · Sororitas Martyrdom (≥X own wounds) ·
Harlequins Flawless Performance (=0) · TS Forbidden Lore (collect tome) · Mechanicus
Tech-Reclamation (loot X tier≥Y gear) · Aeldari The Soul Tithe (collect Souls) ·
Astartes The Few (outnumbered ≥2:1) · AM The Meatgrinder (min-PC force) · T'au Auxiliary
Doctrine (≥X non-T'au) · Drukhari The Slave Raid (capture X) · GSC Gene-Harvest (capture
specific) · Astartes None Left Behind (free a captive — second Astartes row, both ship) ·
BL The Long War (streak: chained raids) · Orks Might Makes Right (streak: duel wins) ·
Custodes The Blood Games (streak: 1v1 vs named NPCs) · Tyranids Amass Biomass (streak:
annihilation chain).

**Primitive-gated, NOT in this arc (3):** Daemons The Widening Rift (destructible
env-piece, T-MISC-2) · Death Guard Harvest of Rot (Plague Garden door, doors arc) ·
Necrons Reclamation Protocol (in-battle reanimate action). Each lands with its primitive.

**Universal missions gated out (3):** Evacuation (civilians, T-MOD-1) · Survival
(waves) · Convoy (travel-legs, T-THR-3).

## 5 — Slices, testing, prerequisites

| Slice | Lane | Contents |
|---|---|---|
| **A — Spine** | 🔥 hot | MISSION core (track/evaluate, 8 kinds) · `rules.missions` + `D.missions` schema · tick generator + boards + faces + expiry · accept cap · MISSION in `THREAD.outcome` + payout + world effects · location-panel Missions section + Mission Log meter · **3 pilot missions** (Purge, Item Request, Rebuild — one per event seam) |
| **B — Universals** | canon-heavy | remaining 8 universal missions as data rows · modifier picker + gate validation · Bounty/Assassination named-target spawn params |
| **C — Streaks + signatures** | 🔥 hot (small) + canon | `S.progress.streaks` at concludeThread · 18 signature rows · faction gating in the generator |

**Hard prerequisite: T-THR-5** (thread-state hydration). Accepted missions live in
`t.state.objective`; today a reload rebuilds `t.state` from `seedState` and would wipe
mission progress. T-THR-5 lands before or inside Slice A.

**Testing (house pattern):** `tests/mission-core.test.js` per tracker kind (table-driven
events → progress → evaluate) · generator determinism through `WORLD.catchUp` (same
state + days → same boards; bounded catch-up honoured) · payout math table-tested
(size clamp, modifier stacking, signature premium) · persist→reload round-trip on an
accepted mission with progress · narrow scoped browser E2E per slice
(browse → accept → progress → conclude → paid → world effect visible).

**Guard-rails:** abandon restores the board row · expiry never touches accepted
missions · `objective` versioned in the seed so pre-mission saves load clean ·
`board`/`streaks` keys absent → treated as empty (old saves).

**BACKLOG:** three rows — `T-MSN-1A` (spine, hot) · `T-MSN-1B` (universals) ·
`T-MSN-1C` (streaks+signatures) — B blocked by A, C blocked by B.

## Out of scope (unchanged by this spec)

Civilians+gender (T-MOD-1) · destructibles (T-MISC-2) · waves · travel-legs Convoy
(T-THR-3) · space (T-SPACE-1) · door tiers/signature doors (D11 — separate sit) ·
NPC mission *agency* (Slice 2b) · real-AI mission text (T-AI-1, Stage 3).


## Slice-B rulings addendum (Daak sit 2026-08-03)

- **Trade Haul destination gate:** at generation the mission picks a seeded DESTINATION —
  a different same-planet location carrying a shop door; delivery only lands there (the
  Deliver control activates only when the Commander is at the destination). Locations with
  no valid destination don't mint the row (needs-destination eligibility, like
  needs_hostiles).
- **Modifiers are combat-only:** the hardship picker offers — and modCheck validates —
  modifiers ONLY on combat-kind missions (count_kill / survive_rounds). Rituals and
  logistics pay flat.
- **named_premium stays 1.5** (tuning; revisit in play).
- **Capture counts, dead or alive:** capturing the named target completes a bounty /
  assassination objective same as killing it — and the Commander keeps the CAPTIVE
  (sell/ransom on top of the payout). GLOSS updated to match.
- Engineering folds (no ruling needed): class-spawn deployment spreads to adjacent free
  cells (8-model kill-teams no longer stack on one square); mission conflict writes
  initialize an unset sector conflict from the displayed default (10) before applying the
  delta, so canon's −2/−3/−4 are felt as authored.
