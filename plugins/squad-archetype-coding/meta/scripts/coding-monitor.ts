/**
 * CodingMonitor — Script for collecting coding team status.
 * 
 * Extends MonitorBase to collect coding-specific metrics:
 * - PR status (draft, open, approved, merged)
 * - CI/test status
 * - Review state
 * - Branch and commit activity
 * 
 * Hybrid pattern: This script collects data → coding-monitoring skill interprets it.
 * 
 * @module meta/scripts/coding-monitor
 */

import { MonitorBase } from '../../../squad-federation-core/sdk/monitor-base.js';
import type {
  TeamTransport,
  ScanStatus,
  DashboardEntry
} from '../../../squad-federation-core/sdk/types.js';

/**
 * Coding-specific monitoring data.
 */
export interface CodingMonitorData {
  /** Current git branch name */
  currentBranch?: string;
  /** Pull request number if one exists */
  prNumber?: number;
  /** PR status */
  prStatus?: 'draft' | 'open' | 'approved' | 'merged' | 'closed' | 'none';
  /** Review decision from GitHub */
  reviewDecision?: 'approved' | 'changes_requested' | 'review_required' | 'none';
  /** CI/CD pipeline status */
  ciStatus?: 'passing' | 'failing' | 'pending' | 'none';
  /** Number of files changed in current work */
  filesChanged?: number;
  /** Test execution status */
  testsStatus?: 'passing' | 'failing' | 'none';
  /** Last commit timestamp */
  lastCommitAt?: string;
  /** Minutes since last commit */
  minutesSinceCommit?: number;
}

/**
 * CodingMonitor — Monitoring script for coding archetype.
 * 
 * Collects PR status, CI results, and commit activity to provide
 * visibility into coding team progress.
 */
export class CodingMonitor extends MonitorBase<CodingMonitorData> {
  get archetypeName(): string {
    return 'coding';
  }

  /**
   * Collect coding-specific data from team workspace.
   * 
   * Reads:
   * - .squad/pr-status.json (if exists) for PR metadata
   * - Git log for commit activity
   * - Status.json for current state
   */
  async collectArchetypeData(
    transport: TeamTransport,
    status: ScanStatus
  ): Promise<CodingMonitorData> {
    const data: CodingMonitorData = {
      prStatus: 'none',
      reviewDecision: 'none',
      ciStatus: 'none',
      testsStatus: 'none'
    };

    try {
      // Try to read PR status file
      const prStatusContent = await transport.readFile(status.domain_id, '.squad/pr-status.json');
      if (prStatusContent) {
        const prData = JSON.parse(prStatusContent);
        data.prNumber = prData.number;
        data.prStatus = this.normalizePrStatus(prData.state, prData.draft);
        data.reviewDecision = this.normalizeReviewDecision(prData.reviewDecision);
        data.ciStatus = this.normalizeCiStatus(prData.ciStatus);
      }
    } catch (error) {
      // PR status file doesn't exist or is invalid — team may not have opened PR yet
    }

    // Get current branch from status or git
    data.currentBranch = status.metadata?.currentBranch as string | undefined;

    // Get commit activity
    try {
      const lastCommit = await this.getLastCommitTime(transport, status.domain_id);
      if (lastCommit) {
        data.lastCommitAt = lastCommit;
        data.minutesSinceCommit = this.getMinutesSince(lastCommit);
      }
    } catch (error) {
      // No commits yet or git error
    }

    // Get files changed count from status metadata
    data.filesChanged = status.metadata?.filesChanged as number | undefined;

    // Get test status from status metadata if available
    const testStatus = status.metadata?.testsStatus as string | undefined;
    if (testStatus) {
      data.testsStatus = testStatus as 'passing' | 'failing' | 'none';
    }

    return data;
  }

