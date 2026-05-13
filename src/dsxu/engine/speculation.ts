/**
 * Speculation基础框架 - 预测执行系统
 * 
 * 支持注册speculation策略，并行推演多个可能的执行路径。
 * 设计原则：
 * 1. 可插拔策略 - 支持注册不同的预测策略
 * 2. 并行执行 - 可同时推演多个可能性
 * 3. 结果聚合 - 合并多个推演结果
 * 4. 资源控制 - 限制并行度和执行时间
 */

import type { Message, ToolDefinition, ToolContext, ToolOutput } from './types'

/**
 * Speculation策略接口
 */
export interface SpeculationStrategy {
  /** 策略名称 */
  name: string
  /** 策略描述 */
  description: string
  /** 生成预测执行计划 */
  generatePlan: (
    context: SpeculationContext,
    options?: SpeculationOptions
  ) => Promise<SpeculationPlan[]>
  /** 执行单个预测 */
  executeSpeculation: (
    plan: SpeculationPlan,
    context: SpeculationContext
  ) => Promise<SpeculationResult>
  /** 合并多个预测结果 */
  mergeResults?: (
    results: SpeculationResult[],
    context: SpeculationContext
  ) => Promise<SpeculationResult>
}

/**
 * Speculation上下文
 */
export interface SpeculationContext {
  /** 当前消息历史 */
  messages: Message[]
  /** 可用工具 */
  tools: ToolDefinition[]
  /** 当前工作目录 */
  cwd: string
  /** 会话ID */
  sessionId: string
  /** 当前档位 */
  gear: 1 | 2 | 3
  /** 用户查询 */
  query: string
  /** 额外上下文数据 */
  extra?: Record<string, any>
}

/**
 * Speculation选项
 */
export interface SpeculationOptions {
  /** 最大并行度 */
  maxParallel?: number
  /** 超时时间（毫秒） */
  timeoutMs?: number
  /** 最大预测数量 */
  maxSpeculations?: number
  /** 是否启用调试日志 */
  debug?: boolean
  /** 策略特定选项 */
  strategyOptions?: Record<string, any>
  /** 是否启用命中策略 */
  enableHitStrategy?: boolean
  /** 风险级别阈值（0-1，高于此值使用保守策略） */
  riskThreshold?: number
  /** 并行候选策略列表 */
  candidateStrategies?: string[]
  /** 默认策略（当风险高于阈值时使用） */
  defaultStrategy?: string
}

/**
 * Speculation统计信息
 */
export interface SpeculationStats {
  /** 总执行次数 */
  totalExecutions: number
  /** 命中次数（预测被采纳） */
  hits: number
  /** 回滚次数（预测被回滚） */
  rollbacks: number
  /** 命中率（0-1） */
  hitRate: number
  /** 回滚率（0-1） */
  rollbackRate: number
  /** 节省的总时间（毫秒） */
  totalSavedMs: number
  /** 平均节省时间（毫秒） */
  averageSavedMs: number
  /** 按策略统计 */
  byStrategy: Record<string, {
    executions: number
    hits: number
    rollbacks: number
    hitRate: number
    rollbackRate: number
    totalSavedMs: number
  }>
  /** 最近一次执行统计 */
  lastExecution?: {
    timestamp: number
    durationMs: number
    savedMs: number
    hit: boolean
    rollback: boolean
    strategy: string
  }
}

/**
 * Speculation执行计划
 */
export interface SpeculationPlan {
  /** 计划ID */
  id: string
  /** 策略名称 */
  strategy: string
  /** 预测描述 */
  description: string
  /** 预测步骤 */
  steps: SpeculationStep[]
  /** 置信度（0-1） */
  confidence: number
  /** 预计执行时间（毫秒） */
  estimatedDurationMs: number
  /** 计划元数据 */
  metadata?: Record<string, any>
}

/**
 * Speculation步骤
 */
