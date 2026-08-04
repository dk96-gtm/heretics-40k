# Open Recruitment + Local Forge Traditions (T-MST-1, LOCKED with Daak 2026-08-04)

Three rulings from the 2026-08-04 sit (surfaced by T-MSN-1C's T'au Auxiliary Doctrine
row, which is unwinnable while rosters are faction-pure). Audit first established the
actual current state: gear (shop/altar/reliquary/armour) is ALREADY ruler-shelf +
any-buyer; the Muster is a hardcoded 3-model demo stub; the forge affinity gate is the
one true player-identity lock.

## The rulings

1. **Geography is the shelf, everywhere.** You buy what the LOCAL door stocks, and the
   local door stocks the RULING faction's catalog (+ commons where they exist). Ork
   planet → Ork muster. Unchanged for gear; extended to models.
2. **Models: allegiance-gated purchase.** Any Commander may recruit models of any
   faction sharing their allegiance (Imperial ↔ Imperial, Chaos ↔ Chaos,
   Xenos ↔ Xenos) from a muster whose shelf offers them. Never cross-allegiance.
3. **Forge: local tradition, no player limiter.** The forgeable affinity-tag list is
   the RULING faction's `forge_affinities` — whoever you are. An Aeldari commander on
   a conquered Daemon World forges Daemon tags. Cross-allegiance explicitly allowed.
   Unruled/contested ground → no ruler → **no forge tradition** (empty tag list, UI
   says so). Tier gating on top-grade tags unchanged.

## Build shape

- **Canon (v1.29 → 1.30):** new `rules.market` block codifying the three rulings
  (machine-readable flags + prose), so the law lives in data, not accident:
  `{ shelf: "ruler", items_open: true, models: "same_allegiance",
     forge_affinity_source: "ruler" }` + a `note`. Bump every test version pin.
- **Engine — pure DOOR core additions (node-tested):**
  - `musterList(canon, shelfFactionId, tier)` → the shelf faction's roster rows,
    class-gated by tier (I: Core only · II: + all classes · III: all + bulk rate),
    priced (`pc`, bulk = `muster_bulk_discount` at III — existing constant).
  - `canRecruit(canon, buyerFactionId, shelfFactionId)` → `{ok}` or `{ok:false, why}`
    on allegiance mismatch / no shelf faction.
- **Engine — glue:**
  - Muster branch of `renderDoor` rebuilt on the pure helpers: real shelf, gate
    message when allegiance mismatches, recruit action unchanged in shape but armour
    default comes from the MODEL's own faction (`migrateLoadout(nm, shelfFactionId)`)
    — an Ork boy arrives in Ork plate.
  - Forge branch: `_aff` re-keyed from `S.player.faction` to `doorFactionId()`;
    null ruler → empty list + "No forge tradition holds this ground." line; the
    "not your forge affinity" copy becomes "not in this forge's tradition".
- **Tests:** pure musterList/canRecruit truth tables (tier gating, bulk price,
  allegiance matrix incl. cross-allegiance refusal) · canon `rules.market` pin ·
  version pins 1.30 · engine-syntax boot proxy · browser E2E (recruit a foreign
  same-allegiance model; foreign forge tags listed on a conquered world).

## Explicitly unchanged

Ruler-shelf gear behavior (now law) · reliquary ruler-only relics · muster tier
ladder semantics · rank-1 recruits · Rites of Creation own-faction starting roster ·
forge tag tier gates.

## Out of scope

Cross-allegiance mercenaries (never, by ruling) · recruit price premiums (flat pc;
tuning later if play demands) · NPC use of open recruitment · T-MSN-1C signatures
(resumes after this slice; T'au row rides it).