  /**
   * Format coding-specific columns for dashboard.
   * 
   * Shows: PR status | CI status | Review state | Files changed
   */
  formatArchetypeColumns(entry: DashboardEntry): string {
    const data = entry.metadata as CodingMonitorData;
    const parts: string[] = [];

    // PR info
    if (data.prStatus && data.prStatus !== 'none') {
      const prIcon = this.getPrIcon(data.prStatus);
      const prText = data.prNumber ? `PR #${data.prNumber}` : 'PR';
      parts.push(`${prIcon} ${prText} (${data.prStatus})`);
    } else if (data.currentBranch) {
      parts.push(`🌿 ${data.currentBranch}`);
    }

    // CI status
    if (data.ciStatus && data.ciStatus !== 'none') {
      const ciIcon = this.getCiIcon(data.ciStatus);
      parts.push(`${ciIcon} CI ${data.ciStatus}`);
    }

    // Review status
    if (data.reviewDecision && data.reviewDecision !== 'none') {
      const reviewIcon = this.getReviewIcon(data.reviewDecision);
      parts.push(`${reviewIcon} ${data.reviewDecision.replace('_', ' ')}`);
    }

    // Files changed
    if (data.filesChanged !== undefined && data.filesChanged > 0) {
      parts.push(`📝 ${data.filesChanged} files`);
    }

    // Commit activity
    if (data.minutesSinceCommit !== undefined) {
      const timeStr = this.formatTimeSince(data.minutesSinceCommit);
      parts.push(`⏱️  last commit ${timeStr}`);
    }

    return parts.join(' | ');
  }

  // ==================== Private Helpers ====================

  /**
   * Get last commit timestamp from git log.
   */
  private async getLastCommitTime(transport: TeamTransport, domainId: string): Promise<string | null> {
    try {
      // Read git log if team transport supports it
      // For now, return null — teams will need to update this in status.json
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Normalize PR status to standard enum.
   */
  private normalizePrStatus(state?: string, draft?: boolean): 'draft' | 'open' | 'approved' | 'merged' | 'closed' | 'none' {
    if (!state) return 'none';
    if (draft) return 'draft';
    
    switch (state.toLowerCase()) {
      case 'open': return 'open';
      case 'closed': return 'closed';
      case 'merged': return 'merged';
      default: return 'none';
    }
  }

  /**
   * Normalize review decision to standard enum.
   */
  private normalizeReviewDecision(decision?: string): 'approved' | 'changes_requested' | 'review_required' | 'none' {
    if (!decision) return 'none';
    
    switch (decision.toLowerCase()) {
      case 'approved':
      case 'approve':
        return 'approved';
      case 'changes_requested':
      case 'request_changes':
        return 'changes_requested';
      case 'review_required':
      case 'pending':
        return 'review_required';
      default:
        return 'none';
    }
  }

  /**
   * Normalize CI status to standard enum.
   */
  private normalizeCiStatus(status?: string): 'passing' | 'failing' | 'pending' | 'none' {
    if (!status) return 'none';
    
    switch (status.toLowerCase()) {
      case 'success':
      case 'passing':
      case 'pass':
        return 'passing';
      case 'failure':
      case 'failing':
      case 'failed':
        return 'failing';
      case 'pending':
      case 'running':
      case 'in_progress':
        return 'pending';
      default:
        return 'none';
    }
  }

  /**
   * Get emoji for PR status.
   */
  private getPrIcon(status: string): string {
    switch (status) {
      case 'draft': return '📝';
      case 'open': return '🔓';
      case 'approved': return '✅';
      case 'merged': return '🎉';
      case 'closed': return '🔒';
      default: return '📋';
    }
  }

  /**
   * Get emoji for CI status.
   */
  private getCiIcon(status: string): string {
    switch (status) {
      case 'passing': return '✅';
      case 'failing': return '❌';
      case 'pending': return '⏳';
      default: return '⚪';
    }
  }

  /**
   * Get emoji for review decision.
   */
  private getReviewIcon(decision: string): string {
    switch (decision) {
      case 'approved': return '✅';
      case 'changes_requested': return '🔍';
      case 'review_required': return '👀';
      default: return '⚪';
    }
  }

  /**
   * Format minutes into human-readable time.
   */
  private formatTimeSince(minutes: number): string {
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}
