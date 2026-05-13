/**
 * Coordinator Lifecycle V1 测试
 *
 * 测试至少覆盖：
 * 1. fork 结构存在
 * 2. 至少两个分支可并列
 * 3. merge 结构存在
 * 4. abort / escalate 可明确区分
 * 5. 中间结果回收结构存在
 * 6. 不引入第二套 coordinator 主实现
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  createCoordinatorV1,
  type ForkExecutionPlan,
  type BranchExecutionState,
  type IntermediateResult,
  type CollectedIntermediateResult,
  type MergeCandidate,
  type MergeResult,
  type AbortReason,
  type EscalationDecision,
  type LifecycleRecoveryHint,
  type BranchComparison,
  type LifecycleProtocolOutput
} from '../coordinator-v1.ts';

describe('Coordinator Lifecycle V1', () => {
  let coordinator: ReturnType<typeof createCoordinatorV1>;
  const taskId = 'test_task_123';

  beforeEach(() => {
    coordinator = createCoordinatorV1();
  });

  // 测试 1: fork 结构存在
  describe('Fork Structure', () => {
    test('应该能创建分支执行计划', () => {
      const strategies: Array<'parallel' | 'sequential' | 'exploratory' | 'competitive'> = ['parallel', 'exploratory'];
      const descriptions = ['并行执行测试', '探索性测试'];

      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      expect(forks).toBeInstanceOf(Array);
      expect(forks.length).toBe(2);

      // 检查每个分支的结构
      forks.forEach((fork, index) => {
        expect(fork).toHaveProperty('branchId');
        expect(fork.branchId).toContain(taskId);
        expect(fork).toHaveProperty('strategy');
        expect(fork.strategy).toBe(strategies[index]);
        expect(fork).toHaveProperty('description');
        expect(fork.description).toBe(descriptions[index]);
        expect(fork).toHaveProperty('assignedRole');
        expect(fork).toHaveProperty('expectedOutput');
        expect(fork).toHaveProperty('priority');
        expect(['high', 'medium', 'low']).toContain(fork.priority);
        expect(fork).toHaveProperty('riskTolerance');
        expect(['low', 'medium', 'high']).toContain(fork.riskTolerance);
      });
    });

    test('至少两个分支可并列', () => {
      const strategies: Array<'parallel' | 'sequential'> = ['parallel', 'parallel'];
      const descriptions = ['分支A', '分支B'];

      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      expect(forks.length).toBeGreaterThanOrEqual(2);

      // 检查分支ID不同
      const branchIds = forks.map(f => f.branchId);
      const uniqueBranchIds = new Set(branchIds);
      expect(uniqueBranchIds.size).toBe(forks.length);

      // 检查可以同时存在
      const branchA = forks[0];
      const branchB = forks[1];
      expect(branchA.branchId).not.toBe(branchB.branchId);
      expect(branchA.description).not.toBe(branchB.description);
    });
  });

  // 测试 2: merge 结构存在
  describe('Merge Structure', () => {
    test('应该能评估合并候选', () => {
      // 先创建分支
      const strategies: Array<'parallel' | 'exploratory'> = ['parallel', 'exploratory'];
      const descriptions = ['实现分支', '探索分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchIds = forks.map(f => f.branchId);

      // 评估合并候选
      const mergeCandidates = coordinator.evaluateMergeCandidates(branchIds);

      expect(mergeCandidates).toBeInstanceOf(Array);
      expect(mergeCandidates.length).toBe(2);

      mergeCandidates.forEach(candidate => {
        expect(candidate).toHaveProperty('branchId');
        expect(branchIds).toContain(candidate.branchId);
        expect(candidate).toHaveProperty('score');
        expect(candidate.score).toBeGreaterThanOrEqual(0);
        expect(candidate.score).toBeLessThanOrEqual(100);
        expect(candidate).toHaveProperty('strengths');
        expect(candidate.strengths).toBeInstanceOf(Array);
        expect(candidate).toHaveProperty('weaknesses');
        expect(candidate.weaknesses).toBeInstanceOf(Array);
        expect(candidate).toHaveProperty('compatibility');
        expect(['high', 'medium', 'low']).toContain(candidate.compatibility);
        expect(candidate).toHaveProperty('estimatedIntegrationEffort');
        expect(['low', 'medium', 'high']).toContain(candidate.estimatedIntegrationEffort);
      });
    });

    test('应该能执行合并', () => {
      // 先创建分支
      const strategies: Array<'parallel'> = ['parallel'];
      const descriptions = ['测试分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchId = forks[0].branchId;

      // 执行合并
      const mergeResult = coordinator.performMerge(branchId, 'select-best');

      expect(mergeResult).toHaveProperty('selectedBranchId');
      expect(mergeResult.selectedBranchId).toBe(branchId);
      expect(mergeResult).toHaveProperty('mergedContent');
      expect(mergeResult).toHaveProperty('mergeStrategy');
      expect(['select-best', 'combine', 'hybrid']).toContain(mergeResult.mergeStrategy);
      expect(mergeResult).toHaveProperty('rationale');
      expect(typeof mergeResult.rationale).toBe('string');
      expect(mergeResult).toHaveProperty('integrationNotes');
      expect(mergeResult.integrationNotes).toBeInstanceOf(Array);
      expect(mergeResult).toHaveProperty('qualityAssessment');
      expect(mergeResult.qualityAssessment).toHaveProperty('completeness');
      expect(mergeResult.qualityAssessment.completeness).toBeGreaterThanOrEqual(0);
      expect(mergeResult.qualityAssessment.completeness).toBeLessThanOrEqual(100);
      expect(mergeResult.qualityAssessment).toHaveProperty('correctness');
      expect(mergeResult.qualityAssessment.correctness).toBeGreaterThanOrEqual(0);
      expect(mergeResult.qualityAssessment.correctness).toBeLessThanOrEqual(100);
      expect(mergeResult.qualityAssessment).toHaveProperty('maintainability');
      expect(mergeResult.qualityAssessment.maintainability).toBeGreaterThanOrEqual(0);
      expect(mergeResult.qualityAssessment.maintainability).toBeLessThanOrEqual(100);
    });
  });

  // 测试 3: abort / escalate 可明确区分
  describe('Abort and Escalation', () => {
    test('应该能决定是否中止分支', () => {
      // 先创建分支
      const strategies: Array<'parallel'> = ['parallel'];
      const descriptions = ['测试分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchId = forks[0].branchId;

      // 决定是否中止
      const abortReasons: AbortReason[] = ['timeout'];
      const abortDecision = coordinator.decideAbort(branchId, abortReasons);

      expect(abortDecision).toHaveProperty('shouldAbort');
      expect(typeof abortDecision.shouldAbort).toBe('boolean');

      if (abortDecision.shouldAbort) {
        expect(abortDecision).toHaveProperty('primaryReason');
        expect(abortReasons).toContain(abortDecision.primaryReason);
        expect(abortDecision).toHaveProperty('recoveryHint');
        expect(abortDecision.recoveryHint).toHaveProperty('type');
        expect(abortDecision.recoveryHint.type).toBe('abort');
      }
    });

    test('应该能决定是否升级', () => {
      const escalationReasons: Array<'complexity-exceeds-threshold' | 'risk-exceeds-threshold'> = [
        'complexity-exceeds-threshold'
      ];

      const escalationDecision = coordinator.decideEscalation(taskId, escalationReasons);

      // 可能返回null（如果严重度低）
      if (escalationDecision) {
        expect(escalationDecision).toHaveProperty('reason');
        expect(escalationReasons).toContain(escalationDecision.reason);
        expect(escalationDecision).toHaveProperty('severity');
        expect(['low', 'medium', 'high', 'critical']).toContain(escalationDecision.severity);
        expect(escalationDecision).toHaveProperty('recommendedAction');
        expect(['pause', 'consult', 'replan', 'delegate', 'abort']).toContain(escalationDecision.recommendedAction);
        expect(escalationDecision).toHaveProperty('suggestedRoles');
        expect(escalationDecision.suggestedRoles).toBeInstanceOf(Array);
        expect(escalationDecision).toHaveProperty('rationale');
        expect(typeof escalationDecision.rationale).toBe('string');
        expect(escalationDecision).toHaveProperty('expectedOutcome');
        expect(typeof escalationDecision.expectedOutcome).toBe('string');
      }
    });

    test('abort 和 escalate 应该可明确区分', () => {
      // 测试它们返回不同的结构
      const strategies: Array<'parallel'> = ['parallel'];
      const descriptions = ['测试分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);
      const branchId = forks[0].branchId;

      const abortDecision = coordinator.decideAbort(branchId, ['user-requested']);
      const escalationDecision = coordinator.decideEscalation(taskId, ['coordination-needed']);

      // 检查结构不同
      if (abortDecision.shouldAbort && abortDecision.recoveryHint) {
        expect(abortDecision.recoveryHint.type).toBe('abort');
      }

      if (escalationDecision) {
        expect(escalationDecision).toHaveProperty('recommendedAction');
        // 升级决策不应该有 recoveryHint 属性
        expect(escalationDecision).not.toHaveProperty('recoveryHint');
      }
    });
  });

  // 测试 4: 中间结果回收结构存在
  describe('Intermediate Results Collection', () => {
    test('应该能添加中间结果', () => {
      // 先创建分支
      const strategies: Array<'parallel'> = ['parallel'];
      const descriptions = ['测试分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchId = forks[0].branchId;

      // 添加中间结果
      const intermediateResult = coordinator.addIntermediateResult(branchId, {
        type: 'analysis',
        content: { findings: ['发现1', '发现2'] },
        summary: '分析结果摘要',
        confidence: 0.8,
        isReusable: true,
        tags: ['analysis', 'preliminary']
      });

      expect(intermediateResult).toHaveProperty('id');
      expect(intermediateResult.id).toContain(branchId);
      expect(intermediateResult).toHaveProperty('branchId');
      expect(intermediateResult.branchId).toBe(branchId);
      expect(intermediateResult).toHaveProperty('timestamp');
      expect(typeof intermediateResult.timestamp).toBe('number');
      expect(intermediateResult).toHaveProperty('type');
      expect(intermediateResult.type).toBe('analysis');
      expect(intermediateResult).toHaveProperty('content');
      expect(intermediateResult.content).toEqual({ findings: ['发现1', '发现2'] });
      expect(intermediateResult).toHaveProperty('summary');
      expect(intermediateResult.summary).toBe('分析结果摘要');
      expect(intermediateResult).toHaveProperty('confidence');
      expect(intermediateResult.confidence).toBe(0.8);
      expect(intermediateResult).toHaveProperty('isReusable');
      expect(intermediateResult.isReusable).toBe(true);
      expect(intermediateResult).toHaveProperty('tags');
      expect(intermediateResult.tags).toEqual(['analysis', 'preliminary']);
    });

    test('应该能收集中间结果', () => {
      // 先创建分支
      const strategies: Array<'parallel'> = ['parallel'];
      const descriptions = ['测试分支'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchId = forks[0].branchId;

      // 添加一些中间结果
      coordinator.addIntermediateResult(branchId, {
        type: 'code',
        content: { file: 'test.js', changes: 'console.log("test")' },
        summary: '代码修改',
        confidence: 0.9,
        isReusable: true,
        tags: ['code', 'implementation']
      });

      coordinator.addIntermediateResult(branchId, {
        type: 'test',
        content: { testFile: 'test.test.js', results: 'passed' },
        summary: '测试结果',
        confidence: 0.7,
        isReusable: false,
        tags: ['test', 'verification']
      });

      // 收集中间结果
      const collectedResults = coordinator.collectIntermediateResults(branchId);

      expect(collectedResults).toHaveProperty('branchId');
      expect(collectedResults.branchId).toBe(branchId);
      expect(collectedResults).toHaveProperty('results');
      expect(collectedResults.results).toBeInstanceOf(Array);
      expect(collectedResults.results.length).toBe(2);
      expect(collectedResults).toHaveProperty('totalCount');
      expect(collectedResults.totalCount).toBe(2);
      expect(collectedResults).toHaveProperty('reusableCount');
      expect(collectedResults.reusableCount).toBe(1); // 只有一个可复用
      expect(collectedResults).toHaveProperty('qualityScore');
      expect(collectedResults.qualityScore).toBeGreaterThanOrEqual(0);
      expect(collectedResults.qualityScore).toBeLessThanOrEqual(100);
      expect(collectedResults).toHaveProperty('summary');
      expect(typeof collectedResults.summary).toBe('string');
    });
  });

  // 测试 5: 分支比较
  describe('Branch Comparison', () => {
    test('应该能比较两个分支', () => {
      // 创建两个分支
      const strategies: Array<'parallel' | 'exploratory'> = ['parallel', 'exploratory'];
      const descriptions = ['分支A', '分支B'];
      const forks = coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      const branchA = forks[0].branchId;
      const branchB = forks[1].branchId;

      // 比较分支
      const comparison = coordinator.compareBranches(branchA, branchB);

      expect(comparison).toHaveProperty('branchA');
      expect(comparison.branchA).toBe(branchA);
      expect(comparison).toHaveProperty('branchB');
      expect(comparison.branchB).toBe(branchB);
      expect(comparison).toHaveProperty('similarityScore');
      expect(comparison.similarityScore).toBeGreaterThanOrEqual(0);
      expect(comparison.similarityScore).toBeLessThanOrEqual(100);
      expect(comparison).toHaveProperty('differences');
      expect(comparison.differences).toBeInstanceOf(Array);
      expect(comparison).toHaveProperty('recommendation');
      expect(['keep-a', 'keep-b', 'keep-both', 'merge', 'discard-both']).toContain(comparison.recommendation);
      expect(comparison).toHaveProperty('rationale');
      expect(typeof comparison.rationale).toBe('string');
    });
  });

  // 测试 6: 生命周期协议输出
  describe('Lifecycle Protocol Output', () => {
    test('应该能生成完整的生命周期协议输出', () => {
      // 创建分支并执行一些操作
      const strategies: Array<'parallel' | 'exploratory'> = ['parallel', 'exploratory'];
      const descriptions = ['实现分支', '探索分支'];
      coordinator.createForkExecutionPlans(taskId, strategies, descriptions);

      // 生成协议输出
      const protocolOutput = coordinator.generateLifecycleProtocolOutput(taskId);

      expect(protocolOutput).toHaveProperty('taskId');
      expect(protocolOutput.taskId).toBe(taskId);
      expect(protocolOutput).toHaveProperty('forks');
      expect(protocolOutput.forks).toBeInstanceOf(Array);
      expect(protocolOutput.forks.length).toBe(2);
      expect(protocolOutput).toHaveProperty('branchStates');
      expect(typeof protocolOutput.branchStates).toBe('object');
      expect(Object.keys(protocolOutput.branchStates).length).toBe(2);
      expect(protocolOutput).toHaveProperty('collectedResults');
      expect(protocolOutput.collectedResults).toBeInstanceOf(Array);
      expect(protocolOutput).toHaveProperty('mergeCandidates');
      expect(protocolOutput.mergeCandidates).toBeInstanceOf(Array);
      expect(protocolOutput).toHaveProperty('abortDecisions');
      expect(protocolOutput.abortDecisions).toBeInstanceOf(Array);
      expect(protocolOutput).toHaveProperty('escalationDecisions');
      expect(protocolOutput.escalationDecisions).toBeInstanceOf(Array);
      expect(protocolOutput).toHaveProperty('recoveryHints');
      expect(protocolOutput.recoveryHints).toBeInstanceOf(Array);
      expect(protocolOutput).toHaveProperty('overallStatus');
      expect(['planning', 'executing', 'merging', 'completed', 'escalated', 'aborted']).toContain(protocolOutput.overallStatus);
      expect(protocolOutput).toHaveProperty('timestamp');
      expect(typeof protocolOutput.timestamp).toBe('number');
    });
  });

  // 测试 7: 不引入第二套 coordinator 主实现
  describe('Single Coordinator Implementation', () => {
    test('应该使用同一套 coordinator 实现', () => {
      // 验证 coordinator 实例具有所有必要的方法
      expect(typeof coordinator.analyzeTask).toBe('function');
      expect(typeof coordinator.analyzeTaskEnhanced).toBe('function');

      // 生命周期协议方法
      expect(typeof coordinator.createForkExecutionPlans).toBe('function');
      expect(typeof coordinator.updateBranchState).toBe('function');
      expect(typeof coordinator.addIntermediateResult).toBe('function');
      expect(typeof coordinator.collectIntermediateResults).toBe('function');
      expect(typeof coordinator.evaluateMergeCandidates).toBe('function');
      expect(typeof coordinator.performMerge).toBe('function');
      expect(typeof coordinator.decideAbort).toBe('function');
      expect(typeof coordinator.decideEscalation).toBe('function');
      expect(typeof coordinator.compareBranches).toBe('function');
      expect(typeof coordinator.generateLifecycleProtocolOutput).toBe('function');

      // 验证这是同一个类实例
      expect(coordinator).toBeInstanceOf(Object);

      // 检查没有创建新的 coordinator 类
      // (通过检查方法是否存在来验证)
      const coordinatorProto = Object.getPrototypeOf(coordinator);
      expect(coordinatorProto.constructor.name).toBe('CoordinatorV1');
    });
  });
});