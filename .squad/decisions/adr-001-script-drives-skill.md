# ADR-001: Script-Drives-Skill Inversion

**Date:** 2025-07-22
**Status:** Proposed
**Author:** Mal (Lead)
**Requested by:** Vladi Lyga

---

## 1. The Problem

I've read every line of the onboarding flow — both sides. Here's what I found.

### Current Architecture: Skill-Drives-Script

```
User says: "onboard a team for auth"
       │
       ▼
┌─────────────────────────────────┐
│  team-onboarding SKILL (322 ln) │  ◄── LLM interprets these instructions
│                                  │
│  Step 1: Ask mission            │  ◄── Conversational
│  Step 2: Derive team name       │  ◄── Conversational  
│  Step 3: Discover archetype     │  ◄── DECISION LOGIC (duplicated)
│  Step 4: Select placement       │  ◄── DECISION LOGIC (duplicated)
│  Step 5: Confirm summary        │  ◄── Conversational
│  Step 6: Call onboard.ts        │  ◄── Just passes params
│  Step 7: Run archetype setup    │  ◄── Conversational
│  Step 8: Suggest next steps     │  ◄── Output formatting
│                                  │
└──────────┬──────────────────────┘
           │ CLI args
           ▼
┌─────────────────────────────────┐
│  onboard.ts SCRIPT (593 ln)     │  ◄── Deterministic execution
│                                  │
│  Parse args                     │
│  Validate (placement, archetype)│  ◄── DUPLICATES skill Step 3-4 validation
│  Create workspace               │
│  Seed team directory            │
│  Scaffold federation state      │
│  Run squad init                 │
│  Register in TeamRegistry       │
│  Git commit                     │
│  Output results                 │
└─────────────────────────────────┘
```

### What I found in the code — the duplication map

| Concern | In Skill? | In Script? | Notes |
|---------|-----------|------------|-------|
| Mission collection | ✅ Step 1 | ❌ (takes via `--description`) | Skill-only. Good. |
| Team name derivation | ✅ Step 2 | ❌ (takes via `--name`) | Skill-only. Good. |
| Archetype validation | ✅ Step 3 (regex, install check) | ✅ `ARCHETYPE_NAME_REGEX` test | **DUPLICATED** |
| Placement validation | ✅ Step 4 (worktree/directory) | ✅ `parseArgs` switch + validation | **DUPLICATED** |
| Worktree dir logic | ✅ Step 4 (inside/sibling) | ✅ `--worktree-dir` handling | **DUPLICATED** |
| Directory path logic | ✅ Step 4 (default `.teams/NAME`) | ✅ `--path` requirement check | **DUPLICATED** |
| Archetype install | ✅ Step 3 (`copilot plugin install`) | ❌ (assumes installed) | Skill-only gap |
| Branch conflict check | ❌ | ✅ `git rev-parse --verify` | Script-only. Good. |
| Workspace creation | ❌ | ✅ `createTeamWorkspace()` | Script-only. Good. |
| Team seeding | ❌ | ✅ `seedTeamDirectory()` | Script-only. Good. |
| Federation scaffold | ❌ | ✅ `scaffoldFederation()` | Script-only. Good. |
| OTel emission | ✅ (tool calls) | ✅ `OTelEmitter` | **DUPLICATED** |
| Error recovery | ✅ (interprets errors) | ✅ (structured error messages) | **DUPLICATED** |

**Key finding:** The script already has structured error messages with recovery instructions. It validates everything the skill validates. The skill adds ~150 lines of duplicated decision logic that the script also enforces.

### The real cost of the current model

1. **The skill is a 322-line LLM prompt.** Every time it runs, the LLM interprets it non-deterministically. Step 3 alone has a decision tree (ask Q1 → if coding → ask Q2 → recommend archetype) that the LLM may follow differently each time.

2. **The skill can't be tested.** It's a markdown file. You can't write `expect(skill.step3("produces reports")).toBe("deliverable")`. The only way to test it is to run it through the LLM and check outputs — which is expensive, slow, and flaky.

3. **The onboard.ts script ALREADY validates everything.** If you pass bad args, it gives you structured errors with recovery instructions. The skill's validation is redundant.

