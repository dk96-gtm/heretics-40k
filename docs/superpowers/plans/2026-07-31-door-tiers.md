# Door Tiers (T-DOOR-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every door in the galaxy gets a live 3-tier level — seeded from the world profile, gating what the door offers, upgradable for currency + resources with build timers on the world tick — plus the 35-type planet registry that governs the caps.

**Architecture:** A new pure `/*<door-core>*/` region (`DOOR`) in `index.html` holds all tier rules (caps, seeding, costs, build ticking) — DOM-free, canon+state as arguments, node-tested like `THREAD`/`WORLD`. Engine glue wires it into founding/init seeding, the post-`WORLD.catchUp` tick loop, `doorCatalog`/renderers for gating, and a Requisition upgrade block. Canon gains the 35-type planet registry + a `rules.doors_tiering` block + per-door tier ladders.

**Tech Stack:** vanilla ES5 inline engine (`var`, no arrows/const in index.html), Node built-in test runner (`node --test`), Python for JSON canon edits.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-31-door-tiers-signature-doors-design.md` — the tables there are law.
- **Terminology law: always "model", never "chassis".**
- Canon file stays named `heretics-40k-data-v1.json`; bump `meta.version` `"1.23"` → `"1.24"` (pins live in `tests/canon.test.js:11,125`, `tests/canon-missions.test.js:50`, `tests/canon-spoils.test.js:45`). **Re-pinned 2026-07-31 (T-ECN-1 task 6 close-out):** E1 landed first and already claimed canon v1.23 — this plan originally targeted 1.22→1.23; every version reference below has been bumped one step to 1.23→1.24 to sit after it.
- `index.html` is the HOT lane — claim T-DOOR-1 in `BACKLOG.md` before touching it; `git add <explicit paths>` only, never `-A`.
- **Blocked on T-ECN-1.** This plan assumes E1 shipped per-holding typed stockpiles. Expected shape (economy spec §3/§7): a per-planet store of `{Food,Material,Fuel}`. Task 5 Step 1 VERIFIES the real landed shape and pins the adapter to it — do not skip that step.
- ES5 in the engine: `function`, `var`, `{k:k}` object literals. Tests may use modern JS.
- The tree must pass `node --test` (289 baseline + new) at every commit.
- New `S.world` keys (`doorTiers`, `doorBuilds`) MUST seed in BOTH `foundingWorld()` (~line 1678) and `init()` (~line 3307) — known gotcha.
- No `Date.now()` inside the DOOR core (replay/tests); day math arrives as tick counts from the engine.

## File Structure

- Modify: `heretics-40k-data-v1.json` — planet_types 20→35 rows (lore/tag rewrite per spec §4), new `rules.doors_tiering`, `galaxy.doors[*].tiers` ladders, version bump.
- Modify: `index.html` — new `/*<door-core>*/` region (place directly after `/*</world-core>*/`, ~line 1378); glue in `foundingWorld()`, `init()`, `doorCatalog()`, `renderForge`/`renderArmoury`, muster/apothecarion branches (~3785–3800), door-entry header + upgrade block (~3745+), location panel door rows (~2249).
- Create: `tests/_load-door.js` (region extractor, mirrors `tests/_load-world.js`).
- Create: `tests/door-core.test.js` (pure rules), `tests/canon-doors.test.js` (canon pins).
- Modify: `tests/canon.test.js`, `tests/canon-missions.test.js`, `tests/canon-spoils.test.js` (version pin bumps).
- Modify: `BACKLOG.md` (claim → ready-to-push).

Door kind ids (canon, exact): `shop forge shipyard altar muster apothecarion relay arena warp_gate reliquary throne_room armoury`. Rarities: shop/forge/muster/armoury `common` · shipyard/altar/apothecarion/relay/arena `uncommon` · warp_gate `rare` · reliquary `rarest` · throne_room literal string `"one per ruled world"` (cost special-cased by kind).

---

### Task 1: Canon — 35-type planet registry + tiering rules + door ladders

**Files:**
- Modify: `heretics-40k-data-v1.json`
- Create: `tests/canon-doors.test.js`
- Modify: `tests/canon.test.js:11,125`, `tests/canon-missions.test.js:50`, `tests/canon-spoils.test.js:45` (pin `'1.24'`)

**Interfaces:**
- Produces: `D.rules.doors_tiering` (consumed by DOOR core, Task 2), `D.galaxy.planet_types` (35 rows, `{name,prod_mult,mission_value,pop_ceiling,lore,faction?}`), `D.galaxy.doors[*].tiers` (`{"1":str,"2":str,"3":str}`).

- [ ] **Step 1: Write the failing canon pin test** — `tests/canon-doors.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

const PLAYABLE = new Set(['black_legion','death_guard','world_eaters','thousand_sons','emperors_children','daemons','astartes','militarum','mechanicus','sororitas','custodes','tyranids','orks','necrons','aeldari','drukhari','tau','votann','gsc','harlequins']);

test('canon v1.24: 35 planet types, 14 standard / 21 tagged', () => {
  assert.strictEqual(D.meta.version, '1.24');
  const pts = D.galaxy.planet_types;
  assert.strictEqual(pts.length, 35);
  const tagged = pts.filter((p) => p.faction);
  assert.strictEqual(tagged.length, 21);
  for (const p of pts) {
    assert.ok(p.lore && p.lore.length > 20, p.name + ' has a lore line');
    assert.ok(p.effect === undefined, p.name + ' dormant effect string stripped');
    assert.ok(typeof p.prod_mult === 'number' && typeof p.mission_value === 'number' && typeof p.pop_ceiling === 'number', p.name + ' numeric fields');
    if (p.faction && p.faction !== 'xenos') assert.ok(PLAYABLE.has(p.faction), p.name + ' tag is a playable subfaction: ' + p.faction);
  }
});

