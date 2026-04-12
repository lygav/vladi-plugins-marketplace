#!/usr/bin/env node
/**
 * Learning Sweep Engine
 *
 * Cross-domain pattern detection: reads ALL domain learning logs
 * and identifies generalizable patterns.
 *
 * Usage:
 *   npx tsx scripts/sweep-learnings.ts                                # Sweep all domains
 *   npx tsx scripts/sweep-learnings.ts --min-occurrences 2            # Require N occurrences
 *   npx tsx scripts/sweep-learnings.ts --output .squad/decisions/inbox/sweep-report.md
 *   npx tsx scripts/sweep-learnings.ts --tags "ci,deployment"         # Focus on specific tags
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { LearningLog, LearningEntry } from './lib/learning-log.js';

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const BRANCH_PREFIX = process.env.FEDERATE_BRANCH_PREFIX || 'squad/';

interface Pattern {
  topic: string;
  occurrences: number;
  domains: string[];
  entries: Array<{ domain: string; entry: LearningEntry }>;
  tags: string[];
  relatedSkill?: string;
}

// Parse CLI args
const args = process.argv.slice(2);
const flags = {
  minOccurrences: parseInt(args.find(a => a.startsWith('--min-occurrences='))?.split('=')[1] || '2'),
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || null,
  tags: args.find(a => a.startsWith('--tags='))?.split('=')[1]?.split(',') || null,
};

// ==================== Discovery ====================

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

// ==================== Collection ====================

function collectGeneralizableLearnings(branches: string[]): Map<string, LearningEntry[]> {
  const learningsByDomain = new Map<string, LearningEntry[]>();

  for (const branch of branches) {
    const domainName = branch.substring(BRANCH_PREFIX.length);
    console.log(`📖 Reading ${domainName}...`);

    const entries = LearningLog.readFromBranch(branch, REPO_ROOT);

    // Filter for generalizable, non-graduated entries
    const generalizable = entries.filter(e =>
      e.domain === 'generalizable' &&
      !e.graduated
    );

    // Apply tag filter if specified
    if (flags.tags) {
      const filtered = generalizable.filter(e =>
        flags.tags!.some(tag =>
          e.tags.some(entryTag => entryTag.toLowerCase().includes(tag.toLowerCase()))
        )
      );

      if (filtered.length > 0) {
        learningsByDomain.set(domainName, filtered);
      }
    } else if (generalizable.length > 0) {
      learningsByDomain.set(domainName, generalizable);
    }
  }

  return learningsByDomain;
}

// ==================== Pattern Detection ====================

function groupByTags(learningsByDomain: Map<string, LearningEntry[]>): Pattern[] {
  const tagGroups = new Map<string, Pattern>();

  for (const [domain, entries] of learningsByDomain.entries()) {
    for (const entry of entries) {
      for (const tag of entry.tags) {
        const normalizedTag = tag.toLowerCase();

        if (!tagGroups.has(normalizedTag)) {
          tagGroups.set(normalizedTag, {
            topic: tag,
            occurrences: 0,
            domains: [],
            entries: [],
            tags: [tag],
          });
        }

        const pattern = tagGroups.get(normalizedTag)!;

        if (!pattern.domains.includes(domain)) {
          pattern.domains.push(domain);
          pattern.occurrences++;
        }

        pattern.entries.push({ domain, entry });
      }
    }
  }

  // Filter by min occurrences
  return Array.from(tagGroups.values())
    .filter(p => p.occurrences >= flags.minOccurrences)
    .sort((a, b) => b.occurrences - a.occurrences);
}

function groupByRelatedSkill(learningsByDomain: Map<string, LearningEntry[]>): Pattern[] {
  const skillGroups = new Map<string, Pattern>();

  for (const [domain, entries] of learningsByDomain.entries()) {
    for (const entry of entries) {
      if (!entry.related_skill) continue;

      const skill = entry.related_skill;

      if (!skillGroups.has(skill)) {
        skillGroups.set(skill, {
          topic: `Skill: ${skill}`,
          occurrences: 0,
          domains: [],
          entries: [],
          tags: [],
          relatedSkill: skill,
        });
      }

      const pattern = skillGroups.get(skill)!;

      if (!pattern.domains.includes(domain)) {
        pattern.domains.push(domain);
        pattern.occurrences++;
      }

      pattern.entries.push({ domain, entry });

      // Collect unique tags
      for (const tag of entry.tags) {
        if (!pattern.tags.includes(tag)) {
          pattern.tags.push(tag);
        }
      }
    }
  }

  return Array.from(skillGroups.values())
    .filter(p => p.occurrences >= flags.minOccurrences)
    .sort((a, b) => b.occurrences - a.occurrences);
}

function groupBySimilarity(learningsByDomain: Map<string, LearningEntry[]>): Pattern[] {
  const patterns: Pattern[] = [];
  const processed = new Set<string>();

  const allEntries: Array<{ domain: string; entry: LearningEntry }> = [];
  for (const [domain, entries] of learningsByDomain.entries()) {
    for (const entry of entries) {
      allEntries.push({ domain, entry });
    }
  }

  for (let i = 0; i < allEntries.length; i++) {
    if (processed.has(allEntries[i].entry.id)) continue;

    const similar: Array<{ domain: string; entry: LearningEntry }> = [allEntries[i]];
    processed.add(allEntries[i].entry.id);

    const keywords = extractKeywords(allEntries[i].entry.title);

    for (let j = i + 1; j < allEntries.length; j++) {
      if (processed.has(allEntries[j].entry.id)) continue;

      const otherKeywords = extractKeywords(allEntries[j].entry.title);
      const overlap = keywords.filter(k => otherKeywords.includes(k)).length;

      if (overlap >= 2) {
        similar.push(allEntries[j]);
        processed.add(allEntries[j].entry.id);
      }
    }

    if (similar.length >= flags.minOccurrences) {
      const domains = [...new Set(similar.map(s => s.domain))];

      if (domains.length >= flags.minOccurrences) {
        const allTags = [...new Set(similar.flatMap(s => s.entry.tags))];

        patterns.push({
          topic: `Similar: ${keywords.slice(0, 3).join(', ')}`,
          occurrences: domains.length,
          domains,
          entries: similar,
          tags: allTags,
        });
      }
    }
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'can', 'could', 'may', 'might', 'must', 'to', 'from', 'in', 'on', 'at',
    'by', 'for', 'with', 'about', 'as', 'of', 'that', 'this', 'it', 'and',
    'or', 'but', 'not', 'if', 'when', 'where', 'how', 'why', 'what', 'which',
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 10);
}

// ==================== Reporting ====================

function generateMarkdownReport(
  learningsByDomain: Map<string, LearningEntry[]>,
  tagPatterns: Pattern[],
  skillPatterns: Pattern[],
  similarityPatterns: Pattern[]
): string {
  const totalLearnings = Array.from(learningsByDomain.values()).reduce((sum, entries) => sum + entries.length, 0);
  const allPatterns = [...skillPatterns, ...tagPatterns, ...similarityPatterns];

  let md = '# Knowledge Sweep Report\n\n';
  md += `**Date:** ${new Date().toISOString().split('T')[0]}\n`;
  md += `**Domains scanned:** ${learningsByDomain.size}\n`;
  md += `**Generalizable learnings found:** ${totalLearnings}\n`;
  md += `**Patterns detected (${flags.minOccurrences}+ domains):** ${allPatterns.length}\n\n`;

  // Skill-based patterns
  if (skillPatterns.length > 0) {
    md += '## Patterns by Related Skill\n\n';

    for (const pattern of skillPatterns) {
      md += `### ${pattern.relatedSkill}\n`;
      md += `**Occurrences:** ${pattern.occurrences} (${pattern.domains.join(', ')})\n`;
      md += `**Tags:** ${pattern.tags.join(', ')}\n`;
      md += `**Recommendation:** ${pattern.occurrences >= 2 ? 'GRADUATE' : 'WATCH'} — ${pattern.occurrences >= 2 ? 'consistent finding across domains' : 'single occurrence'}\n\n`;

      md += '**Evidence:**\n';
      for (const { domain, entry } of pattern.entries) {
        md += `- [${domain}] ${entry.agent}: "${entry.title}"\n`;
      }
      md += '\n';
    }
  }

  // Tag-based patterns
  if (tagPatterns.length > 0) {
    md += '## Patterns by Tag\n\n';

    for (const pattern of tagPatterns.slice(0, 10)) {
      md += `### Tag: ${pattern.topic}\n`;
      md += `**Occurrences:** ${pattern.occurrences} (${pattern.domains.join(', ')})\n`;
      md += `**Recommendation:** ${pattern.occurrences >= 3 ? 'INVESTIGATE' : 'WATCH'}\n\n`;

      md += '**Examples:**\n';
      for (const { domain, entry } of pattern.entries.slice(0, 3)) {
        md += `- [${domain}] ${entry.agent}: "${entry.title}"\n`;
      }
      md += '\n';
    }
  }

  // Similarity patterns
  if (similarityPatterns.length > 0) {
    md += '## Patterns by Similarity\n\n';

    for (const pattern of similarityPatterns) {
      md += `### ${pattern.topic}\n`;
      md += `**Occurrences:** ${pattern.occurrences} (${pattern.domains.join(', ')})\n`;
      md += `**Tags:** ${pattern.tags.join(', ')}\n\n`;

      md += '**Evidence:**\n';
      for (const { domain, entry } of pattern.entries) {
        md += `- [${domain}] ${entry.agent}: "${entry.title}"\n`;
      }
      md += '\n';
    }
  }

  // Ungrouped learnings
  md += '## Ungrouped Generalizable Learnings\n\n';

  const groupedIds = new Set(
    allPatterns.flatMap(p => p.entries.map(e => e.entry.id))
  );

  for (const [domain, entries] of learningsByDomain.entries()) {
    const ungrouped = entries.filter(e => !groupedIds.has(e.id));

    for (const entry of ungrouped) {
      md += `- [${domain}] ${entry.agent}: "${entry.title}"\n`;
      md += `  - **Tags:** ${entry.tags.join(', ')}\n`;
      md += `  - **Confidence:** ${entry.confidence}\n`;
      if (entry.related_skill) {
        md += `  - **Related skill:** ${entry.related_skill}\n`;
      }
      md += '\n';
    }
  }

  return md;
}

function printConsoleReport(
  learningsByDomain: Map<string, LearningEntry[]>,
  tagPatterns: Pattern[],
  skillPatterns: Pattern[],
  similarityPatterns: Pattern[]
): void {
  const totalLearnings = Array.from(learningsByDomain.values()).reduce((sum, entries) => sum + entries.length, 0);
  const allPatterns = [...skillPatterns, ...tagPatterns, ...similarityPatterns];

  console.log('\n📊 Knowledge Sweep Report');
  console.log('━'.repeat(80));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`Domains scanned: ${learningsByDomain.size}`);
  console.log(`Generalizable learnings found: ${totalLearnings}`);
  console.log(`Patterns detected (${flags.minOccurrences}+ domains): ${allPatterns.length}`);
  console.log('');

  // Top patterns
  const topPatterns = [...skillPatterns, ...similarityPatterns].slice(0, 5);

  if (topPatterns.length > 0) {
    console.log('## Top Patterns\n');

    for (const pattern of topPatterns) {
      console.log(`### ${pattern.topic}`);
      console.log(`Occurrences: ${pattern.occurrences} (${pattern.domains.join(', ')})`);

      if (pattern.relatedSkill) {
        console.log(`Related skill: ${pattern.relatedSkill}`);
      }

      console.log(`Tags: ${pattern.tags.slice(0, 5).join(', ')}`);
      console.log(`Recommendation: ${pattern.occurrences >= 2 ? 'GRADUATE' : 'WATCH'}`);
      console.log('');

      console.log('Evidence:');
      for (const { domain, entry } of pattern.entries.slice(0, 2)) {
        console.log(`  - [${domain}] ${entry.agent}: "${entry.title}"`);
      }
      console.log('');
    }
  }

  console.log(`\n💡 Full report: ${flags.output || '(use --output to save)'}`);
  console.log('');
}

// ==================== Main ====================

function main(): void {
  console.log('🔍 Discovering domains...');

  const branches = discoverBranches();

  if (branches.length === 0) {
    console.error(`❌ No ${BRANCH_PREFIX}* branches found.`);
    process.exit(1);
  }

  console.log(`✅ Found ${branches.length} domain(s)`);

  // Collect generalizable learnings
  console.log('\n📖 Reading learning logs...\n');

  const learningsByDomain = collectGeneralizableLearnings(branches);

  if (learningsByDomain.size === 0) {
    console.log('⚪ No generalizable learnings found.');
    return;
  }

  console.log(`\n✅ Found learnings in ${learningsByDomain.size} domain(s)`);

  // Detect patterns
  console.log('\n🔍 Detecting patterns...');

  const tagPatterns = groupByTags(learningsByDomain);
  const skillPatterns = groupByRelatedSkill(learningsByDomain);
  const similarityPatterns = groupBySimilarity(learningsByDomain);

  console.log(`✅ Found ${tagPatterns.length} tag patterns, ${skillPatterns.length} skill patterns, ${similarityPatterns.length} similarity patterns`);

  // Generate report
  const markdownReport = generateMarkdownReport(
    learningsByDomain,
    tagPatterns,
    skillPatterns,
    similarityPatterns
  );

  // Write to file if requested
  if (flags.output) {
    const outputPath = path.isAbsolute(flags.output)
      ? flags.output
      : path.join(REPO_ROOT, flags.output);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdownReport);

    console.log(`\n📝 Report written to: ${outputPath}`);
  }

  // Print console summary
  printConsoleReport(learningsByDomain, tagPatterns, skillPatterns, similarityPatterns);
}

// Run
try {
  main();
} catch (err: any) {
  console.error('❌ Sweep failed:', err.message);
  process.exit(1);
}
