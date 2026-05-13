/**
 * Memory Registry - 记忆注册表
 *
 * 统一管理所有记忆类型：
 * 1. Episode Memory - 任务执行过程记忆
 * 2. Session Memory - 会话级记忆
 * 3. Extracted Memory - 提取的结构化知识
 * 4. Process Memory - 进程级共享记忆
 *
 * 提供统一的存储、检索和管理接口
 */

import type { Episode } from './episode-memory'
import type { Memory } from './memory-extractor'
import type { SessionMeta } from './session-state'
import type { Task } from './task-queue'

// ── 记忆类型定义 ──

export type MemoryType =
  | 'episode'      // 任务执行过程
  | 'session'      // 会话级记忆
  | 'extracted'    // 提取的结构化知识
  | 'process'      // 进程级共享记忆
  | 'compact'      // 压缩摘要
  | 'brief'        // 简短摘要

export interface MemoryRecord {
  /** 记忆ID */
  id: string
  /** 记忆类型 */
  type: MemoryType
  /** 关联的会话ID */
  sessionId: string
  /** 关联的任务ID（可选） */
  taskId?: string
  /** 关联的Episode ID（可选） */
  episodeId?: string
  /** 记忆内容 */
  content: any
  /** 元数据 */
  metadata: {
    /** 创建时间 */
    createdAt: number
    /** 最后更新时间 */
    updatedAt: number
    /** 质量分数 (0-1) */
    quality?: number
    /** 重要性分数 (0-100) */
    importance?: number
    /** 标签 */
    tags: string[]
    /** 关联文件 */
    files: string[]
    /** 自定义字段 */
    custom?: Record<string, any>
  }
}

export interface MemoryStats {
  /** 总记忆数 */
  total: number
  /** 按类型统计 */
  byType: Record<MemoryType, number>
  /** 按会话统计 */
  bySession: Record<string, number>
  /** 质量分布 */
  qualityDistribution: {
    high: number    // quality >= 0.8
    medium: number  // 0.5 <= quality < 0.8
    low: number     // quality < 0.5
  }
  /** 存储大小（估算字节） */
  estimatedSize: number
}

export interface SearchOptions {
  /** 查询关键词 */
  query?: string
  /** 记忆类型过滤 */
  types?: MemoryType[]
  /** 最小质量分数 */
  minQuality?: number
  /** 最小重要性分数 */
  minImportance?: number
  /** 标签过滤 */
  tags?: string[]
  /** 文件过滤 */
  files?: string[]
  /** 会话ID过滤 */
  sessionIds?: string[]
  /** 时间范围过滤 */
  timeRange?: {
    start: number
    end: number
  }
  /** 排序方式 */
  sortBy?: 'relevance' | 'quality' | 'importance' | 'recency'
  /** 返回结果数量限制 */
  limit?: number
  /** 偏移量 */
  offset?: number
}

// ── Memory Registry 核心类 ──

export class MemoryRegistry {
  private memories: Map<string, MemoryRecord> = new Map()
  private sessionIndex: Map<string, Set<string>> = new Map()
  private typeIndex: Map<MemoryType, Set<string>> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  private fileIndex: Map<string, Set<string>> = new Map()

  constructor() {
    // 初始化索引
    const memoryTypes: MemoryType[] = ['episode', 'session', 'extracted', 'process', 'compact', 'brief']
    memoryTypes.forEach(type => {
      this.typeIndex.set(type, new Set())
    })
  }

  // ── 核心操作 ──

  /**
   * 注册记忆
   */
  register(memory: Omit<MemoryRecord, 'id' | 'metadata'> & { metadata?: Partial<MemoryRecord['metadata']> }): string {
    const id = this.generateMemoryId(memory.type)
    const now = Date.now()

    const record: MemoryRecord = {
      id,
      type: memory.type,
      sessionId: memory.sessionId,
      taskId: memory.taskId,
      episodeId: memory.episodeId,
      content: memory.content,
      metadata: {
        createdAt: now,
        updatedAt: now,
        quality: memory.metadata?.quality ?? 0.5,
        importance: memory.metadata?.importance ?? 50,
        tags: memory.metadata?.tags ?? [],
        files: memory.metadata?.files ?? [],
        custom: memory.metadata?.custom ?? {},
      },
    }

    // 存储记忆
    this.memories.set(id, record)

    // 更新索引
    this.updateIndexes(id, record)

    return id
  }

