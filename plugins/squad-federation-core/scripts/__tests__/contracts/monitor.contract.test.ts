/**
 * Contract tests for MonitorBase implementations
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockPlacement, MockCommunication } from '../helpers/mock-transport.js';
import { createTestStatus, createTestTeamEntry } from '../helpers/test-fixtures.js';
import { MonitorBase } from '../../../sdk/monitor-base.js';
import type { ScanStatus, DashboardEntry, TeamPlacement, TeamCommunication } from '../../../sdk/types.js';

class TestMonitor extends MonitorBase<{ testData: string }> {
  get archetypeName(): string {
    return 'test-archetype';
  }

  async collectArchetypeData(
    _placement: TeamPlacement,
    _communication: TeamCommunication,
    status: ScanStatus
  ) {
    return { testData: `data-for-${status.domain}` };
  }

  formatArchetypeColumns(entry: DashboardEntry<{ testData: string }>): string {
    return `Test: ${entry.metadata?.testData || 'N/A'}`;
  }
}

describe('monitor.contract.test.ts', () => {
  let placement: MockPlacement;
  let communication: MockCommunication;
  let monitor: TestMonitor;

  beforeEach(() => {
    placement = new MockPlacement();
    communication = new MockCommunication(placement);

    const placementMap = new Map<string, TeamPlacement>([['test-domain', placement]]);
    const communicationMap = new Map<string, TeamCommunication>([['test-domain', communication]]);
    monitor = new TestMonitor(placementMap, communicationMap);
  });

  it('should extend MonitorBase', () => {
    expect(monitor).toBeInstanceOf(MonitorBase);
  });

  it('should implement archetypeName getter', () => {
    expect(monitor.archetypeName).toBe('test-archetype');
  });

  it('should implement collectArchetypeData method', async () => {
    const status = createTestStatus({ domain: 'test-domain' });
    const result = await monitor.collectArchetypeData(placement, communication, status);
    expect(result).toHaveProperty('testData');
  });

  it('should collect dashboard entries from teams', async () => {
    const status = createTestStatus({ domain: 'test-domain' });
    await placement.writeFile('test-domain', '.squad/status.json', JSON.stringify(status));

    const entries = await monitor.collectAll([createTestTeamEntry({ domain: 'test-domain', domainId: 'test-domain' })]);
    expect(entries).toHaveLength(1);
    expect(entries[0].domain).toBe('test-domain');
  });

  it('should format archetype columns', () => {
    const entry: DashboardEntry<{ testData: string }> = {
      domain: 'test-domain',
      domainId: 'test-domain',
      archetypeId: 'deliverable',
      state: 'scanning',
      health: 'healthy',
      progress: 50,
      lastUpdate: new Date().toISOString(),
      metadata: { testData: 'test-value' },
    };

    const result = monitor.formatArchetypeColumns(entry);
    expect(result).toContain('Test:');
  });
});
