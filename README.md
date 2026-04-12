# Vladi's Plugin Marketplace

Personal [Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli) plugin marketplace — reusable plugins for AI-assisted development workflows built on [Squad](https://github.com/bradygaster/squad).

## Installation

```bash
copilot plugin marketplace add lygav/vladi-plugins-marketplace
copilot plugin marketplace browse vladi-plugins-marketplace
```

## Plugins

### Federation System

A three-layer plugin system for managing multiple permanent AI teams from a single meta-squad.

| Plugin | Type | Description |
|--------|------|-------------|
| [squad-federation-core](plugins/squad-federation-core/) | Core | Worktree lifecycle, signal protocol, knowledge flow, OTel observability, headless launch, monitoring. Archetype-unaware plumbing. |
| [squad-archetype-deliverable](plugins/squad-archetype-deliverable/) | Archetype | Scatter-gather teams producing file artifacts. Playbook, schema evolution, aggregation, validation. |
| [squad-archetype-coding](plugins/squad-archetype-coding/) | Archetype | Implementation teams producing pull requests. Playbook, PR coordination, task assignment. |

**Quick start:** Install core, describe your goal, the setup wizard handles the rest:

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```
```
> I want to set up a team organization for [your goal]
```

Core auto-installs the right archetype. See [squad-federation-core/README.md](plugins/squad-federation-core/README.md) for details.

## License

MIT
