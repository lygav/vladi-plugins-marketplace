/**
 * Learning Log — JSONL-based knowledge accumulation for federated squads.
 *
 * Each domain squad maintains its own learning log at .squad/learnings/log.jsonl.
 * Entries record discoveries, corrections, patterns, techniques, and gotchas.
 * Meta-squad can read across all domain logs via git show.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ==================== Types ====================

export type LearningType = 'discovery' | 'correction' | 'pattern' | 'technique' | 'gotcha';

export interface LearningEntry {
  id: string;
  ts: string;
  /**
   * Schema version for this learning entry.
   * Current version: "1.0"
   */
  version: string;
  type: LearningType;
  agent: string;
  domain?: string;
  tags: string[];
  title: string;
  body: string;
  confidence: 'low' | 'medium' | 'high';
  source?: string;
  supersedes?: string;
  related_skill?: string;
  evidence?: string[];
  graduated?: boolean;
  graduated_to?: string;
}

// ==================== LearningLog Class ====================

/**
 * Current learning log format version.
 */
const CURRENT_VERSION = '1.0';

export class LearningLog {
  private logPath: string;

  constructor(squadRoot: string | { path: string }) {
    const resolvedRoot = typeof squadRoot === 'string' ? squadRoot : squadRoot.path;
    const learningsDir = path.join(resolvedRoot, '.squad', 'learnings');
    if (!fs.existsSync(learningsDir)) {
      fs.mkdirSync(learningsDir, { recursive: true });
    }
    this.logPath = path.join(learningsDir, 'log.jsonl');
  }

  append(entry: Omit<LearningEntry, 'id' | 'ts' | 'version'>): LearningEntry {
    const full: LearningEntry = {
      ...entry,
      id: `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    fs.appendFileSync(this.logPath, JSON.stringify(full) + '\n');
    return full;
  }

  query(filters?: {
    type?: LearningType;
    agent?: string;
    tags?: string[];
    domain?: string;
    since?: string;
    confidence?: string;
  }): LearningEntry[] {
    if (!fs.existsSync(this.logPath)) return [];

    const lines = fs.readFileSync(this.logPath, 'utf-8').trim().split('\n').filter(Boolean);
    let entries: LearningEntry[] = lines.map(line => {
      try {
        return JSON.parse(line) as LearningEntry;
      } catch {
        return null;
      }
    }).filter((e): e is LearningEntry => e !== null);

    if (filters) {
      if (filters.type) entries = entries.filter(e => e.type === filters.type);
      if (filters.agent) entries = entries.filter(e => e.agent === filters.agent);
      if (filters.domain) entries = entries.filter(e => e.domain === filters.domain);
      if (filters.confidence) entries = entries.filter(e => e.confidence === filters.confidence);
      if (filters.since) {
        const since = new Date(filters.since).getTime();
        entries = entries.filter(e => new Date(e.ts).getTime() >= since);
      }
      if (filters.tags && filters.tags.length > 0) {
        entries = entries.filter(e =>
          filters.tags!.some(tag => e.tags.includes(tag))
        );
      }
    }

    return entries;
  }

  /**
   * Read learning log from another domain's branch via git show.
   * Does NOT require the worktree to be checked out.
   */
  static readFromBranch(branch: string, repoRoot?: string): LearningEntry[] {
    const root = repoRoot || process.cwd();
    try {
      const content = execSync(
        `git show ${branch}:.squad/learnings/log.jsonl`,
        { cwd: root, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      return content.trim().split('\n').filter(Boolean).map(line => {
        try {
          return JSON.parse(line) as LearningEntry;
        } catch {
          return null;
        }
      }).filter((e): e is LearningEntry => e !== null);
    } catch {
      return [];
    }
  }

  /**
   * Read learning logs from ALL domain branches.
   */
  static readAllDomains(repoRoot?: string): Map<string, LearningEntry[]> {
    const root = repoRoot || process.cwd();
    const result = new Map<string, LearningEntry[]>();

    try {
      const branchPrefix = process.env.FEDERATE_BRANCH_PREFIX || 'squad/';
      const branches = execSync(`git branch --list "${branchPrefix}*"`, {
        cwd: root, encoding: 'utf-8',
      }).trim().split('\n').map(b => b.trim().replace('* ', ''));

      for (const branch of branches) {
        if (branch) {
          const entries = LearningLog.readFromBranch(branch, root);
          if (entries.length > 0) {
            result.set(branch.replace(branchPrefix, ''), entries);
          }
        }
      }
    } catch {
      // No branches found
    }

    return result;
  }

  markGraduated(id: string, graduatedTo: string): void {
    if (!fs.existsSync(this.logPath)) {
      throw new Error(`Learning log not found: ${this.logPath}`);
    }

    const lines = fs.readFileSync(this.logPath, 'utf-8').trim().split('\n').filter(Boolean);
    let found = false;

    const updated = lines.map(line => {
      try {
        const entry = JSON.parse(line);
        if (entry.id === id) {
          found = true;
          entry.graduated = true;
          entry.graduated_to = graduatedTo;
          return JSON.stringify(entry);
        }
        return line;
      } catch {
        return line;
      }
    });

    if (!found) {
      throw new Error(`Learning entry not found: ${id}`);
    }

    fs.writeFileSync(this.logPath, updated.join('\n') + '\n');
  }

  count(): number {
    if (!fs.existsSync(this.logPath)) return 0;
    return fs.readFileSync(this.logPath, 'utf-8').trim().split('\n').filter(Boolean).length;
  }
}