test('tier-III homes sit on standard types only; every door kind covered', () => {
  const c = D.rules.doors_tiering;
  const byName = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p]));
  for (const [kind, home] of Object.entries(c.t3_homes)) {
    assert.ok(byName[home], kind + ' home exists: ' + home);
    assert.ok(!byName[home].faction, kind + ' home is standard (untagged): ' + home);
  }
  const kinds = D.galaxy.doors.map((d) => d.kind);
  for (const k of kinds) {
    const covered = c.t3_homes[k] || c.t3_anywhere.includes(k);
    assert.ok(covered, k + ' has a route to Tier III');
    assert.ok(D.galaxy.doors.find((d) => d.kind === k).tiers['3'], k + ' has a tier-3 ladder line');
  }
});

test('upgrade economy constants match the locked D11×E2 merge', () => {
  const c = D.rules.doors_tiering;
  assert.deepStrictEqual(c.currency_base, { common: 100, uncommon: 150, rare: 250, rarest: 400 });
  assert.deepStrictEqual(c.currency_base_by_kind, { throne_room: 200 });
  assert.deepStrictEqual(c.resource_cost, { 2: { Material: 120, Fuel: 30 }, 3: { Material: 300, Fuel: 100 } });
  assert.deepStrictEqual(c.build_days, { 2: 3, 3: 7 });
  assert.deepStrictEqual(c.tier1_types, ['Death World', 'Dead World']);
  assert.deepStrictEqual(c.t3_anywhere, ['shop']);
});
```

- [ ] **Step 2: Run it — expect FAIL** (`node --test tests/canon-doors.test.js`) with version `'1.23'` / missing keys.

- [ ] **Step 3: Apply the canon edit.** Write this Python to the scratchpad (NOT the repo) and run it once. It (a) rewrites the 20 existing planet_type rows — strips `effect`, adds `lore`, normalizes `faction` tags to playable ids, de-tags Forge/Shrine/Feudal — (b) appends the 15 new subfaction rows, (c) adds `rules.doors_tiering`, (d) adds `tiers` ladders to all 12 doors, (e) bumps version.

```python
import json, collections
P = 'heretics-40k-data-v1.json'
d = json.load(open(P), object_pairs_hook=collections.OrderedDict)

# (a)+(b) — the 35 rows, verbatim from spec §4 (name, prod, mv, pop, faction-or-None, lore)
ROWS = [
 ("Forge World",2.0,4,4,None,"A world given over entirely to weapons manufacture. The only place where top-grade arms and armour are made."),
 ("Hive World",1.8,4,5,None,"Continent-sized cities house populations in the billions. The galaxy's largest source of labor, recruits, and trained medicae."),
 ("Industrial World",1.6,3,4,None,"Factories and orbital docks cover the surface. Produces bulk goods and ship hulls in volume."),
 ("Agri World",1.4,3,3,None,"Farmland spans the whole planet. Feeds the surrounding sector; losing one starves it."),
 ("Mining World",1.4,3,2,None,"Deep excavation of ore and fuel. Supplies the raw material every other industry depends on."),
 ("Civilized World",1.0,2,4,None,"Established cities, trade routes, and functioning institutions. The communication hubs that bind a sector run from here."),
 ("Shrine World",0.6,2,3,None,"A place of pilgrimage covered in cathedrals and relic vaults. Holy to millions and a target for their enemies."),
 ("Fortress World",0.8,2,2,None,"The entire planet is built for defense. Command over a region is traditionally seated behind its walls."),
 ("Feral World",0.4,1,2,None,"Tribal cultures on an untamed world. Produces hardened recruits and little else."),
 ("Feudal World",0.4,1,2,None,"Isolated societies at pre-industrial technology, ruled by martial houses. Produces disciplined soldiers in great numbers."),
 ("Death World",0.3,1,1,None,"The environment itself kills the unprepared. Whatever lives here makes formidable stock."),
 ("War World",0.5,2,3,None,"A battlefield that never ended. Its arenas and standing warzones are known across segmentums."),
 ("Tomb World",0.2,1,1,"necrons","A quiet surface above sleeping Necron vaults. Disturbing it wakes the owners."),
 ("Daemon World",0.8,2,3,"daemons","A world absorbed into the warp, where daemons hold court. Physical law is negotiable; allegiance is not."),
 ("Xenos World",0.8,2,3,"xenos","An untamed world of lairs and hunting grounds. Claimed by no charted power."),
 ("Exodite World",0.6,2,2,"aeldari","A pastoral Aeldari colony threaded with webway roots. Its keepers defend the land as kin."),
 ("Sept World",1.2,3,4,"tau","A planned T'au colony built to the Greater Good. Order, growth, and negotiation are its exports."),
 ("Kin Hold",1.6,3,2,"votann","A Votann settlement cut deep into rock around an Ancestor Core. Steady industry under old guidance."),
 ("Frontier World",0.8,2,2,None,"A half-settled world at the edge of charted space. Old warp gates and unclaimed finds draw prospectors."),
 ("Dead World",0.0,0,0,None,"A planet stripped of life, usually by Exterminatus. Produces nothing and never recovers."),
 ("Garrison World",0.9,3,3,"militarum","A depot world of the Astra Militarum. Whole regiments are raised, drilled, and shipped from here."),
 ("Cult World",0.9,2,4,"gsc","An ordinary world whose population hides a genestealer cult. The infection surfaces only when it is ready."),
 ("Pleasure World",0.8,2,3,"emperors_children","A world the Emperor's Children devoted to sensation and excess. Every trade here serves appetite."),
 ("Anchorage World",0.7,2,2,"black_legion","A staging port for the Black Legion's crusade fleets. Warbands gather here to refit and swear their oaths."),
 ("Explorator World",0.7,2,2,"mechanicus","A Mechanicus expedition world of archeotech excavation. Its vaults hold technology older than the Imperium."),
 ("Plague Garden World",0.6,2,2,"death_guard","A world remade by the Death Guard into Nurgle's garden. Blight is cultivated here like a crop."),
 ("Athenaeum World",0.6,2,1,"thousand_sons","A silent library-world of the Thousand Sons. Forbidden lore is gathered, warded, and studied here."),
 ("Convent World",0.6,2,2,"sororitas","Seat of a Sororitas Order's motherhouse. Faith is organized here as thoroughly as any army."),
 ("Raider's Nest",0.6,2,2,"drukhari","A hidden Drukhari anchorage between raids. Its markets price everything in captives."),
 ("Chapter World",0.5,2,2,"astartes","Home to an Astartes fortress-monastery. Its harsh population supplies the Chapter's aspirants."),
 ("Scrap World",0.5,2,3,"orks","An Ork world of mek yards and fighting pits. Its junk mountains supply endless crude machinery."),
 ("Crossroads World",0.5,1,1,"harlequins","A webway junction kept open by Harlequin masques. All travelers pass through; none linger."),
 ("Slaughter World",0.4,1,2,"world_eaters","A killing ground consecrated to Khorne by the World Eaters. Nothing is built here; the fighting is the point."),
 ("Vigil World",0.4,1,1,"custodes","A watch-post of the Adeptus Custodes. Few are stationed here, and nothing passes them."),
 ("Infested World",0.3,1,1,"tyranids","A world partly consumed by a Tyranid splinter fleet. What remains of its biosphere feeds the swarm."),
]
# resource_output values (T-ECN-1 landed first; its canon-resources pin test REQUIRES
# every planet type to carry resource_output — the 20 existing rows already have theirs,
# preserve them; these are the E1 plan's forward values for the 15 new types):
R_OUT = {
 "Garrison World":(4,4,4),"Cult World":(4,4,2),"Pleasure World":(4,2,2),
 "Anchorage World":(0,3,5),"Explorator World":(0,6,4),"Plague Garden World":(6,2,0),
 "Athenaeum World":(2,2,2),"Convent World":(2,2,2),"Raider's Nest":(2,2,4),
 "Chapter World":(2,3,2),"Scrap World":(0,8,4),"Crossroads World":(0,0,2),
 "Slaughter World":(0,3,2),"Vigil World":(0,1,1),"Infested World":(3,0,0),
}
old_by_name = {p['name']: p for p in d['galaxy']['planet_types']}
pts = []
for (name, prod, mv, pop, fac, lore) in ROWS:
    row = collections.OrderedDict()
    row['name'] = name; row['prod_mult'] = prod; row['mission_value'] = mv
    row['pop_ceiling'] = pop; row['lore'] = lore
    if name in old_by_name and 'resource_output' in old_by_name[name]:
        row['resource_output'] = old_by_name[name]['resource_output']
    else:
        f,m,u = R_OUT[name]
        row['resource_output'] = collections.OrderedDict([("food",f),("material",m),("fuel",u)])
    if fac: row['faction'] = fac
    pts.append(row)
