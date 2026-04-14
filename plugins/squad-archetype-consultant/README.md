# squad-archetype-consultant

**Domain expert consultant teams** — Deeply understand codebases and specialized domains, then answer questions accurately and concisely.

## Overview

The consultant archetype creates teams that act as **domain experts** for specific codebases or areas of knowledge. Unlike other archetypes that produce deliverables, consultants build expertise over time and provide answers on demand.

**Use when:**
- You need teams that can answer questions about complex codebases
- You want to distribute domain expertise across multiple specialized teams
- You have recurring questions about architecture, APIs, debugging, or conventions

**Don't use when:**
- You need a one-time deliverable (use deliverable archetype)
- You're building something from scratch (use task-based archetype)
- Questions are simple lookups (just grep the codebase)

## Structure

This archetype follows the **meta/team split pattern**:

```
squad-archetype-consultant/
├── archetype.json           # Top-level manifest with state machine
├── plugin.json              # Plugin metadata with meta/team sections
├── README.md                # This file
├── meta/                    # Meta-squad orchestration
│   ├── skills/
│   │   ├── consultant-setup/          # Setup wizard (meta runs this)
│   │   ├── consultant-monitoring/     # Monitoring interpretation
│   │   └── consultant-triage/         # Problem diagnosis
│   └── scripts/
│       ├── consultant-monitor.ts      # Mechanical data collection
│       └── consultant-triage.ts       # Problem detection
└── team/                    # Domain team execution
    ├── archetype.json       # Team-level archetype metadata with state machine
    ├── skills/
    │   ├── consultant-playbook/       # Playbook teams follow
    │   └── consultant-recovery/       # Recovery procedures
    └── templates/
        ├── launch-prompt-first.md
        ├── launch-prompt-refresh.md
        ├── launch-prompt-reset.md
        └── cleanup-hook.sh
```

## Lifecycle

Consultant teams progress through these states:

### Lifecycle States

1. **onboarding** — Team is being initialized by meta-squad
2. **indexing** — Reading and analyzing the target codebase, building knowledge
3. **ready** — Steady state, waiting for questions (the primary operational mode)
4. **researching** — Actively researching an answer to a received question
5. **waiting-for-feedback** — Needs human clarification before answering

### Terminal States

- **retired** — Consultant is no longer needed (domain archived, consultant replaced)
- **failed** — Unrecoverable error (access lost, repeated crashes)

**Note:** Unlike other archetypes, "ready" is not a terminal state — it's the consultant's steady loop.

## Signal Protocol

Consultants use the signal protocol for Q&A:

**Inbox** (`.squad/signals/inbox/`):
- Meta-squad writes questions as signals with `type="question"`
- Format: `{timestamp}-question-{subject-slug}.json`

**Outbox** (`.squad/signals/outbox/`):
- Consultant writes answers as signals with `type="report"`
- Format: `{timestamp}-report-{subject-slug}.json`

**Status** (`.squad/signals/status.json`):
- Tracks current state, progress, last update

## Configuration

Setup wizard (`.squad/archetype-config.json`) asks:

1. **Domain** — What area of expertise does this consultant cover?
2. **Codebase Location** — Repo URL, local path, or documentation set
3. **Question Types** — Architecture, APIs, debugging, conventions, etc.
4. **Indexing Depth** — surface (5-10min) | moderate (15-30min) | deep (1+ hour)
5. **Proactive Insights** — Should consultant share unsolicited discoveries?

## Monitoring

Run the monitor to track consultants:

```bash
npx tsx scripts/meta/consultant-monitor.ts
npx tsx scripts/meta/consultant-monitor.ts --watch
```

Displays:
- Current state (indexing/ready/researching)
- Questions answered count
- Last activity timestamp
- Domain coverage depth
- Idle time

Health indicators:
- ✅ Healthy: In "ready" state, actively answering questions
- ⚠️ Warning: Idle > 3 days, or stuck in researching
- ❌ Critical: Failed state, or no indexing progress > 30min

## Triage & Recovery

When problems occur, run triage:

```bash
npx tsx scripts/meta/consultant-triage.ts
```

Common problems detected:
- **Stuck indexing** — No progress > 20 minutes
- **Stale consultant** — No questions answered in 7+ days
- **Knowledge gaps** — Repeated "I don't know" responses
- **Routing errors** — Questions sent to wrong consultant

Recovery procedures documented in `team/skills/consultant-recovery/SKILL.md`.

## Example Workflow

1. **Setup**: "Configure consultant for authentication domain"
2. **Onboard**: Meta-squad creates worktree, initializes team
3. **Index**: Team reads `src/auth/`, logs patterns and conventions
4. **Ready**: Team waits in steady state
5. **Question arrives**: "How does JWT refresh work?"
6. **Research**: Team searches learnings, reads `jwt-refresh.ts`, formulates answer
7. **Answer**: Writes detailed response to outbox with code examples
8. **Back to ready**: Logs Q&A pair, returns to waiting state

## Installation

Auto-installed by `squad-federation-core`'s setup wizard. Manual:

```bash
copilot plugin install squad-archetype-consultant@vladi-plugins-marketplace
```

## Requires

- [squad-federation-core](../squad-federation-core/) >=0.4.0

## Testing

Run contract tests to validate archetype structure:

```bash
npm test consultant.contract.test.ts
```

## Customization

After scaffolding, you can:

1. **Customize monitor script** — Add archetype-specific health checks in `meta/scripts/consultant-monitor.ts`
2. **Flesh out playbook** — Add detailed workflow steps in `team/skills/consultant-playbook/SKILL.md`
3. **Tailor setup wizard** — Update configuration questions in `meta/skills/consultant-setup/SKILL.md`
4. **Add failure patterns** — Define triage diagnostics in `meta/skills/consultant-triage/SKILL.md`

## License

MIT
