/**
 * Memory System -
 *
 *   MemorySystem
 */

import type { Message, ToolCall, ToolResult } from '../types'
import type {
  MemorySystem,
  MemorySystemOptions,
  MemoryRecord,
  MemoryMetadata,
  MemoryType,
  StorageQuery,
  StorageBatchOperation,
  StorageStats,
  MemorySearchOptions,
  MemorySearchResult,
  Memory,
  ExtractionContext,
  Episode,
  EpisodeEvent,
  PipelineConfig,
  CompactResult,
  BriefResult,
  ClassifyResult
} from './types'
import { getDSXUDefaultModel } from '../../../utils/model/dsxuModel'

export class MemorySystemImpl implements MemorySystem {
  private options: Required<MemorySystemOptions>
  private storage: Map<string, MemoryRecord>
  private episodes: Map<string, Episode>
  private indexes: {
    bySession: Map<string, Set<string>>
    byTask: Map<string, Set<string>>
    byType: Map<MemoryType, Set<string>>
    byTag: Map<string, Set<string>>
  }

  constructor(options: MemorySystemOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      storagePath: options.storagePath ?? './.dsxu/memory',
      maxMemories: options.maxMemories ?? 10000,
      cleanupInterval: options.cleanupInterval ?? 24 * 60 * 60 * 1000, // DSXU comment sanitized.
      pipelineConfig: {
        compactEnabled: options.pipelineConfig?.compactEnabled ?? true,
        compactMinMessages: options.pipelineConfig?.compactMinMessages ?? 10,
        compactMinTokens: options.pipelineConfig?.compactMinTokens ?? 1000,
        compactModel: options.pipelineConfig?.compactModel ?? getDSXUDefaultModel(),
        briefEnabled: options.pipelineConfig?.briefEnabled ?? true,
        briefOnTaskComplete: options.pipelineConfig?.briefOnTaskComplete ?? true,
        briefOnSessionEnd: options.pipelineConfig?.briefOnSessionEnd ?? true,
        briefModel: options.pipelineConfig?.briefModel ?? getDSXUDefaultModel(),
        classifyEnabled: options.pipelineConfig?.classifyEnabled ?? true,
        classifyExtractedMemories: options.pipelineConfig?.classifyExtractedMemories ?? true,
        classifyModel: options.pipelineConfig?.classifyModel ?? getDSXUDefaultModel(),
        performance: {
          batchSize: options.pipelineConfig?.performance?.batchSize ?? 50,
          timeoutMs: options.pipelineConfig?.performance?.timeoutMs ?? 30000,
          maxRetries: options.pipelineConfig?.performance?.maxRetries ?? 3
        }
      }
    }

    this.storage = new Map()
    this.episodes = new Map()
    this.indexes = {
      bySession: new Map(),
      byTask: new Map(),
      byType: new Map(),
      byTag: new Map()
    }