d['galaxy']['planet_types'] = pts

# (c) tiering rules
d['rules']['doors_tiering'] = collections.OrderedDict([
 ("note","T-DOOR-1 (spec 2026-07-31). Universal Tier-III homes sit on STANDARD (untagged) planet types only. Shop is Tier-III-anywhere (trade-hub investment). Signature doors (T-FAC-1) will be Tier-III on any ruled world. Upgrade = currency base*target_tier + resources + build days on the world tick; you must rule the world."),
 ("currency_base",{"common":100,"uncommon":150,"rare":250,"rarest":400}),
 ("currency_base_by_kind",{"throne_room":200}),
 ("resource_cost",{"2":{"Material":120,"Fuel":30},"3":{"Material":300,"Fuel":100}}),
 ("build_days",{"2":3,"3":7}),
 ("t3_homes",{"forge":"Forge World","armoury":"Forge World","apothecarion":"Hive World","shipyard":"Industrial World","relay":"Civilized World","throne_room":"Fortress World","altar":"Shrine World","reliquary":"Shrine World","arena":"War World","muster":"Feudal World","warp_gate":"Frontier World"}),
 ("t3_anywhere",["shop"]),
 ("tier1_types",["Death World","Dead World"]),
 ("tomb_dormant_conflict",40),
 ("gear_tier_pc",{"2":12,"3":20}),
 ("altar_rank_by_tier",{"1":2,"2":3,"3":4}),
 ("armour_tiers_by_tier",{"1":["default","light"],"2":["default","light","medium"],"3":["default","light","medium","heavy"]}),
 ("muster_bulk_discount",0.85),
 ("apoth_fee_mult",{"1":1.0,"2":0.8,"3":0.6}),
])

# (d) per-door ladders (D11, verbatim meanings)
TIERS = {
 "shop":       {"1":"Tier-I gear","2":"+ Tier-II gear","3":"+ Tier-III gear — a proper trade hub"},
 "forge":      {"1":"forge tags / harden armour to I","2":"to II","3":"to III — the Forge Temple"},
 "altar":      {"1":"Warp Casts R1-R2","2":"+ R3","3":"+ R4 grand rites"},
 "armoury":    {"1":"Light + class-default armour","2":"+ Medium","3":"+ Heavy"},
 "reliquary":  {"1":"one Legendary in stock","2":"both Legendaries","3":"+ relic re-forge (lands with T-FAC-1)"},
 "muster":     {"1":"Core models, rank 1","2":"all classes","3":"all classes at a bulk rate"},
 "apothecarion":{"1":"revive at 1 wound, full fee","2":"cheaper fees","3":"cheapest fees, full-wound revival"},
 "shipyard":   {"1":"system vessels","2":"warp-capable hulls","3":"capital hulls"},
 "relay":      {"1":"sector comms","2":"segmentum reach","3":"galaxy-wide reach"},
 "arena":      {"1":"local duels, small purse","2":"cross-sector hail","3":"galaxy hail, grand purse"},
 "warp_gate":  {"1":"same-segmentum gates","2":"cross-segmentum","3":"any charted gate"},
 "throne_room":{"1":"planet events","2":"+ garrison bonus","3":"sector-scale events"},
}
for door in d['galaxy']['doors']:
    door['tiers'] = TIERS[door['kind']]

