const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadWorld } = require('./_load-world');
const { loadAI } = require('./_load-ai');

const canon = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8')
);
const W = loadWorld();
const NPCAI = loadAI();
const DAY = canon.tick.day_minutes * 60000;

function freshState(lastTick) {
  return { time: { epoch: 0, lastTick }, cur: 100, world: { stats: { vigilus: { taint: 10 } } } };
}

test('ticksElapsed = floor(elapsed / day), never negative', () => {
  const s = freshState(0);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY * 3), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, DAY * 3 + 5), 3);
  assert.strictEqual(W.ticksElapsed(s, canon, -100), 0); // clock skew → 0
});

test('catchUp runs ticks, accrues production, drifts taint, advances lastTick fully', () => {
  const s = freshState(0);
  const r = W.catchUp(s, canon, DAY * 3);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(s.cur, 100 + 3 * canon.tick.production_per_day);
  assert.strictEqual(s.world.stats.vigilus.taint, 10 + 3 * canon.tick.taint_per_day);
  assert.strictEqual(s.time.lastTick, 3);
  assert.ok(r.events.length >= 1);
});

test('catchUp is idempotent within the same day', () => {
  const s = freshState(0);
  W.catchUp(s, canon, DAY * 2);
  const curAfter = s.cur;
  const r2 = W.catchUp(s, canon, DAY * 2 + 10); // same day, <1 tick more
  assert.strictEqual(r2.ticks, 0);
  assert.strictEqual(s.cur, curAfter);
});

test('long absence is capped and compressed, lastTick still advances fully', () => {
  const s = freshState(0);
  const away = canon.tick.max_catchup_days + 10;
  const r = W.catchUp(s, canon, DAY * away);
  assert.strictEqual(r.ticks, canon.tick.max_catchup_days);
  assert.strictEqual(r.compressed, 10);
  assert.strictEqual(s.time.lastTick, away); // no permanent drift
});

test('digest returns relevance-ordered lines from events', () => {
  const d = W.digest([
    { kind: 'taint', sector: 'vigilus', delta: 3 },
    { kind: 'production', amount: 75 },
  ]);
  assert.ok(Array.isArray(d.lines) && d.lines.length >= 1);
});

test('digest aggregates taint per sector into one line, not per tick', () => {
  const d = W.digest([
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'vigilus', delta: 1 },
    { kind: 'taint', sector: 'nurth', delta: 1 },
  ]);
  const vig = d.lines.filter((l) => /vigilus/.test(l));
  assert.strictEqual(vig.length, 1, 'one vigilus line');
  assert.match(vig[0], /rose 3 in vigilus/);
  assert.strictEqual(d.lines.filter((l) => /nurth/.test(l)).length, 1);
});

test('T-TIME-1: dayIndexAt derives from epoch; ticks = dayIndex − lastTick', () => {
  const DM = 240 * 60000;
  const state = { time: { epoch: 1000, lastTick: 2 } };
  assert.strictEqual(W.dayIndexAt(state, canon, 1000 + 5 * DM), 5);
  assert.strictEqual(W.dayIndexAt(state, canon, 999), 0);          // pre-epoch clamps
  const st2 = { time: { epoch: 0, lastTick: 2 }, world: {} };
  const r = W.catchUp(st2, canon, 5 * DM);
  assert.strictEqual(r.ticks, 3);
  assert.strictEqual(st2.time.lastTick, 5);                            // int day-index, not ms
});
test('T-TIME-1: catchUp cap still compresses; lastTick lands on the current day-index', () => {
  const DM = 240 * 60000;
  const cap = (canon.tick && canon.tick.max_catchup_days) || 30;
  const st = { time: { epoch: 0, lastTick: 0 }, world: {} };
  const r = W.catchUp(st, canon, (cap + 10) * DM);
  assert.strictEqual(r.ticks, cap);
  assert.strictEqual(r.compressed, 10);
  assert.strictEqual(st.time.lastTick, cap + 10);
});
test('T-TIME-1: day-index consistency — WORLD dayIndex + 1 === NPCAI stamp day', () => {
  const DM = 240 * 60000;
  [0, 1, 7, 29, 100].forEach(d => {
    const now = 1234 + d * DM + 17;                                    // mid-day offsets too
    assert.strictEqual(
      W.dayIndexAt({ time: { epoch: 1234 } }, canon, now) + 1,
      NPCAI.stampAt(1234, now, 60).day);
  });
});

