import { describe, test, expect, beforeEach } from 'bun:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateMutations, resetIdCounter, runMutationTests } from '../index';
import type { Mutation, MutationOperator } from '../contract';

beforeEach(() => {
  resetIdCounter();
});

// ── generateMutations ──────────────────────────────────────────────

describe('generateMutations', () => {
  const SOURCE = [
    'function add(a, b) {',
    '  const result = a + b;',
    '  if (result === 0) return false;',
    '  return result;',
    '}',
  ].join('\n');

  test('produces at least one mutation for non-trivial source', () => {
    const muts = generateMutations(SOURCE, 'test.ts');
    expect(muts.length).toBeGreaterThan(0);
  });

  test('every mutation has required fields', () => {
    const muts = generateMutations(SOURCE, 'test.ts');
    for (const m of muts) {
      expect(m.id).toMatch(/^mut-\d+$/);
      expect(m.file).toBe('test.ts');
      expect(m.line).toBeGreaterThan(0);
      expect(typeof m.before).toBe('string');
      expect(typeof m.after).toBe('string');
      expect(m.before).not.toBe(m.after);
    }
  });

  test('M01 arithmetic operator replacement works', () => {
    const muts = generateMutations(SOURCE, 'f.ts');
    const m01 = muts.filter(m => m.operator === 'M01');
    expect(m01.length).toBeGreaterThan(0);
    // + should become -
    expect(m01.some(m => m.after.includes('-'))).toBe(true);
  });

  test('M02 relational operator replacement works', () => {
    const muts = generateMutations(SOURCE, 'f.ts');
    const m02 = muts.filter(m => m.operator === 'M02');
    expect(m02.length).toBeGreaterThan(0);
  });

  test('M05 constant replacement works', () => {
    const muts = generateMutations(SOURCE, 'f.ts');
    const m05 = muts.filter(m => m.operator === 'M05');
    expect(m05.length).toBeGreaterThan(0);
    // false → true or 0 → 1
    expect(m05.some(m => m.after.includes('true') || m.after.includes('1'))).toBe(true);
  });

  test('M06 return value deletion works', () => {
    const muts = generateMutations(SOURCE, 'f.ts');
    const m06 = muts.filter(m => m.operator === 'M06');
    expect(m06.length).toBeGreaterThan(0);
    expect(m06.some(m => m.after.trim() === 'return;')).toBe(true);
  });

  test('M07 condition negation works', () => {
    const muts = generateMutations(SOURCE, 'f.ts');
    const m07 = muts.filter(m => m.operator === 'M07');
    expect(m07.length).toBeGreaterThan(0);
    expect(m07.some(m => m.after.includes('!('))).toBe(true);
  });

  test('disabled operators are excluded', () => {
    const disabled: MutationOperator[] = ['M01', 'M02', 'M03'];
    const muts = generateMutations(SOURCE, 'f.ts', disabled);
    for (const m of muts) {
      expect(disabled).not.toContain(m.operator);
    }
  });

  test('IDs are sequential after reset', () => {
    const muts = generateMutations('const x = a + b;', 'f.ts');
    if (muts.length >= 2) {
      const ids = muts.map(m => parseInt(m.id.replace('mut-', '')));
      for (let i = 1; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThan(ids[i - 1]);
      }
    }
  });
});

// ── runMutationTests ───────────────────────────────────────────────

describe('runMutationTests', () => {
  const SOURCE = 'const x = a + b;\nif (x === 0) return false;';

  test('killRate = 1.0 when all tests fail (all killed)', async () => {
    const report = await runMutationTests(SOURCE, 'f.ts', undefined, {
      mockTestRunner: async () => ({ passed: false, output: 'FAIL' }),
    });
    expect(report.killRate).toBe(1.0);
    expect(report.survived).toBe(0);
    expect(report.killed).toBe(report.total);
  });

  test('killRate = 0 when all tests pass (all survived)', async () => {
    const report = await runMutationTests(SOURCE, 'f.ts', undefined, {
      mockTestRunner: async () => ({ passed: true, output: 'PASS' }),
    });
    expect(report.killRate).toBe(0);
    expect(report.survived).toBe(report.total);
    expect(report.killed).toBe(0);
  });

  test('mixed results produce correct counts', async () => {
    let call = 0;
    const report = await runMutationTests(SOURCE, 'f.ts', undefined, {
      mockTestRunner: async () => {
        call++;
        return { passed: call % 2 === 0, output: `call-${call}` };
      },
    });
    expect(report.killed + report.survived).toBe(report.total);
    expect(report.killed).toBeGreaterThan(0);
    expect(report.survived).toBeGreaterThan(0);
    expect(report.killRate).toBeGreaterThan(0);
    expect(report.killRate).toBeLessThan(1);
  });

  test('budget maxMutations limits mutation count', async () => {
    const report = await runMutationTests(SOURCE, 'f.ts', { maxMutations: 2 }, {
      mockTestRunner: async () => ({ passed: false, output: 'FAIL' }),
    });
    expect(report.total).toBeLessThanOrEqual(2);
  });

  test('survivors list contains only survived mutations', async () => {
    let call = 0;
    const report = await runMutationTests(SOURCE, 'f.ts', undefined, {
      mockTestRunner: async () => {
        call++;
        return { passed: call === 1, output: '' };
      },
    });
    expect(report.survivors.length).toBe(report.survived);
  });

  test('mock generator overrides built-in generation', async () => {
    const fakeMut: Mutation = {
      id: 'mut-custom',
      operator: 'M01',
      file: 'f.ts',
      line: 1,
      before: 'a + b',
      after: 'a - b',
    };
    const report = await runMutationTests(SOURCE, 'f.ts', undefined, {
      mockMutationGenerator: () => [fakeMut],
      mockTestRunner: async () => ({ passed: false, output: 'FAIL' }),
    });
    expect(report.total).toBe(1);
    expect(report.results[0].mutation.id).toBe('mut-custom');
  });

  test('timeout errors are counted correctly', async () => {
    const report = await runMutationTests('const x = 1;', 'f.ts', undefined, {
      mockMutationGenerator: (_src, _file) => [{
        id: 'mut-1', operator: 'M05', file: 'f.ts', line: 1,
        before: 'const x = 1;', after: 'const x = 0;',
      }],
      mockTestRunner: async () => { throw new Error('timeout exceeded'); },
    });
    expect(report.timedOut).toBe(1);
    expect(report.killed).toBe(0);
  });

  test('real runner mutates a file, runs tests, and restores source', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dsxu-mutation-test-'));
    const sourceFile = join(dir, 'target.ts');
    const testFile = join(dir, 'target.test.ts');
    const source = 'export function add(a: number, b: number) { return a + b; }\n';

    try {
      await writeFile(sourceFile, source, 'utf-8');
      await writeFile(testFile, `
        import { describe, expect, test } from 'bun:test';
        import { add } from './target';

        describe('add', () => {
          test('adds positive numbers', () => {
            expect(add(1, 2)).toBe(3);
            expect(add(2, 2)).toBe(4);
          });
        });
      `, 'utf-8');

      const report = await runMutationTests(source, sourceFile, {
        maxMutations: 1,
        timeoutMs: 20_000,
      }, {
        cwd: dir,
        testCommand: 'bun test target.test.ts',
      });

      expect(report.total).toBe(1);
      expect(report.killed).toBe(1);
      expect(report.survived).toBe(0);
      expect(await readFile(sourceFile, 'utf-8')).toBe(source);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