export interface SpeculationStep {
  /** 步骤类型 */
  type: 'tool_call' | 'reasoning' | 'decision' | 'checkpoint'
  /** 步骤描述 */
  description: string
  /** 工具名称（如果是tool_call类型） */
  toolName?: string
  /** 工具输入（如果是tool_call类型） */
  toolInput?: Record<string, any>
  /** 预期结果 */
  expectedResult?: string
  /** 步骤元数据 */
  metadata?: Record<string, any>
}

/**
 * Speculation结果
 */
export interface SpeculationResult {
  /** 结果ID */
  id: string
  /** 计划ID */
  planId: string
  /** 策略名称 */
  strategy: string
  /** 执行是否成功 */
  success: boolean
  /** 执行结果内容 */
  content: string
  /** 实际执行时间（毫秒） */
  durationMs: number
  /** 置信度（0-1） */
  confidence: number
  /** 使用的工具 */
  toolsUsed: string[]
  /** 错误信息（如果有） */
  error?: string
  /** 结果元数据 */
  metadata?: Record<string, any>
}

/**
 * Speculation管理器
 */
export class SpeculationManager {
  private strategies: Map<string, SpeculationStrategy> = new Map()
  private config: Required<SpeculationOptions>
  private executionHistory: SpeculationResult[] = []
  private maxHistorySize = 100
  private stats: SpeculationStats = {
    totalExecutions: 0,
    hits: 0,
    rollbacks: 0,
    hitRate: 0,
    rollbackRate: 0,
    totalSavedMs: 0,
    averageSavedMs: 0,
    byStrategy: {},
  }

  constructor(options?: SpeculationOptions) {
    this.config = {
      maxParallel: options?.maxParallel ?? 3,
      timeoutMs: options?.timeoutMs ?? 30000,
      maxSpeculations: options?.maxSpeculations ?? 5,
      debug: options?.debug ?? false,
      strategyOptions: options?.strategyOptions ?? {},
      enableHitStrategy: options?.enableHitStrategy ?? true,
      riskThreshold: options?.riskThreshold ?? 0.7,
      candidateStrategies: options?.candidateStrategies ?? [],
      defaultStrategy: options?.defaultStrategy ?? 'conservative',
    }
  }

  /**
   * 注册Speculation策略
   */
  registerStrategy(strategy: SpeculationStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new Error(`Strategy ${strategy.name} already registered`)
    }
    this.strategies.set(strategy.name, strategy)
    
