/**
 * WorktreePlacement — Git worktree-based placement implementation.
 * 
 * Extends DirectoryPlacement with git worktree operations for team workspaces.
 * Inherits all filesystem operations and adds git-specific capabilities.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { DirectoryPlacement } from './directory-placement';
import { OTelEmitter } from '../../sdk/otel-emitter.js';

/**
 * WorktreeInfo — Metadata about a git worktree.
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  bare?: boolean;
}

/**
 * WorktreePlacement implementation.
 * 
 * Extends DirectoryPlacement to add git worktree-specific operations.
 * Filesystem operations are inherited; this class adds git capabilities.
 */
export class WorktreePlacement extends DirectoryPlacement {
  /**
   * Create a new WorktreePlacement.
   * @param basePath - Base directory path for the worktree
   * @param branch - Git branch name for this worktree
   * @param repoRoot - Repository root directory
   * @param emitter - Optional OTel emitter for instrumentation
   */
  constructor(
    basePath: string,
    private readonly branch: string,
    private readonly repoRoot: string,
    emitter?: OTelEmitter
  ) {
    // Create basePathMap with a single team entry for this worktree
    // In federation context, each worktree typically represents one team
    const basePathMap = new Map<string, string>();
    const teamId = path.basename(basePath);
    basePathMap.set(teamId, basePath);
    
    super(basePathMap, emitter);
  }

  /**
   * Create a new git worktree.
   * @param repoRoot - Repository root directory
   * @param branchName - Branch name for the new worktree
   * @param baseBranch - Base branch to fork from (default: current branch)
   * @param worktreeDir - Base directory for worktree placement (default: '.worktrees')
   * @param emitter - Optional OTel emitter for instrumentation
   * @returns WorktreePlacement instance for the new worktree
   */
  static async create(
    repoRoot: string,
    branchName: string,
    baseBranch?: string,
    worktreeDir?: string,
    emitter?: OTelEmitter
  ): Promise<WorktreePlacement> {
    const emit = emitter || new OTelEmitter();
    
    return await emit.span(
      'worktree.create',
      async () => {
        try {
          // Determine worktree base directory (default to .worktrees inside repo)
          const baseDir = worktreeDir || '.worktrees';
          
          // Generate worktree path: {repoRoot}/{baseDir}/{branchName}
          // If baseDir is absolute or starts with ../, it's relative/absolute path
          // Otherwise, it's relative to repoRoot
          const worktreePath = path.isAbsolute(baseDir) || baseDir.startsWith('../')
            ? path.join(baseDir, branchName)
            : path.join(repoRoot, baseDir, branchName);

          // Build git worktree add command
          const baseRef = baseBranch || 'HEAD';
          const cmd = `git worktree add "${worktreePath}" -b "${branchName}" "${baseRef}"`;

          // Execute from repo root
          execSync(cmd, {
            cwd: repoRoot,
            stdio: 'pipe',
            encoding: 'utf-8'
          });

          // Emit event for worktree created
          await emit.event('worktree.created', {
            'git.branch': branchName,
            'git.base_branch': baseRef,
            'worktree.path': worktreePath
          });

          return new WorktreePlacement(worktreePath, branchName, repoRoot, emitter);
        } catch (error) {
          throw new Error(
            `Failed to create worktree for branch ${branchName}: ${(error as Error).message}\n` +
            `Recovery:\n` +
            `  1. Check if worktree path already exists:\n` +
            `     ls -la {worktreePath}\n` +
            `  2. Check git status:\n` +
            `     cd ${repoRoot} && git status\n` +
            `  3. List existing worktrees:\n` +
            `     git worktree list\n` +
            `  4. If worktree exists but is stale, remove it:\n` +
            `     git worktree remove {worktreePath} --force\n` +
            `     git worktree prune\n` +
            `  5. If branch doesn't exist, create it first:\n` +
            `     git checkout -b ${branchName}\n` +
            `  6. Check disk space:\n` +
            `     df -h\n` +
            `  7. Ensure parent directory is writable:\n` +
            `     ls -la $(dirname {worktreePath})`
          );
        }
      },
      {
        'git.branch': branchName,
        'git.operation': 'create'
      }
    );
  }

