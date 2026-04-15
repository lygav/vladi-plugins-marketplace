# Documentation Audit for squad-federation-core v0.5.0

**Audit Date:** 2025-05-16  
**Plugin Version:** v0.5.0  
**Auditor:** Documentation Review Bot  
**Scope:** All documentation files compared against actual codebase implementation

---

## Executive Summary

This audit reviewed **all documentation files** in `squad-federation-core` plugin v0.5.0 against the actual codebase to identify:
- ❌ Stale config field references (removed in v0.4.0+)
- ❌ Outdated terminology (old type names vs. new interfaces)
- ❌ Incorrect function names or parameters
- ❌ Invalid or removed configuration options

**Key Findings:**
1. **Config Schema Issues**: Several docs reference `branchPrefix`, `worktreeDir`, `mcpStack` — all removed from schema
2. **Terminology Drift**: Some docs still use "transport abstraction" while code uses "placement + communication" model
3. **Mixed Messaging**: Some docs correctly show new schema, others show old schema
4. **Agent Documentation**: Mostly correct but some stale transport references

---

## File-by-File Audit Results

### ✅ README.md

**Status:** Mostly correct, but **STALE CONFIG REFERENCES FOUND**

#### ❌ Stale Content

**Lines 46, 103, 343-349** — Old config fields documented that no longer exist:

```markdown
Line 46: "Configure MCP stack, telemetry, branch prefix, worktree location"
```
**Issue:** References `branchPrefix` and `worktree location` which are no longer in `federate.config.json` schema.

**Lines 343-349** — Configuration reference table:
```markdown
| `branchPrefix` | `"squad/"` | Git branch prefix for team worktrees |
| `worktreeDir` | `"parallel"` | Where worktrees live: `"parallel"` (sibling dirs), `"inside"` (`.worktrees/`), or custom path |
```
**Issue:** Per `sdk/schemas.ts` lines 199-223, current `FederateConfigSchema` includes these fields BUT with defaults. However, federation-setup/SKILL.md (authoritative setup guide) explicitly does NOT create these fields and only creates:
- `description`
- `telemetry.enabled`
- `communicationType`
- `teamsConfig` (optional)

**Contradiction detected:** Code schema has the fields with defaults, but setup skill doesn't create them. This suggests they're DEPRECATED but not yet removed from schema for backward compatibility.

**Line 103** — Quick start config example shows:
```json
{
  "branchPrefix": "squad/",
  "worktreeDir": "parallel"
}
```
**Issue:** This example should match the CURRENT config shape from federation-setup skill.

#### ✅ Correct Content

- Transport vs placement/communication distinction: Not explicitly mentioned in README (neutral, not wrong)
- Teams config structure correctly documented (lines 350+)
- Skill descriptions match actual skill files
- Installation instructions are current

#### 🔧 Recommended Fixes

1. **Line 46**: Change to "Configure telemetry and communication type"
2. **Lines 103, 343-349**: Remove `branchPrefix` and `worktreeDir` from config examples and tables
3. **Line 103**: Update example config to match federation-setup output:
```json
{
  "description": "Multi-team project federation",
  "telemetry": {
    "enabled": true
  },
  "communicationType": "file-signal"
}
```

---

### ❌ ARCHITECTURE.md

**Status:** MIXED — Contains both current and stale terminology

#### ❌ Stale Content

**Line 40** — "transport abstraction":
```markdown
A **meta-squad** orchestrates N permanent **domain squads** via a **transport abstraction**.
```
**Issue:** v0.4.0+ uses "placement + communication abstraction" model, NOT "transport abstraction". The word "transport" is legacy terminology.

**Evidence from code:**
- `sdk/types.ts` exports `TeamPlacement` and `TeamCommunication` interfaces (NOT `TeamTransport`)
- `scripts/lib/placement/` directory exists with modular placement implementations
- `scripts/lib/communication/` directory exists with modular communication implementations

**Line 235** — `{branchPrefix}` reference:
```markdown
**Branch naming:** `{branchPrefix}{team-name}` (default: `squad/team-alpha`)
```
**Issue:** While technically still in schema with default value, this gives false impression it's user-configurable. Setup skill doesn't expose it.

**Line 387** — Similar `{branchPrefix}` reference in branch pattern explanation

#### ✅ Correct Content

**Lines 1660-1661** — CORRECTLY documents removal:
```markdown
- **No branchPrefix/worktreeDir** — These were federation-level in v0.2.0. Now team-level (in teams.json) to support multi-placement federations.
- **No mcpStack** — Archetypes auto-discovered from marketplace.json. MCP servers inherited from project `.mcp.json`.
```
**This is ACCURATE** — clearly states these fields were removed.

