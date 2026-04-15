---
updated_at: 2026-04-15T12:17:00Z
focus_area: Script-drives-skill architecture decision pending execution
version: "0.6.0"
marketplace_version: "3.0.0"
---

# Current State

## What Just Shipped (this session)

**v0.4.0** — Transport/placement separation
- TeamPlacement + TeamCommunication replace TeamTransport
- Adapter registry with registerCommunicationAdapter()
- Modular lib/ structure (7 modules)
- Dead code removed (worktree-utils, old transport refs)

**v0.5.0** — Teams channel communication
- TeamsChannelCommunication class (hashtag protocol)
- #meta (human priority), #meta-status (team updates), #{teamId} (directives)
- Federation-setup asks for channel details

**v0.6.0** — Runtime fixes + live communication
- Cross-platform bootstrap.mjs (auto-installs deps)
- OTelEmitter reads endpoint from federate.config.json
- CLI flag aliases (--team/--mission)
- Fresh repo handling, ESM import fix
- ProgressReporter utility (dual OTel + signal)
- Federation-setup + onboarding instrumented with OTel
- Meta relay loop (curated summaries to console/Teams)
- Archetype skills emit continuous progress
- Astro docs site deployed (starlight-theme-next, GitHub Pages)
- Full docs rewrite (conversational flow, no history)

## Key Architecture Decision: Script-Drives-Skill (ADR-001)

APPROVED but NOT YET EXECUTED. See .squad/decisions/adr-001-script-drives-skill.md

Rule: "Scripts are functions. Skills are wrappers. If logic can be in the script, it MUST be in the script."

Current: skill orchestrates → calls script
Proposed: script drives → skill provides input on demand

Execution plan: #159 (onboarding) → #160 (setup) → #161 (audit)

## Open Issues (9)

**Script-drives-skill (approved, ready to execute):**
- #159: Invert onboarding — script drives skill (Phase 1, also fixes #154, #155)
- #160: Create setup.ts — script-driven federation setup (Phase 2)
- #161: Audit all flows (Phase 3)

**Bugs from testing:**
- #154: Skill docs missing --domain-id (fixed by #159)
- #155: Non-interactive mode (fixed by #159)
- #156: Teams comms crashes without MCP — graceful degradation needed
- #157: Launch.ts --communication-type override + headless fix

**Infrastructure:**
- #122: TypeScript compile check + e2e smoke tests

**Future:**
- #6: Pipeline archetype

## Key Directives (team must follow)

1. NO migrations, NO backward compat (pre-1.0, zero users)
2. Communication is federation-scoped, placement is per-team
3. Docs update in same PR as code changes
4. No history in docs — current state only, conversational skill flow
5. Kaylee uses claude-sonnet-4.5 (not codex)
6. Use opus for docs/content reviews
7. Meta always provides curated summaries regardless of transport
8. Version bump checklist: plugin.json, archetype.json, marketplace.json, ARCHITECTURE.md, README

## Repo Locations

- Marketplace: /Users/vladilyga/Devel/squadai/vladi-plugins-marketplace
- Squad state: /Users/vladilyga/Devel/squadai/plugin_developer/.squad/
- Docs site: https://lygav.github.io/vladi-plugins-marketplace/
