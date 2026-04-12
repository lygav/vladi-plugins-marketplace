# squad-archetype-coding

Archetype for **implementation teams** that write code and produce pull requests — feature development, bug fixes, refactoring, or any code-centric work.

## How It Works

```
Team receives task via DOMAIN_CONTEXT.md + inbox directives
Agents follow: design → implement → test → open PR
Completion = PR opened. Meta-squad tracks PR status.
```

## What's Included

| Component | Actor | Purpose |
|-----------|-------|---------|
| `skills/coding-playbook/` | Coding team | Playbook: design → implement → test → PR |
| `skills/pr-review-coordination/` | **Meta-squad** | Track PRs, coordinate reviews, send feedback, manage merges |
| `skills/task-assignment/` | **Meta-squad** | Break down work, write specs, assign tasks to coding teams |
| `templates/launch-prompt-*.md` | — | Prompt templates for first run, refresh, and reset |
| `templates/cleanup-hook.sh` | — | Reset cleanup: no-op (code lives in git) |

## Installation

Typically auto-installed by `squad-federation-core`'s setup wizard. Manual:

```bash
copilot plugin install squad-archetype-coding@vladi-plugins-marketplace
```

## Requires

- [squad-federation-core](../squad-federation-core/) — the federation plumbing layer
