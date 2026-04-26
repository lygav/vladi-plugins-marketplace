---
title: "ACP Federation Design"
description: "Design document for ACP-based federated squad orchestration"
---

> **Status:** v0.9 Roadmap · Draft  
> **Author:** Wash (Research)  
> **Last updated:** 2025-07

## 1. Vision

The Agent Client Protocol (ACP) becomes the mechanical orchestration layer for federated squads.

Today, federation relies on file-based signals (inbox/outbox markdown files) and blind process spawning to coordinate teams. ACP replaces this with structured, bidirectional, session-aware communication — the same protocol already proven in `teams-presence.ts` for bridging a single Copilot session to Teams chat.

**Core principle:** Code handles structure, state, and routing. LLM sessions handle creative and analytical work. ACP is the bridge between the two.

This means conversational processes — squad casting, team onboarding, code reviews, directive delivery — can all be driven programmatically through `session/prompt` calls rather than dropped into files and hoped-for.

### ACP primitives we use

| RPC Method | Purpose in Federation |
|---|---|
| `session/new` | Spawn a team session with specific `cwd` and `mcpServers` |
| `session/load` | Resume a team session after crash or coordinator restart |
| `session/list` | Discover running sessions, filter by team workspace (`cwd`) |
| `session/prompt` | Send directive/question to a team session, get response |
| `session/update` | Stream real-time notifications (chunks, tool calls, progress) |

**Protocol:** JSON-RPC over stdio, started with `copilot --acp --yolo`.

