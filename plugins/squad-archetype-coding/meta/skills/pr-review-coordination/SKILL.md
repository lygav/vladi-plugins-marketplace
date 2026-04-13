---
trigger:
  - "review PRs"
  - "PR status"
  - "track pull requests"
  - "merge PRs"
  - "code review"
  - "PR coordination"
actor: meta-squad
---

# PR Review Coordination

Coordinate pull-request review across coding teams. Track what's open, send feedback, manage merge order, and keep PRs from going stale.

---

## Tracking Open PRs

Check each coding team's **outbox** for `pr_opened` signals. Every coding team emits this signal when it finishes its implementation cycle and opens a PR.

Compile a PR dashboard by scanning all team outboxes:

```
teams/
  feature-auth/outbox/
    pr_opened.json        ← PR #42, branch feature/auth-flow
  feature-search/outbox/
    pr_opened.json        ← PR #51, branch feature/search-index
  bugfix-cache/outbox/
    (empty)               ← still working, no PR yet
```

A `pr_opened` signal looks like this:

```json
{
  "signal": "pr_opened",
  "team": "feature-auth",
  "timestamp": "2025-01-15T10:32:00Z",
  "payload": {
    "pr_number": 42,
    "branch": "feature/auth-flow",
    "target": "main",
    "title": "Add JWT-based authentication flow",
    "summary": "Implements login, logout, token refresh. Adds middleware and tests.",
    "files_changed": 14,
    "tests_added": 8
  }
}
```

Scan outboxes at the start of every meta-squad cycle. Build a summary: which PRs are open, which are reviewed, which are blocked.

## Review Workflow

Three options for each open PR:

1. **Review directly.** Read the diff, check against the task spec in DOMAIN_CONTEXT.md, verify tests pass. Approve or request changes.
2. **Assign an external reviewer.** If the PR touches a domain you lack context on, delegate review to a human or another agent with domain expertise.
3. **Send review feedback as an inbox directive.** Write structured feedback to the team's inbox. The team picks it up on its next run and addresses the comments.

Prefer option 3 for non-blocking feedback. Reserve direct review for final approval.

## Sending Feedback

Write a directive to the coding team's inbox with review comments:

```json
{
  "directive": "review-feedback",
  "from": "meta-squad",
  "timestamp": "2025-01-15T14:00:00Z",
  "target_team": "feature-auth",
  "payload": {
    "pr_number": 42,
    "status": "changes_requested",
    "comments": [
      {
        "file": "src/auth/middleware.ts",
        "line": 47,
        "body": "Token expiry is hardcoded to 24h. Read from config instead."
      },
      {
        "file": "src/auth/login.ts",
        "line": 12,
        "body": "Missing rate-limit check on login endpoint."
      }
    ],
    "summary": "Two issues found. Address both before merge."
  }
}
```

Place this file at `teams/feature-auth/inbox/review-feedback-pr42.json`. The team checks inbox before each phase, picks up the directive, and pushes fixes.

## Merge Strategy

Merge a PR when **all** of these are true:

- CI tests pass (green status checks).
- At least one review approval (from meta-squad or delegated reviewer).
- No unresolved review feedback directives in the team's inbox.
- No merge conflicts with the target branch.

Request changes when:

- Tests fail or are missing for new functionality.
- The implementation deviates from the task spec without justification.
- Security, performance, or correctness issues are found.

Do not merge PRs that have open feedback directives. Wait for the team to acknowledge and push fixes.

## Cross-Team Dependencies

If team A's PR depends on team B's (e.g., team A consumes an API that team B is building):

1. Merge team B's PR first.
2. Send a directive to team A's inbox: `"dependency_merged": { "pr": 38, "team": "feature-search" }`.
3. Team A rebases onto the updated target branch and resolves any integration issues.

Coordinate merge order explicitly. Do not rely on teams to self-discover dependency resolution. Use the signal protocol:

- Team B emits `pr_merged` in its outbox.
- Meta-squad reads `pr_merged`, then sends a `dependency_merged` directive to team A's inbox.

## Stale PR Handling

A PR is stale if it has been open for more than **two meta-squad cycles** without activity (no new commits, no review feedback addressed).

For stale PRs:

1. Send a status-check directive to the team's inbox asking for an update.
2. If the team does not respond after one more cycle, escalate: either close the PR and re-scope the task, or offer help by sending a pair-review directive.
3. If the underlying branch has fallen far behind the target, direct the team to rebase before any further review.

Do not let PRs rot. Stale PRs accumulate merge conflicts and block dependent work.

---

**Summary:** Scan outboxes for `pr_opened` → review or delegate → send feedback via inbox directives → merge when green and approved → coordinate cross-team merge order → chase stale PRs.
