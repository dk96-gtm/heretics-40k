# Speaker-Attributed Thread Log — Implementation Plan (T-THR-1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make thread posts legible about *who says what* — each speaking model gets a colour that tints its spoken (`<b>`) lines, its name label, and a left-accent bar; inner thought (`<i>`) reads dimmed; plain text reads as narration.

**Architecture:** Presentation-only, inside the existing `threadView` post-render path — **no `THREAD`-core change**. A per-model `speechColor` lives in save-state `S` (editable from the model-overview overlay for owned models; auto-assigned from a palette otherwise). The renderer sets a per-post `--speech` CSS variable and two CSS rules restyle the existing `<b>`/`<i>` the composer toolbar already emits (`execCommand`). "Full identity" treatment (locked with user 2026-07-20): colour reaches spoken text + name label + left bar.

**Tech Stack:** Vanilla ES5 `index.html`; `node --test` for the one pure helper.

## Global Constraints

- **Baseline:** engine v18+ · canon v1.14 (read-only — **ENGINE-ONLY, no canon edits**).
- **Terminology law:** always **"model"**, never "chassis".
- **🔥 engine lane HOT:** do not edit `index.html` until T-THR-1 holds `in-progress` and no other engine task does (T-NPC-2b currently holds it). `tests/**`/`docs/**` are parallel-safe.
- **Commit hygiene:** `git add <explicit paths>`, never `-A`; never stage `heretics-40k-data-v1.json`; tree `node --test`-green each pause.
- **Reuse, don't rebuild** (board BUILD LAW): extend `threadView` render + the model-overview overlay; `speechColor` rides the profile save (already persisted by SAVE core).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Design facts (verified in code)

- Posts are `{who, body, tag, stamp, block?}`. `who` = speaker name — player posts use `activeModel().n.split(',')[0]`; NPC posts use `npc.name`. **Per-post attribution already exists.**
- `body` is **HTML** from the composer's `execCommand` toolbar (`<b>`/`<i>`/`<u>`/`<s>`), not markdown. The renderer restyles those tags — no parsing.
- Current render (index.html ~1928): `<span class="who you|en">who</span> … <div class="body">body</div>`.
- Current CSS (`.post .body`) sets the **whole body italic** — this is retired so plain text = narration.

## File structure

- `index.html` — add a small `SPEECH_PALETTE` + pure `pickSpeechColor(name, roster, palette)` helper (near the save/render helpers); restyle the post render; add a swatch picker to the model-overview overlay; CSS for `.post` accent + `.body b`/`.body i`.
- `tests/speech-color.test.js` — **create**; pure test for `pickSpeechColor` (stable, distinct-for-owned, deterministic-for-NPC).

---

## Task 1: Pure `pickSpeechColor` helper + palette

**Files:** Create `tests/speech-color.test.js`; Modify `index.html` (add `SPEECH_PALETTE` + `pickSpeechColor`, exported on `window` for the test to reach, near other render helpers).

**Interfaces:**
- Produces: `SPEECH_PALETTE` = 8 hex colours readable on void black.
- Produces: `pickSpeechColor(name, roster, palette)` → a colour string. Owned model (found in roster by `n===name` or `n.split(',')[0]===name`): returns its `speechColor` if set, else the palette slot at its roster index (mutating the model to cache it). Non-roster (NPC/other): deterministic palette slot from a name hash. Pure w.r.t. globals (roster+palette passed in).

