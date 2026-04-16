---
agent: scribe
role: Documentation, Memory & Knowledge Sync
model: claude-sonnet-4.5
updated: 2025-07-14
---

# scribe — History

## Knowledge Capture Workflow
1. Run ground truth scan → authoritative code reference.
2. Extract patterns → wisdom.md.
3. Update now.md → current focus.
4. Prune agent histories → distill to <2KB each.
5. Create skills → reusable patterns in skills/ directory.

## Ground Truth Scan
- **When:** After major releases, onboarding, quarterly, when docs drift detected.
- **Output:** Complete reference with code locations, real snippets, interface docs.
- Docs-audit: scan code first → audit docs against ground truth → fix from both inputs.

## Team Memory Layout
`.squad/identity/{now,wisdom}.md` · `agents/{name}/history.md (<2KB)` · `decisions.md` · `skills/`

## v0.8.0 — teams-presence Headline
- Primary feature: agent presence in Teams via Graph API.
- New lib modules: graph-client, presence-manager, status-publisher.
- 374 tests passing; teams-integration tests updated for presence.
- ACP review lessons captured in mal's history.

## SDLC Compliance Checklist
- [ ] Code changes have matching doc updates
- [ ] New patterns added to wisdom
- [ ] Agent histories reflect current roles (<2KB each)
- [ ] Attribution trailers in commits

## Anti-Patterns to Document
- Tight coupling placement & communication.
- Archetype-specific params in generic factories.
- Docs drifting from code.
- Backward compat promises pre-1.0.

