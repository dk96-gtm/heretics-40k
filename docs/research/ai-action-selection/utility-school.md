# The Utility AI School — Theory and Shipped Practice

Research brief for Heretics 40K NPC action-selection design. Scope: how the "score every
option, pick from the top" school actually works in shipped games, and what a pure,
seeded, deterministic, small-action-space engine (our combat threads) should borrow
from it. This is one of several research lanes feeding the NPC action-selection design;
it does not cover behavior trees, GOAP, or planning-school approaches except where a
system is a genuine hybrid.

---

## 1. Dave Mark — "Behavioral Mathematics for Game AI" and the Infinite Axis Utility System (IAUS)

**What it is.** Dave Mark's book and the IAUS framework he co-developed are the
foundational text of the utility school. IAUS is not a single algorithm so much as a
vocabulary and a set of components everyone downstream (The Sims analyses, Game AI Pro
chapters, Dragon Age: Inquisition, countless indie frameworks) reuses.

**Mechanics.**
- An agent has a list of possible **behaviors** (actions). Each behavior carries a list
  of **considerations** — independent inputs that matter to how good that behavior is
  right now (distance to target, my health, my ammo, threat level, etc).
- Each consideration runs its raw input through a **response curve** that maps the input
  (normalized to 0–1) to a 0–1 utility score. The curve shape *is* the tuning: a
  linear curve says "I care proportionally"; a steep exponential/quadratic curve says
  "I don't care until it's bad, then I care a lot"; a logistic (sigmoid) curve says
  "I don't care, then a sharp threshold, then I fully care"; a piecewise-linear curve
  is hand-authored control points for anything a formula can't capture cleanly (this is
  literally what The Sims uses for hunger — see §3).
- The "infinite axis" idea is just that there's no cap on how many considerations you
  attach to a behavior — two or twenty, the machinery is the same.
- **Combining considerations into one score is where the two mainstream approaches
  diverge:**
  - *Multiplication* (the IAUS default): all consideration scores for a behavior are
    multiplied together. This has a very desirable property — if any single
    consideration is 0 (a hard veto, e.g. "I have no ammo"), the whole behavior scores 0
    regardless of how good everything else looks. But it has an ugly side effect: scores
    decay fast as you add considerations. Nine considerations each scoring a very
    reasonable 0.9 multiply out to 0.9⁹ ≈ 0.39 — a "good" action reads as mediocre
    purely because it was evaluated thoroughly. Practitioners call this the
    over-multiplication/decay problem.
  - *Averaging* (used e.g. in the ant-colony/decision-factor example in Game AI Pro,
    §2): considerations are averaged instead. This avoids the decay problem but loses
    the veto property — a single catastrophic factor (score 0) gets diluted rather than
    killing the action, so a Sim could in principle be talked into "watch TV" even while
    on fire, if enough other factors are high.
  - **The standard fix for the decay problem**, credited to Mark's "Building a Better
    Centaur" GDC talk and refined by other practitioners, is a **compensation factor**:
    each additional consideration's effect on the final score is scaled down as more
    considerations pile on, so the final score approaches what an "average-ish"
    consideration would produce rather than decaying toward zero. A common
    exact substitute that gets you the same effect with a clean formula is the
    **geometric mean**: instead of `score1 × score2 × … × scoreN`, compute
    `(score1 × score2 × … × scoreN)^(1/N)`. This preserves the "any single 0 kills it"
    veto behavior (0 to any root is still 0) while not punishing an action just for
    having been scored on more axes.
- **Bucketing / "dual utility."** Not every action should even be *compared* against
  every other action. IAUS-derived systems group actions into priority **buckets**
  (e.g., combat actions vs. idle actions) and only fall through to a lower bucket if
  nothing in a higher bucket is valid. Within a bucket, utility scores rank the options;
  across buckets, priority is absolute. This is called "dual utility" — a coarse
  rank/priority axis plus a fine utility-weight axis inside each rank. It's exactly the
  fix for "why would my FPS guard even bother scoring 'check for lint' while being shot
  at" — combat actions are a strictly higher bucket than idle actions, so idle actions
  are never even evaluated once any combat action is valid.
