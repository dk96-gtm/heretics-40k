const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const { loadThread } = require('./_load.js');
const THREAD = loadThread();

const FACTIONS = D.factions.map(f => f.id);

test('canon: version is 1.42', () => {
  assert.equal(D.meta.version, '1.42');
});

test('hall door row exists with 20 per-faction skins and 3 tier lines', () => {
  const hall = D.galaxy.doors.filter(d => d.kind === 'hall')[0];
  assert.ok(hall, 'hall door row missing');
  assert.equal(hall.name, 'Hall');
  for (const f of FACTIONS) assert.ok(typeof hall.skins[f] === 'string' && hall.skins[f].length > 0, 'skin missing: ' + f);
  assert.equal(Object.keys(hall.skins).length, 20);
  for (const t of ['1', '2', '3']) assert.ok(hall.tiers[t], 'tier text missing: ' + t);
});

test('hall placed at the 16 inhabited location types, absent from the rest', () => {
  const HAS = ['hive','city','tradeport','village','manufactorum','forge_temple',
    'military_outpost','fortress','bulwark','shrine','lair','crown','plague_garden',
    'mek_shop','cult_sanctum','tomb_vault'];
  const NOT = ['ruins','warzone','webway_portal','space_station','orbital_dock','orbit','space'];
  for (const lt of D.galaxy.location_types) {
    const has = (lt.doors || []).indexOf('hall') >= 0;
    if (HAS.indexOf(lt.id) >= 0) assert.ok(has, lt.id + ' should carry a hall');
    if (NOT.indexOf(lt.id) >= 0) assert.ok(!has, lt.id + ' must NOT carry a hall (slice A)');
  }
});

test('hall tier-seeds at T3 on Hive Worlds', () => {
  assert.equal(D.rules.doors_tiering.t3_homes.hall, 'Hive World');
});

test('rules.hall: culture + names complete for all 20 factions', () => {
  const H = D.rules.hall;
  assert.ok(H, 'rules.hall missing');
  for (const f of FACTIONS) {
    const c = H.culture[f];
    assert.ok(c && c.flavor && c.commune && c.offer_label && c.offer && c.offer.kind, 'culture incomplete: ' + f);
    assert.ok(['cur', 'item', 'res'].indexOf(c.offer.kind) >= 0, 'bad offer kind: ' + f);
    const n = H.names[f];
    assert.ok(n && n.first.length >= 6 && n.epithets.length >= 4, 'name pool thin: ' + f);
  }
  assert.equal(H.culture.world_eaters.offer.accepts, 'REMAINS');
  assert.equal(H.culture.drukhari.offer.accepts, 'CAPTIVE');
  assert.equal(H.culture.tyranids.offer.res, 'Food');
});

test('rules.hall: pools cover every hall-bearing location type; events are the 4 mood rows', () => {
  const H = D.rules.hall;
  for (const lt of D.galaxy.location_types) {
    if ((lt.doors || []).indexOf('hall') < 0) continue;
    assert.ok(Array.isArray(H.pools[lt.id]) && H.pools[lt.id].length >= 3, 'pool thin: ' + lt.id);
    for (const p of H.pools[lt.id]) assert.ok(p.role && p.registers.length, 'bad pool row in ' + lt.id);
  }
  assert.deepEqual(H.events.map(e => e.id), ['famine_table', 'plague_night', 'good_season', 'holy_day']);
  assert.ok(H.status_roles.Sacked && H.status_roles.Besieged, 'status_roles missing');
});

test('civilians: one body per faction, low-PC, sexed', () => {
  for (const f of FACTIONS) {
    const c = D.civilians[f];
    assert.ok(c, 'civilian missing: ' + f);
    assert.ok(c.pc >= 2 && c.pc <= 8 && c.w >= 1 && c.w <= 2, 'civilian statline off: ' + f);
    assert.ok(['male', 'female', 'varied'].indexOf(c.sex) >= 0, 'bad sex rule: ' + f);
  }
  assert.equal(D.civilians.astartes.sex, 'male');
  assert.equal(D.civilians.custodes.sex, 'male');
  assert.equal(D.civilians.sororitas.sex, 'female');
});

test('rules.hall.regulars: roles, names, weights, phase blocks complete for 20 factions', () => {
  const R = D.rules.hall.regulars;
  assert.ok(R, 'rules.hall.regulars missing');
  assert.deepEqual(R.roles, ['host', 'broker', 'champion']);
  for (const f of FACTIONS) {
    for (const role of R.roles) {
      assert.ok(R.names[f] && typeof R.names[f][role] === 'string' && R.names[f][role].length > 0, 'regular name missing: ' + f + '/' + role);
      assert.ok(R.weights[f] && typeof R.weights[f][role] === 'number', 'regular weight missing: ' + f + '/' + role);
    }
  }
  for (const role of R.roles) {
    assert.ok(Array.isArray(R.phase_blocks[role]) && R.phase_blocks[role].length >= 1, 'phase block missing: ' + role);
    for (const p of R.phase_blocks[role]) assert.ok(p >= 0 && p <= 7, 'bad phase index for ' + role);
  }
});

