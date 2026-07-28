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
  assert.deepStrictEqual(M.face_doors, { KILL: 'muster', HOLD: 'throne_room', LOGISTICS: 'shop', RITUAL: 'altar' });
});

test('pilot mission rows: purge, item_request, rebuild', () => {
  const U = canon.missions.universal;
  assert.ok(Array.isArray(U) && U.length === 3);
  const byId = {};
  U.forEach(m => { byId[m.id] = m; });
  assert.deepStrictEqual(Object.keys(byId).sort(), ['item_request', 'purge', 'rebuild']);
  U.forEach(m => {
    ['id', 'n', 'family', 'kind', 'target_roll', 'params', 'world_effect', 'flavor'].forEach(k =>
      assert.ok(k in m, m.id + ' has ' + k));
    assert.ok(Array.isArray(m.target_roll) && m.target_roll.length === 2);
  });
  assert.strictEqual(byId.purge.kind, 'count_kill');
  assert.strictEqual(byId.item_request.kind, 'collect_item');
  assert.strictEqual(byId.rebuild.kind, 'restore');
  assert.strictEqual(byId.rebuild.prefer_condition, 'Ruined');
});

test('face_doors values are real door kinds', () => {
  const doorKinds = canon.galaxy.doors.map(d => d.kind);
  Object.values(canon.rules.missions.face_doors).forEach(v =>
    assert.ok(doorKinds.includes(v), v + ' must be a real door kind'));
});

test('canon is v1.21', () => {
  assert.strictEqual(canon.meta.version, '1.21');
});
