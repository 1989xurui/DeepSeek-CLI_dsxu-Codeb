/**
 * Episode Memory - Episode记忆
 *
 * 记录完整的任务执行过程，包括工具调用、决策、结果等
 */

import fs from 'fs/promises'
import path from 'path'
import { EventEmitter } from 'events'

import type { MemoryRegistry } from './memory-registry'
import type { Episode, EpisodeEvent, EpisodeOutcome } from './types'
import type { Message, ToolCall, ToolResult } from '../types'

// ── 接口定义 ──

export interface EpisodeMemoryOptions {
  /** 存储路径（可选，默认使用registry的路径） */
  storagePath?: string
  /** 是否自动保存 */
  autoSave?: boolean
  /** 保存间隔（毫秒） */
  saveInterval?: number
  /** 最大Episode数量 */
  maxEpisodes?: number
}

export interface EpisodeStartOptions {
  /** Episode标题 */
  title: string
  /** Episode描述 */
  description?: string
  /** 关联的任务ID */
  taskId: string
  /** 关联的会话ID */
  sessionId: string
  /** 初始文件列表 */
  initialFiles?: string[]
  /** 自定义元数据 */
  metadata?: {
    complexity?: number
    difficulty?: number
    value?: number
    tags?: string[]
  }
}

export interface EpisodeStats {
  /** 总Episode数 */
  total: number
  /** 按结果统计 */
  byOutcome: Record<EpisodeOutcome, number>
  /** 平均工具调用数 */
  avgToolCalls: number
  /** 平均持续时间（毫秒） */
  avgDuration: number
  /** 成功率 */
  successRate: number
}

// ── 事件类型 ──

export interface EpisodeMemoryEvents {
  'episode-started': (episodeId: string, options: EpisodeStartOptions) => void
  'episode-ended': (episodeId: string, outcome: EpisodeOutcome) => void
  'event-recorded': (episodeId: string, event: EpisodeEvent) => void
  'decision-recorded': (episodeId: string, decision: string) => void
  'lesson-learned': (episodeId: string, lesson: string) => void
  'file-added': (episodeId: string, filePath: string) => void
  'error': (error: Error) => void
}

// ── 主类 ──

export class EpisodeMemory extends EventEmitter {
  private memoryRegistry: MemoryRegistry
  private options: EpisodeMemoryOptions
  private episodes: Map<string, Episode>
  private activeEpisodes: Set<string>
  private saveTimer?: NodeJS.Timeout
  private storagePath: string

  constructor(memoryRegistry: MemoryRegistry, options?: EpisodeMemoryOptions) {
    super()
    this.memoryRegistry = memoryRegistry
    this.options = {
      autoSave: true,
      saveInterval: 30000, // 30秒
      maxEpisodes: 100,
      ...options,
    }
    this.episodes = new Map()
    this.activeEpisodes = new Set()
    this.storagePath = options?.storagePath || path.join(memoryRegistry['storagePath'], 'episodes')
  }

  // ── 初始化 ──

  async initialize(): Promise<void> {
    try {
      // 确保存储目录存在
      await fs.mkdir(this.storagePath, { recursive: true })

      // 加载现有Episode
      await this.loadEpisodes()

      // 启动自动保存
      if (this.options.autoSave) {
        this.startAutoSave()
      }

      console.log(`EpisodeMemory initialized at ${this.storagePath}`)
    } catch (error) {
      console.error('Failed to initialize EpisodeMemory:', error)
      throw error
    }
  }

  async destroy(): Promise<void> {
    // 停止自动保存
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = undefined
    }

    // 保存所有Episode
    await this.saveEpisodes()

