#!/usr/bin/env node
/**
 * Skill Sync Engine
 *
 * Propagates skill updates from the main branch to domain worktrees.
 *
 * Usage:
 *   npx tsx scripts/sync-skills.ts                         # Sync all skills to all domains
 *   npx tsx scripts/sync-skills.ts --skill my-skill        # Sync specific skill
 *   npx tsx scripts/sync-skills.ts --domain my-domain      # Sync to specific domain
 *   npx tsx scripts/sync-skills.ts --dry-run               # Show what would change
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const MAIN_BRANCH = process.env.SQUAD_MAIN_BRANCH || 'main';
const SKILLS_DIR = '.squad/skills';
const BRANCH_PREFIX = process.env.SQUAD_BRANCH_PREFIX || 'scan/';

interface SyncState {
  last_sync_from: string;
  last_sync_commit: string;
  last_sync_at: string;
  skills_synced: string[];
}

interface DomainBranch {
  name: string;
  branch: string;
  worktree: string | null;
  needsSync: boolean;
  lastSyncCommit?: string;
  conflicts: string[];
}

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  skill: args.find(a => a.startsWith('--skill='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--skill') || null,
  domain: args.find(a => a.startsWith('--domain='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--domain') || null,
  dryRun: args.includes('--dry-run'),
};

// ==================== Discovery ====================

function discoverWorktrees(): Map<string, string> {
  const worktreeMap = new Map<string, string>();

  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });

    const lines = output.trim().split('\n');
    let currentPath: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        currentPath = line.substring('worktree '.length);
      } else if (line.startsWith('branch ')) {
        const branch = line.substring('branch refs/heads/'.length);
        if (branch.startsWith(BRANCH_PREFIX) && currentPath) {
          worktreeMap.set(branch, currentPath);
        }
      } else if (line === '') {
        currentPath = null;
      }
    }
  } catch (err) {
    console.error('⚠️  Failed to list worktrees:', err);
  }

  return worktreeMap;
}

function discoverBranches(): string[] {
  try {
    const output = execSync(`git branch --list '${BRANCH_PREFIX}*' --format='%(refname:short)'`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });

    return output.trim().split('\n').filter(b => b.length > 0);
  } catch (err) {
    console.error('⚠️  Failed to list branches:', err);
    return [];
  }
}

function getLatestCommitForPath(branch: string, filePath: string): string | null {
  try {
    const commit = execSync(`git log -1 --format=%H ${branch} -- ${filePath}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    return commit || null;
  } catch {
    return null;
  }
}

function readSyncState(branch: string): SyncState | null {
  try {
    const content = execSync(`git show ${branch}:.squad/sync-state.json`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    return JSON.parse(content);
  } catch {
    return null;
  }
}

function discoverSkills(branch: string): string[] {
  try {
    const output = execSync(`git ls-tree --name-only ${branch}:${SKILLS_DIR}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    return output.trim().split('\n').filter(name => name && name !== '');
  } catch {
    return [];
  }
}

function checkForModifiedFiles(branch: string, worktree: string | null, skillName: string): string[] {
  const conflicts: string[] = [];

  if (!worktree) {
    return conflicts;
  }

  try {
    const mainHash = execSync(`git hash-object ${MAIN_BRANCH}:${SKILLS_DIR}/${skillName}/SKILL.md`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const branchHash = execSync(`git hash-object ${branch}:${SKILLS_DIR}/${skillName}/SKILL.md`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (mainHash !== branchHash) {
      const syncState = readSyncState(branch);

      // Check if domain modified after last sync
      if (syncState && syncState.skills_synced.includes(skillName)) {
        conflicts.push(`${skillName}/SKILL.md (modified after sync)`);
      }
    }
  } catch {
    // File doesn't exist
  }

  return conflicts;
}

function discoverDomains(): DomainBranch[] {
  const worktreeMap = discoverWorktrees();
  const branches = discoverBranches();

  if (branches.length === 0) {
    console.warn(`⚠️  No ${BRANCH_PREFIX}* branches found.`);
    return [];
  }

  const domains: DomainBranch[] = [];
  const mainSkillsCommit = getLatestCommitForPath(MAIN_BRANCH, SKILLS_DIR);

  for (const branch of branches) {
    const domainName = branch.substring(BRANCH_PREFIX.length);
    const worktreePath = worktreeMap.get(branch) || null;
    const syncState = readSyncState(branch);

    const needsSync = !syncState ||
                      (mainSkillsCommit && syncState.last_sync_commit !== mainSkillsCommit);

    const conflicts: string[] = [];

    if (flags.skill) {
      conflicts.push(...checkForModifiedFiles(branch, worktreePath, flags.skill));
    }

    domains.push({
      name: domainName,
      branch,
      worktree: worktreePath,
      needsSync,
      lastSyncCommit: syncState?.last_sync_commit,
      conflicts,
    });
  }

  return domains;
}

// ==================== Sync ====================

function syncSkillsToWorktree(
  worktreePath: string,
  branch: string,
  skillName: string | null
): { success: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  try {
    process.chdir(worktreePath);

    // Fetch latest from main
    execSync(`git fetch origin ${MAIN_BRANCH}`, { stdio: 'pipe' });

    // Check for local modifications
    const status = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (status.trim()) {
      console.log(`⚠️  Uncommitted changes in ${worktreePath}, stashing...`);
      execSync('git stash', { stdio: 'inherit' });
    }

    // Checkout specific skill or all skills
    const pathSpec = skillName
      ? `${SKILLS_DIR}/${skillName}/`
      : `${SKILLS_DIR}/`;

    try {
      execSync(`git checkout origin/${MAIN_BRANCH} -- ${pathSpec}`, { stdio: 'pipe' });
    } catch (err) {
      conflicts.push(`Failed to checkout ${pathSpec}`);
      return { success: false, conflicts };
    }

    // Also sync schema file if present
    const schemaPath = 'docs/schemas/domain.schema.json';
    try {
      execSync(`git checkout origin/${MAIN_BRANCH} -- ${schemaPath}`, { stdio: 'pipe' });
    } catch (err) {
      // Schema file might not exist on main yet, not a critical error
      console.log(`⚠️  Could not sync schema file (may not exist on main yet)`);
    }

    // Commit the sync
    const commitMsg = skillName
      ? `sync: update ${skillName} and schema from main`
      : `sync: update all skills and schema from main`;

    execSync('git add .squad/skills/ docs/schemas/', { stdio: 'pipe' });

    const hasChanges = execSync('git diff --cached --quiet', {
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim() === '';

    if (!hasChanges) {
      execSync(`git commit -m "${commitMsg}\n\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"`, {
        stdio: 'pipe',
      });
    }

    // Update sync state
    const mainCommit = getLatestCommitForPath(MAIN_BRANCH, SKILLS_DIR);
    const skillsSynced = skillName
      ? [skillName]
      : discoverSkills(MAIN_BRANCH);

    const syncState: SyncState = {
      last_sync_from: MAIN_BRANCH,
      last_sync_commit: mainCommit || 'unknown',
      last_sync_at: new Date().toISOString(),
      skills_synced: skillsSynced,
    };

    const syncStatePath = path.join(worktreePath, '.squad', 'sync-state.json');
    fs.mkdirSync(path.dirname(syncStatePath), { recursive: true });
    fs.writeFileSync(syncStatePath, JSON.stringify(syncState, null, 2));

    execSync('git add .squad/sync-state.json', { stdio: 'pipe' });
    execSync(`git commit --amend --no-edit`, { stdio: 'pipe' });

    // Pop stash if we had one
    if (status.trim()) {
      try {
        execSync('git stash pop', { stdio: 'pipe' });
      } catch {
        console.log('⚠️  Stash pop had conflicts, leaving stash for manual resolution');
      }
    }

    return { success: true, conflicts: [] };
  } catch (err: any) {
    conflicts.push(err.message);
    return { success: false, conflicts };
  } finally {
    process.chdir(REPO_ROOT);
  }
}

function syncSkillsToBranch(
  branch: string,
  skillName: string | null
): { success: boolean; conflicts: string[] } {
  console.log(`⚠️  ${branch} has no worktree — creating temporary worktree for sync...`);

  const tempDir = path.join(REPO_ROOT, '.squad', 'temp-worktrees', branch.replace('/', '-'));
  const conflicts: string[] = [];

  try {
    fs.mkdirSync(path.dirname(tempDir), { recursive: true });

    execSync(`git worktree add "${tempDir}" ${branch}`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    const result = syncSkillsToWorktree(tempDir, branch, skillName);

    // Remove temp worktree
    execSync(`git worktree remove "${tempDir}"`, {
      cwd: REPO_ROOT,
      stdio: 'pipe',
    });

    return result;
  } catch (err: any) {
    conflicts.push(`Temp worktree failed: ${err.message}`);

    // Cleanup
    try {
      execSync(`git worktree remove --force "${tempDir}"`, {
        cwd: REPO_ROOT,
        stdio: 'pipe',
      });
    } catch {
      // Ignore cleanup errors
    }

    return { success: false, conflicts };
  }
}

// ==================== Reporting ====================

function printReport(
  domains: DomainBranch[],
  syncResults: Map<string, { success: boolean; conflicts: string[] }>
): void {
  const mainCommit = getLatestCommitForPath(MAIN_BRANCH, SKILLS_DIR);
  const mainDate = mainCommit
    ? execSync(`git log -1 --format=%ci ${mainCommit}`, { cwd: REPO_ROOT, encoding: 'utf-8' }).trim()
    : 'unknown';

  console.log('\n📊 Skill Sync Report');
  console.log('━'.repeat(80));
  console.log(`Main skills commit: ${mainCommit?.substring(0, 7)} (${mainDate.substring(0, 10)})`);
  console.log('');

  for (const domain of domains) {
    const result = syncResults.get(domain.name);

    if (!result) {
      if (domain.needsSync) {
        console.log(`⚪ ${domain.name.padEnd(30)} ready to sync`);
      } else {
        console.log(`⚪ ${domain.name.padEnd(30)} already up-to-date`);
      }
    } else if (result.success) {
      const oldCommit = domain.lastSyncCommit?.substring(0, 7) || '(never)';
      const newCommit = mainCommit?.substring(0, 7) || 'unknown';
      console.log(`✅ ${domain.name.padEnd(30)} synced (was ${oldCommit} → now ${newCommit})`);
    } else if (result.conflicts.length > 0) {
      console.log(`⚠️  ${domain.name.padEnd(30)} conflict: ${result.conflicts[0]}`);
      for (let i = 1; i < result.conflicts.length; i++) {
        console.log(`${''.padEnd(33)} ${result.conflicts[i]}`);
      }
    } else {
      console.log(`❌ ${domain.name.padEnd(30)} sync failed`);
    }
  }

  console.log('');
}

// ==================== Main ====================

function main(): void {
  console.log('🔍 Discovering domains...');

  let domains = discoverDomains();

  if (domains.length === 0) {
    console.error(`❌ No ${BRANCH_PREFIX}* branches found.`);
    process.exit(1);
  }

  // Filter by --domain flag if provided
  if (flags.domain) {
    domains = domains.filter(d => d.name === flags.domain);

    if (domains.length === 0) {
      console.error(`❌ Domain not found: ${flags.domain}`);
      process.exit(1);
    }
  }

  console.log(`✅ Found ${domains.length} domain(s)`);

  if (flags.dryRun) {
    console.log('\n🏃 Dry run mode — showing what would be synced\n');
    printReport(domains, new Map());
    return;
  }

  // Perform sync
  console.log('\n🔄 Syncing skills...\n');

  const syncResults = new Map<string, { success: boolean; conflicts: string[] }>();

  for (const domain of domains) {
    if (!domain.needsSync && !flags.skill) {
      continue;
    }

    if (domain.conflicts.length > 0) {
      syncResults.set(domain.name, {
        success: false,
        conflicts: domain.conflicts,
      });
      continue;
    }

    console.log(`📦 Syncing ${domain.name}...`);

    const result = domain.worktree
      ? syncSkillsToWorktree(domain.worktree, domain.branch, flags.skill)
      : syncSkillsToBranch(domain.branch, flags.skill);

    syncResults.set(domain.name, result);
  }

  // Print report
  printReport(domains, syncResults);
}

// Run
try {
  main();
} catch (err: any) {
  console.error('❌ Sync failed:', err.message);
  process.exit(1);
}
