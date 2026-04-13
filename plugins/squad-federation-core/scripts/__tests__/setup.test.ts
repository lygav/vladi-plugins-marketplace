/**
 * Smoke test to verify Vitest setup is working correctly.
 */

import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should run tests', () => {
    expect(true).toBe(true);
  });
  
  it('should support async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
  
  it('should have access to node environment', () => {
    expect(process.env).toBeDefined();
    expect(process.version).toBeDefined();
  });
  
  it('should support test globals', () => {
    expect(describe).toBeDefined();
    expect(it).toBeDefined();
    expect(expect).toBeDefined();
  });
});
