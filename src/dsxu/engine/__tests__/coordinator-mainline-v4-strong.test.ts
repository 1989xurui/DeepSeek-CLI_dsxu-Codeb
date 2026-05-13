import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { createCoordinatorV1, createSimpleRoleRouting, buildCoordinatorMainlineEnvelope } from '../coordinator-v1';
import { createQueryLoopCoordinatorState, consumeCoordinatorInQueryLoop, projectCoordinatorStateToNextRound } from '../query-loop';
import { createGearStrategyState, applyCoordinatorSignalToGearStrategy } from '../gear-box';
import { createMainlineSessionCoordinatorState, applyCoordinatorProtocolToSession } from '../session';
import { consumeCoordinatorSignalsForRecovery } from '../recovery';
import { createCoordinatorMainlinePorts, createCoordinatorMainlineRuntime } from '../runtime-core';

const taskId = 'v10-2d-r3-strong-task';

function buildStrongFixture() {
  const coordinator = createCoordinatorV1();

  coordinator.createForkPlan(
    taskId,
    [
      {
        branchId: 'read-a',
        task: 'collect context',
        role: 'explorer',
        goal: 'evidence',
        accessMode: 'read-only',
        runMode: 'parallel',
        executionStrategy: 'scan and summarize',
        dependencies: [],
      },
      {
        branchId: 'write-a',
        task: 'implement path A',
        role: 'implementer',
        goal: 'ship candidate A',
        accessMode: 'write',
        runMode: 'parallel',
        executionStrategy: 'bounded writer',
        dependencies: ['read-a'],
      },
      {
        branchId: 'write-b',
        task: 'implement path B',
        role: 'specialist',
        goal: 'ship candidate B',
        accessMode: 'write',
        runMode: 'parallel',
        executionStrategy: 'alternative writer',
        dependencies: ['read-a'],
      },
    ],
    {
      strategy: {
        name: 'parallel-first',
        executionMode: 'parallel',
        maxParallelism: 3,
        rationale: 'speed with guarded writers',
      },
      allowReadOnlyParallelism: true,
      writeBranchConstraint: 'single-writer',
      orderingRules: ['read can run parallel', 'writer serialized'],
      fallbackPolicy: 'defer-write',
    },
  );

  const fork = coordinator.dispatchFork(taskId);
  coordinator.updateBranchProgress('read-a', 100, 'completed');
  coordinator.updateBranchProgress('write-a', 55, 'running');
  coordinator.updateBranchProgress('write-b', 10, 'blocked');

  const merge = coordinator.mergeCandidates(
    taskId,
    [
      { branchId: 'read-a', summary: 'stable context', score: 92, confidence: 0.93, status: 'completed', artifacts: ['c1'] },
      { branchId: 'write-a', summary: 'partial impl', score: 62, confidence: 0.71, status: 'running', artifacts: ['i1'] },
      { branchId: 'write-b', summary: 'low quality', score: 40, confidence: 0.45, status: 'failed', artifacts: ['i2'] },
    ],
    {
      mode: 'discard-low-quality',
      minimumScore: 60,
      confidenceFloor: 0.6,
      allowPartialMerge: false,
      conflictPreference: 'manual',
    },
  );

  const abort = coordinator.abortBranch('write-b', 'quality-gate-failed', {
    scope: 'global',
    affectedBranches: ['write-a', 'write-b'],
    blocksMerge: true,
    requiresEscalation: true,
  });

  const escalation = coordinator.escalate('merge-deadlock', 'human', 'critical');

  const protocol = coordinator.getProtocol(taskId);
  const routing = createSimpleRoleRouting('strong-mainline-task', 'coordinator-result-enters-mainline');
  const decision = routing.decision;
  const envelope = buildCoordinatorMainlineEnvelope(taskId, decision, protocol);

  return { coordinator, protocol, decision, envelope, fork, merge, abort, escalation };
}

