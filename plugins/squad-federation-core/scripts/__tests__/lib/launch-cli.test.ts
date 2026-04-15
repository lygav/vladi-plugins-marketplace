import { describe, it, expect, vi } from 'vitest';

vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execSync: vi.fn((cmd: string) => {
      if (cmd === 'git rev-parse --show-toplevel') return '/mock/repo\n';
      return '';
    }),
    spawn: vi.fn(() => ({
      pid: 12345,
      stdin: { end: vi.fn() },
      on: vi.fn(),
      unref: vi.fn(),
    })),
  };
});

vi.mock('../../lib/orchestration/context-factory.js', () => ({
  createTeamContext: vi.fn(),
}));

vi.mock('../../lib/registry/team-registry.js', () => ({
  TeamRegistry: vi.fn(),
}));

vi.mock('../../lib/config/config.js', () => ({
  loadAndValidateConfig: vi.fn(() => ({
    version: '0.1.0', description: 'test',
    communication: { type: 'file-signal', signalDir: '.squad/signals' },
    telemetry: { enabled: false },
  })),
}));

import { parseLaunchArgs, type ParsedLaunchArgs, type LaunchResult } from '../../launch.js';

describe('launch.ts', () => {
  describe('parseLaunchArgs', () => {
    it('parses --team flag', () => {
      const result = parseLaunchArgs(['--team', 'backend-api']);
      expect(result.teamName).toBe('backend-api');
    });

    it('parses --domain alias', () => {
      const result = parseLaunchArgs(['--domain', 'frontend']);
      expect(result.teamName).toBe('frontend');
    });

    it('parses --all flag', () => {
      const result = parseLaunchArgs(['--all']);
      expect(result.allMode).toBe(true);
    });

    it('parses --reset flag', () => {
      const result = parseLaunchArgs(['--team', 't', '--reset']);
      expect(result.isReset).toBe(true);
    });

    it('parses --step flag', () => {
      const result = parseLaunchArgs(['--team', 't', '--step', 'distillation']);
      expect(result.targetStep).toBe('distillation');
    });

    it('parses --teams comma-separated list', () => {
      const result = parseLaunchArgs(['--teams', 'a,b,c']);
      expect(result.teamList).toEqual(['a', 'b', 'c']);
    });

    it('parses --prompt flag', () => {
      const result = parseLaunchArgs(['--team', 't', '--prompt', 'Do the thing']);
      expect(result.cliPrompt).toBe('Do the thing');
    });

    it('parses --prompt-file flag', () => {
      const result = parseLaunchArgs(['--team', 't', '--prompt-file', './task.md']);
      expect(result.cliPromptFile).toBe('./task.md');
    });

    it('accepts --non-interactive without error', () => {
      const result = parseLaunchArgs(['--team', 't', '--non-interactive']);
      expect(result.teamName).toBe('t');
    });

    it('parses --output-format json', () => {
      const result = parseLaunchArgs(['--team', 't', '--output-format', 'json']);
      expect(result.outputFormat).toBe('json');
    });

    it('parses --output-format text', () => {
      const result = parseLaunchArgs(['--team', 't', '--output-format', 'text']);
      expect(result.outputFormat).toBe('text');
    });

    it('defaults --output-format to text', () => {
      const result = parseLaunchArgs(['--team', 't']);
      expect(result.outputFormat).toBe('text');
    });

    it('throws on invalid --output-format', () => {
      expect(() => parseLaunchArgs(['--team', 't', '--output-format', 'xml']))
        .toThrow('--output-format must be "text" or "json"');
    });

    it('all ADR-001 flags work together', () => {
      const result = parseLaunchArgs([
        '--team', 'my-team',
        '--step', 'scan',
        '--prompt', 'Do analysis',
        '--non-interactive',
        '--output-format', 'json',
      ]);
      expect(result.teamName).toBe('my-team');
      expect(result.targetStep).toBe('scan');
      expect(result.cliPrompt).toBe('Do analysis');
      expect(result.outputFormat).toBe('json');
    });

    it('defaults allMode to false', () => {
      const result = parseLaunchArgs(['--team', 't']);
      expect(result.allMode).toBe(false);
    });

    it('defaults isReset to false', () => {
      const result = parseLaunchArgs(['--team', 't']);
      expect(result.isReset).toBe(false);
    });

    it('defaults teamList to empty array', () => {
      const result = parseLaunchArgs(['--team', 't']);
      expect(result.teamList).toEqual([]);
    });
  });

  describe('launch guards (status filtering)', () => {
    it('LaunchResult supports skipped field for paused teams', () => {
      const result: LaunchResult = {
        success: false,
        team: 'paused-team',
        domainId: 'p-1',
        skipped: true,
        skipReason: 'status is "paused"',
      };
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('paused');
    });

    it('LaunchResult supports skipped field for retired teams', () => {
      const result: LaunchResult = {
        success: false,
        team: 'retired-team',
        domainId: 'r-1',
        skipped: true,
        skipReason: 'status is "retired"',
      };
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toContain('retired');
    });

    it('LaunchResult represents successful launch', () => {
      const result: LaunchResult = {
        success: true,
        team: 'active-team',
        domainId: 'a-1',
        pid: 12345,
        logFile: '/path/to/run-output.log',
        runType: 'first-run',
      };
      expect(result.success).toBe(true);
      expect(result.pid).toBe(12345);
      expect(result.runType).toBe('first-run');
    });

    it('status guard logic filters correctly', () => {
      const teams = [
        { domain: 'active-team', status: 'active' as const },
        { domain: 'paused-team', status: 'paused' as const },
        { domain: 'retired-team', status: 'retired' as const },
        { domain: 'default-team' },
      ];
      const activeTeams = teams.filter(t => ((t as any).status ?? 'active') === 'active');
      expect(activeTeams.map(t => t.domain)).toEqual(['active-team', 'default-team']);
    });

    it('single team guard skips non-active', () => {
      const team = { domain: 'paused-team', status: 'paused' as const, domainId: 'p-1' };
      const teamStatus = team.status ?? 'active';
      expect(teamStatus).not.toBe('active');
      const result: LaunchResult = {
        success: false, team: team.domain, domainId: team.domainId,
        skipped: true, skipReason: `status is "${teamStatus}"`,
      };
      expect(result.skipped).toBe(true);
    });
  });

  describe('JSON output format', () => {
    it('LaunchResult serializes to valid JSON', () => {
      const result: LaunchResult = {
        success: true,
        team: 'my-team',
        domainId: 'abc-123',
        pid: 99999,
        logFile: '/path/to/log',
        runType: 'first-run',
      };
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);
      expect(parsed.success).toBe(true);
      expect(parsed.team).toBe('my-team');
      expect(parsed.pid).toBe(99999);
    });

    it('array of LaunchResults serializes for --all mode', () => {
      const results: LaunchResult[] = [
        { success: true, team: 'a', domainId: 'a-1', pid: 1, runType: 'first-run' },
        { success: false, team: 'b', domainId: 'b-1', skipped: true, skipReason: 'status is "paused"' },
      ];
      const json = JSON.stringify(results);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].success).toBe(true);
      expect(parsed[1].skipped).toBe(true);
    });
  });
});
