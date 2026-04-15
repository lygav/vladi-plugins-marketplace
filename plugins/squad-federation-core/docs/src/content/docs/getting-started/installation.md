---
title: Installation
description: How to install and set up Squad Federation
---

# Installation

Squad Federation is distributed as a Claude Code plugin. Follow these steps to install it in your project.

## Prerequisites

- **Claude Code CLI** or Claude Desktop with plugin support
- **Git** installed and configured
- **Node.js** 18+ (for running TypeScript scripts)
- **GitHub CLI** (`gh`) configured and authenticated (for PR creation features)

## Installation Steps

### 1. Clone the Marketplace Repository

```bash
git clone https://github.com/lygav/vladi-plugins-marketplace.git
cd vladi-plugins-marketplace
```

### 2. Install Dependencies

The federation scripts require npm dependencies:

```bash
cd plugins/squad-federation-core
npm install
```

This installs TypeScript, Zod validation, and other runtime dependencies.

### 3. Link the Plugin (Claude Code)

If you're using Claude Code CLI with plugins support, symlink or copy the plugin to your plugins directory:

```bash
# Claude Code plugin directory (adjust path as needed)
ln -s $(pwd)/plugins/squad-federation-core ~/.claude/plugins/squad-federation-core
```

Alternatively, add the marketplace to your Claude Code plugin search paths.

### 4. Verify Installation

Check that the plugin is recognized:

```bash
# In Claude Code
/plugins list
```

You should see `squad-federation-core` in the list.

### 5. Initialize Your Project

In your project repository, create a federation configuration:

```bash
cd /path/to/your/project
```

Create `federate.config.json`:

```json
{
  "description": "My project federation",
  "telemetry": {
    "enabled": true
  },
  "communicationType": "file-signal"
}
```

This minimal config enables file-based communication with telemetry.

### 6. Test the Installation

Run a simple command to verify everything works:

```bash
npx tsx /path/to/vladi-plugins-marketplace/plugins/squad-federation-core/scripts/monitor.ts
```

If no teams are onboarded yet, you'll see an empty dashboard — that's expected!

## Configuration Options

See the [Configuration Reference](/reference/configuration) for complete `federate.config.json` options, including:

- Teams channel communication
- Custom telemetry endpoints
- Deliverable schemas
- Import hooks

## Troubleshooting

### Command not found: tsx

Install `tsx` globally or use `npx`:

```bash
npm install -g tsx
```

### Permission denied errors

Ensure your user has write access to:
- Project `.squad/` directory
- Worktree directories (default: `.worktrees/`)

### TypeScript compilation errors

Clear node_modules and reinstall:

```bash
cd plugins/squad-federation-core
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- [Create your first federation](/getting-started/first-federation)
- [Learn about federation setup](/guides/federation-setup)
- [Explore archetypes](/archetypes/overview)
