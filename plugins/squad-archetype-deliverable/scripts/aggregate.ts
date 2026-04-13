#!/usr/bin/env node
/**
 * Aggregation Pipeline — Collect deliverables from domain worktrees.
 *
 * Discovers all domain branches/worktrees, collects each domain's
 * deliverable file, and optionally runs a configurable import hook.
 *
 * Configuration (federate.config.json or env vars):
 *   - deliverable: filename to collect (default: "deliverable.json")
 *   - deliverableSchema: path to JSON Schema for validation (optional)
 *   - importHook: path to script to run per collected file (optional)
 *   - branchPrefix: branch prefix for domain branches (default: "squad/")
 *
 * Usage:
 *   npx tsx scripts/aggregate.ts                          # Aggregate all domains
 *   npx tsx scripts/aggregate.ts --list                   # Show what's available
 *   npx tsx scripts/aggregate.ts --dry-run                # Collect but don't import
 *   npx tsx scripts/aggregate.ts --validate               # Validate deliverables against schema
 *   npx tsx scripts/aggregate.ts --teams "my-product,analytics-engine"
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { loadAndValidateConfig, type FederateConfig } from '../../squad-federation-core/scripts/lib/config.js';

// ==================== Configuration ====================

const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();
const CONFIG_PATH = path.join(REPO_ROOT, 'federate.config.json');

// Config loading now uses validated config from lib/config.ts
const config = loadAndValidateConfig(CONFIG_PATH);

// Ensure deliverable field is set (apply env var fallback if needed)
const DELIVERABLE = DELIVERABLE || process.env.FEDERATE_DELIVERABLE || 'deliverable.json';
const AGGREGATION_DIR = path.join(REPO_ROOT, '.squad', 'aggregation');
const COLLECTED_DIR = path.join(AGGREGATION_DIR, 'collected');
const MANIFEST_PATH = path.join(AGGREGATION_DIR, 'manifest.json');

// ==================== Types ====================

interface DomainBranch {
  name: string;
  branch: string;
  worktree: string | null;
  hasDeliverable: boolean;
  deliverablePath?: string;
}

interface DeliverableMetadata {
  domain: string;
  created_at: string;
  item_count: number;
}

interface ManifestEntry {
  name: string;
  branch: string;
  commit: string;
  collected_at: string;
  item_count: number;
  imported: boolean;
  error?: string;
  validation_warnings?: string[];
}

interface Manifest {
  aggregated_at: string;
  deliverable: string;
  domains: ManifestEntry[];
}

// ==================== CLI Arg Parsing ====================

const args = process.argv.slice(2);
const flags = {
  list: args.includes('--list'),
  dryRun: args.includes('--dry-run'),
  validate: args.includes('--validate'),
  domains: args.find(a => a.startsWith('--teams='))?.split('=')[1]?.split(',') || null,
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
        if (branch.startsWith(config.branchPrefix) && currentPath) {
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
    const pattern = `${config.branchPrefix}*`;
    const output = execSync(`git branch --list '${pattern}' --format='%(refname:short)'`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    });

    return output.trim().split('\n').filter(b => b.length > 0);
  } catch (err) {
    console.error('⚠️  Failed to list branches:', err);
    return [];
  }
}

function readDeliverableFromWorktree(worktreePath: string): string | null {
  const filePath = path.join(worktreePath, DELIVERABLE);

  if (!fs.existsSync(filePath)) return null;

  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    console.error(`⚠️  Failed to read ${filePath}:`, err);
    return null;
  }
}

function readDeliverableFromBranch(branch: string): string | null {
  try {
    return execSync(`git show ${branch}:${DELIVERABLE}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function getCommitSha(branch: string): string {
  try {
    return execSync(`git rev-parse ${branch}`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

function extractMetadata(content: string, domainName: string): DeliverableMetadata {
  try {
    const data = JSON.parse(content);

    // Attempt to extract counts from common structures
    const itemCount =
      (Array.isArray(data.items) ? data.items.length : 0) ||
      (Array.isArray(data.services) ? data.services.length : 0) ||
      (Array.isArray(data.entries) ? data.entries.length : 0) ||
      (typeof data === 'object' ? Object.keys(data).length : 0);

    return {
      domain: data.domain?.name || data.name || domainName,
      created_at: data.metadata?.created_at || data.created_at || new Date().toISOString(),
      item_count: itemCount,
    };
  } catch {
    return {
      domain: domainName,
      created_at: new Date().toISOString(),
      item_count: 0,
    };
  }
}

// ==================== Schema Validation ====================

function validateDeliverable(content: string, schemaPath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  let data: any;
  try {
    data = JSON.parse(content);
  } catch (err) {
    return { valid: false, errors: ['Invalid JSON: ' + (err as Error).message] };
  }

  let schema: any;
  try {
    const absPath = path.isAbsolute(schemaPath) ? schemaPath : path.join(REPO_ROOT, schemaPath);
    schema = JSON.parse(fs.readFileSync(absPath, 'utf-8'));
  } catch (err) {
    return { valid: false, errors: ['Failed to read schema: ' + (err as Error).message] };
  }

  // Check top-level type
  if (schema.type) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (schema.type !== actualType) {
      errors.push(`Expected type "${schema.type}" but got "${actualType}"`);
    }
  }

  // Validate array items
  if (schema.type === 'array' && schema.items && Array.isArray(data)) {
    const itemSchema = schema.items;
    data.forEach((item: any, index: number) => {
      if (itemSchema.required && Array.isArray(itemSchema.required)) {
        for (const field of itemSchema.required) {
          if (item[field] === undefined || item[field] === null) {
            errors.push(`missing required field "${field}" in item[${index}]`);
          }
        }
      }
      if (itemSchema.properties) {
        for (const [key, propSchema] of Object.entries<any>(itemSchema.properties)) {
          if (item[key] !== undefined && propSchema.type) {
            const actual = Array.isArray(item[key]) ? 'array' : typeof item[key];
            if (propSchema.type !== actual) {
              errors.push(`field "${key}" in item[${index}]: expected "${propSchema.type}" but got "${actual}"`);
            }
          }
        }
      }
    });
  }

  // Validate object fields
  if (schema.type === 'object' || (!schema.type && schema.properties)) {
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (data[field] === undefined || data[field] === null) {
          errors.push(`missing required field "${field}"`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries<any>(schema.properties)) {
        if (data[key] !== undefined && propSchema.type) {
          const actual = Array.isArray(data[key]) ? 'array' : typeof data[key];
          if (propSchema.type !== actual) {
            errors.push(`field "${key}": expected "${propSchema.type}" but got "${actual}"`);
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function discoverAllDomains(): DomainBranch[] {
  const worktreeMap = discoverWorktrees();
  const branches = discoverBranches();

  if (branches.length === 0) {
    console.warn(`⚠️  No ${config.branchPrefix}* branches found. Have you onboarded any domains?`);
    return [];
  }

  const domains: DomainBranch[] = [];

  for (const branch of branches) {
    const domainName = branch.substring(config.branchPrefix.length);
    const worktreePath = worktreeMap.get(branch) || null;

    let deliverableContent: string | null = null;

    if (worktreePath) {
      deliverableContent = readDeliverableFromWorktree(worktreePath);
    }

    if (!deliverableContent) {
      deliverableContent = readDeliverableFromBranch(branch);
    }

    domains.push({
      name: domainName,
      branch,
      worktree: worktreePath,
      hasDeliverable: deliverableContent !== null,
      deliverablePath: deliverableContent
        ? (worktreePath ? path.join(worktreePath, DELIVERABLE) : undefined)
        : undefined,
    });
  }

  return domains;
}

// ==================== Collection ====================

function ensureAggregationDir(): void {
  if (!fs.existsSync(COLLECTED_DIR)) {
    fs.mkdirSync(COLLECTED_DIR, { recursive: true });
  }
}

function collectDeliverables(domains: DomainBranch[]): Map<string, string> {
  ensureAggregationDir();

  const collectedFiles = new Map<string, string>();

  for (const domain of domains) {
    if (!domain.hasDeliverable) continue;

    let content: string | null = null;

    if (domain.worktree) {
      content = readDeliverableFromWorktree(domain.worktree);
    } else {
      content = readDeliverableFromBranch(domain.branch);
    }

    if (!content) {
      console.error(`⚠️  Failed to read ${DELIVERABLE} for ${domain.name}`);
      continue;
    }

    const collectedPath = path.join(COLLECTED_DIR, `${domain.name}.json`);
    fs.writeFileSync(collectedPath, content);
    collectedFiles.set(domain.name, collectedPath);
  }

  return collectedFiles;
}

// ==================== Import Hook ====================

function runImportHook(domainName: string, collectedPath: string): { success: boolean; error?: string } {
  if (!config.importHook) {
    return { success: true };
  }

  try {
    console.log(`\n📦 Running import hook for ${domainName}...`);

    execSync(`${config.importHook} "${collectedPath}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: 'inherit',
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==================== Manifest ====================

function writeManifest(
  domains: DomainBranch[],
  collectedFiles: Map<string, string>,
  importResults: Map<string, { success: boolean; error?: string }>,
  validationResults?: Map<string, { valid: boolean; errors: string[] }>
): void {
  const manifestEntries: ManifestEntry[] = [];

  for (const domain of domains) {
    if (!domain.hasDeliverable) continue;

    const collectedPath = collectedFiles.get(domain.name);
    if (!collectedPath) continue;

    const content = fs.readFileSync(collectedPath, 'utf-8');
    const metadata = extractMetadata(content, domain.name);
    const importResult = importResults.get(domain.name);
    const validationResult = validationResults?.get(domain.name);

    manifestEntries.push({
      name: domain.name,
      branch: domain.branch,
      commit: getCommitSha(domain.branch),
      collected_at: metadata.created_at,
      item_count: metadata.item_count,
      imported: importResult?.success || false,
      error: importResult?.error,
      validation_warnings: validationResult?.valid === false ? validationResult.errors : undefined,
    });
  }

  const manifest: Manifest = {
    aggregated_at: new Date().toISOString(),
    deliverable: DELIVERABLE,
    domains: manifestEntries,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ==================== Reporting ====================

function printListTable(domains: DomainBranch[]): void {
  console.log('');
  console.log('Domain'.padEnd(35) + 'Branch'.padEnd(40) + 'Worktree'.padEnd(65) + 'Has Results');
  console.log('─'.repeat(160));

  for (const domain of domains) {
    const worktreeDisplay = domain.worktree || '(no worktree)';
    const hasResultsIcon = domain.hasDeliverable ? '✅ yes' : '⚪ no';

    console.log(
      domain.name.padEnd(35) +
      domain.branch.padEnd(40) +
      worktreeDisplay.padEnd(65) +
      hasResultsIcon
    );
  }

  console.log('');
}

function printSummaryReport(
  domains: DomainBranch[],
  collectedFiles: Map<string, string>,
  importResults: Map<string, { success: boolean; error?: string }>,
  validationResults?: Map<string, { valid: boolean; errors: string[] }>
): void {
  const total = domains.length;
  const withDeliverable = domains.filter(d => d.hasDeliverable).length;
  const imported = Array.from(importResults.values()).filter(r => r.success).length;
  const failed = Array.from(importResults.values()).filter(r => !r.success).length;
  const skipped = total - withDeliverable;

  console.log('\n📊 Aggregation Report');
  console.log('━'.repeat(50));
  console.log(`Deliverable file:          ${DELIVERABLE}`);
  console.log(`Import hook:               ${config.importHook || '(none)'}`);
  console.log(`Total domains discovered:  ${total}`);
  console.log(`With deliverable:          ${withDeliverable}`);
  console.log(`Successfully processed:    ${imported}`);
  console.log(`Failed:                    ${failed}`);
  console.log(`Skipped (no results):      ${skipped}`);
  console.log('');

  for (const domain of domains) {
    const collectedPath = collectedFiles.get(domain.name);
    const importResult = importResults.get(domain.name);

    if (domain.hasDeliverable && collectedPath) {
      const content = fs.readFileSync(collectedPath, 'utf-8');
      const metadata = extractMetadata(content, domain.name);

      if (importResult?.success) {
        console.log(
          `✅ ${domain.name.padEnd(30)} ${String(metadata.item_count).padStart(4)} items   collected`
        );
      } else if (importResult && !importResult.success) {
        console.log(
          `❌ ${domain.name.padEnd(30)} ${String(metadata.item_count).padStart(4)} items   FAILED: ${importResult.error || 'unknown'}`
        );
      }
    } else {
      console.log(`⚪ ${domain.name.padEnd(30)} (no ${DELIVERABLE} — scan pending)`);
    }
  }

  if (validationResults && validationResults.size > 0) {
    const validCount = Array.from(validationResults.values()).filter(r => r.valid).length;
    const totalValidated = validationResults.size;
    const warningCount = totalValidated - validCount;
    console.log('');
    console.log(`🔎 Validated ${validCount}/${totalValidated} teams.${warningCount > 0 ? ` ${warningCount} validation warning${warningCount > 1 ? 's' : ''}.` : ''}`);
  }

  console.log('');
  console.log(`Manifest: ${MANIFEST_PATH}`);
  console.log(`Collected: ${COLLECTED_DIR}/`);
}

// ==================== Main ====================

function main(): void {
  console.log('🔍 Discovering domains...');

  let domains = discoverAllDomains();

  if (domains.length === 0) {
    console.error(`❌ No ${config.branchPrefix}* branches found. Have you onboarded any domains?`);
    process.exit(1);
  }

  // Filter by --teams flag if provided
  if (flags.domains) {
    domains = domains.filter(d => flags.domains!.includes(d.name));

    if (domains.length === 0) {
      console.error(`❌ No domains found matching: ${flags.domains.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`✅ Found ${domains.length} domain(s)`);

  // --list mode: show table and exit
  if (flags.list) {
    printListTable(domains);
    return;
  }

  // Collect deliverable files
  console.log(`\n📥 Collecting ${DELIVERABLE} files...`);
  const collectedFiles = collectDeliverables(domains);
  console.log(`✅ Collected ${collectedFiles.size} file(s)`);

  if (collectedFiles.size === 0) {
    console.warn(`⚠️  No ${DELIVERABLE} files found. Nothing to process.`);
    return;
  }

  // Validate deliverables against schema if --validate or deliverableSchema configured
  const validationResults = new Map<string, { valid: boolean; errors: string[] }>();
  const schemaPath = DELIVERABLESchema;

  if (flags.validate || schemaPath) {
    if (!schemaPath) {
      console.warn('⚠️  --validate passed but no deliverableSchema configured in federate.config.json');
    } else {
      console.log(`\n🔎 Validating deliverables against ${schemaPath}...`);

      for (const [domainName, collectedPath] of collectedFiles.entries()) {
        const content = fs.readFileSync(collectedPath, 'utf-8');
        const metadata = extractMetadata(content, domainName);
        const result = validateDeliverable(content, schemaPath);
        validationResults.set(domainName, result);

        if (result.valid) {
          console.log(`  ✅ ${domainName}: valid (${metadata.item_count} items)`);
        } else {
          console.log(`  ⚠️ ${domainName}: invalid — ${result.errors[0]}${result.errors.length > 1 ? ` (+${result.errors.length - 1} more)` : ''}`);
        }
      }

      const validCount = Array.from(validationResults.values()).filter(r => r.valid).length;
      const totalValidated = validationResults.size;
      const warningCount = totalValidated - validCount;
      console.log(`\nValidated ${validCount}/${totalValidated} teams.${warningCount > 0 ? ` ${warningCount} validation warning${warningCount > 1 ? 's' : ''}.` : ''}`);
    }
  }

  const importResults = new Map<string, { success: boolean; error?: string }>();

  if (!flags.dryRun) {
    if (config.importHook) {
      console.log(`\n📦 Running import hook: ${config.importHook}`);
    } else {
      console.log('\n📦 Collecting results (no import hook configured)');
    }

    for (const [domainName, collectedPath] of collectedFiles.entries()) {
      const result = runImportHook(domainName, collectedPath);
      importResults.set(domainName, result);
    }
  } else {
    console.log('\n🏃 Dry run mode — skipping import');

    for (const domainName of collectedFiles.keys()) {
      importResults.set(domainName, { success: false });
    }
  }

  // Write manifest
  writeManifest(domains, collectedFiles, importResults, validationResults);
  console.log(`\n📝 Manifest written: ${MANIFEST_PATH}`);

  // Print summary
  printSummaryReport(domains, collectedFiles, importResults, validationResults);
}

// Run
try {
  main();
} catch (err: any) {
  console.error('❌ Aggregation failed:', err.message);
  process.exit(1);
}
