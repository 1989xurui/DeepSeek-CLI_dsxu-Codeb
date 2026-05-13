/**
 * Brief Generator - 摘要生成器
 *
 * V8-2 Runtime Core: Memory/Context/Compact 承接层
 *
 * 生成用户友好的对话摘要，支持多种格式和定制
 */

import type { Message, LLMCallFn } from '../types'
import type { Memory } from '../memory-extractor'
import { DEEPSEEK_V4_FLASH_MODEL } from '../../../utils/model/deepseekV4Control'

// ── 类型定义 ──

export interface BriefConfig {
  /** 是否启用摘要生成 */
  enabled: boolean
  /** 摘要格式 */
  format: 'markdown' | 'plain' | 'structured' | 'executive'
  /** 摘要最大长度（token数） */
  maxLength: number
  /** 包含的内容 */
  include: {
    /** 是否包含上下文信息 */
    context: boolean
    /** 是否包含统计信息 */
    statistics: boolean
    /** 是否包含工具使用情况 */
    toolUsage: boolean
    /** 是否包含文件列表 */
    files: boolean
    /** 是否包含关键决策 */
    keyDecisions: boolean
    /** 是否包含下一步建议 */
    nextSteps: boolean
  }
  /** 触发条件 */
  triggers: {
    /** 压缩后自动生成 */
    onCompact: boolean
    /** 任务完成后生成 */
    onTaskComplete: boolean
    /** 手动触发 */
    manual: boolean
    /** 最小消息数量 */
    minMessages: number
    /** 最小工具调用数量 */
    minToolCalls: number
  }
  /** 记忆集成 */
  memoryIntegration: {
    /** 关联相关记忆 */
    linkRelevantMemories: boolean
    /** 最大关联记忆数 */
    maxLinkedMemories: number
    /** 记忆质量阈值 */
    memoryQualityThreshold: number
  }
}

export interface BriefResult {
  /** 摘要ID */
  id: string
  /** 摘要文本 */
  content: string
  /** 摘要格式 */
  format: 'markdown' | 'plain' | 'structured' | 'executive'
  /** 生成时间 */
  timestamp: number
  /** 关联的会话ID */
  sessionId: string
  /** 关联的任务ID */
  taskId?: string
  /** 元数据 */
  metadata: {
    /** 消息数量 */
    messageCount: number
    /** 工具调用数量 */
    toolCallCount: number
    /** 涉及的文件数量 */
    fileCount: number
    /** 生成耗时（毫秒） */
    generationTime: number
    /** 关联的记忆ID */
    linkedMemoryIds?: string[]
  }
  /** 结构化数据（如果格式为structured） */
  structuredData?: Record<string, any>
}

export interface BriefContext {
  /** 会话ID */
  sessionId: string
  /** 任务ID */
  taskId?: string
  /** 当前工作目录 */
  cwd: string
  /** 用户查询 */
  query?: string
  /** 任务状态 */
  taskStatus?: 'pending' | 'running' | 'completed' | 'failed'
  /** 相关记忆 */
  relevantMemories?: Memory[]
  /** 自定义上下文 */
  custom?: Record<string, any>
}

// ── Brief Generator 核心类 ──

export class BriefGenerator {
  private config: BriefConfig
  private llmCall?: LLMCallFn

