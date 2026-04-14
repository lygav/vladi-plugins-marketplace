/**
 * Config Validation — Federate Configuration Schema
 *
 * Validates federate.config.json with helpful error messages and warnings.
 * Used by all federation scripts to ensure config health.
 */

import * as fs from 'fs';

export interface FederateConfig {
  /** Brief description of this federation (optional) */
  description?: string;
  /** OTel observability */
  telemetry: {
    enabled: boolean;
    aspire?: boolean;
  };
  /** Communication type for team signaling (v0.4.0: file-signal, v0.5.0: teams-channel) */
  communicationType: 'file-signal' | 'teams-channel';
  /** Teams channel configuration (required when communicationType is 'teams-channel') */
  teamsConfig?: {
    teamId: string;
    channelId: string;
  };
  /** Playbook skill name (default: "domain-playbook") */
  playbookSkill?: string;
  /** Deliverable filename for archetype (optional) */
  deliverable?: string;
  /** Deliverable schema path (optional) */
  deliverableSchema?: string;
  /** Import hook path (optional) */
  importHook?: string;
}

const DEFAULT_CONFIG: Partial<FederateConfig> & { telemetry: { enabled: boolean }; communicationType: 'file-signal' } = {
  telemetry: { enabled: true },
  communicationType: 'file-signal',
  playbookSkill: 'domain-playbook',
};

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function validateString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ConfigValidationError(`${fieldName} must be a string (got ${typeof value})`);
  }
  return value;
}

function validateBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ConfigValidationError(`${fieldName} must be a boolean (got ${typeof value})`);
  }
  return value;
}

function validateArray(value: unknown, fieldName: string): any[] {
  if (!Array.isArray(value)) {
    throw new ConfigValidationError(`${fieldName} must be an array (got ${typeof value})`);
  }
  return value;
}

function validateObject(value: unknown, fieldName: string): Record<string, any> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ConfigValidationError(`${fieldName} must be an object (got ${typeof value})`);
  }
  return value as Record<string, any>;
}

/**
 * Validate federate.config.json
 *
 * @param raw - Raw JSON object loaded from config file
 * @returns Validated config with defaults applied
 * @throws ConfigValidationError if validation fails
 */
