/**
 * OTelEmitter — Lightweight telemetry emitter for infrastructure code.
 * 
 * Emits OpenTelemetry signals (spans, metrics, events, logs) to an OTLP endpoint.
 * Designed for mechanical instrumentation of transport, registry, and monitor layers.
 * 
 * Key features:
 * - No-op when OTLP endpoint is not configured (zero overhead)
 * - Best-effort export (never crashes caller)
 * - Same OTLP format as mcp-otel-server.ts
 * - Transport-agnostic (HTTP OTLP only)
 * 
 * @module sdk/otel-emitter
 */

import { randomBytes } from 'crypto';

// ==================== Types ====================

interface OtelSpan {
  name: string;
  traceId: string;
  spanId: string;
  startTime: bigint;
  endTime: bigint;
  status: 'ok' | 'error';
  attributes: Record<string, string | number>;
}

interface OtelMetric {
  name: string;
  value: number;
  timestamp: bigint;
  attributes: Record<string, string | number>;
}

interface OtelLog {
  body: string;
  timestamp: bigint;
  severity: { text: string; number: number };
  attributes: Record<string, string | number>;
}

// ==================== Constants ====================

const SEVERITY_MAP: Record<string, { text: string; number: number }> = {
  debug: { text: 'DEBUG', number: 5 },
  info: { text: 'INFO', number: 9 },
  warn: { text: 'WARN', number: 13 },
  error: { text: 'ERROR', number: 17 },
};

// ==================== OTelEmitter ====================

/**
 * OTelEmitter — Lightweight telemetry emitter for infrastructure code.
 * 
 * When no OTLP endpoint is configured, all methods are silent no-ops.
 * 
 * @example
 * ```typescript
 * const emitter = new OTelEmitter(); // reads env vars
 * 
 * // Emit a span (duration measurement)
 * await emitter.span('git.commit', async () => {
 *   await execAsync('git commit -m "..."');
 * }, { 'git.operation': 'commit', 'squad.domain': 'frontend' });
 * 
 * // Emit a metric
 * await emitter.metric('signals.sent', 1, { 'signal.type': 'directive' });
 * 
 * // Emit an event
 * await emitter.event('team.registered', { 'squad.domain': 'backend' });
 * 
 * // Emit a log
 * await emitter.log('info', 'Team onboarded successfully', { 'squad.domain': 'api' });
 * ```
 */
export class OTelEmitter {
  private endpoint: string | null;
  private serviceName: string;

  /**
   * Create a new OTelEmitter.
   * 
   * Reads configuration from environment variables:
   * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint (e.g., http://localhost:4318)
   * - SQUAD_SERVICE_NAME: Service name for telemetry (default: squad-federation-core)
   * 
   * If OTEL_EXPORTER_OTLP_ENDPOINT is not set, emitter is a no-op.
   * 
   * @param endpoint - Optional OTLP endpoint override
   * @param serviceName - Optional service name override
   */
  constructor(endpoint?: string, serviceName?: string) {
    this.endpoint = endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || null;
    this.serviceName = serviceName || process.env.SQUAD_SERVICE_NAME || 'squad-federation-core';
  }