    if (this.config.debug) {
      console.log(`[Speculation] Registered strategy: ${strategy.name}`)
    }
  }

  /**
   * 获取已注册的策略
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * 获取策略实例
   */
  getStrategy(name: string): SpeculationStrategy | undefined {
    return this.strategies.get(name)
  }

  /**
   * 执行Speculation
   */
  async speculate(
    context: SpeculationContext,
    strategyNames?: string[]
  ): Promise<SpeculationResult[]> {
    const startTime = Date.now()
    
    if (this.config.debug) {
      console.log(`[Speculation] Starting speculation for query: ${context.query}`)
      console.log(`[Speculation] Context: ${context.messages.length} messages, ${context.tools.length} tools`)
    }

    // 确定要使用的策略
    const strategiesToUse = this.selectStrategies(strategyNames)
    if (strategiesToUse.length === 0) {
      if (this.config.debug) {
        console.log('[Speculation] No strategies available')
      }
      return []
    }

    // 为每个策略生成执行计划
    const allPlans: SpeculationPlan[] = []
    for (const strategy of strategiesToUse) {
      try {
        const plans = await strategy.generatePlan(context, {
          ...this.config,
          maxSpeculations: Math.floor(this.config.maxSpeculations / strategiesToUse.length),
        })
        allPlans.push(...plans)
      } catch (error: any) {
        console.warn(`[Speculation] Strategy ${strategy.name} plan generation failed: ${error.message}`)
      }
    }

    // 按置信度排序并限制数量
    const sortedPlans = allPlans
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSpeculations)

    if (sortedPlans.length === 0) {
      if (this.config.debug) {
        console.log('[Speculation] No plans generated')
      }
      return []
    }

    if (this.config.debug) {
      console.log(`[Speculation] Generated ${sortedPlans.length} plans`)
      sortedPlans.forEach((plan, i) => {
        console.log(`[Speculation] Plan ${i + 1}: ${plan.description} (confidence: ${plan.confidence.toFixed(2)})`)
      })
    }

    // 并行执行计划
    const results = await this.executePlansInParallel(sortedPlans, context)
    
    const totalDuration = Date.now() - startTime
    if (this.config.debug) {
      console.log(`[Speculation] Completed in ${totalDuration}ms with ${results.length} results`)
    }

    // 保存到历史记录
    this.executionHistory.push(...results)
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory = this.executionHistory.slice(-this.maxHistorySize)
    }

    return results
  }

  /**
   * 选择要使用的策略
   */
  private selectStrategies(strategyNames?: string[]): SpeculationStrategy[] {
    if (strategyNames && strategyNames.length > 0) {
      return strategyNames
        .map(name => this.strategies.get(name))
        .filter((strategy): strategy is SpeculationStrategy => strategy !== undefined)
    }
    
    // 默认使用所有策略
    return Array.from(this.strategies.values())
  }

  /**
   * 并行执行计划
   */
  private async executePlansInParallel(
    plans: SpeculationPlan[],
    context: SpeculationContext
  ): Promise<SpeculationResult[]> {
    const batches: SpeculationPlan[][] = []
    for (let i = 0; i < plans.length; i += this.config.maxParallel) {
      batches.push(plans.slice(i, i + this.config.maxParallel))
    }

    const allResults: SpeculationResult[] = []
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (plan) => {
        const strategy = this.strategies.get(plan.strategy)
        if (!strategy) {
          return {
            id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            planId: plan.id,
            strategy: plan.strategy,
            success: false,
            content: `Strategy ${plan.strategy} not found`,
            durationMs: 0,
            confidence: 0,
            toolsUsed: [],
            error: `Strategy ${plan.strategy} not found`,
          } as SpeculationResult
        }

        try {
          const result = await this.executeWithTimeout(
            () => strategy.executeSpeculation(plan, context),
            this.config.timeoutMs,
            plan.id
          )
          return result
        } catch (error: any) {
          return {
            id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            planId: plan.id,
            strategy: plan.strategy,
            success: false,
            content: `Execution failed: ${error.message}`,
            durationMs: 0,
            confidence: 0,
            toolsUsed: [],
            error: error.message,
          } as SpeculationResult
        }
      })

      const batchResults = await Promise.all(batchPromises)
      allResults.push(...batchResults)
    }

    return allResults
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    executeFn: () => Promise<T>,
    timeoutMs: number,
    planId: string
  ): Promise<T> {
    if (timeoutMs <= 0) {
      return await executeFn()
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Speculation execution timeout (${timeoutMs}ms) for plan ${planId}`))
      }, timeoutMs)
    })

    return await Promise.race([executeFn(), timeoutPromise])
  }

  /**
   * 获取执行历史
   */
  getExecutionHistory(limit?: number): SpeculationResult[] {
    const history = [...this.executionHistory]
    if (limit && limit > 0) {
      return history.slice(-limit)
    }
    return history
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const totalExecutions = this.executionHistory.length
    const successfulExecutions = this.executionHistory.filter(r => r.success).length
    const avgConfidence = totalExecutions > 0
      ? this.executionHistory.reduce((sum, r) => sum + r.confidence, 0) / totalExecutions
      : 0
    const avgDuration = totalExecutions > 0
      ? this.executionHistory.reduce((sum, r) => sum + r.durationMs, 0) / totalExecutions
      : 0

    return {
      totalExecutions,
      successfulExecutions,
      successRate: totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0,
      avgConfidence,
      avgDurationMs: avgDuration,
      registeredStrategies: this.getRegisteredStrategies(),
    }
  }

  /**
   * 更新配置
   */
  updateConfig(options: Partial<SpeculationOptions>): void {
    Object.assign(this.config, options)
    
    if (this.config.debug) {
      console.log('[Speculation] Config updated:', options)
    }
  }
}

/**
 * 基础Speculation策略 - 工具调用预测
 */
export class ToolCallSpeculationStrategy implements SpeculationStrategy {
  name = 'tool-call-prediction'
  description = 'Predict likely tool calls based on conversation history'

  async generatePlan(
    context: SpeculationContext,
    options?: SpeculationOptions
  ): Promise<SpeculationPlan[]> {
    const maxPlans = options?.maxSpeculations || 3
    const plans: SpeculationPlan[] = []

    // 分析对话历史，预测可能的工具调用
    const recentMessages = context.messages.slice(-10)
    const userQueries = recentMessages
      .filter(m => m.role === 'user')
      .map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content))

    const lastUserQuery = userQueries[userQueries.length - 1] || context.query
    
    // 根据查询内容预测工具调用
    const predictions = this.predictToolCalls(lastUserQuery, context.tools)
    
    for (const prediction of predictions.slice(0, maxPlans)) {
      const plan: SpeculationPlan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        strategy: this.name,
        description: prediction.description,
        steps: prediction.steps,
        confidence: prediction.confidence,
        estimatedDurationMs: prediction.estimatedDurationMs,
        metadata: {
          query: lastUserQuery,
          predictedTools: prediction.steps
            .filter(s => s.type === 'tool_call')
            .map(s => s.toolName)
            .filter((name): name is string => name !== undefined),
        },
      }
      plans.push(plan)
    }

    return plans
  }

  async executeSpeculation(
    plan: SpeculationPlan,
    context: SpeculationContext
  ): Promise<SpeculationResult> {
    const startTime = Date.now()
    const toolsUsed: string[] = []
    let success = true
    let error: string | undefined
    let content = ''

    try {
      // 模拟执行计划步骤
      for (const step of plan.steps) {
        if (step.type === 'tool_call' && step.toolName) {
          toolsUsed.push(step.toolName)
          
          // 在实际实现中，这里会实际调用工具
          // 目前只是模拟执行
          await new Promise(resolve => setTimeout(resolve, 100))
          
          content += `Executed ${step.toolName}: ${step.description}/n`
        } else if (step.type === 'reasoning') {
          content += `Reasoning: ${step.description}/n`
        }
      }
      
      content += `Speculation completed successfully.`
    } catch (err: any) {
      success = false
      error = err.message
      content = `Speculation failed: ${err.message}`
    }

    const durationMs = Date.now() - startTime

    return {
      id: `result-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      planId: plan.id,
      strategy: this.name,
      success,
      content,
      durationMs,
      confidence: success ? plan.confidence * 0.9 : plan.confidence * 0.3, // DSXU comment sanitized.
      toolsUsed,
      error,
      metadata: {
        originalPlan: plan.metadata,
        actualDurationMs: durationMs,
        estimatedDurationMs: plan.estimatedDurationMs,
      },
    }
  }

  /**
   * 预测工具调用
   */
  private predictToolCalls(query: string, tools: ToolDefinition[]): Array<{
    description: string
    steps: SpeculationStep[]
    confidence: number
    estimatedDurationMs: number
  }> {
    const predictions = []
    
    // 简单基于关键词的预测
    const queryLower = query.toLowerCase()
    
    // 检查是否需要读取文件
    if (queryLower.includes('read') || queryLower.includes('file') || queryLower.includes('content')) {
      predictions.push({
        description: 'Read file content speculation',
        steps: [
          {
            type: 'reasoning',
            description: 'User likely wants to read a file',
          },
          {
            type: 'tool_call',
            description: 'Use Read tool to examine file',
            toolName: 'Read',
            toolInput: { file_path: 'example.txt' },
          },
        ],
        confidence: 0.7,
        estimatedDurationMs: 1000,
      })
    }
    
    // 检查是否需要执行命令
    if (queryLower.includes('run') || queryLower.includes('test') || queryLower.includes('command')) {
      predictions.push({
        description: 'Execute command speculation',
        steps: [
          {
            type: 'reasoning',
            description: 'User likely wants to run a command',
          },
          {
            type: 'tool_call',
            description: 'Use Bash tool to execute command',
            toolName: 'Bash',
            toolInput: { command: 'echo "test"' },
          },
        ],
        confidence: 0.6,
        estimatedDurationMs: 2000,
      })
    }
    
    // 检查是否需要搜索
    if (queryLower.includes('search') || queryLower.includes('find') || queryLower.includes('grep')) {
      predictions.push({
        description: 'Search content speculation',
        steps: [
          {
            type: 'reasoning',
            description: 'User likely wants to search for content',
          },
          {
            type: 'tool_call',
            description: 'Use Grep tool to search',
            toolName: 'Grep',
            toolInput: { pattern: 'search-term', path: '.' },
          },
        ],
        confidence: 0.65,
        estimatedDurationMs: 1500,
      })
    }
    
    // 默认预测：分析对话
    predictions.push({
      description: 'General conversation analysis speculation',
      steps: [
        {
          type: 'reasoning',
          description: 'Analyze conversation to understand user intent',
        },
        {
          type: 'decision',
          description: 'Determine appropriate next steps',
        },
      ],
      confidence: 0.5,
      estimatedDurationMs: 500,
    })
    
    return predictions
  }
}

