# T-NPC-4 — Personality Combat Doctrine — Design (LOCKED 2026-08-10)

**Status:** design locked with Daak (sit 2026-08-10, 03:19–04:21 CEST). Build queues behind
T-TERR-2's engine-lane hold.
**Problem:** every NPC fights with one playbook (walk at nearest enemy, biggest affordable
weapon) — all battles feel identical. Personality must drive command.
**Parent designs:** NPC AI Slice 1 (`2026-07-18-npc-slice1-design.md` — the 5-axis model,
faction `behavior_matrix` deferred there as "needed only for spawning combat garrisons");
thread-types deep design (`2026-07-21-…` — Skirmish exit/pursuit rules, and the line
"full AI via npcTurn (3-frame matrix × 5-axis faction personality)" this task finally builds);
background-agency (`2026-07-27-…` — lapse battles this task nudges).

---

## Daak rulings (locked in the sit)

1. **Personality source = faction profile + seeded individual variation** (re-affirming the
   Slice-1 design): mint the per-faction `behavior_matrix` that spec locked but never shipped.
2. **Doctrine model = STYLE + CONDUCT** (option 3): strongest of Ferocity/Cunning/Supremacism
   picks the side's fighting style; Pragmatism and Honor are conduct rules that always apply.
3. **Diplomacy reads the same numbers later** — one personality, many consumers. T-DIP-3 and
   N2 consume the matrix minted here; nothing is authored twice.
4. **NPC withdrawal reuses the minted Exit-via-escape rule** (Skirmish spec 2026-07-21):
   pursuit-risk ranked-speed check, caught → fresh Skirmish on worse ground, loser exits.
   No new retreat mechanic. (Pursuit-check quality is T-ENG-3, unchanged.)
5. **Doctrine is fully hidden** — no labels anywhere in the UI; behavior is the only tell.
   Consequence: styles are authored LOUD (visibly distinct within 1–2 posts), never subtle.
6. **Lapse battles get small personality nudges in the math** (option 2): each nudge is one
   visible line in the printed RECORD arithmetic; everything stays seeded/deterministic.

**Flagged as tunable defaults, NOT locked rulings** (same treatment as the N1 tunables):
the retreat curve, the honor gates (70/30), the lapse nudge sizes (±0.05 / loot floor),
and every number in the 20-row faction table below.

---

## 1 · Canon — the faction personality table

New canon block `ai.behavior_matrix` keyed by faction id — NOT on the faction rows (keeps
the 20 faction objects untouched; one block, one place). Shape per axis follows the
Slice-1 locked contract: `{base, spread, plasticity, floor, ceiling}`.

Also new: `rules.doctrine` (tunables, §4–§6) . Canon `meta.version` mints AFTER T-TERR-2's
v1.34 lands (version-ladder rule: queued plans sharing canon version by execution order).

### The 20 rows (authored 2026-08-10 — Daak to eyeball; every number a tunable default)

Axes: FER ferocity · CUN cunning · PRAG pragmatism · HON honor · SUP supremacism.
STYLE = derived, argmax(FER, CUN, SUP) → charger / stalker / hunter (§3).
Spread defaults to 12 unless noted; plasticity 12; floor/ceiling = base ∓/± 25 clamped
to [0,100] unless a lore bound is noted.

| faction | FER | CUN | PRAG | HON | SUP | STYLE | lore anchor |
|---|---|---|---|---|---|---|---|
| black_legion | 65 | 70 | 60 | 25 | **75** | hunter | Ascendancy through merit and murder — kill the biggest rival |
| death_guard | **55** | 45 | 35 | 40 | 45 | charger | The implacable advance; endures, all but never retreats |
| world_eaters | **95** | 25 | 10 | 30 | 40 | charger | Blood for the Blood God; FER floor 80; never runs |
| thousand_sons | 30 | **90** | 65 | 45 | 70 | stalker | Sorcery at range, patient and precise |
| emperors_children | 70 | 60 | 30 | 25 | **75** | hunter | The perfect kill — seek the worthiest target, cruelly |
| daemons | **85** | 40 | 5 | 5 | 50 | charger | The warp given claws; banishment holds no fear |
| astartes | **65** | 60 | 45 | 70 | 55 | charger | Angels of Death; HON 70 → duels leaders, spares the broken |
| militarum | 45 | **55** | 75 | 55 | 30 | stalker | Massed lasfire in ranks; pragmatic, professional withdrawals |
| mechanicus | 35 | **80** | 70 | 30 | 60 | stalker | Calculated fire solutions; flesh is expendable, engines are not |
| sororitas | **75** | 45 | 15 | 60 | 50 | charger | Faith made manifest; the line does not break |
| custodes | 70 | 75 | 35 | 80 | **80** | hunter | Ten thousand years sharp; duels the leader, ends the greatest threat |
| tyranids | **90** | 55 | 0 | 0 | 40 | charger | Biomass in, horror out; no fear, no mercy, no retreat |
| orks | **90** | 30 | 20 | 45 | 60 | charger | Da biggest an' da best; WAAAGH! straight at 'em |
| necrons | 40 | **75** | 75 | 50 | 55 | stalker | Phalanx discipline; phases out when the arithmetic sours |
| aeldari | 45 | **85** | 80 | 55 | 45 | stalker | A dying people — every life preserved, every strike surgical |
| drukhari | 55 | **90** | 75 | 5 | 45 | stalker | Executes the wounded, harvests the weak, flees a fair fight |
| tau | 25 | **80** | 70 | 60 | 35 | stalker | Kauyon patience; the Greater Good does not spend lives |
| gsc | 50 | **75** | 65 | 20 | 30 | stalker | The ambush from below; melts away when exposed |
| votann | 55 | 65 | 60 | 65 | **70** | hunter | The Kin remember every debt — the grudge names the target |
| harlequins | 60 | **88** | 55 | 70 | 40 | stalker | The dance; HON 70 → the Solitaire seeks your leader |

