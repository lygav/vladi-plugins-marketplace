/**
 * E2E Smoke Tests — Verify key modules can be imported and exports exist.
 */

import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const PLUGIN_ROOT = resolve(__dirname, '..', '..', '..');

describe('Script exports', () => {
  it('onboard.ts — file exists', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts', 'onboard.ts'))).toBe(true);
  });

  it('launch.ts — file exists', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts', 'launch.ts'))).toBe(true);
  });

  it('monitor.ts — file exists', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts', 'monitor.ts'))).toBe(true);
  });

  it('meta-relay.ts — file exists', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts', 'meta-relay.ts'))).toBe(true);
  });

  it('meta-heartbeat.ts — file exists', () => {
    expect(existsSync(resolve(PLUGIN_ROOT, 'scripts', 'meta-heartbeat.ts'))).toBe(true);
  });

  it('bootstrap.mjs — file exists and is valid JS', async () => {
    const modulePath = resolve(PLUGIN_ROOT, 'scripts', 'bootstrap.mjs');
    expect(existsSync(modulePath)).toBe(true);
    const mod = await import(modulePath);
    expect(mod).toBeDefined();
  });
});

describe('SDK exports', () => {
  it('sdk/types.ts — module loads', async () => {
    const types = await import(resolve(PLUGIN_ROOT, 'sdk', 'types.ts'));
    expect(types).toBeDefined();
  });

  it('sdk/otel-emitter.ts — OTelEmitter class exists', async () => {
    const mod = await import(resolve(PLUGIN_ROOT, 'sdk', 'otel-emitter.ts'));
    expect(mod.OTelEmitter).toBeDefined();
    expect(typeof mod.OTelEmitter).toBe('function');
    const emitter = new mod.OTelEmitter();
    expect(emitter).toBeInstanceOf(mod.OTelEmitter);
  });

  it('sdk/schemas.ts — schemas are importable and valid', async () => {
    const schemas = await import(resolve(PLUGIN_ROOT, 'sdk', 'schemas.ts'));
    expect(schemas.ScanStatusSchema).toBeDefined();
    expect(schemas.SignalMessageSchema).toBeDefined();
    expect(schemas.LearningEntrySchema).toBeDefined();
    expect(schemas.FederateConfigSchema).toBeDefined();
    expect(schemas.TeamEntrySchema).toBeDefined();
    expect(schemas.ArchetypeManifestSchema).toBeDefined();
    expect(typeof schemas.ScanStatusSchema.parse).toBe('function');
    expect(typeof schemas.FederateConfigSchema.parse).toBe('function');
    expect(typeof schemas.TeamEntrySchema.parse).toBe('function');
  });
});

describe('Config validation', () => {
  it('valid config passes FederateConfigSchema', async () => {
    const { FederateConfigSchema } = await import(resolve(PLUGIN_ROOT, 'sdk', 'schemas.ts'));
    const validConfig = { communicationType: 'file-signal', telemetry: { enabled: false } };
    const result = FederateConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('invalid config fails FederateConfigSchema', async () => {
    const { FederateConfigSchema } = await import(resolve(PLUGIN_ROOT, 'sdk', 'schemas.ts'));
    const invalidConfig = { telemetry: { enabled: 'not-a-boolean' } };
    const result = FederateConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('loadAndValidateConfig returns defaults for missing file', async () => {
    const { loadAndValidateConfig } = await import(
      resolve(PLUGIN_ROOT, 'scripts', 'lib', 'config', 'config.ts')
    );
    const result = loadAndValidateConfig('/nonexistent/path/config.json');
    expect(result).toBeDefined();
    expect(result.communicationType).toBe('file-signal');
  });
});
