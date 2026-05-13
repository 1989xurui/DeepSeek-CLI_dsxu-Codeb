import { describe, expect, test } from 'bun:test';
import { CoordinatorV1 } from '../coordinator-v1';
import type { MergeCandidate } from '../coordinator-types-v1';

const taskId = 'task-v10-2c-r4';

function createCoordinatorWithFork() {
  const coordinator = new CoordinatorV1();
  const plan = coordinator.createForkPlan(
    taskId,
    [
      {
        branchId: 'branch-read',
        task: 'Collect references',
        role: 'explorer',
        goal: 'build context',
        accessMode: 'read-only',
        runMode: 'parallel',
        executionStrategy: 'scan files and summarize',
        dependencies: [],
      },
      {
        branchId: 'branch-write-a',
        task: 'Implement candidate A',
        role: 'implementer',
        goal: 'ship approach A',
        accessMode: 'write',
        runMode: 'parallel',
        executionStrategy: 'apply bounded changes',
        dependencies: [],
      },
      {
        branchId: 'branch-write-b',
        task: 'Implement candidate B',
        role: 'specialist',
        goal: 'ship approach B',
        accessMode: 'write',
        runMode: 'parallel',
        executionStrategy: 'apply alternative changes',
        dependencies: ['branch-read'],
      },
    ],
    {
      strategy: {
        name: 'parallel-first',
        executionMode: 'parallel',
        maxParallelism: 3,
        rationale: 'speed up research and implementation branches',
      },
      allowReadOnlyParallelism: true,
      writeBranchConstraint: 'single-writer',
      orderingRules: ['read-only first', 'single writer at a time'],
      fallbackPolicy: 'defer-write',
    },
  );

  return { coordinator, plan };
}