d['meta']['version'] = '1.24'
json.dump(d, open(P,'w'), indent=1, ensure_ascii=False)
print('canon -> 1.24, planet_types:', len(d['galaxy']['planet_types']))
```

- [ ] **Step 4: Bump the three version-pin files** — edit `'1.23'` → `'1.24'` at `tests/canon.test.js:11`, `tests/canon.test.js:125`, `tests/canon-missions.test.js:50`, `tests/canon-spoils.test.js:45`.

- [ ] **Step 5: Run the whole suite** — `node --test`. Expected: all pass (299 baseline + 3 new). If `tests/canon.test.js` location-type legality checks fail, STOP — that means a minted planet already uses a renamed type (should not happen; no types were renamed).

- [ ] **Step 6: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-doors.test.js tests/canon.test.js tests/canon-missions.test.js tests/canon-spoils.test.js
git commit -m "canon v1.24: 35-type planet registry (standard/subfaction line) + doors_tiering rules + per-door tier ladders (T-DOOR-1 task 1)"
```

---

### Task 2: DOOR core — pure tier rules, node-tested

**Files:**
- Modify: `index.html` (insert region directly after `/*</world-core>*/` close, ~line 1378)
- Create: `tests/_load-door.js`, `tests/door-core.test.js`

**Interfaces:**
- Consumes: `D.rules.doors_tiering` (Task 1).
- Produces (exact, later tasks call these): `DOOR.gearTier(pc,canon)→1|2|3` · `DOOR.castRank(dStr)→1..4` · `DOOR.tierCap(planetType,kind,canon,tombDormant)→1|2|3` · `DOOR.seedTier(planetType,popIdx,kind,canon,tombDormant)→1|2|3` · `DOOR.doorTier(state,locId,kind,seed)→1|2|3` · `DOOR.upgradeCost(kind,rarity,targetTier,canon)→{currency,resources,days}` · `DOOR.canUpgrade(o)→{ok,why?}` · `DOOR.startBuild(state,locId,kind,targetTier,days)` · `DOOR.tickBuilds(state)→[{loc,kind,to}]` · `DOOR.key(locId,kind)→str`.

- [ ] **Step 1: Write the failing tests** — `tests/_load-door.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function loadDoor() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const m = html.match(/\/\*<door-core>\*\/([\s\S]*?)\/\*<\/door-core>\*\//);
  if (!m) throw new Error('door-core region not found in index.html');
  const DOOR = vm.runInThisContext('(function(){' + m[1] + '\n;return DOOR;})()');
  if (!DOOR) throw new Error('door-core did not define DOOR');
  return DOOR;
}
module.exports = { loadDoor };
```

