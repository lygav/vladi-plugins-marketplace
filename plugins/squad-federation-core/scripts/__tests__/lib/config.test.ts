/**
 * Unit tests for config.ts — federate.config.json validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FederateConfig } from '../../lib/config/config.js';

// Mock fs
const mockReadFileSync = vi.fn();
vi.mock('fs', () => ({
  default: {
    readFileSync: (...args: any[]) => mockReadFileSync(...args),
    existsSync: vi.fn(() => true),
  },
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
  existsSync: vi.fn(() => true),
}));

const { validateConfig, loadAndValidateConfig, ConfigValidationError } = await import('../../lib/config/config.js');

describe('config.ts', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset();
  });

  describe('validateConfig', () => {
    it('should accept valid minimal config', () => {
      const config = {
        telemetry: { enabled: true },
      };

      const result = validateConfig(config);

      expect(result).toEqual({
        ...config,
        communicationType: 'file-signal', // default value
        playbookSkill: 'domain-playbook', // default value
      });
    });

    it('should accept config with all optional fields', () => {
      const config = {
        description: 'Test federation',
        communicationType: 'file-signal',
        telemetry: { enabled: true, aspire: true },
        playbookSkill: 'custom-playbook',
        deliverable: 'DELIVERABLE.md',
        deliverableSchema: 'deliverable.schema.json',
        importHook: 'hooks/import.ts',
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it('should use defaults for empty config', () => {
      const invalidConfig = {};

      const result = validateConfig(invalidConfig);
      expect(result.telemetry).toEqual({ enabled: true });
      expect(result.playbookSkill).toBe('domain-playbook');
    });

    it('should reject config with invalid telemetry object', () => {
      const invalidConfig = {
        telemetry: 'invalid',
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
      expect(() => validateConfig(invalidConfig)).toThrow(/telemetry must be an object/);
    });

    it('should reject config with invalid telemetry.enabled type', () => {
      const invalidConfig = {
        telemetry: { enabled: 'yes' },
      };

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
      expect(() => validateConfig(invalidConfig)).toThrow(/telemetry.enabled must be a boolean/);
    });

    it('should handle unknown fields gracefully', () => {
      const configWithUnknown = {
        telemetry: { enabled: true },
        unknownField: 'should-be-ignored',
        anotherUnknown: 123,
      };

      // Should not throw, but unknown fields should not be in result
      const result = validateConfig(configWithUnknown);
      expect(result).not.toHaveProperty('unknownField');
      expect(result).not.toHaveProperty('anotherUnknown');
    });
  });

  describe('loadAndValidateConfig', () => {
    it('should load and validate config from file', () => {
      const mockConfig = {
        telemetry: { enabled: true },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(mockConfig));

      const result = loadAndValidateConfig('/path/to/federate.config.json');

      expect(result).toMatchObject(mockConfig);
      expect(mockReadFileSync).toHaveBeenCalledWith('/path/to/federate.config.json', 'utf-8');
    });

    it('should throw on invalid JSON', () => {
      mockReadFileSync.mockReturnValue('{ invalid json }');

      expect(() => loadAndValidateConfig('/path/to/config.json')).toThrow();
    });

    it('should handle config with only unknown fields', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: 'config' }));

      // Unknown fields are warned but not rejected; defaults are applied
      const result = loadAndValidateConfig('/path/to/config.json');
      expect(result.telemetry).toEqual({ enabled: true });
    });

    it('should apply default values for optional fields', () => {
      const minimalConfig = {
        telemetry: { enabled: false },
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(minimalConfig));

      const result = loadAndValidateConfig('/path/to/config.json');

      expect(result.playbookSkill).toBe('domain-playbook');
    });

    it('should preserve user-specified optional values', () => {
      const configWithOptionals = {
        telemetry: { enabled: true, aspire: true },
        playbookSkill: 'custom-skill',
        deliverable: 'OUTPUT.md',
      };
      mockReadFileSync.mockReturnValue(JSON.stringify(configWithOptionals));

      const result = loadAndValidateConfig('/path/to/config.json');

      expect(result.playbookSkill).toBe('custom-skill');
      expect(result.deliverable).toBe('OUTPUT.md');
      expect(result.telemetry.aspire).toBe(true);
    });
  });

  describe('ConfigValidationError', () => {
    it('should be instance of Error', () => {
      const error = new ConfigValidationError('test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('ConfigValidationError');
      expect(error.message).toBe('test error');
    });
  });

  describe('heartbeat config', () => {
    it('should accept valid heartbeat config', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { enabled: true },
      };

      const result = validateConfig(config);
      expect(result.heartbeat).toEqual({ enabled: true });
    });

    it('should accept heartbeat with custom interval', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { enabled: true, intervalSeconds: 60 },
      };

      const result = validateConfig(config);
      expect(result.heartbeat).toEqual({ enabled: true, intervalSeconds: 60 });
    });

    it('should reject heartbeat without enabled field', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { intervalSeconds: 60 },
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
      expect(() => validateConfig(config)).toThrow(/heartbeat.enabled is required/);
    });

    it('should reject heartbeat with non-boolean enabled', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { enabled: 'yes' },
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
      expect(() => validateConfig(config)).toThrow(/heartbeat.enabled must be a boolean/);
    });

    it('should reject heartbeat with interval < 10', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { enabled: true, intervalSeconds: 5 },
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
      expect(() => validateConfig(config)).toThrow(/heartbeat.intervalSeconds must be an integer >= 10/);
    });

    it('should reject heartbeat with non-integer interval', () => {
      const config = {
        telemetry: { enabled: true },
        heartbeat: { enabled: true, intervalSeconds: 30.5 },
      };

      expect(() => validateConfig(config)).toThrow(ConfigValidationError);
      expect(() => validateConfig(config)).toThrow(/heartbeat.intervalSeconds must be an integer >= 10/);
    });

    it('should omit heartbeat when not specified', () => {
      const config = {
        telemetry: { enabled: true },
      };

      const result = validateConfig(config);
      expect(result.heartbeat).toBeUndefined();
    });
  });
});
