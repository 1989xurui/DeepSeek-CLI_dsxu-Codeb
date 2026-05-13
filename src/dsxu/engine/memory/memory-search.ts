/**
 * Memory Search - 记忆搜索
 *
 * 提供高级记忆搜索功能，包括语义搜索、过滤、排序等
 */

import type { MemoryRegistry } from './memory-registry'
import type { MemoryRecord, MemorySearchOptions, MemorySearchResult } from './types'

// ── 接口定义 ──

export interface MemorySearchOptionsInternal extends MemorySearchOptions {
  /** 是否启用语义搜索 */
  semanticSearch?: boolean
  /** 语义搜索阈值 */
  semanticThreshold?: number
  /** 是否启用缓存 */
  cacheEnabled?: boolean
  /** 缓存过期时间（毫秒） */
  cacheTTL?: number
}

export interface SearchCacheEntry {
  /** 查询签名 */
  querySignature: string
  /** 搜索结果 */
  results: MemorySearchResult[]
  /** 创建时间 */
  createdAt: number
  /** 过期时间 */
  expiresAt: number
}

// ── 主类 ──

export class MemorySearch {
  private memoryRegistry: MemoryRegistry
  private options: MemorySearchOptionsInternal
  private searchCache: Map<string, SearchCacheEntry>
  private cacheCleanupTimer?: NodeJS.Timeout

  constructor(
    memoryRegistry: MemoryRegistry,
    options?: Partial<MemorySearchOptionsInternal>
  ) {
    this.memoryRegistry = memoryRegistry
    this.options = {
      semanticSearch: false,
      semanticThreshold: 0.7,
      cacheEnabled: true,
      cacheTTL: 300000, // 5分钟
      ...options,
    }
    this.searchCache = new Map()

    // 启动缓存清理
    if (this.options.cacheEnabled) {
      this.startCacheCleanup()
    }
  }

  // ── 主要搜索方法 ──

