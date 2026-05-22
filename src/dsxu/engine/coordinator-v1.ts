import {
  AbortDecision,
  AbortImpactScope,
  AbortReason,
  AbortRecoverySuggestion,
  BranchExecutionState,
  BranchRecoveryHint,
  BranchStatus,
  CollectedIntermediateResult,
  CoordinationLifecycleCheckpoint,
  CoordinationLifecycleProtocol,
  CoordinationLifecycleSummary,
  EscalationActionPlan,
  EscalationDecision,
  EscalationPriority,
  EscalationReason,
  EscalationRecoveryHint,
  EscalationTarget,
  ForkBranchSpec,
  ForkCoordinationPolicy,
  ForkDispatchDecision,
  ForkExecutionPlan,
  LifecycleRecoveryHint,
  LifecycleStateTransition,
  MergeCandidate,
  MergeConflictDescriptor,
  MergeOutcomeTrace,
  MergeRecoveryHint,
  MergeResolutionPolicy,
  MergeResult,
  ResultConfidenceProfile,
  ResultOriginTrace,
  ResultReuseDecision,
} from './coordinator-types-v1';

export class CoordinatorV1 {
  private plans = new Map<string, ForkExecutionPlan>();
  private branchStates = new Map<string, BranchExecutionState>();
  private dispatches: ForkDispatchDecision[] = [];
  private intermediateResults: CollectedIntermediateResult[] = [];
  private reuseDecisions: ResultReuseDecision[] = [];
  private merges: MergeResult[] = [];
  private aborts: AbortDecision[] = [];
  private escalations: EscalationDecision[] = [];
  private recoveryHints: LifecycleRecoveryHint[] = [];
  private transitions: LifecycleStateTransition[] = [];
  private checkpoints: CoordinationLifecycleCheckpoint[] = [];

