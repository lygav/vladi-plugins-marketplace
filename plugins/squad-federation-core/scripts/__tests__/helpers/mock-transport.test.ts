/**
 * Tests for MockTransport to validate it faithfully implements TeamTransport interface.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockTransport } from './mock-transport.js';
import { createTestSignal, createTestStatus, createTestLearning } from './test-fixtures.js';

describe('MockTransport', () => {
  let transport: MockTransport;
  
  beforeEach(() => {
    transport = new MockTransport();
  });
  
  describe('file operations', () => {
    it('should write and read files', async () => {
      await transport.writeFile('team-alpha', 'test.txt', 'hello world');
      const content = await transport.readFile('team-alpha', 'test.txt');
      
      expect(content).toBe('hello world');
    });
    
    it('should return null for non-existent files', async () => {
      const content = await transport.readFile('team-alpha', 'missing.txt');
      expect(content).toBeNull();
    });
    
    it('should check file existence', async () => {
      await transport.writeFile('team-alpha', 'exists.txt', 'content');
      
      expect(await transport.exists('team-alpha', 'exists.txt')).toBe(true);
      expect(await transport.exists('team-alpha', 'missing.txt')).toBe(false);
    });
    
    it('should return file stats', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'content');
      const stats = await transport.stat('team-alpha', 'file.txt');
      
      expect(stats).not.toBeNull();
      expect(stats?.isDirectory).toBe(false);
      expect(stats?.size).toBe(7); // 'content' is 7 chars
    });
    
    it('should isolate files by teamId', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'alpha content');
      await transport.writeFile('team-beta', 'file.txt', 'beta content');
      
      expect(await transport.readFile('team-alpha', 'file.txt')).toBe('alpha content');
      expect(await transport.readFile('team-beta', 'file.txt')).toBe('beta content');
    });
  });
  
  describe('status operations', () => {
    it('should read and write status', async () => {
      const status = createTestStatus({
        domain: 'team-alpha',
        state: 'scanning',
        message: 'In progress',
      });
      
      await transport.writeFile('team-alpha', '.squad/status.json', JSON.stringify(status));
      const result = await transport.readStatus('team-alpha');
      
      expect(result).toEqual(status);
    });
    
    it('should return null for missing status', async () => {
      const result = await transport.readStatus('team-alpha');
      expect(result).toBeNull();
    });
  });
  
  describe('signal operations', () => {
    it('should write and read inbox signals', async () => {
      const signal = createTestSignal({
        from: 'meta',
        to: 'team-alpha',
        type: 'directive',
      });
      
      await transport.writeInboxSignal('team-alpha', signal);
      const signals = await transport.readInboxSignals('team-alpha');
      
      expect(signals).toHaveLength(1);
      expect(signals[0]).toEqual(signal);
    });
    
    it('should read multiple inbox signals', async () => {
      const signal1 = createTestSignal({ id: 'signal-1' });
      const signal2 = createTestSignal({ id: 'signal-2' });
      
      await transport.writeInboxSignal('team-alpha', signal1);
      await transport.writeInboxSignal('team-alpha', signal2);
      
      const signals = await transport.readInboxSignals('team-alpha');
      expect(signals).toHaveLength(2);
    });
    
    it('should list signals with filters', async () => {
      const signal1 = createTestSignal({ type: 'directive', from: 'meta' });
      const signal2 = createTestSignal({ type: 'report', from: 'team-alpha' });
      
      await transport.writeInboxSignal('team-alpha', signal1);
      await transport.writeInboxSignal('team-alpha', signal2);
      
      const directives = await transport.listSignals('team-alpha', 'inbox', { type: 'directive' });
      expect(directives).toHaveLength(1);
      expect(directives[0].type).toBe('directive');
      
      const fromMeta = await transport.listSignals('team-alpha', 'inbox', { from: 'meta' });
      expect(fromMeta).toHaveLength(1);
      expect(fromMeta[0].from).toBe('meta');
    });
  });
  
  describe('learning log operations', () => {
    it('should append and read learning entries', async () => {
      const entry1 = createTestLearning({ content: 'First learning' });
      const entry2 = createTestLearning({ content: 'Second learning' });
      
      await transport.appendLearning('team-alpha', entry1);
      await transport.appendLearning('team-alpha', entry2);
      
      const entries = await transport.readLearningLog('team-alpha');
      
      expect(entries).toHaveLength(2);
      expect(entries[0].content).toBe('First learning');
      expect(entries[1].content).toBe('Second learning');
    });
    
    it('should return empty array for missing learning log', async () => {
      const entries = await transport.readLearningLog('team-alpha');
      expect(entries).toEqual([]);
    });
  });
  
  describe('test helpers', () => {
    it('should seed team with files', () => {
      transport.seedTeam('team-alpha', {
        'file1.txt': 'content1',
        'file2.txt': 'content2',
      });
      
      expect(transport.getTeams()).toContain('team-alpha');
    });
    
    it('should clear all data', async () => {
      await transport.writeFile('team-alpha', 'file.txt', 'content');
      await transport.writeFile('team-beta', 'file.txt', 'content');
      
      transport.clear();
      
      expect(transport.getTeams()).toHaveLength(0);
      expect(await transport.readFile('team-alpha', 'file.txt')).toBeNull();
    });
    
    it('should list all teams', () => {
      transport.seedTeam('team-alpha', {});
      transport.seedTeam('team-beta', {});
      transport.seedTeam('team-gamma', {});
      
      const teams = transport.getTeams();
      expect(teams).toHaveLength(3);
      expect(teams).toContain('team-alpha');
      expect(teams).toContain('team-beta');
      expect(teams).toContain('team-gamma');
    });
  });
});
