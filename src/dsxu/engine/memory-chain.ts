/**
 * 记忆智能体链实现
 *
 * 统一管理所有记忆相关组件，提供一致的API和生命周期管理
 */

import type { Message, LLMCallFn, ToolDefinition } from './types'
import {
  MemoryChain, MemoryChainConfig, Memory, MemoryProcessingResult,
  MemoryStats, ComponentStatus, SearchOptions, MemoryCallback,
  TriggerOptions, DEFAULT_MEMORY_CHAIN_CONFIG, formatMemoriesForOutput,
  validateMemoryConfig, createMemoryId, isValidMemory
} from './memory-chain-types'

// 导入现有组件
import { extractMemories, MemoryStore, AutoDreamIntegrator } from './memory-extractor'
import type { AgentMemoryScope } from '../../tools/AgentTool/agentMemory'
import { SkillsAdapter, createSkillsAdapter } from './skills-adapter'
import { createForkAgentTool, ForkResult, AgentSummary } from './forked-agent'

// ── 内部类型 ──

interface MemoryChainComponents {
  extractor: MemoryExtractor
  store: MemoryStore
  autoDream: AutoDreamIntegrator
  agentMemory: AgentMemoryManager
  skillsAdapter: SkillsAdapter
  forkAgent: ForkAgentManager
  router: MemoryRouter
}

interface MemoryExtractor {
  extractMemories(messages: Message[], llmCall: LLMCallFn, sessionId: string, qualityThreshold: number): Promise<{ memories: Memory[] }>
  updateConfig(config: any): void
  getLastExtractionTime(): Date | null
}

interface AgentMemoryManager {
  saveMemory(memory: Memory, options: { scope: AgentMemoryScope, sessionId: string, timestamp: string }): Promise<void>
  search(query: string, options?: SearchOptions): Promise<Memory[]>
  getStats(): { total: number }
  getStatus(): ComponentStatus
  cleanup(): Promise<void>
}

interface ForkAgentManager {
  createFork(options: {
    directive: string
    parentMessages: Message[]
    config: any
  }): Promise<ForkResult>
  getActiveForkCount(): number
  cleanup(): Promise<void>
}

interface MemoryRouter {
  routeMemories(memories: Memory[], messages: Message[], sessionId: string): Promise<{
    integratedMemories: Memory[]
    triggeredSkills: string[]
    createdForks: ForkResult[]
  }>
}

// ── MemoryChain实现 ──

export class MemoryChainImpl implements MemoryChain {
  private config: MemoryChainConfig
  private components: MemoryChainComponents
  private callback?: MemoryCallback
  private llmCall?: LLMCallFn
  private isInitialized = false

