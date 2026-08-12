const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);

test('rules.missions tuning block is complete', () => {
  const M = canon.rules.missions;
  assert.ok(M, 'rules.missions exists');
  assert.strictEqual(M.board_min, 4);
  assert.strictEqual(M.board_max, 6);
  assert.strictEqual(M.accept_cap, 3);
  assert.strictEqual(M.expiry_days, 5);
  assert.deepStrictEqual(M.family_bases, { KILL: 10, HOLD: 12, LOGISTICS: 8, RITUAL: 10 });
  assert.deepStrictEqual(M.family_norms, { KILL: 5, HOLD: 5, LOGISTICS: 5, RITUAL: 5 });
  assert.deepStrictEqual(M.size_clamp, [0.5, 4]);
  assert.strictEqual(M.modifier_mult, 1.5);
  assert.strictEqual(M.signature_premium, 1.5);
  assert.strictEqual(M.named_premium, 1.5);
  assert.deepStrictEqual(M.face_doors, { KILL: 'muster', HOLD: 'throne_room', LOGISTICS: 'shop', RITUAL: 'altar' });
});

test('pilot mission rows: purge, item_request, rebuild', () => {
  const U = canon.missions.universal;
  assert.ok(Array.isArray(U) && U.length === 11);
  const byId = {};
  U.forEach(m => { byId[m.id] = m; });
  assert.deepStrictEqual(Object.keys(byId).sort(), [
    'assassination', 'bounty_hunt', 'consecration', 'defend', 'desecration',
    'item_request', 'kill_team', 'liberation', 'purge', 'rebuild', 'trade_haul'
  ]);
  U.forEach(m => {
    ['id', 'n', 'family', 'kind', 'target_roll', 'params', 'world_effect', 'flavor'].forEach(k =>
      assert.ok(k in m, m.id + ' has ' + k));
    assert.ok(Array.isArray(m.target_roll) && m.target_roll.length === 2);
  });
  assert.strictEqual(byId.purge.kind, 'count_kill');
  assert.strictEqual(byId.item_request.kind, 'collect_item');
  assert.strictEqual(byId.rebuild.kind, 'restore');
  // T-MSN-1B task 5: fixed from the placeholder 'Ruined' to the real galaxy.conditions id 'ruined'
  // (location.condition on real galaxy locations is always lowercase — the old value never matched).
  assert.strictEqual(byId.rebuild.prefer_condition, 'ruined');
  assert.strictEqual(byId.purge.needs_hostiles, true);
  // fix round (CRITICAL): every combat-flavored row needs a garrison to mint, not just purge —
  // otherwise a garrison-less planet mints a permanently-unacceptable "stale notice".
  ['bounty_hunt', 'kill_team', 'assassination', 'liberation', 'defend'].forEach(id =>
    assert.strictEqual(byId[id].needs_hostiles, true, id + ' must require a garrison'));
});

test('face_doors values are real door kinds', () => {
  const doorKinds = canon.galaxy.doors.map(d => d.kind);
  Object.values(canon.rules.missions.face_doors).forEach(v =>
    assert.ok(doorKinds.includes(v), v + ' must be a real door kind'));
});

test('canon is v1.35', () => {
  assert.strictEqual(canon.meta.version, '1.35');
});

test('canon v1.33: 11 universal missions, modifiers + bounty names', () => {
  assert.strictEqual(canon.meta.version, '1.35');
  const U = canon.missions.universal;
  assert.strictEqual(U.length, 11);
  const ids = U.map((m) => m.id);
  for (const id of ['bounty_hunt','kill_team','assassination','liberation','defend','trade_haul','consecration','desecration'])
    assert.ok(ids.includes(id), id);
  for (const m of U) {
    assert.ok(['KILL','HOLD','LOGISTICS','RITUAL'].includes(m.family), m.id);
    assert.ok(m.kind && m.n && m.faces && m.flavor, m.id + ' complete row');
  }
  assert.strictEqual(U.find((m) => m.id === 'consecration').gates.allegiance, 'imperial');
  assert.strictEqual(U.find((m) => m.id === 'desecration').gates.allegiance, 'chaos');
  // T-MSN-1B task 5: condition-weighted picks extended, real galaxy.conditions ids only
  const condIds = canon.galaxy.conditions.map((c) => c.id);
  assert.strictEqual(U.find((m) => m.id === 'liberation').prefer_condition, 'infested');
  assert.strictEqual(U.find((m) => m.id === 'defend').prefer_condition, 'besieged');
  ['ruined', 'infested', 'besieged'].forEach((id) => assert.ok(condIds.includes(id), id));
  const M = canon.rules.missions.modifiers;
  assert.deepStrictEqual(Object.keys(M), ['understrength','lone_wolf','low_tech','ironman','blitz']);
  assert.strictEqual(M.understrength.pc_max, 150);
  assert.strictEqual(M.blitz.post_mult, 0.6);
  assert.ok(canon.rules.missions.bounty_names.length >= 20);
});

test('T-MSN-1C: 18 signature rows, faction-gated, premium constant', () => {
  const S = canon.missions.signatures;
  assert.strictEqual(S.length, 18);
  assert.strictEqual(canon.rules.missions.signature_premium, 1.5);
  const byId = Object.fromEntries(S.map((r) => [r.id, r]));
  const expect = {
    we_skulls: ['world_eaters', 'count_kill'], votann_grudge: ['votann', 'count_kill'],
    ec_perfect_kill: ['emperors_children', 'count_kill'], astartes_the_few: ['astartes', 'count_kill'],
    am_meatgrinder: ['militarum', 'count_kill'], harlequins_flawless: ['harlequins', 'count_kill'],
    sororitas_martyrdom: ['sororitas', 'count_kill'], tau_auxiliary: ['tau', 'count_kill'],
    drukhari_slave_raid: ['drukhari', 'count_kill'], gsc_gene_harvest: ['gsc', 'count_kill'],
    astartes_none_left_behind: ['astartes', 'count_kill'],
    ts_forbidden_lore: ['thousand_sons', 'collect_item'], aeldari_soul_tithe: ['aeldari', 'collect_item'],
    mechanicus_tech_reclamation: ['mechanicus', 'collect_item'],
    bl_long_war: ['black_legion', 'streak'], orks_might_right: ['orks', 'streak'],
    custodes_blood_games: ['custodes', 'streak'], tyranids_amass_biomass: ['tyranids', 'streak'],
  };
  for (const [id, [fac, kind]] of Object.entries(expect)) {
    assert.ok(byId[id], id + ' exists');
    assert.strictEqual(byId[id].gates.faction, fac, id + ' faction gate');
    assert.strictEqual(byId[id].kind, kind, id + ' kind');
    assert.strictEqual(byId[id].signature, true, id + ' signature flag');
  }
  const streakKeys = ['combat_wins', 'duel_wins', 'named_duel_wins', 'annihilations'];
  const sRows = S.filter((r) => r.kind === 'streak');
  assert.deepStrictEqual(sRows.map((r) => r.params.streak_key).sort(), streakKeys.sort());
  assert.ok(sRows.every((r) => r.target_roll[0] === 3 && r.target_roll[1] === 3));
});
