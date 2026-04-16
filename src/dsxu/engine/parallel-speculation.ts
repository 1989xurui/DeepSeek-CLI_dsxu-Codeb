/**
 * 并行推演管理器 - 反事实并行推演（多分支试错）
 * 
 * 功能：
 * 1. 三分支模板：A方案一、B方案二、C破坏性测试
 * 2. 主链汇总评分维度：通过率、回归风险、修改面、执行时间
 * 3. 自动吸收最优分支；失败分支回收并写摘要
 */

import type { Message, ToolDefinition, ToolContext, QueryResult, QueryEvent } from './types'
import { ForkResult, forkAgent } from './forked-agent'
import { ReviewerReport, ReviewerSubagent } from './reviewer-subagent'

export interface ParallelSpeculationOptions {
  /** 是否启用并行推演 */
  enabled?: boolean
  /** 最大并行分支数 */
  maxParallelBranches?: number
  /** 分支执行超时时间（毫秒） */
  branchTimeoutMs?: number
  /** 是否启用调试日志 */
  debug?: boolean
  /** 评分权重配置 */
  scoringWeights?: {
    /** 通过率权重 */
    passRateWeight?: number
    /** 回归风险权重（负向） */
    regressionRiskWeight?: number
    /** 修改面权重（负向） */
    changeSurfaceWeight?: number
    /** 执行时间权重（负向） */
    executionTimeWeight?: number
  }
}

/**
 * 分支方案定义
 */
export interface BranchSpec {
  /** 分支ID */
  id: string
  /** 分支名称 */
  name: string
  /** 分支类型 */
  type: 'solution_a' | 'solution_b' | 'destructive_test'
  /** 分支描述 */
  description: string
  /** 系统提示（可选） */
  systemPrompt?: string
  /** 初始档位 */
  initialGear?: 1 | 2 | 3
  /** 分支特定配置 */
  config?: Record<string, any>
}

/**
 * 分支执行结果
 */
export interface BranchResult {
  /** 分支ID */
  branchId: string
  /** 分支名称 */
  branchName: string
  /** 分支类型 */
  branchType: string
  /** Fork执行结果 */
  forkResult: ForkResult
  /** 评审报告 */
  reviewReport: ReviewerReport
  /** 执行耗时（毫秒） */
  durationMs: number
  /** 是否成功 */
  success: boolean
  /** 错误信息（如果有） */
  error?: string
  /** 评分 */
  score: number
  /** 评分详情 */
  scoreDetails: {
    /** 通过率得分 */
    passRateScore: number
    /** 回归风险得分 */
    regressionRiskScore: number
    /** 修改面得分 */
    changeSurfaceScore: number
    /** 执行时间得分 */
    executionTimeScore: number
    /** 总分 */
    totalScore: number
  }
}

/**
 * 并行推演结果
 */
export interface ParallelSpeculationResult {
  /** 推演ID */
  speculationId: string
  /** 总分支数 */
  totalBranches: number
  /** 成功分支数 */
  successfulBranches: number
  /** 失败分支数 */
  failedBranches: number
  /** 最佳分支 */
  bestBranch?: BranchResult
  /** 所有分支结果 */
  allBranches: BranchResult[]
  /** 汇总评分 */
  summary: {
    /** 平均通过率 */
    averagePassRate: number
    /** 平均回归风险 */
    averageRegressionRisk: number
    /** 平均修改面 */
    averageChangeSurface: number
    /** 平均执行时间 */
    averageExecutionTime: number
    /** 总体评分 */
    overallScore: number
  }
  /** 推荐行动 */
  recommendedAction?: {
    /** 推荐的分支ID */
    branchId: string
    /** 推荐原因 */
    reason: string
    /** 置信度 */
    confidence: number
  }
}

/**
 * 并行推演管理器
 */
export class ParallelSpeculationManager {
  private config: Required<ParallelSpeculationOptions>
  private reviewer: ReviewerSubagent

  constructor(options?: ParallelSpeculationOptions) {
    this.config = {
      enabled: options?.enabled ?? true,
      maxParallelBranches: options?.maxParallelBranches ?? 3,
      branchTimeoutMs: options?.branchTimeoutMs ?? 30000,
      debug: options?.debug ?? false,
      scoringWeights: {
        passRateWeight: options?.scoringWeights?.passRateWeight ?? 0.4,
        regressionRiskWeight: options?.scoringWeights?.regressionRiskWeight ?? -0.3,
        changeSurfaceWeight: options?.scoringWeights?.changeSurfaceWeight ?? -0.2,
        executionTimeWeight: options?.scoringWeights?.executionTimeWeight ?? -0.1,
      },
    }

    this.reviewer = new ReviewerSubagent()
  }

