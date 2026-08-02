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
  assert.strictEqual(byId.rebuild.prefer_condition, 'Ruined');
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

test('canon is v1.26', () => {
  assert.strictEqual(canon.meta.version, '1.26');
});

test('canon v1.26: 11 universal missions, modifiers + bounty names', () => {
  assert.strictEqual(canon.meta.version, '1.26');
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
  const M = canon.rules.missions.modifiers;
  assert.deepStrictEqual(Object.keys(M), ['understrength','lone_wolf','low_tech','ironman','blitz']);
  assert.strictEqual(M.understrength.pc_max, 150);
  assert.strictEqual(M.blitz.post_mult, 0.6);
  assert.ok(canon.rules.missions.bounty_names.length >= 20);
});
