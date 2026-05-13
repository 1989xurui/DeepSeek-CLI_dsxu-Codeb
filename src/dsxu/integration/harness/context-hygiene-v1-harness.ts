/**
 * H-4R: Context Hygiene Harness
 *
 * 用于集成测试和演示上下文卫生检查功能
 */

import {
  checkContextHygiene,
  applyContextHygiene,
  decideCompactionWithHygiene,
  type ContextHygieneResult,
  type ContextHygieneIssue,
  type ContextHygieneIssueType
} from '../../engine/compact'
import { DEEPSEEK_V4_CONTEXT_WINDOW } from '../../../utils/model/deepseekV4Control'

export interface ContextHygieneHarnessOptions {
  /** 最大token限制（默认: DeepSeek V4 1M window） */
  maxTokens?: number
  /** 是否自动应用建议 */
  autoApplySuggestions?: boolean
  /** 详细输出级别 */
  verbose?: boolean
}

export interface ContextHygieneHarnessResult {
  /** 原始消息数量 */
  originalMessageCount: number
  /** 处理后消息数量 */
  processedMessageCount: number
  /** 上下文卫生检查结果 */
  hygieneResult: ContextHygieneResult
  /** 压缩决策 */
  compactionDecision: ReturnType<typeof decideCompactionWithHygiene>
  /** 处理后的消息 */
  processedMessages: any[]
  /** 建议摘要 */
  suggestionsSummary: string[]
  /** 风险摘要 */
  riskSummary: {
    level: string
    issues: string[]
    recommendations: string[]
  }
}

/**
 * Context Hygiene Harness
 */
export class ContextHygieneHarness {
  private options: Required<ContextHygieneHarnessOptions>

  constructor(options: ContextHygieneHarnessOptions = {}) {
    this.options = {
      maxTokens: options.maxTokens || DEEPSEEK_V4_CONTEXT_WINDOW,
      autoApplySuggestions: options.autoApplySuggestions !== false,
      verbose: options.verbose || false
    }
  }

  /**
   * 检查并处理上下文卫生
   */
  async checkAndProcess(
    messages: any[]
  ): Promise<ContextHygieneHarnessResult> {
    const startTime = Date.now()

    // 1. 执行上下文卫生检查
    const hygieneResult = checkContextHygiene(messages, this.options.maxTokens)

    // 2. 根据卫生结果决定压缩策略
    const compactionDecision = decideCompactionWithHygiene(messages, hygieneResult)

    // 3. 应用卫生建议
    let processedMessages = messages
    if (this.options.autoApplySuggestions) {
      processedMessages = applyContextHygiene(messages, hygieneResult)
    }

    // 4. 生成建议摘要
    const suggestionsSummary = this.generateSuggestionsSummary(hygieneResult, compactionDecision)

    // 5. 生成风险摘要
    const riskSummary = this.generateRiskSummary(hygieneResult)

    const processingTime = Date.now() - startTime

    if (this.options.verbose) {
      this.logResults(hygieneResult, compactionDecision, processingTime)
    }

    return {
      originalMessageCount: messages.length,
      processedMessageCount: processedMessages.length,
      hygieneResult,
      compactionDecision,
      processedMessages,
      suggestionsSummary,
      riskSummary
    }
  }

  /**
   * 批量检查多个消息集
   */
  async batchCheck(
    messageSets: Array<{ name: string; messages: any[] }>
  ): Promise<Record<string, ContextHygieneHarnessResult>> {
    const results: Record<string, ContextHygieneHarnessResult> = {}

    for (const { name, messages } of messageSets) {
      results[name] = await this.checkAndProcess(messages)
    }

    return results
  }

  /**
   * 分析趋势
   */
  analyzeTrends(
    results: ContextHygieneHarnessResult[]
  ): {
    avgRiskLevel: string
    commonIssues: string[]
    improvementSuggestions: string[]
    stats: {
      totalChecks: number
      passedChecks: number
      avgIssuesPerCheck: number
      mostCommonIssueType: ContextHygieneIssueType | 'none'
    }
  } {
    if (results.length === 0) {
      return {
        avgRiskLevel: 'none',
        commonIssues: [],
        improvementSuggestions: ['无数据可供分析'],
        stats: {
          totalChecks: 0,
          passedChecks: 0,
          avgIssuesPerCheck: 0,
          mostCommonIssueType: 'none'
        }
      }
    }

    // 计算平均风险等级
    const riskScores = results.map(r => {
      switch (r.hygieneResult.overallRisk) {
        case 'none': return 0
        case 'low': return 1
        case 'medium': return 2
        case 'high': return 3
        default: return 0
      }
    })
    const avgRiskScore = riskScores.reduce((a, b) => a + b, 0) / riskScores.length

    let avgRiskLevel: string
    if (avgRiskScore < 0.5) avgRiskLevel = 'none'
    else if (avgRiskScore < 1.5) avgRiskLevel = 'low'
    else if (avgRiskScore < 2.5) avgRiskLevel = 'medium'
    else avgRiskLevel = 'high'

    // 收集常见问题
    const issueCounts = new Map<string, number>()
    results.forEach(result => {
      result.hygieneResult.issues.forEach(issue => {
        const key = `${issue.type}:${issue.severity}`
        issueCounts.set(key, (issueCounts.get(key) || 0) + 1)
      })
    })

    const commonIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key.split(':')[0])

