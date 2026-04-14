#!/usr/bin/env tsx
/**
 * Consultant Triage — Detect and diagnose team problems
 *
 * Extends TriageBase to add consultant-specific problem detection.
 * Outputs JSON consumed by consultant-triage skill.
 */

import { TriageBase } from '@squad/federation-core/sdk';
import type { TeamTransport, ScanStatus, TriageResult } from '@squad/federation-core/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

export class ConsultantTriage extends TriageBase {
  get archetypeName(): string {
    return 'consultant';
  }

  /**
   * Detect archetype-specific problems for a team.
   *
   * @param transport - Transport adapter for team workspace
   * @param status - Team's current status
   * @returns Detected problems (empty array if none)
   */
  async detectArchetypeProblems(
    transport: TeamTransport,
    status: ScanStatus
  ): Promise<Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    diagnosticId?: string;
    suggestedRecovery?: string[];
  }>> {
    const problems = [];

    // Problem 1: Stuck in indexing (> 20 minutes with no progress)
    if (status.state === 'indexing') {
      const updatedAt = new Date(status.updated_at).getTime();
      const nowMs = Date.now();
      const minutesSinceUpdate = (nowMs - updatedAt) / (1000 * 60);

      if (minutesSinceUpdate > 20) {
        problems.push({
          severity: 'high',
          category: 'stalled-indexing',
          description: `Stuck in indexing for ${Math.floor(minutesSinceUpdate)} minutes with no progress`,
          diagnosticId: 'stuck-indexing',
          suggestedRecovery: ['check-codebase-access', 'reset-state', 're-launch'],
        });
      }
    }

    // Problem 2: Stale consultant (no questions answered in 7+ days)
    try {
      const outboxPath = path.join(transport.rootPath, '.squad/signals/outbox');
      const files = await fs.readdir(outboxPath);
      const reports = files.filter(f => f.includes('-report-'));

      if (reports.length > 0) {
        const timestamps = reports
          .map(f => {
            const match = f.match(/^(\d+)-/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(t => t > 0);

        if (timestamps.length > 0) {
          const lastTs = Math.max(...timestamps);
          const daysSinceQuestion = (Date.now() - lastTs * 1000) / (1000 * 60 * 60 * 24);

          if (daysSinceQuestion > 7 && status.state === 'ready') {
            problems.push({
              severity: 'medium',
              category: 'stale-consultant',
              description: `No questions answered in ${Math.floor(daysSinceQuestion)} days — consultant may be unused`,
              diagnosticId: 'stale-consultant',
              suggestedRecovery: ['retire', 'refresh-knowledge', 'archive'],
            });
          }
        }
      }
    } catch (e) {
      // Outbox not accessible — skip this check
    }

    // Problem 3: Knowledge gaps (repeated "I don't know" responses)
    try {
      const outboxPath = path.join(transport.rootPath, '.squad/signals/outbox');
      const files = await fs.readdir(outboxPath);
      const reports = files.filter(f => f.includes('-report-'));

      let unknownCount = 0;
      for (const reportFile of reports.slice(-10)) {  // Check last 10 reports
        try {
          const content = await fs.readFile(path.join(outboxPath, reportFile), 'utf-8');
          const signal = JSON.parse(content);
          if (
            signal.body?.toLowerCase().includes("i don't know") ||
            signal.body?.toLowerCase().includes("insufficient")
          ) {
            unknownCount++;
          }
        } catch (e) {
          // Skip malformed signal
        }
      }

      if (unknownCount >= 3) {
        problems.push({
          severity: 'medium',
          category: 'knowledge-gaps',
          description: `${unknownCount} "I don't know" responses in last 10 answers — knowledge gaps detected`,
          diagnosticId: 'knowledge-gaps',
          suggestedRecovery: ['expand-indexing-scope', 'increase-depth', 're-index-focused'],
        });
      }
    } catch (e) {
      // Outbox not accessible — skip
    }

    return problems;
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  // TODO: Initialize transport map and run triage
  // See deliverable-triage.ts for reference implementation
  console.log('Consultant triage CLI not yet implemented');
}