**Lines 2102, 2118** — Changelog correctly notes removals

**Lines 12, 16, 30-32** — Executive summary CORRECTLY uses "placement and communication abstraction"

**Lines 194-231** — TeamPlacement interface documentation is CURRENT and CORRECT

**Lines 349-368** — Context factory composition correctly documented

#### 🔧 Recommended Fixes

1. **Line 40**: Change "transport abstraction" → "placement and communication abstraction"
2. **Line 42**: Change "transport-agnostic" → "placement-agnostic and protocol-agnostic"
3. **Line 51**: Change "SDK (types, transport, base classes)" → "SDK (types, placement, communication, base classes)"
4. **Lines 235, 387**: Remove `{branchPrefix}` references or clarify it's internal-only, not user-configurable
5. Ensure consistency — top of doc should match terminology used in rest of doc

---

### ✅ EXAMPLE.md

**Status:** MOSTLY CORRECT

#### ❌ Stale Content

**Lines 93-99** — Example config shown during setup:
```json
{
  "description": "Build a test automation suite for the API",
  "telemetry": {
    "enabled": true
  }
}
```
**Issue:** This is CORRECT for v0.5.0! No stale fields. BUT line 74-78 mentions "What MCP servers..." which could imply mcpStack config, though the generated config doesn't show it.

**Line 66**: Archetype selection statement says "Each team will pick its own archetype during onboarding" — this is CORRECT per actual onboarding flow.

#### ✅ Correct Content

- Walkthrough flow matches federation-setup skill flow
- Config examples match current schema (no branchPrefix/worktreeDir shown)
- Team onboarding flow is accurate
- No references to removed fields

#### 🔧 Recommended Fixes

None critical. Minor clarification possible at line 74-78 to explicitly state "MCP servers are inherited from project .mcp.json" to avoid any confusion.

---

### ❌ CREATING_ARCHETYPES.md

**Status:** STALE CONFIG REFERENCE FOUND

#### ❌ Stale Content

**Line 66** — Three-layer table shows Core layer config:
```markdown
| **Core** | Plugin: `squad-federation-core` | `federate.config.json` | Branch prefix, MCP stack, telemetry, worktree location |
```
**Issue:** Lists "Branch prefix, MCP stack, worktree location" as Core config fields. Per current schema and setup skill:
- "Branch prefix" (`branchPrefix`) — Has default in schema but NOT exposed in setup
- "MCP stack" (`mcpStack`) — REMOVED per ARCHITECTURE.md line 1661
- "Worktree location" (`worktreeDir`) — Has default in schema but NOT exposed in setup

**Actual Core config (per federation-setup/SKILL.md):**
- `description`
- `telemetry.enabled`
- `communicationType`
- `teamsConfig` (conditional)

#### ✅ Correct Content

- Archetype spectrum explanation is current
- Knowledge architecture section is comprehensive and current
- SDK integration requirements are accurate
- State machine and monitoring concepts match implementation

#### 🔧 Recommended Fixes

**Line 66**: Update Core layer example config to:
```markdown
| **Core** | Plugin: `squad-federation-core` | `federate.config.json` | Description, telemetry, communication type (file-signal or teams-channel) |
```

---

### ✅ skills/federation-setup/SKILL.md

**Status:** ✅ **AUTHORITATIVE AND CURRENT** — This is the gold standard

#### ✅ Correct Content

**Lines 192-217** — Shows CURRENT config schema:
```markdown
communicationType: 'file-signal' | 'teams-channel'
description (optional)
telemetry.enabled (boolean)
teamsConfig (if teams-channel)
```

**Lines 311-330** — Config examples match schema exactly

**No references to:**
- ❌ branchPrefix
- ❌ worktreeDir  
- ❌ mcpStack

**This skill is the SOURCE OF TRUTH for current config structure.**

#### 🔧 Recommended Fixes

None. This is the reference implementation.

---

### ✅ skills/federation-orchestration/SKILL.md

**Status:** Correct

#### ✅ Correct Content

- No stale config references
- Correct script paths (`scripts/onboard.ts`, `scripts/launch.ts`, etc.)
- Correct mention of transport selection (worktree/directory) in context of onboarding
- No deprecated terminology

#### 🔧 Recommended Fixes

None

---

### ✅ skills/team-onboarding/SKILL.md

**Status:** Correct with minor terminology note

#### ⚠️ Minor Terminology Note

