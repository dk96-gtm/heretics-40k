const test = require('node:test');
const assert = require('node:assert');
const { loadAgency } = require('./_load-agency');
const fs = require('node:fs'); const path = require('node:path');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const ULT = loadAgency();

test('N1: scaleOf + bandOf read canon', () => {
  assert.strictEqual(ULT.scaleOf('SKIRMISH', canon), 'raid');
  assert.strictEqual(ULT.scaleOf('INVASION', canon), 'invasion');
  assert.strictEqual(ULT.scaleOf('DIPLOMACY', canon), null);
  assert.deepStrictEqual(ULT.bandOf('raid', canon), [4, 8]);
  assert.deepStrictEqual(ULT.bandOf('invasion', canon), [12, 24]);
});
test('N1: pickWindow — ferocity shortens, cunning stretches, always in band', () => {
  const fer = ULT.pickWindow([4, 8], { ferocity: 95, cunning: 10 }, ULT.rng(1));
  const cun = ULT.pickWindow([4, 8], { ferocity: 10, cunning: 95 }, ULT.rng(1));
  assert.ok(fer >= 4 && fer <= 8 && cun >= 4 && cun <= 8);
  assert.ok(fer < cun, 'ferocity ' + fer + ' < cunning ' + cun);
});
test('N1: the condition ladder steps down and heals up to intact only', () => {
  assert.strictEqual(ULT.stepDown('fortified'), 'intact');
  assert.strictEqual(ULT.stepDown('intact'), 'sacked');
  assert.strictEqual(ULT.stepDown('sacked'), 'ruined');
  assert.strictEqual(ULT.stepDown('ruined'), 'ruined');
  assert.strictEqual(ULT.stepDown('infested'), 'sacked');   // non-ladder enters at intact
  assert.strictEqual(ULT.stepUp('ruined'), 'sacked');
  assert.strictEqual(ULT.stepUp('sacked'), 'intact');
  assert.strictEqual(ULT.stepUp('intact'), 'intact');       // never heals into fortified
});
test('N1: garrisonPC = level × per-level × cond mult + stationed', () => {
  assert.strictEqual(ULT.garrisonPC(3, 'fortified', 0, canon), Math.round(3 * 200 * 1.25));
  assert.strictEqual(ULT.garrisonPC(1, 'ruined', 0, canon), Math.round(1 * 200 * 0.3));
  assert.strictEqual(ULT.garrisonPC(2, 'intact', 150, canon), 2 * 200 + 150);
  assert.strictEqual(ULT.garrisonPC(2, 'cursed', 0, canon), 2 * 200); // absent mult → 1.0
});
test('N1: seedFor is order-sensitive and deterministic', () => {
  const a = ULT.seedFor(7, 12, 'ashravine', 'death_guard');
  assert.strictEqual(a, ULT.seedFor(7, 12, 'ashravine', 'death_guard'));
  assert.notStrictEqual(a, ULT.seedFor(7, 12, 'death_guard', 'ashravine')); // prefix tags break symmetry
  assert.notStrictEqual(a, ULT.seedFor(7, 13, 'ashravine', 'death_guard'));
});
test('N1: resolveLapse walks the full ladder with margins; raid caps at sacked', () => {
  // p with att=600 def=625 → ~0.49; drive roll through the rungs
  const mk = x => () => x;
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.99), canon).outcome, 'repelled');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.60), canon).outcome, 'repelled_losses');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.40), canon).outcome, 'sacked');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'invasion', mk(0.01), canon).outcome, 'captured');
  assert.strictEqual(ULT.resolveLapse(600, 625, 'raid', mk(0.01), canon).outcome, 'sacked'); // raid cap
  const r = ULT.resolveLapse(600, 625, 'invasion', mk(0.40), canon);
  assert.ok(/625/.test(r.arith) && /SACKED/i.test(r.arith), 'arithmetic shown: ' + r.arith);
});
test('N1: healTick paces by sector status, pauses besieged, heals to canon baseline', () => {
  const st = { world: { locConds: { x1: 'sacked' }, condHeal: {} } };
  assert.strictEqual(ULT.healTick(st, 'x1', 'Warring', false, canon), null);   // war: no heal
  assert.strictEqual(st.world.condHeal.x1, undefined);
  assert.strictEqual(ULT.healTick(st, 'x1', 'Famine', false, canon), null);    // misery: no heal
  assert.strictEqual(ULT.healTick(st, 'x1', 'Peace', true, canon), null);      // besieged: paused
  for (let i = 0; i < 5; i++) assert.strictEqual(ULT.healTick(st, 'x1', 'Peace', false, canon), null);
  const ev = ULT.healTick(st, 'x1', 'Peace', false, canon);                    // 6th day (Peace=6)
  assert.deepStrictEqual(ev, { kind: 'cond_heal', loc: 'x1', to: 'intact' });
  assert.strictEqual(st.world.locConds.x1, undefined);                         // intact = overlay deleted
  const st2 = { world: { locConds: { x2: 'ruined' }, condHeal: {} } };
  for (let i = 0; i < 3; i++) ULT.healTick(st2, 'x2', 'Thriving', false, canon);
  const ev2 = ULT.healTick(st2, 'x2', 'Thriving', false, canon);               // 4th day (Thriving=4)
  assert.deepStrictEqual(ev2, { kind: 'cond_heal', loc: 'x2', to: 'sacked' });
  assert.strictEqual(st2.world.locConds.x2, 'sacked');
});
test('N1: tribute — offer scales by band, counter eval follows appetite+pragmatism', () => {
  const lo = ULT.tributeOffer(2, 1, 'raid', () => 0.5, canon);
  const hi = ULT.tributeOffer(2, 1, 'invasion', () => 0.5, canon);
  assert.ok(hi.cur > lo.cur, 'invasion offer outweighs raid');
  assert.ok(ULT.evalCounter(1.5, { pragmatism: 90 }, 80, () => 0.5), 'greedy pragmatist pays 1.5x');
  assert.ok(!ULT.evalCounter(2, { pragmatism: 20 }, 10, () => 0.5), 'proud zealot refuses 2x');
});
test('N1: tribute offer + counter eval are seed-stable', () => {
  const r1 = ULT.rng(ULT.seedFor(9, 15, 'x1', 'tribute:death_guard'));
  const r2 = ULT.rng(ULT.seedFor(9, 15, 'x1', 'tribute:death_guard'));
  assert.deepStrictEqual(ULT.tributeOffer(2, 1, 'raid', r1, canon), ULT.tributeOffer(2, 1, 'raid', r2, canon));
});
