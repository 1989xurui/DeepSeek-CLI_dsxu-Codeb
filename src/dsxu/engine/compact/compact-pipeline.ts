/**
 * Compact Pipeline - 压缩流水线
 *
 * V8-2 Runtime Core: Memory/Context/Compact 承接层
 *
 * 统一管理压缩、摘要、分类流水线
 */

import type { Message, LLMCallFn } from '../types'
import type { Memory } from '../memory-extractor'
import type { CompactResult } from '../compact'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'

// ── 类型定义 ──

export interface CompactPipelineConfig {
  /** 是否启用压缩流水线 */
  enabled: boolean
  /** 压缩策略配置 */
  compaction: {
    /** 启用分层压缩 */
    enableTieredCompaction: boolean
    /** 自动压缩阈值（token数） */
    autoCompactThreshold: number
    /** 保留最近轮次 */
    keepRecentRounds: number
    /** 轻量压缩阈值（使用率） */
    lightCompactThreshold: number
    /** 完全压缩阈值（使用率） */
    fullCompactThreshold: number
    /** 压缩后最小token数 */
    minTokensAfterCompact: number
    /** 压缩冷却时间（毫秒） */
    cooldownMs: number
  }
  /** 摘要生成配置 */
  briefing: {
    /** 是否生成摘要 */
    enabled: boolean
    /** 摘要最大长度（token数） */
    maxSummaryTokens: number
    /** 摘要格式：markdown | plain | structured */
    format: 'markdown' | 'plain' | 'structured'
    /** 是否包含文件列表 */
    includeFiles: boolean
    /** 是否包含工具调用统计 */
    includeToolStats: boolean
  }
  /** 分类配置 */
  classification: {
    /** 是否启用分类 */
    enabled: boolean
    /** 分类维度 */
    dimensions: ('complexity' | 'risk' | 'topic' | 'action')[]
    /** 最小置信度阈值 */
    minConfidence: number
  }
  /** 记忆集成配置 */
  memoryIntegration: {
    /** 压缩时提取记忆 */
    extractOnCompact: boolean
    /** 摘要时关联记忆 */
    linkMemoriesOnBrief: boolean
    /** 分类时更新记忆标签 */
    updateTagsOnClassify: boolean
  }
}

export interface BriefResult {
  /** 摘要文本 */
  summary: string
  /** 格式 */
  format: 'markdown' | 'plain' | 'structured'
  /** 生成时间 */
  timestamp: number
  /** 关联的文件 */
  files: string[]
  /** 工具调用统计 */
  toolStats: {
    total: number
    byTool: Record<string, number>
    successRate: number
  }
  /** 关联的记忆ID */
  linkedMemoryIds?: string[]
}

export interface ClassifyResult {
  /** 分类维度 */
  dimensions: Record<string, {
    /** 分类标签 */
    label: string
    /** 置信度 (0-1) */
    confidence: number
    /** 解释 */
    explanation?: string
  }>
  /** 总体标签 */
  overallTags: string[]
  /** 建议的动作 */
  suggestedActions: string[]
  /** 风险等级 */
  riskLevel?: 'low' | 'medium' | 'high'
  /** 复杂度评估 */
  complexity?: 'simple' | 'moderate' | 'complex'
}

export interface CompactPipelineResult {
  /** 压缩结果 */
  compaction: CompactResult
  /** 摘要结果（如果有） */
  briefing?: BriefResult
  /** 分类结果（如果有） */
  classification?: ClassifyResult
  /** 提取的记忆（如果有） */
  extractedMemories?: Memory[]
  /** 处理耗时（毫秒） */
  durationMs: number
  /** 处理状态 */
  status: 'success' | 'partial' | 'error'
  /** 错误信息 */
  error?: string
}

// ── Compact Pipeline 核心类 ──

export class CompactPipeline {
  private config: CompactPipelineConfig
  private llmCall?: LLMCallFn
  private lastCompactTime = 0

  constructor(config?: Partial<CompactPipelineConfig>) {
    this.config = {
      enabled: true,
      compaction: {
        enableTieredCompaction: true,
        autoCompactThreshold: 80000,
        keepRecentRounds: 3,
        lightCompactThreshold: 0.7,
        fullCompactThreshold: 0.85,
        minTokensAfterCompact: 20000,
        cooldownMs: 30000
      },
      briefing: {
        enabled: true,
        maxSummaryTokens: 2000,
        format: 'markdown',
        includeFiles: true,
        includeToolStats: true
      },
      classification: {
        enabled: false, // 默认关闭，需要LLM
        dimensions: ['complexity', 'risk', 'topic'],
        minConfidence: 0.6
      },
      memoryIntegration: {
        extractOnCompact: true,
        linkMemoriesOnBrief: true,
        updateTagsOnClassify: true
      },
      ...config
    }
  }

