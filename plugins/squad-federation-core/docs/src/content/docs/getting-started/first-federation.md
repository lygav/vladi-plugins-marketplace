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

**How should your teams communicate?**
> "File signals" (default, fastest option)

The skill generates `federate.config.json` with your settings and shows you the final config before saving.

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

You confirm, and the team workspace is created automatically.

## Step 3: Launch the Team

Now that the workspace exists, start the team:

> "Launch the frontend team"

The orchestration skill handles the launch. Behind the scenes:
- A headless Copilot session starts in the team's worktree
- The team reads its mission from `DOMAIN_CONTEXT.md`
- It checks its inbox for directives
- It begins scanning the repository
- Status updates are written to `.squad/signals/status.json`

You'll see confirmation:
```
✅ Team 'frontend' launched
📍 Running in: .worktrees/frontend
🌿 Branch: squad/frontend
```

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

The skill writes a directive signal to the team's inbox. The team reads it on its next status update and adjusts its work accordingly.

## Step 6: Review Results

Once the team finishes (state changes to `complete`), ask what it produced:

> "What did the frontend team deliver?"

The skill shows:
- The deliverable file location
- Recent learnings logged by the team
- Any questions or alerts sent to the outbox

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

## How It Works

While you interact through conversational skills, the system manages files and directories behind the scenes. You can see what was created:

**Team registry:** `.squad/teams.json`

**Team workspace:** `.worktrees/frontend/.squad/`

**Team status:** `.worktrees/frontend/.squad/signals/status.json`

This gives you conversational simplicity with full transparency into the underlying mechanics.

### Advanced Use Cases

For advanced use cases like CI/CD integration, you can access the underlying mechanics directly through the files and directories the system creates. All operations that the skills perform are also possible through direct file manipulation, though the conversational interface is recommended for most users.

## Next Steps

- [Understand federation setup in detail](/vladi-plugins-marketplace/guides/federation-setup)
- [Learn about team onboarding](/vladi-plugins-marketplace/guides/team-onboarding)
- [Explore communication options](/vladi-plugins-marketplace/guides/communication-transports)
