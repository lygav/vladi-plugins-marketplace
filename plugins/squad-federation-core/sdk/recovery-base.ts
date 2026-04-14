/**
 * RecoveryBase — Abstract base class for executing recovery actions.
 * 
 * Handles safe execution of recovery procedures with validation and rollback support.
 * Archetypes extend this to implement archetype-specific recovery logic.
 * 
 * Hybrid pattern: Scripts execute mechanics → Skills guide and validate.
 * 
 * @module sdk/recovery-base
 */

import type { TeamPlacement, TeamCommunication } from './types.js';
import type { RecoveryAction } from './triage-base.js';

/**
 * Recovery result — Outcome of executing a recovery action.
 */
export interface RecoveryResult {
  /** Whether the recovery action succeeded */
  success: boolean;
  /** Human-readable result message */
  message: string;
  /** Whether rollback is available if this fails */
  rollbackAvailable: boolean;
  /** Rollback action to undo this recovery (if available) */
  rollbackAction?: RecoveryAction;
  /** Detailed execution log */
  log?: string[];
}

/**
 * RecoveryContext — Context needed to execute a recovery action.
 */
export interface RecoveryContext {
  /** Team identifier */
  teamId: string;
  /** Team domain name */
  domain: string;
  /** Placement instance for file operations */
  placement: TeamPlacement;
  /** Communication instance for signal operations */
  communication: TeamCommunication;
  /** Recovery action to execute */
  action: RecoveryAction;
  /** Dry-run mode (validate only, don't execute) */
  dryRun?: boolean;
}

/**
 * RecoveryBase — Abstract base class for recovery scripts.
 * 
 * Provides shared utilities for safe recovery execution with validation.
 * Archetypes implement abstract methods to add custom recovery logic.
 * 
 * @example
 * ```typescript
 * class DeliverableRecovery extends RecoveryBase {
 *   async execute(context: RecoveryContext): Promise<RecoveryResult> {
 *     if (context.action.id === 'reset-state') {
 *       const valid = await this.validate(context);
 *       if (!valid) {
 *         return { success: false, message: 'Validation failed', rollbackAvailable: false };
 *       }
 *       
 *       if (context.dryRun) {
 *         return { success: true, message: 'Dry run: would reset state', rollbackAvailable: false };
 *       }
 *       
 *       // Execute recovery
 *       await context.transport.writeFile(context.teamId, '.squad/status.json', '...');
 *       return { success: true, message: 'State reset successfully', rollbackAvailable: false };
 *     }
 *     
 *     throw new Error(`Unknown action: ${context.action.id}`);
 *   }
 *   
 *   async validate(context: RecoveryContext): Promise<boolean> {
 *     const status = await context.transport.readStatus(context.teamId);
 *     return status !== null;
 *   }
 * }
 * ```
 */
export abstract class RecoveryBase {
  /**
   * Execute a recovery action.
   * 
   * Validates the action is safe, executes it, and returns the result.
   * In dry-run mode, validates only without executing.
   * 
   * @param context - Recovery context with team and action details
   * @returns Recovery result with success status and message
   */
  abstract execute(context: RecoveryContext): Promise<RecoveryResult>;

  /**
   * Validate recovery is safe to perform.
   * 
   * Checks preconditions before executing a recovery action.
   * Returns false if the action cannot be safely performed.
   * 
   * @param context - Recovery context to validate
   * @returns True if safe to proceed, false otherwise
   */
  abstract validate(context: RecoveryContext): Promise<boolean>;

  /**
   * Format recovery report for display.
   * 
   * Renders recovery results as a human-readable report with success/failure
   * indicators and rollback information.
   * 
   * @param results - Recovery results to format
   * @returns Formatted report string
   */
  formatReport(results: RecoveryResult[]): string {
    if (results.length === 0) {
      return 'No recovery actions executed.\n';
    }

    const lines: string[] = [];
    lines.push('🔧 RECOVERY REPORT');
    lines.push('━'.repeat(80));
    lines.push('');

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length > 0) {
      lines.push('✅ SUCCESSFUL RECOVERIES');
      lines.push('');
      for (const result of successful) {
        lines.push(...this.formatRecoveryResult(result));
        lines.push('');
      }
    }

    if (failed.length > 0) {
      lines.push('❌ FAILED RECOVERIES');
      lines.push('');
      for (const result of failed) {
        lines.push(...this.formatRecoveryResult(result));
        lines.push('');
      }
    }

    lines.push('━'.repeat(80));
    lines.push(`Total: ${results.length} (Success: ${successful.length}, Failed: ${failed.length})`);
    lines.push('');

    return lines.join('\n');
  }

  // ==================== Protected Helpers ====================

  /**
   * Format a single recovery result.
   * 
   * @param result - Recovery result to format
   * @returns Array of formatted lines
   */
  protected formatRecoveryResult(result: RecoveryResult): string[] {
    const lines: string[] = [];
    
    const icon = result.success ? '✓' : '✗';
    lines.push(`${icon} ${result.message}`);
    
    if (result.log && result.log.length > 0) {
      lines.push('Execution log:');
      for (const logLine of result.log) {
        lines.push(`  ${logLine}`);
      }
    }
    
    if (result.rollbackAvailable) {
      lines.push('⚠️  Rollback available');
      if (result.rollbackAction) {
        lines.push(`   Action: ${result.rollbackAction.name}`);
      }
    }
    
    return lines;
  }

  /**
   * Create a failed recovery result.
   * 
   * Helper for creating consistent failure results.
   * 
   * @param message - Failure message
   * @param log - Optional execution log
   * @returns Failed recovery result
   */
  protected createFailure(message: string, log?: string[]): RecoveryResult {
    return {
      success: false,
      message,
      rollbackAvailable: false,
      log
    };
  }

  /**
   * Create a successful recovery result.
   * 
   * Helper for creating consistent success results.
   * 
   * @param message - Success message
   * @param rollbackAvailable - Whether rollback is available
   * @param rollbackAction - Optional rollback action
   * @param log - Optional execution log
   * @returns Successful recovery result
   */
  protected createSuccess(
    message: string,
    rollbackAvailable: boolean = false,
    rollbackAction?: RecoveryAction,
    log?: string[]
  ): RecoveryResult {
    return {
      success: true,
      message,
      rollbackAvailable,
      rollbackAction,
      log
    };
  }
}