- [ ] **Step 1: Write the failing test** — `tests/speech-color.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
// eval just the helper region so we can unit-test it without a DOM
const html = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const m = html.match(/\/\*<speech-core>\*\/([\s\S]*?)\/\*<\/speech-core>\*\//);
if(!m) throw new Error('speech-core region not found');
const ctx = {}; vm.runInNewContext(m[1]+'\n;this.SPEECH_PALETTE=SPEECH_PALETTE;this.pickSpeechColor=pickSpeechColor;', ctx);
const { SPEECH_PALETTE, pickSpeechColor } = ctx;

test('owned model gets a stable palette colour by roster index', () => {
  const roster = [{n:'Castellan Thorne'},{n:'Scout 1'}];
  const c0 = pickSpeechColor('Castellan Thorne', roster, SPEECH_PALETTE);
  assert.strictEqual(c0, SPEECH_PALETTE[0]);
  assert.strictEqual(roster[0].speechColor, SPEECH_PALETTE[0], 'cached on the model');
  // resolves by short name too, and stays stable
  assert.strictEqual(pickSpeechColor('Castellan Thorne', roster, SPEECH_PALETTE), c0);
});

test('an explicit speechColor overrides the default', () => {
  const roster = [{n:'Kane', speechColor:'#123456'}];
  assert.strictEqual(pickSpeechColor('Kane', roster, SPEECH_PALETTE), '#123456');
});

test('non-roster speaker (NPC) is deterministic by name', () => {
  const a = pickSpeechColor('Brood-Tyrant Sskarith', [], SPEECH_PALETTE);
  const b = pickSpeechColor('Brood-Tyrant Sskarith', [], SPEECH_PALETTE);
  assert.strictEqual(a, b);
  assert.ok(SPEECH_PALETTE.indexOf(a) >= 0);
});
```

- [ ] **Step 2: Run — expect fail** (`node --test tests/speech-color.test.js` → "speech-core region not found").

- [ ] **Step 3: Add the region to `index.html`** (near the other render helpers, e.g. just before `function threadComposer`):

```js
/*<speech-core>*/
var SPEECH_PALETTE=['#9fef00','#37d6ff','#ffb347','#c792ea','#ff6b8a','#4ec9b0','#e0e060','#7aa2f7'];
function pickSpeechColor(name,roster,palette){
  roster=roster||[];
  var idx=-1,mm=null;
  for(var i=0;i<roster.length;i++){var n=roster[i].n||'';if(n===name||n.split(',')[0]===name){mm=roster[i];idx=i;break;}}
  if(mm){ if(!mm.speechColor)mm.speechColor=palette[idx%palette.length]; return mm.speechColor; }
  var h=0;for(var j=0;j<name.length;j++)h=(h*31+name.charCodeAt(j))>>>0;
  return palette[h%palette.length];
}
/*</speech-core>*/
```

- [ ] **Step 4: Run — expect pass** (3/3). Then `node --test` full suite green.

- [ ] **Step 5: Commit**
```bash
git add tests/speech-color.test.js index.html
git commit -m "speech: pure pickSpeechColor + palette (TDD)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Restyle the post render — colour + name + accent + thought

**Files:** Modify `index.html` — the post render (~line 1928) and post CSS (~lines 99–100).

**Interfaces:** Consumes `pickSpeechColor` (Task 1). No new exports.

- [ ] **Step 1: Update the post CSS.** Replace the `.post .body{…font-style:italic…}` rule and extend `.post`/`.who`:

```css
.post{border-left:3px solid var(--speech,var(--br))}
.post .ph .who{font-weight:700;color:var(--speech,var(--brh))}
.post .body{padding:13px;font-size:14px;line-height:1.6}            /* narration = plain (italic removed) */
.post .body b,.post .body strong{color:var(--speech,inherit);font-weight:600}   /* spoken */
.post .body i,.post .body em{color:var(--dim);font-style:italic;font-weight:400} /* thought */
```

- [ ] **Step 2: Set `--speech` per post in the render.** At index.html ~1928, compute the colour and put it on the `.post` element as a CSS var (so both the border, the name, and the body `<b>` pick it up). Change:

```js
'<div class="post"><div class="ph"><span class="who '+(p.tag==='you'?'you':'en')+'">'+p.who+'</span>'+
```
to:
```js
'<div class="post" style="--speech:'+pickSpeechColor(p.who,S.roster,SPEECH_PALETTE)+'"><div class="ph"><span class="who">'+p.who+'</span>'+
```
(The `you`/`en` class is dropped from `.who` — identity now comes from `--speech`. Leave `p.tag` itself untouched; other code still reads it.)

- [ ] **Step 3: Browser-verify** (serve; `python3 -m http.server 8765`). Open a thread with an NPC exchange (the demo `ash` skirmish): each speaker's name + left bar are coloured distinctly; bold text takes the speaker colour; italic text is dimmed; plain text is normal. 0 console errors. **Note:** if the composer emitted `<span style="font-weight:bold">` instead of `<b>` on this browser, add `.post .body span[style*="bold"]{color:var(--speech)}`; verify by inspecting a composed post.

- [ ] **Step 4: Commit**
```bash
git add index.html
git commit -m "speech: colour spoken/name/accent per speaker in the thread log render

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `speechColor` swatch picker on the model overview (owned models)

