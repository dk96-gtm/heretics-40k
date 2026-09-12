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

test('validate accepts a leapfrog: M2 vacates a cell M1 steps into, same block (T-NPC-3.5 fix 2)', () => {
  // M2 b(1,0)->c(2,0) frees the cell M1 a(0,0)->b(1,0) steps into. Each move is legal
  // once processed in assignment order, but today's move check always re-reads the
  // pristine (unmutated) combatant positions, so M1's check still sees M2 sitting at b.
  const board = { w: 3, h: 1 };   // tile-less board = all open (reachable's own contract)
  const st = { pools: { A: 9 }, board, combatants: {
    M1: { w: [10,10], party: 'A', conds: [], x: 0, y: 0, spd: 1 },
    M2: { w: [10,10], party: 'A', conds: [], x: 1, y: 0, spd: 1 } } };
  const block = [
    { actor: 'M2', cost: 0, effect: { kind: 'move', who: 'M2', to: { x: 2, y: 0 } } },
    { actor: 'M1', cost: 0, effect: { kind: 'move', who: 'M1', to: { x: 1, y: 0 } } },
  ];
  const v = THREAD.validate({ type: 'SKIRMISH' }, st, 'A', block, canon);
  assert.strictEqual(v.ok, true, v.reason);
});

test('travel never drains a pool - always valid', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon);
  const blk = [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:200}}];
  assert.strictEqual(THREAD.validate(t, t.state, 'A', blk, canon).ok, true);
});

function freshCombat(){ return THREAD.create({
  type:'SKIRMISH', parties:['The Rotward',"Sskarith's Brood"],
  seedState:{ pools:{'The Rotward':26}, joined:true, combatants:{
    gharn:{ w:[8,8], band:'SHORT', conds:[], party:'The Rotward' },
    thresh:{ w:[10,10], band:'MELEE', conds:[], party:"Sskarith's Brood" } } } }, canon); }

test('apply damage lowers wounds and spends the pool', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state,
    [{actor:'gharn',action:'Attack',cost:9,effect:{kind:'damage',amount:4,to:'thresh'}}], canon);
  assert.deepStrictEqual(t.state.combatants.thresh.w, [6,10]);
  assert.strictEqual(t.state.pools['The Rotward'], 17);   // 26 - 9
});

test('apply band repositions a combatant', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Move',cost:0,effect:{kind:'band',to:'MELEE',who:'gharn'}}], canon);
  assert.strictEqual(t.state.combatants.gharn.band, 'MELEE');
});

test('apply cond adds a condition', () => {
  // T-CMB-1: the old cosmetic string-push seam is replaced by THREAD.applyCond — a
  // staged cond effect now carries a real {tag,tier} payload and lands as a proper
  // instance object (see tests/conds.test.js for the full application-path suite).
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'thresh',action:'Regen',cost:5,effect:{kind:'cond',add:{tag:'Regen',tier:2,src:'Catalyst'},to:'thresh'}}], canon);
  const inst = t.state.combatants.thresh.conds[0];
  assert.strictEqual(inst.tag, 'Regen');
  assert.strictEqual(inst.tier, 2);
});

test('apply slay marks dead and stamps the revival window', () => {
  const t = freshCombat();
  t.state.combatants.thresh.w = [1,10];
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,effect:{kind:'slay',to:'thresh',intact:true}}], canon);
  assert.strictEqual(t.state.combatants.thresh.dead, true);
  assert.ok(t.state.combatants.thresh.revivalWindow != null);
});

test('elementOf parses the leading damage element from item text', () => {
  assert.strictEqual(THREAD.elementOf({d:'Phys 2 - Med - 1 AP'}), 'Physical');
  assert.strictEqual(THREAD.elementOf({d:'Plasma 3 - Med - 2 AP - Venting 1'}), 'Plasma');
  assert.strictEqual(THREAD.elementOf({d:'Warp 4 - Short'}), 'Warp');
  assert.strictEqual(THREAD.elementOf({d:'no element here'}), null);
});

