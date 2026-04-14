/**
 * Unit tests for config.ts — federate.config.json validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FederateConfig } from '../../lib/config.js';

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

const { validateConfig, loadAndValidateConfig, ConfigValidationError } = await import('../../lib/config.js');

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
        playbookSkill: 'domain-playbook', // default value
      });
    });

    it('should accept config with all optional fields', () => {
      const config = {
        description: 'Test federation',
        telemetry: { enabled: true, aspire: true },
        playbookSkill: 'custom-playbook',
        deliverable: 'DELIVERABLE.md',
        deliverableSchema: 'deliverable.schema.json',
        importHook: 'hooks/import.ts',
      };

      const result = validateConfig(config);
      expect(result).toEqual(config);
    });

    it('should reject config with missing required fields', () => {
      const invalidConfig = {};

      expect(() => validateConfig(invalidConfig)).toThrow(ConfigValidationError);
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

    it('should throw on invalid config structure', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ invalid: 'config' }));

      expect(() => loadAndValidateConfig('/path/to/config.json')).toThrow(ConfigValidationError);
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
});