test('N1: digest renders ult_lapse + cond_heal lines', () => {
  const d = W.digest([
    { kind: 'ult_lapse', loc: 'The Bastion', planet: 'Vigilus', outcome: 'sacked', arith: '600 PC vs 625 PC (defender-favored) → p 0.49 · roll 0.40 · margin +0.09 → SACKED' },
    { kind: 'cond_heal', loc: 'x1', to: 'intact' }]);
  assert.ok(d.lines.some(l => /Bastion/.test(l) && /SACKED/.test(l)));
  assert.ok(d.lines.some(l => /mends/.test(l)));
});

/* ── T-TERR-2 final review FIX I1: seat tax + garrison upkeep inside the per-day pass ──
   The seat rules and the condition-ladder step are INJECTED (opts), never read as globals,
   so these tests load the sibling pure cores and hand them in exactly as the engine does. */
const { loadSeat } = require('./_load-seat');
const { loadAgency } = require('./_load-agency');
const SEAT = loadSeat();
const ULT = loadAgency();
const SEAT_OPTS = { seat: SEAT, stepDown: ULT.stepDown };

function firstSeatLoc() {                       // first seat-able surface location in canon
  let hit = null;
  (canon.galaxy.segmentums || []).forEach(g => (g.zones || []).forEach(z => (z.sectors || []).forEach(s =>
    (s.planets || []).forEach(p => (p.locations || []).forEach(l => {
      if (!hit && l.tier !== 'orbit' && SEAT.seatable(l.type, canon)) hit = { p, l };
    })))));
  if (!hit) throw new Error('canon has no seat-able location');
  return hit;
}
function seatState(over) {
  const { p, l } = firstSeatLoc();
  const s = {
    time: { epoch: 0, lastTick: 0 }, cur: 0,
    player: { faction: canon.factions[0].id },
    roster: [], forces: [],
    world: { stats: {}, holdings: [], stock: {}, unrest: {},
             seats: { [l.id]: { pid: p.id } }, seatMiss: {}, locConds: {} }
  };
  if (over) over(s, p, l);
  return { s, p, l };
}

test('T-TERR-2 I1: seat tax accrues once per in-game day, scaled by the location condition', () => {
  const a = seatState();
  W.catchUp(a.s, canon, DAY * 3, SEAT_OPTS);
  const tax = SEAT.taxOf(a.l, a.l.condition || 'intact', canon);
  assert.ok(tax > 0);
  assert.strictEqual(a.s.cur, 3 * (canon.tick.production_per_day + tax));   // flat fallback + 3 days of tax
  // an unheld seat planet also banks the location's production share (double-pay guard: no holdings)
  const share = W.locShares(a.p, canon).filter(x => x.id === a.l.id)[0];
  assert.deepStrictEqual(a.s.world.stock[a.p.id], {
    Food: share.share.Food * 3, Material: share.share.Material * 3, Fuel: share.share.Fuel * 3 });

  const b = seatState((s, p, l) => { s.world.locConds[l.id] = 'sacked'; });
  W.catchUp(b.s, canon, DAY * 3, SEAT_OPTS);
  const sackedTax = SEAT.taxOf(b.l, 'sacked', canon);
  assert.ok(sackedTax < tax, 'sacked ground pays a smaller tax');
  assert.strictEqual(b.s.cur, 3 * (canon.tick.production_per_day + sackedTax));
});

