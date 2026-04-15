# Vladi's Plugin Marketplace

Personal [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli) plugin marketplace — reusable plugins for AI-assisted development workflows built on [Squad](https://github.com/bradygaster/squad).

[![Documentation](https://img.shields.io/badge/docs-lygav.github.io-blue)](https://lygav.github.io/vladi-plugins-marketplace/)

## Installation

```bash
copilot plugin marketplace add lygav/vladi-plugins-marketplace
copilot plugin marketplace browse vladi-plugins-marketplace
```

## Plugins

### Federation System (v0.7.0)

**Manage multiple permanent AI teams from a single leadership squad** — each with its own worktree, agents, and accumulated knowledge.

```
┌─────────────────────────────────────────────┐
│  PROJECT LAYER                              │
│  Domain playbook · schemas · import hooks   │  ← Your expertise
├─────────────────────────────────────────────┤
│  ARCHETYPE LAYER                            │
│  Team playbook · meta-squad skills          │  ← Work pattern (deliverable/coding/consultant)
├─────────────────────────────────────────────┤
│  CORE LAYER                                 │
│  Worktrees · signals · knowledge · launch   │  ← Infrastructure (archetype-unaware)
└─────────────────────────────────────────────┘
```

| Layer | Plugin | What it owns |
|-------|--------|--------------|
| **Core** | [squad-federation-core](plugins/squad-federation-core/) | Federation config, signal protocol, knowledge flow, OTel, launch, heartbeat |
| **Archetype** | [squad-archetype-deliverable](plugins/squad-archetype-deliverable/) · [squad-archetype-coding](plugins/squad-archetype-coding/) · [squad-archetype-consultant](plugins/squad-archetype-consultant/) | Playbook, state machine, aggregation — auto-installed during setup |
| **Project** | *(your .squad/ dir)* | Domain playbook skills, schemas, import hooks |

**Quick start:**

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```
```
> federate this project
```

The setup wizard handles everything — archetype selection, team casting, telemetry, and optional Teams notifications.

**📖 Full documentation:** [lygav.github.io/vladi-plugins-marketplace](https://lygav.github.io/vladi-plugins-marketplace/)

## License

MIT
