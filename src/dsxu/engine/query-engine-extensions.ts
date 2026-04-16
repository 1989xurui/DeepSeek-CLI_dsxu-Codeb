/**
 * QueryEngine扩展 - 集成记忆智能体链
 *
 * 扩展QueryEngine以支持记忆智能体链的统一挂载
 */

import type { QueryEngineConfig } from '../../QueryEngine'
import type { Message, ToolDefinition } from './types'
import type {
  MemoryChain, MemoryChainConfig, MemoryProcessingResult,
  MemoryCallback, TriggerOptions, DEFAULT_MEMORY_CHAIN_CONFIG
} from './memory-chain-types'
import { MemoryChainImpl, createMemoryChain } from './memory-chain'
import { formatMemoriesForOutput } from './memory-chain-types'

// ── 扩展配置 ──

export interface QueryEngineWithMemoryChainConfig extends QueryEngineConfig {
  /** 记忆链配置 */
  memoryChainConfig?: MemoryChainConfig
  /** 是否自动初始化记忆链 */
  autoInitializeMemoryChain?: boolean
  /** 记忆处理选项 */
  memoryProcessingOptions?: {
    /** 是否在每个turn结束时自动处理记忆 */
    autoProcessAtTurnEnd?: boolean
    /** 处理模式 */
    defaultMode?: 'extraction' | 'integration' | 'all'
    /** 处理阈值（消息数量） */
    processingThreshold?: number
  }
}

// ── 扩展的QueryEngine ──

export class QueryEngineWithMemoryChain {
  private baseEngine: any // QueryEngine实例
  private memoryChain?: MemoryChain
  private memoryConfig: MemoryChainConfig
  private processingOptions: {
    autoProcessAtTurnEnd: boolean
    defaultMode: 'extraction' | 'integration' | 'all'
    processingThreshold: number
  }
  private messageCountSinceLastProcessing = 0

  constructor(config: QueryEngineWithMemoryChainConfig) {
    // 保存基础配置
    this.memoryConfig = config.memoryChainConfig || DEFAULT_MEMORY_CHAIN_CONFIG
    this.processingOptions = {
      autoProcessAtTurnEnd: config.memoryProcessingOptions?.autoProcessAtTurnEnd ?? true,
      defaultMode: config.memoryProcessingOptions?.defaultMode ?? 'all',
      processingThreshold: config.memoryProcessingOptions?.processingThreshold ?? 5,
    }

    // 创建基础QueryEngine（简化，实际需要适配现有QueryEngine）
    this.initializeBaseEngine(config)

    // 自动初始化记忆链
    if (config.autoInitializeMemoryChain !== false) {
      this.initializeMemoryChain()
    }
  }

  // ── 记忆链管理 ──

  private async initializeMemoryChain(): Promise<void> {
    try {
      this.memoryChain = createMemoryChain(this.memoryConfig)

      // 设置LLM调用函数
      this.memoryChain.setLLMCallFn(this.createLLMCallFn())

      // 初始化记忆链
      await this.memoryChain.initialize(this.memoryConfig)

      // 注册记忆感知工具
      this.registerMemoryAwareTools()

      // 设置记忆回调
      this.setupMemoryCallbacks()

      console.log('[QueryEngine] Memory chain initialized successfully')
    } catch (error: any) {
      console.error(`[QueryEngine] Failed to initialize memory chain: ${error.message}`)
    }
  }

  private createLLMCallFn(): any {
    // 创建LLM调用函数适配器
    // 实际实现需要从QueryEngine中获取LLM调用能力
    return async (messages: any[], tools: any[], options: any) => {
      // 简化实现，实际需要调用QueryEngine的LLM功能
      console.log('[QueryEngine] LLM call requested for memory extraction')
      return {
        content: 'Memory extraction placeholder response',
        role: 'assistant',
      }
    }
  }

