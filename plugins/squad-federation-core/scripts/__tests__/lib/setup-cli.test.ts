import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock child_process before importing the module under test
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      if (cmd === 'squad init') return '';
      return '';
    }),
  };
});

const mockExistsSync = vi.fn().mockReturnValue(false);
const mockMkdirSync = vi.fn();
const mockWriteFileSync = vi.fn();
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: (...args: any[]) => mockExistsSync(...args),
    mkdirSync: (...args: any[]) => mockMkdirSync(...args),
    writeFileSync: (...args: any[]) => mockWriteFileSync(...args),
  };
});

import {
  parseSetupArgs,
  buildConfig,
  checkPrerequisites,
  validateDryRun,
  type ParsedSetupArgs,
  type SetupResult,
} from '../../setup.js';
import * as child_process from 'child_process';

describe('parseSetupArgs', () => {
  it('parses --description', () => {
    const a = parseSetupArgs(['--description', 'My federation']);
    expect(a.description).toBe('My federation');
  });

  it('--telemetry defaults to true', () => {
    const a = parseSetupArgs(['--description', 'test']);
    expect(a.telemetry).toBe(true);
  });

  it('--no-telemetry disables telemetry', () => {
    const a = parseSetupArgs(['--description', 'test', '--no-telemetry']);
    expect(a.telemetry).toBe(false);
  });

  it('--telemetry enables telemetry', () => {
    const a = parseSetupArgs(['--description', 'test', '--no-telemetry', '--telemetry']);
    expect(a.telemetry).toBe(true);
  });

  it('--telemetry-endpoint sets endpoint', () => {
    const a = parseSetupArgs(['--description', 'test', '--telemetry-endpoint', 'http://otel:4318']);
    expect(a.telemetryEndpoint).toBe('http://otel:4318');
  });

  it('--teams-notification with IDs', () => {
    const a = parseSetupArgs([
      '--description', 'test',
      '--teams-notification',
      '--teams-team-id', 'tid-123',
      '--teams-channel-id', '19:abc@thread.tacv2',
    ]);
    expect(a.teamsNotification).toBe(true);
    expect(a.teamsTeamId).toBe('tid-123');
    expect(a.teamsChannelId).toBe('19:abc@thread.tacv2');
  });

  it('--presence-interval sets interval', () => {
    const a = parseSetupArgs(['--description', 'test', '--presence-interval', '30']);
    expect(a.presenceInterval).toBe(30);
  });

  it('--non-interactive defaults to false', () => {
    const a = parseSetupArgs(['--description', 'test']);
    expect(a.nonInteractive).toBe(false);
  });

  it('--non-interactive sets true', () => {
    const a = parseSetupArgs(['--description', 'test', '--non-interactive']);
    expect(a.nonInteractive).toBe(true);
  });

  it('--output-format defaults to text', () => {
    const a = parseSetupArgs(['--description', 'test']);
    expect(a.outputFormat).toBe('text');
  });

  it('--output-format accepts json', () => {
    const a = parseSetupArgs(['--description', 'test', '--output-format', 'json']);
    expect(a.outputFormat).toBe('json');
  });

  it('--dry-run defaults to false', () => {
    const a = parseSetupArgs(['--description', 'test']);
    expect(a.dryRun).toBe(false);
  });

  it('--dry-run sets true', () => {
    const a = parseSetupArgs(['--description', 'test', '--dry-run']);
    expect(a.dryRun).toBe(true);
  });

  it('all flags work together', () => {
    const a = parseSetupArgs([
      '--description', 'Full config',
      '--telemetry', '--telemetry-endpoint', 'http://otel:4318',
      '--teams-notification', '--teams-team-id', 'tid', '--teams-channel-id', 'cid',
      '--presence-interval', '30',
      '--non-interactive', '--output-format', 'json', '--dry-run',
    ]);
    expect(a.description).toBe('Full config');
    expect(a.telemetry).toBe(true);
    expect(a.telemetryEndpoint).toBe('http://otel:4318');
    expect(a.teamsNotification).toBe(true);
    expect(a.teamsTeamId).toBe('tid');
    expect(a.teamsChannelId).toBe('cid');
    expect(a.presenceInterval).toBe(30);
    expect(a.nonInteractive).toBe(true);
    expect(a.outputFormat).toBe('json');
    expect(a.dryRun).toBe(true);
  });
});

describe('buildConfig', () => {
  function makeArgs(o: Partial<ParsedSetupArgs> = {}): ParsedSetupArgs {
    return {
      description: 'Test federation',
      telemetry: true,
      teamsNotification: false,
      nonInteractive: true,
      outputFormat: 'json',
      dryRun: false,
      ...o,
    };
  }

  it('generates minimal config', () => {
    const config = buildConfig(makeArgs());
    expect(config.description).toBe('Test federation');
    expect(config.telemetry).toEqual({ enabled: true });
    expect(config).not.toHaveProperty('teamsConfig');
  });

  it('includes telemetry endpoint when provided', () => {
    const config = buildConfig(makeArgs({ telemetryEndpoint: 'http://otel:4318' }));
    expect(config.telemetry).toEqual({ enabled: true, endpoint: 'http://otel:4318' });
  });

  it('disables telemetry', () => {
    const config = buildConfig(makeArgs({ telemetry: false }));
    expect(config.telemetry).toEqual({ enabled: false });
  });

  it('includes Teams config when enabled', () => {
    const config = buildConfig(makeArgs({
      teamsNotification: true,
      teamsTeamId: 'tid-123',
      teamsChannelId: '19:abc@thread.tacv2',
    }));
    expect(config.teamsConfig).toEqual({
      teamId: 'tid-123',
      channelId: '19:abc@thread.tacv2',
    });
  });

  it('omits Teams config when disabled', () => {
    const config = buildConfig(makeArgs({ teamsNotification: false }));
    expect(config).not.toHaveProperty('teamsConfig');
  });

  it('produces JSON-serializable output', () => {
    const config = buildConfig(makeArgs({
      teamsNotification: true, teamsTeamId: 't', teamsChannelId: 'c',
      presenceInterval: 30,
      telemetryEndpoint: 'http://otel:4318',
    }));
    const json = JSON.stringify(config);
    expect(JSON.parse(json)).toEqual(config);
  });
});

