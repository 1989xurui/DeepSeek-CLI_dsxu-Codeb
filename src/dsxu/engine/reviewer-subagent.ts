import type { QueryEvent, QueryResult, ReviewerFinding, ReviewerReport, AgentSummary } from './types'

export interface ReviewerSubagentConfig {
  minScoreToApprove?: number
  failOnRollback?: boolean
  failOnCircuitSkipThreshold?: number
}

const DEFAULT_MIN_SCORE = 75

export class ReviewerSubagent {
  private readonly config: ReviewerSubagentConfig

  constructor(config?: ReviewerSubagentConfig) {
    this.config = {
      minScoreToApprove: config?.minScoreToApprove ?? DEFAULT_MIN_SCORE,
      failOnRollback: config?.failOnRollback ?? true,
      failOnCircuitSkipThreshold: config?.failOnCircuitSkipThreshold ?? 2,
    }
  }

  review(events: QueryEvent[], result: QueryResult): ReviewerReport {
    const findings: ReviewerFinding[] = []
    const suggestions: string[] = []
    let score = 100

    const rollbackCount = events.filter(e => e.type === 'transaction_rolled_back').length
    const circuitSkips = events.filter(e => e.type === 'tool_skipped_by_circuit_breaker').length
    const recoverableErrors = events.filter(e => e.type === 'error' && e.recoverable).length
    const maxTurnsHit = result.exitReason === 'max_turns'

    if (rollbackCount > 0) {
      score -= Math.min(35, rollbackCount * 12)
      findings.push({
        severity: this.config.failOnRollback ? 'P1' : 'P2',
        title: 'Transaction Rollback Occurred',
        detail: `Detected ${rollbackCount} rollback event(s).`,
      })
      suggestions.push('Narrow write scope or split tool calls to reduce rollback risk.')
    }

    if (circuitSkips >= (this.config.failOnCircuitSkipThreshold ?? 2)) {
      score -= Math.min(20, circuitSkips * 5)
      findings.push({
        severity: 'P2',
        title: 'Repeated Circuit Breaker Skips',
        detail: `Detected ${circuitSkips} tool skip(s) due to circuit breaker.`,
      })
      suggestions.push('Investigate unhealthy tools and tune failure/cooldown thresholds.')
    }

    if (recoverableErrors > 0) {
      score -= Math.min(20, recoverableErrors * 4)
      findings.push({
        severity: 'P2',
        title: 'Recoverable Errors Present',
        detail: `Detected ${recoverableErrors} recoverable error event(s).`,
      })
    }

    if (maxTurnsHit) {
      score -= 20
      findings.push({
        severity: 'P1',
        title: 'Max Turns Reached',
        detail: 'Run terminated by max_turns, likely incomplete task closure.',
      })
      suggestions.push('Break task into smaller steps or raise tool subset relevance.')
    }

    if (result.exitReason === 'api_error') {
      score -= 25
      findings.push({
        severity: 'P1',
        title: 'API Error Exit',
        detail: 'Run exited due to upstream API instability.',
      })
    }

    score = Math.max(0, Math.min(100, score))
    const hasBlocking = findings.some(f => f.severity === 'P0' || (f.severity === 'P1' && this.config.failOnRollback))
    const approved = !hasBlocking && score >= (this.config.minScoreToApprove ?? DEFAULT_MIN_SCORE)

    if (approved && suggestions.length === 0) {
      suggestions.push('No critical risks detected. Maintain current strategy.')
    }

    return { approved, score, findings, suggestions }
  }

