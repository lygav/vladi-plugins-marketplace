---
title: Introduction
description: What is Squad Federation and how does it work
---

# Squad Federation

Squad Federation is a **transport-agnostic federated team orchestration system** that enables AI agents to work autonomously across multiple teams while maintaining clean separation of concerns.

## What is Squad Federation?

Squad Federation solves the challenge of coordinating multiple autonomous AI teams working on different aspects of a project. Instead of having a single monolithic agent try to handle everything, you can create specialized teams that each focus on their domain — frontend, backend, infrastructure, testing, documentation — and let them work in parallel.

## Core Concepts

### Three-Layer Architecture

Squad Federation operates on three distinct layers:

1. **SDK Layer** - TypeScript interfaces, Zod schemas, and base classes that define the contracts
2. **Lib Modules** - Concrete implementations of placement strategies, communication protocols, registry management, and knowledge sharing
3. **Scripts** - Entry points for onboarding teams, launching sessions, monitoring progress, and managing knowledge

### Placement vs Communication

The v0.4.0 architecture introduced a critical separation:

**Placement** (per-team): WHERE team files live
- Git worktrees in `.worktrees/`
- Standalone directories
- Custom storage backends

**Communication** (federation-scoped): HOW teams exchange messages
- File-based signals (`.squad/signals/inbox` and `outbox`)
- Microsoft Teams channels with hashtag protocol
- Custom communication adapters

This separation allows you to mix placement strategies within a single federation — some teams in git worktrees, others in directories — while all teams use the same communication protocol.

### Team Archetypes

Every team operates according to an **archetype** — a predefined lifecycle with states, skills, and behaviors:

- **Coding** - Build features, write tests, refactor code
- **Deliverable** - Create structured outputs (reports, specs, schemas)
- **Consultant** - Analyze problems, provide recommendations

Archetypes define what a team can do and how it progresses through its work.

## Key Features

- **Autonomous Operation** - Teams work independently in headless sessions
- **Signal-Based Coordination** - Teams communicate via structured messages (directives, questions, reports, alerts)
- **Knowledge Management** - Learnings are captured, tagged, and graduated into reusable skills
- **Hybrid Monitoring** - Dashboard shows all team status; archetype monitors provide deep team-specific insights
- **Flexible Deployment** - File-based for local/git workflows, Teams channels for human oversight

## Who Is This For?

Squad Federation is designed for:

- **Software teams** managing complex multi-component projects
- **Platform engineers** coordinating infrastructure, security, and application teams
- **Engineering managers** scaling AI assistance across multiple concurrent workstreams
- **DevOps teams** automating parallel deployment and testing workflows

## Next Steps

- [Install the plugin](/getting-started/installation)
- [Create your first federation](/getting-started/first-federation)
- [Learn about team onboarding](/guides/team-onboarding)
