---
title: Teams Presence
description: Give your AI leadership squad a live presence in Microsoft Teams
---

# Teams Presence

Your meta-squad becomes a real participant in a Microsoft Teams channel. Address it by name — `@artemis launch the frontend team` — and get a response in-thread. It's like having your AI team lead sitting in the channel, ready to execute federation commands, relay directives, and report status.

Under the hood, a persistent background process bridges Teams and a Copilot ACP session. Messages go in, results come back, all visible to the whole team.

## How It Works

`teams-presence.ts` runs as a long-lived background process with a simple loop:

1. **Poll** the Teams channel via Microsoft Graph API (default: every 30 seconds)
2. **Filter** for messages addressing `@<federationName>`
3. **Pipe** the instruction to a persistent Copilot ACP session
4. **Post** the result back as a thread reply
5. **Advance** the watermark so no message is processed twice

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User types   │     │  Graph API   │     │   Copilot    │     │  Graph API   │
│  @artemis ... │ ──▶ │  poll picks  │ ──▶ │  ACP session │ ──▶ │  posts reply │
│  in Teams     │     │  it up       │     │  executes    │     │  to thread   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

The watermark is persisted to disk (`.squad/teams-watermark.json`), so restarting the process won't replay old messages.

## Setup

Teams presence is configured during federation setup. The skill asks whether you want Teams integration and collects the required IDs.

### What You Need

1. **Team ID** — the GUID of your Teams workspace
2. **Channel ID** — the `19:...@thread.tacv2` identifier for the channel
3. **Federation name** — this becomes the `@handle` (e.g., `@artemis`)

### Resulting Config

After setup, your `federate.config.json` includes:

```json
{
  "federationName": "artemis",
  "teamsConfig": {
    "teamId": "abc-123-def-456",
    "channelId": "19:xyz-789@thread.tacv2"
  },
  "copilotCommand": "copilot"
}
```

The presence process starts automatically once setup completes with Teams enabled.

### Introduction Message

When setup finishes, the squad posts an introduction to the channel:

> 👋 **artemis** is online.
> I'm your AI leadership squad. Mention `@artemis` followed by an instruction and I'll handle it.

## Usage

### Talking to Your Squad

Type messages in the configured Teams channel. Prefix with your federation name:

```
@artemis what's the status of all teams?
```

```
@artemis launch the frontend team
```

```
@artemis pause backend
```

```
@artemis tell infra to focus on the auth module
```

```
@artemis sweep learnings across all domains
```

Anything after the `@<name>` is treated as a natural-language instruction and forwarded to the Copilot session.

### What Happens

1. **Acknowledge** — the presence immediately replies in-thread:
   > 👋 Got it, Vladi. Working on: *launch the frontend team*...
2. **Execute** — the instruction runs in the persistent Copilot ACP session
3. **Report** — the result posts back as a thread reply with the output

If execution fails, the error is posted to the thread so you see it directly in Teams.

## Managing Presence

### Starting

The presence auto-starts during federation setup when `teamsConfig` is present. To start manually:

```bash
npx tsx scripts/teams-presence.ts
```

With a custom poll interval (seconds):

```bash
npx tsx scripts/teams-presence.ts --interval 15
```

### Checking Status

```bash
npx tsx scripts/teams-presence.ts --status
```

Reports whether the process is running, the PID, last poll time, and watermark position.

### Stopping

Cross-platform stop script:

```bash
node stop-presence.js
```

Or directly:

```bash
npx tsx scripts/teams-presence.ts --stop
```

Both read the PID from `.squad/presence.pid` and terminate the process.

### Single Poll (Testing)

Run one poll cycle and exit — useful for debugging:

```bash
npx tsx scripts/teams-presence.ts --once
```

## Requirements

| Requirement | Why |
|---|---|
| `az` CLI, logged in | Graph API tokens via `az account get-access-token` |
| `copilot` CLI available | ACP session for executing instructions |
| Teams channel access | Read/write messages in the configured channel |
| `federationName` in config | Determines the `@handle` to filter for |

## Architecture

The presence process has two layers:

### Graph API Layer (Eyes & Mouth)

Fast, deterministic code that handles polling and posting. No AI involved.

- Calls `ListChannelMessages` with a watermark to get new messages
- Filters for `@<federationName>` mentions
- Posts acknowledgments and results via `PostChannelMessage` / `ReplyToChannelMessage`
- Authenticates with `az account get-access-token --resource https://graph.microsoft.com`

### ACP Layer (Brain)

A persistent Copilot session via the Agent Client Protocol. One session handles all instructions — no process spawn per message.

- Session stays alive between polls
- Full federation context available (config, team state, signals)
- Executes the same commands you'd run in a local Copilot conversation

### Files

| File | Purpose |
|---|---|
| `.squad/teams-watermark.json` | Last processed message timestamp — prevents replay |
| `.squad/presence.pid` | PID of the running presence process |
| `.squad/presence.log` | Stdout/stderr from the background process |

## Copilot Command

If your environment uses a wrapper or custom path to launch Copilot, set `copilotCommand` in `federate.config.json`:

```json
{
  "copilotCommand": "my-corporate-wrapper copilot"
}
```

The presence process uses this value when spawning the ACP session. Defaults to `"copilot"` if omitted.
