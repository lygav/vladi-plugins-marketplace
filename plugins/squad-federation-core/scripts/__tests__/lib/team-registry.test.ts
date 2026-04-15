/**
 * Unit tests for team-registry.ts — centralized team discovery and management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TeamEntry } from '../../lib/registry/team-registry.js';
import * as fs from 'fs/promises';

// Mock fs modules
vi.mock('fs/promises');
vi.mock('child_process');

const { TeamRegistry } = await import('../../lib/registry/team-registry.js');

describe('team-registry.ts', () => {
  let registry: InstanceType<typeof TeamRegistry>;
  const testRepoRoot = '/test/repo';

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new TeamRegistry(testRepoRoot);

    // Mock file system operations
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.rename).mockResolvedValue(undefined);
    vi.mocked(fs.unlink).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new team', async () => {
      const entry: TeamEntry = {
        domain: 'frontend',
        domainId: 'frontend-uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/test/repo/.worktrees/frontend',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      expect(fs.writeFile).toHaveBeenCalled();
      // Find the registry data write (not the lock file write)
      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams).toHaveLength(1);
      expect(writtenData.teams[0]).toMatchObject(entry);
    });

    it('should prevent duplicate domain registration', async () => {
      // Simulate existing team in registry
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          version: '1.0',
          teams: [
            {
              domain: 'frontend',
              domainId: 'existing-uuid',
              archetypeId: 'deliverable',
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
        placementType: 'worktree',
        location: '/new/location',
        createdAt: new Date().toISOString(),
      };

      await expect(registry.register(entry)).rejects.toThrow(/already registered/);
    });

    it('should support federation metadata', async () => {
      const entry: TeamEntry = {
        domain: 'backend',
        domainId: 'backend-uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/test/repo/.worktrees/backend',
        createdAt: new Date().toISOString(),
        federation: {
          parent: 'meta-squad',
          parentLocation: '/test/repo',
          role: 'team',
        },
      };

      await registry.register(entry);

      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams[0].federation).toEqual(entry.federation);
    });

    it('should support additional metadata', async () => {
      const entry: TeamEntry = {
        domain: 'api',
        domainId: 'api-uuid',
        archetypeId: 'deliverable',
        placementType: 'directory',
        location: '/custom/location',
        createdAt: new Date().toISOString(),
        metadata: {
          priority: 'high',
          owner: 'test-user',
          custom: { nested: 'value' },
        },
      };

      await registry.register(entry);

      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams[0].metadata).toEqual(entry.metadata);
    });
  });

  describe('unregister', () => {
    it('should remove team by domain', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          version: '1.0',
          teams: [
            {
              domain: 'frontend',
              domainId: 'uuid-1',
              archetypeId: 'deliverable',
              placementType: 'worktree',
              location: '/loc1',
              createdAt: new Date().toISOString(),
            },
            {
              domain: 'backend',
              domainId: 'uuid-2',
              archetypeId: 'deliverable',
              placementType: 'worktree',
              location: '/loc2',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

      await registry.unregister('frontend');

      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams).toHaveLength(1);
      expect(writtenData.teams[0].domain).toBe('backend');
    });

    it('should return false when unregistering non-existent team', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      const result = await registry.unregister('nonexistent');
      expect(result).toBe(false);
    });

    it('should return true when team is found', async () => {
      const existingTeam = {
        domain: 'frontend',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
        placementType: 'worktree' as const,
        location: '/loc1',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      const removed = await registry.unregister('frontend');
      expect(removed).toBe(true);
    });
  });

  describe('list', () => {
    it('should list all teams', async () => {
      const teams: TeamEntry[] = [
        {
          domain: 'frontend',
          domainId: 'uuid-1',
          archetypeId: 'deliverable',
          placementType: 'worktree',
          location: '/loc1',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'backend',
          domainId: 'uuid-2',
          archetypeId: 'deliverable',
          placementType: 'directory',
          location: '/loc2',
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams })
      );

      const result = await registry.list();
      expect(result).toHaveLength(2);
      expect(result).toEqual(teams);
    });

    it('should return empty array when no teams registered', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      const result = await registry.list();
      expect(result).toEqual([]);
    });

    it('should filter teams by placementType', async () => {
      const teams: TeamEntry[] = [
        {
          domain: 'team1',
          domainId: 'uuid-1',
          archetypeId: 'deliverable',
          placementType: 'worktree',
          location: '/loc1',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'team2',
          domainId: 'uuid-2',
          archetypeId: 'deliverable',
          placementType: 'directory',
          location: '/loc2',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'team3',
          domainId: 'uuid-3',
          archetypeId: 'deliverable',
          placementType: 'worktree',
          location: '/loc3',
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams })
      );

      const allTeams = await registry.list();
      const worktreeTeams = allTeams.filter((t) => t.placementType === 'worktree');
      expect(worktreeTeams).toHaveLength(2);
      expect(worktreeTeams.every((t) => t.placementType === 'worktree')).toBe(true);
    });
  });

  describe('get', () => {
    it('should get team by domain', async () => {
      const team: TeamEntry = {
        domain: 'frontend',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
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

    it('should return null when team not found', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      const result = await registry.get('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update team metadata', async () => {
      const existingTeam: TeamEntry = {
        domain: 'frontend',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/old/location',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      await registry.update('frontend', { location: '/new/location' });

      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams[0].location).toBe('/new/location');
      expect(writtenData.teams[0].domainId).toBe('uuid-1'); // unchanged
    });

    it('should return false when updating non-existent team', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      const result = await registry.update('nonexistent', { location: '/new' });
      expect(result).toBe(false);
    });

    it('should allow updating domain through merge', async () => {
      const existingTeam: TeamEntry = {
        domain: 'frontend',
        domainId: 'uuid-1',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      await registry.update('frontend', { domain: 'new-name' } as any);

      // Domain is updated since update uses object spread merge
      const writeCalls = vi.mocked(fs.writeFile).mock.calls;
      const registryCall = writeCalls.find(c => typeof c[1] === 'string' && (c[1] as string).includes('"teams"'));
      expect(registryCall).toBeDefined();
      const writtenData = JSON.parse(registryCall![1] as string);
      expect(writtenData.teams[0].domain).toBe('new-name');
    });
  });

  describe('file locking', () => {
    it('should acquire lock before write operations', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      // Lock is acquired via fs.writeFile with wx flag, released via fs.unlink
      expect(fs.writeFile).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should release lock after successful operation', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      // Verify lock was released via fs.unlink
      expect(fs.unlink).toHaveBeenCalled();
    });

    it('should release lock after failed operation', async () => {
      // Make the rename fail (which is the final step of save)
      vi.mocked(fs.rename).mockRejectedValue(new Error('Rename failed'));

      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await expect(registry.register(entry)).rejects.toThrow();

      // Lock should still be released
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe('migration from worktree-based discovery', () => {
    it('should handle empty registry initialization', async () => {
      const enoentError = new Error('ENOENT: no such file or directory') as NodeJS.ErrnoException;
      enoentError.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(enoentError);

      const teams = await registry.list();
      expect(teams).toEqual([]);
    });

    it('should create registry directory on first write', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        archetypeId: 'deliverable',
        placementType: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('.squad'),
        expect.objectContaining({ recursive: true })
      );
    });
  });
});

