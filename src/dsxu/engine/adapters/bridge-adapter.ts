/**
 * Bridge adapter.
 *
 * Connects upstream bridge tools to the DSXU Tool Protocol.
 * Keeps upstream-inspired event semantics, error normalization, gate checks,
 * and tool pool management.
 */
import type {
  ToolSpec,
  ToolCallRequest,
  ToolCallResult,
  ToolEvent,
  ToolExecutionContext,
  ToolExecutor,
  ToolError
} from '../tool-protocol'
/** Bridge tool error types inspired by upstream behavior. */
export enum BridgeToolErrorType {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  TIMEOUT = 'TIMEOUT',
  NOT_FOUND = 'NOT_FOUND',
  UNKNOWN = 'UNKNOWN'
}
/** Bridge tool event types inspired by upstream behavior. */
export enum BridgeToolEventType {
  TOOL_STARTED = 'bridge_tool_started',
  TOOL_COMPLETED = 'bridge_tool_completed',
  TOOL_FAILED = 'bridge_tool_failed',
  GATE_CHECK = 'bridge_gate_check'
}
/** Bridge tool gate configuration inspired by upstream behavior. */
export interface BridgeToolGateConfig {
  /** Whether gate checks are enabled. */
  enabled: boolean
  /** Tools that require special gate checks. */
  gatedTools: string[]
  /** Gate check function. */
  gateCheck?: (toolName: string, input: any, context: ToolExecutionContext) => Promise<{
    allowed: boolean
    reason?: string
    errorType?: BridgeToolErrorType
  }>
}
/** Default gate configuration inspired by upstream behavior. */
const DEFAULT_GATE_CONFIG: BridgeToolGateConfig = {
  enabled: true,
  gatedTools: ['FileEdit', 'Bash', 'FileWrite', 'PowerShell'],
  gateCheck: async (toolName, input, context) => {
    // Default gate allows all operations.
    return { allowed: true }
  }
}
/** Bridge adapter with upstream-inspired behavior. */
export class BridgeAdapter implements ToolExecutor {
  readonly kind = 'bridge' as const
  constructor(
    private bridgeTools: Map<string, any> = new Map(),
    private gateConfig: BridgeToolGateConfig = DEFAULT_GATE_CONFIG
  ) {}
  /** Set gate configuration. */
  setGateConfig(config: BridgeToolGateConfig): void {
    this.gateConfig = config
  }
  /** Get gate configuration. */
  getGateConfig(): BridgeToolGateConfig {
    return this.gateConfig
  }
  /** Whether the named tool is supported. */
  supports(toolName: string): boolean {
    return this.bridgeTools.has(toolName)
  }
  /** Register a bridge-compatible tool implementation. */
  registerTool(toolName: string, toolImpl: any): void {
    this.bridgeTools.set(toolName, toolImpl)
  }
  /** DSXU comment sanitized. */
  async execute(
    request: ToolCallRequest,
    context: ToolExecutionContext
  ): Promise<ToolCallResult> {
    const startTime = Date.now()
    const events: ToolEvent[] = []
    const toolEventId = `bridge_${request.toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    try {
      // 1. Resolve the bridge-compatible tool implementation.
      const bridgeTool = this.bridgeTools.get(request.toolName)
      if (!bridgeTool) {
        return this.createErrorResult(
          request,
          {
            type: BridgeToolErrorType.NOT_FOUND,
            message: `Bridge tool ${request.toolName} was not found`,
            retryable: false
          },
          startTime,
          events
        )
      }
      // DSXU comment sanitized.
      const isGatedTool = this.gateConfig.enabled && this.gateConfig.gatedTools.includes(request.toolName)
      if (isGatedTool && this.gateConfig.gateCheck) {
        const gateResult = await this.gateConfig.gateCheck(request.toolName, request.arguments, context)
        // DSXU comment sanitized.
        events.push({
          type: BridgeToolEventType.GATE_CHECK,
          callId: request.callId,
          toolName: request.toolName,
          timestamp: Date.now(),
          data: {
            allowed: gateResult.allowed,
            reason: gateResult.reason,
            errorType: gateResult.errorType,
            toolEventId
          }
        })
        if (!gateResult.allowed) {
          const errorMsg = `Tool execution blocked by gate: ${request.toolName} - ${gateResult.reason || 'not authorized'}`
          // 记录失败事件
          events.push({
            type: BridgeToolEventType.TOOL_FAILED,
            callId: request.callId,
            toolName: request.toolName,
            timestamp: Date.now(),
            data: {
              error: errorMsg,
              errorType: gateResult.errorType || BridgeToolErrorType.PERMISSION_DENIED,
              duration: Date.now() - startTime,
              toolEventId
            }
          })
          return this.createErrorResult(
            request,
            {
              type: gateResult.errorType || BridgeToolErrorType.PERMISSION_DENIED,
              message: errorMsg,
              retryable: false
            },
            startTime,
            events
          )
        }
      }
      // DSXU comment sanitized.
      const bridgeContext = this.convertContext(context, toolEventId)
      // DSXU comment sanitized.
      events.push({
        type: BridgeToolEventType.TOOL_STARTED,
        callId: request.callId,
        toolName: request.toolName,
        timestamp: startTime,
        data: {
          executorKind: this.kind,
          arguments: request.arguments,
          toolEventId
        }
      })
      // 5. 执行桥接工具
      let bridgeResult: any
      try {
        bridgeResult = await bridgeTool.execute(request.arguments, bridgeContext)
      } catch (error: any) {
        // 桥接工具执行异常
        const endTime = Date.now()
        const duration = endTime - startTime
        // 记录失败事件
        events.push({
          type: BridgeToolEventType.TOOL_FAILED,
          callId: request.callId,
          toolName: request.toolName,
          timestamp: endTime,
          data: {
            error: error.message,
            errorType: BridgeToolErrorType.EXECUTION_FAILED,
            duration,
            stack: error.stack,
            toolEventId
          }
        })
        return this.createErrorResult(
          request,
          {
            type: BridgeToolErrorType.EXECUTION_FAILED,
            message: `Bridge tool execution failed: ${error.message}`,
            retryable: this.isRetryableError(error),
            raw: error
          },
          startTime,
          events
        )
      }
      // DSXU comment sanitized.
      const normalizedResult = this.normalizeBridgeResult(bridgeResult, request.toolName)
      const endTime = Date.now()
      const duration = endTime - startTime
      // DSXU comment sanitized.
      events.push({
        type: BridgeToolEventType.TOOL_COMPLETED,
        callId: request.callId,
        toolName: request.toolName,
        timestamp: endTime,
        data: {
          success: !normalizedResult.isError,
          duration,
          executorKind: this.kind,
          outputLength: normalizedResult.content?.length || 0,
          toolEventId
        }
      })
      // DSXU comment sanitized.
      return {
        ok: !normalizedResult.isError,
        outputText: normalizedResult.content,
        structuredData: {
          ...(normalizedResult.meta || {}),
          toolName: request.toolName,
          toolEventId,
          duration,
          bridgeTool: true
        },
        events,
        error: normalizedResult.isError ? {
          type: BridgeToolErrorType.EXECUTION_FAILED,
          message: normalizedResult.content,
          retryable: false,
          raw: normalizedResult.meta?.error
        } : undefined,
        metadata: {
          duration,
          executorKind: this.kind,
          usedBridge: true,
          toolEventId
        }
      }
    } catch (error: any) {
      const endTime = Date.now()
      const duration = endTime - startTime
      // DSXU comment sanitized.
      events.push({
        type: BridgeToolEventType.TOOL_FAILED,
        callId: request.callId,
        toolName: request.toolName,
        timestamp: endTime,
        data: {
          error: error.message,
          errorType: BridgeToolErrorType.UNKNOWN,
          duration,
          stack: error.stack,
          toolEventId
        }
      })
      return this.createErrorResult(
        request,
        {
          type: BridgeToolErrorType.UNKNOWN,
          message: `Bridge adapter internal error: ${error.message}`,
          retryable: false,
          raw: error
        },
        startTime,
        events
      )
    }
  }
  /** DSXU comment sanitized. */
  private convertContext(context: ToolExecutionContext, toolEventId: string): any {
    return {
      cwd: context.cwd,
      sessionId: context.sessionId,
      gear: context.gear,
      fileHistory: undefined, // DSXU comment sanitized.
      abortSignal: context.abortSignal,
      toolUseId: toolEventId,
      // DSXU comment sanitized.
      emitEvent: (event: any) => {
        // 将桥接工具事件转换为协议事件
        const protocolEvent = this.convertBridgeEvent(event, context, toolEventId)
        if (protocolEvent) {
          context.emitEvent(protocolEvent)
        }
      },
      // DSXU comment sanitized.
      getAppState: () => ({
        toolPermissionContext: {
          // DSXU comment sanitized.
          allWorkingDirectories: [context.cwd]
        }
      })
    }
  }
  /** DSXU comment sanitized. */
  private convertBridgeEvent(bridgeEvent: any, context: ToolExecutionContext, toolEventId: string): ToolEvent | null {
    if (!bridgeEvent || !bridgeEvent.type) {
      return null
    }
    // DSXU comment sanitized.
    const eventTypeMap: Record<string, string> = {
      'bridge_tool_started': BridgeToolEventType.TOOL_STARTED,
      'bridge_tool_completed': BridgeToolEventType.TOOL_COMPLETED,
      'bridge_tool_failed': BridgeToolEventType.TOOL_FAILED,
      'bridge_gate_check': BridgeToolEventType.GATE_CHECK,
      'tool_call_started': 'tool_call_started',
      'tool_call_completed': 'tool_call_completed',
      'tool_call_failed': 'tool_call_failed',
      'tool_execution_progress': 'tool_execution_progress'
    }
    const protocolType = eventTypeMap[bridgeEvent.type] || bridgeEvent.type
    return {
      type: protocolType as any,
      callId: bridgeEvent.callId || context.currentCallId || toolEventId,
      toolName: bridgeEvent.toolName || 'unknown',
      timestamp: bridgeEvent.timestamp || Date.now(),
      data: {
        ...(bridgeEvent.data || {}),
        toolEventId: bridgeEvent.toolEventId || toolEventId,
        executorKind: this.kind
      }
    }
  }
  /** DSXU comment sanitized. */
  private normalizeBridgeResult(bridgeResult: any, toolName: string): {
    content: string
    isError: boolean
    meta?: Record<string, any>
  } {
    // Bridge tools may return different formats; normalize them here.
    if (!bridgeResult) {
      return {
        content: `Bridge tool ${toolName} returned an empty result`,
        isError: true
      }
    }
    // Check common bridge result formats.
    if (typeof bridgeResult === 'string') {
      return {
        content: bridgeResult,
        isError: false
      }
    }
    if (typeof bridgeResult === 'object') {
      // DSXU comment sanitized.
      if (bridgeResult.content !== undefined) {
        return {
          content: String(bridgeResult.content),
          isError: Boolean(bridgeResult.isError),
          meta: bridgeResult.meta
        }
      }
      // DSXU comment sanitized.
      if (bridgeResult.output !== undefined) {
        return {
          content: String(bridgeResult.output),
          isError: Boolean(bridgeResult.error),
          meta: { error: bridgeResult.error }
        }
      }
      // Format 3: stringify other objects.
      try {
        return {
          content: JSON.stringify(bridgeResult, null, 2),
          isError: false,
          meta: bridgeResult
        }
      } catch {
        return {
          content: String(bridgeResult),
          isError: false,
          meta: { raw: bridgeResult }
        }
      }
    }
    // Default handling.
    return {
      content: `Unsupported bridge result format: ${typeof bridgeResult}`,
      isError: true,
      meta: { raw: bridgeResult }
    }
  }
  /** Decide whether an error is retryable. */
  private isRetryableError(error: any): boolean {
    // Retry policy for bridge tool errors.
    const retryableCodes = ['ETIMEDOUT', 'ECONNRESET', 'EAGAIN']
    const retryableMessages = ['timeout', 'network', 'retry']
    if (error.code && retryableCodes.includes(error.code)) {
      return true
    }
    if (error.message && retryableMessages.some(msg =>
      error.message.toLowerCase().includes(msg)
    )) {
      return true
    }
    return false
  }
  /** Create error result. */
  private createErrorResult(
    request: ToolCallRequest,
    error: ToolError,
    startTime: number,
    events: ToolEvent[]
  ): ToolCallResult {
    const duration = Date.now() - startTime
    return {
      ok: false,
      outputText: `Bridge tool failed: ${error.message}`,
      events,
      error,
      metadata: {
        duration,
        executorKind: this.kind,
        usedBridge: true
      }
    }
  }
  /** DSXU comment sanitized. */
  static createVerificationGateCheck(
    verificationCallback?: (toolName: string, input: any) => Promise<boolean>
  ): (toolName: string, input: any, context: ToolExecutionContext) => Promise<{
    allowed: boolean
    reason?: string
    errorType?: BridgeToolErrorType
  }> {
    return async (toolName: string, input: any, context: ToolExecutionContext) => {
      // DSXU comment sanitized.
      if (toolName === 'Bash') {
        const command = input.command || ''
        // DSXU comment sanitized.
        const dangerousPatterns = [
          'rm -rf /', 'rm -rf /*', 'rm -rf .', 'rm -rf *',
          'dd if=', 'mkfs', 'fdisk', 'chmod 777',
          '> /dev/sda', 'cat /dev/urandom',
          'wget http', 'curl http', // Potential malicious script download
          'sudo', 'su -', 'passwd'
        ]
        for (const pattern of dangerousPatterns) {
          if (command.includes(pattern)) {
            return {
              allowed: false,
              reason: `Detected dangerous command pattern: ${pattern}`,
              errorType: BridgeToolErrorType.PERMISSION_DENIED
            }
          }
        }
      }
      if (toolName === 'FileEdit' || toolName === 'FileWrite') {
        const filePath = input.file_path || ''
        // DSXU comment sanitized.
        const sensitiveFiles = [
          '.env', '.git/config', 'package-lock.json', 'yarn.lock',
          'node_modules/', '.next/', '.nuxt/', '.cache/',
          '/etc/', '/bin/', '/usr/bin/', '/var/log/'
        ]
        for (const sensitiveFile of sensitiveFiles) {
          if (filePath.includes(sensitiveFile)) {
            return {
              allowed: false,
              reason: `Refusing to modify sensitive file or directory: ${sensitiveFile}`,
              errorType: BridgeToolErrorType.PERMISSION_DENIED
            }
          }
        }
      }
      // DSXU comment sanitized.
      if (verificationCallback) {
        try {
          const verified = await verificationCallback(toolName, input)
          if (!verified) {
            return {
              allowed: false,
              reason: 'Verification callback rejected this tool call',
              errorType: BridgeToolErrorType.VALIDATION_FAILED
            }
          }
        } catch (error: any) {
          return {
            allowed: false,
            reason: `Verification callback failed: ${error.message}`,
            errorType: BridgeToolErrorType.VALIDATION_FAILED
          }
        }
      }
      // 3. 默认允许
      return { allowed: true }
    }
  }
  /** DSXU comment sanitized. */
  static createDefaultGateConfig(
    verificationCallback?: (toolName: string, input: any) => Promise<boolean>
  ): BridgeToolGateConfig {
    return {
      enabled: true,
      gatedTools: ['FileEdit', 'Bash', 'FileWrite', 'PowerShell', 'REPL'],
      gateCheck: BridgeAdapter.createVerificationGateCheck(verificationCallback)
    }
  }
}
/** DSXU comment sanitized. */
export function createSpecFromBridgeTool(
  toolName: string,
  bridgeTool: any
): ToolSpec {
  return {
    name: toolName,
    description: bridgeTool.description || `Bridge compatibility tool: ${toolName}`,
    inputSchema: bridgeTool.inputSchema || {
      type: 'object',
      properties: {},
      additionalProperties: true
    },
    capabilityTags: ['bridge', ...(bridgeTool.capabilityTags || [])],
    riskLevel: bridgeTool.riskLevel || (bridgeTool.readOnly ? 'low' : 'medium'),
    executorKind: 'bridge',
    concurrencySafe: bridgeTool.concurrencySafe !== false,
    readOnly: Boolean(bridgeTool.readOnly),
    enabled: true,
    bridgeToolNames: [toolName],
    // DSXU comment sanitized.
    constraints: bridgeTool.constraints || {},
    metadata: {
      source: 'legacy_bridge',
      originalTool: bridgeTool.name || toolName
    }
  }
}
/** DSXU comment sanitized. */
export function dedupeBridgeTools(tools: ToolSpec[]): ToolSpec[] {
  const seen = new Set<string>()
  const result: ToolSpec[] = []
  // DSXU comment sanitized.
  const nameMapping: Record<string, string> = {
    'askuserquestion': 'askuser',
    'fileedit': 'edit',
    'fileread': 'read',
    'filewrite': 'write',
    'exitplanmodev2': 'exitplanmode'
  }
  // DSXU comment sanitized.
  const preferredTools = new Set(['bash', 'read', 'write', 'edit', 'grep', 'glob', 'askuser'])
  for (const tool of tools) {
    let key = tool.name.toLowerCase().trim()
    if (!key) continue
    // Apply application name mapping.
    if (nameMapping[key]) {
      key = nameMapping[key]
    }
    if (seen.has(key)) {
      // DSXU comment sanitized.
      const existingIndex = result.findIndex(t =>
        t.name.toLowerCase().trim() === key ||
        (nameMapping[t.name.toLowerCase().trim()] === key)
      )
      if (existingIndex !== -1) {
        const existingTool = result[existingIndex]
        // 如果新工具是优先工具，替换旧工具
        if (preferredTools.has(key) && !preferredTools.has(existingTool.name.toLowerCase())) {
          result[existingIndex] = tool
        }
        // DSXU comment sanitized.
      }
      continue
    }
    seen.add(key)
    result.push(tool)
  }
  return result
}
// V14 FROZEN: bridge adapter has been replaced by
// src/dsxu/engine/adapters/external-tool-adapter.ts and copied to
// src/dsxu/_deleted_files/legacy-freeze/bridge-adapter.ts.
// It must not be imported by DSXU mainline code.