4. **The skill blocks automation.** Issue #155 — you can't call the onboarding flow from CI because it requires interactive conversation.

---

## 2. The Proposed Architecture: Script-Drives-Skill

```
User says: "onboard a team for auth"
       │
       ▼
┌─────────────────────────────────────┐
│  team-onboarding SKILL (~60 lines)  │  ◄── THIN WRAPPER
│                                      │
│  1. Extract params from user input   │
│     name: "auth"                     │
│     mission: "authentication service"│
│     archetype: "coding"              │
│     placement: "worktree"            │
│                                      │
│  2. Call script:                     │
│     onboard.ts --name auth           │
│       --mission "auth service"       │
│       --archetype squad-archetype-   │
│         coding --placement worktree  │
│                                      │
│  3. If script succeeds → report      │
│  4. If script fails → read error,    │
│     ask user, retry with fix         │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│  onboard.ts (enhanced, ~650 lines)  │
│                                      │
│  ALL LOGIC LIVES HERE:               │
│  - Arg validation                    │
│  - Archetype discovery + install     │
│  - Placement resolution              │
│  - Workspace creation                │
│  - Seeding, scaffolding              │
│  - OTel (already there)              │
│  - Structured JSON output            │
│  - Structured JSON errors            │
│                                      │
│  NEW: --discover-archetypes          │
│  NEW: --dry-run (validate only)      │
│  NEW: --output-format json           │
└─────────────────────────────────────┘
```

### The interface between script and skill

**Recommendation: CLI args + structured JSON output. No file-based IPC.**

Here's why each option doesn't work, and why CLI is right:

| IPC Option | Verdict | Why |
|------------|---------|-----|
| **File-based IPC** (write question, wait for answer) | ❌ Over-engineered | Requires polling, cleanup, race conditions. We're not building a message queue. |
| **Stdin/stdout** | ❌ Wrong model | The skill isn't a process. It's an LLM interpreting a prompt. There's no stdin to read from. |
| **Environment/args** | ✅ **This one** | Script takes everything via CLI args. Missing param? Structured error. Skill reads error, asks user, retries. |
| **Config file** | ⚠️ Partial | Good for complex configs, but adds a file to manage. CLI args are simpler for our param count. |

**The contract:**

```typescript
// Script output on success (stdout as JSON when --output-format json):
{
  "status": "success",
  "team": {
    "name": "auth",
    "location": ".worktrees/auth",
    "branch": "squad/auth",
    "archetype": "squad-archetype-coding"
  }
}

// Script output on failure (stderr as JSON):
{
  "status": "error", 
  "code": "MISSING_PARAM",
  "param": "archetype",
  "message": "Archetype is required",
  "available": ["squad-archetype-deliverable", "squad-archetype-coding", "squad-archetype-research"],
  "recovery": "Pass --archetype <name> or run with --discover-archetypes to see options"
}

// Script output for branch conflict:
{
  "status": "error",
  "code": "BRANCH_EXISTS",
  "branch": "squad/auth",
  "message": "Branch 'squad/auth' already exists",
  "recovery": "Use --name <different-name> or remove existing branch"
}
```

**The skill's new flow (pseudo-code):**

```
1. User says "onboard a team for auth"
2. Skill extracts: { name: "auth", mission: "authentication" }
3. Skill calls: onboard.ts --name auth --mission "authentication" --output-format json
4. Script returns: { error: "MISSING_PARAM", param: "archetype", available: [...] }
5. Skill asks user: "What kind of team? Options: deliverable, coding, research, task"
6. User says: "coding"
7. Skill calls: onboard.ts --name auth --mission "auth" --archetype squad-archetype-coding --output-format json
8. Script returns: { status: "success", team: { ... } }
9. Skill reports: "✅ Team 'auth' onboarded at .worktrees/auth on branch squad/auth"
```

**This is the error-retry loop pattern.** The script drives. The skill provides missing inputs on demand.

---

## 3. Impact on Each Existing Flow

### Federation Setup (federation-setup SKILL → no script today)

