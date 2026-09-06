#!/usr/bin/env node
/* ── Balance Lab v2 (T-NPC-3.5 task 8) — headless seeded auto-battle arena ────
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
 * v2 (T-NPC-3.5 task 8) rewires the driver onto the six-step brain shipped by
 * tasks 3-7: every model's build now carries a REAL minted kit (`KIT.mint`,
 * the same kit-core the live engine uses at spawn), the battle loop passes a
 * real `kitOf` accessor (reused from the engine's own `kitOfFor` glue via
 * tests/_condglue.js — one source of truth, not a re-implementation), and
 * `state.round` actually advances per exchange (R7 fix — v1 silently reused
 * the same draw seed forever). Consumable kit rows deplete across a battle,
 * mirroring `npcRespond`'s own depletion bookkeeping exactly.
 *
 * Usage: node tools/arena.js
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadKit } = require('../tests/_load-kit');
const { loadAgency } = require('../tests/_load-agency');
const { loadCondGlue } = require('../tests/_condglue');

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
// KIT (kit-core, mints rank-scaled faction-legal kits) + ULT (agency-core, the rng/hashStr
// KIT.mint itself expects as its rngFn arg) + G (the engine's own cond-staging glue, reused
// verbatim so this harness's kitOf produces byte-identical entry shapes to the live game's
// kitOfFor — same technique tests/kit-glue.test.js already uses).
const KIT = loadKit();
const ULT = loadAgency();
const G = loadCondGlue(THREAD);

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
    // T-NPC-3.5 task 8: mint this model instance's real NPC kit (KIT.mint — the exact
    // kit-core the live engine calls at every spawn site, genHostCombatants ~index.html
    // L3894). Rank is sampled uniformly 1-5 per model, NOT derived from PC the way a real
    // live spawn's npcSpecRk does — this is deliberate: live NPC spawns via genHostiles
    // almost never reach past rank 1 (bosses land on rank 2 only; see the flagged R8
    // design gap in BACKLOG), so a Lab that mirrored live spawn ranks would silently
    // starve its own kit-outlier analytics of the ability/cast rungs. Sampling every rank
    // here is what makes "the Lab is unaffected by the R8 gap" true.
    const rk = 1 + Math.floor(rng() * 5);
    const kitSeed = hashStr(tag + ':' + mi + ':kit:' + fac.id + ':' + rk);
    const kit = KIT.mint(fac.id, { rk: rk, cls: base.cls, sub: base.n }, kitSeed, ULT.rng, D);
    return {
      n: base.n + ' #' + mi, cls: base.cls, pc: base.pc, spd: base.sp || 3, faction: fac.id,
      _w: Math.max(1, base.w || 3), rk: rk, kit: kit,
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
// T-NPC-3.5 task 8: every unique {kind,name} kit action a build's minted models could ever
// actually stage — reuses G.condTagsOf (the SAME cond-tag parse kitOfFor itself calls) so
// "appeared in" matches kitOfFor's own "no stageable cond tag → not a real kit entry" filter
// exactly, rather than counting raw mint noise (e.g. a Stimm-Injector item with no cond tag,
// which mints fine but can never actually be drawn by the brain — see kit-glue.test.js).
function itemsOfBuild(build) {
  const set = new Map();
  const CATS = [['items', 'item'], ['abilities', 'ability'], ['casts', 'cast']];
  build.models.forEach(m => {
    CATS.forEach(([catKey, kind]) => {
      (m.kit && m.kit[catKey] || []).forEach(row => {
        if (!row) return;
        if (!G.condTagsOf(row).length) return;
        set.set(kind + '::' + row.n, { kind, name: row.n, item: row });
      });
    });
  });
  return set;
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
      // T-NPC-3.5 task 8: `gen.kit` is the ONLY shape kitOfFor reads (index.html L6275-6277:
      // `if(!c||!c.gen||!c.gen.kit)return []`) — mirrors genHostCombatants' own combatant
      // shape (`C[spec.id]={...,gen:gen}` where `gen.kit` was minted at spawn). `usedKit`
      // starts empty; npcRespond's exact depletion bookkeeping is replayed in runBattle below.
      gen: { kit: m.kit }, usedKit: {},
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
// THREAD.spottedEnemies (index.html L1087) filters out dead combatants itself
// (T-NPC-3.5 task 2 core fix) — a corpse is never "spotted," so blindAdvance's
// "already spotted something, stop closing" guard can read it directly with
// no separate LIVING-only wrapper.
function blindAdvance(party, enemyParty, state) {
  if (THREAD.spottedEnemies(party, state, state.board).length) return false;
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

// THREAD.validate now walks staged moves against a working position map in
// assignment order (T-NPC-3.5 task 2 core fix), so a later ally's staged
// destination can legally be a cell an earlier ally in the same block is
// vacating — no retry-without-moves fallback is needed any more.
function applyResilient(thread, state, side, block) {
  const v = THREAD.validate(thread, state, side, block, D);
  if (!v.ok) return false;
  THREAD.apply(thread, state, block, D, side);
  return true;
}

/* ═══════════════════════ one full battle ═══════════════════════════════ */
const ROUND_CAP = 60;
function runBattle(buildA, buildB, seed) {
  const rngBoard = rngFor('board:' + seed);
  const partyA = 'A', partyB = 'B';
  // T-NPC-3.5 task 5/8: `state.id` is the thread-id half of the draw seed
  // (`String(state.id||'')+':'+side+':'+turnIx+':'+aid`, index.html L1457-1458) — a state
  // with no id collapses every battle's draw onto the SAME stream regardless of which battle
  // is running. Stamping the battle's own seed here is this harness's equivalent of
  // initState stamping the owning thread's id onto a real combat state.
  const state = { id: seed, pools: {}, combatants: {}, conds: [], phase: 'battle', fog: {}, round: 0, mods: [], behavior: {}, aiTrace: [] };
  assembleParty(buildA, partyA, state.combatants);
  assembleParty(buildB, partyB, state.combatants);
  // T-NPC-3.5 task 8 (R1): the real kitOf accessor, reused verbatim from the engine's own
  // kitOfFor glue (index.html L6275) via _condglue.js — `state` is accepted but not read by
  // kitOfFor itself (kept for interface parity), so building it once up front is safe.
  const kitOf = G.kitOfFor(state);
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
      // T-NPC-3.5 task 8 (R1): kitOf is now the real kit-minted accessor built above —
      // the six-step brain can stage cast/ability/item actions, not just weapon attacks.
      const block = THREAD.npcTurn(side, state, state.board, weaponCaps, kitOf, D);
      if (block.length && applyResilient(thread, state, side, block)) {
        progressed = true;
        // T-NPC-3.5 task 8: depletion mirrors npcRespond exactly (index.html L6588-6592) —
        // a consumed kit row marks itself used on the ACTING combatant so kitOfFor filters
        // it out of every later call (drawn once per model, per canon — no inventory count).
        block.forEach(b => {
          if (b.consumed && b.item) {
            const ac = state.combatants[b.actor];
            if (ac) { ac.usedKit = ac.usedKit || {}; ac.usedKit[b.item.n] = true; }
          }
        });
        // R7 fix: advance state.round per exchange, exactly as npcRespond does right after
        // an NPC post lands (index.html L6593, `THREAD.tickRound(st)`) — v1 never called
        // this, so `turnIx` in the draw seed (index.html L1454) was permanently 0 and every
        // single exchange, for the whole battle, redrew from the identical seeded stream.
        THREAD.tickRound(state);
      }
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

// T-NPC-3.5 task 8: tallies actual npcTurn selections off each battle's `state.aiTrace`
// ring buffer (cap 40, index.html NPCB_TRACE_CAP) into a shared accumulator so the
// tournament-wide "times chosen" analytics (below) don't require holding every trial's
// full state in memory. IMPORTANT CAVEAT (documented again in the report): the ring
// buffer only retains a battle's LAST 40 decisions — on a battle that ran the full
// ROUND_CAP, this is a sample of the endgame, not the complete decision history.
function tallyAiTrace(state, tally) {
  if (!tally) return;
  (state.aiTrace || []).forEach(e => {
    const ch = e && e.chosen;
    if (!ch || !ch.item) return;
    if (ch.kind !== 'cast' && ch.kind !== 'ability' && ch.kind !== 'item') return;
    const key = ch.kind + '::' + ch.item;
    tally.chosen[key] = (tally.chosen[key] || 0) + 1;
  });
}

function fight(buildA, buildB, trials, seedBase, kitTally) {
  let aWins = 0, bWins = 0, draws = 0;
  const battles = [];
  for (let t = 0; t < trials; t++) {
    const b = runBattle(buildA, buildB, seedBase + ':t' + t);
    tallyAiTrace(b.state, kitTally);
    // Only `result`/`rounds` survive past this point — a 3000-battle tournament holding
    // every trial's full combatants/board/aiTrace state would be needlessly heavy; the
    // aiTrace signal worth keeping is already folded into `kitTally` above.
    battles.push({ result: b.result, rounds: b.rounds });
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

/* T-NPC-3.5 task 8 (R7) — round-seed self-check.
 * v1's bug: `state.round` was never advanced by the battle loop, so the draw seed
 * (index.html L1457-1458: `hashStr(String(state.id||'')+':'+side+':'+turnIx+':'+aid)`,
 * `turnIx=state.round`) collapsed onto the SAME stream for every exchange in a battle,
 * forever — the seeded draw never actually explored. Two checks:
 *  (1) formula-level: round 1 vs round 2 of the identical id/side/actor must hash to a
 *      different seed AND draw a different first value, using the exact hashStr+mulberry32
 *      shape verified identical to the core's private npcHash/npcRng (both defined at the
 *      top of this file with a comment pointing at the exact index.html line numbers).
 *  (2) wiring-level: a real battle must actually advance `state.round` past 0, proving
 *      THREAD.tickRound is really being invoked from the loop, not just that (1)'s formula
 *      is theoretically sound. */
function roundSeedSelfCheck() {
  const id = 'roundcheck-seed', side = 'A', actor = 'A_0';
  const seed1 = hashStr(id + ':' + side + ':1:' + actor);
  const seed2 = hashStr(id + ':' + side + ':2:' + actor);
  if (seed1 === seed2) {
    console.error('❪arena❫ ROUND-SEED SELF-CHECK FAILED — round 1 and round 2 hashed identically');
    process.exit(1);
  }
  const draw1 = mulberry32(seed1)(), draw2 = mulberry32(seed2)();
  if (draw1 === draw2) {
    console.error('❪arena❫ ROUND-SEED SELF-CHECK FAILED — round 1 and round 2 drew the identical value');
    process.exit(1);
  }
  const facA = D.factions.find(f => f.id === 'necrons'), facB = D.factions.find(f => f.id === 'aeldari');
  const bA = genBuild(facA, rngFor('roundcheck-build:A'), 'A');
  const bB = genBuild(facB, rngFor('roundcheck-build:B'), 'B');
  const b = runBattle(bA, bB, 'roundcheck-battle');
  if (!(b.state.round >= 2)) {
    console.error('❪arena❫ ROUND-SEED SELF-CHECK FAILED — state.round never advanced past ' + b.state.round + ' (tickRound not firing from the battle loop)');
    process.exit(1);
  }
  console.error('❪arena❫ round-seed self-check OK (round 1 ≠ round 2 seed/draw; a real battle advances state.round to ' + b.state.round + ')');
}

/* ═══════════════════════ tournament ═══════════════════════════════════════
 * WARBAND bracket only (T-QA-2 v1 scope). 6 builds/faction x 20 factions =
 * 120 builds. Swiss-style: 2 rounds of pairing (round 1 random-shuffle pairs
 * across factions, round 2 pairs by round-1 win rate rank so similar-
 * strength builds meet), 25 trials/pairing -> 120/2 * 25 * 2 = 3000 battles,
 * inside the playbook's ~3000-battle compute-sanity aim. */
const BUILDS_PER_FACTION = 6;
const TRIALS_PER_PAIRING = 25;
const KIT_TABLE_CAP = 12;   // top/bottom N rows shown in the kit action analytics table

// T-NPC-3.5 task 8: v1's cross-faction tier table (rank + avg win rate), transcribed
// verbatim from .superpowers/sdd/2026-09-05-redteam/balance-warband.md's "Cross-faction
// tier table" section, so writeReport can print a v1→v2 movement column without re-parsing
// that file at runtime. Faction-name keys are D.factions[].name strings, unchanged since v1.
const V1_TIER_RANK = {
  'Orks': 1, 'Adepta Sororitas': 2, 'Aeldari': 3, 'Astra Militarum': 4, 'Genestealer Cults': 5,
  'Black Legion': 6, 'Leagues of Votann': 7, 'Adeptus Mechanicus': 8, "Emperor's Children": 9,
  'Drukhari': 10, "T'au": 11, 'Tyranids': 12, 'Daemons': 13, 'World Eaters': 14,
  'Adeptus Astartes': 15, 'Necrons': 16, 'Death Guard': 17, 'Thousand Sons': 18,
  'Harlequins': 19, 'Adeptus Custodes': 20,
};
const V1_TIER_AVG = {
  'Orks': 0.793, 'Adepta Sororitas': 0.760, 'Aeldari': 0.713, 'Astra Militarum': 0.683,
  'Genestealer Cults': 0.663, 'Black Legion': 0.660, 'Leagues of Votann': 0.540,
  'Adeptus Mechanicus': 0.530, "Emperor's Children": 0.517, 'Drukhari': 0.517,
  "T'au": 0.457, 'Tyranids': 0.410, 'Daemons': 0.393, 'World Eaters': 0.383,
  'Adeptus Astartes': 0.343, 'Necrons': 0.343, 'Death Guard': 0.233, 'Thousand Sons': 0.207,
  'Harlequins': 0.140, 'Adeptus Custodes': 0.087,
};

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
  // T-NPC-3.5 task 8: `chosen` accumulates from state.aiTrace across every trial (see
  // tallyAiTrace); `appearances` counts trials where at least one participating build
  // carried the item in its minted kit (independent of whether it was ever drawn).
  const kitTally = { chosen: {}, appearances: {} };

  function runRound(pairs, roundTag) {
    pairs.forEach(([bA, bB], idx) => {
      if (bA === bB) return;
      const seed = topSeed + ':' + roundTag + ':' + idx;
      const r = fight(bA, bB, TRIALS_PER_PAIRING, seed, kitTally);
      const rA = record.get(bA), rB = record.get(bB);
      rA.wins += r.aWins; rA.losses += r.bWins; rA.draws += r.draws; rA.battles += r.trials;
      rB.wins += r.bWins; rB.losses += r.aWins; rB.draws += r.draws; rB.battles += r.trials;
      matchLog.push({ a: bA, b: bB, r });
      const carried = new Map([...itemsOfBuild(bA), ...itemsOfBuild(bB)]);
      carried.forEach((_, key) => { kitTally.appearances[key] = (kitTally.appearances[key] || 0) + r.trials; });
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
  return { builds, record, matchLog, totalBattles, kitTally };
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
    const counts = { weapon: {}, element: {}, condTag: {}, forgeTag: {}, kit: {} };
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
      // T-NPC-3.5 task 8: kit outlier category — every distinct minted cast/ability/item
      // this build's roster carries (same "no stageable cond tag → doesn't count" filter
      // as itemsOfBuild), so this reads exactly like the weapon/element/tag tables above.
      itemsOfBuild(b).forEach((v, key) => { counts.kit[key] = (counts.kit[key] || 0) + 1; });
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
    condTag: outliers('condTag'), forgeTag: outliers('forgeTag'), kit: outliers('kit'),
  };

  // degenerate combos: single builds with win rate far above the field mean,
  // reported with the exact weapon+tag+element combo driving it
  const meanWR = builds.reduce((a, b) => a + winRateOf(b, record), 0) / builds.length;
  const degenerate = sorted.filter(b => winRateOf(b, record) >= Math.min(0.9, meanWR + 0.35)).map(b => {
    return { build: b, winRate: winRateOf(b, record) };
  });

  return { bestPerFaction, tierTable, topN, outlierReport, degenerate, meanWR };
}

// T-NPC-3.5 task 8 — the brief's own analytics ask, verbatim: "per cast/ability/item —
// battles it appeared in, times chosen, win-rate delta of builds carrying it." Distinct
// from the presence-only 'kit' outlier table above: this one is driven by REAL runtime
// data (state.aiTrace, via kitTally.chosen), not just what a build's roster carries.
function kitActionAnalytics(tourney) {
  const { builds, record, kitTally } = tourney;
  const carrierSets = new Map(builds.map(b => [b, itemsOfBuild(b)]));
  const keys = new Set([...Object.keys(kitTally.appearances), ...Object.keys(kitTally.chosen)]);
  const rows = [];
  keys.forEach(key => {
    const [kind, name] = key.split('::');
    const carriers = builds.filter(b => carrierSets.get(b).has(key));
    const nonCarriers = builds.filter(b => !carrierSets.get(b).has(key));
    const avgWR = list => list.length ? list.reduce((a, b) => a + winRateOf(b, record), 0) / list.length : null;
    const carrierWR = avgWR(carriers), nonCarrierWR = avgWR(nonCarriers);
    rows.push({
      key, kind, name,
      appearances: kitTally.appearances[key] || 0,
      timesChosen: kitTally.chosen[key] || 0,
      carrierCount: carriers.length, carrierWR, nonCarrierWR,
      delta: (carrierWR != null && nonCarrierWR != null) ? carrierWR - nonCarrierWR : null,
    });
  });
  return rows.sort((a, b) => (b.delta || -1) - (a.delta || -1));
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

function writeReport(tourney, analysis, kitRows) {
  const outDir = path.join(ROOT, '.superpowers', 'sdd', '2026-09-06-lab-v2');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'balance-warband-v2.md');

  let md = '';
  md += '# Balance Lab v2 — WARBAND bracket, full-kit NPCs (T-NPC-3.5 task 8)\n\n';
  md += 'Same shape as [Balance Lab v1](../2026-09-05-redteam/balance-warband.md) (T-QA-2), re-run on top of the ';
  md += 'shipped six-step NPC brain (T-NPC-3.5 tasks 3-7): every model now carries a REAL minted kit (`KIT.mint`, ';
  md += 'the same kit-core the live engine calls at spawn) and `THREAD.npcTurn` is handed a real `kitOf` accessor, ';
  md += 'so cast/ability/item choices are no longer inert against the auto-played NPC combat loop — v1\'s central ';
  md += 'caveat is now resolved. Headless seeded auto-battle sweep over the WARBAND Force-size bracket (canon ';
  md += '`rules.force_size_tags`: WARBAND is total model PC in the range 250-750, the SQUAD ceiling to the WARBAND ';
  md += 'ceiling). ' + tourney.builds.length + ' builds sampled (' + BUILDS_PER_FACTION + ' per faction across all 20 factions), ';
  md += tourney.totalBattles + ' battles simulated across a 2-round Swiss pairing (round 1 random, round 2 paired ';
  md += 'by round-1 win rate so similar-strength builds meet), ' + TRIALS_PER_PAIRING + ' trials per pairing to average ';
  md += 'board-generation and doctrine-roll variance. Every battle is npcTurn vs npcTurn (both sides AI-driven, the ';
  md += 'same pure THREAD.npcTurn the live game uses for its NPC turns) to a round cap of ' + ROUND_CAP + ' exchanges.\n\n';

  md += '## What changed since v1 — what this run can see now\n\n';
  md += 'v1\'s central scope note was that `THREAD.npcTurn` only ever staged WEAPON attacks — item/ability/cast slots ';
  md += 'were rolled onto every build but had zero effect on outcomes. T-NPC-3.5 shipped the six-step brain that fixed ';
  md += 'this: `npcTurn` now takes a `kitOf(c)` accessor (5th argument) that surfaces every cond-carrying cast/ability/item ';
  md += 'a combatant\'s minted kit holds, `enumeratePairs` turns each into a real candidate pair alongside weapon ';
  md += 'attacks, and the same score → axis-tilt → seeded-draw pipeline picks between them. This harness\'s `kitOf` is ';
  md += 'not a re-implementation — it is the engine\'s own `kitOfFor` glue (index.html, `/*<cond-staging-glue>*/`), ';
  md += 'reused verbatim via `tests/_condglue.js`, the same extraction `tests/kit-glue.test.js` already relies on. ';
  md += 'Every model instance in every build below is minted a kit via `KIT.mint` at a UNIFORMLY SAMPLED rank 1-5 ';
  md += '(not the PC-derived rank a real spawn gets — see the flagged R8 gap below), so this run\'s kit-outlier ';
  md += 'analytics exercise the full `rules.npc_kit.depth_by_rank` ladder, including the ability and cast rungs a ';
  md += 'live spawn today almost never reaches.\n\n';
  md += '**Caveat carried forward on the analytics, not the sim:** `state.aiTrace` is a capped ring buffer (40 entries, ';
  md += '`NPCB_TRACE_CAP`) PER BATTLE, so the "times chosen" counts below are drawn from each battle\'s LAST ≤40 ';
  md += 'decisions, not its complete history — an accurate sample of the endgame of a long battle, not a complete ';
  md += 'decision log. "Battles it appeared in" (kit presence) and the win-rate-delta columns are NOT subject to this ';
  md += 'cap — those come from what a build\'s roster actually carries, independent of how much of the trace survived.\n\n';

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

  md += '## v1 → v2 movement — who rose/fell once kits mattered\n\n';
  md += 'v1 ran the SAME 6-builds/faction, 2-round-Swiss, 25-trials-per-pairing shape on an all-weapon, no-kit brain ';
  md += '(`.superpowers/sdd/2026-09-05-redteam/balance-warband.md`). Comparing v1\'s rank to this run\'s rank isolates how ';
  md += 'much minted kits (plus the R7 round-ticking fix, which made the seeded draw actually explore instead of reusing ';
  md += 'round 0 forever) moved each faction\'s standing. Some of this movement is real signal, some is Swiss-pairing + ';
  md += '25-trial sampling noise (the same caveat v1 itself flagged) — treat a 1-2 rank move either way as noise-band, and ';
  md += 'the larger swings as worth a second look.\n\n';
  md += '| Faction | v1 rank | v1 avg WR | v2 rank | v2 avg WR | Rank Δ |\n|---|---|---|---|---|---|\n';
  analysis.tierTable.forEach((f, i) => {
    const v1r = V1_TIER_RANK[f.facName], v1w = V1_TIER_AVG[f.facName];
    const v2r = i + 1;
    const delta = (v1r != null) ? (v1r - v2r) : null;   // positive = rose (a lower rank NUMBER is better)
    const arrow = delta == null ? '—' : delta > 0 ? '▲' + delta : delta < 0 ? '▼' + (-delta) : '=';
    md += '| ' + f.facName + ' | ' + (v1r != null ? v1r : '—') + ' | ' + (v1w != null ? pct(v1w) : '—') + ' | ' +
      v2r + ' | ' + pct(f.avgWinRate) + ' | ' + arrow + ' |\n';
  });
  md += '\nLegend: "Rank Δ" = v1 rank minus v2 rank — ▲N = rose N places (stronger relative to the field once kits ';
  md += 'mattered), ▼N = fell N places, "=" = unchanged. Both tables rank by the SAME "avg win rate across a faction\'s ';
  md += 'sampled builds" metric (not best-build), so the comparison is apples-to-apples.\n\n';

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

  md += '## Gear / element / tag / kit outliers among winners\n\n';
  md += 'A build is in the "top quarter" if its win rate ranks in the top ' + analysis.topN + ' of all ' + tourney.builds.length + ' ';
  md += 'sampled builds. For each weapon/element/hostile-tag/forge-tag/kit-action, "top-quarter rate" is the share of ';
  md += 'top-quarter builds carrying it at least once; "baseline rate" is the same share across ALL sampled builds. Only ';
  md += 'entries appearing in ≥15% of top-quarter builds AND at ≥1.4x their baseline rate are listed — the ratio column ';
  md += 'is how many times more common that gear is among winners than in the general population. The new **Kit actions** ';
  md += 'table is T-NPC-3.5 task 8\'s own addition — "carrying" a cast/ability/item now means something to a battle\'s ';
  md += 'outcome, unlike v1 where kit slots were cosmetic.\n\n';
  const OUTLIER_LABELS = {
    weapon: { plural: 'Weapons', noun: 'weapon' },
    element: { plural: 'Elements', noun: 'element' },
    condTag: { plural: 'Hostile weapon-tags (DoT/Slowing/Suppressing/Draining)', noun: 'hostile weapon-tag' },
    forgeTag: { plural: 'Forge-tag augmentations', noun: 'forge-tag augmentation' },
    kit: { plural: 'Kit actions (cast/ability/item)', noun: 'kit action' },
  };
  // 'kit' outlier names are 'kind::name' keys (see itemsOfBuild) — split for display.
  const kitLabel = name => { const [kind, ...rest] = name.split('::'); return rest.join('::') + ' (' + kind + ')'; };
  ['weapon', 'element', 'condTag', 'forgeTag', 'kit'].forEach(key => {
    const { plural: label, noun } = OUTLIER_LABELS[key];
    const rows = analysis.outlierReport[key];
    md += '**' + label + '**\n\n';
    if (!rows.length) { md += 'No outlier cleared both thresholds — no single ' + noun + ' dominates the winning sample.\n\n'; return; }
    md += '| Name | Top-quarter rate | Baseline rate | Ratio |\n|---|---|---|---|\n';
    rows.forEach(r => {
      const shown = key === 'kit' ? kitLabel(r.name) : r.name;
      md += '| ' + shown + ' | ' + pct(r.topRate) + ' | ' + pct(r.baseRate) + ' | ' + (r.ratio === Infinity ? '∞ (baseline 0)' : r.ratio.toFixed(1) + 'x') + ' |\n';
    });
    md += '\n';
  });

  md += '## Kit action analytics — from `state.aiTrace` (T-NPC-3.5 task 8)\n\n';
  md += 'The outlier table above answers "do winners carry this more than the field" from what a build\'s roster holds. ';
  md += 'This table answers a different question with REAL runtime data: per cast/ability/item, how many battles it ';
  md += 'actually appeared in (carried by a participating build), how many times `npcTurn`\'s seeded draw actually ';
  md += 'CHOSE it (subject to the 40-entry `aiTrace` ring-buffer cap noted above — an endgame sample, not a full log), ';
  md += 'and the win-rate delta between builds that carry it and builds that don\'t. Sorted by win-rate delta, richest ';
  md += 'first; only the top ' + KIT_TABLE_CAP + ' and bottom ' + KIT_TABLE_CAP + ' rows are shown (full tally has ' + kitRows.length + ' distinct kit actions).\n\n';
  if (!kitRows.length) {
    md += 'No cast/ability/item ever produced a stageable kit entry this run (every minted row lacked a cond tag) — ';
    md += 'nothing to tabulate.\n\n';
  } else {
    md += '| Kind | Name | Battles appeared in | Times chosen | Carrier win rate | Non-carrier win rate | Δ win rate |\n|---|---|---|---|---|---|---|\n';
    const rowLine = r => '| ' + r.kind + ' | ' + r.name + ' | ' + r.appearances + ' | ' + r.timesChosen + ' | ' +
      (r.carrierWR != null ? pct(r.carrierWR) : '—') + ' | ' + (r.nonCarrierWR != null ? pct(r.nonCarrierWR) : '—') + ' | ' +
      (r.delta != null ? (r.delta >= 0 ? '+' : '') + pct(r.delta) : '—') + ' |\n';
    const shown = kitRows.length <= KIT_TABLE_CAP * 2 ? kitRows : kitRows.slice(0, KIT_TABLE_CAP).concat(kitRows.slice(-KIT_TABLE_CAP));
    shown.forEach((r, i) => {
      if (kitRows.length > KIT_TABLE_CAP * 2 && i === KIT_TABLE_CAP) md += '| … | … | … | … | … | … | … |\n';
      md += rowLine(r);
    });
    md += '\nLegend: "Battles appeared in" = trials where at least one participating build carried this cast/ability/item ';
    md += 'in its minted kit (independent of whether it was ever drawn). "Times chosen" = occurrences in a battle\'s final ';
    md += '`aiTrace` where `npcTurn` actually staged it (ring-buffer-capped, see above — a lower bound, not a full count). ';
    md += '"Carrier"/"Non-carrier win rate" = the average win rate (analysis.tierTable\'s own per-build metric) of builds ';
    md += 'that do/don\'t carry the item; "Δ win rate" is carrier minus non-carrier — a positive delta means builds ';
    md += 'carrying that action tended to win more, but with only ' + BUILDS_PER_FACTION + ' builds/faction this is a ';
    md += 'correlational signal (a build that happens to carry a strong item also has whatever weapon/model choices made ';
    md += 'it strong), not a controlled A/B — a candidate for a focused follow-up sweep, not a tuning verdict on its own.\n\n';
  }

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
  md += 'The first three below carry forward from v1 (they are still true, and this run still reflects the fix — no ';
  md += 'harness workaround was needed to produce these numbers); the fourth is new to this task.\n\n';
  md += '- **`THREAD.spottedEnemies` counted dead bodies as "spotted" (FIXED, T-NPC-3.5 task 2).** A corpse never had its ';
  md += 'x/y cleared (only a captured model does), so once a side had line of sight on nothing but corpses, `npcTurn`\'s own ';
  md += '`live` filter emptied out and it staged nothing — forever. Confirmed by tracing a real stalled battle: both sides ';
  md += 'reported a positive `spottedEnemies` count with an empty `npcTurn` block at round 9, 7 vs 13 models still alive. ';
  md += 'This affected the live game\'s own `driveDrama`/two-sided-NPC battles (T-NPC-3 N2 task 7) exactly the same way, at ';
  md += 'any scale where a corpse could out-number living targets in a side\'s sight radius. `spottedEnemies` now filters ';
  md += '`!dead` itself, so neither this harness nor the live game needs a LIVING-only workaround around it any more.\n';
  md += '- **`THREAD.validate`\'s move-reachability check could reject a `THREAD.npcTurn` block it just produced (FIXED, ';
  md += 'T-NPC-3.5 task 2).** `npcTurn` updates its own local position map as it assigns each ally a move within one call, ';
  md += 'so a later ally could be staged to step onto a cell an earlier ally was ALREADY assigned to vacate — but `validate` ';
  md += 're-checked reachability against `state`\'s un-mutated positions (nothing had actually moved yet), so it could see ';
  md += 'that cell as still occupied and reject the WHOLE block, losing every model\'s action that exchange. At the small ';
  md += 'model counts a normal player-vs-NPC thread runs this rarely bit; at WARBAND-bracket counts converging on a 2-wide ';
  md += 'deploy zone it reliably stalled entire battles. `validate` now walks staged moves against a working position map ';
  md += 'in assignment order, so a leapfrog like this validates correctly with no retry needed.\n';
  md += '- **High-Honor doctrine can produce a genuine mutual stalemate, and this looks intentional rather than a bug:** Honor ';
  md += '≥70 spares any target at ≤1 wound ("Critical"). If BOTH sides roll high Honor and both are reduced to all-Critical ';
  md += 'survivors, neither side will land another hit — they just stand there, forever (about 14% of this run\'s battles ended ';
  md += 'this way). Worth a design confirmation from Daak: is a permanent mercy-lock the intended outcome of two high-Honor ';
  md += 'forces both fighting to the last wound, or should there be an eventual tie-break?\n';
  md += '- **v1\'s harness never advanced `state.round`, so the seeded draw never explored (FIXED, T-NPC-3.5 task 8, R7).** ';
  md += 'The draw seed `npcTurn` feeds `drawAction` is `hashStr(state.id+\':\'+side+\':\'+state.round+\':\'+actor)` — v1\'s ';
  md += '`runBattle` built `state` with `round:0` and never called `THREAD.tickRound`, so `state.round` stayed 0 for every ';
  md += 'exchange of every battle: the same (side,actor) pair drew from the IDENTICAL stream turn after turn, all battle ';
  md += 'long. This never affected v1\'s own numbers (v1 had no kit pairs to draw between — a weapon-only candidate pool with ';
  md += 'one dominant option barely notices a frozen seed), but it would have silently flattened this run\'s kit-choice ';
  md += 'variety had it not been caught: v2\'s `runBattle` now calls `THREAD.tickRound(state)` right after every applied ';
  md += 'exchange, exactly where `npcRespond` calls it in the live engine, and a startup self-check (`roundSeedSelfCheck`) ';
  md += 'now asserts a real battle actually advances `state.round` and that round 1 vs round 2 hash to different seeds.\n';
  md += '- **Flagged design gap, not fixed here (R8, from BACKLOG):** `MISSION.genHostiles` mints live NPC spawns at rank 1 ';
  md += '(named bosses at rank 2), so a real siege or mission encounter almost never reaches `rules.npc_kit.depth_by_rank`\'s ';
  md += 'ability rung (rank ≥2) and never its cast rung (rank ≥3) except via a boss. This Lab is UNAFFECTED — its build ';
  md += 'generator samples every rank 1-5 uniformly per model specifically so its kit-outlier analytics exercise the full ';
  md += 'ladder — but it means the numbers above describe what full-loadout NPC combat COULD look like, not what today\'s ';
  md += 'live spawns actually produce in play. Worth a Daak design decision: should `genHostiles`/`npcSpecRk` scale spawn ';
  md += 'rank with mission difficulty/day, or is rank-1-except-bosses the intended default?\n\n';
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
  md += '- Each model instance\'s kit rank (1-5, feeding `KIT.mint`\'s depth ladder) is sampled UNIFORMLY, independent of ';
  md += 'the model\'s PC or the build\'s total budget — this is deliberately NOT how a live spawn picks a rank (`npcSpecRk` ';
  md += 'derives it from a PC ratio against the growth curve) so this Lab exercises the full depth ladder regardless of the ';
  md += 'R8 gap above; it does mean an individual build\'s kit richness is not itself a signal about that build\'s PC efficiency.\n';
  md += '- `state.aiTrace` is a 40-entry ring buffer PER BATTLE — the "times chosen" analytics above sample each battle\'s ';
  md += 'final ≤40 decisions, not its complete history. Longer battles (more exchanges before a decisive outcome) under-report ';
  md += 'their early-battle choices relative to short ones; this is a property of the shipped core\'s trace cap, not an arena ';
  md += 'shortcut.\n\n';

  fs.writeFileSync(outPath, md, 'utf8');
  return outPath;
}

/* ═══════════════════════ main ═══════════════════════════════════════════ */
function main() {
  console.error('❪arena❫ determinism self-check · verifying seeded battles replay identically before the real run');
  determinismSelfCheck();
  console.error('❪arena❫ round-seed self-check · verifying state.round advances and round 1 ≠ round 2 seed (R7)');
  roundSeedSelfCheck();

  const topSeed = 'warband-v2-2026-09-06';
  console.error('❪arena❫ sampling builds · ' + BUILDS_PER_FACTION + ' per faction x 20 factions, WARBAND bracket (250,750] PC, real minted kits');
  const tourney = buildTournament(topSeed);
  console.error('❪arena❫ tournament complete · ' + tourney.builds.length + ' builds, ' + tourney.totalBattles + ' battles simulated');

  console.error('❪arena❫ analyzing · tier table, gear/kit outliers, degenerate combos');
  const analysis = analyze(tourney);
  const kitRows = kitActionAnalytics(tourney);

  console.error('❪arena❫ writing report · .superpowers/sdd/2026-09-06-lab-v2/balance-warband-v2.md');
  const outPath = writeReport(tourney, analysis, kitRows);

  console.error('\n=== TOP 3 TIER LIST (v2) ===');
  analysis.tierTable.slice(0, 3).forEach((f, i) => console.error((i + 1) + '. ' + f.facName + ' — ' + pct(f.avgWinRate) + ' avg win rate'));
  console.error('=== BOTTOM 3 ===');
  analysis.tierTable.slice(-3).forEach((f, i) => console.error((analysis.tierTable.length - 2 + i) + '. ' + f.facName + ' — ' + pct(f.avgWinRate) + ' avg win rate'));
  console.error('\n=== BIGGEST v1→v2 MOVERS ===');
  const movers = analysis.tierTable.map((f, i) => {
    const v1r = V1_TIER_RANK[f.facName];
    return { facName: f.facName, delta: v1r != null ? v1r - (i + 1) : 0, v2rank: i + 1, v1rank: v1r };
  }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  movers.slice(0, 3).forEach(m => console.error(m.facName + ': v1 #' + m.v1rank + ' → v2 #' + m.v2rank + ' (' + (m.delta >= 0 ? '▲' : '▼') + Math.abs(m.delta) + ')'));
  if (analysis.degenerate.length) {
    const top = analysis.degenerate[0];
    console.error('\nTop degenerate combo: ' + top.build.factionName + ' @ ' + pct(top.winRate) + ' — ' + buildSummary(top.build).weaponsLine);
  } else {
    console.error('\nNo degenerate combo cleared the outlier bar this run.');
  }
  if (kitRows.length) {
    const topKit = kitRows[0];
    console.error('\nTop kit-action by win-rate delta: ' + topKit.name + ' (' + topKit.kind + ') — ' +
      (topKit.delta != null ? (topKit.delta >= 0 ? '+' : '') + pct(topKit.delta) : 'n/a') + ', chosen ' + topKit.timesChosen + '× across ' + topKit.appearances + ' battles');
  }
  console.error('\nReport: ' + outPath);
  console.error('Battles simulated: ' + tourney.totalBattles);
}

main();