  /**
   * 搜索记忆
   */
  async search(options: MemorySearchOptions): Promise<MemorySearchResult[]> {
    const startTime = Date.now()

    // 检查缓存
    const cacheKey = this.getCacheKey(options)
    if (this.options.cacheEnabled) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return cached
      }
    }

    // 获取所有记忆
    let memories = this.memoryRegistry.getAll()

    // 应用过滤器
    memories = this.applyFilters(memories, options)

    // 计算相关性
    const results = await this.calculateRelevance(memories, options)

    // 排序
    const sortedResults = this.sortResults(results, options)

    // 限制数量
    const limitedResults = this.limitResults(sortedResults, options)

    // 缓存结果
    if (this.options.cacheEnabled) {
      this.addToCache(cacheKey, limitedResults)
    }

    const duration = Date.now() - startTime
    console.log(`Memory search completed in ${duration}ms, found ${limitedResults.length} results`)

    return limitedResults
  }

  /**
   * 语义搜索
   */
  async semanticSearch(
    query: string,
    options?: Partial<MemorySearchOptions>
  ): Promise<MemorySearchResult[]> {
    if (!this.options.semanticSearch) {
      throw new Error('Semantic search is not enabled')
    }

    return this.search({
      query,
      semanticSearch: true,
      ...options,
    })
  }

  /**
   * 搜索相关记忆
   */
  async findRelatedMemories(
    memoryId: string,
    options?: Partial<MemorySearchOptions>
  ): Promise<MemorySearchResult[]> {
    const memory = this.memoryRegistry.getMemory(memoryId)
    if (!memory) {
      return []
    }

    // 使用记忆内容作为查询
    return this.search({
      query: memory.content,
      type: options?.type,
      minImportance: options?.minImportance,
      minQuality: options?.minQuality,
      includeTags: options?.includeTags,
      excludeTags: options?.excludeTags,
      limit: options?.limit || 10,
      sortByRelevance: true,
    })
  }

  /**
   * 搜索相似记忆
   */
  async findSimilarMemories(
    content: string,
    options?: Partial<MemorySearchOptions>
  ): Promise<MemorySearchResult[]> {
    return this.search({
      query: content,
      type: options?.type,
      minImportance: options?.minImportance,
      minQuality: options?.minQuality,
      includeTags: options?.includeTags,
      excludeTags: options?.excludeTags,
      limit: options?.limit || 10,
      sortByRelevance: true,
    })
  }

  // ── 过滤逻辑 ──

  private applyFilters(
    memories: MemoryRecord[],
    options: MemorySearchOptions
  ): MemoryRecord[] {
    let filtered = memories

    // 按类型过滤
    if (options.type) {
      const types = Array.isArray(options.type) ? options.type : [options.type]
      filtered = filtered.filter(memory => types.includes(memory.type))
    }

    // 按重要性过滤
    if (options.minImportance !== undefined) {
      filtered = filtered.filter(memory => memory.metadata.importance >= options.minImportance!)
    }

    // 按质量过滤
    if (options.minQuality !== undefined) {
      filtered = filtered.filter(memory => memory.metadata.quality >= options.minQuality!)
    }

    // 按标签包含过滤
    if (options.includeTags && options.includeTags.length > 0) {
      const includeSet = new Set(options.includeTags.map(tag => tag.toLowerCase()))
      filtered = filtered.filter(memory =>
        memory.metadata.tags.some(tag => includeSet.has(tag.toLowerCase()))
      )
    }

    // 按标签排除过滤
    if (options.excludeTags && options.excludeTags.length > 0) {
      const excludeSet = new Set(options.excludeTags.map(tag => tag.toLowerCase()))
      filtered = filtered.filter(memory =>
        !memory.metadata.tags.some(tag => excludeSet.has(tag.toLowerCase()))
      )
    }

    return filtered
  }

  // ── 相关性计算 ──

  private async calculateRelevance(
    memories: MemoryRecord[],
    options: MemorySearchOptions
  ): Promise<MemorySearchResult[]> {
    const results: MemorySearchResult[] = []

    for (const memory of memories) {
      let relevance = 0

      // 1. 文本匹配
      const textRelevance = this.calculateTextRelevance(memory.content, options.query)
      relevance += textRelevance * 0.6

      // 2. 标签匹配
      const tagRelevance = this.calculateTagRelevance(memory.metadata.tags, options.query)
      relevance += tagRelevance * 0.2

      // 3. 元数据权重
      const metadataRelevance = this.calculateMetadataRelevance(memory.metadata)
      relevance += metadataRelevance * 0.2

      // 4. 语义匹配（如果启用）
      if (options.semanticSearch && this.options.semanticSearch) {
        const semanticRelevance = await this.calculateSemanticRelevance(memory.content, options.query)
        if (semanticRelevance > this.options.semanticThreshold!) {
          relevance = Math.max(relevance, semanticRelevance)
        }
      }

      // 提取匹配片段
      const matchedSnippets = this.extractMatchedSnippets(memory.content, options.query)
      const matchedTags = this.extractMatchedTags(memory.metadata.tags, options.query)

      if (relevance > 0 || matchedSnippets.length > 0 || matchedTags.length > 0) {
        results.push({
          memory,
          relevance: Math.min(1, relevance),
          matchedSnippets,
          matchedTags,
        })
      }
    }

    return results
  }

  private calculateTextRelevance(content: string, query: string): number {
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // 完全匹配
    if (lowerContent.includes(lowerQuery)) {
      return 1.0
    }

    // 单词匹配
    const queryWords = lowerQuery.split(/\W+/).filter(word => word.length > 2)
    if (queryWords.length === 0) {
      return 0
    }

    let matchedWords = 0
    for (const word of queryWords) {
      if (lowerContent.includes(word)) {
        matchedWords++
      }
    }

    return matchedWords / queryWords.length
  }

  private calculateTagRelevance(tags: string[], query: string): number {
    const lowerQuery = query.toLowerCase()
    const queryWords = lowerQuery.split(/\W+/).filter(word => word.length > 2)

    if (queryWords.length === 0) {
      return 0
    }

    let matchedTags = 0
    for (const tag of tags) {
      const lowerTag = tag.toLowerCase()
      for (const word of queryWords) {
        if (lowerTag.includes(word)) {
          matchedTags++
          break
        }
      }
    }

    return Math.min(1, matchedTags / queryWords.length)
  }

  private calculateMetadataRelevance(metadata: MemoryRecord['metadata']): number {
    // 基于重要性、质量、访问频率计算
    const importanceFactor = metadata.importance / 100
    const qualityFactor = metadata.quality
    const recencyFactor = this.calculateRecencyFactor(metadata.lastAccessed)
    const popularityFactor = Math.min(1, metadata.accessCount / 100)

    return (
      importanceFactor * 0.4 +
      qualityFactor * 0.3 +
      recencyFactor * 0.2 +
      popularityFactor * 0.1
    )
  }

  private async calculateSemanticRelevance(content: string, query: string): Promise<number> {
    // 简化实现：使用文本相似度
    // 在实际应用中，这里应该调用嵌入模型
    return this.calculateTextSimilarity(content, query)
  }

  // ── 结果处理 ──

  private sortResults(
    results: MemorySearchResult[],
    options: MemorySearchOptions
  ): MemorySearchResult[] {
    if (options.sortByRelevance) {
      return results.sort((a, b) => b.relevance - a.relevance)
    }

    // 默认按最后访问时间排序（最新的在前）
    return results.sort((a, b) =>
      b.memory.metadata.lastAccessed - a.memory.metadata.lastAccessed
    )
  }

  private limitResults(
    results: MemorySearchResult[],
    options: MemorySearchOptions
  ): MemorySearchResult[] {
    const limit = options.limit || 50
    const offset = options.offset || 0

    return results.slice(offset, offset + limit)
  }

  private extractMatchedSnippets(content: string, query: string): string[] {
    const snippets: string[] = []
    const lowerContent = content.toLowerCase()
    const lowerQuery = query.toLowerCase()

    // 查找查询出现的位置
    const queryIndex = lowerContent.indexOf(lowerQuery)
    if (queryIndex !== -1) {
      // 提取包含查询的上下文
      const start = Math.max(0, queryIndex - 50)
      const end = Math.min(content.length, queryIndex + lowerQuery.length + 50)
      snippets.push(content.substring(start, end))
    }

    // 查找单词匹配
    const queryWords = lowerQuery.split(/\W+/).filter(word => word.length > 2)
    for (const word of queryWords) {
      const wordIndex = lowerContent.indexOf(word)
      if (wordIndex !== -1) {
        const start = Math.max(0, wordIndex - 30)
        const end = Math.min(content.length, wordIndex + word.length + 30)
        const snippet = content.substring(start, end)
        if (!snippets.some(s => s.includes(snippet))) {
          snippets.push(snippet)
        }
      }
    }

    return snippets.slice(0, 3) // 最多返回3个片段
  }

  private extractMatchedTags(tags: string[], query: string): string[] {
    const matched: string[] = []
    const lowerQuery = query.toLowerCase()
    const queryWords = lowerQuery.split(/\W+/).filter(word => word.length > 2)

    for (const tag of tags) {
      const lowerTag = tag.toLowerCase()
      for (const word of queryWords) {
        if (lowerTag.includes(word)) {
          matched.push(tag)
          break
        }
      }
    }

    return matched
  }

  // ── 缓存管理 ──

  private getCacheKey(options: MemorySearchOptions): string {
    // 创建查询签名
    const parts = [
      options.query,
      Array.isArray(options.type) ? options.type.join(',') : options.type,
      options.minImportance,
      options.minQuality,
      options.includeTags?.join(','),
      options.excludeTags?.join(','),
      options.limit,
      options.offset,
      options.sortByRelevance,
    ].filter(p => p !== undefined)

    return parts.join('|')
  }

  private getFromCache(cacheKey: string): MemorySearchResult[] | null {
    const entry = this.searchCache.get(cacheKey)
    if (!entry) {
      return null
    }

    // 检查是否过期
    if (Date.now() > entry.expiresAt) {
      this.searchCache.delete(cacheKey)
      return null
    }

    return entry.results
  }

  private addToCache(cacheKey: string, results: MemorySearchResult[]): void {
    const now = Date.now()
    const entry: SearchCacheEntry = {
      querySignature: cacheKey,
      results,
      createdAt: now,
      expiresAt: now + (this.options.cacheTTL || 300000),
    }

    this.searchCache.set(cacheKey, entry)
  }

  private startCacheCleanup(): void {
    this.cacheCleanupTimer = setInterval(() => {
      const now = Date.now()
      let cleanedCount = 0

      for (const [key, entry] of this.searchCache.entries()) {
        if (now > entry.expiresAt) {
          this.searchCache.delete(key)
          cleanedCount++
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned ${cleanedCount} expired cache entries`)
      }
    }, 60000) // 每分钟清理一次
  }

  // ── 辅助函数 ──

  private calculateRecencyFactor(lastAccessed: number): number {
    const ageHours = (Date.now() - lastAccessed) / (1000 * 60 * 60)
    return Math.max(0, 1 - ageHours / 168) // 一周衰减
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // 使用Jaccard相似度
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2))
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2))

    if (words1.size === 0 || words2.size === 0) {
      return 0
    }

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
  }

  // ── 公共方法 ──

  /**
   * 清除搜索缓存
   */
  clearCache(): void {
    this.searchCache.clear()
    console.log('Memory search cache cleared')
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number
    entries: number
    oldestEntry: number | null
    newestEntry: number | null
  } {
    const entries = Array.from(this.searchCache.values())
    const now = Date.now()

    return {
      size: this.searchCache.size,
      entries: entries.length,
      oldestEntry: entries.length > 0
        ? Math.min(...entries.map(e => now - e.createdAt))
        : null,
      newestEntry: entries.length > 0
        ? Math.min(...entries.map(e => now - e.createdAt))
        : null,
    }
  }

  /**
   * 更新搜索选项
   */
  updateOptions(options: Partial<MemorySearchOptionsInternal>): void {
    this.options = { ...this.options, ...options }

    // 如果禁用缓存，清除现有缓存
    if (options.cacheEnabled === false) {
      this.clearCache()
      if (this.cacheCleanupTimer) {
        clearInterval(this.cacheCleanupTimer)
        this.cacheCleanupTimer = undefined
      }
    }

    // 如果启用缓存，启动清理
    if (options.cacheEnabled === true && !this.cacheCleanupTimer) {
      this.startCacheCleanup()
    }
  }

  /**
   * 获取当前选项
   */
  getOptions(): MemorySearchOptionsInternal {
    return { ...this.options }
  }

  /**
   * 销毁搜索实例
   */
  destroy(): void {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer)
      this.cacheCleanupTimer = undefined
    }
    this.clearCache()
  }
}