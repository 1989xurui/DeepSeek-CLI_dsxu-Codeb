/**
 * Skills执行引擎 - 生产级Skills执行实现
 *
 * 执行阶段：参数解析 -> 权限校验 -> 执行 -> 结果标准化
 * 错误归一为可诊断错误码，不崩主链，可被telemetry统计
 */

import type { ToolUseContext } from '../../types/command'
import type { ToolContext } from './types'
import type { PermissionMode } from '../../types/permissions'
import { evaluateToolGate } from './tool-gate-v1'
import type { ToolPermissionLevel } from './tool-types-v1'
import { buildSkillToolGateDefinition, isWriteSkillName } from './skills-registry-v1'
import { TransactionManager } from './transaction-manager'
import { TelemetryCollector } from './telemetry'
import { CostTracker } from './cost-tracker'
import { FileHistoryManager } from './file-history'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../utils/model/deepseekV4Control'

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
  private transactionManager: TransactionManager | null = null
  private telemetryCollector: TelemetryCollector | null = null
  private costTracker: CostTracker | null = null
  private fileHistoryManager: FileHistoryManager | null = null

  constructor(config?: SkillsExecutorConfig) {
    this.config = {
      mockExecution: config?.mockExecution ?? true,
      mockDelay: config?.mockDelay ?? 0,
      debug: config?.debug ?? false,
      timeoutMs: config?.timeoutMs ?? 30000, // 默认 30 秒执行超时
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
          result = this.createErrorResult(
            skillName,
            SkillErrorCode.RUNTIME_ERROR,
            'Standalone SkillsExecutor runtime is disabled; skill execution must enter SkillTool and Skill Registry mainline',
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
    if (!this.config.enablePermissions) {
      return { allowed: true, reason: 'permissions disabled' }
    }

    try {
      const toolContext: ToolContext = {
        cwd: context.cwd || process.cwd(),
        sessionId: context.sessionId || `skill-${Date.now()}`,
        gear: 1,
      }

      const toolInput = {
        args: typeof args === 'string' ? args : JSON.stringify(args),
        skillName,
        ...(typeof args === 'object' ? args : {}),
      }
      const gateTool = buildSkillToolGateDefinition({
        skillName,
        input: toolInput,
        cwd: toolContext.cwd,
        sessionId: toolContext.sessionId,
      })
      const gate = evaluateToolGate(gateTool, {
        allowedPermissionLevel: this.permissionLevelForMode(this.config.permissionMode),
        requireConfirmationForWrite: this.config.permissionMode !== 'bypassPermissions' && this.config.permissionMode !== 'acceptEdits',
      })

      if (gate.executionDecision === 'deny') {
        return { allowed: false, reason: gate.failureHint.recommendedAction }
      }
      if (gate.gateDecision === 'require_confirmation' || gate.executionDecision === 'defer') {
        if (!this.config.permissionAskCallback) {
          return { allowed: true, reason: `${gate.gateDecision} without callback; allowed by autonomous skill policy` }
        }
        const allowed = await this.config.permissionAskCallback(
          `Skill "${skillName}" requires permission: ${gate.confirmation.reason}`
        )
        return allowed
          ? { allowed: true, reason: 'user-approved' }
          : { allowed: false, reason: 'user-denied' }
      }
      return { allowed: true, reason: gate.approvalTrace.notes.join(',') || 'tool-gate-approved' }
    } catch (error: any) {
      console.error(`[SkillsExecutor] Permission check error for skill ${skillName}: ${error.message}`)
      return { allowed: false, reason: `Permission check error: ${error.message}` }
    }
  }

  private permissionLevelForMode(mode: PermissionMode): ToolPermissionLevel {
    if (mode === 'plan') return 'safe'
    if (mode === 'bypassPermissions' || mode === 'acceptEdits') return 'privileged'
    return 'guarded'
  }

  /**
   * 判断是否为写操作技能
   */
  private isWriteSkill(skillName: string): boolean {
    return isWriteSkillName(skillName)
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
      const inputTokens = Math.ceil(duration / 100) // 每100ms估算1个token
      const outputTokens = Math.ceil(duration / 50) // 每50ms估算1个token

      // 使用统一路由层的默认 Flash 模型进行成本估算
      const costEntry = this.costTracker.record(
        DEEPSEEK_V4_FLASH_MODEL,
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
          model: DEEPSEEK_V4_FLASH_MODEL,
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
