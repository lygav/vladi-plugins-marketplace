---
title: Launch Mechanics
description: Headless session launching, prompt resolution, and run types
---

# Launch Mechanics

`launch.ts` is the entry point for starting headless domain squad sessions. It resolves a prompt, initializes the signal protocol, and spawns a detached Copilot session in the team's workspace.

## Prompt Resolution Chain

Launch resolves the team prompt using a 4-tier priority chain. The first tier that produces a non-empty string wins—no fallthrough chaining.

```
Priority 1: --prompt "string"          CLI flag, literal prompt
     │
     │  (not set?)
     ▼
Priority 2: --prompt-file ./path.md    CLI flag, file contents
     │
     │  (not set?)
     ▼
Priority 3: .squad/launch-prompt.md    Team-level template in workspace
     │
     │  (not found?)
     ▼
Priority 4: Generic fallback           Built-in minimal prompt
```

### Template Interpolation

Tier 3 (`.squad/launch-prompt.md`) supports placeholder interpolation:

| Placeholder | Replaced with | Example value |
|-------------|---------------|---------------|
| `{team}` | Domain name | `team-alpha` |
| `{runType}` | Detected run type | `first-run` |
| `{playbookSkill}` | Config playbook skill | `domain-playbook` |

Example template:
```markdown
You are team {team}. Follow the {playbookSkill} skill.
This is a {runType}. Read DOMAIN_CONTEXT.md for your mission.
Check .squad/signals/inbox/ for directives first.
Report progress to .squad/signals/status.json.
```

## RunType Detection

```typescript
type RunType = 'first-run' | 'refresh' | 'reset';
```

Detection logic:

```
.squad/signals/status.json exists?
  ├── NO  → 'first-run'  (never been launched)
  └── YES
       └── --reset flag passed?
            ├── YES → 'reset'   (clear state, start fresh)
            └── NO  → 'refresh' (prior state exists, incremental)
```

**Reset mode** (`--reset`) clears:
1. Removes `status.json`
2. Clears inbox `.ack` files (not the directives themselves)
3. Runs cleanup hook if present (`.squad/cleanup-hook.sh` or `.squad/cleanup-hook.ts`)
4. Commits the cleanup

## OTel MCP Injection

When `telemetry.enabled` is true in config, the launch script injects an OTel MCP server configuration for the domain session:

```typescript
const mcpConfig = {
  mcpServers: {
    otel: {
      command: 'npx',
      args: ['tsx', 'scripts/mcp-otel-server.ts'],
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
        OTEL_SERVICE_NAME: `squad-${domain}`,
        SQUAD_DOMAIN: domain,
      },
    },
  },
};
```

This gives every domain session access to `otel_span`, `otel_metric`, `otel_event`, and `otel_log` tools without per-team configuration.

## CLI Reference

```bash
npx tsx scripts/launch.ts --team <name>                    # launch single team
npx tsx scripts/launch.ts --team <name> --reset            # clear state, relaunch
npx tsx scripts/launch.ts --team <name> --step <step>      # run single step
npx tsx scripts/launch.ts --team <name> --prompt "do X"    # override prompt
npx tsx scripts/launch.ts --team <name> --prompt-file X.md # prompt from file
npx tsx scripts/launch.ts --teams a,b,c                    # launch multiple
npx tsx scripts/launch.ts --all                            # launch all active teams
npx tsx scripts/launch.ts --all --non-interactive --output-format json  # ADR-001 mode
```

### ADR-001 Flags

For skill integration and CI use, `launch.ts` supports:

- `--non-interactive` — Accepted for consistency (launch is always non-interactive)
- `--output-format json` — Produces structured `LaunchResult` JSON instead of human-readable text

### Headless Process Spawn

The spawned Copilot process uses `stdio: ['pipe', logFile, logFile]` with stdin closed immediately after spawn. This avoids TTY issues that previously caused 0-byte log files when using `'inherit'` or `'ignore'` for stdin.

Each log file begins with a debug header:
```
# launch.ts — 2025-01-15T10:30:00.000Z
# cwd: /path/to/.worktrees/backend-api
# cmd: copilot -p "..." --yolo --no-ask-user --autopilot
```

### Launch Guards

Teams with `status: "paused"` or `status: "retired"` are automatically skipped. In `--all` mode, the count of skipped teams is reported. In targeted mode (single `--team`), each skipped team produces a warning or a JSON result with `skipped: true`.

For a complete scripts listing, see [Scripts Reference](/vladi-plugins-marketplace/reference/scripts).

## Related Pages

- [Architecture Overview](/vladi-plugins-marketplace/reference/architecture) — System design and placement abstractions
- [Scripts Reference](/vladi-plugins-marketplace/reference/scripts) — All automation scripts
- [Monitoring](/vladi-plugins-marketplace/guides/monitoring) — Observing launched teams
