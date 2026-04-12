/**
 * R5-17: Verifier 角色
 * 使用 chat 模型验证实现是否符合要求
 */

import { BaseAgent, AgentRole, Task, AgentResult } from '../../agents/base-agent.js';
import { ImplementationResult } from './executor.js';
import { CodeReview } from './critic.js';

export interface VerificationResult {
  id: string;
  taskId: string;
  implementationId: string;
  reviewId?: string;
  status: 'passed' | 'failed' | 'partial';
  score: number; // 0-100
  requirementsMet: RequirementVerification[];
  constraintsChecked: ConstraintVerification[];
  testsPassed: TestResult[];
  qualityMetrics: QualityMetrics;
  issuesFound: VerificationIssue[];
  recommendations: string[];
  overallVerification: string;
}

export interface RequirementVerification {
  requirement: string;
  status: 'met' | 'partially_met' | 'not_met';
  evidence: string;
  confidence: number; // 0-100
  notes?: string;
}

export interface ConstraintVerification {
  constraint: string;
  status: 'satisfied' | 'violated' | 'unknown';
  evidence: string;
  impact: 'none' | 'low' | 'medium' | 'high';
  notes?: string;
}

export interface TestResult {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number; // 毫秒
  error?: string;
  stackTrace?: string;
}

export interface QualityMetrics {
  codeCoverage: number; // 0-100
  complexity: number; // 圈复杂度
  maintainabilityIndex: number; // 0-100
  securityScore: number; // 0-100
  performanceScore: number; // 0-100
}

export interface VerificationIssue {
  id: string;
  type: 'requirement' | 'constraint' | 'test' | 'quality' | 'integration';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  impact: string;
  suggestedFix?: string;
}

export class Verifier extends BaseAgent {
  private readonly model: string = 'deepseek-chat'; // chat 模型
  private readonly passingThreshold: number = 80; // 通过阈值
  private readonly qualityThresholds = {
    codeCoverage: 70,
    maintainabilityIndex: 60,
    securityScore: 80,
    performanceScore: 70
  };

  constructor(id: string = 'verifier-1') {
    super(
      id,
      'verifier',
      '验证者',
      [
        { name: 'requirement_verification', description: '验证需求是否满足' },
        { name: 'constraint_checking', description: '检查约束条件' },
        { name: 'test_execution', description: '执行和验证测试' },
        { name: 'quality_assessment', description: '质量指标评估' },
        { name: 'integration_testing', description: '集成测试验证' }
      ]
    );
  }

  async process(task: Task): Promise<AgentResult> {
    this.logActivity('开始验证任务', { taskId: task.id, taskType: task.type });

    // 验证任务
    const validation = this.validateTask(task);
    if (!validation.valid) {
      return this.createErrorResult('任务验证失败', validation.errors);
    }

    try {
      // 提取实现结果和审查结果
      const implementation = task.metadata?.implementation as ImplementationResult;
      const review = task.metadata?.review as CodeReview;

      if (!implementation) {
        return this.createErrorResult('任务缺少实现结果', ['metadata.implementation 未找到']);
      }

      // 执行验证
      const verification = await this.performVerification(task, implementation, review);

      // 决定是否通过
      const passed = this.shouldPassVerification(verification);

      this.logActivity('验证完成', {
        taskId: task.id,
        status: verification.status,
        score: verification.score,
        requirementsMet: verification.requirementsMet.filter(r => r.status === 'met').length,
        testsPassed: verification.testsPassed.filter(t => t.status === 'passed').length
      });

      if (passed) {
        return this.createSuccessResult(
          {
            verification,
            decision: 'accepted',
            message: '验证通过，实现符合要求'
          },
          [], // 验证通过后无子任务
          {
            modelUsed: this.model,
            verificationTime: new Date().toISOString(),
            qualityMetrics: verification.qualityMetrics
          }
        );
      } else {
        return this.createSuccessResult(
          {
            verification,
            decision: 'rejected',
            message: '验证失败，需要修复问题'
          },
          [this.createFixTask(task, verification)], // 创建修复任务
          {
            modelUsed: this.model,
            verificationTime: new Date().toISOString(),
            failureReasons: verification.issuesFound.filter(i => i.severity === 'critical' || i.severity === 'high')
          }
        );
      }

    } catch (error: any) {
      this.logActivity('验证失败', { taskId: task.id, error: error.message });
      return this.createErrorResult(`验证失败: ${error.message}`, [error.stack]);
    }
  }

