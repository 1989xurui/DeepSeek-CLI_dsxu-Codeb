/**
 * R5-17 Multi-Agent Role Coordination — Tests
 *
 * 路径：src/coordinator/roles/__tests__/orchestrator.test.ts
 */

import { orchestrate, TaskContext, OrchestrationResult } from '../index';

describe('Multi-Agent Role Coordination', () => {
  const mockTask: TaskContext = {
    taskId: 'test-1',
    description: 'Add a new function to calculate sum',
    targetFiles: ['src/math.ts'],
    cwd: '/test',
    existingTests: ['test/math.test.ts'],
  };

  test('linear mode should complete with mock responses', async () => {
    const result = await orchestrate(mockTask, { mode: 'linear' });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('mode', 'linear');
    expect(result).toHaveProperty('totalDurationMs');
    expect(result).toHaveProperty('totalTurns');
    expect(result).toHaveProperty('criticRejectionRate');
    expect(result).toHaveProperty('roleStats');

    // 检查角色统计
    expect(result.roleStats.planner.invocations).toBeGreaterThan(0);
    expect(result.roleStats.executor.invocations).toBeGreaterThan(0);
    expect(result.roleStats.critic.invocations).toBeGreaterThan(0);
    expect(result.roleStats.verifier.invocations).toBeGreaterThan(0);
  });

  test('reflexion mode should handle loops', async () => {
    const result = await orchestrate(mockTask, { mode: 'reflexion', maxReflexionLoops: 2 });

    expect(result.mode).toBe('reflexion');
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  test('map-reduce mode should handle multiple files', async () => {
    const multiFileTask: TaskContext = {
      ...mockTask,
      targetFiles: ['src/file1.ts', 'src/file2.ts', 'src/file3.ts'],
    };

    const result = await orchestrate(multiFileTask, { mode: 'map-reduce' });

    expect(result.mode).toBe('map-reduce');
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  test('debate mode should complete', async () => {
    const result = await orchestrate(mockTask, { mode: 'debate' });

    expect(result.mode).toBe('debate');
    expect(result.totalTurns).toBeGreaterThan(0);
  });

  test('should handle empty target files', async () => {
    const emptyTask: TaskContext = {
      ...mockTask,
      targetFiles: [],
    };

    const result = await orchestrate(emptyTask);
    expect(result.success).toBe(false);
    expect(result.error).toContain('no target files');
  });

  test('should respect maxTotalTurns', async () => {
    const result = await orchestrate(mockTask, { maxTotalTurns: 5 });
    expect(result.totalTurns).toBeLessThanOrEqual(5);
  });

  test('should calculate critic rejection rate', async () => {
    const result = await orchestrate(mockTask);
    expect(result.criticRejectionRate).toBeGreaterThanOrEqual(0);
    expect(result.criticRejectionRate).toBeLessThanOrEqual(1);
  });

  test('should include message log', async () => {
    const result = await orchestrate(mockTask);
    expect(Array.isArray(result.messageLog)).toBe(true);
    expect(result.messageLog.length).toBeGreaterThan(0);

    // 检查消息格式
    const msg = result.messageLog[0];
    expect(msg).toHaveProperty('from');
    expect(msg).toHaveProperty('to');
    expect(msg).toHaveProperty('type');
    expect(msg).toHaveProperty('payload');
    expect(msg).toHaveProperty('timestamp');
    expect(msg).toHaveProperty('turnIndex');
  });

  test('should handle role overrides', async () => {
    const result = await orchestrate(mockTask, {
      roleOverrides: {
        planner: { maxTurns: 1 },
        executor: { timeoutMs: 10000 },
      },
    });

    expect(result.roleStats.planner.invocations).toBeLessThanOrEqual(1);
  });
});