  constructor(config: Partial<MemoryChainConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CHAIN_CONFIG, ...config }
    this.components = this.initializeComponents()
  }

  async initialize(config: MemoryChainConfig): Promise<void> {
    // 验证配置
    const errors = validateMemoryConfig(config)
    if (errors.length > 0) {
      throw new Error(`Invalid memory chain config: ${errors.join(', ')}`)
    }

    this.config = config
    this.isInitialized = true

    // 启动自动整合
    if (this.config.autoDream.enabled) {
      this.components.autoDream.start()
    }

    // 注册Skills
    if (this.config.skills.enabled && this.config.skills.autoRegister) {
      this.components.skillsAdapter.registerAllSkills()
    }

    console.log(`[MemoryChain] Initialized with config:`, {
      extraction: this.config.extraction.enabled,
      autoDream: this.config.autoDream.enabled,
      agentMemory: this.config.agentMemory.enabled,
      skills: this.config.skills.enabled,
      forkAgent: this.config.forkAgent.enabled,
    })
  }

  async processMessages(
    messages: Message[],
    sessionId: string,
    options?: TriggerOptions
  ): Promise<MemoryProcessingResult> {
    if (!this.isInitialized) {
      throw new Error('MemoryChain not initialized. Call initialize() first.')
    }

    const startTime = Date.now()
    const result: MemoryProcessingResult = {
      extractedMemories: [],
      integratedMemories: [],
      triggeredSkills: [],
      createdForks: [],
      status: 'success',
      durationMs: 0,
    }

    try {
      // 1. 提取记忆
      if (this.config.extraction.enabled && (!options || options.mode !== 'integration')) {
        const extractionResult = await this.extractMemories(messages, sessionId, options)
        result.extractedMemories = extractionResult.memories

        // 存储提取的记忆
        if (extractionResult.memories.length > 0) {
          await this.components.store.addAll(extractionResult.memories)

          // 添加到自动整合队列
          this.components.autoDream.addMemories(extractionResult.memories)

          // 触发回调
          this.callback?.onMemoriesExtracted?.(extractionResult.memories)
        }
      }

      // 2. 路由记忆到相关组件
      if (result.extractedMemories.length > 0 && (!options || options.mode !== 'extraction')) {
        const routingResult = await this.components.router.routeMemories(
          result.extractedMemories,
          messages,
          sessionId
        )

        result.integratedMemories = routingResult.integratedMemories
        result.triggeredSkills = routingResult.triggeredSkills
        result.createdForks = routingResult.createdForks

        // 触发回调
        if (routingResult.integratedMemories.length > 0) {
          this.callback?.onMemoriesIntegrated?.(routingResult.integratedMemories)
        }

        for (const skillName of routingResult.triggeredSkills) {
          this.callback?.onSkillTriggered?.(skillName, { success: true })
        }

        for (const forkResult of routingResult.createdForks) {
          this.callback?.onForkCreated?.(forkResult)
        }
      }

      // 3. 处理会话记忆
      if (this.config.extraction.sessionMemory.enabled) {
        await this.processSessionMemory(messages, sessionId)
      }

    } catch (error: any) {
      console.warn(`[MemoryChain] Processing failed: ${error.message}`)
      result.status = 'error'
      result.error = error.message

      this.callback?.onError?.(error, 'processMessages')
    } finally {
      result.durationMs = Date.now() - startTime
      this.callback?.onProcessingComplete?.(result)
    }

    return result
  }

  async search(query: string, options?: SearchOptions): Promise<Memory[]> {
    if (!this.isInitialized) {
      throw new Error('MemoryChain not initialized. Call initialize() first.')
    }

    const limit = options?.limit || 5

    try {
      // 1. 搜索本地存储
      const localResults = this.components.store.search(query, limit)

      // 2. 搜索智能体记忆
      const agentResults = await this.components.agentMemory.search(query, options)

      // 3. 合并和排序结果
      const allResults = [...localResults, ...agentResults]

      return this.rankSearchResults(allResults, query, options)
    } catch (error: any) {
      console.warn(`[MemoryChain] Search failed: ${error.message}`)
      this.callback?.onError?.(error, 'search')
      return []
    }
  }

  getStats(): MemoryStats {
    const storeStats = this.components.store.getStats()
    const agentStats = this.components.agentMemory.getStats()

    return {
      totalMemories: storeStats.total + agentStats.total,
      byType: { ...storeStats.byType, ...agentStats.byType },
      extractionCount: storeStats.total,
      integrationCount: this.components.autoDream.getStatus().pendingCount,
      agentMemoryCount: agentStats.total,
      searchCount: 0, // 需要跟踪搜索次数
    }
  }

  getComponentStatus(): Record<string, ComponentStatus> {
    const autoDreamStatus = this.components.autoDream.getStatus()
    const agentMemoryStatus = this.components.agentMemory.getStatus()
    const skillsStatus = this.components.skillsAdapter.getStatus()

    return {
      extractor: {
        enabled: this.config.extraction.enabled,
        lastExtraction: this.components.extractor.getLastExtractionTime()?.toISOString(),
      },
      store: {
        enabled: true,
        memoryCount: this.components.store.getAll().length,
      },
      autoDream: {
        enabled: autoDreamStatus.enabled,
        isRunning: autoDreamStatus.isRunning,
        pendingCount: autoDreamStatus.pendingCount,
      },
      agentMemory: {
        enabled: agentMemoryStatus.enabled,
        ...agentMemoryStatus,
      },
      skills: {
        enabled: skillsStatus.enabled,
        skillsLoaded: skillsStatus.skillsLoaded,
        skillCount: skillsStatus.skillCount,
      },
      forkAgent: {
        enabled: this.config.forkAgent.enabled,
        activeForks: this.components.forkAgent.getActiveForkCount(),
      },
      router: {
        enabled: true,
      },
    }
  }

  updateConfig(config: Partial<MemoryChainConfig>): void {
    const oldConfig = { ...this.config }
    Object.assign(this.config, config)

    // 更新组件配置
    if (config.extraction) {
      this.components.extractor.updateConfig(config.extraction)
    }

    if (config.autoDream) {
      this.components.autoDream.updateConfig(config.autoDream)

      // 处理启用/禁用状态变化
      if (oldConfig.autoDream.enabled && !this.config.autoDream.enabled) {
        this.components.autoDream.stop()
      } else if (!oldConfig.autoDream.enabled && this.config.autoDream.enabled) {
        this.components.autoDream.start()
      }
    }

    if (config.skills) {
      this.components.skillsAdapter.updateConfig(config.skills)
    }

    console.log(`[MemoryChain] Config updated:`, config)
  }

  setCallback(callback: MemoryCallback): void {
    this.callback = callback
  }

  async cleanup(): Promise<void> {
    // 停止自动整合
    this.components.autoDream.stop()

    // 清理资源
    await this.components.agentMemory.cleanup()
    await this.components.forkAgent.cleanup()

    this.isInitialized = false

    console.log('[MemoryChain] Cleanup completed')
  }

  // ── 私有方法 ──

  private initializeComponents(): MemoryChainComponents {
    // 初始化记忆提取器（适配现有接口）
    const extractor: MemoryExtractor = {
      extractMemories: async (messages, llmCall, sessionId, qualityThreshold) => {
        const result = await extractMemories(messages, llmCall, sessionId, qualityThreshold)
        return { memories: result.memories }
      },
      updateConfig: (config) => {
        // 更新提取器配置
        console.log('[MemoryChain] Extractor config updated:', config)
      },
      getLastExtractionTime: () => {
        return new Date() // 简化实现
      },
    }

    // 初始化记忆存储
    const store = new MemoryStore()

    // 初始化自动整合器
    const autoDream = new AutoDreamIntegrator(store, this.config.autoDream)

    // 初始化智能体记忆管理器（简化实现）
    const agentMemory: AgentMemoryManager = {
      saveMemory: async (memory, options) => {
        console.log(`[MemoryChain] Saving memory to agent memory (scope: ${options.scope}): ${memory.title}`)
        // 实际实现需要调用agentMemory.ts中的函数
      },
      search: async (query, options) => {
        console.log(`[MemoryChain] Searching agent memory: ${query}`)
        return [] // 简化实现
      },
      getStats: () => ({ total: 0 }), // 简化实现
      getStatus: () => ({ enabled: this.config.agentMemory.enabled }),
      cleanup: async () => {
        console.log('[MemoryChain] Cleaning up agent memory')
      },
    }

    // 初始化Skills适配器
    const skillsAdapter = createSkillsAdapter({
      enabled: this.config.skills.enabled,
      autoRegister: this.config.skills.autoRegister,
      excludeSkills: this.config.skills.excludeSkills,
    })

    // 初始化Fork代理管理器（简化实现）
    const forkAgent: ForkAgentManager = {
      createFork: async (options) => {
        console.log(`[MemoryChain] Creating fork: ${options.directive.slice(0, 50)}...`)
        // 实际实现需要调用forked-agent.ts中的函数
        return {
          forkId: `fork-${Date.now()}`,
          directive: options.directive,
          finalMessage: '[Fork result placeholder]',
          exitReason: 'success',
          turns: 1,
          usage: { inputTokens: 0, outputTokens: 0 },
          durationMs: 100,
        }
      },
      getActiveForkCount: () => 0, // 简化实现
      cleanup: async () => {
        console.log('[MemoryChain] Cleaning up fork agent')
      },
    }

    // 初始化记忆路由器
    const router: MemoryRouter = {
      routeMemories: async (memories, messages, sessionId) => {
        const result = {
          integratedMemories: [] as Memory[],
          triggeredSkills: [] as string[],
          createdForks: [] as ForkResult[],
        }

        for (const memory of memories) {
          // 根据记忆类型路由
          switch (memory.type) {
            case 'technical_decision':
            case 'project_pattern':
              // 路由到智能体记忆
              await agentMemory.saveMemory(memory, {
                scope: this.determineAgentMemoryScope(memory),
                sessionId,
                timestamp: new Date().toISOString(),
              })
              result.integratedMemories.push(memory)
              break

            case 'bug_fix':
            case 'error_solution':
              // 触发相关Skills
              const skillName = this.identifyRelevantSkill(memory)
              if (skillName && skillsAdapter.hasSkill(skillName)) {
                result.triggeredSkills.push(skillName)
              }
              break

            case 'user_preference':
              // 创建Fork代理
              if (this.config.forkAgent.memoryAwareForks) {
                const forkResult = await forkAgent.createFork({
                  directive: this.createForkDirective(memory),
                  parentMessages: messages,
                  config: {
                    maxTurns: this.config.forkAgent.defaultMaxTurns,
                    systemPrompt: this.createForkSystemPrompt(memory),
                  },
                })
                result.createdForks.push(forkResult)
              }
              break
          }
        }

        return result
      },
    }

    return {
      extractor,
      store,
      autoDream,
      agentMemory,
      skillsAdapter,
      forkAgent,
      router,
    }
  }

  private async extractMemories(
    messages: Message[],
    sessionId: string,
    options?: TriggerOptions
  ): Promise<{ memories: Memory[] }> {
    if (!this.llmCall) {
      throw new Error('LLM call function not set. Call setLLMCallFn() first.')
    }

    const force = options?.force || false
    const qualityThreshold = this.config.extraction.qualityThreshold

    // 检查最小对话长度
    const meaningfulMessages = messages.filter(m => {
      if (m.role === 'system') return false
      const content = typeof m.content === 'string' ? m.content : ''
      return content.length > 20
    })

    if (!force && meaningfulMessages.length < this.config.extraction.minConversationLength) {
      return { memories: [] }
    }

    return await this.components.extractor.extractMemories(
      messages,
      this.llmCall,
      sessionId,
      qualityThreshold
    )
  }

  private async processSessionMemory(messages: Message[], sessionId: string): Promise<void> {
    // 这里需要集成现有的sessionMemory.ts逻辑
    // 暂时留空，后续实现
    console.log(`[MemoryChain] Processing session memory for session: ${sessionId}`)
  }

  private determineAgentMemoryScope(memory: Memory): AgentMemoryScope {
    // 根据记忆内容决定作用域
    if (memory.files.length > 0) {
      return 'project' // 项目相关
    } else if (memory.tags.includes('user') || memory.tags.includes('preference')) {
      return 'user' // 用户相关
    } else {
      return this.config.agentMemory.defaultScope
    }
  }

  private identifyRelevantSkill(memory: Memory): string | null {
    // 根据记忆类型和内容识别相关Skills
    if (memory.type === 'bug_fix') {
      return 'debug'
    }

    if (memory.type === 'error_solution') {
      return 'simplify'
    }

    // 检查记忆内容中的关键词
    const content = memory.content.toLowerCase()
    if (content.includes('test') || content.includes('测试')) {
      return 'test'
    }

    if (content.includes('refactor') || content.includes('重构')) {
      return 'simplify'
    }

    return null
  }

  private createForkDirective(memory: Memory): string {
    return `Process user preference memory: "${memory.title}"

Content: ${memory.content.slice(0, 500)}

Analyze this preference and suggest how to incorporate it into the project workflow.`
  }

  private createForkSystemPrompt(memory: Memory): string {
    return `You are a sub-agent processing a user preference memory.

Memory Type: ${memory.type}
Title: ${memory.title}
Quality Score: ${memory.quality}

Your task is to analyze this preference and provide actionable recommendations.`
  }

  private rankSearchResults(
    memories: Memory[],
    query: string,
    options?: SearchOptions
  ): Memory[] {
    const sortBy = options?.sortBy || 'relevance'
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(kw => kw.length > 2)

    // 计算相关性分数
    const scoredMemories = memories.map(memory => {
      let score = 0

      // 基础质量分数
      score += memory.quality * 10

      // 关键词匹配
      const text = `${memory.title} ${memory.content} ${memory.tags.join(' ')} ${memory.files.join(' ')}`.toLowerCase()
      for (const keyword of queryKeywords) {
        if (text.includes(keyword)) {
          score += 5
        }
      }

      // 类型匹配
      if (options?.types?.includes(memory.type)) {
        score += 3
      }

      // 标签匹配
      if (options?.tags && memory.tags.some(tag => options.tags!.includes(tag))) {
        score += 2
      }

      // 文件匹配
      if (options?.files && memory.files.some(file => options.files!.includes(file))) {
        score += 2
      }

      // 时间衰减（越新的记忆分数越高）
      const ageDays = (Date.now() - new Date(memory.timestamp).getTime()) / (1000 * 60 * 60 * 24)
      score += Math.max(0, 10 - ageDays) / 10

      return { memory, score }
    })

    // 排序
    if (sortBy === 'quality') {
      scoredMemories.sort((a, b) => b.memory.quality - a.memory.quality)
    } else if (sortBy === 'recency') {
      scoredMemories.sort((a, b) =>
        new Date(b.memory.timestamp).getTime() - new Date(a.memory.timestamp).getTime()
      )
    } else {
      // 相关性排序
      scoredMemories.sort((a, b) => b.score - a.score)
    }

    // 应用限制
    const limit = options?.limit || 10
    return scoredMemories.slice(0, limit).map(item => item.memory)
  }

  // ── 公共辅助方法 ──

  /** 设置LLM调用函数 */
  setLLMCallFn(llmCall: LLMCallFn): void {
    this.llmCall = llmCall
  }

  /** 获取记忆存储实例 */
  getMemoryStore(): MemoryStore {
    return this.components.store
  }

  /** 获取Skills适配器实例 */
  getSkillsAdapter(): SkillsAdapter {
    return this.components.skillsAdapter
  }

  /** 手动触发自动整合 */
  async triggerAutoDreamIntegration(): Promise<void> {
    if (!this.config.autoDream.enabled) {
      throw new Error('AutoDream integration is disabled')
    }

    await this.components.autoDream.integrateNow()
  }
}

