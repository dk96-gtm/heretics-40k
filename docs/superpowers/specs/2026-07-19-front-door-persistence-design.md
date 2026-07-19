# Front Door + Persistence Backbone — Design (T-FD1)

**Date:** 2026-07-19 · **Status:** design (brainstorm complete) — ready for slice plan
**Engine baseline:** v18 · **Canon baseline:** data v1.11 · **Lane:** 🔥 engine + tests + docs
**Backlog:** `T-FD1` (claimed) · **Sequel:** NPC-grid combat + per-faction homeworlds (own spec)

---

## 1. Goal

Give the game a **front of the funnel** and, underneath it, the **persistence layer the whole
concurrent effort is blocked on.** Boot into a real title screen; a player's identity *and full
game-state* survive a reload; the already-built Founding rite finally spawns a playable commander.

One sentence: **the SAVE core is the "Stage-2 persistence" three shipped/in-flight workstreams
already defer to — built now, local, behind a seam that goes online unchanged.**

---

## 2. Why now — the real reason the demo is stalled

`init()` hard-calls `demoSave()` every boot; only `{npcState, time}` persists (`LS_NPC`). So every
reload wipes roster/forces/threads/world back to the fixed Kane demo. Three workstreams independently
name the same gap:

```
  living-world tick   → "live accumulation needs Stage-2 persistence"   (S.world overlays reset)
  galaxy territory    → "live flywheel accumulation needs Stage-2 persistence"
  the player          → your commander/forces/threads never survive a reload
                        ▲ ALL THREE are waiting on one full-S save layer. This is it.
```

The stall is not stale content (canon is deep — v1.11, 100 models, 102 weapons, the grid, the tick).
It is that **nothing accumulates.** Persistence is the unlock.

---

## 3. Locked decisions (from brainstorm 2026-07-19)

| # | Decision |
|---|---|
| Login model | **Local profile shell** — feels like login; no accounts/passwords/server in Pass 1. |
| Scope | **Front-door first.** Populated-galaxy + fighting-NPCs are the *sequel* spec (§11). |
| Profile | **Single active profile.** No slot picker. `NEW COMMANDER` guards overwrite (confirm + "Export first?"). |
| Voice | **Plain verbs, grimdark skin** (2026-07-20): `NEW COMMANDER` / `CONTINUE` / `SETTINGS`, GTM/40K styled (acid-green on void). Not in-fiction menu labels. |
| Return | **World digest on the title** (2026-07-20): for a returning profile, `WORLD.catchUp` runs at boot and the "while you were away…" digest renders **on the title screen**, before entering — the front door is a living dashboard. |
| Demo | **Retired** (2026-07-20). `NEW COMMANDER` is the only way in. Kane's **world** (Vigilus overlays/NPCs/threads) is kept as the shared **Pass-1 starting sector** (`foundingWorld()`); the Kane **player** demo is kept only as a test fixture, not a menu path. No `demo` save key. |
| Online | **Seam now, online next.** SAVE core speaks to a storage *adapter*; `LocalStore` ships, `RemoteStore` (the NPC-AI CF Worker) drops into the same interface at Stage-2. Matches every sibling spec's `localStorage → backend` staging. |
| Starter army | New commander = the commander model + a **small founding Force** (2 base models from the faction roster) so Barracks isn't empty. |
| Autosave | **Debounced write + `beforeunload`**; manual **Export/Import JSON** in Settings as insurance. |
| Canon | **Engine-only. Zero canon edits** → no collision with the galaxy agent's JSON authoring. |

---

## 4. Architecture — five units, clean boundaries

