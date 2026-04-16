---
name: "federation-orchestration"
description: "The user wants to manage an EXISTING federation — launch teams, monitor progress, send directives, sync skills, retire/pause/resume teams, or understand how the federation works. Only activates when federate.config.json already exists. Triggers on: launch team, monitor teams, send directive, sync skills, sweep learnings, how does federation work, federation architecture, manage my teams, retire team, pause team, resume team, decommission team, shut down team, suspend team, reactivate team."
version: "0.2.0"
---

## Purpose

Thin conversational wrapper around federation management scripts (ADR-001 script-drives-skill model). This skill identifies what the user wants, collects any missing parameters conversationally, then delegates ALL mechanical work to scripts via `--non-interactive --output-format json`.

**Skill owns:** conversational flow, parameter collection, presenting results.
**Scripts own:** all logic — team launching, monitoring, offboarding, heartbeat management.

## Prerequisites

**Check that `federate.config.json` exists in the project root.** If not:
> "Federation isn't configured yet. Let me run the setup wizard first."

Redirect to the `federation-setup` skill.

## Bootstrap

Before running any scripts:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs
```

## Delegation Model

The meta-squad is a **leadership team**. When a user asks the meta-squad to get work done, the meta-squad MUST delegate to domain teams — never do the work itself. Every request to "do work" gets delegated to the appropriate domain team. If that team doesn't exist yet, onboard it first via the `team-onboarding` skill.

## Operations

### Launch a Team

When the user says "launch payments", "start the auth team", "kick off all teams":

1. Identify team name (or `--all`)
2. Ask if this is a fresh start, a reset, or resuming from a specific step

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team <name> --non-interactive --output-format json
```

Variants:
```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --all --non-interactive --output-format json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team <name> --step <step> --non-interactive --output-format json
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/launch.ts --team <name> --reset --non-interactive --output-format json
```

Parse JSON output and present: team name, PID, run type, log file location.

### Monitor Teams

When the user says "how are my teams doing", "check status", "show dashboard":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts --non-interactive --output-format json
```

Parse JSON output and present a summary table: team name, state, step, progress, last update, any errors.

### Send a Directive

When the user says "tell payments to skip legacy-utils", "send directive to auth":

1. Identify target team
2. Collect the directive message

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/monitor.ts --send <team> --directive "<message>" --non-interactive --output-format json
```

Parse JSON output and confirm: signal ID, team, directive text.

### Retire a Team

When the user says "retire payments", "decommission the auth team", "shut down payments":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team <name> --mode retire --non-interactive --output-format json
```

For force mode: add `--force`. Parse JSON and present: learnings graduated, signals archived, worktree removed.

### Pause a Team

When the user says "pause team alpha", "suspend alpha", "put alpha on hold":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team <name> --mode pause --non-interactive --output-format json
```

### Resume a Team

When the user says "resume alpha", "reactivate alpha", "unpause alpha":

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/bootstrap.mjs && npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/offboard.ts --team <name> --mode resume --non-interactive --output-format json
```

### Heartbeat Management

The heartbeat is a background daemon. These are operational commands, run directly:

| User says | Command |
|-----------|---------|
| "start heartbeat" | `npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts` |
| "start heartbeat every 60s" | `npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --interval 60` |
| "stop heartbeat" | `npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --stop` |
| "heartbeat status" | `npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --status` |
| "run one heartbeat check" | `npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/meta-heartbeat.ts --once` |

## Architecture Reference

Two layers: **Meta-squad** (coordinator on `main`) and **Domain squads** (each on `squad/{domain}` branch in a worktree).

Communication via signal protocol (see `inter-squad-signals` skill):
- **status.json** — domain writes current state; meta-squad reads
- **inbox/** — meta-squad writes directives; domain reads
- **outbox/** — domain writes reports/questions; meta-squad reads

## Refresh vs Reset

- **Refresh** (`--step <name>`): preserves earlier work. Use when a step failed.
- **Reset** (`--reset`): wipes outputs and signals. Use when data is fundamentally stale.

## Error Handling

- Failed domain → check JSON `error` field → retry with `--step`
- Stale domain (>30min no update) → re-launch with `--step`
- Corrupted worktree → offboard (retire) and re-onboard

## Teams Notifications

When `teamsConfig` is present in `federate.config.json`, the skill posts status updates and directive summaries to a Microsoft Teams channel.

```json
{
  "teamsConfig": {
    "teamId": "abc-123",
    "channelId": "19:xyz@thread.tacv2"
  }
}
```

After running `monitor.ts` and parsing the JSON output, if `teamsConfig` is present:
1. Use `PostChannelMessage` MCP tool to post the status summary to `teamsConfig.teamId` / `teamsConfig.channelId`
2. Use `ListChannelMessages` MCP tool to check for messages addressing `@<federationName>` in the channel
3. If a message addressing the federation persona is found, parse the instruction and send it to the target team via `monitor.ts --send`

## Teams Notifications (MCP Integration)

When `teamsConfig` is present in `federate.config.json`, the meta-squad MUST also post to Teams after producing any status summary, directive relay, or heartbeat report. Teams is a **notification channel** for the human operator — it does NOT replace file signals between teams.

### When to Post to Teams

Post to Teams whenever you:
- Produce a federation status summary (dashboard view)
- Relay a directive to a domain team
- Complete a heartbeat cycle
- Detect a team failure, alert, or stall

### How to Post a Summary

Use the **PostChannelMessage** MCP tool:

```
Tool: PostChannelMessage
Parameters:
  teamId: <value from federate.config.json → teamsConfig.teamId>
  channelId: <value from federate.config.json → teamsConfig.channelId>
  content: <your formatted summary>
```

Format the content as a concise status block:

```
🏢 Federation Status Update

Team         State       Step              Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ infra     complete    —                 100%
🔍 frontend  scanning    auth module       45%
❌ backend   failed      analyzing routes  65%

⚠️ Alerts: backend failed — timeout on route analysis
```

### How to Poll for User Directives

Use the **ListChannelMessages** MCP tool to check for messages addressing the federation persona (`@<federationName>` from `federate.config.json`):

```
Tool: ListChannelMessages
Parameters:
  teamId: <value from federate.config.json → teamsConfig.teamId>
  channelId: <value from federate.config.json → teamsConfig.channelId>
  top: 10
```

After retrieving messages, filter for those containing `@<federationName>` in their body content. Parse the instruction text (everything after `@<name>`) and act on it as if the user typed it directly. Examples (assuming federation name is "artemis"):

- `@artemis tell frontend to skip legacy utils` → send a directive signal to the frontend team
- `@artemis pause backend` → pause the backend team
- `@artemis restart infra` → relaunch the infra team

### Conditional Logic

```
1. Read federate.config.json
2. If teamsConfig is present AND has both teamId and channelId:
   a. After every summary → call PostChannelMessage
   b. During heartbeat/monitoring → call ListChannelMessages, filter for @<federationName>
3. If teamsConfig is absent → skip Teams integration silently
```

## Heartbeat Management

**Directive polling:** Periodically check the Teams channel for messages addressing `@<federationName>` to allow team members to steer domain squads from Teams without accessing the CLI.
