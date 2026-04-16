---
agent: wash
role: Researcher, Federation & Signals
model: claude-sonnet-4.5
updated: 2025-07-14
---

# wash — History

## Ground Truth Scanning
- Systematic code scan → reference doc → feeds docs, team memory, Astro site.
- Docs-audit workflow: scan code first → audit docs against ground truth → fix from both.
- Parallelizable: different agents scan different sections.

## Archetype.json Distinction
- **Root archetype.json** — Plugin manifest for discovery (NOT marketplace catalog). Discovery marker with metadata.
- **team/ archetype.json** — Runtime state machine copied to teams on initialization.

Two-archetype.json rule is the most common source of confusion for new agents.

## ACP Protocol Discovery (v0.8.0)
- Azure Communication Presence (ACP) is the underlying protocol for teams-presence.
- Graph API `/communications/presences` — read/write presence for AAD users.
- Presence states: Available, Busy, DoNotDisturb, Away, Offline, PresenceUnknown.
- Activity values map to agent lifecycle: InACall → executing, Presenting → blocked, Available → idle.
- Rate limits: 1 request/second per user for presence writes; batch reads up to 650 users.

## Graph API Teams Integration
- App-only tokens (client_credentials) for daemon/service patterns.
- Delegated tokens for user-context operations (presence writes require delegated).
- Presence.ReadWrite.All scope needed; admin consent required in tenant.
- Status message field (max 280 chars) used for agent context (domain, current task).

## Federation Architecture (current)
- Teams organized by domain (unique domainId).
- Placement is per-team (DirectoryPlacement or WorktreePlacement).
- Communication is federation-wide (one transport for all teams).
- Signal types: directive, question, report, alert. Storage: `.squad/inbox.json` / `outbox.json`.

## SDLC Rules
1. Document protocols — signal flow needs end-to-end docs.
2. Test signal routing — verify round-trip delivery.
3. Ground truth from code — when unsure, scan implementation.
