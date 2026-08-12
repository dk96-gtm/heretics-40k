const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const AXES = ['ferocity','cunning','pragmatism','honor','supremacism'];

// spec §1 table — style = argmax(FER, CUN, SUP), tie order FER > CUN > SUP
const EXPECT_STYLE = {
  black_legion:'decapitation', death_guard:'onslaught', world_eaters:'onslaught',
  thousand_sons:'culling', emperors_children:'decapitation', daemons:'onslaught',
  astartes:'onslaught', militarum:'culling', mechanicus:'culling', sororitas:'onslaught',
  custodes:'decapitation', tyranids:'onslaught', orks:'onslaught', necrons:'culling',
  aeldari:'culling', drukhari:'culling', tau:'culling', gsc:'culling',
  votann:'decapitation', harlequins:'culling'
};

test('doctrine: all 20 factions carry a complete, bounded behavior_matrix row', () => {
  const M = D.ai.behavior_matrix;
  assert.ok(M, 'ai.behavior_matrix exists');
  const facIds = D.factions.map(f => f.id);
  assert.strictEqual(facIds.length, 20);
  for (const id of facIds) {
    const row = M[id];
    assert.ok(row, `row for ${id}`);
    for (const ax of AXES) {
      const a = row[ax];
      assert.ok(a, `${id}.${ax}`);
      for (const k of ['base','spread','plasticity','floor','ceiling'])
        assert.strictEqual(typeof a[k], 'number', `${id}.${ax}.${k} numeric`);
      assert.ok(a.floor >= 0 && a.ceiling <= 100 && a.floor <= a.base && a.base <= a.ceiling,
        `${id}.${ax} bounded (floor<=base<=ceiling in [0,100])`);
    }
  }
});

test('doctrine: style census matches the locked spec table (7/9/4)', () => {
  const M = D.ai.behavior_matrix;
  const styleOf = row => {
    const fer = row.ferocity.base, cun = row.cunning.base, sup = row.supremacism.base;
    return (fer >= cun && fer >= sup) ? 'onslaught' : (cun >= sup) ? 'culling' : 'decapitation';
  };
  const census = { onslaught:0, culling:0, decapitation:0 };
  for (const [id, want] of Object.entries(EXPECT_STYLE)) {
    const got = styleOf(M[id]);
    assert.strictEqual(got, want, `${id} style`);
    census[got]++;
  }
  assert.deepStrictEqual(census, { onslaught:7, culling:9, decapitation:4 });
});

test('doctrine: rules.doctrine tunables block shape', () => {
  const d = D.rules.doctrine;
  assert.ok(d, 'rules.doctrine exists');
  assert.deepStrictEqual(d.styles, { ferocity:'onslaught', cunning:'culling', supremacism:'decapitation' });
  assert.strictEqual(d.retreat.base, 110);
  assert.deepStrictEqual(d.honor, { high:70, low:30 });
  assert.strictEqual(d.lapse.cun_p_per_point, 0.001);
  assert.strictEqual(d.lapse.fer_margin_per_point, 0.001);
  assert.strictEqual(d.lapse.honor_loot_per_point, 0.005);
  assert.strictEqual(d.lapse.honor_loot_min, 0.75);
});

test('doctrine: world_eaters ferocity lore floor is 80', () => {
  assert.strictEqual(D.ai.behavior_matrix.world_eaters.ferocity.floor, 80);
});