  /**
   * 获取默认的三分支模板
   */
  getDefaultBranchSpecs(taskDescription: string): BranchSpec[] {
    return [
      {
        id: 'branch-a',
        name: '方案A（保守优化）',
        type: 'solution_a',
        description: `保守优化方案：${taskDescription}`,
        systemPrompt: '请采用保守、稳定的方法完成任务，优先保证正确性和可靠性。',
        initialGear: 1,
        config: { riskLevel: 'low' },
      },
      {
        id: 'branch-b',
        name: '方案B（激进创新）',
        type: 'solution_b',
        description: `激进创新方案：${taskDescription}`,
        systemPrompt: '请尝试创新方法，可以承担一定风险以获取更好的结果。',
        initialGear: 2,
        config: { riskLevel: 'medium' },
      },
      {
        id: 'branch-c',
        name: '破坏性测试',
        type: 'destructive_test',
        description: `破坏性测试：${taskDescription}`,
        systemPrompt: '请测试极端情况和边界条件，验证方案的健壮性。',
        initialGear: 3,
        config: { riskLevel: 'high', destructive: true },
      },
    ]
  }

  /**
   * 执行单个分支
   */
  private async executeBranch(
    branchSpec: BranchSpec,
    messages: Message[],
    tools: ToolDefinition[],
    cwd: string,
    sessionId: string
  ): Promise<BranchResult> {
    const startTime = Date.now()

    try {
      // 准备分支特定的消息
      const branchMessages = [...messages]
      if (branchSpec.systemPrompt) {
        // 在消息开头添加系统提示
        branchMessages.unshift({
          role: 'system',
          content: branchSpec.systemPrompt,
        })
      }

      // 执行分支
      const forkResult = await forkAgent(
        branchSpec.description,
        branchMessages,
        tools,
        cwd,
        sessionId,
        {
          maxTurns: 20,
          timeout: this.config.branchTimeoutMs,
          recordTranscript: this.config.debug,
          initialGear: branchSpec.initialGear,
        }
      )

      const durationMs = Date.now() - startTime

      // 评审分支结果
      const reviewReport = this.reviewer.review(forkResult.events, {
        finalMessage: forkResult.finalMessage,
        exitReason: forkResult.exitReason,
        turns: forkResult.turns,
        totalUsage: forkResult.usage,
        messages: forkResult.messages,
      })

      // 计算评分
      const scoreDetails = this.calculateBranchScore(forkResult, reviewReport, durationMs, branchSpec)
      const totalScore = scoreDetails.totalScore

      return {
        branchId: branchSpec.id,
        branchName: branchSpec.name,
        branchType: branchSpec.type,
        forkResult,
        reviewReport,
        durationMs,
        success: reviewReport.approved && forkResult.exitReason !== 'api_error',
        score: totalScore,
        scoreDetails,
      }

    } catch (error: any) {
      const durationMs = Date.now() - startTime

      return {
        branchId: branchSpec.id,
        branchName: branchSpec.name,
        branchType: branchSpec.type,
        forkResult: {
          finalMessage: `分支执行失败: ${error.message}`,
          exitReason: 'api_error',
          turns: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
          messages: [],
          events: [],
          forkId: branchSpec.id,
          durationMs,
        },
        reviewReport: {
          approved: false,
          score: 0,
          findings: [
            {
              severity: 'P0',
              title: '分支执行失败',
              detail: error.message,
            },
          ],
          suggestions: ['检查分支配置和依赖'],
        },
        durationMs,
        success: false,
        error: error.message,
        score: 0,
        scoreDetails: {
          passRateScore: 0,
          regressionRiskScore: 0,
          changeSurfaceScore: 0,
          executionTimeScore: 0,
          totalScore: 0,
        },
      }
    }
  }

