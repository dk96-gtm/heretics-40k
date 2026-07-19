# Cloudflare AI Proxy — Design & Decomposition

> **Status:** design, approved 2026-07-20. Replaces the Stage-1 "bring-your-own-key,
> browser-direct" AI path with a **you-pay, capped** proxy in front of Anthropic.
> **Constraint:** the game still ships as two static files on GitHub Pages
> (`index.html` + `heretics-40k-data-v1.json`). The Worker is **separate infra**
> (deploys to Cloudflare, not Pages) — same category as `tests/`.

## Why

Today (`index.html:938`) the browser calls `api.anthropic.com` directly with the
player's own pasted key (`anthropic-dangerous-direct-browser-access: true`,
key in `localStorage`). Two problems this design fixes:

1. **Onboarding cliff** — a casual forum player will not create an Anthropic Console
   key. The paste-a-key wall kills adoption.
2. **Exposure** — every visitor is shipped the dangerous-direct-browser flag, and the
   request shape is fully open.

"Put an API key behind it" actually conflates two independent questions —
**where the key lives** (browser vs server) and **who pays** (player vs you). This design
answers *where* with a server-side proxy and *who* with "you, capped".

## Locked decisions

| Axis | Decision |
|------|----------|
| Cost model | **You pay**, bounded by a hard daily cap. |
| Cap strength | **Layered** — per-IP/day + a global/day kill-switch. |
| Cap defaults | **30 / IP / day**, **500 / global / day** (tunable consts). |
| Host | Fresh free **`*.workers.dev`** subdomain; free Cloudflare account. |
| BYO-key UI | **Deleted** — AI is always on, nothing to paste. |
| Guards | Origin allowlist + model allowlist + `max_tokens` ceiling. |
| Architecture | **Thin guard-and-forward.** All game/prompt logic stays in `index.html`. |

## Architecture

```
                       ┌──────────────────── Cloudflare Worker (heretics-ai) ────────────────────┐
 player summons NPC    │  ① CORS / origin   Origin ∈ ALLOWED_ORIGINS else 403                    │
   index.html          │  ② cap check       KV AI_CAPS: ip:<ip>:<date> ≤30 · global:<date> ≤500  │
   fetch POST ────────▶│  ③ validate        model ∈ allowlist (400) · max_tokens clamped ≤ ceil  │──▶ api.anthropic.com
   WORKER_URL/npc      │  ④ inject secret   ANTHROPIC_API_KEY (Worker secret — never in client)  │◀── JSON reply
   {model,max_tokens,  │  ⑤ forward + return upstream JSON (or typed error)                      │
    system,messages,   └─────────────────────────────────────────────────────────────────────────┘
    output_config}
```

The Worker is **dumb and generic**: it never builds prompts, never reads game state.
The frontend's `NPCAI.buildBundle` still constructs `system` + `messages`; the Worker
guards, signs, and forwards. This keeps all game logic in one place and lets the Worker
relocate into the Stage-2 backend unchanged.

## Component 1 — the Worker (`worker/`)

### Endpoint contract

`POST /npc` — request body is the **Anthropic Messages body minus auth**:

```json
{ "model": "...", "max_tokens": 2048, "system": "...",
  "messages": [ ... ], "output_config": { ... } }
```

Pipeline, in order (reject early, before any upstream call):

1. **CORS preflight.** Answer `OPTIONS` with the matched-origin CORS headers.
2. **Origin guard.** `Origin` (fallback `Referer`) must be in `ALLOWED_ORIGINS`
   = `['https://dk96-gtm.github.io', 'http://localhost:8765']`. Else `403 {error:'origin_not_allowed'}`.
3. **Shape guard.** `model ∈ MODEL_ALLOWLIST` (`claude-sonnet-5`, `claude-opus-4-8`,
   `claude-haiku-4-5`) else `400 {error:'model_not_allowed'}`. `max_tokens` clamped to
   `MAX_TOKENS ≤ 2048` (silently, not rejected). Prevents repurposing as a free general LLM.
4. **Cap check (KV `AI_CAPS`).**
   - IP from `CF-Connecting-IP`. Date = UTC `YYYY-MM-DD`.
   - Read `global:<date>`; if `≥ GLOBAL_CAP` → `429 {error:'global_cap', resting:true}`.
   - Read `ip:<ip>:<date>`; if `≥ IP_CAP` → `429 {error:'ip_cap', resting:true}`.
   - Otherwise **increment both** (with `expirationTtl` = seconds to next UTC midnight)
     and proceed. Count on accept (a downstream Anthropic error is not refunded — keep simple).
   - KV is eventually consistent: under a burst the cap may overshoot slightly. Acceptable
     for a hobby ceiling; Durable Objects would make it exact but is **YAGNI** here.
5. **Forward.** `POST api.anthropic.com/v1/messages` with `x-api-key: env.ANTHROPIC_API_KEY`,
   `anthropic-version: 2023-06-01`, body = the validated request. Return the upstream
   `Response` (status + JSON) verbatim, plus CORS headers.

### Error surface

| Status | Body | Frontend renders |
|--------|------|------------------|
| 403 | `{error:'origin_not_allowed'}` | generic "no response" |
| 400 | `{error:'model_not_allowed'}` | generic "no response" |
| 429 | `{error:'ip_cap', resting:true}` | "you've stirred the NPCs enough today" |
| 429 | `{error:'global_cap', resting:true}` | "the NPCs are resting" |
| 5xx | upstream Anthropic error passthrough | "does not respond (reason)" |