  /**
   * 设置LLM调用函数
   */
  setLLMCallFn(llmCall: LLMCallFn): void {
    this.llmCall = llmCall
  }

  /**
   * 执行完整流水线
   */
  async execute(
    messages: Message[],
    context: {
      sessionId: string
      taskId?: string
      cwd: string
      query?: string
    }
  ): Promise<CompactPipelineResult> {
    if (!this.config.enabled) {
      return {
        compaction: {
          messages,
          wasCompacted: false,
          compactType: 'none',
          tokensBefore: 0,
          tokensAfter: 0,
          messagesRemoved: 0
        },
        durationMs: 0,
        status: 'success'
      }
    }

    const startTime = Date.now()
    const result: CompactPipelineResult = {
      compaction: {
        messages,
        wasCompacted: false,
        compactType: 'none',
        tokensBefore: 0,
        tokensAfter: 0,
        messagesRemoved: 0
      },
      durationMs: 0,
      status: 'success'
    }

    try {
      // 1. 执行压缩
      result.compaction = await this.executeCompaction(messages)
      const compactedMessages = result.compaction.messages

      // 2. 生成摘要（如果需要）
      if (this.config.briefing.enabled && result.compaction.wasCompacted) {
        result.briefing = await this.generateBrief(compactedMessages, context)
      }

      // 3. 执行分类（如果需要且配置了LLM）
      if (this.config.classification.enabled && this.llmCall && result.compaction.wasCompacted) {
        result.classification = await this.classifyConversation(compactedMessages, context)
      }

      result.durationMs = Date.now() - startTime
      result.status = 'success'

      console.log(`[CompactPipeline] Executed pipeline in ${result.durationMs}ms`)

    } catch (error: any) {
      result.status = 'error'
      result.error = error.message
      result.durationMs = Date.now() - startTime

      console.warn(`[CompactPipeline] Pipeline execution failed: ${error.message}`)
    }

    return result
  }

  /**
   * 执行压缩
   */
  private async executeCompaction(messages: Message[]): Promise<CompactResult> {
    if (!this.llmCall) {
      // 没有LLM时只执行micro压缩
      const { microCompact } = await import('../compact')
      return microCompact(messages)
    }

    // 检查冷却时间
    const now = Date.now()
    if (now - this.lastCompactTime < this.config.compaction.cooldownMs) {
      console.log(`[CompactPipeline] Compaction cooldown: ${this.config.compaction.cooldownMs - (now - this.lastCompactTime)}ms remaining`)
      const { microCompact } = await import('../compact')
      return microCompact(messages)
    }

    const { autoCompactIfNeeded } = await import('../compact')
    const result = await autoCompactIfNeeded(messages, this.llmCall, {
      autoCompactThreshold: this.config.compaction.autoCompactThreshold,
      keepRecentRounds: this.config.compaction.keepRecentRounds,
      enableTieredCompaction: this.config.compaction.enableTieredCompaction,
      lightCompactThreshold: this.config.compaction.lightCompactThreshold,
      fullCompactThreshold: this.config.compaction.fullCompactThreshold,
      minTokensAfterCompact: this.config.compaction.minTokensAfterCompact,
      cooldownMs: this.config.compaction.cooldownMs
    })

    if (result.wasCompacted) {
      this.lastCompactTime = now
    }

    return result
  }

  /**
   * 生成摘要
   */
  private async generateBrief(
    messages: Message[],
    context: { sessionId: string; taskId?: string; cwd: string; query?: string }
  ): Promise<BriefResult> {
    // 提取关键信息
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const toolMessages = messages.filter(m => m.role === 'tool')

    // 提取文件操作
    const files = this.extractFilesFromMessages(messages)

    // 提取工具统计
    const toolStats = this.extractToolStats(messages)

    // 生成摘要
    let summary = ''
    if (this.config.briefing.format === 'markdown') {
      summary = this.generateMarkdownBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
    } else if (this.config.briefing.format === 'structured') {
      summary = this.generateStructuredBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
    } else {
      summary = this.generatePlainBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
    }

    return {
      summary,
      format: this.config.briefing.format,
      timestamp: Date.now(),
      files: this.config.briefing.includeFiles ? files : [],
      toolStats: this.config.briefing.includeToolStats ? toolStats : { total: 0, byTool: {}, successRate: 0 }
    }
  }

