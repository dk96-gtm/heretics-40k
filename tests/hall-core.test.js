const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadHall } = require('./_load-hall');

const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));
const HALL = loadHall();

function ctx(over) {
  const base = { locId: 'vigilus/sanctum', locType: 'hive', tier: 2, phaseIndex: 5,
    day: 40, fac: 'militarum', cond: 'Intact', status: 'Peace', seedBase: 12345 };
  return Object.assign(base, over || {});
}

test('patronsAt is deterministic: same ctx, same crowd, forever', () => {
  const a = HALL.patronsAt(ctx(), D);
  const b = HALL.patronsAt(ctx(), D);
  assert.deepEqual(a, b);
  assert.ok(a.length >= 4 && a.length <= 7, 'tier-2 night crowd size, got ' + a.length);
});

test('patrons carry the full shape: role from the loc-type pool, name from the culture pool, a body', () => {
  const ps = HALL.patronsAt(ctx(), D);
  const roles = D.rules.hall.pools.hive.map(p => p.role)
    .concat(D.rules.hall.status_roles.Sacked.map(p => p.role))
    .concat(D.rules.hall.status_roles.Besieged.map(p => p.role));
  for (const p of ps) {
    assert.ok(roles.indexOf(p.role) >= 0, 'unknown role ' + p.role);
    assert.ok(p.name.length > 3, 'no name');
    assert.ok(p.registers.length >= 1, 'no registers');
    assert.ok(['male', 'female'].indexOf(p.sex) >= 0, 'unresolved sex: ' + p.sex);
    assert.equal(p.model.n, D.civilians.militarum.n, 'body should be the culture civilian');
  }
});

test('day and phase change the crowd; a different location differs', () => {
  const a = JSON.stringify(HALL.patronsAt(ctx(), D));
  assert.notEqual(JSON.stringify(HALL.patronsAt(ctx({ day: 41 }), D)), a);
  assert.notEqual(JSON.stringify(HALL.patronsAt(ctx({ locId: 'nurth/garden' }), D)), a);
});

test('phase drives size: dead-of-night thinner than evening at the same tier', () => {
  const night = HALL.patronsAt(ctx({ phaseIndex: 4 }), D).length;
  const dead = HALL.patronsAt(ctx({ phaseIndex: 7 }), D).length;
  assert.ok(dead <= night, 'dead-of-night should not out-crowd evening');
});

test('Sacked ground pulls looters/refugees into the pool', () => {
  let seen = false;
  for (let d = 1; d < 30 && !seen; d++) {
    const ps = HALL.patronsAt(ctx({ cond: 'Sacked', day: d }), D);
    seen = ps.some(p => p.role === 'Looter' || p.role === 'Refugee');
  }
  assert.ok(seen, 'status roles never surfaced across 30 days of Sacked');
});

test('sex honors the culture rule: sororitas hall seeds female patrons', () => {
  const ps = HALL.patronsAt(ctx({ fac: 'sororitas' }), D);
  for (const p of ps) assert.equal(p.sex, 'female');
});

const WCTX = {
  war: [{ loc: 'Garden of Cysts', fac: 'Black Legion', days: 3 }],
  state: [{ name: 'Pallid Reach', status: 'Famine' }],
  trade: [{ planet: 'Nurth', mission: 'Purge the Warrens' }],
  ground: ['The Sack of the Sanctum'],
};

test('rumorFor routes through the patron\'s registers and speaks real state', () => {
  const trooper = { name: 'Kell of the 8th', role: 'Garrison Trooper', registers: ['war', 'ground'] };
  const r = HALL.rumorFor(trooper, WCTX, ctx(), D);
  assert.equal(r.register, 'war');
  assert.ok(r.line.indexOf('Garden of Cysts') >= 0 && r.line.indexOf('3') >= 0, 'war rumor must cite the real clock: ' + r.line);
});

test('rumorFor falls through empty registers to the next one with data', () => {
  const trooper = { name: 'Kell', role: 'Trooper', registers: ['war', 'ground'] };
  const quiet = { war: [], state: [], trade: [], ground: ['The Sack of the Sanctum'] };
  const r = HALL.rumorFor(trooper, quiet, ctx(), D);
  assert.equal(r.register, 'ground');
  assert.ok(r.line.indexOf('The Sack of the Sanctum') >= 0);
});

test('rumorFor with a totally quiet galaxy returns the no-news line', () => {
  const p = { name: 'Odo', role: 'Merchant', registers: ['trade'] };
  const r = HALL.rumorFor(p, { war: [], state: [], trade: [], ground: [] }, ctx(), D);
  assert.equal(r.register, 'none');
  assert.ok(r.line.length > 10);
});

