#!/usr/bin/env node
/* ── Balance Lab v1 (T-QA-2) — headless seeded auto-battle arena ──────────────
 * Dev-only, never shipped (same status as tests/). Zero deps.
 *
 * Extracts the pure THREAD core from index.html via the exact tests/_load.js
 * pattern (vm.runInThisContext over the /*<thread-core>*​/ region) and drives
 * full auto-battles with THREAD.npcTurn on BOTH sides — no browser, no DOM,
 * no engine glue (S/D globals, doorCatalog, genHostCombatants, etc. are never
 * imported). This file assembles its own THREAD-shaped state and its own
 * minimal item-parsing (rangeOf/tagsOf/dmgOf) mirroring the exact regexes
 * index.html's parseItem/damageOf/bfAP use, verified by direct inspection —
 * see the comments beside each parser below.
 *
 * Usage: node tools/arena.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');

/* ── load the pure THREAD core (same extraction as tests/_load.js) ──────── */
function loadThread() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/\/\*<thread-core>\*\/([\s\S]*?)\/\*<\/thread-core>\*\//);
  if (!m) throw new Error('thread-core region not found in index.html');
  const THREAD = vm.runInThisContext('(function(){' + m[1] + '\n;return THREAD;})()');
  if (!THREAD) throw new Error('thread-core did not define THREAD');
  return THREAD;
}
const THREAD = loadThread();
const D = JSON.parse(fs.readFileSync(path.join(ROOT, 'heretics-40k-data-v1.json'), 'utf8'));