  /**
   * Remove a git worktree.
   * @param repoRoot - Repository root directory
   * @param worktreePath - Path to the worktree to remove
   * @param emitter - Optional OTel emitter for instrumentation
   */
  static async remove(
    repoRoot: string,
    worktreePath: string,
    emitter?: OTelEmitter
  ): Promise<void> {
    const emit = emitter || new OTelEmitter();
    
    await emit.span(
      'worktree.remove',
      async () => {
        try {
          const cmd = `git worktree remove "${worktreePath}" --force`;
          
          execSync(cmd, {
            cwd: repoRoot,
            stdio: 'pipe',
            encoding: 'utf-8'
          });

          // Emit event for worktree removed
          await emit.event('worktree.removed', {
            'worktree.path': worktreePath
          });
        } catch (error) {
          throw new Error(
            `Failed to remove worktree at ${worktreePath}: ${(error as Error).message}\n` +
            `Recovery:\n` +
            `  1. Check if worktree exists:\n` +
            `     ls -la ${worktreePath}\n` +
            `  2. List all worktrees:\n` +
            `     git worktree list\n` +
            `  3. If worktree is locked, check for .git/worktrees lock:\n` +
            `     ls -la ${repoRoot}/.git/worktrees/\n` +
            `  4. Force cleanup if needed:\n` +
            `     rm -rf ${worktreePath}\n` +
            `     git worktree prune\n` +
            `  5. If worktree has uncommitted changes:\n` +
            `     cd ${worktreePath} && git status\n` +
            `     # Commit or stash changes before removal\n` +
            `  6. Check permissions:\n` +
            `     ls -la $(dirname ${worktreePath})`
          );
        }
      },
      {
        'worktree.path': worktreePath,
        'git.operation': 'remove'
      }
    );
  }

  /**
   * Get the branch name for this worktree.
   * @returns Branch name
   */
  getBranch(): string {
    return this.branch;
  }

