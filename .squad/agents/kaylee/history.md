---
agent: kaylee
role: Developer, Implementation
model: claude-sonnet-4.5
updated: 2025-04-15
---

# kaylee's History

## Role & Responsibilities
- SDK implementation and type safety
- Library module development
- Feature implementation in scripts
- Test coverage

## SDK Interfaces

### Core Types
- **TeamPlacement** — Workspace mgmt: exists, read, write, delete, list, bootstrap
- **TeamCommunication** — Status, signals (inbox/outbox), learning log (append-only JSONL)
- **TeamContext** — Domain info + placement & communication adapters
- **SignalMessage** — Type (directive/question/report/alert), protocol, routing
- **LearningEntry** — Type (discovery/correction/pattern/technique/gotcha), confidence, tags

### Lib Modules (scripts/lib/)
1. **placement/** — DirectoryPlacement, WorktreePlacement
2. **communication/** — FileSignalCommunication, TeamsCommunication
3. **registry/** — PlacementRegistry, CommunicationRegistry, TeamRegistry
4. **knowledge/** — LearningLog (append-only)
5. **orchestration/** — Agent coordination
6. **config/** — FederateConfig (Zod schemas)
7. **telemetry/** — OTelEmitter (no-op when not configured)

## Implementation Patterns

### Placement Contract
All implementations provide: exists, read, write, delete, list, bootstrap (idempotent)

### Signal Protocol
- JSON arrays in `.squad/inbox.json` and `.squad/outbox.json`
- Each signal: id, timestamp, from, to, type, subject, body, protocol
- Acknowledgment: explicit `acknowledgeSignal()` call

### Learning Log
- JSONL format in `.squad/learning.jsonl`
- Append-only, never overwrite
- Each entry: id, ts, version, type, agent, tags, title, body, confidence

## Model Preference
**Use:** claude-sonnet-4.5 (streaming, fast iteration)  
**Avoid:** codex models (too slow)

## SDLC Rules
1. **Docs in same PR** — if implementing feature, update docs
2. **Zod over TypeScript** — schemas are source of truth
3. **Idempotent bootstrap** — running twice is safe
4. **Contract tests** — verify interface compliance

## Docs Writing Lessons (v0.5.0 Session)

**Finding:** Docs must describe the conversational skill flow, not manual CLI. Users interact with Copilot skills, not shell scripts directly.

**Astro Site Lessons:**
- Starlight Obsidian theme: simple, clean, matches brand
- Config: `site` + `base` both required for GitHub Pages (CSS/JS load from `/{base}/` not `/`)
- Deploy workflow: add `workflow_dispatch` trigger for manual deployments

**Content Rules:** NO history references, NO manual editing instructions, NO script commands as primary path. Describe "you tell the skill to..." flow. Scripts are advanced/reference only.

**Pattern:** Parallel docs rewriting (split by section) with different agents = clean, fast, batch commit at end.

## Session Learnings — 2026-04-15

### Package Boundary & Layering
- **Fix:** Move `package.json` to plugin root (not sdk/scripts). Preserves layering: `sdk` → `lib` → `scripts`.
- Modular `lib/` structure: 7 modules (placement, communication, registry, knowledge, orchestration, archetypes, config). Files that change together live together.

### Adapter Registry Pattern
- **Key:** Communication factory takes adapter-specific config, NOT TeamPlacement. Each adapter gets what it needs.
- **TeamsChannelCommunication:** Inject TeamsClient for testability. Hashtag protocol for addressing.

### Model Guidance
- **Use:** `claude-sonnet-4.5` for implementation (streaming, focused execution).
- **Avoid:** gpt-5.2-codex (wandered on broad tasks: 20+ min, 400+ tool calls).

### Runtime Gotchas
- `git worktree add` inherits all tracked files → must `rm -rf .squad/` before scaffolding.
- Archetype paths resolve from plugin install dir, not CWD.
- ESM imports across package boundaries fail even with correct paths—it's the boundary violation, not the path syntax.

### Docs Refinement (Astro Starlight)
- GitHub Pages: `site` + `base` required (CSS/JS load from `/{base}/`).
- starlight-theme-obsidian for clean styling.
- Describe skill flows (conversational), not manual CLI commands.

## Session Summary — 2026-04-15 (v0.6.0)

**v0.4.0-v0.6.0 Implementation:**
- v0.4.0: Transport/placement separation, adapter registry, 7-module lib/ structure
- v0.5.0: TeamsCommunication with hashtag protocol (#meta, #meta-status, #{teamId})
- v0.6.0: Bootstrap.mjs (cross-platform, auto-installs deps), OTel config reader, ProgressReporter, meta relay loop

**Bootstrap Pattern:**
- Copilot CLI doesn't run npm install. Solution: bootstrap.mjs (plain Node.js, no tsx) called by skills before imports.
- Checks for node_modules, runs `npm ci` if missing. Cross-platform (Windows, macOS, Linux).
- All archetype skills now bootstrap before script imports.

**ProgressReporter Utility:**
- Dual-channel progress: OTel spans + signal messages
- Pattern: `reporter.start()` → `reporter.update(pct, msg)` → `reporter.complete()`
- Used in federation-setup, team-onboarding, archetype skills

**Model preference reinforced:**
- Sonnet (claude-sonnet-4.5) is correct model. Fast, focused, streaming.
- Codex models too slow for this workload (400+ tool calls, 20+ minutes on broad tasks).

**OTel reads config mechanically:**
- OTelEmitter reads `telemetry.endpoint` from federate.config.json in constructor
- No env vars needed. Config file is ground truth.

