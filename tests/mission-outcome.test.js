const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');
const { loadMission } = require('./_load-mission');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();
const MISSION = loadMission();

function seed(objective, combatants, pools) {
  return { id: 'm', type: 'MISSION', n: 'm', turn: 'you',
           forces: ['Mine'],
           seedState: { objective: objective, combatants: combatants || {}, pools: pools || {}, joined: true } };
}
const HOSTILE = () => ({ w: [1, 1], conds: [], party: 'Foe', armour: null,
                         gen: { id: 'e0', n: 'Cultist', cls: 'Core', pc: 10 } });
const MINE = () => ({ w: [4, 4], conds: [], party: 'Mine', armour: null });

test('combat mission exposes the combat catalog', () => {
  const mine = { w: [4, 4], conds: [], party: 'Mine', armour: null,
    model: { id: 'm1', n: 'Test Marine', cls: 'Core', pc: 10,
             sl: [{ k: 'WEAPON', it: { n: 'Combat Blade', cat: 'WEAPON', d: '2 Physical' } }] } };
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 0, params: {}, done: false },
         { m1: mine, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const acts = THREAD.catalog(t, t.state, 'Mine', canon);
  assert.ok(acts.length > 0, 'MISSION with combatants must not return []');
});

test('non-combat mission catalog stays empty (deliver/work are glue buttons)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 2, progress: 0, params: { min_words: 40 }, done: false }), canon);
  assert.deepStrictEqual(THREAD.catalog(t, t.state, [], canon), []);
});

test('outcome: objective done -> mission_won with player party as victor', () => {
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 1, progress: 1, params: {}, done: true },
         { m1: MINE(), e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_won', victor: 'Mine', defeated: ['Foe'] });
});

test('outcome: player side annihilated in a combat mission -> mission_lost', () => {
  const dead = MINE(); dead.w = [0, 4]; dead.dead = true;
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 3, progress: 0, params: {}, done: false },
         { m1: dead, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.deepStrictEqual(oc, { kind: 'mission_lost', victor: 'Foe', defeated: ['Mine'] });
});

test('outcome: unfinished non-combat mission -> null (runs on)', () => {
  const t = THREAD.create(
    seed({ kind: 'restore', target: 3, progress: 1, params: {}, done: false }), canon);
  assert.strictEqual(THREAD.outcome(t, t.state), null);
});

/* T-MSN-1B task 4: modifier picker payout stacking. concludeThread's mission-won branch
   (index.html, not a pure core) is glue: var mc=THREAD.modCheck(t.state,t.mods||[],D,
   (t.posts||[]).length); payout=MISSION.finalPayout(t.mission.payout,mc.valid.length,D).
   These tests exercise the two pure functions that do the actual math. */

test('MISSION.finalPayout stacks modifier_mult per valid id (x1.5^n)', () => {
  assert.strictEqual(MISSION.finalPayout(100, 0, canon), 100);
  assert.strictEqual(MISSION.finalPayout(100, 1, canon), Math.round(100 * 1.5));
  assert.strictEqual(MISSION.finalPayout(100, 2, canon), Math.round(100 * 1.5 * 1.5));
  assert.strictEqual(MISSION.finalPayout(100, 3, canon), Math.round(100 * Math.pow(1.5, 3)));
});

test('conclude payout composition: a voided modifier is excluded from the exponent', () => {
  // lone_wolf holds (exactly 1 living model); understrength voids (over pc_max 150)
  const state = { acceptPC: 999, acceptModels: 1, combatants: {},
                   objective: { kind: 'count_kill', target: 1 } };
  const mc = THREAD.modCheck(state, ['understrength', 'lone_wolf'], canon, 1);
  assert.deepStrictEqual(mc.valid, ['lone_wolf']);
  assert.deepStrictEqual(mc.voided, ['understrength']);
  const payout = MISSION.finalPayout(100, mc.valid.length, canon);
  assert.strictEqual(payout, Math.round(100 * 1.5), 'only the 1 valid id should multiply the base');
});

test('conclude payout composition: every chosen modifier voided -> base payout, no stacking', () => {
  // understrength voids (over pc_max); lone_wolf voids (2 living models, wants exactly 1)
  const state = { acceptPC: 999, acceptModels: 2, combatants: {},
                   objective: { kind: 'count_kill', target: 1 } };
  const mc = THREAD.modCheck(state, ['understrength', 'lone_wolf'], canon, 1);
  assert.deepStrictEqual(mc.valid, []);
  assert.deepStrictEqual(mc.voided, ['understrength', 'lone_wolf']);
  assert.strictEqual(MISSION.finalPayout(100, mc.valid.length, canon), 100);
});

test('LOST missions are a distinct outcome kind from WON (concludeThread only multiplies payout '
  + 'under mission_won — a lost mission never reaches MISSION.finalPayout, so it pays nothing '
  + 'regardless of chosen modifiers)', () => {
  const dead = MINE(); dead.w = [0, 4]; dead.dead = true;
  const t = THREAD.create(
    seed({ kind: 'count_kill', target: 3, progress: 0, params: {}, done: false },
         { m1: dead, e0: HOSTILE() }, { Mine: 10, Foe: 5 }), canon);
  const oc = THREAD.outcome(t, t.state);
  assert.strictEqual(oc.kind, 'mission_lost');
  assert.notStrictEqual(oc.kind, 'mission_won');
});