export function validateConfig(raw: unknown): FederateConfig {
  if (typeof raw !== 'object' || raw === null) {
    throw new ConfigValidationError('Config must be an object');
  }

  const config = raw as Record<string, any>;
  const result: FederateConfig = { ...DEFAULT_CONFIG };

  // Track known fields for unknown field warnings
  const knownFields = new Set([
    'description',
    'telemetry',
    'communicationType',
    'teamsConfig',
    'playbookSkill',
    'deliverable',
    'deliverableSchema',
    'importHook',
  ]);

  // Warn on unknown fields
  for (const key of Object.keys(config)) {
    if (!knownFields.has(key)) {
      console.warn(`⚠️  Unknown config field: "${key}" — this may be a typo`);
    }
  }

  // Validate optional description
  if ('description' in config) {
    result.description = validateString(config.description, 'description');
    if (result.description.trim() === '') {
      throw new ConfigValidationError('description cannot be empty string');
    }
  }

  // Validate telemetry
  if ('telemetry' in config) {
    const telemetry = validateObject(config.telemetry, 'telemetry');
    
    if (!('enabled' in telemetry)) {
      throw new ConfigValidationError('telemetry.enabled is required');
    }
    
    result.telemetry = {
      enabled: validateBoolean(telemetry.enabled, 'telemetry.enabled'),
    };

    if ('aspire' in telemetry) {
      result.telemetry.aspire = validateBoolean(telemetry.aspire, 'telemetry.aspire');
    }

    // Warn on unknown telemetry fields
    const knownTelemetryFields = new Set(['enabled', 'aspire']);
    for (const key of Object.keys(telemetry)) {
      if (!knownTelemetryFields.has(key)) {
        console.warn(`⚠️  Unknown telemetry field: "${key}"`);
      }
    }
  }

  // Validate communicationType
  if ('communicationType' in config) {
    const commType = validateString(config.communicationType, 'communicationType');
    if (commType !== 'file-signal' && commType !== 'teams-channel') {
      throw new ConfigValidationError('communicationType must be "file-signal" or "teams-channel"');
    }
    result.communicationType = commType as 'file-signal' | 'teams-channel';
  }

  // Validate teamsConfig (required when communicationType is 'teams-channel')
  if ('teamsConfig' in config) {
    const teamsConfig = validateObject(config.teamsConfig, 'teamsConfig');
    
    if (!('teamId' in teamsConfig)) {
      throw new ConfigValidationError('teamsConfig.teamId is required');
    }
    if (!('channelId' in teamsConfig)) {
      throw new ConfigValidationError('teamsConfig.channelId is required');
    }
    
    result.teamsConfig = {
      teamId: validateString(teamsConfig.teamId, 'teamsConfig.teamId'),
      channelId: validateString(teamsConfig.channelId, 'teamsConfig.channelId'),
    };
  }

  // Validate that teamsConfig is provided when communicationType is 'teams-channel'
  if (result.communicationType === 'teams-channel' && !result.teamsConfig) {
    throw new ConfigValidationError('teamsConfig is required when communicationType is "teams-channel"');
  }

  // Validate optional playbookSkill
  if ('playbookSkill' in config) {
    result.playbookSkill = validateString(config.playbookSkill, 'playbookSkill');
    if (result.playbookSkill === '') {
      throw new ConfigValidationError('playbookSkill cannot be empty');
    }
  }

  // Validate optional deliverable
  if ('deliverable' in config) {
    result.deliverable = validateString(config.deliverable, 'deliverable');
    if (result.deliverable === '') {
      throw new ConfigValidationError('deliverable cannot be empty');
    }
  }

  // Validate optional deliverableSchema
  if ('deliverableSchema' in config) {
    result.deliverableSchema = validateString(config.deliverableSchema, 'deliverableSchema');
  }

  // Validate optional importHook
  if ('importHook' in config) {
    result.importHook = validateString(config.importHook, 'importHook');
  }

  return result;
}

/**
 * Load and validate config from file path
 *
 * @param configPath - Path to federate.config.json
 * @returns Validated config with defaults applied
 */
export function loadAndValidateConfig(configPath: string): FederateConfig {
  if (!fs.existsSync(configPath)) {
    // No config file — return defaults
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return validateConfig(raw);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(`❌ Config validation failed: ${err.message}`);
      console.error(`   Config file: ${configPath}`);
      console.error('\nRecovery:');
      console.error('  1. Check the example config for reference:');
      console.error('     cat federate.config.example.ts');
      console.error('  2. Validate your config structure:');
      console.error('     cat federate.config.json');
      console.error('  3. Common issues to check:');
      console.error('     - telemetry: must have enabled boolean field');
      console.error('     - playbookSkill: must be a non-empty string');
      console.error('  4. Restore from example:');
      console.error('     cp federate.config.example.ts federate.config.json');
      console.error('  5. Verify required fields are present:');
      console.error('     jq . federate.config.json');
      process.exit(1);
    }
    
    // JSON parse error or other error
    console.error(`❌ Failed to parse config file: ${configPath}`);
    console.error(`   Error: ${(err as Error).message}`);
    console.error('\nRecovery:');
    console.error('  1. Check for JSON syntax errors:');
    console.error('     cat federate.config.json | jq .');
    console.error('  2. Common JSON issues:');
    console.error('     - Missing or extra commas');
    console.error('     - Unquoted strings');
    console.error('     - Invalid escape sequences');
    console.error('     - Trailing commas in objects/arrays');
    console.error('  3. Validate JSON online: https://jsonlint.com');
    console.error('  4. Restore from backup if available:');
    console.error('     git checkout HEAD -- federate.config.json');
    console.error('  5. Start fresh from example:');
    console.error('     cp federate.config.example.ts federate.config.json');
    process.exit(1);
  }
}
