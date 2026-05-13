/**
 * DSXU Tool Protocol v1
 *
 * 目标：定义 DSXU 原生工具协议，统一工具调用、结果、错误和事件。
 * 原则：DSXU native 优先，external 次之，legacy adapter 仅作兼容兜底。
 */

export type ToolCapabilityTag =
  | 'file_operation'
  | 'shell_execution'
  | 'read_only'
  | 'write_operation'
  | 'network_access'
  | 'system_access'
  | 'debug'
  | 'analysis'

export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type ToolExecutorKind =
  | 'dsxu_native'
  | 'external'
  | 'legacy_adapter'
  | 'bridge'

export interface ToolSpec {
  name: string
  description: string
  inputSchema: Record<string, any>
  capabilityTags: ToolCapabilityTag[]
  riskLevel: ToolRiskLevel
  executorKind: ToolExecutorKind
  concurrencySafe?: boolean
  readOnly?: boolean
  enabled?: boolean
  bridgeToolNames?: string[]
}

export interface ToolCallRequest {
  callId: string
  toolName: string
  arguments: Record<string, any>
  source: 'llm' | 'skill' | 'manual' | 'system'
  taskId?: string
  dryRun?: boolean
  priority?: number
}

export type ToolErrorType =
  | 'VALIDATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'UNAVAILABLE'
  | 'UNKNOWN'

export interface ToolError {
  type: ToolErrorType
  message: string
  retryable: boolean
  raw?: any
  details?: Record<string, any>
}

export type ToolEventType =
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_failed'
  | 'tool_guard_check'
  | 'tool_execution_progress'

export interface ToolEvent {
  type: ToolEventType
  callId: string
  toolName: string
  timestamp: number
  data: Record<string, any>
}

export interface ToolCallResult {
  ok: boolean
  outputText: string
  structuredData?: Record<string, any>
  events: ToolEvent[]
  error?: ToolError
  metadata: {
    duration: number
    executorKind: ToolExecutorKind
    usedBridge: boolean
    toolSpec?: ToolSpec
  }
}

export type ToolGuardDecision =
  | { type: 'allow' }
  | { type: 'block'; reason: string; errorType: ToolErrorType }
  | { type: 'require_approval'; reason: string; approvalId?: string }

export interface ToolExecutionContext {
  cwd: string
  sessionId: string
  gear: 1 | 2 | 3
  emitEvent: (event: ToolEvent) => void
  budget?: {
    maxExecutionTime?: number
    maxOutputSize?: number
  }
  approvalHooks?: {
    checkApproval?: (request: ToolCallRequest, spec: ToolSpec) => Promise<boolean>
    getApproval?: (approvalId: string) => Promise<boolean>
  }
  taskMetadata?: {
    taskId?: string
    description?: string
    priority?: number
  }
  abortSignal?: AbortSignal
}

export interface ToolExecutor {
  kind: ToolExecutorKind
  supports(toolName: string): boolean
  execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolCallResult>
}

export class ToolSpecRegistry {
  private specs = new Map<string, ToolSpec>()

  register(spec: ToolSpec): void {
    this.specs.set(spec.name, spec)
  }

  get(toolName: string): ToolSpec | undefined {
    return this.specs.get(toolName)
  }

  getAll(): ToolSpec[] {
    return Array.from(this.specs.values())
  }

  filterByTags(tags: ToolCapabilityTag[]): ToolSpec[] {
    return this.getAll().filter(spec => tags.some(tag => spec.capabilityTags.includes(tag)))
  }

  filterByRiskLevel(riskLevel: ToolRiskLevel): ToolSpec[] {
    return this.getAll().filter(spec => spec.riskLevel === riskLevel)
  }
}

export class ToolExecutorFactory {
  private executors = new Map<ToolExecutorKind, ToolExecutor[]>()

  register(executor: ToolExecutor): void {
    const current = this.executors.get(executor.kind) ?? []
    current.push(executor)
    this.executors.set(executor.kind, current)
  }

  getAll(kind: ToolExecutorKind): ToolExecutor[] {
    return this.executors.get(kind) ?? []
  }

  getExecutorsForTool(toolName: string): ToolExecutor[] {
    const order: ToolExecutorKind[] = ['dsxu_native', 'external', 'legacy_adapter', 'bridge']
    return order.flatMap(kind => this.getAll(kind).filter(executor => executor.supports(toolName)))
  }
}

export class ToolGuardSystem {
  async check(
    request: ToolCallRequest,
    spec: ToolSpec,
    context: ToolExecutionContext,
  ): Promise<ToolGuardDecision> {
    if (spec.enabled === false) {
      return {
        type: 'block',
        reason: '工具 ' + spec.name + ' 已禁用',
        errorType: 'UNAVAILABLE',
      }
    }

    if (spec.riskLevel === 'critical' && context.approvalHooks?.checkApproval) {
      const needsApproval = await context.approvalHooks.checkApproval(request, spec)
      if (needsApproval) {
        return {
          type: 'require_approval',
          reason: '高风险工具需要额外审批',
        }
      }
    }

    if (context.budget?.maxExecutionTime !== undefined && context.budget.maxExecutionTime <= 0) {
      return {
        type: 'block',
        reason: '执行时间预算已耗尽',
        errorType: 'PERMISSION_DENIED',
      }
    }

    return { type: 'allow' }
  }
}

export class ToolDispatcher {
  constructor(
    private specRegistry: ToolSpecRegistry,
    private executorFactory: ToolExecutorFactory,
    private guardSystem: ToolGuardSystem,
  ) {}