```
  ┌─ SAVE CORE (pure region /*<save-core>*/) ─────────────┐  node-tested like THREAD/LOADOUT/WORLD
  │  STORE adapter  : get/set/del/keys (async-shaped)      │  LocalStore now · RemoteStore later
  │  serialize(S)   : structural clone − circular refs      │  → a flat, JSON-safe blob
  │  hydrate(blob,D): blob → live S (rebuild refs)          │  reuses init()'s existing rebuild
  │  profile ops    : has/load/save/clear (single 'profile')│  + foundingWorld() seed
  └───────────────────────────┬───────────────────────────┘
         impure shell (index.html, DOM/localStorage) calls the pure core:
  ┌──────────────┬─────────────┴───────┬──────────────────┬────────────────────┐
  │ TITLE screen │ SETTINGS screen     │ ONRAMP           │ BOOT reseq          │
  │ (new overlay)│ (upgrade ⚙ gear)    │ commitFounding() │ (wrap init, minimal)│
  └──────────────┴─────────────────────┴──────────────────┴────────────────────┘
```

### 4.1 SAVE core (pure, DOM-free region — the testable heart)
- **`STORE` adapter interface:** `get(key)→blob|null`, `set(key,blob)`, `del(key)`, `keys()`.
  `LocalStore` wraps `localStorage` (JSON string per key). `RemoteStore` (later) hits the CF Worker
  with the *same* method shape. SAVE core NEVER calls `localStorage` directly — that is the seam.
  Methods are written Promise-tolerant so the local (sync) and remote (async) adapters share code.
- **`serialize(S)`:** deep structural clone of `S`, then:
  - **strip circular refs:** `thread.state.combatants[id].model` → drop (rebuilt from `id`);
    `combatants[id].armour` → drop (rebuilt from the model's loadout).
  - **denylist ephemerals:** `_digest` (recomputed each boot), any transient rite/UI temp
    (`cc`/`nm`/`mode` if present on `S`), `cart` optional. Everything else persists as-is —
    so fields the tick/galaxy agents keep adding ride along automatically (schema-growth-safe).
- **`hydrate(blob, D)`:** parse blob → `S`, then run the **same rebuild `init()` already does**
  (lines ~1968–1980): `migrateLoadout`, `THREAD.create` per thread, re-attach
  `combatants[id].model` from roster + `.armour` from loadout, `enrichRoster`, `fixLeaderTags`.
  Returns a live `S` ready for `WORLD.catchUp`.
- **profile ops:** one key, `PROFILE_KEY='heretics_profile_v1'`.
  `hasProfile()`, `loadProfile()`, `saveProfile(S)`, `clearProfile()`. (No demo key — demo retired.)
- **`foundingWorld()`:** extracted from today's `demoSave()` — the faction-agnostic **starting world**
  (Vigilus overlays / NPC forces / seeded threads) any new commander drops into for Pass-1. The
  Kane-specific player/roster half of `demoSave()` is retired from the boot path (kept as a test
  fixture). The galaxy agent later replaces/extends this world; `foundingWorld()` just returns
  whatever the current alpha sector is.

### 4.2 TITLE screen (new full-screen overlay, shown before `#shell`)
Plain verbs, GTM/40K skin (acid-green on void-black), art slot = wireframe placeholder. Rows gated
by `hasProfile()`:
```
  RETURNING (profile exists):              FIRST RUN (no profile):
  ▸ CONTINUE   <commander·faction·rank>    ▸ NEW COMMANDER   found a lineage
  ▸ NEW COMMANDER  (replaces current)      ▸ SETTINGS
  ▸ SETTINGS
  ⚠ while you were away — <digest lines>    saved to this browser · canon v1.11 · engine v18
```
- **Digest on the title:** when a profile is loaded, `WORLD.catchUp` has already run (see §4.5), so
  `S._digest` is available — render its lines beneath `CONTINUE` as the "living dashboard" beat. Empty
  digest (no time passed) → no banner.
- `CONTINUE` → `enterShell(S)`. `NEW COMMANDER` over an existing profile → overwrite confirm.

### 4.3 SETTINGS screen (upgrade the existing floating `⚙ AI` gear)
- **AI** — key + model (move the existing `LS_KEY`/`LS_MODEL` flow here, unchanged behaviour).
- **Save management** — Export save (download JSON), Import save (upload+validate JSON),
  Delete profile, **Return to title**.
- **About** — canon/engine version, live + repo links, "local sandbox" note.
- Reachable from title AND in-game.

### 4.4 ONRAMP — `commitFounding(cc)` (wire the built-but-dead rite)
`mkRite`'s Founding wizard already captures every choice in `RS.cc` (allegiance/faction/background/
model/2 origins/appearance/name) and computes the commander's final profile at step 6
(index.html ~1865–1871). Today the finish line just toasts and `go('threads')` — **it never
writes `S`.** `commitFounding(cc)`:
1. Reuse the existing step-6 math to build the commander model (deltas + origins + PC premium + tags).
2. Build a fresh `S`: `player` identity from `cc`; `roster=[commander, …2 base models from the
   faction roster]`; a founding `Force` led by the commander; starting `cur/infl/dom` from
   `rules.economy.founding_start`; `pos` = the alpha start (`// Pass 2: seed faction homeworld`);
   `threads:[]`; `world = foundingWorld()` (§4.1); `time` fresh (`lastTick = now` — owes no catch-up).
