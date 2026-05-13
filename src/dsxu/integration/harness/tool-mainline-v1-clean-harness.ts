import { expect, test } from 'bun:test';
import { consumeToolSignalsInCoordinator } from '../../engine/coordinator-v1';
import { createQueryLoopToolState, consumeToolDecisionInQueryLoop, projectToolStateToNextRound } from '../../engine/query-loop';
import { consumeToolMainlineForRecovery } from '../../engine/recovery';
import { createToolMainlineRuntime } from '../../engine/runtime-core';
import { applyToolMainlineToSession, createToolMainlineSessionState } from '../../engine/session';

test('V10-4 Phase D harness: tool mainline wiring is consumable', () => {
  const runtime = createToolMainlineRuntime();
  const ports = runtime.ports;

  const q0 = createQueryLoopToolState('h-task');
  const q1 = ports.consumeQueryLoopToolDecision(q0, {
    gateDecision: { toolId: 'tool-write', gateDecision: 'require_confirmation', executionDecision: 'execute_guarded', riskLevel: 'high' },
    executionResult: { toolId: 'tool-write', status: 'running', summary: 'guarded run' },
  });
  const nextRound = projectToolStateToNextRound(q1);

  const coord = ports.consumeCoordinatorToolSignals({
    taskId: 'h-task',
    selectedToolIds: ['tool-write'],
    gate: [{ toolId: 'tool-write', gateDecision: 'require_confirmation', riskLevel: 'high' }],
    executions: [{ toolId: 'tool-write', status: 'succeeded', summary: 'done' }],
  });

  const session = ports.persistToolSessionState(createToolMainlineSessionState('h-task'), {
    selectedToolIds: ['tool-write'],
    gateDecisions: [{ toolId: 'tool-write', decision: 'require_confirmation', riskLevel: 'high', approvalTraceId: 'trace-1' }],
    executionResults: [{ toolId: 'tool-write', status: 'succeeded', summary: 'done' }],
  });

  const recovery = ports.buildToolRecoveryDecision({
    failures: [],
    blocked: [],
    conflicts: [],
  });

  expect(nextRound.guardedMode).toBeTrue();
  expect(coord.coordinationHints.length).toBeGreaterThan(0);
  expect(session.executionSnapshot.gateDecisions.length).toBe(1);
  expect(recovery.action).toBe('continue');

  const directRecovery = consumeToolMainlineForRecovery({
    failures: [{ toolId: 'tool-write', class: 'conflict', summary: 'race' }],
    blocked: [],
    conflicts: [{ toolIds: ['tool-write', 'tool-sync'], reason: 'shared file' }],
  });
  expect(directRecovery.action).toBe('reselect-tools');
  expect(typeof applyToolMainlineToSession).toBe('function');
  expect(typeof consumeToolSignalsInCoordinator).toBe('function');
  expect(typeof consumeToolDecisionInQueryLoop).toBe('function');
});
