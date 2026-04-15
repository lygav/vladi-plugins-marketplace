---
type: wisdom
version: "0.5.0"
last_updated: 2025-04-15
---

# Team Wisdom: vladi-plugins-marketplace

## Architectural Principles

### Placement vs Communication (Key Separation)

**Placement** = WHERE files live (per-team, mix-and-match)
- `TeamPlacement` interface: workspace mgmt, file I/O, bootstrap
- Implementations: `DirectoryPlacement`, `WorktreePlacement`
- Each team can use different placement types
- Package.json at plugin root (not nested in scripts/)

**Communication** = HOW teams exchange signals (federation-scoped, single strategy)
- `TeamCommunication` interface: status, signals, learning log
- Implementations: `FileSignalCommunication`, `TeamsCommunication`
- All teams in a federation use same communication type
- Signal protocol: inbox/outbox JSON files with signal types (directive, question, report, alert)
- Teams channel hashtag protocol: #meta (federation), #meta-status (status), #{teamId} (team-specific)

### Adapter Registry Pattern

Extensible transport design:
- `PlacementRegistry` for placement implementations
- `CommunicationRegistry` for communication implementations
- Lookup by `archetypeId`: `placement.get(archetypeId)` returns concrete implementation
- Enables adding new transports without changing core

### Modular Library Structure

