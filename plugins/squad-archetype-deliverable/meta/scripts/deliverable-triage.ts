/**
 * DeliverableTriage — Diagnostic script for deliverable archetype.
 * 
 * Extends TriageBase to detect deliverable-specific problems:
 * - Stalled scanning (no new fragments)
 * - Schema validation failures
 * - Incomplete fragment sets
 * - Aggregation failures
 * 
 * Hybrid pattern: This script detects patterns → skill interprets and recommends.
 * 
 * @module meta/scripts/deliverable-triage
 */

import { TriageBase } from '../../../squad-federation-core/sdk/triage-base.js';
import type {
  DashboardEntry,
  TriageResult,
  RecoveryAction
} from '../../../squad-federation-core/sdk/types.js';

/**
 * DeliverableTriage — Detect problems in deliverable teams.
 * 
 * Analyzes dashboard entries to identify:
 * - Teams stuck without progress
 * - Schema validation issues
 * - Fragment collection problems
 * - Aggregation failures
 */
export class DeliverableTriage extends TriageBase {
  /**
   * Diagnose deliverable-specific issues.
   */
  async diagnose(entries: DashboardEntry[]): Promise<TriageResult[]> {
    const results: TriageResult[] = [];

    for (const entry of entries) {
      // Skip completed and failed teams
      if (entry.state === 'complete' || entry.state === 'failed') {
        continue;
      }

      const metadata = entry.metadata as any;

      // Detect: Stalled scanning (no fragments collected in 10+ minutes)
      if (entry.state === 'scanning' && entry.health === 'stalled') {
        if (metadata?.fragmentCount === 0) {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'warning',
            category: 'scanning-stalled-no-fragments',
            issue: 'Team stuck in scanning state with no fragments collected',
            details: `Team has been scanning for ${this.getMinutesSince(entry.lastUpdate)}m but has not produced any fragments. This may indicate a scan configuration issue or code analysis failure.`,
            suggestedActions: ['check-scan-logs', 'verify-scan-config', 'restart-scan']
          });
        } else if (metadata?.lastFragmentAt) {
          const minutesSinceFragment = this.getMinutesSince(metadata.lastFragmentAt);
          if (minutesSinceFragment > 10) {
            results.push({
              teamId: entry.domainId,
              domain: entry.domain,
              severity: 'warning',
              category: 'scanning-stalled-fragments-stopped',
              issue: 'Fragment collection has stopped',
              details: `Last fragment was collected ${minutesSinceFragment}m ago. Team has ${metadata.fragmentCount} fragments but appears stuck.`,
              suggestedActions: ['check-scan-progress', 'review-scan-logs', 'send-status-query']
            });
          }
        }
      }