Spec: [agent-client-protocol](https://github.com/agentclientprotocol/agent-client-protocol)

---

## 2. Unified Coordinator Architecture

The key insight: **one mechanical coordinator, pluggable input adapters**. The coordinator is a single entry point that manages ACP sessions and relays human-in-the-loop questions. The only thing that changes is where human input comes from.

```
┌─────────────────┐     ┌─────────────────┐
│  Teams Adapter   │     │   CLI Adapter    │
│ (Graph API poll) │     │ (MCP tool call)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         ▼                       ▼
┌──────────────────────────────────────────┐
│           Coordinator (mechanical)        │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │   Input Adapter Interface           │  │
│  │   receive(): { message, replyTo }   │  │
│  │   respond(): send answer back       │  │
│  └─────────────────────────────────────┘  │
│                                           │
│  ┌─────────────────────────────────────┐  │
│  │   Session Manager                   │  │
│  │   route / relay / multiplex         │  │
│  │   question detection & relay        │  │
│  └─────────────────────────────────────┘  │
│         │          │          │            │
│    ACP Session  ACP Session  ACP Session  │
│    (team-a/)    (team-b/)    (team-c/)    │
└──────────────────────────────────────────┘
```

### How the adapters work

**Teams Adapter** — polls Graph API for @mentions, packages them as `{ message, replyTo: channelThread }`. When the coordinator needs human input, it posts the question to the thread and waits for a reply.

**CLI Adapter** — runs as an MCP server that the meta-squad Copilot session calls as a tool (e.g. `federation_prompt("onboard frontend team")`). When the coordinator needs human input, the MCP tool returns the question to the meta-squad session, which relays it to the terminal user.

**The coordinator doesn't know or care which adapter is active.** Session management, ACP orchestration, question detection — all identical. Only the "last mile" to the human differs.

### Two operating modes, same code

| | **Interactive (terminal)** | **Headless (Teams)** |
|---|---|---|
| **Human channel** | Terminal via meta-squad session | Teams channel via Graph API |
| **Adapter** | MCP tool handler | Graph API poller |
| **Coordinator** | Same | Same |
| **ACP sessions** | Same | Same |
| **Question relay** | MCP response → session → terminal | Graph API → channel reply |

Future adapters (Slack, Discord, webhook) plug in without touching coordinator logic.

---

## 3. What Becomes Possible

### Remote squad casting

Coordinator spawns an ACP session in a team workspace, drives the multi-turn casting conversation programmatically, and relays "hire this team?" back to the human for approval. No more hoping a spawned process finds the right files.

### Direct prompt delivery

Replace file-based signals (inbox/outbox markdown) with `session/prompt`. Messages arrive instantly, responses are structured, and the coordinator knows exactly when delivery succeeded.

### Session persistence and crash recovery

`session/list` discovers all running sessions (filterable by `cwd`). `session/load` resumes a session after coordinator restart. No more lost state when a process crashes — the session survives.

### Real-time monitoring

`session/update` streams give the coordinator (and by extension the human) visibility into what each team is doing — tool calls, reasoning chunks, progress updates — without polling files.

### MCP server injection

`session/new` accepts an `mcpServers` configuration. Each team session can be provisioned with exactly the tools it needs — its domain's MCP servers, shared federation tools, monitoring endpoints.

### Multi-turn orchestration

Code drives complex workflows step by step:

```
onboard team → cast specialists → configure tools → verify setup → report ready
```

Each step is a `session/prompt` call. The coordinator inspects the response, decides the next step, and continues. Branching, retries, and error handling are all in code.

---

## 4. Architecture

### The coordinator IS the federation runtime

The coordinator is an MCP server — the single tool surface for all federation operations. Any Copilot session that connects to it gets the full federation toolkit. No scripts to memorize, no file conventions to follow.

```
┌─────────────────────────────────────────────────────────┐
│              Coordinator MCP Server                      │
│              (the federation runtime)                    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Domain tools (high-level, mechanical workflows)   │  │
│  │                                                    │  │
│  │  onboard_team    launch_team     retire_team       │  │
│  │  list_teams      send_directive  get_team_status   │  │
│  │  sync_skills     propagate_skill list_skills       │  │
│  │  graduate_learning federation_health               │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Session tools (low-level ACP plumbing)            │  │
│  │                                                    │  │
│  │  session_create   session_prompt  session_list     │  │
│  │  session_load     session_destroy                  │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  State (in-memory + persisted)                     │  │
│  │                                                    │  │
│  │  Session registry    Team configs    Skill index   │  │
│  │  federate.config     casting state   watermarks    │  │
│  └────────────────────────────────────────────────────┘  │
│                          │                               │
│         ┌────────────────┼────────────────┐              │
│         ▼                ▼                ▼              │
│    ACP Session      ACP Session      ACP Session        │
│    (team-a cwd)     (team-b cwd)     (team-c cwd)       │
└─────────────────────────────────────────────────────────┘
```

### Tool layers

**Domain tools** — high-level mechanical workflows. Each is a deterministic state machine composed from low-level session tools. The coordinator knows the PROCEDURE; the LLM in the child session does the WORK.

```typescript
// Domain tools — deterministic, no reasoning required
onboard_team({ name, cwd, archetype })
  → read config for MCP servers and prompt template
  → session_create({ cwd, mcpServers })
  → session_prompt(sid, ONBOARD_TEMPLATE.render({ name, archetype }))
  → monitor for relay_question calls → relay to caller
  → update registry when done

launch_team({ name, directive })
  → lookup team in registry
  → session_load(sid) or session_create if expired
  → session_prompt(sid, directive)

retire_team({ name })
  → session_prompt(sid, "wrap up and archive")
  → session_destroy(sid)
  → update registry, mark inactive
```

**Session tools** — low-level ACP plumbing. Thin wrappers around ACP JSON-RPC calls. Available for advanced use cases where the caller needs direct control.

### Who reasons, who routes

The coordinator **never reasons**. It executes mechanical workflows and routes messages. LLM reasoning happens in two places:

| Mode | Who reasons | How it connects |
|---|---|---|
| **Interactive** | Meta-squad Copilot session | Connects to coordinator as MCP server |
| **Headless** | Meta-squad ACP session (the "brain") | Coordinator spawns it, feeds Teams messages to it |

In interactive mode, the human types "onboard frontend team" → the meta-squad session (LLM) reasons about it → calls `onboard_team({ name: "frontend", cwd: "...", archetype: "feature" })` → coordinator executes mechanically.

In headless mode, the human types "@artemis onboard frontend team" in Teams → coordinator forwards to the meta-squad ACP brain session → brain reasons → calls `onboard_team(...)` → coordinator executes mechanically.

### Question relay via injected MCP tool + server notifications

The coordinator injects its own MCP server into each child ACP session (via `mcpServers` in `session/new`). This server provides a `relay_question` tool:

```typescript
// Injected into every child ACP session
relay_question({ 
  question: "Hire this team? Mal, Kaylee, Wash, Zoe",
  choices: ["Yes, hire this team", "Add someone", "Change a role"]
})
```

When the child session needs human input, it calls `relay_question` instead of `ask_user`. **Deterministic detection, zero heuristics.** The coordinator then relays the question **up to the meta-squad session** using MCP server notifications (not directly to the human):

```
Child ACP session
  │  calls relay_question("Hire this team?")
  ▼
Coordinator (holds relay_question open)
  │  sends MCP server notification to meta-squad
  ▼
Meta-squad session (LLM — reasons about the question)
  │  contextualizes: "Frontend team wants to confirm their roster"
  │  calls ask_user() → human answers
  │  calls answer_relay({ teamId, answer })
  ▼
Coordinator (returns answer to relay_question)
  │
  ▼
Child ACP session (continues with the answer)
```

**The coordinator never talks to the human.** It pushes questions up to the meta-squad, which decides how to handle them:

- **Ask the user** — contextualize and relay via `ask_user` (interactive) or Teams (headless)
- **Answer autonomously** — if the meta-squad already knows the answer
- **Defer** — queue the question for later if the human is unavailable

The child session gets instructions to use `relay_question` as part of its init prompt. The meta-squad sees all questions from all teams — it's the single point of human interaction.

### Session lifecycle

| Phase | ACP Call | Coordinator Action |
|---|---|---|
| **Create** | `session/new` | Set `cwd`, inject `mcpServers` (including relay tool) |
| **Work** | `session/prompt` | Forward directives, receive responses |
| **Relay** | (injected MCP) | `relay_question` → route to human → return answer |
| **Monitor** | `session/update` | Stream tool calls, chunks, progress |
| **Handoff** | `session/prompt` | Final summary, capture output |
| **Done** | — | Remove from registry, archive session ID |

---

## 5. Migration Path

### Current architecture (v0.7)

```
launch.ts spawns blind child_process
  → process writes to outbox/ files
  → coordinator polls inbox/ files
  → no crash recovery, no real-time visibility
```

### Phase 1 — v0.8 (done)

`teams-presence.ts` uses ACP to bridge a single Copilot session to Teams. Proves the protocol works for human-in-the-loop orchestration.

### Phase 2 — v0.9 (this design)

Coordinator manages team sessions via ACP:
- `launch.ts` replaced with ACP `session/new` calls
- Directives delivered via `session/prompt` instead of file writes
- `session/update` provides real-time monitoring
- File-based signals become optional fallback for environments without ACP

### Phase 3 — v1.0

Full ACP orchestration:
- All inter-team communication through ACP sessions
- File signals deprecated (kept read-only for backward compat)
- Session persistence enables crash recovery by default
- Multi-coordinator support (multiple humans, one federation)

### Backward compatibility

File-based signals remain readable throughout. Teams that haven't migrated to ACP can still be reached via the existing inbox/outbox mechanism. The coordinator detects which mode a team supports and routes accordingly.

---

## 6. Open Questions

| # | Question | Notes |
|---|---|---|
| 1 | ~~Question detection~~ | **Resolved** — injected `relay_question` MCP tool, fully deterministic |
| 2 | Session concurrency limits? | How many ACP sessions can one coordinator manage? Need benchmarking |
| 3 | Child session crash handling? | `session/list` can detect missing sessions; restart policy needed |
| 4 | One ACP process per team or shared? | One-per-team is simpler; shared saves resources |
| 5 | Session timeout policy? | Idle sessions should be reclaimed; what threshold? |
| 6 | Cross-machine federation? | ACP is stdio-local; remote teams need a network transport layer |
| 7 | Audit trail? | Should session transcripts be persisted for post-hoc review? |
| 8 | Coordinator startup in headless mode | Who spawns the meta-squad "brain" ACP session? Same process? |
| 9 | MCP server lifecycle | Does coordinator MCP server run standalone, or embedded in `teams-presence`? |
| 10 | Replaces current MCP server? | Today's `mcp-otel-server.ts` handles OTel — merge into coordinator, or keep separate? |

---

## References

- [Agent Client Protocol spec](https://github.com/agentclientprotocol/agent-client-protocol)
- `plugins/squad-federation-core/src/teams-presence.ts` — existing ACP integration
- `plugins/squad-federation-core/src/launch.ts` — current process spawning (to be replaced)