  /**
   * Emit a span (duration measurement).
   * 
   * Wraps an async function and measures its execution time.
   * Automatically captures errors and marks span status accordingly.
   * 
   * @param name - Span name (e.g., 'git.commit', 'monitor.collect')
   * @param fn - Async function to measure
   * @param attributes - Optional key-value attributes
   * @returns The return value of the wrapped function
   * 
   * @example
   * ```typescript
   * await emitter.span('git.push', async () => {
   *   await execAsync('git push origin main');
   * }, { 'git.operation': 'push', 'git.branch': 'main' });
   * 
   * const result = await emitter.span('compute', async () => {
   *   return 42;
   * });
   * ```
   */
  async span<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number>
  ): Promise<T> {
    if (!this.endpoint) {
      // No-op when telemetry is disabled
      return await fn();
    }

    const start = process.hrtime.bigint();
    let status: 'ok' | 'error' = 'ok';
    let errorAttrs: Record<string, string | number> = {};
    let result: T;

    try {
      result = await fn();
    } catch (err) {
      status = 'error';
      errorAttrs = {
        'error.message': err instanceof Error ? err.message : String(err),
        'error.type': err instanceof Error ? err.constructor.name : 'Unknown',
      };
      throw err; // Re-throw to preserve caller's error handling
    } finally {
      const end = process.hrtime.bigint();
      await this.exportSpan({
        name,
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
        startTime: start,
        endTime: end,
        status,
        attributes: { ...attributes, ...errorAttrs },
      });
    }

    return result;
  }

  /**
   * Emit a metric (counter/gauge).
   * 
   * @param name - Metric name (e.g., 'signals.sent', 'teams.registered')
   * @param value - Metric value
   * @param attributes - Optional key-value attributes
   * 
   * @example
   * ```typescript
   * await emitter.metric('signals.read', 3, { 'signal.type': 'directive' });
   * ```
   */
  async metric(
    name: string,
    value: number,
    attributes?: Record<string, string | number>
  ): Promise<void> {
    if (!this.endpoint) return; // No-op

    await this.exportMetric({
      name,
      value,
      timestamp: process.hrtime.bigint(),
      attributes: attributes || {},
    });
  }

  /**
   * Emit an event (discrete milestone).
   * 
   * Events are implemented as log records with no severity.
   * 
   * @param name - Event name (e.g., 'team.bootstrapped', 'pr.created')
   * @param attributes - Optional key-value attributes
   * 
   * @example
   * ```typescript
   * await emitter.event('status.transition', { 'from_state': 'scanning', 'to_state': 'complete' });
   * ```
   */
  async event(
    name: string,
    attributes?: Record<string, string | number>
  ): Promise<void> {
    if (!this.endpoint) return; // No-op

    await this.exportLog({
      body: name,
      timestamp: process.hrtime.bigint(),
      severity: { text: 'INFO', number: 9 }, // Events are INFO-level logs
      attributes: { 'event.name': name, ...attributes },
    });
  }

  /**
   * Emit a log message.
   * 
   * @param level - Log level (info, warn, error, debug)
   * @param message - Log message
   * @param attributes - Optional key-value attributes
   * 
   * @example
   * ```typescript
   * await emitter.log('warn', 'Team has stalled', { 'squad.domain': 'frontend', 'stall_minutes': 15 });
   * ```
   */
  async log(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: string,
    attributes?: Record<string, string | number>
  ): Promise<void> {
    if (!this.endpoint) return; // No-op

    const severity = SEVERITY_MAP[level] || SEVERITY_MAP.info;
    await this.exportLog({
      body: message,
      timestamp: process.hrtime.bigint(),
      severity,
      attributes: attributes || {},
    });
  }

  // ==================== Private: OTLP Export ====================

  /**
   * Export span to OTLP endpoint.
   */
  private async exportSpan(span: OtelSpan): Promise<void> {
    const payload = this.formatOTLPTrace(span);
    await this.export('/v1/traces', payload);
  }

  /**
   * Export metric to OTLP endpoint.
   */
  private async exportMetric(metric: OtelMetric): Promise<void> {
    const payload = this.formatOTLPMetric(metric);
    await this.export('/v1/metrics', payload);
  }

  /**
   * Export log to OTLP endpoint.
   */
  private async exportLog(log: OtelLog): Promise<void> {
    const payload = this.formatOTLPLog(log);
    await this.export('/v1/logs', payload);
  }

  /**
   * Best-effort HTTP export to OTLP endpoint.
   * Never throws — silently fails if collector is unavailable.
   */
  private async export(path: string, data: unknown): Promise<void> {
    if (!this.endpoint) return;

    try {
      await fetch(`${this.endpoint}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (err) {
      // Best-effort — don't fail the caller
      // Silently log to stderr (not stdout which may be piped)
      console.error(
        `[OTel] Export to ${path} failed:`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // ==================== Private: OTLP Formatting ====================

  /**
   * Format span as OTLP trace payload.
   * Same format as mcp-otel-server.ts.
   */
  private formatOTLPTrace(span: OtelSpan): unknown {
    return {
      resourceSpans: [
        {
          resource: { attributes: this.resourceAttributes() },
          scopeSpans: [
            {
              scope: { name: 'squad-federation-core', version: '1.0.0' },
              spans: [
                {
                  traceId: span.traceId,
                  spanId: span.spanId,
                  name: span.name,
                  kind: 1, // SPAN_KIND_INTERNAL
                  startTimeUnixNano: span.startTime.toString(),
                  endTimeUnixNano: span.endTime.toString(),
                  status: { code: span.status === 'ok' ? 1 : 2 },
                  attributes: this.toOtlpAttributes(span.attributes),
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Format metric as OTLP metric payload.
   */
  private formatOTLPMetric(metric: OtelMetric): unknown {
    return {
      resourceMetrics: [
        {
          resource: { attributes: this.resourceAttributes() },
          scopeMetrics: [
            {
              scope: { name: 'squad-federation-core', version: '1.0.0' },
              metrics: [
                {
                  name: metric.name,
                  gauge: {
                    dataPoints: [
                      {
                        timeUnixNano: metric.timestamp.toString(),
                        asInt: Math.floor(metric.value),
                        attributes: this.toOtlpAttributes(metric.attributes),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Format log as OTLP log payload.
   */
  private formatOTLPLog(log: OtelLog): unknown {
    return {
      resourceLogs: [
        {
          resource: { attributes: this.resourceAttributes() },
          scopeLogs: [
            {
              scope: { name: 'squad-federation-core', version: '1.0.0' },
              logRecords: [
                {
                  timeUnixNano: log.timestamp.toString(),
                  severityNumber: log.severity.number,
                  severityText: log.severity.text,
                  body: { stringValue: log.body },
                  attributes: this.toOtlpAttributes(log.attributes),
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Convert attributes object to OTLP attribute format.
   */
  private toOtlpAttributes(obj: Record<string, string | number>): Array<{
    key: string;
    value: { stringValue?: string; intValue?: number };
  }> {
    return Object.entries(obj).map(([key, value]) => ({
      key,
      value: typeof value === 'string'
        ? { stringValue: value }
        : { intValue: Math.floor(value) },
    }));
  }

  /**
   * Resource attributes (service.name, etc.).
   */
  private resourceAttributes(): Array<{
    key: string;
    value: { stringValue: string };
  }> {
    return [
      { key: 'service.name', value: { stringValue: this.serviceName } },
    ];
  }

  /**
   * Generate random trace ID (16 bytes hex).
   */
  private generateTraceId(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Generate random span ID (8 bytes hex).
   */
  private generateSpanId(): string {
    return randomBytes(8).toString('hex');
  }
}
