/**
 * CodingTriage — Script for diagnosing coding team issues.
 * 
 * Extends TriageBase to detect coding-specific problems:
 * - PR stalled in review
 * - CI failures blocking merge
 * - Team ignoring review feedback
 * - No commit activity (team idle)
 * 
 * Hybrid pattern: This script detects patterns → coding-triage skill recommends recovery.
 * 
 * @module meta/scripts/coding-triage
 */

import { TriageBase } from '../../../squad-federation-core/sdk/triage-base.js';
import type {
  TriageResult,
  RecoveryAction
} from '../../../squad-federation-core/sdk/triage-base.js';
import type { DashboardEntry } from '../../../squad-federation-core/sdk/types.js';
import type { CodingMonitorData } from './coding-monitor.js';

/**
 * CodingTriage — Triage script for coding archetype.
 * 
 * Diagnoses issues specific to coding workflows:
 * - Blocked PRs
 * - CI/test failures
 * - Review loops
 * - Team inactivity
 */
export class CodingTriage extends TriageBase {
  /**
   * Diagnose coding team issues.
   * 
   * Detects:
   * - PR has changes_requested but no new commits (ignoring feedback)
   * - CI failing for > 15 minutes (build broken)
   * - PR stuck in review (no reviewer activity)
   * - Team idle (no commits for extended period)
   */
  async diagnose(entries: DashboardEntry[]): Promise<TriageResult[]> {
    const results: TriageResult[] = [];

    for (const entry of entries) {
      const data = entry.metadata as CodingMonitorData;

      // Skip terminal states
      if (entry.state === 'complete' || entry.state === 'failed') {
        continue;
      }

      // Detect PR with changes requested but no new commits
      if (data.reviewDecision === 'changes_requested') {
        const idleMinutes = data.minutesSinceCommit ?? 0;
        if (idleMinutes > 30) {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'warning',
            category: 'review-feedback-ignored',
            issue: 'PR has changes requested but no new commits',
            details: `Review requested changes ${idleMinutes} minutes ago, but team has not addressed feedback. Last commit: ${this.formatTime(data.lastCommitAt)}`,
            suggestedActions: ['address-review-comments', 'check-team-status'],
            metadata: { minutesIdle: idleMinutes, prNumber: data.prNumber }
          });
        }
      }