describe('V10-2D-R3 coordinator strong mainline checks', () => {
  test('1) query-loop consumes CoordinatorDecision', () => {
    const { envelope } = buildStrongFixture();
    const q0 = createQueryLoopCoordinatorState(taskId);
    const q1 = consumeCoordinatorInQueryLoop(q0, envelope);
    expect(q1.latestDecision?.taskId).toBe(envelope.decision.taskId);
    expect(q1.latestDecision?.roleAssignments.length).toBeGreaterThan(0);
  });

  test('2) query-loop receives lifecycle outputs', () => {
    const { envelope } = buildStrongFixture();
    const q0 = createQueryLoopCoordinatorState(taskId);
    const q1 = consumeCoordinatorInQueryLoop(q0, envelope);
    expect(q1.latestSignals.some((s) => s.type === 'fork')).toBe(true);
    expect(q1.latestSignals.some((s) => s.type === 'merge')).toBe(true);
    expect(q1.latestSignals.some((s) => s.type === 'abort')).toBe(true);
    expect(q1.latestSignals.some((s) => s.type === 'escalate')).toBe(true);
  });

  test('3) next-round input is influenced by coordinator result', () => {
    const { envelope } = buildStrongFixture();
    const q0 = createQueryLoopCoordinatorState(taskId);
    const q1 = consumeCoordinatorInQueryLoop(q0, envelope);
    const projected = projectCoordinatorStateToNextRound(q1);

    expect(projected.nextRoundInput.hasCoordinatorDecision).toBe(true);
    expect(projected.nextRoundInput.lastLifecycleSignal).toBe('escalate');
    expect(projected.nextRoundInput.recoveryHintCount).toBeGreaterThan(0);
  });

  test('4) gear-box changes strategy by coordinator signal', () => {
    const base = createGearStrategyState();
    const afterFork = applyCoordinatorSignalToGearStrategy(base, { type: 'fork', payload: { runnableBranches: ['a', 'b'] } });
    const afterAbort = applyCoordinatorSignalToGearStrategy(afterFork, { type: 'abort', payload: { scope: { scope: 'global' } } });

    expect(afterFork.lane).toBe('parallel-first');
    expect(afterAbort.lane).toBe('safe-recovery');
  });

  test('5) gear-box is not static strategy', () => {
    const s0 = createGearStrategyState();
    const s1 = applyCoordinatorSignalToGearStrategy(s0, { type: 'merge', payload: { outcome: 'conflict' } });
    const s2 = applyCoordinatorSignalToGearStrategy(s0, { type: 'merge', payload: { outcome: 'winner' } });

    expect(s1.reason).not.toBe(s2.reason);
    expect(s1.maxParallel).not.toBe(s2.maxParallel);
  });

  test('6) session holds MultiAgentRuntimeState', () => {
    const { protocol } = buildStrongFixture();
    const s0 = createMainlineSessionCoordinatorState(taskId);
    const s1 = applyCoordinatorProtocolToSession(s0, protocol);

    expect(s1.runtimeState.taskId).toBe(taskId);
    expect(s1.runtimeState.agents.length).toBeGreaterThanOrEqual(2);
  });

  test('7) session holds checkpoint/summary/recovery hint', () => {
    const { protocol } = buildStrongFixture();
    const s0 = createMainlineSessionCoordinatorState(taskId);
    const s1 = applyCoordinatorProtocolToSession(s0, protocol);

    expect(s1.latestCheckpoint?.taskId).toBe(taskId);
    expect(s1.lifecycleSummary?.totalBranches).toBeGreaterThan(0);
    expect(s1.recoveryHints.length).toBeGreaterThan(0);
  });

  test('8) recovery consumes branch failure/merge conflict/escalate', () => {
    const out = consumeCoordinatorSignalsForRecovery({
      branchFailures: [{ branchId: 'write-b', reason: 'quality-gate-failed' }],
      mergeConflicts: [{ conflictId: 'mc-1', branches: ['write-a', 'write-b'], severity: 'high' }],
      escalations: [{ decisionId: 'esc-1', reason: 'merge-deadlock', priority: 'critical' }],
    });

    expect(out.action).toBe('escalate-human');
    expect(out.reasons.length).toBeGreaterThan(0);
  });

  test('9) recovery outputs structured decision', () => {
    const out = consumeCoordinatorSignalsForRecovery({
      branchFailures: [{ branchId: 'write-b', reason: 'quality-gate-failed' }],
      mergeConflicts: [],
      escalations: [],
    });

    expect(out).toHaveProperty('action');
    expect(out).toHaveProperty('reasons');
    expect(out).toHaveProperty('suggestions');
    expect(out).toHaveProperty('severity');
  });

  test('10) runtime-core exports official coordinator mainline interface', () => {
    const ports = createCoordinatorMainlinePorts();
    const runtime = createCoordinatorMainlineRuntime();

    expect(typeof ports.consumeQueryLoop).toBe('function');
    expect(typeof ports.applyGearStrategy).toBe('function');
    expect(typeof ports.persistSessionState).toBe('function');
    expect(typeof ports.buildRecoveryDecision).toBe('function');
    expect(runtime.coordinator).toBeDefined();
  });

  test('11) still single main loop/session/recovery/coordinator', async () => {
    const queryLoopText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/query-loop.ts')).text();
    const sessionText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/session.ts')).text();
    const recoveryText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/recovery/index.ts')).text();
    const coordinatorText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/coordinator-v1.ts')).text();

    expect(queryLoopText.includes('query-loop-v2')).toBe(false);
    expect(sessionText.includes('session-v2')).toBe(false);
    expect(recoveryText.includes('recovery-v2')).toBe(false);
    expect(coordinatorText.includes('coordinator-v2')).toBe(false);
  });

  test('12) verifies real mainline consumption, not object existence', () => {
    const { envelope } = buildStrongFixture();
    const ports = createCoordinatorMainlinePorts();

    const q0 = createQueryLoopCoordinatorState(taskId);
    const q1 = ports.consumeQueryLoop(q0, envelope);
    const round = projectCoordinatorStateToNextRound(q1);

    const g0 = createGearStrategyState();
    const g1 = ports.applyGearStrategy(g0, envelope.signals.find((s) => s.type === 'fork')!);

    const s0 = createMainlineSessionCoordinatorState(taskId);
    const s1 = ports.persistSessionState(s0, envelope.protocol);

    const r1 = ports.buildRecoveryDecision({
      branchFailures: [{ branchId: 'write-b', reason: 'quality-gate-failed' }],
      mergeConflicts: [],
      escalations: [],
    });

    expect(round.nextRoundInput.parallelTaskIds.length + round.nextRoundInput.sequentialTaskIds.length).toBeGreaterThan(0);
    expect(g1.reason).not.toBe(g0.reason);
    expect(s1.runtimeState.updatedAt).toBeGreaterThan(0);
    expect(r1.action).toBe('retry-branch');
  });
});