### Files

```
worker/
├─ src/index.js         fetch handler: CORS, guards, cap orchestration, forward
├─ src/caps.js          PURE: capDecision(counters, limits) → {allow, reason} — node-testable
├─ wrangler.toml        name, main, compatibility_date, KV binding AI_CAPS, vars (caps/allowlists)
├─ test/caps.test.js    node --test over caps.js (matches repo's zero-dep test style)
├─ .dev.vars.example    ANTHROPIC_API_KEY=  (real .dev.vars is gitignored)
└─ README.md            deploy runbook (below)
```

Tunables (`IP_CAP`, `GLOBAL_CAP`, `MAX_TOKENS`, `MODEL_ALLOWLIST`, `ALLOWED_ORIGINS`)
live in `wrangler.toml [vars]` so they change without editing code.

## Component 2 — frontend changes (`index.html`, 🔥 engine lane)

Small and surgical. Re-locate by function name at implementation time (line numbers below
are v18 snapshots and will drift):

1. **New const** near the AI helpers: `var WORKER_URL='https://heretics-ai.<sub>.workers.dev/npc';`
   (placeholder until the Worker is deployed and the real subdomain is known).
2. **`summonNPC` (≈921)** — repoint the `fetch`:
   - URL → `WORKER_URL`.
   - headers → only `content-type: application/json` (drop `x-api-key`, `anthropic-version`,
     `anthropic-dangerous-direct-browser-access`).
   - body unchanged.
   - Replace the `key` gate (≈923–924) — no key needed. In `.then`, branch on
     `r.status===429` → read `resting` and show the ip/global message; otherwise the existing
     `j.error` / parse / `validateReply` path is unchanged.
3. **Delete BYO-key UI.** In `openSettings` (≈884): remove the "Anthropic API key" `entrow`,
   the "stored only in this browser…" note, the Save/Clear-key buttons' key handling. Keep the
   **Model** selector (frontend still sends `model`; Worker allowlists it). Replace the note
   with "AI powered by the game — nothing to set up." Remove `aiKey()` (≈882) and its `LS_KEY`
   usage; keep `aiModel()`/`LS_MODEL`.
4. Both summon call sites (thread ≈1819, hail ≈1863) route through `summonNPC` — **no changes
   there**; the single choke point is `summonNPC`'s fetch.

## Data flow

```
summon → POST WORKER_URL {model,max_tokens,system,messages,output_config}
   └─ Worker: origin ✓ → cap ✓ → clamp → inject key → api.anthropic.com
        ├─ 200 → JSON reply → validateReply → done() renders NPC post + writes memory
        └─ 429 resting → frontend shows "NPCs resting", no state change
```

## Testing

| Layer | How |
|-------|-----|
| Cap logic | `caps.js` is pure → `node --test worker/test/caps.test.js`: under/at/over each limit, ip vs global precedence. |
| Worker integration | `wrangler dev` + curl: allowed origin 200, bad origin 403, bad model 400, over-ip 429, over-global 429. |
| Frontend | Existing Playwright mocked-`fetch` flow **repointed to `WORKER_URL`**: canned 200 → post renders + memory writes + 0 console errors; a mocked 429 → "resting" message, no state change. |
| Parse gate | `node --test` (existing `tests/engine-syntax.test.js`) stays green after the `index.html` edit. |

## Deploy runbook (`worker/README.md`)

1. Create a free Cloudflare account.
2. `cd worker && npx wrangler kv namespace create AI_CAPS` → paste the id into `wrangler.toml`.
3. `npx wrangler secret put ANTHROPIC_API_KEY` (paste the real key — never committed).
4. `npx wrangler deploy` → note the `https://heretics-ai.<sub>.workers.dev` URL.
5. Set `WORKER_URL` in `index.html` to `<that URL>/npc`.
6. Commit (engine lane) → **Daak pushes** (push is gated).

## Cost note

Worst case = **500 calls/day**, a fixed known ceiling on the account. Each summon is
system + lore scope + a bounded reply (`max_tokens ≤ 2048`). Future lever, no code change
now: **prompt caching** on the largely-static `system`/lore block trims repeat-call cost.

## Coordination / backlog impact

- **This spec = docs lane, parallel-safe** — written with zero board contention.
- Implementation splits across lanes:
  - `worker/**` = a **new, parallel-safe lane** (never touches `index.html`/canon).
  - The `index.html` edits (component 2) = **🔥 engine lane** — must claim the hot lane and
    serialize behind any in-progress engine task (e.g. T-FD1).
- **Add a board row** (proposed `T-AI-1`): _"Cloudflare AI proxy — you-pay capped Worker +
  frontend repoint, retire BYO-key."_ Lane: `worker + 🔥 engine + tests`. The Worker + cap
  tests can land first (parallel); the `index.html` repoint claims the hot lane last and briefly.

## Out of scope (YAGNI now)

- Per-account quotas / auth (arrives with the Stage-2 backend; the Worker relocates there).
- Durable-Object exact counters (KV overshoot is acceptable at hobby scale).
- Custom domain (a `*.workers.dev` subdomain is enough).
- The hybrid "paste your own key to go unlimited" fallback (explicitly rejected — you pay).
