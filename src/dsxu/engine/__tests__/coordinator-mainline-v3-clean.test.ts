import { describe, expect, test } from 'bun:test';
import { join } from 'path';
import { createCoordinatorV1, createSimpleRoleRouting, buildCoordinatorMainlineEnvelope } from '../coordinator-v1';
import { createQueryLoopCoordinatorState, consumeCoordinatorInQueryLoop, projectCoordinatorStateToNextRound } from '../query-loop';
import { createGearStrategyState, applyCoordinatorSignalToGearStrategy } from '../gear-box';
import { createMainlineSessionCoordinatorState, applyCoordinatorProtocolToSession } from '../session';
import { consumeCoordinatorSignalsForRecovery } from '../recovery';
import { createCoordinatorMainlinePorts, createCoordinatorMainlineRuntime } from '../runtime-core';

const taskId = 'v10-2d-mainline-task';

function buildProtocolFixture() {
  const coordinator = createCoordinatorV1();

  coordinator.createForkPlan(
    taskId,
    [
      {
        branchId: 'b-read',
        task: 'read context',
        role: 'explorer',
        goal: 'collect evidence',
        accessMode: 'read-only',
        runMode: 'parallel',
        executionStrategy: 'scan and summarize',
        dependencies: [],
      },
      {
        branchId: 'b-write',
        task: 'implement',
        role: 'implementer',
        goal: 'make change',
        accessMode: 'write',
        runMode: 'parallel',
        executionStrategy: 'single writer',
        dependencies: ['b-read'],
      },
    ],
    {
      strategy: {
        name: 'parallel-first',
        executionMode: 'parallel',
        maxParallelism: 2,
        rationale: 'mainline integration',
      },
      allowReadOnlyParallelism: true,
      writeBranchConstraint: 'single-writer',
      orderingRules: ['read first', 'single write'],
      fallbackPolicy: 'defer-write',
    },
  );

  const forkDispatch = coordinator.dispatchFork(taskId);
  coordinator.updateBranchProgress('b-read', 100, 'completed');
  coordinator.updateBranchProgress('b-write', 40, 'running');

  const merge = coordinator.mergeCandidates(
    taskId,
    [
      { branchId: 'b-read', summary: 'ok', score: 90, confidence: 0.9, status: 'completed', artifacts: ['r1'] },
      { branchId: 'b-write', summary: 'wip', score: 50, confidence: 0.6, status: 'running', artifacts: ['w1'] },
    ],
    {
      mode: 'winner-takes-all',
      minimumScore: 60,
      confidenceFloor: 0.5,
      allowPartialMerge: false,
      conflictPreference: 'prefer-high-confidence',
    },
  );

  const abort = coordinator.abortBranch('b-write', 'quality-gate-failed', {
    scope: 'local',
    affectedBranches: ['b-write'],
    blocksMerge: false,
    requiresEscalation: false,
  });

  const escalation = coordinator.escalate('merge-deadlock', 'human', 'high');

  const protocol = coordinator.getProtocol(taskId);
  const routing = createSimpleRoleRouting('mainline task', 'coordinator-in-mainline');
  const decision = routing.decision;
  const envelope = buildCoordinatorMainlineEnvelope(taskId, decision, protocol);

  return { protocol, decision, envelope, forkDispatch, merge, abort, escalation };
}