3. `SAVE.saveProfile(S)` → enter the shell.

### 4.5 BOOT reseq — minimal wrapper preserving the shipped tick math
```
  boot → fetch canon → build STORE → hasProfile()?
     ├─ YES: S = hydrate(loadProfile()) → migrate/enrich → WORLD.catchUp(S,D,now) → S._digest
     │        → TITLE [CONTINUE + digest banner · NEW COMMANDER · SETTINGS]
     │        CONTINUE → enterShell(S)                    (digest already shown on title)
     │        NEW      → confirm-overwrite → commitFounding(cc) → enterShell(S)
     └─ NO:  TITLE [NEW COMMANDER · SETTINGS]
              NEW → commitFounding(cc) → enterShell(S)    (fresh S, lastTick=now, no catch-up)
  in-play → any S mutation → SAVE.persist() (debounced 800ms) + beforeunload flush
```
Today's `init()` body (everything after `S=demoSave()`) becomes **`enterShell(S)`**, called once a
profile is chosen. `init()` shrinks to: canon-ready → STORE → (if profile: hydrate + tick) → show
TITLE. **The tick math is unchanged — `WORLD.catchUp` still runs once per boot and stays idempotent;**
the only move is *where its digest surfaces* — on the title for a returning player (the locked
"living dashboard" beat) rather than only inside HQ. `enterShell` does not re-tick (idempotent
`catchUp` makes a stray second call harmless anyway). **Coordination note:** this relocates the
`renderDigest` call site the living-world author placed in `init()` — a touch-point to flag if that
workstream is mid-edit.

---

## 5. Persistence details