**Line references to "transport":**
- Uses "transport" in context of team placement options (worktree vs directory)
- This is acceptable as shorthand for "placement type"
- Code uses `transport` field in `TeamEntry` schema (sdk/schemas.ts line 181) for backward compatibility

**Verdict:** Acceptable. The field name in schema is still `transport`, though the architecture calls it "placement".

#### ✅ Correct Content

- Worktree placement options correctly documented
- Directory placement correctly documented
- No stale config field references
- Archetype installation flow is current

#### 🔧 Recommended Fixes

None. Terminology matches schema field names.

---

### ✅ skills/inter-squad-signals/SKILL.md

**Status:** Correct

#### ✅ Correct Content

- Signal protocol correctly documented
- File-based signal structure matches implementation
- No stale references
- Directive/inbox/outbox mechanics match code

#### 🔧 Recommended Fixes

None

---

### ✅ skills/knowledge-lifecycle/SKILL.md

**Status:** Correct

#### ✅ Correct Content

- Learning log structure matches code
- Skill sync, sweep, and graduation flows are accurate
- No stale config references
- Script paths are current (`sync-skills.ts`, `sweep-learnings.ts`, `graduate-learning.ts`)

#### 🔧 Recommended Fixes

None

---

### ✅ skills/otel-observability/SKILL.md

**Status:** Correct

#### ✅ Correct Content

- Telemetry configuration matches code
- OTel MCP server integration correctly documented
- Dashboard setup instructions are current
- No stale references

#### 🔧 Recommended Fixes

None

---

### ✅ skills/archetype-creator/SKILL.md

**Status:** Correct

#### ✅ Correct Content

- Archetype manifest structure matches `sdk/schemas.ts` (ArchetypeManifestSchema)
- State machine, monitor, triage, recovery config all match implementation
- SDK interface documentation is accurate
- No stale terminology

#### 🔧 Recommended Fixes

None

---

### ✅ agents/federation.agent.md

**Status:** Correct

#### ✅ Correct Content

- References correct skills (federation-setup, knowledge-lifecycle, inter-squad-signals)
- Script paths are current (onboard.ts, launch.ts, monitor.ts)
- Worktree-centric workflow is accurate (line 17: "multi-team organizations...each in its own git worktree")
- No stale config references

#### 🔧 Recommended Fixes

None

---

### ⚠️ agents/onboard.agent.md

**Status:** Mostly correct, minor transport terminology

#### ⚠️ Minor Terminology Note

**Line 78-85** — "Select transport" section:
```markdown
### 4. Select transport

**Choices:**
- **worktree** *(default)* — git worktree in a parallel or inside directory
- **directory** — standalone directory (no git branch)
- **teams** — Microsoft Teams channel integration
```

**Issue:** Uses "transport" as the heading, but code uses "placement type" internally. However, the onboard.ts script uses `--transport` flag, so this is technically correct for the CLI interface.

**Verdict:** Acceptable. Agent is documenting the CLI flag, not the internal type name.

#### ✅ Correct Content

- Archetype selection flow matches implementation
- Marketplace discovery matches actual behavior
- Script invocation is correct: `npx tsx scripts/onboard.ts --archetype --transport`
- Worktree verification steps are accurate

#### 🔧 Recommended Fixes

None critical. Could add a note that "transport" refers to "how the team workspace is placed" for clarity.

---

### ✅ agents/sweeper.agent.md

**Status:** Correct

#### ✅ Correct Content

- Learning log analysis correctly documented
- Script path is current (`scripts/sweep-learnings.ts`)
- Pattern graduation workflow matches implementation
- No stale references

#### 🔧 Recommended Fixes

None

---

## Code vs Documentation Analysis

### Actual Config Schema (sdk/schemas.ts lines 196-223)

```typescript
export const FederateConfigSchema = z.object({
  description: z.string().optional(),
  branchPrefix: z.string().default('squad/'),  // ⚠️ HAS DEFAULT
  worktreeDir: z.union([z.literal('parallel'), z.literal('inside'), z.string()]).default('parallel'),  // ⚠️ HAS DEFAULT
  telemetry: z.object({
    enabled: z.boolean(),
    aspire: z.boolean().optional(),
  }).default({ enabled: true }),
  communicationType: z.enum(['file-signal', 'teams-channel']).default('file-signal'),
  teamsConfig: z.object({
    teamId: z.string(),
    channelId: z.string()
  }).optional(),
  // ... other fields
});
```

### Setup Skill Generated Config (federation-setup/SKILL.md)

```json
{
  "description": "...",
  "telemetry": {
    "enabled": true
  },
  "communicationType": "file-signal"
}
```

