const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
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

/* ── T-MSN-1C task 4: S.progress.streaks ── */

test('S.progress.streaks survives a snapshot round-trip (SAVE is generic — no special-case needed)', () => {
  const S = { world: { missions: {}, missionSeedBase: 1, missionDay: 0 },
              progress: { streaks: { combat_wins: { count: 2, best: 5 },
                                      annihilations: { count: 0, best: 3 } } },
              threads: [], roster: [] };
  const blob = JSON.parse(JSON.stringify(SAVE.snapshot(S)));
  assert.deepStrictEqual(blob.progress, S.progress);
  const relinked = SAVE.relink(blob);
  assert.deepStrictEqual(relinked.progress.streaks.combat_wins, { count: 2, best: 5 });
});

test('an old save with no S.progress at all survives snapshot/relink cleanly (nothing invented, no crash)', () => {
  const S = { world: { missions: {}, missionSeedBase: 1, missionDay: 0 }, threads: [], roster: [] };
  const blob = JSON.parse(JSON.stringify(SAVE.snapshot(S)));
  assert.strictEqual(blob.progress, undefined, 'snapshot must not invent a progress key that was never on S');
  assert.doesNotThrow(() => SAVE.relink(blob));
});

/* T-MSN-1C task 4 gotcha (mirrors the established "S.world key seeding gotcha" — see
   CLAUDE.md memory): S.progress must be seeded in BOTH commitFounding's S={...} literal
   (a brand-new commander is created and enters the shell directly — init()'s backfill
   never runs for them until their NEXT reload) AND init()'s older-save backfill block.
   Neither commitFounding nor init() is a pure DOM-free region (they touch T/enterShell/
   localStorage/Date.now), so there is no headless way to *execute* them — this asserts
   directly against the source text instead, brace-matching each function body first so
   the check is scoped to the right function and can't accidentally match some unrelated
   "progress" string elsewhere in the ~4000-line engine. */
const ENGINE_SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extractFnBody(src, nameSignature) {
  const start = src.indexOf(nameSignature);
  if (start < 0) return null;
  const braceStart = src.indexOf('{', start);
  let depth = 0, i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

test('commitFounding seeds S.progress={streaks:{}} on the S={...} founding literal', () => {
  const body = extractFnBody(ENGINE_SRC, 'function commitFounding(cc){');
  assert.ok(body, 'commitFounding not found in index.html');
  assert.match(body, /progress\s*:\s*\{\s*streaks\s*:\s*\{\s*\}\s*\}/,
    'commitFounding must seed progress:{streaks:{}} — a new commander never hits init()\'s backfill');
});

test('init() backfills S.progress={streaks:{}} for saves made before this task', () => {
  const body = extractFnBody(ENGINE_SRC, 'function init(){');
  assert.ok(body, 'init not found in index.html');
  assert.match(body, /if\s*\(\s*!S\.progress\s*\)\s*S\.progress\s*=\s*\{\s*streaks\s*:\s*\{\s*\}\s*\}\s*;/,
    'init() must backfill S.progress for older saves, mirroring the missionSeedBase/stock/unrest backfill lines');
});