**Current:** The skill IS the entire flow — prereq checks, question-asking, config generation, meta-squad casting, first-team onboarding. There's no `setup.ts` script.

**Proposed:** Create `setup.ts` that:
- Checks prerequisites (git, node, squad, docker) → outputs structured results
- Validates existing config → outputs conflicts
- Generates `federate.config.json` from params
- Starts dashboard if telemetry enabled

**Skill becomes:** "What are you building?" → extract description. "Want telemetry?" → yes/no. "Communication type?" → file-signal/teams. Pass all three to `setup.ts --description "..." --telemetry --comm file-signal`.

**Migration effort:** Medium. Need to write `setup.ts`. But prerequisites checking is pure shell — easy to script.

### Team Onboarding (team-onboarding SKILL → onboard.ts)

**Current:** Skill runs 8-step wizard, calls `onboard.ts` at Step 6.

**Proposed:** Skill extracts params, calls `onboard.ts` with all args. Script handles everything. On missing params, script returns structured error, skill asks user, retries.

**Migration effort:** LOW. The script already does 90% of the work. Need to:
1. Add `--output-format json` flag
2. Add `--discover-archetypes` subcommand
3. Move archetype installation INTO the script
4. Slim the skill from 322 lines to ~60

### Launch / Monitor / Directives

**Current:** These scripts are ALREADY inverted — they're pure CLI tools. The `federation-orchestration` skill just calls them. No duplication.

**Migration effort:** NONE. Already in the right model.

### Knowledge Flow (sweep, graduate, sync)

**Current:** Scripts are CLI tools, skills are thin wrappers. Already inverted.

**Migration effort:** NONE.

**Summary:** Only setup and onboarding need migration. Everything else is already in the right model.

---

## 4. Testability Gains

### Before (current model)

```
Test: "Does onboarding work end-to-end?"
Method: ???
- Can't unit test a SKILL.md file
- Can't simulate "user says coding"
- Have to run the actual LLM
- Flaky, slow, expensive
```

### After (inverted model)

```typescript
// test/onboard.test.ts — DETERMINISTIC

describe('onboard.ts', () => {
  it('creates worktree with valid params', async () => {
    const result = await runScript('onboard.ts', {
      name: 'auth',
      domainId: 'auth-001',
      archetype: 'squad-archetype-coding',
      placement: 'worktree',
      outputFormat: 'json'
    });
    expect(result.status).toBe('success');
    expect(result.team.branch).toBe('squad/auth');
  });

  it('returns structured error for missing archetype', async () => {
    const result = await runScript('onboard.ts', {
      name: 'auth',
      domainId: 'auth-001',
      outputFormat: 'json'
    });
    expect(result.status).toBe('error');
    expect(result.code).toBe('MISSING_PARAM');
    expect(result.param).toBe('archetype');
    expect(result.available).toContain('squad-archetype-deliverable');
  });

  it('returns error for existing branch', async () => {
    // Create branch first
    await exec('git branch squad/auth');
    const result = await runScript('onboard.ts', {
      name: 'auth',
      domainId: 'auth-001',
      archetype: 'squad-archetype-coding',
      outputFormat: 'json'
    });
    expect(result.status).toBe('error');
    expect(result.code).toBe('BRANCH_EXISTS');
  });

  it('handles dry-run mode', async () => {
    const result = await runScript('onboard.ts', {
      name: 'auth',
      domainId: 'auth-001',
      archetype: 'squad-archetype-coding',
      dryRun: true,
      outputFormat: 'json'
    });
    expect(result.status).toBe('dry_run');
    expect(result.wouldCreate.branch).toBe('squad/auth');
    // No actual branch created
    expect(branchExists('squad/auth')).toBe(false);
  });
});
```

**No LLM in the test loop.** Pure `inputs → outputs`. Run in CI. Deterministic. Fast.

The skill only needs testing for parameter extraction:

```typescript
describe('skill parameter extraction', () => {
  it('extracts team name from natural language', () => {
    // This tests the PROMPT, not the flow
    // "onboard a team for auth" → { name: "auth" }
    // Can use LLM-based eval framework for this
  });
});
```

---

