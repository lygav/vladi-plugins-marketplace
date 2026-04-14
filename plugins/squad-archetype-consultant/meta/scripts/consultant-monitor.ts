#!/usr/bin/env tsx
/**
 * Consultant Monitor — Collect mechanical monitoring data
 *
 * Extends MonitorBase to add consultant-specific data collection.
 * Outputs JSON consumed by consultant-monitoring skill.
 */

import { MonitorBase } from '@squad/federation-core/sdk';
import type { TeamTransport, ScanStatus, DashboardEntry } from '@squad/federation-core/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

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
    transport: TeamTransport,
    status: ScanStatus
  ): Promise<ConsultantData> {
    const data: ConsultantData = {
      questionsAnswered: 0,
      learningsCount: 0,
    };

    try {
      // Read archetype config for domain coverage setting
      const configPath = path.join(transport.rootPath, '.squad/archetype-config.json');
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      data.domainCoverage = config.settings?.indexingDepth || 'unknown';
    } catch (e) {
      // Config not found or invalid — skip
    }

    try {
      // Count learnings
      const logPath = path.join(transport.rootPath, '.squad/learnings/log.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n').filter(l => l.trim());
      data.learningsCount = lines.length;
    } catch (e) {
      // Learning log not found — team may not have started indexing
    }

    try {
      // Count Q&A from outbox signals (type="report" from consultant)
      const outboxPath = path.join(transport.rootPath, '.squad/signals/outbox');
      const files = await fs.readdir(outboxPath);
      const reports = files.filter(f => f.includes('-report-'));
      data.questionsAnswered = reports.length;

      // Find most recent question timestamp
      if (reports.length > 0) {
        const timestamps = reports
          .map(f => {
            const match = f.match(/^(\d+)-/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(t => t > 0);
        
        if (timestamps.length > 0) {
          const lastTs = Math.max(...timestamps);
          data.lastQuestionAt = new Date(lastTs * 1000).toISOString();
          
          // Calculate idle time
          const nowMs = Date.now();
          const lastMs = lastTs * 1000;
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
