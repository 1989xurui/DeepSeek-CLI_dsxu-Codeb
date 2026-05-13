/**
 * Memory Extractor - 记忆提取器
 *
 * 从对话历史、代码变更、工具调用等中提取有价值的记忆
 */

import type { Message, ToolCall, ToolResult } from '../types'
import type { Memory, ExtractionContext } from './types'

// ── H-4: 增强类型定义 ──

/** 记忆分类 */
export type MemoryCategory =
  | 'bug'
  | 'decision'
  | 'task_state'
  | 'repo_context'
  | 'recovery_history'
  | 'code_pattern'
  | 'tool_usage'
  | 'error_pattern'

/** 提取的记忆（增强版） */
export interface ExtractedMemory {
  /** 记忆ID */
  id: string
  /** 记忆内容 */
  content: string
  /** 记忆分类 */
  category: MemoryCategory
  /** 置信度（0-1） */
  confidence: number
  /** 重要性（0-100） */
  importance: number
  /** 关联的文件列表 */
  files: string[]
  /** 关键片段 */
  keySnippets: string[]
  /** 标签 */
  tags: string[]
  /** 提取时间 */
  extractedAt: number
  /** 来源 */
  source: 'conversation' | 'tool_calls' | 'code_changes' | 'session'
  /** 元数据 */
  metadata: Record<string, any>
}

/** 记忆索引提示 */
export interface MemoryIndexHint {
  /** 提示类型 */
  type: 'category' | 'file' | 'tag' | 'time_range' | 'importance'
  /** 提示值 */
  value: string | number | [number, number]
  /** 置信度 */
  confidence: number
  /** 相关记忆ID列表 */
  relatedMemoryIds: string[]
}

// ── 原有接口定义 ──

export interface MemoryExtractorOptions {
  /** LLM调用函数（可选） */
  llmCall?: (prompt: string) => Promise<string>
  /** 工作目录 */
  cwd: string
  /** 是否启用自动提取 */
  autoExtract?: boolean
  /** 提取阈值 */
  extractionThreshold?: number
  /** 是否启用分类提取 */
  enableCategorizedExtraction?: boolean
}

export interface ExtractionResult {
  /** 提取的记忆 */
  memories: Memory[]
  /** 增强的记忆 */
  extractedMemories?: ExtractedMemory[]
  /** 提取的上下文 */
  context: ExtractionContext
  /** 统计信息 */
  stats: {
    totalMessages: number
    totalToolCalls: number
    extractedMemories: number
    extractionTimeMs: number
    categorizedCount?: Record<MemoryCategory, number>
  }
  /** 记忆索引提示 */
  indexHints?: MemoryIndexHint[]
}

// ── 主类 ──

export class MemoryExtractor {
  private options: MemoryExtractorOptions
  private extractionPatterns: RegExp[]
  private codePatterns: RegExp[]

