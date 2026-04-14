/**
 * Unit tests for discovery.ts — domain and worktree discovery logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorktreeInfo, DomainWorktree } from '../../lib/registry/worktree-utils.js';

// Mock child_process
const mockExecSync = vi.fn();
vi.mock('child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

// Import after mocking
const { getAllWorktrees, discoverDomains, getWorktreeForBranch, listSquadBranches } = await import('../../lib/registry/worktree-utils.js');

describe('discovery.ts', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllWorktrees', () => {
    it('should parse porcelain worktree output correctly', () => {
      const mockOutput = `worktree /path/to/main
HEAD abc123
branch refs/heads/main

worktree /path/to/feature
branch refs/heads/squad/frontend

worktree /path/to/detached
HEAD def456
detached

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = getAllWorktrees();

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        path: '/path/to/main',
        branch: 'main',
        isDetached: false,
        isPrunable: false,
        isLocked: false,
      });
      expect(result[1]).toEqual({
        path: '/path/to/feature',
        branch: 'squad/frontend',
        isDetached: false,
        isPrunable: false,
        isLocked: false,
      });
      expect(result[2]).toEqual({
        path: '/path/to/detached',
        branch: null,
        isDetached: true,
        isPrunable: false,
        isLocked: false,
      });
    });

    it('should handle prunable and locked flags', () => {
      const mockOutput = `worktree /path/to/prunable
branch refs/heads/old-branch
prunable

worktree /path/to/locked
branch refs/heads/locked-branch
locked

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = getAllWorktrees();

      expect(result).toHaveLength(2);
      expect(result[0].isPrunable).toBe(true);
      expect(result[1].isLocked).toBe(true);
    });

    it('should return empty array on git command failure', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Not a git repository');
      });

      const result = getAllWorktrees();
      expect(result).toEqual([]);
    });

    it('should handle output without trailing newline', () => {
      const mockOutput = `worktree /path/to/single
branch refs/heads/main`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = getAllWorktrees();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('/path/to/single');
    });
  });

  describe('discoverDomains', () => {
    it('should filter squad branches with default prefix', () => {
      const mockOutput = `worktree /main
branch refs/heads/main

worktree /squad/frontend
branch refs/heads/squad/frontend

worktree /squad/backend
branch refs/heads/squad/backend

worktree /feature/something
branch refs/heads/feature/something

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = discoverDomains();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        domain: 'frontend',
        branch: 'squad/frontend',
        path: '/squad/frontend',
      });
      expect(result[1]).toEqual({
        domain: 'backend',
        branch: 'squad/backend',
        path: '/squad/backend',
      });
    });

    it('should respect custom branch prefix', () => {
      const mockOutput = `worktree /team/api
branch refs/heads/team/api

worktree /team/database
branch refs/heads/team/database

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = discoverDomains(undefined, 'team/');

      expect(result).toHaveLength(2);
      expect(result[0].domain).toBe('api');
      expect(result[1].domain).toBe('database');
    });

    it('should skip detached worktrees', () => {
      const mockOutput = `worktree /squad/valid
branch refs/heads/squad/valid

worktree /squad/detached
HEAD abc123
detached

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = discoverDomains();

      expect(result).toHaveLength(1);
      expect(result[0].domain).toBe('valid');
    });

    it('should handle empty repository', () => {
      mockExecSync.mockReturnValue('worktree /main\nbranch refs/heads/main\n\n');

      const result = discoverDomains();
      expect(result).toEqual([]);
    });
  });

  describe('getWorktreeForBranch', () => {
    it('should find worktree by branch name', () => {
      const mockOutput = `worktree /main
branch refs/heads/main

worktree /squad/frontend
branch refs/heads/squad/frontend

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = getWorktreeForBranch('squad/frontend');

      expect(result).not.toBeNull();
      expect(result?.path).toBe('/squad/frontend');
      expect(result?.branch).toBe('squad/frontend');
    });

    it('should return null when branch not found', () => {
      mockExecSync.mockReturnValue('worktree /main\nbranch refs/heads/main\n\n');

      const result = getWorktreeForBranch('squad/nonexistent');
      expect(result).toBeNull();
    });

    it('should handle branch name without refs/heads/ prefix', () => {
      const mockOutput = `worktree /feature
branch refs/heads/feature/test

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = getWorktreeForBranch('feature/test');
      expect(result).not.toBeNull();
      expect(result?.branch).toBe('feature/test');
    });
  });

  describe('listSquadBranches', () => {
    it('should extract branch names from squad worktrees', () => {
      const mockOutput = `worktree /main
branch refs/heads/main

worktree /squad/alpha
branch refs/heads/squad/alpha

worktree /squad/beta
branch refs/heads/squad/beta

worktree /squad/gamma
branch refs/heads/squad/gamma

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = listSquadBranches();

      expect(result).toEqual(['squad/alpha', 'squad/beta', 'squad/gamma']);
    });

    it('should return empty array when no squad branches', () => {
      mockExecSync.mockReturnValue('worktree /main\nbranch refs/heads/main\n\n');

      const result = listSquadBranches();
      expect(result).toEqual([]);
    });

    it('should respect custom branch prefix', () => {
      const mockOutput = `worktree /team/one
branch refs/heads/team/one

worktree /team/two
branch refs/heads/team/two

`;
      mockExecSync.mockReturnValue(mockOutput);

      const result = listSquadBranches(undefined, 'team/');
      expect(result).toEqual(['team/one', 'team/two']);
    });
  });
});
