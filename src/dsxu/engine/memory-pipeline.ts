/**
 * Memory Pipeline - 记忆处理流水线
 *
 * 统一管理 Compact / Brief / Classify 流水线：
 * 1. Compact - 上下文压缩摘要
 * 2. Brief - 简短任务摘要
 * 3. Classify - 记忆分类和标签
 *
 * 与 Memory Registry 集成，提供端到端的记忆处理
 */

import type { Message, LLMCallFn } from './types'
import type { Episode } from './episode-memory'
import type { Memory } from './memory-extractor'
import type { SessionMeta } from './session-state'
import type { Task } from './task-queue'
import type { MemoryRegistry, MemoryRecord, MemoryType } from './memory-registry'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../utils/model/deepseekV4Control'

// ── 流水线配置 ──

export interface PipelineConfig {
  /** 是否启用Compact流水线 */
  compactEnabled: boolean
  /** Compact触发的最小消息数 */
  compactMinMessages: number
  /** Compact触发的最小token数 */
  compactMinTokens: number
  /** Compact模型 */
  compactModel: string

  /** 是否启用Brief流水线 */
  briefEnabled: boolean
  /** Brief触发条件：任务完成时 */
  briefOnTaskComplete: boolean
  /** Brief触发条件：会话结束时 */
  briefOnSessionEnd: boolean
  /** Brief模型 */
  briefModel: string

  /** 是否启用Classify流水线 */
  classifyEnabled: boolean
  /** 自动分类提取的记忆 */
  classifyExtractedMemories: boolean
  /** 分类模型 */
  classifyModel: string

  /** 性能配置 */
  performance: {
    /** 批量处理大小 */
    batchSize: number
    /** 处理超时（毫秒） */
    timeoutMs: number
    /** 最大重试次数 */
    maxRetries: number
  }
}

export const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  compactEnabled: true,
  compactMinMessages: 20,
  compactMinTokens: 8000,
  compactModel: DEEPSEEK_V4_FLASH_MODEL,

  briefEnabled: true,
  briefOnTaskComplete: true,
  briefOnSessionEnd: true,
  briefModel: DEEPSEEK_V4_FLASH_MODEL,

  classifyEnabled: true,
  classifyExtractedMemories: true,
  classifyModel: DEEPSEEK_V4_FLASH_MODEL,

  performance: {
    batchSize: 10,
    timeoutMs: 30000,
    maxRetries: 3,
  },
}

// ── 流水线结果 ──

export interface PipelineResult {
  /** 流水线类型 */
  type: 'compact' | 'brief' | 'classify'
  /** 是否成功 */
  success: boolean
  /** 生成的记忆ID */
  memoryIds: string[]
  /** 处理耗时（毫秒） */
  durationMs: number
  /** 错误信息 */
  error?: string
  /** 统计信息 */
  stats: {
    inputCount: number
    outputCount: number
    skippedCount: number
  }
}

export interface CompactResult extends PipelineResult {
  type: 'compact'
  /** 压缩摘要 */
  summary: string
  /** 原始消息数 */
  originalMessageCount: number
  /** 压缩后消息数 */
  compressedMessageCount: number
}

export interface BriefResult extends PipelineResult {
  type: 'brief'
  /** 简短摘要 */
  brief: string
  /** 摘要长度 */
  length: number
  /** 覆盖的任务/会话ID */
  targetId: string
}

export interface ClassifyResult extends PipelineResult {
  type: 'classify'
  /** 分类的记忆ID */
  classifiedMemoryIds: string[]
  /** 新增的标签 */
  addedTags: Record<string, string[]>
  /** 更新的重要性分数 */
  updatedImportance: Record<string, number>
}

// ── 流水线处理器 ──

export interface PipelineProcessor {
  /** 处理器名称 */
  name: string
  /** 处理器描述 */
  description: string
  /** 处理函数 */
  process: (input: any, context: PipelineContext) => Promise<any>
  /** 是否启用 */
  enabled: boolean
}

// ── 流水线上下文 ──