  /**
   * 分类对话
   */
  private async classifyConversation(
    messages: Message[],
    context: { sessionId: string; taskId?: string; cwd: string; query?: string }
  ): Promise<ClassifyResult> {
    if (!this.llmCall) {
      throw new Error('LLM call function not set for classification')
    }

    try {
      // 构建分类请求
      const conversationText = messages.slice(-10).map(m => {
        const role = m.role
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `[${role}]: ${content.slice(0, 500)}`
      }).join('/n/n')

      const prompt = `Classify the following conversation along these dimensions: ${this.config.classification.dimensions.join(', ')}.

For each dimension, provide:
1. Label (categorical value)
2. Confidence score (0-1)
3. Brief explanation

Also provide:
- Overall tags (keywords)
- Suggested next actions
- Risk level (low/medium/high)
- Complexity (simple/moderate/complex)

Conversation:
${conversationText}

Output as JSON with this structure:
{
  "dimensions": {
    "dimension_name": {
      "label": "label_value",
      "confidence": 0.95,
      "explanation": "brief explanation"
    }
  },
  "overallTags": ["tag1", "tag2"],
  "suggestedActions": ["action1", "action2"],
  "riskLevel": "low|medium|high",
  "complexity": "simple|moderate|complex"
}`

      const response = await this.llmCall(
        [
          { role: 'system', content: 'You are a conversation classifier. Output valid JSON only.' },
          { role: 'user', content: prompt }
        ],
        [],
        { model: DEEPSEEK_V4_FLASH_MODEL, maxTokens: 1000 }
      )

      const classification = JSON.parse(response.content)

      // 验证结果
      return this.validateClassification(classification)

    } catch (error: any) {
      console.warn(`[CompactPipeline] Classification failed: ${error.message}`)
      // 返回默认分类
      return {
        dimensions: {},
        overallTags: [],
        suggestedActions: []
      }
    }
  }

  // ── 辅助方法 ──

  private extractFilesFromMessages(messages: Message[]): string[] {
    const files = new Set<string>()
    const filePatterns = [
      /file[_-]?path["']?\s*:\s*["']([^"']+)["']/gi,
      /path["']?\s*:\s*["']([^"']+)["']/gi,
      //.(ts|js|tsx|jsx|md|json|yml|yaml|txt)/b/gi,
    ]

    for (const msg of messages) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)