test('slay stamps the element-specific window as a number', () => {
  const t = freshCombat();
  t.state.combatants.thresh.w = [1,10];
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'slay',to:'thresh',intact:true,element:'Heat'}}], canon);
  assert.strictEqual(t.state.combatants.thresh.revivalWindow, 3);   // Heat = 3
  assert.strictEqual(t.state.combatants.thresh.permaDeath, false);
  assert.strictEqual(t.state.combatants.thresh.killElement, 'Heat');
});

test('a no-revival kill is permanent (window 0)', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'slay',to:'thresh',element:'Physical',noRevival:true}}], canon);
  assert.strictEqual(t.state.combatants.thresh.revivalWindow, 0);
  assert.strictEqual(t.state.combatants.thresh.permaDeath, true);
});

test('isNoRevival detects an annihilation source', () => {
  assert.strictEqual(THREAD.isNoRevival({n:'Soulreaper', d:'Warp 5 - Annihilation'}, canon), true);
  assert.strictEqual(THREAD.isNoRevival({n:'Boltgun', d:'Phys 2 - Med'}, canon), false);
});

test('damage overkill floors wounds at 0, never negative', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'damage',amount:99,to:'thresh'}}], canon);
  assert.strictEqual(t.state.combatants.thresh.w[0], 0);
});

test('apply transit accrues words and arrivalReady flips at target', () => {
  const t = THREAD.create({ type:'TRAVEL', parties:['A'], seedState:{transit:{tier:'same_planet'}} }, canon); // words=50
  THREAD.apply(t, t.state, [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:30}}], canon);
  assert.strictEqual(t.state.transit.wordsWritten, 30);
  assert.strictEqual(THREAD.arrivalReady(t.state), false);
  THREAD.apply(t, t.state, [{actor:'A',action:'Transit post',cost:0,effect:{kind:'transit',words:25}}], canon);
  assert.strictEqual(t.state.transit.wordsWritten, 55);
  assert.strictEqual(THREAD.arrivalReady(t.state), true);
});

test('apply terms records agreement', () => {
  const t = THREAD.create({ type:'DIPLOMACY', parties:['You','Vess'] }, canon);
  THREAD.apply(t, t.state, [{actor:'You',action:'Accept',cost:0,effect:{kind:'terms',agreed:true}}], canon);
  assert.strictEqual(t.state.terms.agreed, true);
});

test('combat catalog actions carry their source item', () => {
  const t = THREAD.create(combatThread, canon);
  const atk = THREAD.catalog(t, t.state, 'The Rotward', canon).find(a => /Bolt Pistol/.test(a.action));
  assert.ok(atk.item && atk.item.n === 'Bolt Pistol');
});
test('damage that zeroes a combatant kills it and stamps the element window', () => {
  const t = freshCombat(); t.state.combatants.thresh.w = [3,10];
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'damage',amount:5,to:'thresh',element:'Heat'}}], canon);
  assert.strictEqual(t.state.combatants.thresh.w[0], 0);
  assert.strictEqual(t.state.combatants.thresh.dead, true);
  assert.strictEqual(t.state.combatants.thresh.revivalWindow, 3);   // Heat=3
});
test('a no-revival damage kill is permanent', () => {
  const t = freshCombat(); t.state.combatants.thresh.w = [2,10];
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'damage',amount:5,to:'thresh',element:'Physical',noRevival:true}}], canon);
  assert.strictEqual(t.state.combatants.thresh.permaDeath, true);
  assert.strictEqual(t.state.combatants.thresh.revivalWindow, 0);
});
test('non-lethal damage does not kill', () => {
  const t = freshCombat();
  THREAD.apply(t, t.state, [{actor:'gharn',action:'Attack',cost:9,
    effect:{kind:'damage',amount:2,to:'thresh',element:'Physical'}}], canon);
  assert.ok(!t.state.combatants.thresh.dead);
});

test('armour mitigates damage by element, floored at 0', () => {
  const thread = { type:'SKIRMISH', seedState:{ joined:true,
    pools:{ y:100, e:100 },
    combatants:{
      hero:{ party:'y', model:{n:'Hero'}, w:[6,6], armour:{Physical:3,Corrosive:0} },
      foe:{ party:'e', model:{n:'Foe'}, w:[6,6] } } } };
  const t = THREAD.create(thread, canon);
  // Physical 2 vs Physical-3 armour -> 0 taken
  THREAD.apply(t, t.state, [{actor:'foe',effect:{kind:'damage',amount:2,to:'hero',element:'Physical'}}], canon);
  assert.strictEqual(t.state.combatants.hero.w[0], 6);
  // Corrosive 2 vs Corrosive-0 armour -> full 2 taken
  THREAD.apply(t, t.state, [{actor:'foe',effect:{kind:'damage',amount:2,to:'hero',element:'Corrosive'}}], canon);
  assert.strictEqual(t.state.combatants.hero.w[0], 4);
});