  constructor(config?: Partial<BriefConfig>) {
    this.config = {
      enabled: true,
      format: 'markdown',
      maxLength: 2000,
      include: {
        context: true,
        statistics: true,
        toolUsage: true,
        files: true,
        keyDecisions: true,
        nextSteps: true
      },
      triggers: {
        onCompact: true,
        onTaskComplete: true,
        manual: true,
        minMessages: 5,
        minToolCalls: 1
      },
      memoryIntegration: {
        linkRelevantMemories: true,
        maxLinkedMemories: 3,
        memoryQualityThreshold: 0.6
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
   * 检查是否应该生成摘要
   */
  shouldGenerateBrief(messages: Message[], trigger: 'compact' | 'taskComplete' | 'manual' = 'manual'): boolean {
    if (!this.config.enabled) return false

    // 检查触发条件
    if (trigger === 'compact' && !this.config.triggers.onCompact) return false
    if (trigger === 'taskComplete' && !this.config.triggers.onTaskComplete) return false
    if (trigger === 'manual' && !this.config.triggers.manual) return false

    // 检查最小消息数量
    if (messages.length < this.config.triggers.minMessages) return false

    // 检查最小工具调用数量
    const toolMessages = messages.filter(m => m.role === 'tool')
    if (toolMessages.length < this.config.triggers.minToolCalls) return false

    return true
  }

  /**
   * 生成摘要
   */
  async generate(
    messages: Message[],
    context: BriefContext
  ): Promise<BriefResult> {
    if (!this.config.enabled) {
      throw new Error('Brief generation is disabled')
    }

    const startTime = Date.now()

    try {
      let content: string
      let structuredData: Record<string, any> | undefined

      if (this.config.format === 'structured' && this.llmCall) {
        // 使用LLM生成结构化摘要
        const result = await this.generateStructuredBriefWithLLM(messages, context)
        content = JSON.stringify(result, null, 2)
        structuredData = result
      } else if (this.llmCall) {
        // 使用LLM生成文本摘要
        content = await this.generateTextBriefWithLLM(messages, context)
      } else {
        // 使用规则生成摘要
        content = this.generateRuleBasedBrief(messages, context)
      }

      // 关联相关记忆
      const linkedMemoryIds = await this.linkRelevantMemories(messages, context)

      const result: BriefResult = {
        id: `brief-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        content,
        format: this.config.format,
        timestamp: Date.now(),
        sessionId: context.sessionId,
        taskId: context.taskId,
        metadata: {
          messageCount: messages.length,
          toolCallCount: messages.filter(m => m.role === 'tool').length,
          fileCount: this.extractFilesFromMessages(messages).length,
          generationTime: Date.now() - startTime,
          linkedMemoryIds: linkedMemoryIds.length > 0 ? linkedMemoryIds : undefined
        },
        structuredData
      }

      console.log(`[BriefGenerator] Generated brief ${result.id} in ${result.metadata.generationTime}ms`)

      return result

    } catch (error: any) {
      console.warn(`[BriefGenerator] Brief generation failed: ${error.message}`)
      throw error
    }
  }

  /**
   * 使用LLM生成结构化摘要
   */
  private async generateStructuredBriefWithLLM(
    messages: Message[],
    context: BriefContext
  ): Promise<Record<string, any>> {
    if (!this.llmCall) {
      throw new Error('LLM call function not set')
    }

    // 构建提示词
    const conversationText = this.prepareConversationForLLM(messages)
    const prompt = this.buildStructuredBriefPrompt(conversationText, context)

    const response = await this.llmCall(
      [
        { role: 'system', content: 'You are a conversation summarizer. Output valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      [],
      { model: DEEPSEEK_V4_FLASH_MODEL, maxTokens: this.config.maxLength }
    )

    try {
      const result = JSON.parse(response.content)
      return this.validateStructuredBrief(result)
    } catch (error: any) {
      console.warn(`[BriefGenerator] Failed to parse LLM response as JSON: ${error.message}`)
      // 返回默认结构
      return this.generateDefaultStructuredBrief(messages, context)
    }
  }

  /**
   * 使用LLM生成文本摘要
   */
  private async generateTextBriefWithLLM(
    messages: Message[],
    context: BriefContext
  ): Promise<string> {
    if (!this.llmCall) {
      throw new Error('LLM call function not set')
    }

    // 构建提示词
    const conversationText = this.prepareConversationForLLM(messages)
    const prompt = this.buildTextBriefPrompt(conversationText, context)

    const response = await this.llmCall(
      [
        { role: 'system', content: 'You are a conversation summarizer. Generate a concise and informative summary.' },
        { role: 'user', content: prompt }
      ],
      [],
      { model: DEEPSEEK_V4_FLASH_MODEL, maxTokens: this.config.maxLength }
    )

    return response.content
  }

  /**
   * 使用规则生成摘要
   */
  private generateRuleBasedBrief(
    messages: Message[],
    context: BriefContext
  ): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const toolMessages = messages.filter(m => m.role === 'tool')

    const files = this.extractFilesFromMessages(messages)
    const toolStats = this.calculateToolStats(messages)

    switch (this.config.format) {
      case 'markdown':
        return this.generateMarkdownBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
      case 'executive':
        return this.generateExecutiveBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
      case 'plain':
      default:
        return this.generatePlainBrief(userMessages, assistantMessages, toolMessages, files, toolStats, context)
    }
  }

  /**
   * 关联相关记忆
   */
  private async linkRelevantMemories(
    messages: Message[],
    context: BriefContext
  ): Promise<string[]> {
    if (!this.config.memoryIntegration.linkRelevantMemories) {
      return []
    }

    // 如果有相关记忆传入，使用它们
    if (context.relevantMemories && context.relevantMemories.length > 0) {
      return context.relevantMemories
        .filter(m => m.quality >= this.config.memoryIntegration.memoryQualityThreshold)
        .slice(0, this.config.memoryIntegration.maxLinkedMemories)
        .map(m => m.id)
    }

    // 否则从消息中提取关键词进行搜索
    // 这里需要集成MemoryStore的搜索功能
    // 暂时返回空数组
    return []
  }

  // ── 辅助方法 ──

  private prepareConversationForLLM(messages: Message[]): string {
    // 选择最近的消息进行摘要
    const recentMessages = messages.slice(-20) // 最近20条消息

    return recentMessages.map(m => {
      const role = m.role
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `[${role.toUpperCase()}]: ${content.slice(0, 500)}`
    }).join('/n/n')
  }

  private buildStructuredBriefPrompt(conversationText: string, context: BriefContext): string {
    const includeSections = Object.entries(this.config.include)
      .filter(([_, enabled]) => enabled)
      .map(([section]) => section)
      .join(', ')

    return `Generate a structured summary of the following conversation.

Context:
- Session ID: ${context.sessionId}
- Task ID: ${context.taskId || 'N/A'}
- Query: ${context.query?.slice(0, 200) || 'N/A'}

Include these sections: ${includeSections}

Conversation:
${conversationText}

Output JSON with this structure:
{
  "summary": "overall summary text",
  "context": { ... },
  "statistics": { ... },
  "toolUsage": { ... },
  "files": [...],
  "keyDecisions": [...],
  "nextSteps": [...],
  "timestamp": ${Date.now()}
}`
  }

  private buildTextBriefPrompt(conversationText: string, context: BriefContext): string {
    const format = this.config.format
    const includeInstructions = Object.entries(this.config.include)
      .filter(([_, enabled]) => enabled)
      .map(([section]) => {
        switch (section) {
          case 'context': return 'Include context information (session, task, query)'
          case 'statistics': return 'Include message and tool call statistics'
          case 'toolUsage': return 'Include tool usage breakdown'
          case 'files': return 'Include list of files mentioned'
          case 'keyDecisions': return 'Include key technical decisions made'
          case 'nextSteps': return 'Include suggested next steps'
          default: return ''
        }
      })
      .filter(Boolean)
      .join('; ')

    return `Generate a ${format} summary of the following conversation.

${includeInstructions}

Context:
- Session: ${context.sessionId}
- Task: ${context.taskId || 'N/A'}
- Original query: ${context.query?.slice(0, 200) || 'N/A'}

Conversation:
${conversationText}

Generate a concise summary (max ${this.config.maxLength} tokens).`
  }

  private validateStructuredBrief(data: any): Record<string, any> {
    const requiredFields = ['summary']
    const result: Record<string, any> = { summary: '' }

    // 确保必需字段存在
    for (const field of requiredFields) {
      if (data[field] !== undefined) {
        result[field] = data[field]
      }
    }

    // 验证可选字段
    const optionalFields = ['context', 'statistics', 'toolUsage', 'files', 'keyDecisions', 'nextSteps']
    for (const field of optionalFields) {
      if (data[field] !== undefined) {
        result[field] = data[field]
      }
    }

    // 添加时间戳
    result.timestamp = Date.now()

    return result
  }

  private generateDefaultStructuredBrief(
    messages: Message[],
    context: BriefContext
  ): Record<string, any> {
    const userMessages = messages.filter(m => m.role === 'user')
    const toolMessages = messages.filter(m => m.role === 'tool')
    const files = this.extractFilesFromMessages(messages)
    const toolStats = this.calculateToolStats(messages)

    return {
      summary: `Conversation summary for session ${context.sessionId}`,
      context: {
        sessionId: context.sessionId,
        taskId: context.taskId,
        query: context.query
      },
      statistics: {
        totalMessages: messages.length,
        userMessages: userMessages.length,
        toolCalls: toolMessages.length
      },
      toolUsage: toolStats,
      files: files.slice(0, 10),
      keyDecisions: [],
      nextSteps: ['Review the changes', 'Run tests if applicable'],
      timestamp: Date.now()
    }
  }

  private extractFilesFromMessages(messages: Message[]): string[] {
    const files = new Set<string>()
    const filePatterns = [
      /file[_-]?path["']?\s*:\s*["']([^"']+)["']/gi,
      /path["']?\s*:\s*["']([^"']+)["']/gi,
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

    return Array.from(files)
  }

  private calculateToolStats(messages: Message[]): {
    total: number
    byTool: Record<string, number>
    successRate: number
  } {
    const toolMessages = messages.filter(m => m.role === 'tool')
    const byTool: Record<string, number> = {}
    let successCount = 0

    for (const msg of toolMessages) {
      const content = typeof msg.content === 'string' ? msg.content : ''
      const toolMatch = content.match(/Tool: (w+)/)
      const toolName = toolMatch ? toolMatch[1] : 'unknown'
      byTool[toolName] = (byTool[toolName] || 0) + 1

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
    context: BriefContext
  ): string {
    return `# Conversation Summary

## Context
- **Session**: ${context.sessionId}
- **Task**: ${context.taskId || 'N/A'}
- **Query**: ${context.query?.slice(0, 200) || 'N/A'}

## Overview
- **Total messages**: ${userMessages.length + assistantMessages.length + toolMessages.length}
- **User inputs**: ${userMessages.length}
- **Assistant responses**: ${assistantMessages.length}
- **Tool executions**: ${toolMessages.length}

## Tool Usage
${Object.entries(toolStats.byTool).map(([tool, count]) => `- **${tool}**: ${count} call${count !== 1 ? 's' : ''}`).join('/n')}
- **Success rate**: ${(toolStats.successRate * 100).toFixed(1)}%

## Files Involved
${files.length > 0 ? files.map(f => `- ${f}`).join('/n') : 'No files mentioned'}

## Key Points
${userMessages.length > 0 ? `- Started with: ${this.truncateText(userMessages[0]?.content?.toString() || '', 150)}` : ''}
${userMessages.length > 1 ? `- Latest request: ${this.truncateText(userMessages[userMessages.length - 1]?.content?.toString() || '', 150)}` : ''}

## Next Steps
1. Review the changes made
2. Verify tool execution results
3. Consider related tasks`
  }

  private generateExecutiveBrief(
    userMessages: Message[],
    assistantMessages: Message[],
    toolMessages: Message[],
    files: string[],
    toolStats: { total: number; byTool: Record<string, number>; successRate: number },
    context: BriefContext
  ): string {
    return `EXECUTIVE SUMMARY

Session: ${context.sessionId}
Task: ${context.taskId || 'General conversation'}

STATUS: ${toolMessages.length > 0 ? 'Active with tool execution' : 'Discussion only'}

KEY METRICS:
- Messages: ${userMessages.length + assistantMessages.length + toolMessages.length}
- Tool calls: ${toolMessages.length}
- Success rate: ${(toolStats.successRate * 100).toFixed(1)}%
- Files involved: ${files.length}

TOP TOOLS: ${Object.entries(toolStats.byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, c]) => `${t} (${c})`)
      .join(', ')}

SUMMARY: ${userMessages.length > 0 ? this.truncateText(userMessages[0]?.content?.toString() || '', 100) : 'No user input'}

NEXT: Review outcomes and plan next actions.`
  }

  private generatePlainBrief(
    userMessages: Message[],
    assistantMessages: Message[],
    toolMessages: Message[],
    files: string[],
    toolStats: { total: number; byTool: Record<string, number>; successRate: number },
    context: BriefContext
  ): string {
    return `Summary for session ${context.sessionId}

Context:
- Task: ${context.taskId || 'N/A'}
- Query: ${context.query?.slice(0, 100) || 'N/A'}

Stats:
- Messages: ${userMessages.length + assistantMessages.length + toolMessages.length}
- User: ${userMessages.length}, Assistant: ${assistantMessages.length}, Tools: ${toolMessages.length}
- Tool success: ${(toolStats.successRate * 100).toFixed(1)}%

Top tools: ${Object.entries(toolStats.byTool)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([t, c]) => `${t}(${c})`)
      .join(', ')}

Files: ${files.length > 0 ? files.slice(0, 3).join(', ') + (files.length > 3 ? '...' : '') : 'None'}

Key: ${userMessages.length > 0 ? this.truncateText(userMessages[0]?.content?.toString() || '', 80) : 'N/A'}`
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.slice(0, maxLength) + '...'
  }

  // ── 公共方法 ──

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BriefConfig>): void {
    Object.assign(this.config, config)
    console.log(`[BriefGenerator] Config updated`)
  }

  /**
   * 获取配置
   */
  getConfig(): BriefConfig {
    return { ...this.config }
  }
}

// ── 工厂函数 ──

/**
 * 创建Brief Generator实例
 */
export function createBriefGenerator(config?: Partial<BriefConfig>): BriefGenerator {
  return new BriefGenerator(config)
}

/**
 * 创建默认配置的Brief Generator
 */
export function createDefaultBriefGenerator(): BriefGenerator {
  return createBriefGenerator()
}