## 5. Multi-Step Conversations

**The concern:** Some flows need back-and-forth. "What archetype?" → user picks → "Where to place?" → user picks → proceed.

**The solution: Progressive enrichment with error-retry.**

```
ATTEMPT 1: Skill extracts what it can from initial request
  "onboard a team for auth" → { name: "auth" }
  Calls: onboard.ts --name auth --output-format json
  
RESPONSE 1: Script says "missing archetype"
  { error: "MISSING_PARAM", param: "archetype", available: [...] }
  
Skill asks: "What kind of team? coding/deliverable/research/task?"
User says: "coding"

ATTEMPT 2: Skill adds the missing param
  Calls: onboard.ts --name auth --archetype squad-archetype-coding --output-format json
  
RESPONSE 2: Script succeeds
  { status: "success", team: { ... } }
```

**Or, the smart skill pre-asks:**

If the skill is well-written, it extracts EVERYTHING from the initial request and context:

```
User: "onboard a coding team for auth, worktree placement"
Skill extracts: { name: "auth", archetype: "coding", placement: "worktree" }
Calls script ONCE → succeeds first try
```

**The script should also support `--interactive false` (default) and `--defaults` mode:**
- With defaults: `--archetype` defaults to `squad-archetype-deliverable`, `--placement` defaults to `worktree`
- With `--discover-archetypes`: lists available archetypes as JSON
- With `--dry-run`: validates everything without executing

This means fully automated pipelines can run:
```bash
onboard.ts --name auth --archetype squad-archetype-coding --defaults
```
No skill needed. No LLM. Pure automation. Issue #155 solved.

---

## 6. OTel and Progress

**Current:** Both the skill (via tool calls) and the script (via `OTelEmitter`) emit OTel. Duplicated.

**After inversion:** ONLY the script emits OTel. It already does via `OTelEmitter`:

```typescript
// onboard.ts already does this:
await emitter.span('onboard.script', async () => {
  await emitter.span('workspace.create', async () => { ... });
  emitter.event('workspace.created', { placement, location });
  await emitter.span('squad.init', async () => { ... });
  await emitter.span('team.register', async () => { ... });
  emitter.event('onboard.complete', { domain: args.name });
});
```

The skill doesn't need ANY OTel tool calls. Remove them. The script is the source of truth for what happened and when.

---

## 7. Teams Channel Communication

**The concern:** Teams channel is conversational. How does script-drives-skill work there?

**Answer:** The script-drives-skill inversion is about the Copilot plugin architecture, not about Teams channel communication. Teams channel is a transport — it carries signals between squads. The inversion doesn't change that.

What changes:
- **Before:** Skill posts to Teams via tool calls as part of orchestration
- **After:** Script posts to Teams via the communication adapter (already abstracted in `lib/communication/`)

The script already has `TeamCommunication` adapters. It can write to Teams channels natively. No skill involvement needed for mechanical communication.

For human interaction via Teams (e.g., a human posts in the channel and expects a response), that's a separate concern — the meta-squad agent watching the channel handles that, not the onboarding skill.

---

## 8. Risks and Trade-offs

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Skill becomes too dumb** — loses ability to have nuanced conversation | Medium | Keep the skill responsible for NLU. It still interprets "set up a team that writes code" → `archetype: coding`. |
| **Error-retry loops** — skill retries 5 times with different params | Low | Cap retries at 3. On 3rd failure, show raw error + recovery instructions. |
| **Script output parsing** — skill must parse JSON stdout | Low | Use `--output-format json` flag. Script already has structured error messages. |
| **Migration disruption** — changing the skill while users depend on it | Low | Users are on v0.x. Breaking changes are acceptable (per SDLC rules). |
| **Over-engineering the script** — adding too many flags | Medium | Start minimal: `--output-format json`, `--discover-archetypes`, `--dry-run`. Add more only when needed. |

### Trade-offs

| Current Model (skill-drives-script) | Inverted Model (script-drives-skill) |
|--------------------------------------|---------------------------------------|
| Rich conversational flow | Conversation is front-loaded (params first) |
| Skill can adapt mid-flow | Skill retries on error (less fluid) |
| Hard to test | Easy to test |
| Hard to automate | Trivially automatable |
| Duplicated logic | Single source of truth |
| OTel in two places | OTel in one place |
| 322-line skill | ~60-line skill |