`tests/door-core.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadDoor } = require('./_load-door');
const DOOR = loadDoor();
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

test('gearTier bands and castRank parsing', () => {
  assert.strictEqual(DOOR.gearTier(3, D), 1);
  assert.strictEqual(DOOR.gearTier(12, D), 2);
  assert.strictEqual(DOOR.gearTier(20, D), 3);
  assert.strictEqual(DOOR.gearTier(36, D), 3);
  assert.strictEqual(DOOR.castRank('R1 - Warp 2 - Medium - 2 AP'), 1);
  assert.strictEqual(DOOR.castRank('R4 - Warp 6 - Long - 5 AP'), 4);
  assert.strictEqual(DOOR.castRank('no rank prefix'), 1);
});

test('tierCap: homes 3, shop anywhere 3, floor types 1, dormant tomb 1, default 2', () => {
  assert.strictEqual(DOOR.tierCap('Forge World', 'forge', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Forge World', 'armoury', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Forge World', 'altar', D, false), 2);
  assert.strictEqual(DOOR.tierCap('Agri World', 'shop', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Death World', 'shop', D, false), 1);
  assert.strictEqual(DOOR.tierCap('Dead World', 'forge', D, false), 1);
  assert.strictEqual(DOOR.tierCap('Tomb World', 'shop', D, true), 1);
  assert.strictEqual(DOOR.tierCap('Tomb World', 'shop', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Feudal World', 'muster', D, false), 3);
  assert.strictEqual(DOOR.tierCap('Sept World', 'relay', D, false), 2);
});

test('seedTier: 1 default, 2 on top-2 pop rungs, 3 on home doors, cap always wins', () => {
  assert.strictEqual(DOOR.seedTier('Agri World', 0, 'forge', D, false), 1);
  assert.strictEqual(DOOR.seedTier('Agri World', 4, 'forge', D, false), 2);
  assert.strictEqual(DOOR.seedTier('Forge World', 0, 'forge', D, false), 3);
  assert.strictEqual(DOOR.seedTier('Hive World', 5, 'apothecarion', D, false), 3);
  assert.strictEqual(DOOR.seedTier('Agri World', 5, 'shop', D, false), 2);   // shop III is built, never seeded
  assert.strictEqual(DOOR.seedTier('Death World', 5, 'shop', D, false), 1);
});

test('doorTier: sparse overlay beats seed but never lowers it', () => {
  const st = { world: { doorTiers: {} } };
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 1), 1);
  st.world.doorTiers[DOOR.key('locA', 'shop')] = 2;
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 1), 2);
  assert.strictEqual(DOOR.doorTier(st, 'locA', 'shop', 3), 3); // re-typed world raised the seed
});

test('upgradeCost: D11 currency x tier + E2 resources + days; throne_room by kind', () => {
  assert.deepStrictEqual(DOOR.upgradeCost('shop', 'common', 2, D), { currency: 200, resources: { Material: 120, Fuel: 30 }, days: 3 });
  assert.deepStrictEqual(DOOR.upgradeCost('reliquary', 'rarest', 3, D), { currency: 1200, resources: { Material: 300, Fuel: 100 }, days: 7 });
  assert.strictEqual(DOOR.upgradeCost('throne_room', 'one per ruled world', 2, D).currency, 400);
});

test('canUpgrade gate ladder', () => {
  const cost = { currency: 200, resources: { Material: 120, Fuel: 30 }, days: 3 };
  const base = { tier: 1, cap: 3, building: false, rules: true, funds: { currency: 500, Material: 200, Fuel: 50 }, cost: cost };
  assert.strictEqual(DOOR.canUpgrade(base).ok, true);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { tier: 3 })).why, /Tier III/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { tier: 2, cap: 2 })).why, /cannot support/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { building: true })).why, /underway/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { rules: false })).why, /ruler/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { funds: { currency: 10, Material: 200, Fuel: 50 } })).why, /currency/);
  assert.match(DOOR.canUpgrade(Object.assign({}, base, { funds: { currency: 500, Material: 10, Fuel: 50 } })).why, /Material/);
});

test('startBuild + tickBuilds: counts days, applies tier, idempotent finish, JSON round-trip', () => {
  const st = { world: {} };
  DOOR.startBuild(st, 'locA', 'shop', 2, 3);
  assert.strictEqual(DOOR.tickBuilds(st).length, 0);
  assert.strictEqual(DOOR.tickBuilds(st).length, 0);
  const st2 = JSON.parse(JSON.stringify(st));         // persist mid-build
  const done = DOOR.tickBuilds(st2);
  assert.deepStrictEqual(done, [{ loc: 'locA', kind: 'shop', to: 2 }]);
  assert.strictEqual(st2.world.doorTiers[DOOR.key('locA', 'shop')], 2);
  assert.deepStrictEqual(st2.world.doorBuilds, {});
  assert.strictEqual(DOOR.tickBuilds(st2).length, 0);
});
```

- [ ] **Step 2: Run — expect FAIL** (`node --test tests/door-core.test.js`): "door-core region not found".

- [ ] **Step 3: Implement the region** in `index.html`, directly after the `/*</world-core>*/` close:

```js
/*<door-core>*/
/* DOOR — pure tier rules for the 12 common doors (T-DOOR-1). DOM-free; canon and
   state always arrive as arguments. Spec: docs/superpowers/specs/2026-07-31-door-tiers-signature-doors-design.md */
var DOOR=(function(){
 function cfg(canon){return (canon.rules&&canon.rules.doors_tiering)||{}}
 function gearTier(pc,canon){var g=cfg(canon).gear_tier_pc||{};var t3=g['3']||20,t2=g['2']||12;return pc>=t3?3:pc>=t2?2:1}
 function castRank(d){var m=/^R([1-4])\b/.exec(d||'');return m?+m[1]:1}
 function tierCap(planetType,kind,canon,tombDormant){var c=cfg(canon);
  if((c.tier1_types||[]).indexOf(planetType)>=0)return 1;
  if(planetType==='Tomb World'&&tombDormant)return 1;
  if((c.t3_anywhere||[]).indexOf(kind)>=0)return 3;
  if(c.t3_homes&&c.t3_homes[kind]===planetType)return 3;
  return 2}
 function seedTier(planetType,popIdx,kind,canon,tombDormant){var c=cfg(canon);
  var t=(popIdx>=4)?2:1;
  if(c.t3_homes&&c.t3_homes[kind]===planetType)t=3;   /* home doors open at III — the lived-in galaxy */
  return Math.min(t,tierCap(planetType,kind,canon,tombDormant))}
 function key(locId,kind){return locId+':'+kind}
 function doorTier(state,locId,kind,seed){
  var ov=state.world&&state.world.doorTiers&&state.world.doorTiers[key(locId,kind)];
  return Math.max(ov||0,seed||1)}
 function upgradeCost(kind,rarity,targetTier,canon){var c=cfg(canon);
  var base=(c.currency_base_by_kind&&c.currency_base_by_kind[kind])||(c.currency_base||{})[rarity]||100;
  return {currency:base*targetTier,
          resources:(c.resource_cost||{})[String(targetTier)]||{},
          days:(c.build_days||{})[String(targetTier)]||3}}
 function canUpgrade(o){
  if(o.tier>=3)return {ok:false,why:'Already at Tier III.'};
  if(o.tier>=o.cap)return {ok:false,why:'This world cannot support a higher tier here.'};
  if(o.building)return {ok:false,why:'Construction already underway.'};
  if(!o.rules)return {ok:false,why:'Only the world\'s ruler may commission upgrades.'};
  if((o.funds.currency||0)<o.cost.currency)return {ok:false,why:'Not enough currency.'};
  var R=o.cost.resources;for(var k in R)if((o.funds[k]||0)<R[k])return {ok:false,why:'Not enough '+k+'.'};
  return {ok:true}}
 function startBuild(state,locId,kind,targetTier,days){
  state.world.doorBuilds=state.world.doorBuilds||{};
  state.world.doorBuilds[key(locId,kind)]={to:targetTier,left:days}}
 function tickBuilds(state){ /* one in-game day; returns finished builds */
  var B=(state.world&&state.world.doorBuilds)||{},done=[];
  Object.keys(B).forEach(function(k){var b=B[k];b.left-=1;
   if(b.left<=0){var i=k.lastIndexOf(':');
    state.world.doorTiers=state.world.doorTiers||{};
    state.world.doorTiers[k]=Math.max(state.world.doorTiers[k]||0,b.to);
    done.push({loc:k.slice(0,i),kind:k.slice(i+1),to:b.to});delete B[k]}});
  return done}
 return {gearTier:gearTier,castRank:castRank,tierCap:tierCap,seedTier:seedTier,
         doorTier:doorTier,upgradeCost:upgradeCost,canUpgrade:canUpgrade,
         startBuild:startBuild,tickBuilds:tickBuilds,key:key};
})();
/*</door-core>*/
```

