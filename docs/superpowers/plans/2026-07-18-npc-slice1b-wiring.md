# NPC Living World — Slice 1B (Plan A2): Engine Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the shipped pure `NPCAI` core into the live engine so a player can add an API key, summon an NPC in a thread (and via Comms), get a truly in-character reply, and have the NPC remember it across reloads — with every post stamped in in-game time.

**Architecture:** All new code is impure DOM/network glue (browser-direct `fetch`, `localStorage`, DOM) placed in a marked `/* ---- AI engine ---- */` block in `index.html` right after the pure `/*</ai-core>*/` region. It CALLS the pure `NPCAI.*` (buildBundle → validateReply → applyDelta, instantiate, stampAt, worldScope) but the impure layer owns the key, the fetch, persistence, and rendering. The pure core is never edited.

**Tech Stack:** Vanilla ES5-style JS in one HTML file (no build step). Anthropic Messages API via browser-direct `fetch` (`anthropic-dangerous-direct-browser-access`). `localStorage` for the API key and the evolving NPC state. Verification is **Playwright MCP with a mocked `fetch`** (no real key/network needed to prove the flow), plus the existing `node --test` suite as a parse gate.

## Global Constraints

- **Two files ship:** only `index.html` + `heretics-40k-data-v1.json`. `tests/` is dev-only.
- **Terminology law:** always "model", never "chassis" — in all code and copy.
- **Never edit the pure core:** the `/*<ai-core>*/ … /*</ai-core>*/` region (index.html ~473–702) is not modified by this plan; it is only *called*. Impure code goes in a new block after `/*</ai-core>*/`.
- **The key never leaves the browser** except in the direct request to `api.anthropic.com`. Stored only in `localStorage`; shown masked.
- **Graceful degradation:** no key, network error, non-2xx, or an invalid structured reply must produce a readable toast and leave `S` + the thread untouched — never a broken screen or corrupt state.
- **One inline `<script>`:** all new code goes inside the existing single `<script>` (`tests/engine-syntax.test.js` asserts exactly one).
- **Verification norm (CLAUDE.md):** every task ends with a Playwright browser check — boot with `window` error capture (0 JS errors) and exercise the affected screen — plus `node --test` staying green (the added JS must still parse). Serve locally with `python3 -m http.server 8765`.
- **`git push` is gated** — commit here; the user pushes.
- **Reviewer handoff from Slice 1A (honor these):** `buildBundle` expects `ctx.memory.dossier` to be the single commander's record — pass `S.npcState[id].commanders[cmdrId]` (default `{standing:0,facts:[],goals:[],grudges:[]}`), NOT the whole `commanders` map. `buildBundle` surfaces only `standing`+`grudges` in the prompt (facts/goals are stored but intentionally not sent this slice). `worldScope` filters by planet-id keys that double as sector keys in the alpha galaxy — correct as-is.

## File Structure

- **Modify:** `index.html` only.
  - Add a marked `/* ---- AI engine (impure) ---- */` block after `/*</ai-core>*/` (line 702): persistence, settings, the AI-call bridge, `threadNPC`, `nowStamp`.
  - `init()` (line 1474): seed `S.npcState`/`S.time`, load+merge `localStorage`, add the ⚙ settings button.
  - `startThread()` (line 775): accept an optional `npcId`, store it as `t.npc`.
  - `openNPC()` (line 1683): pass `n.id` when opening the approach thread; add a dossier panel.
  - `threadView()` (line 1301): the "Prompt [NPC]" summon button (social) + stamp new posts; render `p.stamp`.
  - `rComms()` (line 1363): the "Prompt [NPC]" hail button in the active conversation.

### Shared names (locked so tasks agree)

```
localStorage keys:  'heretics_ai_key' · 'heretics_ai_model' · 'heretics_npc_state_v1'
saveNPC() loadNPC() seedNPCState()              // persistence + boot
aiKey() aiModel() openSettings()                // settings
threadNPC(t) aiPlace(t) nowStamp() summonNPC(t, npc, mode, done)   // AI bridge
```

---

### Task 1: Persistence + boot seeding

**Files:** Modify `index.html` — add the AI-engine block after `/*</ai-core>*/` (line 702); wire `init()` (line 1474, after the `S.active=…;S.cart=…;` guards at line 1485).

