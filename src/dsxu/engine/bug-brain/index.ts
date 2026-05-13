/**
 * Bug Brain 核心模块
 * 吸收 DSXU 的失败经验归档机制
 */

import { v4 as uuidv4 } from 'uuid'
import {
  BugRecord,
  BugCategory,
  BugSeverity,
  BugSource,
  BugContext,
  BugPattern,
  FixPattern,
  BugAnalysis,
  BugStatistics,
} from './types'

/**
 * Bug Brain 配置
 */
export interface BugBrainConfig {
  maxRecords?: number
  patternDetectionThreshold?: number
  autoClassify?: boolean
  persistenceEnabled?: boolean
  debug?: boolean
}

/**
 * Bug Brain 核心类
 */
export class BugBrain {
  private records: Map<string, BugRecord> = new Map()
  private patterns: Map<string, BugPattern> = new Map()
  private fixPatterns: Map<string, FixPattern> = new Map()
  private config: BugBrainConfig

  constructor(config: BugBrainConfig = {}) {
    this.config = {
      maxRecords: 1000,
      patternDetectionThreshold: 3,
      autoClassify: true,
      persistenceEnabled: false,
      debug: false,
      ...config,
    }
  }

  /**
   * 记录 Bug
   * 吸收 DSXU 的失败摘要记录机制
   */
  recordBug(
    type: BugCategory,
    severity: BugSeverity,
    source: BugSource,
    description: string,
    context: BugContext,
    metadata?: Record<string, any>
  ): BugRecord {
    const bugRecord: BugRecord = {
      id: uuidv4(),
      type,
      severity,
      source,
      description,
      context,
      timestamp: Date.now(),
      metadata,
    }

    this.records.set(bugRecord.id, bugRecord)

    if (this.config.autoClassify) {
      this.autoClassifyBug(bugRecord)
    }

    this.detectPatterns()

    if (this.config.debug) {
      console.log(`[BugBrain] Recorded bug: ${bugRecord.id} (${type}, ${severity})`)
    }

    return bugRecord
  }

  /**
   * 自动分类 Bug
   * 吸收 DSXU 的智能分类机制
   */
  private autoClassifyBug(bugRecord: BugRecord): void {
    // 基于描述和上下文的简单分类增强
    const { description, context } = bugRecord

    // 如果已经是明确分类，保持原样
    if (bugRecord.type !== 'other') {
      return
    }

    // 基于关键词的分类
    const lowerDesc = description.toLowerCase()

    if (lowerDesc.includes('verify') || lowerDesc.includes('validation')) {
      bugRecord.type = 'verify-failure'
    } else if (lowerDesc.includes('review') || lowerDesc.includes('reject')) {
      bugRecord.type = 'reviewer-rejection'
    } else if (lowerDesc.includes('tool') || lowerDesc.includes('execution')) {
      bugRecord.type = 'tool-failure'
    } else if (lowerDesc.includes('context') || lowerDesc.includes('insufficient')) {
      bugRecord.type = 'context-insufficiency'
    } else if (lowerDesc.includes('retrieval') || lowerDesc.includes('search')) {
      bugRecord.type = 'graph-retrieval-miss'
    } else if (lowerDesc.includes('memory') || lowerDesc.includes('forget')) {
      bugRecord.type = 'memory-insufficiency'
    }

    // 基于上下文的分类
    if (context.errorStack?.includes('timeout')) {
      bugRecord.type = 'execution-timeout'
      bugRecord.severity = 'high'
    }
  }

