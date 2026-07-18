const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadThread } = require('./_load');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const THREAD = loadThread();

test('passageCost scales continuously on PC', () => {
  // base(cross_sector)=120, divisor=250. 500 PC -> x2 -> 240.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_sector_same_segmentum', 500, false), 240);
  // base(cross_segmentum)=300. 6000 PC -> x24 -> 7200.
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, false), 7200);
});

test('no threshold cliff: one extra PC costs a little more, never a jump', () => {
  const a = THREAD.passageCost(canon, 'cross_segmentum', 3000, false);
  const b = THREAD.passageCost(canon, 'cross_segmentum', 3001, false);
  assert.ok(b >= a && b - a <= 2, `smooth, got ${a} -> ${b}`);
});

test('Warp Gate waives passage entirely', () => {
  assert.strictEqual(THREAD.passageCost(canon, 'cross_segmentum', 6000, true), 0);
});

test('wordCount strips HTML and counts words', () => {
  assert.strictEqual(THREAD.wordCount('<b>The</b> ravine walls wept ash'), 5);
  assert.strictEqual(THREAD.wordCount('  spaced   out  '), 2);
  assert.strictEqual(THREAD.wordCount('<br>'), 0);
  assert.strictEqual(THREAD.wordCount(''), 0);
});

test('forcePC sums model point costs', () => {
  assert.strictEqual(THREAD.forcePC([{pc:120},{pc:80},{pc:300}]), 500);
  assert.strictEqual(THREAD.forcePC([]), 0);
});

test('create fills defaults and attaches state', () => {
  const t = THREAD.create({ id:'x', type:'SKIRMISH', n:'Test', parties:['A','B'] }, canon);
  assert.deepStrictEqual(t.posts, []);
  assert.strictEqual(t.vis, 'public');
  assert.ok(t.state, 'state attached');
  assert.strictEqual(t.state.joined, false);
});

test('initState seeds combatants and pools from seedState', () => {
  const t = { type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
    seedState:{ pools:{'The Rotward':26,"Sskarith's Brood":14},
      combatants:{ gharn:{ w:[4,8], band:'MELEE', party:'The Rotward' } }, joined:true } };
  const s = THREAD.initState(t, canon);
  assert.strictEqual(s.pools['The Rotward'], 26);
  assert.deepStrictEqual(s.combatants.gharn.w, [4,8]);
  assert.strictEqual(s.joined, true);
});

test('initState for TRAVEL sets the word meter from the tier', () => {
  const t = { type:'TRAVEL', parties:['A'],
    seedState:{ transit:{ tier:'cross_segmentum' }, passage:7200 } };
  const s = THREAD.initState(t, canon);
  assert.strictEqual(s.transit.wordsReq, 800);   // canon cross_segmentum.words
  assert.strictEqual(s.transit.wordsWritten, 0);
  assert.strictEqual(s.passage, 7200);
});

const combatThread = {
  type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
  seedState:{ pools:{'The Rotward':26}, combatants:{
    gharn:{ w:[8,8], band:'SHORT', party:'The Rotward',
      model:{ id:'gharn', n:'Gharn', pc:180, sl:[
        {k:'WEAPON', it:{n:'Bolt Pistol', d:'Rapid fire. 1 AP.', cat:'WEAPON'}},
        {k:'ABILITY', it:{n:'Rage', d:'Melee bonus. 1 AP.', cat:'ABILITY'}} ] } } }, joined:true }
};

test('combat catalog draws actions from a model\'s equipped slots + Move', () => {
  const t = THREAD.create(combatThread, canon);
  const acts = THREAD.catalog(t, t.state, 'The Rotward', canon);
  const names = acts.map(a => a.action);
  assert.ok(names.some(n => /Bolt Pistol/.test(n)), 'weapon action present');
  assert.ok(names.some(n => /Rage/.test(n)), 'ability action present');
  assert.ok(names.some(n => /Move/.test(n)), 'Move always present');
  const move = acts.find(a => /Move/.test(a.action));
  assert.strictEqual(move.cost, 0, 'Move is 0 AP');
});

test('diplomacy catalog offers terms actions', () => {
  const t = THREAD.create({ type:'DIPLOMACY', parties:['You','Vess'], seedState:{terms:null} }, canon);
  const names = THREAD.catalog(t, t.state, 'You', canon).map(a => a.action);
  assert.deepStrictEqual(names, ['Offer','Demand','Accept','Walk away']);
});

test('travel catalog offers Transit post and Arrival challenge', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon);
  const names = THREAD.catalog(t, t.state, 'A', canon).map(a => a.action);
  assert.ok(names.includes('Transit post'));
  assert.ok(names.includes('Arrival challenge'));
});

test('mission and generic have empty catalogs', () => {
  const m = THREAD.create({ type:'MISSION', parties:['A'] }, canon);
  const g = THREAD.create({ type:'GENERIC', parties:['A'] }, canon);
  assert.strictEqual(THREAD.catalog(m, m.state, 'A', canon).length, 0);
  assert.strictEqual(THREAD.catalog(g, g.state, 'A', canon).length, 0);
});

test('validate rejects a block that exceeds the AP pool', () => {
  const t = THREAD.create(combatThread, canon);   // pool The Rotward = 26
  const over = [{actor:'gharn',action:'Attack',cost:20,effect:null},
                {actor:'gharn',action:'Cast',cost:10,effect:null}]; // 30 > 26
  const r = THREAD.validate(t, t.state, 'The Rotward', over, canon);
  assert.strictEqual(r.ok, false);
  assert.match(r.reason, /pool|desperation/i);
});

test('validate accepts a block within pool', () => {
  const t = THREAD.create(combatThread, canon);
  const ok = [{actor:'gharn',action:'Attack',cost:9,effect:null}];
  assert.strictEqual(THREAD.validate(t, t.state, 'The Rotward', ok, canon).ok, true);
});

test('travel never drains a pool - always valid', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon);
  const blk = [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:200}}];
  assert.strictEqual(THREAD.validate(t, t.state, 'A', blk, canon).ok, true);
});