  constructor(options: MemoryExtractorOptions) {
    this.options = {
      autoExtract: true,
      extractionThreshold: 0.7,
      ...options,
    }

    // 初始化提取模式
    this.extractionPatterns = [
      // 错误模式
      /error|fail|exception|bug|issue|problem/i,
      // 解决方案模式
      /solution|fix|resolve|workaround|patch/i,
      // 决策模式
      /decide|choose|select|option|alternative/i,
      // 学习模式
      /learn|understand|realize|discover|find out/i,
      // 重要模式
      /important|crucial|critical|key|essential/i,
    ]

    // 代码相关模式
    this.codePatterns = [
      // 函数定义
      /(?:function|const|let|var|class|interface|type)\s+(\w+)/g,
      // 导入语句
      /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g,
      // 配置项
      /(?:config|option|setting)\s*[:=]\s*['"]?([^'"\n]+)/gi,
      // 注释中的TODO/FIXME
      /\/\/\s*(TODO|FIXME|NOTE|WARNING|IMPORTANT):\s*(.+)/gi,
    ]
  }

  // ── 主要提取方法 ──

  /**
   * 从对话历史中提取记忆
   */
  async extractFromConversation(
    messages: Message[],
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now()

    // 合并消息内容
    const conversationText = messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n\n')

    // 提取记忆
    const memories = await this.extractMemories(conversationText, context)

    return {
      memories,
      context,
      stats: {
        totalMessages: messages.length,
        totalToolCalls: this.countToolCalls(messages),
        extractedMemories: memories.length,
        extractionTimeMs: Date.now() - startTime,
      },
    }
  }

  /**
   * 从工具调用中提取记忆
   */
  async extractFromToolCalls(
    toolCalls: ToolCall[],
    toolResults: ToolResult[],
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now()

    // 合并工具调用和结果
    const toolText = toolCalls
      .map((call, index) => {
        const result = toolResults[index]
        return `Tool: ${call.name}\nInput: ${JSON.stringify(call.input)}\nResult: ${result?.output || 'N/A'}`
      })
      .join('\n\n')

    // 提取记忆
    const memories = await this.extractMemories(toolText, context)

    return {
      memories,
      context,
      stats: {
        totalMessages: 0,
        totalToolCalls: toolCalls.length,
        extractedMemories: memories.length,
        extractionTimeMs: Date.now() - startTime,
      },
    }
  }

  /**
   * 从代码变更中提取记忆
   */
  async extractFromCodeChanges(
    changes: Array<{
      filePath: string
      oldContent?: string
      newContent?: string
      diff?: string
    }>,
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now()

    // 合并变更内容
    const changesText = changes
      .map(change => {
        const parts = [`File: ${change.filePath}`]
        if (change.diff) {
          parts.push(`Diff:\n${change.diff}`)
        } else if (change.oldContent && change.newContent) {
          parts.push(`Old content (${change.oldContent.length} chars)`)
          parts.push(`New content (${change.newContent.length} chars)`)
        }
        return parts.join('\n')
      })
      .join('\n\n')

    // 提取记忆
    const memories = await this.extractMemories(changesText, context)

    return {
      memories,
      context,
      stats: {
        totalMessages: 0,
        totalToolCalls: 0,
        extractedMemories: memories.length,
        extractionTimeMs: Date.now() - startTime,
      },
    }
  }

  // ── 核心提取逻辑 ──

  private async extractMemories(
    text: string,
    context: ExtractionContext
  ): Promise<Memory[]> {
    const memories: Memory[] = []

    // 1. 基于模式的提取
    const patternMemories = this.extractByPatterns(text, context)
    memories.push(...patternMemories)

    // 2. 代码相关提取
    const codeMemories = this.extractCodeMemories(text, context)
    memories.push(...codeMemories)

    // 3. LLM增强提取（如果可用）
    if (this.options.llmCall && memories.length < 5) {
      const llmMemories = await this.extractWithLLM(text, context)
      memories.push(...llmMemories)
    }

    // 4. 去重和过滤
    return this.deduplicateMemories(memories)
  }

  private extractByPatterns(text: string, context: ExtractionContext): Memory[] {
    const memories: Memory[] = []
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      let matchedPattern: RegExp | null = null
      let patternType: Memory['type'] = 'insight'

      // 检查是否匹配任何模式
      for (const pattern of this.extractionPatterns) {
        if (pattern.test(line)) {
          matchedPattern = pattern

          // 根据模式确定类型
          if (pattern.source.includes('error')) {
            patternType = 'error'
          } else if (pattern.source.includes('solution')) {
            patternType = 'decision'
          } else if (pattern.source.includes('learn')) {
            patternType = 'concept'
          }
          break
        }
      }

      if (matchedPattern) {
        // 提取上下文（前后几行）
        const start = Math.max(0, i - 2)
        const end = Math.min(lines.length, i + 3)
        const contextLines = lines.slice(start, end)
        const content = contextLines.join('\n')

        // 提取关键片段
        const keySnippets = this.extractKeySnippets(content)

        memories.push({
          content,
          type: patternType,
          confidence: this.calculateConfidence(content, matchedPattern),
          files: context.currentFile ? [context.currentFile] : [],
          keySnippets,
          tags: this.extractTags(content),
        })
      }
    }

    return memories
  }

