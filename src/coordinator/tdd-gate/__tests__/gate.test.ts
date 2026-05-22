import { describe, expect, test } from 'bun:test';
import type { TDDContext, TestSpec } from '../contract';
import { tddGate } from '../gate';
import { TddGate, invokePostWriteTddGate } from '../post-write-hook';

const context: TDDContext = {
  taskDescription: 'add sample function',
  targetFiles: ['src/sample.ts'],
  cwd: process.cwd(),
  existingTests: [],
};

function spec(): TestSpec {
  return {
    filePath: 'src/sample.test.ts',
    content: '',
    targetName: 'sample',
    testDescriptions: ['sample should work'],
  };
}

describe('R5-21 TDD gate orchestration', () => {
  test('passes when red fails first and green passes after implementation', async () => {
    let calls = 0;
    const result = await tddGate(context, {
      mockTestGenerator: async () => spec(),
      mockTestRunner: async () => {
        calls += 1;
        return calls === 1
          ? { passed: false, output: 'expected red failure' }
          : { passed: true, output: 'green pass' };
      },
    });

    expect(result.passed).toBe(true);
    expect(result.redPhase.success).toBe(true);
    expect(result.greenPhase?.success).toBe(true);
    expect(calls).toBe(2);
  });

  test('blocks green phase when red phase unexpectedly passes', async () => {
    let calls = 0;
    const result = await tddGate(context, {
      mockTestGenerator: async () => spec(),
      mockTestRunner: async () => {
        calls += 1;
        return { passed: true, output: 'red passed unexpectedly' };
      },
    });

    expect(result.passed).toBe(false);
    expect(result.greenPhase).toBeUndefined();
    expect(result.error ?? '').toContain('red phase');
    expect(calls).toBe(1);
  });

  test('post-write hook defaults to visible post-mutation verification semantics', async () => {
    const gate = new TddGate();
    const result = await gate.invoke({
      filePath: 'src/sample.ts',
      changeType: 'write',
      newContent: 'export const sample = 1',
    });

    expect(result.status).toBe('PARTIAL');
    expect(result.passed).toBe(true);
    expect(result.semantics).toBe('post-mutation-verification');
  });

  test('post-write hook can still be explicitly disabled for boundary evidence', async () => {
    const gate = new TddGate({ enabled: false });
    const result = await gate.invoke({
      filePath: 'src/sample.ts',
      changeType: 'write',
      newContent: 'export const sample = 1',
    });

    expect(result.status).toBe('SKIPPED');
    expect(result.semantics).toBe('skipped');
  });

  test('post-write hook defaults to post-mutation verification semantics', async () => {
    const result = await invokePostWriteTddGate(
      {
        filePath: 'src/sample.ts',
        changeType: 'edit',
        oldContent: 'export const sample = 0',
        newContent: 'export const sample = 1',
        repoRoot: process.cwd(),
      },
      {
        enabled: true,
      },
    );

    expect(result.status).toBe('PARTIAL');
    expect(result.passed).toBe(true);
    expect(result.semantics).toBe('post-mutation-verification');
    expect(result.error ?? '').toContain('pre-edit test contract');
  });

  test('post-write hook can invoke the full TDD gate when explicitly requested', async () => {
    let calls = 0;
    const result = await invokePostWriteTddGate(
      {
        filePath: 'src/sample.ts',
        changeType: 'edit',
        oldContent: 'export const sample = 0',
        newContent: 'export const sample = 1',
        repoRoot: process.cwd(),
      },
      {
        enabled: true,
        mode: 'full-test',
        mockTestGenerator: async () => spec(),
        mockTestRunner: async () => {
          calls += 1;
          return calls === 1
            ? { passed: false, output: 'expected red failure' }
            : { passed: true, output: 'green pass' };
        },
      },
    );

    expect(result.status).toBe('PASS');
    expect(result.passed).toBe(true);
    expect(result.semantics).toBe('full-test');
    expect(calls).toBe(2);
  });
});
