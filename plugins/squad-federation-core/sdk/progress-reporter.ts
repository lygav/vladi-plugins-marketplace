import { OTelEmitter } from './otel-emitter.js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface ProgressConfig {
  domain: string;           // Team domain name
  signalDir?: string;       // Path to signals outbox (default: .squad/signals/outbox)
  emitter?: OTelEmitter;    // Optional OTel emitter override
}

export class ProgressReporter {
  private domain: string;
  private signalDir: string;
  private emitter: OTelEmitter;

  constructor(config: ProgressConfig) {
    this.domain = config.domain;
    this.signalDir = config.signalDir || resolve(process.cwd(), '.squad', 'signals', 'outbox');
    this.emitter = config.emitter || new OTelEmitter();
    
    // Ensure outbox exists
    if (!existsSync(this.signalDir)) {
      mkdirSync(this.signalDir, { recursive: true });
    }
  }

  /**
   * Report a milestone (25%, 50%, 75%, etc.)
   */
  async milestone(id: string, percent: number, message: string): Promise<void> {
    // OTel
    await this.emitter.event(`team.progress.${id}`, {
      'team.domain': this.domain,
      'progress.percent': percent,
      'progress.message': message
    });
    await this.emitter.metric(`team.progress`, percent, {
      'team.domain': this.domain
    });
    
    // Signal to meta
    this.writeSignal({
      type: 'progress',
      from: this.domain,
      subject: id,
      body: message,
      metadata: { percent, timestamp: new Date().toISOString() }
    });
  }

  /**
   * Report an alert (error, warning, info)
   */
  async alert(id: string, message: string, severity: 'info' | 'warning' | 'error' = 'warning'): Promise<void> {
    // OTel
    await this.emitter.event(`team.alert.${id}`, {
      'team.domain': this.domain,
      'alert.severity': severity,
      'alert.message': message
    });
    
    // Signal to meta
    this.writeSignal({
      type: 'alert',
      from: this.domain,
      subject: id,
      body: message,
      metadata: { severity, timestamp: new Date().toISOString() }
    });
  }

  /**
   * Report completion
   */
  async complete(summary: string): Promise<void> {
    await this.milestone('complete', 100, summary);
    
    // Also emit a dedicated completion event
    await this.emitter.event('team.complete', {
      'team.domain': this.domain,
      'summary': summary
    });
    
    this.writeSignal({
      type: 'report',
      from: this.domain,
      subject: 'complete',
      body: summary,
      metadata: { percent: 100, timestamp: new Date().toISOString() }
    });
  }

  /**
   * Write a signal file to outbox
   */
  private writeSignal(signal: Record<string, unknown>): void {
    try {
      const filename = `${Date.now()}-${signal.type}-${signal.subject}.json`;
      const filepath = resolve(this.signalDir, filename);
      writeFileSync(filepath, JSON.stringify(signal, null, 2));
    } catch {
      // Best effort — don't crash team if signal write fails
    }
  }
}
