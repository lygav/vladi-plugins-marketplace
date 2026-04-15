---
title: Multi-Team Walkthrough
description: End-to-end walkthrough of a federation with multiple teams using different archetypes
---

# Multi-Team Walkthrough

This walkthrough builds a federation with multiple teams using different archetypes — coding teams that write code, a research team that produces analysis documents, and cross-team knowledge sharing. It picks up from the [Your First Federation](/vladi-plugins-marketplace/getting-started/first-federation) guide, which covers creating a federation with a single coding team.

## The Scenario

You have a portfolio site and want to redesign it as a modern React site with a blog. Your federation already has a `frontend-redesign` coding team working on the React migration. Now you want to expand with additional teams.

## Adding a Research Team

You need a team to evaluate blogging platforms — this isn't code, it's analysis and documentation.

> "I need a research team to investigate blogging platforms for the React site"

The team-onboarding skill activates:

**What's this team's mission?**
> "Evaluate blogging platforms and recommend the best one for our React site"

**Will they be writing code, or producing research/documents?**
> "Research and analysis docs"

**Based on your description, I recommend the 'research' archetype. Sound right?**
> "Yes"

The skill installs the research archetype if needed and creates the workspace:

```
📋 Team Setup Summary:
   Name: blog-research
   Mission: Evaluate blogging platforms
   Archetype: research
   Placement: worktree
   Communication: file-signal
```

The research archetype seeds different templates than coding — research-oriented prompts, analysis templates, and a comparison matrix structure instead of a design→implement→test→PR workflow.

## Adding a Second Coding Team

You want a separate team for the blog feature while `frontend-redesign` wraps up the core site.

> "Spin up a team to implement the blog feature — they'll work on code in this repo"

The onboarding skill walks through the same questions. This team writes code and opens PRs, so it gets the **coding** archetype:

```
📋 Team Setup Summary:
   Name: blog-feature
   Mission: Build blog with article list, detail pages, markdown rendering
   Archetype: coding
   Placement: worktree (branch: squad/blog-feature)
   Communication: file-signal
```

## Federation Layout

With three teams onboarded, your federation looks like:

```
my-project/                              ← main branch (meta-squad)
├── .squad/
│   ├── team.md                          ← meta-squad agents
│   ├── skills/                          ← authoritative skill copies
│   └── learnings/
│       └── log.jsonl                    ← cross-team patterns

my-project-frontend-redesign/            ← squad/frontend-redesign branch
├── .squad/
│   ├── signals/
│   │   └── status.json                  ← state: complete
│   └── learnings/
│       └── log.jsonl

my-project-blog-research/                ← squad/blog-research branch
├── .squad/
│   ├── signals/
│   │   └── status.json                  ← state: scanning
│   └── learnings/
│       └── log.jsonl
├── research/
│   ├── cms-comparison.md                ← research outputs
│   └── integration-plan.md

my-project-blog-feature/                 ← squad/blog-feature branch
├── .squad/
│   ├── signals/
│   │   └── status.json                  ← state: implementing
│   └── learnings/
│       └── log.jsonl
├── src/
│   └── pages/
│       └── Blog.jsx                     ← in progress
```

Git worktrees share the object store — three teams don't consume 3× the disk. They're independent working directories pointing at different branches.

## Unified Monitoring

The meta-squad monitors all teams through the same interface regardless of archetype:

> "How are my teams doing?"

```
📊 Federation Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟢 frontend-redesign        complete
   PR #42 opened (ready for review)

🟡 blog-research            scanning
   Progress: 65%
   Deliverable: cms-comparison.md ready

🟡 blog-feature             implementing
   Progress: 40%
   Building Blog.jsx component

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 Recent Learnings:

  [blog-research] MDX provides best type safety for React blogs
  [blog-feature] Contentlayer integrates cleanly with Next.js

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Cross-Team Directives

Send directives to any team the same way:

> "Tell blog-research to prioritize MDX in their comparison"

> "Tell blog-feature to coordinate with blog-research on the data structure"

Each directive is written to the target team's inbox as a structured JSON signal. The team picks it up at its next step boundary.

## Knowledge Sharing Across Teams

When `blog-research` completes its analysis, its findings can flow to the coding teams:

> "Sync learnings from blog-research to blog-feature"

The knowledge-lifecycle skill reads learnings from the source team and appends them to the target team's learning log. Both teams now share context.

### Graduating Learnings

Teams log discoveries as they work. High-confidence learnings can be promoted into shared skills:

> "What did my teams learn?"

The skill shows all learnings and identifies **graduation candidates** — patterns that apply beyond a single team:

```
📝 Graduation Candidates:
  ✨ "Vite is the modern default for React projects" — applies to any React project
  ✨ "MDX provides type-safe frontmatter for React blogs" — useful for any blog feature
