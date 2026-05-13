/**
 * Memory System Utilities - 记忆系统工具函数
 */

import { MemoryPipeline } from '../memory-pipeline'
import { MemoryRegistry } from './memory-registry'
import { MemoryExtractor } from './memory-extractor'
import { EpisodeMemory } from './episode-memory'
import { MemorySearch } from './memory-search'

import type { MemorySystemOptions } from './types'

// ── 默认配置 ──

const DEFAULT_OPTIONS: MemorySystemOptions = {
  enabled: true,
  storagePath: '.dsxu/memories',
  maxMemories: 1000,
  cleanupInterval: 3600000, // 1小时
  pipelineConfig: {},
}

// ── 工具函数 ──

/**
 * 创建默认Memory Pipeline
 */
export function createDefaultMemoryPipeline(
  memoryRegistry?: MemoryRegistry,
  options?: Partial<MemorySystemOptions>
): MemoryPipeline {
  const registry = memoryRegistry || getDefaultMemoryRegistry(options)
  const config = { ...DEFAULT_OPTIONS.pipelineConfig, ...options?.pipelineConfig }
  return new MemoryPipeline(registry, config)
}

/**
 * 获取默认Memory Registry
 */
export function getDefaultMemoryRegistry(
  options?: Partial<MemorySystemOptions>
): MemoryRegistry {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  return new MemoryRegistry({
    storagePath: opts.storagePath!,
    maxMemories: opts.maxMemories!,
    cleanupInterval: opts.cleanupInterval!,
  })
}

/**
 * 创建Memory Extractor
 */
export function createMemoryExtractor(
  options?: {
    llmCall?: any
    cwd?: string
  }
): MemoryExtractor {
  return new MemoryExtractor({
    llmCall: options?.llmCall,
    cwd: options?.cwd || process.cwd(),
  })
}

/**
 * 创建Episode Memory
 */
export function createEpisodeMemory(
  options?: {
    memoryRegistry?: MemoryRegistry
    storagePath?: string
  }
): EpisodeMemory {
  const registry = options?.memoryRegistry || getDefaultMemoryRegistry()
  return new EpisodeMemory(registry, {
    storagePath: options?.storagePath,
  })
}

/**
 * 创建Memory Search
 */
export function createMemorySearch(
  memoryRegistry?: MemoryRegistry,
  options?: {
    embeddingModel?: string
    similarityThreshold?: number
  }
): MemorySearch {
  const registry = memoryRegistry || getDefaultMemoryRegistry()
  return new MemorySearch(registry, options)
}

/**
 * 初始化完整记忆系统
 */
export function initializeMemorySystem(options?: MemorySystemOptions) {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  if (!opts.enabled) {
    return {
      pipeline: null,
      registry: null,
      extractor: null,
      episodeMemory: null,
      search: null,
    }
  }

  const registry = getDefaultMemoryRegistry(opts)
  const pipeline = createDefaultMemoryPipeline(registry, opts)
  const extractor = createMemoryExtractor()
  const episodeMemory = createEpisodeMemory({ memoryRegistry: registry })
  const search = createMemorySearch(registry)

  return {
    pipeline,
    registry,
    extractor,
    episodeMemory,
    search,
  }
}

/**
 * 导出记忆系统状态
 */
export function exportMemorySystemState(registry: MemoryRegistry) {
  const memories = registry.getAll()
  const stats = registry.getStats()

  return {
    timestamp: Date.now(),
    stats,
    memories: memories.map(memory => ({
      id: memory.id,
      type: memory.type,
      content: memory.content.substring(0, 200) + (memory.content.length > 200 ? '...' : ''),
      metadata: memory.metadata,
      sessionId: memory.sessionId,
      taskId: memory.taskId,
      episodeId: memory.episodeId,
    })),
  }
}

/**
 * 导入记忆系统状态
 */
export function importMemorySystemState(
  registry: MemoryRegistry,
  state: any
): boolean {
  try {
    // 验证状态格式
    if (!state || !Array.isArray(state.memories)) {
      throw new Error('Invalid memory system state format')
    }

    // 导入记忆
    for (const memoryData of state.memories) {
      registry.registerMemory({
        id: memoryData.id,
        type: memoryData.type,
        content: memoryData.content,
        metadata: memoryData.metadata,
        sessionId: memoryData.sessionId,
        taskId: memoryData.taskId,
        episodeId: memoryData.episodeId,
      })
    }

    return true
  } catch (error) {
    console.error('Failed to import memory system state:', error)
    return false
  }
}

