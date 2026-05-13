import type {
  ToolCallRequest,
  ToolCallResult,
  ToolEvent,
  ToolExecutionContext,
  ToolExecutor,
  ToolSpec,
  ToolError,
} from '../tool-protocol'

export enum ExternalToolErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

export interface ExternalToolGateConfig {
  enabled: boolean
  gatedTools: string[]
  gateCheck?: (toolName: string, input: any, context: ToolExecutionContext) => Promise<{
    allowed: boolean
    reason?: string
    errorType?: ExternalToolErrorType
  }>
}

const DEFAULT_GATE_CONFIG: ExternalToolGateConfig = {
  enabled: true,
  gatedTools: ['FileEdit', 'Bash', 'FileWrite', 'PowerShell'],
  gateCheck: async () => ({ allowed: true }),
}

export class ExternalToolAdapter implements ToolExecutor {
  readonly kind = 'external' as const

  constructor(
    private externalTools: Map<string, any> = new Map(),
    private gateConfig: ExternalToolGateConfig = DEFAULT_GATE_CONFIG,
  ) {}

  setGateConfig(config: ExternalToolGateConfig): void {
    this.gateConfig = config
  }

  supports(toolName: string): boolean {
    return this.externalTools.has(toolName)
  }

  registerTool(toolName: string, toolImpl: any): void {
    this.externalTools.set(toolName, toolImpl)
  }

  async execute(request: ToolCallRequest, context: ToolExecutionContext): Promise<ToolCallResult> {
    const startTime = Date.now()
    const events: ToolEvent[] = []
    const tool = this.externalTools.get(request.toolName)
    if (!tool) {
      return this.errorResult(request, {
        type: 'NOT_FOUND',
        message: `外接工具 ${request.toolName} 未注册到 DSXU 能力契约`,
        retryable: false,
      }, startTime, events)
    }

    const shouldGate = this.gateConfig.enabled && this.gateConfig.gatedTools.includes(request.toolName)
    if (shouldGate && this.gateConfig.gateCheck) {
      const gate = await this.gateConfig.gateCheck(request.toolName, request.arguments, context)
      events.push({
        type: 'tool_guard_check',
        callId: request.callId,
        toolName: request.toolName,
        timestamp: Date.now(),
        data: { allowed: gate.allowed, reason: gate.reason, executorKind: this.kind },
      })
      if (!gate.allowed) {
        return this.errorResult(request, {
          type: 'PERMISSION_DENIED',
          message: gate.reason || `外接工具 ${request.toolName} 被 DSXU gate 阻止`,
          retryable: false,
        }, startTime, events)
      }
    }

    events.push({
      type: 'tool_call_started',
      callId: request.callId,
      toolName: request.toolName,
      timestamp: startTime,
      data: { executorKind: this.kind },
    })

    try {
      const result = await this.invokeExternalTool(tool, request, context)
      events.push({
        type: 'tool_call_completed',
        callId: request.callId,
        toolName: request.toolName,
        timestamp: Date.now(),
        data: { executorKind: this.kind, duration: Date.now() - startTime },
      })
      return {
        ok: !result.isError,
        outputText: result.content,
        structuredData: result.structuredData ?? result.meta,
        events,
        metadata: {
          duration: Date.now() - startTime,
          executorKind: this.kind,
          usedBridge: false,
        },
      }
    } catch (error: any) {
      return this.errorResult(request, {
        type: 'EXECUTION_FAILED',
        message: error?.message || '外接工具执行失败',
        retryable: true,
        raw: error,
      }, startTime, events)
    }
  }

  private async invokeExternalTool(tool: any, request: ToolCallRequest, context: ToolExecutionContext) {
    if (typeof tool.execute === 'function') {
      return await tool.execute(request.arguments, context)
    }
    if (typeof tool === 'function') {
      return await tool(request.arguments, context)
    }
    throw new Error(`外接工具 ${request.toolName} 缺少 execute 函数`)
  }

  private errorResult(
    request: ToolCallRequest,
    error: ToolError,
    startTime: number,
    events: ToolEvent[],
  ): ToolCallResult {
    events.push({
      type: 'tool_call_failed',
      callId: request.callId,
      toolName: request.toolName,
      timestamp: Date.now(),
      data: { error, executorKind: this.kind },
    })
    return {
      ok: false,
      outputText: error.message,
      error,
      events,
      metadata: {
        duration: Date.now() - startTime,
        executorKind: this.kind,
        usedBridge: false,
      },
    }
  }
}

export function createSpecFromExternalTool(toolName: string, toolImpl: any): ToolSpec {
  return {
    name: toolName,
    description: toolImpl.description || `DSXU controlled external tool: ${toolName}`,
    inputSchema: toolImpl.inputSchema || { type: 'object', properties: {}, additionalProperties: true },
    capabilityTags: inferTags(toolName, toolImpl),
    riskLevel: inferRisk(toolName, toolImpl),
    executorKind: 'external',
    concurrencySafe: toolImpl.concurrencySafe ?? true,
    readOnly: toolImpl.readOnly ?? false,
    enabled: true,
  }
}

function inferTags(toolName: string, toolImpl: any): ToolSpec['capabilityTags'] {
  if (toolImpl.capabilityTags) return toolImpl.capabilityTags
  const name = toolName.toLowerCase()
  const tags: ToolSpec['capabilityTags'] = []
  if (name.includes('read') || name.includes('grep') || name.includes('glob')) tags.push('read_only')
  if (name.includes('edit') || name.includes('write')) tags.push('file_operation', 'write_operation')
  if (name.includes('bash') || name.includes('shell')) tags.push('shell_execution')
  return tags.length > 0 ? tags : ['analysis']
}

function inferRisk(toolName: string, toolImpl: any): ToolSpec['riskLevel'] {
  if (toolImpl.riskLevel) return toolImpl.riskLevel
  const name = toolName.toLowerCase()
  if (name.includes('bash') || name.includes('shell') || name.includes('write')) return 'high'
  if (name.includes('edit')) return 'medium'
  return 'low'
}