  private extractCodeMemories(text: string, context: ExtractionContext): Memory[] {
    const memories: Memory[] = []

    for (const pattern of this.codePatterns) {
      const matches = [...text.matchAll(pattern)]
      for (const match of matches) {
        const fullMatch = match[0]
        const captured = match[1] || fullMatch

        // 跳过太短的匹配
        if (captured.length < 3) continue

        memories.push({
          content: fullMatch,
          type: 'code',
          confidence: 0.8,
          files: context.currentFile ? [context.currentFile] : [],
          keySnippets: [captured],
          tags: ['code', pattern.source.includes('TODO') ? 'todo' : 'reference'],
        })
      }
    }

    return memories
  }

  private async extractWithLLM(
    text: string,
    context: ExtractionContext
  ): Promise<Memory[]> {
    if (!this.options.llmCall) {
      return []
    }

    try {
      const prompt = this.buildExtractionPrompt(text, context)
      const response = await this.options.llmCall(prompt)

      return this.parseLLMResponse(response, context)
    } catch (error) {
      console.error('LLM extraction failed:', error)
      return []
    }
  }

  // ── 辅助方法 ──

  private buildExtractionPrompt(text: string, context: ExtractionContext): string {
    return `请从以下文本中提取有价值的记忆。文本来自${context.sessionId}会话，当前任务：${context.taskId || '无'}。

文本内容：
${text.substring(0, 2000)}${text.length > 2000 ? '...' : ''}

请提取以下类型的记忆：
1. 代码相关：函数、类、配置、导入等
2. 概念理解：学到的知识、理解的概念
3. 决策记录：做出的选择、考虑的因素
4. 错误经验：遇到的错误、解决方案
5. 重要洞察：关键发现、最佳实践

请以JSON数组格式返回，每个记忆包含：
- content: 记忆内容（简洁描述）
- type: 记忆类型（code/concept/decision/error/insight）
- confidence: 置信度（0-1）
- keySnippets: 关键片段数组
- tags: 标签数组

只返回JSON，不要有其他内容。`
  }

  private parseLLMResponse(response: string, context: ExtractionContext): Memory[] {
    try {
      const parsed = JSON.parse(response)
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed.map((item: any) => ({
        content: item.content || '',
        type: this.validateMemoryType(item.type) || 'insight',
        confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
        files: context.currentFile ? [context.currentFile] : [],
        keySnippets: Array.isArray(item.keySnippets) ? item.keySnippets : [],
        tags: Array.isArray(item.tags) ? item.tags : [],
      }))
    } catch (error) {
      console.error('Failed to parse LLM response:', error)
      return []
    }
  }

  private validateMemoryType(type: string): Memory['type'] {
    const validTypes: Memory['type'][] = ['code', 'concept', 'decision', 'error', 'insight']
    return validTypes.includes(type as any) ? type as Memory['type'] : 'insight'
  }

  private extractKeySnippets(text: string, maxLength: number = 100): string[] {
    const snippets: string[] = []
    const sentences = text.split(/[.!?。！？]/)

    for (const sentence of sentences) {
      const trimmed = sentence.trim()
      if (trimmed.length > 10 && trimmed.length < maxLength) {
        snippets.push(trimmed)
        if (snippets.length >= 3) break
      }
    }

    return snippets
  }

  private extractTags(text: string): string[] {
    const tags: string[] = []
    const words = text.toLowerCase().split(/\W+/)

    const commonTags = [
      'code', 'config', 'function', 'class', 'import',
      'error', 'bug', 'fix', 'solution',
      'decision', 'choice', 'option',
      'learn', 'understand', 'concept',
      'important', 'critical', 'key',
    ]

    for (const word of words) {
      if (word.length > 3 && commonTags.includes(word)) {
        tags.push(word)
      }
    }

    return Array.from(new Set(tags))
  }

  private calculateConfidence(text: string, pattern: RegExp): number {
    // 基于匹配强度、文本长度和上下文计算置信度
    const matchStrength = (text.match(pattern)?.length || 0) > 0 ? 1 : 0
    const lengthFactor = Math.min(1, text.length / 500) // 文本越长越可靠
    const contextFactor = 0.7 // 基础上下文因子

    return (matchStrength * 0.4 + lengthFactor * 0.3 + contextFactor * 0.3)
  }