test('rules.hall.trust: rungs, thresholds, act weights, judge axis, overrides, tyranid ladder', () => {
  const T = D.rules.hall.trust;
  assert.ok(T, 'rules.hall.trust missing');
  assert.deepEqual(T.rungs, ['stranger', 'known', 'trusted', 'sworn']);
  assert.equal(T.thresholds.length, 4);
  assert.equal(T.thresholds[0], 0);
  for (let i = 1; i < 4; i++) assert.ok(T.thresholds[i] > T.thresholds[i - 1], 'thresholds must ascend');
  for (const act of ['offer', 'win', 'noble_loss', 'cheat_caught', 'cheat_clean', 'job_done', 'job_dropped', 'lawbreak', 'presence'])
    assert.ok(typeof T.act_base[act] === 'number', 'act_base missing: ' + act);
  assert.ok(T.act_base.lawbreak < 0 && T.act_base.cheat_caught < 0, 'penalties must be negative');
  for (const ov of ['daemons', 'necrons', 'harlequins']) assert.ok(T.overrides[ov], 'override missing: ' + ov);
  assert.deepEqual(T.tyranid.rungs, ['prey_shaped', 'tasted', 'patterned', 'assimilated_adjacent']);
  assert.equal(T.tyranid.recognition, true);
});

test('every hall skin declares a contest (name + legal resolver) and a hall-law flag', () => {
  const cul = D.rules.hall.culture;
  for (const f of FACTIONS) {
    const row = cul[f];
    assert.ok(row, 'culture row missing: ' + f);
    assert.ok(row.contest && typeof row.contest.name === 'string' && row.contest.name.length > 2,
      'contest name missing: ' + f);
    assert.ok(row.contest.resolver === 'brawl' || row.contest.resolver === 'match',
      'contest resolver must be brawl|match: ' + f);
    assert.equal(typeof row.hall_law, 'boolean', 'hall_law flag missing: ' + f);
  }
  // spec §4: both engines are actually used across the 20 cultures
  const resolvers = FACTIONS.map(f => cul[f].contest.resolver);
  assert.ok(resolvers.indexOf('brawl') >= 0 && resolvers.indexOf('match') >= 0);
  // spec §4: Da Grog Den is the authored exception — brawling IS the contest there
  assert.equal(cul.orks.hall_law, false, 'orks must set hall_law:false');
  assert.equal(cul.orks.contest.resolver, 'brawl');
  const lawless = FACTIONS.filter(f => cul[f].hall_law === false);
  assert.deepEqual(lawless, ['orks'], 'orks is the only authored hall-law exception');
});

test('rules.hall.contest: wager ladder by tier, match odds, cheat + catch curve', () => {
  const C = D.rules.hall.contest;
  assert.ok(C, 'rules.hall.contest missing');
  assert.equal(C.wagered_rung_min, 1);
  for (const t of ['1', '2', '3']) assert.ok(C.wager_by_tier[t] > 0, 'wager missing for tier ' + t);
  assert.ok(C.wager_by_tier['3'] > C.wager_by_tier['1'], 'wagers must climb with tier');
  const M = C.match;
  assert.ok(M.base_win > 0 && M.base_win < 1, 'base_win must be a probability');
  assert.ok(M.cheat_shift > 0, 'cheating must improve the odds');
  assert.ok(M.base_win + M.cheat_shift <= 1, 'cheating must not guarantee a win');
  assert.ok(M.catch_base > 0 && M.catch_base < 1, 'catch_base must be a probability');
  assert.ok(M.cunning_pivot >= 0 && M.cunning_pivot <= 100);
  assert.ok(M.cunning_relief > 0 && M.cunning_relief <= 1, 'cunning relief is a fraction of catch_base');
});

test('rules.hall.law: a barred window and a negative standing notch', () => {
  const L = D.rules.hall.law;
  assert.ok(L, 'rules.hall.law missing');
  assert.ok(L.barred_days >= 1, 'barred_days must bar for at least a day');
  assert.ok(L.standing_penalty < 0, 'hall-law standing penalty must be negative');
});

test('rules.hall.champion: rung-gated training buff and title fight', () => {
  const CH = D.rules.hall.champion;
  assert.ok(CH, 'rules.hall.champion missing');
  assert.equal(CH.train.rung_min, 2);          // TRUSTED
  assert.equal(CH.title.rung_min, 3);          // SWORN
  assert.ok(D.rules.hall.trust.rungs.length === 4, 'rung gates index into the B1 ladder');
  assert.ok(CH.train.cost_mult > 0 && CH.train.days > 0, 'training must cost and must expire');
  // Ruling 17 (B2 final fix wave, C2): the pin that SHOULD have caught the dead buff.
  // `typeof tag === 'string'` alone endorsed a silent no-op: the tag was minted with
  // COND_DUR.Rally's duration of 1, and apply() ticks the posting side's conditions
  // BEFORE it reads condMods, so the instance was spliced off the model on the very
  // first post and contributed nothing, always. Pin the AUTHORED values, and prove the
  // tag actually resolves in the engine's own condition registry — so retuning
  // train.tag to something the registry does not know can never again ship green.
  assert.equal(CH.train.tag, 'Rally');
  assert.equal(CH.train.tier, 1);
  assert.ok(THREAD.CONDS[CH.train.tag], 'train.tag must be a tag the CONDS registry knows');
  const trainDur = THREAD.condDur(CH.train.tag, CH.train.tier);
  assert.ok(Number.isFinite(trainDur) && trainDur > 0,
    'train.tag must resolve to a finite, usable duration in the engine registry');
  // rounds is the authored lifetime of the purchased instance, and it must outlive the
  // first tickConds pass or the buff is dead on arrival (the C2 bug exactly).
  assert.equal(typeof CH.train.rounds, 'number');
  assert.ok(CH.train.rounds >= 2,
    'a purchased buff must survive the first tickConds decrement to ever be felt');
  assert.ok(CH.title.standing_notch > 0, 'a title win notches standing upward');
  assert.ok(CH.title.stake_mult > 1, 'a title fight stakes more than a normal bout');
});
