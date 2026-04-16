/**
 * Skills执行引擎 - 生产级Skills执行实现
 *
 * 执行阶段：参数解析 -> 权限校验 -> 执行 -> 结果标准化
 * 错误归一为可诊断错误码，不崩主链，可被telemetry统计
 */

import type { ToolUseContext } from '../../types/command'
import type { ToolContext } from './types'
import { PermissionManager, type PermissionCheckResult, type PermissionMode } from './permissions'
import { TransactionManager } from './transaction-manager'
import { TelemetryCollector } from './telemetry'
import { CostTracker } from './cost-tracker'
import { FileHistoryManager } from './file-history'

/**
 * Skills执行错误码
 */
export enum SkillErrorCode {
  /** 技能执行成功 */
  SUCCESS = 'SKILL_SUCCESS',
  /** 技能执行超时 */
  TIMEOUT = 'SKILL_TIMEOUT',
  /** 权限被拒绝 */
  PERMISSION_DENIED = 'SKILL_PERMISSION_DENIED',
  /** 运行时错误 */
  RUNTIME_ERROR = 'SKILL_RUNTIME_ERROR',
  /** 参数解析错误 */
  PARSE_ERROR = 'SKILL_PARSE_ERROR',
  /** 技能未找到 */
  NOT_FOUND = 'SKILL_NOT_FOUND',
  /** 技能已禁用 */
  DISABLED = 'SKILL_DISABLED',
  /** 事务回滚错误 */
  ROLLBACK_ERROR = 'SKILL_ROLLBACK_ERROR',
}

/**
 * Skills执行结果
 */
export interface SkillExecutionResult {
  content: string
  isError?: boolean
  meta?: Record<string, any>
  /** 错误码（如果isError为true） */
  errorCode?: SkillErrorCode
}

/**
 * Skills执行配置
 */
export interface SkillsExecutorConfig {
  /** 是否启用模拟执行 */
  mockExecution?: boolean
  /** 模拟执行延迟（毫秒） */
  mockDelay?: number
  /** 是否启用调试日志 */
  debug?: boolean
  /** 执行超时时间（毫秒） */
  timeoutMs?: number
  /** 是否启用权限校验 */
  enablePermissions?: boolean
  /** 是否启用事务跟踪 */
  enableTransaction?: boolean
  /** 是否启用遥测 */
  enableTelemetry?: boolean
  /** 是否启用成本跟踪 */
  enableCostTracking?: boolean
  /** 权限模式 */
  permissionMode?: PermissionMode
  /** 权限检查回调 */
  permissionAskCallback?: (prompt: string) => Promise<boolean>
  /** 事务管理器配置 */
  transactionConfig?: {
    enabled?: boolean
    rollbackOnToolError?: boolean
    maxTrackedFilesPerTurn?: number
  }
  /** 遥测配置 */
  telemetryConfig?: {
    enabled?: boolean
    maxEvents?: number
  }
  /** 成本跟踪配置 */
  costConfig?: {
    enabled?: boolean
    budget?: {
      perSession?: number
      perDay?: number
      perMonth?: number
    }
    onAlert?: (alert: any) => void
  }
}

/**
 * Skills执行引擎 - 生产级实现
 *
 * 负责执行Skills系统的实际逻辑，集成权限、超时、事务、遥测、成本跟踪。
 * 所有错误归一为可诊断错误码，不崩主链。
 */