  /**
   * 基于智能体摘要的评审方法
   * @param events 查询事件数组
   * @param result 查询结果
   * @param summary 智能体摘要
   * @returns 评审报告
   */
  reviewWithSummary(events: QueryEvent[], result: QueryResult, summary: AgentSummary): ReviewerReport {
    const findings: ReviewerFinding[] = []
    const suggestions: string[] = []
    let score = 100

    // 基础事件分析
    const rollbackCount = events.filter(e => e.type === 'transaction_rolled_back').length
    const circuitSkips = events.filter(e => e.type === 'tool_skipped_by_circuit_breaker').length
    const recoverableErrors = events.filter(e => e.type === 'error' && e.recoverable).length
    const maxTurnsHit = result.exitReason === 'max_turns'

    // 智能体摘要分析
    const hasErrors = summary.errors.length > 0
    const hasKeyFindings = summary.keyFindings.length > 0
    const isSuccessful = summary.metadata.success
    const performance = summary.metadata.performance

    // 基础事件评分
    if (rollbackCount > 0) {
      score -= Math.min(35, rollbackCount * 12)
      findings.push({
        severity: this.config.failOnRollback ? 'P1' : 'P2',
        title: 'Transaction Rollback Occurred',
        detail: `Detected ${rollbackCount} rollback event(s).`,
      })
      suggestions.push('Narrow write scope or split tool calls to reduce rollback risk.')
    }

    if (circuitSkips >= (this.config.failOnCircuitSkipThreshold ?? 2)) {
      score -= Math.min(20, circuitSkips * 5)
      findings.push({
        severity: 'P2',
        title: 'Repeated Circuit Breaker Skips',
        detail: `Detected ${circuitSkips} tool skip(s) due to circuit breaker.`,
      })
      suggestions.push('Investigate unhealthy tools and tune failure/cooldown thresholds.')
    }

    if (recoverableErrors > 0) {
      score -= Math.min(20, recoverableErrors * 4)
      findings.push({
        severity: 'P2',
        title: 'Recoverable Errors Present',
        detail: `Detected ${recoverableErrors} recoverable error event(s).`,
      })
    }

    if (maxTurnsHit) {
      score -= 20
      findings.push({
        severity: 'P1',
        title: 'Max Turns Reached',
        detail: 'Run terminated by max_turns, likely incomplete task closure.',
      })
      suggestions.push('Break task into smaller steps or raise tool subset relevance.')
    }

    if (result.exitReason === 'api_error') {
      score -= 25
      findings.push({
        severity: 'P1',
        title: 'API Error Exit',
        detail: 'Run exited due to upstream API instability.',
      })
    }

    // 智能体摘要评分
    if (hasErrors) {
      score -= Math.min(30, summary.errors.length * 10)
      findings.push({
        severity: 'P1',
        title: 'Agent Execution Errors',
        detail: `Agent encountered ${summary.errors.length} error(s): ${summary.errors.join(', ')}`,
      })
      suggestions.push('Review agent error handling and retry logic.')
    }

    if (!isSuccessful) {
      score -= 40
      findings.push({
        severity: 'P0',
        title: 'Agent Execution Failed',
        detail: 'Agent did not complete successfully.',
      })
      suggestions.push('Investigate root cause of agent failure.')
    }

    if (!hasKeyFindings) {
      score -= 15
      findings.push({
        severity: 'P2',
        title: 'No Key Findings Reported',
        detail: 'Agent did not report any key findings.',
      })
      suggestions.push('Ensure agent properly captures and reports key insights.')
    }

    // 性能分析
    if (performance) {
      const { durationMs, tokensUsed, toolCalls } = performance

      // 检查执行时间是否过长
      if (durationMs > 60000) { // 超过60秒
        score -= 10
        findings.push({
          severity: 'P2',
          title: 'Long Execution Time',
          detail: `Execution took ${(durationMs / 1000).toFixed(1)} seconds.`,
        })
        suggestions.push('Optimize agent workflow for better performance.')
      }

      // 检查token使用是否过高
      if (tokensUsed > 100000) { // 超过100k tokens
        score -= 15
        findings.push({
          severity: 'P2',
          title: 'High Token Usage',
          detail: `Used ${tokensUsed.toLocaleString()} tokens.`,
        })
        suggestions.push('Implement token optimization strategies.')
      }

      // 检查工具调用次数是否过多
      if (toolCalls > 50) { // 超过50次工具调用
        score -= 10
        findings.push({
          severity: 'P2',
          title: 'High Tool Call Count',
          detail: `Made ${toolCalls} tool calls.`,
        })
        suggestions.push('Consolidate tool calls or improve planning.')
      }
    }

    score = Math.max(0, Math.min(100, score))
    const hasBlocking = findings.some(f => f.severity === 'P0' || (f.severity === 'P1' && this.config.failOnRollback))
    const approved = !hasBlocking && score >= (this.config.minScoreToApprove ?? DEFAULT_MIN_SCORE)

    if (approved && suggestions.length === 0) {
      suggestions.push('No critical risks detected. Maintain current strategy.')
    }

    // 添加智能体摘要信息到报告
    const summaryInfo = `Agent Summary: ${summary.agentId} (${summary.status}) - ${summary.metadata.totalTurns} turns, ${summary.metadata.toolsUsed.length} tools used`
    suggestions.unshift(summaryInfo)

    return { approved, score, findings, suggestions }
  }
}