- **Unify legacy `LS_NPC`.** `npcState` and `time` (incl. `time.lastTick`, the flywheel's field)
  are `S` fields — they persist through the profile save now. `saveNPC()`/`loadNPC()` are retired in
  favour of the unified profile save; on first Pass-1 boot, if an old `LS_NPC` exists and no profile
  does, absorb its `{npcState,time}` into the profile (one-time migration), then ignore it.
- **`persist()`** serializes the *active* `S` to `PROFILE_KEY`, debounced;
  a `beforeunload` handler flushes synchronously. No autosave during the `deploy`/`battle` freeze is
  needed — state still serializes fine; the freeze is a loadout lock, not a save lock.
- **Corruption safety:** `hydrate` is wrapped; a parse/shape failure surfaces a title-screen notice
  ("save could not be read — Export is unavailable; New Commander to continue") rather than a white
  screen. Never silently discard a save.

---

## 6. Storage adapter seam (how "best case online" lands later, unchanged)

```
  Pass 1 (this spec):  SAVE core ── STORE = LocalStore ── localStorage
  Stage 2 (sequel):    SAVE core ── STORE = RemoteStore ── CF Worker + KV  (same 4 methods)
```
Because SAVE core is adapter-only and Promise-tolerant, going online is a **constructor swap**, not a
rewrite — and the living-world tick, which reads the same `S`, goes shared at the same moment.

---

## 7. Coordination / touch-points (🔥 engine lane)

- **Hot-lane discipline:** claim sits `claimed` during spec (docs, parallel). Flip to `in-progress`
  only to build; land in tight, `node --test`-green commits; mark `ready-to-push` promptly so BF/NPC
  agents get the lane back.
- **`index.html` regions I touch:** `init()` (split into `init`+`enterShell`), the boot/`#boot`/
  `#shell` show-hide, a new `/*<save-core>*/` region near the other pure cores, the `⚙ AI` gear →
  Settings screen, `mkRite` finish (`commitFounding`). I do **not** touch the THREAD/WORLD/LOADOUT
  cores, the grid glue, or canon.
- **Explicit-path commits only** (`git add <paths>`, never `-A`). Keep tree green at every pause.
- **Watch:** the galaxy agent grows `S.world`/territory shape — the clone-everything serialize is
  chosen precisely so those additions persist without a spec change on my side.

---

## 8. Testing

- **`tests/save-core.test.js`** (`node --test`, zero-dep, mirrors `_load.js` region-eval):
  - **round-trip:** `hydrate(serialize(demoSave-like), D)` deep-equals the original on all stable
    fields; circular refs are re-attached (combatant.model === the roster instance by id).
  - **ephemeral drop:** `_digest`/temp fields absent from the blob; present+rebuilt after hydrate.
  - **schema-growth:** an unknown `S.someNewOverlay` field survives round-trip untouched.
  - **adapter:** an in-memory `MockStore` satisfies the same interface; save→load returns equal blob.
  - **corruption:** malformed blob → `hydrate` throws caught → sentinel, no crash.
- **Boot proxy** `engine-syntax.test.js` still compiles the inline script (unchanged).
- **In-browser (pre-commit):** New Commander → reload → same commander loads; buy gear → reload →
  gear persists; back-date `lastTick` → reload → CONTINUE shows the digest banner on the title;
  New Commander over an existing profile → confirm fires; 0 console errors.

---

## 9. Build slices (hot-lane-minimizing order)

```
  FD-A · SAVE CORE (pure)   /*<save-core>*/ region: STORE iface + LocalStore + serialize/hydrate
                            + profile ops. tests/save-core.test.js. (Touches index.html once, small,
                            far from boot code — quick 🔥 in/out.)
  FD-B · BOOT RESEQ         split init→init+enterShell; TITLE overlay; wire CONTINUE + digest-on-title;
                            foundingWorld() extract; persist()
                            + beforeunload; unify LS_NPC. Preserve catchUp→digest.
  FD-C · ONRAMP             commitFounding(cc); wire NEW COMMANDER; founding Force seed.
  FD-D · SETTINGS           Settings screen (AI moved in) + Export/Import/Delete/Return-to-title.
```
Each slice: TDD where logic is pure (FD-A fully), browser-verified, committed test-green, then the
lane is released between slices if another engine task is waiting.

---

## 10. Error / edge handling

- No profile → title shows only NEW COMMANDER + SETTINGS (CONTINUE hidden).
- `NEW COMMANDER` over an existing profile → confirm ("this replaces <name> — Export first?").
- Import of a foreign/old blob → validate shape; reject with a message, never partial-load.
- `localStorage` unavailable/full (private mode, quota) → in-memory fallback + a "saves disabled"
  banner; game still playable for the session. (`try/catch` around every STORE op.)
- Clock skew / missing `lastTick` → already handled by `WORLD.catchUp` (elapsed clamped ≥0).

---

## 11. Out of scope / sequel (own spec, later)

- **NPC-grid combat** (T-NPC-2b territory): enemy AI deploys + moves + fires on the battlefield grid.
- **Per-faction homeworlds:** a new commander waking on their own world (needs the galaxy mint;
  Pass-1 marker `// Pass 2: seed faction homeworld` left at the spawn).
- **RemoteStore / online saves + accounts:** the adapter's other implementation (Stage-2).
- **Multiple profiles / cloud sync / cross-device:** deliberately single-profile in Pass 1.
- **Art:** title/screen art stays wireframe; its own conversation.
```
