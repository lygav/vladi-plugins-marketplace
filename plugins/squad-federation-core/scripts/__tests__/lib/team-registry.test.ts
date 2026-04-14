/**
 * Unit tests for team-registry.ts — centralized team discovery and management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TeamEntry } from '../../lib/registry/team-registry.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

// Mock fs modules
vi.mock('fs/promises');
vi.mock('fs');
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
    vi.mocked(fsSync.existsSync).mockReturnValue(false);
    vi.mocked(fsSync.writeFileSync).mockReturnValue(undefined);
    vi.mocked(fsSync.unlinkSync).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('register', () => {
    it('should register a new team', async () => {
      const entry: TeamEntry = {
        domain: 'frontend',
        domainId: 'frontend-uuid',
        transport: 'worktree',
        location: '/test/repo/.worktrees/frontend',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
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
              transport: 'worktree',
              location: '/test/location',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

      const entry: TeamEntry = {
        domain: 'frontend',
        domainId: 'new-uuid',
        transport: 'worktree',
        location: '/new/location',
        createdAt: new Date().toISOString(),
      };

      await expect(registry.register(entry)).rejects.toThrow(/already registered/);
    });

    it('should support federation metadata', async () => {
      const entry: TeamEntry = {
        domain: 'backend',
        domainId: 'backend-uuid',
        transport: 'worktree',
        location: '/test/repo/.worktrees/backend',
        createdAt: new Date().toISOString(),
        federation: {
          parent: 'meta-squad',
          parentLocation: '/test/repo',
          role: 'team',
        },
      };

      await registry.register(entry);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.teams[0].federation).toEqual(entry.federation);
    });

    it('should support additional metadata', async () => {
      const entry: TeamEntry = {
        domain: 'api',
        domainId: 'api-uuid',
        transport: 'directory',
        location: '/custom/location',
        createdAt: new Date().toISOString(),
        metadata: {
          priority: 'high',
          owner: 'test-user',
          custom: { nested: 'value' },
        },
      };

      await registry.register(entry);

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
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
              transport: 'worktree',
              location: '/loc1',
              createdAt: new Date().toISOString(),
            },
            {
              domain: 'backend',
              domainId: 'uuid-2',
              transport: 'worktree',
              location: '/loc2',
              createdAt: new Date().toISOString(),
            },
          ],
        })
      );

      await registry.unregister('frontend');

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.teams).toHaveLength(1);
      expect(writtenData.teams[0].domain).toBe('backend');
    });

    it('should throw when unregistering non-existent team', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      await expect(registry.unregister('nonexistent')).rejects.toThrow(/not found/);
    });

    it('should return removed team entry', async () => {
      const existingTeam = {
        domain: 'frontend',
        domainId: 'uuid-1',
        transport: 'worktree' as const,
        location: '/loc1',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      const removed = await registry.unregister('frontend');
      expect(removed).toMatchObject(existingTeam);
    });
  });

  describe('list', () => {
    it('should list all teams', async () => {
      const teams: TeamEntry[] = [
        {
          domain: 'frontend',
          domainId: 'uuid-1',
          transport: 'worktree',
          location: '/loc1',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'backend',
          domainId: 'uuid-2',
          transport: 'directory',
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

    it('should filter teams by transport', async () => {
      const teams: TeamEntry[] = [
        {
          domain: 'team1',
          domainId: 'uuid-1',
          transport: 'worktree',
          location: '/loc1',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'team2',
          domainId: 'uuid-2',
          transport: 'directory',
          location: '/loc2',
          createdAt: new Date().toISOString(),
        },
        {
          domain: 'team3',
          domainId: 'uuid-3',
          transport: 'worktree',
          location: '/loc3',
          createdAt: new Date().toISOString(),
        },
      ];

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams })
      );

      const worktreeTeams = await registry.list({ transport: 'worktree' });
      expect(worktreeTeams).toHaveLength(2);
      expect(worktreeTeams.every((t) => t.transport === 'worktree')).toBe(true);
    });
  });

  describe('get', () => {
    it('should get team by domain', async () => {
      const team: TeamEntry = {
        domain: 'frontend',
        domainId: 'uuid-1',
        transport: 'worktree',
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
        transport: 'worktree',
        location: '/old/location',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      await registry.update('frontend', { location: '/new/location' });

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.teams[0].location).toBe('/new/location');
      expect(writtenData.teams[0].domainId).toBe('uuid-1'); // unchanged
    });

    it('should throw when updating non-existent team', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ version: '1.0', teams: [] }));

      await expect(registry.update('nonexistent', { location: '/new' })).rejects.toThrow(/not found/);
    });

    it('should not allow changing domain', async () => {
      const existingTeam: TeamEntry = {
        domain: 'frontend',
        domainId: 'uuid-1',
        transport: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ version: '1.0', teams: [existingTeam] })
      );

      await registry.update('frontend', { domain: 'new-name' } as any);

      // Domain should remain unchanged
      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.teams[0].domain).toBe('frontend');
    });
  });

  describe('file locking', () => {
    it('should acquire lock before write operations', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        transport: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      expect(fsSync.writeFileSync).toHaveBeenCalled();
      expect(fsSync.unlinkSync).toHaveBeenCalled();
    });

    it('should release lock after successful operation', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        transport: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await registry.register(entry);

      // Verify lock was released
      expect(fsSync.unlinkSync).toHaveBeenCalled();
    });

    it('should release lock after failed operation', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        transport: 'worktree',
        location: '/loc',
        createdAt: new Date().toISOString(),
      };

      await expect(registry.register(entry)).rejects.toThrow('Write failed');

      // Lock should still be released
      expect(fsSync.unlinkSync).toHaveBeenCalled();
    });
  });

  describe('migration from worktree-based discovery', () => {
    it('should handle empty registry initialization', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const teams = await registry.list();
      expect(teams).toEqual([]);
    });

    it('should create registry directory on first write', async () => {
      const entry: TeamEntry = {
        domain: 'test',
        domainId: 'uuid',
        transport: 'worktree',
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
