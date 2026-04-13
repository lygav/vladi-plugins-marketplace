# Migration Guide: v0.1.0 → v0.2.0

This guide helps you upgrade an existing squad-federation-core v0.1.0 federation to v0.2.0.

## What Changed in v0.2.0

Federation v0.2.0 introduces a **plugin SDK architecture** that transforms the system from worktree-specific to general-purpose:

### Key Improvements

1. **Transport Abstraction** — Teams can exist anywhere (worktrees, directories, repos, cloud), not just git worktrees
2. **SDK Foundation** — Shared types/interfaces at `sdk/` enable archetype development as proper plugin extensions
3. **Meta/Team Separation** — Archetypes cleanly separate orchestration concerns (meta) from execution concerns (team)
4. **Team Registry** — `.squad/teams.json` replaces `git worktree list` as source of truth for team discovery
5. **Learning Log Versioning** — Versioned schema enables backward-compatible learning log evolution
6. **Start-Empty Onboarding** — New teams get minimal bootstrap instead of full archetype copy

### Why These Changes Matter

- **Extensibility:** Add new archetypes without modifying core code
- **Flexibility:** Deploy teams to any environment (local dirs, cloud, containers)
- **Reliability:** Centralized team registry prevents worktree discovery failures
- **Forward Compatibility:** Versioned schemas enable smooth future migrations

### Who Should Upgrade

- **Existing v0.1.0 users** — Continue using worktrees but gain registry-based discovery and improved archetype support
- **New users** — Start with v0.2.0 to access the full SDK and transport flexibility

---

## Breaking Changes

### 1. Archetype Structure

**❌ Old (v0.1.0):**
```
archetypes/{id}/
├── archetype.json
├── skills/
├── templates/
└── scripts/
```

**✅ New (v0.2.0):**
```
archetypes/{id}/
├── meta/                    # Meta-squad concerns (orchestration)
│   ├── archetype.json
│   ├── skills/
│   │   ├── setup/
│   │   ├── monitor/
│   │   ├── triage/
│   │   └── aggregation/
│   └── scripts/
│       └── aggregate.ts
└── team/                    # Team concerns (execution)
    ├── archetype.json
    ├── skills/
    │   └── playbook/
    ├── templates/
    │   ├── launch-prompt-*.md
    │   └── cleanup-hook.sh
    └── schemas/
```

**Impact:**
- Existing archetype plugins need restructuring to separate meta/ and team/ directories
- Core will fall back to legacy structure with a deprecation warning, but you should migrate

**Migration:**
- Update archetype plugins to v0.2.0-compatible versions
- Or manually restructure custom archetypes following the new layout

### 2. Team Discovery

**❌ Old (v0.1.0):**
- Core discovers teams via `git worktree list`
- No centralized registry — discovery happens at runtime

**✅ New (v0.2.0):**
- Core reads teams from `.squad/teams.json` registry
- `git worktree list` only used during migration or manual sync

**Impact:**
- Existing federations have no `.squad/teams.json`
- Monitor/launch scripts won't find teams until registry is populated

**Migration:**
- Run the migration script (see Step 3 below) to populate the registry from existing worktrees

### 3. Onboarding Model

**❌ Old (v0.1.0):**
- Copies entire archetype directory to new team worktree
- Teams start with all meta/ content (unnecessary bulk)

**✅ New (v0.2.0):**
- Copies only `team/` directory content to new team worktree
- `meta/` stays in archetype plugin (orchestration stays centralized)

**Impact:**
- Existing worktrees may have meta/ content in team directories (harmless but unnecessary)
- New teams onboarded after upgrade will be leaner

**Migration:**
- Optional cleanup: Remove `meta/` directories from team worktrees (see Step 4 below)
- Not required — extra files are ignored

### 4. Learning Log Schema

**✅ Backward Compatible:**
- v0.2.0 adds a `version` field to learning log entries
- Old entries without `version` are auto-migrated to `"1.0"` on read

**Impact:**
- No breaking changes
- Migration script adds `version: "1.0"` to existing entries for consistency

**Migration:**
- Automatic — no action required
- Optional: Run migration script to add version field to existing entries

### 5. Signal Protocol

**✅ Backward Compatible:**
- v0.2.0 adds optional fields to signal messages (e.g., `protocol`, `acknowledged`, `acknowledged_at`)
- Old signals without these fields continue to work

**Impact:**
- No breaking changes
- New fields enable advanced features (acknowledgments, protocol versioning)

**Migration:**
- Automatic — no action required
- New signals will include new fields, old signals remain valid

---

## Step-by-Step Migration

### Prerequisites

- Git 2.20+ (for worktree support)
- Node.js 20+ (for migration script)
- Backup your federation before starting

### Step 1: Backup

Create a backup of your current federation state:

```bash
# Create backup branch
git branch backup-v0.1.x

# Save worktree list
git worktree list > worktrees-backup.txt

# Backup team registry (if it exists)
cp .squad/teams.json .squad/teams.json.backup 2>/dev/null || true

# Backup learning logs
find .worktrees -name "log.jsonl" -exec cp {} {}.backup \; 2>/dev/null || true
```

