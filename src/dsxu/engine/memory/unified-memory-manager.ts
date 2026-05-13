/**
 * V14 FROZEN: this old unified memory aggregation layer was replaced by
 * DSXU memory-refill-control plus context-discipline-control. It is retained
 * only because Windows ACL blocked physical removal.
 *
 * Unified Memory Manager - 统一记忆管理器
 *
 * V8-2 Runtime Core: Memory/Context/Compact 承接层
 *
 * 统一管理所有记忆层级，提供与A接口（Session/Task）的集成
 */

import type { Message, LLMCallFn, ToolContext } from '../types'
import type { Memory, MemoryStore, AutoDreamIntegrator, extractMemories } from '../memory-extractor'
import type { Episode, RuntimeStateEvent, ToolEvent, createEpisode } from '../episode-memory'
import type { CompactResult } from '../compact'

// ── 类型定义 ──

export interface UnifiedMemoryConfig {
  /** 是否启用统一记忆管理 */
  enabled: boolean
  /** 各记忆层级配置 */
  layers: {
    /** Episode记忆配置 */
    episode: {
      enabled: boolean
      /** 是否在任务完成时持久化 */
      persistOnComplete?: boolean
      /** 最大Episode数量 */
      maxEpisodes?: number
    }
    /** Session记忆配置 */
    session: {
      enabled: boolean
      /** 是否自动更新 */
      autoUpdate?: boolean
      /** 更新间隔（轮次） */
      updateInterval?: number
    }
    /** Process记忆配置 */
    process: {
      enabled: boolean
      /** 最大事件数量 */
      maxEvents?: number
      /** 是否记录工具事件 */
      recordToolEvents?: boolean
    }
    /** Extracted记忆配置 */
    extracted: {
      enabled: boolean
      /** 质量阈值 */
      qualityThreshold?: number
      /** 是否启用AutoDream */
      enableAutoDream?: boolean
    }
  }
  /** 压缩集成配置 */
  compactIntegration: {
    /** 压缩时提取记忆 */
    extractOnCompact: boolean
    /** 压缩后生成brief */
    generateBriefOnCompact: boolean
    /** 压缩前分类 */
    classifyBeforeCompact: boolean
  }
  /** 性能配置 */
  performance: {
    /** 批量处理大小 */
    batchSize: number
    /** 处理超时（毫秒） */
    processingTimeout: number
    /** 是否启用缓存 */
    enableCache: boolean
  }
}

export interface MemoryProcessingContext {
  /** 会话ID */
  sessionId: string
  /** 任务ID */
  taskId?: string
  /** 当前工作目录 */
  cwd: string
  /** 用户查询 */
  query?: string
  /** 工具上下文 */
  toolContext?: ToolContext
  /** 元数据 */
  metadata?: Record<string, any>
}

export interface UnifiedMemoryStats {
  /** 总记忆数 */
  totalMemories: number
  /** 按层级统计 */
  byLayer: {
    episode: number
    session: number
    process: number
    extracted: number
  }
  /** 按类型统计 */
  byType: Record<string, number>
  /** 处理统计 */
  processing: {
    extractions: number
    compactions: number
    briefs: number
    classifications: number
    episodes: number
  }
  /** 最后更新时间 */
  lastUpdated: number
}

export interface MemoryLayerStatus {
  /** 是否启用 */
  enabled: boolean
  /** 记忆数量 */
  count: number
  /** 最后活动时间 */
  lastActivity?: number
  /** 错误信息 */
  error?: string
}

// ── Unified Memory Manager 核心类 ──

export class UnifiedMemoryManager {
  private config: UnifiedMemoryConfig
  private memoryStore: MemoryStore
  private autoDream?: AutoDreamIntegrator
  private episodes: Map<string, Episode> = new Map()
  private sessionMemories: Map<string, string> = new Map()
  private processEvents: RuntimeStateEvent[] = []
  private llmCall?: LLMCallFn
  private stats: UnifiedMemoryStats = {
    totalMemories: 0,
    byLayer: { episode: 0, session: 0, process: 0, extracted: 0 },
    byType: {},
    processing: { extractions: 0, compactions: 0, briefs: 0, classifications: 0, episodes: 0 },
    lastUpdated: Date.now()
  }

