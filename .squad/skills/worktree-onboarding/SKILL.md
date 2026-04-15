---
name: worktree-onboarding
confidence: high
extracted_from: Team onboarding fix, worktree inheritance issue
---

# Worktree Onboarding Clean Start

## When to Use
When onboarding a new team using `git worktree add` in federation-core, ensure the new worktree starts with a clean `.squad/` state.

## Pattern
**Problem:** `git worktree add <path> <branch>` creates a new worktree but inherits ALL committed files from the source branch, including `.squad/` directories from other teams.

**Impact:** New team's `.squad/` might contain:
- identity/ files from parent team
- agents/ histories from other teams  
- Old learning logs, signals, status files

**Solution:** After creating worktree, BEFORE bootstrapping, delete inherited `.squad/` completely.

**Correct Onboarding Flow:**
```bash
# 1. Create worktree (inherits all committed files)
git worktree add ../squad-team-alpha squad/team-alpha

# 2. CRITICAL: Delete inherited .squad/ directory
cd ../squad-team-alpha
rm -rf .squad/

# 3. Now bootstrap fresh team state
npx tsx scripts/onboard.ts --teamId team-alpha --archetype ml-team
```

## Why This Happens
Git worktree creates a new working directory pointing to a branch, but the working directory is populated from the index (all tracked files). If `.squad/` directories are committed in the main branch (which they are for team memory), they get copied into the new worktree.

## Example
```bash
# BAD: Onboard without cleanup
git worktree add ../squad-frontend squad/frontend
cd ../squad-frontend
npm run onboard
# Result: .squad/ contains files from main branch teams

# GOOD: Onboard with cleanup
git worktree add ../squad-frontend squad/frontend
cd ../squad-frontend
rm -rf .squad/  # ← Critical step
npm run onboard
# Result: .squad/ is fresh, team-specific state
```

## Integration Point
The `onboard.ts` script should automatically handle this:
```typescript
async function onboardTeam(teamId: string, archetype: string, transport: string) {
  // If using worktree transport
  if (transport === 'worktree') {
    const worktreePath = getWorktreePath(teamId);
    
    // Delete inherited .squad/ before bootstrap
    await fs.rm(path.join(worktreePath, '.squad'), { 
      recursive: true, 
      force: true  // Don't error if already missing
    });
  }
  
  // Now bootstrap fresh state
  await placement.bootstrap(teamId);
}
```

## Common Mistake
Assuming worktrees start "empty" — they don't. They start with all committed files from the source branch.
