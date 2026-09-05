# NPC Action-Selection Case Studies — Shipped Turn-Based Tactics Games

Research pass for the Heretics 40K NPC action-selection design (grid combat, fog of war,
AP economy, weapons + conditions + casts, 3-16 models/side, deterministic/seeded pure-JS
engine). This is a survey of how shipped games actually pick abilities for AI units, drawn
from developer talks, postmortems, and well-sourced technical breakdowns. Every claim below
is attributed to a source; where a claim comes from community reverse-engineering rather than
a developer statement, that's flagged explicitly.

---

## XCOM: Enemy Unknown / XCOM 2 (Firaxis)

**Mechanism.** At GDC 2013, Firaxis presented the original Enemy Unknown AI as a **utility-based
system**: every alien scores every candidate action (move-to-position, shoot, ability use) with
a numeric "usefulness" value built from weighted factors, then acts on the highest score. The
factors that fed a positional score included distance to the candidate tile, whether that tile
flanked an enemy or moved the unit closer to flanking, the cover bonus the tile granted,
proximity to other aliens (so a unit doesn't want to stand where a grenade or rocket would hit
several allies at once), the number of enemies that tile would leave visible (one visible enemy
was treated as optimal — enough to threaten, not so many the unit gets swarmed), and an
"alien-behavior-specific" value layered on top of the shared formula. Firaxis reportedly
shipped around **17 distinct AI behavior sets**, each retuning the weights for its species —
the worked example given was the Muton's "Blood Call" buff, which the utility formula would
weight heavily specifically when other nearby Mutons existed and weren't already buffed, so the
same generic utility machinery produces a support-caster pattern for one alien type and a
pure-aggro pattern for another just by moving weights, not by writing bespoke logic per alien
(PC Gamer's summary of the GDC 2013 "AI Postmortems" session, corroborating a GDC Vault entry
titled "AI Postmortems: Assassin's Creed III, XCOM: Enemy Unknown, and Warframe").

XCOM 2 layered a different strategic mechanic on top of the same combat-turn philosophy rather
than replacing it: enemies spawn in map-fixed **pods** that sit dormant (no vision/hearing
simulation the way classic X-COM had) until a player unit's LOS "reveals" the pod, at which
point the whole pod instantly activates, breaks for cover, and starts making the same kind of
per-unit utility-scored decisions XCOM 1 aliens made. A widely-read retrospective on
gamedeveloper.com calls this a regression in one specific way: because pods are geometry
triggers rather than a simulated perception model, and because (with two class-based
exceptions) a unit that breaks concealment can't ever re-enter it, exploring aggressively can
easily reveal two or three pods at once and stack overwhelming simultaneous activations — a
consequence of the *world* trigger design, not of the per-unit *decision* logic.

**Difficulty tiers.** XCOM 2's own numbers, compiled by the community from datamined tables
(strategywiki.org / XCOM Fandom "Aim Bonuses" and "Game difficulty" pages), show Firaxis
deliberately keeping the AI's *decision quality* constant across difficulty and instead tuning
**stats**: on the top difficulty (Legendary) there is no aim-roll manipulation at all (no
enemy-miss-streak assist, no flat aim penalty on aliens) — instead enemies simply get a few
extra points of HP and armor compared to Commander difficulty, and on lower difficulties the AI
is throttled to fewer actions per turn. In other words: the scoring/behavior code does not get
smarter or dumber by difficulty; the health pool and turn budget do.

**Reception.** The utility-scoring approach is broadly credited (in the same GDC coverage and
in years of community "how does the AI pick targets/flank" threads) with producing legible,
archetype-flavored behavior without per-unit scripting — a design useful to us because it's the
closest existing case to "one generic engine, N faction flavors via weight tables," which is
exactly Heretics 40K's shape (20 factions, one THREAD core). The XCOM 2 critique is not about
the scoring model at all — it's about a *trigger* design (pods) creating spiky, unfun
simultaneous-activation situations. That's a useful cautionary distinction for us: get the
per-unit scoring right and you can still create a bad player experience with a bad *activation*
rule layered on top.

**Applicability to Heretics 40K.** The weighted-utility-with-per-faction-multiplier pattern maps
directly onto our `ai.behavior_matrix` / doctrine axes already in canon (T-NPC-4): XCOM's model
is evidence that a single scoring formula, reparametrized per faction/archetype, is enough to
produce visibly distinct faction personalities without bespoke per-faction code paths. The
"don't stand where an AoE would hit your own side" and "prefer exactly one visible threat"
factors are directly portable to our grid+fog+AoE combat. The pod-activation lesson says:
whatever triggers a batch of NPCs into combat (our Ultimatum clocks / aggressor cadence) should
be designed independently from, and reviewed separately from, the per-unit action scorer — a
good scorer can't fix a bad mass-activation trigger.

