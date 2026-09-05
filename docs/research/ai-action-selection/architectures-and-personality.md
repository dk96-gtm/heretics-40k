# NPC Action-Selection: Alternative Architectures + Personality Layering

Research lane for the T-NPC combat-doctrine work. Scope: evaluate the OTHER
architectures against our draft (utility scoring + personality weights +
seeded top-band draw), and survey how shipped games express "same brain,
different character." I changed no code — this is research only.

**Our constraints, restated so every verdict below is checked against the
same bar:**
- deterministic, seeded, replayable from a day/thread/faction seed
- pure functions, no hidden state, ES5, runs inside a DOM-free core region
- must run cheap enough for thousands of headless auto-battles (world-tick
  far-battle resolution, N2 cadence-core simulation, etc.)
- small action space per turn — roughly 10-40 candidate (move, weapon,
  cast, item) combinations for a given actor, not an open-ended STRIPS
  domain
- 3-16 models per side, grid + fog + AP economy + conditions already exist
  as pure cores (`THREAD`, `CONDS`, `ULT`, `CAD`) that any architecture has
  to plug into, not replace

---

## 1. Behavior Trees (Halo 2 lineage)

**How it works.** A tree of composite nodes (Selector/Sequence/Parallel)
and leaf nodes (conditions, actions) is walked top-to-bottom every tick;
the first branch whose preconditions pass "wins" and executes, or reports
`Running` and gets re-entered next tick at the same point. Damian Isla's
GDC 2005 talk on Halo 2 frames the appeal as four properties: trees are
**customizable** (behaviors decompose into small swappable nodes),
**explicit** (the whole agent's behavior is a literal graph you can read),
**hackable** (any node can be replaced with a bespoke override without
touching the rest), and **variable** (control algorithms themselves are
just more node types, so a designer can drop in a new selection strategy
locally). Halo 2 also layered an event-driven "stimulus" system on top —
tagged bitvector conditions that can interrupt the tree mid-behavior when
something urgent happens (took fire, ally died).

**Shipped examples.** Halo 2/3 (the canonical case), most Unreal/Unity
AI via the engines' built-in BT editors, most modern shooters and open
world NPCs.

**Honest fit.** BTs are a *control-flow* structure, not a *scoring*
structure — they answer "which branch of a fixed decision tree fires,"
not "which of these 30 scored candidates is best right now." For our
tactical layer (rank every legal move+weapon+cast combo against fog,
range, cover, HP, conditions) a BT would need either (a) a synthetic
utility-comparison node grafted in — at which point you're just running
utility scoring wrapped in tree ceremony — or (b) a genuinely large
authored tree per doctrine style, which is exactly the content-authoring
cost our 20-faction/5-axis design is trying to avoid (one axis-driven
scoring function serves all factions; one BT per style does not compose
the same way). BTs are also awkward to keep purely functional: the
canonical implementation is *stateful* — `Running` nodes need memory of
where they left off across ticks, which is precisely the kind of hidden
mutable state our DOM-free pure-core discipline forbids. Determinism is
fine (BTs are as deterministic as their leaf conditions), but unit-testing
is the weak point in practice: multiple sources single out the `Running`/
re-entry bookkeeping as "where most implementation bugs hide," which is a
bad sign for something we want covered by `tests/*.test.js` node-runner
assertions the way `THREAD`/`CONDS`/`AXES` are today. **Verdict: good
model for readability of *phase* logic (deploy → lock-in → combat →
retreat, which our engine already expresses as separate systems), poor
fit as the moment-to-moment weapon/target chooser.**

Sources: [GDC 2005 "Handling Complexity in the Halo 2 AI" (Gamedeveloper.com writeup)](https://www.gamedeveloper.com/programming/gdc-2005-proceeding-handling-complexity-in-the-i-halo-2-i-ai), [Game AI Pro 3, Ch.9 "Overcoming Pitfalls in Behavior Tree Design" (Anthony Francis, PDF)](https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter09_Overcoming_Pitfalls_in_Behavior_Tree_Design.pdf), [Wayline "Rediscovering Behavior Trees"](https://www.wayline.io/blog/rediscovering-behavior-trees-ai-tool)

---

## 2. GOAP — Goal-Oriented Action Planning (F.E.A.R.)

**How it works.** Adapted from 1971 STRIPS planning by Jeff Orkin for
Monolith's F.E.A.R. (GDC 2006). Actions are small typed units (each with
preconditions, effects, and a cost) that a planner (usually A* over the
space of world-states) chains backward from a goal state to the current
state, producing a *plan* — an ordered sequence of actions — rather than
a single choice. The famous result was emergent-looking behavior (flank,
suppress, retreat to cover, call for backup) from a fairly small action
set, because the planner recombined primitives the designers never
explicitly scripted together.

**Shipped examples.** F.E.A.R. (2005), later Deus Ex: Human Revolution
and other titles list GOAP-derived planners; it remains a live technique
for FPS squad AI specifically.

**Honest fit.** GOAP earns its keep when there's a *multi-step means-end
gap* between the agent's current state and its goal — "I want to kill the
player but I'm out of ammo and out of cover" resolves into a 3-4 step plan
(retreat → reload → flank → reengage) that a single-shot scorer can't
express well. That's genuinely not our problem: our "plan" per turn is a
single move + a single action (attack/cast/item), chosen fresh every turn
against fog-limited visible state, and the *sequencing* problem (do I
move before or after casting Rally?) is small enough that it's really
just "evaluate the 10-40 candidate combos" rather than "search a
multi-step state graph." The literature backs this reluctance directly:
GOAP is explicitly described as suited to "simpler decision-making in
first-person shooters," with commentators noting it becomes heavy for
turn-based/strategic decision complexity, and even in F.E.A.R. itself a
retrospective found the *continual replanning* cost was a real, measured
performance overhead (the planner kept re-solving even when nothing
relevant changed) — that's the opposite of what we need when the target
workload is thousands of headless battles. A* planning is deterministic
and can be seeded (tie-breaking rules), so it isn't disqualified on
determinism grounds — it's disqualified on cost-for-value: we would be
paying planner overhead to solve a planning problem we don't actually
have, because AP economy + a single action per turn already collapses the
"multi-step plan" into "single ranked choice." **Verdict: the wrong tool
for a single-turn-single-action tactics game; it shines when the gap
between current and goal state spans multiple actions we don't have.**

Sources: [GDC Vault "Goal-Oriented Action Planning: Ten Years Old and No Fear!"](https://www.gdcvault.com/play/1022019/Goal-Oriented-Action-Planning-Ten), [Gamedeveloper.com "Building the AI of F.E.A.R. with GOAP"](https://www.gamedeveloper.com/design/building-the-ai-of-f-e-a-r-with-goal-oriented-action-planning), [Game AI Pro 2, Ch.13 "Optimizing Practical Planning for Game AI" (Éric Jacopin, PDF)](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter13_Optimizing_Practical_Planning_for_Game_AI.pdf), [tonogameconsultants.com "Game AI Planning: GOAP, Utility, and Behavior Trees"](https://tonogameconsultants.com/game-ai-planning/)

---

## 3. HTN — Hierarchical Task Network Planning (Killzone 2/3)

**How it works.** Like GOAP, HTN plans forward from goals to actions, but
instead of searching raw preconditions/effects it decomposes *compound
tasks* (e.g. "assault position") into *methods* — pre-authored branches
of either primitive tasks (Shoot, Reload, MoveTo) or further compound
tasks — recursively, until only primitives remain. Guerrilla Games used
one HTN domain per individual bot AND a separate squad-level HTN planner
that issues orders into member command queues, letting a strategic path
(a sequence of map "areas" the squad should hold) constrain individual
bots while still leaving each bot free to plan its own primitives inside
that corridor. Their published numbers: ~14 bots + 10 turrets + 6 squads
generating ~500 plans/sec and ~8000 decompositions/sec in Killzone 2/3
multiplayer.

**Shipped examples.** Killzone 2 & 3 multiplayer bots, and later Guerrilla's
in-house "Decima" engine documents a generalized HTN planner used across
titles (Horizon Zero Dawn).

**Honest fit.** HTN is GOAP's more structured, more author-guided sibling:
the "methods" ARE effectively hand-authored personality/doctrine — a
Feral-tribe HTN domain and a Marauder-tribe HTN domain could look
genuinely different because their *method libraries* differ, which maps
onto our "20 factions, 5 axes" idea more naturally than GOAP's flat action
graph does. The squad/individual two-layer split is also structurally
close to what a "force acts as one entity, models act individually"
design would want. But the cost story is the same shape as GOAP: HTN
decomposition is still search, still needs the method library authored
and maintained per personality (a real content burden at 20 factions ×
however many methods, versus one shared scoring function with per-faction
weight vectors), and Guerrilla's own performance numbers (500 plans/sec on
dedicated hardware for a real-time shooter) are the wrong shape for "cheap
enough to run thousands of headless auto-battles" in a browser-tab pure-JS
core — that budget was spent on a 60fps action game with one battle
running, not thousands of battles resolved instantly on a world tick.
Determinism is achievable (decomposition order is deterministic given a
fixed method-priority order and a seeded tie-break) but testability is
harder than utility scoring: you're unit-testing decomposition traces
through a method library, not a pure `score(candidate) -> number` function
per candidate. **Verdict: the most respectable "planning" alternative for
our genre (its two-layer squad/individual split is a genuinely good
idea), but the authoring cost of a method library per doctrine style is
the same tax the personality-weight design is explicitly trying to avoid,
and its perf profile targets single-battle real-time, not headless-sim
throughput.**

Sources: [Guerrilla Games "Killzone 2 Multiplayer Bots"](https://www.guerrilla-games.com/read/killzone-2-multiplayer-bots), [Guerrilla Games VUA07 paper "A Hierarchically-Layered Multiplayer Bot System" (PDF)](https://www.guerrilla-games.com/media/News/Files/VUA07_Verweij_Hierarchically-Layered-MP-Bot_System.pdf), [Game AI Pro, Ch.29 "Hierarchical AI for Multiplayer Bots in Killzone 3" (PDF)](http://www.gameaipro.com/GameAIPro/GameAIPro_Chapter29_Hierarchical_AI_for_Multiplayer_Bots_in_Killzone_3.pdf), [Guerrilla Games "HTN Planning in Decima"](https://www.guerrilla-games.com/read/htn-planning-in-decima)

---

## 4. Monte Carlo Tree Search / rollout-based AI

**How it works.** Build a search tree of future states by repeatedly
selecting promising branches (UCB1 or similar), running fast random-ish
rollouts to a terminal or horizon state, and backpropagating the result to
bias future selection — no hand-authored evaluation function required,
just a way to simulate outcomes. It's the technique behind AlphaGo-era Go
engines and is a live research area for card/tactics games with hidden
information via *determinization* (sample a concrete hidden state, MCTS
it, repeat) or Information-Set MCTS (search directly over information
sets rather than sampled worlds).

**Shipped examples.** Primarily academic/research (Go, Lines of Action,
Dou Dizhu, simplified Magic: The Gathering simulators) rather than shipped
retail tactics games; commercial "auto-resolve" systems in games like
Total War do NOT use MCTS — they use closed-form combat-rating formulas
plus dice rolls, explicitly because it's cheaper and predictable, and
player-facing forums document autoresolve's known blind spots (overweighs
armor, mishandles garrisons) as an accepted tradeoff for speed.

**Honest fit.** MCTS's whole value proposition is exploring a state space
too large or too poorly understood to hand-score directly — it substitutes
compute for domain knowledge. We have the opposite problem: a small
action space (10-40 candidates) we already understand well enough to hand
author a utility function for, and a hero requirement (thousands of
headless battles, cheap) that is squarely the case MCTS is expensive for —
each decision needs many simulated rollouts to converge, and each rollout
is itself a forward simulation of the *combat engine itself* (fog,
conditions, AP economy), which is exactly the kind of interpretive
overhead our pure-function-per-turn design avoids entirely. Determinism
is achievable in principle (seed the rollout RNG), but "thousands of
rollouts per decision, thousands of decisions per headless battle,
thousands of headless battles" multiplies out to a cost profile
nothing in this engine's budget supports — even research papers on MCTS
in tactical games flag it as suited to domains where an efficient
knowledge-rich evaluation function ISN'T available, which is the inverse
of our situation (we have a well-understood scoring surface: distance,
cover, HP%, conditions, AP cost). Testability is also genuinely worse:
MCTS's whole mechanism is stochastic sampling toward convergence, so
"does it pick the right move" tests become statistical/threshold tests
rather than exact-output assertions — a bad match for the `node --test`
exact-state style the codebase already uses for `THREAD`/`AXES`/`CAD`.
**Verdict: the wrong shape for this problem entirely — expensive,
statistically fuzzy, solves a search problem we don't have. This is also
why no shipped tactics-RPG of our scale uses it for real-time NPC
decisions; even Total War's auto-resolve, which has every incentive to
"just simulate it," uses closed-form formulas instead.**

Sources: [ResearchGate "Determinization and IS-MCTS for Dou Di Zhu"](https://www.researchgate.net/publication/224259865_Determinization_and_information_set_Monte_Carlo_Tree_Search_for_the_card_game_Dou_Di_Zhu), [arXiv "On MCTS for deterministic games with alternate moves"](https://arxiv.org/pdf/1704.04612), [arXiv "Survey of AI for Card Games... Jass"](https://arxiv.org/pdf/1906.04439), [Total War Warhammer Fandom "Autoresolve"](https://totalwarwarhammer.fandom.com/wiki/Autoresolve), [forums.totalwar.org "Auto resolve formula" thread](https://forums.totalwar.org/vb/showthread.php/3247-Auto-resolve-formula)

---

## 5. Scripted / telegraphed AI (Into the Breach school)

**How it works.** Not really an "architecture" in the search/tree sense —
it's a design stance: every enemy's *intended* next action (target square,
attack type) is computed once at the top of the turn using deterministic,
fully legible rules (usually "nearest enemy," "highest-value target," or
a fixed per-unit script) and then *shown to the player before it happens*.
Into the Breach's own description: because there's little to no random
chance, "the AI must place every active enemy in such a place and get
them to perform such an attack that the player can complete the turn with
minimal permanent damage" — the AI's job is less "play well" and more
"generate a fair, solvable puzzle state," and predictability is the
explicit design goal, not a limitation to route around.

**Shipped examples.** Into the Breach, most tower-defense boss patterns,
many puzzle-tactics hybrids.

**Honest fit.** This is less a competing architecture and more a *policy
about how much of the decision to expose to the player* — which is
actually a live design question for HERETICS independent of which scoring
engine sits underneath: our fog-of-war combat already reveals visible
enemy state but not their *intent*; a telegraph layer (show the acting
NPC's staged move+target before their post lands, at least for the
player's own visible enemies) is a UI/UX decision that composes on top of
ANY of the scoring architectures in this document, including our draft.
As a pure decision-maker, though, "scripted/telegraphed" is really just
"utility scoring with a very small, very legible weight table" — Into the
Breach's own enemies are reportedly close to deterministic single-rule
selectors (nearest/highest-value), which is a degenerate case of exactly
what our draft utility-scoring layer already is at low personality
variance. Determinism and testability here are as good as it gets — a
scripted rule is trivially unit-testable and trivially replayable.
**Verdict: not a rejected alternative so much as a confirmation that our
draft's floor case (deterministic scoring, no randomness in the ranking
itself) already IS "Into the Breach"-style legibility; the open design
question it raises is whether HERETICS should ever surface NPC *intent*
to the player pre-turn, which is a UX call, not an architecture call.**

Sources: [Gamedeveloper.com "Road to the IGF: Subset Games' Into the Breach"](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-), [Atomic Bob-Omb "Into the Breach & Enemy Intentions"](https://atomicbobomb.home.blog/2020/05/17/into-the-breach-enemy-intentions/), [+4 Blog of Arcane Secrets "Into The Breach And Dynamic Puzzles"](https://blogofarcanesecrets.wordpress.com/2018/03/09/into-the-breach-and-dynamic-puzzles/)

---

## 6. Personality layering across all of the above

The actual design question the draft is trying to answer — "how do you
get 20 factions/100+ NPCs to feel different without authoring 20 separate
brains" — has three well-documented shipped answers, and all three point
the same direction: **weight the SAME engine differently per actor,
rather than writing different engines per actor.**

- **Civilization's leader Agendas (Civ VI).** Every leader runs the same
  underlying diplomacy/strategy AI; what differs is a data-driven
  "agenda" — a historical, leader-specific preference (e.g. "hates
  warmongers," "loves religious spread") plus a second, hidden agenda
  randomized per game — that biases the shared decision weights and
  drives opinion/relationship modifiers. It's explicitly one engine, N
  data-defined bias vectors, with historical-agenda-is-fixed +
  hidden-agenda-is-seeded-per-game mirroring almost exactly our
  "authored per-faction weight table, doctrine axis rolled once per
  thread from a seed" shape.
- **Shadow of Mordor/War's Nemesis System.** Individual orc "characters"
  are generated from a shared trait/personality pool (tribe archetypes
  like Feral vs. Marauder, plus grudges/scars/fears layered on by
  gameplay history) rather than bespoke AI per orc — the *system*
  generates memorable personality through combinatorics over a modest
  trait vocabulary plus persistent state (a captain that fled you last
  time enters this fight already afraid), not through unique authored
  behavior trees per orc.
- **Modular/utility-based creature AI (Game AI Pro's "Modular AI").**
  Explicitly documented pattern: decompose behaviors into ready-made
  utility "considerations" and let designers mix-and-match
  preference/weight patterns onto new creatures "in a handful of
  minutes" rather than writing new logic — this is the direct academic
  cousin of a personality-weight vector over a shared utility function,
  and is presented in the same Game AI Pro volume that catalogs behavior
  selection algorithms generally.

The load-bearing pattern across all three: personality is *data* (a
weight vector, a trait tag, an agenda id) consumed by *one* shared
decision procedure, never a fork in the decision procedure itself. That's
what makes it cheap to add faction #21, and it's also what makes it
testable — you can unit-test "given axis vector X, candidate scoring
produces ranking Y" once, independent of which of the 20 factions
supplied X.

Sources: [Fandom "Why Civ 6 Leader Agendas Mean You'll Never Play the Same Game Twice"](https://www.fandom.com/articles/1281-why-civ-6-leader-agendas-mean-youll-never-play-the), [Civilization Wiki "Agenda (Civ6)"](https://civilization.fandom.com/wiki/Agenda_(Civ6)), [Gamedeveloper.com "Video: How the nemesis system in Shadow of War was designed" (GDC 2018, Chris Hoge)](https://www.gamedeveloper.com/design/video-how-the-nemesis-system-in-i-shadow-of-war-i-was-designed), [Medium "How the Nemesis System Creates Stories"](https://medium.com/@niklaseckstein/how-the-nemesis-system-creates-stories-d26754b30d2e), [O'Reilly/Game AI Pro table of contents (Modular AI, Ch. by Dill & Dragert; Behavior Selection Overview, Ch.4)](https://www.oreilly.com/library/view/game-ai-pro/9781466565975/)

*(Note: I could not find documented technical detail on Dungeon Crawl
Stone Soup's or Cogmind's specific monster-flag implementation beyond
their general "ecosystem" framing — DCSS's monster AI is reportedly a
small set of per-monster behavior flags/holiness tags rather than a
published architecture writeup, so I'm not citing specifics I couldn't
verify. The pattern is consistent with the three verified examples above
— small trait vocabulary layered on shared logic — but I'd flag this one
sub-claim as weaker-sourced than the rest of this section.)*

---

## 7. Determinism & testability — direct comparison of the search architectures

- **Utility scoring (our draft):** trivially deterministic (pure
  `score(candidate, weights) -> number`, argmax/seeded-top-band-draw);
  trivially unit-testable (fixed inputs, exact expected ranking) — this
  is the same style already proven out in `tests/canon-doctrine.test.js`
  and `tests/doctrine-core.test.js` for the AXES doctrine work.
- **Behavior Trees:** deterministic in principle, but the `Running`-state
  re-entry bookkeeping is explicitly called out (Game AI Pro Ch.9,
  Wayline) as the most bug-prone, hardest-to-unit-test part of BT
  implementations — and it requires cross-tick mutable state that sits
  awkwardly inside a DOM-free pure-function core.
  Source: [Game AI Pro 3 Ch.9 PDF](https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter09_Overcoming_Pitfalls_in_Behavior_Tree_Design.pdf), [Wayline](https://www.wayline.io/blog/rediscovering-behavior-trees-ai-tool)
- **GOAP/HTN:** deterministic given fixed tie-break/method-priority
  rules; testable at the level of "does this world-state produce this
  plan," but that's a heavier, more indirect assertion than "does this
  scored-candidate list rank correctly" — and a documented F.E.A.R.
  retrospective found real, measurable perf overhead from unnecessary
  replanning, a class of bug that's hard to catch with unit tests and
  shows up as production cost instead.
  Source: [tonogameconsultants.com](https://tonogameconsultants.com/game-ai-planning/), [GDC Vault GOAP retrospective](https://www.gdcvault.com/play/1022019/Goal-Oriented-Action-Planning-Ten)
- **MCTS/rollout:** deterministic ONLY if every rollout's RNG stream is
  seeded and the rollout count is fixed (no wall-clock/time-budget
  cutoffs, which most real implementations use for pacing) — the
  research literature's whole framing is convergence toward a good move
  via repeated *sampling*, which is inherently harder to pin to an exact
  expected-output unit test than a closed-form score.
  Source: [arXiv MCTS review](https://arxiv.org/pdf/2103.04931)
- **Scripted/telegraphed:** deterministic and trivially testable by
  construction — but that's because there's effectively no search
  happening; it's a degenerate case of utility scoring with 1-2 weights.

---

## Comparison table

Legend: **Fit** = how well the architecture matches our tactical-turn
problem shape (small action space, single-shot choice per actor per
turn). **Personality cost** = effort to make 20 factions feel distinct
under this architecture. **Headless-sim cost** = CPU cost per decision at
thousands-of-battles scale. **Determinism** = replays byte-identical from
a seed. **Testability** = how directly `node --test` can assert exact
expected output. ✓ good · ~ workable with caveats · ✗ poor fit for us.

| Architecture | Fit for our turn shape | Personality cost | Headless-sim cost | Determinism | Testability |
|---|---|---|---|---|---|
| Utility scoring + weights (draft) | ✓ | ✓ low (data-only per faction) | ✓ cheap (one pass over candidates) | ✓ | ✓ exact-output |
| Behavior Trees | ~ (fine for phase control, weak for scoring) | ~ (per-style tree or grafted utility node) | ✓ cheap per tick | ✓ | ~ (Running-state bugs) |
| GOAP | ✗ (solves a multi-step planning problem we don't have) | ~ (action set can be shared; costs tuned per faction) | ✗ (replanning overhead, documented in F.E.A.R. itself) | ✓ | ~ (plan-level assertions, indirect) |
| HTN | ~ (good squad/individual split; over-built for single-action turns) | ✗ (method library authored per doctrine style) | ✗ (decomposition search; Killzone's own numbers target real-time single-battle, not thousands headless) | ✓ | ~ (decomposition-trace assertions) |
| MCTS / rollout | ✗ (built for search spaces we don't have) | ~ (rollout policy can be biased per faction) | ✗✗ (many simulated rollouts × many decisions × many battles) | ~ (only if fully seeded, no time-budget cutoffs) | ✗ (statistical, not exact) |
| Scripted / telegraphed | ✓ (degenerate case of utility scoring) | ✗ (distinct behavior needs distinct scripts, or collapses back into weights) | ✓ cheap | ✓ | ✓ exact-output |

---

## Recommendation (this lane's view)

Nothing surveyed here beats utility scoring + personality weight vectors
+ seeded top-band draw for THIS engine's actual problem shape, and the
reason is structural, not a coin-flip between "modern" architectures:
every alternative earns its keep by solving a problem we don't have
(GOAP/HTN solve multi-step means-end gaps; MCTS solves search-space
explosion where no good evaluation function exists) at a cost we can't
afford (per-faction content authoring for BTs/HTN method libraries,
runtime search cost for GOAP/HTN/MCTS at thousands-of-headless-battles
scale), while the two genuinely valuable ideas the alternatives surface —
Killzone's two-layer squad/individual planning split, and Into the
Breach's willingness to make AI intent visible as a deliberate design
choice — are both *composable on top of* a utility-scoring core rather
than requiring you to replace it. The personality survey converges even
more strongly: Civilization's Agendas, the Nemesis System's trait pool,
and Game AI Pro's own "Modular AI" pattern are three independently-shipped
confirmations that the right way to make many actors feel distinct is
exactly what the draft already proposes — one shared, pure, deterministic
scoring function, with all the character living in a small data-defined
weight/axis vector per actor, never in a forked decision procedure.

File: `/Users/daak/orca/workspaces/heretics-40k/devilray/docs/research/ai-action-selection/architectures-and-personality.md`