  private deduplicateMemories(memories: Memory[]): Memory[] {
    const seen = new Set<string>()
    const unique: Memory[] = []

    for (const memory of memories) {
      // 创建签名用于去重
      const signature = `${memory.type}:${memory.content.substring(0, 100)}`

      if (!seen.has(signature) && memory.confidence >= (this.options.extractionThreshold || 0.7)) {
        seen.add(signature)
        unique.push(memory)
      }
    }

    return unique
  }

  private countToolCalls(messages: Message[]): number {
    return messages.reduce((count, msg) => {
      if (msg.tool_calls) {
        return count + msg.tool_calls.length
      }
      return count
    }, 0)
  }

  // ── 公共方法 ──

  /**
   * 批量提取记忆
   */
  async extractBatch(
    sources: Array<{
      type: 'conversation' | 'tools' | 'code'
      data: any
      context: ExtractionContext
    }>
  ): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = []

    for (const source of sources) {
      try {
        let result: ExtractionResult

        switch (source.type) {
          case 'conversation':
            result = await this.extractFromConversation(source.data, source.context)
            break
          case 'tools':
            result = await this.extractFromToolCalls(
              source.data.toolCalls,
              source.data.toolResults,
              source.context
            )
            break
          case 'code':
            result = await this.extractFromCodeChanges(source.data, source.context)
            break
          default:
            continue
        }

        results.push(result)
      } catch (error) {
        console.error(`Failed to extract from ${source.type}:`, error)
      }
    }

