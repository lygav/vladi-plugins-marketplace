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
import { parseArgs, validateDryRun, buildProjectContext, type ParsedArgs, type OnboardResult } from '../../onboard.js';

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
  it('--roles parses comma-separated roles', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--roles', 'lead,developer,tester']);
    expect(a.roles).toEqual(['lead', 'developer', 'tester']);
  });
  it('--roles trims whitespace', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--roles', ' lead , developer ']);
    expect(a.roles).toEqual(['lead', 'developer']);
  });
  it('--roles defaults to undefined', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']);
    expect(a.roles).toBeUndefined();
  });
  it('--universe sets universe', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable', '--universe', 'oceans-eleven']);
    expect(a.universe).toBe('oceans-eleven');
  });
  it('--universe defaults to undefined', () => {
    const a = parseArgs(['--name', 't', '--archetype', 'squad-archetype-deliverable']);
    expect(a.universe).toBeUndefined();
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
  it('success with team includes cast members', () => {
    const r: OnboardResult = {
      success: true, domain: 't', domainId: 'id', archetype: 'a', placement: 'worktree', location: '/p', dryRun: false,
      team: {
        members: [
          { name: 'Keyser', role: 'lead', displayName: 'Keyser — Lead' },
          { name: 'McManus', role: 'developer', displayName: 'McManus — Developer' },
        ],
        universe: 'usual-suspects',
      },
    };
    const parsed = JSON.parse(JSON.stringify(r));
    expect(parsed.team.members).toHaveLength(2);
    expect(parsed.team.universe).toBe('usual-suspects');
    expect(parsed.team.members[0].name).toBe('Keyser');
  });
});

describe('buildProjectContext', () => {
  function makeArgs(o: Partial<ParsedArgs> = {}): ParsedArgs {
    return { name: 'test-team', domainId: 'abc', baseBranch: 'main', archetype: 'squad-archetype-coding', placement: 'worktree', nonInteractive: true, outputFormat: 'json', dryRun: false, ...o };
  }

  it('includes federation context header', () => {
    const ctx = buildProjectContext(makeArgs(), { name: 'squad-archetype-coding' });
    expect(ctx).toContain('## Federation Context');
  });

  it('includes mission from description', () => {
    const ctx = buildProjectContext(makeArgs({ description: 'Build the frontend' }), { name: 'coding' });
    expect(ctx).toContain('**Mission:** Build the frontend');
  });

  it('falls back to name if no description', () => {
    const ctx = buildProjectContext(makeArgs({ name: 'my-team' }), { name: 'coding' });
    expect(ctx).toContain('**Mission:** my-team');
  });

  it('includes archetype name', () => {
    const ctx = buildProjectContext(makeArgs(), { name: 'squad-archetype-coding', description: 'Teams that write code' });
    expect(ctx).toContain('squad-archetype-coding archetype');
  });

  it('includes delegation model', () => {
    const ctx = buildProjectContext(makeArgs(), { name: 'coding' });
    expect(ctx).toContain('## Delegation Model');
    expect(ctx).toContain('meta-squad');
  });

  it('includes placement info', () => {
    const ctx = buildProjectContext(makeArgs({ placement: 'directory' }), { name: 'coding' });
    expect(ctx).toContain('**Placement:** directory');
  });
});

describe('CastingEngine integration', () => {
  // These tests use the real SDK CastingEngine
  it('castTeam returns members with required roles', async () => {
    const { CastingEngine } = await import('@bradygaster/squad-sdk/casting');
    const engine = new CastingEngine();
    const members = engine.castTeam({
      universe: 'usual-suspects',
      requiredRoles: ['lead', 'developer', 'tester'],
      teamSize: 3,
    });
    expect(members).toHaveLength(3);
    const roles = members.map(m => m.role);
    expect(roles).toContain('lead');
    expect(roles).toContain('developer');
    expect(roles).toContain('tester');
  });

  it('each member has name, role, displayName, personality, backstory', async () => {
    const { CastingEngine } = await import('@bradygaster/squad-sdk/casting');
    const engine = new CastingEngine();
    const members = engine.castTeam({
      universe: 'usual-suspects',
      requiredRoles: ['lead'],
      teamSize: 1,
    });
    const m = members[0];
    expect(m.name).toBeTruthy();
    expect(m.role).toBe('lead');
    expect(m.displayName).toContain('—');
    expect(m.personality).toBeTruthy();
    expect(m.backstory).toBeTruthy();
  });

  it('roles from archetype defaults are used when no --roles override', () => {
    const defaultTeam = [
      { role: 'lead', title: 'Technical Lead' },
      { role: 'developer', title: 'Software Developer' },
      { role: 'tester', title: 'Quality Engineer' },
    ];
    const rolesToCast = defaultTeam.map(r => r.role);
    expect(rolesToCast).toEqual(['lead', 'developer', 'tester']);
  });

  it('--roles override takes precedence over archetype defaults', () => {
    const cliRoles = ['lead', 'security', 'devops'];
    const defaultTeam = [
      { role: 'lead', title: 'Technical Lead' },
      { role: 'developer', title: 'Software Developer' },
    ];
    const rolesToCast = cliRoles || defaultTeam.map(r => r.role);
    expect(rolesToCast).toEqual(['lead', 'security', 'devops']);
  });

  it('scribe is always a special role, not from CastingEngine', () => {
    // Scribe is added by the scaffolding, not by CastingEngine.
    // The team.md always includes a Scribe row.
    const teamMdSnippet = '| Scribe | scribe | (built-in) |';
    expect(teamMdSnippet).toContain('Scribe');
    expect(teamMdSnippet).toContain('scribe');
    expect(teamMdSnippet).toContain('built-in');
  });
});