/**
 * 增强的Speculation管理器扩展方法
 */
export class EnhancedSpeculationManager extends SpeculationManager {
  /**
   * 更新统计信息
   */
  updateStats(result: SpeculationResult, hit: boolean, rollback: boolean, savedMs: number): void {
    this.stats.totalExecutions++

    if (hit) {
      this.stats.hits++
    }

    if (rollback) {
      this.stats.rollbacks++
    }

    this.stats.totalSavedMs += savedMs

    // 更新命中率和回滚率
    this.stats.hitRate = this.stats.hits / this.stats.totalExecutions
    this.stats.rollbackRate = this.stats.rollbacks / this.stats.totalExecutions
    this.stats.averageSavedMs = this.stats.totalSavedMs / this.stats.totalExecutions

    // 更新按策略统计
    const strategyName = result.strategy
    if (!this.stats.byStrategy[strategyName]) {
      this.stats.byStrategy[strategyName] = {
        executions: 0,
        hits: 0,
        rollbacks: 0,
        hitRate: 0,
        rollbackRate: 0,
        totalSavedMs: 0,
      }
    }

    const strategyStats = this.stats.byStrategy[strategyName]
    strategyStats.executions++
    if (hit) strategyStats.hits++
    if (rollback) strategyStats.rollbacks++
    strategyStats.hitRate = strategyStats.hits / strategyStats.executions
    strategyStats.rollbackRate = strategyStats.rollbacks / strategyStats.executions
    strategyStats.totalSavedMs += savedMs

    // 更新最近一次执行
    this.stats.lastExecution = {
      timestamp: Date.now(),
      durationMs: result.durationMs,
      savedMs,
      hit,
      rollback,
      strategy: strategyName,
    }

    if (this.config.debug) {
      console.log(`[Speculation] Stats updated: hit=${hit}, rollback=${rollback}, savedMs=${savedMs}`)
      console.log(`[Speculation] Current stats: hitRate=${this.stats.hitRate.toFixed(2)}, rollbackRate=${this.stats.rollbackRate.toFixed(2)}, totalSavedMs=${this.stats.totalSavedMs}`)
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): SpeculationStats {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalExecutions: 0,
      hits: 0,
      rollbacks: 0,
      hitRate: 0,
      rollbackRate: 0,
      totalSavedMs: 0,
      averageSavedMs: 0,
      byStrategy: {},
    }
  }

