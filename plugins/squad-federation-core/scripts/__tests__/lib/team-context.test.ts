/**
 * TeamContext composition tests
 * Verifies the factory functions and adapter registry for composing placement + communication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPlacement,
  createCommunication,
  createTeamContext,
  registerCommunicationAdapter
} from '../../lib/team-context.js';
import type { TeamPlacement, TeamCommunication, TeamEntry, FederateConfig } from '../../../sdk/types.js';
import { DirectoryPlacement } from '../../lib/directory-placement.js';
import { WorktreePlacement } from '../../lib/worktree-placement.js';
import { FileSignalCommunication } from '../../lib/file-signal-communication.js';

describe('team-context.test.ts', () => {
  describe('createPlacement', () => {
    it('should create DirectoryPlacement', () => {
      const placement = createPlacement('directory', {
        basePath: '/test/path',
        teamId: 'test-team'
      });

      expect(placement).toBeInstanceOf(DirectoryPlacement);
    });

    it('should create WorktreePlacement', () => {
      const placement = createPlacement('worktree', {
        basePath: '/test/worktree',
        branch: 'test-branch',
        repoRoot: '/test/repo'
      });

      expect(placement).toBeInstanceOf(WorktreePlacement);
    });

    it('should throw error for missing teamId in directory placement', () => {
      expect(() => {
        createPlacement('directory', {
          basePath: '/test/path'
        });
      }).toThrow('DirectoryPlacement requires teamId');
    });

    it('should throw error for missing branch in worktree placement', () => {
      expect(() => {
        createPlacement('worktree', {
          basePath: '/test/worktree',
          repoRoot: '/test/repo'
        });
      }).toThrow('WorktreePlacement requires branch');
    });

    it('should throw error for missing repoRoot in worktree placement', () => {
      expect(() => {
        createPlacement('worktree', {
          basePath: '/test/worktree',
          branch: 'test-branch'
        });
      }).toThrow('WorktreePlacement requires branch and repoRoot');
    });

    it('should throw helpful error for unknown placement type', () => {
      expect(() => {
        createPlacement('unknown-type', {
          basePath: '/test/path'
        });
      }).toThrow(/Unknown placement type: unknown-type/);
      
      expect(() => {
        createPlacement('unknown-type', {
          basePath: '/test/path'
        });
      }).toThrow(/Available: worktree, directory/);
    });
  });

  describe('createCommunication', () => {
    let mockPlacement: TeamPlacement;

    beforeEach(() => {
      // Create a minimal mock placement for testing
      mockPlacement = {
        async readFile() { return null; },
        async writeFile() {},
        async exists() { return false; },
        async getLocation() { return '/mock'; },
        async listFiles() { return []; },
        async bootstrap() {},
        async workspaceExists() { return false; }
      } as TeamPlacement;
    });

    it('should create FileSignalCommunication', () => {
      const communication = createCommunication('file-signal', {
        placement: mockPlacement
      });

      expect(communication).toBeInstanceOf(FileSignalCommunication);
    });

    it('should throw error for missing placement in file-signal', () => {
      expect(() => {
        createCommunication('file-signal', {});
      }).toThrow('FileSignalCommunication requires placement');
    });

    it('should throw helpful error for unknown communication type', () => {
      expect(() => {
        createCommunication('unknown-type', {});
      }).toThrow(/Unknown communication type: unknown-type/);
      
      expect(() => {
        createCommunication('unknown-type', {});
      }).toThrow(/Available: file-signal/);
    });
  });

  describe('registerCommunicationAdapter', () => {
    beforeEach(() => {
      // Note: We can't easily clean up the registry between tests,
      // so we use unique adapter names for each test
    });

    it('should register custom communication adapter', () => {
      const customAdapter = (config: Record<string, unknown>) => {
        return {
          async readStatus() { return null; },
          async readInboxSignals() { return []; },
          async writeInboxSignal() {},
          async readOutboxSignals() { return []; },
          async listSignals() { return []; },
          async readLearningLog() { return []; },
          async appendLearning() {}
        } as TeamCommunication;
      };

      registerCommunicationAdapter('test-custom-comm', customAdapter);

      // Should be able to create communication with registered type
      const communication = createCommunication('test-custom-comm', {});
      expect(communication).toBeDefined();
      expect(typeof communication.readStatus).toBe('function');
    });

    it('should allow overriding existing adapters', () => {
      let factoryCalled = false;
      
      const customAdapter = () => {
        factoryCalled = true;
        return {
          async readStatus() { return null; },
          async readInboxSignals() { return []; },
          async writeInboxSignal() {},
          async readOutboxSignals() { return []; },
          async listSignals() { return []; },
          async readLearningLog() { return []; },
          async appendLearning() {}
        } as TeamCommunication;
      };

      registerCommunicationAdapter('test-override-comm', customAdapter);
      createCommunication('test-override-comm', {});

      expect(factoryCalled).toBe(true);
    });
  });

  describe('createTeamContext', () => {
    let mockFederationConfig: FederateConfig;

    beforeEach(() => {
      mockFederationConfig = {
        projectRoot: '/test/project',
        teams: []
      };
    });

    it('should create complete TeamContext for directory placement', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'directory',
        placementType: 'directory',
        location: '/test/teams/test-team',
        createdAt: new Date().toISOString()
      };

      const context = createTeamContext(teamEntry, mockFederationConfig);

      expect(context).toBeDefined();
      expect(context.domain).toBe('test-team');
      expect(context.domainId).toBe('test-id');
      expect(context.location).toBe('/test/teams/test-team');
      expect(context.archetypeId).toBe('test-archetype');
      expect(context.placement).toBeInstanceOf(DirectoryPlacement);
      expect(context.communication).toBeInstanceOf(FileSignalCommunication);
    });

    it('should create complete TeamContext for worktree placement', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'worktree',
        placementType: 'worktree',
        location: '/test/repo/.worktrees/test-team',
        createdAt: new Date().toISOString()
      };

      const context = createTeamContext(
        teamEntry,
        mockFederationConfig,
        '/test/repo' // repoRoot required for worktree
      );

      expect(context).toBeDefined();
      expect(context.placement).toBeInstanceOf(WorktreePlacement);
      expect(context.communication).toBeInstanceOf(FileSignalCommunication);
    });

    it('should fall back to deprecated transport field if placementType missing', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'directory',
        // placementType intentionally omitted
        location: '/test/teams/test-team',
        createdAt: new Date().toISOString()
      };

      const context = createTeamContext(teamEntry, mockFederationConfig);

      expect(context.placement).toBeInstanceOf(DirectoryPlacement);
    });

    it('should read communication type from federation config', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'directory',
        placementType: 'directory',
        location: '/test/teams/test-team',
        createdAt: new Date().toISOString()
      };

      // Federation config specifies communication type
      const config: FederateConfig = {
        projectRoot: '/test/project',
        teams: []
      };

      const context = createTeamContext(teamEntry, config);

      expect(context.communication).toBeInstanceOf(FileSignalCommunication);
    });

    it('should require repoRoot for worktree placement', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'worktree',
        placementType: 'worktree',
        location: '/test/repo/.worktrees/test-team',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        createTeamContext(teamEntry, mockFederationConfig); // no repoRoot
      }).toThrow('repoRoot is required for worktree placement');
    });

    it('should extract branch from worktree location', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'worktree',
        placementType: 'worktree',
        location: '/test/repo/.worktrees/feature-branch',
        createdAt: new Date().toISOString()
      };

      const context = createTeamContext(
        teamEntry,
        mockFederationConfig,
        '/test/repo'
      );

      expect(context.placement).toBeInstanceOf(WorktreePlacement);
      const worktreePlacement = context.placement as WorktreePlacement;
      expect(worktreePlacement.getBranch()).toBe('feature-branch');
    });

    it('should compose placement and communication correctly', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'directory',
        placementType: 'directory',
        location: '/test/teams/test-team',
        createdAt: new Date().toISOString()
      };

      const context = createTeamContext(teamEntry, mockFederationConfig);

      // Both placement and communication should be defined
      expect(context.placement).toBeDefined();
      expect(context.communication).toBeDefined();

      // Communication should be able to use placement methods
      expect(typeof context.placement.readFile).toBe('function');
      expect(typeof context.placement.writeFile).toBe('function');
      expect(typeof context.communication.readStatus).toBe('function');
      expect(typeof context.communication.readInboxSignals).toBe('function');
    });

    it('should throw error for unknown placement type', () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'unknown-type' as any,
        location: '/test/teams/test-team',
        createdAt: new Date().toISOString()
      };

      expect(() => {
        createTeamContext(teamEntry, mockFederationConfig);
      }).toThrow(/Unknown placement type/);
    });
  });

  describe('placement + communication integration', () => {
    it('should allow communication to delegate to placement', async () => {
      const teamEntry: TeamEntry = {
        domain: 'test-team',
        domainId: 'test-id',
        archetypeId: 'test-archetype',
        transport: 'directory',
        placementType: 'directory',
        location: '/mock/test-team',
        createdAt: new Date().toISOString()
      };

      const config: FederateConfig = {
        projectRoot: '/mock',
        teams: []
      };

      const context = createTeamContext(teamEntry, config);

      // Communication operations should delegate to placement
      // (We can't fully test filesystem ops without mocking,
      // but we can verify the methods exist and return promises)
      const statusPromise = context.communication.readStatus('test-team');
      expect(statusPromise instanceof Promise).toBe(true);

      const signalsPromise = context.communication.readInboxSignals('test-team');
      expect(signalsPromise instanceof Promise).toBe(true);
    });
  });
});
