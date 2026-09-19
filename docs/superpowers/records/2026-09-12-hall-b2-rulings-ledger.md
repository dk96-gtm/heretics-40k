<!-- Rulings ledger for T-SOC-1 Hall slice B2, kept verbatim from the build session (subagent-driven-development, 2026-09-12).
     Every decision taken on Daak's behalf during the build is recorded here as "Ruling N" with what it costs if wrong.
     Commit hashes cited below refer to the ORIGINAL build commits; the pushed branch hall-b2 carries cherry-picked copies
     of the same code, verified byte-identical for index.html, the canon and tests. -->

# SDD ledger — plan: docs/superpowers/plans/2026-09-08-hall-slice-b2-contests-hall-law.md

Spec: docs/superpowers/specs/2026-09-06-social-door-design.md (§4, §6, §13) — reachable.
Branch: status-alpha-dev-recap (isolated orca worktree; main checkout is a separate worktree on `main`).
Baseline: node --test → 749 tests, 749 pass, 0 fail. Canon meta.version = 1.40 → bump to 1.41 in Task 1.
Claim commit: 832f8af (backlog: claim T-SOC-1 B2).

## Pre-flight conflict scan

### Cross-task pairs sharing a file or interface

| A → B | A produces | B consumes | Finding |
|---|---|---|---|
| T1 → T2,3,4,5,6,7 | canon `rules.hall.contest/law/champion` + per-skin `contest`/`hall_law` | all readers | OK — additive keys, no key reused for two meanings |
| T2 → T3 | `contestOf` | `lawPenalty` calls `contestOf` | OK — same region, T3 lands after T2 |
| T2 → T4 | `contestOf/wagerFor/matchResolve` | `hallMatch`, `hallWagerFor` | OK |
| T3 → T6 | `lawPenalty/barCheck` | `hallStrike`, barred gate | OK |
| **T4 → T5** | `hallContest` dispatches to `hallBout` | `hallBout` only exists after T5 | **CONFLICT — forward reference.** See Ruling 1. |
| T4 → T7 | Champion row `_ctl` block | T7 appends Train button + TITLE label into the same `_ctl` | OK — strictly append, T7 after T4 |
| T5 → T7 | `hallBout`, `t.hall`, `concludeThread` hall block | T7 rewrites the wager line, adds `title:`, extends the conclude block | OK — sequential; T7 brief must quote T5's landed shapes |
| T5 → T7 | player-combatant build loop in `hallBout` | T7 adds the training-buff consumer to it AND to `seedCombat` | OK |
| T6 → T7 | `S.social.bar` seeded at both sites | T7 adds `S.social.train` at the same two sites | OK — same two sites, second edit is additive |
| T6 → T7 | barred `else` wrapper around the whole hall render | T7's controls live inside it | OK |
| T1..T7 → T8 | everything | GLOSS/docs/backlog close-out | OK |

### Per-task self-agreement

| Task | Tests vs code it specifies | Files created vs later touched | Finding |
|---|---|---|---|
| T1 | canon pins ↔ authored JSON; `wagered_rung_min:1` asserted `=== 1` and authored `1` | canon + canon-hall.test.js; 8 version pins swept | OK. `rungs.length === 4` pin depends on B1 canon — verified live below |
| T2 | 7 pins ↔ `matchResolve`; both rolls drawn unconditionally so the stream is cheat-stable | index.html region + hall-core.test.js | OK |
| T3 | 3 pins ↔ 3 helpers | same two files | OK |
| T4 | no unit tests (glue only) + browser E2E | index.html only | OK — E2E is the gate; plan says so explicitly |
| T5 | 2 thread-core pins ↔ 3 core edits | index.html + thread-core.test.js | OK — pin shapes must be verified against the file's live `apply` idiom |
| T6 | no unit tests (T3 pinned the pure half) + E2E | index.html only | OK |
| T7 | 2 pins ↔ 2 helpers; glue E2E'd | index.html + hall-core.test.js | OK |
| T8 | no tests; full green-gate + light re-check | index.html, CLAUDE.md, BACKLOG.md | OK |

Live-symbol verification (all present in index.html): `rungOf`, `hallTrustRecord`, `hallCtxOf`,
`hallAxesOf`, `hallCommuneReg`, `genHostCombatants`, `condDur`, `concludeThread`,
`manualRestore`, `regularsAt`, `SEAT.moveStanding`, `SEAT.standingName`, `WORLD.dayIndexAt`,
`CHRON.record`. `.superpowers/` is git-ignored.

## Rulings (pre-flight)

Ruling 1 — **T4's forward reference to `hallBout` stands as the plan wrote it.** `hallContest`
dispatches `resolver==='brawl'` to `hallBout`, which Task 5 lands. Between the two commits a
brawl-culture Hall's contest button would throw a ReferenceError. Accepted rather than adding a
`typeof` guard Task 5 would immediately delete: the two commits are one slice on one unpushed
branch, nothing ships between them, and T4's own E2E is specified on a *match* culture
(militarum). Task 4's reviewer is told this is plan-mandated and expected, not hidden from it.
Cost if wrong: a dead button for the length of one commit on an unpushed branch — zero user impact.

Ruling 2 — **`git add -p` is replaced by path-scoped `git add <path>` + a pre-commit
`git status --short` check.** The plan's Global Constraints mandate `git add -p` on shared files
because CLAUDE.md's multi-agent rules assume every agent shares ONE working folder. That is not
this session's situation: this is an isolated git worktree on its own branch
(`status-alpha-dev-recap`), the main checkout is a separate worktree with its own index, and the
one parallel session touches `docs/` only. `git add -p` is also interactive and cannot be driven
by a subagent's Bash tool at all, so leaving it in the briefs guarantees an improvised
workaround. Every implementer instead runs `git status --short` immediately before committing,
stops if anything green is not theirs, and commits path-scoped (`git commit <paths> -m …`), which
ignores the rest of the index. This preserves the constraint's actual intent (never sweep a peer's
work) with a mechanism that works here. Cost if wrong: if another session did edit these exact
files in this exact worktree, a whole-file `git add` could sweep its unstaged hunks — the
`git status --short` gate is what catches that, and the post-commit leak grep is the backstop.

Ruling 3 — **the leak check `git show HEAD | grep -c "brain\|npc_kit\|enumeratePairs"` is read as
a diff-line check, not a raw count.** `grep -c` exits 1 on zero matches (so it must not sit in an
`&&` chain), and Task 1 edits `rules.hall`, which may sit adjacent to `rules.npc_kit` in the canon
JSON — unchanged *context* lines would then match and print a false alarm. Implementers count only
matches on `+`/`-` diff lines. Cost if wrong: a false alarm costs one inspection; a missed real
leak is caught again at the final whole-branch review.

