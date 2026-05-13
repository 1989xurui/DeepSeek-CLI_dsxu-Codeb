/**
 * Memory Registry - 记忆注册表
 *
 * 负责记忆的存储、检索和管理
 */

import fs from 'fs/promises'
import path from 'path'
import { EventEmitter } from 'events'

import type { MemoryRecord, MemoryType, MemoryMetadata } from './types'

// ── 接口定义 ──

export interface MemoryRegistryOptions {
  /** 存储路径 */
  storagePath: string
  /** 最大记忆数量 */
  maxMemories: number
  /** 自动清理间隔（毫秒） */
  cleanupInterval: number
}

export interface MemoryRegistryStats {
  /** 总记忆数 */
  total: number
  /** 按类型统计 */
  byType: Record<MemoryType, number>
  /** 按会话统计 */
  bySession: Record<string, number>
  /** 按任务统计 */
  byTask: Record<string, number>
  /** 平均重要性 */
  avgImportance: number
  /** 平均质量 */
  avgQuality: number
  /** 存储大小（字节） */
  storageSize: number
}

// ── 事件类型 ──

export interface MemoryRegistryEvents {
  'memory-added': (memory: MemoryRecord) => void
  'memory-updated': (memory: MemoryRecord) => void
  'memory-deleted': (memoryId: string) => void
  'memory-accessed': (memoryId: string) => void
  'cleanup': (removedCount: number) => void
  'error': (error: Error) => void
}

// ── 主类 ──

export class MemoryRegistry extends EventEmitter {
  private options: MemoryRegistryOptions
  private memories: Map<string, MemoryRecord>
  private storagePath: string
  private cleanupTimer?: NodeJS.Timeout
  private isInitialized = false

  constructor(options: MemoryRegistryOptions) {
    super()
    this.options = options
    this.memories = new Map()
    this.storagePath = path.resolve(options.storagePath)
  }

  // ── 初始化 ──

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // 确保存储目录存在
      await fs.mkdir(this.storagePath, { recursive: true })

      // 加载现有记忆
      await this.loadMemories()

      // 启动自动清理
      this.startAutoCleanup()