  constructor(config?: Partial<UnifiedMemoryConfig>) {
    this.config = {
      enabled: true,
      layers: {
        episode: { enabled: true, persistOnComplete: false, maxEpisodes: 100 },
        session: { enabled: true, autoUpdate: true, updateInterval: 5 },
        process: { enabled: true, maxEvents: 1000, recordToolEvents: true },
        extracted: { enabled: true, qualityThreshold: 0.6, enableAutoDream: true }
      },
      compactIntegration: {
        extractOnCompact: true,
        generateBriefOnCompact: true,
        classifyBeforeCompact: false
      },
      performance: {
        batchSize: 10,
        processingTimeout: 30000,
        enableCache: true
      },
      ...config
    }

    this.memoryStore = new MemoryStore()

    if (this.config.layers.extracted.enabled && this.config.layers.extracted.enableAutoDream) {
      this.autoDream = new AutoDreamIntegrator(this.memoryStore, {
        enabled: true,
        intervalMs: 30000,
        batchSize: this.config.performance.batchSize,
        qualityThreshold: this.config.layers.extracted.qualityThreshold || 0.7
      })
      this.autoDream.start()
    }
  }

  /**
   * 设置LLM调用函数
   */
  setLLMCallFn(llmCall: LLMCallFn): void {
    this.llmCall = llmCall
  }

  /**
   * 处理消息历史（主入口点）
   */
  async processMessages(
    messages: Message[],
    context: MemoryProcessingContext
  ): Promise<{
    processedMessages: Message[]
    extractedMemories: Memory[]
    episode?: Episode
  }> {
    if (!this.config.enabled) {
      return { processedMessages: messages, extractedMemories: [] }
    }

    const startTime = Date.now()
    let processedMessages = messages
    let extractedMemories: Memory[] = []
    let episode: Episode | undefined

    try {
      // 1. 创建或更新Episode
      if (this.config.layers.episode.enabled && context.taskId) {
        episode = await this.handleEpisode(messages, context)
      }

      // 2. 记录Process事件
      if (this.config.layers.process.enabled) {
        this.recordProcessEvents(messages, context)
      }

      // 3. 检查并执行压缩
      if (this.llmCall) {
        const compactResult = await this.handleCompaction(messages, context)
        if (compactResult.wasCompacted) {
          processedMessages = compactResult.messages
          this.stats.processing.compactions++
        }
      }

      // 4. 提取记忆
      if (this.config.layers.extracted.enabled && this.llmCall) {
        extractedMemories = await this.extractMemories(messages, context)
        if (extractedMemories.length > 0) {
          this.stats.processing.extractions++
        }
      }

      // 5. 更新Session记忆
      if (this.config.layers.session.enabled && this.config.layers.session.autoUpdate) {
        await this.updateSessionMemory(messages, context)
      }

      this.stats.lastUpdated = Date.now()
      console.log(`[UnifiedMemoryManager] Processed messages in ${Date.now() - startTime}ms`)

    } catch (error: any) {
      console.warn(`[UnifiedMemoryManager] Processing failed: ${error.message}`)
    }

    return { processedMessages, extractedMemories, episode }
  }

  /**
   * 处理Episode记忆
   */
  private async handleEpisode(
    messages: Message[],
    context: MemoryProcessingContext
  ): Promise<Episode> {
    const { createEpisode, updateEpisodeState, addToolEvent } = await import('../episode-memory')

    // 查找或创建Episode
    let episode: Episode
    const existingEpisode = this.findEpisodeByTask(context.taskId!)
    if (existingEpisode) {
      episode = existingEpisode
    } else {
      episode = createEpisode({
        taskId: context.taskId!,
        sessionId: context.sessionId,
        notes: [`Task: ${context.query}`]
      })
      this.episodes.set(episode.episodeId, episode)
      this.stats.byLayer.episode = this.episodes.size
      this.stats.processing.episodes++
    }

    // 更新Episode状态
    const stateEvent: RuntimeStateEvent = {
      type: 'message_processed',
      value: { messageCount: messages.length },
      timestamp: Date.now(),
      context: { query: context.query }
    }
    episode = updateEpisodeState(episode, stateEvent)

    // 记录工具事件（如果有）
    if (this.config.layers.process.recordToolEvents) {
      const toolEvents = this.extractToolEvents(messages)
      for (const event of toolEvents) {
        episode = addToolEvent(episode, event)
      }
    }

    this.episodes.set(episode.episodeId, episode)
    return episode
  }

