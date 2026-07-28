const test = require('node:test');
const assert = require('node:assert');
const { loadSave } = require('./_load-save');
const SAVE = loadSave();

test('S.world.missions and seed/day survive snapshot round-trip', () => {
  const S = { world: { missions: { p1: [{ iid: 'x', mid: 'purge', accepted: true, target: 3, progress: 0 }] },
                       missionSeedBase: 999, missionDay: 4 },
              threads: [], roster: [] };
  const blob = JSON.parse(JSON.stringify(SAVE.snapshot(S)));
  assert.deepStrictEqual(blob.world.missions.p1[0].mid, 'purge');
  assert.strictEqual(blob.world.missionSeedBase, 999);
  assert.strictEqual(blob.world.missionDay, 4);
});
