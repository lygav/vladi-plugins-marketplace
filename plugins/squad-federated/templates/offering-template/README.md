# Domain Worktree

This branch is a **permanent domain expert squad** worktree managed by the federated squad model.

## File Structure

```
deliverable.json        # Final merged deliverable for this domain
raw/                    # Scan data collected during analysis
  fragments/            # Per-item fragment files produced by squad members
    fragment-*.json     # Individual analysis fragments
.squad/                 # Team state (managed automatically)
  team.json             # Current team composition
  learnings.jsonl       # Accumulated learning log
  status.json           # Current scan phase and progress
```

The directory structure is intentionally **flat** — everything lives at the worktree root or one level deep. This makes it simple for the meta-squad aggregator to read deliverables via `git show` without navigating nested paths.

## Running a Scan

1. Switch to this domain's branch: `git checkout scan/<domain-id>`
2. The domain squad will analyze items relevant to this domain.
3. Each squad member writes a fragment file into `raw/fragments/`.
4. When all items are processed, run `python merge_fragments.py` (or let the lead agent do it) to produce the final `deliverable.json`.
5. Update `status.json` to `"phase": "completed"`.

## Re-scanning (Delta Mode)

When you re-run a scan on an existing domain worktree:
- The squad checks `deliverable.json` for previously analyzed items.
- Only **new or changed** items are scanned — existing results are preserved.
- Fragments for re-scanned items overwrite their previous versions.
- The merge step produces an updated `deliverable.json` that includes both old and new results.

## Aggregation

The **meta-squad aggregator** collects deliverables from all domain worktrees:
1. It discovers branches matching `scan/*`.
2. For each branch, it reads `status.json` to confirm the domain is complete.
3. It retrieves the deliverable using `git show scan/<domain-id>:deliverable.json`.
4. All domain deliverables are merged into a single federated result.

This means your domain worktree never needs to be checked out during aggregation — the aggregator reads directly from git objects.