```

> "Graduate the Vite learning into shared skills"

Once graduated, every future team starts with that knowledge. The federation gets smarter over time.

### How Knowledge Flows

```
              ┌────────────────────────┐
              │     MAIN (skills/)     │
              │                        │
         ┌────┤  Authoritative copies  ├────┐
         │    │  of all shared skills  │    │
         │    └───────────▲────────────┘    │
         │                │                 │
   SEED (onboard)     GRADUATE          SYNC (periodic)
         │          (learning→skill)        │
         │                │                 │
         ▼                │                 ▼
  ┌───────────┐    ┌──────┴──────┐   ┌───────────┐
  │ Team A    │    │   sweep +   │   │ Team B    │
  │ skills/   │    │  graduate   │   │ skills/   │
  │ learnings/│────┤   skills    ├───│ learnings/│
  └───────────┘    └─────────────┘   └───────────┘
```

1. **Seed** — New teams inherit all skills from main at onboarding
2. **Sync** — Updated skills on main are pushed to existing teams
3. **Graduate** — Team learnings (validated, cross-domain) become shared skills

## Team Completion Flow

When a coding team finishes its work, the flow looks like:

1. The team opens a PR (for coding archetype teams)
2. Tests are run in the worktree
3. A completion report is written to the team's outbox
4. `status.json` transitions to `complete`

The completion report includes what was built, decisions made, and any blockers encountered. Ask for it:

> "What did the frontend team deliver?"

The orchestration skill reads the outbox report and shows the summary.

## Architecture: What Each Layer Does

The federation is a layered system. Each layer has a clear responsibility:

### Core Layer (squad-federation-core)

The plumbing — zero knowledge of what teams produce, only how they operate.

| Operation | What Core Does |
|-----------|----------------|
| **Onboard** | Creates git branch, worktree, scaffolds signals and learnings directories |
| **Launch** | Resolves prompt, initializes signals, spawns detached Copilot session |
| **Monitor** | Reads `status.json` from all worktrees, displays dashboard |
| **Directive** | Writes JSON message to team's `inbox/` directory |
| **Knowledge** | Learning log per team, cross-team sweep, graduation, sync |

### Archetype Layer (e.g., squad-archetype-coding)

The work pattern — defines **how** a team operates.

| What It Provides | Purpose |
|------------------|---------|
| `launch-prompt.md` | Prompt template with archetype-specific workflow |
| Playbook skill | Step-by-step guide for the team's workflow |
| Cleanup hook | Clears artifacts on reset |

Different archetypes (coding, research, deliverable) provide different prompts and playbooks — but core's operations work identically regardless.

### Signal Flow

```
┌─────────────────────────────────────────────────────────┐
│                  META-SQUAD (main)                       │
│                                                         │
│  Reads status.json ────────────── from each worktree    │
│  Sends directives  ────────────── to inbox/             │
│  Reads reports     ────────────── from outbox/          │
│  Sweeps learnings  ────────────── from learnings/       │
│                                                         │
└──────────┬──────────────────────┬───────────────────────┘
           │                      │
           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐
│ frontend-redesign│   │  blog-research   │
│                  │   │                  │
│ Writes           │   │ Writes           │
│  status.json     │   │  status.json     │
│  outbox/ reports │   │  outbox/ reports │
│  learnings/      │   │  learnings/      │
│                  │   │                  │
│ Reads            │   │ Reads            │
│  inbox/          │   │  inbox/          │
└──────────────────┘   └──────────────────┘
```

## Next Steps

- [Knowledge Lifecycle](/vladi-plugins-marketplace/guides/knowledge-lifecycle) — deep dive on capturing, sweeping, and graduating learnings
- [Monitoring](/vladi-plugins-marketplace/guides/monitoring) — dashboard setup and telemetry
- [Communication Transports](/vladi-plugins-marketplace/guides/communication-transports) — signal protocol details
- [Archetypes Overview](/vladi-plugins-marketplace/archetypes/overview) — available archetypes and when to use each