// ── 工厂函数 ──

/** 创建记忆链实例 */
export function createMemoryChain(config?: Partial<MemoryChainConfig>): MemoryChain {
  return new MemoryChainImpl(config)
}

/** 创建默认配置的记忆链 */
export function createDefaultMemoryChain(): MemoryChain {
  return createMemoryChain(DEFAULT_MEMORY_CHAIN_CONFIG)
}

/** 创建记忆感知工具 */
export function createMemoryAwareTool(
  memoryChain: MemoryChain,
  baseTool: ToolDefinition
): ToolDefinition {
  return {
    ...baseTool,
    name: `memory_aware_${baseTool.name}`,
    description: `${baseTool.description} (Memory-aware)`,
    execute: async (input, context) => {
      // 在执行前搜索相关记忆
      const query = this.extractSearchQuery(input, context)
      if (query) {
        const relevantMemories = await memoryChain.search(query, { limit: 3 })

        if (relevantMemories.length > 0) {
          // 将记忆注入上下文
          const memoryContext = formatMemoriesForOutput(relevantMemories)
          const enhancedInput = {
            ...input,
            _memoryContext: memoryContext,
          }

          return await baseTool.execute(enhancedInput, context)
        }
      }

      return await baseTool.execute(input, context)
    },
  }
}

// 辅助函数
function extractSearchQuery(input: any, context: any): string | null {
  // 从输入中提取搜索查询
  if (typeof input === 'string') {
    return input
  }

  if (typeof input === 'object' && input !== null) {
    // 尝试从常见字段中提取
    const possibleFields = ['query', 'search', 'question', 'prompt', 'input', 'text']
    for (const field of possibleFields) {
      if (typeof input[field] === 'string' && input[field].trim().length > 0) {
        return input[field]
      }
    }
  }

  return null
}