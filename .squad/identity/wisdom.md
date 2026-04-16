---
type: wisdom
version: "0.8.0"
last_updated: 2026-04-16
---

# Team Wisdom: vladi-plugins-marketplace

## Architecture

### Placement vs Communication
- **Placement** (per-team): WHERE files live. `TeamPlacement` interface. Implementations: `WorktreePlacement`, `DirectoryPlacement`.
- **Communication** (federation-scoped): HOW teams exchange signals. Always file-signal. `TeamCommunication` interface via `FileSignalCommunication`.
- **Teams Presence**: persistent bridge via Graph API (polling) + ACP (execution). NOT an inter-team transport.
- Adapter registry allows future transports without changing core.

### ADR-001: Script-Drives-Skill
- Scripts own ALL logic. Skills are thin conversational wrappers.
- Scripts support `--non-interactive --output-format json --dry-run`.
- Skills collect user input, call scripts, present JSON results.
- **Why:** Scripts are testable. Skills are not.

### SDK-Based Casting
- `squad init --no-workflows` scaffolds `.squad/` (Squad owns its plumbing).
- `CastingEngine.castTeam()` assigns character names from universes.
- `onboardAgent()` writes charters + history with project context.
- Archetypes define `defaultTeam` roles in `archetype.json`.

### Single Federation Agent
- One `federation.agent.md` routes to skills. No separate onboard/sweeper agents.
- Agent is a router/dispatcher, not a worker.

### Meta-Squad Delegation Model
- Meta-squad is leadership — governs, delegates, sets standards, gives feedback.
- NEVER does domain work. Routes work requests to domain teams via launch + directives.
- Casting framing (not manual charter editing) ensures delegation in agent charters.

### Three-Layer Architecture
- **Core** (squad-federation-core): placement, signals, knowledge, launch, OTel. Archetype-unaware.
- **Archetype** (squad-archetype-*): work pattern, state machine, playbook. Each has distinct `defaultTeam`.
- **Project**: domain playbook skills, schemas, import hooks.

### Teams Presence
- `teams-presence.ts` is persistent Teams bridge. Modular: `lib/teams-presence/` (acp-session, graph-client, watermark, poll).
- **Graph API** = eyes & mouth (poll messages, post replies). Token from `az account get-access-token`.
- **ACP** = brain (persistent Copilot session via `copilot --acp`). Methods: initialize, session/new, session/load, session/list, session/prompt. Notifications via session/update.
- **Watermark** in `.squad/teams-watermark.json` prevents replay. First run = now.
- `federationName` in config — users address meta-squad by name (@artemis).
- `copilotCommand` in config — custom copilot launch command (no env vars, no os-specific detection).
- ACP protocol spec: https://github.com/agentclientprotocol/agent-client-protocol

### OTel
- `OTelEmitter` reads endpoint from: param → env var → `federate.config.json` → null (no-op).
- During setup, pass endpoint directly (config doesn't exist yet).
- **Timestamps**: `BigInt(Date.now()) * 1_000_000n` for OTLP epoch nanos. `process.hrtime.bigint()` is process-relative, NOT epoch.
- **Resource**: include `squad.federation` attribute for meta-squad identification.
- MCP OTel server for skill-layer tools (`otel_span`, `otel_event`).

## SDLC Rules

### Every PR Must Have
1. **Tests** — update/add for changed behavior. Full suite green before push.
2. **Docs** — update Starlight site for user-visible changes. Skills ≠ docs.
3. **Typecheck** — `tsc --noEmit` must pass.

### Git Hygiene
- **Always sync main before branching:** `git fetch origin main && git pull origin main` then branch.
- **Always work in the correct repo:** Code in `/Users/vladilyga/devel/squadai/vladi-plugins-marketplace`. Squad state in `plugin_developer/`. Never commit marketplace code from `plugin_developer/`.
- **No history in code comments.** Git blame handles provenance.

### Content Standards
1. NO history — current state only
2. NO manual CLI as primary path — describe conversational skill flow
3. Scripts/CLI are reference/advanced only
4. Use Opus for critical reviews (catches what Haiku misses)
5. **No internal references** — never mention specific corporate wrappers, internal tools, or employer names in code/docs/comments. Keep copilotCommand generic.

## Patterns

### Bootstrap
- `bootstrap.mjs`: plain Node.js, runs with `node`, auto-installs deps if `node_modules` missing.
- All skills call bootstrap before any script.

### Team Lifecycle
- Onboard → active → (pause ↔ resume) → retire
- `offboard.ts --mode retire`: graduate learnings → archive signals → remove worktree
- Launch guards skip non-active teams.

### Registry
- `setup.ts` must write `{ version: '1.0', teams: [] }` — omitting version causes Zod validation failure.
- Zod error formatting: include `e.path.join('.')` so field names are visible.

## Anti-Patterns
- Tight coupling between placement and communication
- Manual scaffold of Squad-owned files — use `squad init`
- `sed` for structured formats — use edit tool or parsers
- Spawning agents in wrong repo clone
- Branching from stale local main
- PRs without tests or docs
- OS-specific commands (ps, etc.) — use cross-platform alternatives
- Env vars for config that belongs in federate.config.json
