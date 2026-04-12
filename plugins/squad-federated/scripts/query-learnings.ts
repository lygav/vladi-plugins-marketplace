#!/usr/bin/env node
/**
 * Query Learnings — Filter and search the squad learning log.
 *
 * Supports filtering by type, confidence, domain, tags, agent, and date.
 * Can also read from another squad's branch (cross-squad queries).
 *
 * Usage:
 *   npx tsx scripts/query-learnings.ts --tags deployment --domain generalizable
 *   npx tsx scripts/query-learnings.ts --squad squad/my-product --tags config-override
 *   npx tsx scripts/query-learnings.ts --type discovery --since 2025-01-01 --json
 */

import { LearningLog, LearningEntry } from './lib/learning-log.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs(args: string[]): any {
  const parsed: any = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith('--')) {
        if (key === 'tags') {
          parsed[key] = nextArg.split(',').map(s => s.trim());
        } else {
          parsed[key] = nextArg;
        }
        i++;
      } else {
        parsed[key] = true;
      }
    }
  }

  return parsed;
}

function findSquadRoot(): string {
  let current = process.cwd();

  while (current !== '/') {
    const squadDir = path.join(current, '.squad');
    const gitDir = path.join(current, '.git');

    if (fs.existsSync(squadDir) || fs.existsSync(gitDir)) {
      return current;
    }

    current = path.dirname(current);
  }

  return process.cwd();
}

function formatTable(entries: LearningEntry[]): void {
  if (entries.length === 0) {
    console.log('No matching entries found.');
    return;
  }

  console.log(`\nFound ${entries.length} matching entries:\n`);

  entries.forEach((entry, idx) => {
    console.log(`[${idx + 1}] ${entry.id}`);
    console.log(`    Timestamp: ${entry.ts}`);
    console.log(`    Agent: ${entry.agent}`);
    console.log(`    Type: ${entry.type} | Confidence: ${entry.confidence} | Domain: ${entry.domain || 'N/A'}`);
    console.log(`    Tags: ${entry.tags.join(', ')}`);
    console.log(`    Summary: ${entry.title}`);
    if (entry.supersedes) {
      console.log(`    Supersedes: ${entry.supersedes}`);
    }
    if (entry.source) {
      console.log(`    Source: ${entry.source}`);
    }
    console.log('');
  });
}

async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args);

  if (params.help) {
    console.log(`
Usage: squad query [options]

Query the learning log for matching entries.

Options:
  --type <type>              Filter by type
  --confidence <level>       Filter by confidence level
  --domain <domain>          Filter by domain scope
  --tags <tags>              Filter by tags (comma-separated, matches any)
  --agent <name>             Filter by agent name
  --since <date>             Filter by date (ISO-8601)
  --squad <branch>           Query another squad's log (cross-squad)
  --json                     Output as JSON
  --help                     Show this help

Example:
  # Query local squad
  npx tsx scripts/query-learnings.ts --tags config-override --domain generalizable

  # Query another squad (cross-squad)
  npx tsx scripts/query-learnings.ts --squad squad/my-product --tags deployment
    `);
    process.exit(0);
  }

  const squadRoot = findSquadRoot();
  let entries: LearningEntry[];

  if (params.squad) {
    entries = LearningLog.readFromBranch(params.squad, squadRoot);
  } else {
    const log = new LearningLog(squadRoot);

    const filter: any = {};
    if (params.type) filter.type = params.type;
    if (params.confidence) filter.confidence = params.confidence;
    if (params.domain) filter.domain = params.domain;
    if (params.tags) filter.tags = params.tags;
    if (params.agent) filter.agent = params.agent;
    if (params.since) filter.since = params.since;

    entries = log.query(filter);
  }

  if (params.json) {
    console.log(JSON.stringify(entries, null, 2));
  } else {
    formatTable(entries);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