describe('V10-2C-R4 lifecycle protocol clean checks', () => {
  test('1) fork protocol objects exist', () => {
    const { plan } = createCoordinatorWithFork();
    expect(plan.strategy.name).toBe('parallel-first');
    expect(plan.policy.writeBranchConstraint).toBe('single-writer');
    expect(plan.branches.length).toBe(3);
  });

  test('2) at least two branches can coexist with independent role/goal/state', () => {
    const { coordinator, plan } = createCoordinatorWithFork();
    const dispatch = coordinator.dispatchFork(taskId);
    expect(dispatch.runnableBranches.length).toBeGreaterThanOrEqual(2);

    const readBranch = plan.branches.find((b) => b.branchId === 'branch-read');
    const writeBranch = plan.branches.find((b) => b.branchId === 'branch-write-a');
    expect(readBranch?.role).toBe('explorer');
    expect(writeBranch?.role).toBe('implementer');
    expect(readBranch?.goal).not.toBe(writeBranch?.goal);

    const stateA = coordinator.getBranchState('branch-read');
    const stateB = coordinator.getBranchState('branch-write-a');
    expect(stateA?.status).toBe('queued');
    expect(stateB?.status).toBe('queued');
  });

  test('3) merge protocol objects exist', () => {
    const { coordinator } = createCoordinatorWithFork();
    coordinator.dispatchFork(taskId);
    coordinator.updateBranchProgress('branch-read', 100, 'completed');
    coordinator.updateBranchProgress('branch-write-a', 90, 'running');

    const resultA = coordinator.collectIntermediateResult({
      branchId: 'branch-read',
      summary: 'reference summary',
      reusable: true,
      confidenceProfile: { confidence: 0.9, qualitySignals: ['stable'], risks: [] },
      originTrace: {
        sourceBranchId: 'branch-read',
        sourceTask: 'Collect references',
        generatedAt: Date.now(),
        generatorRole: 'explorer',
        evidenceRefs: ['doc-1'],
      },
    });
    expect(resultA.resultId.length).toBeGreaterThan(0);

    const candidates = coordinator.buildMergeCandidates(['branch-read', 'branch-write-a']);
    expect(candidates.length).toBe(2);
    expect(candidates[0].branchId.length).toBeGreaterThan(0);
  });

  test('4) merge can express winner/merged/discarded/conflict', () => {
    const { coordinator } = createCoordinatorWithFork();
    const baseCandidates: MergeCandidate[] = [
      { branchId: 'branch-read', summary: 'A', score: 92, confidence: 0.92, status: 'completed', artifacts: ['a'] },
      { branchId: 'branch-write-a', summary: 'B', score: 84, confidence: 0.87, status: 'completed', artifacts: ['b'] },
      { branchId: 'branch-write-b', summary: 'C', score: 40, confidence: 0.3, status: 'failed', artifacts: ['c'] },
    ];

    const winner = coordinator.mergeCandidates(taskId, baseCandidates, {
      mode: 'winner-takes-all',
      minimumScore: 60,
      confidenceFloor: 0.5,
      allowPartialMerge: false,
      conflictPreference: 'prefer-high-confidence',
    });
    expect(winner.outcome).toBe('winner');

    const merged = coordinator.mergeCandidates(taskId, baseCandidates, {
      mode: 'combine-best',
      minimumScore: 80,
      confidenceFloor: 0.8,
      allowPartialMerge: true,
      conflictPreference: 'prefer-high-confidence',
    });
    expect(merged.outcome).toBe('merged');

    const discarded = coordinator.mergeCandidates(taskId, baseCandidates, {
      mode: 'discard-low-quality',
      minimumScore: 95,
      confidenceFloor: 0.95,
      allowPartialMerge: false,
      conflictPreference: 'manual',
    });
    expect(discarded.outcome).toBe('discarded');

    const conflict = coordinator.mergeCandidates(taskId, [
      { branchId: 'x', summary: 'x', score: 80, confidence: 0.9, status: 'completed', artifacts: [] },
      { branchId: 'y', summary: 'y', score: 78, confidence: 0.88, status: 'completed', artifacts: [] },
    ], {
      mode: 'manual-on-conflict',
      minimumScore: 60,
      confidenceFloor: 0.5,
      allowPartialMerge: false,
      conflictPreference: 'manual',
    });
    expect(conflict.outcome).toBe('conflict');
  });

  test('5) abort reason and impact scope are distinguishable', () => {
    const { coordinator } = createCoordinatorWithFork();
    coordinator.dispatchFork(taskId);
    const abort = coordinator.abortBranch('branch-write-a', 'quality-gate-failed', {
      scope: 'local',
      affectedBranches: ['branch-write-a'],
      blocksMerge: false,
      requiresEscalation: false,
    });

    expect(abort.reason).toBe('quality-gate-failed');
    expect(abort.scope.scope).toBe('local');
    expect(abort.scope.affectedBranches).toContain('branch-write-a');
  });

  test('6) escalation decision/target/priority are distinguishable', () => {
    const { coordinator } = createCoordinatorWithFork();
    const esc = coordinator.escalate('merge-deadlock', 'human', 'high');
    expect(esc.reason).toBe('merge-deadlock');
    expect(esc.target).toBe('human');
    expect(esc.priority).toBe('high');
    expect(esc.actionPlan.immediateActions.length).toBeGreaterThan(0);
  });

  test('7) intermediate result collection has structured origin/confidence/reuse', () => {
    const { coordinator } = createCoordinatorWithFork();
    coordinator.dispatchFork(taskId);

    const collected = coordinator.collectIntermediateResult({
      branchId: 'branch-read',
      summary: 'context bundle',
      reusable: true,
      confidenceProfile: { confidence: 0.85, qualitySignals: ['cross-checked'], risks: ['staleness'] },
      originTrace: {
        sourceBranchId: 'branch-read',
        sourceTask: 'Collect references',
        generatedAt: Date.now(),
        generatorRole: 'explorer',
        evidenceRefs: ['ref-1', 'ref-2'],
      },
    });

    const reuse = coordinator.decideResultReuse(collected.resultId, ['branch-write-a']);
    expect(collected.originTrace.sourceBranchId).toBe('branch-read');
    expect(collected.confidenceProfile.confidence).toBeGreaterThan(0.8);
    expect(reuse.reusable).toBe(true);
  });

  test('8) lifecycle recovery hints exist for fork/merge/abort/escalate', () => {
    const { coordinator } = createCoordinatorWithFork();
    const forkHints = coordinator.createForkRecoveryHints(taskId, ['branch-write-b']);

    const mergeHint = coordinator.createMergeRecoveryHint([
      {
        conflictId: 'conf-1',
        branches: ['branch-write-a', 'branch-write-b'],
        dimension: 'logic',
        description: 'same target changed differently',
        severity: 'high',
        resolutionOptions: ['manual-review'],
      },
    ]);

    coordinator.dispatchFork(taskId);
    const abort = coordinator.abortBranch('branch-write-a', 'manual-stop', {
      scope: 'global',
      affectedBranches: ['branch-write-a', 'branch-write-b'],
      blocksMerge: true,
      requiresEscalation: true,
    });
    const esc = coordinator.escalate('human-approval-needed', 'specialist', 'critical');

    const protocol = coordinator.getProtocol(taskId);
    expect(forkHints[0].stage).toBe('fork');
    expect(mergeHint.stage).toBe('merge');
    expect(abort.recovery.length).toBeGreaterThan(0);
    expect(esc.actionPlan.exitCriteria.length).toBeGreaterThan(0);
    expect(protocol.recoveryHints.some((h) => h.stage === 'escalate')).toBe(true);
  });

  test('9) lifecycle transitions/checkpoints/summary are recorded', () => {
    const { coordinator } = createCoordinatorWithFork();
    coordinator.dispatchFork(taskId);
    coordinator.updateBranchProgress('branch-read', 100, 'completed');
    const protocol = coordinator.getProtocol(taskId);

    expect(protocol.transitions.length).toBeGreaterThan(0);
    expect(protocol.checkpoints.length).toBeGreaterThan(0);
    expect(protocol.summary.totalBranches).toBeGreaterThanOrEqual(2);
  });

  test('10) protocol stays in V1 and does not wire main-link modules', async () => {
    const text = await Bun.file('D:/DSXU-code/src/dsxu/engine/coordinator-v1.ts').text();
    expect(text.includes('coordinator-v2')).toBe(false);
    expect(text.includes('coordinator-lifecycle-v2')).toBe(false);
    expect(text.includes('coordinator-full')).toBe(false);
    expect(text.includes('query-loop')).toBe(false);
    expect(text.includes('gear-box')).toBe(false);
    expect(text.includes('session')).toBe(false);
    expect(text.includes('runtime-core')).toBe(false);
    expect(text.includes('recovery/')).toBe(false);
  });
});
