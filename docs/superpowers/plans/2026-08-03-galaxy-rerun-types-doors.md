# T-GX-G7 Galaxy Re-run (Planet Types + Doors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the locked T-GX-G7 design (`docs/superpowers/specs/2026-08-03-galaxy-rerun-types-doors-design.md`): 16 crown-sweep retypes, 8 resource-row edits, 4 Tier-III door-route fixes, legality-ghost cleanup, 5 starting conditions, canon v1.29.

**Architecture:** Every change is a surgical edit to ONE file — `heretics-40k-data-v1.json` (THE CANON) — plus a new incremental test file `tests/canon-g7.test.js` that grows one block per task, plus `BACKLOG.md` lifecycle edits. Zero engine (`index.html`) edits. Tasks are SERIAL (single JSON file, canon lane); each task is edit → `node --test` green → commit.

**Tech Stack:** python3 for JSON edits (stdlib `json`), Node built-in test runner (`node --test`, zero deps).

## Global Constraints

- **Canon lane only.** Never touch `index.html`. Locations NEVER store `doors` (derived from `location_types` — a canon test enforces this).
- **JSON edit pattern (every task):** load with `json.load`, mutate, write with `json.dump(D, f, indent=1, ensure_ascii=False)` **then `f.write('\n')`** — the file has a trailing newline; losing it dirties the diff. Before writing any edit script, `python3 -c "import json; D=json.load(open('heretics-40k-data-v1.json'))"` round-trip guard is already implicit — json.dump preserves key order (dicts are ordered).
  **CHECK FIRST:** run `git diff --stat` after each edit — if the diff is the whole file, you broke indent/newline; `git checkout -- heretics-40k-data-v1.json` and redo.
