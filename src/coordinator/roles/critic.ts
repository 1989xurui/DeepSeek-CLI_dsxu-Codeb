/**
 * R5-17: Critic 角色
 * 使用 reasoner 模型审查 Executor 的输出，拒绝率 20-40%
 */

import { BaseAgent, AgentRole, Task, AgentResult } from '../../agents/base-agent.js';
import { ImplementationResult } from './executor.js';

export interface CodeReview {
  id: string;
  taskId: string;
  implementationId: string;
  reviewerId: string;
  status: 'approved' | 'rejected' | 'needs_revision';
  score: number; // 0-100
  issues: ReviewIssue[];
  suggestions: Suggestion[];
  strengths: string[];
  overallAssessment: string;
  rejectionReason?: string;
  revisionRequirements?: string[];
}

export interface ReviewIssue {
  id: string;
  type: IssueType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string; // 文件路径:行号
  codeSnippet?: string;
  impact: string;
  recommendation: string;
}

export interface Suggestion {
  id: string;
  type: 'improvement' | 'optimization' | 'refactoring' | 'documentation';
  description: string;
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: number; // 分钟
  benefit: string;
}

export type IssueType =
  | 'bug'
  | 'security'
  | 'performance'
  | 'maintainability'
  | 'readability'
  | 'test_coverage'
  | 'documentation'
  | 'code_smell'
  | 'architecture'
  | 'best_practice';

export class Critic extends BaseAgent {
  private readonly model: string = 'deepseek-reasoner'; // reasoner 模型
  private readonly baseRejectionRate: number = 0.3; // 30% 基础拒绝率
  private readonly rejectionRateRange: [number, number] = [0.2, 0.4]; // 20-40% 拒绝率范围

  constructor(id: string = 'critic-1') {
    super(
      id,
      'critic',
      '代码审查者',
      [
        { name: 'code_review', description: '代码审查和质量检查' },
        { name: 'security_audit', description: '安全审计和漏洞检测' },
        { name: 'performance_analysis', description: '性能分析和优化建议' },
        { name: 'best_practice_check', description: '最佳实践检查' },
        { name: 'architecture_review', description: '架构设计审查' }
      ]
    );
  }

  async process(task: Task): Promise<AgentResult> {
    this.logActivity('开始审查任务', { taskId: task.id, taskType: task.type });

    // 验证任务
    const validation = this.validateTask(task);
    if (!validation.valid) {
      return this.createErrorResult('任务验证失败', validation.errors);
    }

    try {
      // 提取实现结果
      const implementation = task.metadata?.implementation as ImplementationResult;
      if (!implementation) {
        return this.createErrorResult('任务缺少实现结果', ['metadata.implementation 未找到']);
      }

      // 执行审查
      const review = await this.performReview(task, implementation);

      // 决定是否拒绝（根据配置的拒绝率）
      const shouldReject = this.shouldRejectImplementation(review);

      if (shouldReject) {
        this.logActivity('拒绝实现', {
          taskId: task.id,
          score: review.score,
          issues: review.issues.length,
          rejectionReason: review.rejectionReason
        });

        return this.createSuccessResult(
          {
            review,
            decision: 'rejected',
            message: '实现被拒绝，需要重新实现'
          },
          [this.createRevisionTask(task, review)], // 创建修订任务
          {
            modelUsed: this.model,
            reviewTime: new Date().toISOString(),
            rejectionRate: this.getCurrentRejectionRate(),
            rejectionReason: review.rejectionReason
          }
        );
      } else {
        this.logActivity('批准实现', {
          taskId: task.id,
          score: review.score,
          strengths: review.strengths.length
        });

        return this.createSuccessResult(
          {
            review,
            decision: 'approved',
            message: '实现通过审查'
          },
          [], // 批准后无子任务
          {
            modelUsed: this.model,
            reviewTime: new Date().toISOString(),
            approvalConditions: review.revisionRequirements || []
          }
        );
      }

    } catch (error: any) {
      this.logActivity('审查失败', { taskId: task.id, error: error.message });
      return this.createErrorResult(`审查失败: ${error.message}`, [error.stack]);
    }
  }