## Progress

Ruling 4 (spec-vs-plan, found reading spec §6 while Task 1 ran) — **the title fight's
"hall-wide disposition up" is deferred to Slice C with a recorded reason, not silently dropped.**
Spec §6 lists three payoffs for the CHAMPION rung-④ title fight: a chronicle record, hall-wide
disposition up, and a ruling-faction standing +1 notch. The plan's Task 7 implements the first
and third and never mentions the second. It is not implementable against Slice A's patron model:
`S.social.pat` is keyed `hallPatKey = locId + '/' + patron.name`, and the patron pool is
re-generated deterministically per (day, phase) by `HALL.patronsAt`, so a disposition bump
applied to tonight's named crowd evaporates when tomorrow's crowd is drawn. Doing it properly
needs a location-level "hall cred" field that neither the plan, the canon, nor Slice A has, and
minting one would drag B2 into rewriting Slice A's offer/commune disposition reads — scope B2 is
not chartered for. The spec's own design law for rung ④ ("never a bigger discount — always a
bridge into another system") is satisfied by the two payoffs that DO ship: the Chronicle and the
standing ledger. Task 8's hand-off records it as a third open question for Daak.
Cost if wrong: the title fight feels slightly thinner than §6 promises until Slice C mints a
location-level cred field; no mechanic is broken and nothing downstream depends on it.

Ruling 5 (verification, not a change) — **Task 5's flagged `hallTrustRecord` risk is clear.**
The plan warns that `concludeThread` passes a deliberately minimal `{ctx:{locId,fac,day}}` and
tells the implementer to verify the function has not grown to read more of `ctx`. Verified live
at `index.html:hallTrustRecord`: it reads `hc.ctx.locId`, `hc.ctx.fac` (via `hallAxesOf` and
`HALL.rungOf`/`judgeAct`, both of which read only `ctx.fac`) and `hc.ctx.day`. The minimal
object is sufficient; no extension of `t.hall` is needed. Carried into Task 5's dispatch.

Task 1: implementer DONE — commit 7a9d064, canon 1.40 → 1.41, 753/753 passing (749 baseline + 4
new canon pins). Leak check clean (only `---`/`+++` filename headers matched, per Ruling 3).
Diff touches 9 files: the canon JSON + the 8 version-pin test files. No engine change.
Task 1: review dispatched (sonnet) against 832f8af..7a9d064.
Task 1: review clean — ✅ spec compliant, 0 Critical, 0 Important, 3 Minor. Reviewer verified
all 20 rows individually, the 8/12 split, orks-only lawless, all three new blocks, and that the
8 version-pin sweeps changed only the version literal in each file.
Task 1: minor (deferred): canon-hall.test.js champion pin asserts `typeof train.tag === 'string'`
  rather than `=== 'Rally'` — plan-inherited test text, a wrong tag would pass.
Task 1: minor (deferred): implementer added a `meta.notes` changelog line + bumped `meta.updated`
  beyond the brief's literal ask — confined to `meta`, matches the file's own per-bump convention.
Task 1: minor (deferred): wager-ladder pin checks tier3 > tier1 but not tier2 strictly between.
Task 1: complete (commits 832f8af..7a9d064, review clean)
Task 2: dispatched (sonnet), BASE 7a9d064.

Task 2: BLOCKED on first attempt — implementer transcribed the brief's code and tests
byte-for-byte, 760/761 green, one pin failing: `cheatWins > honestWins` over 200 draws.
Escalated correctly rather than guessing; left the work uncommitted per the green gate.

Ruling 6 — **the plan's test is underpowered; the canon and the algorithm both stand.**
I measured the live core myself (scratch probe, 5000 draws + a sweep of every 200-draw window):
  honest net win rate 2203/5000 = 44.1%   (canon base_win 0.45)
  cheat  net win rate 2460/5000 = 49.2%   (0.75 raw, minus a 35% catch that voids the win)
  cunning culture     2735/5000 = 54.7%, caught 1346 vs 1705 — the relief curve works
The true effect is real but SMALL: +5 points of net win rate. At n=200 the standard error on
that comparison is larger than the effect, and a sweep of 1000 consecutive 200-draw windows
fails the assertion in **205 of them (20.5%)**. The brief's window (day 100..299) is simply one
of the 20% — not a fluke to be dodged by moving the window, and not an implementation bug.
Rejected: raising `cheat_shift` / lowering `catch_base` (Task 1's canon is reviewed, committed,
and these are spec §13 flagged tunables — silently retuning balance to make a test pass is
exactly backwards); re-seeding `roll`/`catchRoll` apart (the shared stream is a deliberate
design property — the bout must replay identically whether or not the player cheats — and the
pairing it creates REDUCES variance, it is not the cause).
Decided: amend the test to assert the same claim with enough power, and to assert the
mechanism deterministically as well —
  (a) raise that one loop to n=2000. Measured: 0 failing windows in 200 consecutive 2000-draw
      windows (n=1000 still fails 10/400, n=500 fails 69/800 — 2000 is the first safe rung).
  (b) add a sample-free structural invariant to the same pin: for the same day and nonce, a
      cheat NEVER loses a match the honest player would have won — its only worse outcome is
      being caught (`honest.won` implies `cheat.won || cheat.caught`). Verified true on every
      window probed. This is what "cheating raises the win rate" actually means mechanically,
      and it cannot go flaky.
  (c) leave every other pin alone — the cunning-relief pin is robust at n=200 (0 failures in
      1000 windows).
Cost if wrong: the amended pin asserts a weaker statistical claim than a larger sample would;
the added invariant is exact, so a real regression in the cheat shift still fails the suite.

Balance observation for Daak (Task 8 hand-off): with the authored numbers, cheating buys only
~5 points of net win rate (49% vs 45%) while risking a 35% catch that costs trust. Cheating is
therefore a SOCIAL gamble — worth it only where the culture's judge rewards `cheat_clean` — not
an odds gamble. That may be exactly the intent; it is Daak's call, and it is now measured.
Task 2: fix round 1/5 (ruling applied: pin n 200→2000 + deterministic invariant + why-comment;
  no index.html or canon change) — commit 629ecdd, 761/761 passing, leak grep clean.
Task 2: review dispatched (sonnet) against 7a9d064..629ecdd.
Task 2: review clean — ✅ spec compliant, 0 Critical, 0 Important, 2 Minor. Reviewer independently
re-derived the added invariant as mathematically forced by the implementation (shared seed ⇒
identical roll pair; cheat_shift ≥ 0 ⇒ a cheat can only fail to win by being caught) and confirmed
it is load-bearing, not tautological. Purity + ES5 verified in the new hunk.
Task 2: minor (deferred): the why-comment above the amended pin is 4 lines, not literally one.
Task 2: minor (deferred): `CN` helper name is terse and visually close to the region's `H`/`T_`
  helpers — brief-verbatim, worth a rename to `contestCanon` in a future pass.
