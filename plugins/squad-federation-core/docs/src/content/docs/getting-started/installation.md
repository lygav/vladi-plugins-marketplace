---
title: Installation
description: How to install and set up Squad Federation
---

# Installation

Squad Federation is a Claude Code plugin. Install it from the marketplace to enable federation skills in Copilot.

## Prerequisites

Before installing, ensure you have:

- **Squad CLI** installed and initialized (`squad init` must be run in your project)
- **Git** 2.20 or later
- **Node.js** v20 or later
- **Docker** (optional, for observability dashboard)

The federation setup skill checks these automatically when you run it.

## Installation Steps

### 1. Add the Marketplace

```bash
copilot plugin marketplace add lygav/vladi-plugins-marketplace
```

### 2. Install Squad Federation

```bash
copilot plugin install squad-federation-core@vladi-plugins-marketplace
```

### 3. Verify Installation

List your installed plugins:

```bash
copilot plugin list
```

You should see `squad-federation-core` in the output.

## What You Get

The plugin provides these conversational skills:

- **federation-setup** - Creates federation configuration through guided questions
- **team-onboarding** - Onboards new teams with archetype discovery
- **federation-orchestration** - Launches teams, monitors progress, sends directives
- **knowledge-lifecycle** - Manages skill seeding, syncing, and learning graduation

You interact with these through natural language in Copilot. No manual script commands needed.

## Next Steps

You're ready to create your first federation. The setup skill will guide you through:

1. Federation description
2. Telemetry setup (optional observability dashboard)
3. Optional Teams notifications (meta-squad posts summaries to a channel)
4. Meta-squad casting
5. First team onboarding

Start here: [Create your first federation](/vladi-plugins-marketplace/getting-started/first-federation)

## Troubleshooting

### Plugin not found

Check the marketplace is registered:

```bash
copilot plugin marketplace list
```

If `vladi-plugins-marketplace` isn't listed, add it again.

### Prerequisites missing

The federation setup skill validates prerequisites and provides install instructions if anything is missing. You can also check manually:

```bash
squad --version    # Should be 1.2.0 or later
git --version      # Should be 2.20 or later
node --version     # Should be v20.0.0 or later
docker --version   # Optional, for dashboard
```

### Can't run squad init

Make sure you're in a git repository. Squad requires git for agent coordination.

```bash
git rev-parse --is-inside-work-tree
```

If false, initialize git first: `git init`