- **Picking among near-tied top scores** (this maps directly onto our design's "seeded
  draw from the top band"): Mark's own recommended techniques, in order of
  sophistication:
  1. Always take the single highest score — fine for a chess AI, feels robotic for a
     character-driven game.
  2. Weighted random over *all* actions, weighted by their scores — technically variety,
     but it can pick genuinely bad actions a non-trivial fraction of the time.
  3. **Weighted random over the top N, or over everything within some percentage/margin
     of the top score** — Mark's actual recommendation, and the one that shows up
     everywhere downstream (The Sims, various indie frameworks). E.g., take the top 5
     scores, or everything scoring within 10% of the best, and weight-random among
     just those.
- **Inertia / anti-dithering.** If a naive utility system re-evaluates every frame or
  every tick, near-tied scores oscillating around each other cause visible flip-flopping
  (attack/flee/attack/flee). Mark documents three fixes: (a) give whatever action is
  *currently* running a fixed bonus weight so it stays "sticky" until something clearly
  better appears; (b) a cooldown after switching, during which the just-chosen action's
  weight is boosted, decaying back to normal over time; (c) simply don't re-decide every
  tick — defer the next decision until the current action naturally finishes or the
  decision queue is empty (this is literally how The Sims Medieval worked).

**Problem it solved.** Pre-utility architectures (finite state machines, hand-authored
priority trees) require the designer to pre-decide, offline, which action wins in every
combination of circumstances. That combinatorial explosion is why FSMs get unmaintainable
fast. Utility flips the question from "in state X, do Y" to "score everything, take the
best" — the combinatorics live in the scoring math instead of in hand-authored branches.

**Applicability to us.** Very high, with caveats. Our combat threads have small action
spaces (attack/move/cast/use-item per model per turn, a handful of legal targets), which
is actually the *easy* end of what utility systems are built for — this school was
designed to scale to dozens of considerations across dozens of actions, so a half-dozen
actions with two or three considerations each is comfortably inside its design envelope.
The multiplicative-decay problem is real but small-magnitude for us precisely because our
action count and consideration count per action are both small — we may not even need
the compensation-factor fix, but it's cheap insurance and trivially deterministic (pure
arithmetic, no RNG). The bucket/dual-utility idea maps cleanly onto our AP economy and
"is this action even legal" gates (fog of war, AP cost, range) — those should stay hard
gates (bucket 0 = illegal, never scored), with utility scoring only inside the legal set,
exactly like the FPS-guard example. The weighted-random-top-N selection rule is directly
what our design's "seeded draw from the top band" already proposes — this school
confirms that's the industry-standard shape of the idea, not a novel invention, and gives
us the specific parameter to expose to design (N or percentage-of-best) as the one dial
that trades predictability for character variety. Inertia matters more for us than it
does for a real-time game, ironically: our NPCs decide once per post/turn rather than
per-frame, so frame-to-frame dithering isn't a risk, but *turn-to-turn* dithering
(retreat one turn, advance the next, because two scores are within noise of each other)
is a real risk for a legible, replayable combat log, and a small "stay the course" bonus
on the previous turn's action type is a one-line, fully-deterministic fix worth planning
for now.