Task 2: complete (commits 7a9d064..629ecdd, review clean)
Task 3: dispatched (sonnet), BASE 629ecdd.
Task 3: review clean — ✅ spec compliant, 0 Critical, 0 Important, 0 Minor. Boundary semantics
(`until > day`, not `>=`) verified; null/absent-ledger paths pinned; purity + ES5 verified.
Task 3: complete (commits 629ecdd..940e250, review clean)

Controller scouting for the UI tasks (saves every E2E agent the same hunt):
- 16 location types carry a `hall` door; 156 hall-bearing locations exist across the galaxy.
- A **MATCH** culture destination: planet `cadmus` (Cadmus Prime), location `cadmusthrone`
  ("The Marshal's Bastion", type `crown`), ruler "Astra Militarum" → contest "Dice at the Mess".
- A **BRAWL** culture destination: planet `skallaxp` (Skallax), location `skullthrone`
  (type `crown`), ruler "World Eaters" → contest "Skullpit bout".
- Galaxy stores a ruler as its DISPLAY NAME ("Astra Militarum"), not the canon id ("militarum");
  `hallCtxOf` does the mapping.
- Port 8765 is free. GLOSS object opens at index.html:7682 and closes at :7752 (`'Trust':…};`).
- Line numbers in the plan have drifted by ~+73 since Tasks 2-3 added to the hall-core region —
  every dispatch tells implementers to locate by symbol, never by the plan's line numbers.
Task 4: dispatched (sonnet), BASE 940e250.
Task 4: implementer DONE — commit 559c61e, 764/764 unchanged, E2E passed on Cadmus Prime
(Astra Militarum / match resolver): contest button label + (no stake) at STRANGER, wager shown
at KNOWN, cheat path moved currency by exactly the wager, second bout drew its own result,
7 screens + title swept with 0 console errors. Deliberate `hallBout` forward reference left
unguarded per Ruling 1.
Task 4: minor (deferred, ASSIGNED TO TASK 8): the loss line reads "the <name> takes it" but the
authored regular names already begin with "the", so it renders a doubled article. The template
is brief-verbatim. Task 8 is the copy/GLOSS sweep — fixing it there keeps it out of the review
loop and out of Task 5/6/7's diffs.
Task 4: review dispatched (sonnet) against 940e250..559c61e.
Task 4: review ❌ — 1 Important (plan-mandated), 3 Minor. Reviewer judged the E2E transcript
credible (it reproduces the non-obvious null-act tally detail correctly) but correctly noted it
never exercised the one sequence that breaks: two consecutive same-mode cheat clicks where the
first lands in the null-act state.

Ruling 7 — **the nonce defect is real and gets fixed; the brief's derivation is wrong.**
The finding: `hallMatch` derives `matchResolve`'s nonce by summing the four JUDGED act tallies
(`win + noble_loss + cheat_clean + cheat_caught`). But `matchResolve` deliberately returns
`act:null` for an uncaught cheat that also lost — nobody saw it and nobody won, so there is
nothing to judge — and `hallTrustRecord` (the only thing that increments `rec.acts`) is skipped
on that path. The counter therefore does not move. Since `matchResolve`'s seed depends only on
`seedBase`, `locId`, `day` and `nonce` — NOT on the cheat flag, by design — the next same-mode
click that day recomputes an identical nonce and deterministically replays the identical loss,
forever, until the player happens to click the other mode. That directly contradicts the
comment sitting above the code ("a rematch after a resolved bout draws again") and the plan's
own "one bout, one draw" contract. The code is brief-verbatim, so this is a plan defect, not an
implementer error — which is exactly why it is mine to rule on rather than to dismiss.
Decided: count BOUTS, not judged acts. Add `rec.bouts`, incremented unconditionally in
`hallMatch` before the resolve, and derive the nonce from it. Chose a new `rec.bouts` field over
the reviewer's suggested `rec.acts.attempt` so that `rec.acts` stays purely the judged-act
ledger that `HALL.judgeAct` and the trust display reason about — a phantom "attempt" act inside
that map would be a second, subtler defect. `rec.bouts` is persisted with the rest of
`S.social.reg`, so the reload-does-not-re-roll property the brief wanted is preserved (and
strengthened: it now holds on the null-act path too). Absent on existing saves → `undefined`,
reads as 0, first bout becomes 1 — backwards compatible with no migration.
Cost if wrong: the per-regular record carries one extra integer field.
Task 4: minor (deferred, ASSIGNED TO TASK 8): GLOSS 'Contest' entry starts lowercase while every
  other GLOSS entry is capitalised — brief-verbatim.
Task 4: minor (deferred, not worth a change): `contestOf`/`hallWagerFor` are computed for every
  regular row though only the champion row uses them — two pure lookups per row, brief-verbatim.
Task 4: fix round 1/5 (1 addressed, 0 open — nonce now counts bouts not judged acts; commits
  559c61e..b7b52b8). Re-review: ADDRESSED, no new breakage, no out-of-scope observations.
  Implementer reproduced the OLD frozen-seed behaviour first, then showed bouts 1→2 and the
  outcome changing — evidence of the defect AND of the fix.
Task 4: complete (commits 940e250..b7b52b8, review clean after 1 fix round)

