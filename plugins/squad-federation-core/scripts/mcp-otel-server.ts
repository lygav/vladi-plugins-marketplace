#!/usr/bin/env node
/**
 * OTel MCP Server — OpenTelemetry tools for headless Copilot sessions
 *
 * Exposes otel_span, otel_metric, otel_event, otel_log tools to agents via MCP protocol.
 * Sends OTLP data to a collector (Aspire dashboard, Jaeger, etc.) at localhost:4318.
 *
 * Each Copilot session spawns its own instance (stdin/stdout JSON-RPC protocol).
 * Multiple parallel sessions emit to the same collector (parallel safe).
 */

import { randomBytes } from 'crypto';

// ==================== Configuration ====================

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'squad-federation-core';
const DOMAIN = process.env.SQUAD_DOMAIN || 'unknown';

const activeSpans = new Map<string, { startTime: bigint; attributes: Record<string, any> }>();

// ==================== Types ====================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: { code: number; message: string };
}

interface OtelSpanParams {
  action: 'start' | 'end';
  name: string;
  status?: 'ok' | 'error';
  attributes?: Record<string, any>;
}

interface OtelMetricParams {
  name: string;
  value: number;
  attributes?: Record<string, any>;
}

interface OtelEventParams {
  name: string;
  attributes?: Record<string, any>;
}

interface OtelLogParams {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  attributes?: Record<string, any>;
}

// ==================== OTLP Formatting ====================

function generateTraceId(): string { return randomBytes(16).toString('hex'); }
function generateSpanId(): string { return randomBytes(8).toString('hex'); }
function nanoTime(): bigint { return process.hrtime.bigint(); }

function toOtlpValue(value: unknown): any {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return { intValue: Math.floor(value) };
  return { stringValue: String(value) };
}

function toOtlpAttributes(obj: Record<string, any>): any[] {
  return Object.entries(obj).map(([key, value]) => ({ key, value: toOtlpValue(value) }));
}

function resourceAttributes(): any[] {
  return [
    { key: 'service.name', value: { stringValue: SERVICE_NAME } },
    { key: 'squad.domain', value: { stringValue: DOMAIN } },
  ];
}

function formatOTLPTrace(span: {
  name: string; traceId: string; spanId: string;
  startTime: bigint; endTime: bigint;
  status: 'ok' | 'error'; attributes: Record<string, any>;
}): any {
  return {
    resourceSpans: [{
      resource: { attributes: resourceAttributes() },
      scopeSpans: [{
        scope: { name: 'squad-federation-core-otel', version: '1.0.0' },
        spans: [{
          traceId: span.traceId, spanId: span.spanId, name: span.name,
          kind: 1,
          startTimeUnixNano: span.startTime.toString(),
          endTimeUnixNano: span.endTime.toString(),
          status: { code: span.status === 'ok' ? 1 : 2 },
          attributes: toOtlpAttributes(span.attributes || {}),
        }],
      }],
    }],
  };
}

function formatOTLPMetric(metric: {
  name: string; value: number; timestamp: bigint; attributes: Record<string, any>;
}): any {
  return {
    resourceMetrics: [{
      resource: { attributes: resourceAttributes() },
      scopeMetrics: [{
        scope: { name: 'squad-federation-core-otel', version: '1.0.0' },
        metrics: [{
          name: metric.name,
          gauge: {
            dataPoints: [{
              timeUnixNano: metric.timestamp.toString(),
              asInt: Math.floor(metric.value),
              attributes: toOtlpAttributes(metric.attributes || {}),
            }],
          },
        }],
      }],
    }],
  };
}

function formatOTLPLog(body: string, timestamp: bigint, attributes: Record<string, any>, severity?: { text: string; number: number }): any {
  return {
    resourceLogs: [{
      resource: { attributes: resourceAttributes() },
      scopeLogs: [{
        scope: { name: 'squad-federation-core-otel', version: '1.0.0' },
        logRecords: [{
          timeUnixNano: timestamp.toString(),
          ...(severity ? { severityNumber: severity.number, severityText: severity.text } : {}),
          body: { stringValue: body },
          attributes: toOtlpAttributes(attributes),
        }],
      }],
    }],
  };
}

