# Stage-2 Social Contract — PvP Law & Multiplayer Rules (design)

> **Status:** design LOCKED with Daak, 2026-07-27. Pre-designed NOW so the Stage-2 backend
> is built around these rules instead of baking in accidental ones. Nothing here ships in
> Stage 1; everything here constrains how Stage-2 systems get built.
> **Foundation:** most protection problems are already solved by shipped/locked designs —
> Ultimatum windows ARE offline protection, the Oathbreaker system IS treachery law, async
> thread play IS the pacing. This spec adds the missing layer: who may attack whom, and how.

## Locked decisions

| Axis | Decision |
|------|----------|
| PvP model | **Blend of open-war and declared-war** (Daak: "a combination of 1 & 2"): war against players is always POSSIBLE, but always AUTHORED — every hostility begins with a declaration, because the attack thread's opening post IS the declaration. |
| Declaration scaling | Response windows scale with attack scale (reusing the locked Ultimatum bands — one mechanic, both directions). |
| Sneak attacks | Exist as **Ambush declarations** — the thread opens describing the infiltration underway; the window collapses. Never a separate no-paper-trail path: content is always authored. |
| Frontier | Unclaimed/contested ground (the Scar, ruler-less worlds) needs NO declaration at any scale. The lawless hunting field. |
| World-enders | **Formal only.** Exterminatus is a rite, not a mugging. |
| Judgment | **No universal "Honorless" mark** (Daak). War-style is judged per-faction through personality axes — the reputation prism. |
| Ambush edge | **Option A for now: the short window alone.** Options B and C recorded below for a later slice (explicit user request). |

## War entry

Every player-vs-player hostility opens as a war thread whose first post is the declaration
— herald or knife, the assault is always authored.

**Formal declaration** — full response window before hostilities, by scale (game days;
6 ≈ 1 real day): **Raid 4–8 · Skirmish 8–16 · Invasion 12–24 · World-ender: formal only,
longest window, sector-visible.** The defender musters, returns home, or negotiates (a pact
can settle a declared war before it starts — diplomacy as off-ramp is the point).

**Ambush declaration** — the opening post describes the sneak attack already underway;
window collapses to **2–4 game days regardless of scale**. The defender's answer may be
mostly garrison. No other mechanical edge in v1 (Option A).

**The frontier** — contested/unclaimed ground: no declaration, no windows beyond the
normal thread mechanics, at any scale.

**Defense while absent:** identical machinery to NPC sieges — the window is an Ultimatum;
lapse resolves garrison-favored (×1.25) statistically. Player attackers get no better
treatment against an absent defender than NPCs do.

## The reputation prism (faction-lens judgment)

Every war-entry act (formal, ambush, frontier raid) broadcasts (Strategium, Notable) and is
judged **per faction through its behaviour-matrix axes** — no new authored tables:

- High **honor** → formal respected, ambush despised (standing drop).
- High **cunning** → clever ambush admired (standing can RISE).
- High **ferocity** → violence respected regardless of method.
- High **pragmatism** → ambushers quietly marked untrustworthy (pact stakes rise).
- **The victim** hates you at full scale, always; their allies take the smaller dent.

Same deed, different verdicts across the Rift — reputation as a prism, not a number.
(Pact-breaking keeps its own Oathbreaker system; the prism covers war-STYLE. The two
compose: an ambush that also breaks a ceasefire earns both.)

## New-player protection (default, tunable)

A fresh Commander cannot be the TARGET of player war declarations until they have either
(a) held a conquered (non-crown) holding, or (b) existed 30 real days — whichever first.
Frontier ground they walk onto is open like anyone's. Attacking others voids the shield
early. Rationale: nobody worth declaring on is shielded; nobody shielded is worth declaring
on.

## Conduct layer (defaults, adjustable at Stage-2 launch)

- **In-fiction cruelty is the game.** Betrayal, slavery, Exterminatus — inside the fiction,
  all of it is legal and priced by the systems (Oathbreaker, prism, war costs).
- **Out-of-fiction harassment is not.** Attacking the player instead of the Commander —
  slurs, dogpiling the person, following someone across contexts — is a moderation matter,
  not a reputation matter. The game systems never launder it.
- **Prose content lines** (gore ceilings, sexual content, real-world hate symbolism) get a
  written policy at Stage-2 launch; forum-standard defaults until then.
- **Pacing:** no obligation to post beyond the windows. Timers are the whole etiquette —
  if the window respects you, no human may demand faster.

## Stage-2 build notes

- Windows, war-states, shields, and judgments must be **server-authoritative** (client
  timers are advisory display only).
- War threads, pacts, and prism verdicts are shared-world objects — the Stage-1 shapes
  (threads, pacts, dossier standings) relocate as designed; this spec adds no new object
  kinds, only rules over them.
- Moderation tooling (reports, mutes, thread-freeze) is backend scope; design at Stage-2
  kickoff against the conduct layer above.

## Recorded for a later slice (explicit)

**Ambush mechanical edges beyond the short window** — revisit after deploy-phase work
(T-BF5) and PvP playtesting:

- **Option B — first-strike round:** ambusher resolves one full round before the defender
  acts. Cinematic and feared; risks alpha-strike dominance at raid scale — would need the
  garrison-favored math as counterweight.
- **Option C — infiltrated deployment:** ambusher deploys anywhere on the board, defender
  in their zone (Stealth/Ambush tag language at thread scale). Positional, out-playable,
  tactically rich; costs a deploy-phase variant, only meaningful in played (not
  statistical) battles.

## Deferred

- Alliances/coalition war declarations (multi-party) — rides the pact v2 vocabulary.
- Player-run territories' internal politics (vassalage, federations) — post-Stage-2.
- Spectator/betting layers on public wars — someday; the Arena wager machinery would host.
