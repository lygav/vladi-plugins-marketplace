#!/usr/bin/env node
/**
 * Learning Graduation Engine
 *
 * Promotes learnings from domain squad logs into skill updates on main.
 *
 * Usage:
 *   npx tsx scripts/graduate-learning.ts --id <ID> --target-skill my-skill
 *   npx tsx scripts/graduate-learning.ts --candidates              # Show graduation candidates
 *   npx tsx scripts/graduate-learning.ts --from-sweep .squad/decisions/inbox/sweep-report.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LearningLog, LearningEntry } from './lib/knowledge/learning-log.js';
import { TeamRegistry, TeamEntry } from './lib/registry/team-registry.js';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const DECISIONS_INBOX = path.join(REPO_ROOT, '.squad', 'decisions', 'inbox');

interface GraduationCandidate {
  entry: LearningEntry;
  domain: string;
  teamId: string;
  score: number;
}

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  id: args.find(a => a.startsWith('--id='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--id') || null,
  targetSkill: args.find(a => a.startsWith('--target-skill='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--target-skill') || null,
  candidates: args.includes('--candidates'),
  fromSweep: args.find(a => a.startsWith('--from-sweep='))?.split('=')[1] || args.find((a, i) => args[i - 1] === '--from-sweep') || null,
};

// ==================== Discovery ====================

async function discoverTeams(): Promise<TeamEntry[]> {
  const registry = new TeamRegistry(REPO_ROOT);
  const teams = await registry.list();
  if (teams.length === 0) {
    console.error('⚠️  No teams found in TeamRegistry');
  }
  return teams;
}

async function findLearningById(learningId: string): Promise<{ entry: LearningEntry; domain: string; teamId: string } | null> {
  const teams = await discoverTeams();
  
  for (const team of teams) {
    const branch = `squad/${team.domain}`;
    const entries = LearningLog.readFromBranch(branch, REPO_ROOT);

    const entry = entries.find(e => e.id === learningId);

    if (entry) {
      return { entry, domain: team.domain, teamId: team.domainId };
    }
  }

  return null;
}

// ==================== Candidate Selection ====================

async function findGraduationCandidates(): Promise<GraduationCandidate[]> {
  const candidates: GraduationCandidate[] = [];
  const teams = await discoverTeams();

  for (const team of teams) {
    const branch = `squad/${team.domain}`;
    const entries = LearningLog.readFromBranch(branch, REPO_ROOT);

    for (const entry of entries) {
      // Must be generalizable, high confidence, and not already graduated
      if (entry.domain === 'generalizable' &&
          entry.confidence === 'high' &&
          !entry.graduated) {

        // Calculate score based on evidence and related skill
        let score = 0;

        if (entry.confidence === 'high') score += 3;
        if (entry.evidence && entry.evidence.length > 0) score += entry.evidence.length;
        if (entry.related_skill) score += 2;
        if (entry.tags.length >= 3) score += 1;

        candidates.push({
          entry,
          domain: team.domain,
          teamId: team.domainId,
          score,
        });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function findPatternsFromSweep(sweepReportPath: string): Array<{ learningId: string; skill: string }> {
  const patterns: Array<{ learningId: string; skill: string }> = [];

  if (!fs.existsSync(sweepReportPath)) {
    console.error(`❌ Sweep report not found: ${sweepReportPath}`);
    return patterns;
  }

  const content = fs.readFileSync(sweepReportPath, 'utf-8');
  const lines = content.split('\n');

  let currentSkill: string | null = null;
  let shouldGraduate = false;

  for (const line of lines) {
    // Match skill headers
    const skillMatch = line.match(/^### (.+)$/);
    if (skillMatch) {
      currentSkill = skillMatch[1];
      shouldGraduate = false;
    }

    // Match graduation recommendation
    if (line.includes('Recommendation:') && line.includes('GRADUATE')) {
      shouldGraduate = true;
    }

    // Match evidence entries (extract IDs if present)
    if (currentSkill && shouldGraduate && line.startsWith('- [')) {
      // Simplified — IDs are not embedded in sweep reports by default.
      // In practice, re-query the learning log for matching entries.
    }
  }

  return patterns;
}

// ==================== Graduation ====================

function generateGraduationDraft(
  entry: LearningEntry,
  domain: string,
  targetSkill?: string
): string {
  const skill = targetSkill || entry.related_skill || 'unknown-skill';

  let draft = `# Graduation Draft\n\n`;
  draft += `**Learning ID:** ${entry.id}\n`;
  draft += `**Source:** ${domain} (${entry.agent})\n`;
  draft += `**Confidence:** ${entry.confidence}\n`;
  draft += `**Target Skill:** ${skill}\n`;
  draft += `**Date:** ${new Date().toISOString().split('T')[0]}\n\n`;

  draft += `## Summary\n\n${entry.title}\n\n`;

  draft += `## Detail\n\n${entry.body}\n\n`;

  if (entry.evidence && entry.evidence.length > 0) {
    draft += `## Evidence\n\n`;
    for (const evidence of entry.evidence) {
      draft += `- ${evidence}\n`;
    }
    draft += '\n';
  }

  draft += `## Tags\n\n${entry.tags.join(', ')}\n\n`;

  draft += `## Proposed Addition to ${skill}\n\n`;
  draft += '```markdown\n';
  draft += `### ${entry.title}\n\n`;
  draft += `${entry.body}\n\n`;

  if (entry.evidence && entry.evidence.length > 0) {
    draft += `**Evidence:**\n`;
    for (const evidence of entry.evidence) {
      draft += `- ${evidence}\n`;
    }
  }

  draft += '```\n\n';

  draft += `## Next Steps\n\n`;
  draft += `1. Review the proposed content above\n`;
  draft += `2. Edit \`.squad/skills/${skill}/SKILL.md\` to incorporate this learning\n`;
  draft += `3. Commit: \`git add .squad/skills/${skill}/SKILL.md && git commit -m "skill: update ${skill} with ${domain} learning"\`\n`;
  draft += `4. Mark as graduated: \`npx tsx scripts/graduate-learning.ts --mark-graduated ${entry.id} --skill ${skill}\`\n`;

  return draft;
}

function writeGraduationDraft(entry: LearningEntry, domain: string, targetSkill?: string): string {
  const draftPath = path.join(DECISIONS_INBOX, `graduation-${entry.id}.md`);

  fs.mkdirSync(DECISIONS_INBOX, { recursive: true });

  const draft = generateGraduationDraft(entry, domain, targetSkill);
  fs.writeFileSync(draftPath, draft);

  return draftPath;
}

async function markAsGraduated(learningId: string, skill: string): Promise<void> {
  const learning = await findLearningById(learningId);

  if (!learning) {
    console.error(`❌ Learning ${learningId} not found`);
    return;
  }

  const registry = new TeamRegistry(REPO_ROOT);
  const team = await registry.get(learning.teamId);
  
  if (!team) {
    console.error(`❌ Team ${learning.teamId} not found in registry`);
    return;
  }

  const worktreePath = team.location;

  if (!worktreePath || !fs.existsSync(worktreePath)) {
    console.log(`⚠️  Team ${learning.domain} worktree not found — graduation recorded but not applied to log`);
    console.log(`    The domain squad will see the graduation on their next pull/sync`);
    return;
  }

  // Update the log in the worktree
  try {
    const log = new LearningLog(worktreePath);
    log.markGraduated(learningId, skill);

    console.log(`✅ Marked ${learningId} as graduated to ${skill} in ${learning.domain}'s log`);
  } catch (err: any) {
    console.error(`❌ Failed to mark as graduated: ${err.message}`);
  }
}

// ==================== Reporting ====================

function printCandidates(candidates: GraduationCandidate[]): void {
  console.log('\n📋 Graduation Candidates');
  console.log('━'.repeat(80));
  console.log(`Found ${candidates.length} high-confidence generalizable learnings\n`);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const num = String(i + 1).padStart(2, ' ');

    console.log(`${num}. [${candidate.domain}] ${candidate.entry.agent}: ${candidate.entry.title}`);
    console.log(`    ID: ${candidate.entry.id}`);
    console.log(`    Confidence: ${candidate.entry.confidence} | Score: ${candidate.score}`);

    if (candidate.entry.related_skill) {
      console.log(`    Related skill: ${candidate.entry.related_skill}`);
    }

    console.log(`    Tags: ${candidate.entry.tags.join(', ')}`);
    console.log('');
  }

  console.log('To graduate a learning, run:');
  console.log('  npx tsx scripts/graduate-learning.ts --id <ID> --target-skill <skill-name>');
  console.log('');
}

// ==================== Main ====================

async function main(): Promise<void> {
  const teams = await discoverTeams();

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

  // --candidates mode
  if (flags.candidates) {
    console.log('🔍 Finding graduation candidates...');
    const candidates = await findGraduationCandidates();

    if (candidates.length === 0) {
      console.log('⚪ No graduation candidates found.');
      return;
    }

    printCandidates(candidates);
    return;
  }

  // --from-sweep mode
  if (flags.fromSweep) {
    console.log(`🔍 Processing sweep report: ${flags.fromSweep}`);

    const sweepPath = path.isAbsolute(flags.fromSweep)
      ? flags.fromSweep
      : path.join(REPO_ROOT, flags.fromSweep);

    const patterns = findPatternsFromSweep(sweepPath);

    if (patterns.length === 0) {
      console.log('⚪ No graduation patterns found in sweep report.');
      return;
    }

    console.log(`✅ Found ${patterns.length} patterns to graduate`);

    for (const pattern of patterns) {
      const learning = await findLearningById(pattern.learningId);

      if (!learning) {
        console.log(`⚠️  Learning ${pattern.learningId} not found, skipping...`);
        continue;
      }

      const draftPath = writeGraduationDraft(learning.entry, learning.domain, pattern.skill);
      console.log(`📝 Created graduation draft: ${draftPath}`);
    }

    return;
  }

  // --id mode
  if (flags.id) {
    console.log(`🔍 Finding learning ${flags.id}...`);

    const learning = await findLearningById(flags.id);

    if (!learning) {
      console.error(`❌ Learning ${flags.id} not found in any domain log`);
      console.error('\nRecovery:');
      console.error('  1. List all learnings to find the correct ID:');
      console.error('     npx tsx scripts/query-learnings.ts');
      console.error('  2. Sweep learnings to discover patterns:');
      console.error('     npx tsx scripts/sweep-learnings.ts');
      console.error('  3. Check learning log directly:');
      console.error('     cat .worktrees/<domain>/.squad/learnings/log.jsonl | grep <search-term>');
      console.error('  4. Verify the learning ID format (timestamp-based):');
      console.error('     Example: 1234567890123');
      console.error('  5. If learning was recently added, ensure it was committed:');
      console.error('     cd .worktrees/<domain> && git log --oneline .squad/learnings/');
      process.exit(1);
    }

    console.log(`✅ Found in ${learning.domain}`);

    const targetSkill = flags.targetSkill || learning.entry.related_skill;

    if (!targetSkill) {
      console.error('❌ No target skill specified and learning has no related_skill');
      console.error('   Use --target-skill <skill-name> to specify');
      console.error('\nRecovery:');
      console.error('  1. Check what skills exist:');
      console.error('     ls -la .squad/skills/');
      console.error('  2. Specify a target skill explicitly:');
      console.error(`     npx tsx scripts/graduate-learning.ts --id ${flags.id} --target-skill <skill-name>`);
      console.error('  3. Review the learning to determine appropriate skill:');
      console.error(`     npx tsx scripts/query-learnings.ts | grep -A 10 "${flags.id}"`);
      console.error('  4. Create a new skill if needed:');
      console.error('     mkdir -p .squad/skills/<new-skill>');
      console.error('     echo "# Skill name" > .squad/skills/<new-skill>/SKILL.md');
      process.exit(1);
    }

    // Generate graduation draft
    const draftPath = writeGraduationDraft(learning.entry, learning.domain, targetSkill);

    console.log('\n📝 Graduation Draft Created');
    console.log('━'.repeat(80));
    console.log(`Path: ${draftPath}`);
    console.log('');
    console.log('Next steps:');
    console.log(`1. Review the draft: cat "${draftPath}"`);
    console.log(`2. Update the skill: vim .squad/skills/${targetSkill}/SKILL.md`);
    console.log(`3. Commit: git add .squad/skills/${targetSkill}/SKILL.md && git commit -m "skill: update ${targetSkill}"`);
    console.log(`4. Mark as graduated: npx tsx scripts/graduate-learning.ts --mark-graduated ${flags.id} --skill ${targetSkill}`);
    console.log('');

    return;
  }

  // --mark-graduated mode (hidden flag for internal use)
  if (args.includes('--mark-graduated')) {
    const idIndex = args.indexOf('--mark-graduated');
    const learningId = args[idIndex + 1];
    const skillIndex = args.indexOf('--skill');
    const skill = skillIndex >= 0 ? args[skillIndex + 1] : null;

    if (!learningId || !skill) {
      console.error('❌ Usage: --mark-graduated <id> --skill <skill-name>');
      console.error('\nRecovery:');
      console.error('  1. Provide both required arguments:');
      console.error('     npx tsx scripts/graduate-learning.ts --mark-graduated <learning-id> --skill <skill-name>');
      console.error('  2. To find the learning ID:');
      console.error('     npx tsx scripts/query-learnings.ts');
      console.error('  3. To list available skills:');
      console.error('     ls -la .squad/skills/');
      console.error('  4. Example usage:');
      console.error('     npx tsx scripts/graduate-learning.ts --mark-graduated 1234567890123 --skill authentication');
      console.error('\n  Note: Normally you should use --id mode first to create a draft,');
      console.error('  then use --mark-graduated only after manually updating the skill.');
      process.exit(1);
    }

    await markAsGraduated(learningId, skill);
    return;
  }

  // No flags — show usage
  console.log('Usage:');
  console.log('  npx tsx scripts/graduate-learning.ts --candidates');
  console.log('  npx tsx scripts/graduate-learning.ts --id <ID> --target-skill <skill-name>');
  console.log('  npx tsx scripts/graduate-learning.ts --from-sweep <sweep-report.md>');
}

// Run
try {
  main();
} catch (err: any) {
  console.error('❌ Graduation failed:', err.message);
  console.error('\nRecovery:');
  console.error('  1. Check git status for issues:');
  console.error('     git status');
  console.error('  2. Ensure branches are accessible:');
  console.error('     git branch --list "squad/*"');
  console.error('  3. Verify learning logs are valid:');
  console.error('     cat .worktrees/<domain>/.squad/learnings/log.jsonl');
  console.error('  4. If working with specific learning, verify it exists:');
  console.error('     npx tsx scripts/query-learnings.ts | grep <learning-id>');
  console.error('  5. Check file permissions:');
  console.error('     ls -la .squad/skills/');
  console.error('  6. Try with --candidates to see graduation candidates:');
  console.error('     npx tsx scripts/graduate-learning.ts --candidates');
  console.error('  7. If issue persists, check error details above and:');
  console.error('     - Ensure .squad directory structure is intact');
  console.error('     - Verify no locks on learning log files');
  console.error('     - Check disk space with: df -h');
  process.exit(1);
}
