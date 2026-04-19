# sdlc-practices

Battle-tested SDLC practices for AI agent team coordination.

## What This Plugin Provides

A single skill that activates when coordinating multi-agent development workflows. Covers:

- **Branch isolation** — every agent gets its own branch, no exceptions
- **Task decomposition** — diagnose → plan → dispatch, never mega-tasks
- **Scope boundaries** — explicit file-level boundaries in every agent prompt
- **Review gates** — separate reviewer agent before every merge
- **Dispatch patterns** — templates for implementation, refactoring, investigation, and merge tasks
- **Parallel work** — safe parallelization with zero file overlap

## Installation

```bash
# From marketplace
copilot plugin install vladi-plugins-marketplace/sdlc-practices

# Or local development
copilot --plugin-dir /path/to/sdlc-practices
```

## When It Triggers

The skill activates when the user or coordinator discusses:
- Planning work packages
- Dispatching agents to feature branches
- Running code reviews
- Merging branches
- Breaking down large tasks

## Origin

These practices emerged from real multi-agent development sessions coordinating parallel AI agents on production codebases. Every rule exists because violating it caused real problems.
