/**
 * 会话模型适配层
 * 
 * 负责：
 * 1. 会话摘要生成和管理
 * 2. 智能体摘要管理
 * 3. 与LLM模型的交互适配
 * 4. 会话记忆功能
 */

import type {
  Message,
  AgentSummary,
  AgentStatus,
  AgentSummaryConfig,
  QueryResult,
  QueryEvent
} from './types'
import { SessionStore, SessionData } from './session-state'

// ── Session Summary 功能 ──

/**
 * 会话摘要配置
 */
export interface SessionSummaryConfig {
  /** 每多少轮更新一次摘要（默认10轮） */
  updateInterval: number
  /** 最大摘要长度（字符） */
  maxLength: number
  /** 是否启用摘要功能 */
  enabled: boolean
}

const DEFAULT_SUMMARY_CONFIG: SessionSummaryConfig = {
  updateInterval: 10,
  maxLength: 1000,
  enabled: true,
}

/**
 * 会话记忆笔记接口
 */
export interface SessionMemoryNote {
  /** 记忆ID */
  id: string
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
  /** 记忆内容 */
  content: string
  /** 记忆标签/分类 */
  tags: string[]
  /** 关联的轮次 */
  turn: number
  /** 重要性评分 (0-1) */
  importance: number
  /** 是否已过期 */
  expired: boolean
}

/**
 * 会话摘要管理器（增强版：包含会话记忆功能）
 */
export class SessionSummaryManager {
  private config: SessionSummaryConfig
  private llmCall?: (messages: any[], tools: any[], options: any) => Promise<any>
  /** 会话记忆笔记缓存 */
  private memoryNotes: Map<string, SessionMemoryNote[]> = new Map()

  constructor(
    config?: Partial<SessionSummaryConfig>,
    llmCall?: (messages: any[], tools: any[], options: any) => Promise<any>
  ) {
    this.config = { ...DEFAULT_SUMMARY_CONFIG, ...config }
    this.llmCall = llmCall
  }

  /**
   * 检查是否需要更新摘要
   */
  shouldUpdateSummary(
    currentTurn: number,
    lastSummaryTurn?: number,
    force: boolean = false
  ): boolean {
    if (!this.config.enabled) return false
    if (force) return true
    if (lastSummaryTurn === undefined) return true
    return currentTurn - lastSummaryTurn >= this.config.updateInterval
  }

  /**
   * 生成会话摘要
   */
  async generateSummary(
    messages: Message[],
    sessionId: string,
    currentTurn: number
  ): Promise<string> {
    if (!this.llmCall) {
      return this.generateSimpleSummary(messages)
    }

    try {
      // 使用LLM生成更智能的摘要
      const recentMessages = messages.slice(-20) // 取最近20条消息
      const conversationText = recentMessages.map(m => {
        const role = m.role
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `[${role}]: ${content.slice(0, 500)}`
      }).join('\n\n')

      const response = await this.llmCall(
        [
          {
            role: 'system',
            content: `你是一个会话摘要生成器。请分析以下对话并生成简洁的摘要，包含：
1. 会话的主要目标
2. 已完成的步骤
3. 当前状态
4. 下一步建议

摘要长度不超过${this.config.maxLength}字符。`
          },
          {
            role: 'user',
            content: `请为以下会话生成摘要（会话ID: ${sessionId}, 当前轮次: ${currentTurn}）:\n\n${conversationText}`
          }
        ],
        [],
        { model: 'deepseek-chat', maxTokens: 500 }
      )

      return response.content.slice(0, this.config.maxLength)
    } catch (error: any) {
      console.warn(`[SessionSummary] LLM摘要生成失败: ${error.message}`)
      return this.generateSimpleSummary(messages)
    }
  }

  /**
   * 生成简单摘要（回退方案）
   */
  private generateSimpleSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user')
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const toolMessages = messages.filter(m => m.role === 'tool')

