# The Heretics 40K Compendium — PDF Design Spec

**Date:** 2026-07-19
**Goal:** A single, comprehensive, shareable PDF documenting the entire game — intro, all
models, weapons, items, abilities, casts, and every system — for a **new player /
collaborator** audience (intro-forward, plain-language, explains the *why*).

## Decisions (locked via clarifying Qs)

| Axis | Decision |
|---|---|
| Content scope | **Repo canon + backfill full Notion catalogs** (the un-migrated sheets) |
| Audience | New player / collaborator |
| Format | **One single PDF** (rulebook + codex) |
| Styling | **Clean & styled** — custom CSS, cover page, dividers, styled stat tables, dark-tactical accents |
| Tooling | Markdown → `md-to-pdf` (bundles Chromium; per global pdf-conversion rule) |

## Sourcing rule (the reconciliation)

Every section is built **repo-canon-first** (the deployed source of truth:
`heretics-40k-data-v1.json` v1.6), then **backfilled from the Notion archive** for the
full catalogs. Anything that exists **only in Notion / not yet in the deployed engine**
is visually flagged (e.g. a `◈ DESIGN — not yet in engine` marker) so a reader can tell
what is *playable now* vs. *designed-but-parked*. This makes the PDF double as an
assimilation audit.

## Structure

- **Part I — Welcome / Intro:** what the game is, the fantasy, how a thread/turn feels, glossary.
- **Part II — Core Rules:** allegiances & currencies (Currency/Dominance/Influence), ranks &
  growth curves, Action Points, combat arc, the six Elements, unit types, model evolution, death & succession.
- **Part III — The Models (codex):** all 20 factions with backgrounds/appearances/perks;
  full model rosters (repo alpha + Notion ~100); commanders; named/legendary; squads & forces.
- **Part IV — The Armoury:** weapons (basic + named), items (basic + named/legendary),
  abilities, warp casts, the tag registry.
- **Part V — The Galaxy:** map structure, planet types (20+), location types, doors (11),
  conditions, population ranks, status readings.
- **Part VI — Systems in Motion:** threads (every type), travel & passage cost, requisition/doors,
  comms, scores/flywheel, NPCs & the AI layer.
- **Part VII — Appendices:** constants tables, version history (data v1.0→v1.6, engine v6→v16).

## Notion source pages (archive, read-only)

- Models: `16f0ced7f13e809abecbfd18cf8fadaf` · Commander: `1700ced7f13e80f9a1d1e3ba20b39f5d`
  · Legendary/Named: `1700ced7f13e80fcbfded25a4c273ebb`
- Basic Weapons: `1700ced7f13e80d0b444e41e3faa7685` · Named Weapons: `18f0ced7f13e80ddbd92cfbd731106b5`
- Basic Items: `1700ced7f13e8017a3f7c13382ecf6e9` · Named/Legendary Items: `39d0ced7f13e813eb761d340a2167b24`
- Abilities: `1700ced7f13e80d294f9d1515d213026` · Tags: `19c0ced7f13e80d193f6c4b4f576473c`
- Galaxy & Territory: `39e0ced7f13e817f9072c4f5bdad2746` · Experience & UI: `39e0ced7f13e811a8eeaee0735de293e`
- Warp Casting: (locate under hub)

## Build approach

1. Extract repo canon (JSON) into structured content — the backbone.
2. Fan out parallel subagents to pull each Notion catalog into clean markdown.
3. Assemble one master markdown, apply the styled CSS (cover + dividers + tables).
4. `md-to-pdf` → deliver. Verify page count + spot-check content.

## Out of scope (flag, don't do)

- Migrating the Notion catalogs *into the JSON canon* (separate Stage-2-adjacent task).
- Filling art placeholders.