  /**
   * Commit changes in the worktree.
   * @param message - Commit message
   * @param files - Optional array of file paths to stage (default: all changes)
   */
  async commit(message: string, files?: string[]): Promise<void> {
    await this.emitter.span(
      'git.commit',
      async () => {
        try {
          const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));

          // Stage files
          if (files && files.length > 0) {
            const fileArgs = files.map(f => `"${f}"`).join(' ');
            execSync(`git add ${fileArgs}`, {
              cwd: worktreePath,
              stdio: 'pipe',
              encoding: 'utf-8'
            });
          } else {
            // Stage all changes
            execSync('git add -A', {
              cwd: worktreePath,
              stdio: 'pipe',
              encoding: 'utf-8'
            });
          }

          // Commit
          execSync(`git commit -m "${message}"`, {
            cwd: worktreePath,
            stdio: 'pipe',
            encoding: 'utf-8'
          });

          // Emit event for commit
          await this.emitter.event('git.committed', {
            'git.branch': this.branch,
            'git.operation': 'commit',
            'files_count': files?.length || -1 // -1 = all changes
          });
        } catch (error) {
          const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));
          throw new Error(
            `Failed to commit in worktree: ${(error as Error).message}\n` +
            `Recovery:\n` +
            `  1. Check git status:\n` +
            `     cd ${worktreePath} && git status\n` +
            `  2. Verify there are changes to commit:\n` +
            `     cd ${worktreePath} && git diff --cached\n` +
            `  3. If no changes staged, check working tree:\n` +
            `     cd ${worktreePath} && git diff\n` +
            `  4. If commit message has special characters, escape them\n` +
            `  5. Check for merge conflicts:\n` +
            `     cd ${worktreePath} && git status | grep conflict\n` +
            `  6. Ensure git user is configured:\n` +
            `     git config user.name && git config user.email\n` +
            `  7. If hooks are failing, check:\n` +
            `     cd ${worktreePath} && ls -la .git/hooks/`
          );
        }
      },
      {
        'git.branch': this.branch,
        'git.operation': 'commit'
      }
    );
  }

  /**
   * Push changes to remote.
   * @param remote - Remote name (default: 'origin')
   */
  async push(remote: string = 'origin'): Promise<void> {
    await this.emitter.span(
      'git.push',
      async () => {
        try {
          const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));

          const cmd = `git push -u "${remote}" "${this.branch}"`;
          
          execSync(cmd, {
            cwd: worktreePath,
            stdio: 'pipe',
            encoding: 'utf-8'
          });
        } catch (error) {
          throw new Error(
            `Failed to push branch ${this.branch}: ${(error as Error).message}`
          );
        }
      },
      {
        'git.branch': this.branch,
        'git.remote': remote,
        'git.operation': 'push'
      }
    );
  }

  /**
   * Pull changes from remote.
   * @param remote - Remote name (default: 'origin')
   */
  async pull(remote: string = 'origin'): Promise<void> {
    try {
      const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));

      const cmd = `git pull "${remote}" "${this.branch}"`;
      
      execSync(cmd, {
        cwd: worktreePath,
        stdio: 'pipe',
        encoding: 'utf-8'
      });
    } catch (error) {
      throw new Error(
        `Failed to pull branch ${this.branch}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Read file from another branch without checking it out.
   * Used by sweep-learnings to read files across branches.
   * @param branch - Branch name to read from
   * @param filePath - File path relative to repo root
   * @returns File contents, or null if not found
   */
  async crossRead(branch: string, filePath: string): Promise<string | null> {
    try {
      const cmd = `git show "${branch}:${filePath}"`;
      
      const output = execSync(cmd, {
        cwd: this.repoRoot,
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      return output;
    } catch (error) {
      const errorMessage = (error as Error).message;
      // git show returns exit code 128 when file doesn't exist
      if (errorMessage.includes('exists on disk, but not in') || 
          errorMessage.includes('does not exist')) {
        return null;
      }
      throw new Error(
        `Failed to read ${filePath} from branch ${branch}: ${errorMessage}`
      );
    }
  }

  /**
   * Create a pull request from this worktree's branch.
   * @param title - PR title
   * @param body - PR description
   * @param base - Base branch (default: 'main')
   * @returns PR URL
   */
  async createPR(title: string, body: string, base: string = 'main'): Promise<string> {
    return await this.emitter.span(
      'git.createPR',
      async () => {
        try {
          const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));

          const cmd = `gh pr create --title "${title}" --body "${body}" --base "${base}"`;
          
          const output = execSync(cmd, {
            cwd: worktreePath,
            stdio: 'pipe',
            encoding: 'utf-8'
          });

          // Extract PR URL from gh output
          const urlMatch = output.match(/https:\/\/[^\s]+/);
          if (!urlMatch) {
            throw new Error('Failed to extract PR URL from gh output');
          }

          const prUrl = urlMatch[0];

          // Emit event for PR created
          await this.emitter.event('pr.created', {
            'git.branch': this.branch,
            'git.base_branch': base,
            'pr.url': prUrl
          });

          return prUrl;
        } catch (error) {
          const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));
          throw new Error(
            `Failed to create PR for branch ${this.branch}: ${(error as Error).message}\n` +
            `Recovery:\n` +
            `  1. Ensure branch is pushed to remote:\n` +
            `     cd ${worktreePath} && git push -u origin ${this.branch}\n` +
            `  2. Check gh CLI authentication:\n` +
            `     gh auth status\n` +
            `  3. If not authenticated:\n` +
            `     gh auth login\n` +
            `  4. Verify remote repository:\n` +
            `     cd ${worktreePath} && git remote -v\n` +
            `  5. Check if PR already exists:\n` +
            `     gh pr list --head ${this.branch}\n` +
            `  6. Try creating PR manually:\n` +
            `     cd ${worktreePath}\n` +
            `     gh pr create --title "Your title" --body "Your body" --base ${base}\n` +
            `  7. Ensure branch has commits:\n` +
            `     cd ${worktreePath} && git log --oneline -5`
          );
        }
      },
      {
        'git.branch': this.branch,
        'git.base_branch': base,
        'git.operation': 'create_pr'
      }
    );
  }

  /**
   * Get git status for the worktree.
   * @returns Status output in porcelain format
   */
  async getStatus(): Promise<string> {
    try {
      const worktreePath = await this.getLocation(path.basename(await this.getLocation('')));

      const output = execSync('git status --porcelain', {
        cwd: worktreePath,
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      return output;
    } catch (error) {
      throw new Error(
        `Failed to get status for worktree: ${(error as Error).message}`
      );
    }
  }

  /**
   * List all worktrees in the repository.
   * @param repoRoot - Repository root directory
   * @returns Array of worktree information
   */
  static async listWorktrees(repoRoot: string): Promise<WorktreeInfo[]> {
    try {
      const output = execSync('git worktree list --porcelain', {
        cwd: repoRoot,
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      const worktrees: WorktreeInfo[] = [];
      const lines = output.trim().split('\n');
      
      let currentWorktree: Partial<WorktreeInfo> = {};

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          // New worktree entry
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
          }
          currentWorktree = {
            path: line.substring('worktree '.length)
          };
        } else if (line.startsWith('HEAD ')) {
          currentWorktree.commit = line.substring('HEAD '.length);
        } else if (line.startsWith('branch ')) {
          currentWorktree.branch = line.substring('branch '.length).replace('refs/heads/', '');
        } else if (line === 'bare') {
          currentWorktree.bare = true;
        } else if (line === '') {
          // Empty line separates worktree entries
          if (currentWorktree.path) {
            worktrees.push(currentWorktree as WorktreeInfo);
            currentWorktree = {};
          }
        }
      }

      // Push last worktree if exists
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }

      return worktrees;
    } catch (error) {
      throw new Error(
        `Failed to list worktrees: ${(error as Error).message}`
      );
    }
  }
}