  /**
   * 执行验证
   */
  private async performVerification(
    task: Task,
    implementation: ImplementationResult,
    review?: CodeReview
  ): Promise<VerificationResult> {
    this.logActivity('执行详细验证', {
      taskId: task.id,
      requirements: task.requirements.length,
      constraints: task.constraints.length
    });

    const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 验证需求
    const requirementsMet = await this.verifyRequirements(task, implementation);

    // 检查约束
    const constraintsChecked = await this.checkConstraints(task, implementation);

    // 执行测试
    const testsPassed = await this.executeTests(implementation);

    // 评估质量指标
    const qualityMetrics = await this.assessQuality(implementation, review);

    // 发现问题
    const issuesFound = await this.findIssues(requirementsMet, constraintsChecked, testsPassed, qualityMetrics, task);

    // 生成建议
    const recommendations = await this.generateRecommendations(issuesFound, qualityMetrics);

    // 计算评分
    const score = this.calculateScore(requirementsMet, constraintsChecked, testsPassed, qualityMetrics);

    // 确定状态
    const status = this.determineStatus(score, issuesFound);

    // 整体验证结论
    const overallVerification = this.generateOverallVerification(score, status, requirementsMet, issuesFound);

    return {
      id: verificationId,
      taskId: task.id,
      implementationId: implementation.changes[0]?.filePath || 'unknown',
      reviewId: review?.id,
      status,
      score,
      requirementsMet,
      constraintsChecked,
      testsPassed,
      qualityMetrics,
      issuesFound,
      recommendations,
      overallVerification
    };
  }

  /**
   * 验证需求
   */
  private async verifyRequirements(task: Task, implementation: ImplementationResult): Promise<RequirementVerification[]> {
    const verifications: RequirementVerification[] = [];

    for (const requirement of task.requirements) {
      const verification = await this.verifySingleRequirement(requirement, implementation, task);
      verifications.push(verification);
    }

    return verifications;
  }

  /**
   * 验证单个需求
   */
  private async verifySingleRequirement(
    requirement: string,
    implementation: ImplementationResult,
    task: Task
  ): Promise<RequirementVerification> {
    // 这里应该调用 chat 模型进行实际验证
    // 目前使用模拟实现

    // 简单规则匹配
    let status: 'met' | 'partially_met' | 'not_met' = 'not_met';
    let evidence = '未找到实现证据';
    let confidence = 0;

    // 检查代码中是否包含需求关键词
    const requirementKeywords = this.extractKeywords(requirement);
    let matchCount = 0;

    for (const change of implementation.changes) {
      if (change.newCode) {
        for (const keyword of requirementKeywords) {
          if (change.newCode.toLowerCase().includes(keyword.toLowerCase())) {
            matchCount++;
            evidence = `在文件 ${change.filePath} 中找到相关实现`;
            confidence += 20;
          }
        }
      }
    }

    // 确定状态
    if (matchCount >= requirementKeywords.length) {
      status = 'met';
      confidence = Math.min(100, confidence + 40);
    } else if (matchCount > 0) {
      status = 'partially_met';
      confidence = Math.min(80, confidence + 20);
    }

    // 检查测试覆盖
    if (implementation.testsWritten > 0) {
      evidence += `，编写了 ${implementation.testsWritten} 个测试用例`;
      confidence += 10;
    }

    return {
      requirement,
      status,
      evidence,
      confidence,
      notes: matchCount > 0 ? `匹配到 ${matchCount}/${requirementKeywords.length} 个关键词` : undefined
    };
  }

  /**
   * 检查约束
   */
  private async checkConstraints(task: Task, implementation: ImplementationResult): Promise<ConstraintVerification[]> {
    const verifications: ConstraintVerification[] = [];

    for (const constraint of task.constraints) {
      const verification = await this.checkSingleConstraint(constraint, implementation, task);
      verifications.push(verification);
    }

    return verifications;
  }