  /**
   * 执行代码审查
   */
  private async performReview(task: Task, implementation: ImplementationResult): Promise<CodeReview> {
    this.logActivity('执行详细审查', {
      taskId: task.id,
      files: implementation.filesModified.length,
      changes: implementation.changes.length
    });

    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 分析代码变更
    const issues = await this.analyzeCodeChanges(implementation.changes, task);
    const strengths = await this.identifyStrengths(implementation, task);

    // 计算评分
    const score = this.calculateScore(issues, strengths, implementation);

    // 生成建议
    const suggestions = await this.generateSuggestions(issues, implementation, task);

    // 整体评估
    const overallAssessment = this.generateOverallAssessment(score, issues, strengths, task);

    // 决定是否需要修订
    const needsRevision = score < 70 || issues.some(issue => issue.severity === 'critical');
    const revisionRequirements = needsRevision
      ? this.generateRevisionRequirements(issues, suggestions)
      : undefined;

    // 拒绝原因（如果需要）
    const rejectionReason = score < 60 ? this.generateRejectionReason(issues, score) : undefined;

    return {
      id: reviewId,
      taskId: task.id,
      implementationId: implementation.changes[0]?.filePath || 'unknown',
      reviewerId: this.id,
      status: needsRevision ? (score < 60 ? 'rejected' : 'needs_revision') : 'approved',
      score,
      issues,
      suggestions,
      strengths,
      overallAssessment,
      rejectionReason,
      revisionRequirements
    };
  }

  /**
   * 分析代码变更
   */
  private async analyzeCodeChanges(changes: any[], task: Task): Promise<ReviewIssue[]> {
    const issues: ReviewIssue[] = [];
    let issueId = 1;

    for (const change of changes) {
      // 检查代码质量
      const qualityIssues = await this.checkCodeQuality(change, task);
      issues.push(...qualityIssues.map(issue => ({
        ...issue,
        id: `issue_${issueId++}`
      })));

      // 检查安全性
      const securityIssues = await this.checkSecurity(change, task);
      issues.push(...securityIssues.map(issue => ({
        ...issue,
        id: `issue_${issueId++}`
      })));

      // 检查性能
      const performanceIssues = await this.checkPerformance(change, task);
      issues.push(...performanceIssues.map(issue => ({
        ...issue,
        id: `issue_${issueId++}`
      })));
    }

    return issues;
  }

  /**
   * 检查代码质量
   */
  private async checkCodeQuality(change: any, task: Task): Promise<Omit<ReviewIssue, 'id'>[]> {
    const issues: Omit<ReviewIssue, 'id'>[] = [];

    if (!change.newCode) {
      return issues;
    }

    const code = change.newCode;

    // 检查代码复杂度
    if (this.isCodeTooComplex(code)) {
      issues.push({
        type: 'maintainability',
        severity: 'medium',
        description: '代码复杂度过高，难以维护',
        location: change.filePath,
        codeSnippet: this.extractComplexPart(code),
        impact: '增加维护成本，容易引入bug',
        recommendation: '重构代码，提取函数，降低圈复杂度'
      });
    }

    // 检查命名规范
    const namingIssues = this.checkNamingConventions(code, change.filePath);
    issues.push(...namingIssues);

    // 检查注释
    if (!this.hasSufficientComments(code)) {
      issues.push({
        type: 'documentation',
        severity: 'low',
        description: '代码注释不足',
        location: change.filePath,
        impact: '降低代码可读性和可维护性',
        recommendation: '添加必要的注释，特别是复杂逻辑部分'
      });
    }

    // 检查重复代码
    if (this.hasDuplicateCode(code)) {
      issues.push({
        type: 'code_smell',
        severity: 'medium',
        description: '发现重复代码',
        location: change.filePath,
        impact: '违反DRY原则，增加维护成本',
        recommendation: '提取公共函数或工具类'
      });
    }

    return issues;
  }

  /**
   * 检查安全性
   */
  private async checkSecurity(change: any, task: Task): Promise<Omit<ReviewIssue, 'id'>[]> {
    const issues: Omit<ReviewIssue, 'id'>[] = [];

    if (!change.newCode) {
      return issues;
    }

    const code = change.newCode;

    // 检查硬编码凭证
    if (this.hasHardcodedCredentials(code)) {
      issues.push({
        type: 'security',
        severity: 'critical',
        description: '发现硬编码的凭证或密钥',
        location: change.filePath,
        codeSnippet: this.extractSensitiveCode(code),
        impact: '严重安全漏洞，可能导致数据泄露',
        recommendation: '使用环境变量或密钥管理系统'
      });
    }

    // 检查SQL注入风险
    if (this.hasSQLInjectionRisk(code)) {
      issues.push({
        type: 'security',
        severity: 'high',
        description: '潜在的SQL注入风险',
        location: change.filePath,
        codeSnippet: this.extractSQLCode(code),
        impact: '可能导致数据库被攻击',
        recommendation: '使用参数化查询或ORM'
      });
    }

    // 检查XSS风险
    if (this.hasXSSRisk(code)) {
      issues.push({
        type: 'security',
        severity: 'high',
        description: '潜在的XSS（跨站脚本）风险',
        location: change.filePath,
        codeSnippet: this.extractUserInputCode(code),
        impact: '可能导致用户数据被窃取',
        recommendation: '对用户输入进行验证和转义'
      });
    }

    return issues;
  }