  /**
   * 记录Process事件
   */
  private recordProcessEvents(messages: Message[], context: MemoryProcessingContext): void {
    const event: RuntimeStateEvent = {
      type: 'message_batch',
      value: {
        count: messages.length,
        lastRole: messages[messages.length - 1]?.role
      },
      timestamp: Date.now(),
      context: {
        sessionId: context.sessionId,
        taskId: context.taskId
      }
    }

    this.processEvents.push(event)

    // 限制事件数量
    const maxEvents = this.config.layers.process.maxEvents || 1000
    if (this.processEvents.length > maxEvents) {
      this.processEvents = this.processEvents.slice(-maxEvents)
    }

    this.stats.byLayer.process = this.processEvents.length
  }

  /**
   * 处理压缩
   */
  private async handleCompaction(
    messages: Message[],
    context: MemoryProcessingContext
  ): Promise<CompactResult> {
    const { autoCompactIfNeeded } = await import('../compact.ts')

    const compactResult = await autoCompactIfNeeded(messages, this.llmCall!, {
      autoCompactThreshold: 80000,
      keepRecentRounds: 3,
      onArchive: async (archivedMessages, summary) => {
        // 压缩归档时提取记忆
        if (this.config.compactIntegration.extractOnCompact) {
          await this.extractMemories(archivedMessages, context)
        }
      }
    })

    return compactResult
  }

  /**
   * 提取记忆
   */
  private async extractMemories(
    messages: Message[],
    context: MemoryProcessingContext
  ): Promise<Memory[]> {
    const { extractMemories } = await import('../memory-extractor')

    try {
      const result = await extractMemories(
        messages,
        this.llmCall!,
        context.sessionId,
        this.config.layers.extracted.qualityThreshold || 0.6
      )

      if (result.memories.length > 0) {
        await this.memoryStore.addAll(result.memories)

        // 添加到自动整合队列
        if (this.autoDream) {
          this.autoDream.addMemories(result.memories)
        }

        // 更新统计
        this.stats.byLayer.extracted = this.memoryStore.getAll().length
        for (const memory of result.memories) {
          this.stats.byType[memory.type] = (this.stats.byType[memory.type] || 0) + 1
        }

        console.log(`[UnifiedMemoryManager] Extracted ${result.memories.length} memories`)
      }

      return result.memories
    } catch (error: any) {
      console.warn(`[UnifiedMemoryManager] Memory extraction failed: ${error.message}`)
      return []
    }
  }

  /**
   * 更新Session记忆
   */
  private async updateSessionMemory(
    messages: Message[],
    context: MemoryProcessingContext
  ): Promise<void> {
    // 这里可以集成现有的sessionMemory.ts逻辑
    // 暂时简化实现
    const summary = this.generateSessionSummary(messages)
    this.sessionMemories.set(context.sessionId, summary)
    this.stats.byLayer.session = this.sessionMemories.size

    console.log(`[UnifiedMemoryManager] Updated session memory for ${context.sessionId}`)
  }

  /**
   * 搜索记忆
   */
  searchMemories(query: string, options?: {
    layers?: ('episode' | 'session' | 'extracted')[]
    limit?: number
  }): Memory[] {
    const layers = options?.layers || ['extracted']
    const limit = options?.limit || 5

    let results: Memory[] = []

    // 搜索提取的记忆
    if (layers.includes('extracted')) {
      const extractedResults = this.memoryStore.search(query, limit)
      results.push(...extractedResults)
    }

    return results.slice(0, limit)
  }

  /**
   * 获取统计信息
   */
  getStats(): UnifiedMemoryStats {
    return { ...this.stats }
  }