Style census: 7 chargers · 9 stalkers · 4 hunters — all three styles well-represented.

Note the deliberate echoes of existing canon: PRAG loosely tracks the N1
`tribute_appetite` ordering (votann/tau high, tyranids/daemons zero) without duplicating it;
the 5 placed NPCs' authored `behavior_seed` values stay untouched and override any roll.

## 2 · Instantiation — who carries the personality

- **Commander = the force's highest-PC model** (mission named bosses already are). The
  commander's personality commands the whole side.
- **Roll once, at thread seed time**: `AXES.rollFor(factionId, seedStr, canon)` → 5 values,
  each `base ± spread` clamped to `[floor, ceiling]`, from a seeded rng
  (`hashStr` of a stable id — thread id / lapse aggressor tag — same discipline as mission
  boards). Result stamped onto thread state as `state.behavior[side]` → persists with the
  save, survives reload, replays identically.
- **Placed NPCs** (the 5 with authored `behavior_seed`): their `.value`s are used directly,
  no roll. NPC-AI drift (S.npcState) continues to own long-lived placed-NPC evolution;
  combat rolls for generated NPCs do NOT write into S.npcState.
- **Commander death mid-battle changes nothing** — doctrine is the warband's ingrained
  character, stamped at seed time; a leaderless mob doesn't get smarter.
- Absent behavior (legacy threads, missing matrix row): flat 50s → charger-ish legacy
  playbook. Back-compat by construction; existing tests keep passing.

## 3 · The three styles (argmax of FER / CUN / SUP; ties break in that order)

All styles run inside the existing pure `npcTurn` loop (move free, attack via AP pool,
riders fan out, action caps, fog-honesty all unchanged). What changes is TARGETING and
MOVEMENT INTENT:

- **CHARGER (ferocity)** — target: NEAREST spotted enemy. Movement: close to melee band
  as fast as possible; prefers the highest-damage weapon that reaches (today's behavior,
  now one style of three).
- **STALKER (cunning)** — target: the spotted enemy with the FEWEST current wounds
  (focus-fire the weakest until it drops; deterministic tiebreak by id). Movement: hold at
  its best weapon's maximum band; if an enemy closes to melee, spend the move stepping
  BACK to range (kite) before firing.
- **HUNTER (supremacism)** — target: the spotted enemy with the HIGHEST PC. Movement:
  close to its best weapon's effective band against that one target; ignores closer, weaker
  targets while the big one stands.

Loudness requirement (ruling 5): each style must be visibly distinct within 1–2 posts —
verified in the E2E pass by fighting one battle per style and reading the reports.

## 4 · Conduct rule 1 — Pragmatism = when they run

- Retreat check runs at the top of the NPC side's turn (glue level, before staging):
  lost-strength fraction `L = 1 − alivePC/startPC` (side totals, stamped at seed).
- **Trigger: `L ≥ (retreat.base − PRAG) / 100`** with `rules.doctrine.retreat.base: 110`
  (tunable default). So PRAG 90 → runs at 20% losses · PRAG 50 → 60% · PRAG ≤ 10 →
  threshold ≥ 1.0 → literally never (no special case needed).
- **What retreating IS: the minted Exit-via-escape path** (ruling 4). The NPC side exits
  through the same flow a player uses: pursuit-risk ranked-speed check (current stub;
  T-ENG-3 upgrades it) — caught → the fight continues on worse ground per the minted rule;
  escaped → loser-exits, thread concludes, player wins, standard rewards for kills made.
  Pure helper `THREAD.shouldRetreat(side, state, canon)` decides; the glue calls the
  existing exit machinery. NOTHING new is invented at the thread-rule level.

## 5 · Conduct rule 2 — Honor = leaders and the wounded

Gates in `rules.doctrine.honor` `{high: 70, low: 30}` (tunable defaults):

