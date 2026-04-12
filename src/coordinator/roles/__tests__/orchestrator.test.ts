/**
 * R5-17 Multi-Agent Role Coordination — Deterministic Tests
 *
 * 所有测试使用 mockRoles 注入，0 延迟，100% 确定性。
 */

import { describe, test, expect } from 'bun:test';
import {
  orchestrate,
  createRole,
  formatOrchestrationReport,
  recommendMode,
  type Role,
  type RoleName,
  type MessageEnvelope,
  type TaskContext,
  type RoleResponse,
} from '../index';

// ── Mock 工具 ──

function createMockRole(
  name: RoleName,
  responses: Array<{ type: MessageEnvelope['type']; payload: Record<string, unknown> }>
): Role {
  let callIndex = 0;
  return {
    config: { name, modelPreference: 'chat', systemPrompt: '', maxTurns: 10, timeoutMs: 30000 },
    async process(inbox: MessageEnvelope[], context: TaskContext): Promise<RoleResponse> {
      const resp = responses[callIndex] || responses[responses.length - 1];
      callIndex++;
      return {
        role: name,
        messages: [{
          from: name,
          to: 'orchestrator',
          type: resp.type,
          payload: resp.payload,
          timestamp: Date.now(),
          turnIndex: callIndex - 1,
        }],
        durationMs: 10,
        tokenUsage: { input: 100, output: 50 },
      };
    },
    reset() { callIndex = 0; },
  };
}

const baseTask: TaskContext = {
  taskId: 'test-1',
  description: 'Add a sum function',
  targetFiles: ['src/math.ts'],
  cwd: '/test',
  existingTests: [],
};

// ── Linear 模式 ──

describe('Linear mode', () => {
  test('1. linear 成功：4 角色都通过', async () => {
    const result = await orchestrate(baseTask, {
      mode: 'linear',
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['analyze', 'implement'] } }]),
        executor: createMockRole('executor', [{ type: 'patch', payload: { diff: '+added line' } }]),
        critic: createMockRole('critic', [{ type: 'approval', payload: { result: 'approved' } }]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('linear');
    expect(result.finalPatch).toBe('+added line');
    expect(result.messageLog.length).toBeGreaterThan(0);
    expect(result.roleStats.planner.invocations).toBe(1);
    expect(result.roleStats.executor.invocations).toBe(1);
    expect(result.roleStats.critic.invocations).toBe(1);
    expect(result.roleStats.verifier.invocations).toBe(1);
  });

  test('2. linear critic reject → 失败', async () => {
    const result = await orchestrate(baseTask, {
      mode: 'linear',
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['analyze'] } }]),
        executor: createMockRole('executor', [{ type: 'patch', payload: { diff: '+bad code' } }]),
        critic: createMockRole('critic', [{ type: 'rejection', payload: { reason: 'Poor quality' } }]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('reject');
  });
});

// ── Reflexion 模式 ──

describe('Reflexion mode', () => {
  test('3. reflexion: critic 先 reject 再 approve → 成功', async () => {
    const result = await orchestrate(baseTask, {
      mode: 'reflexion',
      maxReflexionLoops: 3,
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['fix bug'] } }]),
        executor: createMockRole('executor', [
          { type: 'patch', payload: { diff: '+attempt 1' } },
          { type: 'patch', payload: { diff: '+attempt 2' } },
        ]),
        critic: createMockRole('critic', [
          { type: 'rejection', payload: { reason: 'Missing null check' } },
          { type: 'approval', payload: { result: 'approved' } },
        ]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('reflexion');
    expect(result.roleStats.executor.invocations).toBe(2);
    expect(result.roleStats.critic.invocations).toBe(2);
  });

  test('4. reflexion: 耗尽循环 → 失败', async () => {
    const result = await orchestrate(baseTask, {
      mode: 'reflexion',
      maxReflexionLoops: 2,
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['fix'] } }]),
        executor: createMockRole('executor', [{ type: 'patch', payload: { diff: '+bad' } }]),
        critic: createMockRole('critic', [{ type: 'rejection', payload: { reason: 'Still bad' } }]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('reflexion');
  });
});

// ── Map-Reduce 模式 ──

describe('Map-Reduce mode', () => {
  test('5. map-reduce 成功', async () => {
    const multiTask: TaskContext = {
      ...baseTask,
      targetFiles: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    };
    const result = await orchestrate(multiTask, {
      mode: 'map-reduce',
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['refactor all'] } }]),
        executor: createMockRole('executor', [
          { type: 'patch', payload: { diff: '+fix a' } },
          { type: 'patch', payload: { diff: '+fix b' } },
          { type: 'patch', payload: { diff: '+fix c' } },
        ]),
        critic: createMockRole('critic', [
          { type: 'approval', payload: { result: 'approved' } },
          { type: 'approval', payload: { result: 'approved' } },
          { type: 'approval', payload: { result: 'approved' } },
        ]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('map-reduce');
    expect(result.roleStats.executor.invocations).toBe(3);
  });
});

