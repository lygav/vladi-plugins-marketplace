/**
 * Test fixture factories for creating valid test data.
 * Based on DESIGN.md specifications.
 */

import type { ScanStatus, SignalMessage, LearningEntry } from './mock-transport.js';

/**
 * Create a test SignalMessage with optional overrides.
 */
export function createTestSignal(overrides?: Partial<SignalMessage>): SignalMessage {
  const defaults: SignalMessage = {
    id: `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    from: 'meta',
    to: 'team-alpha',
    type: 'directive',
    subject: 'Test directive',
    body: 'Test message body',
    protocol: 'v1',
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create a test ScanStatus with optional overrides.
 */
export function createTestStatus(overrides?: Partial<ScanStatus>): ScanStatus {
  const defaults: ScanStatus = {
    domain: 'team-alpha',
    domain_id: 'alpha',
    state: 'idle',
    step: 'init',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archetype_id: 'deliverable',
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create a test LearningEntry with optional overrides.
 */
export function createTestLearning(overrides?: Partial<LearningEntry>): LearningEntry {
  const defaults: LearningEntry = {
    id: `learning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    type: 'pattern',
    content: 'Test learning content',
    confidence: 'medium',
  };
  
  return { ...defaults, ...overrides };
}

/**
 * ArchetypeManifest from DESIGN.md Section 4.1
 */
export interface ArchetypeManifest {
  id: string;
  version: string;
  name: string;
  description: string;
  role: 'meta' | 'team';
  capabilities: string[];
  templates?: string[];
  skills?: string[];
}

/**
 * Create a test ArchetypeManifest with optional overrides.
 */
export function createTestManifest(overrides?: Partial<ArchetypeManifest>): ArchetypeManifest {
  const defaults: ArchetypeManifest = {
    id: 'test-archetype',
    version: '0.1.0',
    name: 'Test Archetype',
    description: 'A test archetype for unit testing',
    role: 'team',
    capabilities: ['execute'],
  };
  
  return { ...defaults, ...overrides };
}

/**
 * TeamEntry from DESIGN.md Section 2.2.3
 */
export interface TeamEntry {
  domain: string;
  domainId: string;
  location: string;
  archetypeId: string;
  created_at: string;
}

/**
 * Create a test TeamEntry with optional overrides.
 */
export function createTestTeamEntry(overrides?: Partial<TeamEntry>): TeamEntry {
  const defaults: TeamEntry = {
    domain: 'team-alpha',
    domainId: 'alpha',
    location: '/mock/team-alpha',
    archetypeId: 'deliverable',
    created_at: new Date().toISOString(),
  };
  
  return { ...defaults, ...overrides };
}

/**
 * Create a complete team seed with all standard files.
 */
export function createTeamSeed(teamId: string, state: ScanStatus['state'] = 'idle'): Record<string, string> {
  const status = createTestStatus({ domain: teamId, state });
  
  return {
    '.squad/status.json': JSON.stringify(status, null, 2),
    '.squad/learning.jsonl': '',
    '.squad/inbox/': '',
    '.squad/outbox/': '',
  };
}

/**
 * Create signal message bodies for common directive types.
 */
export const signalBodies = {
  scan: (priority: 'low' | 'normal' | 'high' = 'normal') => 
    `Start scanning with ${priority} priority`,
  
  report: (summary: string, metrics?: Record<string, unknown>) => 
    `Report: ${summary}${metrics ? '\n' + JSON.stringify(metrics) : ''}`,
  
  ack: (originalSignalId: string, status: 'received' | 'processing' | 'completed' | 'failed') => 
    `Acknowledgment for ${originalSignalId}: ${status}`,
  
  query: (question: string) => 
    `Query: ${question}`,
};
