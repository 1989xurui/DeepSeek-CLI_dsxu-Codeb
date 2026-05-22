import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestSpec } from '../contract';
import { runGreenPhase, runRedPhase } from '../runner';

async function withTestFile(content: string, fn: (dir: string, file: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'dsxu-tdd-gate-'));
  const file = join(dir, 'sample.test.ts');

  try {
    await writeFile(file, content, 'utf-8');
    await fn(dir, file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function spec(filePath: string): TestSpec {
  return {
    filePath,
    content: '',
    targetName: 'sample',
    testDescriptions: ['sample behavior'],
  };
}

describe('R5-21 TDD gate real runner', () => {
  test('red phase succeeds when the generated test fails before implementation', async () => {
    await withTestFile(`
      import { expect, test } from 'bun:test';
      test('red phase failing test', () => {
        expect(1).toBe(2);
      });
    `, async (dir, file) => {
      const result = await runRedPhase(spec(file), {
        cwd: dir,
        testCommand: 'bun test {file}',
        redTimeoutMs: 20_000,
      });

      expect(result.success).toBe(true);
      expect(result.output ?? '').toContain('red phase failing test');
    });
  });

  test('green phase succeeds when the implementation satisfies the test', async () => {
    await withTestFile(`
      import { expect, test } from 'bun:test';
      test('green phase passing test', () => {
        expect('dsxu'.toUpperCase()).toBe('DSXU');
      });
    `, async (dir, file) => {
      const result = await runGreenPhase(spec(file), {
        cwd: dir,
        testCommand: 'bun test {file}',
        greenTimeoutMs: 20_000,
      });

      expect(result.success).toBe(true);
      expect(result.output ?? '').toContain('green phase passing test');
    });
  });

  test('green phase blocks when the implementation still fails', async () => {
    await withTestFile(`
      import { expect, test } from 'bun:test';
      test('green phase failing test', () => {
        expect('dsxu').toBe('DSXU');
      });
    `, async (dir, file) => {
      const result = await runGreenPhase(spec(file), {
        cwd: dir,
        testCommand: 'bun test {file}',
        greenTimeoutMs: 20_000,
      });

      expect(result.success).toBe(false);
      expect(result.error ?? '').toContain('green phase');
    });
  });
});