**Files:** Modify `index.html` — the model-overview overlay builder (`mkOverview`/the overview render that shows the model name).

**Interfaces:** Consumes `SPEECH_PALETTE`, `pickSpeechColor`, `persist` (from SAVE shell).

- [ ] **Step 1: Add a swatch row next to the name** in the overview, only for owned models (models present in `S.roster`). Render the palette as clickable swatches; the current colour is ringed:

```js
// where the overview renders the model's name/header, for an owned model m:
var _cur=pickSpeechColor(m.n,S.roster,SPEECH_PALETTE);
var sw='<div class="swrow" style="display:flex;gap:5px;margin-top:6px;align-items:center"><span style="font-size:10px;color:var(--dim)">SPEECH</span>';
SPEECH_PALETTE.forEach(function(c){ sw+='<button class="sw" data-c="'+c+'" style="width:15px;height:15px;border-radius:50%;background:'+c+';border:2px solid '+(c===_cur?'#fff':'transparent')+'"></button>'; });
sw+='</div>';
// …insert `sw` into the overview HTML under the name…
// after injecting, wire:
MOV.querySelectorAll('.sw').forEach(function(b){ b.onclick=function(){ m.speechColor=b.dataset.c; persist(); /* re-render overview + any open thread */ openOverview(m); if(typeof CURT!=='undefined'&&CURT)openT(CURT.id); }; });
```
(Use the overview's actual re-render fn name in place of `openOverview`/`CURT`; inspect when implementing.)

- [ ] **Step 2: Browser-verify.** Open an owned model's overview → SPEECH swatch row shows, current colour ringed; click another → the model's name/bold lines in an open thread recolour; reload → the chosen colour persists (it rides the profile save). NPC overviews show **no** picker. 0 console errors.

- [ ] **Step 3: Commit**
```bash
git add index.html
git commit -m "speech: per-model colour picker on the model overview (owned models), persisted

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Multi-speaker sample verification + finish

- [ ] **Step 1: Multi-speaker sample.** In a thread, confirm a PC↔NPC exchange plus two owned models posting (switch active model between posts) reads with three distinct speaker colours and correct spoken/thought/narration styling. 0 console errors across Threads/Comms/HQ.
- [ ] **Step 2: Full suite** `node --test` green (incl. `speech-color.test.js`).
- [ ] **Step 3:** Set `BACKLOG.md` T-THR-1 → `ready-to-push` (explicit-path commit). Do not push.

## Deferred (noted, not built)
- **Multiple speakers within a single post** via inline `[Name]` tags — per-post `who` colouring covers the common case; inline tags are a later enhancement.
- **NPC-authored colours** (server-side) — Stage 2/3; auto palette-by-name holds until then.

## Self-review
- 3 signals (spoken/thought/narration) → Task 2 CSS ✓ · speaker colour on bold+name+accell → Task 2 ✓ (full-identity, user-locked) · per-model `speechColor` in S, editable, persisted → Tasks 1+3 ✓ · owned-only picker → Task 3 ✓ · no THREAD-core change → design ✓ · reuse threadView+overview+SAVE persist → ✓ · engine-only → ✓.
