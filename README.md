# Vladi's Plugin Marketplace

Personal [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli) plugin marketplace — reusable plugins for AI-assisted development workflows built on [Squad](https://github.com/bradygaster/squad).

## Installation

```bash
copilot plugin marketplace add lygav/vladi-plugins-marketplace
copilot plugin marketplace browse vladi-plugins-marketplace
```

## Plugins

### Federation System

**Manage multiple permanent AI teams from a single meta-squad** using a three-layer composition architecture.

#### Three-Layer Architecture

```
┌─────────────────────────────────────────────┐
│  PROJECT LAYER                              │
│  Domain playbook · schemas · import hooks   │  ← Your expertise
├─────────────────────────────────────────────┤
│  ARCHETYPE LAYER                            │
│  Team playbook · meta-squad skills          │  ← Work pattern (deliverable/coding/research)
├─────────────────────────────────────────────┤
│  CORE LAYER                                 │
│  Worktrees · signals · knowledge · launch   │  ← Infrastructure (archetype-unaware)
└─────────────────────────────────────────────┘
```

**Core** provides infrastructure. **Archetypes** define work patterns. **Your project** brings domain expertise.

Each layer installs separately and owns its config:

| Layer | Plugin | What it owns | When you install |
|-------|--------|--------------|------------------|
| **Core** | [squad-federation-core](plugins/squad-federation-core/) | `federate.config.json` — worktrees, signal protocol, knowledge flow, OTel monitoring, headless launch | First — setup wizard auto-installs archetype |
| **Archetype** | [squad-archetype-deliverable](plugins/squad-archetype-deliverable/)<br>[squad-archetype-coding](plugins/squad-archetype-coding/)<br>[squad-archetype-consultant](plugins/squad-archetype-consultant/) | `.squad/archetype-config.json` in each team — playbook, state machine, aggregation logic | Auto-installed by core based on work pattern |
| **Project** | *(your .squad/ dir)* | Domain playbook skills, schemas, import hooks | Never — you write this |

**Quick start:** Install core, describe your goal → setup wizard picks the right archetype:

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```
```
> I want to set up a team organization for [your goal]
```

See [squad-federation-core/README.md](plugins/squad-federation-core/README.md) for full walkthrough.

## Creating Your Own Archetypes

Build custom work patterns for teams that don't fit existing archetypes.

```bash
# Guided creation (recommended)
> I want to create a new archetype

# Or scaffold directly
npx tsx plugins/squad-federation-core/scripts/create-archetype.ts \
  --name my-workflow --states "step1,step2,step3" --dry-run
```

See [Creating Archetypes](plugins/squad-federation-core/CREATING_ARCHETYPES.md) for the full guide.

## License

MIT