describe('V10-2D coordinator mainline clean checks', () => {
  test('1) query-loop can consume CoordinatorDecision', () => {
    const { envelope } = buildProtocolFixture();
    const state = createQueryLoopCoordinatorState(taskId);
    const next = consumeCoordinatorInQueryLoop(state, envelope);
    expect(next.latestDecision?.taskId).toBe(envelope.decision.taskId);
    expect(next.latestDecision?.roleAssignments.length).toBeGreaterThan(0);
  });

  test('2) query-loop can receive lifecycle outputs', () => {
    const { envelope } = buildProtocolFixture();
    const state = createQueryLoopCoordinatorState(taskId);
    const next = consumeCoordinatorInQueryLoop(state, envelope);
    expect(next.latestSignals.some((s) => s.type === 'fork')).toBe(true);
    expect(next.latestSignals.some((s) => s.type === 'merge' || s.type === 'abort' || s.type === 'escalate')).toBe(true);
  });

  test('3) gear-box strategy changes based on coordinator signal', () => {
    let strategy = createGearStrategyState();
    const before = strategy.lane;
    strategy = applyCoordinatorSignalToGearStrategy(strategy, { type: 'escalate', payload: { priority: 'critical' } });
    expect(before).toBe('balanced');
    expect(strategy.lane).toBe('escalation-guard');
    expect(strategy.maxParallel).toBe(1);
  });

  test('4) session holds MultiAgentRuntimeState-like structure', () => {
    const { protocol } = buildProtocolFixture();
    const sessionState = createMainlineSessionCoordinatorState(taskId);
    const updated = applyCoordinatorProtocolToSession(sessionState, protocol);
    expect(updated.runtimeState.taskId).toBe(taskId);
    expect(updated.runtimeState.agents.length).toBeGreaterThan(0);
  });

  test('5) session holds lifecycle checkpoint/summary', () => {
    const { protocol } = buildProtocolFixture();
    const sessionState = createMainlineSessionCoordinatorState(taskId);
    const updated = applyCoordinatorProtocolToSession(sessionState, protocol);
    expect(updated.latestCheckpoint?.taskId).toBe(taskId);
    expect(updated.lifecycleSummary?.totalBranches).toBeGreaterThan(0);
  });

  test('6) recovery consumes branch failure/merge conflict/escalate signal', () => {
    const out = consumeCoordinatorSignalsForRecovery({
      branchFailures: [{ branchId: 'b-write', reason: 'quality-gate-failed' }],
      mergeConflicts: [{ conflictId: 'c-1', branches: ['a', 'b'], severity: 'high' }],
      escalations: [{ decisionId: 'e-1', reason: 'merge-deadlock', priority: 'high' }],
    });
    expect(out.action).toBe('replan-merge');
    expect(out.suggestions.length).toBeGreaterThan(0);
  });

  test('7) runtime-core exports official coordinator mainline integration surface', () => {
    const ports = createCoordinatorMainlinePorts();
    const runtime = createCoordinatorMainlineRuntime();
    expect(typeof ports.consumeQueryLoop).toBe('function');
    expect(typeof ports.applyGearStrategy).toBe('function');
    expect(runtime.coordinator).toBeDefined();
  });

  test('8) does not introduce a second main loop implementation', async () => {
    const queryLoopText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/query-loop.ts')).text();
    expect(queryLoopText.includes('query-loop-v2')).toBe(false);
  });

  test('9) does not introduce second session/recovery/coordinator implementations', async () => {
    const sessionText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/session.ts')).text();
    const recoveryText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/recovery/index.ts')).text();
    const coordinatorText = await Bun.file(join(process.cwd(), 'src/dsxu/engine/coordinator-v1.ts')).text();

    expect(sessionText.includes('session-v2.ts')).toBe(false);
    expect(recoveryText.includes('recovery-v2.ts')).toBe(false);
    expect(coordinatorText.includes('coordinator-v2.ts')).toBe(false);
  });

  test('10) verifies real mainline consumption, not just object existence', () => {
    const { envelope } = buildProtocolFixture();
    const ports = createCoordinatorMainlinePorts();

    const q0 = createQueryLoopCoordinatorState(taskId);
    const q1 = ports.consumeQueryLoop(q0, envelope);
    const projected = projectCoordinatorStateToNextRound(q1);

    const g0 = createGearStrategyState();
    const signal = envelope.signals.find((s) => s.type === 'abort') || envelope.signals[0];
    const g1 = ports.applyGearStrategy(g0, signal);

    const s0 = createMainlineSessionCoordinatorState(taskId);
    const s1 = ports.persistSessionState(s0, envelope.protocol);

    const r1 = ports.buildRecoveryDecision({
      branchFailures: [{ branchId: 'b-write', reason: 'quality-gate-failed' }],
      mergeConflicts: [],
      escalations: [],
    });

    expect(projected.nextRoundInput.hasCoordinatorDecision).toBe(true);
    expect(g1.reason).not.toBe(g0.reason);
    expect(s1.recoveryHints.length).toBeGreaterThanOrEqual(1);
    expect(r1.action).toBe('retry-branch');
  });
});