  /**
   * 根据风险级别选择策略
   */
  selectStrategyByRisk(riskLevel: number, context: SpeculationContext): string[] {
    if (!this.config.enableHitStrategy) {
      return [this.config.defaultStrategy]
    }

    if (riskLevel > this.config.riskThreshold) {
      // 高风险：使用保守策略
      if (this.config.debug) {
        console.log(`[Speculation] High risk (${riskLevel.toFixed(2)} > ${this.config.riskThreshold}), using conservative strategy`)
      }
      return [this.config.defaultStrategy]
    }

    // 低风险：使用候选策略
    if (this.config.candidateStrategies && this.config.candidateStrategies.length > 0) {
      if (this.config.debug) {
        console.log(`[Speculation] Low risk (${riskLevel.toFixed(2)}), using candidate strategies: ${this.config.candidateStrategies.join(', ')}`)
      }
      return this.config.candidateStrategies
    }

    // 默认使用所有可用策略
    const allStrategies = Array.from(this.strategies.keys())
    if (this.config.debug) {
      console.log(`[Speculation] Using all available strategies: ${allStrategies.join(', ')}`)
    }
    return allStrategies
  }

  /**
   * 计算风险级别
   */
  calculateRiskLevel(context: SpeculationContext): number {
    // 基础风险计算
    let risk = 0.3 // 基础风险

    // 根据档位调整风险
    if (context.gear === 3) {
      risk += 0.4 // 高档位风险更高
    } else if (context.gear === 2) {
      risk += 0.2
    }

    // 根据历史命中率调整风险
    if (this.stats.totalExecutions > 0) {
      const successRate = 1 - this.stats.rollbackRate
      risk += (1 - successRate) * 0.3 // 回滚率越高风险越高
    }

    // 限制在0-1之间
    return Math.max(0, Math.min(1, risk))
  }