The trade-off on conversation fluidity is real. The current model can ask "oh interesting, tell me more about the mission" mid-flow. The inverted model is more transactional: extract params → call script → handle errors. But for onboarding, transactional is BETTER. Users want their team set up, not a conversation about it.

---

## 9. Migration Strategy

### Phase 1: Pilot with team-onboarding (1-2 days)

**Why start here:** The script (`onboard.ts`) already does 90% of the work. The skill (`team-onboarding`) has the most duplication. Biggest bang for the buck.

**Changes to `onboard.ts`:**
1. Add `--output-format json` flag (route stdout to JSON)
2. Add `--discover-archetypes` subcommand (list available archetypes as JSON)
3. Add `--dry-run` flag (validate without executing)
4. Move archetype installation into the script (currently skill-only)
5. Convert `process.exit(1)` calls to structured JSON errors on stderr

**Changes to `team-onboarding/SKILL.md`:**
1. Remove Steps 3-4 decision logic (script handles it)
2. Remove OTel tool calls (script handles it)
3. Reduce to: extract params → call script → handle errors → report results
4. ~60 lines instead of 322

**Validation:**
- Run existing vitest suite (scripts already have tests)
- Add tests for new flags
- Manual test: "onboard a team for auth" still works end-to-end

### Phase 2: Federation setup (2-3 days)

**Create `setup.ts`** — the federation setup has NO script today. The skill IS the logic. This is the bigger lift.

**Move into `setup.ts`:**
- Prerequisite checking (git, node, squad, docker)
- Config generation from params
- Dashboard startup
- Meta-squad casting trigger

**Slim `federation-setup/SKILL.md`** to parameter extraction + error handling.

### Phase 3: Audit remaining skills (1 day)

**Already inverted (no work needed):**
- `federation-orchestration` — already calls scripts as CLI tools
- `knowledge-lifecycle` — already wraps script calls
- `inter-squad-signals` — already wraps signal protocol
- `otel-observability` — already wraps dashboard script

**May need light touch:**
- `archetype-creator` — check if it duplicates logic

### Timeline

| Phase | Scope | Effort | Risk |
|-------|-------|--------|------|
| Phase 1 | team-onboarding | 1-2 days | Low |
| Phase 2 | federation-setup | 2-3 days | Medium |
| Phase 3 | Audit others | 1 day | None |

**Total: ~5 days for full migration.**

---

## 10. My Recommendation

**Do it. Start with Phase 1 (team-onboarding).**

The evidence is overwhelming:

1. **The script already does the work.** `onboard.ts` is 593 lines of tested, deterministic logic. The skill adds 322 lines of duplicated, untestable orchestration on top.

2. **The script already has structured errors.** Look at the `parseArgs` function — it already outputs recovery instructions. We just need to make them machine-readable (JSON instead of console.error).

3. **The script already has OTel.** The `OTelEmitter` wrapping is clean. Removing OTel from the skill is pure deletion.

4. **The other flows are already inverted.** Launch, monitor, directives, knowledge — they're all script-first with thin skill wrappers. Onboarding is the outlier. We're normalizing the architecture, not reinventing it.

5. **It solves two open issues.** #155 (automation blocking) and #154 (param drift) are both eliminated by design.

6. **It's low risk.** We're v0.x — breaking changes are acceptable. The script interface is already stable. The skill is the part that changes.

The one thing I'd watch for: don't over-engineer the script's interactive capabilities. The script should NOT grow a conversation engine. It should be `args in → results out`. If something needs a conversation, that's the skill's job. Keep the boundary clean.

**Proposed rule going forward:**

> **Scripts are functions. Skills are wrappers.**
> - Scripts: deterministic, testable, `args → results`
> - Skills: NLU, parameter extraction, error presentation, retry logic
> - If logic can be in the script, it MUST be in the script
> - Skills never contain decision trees that the script also enforces

—Mal