**Interfaces:**
- Produces: `saveNPC()`, `loadNPC()`, `seedNPCState()`; `S.npcState[id] = {behavior, recentJournal, longTermMemory, commanders, position, retired}` for every met NPC; `S.time = {epoch, blockMinutes}`, persisted to `localStorage`.

- [ ] **Step 1: Add the AI-engine block.** After line 702 (`/*</ai-core>*/`), insert:

```js
/* ---- AI engine (impure: localStorage, fetch, DOM — CALLS the pure NPCAI core) ---- */
var LS_NPC='heretics_npc_state_v1';
function saveNPC(){try{localStorage.setItem(LS_NPC,JSON.stringify({npcState:S.npcState,time:S.time}));}catch(e){}}
function loadNPC(){try{var r=localStorage.getItem(LS_NPC);return r?JSON.parse(r):null;}catch(e){return null;}}
function seedNPCState(){
  S.npcState=S.npcState||{};
  (D.npcs_alpha||[]).forEach(function(n){
    if(S.world.met.indexOf(n.id)<0||S.npcState[n.id])return;   // only met NPCs get a mind; never re-seed
    S.npcState[n.id]={
      behavior:NPCAI.instantiate(n.behavior_seed||{},function(){return 0;}),  // authored seeds ignore the roll
      recentJournal:[],longTermMemory:[],commanders:{},position:n.location,retired:false
    };
  });
}
```

- [ ] **Step 2: Wire `init()`.** Immediately after the `S.active=S.active||'kane';S.cart=S.cart||[];` line (1485), add:

```js
S.time=S.time||{epoch:Date.now(),blockMinutes:(D.time&&D.time.block_minutes)||60};
seedNPCState();
var _sv=loadNPC();
if(_sv){ if(_sv.time)S.time=_sv.time; if(_sv.npcState)Object.keys(_sv.npcState).forEach(function(k){S.npcState[k]=_sv.npcState[k];}); }
saveNPC();
```

- [ ] **Step 3: Parse gate.** Run: `node --test tests/engine-syntax.test.js`
Expected: PASS (the added JS parses; still one `<script>`).

