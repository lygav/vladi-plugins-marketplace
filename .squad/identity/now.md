---
updated_at: 2026-04-16T14:00:00Z
focus_area: v0.8.0 — teams-presence, federation persona
version: "0.8.0"
marketplace_version: "3.0.0"
---

# Current State

## What Just Shipped (this session)

**v0.8.0** — Teams presence, federation persona, OTel fixes

### Teams Presence (PR #206)
- New teams-presence.ts: persistent Teams bridge via Graph API + Copilot ACP
- Polls channel for @<federationName> messages, executes via ACP, replies in-thread
- Replaces retired meta-heartbeat.ts entirely
- Modular: lib/teams-presence/ (acp-session, graph-client, watermark, poll)
- Auto-starts from setup.ts when Teams is configured

### Federation Persona (PR #205)
- federationName in federate.config.json
- Users address meta-squad by name: @artemis launch frontend
- Setup skill generates name from mission, user confirms
- Replaces #directive convention

### OTel Fixes (PRs #202-#203)
- Timestamps: epoch nanos via BigInt(Date.now()) * 1_000_000n
- Resource: squad.federation attribute for identification
- Registry: setup.ts writes version field (was missing)
- Zod errors include field path

### Heartbeat Retired
- meta-heartbeat.ts deleted (replaced by teams-presence)
- heartbeat config removed from all code, docs, tests
- Internal corporate references removed

## Open Issues (1)
- #6: Pipeline archetype

## Open PR
- #206: teams-presence (pending user review)

## Key Directives
1. NO migrations, NO backward compat (pre-1.0)
2. File-signal is the only inter-team transport
3. Teams is meta-only channel via teams-presence
4. SDLC: tests + docs + typecheck per PR
5. ADR-001: scripts own logic, skills wrap
6. Single federation agent routes to skills
7. Meta-squad delegates, never does domain work
8. No internal/corporate references in code or docs
9. copilotCommand in config, not env vars
10. Version bump: plugin.json, archetype.json, marketplace.json

## Next Session Priorities
1. Merge PR #206 + tag v0.8.0 + GitHub release
2. Deploy docs
3. End-to-end test with teams-presence live
4. Pipeline archetype (#6)
