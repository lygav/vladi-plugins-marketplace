#!/usr/bin/env npx tsx
/**
 * Migration Script: v0.1.0 → v0.2.0
 * 
 * Migrates an existing squad-federation-core v0.1.0 federation to v0.2.0.
 * 
 * What this script does:
 * 1. Discovers existing worktree-based teams via `git worktree list`
 * 2. Creates `.squad/teams.json` registry from discovered teams
 * 3. Validates archetype.json exists in each team (warns if missing)
 * 4. Adds version field to learning log entries that lack it
 * 5. Reports what was migrated
 * 
 * Usage:
 *   npx tsx scripts/migrate-v2.ts [--dry-run]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 * 
 * @module migrate-v2
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { TeamRegistry } from './lib/team-registry.js';

// ==================== Types ====================

interface MigrationReport {
  teamsRegistered: number;
  teamsAlreadyRegistered: number;
  learningLogsUpdated: number;
  learningEntriesUpdated: number;
  warnings: string[];
  errors: string[];
}

interface DiscoveredTeam {
  domain: string;
  path: string;
  branch: string;
  hasArchetype: boolean;
  archetypeId?: string;
  archetypeVersion?: string;
}

// ==================== Main ====================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('🔄 Squad Federation Migration: v0.1.0 → v0.2.0\n');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE: No changes will be made\n');
  }

  // Find repository root
  const repoRoot = findRepoRoot();
  console.log(`📁 Repository: ${repoRoot}\n`);

  // Initialize report
  const report: MigrationReport = {
    teamsRegistered: 0,
    teamsAlreadyRegistered: 0,
    learningLogsUpdated: 0,
    learningEntriesUpdated: 0,
    warnings: [],
    errors: [],
  };

  try {
    // Step 1: Discover existing teams
    console.log('📊 Step 1: Discovering existing teams...');
    const teams = await discoverTeams(repoRoot, report);
    console.log(`   Found ${teams.length} team(s)\n`);

    if (teams.length === 0) {
      console.log('⚠️  No teams found. Nothing to migrate.');
      console.log('   If you expected teams, ensure:');
      console.log('   - You are in the repository root');
      console.log('   - Teams exist as git worktrees (run: git worktree list)');
      console.log('   - Team worktrees have .squad/team.md\n');
      return;
    }

    // Step 2: Register teams in registry
    console.log('📝 Step 2: Registering teams in .squad/teams.json...');
    const registry = new TeamRegistry(repoRoot);
    
    for (const team of teams) {
      await registerTeam(registry, team, dryRun, report);
    }
    console.log(`   ${report.teamsRegistered} new team(s) registered`);
    if (report.teamsAlreadyRegistered > 0) {
      console.log(`   ${report.teamsAlreadyRegistered} team(s) already registered`);
    }
    console.log();

    // Step 3: Migrate learning logs
    console.log('📚 Step 3: Migrating learning logs...');
    for (const team of teams) {
      await migrateLearningLog(team, dryRun, report);
    }
    console.log(`   ${report.learningLogsUpdated} log file(s) updated`);
    console.log(`   ${report.learningEntriesUpdated} entry/entries updated\n`);

    // Step 4: Report results
    printReport(report, dryRun);

  } catch (error) {
    console.error('❌ Migration failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ==================== Team Discovery ====================

/**
 * Discover existing teams via git worktree list
 */