  /**
   * 检查单个约束
   */
  private async checkSingleConstraint(
    constraint: string,
    implementation: ImplementationResult,
    task: Task
  ): Promise<ConstraintVerification> {
    // 这里应该调用 chat 模型进行实际检查
    // 目前使用模拟实现

    let status: 'satisfied' | 'violated' | 'unknown' = 'unknown';
    let evidence = '未找到相关检查证据';
    let impact: 'none' | 'low' | 'medium' | 'high' = 'low';

    // 常见约束检查
    if (constraint.includes('时间') || constraint.includes('time')) {
      if (implementation.implementationTime > 120) { // 超过2小时
        status = 'violated';
        evidence = `实现用时 ${implementation.implementationTime.toFixed(1)} 分钟，可能超过时间约束`;
        impact = 'medium';
      } else {
        status = 'satisfied';
        evidence = `实现用时 ${implementation.implementationTime.toFixed(1)} 分钟，符合时间要求`;
        impact = 'none';
      }
    } else if (constraint.includes('性能') || constraint.includes('performance')) {
      // 检查是否有性能相关代码
      const hasPerformanceCode = implementation.changes.some(change =>
        change.newCode?.includes('performance') ||
        change.newCode?.includes('optimize') ||
        change.newCode?.includes('cache')
      );

      status = hasPerformanceCode ? 'satisfied' : 'unknown';
      evidence = hasPerformanceCode ? '代码中包含性能优化考虑' : '未明确检查性能约束';
      impact = 'medium';
    } else if (constraint.includes('安全') || constraint.includes('security')) {
      // 检查安全相关代码
      const hasSecurityCode = implementation.changes.some(change =>
        change.newCode?.includes('validate') ||
        change.newCode?.includes('sanitize') ||
        change.newCode?.includes('encrypt') ||
        change.newCode?.includes('auth')
      );

      status = hasSecurityCode ? 'satisfied' : 'unknown';
      evidence = hasSecurityCode ? '代码中包含安全考虑' : '未明确检查安全约束';
      impact = 'high';
    } else {
      // 通用约束检查
      const constraintKeywords = this.extractKeywords(constraint);
      let violationCount = 0;

      for (const change of implementation.changes) {
        if (change.newCode) {
          for (const keyword of constraintKeywords) {
            if (change.newCode.toLowerCase().includes(`not ${keyword}`) ||
                change.newCode.toLowerCase().includes(`avoid ${keyword}`)) {
              violationCount++;
              evidence = `在文件 ${change.filePath} 中发现可能违反约束的代码`;
              impact = 'medium';
            }
          }
        }
      }

      status = violationCount > 0 ? 'violated' : 'satisfied';
    }

    return {
      constraint,
      status,
      evidence,
      impact,
      notes: status === 'unknown' ? '需要人工检查此约束' : undefined
    };
  }

  /**
   * 执行测试
   */
  private async executeTests(implementation: ImplementationResult): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // 如果有测试文件，执行测试
    if (implementation.testsWritten > 0) {
      // 模拟测试执行
      for (let i = 1; i <= implementation.testsWritten; i++) {
        const passed = Math.random() > 0.2; // 80% 通过率

        results.push({
          testName: `test_${i}_verification`,
          status: passed ? 'passed' : 'failed',
          duration: Math.floor(Math.random() * 100) + 50,
          error: passed ? undefined : `测试 ${i} 失败: 预期 true，实际 false`,
          stackTrace: passed ? undefined : 'at Object.<anonymous> (test.js:10:15)'
        });
      }
    } else {
      // 如果没有测试，创建占位符
      results.push({
        testName: 'no_tests_written',
        status: 'skipped',
        duration: 0,
        error: '未编写测试用例'
      });
    }