      for (const pattern of filePatterns) {
        let match
        pattern.lastIndex = 0
        while ((match = pattern.exec(content)) !== null) {
          if (match[1] && (match[1].includes('/') || match[1].includes('//'))) {
            files.add(match[1].trim())
          }
        }
      }
    }

    return Array.from(files).slice(0, 10) // 最多返回10个文件
  }

  private extractToolStats(messages: Message[]): {
    total: number
    byTool: Record<string, number>
    successRate: number
  } {
    const toolMessages = messages.filter(m => m.role === 'tool')
    const byTool: Record<string, number> = {}
    let successCount = 0

    // 简化实现：统计工具消息数量
    // 实际实现需要解析工具名称和成功状态
    for (const msg of toolMessages) {
      const content = typeof msg.content === 'string' ? msg.content : ''
      // 尝试提取工具名称
      const toolMatch = content.match(/Tool: (w+)/)
      const toolName = toolMatch ? toolMatch[1] : 'unknown'
      byTool[toolName] = (byTool[toolName] || 0) + 1

      // 简单判断成功（不包含错误信息）
      if (!content.toLowerCase().includes('error') && !content.toLowerCase().includes('failed')) {
        successCount++
      }
    }

    return {
      total: toolMessages.length,
      byTool,
      successRate: toolMessages.length > 0 ? successCount / toolMessages.length : 0
    }
  }

  private generateMarkdownBrief(
    userMessages: Message[],
    assistantMessages: Message[],
    toolMessages: Message[],
    files: string[],
    toolStats: { total: number; byTool: Record<string, number>; successRate: number },
    context: { sessionId: string; taskId?: string; cwd: string; query?: string }
  ): string {
    return `# Conversation Brief

## Context
- **Session**: ${context.sessionId}
- **Task**: ${context.taskId || 'N/A'}
- **Query**: ${context.query?.slice(0, 200) || 'N/A'}

## Statistics
- **Total Messages**: ${userMessages.length + assistantMessages.length + toolMessages.length}
- **User Messages**: ${userMessages.length}
- **Assistant Messages**: ${assistantMessages.length}
- **Tool Calls**: ${toolMessages.length}

## Tool Usage
${Object.entries(toolStats.byTool).map(([tool, count]) => `- **${tool}**: ${count} calls`).join('/n')}
- **Success Rate**: ${(toolStats.successRate * 100).toFixed(1)}%

## Files Mentioned
${files.length > 0 ? files.map(f => `- ${f}`).join('/n') : 'None'}

## Key Points
${userMessages.length > 0 ? `- Initial request: ${this.truncateText(userMessages[0]?.content?.toString() || '', 150)}` : ''}
${userMessages.length > 1 ? `- Latest request: ${this.truncateText(userMessages[userMessages.length - 1]?.content?.toString() || '', 150)}` : ''}
- Conversation focused on: ${this.estimateTopic(userMessages)}`
  }

  private generateStructuredBrief(
    userMessages: Message[],
    assistantMessages: Message[],
    toolMessages: Message[],
    files: string[],
    toolStats: { total: number; byTool: Record<string, number>; successRate: number },
    context: { sessionId: string; taskId?: string; cwd: string; query?: string }
  ): string {
    return JSON.stringify({
      context: {
        sessionId: context.sessionId,
        taskId: context.taskId,
        query: context.query,
        timestamp: Date.now()
      },
      statistics: {
        totalMessages: userMessages.length + assistantMessages.length + toolMessages.length,
        userMessages: userMessages.length,
        assistantMessages: assistantMessages.length,
        toolCalls: toolMessages.length
      },
      toolUsage: toolStats,
      files: files,
      keyPoints: {
        initialRequest: userMessages[0]?.content?.toString().slice(0, 200),
        latestRequest: userMessages[userMessages.length - 1]?.content?.toString().slice(0, 200),
        estimatedTopic: this.estimateTopic(userMessages)
      }
    }, null, 2)
  }

  private generatePlainBrief(
    userMessages: Message[],
    assistantMessages: Message[],
    toolMessages: Message[],
    files: string[],
    toolStats: { total: number; byTool: Record<string, number>; successRate: number },
    context: { sessionId: string; taskId?: string; cwd: string; query?: string }
  ): string {
    return `Conversation Brief:
Session: ${context.sessionId}
Task: ${context.taskId || 'N/A'}
Query: ${context.query?.slice(0, 100) || 'N/A'}

Statistics:
- Total messages: ${userMessages.length + assistantMessages.length + toolMessages.length}
- User messages: ${userMessages.length}
- Assistant messages: ${assistantMessages.length}
- Tool calls: ${toolMessages.length}

Tool usage: ${Object.entries(toolStats.byTool).map(([t, c]) => `${t}(${c})`).join(', ')}
Success rate: ${(toolStats.successRate * 100).toFixed(1)}%

Files: ${files.length > 0 ? files.slice(0, 3).join(', ') + (files.length > 3 ? '...' : '') : 'None'}

Key points:
${userMessages.length > 0 ? `- Initial: ${this.truncateText(userMessages[0]?.content?.toString() || '', 100)}` : ''}
${userMessages.length > 1 ? `- Latest: ${this.truncateText(userMessages[userMessages.length - 1]?.content?.toString() || '', 100)}` : ''}`
  }

  private estimateTopic(userMessages: Message[]): string {
    if (userMessages.length === 0) return 'Unknown'

    const content = userMessages.map(m => m.content?.toString() || '').join(' ')
    const keywords = ['bug', 'fix', 'error', 'feature', 'refactor', 'test', 'document', 'review', 'implement']

    for (const keyword of keywords) {
      if (content.toLowerCase().includes(keyword)) {
        return keyword
      }
    }

    return 'General discussion'
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  private validateClassification(classification: any): ClassifyResult {
    // 基本验证
    const result: ClassifyResult = {
      dimensions: classification.dimensions || {},
      overallTags: Array.isArray(classification.overallTags) ? classification.overallTags : [],
      suggestedActions: Array.isArray(classification.suggestedActions) ? classification.suggestedActions : []
    }

    // 验证维度
    for (const [dimension, value] of Object.entries(result.dimensions)) {
      if (typeof value !== 'object' || value === null) {
        delete result.dimensions[dimension]
        continue
      }

      const dimValue = value as any
      if (typeof dimValue.confidence !== 'number' || dimValue.confidence < this.config.classification.minConfidence) {
        delete result.dimensions[dimension]
      }
    }

    // 验证风险等级
    if (classification.riskLevel && ['low', 'medium', 'high'].includes(classification.riskLevel)) {
      result.riskLevel = classification.riskLevel
    }

    // 验证复杂度
    if (classification.complexity && ['simple', 'moderate', 'complex'].includes(classification.complexity)) {
      result.complexity = classification.complexity
    }

    return result
  }

  // ── 公共方法 ──

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompactPipelineConfig>): void {
    Object.assign(this.config, config)
    console.log(`[CompactPipeline] Config updated`)
  }

  /**
   * 获取配置
   */
  getConfig(): CompactPipelineConfig {
    return { ...this.config }
  }

  /**
   * 重置冷却时间
   */
  resetCooldown(): void {
    this.lastCompactTime = 0
  }
}

// ── 工厂函数 ──

/**
 * 创建Compact Pipeline实例
 */
export function createCompactPipeline(config?: Partial<CompactPipelineConfig>): CompactPipeline {
  return new CompactPipeline(config)
}

/**
 * 创建默认配置的Compact Pipeline
 */
export function createDefaultCompactPipeline(): CompactPipeline {
  return createCompactPipeline()
}
