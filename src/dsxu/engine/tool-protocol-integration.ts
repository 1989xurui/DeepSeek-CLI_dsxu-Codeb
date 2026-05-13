/**
 * DSXU Tool Protocol Integration
 *
 * 将 DSXU Tool Protocol 接入现有引擎，默认坚持 native / external 优先。
 */

import {
  ToolSpec,
  ToolCallRequest,
  ToolCallResult,
  ToolExecutionContext,
  ToolSpecRegistry,
  ToolExecutorFactory,
  ToolGuardSystem,
  ToolDispatcher,
} from './tool-protocol'

import { FileEditAdapter, createFileEditSpec } from './adapters/file-edit-adapter'
import { BashAdapter, createBashSpec } from './adapters/bash-adapter'
import { ExternalToolAdapter, createSpecFromExternalTool } from './adapters/external-tool-adapter'

export class ToolProtocolIntegration {
  private specRegistry: ToolSpecRegistry
  private executorFactory: ToolExecutorFactory
  private guardSystem: ToolGuardSystem
  private dispatcher: ToolDispatcher
  private externalAdapter: ExternalToolAdapter

  constructor() {
    this.specRegistry = new ToolSpecRegistry()
    this.executorFactory = new ToolExecutorFactory()
    this.guardSystem = new ToolGuardSystem()
    this.externalAdapter = new ExternalToolAdapter()

    this.initializeExecutors()
    this.initializeToolSpecs()

    this.dispatcher = new ToolDispatcher(
      this.specRegistry,
      this.executorFactory,
      this.guardSystem,
    )
  }

  private initializeExecutors(): void {
    this.executorFactory.register(new FileEditAdapter())
    this.executorFactory.register(new BashAdapter())
    this.executorFactory.register(this.externalAdapter)
  }

  private initializeToolSpecs(): void {
    this.specRegistry.register(createFileEditSpec())
    this.specRegistry.register(createBashSpec())
  }

  registerExternalTool(toolName: string, externalTool: any): void {
    this.externalAdapter.registerTool(toolName, externalTool)
    this.specRegistry.register(createSpecFromExternalTool(toolName, externalTool))
  }

  /** @deprecated V14 provider cleanup: use registerExternalTool. */
  registerBridgeTool(toolName: string, bridgeTool: any): void {
    this.registerExternalTool(toolName, bridgeTool)
  }

  getToolSpec(toolName: string): ToolSpec | undefined {
    return this.specRegistry.get(toolName)
  }

  getAllToolSpecs(): ToolSpec[] {
    return this.specRegistry.getAll()
  }

  async dispatchToolCall(
    request: ToolCallRequest,
    context: ToolExecutionContext,
  ): Promise<ToolCallResult> {
    return this.dispatcher.dispatch(request, context)
  }

  toLegacyToolDefinitions(): Array<{
    name: string
    description: string
    inputSchema: Record<string, any>
    execute: (input: Record<string, any>, context: any) => Promise<any>
  }> {
    const specs = this.getAllToolSpecs()
    return specs
      .filter(spec => spec.executorKind === 'dsxu_native')
      .map(spec => this.createLegacyToolWrapper(spec))
  }

  private createLegacyToolWrapper(spec: ToolSpec): any {
    return {
      name: spec.name,
      description: spec.description,
      inputSchema: spec.inputSchema,
      execute: async (input: Record<string, any>, legacyContext: any) => {
        const protocolContext: ToolExecutionContext = {
          cwd: legacyContext.cwd,
          sessionId: legacyContext.sessionId,
          gear: legacyContext.gear,
          emitEvent: event => legacyContext.emitEvent?.(event),
          abortSignal: legacyContext.abortSignal,
        }

        const request: ToolCallRequest = {
          callId: legacyContext.toolUseId || legacy_,
          toolName: spec.name,
          arguments: input,
          source: 'llm',
        }

        try {
          const result = await this.dispatcher.dispatch(request, protocolContext)
          return {
            content: result.outputText,
            isError: !result.ok,
            meta: {
              ...result.structuredData,
              protocolResult: result,
            },
          }
        } catch (error: any) {
          return {
            content: '工具调用失败: ' + error.message,
            isError: true,
            meta: { error },
          }
        }
      },
    }
  }

  isToolNative(toolName: string): boolean {
    return this.getToolSpec(toolName)?.executorKind === 'dsxu_native'
  }

  isToolBridge(toolName: string): boolean {
    return this.getToolSpec(toolName)?.executorKind === 'external'
  }

  getToolSupport(toolName: string): {
    native: boolean
    bridge: boolean
    spec?: ToolSpec
  } {
    const spec = this.getToolSpec(toolName)
    return {
      native: spec?.executorKind === 'dsxu_native',
      bridge: spec?.executorKind === 'external',
      spec,
    }
  }
}

let globalIntegration: ToolProtocolIntegration | null = null

export function getToolProtocolIntegration(): ToolProtocolIntegration {
  if (!globalIntegration) {
    globalIntegration = new ToolProtocolIntegration()
  }
  return globalIntegration
}

export function initializeToolProtocol(externalTools?: Map<string, any>): ToolProtocolIntegration {
  const integration = new ToolProtocolIntegration()
  if (externalTools) {
    for (const [toolName, toolImpl] of externalTools) {
      integration.registerExternalTool(toolName, toolImpl)
    }
  }
  globalIntegration = integration
  return integration
}

export interface DSXUToolProtocolMainlineBundleInput {
  toolName: string
  externalTool: any
  request: {
    callId: string
    arguments: Record<string, any>
    source: 'llm' | 'skill' | 'manual' | 'system'
    taskId?: string
  }
  context: ToolExecutionContext
}

export async function createDSXUToolProtocolMainlineBundle(
  input: DSXUToolProtocolMainlineBundleInput,
): Promise<{
  spec: ToolSpec | undefined
  result: ToolCallResult
  support: ReturnType<ToolProtocolIntegration['getToolSupport']>
}> {
  const integration = new ToolProtocolIntegration()
  integration.registerExternalTool(input.toolName, input.externalTool)
  const result = await integration.dispatchToolCall(
    {
      callId: input.request.callId,
      toolName: input.toolName,
      arguments: input.request.arguments,
      source: input.request.source,
      taskId: input.request.taskId,
    },
    input.context,
  )

  return {
    spec: integration.getToolSpec(input.toolName),
    result,
    support: integration.getToolSupport(input.toolName),
  }
}