### Step 2: Update Plugin

Update squad-federation-core to v0.2.0:

```bash
cd plugins/squad-federation-core
git pull origin main
npm install  # If new dependencies were added
```

If you have custom archetype plugins, update them to v0.2.0-compatible versions:

```bash
cd plugins/squad-archetype-deliverable  # Example
git pull origin main
npm install
```

### Step 3: Run Migration Script

The migration script will:
- Discover existing worktree-based teams via `git worktree list`
- Create `.squad/teams.json` registry from discovered teams
- Validate archetype.json exists in each team (warns if missing)
- Add `version: "1.0"` to learning log entries that lack it
- Report what was migrated

**Dry-Run (Recommended First):**

```bash
cd plugins/squad-federation-core
npx tsx scripts/migrate-v2.ts --dry-run
```

Review the output to see what will change. The dry-run shows:
- Teams that will be registered
- Learning log entries that need version field
- Any warnings or issues

**Run Migration:**

```bash
npx tsx scripts/migrate-v2.ts
```

Expected output:
```
✅ Migration Complete

Teams Registered: 3
  - frontend (worktree: /path/to/.worktrees/frontend)
  - backend (worktree: /path/to/.worktrees/backend)
  - api (worktree: /path/to/.worktrees/api)

Learning Logs Migrated: 47 entries updated with version field

Registry: .squad/teams.json
```

### Step 4: Verify Migration

Check that everything migrated correctly:

```bash
# Verify team registry
cat .squad/teams.json

# Verify teams are discoverable
cd plugins/squad-federation-core
npx tsx scripts/monitor.ts

# Check learning logs (should show version field)
cat .worktrees/frontend/.squad/learnings/log.jsonl | head -1
```

### Step 5: Optional Cleanup

Remove unnecessary meta/ content from team worktrees (v0.1.0 artifact):

```bash
# Check for meta/ directories in team worktrees
find .worktrees -name "meta" -type d

# Remove if found (optional — not required for v0.2.0)
find .worktrees -name "meta" -type d -exec rm -rf {} \;
```

**Note:** This cleanup is optional. v0.2.0 ignores meta/ directories in team worktrees, so they don't interfere.

### Step 6: Test Federation Operations

Verify core operations work correctly:

```bash
cd plugins/squad-federation-core

# Launch a team (should work with registry)
npx tsx scripts/launch.ts frontend

# Monitor all teams (should discover from registry)
npx tsx scripts/monitor.ts

# Sync skills to a team
npx tsx scripts/sync-skills.ts --team frontend
```

If any operation fails, check:
- `.squad/teams.json` exists and is valid JSON
- Team worktrees still exist at registered paths
- Archetype plugins are v0.2.0-compatible

---

## Backward Compatibility

### Temporary Dual Support

v0.2.0 maintains backward compatibility with v0.1.0 federations through:

1. **Legacy Archetype Structure:** Core checks for `meta/archetype.json` first, falls back to `archetype.json` if not found
2. **Learning Log Auto-Migration:** Entries without `version` field are treated as `"1.0"` on read
3. **Signal Protocol:** Old signals without new optional fields continue to work

### Deprecation Timeline

- **v0.2.0:** Legacy archetype structure supported with deprecation warning
- **v0.3.0 (planned):** Legacy structure may be removed — upgrade archetypes before then

### What's Not Backward Compatible

- **Team discovery without registry:** Core requires `.squad/teams.json` after migration
- **Onboarding without meta/team split:** New archetype plugins must use new structure

---

## Troubleshooting

### Teams Not Discovered After Migration

**Symptom:** `npx tsx scripts/monitor.ts` shows no teams, but worktrees exist

**Cause:** `.squad/teams.json` registry not created or corrupted

**Fix:**
```bash
# Re-run migration
npx tsx scripts/migrate-v2.ts

# Or manually create registry
cat .squad/teams.json  # Check if it exists
git checkout HEAD -- .squad/teams.json  # Restore from git if corrupted
```

### Migration Script Fails with "archetype.json not found"

**Symptom:** Migration reports "Warning: archetype.json not found in worktree X"

**Cause:** Team worktree missing archetype metadata (v0.1.0 might not have created it)

**Fix:**
```bash
# Check if archetype metadata exists
ls .worktrees/TEAM_NAME/.squad/archetype.json

# If missing, add it manually (example for deliverable archetype)
echo '{"id":"deliverable","version":"0.2.0"}' > .worktrees/TEAM_NAME/.squad/archetype.json

# Re-run migration
npx tsx scripts/migrate-v2.ts
```

### Learning Log Entries Missing Version Field After Migration

**Symptom:** Learning log entries still lack `version` field after migration

**Cause:** Migration script doesn't modify JSONL files — it reports what needs updating

**Fix:**
The migration is automatic on read. When scripts read the log, they auto-add version. To persist the changes:

```bash
# Re-run sweep-learnings or graduate-learning (they rewrite logs with version)
npx tsx scripts/sweep-learnings.ts
```

Or manually add version field:
```bash
# Example: Add version to all entries in a log
cat .worktrees/frontend/.squad/learnings/log.jsonl | \
  jq -c '. + {version: "1.0"}' > log.tmp && \
  mv log.tmp .worktrees/frontend/.squad/learnings/log.jsonl
```

### Monitor Shows "Unknown Archetype" for Teams

**Symptom:** `monitor.ts` displays "archetype: unknown" for teams

**Cause:** Team worktree missing `.squad/archetype.json` or archetype plugin not installed

**Fix:**
```bash
# Check archetype metadata in team
cat .worktrees/TEAM_NAME/.squad/archetype.json

# If missing, add it (example for deliverable archetype)
echo '{"id":"deliverable","version":"0.2.0"}' > .worktrees/TEAM_NAME/.squad/archetype.json

# Ensure archetype plugin is installed
ls plugins/squad-archetype-deliverable
```

### Registry Contains Stale Teams

**Symptom:** `.squad/teams.json` lists teams whose worktrees no longer exist

**Cause:** Worktree removed via `git worktree remove` but not unregistered

**Fix:**
```bash
# List worktrees to find orphaned entries
git worktree list

# Remove stale entries from registry
vim .squad/teams.json  # Manually remove stale team entry

# Or reset registry and re-migrate
rm .squad/teams.json
npx tsx scripts/migrate-v2.ts
```

---

## FAQ

### Q: Do I need to re-onboard teams after upgrading?

**A:** No. Existing teams continue to work. The migration script registers them in `.squad/teams.json` so they're discoverable in v0.2.0.

### Q: Can I use v0.2.0 without a team registry?

**A:** No. The registry (`.squad/teams.json`) is required. Run the migration script to create it from existing worktrees.

### Q: What happens to learning logs after migration?

**A:** Learning logs are backward compatible. Entries without `version` field are auto-migrated to `"1.0"` on read. The migration script adds the field for consistency, but it's not required.

### Q: Can I mix v0.1.0 and v0.2.0 archetype plugins?

**A:** Yes, temporarily. Core falls back to legacy archetype structure with a deprecation warning. However, update archetypes to v0.2.0 as soon as possible.

### Q: How do I migrate custom archetype plugins?

**A:** Restructure your archetype to separate meta/ and team/ directories:
1. Move orchestration concerns (setup, monitor, triage skills) to `meta/`
2. Move execution concerns (playbook skills, templates) to `team/`
3. Create `archetype.json` in both `meta/` and `team/` directories
4. Update `plugin.json` to reflect new structure

See `ARCHITECTURE.md` and the archetype author guide for detailed instructions.

### Q: What if migration script fails?

**A:** Check the error message. Common issues:
- Not in a git repository: Run from repository root
- No worktrees found: Ensure `git worktree list` shows your teams
- Permission errors: Ensure `.squad/` directory is writable
- Corrupted registry: Delete `.squad/teams.json` and re-run migration

If migration fails repeatedly, manually create the registry:
```bash
echo '{"version":"1.0","teams":[]}' > .squad/teams.json
# Then manually register each team
```

### Q: Can I roll back to v0.1.0 after migrating?

**A:** Yes, but you'll lose the registry:
1. Checkout backup branch: `git checkout backup-v0.1.x`
2. Restore worktrees: Compare `git worktree list` with `worktrees-backup.txt`
3. Delete `.squad/teams.json` (v0.1.0 doesn't use it)

### Q: Do signals need migration?

**A:** No. Signal protocol is backward compatible. Old signals without new optional fields continue to work.

### Q: How do I verify migration was successful?

**A:** Run these checks:
```bash
# Registry exists and is valid JSON
cat .squad/teams.json | jq .

# Teams are discoverable
npx tsx scripts/monitor.ts

# Learning logs have version field (sample check)
cat .worktrees/*/​.squad/learnings/log.jsonl | jq .version | head -5

# Core operations work
npx tsx scripts/launch.ts TEAM_NAME
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check logs:** Look for error messages in script output
2. **Dry-run first:** Always use `--dry-run` to preview changes
3. **Backup before migrating:** Keep a backup branch until migration is verified
4. **Consult ARCHITECTURE.md:** Detailed design documentation
5. **GitHub Issues:** Report bugs or ask questions

---

**Migration Checklist:**

- [ ] Backup federation (branch + worktree list)
- [ ] Update squad-federation-core to v0.2.0
- [ ] Update archetype plugins to v0.2.0
- [ ] Run migration script with `--dry-run`
- [ ] Review dry-run output
- [ ] Run migration script without `--dry-run`
- [ ] Verify `.squad/teams.json` created
- [ ] Test monitor/launch operations
- [ ] Optional: Clean up meta/ directories from team worktrees

**Estimated Time:** 10-15 minutes for most federations

---

**End of Migration Guide**