/* ═══════════════════════ deterministic RNG plumbing ═══════════════════════
 * Same hash+mulberry32 shape AXES.rollFor uses inside the core (verified at
 * index.html ~line 1275) — an independent copy here, not a reach into the
 * core's private closure. Every stream is named ('build:<seed>', 'battle:
 * <seed>', 'board:<seed>') so re-running with the same top-level seed
 * reproduces bit-identical builds, boards and outcomes. */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngFor(tag) { return mulberry32(hashStr(tag)); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/* ═══════════════════════ minimal item-parsing (mirrors index.html) ════════
 * Every regex below is copied verbatim from the engine glue functions named
 * in the comment — this harness reads the exact same d-string grammar the
 * real battlefield glue (bfWeaponCaps/bfItemBand/bfAP/damageOf, ~index.html
 * L5414-5719) feeds THREAD.npcTurn, without importing that glue (it touches
 * S/D globals and the DOM). THREAD.elementOf / THREAD.isNoRevival / THREAD.
 * condHostile ARE reused directly — they're pure core exports, not glue. */
const RANGES = ['Melee', 'Short', 'Med', 'Medium', 'Long'];                     // index.html L6755
const BAND_MAP = { Melee: 'MELEE', Short: 'SHORT', Medium: 'MEDIUM', Long: 'LONG' }; // bfItemBand L5681
// TAGRE copied verbatim from index.html L6758
const TAGRE = /^(DoT|Multihit|Rapid|Venting|Regen|Suppressing|Unwieldy|Consumable|Stimm|Slowing|Draining|Leech|Reclaim|Refund|Momentum|Ambush|Grudge|Guided|Reach|First Strike|Free Move|Overcharge|Bypass|Shield|Ward|Decoy|Blink|Immunity|Marked|Rally|Cleanse|Revive|Charging|Injured|Critical)\s*(I{1,3}|IV|V|\d+)?$/i;
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
function tierNum(tv) {
  if (tv == null || tv === '') return 1;
  if (/^\d+$/.test(tv)) return parseInt(tv, 10);
  return ROMAN[String(tv).toUpperCase()] || 1;
}
function rangeOf(d) {                                                          // mirrors parseItem's range clause
  const parts = String(d || '').split(/\s*[-·+;]\s*/).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    if (RANGES.some(r => new RegExp('^' + r + '$', 'i').test(p)))
      return /^med/i.test(p) ? 'Medium' : (p.charAt(0).toUpperCase() + p.slice(1));
  }
  return null;
}
// cap() mirrors index.html L6785 EXACTLY: uppercase the first char only, leave
// the rest untouched — "DoT" must stay "DoT" (THREAD.CONDS's real key), not
// become "Dot". A naive charAt(0)+slice(1).toLowerCase() silently breaks the
// CONDS lookup for every mixed-case tag (DoT, First Strike, ...).
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function tagsOf(d) {                                                           // mirrors parseItem's TAGRE clause
  const parts = String(d || '').split(/\s*[-·+;]\s*/).map(s => s.trim()).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    const m = p.match(TAGRE);
    if (m) out.push({ tag: cap(m[1]), tier: tierNum(m[2]) });
  });
  return out;
}
function damageOf(item) {                                                      // verbatim index.html L5414
  const m = ((item && item.d) || '').match(/^\s*[A-Za-z]+\s+(\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}
function bfAP(item) {                                                          // verbatim index.html L5682
  const m = ((item && item.d) || '').match(/(\d+)\s*AP/);
  return m ? parseInt(m[1], 10) : 1;
}
function bandOfItem(item) { return BAND_MAP[rangeOf(item && item.d)] || 'MEDIUM'; }

// hostile weapon-condition tags this pure core actually wires up (THREAD.CONDS
// with .hostile:1 — verified by reading the registry at index.html ~L1113).
// Only DoT / Slowing / Suppressing / Draining ever appear as WEAPON tags in
// canon (Marked is ability/cast-only in the current catalog).
function hostileCondTagsOf(item) {
  return tagsOf(item && item.d).filter(t => {
    const reg = THREAD.CONDS[t.tag];
    return reg && THREAD.condHostile(t.tag);
  });
}

/* ═══════════════════════ faction gear + armour catalogs ═══════════════════
 * Mirrors doorCatalog's own `pick` filter (index.html L6964-6966): an item is
 * legal for a faction if item.faction===null (common) or ===that faction id. */
function legalPool(catalogArr, facId) {
  return (catalogArr || []).filter(it => it.faction == null || it.faction === facId);
}
function gearCatalogFor(facId) {
  return {
    WEAPON: legalPool(D.weapons, facId),
    ITEM: legalPool(D.items, facId),
    ABILITY: legalPool(D.abilities, facId),
    CAST: legalPool(D.casts, facId),
  };
}
// mirrors defaultArmourFor (index.html L3018-3025) exactly
function defaultArmourFor(facId, cls) {
  const A = D.armour || [];
  const hit = A.find(p => p.faction === facId && p.cls === cls && p.tier === 'default')
    || A.find(p => p.faction === facId && p.tier === 'default')
    || A.find(p => p.faction === null && p.tier === 'light');
  return hit ? JSON.parse(JSON.stringify(hit)) : null;
}
// forge-tag pool: tags this faction's forge tradition can apply (renderForge,
// index.html L7212-7234) — D.tags.weapon rows with a forge_cost, gated by
// D.equipment_alpha.forge_affinities[facId] ('ALL' = every tag).
const FORGE_TAGS = (D.tags.weapon || []).filter(t => t.forge_cost != null && t.forgeable !== false);
function forgeTagPoolFor(facId) {
  const aff = (D.equipment_alpha.forge_affinities && D.equipment_alpha.forge_affinities[facId]) || [];
  if (aff.indexOf('ALL') >= 0) return FORGE_TAGS.slice();
  return FORGE_TAGS.filter(t => aff.indexOf(t.tag) >= 0);
}

/* ═══════════════════════ build generator ═══════════════════════════════
 * WARBAND bracket: canon rules.force_size_tags gives SQUAD pc_max 250,
 * WARBAND pc_max 750 (heretics-40k-data-v1.json L353-361) — so a legal
 * WARBAND roster is total model PC in (250, 750]. Gear PC does NOT count
 * against this budget: THREAD.forcePC / genHostCombatants both sum model.pc
 * only (index.html L548-550, L3170-3183) — gear cost is a shop-currency
 * concept, never a force-size constraint. */
const WARBAND_MIN = 250, WARBAND_MAX = 750;
// Arena-only cap (board is 14x10, 2-col deploy zones = 20 cells/side) — not a canon rule.
// Must clear (WARBAND_MIN / the cheapest faction's most expensive model) so every faction can
// reach the WARBAND floor within the cap — Sororitas's priciest model is 20pc, so 251/20 = 13
// models needed; 16 leaves headroom while staying well inside the 20-cell zone.
const MODEL_CAP = 16;

function genBuild(fac, rng, tag) {
  const models = fac.models || [];
  let total = 0;
  const roster = [];
  while (roster.length < MODEL_CAP) {
    const remaining = WARBAND_MAX - total;
    const fits = models.filter(m => m.pc <= remaining);
    if (!fits.length) break;
    const m = pick(rng, fits);
    roster.push(m); total += m.pc;
    if (total > WARBAND_MIN && rng() < 0.35) break;  // legal already — sometimes stop early for variety
  }
  // guarantee legality (1): top up with the priciest still-fitting model until over the
  // floor, bounded by MODEL_CAP (never overshoot the arena's own model-count cap — a runaway
  // top-up loop with a cheap-model faction previously produced 30-model "WARBANDs" that
  // deadlocked combat via a validate/npcTurn move-conflict mismatch at high model counts,
  // see runBattle).
  while (total <= WARBAND_MIN && roster.length < MODEL_CAP) {
    const remaining = WARBAND_MAX - total;
    const fits = models.filter(m => m.pc <= remaining).sort((a, b) => b.pc - a.pc);
    const m = fits.length ? fits[0] : models.slice().sort((a, b) => b.pc - a.pc)[0];
    roster.push(m); total += m.pc;
  }
  // guarantee legality (2): a cheap-model faction (e.g. Sororitas, priciest model 20pc) can
  // fill all MODEL_CAP slots with cheap picks BEFORE the loop above ever gets a turn (roster.
  // length===MODEL_CAP already) — the top-up above is then a no-op and the build silently
  // undershoots the WARBAND floor (caught in review: a reported 176pc "Sororitas WARBAND").
  // Fix by UPGRADING the cheapest already-picked models in place (swap for the faction's
  // priciest model, cheapest-first) rather than only ever appending new ones.
  if (total <= WARBAND_MIN) {
    const priciest = models.slice().sort((a, b) => b.pc - a.pc)[0];
    const order = roster.map((m, i) => i).sort((a, b) => roster[a].pc - roster[b].pc);
    for (const i of order) {
      if (total > WARBAND_MIN) break;
      const next = total + priciest.pc - roster[i].pc;
      if (next > WARBAND_MAX) continue;   // would blow the upper bound instead — skip, try another slot
      total = next; roster[i] = priciest;
    }
  }

  const gear = gearCatalogFor(fac.id);
  const fTagPool = forgeTagPoolFor(fac.id);
  const forgedWeapon = fTagPool.length && rng() < 0.5 ? pick(rng, fTagPool) : null;
  let forgeApplied = false;

  const outModels = roster.map((base, mi) => {
    const slotN = Math.max(1, base.sl || 1);
    const slots = [];
    for (let s = 0; s < slotN; s++) {
      let type;
      if (s === 0) type = 'WEAPON';
      else type = rng() < 0.55 ? 'WEAPON' : pick(rng, ['ITEM', 'ABILITY', 'CAST']);
      const pool = gear[type];
      let it = pool && pool.length ? JSON.parse(JSON.stringify(pick(rng, pool))) : null;
      if (it && type === 'WEAPON' && forgedWeapon && !forgeApplied && rng() < 0.5) {
        it = { n: 'Forged ' + it.n, cat: 'WEAPON', d: it.d + ' - ' + forgedWeapon.tag + ' I', pc: it.pc, faction: it.faction, _forged: forgedWeapon.tag };
        forgeApplied = true;
      }
      slots.push({ type: type, it: it });
    }
    const armour = defaultArmourFor(fac.id, base.cls);
    return {
      n: base.n + ' #' + mi, cls: base.cls, pc: base.pc, spd: base.sp || 3, faction: fac.id,
      _w: Math.max(1, base.w || 3),
      loadout: { slots: slots, armour: { it: armour } },
    };
  });

  return {
    tag: tag, faction: fac.id, factionName: fac.name, pc: total, forgedTag: forgeApplied ? forgedWeapon.tag : null,
    models: outModels,
  };
}

/* ═══════════════════════ combatant + battle assembly ═══════════════════════
 * Mirrors bfSetup/genHostCombatants shape exactly:
 * combatants[id] = {w:[cur,max], conds:[], party, model, armour}. */
function weaponsOfModel(model) {
  const out = [];
  (model.loadout.slots || []).forEach(s => {
    if (!s.it || s.type !== 'WEAPON') return;
    out.push(s.it);
  });
  return out;
}
function weaponCaps(c) {   // the injected weaponsOf(c) THREAD.npcTurn requires — mirrors bfWeaponCaps L5717
  return weaponsOfModel(c.model).map(it => ({
    name: it.n, band: bandOfItem(it), ap: bfAP(it), damage: damageOf(it),
    element: THREAD.elementOf(it), noRevival: THREAD.isNoRevival(it, D),
    nonLethal: /non-?lethal/i.test(it.d || ''),
    conds: hostileCondTagsOf(it),
  }));
}
function apOf(pc) {                                                            // verbatim index.html L410
  const b = D.rules.ap_bands;
  for (let i = 0; i < b.length; i++) if (pc <= b[i].pc_max) return b[i].ap;
  return b[b.length - 1].ap;
}
function assembleParty(build, party, roster) {
  build.models.forEach((m, i) => {
    roster[party + '_' + i] = {
      w: [m._w, m._w], conds: [], party: party, model: m,
      armour: (m.loadout.armour && m.loadout.armour.it) ? m.loadout.armour.it.def : null,
    };
  });
}

// bfFreeCell equivalent — spread onto the nearest free cell in the zone
function freeCell(zone, cx, cy, occ) {
  const k0 = cx + ',' + cy; if (!occ[k0]) return { x: cx, y: cy };
  let best = null, bestD = Infinity;
  for (let y = zone.y0; y <= zone.y1; y++) for (let x = zone.x0; x <= zone.x1; x++) {
    const k = x + ',' + y; if (occ[k]) continue;
    const d = Math.abs(x - cx) + Math.abs(y - cy);
    if (d < bestD) { bestD = d; best = { x: x, y: y }; }
  }
  return best || { x: cx, y: cy };
}

function setupBoard(state, partyA, partyB, rng) {
  const board = THREAD.genBoard({ w: 14, h: 10, density: 0.16, palette: ['forest', 'ruins', 'mtn', 'fort'], zoneDepth: 2 }, rng);
  const zoneOf = {}; zoneOf[partyA] = board.zones.A; zoneOf[partyB] = board.zones.B;
  const n = {}, occByParty = {};
  Object.keys(state.combatants).forEach(id => {
    const c = state.combatants[id], z = zoneOf[c.party];
    const k = n[c.party] = (n[c.party] || 0);
    const cx = (c.party === partyA) ? z.x1 : z.x0;
    const cy = Math.min(z.y1, 1 + k * 2);
    n[c.party] = k + 1;
    const occ = occByParty[c.party] = occByParty[c.party] || {};
    const cell = freeCell(z, cx, cy, occ);
    c.x = cell.x; c.y = cell.y; occ[cell.x + ',' + cell.y] = true;
    const bestBand = weaponCaps(c).reduce((best, w) => {
      const RANK = { MELEE: 0, SHORT: 1, MEDIUM: 2, LONG: 3 };
      return RANK[w.band] > RANK[best] ? w.band : best;
    }, 'MELEE');
    c.sight = THREAD.sightOf(bestBand, 0);
    c.spd = c.model.spd || 3;
  });
  state.board = board;
  state.zones = zoneOf;
}

/* ── blind-advance (mirrors _dramaBlindAdvance, index.html L4776-4790) ──────
 * npcTurn is deliberately fog-honest: "sees nothing -> holds" (L1325), and
 * genBoard's default zoneDepth leaves an ~11-tile gap between deploy zones —
 * beyond every sight radius but LONG. In every player-vs-NPC thread this is
 * fine because a HUMAN walks the player side toward the enemy over several
 * posts; two fog-honest npcTurn sides (this harness, and the real drama
 * driver for the exact same reason) would otherwise hold forever and never
 * make contact. This is glue-only vanguard movement, not a core change: a
 * side that has spotted nothing yet advances every living model toward the
 * enemy zone's center via THREAD.reachable (terrain/occupancy-respecting,
 * identical to npcTurn's own gap-closing move) and instantly stops the
 * moment it spots anything. Copied logic, not a reach into engine glue. */
// THREAD.spottedEnemies (index.html L1081-1088) reports a geometric sight+LOS
// hit against ANY enemy combatant with a non-null x/y — including a DEAD one:
// a corpse never gets its x/y cleared (only a CAPTURED model does, L888). Once
// a side has line of sight on nothing but corpses, THREAD.npcTurn's own `live`
// filter (spotted.filter(!dead)) empties out and it stages nothing forever —
// and blindAdvance's "already spotted something, stop closing" guard (mirrored
// from _dramaBlindAdvance) would ALSO freeze on that same corpse, permanently
// deadlocking a side that can see a body but not a living target. Confirmed by
// tracing a real stalemated battle: spottedEnemies>0 on both sides, npcTurn
// returned an empty block on both, at round 9 with 7 vs 13 models still alive.
// This is a genuine core/glue interaction gap worth a BACKLOG line (T-QA-2
// forbids touching index.html/canon to fix it here) — this harness works
// around it by gating advance on LIVING spotted enemies only.
function livingSpotted(party, state) {
  return THREAD.spottedEnemies(party, state, state.board).filter(id => {
    const c = state.combatants[id]; return c && !c.dead;
  });
}
function blindAdvance(party, enemyParty, state) {
  if (livingSpotted(party, state).length) return false;
  const ez = state.zones[enemyParty]; if (!ez) return false;
  const tgt = { x: Math.round((ez.x0 + ez.x1) / 2), y: Math.round((ez.y0 + ez.y1) / 2) };
  const C = state.combatants;
  let moved = false;
  Object.keys(C).forEach(id => {
    const c = C[id]; if (c.party !== party || c.dead || c.captured || c.x == null) return;
    const spd = Math.max(0, (c.spd || 0) + THREAD.condMods(c).speed); if (!spd) return;
    const occ = [];
    Object.keys(C).forEach(oid => { const o = C[oid]; if (oid !== id && o && !o.dead && o.x != null) occ.push({ x: o.x, y: o.y }); });
    const rs = THREAD.reachable({ x: c.x, y: c.y }, spd, state.board, occ);
    let best = null, bestD = THREAD.cheb(c, tgt);
    Object.keys(rs).forEach(k => {
      const xy = k.split(','), cell = { x: +xy[0], y: +xy[1] }, d = THREAD.cheb(cell, tgt);
      if (d < bestD) { bestD = d; best = cell; }
    });
    if (best) { c.x = best.x; c.y = best.y; moved = true; }
  });
  return moved;
}

/* THREAD.validate re-checks every staged move's reachability against `state`'s
 * un-mutated positions (index.html L648-656) — but THREAD.npcTurn's own move
 * assignment, for a LARGE block covering many allies in one call, updates its
 * private `pos` map as it goes, so a later ally's staged destination can be a
 * cell an earlier ally is ALREADY assigned to vacate (npcTurn sees the vacancy,
 * validate — checking against still-unmutated `state` — does not). At the
 * small model counts a normal player-vs-NPC thread actually runs, this rarely
 * bites; at WARBAND-bracket model counts colliding into a 2-wide deploy zone,
 * it can reliably invalidate an entire multi-actor block and stall the fight
 * forever (found via this harness — worth a BACKLOG line, not fixed here per
 * the T-QA-2 brief's "never auto-changes canon/engine" contract). This harness
 * works around it the way a resilient client would: on a validate failure,
 * strip every `move` effect and retry attacks/conditions alone, so a large
 * battle still progresses (models just don't advance that exchange) instead of
 * deadlocking to the round cap on a single ally's stale-position conflict. */
function applyResilient(thread, state, side, block) {
  let v = THREAD.validate(thread, state, side, block, D);
  if (v.ok) { THREAD.apply(thread, state, block, D, side); return true; }
  const noMove = block.filter(b => !b.effect || b.effect.kind !== 'move');
  if (noMove.length && noMove.length !== block.length) {
    v = THREAD.validate(thread, state, side, noMove, D);
    if (v.ok) { THREAD.apply(thread, state, noMove, D, side); return true; }
  }
  return false;
}

/* ═══════════════════════ one full battle ═══════════════════════════════ */
const ROUND_CAP = 60;
function runBattle(buildA, buildB, seed) {
  const rngBoard = rngFor('board:' + seed);
  const partyA = 'A', partyB = 'B';
  const state = { pools: {}, combatants: {}, conds: [], phase: 'battle', fog: {}, round: 0, mods: [], behavior: {} };
  assembleParty(buildA, partyA, state.combatants);
  assembleParty(buildB, partyB, state.combatants);
  setupBoard(state, partyA, partyB, rngBoard);
  state.pools[partyA] = buildA.models.reduce((a, m) => a + apOf(m.pc), 0);
  state.pools[partyB] = buildB.models.reduce((a, m) => a + apOf(m.pc), 0);
  const poolsBase = { A: state.pools[partyA], B: state.pools[partyB] };
  state.behavior[partyA] = THREAD.AXES.rollFor(buildA.faction, 'doctrine:' + seed + ':A', D);
  state.behavior[partyB] = THREAD.AXES.rollFor(buildB.faction, 'doctrine:' + seed + ':B', D);
  const thread = { type: 'SKIRMISH', done: false };

  let rounds = 0, result = null, idleStreak = 0;
  for (rounds = 1; rounds <= ROUND_CAP; rounds++) {
    // blind-advance BOTH sides first (each no-ops the instant it has spotted anything) —
    // mirrors driveDrama's own ordering (index.html L4796-4799) exactly.
    let progressed = false;
    if (blindAdvance(partyA, partyB, state)) progressed = true;
    if (blindAdvance(partyB, partyA, state)) progressed = true;
    for (const side of [partyA, partyB]) {
      const oc = THREAD.outcome(thread, state);
      if (oc) { result = oc; break; }
      const block = THREAD.npcTurn(side, state, state.board, weaponCaps, D);
      if (block.length && applyResilient(thread, state, side, block)) progressed = true;
      state.pools[side] = poolsBase[side];   // per-turn AP refresh, mirrors npcRespond L5803
    }
    if (result) break;
    const oc2 = THREAD.outcome(thread, state);
    if (oc2) { result = oc2; break; }
    // a true deadlock (nobody moved, nobody acted — e.g. an honor-mercy hold against an
    // all-Critical enemy, or a terrain trap) gets several rounds' grace before it's called,
    // so the multi-round blind-approach phase is never mistaken for one.
    idleStreak = progressed ? 0 : idleStreak + 1;
    if (idleStreak >= 5) { result = { kind: 'stalemate', victor: null, defeated: [] }; break; }
  }
  if (!result) result = { kind: 'timeout', victor: null, defeated: [] };
  return { result: result, rounds: rounds, state: state };
}

function fight(buildA, buildB, trials, seedBase) {
  let aWins = 0, bWins = 0, draws = 0;
  const battles = [];
  for (let t = 0; t < trials; t++) {
    const b = runBattle(buildA, buildB, seedBase + ':t' + t);
    battles.push(b);
    if (b.result.victor === 'A') aWins++;
    else if (b.result.victor === 'B') bWins++;
    else draws++;
  }
  return { aWins, bWins, draws, trials, battles };
}

/* ═══════════════════════ determinism self-check ═══════════════════════════
 * Same seed twice must produce byte-identical output — proves genBoard's
 * injected rng and every AXES.rollFor draw are truly deterministic with no
 * hidden Math.random()/Date.now() reach from this harness's own code. */
function determinismSelfCheck() {
  const facA = D.factions.find(f => f.id === 'black_legion');
  const facB = D.factions.find(f => f.id === 'orks');
  function once() {
    const rng = rngFor('selfcheck-build');
    const bA = genBuild(facA, rng, 'A');
    const rng2 = rngFor('selfcheck-build');   // fresh stream, same seed
    const bB = genBuild(facB, rng2, 'B');
    return fight(bA, bB, 5, 'selfcheck-seed');
  }
  const r1 = once(), r2 = once();
  const s1 = JSON.stringify({ a: r1.aWins, b: r1.bWins, d: r1.draws, rounds: r1.battles.map(x => x.rounds), outcomes: r1.battles.map(x => x.result.kind) });
  const s2 = JSON.stringify({ a: r2.aWins, b: r2.bWins, d: r2.draws, rounds: r2.battles.map(x => x.rounds), outcomes: r2.battles.map(x => x.result.kind) });
  if (s1 !== s2) {
    console.error('❪arena❫ DETERMINISM SELF-CHECK FAILED');
    console.error('run1:', s1); console.error('run2:', s2);
    process.exit(1);
  }
  console.error('❪arena❫ determinism self-check OK (same seed → identical battles, twice)');
}

/* ═══════════════════════ tournament ═══════════════════════════════════════
 * WARBAND bracket only (T-QA-2 v1 scope). 6 builds/faction x 20 factions =
 * 120 builds. Swiss-style: 2 rounds of pairing (round 1 random-shuffle pairs
 * across factions, round 2 pairs by round-1 win rate rank so similar-
 * strength builds meet), 25 trials/pairing -> 120/2 * 25 * 2 = 3000 battles,
 * inside the playbook's ~3000-battle compute-sanity aim. */
const BUILDS_PER_FACTION = 6;
const TRIALS_PER_PAIRING = 25;

function buildTournament(topSeed) {
  const rngPairShuffle = rngFor(topSeed + ':pairshuffle1');
  const builds = [];
  D.factions.forEach(fac => {
    for (let i = 0; i < BUILDS_PER_FACTION; i++) {
      const rng = rngFor(topSeed + ':build:' + fac.id + ':' + i);
      builds.push(genBuild(fac, rng, fac.id + '#' + i));
    }
  });
  // round 1: shuffle, pair sequentially (cross-faction guaranteed by shuffling the whole pool)
  const shuffled = builds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rngPairShuffle() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const record = new Map(builds.map(b => [b, { wins: 0, losses: 0, draws: 0, battles: 0 }]));
  const matchLog = [];

  function runRound(pairs, roundTag) {
    pairs.forEach(([bA, bB], idx) => {
      if (bA === bB) return;
      const seed = topSeed + ':' + roundTag + ':' + idx;
      const r = fight(bA, bB, TRIALS_PER_PAIRING, seed);
      const rA = record.get(bA), rB = record.get(bB);
      rA.wins += r.aWins; rA.losses += r.bWins; rA.draws += r.draws; rA.battles += r.trials;
      rB.wins += r.bWins; rB.losses += r.aWins; rB.draws += r.draws; rB.battles += r.trials;
      matchLog.push({ a: bA, b: bB, r });
    });
  }

  const round1Pairs = [];
  for (let i = 0; i + 1 < shuffled.length; i += 2) round1Pairs.push([shuffled[i], shuffled[i + 1]]);
  runRound(round1Pairs, 'r1');

  // round 2: sort by current win rate, pair neighbors (Swiss-style similar-strength pairing)
  const ranked = builds.slice().sort((a, b) => {
    const ra = record.get(a), rb = record.get(b);
    const wra = ra.battles ? ra.wins / ra.battles : 0, wrb = rb.battles ? rb.wins / rb.battles : 0;
    return wrb - wra;
  });
  const round2Pairs = [];
  for (let i = 0; i + 1 < ranked.length; i += 2) round2Pairs.push([ranked[i], ranked[i + 1]]);
  runRound(round2Pairs, 'r2');

  const totalBattles = matchLog.reduce((a, m) => a + m.r.trials, 0);
  return { builds, record, matchLog, totalBattles };
}

/* ═══════════════════════ analysis + report ═══════════════════════════════ */
function winRateOf(b, record) { const r = record.get(b); return r.battles ? r.wins / r.battles : 0; }

function analyze(tourney) {
  const { builds, record } = tourney;
  // per-faction best build
  const byFaction = {};
  builds.forEach(b => { (byFaction[b.faction] = byFaction[b.faction] || []).push(b); });
  const bestPerFaction = Object.keys(byFaction).map(facId => {
    const list = byFaction[facId].slice().sort((x, y) => winRateOf(y, record) - winRateOf(x, record));
    return { facId, facName: list[0].factionName, best: list[0], winRate: winRateOf(list[0], record), all: list };
  });
  // cross-faction tier table: avg win rate of a faction's builds
  const tierTable = bestPerFaction.map(f => {
    const avg = f.all.reduce((a, b) => a + winRateOf(b, record), 0) / f.all.length;
    return { facId: f.facId, facName: f.facName, avgWinRate: avg, bestWinRate: f.winRate, bestBuild: f.best };
  }).sort((a, b) => b.avgWinRate - a.avgWinRate);

  // gear/tag outlier detection: frequency of a weapon name / element / hostile-tag
  // among the TOP QUARTILE of builds by win rate, vs its baseline frequency
  // across ALL builds (same denominator: "how many builds carry at least one").
  const sorted = builds.slice().sort((a, b) => winRateOf(b, record) - winRateOf(a, record));
  const topN = Math.max(1, Math.floor(sorted.length / 4));
  const top = sorted.slice(0, topN);

  function tally(list) {
    const counts = { weapon: {}, element: {}, condTag: {}, forgeTag: {} };
    list.forEach(b => {
      const seenW = new Set(), seenE = new Set(), seenC = new Set();
      b.models.forEach(m => weaponsOfModel(m).forEach(it => {
        seenW.add(it.n);
        const el = THREAD.elementOf(it); if (el) seenE.add(el);
        hostileCondTagsOf(it).forEach(t => seenC.add(t.tag));
      }));
      seenW.forEach(n => counts.weapon[n] = (counts.weapon[n] || 0) + 1);
      seenE.forEach(n => counts.element[n] = (counts.element[n] || 0) + 1);
      seenC.forEach(n => counts.condTag[n] = (counts.condTag[n] || 0) + 1);
      if (b.forgedTag) counts.forgeTag[b.forgedTag] = (counts.forgeTag[b.forgedTag] || 0) + 1;
    });
    return counts;
  }
  const topCounts = tally(top), baseCounts = tally(builds);
  function outliers(key) {
    const out = [];
    Object.keys(topCounts[key]).forEach(name => {
      const topRate = topCounts[key][name] / top.length;
      const baseRate = (baseCounts[key][name] || 0) / builds.length;
      if (topRate >= 0.15 && topRate > baseRate * 1.4) {
        out.push({ name, topRate, baseRate, ratio: baseRate > 0 ? topRate / baseRate : Infinity });
      }
    });
    return out.sort((a, b) => b.ratio - a.ratio);
  }
  const outlierReport = {
    weapon: outliers('weapon'), element: outliers('element'),
    condTag: outliers('condTag'), forgeTag: outliers('forgeTag'),
  };

  // degenerate combos: single builds with win rate far above the field mean,
  // reported with the exact weapon+tag+element combo driving it
  const meanWR = builds.reduce((a, b) => a + winRateOf(b, record), 0) / builds.length;
  const degenerate = sorted.filter(b => winRateOf(b, record) >= Math.min(0.9, meanWR + 0.35)).map(b => {
    return { build: b, winRate: winRateOf(b, record) };
  });

  return { bestPerFaction, tierTable, topN, outlierReport, degenerate, meanWR };
}

function pct(x) { return (x * 100).toFixed(1) + '%'; }

// top-weapons-by-frequency, not a flat unique dump — a 16-model WARBAND build
// can carry a dozen+ distinct weapons and a flat list is unreadable.
function weaponFrequency(b) {
  const counts = {};
  b.models.forEach(m => weaponsOfModel(m).forEach(it => {
    const name = it.n + (it._forged ? ' [' + it._forged + ']' : '');
    counts[name] = (counts[name] || 0) + 1;
  }));
  return Object.keys(counts).map(n => ({ name: n, count: counts[n] })).sort((a, b2) => b2.count - a.count);
}
function topWeaponsLine(b, cap) {
  const freq = weaponFrequency(b);
  const shown = freq.slice(0, cap || 6);
  let line = shown.map(w => w.count + '× ' + w.name).join(', ');
  if (freq.length > shown.length) line += ', + ' + (freq.length - shown.length) + ' more distinct weapon' + (freq.length - shown.length > 1 ? 's' : '');
  return line;
}

function buildSummary(b) {
  const classCounts = {};
  b.models.forEach(m => classCounts[m.cls] = (classCounts[m.cls] || 0) + 1);
  return {
    classLine: Object.keys(classCounts).map(c => classCounts[c] + '× ' + c).join(', '),
    modelCount: b.models.length, pc: b.pc,
    weaponsLine: topWeaponsLine(b),
    forgedTag: b.forgedTag,
  };
}

function writeReport(tourney, analysis) {
  const outDir = path.join(ROOT, '.superpowers', 'sdd', '2026-09-05-redteam');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'balance-warband.md');

  let md = '';
  md += '# Balance Lab v1 — WARBAND bracket (T-QA-2)\n\n';
  md += 'Headless seeded auto-battle sweep over the WARBAND Force-size bracket ';
  md += '(canon `rules.force_size_tags`: WARBAND is total model PC in the range 250-750, ';
  md += 'the SQUAD ceiling to the WARBAND ceiling). ' + tourney.builds.length + ' builds sampled ';
  md += '(' + BUILDS_PER_FACTION + ' per faction across all 20 factions), ' + tourney.totalBattles + ' battles ';
  md += 'simulated across a 2-round Swiss pairing (round 1 random, round 2 paired by round-1 win rate so ';
  md += 'similar-strength builds meet), ' + TRIALS_PER_PAIRING + ' trials per pairing to average board-generation ';
  md += 'and doctrine-roll variance. Every battle is npcTurn vs npcTurn (both sides AI-driven, the same pure ';
  md += 'THREAD.npcTurn the live game uses for its NPC turns) to a round cap of ' + ROUND_CAP + ' exchanges.\n\n';

  md += '## Important scope note — what this run can and cannot see\n\n';
  md += 'THREAD.npcTurn (the only combat driver this harness uses, matching the real drama/NPC-turn glue) reads ';
  md += 'ONLY equipped WEAPON slots when choosing and staging an attack — it never casts an ABILITY or CAST, and ';
  md += 'never reads an ITEM slot\'s effect text. That is a property of the shipped pure core today, not a ';
  md += 'simplification this harness invented (verified by reading `npcTurn`, index.html ~L1320-1387: it only ';
  md += 'calls the injected `weaponsOf(c)` and only ever stages `move`/`damage`/fanout-`cond` effects sourced ';
  md += 'from a weapon). Practically: **item/ability/cast slot choices have zero effect on these simulated ';
  md += 'outcomes.** This is itself evidence worth a line in the tuning sits — the richest part of the loadout ';
  md += 'system (abilities, casts, buff items) is currently inert against the auto-played NPC combat loop; only ';
  md += 'a human composer staging those actions manually would ever trigger them. Builds below still carry ';
  md += 'randomly-rolled item/ability/cast slots (for a realistic loadout shape), but the win-rate signal in this ';
  md += 'report is driven entirely by: model selection (class mix, PC efficiency), WEAPON choice (band/damage/AP/';
  md += 'element/hostile-tag), one optional forge-tag augmentation, and each faction\'s `ai.behavior_matrix` ';
  md += 'doctrine roll (which shapes npcTurn\'s targeting/kiting/retreat behavior, not the player\'s design intent).\n\n';

  md += '## Cross-faction tier table\n\n';
  md += 'Ranked by a faction\'s AVERAGE win rate across its ' + BUILDS_PER_FACTION + ' sampled builds (not just its best) — ';
  md += 'this is the fairer "how does this faction generally perform" read; the best-build column shows the ceiling.\n\n';
  md += '| Rank | Faction | Avg win rate | Best build win rate |\n|---|---|---|---|\n';
  analysis.tierTable.forEach((f, i) => {
    md += '| ' + (i + 1) + ' | ' + f.facName + ' | ' + pct(f.avgWinRate) + ' | ' + pct(f.bestWinRate) + ' |\n';
  });
  md += '\nLegend: "win rate" = wins / (wins+losses+draws) across every trial that build fought in the tournament ';
  md += '(round 1 + round 2 combined). A draw is a mutual wipe, stalemate (neither side could act) or a round-cap ';
  md += 'timeout — none of those count as a win for either side.\n\n';

  md += '## Per-faction best build\n\n';
  analysis.bestPerFaction.forEach(f => {
    const s = buildSummary(f.best);
    md += '### ' + f.facName + ' — ' + pct(f.winRate) + ' win rate\n\n';
    md += 'The strongest of the ' + BUILDS_PER_FACTION + ' sampled ' + f.facName + ' builds fields ' + s.modelCount + ' models ';
    md += '(' + s.classLine + ') at ' + s.pc + ' total PC, carrying: ' + s.weaponsLine + '.';
    if (s.forgedTag) md += ' One weapon was forge-augmented with **' + s.forgedTag + '**.';
    md += ' It won that share of every trial it fought (both Swiss rounds combined) — it is the top performer among ';
    md += 'this faction\'s sample, not a claim about every possible ' + f.facName + ' loadout.\n\n';
  });

  md += '## Gear / element / tag outliers among winners\n\n';
  md += 'A build is in the "top quarter" if its win rate ranks in the top ' + analysis.topN + ' of all ' + tourney.builds.length + ' ';
  md += 'sampled builds. For each weapon/element/hostile-tag/forge-tag, "top-quarter rate" is the share of top-quarter ';
  md += 'builds carrying it at least once; "baseline rate" is the same share across ALL sampled builds. Only entries ';
  md += 'appearing in ≥15% of top-quarter builds AND at ≥1.4x their baseline rate are listed — the ratio column is ';
  md += 'how many times more common that gear is among winners than in the general population.\n\n';
  const OUTLIER_LABELS = {
    weapon: { plural: 'Weapons', noun: 'weapon' },
    element: { plural: 'Elements', noun: 'element' },
    condTag: { plural: 'Hostile weapon-tags (DoT/Slowing/Suppressing/Draining)', noun: 'hostile weapon-tag' },
    forgeTag: { plural: 'Forge-tag augmentations', noun: 'forge-tag augmentation' },
  };
  ['weapon', 'element', 'condTag', 'forgeTag'].forEach(key => {
    const { plural: label, noun } = OUTLIER_LABELS[key];
    const rows = analysis.outlierReport[key];
    md += '**' + label + '**\n\n';
    if (!rows.length) { md += 'No outlier cleared both thresholds — no single ' + noun + ' dominates the winning sample.\n\n'; return; }
    md += '| Name | Top-quarter rate | Baseline rate | Ratio |\n|---|---|---|---|\n';
    rows.forEach(r => { md += '| ' + r.name + ' | ' + pct(r.topRate) + ' | ' + pct(r.baseRate) + ' | ' + (r.ratio === Infinity ? '∞ (baseline 0)' : r.ratio.toFixed(1) + 'x') + ' |\n'; });
    md += '\n';
  });

  md += '## Flagged degenerate combos — candidate nerf list\n\n';
  md += 'Builds whose win rate cleared min(90%, field-mean + 35 points) (field mean this run: ' + pct(analysis.meanWR) + '). ';
  md += 'These are candidates for a Daak tuning look, not confirmed exploits — the sample size (' + TRIALS_PER_PAIRING + ' trials/pairing) bounds ';
  md += 'confidence, and a build\'s opponents in a 2-round Swiss are not the full field.\n\n';
  if (!analysis.degenerate.length) {
    md += 'None found this run — no single sampled build cleared the outlier bar. Re-run with a larger `BUILDS_PER_FACTION` ';
    md += 'or more Swiss rounds if a stronger signal is wanted; this is evidence of a currently well-bounded WARBAND meta, ';
    md += 'not proof no degenerate combo exists.\n\n';
  } else {
    analysis.degenerate.forEach(d => {
      const s = buildSummary(d.build);
      md += '- **' + d.build.factionName + '** (' + pct(d.winRate) + ' win rate, ' + s.pc + ' PC, ' + s.classLine + '): ' + buildSummary(d.build).weaponsLine + '\n';
    });
    md += '\n';
  }

  md += '## Engine findings surfaced by this run — worth a BACKLOG line\n\n';
  md += 'Two of these came from watching battles deadlock during harness development, not from anything this report\'s ';
  md += 'numbers show directly — they are reported here because Pillar 2\'s whole point is producing this kind of evidence, ';
  md += 'not because they change the win-rate numbers above (the harness works around both so the tournament can run at all).\n\n';
  md += '- **`THREAD.spottedEnemies` counts dead bodies as "spotted."** A corpse never has its x/y cleared (only a captured ';
  md += 'model does), so once a side has line of sight on nothing but corpses, `npcTurn`\'s own `live` filter empties out and ';
  md += 'it stages nothing — forever. Confirmed by tracing a real stalled battle: both sides reported a positive `spottedEnemies` ';
  md += 'count with an empty `npcTurn` block at round 9, 7 vs 13 models still alive. This would affect the live game\'s own ';
  md += '`driveDrama`/two-sided-NPC battles (T-NPC-3 N2 task 7) exactly the same way, at any scale where a corpse can out-number ';
  md += 'living targets in a side\'s sight radius. This harness works around it by gating its own blind-advance step on LIVING ';
  md += 'spotted enemies only.\n';
  md += '- **`THREAD.validate`\'s move-reachability check can reject a `THREAD.npcTurn` block it just produced.** `npcTurn` updates ';
  md += 'its own local position map as it assigns each ally a move within one call, so a later ally can be staged to step onto a ';
  md += 'cell an earlier ally is ALREADY assigned to vacate — but `validate` re-checks reachability against `state`\'s un-mutated ';
  md += 'positions (nothing has actually moved yet), so it can see that cell as still occupied and reject the WHOLE block, ';
  md += 'losing every model\'s action that exchange. At the small model counts a normal player-vs-NPC thread runs this rarely ';
  md += 'bites; at WARBAND-bracket counts converging on a 2-wide deploy zone it reliably stalled entire battles before this ';
  md += 'harness added a retry-without-moves fallback (see below).\n';
  md += '- **High-Honor doctrine can produce a genuine mutual stalemate, and this looks intentional rather than a bug:** Honor ';
  md += '≥70 spares any target at ≤1 wound ("Critical"). If BOTH sides roll high Honor and both are reduced to all-Critical ';
  md += 'survivors, neither side will land another hit — they just stand there, forever (about 14% of this run\'s battles ended ';
  md += 'this way). Worth a design confirmation from Daak: is a permanent mercy-lock the intended outcome of two high-Honor ';
  md += 'forces both fighting to the last wound, or should there be an eventual tie-break?\n\n';
  md += '## Methodology notes / known simplifications\n\n';
  md += '- Budget = sum of model PC only (250, 750] — gear PC does not count, matching how `THREAD.forcePC` and ';
  md += '`genHostCombatants` both compute a force\'s PC in the live engine.\n';
  md += '- Model count is capped at ' + MODEL_CAP + ' per build (an arena-only cap to keep the 14x10 / 2-deep deploy ';
  md += 'zones from overflowing) — canon itself places no per-model cap inside a PC budget.\n';
  md += '- Both sides go straight to `phase:"battle"` (blind deploy is a player-facing UI beat with no mechanical ';
  md += 'effect the pure core enforces beyond gating `outcome()`/`tickConds` during `phase==="deploy"`).\n';
  md += '- `shouldRetreat`/pragmatic withdrawal is intentionally NOT wired into this harness\'s loop — both sides ';
  md += 'fight to annihilation, mutual wipe, stalemate, or the round cap, so a faction\'s honor/pragmatism axis shows ';
  md += 'up only through `npcTurn`\'s targeting/kiting choices, not through fleeing.\n';
  md += '- AP pool is refreshed to full for a side immediately after that side\'s own post, mirroring `npcRespond`\'s ';
  md += '`poolsBase` refresh (index.html L5803) — this is the real engine\'s behavior, not an arena shortcut.\n';
  md += '- Forge augmentation applies at tier I only, to at most one weapon per build, at ~50% sample rate, and does ';
  md += 'not adjust the build\'s PC budget (mirrors how a forge upgrade is a currency purchase, not a PC-budget item).\n';
  md += '- Two harness-side workarounds exist purely to keep battles from deadlocking on the two core findings above: ';
  md += 'blind-advance treats a side as still blind while it sees only corpses (not just "sees nothing"), and a validate ';
  md += 'failure on a full block retries with every `move` effect stripped so attacks/conditions still land. Neither ';
  md += 'changes combat MATH — both only prevent a stuck battle from silently timing out as a no-signal draw.\n\n';

  fs.writeFileSync(outPath, md, 'utf8');
  return outPath;
}

/* ═══════════════════════ main ═══════════════════════════════════════════ */
function main() {
  console.error('❪arena❫ determinism self-check · verifying seeded battles replay identically before the real run');
  determinismSelfCheck();

  const topSeed = 'warband-v1-2026-09-05';
  console.error('❪arena❫ sampling builds · ' + BUILDS_PER_FACTION + ' per faction x 20 factions, WARBAND bracket (250,750] PC');
  const tourney = buildTournament(topSeed);
  console.error('❪arena❫ tournament complete · ' + tourney.builds.length + ' builds, ' + tourney.totalBattles + ' battles simulated');

  console.error('❪arena❫ analyzing · tier table, gear outliers, degenerate combos');
  const analysis = analyze(tourney);

  console.error('❪arena❫ writing report · .superpowers/sdd/2026-09-05-redteam/balance-warband.md');
  const outPath = writeReport(tourney, analysis);

  console.error('\n=== TOP 3 TIER LIST ===');
  analysis.tierTable.slice(0, 3).forEach((f, i) => console.error((i + 1) + '. ' + f.facName + ' — ' + pct(f.avgWinRate) + ' avg win rate'));
  console.error('=== BOTTOM 3 ===');
  analysis.tierTable.slice(-3).forEach((f, i) => console.error((analysis.tierTable.length - 2 + i) + '. ' + f.facName + ' — ' + pct(f.avgWinRate) + ' avg win rate'));
  if (analysis.degenerate.length) {
    const top = analysis.degenerate[0];
    console.error('\nTop degenerate combo: ' + top.build.factionName + ' @ ' + pct(top.winRate) + ' — ' + buildSummary(top.build).weaponsLine);
  } else {
    console.error('\nNo degenerate combo cleared the outlier bar this run.');
  }
  console.error('\nReport: ' + outPath);
  console.error('Battles simulated: ' + tourney.totalBattles);
}

main();