`scripts/lib/` contains 7 production modules:
1. **placement/** - Workspace/file management
2. **communication/** - Signal exchange & status
3. **registry/** - Team enumeration & lookup
4. **knowledge/** - Learning log management
5. **orchestration/** - Agent coordination
6. **config/** - Configuration management
7. **telemetry/** - OpenTelemetry wrapper

### TeamRegistry is Single Source of Truth

- `team-registry.ts` enumerates teams from placement
- `getTeams()` returns `TeamContext` objects with placement + communication adapters
- Contract: placement must have `getLocation(teamId)` to build team list
- This is how scripts discover which teams exist (not worktree-utils)

### Script Architecture

Scripts are thin CLI wrappers:
- `onboard.ts` - Team initialization
- `launch.ts` - Start agent operations
- `monitor.ts` - Health checks
- `sweep.ts` - Batch signal processing
- `graduate.ts` - Team transition
- `sync.ts` - Federation state sync

Each script instantiates registries, gets teams, calls lib functions.

## Conventions & Rules

### Signal Protocol

- **Types**: directive (request action), question (need answer), report (status update), alert (urgent)
- **Hashtag markers** in Teams: `#meta` (federation), `#meta-status` (status channel), `#{teamId}` (team-specific)
- Signals written to `.squad/inbox.json` and `.squad/outbox.json`

### Knowledge Management

**LearningEntry** types:
- `discovery`: New insight
- `correction`: Fix to previous understanding
- `pattern`: Reusable technique
- `technique`: How-to knowledge
- `gotcha`: Pitfall to avoid

Confidence levels: low, medium, high  
Domain field: 'generalizable' for cross-team learnings

### No Migrations, No Backward Compat

- Pre-1.0 versioning: breaking changes are OK
- Each new version can change SDK interfaces, schemas, file formats
- Teams re-initialize on version bump (bootstrap handles setup)

### Docs Live With Code

- Documentation updates in SAME PR as code changes (SDLC rule)
- Ground truth scan reveals what code actually does
- Never let docs drift from implementation
- If a PR changes behavior, config, or interfaces → docs update required
- Not a follow-up, not optional

### Interface Factories Must Be Universal

**Critical code review lesson:**
- When designing factory methods (e.g., `createPlacement(archetypeId)`)
- Params must be universal across ALL implementations
- Don't add adapter-specific params to factory signature
- Use TypeScript generics or separate factory methods for custom config

### Test Patterns

- `MockPlacement` and `MockCommunication` for unit tests
- Contract tests verify interface compliance
- Signal protocol: test that messages round-trip correctly
- Learning log: test append-only semantics

## Active Patterns to Preserve

- Zod schemas as source of truth (not TypeScript types)
- OTel emitter: no-op when not configured, best-effort export
- Abstract base classes for archetype-specific logic (MonitorBase, TriageBase, RecoveryBase)
- Team bootstrap: idempotent `.squad/` directory creation
- Signal acknowledgment: explicit `acknowledgeSignal()` method

## Anti-Patterns to Avoid

- Tight coupling between placement and communication
- Adding archetype-specific params to generic factory methods
- Documentation that doesn't match code reality
- Backward compatibility promises before v1.0

---

## New Session Learnings: v0.5.0 Docs Rewrite

### Docs Content Rules (CRITICAL for User-Facing Content)

All documentation (README, Astro site, SKILL.md, guides) must follow these rules:

1. **NO history references** — No "v0.4.0 introduced...", no "previously...", no evolution narrative. Describe current state ONLY.

2. **NO manual CLI as primary path** — Users interact with SKILLS conversationally, not by running scripts manually. Primary instructions should describe "tell the skill to..." flow, not "run npx tsx scripts/...".

3. **Describe conversational skill flow** — Show what the skill asks, what the user answers, what happens. Users don't see raw CLI.

4. **Scripts are reference/advanced only** — Shell commands and script documentation are for advanced users and reference section. Not the main instruction path.

5. **NO manual config editing** — Don't tell users to `cat`, `vim`, or manually edit JSON. Skills generate configs.

6. **Product name accuracy** — Verify archetype names, feature names, and product references against actual code. Wrong names confuse users.

7. **Base path on deployed sites** — GitHub Pages (Astro sites) require `site` + `base` in astro.config.mjs. CSS/JS loads from `/{base}/` not `/`. Test links in deployed environment.

### Model Choice for Docs Review

**Use claude-opus-4.6 for user-facing docs quality review** when content accuracy matters (wrong archetype names, broken links, stale references). Opus catches issues that Sonnet/Haiku miss. Cost is worth it for shipped documentation.

### sed is Dangerous for Structured Formats

Never use `sed` for YAML, JSON, or other structured files — one misplaced character breaks config. The `sed` corruption of deploy-docs.yml was avoidable. Use proper editors (edit tool) or rewrite the entire file block.

### GitHub Pages Astro Configuration

Astro sites on GitHub Pages require:
```javascript
// astro.config.mjs
export default defineConfig({
  site: 'https://username.github.io',
  base: '/repo-name/',  // CRITICAL: without base, CSS/JS loads from / not /repo-name/
  ...
})
```

Also add `workflow_dispatch` trigger to deploy workflow for manual deploys.

### Three-Pass Docs Review Pattern

Effective for catching and fixing doc issues:

1. **First pass (fast model, Haiku)** — Structure, completeness, missing sections
2. **Second pass (Opus)** — Content accuracy, rule violations, broken links, stale references
3. **Third pass (quick verification)** — Spot-check fixes, confirm changes applied

Each pass caught issues the previous missed.

### Parallel Docs Rewriting Strategy

Split large doc rewrites by section (guides, reference, archetypes, etc.) — different agents work on different sections in parallel. No file overlap → clean parallel work, batch commit at end. Effective for large rewrites.
### 2026-04-15T08:09Z: User directive — Docs content standards

**By:** Vladi Lyga (via Copilot)

**Rules for ALL documentation:**
1. NO history references. No "v0.4.0 introduced...", no "previously...", no evolution narrative. Current state ONLY.
2. NO manual script commands as primary instructions. Users interact with SKILLS conversationally — "tell the setup skill to...", not "run npx tsx scripts/onboard.ts --flags"
3. Describe the CONVERSATIONAL flow — what the skill asks, what the user answers, what happens
4. Scripts/CLI are ADVANCED/reference info, not the main path
5. Links must include base path (/vladi-plugins-marketplace/)

**Context:** The federation plugin works through Copilot skills that have conversations with users. The docs should reflect that UX, not a manual CLI tool experience.

---

## Session Learnings: v0.6.0 — Script-Drives-Skill Pattern

### Script-Drives-Skill Pattern (ADR-001)

**Critical architectural principle:** Scripts are deterministic functions. Skills are wrappers that extract params from natural language and call scripts.

**Rule:** If logic can be in the script, it MUST be in the script. Not in the skill, not in LLM heuristics.

**Why:**
- Scripts are testable (unit tests, fixtures, mocks)
- Skills are not testable (require LLM + conversation state)
- Error handling must be structured JSON, not LLM interpretation
- Non-interactive mode requires zero skill logic

**Current (wrong):**
```
skill orchestrates → calls script fragments → interprets output → decides next step
```

**Proposed (correct):**
```
script drives → emits structured prompts → skill provides input → script continues
```

**Pattern:** Script emits `{ type: "input_needed", prompt: "...", field: "teamId" }`. Skill extracts value from conversation and passes back. Script validates, continues.

**Approved but NOT executed.** Execution: #159 (onboarding) → #160 (setup) → #161 (audit all flows).

### Bootstrap Pattern for Plugin Dependencies

**Problem:** Copilot CLI doesn't run `npm install` when loading plugins. Skills that import SDK types crash if dependencies aren't installed.

**Solution:** `bootstrap.mjs` — plain Node.js script (no tsx), checks for node_modules, runs `npm ci` if missing. Skills call bootstrap BEFORE importing any script.

**Key:** bootstrap.mjs uses ONLY Node.js built-ins (fs, child_process, path). No external deps. Cross-platform (Windows, macOS, Linux).

**Applied:** All archetype skills now bootstrap before script imports.

### OTel Reads Config Mechanically

**Pattern:** `OTelEmitter` constructor reads `telemetry.endpoint` from `federate.config.json` in the plugin root. No environment variables needed.

**Why:** `process.env` doesn't cross process boundaries. Teams launch in separate processes. Config file is ground truth.

**Implementation:** Constructor takes `configPath`, reads JSON, initializes exporter if endpoint is set. No-op if missing (graceful degradation).

### Meta Always Summarizes

**Rule:** Meta always provides curated summaries, regardless of transport type.

**File-based:** User sees ONLY meta's curated view (console output). Raw signals stay in .squad/inbox.json.

**Teams-based:** User sees raw channel messages AND meta's periodic summaries in #meta channel.

**Why:** Meta is federation orchestrator. User doesn't need to read every team's raw output. Meta filters, distills, highlights what matters.

### Docs Content Standards (Reinforced)

**Critical for user-facing content:**
1. NO history — describe current state, not evolution
2. NO manual CLI as primary — users interact with skills conversationally
3. Describe the FLOW — what skill asks, what user answers, what happens
4. Scripts/CLI are ADVANCED/reference, not main path
5. Use opus (claude-opus-4.6) for content accuracy review

**Pattern:** Three-pass review (structure → content accuracy → verification). Opus catches what haiku misses (wrong names, stale references, broken links).

### Always Sync Main Before Branching

**Anti-pattern:** Creating feature branches from a stale local main. Leads to missing files, merge conflicts, and false "file doesn't exist" conclusions.

**Root cause (v0.6.0 session):** Local main was 20+ commits behind origin. TeamsChannelCommunication appeared missing but was actually merged — just not pulled locally. Wasted investigation time.

**Rule:** EVERY branch MUST start from fresh origin/main:
```bash
git fetch origin main && git checkout main && git pull origin main
# THEN branch
git checkout -b feature/my-change
```

**Enforcement:** All agents must run `git pull origin main` before any `git checkout -b`. No exceptions.

### sed Destroys Structured Formats

**Anti-pattern:** Using `sed` to modify YAML, JSON, or other structured files.

**Why:** One misplaced character breaks config. The `sed` corruption of `deploy-docs.yml` was avoidable.

**Solution:** Use proper editors (edit tool) or rewrite the entire file block. For programmatic changes, use language-specific parsers (js-yaml, JSON.parse).

**Rule:** NEVER use sed for structured formats. Only for plain text.