    //
    this.initializeIndexes()
  }

  //

  private initializeIndexes(): void {
    //
    const memoryTypes: MemoryType[] = ['episode', 'extracted', 'compact', 'brief']
    memoryTypes.forEach(type => {
      this.indexes.byType.set(type, new Set())
    })
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateEpisodeId(): string {
    return `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private updateIndexes(memory: MemoryRecord, oldMemory?: MemoryRecord): void {
    //
    if (oldMemory) {
      this.removeFromIndexes(oldMemory)
    }

    //
    this.addToIndexes(memory)
  }

  private addToIndexes(memory: MemoryRecord): void {
    //
    if (!this.indexes.bySession.has(memory.sessionId)) {
      this.indexes.bySession.set(memory.sessionId, new Set())
    }
    this.indexes.bySession.get(memory.sessionId)!.add(memory.id)

    //
    if (memory.taskId) {
      if (!this.indexes.byTask.has(memory.taskId)) {
        this.indexes.byTask.set(memory.taskId, new Set())
      }
      this.indexes.byTask.get(memory.taskId)!.add(memory.id)
    }

    //
    if (!this.indexes.byType.has(memory.type)) {
      this.indexes.byType.set(memory.type, new Set())
    }
    this.indexes.byType.get(memory.type)!.add(memory.id)

    //
    memory.metadata.tags.forEach(tag => {
      if (!this.indexes.byTag.has(tag)) {
        this.indexes.byTag.set(tag, new Set())
      }
      this.indexes.byTag.get(tag)!.add(memory.id)
    })
  }

  private removeFromIndexes(memory: MemoryRecord): void {
    //
    const sessionSet = this.indexes.bySession.get(memory.sessionId)
    if (sessionSet) {
      sessionSet.delete(memory.id)
      if (sessionSet.size === 0) {
        this.indexes.bySession.delete(memory.sessionId)
      }
    }

    //
    if (memory.taskId) {
      const taskSet = this.indexes.byTask.get(memory.taskId)
      if (taskSet) {
        taskSet.delete(memory.id)
        if (taskSet.size === 0) {
          this.indexes.byTask.delete(memory.taskId)
        }
      }
    }

    //
    const typeSet = this.indexes.byType.get(memory.type)
    if (typeSet) {
      typeSet.delete(memory.id)
      if (typeSet.size === 0) {
        this.indexes.byType.delete(memory.type)
      }
    }

    //
    memory.metadata.tags.forEach(tag => {
      const tagSet = this.indexes.byTag.get(tag)
      if (tagSet) {
        tagSet.delete(memory.id)
        if (tagSet.size === 0) {
          this.indexes.byTag.delete(tag)
        }
      }
    })
  }

  private getDefaultMetadata(): MemoryMetadata {
    const now = Date.now()
    return {
      createdAt: now,
      lastAccessed: now,
      accessCount: 0,
      importance: 50, //
      quality: 0.5, //
      files: [],
      tags: [],
      custom: {}
    }
  }

  //

  async addMemory(memory: Omit<MemoryRecord, 'id' | 'metadata'> & { metadata?: Partial<MemoryMetadata>; id?: string }): Promise<string> {
    const id = memory.id || this.generateId()
    const metadata: MemoryMetadata = {
      ...this.getDefaultMetadata(),
      ...memory.metadata
    }

    const record: MemoryRecord = {
      id,
      type: memory.type,
      content: memory.content,
      metadata,
      sessionId: memory.sessionId,
      taskId: memory.taskId,
      episodeId: memory.episodeId
    }

    this.storage.set(id, record)
    this.addToIndexes(record)

    return id
  }

  async getMemory(id: string): Promise<MemoryRecord | null> {
    const memory = this.storage.get(id)
    if (memory) {
      //
      memory.metadata.lastAccessed = Date.now()
      memory.metadata.accessCount++
      this.storage.set(id, memory)
    }
    return memory || null
  }

  async updateMemory(id: string, updates: Partial<MemoryRecord>): Promise<boolean> {
    const memory = this.storage.get(id)
    if (!memory) {
      return false
    }

    const oldMemory = { ...memory }
    const updatedMemory: MemoryRecord = {
      ...memory,
      ...updates,
      metadata: {
        ...memory.metadata,
        ...updates.metadata
      }
    }

    this.storage.set(id, updatedMemory)
    this.updateIndexes(updatedMemory, oldMemory)

    return true
  }

  async deleteMemory(id: string): Promise<boolean> {
    const memory = this.storage.get(id)
    if (!memory) {
      return false
    }

    this.removeFromIndexes(memory)
    this.storage.delete(id)

    return true
  }

  async batch(operations: StorageBatchOperation[]): Promise<{ success: boolean; errors?: string[] }> {
    const errors: string[] = []

    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'insert':
            if (!operation.memory) {
              errors.push(`Insert operation ${operation.memoryId} missing memory data`)
              continue
            }
            //      memoryId
            const memoryToInsert = operation.memoryId
              ? { ...operation.memory, id: operation.memoryId }
              : operation.memory
            await this.addMemory(memoryToInsert)
            break

          case 'update':
            if (!operation.updates) {
              errors.push(`Update operation ${operation.memoryId} missing updates`)
              continue
            }
            const updated = await this.updateMemory(operation.memoryId, operation.updates)
            if (!updated) {
              errors.push(`Update operation ${operation.memoryId} failed: memory not found`)
            }
            break

          case 'delete':
            const deleted = await this.deleteMemory(operation.memoryId)
            if (!deleted) {
              errors.push(`Delete operation ${operation.memoryId} failed: memory not found`)
            }
            break
        }
      } catch (error) {
        errors.push(`${operation.type} operation ${operation.memoryId} failed: ${error}`)
      }
    }

    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  //

  async query(query: StorageQuery): Promise<MemoryRecord[]> {
    let results: MemoryRecord[] = Array.from(this.storage.values())

    //
    if (query.where) {
      const { where } = query

      if (where.type) {
        const types = Array.isArray(where.type) ? where.type : [where.type]
        results = results.filter(memory => types.includes(memory.type))
      }

      if (where.sessionId) {
        results = results.filter(memory => memory.sessionId === where.sessionId)
      }

      if (where.taskId) {
        results = results.filter(memory => memory.taskId === where.taskId)
      }

      if (where.episodeId) {
        results = results.filter(memory => memory.episodeId === where.episodeId)
      }

      if (where.tags && where.tags.length > 0) {
        results = results.filter(memory =>
          where.tags!.every(tag => memory.metadata.tags.includes(tag))
        )
      }

      if (where.importance) {
        const { gte, lte } = where.importance
        if (gte !== undefined) {
          results = results.filter(memory => memory.metadata.importance >= gte)
        }
        if (lte !== undefined) {
          results = results.filter(memory => memory.metadata.importance <= lte)
        }
      }

      if (where.quality) {
        const { gte, lte } = where.quality
        if (gte !== undefined) {
          results = results.filter(memory => memory.metadata.quality >= gte)
        }
        if (lte !== undefined) {
          results = results.filter(memory => memory.metadata.quality <= lte)
        }
      }

      if (where.createdAt) {
        const { gte, lte } = where.createdAt
        if (gte !== undefined) {
          results = results.filter(memory => memory.metadata.createdAt >= gte)
        }
        if (lte !== undefined) {
          results = results.filter(memory => memory.metadata.createdAt <= lte)
        }
      }
    }

    //
    if (query.orderBy) {
      const { field, direction } = query.orderBy
      results.sort((a, b) => {
        let aValue: any, bValue: any

        switch (field) {
          case 'createdAt':
            aValue = a.metadata.createdAt
            bValue = b.metadata.createdAt
            break
          case 'lastAccessed':
            aValue = a.metadata.lastAccessed
            bValue = b.metadata.lastAccessed
            break
          case 'importance':
            aValue = a.metadata.importance
            bValue = b.metadata.importance
            break
          case 'quality':
            aValue = a.metadata.quality
            bValue = b.metadata.quality
            break
          case 'accessCount':
            aValue = a.metadata.accessCount
            bValue = b.metadata.accessCount
            break
          default:
            return 0
        }

        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0
        return direction === 'asc' ? comparison : -comparison
      })
    }

    //
    const offset = query.offset || 0
    const limit = query.limit || results.length
    results = results.slice(offset, offset + limit)

    return results
  }

  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    //
    const query = options.query.toLowerCase()
    const results: MemorySearchResult[] = []

    for (const memory of this.storage.values()) {
      //
      if (options.type) {
        const types = Array.isArray(options.type) ? options.type : [options.type]
        if (!types.includes(memory.type)) {
          continue
        }
      }

      if (options.minImportance !== undefined && memory.metadata.importance < options.minImportance) {
        continue
      }

      if (options.minQuality !== undefined && memory.metadata.quality < options.minQuality) {
        continue
      }

      if (options.includeTags && options.includeTags.length > 0) {
        if (!options.includeTags.every(tag => memory.metadata.tags.includes(tag))) {
          continue
        }
      }

      if (options.excludeTags && options.excludeTags.length > 0) {
        if (options.excludeTags.some(tag => memory.metadata.tags.includes(tag))) {
          continue
        }
      }

      //
      const content = memory.content.toLowerCase()
      const matchedSnippets: string[] = []
      const matchedTags: string[] = []

      //
      if (content.includes(query)) {
        //
        const index = content.indexOf(query)
        const start = Math.max(0, index - 50)
        const end = Math.min(content.length, index + query.length + 50)
        matchedSnippets.push(memory.content.substring(start, end))
      }

      //
      if (memory.metadata.tags.some(tag => tag.toLowerCase().includes(query))) {
        matchedTags.push(...memory.metadata.tags.filter(tag => tag.toLowerCase().includes(query)))
      }

      if (matchedSnippets.length > 0 || matchedTags.length > 0) {
        //
        const relevance = Math.min(
          1.0,
          (matchedSnippets.length * 0.7 + matchedTags.length * 0.3) / 10
        )

        results.push({
          memory,
          relevance,
          matchedSnippets,
          matchedTags
        })
      }
    }

    //
    if (options.sortByRelevance !== false) {
      results.sort((a, b) => b.relevance - a.relevance)
    }

    //
    const offset = options.offset || 0
    const limit = options.limit || results.length
    return results.slice(offset, offset + limit)
  }

  async getStats(): Promise<StorageStats> {
    const memories = Array.from(this.storage.values())
    const totalMemories = memories.length

    //
    const byType: Record<MemoryType, number> = {
      episode: 0,
      extracted: 0,
      compact: 0,
      brief: 0
    }

    //
    const byImportance = {
      low: 0,
      medium: 0,
      high: 0
    }

    //
    const byQuality = {
      poor: 0,
      fair: 0,
      good: 0,
      excellent: 0
    }

    //
    for (const memory of memories) {
      //
      byType[memory.type]++

      //
      if (memory.metadata.importance <= 33) {
        byImportance.low++
      } else if (memory.metadata.importance <= 66) {
        byImportance.medium++
      } else {
        byImportance.high++
      }

      //
      if (memory.metadata.quality <= 0.25) {
        byQuality.poor++
      } else if (memory.metadata.quality <= 0.5) {
        byQuality.fair++
      } else if (memory.metadata.quality <= 0.75) {
        byQuality.good++
      } else {
        byQuality.excellent++
      }
    }

    //
    const storageSize = JSON.stringify(Array.from(this.storage.entries())).length
    const indexSize = JSON.stringify(this.indexes).length

    return {
      totalMemories,
      byType,
      byImportance,
      byQuality,
      storageSize,
      indexSize
    }
  }

  //

  async extractFromMessages(messages: Message[], context: ExtractionContext): Promise<Memory[]> {
    //
    const memories: Memory[] = []

    for (const message of messages) {
      if (message.role === 'assistant' && message.content) {
        //
        const codeMatches = message.content.match(/```[\s\S]*?```/g)
        if (codeMatches) {
          memories.push({
            content: `    : ${codeMatches.join(' ')}`,
            type: 'code',
            confidence: 0.8,
            files: context.currentFile ? [context.currentFile] : [],
            keySnippets: codeMatches,
            tags: ['code', 'implementation']
          })
        }

        //
        const decisionKeywords = ['  ', '  ', '  ', '  ', '  ', '  ']
        if (decisionKeywords.some(keyword => message.content.includes(keyword))) {
          memories.push({
            content: `  : ${message.content.substring(0, 200)}`,
            type: 'decision',
            confidence: 0.7,
            files: context.currentFile ? [context.currentFile] : [],
            keySnippets: [message.content.substring(0, 200)],
            tags: ['decision', 'planning']
          })
        }
      }
    }

    return memories
  }

  async extractFromToolCalls(toolCalls: ToolCall[], context: ExtractionContext): Promise<Memory[]> {
    const memories: Memory[] = []

    for (const toolCall of toolCalls) {
      memories.push({
        content: `    : ${toolCall.name} - ${JSON.stringify(toolCall.arguments)}`,
        type: 'decision',
        confidence: 0.9,
        files: context.currentFile ? [context.currentFile] : [],
        keySnippets: [JSON.stringify(toolCall.arguments)],
        tags: ['tool', 'action', toolCall.name]
      })
    }

    return memories
  }

  async extractFromToolResults(toolResults: ToolResult[], context: ExtractionContext): Promise<Memory[]> {
    const memories: Memory[] = []

    for (const result of toolResults) {
      //
      if (result.isError) {
        memories.push({
          content: `  : ${result.content}`,
          type: 'error',
          confidence: 1.0,
          files: context.currentFile ? [context.currentFile] : [],
          keySnippets: [result.content],
          tags: ['error', 'debugging']
        })
      }

      //
      if (!result.isError && result.content) {
        memories.push({
          content: `  : ${result.content.substring(0, 200)}`,
          type: 'insight',
          confidence: 0.8,
          files: context.currentFile ? [context.currentFile] : [],
          keySnippets: [result.content.substring(0, 200)],
          tags: ['result', 'success']
        })
      }
    }

    return memories
  }

  //    Episode

  async createEpisode(episode: Omit<Episode, 'episodeId'>): Promise<string> {
    const episodeId = this.generateEpisodeId()
    const fullEpisode: Episode = {
      ...episode,
      episodeId
    }

    this.episodes.set(episodeId, fullEpisode)
    return episodeId
  }

  async getEpisode(episodeId: string): Promise<Episode | null> {
    return this.episodes.get(episodeId) || null
  }

  async updateEpisode(episodeId: string, updates: Partial<Episode>): Promise<boolean> {
    const episode = this.episodes.get(episodeId)
    if (!episode) {
      return false
    }

    const updatedEpisode: Episode = {
      ...episode,
      ...updates
    }

    this.episodes.set(episodeId, updatedEpisode)
    return true
  }

  async addEpisodeEvent(episodeId: string, event: EpisodeEvent): Promise<boolean> {
    const episode = this.episodes.get(episodeId)
    if (!episode) {
      return false
    }

    episode.toolEvents.push(event)
    this.episodes.set(episodeId, episode)
    return true
  }

  async getEpisodesByTask(taskId: string): Promise<Episode[]> {
    return Array.from(this.episodes.values()).filter(episode => episode.taskId === taskId)
  }

  // ==================== Session/Task        ====================

  /**
   *     Session
   */
  async getMemoriesBySession(sessionId: string, options?: {
    limit?: number
    offset?: number
    types?: MemoryType[]
  }): Promise<MemoryRecord[]> {
    const sessionMemories = this.indexes.bySession.get(sessionId)
    if (!sessionMemories) {
      return []
    }

    let memories: MemoryRecord[] = []
    for (const memoryId of sessionMemories) {
      const memory = this.storage.get(memoryId)
      if (memory) {
        memories.push(memory)
      }
    }

    //
    if (options?.types && options.types.length > 0) {
      memories = memories.filter(m => options.types!.includes(m.type))
    }

    //
    memories.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)

    //
    const offset = options?.offset || 0
    const limit = options?.limit || memories.length
    return memories.slice(offset, offset + limit)
  }

  /**
   *     Task
   */
  async getMemoriesByTask(taskId: string, options?: {
    limit?: number
    offset?: number
    types?: MemoryType[]
  }): Promise<MemoryRecord[]> {
    const taskMemories = this.indexes.byTask.get(taskId)
    if (!taskMemories) {
      return []
    }

    let memories: MemoryRecord[] = []
    for (const memoryId of taskMemories) {
      const memory = this.storage.get(memoryId)
      if (memory) {
        memories.push(memory)
      }
    }

    //
    if (options?.types && options.types.length > 0) {
      memories = memories.filter(m => options.types!.includes(m.type))
    }

    //
    memories.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt)

    //
    const offset = options?.offset || 0
    const limit = options?.limit || memories.length
    return memories.slice(offset, offset + limit)
  }

  /**
   *   Session
   */
  async getSessionStats(sessionId: string): Promise<{
    totalMemories: number
    byType: Record<MemoryType, number>
    byTask: Record<string, number>
    lastActivity: number
  }> {
    const memories = await this.getMemoriesBySession(sessionId)

    const byType: Record<MemoryType, number> = {
      episode: 0,
      extracted: 0,
      compact: 0,
      brief: 0
    }

    const byTask: Record<string, number> = {}
    let lastActivity = 0

    for (const memory of memories) {
      //
      byType[memory.type]++

      // Task
      if (memory.taskId) {
        byTask[memory.taskId] = (byTask[memory.taskId] || 0) + 1
      }

      //
      lastActivity = Math.max(lastActivity, memory.metadata.lastAccessed)
    }

    return {
      totalMemories: memories.length,
      byType,
      byTask,
      lastActivity
    }
  }

  /**
   *   Task
   */
  async getTaskStats(taskId: string): Promise<{
    totalMemories: number
    byType: Record<MemoryType, number>
    episodes: number
    lastActivity: number
  }> {
    const memories = await this.getMemoriesByTask(taskId)
    const episodes = await this.getEpisodesByTask(taskId)

    const byType: Record<MemoryType, number> = {
      episode: 0,
      extracted: 0,
      compact: 0,
      brief: 0
    }

    let lastActivity = 0

    for (const memory of memories) {
      byType[memory.type]++
      lastActivity = Math.max(lastActivity, memory.metadata.lastAccessed)
    }

    return {
      totalMemories: memories.length,
      byType,
      episodes: episodes.length,
      lastActivity
    }
  }

  /**
   *     Session
   */
  async cleanupSessionMemories(sessionId: string, options?: {
    keepLatest?: number
    maxAgeMs?: number
    types?: MemoryType[]
  }): Promise<number> {
    const memories = await this.getMemoriesBySession(sessionId)
    const now = Date.now()
    let deletedCount = 0

    //
    memories.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt)

    for (const memory of memories) {
      //
      let shouldDelete = false

      //
      if (options?.types && options.types.length > 0) {
        if (!options.types.includes(memory.type)) {
          continue
        }
      }

      //
      if (options?.maxAgeMs) {
        const age = now - memory.metadata.createdAt
        if (age > options.maxAgeMs) {
          shouldDelete = true
        }
      }

      //     N
      if (options?.keepLatest) {
        const remaining = memories.length - deletedCount
        if (remaining > options.keepLatest) {
          shouldDelete = true
        }
      }

      if (shouldDelete) {
        await this.deleteMemory(memory.id)
        deletedCount++
      }
    }

    return deletedCount
  }

  //

  async runCompactPipeline(sessionId: string, messages: Message[]): Promise<CompactResult> {
    const startTime = Date.now()
    const config = this.options.pipelineConfig

    //
    if (!config.compactEnabled) {
      return {
        type: 'compact',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: 'Compact pipeline is disabled',
        stats: {
          inputCount: messages.length,
          outputCount: 0,
          skippedCount: messages.length
        },
        summary: '',
        originalMessageCount: messages.length,
        compressedMessageCount: 0
      }
    }

    //
    if (messages.length < config.compactMinMessages) {
      return {
        type: 'compact',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: `Not enough messages: ${messages.length} < ${config.compactMinMessages}`,
        stats: {
          inputCount: messages.length,
          outputCount: 0,
          skippedCount: messages.length
        },
        summary: '',
        originalMessageCount: messages.length,
        compressedMessageCount: 0
      }
    }

    //
    try {
      const summary = `   ${sessionId}          ${messages.length}    `

      const memoryId = await this.addMemory({
        type: 'compact',
        content: summary,
        sessionId,
        metadata: {
          importance: 60,
          quality: 0.8,
          tags: ['compact', 'summary', `session_${sessionId}`]
        }
      })

      const durationMs = Date.now() - startTime

      return {
        type: 'compact',
        success: true,
        memoryIds: [memoryId],
        durationMs,
        stats: {
          inputCount: messages.length,
          outputCount: 1,
          skippedCount: 0
        },
        summary,
        originalMessageCount: messages.length,
        compressedMessageCount: 1
      }
    } catch (error) {
      return {
        type: 'compact',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stats: {
          inputCount: messages.length,
          outputCount: 0,
          skippedCount: messages.length
        },
        summary: '',
        originalMessageCount: messages.length,
        compressedMessageCount: 0
      }
    }
  }

  async runBriefPipeline(targetId: string, type: 'task' | 'session'): Promise<BriefResult> {
    const startTime = Date.now()
    const config = this.options.pipelineConfig

    //
    if (!config.briefEnabled) {
      return {
        type: 'brief',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: 'Brief pipeline is disabled',
        stats: {
          inputCount: 0,
          outputCount: 0,
          skippedCount: 0
        },
        brief: '',
        length: 0,
        targetId
      }
    }

    try {
      //
      let brief = ''
      if (type === 'task') {
        brief = `   ${targetId}      `
      } else {
        brief = `   ${targetId}      `
      }

      const memoryId = await this.addMemory({
        type: 'brief',
        content: brief,
        sessionId: type === 'session' ? targetId : '',
        taskId: type === 'task' ? targetId : undefined,
        metadata: {
          importance: 70,
          quality: 0.9,
          tags: ['brief', 'summary', `${type}_${targetId}`]
        }
      })

      const durationMs = Date.now() - startTime

      return {
        type: 'brief',
        success: true,
        memoryIds: [memoryId],
        durationMs,
        stats: {
          inputCount: 1,
          outputCount: 1,
          skippedCount: 0
        },
        brief,
        length: brief.length,
        targetId
      }
    } catch (error) {
      return {
        type: 'brief',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stats: {
          inputCount: 0,
          outputCount: 0,
          skippedCount: 0
        },
        brief: '',
        length: 0,
        targetId
      }
    }
  }

  async runClassifyPipeline(memoryIds: string[]): Promise<ClassifyResult> {
    const startTime = Date.now()
    const config = this.options.pipelineConfig

    //
    if (!config.classifyEnabled) {
      return {
        type: 'classify',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: 'Classify pipeline is disabled',
        stats: {
          inputCount: memoryIds.length,
          outputCount: 0,
          skippedCount: memoryIds.length
        },
        classifiedMemoryIds: [],
        addedTags: {},
        updatedImportance: {}
      }
    }

    const classifiedMemoryIds: string[] = []
    const addedTags: Record<string, string[]> = {}
    const updatedImportance: Record<string, number> = {}

    try {
      for (const memoryId of memoryIds) {
        const memory = await this.getMemory(memoryId)
        if (!memory) {
          continue
        }

        //
        const newTags: string[] = []
        let newImportance = memory.metadata.importance

        //
        if (memory.content.includes('  ') || memory.content.includes('error')) {
          newTags.push('error')
          newImportance = Math.max(newImportance, 80) //
        }

        if (memory.content.includes('  ') || memory.content.includes('code')) {
          newTags.push('code')
        }

        if (memory.content.includes('  ') || memory.content.includes('decision')) {
          newTags.push('decision')
          newImportance = Math.max(newImportance, 70)
        }

        //
        if (newTags.length > 0 || newImportance !== memory.metadata.importance) {
          await this.updateMemory(memoryId, {
            metadata: {
              tags: [...new Set([...memory.metadata.tags, ...newTags])],
              importance: newImportance
            }
          })

          classifiedMemoryIds.push(memoryId)
          addedTags[memoryId] = newTags
          updatedImportance[memoryId] = newImportance
        }
      }

      const durationMs = Date.now() - startTime

      return {
        type: 'classify',
        success: true,
        memoryIds: classifiedMemoryIds,
        durationMs,
        stats: {
          inputCount: memoryIds.length,
          outputCount: classifiedMemoryIds.length,
          skippedCount: memoryIds.length - classifiedMemoryIds.length
        },
        classifiedMemoryIds,
        addedTags,
        updatedImportance
      }
    } catch (error) {
      return {
        type: 'classify',
        success: false,
        memoryIds: [],
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        stats: {
          inputCount: memoryIds.length,
          outputCount: 0,
          skippedCount: memoryIds.length
        },
        classifiedMemoryIds: [],
        addedTags: {},
        updatedImportance: {}
      }
    }
  }

  getPipelineConfig(): PipelineConfig {
    return { ...this.options.pipelineConfig }
  }

  async updatePipelineConfig(config: Partial<PipelineConfig>): Promise<void> {
    this.options.pipelineConfig = {
      ...this.options.pipelineConfig,
      ...config
    }
  }

  //

  async cleanup(maxAgeDays: number = 30, minImportance: number = 20): Promise<{ deleted: number; kept: number }> {
    const now = Date.now()
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000
    const cutoffTime = now - maxAgeMs

    let deleted = 0
    let kept = 0

    for (const [id, memory] of this.storage.entries()) {
      const age = now - memory.metadata.createdAt
      const shouldDelete = age > maxAgeMs && memory.metadata.importance < minImportance

      if (shouldDelete) {
        await this.deleteMemory(id)
        deleted++
      } else {
        kept++
      }
    }

    return { deleted, kept }
  }

  async export(format: 'json' | 'csv' = 'json'): Promise<string> {
    const data = {
      memories: Array.from(this.storage.values()),
      episodes: Array.from(this.episodes.values()),
      stats: await this.getStats(),
      exportedAt: Date.now()
    }

    if (format === 'csv') {
      //   CSV
      const csvLines: string[] = []

      //   CSV
      csvLines.push('Memory ID,Type,Content,Session ID,Task ID,Importance,Quality,Tags')
      for (const memory of data.memories) {
        const escapedContent = memory.content.replace(/"/g, '""')
        const tags = memory.metadata.tags.join(';')
        csvLines.push(`"${memory.id}","${memory.type}","${escapedContent}","${memory.sessionId}","${memory.taskId || ''}",${memory.metadata.importance},${memory.metadata.quality},"${tags}"`)
      }

      return csvLines.join('\n')
    }

    return JSON.stringify(data, null, 2)
  }

  async import(data: string, format: 'json' | 'csv' = 'json'): Promise<{ imported: number; skipped: number }> {
    let imported = 0
    let skipped = 0

    try {
      if (format === 'json') {
        const parsed = JSON.parse(data)

        if (parsed.memories && Array.isArray(parsed.memories)) {
          for (const memory of parsed.memories) {
            try {
              await this.addMemory(memory)
              imported++
            } catch {
              skipped++
            }
          }
        }
      } else if (format === 'csv') {
        //   CSV
        const lines = data.split('\n')
        if (lines.length > 1) {
          //
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            //   CSV
            const parts = line.split(',')
            if (parts.length >= 8) {
              try {
                const memory: Omit<MemoryRecord, 'id' | 'metadata'> & { metadata?: Partial<MemoryMetadata> } = {
                  type: parts[1].replace(/"/g, '') as MemoryType,
                  content: parts[2].replace(/"/g, ''),
                  sessionId: parts[3].replace(/"/g, ''),
                  taskId: parts[4].replace(/"/g, '') || undefined,
                  metadata: {
                    importance: parseFloat(parts[5]),
                    quality: parseFloat(parts[6]),
                    tags: parts[7].replace(/"/g, '').split(';').filter(Boolean)
                  }
                }

                await this.addMemory(memory)
                imported++
              } catch {
                skipped++
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Import failed:', error)
      skipped += imported
      imported = 0
    }

    return { imported, skipped }
  }

  async reset(): Promise<void> {
    this.storage.clear()
    this.episodes.clear()

    //
    this.indexes = {
      bySession: new Map(),
      byTask: new Map(),
      byType: new Map(),
      byTag: new Map()
    }

    this.initializeIndexes()
  }
}

//
export const memorySystem = new MemorySystemImpl()

//
export type { MemorySystem, MemorySystemOptions }