- [ ] **Step 4: Run — expect PASS**: `node --test tests/door-core.test.js` (7 tests), then full `node --test` (engine-syntax boot proxy must still compile).

- [ ] **Step 5: Commit**

```bash
git add index.html tests/_load-door.js tests/door-core.test.js
git commit -m "engine: DOOR core - pure tier caps/seeding/costs/builds, node-tested (T-DOOR-1 task 2)"
```

---

### Task 3: State seeding + tick wiring + digest

**Files:**
- Modify: `index.html` — `foundingWorld()` (~1678), `init()` (~3307, next to the missionSeedBase backfill and the `WORLD.catchUp` call at ~3319)

**Interfaces:**
- Consumes: `DOOR.tickBuilds`, `DOOR.key` (Task 2); `WORLD.catchUp(S,D,now)→{ticks,events}` (existing).
- Produces: `S.world.doorTiers` (`{ "locId:kind": tier }`), `S.world.doorBuilds` (`{ "locId:kind": {to,left} }`) — seeded in BOTH founding and init; engine helpers `doorTierAt(pl,loc,kind)→1|2|3` and `tombDormant(pl)→bool` used by Tasks 4–6.

- [ ] **Step 1: Seed the keys.** In `foundingWorld()`'s returned object (same literal as `missions:{}`), add:

```js
 doorTiers:{},doorBuilds:{},
```

In `init()`, next to the other `S.world` backfills (~3314):

```js
  if(!S.world.doorTiers)S.world.doorTiers={};                             // T-DOOR-1: older saves
  if(!S.world.doorBuilds)S.world.doorBuilds={};
```

- [ ] **Step 2: Tick the builds.** In `init()` directly AFTER `var _wc=WORLD.catchUp(S,D,Date.now());` (mission-board glue pattern):

```js
  for(var _db=0;_db<_wc.ticks;_db++){DOOR.tickBuilds(S).forEach(function(f){
    var _fl=lById(f.loc);
    _wc.events.push('🚪 '+((_fl&&_fl.name)||f.loc)+' — '+f.kind.replace('_',' ')+' rebuilt to Tier '+['','I','II','III'][f.to]+'.');});}
```

(If `_wc.events` is not the digest-lines array, check `WORLD.digest(events)` at ~1356 and push through whatever array `init()` currently hands it — same pattern the mission glue uses. If no location-by-id helper exists, add `function lById(id){var r=null;D.galaxy.segmentums.forEach(function(g){g.zones.forEach(function(z){z.sectors.forEach(function(s){(s.planets||[]).forEach(function(p){(p.locations||[]).forEach(function(l){if(l.id===id)r=l})})})})});return r}` beside `fPl`.)

- [ ] **Step 3: Engine helpers** (near `pRuler`, ~2433):

```js
/* T-DOOR-1: effective tier of a door at a location — sparse overlay over the derived seed */
function tombDormant(pl){var f2=fPl(pl.id);var sc=f2&&SCORES[f2.s.id];return pl.type==='Tomb World'&&!(sc&&sc.conflict>=((D.rules.doors_tiering||{}).tomb_dormant_conflict||40))}
function popBandIdx(v){var P=D.galaxy.population_ranks;if(!P)return 0;for(var i=P.bands.length-1;i>=0;i--)if(v>=P.bands[i][0])return i;return 0}
function doorTierAt(pl,loc,kind){
 var seed=DOOR.seedTier(pl.type,popBandIdx(effPop(loc,pl.id)),kind,D,tombDormant(pl));
 return DOOR.doorTier(S,loc.id,kind,seed)}
```

- [ ] **Step 4: Persistence round-trip test.** Append to `tests/door-core.test.js`:

```js
test('overlay + builds survive a JSON persist round-trip mid-build', () => {
  const st = { world: { doorTiers: {}, doorBuilds: {} } };
  DOOR.startBuild(st, 'vighive', 'muster', 2, 3);
  st.world.doorTiers[DOOR.key('vigport', 'shop')] = 3;
  const thawed = JSON.parse(JSON.stringify(st));
  assert.deepStrictEqual(thawed.world.doorBuilds[DOOR.key('vighive', 'muster')], { to: 2, left: 3 });
  assert.strictEqual(DOOR.doorTier(thawed, 'vigport', 'shop', 1), 3);
});
```

- [ ] **Step 5: Run `node --test`** — all pass (engine-syntax proxy validates the init() glue compiles). **Browser sanity:** `python3 -m http.server 8765`, load `localhost:8765`, console clean, founding a fresh profile works (`window._noPersist` if poking the profile).

- [ ] **Step 6: Commit**

```bash
git add index.html tests/door-core.test.js
git commit -m "engine: door tier state seeding (founding+init), build ticking on the world tick + digest lines (T-DOOR-1 task 3)"
```

---

### Task 4: Tier gating — catalogs and services