  private id(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private transition(entityType: 'branch' | 'lifecycle', entityId: string, fromState: string, toState: string, reason: string): void {
    this.transitions.push({
      transitionId: this.id('tr'),
      entityType,
      entityId,
      fromState,
      toState,
      reason,
      timestamp: Date.now(),
    });
  }

  private checkpoint(taskId: string, lifecycleState: CoordinationLifecycleCheckpoint['lifecycleState'], notes: string[]): void {
    const branchSnapshot: Record<string, BranchStatus> = {};
    for (const [branchId, state] of this.branchStates.entries()) {
      branchSnapshot[branchId] = state.status;
    }
    this.checkpoints.push({
      checkpointId: this.id('cp'),
      taskId,
      lifecycleState,
      branchSnapshot,
      notes,
      createdAt: Date.now(),
    });
  }

  private setBranchState(branchId: string, to: BranchStatus, reason?: string): BranchExecutionState {
    const current = this.branchStates.get(branchId);
    if (!current) {
      throw new Error(`unknown branch: ${branchId}`);
    }
    const next: BranchExecutionState = {
      ...current,
      status: to,
      lastUpdatedAt: Date.now(),
      history: [...current.history, { from: current.status, to, at: Date.now(), reason }],
      progress:
        to === 'completed' ? 100 :
        to === 'running' ? Math.max(current.progress, 20) :
        to === 'queued' ? Math.max(current.progress, 5) :
        current.progress,
    };
    this.branchStates.set(branchId, next);
    this.transition('branch', branchId, current.status, to, reason || 'state-updated');
    return next;
  }

  createForkPlan(taskId: string, branches: Omit<ForkBranchSpec, 'state'>[], policy: ForkCoordinationPolicy): ForkExecutionPlan {
    const plan: ForkExecutionPlan = {
      taskId,
      strategy: policy.strategy,
      policy,
      branches: branches.map((b) => ({ ...b, state: 'planned' })),
      createdAt: Date.now(),
    };

    for (const b of plan.branches) {
      this.branchStates.set(b.branchId, {
        branchId: b.branchId,
        status: 'planned',
        progress: 0,
        lastUpdatedAt: Date.now(),
        role: b.role,
        goal: b.goal,
        history: [],
      });
    }

    this.plans.set(taskId, plan);
    this.transition('lifecycle', taskId, 'planning', 'forking', 'fork-plan-created');
    this.checkpoint(taskId, 'forking', ['fork plan created']);
    return plan;
  }

  dispatchFork(taskId: string): ForkDispatchDecision {
    const plan = this.plans.get(taskId);
    if (!plan) {
      throw new Error(`no plan for task: ${taskId}`);
    }

    const runnableBranches: string[] = [];
    const deferredBranches: Array<{ branchId: string; reason: string }> = [];
    const rejectedBranches: Array<{ branchId: string; reason: string }> = [];
    const dispatchReasoning: string[] = [];

    const writeBranches = plan.branches.filter((b) => b.accessMode === 'write');
    const readOnlyBranches = plan.branches.filter((b) => b.accessMode === 'read-only');

    readOnlyBranches.forEach((b) => {
      runnableBranches.push(b.branchId);
      this.setBranchState(b.branchId, 'queued', 'read-only-can-run');
    });

    if (plan.policy.writeBranchConstraint === 'single-writer') {
      writeBranches.forEach((b, index) => {
        if (index === 0) {
          runnableBranches.push(b.branchId);
          this.setBranchState(b.branchId, 'queued', 'first-writer-allowed');
        } else {
          deferredBranches.push({ branchId: b.branchId, reason: 'single-writer-constraint' });
          this.setBranchState(b.branchId, 'blocked', 'single-writer-constraint');
        }
      });
      dispatchReasoning.push('single-writer policy enforced');
    } else {
      writeBranches.forEach((b) => {
        runnableBranches.push(b.branchId);
        this.setBranchState(b.branchId, 'queued', 'isolated-writer-allowed');
      });
      dispatchReasoning.push('isolated writers allowed');
    }

    if (runnableBranches.length === 0) {
      plan.branches.forEach((b) => {
        rejectedBranches.push({ branchId: b.branchId, reason: 'no-runnable-branch' });
      });
      dispatchReasoning.push('no branch can be dispatched');
    }

    const decision: ForkDispatchDecision = {
      taskId,
      runnableBranches,
      deferredBranches,
      rejectedBranches,
      dispatchReasoning,
      createdAt: Date.now(),
    };

    this.dispatches.push(decision);
    this.transition('lifecycle', taskId, 'forking', 'executing', 'fork-dispatched');
    this.checkpoint(taskId, 'executing', ['fork dispatched']);
    return decision;
  }

  updateBranchProgress(branchId: string, progress: number, status?: BranchStatus): BranchExecutionState {
    const current = this.branchStates.get(branchId);
    if (!current) {
      throw new Error(`unknown branch: ${branchId}`);
    }
    const nextStatus = status || (progress >= 100 ? 'completed' : progress > 0 ? 'running' : current.status);
    if (nextStatus !== current.status) {
      this.setBranchState(branchId, nextStatus, 'progress-updated');
    }
    const refreshed = this.branchStates.get(branchId)!;
    const updated = { ...refreshed, progress, lastUpdatedAt: Date.now() };
    this.branchStates.set(branchId, updated);
    return updated;
  }

  collectIntermediateResult(input: {
    branchId: string;
    summary: string;
    confidenceProfile: ResultConfidenceProfile;
    reusable: boolean;
    originTrace: ResultOriginTrace;
  }): CollectedIntermediateResult {
    const branch = this.branchStates.get(input.branchId);
    if (!branch) {
      throw new Error(`unknown branch: ${input.branchId}`);
    }

    const result: CollectedIntermediateResult = {
      resultId: this.id('res'),
      branchId: input.branchId,
      status: branch.status,
      summary: input.summary,
      reusable: input.reusable,
      confidenceProfile: input.confidenceProfile,
      originTrace: input.originTrace,
      createdAt: Date.now(),
    };

    this.intermediateResults.push(result);
    return result;
  }

  decideResultReuse(resultId: string, targetBranches: string[]): ResultReuseDecision {
    const result = this.intermediateResults.find((r) => r.resultId === resultId);
    if (!result) {
      throw new Error(`unknown result: ${resultId}`);
    }

    const reusable = result.reusable && result.confidenceProfile.confidence >= 0.6;
    const decision: ResultReuseDecision = {
      resultId,
      reusable,
      reason: reusable ? 'confidence-and-flag-accepted' : 'confidence-too-low-or-marked-nonreusable',
      targetBranches,
      decisionAt: Date.now(),
    };

    this.reuseDecisions.push(decision);
    return decision;
  }

  buildMergeCandidates(branchIds: string[]): MergeCandidate[] {
    return branchIds
      .map((branchId) => {
        const state = this.branchStates.get(branchId);
        const result = this.intermediateResults
          .filter((r) => r.branchId === branchId)
          .sort((a, b) => b.createdAt - a.createdAt)[0];
        if (!state) {
          return undefined;
        }
        const confidence = result?.confidenceProfile.confidence ?? 0;
        const score = Math.round((state.progress * 0.6 + confidence * 100 * 0.4) * 100) / 100;
        return {
          branchId,
          summary: result?.summary ?? 'no-intermediate-result',
          score,
          confidence,
          status: state.status,
          artifacts: result?.originTrace.evidenceRefs ?? [],
        };
      })
      .filter((c): c is MergeCandidate => Boolean(c));
  }

  mergeCandidates(taskId: string, candidates: MergeCandidate[], policy: MergeResolutionPolicy): MergeResult {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    const top = sorted[0];

    const conflicts: MergeConflictDescriptor[] = [];
    if (policy.mode === 'manual-on-conflict' && sorted.length >= 2) {
      const [a, b] = sorted;
      if (Math.abs(a.score - b.score) < 5) {
        conflicts.push({
          conflictId: this.id('conf'),
          branches: [a.branchId, b.branchId],
          dimension: 'priority',
          description: 'top branch scores are too close for automatic selection',
          severity: 'high',
          resolutionOptions: ['manual-review', 're-run-scoring', 'combine-best'],
        });
      }
    }

    let outcome: MergeResult['outcome'] = 'discarded';
    let winnerBranchId: string | undefined;
    let keptBranchIds: string[] = [];
    let discardedBranchIds: string[] = [];
    let mergedFromBranchIds: string[] = [];
    let mergedSummary = 'no branch met merge criteria';

    if (conflicts.length > 0) {
      outcome = 'conflict';
      keptBranchIds = [];
      discardedBranchIds = [];
      mergedSummary = 'merge blocked by conflicts';
    } else if (policy.mode === 'winner-takes-all' && top) {
      outcome = 'winner';
      winnerBranchId = top.branchId;
      keptBranchIds = [top.branchId];
      discardedBranchIds = sorted.slice(1).map((x) => x.branchId);
      mergedSummary = `winner selected: ${top.branchId}`;
    } else if (policy.mode === 'combine-best') {
      const selected = sorted.filter((x) => x.score >= policy.minimumScore && x.confidence >= policy.confidenceFloor);
      if (selected.length >= 2 || (selected.length === 1 && policy.allowPartialMerge)) {
        outcome = 'merged';
        mergedFromBranchIds = selected.map((x) => x.branchId);
        keptBranchIds = [...mergedFromBranchIds];
        discardedBranchIds = sorted.filter((x) => !mergedFromBranchIds.includes(x.branchId)).map((x) => x.branchId);
        mergedSummary = `merged ${mergedFromBranchIds.length} branches`;
      } else if (top) {
        outcome = 'winner';
        winnerBranchId = top.branchId;
        keptBranchIds = [top.branchId];
        discardedBranchIds = sorted.slice(1).map((x) => x.branchId);
        mergedSummary = `fallback winner selected: ${top.branchId}`;
      }
    } else if (policy.mode === 'keep-multiple') {
      keptBranchIds = sorted.filter((x) => x.score >= policy.minimumScore).map((x) => x.branchId);
      discardedBranchIds = sorted.filter((x) => !keptBranchIds.includes(x.branchId)).map((x) => x.branchId);
      outcome = keptBranchIds.length > 0 ? 'kept' : 'discarded';
      mergedSummary = keptBranchIds.length > 0 ? `kept ${keptBranchIds.length} branches` : 'all branches discarded';
    } else if (policy.mode === 'discard-low-quality') {
      keptBranchIds = sorted.filter((x) => x.score >= policy.minimumScore && x.confidence >= policy.confidenceFloor).map((x) => x.branchId);
      discardedBranchIds = sorted.filter((x) => !keptBranchIds.includes(x.branchId)).map((x) => x.branchId);
      outcome = keptBranchIds.length > 0 ? 'kept' : 'discarded';
      mergedSummary = keptBranchIds.length > 0 ? 'high-quality branches retained' : 'all branches below quality floor';
    }

    const trace: MergeOutcomeTrace = {
      traceId: this.id('trace'),
      evaluatedBranches: candidates.map((c) => c.branchId),
      evidence: candidates.map((c) => `${c.branchId}:${c.score}/${c.confidence}`),
      policyMode: policy.mode,
      chosenOutcome: outcome,
      timestamp: Date.now(),
    };

    const result: MergeResult = {
      taskId,
      outcome,
      winnerBranchId,
      keptBranchIds,
      discardedBranchIds,
      mergedFromBranchIds,
      mergedSummary,
      basis: [`mode=${policy.mode}`, `minScore=${policy.minimumScore}`, `confidenceFloor=${policy.confidenceFloor}`],
      conflicts,
      trace,
    };

    this.merges.push(result);
    this.transition('lifecycle', taskId, 'executing', outcome === 'conflict' ? 'recovering' : 'merging', 'merge-evaluated');
    this.checkpoint(taskId, outcome === 'conflict' ? 'recovering' : 'merging', ['merge decision recorded']);
    return result;
  }

  abortBranch(branchId: string, reason: AbortReason, scope: AbortImpactScope): AbortDecision {
    this.setBranchState(branchId, 'aborted', reason);

    const recovery: AbortRecoverySuggestion[] = [
      {
        suggestionId: this.id('abort-rec'),
        title: 'Recover after abort',
        actions: ['inspect failure evidence', 're-plan branch objective', 'restart with stricter constraints'],
        prerequisites: ['reason confirmed', 'impact acknowledged'],
      },
    ];

    const decision: AbortDecision = {
      decisionId: this.id('abort'),
      branchId,
      reason,
      scope,
      recovery,
      createdAt: Date.now(),
    };

    this.aborts.push(decision);

    const hint: BranchRecoveryHint = {
      hintId: this.id('hint'),
      stage: 'abort',
      branchId,
      title: 'Branch aborted; execute recovery plan',
      steps: recovery[0].actions,
      preconditions: recovery[0].prerequisites,
      priority: scope.scope === 'global' ? 'high' : 'medium',
    };
    this.recoveryHints.push(hint);

    return decision;
  }

  escalate(reason: EscalationReason, target: EscalationTarget, priority: EscalationPriority): EscalationDecision {
    const actionPlan: EscalationActionPlan = {
      planId: this.id('plan'),
      immediateActions: ['freeze risky writes', 'capture branch snapshots'],
      shortTermActions: ['collect decision context', 'assign mitigation owner'],
      rollbackActions: ['revert unstable branch outputs', 'resume from last checkpoint'],
      exitCriteria: ['risk reduced', 'next-step owner assigned'],
    };

    const decision: EscalationDecision = {
      decisionId: this.id('esc'),
      reason,
      target,
      priority,
      actionPlan,
      createdAt: Date.now(),
    };

    this.escalations.push(decision);

    const hint: EscalationRecoveryHint = {
      hintId: this.id('hint'),
      stage: 'escalate',
      escalationId: decision.decisionId,
      title: 'Escalation recovery path',
      steps: ['address root cause', 'approve revised plan', 'resume execution in guarded mode'],
      preconditions: ['escalation accepted', 'owner available'],
      priority: priority === 'critical' ? 'high' : priority,
    };
    this.recoveryHints.push(hint);

    return decision;
  }

  createForkRecoveryHints(taskId: string, failedBranchIds: string[]): BranchRecoveryHint[] {
    const hints: BranchRecoveryHint[] = failedBranchIds.map((branchId) => ({
      hintId: this.id('hint'),
      stage: 'fork',
      branchId,
      title: 'Fork execution recovery',
      steps: ['re-check branch dependencies', 'lower parallelism', 'retry branch bootstrap'],
      preconditions: ['branch plan exists', 'dependencies available'],
      priority: 'high',
    }));
    this.recoveryHints.push(...hints);
    this.transition('lifecycle', taskId, 'executing', 'recovering', 'fork-failure-recovery-hints');
    this.checkpoint(taskId, 'recovering', ['fork recovery hints generated']);
    return hints;
  }

  createMergeRecoveryHint(conflicts: MergeConflictDescriptor[]): MergeRecoveryHint {
    const hint: MergeRecoveryHint = {
      hintId: this.id('hint'),
      stage: 'merge',
      conflictIds: conflicts.map((c) => c.conflictId),
      title: 'Resolve merge conflicts',
      steps: ['rank conflict dimensions', 'apply policy override', 're-run merge scoring'],
      preconditions: ['conflicts captured', 'merge policy selected'],
      priority: 'high',
    };
    this.recoveryHints.push(hint);
    return hint;
  }

  getBranchState(branchId: string): BranchExecutionState | undefined {
    return this.branchStates.get(branchId);
  }

  getLifecycleSummary(taskId: string): CoordinationLifecycleSummary {
    const states = [...this.branchStates.values()];
    return {
      taskId,
      totalBranches: states.length,
      completedBranches: states.filter((s) => s.status === 'completed').length,
      failedBranches: states.filter((s) => s.status === 'failed').length,
      abortedBranches: states.filter((s) => s.status === 'aborted').length,
      mergeOutcomes: this.merges.filter((m) => m.taskId === taskId).map((m) => m.outcome),
      escalationCount: this.escalations.length,
      checkpoints: this.checkpoints.filter((c) => c.taskId === taskId).length,
      transitions: this.transitions.filter((t) => t.entityId === taskId || this.branchStates.has(t.entityId)).length,
      generatedAt: Date.now(),
    };
  }

  getProtocol(taskId: string): CoordinationLifecycleProtocol {
    const branchStateRecord: Record<string, BranchExecutionState> = {};
    for (const [branchId, state] of this.branchStates.entries()) {
      branchStateRecord[branchId] = state;
    }

    return {
      taskId,
      forkPlan: this.plans.get(taskId),
      forkDispatches: this.dispatches.filter((d) => d.taskId === taskId),
      branchStates: branchStateRecord,
      intermediateResults: [...this.intermediateResults],
      reuseDecisions: [...this.reuseDecisions],
      mergeResults: this.merges.filter((m) => m.taskId === taskId),
      abortDecisions: [...this.aborts],
      escalationDecisions: [...this.escalations],
      recoveryHints: [...this.recoveryHints],
      transitions: [...this.transitions],
      checkpoints: this.checkpoints.filter((c) => c.taskId === taskId),
      summary: this.getLifecycleSummary(taskId),
    };
  }

  createForkExecutionPlans(
    taskId: string,
    strategies: LegacyForkStrategy[],
    descriptions: string[],
  ) {
    const branches = strategies.map((strategy, index) => ({
      branchId: `${taskId}-branch-${index + 1}`,
      task: descriptions[index] ?? `${strategy} branch`,
      role: legacyRoleForStrategy(strategy),
      goal: descriptions[index] ?? `${strategy} branch output`,
      accessMode: strategy === 'exploratory' ? 'read-only' : 'write',
      runMode: strategy === 'sequential' ? 'sequential' : 'parallel',
      executionStrategy: strategy,
      dependencies: [],
      description: descriptions[index] ?? `${strategy} branch`,
      strategy,
    }));

    const plan = this.createForkPlan(taskId, branches, {
      strategy: {
        name: strategies.every((s) => s === 'sequential') ? 'sequential-first' : 'parallel-first',
        executionMode: strategies.every((s) => s === 'sequential') ? 'sequential' : 'parallel',
        maxParallelism: Math.max(1, strategies.filter((s) => s !== 'sequential').length),
        rationale: 'legacy lifecycle surface folded into CoordinatorV1',
      },
      allowReadOnlyParallelism: true,
      writeBranchConstraint: 'isolated-writers',
      orderingRules: ['preserve user task order', 'single writer if conflict is detected'],
      fallbackPolicy: 'downgrade-parallelism',
    });

    return plan.branches.map((branch: ForkBranchSpec, index: number) => legacyBranchRecord({
      ...branch,
      description: descriptions[index],
      strategy: strategies[index],
    }));
  }

  updateBranchState(
    branchId: string,
    status: BranchStatus,
    progress?: number,
  ) {
    return this.updateBranchProgress(branchId, progress ?? (status === 'completed' ? 100 : status === 'running' ? 50 : 0), status);
  }

  addIntermediateResult(branchId: string, input: any) {
    const result = this.collectIntermediateResult({
      branchId,
      summary: input.summary ?? '',
      reusable: Boolean(input.isReusable),
      confidenceProfile: {
        confidence: typeof input.confidence === 'number' ? input.confidence : 0.5,
        qualitySignals: input.tags ?? [],
        risks: [],
      },
      originTrace: {
        sourceBranchId: branchId,
        sourceTask: input.type ?? 'intermediate',
        generatedAt: Date.now(),
        generatorRole: this.getBranchState(branchId)?.role ?? 'worker',
        evidenceRefs: input.tags ?? [],
      },
    }) as CollectedIntermediateResult & Record<string, unknown>;

    result.id = `${branchId}-result-${this.intermediateResults.length}`;
    result.type = input.type;
    result.content = input.content;
    result.confidence = typeof input.confidence === 'number' ? input.confidence : 0.5;
    result.isReusable = Boolean(input.isReusable);
    result.tags = input.tags ?? [];
    result.timestamp = result.createdAt;
    return result;
  }

  collectIntermediateResults(branchId: string) {
    const results = this.intermediateResults.filter((result: any) => result.branchId === branchId);
    const reusableCount = results.filter((result: any) => result.reusable || result.isReusable).length;
    const qualityScore = results.length
      ? Math.round(results.reduce((sum: number, result: any) => sum + ((result.confidenceProfile?.confidence ?? result.confidence ?? 0) * 100), 0) / results.length)
      : 0;
    return {
      branchId,
      results,
      totalCount: results.length,
      reusableCount,
      qualityScore,
      summary: `${results.length} intermediate result(s), ${reusableCount} reusable`,
    };
  }

  evaluateMergeCandidates(branchIds: string[]) {
    return this.buildMergeCandidates(branchIds).map((candidate: MergeCandidate) => ({
      ...candidate,
      strengths: candidate.confidence >= 0.7 ? ['high-confidence evidence'] : ['available branch output'],
      weaknesses: candidate.confidence < 0.5 ? ['low confidence'] : [],
      compatibility: candidate.score >= 75 ? 'high' : candidate.score >= 45 ? 'medium' : 'low',
      estimatedIntegrationEffort: candidate.score >= 75 ? 'low' : candidate.score >= 45 ? 'medium' : 'high',
    }));
  }

  performMerge(
    branchId: string,
    mergeStrategy: 'select-best' | 'combine' | 'hybrid' = 'select-best',
  ) {
    const candidates = this.buildMergeCandidates([branchId]);
    this.mergeCandidates('legacy-merge-task', candidates, {
      mode: mergeStrategy === 'combine' ? 'combine-best' : 'winner-takes-all',
      minimumScore: 0,
      confidenceFloor: 0,
      allowPartialMerge: true,
      conflictPreference: 'prefer-high-confidence',
    });
    return {
      selectedBranchId: branchId,
      mergedContent: candidates[0]?.summary ?? '',
      mergeStrategy,
      rationale: `selected ${branchId} through CoordinatorV1 merge owner`,
      integrationNotes: ['merge recorded in CoordinatorV1 protocol'],
      qualityAssessment: {
        completeness: Math.max(0, Math.min(100, candidates[0]?.score ?? 75)),
        correctness: Math.max(0, Math.min(100, Math.round((candidates[0]?.confidence ?? 0.75) * 100))),
        maintainability: 80,
      },
    };
  }

  decideAbort(branchId: string, reasons: string[]) {
    const primaryReason = reasons[0] ?? 'manual-stop';
    const shouldAbort = reasons.length > 0;
    return {
      shouldAbort,
      primaryReason,
      recoveryHint: shouldAbort ? {
        type: 'abort',
        branchId,
        steps: ['capture evidence', 'stop branch execution', 'replan affected work'],
      } : undefined,
    };
  }

  decideEscalation(taskId: string, reasons: string[]) {
    if (reasons.length === 0) return null;
    const reason = reasons[0];
    return {
      taskId,
      reason,
      severity: reason.includes('risk') ? 'high' : 'medium',
      recommendedAction: reason.includes('risk') ? 'pause' : 'replan',
      suggestedRoles: ['coordinator', 'specialist'],
      rationale: `CoordinatorV1 escalation for ${reason}`,
      expectedOutcome: 'risk is explicitly owned before continuing',
    };
  }

  compareBranches(branchA: string, branchB: string) {
    return {
      branchA,
      branchB,
      similarityScore: branchA === branchB ? 100 : 50,
      differences: branchA === branchB ? [] : [`${branchA} differs from ${branchB}`],
      recommendation: 'keep-both',
      rationale: 'branches are independent until merge evidence selects a winner',
    };
  }

  generateLifecycleProtocolOutput(taskId: string) {
    const protocol = this.getProtocol(taskId);
    const branches = protocol.forkPlan?.branches ?? [];
    const branchIds = branches.map((branch: ForkBranchSpec) => branch.branchId);
    return {
      taskId,
      forks: branches.map((branch: ForkBranchSpec) => legacyBranchRecord(branch)),
      branchStates: protocol.branchStates,
      collectedResults: protocol.intermediateResults,
      mergeCandidates: this.evaluateMergeCandidates(branchIds),
      abortDecisions: protocol.abortDecisions,
      escalationDecisions: protocol.escalationDecisions,
      recoveryHints: protocol.recoveryHints,
      overallStatus: protocol.summary.completedBranches === protocol.summary.totalBranches ? 'completed' : 'executing',
      timestamp: Date.now(),
    };
  }

  analyzeTask(title: string, description: string) {
    return createSimpleRoleRouting(title, description);
  }

  analyzeTaskEnhanced(title: string, description: string) {
    return createEnhancedRoleRouting(title, description);
  }

  generateCoordinatorSystemPrompt() {
    return [
      'DSXU CoordinatorV1',
      'Use one coordinator owner, visible work-state, explicit evidence, and independent verification.',
      'Do not create duplicate runtimes or bypass Tool Gate.',
    ].join('\n');
  }

  createSubtaskPlan(
    id: string,
    type: string,
    title: string,
    description: string,
    assignedRole: AgentRole,
    options: Record<string, any> = {}
  ) {
    return {
      id,
      type,
      title,
      description,
      assignedRole,
      dependencies: options.dependencies ?? [],
      expectedOutput: options.expectedOutput ?? 'task output',
      priority: options.priority ?? 'medium',
      riskProfile: options.riskProfile ?? {
        riskLevel: 'medium',
        factors: { complexity: 'medium', impact: 'medium', uncertainty: 'medium', dependencies: 'some' },
        recommendedRoles: [assignedRole],
        riskMitigation: ['keep owner evidence visible'],
      },
      validationRequirement: options.validationRequirement ?? {
        level: type === 'verification' ? 'independent' : 'self',
        description: 'default validation',
        requiredRoles: type === 'verification' ? ['verifier'] : [],
        validationSteps: ['run owner tests'],
        successCriteria: ['owner evidence passes'],
      },
      contextOverlap: options.contextOverlap ?? 'fresh',
      estimatedDuration: options.estimatedDuration ?? 30000,
    };
  }

  createMainTaskPlan(
    id: string,
    title: string,
    description: string,
    subtasks: any[] = [],
    options: Record<string, any> = {}
  ) {
    const requiredRoles = [...new Set(subtasks.map((subtask) => subtask.assignedRole).filter(Boolean))];
    return {
      id,
      title,
      description,
      subtasks,
      requiredRoles,
      estimatedComplexity: options.estimatedComplexity ?? 'medium',
      overallRisk: options.overallRisk ?? 'medium',
      verificationLevel: options.verificationLevel ?? 'self',
      coordinatorOverride: options.coordinatorOverride ?? false,
    };
  }

  createTaskAssignment(
    taskId: string,
    assignedRole: AgentRole,
    assignmentRationale: string,
    options: Record<string, any> = {}
  ) {
    return {
      taskId,
      subtaskId: options.subtaskId,
      assignedRole,
      assignmentTime: Date.now(),
      assignmentRationale,
      priority: options.priority ?? 'medium',
      resourceRequirements: options.resourceRequirements ?? {},
      constraints: options.constraints ?? {},
      status: 'pending',
    };
  }

  createAgentRuntimeState(
    agentId: string,
    role: AgentRole,
    options: Record<string, any> = {}
  ) {
    return {
      agentId,
      role,
      currentTaskId: options.currentTaskId,
      status: options.status ?? 'idle',
      riskLevel: options.riskLevel ?? 'medium',
      verificationStatus: options.verificationStatus ?? 'pending',
      contextOverlap: options.contextOverlap ?? 'fresh',
      updatedAt: Date.now(),
    };
  }

  createMultiAgentRuntimeState(
    taskId: string,
    agents: any[],
    options: Record<string, any> = {}
  ) {
    return {
      taskId,
      agents,
      overallStatus: options.overallStatus ?? 'pending',
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      riskAssessment: options.riskAssessment ?? 'medium',
      verificationSummary: options.verificationSummary ?? { required: 0, completed: 0, passed: 0, failed: 0 },
      updatedAt: Date.now(),
    };
  }

  createBranchState(
    branchId: string,
    taskId: string,
    strategy: LegacyForkStrategy,
    description: string,
    assignedRole: AgentRole,
    options: Record<string, any> = {}
  ) {
    const state = {
      branchId,
      taskId,
      strategy,
      description,
      assignedRole,
      status: options.status ?? 'planned',
      startTime: Date.now(),
      progress: options.progress ?? 0,
      phase: options.phase ?? 'planning',
      goals: options.goals ?? [description],
      successCriteria: options.successCriteria ?? ['branch objective completed'],
      constraints: options.constraints ?? {},
      intermediateResults: options.intermediateResults ?? [],
      errors: options.errors ?? [],
      warnings: options.warnings ?? [],
      contextDecisions: options.contextDecisions ?? [],
      metrics: options.metrics ?? { contextEfficiency: 0.75, parallelizability: 0.7, verificationReadiness: 0.6 },
      context: options.context ?? { sharedContextIds: [], isolationLevel: 'none', contextFreshness: 1, contextRelevance: 1, contextOverlap: {} },
      dsxuAlignment: options.dsxuAlignment ?? { workflowCompliance: 0.8, decisionPatternMatch: 0.8, contextStrategyAlignment: 0.8, verificationAlignment: 0.8 },
    };
    this.branchStates.set(branchId, {
      branchId,
      status: state.status,
      progress: state.progress,
      lastUpdatedAt: Date.now(),
      role: assignedRole,
      goal: description,
      history: [],
    });
    return state;
  }

  createCoordinationCheckpoint(
    checkpointId: string,
    taskId: string,
    phase: string,
    workflowStage: Record<string, any>,
    options: Record<string, any> = {}
  ) {
    return {
      checkpointId,
      taskId,
      phase,
      workflowStage,
      stateSnapshot: options.stateSnapshot ?? { taskStates: {}, agentStates: {}, resourceUsage: {} },
      metrics: options.metrics ?? { progress: 0, quality: 0, efficiency: 0 },
      dsxuParity: options.dsxuParity ?? { workflowAlignment: 0.75, absorptionLevel: 'parity' },
      createdAt: Date.now(),
    };
  }

  createContextDecisionState(
    decisionId: string,
    taskId: string,
    decisionType: string,
    rationale: string,
    options: Record<string, any> = {}
  ) {
    return {
      decisionId,
      taskId,
      decisionType,
      rationale,
      subtaskId: options.subtaskId,
      phase: options.phase,
      factors: options.factors ?? {},
      decision: options.decision ?? { contextAction: decisionType, dsxuPattern: 'default' },
      outcome: options.outcome,
      createdAt: Date.now(),
    };
  }

  createCoordinatorStatePackage(
    taskId: string,
    taskPlan: any,
    coordinatorDecision: any,
    options: Record<string, any> = {}
  ) {
    return {
      taskId,
      taskPlan,
      coordinatorDecision,
      multiAgentState: this.createMultiAgentRuntimeState(taskId, options.agentStates ?? []),
      branchStates: options.branchStates ?? [],
      contextDecisions: options.contextDecisions ?? [],
      checkpoints: options.checkpoints ?? [],
      parityScore: options.parityScore ?? 0,
      absorptionLevel: options.absorptionLevel ?? 'baseline',
    };
  }

  intelligentTaskDecompositionEnhanced(
    title: string,
    description: string,
    options: Record<string, any> = {}
  ) {
    const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const subtasks = [
      this.createSubtaskPlan(`${taskId}_research`, 'research', `Research: ${title}`, description, 'researcher'),
      this.createSubtaskPlan(`${taskId}_implementation`, 'implementation', `Implement: ${title}`, description, 'implementer'),
      this.createSubtaskPlan(`${taskId}_verification`, 'verification', `Verify: ${title}`, description, 'verifier'),
    ];
    if (options.includeSynthesis) {
      subtasks.push(this.createSubtaskPlan(`${taskId}_synthesis`, 'coordination', `Synthesize: ${title}`, description, 'coordinator'));
    }
    return this.createMainTaskPlan(taskId, title, description, subtasks, {
      overallRisk: 'medium',
      verificationLevel: 'independent',
      coordinatorOverride: false,
    });
  }

  createCoordinatorDecisionEnhanced(taskPlan: any) {
    return {
      taskId: taskPlan.id,
      roleAssignments: taskPlan.subtasks.map((subtask: any) => ({
        subtaskId: subtask.id,
        assignedRole: subtask.assignedRole,
        rationale: `assign ${subtask.assignedRole} for ${subtask.type}`,
        expectedDuration: subtask.estimatedDuration,
        riskAssessment: subtask.riskProfile?.riskLevel ?? 'medium',
        verificationNeeded: subtask.validationRequirement?.level !== 'none',
        contextDecision: subtask.contextOverlap ?? 'fresh',
      })),
      concurrencyPlan: {
        parallelTasks: taskPlan.subtasks.filter((subtask: any) => subtask.type === 'research').map((subtask: any) => subtask.id),
        sequentialTasks: taskPlan.subtasks.filter((subtask: any) => subtask.type !== 'research').map((subtask: any) => subtask.id),
        writeHeavyTasks: taskPlan.subtasks.filter((subtask: any) => subtask.type === 'implementation').map((subtask: any) => subtask.id),
      },
      rationale: 'enhanced CoordinatorV1 decision with risk and verification evidence',
    };
  }


  toMainlineEnvelope(taskId: string, decision: any) {
    const protocol = this.getProtocol(taskId);
    return buildCoordinatorMainlineEnvelope(taskId, decision, protocol);
  }

}

export function createCoordinatorV1(): CoordinatorV1 {
  return new CoordinatorV1();
}

type LegacyForkStrategy = 'parallel' | 'sequential' | 'exploratory' | 'competitive';

function legacyRoleForStrategy(strategy: LegacyForkStrategy): AgentRole {
  if (strategy === 'exploratory') return 'explorer';
  if (strategy === 'competitive') return 'specialist';
  if (strategy === 'sequential') return 'implementer';
  return 'worker';
}

function legacyPriorityForStrategy(strategy: LegacyForkStrategy): 'low' | 'medium' | 'high' {
  if (strategy === 'competitive') return 'high';
  if (strategy === 'exploratory') return 'medium';
  return 'medium';
}

function legacyBranchRecord(branch: ForkBranchSpec & { description?: string; strategy?: LegacyForkStrategy }) {
  const strategy = branch.strategy ?? (branch.runMode === 'parallel' ? 'parallel' : 'sequential');
  return {
    branchId: branch.branchId,
    strategy,
    description: branch.description ?? branch.task,
    assignedRole: branch.role,
    expectedOutput: branch.goal,
    priority: legacyPriorityForStrategy(strategy),
    riskTolerance: strategy === 'competitive' ? 'medium' : 'low',
  };
}


// ===== Mainline Projection Helpers =====

export function createSimpleRoleRouting(title: string, description: string) {
  const taskId = `task-${Date.now()}`;
  return {
    decision: {
      taskId,
      roleAssignments: [{ subtaskId: `${taskId}-impl`, assignedRole: 'implementer', rationale: 'mainline default route' }],
      concurrencyPlan: { parallelTasks: [], sequentialTasks: [`${taskId}-impl`] },
      rationale: `route for ${title}`,
    },
    taskPlan: {
      id: taskId,
      title,
      description,
      subtasks: [
        {
          id: `${taskId}-impl`,
          type: 'implementation',
          title,
          description,
          assignedRole: 'implementer',
          dependencies: [],
          expectedOutput: 'implementation output',
          priority: 'high',
        },
      ],
    },
    timestamp: Date.now(),
  };
}

export function createEnhancedRoleRouting(title: string, description: string) {
  return createSimpleRoleRouting(title, description);
}

export function buildCoordinatorMainlineEnvelope(
  taskId: string,
  decision: {
    taskId: string;
    roleAssignments: Array<{ subtaskId: string; assignedRole: string; rationale: string }>;
    concurrencyPlan: { parallelTasks: string[]; sequentialTasks: string[] };
    rationale: string;
  },
  protocol: ReturnType<CoordinatorV1['getProtocol']>,
) {
  const latestMerge = protocol.mergeResults[protocol.mergeResults.length - 1];
  const latestAbort = protocol.abortDecisions[protocol.abortDecisions.length - 1];
  const latestEsc = protocol.escalationDecisions[protocol.escalationDecisions.length - 1];
  const latestFork = protocol.forkDispatches[protocol.forkDispatches.length - 1];

  const signals: Array<{ type: 'fork' | 'merge' | 'abort' | 'escalate'; payload: any }> = [];
  if (latestFork) signals.push({ type: 'fork', payload: latestFork });
  if (latestMerge) signals.push({ type: 'merge', payload: latestMerge });
  if (latestAbort) signals.push({ type: 'abort', payload: latestAbort });
  if (latestEsc) signals.push({ type: 'escalate', payload: latestEsc });

  return {
    decision,
    protocol,
    signals,
    taskId,
    createdAt: Date.now(),
  };
}


// ===== Skills Resolution Coordination =====

export interface CoordinatorSkillResolutionInput {
  taskId: string;
  selectedSkillIds: string[];
  resolutionTrace: { reasons: string[]; discardedSkillIds: string[] };
}

export interface CoordinatorSkillResolutionOutput {
  taskId: string;
  shouldEscalate: boolean;
  consumeByDecision: {
    skillCount: number;
    selectedSkillIds: string[];
    note: string;
  };
}

export function consumeSkillResolutionInCoordinator(input: CoordinatorSkillResolutionInput): CoordinatorSkillResolutionOutput {
  const riskyDiscard = input.resolutionTrace.discardedSkillIds.length > 2;
  return {
    taskId: input.taskId,
    shouldEscalate: riskyDiscard,
    consumeByDecision: {
      skillCount: input.selectedSkillIds.length,
      selectedSkillIds: input.selectedSkillIds,
      note: riskyDiscard ? 'high discard volume, consider escalation' : 'skill resolution accepted',
    },
  };
}

// ===== Tool Mainline Coordination =====

export interface CoordinatorToolSignalInput {
  taskId: string;
  selectedToolIds: string[];
  gate: Array<{
    toolId: string;
    gateDecision: 'allow' | 'warn' | 'block' | 'require_confirmation';
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  }>;
  executions: Array<{
    toolId: string;
    status: 'succeeded' | 'failed' | 'blocked';
    summary: string;
  }>;
}

export interface CoordinatorToolSignalOutput {
  taskId: string;
  shouldEscalate: boolean;
  riskSummary: {
    blockedTools: string[];
    failedTools: string[];
    criticalTools: string[];
  };
  coordinationHints: string[];
}

export function consumeToolSignalsInCoordinator(input: CoordinatorToolSignalInput): CoordinatorToolSignalOutput {
  const blockedTools = input.gate.filter((x) => x.gateDecision === 'block').map((x) => x.toolId);
  const criticalTools = input.gate.filter((x) => x.riskLevel === 'critical').map((x) => x.toolId);
  const failedTools = input.executions.filter((x) => x.status === 'failed').map((x) => x.toolId);

  const coordinationHints: string[] = [];
  if (blockedTools.length > 0) coordinationHints.push('replan-tool-selection');
  if (failedTools.length > 0) coordinationHints.push('activate-recovery-path');
  if (criticalTools.length > 0) coordinationHints.push('require-human-approval');
  if (coordinationHints.length === 0) coordinationHints.push('tool-flow-healthy');

  return {
    taskId: input.taskId,
    shouldEscalate: blockedTools.length > 0 || criticalTools.length > 0 || failedTools.length > 1,
    riskSummary: { blockedTools, failedTools, criticalTools },
    coordinationHints,
  };
}

// ===== Phase D Multi-Agent Runtime Coordination =====
export function consumeMultiAgentRuntimeSignals(input: {
  taskId: string;
  routeDecision: { phase: string; assignedRole: string };
  parallelPlan: { mode: 'parallel' | 'sequential'; maxParallel: number };
  conflicts: Array<{ conflictId: string }>;
}): {
  taskId: string;
  action: 'continue' | 'escalate';
  evidence: string[];
} {
  const evidence = [
    `phase=${input.routeDecision.phase}`,
    `role=${input.routeDecision.assignedRole}`,
    `mode=${input.parallelPlan.mode}`,
    `maxParallel=${input.parallelPlan.maxParallel}`,
  ];
  if (input.conflicts.length > 0) evidence.push(`conflicts=${input.conflicts.length}`);
  return {
    taskId: input.taskId,
    action: input.conflicts.length > 0 ? 'escalate' : 'continue',
    evidence,
  };
}
