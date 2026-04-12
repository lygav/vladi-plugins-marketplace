#!/usr/bin/env node
/**
 * Learn Script — CLI wrapper for the squad learning log.
 *
 * Appends a structured learning entry to the current squad's
 * .squad/learnings/log.jsonl file.
 *
 * Usage:
 *   npx tsx scripts/learn.ts --type discovery --confidence medium \
 *     --domain generalizable --tags "deployment,rollout" \
 *     --summary "Regional config override found" \
 *     --detail "When scanning rollout specs..."
 */

import { LearningLog } from './lib/learning-log.js';
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
        if (key === 'tags' || key === 'evidence') {
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

async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args);

  if (params.help) {
    console.log(`
Usage: squad learn [options]

Append a learning entry to the squad's learning log.

Options:
  --type <type>              Type: discovery, correction, pattern, technique, gotcha (required)
  --confidence <level>       Confidence: low, medium, high (required)
  --domain <domain>          Scope: domain-specific, generalizable (required)
  --tags <tags>              Comma-separated tags (required)
  --summary <text>           One-line summary (required)
  --detail <text>            Full description (required)
  --evidence <refs>          Comma-separated evidence refs (optional)
  --related-skill <name>     Related skill name (optional)
  --agent <name>             Agent name (default: current user)
  --squad <name>             Squad identifier (auto-detected from git)
  --help                     Show this help

Example:
  npx tsx scripts/learn.ts \\
    --type discovery \\
    --confidence medium \\
    --domain generalizable \\
    --tags "deployment,config-override" \\
    --summary "Regional config has hidden override mechanism" \\
    --detail "When scanning rollout specs, found that..." \\
    --evidence "repo:my-product/rollout/overrides" \\
    --related-skill deployment-topology-discovery
    `);
    process.exit(0);
  }

  const required = ['type', 'confidence', 'domain', 'tags', 'summary', 'detail'];
  const missing = required.filter(field => !params[field]);

  if (missing.length > 0) {
    console.error(`Error: Missing required fields: ${missing.join(', ')}`);
    console.error('Use --help for usage information.');
    process.exit(1);
  }

  const squadRoot = findSquadRoot();
  const log = new LearningLog(squadRoot);

  const agent = params.agent || process.env.USER || 'unknown';

  const entry = log.append({
    agent,
    type: params.type,
    confidence: params.confidence,
    domain: params.domain,
    tags: params.tags,
    title: params.summary,
    body: params.detail,
    source: params.evidence ? params.evidence.join(', ') : undefined,
  });

  console.log(`✓ Learning entry created: ${entry.id}`);
  console.log(`  Agent: ${entry.agent}`);
  console.log(`  Type: ${entry.type}`);
  console.log(`  Confidence: ${entry.confidence}`);
  console.log(`  Tags: ${entry.tags.join(', ')}`);
  console.log(`  Summary: ${entry.title}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