test('rumorFor is stable within a day, changes across days', () => {
  const p = { name: 'Kell', role: 'Trooper', registers: ['war', 'state', 'trade', 'ground'] };
  const a = HALL.rumorFor(p, WCTX, ctx(), D);
  assert.deepEqual(HALL.rumorFor(p, WCTX, ctx(), D), a);
  const many = new Set();
  for (let d = 1; d <= 20; d++) many.add(HALL.rumorFor(p, WCTX, ctx({ day: d }), D).line);
  assert.ok(many.size > 1, 'rumor should vary across days');
});

test('moodEventAt: famine outranks thriving-adjacent noise; taint fires plague; quiet peace = null or holy day only', () => {
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Famine', taint: 10 }, D).id, 'famine_table');
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Warring', taint: 80 }, D).id, 'plague_night');
  assert.equal(HALL.moodEventAt(ctx(), { status: 'Thriving', taint: 10 }, D).id, 'good_season');
  const quiet = HALL.moodEventAt(ctx(), { status: 'Peace', taint: 10 }, D);
  assert.ok(quiet === null || quiet.id === 'holy_day');
});

test('holy_day fires on the culture calendar, deterministically', () => {
  const mod = D.rules.hall.holy_day_mod;
  const facDay = HALL.hashStr('militarum') % mod;
  let day = facDay === 0 ? mod : facDay;   // find a day that matches the culture's slot
  while (day % mod !== facDay) day++;
  const hit = HALL.moodEventAt(ctx({ day: day }), { status: 'Peace', taint: 0 }, D);
  assert.ok(hit && hit.id === 'holy_day', 'expected holy_day on day ' + day);
  const miss = HALL.moodEventAt(ctx({ day: day + 1 }), { status: 'Peace', taint: 0 }, D);
  assert.ok(miss === null, 'expected quiet on day ' + (day + 1));
});

test('offerEval prices the culture offering under tonight\'s event', () => {
  const base = HALL.offerEval(null, ctx(), D);
  assert.equal(base.kind, 'cur');
  assert.equal(base.cost, D.rules.hall.offer.cost);
  assert.equal(base.disp, D.rules.hall.offer.disp);
  const good = HALL.offerEval({ id: 'good_season' }, ctx(), D);
  assert.ok(good.cost < base.cost, 'good season discounts the round');
  const holy = HALL.offerEval({ id: 'holy_day' }, ctx(), D);
  assert.equal(holy.disp, base.disp * D.rules.hall.offer.holy_day_disp_mult);
  const famineFood = HALL.offerEval({ id: 'famine_table' }, ctx({ fac: 'tyranids' }), D);
  assert.equal(famineFood.kind, 'res');
  assert.equal(famineFood.disp, base.disp * D.rules.hall.offer.famine_food_disp_mult);
  const skulls = HALL.offerEval(null, ctx({ fac: 'world_eaters' }), D);
  assert.equal(skulls.kind, 'item');
  assert.equal(skulls.accepts, 'REMAINS');
});

// Fix round 1 (design spec §7): a mood event's crowd_delta must actually move the
// crowd — positive events swell it past the tier band, negative events shrink it
// below the band, floored at 1. crowdEvent is not exported directly; exercise it
// through patronsAt/crowdSize's public surface (ctx.crowdEvent), same seed throughout
// so any size difference is attributable to the delta alone.
test('crowdEvent swells the crowd: a positive delta yields strictly more patrons than none', () => {
  const base = HALL.patronsAt(ctx(), D).length;
  const swelled = HALL.patronsAt(ctx({ crowdEvent: 2 }), D).length;
  assert.equal(swelled, base + 2, 'a +2 mood event should add exactly 2 patrons over baseline');
});

test('crowdEvent shrinks the crowd: a negative delta yields fewer patrons than none', () => {
  const base = HALL.patronsAt(ctx(), D).length;
  const shrunk = HALL.patronsAt(ctx({ crowdEvent: -2 }), D).length;
  assert.ok(shrunk < base, 'a -2 mood event should shrink the crowd below baseline, got ' + shrunk + ' vs ' + base);
});

test('crowdEvent never drops the crowd below 1, even under a crushing negative delta', () => {
  const crushed = HALL.patronsAt(ctx({ crowdEvent: -50 }), D).length;
  assert.equal(crushed, 1, 'crowd must floor at exactly 1, never 0 or negative');
});

test('crowdEvent is deterministic: same ctx + same delta = same crowd, every time', () => {
  const a = HALL.patronsAt(ctx({ crowdEvent: 2 }), D);
  const b = HALL.patronsAt(ctx({ crowdEvent: 2 }), D);
  assert.deepEqual(a, b);
});