**Files:**
- Modify: `index.html` — `doorCatalog` (~3745), `renderForge`/`renderArmoury` (~3785–3786), muster branch (~3787), apothecarion branch (~3793)

**Interfaces:**
- Consumes: `DOOR.gearTier`, `DOOR.castRank`, `doorTierAt(pl,loc,kind)` (Task 3). Requisition scope already exposes the current planet+location as used by the door branches (grep `doorFactionId` for the surrounding accessors — reuse the same `h`/location object the branches already read).
- Produces: `doorCatalog(kind,tier)` — same return shape, tier-filtered. All later UI reads tier via `doorTierAt` only.

- [ ] **Step 1: Gate the catalogs.** Change `doorCatalog` to accept the tier (default 3 = ungated, so existing callers keep working until updated):

```js
function doorCatalog(kind,tier){var pf=doorFactionId();var t=tier||3;
 function pick(arr){return (arr||[]).filter(function(it){return it.faction==null||it.faction===pf})
   .map(function(it){return {n:it.n,cat:it.cat,d:it.d,pc:it.pc}})}
 if(kind==='shop')return pick(D.weapons).concat(pick(D.items)).concat(pick(D.abilities))
   .filter(function(it){return DOOR.gearTier(it.pc,D)<=t});
 if(kind==='altar')return pick(D.casts).filter(function(it){return DOOR.castRank(it.d)<=((D.rules.doors_tiering.altar_rank_by_tier||{})[String(t)]||4)});
 if(kind==='reliquary'){var L=(D.legendaries||[]).filter(function(it){return it.faction===pf})
   .map(function(it){return {n:it.n,cat:it.cat,d:it.d,pc:it.pc}});
   return t>=2?L:L.slice(0,1)}
 return []}
```