- [ ] **Step 4: Browser verify.** Serve (`python3 -m http.server 8765`), open with Playwright MCP capturing `window` errors. In the console, evaluate:
```js
JSON.stringify({keys:Object.keys(S.npcState), vess:S.npcState.vess.behavior.ferocity.value, time:S.time.blockMinutes, ls:!!localStorage.getItem('heretics_npc_state_v1')})
```
Expected: `keys` lists all 5 NPC ids; `vess` ferocity is a number in range; `time` is 60; `ls` is `true`. Reload the page and re-check — `S.npcState` survives (loaded from `localStorage`). 0 JS errors.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "ai-engine: NPC-state + clock persistence (localStorage) + boot seeding"
```

---

### Task 2: Settings — API key + model

**Files:** Modify `index.html` — add to the AI-engine block; add the ⚙ button in `init()`.

**Interfaces:**
- Consumes: `E`, `T`, `esc`, `mkEntity`/`ENT`, `D.ai.model`.
- Produces: `aiKey()`, `aiModel()`, `openSettings()`; a fixed ⚙ button that opens the settings overlay; `localStorage` keys `heretics_ai_key`, `heretics_ai_model`.

- [ ] **Step 1: Add settings functions** to the AI-engine block:

```js
var LS_KEY='heretics_ai_key',LS_MODEL='heretics_ai_model';
function aiKey(){try{return localStorage.getItem(LS_KEY)||'';}catch(e){return '';}}
function aiModel(){try{return localStorage.getItem(LS_MODEL)||(D.ai&&D.ai.model)||'claude-sonnet-5';}catch(e){return (D.ai&&D.ai.model)||'claude-sonnet-5';}}
function openSettings(){mkEntity();
  var models=['claude-sonnet-5','claude-opus-4-8','claude-haiku-4-5'],cur=aiModel();
  ENT.innerHTML='<div class="entc"><div class="entb">'
   +'<div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>AI Settings</h3><button class="movbk" id="entx">Close</button></div>'
   +'<div class="entrow"><div class="k">Anthropic API key</div><div class="vv"><input id="aikey" type="password" style="width:100%" value="'+esc(aiKey())+'" placeholder="sk-ant-…"></div></div>'
   +'<div class="entrow"><div class="k">Model</div><div class="vv"><select id="aimodel">'+models.map(function(m){return '<option'+(m===cur?' selected':'')+'>'+m+'</option>';}).join('')+'</select></div></div>'
   +'<div style="font-size:11px;color:var(--dim)">Stored only in this browser and sent directly to Anthropic — it never leaves your machine except to the API. You pay for your own usage.</div>'
   +'<div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm" id="aisave">Save</button><button class="btn gh sm" id="aiclear">Clear key</button></div>'
   +'</div></div>';
  document.getElementById('entx').onclick=function(){ENT.classList.remove('on');};
  document.getElementById('aisave').onclick=function(){try{localStorage.setItem(LS_KEY,document.getElementById('aikey').value.trim());localStorage.setItem(LS_MODEL,document.getElementById('aimodel').value);}catch(e){}T('AI settings saved.');ENT.classList.remove('on');};
  document.getElementById('aiclear').onclick=function(){try{localStorage.removeItem(LS_KEY);}catch(e){}document.getElementById('aikey').value='';T('Key cleared.');};
  ENT.classList.add('on');
}
```

- [ ] **Step 2: Add the ⚙ button** at the end of `init()` (after the persistence block from Task 1):

```js
var _gear=E('button','btn gh sm','⚙ AI');_gear.style.cssText='position:fixed;right:12px;bottom:12px;z-index:60';_gear.onclick=openSettings;document.body.appendChild(_gear);
```

- [ ] **Step 3: Parse gate.** Run: `node --test tests/engine-syntax.test.js` → PASS.

- [ ] **Step 4: Browser verify.** Reload with Playwright. Confirm the ⚙ AI button is visible bottom-right; click it → the overlay opens; type a dummy key `sk-ant-test`, pick `claude-opus-4-8`, Save → toast "AI settings saved." Evaluate `aiKey()` → `"sk-ant-test"`, `aiModel()` → `"claude-opus-4-8"`. Click ⚙ again → Clear key → `aiKey()` returns `""`. 0 JS errors.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "ai-engine: AI settings overlay (key + model in localStorage)"
```

---

### Task 3: AI-call bridge — `threadNPC`, `aiPlace`, `nowStamp`, `summonNPC`

**Files:** Modify `index.html` — add to the AI-engine block; add the `npcId` param to `startThread()` (line 775) and pass `n.id` from `openNPC`'s approach button (line 1696).

**Interfaces:**
- Consumes: `NPCAI.buildBundle/validateReply/worldScope/stampAt`, `activeModel`, `fLoc`, `LT`, `T`, `aiKey`, `aiModel`, `seedNPCState`, `saveNPC`.
- Produces: `threadNPC(t) -> npc|null`; `aiPlace(t) -> {locName,phase,planetEffect}`; `nowStamp() -> 'Day N · Phase'|''`; `summonNPC(t, npc, mode, done)` where `done(obj, st, cmdrId)` runs only on a validated reply. `startThread(pid,l,type,npcId)` stores `t.npc=npcId||null`.

- [ ] **Step 1: Add the bridge functions** to the AI-engine block:

```js
function threadNPC(t){
  if(!t)return null;
  if(t.npc)return (D.npcs_alpha||[]).filter(function(n){return n.id===t.npc;})[0]||null;
  var hay=(t.initiator||'')+' '+((t.forces||[]).join(' '))+' '+((t.posts||[]).map(function(p){return p.who;}).join(' '));
  return (D.npcs_alpha||[]).filter(function(n){
    return S.world.met.indexOf(n.id)>=0 && (hay.indexOf(n.name)>=0 || hay.indexOf(n.name.split(' ')[0])>=0);
  })[0]||null;
}
function nowStamp(){if(!S.time)return '';var s=NPCAI.stampAt(S.time.epoch,Date.now(),S.time.blockMinutes);return 'Day '+s.day+' · '+s.phase;}
function aiPlace(t){
  var L=fLoc(S.pos.pl,S.pos.sp),lt=L&&L.type?LT(L.type):null,s=S.time?NPCAI.stampAt(S.time.epoch,Date.now(),S.time.blockMinutes):null;
  return {locName:(t&&t.loc)||(L?L.name:''),phase:s?s.phase:'',planetEffect:(lt&&lt.effect)||''};
}
function aiReplySchema(){return {type:'object',properties:{
  post:{type:'string'},
  combatPicks:{type:['array','null']},
  dossierDelta:{type:'object',properties:{
    newJournalEntry:{type:'string'},
    promoteToLongTerm:{type:['string','null']},
    commanderUpdates:{type:'object',properties:{standing:{type:'integer'},addFacts:{type:'array'},addGoals:{type:'array'},addGrudges:{type:'array'}}},
    axisShift:{type:['object','null']}
  },required:['newJournalEntry','commanderUpdates']}
},required:['post','dossierDelta']};}
function summonNPC(t,npc,mode,done){
  mode=mode||'social';
  var key=aiKey();
  if(!key){T('Add your Anthropic API key in ⚙ AI settings first.');return;}
  if(!S.npcState||!S.npcState[npc.id]){seedNPCState();}
  var st=S.npcState[npc.id];
  if(!st){T('No mind on record for '+npc.name.split(' ')[0]+'.');return;}
  if(st.retired){T(npc.name.split(' ')[0]+' is dead. No answer comes.');return;}
  var cmdr=activeModel(),cmdrId=cmdr.id,cmdrName=cmdr.n.split(',')[0];
  var horizon=(npc.persona&&npc.persona.knowledge_horizon)||{sectors:[]};
  var ctx={ai:D.ai,npc:npc,behavior:st.behavior,
    memory:{recentJournal:st.recentJournal,longTermMemory:st.longTermMemory,
            dossier:st.commanders[cmdrId]||{standing:0,facts:[],goals:[],grudges:[]}},
    thread:t,place:aiPlace(t),scoped:NPCAI.worldScope(S.world,horizon,npc.location),
    commanderName:cmdrName,mode:mode};
  var b=NPCAI.buildBundle(ctx);
  T(npc.name.split(' ')[0]+' considers…');
  fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{
    'content-type':'application/json','x-api-key':key,
    'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body:JSON.stringify({model:aiModel(),max_tokens:1024,system:b.system,
      messages:[{role:'user',content:b.user}],
      output_config:{format:{type:'json_schema',schema:aiReplySchema()}}})})
  .then(function(r){return r.json();})
  .then(function(j){
    if(j.error)throw new Error(j.error.message||'API error');
    var tb=(j.content||[]).filter(function(x){return x.type==='text';})[0];
    var obj;try{obj=JSON.parse((tb&&tb.text)||'');}catch(e){throw new Error('unparseable reply');}
    var v=NPCAI.validateReply(obj,mode);if(!v.ok)throw new Error(v.reason);
    done(obj,st,cmdrId);
  })
  .catch(function(e){T(npc.name.split(' ')[0]+' does not respond ('+e.message+').');});
}
```

- [ ] **Step 2: Thread the NPC id through `startThread`.** Change the signature (line 775) to `function startThread(pid,l,type,npcId){` and add `npc:npcId||null` to the pushed thread object (line 780 — inside the `S.threads.push({…})` literal, e.g. after `forces:fname?[fname]:[]`):

```js
 S.threads.push({id:id,type:type.toUpperCase(),n:type+' at '+l.name,loc:loc,turn:'you',vis:'public',initiator:'You ('+am.n.split(',')[0]+')',about:'You opened a '+type+' at '+l.name+'. '+(threadSummary(type.toUpperCase())),forces:fname?[fname]:[],npc:npcId||null});
```

- [ ] **Step 3: Pass `n.id` from the approach button** (line 1696) — change the `startThread(...)` call at the end of the `ap.onclick` handler to:
```js
startThread(S.pos.pl,fLoc(S.pos.pl,S.pos.sp),'Diplomacy',n.id)
```

- [ ] **Step 4: Parse gate.** Run: `node --test` (whole suite) → all PASS (added JS parses; nothing else changed).

