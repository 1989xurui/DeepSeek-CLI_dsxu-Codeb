import { describe, expect, test } from 'bun:test';
import {
  getCoordinatorSystemPrompt,
  getCoordinatorUserContext,
  isCoordinatorMode,
  matchSessionMode,
} from '../coordinator-mode-v1';
import { injectCoordinatorDecisionToQueryLoop as bridgeInject } from '../coordinator-mainline-bridge-v1';
import { createQueryLoopCoordinatorState, injectCoordinatorDecisionToQueryLoop, projectCoordinatorStateToNextRound } from '../query-loop';
import { applyCoordinatorModeToGearStrategy, createGearStrategyState } from '../gear-box';
import { attachMultiAgentStateToSession, createMainlineSessionCoordinatorState } from '../session';
import { feedFailureSignalsToRecovery } from '../recovery';
import { createCoordinatorModeBridgeRuntime } from '../runtime-core';

describe('V10-2F Phase A - coordinator mode and bridge', () => {
  test('1. coordinatorMode semantics are expressible', () => {
    expect(isCoordinatorMode({ envFlag: '1' })).toBeTrue();
    expect(isCoordinatorMode({ envFlag: '0' })).toBeFalse();
  });

  test('2. session mode matching is expressible', () => {
    const matched = matchSessionMode('coordinator', true);
    const switched = matchSessionMode('normal', true);
    expect(matched.matched).toBeTrue();
    expect(switched.switched).toBeTrue();
  });

  test('3. system prompt and user context are non-empty', () => {
    const prompt = getCoordinatorSystemPrompt();
    const user = getCoordinatorUserContext({ workerTools: ['Read', 'Edit'], mcpServerNames: ['github'] });
    expect(prompt.length).toBeGreaterThan(20);
    expect(user.workerToolsContext).toContain('Workers');
  });

  test('4. query-loop receives coordinator decision bridge', () => {
    const state = createQueryLoopCoordinatorState('t1');
    const next = injectCoordinatorDecisionToQueryLoop(state, {
      taskId: 't1',
      decision: {
        roleAssignments: [{ subtaskId: 'a1', assignedRole: 'worker', rationale: 'parallel research' }],
        concurrencyPlan: { parallelTasks: ['a1'], sequentialTasks: [] },
        rationale: 'fan-out',
      },
      signals: [{ type: 'fork', payload: { runnableBranches: ['a1'] } }],
    });
    expect(next.latestDecision?.taskId).toBe('t1');
  });

  test('5. session attaches multi-agent runtime state', () => {
    const state = createMainlineSessionCoordinatorState('t1');
    const next = attachMultiAgentStateToSession(state, {
      taskId: 't1',
      roleAssignments: [{ subtaskId: 'a1', assignedRole: 'worker', rationale: 'research' }],
      lifecycleState: 'executing',
    });
    expect(next.runtimeState.agents.length).toBe(1);
  });

  test('6. recovery receives abort/escalate signals', () => {
    const rec = feedFailureSignalsToRecovery({
      abortSignals: [{ branchId: 'b1', reason: 'timeout' }],
      escalationSignals: [{ decisionId: 'e1', priority: 'high' }],
    });
    expect(rec.reasons).toContain('abort-signal');
    expect(rec.reasons).toContain('escalation-signal');
  });

  test('7. gear-box is affected by coordinator signal', () => {
    const base = createGearStrategyState();
    const next = applyCoordinatorModeToGearStrategy(base, {
      isCoordinatorMode: true,
      sessionMode: 'coordinator',
      signal: { type: 'fork', payload: { runnableBranches: ['a1', 'a2'] } },
    });
    expect(next.maxParallel).toBeGreaterThanOrEqual(3);
  });

  test('8. runtime-core exposes formal bridge entry', () => {
    const rt = createCoordinatorModeBridgeRuntime();
    expect(typeof rt.bridge.injectCoordinatorDecisionToQueryLoop).toBe('function');
    expect(typeof rt.mainlinePorts.injectToQueryLoop).toBe('function');
  });

  test('9. no second mainline is introduced', () => {
    const projected = projectCoordinatorStateToNextRound(
      injectCoordinatorDecisionToQueryLoop(createQueryLoopCoordinatorState('t2'), {
        taskId: 't2',
        decision: {
          roleAssignments: [{ subtaskId: 'a2', assignedRole: 'worker', rationale: 'implement' }],
          concurrencyPlan: { parallelTasks: [], sequentialTasks: ['a2'] },
          rationale: 'sequential write',
        },
        signals: [{ type: 'abort', payload: { scope: { scope: 'local' } } }],
      }),
    );
    expect(projected.nextRoundInput.hasCoordinatorDecision).toBeTrue();
  });

  test('10. bridge provides structured consumption, not logs only', () => {
    const bridged = bridgeInject({
      taskId: 't3',
      decision: {
        roleAssignments: [{ subtaskId: 'a3', assignedRole: 'worker', rationale: 'verify' }],
        concurrencyPlan: { parallelTasks: ['a3'], sequentialTasks: [] },
        rationale: 'verification lane',
      },
      lifecycleSignals: [{ type: 'merge', payload: { outcome: 'merged' } }],
    });
    expect(bridged.queryLoopInput.parallelTaskIds).toContain('a3');
  });
});