test('T-TERR-2 I1: an unpaid garrison counts a miss per day; every 3rd miss steps the condition down', () => {
  const every = (canon.rules.seats.upkeep || {}).unrest_wound_every || 3;
  const mk = () => seatState((s, p, l) => {
    s.world.seats[l.id].stationedForceId = 'f1';
    s.forces.push({ id: 'f1', n: 'Alpha' });
    s.roster.push({ id: 'm1', fo: 'Alpha', st: 'GARRISON', pc: 250 * 400 });   // upkeep far beyond income
  });
  const a = mk();
  const r = W.catchUp(a.s, canon, DAY * every, SEAT_OPTS);
  assert.strictEqual(a.s.world.seatMiss[a.l.id], every);
  assert.strictEqual(a.s.world.locConds[a.l.id], ULT.stepDown(a.l.condition || 'intact'));
  assert.strictEqual(r.events.filter(e => e.kind === 'seat_unrest').length, 1);
  assert.strictEqual(r.events.filter(e => e.kind === 'seat_income').length, every);

  // a paid garrison never misses and never wounds the ground
  const paid = seatState((s, p, l) => {
    s.cur = 100000;
    s.world.seats[l.id].stationedForceId = 'f1';
    s.forces.push({ id: 'f1', n: 'Alpha' });
    s.roster.push({ id: 'm1', fo: 'Alpha', st: 'GARRISON', pc: 250 });
  });
  W.catchUp(paid.s, canon, DAY * every, SEAT_OPTS);
  assert.deepStrictEqual(paid.s.world.seatMiss, {});
  assert.deepStrictEqual(paid.s.world.locConds, {});

  // DEAD/TAKEN members do not draw upkeep — a wiped garrison is no garrison
  const dead = seatState((s, p, l) => {
    s.world.seats[l.id].stationedForceId = 'f1';
    s.forces.push({ id: 'f1', n: 'Alpha' });
    s.roster.push({ id: 'm1', fo: 'Alpha', st: 'DEAD', pc: 250 * 400 });
  });
  W.catchUp(dead.s, canon, DAY * every, SEAT_OPTS);
  assert.deepStrictEqual(dead.s.world.seatMiss, {});
});

test('T-TERR-2 I1: the siege pause counts the miss but never steps the condition (mirrors healTick)', () => {
  const every = (canon.rules.seats.upkeep || {}).unrest_wound_every || 3;
  const a = seatState((s, p, l) => {
    s.world.seats[l.id].stationedForceId = 'f1';
    s.forces.push({ id: 'f1', n: 'Alpha' });
    s.roster.push({ id: 'm1', fo: 'Alpha', st: 'GARRISON', pc: 250 * 400 });
  });
  const r = W.catchUp(a.s, canon, DAY * every,
    { seat: SEAT, stepDown: ULT.stepDown, besieged: { [a.l.id]: true } });
  assert.strictEqual(a.s.world.seatMiss[a.l.id], every, 'the miss still counts');
  assert.strictEqual(a.s.world.locConds[a.l.id], undefined, 'besieged ground is not stepped down again');
  assert.strictEqual(r.events.filter(e => e.kind === 'seat_unrest').length, 0);
});

test('T-TERR-2 I1: CHUNK-INDEPENDENCE — 13 daily boots === one 13-day boot (cur, seatMiss, conds, stock)', () => {
  const fixture = () => seatState((s, p, l) => {
    s.cur = 30;                                   // thin: tithe/upkeep coupling actually bites
    s.world.holdings.push(p.id);                  // a holding: produce() zeroes cur on a missed tithe
    s.world.seats[l.id].stationedForceId = 'f1';
    s.forces.push({ id: 'f1', n: 'Alpha' });
    s.roster.push({ id: 'm1', fo: 'Alpha', st: 'GARRISON', pc: 250 * 12 });
  });
  const daily = fixture().s, chunk = fixture().s;
  for (let d = 1; d <= 13; d++) W.catchUp(daily, canon, DAY * d, SEAT_OPTS);   // login every day
  W.catchUp(chunk, canon, DAY * 13, SEAT_OPTS);                                // login once, 13 days later
  // the fixture must actually EXERCISE the coupling, or the equivalence is vacuous
  const lid = Object.keys(daily.world.seats)[0];
  assert.ok(daily.world.seatMiss[lid] > 0, 'fixture misses upkeep');
  assert.ok(daily.world.locConds[lid], 'fixture wounds the ground');
  assert.strictEqual(daily.time.lastTick, 13);
  assert.strictEqual(chunk.time.lastTick, 13);
  assert.strictEqual(daily.cur, chunk.cur, 'currency must not depend on login pattern');
  assert.deepStrictEqual(daily.world.seatMiss, chunk.world.seatMiss);
  assert.deepStrictEqual(daily.world.locConds, chunk.world.locConds);
  assert.deepStrictEqual(daily.world.stock, chunk.world.stock);
  assert.deepStrictEqual(daily.world.unrest, chunk.world.unrest);
});