      // Detect CI failures blocking progress
      if (data.ciStatus === 'failing') {
        const failedMinutes = this.getMinutesSince(entry.lastUpdate);
        if (failedMinutes > 15) {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'critical',
            category: 'ci-failure',
            issue: 'CI pipeline failing for extended period',
            details: `CI has been failing for ${failedMinutes} minutes. This blocks PR merge and deployment. State: ${entry.state}`,
            suggestedActions: ['fix-ci-build', 'check-test-failures', 'review-ci-logs'],
            metadata: { minutesFailing: failedMinutes, prNumber: data.prNumber }
          });
        }
      }

      // Detect PR stuck in review
      if (entry.state === 'pr-review' && data.prStatus === 'open') {
        const reviewMinutes = this.getMinutesSince(entry.lastUpdate);
        if (reviewMinutes > 60) {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'warning',
            category: 'review-stalled',
            issue: 'PR stuck in review state',
            details: `PR #${data.prNumber} has been in review for ${reviewMinutes} minutes with no activity. Review decision: ${data.reviewDecision}`,
            suggestedActions: ['request-re-review', 'ping-reviewers', 'check-pr-status'],
            metadata: { minutesInReview: reviewMinutes, prNumber: data.prNumber }
          });
        }
      }

      // Detect team idle (no commits)
      if (['implementing', 'testing'].includes(entry.state)) {
        const idleMinutes = data.minutesSinceCommit ?? 0;
        if (idleMinutes > 120) {
          results.push({
            teamId: entry.domainId,
            domain: entry.domain,
            severity: 'info',
            category: 'team-idle',
            issue: 'No commit activity for extended period',
            details: `Team in ${entry.state} state but no commits for ${idleMinutes} minutes. Last commit: ${this.formatTime(data.lastCommitAt)}`,
            suggestedActions: ['check-team-logs', 'send-status-request'],
            metadata: { minutesIdle: idleMinutes }
          });
        }
      }

      // Detect test failures
      if (data.testsStatus === 'failing') {
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'warning',
          category: 'test-failure',
          issue: 'Tests failing',
          details: `Test suite is failing in ${entry.state} state. This may block PR approval.`,
          suggestedActions: ['fix-failing-tests', 'review-test-logs'],
          metadata: { prNumber: data.prNumber }
        });
      }

      // Detect PR merge conflicts (if metadata available)
      if (entry.metadata?.hasConflicts) {
        results.push({
          teamId: entry.domainId,
          domain: entry.domain,
          severity: 'warning',
          category: 'merge-conflict',
          issue: 'PR has merge conflicts',
          details: `PR #${data.prNumber} has merge conflicts that must be resolved before merging.`,
          suggestedActions: ['resolve-merge-conflicts', 'rebase-branch'],
          metadata: { prNumber: data.prNumber }
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

    // Build recovery actions based on category
    switch (diagnosis.category) {
      case 'review-feedback-ignored':
        actions.push({
          id: 'address-review-comments',
          name: 'Address review feedback',
          description: 'Review the PR comments and make requested changes',
          automated: false,
          manualSteps: [
            'Read review comments in GitHub PR',
            'Make code changes to address feedback',
            'Commit and push changes',
            'Reply to comments when addressed',
            'Request re-review from reviewers'
          ]
        });
        actions.push({
          id: 'check-team-status',
          name: 'Check team status',
          description: 'Verify team is active and aware of review feedback',
          automated: false,
          manualSteps: [
            'Check team run logs for activity',
            'Review last directive sent to team',
            'Send status request if needed'
          ]
        });
        break;

      case 'ci-failure':
        actions.push({
          id: 'fix-ci-build',
          name: 'Fix CI build',
          description: 'Diagnose and fix CI pipeline failures',
          automated: false,
          manualSteps: [
            'Check CI logs for error details',
            'Identify failing step (build, test, lint)',
            'Fix the underlying issue',
            'Push fix and wait for CI to pass'
          ]
        });
        actions.push({
          id: 'review-ci-logs',
          name: 'Review CI logs',
          description: 'Examine CI output to understand failure',
          automated: false,
          manualSteps: [
            'Open PR in GitHub',
            'Navigate to Checks tab',
            'Review failed job logs',
            'Identify error messages'
          ]
        });
        break;

      case 'review-stalled':
        actions.push({
          id: 'request-re-review',
          name: 'Request re-review',
          description: 'Ping reviewers to re-engage with PR',
          automated: false,
          manualSteps: [
            'Add comment in PR requesting review',
            'Mention specific reviewers if needed',
            'Provide context on recent changes'
          ]
        });
        actions.push({
          id: 'ping-reviewers',
          name: 'Ping reviewers',
          description: 'Notify reviewers via direct message or team channel',
          automated: false,
          manualSteps: [
            'Identify assigned reviewers',
            'Send direct message or team ping',
            'Provide PR link and urgency context'
          ]
        });
        break;

      case 'team-idle':
        actions.push({
          id: 'check-team-logs',
          name: 'Check team logs',
          description: 'Review team activity to understand idle state',
          automated: false,
          manualSteps: [
            'Read team run logs',
            'Check for errors or blockers',
            'Verify team is not waiting for input'
          ]
        });
        actions.push({
          id: 'send-status-request',
          name: 'Request status update',
          description: 'Ask team for progress update',
          automated: false,
          manualSteps: [
            'Send directive requesting status',
            'Ask for blockers or issues',
            'Wait for team response'
          ]
        });
        break;

      case 'test-failure':
        actions.push({
          id: 'fix-failing-tests',
          name: 'Fix failing tests',
          description: 'Debug and fix test failures',
          automated: false,
          manualSteps: [
            'Run tests locally to reproduce',
            'Review test output for errors',
            'Fix code or update tests',
            'Verify tests pass locally before pushing'
          ]
        });
        break;

      case 'merge-conflict':
        actions.push({
          id: 'resolve-merge-conflicts',
          name: 'Resolve merge conflicts',
          description: 'Manually resolve conflicts in conflicted files',
          automated: false,
          manualSteps: [
            'Pull latest changes from base branch',
            'Identify conflicted files',
            'Edit files to resolve conflicts',
            'Stage resolved files',
            'Commit merge resolution'
          ]
        });
        actions.push({
          id: 'rebase-branch',
          name: 'Rebase on base branch',
          description: 'Rebase feature branch on updated base',
          automated: false,
          manualSteps: [
            'git fetch origin',
            'git rebase origin/main',
            'Resolve any conflicts during rebase',
            'git push --force-with-lease'
          ]
        });
        break;
    }

    return actions;
  }

  // ==================== Private Helpers ====================

  /**
   * Calculate minutes since timestamp.
   */
  private getMinutesSince(isoTimestamp: string): number {
    const then = new Date(isoTimestamp);
    const now = new Date();
    return Math.floor((now.getTime() - then.getTime()) / (1000 * 60));
  }

  /**
   * Format timestamp for display.
   */
  private formatTime(timestamp?: string): string {
    if (!timestamp) return 'unknown';
    
    const date = new Date(timestamp);
    return date.toLocaleString();
  }
}