  /**
   * 获取组件状态
   */
  getComponentStatus(): Record<string, MemoryLayerStatus> {
    return {
      episode: {
        enabled: this.config.layers.episode.enabled,
        count: this.episodes.size,
        lastActivity: this.getLastEpisodeActivity()
      },
      session: {
        enabled: this.config.layers.session.enabled,
        count: this.sessionMemories.size
      },
      process: {
        enabled: this.config.layers.process.enabled,
        count: this.processEvents.length
      },
      extracted: {
        enabled: this.config.layers.extracted.enabled,
        count: this.memoryStore.getAll().length,
        lastActivity: this.autoDream?.getStatus().isRunning ? Date.now() : undefined
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.autoDream) {
      this.autoDream.stop()
    }

    // 清理过期的Episodes
    if (this.config.layers.episode.maxEpisodes) {
      this.cleanupOldEpisodes()
    }

    this.episodes.clear()
    this.sessionMemories.clear()
    this.processEvents = []

    console.log('[UnifiedMemoryManager] Cleanup completed')
  }

  // ── 辅助方法 ──

  private findEpisodeByTask(taskId: string): Episode | undefined {
    for (const episode of this.episodes.values()) {
      if (episode.taskId === taskId) {
        return episode
      }
    }
    return undefined
  }

  private extractToolEvents(messages: Message[]): ToolEvent[] {
    const toolEvents: ToolEvent[] = []

    for (const message of messages) {
      if (message.role === 'tool' && message.toolCallId) {
        const event: ToolEvent = {
          eventId: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          toolName: 'unknown',
          type: 'tool_result',
          output: message.content,
          timestamp: Date.now(),
          success: true
        }
        toolEvents.push(event)
      }
    }

    return toolEvents
  }

  private generateSessionSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const toolMessages = messages.filter(m => m.role === 'tool')

    return `Session Summary:
- Total messages: ${messages.length}
- User messages: ${userMessages.length}
- Assistant messages: ${assistantMessages.length}
- Tool calls: ${toolMessages.length}
- Last user query: ${userMessages[userMessages.length - 1]?.content?.toString().slice(0, 100) || 'None'}`
  }

  private getLastEpisodeActivity(): number | undefined {
    if (this.episodes.size === 0) return undefined

    let lastActivity = 0
    for (const episode of this.episodes.values()) {
      if (episode.completedAt > lastActivity) {
        lastActivity = episode.completedAt
      }
    }
    return lastActivity > 0 ? lastActivity : undefined
  }

  private cleanupOldEpisodes(): void {
    const maxEpisodes = this.config.layers.episode.maxEpisodes || 100
    if (this.episodes.size <= maxEpisodes) return

    const episodes = Array.from(this.episodes.values())
    episodes.sort((a, b) => b.completedAt - a.completedAt) // 按完成时间降序

    const toRemove = episodes.slice(maxEpisodes)
    for (const episode of toRemove) {
      this.episodes.delete(episode.episodeId)
    }

    console.log(`[UnifiedMemoryManager] Cleaned up ${toRemove.length} old episodes`)
  }

  // ── 公共方法 ──

  /**
   * 获取记忆存储实例
   */
  getMemoryStore(): MemoryStore {
    return this.memoryStore
  }

  /**
   * 获取Episode
   */
  getEpisode(episodeId: string): Episode | undefined {
    return this.episodes.get(episodeId)
  }

  /**
   * 获取所有Episodes
   */
  getAllEpisodes(): Episode[] {
    return Array.from(this.episodes.values())
  }

  /**
   * 获取Session记忆
   */
  getSessionMemory(sessionId: string): string | undefined {
    return this.sessionMemories.get(sessionId)
  }

  /**
   * 获取Process事件
   */
  getProcessEvents(limit?: number): RuntimeStateEvent[] {
    const events = [...this.processEvents]
    if (limit && limit > 0) {
      return events.slice(-limit)
    }
    return events
  }
}

// ── 工厂函数 ──

/**
 * 创建Unified Memory Manager实例
 */
export function createUnifiedMemoryManager(config?: Partial<UnifiedMemoryConfig>): UnifiedMemoryManager {
  return new UnifiedMemoryManager(config)
}

/**
 * 创建默认配置的Unified Memory Manager
 */
export function createDefaultUnifiedMemoryManager(): UnifiedMemoryManager {
  return createUnifiedMemoryManager()
}