  /**
   * 检测 Bug 模式
   * 吸收 DSXU 的模式识别机制
   */
  private detectPatterns(): void {
    const bugsByType = new Map<BugCategory, BugRecord[]>()

    // 按类型分组
    for (const bug of this.records.values()) {
      if (!bugsByType.has(bug.type)) {
        bugsByType.set(bug.type, [])
      }
      bugsByType.get(bug.type)!.push(bug)
    }

    // 检测频繁出现的模式
    for (const [type, bugs] of bugsByType) {
      if (bugs.length >= (this.config.patternDetectionThreshold || 3)) {
        // 检查是否已存在该类型的模式
        const existingPattern = Array.from(this.patterns.values())
          .find(p => p.bugType === type)

        if (existingPattern) {
          // 更新现有模式
          existingPattern.frequency = bugs.length
          existingPattern.lastSeen = Math.max(...bugs.map(b => b.timestamp))
          existingPattern.commonSymptoms = this.extractCommonSymptoms(bugs)
          existingPattern.severityDistribution = this.calculateSeverityDistribution(bugs)
          existingPattern.sourceDistribution = this.calculateSourceDistribution(bugs)

          // 更新exampleBugIds，保留最新的5个
          const latestBugIds = bugs
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 5)
            .map(b => b.id)
          existingPattern.exampleBugIds = latestBugIds
        } else {
          // 创建新模式
          const patternId = `pattern-${type}-${Date.now()}`

          // 提取共同症状
          const commonSymptoms = this.extractCommonSymptoms(bugs)

          const pattern: BugPattern = {
            patternId,
            bugType: type,
            commonSymptoms,
            frequency: bugs.length,
            lastSeen: Math.max(...bugs.map(b => b.timestamp)),
            exampleBugIds: bugs.slice(0, 5).map(b => b.id),
            severityDistribution: this.calculateSeverityDistribution(bugs),
            sourceDistribution: this.calculateSourceDistribution(bugs),
          }

          this.patterns.set(patternId, pattern)

          // 尝试提取修复模式
          this.extractFixPattern(pattern, bugs)
        }
      }
    }
  }

  /**
   * 提取共同症状
   */
  private extractCommonSymptoms(bugs: BugRecord[]): string[] {
    const symptoms: string[] = []
    const descriptions = bugs.map(b => b.description.toLowerCase())

    // 简单关键词提取（实际应使用更复杂的 NLP）
    const commonWords = [
      'error', 'fail', 'timeout', 'missing', 'invalid',
      'not found', 'cannot', 'unable', 'incorrect',
      '错误', '失败', '超时', '缺失', '无效',
      '未找到', '无法', '不正确', '验证', '审核'
    ]

    for (const word of commonWords) {
      const count = descriptions.filter(d => d.includes(word)).length
      if (count >= bugs.length * 0.5) { // 至少50%的bug包含该词
        symptoms.push(word)
      }
    }

    // 如果没找到共同关键词，至少返回bug类型作为症状
    if (symptoms.length === 0 && bugs.length > 0) {
      symptoms.push(bugs[0].type)
    }

    return symptoms
  }

  /**
   * 计算严重程度分布
   */
  private calculateSeverityDistribution(bugs: BugRecord[]): Record<BugSeverity, number> {
    const distribution: Record<BugSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    for (const bug of bugs) {
      distribution[bug.severity]++
    }

    return distribution
  }

  /**
   * 计算来源分布
   */
  private calculateSourceDistribution(bugs: BugRecord[]): Record<BugSource, number> {
    const distribution: Record<BugSource, number> = {
      'verify-gate': 0,
      'verify-review-chain': 0,
      'reviewer-subagent': 0,
      'memory': 0,
      'episode-memory': 0,
      'graph-retrieval': 0,
      'context-routing': 0,
      'tool-execution': 0,
      'session-state': 0,
      'task-execution': 0,
      'unknown': 0,
    }

    for (const bug of bugs) {
      distribution[bug.source]++
    }

    return distribution
  }

  /**
   * 提取修复模式
   * 吸收 DSXU 的修复经验沉淀机制
   */
  private extractFixPattern(pattern: BugPattern, bugs: BugRecord[]): void {
    // 基于 bug 类型和症状生成针对性的修复模式
    const fixPattern: FixPattern = {
      fixId: `fix-${pattern.patternId}`,
      bugPatternId: pattern.patternId,
      steps: this.generateFixSteps(pattern, bugs),
      successRate: this.estimateInitialSuccessRate(pattern),
      prerequisites: this.extractPrerequisites(pattern, bugs),
      lastApplied: Date.now(),
      applicationCount: 0,
    }

    this.fixPatterns.set(fixPattern.fixId, fixPattern)

    if (this.config.debug) {
      console.log(`[BugBrain] Extracted fix pattern: ${fixPattern.fixId} for ${pattern.bugType}`)
    }
  }

  /**
   * 生成修复步骤
   * 吸收 DSXU 的修复步骤结构化思路
   */
  private generateFixSteps(pattern: BugPattern, bugs: BugRecord[]): FixStep[] {
    const steps: FixStep[] = []
    const { bugType, commonSymptoms } = pattern

    // 基础步骤：分析上下文
    steps.push({
      action: 'analyze_context',
      description: '分析失败上下文、错误堆栈和相关代码',
      parameters: { depth: 'detailed' },
      expectedOutcome: '明确失败根本原因'
    })

    // 基于 bug 类型的针对性步骤
    if (bugType === 'verify-failure') {
      steps.push({
        action: 'review_code_standards',
        description: '检查代码是否符合项目规范和约定',
        parameters: { standards: ['formatting', 'naming', 'structure'] },
        expectedOutcome: '识别并修复规范违反点'
      })
      steps.push({
        action: 'run_verification_tools',
        description: '运行验证工具（如 linter、formatter）并应用建议',
        expectedOutcome: '代码通过验证检查'
      })
    } else if (bugType === 'reviewer-rejection') {
      steps.push({
        action: 'analyze_review_feedback',
        description: '详细分析审核反馈和拒绝原因',
        parameters: { aspects: ['quality', 'readability', 'maintainability'] },
        expectedOutcome: '理解审核标准和要求'
      })
      steps.push({
        action: 'improve_code_quality',
        description: '根据反馈改进代码质量',
        expectedOutcome: '代码满足审核标准'
      })
    } else if (bugType === 'tool-failure') {
      steps.push({
        action: 'check_tool_environment',
        description: '检查工具执行环境和依赖',
        parameters: { checks: ['dependencies', 'permissions', 'configuration'] },
        expectedOutcome: '环境问题已解决'
      })
      steps.push({
        action: 'validate_tool_parameters',
        description: '验证工具参数和输入格式',
        expectedOutcome: '参数正确且完整'
      })
    } else if (bugType === 'context-insufficiency') {
      steps.push({
        action: 'gather_missing_context',
        description: '收集缺失的上下文信息',
        parameters: { sources: ['user', 'history', 'system'] },
        expectedOutcome: '获得完整上下文'
      })
      steps.push({
        action: 'improve_context_routing',
        description: '改进上下文路由和检索逻辑',
        expectedOutcome: '上下文可用性提升'
      })
    }

    // 基于共同症状的额外步骤
    if (commonSymptoms.some(s => s.includes('timeout') || s.includes('超时'))) {
      steps.push({
        action: 'optimize_performance',
        description: '优化性能，减少执行时间',
        parameters: { strategies: ['caching', 'parallelization', 'optimization'] },
        expectedOutcome: '执行时间在可接受范围内'
      })
    }

    if (commonSymptoms.some(s => s.includes('memory') || s.includes('内存'))) {
      steps.push({
        action: 'manage_memory_usage',
        description: '管理内存使用，避免泄漏或不足',
        expectedOutcome: '内存使用稳定'
      })
    }

    // 最终验证步骤
    steps.push({
      action: 'verify_fix',
      description: '验证修复是否解决了问题',
      parameters: { method: 'test_execution' },
      expectedOutcome: '问题已解决，无回归'
    })

    return steps
  }

  /**
   * 估计初始成功率
   */
  private estimateInitialSuccessRate(pattern: BugPattern): number {
    // 基于 bug 类型和频率的简单估计
    const baseRate = 0.7

    // 频率越高，模式越明确，成功率越高
    const frequencyBonus = Math.min(0.2, (pattern.frequency - 3) * 0.05)

    // 症状越明确，成功率越高
    const symptomsBonus = Math.min(0.1, pattern.commonSymptoms.length * 0.02)

    return Math.min(0.95, baseRate + frequencyBonus + symptomsBonus)
  }

  /**
   * 提取前提条件
   */
  private extractPrerequisites(pattern: BugPattern, bugs: BugRecord[]): string[] {
    const prerequisites: string[] = ['有完整的错误上下文', '相关模块可用']

    // 基于 bug 类型添加特定前提条件
    if (pattern.bugType === 'verify-failure') {
      prerequisites.push('验证规则和标准已定义')
      prerequisites.push('代码可访问且可修改')
    } else if (pattern.bugType === 'reviewer-rejection') {
      prerequisites.push('审核标准和阈值明确')
      prerequisites.push('有足够的改进时间')
    } else if (pattern.bugType === 'tool-failure') {
      prerequisites.push('工具文档和API可用')
      prerequisites.push('执行环境可配置')
    } else if (pattern.bugType === 'context-insufficiency') {
      prerequisites.push('上下文来源可访问')
      prerequisites.push('有权限收集额外信息')
    }

    return prerequisites
  }

  /**
   * 获取 Bug 记录
   */
  getBug(id: string): BugRecord | undefined {
    return this.records.get(id)
  }

  /**
   * 获取所有 Bug 记录
   */
  getAllBugs(): BugRecord[] {
    return Array.from(this.records.values())
  }

  /**
   * 按类型获取 Bug
   */
  getBugsByType(type: BugCategory): BugRecord[] {
    return Array.from(this.records.values()).filter(bug => bug.type === type)
  }

  /**
   * 按严重程度获取 Bug
   */
  getBugsBySeverity(severity: BugSeverity): BugRecord[] {
    return Array.from(this.records.values()).filter(bug => bug.severity === severity)
  }

  /**
   * 获取 Bug 模式
   */
  getPatterns(): BugPattern[] {
    return Array.from(this.patterns.values())
  }

  /**
   * 获取修复模式
   */
  getFixPatterns(): FixPattern[] {
    return Array.from(this.fixPatterns.values())
  }

  /**
   * 分析 Bug
   */
  analyzeBug(bugId: string): BugAnalysis | undefined {
    const bugRecord = this.getBug(bugId)
    if (!bugRecord) return undefined

    const similarBugs = this.findSimilarBugs(bugRecord)
    const potentialPatterns = this.findMatchingPatterns(bugRecord)
    const recommendedFixPatterns = this.findRecommendedFixes(bugRecord)

    return {
      bugRecord,
      similarBugs,
      potentialPatterns,
      recommendedFixPatterns,
      confidence: this.calculateAnalysisConfidence(bugRecord, similarBugs),
    }
  }

  /**
   * 查找相似 Bug
   */
  private findSimilarBugs(bugRecord: BugRecord): BugRecord[] {
    const similarBugs = Array.from(this.records.values())
      .filter(b =>
        b.id !== bugRecord.id &&
        b.type === bugRecord.type &&
        b.severity === bugRecord.severity
      )
      .slice(0, 5) // 最多返回5个相似bug

    // 如果没找到完全匹配的，放宽条件找同类型的
    if (similarBugs.length === 0) {
      return Array.from(this.records.values())
        .filter(b =>
          b.id !== bugRecord.id &&
          b.type === bugRecord.type
        )
        .slice(0, 3) // 最多返回3个同类型bug
    }

    return similarBugs
  }

  /**
   * 查找匹配的模式
   */
  private findMatchingPatterns(bugRecord: BugRecord): BugPattern[] {
    return Array.from(this.patterns.values())
      .filter(p => p.bugType === bugRecord.type)
  }

  /**
   * 查找推荐的修复
   */
  private findRecommendedFixes(bugRecord: BugRecord): FixPattern[] {
    const patterns = this.findMatchingPatterns(bugRecord)
    return Array.from(this.fixPatterns.values())
      .filter(f => patterns.some(p => p.patternId === f.bugPatternId))
  }

  /**
   * 计算分析置信度
   */
  private calculateAnalysisConfidence(
    bugRecord: BugRecord,
    similarBugs: BugRecord[]
  ): number {
    let confidence = 0.5 // 基础置信度

    // 相似bug越多，置信度越高
    if (similarBugs.length > 0) {
      confidence += Math.min(0.3, similarBugs.length * 0.1)
    }

    // 有明确分类和来源，置信度提高
    if (bugRecord.type !== 'other' && bugRecord.source !== 'unknown') {
      confidence += 0.2
    }

    return Math.min(1.0, confidence)
  }

  /**
   * 获取统计信息
   */
  getStatistics(): BugStatistics {
    const bugs = Array.from(this.records.values())

    const byCategory: Record<BugCategory, number> = {
      'verify-failure': 0,
      'reviewer-rejection': 0,
      'tool-failure': 0,
      'context-insufficiency': 0,
      'recovery-failure': 0,
      'graph-retrieval-miss': 0,
      'memory-insufficiency': 0,
      'execution-timeout': 0,
      'resource-exhaustion': 0,
      'configuration-error': 0,
      'integration-failure': 0,
      'other': 0,
    }

    const bySeverity: Record<BugSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    const bySource: Record<BugSource, number> = {
      'verify-gate': 0,
      'verify-review-chain': 0,
      'reviewer-subagent': 0,
      'memory': 0,
      'episode-memory': 0,
      'graph-retrieval': 0,
      'context-routing': 0,
      'tool-execution': 0,
      'session-state': 0,
      'task-execution': 0,
      'unknown': 0,
    }

    for (const bug of bugs) {
      byCategory[bug.type]++
      bySeverity[bug.severity]++
      bySource[bug.source]++
    }

    return {
      totalBugs: bugs.length,
      byCategory,
      bySeverity,
      bySource,
    }
  }

  /**
   * 清理旧记录
   */
  cleanup(maxAgeDays: number = 30): void {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const toDelete: string[] = []

    for (const [id, bug] of this.records) {
      if (bug.timestamp < cutoff) {
        toDelete.push(id)
      }
    }

    for (const id of toDelete) {
      this.records.delete(id)
    }

    if (this.config.debug && toDelete.length > 0) {
      console.log(`[BugBrain] Cleaned up ${toDelete.length} old bug records`)
    }
  }
}

/**
 * 创建默认 Bug Brain 实例
 */
export const defaultBugBrain = new BugBrain({
  debug: process.env.NODE_ENV === 'development',
})