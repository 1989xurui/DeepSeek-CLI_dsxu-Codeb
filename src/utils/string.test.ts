import { describe, it, expect } from 'bun:test';
import { capitalize } from './string';

describe('capitalize', () => {
  it('should capitalize the first letter of a lowercase string', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should not change an already capitalized string', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('should handle a single character', () => {
    expect(capitalize('a')).toBe('A');
  });

  it('should handle an empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('should only capitalize the first character, leaving the rest unchanged', () => {
    expect(capitalize('hello world')).toBe('Hello world');
  });

  it('should handle strings with leading numbers', () => {
    expect(capitalize('1hello')).toBe('1hello');
  });
});
