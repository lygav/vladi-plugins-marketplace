/**
 * Signal Protocol for Meta-Squad ↔ Domain Squad Communication
 *
 * File-based IPC for headless orchestration.
 * Meta-squad launches domain squads in detached Copilot sessions.
 * Domain squads write status updates and reports.
 * Meta-squad reads status and sends directives.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { v4 as uuidv4 } from 'uuid';

// ==================== Types ====================

export interface ScanStatus {
  domain: string;
  domain_id: string;
  state: 'initializing' | 'scanning' | 'distilling' | 'complete' | 'failed' | 'paused';
  step: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
  progress_pct?: number;
  error?: string;
  agent_active?: string;
}

export interface SignalMessage {
  id: string;
  ts: string;
  from: string;
  type: 'directive' | 'question' | 'report' | 'alert';
  subject: string;
  body: string;
  acknowledged?: boolean;
  acknowledged_at?: string;
}

export interface DomainWorktree {
  domain: string;
  branch: string;
  path: string;
}

// ==================== Filesystem Helpers ====================

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function getSignalsDir(worktreePath: string): string {
  return path.join(worktreePath, '.squad', 'signals');
}

function getStatusPath(worktreePath: string): string {
  return path.join(getSignalsDir(worktreePath), 'status.json');
}

function getInboxDir(worktreePath: string): string {
  return path.join(getSignalsDir(worktreePath), 'inbox');
}

function getOutboxDir(worktreePath: string): string {
  return path.join(getSignalsDir(worktreePath), 'outbox');
}

// ==================== Status Operations ====================

export function readStatus(worktreePath: string): ScanStatus | null {
  const statusPath = getStatusPath(worktreePath);
  if (!fs.existsSync(statusPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function writeStatus(worktreePath: string, status: ScanStatus): void {
  const statusPath = getStatusPath(worktreePath);
  ensureDir(path.dirname(statusPath));
  status.updated_at = new Date().toISOString();
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
}

export function initializeSignals(worktreePath: string, domain: string, domainId: string): void {
  const signalsDir = getSignalsDir(worktreePath);
  ensureDir(signalsDir);
  ensureDir(getInboxDir(worktreePath));
  ensureDir(getOutboxDir(worktreePath));

  const initialStatus: ScanStatus = {
    domain,
    domain_id: domainId,
    state: 'initializing',
    step: 'Preparing scan environment',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  writeStatus(worktreePath, initialStatus);
}

// ==================== Message Operations ====================

export function sendMessage(worktreePath: string, message: Omit<SignalMessage, 'id' | 'ts'>): string {
  const msg: SignalMessage = {
    ...message,
    id: uuidv4(),
    ts: new Date().toISOString(),
  };

  const dir = message.from === 'meta-squad' ? getInboxDir(worktreePath) : getOutboxDir(worktreePath);
  ensureDir(dir);

  const filename = `${msg.ts.replace(/[:.]/g, '-')}-${msg.type}-${msg.subject.replace(/\s+/g, '-').toLowerCase().slice(0, 40)}.json`;
  fs.writeFileSync(path.join(dir, filename), JSON.stringify(msg, null, 2));
  return msg.id;
}

export function readMessages(worktreePath: string, box: 'inbox' | 'outbox'): SignalMessage[] {
  const dir = box === 'inbox' ? getInboxDir(worktreePath) : getOutboxDir(worktreePath);
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .map(f => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      } catch {
        return null;
      }
    })
    .filter((m): m is SignalMessage => m !== null);
}

export function acknowledgeMessage(worktreePath: string, box: 'inbox' | 'outbox', messageId: string): boolean {
  const dir = box === 'inbox' ? getInboxDir(worktreePath) : getOutboxDir(worktreePath);
  if (!fs.existsSync(dir)) return false;

  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    const filePath = path.join(dir, file);
    try {
      const msg: SignalMessage = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (msg.id === messageId) {
        msg.acknowledged = true;
        msg.acknowledged_at = new Date().toISOString();
        fs.writeFileSync(filePath, JSON.stringify(msg, null, 2));
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

// ==================== Worktree Discovery ====================

export function discoverDomains(repoRoot?: string): DomainWorktree[] {
  const root = repoRoot || process.cwd();
  try {
    const output = execSync('git worktree list --porcelain', { cwd: root, encoding: 'utf-8' });
    const worktrees: DomainWorktree[] = [];
    let currentPath = '';
    let currentBranch = '';

    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        currentPath = line.replace('worktree ', '');
      } else if (line.startsWith('branch ')) {
        currentBranch = line.replace('branch refs/heads/', '');
        // Domain branches follow the pattern: scan/{domain-name}
        // This prefix is configurable — override via FederateConfig
        if (currentBranch.startsWith('scan/')) {
          const domain = currentBranch.replace('scan/', '');
          worktrees.push({ domain, branch: currentBranch, path: currentPath });
        }
      }
    }
    return worktrees;
  } catch {
    return [];
  }
}

export function validateWorktree(worktreePath: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!fs.existsSync(worktreePath)) {
    return { valid: false, issues: ['Worktree path does not exist'] };
  }

  if (!fs.existsSync(path.join(worktreePath, '.squad', 'team.md'))) {
    issues.push('Missing .squad/team.md — squad not initialized');
  }

  if (!fs.existsSync(path.join(worktreePath, '.squad', 'signals'))) {
    issues.push('Missing .squad/signals/ — signal protocol not initialized');
  }

  return { valid: issues.length === 0, issues };
}
