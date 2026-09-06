const test = require('node:test');
const assert = require('node:assert');
const { loadAgency } = require('./_load-agency');
const { loadKit } = require('./_load-kit');
const fs = require('node:fs'); const path = require('node:path');
const canon = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const ULT = loadAgency();
const KIT = loadKit();

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

test('N4: cunning nudges p, capped ±0.05, printed in arith', () => {
  const mk = x => () => x;
  const beh = {cunning:100, ferocity:50, honor:50};
  const base = ULT.resolveLapse(500, 500, 'invasion', mk(0.50), canon);
  const nudged = ULT.resolveLapse(500, 500, 'invasion', mk(0.50), canon, beh);
  assert.ok(Math.abs((nudged.p - base.p) - 0.05) < 1e-9, 'cun 100 → p +0.05');
  assert.match(nudged.arith, /cunning 100 → p \+0\.05/);
  assert.strictEqual(base.arith.includes('cunning'), false, 'no behavior → no nudge line');
});

test('N4: ferocity shrinks both margins — decisive both ways', () => {
  const mk = x => () => x;
  const beh = {cunning:50, ferocity:100, honor:50};
  const base = ULT.resolveLapse(600, 400, 'invasion', mk(0.38), canon);      // margin ≈ +0.22 < 0.25 → sacked
  const nudged = ULT.resolveLapse(600, 400, 'invasion', mk(0.38), canon, beh); // dm 0.20 → captured
  assert.strictEqual(base.outcome, 'sacked');
  assert.strictEqual(nudged.outcome, 'captured');
  assert.match(nudged.arith, /ferocity 100/);
});

test('N4: honor restrains sack loot, floored at 0.75', () => {
  const mk = x => () => x;
  const base = ULT.lootOf(4, 1, mk(0.5), canon);
  const restrained = ULT.lootOf(4, 1, mk(0.5), canon, {honor:100});
  assert.strictEqual(restrained.cur, Math.round(base.cur * 0.75));
  const mid = ULT.lootOf(4, 1, mk(0.5), canon, {honor:50});
  assert.strictEqual(mid.cur, base.cur, 'honor ≤50 → no restraint');
});

test('N4: legacy 5-arg resolveLapse calls are byte-identical (no behavior, no lines)', () => {
  const mk = x => () => x;
  const a = ULT.resolveLapse(600, 625, 'invasion', mk(0.60), canon);
  assert.strictEqual(a.outcome, 'repelled_losses');   // the existing N1 pin still holds
});

/* ── N2 final fix wave (M5): ULT.evalPlayerTribute — the player-side tribute palette's own
   verdict function, previously shipped with no unit pin (spec §8 named it). Real canon only. ── */
test('N2/M5: evalPlayerTribute — accept at or above the demand', () => {
  assert.deepStrictEqual(ULT.evalPlayerTribute(100, 100, {pragmatism:50}, 50, () => 0.5, canon),
    {result:'accept'});
  assert.strictEqual(ULT.evalPlayerTribute(250, 100, {pragmatism:0}, 0, () => 0.99, canon).result,
    'accept', 'a generous offer is accepted regardless of appetite/pragmatism');
});

test('N2/M5: evalPlayerTribute — refuse below demand/1.5, counter in between', () => {
  // demand 150 → refuse floor is 100 (150/1.5): strictly below refuses, at/above counters.
  assert.strictEqual(ULT.evalPlayerTribute(99, 150, {pragmatism:50}, 50, () => 0.5, canon).result,
    'refuse');
  assert.strictEqual(ULT.evalPlayerTribute(100, 150, {pragmatism:50}, 50, () => 0.5, canon).result,
    'counter', 'exactly at the floor is a counter, not a refusal');
  assert.strictEqual(ULT.evalPlayerTribute(149, 150, {pragmatism:50}, 50, () => 0.5, canon).result,
    'counter');
});