// ── Debate 模式 ──

describe('Debate mode', () => {
  test('6. debate 成功', async () => {
    const result = await orchestrate(baseTask, {
      mode: 'debate',
      mockRoles: {
        planner: createMockRole('planner', [{ type: 'plan', payload: { steps: ['design cache'] } }]),
        executor: createMockRole('executor', [{ type: 'patch', payload: { diff: '+cache impl' } }]),
        critic: createMockRole('critic', [
          { type: 'review', payload: { opinion: 'looks good' } },
          { type: 'review', payload: { opinion: 'agreed' } },
          { type: 'approval', payload: { result: 'consensus reached' } },
        ]),
        verifier: createMockRole('verifier', [{ type: 'verification', payload: { testsPass: true } }]),
      },
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe('debate');
    expect(result.roleStats.critic.invocations).toBe(3);
  });
});

// ── 边界情况 ──

describe('Edge cases', () => {
  test('7. 空 targetFiles → error', async () => {
    const emptyTask: TaskContext = { ...baseTask, targetFiles: [] };
    const result = await orchestrate(emptyTask);
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── recommendMode ──

describe('recommendMode', () => {
  test('8. 单文件非 bug → linear', () => {
    expect(recommendMode({
      taskId: 't', description: 'Add feature', targetFiles: ['src/a.ts'], cwd: '/', existingTests: [],
    })).toBe('linear');
  });

  test('9. 多文件 ≥3 → map-reduce', () => {
    expect(recommendMode({
      taskId: 't', description: 'Refactor modules', targetFiles: ['a.ts', 'b.ts', 'c.ts'], cwd: '/', existingTests: [],
    })).toBe('map-reduce');
  });

  test('10. bug + existingTests → reflexion', () => {
    expect(recommendMode({
      taskId: 't', description: 'Fix null pointer bug', targetFiles: ['src/a.ts'], cwd: '/', existingTests: ['test/a.test.ts'],
    })).toBe('reflexion');
  });

  test('11. design → debate', () => {
    expect(recommendMode({
      taskId: 't', description: 'Design new caching strategy', targetFiles: ['src/cache.ts'], cwd: '/', existingTests: [],
    })).toBe('debate');
  });
});

// ── formatOrchestrationReport ──

describe('formatOrchestrationReport', () => {
  const baseStats = {
    planner: { invocations: 1, totalDurationMs: 100, totalTokens: { input: 500, output: 200 } },
    executor: { invocations: 1, totalDurationMs: 200, totalTokens: { input: 800, output: 500 } },
    critic: { invocations: 1, totalDurationMs: 150, totalTokens: { input: 600, output: 100 } },
    verifier: { invocations: 1, totalDurationMs: 100, totalTokens: { input: 400, output: 50 } },
  };

  test('12. 成功结果含 SUCCESS', () => {
    const report = formatOrchestrationReport({
      success: true, mode: 'linear', finalPatch: '+added', messageLog: [],
      roleStats: baseStats, criticRejectionRate: 0, totalDurationMs: 550, totalTurns: 4,
    });
    expect(report).toContain('SUCCESS');
    expect(report).toContain('linear');
  });

  test('13. 失败结果含 FAILED + rejection reason', () => {
    const report = formatOrchestrationReport({
      success: false, mode: 'reflexion',
      messageLog: [{
        from: 'critic', to: 'orchestrator', type: 'rejection',
        payload: { reason: 'Missing null check' }, timestamp: 1000, turnIndex: 3,
      }],
      roleStats: baseStats, criticRejectionRate: 1.0, totalDurationMs: 800, totalTurns: 5,
      error: 'Exhausted reflexion loops',
    });
    expect(report).toContain('FAILED');
    expect(report).toContain('Missing null check');
  });
});

// ── createRole ──

describe('createRole', () => {
  test('14. planner 默认 reasoner', () => {
    const role = createRole('planner');
    expect(role.config.name).toBe('planner');
    expect(role.config.modelPreference).toBe('reasoner');
  });

  test('15. executor 默认 chat', () => {
    const role = createRole('executor');
    expect(role.config.name).toBe('executor');
    expect(role.config.modelPreference).toBe('chat');
  });
});