test('regularsAt: deterministic; returns the 3 roles with present flags by phase', () => {
  const a = HALL.regularsAt(ctx({ phaseIndex: 4 }), D);
  assert.deepEqual(a, HALL.regularsAt(ctx({ phaseIndex: 4 }), D));
  const roles = a.map(r => r.role).sort();
  assert.deepEqual(roles, ['broker', 'champion', 'host']);
  for (const r of a) assert.ok(r.name.length > 3 && ['host','broker','champion'].indexOf(r.role) >= 0);
});

test('regularsAt: host present in the day, broker only later phases', () => {
  const noon = HALL.regularsAt(ctx({ phaseIndex: 2, fac: 'militarum' }), D);
  const night = HALL.regularsAt(ctx({ phaseIndex: 6, fac: 'militarum' }), D);
  assert.equal(noon.filter(r => r.role === 'host')[0].present, true);   // host block includes 2
  assert.equal(noon.filter(r => r.role === 'broker')[0].present, false); // broker block starts at 4
  assert.equal(night.filter(r => r.role === 'broker')[0].present, true);
});

test('regularsAt: a zero-weight role is never present (custodes barely staff a broker)', () => {
  // custodes broker weight is 0.25 (rare) — over many locations, some present some not, never always
  let everPresent = false, everAbsent = false;
  for (let i = 0; i < 40; i++) {
    const r = HALL.regularsAt(ctx({ locId: 'loc' + i, phaseIndex: 5, fac: 'custodes' }), D).filter(x => x.role === 'broker')[0];
    if (r.present) everPresent = true; else everAbsent = true;
  }
  assert.ok(everAbsent, 'a rare broker should sometimes be absent');
});

const AX = { honor: 80, cunning: 20, ferocity: 50, pragmatism: 50, supremacism: 50 };
const AX_CUNNING = { honor: 20, cunning: 85, ferocity: 50, pragmatism: 50, supremacism: 50 };

test('rungOf maps score to the 4 rungs by canon thresholds', () => {
  assert.equal(HALL.rungOf(0, ctx(), D).name, 'stranger');
  assert.equal(HALL.rungOf(3, ctx(), D).name, 'known');
  assert.equal(HALL.rungOf(8, ctx(), D).name, 'trusted');
  assert.equal(HALL.rungOf(99, ctx(), D).name, 'sworn');
  assert.equal(HALL.rungOf(99, ctx(), D).index, 3);
});

test('rungOf uses the Tyranid recognition names for the broodpool', () => {
  assert.equal(HALL.rungOf(0, ctx({ fac: 'tyranids' }), D).name, 'prey_shaped');
  assert.equal(HALL.rungOf(99, ctx({ fac: 'tyranids' }), D).name, 'assimilated_adjacent');
});

test('judgeAct: high honor rewards a noble loss and punishes any cheat', () => {
  const nobleHonor = HALL.judgeAct('noble_loss', ctx(), AX, D);
  const nobleFerocity = HALL.judgeAct('noble_loss', ctx(), { honor: 20, cunning: 20, ferocity: 90, pragmatism: 20, supremacism: 20 }, D);
  assert.ok(nobleHonor > nobleFerocity, 'honor should value a noble loss more than ferocity does');
  assert.ok(HALL.judgeAct('cheat_clean', ctx(), AX, D) < 0, 'high honor: even a clean cheat falls');
});

test('judgeAct: high cunning rewards a clean cheat', () => {
  assert.ok(HALL.judgeAct('cheat_clean', ctx(), AX_CUNNING, D) > 0, 'cunning admires a clean cheat');
  assert.ok(HALL.judgeAct('cheat_caught', ctx(), AX_CUNNING, D) < 0, 'but a botched one still falls');
});

test('judgeAct: authored overrides win — Necrons weigh a remembrance offer heavily, lawbreak brutally', () => {
  assert.ok(HALL.judgeAct('offer', ctx({ fac: 'necrons' }), AX, D) >= 3, 'necron offer override');
  assert.ok(HALL.judgeAct('lawbreak', ctx({ fac: 'necrons' }), AX, D) <= -8, 'necron lawbreak override');
});

test('judgeAct: Tyranids do not parse cheating (returns 0)', () => {
  assert.equal(HALL.judgeAct('cheat_clean', ctx({ fac: 'tyranids' }), AX, D), 0);
  assert.equal(HALL.judgeAct('cheat_caught', ctx({ fac: 'tyranids' }), AX, D), 0);
  assert.ok(HALL.judgeAct('offer', ctx({ fac: 'tyranids' }), AX, D) > 0, 'but biomass offers still register');
});