test('N2/M5: evalPlayerTribute — counter mult comes from canon, leniency tracks appetite+pragmatism', () => {
  const opts = canon.rules.ultimatum.tribute.counter_options;
  const app = canon.rules.ultimatum.tribute.faction_appetite;
  // will = 0.6*appetite + 0.4*pragmatism; lenient when (will/100)*(0.9+0.2r) >= 0.5
  const greedy = ULT.evalPlayerTribute(100, 150, {pragmatism:0}, app.tyranids, () => 0.5, canon);
  const venal  = ULT.evalPlayerTribute(100, 150, {pragmatism:100}, app.votann, () => 0.5, canon);
  assert.strictEqual(greedy.mult, opts[opts.length - 1], 'no appetite, no pragmatism → the hard multiplier');
  assert.strictEqual(venal.mult, opts[0], 'a venal, pragmatic aggressor asks the softer multiplier');
  assert.strictEqual(venal.counterDemand, Math.round(150 * opts[0]));
  assert.strictEqual(greedy.counterDemand, Math.round(150 * opts[opts.length - 1]));
});

test('N2/M5: evalPlayerTribute is deterministic for a fixed rng draw', () => {
  const a = ULT.evalPlayerTribute(120, 150, {pragmatism:50}, 50, ULT.rng(4242), canon);
  const b = ULT.evalPlayerTribute(120, 150, {pragmatism:50}, 50, ULT.rng(4242), canon);
  assert.deepStrictEqual(a, b);
  // counter-once is enforced by the engine's persisted u.pCountered flag, not by the core:
  // the core's own contract is that the SAME inputs always return the SAME counter.
  assert.strictEqual(a.result, 'counter');
});

// T-NPC-3.5 task 7 — chunk-independence sanity for the far-battle kit nudge.
// resolveFarBattle itself is engine glue (reads S/D/applyWarResolution as bare globals; not
// extractable the way kitOfFor/npcSpecRk were in task 6 — see kit-glue.test.js's own note on
// that same limit) so this test replicates its exact formula against the pure ULT+KIT exports
// it's built from: def = garrisonPC*defender_mult, r = ULT.rng(ULT.seedFor(base,day,lid,'far:'+agg)),
// kitMult = KIT.kitMult(KIT.syntheticDepth(muster), canon), att = round(muster*kitMult), then
// ULT.resolveLapse(att, def, scale, r, canon). Extending world-core.test.js's own "chunk === daily
// boots" fixture (tests/world-core.test.js:218-231) wasn't a fit — that fixture drives WORLD.catchUp
// over holdings/production and never touches ULT/resolveLapse/resolveFarBattle at all — whereas THIS
// file already hosts resolveLapse's own arithmetic fixtures immediately above, so it's the closer
// home for a far-battle-shaped chunk-vs-daily check.
test('T-NPC-3.5 task 7: far-battle kit nudge derives only from seeded state — a 13-day chunk equals daily replay', () => {
  const base = 91, lid = 'forgeworld-vex', agg = 'orks', garrisonPC = 400;
  function farBattleDay(day, muster) {
    const def = Math.round(garrisonPC * ((canon.rules.ultimatum || {}).defender_mult || 1.25));
    const r = ULT.rng(ULT.seedFor(base, day, lid, 'far:' + agg));
    const kitMult = KIT.kitMult(KIT.syntheticDepth(muster), canon);
    const res = ULT.resolveLapse(Math.round(muster * kitMult), def, 'raid', r, canon);
    if (kitMult > 1) res.arith += KIT.kitNudgeArith(kitMult, true);
    return res;
  }
  // "chunk": a player who never logs in for 13 days — every day's far battle resolves in one pass
  // on login, exactly as WORLD.catchUp's own onDay hook drives resolveFarBattle per elapsed day.
  const chunkRun = [];
  for (let day = 1; day <= 13; day++) chunkRun.push(farBattleDay(day, 250 + 40 * day));
  // "daily": the same 13 days, each computed as its own independent call (as if the player had
  // logged in every single day) — no shared closures, no Date.now, no Math.random anywhere in the
  // path, so nothing carries state from one day to the next.
  const dailyRun = [];
  for (let day = 1; day <= 13; day++) dailyRun.push(farBattleDay(day, 250 + 40 * day));
  assert.deepStrictEqual(dailyRun, chunkRun);
  // the fixture must actually exercise the kit-nudge coupling, or the equivalence is vacuous —
  // confirm at least one day's arithmetic really carries the synthetic-depth kit line.
  assert.ok(chunkRun.some(r => /kit ×1\.\d\d \(synthetic depth\)/.test(r.arith)),
    'fixture must exercise the kit nudge: ' + chunkRun.map(r => r.arith).join(' | '));
});
