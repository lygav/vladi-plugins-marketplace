#!/usr/bin/env tsx
/**
 * Consultant Monitor — Collect mechanical monitoring data
 *
 * Extends MonitorBase to add consultant-specific data collection.
 * Outputs JSON consumed by consultant-monitoring skill.
 */

import { MonitorBase } from '@squad/federation-core/sdk';
import type {
  TeamPlacement,
  TeamCommunication,
  ScanStatus,
  DashboardEntry
} from '@squad/federation-core/sdk/types.js';

interface ConsultantData {
  questionsAnswered: number;
  lastQuestionAt?: string;
  domainCoverage?: string;  // "surface" | "moderate" | "deep"
  learningsCount: number;
  idleSinceMinutes?: number;
  currentQuestion?: string;  // what they're researching right now
}

export class ConsultantMonitor extends MonitorBase<ConsultantData> {
  get archetypeName(): string {
    return 'consultant';
  }

  /**
   * Collect archetype-specific monitoring data for a team.
   *
   * @param transport - Transport adapter for team workspace
   * @param status - Team's current status
   * @returns Archetype-specific data to enrich dashboard entry
   */
  async collectArchetypeData(
    placement: TeamPlacement,
    communication: TeamCommunication,
    status: ScanStatus
  ): Promise<ConsultantData> {
    const data: ConsultantData = {
      questionsAnswered: 0,
      learningsCount: 0,
    };

    try {
      // Read archetype config for domain coverage setting
      const configContent = await placement.readFile(status.domain_id, '.squad/archetype-config.json');
      if (configContent) {
        const config = JSON.parse(configContent);
        data.domainCoverage = config.settings?.indexingDepth || 'unknown';
      }
    } catch (e) {
      // Config not found or invalid — skip
    }

    try {
      // Count learnings
      const learningEntries = await communication.readLearningLog(status.domain_id);
      data.learningsCount = learningEntries.length;
    } catch (e) {
      // Learning log not found — team may not have started indexing
    }

    try {
      // Count Q&A from outbox signals (type="report" from consultant)
      const reports = await communication.listSignals(status.domain_id, 'outbox', { type: 'report' });
      data.questionsAnswered = reports.length;

      // Find most recent question timestamp
      if (reports.length > 0) {
        const timestamps = reports
          .map(report => new Date(report.timestamp).getTime())
          .filter(ts => !Number.isNaN(ts));
        
        if (timestamps.length > 0) {
          const lastMs = Math.max(...timestamps);
          data.lastQuestionAt = new Date(lastMs).toISOString();
          
          // Calculate idle time
          const nowMs = Date.now();
          data.idleSinceMinutes = Math.floor((nowMs - lastMs) / (1000 * 60));
        }
      }
    } catch (e) {
      // Outbox not found — team may not have answered questions yet
    }

    // If in researching state, extract current question from status
    if (status.state === 'researching' && status.step) {
      data.currentQuestion = status.step.replace(/^researching:\s*/i, '');
    }

    return data;
  }

  /**
   * Format archetype-specific dashboard columns.
   *
   * @param entry - Dashboard entry with metadata
   * @returns Formatted string for display
   */
  formatArchetypeColumns(entry: DashboardEntry): string {
    const data = entry.metadata as ConsultantData;
    const parts: string[] = [];

    // Q&A count
    parts.push(`${data.questionsAnswered} Q&A`);

    // Domain coverage
    if (data.domainCoverage) {
      parts.push(`${data.domainCoverage} coverage`);
    }

    // Idle time
    if (data.idleSinceMinutes !== undefined) {
      if (data.idleSinceMinutes < 60) {
        parts.push(`idle ${data.idleSinceMinutes}min`);
      } else if (data.idleSinceMinutes < 1440) {
        parts.push(`idle ${Math.floor(data.idleSinceMinutes / 60)}h`);
      } else {
        parts.push(`idle ${Math.floor(data.idleSinceMinutes / 1440)}d`);
      }
    }

    return parts.join(' | ');
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  // TODO: Initialize transport map and run monitor
  // See deliverable-monitor.ts for reference implementation
  console.log('Consultant monitor CLI not yet implemented');
}