  private registerMemoryAwareTools(): void {
    if (!this.memoryChain) return

    // 注册记忆搜索工具
    const memorySearchTool: ToolDefinition = {
      name: 'MemorySearch',
      description: 'Search through extracted memories for relevant information',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query to find relevant memories',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of memories to return',
            default: 5,
          },
          minQuality: {
            type: 'number',
            description: 'Minimum quality score (0-1)',
            default: 0.5,
          },
        },
        required: ['query'],
      },
      concurrencySafe: true,
      readOnly: true,
      execute: async (input: any, context: any) => {
        if (!this.memoryChain) {
          return {
            content: 'Memory chain not initialized',
            isError: true,
          }
        }

        try {
          const memories = await this.memoryChain.search(input.query, {
            limit: input.limit,
            minQuality: input.minQuality,
          })

          if (memories.length === 0) {
            return {
              content: 'No relevant memories found for your query.',
              isError: false,
            }
          }

          return {
            content: formatMemoriesForOutput(memories),
            isError: false,
            meta: {
              memoryCount: memories.length,
              query: input.query,
            },
          }
        } catch (error: any) {
          return {
            content: `Memory search failed: ${error.message}`,
            isError: true,
          }
        }
      },
    }

    // 注册记忆统计工具
    const memoryStatsTool: ToolDefinition = {
      name: 'MemoryStats',
      description: 'Get statistics about extracted memories',
      inputSchema: {
        type: 'object',
        properties: {
          detailed: {
            type: 'boolean',
            description: 'Whether to include detailed component status',
            default: false,
          },
        },
      },
      concurrencySafe: true,
      readOnly: true,
      execute: async (input: any, context: any) => {
        if (!this.memoryChain) {
          return {
            content: 'Memory chain not initialized',
            isError: true,
          }
        }

        try {
          const stats = this.memoryChain.getStats()
          const componentStatus = input.detailed
            ? this.memoryChain.getComponentStatus()
            : undefined

          let content = `## Memory Statistics

**Total Memories**: ${stats.totalMemories}
**Extraction Count**: ${stats.extractionCount}
**Integration Count**: ${stats.integrationCount}
**Agent Memory Count**: ${stats.agentMemoryCount}

**Memory Types**:`

          for (const [type, count] of Object.entries(stats.byType)) {
            content += `\n- ${type}: ${count}`
          }

          if (componentStatus) {
            content += `\n\n## Component Status`
            for (const [component, status] of Object.entries(componentStatus)) {
              content += `\n\n**${component}**:`
              for (const [key, value] of Object.entries(status)) {
                content += `\n  - ${key}: ${JSON.stringify(value)}`
              }
            }
          }

          return {
            content,
            isError: false,
            meta: {
              totalMemories: stats.totalMemories,
              extractionCount: stats.extractionCount,
            },
          }
        } catch (error: any) {
          return {
            content: `Failed to get memory stats: ${error.message}`,
            isError: true,
          }
        }
      },
    }

    // 注册手动记忆处理工具
    const memoryProcessTool: ToolDefinition = {
      name: 'ProcessMemories',
      description: 'Manually trigger memory processing for the current conversation',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            description: 'Processing mode: extraction, integration, or all',
            enum: ['extraction', 'integration', 'all'],
            default: 'all',
          },
          force: {
            type: 'boolean',
            description: 'Force processing even if thresholds are not met',
            default: false,
          },
        },
      },
      concurrencySafe: false,
      readOnly: false,
      execute: async (input: any, context: any) => {
        if (!this.memoryChain) {
          return {
            content: 'Memory chain not initialized',
            isError: true,
          }
        }

        try {
          const messages = this.getMessages()
          const sessionId = this.getSessionId()

          const result = await this.memoryChain.processMessages(
            messages,
            sessionId,
            {
              mode: input.mode,
              force: input.force,
            }
          )

          let content = `## Memory Processing Result

**Status**: ${result.status}
**Duration**: ${result.durationMs}ms
**Extracted Memories**: ${result.extractedMemories.length}
**Integrated Memories**: ${result.integratedMemories.length}
**Triggered Skills**: ${result.triggeredSkills.length}
**Created Forks**: ${result.createdForks.length}`

          if (result.error) {
            content += `\n\n**Error**: ${result.error}`
          }

          if (result.extractedMemories.length > 0) {
            content += `\n\n### Extracted Memories:\n${formatMemoriesForOutput(result.extractedMemories.slice(0, 3))}`
            if (result.extractedMemories.length > 3) {
              content += `\n... and ${result.extractedMemories.length - 3} more`
            }
          }

          return {
            content,
            isError: result.status === 'error',
            meta: {
              status: result.status,
              extractedCount: result.extractedMemories.length,
              integratedCount: result.integratedMemories.length,
            },
          }
        } catch (error: any) {
          return {
            content: `Memory processing failed: ${error.message}`,
            isError: true,
          }
        }
      },
    }

    // 将工具添加到引擎
    this.addTools([memorySearchTool, memoryStatsTool, memoryProcessTool])
  }

  private setupMemoryCallbacks(): void {
    if (!this.memoryChain) return

    const callback: MemoryCallback = {
      onMemoriesExtracted: (memories) => {
        console.log(`[QueryEngine] ${memories.length} memories extracted`)
        // 可以在这里触发UI更新或其他操作
      },
      onMemoriesIntegrated: (memories) => {
        console.log(`[QueryEngine] ${memories.length} memories integrated`)
      },
      onSkillTriggered: (skillName, result) => {
        console.log(`[QueryEngine] Skill triggered: ${skillName}`)
      },
      onForkCreated: (forkResult) => {
        console.log(`[QueryEngine] Fork created: ${forkResult.forkId}`)
      },
      onProcessingComplete: (result) => {
        console.log(`[QueryEngine] Memory processing completed: ${result.status}`)
      },
      onError: (error, context) => {
        console.error(`[QueryEngine] Memory error in ${context}: ${error.message}`)
      },
    }

    this.memoryChain.setCallback(callback)
  }

  // ── 基础引擎适配器 ──

  private initializeBaseEngine(config: QueryEngineWithMemoryChainConfig): void {
    // 这里需要适配现有的QueryEngine
    // 简化实现，实际需要创建或包装现有的QueryEngine
    this.baseEngine = {
      // 模拟基础引擎的方法
      submitMessage: async function* (prompt: any, options: any) {
        // 模拟消息处理
        yield { type: 'assistant', content: 'Response from base engine' }
      },
      getMessages: () => [],
      getSessionId: () => 'test-session-id',
      getTools: () => [],
      addTools: (tools: any[]) => {
        console.log('[QueryEngine] Tools added:', tools.map(t => t.name))
      },
    }

    // 包装submitMessage以集成记忆处理
    this.wrapSubmitMessage()
  }

  private wrapSubmitMessage(): void {
    const originalSubmitMessage = this.baseEngine.submitMessage.bind(this.baseEngine)

    this.baseEngine.submitMessage = async function* (prompt: any, options: any) {
      // 调用原始方法
      const generator = originalSubmitMessage(prompt, options)

      try {
        for await (const message of generator) {
          yield message
        }
      } finally {
        // 对话结束时处理记忆
        if (this.processingOptions.autoProcessAtTurnEnd) {
          this.messageCountSinceLastProcessing++

          if (this.messageCountSinceLastProcessing >= this.processingOptions.processingThreshold) {
            await this.processMemoriesAtTurnEnd()
            this.messageCountSinceLastProcessing = 0
          }
        }
      }
    }.bind(this)
  }

  private async processMemoriesAtTurnEnd(): Promise<void> {
    if (!this.memoryChain || !this.memoryConfig.enabled) {
      return
    }

    try {
      const messages = this.getMessages()
      const sessionId = this.getSessionId()

      const result = await this.memoryChain.processMessages(
        messages,
        sessionId,
        {
          mode: this.processingOptions.defaultMode,
        }
      )

      this.logMemoryProcessing(result)
    } catch (error: any) {
      console.warn(`[QueryEngine] Memory processing failed: ${error.message}`)
    }
  }

  private logMemoryProcessing(result: MemoryProcessingResult): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      messageCount: this.getMessages().length,
      ...result,
    }

    console.log('[QueryEngine] Memory processing logged:', {
      status: logEntry.status,
      extracted: logEntry.extractedMemories.length,
      integrated: logEntry.integratedMemories.length,
      duration: logEntry.durationMs,
    })
  }

  // ── 公共API ──

  /** 获取记忆链实例 */
  getMemoryChain(): MemoryChain | undefined {
    return this.memoryChain
  }

  /** 手动触发记忆处理 */
  async triggerMemoryProcessing(options?: TriggerOptions): Promise<MemoryProcessingResult> {
    if (!this.memoryChain) {
      throw new Error('Memory chain not initialized')
    }

    const messages = this.getMessages()
    const sessionId = this.getSessionId()

    return await this.memoryChain.processMessages(messages, sessionId, options)
  }

  /** 更新记忆链配置 */
  updateMemoryChainConfig(config: Partial<MemoryChainConfig>): void {
    if (!this.memoryChain) {
      throw new Error('Memory chain not initialized')
    }

    this.memoryChain.updateConfig(config)
    Object.assign(this.memoryConfig, config)
  }

  /** 获取记忆链状态 */
  getMemoryChainStatus(): any {
    if (!this.memoryChain) {
      return { initialized: false }
    }

    const stats = this.memoryChain.getStats()
    const componentStatus = this.memoryChain.getComponentStatus()

    return {
      initialized: true,
      config: this.memoryConfig,
      stats,
      componentStatus,
      processingOptions: this.processingOptions,
    }
  }

  // ── 基础引擎代理方法 ──

  async *submitMessage(prompt: any, options?: any): AsyncGenerator<any, void, unknown> {
    return this.baseEngine.submitMessage(prompt, options)
  }

  getMessages(): Message[] {
    return this.baseEngine.getMessages()
  }

  getSessionId(): string {
    return this.baseEngine.getSessionId()
  }

  getTools(): ToolDefinition[] {
    return this.baseEngine.getTools()
  }

  addTools(tools: ToolDefinition[]): void {
    return this.baseEngine.addTools(tools)
  }

  // ── 静态工厂方法 ──

  static async create(config: QueryEngineWithMemoryChainConfig): Promise<QueryEngineWithMemoryChain> {
    const instance = new QueryEngineWithMemoryChain(config)

    // 等待记忆链初始化完成
    if (config.autoInitializeMemoryChain !== false) {
      // 给初始化一点时间（实际应该等待初始化完成）
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return instance
  }
}

