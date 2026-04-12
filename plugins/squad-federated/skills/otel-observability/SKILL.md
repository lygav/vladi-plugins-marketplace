---
name: "otel-observability"
description: "The user wants to instrument agents with OpenTelemetry, view traces or metrics, set up the observability dashboard, or understand telemetry best practices for federated squads. Triggers on: observability, telemetry, otel, traces, metrics, spans, aspire dashboard, otel_span, otel_metric, otel_event, otel_log, tracing."
version: "0.1.0"
---

## Purpose

Provide instrumentation guidance for federated squad agents using OpenTelemetry (OTel). The federation exposes four OTel tools via an MCP server. Each Copilot session gets its own MCP server instance that emits OTLP data to a shared collector. This creates unified observability across all parallel domain squads.

## Architecture

```
Domain Squad Session (payments)  ──→  OTel MCP Server ──→  OTLP Collector ──→  Dashboard
Domain Squad Session (auth)      ──→  OTel MCP Server ──→       ↑
Domain Squad Session (data)      ──→  OTel MCP Server ──→       ↑
Meta-Squad Session               ──→  OTel MCP Server ──→       ↑
```

Each OTel MCP server runs as a child process of its Copilot session (stdin/stdout JSON-RPC). Multiple parallel sessions emit to the same collector endpoint — this is safe because each span/metric includes identifying attributes (`squad.domain`, `squad.agent`).

The MCP server lives at `${CLAUDE_PLUGIN_ROOT}/scripts/mcp-otel-server.ts`. It is configured as an MCP server in the federation's `.mcp.json` and is automatically started when a Copilot session launches with the federation MCP stack.

## The Four OTel Tools

### otel_span — Duration Tracking

Use spans to measure how long operations take. Spans have a start and end, and can carry attributes and status.

**When to use:** Wrap every playbook step, every script invocation, every significant I/O operation. Spans are the primary observability signal.

```
otel_span start name="playbook.discovery" attributes={"squad.domain": "payments", "squad.step": "discovery"}
// ... do discovery work ...
otel_span end name="playbook.discovery" status="ok"
```

**Parameters:**
- `action`: `"start"` or `"end"`
- `name`: Descriptive span name. Use dot-separated hierarchy: `playbook.{step}`, `signal.{operation}`, `knowledge.{action}`.
- `status`: `"ok"` or `"error"` (end action only)
- `attributes`: Key-value pairs for context. Always include `squad.domain` and `squad.agent`.

**Best practices:**
- Start a span before beginning work, end it when work completes or fails.
- Nest spans for sub-operations: `playbook.analysis` contains `analysis.query_resources`, `analysis.check_configs`, etc.
- Set `status: "error"` when the operation fails. Add an `error.message` attribute with details.
- Keep span names stable across runs. Do not include variable data (timestamps, IDs) in span names — use attributes instead.

### otel_metric — Counters and Gauges

Use metrics to track counts, quantities, and measurements. Metrics are point-in-time values.

**When to use:** At completion of countable operations — files processed, resources analyzed, learnings recorded, errors encountered.

```
otel_metric name="resources.analyzed" value=47 attributes={"squad.domain": "payments", "resource.type": "api-endpoint"}
otel_metric name="learnings.recorded" value=3 attributes={"squad.domain": "payments", "learning.type": "pattern"}
otel_metric name="deliverable.size_bytes" value=15234 attributes={"squad.domain": "payments"}
```

**Parameters:**
- `name`: Metric name. Use dot-separated hierarchy: `resources.{type}`, `learnings.{action}`, `deliverable.{aspect}`.
- `value`: Numeric value (integer).
- `attributes`: Key-value pairs. Include `squad.domain`.

**Best practices:**
- Emit metrics at natural completion points, not in tight loops.
- Use consistent names across all domains so metrics are comparable.
- Metric names describe what is measured, not the domain. `resources.analyzed` is correct. `payments.resources` is wrong.
- Emit a metric at scan completion summarizing the run: resources analyzed, findings count, duration.