- **`node --test` green at EVERY commit.** Baseline 412 pass / 0 fail; each task adds tests so the count only grows.
- **`git add <explicit paths>` only — NEVER `-A` or `.`** (verified to steal parallel sessions' work in this repo).
- **Do not push.** Push is gated to Daak.
- **Version stays `1.28` until Task 7** — the version bump and ALL test pins move in one commit.
- Galaxy nesting is `galaxy.segmentums[].zones[].sectors[].planets[].locations[]` (zones layer — a known gotcha).
- Terminology: always "model", never "chassis" (not expected to arise, but law).

## Reference: how to find a planet (used by every edit script)

```python
import json
D = json.load(open('heretics-40k-data-v1.json'))
def planet(pid):
    for seg in D['galaxy']['segmentums']:
        for z in seg['zones']:
            for sec in z['sectors']:
                for pl in sec['planets']:
                    if pl['id'] == pid: return pl
    raise KeyError(pid)
def save():
    with open('heretics-40k-data-v1.json','w') as f:
        json.dump(D, f, indent=1, ensure_ascii=False); f.write('\n')
```

---

### Task 1: BACKLOG lifecycle — in-progress + the T-GX-G7e engine-lane row

**Files:**
- Modify: `BACKLOG.md` (ONLY the T-GX-G7 row + one new row)

**Interfaces:**
- Produces: T-GX-G7 row `status=in-progress`; new open row `T-GX-G7e` for the engine lane.

- [ ] **Step 1: Sync** — `git pull --ff-only` (expect "Already up to date"; if not, re-read the T-GX-G7 row to confirm the claim `claude · sess:02c487b6-37ba-4a6c-99cf-7c7c03ae55a8` still holds).

- [ ] **Step 2: Edit the claimed row's status** from `` `claimed` `` to `` `in-progress` `` (leave owner/date cells as-is).

- [ ] **Step 3: Add the T-GX-G7e row** immediately after the T-GX-G7 row, matching the table's column layout (ID | title/desc | lane | status | owner | date | notes):

```
| T-GX-G7e | **Crown worlds never sleep** — `tombDormant(pl)` (index.html:3118) gains a `!pl.crown` guard: a phaeron's court is already awake; non-crown Tomb Worlds keep the full wakes-with-war mechanic. One-line engine edit + a door-core test | 🔥 engine + tests | `open` | — | 2026-08-03 | Daak ruling 2026-08-03 (T-GX-G7 design §2). Removes the Necron faction-start asymmetry (both Necron crowns otherwise boot Tier-I-capped until sector conflict ≥ 40). |
```

- [ ] **Step 4: Verify + commit**

```bash
node --test 2>&1 | grep -E '^ℹ (pass|fail)'   # expect pass 412 / fail 0
git add BACKLOG.md
git commit -m "backlog: T-GX-G7 in-progress + T-GX-G7e crown-wake engine row"
```

---

### Task 2: Crown sweep — 16 retypes + legality lists + ghost cleanup

**Files:**
- Modify: `heretics-40k-data-v1.json` (planet `type` fields; `galaxy.location_types[].planet_types` lists)
- Create: `tests/canon-g7.test.js`

**Interfaces:**
- Produces: the 16 seats below; legality lists ghost-free. Task 3's floor test and Task 4's route test assume these types are in place.

- [ ] **Step 1: Write the failing test** — create `tests/canon-g7.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'heretics-40k-data-v1.json'), 'utf8'));

function planets() {
  const out = [];
  for (const seg of D.galaxy.segmentums)
    for (const z of seg.zones)
      for (const sec of z.sectors)
        for (const pl of sec.planets) out.push(pl);
  return out;
}
const byId = Object.fromEntries(planets().map((p) => [p.id, p]));

test('G7 crown sweep: the 16 seats (Daak 2026-08-03)', () => {
  const seats = {
    nurth: 'Plague Garden World', masque: 'Crossroads World',
    karzhorn: 'Anchorage World', prosperinep: 'Athenaeum World',
    skallaxp: 'Slaughter World', screamsink: 'Pleasure World',
    gorkamorka: 'Scrap World', shaadom: "Raider's Nest",
    devourermaw: 'Infested World', cadmus: 'Garrison World',
    hydraphur: 'Convent World', metalica_reach: 'Explorator World',
    sanctumprime: 'Cult World', macragge: 'Chapter World',
    saimhael: 'Exodite World', custodwatch: 'Vigil World',
  };
  for (const [pid, type] of Object.entries(seats))
    assert.strictEqual(byId[pid].type, type, pid);
  // explicitly unchanged
  assert.strictEqual(byId.terra.type, 'Hive World');
});

test('G7: every subfaction type is inhabited (>=1 minted planet)', () => {
  const have = new Set(planets().map((p) => p.type));
  for (const pt of D.galaxy.planet_types.filter((p) => p.faction))
    assert.ok(have.has(pt.name), pt.name + ' has at least one minted planet');
});

test('G7: legality lists carry no ghost planet types', () => {
  const names = new Set(D.galaxy.planet_types.map((p) => p.name));
  for (const lt of D.galaxy.location_types)
    for (const t of lt.planet_types || [])
      assert.ok(t === '*' || names.has(t), lt.id + ' legality ghost: ' + t);
});
```

**Note the planet ids** (verified against canon): `nurth, masque, karzhorn, prosperinep, skallaxp, screamsink, gorkamorka, shaadom, devourermaw, cadmus, hydraphur, metalica_reach, sanctumprime, macragge, saimhael, custodwatch, terra`.

- [ ] **Step 2: Run to verify it fails** — `node --test tests/canon-g7.test.js` → expect the sweep test FAILS (types still old) and the ghost test FAILS (`Frontier Forge World` etc.).

- [ ] **Step 3: Implement** — python script (use the Reference helpers):

```python
SEATS = {
 'nurth':'Plague Garden World','masque':'Crossroads World',
 'karzhorn':'Anchorage World','prosperinep':'Athenaeum World',
 'skallaxp':'Slaughter World','screamsink':'Pleasure World',
 'gorkamorka':'Scrap World','shaadom':"Raider's Nest",
 'devourermaw':'Infested World','cadmus':'Garrison World',
 'hydraphur':'Convent World','metalica_reach':'Explorator World',
 'sanctumprime':'Cult World','macragge':'Chapter World',
 'saimhael':'Exodite World','custodwatch':'Vigil World',
}
for pid, t in SEATS.items(): planet(pid)['type'] = t

LT = {l['id']: l for l in D['galaxy']['location_types']}
LT['lair']['planet_types'] += ['Anchorage World','Athenaeum World','Pleasure World','Scrap World',"Raider's Nest"]
pg = LT['plague_garden']['planet_types']
pg[pg.index('Plague World')] = 'Plague Garden World'
LT['shrine']['planet_types'] = [t for t in LT['shrine']['planet_types'] if t not in ('Chapel World','Cemetery World')] + ['Convent World']
ft = LT['forge_temple']['planet_types']
ft[ft.index('Frontier Forge World')] = 'Explorator World'
LT['manufactorum']['planet_types'].append('Explorator World')
LT['cult_sanctum']['planet_types'].append('Cult World')
LT['hive']['planet_types'].append('Cult World')
save()
```

- [ ] **Step 4: Full suite green** — `node --test 2>&1 | grep -E '^ℹ (pass|fail)'` → expect **pass 415 / fail 0** (412 + 3 new). If the legality loop in `tests/canon.test.js` fails, a retyped planet's location type is missing a legality entry — fix the LIST (per spec §5), never the planet.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-g7.test.js
git commit -m "canon: T-GX-G7 crown sweep - 16 retypes, legality lists, ghost cleanup"
```

---

### Task 3: Resource rows — 8 edits + the crown floor invariant

**Files:**
- Modify: `heretics-40k-data-v1.json` (`galaxy.planet_types[].resource_output`)
- Modify: `tests/canon-g7.test.js` (append block)

**Interfaces:**
- Consumes: Task 2's types (the floor test walks crown planets by their NEW types).

- [ ] **Step 1: Append the failing tests** to `tests/canon-g7.test.js`:

```js
test('G7 resource rows: the 8 tuned rows exact (Daak 2026-08-03)', () => {
  const by = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p.resource_output]));
  assert.deepStrictEqual(by['Plague Garden World'], { food: 6, material: 2, fuel: 1 });
  assert.deepStrictEqual(by['Crossroads World'], { food: 0, material: 1, fuel: 2 });
  assert.deepStrictEqual(by['Infested World'], { food: 3, material: 1, fuel: 1 });
  assert.deepStrictEqual(by['Exodite World'], { food: 4, material: 2, fuel: 1 });
  assert.deepStrictEqual(by['Vigil World'], { food: 0, material: 2, fuel: 3 });
  assert.deepStrictEqual(by['Scrap World'], { food: 0, material: 7, fuel: 2 });
  assert.deepStrictEqual(by['Athenaeum World'], { food: 1, material: 2, fuel: 3 });
  assert.deepStrictEqual(by['Convent World'], { food: 3, material: 2, fuel: 1 });
});

