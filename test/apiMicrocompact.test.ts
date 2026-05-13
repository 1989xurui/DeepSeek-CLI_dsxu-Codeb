import { describe, test, expect, beforeEach } from 'bun:test';
import { apiMicrocompact } from '../src/services/compact/apiMicrocompact';

describe('apiMicrocompact', () => {
  test('should compact simple object', () => {
    const input = {
      name: 'John',
      age: 30,
      address: {
        city: 'New York',
        country: 'USA'
      }
    };

    const result = apiMicrocompact(input);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeLessThan(JSON.stringify(input).length);
  });

  test('should handle empty object', () => {
    const input = {};
    const result = apiMicrocompact(input);

    expect(result).toBeDefined();
    expect(result).toBe('{}');
  });

  test('should handle null and undefined', () => {
    expect(apiMicrocompact(null)).toBe('null');
    expect(apiMicrocompact(undefined)).toBe('undefined');
  });

  test('should compact arrays', () => {
    const input = [1, 2, 3, { name: 'test' }];
    const result = apiMicrocompact(input);

    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result).toContain('[');
    expect(result).toContain(']');
  });
});