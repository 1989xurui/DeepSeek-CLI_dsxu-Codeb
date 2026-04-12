import { describe, test, expect } from 'bun:test';
import { suggestProperties, runPbt, generatePropertyTest, inferTemplates } from '../index';
import type { PropertyTemplate, PbtConfig } from '../contract';

describe('R5-30 PBT — inferTemplates', () => {
  test('parse function gets idempotent', () => {
    const templates = inferTemplates('parseInput', 'function parseInput(x) { return x.trim(); }');
    expect(templates).toContain('idempotent');
  });

  test('encode function gets invertible', () => {
    const templates = inferTemplates('encodeBase64', 'function encodeBase64(x) { return btoa(x); }');
    expect(templates).toContain('invertible');
  });

  test('sort function gets monotonic', () => {
    const templates = inferTemplates('sortItems', 'function sortItems(arr) { return arr.sort(); }');
    expect(templates).toContain('monotonic');
  });

  test('insert function gets invariant', () => {
    const templates = inferTemplates('insertItem', 'function insertItem(arr, x) { return [...arr, x]; }');
    expect(templates).toContain('invariant');
  });

  test('add function gets commutative', () => {
    const templates = inferTemplates('addValues', 'function addValues(a, b) { return a + b; }');
    expect(templates).toContain('commutative');
  });

  test('pure function with no name hints gets idempotent fallback', () => {
    const templates = inferTemplates('compute', 'function compute(x) { return x * 2; }');
    expect(templates.length).toBeGreaterThan(0);
  });
});

describe('R5-30 PBT — generatePropertyTest', () => {
  test('generates idempotent test code', () => {
    const code = generatePropertyTest('parseInput', 'idempotent', './module');
    expect(code).toContain('idempotent');
    expect(code).toContain('parseInput');
    expect(code).toContain('import');
  });

  test('generates invertible test code', () => {
    const code = generatePropertyTest('encodeData', 'invertible', './module');
    expect(code).toContain('encode');
    expect(code).toContain('decode');
  });

  test('generates invariant test code', () => {
    const code = generatePropertyTest('insertItem', 'invariant', './module');
    expect(code).toContain('length');
    expect(code).toContain('insertItem');
  });
});

describe('R5-30 PBT — suggestProperties', () => {
  test('suggests properties for source with pure functions', async () => {
    const mockSource = `
export function parseConfig(s: string) { return JSON.parse(s); }
export function encodeToken(t: string) { return btoa(t); }
export function addScore(a: number, b: number) { return a + b; }
    `;
    const config: PbtConfig = {
      mockSourceReader: async () => mockSource,
      mockPurityCheck: () => true,
    };
    const suggestions = await suggestProperties('test.ts', config);
    expect(suggestions.length).toBeGreaterThan(0);
    const names = suggestions.map(s => s.functionName);
    expect(names).toContain('parseConfig');
  });

  test('suggestions include generated code', async () => {
    const config: PbtConfig = {
      mockSourceReader: async () => 'export function sortList(arr: number[]) { return arr.sort(); }',
      mockPurityCheck: () => true,
    };
    const suggestions = await suggestProperties('sort.ts', config);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].generatedCode.length).toBeGreaterThan(0);
  });

  test('confidence is between 0 and 1', async () => {
    const config: PbtConfig = {
      mockSourceReader: async () => 'export function parseData(x: string) { return x.trim(); }',
      mockPurityCheck: () => true,
    };
    const suggestions = await suggestProperties('data.ts', config);
    for (const s of suggestions) {
      expect(s.confidence).toBeGreaterThanOrEqual(0);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe('R5-30 PBT — runPbt', () => {
  test('mock runner pass', async () => {
    const config: PbtConfig = {
      mockRunner: async (_code, runs) => ({ passed: true, runs, error: undefined }),
    };
    const result = await runPbt('test code', config);
    expect(result.passed).toBe(true);
    expect(result.runs).toBe(100);
  });

  test('mock runner fail with counterexample', async () => {
    const config: PbtConfig = {
      mockRunner: async (_code, runs) => ({
        passed: false,
        runs,
        counterexample: { input: -1 },
        shrinkSteps: 3,
      }),
    };
    const result = await runPbt('test code', config);
    expect(result.passed).toBe(false);
    expect(result.counterexample).toEqual({ input: -1 });
    expect(result.shrinkSteps).toBe(3);
  });

  test('custom run count is used', async () => {
    const config: PbtConfig = {
      runs: 200,
      mockRunner: async (_code, runs) => ({ passed: true, runs }),
    };
    const result = await runPbt('test code', config);
    expect(result.runs).toBe(200);
  });
});