async function discoverTeams(repoRoot: string, report: MigrationReport): Promise<DiscoveredTeam[]> {
  const teams: DiscoveredTeam[] = [];

  try {
    const output = execSync('git worktree list --porcelain', {
      cwd: repoRoot,
      encoding: 'utf-8',
    });

    const worktrees = parseWorktreeList(output);

    for (const wt of worktrees) {
      // Check if this is a squad team (has .squad/team.md)
      const teamMdPath = path.join(wt.path, '.squad', 'team.md');
      if (!fsSync.existsSync(teamMdPath)) {
        continue; // Not a squad team, skip
      }

      // Check for archetype metadata
      const archetypePath = path.join(wt.path, '.squad', 'archetype.json');
      const hasArchetype = fsSync.existsSync(archetypePath);
      
      let archetypeId: string | undefined;
      let archetypeVersion: string | undefined;
      
      if (hasArchetype) {
        try {
          const archetypeData = JSON.parse(fsSync.readFileSync(archetypePath, 'utf-8'));
          archetypeId = archetypeData.id;
          archetypeVersion = archetypeData.version;
        } catch (error) {
          report.warnings.push(`Failed to parse archetype.json for team "${wt.domain}": ${error instanceof Error ? error.message : error}`);
        }
      } else {
        report.warnings.push(`Team "${wt.domain}" missing .squad/archetype.json`);
      }

      teams.push({
        domain: wt.domain,
        path: wt.path,
        branch: wt.branch,
        hasArchetype,
        archetypeId,
        archetypeVersion,
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('not a git repository')) {
      throw new Error(
        'Not a git repository. Run this script from the repository root.\n' +
        'Current directory: ' + process.cwd()
      );
    }
    throw error;
  }

  return teams;
}

/**
 * Parse git worktree list --porcelain output
 */
function parseWorktreeList(output: string): Array<{ path: string; branch: string; domain: string }> {
  const worktrees: Array<{ path: string; branch: string; domain: string }> = [];
  const lines = output.split('\n');
  
  let currentWorktree: Partial<{ path: string; branch: string }> = {};
  
  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      currentWorktree.path = line.substring('worktree '.length);
    } else if (line.startsWith('branch ')) {
      currentWorktree.branch = line.substring('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === '' && currentWorktree.path) {
      // End of worktree entry
      if (currentWorktree.path && currentWorktree.branch) {
        const domain = extractDomainFromBranch(currentWorktree.branch);
        worktrees.push({
          path: currentWorktree.path,
          branch: currentWorktree.branch,
          domain,
        });
      }
      currentWorktree = {};
    }
  }
  
  // Handle last entry
  if (currentWorktree.path && currentWorktree.branch) {
    const domain = extractDomainFromBranch(currentWorktree.branch);
    worktrees.push({
      path: currentWorktree.path,
      branch: currentWorktree.branch,
      domain,
    });
  }
  
  return worktrees;
}

/**
 * Extract domain name from branch name (e.g., "squad/frontend" -> "frontend")
 */
function extractDomainFromBranch(branch: string): string {
  const parts = branch.split('/');
  return parts.length > 1 ? parts[parts.length - 1] : branch;
}

// ==================== Team Registration ====================

/**
 * Register a discovered team in the registry
 */
async function registerTeam(
  registry: TeamRegistry,
  team: DiscoveredTeam,
  dryRun: boolean,
  report: MigrationReport
): Promise<void> {
  // Check if already registered
  const exists = await registry.exists(team.domain);
  if (exists) {
    report.teamsAlreadyRegistered++;
    return;
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would register: ${team.domain} (${team.path})`);
    report.teamsRegistered++;
    return;
  }

  try {
    await registry.register({
      domain: team.domain,
      domainId: team.domain, // Use domain as ID for v0.1.0 compatibility
      transport: 'worktree',
      location: team.path,
      createdAt: new Date().toISOString(),
      metadata: {
        branch: team.branch,
        migrated: true,
        migratedAt: new Date().toISOString(),
        archetypeId: team.archetypeId,
        archetypeVersion: team.archetypeVersion,
      },
    });
    
    console.log(`   ✅ Registered: ${team.domain}`);
    report.teamsRegistered++;
  } catch (error) {
    const message = `Failed to register team "${team.domain}": ${error instanceof Error ? error.message : error}`;
    report.errors.push(message);
    console.log(`   ❌ ${message}`);
  }
}

// ==================== Learning Log Migration ====================

/**
 * Migrate learning log for a team (add version field to entries)
 */
async function migrateLearningLog(
  team: DiscoveredTeam,
  dryRun: boolean,
  report: MigrationReport
): Promise<void> {
  const logPath = path.join(team.path, '.squad', 'learnings', 'log.jsonl');
  
  // Check if log exists
  if (!fsSync.existsSync(logPath)) {
    return; // No learning log, nothing to migrate
  }

  try {
    // Read log entries
    const content = await fs.readFile(logPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return; // Empty log, nothing to migrate
    }

    let updated = false;
    const updatedLines: string[] = [];
    let entriesUpdated = 0;

    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        // Check if version field is missing
        if (!entry.version) {
          entry.version = '1.0'; // Add version field
          entriesUpdated++;
          updated = true;
        }
        
        updatedLines.push(JSON.stringify(entry));
      } catch (error) {
        // Invalid JSON, keep original line
        report.warnings.push(`Invalid JSON in learning log for team "${team.domain}": ${line.substring(0, 50)}...`);
        updatedLines.push(line);
      }
    }

    if (updated) {
      if (dryRun) {
        console.log(`   [DRY RUN] Would update learning log for ${team.domain}: ${entriesUpdated} entries`);
        report.learningLogsUpdated++;
        report.learningEntriesUpdated += entriesUpdated;
      } else {
        // Write updated log
        await fs.writeFile(logPath, updatedLines.join('\n') + '\n', 'utf-8');
        console.log(`   ✅ Updated learning log for ${team.domain}: ${entriesUpdated} entries`);
        report.learningLogsUpdated++;
        report.learningEntriesUpdated += entriesUpdated;
      }
    }
  } catch (error) {
    const message = `Failed to migrate learning log for team "${team.domain}": ${error instanceof Error ? error.message : error}`;
    report.warnings.push(message);
  }
}

// ==================== Utilities ====================

/**
 * Find repository root by walking up directories looking for .git
 */
function findRepoRoot(): string {
  let current = process.cwd();
  
  while (current !== '/') {
    if (fsSync.existsSync(path.join(current, '.git'))) {
      return current;
    }
    current = path.dirname(current);
  }
  
  throw new Error(
    'Not in a git repository. Run this script from inside your repository.\n' +
    'Current directory: ' + process.cwd()
  );
}

/**
 * Print migration report
 */
function printReport(report: MigrationReport, dryRun: boolean): void {
  console.log('═══════════════════════════════════════════════════════');
  console.log(dryRun ? '🔍 DRY RUN SUMMARY' : '✅ MIGRATION COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');

  console.log('Teams:');
  console.log(`  Registered: ${report.teamsRegistered}`);
  if (report.teamsAlreadyRegistered > 0) {
    console.log(`  Already Registered: ${report.teamsAlreadyRegistered}`);
  }

  if (report.learningLogsUpdated > 0 || report.learningEntriesUpdated > 0) {
    console.log('\nLearning Logs:');
    console.log(`  Files Updated: ${report.learningLogsUpdated}`);
    console.log(`  Entries Updated: ${report.learningEntriesUpdated}`);
  }

  if (report.warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    report.warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (report.errors.length > 0) {
    console.log('\n❌ Errors:');
    report.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (dryRun) {
    console.log('\n💡 To apply these changes, run without --dry-run:');
    console.log('   npx tsx scripts/migrate-v2.ts\n');
  } else {
    console.log('\n📝 Registry: .squad/teams.json');
    console.log('\n🎉 Migration successful! Your federation is now v0.2.0-compatible.\n');
    console.log('Next steps:');
    console.log('  1. Verify: npx tsx scripts/monitor.ts');
    console.log('  2. Test: npx tsx scripts/launch.ts <team-name>');
    console.log('  3. See MIGRATION.md for detailed upgrade guide\n');
  }
}

// ==================== Entry Point ====================

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