test('G7 crown floor rule: every type hosting a crown yields Material AND Fuel (Daak 2026-08-02)', () => {
  const by = Object.fromEntries(D.galaxy.planet_types.map((p) => [p.name, p.resource_output]));
  for (const p of planets().filter((p) => p.crown)) {
    const ro = by[p.type];
    assert.ok(ro.material > 0, p.id + ' (' + p.type + ') crown yields Material');
    assert.ok(ro.fuel > 0, p.id + ' (' + p.type + ') crown yields Fuel');
  }
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/canon-g7.test.js` → row test FAILS (old values), floor test FAILS (Plague Garden fuel 0 etc.).

- [ ] **Step 3: Implement** (Reference helpers):

```python
ROWS = {
 'Plague Garden World': {'food':6,'material':2,'fuel':1},
 'Crossroads World':    {'food':0,'material':1,'fuel':2},
 'Infested World':      {'food':3,'material':1,'fuel':1},
 'Exodite World':       {'food':4,'material':2,'fuel':1},
 'Vigil World':         {'food':0,'material':2,'fuel':3},
 'Scrap World':         {'food':0,'material':7,'fuel':2},
 'Athenaeum World':     {'food':1,'material':2,'fuel':3},
 'Convent World':       {'food':3,'material':2,'fuel':1},
}
for p in D['galaxy']['planet_types']:
    if p['name'] in ROWS: p['resource_output'] = ROWS[p['name']]
save()
```

- [ ] **Step 4: Full suite green** — expect **pass 417 / fail 0**. (`tests/canon-resources.test.js` pins Forge/Agri/Civilized/Dead rows — untouched by these 8.)

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-g7.test.js
git commit -m "canon: T-GX-G7 resource rows - 8 tuned, crown floor rule satisfied"
```

---

### Task 4: Tier-III routes — arena + reliquary door lists, 3 new locations

**Files:**
- Modify: `heretics-40k-data-v1.json` (`location_types` doors for `warzone`/`lair`/`shrine`; new locations on planets `konor`, `ironreliquary`, `dalyth`)
- Modify: `tests/canon-g7.test.js` (append block)

**Interfaces:**
- Consumes: Task 2's types (route test resolves each door's home type against minted planets).

- [ ] **Step 1: Append the failing test:**

```js
test('G7 routes: every homed door kind reachable at Tier III (criterion 1 + reliquary addendum)', () => {
  const LT = Object.fromEntries(D.galaxy.location_types.map((l) => [l.id, l]));
  const homes = D.rules.doors_tiering.t3_homes;
  for (const [kind, home] of Object.entries(homes)) {
    const ok = planets().some((p) => p.type === home &&
      p.locations.some((l) => (LT[l.type] && LT[l.type].doors || []).includes(kind)));
    assert.ok(ok, kind + ': some ' + home + ' planet carries a granting location');
  }
});

test('G7 routes: the three authored locations exist with correct tier', () => {
  const konor = byId.konor.locations.find((l) => l.type === 'orbital_dock');
  const ironr = byId.ironreliquary.locations.find((l) => l.type === 'orbital_dock');
  const gate = byId.dalyth.locations.find((l) => l.type === 'webway_portal');
  assert.ok(konor && konor.tier === 'orbit' && konor.condition === 'intact');
  assert.ok(ironr && ironr.tier === 'orbit' && ironr.condition === 'intact');
  assert.ok(gate && gate.tier === 'surface' && gate.condition === 'intact');
  const ids = planets().flatMap((p) => p.locations.map((l) => l.id));
  assert.strictEqual(ids.length, new Set(ids).size, 'location ids unique galaxy-wide');
});
```

- [ ] **Step 2: Run to verify it fails** — `node --test tests/canon-g7.test.js` → shipyard/arena/warp_gate/reliquary homes unreachable; locations absent.

- [ ] **Step 3: Implement** (Reference helpers). Note `level: 1` matches every minted location:

```python
LT = {l['id']: l for l in D['galaxy']['location_types']}
LT['warzone']['doors'].append('arena')
LT['lair']['doors'].append('arena')
LT['shrine']['doors'].append('reliquary')

planet('konor')['locations'].append({
 'id':'konoryards','name':'Konor Yards','type':'orbital_dock','tier':'orbit',
 'condition':'intact','level':1,
 'desc':'Slipway rings above Konor — hulls for the Ultramar battlefleets take shape here.'})
planet('ironreliquary')['locations'].append({
 'id':'ironrelchainyards','name':'The Chained Yards','type':'orbital_dock','tier':'orbit',
 'condition':'intact','level':1,
 'desc':'Captive shipwrights weld crusade hulls under Black Legion guns.'})
planet('dalyth')['locations'].append({
 'id':'dalythfencedgate','name':'The Fenced Gate','type':'webway_portal','tier':'surface',
 'condition':'intact','level':1,
 'desc':'An ancient warp gate the earth caste has ringed with survey pylons — studied, feared, and quietly used.'})
save()
```

- [ ] **Step 4: Full suite green** — expect **pass 419 / fail 0**. The canon 3–5-locations and ≥2-surface tests must stay green (all three hosts go 3→4; surface counts hold). If the id-uniqueness assert fails, an id above collides — pick a new id, don't rename existing ones.

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-g7.test.js
git commit -m "canon: T-GX-G7 tier-III routes - arena/reliquary door lists, Konor+Iron Reliquary docks, Dal'yth gate"
```

---

### Task 5: Starting conditions — 5 seats

**Files:**
- Modify: `heretics-40k-data-v1.json` (5 location `condition` fields)
- Modify: `tests/canon-g7.test.js` (append block)

**Interfaces:**
- Consumes: planet ids `vigilus, sumphaven, solacescar, mordathscar, cominor` — ALL VERIFIED against canon 2026-08-03, target locations all currently `intact`. (The design's original 5th seat, Kraith Verge's space_station, is already authored `drifting` — Daak moved the seat to Cominor's manufactorum, spec §6.)

- [ ] **Step 1: Append the failing test:**

```js
test('G7 conditions: 5 seats wake Defend/Liberation weighting (Daak 2026-08-03)', () => {
  const seat = (pid, ltype) => byId[pid].locations.find((l) => l.type === ltype).condition;
  assert.strictEqual(seat('vigilus', 'city'), 'besieged');
  assert.strictEqual(seat('sumphaven', 'hive'), 'infested');
  assert.strictEqual(seat('solacescar', 'shrine'), 'besieged');
  assert.strictEqual(seat('mordathscar', 'fortress'), 'besieged');
  assert.strictEqual(seat('cominor', 'manufactorum'), 'infested');
  const ids = new Set(D.galaxy.conditions.map((c) => c.id));
  for (const p of planets()) for (const l of p.locations)
    assert.ok(ids.has(l.condition), l.id + ' valid condition ' + l.condition);
});
```

- [ ] **Step 2: Run to verify it fails** — conditions still `intact`.

- [ ] **Step 3: Implement** (Reference helpers):

```python
for pid, ltype, cond in [('vigilus','city','besieged'),('sumphaven','hive','infested'),
                         ('solacescar','shrine','besieged'),('mordathscar','fortress','besieged'),
                         ('cominor','manufactorum','infested')]:
    loc = next(l for l in planet(pid)['locations'] if l['type'] == ltype)
    loc['condition'] = cond
save()
```

- [ ] **Step 4: Full suite green** — expect **pass 420 / fail 0**. Watch `tests/canon-missions.test.js` (it reads condition ids, not seats — should be untouched).

- [ ] **Step 5: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon-g7.test.js
git commit -m "canon: T-GX-G7 conditions - 5 besieged/infested seats across three segmentums"
```

---

### Task 6: Desc consistency pass — 6 authored replacements

**Files:**
- Modify: `heretics-40k-data-v1.json` (6 planet `desc` strings)

**Interfaces:** none downstream — content-only; no new tests (no canon test reads desc content beyond existence).

- [ ] **Step 1: Apply the 6 authored replacements** (Reference helpers). These are the only retyped planets whose descs still name/lean on the OLD type; the other 10 read correctly already (verified in design):

```python
DESCS = {
 'nurth': "Nurgle's walled garden — blight cultivated like a crop beneath a jaundiced sky, and the Death Guard its patient gardeners.",
 'screamsink': 'A drowned pleasure-realm of sinkholes and endless echoing choirs — every trade here serves appetite, and the appetite is the capital of a corrupted reach.',
 'hydraphur': "Seat of the Order's motherhouse and the naval heart of the segmentum — convent fields and orbital dockyards, where the Adepta Sororitas keep the Emperor's peace over Battlefleet Pacificus.",
 'metalica_reach': 'A daughter-forge turned expedition seat — the Cog-Marches are ruled from its archeotech vaults, and its excavations reach older than the Imperium.',
 'macragge': 'The jewel of Ultramar and seat of the sector — the fortress-monastery of blue-and-gold whose harsh proving grounds have held the eastern marches unbroken.',
 'custodwatch': "The Ten Thousand's outer vigil — a ring-watch over the near-Solar approaches. Few are stationed here, and nothing passes them.",
}
for pid, d in DESCS.items(): planet(pid)['desc'] = d
save()
```

- [ ] **Step 2: Full suite green** — expect **pass 420 / fail 0** (no count change).

- [ ] **Step 3: Commit**

```bash
git add heretics-40k-data-v1.json
git commit -m "canon: T-GX-G7 desc pass - 6 retyped planets read as their new types"
```

---

### Task 7: Version 1.29 + changelog + boot verify + BACKLOG ready-to-push

**Files:**
- Modify: `heretics-40k-data-v1.json` (`meta.version`, `meta.changelog`)
- Modify: `tests/canon.test.js:10-11,136` · `tests/canon-missions.test.js:59-60,63-64` · `tests/canon-spoils.test.js:45` · `tests/canon-resources.test.js:8` · `tests/canon-doors.test.js:10` (every `'1.28'` → `'1.29'`)
- Modify: `BACKLOG.md` (T-GX-G7 row → ready-to-push)

- [ ] **Step 1: Bump canon version + history note** — version history lives in `meta.notes` (a list of strings; VERIFIED — there is no `meta.changelog`). Also bump `meta.updated`:

```python
D['meta']['version'] = '1.29'
D['meta']['updated'] = '2026-08-03'
D['meta']['notes'].append("v1.29: T-GX-G7 galaxy re-run - 16 crown-sweep retypes seat all 21 subfaction types (crown-only), 8 resource rows tuned to the crown floor rule, tier-III routes opened (shipyard docks on Konor/Iron Reliquary, arena via warzone+lair, reliquary via shrine, warp gate on Dal'yth Verge), legality ghosts cleaned, 5 besieged/infested condition seats (5th on Cominor).")
save()
```

- [ ] **Step 2: Bump every test pin** — in the 5 test files listed above, replace each `'1.28'` with `'1.29'` (8 assertion sites; `grep -rn "1\.28" tests/` must return ZERO hits afterwards).

- [ ] **Step 3: Full suite green** — `node --test 2>&1 | grep -E '^ℹ (pass|fail)'` → expect **pass 420 / fail 0**. Then `grep -rn "1\.28" tests/ index.html` → zero hits.

- [ ] **Step 4: Browser boot verify** — `python3 -m http.server 8765` (background), open `http://localhost:8765` via the Playwright MCP, capture `window` errors (expect 0), confirm the boot rail shows **data v1.29**, open the Map screen and click one retyped planet (e.g. Gorkamorka — Scrap World) to confirm the location panel renders. Kill the server.

- [ ] **Step 5: BACKLOG → ready-to-push** — set the T-GX-G7 row status to `` `ready-to-push` ``, append to its notes: `commits: <list the task 1-7 hashes>; paths: heretics-40k-data-v1.json, tests/canon-g7.test.js, tests/canon*.test.js (pins), BACKLOG.md, docs/superpowers/specs/2026-08-03-galaxy-rerun-types-doors-design.md, docs/superpowers/plans/2026-08-03-galaxy-rerun-types-doors.md`.

- [ ] **Step 6: Commit**

```bash
git add heretics-40k-data-v1.json tests/canon.test.js tests/canon-missions.test.js tests/canon-spoils.test.js tests/canon-resources.test.js tests/canon-doors.test.js BACKLOG.md
git commit -m "canon v1.29: T-GX-G7 galaxy re-run complete - version bump + pins, ready-to-push"
```
