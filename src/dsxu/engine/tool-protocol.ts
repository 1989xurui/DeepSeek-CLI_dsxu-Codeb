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

export type ToolCallResultSchemaVersion = 'dsxu.tool-call-result.v1'
export type DsxuRuntimeEventSchemaVersion = 'dsxu.runtime-event.v1'

export interface ToolCallResult {
  schemaVersion?: ToolCallResultSchemaVersion
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

export type ToolResultBoundaryKind = 'native' | 'provider_message' | 'mcp' | 'legacy'

export interface ToolResultNormalizationEvidence {
  schemaVersion: 'dsxu.tool-result-normalization.v1'
  owner: 'Tool Gate'
  boundaryKind: ToolResultBoundaryKind
  canonical: boolean
  ok: boolean
  outputChars: number
  executorKind: ToolExecutorKind
  usedBridge: boolean
  errorType?: ToolErrorType
  retryable?: boolean
}

export interface ToolResultContractEvidence {
  schemaVersion: 'dsxu.tool-result-contract.v1'
  owner: 'Tool Gate'
  canonicalResultSchema: ToolCallResultSchemaVersion
  runtimeEventSchema: DsxuRuntimeEventSchemaVersion
  boundaryKind: ToolResultBoundaryKind
  adapterBoundaryOnly: boolean
  canonical: boolean
  ok: boolean
  outputChars: number
  executorKind: ToolExecutorKind
  usedBridge: boolean
  errorType?: ToolErrorType
  retryable?: boolean
  rule: string
}

export type ToolResultContractConsumerName =
  | 'work-state'
  | 'ledger'
  | 'recovery'
  | 'tui'
  | 'final-report'
  | 'release-evidence'

export interface ToolResultContractConsumerEvidence {
  consumer: ToolResultContractConsumerName
  owner: string
  canonicalResultSchema?: ToolCallResultSchemaVersion
  runtimeEventSchema?: DsxuRuntimeEventSchemaVersion
  usesCanonicalResult: boolean
  legacyShapeObserved?: boolean
  evidenceIds: string[]
}

export interface ToolResultContractConsumptionBoard {
  schemaVersion: 'dsxu.tool-result-contract-consumption.v1'
  owner: 'Tool Gate'
  status: 'PASS_TOOL_RESULT_CONTRACT_CONSUMPTION' | 'NEEDS_TOOL_RESULT_CONTRACT_CONSUMPTION_REVIEW'
  contract: ToolResultContractEvidence
  requiredConsumers: readonly ToolResultContractConsumerName[]
  readyConsumers: readonly ToolResultContractConsumerName[]
  missingConsumers: readonly ToolResultContractConsumerName[]
  guards: readonly string[]
  compactPanelLines: readonly string[]
  finalReportSection: {
    title: 'Tool Result Contract'
    status: 'ready' | 'needs-evidence'
    summary: readonly string[]
    evidence: readonly string[]
  }
}

export type ToolGateBoundaryToolResultInput =
  | {
      boundaryKind: 'native'
      result: ToolCallResult
    }
  | {
      boundaryKind: 'provider_message'
      result: {
        tool_use_id?: string
        content?: unknown
        is_error?: boolean
      }
      toolName: string
      startTime?: number
    }
  | {
      boundaryKind: 'mcp'
      result: {
        content?: unknown
        isError?: boolean
        structuredContent?: unknown
        _meta?: unknown
      }
      toolName: string
      startTime?: number
    }
  | {
      boundaryKind: 'legacy'
      result: { toolUseId: string; content: string; isError: boolean }
      toolName: string
      startTime: number
    }

export interface ToolGateBoundaryToolResult {
  schemaVersion: 'dsxu.tool-gate-boundary-result.v1'
  owner: 'Tool Gate'
  boundaryKind: ToolResultBoundaryKind
  result: ToolCallResult & { schemaVersion: ToolCallResultSchemaVersion }
  normalizationEvidence: ToolResultNormalizationEvidence
  contractEvidence: ToolResultContractEvidence
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
            schemaVersion: 'dsxu.tool-call-result.v1',
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
      schemaVersion: 'dsxu.tool-call-result.v1',
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

export function isToolCallResult(value: unknown): value is ToolCallResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<ToolCallResult>
  return (
    typeof result.ok === 'boolean' &&
    typeof result.outputText === 'string' &&
    Array.isArray(result.events) &&
    !!result.metadata &&
    typeof result.metadata === 'object' &&
    typeof result.metadata.duration === 'number' &&
    typeof result.metadata.executorKind === 'string' &&
    typeof result.metadata.usedBridge === 'boolean'
  )
}

export function buildToolResultNormalizationEvidence(
  result: ToolCallResult,
  boundaryKind: ToolResultBoundaryKind = 'native',
): ToolResultNormalizationEvidence {
  return {
    schemaVersion: 'dsxu.tool-result-normalization.v1',
    owner: 'Tool Gate',
    boundaryKind,
    canonical: true,
    ok: result.ok,
    outputChars: result.outputText.length,
    executorKind: result.metadata.executorKind,
    usedBridge: result.metadata.usedBridge,
    errorType: result.error?.type,
    retryable: result.error?.retryable,
  }
}

export function ensureCanonicalToolCallResult(result: ToolCallResult): ToolCallResult & {
  schemaVersion: ToolCallResultSchemaVersion
} {
  return {
    ...result,
    schemaVersion: 'dsxu.tool-call-result.v1',
  }
}

export function buildToolResultContractEvidence(
  result: ToolCallResult,
  boundaryKind: ToolResultBoundaryKind = 'native',
): ToolResultContractEvidence {
  const canonical = ensureCanonicalToolCallResult(result)
  return {
    schemaVersion: 'dsxu.tool-result-contract.v1',
    owner: 'Tool Gate',
    canonicalResultSchema: canonical.schemaVersion,
    runtimeEventSchema: 'dsxu.runtime-event.v1',
    boundaryKind,
    adapterBoundaryOnly: boundaryKind !== 'native',
    canonical: isToolCallResult(canonical),
    ok: canonical.ok,
    outputChars: canonical.outputText.length,
    executorKind: canonical.metadata.executorKind,
    usedBridge: canonical.metadata.usedBridge,
    errorType: canonical.error?.type,
    retryable: canonical.error?.retryable,
    rule:
      'All provider, MCP, legacy, and bridge tool outputs must normalize to ToolCallResult at the DSXU Tool Gate before entering work-state, ledger, recovery, or release evidence.',
  }
}

export function buildToolResultContractConsumptionBoard(input: {
  result: ToolCallResult
  boundaryKind?: ToolResultBoundaryKind
  consumers: readonly ToolResultContractConsumerEvidence[]
  requiredConsumers?: readonly ToolResultContractConsumerName[]
}): ToolResultContractConsumptionBoard {
  const requiredConsumers = input.requiredConsumers ?? [
    'work-state',
    'ledger',
    'recovery',
    'tui',
    'final-report',
    'release-evidence',
  ]
  const contract = buildToolResultContractEvidence(input.result, input.boundaryKind ?? 'native')
  const consumerByName = new Map(input.consumers.map(consumer => [consumer.consumer, consumer]))
  const readyConsumers = requiredConsumers.filter(name => {
    const consumer = consumerByName.get(name)
    return Boolean(
      consumer &&
      consumer.usesCanonicalResult &&
      consumer.legacyShapeObserved !== true &&
      consumer.canonicalResultSchema === contract.canonicalResultSchema &&
      consumer.runtimeEventSchema === contract.runtimeEventSchema &&
      consumer.evidenceIds.length > 0,
    )
  })
  const missingConsumers = requiredConsumers.filter(name => !readyConsumers.includes(name))
  const guards = [
    ...requiredConsumers.flatMap(name => {
      const consumer = consumerByName.get(name)
      if (!consumer) return [`missing consumer:${name}`]
      return [
        consumer.usesCanonicalResult ? '' : `${name} does not consume canonical ToolCallResult`,
        consumer.legacyShapeObserved ? `${name} still observes legacy tool result shape` : '',
        consumer.canonicalResultSchema !== contract.canonicalResultSchema
          ? `${name} canonical schema mismatch`
          : '',
        consumer.runtimeEventSchema !== contract.runtimeEventSchema
          ? `${name} runtime event schema mismatch`
          : '',
        consumer.evidenceIds.length === 0 ? `${name} missing evidence ids` : '',
      ].filter(Boolean)
    }),
  ]
  const status = guards.length === 0
    ? 'PASS_TOOL_RESULT_CONTRACT_CONSUMPTION'
    : 'NEEDS_TOOL_RESULT_CONTRACT_CONSUMPTION_REVIEW'
  const evidence = [
    `contract:${contract.canonicalResultSchema}`,
    `runtime:${contract.runtimeEventSchema}`,
    `boundary:${contract.boundaryKind}`,
    ...input.consumers.flatMap(consumer => consumer.evidenceIds),
  ].filter(Boolean)
  return {
    schemaVersion: 'dsxu.tool-result-contract-consumption.v1',
    owner: 'Tool Gate',
    status,
    contract,
    requiredConsumers,
    readyConsumers,
    missingConsumers,
    guards,
    compactPanelLines: [
      `ToolResultContract: ${status}`,
      `Canonical: ${contract.canonicalResultSchema} | runtime=${contract.runtimeEventSchema}`,
      `Consumers: ready=${readyConsumers.length}/${requiredConsumers.length} missing=${missingConsumers.join(',') || 'none'}`,
      `Output: ok=${String(contract.ok)} chars=${contract.outputChars} boundary=${contract.boundaryKind}`,
    ],
    finalReportSection: {
      title: 'Tool Result Contract',
      status: status === 'PASS_TOOL_RESULT_CONTRACT_CONSUMPTION'
        ? 'ready'
        : 'needs-evidence',
      summary: [
        `status=${status}`,
        `readyConsumers=${readyConsumers.length}/${requiredConsumers.length}`,
        `missingConsumers=${missingConsumers.join(',') || 'none'}`,
        `legacyShapeObserved=${String(input.consumers.some(consumer => consumer.legacyShapeObserved))}`,
      ],
      evidence: [...new Set(evidence)].slice(0, 30),
    },
  }
}

export function normalizeProviderToolResultBlock(
  block: {
    tool_use_id?: string
    content?: unknown
    is_error?: boolean
  },
  toolName: string,
  startTime = Date.now(),
): ToolCallResult {
  const duration = Math.max(0, Date.now() - startTime)
  const outputText = typeof block.content === 'string'
    ? block.content
    : JSON.stringify(block.content ?? '')
  const isError = block.is_error === true || /<tool_use_error>/i.test(outputText)
  return {
    schemaVersion: 'dsxu.tool-call-result.v1',
    ok: !isError,
    outputText,
    events: [],
    error: isError
      ? {
          type: 'EXECUTION_FAILED',
          message: outputText,
          retryable: false,
        }
      : undefined,
    structuredData: {
      boundaryKind: 'provider_message',
      toolUseId: block.tool_use_id,
    },
    metadata: {
      duration,
      executorKind: 'legacy_adapter',
      usedBridge: true,
      toolSpec: {
        name: toolName,
        description: 'provider tool_result normalized at DSXU Tool Gate boundary',
        inputSchema: {},
        capabilityTags: ['analysis'],
        riskLevel: 'low',
        executorKind: 'legacy_adapter',
      },
    },
  }
}

export function normalizeMcpToolCallResult(
  result: { content?: unknown; isError?: boolean; structuredContent?: unknown; _meta?: unknown },
  toolName: string,
  startTime = Date.now(),
): ToolCallResult {
  const duration = Math.max(0, Date.now() - startTime)
  const outputText = typeof result.content === 'string'
    ? result.content
    : JSON.stringify(result.content ?? result.structuredContent ?? '')
  const isError = result.isError === true
  return {
    schemaVersion: 'dsxu.tool-call-result.v1',
    ok: !isError,
    outputText,
    structuredData: {
      boundaryKind: 'mcp',
      structuredContent: result.structuredContent,
      meta: result._meta,
    },
    events: [],
    error: isError
      ? {
          type: 'EXECUTION_FAILED',
          message: outputText,
          retryable: false,
        }
      : undefined,
    metadata: {
      duration,
      executorKind: 'external',
      usedBridge: true,
      toolSpec: {
        name: toolName,
        description: 'MCP tool result normalized at DSXU Tool Gate boundary',
        inputSchema: {},
        capabilityTags: ['analysis'],
        riskLevel: 'medium',
        executorKind: 'external',
      },
    },
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
    schemaVersion: 'dsxu.tool-call-result.v1',
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

export function normalizeToolResultAtToolGateBoundary(
  input: ToolGateBoundaryToolResultInput,
): ToolGateBoundaryToolResult {
  const canonicalResult = ensureCanonicalToolCallResult(
    input.boundaryKind === 'native'
      ? input.result
      : input.boundaryKind === 'provider_message'
        ? normalizeProviderToolResultBlock(input.result, input.toolName, input.startTime)
        : input.boundaryKind === 'mcp'
          ? normalizeMcpToolCallResult(input.result, input.toolName, input.startTime)
          : normalizeFromLegacyResult(input.result, input.toolName, input.startTime),
  )
  return {
    schemaVersion: 'dsxu.tool-gate-boundary-result.v1',
    owner: 'Tool Gate',
    boundaryKind: input.boundaryKind,
    result: canonicalResult,
    normalizationEvidence: buildToolResultNormalizationEvidence(
      canonicalResult,
      input.boundaryKind,
    ),
    contractEvidence: buildToolResultContractEvidence(canonicalResult, input.boundaryKind),
  }
}
