---
agent: kaylee
role: Developer, Implementation
model: claude-sonnet-4.5
updated: 2025-07-14
---

# kaylee — History

## Core Knowledge

### Bootstrap Pattern
- bootstrap.mjs (plain Node.js, no tsx) called by skills before imports.
- Checks for node_modules, runs `npm ci` if missing. Cross-platform.
- All archetype skills bootstrap before script imports.

### OTel
- OTelEmitter reads `telemetry.endpoint` from federate.config.json in constructor.
- No env vars needed. Config file is ground truth. No-op when unconfigured.

### SDK Casting Pattern
- Zod schemas are source of truth; TypeScript types derived from them.
- Communication factory takes adapter-specific config, NOT TeamPlacement.

### Lib Modules (scripts/lib/)
1. **placement/** — DirectoryPlacement, WorktreePlacement
2. **communication/** — FileSignalCommunication
3. **registry/** — PlacementRegistry, CommunicationRegistry, TeamRegistry
4. **knowledge/** — LearningLog (append-only JSONL)
5. **orchestration/** — Agent coordination
6. **config/** — FederateConfig (Zod schemas)
7. **telemetry/** — OTelEmitter
8. **teams-presence/** — Graph API presence layer (v0.8.0)

### teams-presence Architecture (v0.8.0)
- `lib/teams-presence/graph-client.ts` — Thin Graph API wrapper (presence, status messages)
- `lib/teams-presence/presence-manager.ts` — Maps agent lifecycle → Teams presence states
- `lib/teams-presence/status-publisher.ts` — Periodic status push with backoff
- Pattern: presence-manager owns state machine; status-publisher owns the timer.

## Runtime Gotchas
- `git worktree add` inherits tracked files → must `rm -rf .squad/` before scaffolding.
- Archetype paths resolve from plugin install dir, not CWD.
- ESM imports across package boundaries fail — it's the boundary violation, not path syntax.

## Model Preference
**Use:** claude-sonnet-4.5 (streaming, fast iteration). **Avoid:** codex models (too slow).