  /**
   * 注册Episode记忆
   */
  registerEpisode(episode: Episode): string {
    return this.register({
      type: 'episode',
      sessionId: episode.sessionId,
      taskId: episode.taskId,
      episodeId: episode.episodeId,
      content: {
        states: episode.states,
        toolEvents: episode.toolEvents,
        finalOutcome: episode.finalOutcome,
        duration: episode.completedAt - episode.startedAt,
        slices: episode.slices,
      },
      metadata: {
        quality: 1.0, // Episode记忆质量最高
        importance: 80,
        tags: ['episode', episode.finalOutcome],
        files: this.extractFilesFromEpisode(episode),
        custom: {
          startedAt: episode.startedAt,
          completedAt: episode.completedAt,
        },
      },
    })
  }

  /**
   * 注册提取的记忆
   */
  registerExtractedMemory(memory: Memory, sessionId: string): string {
    return this.register({
      type: 'extracted',
      sessionId,
      content: {
        title: memory.title,
        content: memory.content,
        type: memory.type,
      },
      metadata: {
        quality: memory.quality,
        importance: this.calculateImportanceFromMemory(memory),
        tags: memory.tags,
        files: memory.files,
        custom: {
          originalId: memory.id,
          timestamp: memory.timestamp,
        },
      },
    })
  }

  /**
   * 注册会话记忆
   */
  registerSessionMemory(session: SessionMeta, summary: string): string {
    return this.register({
      type: 'session',
      sessionId: session.id,
      content: {
        summary,
        title: session.title,
        messageCount: session.messageCount,
        status: session.status,
      },
      metadata: {
        quality: 0.8,
        importance: 70,
        tags: ['session', session.status],
        files: [],
        custom: {
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          totalCost: session.totalCost,
          models: session.models,
        },
      },
    })
  }

  /**
   * 注册压缩摘要
   */
  registerCompactSummary(sessionId: string, summary: string, files: string[] = []): string {
    return this.register({
      type: 'compact',
      sessionId,
      content: {
        summary,
        type: 'compact',
      },
      metadata: {
        quality: 0.7,
        importance: 60,
        tags: ['compact', 'summary'],
        files,
        custom: {
          length: summary.length,
        },
      },
    })
  }

  /**
   * 注册简短摘要
   */
  registerBriefSummary(sessionId: string, brief: string, taskId?: string): string {
    return this.register({
      type: 'brief',
      sessionId,
      taskId,
      content: {
        brief,
        type: 'brief',
      },
      metadata: {
        quality: 0.6,
        importance: 40,
        tags: ['brief', 'summary'],
        files: [],
        custom: {
          length: brief.length,
        },
      },
    })
  }

  // ── 查询操作 ──

