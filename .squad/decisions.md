---
type: decisions
version: "0.5.0"
last_updated: 2025-04-15
---

# Team Decisions & Directives

## SDLC Rules

### Documentation Updates with Code Changes
**Date:** 2025-04-15  
**Context:** README still referenced removed v0.3.x features after v0.5.0 shipped  
**Decision:** Every PR that changes behavior, config, or public interfaces MUST include doc updates (README, ARCHITECTURE.md) in the same PR. Not a follow-up.  
**Rationale:** Documentation drifts when updated separately. "Same PR or it's not done."

### Model Selection for Kaylee
**Date:** 2025-04-15  
**Context:** Iterative SDK development requires streaming + incremental implementation  
**Decision:** Kaylee uses claude-sonnet-4.5 for SDK work, NOT codex models  
**Rationale:** Codex models too slow for iterative dev workflow

## Architecture Decisions

### No Migrations, No Backward Compatibility (Pre-1.0)
**Date:** v0.4.0  
**Decision:** Pre-1.0 versioning allows breaking changes without migrations  
**Impact:** Teams re-initialize on version bump (bootstrap handles setup)  
**Rationale:** Enables rapid iteration without tech debt from backward compat

### Communication is Federation-Scoped
**Date:** v0.5.0  
**Decision:** All teams in a federation use the same communication type (FileSignalCommunication OR TeamsCommunication)  
**Contrast:** Placement is per-team — can mix WorktreePlacement and DirectoryPlacement  
**Rationale:** Signal routing requires consistent protocol across federation

### Package.json at Plugin Root
**Date:** 2025-04-15  
**Context:** ESM import errors across directories (scripts/ and plugins/)  
**Decision:** Single package.json at plugin root, not nested in scripts/  
**Rationale:** Package boundaries caused import resolution failures. Single package.json at common ancestor fixes it.

### TeamRegistry for Team Enumeration
**Date:** v0.5.0  
**Decision:** Use TeamRegistry.getTeams() to enumerate teams, not worktree-utils  
**Rationale:** worktree-utils removed; TeamRegistry is placement-agnostic enumeration layer

## Protocol Decisions

### Teams Channel Hashtag Protocol
**Date:** v0.5.0  
**Decision:** Hashtag markers in Teams messages:
- `#meta` — Federation-wide announcements
- `#meta-status` — Status and health checks  
- `#{teamId}` — Team-specific channels

**Rationale:** Enables message routing in shared Teams channels without separate channels per team
