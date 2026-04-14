#!/usr/bin/env node
/**
 * Skill Sync Engine
 *
 * Propagates skill updates from the main branch to team worktrees.
 *
 * Usage:
 *   npx tsx scripts/sync-skills.ts                         # Sync all skills to all teams
 *   npx tsx scripts/sync-skills.ts --skill my-skill        # Sync specific skill
 *   npx tsx scripts/sync-skills.ts --team my-team          # Sync to specific team
 *   npx tsx scripts/sync-skills.ts --dry-run               # Show what would change
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TeamRegistry } from './lib/registry/team-registry.js';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const MAIN_BRANCH = process.env.SQUAD_MAIN_BRANCH || 'main';
const SKILLS_DIR = '.squad/skills';

interface SyncState {
  last_sync_from: string;
  last_sync_commit: string;
  last_sync_at: string;
  skills_synced: string[];
}

interface TeamSyncInfo {
  domain: string;
  teamId: string;
  worktree: string | null;
  needsSync: boolean;
  lastSyncCommit?: string;
  conflicts: string[];
}

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  skill: args.find(a => a.startsWith('--skill='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--skill') || null,
  domain: args.find(a => a.startsWith('--team='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--team') || null,
  dryRun: args.includes('--dry-run'),
};

// ==================== Discovery ====================

async function discoverTeams(): Promise<TeamSyncInfo[]> {
  const registry = new TeamRegistry(REPO_ROOT);
  const teams = await registry.list();

  if (teams.length === 0) {
    console.warn(`⚠️  No teams found in TeamRegistry.`);
    return [];
  }

  const teamInfos: TeamSyncInfo[] = [];
  const mainSkillsCommit = getLatestCommitForPath(MAIN_BRANCH, SKILLS_DIR);

  for (const team of teams) {
    const worktreePath = team.location && fs.existsSync(team.location) ? team.location : null;
    
    // Read sync state from team's worktree if it exists
    const syncStatePath = worktreePath ? path.join(worktreePath, '.squad', 'sync-state.json') : null;
    const syncState = syncStatePath && fs.existsSync(syncStatePath) 
      ? JSON.parse(fs.readFileSync(syncStatePath, 'utf-8')) 
      : null;

    const needsSync = !syncState ||
                      !!(mainSkillsCommit && syncState.last_sync_commit !== mainSkillsCommit);

    const conflicts: string[] = [];

    if (flags.skill && worktreePath) {
      conflicts.push(...checkForModifiedFiles(worktreePath, flags.skill, team.domain));
    }

    teamInfos.push({
      domain: team.domain,
      teamId: team.domainId,
      worktree: worktreePath,
      needsSync,
      lastSyncCommit: syncState?.last_sync_commit,
      conflicts,
    });
  }

  return teamInfos;
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

function checkForModifiedFiles(worktree: string, skillName: string, domain: string): string[] {
  const conflicts: string[] = [];

  try {
    const mainHash = execSync(`git hash-object ${MAIN_BRANCH}:${SKILLS_DIR}/${skillName}/SKILL.md`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    const branch = `squad/${domain}`;
    const branchHash = execSync(`git hash-object ${branch}:${SKILLS_DIR}/${skillName}/SKILL.md`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    if (mainHash !== branchHash) {
      // Read sync state from the worktree's filesystem
      const syncStatePath = path.join(worktree, '.squad', 'sync-state.json');
      const syncState = fs.existsSync(syncStatePath)
        ? JSON.parse(fs.readFileSync(syncStatePath, 'utf-8'))
        : null;

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

// ==================== Sync ====================

function syncSkillsToWorktree(
  worktreePath: string,
  branch: string,
  skillName: string | null
): { success: boolean; conflicts: string[] } {
  const conflicts: string[] = [];

  try {
    process.chdir(worktreePath);

    // Fetch latest from main — worktrees share the same .git, so fetch from repo root
    try {
      execSync(`git fetch origin ${MAIN_BRANCH}`, { cwd: REPO_ROOT, stdio: 'pipe' });
    } catch {
      // Fetch may fail if no remote; fall back to local refs
      console.log(`⚠️  Could not fetch origin/${MAIN_BRANCH}, using local refs`);
    }

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
    } catch {
      // origin/ ref may not exist; try local branch ref
      try {
        execSync(`git checkout ${MAIN_BRANCH} -- ${pathSpec}`, { stdio: 'pipe' });
      } catch (err) {
        conflicts.push(`Failed to checkout ${pathSpec}`);
        return { success: false, conflicts };
      }
    }

    // Commit the sync
    const commitMsg = skillName
      ? `sync: update ${skillName} from main`
      : `sync: update all skills from main`;

    execSync('git add .squad/skills/', { stdio: 'pipe' });

    const hasChanges = execSync('git diff --cached --name-only', {
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim().length > 0;

    if (hasChanges) {
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
    console.error('\nRecovery:');
    console.error('  1. Check if git is in a clean state:');
    console.error('     git status');
    console.error('  2. Remove stale temp worktrees:');
    console.error(`     rm -rf ${REPO_ROOT}/.squad/temp-worktrees/*`);
    console.error('     git worktree prune');
    console.error('  3. Verify branch exists:');
    console.error(`     git branch --list "${branch}"`);
    console.error('  4. Check disk space:');
    console.error('     df -h');
    console.error('  5. Retry sync operation');

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
  teams: TeamSyncInfo[],
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

  for (const team of teams) {
    const result = syncResults.get(team.domain);

    if (!result) {
      if (team.needsSync) {
        console.log(`⚪ ${team.domain.padEnd(30)} ready to sync`);
      } else {
        console.log(`⚪ ${team.domain.padEnd(30)} already up-to-date`);
      }
    } else if (result.success) {
      const oldCommit = team.lastSyncCommit?.substring(0, 7) || '(never)';
      const newCommit = mainCommit?.substring(0, 7) || 'unknown';
      console.log(`✅ ${team.domain.padEnd(30)} synced (was ${oldCommit} → now ${newCommit})`);
    } else if (result.conflicts.length > 0) {
      console.log(`⚠️  ${team.domain.padEnd(30)} conflict: ${result.conflicts[0]}`);
      for (let i = 1; i < result.conflicts.length; i++) {
        console.log(`${''.padEnd(33)} ${result.conflicts[i]}`);
      }
    } else {
      console.log(`❌ ${team.domain.padEnd(30)} sync failed`);
    }
  }

  console.log('');
}

// ==================== Main ====================

async function main(): Promise<void> {
  console.log('🔍 Discovering teams...');

  let teams = await discoverTeams();

  if (teams.length === 0) {
    console.error(`❌ No teams found in TeamRegistry.`);
    console.error('\nRecovery:');
    console.error('  1. Check if federation is configured:');
    console.error('     cat federate.config.json');
    console.error('  2. Check team registry:');
    console.error('     cat .squad/teams.json');
    console.error('  3. If no teams exist, onboard a team first:');
    console.error('     npx tsx scripts/onboard.ts --name <domain> --domain-id <id> --archetype <name>');
    console.error('  4. Check git worktrees:');
    console.error('     git worktree list');
    process.exit(1);
  }

  // Filter by --team flag if provided
  if (flags.domain) {
    teams = teams.filter(t => t.domain === flags.domain);

    if (teams.length === 0) {
      console.error(`❌ Team not found: ${flags.domain}`);
      console.error('\nRecovery:');
      console.error('  1. List all available teams:');
      console.error('     cat .squad/teams.json');
      console.error('  2. Or view all teams:');
      console.error('     npx tsx scripts/monitor.ts');
      console.error('  3. Verify domain name spelling (case-sensitive)');
      console.error('  4. If team should exist, check team registry:');
      console.error('     cat .squad/teams.json');
      console.error('  5. To onboard this team:');
      console.error(`     npx tsx scripts/onboard.ts --name ${flags.domain} --domain-id <id> --archetype <name>`);
      process.exit(1);
    }
  }

  console.log(`✅ Found ${teams.length} team(s)`);

  if (flags.dryRun) {
    console.log('\n🏃 Dry run mode — showing what would be synced\n');
    printReport(teams, new Map());
    return;
  }

  // Perform sync
  console.log('\n🔄 Syncing skills...\n');

  const syncResults = new Map<string, { success: boolean; conflicts: string[] }>();

  for (const team of teams) {
    if (!team.needsSync && !flags.skill) {
      continue;
    }

    if (team.conflicts.length > 0) {
      syncResults.set(team.domain, {
        success: false,
        conflicts: team.conflicts,
      });
      continue;
    }

    if (!team.worktree) {
      console.log(`⚠️  Skipping ${team.domain} — no worktree available`);
      continue;
    }

    console.log(`📦 Syncing ${team.domain}...`);

    const result = syncSkillsToWorktree(team.worktree, MAIN_BRANCH, flags.skill);

    syncResults.set(team.domain, result);
  }

  // Print report
  printReport(teams, syncResults);
}

// Run
try {
  main();
} catch (err: any) {
  console.error('❌ Sync failed:', err.message);
  console.error('\nRecovery:');
  console.error('  1. Check git status for conflicts:');
  console.error('     git status');
  console.error('  2. If there are uncommitted changes, stash or commit them:');
  console.error('     git stash');
  console.error('  3. Ensure main branch is up-to-date:');
  console.error('     git checkout main && git pull');
  console.error('  4. Verify skills directory exists on main:');
  console.error('     ls -la .squad/skills/');
  console.error('  5. Check if worktree is in a clean state:');
  console.error('     cd <worktree> && git status');
  console.error('  6. Try with --dry-run to see what would be synced:');
  console.error('     npx tsx scripts/sync-skills.ts --dry-run');
  console.error('  7. If sync conflicts persist, resolve manually:');
  console.error('     cd <worktree> && git checkout main -- .squad/skills/<skill>');
  process.exit(1);
}