**Sources.**
- [Intrinsic Algorithm — IAUS overview](https://www.gameai.com/iaus.php)
- [Dave Mark, *Behavioral Mathematics for Game AI* (book)](https://www.amazon.com/Behavioral-Mathematics-Game-AI-Applied/dp/1584506849)
- [Dave Mark & Kevin Dill, "Improving AI Decision Modeling Through Utility Theory," GDC 2010 (slides)](https://media.gdcvault.com/gdc10/slides/MarkDill_ImprovingAIUtilityTheory.pdf)
- [Considerations / IAUS documentation, Utility Intelligence framework](https://uintel-go.utilityworlds.com/Documentation/UtilityIntelligence/Considerations/)
- [The Shaggy Dev — "An introduction to Utility AI"](https://shaggydev.com/2023/04/19/utility-ai/)
- [Forty Years of Code — "AI Decision-Making with Utility Scores (Part 1)"](https://mcguirev10.com/2019/01/03/ai-decision-making-with-utility-scores-part-1.html) (discusses the compensation-factor / decay problem and cites Mark's "Building a Better Centaur" GDC talk)

---

## 2. Game AI Pro, Chapter 9 — "An Introduction to Utility Theory" (David "Rez" Graham)

This is the single clearest, most concrete write-up of the whole school, and it's free.
It's worth treating as the reference chapter for our design doc.

**Mechanics, with real formulas from the chapter.**
- **Expected utility**, the founding formula of the whole field:
  `EU = Σ Dᵢ·Pᵢ` — desire (utility) of each possible outcome times its probability,
  summed. E.g., an 85%-to-hit attack with a "hit" utility of 0.6 has expected utility
  0.85 × 0.6 = 0.51; compare against a 60%-to-hit attack with hit-utility 0.9 (EU 0.54) —
  the second attack wins despite hitting less often, because it's worth more when it
  lands. **This is the formal justification for scoring attacks by expected damage/value
  rather than by raw hit chance or raw damage alone** — directly relevant to how we'd
  score an NPC's weapon choice against a target.
- **Decision factors combine by averaging** in this chapter's worked example (an ant
  colony deciding expand-vs-breed): each factor (crowdedness, food health, nursery
  space) is normalized 0–1, then the factors relevant to an action are averaged to get
  that action's score. The chapter explicitly frames this as a **directed graph you can
  build with a visual tool** — normalize inputs into named intermediate values (e.g.
  "Threat," "Heal Necessity"), then average/multiply/min/max those into a final score,
  with per-factor weights available at every junction. This is a good mental model for
  authoring: build small named intermediate scores, then combine them, rather than one
  giant formula.
- **Concrete response curve formulas given in the chapter:**
  - Linear: `U = x/m` (x = input, m = max value — just a normalization).
  - Power/quadratic: `U = (x/m)^k` — higher k = slower start, sharper finish; k between
    0 and 1 rotates the curve the other way (urgent at low values instead of high ones).
  - Logistic (sigmoid): `U = 1/(1+e^-x)` — smooth S-curve, most sensitive change in the
    middle of the range, flattens at both ends. Good for "gradual concern that becomes
    definite."
  - Piecewise-linear: hand-placed (x,y) control points, linearly interpolated between
    the two nearest ones. The chapter states plainly that **this is literally what The
    Sims uses** for things like hunger, because no single formula gives a designer fine
    enough control over exactly where the curve should bend.
- **Picking an action** (§9.6, directly on our question): the chapter lays out the same
  three-tier menu as Mark — always-best (chess-like, "can feel very robotic"),
  weighted-random-over-all ("will occasionally choose something utterly stupid"), and
  **weighted-random over a subset of the top scorers** as the sweet spot — "a tuned
  value, such as choosing among the top five scoring actions," or a percentile cutoff
  ("consider things that scored within, say, 10%" of the best).
- **Bucketing** (§ same section, called "dual utility" and cited to [Dill 11]): actions
  are grouped into priority buckets scored by their own response curve; the
  highest-scoring *bucket* is fully resolved (all its actions scored, one chosen) before
  any lower bucket is even considered. Worked example given: a Sim has a Hunger bucket
  (scores 0.8) and a Fun bucket (scores 0.4) — the Sim will pick among Eat/Drink/Cook
  options in the Hunger bucket and will not even glance at Fun options, no matter how
  good they look, until nothing in Hunger is valid.
- **Inertia** (§9.7): oscillation risk is named explicitly — two behaviors both scoring
  ~0.5 on a per-frame re-decision can cause visible flip-flopping ("attack, run, attack,
  run"). Three named fixes: weight-boost the currently-running action; a cooldown period
  with decaying extra weight after switching; or simply don't re-decide until the
  current action's queue is empty (cited example: The Sims Medieval).
- **The worked combat demo** (§9.8) is the most directly transferable artifact in the
  whole chapter — it's a menu-RPG monster fight scored with four named considerations,
  each with its own curve and its own formula, e.g.:
  - Attack Desire: a range-bound linear curve parameterized by a tunable "aggression"
    value `a`, so the AI gets steadily more willing to trade damage as the fight nears
    its end (an "endgame aggression ramp," directly useful for our doctrine work).
  - Threat: `U = min(maxDmg/hp, 1)` — what fraction of my health the enemy's best hit
    could take, capped at 1.
  - Health/Heal Desire: a shifted logistic curve so the desire to heal rises smoothly as
    hp drops, sharpest around the middle of the range.
  - Run-Away Desire: a power curve whose steepness itself depends on a resource count
    (potions remaining) — more potions in reserve flattens the curve (less desire to
    flee), fewer potions steepens it. This is a clean example of one variable (inventory)
    reshaping a *different* consideration's curve rather than being its own separate
    input — a technique worth remembering for us (e.g., an NPC's flee-threshold curve
    reshaped by how reinforced their position is).
  - The demo's action-selection function explicitly uses weighted random over all four
    scored actions each turn — the chapter's own reference implementation of "pick from
    scores," code-named `ChooseNextAction()`.

**Problem it solved.** Same as §1 — this chapter is the accessible, formula-first
explainer of the IAUS ideas, written for people who need to actually implement it, not
just understand the theory.

**Applicability to us.** This chapter is close to a template for our own design doc:
small number of models, small number of named considerations per action, one curve per
consideration, average or (compensated) multiply to combine, weighted-random-top-N to
choose. The Attack Desire "aggression ramps toward endgame" curve and the Run-Away
curve reshaped by resource count are both directly reusable *shapes* for our doctrine
system (ferocity/pragmatism axes already exist in canon — this gives us concrete curve
math to hang off them instead of ad hoc `if` statements). Everything here is pure
arithmetic over already-known state (hp, ammo, distance) — trivially portable into a
deterministic, seeded, DOM-free core exactly like our existing THREAD/AXES regions.

**Sources.**
- [Game AI Pro, Chapter 9 — "An Introduction to Utility Theory," David "Rez" Graham (free PDF)](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)

---

## 3. The Sims — the canonical shipped utility AI

**Mechanics.**
- Every interactive object in the world **advertises** what it offers and how much
  ("sleep on me for +10 energy," "eat me for +hunger," another Sim advertising itself as
  a social-interaction source). The Sim itself carries no built-in knowledge of how to
  satisfy its needs — that knowledge lives on the objects, which is what let Maxis add
  new objects to the game without touching the character AI at all.
- Each Sim tracks eight **motives** (hunger, hygiene, bladder, energy, fun, social,
  comfort, room), each on a -100..+100 scale, each decaying continuously at its own
  authored rate (tuned to mirror a real schedule — roughly 8 hours of sleep, 3 meals a
  day), and some motives cross-affect others (eating accelerates bladder decay).
- **Scoring is multiplicative**, but between two different kinds of number: the object's
  flat advertised benefit is multiplied by a **motive-specific curve evaluated against
  the Sim's current level of that motive**. A well-rested Sim sees the bed's advertised
  energy value damped way down; an exhausted Sim sees the same number amplified. This is
  the same "value × current-need-curve" pattern described more abstractly by Mark and
  Graham above, just with the terms swapped (the *object* carries the raw value, the
  *agent* carries the response curve) — a useful reminder that either side of a
  consideration can own the curve.
- **Personality and context add further multiplicative weighting** on top: personality
  traits bias specific interactions (a playful Sim's score for "play pinball" gets
  boosted relative to a serious Sim's), proximity makes near objects relatively more
  attractive, and age/social-status gates rule some interactions out entirely (a hard
  veto, not a soft score).
- **Variety is injected by weighted random among the top-scoring interactions**, exactly
  the technique described abstractly in §1–2 — Sims do not always take the single best
  action; how much randomness is applied scales with how dire the underlying need is
  (a starving Sim narrows toward the obviously-correct choice; a comfortable Sim
  wanders more).
- The engineering side (per a former Sims 4 AI programmer's public account): an
  `AutonomyComponent` holds an individual Sim's live AI state, but the actual scoring and
  choosing is centralized in a shared `AutonomyService` that processes a queue of
  `AutonomyRequest`s — i.e., decision-making is a shared service the individual agents
  feed requests into, not logic duplicated per-agent.

**Problem it solved.** How do you make dozens of autonomous, personality-varied
characters behave believably in an open simulation with no scripted sequence of events,
without an explosion of hand-authored special cases per object × per Sim type? Answer:
decouple "what this thing offers" (the object) from "how much I want it right now" (the
agent's motive curve), and let the arithmetic produce believable variety instead of
scripting it.

**Applicability to us.** The advertisement pattern is less directly relevant to us — our
"objects" (weapons, casts, consumables) are already data-driven per `parseItem`/tag
registry, so we already have the equivalent of "what this thing offers"; what we're
missing is the "how much do I want it right now" curve layer on the *agent* side, which
is exactly what our draft design proposes to add. The clean lesson to take is the
**separation of concerns**: keep "what does this action objectively do" (damage, healing,
buff magnitude — already fully specified by our data layer) completely separate from
"how much does this specific NPC, in this specific state, want to do it" (the utility
curve) — don't let personality or urgency leak into the data layer, keep it entirely in
the scoring layer, mirroring how The Sims never lets an object's advertised value depend
on which Sim is looking at it. The "randomness scales with how dire the need is" idea is
also a nice one-line addition for us: a badly-losing NPC force should draw more
deterministically toward its best option, while a comfortable one can afford visible
variety — this could ride on the same tribute/retreat pragmatism math already in canon.

**Sources.**
- [Mark Brown (Game Maker's Toolkit) — "The Genius AI Behind The Sims"](https://gmtk.substack.com/p/the-genius-ai-behind-the-sims)
- [Game AI Pro Chapter 9 (above) — explicitly cites The Sims' piecewise-linear hunger curve as a canonical example](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter09_An_Introduction_to_Utility_Theory.pdf)

---

## 4. Guerrilla Games — Killzone's position/cover scoring (shipped utility-scored target/position selection)

**Mechanics.**
- Guerrilla's "dynamic procedural tactics" system (presented at GDC by Arjen Beij and
  Remco Straatman) scores candidate **cover positions** near an AI soldier with a
  straightforward **weighted sum** — not multiplication, not curves-of-curves, just
  annotate each candidate position with points for each relevant factor and add them up.
  The talk's own numbers:
  - Proximity to the AI's current position: weight 20 (closer = better, cheap
    repositioning).
  - Line of fire to the primary threat: weight 40 if the position also has partial
    cover, weight 20 if it doesn't.
  - Cover from *secondary* threats (not just the one you're currently engaging): weight
    20.
  - Being at the AI's preferred fighting range for its current weapon/role: weight 10.
  - Highest total wins; the AI moves to that position.
- The whole scheme is explicitly **data-driven by personality and situation**: which
  factors matter, and how much, is configurable per-archetype and re-evaluated
  continuously as the tactical situation (visible threats, squad state) changes — the
  same waypoint-scoring machinery drives both a cautious defensive bot and an aggressive
  flanker, just with different weights plugged in.
- The suppression-fire behavior specifically works by annotating positions with a score
  for "gives me a clear line on a target while I'm not personally exposed," then picking
  from the higher-scoring set — i.e., the same scored-candidate-list pattern applied to
  a different question (where do I shoot from) rather than what do I do.

**Problem it solved.** Killzone needed AI that could fight competently in *any*
hand-built level, at any player count, without a level designer manually placing cover
callouts or scripting position choices per map. A generic scoring function over
automatically-sampled candidate positions (nearby waypoints/nav points) means the AI
"just works" on new geometry — the intelligence lives in the scoring function, not in
per-level authoring.

**Applicability to us.** This is the most directly portable pattern in this whole
research lane, because it maps almost one-to-one onto a problem we already have: our
battlefield grid genuinely needs to pick *where to move* and *whom to target*, not just
*which ability to use* — and Killzone's weighted-sum-over-candidate-squares is a simpler,
cheaper cousin of full utility (no curves, just linear point weights) that's proven at
shipped-AAA scale for exactly this kind of spatial decision. For us: enumerate
reachable/legal squares (already computed by our `reachable`/`sightOf` grid core),
score each with a small weighted sum (line-of-sight to a good target, cover value from
terrain, distance-to-preferred-range, proximity to allies for a Rally/Cleanse fan-out),
and take the best (or top-N with a seeded draw, per §1). Because it's a pure weighted
sum over already-known, already-deterministic grid data (no probability, no curve
tuning), it's trivially implementable as pure functions in the existing DOM-free THREAD
core, and it scales fine even though our action space (reachable squares) can be
dozens-large, because scoring per-square is O(1) and cheap. The "weights are
personality-configurable" property lines up exactly with our existing doctrine axes
(ONSLAUGHT/CULLING/DECAPITATION) — those styles are already effectively different
weight sets over the same candidate list; this research confirms that's the standard
shape for the whole industry, not a one-off.

**Sources.**
- [Remco Straatman & Arjen Beij, "Killzone's AI: Dynamic Procedural Tactics" (GDC slides, PDF)](http://cse.unl.edu/~choueiry/Documents/straatman_remco_killzone_ai.pdf)
- [Slide deck mirror on SlideShare](https://www.slideshare.net/slideshow/killzones-ai-dynamic-procedural-tactics-9885496/9885496)
- [aigamedev.com — "From Squad Tactics to Real-time Strategy: High-Level Multiplayer Bot AI in Killzone 2"](https://aigamedev.com/premium/presentations/killzone2-strategy/)

---

## 5. Game AI Pro, Chapter 10 — "Building Utility Decisions into Your Existing Behavior Tree" (Bill Merrill)

This is a hybrid, but worth including because it directly answers "do we have to pick
one architecture or the other" — the practitioner answer is often no.

**Mechanics.**
- Standard behavior trees have a fundamental weakness the chapter names outright:
  **priority is static, baked into the tree's structure at author time.** The worked
  example: a "Monster Hunter" character whose *Combat* branch has to choose between
  Reload, Shoot, and Seek Medic. Seek Medic should usually be low priority (only bother
  if safe and hurt) but occasionally must be the *top* priority (badly hurt and no
  immediate threat) — a plain behavior tree can only express that by duplicating the
  Seek Medic node under different hard-coded conditions at different priority
  positions, which gets fragile and verbose fast as more such cross-cutting cases pile
  up.
- The fix: introduce a new node type, the **utility selector** — a drop-in replacement
  for a normal `Selector` node. A normal selector just walks its children in tree order
  and takes the first one whose precondition passes. A utility selector instead queries
  *every* child for a utility score first, **sorts children by that score**, then walks
  them in score order and takes the first one that's still valid at execution time. The
  chapter gives literal pseudocode for both, side by side, showing the utility selector
  is a small, local, drop-in change — you don't rebuild the tree, you swap one node
  type.
- **Utility propagates up the tree**: composite nodes (selectors, sequencers) need their
  own `CalculateUtility()` so a utility selector nested under another utility selector
  still produces a meaningful number — the simplest rule given is "a composite node's
  utility is the highest utility among its own children."
- **Utility decorators**: because behavior trees already have decorator nodes
  (single-child nodes that wrap/modify a child's behavior — repeat N times, invert,
  time-limit), the chapter proposes **utility decorators** that transform a child's
  utility score on the way up — e.g., wrap `Reload` in a decorator that cubes its raw
  utility, which suppresses Reload's priority except when its own utility is already
  fairly high (cubing a 0–1 number pushes small values toward zero disproportionately),
  letting a designer bias one specific leaf's urgency without touching its sibling
  comparisons at all.
- **Evaluation vs. execution separation**: the version described here explicitly splits
  "figure out what I *would* do and how good it is" from "actually do it," which lets
  the tree be evaluated speculatively/in parallel to the currently-executing action, and
  lets a costly-to-compute leaf do its expensive work once inside `Evaluate()` and just
  return the cached number from `CalculateUtility()` afterward — a direct, practical
  answer to "how do you afford utility scoring for a large tree without recomputing
  everything every tick."

**Problem it solved.** Teams already heavily invested in behavior trees (for their
genuine strengths — designer-visualizable, easy to author, easy for programmers and
non-programmers to collaborate on) don't have to throw that investment away or run two
parallel AI architectures just to get utility's "gray area" reasoning where the tree's
static priorities are the wrong tool for one specific branch. You add utility *locally*,
exactly where the binary tree structure is fighting you, and leave the rest of the tree
alone.

**Applicability to us.** We don't have a behavior-tree engine, so the "utility selector
as a drop-in BT node" mechanism itself doesn't transplant directly — but the underlying
principle is exactly the shape of our actual design question. Our doctrine system
(`AXES.rollFor`/`doctrineOf`) already resembles a small decision tree (style → targeting
rule → movement rule), and this chapter's core lesson is that you don't need to replace
that structure wholesale with a giant utility blob; you can keep the existing hard
structure (style dictates which candidate pool to build, honor conduct reshapes the
pool, pragmatism gates retreat) and drop utility scoring in only at the specific
choice-points that are genuinely "gray area" — e.g., which of several equally-legal
targets within a style's candidate pool to actually hit, or which of several equally-
legal reachable squares to move to. That's a much smaller, much safer change than a
full utility-AI rewrite, and it's directly compatible with keeping everything pure and
deterministic (utility here is just another pure function call inside the existing
`npcTurn` decision path, no new architecture required).

**Sources.**
- [Game AI Pro, Chapter 10 — "Building Utility Decisions into Your Existing Behavior Tree," Bill Merrill (free PDF)](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter10_Building_Utility_Decisions_into_Your_Existing_Behavior_Tree.pdf)

---

## 6. Game AI Pro 3, Chapter 31 — "Behavior Decision System: Dragon Age: Inquisition's Utility Scoring Architecture" (Sebastian Hanlon & Cody Watts, BioWare)

This is the strongest available case study of utility AI shipped in a large, cast-of-
many, ability-heavy RPG combat system — probably the closest analog to us of anything
found in this research pass (allies + hostiles, dozens of abilities, resource
management, needs to run on many characters at once, needs designer-authorable
tuning, needs to be debuggable when it goes wrong in production).

**Mechanics.**
- Core assumptions stated up front, nearly identical to ours: a finite set of legal
  actions at any moment; one action at a time; actions have differing utility; utility
  is quantifiable. From those four assumptions the "obvious" algorithm follows directly:
  enumerate legal actions, score each, take the highest — the same simple-greedy
  starting point as everyone else in this document.
- The unit of authoring is a **behavior snippet**: a bundle of "here's an ability, and
  here's *one particular way* to use it" (the same ability can back multiple snippets —
  e.g. a charge attack used offensively vs. the same charge used purely to reposition
  away from danger are two different snippets sharing one ability). Snippets are
  **registered and unregistered dynamically** as gear/abilities are equipped —
  enumerating "what can this character do right now" is just "what snippets are
  currently registered," which is how the system handles player-customizable loadouts
  without special-casing them.
- Each snippet carries an **evaluation tree** — a repurposed behavior tree whose leaf
  nodes are "scoring nodes" that add points to a running total as the tree executes
  (starting from zero), and whose branch nodes are ordinary filters/conditions. A tree
  is evaluated "in context" (it has access to the evaluating character's state), so the
  same tree structure naturally produces different scores in different situations. This
  is architecturally very close to our own `THREAD`/`AXES` pure-function style — a small
  tree of pure conditionals and additions, no hidden state.
- **Scores are not automatically normalized.** Rather than an algorithmic normalization
  scheme, BioWare adopted an explicit **designer-facing scoring convention** — a shared
  point-range contract every action-class must respect so that, e.g., an Offensive
  action and a Support action land in comparable point ranges without anyone having to
  compute a formal normalization:

  | Action class | Point range | Rule |
  |---|---|---|
  | Basic | 10 (flat) | Better than doing nothing; equivalent to other Basics |
  | Offensive | 20–40 | Always better than Basic; ranked against other Offensives within a 20-point "urgency dynamic range" |
  | Support | 25–45 | Preferable to same-urgency Offensive (preparatory/reactive); starts at a 25 baseline, adds up to +20 contextually |
  | Reaction | 50–70 | Always wins over anything below when its narrow trigger condition is true |

  This is a deliberately low-tech but highly legible solution to the "how do you compare
  apples to oranges across wildly different action types" problem — instead of a
  universal formula, a **shared band contract** that individual designers author
  independently and trust to compose correctly.
- **Target selection is folded into the same scoring pass**, via a "target selector"
  node: iterate every legal target, re-run the downstream scoring subtree once per
  target, and keep only the highest-scoring (score, target) pair. So an evaluation tree
  doesn't just return "how good is this ability" — it returns "how good is this ability,
  against the best available target for it," in one pass.
- **Comparing snippets** is the simplest step in the whole system: evaluate every
  registered snippet's tree, keep the ones that returned a valid result, **sort
  descending by score, take the first** — literally a straight sort-and-pick-max, no
  randomness at all in the shipped version. (Worth noting for us: a AAA, high-visibility
  RPG shipped without weighted-random selection among near-ties — they accepted the
  "sometimes deterministic-feeling" tradeoff in exchange for absolute predictability and
  debuggability. That's a real, defensible design point, not just a theoretical
  alternative to weighted-random.)
- **Debuggability was explicitly designed in**, and the authors call it out as a
  concrete lesson learned: even though the runtime doesn't strictly need to keep more
  than the single winning snippet's result, they found that **retaining every snippet's
  evaluated score in a debug-viewable table gives "great insight when debugging and
  iterating on AI behavior."** This is presented as a practical, load-bearing lesson,
  not a footnote.
- **Passive/ongoing behaviors** (e.g., "follow the party leader when there's nothing
  better to do") are folded into the exact same machinery by registering a snippet whose
  evaluation tree just returns a constant low score (effectively "the floor") — it wins
  by default whenever nothing scores above zero, and loses automatically the instant any
  real action becomes valid. The same trick handles "tethered" guard characters: a
  snippet that scores *very high, but only when the character has strayed outside their
  assigned area* forces a return-to-post whenever needed, and is silent otherwise.
- **Modularity/reuse**: most snippets in the shipped game reuse a small pool of shared
  evaluation/execution tree assets rather than bespoke logic per ability — only a
  minority of complex, unique abilities needed custom trees. This reuse is explicitly
  named as what made the system affordable to maintain across "more than 60 abilities."

**Problem it solved.** A real-time party RPG with AI-controlled allies needs those
allies to competently choose among a large, player-customizable set of abilities with
implicit resource opportunity-costs (mana/stamina spent on one ability precludes another
later), and to do so in a way designers can author, tune, and — critically — *debug in
production* when a character does something inexplicable. A hand-authored priority
system for 60+ abilities across multiple character archetypes would be unmaintainable;
this shows the scored-snippet approach shipped and scaled to that size in an actual AAA
game.

**Applicability to us — this is the closest real-world sibling of our system found in
this research pass.** Several direct takeaways:
- **The band-contract normalization trick is very relevant and cheap for us.** Instead
  of inventing a formal normalization scheme (curves for everything), we could adopt a
  similar explicit convention: e.g. "Move actions score 0–20, Attack actions score
  20–50 scaled by expected damage, Buff/Debuff actions score 25–45, a Reaction-style
  hard override (e.g., 'finish a Critical enemy,' 'save a dying ally') scores 50+ and
  wins outright." This gives designers (Daak) a legible, tunable contract without
  requiring anyone to reason about curve math for every action type up front — and it
  composes cleanly with our doctrine styles (a style could shift *which band* an action
  class falls into, e.g. ONSLAUGHT nudging Attack's band up relative to Support).
- **Target selection folded into the scoring pass** is exactly the shape our
  `spottedEnemies`/targeting logic should take: score (ability, target) pairs together
  rather than picking a target first and then an ability, or vice versa, in two
  disconnected passes — this avoids a whole class of "picked a good ability for a bad
  target" bugs.
- **Debug-table-first design is a strong recommendation we should adopt outright.**
  Because our engine already renders a RECORD post with verbatim arithmetic for
  Ultimatum lapses and doctrine nudges (per canon v1.33/v1.34), extending that same
  "show your work" convention to per-turn NPC action scoring (which options were
  considered, their scores, why the winner won) costs us little — our THREAD core
  already computes this state — and BioWare's own postmortem singles this out as the
  single most valuable practical addition after correctness itself.
- **"Sort and take the max, no randomness" is a legitimate design point**, not just a
  fallback — for us, this suggests the weighted-random-top-N draw doesn't need to be
  universal; it could be reserved for genuinely close ties (within some margin) while
  a decisive best score is simply taken, which is closer to what our current doctrine
  system already implies and is cheaper to reason about in a deterministic, replayable
  log.
- **The passive/floor-score trick for "nothing better to do"** maps directly onto our
  own NPC default behaviors (hold position, patrol, garrison) — we can express "do
  nothing special" as literally the lowest-scoring legal action rather than a separate
  code path, keeping the whole decision uniform.

**Sources.**
- [Game AI Pro 3, Chapter 31 — "Behavior Decision System: Dragon Age: Inquisition's Utility Scoring Architecture," Sebastian Hanlon & Cody Watts (free PDF)](https://www.gameaipro.com/GameAIPro3/GameAIPro3_Chapter31_Behavior_Decision_System_Dragon_Age_Inquisition%E2%80%99s_Utility_Scoring_Architecture.pdf)

---

## 7. Personality/archetype weight sets in shipped indie practice — "Battle of the Bulge" (Miguel Nieves)

A smaller, independently-documented example worth including because it's the plainest
statement of "one utility function, many personalities via config, not code."

**Mechanics.** Nieves' account (published on Gamasutra/Game Developer as "Artificial
Intelligence: Utility Builds Character") describes deliberately building *several*
personality archetypes on top of one shared utility scoring function rather than a
single "optimal-play" AI: a Genius (plays well), a Coward (avoids confrontation), a
Psycho (seeks risky fights), a Defender (holds ground), an Exploiter (targets enemy
weak points), and a Comedian/Troll (deliberately subverts normal play) — each is the
*same* scoring machinery with a different weight profile plugged in. The shipped title,
*Battle of the Bulge*, used 8 such agents, each tuned entirely through an external
config file, with no programmer involvement required to add or retune a personality.
The general combination shape given is a **weighted sum with an explicit penalty term**:
`(value × weight) + (secondary × weight) − (penalty × weight)`.

**Problem it solved.** Design iteration speed: letting designers (not programmers) shape
distinct, shippable personalities by editing numbers in a file, and being able to
AI-vs-AI playtest different personality combinations cheaply.

**Applicability to us.** This is a strong, simple confirmation of a pattern we already
use elsewhere in canon (the 20-faction `ai.behavior_matrix` axis values, and doctrine
styles derived from them) — it validates externalizing personality entirely as data
(weight tables) rather than branching code per archetype, which is exactly how our
`behavior_matrix` is already structured. The explicit penalty term in the combination
formula is worth remembering for us specifically for "don't do this" pressures (e.g., a
penalty for an action that would break Honor conduct, or for moving into an
Ultimatum-defended zone against orders) as a distinct term from the positive
value/weight terms, rather than folding a hard "no" into a merely-low positive score.

**Sources.**
- [Game Developer — Miguel Nieves, "Artificial Intelligence: Utility Builds Character"](https://www.gamedeveloper.com/programming/artificial-intelligence-utility-builds-character)

---

## What this school would tell us to do — one-page summary

**The core loop this whole school agrees on, stripped to its essentials:** for each
acting NPC, enumerate the *legal* actions (hard gate — fog of war, AP cost, range,
tag requirements — exactly as today), score each legal action with a small number of
named, independent considerations, combine those considerations into one number per
action, then choose — either the flat winner, or a seeded weighted-random draw among
the top few / those within a margin of the best. Every source in this document —
from a 2009 economics-flavored book chapter to a shipped 2014 AAA RPG — converges on
that same shape. That convergence is itself the finding: this is not a niche technique,
it is the industry-default answer to "how does an NPC pick what to do," and it is
specifically well-suited to *small* action spaces like ours, not just the huge ones
usually cited as its motivating case.

**Concretely, for our engine:**

1. **Keep legality as a hard gate, score only what's legal.** Don't spend utility math
   on illegal actions (Dragon Age's snippet registration, Killzone's reachable-waypoint
   sampling, and the Sims' age/status vetoes all agree: hard constraints stay hard,
   utility only resolves the gray area *within* the legal set).
2. **Score with a small number of named considerations per action, each a simple
   response curve over a normalized 0–1 input.** Start with linear and a couple of
   power/logistic curves for "doesn't matter until it matters" cases (health thresholds,
   ammo/charge thresholds) — this is cheap, pure, and trivially testable in isolation,
   exactly like our existing `AXES`/`CONDS` cores.
3. **Combine considerations by simple average or a compensated multiply (geometric
   mean), not raw multiplication**, given our small consideration counts the raw-decay
   problem is minor but the fix is nearly free — pick one rule and apply it uniformly so
   scores stay comparable action-to-action.
4. **Fold target selection into the same scoring pass** (score ability+target pairs
   together, per Dragon Age), not target-then-ability or ability-then-target as two
   separate decisions.
5. **Use an explicit, designer-legible band contract (à la Dragon Age's point ranges)
   instead of a universal formula** to keep different action *classes* (move / attack /
   buff / hard-reaction-override) comparable without forcing every action type through
   identical curve math — this is the single most transferable idea for making the
   system authorable by a non-engineer.
6. **Selection rule: take the flat best when the margin is decisive; do a seeded
   weighted-random draw among the top-N (or within X% of best) only when scores are
   genuinely close.** This matches our draft design almost exactly and is validated
   independently by Mark, Graham, and The Sims — the one open parameter to decide is
   N (or the percentage margin), which should probably vary by doctrine style
   (a decisive ONSLAUGHT NPC narrows the band; a more improvisational style widens it).
7. **Add a small "stay the course" bonus to whatever action a model took last turn**,
   sized to prevent turn-to-turn dithering between near-tied scores — cheap, pure,
   deterministic, and specifically protective of combat-log legibility, which is a value
   our engine already prioritizes (the RECORD/Chronicle system).
8. **Build the debug table first, not as an afterthought.** Every scored action, its
   final number, and (ideally) its per-consideration breakdown should be retrievable
   for any NPC decision — this was independently singled out as the highest-value
   practical lesson by the one team (BioWare) shipping something closest to our scale
   and genre, and it costs us almost nothing given the THREAD core already computes
   this state before discarding it.
9. **Keep personality entirely as external weight data, never as branched code per
   archetype** — this is already how our `behavior_matrix` works, and this research
   confirms it's the correct, industry-validated shape, not something to revisit.
