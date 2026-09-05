# Red-Team & Balance Playbook (T-QA-1 / T-QA-2)

Approved by Daak 2026-09-05 ("I LOVE IT"). Two recurring rituals any session can run. Findings are filed as BACKLOG tickets; every confirmed exploit, once fixed, becomes a permanent regression test in `tests/`.

## Pillar 1 — The Red-Team Sweep (T-QA-1)

Run a small sweep after each slice lands; a full sweep before the alpha opens to real players. The lifecycle review (static, code-reading) stays part of every build — this sweep is the dynamic complement: agents PLAY the game with bad intentions.

**Setup (per agent):** `python3 -m http.server 8765` in the repo · Playwright MCP · `window._noPersist=true` FIRST (protects the real save) · real profile flow (demoSave() is dead code).

**The adversary personas** (one agent can run them sequentially — NEVER run multiple browser agents in parallel, they share one Playwright browser and collide):

1. **The Coward** — "never lose a model, neutralize every threat for free." Probes: siege exits, disbands, recalls, tribute lowballs, thread abandonment, timing tricks around clocks.
2. **The Merchant** — "get rich without fighting." Probes: buy/sell loops, exchange arbitrage, mission accept/abandon cycling, seat tax vs price payback, tribute round-trips, commission flips.
3. **The Vandal** — "wreck the world as cheaply as possible." Probes: kin-raid consequences, condition griefing, clock spam, drama abuse, standing manipulation.
4. **The Scummer** — "re-roll fate." Saves/reloads/replays trying to change seeded outcomes (lapses, boards, tribute evals, cadence). Seeding discipline should make every replay identical — prove it stays true.

**Report contract:** each persona reports (a) exploits WITH repro steps, (b) attempts that FAILED and why — the negative space maps where defenses hold. File findings to `.superpowers/sdd/<sweep-date>-redteam/` and confirmed exploits as BACKLOG rows.

**Pillar 1b — The Economy Auditor** (code-only, parallel-safe with the player agent): enumerate every currency/resource SOURCE and SINK in `index.html` + canon, then hunt closed loops (net-positive cycles a player can repeat). No browser needed.

## Pillar 2 — The Balance Lab (T-QA-2)

Meta-build discovery via headless mass simulation. The THREAD core (combat apply/validate, armour mitigation, CONDS, npcTurn + the T-NPC-4 doctrines) is pure and extractable via the `tests/_load*.js` pattern — an arena harness drives full auto-battles at thousands-per-minute, no browser.

**The harness** (`tools/arena.js`, dev-only, never shipped — same status as `tests/`):
- Build generator: for a faction + PC budget, sample legal builds (models from the faction roster; weapons/items/abilities/casts legal per doorCatalog rules + forge-tag affinities; armour ladders).
- Auto-battle: seeded genBoard, both sides driven by `npcTurn` (doctrine-stamped), battle to outcome or round cap. Many trials per pairing to average board RNG.
- Tournament: Swiss/round-robin over sampled builds per size bracket; output win rates, points-efficiency outliers, combo frequency among winners.

**Brackets:** use canon Force-size tags (PC budgets) — start with WARBAND, then SQUAD and COMPANY.

**Report contract:** per bracket — top meta builds per faction, the cross-faction tier picture, standout weapons/tags/ability combos (appearing in winners far above baseline), and flagged degenerate pairings (candidate nerfs). All balance numbers in canon are flagged tunables — the lab produces EVIDENCE for Daak's tuning sits, it never auto-changes canon.

**Cadence:** after any slice touching combat/economy canon; full re-run before alpha opens.
