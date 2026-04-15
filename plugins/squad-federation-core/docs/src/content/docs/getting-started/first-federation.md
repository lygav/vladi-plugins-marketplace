---
title: Your First Federation
description: Creating your first federation through conversational skills
---

# Your First Federation

This guide walks you through creating a federation with one team. You'll work through conversational skills in Copilot — no manual scripts or config file editing.

## Step 1: Set Up the Federation

In Copilot, say:

> "Set up a federation"

The federation-setup skill activates and guides you through a series of questions:

**What are you building?**
> "I'm coordinating frontend and backend teams for a web app"

**Want me to set up a monitoring dashboard?**
> "Yes" (if Docker is available, the dashboard starts automatically)

The skill checks your environment (git, Node.js, Squad, Docker), then generates `federate.config.json` with your settings. You see the final config before it saves.

After setup, the meta-squad is cast on the `main` branch — this is the leadership team that coordinates everything. Your project now looks like:

```
my-project/
├── .squad/
│   ├── team.md              ← meta-squad definition
│   ├── skills/              ← shared skills (authoritative copies)
│   └── learnings/
│       └── log.jsonl        ← cross-team patterns (empty)
├── federate.config.json     ← federation config
└── (your existing files)
```

## Step 2: Onboard Your First Team

The setup skill asks if you want to onboard your first team. Say yes:

> "Yes, spin up a team for frontend"

The team-onboarding skill takes over:

**What should this team work on?**
> "Build and test React components in the frontend"

**I'll call this team 'frontend' — sound good?**
> "Yes"

**Will this team write code, or produce file artifacts?**
> "Write code"

**Will they open pull requests?**
> "Yes"

**Based on your answers, I recommend the 'coding' archetype. Sound right?**
> "Yes"

The skill checks if the archetype plugin is installed, installs it if needed, then asks about workspace placement:

**Where should this team's workspace live?**
> "Worktree" (default)

**Summary shown:**
```
📋 Team Setup Summary:
   Name: frontend
   Mission: Build and test React components
   Archetype: coding
   Placement: worktree (inside repo)
   Location: .worktrees/frontend
   Communication: file-signal
   Branch: squad/frontend
```

You confirm, and the team workspace is created. The archetype seeds a launch prompt, playbook skills, and signal protocol into the worktree:

```
my-project-frontend/                     ← squad/frontend branch
├── .squad/
│   ├── team.md                          ← team agents
│   ├── launch-prompt.md                 ← from coding archetype
│   ├── skills/                          ← seeded from main
│   ├── learnings/
│   │   └── log.jsonl                    ← empty, fills during work
│   └── signals/
│       ├── status.json                  ← updated on launch
│       ├── inbox/                       ← directives FROM meta-squad
│       └── outbox/                      ← reports TO meta-squad
├── DOMAIN_CONTEXT.md                    ← team's mission brief
└── (your existing files)
```

## Step 3: Launch the Team

Now that the workspace exists, start the team:

> "Launch the frontend team"

The orchestration skill handles the launch. Behind the scenes:
- A headless Copilot session starts in the team's worktree
- The team reads its mission from `DOMAIN_CONTEXT.md`
- It follows the archetype's playbook (design → implement → test → PR)
- It checks its inbox for directives before each step
- Status updates are written to `.squad/signals/status.json`

You'll see confirmation:
```
✅ Team 'frontend' launched
📍 Running in: .worktrees/frontend
🌿 Branch: squad/frontend
```

The team runs independently — you can close your terminal and it keeps working.

## Step 4: Monitor Progress

Check on your teams anytime:

> "How's my federation doing?"

The orchestration skill shows a dashboard:

```
📊 Squad Federation Dashboard

Team         State       Step              Progress  Updated
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 frontend  scanning    analyzing routes  45%       2m ago
```

You can also ask about a specific team:

> "What's the frontend team doing?"

## Step 5: Send a Directive (Optional)

Guide a team's work:

> "Tell the frontend team to focus on authentication first"

The skill writes a directive signal to the team's inbox. The team reads it at its next step boundary, acknowledges it, and adjusts course.

## Step 6: Review Results

Once the team finishes (state changes to `complete`), ask what it produced:

> "What did the frontend team deliver?"

The skill shows:
- A completion report with what was built
- The pull request (for coding teams)
- Learnings logged during work
- Any questions or alerts sent to the outbox

You can also check what the team learned:

> "What did the frontend team learn?"

The knowledge-lifecycle skill shows learnings and identifies **graduation candidates** — high-confidence discoveries that could benefit future teams. You can promote these into shared skills so every new team starts with that knowledge.

## What's Next?

Now that you have one team running, you can:

**Onboard more teams:**
> "Spin up a team for backend"

**Launch all teams in parallel:**
> "Launch all teams"

**Check knowledge flows:**
> "What have my teams learned?"

**Graduate learnings:**
> "Find cross-team patterns in learnings"

Each of these is handled conversationally through the federation skills.

For a comprehensive walkthrough with multiple teams using different archetypes, see the [Multi-Team Walkthrough](/vladi-plugins-marketplace/guides/multi-team-walkthrough).

## How It Works

While you interact through conversational skills, the system manages files and directories behind the scenes. You can see what was created:

**Team registry:** `.squad/teams.json`

**Team workspace:** `.worktrees/frontend/.squad/`

**Team status:** `.worktrees/frontend/.squad/signals/status.json`

This gives you conversational simplicity with full transparency into the underlying mechanics.

### Key Principles

- **One writer per file** — `status.json` is written only by the team. `inbox/` only by meta-squad. `outbox/` only by the team. No race conditions.
- **Archetypes are swappable** — Core works identically whether the team is coding, researching, or producing deliverables.
- **Knowledge compounds** — Team learnings graduate into shared skills. The federation gets smarter over time.
- **Worktrees are cheap** — Git worktrees share the object store. Ten teams don't consume 10× the disk.

## Next Steps

- [Understand federation setup in detail](/vladi-plugins-marketplace/guides/federation-setup)
- [Learn about team onboarding](/vladi-plugins-marketplace/guides/team-onboarding)
- [Explore communication options](/vladi-plugins-marketplace/guides/communication-transports)
- [Multi-team walkthrough with mixed archetypes](/vladi-plugins-marketplace/guides/multi-team-walkthrough)
