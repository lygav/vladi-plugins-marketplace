/**
 * Unit tests for team-registry.ts — centralized team discovery and management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TeamEntry } from '../../lib/team-registry.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

vi.mock('fs/promises');
vi.mock('fs');
vi.mock('child_process');

const { TeamRegistry } = await import('../../lib/team-registry.js');

describe('team-registry.ts', () => {
  let registry: InstanceType<typeof TeamRegistry>;
  const testRepoRoot = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new TeamRegistry(testRepoRoot);

    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fsSync.existsSync).mockReturnValue(false);
    vi.mocked(fsSync.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fsSync.unlinkSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register a new team', async () => {
    const entry: TeamEntry = {
      domain: 'frontend',
      domainId: 'frontend-uuid',
      archetypeId: 'deliverable',
      transport: 'worktree',
      placementType: 'worktree',
      location: '/test/repo/.worktrees/frontend',
      createdAt: new Date().toISOString(),
    };

    await registry.register(entry);

    const writeCalls = vi.mocked(fs.writeFile).mock.calls;
    const registryCall = writeCalls.find((call) => String(call[0]).includes('teams.json.tmp'));
    const writtenData = JSON.parse((registryCall?.[1] as string) || '{}');
    expect(writtenData.teams).toHaveLength(1);
    expect(writtenData.teams[0]).toMatchObject(entry);
  });

  it('should prevent duplicate domain registration', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        version: '1.0',
        teams: [
          {
            domain: 'frontend',
            domainId: 'existing-uuid',
            archetypeId: 'deliverable',
            transport: 'worktree',
            placementType: 'worktree',
            location: '/test/location',
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );

    const entry: TeamEntry = {
      domain: 'frontend',
      domainId: 'new-uuid',
      archetypeId: 'deliverable',
      transport: 'worktree',
      placementType: 'worktree',
      location: '/new/location',
      createdAt: new Date().toISOString(),
    };

    await expect(registry.register(entry)).rejects.toThrow(/already registered/);
  });

  it('should list all teams', async () => {
    const teams: TeamEntry[] = [
      {
        domain: 'frontend',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
        transport: 'worktree',
        placementType: 'worktree',
        location: '/loc1',
        createdAt: new Date().toISOString(),
      },
      {
        domain: 'backend',
        domainId: 'uuid-2',
        archetypeId: 'triage',
        transport: 'directory',
        placementType: 'directory',
        location: '/loc2',
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: '1.0', teams })
    );

    const result = await registry.list();
    expect(result).toEqual(teams);
  });

  it('should filter teams by transport', async () => {
    const teams: TeamEntry[] = [
      {
        domain: 'team1',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
        transport: 'worktree',
        placementType: 'worktree',
        location: '/loc1',
        createdAt: new Date().toISOString(),
      },
      {
        domain: 'team2',
        domainId: 'uuid-2',
        archetypeId: 'triage',
        transport: 'directory',
        placementType: 'directory',
        location: '/loc2',
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: '1.0', teams })
    );

    const worktreeTeams = await registry.listByTransport('worktree');
    expect(worktreeTeams).toHaveLength(1);
    expect(worktreeTeams[0].transport).toBe('worktree');
  });

  it('should get team by domain', async () => {
    const team: TeamEntry = {
      domain: 'frontend',
      domainId: 'uuid-1',
      archetypeId: 'deliverable',
      transport: 'worktree',
      placementType: 'worktree',
      location: '/loc1',
      createdAt: new Date().toISOString(),
    };

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: '1.0', teams: [team] })
    );

    const result = await registry.get('frontend');
    expect(result).toEqual(team);
  });

  it('should update team metadata', async () => {
    const existingTeam: TeamEntry = {
      domain: 'frontend',
      domainId: 'uuid-1',
      archetypeId: 'deliverable',
      transport: 'worktree',
      placementType: 'worktree',
      location: '/old/location',
      createdAt: new Date().toISOString(),
    };

    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ version: '1.0', teams: [existingTeam] })
    );

    const updated = await registry.update('frontend', { location: '/new/location' });
    expect(updated).toBe(true);

    const writeCalls = vi.mocked(fs.writeFile).mock.calls;
    const registryCall = writeCalls.find((call) => String(call[0]).includes('teams.json.tmp'));
    const writtenData = JSON.parse((registryCall?.[1] as string) || '{}');
    expect(writtenData.teams[0].location).toBe('/new/location');
  });

  it('should unregister a team', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({
        version: '1.0',
        teams: [
          {
            domain: 'frontend',
            domainId: 'uuid-1',
            archetypeId: 'deliverable',
            transport: 'worktree',
            placementType: 'worktree',
            location: '/loc1',
            createdAt: new Date().toISOString(),
          },
        ],
      })
    );

    const removed = await registry.unregister('frontend');
    expect(removed).toBe(true);
  });

  it('should acquire lock before write operations', async () => {
    const entry: TeamEntry = {
      domain: 'test',
      domainId: 'uuid',
      archetypeId: 'deliverable',
      transport: 'worktree',
      placementType: 'worktree',
      location: '/loc',
      createdAt: new Date().toISOString(),
    };

    await registry.register(entry);

    expect(fs.writeFile).toHaveBeenCalled();
    expect(fs.unlink).toHaveBeenCalled();
  });
});
