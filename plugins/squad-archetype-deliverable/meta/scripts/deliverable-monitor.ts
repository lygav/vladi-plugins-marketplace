/**
 * DeliverableMonitor — Monitoring script for deliverable archetype.
 * 
 * Extends MonitorBase to collect deliverable-specific data:
 * - Fragment count and completeness
 * - Schema version and validation status
 * - Deliverable size metrics
 * - Aggregation progress
 * 
 * Hybrid pattern: This script collects raw data → skill interprets it.
 * 
 * @module meta/scripts/deliverable-monitor
 */

import { MonitorBase } from '../../../squad-federation-core/sdk/monitor-base.js';
import type {
  TeamPlacement,
  TeamCommunication,
  ScanStatus,
  DashboardEntry
} from '../../../squad-federation-core/sdk/types.js';

/**
 * Deliverable-specific monitoring data.
 */
export interface DeliverableMonitorData {
  /** Number of fragments collected */
  fragmentCount: number;
  
  /** Expected total fragments (if known) */
  totalFragments?: number;
  
  /** Schema version being used */
  schemaVersion?: string;
  
  /** Total size of deliverable fragments in bytes */
  deliverableSize?: number;
  
  /** Validation status */
  validationStatus?: 'pending' | 'valid' | 'invalid';
  
  /** Timestamp of last fragment */
  lastFragmentAt?: string;
  
  /** Aggregation progress (if in aggregating state) */
  aggregationProgress?: number;
  
  /** Merged deliverable status */
  mergedStatus?: 'not_started' | 'in_progress' | 'complete' | 'failed';
}

/**
 * DeliverableMonitor — Collect deliverable-specific monitoring data.
 * 
 * Reads fragments from team workspace and reports:
 * - How many fragments have been collected
 * - Schema validation status
 * - Deliverable size and completeness
 * - Progress indicators for each state
 */
export class DeliverableMonitor extends MonitorBase<DeliverableMonitorData> {
  get archetypeName(): string {
    return 'deliverable';
  }

  /**
   * Collect deliverable-specific data from team workspace.
   * 
   * Reads:
   * - .squad/deliverable/fragments/*.json — fragment files
   * - .squad/deliverable/schema.json — schema metadata
   * - .squad/deliverable/merged.json — merged deliverable
   * - .squad/deliverable/validation.json — validation results
   */
  async collectArchetypeData(
    placement: TeamPlacement,
    _communication: TeamCommunication,
    status: ScanStatus
  ): Promise<DeliverableMonitorData> {
    const data: DeliverableMonitorData = {
      fragmentCount: 0
    };

    try {
      // Count fragments
      const fragmentFiles = await placement.listFiles(
        status.domain_id,
        '.squad/deliverable/fragments'
      );
      const fragmentJsonFiles = fragmentFiles.filter(f => f.endsWith('.json'));
      data.fragmentCount = fragmentJsonFiles.length;

      // Get total expected fragments from scan metadata if available
      const scanMetaPath = '.squad/deliverable/scan-metadata.json';
      if (await placement.exists(status.domain_id, scanMetaPath)) {
        const scanMetaRaw = await placement.readFile(status.domain_id, scanMetaPath);
        if (scanMetaRaw) {
          const scanMeta = JSON.parse(scanMetaRaw);
          data.totalFragments = scanMeta.expectedFragments;
        }
      }

      // Read schema version
      const schemaPath = '.squad/deliverable/schema.json';
      if (await placement.exists(status.domain_id, schemaPath)) {
        const schemaRaw = await placement.readFile(status.domain_id, schemaPath);
        if (schemaRaw) {
          const schema = JSON.parse(schemaRaw);
          data.schemaVersion = schema.version || 'unknown';
        }
      }

      // Calculate deliverable size
      let totalSize = 0;
      for (const fragmentFile of fragmentJsonFiles) {
        const stats = placement.stat 
          ? await placement.stat(status.domain_id, fragmentFile)
          : null;
        if (stats) {
          totalSize += stats.size;
        }
      }
      data.deliverableSize = totalSize;

      // Check validation status
      const validationPath = '.squad/deliverable/validation.json';
      if (await placement.exists(status.domain_id, validationPath)) {
        const validationRaw = await placement.readFile(status.domain_id, validationPath);
        if (validationRaw) {
          const validation = JSON.parse(validationRaw);
          data.validationStatus = validation.status || 'pending';
        }
      } else {
        data.validationStatus = 'pending';
      }

      // Get last fragment timestamp
      if (fragmentJsonFiles.length > 0) {
        // Sort by filename (assumes timestamp-based naming)
        const sortedFragments = fragmentJsonFiles.sort();
        const lastFragmentPath = sortedFragments[sortedFragments.length - 1];
        const lastFragmentRaw = await placement.readFile(status.domain_id, lastFragmentPath);
        if (lastFragmentRaw) {
          const lastFragment = JSON.parse(lastFragmentRaw);
          data.lastFragmentAt = lastFragment.timestamp || lastFragment.created_at;
        }
      }

      // Check merged deliverable status
      const mergedPath = '.squad/deliverable/merged.json';
      if (await placement.exists(status.domain_id, mergedPath)) {
        const mergedRaw = await placement.readFile(status.domain_id, mergedPath);
        if (mergedRaw) {
          const merged = JSON.parse(mergedRaw);
          data.mergedStatus = merged.status || 'complete';
          data.aggregationProgress = merged.progress || 100;
        } else {
          data.mergedStatus = 'complete';
        }
      } else if (status.state === 'aggregating') {
        data.mergedStatus = 'in_progress';
        data.aggregationProgress = status.progress_pct || 0;
      } else {
        data.mergedStatus = 'not_started';
      }
    } catch (error) {
      console.error(`Error collecting deliverable data for ${status.domain}:`, error);
      // Return partial data rather than failing completely
    }

    return data;
  }