// T-SOC-1 B2 (Task 5): thread-level nonLethal — a sanctioned Hall bout floors EVERY damage
// effect at 1 wound, not only weapons whose own description reads Non-Lethal.
test('thread-level nonLethal floors every damage effect at 1 wound', () => {
  const mk = () => ({ id: 'brawl1', pools: { You: 10, Them: 10 },
    combatants: {
      m1: { w: [4, 4], conds: [], party: 'You', model: { n: 'Mine' } },
      e0: { w: [3, 3], conds: [], party: 'Them', model: { n: 'Theirs' }, gen: { n: 'Theirs' } } },
    joined: true, board: null, phase: 'battle', fog: {}, round: 1 });
  const block = [{ actor: 'm1', cost: 1,
    effect: { kind: 'damage', to: 'e0', amount: 99, element: 'Physical', weapon: 'Fist' } }];

  // Note: apply's real signature is (thread, state, block, canon, party) — adapted from the
  // brief's 3-arg sketch (which would throw calling .forEach on canon) to the file's own idiom.
  const lethal = mk();
  THREAD.apply({ type: 'SKIRMISH' }, lethal, block, canon);
  assert.equal(lethal.combatants.e0.w[0], 0, 'without the flag a 99-damage hit kills');
  assert.equal(lethal.combatants.e0.dead, true);

  const bout = mk(); bout.nonLethal = true;
  THREAD.apply({ type: 'SKIRMISH' }, bout, block, canon);
  assert.equal(bout.combatants.e0.w[0], 1, 'a bout never drops a combatant below 1 wound');
  assert.ok(!bout.combatants.e0.dead, 'and nobody dies in a sanctioned bout');
});

test('initState carries seedState.nonLethal onto the live state', () => {
  const s = THREAD.initState({ id: 'b1', type: 'SKIRMISH', seedState: { nonLethal: true, pools: {}, combatants: {} } }, canon);
  assert.equal(s.nonLethal, true);
  const plain = THREAD.initState({ id: 'b2', type: 'SKIRMISH', seedState: { pools: {}, combatants: {} } }, canon);
  assert.equal(plain.nonLethal, false);
});

// Ruling 8 (T-SOC-1 B2): a non-lethal thread can never produce a dead combatant via the
// engine's normal dead-check, so it needs its own off-the-field flag — YIELD — or a bout
// could never conclude. These three pins cover the mechanism end to end.
test('Ruling 8: a nonLethal hit landing a target at 1 wound sets yielded, not dead', () => {
  const state = { id: 'b3', pools: { You: 10, Them: 10 }, nonLethal: true,
    combatants: {
      m1: { w: [4, 4], conds: [], party: 'You', model: { n: 'Mine' } },
      e0: { w: [2, 2], conds: [], party: 'Them', model: { n: 'Theirs' }, gen: { n: 'Theirs' } } },
    joined: true, board: null, phase: 'battle', fog: {}, round: 1 };
  THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical', weapon: 'Fist' } }],
    canon);
  assert.equal(state.combatants.e0.w[0], 1);
  assert.equal(state.combatants.e0.yielded, true);
  assert.ok(!state.combatants.e0.dead, 'a yielded model never dies');
});

test('Ruling 8: a lethal thread never sets yielded, even landing exactly at 1 wound', () => {
  const state = { id: 'b4', pools: { You: 10, Them: 10 },
    combatants: {
      m1: { w: [4, 4], conds: [], party: 'You', model: { n: 'Mine' } },
      e0: { w: [2, 2], conds: [], party: 'Them', model: { n: 'Theirs' }, gen: { n: 'Theirs' } } },
    joined: true, board: null, phase: 'battle', fog: {}, round: 1 };
  THREAD.apply({ type: 'SKIRMISH' }, state,
    [{ actor: 'm1', cost: 1, effect: { kind: 'damage', to: 'e0', amount: 1, element: 'Physical', weapon: 'Fist' } }],
    canon);
  assert.equal(state.combatants.e0.w[0], 1);
  assert.ok(!state.combatants.e0.yielded, 'wound-1 alone (no nonLethal flag) is not a yield');
  assert.ok(!state.combatants.e0.dead);
});