      // Detect: Schema validation failures
      if (metadata?.validationStatus === 'invalid') {
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'critical',
          category: 'schema-validation-failed',
          issue: 'Schema validation failed',
          details: `Deliverable fragments do not conform to schema version ${metadata.schemaVersion || 'unknown'}. This will prevent successful aggregation.`,
          suggestedActions: ['review-schema-errors', 'fix-fragment-format', 'update-schema-version']
        });
      }

      // Detect: Incomplete fragment sets
      if (metadata?.totalFragments && metadata?.fragmentCount < metadata.totalFragments) {
        const completionPct = Math.round((metadata.fragmentCount / metadata.totalFragments) * 100);
        if (entry.state === 'distilling' || entry.state === 'aggregating') {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'info',
            category: 'fragments-incomplete',
            issue: 'Fragment set incomplete',
            details: `Team is in ${entry.state} state with only ${completionPct}% of expected fragments (${metadata.fragmentCount}/${metadata.totalFragments}). This may indicate missed scan areas.`,
            suggestedActions: ['verify-scan-coverage', 'check-for-errors', 'review-fragment-list']
          });
        }
      }

      // Detect: Aggregation failures
      if (entry.state === 'aggregating' && metadata?.mergedStatus === 'failed') {
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'critical',
          category: 'aggregation-failed',
          issue: 'Deliverable aggregation failed',
          details: 'Failed to merge fragments into final deliverable. Check aggregation logs for details.',
          suggestedActions: ['review-merge-errors', 'check-fragment-conflicts', 'retry-aggregation']
        });
      }

      // Detect: Stalled aggregation
      if (entry.state === 'aggregating' && entry.health === 'stalled') {
        const progress = metadata?.aggregationProgress || 0;
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'warning',
          category: 'aggregation-stalled',
          issue: 'Aggregation progress stalled',
          details: `Aggregation stuck at ${progress}% for ${this.getMinutesSince(entry.lastUpdate)}m. May indicate a merge conflict or processing issue.`,
          suggestedActions: ['check-aggregation-logs', 'review-merge-conflicts', 'restart-aggregation']
        });
      }

      // Detect: Large deliverable size warning
      if (metadata?.deliverableSize && metadata.deliverableSize > 10 * 1024 * 1024) {
        const sizeMB = (metadata.deliverableSize / (1024 * 1024)).toFixed(1);
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'info',
          category: 'large-deliverable',
          issue: 'Large deliverable size',
          details: `Deliverable is ${sizeMB}MB. Consider reviewing for unnecessary verbosity or splitting into multiple deliverables.`,
          suggestedActions: ['review-fragment-size', 'optimize-content', 'split-deliverable']
        });
      }
    }

    return results;
  }

  /**
   * Suggest recovery actions for diagnosed issues.
   */
  async suggestRecovery(diagnosis: TriageResult): Promise<RecoveryAction[]> {
    const actions: RecoveryAction[] = [];

    switch (diagnosis.category) {
      case 'scanning-stalled-no-fragments':
        actions.push({
          id: 'check-scan-logs',
          name: 'Check scan logs',
          description: 'Review agent run logs to identify why scanning is not producing fragments',
          automated: false,
          manualSteps: [
            'Navigate to team workspace',
            'Check .squad/run.log for errors',
            'Look for scan configuration issues',
            'Verify code analysis tools are working'
          ]
        });
        actions.push({
          id: 'verify-scan-config',
          name: 'Verify scan configuration',
          description: 'Check that scan parameters are correct',
          automated: false,
          manualSteps: [
            'Review .squad/config.json',
            'Verify scan targets are accessible',
            'Check file pattern filters',
            'Ensure required tools are available'
          ]
        });
        actions.push({
          id: 'restart-scan',
          name: 'Restart scan from checkpoint',
          description: 'Send directive to restart scanning from last checkpoint',
          automated: true,
          scriptPath: 'meta/scripts/send-directive.ts'
        });
        break;

      case 'schema-validation-failed':
        actions.push({
          id: 'review-schema-errors',
          name: 'Review schema validation errors',
          description: 'Examine validation.json for specific errors',
          automated: false,
          manualSteps: [
            'Read .squad/deliverable/validation.json',
            'Identify which fragments are invalid',
            'Review schema requirements',
            'Check for format mismatches'
          ]
        });
        actions.push({
          id: 'fix-fragment-format',
          name: 'Fix fragment format',
          description: 'Update fragments to match schema',
          automated: false,
          manualSteps: [
            'Identify invalid fragments',
            'Correct format issues',
            'Re-run validation',
            'Update scan template if needed'
          ]
        });
        break;

      case 'aggregation-failed':
        actions.push({
          id: 'review-merge-errors',
          name: 'Review merge error logs',
          description: 'Check aggregation logs for failure details',
          automated: false,
          manualSteps: [
            'Review .squad/deliverable/aggregation.log',
            'Identify conflicting fragments',
            'Check for schema inconsistencies',
            'Look for missing dependencies'
          ]
        });
        actions.push({
          id: 'retry-aggregation',
          name: 'Retry aggregation',
          description: 'Send directive to retry merge process',
          automated: true,
          scriptPath: 'meta/scripts/send-directive.ts'
        });
        break;

      case 'aggregation-stalled':
        actions.push({
          id: 'check-aggregation-logs',
          name: 'Check aggregation progress',
          description: 'Review logs to see where merge is stuck',
          automated: false,
          manualSteps: [
            'Check .squad/deliverable/aggregation.log',
            'Look for long-running operations',
            'Identify stuck fragments',
            'Check for resource issues'
          ]
        });
        actions.push({
          id: 'restart-aggregation',
          name: 'Restart aggregation',
          description: 'Reset and restart merge process',
          automated: true,
          scriptPath: 'meta/scripts/send-directive.ts'
        });
        break;

      default:
        // Generic recovery actions
        actions.push({
          id: 'send-status-query',
          name: 'Query team status',
          description: 'Send signal to ask team for detailed status',
          automated: true,
          scriptPath: 'meta/scripts/send-directive.ts'
        });
        break;
    }

    return actions;
  }

  /**
   * Helper: Get minutes since timestamp.
   */
  private getMinutesSince(timestamp: string): number {
    const then = new Date(timestamp);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60));
  }
}