Then update the shop/altar/reliquary door branches to pass `doorTierAt(pl,loc,kind)` (the branches already hold the location — reuse their existing variables; `sellPrice`'s internal `doorCatalog('shop')` fallback lookups stay tierless on purpose: selling is never gated).

- [ ] **Step 2: Gate the Forge and Armoury.** In `renderForge`, cap the offered forge-tag tier and armour-harden tier at `doorTierAt(...,'forge')` (the tag-tier buttons I/II/III already exist — disable those above the cap with the reason `Requires a Tier <N> Forge.`). In `renderArmoury`, filter the armour catalog by `D.rules.doors_tiering.armour_tiers_by_tier[String(tier)]` against each piece's `tier` field (`default|light|medium|heavy`).

- [ ] **Step 3: Gate Muster + Apothecarion.** Muster branch: tier 1 → only `cls==='Core'` models offered; tier 2 → all classes; tier 3 → all classes at `muster_bulk_discount` (0.85×) on the hire price, labeled `bulk rate`. Apothecarion branch: multiply the revive fee by `apoth_fee_mult[String(tier)]` (1.0/0.8/0.6); at tier 3 revived models return at full wounds instead of 1 (adjust the revive handler's wound-set line).

- [ ] **Step 4: Manual browser verify** (Playwright MCP): on the demo save, open a Requisition at the demo location — shop list shrinks at tier 1 vs before (pc≥12 gear gone), altar hides R3+ casts at tier 1, armoury hides medium/heavy at tier 1. `node --test` still green.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "engine: tier-gate all gear/service doors - shop/altar/reliquary catalogs, forge caps, armoury weights, muster depth, apothecarion fees (T-DOOR-1 task 4)"
```

---

### Task 5: Upgrade flow — pay, build, rule-gate

**Files:**
- Modify: `index.html` — door-entry rendering in Requisition (the per-door header area used by all branches, ~3780) + the door rows at ~2249

**Interfaces:**
- Consumes: `DOOR.upgradeCost/canUpgrade/startBuild`, `doorTierAt`, `pRuler(pl)` (existing), `S.cur` (currency), **T-ECN-1 stockpiles (verify step 1)**.
- Produces: `stockOf(planetId)→{Food,Material,Fuel}` + `spendStock(planetId,resources)` adapters — the ONLY seam touching E1 state; T-ECN-2 reuses them.

- [ ] **Step 1: VERIFY the landed E1 shape.** Run `grep -n "stock\|Material\|Fuel" index.html | head -30` and read the E1 commit's state keys. Write the two adapters against the REAL keys (expected per economy spec: per-holding `{Food,Material,Fuel}`; if E1 shipped `S.world.stock[planetId]`, the adapters are):

```js
/* T-DOOR-1: the only functions that touch E1 stockpile state — keep it that way */
function stockOf(pid){return (S.world.stock&&S.world.stock[pid])||{Food:0,Material:0,Fuel:0}}
function spendStock(pid,res){var st=stockOf(pid);for(var k in res)st[k]=(st[k]||0)-res[k]}
```

If E1's keys differ, adapt ONLY these two bodies (signatures are fixed) and note the real keys in the commit message.

- [ ] **Step 2: Render tier + upgrade block on every door.** Where the Requisition renders the entered door's header, add (all branches share it):

```js
var _dt=doorTierAt(pl,loc,kind),_cap=DOOR.tierCap(pl.type,kind,D,tombDormant(pl));
var _bld=S.world.doorBuilds[DOOR.key(loc.id,kind)];
var _pips='<span class="mono" title="Door tier">'+['','◉○○','◉◉○','◉◉◉'][_dt]+' Tier '+['','I','II','III'][_dt]+'</span>';
var _lad=(DR(kind).tiers||{})[String(_dt)]||'';
c.insertAdjacentHTML('beforeend','<div class="d" style="display:flex;justify-content:space-between;margin-bottom:6px">'+_pips+'<span style="color:var(--dim)">'+_lad+'</span></div>');
if(_bld){c.insertAdjacentHTML('beforeend','<div class="d" style="color:var(--dim)">⚒ Upgrading to Tier '+['','I','II','III'][_bld.to]+' — '+_bld.left+' day'+(_bld.left>1?'s':'')+' remain.</div>');}
else if(_dt<3){
 var _cost=DOOR.upgradeCost(kind,DR(kind).rarity,_dt+1,D);
 var _me=D.factions.filter(function(f){return f.id===S.player.faction})[0];
 var _gate=DOOR.canUpgrade({tier:_dt,cap:_cap,building:false,
   rules:!!(pRuler(pl)&&_me&&pRuler(pl).faction===_me.name),
   funds:Object.assign({currency:S.cur},stockOf(pl.id)),cost:_cost});
 var _lbl='Upgrade to Tier '+['','I','II','III'][_dt+1]+' — '+_cost.currency+' '+_me.currency+' + '+_cost.resources.Material+' Material + '+_cost.resources.Fuel+' Fuel · '+_cost.days+' days';
 c.insertAdjacentHTML('beforeend','<div class="shopc"><button class="btn gh sm" id="dupg"'+(_gate.ok?'':' disabled')+'>'+_lbl+'</button>'+(_gate.ok?'':'<span class="d" style="color:var(--blh)"> '+_gate.why+'</span>')+'</div>');
 if(_gate.ok)document.getElementById('dupg').onclick=function(){
   S.cur-=_cost.currency;spendStock(pl.id,_cost.resources);
   DOOR.startBuild(S,loc.id,kind,_dt+1,_cost.days);persist();T('⚒ Construction begins — Tier '+['','I','II','III'][_dt+1]+' in '+_cost.days+' days.');rerender();};
}
```

(Adapt `pl`/`loc`/`c`/`rerender` to the actual variable names in the door-entry scope — the branches at ~3785 already hold them; `persist()`/`T()` are the engine's existing save/toast helpers; match how the branch code calls them.)

- [ ] **Step 3: Tier pips on the location panel door rows** (~2249): replace the forge-only `tiers` stub with the real pips for every open door: `' <span class="mono" style="color:var(--dim)">'+['','◉○○','◉◉○','◉◉◉'][doorTierAt(pl,loc,s.kind)]+'</span>'`.

- [ ] **Step 4: Browser E2E** (Playwright MCP, `window._noPersist` NOT set — persistence is under test):
  1. Boot demo save → open the demo location → door rows show pips.
  2. Enter the Shop → tier line + upgrade button with full cost string.
  3. Click upgrade on a ruled world with funds → toast, "Upgrading — 3 days remain".
  4. Reload → construction line persists. (Advancing days rides the tick — covered by Task 3's unit tests; don't fake `Date.now` in the browser.)
  5. On a NOT-ruled world's door → button disabled with the ruler reason.
  6. Console: 0 errors.

- [ ] **Step 5: `node --test` green, then commit**

```bash
git add index.html
git commit -m "engine: door upgrade flow - rule-gated, currency+Material/Fuel spend via E1 stockpiles, build timers + pips UI (T-DOOR-1 task 5)"
```

---

### Task 6: GLOSS + polish + board close-out

**Files:**
- Modify: `index.html` (GLOSS entries), `BACKLOG.md`

**Interfaces:**
- Consumes: everything shipped in Tasks 1–5. Produces: none (close-out).

- [ ] **Step 1: GLOSS tooltips.** Find the GLOSS dictionary (grep `GLOSS`) and add hover entries: `Door Tier` ("Doors level I→III. Tier gates what the door offers; upgrades cost currency + resources and take days of construction. Tier III lives on specific standard world types — Shop excepted, which can reach III anywhere."), plus `Tier I/II/III` lines quoting the door's own `tiers` ladder where the pips render.

- [ ] **Step 2: Full verify.** `node --test` (0 fail) + one Playwright pass over all 7 screens (0 console errors), spot-checking: Map location panel pips · Requisition gating (shop/altar/armoury lists) · upgrade flow · World Digest after a build completes (set a 1-day build via console on a warm save if a natural tick is impractical: `DOOR.startBuild(S,<locId>,'shop',2,1)` then advance `S.time.lastTick` back one day and reload).

- [ ] **Step 3: BACKLOG close-out.** T-DOOR-1 row → `ready-to-push`, list every commit's paths, note the E1 adapter names (`stockOf`/`spendStock`) for T-ECN-2's reuse. Commit:

```bash
git add index.html BACKLOG.md
git commit -m "engine: door-tier GLOSS + verify sweep; T-DOOR-1 ready-to-push (task 6)"
```

---

## Self-review notes (run after drafting — resolved inline)

- **Spec coverage:** §3 caps/homes → Tasks 1–2 · §4 registry → Task 1 · §5 economy → Tasks 1/2/5 · §7 seeding → Tasks 2–3 · §8 wiring/tests → Tasks 3–6. §6 (signature doors) is design-only — no task, correct. Reliquary III re-forge deliberately stubbed to a ladder label (T-FAC-1), noted in the canon ladder text.
- **Known drift from spec §7:** pop rung is measured per-LOCATION (`effPop` band, the engine's only population signal — planets carry none), not per-planet. Spirit preserved ("world profile"); spec's wording covers it via the location's derived population.
- **Type consistency:** `DOOR.*` signatures identical in Tasks 2 (defined) and 3/4/5 (consumed); `doorTierAt(pl,loc,kind)` defined Task 3, consumed 4/5; `stockOf/spendStock` defined Task 5 Step 1, reused nowhere earlier.
- **Placeholder scan:** none — every gating rule carries its constant (bands 12/20, ranks 2/3/4, armour weight lists, 0.85 bulk, 1.0/0.8/0.6 fees) sourced from `rules.doors_tiering` so they stay tuning-editable in canon.
