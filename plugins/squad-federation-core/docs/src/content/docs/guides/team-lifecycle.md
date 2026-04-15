---
title: Team Lifecycle
description: Guide to onboarding, running, pausing, and retiring federated teams
---

# Team Lifecycle

```
onboard → active → [pause ⇄ resume] → retire
```

| Status | Can Launch | Workspace | Transitions To |
|--------|-----------|-----------|---------------|
| active | Yes | Exists | paused, retired |
| paused | No | Preserved | active, retired |
| retired | No | Removed | (terminal) |

## Onboard

```bash
npx tsx scripts/onboard.ts --name backend-api --archetype coding
```

## Launch (active only)

```bash
npx tsx scripts/launch.ts --all  # skips paused/retired
```

## Pause / Resume / Retire

```bash
npx tsx scripts/offboard.ts --team backend-api --mode pause
npx tsx scripts/offboard.ts --team backend-api --mode resume
npx tsx scripts/offboard.ts --team backend-api --mode retire --force
```