      this.isInitialized = true
      console.log(`MemoryRegistry initialized at ${this.storagePath}`)
    } catch (error) {
      console.error('Failed to initialize MemoryRegistry:', error)
      throw error
    }
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return
    }

    // 停止自动清理
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }

    // 保存记忆
    await this.saveMemories()

    this.isInitialized = false
    console.log('MemoryRegistry destroyed')
  }

  // ── 记忆管理 ──

  registerMemory(memory: Omit<MemoryRecord, 'metadata'> & { metadata?: Partial<MemoryMetadata> }): MemoryRecord {
    const now = Date.now()

    // 创建完整记忆记录
    const fullMemory: MemoryRecord = {
      ...memory,
      metadata: {
        createdAt: now,
        lastAccessed: now,
        accessCount: 0,
        importance: memory.metadata?.importance || 50,
        quality: memory.metadata?.quality || 0.7,
        files: memory.metadata?.files || [],
        tags: memory.metadata?.tags || [],
        custom: memory.metadata?.custom,
      },
    }

    // 存储记忆
    this.memories.set(fullMemory.id, fullMemory)

    // 触发事件
    this.emit('memory-added', fullMemory)

    // 异步保存
    this.saveMemories().catch(error => {
      this.emit('error', error)
    })

    return fullMemory
  }

  getMemory(memoryId: string): MemoryRecord | null {
    const memory = this.memories.get(memoryId)
    if (memory) {
      // 更新访问时间
      memory.metadata.lastAccessed = Date.now()
      memory.metadata.accessCount++

      // 触发事件
      this.emit('memory-accessed', memoryId)

      // 异步保存
      this.saveMemories().catch(error => {
        this.emit('error', error)
      })
    }
    return memory || null
  }

  updateMemory(memoryId: string, updates: Partial<MemoryRecord>): MemoryRecord | null {
    const existing = this.memories.get(memoryId)
    if (!existing) {
      return null
    }

    // 合并更新
    const updatedMemory: MemoryRecord = {
      ...existing,
      ...updates,
      metadata: {
        ...existing.metadata,
        ...updates.metadata,
      },
    }

    // 更新存储
    this.memories.set(memoryId, updatedMemory)

    // 触发事件
    this.emit('memory-updated', updatedMemory)

    // 异步保存
    this.saveMemories().catch(error => {
      this.emit('error', error)
    })

    return updatedMemory
  }

  delete(memoryId: string): boolean {
    const existed = this.memories.delete(memoryId)
    if (existed) {
      // 触发事件
      this.emit('memory-deleted', memoryId)

      // 异步保存
      this.saveMemories().catch(error => {
        this.emit('error', error)
      })
    }
    return existed
  }

  // ── 查询方法 ──

  getAll(): MemoryRecord[] {
    return Array.from(this.memories.values())
  }

  getByType(type: MemoryType): MemoryRecord[] {
    return Array.from(this.memories.values()).filter(memory => memory.type === type)
  }

  getBySession(sessionId: string): MemoryRecord[] {
    return Array.from(this.memories.values()).filter(memory => memory.sessionId === sessionId)
  }

  getByTask(taskId: string): MemoryRecord[] {
    return Array.from(this.memories.values()).filter(memory => memory.taskId === taskId)
  }

  getByEpisode(episodeId: string): MemoryRecord[] {
    return Array.from(this.memories.values()).filter(memory => memory.episodeId === episodeId)
  }

  searchByContent(query: string): MemoryRecord[] {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.memories.values()).filter(memory =>
      memory.content.toLowerCase().includes(lowerQuery)
    )
  }

  searchByTags(tags: string[]): MemoryRecord[] {
    const tagSet = new Set(tags.map(tag => tag.toLowerCase()))
    return Array.from(this.memories.values()).filter(memory =>
      memory.metadata.tags.some(tag => tagSet.has(tag.toLowerCase()))
    )
  }

  // ── 统计方法 ──

  getStats(): MemoryRegistryStats {
    const memories = this.getAll()

    const byType: Record<MemoryType, number> = {
      episode: 0,
      extracted: 0,
      compact: 0,
      brief: 0,
    }

    const bySession: Record<string, number> = {}
    const byTask: Record<string, number> = {}

    let totalImportance = 0
    let totalQuality = 0

    for (const memory of memories) {
      // 按类型统计
      byType[memory.type] = (byType[memory.type] || 0) + 1

      // 按会话统计
      bySession[memory.sessionId] = (bySession[memory.sessionId] || 0) + 1

      // 按任务统计
      if (memory.taskId) {
        byTask[memory.taskId] = (byTask[memory.taskId] || 0) + 1
      }

      // 累计分数
      totalImportance += memory.metadata.importance
      totalQuality += memory.metadata.quality
    }

    return {
      total: memories.length,
      byType,
      bySession,
      byTask,
      avgImportance: memories.length > 0 ? totalImportance / memories.length : 0,
      avgQuality: memories.length > 0 ? totalQuality / memories.length : 0,
      storageSize: this.calculateStorageSize(),
    }
  }

  // ── 清理方法 ──

  async cleanup(): Promise<number> {
    const memories = this.getAll()
    const now = Date.now()

    // 按重要性、质量和最后访问时间排序
    memories.sort((a, b) => {
      // 计算分数：重要性 * 质量 * 时间衰减
      const scoreA = this.calculateMemoryScore(a, now)
      const scoreB = this.calculateMemoryScore(b, now)
      return scoreA - scoreB // 升序，分数低的先删除
    })

    // 删除多余的记忆
    const toRemove = Math.max(0, memories.length - this.options.maxMemories)
    const removedMemories = memories.slice(0, toRemove)

    for (const memory of removedMemories) {
      this.memories.delete(memory.id)
    }

    // 触发事件
    if (removedMemories.length > 0) {
      this.emit('cleanup', removedMemories.length)
    }

    // 保存
    await this.saveMemories()

    return removedMemories.length
  }

  // ── 持久化 ──

  private async loadMemories(): Promise<void> {
    try {
      const indexPath = path.join(this.storagePath, 'index.json')
      if (!await this.fileExists(indexPath)) {
        return
      }

      const data = await fs.readFile(indexPath, 'utf-8')
      const memories = JSON.parse(data)

      if (Array.isArray(memories)) {
        for (const memory of memories) {
          // 验证记忆格式
          if (this.isValidMemory(memory)) {
            this.memories.set(memory.id, memory)
          }
        }
      }

      console.log(`Loaded ${this.memories.size} memories from storage`)
    } catch (error) {
      console.error('Failed to load memories:', error)
      throw error
    }
  }

  private async saveMemories(): Promise<void> {
    try {
      // 确保目录存在
      await fs.mkdir(this.storagePath, { recursive: true })

      // 保存索引
      const memories = this.getAll()
      const indexPath = path.join(this.storagePath, 'index.json')
      await fs.writeFile(indexPath, JSON.stringify(memories, null, 2), 'utf-8')

      // 保存统计信息
      const stats = this.getStats()
      const statsPath = path.join(this.storagePath, 'stats.json')
      await fs.writeFile(statsPath, JSON.stringify(stats, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save memories:', error)
      throw error
    }
  }

  // ── 辅助方法 ──

  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        const removed = await this.cleanup()
        if (removed > 0) {
          console.log(`Auto-cleanup removed ${removed} memories`)
        }
      } catch (error) {
        console.error('Auto-cleanup failed:', error)
        this.emit('error', error as Error)
      }
    }, this.options.cleanupInterval)
  }

  private calculateMemoryScore(memory: MemoryRecord, now: number): number {
    const ageDays = (now - memory.metadata.createdAt) / (1000 * 60 * 60 * 24)
    const timeDecay = Math.exp(-ageDays / 30) // 30天半衰期

    return (
      memory.metadata.importance *
      memory.metadata.quality *
      timeDecay *
      (1 / (1 + Math.log(1 + memory.metadata.accessCount)))
    )
  }

  private calculateStorageSize(): number {
    const memories = this.getAll()
    const jsonString = JSON.stringify(memories)
    return Buffer.byteLength(jsonString, 'utf-8')
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private isValidMemory(memory: any): memory is MemoryRecord {
    return (
      memory &&
      typeof memory.id === 'string' &&
      typeof memory.type === 'string' &&
      typeof memory.content === 'string' &&
      memory.metadata &&
      typeof memory.metadata.createdAt === 'number' &&
      typeof memory.metadata.lastAccessed === 'number' &&
      typeof memory.metadata.accessCount === 'number' &&
      typeof memory.metadata.importance === 'number' &&
      typeof memory.metadata.quality === 'number' &&
      Array.isArray(memory.metadata.files) &&
      Array.isArray(memory.metadata.tags) &&
      typeof memory.sessionId === 'string'
    )
  }

  // ── 类型安全的EventEmitter ──

  override on<K extends keyof MemoryRegistryEvents>(
    event: K,
    listener: MemoryRegistryEvents[K]
  ): this {
    return super.on(event, listener)
  }

  override once<K extends keyof MemoryRegistryEvents>(
    event: K,
    listener: MemoryRegistryEvents[K]
  ): this {
    return super.once(event, listener)
  }

  override emit<K extends keyof MemoryRegistryEvents>(
    event: K,
    ...args: Parameters<MemoryRegistryEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }
}