  /**
   * 计算分支评分
   */
  private calculateBranchScore(
    forkResult: ForkResult,
    reviewReport: ReviewerReport,
    durationMs: number,
    branchSpec: BranchSpec
  ): {
    passRateScore: number
    regressionRiskScore: number
    changeSurfaceScore: number
    executionTimeScore: number
    totalScore: number
  } {
    const weights = this.config.scoringWeights

    // 1. 通过率得分（基于评审分数）
    const passRateScore = (reviewReport.score / 100) * 100

    // 2. 回归风险得分（基于回滚次数和错误）
    const rollbackEvents = forkResult.events.filter(e => e.type === 'transaction_rolled_back').length
    const errorEvents = forkResult.events.filter(e => e.type === 'error').length
    const regressionRiskScore = Math.max(0, 100 - (rollbackEvents * 20 + errorEvents * 10))

    // 3. 修改面得分（基于工具使用情况）
    const writeTools = forkResult.events.filter(e => 
      e.type === 'tool_used' && 
      e.toolName && 
      ['Write', 'Edit', 'Bash'].includes(e.toolName)
    ).length
    const changeSurfaceScore = Math.max(0, 100 - (writeTools * 5))

    // 4. 执行时间得分（基于执行时间）
    const maxExpectedTime = 30000 // 30秒
    const executionTimeScore = Math.max(0, 100 - (durationMs / maxExpectedTime) * 100)

    // 计算总分（应用权重）
    const totalScore = 
      passRateScore * weights.passRateWeight +
      regressionRiskScore * weights.regressionRiskWeight +
      changeSurfaceScore * weights.changeSurfaceWeight +
      executionTimeScore * weights.executionTimeWeight

    return {
      passRateScore,
      regressionRiskScore,
      changeSurfaceScore,
      executionTimeScore,
      totalScore,
    }
  }