### otel_event — Milestone Markers

Use events to mark significant points in time. Events are like log entries but structured and correlated with the trace.

**When to use:** At milestone transitions — step changes, state transitions, important decisions, external interactions.

```
otel_event name="step.transition" attributes={"squad.domain": "payments", "from_step": "discovery", "to_step": "analysis"}
otel_event name="directive.received" attributes={"squad.domain": "payments", "directive.subject": "Skip legacy-utils"}
otel_event name="deliverable.written" attributes={"squad.domain": "payments", "deliverable.path": "deliverable.json"}
```

**Parameters:**
- `name`: Event name. Use dot-separated hierarchy.
- `attributes`: Key-value pairs with context.

**Best practices:**
- Emit events at every playbook step transition.
- Emit an event when processing a directive from the meta-squad.
- Emit an event when the deliverable is written.
- Emit an event when recording a learning.
- Do not use events for routine progress — use spans for that. Events mark discrete moments.

### otel_log — Decision and Debug Records

Use logs for human-readable records of agent decisions, reasoning, and debug information.

**When to use:** When making a significant decision, when encountering unexpected conditions, when debugging issues.

```
otel_log level="info" message="Skipping repo legacy-utils per directive" attributes={"squad.domain": "payments", "directive.id": "abc-123"}
otel_log level="warn" message="Resource quota approaching limit: 87% used" attributes={"squad.domain": "payments", "quota.pct": 87}
otel_log level="error" message="Failed to parse configuration file" attributes={"squad.domain": "payments", "file": "config.yaml", "error": "Invalid YAML at line 42"}
```

**Parameters:**
- `level`: `"info"`, `"warn"`, `"error"`, or `"debug"`
- `message`: Human-readable message.
- `attributes`: Key-value pairs.

**Best practices:**
- `info`: decisions, skip reasons, mode selections
- `warn`: degraded conditions, approaching limits, fallback paths taken
- `error`: failures, crashes, data corruption
- `debug`: verbose diagnostic info (disable in production via log level config)
- Always include `squad.domain` in attributes.

## Attribute Naming Convention

All OTel signals should use consistent attribute names:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `squad.domain` | Domain name | `"payments"` |
| `squad.agent` | Agent name | `"Agent Beta"` |
| `squad.step` | Current playbook step | `"analysis"` |
| `squad.role` | Agent's role | `"data-engineer"` |
| `signal.type` | Signal message type | `"directive"` |
| `signal.direction` | Inbound or outbound | `"inbound"` |
| `error.message` | Error description | `"Connection refused"` |
| `resource.type` | Type of resource being analyzed | `"api-endpoint"` |

Attributes use `dot.notation` for namespacing. Do not use underscores in attribute namespace prefixes.

## Aspire Dashboard Setup

The observability dashboard runs as a Docker container. It provides a web UI for viewing traces, metrics, and logs.

### Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| **18888** | HTTP | Dashboard web UI — open in browser |
| **4317 → 18889** | gRPC | OTLP gRPC receiver (mapped to container port 18889) |
| **4318 → 18890** | HTTP | OTLP HTTP receiver (mapped to container port 18890) |

The MCP OTel server sends data to `http://localhost:4318` (OTLP HTTP). This maps to port 18890 inside the container.

### Starting the Dashboard

```bash
npx tsx ${CLAUDE_PLUGIN_ROOT}/scripts/dashboard.ts
```

Or manually with Docker:

```bash
docker run --rm -d \
  --name aspire-dashboard \
  -p 18888:18888 \
  -p 4317:18889 \
  -p 4318:18890 \
  -e DASHBOARD__OTLP__PRIMARYAPIKEY="" \
  ghcr.io/dotnet/aspire-dashboard:latest
```

