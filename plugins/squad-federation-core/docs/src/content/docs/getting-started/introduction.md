---
title: Introduction
description: What is Squad Federation and how does it work
---

# Squad Federation

Squad Federation coordinates multiple autonomous AI teams working on different aspects of a project. Talk to Copilot skills to set up teams, launch work, and monitor progress — the system handles the mechanics automatically.

## What Is Squad Federation?

Instead of a single monolithic agent handling everything, you create specialized teams that each focus on their domain — frontend, backend, infrastructure, testing, documentation — and let them work in parallel. Each team has its own workspace, skills, and lifecycle.

## How You Use It

You interact with Squad Federation through **conversational skills** in Copilot:

**Setting up:** "Set up a federation for my project"
→ The setup skill walks you through federation configuration with guided questions.

**Adding teams:** "Onboard a team for auth"
→ The onboarding skill asks what the team should do, discovers the right archetype, and creates the workspace.

**Launching work:** "Launch the auth team"
→ The team starts working in a headless session.

**Monitoring:** "How's my federation doing?"
→ The orchestration skill shows team status and progress.

You don't run scripts manually or create config files by hand. The skills handle those details.

## Core Concepts

### Three Layers

Squad Federation operates on three layers:

**1. Placement** (per-team): WHERE each team's workspace lives
- Git worktrees with dedicated branches
- Standalone directories
- Teams can use different placement types in the same federation

**2. Communication** (federation-scoped): HOW teams exchange messages
- File-based signals (default, fast, local)
- Microsoft Teams channels (human-visible, real-time)
- All teams in a federation use the same communication protocol

**3. Knowledge** (shared): WHAT teams learn and share
- Each team logs discoveries, patterns, and insights
- Cross-team patterns are detected and promoted into reusable skills
- Skills sync to all teams automatically

### Team Archetypes

Each team operates according to an **archetype** — a work pattern that defines what the team does and how it progresses:

- **Deliverable** - Produces file artifacts (reports, specs, audit results, inventories)
- **Coding** - Writes code and opens pull requests
- **Research** - Investigates topics and documents findings
- **Task** - Executes discrete work items

You pick the archetype during onboarding based on what the team needs to do.

## Key Features

- **Conversational setup** - Skills guide you through federation creation, team onboarding, and configuration
- **Autonomous operation** - Teams work independently in headless sessions
- **Signal-based coordination** - Teams send directives, questions, reports, and alerts via structured messages
- **Knowledge lifecycle** - Learnings are captured, swept for patterns, and graduated into shared skills
- **Real-time observability** - Optional OpenTelemetry dashboard shows traces, metrics, and logs from all teams

## Who Is This For?

Squad Federation is designed for:

- **Software teams** managing complex multi-component projects
- **Platform engineers** coordinating infrastructure, security, and application teams
- **Engineering managers** scaling AI assistance across multiple concurrent workstreams
- **DevOps teams** automating parallel deployment and testing workflows

## Next Steps

- [Install the plugin](/vladi-plugins-marketplace/getting-started/installation)
- [Create your first federation](/vladi-plugins-marketplace/getting-started/first-federation)
- [Learn about team onboarding](/vladi-plugins-marketplace/guides/team-onboarding)
