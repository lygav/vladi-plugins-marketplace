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
 * Discover all domain squad worktrees in the repository.
 *
 * Parses `git worktree list --porcelain` and filters by branch prefix.
 * Domain branches follow the pattern: {prefix}{domain-name}
 * Default prefix is "squad/" — configurable via FEDERATE_BRANCH_PREFIX env var or parameter.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @param branchPrefix Branch prefix to filter (defaults to "squad/" or FEDERATE_BRANCH_PREFIX)
 * @returns Array of domain worktrees with domain name, branch, and path
 */
export function discoverDomains(repoRoot?: string, branchPrefix?: string): DomainWorktree[] {
  const root = repoRoot || process.cwd();
  const prefix = branchPrefix || process.env.FEDERATE_BRANCH_PREFIX || 'squad/';

  try {
    const output = execSync('git worktree list --porcelain', { cwd: root, encoding: 'utf-8' });
    const worktrees: DomainWorktree[] = [];
    let currentPath = '';
    let currentBranch = '';

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        currentPath = line.replace('worktree ', '');
      } else if (line.startsWith('branch ')) {
        currentBranch = line.replace('branch refs/heads/', '');
        if (currentBranch.startsWith(prefix)) {
          const domain = currentBranch.replace(prefix, '');
          worktrees.push({ domain, branch: currentBranch, path: currentPath });
        }
      }
    }
    return worktrees;
  } catch {
    return [];
  }
}

/**
 * Get the worktree path for a specific branch.
 *
 * @param branch Branch name to find worktree for
 * @param repoRoot Repository root path (defaults to current working directory)
 * @returns Worktree path if found, null otherwise
 */
export function getWorktreeForBranch(branch: string, repoRoot?: string): string | null {
  const root = repoRoot || process.cwd();

  try {
    const output = execSync('git worktree list --porcelain', { cwd: root, encoding: 'utf-8' });
    const lines = output.trim().split('\n');
    let currentPath: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.substring('worktree '.length);
      } else if (line.startsWith('branch ')) {
        const branchName = line.substring('branch refs/heads/'.length);
        if (branchName === branch && currentPath) {
          return currentPath;
        }
      } else if (line === '') {
        currentPath = null;
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
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
 * Get all worktrees with detailed metadata.
 *
 * Parses `git worktree list --porcelain` and returns all worktrees with status flags.
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
      } else if (line.startsWith('HEAD ')) {
        current.isDetached = true;
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
 * Map worktrees to branches for quick lookup.
 *
 * @param repoRoot Repository root path (defaults to current working directory)
 * @param branchPrefix Branch prefix to filter (defaults to "squad/" or FEDERATE_BRANCH_PREFIX)
 * @returns Map of branch name to worktree path
 */
export function mapWorktreesToBranches(repoRoot?: string, branchPrefix?: string): Map<string, string> {
  const root = repoRoot || process.cwd();
  const prefix = branchPrefix || process.env.FEDERATE_BRANCH_PREFIX || 'squad/';
  const worktreeMap = new Map<string, string>();

  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: root,
      encoding: 'utf-8',
    });

    const lines = output.trim().split('\n');
    let currentPath: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.substring('worktree '.length);
      } else if (line.startsWith('branch ')) {
        const branch = line.substring('branch refs/heads/'.length);
        if (branch.startsWith(prefix) && currentPath) {
          worktreeMap.set(branch, currentPath);
        }
      } else if (line === '') {
        currentPath = null;
      }
    }
  } catch {
    // Ignore errors
  }

  return worktreeMap;
}