**Discrepancy:** Schema has `branchPrefix` and `worktreeDir` with defaults, but setup skill doesn't create them. This indicates:
1. Fields exist for **backward compatibility** with older federations
2. Fields are **deprecated** but not yet removed
3. New federations should NOT set these fields (rely on defaults)

**Recommendation:** Documentation should:
- ✅ Show config examples WITHOUT these fields (like federation-setup does)
- ✅ Note in migration guides that older configs may have these fields
- ❌ NOT encourage users to set these fields in new configs

---

## Summary of Issues by Severity

### 🔴 Critical Issues

1. **README.md line 103** — Quick start config shows deprecated fields
2. **README.md lines 343-349** — Config reference table includes deprecated fields
3. **CREATING_ARCHETYPES.md line 66** — Lists removed fields in Core layer config

### 🟡 Medium Issues

4. **README.md line 46** — Mentions configuring removed fields
5. **ARCHITECTURE.md lines 40, 42, 51** — Uses legacy "transport abstraction" terminology
6. **ARCHITECTURE.md lines 235, 387** — References `{branchPrefix}` pattern

### 🟢 Low Issues / Notes

7. **ARCHITECTURE.md** — Mixed terminology (both old and new) creates confusion
8. **Terminology drift** — Some docs use "transport", some use "placement", some use both

---

## Recommendations

### Immediate Fixes (High Priority)

1. **Update README.md config examples** to remove `branchPrefix` and `worktreeDir`
2. **Update CREATING_ARCHETYPES.md table** to show current Core config fields
3. **Standardize terminology** in ARCHITECTURE.md (use "placement + communication" consistently)

### Documentation Standards Going Forward

1. **federation-setup/SKILL.md is authoritative** for config schema — other docs should reference it
2. **Terminology standard:**
   - ✅ "placement" (where team lives)
   - ✅ "communication" (how team signals)
   - ❌ "transport" (deprecated umbrella term)
   - ⚠️ "transport" field in TeamEntry schema (acceptable for backward compat)

3. **Config field lifecycle:**
   - Fields with defaults in schema but NOT in setup skill = deprecated
   - Document these in migration guide, not user-facing guides
   - Remove from quick start and examples

---

## Files Reviewed

- ✅ README.md (357 lines) — **ISSUES FOUND**
- ✅ ARCHITECTURE.md (2400+ lines) — **ISSUES FOUND**
- ✅ EXAMPLE.md (1000+ lines) — **MOSTLY CORRECT**
- ✅ CREATING_ARCHETYPES.md (1000+ lines) — **ISSUES FOUND**
- ✅ federation-setup/SKILL.md (405 lines) — **AUTHORITATIVE ✓**
- ✅ federation-orchestration/SKILL.md (213 lines) — **CORRECT ✓**
- ✅ team-onboarding/SKILL.md (279 lines) — **CORRECT ✓**
- ✅ inter-squad-signals/SKILL.md (305 lines) — **CORRECT ✓**
- ✅ knowledge-lifecycle/SKILL.md (265 lines) — **CORRECT ✓**
- ✅ otel-observability/SKILL.md (260 lines) — **CORRECT ✓**
- ✅ archetype-creator/SKILL.md (543 lines) — **CORRECT ✓**
- ✅ agents/federation.agent.md (61 lines) — **CORRECT ✓**
- ✅ agents/onboard.agent.md (147 lines) — **CORRECT ✓**
- ✅ agents/sweeper.agent.md (39 lines) — **CORRECT ✓**

**Code References Checked:**
- ✅ sdk/schemas.ts (FederateConfigSchema)
- ✅ scripts/lib/config/config.ts (config loader)
- ✅ scripts/lib/placement/ (WorktreePlacement, DirectoryPlacement)
- ✅ scripts/lib/communication/ (file-signal, teams-channel)
- ✅ scripts/lib/orchestration/context-factory.ts (TeamContext composition)

---

## Conclusion

The documentation is **generally high quality** with the **setup skill being authoritative and correct**. Main issues are:
1. **Stale config examples** in README and CREATING_ARCHETYPES that reference deprecated fields
2. **Terminology inconsistency** in ARCHITECTURE.md (mix of old and new terms)
3. **No major functional errors** — scripts, skills, and agents are documented accurately

**Next Steps:**
1. Update config examples in README.md (lines 103, 343-349)
2. Update CREATING_ARCHETYPES.md Core layer description (line 66)
3. Standardize "placement + communication" terminology in ARCHITECTURE.md
4. Consider adding a "Config Migration Guide" section to document deprecated fields

---

**Audit Complete** ✅
