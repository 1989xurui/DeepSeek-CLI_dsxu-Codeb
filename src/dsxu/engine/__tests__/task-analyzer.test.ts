/**
 * 任务分析器测试
 */

import { TaskAnalyzer } from '../task-analyzer';
import { AgentRole } from '../coordinator-types-v1';

describe('TaskAnalyzer', () => {
  let analyzer: TaskAnalyzer;

  beforeEach(() => {
    analyzer = new TaskAnalyzer(TaskAnalyzer.getDefaultConfig());
  });

  describe('analyzeTask', () => {
    it('应该分析简单任务', async () => {
      const result = await analyzer.analyzeTask(
        'test-1',
        '修复按钮样式问题',
        '修复登录页面的按钮样式问题，按钮颜色不正确'
      );

      expect(result.taskId).toBe('test-1');
      expect(result.taskTitle).toBe('修复按钮样式问题');
      expect(result.complexity).toBe('low');
      expect(result.riskLevel).toBe('low');
      expect(result.verificationRequirement).toBe('none');
      expect(result.contextOverlapPreference).toBe('either');

      // 简单任务应该只有基础角色
      expect(result.recommendedRoles).toContain('worker');
      expect(result.recommendedRoles).toContain('implementer');
      expect(result.recommendedRoles.length).toBeGreaterThanOrEqual(2);

      expect(result.dsxuParityScore).toBeGreaterThanOrEqual(0);
      expect(result.dsxuParityScore).toBeLessThanOrEqual(100);
    });

    it('应该分析中等复杂度任务', async () => {
      const result = await analyzer.analyzeTask(
        'test-2',
        '添加用户管理API',
        '实现用户管理的REST API，包括创建、读取、更新、删除用户功能'
      );

      expect(result.complexity).toBe('medium');
      expect(result.riskLevel).toBe('medium'); // API 相关任务有中等风险
      expect(result.verificationRequirement).toBe('independent');

      // 中等复杂度任务应该有更多角色
      expect(result.recommendedRoles).toContain('explorer');
      expect(result.recommendedRoles.length).toBeGreaterThanOrEqual(3);
    });

    it('应该分析高风险任务', async () => {
      const result = await analyzer.analyzeTask(
        'test-3',
        '实现支付安全功能',
        '实现支付系统的安全认证和授权功能，处理敏感支付数据'
      );

      expect(result.riskLevel).toBe('high');
      expect(result.verificationRequirement).toBe('strict');

      // 高风险任务应该有验证者角色
      expect(result.recommendedRoles).toContain('verifier');

      // 验证需求应该是严格的
      expect(result.validationRequirements.level).toBe('strict');
      expect(result.validationRequirements.requiredRoles).toContain('verifier');
    });

    it('应该分析高复杂度任务', async () => {
      const result = await analyzer.analyzeTask(
        'test-4',
        '重构系统架构',
        '重构整个系统的微服务架构，优化性能和安全'
      );

      expect(result.complexity).toBe('high');

      // 高复杂度任务应该有研究员和专家角色
      expect(result.recommendedRoles).toContain('researcher');
      expect(result.recommendedRoles).toContain('specialist');

      // 应该有协调器决策
      expect(result.coordinatorDecision).not.toBeNull();
      expect(result.coordinatorDecision?.coordinatorRole).toBe('coordinator');
    });

    it('应该处理上下文重叠偏好', async () => {
      // 测试继续上下文
      const continueResult = await analyzer.analyzeTask(
        'test-5',
        '继续优化用户界面',
        '基于之前的UI优化工作，继续改进用户界面体验'
      );

      expect(continueResult.contextOverlapPreference).toBe('continue');
      expect(continueResult.contextManagement.contextSharing).toBe(true);

      // 测试全新上下文
      const freshResult = await analyzer.analyzeTask(
        'test-6',
        '开发新功能模块',
        '从头开始开发一个全新的数据分析模块'
      );

      expect(freshResult.contextOverlapPreference).toBe('fresh');
      expect(freshResult.contextManagement.isolationRequirements).toContain('全新工作空间');
    });

    it('应该包含依赖分析', async () => {
      const result = await analyzer.analyzeTask(
        'test-7',
        '集成第三方支付API',
        '集成支付宝和微信支付的第三方API，处理支付回调'
      );

      expect(result.dependencies.externalDependencies).toContain('API');
      expect(result.dependencies.externalDependencies).toContain('第三方');
      expect(result.dependencies.dependencyComplexity).toBe('medium');
    });

    it('应该包含风险分析', async () => {
      const result = await analyzer.analyzeTask(
        'test-8',
        '处理敏感用户数据',
        '处理用户的个人身份信息和支付数据，需要确保安全合规'
      );

      expect(result.riskAnalysis.identifiedRisks.length).toBeGreaterThan(0);
      expect(result.riskAnalysis.overallRiskScore).toBeGreaterThan(0);
      expect(result.riskAnalysis.riskMitigationPlan.length).toBeGreaterThan(0);
    });

    it('应该包含质量指标', async () => {
      const result = await analyzer.analyzeTask(
        'test-9',
        '编写API文档',
        '为所有REST API编写详细的文档和示例'
      );

      expect(result.qualityMetrics.documentationNeeds).toBe('high');
      expect(result.qualityMetrics.testability).toBeDefined();
      expect(result.qualityMetrics.maintainability).toBeDefined();
      expect(result.qualityMetrics.reviewComplexity).toBeDefined();
    });

    it('应该计算DSXU对位分数', async () => {
      const result = await analyzer.analyzeTask(
        'test-10',
        '综合测试任务',
        '这是一个包含多个方面的测试任务，用于验证分析器的综合能力'
      );

      expect(result.dsxuParityScore).toBeGreaterThanOrEqual(0);
      expect(result.dsxuParityScore).toBeLessThanOrEqual(100);
      expect(result.absorptionLevel).toMatch(/none|partial|full|enhanced/);
    });
  });

  describe('私有方法', () => {
    it('analyzeComplexity 应该正确判断复杂度', () => {
      // 使用反射调用私有方法
      const analyzerInstance = analyzer as any;

      expect(analyzerInstance.analyzeComplexity('简单修复')).toBe('low');
      expect(analyzerInstance.analyzeComplexity('实现新功能')).toBe('medium');
      expect(analyzerInstance.analyzeComplexity('重构复杂系统架构')).toBe('high');
    });

    it('analyzeRiskLevel 应该正确判断风险级别', () => {
      const analyzerInstance = analyzer as any;

      expect(analyzerInstance.analyzeRiskLevel('修复样式问题')).toBe('low');
      expect(analyzerInstance.analyzeRiskLevel('实现API接口')).toBe('medium');
      expect(analyzerInstance.analyzeRiskLevel('处理支付安全')).toBe('high');
    });

    it('calculateDSXUParityScore 应该计算合理分数', () => {
      const analyzerInstance = analyzer as any;

      const roleAnalysis = {
        recommendedRoles: ['worker', 'implementer'] as AgentRole[],
        roleRationale: { worker: '基础', implementer: '实现' },
        roleSuitability: { worker: 80, implementer: 90 }
      };

      const ruleAnalysis = {
        appliedRules: [],
        ruleConfidence: {}
      };

      const score = analyzerInstance.calculateDSXUParityScore(
        roleAnalysis,
        ruleAnalysis,
        null
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