/**
 * 清理过时的记忆
 */
export function cleanupOldMemories(
  registry: MemoryRegistry,
  options?: {
    maxAgeDays?: number
    minImportance?: number
    minQuality?: number
  }
): number {
  const opts = {
    maxAgeDays: 30,
    minImportance: 20,
    minQuality: 0.3,
    ...options,
  }

  const maxAgeMs = opts.maxAgeDays * 24 * 60 * 60 * 1000
  const cutoffTime = Date.now() - maxAgeMs

  const memories = registry.getAll()
  let removedCount = 0

  for (const memory of memories) {
    const shouldRemove =
      memory.metadata.lastAccessed < cutoffTime &&
      memory.metadata.importance < opts.minImportance &&
      memory.metadata.quality < opts.minQuality

    if (shouldRemove) {
      registry.delete(memory.id)
      removedCount++
    }
  }

  return removedCount
}

/**
 * 合并相似记忆
 */
export function mergeSimilarMemories(
  registry: MemoryRegistry,
  similarityThreshold: number = 0.8
): number {
  const memories = registry.getAll()
  let mergedCount = 0

  // 按类型分组
  const memoriesByType: Record<string, MemoryRecord[]> = {}
  for (const memory of memories) {
    if (!memoriesByType[memory.type]) {
      memoriesByType[memory.type] = []
    }
    memoriesByType[memory.type].push(memory)
  }

  // 对每组进行相似性合并
  for (const [type, typeMemories] of Object.entries(memoriesByType)) {
    // 简化实现：按内容长度排序，合并相似内容
    typeMemories.sort((a, b) => b.content.length - a.content.length)

    const toKeep: MemoryRecord[] = []
    const toRemove: string[] = []

    for (let i = 0; i < typeMemories.length; i++) {
      const current = typeMemories[i]
      let shouldKeep = true

      for (let j = 0; j < toKeep.length; j++) {
        const existing = toKeep[j]
        const similarity = calculateTextSimilarity(current.content, existing.content)

        if (similarity > similarityThreshold) {
          // 合并到现有记忆
          shouldKeep = false
          toRemove.push(current.id)

          // 更新现有记忆的元数据
          existing.metadata.lastAccessed = Math.max(
            existing.metadata.lastAccessed,
            current.metadata.lastAccessed
          )
          existing.metadata.accessCount += current.metadata.accessCount
          existing.metadata.importance = Math.max(
            existing.metadata.importance,
            current.metadata.importance
          )
          existing.metadata.quality = Math.max(
            existing.metadata.quality,
            current.metadata.quality
          )

          // 合并标签和文件
          existing.metadata.tags = Array.from(
            new Set([...existing.metadata.tags, ...current.metadata.tags])
          )
          existing.metadata.files = Array.from(
            new Set([...existing.metadata.files, ...current.metadata.files])
          )

          break
        }
      }

      if (shouldKeep) {
        toKeep.push(current)
      }
    }

    // 删除被合并的记忆
    for (const memoryId of toRemove) {
      registry.delete(memoryId)
    }

    mergedCount += toRemove.length
  }

  return mergedCount
}

// ── 辅助函数 ──

/**
 * 计算文本相似度（简化实现）
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // 简化实现：使用Jaccard相似度
  const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2))
  const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2))

  if (words1.size === 0 || words2.size === 0) {
    return 0
  }

  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * 生成记忆ID
 */
export function generateMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * 格式化记忆内容
 */
export function formatMemoryContent(
  content: string,
  maxLength: number = 1000
): string {
  if (content.length <= maxLength) {
    return content
  }

  // 尝试在句子边界处截断
  const sentences = content.split(/[.!?。！？]/)
  let result = ''
  let length = 0

  for (const sentence of sentences) {
    const trimmed = sentence.trim()
    if (trimmed.length === 0) continue

    if (length + trimmed.length + 1 <= maxLength) {
      result += (result ? '. ' : '') + trimmed
      length += trimmed.length + 1
    } else {
      break
    }
  }

  if (result.length === 0) {
    // 如果没有完整的句子，直接截断
    result = content.substring(0, maxLength - 3) + '...'
  } else {
    result += '...'
  }

  return result
}