    // 找出最常见的问题类型
    const issueTypeCounts = new Map<ContextHygieneIssueType, number>()
    results.forEach(result => {
      result.hygieneResult.issues.forEach(issue => {
        issueTypeCounts.set(issue.type, (issueTypeCounts.get(issue.type) || 0) + 1)
      })
    })

    const mostCommonIssueType = Array.from(issueTypeCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none'

    // 生成改进建议
    const improvementSuggestions: string[] = []

    if (mostCommonIssueType === 'context_too_long') {
      improvementSuggestions.push('上下文过长问题常见，建议增加压缩频率')
    }
    if (mostCommonIssueType === 'context_polluted') {
      improvementSuggestions.push('重复内容问题常见，建议优化消息去重逻辑')
    }

    const passedChecks = results.filter(r => r.hygieneResult.passed).length
    const totalIssues = results.reduce((sum, r) => sum + r.hygieneResult.issues.length, 0)

    return {
      avgRiskLevel,
      commonIssues,
      improvementSuggestions,
      stats: {
        totalChecks: results.length,
        passedChecks,
        avgIssuesPerCheck: totalIssues / results.length,
        mostCommonIssueType
      }
    }
  }

  /**
   * 生成建议摘要
   */
  private generateSuggestionsSummary(
    hygieneResult: ContextHygieneResult,
    compactionDecision: ReturnType<typeof decideCompactionWithHygiene>
  ): string[] {
    const suggestions: string[] = []

    // 基于卫生检查的建议
    if (hygieneResult.suggestedActions.includes('compact')) {
      suggestions.push('建议执行上下文压缩以减少token使用')
    }
    if (hygieneResult.suggestedActions.includes('trim')) {
      suggestions.push('建议修剪旧消息以改善上下文质量')
    }
    if (hygieneResult.suggestedActions.includes('flag_risk')) {
      suggestions.push('检测到高风险内容，建议标记并处理')
    }

    // 基于压缩决策的建议
    if (compactionDecision.shouldCompact) {
      suggestions.push(`建议执行 ${compactionDecision.recommendedLevel} 级别压缩 (${compactionDecision.reason})`)
    } else {
      suggestions.push('上下文状态良好，无需压缩')
    }

    return suggestions
  }

  /**
   * 生成风险摘要
   */
  private generateRiskSummary(hygieneResult: ContextHygieneResult): {
    level: string
    issues: string[]
    recommendations: string[]
  } {
    const issues = hygieneResult.issues.map(issue =>
      `[${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`
    )

    const recommendations: string[] = []

    if (hygieneResult.overallRisk === 'high') {
      recommendations.push('立即处理高风险问题')
      recommendations.push('考虑紧急压缩或重启会话')
    } else if (hygieneResult.overallRisk === 'medium') {
      recommendations.push('计划处理中等风险问题')
      recommendations.push('监控上下文使用情况')
    } else if (hygieneResult.overallRisk === 'low') {
      recommendations.push('低风险问题可稍后处理')
      recommendations.push('定期检查上下文卫生')
    } else {
      recommendations.push('上下文状态良好，保持当前策略')
    }

    return {
      level: hygieneResult.overallRisk,
      issues,
      recommendations
    }
  }