  async dispatch(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolCallResult> {
    const startTime = Date.now()

    try {
      const spec = this.specRegistry.get(request.toolName)
      if (!spec) {
        context.emitEvent({
          type: 'tool_call_failed',
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: {
            executorKind: 'legacy_adapter',
            error: {
              type: 'NOT_FOUND',
              message: '工具 ' + request.toolName + ' 未找到',
              retryable: false,
            },
          },
        })
        return this.createErrorResult(request, {
          type: 'NOT_FOUND',
          message: '工具 ' + request.toolName + ' 未找到',
          retryable: false,
        }, startTime)
      }

      const guardDecision = await this.guardSystem.check(request, spec, context)
      if (guardDecision.type !== 'allow') {
        const errorType = guardDecision.type === 'block' ? guardDecision.errorType : 'PERMISSION_DENIED'
        const message = guardDecision.type === 'block'
          ? guardDecision.reason
          : ('需要审批: ' + guardDecision.reason)
        const retryable = guardDecision.type === 'require_approval'

        context.emitEvent({
          type: 'tool_call_failed',
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: {
            executorKind: 'legacy_adapter',
            error: { type: errorType, message, retryable },
          },
        })

        return this.createErrorResult(request, { type: errorType, message, retryable }, startTime)
      }

      const executors = this.executorFactory.getExecutorsForTool(request.toolName)
      if (executors.length === 0) {
        context.emitEvent({
          type: 'tool_call_failed',
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: {
            executorKind: 'legacy_adapter',
            error: {
              type: 'UNAVAILABLE',
              message: '没有可用的执行器支持工具 ' + request.toolName,
              retryable: false,
            },
          },
        })

        return this.createErrorResult(request, {
          type: 'UNAVAILABLE',
          message: '没有可用的执行器支持工具 ' + request.toolName,
          retryable: false,
        }, startTime)
      }

      let lastError: ToolError | undefined
      let usedBridge = false

      for (const executor of executors) {
        try {
          context.emitEvent({
            type: 'tool_call_started',
            callId: request.callId,
            toolName: request.toolName,
            timestamp: Date.now(),
            data: {
              executorKind: executor.kind,
              arguments: request.arguments,
            },
          })

          const result = await executor.execute(request, context)

          context.emitEvent({
            type: 'tool_call_completed',
            callId: request.callId,
            toolName: request.toolName,
            timestamp: Date.now(),
            data: {
              success: result.ok,
              duration: result.metadata.duration,
              executorKind: executor.kind,
            },
          })

          usedBridge = executor.kind === 'legacy_adapter' || executor.kind === 'bridge'

          return {
            ...result,
            metadata: {
              ...result.metadata,
              executorKind: executor.kind,
              usedBridge,
              toolSpec: spec,
            },
          }
        } catch (error: any) {
          let errorType: ToolErrorType = 'EXECUTION_FAILED'
          let retryable = true
          if (error && typeof error === 'object' && 'type' in error && typeof error.type === 'string') {
            errorType = error.type as ToolErrorType
            retryable = error.retryable !== undefined ? Boolean(error.retryable) : retryable
          }

          lastError = {
            type: errorType,
            message: error?.message || ('执行器 ' + executor.kind + ' 执行失败'),
            retryable,
            raw: error,
          }

          context.emitEvent({
            type: 'tool_call_failed',
            callId: request.callId,
            toolName: request.toolName,
            timestamp: Date.now(),
            data: {
              executorKind: executor.kind,
              error: lastError,
            },
          })
        }
      }

      return this.createErrorResult(
        request,
        lastError || {
          type: 'EXECUTION_FAILED',
          message: '所有执行器都失败',
          retryable: false,
        },
        startTime,
        usedBridge,
      )
    } catch (error: any) {
      return this.createErrorResult(request, {
        type: 'UNKNOWN',
        message: '工具调用分发失败: ' + error.message,
        retryable: false,
        raw: error,
      }, startTime)
    }
  }

  private createErrorResult(
    request: ToolCallRequest,
    error: ToolError,
    startTime: number,
    usedBridge: boolean = false,
  ): ToolCallResult {
    const duration = Date.now() - startTime
    return {
      ok: false,
      outputText: '工具调用失败: ' + error.message,
      events: [],
      error,
      metadata: {
        duration,
        executorKind: usedBridge ? 'legacy_adapter' : 'dsxu_native',
        usedBridge,
        toolSpec: undefined,
      },
    }
  }
}

export function normalizeToLegacyResult(
  protocolResult: ToolCallResult,
  toolUseId: string,
): { toolUseId: string; content: string; isError: boolean } {
  return {
    toolUseId,
    content: protocolResult.outputText,
    isError: !protocolResult.ok,
  }
}

export function normalizeFromLegacyResult(
  legacyResult: { toolUseId: string; content: string; isError: boolean },
  toolName: string,
  startTime: number,
): ToolCallResult {
  const duration = Date.now() - startTime
  return {
    ok: !legacyResult.isError,
    outputText: legacyResult.content,
    events: [],
    metadata: {
      duration,
      executorKind: 'legacy_adapter',
      usedBridge: true,
      toolSpec: {
        name: toolName,
        description: 'legacy normalized tool result',
        inputSchema: {},
        capabilityTags: ['analysis'],
        riskLevel: 'low',
        executorKind: 'legacy_adapter',
      },
    },
  }
}