Sources:
- [GDC 2013: The AI tricks behind XCOM, Assassins Creed 3 and Warframe (PC Gamer)](https://www.pcgamer.com/gdc-2013-the-ai-tricks-behind-xcom-assassins-creed-3-and-warframe/)
- [GDC Vault — AI Postmortems: Assassin's Creed III, XCOM: Enemy Unknown, and Warframe](https://www.gdcvault.com/play/1018058/AI-Postmortems-Assassin-s-Creedm)
- [A Deep Dive Into XCOM and XCOM 2 (Game Developer)](https://www.gamedeveloper.com/design/a-deep-dive-into-xcom-and-xcom-2)
- [XCOM 2/Aim Bonuses — StrategyWiki](https://strategywiki.org/wiki/XCOM_2/Aim_Bonuses)
- [Game difficulty (XCOM 2) — XCOM Wiki/Fandom](https://xcom.fandom.com/wiki/Game_difficulty_(XCOM_2))

---

## Battle Brothers (Overhype Studios)

**Mechanism.** Overhype's own Dev Blog #27 ("AI in Battle Brothers, Part 1") lays out a
**relative-utility scoring system** that is unusually explicit for a shipped game's own
developer documentation. Every enemy type carries a pool of candidate "behaviors" (a behavior
bundles a skill + a target/position). On its turn, the unit scores every behavior on a
roughly 1-10 relative scale — the blog's worked example: a skeleton with axe+shield facing a
Battle Brother with shield raised rates "destroy the shield" around 9 (high utility, because
the enemy is hard to hit while shielded and breaking the shield increases future hit chance),
while using Shieldwall in a plain duel rates around 5 (situationally fine, not decisive).
Scores below a floor (~2) are discarded as "doesn't make sense here" entirely, and — critically
— the AI does **not** always take the top-scoring action. Surviving behaviors go into a
**weighted random pool**, so a 9-utility action is much more likely than a 5-utility one but
never guaranteed; Overhype's own framing is "every behavior in the pool could be picked, but the
higher the utility, the more likely it is to be picked" (Dev Blog #27, mirrored on ModDB).

Overhype builds distinct **archetypes** on the same scoring frame by changing the input pool
and weights, not the algorithm: zombies get an intentionally "gimped" behavior set that just
charges the nearest target regardless of terrain, numbers, or height, ignoring specialized
skills entirely; skeletons weight terrain/height/shield-wall formation heavily; goblins weight
ambush and hit-and-run. This is the same "one engine, many weight tables" idea XCOM uses, but
documented in the dev's own words rather than reconstructed by press.

Retreat is a separate, later-added layer (Dev Blog #44, "Retreating Enemies"): once a unit's
side has lost enough men relative to the player's remaining force, individual survivors become
eligible to break and flee — but Overhype is candid that this was added specifically because
enemies fighting to the last man read as artificial, and even after shipping it they acknowledge
it doesn't fully solve "chasing enemy archers across the map," flagging it as an incomplete fix
they intended to keep iterating on with "a few more tools," not a solved problem.

**Reception.** Battle Brothers' tactical AI is one of the most consistently praised in the
indie tactics space — critics and players credit it with genuinely different feel between
factions (a raiding-party goblin fight plays nothing like an undead siege) without the game
ever needing bespoke per-monster scripts, and with avoiding the "obviously suboptimal AI"
complaint common to weaker utility systems, largely because of the randomized-pool-not-argmax
selection: a pure `argmax` utility AI is trivially predictable and exploitable once a player
learns the weights, while sampling from a weighted pool keeps behavior legible but not
100%-scriptable.

**Applicability to Heretics 40K.** This is probably the single most directly transplantable
case study for us: (1) discard-then-weighted-sample instead of pure argmax is a small change
with an outsized anti-repetition payoff, cheap to implement deterministically (seeded RNG over
a filtered, scored list — exactly the RNG discipline our engine already uses everywhere else);
(2) archetype differentiation entirely through input-pool/weight changes (not new code) is the
same shape as our `ai.behavior_matrix` axes; (3) Overhype's own admission that retreat/kiting
was bolted on late and still imperfect is a warning: budget explicit design time for
retreat/disengage logic rather than assuming the scorer will produce sensible retreats for free
— it's a distinct behavior, not an emergent property of per-turn scoring.

Sources:
- [Dev Blog #27: AI in Battle Brothers, Part 1](https://battlebrothersgame.com/dev-blog-27-ai-battle-brothers-part-1/) (mirrored: [ModDB](https://www.moddb.com/games/battle-brothers/news/dev-blog-27-ai-in-battle-brothers-part-1))
- [Dev Blog #44: Retreating Enemies](https://battlebrothersgame.com/dev-blog-44-retreating-enemies/)

---

## Divinity: Original Sin 2 / Baldur's Gate 3 (Larian Studios)

**Mechanism.** Larian's two most recent tactics-RPGs both build around **elemental surfaces
and combo chains** (fire/water/poison/blood pools, oil, clouds, Bless/Curse) as first-class
battlefield state, and the AI is built to read and exploit that same state the player does —
e.g. raining to create water, then Blessing the puddle to buff standing allies, is presented in
Larian's own making-of coverage as a combo the systems were explicitly designed to support on
both sides of the fight (PC Gamer's "The making of Divinity: Original Sin 2"). Larian has not
published a detailed scoring-function breakdown the way Overhype has, so the following is
necessarily less granular than the XCOM/Battle Brothers sections, but two structural claims are
well corroborated:

- **Fog of war / information:** community technical discussion (Steam) on DOS2 is split on
  whether the AI "cheats" vision, but the more careful accounts converge on: the AI can act on
  full battlefield knowledge for *positioning/targeting purposes* but is constrained to the same
  *input grammar* the player has (the same action costs, the same AP pool, the same line-of-effect
  rules for spells) — i.e., Larian's AI takes the "know more, but obey the same rules" middle
  path rather than either strict human-parity or blatant stat/rule cheats.
- **Baldur's Gate 3's Tactician-mode changes are explicitly a behavior/priority change, not (only)
  a stat cheat:** senior combat designer Matt Holland described Tactician AI as retargeting
  toward squishier party members and concentrating spellcasters, finishing off downed characters,
  and using consumables (grenades, potions) more liberally — all framed as trying to make the
  fight "feel like a real DM," i.e. smarter opponent behavior, layered onto Larian's separate
  practice of hand-crafting each encounter's terrain (explosive barrels, chokepoints) specifically
  for the harder difficulty rather than only reusing the Normal-mode map (ScreenRant / Destructoid
  coverage of Holland's comments).

**Reception.** Larian's combat AI is well liked specifically for using its own kit "in the
spirit it was designed" — throwing the same elemental combos, buffing allies standing in the
same surfaces a player would set up, and (on Tactician/Honour) visibly prioritizing
high-value/low-defense targets the way a thoughtful human DM would. The complaints that do
surface are less about the scoring model and more about the "does it truly not cheat vision"
trust question, which is a perennial friction point for any AI in a fog-of-war RPG regardless of
the real answer.

**Applicability to Heretics 40K.** Two portable ideas: (1) treat conditions/terrain (our
`CONDS` registry, cover, terrain-driven LOS) as *first-class scoring inputs* the same way
Larian treats surfaces — an NPC caster should be able to score "cast Consecrate onto a tile my
allies are standing near" the same structural way it scores "attack the nearest enemy," rather
than casts being a bolted-on special case; (2) the "know more but obey the same rule grammar"
compromise is a workable, defensible answer to our own fog-of-war question — an NPC could be
allowed full positional knowledge of spotted-this-thread enemies for scoring purposes while
still being bound by our existing `validate` fog gate for actually *acting* on unseen targets,
which is close to what our current `spottedEnemies`/`refreshFog` gate already half-enforces and
worth confirming stays true once NPC scoring gets more sophisticated.

Sources:
- [The making of Divinity: Original Sin 2 (PC Gamer)](https://www.pcgamer.com/the-making-of-divinity-original-sin-2/)
- [Baldur's Gate 3 Difficulty Modes & Setting Differences Explained (ScreenRant)](https://screenrant.com/baldurs-gate-3-difficulty-settings-balanced-explorer-tactician/)
- [The Baldur's Gate 3 grueling Tactician Mode is the correct way to play (Destructoid)](https://www.destructoid.com/how-to-play-baldurs-gate-3-tactician-mode-best-way/)
- [Difficulty — bg3.wiki](https://bg3.wiki/wiki/Difficulty)

---

## Into the Breach (Subset Games)

**Mechanism.** Into the Breach is the deliberate outlier in this survey: there effectively is
no "AI decides what to do and hides it" model at all. Every enemy's next action — target tile,
attack, movement — is computed and **shown to the player** as a telegraph icon *before* the
player's turn, and combat resolution has (by design intent) no hit-chance RNG: if an attack
telegraphs a tile, it will hit that tile, full stop. Subset co-founder Matthew Davis's 2019 GDC
postmortem frames this as a reaction to their prior game, FTL — the team wanted a game "with
less randomness," where "every death felt like the player's own fault" rather than a bad dice
roll, and telegraphing was the mechanic that let them keep tactical depth while removing hidden
information about the only variable that mattered (what happens next). Kotaku's review captures
the player-facing effect precisely: "Into the Breach lets you know exactly how good or bad at it
you are, with no one to blame but yourself," and situates the game closer to chess or a puzzle
than to a traditional tactics game specifically because of the removed randomness.

**Does it cheat / fog of war?** There is effectively no fog of war on the enemy side to cheat —
the whole map is visible, and the AI's "decision" (already fully determined and displayed) is
public information the instant the enemy spawns or finishes its previous action. The design
question Into the Breach answers is not "how good is our scoring function" but "what if we make
the AI's committed decision itself the primary game object the player manipulates" — the player
spends their whole turn trying to invalidate telegraphed attacks (push a unit off its target
tile, kill the attacker first, block the tile) rather than trying to out-guess a hidden AI.

**Reception.** Critically acclaimed specifically for this design choice; it's frequently cited
as the sharpest rebuttal to "tactics games need hidden AI to feel tactical" — the fun comes from
solving a fully-known, fully-deterministic puzzle under a turn/resource budget, not from
predicting an opponent.

**Applicability to Heretics 40K.** Direct architectural transplant is unlikely — we have fog of
war, faction personality, and hidden information as explicit design pillars (T-CMB, doctrine,
seat/standing systems), which is the opposite premise. But two narrower ideas transfer well:
(1) **telegraphing a subset of NPC intent** (e.g., showing which tile a Charging-conditioned
model is committed to, or flagging a "this model is about to retreat" state) is a cheap way to
make our deterministic seeded engine feel fair and readable without abandoning fog of war
entirely — we already commit to determinism (seeded RNG throughout THREAD core), so partial
telegraphing of already-decided NPC intent costs us nothing architecturally; (2) Into the
Breach's core lesson — that removing one specific axis of randomness (hit/miss) can make a
tactics game feel dramatically fairer than removing all randomness — is worth weighing against
our existing to-hit/damage rolls if playtesting ever surfaces "the AI got lucky" complaints.

Sources:
- [GDC Vault — 'Into the Breach' Design Postmortem](https://www.gdcvault.com/play/1025772/-Into-the-Breach-Design)
- [Into The Breach: The Kotaku Review](https://kotaku.com/into-the-breach-the-kotaku-review-1823365331)
- [Road to the IGF: Subset Games' Into the Breach (Game Developer)](https://www.gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)

---

## Age of Wonders 4 (Triumph Studios) — a cautionary counter-example

**Mechanism.** Less externally documented at the developer level than the games above (no
GDC talk or dev-blog breakdown surfaced in this research pass), but community technical
observation and reviews are unusually consistent, which is itself informative. Player reports
(Steam Community feedback threads, aggregated review commentary) describe specific,
repeatable failure modes: a caster class (Wildspeaker) doing nothing productive on turn 1
despite having expendable summon actions available, then routing away from the fight on turn 2
instead of toward a target it should be summoning near; units burning long-cooldown AoE
abilities on lone targets when a plain attack would deal more damage to that same target;
heroes thrown forward and burning self-sacrifice abilities with no strategic payoff. One
detailed player breakdown states the AI is "typically very nonsensical" in exactly these ways.
Countervailing feedback in the same threads says the AI does flank and prioritize competently in
other fights — the picture is a tactical AI whose *decision quality is inconsistent turn to
turn and ability to ability*, not uniformly bad.

**Reception.** Reviews are split, but the recurring theme across the split is telling: players
who like the game describe the *strategic/economic* layer as strong and treat combat as a
means to an end, while the sharpest complaints are specifically about individual-ability
misuse in combat — cooldown abilities "wasted," AI not understanding an ability's actual
value relative to a plain attack. This reads as a symptom of **scoring individual abilities in
isolation** (a "how good is this ability, ever" score) rather than comparing all legal actions
against each other in the current situation (Battle Brothers' and XCOM's approach) — a caster
that treats "I have an AoE off cooldown" as a standing high-priority action independent of
whether the situation (single target) makes it strictly worse than a normal attack is exactly
the failure mode a proper same-situation utility comparison across the full legal-action set is
designed to prevent.

**Applicability to Heretics 40K.** The cautionary lesson is specific and worth stating plainly
in any Heretics 40K NPC scorer spec: **never score a candidate action against a fixed
per-ability baseline; always score every legal action for the current unit against every other
legal action in the same evaluation pass**, so an AoE cast against a single target is directly
and structurally compared to a plain weapon attack against that same target, not evaluated on
its own merits and greenlit because "well, it's up." This is the same lesson embedded
positively in the XCOM and Battle Brothers write-ups above (utility scores are always compared
across the *whole* candidate set for that turn) — Age of Wonders 4's complaints are what it
looks like when that discipline slips for a subset of abilities.

Sources:
- [Combat AI Feedback — Age of Wonders 4 (Steam Community)](https://steamcommunity.com/app/1669000/discussions/0/597391837559274789/)
- [Did they ever fix the AI? — Age of Wonders 4 (Steam Community)](https://steamcommunity.com/app/1669000/discussions/0/596274776810492493/)

*Note: Songs of Conquest and Wildermyth were checked for this survey but yielded no
developer-sourced technical breakdown of their combat AI decision-making at the time of this
research pass (only marketing/interview material about their magic and narrative systems) —
they're omitted above rather than included on thin sourcing.*

---

## Cross-game pattern summary

Five points recur across every well-regarded case above, and their absence (or partial
presence) tracks with the complaints in the weaker case:

1. **Score the whole legal-action set every turn, not per-ability in isolation.** XCOM and
   Battle Brothers both explicitly compare every candidate behavior against every other
   candidate in the same pass; Age of Wonders 4's specific complaints (AoE-on-a-single-target,
   useless hero sacrifices) look like exactly what happens when that discipline lapses for some
   abilities. For us: our per-turn NPC decision should build one candidate list (every legal
   move+attack+cast+item combination this unit can take right now) and score all of them
   together, not special-case casts/items outside the movement/attack comparison.

2. **Differentiate archetypes and factions through data (weights/pools), not branching code.**
   XCOM's ~17 behavior sets and Battle Brothers' zombie/skeleton/goblin split are the same
   engine with different weight tables and candidate pools, not different algorithms. This is
   already our stated direction (`ai.behavior_matrix`, doctrine axes in T-NPC-4) — the case
   studies confirm it's the industry-standard shape for exactly our problem (many factions, one
   engine), not a compromise.

3. **Sample from a weighted pool of "good enough" actions rather than always taking the
   argmax.** Battle Brothers discards low-utility options but then rolls a weighted pick among
   survivors specifically to avoid the AI reading as a solved, scriptable puzzle. A pure
   argmax scorer is deterministic in the wrong way — always doing the "best" thing looks robotic
   and becomes exploitable once players learn the weights. Our engine is already seeded/
   deterministic end-to-end, so this costs nothing extra to add (a seeded weighted-sample over
   the top-N scored actions) and directly targets the "doesn't feel repetitive" requirement.

4. **Difficulty is usually stat/turn-budget tuning, not scoring-model tuning.** XCOM's Legendary
   difficulty gives enemies more HP/armor and more actions per turn, explicitly not better
   decisions. None of the well-regarded games in this survey ship a "dumber AI" for easy mode by
   degrading the scoring function itself — the scorer stays constant and external levers
   (health, turn count, damage) move instead. If Heretics 40K ever wants difficulty knobs, this
   argues for tuning `garrison_mult`/PC multipliers/AP rather than a "worse AI" mode.

5. **Fog of war is handled by "know more but obey the same action grammar," not by full
   omniscience with no constraint.** DOS2's AI (per the more careful community accounts) can use
   full positional knowledge for target selection but is bound by the same AP/range/line-of-effect
   rules as the player; Into the Breach sidesteps the fog question entirely by making enemy
   intent public information as its central mechanic. Neither game gives its AI unconstrained
   god-mode play. For us, this validates keeping the existing `validate` fog gate (an NPC's
   *legal* actions are bounded by `spottedEnemies`) even if its *scoring* pass is later allowed
   to reason more richly about known board state — the gate and the scorer are separable
   concerns, and every case study here keeps them separate.

A sixth, softer observation: the one design that abandons hidden-AI-decision entirely (Into the
Breach) is also the one most structurally different from every other tactics AI in this list,
and it works specifically because the studio redesigned combat resolution (no hit/miss RNG)
*around* that choice rather than bolting telegraphing onto an otherwise-standard hidden-AI game.
That's the strongest argument in this survey for not partially copying Into the Breach's
telegraph mechanic without also reconsidering what randomness axis it's meant to remove —
telegraphing a decision that's still subject to a hidden to-hit roll doesn't buy the same
fairness payoff the source design gets.
