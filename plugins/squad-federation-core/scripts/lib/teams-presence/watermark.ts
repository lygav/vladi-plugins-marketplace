/**
 * Watermark — Tracks the last-seen Teams message to avoid reprocessing.
 *
 * Persisted to .squad/teams-watermark.json. First run initializes to "now"
 * so historical messages are never replayed.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Watermark {
  lastSeenTimestamp: string;
  lastSeenMessageId: string;
}

export class WatermarkStore {
  private filePath: string;

  constructor(squadDir: string) {
    this.filePath = path.join(squadDir, 'teams-watermark.json');
  }

  load(): Watermark | null {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch { return null; }
  }

  save(watermark: Watermark): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(watermark, null, 2), 'utf-8');
  }

  /** Initialize watermark to "now" if it doesn't exist. Returns true if initialized. */
  initializeIfNeeded(): boolean {
    if (this.load()) return false;
    this.save({ lastSeenTimestamp: new Date().toISOString(), lastSeenMessageId: '' });
    return true;
  }
}