    return results
  }

  /**
   * 更新提取配置
   */
  updateOptions(options: Partial<MemoryExtractorOptions>): void {
    this.options = { ...this.options, ...options }
  }

  /**
   * 获取当前配置
   */
  getOptions(): MemoryExtractorOptions {
    return { ...this.options }
  }

  // ── H-4: 增强提取方法 ──

  /**
   * 分类提取记忆
   */
  async extractCategorized(
    messages: Message[],
    context: ExtractionContext
  ): Promise<ExtractionResult> {
    const startTime = Date.now()

    // 先进行基础提取
    const baseResult = await this.extractFromConversation(messages, context)

    // 如果启用了分类提取，进行增强
    if (this.options.enableCategorizedExtraction) {
      const categorizedMemories = await this.categorizeMemories(baseResult.memories, context)
      const indexHints = this.generateIndexHints(categorizedMemories)

      const categorizedCount: Record<MemoryCategory, number> = {
        bug: 0, decision: 0, task_state: 0, repo_context: 0,
        recovery_history: 0, code_pattern: 0, tool_usage: 0, error_pattern: 0
      }

      categorizedMemories.forEach(memory => {
        categorizedCount[memory.category] = (categorizedCount[memory.category] || 0) + 1
      })

      return {
        ...baseResult,
        extractedMemories: categorizedMemories,
        indexHints,
        stats: {
          ...baseResult.stats,
          categorizedCount
        }
      }
    }

    return baseResult
  }

  /**
   * 将记忆分类
   */
  private async categorizeMemories(
    memories: Memory[],
    context: ExtractionContext
  ): Promise<ExtractedMemory[]> {
    const categorized: ExtractedMemory[] = []

    for (const memory of memories) {
      const category = this.determineMemoryCategory(memory)
      const importance = this.calculateMemoryImportance(memory, category)

      const extractedMemory: ExtractedMemory = {
        id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: memory.content,
        category,
        confidence: memory.confidence,
        importance,
        files: memory.files,
        keySnippets: memory.keySnippets,
        tags: memory.tags,
        extractedAt: Date.now(),
        source: 'conversation',
        metadata: {
          originalType: memory.type,
          sessionId: context.sessionId,
          taskId: context.taskId
        }
      }

      categorized.push(extractedMemory)
    }

    return categorized
  }

  /**
   * 确定记忆分类
   */
  private determineMemoryCategory(memory: Memory): MemoryCategory {
    const content = memory.content.toLowerCase()

    if (content.includes('bug') || content.includes('error') || content.includes('fix')) {
      return 'bug'
    } else if (content.includes('decide') || content.includes('choose') || content.includes('option')) {
      return 'decision'
    } else if (content.includes('task') || content.includes('state') || content.includes('progress')) {
      return 'task_state'
    } else if (content.includes('repo') || content.includes('project') || content.includes('file')) {
      return 'repo_context'
    } else if (content.includes('recover') || content.includes('rollback') || content.includes('backup')) {
      return 'recovery_history'
    } else if (content.includes('pattern') || content.includes('structure') || content.includes('design')) {
      return 'code_pattern'
    } else if (content.includes('tool') || content.includes('command') || content.includes('exec')) {
      return 'tool_usage'
    } else if (content.includes('error') || content.includes('fail') || content.includes('exception')) {
      return 'error_pattern'
    }

    // 默认分类
    return 'task_state'
  }

  /**
   * 计算记忆重要性
   */
  private calculateMemoryImportance(memory: Memory, category: MemoryCategory): number {
    let importance = 50 // 基础重要性

    // 根据分类调整
    switch (category) {
      case 'bug':
      case 'error_pattern':
        importance += 30
        break
      case 'decision':
        importance += 20
        break
      case 'recovery_history':
        importance += 25
        break
    }

    // 根据置信度调整
    importance += memory.confidence * 20

    // 根据文件关联数量调整
    importance += Math.min(memory.files.length * 5, 20)

    // 限制在0-100之间
    return Math.max(0, Math.min(100, importance))
  }

  /**
   * 生成索引提示
   */
  private generateIndexHints(memories: ExtractedMemory[]): MemoryIndexHint[] {
    const hints: MemoryIndexHint[] = []

    // 按分类生成提示
    const categoryCount: Record<MemoryCategory, number> = {}
    memories.forEach(memory => {
      categoryCount[memory.category] = (categoryCount[memory.category] || 0) + 1
    })

    Object.entries(categoryCount).forEach(([category, count]) => {
      if (count > 0) {
        hints.push({
          type: 'category',
          value: category,
          confidence: Math.min(1, count / memories.length),
          relatedMemoryIds: memories
            .filter(m => m.category === category)
            .map(m => m.id)
        })
      }
    })

    // 按重要性生成提示
    const importantMemories = memories.filter(m => m.importance >= 70)
    if (importantMemories.length > 0) {
      hints.push({
        type: 'importance',
        value: 70,
        confidence: 0.8,
        relatedMemoryIds: importantMemories.map(m => m.id)
      })
    }

    // 按文件关联生成提示
    const allFiles = new Set<string>()
    memories.forEach(memory => {
      memory.files.forEach(file => allFiles.add(file))
    })

    Array.from(allFiles).slice(0, 5).forEach(file => {
      const relatedMemories = memories.filter(m => m.files.includes(file))
      if (relatedMemories.length > 0) {
        hints.push({
          type: 'file',
          value: file,
          confidence: Math.min(1, relatedMemories.length / 10),
          relatedMemoryIds: relatedMemories.map(m => m.id)
        })
      }
    })

    return hints
  }

  /**
   * 为会话生成记忆摘要
   */
  generateSessionMemorySummary(memories: ExtractedMemory[]): string {
    if (memories.length === 0) {
      return '暂无提取的记忆'
    }

    const summaryParts: string[] = []

    // 按分类统计
    const categoryStats: Record<MemoryCategory, number> = {}
    memories.forEach(memory => {
      categoryStats[memory.category] = (categoryStats[memory.category] || 0) + 1
    })

    summaryParts.push('记忆分类统计:')
    Object.entries(categoryStats).forEach(([category, count]) => {
      summaryParts.push(`  - ${category}: ${count} 条`)
    })

    // 重要记忆
    const importantMemories = memories.filter(m => m.importance >= 70)
    if (importantMemories.length > 0) {
      summaryParts.push('')
      summaryParts.push('重要记忆:')
      importantMemories.slice(0, 3).forEach(memory => {
        summaryParts.push(`  - ${memory.content.substring(0, 100)}...`)
      })
    }

    // 文件关联
    const allFiles = new Set<string>()
    memories.forEach(memory => {
      memory.files.forEach(file => allFiles.add(file))
    })

    if (allFiles.size > 0) {
      summaryParts.push('')
      summaryParts.push(`关联文件: ${Array.from(allFiles).slice(0, 5).join(', ')}${allFiles.size > 5 ? '...' : ''}`)
    }

    return summaryParts.join('/n')
  }
}