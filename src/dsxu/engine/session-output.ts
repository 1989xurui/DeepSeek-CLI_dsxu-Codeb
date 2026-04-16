/**
 * 会话输出格式化层
 * 
 * 负责：
 * 1. 会话数据的格式化输出
 * 2. 摘要和报告的生成
 * 3. 导出功能
 * 4. 可视化表示
 */

import type { Message, AgentSummary } from './types'
import { SessionStore, SessionData, SessionMeta } from './session-state'
import { SessionSummaryManager, SessionMemoryNote } from './session-adapter'
import { AgentSummaryManager } from './session-adapter'

// ── 格式化输出接口 ──

export interface SessionReportOptions {
  /** 是否包含消息历史 */
  includeMessages?: boolean
  /** 消息数量限制 */
  messageLimit?: number
  /** 是否包含摘要 */
  includeSummary?: boolean
  /** 是否包含记忆笔记 */
  includeMemoryNotes?: boolean
  /** 是否包含智能体摘要 */
  includeAgentSummaries?: boolean
  /** 输出格式 */
  format?: 'text' | 'json' | 'markdown'
}

export interface SessionReport {
  /** 会话元数据 */
  meta: SessionMeta
  /** 消息历史（如果包含） */
  messages?: Message[]
  /** 会话摘要（如果包含） */
  summary?: string
  /** 记忆笔记（如果包含） */
  memoryNotes?: SessionMemoryNote[]
  /** 智能体摘要（如果包含） */
  agentSummaries?: AgentSummary[]
  /** 生成时间 */
  generatedAt: number
  /** 报告版本 */
  version: string
}

// ── 会话报告生成器 ──

export class SessionReportGenerator {
  private sessionStore: SessionStore
  private summaryManager?: SessionSummaryManager
  private agentSummaryManager?: AgentSummaryManager

  constructor(
    sessionStore: SessionStore,
    summaryManager?: SessionSummaryManager,
    agentSummaryManager?: AgentSummaryManager
  ) {
    this.sessionStore = sessionStore
    this.summaryManager = summaryManager
    this.agentSummaryManager = agentSummaryManager
  }

  /**
   * 生成会话报告
   */
  async generateReport(
    sessionId: string,
    options: SessionReportOptions = {}
  ): Promise<SessionReport | null> {
    const session = this.sessionStore.load(sessionId)
    if (!session) return null

    const defaults: SessionReportOptions = {
      includeMessages: true,
      messageLimit: 50,
      includeSummary: true,
      includeMemoryNotes: false,
      includeAgentSummaries: true,
      format: 'text',
    }

    const opts = { ...defaults, ...options }

    const report: SessionReport = {
      meta: { ...session.meta },
      generatedAt: Date.now(),
      version: '1.0',
    }

    // 包含消息历史
    if (opts.includeMessages) {
      report.messages = opts.messageLimit
        ? session.messages.slice(-opts.messageLimit)
        : session.messages
    }

    // 包含会话摘要
    if (opts.includeSummary && this.summaryManager) {
      const summary = this.summaryManager.getSessionSummary(this.sessionStore, sessionId)
      if (summary) {
        report.summary = summary
      }
    }

    // 包含记忆笔记
    if (opts.includeMemoryNotes && this.summaryManager) {
      report.memoryNotes = this.summaryManager.getMemoryNotes(sessionId, {
        includeExpired: false,
        limit: 20,
      })
    }

    // 包含智能体摘要
    if (opts.includeAgentSummaries && this.agentSummaryManager) {
      report.agentSummaries = this.agentSummaryManager.getSessionSummaries(sessionId)
    }

    return report
  }