// ── 适配器函数 ──

/** 将现有的QueryEngine适配为支持记忆链的版本 */
export function adaptQueryEngineWithMemoryChain(
  baseEngine: any,
  memoryChainConfig?: MemoryChainConfig
): QueryEngineWithMemoryChain {
  // 创建配置
  const config: QueryEngineWithMemoryChainConfig = {
    // 从基础引擎获取配置
    ...extractConfigFromBaseEngine(baseEngine),
    memoryChainConfig,
    autoInitializeMemoryChain: false, // 手动初始化
  }

  // 创建适配实例
  const adaptedEngine = new QueryEngineWithMemoryChain(config)

  // 替换基础引擎
  adaptedEngine['baseEngine'] = baseEngine

  // 包装submitMessage
  wrapEngineSubmitMessage(adaptedEngine, baseEngine)

  return adaptedEngine
}

/** 从基础引擎提取配置 */
function extractConfigFromBaseEngine(engine: any): Partial<QueryEngineWithMemoryChainConfig> {
  // 简化实现，实际需要从引擎中提取配置
  return {
    // 提取相关配置
  }
}

/** 包装引擎的submitMessage方法 */
function wrapEngineSubmitMessage(adaptedEngine: QueryEngineWithMemoryChain, baseEngine: any): void {
  const originalSubmitMessage = baseEngine.submitMessage

  baseEngine.submitMessage = async function* (prompt: any, options: any) {
    const generator = originalSubmitMessage.call(this, prompt, options)

    try {
      for await (const message of generator) {
        yield message
      }
    } finally {
      // 触发记忆处理
      if (adaptedEngine['processingOptions'].autoProcessAtTurnEnd) {
        adaptedEngine['messageCountSinceLastProcessing']++

        if (adaptedEngine['messageCountSinceLastProcessing'] >= adaptedEngine['processingOptions'].processingThreshold) {
          await adaptedEngine['processMemoriesAtTurnEnd']()
          adaptedEngine['messageCountSinceLastProcessing'] = 0
        }
      }
    }
  }
}