describe('checkPrerequisites', () => {
  beforeEach(() => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('all pass when environment is good', () => {
    const results = checkPrerequisites('/fake');
    expect(results.every(r => r.status === 'ok')).toBe(true);
  });

  it('fails when git too old', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.10.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
    const results = checkPrerequisites('/fake');
    const git = results.find(r => r.name === 'git');
    expect(git?.status).toBe('fail');
  });

  it('fails when not in git repo', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') throw new Error('not a repo');
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
    const results = checkPrerequisites('/fake');
    const repo = results.find(r => r.name === 'git-repo');
    expect(repo?.status).toBe('fail');
  });

  it('warns on uncommitted changes', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return 'M file.ts\nA new.ts\n';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
    const results = checkPrerequisites('/fake');
    const clean = results.find(r => r.name === 'git-clean');
    expect(clean?.status).toBe('warn');
    expect(clean?.message).toContain('2 uncommitted');
  });

  it('warns when Docker not found', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') throw new Error('not found');
      return '';
    });
    const results = checkPrerequisites('/fake');
    const docker = results.find(r => r.name === 'docker');
    expect(docker?.status).toBe('warn');
  });

  it('warns when Squad not found', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') throw new Error('not found');
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
    const results = checkPrerequisites('/fake');
    const squad = results.find(r => r.name === 'squad');
    expect(squad?.status).toBe('warn');
  });

  it('fails when Node.js too old', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v18.0.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
    const results = checkPrerequisites('/fake');
    const node = results.find(r => r.name === 'node');
    expect(node?.status).toBe('fail');
  });
});

describe('validateDryRun', () => {
  const root = '/fake/repo';

  function makeArgs(o: Partial<ParsedSetupArgs> = {}): ParsedSetupArgs {
    return {
      description: 'Test federation',
      telemetry: true,
      teamsNotification: false,
      nonInteractive: true,
      outputFormat: 'json',
      dryRun: true,
      ...o,
    };
  }

  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') return 'git version 2.43.0\n';
      if (cmd === 'git rev-parse --is-inside-work-tree') return 'true\n';
      if (cmd === 'git status --porcelain') return '';
      if (cmd === 'node --version') return 'v20.11.0\n';
      if (cmd === 'squad --version') return '1.2.0\n';
      if (cmd === 'docker --version') return 'Docker version 24.0.0\n';
      return '';
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns dryRun: true', () => {
    expect(validateDryRun(makeArgs(), root).dryRun).toBe(true);
  });

  it('succeeds when all prerequisites pass', () => {
    const result = validateDryRun(makeArgs(), root);
    expect(result.success).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('fails when prerequisites fail', () => {
    vi.mocked(child_process.execSync).mockImplementation((cmd: string) => {
      if (cmd === 'git --version') throw new Error('not found');
      if (cmd === 'git rev-parse --is-inside-work-tree') throw new Error('no');
      if (cmd === 'git status --porcelain') throw new Error('no');
      if (cmd === 'node --version') return 'v18.0.0\n';
      if (cmd === 'squad --version') throw new Error('not found');
      if (cmd === 'docker --version') throw new Error('not found');
      return '';
    });
    const result = validateDryRun(makeArgs(), root);
    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('warns when config already exists', () => {
    mockExistsSync.mockImplementation((p: string) =>
      typeof p === 'string' && p.includes('federate.config.json')
    );
    const result = validateDryRun(makeArgs(), root);
    expect(result.warnings?.some(w => w.includes('already exists'))).toBe(true);
  });

  it('includes generated config', () => {
    const result = validateDryRun(makeArgs(), root);
    expect(result.config.description).toBe('Test federation');
    expect(result.config.telemetry).toEqual({ enabled: true });
  });

  it('includes config paths', () => {
    const result = validateDryRun(makeArgs(), root);
    expect(result.configPath).toBe(path.join(root, 'federate.config.json'));
    expect(result.squadDir).toBe(path.join(root, '.squad'));
    expect(result.registryPath).toBe(path.join(root, '.squad', 'teams.json'));
  });

  it('is JSON-serializable', () => {
    const result = validateDryRun(makeArgs(), root);
    expect(JSON.parse(JSON.stringify(result)).success).toBe(true);
  });
});

describe('SetupResult', () => {
  it('success has no errors', () => {
    const r: SetupResult = {
      success: true,
      configPath: '/p/federate.config.json',
      config: { description: 'test' },
      squadDir: '/p/.squad',
      registryPath: '/p/.squad/teams.json',
      prerequisites: [],
      dryRun: false,
    };
    expect(JSON.parse(JSON.stringify(r)).errors).toBeUndefined();
  });

  it('failure has errors', () => {
    const r: SetupResult = {
      success: false,
      configPath: '/p/federate.config.json',
      config: {},
      squadDir: '/p/.squad',
      registryPath: '/p/.squad/teams.json',
      prerequisites: [],
      dryRun: false,
      errors: ['A', 'B'],
    };
    expect(JSON.parse(JSON.stringify(r)).errors).toHaveLength(2);
  });
});