  /**
   * 格式化报告为文本
   */
  formatReportAsText(report: SessionReport, options?: SessionReportOptions): string {
    const lines: string[] = []
    
    lines.push(`# 会话报告: ${report.meta.title}`)
    lines.push(`- 会话ID: ${report.meta.id}`)
    lines.push(`- 创建时间: ${new Date(report.meta.createdAt).toLocaleString()}`)
    lines.push(`- 更新时间: ${new Date(report.meta.updatedAt).toLocaleString()}`)
    lines.push(`- 状态: ${report.meta.status}`)
    lines.push(`- 工作目录: ${report.meta.cwd}`)
    lines.push(`- 消息数量: ${report.meta.messageCount}`)
    
    if (report.meta.totalCost !== undefined) {
      lines.push(`- 总费用: $${report.meta.totalCost.toFixed(4)}`)
    }
    
    if (report.meta.models && report.meta.models.length > 0) {
      lines.push(`- 使用模型: ${report.meta.models.join(', ')}`)
    }
    
    lines.push('')

    // 会话摘要
    if (report.summary) {
      lines.push('## 会话摘要')
      lines.push(report.summary)
      lines.push('')
    }

    // 记忆笔记
    if (report.memoryNotes && report.memoryNotes.length > 0) {
      lines.push('## 关键记忆')
      report.memoryNotes.forEach((note, index) => {
        const tags = note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : ''
        lines.push(`${index + 1}. ${note.content}${tags} (重要性: ${note.importance.toFixed(2)}, 轮次: ${note.turn})`)
      })
      lines.push('')
    }

    // 智能体摘要
    if (report.agentSummaries && report.agentSummaries.length > 0) {
      lines.push('## 智能体执行摘要')
      report.agentSummaries.forEach((agent, index) => {
        lines.push(`### ${agent.agentId} (${agent.status})`)
        lines.push(`- 开始时间: ${new Date(agent.startedAt).toLocaleString()}`)
        if (agent.endedAt) {
          lines.push(`- 结束时间: ${new Date(agent.endedAt).toLocaleString()}`)
          lines.push(`- 持续时间: ${(agent.endedAt - agent.startedAt) / 1000}秒`)
        }
        
        if (agent.keyFindings.length > 0) {
          lines.push('- 关键发现:')
          agent.keyFindings.forEach(finding => lines.push(`  * ${finding}`))
        }
        
        if (agent.errors.length > 0) {
          lines.push('- 错误:')
          agent.errors.forEach(error => lines.push(`  * ${error}`))
        }
        
        lines.push('')
      })
    }

    // 消息历史
    if (report.messages && report.messages.length > 0) {
      lines.push('## 消息历史')
      report.messages.forEach((msg, index) => {
        const prefix = `[${msg.role.toUpperCase()}]`
        const content = typeof msg.content === 'string' 
          ? msg.content.slice(0, 200)
          : JSON.stringify(msg.content).slice(0, 200)
        
        lines.push(`${index + 1}. ${prefix} ${content}`)
        if (content.length >= 200) lines.push('   ...')
      })
    }

    lines.push('')
    lines.push(`---`)
    lines.push(`报告生成时间: ${new Date(report.generatedAt).toLocaleString()}`)
    lines.push(`版本: ${report.version}`)

    return lines.join('\n')
  }

  /**
   * 格式化报告为Markdown
   */
  formatReportAsMarkdown(report: SessionReport): string {
    const text = this.formatReportAsText(report)
    // 简单的文本转Markdown，保持原有结构
    return text
  }

  /**
   * 导出会话报告到文件
   */
  async exportReportToFile(
    sessionId: string,
    filePath: string,
    options: SessionReportOptions = {}
  ): Promise<boolean> {
    try {
      const report = await this.generateReport(sessionId, options)
      if (!report) return false

      const format = options.format || 'text'
      let content: string

      if (format === 'json') {
        content = JSON.stringify(report, null, 2)
      } else if (format === 'markdown') {
        content = this.formatReportAsMarkdown(report)
      } else {
        content = this.formatReportAsText(report, options)
      }

      const fs = await import('fs')
      fs.writeFileSync(filePath, content, 'utf-8')
      return true
    } catch (error) {
      console.error(`导出会话报告失败: ${error}`)
      return false
    }
  }

  /**
   * 生成会话统计信息
   */
  generateSessionStats(sessionId: string): Record<string, any> | null {
    const session = this.sessionStore.load(sessionId)
    if (!session) return null

    const userMessages = session.messages.filter(m => m.role === 'user')
    const assistantMessages = session.messages.filter(m => m.role === 'assistant')
    const toolMessages = session.messages.filter(m => m.role === 'tool')
    const systemMessages = session.messages.filter(m => m.role === 'system')

    const stats = {
      totalMessages: session.messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      toolMessages: toolMessages.length,
      systemMessages: systemMessages.length,
      durationMs: session.meta.updatedAt - session.meta.createdAt,
      durationFormatted: formatDuration(session.meta.updatedAt - session.meta.createdAt),
      status: session.meta.status,
      cost: session.meta.totalCost || 0,
      models: session.meta.models || [],
      hasSummary: !!session.meta.summary,
      summaryVersion: session.meta.summaryVersion || 0,
    }

    return stats
  }