  /**
   * 搜索记忆
   */
  search(options: SearchOptions = {}): MemoryRecord[] {
    let candidates = new Set<string>()

    // 按类型过滤
    if (options.types && options.types.length > 0) {
      const typeSets = options.types.map(type => this.typeIndex.get(type) || new Set())
      if (typeSets.length > 0) {
        const typeCandidates = this.intersectSets(typeSets)
        if (candidates.size === 0) {
          candidates = typeCandidates
        } else {
          candidates = this.intersectSets([candidates, typeCandidates])
        }
      }
    }

    // 按会话过滤
    if (options.sessionIds && options.sessionIds.length > 0) {
      const sessionSets = options.sessionIds
        .map(sessionId => this.sessionIndex.get(sessionId) || new Set())
        .filter(set => set.size > 0)

      if (sessionSets.length > 0) {
        const sessionCandidates = this.unionSets(sessionSets)
        if (candidates.size === 0) {
          candidates = sessionCandidates
        } else {
          candidates = this.intersectSets([candidates, sessionCandidates])
        }
      }
    }

    // 按标签过滤
    if (options.tags && options.tags.length > 0) {
      const tagSets = options.tags
        .map(tag => this.tagIndex.get(tag) || new Set())
        .filter(set => set.size > 0)

      if (tagSets.length > 0) {
        const tagCandidates = this.intersectSets(tagSets)
        if (candidates.size === 0) {
          candidates = tagCandidates
        } else {
          candidates = this.intersectSets([candidates, tagCandidates])
        }
      }
    }

    // 如果没有过滤条件，使用所有记忆
    if (candidates.size === 0 && !options.types && !options.sessionIds && !options.tags) {
      candidates = new Set(this.memories.keys())
    }

    // 获取记忆记录并应用其他过滤条件
    let results = Array.from(candidates)
      .map(id => this.memories.get(id)!)
      .filter(record => {
        // 质量过滤
        if (options.minQuality !== undefined && (record.metadata.quality || 0) < options.minQuality) {
          return false
        }

        // 重要性过滤
        if (options.minImportance !== undefined && (record.metadata.importance || 0) < options.minImportance) {
          return false
        }

        // 文件过滤
        if (options.files && options.files.length > 0) {
          const hasFile = options.files.some(file => record.metadata.files.includes(file))
          if (!hasFile) return false
        }

        // 时间范围过滤
        if (options.timeRange) {
          const createdAt = record.metadata.createdAt
          if (createdAt < options.timeRange.start || createdAt > options.timeRange.end) {
            return false
          }
        }

        // 关键词搜索
        if (options.query) {
          const query = options.query.toLowerCase()
          const contentStr = JSON.stringify(record.content).toLowerCase()
          const tagsStr = record.metadata.tags.join(' ').toLowerCase()
          const filesStr = record.metadata.files.join(' ').toLowerCase()

          if (!contentStr.includes(query) && !tagsStr.includes(query) && !filesStr.includes(query)) {
            return false
          }
        }

        return true
      })

    // 排序
    if (options.sortBy) {
      results.sort((a, b) => {
        switch (options.sortBy) {
          case 'quality':
            return (b.metadata.quality || 0) - (a.metadata.quality || 0)
          case 'importance':
            return (b.metadata.importance || 0) - (a.metadata.importance || 0)
          case 'recency':
            return b.metadata.createdAt - a.metadata.createdAt
          case 'relevance':
          default:
            // 简单相关性排序：质量 + 重要性 + 新鲜度
            const scoreA = (a.metadata.quality || 0) * 0.4 + (a.metadata.importance || 0) * 0.4 +
                          (1 - (Date.now() - a.metadata.createdAt) / (1000 * 60 * 60 * 24 * 30)) * 0.2
            const scoreB = (b.metadata.quality || 0) * 0.4 + (b.metadata.importance || 0) * 0.4 +
                          (1 - (Date.now() - b.metadata.createdAt) / (1000 * 60 * 60 * 24 * 30)) * 0.2
            return scoreB - scoreA
        }
      })
    }

    // 分页
    const offset = options.offset || 0
    const limit = options.limit || results.length
    results = results.slice(offset, offset + limit)

    return results
  }

  /**
   * 获取记忆详情
   */
  get(id: string): MemoryRecord | null {
    return this.memories.get(id) || null
  }

  /**
   * 获取会话的所有记忆
   */
  getBySession(sessionId: string, options?: Omit<SearchOptions, 'sessionIds'>): MemoryRecord[] {
    return this.search({
      ...options,
      sessionIds: [sessionId],
    })
  }

  /**
   * 获取任务的所有记忆
   */
  getByTask(taskId: string): MemoryRecord[] {
    return Array.from(this.memories.values())
      .filter(record => record.taskId === taskId)
  }

  /**
   * 获取Episode的所有记忆
   */
  getByEpisode(episodeId: string): MemoryRecord[] {
    return Array.from(this.memories.values())
      .filter(record => record.episodeId === episodeId)
  }

  // ── 统计操作 ──

  /**
   * 获取统计信息
   */
  getStats(): MemoryStats {
    const stats: MemoryStats = {
      total: this.memories.size,
      byType: {} as Record<MemoryType, number>,
      bySession: {},
      qualityDistribution: { high: 0, medium: 0, low: 0 },
      estimatedSize: 0,
    }

    // 按类型统计
    for (const [type, ids] of this.typeIndex.entries()) {
      stats.byType[type] = ids.size
    }

    // 按会话统计和质量分布
    for (const record of this.memories.values()) {
      // 会话统计
      stats.bySession[record.sessionId] = (stats.bySession[record.sessionId] || 0) + 1

      // 质量分布
      const quality = record.metadata.quality || 0
      if (quality >= 0.8) {
        stats.qualityDistribution.high++
      } else if (quality >= 0.5) {
        stats.qualityDistribution.medium++
      } else {
        stats.qualityDistribution.low++
      }

      // 估算大小
      stats.estimatedSize += JSON.stringify(record).length
    }

    return stats
  }