export class SkillsExecutor {
  private config: Required<SkillsExecutorConfig>
  private executionStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalDurationMs: 0,
    errorCounts: new Map<SkillErrorCode, number>(),
  }
  private permissionManager: PermissionManager | null = null
  private transactionManager: TransactionManager | null = null
  private telemetryCollector: TelemetryCollector | null = null
  private costTracker: CostTracker | null = null
  private fileHistoryManager: FileHistoryManager | null = null

  constructor(config?: SkillsExecutorConfig) {
    this.config = {
      mockExecution: config?.mockExecution ?? true,
      mockDelay: config?.mockDelay ?? 0,
      debug: config?.debug ?? false,
      timeoutMs: config?.timeoutMs ?? 30000, // 30秒超时
      enablePermissions: config?.enablePermissions ?? true,
      enableTransaction: config?.enableTransaction ?? true,
      enableTelemetry: config?.enableTelemetry ?? true,
      enableCostTracking: config?.enableCostTracking ?? true,
      permissionMode: config?.permissionMode ?? 'default',
      permissionAskCallback: config?.permissionAskCallback,
      transactionConfig: config?.transactionConfig ?? {
        enabled: true,
        rollbackOnToolError: true,
        maxTrackedFilesPerTurn: 32,
      },
      telemetryConfig: config?.telemetryConfig ?? {
        enabled: true,
        maxEvents: 1000,
      },
      costConfig: config?.costConfig ?? {
        enabled: true,
        budget: {},
        onAlert: undefined,
      },
    }

    // 初始化权限管理器
    if (this.config.enablePermissions) {
      this.permissionManager = new PermissionManager(
        this.config.permissionMode,
        this.config.permissionAskCallback
      )
    }

    // 初始化文件历史管理器
    this.fileHistoryManager = new FileHistoryManager({ cwd: process.cwd() })

    // 初始化事务管理器
    if (this.config.enableTransaction && this.fileHistoryManager) {
      this.transactionManager = new TransactionManager(
        this.fileHistoryManager,
        process.cwd(),
        this.config.transactionConfig
      )
    }

    // 初始化遥测收集器
    if (this.config.enableTelemetry) {
      this.telemetryCollector = new TelemetryCollector(
        `skills-${Date.now()}`,
        this.config.telemetryConfig.enabled,
        this.config.telemetryConfig.maxEvents
      )
    }

    // 初始化成本跟踪器
    if (this.config.enableCostTracking) {
      this.costTracker = new CostTracker(
        `skills-${Date.now()}`,
        this.config.costConfig.budget,
        this.config.costConfig.onAlert
      )
    }
  }

  /**
   * 执行技能命令 - 生产级流程
   *
   * 执行阶段：参数解析 -> 权限校验 -> 执行 -> 结果标准化
   * 所有错误归一为可诊断错误码，不崩主链
   */
  async execute(
    skillName: string,
    args: string,
    context: ToolUseContext
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now()
    this.executionStats.totalExecutions++

    try {
      if (this.config.debug) {
        console.log(`[SkillsExecutor] Executing skill: ${skillName} with args: ${args}`)
      }

      // 阶段1: 参数解析
      const parsedArgs = this.parseArguments(skillName, args)

      // 阶段2: 权限校验
      if (this.config.enablePermissions) {
        const permissionResult = await this.checkPermissions(skillName, parsedArgs, context)
        if (!permissionResult.allowed) {
          return this.createErrorResult(
            skillName,
            SkillErrorCode.PERMISSION_DENIED,
            `Permission denied for skill ${skillName}: ${permissionResult.reason}`,
            startTime
          )
        }
      }

      // 阶段3: 事务开始（如果需要）
      let transactionId: string | undefined
      if (this.config.enableTransaction && this.isWriteSkill(skillName)) {
        transactionId = await this.beginTransaction(skillName, context)
      }

      // 阶段4: 执行（带超时控制）
      let result: SkillExecutionResult
      try {
        if (this.config.mockExecution) {
          result = await this.executeWithTimeout(
            () => this.mockExecute(skillName, parsedArgs, context),
            skillName,
            startTime
          )
        } else {
          result = await this.executeWithTimeout(
            () => this.realExecute(skillName, parsedArgs, context),
            skillName,
            startTime
          )
        }
      } catch (error: any) {
        // 阶段5: 事务回滚（如果失败且有事务）
        if (transactionId) {
          await this.rollbackTransaction(transactionId, skillName, context)
        }

        // 根据错误类型返回相应的错误码
        if (error.name === 'TimeoutError') {
          return this.createErrorResult(
            skillName,
            SkillErrorCode.TIMEOUT,
            `Skill ${skillName} execution timeout (${this.config.timeoutMs}ms)`,
            startTime
          )
        }

        return this.createErrorResult(
          skillName,
          SkillErrorCode.RUNTIME_ERROR,
          `Skill ${skillName} runtime error: ${error.message}`,
          startTime,
          error
        )
      }

      // 阶段6: 事务提交（如果成功且有事务）
      if (transactionId && !result.isError) {
        await this.commitTransaction(transactionId, skillName, context)
      }

      const duration = Math.max(1, Date.now() - startTime)
      this.executionStats.totalDurationMs += duration

      if (result.isError) {
        this.executionStats.failedExecutions++
        const errorCode = result.errorCode || SkillErrorCode.RUNTIME_ERROR
        this.executionStats.errorCounts.set(errorCode, (this.executionStats.errorCounts.get(errorCode) || 0) + 1)
      } else {
        this.executionStats.successfulExecutions++
      }

      // 阶段7: 遥测记录
      if (this.config.enableTelemetry) {
        await this.recordTelemetry(skillName, result, duration, context)
      }

      // 阶段8: 成本跟踪
      if (this.config.enableCostTracking) {
        await this.trackCost(skillName, result, duration, context)
      }

      if (this.config.debug) {
        console.log(`[SkillsExecutor] Skill ${skillName} executed in ${duration}ms, status: ${result.isError ? 'failed' : 'success'}`)
      }

      // 标准化结果输出
      return {
        ...result,
        meta: {
          ...result.meta,
          durationMs: duration,
          skill: skillName,
          args,
          timestamp: new Date().toISOString(),
          transactionId,
          // 生产级诊断字段
          diagnostics: {
            skillName,
            durationMs: duration,
            status: result.isError ? 'failed' : 'success',
            errorCode: result.errorCode,
            transactionId,
          },
        },
      }
    } catch (error: any) {
      // 顶层错误处理，确保不崩主链
      const duration = Math.max(1, Date.now() - startTime)
      this.executionStats.failedExecutions++
      this.executionStats.errorCounts.set(SkillErrorCode.RUNTIME_ERROR, (this.executionStats.errorCounts.get(SkillErrorCode.RUNTIME_ERROR) || 0) + 1)

      console.error(`[SkillsExecutor] Critical skill execution error (${skillName}): ${error.message}`)

      return {
        content: `Critical skill execution error (${skillName}): ${error.message}`,
        isError: true,
        errorCode: SkillErrorCode.RUNTIME_ERROR,
        meta: {
          skill: skillName,
          error: error.message,
          durationMs: duration,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          diagnostics: {
            skillName,
            durationMs: duration,
            status: 'critical_failure',
            errorCode: SkillErrorCode.RUNTIME_ERROR,
          },
        },
      }
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 解析参数
   */
  private parseArguments(skillName: string, args: string): any {
    try {
      // 简单参数解析，实际可根据技能需求扩展
      if (!args || args.trim() === '') {
        return {}
      }

      // 尝试解析为JSON
      try {
        return JSON.parse(args)
      } catch {
        // 如果不是JSON，返回原始字符串
        return { raw: args }
      }
    } catch (error: any) {
      throw new Error(`Failed to parse arguments for skill ${skillName}: ${error.message}`)
    }
  }

  /**
   * 检查权限
   */
  private async checkPermissions(
    skillName: string,
    args: any,
    context: ToolUseContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.config.enablePermissions || !this.permissionManager) {
      return { allowed: true, reason: 'permissions disabled' }
    }

    try {
      // 将ToolUseContext转换为ToolContext
      const toolContext: ToolContext = {
        cwd: context.cwd || process.cwd(),
        sessionId: context.sessionId || `skill-${Date.now()}`,
        gear: 1, // 默认1档
      }

      // 构建工具输入
      const toolInput = {
        args: typeof args === 'string' ? args : JSON.stringify(args),
        skillName,
        ...(typeof args === 'object' ? args : {}),
      }

      // 检查权限
      const result = await this.permissionManager.checkPermission(
        `skill__${skillName}`,
        toolInput,
        toolContext
      )

      if (result.decision === 'allow') {
        return { allowed: true, reason: result.reason }
      } else if (result.decision === 'ask') {
        // 需要用户确认
        if (this.config.debug) {
          console.log(`[SkillsExecutor] Permission check requires user confirmation for skill ${skillName}`)
        }
        // 在真实环境中，这里应该触发用户确认流程
        // 暂时返回拒绝，等待用户确认机制
        return { allowed: false, reason: `Permission requires confirmation: ${result.reason}` }
      } else {
        return { allowed: false, reason: `Permission denied: ${result.reason}` }
      }
    } catch (error: any) {
      console.error(`[SkillsExecutor] Permission check error for skill ${skillName}: ${error.message}`)
      // 权限检查失败时，默认拒绝以保证安全
      return { allowed: false, reason: `Permission check error: ${error.message}` }
    }
  }

  /**
   * 判断是否为写操作技能
   */
  private isWriteSkill(skillName: string): boolean {
    // 根据技能名称判断是否为写操作
    const writeSkills = ['commit', 'skillify', 'update-config', 'write', 'edit']
    return writeSkills.some(writeSkill => skillName.toLowerCase().includes(writeSkill))
  }

  /**
   * 跟踪文件操作（用于事务管理）
   */
  private trackFileOperation(filePath: string, skillName: string): boolean {
    if (!this.config.enableTransaction || !this.transactionManager) {
      return false
    }

    return this.transactionManager.track(filePath)
  }

  /**
   * 开始事务
   */
  private async beginTransaction(
    skillName: string,
    context: ToolUseContext
  ): Promise<string> {
    if (!this.config.enableTransaction || !this.transactionManager) {
      return ''
    }

    const txId = `skill-${skillName}-${Date.now()}`
    this.transactionManager.begin(txId)

    if (this.config.debug) {
      console.log(`[SkillsExecutor] Started transaction ${txId} for skill ${skillName}`)
    }

    // 记录遥测
    if (this.telemetryCollector) {
      this.telemetryCollector.track('transaction_started', {
        skill: skillName,
        txId,
        cwd: context.cwd,
      })
    }

    return txId
  }

  /**
   * 提交事务
   */
  private async commitTransaction(
    transactionId: string,
    skillName: string,
    context: ToolUseContext
  ): Promise<void> {
    if (!this.config.enableTransaction || !this.transactionManager || !transactionId) {
      return
    }

    this.transactionManager.commit()

    if (this.config.debug) {
      console.log(`[SkillsExecutor] Committed transaction ${transactionId} for skill ${skillName}`)
    }

    // 记录遥测
    if (this.telemetryCollector) {
      this.telemetryCollector.track('transaction_committed', {
        skill: skillName,
        txId: transactionId,
        cwd: context.cwd,
      })
    }
  }

  /**
   * 回滚事务
   */
  private async rollbackTransaction(
    transactionId: string,
    skillName: string,
    context: ToolUseContext
  ): Promise<void> {
    if (!this.config.enableTransaction || !this.transactionManager || !transactionId) {
      return
    }

    const rolledBackFiles = this.transactionManager.rollback()

    if (this.config.debug) {
      console.log(`[SkillsExecutor] Rolled back transaction ${transactionId} for skill ${skillName}, files: ${rolledBackFiles.length}`)
    }

    // 记录遥测
    if (this.telemetryCollector) {
      this.telemetryCollector.track('transaction_rolled_back', {
        skill: skillName,
        txId: transactionId,
        filesChanged: rolledBackFiles,
        filesChangedCount: rolledBackFiles.length,
        cwd: context.cwd,
      })
    }
  }

  /**
   * 带超时执行
   */
  private async executeWithTimeout<T>(
    executeFn: () => Promise<T>,
    skillName: string,
    startTime: number
  ): Promise<T> {
    if (this.config.timeoutMs <= 0) {
      return await executeFn()
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`Skill ${skillName} execution timeout`)
        timeoutError.name = 'TimeoutError'
        reject(timeoutError)
      }, this.config.timeoutMs)
    })

    return await Promise.race([executeFn(), timeoutPromise])
  }

  /**
   * 创建错误结果
   */
  private createErrorResult(
    skillName: string,
    errorCode: SkillErrorCode,
    message: string,
    startTime: number,
    originalError?: any
  ): SkillExecutionResult {
    const duration = Math.max(1, Date.now() - startTime)
    this.executionStats.failedExecutions++
    this.executionStats.errorCounts.set(errorCode, (this.executionStats.errorCounts.get(errorCode) || 0) + 1)

    return {
      content: message,
      isError: true,
      errorCode,
      meta: {
        skill: skillName,
        error: message,
        durationMs: duration,
        originalError: originalError?.message,
        stack: originalError?.stack,
        timestamp: new Date().toISOString(),
        diagnostics: {
          skillName,
          durationMs: duration,
          status: 'failed',
          errorCode,
        },
      },
    }
  }

  /**
   * 记录遥测
   */
  private async recordTelemetry(
    skillName: string,
    result: SkillExecutionResult,
    duration: number,
    context: ToolUseContext
  ): Promise<void> {
    if (!this.config.enableTelemetry || !this.telemetryCollector) {
      return
    }

    const eventType = result.isError ? 'skill_error' : 'skill_success'
    const errorCode = result.errorCode || SkillErrorCode.RUNTIME_ERROR

    this.telemetryCollector.track(eventType, {
      skill: skillName,
      durationMs: duration,
      success: !result.isError,
      errorCode: result.isError ? errorCode : undefined,
      cwd: context.cwd,
      sessionId: context.sessionId,
      // 生产级诊断字段
      diagnostics: {
        skillName,
        durationMs: duration,
        status: result.isError ? 'failed' : 'success',
        errorCode: result.isError ? errorCode : undefined,
      },
    })

    // 记录技能执行统计
    this.telemetryCollector.track('skill_execution', {
      skill: skillName,
      durationMs: duration,
      isError: result.isError,
      errorCode: result.isError ? errorCode : undefined,
    })

    if (this.config.debug) {
      console.log(`[SkillsExecutor Telemetry] Skill: ${skillName}, Duration: ${duration}ms, Success: ${!result.isError}`)
    }
  }

  /**
   * 跟踪成本
   */
  private async trackCost(
    skillName: string,
    result: SkillExecutionResult,
    duration: number,
    context: ToolUseContext
  ): Promise<void> {
    if (!this.config.enableCostTracking || !this.costTracker) {
      return
    }

    try {
      // 估算技能执行的token消耗
      // 这是一个简化估算，实际应该根据技能执行的具体内容来估算
      const inputTokens = Math.ceil(duration / 100) // 每100ms估算1个token
      const outputTokens = Math.ceil(duration / 50) // 每50ms估算1个token

      // 使用默认模型（deepseek-chat）进行成本估算
      const costEntry = this.costTracker.record(
        'deepseek-chat',
        inputTokens,
        outputTokens,
        false // 技能执行通常不是缓存命中
      )

      if (this.config.debug) {
        console.log(`[SkillsExecutor Cost] Skill: ${skillName}, Duration: ${duration}ms, Cost: $${costEntry.cost.toFixed(6)}`)
      }

      // 记录成本遥测
      if (this.telemetryCollector) {
        this.telemetryCollector.track('skill_cost', {
          skill: skillName,
          durationMs: duration,
          inputTokens,
          outputTokens,
          cost: costEntry.cost,
          model: 'deepseek-chat',
        })
      }
    } catch (error: any) {
      console.error(`[SkillsExecutor] Cost tracking error for skill ${skillName}: ${error.message}`)
      // 成本跟踪错误不应影响技能执行
    }
  }

  /**
   * 获取执行统计
   */
  getExecutionStats() {
    return {
      ...this.executionStats,
      avgDurationMs: this.executionStats.totalExecutions > 0
        ? this.executionStats.totalDurationMs / this.executionStats.totalExecutions
        : 0,
      successRate: this.executionStats.totalExecutions > 0
        ? (this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100
        : 0,
      errorDistribution: Object.fromEntries(this.executionStats.errorCounts),
    }
  }

  // ==================== 核心执行方法 ====================

  /**
   * 模拟执行技能
   */
  private async mockExecute(
    skillName: string,
    args: any,
    context: ToolUseContext
  ): Promise<SkillExecutionResult> {
    // 模拟执行延迟
    if (this.config.mockDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.mockDelay))
    }

    // 根据技能名称生成不同的模拟结果
    const mockResults: Record<string, SkillExecutionResult> = {
      skillify: {
        content: `[Mock Skill Execution: skillify]\n\nSkillify would capture the current session as a reusable skill.\n\nArguments: ${JSON.stringify(args)}\n\nContext: cwd=${context.cwd}, sessionId=${context.sessionId}\n\nNote: This is a mock execution. Real skillify execution would create a SKILL.md file.`,
        isError: false,
        meta: {
          mock: true,
          skillType: 'skillify',
          wouldCreateFile: 'SKILL.md',
        },
      },
      commit: {
        content: `[Mock Skill Execution: commit]\n\nCommit skill would create a git commit with the provided message.\n\nArguments: ${JSON.stringify(args)}\n\nContext: cwd=${context.cwd}, sessionId=${context.sessionId}\n\nNote: This is a mock execution. Real commit execution would run git commands.`,
        isError: false,
        meta: {
          mock: true,
          skillType: 'commit',
          wouldRunCommand: 'git commit',
        },
      },
      'review-pr': {
        content: `[Mock Skill Execution: review-pr]\n\nReview-PR skill would review a GitHub pull request.\n\nArguments: ${JSON.stringify(args)}\n\nContext: cwd=${context.cwd}, sessionId=${context.sessionId}\n\nNote: This is a mock execution. Real review-pr execution would fetch and analyze PR details.`,
        isError: false,
        meta: {
          mock: true,
          skillType: 'review-pr',
          wouldFetch: 'GitHub PR data',
        },
      },
      'update-config': {
        content: `[Mock Skill Execution: update-config]\n\nUpdate-config skill would modify configuration settings.\n\nArguments: ${JSON.stringify(args)}\n\nContext: cwd=${context.cwd}, sessionId=${context.sessionId}\n\nNote: This is a mock execution. Real update-config execution would update settings.json.`,
        isError: false,
        meta: {
          mock: true,
          skillType: 'update-config',
          wouldUpdate: 'settings.json',
        },
      },
    }

    // 返回特定技能的模拟结果，或通用模拟结果
    const result = mockResults[skillName] || {
      content: `[Mock Skill Execution: ${skillName}]\n\nSkill "${skillName}" would be executed with arguments: ${JSON.stringify(args)}\n\nContext: cwd=${context.cwd}, sessionId=${context.sessionId}\n\nNote: This is a mock execution. Real execution would invoke the actual skill.`,
      isError: false,
      meta: {
        mock: true,
        skillType: 'generic',
      },
    }

    return result
  }

  /**
   * 实际执行技能（最小可执行实现）
   *
   * 使用Bash工具执行技能命令。
   * 这是一个最小实现，实际生产环境需要更完整的集成。
   */
  private async realExecute(
    skillName: string,
    args: string,
    context: ToolUseContext
  ): Promise<SkillExecutionResult> {
    try {
      if (this.config.debug) {
        console.log(`[SkillsExecutor] Real execution: ${skillName} with args: ${args}`)
      }

      // 构建技能命令
      const command = this.buildSkillCommand(skillName, args)

      // 执行命令
      const result = await this.executeCommand(command, context)

      // 转换结果为统一格式
      return {
        content: this.formatResult(result),
        isError: false,
        meta: {
          skill: skillName,
          resultType: 'command',
          rawResult: result,
          command,
        },
      }
    } catch (error: any) {
      return {
        content: `Skills execution error (${skillName}): ${error.message}`,
        isError: true,
        meta: {
          skill: skillName,
          error: error.message,
          stack: error.stack,
        },
      }
    }
  }

  /**
   * 构建技能命令
   */
  private buildSkillCommand(skillName: string, args: string): string {
    // 简单实现：使用bun运行技能
    // 实际应该调用Claude Code的Skills执行逻辑
    return `echo "[Skill Execution: ${skillName}] Arguments: ${args}"`
  }

  /**
   * 执行命令
   */
  private async executeCommand(command: string, context: ToolUseContext): Promise<any> {
    // 使用Bash工具执行命令
    // 这是一个简化实现，实际应该使用Claude Code的命令执行机制
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: context.cwd,
        env: process.env,
      })

      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: true,
      }
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message,
        success: false,
        error: error,
      }
    }
  }

  /**
   * 格式化执行结果（用于实际执行）
   */
  private formatResult(result: any): string {
    if (typeof result === 'string') return result
    if (result?.content) return result.content
    if (result?.output) return result.output
    if (result?.message) return result.message

    // 尝试转换为字符串
    try {
      return JSON.stringify(result, null, 2)
    } catch {
      return String(result)
    }
  }

  /**
   * 获取执行器状态
   */
  getStatus() {
    return {
      mockExecution: this.config.mockExecution,
      config: this.config,
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SkillsExecutorConfig>): void {
    Object.assign(this.config, config)

    if (this.config.debug) {
      console.log(`[SkillsExecutor] Config updated:`, config)
    }
  }
}

/**
 * 创建默认的Skills执行器
 */
export function createSkillsExecutor(config?: SkillsExecutorConfig): SkillsExecutor {
  return new SkillsExecutor(config)
}