  /**
   * 生成多个会话的对比报告
   */
  generateComparisonReport(sessionIds: string[]): string {
    const sessions = sessionIds
      .map(id => this.sessionStore.load(id))
      .filter((s): s is SessionData => s !== null)

    if (sessions.length === 0) return '没有可用的会话数据'

    const lines: string[] = []
    lines.push('# 会话对比报告')
    lines.push('')

    // 表格头
    lines.push('| 会话ID | 标题 | 状态 | 消息数 | 持续时间 | 费用 |')
    lines.push('|--------|------|------|--------|----------|------|')

    // 表格行
    sessions.forEach(session => {
      const duration = formatDuration(session.meta.updatedAt - session.meta.createdAt)
      const cost = session.meta.totalCost ? `$${session.meta.totalCost.toFixed(4)}` : 'N/A'
      
      lines.push(`| ${session.meta.id.slice(0, 8)}... | ${session.meta.title.slice(0, 30)} | ${session.meta.status} | ${session.meta.messageCount} | ${duration} | ${cost} |`)
    })

    lines.push('')

    // 统计信息
    const totalMessages = sessions.reduce((sum, s) => sum + s.meta.messageCount, 0)
    const totalCost = sessions.reduce((sum, s) => sum + (s.meta.totalCost || 0), 0)
    const avgMessages = totalMessages / sessions.length
    const avgCost = totalCost / sessions.length

    lines.push('## 统计摘要')
    lines.push(`- 总会话数: ${sessions.length}`)
    lines.push(`- 总消息数: ${totalMessages}`)
    lines.push(`- 平均消息数: ${avgMessages.toFixed(1)}`)
    lines.push(`- 总费用: $${totalCost.toFixed(4)}`)
    lines.push(`- 平均费用: $${avgCost.toFixed(4)}`)
    lines.push(`- 活动会话: ${sessions.filter(s => s.meta.status === 'active').length}`)
    lines.push(`- 完成会话: ${sessions.filter(s => s.meta.status === 'completed').length}`)

    return lines.join('\n')
  }
}

// ── 工具函数 ──

/**
 * 格式化持续时间
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * 生成会话概览卡片（用于CLI显示）
 */
export function generateSessionCard(session: SessionData): string {
  const lines: string[] = []
  
  lines.push(`┌─ 会话: ${session.meta.id}`)
  lines.push(`│ 标题: ${session.meta.title}`)
  lines.push(`│ 状态: ${session.meta.status}`)
  lines.push(`│ 消息: ${session.meta.messageCount} 条`)
  lines.push(`│ 创建: ${new Date(session.meta.createdAt).toLocaleString()}`)
  lines.push(`│ 更新: ${new Date(session.meta.updatedAt).toLocaleString()}`)
  
  if (session.meta.totalCost !== undefined) {
    lines.push(`│ 费用: $${session.meta.totalCost.toFixed(4)}`)
  }
  
  if (session.meta.summary) {
    lines.push(`│ 摘要: ${session.meta.summary.slice(0, 60)}...`)
  }
  
  lines.push(`└─ 目录: ${session.meta.cwd}`)
  
  return lines.join('\n')
}

/**
 * 生成会话列表表格
 */
export function generateSessionTable(sessions: SessionMeta[]): string {
  if (sessions.length === 0) return '没有会话数据'

  const lines: string[] = []
  lines.push('┌──────────┬──────────────────────────────┬────────┬──────┬─────────────────────┐')
  lines.push('│ ID       │ 标题                         │ 状态   │ 消息 │ 更新时间           │')
  lines.push('├──────────┼──────────────────────────────┼────────┼──────┼─────────────────────┤')

  sessions.forEach(session => {
    const id = session.id.slice(0, 8)
    const title = session.title.length > 25 ? session.title.slice(0, 22) + '...' : session.title.padEnd(25)
    const status = session.status.slice(0, 6).padEnd(6)
    const messages = session.messageCount.toString().padStart(4)
    const time = new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    
    lines.push(`│ ${id}... │ ${title} │ ${status} │ ${messages} │ ${time.padEnd(19)} │`)
  })

  lines.push('└──────────┴──────────────────────────────┴────────┴──────┴─────────────────────┘')
  
  return lines.join('\n')
}
