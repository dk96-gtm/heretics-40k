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