Ruling 8 — **the YIELD rule: a non-lethal bout needs a win condition, and the plan has none.**
Found before dispatching Task 5, by tracing how a SKIRMISH actually reaches an outcome.
The defect: `THREAD`'s outcome derivation (index.html:1021-1030) ends a SKIRMISH only when one
side has no combatant left that is `!dead && !captured` — annihilation, or mutual ruin. Task 5's
whole design is `state.nonLethal`, which floors EVERY hit at 1 wound so nobody ever dies. Follow
that through:
  · nobody dies → both parties always have a live member → `outcomeOf` returns null forever.
  · `captured` cannot substitute: it needs a Capture-tagged item equipped, the target at exactly
    1 wound and in melee (index.html:712-722) — rare gear — and it is thematically wrong anyway
    (you do not take the house Champion prisoner after a sanctioned bout; it mints a CAPTIVE
    item, credits a kill, and flips the model's roster status).
  · NPC withdrawal cannot substitute: `shouldRetreat` measures PC *lost*, and lost PC counts
    dead/captured models only (index.html:1333) — under nonLethal it is permanently 0, so a
    fleeing NPC never flees.
  · That leaves the player's own Exit, which is a flight, not a win.
So Task 5 as planned would ship a bout you can enter and never finish, and a
`concludeThread` hall-settlement hook that can never fire. Task 7's title fight builds directly
on that hook, so this is load-bearing, not cosmetic.
Decided: add `c.yielded`, a third off-the-field flag beside `dead` and `captured`, scoped to
non-lethal threads. In `apply`'s damage branch, when `state.nonLethal` is in force and a hit
actually lands (`taken > 0`) leaving the target at 1 wound, set `c.yielded = true` — the fighter
goes down but lives. Then treat `yielded` as off-the-field exactly where `dead||captured`
already means off-the-field: the outcome derivation's alive test, `validate`'s attack/target
gate, and `spottedEnemies` (that last one specifically because T-NPC-3.5 already shipped a bug
of this exact class — a corpse that stayed "spotted" forever stalled `npcTurn` — and a lingering
yielded model is the same hazard). Nothing else changes: no CAPTIVE item, no kill credit, no
revival window, no permadeath, no roster status. A yielded model is out of THIS bout and nothing
more. Annihilation then fires when every fighter on one side has yielded, the thread concludes
with a real victor, and the hall hook runs.
Why a yield and not something else: the spec calls BRAWL "a real non-lethal fight" and names the
cultures' versions (Skullpit bout, cage spar, a proppa scrap). A pit fight ends when someone
goes down. Yield is the verb the fiction already uses, and it is the smallest change that makes
the shipped outcome machinery work unmodified.
Cost if wrong: a new flag on combatants inside non-lethal threads only, and one extra condition
in three hot-core predicates. If Daak wants a different win condition (first blood, a round
limit, a best-of-three), the yield rule is one `apply` branch to replace — the rest of the slice
does not depend on which rule it is, only that one exists. Surfaced to Daak in Task 8's
open-questions hand-off and in the final rulings list.
Task 5: dispatched (sonnet), BASE b7b52b8, with Ruling 8 folded into its core commit.
Task 5: implementer DONE — commits a693e64 (core: thread-level nonLethal + Ruling 8 YIELD, with
tests) and 39dab9b (glue: hallBout + concludeThread hall hook). 770/770 passing (764 + 6 new),
NO existing pin moved. E2E fought two live bouts (no-stake and 25-stake) on Skallax: Champion
floored at 1 wound, never dead, `yielded` set, thread concluded by annihilation, THE HALL post
rendered, wager 64→39 at call and 39→89 doubled on the win, rung moved, 0 console errors across
7 screens + title + battlefield sandbox.
Controller verification: `git log b7b52b8..HEAD` shows exactly those 2 commits; working tree holds
only the 5 pre-existing untracked files; `node --test` re-run by me → 770/770, 0 fail.
Task 5: implementer reported a "stray agent" it spawned and stopped (noop, no action). The
no-subagents contract was in its dispatch. Logged; no commits or file changes trace to it.
Task 5: implementer disclosed two E2E shortcuts (direct position-set instead of click-walking to
melee; yielded-target rejection confirmed by unit test not a live click) and one pre-existing
wallet-HUD render lag shared with the MISSION payout branch. All three carried into the review.
Task 5: review dispatched (opus — highest-risk diff in the plan, hot THREAD core) b7b52b8..39dab9b.
Task 5: review ❌ — 1 Critical, 3 Important, 5 Minor, 2 ⚠. The reviewer confirmed Ruling 8 does
NOT leak into corpse/revival/kill/capture semantics (it enumerated 16 `dead`/`captured` sites and
verdicted each) but found the rule UNDER-scoped and found the bout inheriting consequences it
should not. Rulings 9-12 below; then fix round 1.

Ruling 9 — **a sanctioned bout settles socially ONLY; suppress both generic SKIRMISH
consequences.** (Reviewer Critical 1.) `concludeThread` applies `thread_scales.Skirmish.effect`
= `{conflict:5}` to the sector on every conclusion, and calls `tickStreaksAndSync` unconditionally.
A bout is a plain `type:'SKIRMISH'`, so both fire. Consequences: (a) every concluded bout adds +5
sector Conflict permanently and repeatably, and Conflict drives the N2 aggressor cadence
(`p=clamp(Conflict/400,…)`) — grinding pit fights would measurably raise real NPC war frequency;
(b) `streakResultOf` reports combat/won/enemyNamed/oneVsOne, bumping `combat_wins`/`duel_wins`/
`named_duel_wins` from a repeatable low-risk contest, and — worse — `enemyWiped` reads
`_enemyAliveCount===0`, which counts `!dead&&!captured` and therefore still counts the YIELDED
Champion as alive, so `isWipeWin` is false and a bout you WON resets a live `annihilations`
streak to 0. That last one is a straight regression to a shipped mission mechanic.
Decided: guard BOTH on `t.hall`. A bout moves no war meter and no mission streak. Rejected the
reviewer's alternative of letting it count toward `duel_wins`: a social contest inside bound
ground is not a war action, and crediting it would be a new design choice inherited by accident
rather than chosen. If Daak wants duel credit it is a one-line explicit addition later.
Cost if wrong: bouts contribute nothing to duel-flavoured mission streaks until someone asks.

Ruling 10 — **the non-lethal floor must be total: a DoT may not kill in a bout.** (Important 1.)
`tickConds` floors a damage-over-time tick only on the per-instance `inst.nl` carrier and never
consults `state.nonLethal`, so an ordinary DoT — player-staged, or from the named Champion's own
minted kit — ticks a fighter to 0 and runs the full kill path: `stampKill`, revival window (or
permadeath on a `no_revival` source), `trackKill`, `creditWeaponKill`, and then `concludeThread`
writes `m.st='DEAD'` on the roster. A player can permanently lose a model in a contest whose
entire premise is that nobody dies. This also undercuts Ruling 8's own reasoning, which assumed
nothing can die under nonLethal.
Decided: floor the DoT tick on `inst.nl||state.nonLethal`, set `yielded` when a DoT tick lands a
fighter at 1 wound (otherwise a bout could be won on wounds with no yield ever recorded), and
mirror the floor in `npcExpDamage`'s DoT accumulation loop — the base-damage mirror was added,
the DoT half of the same function was not, and an unmirrored brain silently mis-scores its own
actions. Add a pin that passes `party` so `tickConds` actually runs; every existing new pin omits
it, which is exactly why this slipped through a green suite.
Cost if wrong: none identified — this restores the invariant the feature already claims.

Ruling 11 — **filter `npcTurn`'s raw `spotted` too; my Ruling 8 named one consumer of two.**
(Important 2.) Ruling 8 cited "spottedEnemies' consumers" at the `enumeratePairs` site only. The
other consumer is `npcTurn` itself — the one that picks targets. Unfiltered: a yielded fighter
keeps `spotted.length` non-zero so the NPC never correctly holds; `isCrit` is `w[0]<=1` so a
yielded model is ALWAYS Critical, collapsing the candidate pool onto it under low-honor conduct
and under the `culling` style; then action selection finds no matching pair (because
`enumeratePairs` IS filtered) and the NPC attacks nobody for the rest of the bout while untouched
models stand there. This is precisely the T-NPC-3.5 corpse-stall class the ruling cited and then
failed to close. My scoping error, not the implementer's — they were faithful to the citation.
Decided: filter at the `npcTurn` site. Do NOT move the filter inside `spottedEnemies` itself —
that would also blank the downed fighter from the fog render, and you should still see them lying
on the board. Cost if wrong: none; it restores intended behaviour.

Ruling 12 — **a duel is 1v1: field the leader alone, not the whole force.** (Reviewer ⚠ 2.)
The brief's prose says "a non-lethal 1v1 against the Champion by name", its own E2E asserts
exactly ONE hostile, spec §4 routes BRAWL through "existing duel … machinery", and the code
already hardcodes `mineCount` to 1 when sizing the enemy side. But the brief's Step-6 body copies
`seedCombat`'s idiom and fields EVERY model in the player's force — so what ships is N-vs-1: you
bring a squad to a one-on-one contest, which is both thematically wrong for bound ground and
mechanically trivial. Every other signal in the spec, the brief and the code says duel.
Decided: field only the active model (which `hallBout` already requires to be the force's leader).
Keep the Force requirement — it supplies the party, the AP pool and the idle/stationed locks.
Side effect worth noting: this makes reviewer Minors 2 and 3 (a yielded model can still act; a
yielded model is still a Cleanse/Rally recipient) essentially unreachable, because in a 1v1 the
outcome fires the instant either fighter yields. Both are deferred on that basis.
Cost if wrong: a player who wanted to bring the whole squad cannot; one filter line to revert.

Task 5: minor (deferred): a yielded model has no actor-liveness gate in `validate` — exactly
  symmetric with `dead`, which is equally ungated and relies on the UI. Pre-existing symmetry,
  and unreachable in a 1v1 after Ruling 12.
Task 5: minor (deferred): a yielded model is still a legal Cleanse/Rally recipient
  (`cleanseReach` counts `!dead&&!captured`). Unreachable in a 1v1 after Ruling 12.
Task 5: ⚠ noted, no code change: the brief's leak-check gate
  `git show HEAD | grep -c "brain|npc_kit|enumeratePairs"` must print 0, but Ruling 8 legitimately
  edits `enumeratePairs`, so the core commit prints 1. The gate predates the ruling and is stale;
  the substantive check (did another session's work ride along) is unaffected. Every remaining
  dispatch keeps the `^[+-]` form, which reads changed lines only.
Task 5: fix round 1/5 (6 addressed, 0 open; commits 39dab9b..05d46dc, 780/780, no existing pin
moved). Re-reviewer verified each fix at file:line, confirmed the `npcTurn` filter landed at the
npcTurn site and NOT inside `spottedEnemies` (so the fog render still shows a downed fighter),
confirmed the new pins are non-vacuous (the party-passing pin genuinely exercises `tickConds`;
the scorePair pin could not have held before the fix), and traced all six new `state.nonLethal`
reads to confirm a pre-field save deserializes to `undefined` and is falsy at every one.

Ruling 13 — **extend Ruling 9 to the Chronicle: a bout writes no war record.** The re-reviewer,
told to look for the same bug class elsewhere, found a THIRD generic-SKIRMISH consequence that
Ruling 9's two-item list missed. `hallBout` stamps `pl` and `lid` on the thread, and
`CHRON.record` is gated only on `t.pl && t.lid && oc.victor` — so every concluded bout appends a
`kind:'thread'` record with a war outcome (`repelled`/`sacked`) to `S.world.chronicle[lid]`.
Those records are precisely what N2 injects into NPCs as `'This ground remembers: …'` fact lines,
so pit fights would read back to every NPC at that location as battles fought over the Hall's
ground — and the Chronicle is persisted, player-visible world state.
Decided: guard it on `t.hall` like the other two. Rejected minting a `kind:'bout'` record instead:
`CHRON.titleOf` keys its title table off the war outcomes, so a bout kind is a CHRON + canon
change, and Task 7's own brief already rules that class of change belongs in its own task.
I am deliberately extending the fix loop for a finding the re-reviewer filed as a non-blocking
out-of-scope Minor, because it is not Minor — it is the same defect as the Critical, in a third
place, writing to persisted state that other systems quote. A one-line guard now is cheaper than
letting the final review triage it.
Cost if wrong: a hall's bouts leave no trace in the location's Chronicle until someone designs a
bout record. Recorded as an open question for Daak in Task 8's hand-off.
Task 5: fix round 2 dispatched — Ruling 13 (Chronicle guard) + the DoT-half yield asymmetry at
  index.html:1247 (a fighter entering at 1 wound and only DoT-ticked never yields — the same gap
  ❻ just closed in `apply`, left in the DoT half) + the cosmetic indent at index.html:717.
Task 5: fix round 2/5 (3 addressed, 0 open; commits 05d46dc..ec39b5d, 781/781, no existing pin
moved). Re-reviewer confirmed the Chronicle guard wraps ONLY the `CHRON.record` call (the log
unshift, `_ultRestoreCond` and `npcCapture` all sit outside it and still run for non-bout
threads), that `_dotRealHit` is read only inside the `state.nonLethal` guard so lethal threads
are untouched, and hand-traced the DoT repro to confirm the new pin is non-vacuous. The
implementer proved the Chronicle guard by CONTRAST (synthetic non-hall thread → 1 record; real
bout → 0 records), not by asserting absence.
Task 5: complete (commits b7b52b8..ec39b5d, review clean after 2 fix rounds)
Task 6: implementer DONE — commit 8f412db, 781/781 unchanged. E2E all 6 checks live: lawful
strike drops standing exactly -1 and bars 5 days; barred hall renders notice-only; counter reads
down 5→4 and expires at day 40 (the `until===day` boundary holds); Ork hall shows "Start
somethin'" and routes into a real hallBout with zero standing/bar change; 0 console errors across
7 screens + title.
Task 6: review dispatched (sonnet) ec39b5d..8f412db.
Task 6: review clean — ✅ spec compliant, 0 Critical, 0 Important, 2 Minor. The reviewer did the
brace check properly: it read the LIVE file rather than the diff (whose unindented context lines
would have misled it) and traced every brace from `else if(kind==='hall'){` through to the next
`else if(kind==='warp_gate'){`, confirming exactly one `}` was added, nested where specified, and
that no pre-existing closing brace moved. It also cross-checked the E2E's numbers against the
formulas (bar written as day 35 + 5 = 40; `until>day` giving left-4 at day 36 and unbarred at
day 40) and judged them formula-consistent rather than asserted.
Task 6: minor (deferred, ASSIGNED TO TASK 8): the wrapped B1 render body kept its original 3-space
  indent though it now sits one brace level deeper — cosmetic, verified not to affect parsing.
Task 6: minor (deferred): `HALL.contestOf(...).hallLaw` is recomputed once per patron row inside
  `pats.map`; could hoist to a single `cul.hall_law!==false` read. Harmless and pure.
Task 6: complete (commits ec39b5d..8f412db, review clean)

Ruling 14 — **the title fight writes NO Chronicle record; the standing notch and the post ship.**
Found while preparing Task 7: its Step 6 calls `CHRON.record` for a title win, which collides
head-on with Ruling 13 (a bout writes no war record). I checked whether the collision is real by
reading the narrator. It is. `CHRON.titleOf` keys a war-title table (the brief's own
`outcome:'repelled'` yields "The Defense of <loc>" — simply wrong for taking a title), and
`CHRON.account` renders EVERY record from one siege-prose pool: "came out of the void without
herald or parley", "the dead stacked for barricades", "fell back street by street". Its outcome
lookups degrade gracefully (`CLOSE[rec.outcome]||CLOSE.drama`, `TITLES[...]||'The Clash at '`),
so an invented `outcome:'title'` would not crash — but it would still narrate a hall title fight
as a siege. And per CLAUDE.md, N2 injects a location's last 3 chronicle records into every NPC
there as `'This ground remembers: …'` fact lines carrying the FULL reconstructed `account`
narrative. So a title record would make every NPC at that Hall recite a fabricated siege —
exactly the defect Ruling 13 just removed, one tier rarer.
Decided: do not write the record. Ship spec §6's other title payoff (the ruling-faction standing
notch) and THE HALL post, and defer the record until a `bout`/`title` record KIND exists with its
own hall-voiced narrative lines — a CHRON + canon change the plan's own Task 7 brief explicitly
fences into its own task ("If a dedicated title key is wanted, that is a canon/CHRON change and
belongs in its own task, not here").
Rejected: shipping it with `outcome:'repelled'` as the brief says (wrong title AND siege prose
in NPC mouths); shipping it with `outcome:'title'` (neutral title, but still siege prose).
Note this does NOT weaken spec §6's design law that rung ④ "is never a bigger discount — always a
bridge into another system": the standing ledger IS that other system, and the bridge holds.
Cost if wrong: a title win leaves no galaxy-visible trace until the record kind is designed. The
player still sees the moment (THE HALL post) and still gets the mechanical payoff (standing).
Carried to Daak in Task 8's hand-off with the concrete proposal.
Task 7: dispatched (sonnet), BASE 8f412db, carrying Rulings 12 and 14.
Task 7: implementer DONE_WITH_CONCERNS — commit 3c6b631, 783/783 (781 + 2 new pins, no existing
pin moved). E2E: Train buy/consume/lapse verified at Cadmus (MATCH); title fight
stake/win/standing-notch/NO-Chronicle verified at Skallax (BRAWL); 0 console errors over 8 screens.
The concern, and it is a real one: the brief wires the title stake and payoff ONLY into
`hallBout`/`concludeThread` — never into `hallMatch`, which is a structurally different
instant-resolve path. The implementer therefore gated the TITLE FIGHT label to brawl cultures so
the button could not promise a payoff it cannot deliver. Correct call, but it leaves the 12
MATCH-resolver cultures with a visibly dead rung ④.

Ruling 15 — **the title fight ships for all 20 cultures; extend it to the MATCH resolver.**
Spec §6 gives CHAMPION rung ④ "the title fight" unconditionally — it is not a brawl-only unlock,
and 8-of-20 coverage is a hole, not a slice boundary. The plan's Task 7 simply never looked at
`hallMatch`. The symmetric implementation is small because `hallMatch` already owns the wager,
the payout and the act: detect the title gate, multiply the stake by the canon `stake_mult`,
and on a win apply the same ruling-faction `standing_notch` plus a title line in the outcome.
Design law holds identically — spec §6 says rung ④ "is never a bigger discount, always a bridge
into another system", and the standing ledger is that system on both paths.
Two sub-decisions made with it: (a) a CLEAN CHEAT that wins DOES take the title — no special
case, just gate on `res.won`, which is already false for a caught cheat because the forfeit voids
the win. Taking a culture's title by a deception it never detected is precisely what a cunning
culture's judge already rewards, and inventing an exception would contradict B1's own judge.
(b) Ruling 14 applies to this path too — no Chronicle record on either resolver.
Rejected: accepting brawl-only and flagging it. BACKLOG.md's BUILD LAW is explicit that features
extend shipped systems without leaving debt, and a dead top rung visible to 12 of 20 cultures is
exactly the debt that law exists to prevent.
Cost if wrong: `hallMatch` grows a title branch. If Daak later decides a title should only ever
be taken in a fight, it is one gate to re-narrow.
Task 7: fix round 1 dispatched — Ruling 15 (title fight on the MATCH path + ungate the label).
Task 7: review clean — ✅ spec compliant, 0 Critical, 0 Important, 4 Minor. Reviewer verified all
three rulings were followed at file:line and judged the rulings themselves sound. Notable: it
found that the implementer's re-derived placement for the training consumer (Ruling 12) is
BETTER than the brief's stale snippet would have produced — `hallBout`'s `if(!g.specs.length)`
early return sits between the old snippet's location and the host merge, so the literal
placement would have silently burned a paid-for buff whenever the host draw failed. It also
confirmed `matchResolve` sets `won=false` whenever `caught` is true, so gating the title on
`res.won` alone correctly excludes a caught cheat and includes a clean one, exactly as Ruling 15
specified, with no special case needed.
Task 7: ⚠ RESOLVED by controller (the reviewer could not judge it from the diff): "can
`concludeThread` run twice for one thread and double-apply the standing notch?" Traced the
callers: `exitThread` guards `if(t.done)` at index.html:5163 and removes the thread from
`S.threads` BEFORE reaching the aftermath `concludeThread` at :5170; `concludeThread` stamps
`t.done` as its first act; and the post/open paths filter on `!t.done` (:4053, :6415, :6419,
:6452). Not a gap, and not introduced here — the same lifecycle already carries Task 5's wager
doubling. Carried to the final whole-branch review as a named risk, which is the right altitude
for a cross-slice lifecycle invariant.
Task 7: minor (deferred, ASSIGNED TO TASK 8): the rung/title/stake computation is duplicated
  verbatim at THREE sites (`hallBout`, `hallMatch`, the Champion-row render) — drift risk with no
  test to catch a missed site. Extract a shared helper.
Task 7: minor (deferred, ASSIGNED TO TASK 8): no guard against re-buying training while a buff is
  already pending — a second click silently overwrites the first and burns the currency already
  spent, with no warning.
Task 7: minor (deferred, ASSIGNED TO TASK 8): the doubled-article bug now spans five sites and all
  20 cultures (every canon champion name already begins with "the").
Task 7: minor (deferred, house practice): no unit pins back the MATCH-path title wiring — verified
  live only. Consistent with this codebase's pure-core-gets-pins / DOM-glue-gets-E2E boundary,
  which is also how the brawl-side title logic and `hallTrain` were verified.
Task 7: complete (commits 8f412db..0aa2e19, review clean after 1 fix round)
Task 8: dispatched (sonnet), BASE 0aa2e19 — close-out: GLOSS, CLAUDE.md, BACKLOG.md, the tunables
  and open-questions hand-off, plus the five carry-over minors assigned above.
Task 8: review ✅ approved — 0 Critical, 1 Important (board hygiene), 2 Minor. The reviewer
independently re-swept the file for the doubled-article pattern rather than trusting the count,
found none remaining, and correctly identified three `'the '+X.name` sites it should NOT touch
(a faction name and two location names — no baked-in article, different bug class). It ran the
authorized `git diff -w` itself and confirmed every surviving hunk maps to a named content change,
proving the re-indent was whitespace-only. It verified the helper is called at all three sites and
sits outside the pure region. It judged the hand-off genuinely actionable by someone who was not
in the room.

Ruling 16 — **move the row to SHIP QUEUE properly; the implementer's caution was right but the
board should not be left self-inconsistent.** BACKLOG.md's own lifecycle (line 39) says a
`ready-to-push` row moves to the SHIP QUEUE section, but that table has a different column schema
(`Stage | What | Canon | Where it sits`) from the `❶ READY TO BUILD` table, so the move is a real
reformat rather than a cut-and-paste — which is why the implementer, told not to restructure a
shared board, left the row in place and flagged it to me instead. Correct instinct, wrong end
state: the board now shows a `ready-to-push` row sitting among open build rows, and the only
record that a manual move is owed lives in a report Daak may never open.
Decided: do the move. Stage **B** ("local only, never pushed") is the right bucket — these commits
sit on the local branch and have not been pushed; Hall slices A+B1 are Stage A there because they
HAVE been pushed. Remove the B2 row from `❶ READY TO BUILD`, leave `T-SOC-1 C` there still
`blocked`, and keep the tunables + nine open questions where they are.
Cost if wrong: one row in the wrong table on a board Daak reads daily — trivially reversible.
Task 8: minor (folded into the same round, since the implementer is already in these files):
  `'Hall law'` and `'Bout'` GLOSS entries still begin lowercase, contradicting the very house
  convention the brief invoked to fix `'Contest'`.
Task 8: minor (folded in): the CLAUDE.md bullet omits two late-ruled facts — a bout is a true 1v1
  (only the Force leader fights), and the title fight ships for all 20 cultures across BOTH
  resolvers. Not inaccurate, but CLAUDE.md is the doc a future engine-reader opens FIRST, and
  these are exactly the kind of ruled-late facts that get lost when they live only in a backlog row.
Task 8: fix round 1 dispatched (Ruling 16 + the two minors).
Task 8: fix round 1/5 (3 addressed, 0 open; commits 0860cd6..4133a0d, 783/783 unchanged).
Re-reviewer confirmed the row left `❶ READY TO BUILD`, landed in SHIP QUEUE as Stage B, and
independently verified the Stage-B choice with `git branch -vv` (local branch is 98 commits ahead
of origin — genuinely unpushed). T-SOC-1 C, the tunables block and the nine open questions all
stayed put.
Task 8: complete (commits 0aa2e19..4133a0d, review clean after 1 fix round)

ALL 8 TASKS COMPLETE. Branch range for the final whole-branch review: 97c0125..4133a0d.
Suite 749 → 783 passing, 0 failing, no pre-existing pin ever moved. Canon 1.40 → 1.41.

FINAL WHOLE-BRANCH REVIEW (opus, 97c0125..4133a0d, 4 passes): 2 Critical, 6 Important, 6 Minor.
All nine rulings assessed and all nine upheld — with the correction that Ruling 9 (a bout inherits
no generic SKIRMISH consequences) was under-EXECUTED, not misjudged: the audit walked
`concludeThread` and never opened its sibling `exitThread`. The reviewer also independently
confirmed my double-conclude trace (three independent guards: `threadView`'s early return before
the END THREAD/Exit controls are built, `exitThread`'s `if(t.done)` preceding the aftermath
branch, and `THREAD.outcome` returning null on `thread.done`).

Controller verification of both Criticals before commissioning the fix (I do not dispatch a canon
bump on a reviewer's say-so):
- C1 CONFIRMED: `exitThread` (index.html:5166-5169) has no `t.hall` branch; the `!joined` path
  splices the thread and toasts "no cost; hostilities had not begun" while the stake has already
  left `S.cur` at mint. Silent, repeatable currency loss with a message that denies it.
- C2 CONFIRMED: `COND_DUR.Rally` is `function(){return 1}` (index.html:1153), and `apply` runs
  `tickConds` at line 872 BEFORE `block.forEach` — so the minted Rally instance is decremented to
  0 and spliced before the damage branch ever reads `condMods`. The rung-③ training buff the
  player pays 75-300 currency for contributes exactly zero, always, in every thread type.

Ruling 17 — **C2 is fixed with a new authored canon field, not a +1.** Add
`rules.hall.champion.train.rounds` and mint the instance's `left` from it; bump canon 1.41 → 1.42
and sweep the 8 version pins again. Rejected `condDur(tag,tier)+1`: `COND_DUR.Rally`'s duration of
1 is correct for its designed use (a same-post weapon rider), and a magic +1 at one call site
would silently break the moment anyone retunes the registry. How long a purchased buff lasts is a
balance decision and belongs in canon where Daak can see and tune it — it joins the flagged
tunables list. Cost if wrong: one more canon field and one more version bump.

Ruling 18 — **C1's fix shape, which also defuses the I3 stalemate trap.** Pre-Lock-In: refund the
stake in full and say so (the current message actively lies). Post-Lock-In: forfeit the stake —
you walked away from the table and the Champion keeps it, a defensible and legible rule — BUT
skip the war-flee penalties entirely: no 5%-of-army-value charge, no wound on every DEPLOYED
roster model, no pursuit thread. Those are war semantics and they are absurd inside a tavern.
That also reduces I3 (a bout where both armours exceed both damages can never produce a yield and
SKIRMISH has no round cap) from "trapped" to "you lose your stake and walk" — an acceptable,
legible out. I deliberately did NOT invent a round cap or a wound-parity draw: that is a combat
design call, and inventing one in a final fix wave is exactly the late scope that breaks things.
It goes to Daak as an open question instead.

Ruling 19 — **M2 (`/duel/i` name-substring) is deferred, not fixed.** Two brawl cultures name
their contest with the literal word "duel" (Black Legion's "Trophy Hall blade-duel", Drukhari's
"Gallery knife-duel"), so they take different exit and NPC-withdrawal paths than the other six.
Real and worth fixing — but `/duel/i` gates Arena duels too, so replacing it with an explicit flag
changes behaviour across a shipped feature this plan never touched. Pre-existing, not introduced
here, and a final fix wave is the wrong moment. Backlog + open question.

Ruling 20 — **M3/M4 stay deferred.** `tickConds` and the MISSION/retreat PC tallies not honouring
`yielded` are asymmetries with no reachable path (the reviewer agrees). Keeping the wave tight
matters more than symmetry here; I2 — which the reviewer PROVED reachable (a downed fighter can
stage a move in the post that ends the bout, because `npcRespond` runs before `THREAD.outcome`) —
is in the wave.

FINAL FIX WAVE: DONE_WITH_CONCERNS — commits 0748204 (canon 1.41→1.42, `train.rounds` + pin
sweep), 0f57bcf (engine: 7 fixes), ab7c7a1 (docs: M5). 788/788 passing (783 + 5 new pins), no
existing pin moved at any commit. Canon verified at 1.42 by me. Both Criticals verified LIVE
through real clicks: C1 pre-Lock-In refunds the 25 stake (300→275→300) and post-Lock-In forfeits
it with no 5% charge (275 stays 275), no extra roster wound (a 1/1 model SURVIVES where the war
path would have killed it) and no pursuit thread; C2's Rally now survives the first post
(`left` 3→2, `dmgOut` 1) where the old minting left it `[]` and 0.
`rounds` = 3, with the pin asserting `>= 2` rather than `=== 3` — correct instinct, it pins the
INVARIANT (must outlive the first tick) rather than the balance number.

Ruling 21 — **a post-Lock-In bout exit syncs the wounds already taken. Upheld.** The implementer
made this call itself and flagged it, because Ruling 18 did not say either way. Its reasoning:
otherwise walking out mid-bout is a free full heal, strictly better than fighting on, which would
make the exit the dominant move in every bout going badly. That is right — a fight you leave still
happened to you. Cost if wrong: two-line revert, and it is now in front of Daak.

Deferred out of the wave and going to Daak as open questions, not code (Rulings 19 and 20 plus
two from the final review): the `/duel/i` name-substring fork; a bout round cap / wound-parity
draw for the armour-stalemate case (C1's fix downgrades it from "trapped" to "lose your stake and
walk", which is an out, not a resolution); the unreachable `yielded` asymmetries in `tickConds`
and the MISSION/retreat PC tallies; and — newly surfaced by the wave — `hallCtxOf`'s 1-based
`ctx.day` coexisting with `WORLD.dayIndexAt`'s 0-based index. I6 fixed the one writer that
straddled both scales and `S.social.bar` is self-consistent, but two day scales in one subsystem
is a standing trap worth a deliberate reconciliation later.
Scoped re-review of the fix wave dispatched (opus) 4133a0d..ab7c7a1 — the single re-review the
process allows after a final-review fix wave.

SCOPED RE-REVIEW OF THE FIX WAVE (opus, 4133a0d..ab7c7a1): all ten findings ADDRESSED, no new
Critical/Important breakage introduced. The re-reviewer verified each fix against UNCHANGED code
rather than the diff alone — it walked `tickConds`/`apply` ordering to confirm `left:3` is felt on
the buyer's 1st and 2nd posts and spliced before the 3rd; it audited every `applyCond` caller to
confirm the new optional `add.left` moves no existing duration; it confirmed `yielded` can only be
set under `state.nonLethal`, which only hall bouts declare, so `npcTurn`'s new filter cannot touch
any other combat thread; and it checked what the new exit branch SKIPS (`_ultRestoreCond` is
guarded on `t.ultimatum`, which `hallBout` never mints — a true no-op). It also confirmed all three
of the implementer's disclosed judgement calls, upheld Ruling 21's wound-sync on inspection of the
non-lethal floors, and confirmed I1's guard is genuinely unreachable and rightly kept.
It corrected one wrinkle in the implementer's REASONING (not its outcome): a weapon-staged Rally is
applied during `block.forEach`, i.e. after that post's tick, so `rounds:2` would have bought one
felt post rather than zero. The conclusion — 3 is the first value buying a real two-post edge —
still stands.

Ruling 22 — **the residual finding is PARKED, not fixed, and recorded in BACKLOG.md.** The
re-review found that a purchased training buff is still silently destroyed by a pre-Lock-In exit:
`hallBout` consumes `S.social.train` at mint and the condition lives only on the thread's
`seedState`, so splicing the thread burns the 75-300 currency spent on it. It is C1's own defect
class one rung down in value, and the newly-honest wager refund makes it more visible.
Parked because the correct fix is ENGINE-WIDE, not Hall-scoped: `seedCombat` spends the buff the
same way on the ordinary path, in code this slice never touched, so a Hall-only patch would close
the visible third and leave the rest — which is precisely the partial-audit mistake the final
review already caught in this slice (auditing `concludeThread` and never opening `exitThread`).
Repeating that mistake knowingly, in the last change of the plan, to close a bounded and
now-documented currency loss, is the wrong trade. The process also allows exactly one fix wave
after a final review, and it has been spent.
Recorded as a KNOWN DEFECT with its fix shape in BACKLOG.md (commit b7e8a51) so it survives the
deletion of this workspace, and surfaced to Daak in the hand-off.
Cost if wrong: a player who buys training and then backs out of a thread loses it, silently,
until someone picks up the engine-wide fix.

ALL WORK COMPLETE. Final range 97c0125..b7e8a51 (21 commits). Suite 749 → 788 passing, 0 failing,
no pre-existing pin ever moved. Canon 1.40 → 1.42.