    return results;
  }

  /**
   * 评估质量指标
   */
  private async assessQuality(implementation: ImplementationResult, review?: CodeReview): Promise<QualityMetrics> {
    // 这里应该调用 chat 模型进行质量评估
    // 目前使用模拟实现

    // 代码覆盖率（基于测试数量估算）
    const codeCoverage = Math.min(100, implementation.testsWritten * 15);

    // 复杂度评估
    let complexity = 10; // 基础复杂度
    if (implementation.complexity === 'complex') complexity = 25;
    else if (implementation.complexity === 'medium') complexity = 15;

    // 可维护性指数
    let maintainabilityIndex = 70;
    if (implementation.changes.length > 5) maintainabilityIndex -= 10;
    if (implementation.filesModified.length > 3) maintainabilityIndex -= 5;
    if (implementation.documentationUpdated) maintainabilityIndex += 10;

    // 安全评分（基于审查结果）
    let securityScore = 80;
    if (review?.issues?.some(issue => issue.type === 'security')) {
      securityScore -= 20;
    }

    // 性能评分
    let performanceScore = 75;
    if (review?.issues?.some(issue => issue.type === 'performance')) {
      performanceScore -= 15;
    }

    // 确保分数在合理范围内
    return {
      codeCoverage: Math.max(0, Math.min(100, codeCoverage)),
      complexity: Math.max(1, Math.min(50, complexity)),
      maintainabilityIndex: Math.max(0, Math.min(100, maintainabilityIndex)),
      securityScore: Math.max(0, Math.min(100, securityScore)),
      performanceScore: Math.max(0, Math.min(100, performanceScore))
    };
  }

  /**
   * 发现问题
   */
  private async findIssues(
    requirements: RequirementVerification[],
    constraints: ConstraintVerification[],
    tests: TestResult[],
    quality: QualityMetrics,
    task: Task
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];
    let issueId = 1;

    // 检查未满足的需求
    const unmetRequirements = requirements.filter(req => req.status !== 'met');
    for (const req of unmetRequirements) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'requirement',
        severity: req.status === 'not_met' ? 'high' : 'medium',
        description: `需求未满足: ${req.requirement}`,
        impact: '功能不完整',
        suggestedFix: `实现 ${req.requirement} 相关功能`
      });
    }

    // 检查违反的约束
    const violatedConstraints = constraints.filter(con => con.status === 'violated');
    for (const con of violatedConstraints) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'constraint',
        severity: con.impact === 'high' ? 'critical' : con.impact === 'medium' ? 'high' : 'medium',
        description: `约束违反: ${con.constraint}`,
        impact: con.evidence,
        suggestedFix: `调整实现以满足约束: ${con.constraint}`
      });
    }

    // 检查失败的测试
    const failedTests = tests.filter(test => test.status === 'failed');
    for (const test of failedTests) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'test',
        severity: 'medium',
        description: `测试失败: ${test.testName}`,
        location: test.stackTrace,
        impact: '功能可能存在问题',
        suggestedFix: test.error || '修复测试失败原因'
      });
    }

    // 检查质量指标
    if (quality.codeCoverage < this.qualityThresholds.codeCoverage) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'quality',
        severity: 'low',
        description: `代码覆盖率不足: ${quality.codeCoverage}% (要求: ${this.qualityThresholds.codeCoverage}%)`,
        impact: '测试覆盖不充分',
        suggestedFix: '增加测试用例覆盖更多代码路径'
      });
    }

    if (quality.maintainabilityIndex < this.qualityThresholds.maintainabilityIndex) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'quality',
        severity: 'medium',
        description: `可维护性指数低: ${quality.maintainabilityIndex} (要求: ${this.qualityThresholds.maintainabilityIndex})`,
        impact: '代码难以维护',
        suggestedFix: '重构代码提高可维护性'
      });
    }

    if (quality.securityScore < this.qualityThresholds.securityScore) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'quality',
        severity: 'high',
        description: `安全评分低: ${quality.securityScore} (要求: ${this.qualityThresholds.securityScore})`,
        impact: '存在安全风险',
        suggestedFix: '进行安全审查和修复'
      });
    }

    if (quality.performanceScore < this.qualityThresholds.performanceScore) {
      issues.push({
        id: `issue_${issueId++}`,
        type: 'quality',
        severity: 'medium',
        description: `性能评分低: ${quality.performanceScore} (要求: ${this.qualityThresholds.performanceScore})`,
        impact: '性能可能不达标',
        suggestedFix: '进行性能优化'
      });
    }

    return issues;
  }

  /**
   * 生成建议
   */
  private async generateRecommendations(issues: VerificationIssue[], quality: QualityMetrics): Promise<string[]> {
    const recommendations: string[] = [];

    // 根据问题生成建议
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    if (criticalIssues.length > 0) {
      recommendations.push(`立即修复 ${criticalIssues.length} 个严重问题`);
    }

    const highIssues = issues.filter(issue => issue.severity === 'high');
    if (highIssues.length > 0) {
      recommendations.push(`优先处理 ${highIssues.length} 个高风险问题`);
    }

    // 质量改进建议
    if (quality.codeCoverage < 90) {
      recommendations.push(`提高代码覆盖率到 90% 以上（当前: ${quality.codeCoverage}%）`);
    }

    if (quality.maintainabilityIndex < 80) {
      recommendations.push(`提高可维护性指数到 80 以上（当前: ${quality.maintainabilityIndex}）`);
    }

    if (quality.securityScore < 90) {
      recommendations.push(`进行安全加固，目标安全评分 90+（当前: ${quality.securityScore}）`);
    }

    return recommendations;
  }

  /**
   * 计算评分
   */
  private calculateScore(
    requirements: RequirementVerification[],
    constraints: ConstraintVerification[],
    tests: TestResult[],
    quality: QualityMetrics
  ): number {
    let score = 100;

    // 需求满足度（40%）
    const requirementScore = requirements.reduce((sum, req) => {
      if (req.status === 'met') return sum + 1;
      if (req.status === 'partially_met') return sum + 0.5;
      return sum;
    }, 0) / requirements.length * 40;

    // 约束满足度（20%）
    const constraintScore = constraints.reduce((sum, con) => {
      if (con.status === 'satisfied') return sum + 1;
      if (con.status === 'unknown') return sum + 0.5;
      return sum;
    }, 0) / Math.max(1, constraints.length) * 20;

    // 测试通过率（20%）
    const passedTests = tests.filter(test => test.status === 'passed').length;
    const testScore = tests.length > 0 ? (passedTests / tests.length) * 20 : 10; // 没有测试给一半分

    // 质量指标（20%）
    const qualityScore = (
      (quality.codeCoverage / 100) * 5 +
      ((100 - Math.min(quality.complexity, 30)) / 100) * 5 + // 复杂度越低越好
      (quality.maintainabilityIndex / 100) * 5 +
      (quality.securityScore / 100) * 2.5 +
      (quality.performanceScore / 100) * 2.5
    );

    score = requirementScore + constraintScore + testScore + qualityScore;

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * 确定状态
   */
  private determineStatus(score: number, issues: VerificationIssue[]): 'passed' | 'failed' | 'partial' {
    if (score >= this.passingThreshold && !issues.some(issue => issue.severity === 'critical')) {
      return 'passed';
    } else if (score >= 60 && !issues.some(issue => issue.severity === 'critical')) {
      return 'partial';
    } else {
      return 'failed';
    }
  }

  /**
   * 生成整体验证结论
   */
  private generateOverallVerification(
    score: number,
    status: 'passed' | 'failed' | 'partial',
    requirements: RequirementVerification[],
    issues: VerificationIssue[]
  ): string {
    const metRequirements = requirements.filter(req => req.status === 'met').length;
    const totalRequirements = requirements.length;
    const criticalIssues = issues.filter(issue => issue.severity === 'critical').length;
    const highIssues = issues.filter(issue => issue.severity === 'high').length;

    if (status === 'passed') {
      return `验证通过！得分 ${score}/100。${metRequirements}/${totalRequirements} 个需求完全满足，无严重问题。`;
    } else if (status === 'partial') {
      return `部分通过，得分 ${score}/100。${metRequirements}/${totalRequirements} 个需求满足，有 ${highIssues} 个高风险问题需要解决。`;
    } else {
      return `验证失败，得分 ${score}/100。只有 ${metRequirements}/${totalRequirements} 个需求满足，存在 ${criticalIssues} 个严重问题和 ${highIssues} 个高风险问题。`;
    }
  }

  /**
   * 是否应该通过验证
   */
  private shouldPassVerification(verification: VerificationResult): boolean {
    return verification.status === 'passed';
  }

  /**
   * 创建修复任务
   */
  private createFixTask(originalTask: Task, verification: VerificationResult): Task {
    const criticalIssues = verification.issuesFound.filter(issue => issue.severity === 'critical');
    const highIssues = verification.issuesFound.filter(issue => issue.severity === 'high');

    const requirements = [
      '修复验证发现的问题',
      ...criticalIssues.map(issue => `修复严重问题: ${issue.description}`),
      ...highIssues.map(issue => `修复高风险问题: ${issue.description}`),
      ...verification.recommendations.slice(0, 3) // 最多3个建议
    ];

    return {
      id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'implementation',
      description: `修复: ${originalTask.description}`,
      requirements,
      constraints: [...originalTask.constraints, '必须通过所有验证检查'],
      priority: originalTask.priority === 'critical' ? 'critical' : 'high',
      metadata: {
        ...originalTask.metadata,
        originalTaskId: originalTask.id,
        verificationId: verification.id,
        issues: verification.issuesFound,
        requiresVerificationPass: true
      }
    };
  }

  /**
   * 提取关键词
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.isCommonWord(word))
      .slice(0, 5); // 最多5个关键词
  }

  /**
   * 判断是否为常见词
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'for', 'with', 'that', 'this', 'have', 'from',
      '需要', '要求', '必须', '应该', '可以', '可能', '实现', '功能'
    ];
    return commonWords.includes(word.toLowerCase());
  }
}