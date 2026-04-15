import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn((cmd: string) => {
      if (cmd === 'git branch --show-current') return 'main\n';
      if (cmd.startsWith('git rev-parse --verify')) throw new Error('not found');
      return '';
    }),
  };
});

const mockExistsSync = vi.fn().mockReturnValue(false);
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: (...args: any[]) => mockExistsSync(...args) };
});

vi.mock('../../lib/config/config.js', () => ({
  loadAndValidateConfig: vi.fn(() => ({
    version: '0.1.0', description: 'test',
    communication: { type: 'file-signal', signalDir: '.squad/signals' },
    telemetry: { enabled: false },
  })),
}));

import * as child_process from 'child_process';
import { parseArgs, validateDryRun, type ParsedArgs, type OnboardResult } from '../../onboard.js';

describe('parseArgs', () => {
  it('--non-interactive defaults to false', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']).nonInteractive).toBe(false);
  });
  it('--non-interactive sets true', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--non-interactive']).nonInteractive).toBe(true);
  });
  it('all flags work together', () => {
    const a = parseArgs(['--name', 'my-team', '--mission', 'Build frontend', '--archetype', 'squad-archetype-coding', '--domain-id', 'abc-123', '--placement', 'worktree', '--non-interactive', '--output-format', 'json']);
    expect(a.name).toBe('my-team');
    expect(a.description).toBe('Build frontend');
    expect(a.domainId).toBe('abc-123');
    expect(a.nonInteractive).toBe(true);
    expect(a.outputFormat).toBe('json');
  });
  it('--output-format defaults to text', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']).outputFormat).toBe('text');
  });
  it('--output-format accepts json', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--output-format', 'json']).outputFormat).toBe('json');
  });
  it('--dry-run defaults to false', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']).dryRun).toBe(false);
  });
  it('--dry-run sets true', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--dry-run']).dryRun).toBe(true);
  });
  it('auto-generates UUID v4 domain-id', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']);
    expect(a.domainId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it('uses provided domain-id', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--domain-id', 'custom']).domainId).toBe('custom');
  });
  it('generates unique domain-ids', () => {
    const a = parseArgs(['--name', 'a', '--archetype', 'squad-archetype-deliverable']);
    const b = parseArgs(['--name', 'b', '--archetype', 'squad-archetype-deliverable']);
    expect(a.domainId).not.toBe(b.domainId);
  });
  it('--team aliases --name', () => {
    expect(parseArgs(['--team', 'my-team', '--archetype', 'squad-archetype-deliverable']).name).toBe('my-team');
  });
  it('--mission aliases --description', () => {
    expect(parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--mission', 'W']).description).toBe('W');
  });
});

describe('validateDryRun', () => {
  const root = '/fake/repo';
  function makeArgs(o: Partial<ParsedArgs> = {}): ParsedArgs {
    return { name: 'test-team', domainId: 'abc-123', baseBranch: 'main', archetype: 'squad-archetype-deliverable', placement: 'worktree', nonInteractive: true, outputFormat: 'json', dryRun: true, ...o };
  }

  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git branch --show-current') return 'main\n';
      if (cmd.startsWith('git rev-parse --verify')) throw new Error('nope');
      return '';
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns dryRun: true', () => expect(validateDryRun(makeArgs(), root).dryRun).toBe(true));
  it('computes worktree location', () => {
    const r = validateDryRun(makeArgs(), root);
    expect(r.location).toBe(path.join(root, '.worktrees', 'test-team'));
    expect(r.branch).toBe('squad/test-team');
  });
  it('computes directory location', () => {
    const r = validateDryRun(makeArgs({ placement: 'directory', path: '/custom/base' }), root);
    expect(r.location).toBe(path.resolve(root, '/custom/base', 'test-team'));
    expect(r.branch).toBeUndefined();
  });
  it('detects branch conflict', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git branch --show-current') return 'main\n';
      if (cmd.startsWith('git rev-parse --verify')) return 'sha\n';
      return '';
    });
    expect(validateDryRun(makeArgs(), root).errors!.some(e => e.includes('already exists'))).toBe(true);
  });
  it('detects directory conflict', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.worktrees/test-team'));
    expect(validateDryRun(makeArgs(), root).errors!.some(e => e.includes('Location already exists'))).toBe(true);
  });
  it('detects missing archetype', () => {
    expect(validateDryRun(makeArgs(), root).errors!.some(e => e.includes('Archetype plugin not found'))).toBe(true);
  });
  it('passes when archetype found locally', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('plugins/squad-archetype-deliverable'));
    expect((validateDryRun(makeArgs(), root).errors || []).filter(e => e.includes('Archetype'))).toHaveLength(0);
  });
  it('includes description', () => expect(validateDryRun(makeArgs({ description: 'D' }), root).description).toBe('D'));
  it('is JSON-serializable', () => expect(JSON.parse(JSON.stringify(validateDryRun(makeArgs(), root))).domain).toBe('test-team'));
  it('custom worktree-dir', () => expect(validateDryRun(makeArgs({ worktreeDir: '../s' }), root).location).toBe(path.join('../s', 'test-team')));
});

describe('OnboardResult', () => {
  it('success has no errors', () => {
    const r: OnboardResult = { success: true, domain: 't', domainId: 'id', archetype: 'a', placement: 'worktree', location: '/p', dryRun: false };
    expect(JSON.parse(JSON.stringify(r)).errors).toBeUndefined();
  });
  it('failure has errors', () => {
    const r: OnboardResult = { success: false, domain: 't', domainId: 'id', archetype: 'a', placement: 'worktree', location: '', dryRun: false, errors: ['A', 'B'] };
    expect(JSON.parse(JSON.stringify(r)).errors).toHaveLength(2);
  });
});