test('Ruling 8: outcome concludes annihilation once one side is entirely yielded', () => {
  const thread = { type: 'SKIRMISH' };
  const state = { phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [4, 4] },
      e0: { party: 'Them', w: [1, 2], yielded: true } } };
  const oc = THREAD.outcome(thread, state);
  assert.deepStrictEqual(oc, { kind: 'annihilation', victor: 'You', defeated: ['Them'] });
});

test('Ruling 8: validate rejects targeting a yielded combatant (off the field)', () => {
  const board = { w: 5, h: 5, cells: {} };
  const state = { pools: { You: 10, Them: 10 },
    combatants: {
      m1: { w: [4, 4], conds: [], party: 'You', model: { n: 'Mine' }, x: 0, y: 0, sight: 10 },
      e0: { w: [1, 2], conds: [], party: 'Them', model: { n: 'Theirs' }, x: 1, y: 0, yielded: true } },
    joined: true, board: board, phase: 'battle', fog: {}, round: 1 };
  const block = [{ actor: 'm1', cost: 1,
    effect: { kind: 'damage', to: 'e0', amount: 1, element: 'Physical', weapon: 'Fist' } }];
  const v = THREAD.validate({ type: 'SKIRMISH' }, state, 'You', block, canon);
  assert.equal(v.ok, false);
  assert.match(v.reason, /not in sight/i);
});

// Fix round 1 (T-SOC-1 B2, Ruling 10): tickConds' own DoT floor only ever consulted the
// per-instance Non-Lethal carrier (inst.nl) — a thread-level state.nonLethal bout could still
// have a fighter DoT'd to 0 and run the full kill path. The floor must be total.
test('Ruling 10: a thread-level nonLethal DoT tick floors at 1 wound and yields, never kills', () => {
  const state = { id: 'b5', pools: { You: 10 }, nonLethal: true, phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [2, 4], conds: [{ tag: 'DoT', tier: 5, left: 2, src: 'x', el: 'Physical' }] } } };
  // no per-instance nl carrier — only the THREAD is nonLethal
  const rep = THREAD.tickConds('You', state, canon);
  assert.equal(state.combatants.m1.w[0], 1, 'floored at 1, not killed by the full DoT tier');
  assert.ok(!state.combatants.m1.dead);
  assert.equal(state.combatants.m1.yielded, true, 'a DoT that lands a fighter at 1 wound yields them too');
  assert.ok(rep.some(function (r) { return r.who === 'm1' && r.tag === 'DoT' && r.died === false; }));
});

test('Ruling 10: a lethal thread\'s DoT is unaffected by the nonLethal floor (regression guard)', () => {
  const state = { id: 'b6', pools: { You: 10 }, phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [2, 4], conds: [{ tag: 'DoT', tier: 5, left: 2, src: 'x', el: 'Physical' }] } } };
  THREAD.tickConds('You', state, canon);
  assert.equal(state.combatants.m1.w[0], 0);
  assert.equal(state.combatants.m1.dead, true);
  assert.ok(!state.combatants.m1.yielded);
});

// The controller's own diagnosis of why this slipped through: every Ruling-8 pin above calls
// THREAD.apply without its 5th `party` arg, so apply's own tickConds gate
// (`party!=null&&...`) never fires and tickConds never actually runs inside the real
// post pipeline. This pin exercises the full apply(thread,state,block,canon,party) path.
test('Ruling 10: THREAD.apply with a party arg ticks conds first and applies the same nonLethal floor', () => {
  const thread = { type: 'SKIRMISH' };
  const state = { id: 'b7', pools: { You: 10, Them: 10 }, nonLethal: true, phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [2, 4], conds: [{ tag: 'DoT', tier: 5, left: 2, src: 'x', el: 'Physical' }] },
      e0: { party: 'Them', w: [4, 4], conds: [] } } };
  THREAD.apply(thread, state, [], canon, 'You');   // party arg present -> tickConds('You',...) runs
  assert.equal(state.combatants.m1.w[0], 1, 'the posting side\'s own DoT ticked, floored at 1');
  assert.ok(!state.combatants.m1.dead);
  assert.equal(state.combatants.m1.yielded, true);
});