  /**
   * 记录结果
   */
  private logResults(
    hygieneResult: ContextHygieneResult,
    compactionDecision: ReturnType<typeof decideCompactionWithHygiene>,
    processingTime: number
  ): void {
    console.log('=== Context Hygiene 检查结果 ===')
    console.log(`检查耗时: ${processingTime}ms`)
    console.log(`通过检查: ${hygieneResult.passed ? '✅' : '❌'}`)
    console.log(`风险等级: ${hygieneResult.overallRisk}`)
    console.log(`发现问题: ${hygieneResult.issues.length} 个`)
    console.log(`建议动作: ${hygieneResult.suggestedActions.join(', ')}`)
    console.log('')

    console.log('--- 问题详情 ---')
    hygieneResult.issues.forEach((issue, index) => {
      console.log(`${index + 1}. [${issue.severity}] ${issue.type}`)
      console.log(`   描述: ${issue.description}`)
      console.log(`   建议: ${issue.suggestedAction}`)
    })
    console.log('')

    console.log('--- 压缩决策 ---')
    console.log(`需要压缩: ${compactionDecision.shouldCompact ? '是' : '否'}`)
    console.log(`推荐级别: ${compactionDecision.recommendedLevel}`)
    console.log(`优先级: ${compactionDecision.priority}`)
    console.log(`原因: ${compactionDecision.reason}`)
    console.log('')

    console.log('--- 统计信息 ---')
    console.log(`总消息数: ${hygieneResult.stats.totalMessages}`)
    console.log(`总token数: ${hygieneResult.stats.totalTokens}`)
    console.log(`高风险问题: ${hygieneResult.stats.highRiskIssues}`)
    console.log(`检查时间: ${hygieneResult.stats.checkTimeMs}ms`)
  }

  /**
   * 生成检查报告
   */
  generateReport(result: ContextHygieneHarnessResult): string {
    const lines: string[] = []

    lines.push('=== Context Hygiene 检查报告 ===')
    lines.push(`原始消息数: ${result.originalMessageCount}`)
    lines.push(`处理后消息数: ${result.processedMessageCount}`)
    lines.push(`通过检查: ${result.hygieneResult.passed ? '是' : '否'}`)
    lines.push(`风险等级: ${result.hygieneResult.overallRisk}`)
    lines.push('')

    lines.push('--- 问题摘要 ---')
    if (result.hygieneResult.issues.length === 0) {
      lines.push('未发现问题')
    } else {
      result.hygieneResult.issues.forEach((issue, index) => {
        lines.push(`${index + 1}. [${issue.severity}] ${issue.type}`)
        lines.push(`   描述: ${issue.description}`)
        lines.push(`   建议: ${issue.suggestedAction}`)
      })
    }
    lines.push('')

    lines.push('--- 压缩决策 ---')
    lines.push(`需要压缩: ${result.compactionDecision.shouldCompact ? '是' : '否'}`)
    lines.push(`推荐级别: ${result.compactionDecision.recommendedLevel}`)
    lines.push(`优先级: ${result.compactionDecision.priority}`)
    lines.push(`原因: ${result.compactionDecision.reason}`)
    lines.push('')

    lines.push('--- 建议摘要 ---')
    result.suggestionsSummary.forEach((suggestion, index) => {
      lines.push(`${index + 1}. ${suggestion}`)
    })
    lines.push('')

    lines.push('--- 风险摘要 ---')
    lines.push(`风险等级: ${result.riskSummary.level}`)
    lines.push('主要问题:')
    result.riskSummary.issues.forEach((issue, index) => {
      lines.push(`  ${index + 1}. ${issue}`)
    })
    lines.push('处理建议:')
    result.riskSummary.recommendations.forEach((rec, index) => {
      lines.push(`  ${index + 1}. ${rec}`)
    })

    return lines.join('\n')
  }

  /**
   * 快速检查函数
   */
  quickCheck(messages: any[]): {
    passed: boolean
    riskLevel: string
    issueCount: number
    needsCompaction: boolean
    suggestedLevel: string
  } {
    const hygieneResult = checkContextHygiene(messages, this.options.maxTokens)
    const compactionDecision = decideCompactionWithHygiene(messages, hygieneResult)

    return {
      passed: hygieneResult.passed,
      riskLevel: hygieneResult.overallRisk,
      issueCount: hygieneResult.issues.length,
      needsCompaction: compactionDecision.shouldCompact,
      suggestedLevel: compactionDecision.recommendedLevel
    }
  }
}

/**
 * 创建 Context Hygiene Harness 实例
 */
export function createContextHygieneHarness(
  options?: ContextHygieneHarnessOptions
): ContextHygieneHarness {
  return new ContextHygieneHarness(options)
}

/**
 * 快速检查函数（简化接口）
 */
export function quickContextCheck(
  messages: any[],
  maxTokens: number = DEEPSEEK_V4_CONTEXT_WINDOW
): {
  result: ContextHygieneResult
  decision: ReturnType<typeof decideCompactionWithHygiene>
  summary: string
} {
  const hygieneResult = checkContextHygiene(messages, maxTokens)
  const decision = decideCompactionWithHygiene(messages, hygieneResult)

  const summary = `检查结果: ${hygieneResult.passed ? '通过' : '未通过'} | ` +
    `风险等级: ${hygieneResult.overallRisk} | ` +
    `问题数量: ${hygieneResult.issues.length} | ` +
    `需要压缩: ${decision.shouldCompact ? '是' : '否'}`

  return { result: hygieneResult, decision, summary }
}