// ==================== OTLP Export ====================

async function exportOtlp(path: string, data: any): Promise<void> {
  try {
    await fetch(`${OTEL_ENDPOINT}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    // Best-effort — don't fail if collector is down
    console.error(`[OTel] Export to ${path} failed:`, err instanceof Error ? err.message : String(err));
  }
}

// ==================== Graceful Shutdown ====================

let isShuttingDown = false;

async function flushAllActiveSpans(): Promise<void> {
  if (activeSpans.size === 0) return;

  console.error(`[OTel MCP] Flushing ${activeSpans.size} active span(s)...`);
  const flushPromises: Promise<void>[] = [];

  for (const [name, spanData] of activeSpans.entries()) {
    const promise = exportOtlp('/v1/traces', formatOTLPTrace({
      name, traceId: generateTraceId(), spanId: generateSpanId(),
      startTime: spanData.startTime, endTime: nanoTime(),
      status: 'ok', attributes: spanData.attributes,
    }));
    flushPromises.push(promise);
  }

  await Promise.all(flushPromises);
  activeSpans.clear();
}

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.error(`[OTel MCP] Received ${signal}, shutting down gracefully...`);

  // Stop accepting new requests
  process.stdin.pause();

  // Flush pending spans with timeout
  const FLUSH_TIMEOUT_MS = 2000;
  try {
    await Promise.race([
      flushAllActiveSpans(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Flush timeout')), FLUSH_TIMEOUT_MS)
      ),
    ]);
    console.error('[OTel MCP] All spans flushed successfully');
  } catch (err) {
    console.error('[OTel MCP] Flush failed or timed out:', err instanceof Error ? err.message : String(err));
  }

  console.error('[OTel MCP] Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => { gracefulShutdown('SIGTERM'); });
process.on('SIGINT', () => { gracefulShutdown('SIGINT'); });

// ==================== MCP Tool Handlers ====================

const SEVERITY_MAP: Record<string, { text: string; number: number }> = {
  debug: { text: 'DEBUG', number: 5 },
  info: { text: 'INFO', number: 9 },
  warn: { text: 'WARN', number: 13 },
  error: { text: 'ERROR', number: 17 },
};

async function handleOtelSpan(params: OtelSpanParams): Promise<string> {
  const { action, name, status = 'ok', attributes = {} } = params;

  if (action === 'start') {
    activeSpans.set(name, { startTime: nanoTime(), attributes });
    return `Span started: ${name}`;
  }

  if (action === 'end') {
    const span = activeSpans.get(name);
    if (!span) return `No active span found: ${name}`;

    await exportOtlp('/v1/traces', formatOTLPTrace({
      name, traceId: generateTraceId(), spanId: generateSpanId(),
      startTime: span.startTime, endTime: nanoTime(),
      status, attributes: { ...span.attributes, ...attributes },
    }));
    activeSpans.delete(name);
    return `Span completed: ${name}`;
  }

  return `Invalid action: ${action}`;
}

async function handleOtelMetric(params: OtelMetricParams): Promise<string> {
  await exportOtlp('/v1/metrics', formatOTLPMetric({
    name: params.name, value: params.value,
    timestamp: nanoTime(), attributes: params.attributes || {},
  }));
  return `Metric recorded: ${params.name} = ${params.value}`;
}

async function handleOtelEvent(params: OtelEventParams): Promise<string> {
  await exportOtlp('/v1/logs', formatOTLPLog(
    params.name, nanoTime(), params.attributes || {},
  ));
  return `Event recorded: ${params.name}`;
}

async function handleOtelLog(params: OtelLogParams): Promise<string> {
  const severity = SEVERITY_MAP[params.level] || SEVERITY_MAP.info;
  await exportOtlp('/v1/logs', formatOTLPLog(
    params.message, nanoTime(),
    { ...params.attributes || {}, 'squad.domain': DOMAIN },
    severity,
  ));
  return `Log [${severity.text}]: ${params.message}`;
}

// ==================== MCP Protocol ====================

const MCP_TOOLS = [
  {
    name: 'otel_span',
    description: 'Record an OpenTelemetry span for observability. Call with action="start" to begin, action="end" to complete.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'end'], description: 'Start or end the span' },
        name: { type: 'string', description: 'Span name (e.g., "step-2-classification", "agent:DataEngineer")' },
        status: { type: 'string', enum: ['ok', 'error'], description: 'Status (only for action=end)' },
        attributes: { type: 'object', description: 'Key-value metadata (e.g., squad.domain, squad.agent, squad.step)' },
      },
      required: ['action', 'name'],
    },
  },
  {
    name: 'otel_metric',
    description: 'Record an OpenTelemetry metric for dashboards.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Metric name (e.g., "squad.items.discovered", "squad.repos.analyzed")' },
        value: { type: 'number', description: 'Metric value' },
        attributes: { type: 'object', description: 'Optional labels' },
      },
      required: ['name', 'value'],
    },
  },
  {
    name: 'otel_event',
    description: 'Record a notable event for the observability timeline.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Event name (e.g., "scan-started", "directive-received", "learning-logged")' },
        attributes: { type: 'object', description: 'Optional metadata' },
      },
      required: ['name'],
    },
  },
  {
    name: 'otel_log',
    description: 'Send a structured log message to the observability dashboard.',
    inputSchema: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['info', 'warn', 'error', 'debug'], description: 'Log severity level' },
        message: { type: 'string', description: 'The log message' },
        attributes: { type: 'object', description: 'Optional structured data (agent name, step, domain, etc.)' },
      },
      required: ['level', 'message'],
    },
  },
];

function respond(id: string | number | undefined, result?: any, error?: { code: number; message: string }): void {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0', id: id ?? 0,
    ...(error ? { error } : { result }),
  };
  process.stdout.write(JSON.stringify(response) + '\n');
}

async function handleRequest(msg: JsonRpcRequest): Promise<void> {
  const { method, params, id } = msg;

  // Reject new requests during shutdown
  if (isShuttingDown) {
    respond(id, undefined, { code: -32000, message: 'Server is shutting down' });
    return;
  }

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'squad-federation-core-otel', version: '1.0.0' },
    });
    return;
  }

  if (method === 'tools/list') {
    respond(id, { tools: MCP_TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const { name: toolName, arguments: toolArgs } = params;
    try {
      const handlers: Record<string, (p: any) => Promise<string>> = {
        otel_span: handleOtelSpan, otel_metric: handleOtelMetric,
        otel_event: handleOtelEvent, otel_log: handleOtelLog,
      };
      const handler = handlers[toolName];
      if (!handler) { respond(id, undefined, { code: -32601, message: `Unknown tool: ${toolName}` }); return; }
      const message = await handler(toolArgs);
      respond(id, { content: [{ type: 'text', text: message }] });
    } catch (err) {
      respond(id, undefined, { code: -32603, message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }

  respond(id, undefined, { code: -32601, message: `Unknown method: ${method}` });
}

// ==================== Stdin/Stdout Protocol ====================

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk: string) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (line.trim()) {
      try { handleRequest(JSON.parse(line) as JsonRpcRequest); }
      catch (err) { console.error('[OTel MCP] Parse error:', err instanceof Error ? err.message : String(err)); }
    }
  }
});
process.stdin.on('end', () => { console.error('[OTel MCP] Stdin closed'); process.exit(0); });

console.error('[OTel MCP] Server started');
console.error(`[OTel MCP] Service: ${SERVICE_NAME}, Domain: ${DOMAIN}`);
console.error(`[OTel MCP] Endpoint: ${OTEL_ENDPOINT}`);