// Ruling 10: npcExpDamage's floor must cap the TOTAL (base + the DoT sum), not only the base
// component — a DoT tail left unfloored silently mis-scores the brain's own actions. Verified
// indirectly through the exported scorePair (npcExpDamage itself is internal): the same
// base+DoT pair, against the same target, must score STRICTLY lower under a nonLethal thread
// than under a lethal one, because the floored expected-damage consideration (C1) drops from
// cur/maxW to (cur-1)/maxW while every other scoring input is held identical.
test('Ruling 10: scorePair scores a base+DoT attack lower under nonLethal (npcExpDamage total floor)', () => {
  const mkState = (nonLethal) => ({ nonLethal: nonLethal, board: null, pools: {},
    combatants: {
      atk: { party: 'B', w: [10, 10] },
      tgt: { party: 'A', w: [5, 5] } } });
  const pair = { kind: 'attack', actor: 'atk', target: 'tgt', ap: 1,
    item: { damage: 1, element: 'Physical', conds: [{ tag: 'DoT', tier: 3 }] } };
  // raw base(1) + DoT(tier3, duration 2+3=5, magnitude 3*5=15) = 16, far above the target's
  // 5 current wounds either way -> without the fix both branches cap at cur=5 (indistinguishable).
  const lethalScore = THREAD.scorePair(pair, mkState(false), canon);
  const nonLethalScore = THREAD.scorePair(pair, mkState(true), canon);
  assert.ok(nonLethalScore < lethalScore,
    `expected the nonLethal floor (cur-1=4) to score strictly below the lethal cap (cur=5): ${nonLethalScore} vs ${lethalScore}`);
});

// Fix round 1 (T-SOC-1 B2, Ruling 8 minor): a fighter who enters a bout already at 1 wound
// has the OLD floored-_taken gate stuck at 0 forever (Math.max(0,1-1)=0), so they could never
// yield — an unconcludable 1v1 except by fleeing. Gate on the REAL hit (post-armour/cover,
// pre-floor) instead: it landed even though the floor then zeroes the actual wound change.
test('Ruling 8 fix: a fighter already at 1 wound still yields on a real hit (armour did not eat it)', () => {
  const state = { id: 'b8', pools: { You: 10, Them: 10 }, nonLethal: true, phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [4, 4], conds: [], model: { n: 'Mine' } },
      e0: { party: 'Them', w: [1, 8], conds: [], model: { n: 'Theirs' }, gen: { n: 'Theirs' } } } };
  const block = [{ actor: 'm1', cost: 1,
    effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical', weapon: 'Fist' } }];
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.equal(state.combatants.e0.w[0], 1, 'still floored at 1 — no actual wound change was possible');
  assert.equal(state.combatants.e0.yielded, true, 'but the landed hit still yields them');
});

test('Ruling 8 fix: armour absorbing the WHOLE hit does not yield a fighter already at 1 wound', () => {
  const state = { id: 'b9', pools: { You: 10, Them: 10 }, nonLethal: true, phase: 'battle',
    combatants: {
      m1: { party: 'You', w: [4, 4], conds: [], model: { n: 'Mine' } },
      e0: { party: 'Them', w: [1, 8], conds: [], model: { n: 'Theirs' }, gen: { n: 'Theirs' },
        armour: { Physical: 99 } } } };
  const block = [{ actor: 'm1', cost: 1,
    effect: { kind: 'damage', to: 'e0', amount: 5, element: 'Physical', weapon: 'Fist' } }];
  THREAD.apply({ type: 'SKIRMISH' }, state, block, canon);
  assert.equal(state.combatants.e0.w[0], 1);
  assert.ok(!state.combatants.e0.yielded, 'armour ate the whole hit — nothing actually landed, so no yield');
});