  /**
   * Format deliverable-specific columns for dashboard.
   * 
   * Shows:
   * - Fragment count (with total if known)
   * - Schema version
   * - Deliverable size
   * - Validation status
   * - Aggregation progress
   */
  formatArchetypeColumns(entry: DashboardEntry): string {
    const data = entry.metadata as DeliverableMonitorData;
    if (!data) return '';

    const lines: string[] = [];

    // Fragment status
    const fragmentDisplay = data.totalFragments
      ? `${data.fragmentCount}/${data.totalFragments} fragments`
      : `${data.fragmentCount} fragments`;
    
    const sizeDisplay = data.deliverableSize
      ? this.formatBytes(data.deliverableSize)
      : 'unknown size';

    lines.push(`📦 ${fragmentDisplay} | ${sizeDisplay}`);

    // Schema and validation
    if (data.schemaVersion || data.validationStatus) {
      const schemaDisplay = data.schemaVersion || 'unknown';
      const validationEmoji = data.validationStatus === 'valid' ? '✅'
        : data.validationStatus === 'invalid' ? '❌'
        : '⏳';
      lines.push(`   Schema: v${schemaDisplay} | ${validationEmoji} ${data.validationStatus || 'pending'}`);
    }

    // Aggregation progress
    if (data.mergedStatus && data.mergedStatus !== 'not_started') {
      const mergedEmoji = data.mergedStatus === 'complete' ? '✅'
        : data.mergedStatus === 'failed' ? '❌'
        : '🔄';
      const progressDisplay = data.aggregationProgress !== undefined
        ? ` (${data.aggregationProgress}%)`
        : '';
      lines.push(`   Merged: ${mergedEmoji} ${data.mergedStatus}${progressDisplay}`);
    }

    // Last activity
    if (data.lastFragmentAt) {
      const minutesAgo = this.getMinutesSince(data.lastFragmentAt);
      const timeDisplay = minutesAgo === 0 ? 'just now'
        : minutesAgo < 60 ? `${minutesAgo}m ago`
        : `${Math.floor(minutesAgo / 60)}h ago`;
      lines.push(`   Last fragment: ${timeDisplay}`);
    }

    return lines.join('\n');
  }

  /**
   * Format bytes into human-readable size.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
  }
}