export interface PipelineContext {
  /** 会话ID */
  sessionId: string
  /** 任务ID（可选） */
  taskId?: string
  /** Episode ID（可选） */
  episodeId?: string
  /** LLM调用函数 */
  llmCall?: LLMCallFn
  /** Memory Registry实例 */
  memoryRegistry: MemoryRegistry
  /** 工作目录 */
  cwd: string
  /** 配置 */
  config: PipelineConfig
}

// ── Memory Pipeline 核心类 ──

export class MemoryPipeline {
  private config: PipelineConfig
  private memoryRegistry: MemoryRegistry
  private processors: Map<string, PipelineProcessor> = new Map()

  constructor(memoryRegistry: MemoryRegistry, config?: Partial<PipelineConfig>) {
    this.memoryRegistry = memoryRegistry
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config }

    // 注册内置处理器
    this.registerBuiltinProcessors()
  }

  // ── 配置管理 ──

  /**
   * 更新配置
   */
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): PipelineConfig {
    return { ...this.config }
  }

  // ── 处理器管理 ──

  /**
   * 注册处理器
   */
  registerProcessor(processor: PipelineProcessor): void {
    this.processors.set(processor.name, processor)
  }

  /**
   * 启用/禁用处理器
   */
  setProcessorEnabled(name: string, enabled: boolean): boolean {
    const processor = this.processors.get(name)
    if (!processor) return false

    processor.enabled = enabled
    return true
  }

  /**
   * 获取处理器状态
   */
  getProcessorStatus(): Array<{ name: string; enabled: boolean; description: string }> {
    return Array.from(this.processors.values()).map(p => ({
      name: p.name,
      enabled: p.enabled,
      description: p.description,
    }))
  }

  // ── 流水线执行 ──

  /**
   * 运行Compact流水线
   */
  async runCompact(
    messages: Message[],
    context: Omit<PipelineContext, 'config' | 'memoryRegistry'>
  ): Promise<CompactResult> {
    const startTime = Date.now()
    const result: CompactResult = {
      type: 'compact',
      success: false,
      memoryIds: [],
      durationMs: 0,
      stats: {
        inputCount: messages.length,
        outputCount: 0,
        skippedCount: 0,
      },
      summary: '',
      originalMessageCount: messages.length,
      compressedMessageCount: 0,
    }

    try {
      // 检查是否启用
      if (!this.config.compactEnabled) {
        result.error = 'Compact流水线未启用'
        result.stats.skippedCount = messages.length
        return result
      }

      // 检查触发条件
      if (messages.length < this.config.compactMinMessages) {
        result.error = `消息数量不足：${messages.length} < ${this.config.compactMinMessages}`
        result.stats.skippedCount = messages.length
        return result
      }

      // 估算token数（简化实现）
      const estimatedTokens = this.estimateTokens(messages)
      if (estimatedTokens < this.config.compactMinTokens) {
        result.error = `Token数量不足：${estimatedTokens} < ${this.config.compactMinTokens}`
        result.stats.skippedCount = messages.length
        return result
      }

      // 创建完整上下文
      const pipelineContext: PipelineContext = {
        ...context,
        memoryRegistry: this.memoryRegistry,
        config: this.config,
      }

      // 运行Compact处理器
      const processor = this.processors.get('compact')
      if (!processor || !processor.enabled) {
        result.error = 'Compact处理器未找到或未启用'
        return result
      }

      const compactResult = await processor.process(
        { messages, estimatedTokens },
        pipelineContext
      )

      if (!compactResult.success) {
        result.error = compactResult.error || 'Compact处理失败'
        return result
      }

      // 注册压缩摘要到Memory Registry
      const memoryId = this.memoryRegistry.registerCompactSummary(
        context.sessionId,
        compactResult.summary,
        compactResult.files || []
      )

      result.success = true
      result.memoryIds = [memoryId]
      result.summary = compactResult.summary
      result.compressedMessageCount = compactResult.compressedMessageCount || 1
      result.stats.outputCount = 1

    } catch (error: any) {
      result.error = error.message || 'Compact流水线执行异常'
    } finally {
      result.durationMs = Date.now() - startTime
    }

    return result
  }

  /**
   * 运行Brief流水线
   */
  async runBrief(
    target: { type: 'task'; task: Task } | { type: 'session'; session: SessionMeta } | { type: 'episode'; episode: Episode },
    context: Omit<PipelineContext, 'config' | 'memoryRegistry'>
  ): Promise<BriefResult> {
    const startTime = Date.now()
    const result: BriefResult = {
      type: 'brief',
      success: false,
      memoryIds: [],
      durationMs: 0,
      stats: {
        inputCount: 1,
        outputCount: 0,
        skippedCount: 0,
      },
      brief: '',
      length: 0,
      targetId: '',
    }

    try {
      // 检查是否启用
      if (!this.config.briefEnabled) {
        result.error = 'Brief流水线未启用'
        result.stats.skippedCount = 1
        return result
      }

      // 检查触发条件
      if (target.type === 'task' && !this.config.briefOnTaskComplete) {
        result.error = '任务完成时Brief未启用'
        result.stats.skippedCount = 1
        return result
      }

      if (target.type === 'session' && !this.config.briefOnSessionEnd) {
        result.error = '会话结束时Brief未启用'
        result.stats.skippedCount = 1
        return result
      }

      // 创建完整上下文
      const pipelineContext: PipelineContext = {
        ...context,
        memoryRegistry: this.memoryRegistry,
        config: this.config,
      }

      // 运行Brief处理器
      const processor = this.processors.get('brief')
      if (!processor || !processor.enabled) {
        result.error = 'Brief处理器未找到或未启用'
        return result
      }

      const briefResult = await processor.process(target, pipelineContext)

      if (!briefResult.success) {
        result.error = briefResult.error || 'Brief处理失败'
        return result
      }

      // 注册简短摘要到Memory Registry
      let memoryId: string
      if (target.type === 'task') {
        memoryId = this.memoryRegistry.registerBriefSummary(
          context.sessionId,
          briefResult.brief,
          target.task.id
        )
        result.targetId = target.task.id
      } else if (target.type === 'session') {
        memoryId = this.memoryRegistry.registerBriefSummary(
          context.sessionId,
          briefResult.brief
        )
        result.targetId = target.session.id
      } else {
        memoryId = this.memoryRegistry.registerBriefSummary(
          context.sessionId,
          briefResult.brief,
          target.episode.taskId
        )
        result.targetId = target.episode.episodeId
      }

      result.success = true
      result.memoryIds = [memoryId]
      result.brief = briefResult.brief
      result.length = briefResult.brief.length
      result.stats.outputCount = 1

    } catch (error: any) {
      result.error = error.message || 'Brief流水线执行异常'
    } finally {
      result.durationMs = Date.now() - startTime
    }

    return result
  }

  /**
   * 运行Classify流水线
   */
  async runClassify(
    memoryIds: string[],
    context: Omit<PipelineContext, 'config' | 'memoryRegistry'>
  ): Promise<ClassifyResult> {
    const startTime = Date.now()
    const result: ClassifyResult = {
      type: 'classify',
      success: false,
      memoryIds: [],
      durationMs: 0,
      stats: {
        inputCount: memoryIds.length,
        outputCount: 0,
        skippedCount: 0,
      },
      classifiedMemoryIds: [],
      addedTags: {},
      updatedImportance: {},
    }

    try {
      // 检查是否启用
      if (!this.config.classifyEnabled) {
        result.error = 'Classify流水线未启用'
        result.stats.skippedCount = memoryIds.length
        return result
      }

      // 批量处理
      const batchSize = this.config.performance.batchSize
      const batches: string[][] = []

      for (let i = 0; i < memoryIds.length; i += batchSize) {
        batches.push(memoryIds.slice(i, i + batchSize))
      }

      // 创建完整上下文
      const pipelineContext: PipelineContext = {
        ...context,
        memoryRegistry: this.memoryRegistry,
        config: this.config,
      }

      // 运行Classify处理器
      const processor = this.processors.get('classify')
      if (!processor || !processor.enabled) {
        result.error = 'Classify处理器未找到或未启用'
        return result
      }

      const allResults: any[] = []

      for (const batch of batches) {
        const batchResult = await processor.process({ memoryIds: batch }, pipelineContext)
        allResults.push(batchResult)

        if (batchResult.success) {
          result.classifiedMemoryIds.push(...batchResult.classifiedMemoryIds || [])
          Object.assign(result.addedTags, batchResult.addedTags || {})
          Object.assign(result.updatedImportance, batchResult.updatedImportance || {})
        }
      }

      result.success = result.classifiedMemoryIds.length > 0
      result.memoryIds = result.classifiedMemoryIds
      result.stats.outputCount = result.classifiedMemoryIds.length

      if (!result.success) {
        result.error = '未成功分类任何记忆'
      }

    } catch (error: any) {
      result.error = error.message || 'Classify流水线执行异常'
    } finally {
      result.durationMs = Date.now() - startTime
    }

    return result
  }

  /**
   * 自动处理提取的记忆
   */
  async processExtractedMemories(
    memories: Memory[],
    sessionId: string,
    context: Omit<PipelineContext, 'config' | 'memoryRegistry'>
  ): Promise<{
    registeredIds: string[]
    classifyResult?: ClassifyResult
  }> {
    const registeredIds: string[] = []

    try {
      // 注册所有提取的记忆
      for (const memory of memories) {
        const memoryId = this.memoryRegistry.registerExtractedMemory(memory, sessionId)
        registeredIds.push(memoryId)
      }

      // 自动分类
      let classifyResult: ClassifyResult | undefined
      if (this.config.classifyEnabled && this.config.classifyExtractedMemories && registeredIds.length > 0) {
        classifyResult = await this.runClassify(registeredIds, context)
      }

      return {
        registeredIds,
        classifyResult,
      }

    } catch (error: any) {
      console.warn(`[MemoryPipeline] 处理提取的记忆失败: ${error.message}`)
      return {
        registeredIds,
        classifyResult: undefined,
      }
    }
  }

  // ── 私有方法 ──

  private registerBuiltinProcessors(): void {
    // Compact处理器（简化实现）
    this.registerProcessor({
      name: 'compact',
      description: '上下文压缩摘要处理器',
      enabled: true,
      process: async (input: { messages: Message[]; estimatedTokens: number }, context: PipelineContext) => {
        const { messages, estimatedTokens } = input

        // 简化实现：取最后N条消息作为摘要
        const keepCount = Math.min(5, Math.floor(messages.length * 0.2))
        const recentMessages = messages.slice(-keepCount)

        // 生成简单摘要
        const summary = this.generateSimpleSummary(recentMessages)

        return {
          success: true,
          summary,
          compressedMessageCount: keepCount,
          files: this.extractFilesFromMessages(messages),
        }
      },
    })

    // Brief处理器（简化实现）
    this.registerProcessor({
      name: 'brief',
      description: '简短摘要处理器',
      enabled: true,
      process: async (input: any, context: PipelineContext) => {
        let brief = ''

        if (input.type === 'task') {
          const task = input.task
          brief = `任务 "${task.name}" ${task.status === 'completed' ? '完成' : '失败'}，创建于 ${new Date(task.createdAt).toLocaleString()}`
        } else if (input.type === 'session') {
          const session = input.session
          brief = `会话 "${session.title}" ${session.status === 'completed' ? '完成' : '进行中'}，${session.messageCount} 条消息`
        } else if (input.type === 'episode') {
          const episode = input.episode
          brief = `Episode ${episode.episodeId} ${episode.finalOutcome}，${episode.toolEvents.length} 个工具事件`
        }

        return {
          success: true,
          brief,
        }
      },
    })

    // Classify处理器（简化实现）
    this.registerProcessor({
      name: 'classify',
      description: '记忆分类处理器',
      enabled: true,
      process: async (input: { memoryIds: string[] }, context: PipelineContext) => {
        const { memoryIds } = input
        const classifiedMemoryIds: string[] = []
        const addedTags: Record<string, string[]> = {}
        const updatedImportance: Record<string, number> = {}

        for (const memoryId of memoryIds) {
          const memory = context.memoryRegistry.get(memoryId)
          if (!memory) continue

          // 简单分类逻辑
          const tags = this.classifyMemory(memory)
          const importance = this.calculateImportance(memory)

          // 记录结果
          classifiedMemoryIds.push(memoryId)
          addedTags[memoryId] = tags
          updatedImportance[memoryId] = importance
        }

        return {
          success: classifiedMemoryIds.length > 0,
          classifiedMemoryIds,
          addedTags,
          updatedImportance,
        }
      },
    })
  }

  private estimateTokens(messages: Message[]): number {
    // 简化实现：按字符数估算
    let totalChars = 0
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        totalChars += msg.content.length
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.text) totalChars += block.text.length
          if (block.thinking) totalChars += block.thinking.length
        }
      }
    }
    // 粗略估算：1 token ≈ 4 characters
    return Math.ceil(totalChars / 4)
  }

  private generateSimpleSummary(messages: Message[]): string {
    const summaries: string[] = []

    for (const msg of messages) {
      if (msg.role === 'user') {
        const content = typeof msg.content === 'string' ? msg.content : '用户消息'
        summaries.push(`用户: ${content.slice(0, 100)}...`)
      } else if (msg.role === 'assistant') {
        summaries.push('助手回复')
      }
    }

    return `对话摘要（${messages.length} 条消息）:\n${summaries.join('\n')}`
  }

  private extractFilesFromMessages(messages: Message[]): string[] {
    const files = new Set<string>()

    // 简化实现：从消息内容中提取可能的文件路径
    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      // 简单正则匹配文件路径模式
      const fileMatches = content.match(/(\/[^/\s]+\/)*[^/\s]+\.(ts|js|tsx|jsx|json|md|txt|yml|yaml)/g)
      if (fileMatches) {
        fileMatches.forEach(file => files.add(file))
      }
    }

    return Array.from(files)
  }

  private classifyMemory(memory: MemoryRecord): string[] {
    const tags: string[] = []

    // 根据类型添加标签
    tags.push(`type:${memory.type}`)

    // 根据质量添加标签
    const quality = memory.metadata.quality || 0
    if (quality >= 0.8) {
      tags.push('quality:high')
    } else if (quality >= 0.5) {
      tags.push('quality:medium')
    } else {
      tags.push('quality:low')
    }

    // 根据重要性添加标签
    const importance = memory.metadata.importance || 50
    if (importance >= 80) {
      tags.push('importance:critical')
    } else if (importance >= 60) {
      tags.push('importance:high')
    } else if (importance >= 40) {
      tags.push('importance:medium')
    } else {
      tags.push('importance:low')
    }

    // 添加文件相关标签
    if (memory.metadata.files.length > 0) {
      tags.push('has:files')
    }

    return tags
  }

  private calculateImportance(memory: MemoryRecord): number {
    let importance = memory.metadata.importance || 50

    // 根据类型调整
    switch (memory.type) {
      case 'episode':
        importance += 10
        break
      case 'extracted':
        importance += 5
        break
      case 'compact':
        importance -= 5
        break
      case 'brief':
        importance -= 10
        break
    }

    // 根据质量调整
    const quality = memory.metadata.quality || 0
    importance += quality * 20

    // 根据文件数量调整
    importance += Math.min(memory.metadata.files.length * 2, 10)

    return Math.max(0, Math.min(100, importance))
  }
}

// ── 工具函数 ──

/**
 * 创建默认Memory Pipeline
 */
export function createDefaultMemoryPipeline(memoryRegistry?: MemoryRegistry): MemoryPipeline {
  const registry = memoryRegistry || require('./memory-registry').getDefaultMemoryRegistry()
  return new MemoryPipeline(registry)
}