  /**
   * 执行并行推演
   */
  async speculate(
    taskDescription: string,
    messages: Message[],
    tools: ToolDefinition[],
    cwd: string,
    sessionId: string,
    branchSpecs?: BranchSpec[]
  ): Promise<ParallelSpeculationResult> {
    if (!this.config.enabled) {
      throw new Error('并行推演未启用')
    }

    const speculationId = `parallel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const startTime = Date.now()

    if (this.config.debug) {
      console.log(`[ParallelSpeculation] Starting speculation: ${speculationId}`)
      console.log(`[ParallelSpeculation] Task: ${taskDescription}`)
    }

    // 获取分支规格
    const specs = branchSpecs || this.getDefaultBranchSpecs(taskDescription)
    const limitedSpecs = specs.slice(0, this.config.maxParallelBranches)

    // 并行执行所有分支
    const branchPromises = limitedSpecs.map(spec =>
      this.executeBranch(spec, messages, tools, cwd, sessionId)
    )

    const branchResults = await Promise.all(branchPromises)
    const totalDuration = Date.now() - startTime

    // 分析结果
    const successfulBranches = branchResults.filter(r => r.success)
    const failedBranches = branchResults.filter(r => !r.success)

    // 找到最佳分支
    let bestBranch: BranchResult | undefined
    if (successfulBranches.length > 0) {
      bestBranch = successfulBranches.reduce((best, current) =>
        current.score > best.score ? current : best
      )
    }

    // 计算汇总统计
    const averagePassRate = successfulBranches.length > 0
      ? successfulBranches.reduce((sum, r) => sum + r.scoreDetails.passRateScore, 0) / successfulBranches.length
      : 0

    const averageRegressionRisk = successfulBranches.length > 0
      ? successfulBranches.reduce((sum, r) => sum + r.scoreDetails.regressionRiskScore, 0) / successfulBranches.length
      : 0

    const averageChangeSurface = successfulBranches.length > 0
      ? successfulBranches.reduce((sum, r) => sum + r.scoreDetails.changeSurfaceScore, 0) / successfulBranches.length
      : 0

    const averageExecutionTime = successfulBranches.length > 0
      ? successfulBranches.reduce((sum, r) => sum + r.durationMs, 0) / successfulBranches.length
      : 0

    const overallScore = successfulBranches.length > 0
      ? successfulBranches.reduce((sum, r) => sum + r.score, 0) / successfulBranches.length
      : 0

    // 生成推荐行动
    let recommendedAction
    if (bestBranch) {
      recommendedAction = {
        branchId: bestBranch.branchId,
        reason: `评分最高（${bestBranch.score.toFixed(1)}分），通过率${bestBranch.scoreDetails.passRateScore.toFixed(1)}%，回归风险低`,
        confidence: Math.min(0.9, bestBranch.score / 100),
      }
    }

    const result: ParallelSpeculationResult = {
      speculationId,
      totalBranches: branchResults.length,
      successfulBranches: successfulBranches.length,
      failedBranches: failedBranches.length,
      bestBranch,
      allBranches: branchResults,
      summary: {
        averagePassRate,
        averageRegressionRisk,
        averageChangeSurface,
        averageExecutionTime,
        overallScore,
      },
      recommendedAction,
    }

    // 输出结果摘要
    if (this.config.debug) {
      console.log(`[ParallelSpeculation] Completed in ${totalDuration}ms`)
      console.log(`[ParallelSpeculation] Results: ${successfulBranches.length} successful, ${failedBranches.length} failed`)
      
      if (bestBranch) {
        console.log(`[ParallelSpeculation] Best branch: ${bestBranch.branchName} (score: ${bestBranch.score.toFixed(1)})`)
      }
      
      console.log(`[ParallelSpeculation] Summary:`)
      console.log(`  - Average pass rate: ${averagePassRate.toFixed(1)}%`)
      console.log(`  - Average regression risk: ${averageRegressionRisk.toFixed(1)}%`)
      console.log(`  - Average change surface: ${averageChangeSurface.toFixed(1)}%`)
      console.log(`  - Average execution time: ${averageExecutionTime.toFixed(0)}ms`)
      console.log(`  - Overall score: ${overallScore.toFixed(1)}`)
    }

    return result
  }

  /**
   * 吸收最优分支结果
   */
  absorbBestBranch(result: ParallelSpeculationResult): {
    absorbed: boolean
    branchId?: string
    message?: string
    summary?: string
  } {
    if (!result.bestBranch) {
      return {
        absorbed: false,
        message: '没有可吸收的最佳分支',
      }
    }

    const bestBranch = result.bestBranch

    // 这里可以添加实际吸收逻辑，比如：
    // 1. 将最佳分支的结果应用到主链
    // 2. 更新配置或状态
    // 3. 记录吸收历史

    const absorptionSummary = `
吸收分支 ${bestBranch.branchName} (${bestBranch.branchId}) 的结果：
- 评分: ${bestBranch.score.toFixed(1)}
- 通过率: ${bestBranch.scoreDetails.passRateScore.toFixed(1)}%
- 回归风险: ${bestBranch.scoreDetails.regressionRiskScore.toFixed(1)}%
- 执行时间: ${bestBranch.durationMs}ms
- 最终消息: ${bestBranch.forkResult.finalMessage.substring(0, 100)}...
`

    if (this.config.debug) {
      console.log(`[ParallelSpeculation] Absorbing best branch: ${bestBranch.branchName}`)
      console.log(absorptionSummary)
    }

    return {
      absorbed: true,
      branchId: bestBranch.branchId,
      message: `成功吸收分支 ${bestBranch.branchName}`,
      summary: absorptionSummary,
    }
  }

  /**
   * 回收失败分支并生成摘要
   */
  recycleFailedBranches(result: ParallelSpeculationResult): Array<{
    branchId: string
    branchName: string
    failureReason: string
    lessonsLearned: string[]
  }> {
    const failedBranches = result.allBranches.filter(b => !b.success)
    const recycled: Array<{
      branchId: string
      branchName: string
      failureReason: string
      lessonsLearned: string[]
    }> = []

    for (const branch of failedBranches) {
      const lessonsLearned: string[] = []

      // 分析失败原因并提取教训
      if (branch.error) {
        lessonsLearned.push(`执行错误: ${branch.error}`)
      }

      if (branch.reviewReport.findings.length > 0) {
        const criticalFindings = branch.reviewReport.findings.filter(f => f.severity === 'P0' || f.severity === 'P1')
        if (criticalFindings.length > 0) {
          lessonsLearned.push(...criticalFindings.map(f => `评审发现: ${f.title} - ${f.detail}`))
        }
      }

      if (branch.forkResult.exitReason === 'max_turns') {
        lessonsLearned.push('执行超轮次，需要简化任务或提高效率')
      }

      recycled.push({
        branchId: branch.branchId,
        branchName: branch.branchName,
        failureReason: branch.error || branch.reviewReport.findings[0]?.detail || '未知原因',
        lessonsLearned,
      })
    }

    if (this.config.debug && recycled.length > 0) {
      console.log(`[ParallelSpeculation] Recycled ${recycled.length} failed branches:`)
      recycled.forEach(r => {
        console.log(`  - ${r.branchName}: ${r.failureReason}`)
      })
    }

    return recycled
  }
}

/**
 * 创建并行推演管理器
 */
export function createParallelSpeculationManager(options?: ParallelSpeculationOptions): ParallelSpeculationManager {
  return new ParallelSpeculationManager(options)
}