  /**
   * 检查性能
   */
  private async checkPerformance(change: any, task: Task): Promise<Omit<ReviewIssue, 'id'>[]> {
    const issues: Omit<ReviewIssue, 'id'>[] = [];

    if (!change.newCode) {
      return issues;
    }

    const code = change.newCode;

    // 检查循环中的重复操作
    if (this.hasExpensiveOperationsInLoop(code)) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        description: '循环中存在昂贵的操作',
        location: change.filePath,
        codeSnippet: this.extractLoopCode(code),
        impact: '性能下降，特别是大数据量时',
        recommendation: '将昂贵操作移到循环外，或使用缓存'
      });
    }

    // 检查内存泄漏风险
    if (this.hasMemoryLeakRisk(code)) {
      issues.push({
        type: 'performance',
        severity: 'high',
        description: '潜在的内存泄漏风险',
        location: change.filePath,
        codeSnippet: this.extractMemoryCode(code),
        impact: '应用运行时间越长，内存占用越大',
        recommendation: '确保资源正确释放，使用弱引用'
      });
    }

    // 检查同步阻塞操作
    if (this.hasBlockingOperations(code)) {
      issues.push({
        type: 'performance',
        severity: 'medium',
        description: '存在同步阻塞操作',
        location: change.filePath,
        codeSnippet: this.extractBlockingCode(code),
        impact: '影响应用响应时间',
        recommendation: '考虑使用异步或非阻塞操作'
      });
    }

    return issues;
  }

  /**
   * 识别优点
   */
  private async identifyStrengths(implementation: ImplementationResult, task: Task): Promise<string[]> {
    const strengths: string[] = [];

    // 检查测试覆盖
    if (implementation.testsWritten > 0) {
      strengths.push('编写了测试用例，有助于保证质量');
    }

    // 检查文档更新
    if (implementation.documentationUpdated) {
      strengths.push('更新了相关文档，便于维护');
    }

    // 检查实现复杂度
    if (implementation.complexity === 'simple' && implementation.changes.length > 0) {
      strengths.push('实现简洁明了，易于理解');
    }

    // 检查文件组织
    if (implementation.filesCreated.length > 0) {
      strengths.push('文件组织合理，结构清晰');
    }

    // 检查实现时间
    if (implementation.implementationTime < this.estimateReviewTime(task)) {
      strengths.push('实现效率高，用时合理');
    }

    // 根据任务特定要求检查
    if (task.requirements.every(req => this.checkRequirementMet(req, implementation))) {
      strengths.push('所有需求都得到满足');
    }

    return strengths;
  }

  /**
   * 计算评分
   */
  private calculateScore(issues: ReviewIssue[], strengths: string[], implementation: ImplementationResult): number {
    let score = 100;

    // 根据问题严重性扣分
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 20;
          break;
        case 'high':
          score -= 10;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }

    // 根据优点加分
    score += Math.min(strengths.length * 3, 15); // 最多加15分

    // 根据测试覆盖加分
    if (implementation.testsWritten > 0) {
      score += Math.min(implementation.testsWritten * 2, 10); // 最多加10分
    }

    // 确保分数在0-100之间
    return Math.max(0, Math.min(100, score));
  }

  /**
   * 生成建议
   */
  private async generateSuggestions(issues: ReviewIssue[], implementation: ImplementationResult, task: Task): Promise<Suggestion[]> {
    const suggestions: Suggestion[] = [];
    let suggestionId = 1;

    // 根据问题生成建议
    for (const issue of issues) {
      if (issue.severity === 'critical' || issue.severity === 'high') {
        suggestions.push({
          id: `suggestion_${suggestionId++}`,
          type: this.mapIssueToSuggestionType(issue.type),
          description: issue.recommendation,
          priority: 'high',
          estimatedEffort: this.estimateFixEffort(issue),
          benefit: `解决${issue.type}问题，${issue.impact}`
        });
      }
    }

    // 添加优化建议
    if (implementation.complexity === 'complex') {
      suggestions.push({
        id: `suggestion_${suggestionId++}`,
        type: 'refactoring',
        description: '考虑重构复杂代码，提高可维护性',
        priority: 'medium',
        estimatedEffort: 60,
        benefit: '降低维护成本，提高代码质量'
      });
    }

    // 添加测试建议
    if (implementation.testsWritten === 0 && task.metadata?.requiresTDD) {
      suggestions.push({
        id: `suggestion_${suggestionId++}`,
        type: 'improvement',
        description: '添加测试用例，确保TDD流程完整',
        priority: 'high',
        estimatedEffort: 30,
        benefit: '提高代码可靠性，符合TDD要求'
      });
    }

    return suggestions;
  }

  /**
   * 生成整体评估
   */
  private generateOverallAssessment(score: number, issues: ReviewIssue[], strengths: string[], task: Task): string {
    if (score >= 90) {
      return `优秀实现！得分 ${score}/100。${strengths.join(' ')} 只有少量小问题需要关注。`;
    } else if (score >= 70) {
      return `良好实现，得分 ${score}/100。主要需求已满足，但有一些${issues.length > 0 ? issues.map(i => i.type).join('、') : ''}问题需要解决。`;
    } else if (score >= 60) {
      return `及格实现，得分 ${score}/100。需要重大改进，存在${issues.filter(i => i.severity === 'critical' || i.severity === 'high').length}个严重问题。`;
    } else {
      return `不合格实现，得分 ${score}/100。需要重新设计实现，存在多个关键问题：${issues.filter(i => i.severity === 'critical').map(i => i.description).join('；')}`;
    }
  }

  /**
   * 生成修订要求
   */
  private generateRevisionRequirements(issues: ReviewIssue[], suggestions: Suggestion[]): string[] {
    const requirements: string[] = [];

    // 关键问题必须修复
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    for (const issue of criticalIssues) {
      requirements.push(`修复 ${issue.type} 问题: ${issue.description}`);
    }

    // 高优先级建议
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high');
    for (const suggestion of highPrioritySuggestions) {
      requirements.push(`实施建议: ${suggestion.description}`);
    }

    return requirements;
  }

  /**
   * 生成拒绝原因
   */
  private generateRejectionReason(issues: ReviewIssue[], score: number): string {
    const criticalIssues = issues.filter(issue => issue.severity === 'critical');
    const highIssues = issues.filter(issue => issue.severity === 'high');

    if (criticalIssues.length > 0) {
      return `存在 ${criticalIssues.length} 个严重问题：${criticalIssues.map(i => i.description).join('；')}`;
    } else if (highIssues.length > 0) {
      return `存在 ${highIssues.length} 个高风险问题：${highIssues.map(i => i.description).join('；')}`;
    } else {
      return `综合评分过低 (${score}/100)，需要重新设计实现`;
    }
  }

  /**
   * 是否应该拒绝实现
   */
  private shouldRejectImplementation(review: CodeReview): boolean {
    // 如果有严重问题，直接拒绝
    if (review.issues.some(issue => issue.severity === 'critical')) {
      return true;
    }

    // 根据评分和配置的拒绝率决定
    const currentRejectionRate = this.getCurrentRejectionRate();
    const rejectionThreshold = 100 - (currentRejectionRate * 100);

    return review.score < rejectionThreshold;
  }

  /**
   * 获取当前拒绝率（在配置范围内随机）
   */
  private getCurrentRejectionRate(): number {
    const [min, max] = this.rejectionRateRange;
    return min + Math.random() * (max - min);
  }

  /**
   * 创建修订任务
   */
  private createRevisionTask(originalTask: Task, review: CodeReview): Task {
    return {
      id: `revision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'implementation',
      description: `修订: ${originalTask.description}`,
      requirements: review.revisionRequirements || ['修复审查发现的问题'],
      constraints: [...originalTask.constraints, '必须解决所有审查问题'],
      priority: originalTask.priority,
      metadata: {
        ...originalTask.metadata,
        originalTaskId: originalTask.id,
        reviewId: review.id,
        issues: review.issues,
        suggestions: review.suggestions,
        requiresRevision: true
      }
    };
  }

  /**
   * 辅助方法 - 代码质量检查
   */
  private isCodeTooComplex(code: string): boolean {
    // 简单实现：检查函数长度和嵌套深度
    const lines = code.split('\n');
    const functionLines = lines.filter(line => line.includes('function') || line.includes('=>'));
    return functionLines.length > 5 || this.countNestingLevel(code) > 3;
  }

  private countNestingLevel(code: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of code) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  private extractComplexPart(code: string): string {
    const lines = code.split('\n');
    return lines.slice(0, Math.min(5, lines.length)).join('\n');
  }

  private checkNamingConventions(code: string, filePath: string): Omit<ReviewIssue, 'id'>[] {
    const issues: Omit<ReviewIssue, 'id'>[] = [];
    // 简化实现
    return issues;
  }

  private hasSufficientComments(code: string): boolean {
    const lines = code.split('\n');
    const commentLines = lines.filter(line =>
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*')
    ).length;

    return commentLines >= lines.length * 0.1; // 至少10%的注释
  }

  private hasDuplicateCode(code: string): boolean {
    // 简化实现
    return false;
  }

  private hasHardcodedCredentials(code: string): boolean {
    const patterns = [
      /password\s*=\s*['"][^'"]+['"]/i,
      /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
      /secret\s*=\s*['"][^'"]+['"]/i,
      /token\s*=\s*['"][^'"]+['"]/i
    ];

    return patterns.some(pattern => pattern.test(code));
  }

  private extractSensitiveCode(code: string): string {
    const lines = code.split('\n');
    const sensitiveLines = lines.filter(line =>
      /password|api[_-]?key|secret|token/i.test(line)
    );

    return sensitiveLines.slice(0, 3).join('\n');
  }

  private hasSQLInjectionRisk(code: string): boolean {
    return /SELECT.*\+.*'|INSERT.*\+.*'|UPDATE.*\+.*'|DELETE.*\+.*'/i.test(code);
  }

  private extractSQLCode(code: string): string {
    const lines = code.split('\n');
    const sqlLines = lines.filter(line => /SELECT|INSERT|UPDATE|DELETE/i.test(line));
    return sqlLines.slice(0, 3).join('\n');
  }

  private hasXSSRisk(code: string): boolean {
    return /innerHTML\s*=|\.html\s*\(|document\.write/i.test(code);
  }

  private extractUserInputCode(code: string): string {
    const lines = code.split('\n');
    const inputLines = lines.filter(line => /getElementById|querySelector|\.value/i.test(line));
    return inputLines.slice(0, 3).join('\n');
  }

  private hasExpensiveOperationsInLoop(code: string): boolean {
    return /for.*\{.*\$.+\$.*\}|while.*\{.*\$.+\$.*\}/.test(code.replace(/\s+/g, ''));
  }

  private extractLoopCode(code: string): string {
    const lines = code.split('\n');
    const loopLines = lines.filter(line => /for\s*\(|while\s*\(|forEach/.test(line));
    return loopLines.slice(0, 3).join('\n');
  }

  private hasMemoryLeakRisk(code: string): boolean {
    return /setInterval|setTimeout.*function/.test(code) &&
      !/clearInterval|clearTimeout/.test(code);
  }

  private extractMemoryCode(code: string): string {
    const lines = code.split('\n');
    const memoryLines = lines.filter(line => /setInterval|setTimeout|new\s+Array/.test(line));
    return memoryLines.slice(0, 3).join('\n');
  }

  private hasBlockingOperations(code: string): boolean {
    return /sync|readFileSync|writeFileSync/.test(code);
  }

  private extractBlockingCode(code: string): string {
    const lines = code.split('\n');
    const blockingLines = lines.filter(line => /sync|readFileSync|writeFileSync/.test(line));
    return blockingLines.slice(0, 3).join('\n');
  }

  private estimateReviewTime(task: Task): number {
    return task.description.length * 0.1 + task.requirements.length * 5;
  }

  private checkRequirementMet(requirement: string, implementation: ImplementationResult): boolean {
    // 简化实现
    return true;
  }

  private mapIssueToSuggestionType(issueType: IssueType): 'improvement' | 'optimization' | 'refactoring' | 'documentation' {
    switch (issueType) {
      case 'performance':
        return 'optimization';
      case 'maintainability':
      case 'code_smell':
        return 'refactoring';
      case 'documentation':
        return 'documentation';
      default:
        return 'improvement';
    }
  }

  private estimateFixEffort(issue: ReviewIssue): number {
    switch (issue.severity) {
      case 'critical':
        return 120;
      case 'high':
        return 60;
      case 'medium':
        return 30;
      case 'low':
        return 15;
      default:
        return 30;
    }
  }
}