  /**
   * 增强的speculate方法
   */
  async speculateEnhanced(
    context: SpeculationContext,
    strategyNames?: string[]
  ): Promise<SpeculationResult[]> {
    const startTime = Date.now()

    // 计算风险级别
    const riskLevel = this.calculateRiskLevel(context)

    // 根据风险选择策略
    const selectedStrategies = this.selectStrategyByRisk(riskLevel, context)

    // 执行speculation
    const results = await this.speculate(context, selectedStrategies)

    const totalDuration = Date.now() - startTime

    // 计算节省的时间（假设正常执行需要2倍时间）
    const estimatedNormalDuration = totalDuration * 2
    const savedMs = Math.max(0, estimatedNormalDuration - totalDuration)

    // 更新统计（这里简化处理，实际应该根据是否命中来更新）
    if (results.length > 0) {
      const bestResult = results[0] // 假设第一个结果是最好的
      const hit = bestResult.success && bestResult.confidence > 0.7
      const rollback = !bestResult.success

      this.updateStats(bestResult, hit, rollback, savedMs)
    }

    // 输出每轮统计
    if (this.config.debug) {
      console.log(`[Speculation] Enhanced speculation completed in ${totalDuration}ms`)
      console.log(`[Speculation] Risk level: ${riskLevel.toFixed(2)}`)
      console.log(`[Speculation] Selected strategies: ${selectedStrategies.join(', ')}`)
      console.log(`[Speculation] speculation_hit_rate: ${this.stats.hitRate.toFixed(2)}`)
      console.log(`[Speculation] speculation_rollback_rate: ${this.stats.rollbackRate.toFixed(2)}`)
      console.log(`[Speculation] speculation_saved_ms: ${savedMs}`)
    }

    return results
  }
}

/**
 * 创建增强的Speculation管理器
 */
export function createEnhancedSpeculationManager(options?: SpeculationOptions): EnhancedSpeculationManager {
  const manager = new EnhancedSpeculationManager(options)

  // 注册默认策略
  manager.registerStrategy(new ToolCallSpeculationStrategy())

  return manager
}

/**
 * 创建默认的Speculation管理器（使用增强版本）
 */
export function createSpeculationManager(options?: SpeculationOptions): EnhancedSpeculationManager {
  return createEnhancedSpeculationManager(options)
}