  /**
   * 清理旧记忆
   */
  cleanup(maxAgeDays: number = 30, minImportance: number = 20): number {
    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const toDelete: string[] = []

    for (const [id, record] of this.memories.entries()) {
      const age = Date.now() - record.metadata.createdAt
      const importance = record.metadata.importance || 0

      if (age > cutoff && importance < minImportance) {
        toDelete.push(id)
      }
    }

    toDelete.forEach(id => this.delete(id))
    return toDelete.length
  }

  /**
   * 删除记忆
   */
  delete(id: string): boolean {
    const record = this.memories.get(id)
    if (!record) return false

    // 从索引中移除
    this.removeFromIndexes(id, record)

    // 从存储中移除
    this.memories.delete(id)

    return true
  }

  /**
   * 清空所有记忆
   */
  clear(): void {
    this.memories.clear()
    this.sessionIndex.clear()
    this.tagIndex.clear()
    this.fileIndex.clear()

    // 重置类型索引
    for (const set of this.typeIndex.values()) {
      set.clear()
    }
  }

  // ── 私有方法 ──

  private generateMemoryId(type: MemoryType): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    return `${type}-${timestamp}-${random}`
  }

  private updateIndexes(id: string, record: MemoryRecord): void {
    // 会话索引
    if (!this.sessionIndex.has(record.sessionId)) {
      this.sessionIndex.set(record.sessionId, new Set())
    }
    this.sessionIndex.get(record.sessionId)!.add(id)

    // 类型索引
    this.typeIndex.get(record.type)!.add(id)

    // 标签索引
    for (const tag of record.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(id)
    }

    // 文件索引
    for (const file of record.metadata.files) {
      if (!this.fileIndex.has(file)) {
        this.fileIndex.set(file, new Set())
      }
      this.fileIndex.get(file)!.add(id)
    }
  }

  private removeFromIndexes(id: string, record: MemoryRecord): void {
    // 会话索引
    this.sessionIndex.get(record.sessionId)?.delete(id)

    // 类型索引
    this.typeIndex.get(record.type)?.delete(id)

    // 标签索引
    for (const tag of record.metadata.tags) {
      this.tagIndex.get(tag)?.delete(id)
    }

    // 文件索引
    for (const file of record.metadata.files) {
      this.fileIndex.get(file)?.delete(id)
    }
  }

  private extractFilesFromEpisode(episode: Episode): string[] {
    const files = new Set<string>()

    // 从工具事件中提取文件
    for (const event of episode.toolEvents) {
      if (event.input && typeof event.input === 'object') {
        // 检查常见的文件路径字段
        const pathFields = ['file_path', 'path', 'file', 'filename', 'filePath']
        for (const field of pathFields) {
          if (event.input[field] && typeof event.input[field] === 'string') {
            files.add(event.input[field])
          }
        }
      }
    }

    return Array.from(files)
  }

  private calculateImportanceFromMemory(memory: Memory): number {
    let importance = 50 // 基础分数

    // 根据类型调整
    switch (memory.type) {
      case 'technical_decision':
        importance += 30
        break
      case 'bug_fix':
        importance += 25
        break
      case 'error_solution':
        importance += 20
        break
      case 'project_pattern':
        importance += 15
        break
      case 'user_preference':
        importance += 10
        break
    }

    // 根据质量调整
    importance += memory.quality * 20

    // 根据关联文件数量调整
    importance += Math.min(memory.files.length * 5, 20)

    return Math.min(importance, 100)
  }

  private intersectSets(sets: Set<string>[]): Set<string> {
    if (sets.length === 0) return new Set()
    if (sets.length === 1) return new Set(sets[0])

    const [first, ...rest] = sets
    const result = new Set<string>()

    for (const item of first) {
      if (rest.every(set => set.has(item))) {
        result.add(item)
      }
    }

    return result
  }

  private unionSets(sets: Set<string>[]): Set<string> {
    const result = new Set<string>()
    for (const set of sets) {
      for (const item of set) {
        result.add(item)
      }
    }
    return result
  }
}

// ── 默认实例 ──

let defaultRegistry: MemoryRegistry | null = null

export function getDefaultMemoryRegistry(): MemoryRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new MemoryRegistry()
  }
  return defaultRegistry
}

export function resetDefaultMemoryRegistry(): void {
  defaultRegistry = null
}