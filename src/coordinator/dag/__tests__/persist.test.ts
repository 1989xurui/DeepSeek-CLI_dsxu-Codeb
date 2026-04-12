/**
 * R5-33 DAG Persist + 2PC — bun:test unit tests
 */
import { describe, test, expect } from 'bun:test';
import { PersistentDagRunner } from '../persist';
import { linearDag } from '../templates';

const mockConfig = {
  stateDir: '.test-dag-state',
  mockNodeExecutor: async (node: any) => ({ result: `${node.id} done` }),
  mockFs: { read: async () => '{}', write: async () => {}, list: async () => [] as string[] },
};

describe('R5-33: PersistentDagRunner.run', () => {
  test('happy path succeeds', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    const r = await runner.run(linearDag(), 'run-happy');
    expect(r.status).toBe('success');
    expect(r.failedNodes).toHaveLength(0);
  });

  test('result has nodeResults', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    const r = await runner.run(linearDag(), 'run-nodes');
    expect(Object.keys(r.nodeResults).length).toBeGreaterThan(0);
  });

  test('durationMs is non-negative', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    const r = await runner.run(linearDag(), 'run-dur');
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('R5-33: PersistentDagRunner.list', () => {
  test('lists completed runs', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    await runner.run(linearDag(), 'list-01');
    const runs = await runner.list();
    expect(runs.length).toBeGreaterThanOrEqual(1);
    expect(runs.find(r => r.runId === 'list-01')).toBeDefined();
  });
});

describe('R5-33: PersistentDagRunner.resume', () => {
  test('resuming completed run returns success', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    await runner.run(linearDag(), 'resume-01');
    const r = await runner.resume('resume-01');
    expect(r.status).toBe('success');
  });

  test('resume unknown run throws', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    expect(runner.resume('nonexistent')).rejects.toThrow();
  });
});

describe('R5-33: PersistentDagRunner.abort', () => {
  test('abort marks run as aborted', async () => {
    const runner = new PersistentDagRunner(mockConfig);
    await runner.run(linearDag(), 'abort-01');
    await runner.abort('abort-01');
    const runs = await runner.list();
    const aborted = runs.find(r => r.runId === 'abort-01');
    expect(aborted?.phase).toBe('aborted');
  });
});

describe('R5-33: failure handling', () => {
  test('node failure results in non-success', async () => {
    const failRunner = new PersistentDagRunner({
      ...mockConfig,
      mockNodeExecutor: async (node: any) => {
        if (node.id === 'critic') throw new Error('critic failed');
        return { result: 'ok' };
      },
    });
    const r = await failRunner.run(linearDag(), 'fail-01');
    expect(r.status).not.toBe('success');
    expect(r.failedNodes).toContain('critic');
  });
});