// ── 工具函数 ──

/** 创建记忆感知的QueryEngine配置 */
export function createMemoryAwareEngineConfig(
  baseConfig: QueryEngineConfig,
  memoryOptions?: {
    enabled?: boolean
    extraction?: boolean
    autoDream?: boolean
    agentMemory?: boolean
    skills?: boolean
    forkAgent?: boolean
  }
): QueryEngineWithMemoryChainConfig {
  const memoryConfig: MemoryChainConfig = {
    ...DEFAULT_MEMORY_CHAIN_CONFIG,
    enabled: memoryOptions?.enabled ?? true,
    extraction: {
      ...DEFAULT_MEMORY_CHAIN_CONFIG.extraction,
      enabled: memoryOptions?.extraction ?? true,
    },
    autoDream: {
      ...DEFAULT_MEMORY_CHAIN_CONFIG.autoDream,
      enabled: memoryOptions?.autoDream ?? true,
    },
    agentMemory: {
      ...DEFAULT_MEMORY_CHAIN_CONFIG.agentMemory,
      enabled: memoryOptions?.agentMemory ?? true,
    },
    skills: {
      ...DEFAULT_MEMORY_CHAIN_CONFIG.skills,
      enabled: memoryOptions?.skills ?? true,
    },
    forkAgent: {
      ...DEFAULT_MEMORY_CHAIN_CONFIG.forkAgent,
      enabled: memoryOptions?.forkAgent ?? true,
    },
  }

  return {
    ...baseConfig,
    memoryChainConfig: memoryConfig,
    autoInitializeMemoryChain: true,
    memoryProcessingOptions: {
      autoProcessAtTurnEnd: true,
      defaultMode: 'all',
      processingThreshold: 5,
    },
  }
}

/** 检查QueryEngine是否支持记忆链 */
export function isMemoryChainSupported(engine: any): boolean {
  return engine instanceof QueryEngineWithMemoryChain ||
         (engine.getMemoryChain && typeof engine.getMemoryChain === 'function')
}

/** 获取记忆链实例（如果支持） */
export function getMemoryChainFromEngine(engine: any): MemoryChain | undefined {
  if (engine instanceof QueryEngineWithMemoryChain) {
    return engine.getMemoryChain()
  }

  if (engine.getMemoryChain && typeof engine.getMemoryChain === 'function') {
    return engine.getMemoryChain()
  }

  return undefined
}