- [ ] **Step 5: Browser verify (mocked fetch).** Reload with Playwright. Set a dummy key via `openSettings` (or `localStorage.setItem('heretics_ai_key','x')`). Override `fetch` to return a canned structured reply, then drive a summon through the console:
```js
window.fetch=function(){return Promise.resolve({json:function(){return Promise.resolve({content:[{type:'text',text:JSON.stringify({post:'The market never sleeps, client.',combatPicks:null,dossierDelta:{newJournalEntry:'Kane came asking.',promoteToLongTerm:null,commanderUpdates:{standing:-2,addFacts:[],addGoals:[],addGrudges:[]},axisShift:null}})}]});}});};
var t=S.threads.filter(function(x){return x.id==='bar';})[0];
summonNPC(t, threadNPC(t), 'social', function(obj,st,cmdrId){window.__ok={post:obj.post, standingBefore:(st.commanders[cmdrId]||{}).standing};});
```
After a tick, evaluate `JSON.stringify(window.__ok)` → the mocked post text is returned and `done` fired. Confirm `threadNPC(t)` resolved to the `vess` NPC (the `bar` thread's initiator). 0 JS errors.

- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "ai-engine: summon bridge (threadNPC, aiPlace, summonNPC) + t.npc link"
```

---

### Task 4: Summon in threads + in-game post stamping

**Files:** Modify `index.html` — `threadView()` (line 1301): post render (1310–1316), the two post pushes (add `stamp`), and the summon button.

**Interfaces:**
- Consumes: `threadNPC`, `summonNPC`, `nowStamp`, `NPCAI.applyDelta`, `saveNPC`, `openT`, `T`, `E`.
- Produces: a "Prompt [NPC] to respond" button in social threads that appends a bylined, stamped NPC post and writes the NPC's memory; every new post (player + NPC) carries a `stamp`, rendered in the post header.

- [ ] **Step 1: Render the stamp.** In the post-render loop (line 1313), change the `mono` span to include the stamp:
```js
      '<span class="mono" style="color:var(--dim)">'+(p.stamp?p.stamp+' · ':'')+'Post '+(i+1)+'</span></div><div class="body">'+p.body+'</div>'+
```

- [ ] **Step 2: Stamp new player posts.** In `threadView`'s `pb.onclick`, both `t.posts.push({who:activeModel().n.split(',')[0],body:v,tag:'you'…})` sites (the TRAVEL push at line 1327 and the main push at line 1349) gain `stamp:nowStamp()`. For line 1349:
```js
    t.posts.push({who:activeModel().n.split(',')[0],body:v,tag:'you',stamp:nowStamp(),block:staged.map(function(s){return {actor:s.actor,action:s.action,cost:s.cost,effect:s.effect};})});
```
and line 1327:
```js
      t.posts.push({who:activeModel().n.split(',')[0],body:v,tag:'you',stamp:nowStamp()});
```

- [ ] **Step 3: Add the summon button.** In `threadView`, immediately before the Exit button (line 1357, `var xb=E('button','btn gh','Exit thread');`), insert:
```js
  var _npc=threadNPC(t);
  if(_npc && !isCombat){   // combat summon is Plan B
    var _sm=E('button','btn','Prompt '+_npc.name.split(' ')[0]+' to respond');
    _sm.style.cssText='width:100%;margin-top:9px';
    _sm.onclick=function(){
      summonNPC(t,_npc,'social',function(obj,st,cmdrId){
        if(!t.posts)t.posts=[];
        t.posts.push({who:_npc.name,body:obj.post,tag:'',stamp:nowStamp()});
        NPCAI.applyDelta(st,cmdrId,obj.dossierDelta,Date.now(),{journalCap:12});
        saveNPC();
        openT(t.id);T(_npc.name.split(' ')[0]+' has spoken.');
      });
    };
    V.appendChild(_sm);
  }
```

- [ ] **Step 4: Parse gate.** Run: `node --test` → all PASS.

- [ ] **Step 5: Browser verify (mocked fetch).** Reload with Playwright; set a dummy key; override `window.fetch` with the canned reply from Task 3 Step 5. Navigate to Threads → open "The Carrion Bargain" (`bar`). Confirm a "Prompt Vess to respond" button renders below the composer. Click it → a new post appears bylined "Vess the Carrion-Broker", styled as `.en`, with the mocked text and a `Day N · <phase> ·` stamp. Evaluate `S.npcState.vess.commanders.kane.standing` → `-2` (memory written); `S.npcState.vess.recentJournal[0].text` → "Kane came asking."; and `localStorage.getItem('heretics_npc_state_v1')` contains it. Write a normal player post → it too carries a stamp. 0 JS errors.

- [ ] **Step 6: Commit**
```bash
git add index.html
git commit -m "ai-engine: thread summon button + in-game post stamping"
```

---

### Task 5: Dossier panel on the NPC overview

**Files:** Modify `index.html` — `openNPC()` (line 1683): insert a dossier block into `ENT.innerHTML`.

**Interfaces:**
- Consumes: `S.npcState`, `activeModel`, `esc`.
- Produces: the NPC overlay shows this NPC's standing toward the active commander, recent journal, and long-term memory (or a SLAIN note if retired).

- [ ] **Step 1: Build the dossier HTML.** In `openNPC`, after `var sig=…;` (line 1685) and before `ENT.innerHTML=…`, add:
```js
 var _st=S.npcState&&S.npcState[id],_cid=activeModel().id,_dz=_st&&_st.commanders[_cid];
 var _doss=_st?((_st.retired?'<div class="entrow"><div class="k">Status</div><div class="vv" style="color:var(--bad,#c66)">SLAIN — this mind is gone</div></div>':'')
   +'<div class="entrow"><div class="k">Standing toward you</div><div class="vv">'+((_dz&&_dz.standing!=null)?_dz.standing:0)+((_dz&&_dz.grudges&&_dz.grudges.length)?(' · grudges: '+esc(_dz.grudges.join(', '))):'')+'</div></div>'
   +((_st.recentJournal&&_st.recentJournal.length)?('<div class="entrow"><div class="k">Recent</div><div class="vv">'+_st.recentJournal.slice(0,3).map(function(x){return esc(x.text);}).join('<br>')+'</div></div>'):'')
   +((_st.longTermMemory&&_st.longTermMemory.length)?('<div class="entrow"><div class="k">Remembers</div><div class="vv">'+_st.longTermMemory.map(function(x){return esc(x.summary);}).join('<br>')+'</div></div>'):'')
 ):'';
```

- [ ] **Step 2: Insert it** into `ENT.innerHTML` — append `+_doss` right after the "Last located" row (line 1690, before the button-row line 1691):
```js
 +'<div class="entrow"><div class="k">Last located</div><div class="vv">'+n.location+'</div></div>'+_doss
```

- [ ] **Step 3: Parse gate.** Run: `node --test tests/engine-syntax.test.js` → PASS.

- [ ] **Step 4: Browser verify (mocked fetch).** Reload with Playwright; run the Task 4 summon on `bar` (mocked) so Vess's memory has content. Then open Vess's NPC sheet (Map → Vigilus → Carrion Market → Vess, or `openNPC('vess')` in the console). Confirm the overlay shows "Standing toward you: -2" and a "Recent" line with "Kane came asking." Open an un-summoned NPC (e.g. `openNPC('warden')`) → shows "Standing toward you: 0", no crash. 0 JS errors.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "ai-engine: NPC dossier panel (standing + journal + memory)"
```

---

### Task 6: Comms hailing summon

**Files:** Modify `index.html` — `rComms()` (line 1363): add a "Prompt [NPC]" button in the active conversation panel (near the send handler at line 1377).

**Interfaces:**
- Consumes: `summonNPC`, `activeModel`, `T`, `E`, `NPCAI.applyDelta`, `saveNPC`, `rComms`. Convo `id` equals the NPC id (`herald`/`kryv`/`vess`).
- Produces: for a conversation whose `id` matches a placed NPC, a "Prompt [NPC]" button that sends the conversation as a cold-hail bundle and appends the NPC's reply to `c.ms`.

- [ ] **Step 1: Add the hail button.** In `rComms`, locate the active-conversation block (the `var c=S.convos.filter(...)` at line 1370 and the send `b.onclick` at line 1377). Immediately after the send button is wired (after line 1377), add:
```js
  var _hn=(D.npcs_alpha||[]).filter(function(n){return n.id===c.id;})[0];
  if(_hn){
    var _hb=E('button','btn sm','Prompt '+_hn.name.split(' ')[0]);
    _hb.style.marginLeft='6px';
    _hb.onclick=function(){
      var cmdrName=activeModel().n.split(',')[0];
      var pseudo={about:'a remote hail across the void',npc:_hn.id,initiator:_hn.name,forces:[],
        posts:(c.ms||[]).map(function(m){return {who:m[0]==='me'?cmdrName:_hn.name,body:m[1]};})};
      summonNPC(pseudo,_hn,'social',function(obj,st,cmdrId){
        c.ms.push([_hn.id,obj.post]);
        NPCAI.applyDelta(st,cmdrId,obj.dossierDelta,Date.now(),{journalCap:12});
        saveNPC();rComms();T(_hn.name.split(' ')[0]+' answers the hail.');
      });
    };
    b.parentNode.appendChild(_hb);   // sit the hail button next to Send
  }
```
(`b` is the send button from line 1377; `b.parentNode` is its row. If the send button has no wrapping row, append `_hb` to the same container `b` was appended to — verify against the surrounding lines when implementing.)

- [ ] **Step 2: Render NPC-id senders.** The message render (line 1373) treats `m[0]==='me'` as YOU and everything else as `c.n`. An NPC-id sender (`'vess'`) is not `'me'`, so it already renders as `c.n` (the NPC name) — correct, no change needed. Confirm this while verifying.

- [ ] **Step 3: Parse gate.** Run: `node --test tests/engine-syntax.test.js` → PASS.

- [ ] **Step 4: Browser verify (mocked fetch).** Reload with Playwright; set a dummy key; override `window.fetch` with the Task 3 canned reply. Go to Comms; the reachable remote convos include Herald and Kryv. Select Herald → confirm a "Prompt Herald" button sits by Send. Click it → the mocked reply appears in the thread as a "HERALD"-labelled message. Evaluate `S.npcState.herald.recentJournal.length` → `>=1` and `localStorage` persisted. 0 JS errors.

- [ ] **Step 5: Commit**
```bash
git add index.html
git commit -m "ai-engine: Comms hailing summon"
```

---

## Self-Review (completed against the slice-1 spec + Slice-1A handoff)

- **Spec coverage.** F1 plumbing: settings/key/model (T2), browser-direct `fetch` + single structured call + graceful degradation (T3). Persistence the spec assumed but the engine lacked (T1). P1 talk: thread summon (T4) + Map entry already exists (openNPC) now with a dossier (T5) + Comms hailing (T6). F3 time: `nowStamp` + post stamping (T4), clock seeded/persisted (T1). **Deferred correctly:** combat summon / `combatPicks` / `stageBlock` / forces / infestation → Plan B (the summon button is gated `!isCombat`); the background world-tick + World Digest → Slice 2.
- **Slice-1A handoff honored.** `summonNPC` passes `st.commanders[cmdrId] || {standing:0,facts,goals,grudges}` as `ctx.memory.dossier` (T3) — the single record, not the map. facts/goals remain stored-not-surfaced per the reviewer's note.
- **Placeholder scan.** None — every step carries the actual code, exact anchors, and a concrete browser check with expected results.
- **Type consistency.** `S.npcState[id]` shape (`behavior/recentJournal/longTermMemory/commanders/position/retired`) is produced by `seedNPCState` (T1) and consumed by `summonNPC` (T3), the summon callback + `applyDelta` (T4), the dossier panel (T5), and hailing (T6) — identical field names. `done(obj, st, cmdrId)` signature is defined in T3 and used unchanged in T4/T6. Posts gain `stamp` (T4) consumed by the render (T4). `t.npc` written by `startThread`/approach (T3) read by `threadNPC` (T3).

## Verification note

This slice is impure (network/DOM/localStorage), so there are no new `node --test` unit tests — each task gates on `node --test` (the added JS must still parse; single `<script>` preserved) plus a **Playwright MCP browser check with a mocked `fetch`**, which exercises the real summon→post→memory→persist→render path without a live key or network. A final manual smoke with a real key (one summon in a thread) is recommended before the user pushes, to confirm the live Anthropic round-trip and structured-output parse.
