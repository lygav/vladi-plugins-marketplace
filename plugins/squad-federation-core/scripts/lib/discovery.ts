/**
 * Domain Discovery Library
 *
 * Centralized worktree and branch discovery logic for federation orchestration.
 * All scripts should use these functions instead of duplicating git worktree parsing.
 */

import { execSync } from 'child_process';

// ==================== Types ====================

export interface DomainWorktree {
  domain: string;
  branch: string;
  path: string;
}

export interface WorktreeInfo {
  path: string;
  branch: string | null;
  isDetached: boolean;
  isPrunable: boolean;
  isLocked: boolean;
}

// ==================== Core Discovery ====================

/**
 * Get all worktrees with detailed metadata.
 *
 * Parses `git worktree list --porcelain` and returns all worktrees with status flags.
 * This is the single source of truth for worktree data - other functions build views on top.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @returns Array of worktree information objects
 */
export function getAllWorktrees(repoRoot?: string): WorktreeInfo[] {
  const root = repoRoot || process.cwd();

  try {
    const output = execSync('git worktree list --porcelain', { cwd: root, encoding: 'utf-8' });
    const worktrees: WorktreeInfo[] = [];
    let current: Partial<WorktreeInfo> = {};

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        current.path = line.replace('worktree ', '');
        current.branch = null;
        current.isDetached = false;
        current.isPrunable = false;
        current.isLocked = false;
      } else if (line.startsWith('branch ')) {
        current.branch = line.replace('branch refs/heads/', '');
      } else if (line.startsWith('detached')) {
        current.isDetached = true;
      } else if (line.startsWith('prunable')) {
        current.isPrunable = true;
      } else if (line.startsWith('locked')) {
        current.isLocked = true;
      } else if (line === '' && current.path) {
        worktrees.push(current as WorktreeInfo);
        current = {};
      }
    }

    // Handle last entry if no trailing newline
    if (current.path) {
      worktrees.push(current as WorktreeInfo);
    }

    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Discover all domain squad worktrees in the repository.
 *
 * Filters worktrees by branch prefix and extracts domain names.
 * Domain branches follow the pattern: {prefix}{domain-name}
 * Default prefix is "squad/" — configurable via FEDERATE_BRANCH_PREFIX env var or parameter.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @param branchPrefix Branch prefix to filter (defaults to "squad/" or FEDERATE_BRANCH_PREFIX)
 * @returns Array of domain worktrees with domain name, branch, and path
 */
export function discoverDomains(repoRoot?: string, branchPrefix?: string): DomainWorktree[] {
  const prefix = branchPrefix || process.env.FEDERATE_BRANCH_PREFIX || 'squad/';
  const allWorktrees = getAllWorktrees(repoRoot);

  return allWorktrees
    .filter(wt => wt.branch && wt.branch.startsWith(prefix))
    .map(wt => ({
      domain: wt.branch!.replace(prefix, ''),
      branch: wt.branch!,
      path: wt.path,
    }));
}

/**
 * Get the worktree path for a specific branch.
 *
 * @param branch Branch name to find worktree for
 * @param repoRoot Repository root path (defaults to current working directory)
 * @returns Worktree path if found, null otherwise
 */
export function getWorktreeForBranch(branch: string, repoRoot?: string): WorktreeInfo | null {
  const allWorktrees = getAllWorktrees(repoRoot);
  const found = allWorktrees.find(wt => wt.branch === branch);
  return found ?? null;
}

/**
 * List all squad branches in the repository.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @param branchPrefix Branch prefix to filter (defaults to "squad/" or FEDERATE_BRANCH_PREFIX)
 * @returns Array of branch names
 */
export function listSquadBranches(repoRoot?: string, branchPrefix?: string): string[] {
  const root = repoRoot || process.cwd();
  const prefix = branchPrefix || process.env.FEDERATE_BRANCH_PREFIX || 'squad/';

  try {
    const output = execSync(`git branch --list '${prefix}*' --format='%(refname:short)'`, {
      cwd: root,
      encoding: 'utf-8',
    });

    return output.trim().split('\n').filter(b => b.length > 0);
  } catch {
    return [];
  }
}



/**
 * Map worktrees to branches for quick lookup.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @param branchPrefix Branch prefix to filter (defaults to "squad/" or FEDERATE_BRANCH_PREFIX)
 * @returns Map of branch name to worktree path
 */
export function mapWorktreesToBranches(repoRoot?: string, branchPrefix?: string): Map<string, string> {
  const prefix = branchPrefix || process.env.FEDERATE_BRANCH_PREFIX || 'squad/';
  const allWorktrees = getAllWorktrees(repoRoot);
  const worktreeMap = new Map<string, string>();

  for (const wt of allWorktrees) {
    if (wt.branch && wt.branch.startsWith(prefix)) {
      worktreeMap.set(wt.branch, wt.path);
    }
  }

  return worktreeMap;
}
