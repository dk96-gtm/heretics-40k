const test = require('node:test');
const assert = require('node:assert');
const D = require('../heretics-40k-data-v1.json');

const FACS = D.factions.map(f => f.id);

test('rules.standing exists with ladder, matrix, floors', () => {
  const st = D.rules.standing;
  assert.ok(st, 'rules.standing missing');
  assert.strictEqual(st.ladder.length, 6);
  const values = st.ladder.map(r => r.value).sort((a,b)=>a-b);
  assert.deepStrictEqual(values, [-3,-2,-1,0,1,2]);
  assert.strictEqual(st.kin_raid_floor, -3);
  assert.strictEqual(st.own_seed, 2);
});

test('matrix is exactly 20×19, symmetric, no self-cells, all values on the ladder', () => {
  const m = D.rules.standing.matrix;
  assert.deepStrictEqual(Object.keys(m).sort(), FACS.slice().sort());
  for (const a of FACS) {
    const row = m[a];
    assert.strictEqual(Object.keys(row).length, 19, a + ' row must have 19 cells');
    assert.ok(!(a in row), a + ' must not have a self-cell');
    for (const b of Object.keys(row)) {
      assert.ok(FACS.includes(b), a + ' has unknown faction ' + b);
      assert.ok([-3,-2,-1,0,1,2].includes(row[b]), a + '↔' + b + ' off-ladder: ' + row[b]);
      assert.strictEqual(m[b][a], row[b], a + '↔' + b + ' asymmetric');
    }
  }
});

test('the 13 authored lore calls hold', () => {
  const m = D.rules.standing.matrix;
  assert.strictEqual(m.world_eaters.emperors_children, -2);   // Skalathrax
  assert.strictEqual(m.world_eaters.thousand_sons, -1);
  assert.strictEqual(m.emperors_children.aeldari, -3);         // She Who Thirsts
  assert.strictEqual(m.daemons.harlequins, -3);
  assert.strictEqual(m.drukhari.emperors_children, -3);
  assert.strictEqual(m.drukhari.daemons, -2);
  assert.strictEqual(m.mechanicus.sororitas, 1);
  assert.strictEqual(m.mechanicus.votann, -2);
  assert.strictEqual(m.tyranids.gsc, 2);
  assert.strictEqual(m.orks.tyranids, -3);
  assert.strictEqual(m.aeldari.drukhari, -1);
  assert.strictEqual(m.aeldari.harlequins, 2);
  assert.strictEqual(m.astartes.gsc, -2);                      // hidden war, not open
  // Tyranids: WAR with everyone except GSC
  for (const b of Object.keys(m.tyranids))
    if (b !== 'gsc') assert.strictEqual(m.tyranids[b], -3, 'tyranids↔' + b);
});