    console.log('EpisodeMemory destroyed')
  }

  // ── Episode生命周期 ──

  startEpisode(options: EpisodeStartOptions): string {
    const episodeId = this.generateEpisodeId()
    const now = Date.now()

    const episode: Episode = {
      episodeId,
      taskId: options.taskId,
      sessionId: options.sessionId,
      title: options.title,
      description: options.description || '',
      startTime: now,
      endTime: undefined,
      finalOutcome: 'partial_success', // 初始状态
      toolEvents: [],
      keyDecisions: [],
      lessonsLearned: [],
      files: options.initialFiles || [],
      metadata: {
        complexity: options.metadata?.complexity || 5,
        difficulty: options.metadata?.difficulty || 5,
        value: options.metadata?.value || 5,
        tags: options.metadata?.tags || [],
      },
    }

    // 存储Episode
    this.episodes.set(episodeId, episode)
    this.activeEpisodes.add(episodeId)

    // 触发事件
    this.emit('episode-started', episodeId, options)

    // 异步保存
    if (this.options.autoSave) {
      this.saveEpisodes().catch(error => {
        this.emit('error', error)
      })
    }

    return episodeId
  }

  endEpisode(episodeId: string, outcome: EpisodeOutcome): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    // 更新Episode
    episode.endTime = Date.now()
    episode.finalOutcome = outcome

    // 从活跃集合中移除
    this.activeEpisodes.delete(episodeId)

    // 触发事件
    this.emit('episode-ended', episodeId, outcome)

    // 保存到记忆注册表
    this.saveToMemoryRegistry(episode)

    // 异步保存
    if (this.options.autoSave) {
      this.saveEpisodes().catch(error => {
        this.emit('error', error)
      })
    }

    return true
  }

  // ── 事件记录 ──

  recordToolCall(
    episodeId: string,
    toolCall: ToolCall,
    result?: ToolResult
  ): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    const event: EpisodeEvent = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: {
        tool: toolCall.name,
        input: toolCall.input,
        result: result?.output,
        success: result?.success,
      },
    }

    episode.toolEvents.push(event)

    // 触发事件
    this.emit('event-recorded', episodeId, event)

    return true
  }

  recordMessage(episodeId: string, message: Message): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    const event: EpisodeEvent = {
      type: 'message',
      timestamp: Date.now(),
      data: {
        role: message.role,
        content: message.content.substring(0, 500), // 截断长消息
      },
    }

    episode.toolEvents.push(event)

    // 触发事件
    this.emit('event-recorded', episodeId, event)

    return true
  }

  recordDecision(episodeId: string, decision: string): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    episode.keyDecisions.push(decision)

    // 触发事件
    this.emit('decision-recorded', episodeId, decision)

    return true
  }

  recordError(episodeId: string, error: Error | string): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    const event: EpisodeEvent = {
      type: 'error',
      timestamp: Date.now(),
      data: {
        message: typeof error === 'string' ? error : error.message,
        stack: typeof error === 'object' ? error.stack : undefined,
      },
    }

    episode.toolEvents.push(event)

    // 触发事件
    this.emit('event-recorded', episodeId, event)

    return true
  }

  addLessonLearned(episodeId: string, lesson: string): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    episode.lessonsLearned.push(lesson)

    // 触发事件
    this.emit('lesson-learned', episodeId, lesson)

    return true
  }

  addFile(episodeId: string, filePath: string): boolean {
    const episode = this.episodes.get(episodeId)
    if (!episode || !this.activeEpisodes.has(episodeId)) {
      return false
    }

    if (!episode.files.includes(filePath)) {
      episode.files.push(filePath)

      // 触发事件
      this.emit('file-added', episodeId, filePath)

      return true
    }

    return false
  }

  // ── 查询方法 ──

  getEpisode(episodeId: string): Episode | null {
    return this.episodes.get(episodeId) || null
  }

  getActiveEpisodes(): Episode[] {
    return Array.from(this.activeEpisodes)
      .map(id => this.episodes.get(id))
      .filter(Boolean) as Episode[]
  }

  getEpisodesByTask(taskId: string): Episode[] {
    return Array.from(this.episodes.values())
      .filter(episode => episode.taskId === taskId)
  }

  getEpisodesBySession(sessionId: string): Episode[] {
    return Array.from(this.episodes.values())
      .filter(episode => episode.sessionId === sessionId)
  }

  getEpisodesByOutcome(outcome: EpisodeOutcome): Episode[] {
    return Array.from(this.episodes.values())
      .filter(episode => episode.finalOutcome === outcome)
  }

  searchEpisodes(query: string): Episode[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.episodes.values())
      .filter(episode =>
        episode.title.toLowerCase().includes(lowerQuery) ||
        episode.description.toLowerCase().includes(lowerQuery) ||
        episode.keyDecisions.some(decision => decision.toLowerCase().includes(lowerQuery)) ||
        episode.lessonsLearned.some(lesson => lesson.toLowerCase().includes(lowerQuery))
      )
  }

  // ── 统计方法 ──

  getStats(): EpisodeStats {
    const episodes = Array.from(this.episodes.values())

    const byOutcome: Record<EpisodeOutcome, number> = {
      success: 0,
      partial_success: 0,
      failure: 0,
      abandoned: 0,
    }

    let totalToolCalls = 0
    let totalDuration = 0
    let completedCount = 0

    for (const episode of episodes) {
      // 按结果统计
      byOutcome[episode.finalOutcome]++

      // 统计工具调用
      totalToolCalls += episode.toolEvents.filter(e => e.type === 'tool_call').length

      // 统计持续时间（仅限已完成的Episode）
      if (episode.endTime) {
        totalDuration += episode.endTime - episode.startTime
        completedCount++
      }
    }

    const successCount = byOutcome.success
    const totalCompleted = episodes.filter(e => e.endTime).length

    return {
      total: episodes.length,
      byOutcome,
      avgToolCalls: episodes.length > 0 ? totalToolCalls / episodes.length : 0,
      avgDuration: completedCount > 0 ? totalDuration / completedCount : 0,
      successRate: totalCompleted > 0 ? successCount / totalCompleted : 0,
    }
  }

  // ── 持久化 ──

  private async loadEpisodes(): Promise<void> {
    try {
      const indexPath = path.join(this.storagePath, 'index.json')
      if (!await this.fileExists(indexPath)) {
        return
      }

      const data = await fs.readFile(indexPath, 'utf-8')
      const episodes = JSON.parse(data)

      if (Array.isArray(episodes)) {
        for (const episode of episodes) {
          if (this.isValidEpisode(episode)) {
            this.episodes.set(episode.episodeId, episode)

            // 恢复活跃状态
            if (!episode.endTime) {
              this.activeEpisodes.add(episode.episodeId)
            }
          }
        }
      }

      console.log(`Loaded ${this.episodes.size} episodes from storage`)
    } catch (error) {
      console.error('Failed to load episodes:', error)
      throw error
    }
  }

  private async saveEpisodes(): Promise<void> {
    try {
      // 确保目录存在
      await fs.mkdir(this.storagePath, { recursive: true })

      // 保存索引
      const episodes = Array.from(this.episodes.values())
      const indexPath = path.join(this.storagePath, 'index.json')
      await fs.writeFile(indexPath, JSON.stringify(episodes, null, 2), 'utf-8')

      // 保存统计信息
      const stats = this.getStats()
      const statsPath = path.join(this.storagePath, 'stats.json')
      await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save episodes:', error)
      throw error
    }
  }

  private saveToMemoryRegistry(episode: Episode): void {
    try {
      // 创建Episode记忆
      const memoryContent = this.formatEpisodeMemory(episode)

      this.memoryRegistry.registerMemory({
        id: `episode_${episode.episodeId}`,
        type: 'episode',
        content: memoryContent,
        sessionId: episode.sessionId,
        taskId: episode.taskId,
        episodeId: episode.episodeId,
        metadata: {
          importance: this.calculateEpisodeImportance(episode),
          quality: this.calculateEpisodeQuality(episode),
          files: episode.files,
          tags: [...episode.metadata.tags, `outcome:${episode.finalOutcome}`],
        },
      })
    } catch (error) {
      console.error('Failed to save episode to memory registry:', error)
      this.emit('error', error as Error)
    }
  }

  // ── 辅助方法 ──

  private startAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
    }

    this.saveTimer = setInterval(async () => {
      try {
        await this.saveEpisodes()
      } catch (error) {
        console.error('Auto-save failed:', error)
        this.emit('error', error as Error)
      }
    }, this.options.saveInterval || 30000)
  }

  private generateEpisodeId(): string {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private formatEpisodeMemory(episode: Episode): string {
    const duration = episode.endTime
      ? `${Math.round((episode.endTime - episode.startTime) / 1000)}s`
      : 'ongoing'

    const toolCallCount = episode.toolEvents.filter(e => e.type === 'tool_call').length
    const decisionCount = episode.keyDecisions.length
    const lessonCount = episode.lessonsLearned.length

    return `Episode: ${episode.title}
Outcome: ${episode.finalOutcome}
Duration: ${duration}
Tool Calls: ${toolCallCount}
Key Decisions: ${decisionCount}
Lessons Learned: ${lessonCount}
Files: ${episode.files.length}

Description: ${episode.description}

Key Decisions:
${episode.keyDecisions.map(d => `- ${d}`).join('\n')}

Lessons Learned:
${episode.lessonsLearned.map(l => `- ${l}`).join('\n')}`
  }

  private calculateEpisodeImportance(episode: Episode): number {
    // 基于复杂度、难度、价值和结果计算重要性
    const baseScore = (
      episode.metadata.complexity * 0.3 +
      episode.metadata.difficulty * 0.3 +
      episode.metadata.value * 0.4
    )

    // 结果加成
    const outcomeMultiplier = {
      success: 1.2,
      partial_success: 1.0,
      failure: 0.8,
      abandoned: 0.5,
    }[episode.finalOutcome]

    // 工具调用数量加成
    const toolCallBonus = Math.min(episode.toolEvents.length * 0.5, 20)

    return Math.min(100, Math.round(baseScore * outcomeMultiplier + toolCallBonus))
  }

  private calculateEpisodeQuality(episode: Episode): number {
    // 基于完整性、决策数量、经验数量计算质量
    const hasEndTime = episode.endTime ? 1 : 0
    const hasDecisions = episode.keyDecisions.length > 0 ? 1 : 0
    const hasLessons = episode.lessonsLearned.length > 0 ? 1 : 0

    const completeness = (hasEndTime + hasDecisions + hasLessons) / 3

    // 结果加成
    const outcomeBonus = {
      success: 0.2,
      partial_success: 0.1,
      failure: 0.0,
      abandoned: -0.1,
    }[episode.finalOutcome]

    return Math.min(1, Math.max(0, completeness + outcomeBonus))
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private isValidEpisode(episode: any): episode is Episode {
    return (
      episode &&
      typeof episode.episodeId === 'string' &&
      typeof episode.taskId === 'string' &&
      typeof episode.sessionId === 'string' &&
      typeof episode.title === 'string' &&
      typeof episode.description === 'string' &&
      typeof episode.startTime === 'number' &&
      (episode.endTime === undefined || typeof episode.endTime === 'number') &&
      typeof episode.finalOutcome === 'string' &&
      Array.isArray(episode.toolEvents) &&
      Array.isArray(episode.keyDecisions) &&
      Array.isArray(episode.lessonsLearned) &&
      Array.isArray(episode.files) &&
      episode.metadata &&
      typeof episode.metadata.complexity === 'number' &&
      typeof episode.metadata.difficulty === 'number' &&
      typeof episode.metadata.value === 'number' &&
      Array.isArray(episode.metadata.tags)
    )
  }

  // ── 类型安全的EventEmitter ──

  override on<K extends keyof EpisodeMemoryEvents>(
    event: K,
    listener: EpisodeMemoryEvents[K]
  ): this {
    return super.on(event, listener)
  }

  override once<K extends keyof EpisodeMemoryEvents>(
    event: K,
    listener: EpisodeMemoryEvents[K]
  ): this {
    return super.once(event, listener)
  }

  override emit<K extends keyof EpisodeMemoryEvents>(
    event: K,
    ...args: Parameters<EpisodeMemoryEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }
}