- **HON ≥ 70:** (a) the commander MODEL overrides its style's targeting to seek the enemy
  LEADER (the player-side leader-tagged/highest-PC model) — a duel inside the battle;
  the rest of the side keeps its style. (b) The whole side refuses to attack models that
  are already Critical (the derived cond that exists in CONDS) — the broken are beneath
  their blade.
- **HON ≤ 30:** the side prioritizes Critical/most-wounded targets FIRST — deliberately
  finishing the wounded (stacks naturally with Stalker; for Charger/Hunter it reorders
  target preference only when a Critical target is spotted).
- **30 < HON < 70:** no effect.
- Interaction pin: an HON≥70 side that would have NO legal target because everything
  spotted is Critical holds fire (moves only) — mercy is mercy; it never overrides to
  attack anyway.

## 6 · Lapse-battle nudges (ULT.resolveLapse / lootOf gain a behavior argument)

Aggressor axes come from the same `AXES.rollFor` (seeded off the same aggressor tag the
N1 seed already uses) — placed-NPC aggressors use their authored seed. Each active nudge
prints ONE line in the RECORD arithmetic (ruling 6). Tunables in `rules.doctrine.lapse`:

- **Cunning → odds:** `p += (CUN − 50)/1000`, i.e. capped ±0.05 (`cun_p_per_point: 0.001`,
  cap implied by the 0–100 domain). Printed: `cunning 90 → p +0.04`.
- **Ferocity → extremes:** both outcome margins shrink as FER rises:
  `margin_shift = (FER − 50)/1000` (±0.05) applied to BOTH `loss_margin` and
  `decisive_margin` — a ferocious attacker turns wins into sackings and losses into routs
  more easily; a timid one produces muddier middles. Printed when non-zero.
- **Honor → restraint in victory:** loot multiplier `1 − max(0, HON − 50)/200`
  (floor `honor_loot_min: 0.75`) on the sack loot roll. Printed on sacked outcomes.
- Determinism unchanged: same seeds, same behavior roll, same outcome, chunk-independent.

## 7 · Visibility — none (ruling 5)

No doctrine names, no axis readouts, no UI labels anywhere — not on sheets, not in intel
panels, not in battle headers. Behavior is the only tell. (If a future sit wants earned
intel via auspex/Chronicle, that's a NEW ruling — this spec ships nothing.)

## 8 · Engine shape & build law

- **All new pure helpers live in the THREAD core** (no new region): `AXES.rollFor`,
  `doctrineOf(behavior, canon)` → `{style, honorMode, retreatAt}`, `shouldRetreat`, and
  the style-aware targeting inside `npcTurn` (new optional trailing `behavior` arg —
  absent → legacy behavior, all existing tests green).
- **ULT** gains a behavior ARGUMENT on `resolveLapse`/`lootOf` (+ printed lines) but never
  calls AXES itself — regions are standalone-extracted for tests (same law as the
  DOOR.gearTier mirror note), so the GLUE rolls behavior via THREAD.AXES and passes the
  plain object in.
- **Glue:** `npcRespond` resolves `state.behavior[side]` (stamps it if a legacy thread
  lacks it), runs the retreat check, and routes retreat into the existing exit flow.
  Thread seeding (startThread / mission accept / ultimatum lapse) stamps `state.behavior`.
- **Consumers later, not now:** N2 aggressor targeting/cadence, T-DIP-3 pact behavior —
  they read the same matrix; out of scope here.
- **Lanes:** canon (matrix + rules.doctrine, version AFTER v1.34) + 🔥 engine + tests.
  Build starts only when T-TERR-2 releases the engine lane.

## 9 · Tests (node, dev-only)

- Canon guards: 20/20 factions have complete 5-axis rows; bases within floor/ceiling;
  style census pin (7/9/4); rules.doctrine block shape.
- AXES: deterministic roll (same seed → same values), clamping, placed-seed override.
- doctrineOf: style argmax + tie order; honor gates; retreat threshold arithmetic
  (PRAG 90/50/10 cases).
- npcTurn styles: given a fixed board, charger closes on nearest / stalker kites + hits
  weakest / hunter crosses the board for the biggest PC; HON≥70 commander re-targets
  leader; HON≥70 all-Critical hold-fire pin; HON≤30 finishes wounded.
- shouldRetreat: fires exactly at threshold; never for PRAG ≤ 10.
- Lapse: cunning ±cap, ferocity margin shift both ways, honor loot floor; arith strings
  contain the nudge lines; seed replay stability.
- E2E (browser): one live battle per style, visibly distinct within 2 posts; a pragmatic
  side actually escapes via the exit flow; 0 console errors.

## 10 · Out of scope (named, deliberately)

- N2 (aggressor cadence/targeting) and N3 (Strategium) — separate slices, same matrix.
- T-DIP-3 diplomacy behavior — reads this matrix later.
- T-ENG-3 pursuit-quality upgrade — retreat uses the stub as-is.
- Placed-NPC axis DRIFT (already shipped in NPC-AI); doctrine only READS values.
- Any doctrine visibility/intel surface (ruling 5: hidden, full stop).