    return `会话摘要:
- 总消息数: ${messages.length}
- 用户消息: ${userMessages.length} 条
- 助手回复: ${assistantMessages.length} 条
- 工具调用: ${toolMessages.length} 次
- 最后用户消息: ${userMessages.length > 0 ? (typeof userMessages[userMessages.length - 1].content === 'string' ? userMessages[userMessages.length - 1].content.slice(0, 100) : '[...]') : '无'}`
  }

  /**
   * 更新会话摘要
   */
  async updateSessionSummary(
    sessionStore: SessionStore,
    sessionId: string,
    messages: Message[],
    currentTurn: number,
    force: boolean = false
  ): Promise<boolean> {
    if (!this.config.enabled) return false

    const session = sessionStore.load(sessionId)
    if (!session) return false

    const lastSummaryTurn = session.meta.summaryVersion || 0
    if (!this.shouldUpdateSummary(currentTurn, lastSummaryTurn, force)) {
      return false
    }

    try {
      const summary = await this.generateSummary(messages, sessionId, currentTurn)

      session.meta.summary = summary
      session.meta.summaryUpdatedAt = Date.now()
      session.meta.summaryVersion = currentTurn

      sessionStore.save(session)

      console.log(`[SessionSummary] 更新会话 ${sessionId} 摘要 (轮次 ${currentTurn})`)
      return true
    } catch (error: any) {
      console.warn(`[SessionSummary] 更新摘要失败: ${error.message}`)
      return false
    }
  }

  /**
   * 获取会话摘要
   */
  getSessionSummary(sessionStore: SessionStore, sessionId: string): string | null {
    const session = sessionStore.load(sessionId)
    if (!session) return null

    return session.meta.summary || null
  }

  /**
   * 获取配置
   */
  getConfig(): SessionSummaryConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SessionSummaryConfig>): void {
    this.config = { ...this.config, ...config }
  }

  // ── 会话记忆功能 ──

  /**
   * 添加会话记忆笔记
   */
  addMemoryNote(
    sessionId: string,
    content: string,
    turn: number,
    tags: string[] = [],
    importance: number = 0.5
  ): SessionMemoryNote {
    const note: SessionMemoryNote = {
      id: `memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content,
      tags,
      turn,
      importance,
      expired: false,
    }

    const notes = this.memoryNotes.get(sessionId) || []
    notes.push(note)
    this.memoryNotes.set(sessionId, notes)

    return note
  }

  /**
   * 获取会话记忆笔记
   */
  getMemoryNotes(
    sessionId: string,
    options?: {
      /** 最小重要性阈值 */
      minImportance?: number
      /** 是否包含过期笔记 */
      includeExpired?: boolean
      /** 标签过滤 */
      tags?: string[]
      /** 最大数量 */
      limit?: number
    }
  ): SessionMemoryNote[] {
    const notes = this.memoryNotes.get(sessionId) || []
    let filtered = notes

    if (options?.minImportance !== undefined) {
      filtered = filtered.filter(note => note.importance >= options.minImportance!)
    }

    if (!options?.includeExpired) {
      filtered = filtered.filter(note => !note.expired)
    }

    if (options?.tags && options.tags.length > 0) {
      filtered = filtered.filter(note =>
        note.tags.some(tag => options.tags!.includes(tag))
      )
    }

    if (options?.limit !== undefined) {
      filtered = filtered.slice(0, options.limit)
    }

    return filtered.sort((a, b) => b.importance - a.importance)
  }

  /**
   * 更新记忆笔记
   */
  updateMemoryNote(
    sessionId: string,
    noteId: string,
    updates: Partial<Omit<SessionMemoryNote, 'id' | 'createdAt'>>
  ): boolean {
    const notes = this.memoryNotes.get(sessionId)
    if (!notes) return false

    const index = notes.findIndex(note => note.id === noteId)
    if (index === -1) return false

    notes[index] = {
      ...notes[index],
      ...updates,
      updatedAt: Date.now(),
    }

    return true
  }

  /**
   * 删除记忆笔记
   */
  deleteMemoryNote(sessionId: string, noteId: string): boolean {
    const notes = this.memoryNotes.get(sessionId)
    if (!notes) return false

    const initialLength = notes.length
    const filtered = notes.filter(note => note.id !== noteId)

    if (filtered.length === initialLength) return false

    this.memoryNotes.set(sessionId, filtered)
    return true
  }

  /**
   * 清理过期记忆笔记
   */
  cleanupExpiredMemoryNotes(sessionId: string, maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const notes = this.memoryNotes.get(sessionId)
    if (!notes) return 0

    const now = Date.now()
    const expiredCount = notes.filter(note => now - note.createdAt > maxAgeMs).length

    const filtered = notes.filter(note => now - note.createdAt <= maxAgeMs)
    this.memoryNotes.set(sessionId, filtered)

    return expiredCount
  }

  /**
   * 获取会话记忆摘要（用于注入到提示中）
   */
  getMemorySummary(
    sessionId: string,
    maxLength: number = 500
  ): string {
    const notes = this.getMemoryNotes(sessionId, {
      minImportance: 0.3,
      includeExpired: false,
      limit: 10,
    })

    if (notes.length === 0) {
      return ''
    }

    const summary = notes.map((note, index) => {
      const tags = note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : ''
      return `${index + 1}. ${note.content.slice(0, 100)}${tags} (重要性: ${note.importance.toFixed(2)})`
    }).join('\n')

    return summary.length > maxLength
      ? summary.slice(0, maxLength - 3) + '...'
      : summary
  }

  /**
   * 自动生成记忆笔记（基于消息分析）
   */
  async generateMemoryNotesFromMessages(
    sessionId: string,
    messages: Message[],
    currentTurn: number,
    llmCall?: (messages: any[], tools: any[], options: any) => Promise<any>
  ): Promise<SessionMemoryNote[]> {
    const effectiveLlmCall = llmCall || this.llmCall
    if (!effectiveLlmCall) {
      return this.generateSimpleMemoryNotes(messages, currentTurn)
    }

    try {
      const recentMessages = messages.slice(-15)
      const conversationText = recentMessages.map(m => {
        const role = m.role
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
        return `[${role}]: ${content.slice(0, 300)}`
      }).join('\n\n')

      const response = await effectiveLlmCall(
        [
          {
            role: 'system',
            content: `你是一个会话记忆提取器。请分析对话并提取关键记忆点，每个记忆点应包含：
1. 简洁的描述（不超过50字）
2. 重要性评分（0.1-1.0）
3. 相关标签（如：decision, fact, todo, insight, warning）

格式要求：每个记忆点一行，格式为：描述 | 重要性 | 标签1,标签2,标签3`
          },
          {
            role: 'user',
            content: `请从以下对话中提取关键记忆点（会话轮次: ${currentTurn}）:\n\n${conversationText}`
          }
        ],
        [],
        { model: 'deepseek-chat', maxTokens: 800 }
      )

      const content = response.content
      const lines = content.split('\n').filter((line: string) => line.trim() && line.includes('|'))
      const notes: SessionMemoryNote[] = []

      for (const line of lines) {
        const parts = line.split('|').map((part: string) => part.trim())
        if (parts.length >= 3) {
          const [content, importanceStr, tagsStr] = parts
          const importance = Math.min(1, Math.max(0.1, parseFloat(importanceStr) || 0.5))
          const tags = tagsStr.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag)

          notes.push(this.addMemoryNote(sessionId, content, currentTurn, tags, importance))
        }
      }

      return notes
    } catch (error: any) {
      console.warn(`[SessionMemory] LLM记忆提取失败: ${error.message}`)
      return this.generateSimpleMemoryNotes(messages, currentTurn)
    }
  }

  /**
   * 生成简单记忆笔记（回退方案）
   */
  private generateSimpleMemoryNotes(
    messages: Message[],
    currentTurn: number
  ): SessionMemoryNote[] {
    const notes: SessionMemoryNote[] = []
    const userMessages = messages.filter(m => m.role === 'user')
    const toolMessages = messages.filter(m => m.role === 'tool')

    if (userMessages.length > 0) {
      const lastUser = userMessages[userMessages.length - 1]
      const content = typeof lastUser.content === 'string'
        ? lastUser.content.slice(0, 100)
        : '用户请求'
      notes.push(this.addMemoryNote('temp', `最新用户请求: ${content}`, currentTurn, ['user-request'], 0.7))
    }

    if (toolMessages.length > 0) {
      notes.push(this.addMemoryNote('temp', `已执行 ${toolMessages.length} 次工具调用`, currentTurn, ['tool-execution'], 0.6))
    }

    return notes
  }
}

// ── Agent Summary Manager ──

/**
 * 智能体摘要管理器
 */
export class AgentSummaryManager {
  private summaries: Map<string, AgentSummary[]> = new Map()
  private config: Required<AgentSummaryConfig>

  constructor(config?: AgentSummaryConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      template: config?.template ?? 'standard',
      autoGenerate: config?.autoGenerate ?? true,
      minLength: config?.minLength ?? 100,
      maxLength: config?.maxLength ?? 1000,
    }
  }

  /**
   * 创建智能体摘要
   */
  createSummary(
    agentId: string,
    parentSessionId: string,
    status: AgentStatus,
    keyFindings: string[] = [],
    actions: string[] = [],
    errors: string[] = [],
    metadata: Partial<AgentSummary['metadata']> = {}
  ): AgentSummary {
    const now = Date.now()
    const summary: AgentSummary = {
      agentId,
      parentSessionId,
      startedAt: now,
      endedAt: now,
      status,
      keyFindings,
      actions,
      errors,
      metadata: {
        totalTurns: 0,
        toolsUsed: [],
        success: status === 'completed',
        ...metadata,
      },
    }

    const sessionSummaries = this.summaries.get(parentSessionId) || []
    sessionSummaries.push(summary)
    this.summaries.set(parentSessionId, sessionSummaries)

    return summary
  }

  /**
   * 更新智能体摘要
   */
  updateSummary(
    parentSessionId: string,
    agentId: string,
    updates: Partial<AgentSummary>
  ): boolean {
    const sessionSummaries = this.summaries.get(parentSessionId)
    if (!sessionSummaries) return false

    const index = sessionSummaries.findIndex(s => s.agentId === agentId)
    if (index === -1) return false

    sessionSummaries[index] = {
      ...sessionSummaries[index],
      ...updates,
    }

    return true
  }

  /**
   * 获取会话的所有智能体摘要
   */
  getSessionSummaries(parentSessionId: string): AgentSummary[] {
    return this.summaries.get(parentSessionId) || []
  }

  /**
   * 获取特定智能体摘要
   */
  getAgentSummary(parentSessionId: string, agentId: string): AgentSummary | null {
    const sessionSummaries = this.summaries.get(parentSessionId)
    if (!sessionSummaries) return null

    return sessionSummaries.find(s => s.agentId === agentId) || null
  }

  /**
   * 生成标准摘要文本
   */
  generateSummaryText(summary: AgentSummary): string {
    if (this.config.template === 'minimal') {
      return this.generateMinimalSummary(summary)
    }

    // 标准模板
    const lines: string[] = []
    lines.push(`# 智能体摘要: ${summary.agentId}`)
    lines.push(`- 状态: ${summary.status}`)
    lines.push(`- 父会话: ${summary.parentSessionId}`)
    lines.push(`- 持续时间: ${summary.endedAt ? (summary.endedAt - summary.startedAt) / 1000 : 'N/A'}秒`)

    if (summary.keyFindings.length > 0) {
      lines.push('## 关键发现')
      summary.keyFindings.forEach((finding, i) => {
        lines.push(`${i + 1}. ${finding}`)
      })
    }

    if (summary.actions.length > 0) {
      lines.push('## 执行操作')
      summary.actions.forEach((action, i) => {
        lines.push(`${i + 1}. ${action}`)
      })
    }

    if (summary.errors.length > 0) {
      lines.push('## 错误信息')
      summary.errors.forEach((error, i) => {
        lines.push(`${i + 1}. ${error}`)
      })
    }

    if (summary.metadata.toolsUsed.length > 0) {
      lines.push(`## 使用工具: ${summary.metadata.toolsUsed.join(', ')}`)
    }

    const text = lines.join('\n')
    return this.truncateSummary(text)
  }

  /**
   * 生成最小摘要（失败时使用）
   */
  private generateMinimalSummary(summary: AgentSummary): string {
    const base = `Agent ${summary.agentId}: ${summary.status}`

    if (summary.errors.length > 0) {
      return `${base} | Errors: ${summary.errors[0]}`
    }

    if (summary.keyFindings.length > 0) {
      return `${base} | Key: ${summary.keyFindings[0]}`
    }

    return base
  }

  /**
   * 截断摘要文本到配置的长度
   */
  private truncateSummary(text: string): string {
    if (text.length <= this.config.maxLength) {
      return text
    }

    return text.slice(0, this.config.maxLength - 3) + '...'
  }

  /**
   * 从查询结果生成智能体摘要
   */
  generateSummaryFromQueryResult(
    agentId: string,
    parentSessionId: string,
    result: QueryResult,
    events: QueryEvent[] = []
  ): AgentSummary {
    // 确定状态
    let status: AgentStatus = 'completed'
    if (result.exitReason === 'max_turns') status = 'timeout'
    if (result.exitReason === 'aborted') status = 'aborted'
    if (result.exitReason === 'max_errors') status = 'failed'

    // 提取关键信息
    const keyFindings: string[] = []
    const actions: string[] = []
    const errors: string[] = []

    // 从事件中提取信息
    const toolStarts = events.filter(e => e.type === 'tool_start')
    const toolResults = events.filter(e => e.type === 'tool_result')
    const toolErrors = events.filter(e => e.type === 'error')
    const rollbacks = events.filter(e => e.type === 'transaction_rolled_back')

    if (toolStarts.length > 0) {
      actions.push(`执行了 ${toolStarts.length} 次工具调用`)
    }

    if (toolErrors.length > 0) {
      errors.push(`遇到 ${toolErrors.length} 个错误`)
    }

    if (rollbacks.length > 0) {
      errors.push(`发生了 ${rollbacks.length} 次事务回滚`)
    }

    // 从最终消息中提取关键发现
    if (result.finalMessage && result.finalMessage.length > 0) {
      const message = result.finalMessage.slice(0, 200)
      keyFindings.push(`最终结果: ${message}`)
    }

    // 收集使用的工具
    const toolsUsed = Array.from(new Set(toolStarts.map(e =>
      e.type === 'tool_start' ? e.toolName : ''
    ))).filter(Boolean)

    const metadata: AgentSummary['metadata'] = {
      totalTurns: result.turns,
      toolsUsed,
      success: status === 'completed',
      errorCode: status === 'failed' ? 'MAX_ERRORS' : undefined,
      performance: {
        durationMs: result.totalUsage ? (result.totalUsage.inputTokens + result.totalUsage.outputTokens) * 0.1 : 0, // 估算
        tokensUsed: result.totalUsage ? result.totalUsage.inputTokens + result.totalUsage.outputTokens : 0,
        toolCalls: toolStarts.length,
      },
    }

    return this.createSummary(
      agentId,
      parentSessionId,
      status,
      keyFindings,
      actions,
      errors,
      metadata
    )
  }

  /**
   * 获取配置
   */
  getConfig(): Required<AgentSummaryConfig> {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentSummaryConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
