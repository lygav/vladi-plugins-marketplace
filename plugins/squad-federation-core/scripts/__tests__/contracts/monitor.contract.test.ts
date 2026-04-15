/**
 * Contract tests for MonitorBase implementations
 * Verifies that monitor implementations satisfy the MonitorBase contract
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockPlacement } from '../helpers/mock-placement.js';
import { MockCommunication } from '../helpers/mock-communication.js';
import { createTestStatus } from '../helpers/test-fixtures.js';
import { MonitorBase } from '../../../sdk/monitor-base.js';
import type { ScanStatus, DashboardEntry, TeamPlacement, TeamCommunication } from '../../../sdk/types.js';

// Helper to create a valid DashboardEntry for tests
function makeDashboardEntry(overrides?: Partial<DashboardEntry>): DashboardEntry {
  return {
    domain: 'test-domain',
    domainId: 'test-domain-id',
    archetypeId: 'test-archetype',
    state: 'scanning',
    health: 'healthy',
    progress: 50,
    lastUpdate: new Date().toISOString(),
    ...overrides,
  };
}

// Mock monitor implementation for testing
class TestMonitor extends MonitorBase<{ testData: string }> {
  get archetypeName(): string {
    return 'test-archetype';
  }

  async collectArchetypeData(
    placement: TeamPlacement,
    communication: TeamCommunication,
    status: ScanStatus
  ) {
    return { testData: `data-for-${status.domain}` };
  }

  formatArchetypeColumns(entry: DashboardEntry): string {
    return `Test: ${(entry.metadata as any)?.testData || 'N/A'}`;
  }
}

describe('monitor.contract.test.ts', () => {
  describe('MonitorBase contract compliance', () => {
    let placement: MockPlacement;
    let communication: MockCommunication;
    let placementMap: Map<string, TeamPlacement>;
    let communicationMap: Map<string, TeamCommunication>;
    let monitor: TestMonitor;

    beforeEach(() => {
      placement = new MockPlacement();
      communication = new MockCommunication();
      placementMap = new Map();
      communicationMap = new Map();
      placementMap.set('test-domain', placement);
      communicationMap.set('test-domain', communication);
      monitor = new TestMonitor(placementMap, communicationMap);
    });

    it('should extend MonitorBase', () => {
      expect(monitor).toBeInstanceOf(MonitorBase);
    });

    it('should implement archetypeName getter', () => {
      expect(monitor.archetypeName).toBeDefined();
      expect(typeof monitor.archetypeName).toBe('string');
      expect(monitor.archetypeName).toBe('test-archetype');
    });

    it('should implement collectArchetypeData method', async () => {
      expect(monitor.collectArchetypeData).toBeDefined();
      expect(typeof monitor.collectArchetypeData).toBe('function');

      const status = createTestStatus({ domain: 'test-domain' });
      const result = await monitor.collectArchetypeData(placement, communication, status);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('testData');
    });

    it('should implement formatArchetypeColumns method', () => {
      expect(monitor.formatArchetypeColumns).toBeDefined();
      expect(typeof monitor.formatArchetypeColumns).toBe('function');

      const entry = makeDashboardEntry({ metadata: { testData: 'test-value' } });

      const result = monitor.formatArchetypeColumns(entry);
      expect(typeof result).toBe('string');
      expect(result).toContain('Test:');
    });

    it('should handle placementMap/communicationMap in constructor', () => {
      const newMonitor = new TestMonitor(new Map(), new Map());

      expect(newMonitor).toBeInstanceOf(MonitorBase);
    });
  });

  describe('MonitorBase interface', () => {
    it('should define required abstract methods', () => {
      const monitor = new TestMonitor(new Map(), new Map());
      expect(typeof monitor.archetypeName).toBe('string');
      expect(typeof monitor.collectArchetypeData).toBe('function');
      expect(typeof monitor.formatArchetypeColumns).toBe('function');
    });

    it('should accept generic type parameter', () => {
      type CustomData = { customField: number };
      class CustomMonitor extends MonitorBase<CustomData> {
        get archetypeName() {
          return 'custom';
        }
        async collectArchetypeData() {
          return { customField: 42 };
        }
        formatArchetypeColumns(entry: DashboardEntry) {
          return `Custom: ${(entry.metadata as any)?.customField || 0}`;
        }
      }

      const monitor = new CustomMonitor(new Map(), new Map());
      expect(monitor.archetypeName).toBe('custom');
    });
  });

  describe('collectArchetypeData contract', () => {
    let placement: MockPlacement;
    let communication: MockCommunication;
    let monitor: TestMonitor;

    beforeEach(() => {
      placement = new MockPlacement();
      communication = new MockCommunication();
      const placementMap = new Map<string, TeamPlacement>();
      const communicationMap = new Map<string, TeamCommunication>();
      placementMap.set('test-domain', placement);
      communicationMap.set('test-domain', communication);
      monitor = new TestMonitor(placementMap, communicationMap);
    });

    it('should accept placement, communication and status parameters', async () => {
      const status = createTestStatus({ domain: 'test-domain' });

      await expect(monitor.collectArchetypeData(placement, communication, status)).resolves.toBeDefined();
    });

    it('should return archetype-specific data', async () => {
      const status = createTestStatus({ domain: 'test-domain' });
      const result = await monitor.collectArchetypeData(placement, communication, status);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle different domain contexts', async () => {
      const status1 = createTestStatus({ domain: 'domain-1' });
      const status2 = createTestStatus({ domain: 'domain-2' });

      const result1 = await monitor.collectArchetypeData(placement, communication, status1);
      const result2 = await monitor.collectArchetypeData(placement, communication, status2);

      expect(result1).not.toEqual(result2);
      expect(result1.testData).toContain('domain-1');
      expect(result2.testData).toContain('domain-2');
    });

    it('should use placement to access team workspace', async () => {
      placement.seedTeam('test-domain', {
        'test-file.txt': 'test content',
      });

      const exists = await placement.exists('test-domain', 'test-file.txt');

      expect(exists).toBe(true);
    });
  });

  describe('formatArchetypeColumns contract', () => {
    let monitor: TestMonitor;

    beforeEach(() => {
      monitor = new TestMonitor(new Map(), new Map());
    });

    it('should accept DashboardEntry parameter', () => {
      const entry = makeDashboardEntry({ metadata: { testData: 'test-value' } });

      const result = monitor.formatArchetypeColumns(entry);
      expect(typeof result).toBe('string');
    });

    it('should return formatted string', () => {
      const entry = makeDashboardEntry({ metadata: { testData: 'test-value' } });

      const result = monitor.formatArchetypeColumns(entry);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle entries with metadata', () => {
      const entry = makeDashboardEntry({ metadata: { testData: 'with-metadata' } });

      const result = monitor.formatArchetypeColumns(entry);
      expect(result).toContain('with-metadata');
    });

    it('should handle entries without metadata', () => {
      const entry = makeDashboardEntry();
      delete entry.metadata;

      const result = monitor.formatArchetypeColumns(entry);
      expect(result).toContain('N/A');
    });

    it('should format different metadata values', () => {
      const entry1 = makeDashboardEntry({ metadata: { testData: 'value1' } });
      const entry2 = makeDashboardEntry({ metadata: { testData: 'value2' } });

      const result1 = monitor.formatArchetypeColumns(entry1);
      const result2 = monitor.formatArchetypeColumns(entry2);

      expect(result1).not.toEqual(result2);
      expect(result1).toContain('value1');
      expect(result2).toContain('value2');
    });
  });

  describe('archetype-specific monitor patterns', () => {
    it('should support deliverable-style monitoring', () => {
      type DeliverableData = { fragmentCount: number; totalSize: number };

      class DeliverableMonitor extends MonitorBase<DeliverableData> {
        get archetypeName() {
          return 'deliverable';
        }

        async collectArchetypeData(placement: TeamPlacement, communication: TeamCommunication, status: ScanStatus) {
          const files = await placement.listFiles(status.domain_id, '.squad/deliverable/fragments');
          return {
            fragmentCount: files.length,
            totalSize: files.length * 1024,
          };
        }

        formatArchetypeColumns(entry: DashboardEntry) {
          const count = (entry.metadata as any)?.fragmentCount || 0;
          const size = (entry.metadata as any)?.totalSize || 0;
          return `Fragments: ${count} (${size} bytes)`;
        }
      }

      const monitor = new DeliverableMonitor(new Map(), new Map());
      expect(monitor.archetypeName).toBe('deliverable');
    });

    it('should support coding-style monitoring', () => {
      type CodingData = { linesChanged: number; filesModified: number };

      class CodingMonitor extends MonitorBase<CodingData> {
        get archetypeName() {
          return 'coding';
        }

        async collectArchetypeData(placement: TeamPlacement, communication: TeamCommunication, status: ScanStatus) {
          return {
            linesChanged: 150,
            filesModified: 5,
          };
        }

        formatArchetypeColumns(entry: DashboardEntry) {
          const lines = (entry.metadata as any)?.linesChanged || 0;
          const files = (entry.metadata as any)?.filesModified || 0;
          return `+${lines} lines in ${files} files`;
        }
      }

      const monitor = new CodingMonitor(new Map(), new Map());
      expect(monitor.archetypeName).toBe('coding');
    });
  });

  describe('error handling', () => {
    let placement: MockPlacement;
    let communication: MockCommunication;
    let monitor: TestMonitor;

    beforeEach(() => {
      placement = new MockPlacement();
      communication = new MockCommunication();
      const placementMap = new Map<string, TeamPlacement>();
      const communicationMap = new Map<string, TeamCommunication>();
      placementMap.set('test-domain', placement);
      communicationMap.set('test-domain', communication);
      monitor = new TestMonitor(placementMap, communicationMap);
    });

    it('should handle missing transport gracefully', async () => {
      const emptyMonitor = new TestMonitor(new Map(), new Map());
      const status = createTestStatus({ domain: 'nonexistent-domain' });

      // Should not throw, implementation decides how to handle missing transport
      await expect(emptyMonitor.collectArchetypeData(placement, communication, status)).resolves.toBeDefined();
    });

    it('should handle empty metadata in formatting', () => {
      const entry = makeDashboardEntry();
      delete entry.metadata;

      const result = monitor.formatArchetypeColumns(entry);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