Open `http://localhost:18888` in a browser to view the dashboard.

### Verifying the Connection

After starting the dashboard and a domain session:

1. Open `http://localhost:18888`
2. Navigate to the Traces tab
3. Look for spans with service name `squad-federated`
4. Filter by `squad.domain` attribute to view a specific domain

If no data appears:
- Verify the dashboard container is running: `docker ps | grep aspire`
- Verify the OTel MCP server is configured in `.mcp.json`
- Check that `telemetry.enabled` is `true` in `federate.config.json`
- Test the endpoint: `curl -v http://localhost:4318/v1/traces`

### Environment Variables

The MCP OTel server respects these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector endpoint |
| `OTEL_SERVICE_NAME` | `squad-federated` | Service name in traces |
| `SQUAD_DOMAIN` | `unknown` | Domain name for resource attributes |

These are set automatically by `launch.ts` when starting domain sessions.

## Instrumentation Playbook

Follow this pattern when instrumenting a domain squad agent's work:

### At Scan Start
```
otel_span start name="scan.full" attributes={"squad.domain": "...", "squad.agent": "..."}
otel_event name="scan.started" attributes={"squad.domain": "..."}
```

### At Each Step
```
otel_span start name="playbook.{step}" attributes={"squad.domain": "...", "squad.step": "..."}
otel_event name="step.transition" attributes={"from_step": "...", "to_step": "..."}
// ... do work ...
otel_metric name="resources.analyzed" value=N attributes={"squad.domain": "..."}
otel_span end name="playbook.{step}" status="ok"
```

### At Signal Operations
```
otel_span start name="signal.check_inbox"
// ... process directives ...
otel_event name="directive.received" attributes={"directive.subject": "..."}
otel_span end name="signal.check_inbox" status="ok"
```

### At Learning Recording
```
otel_event name="learning.recorded" attributes={"learning.type": "pattern", "learning.title": "..."}
otel_metric name="learnings.recorded" value=1 attributes={"learning.type": "pattern"}
```

### At Scan Completion
```
otel_metric name="scan.duration_seconds" value=N
otel_metric name="scan.findings_count" value=N
otel_event name="scan.completed" attributes={"squad.domain": "...", "scan.state": "complete"}
otel_span end name="scan.full" status="ok"
```

### On Error
```
otel_log level="error" message="Scan failed: {reason}" attributes={"error.message": "..."}
otel_span end name="playbook.{step}" status="error"
otel_event name="scan.failed" attributes={"squad.domain": "...", "error.message": "..."}
```

## Anti-Patterns

- Do not create a span and immediately end it. Spans measure duration — if there is no work between start and end, use an event instead.
- Do not put variable data in span or metric names. Use `resources.analyzed` with a `resource.type` attribute, not `api-endpoints.analyzed`.
- Do not emit metrics in loops. Aggregate first, then emit once.
- Do not skip `squad.domain` on any signal. It is required for cross-domain filtering.
- Do not hardcode the collector endpoint. Use the `OTEL_EXPORTER_OTLP_ENDPOINT` environment variable.
- Do not use `otel_log` as a replacement for the learning log. Logs are ephemeral telemetry; learnings are persistent knowledge. Use the learning log (see `knowledge-lifecycle` skill) for durable knowledge capture.

## Debugging Telemetry Issues

**No data in dashboard**: check the OTel MCP server is listed in `.mcp.json` and the Copilot session loaded it. Look for MCP initialization messages in the session output.

**Spans appear but metrics do not**: metrics use a separate OTLP endpoint path (`/v1/metrics`). Verify the collector accepts metrics on the same port.

**Duplicate spans**: each `otel_span start` must be paired with exactly one `otel_span end` using the same `name`. Missing ends cause orphaned spans. Duplicate ends are ignored.

**High cardinality warning**: if you see this in the dashboard, check for variable data leaking into span names or metric names. Move variable data to attributes.
