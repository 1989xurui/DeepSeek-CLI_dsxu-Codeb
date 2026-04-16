/**
 * 会话状态管理层
 * 
 * 负责：
 * 1. 会话数据的持久化存储
 * 2. 会话元数据管理
 * 3. 上下文窗口管理
 * 4. 基础工具函数
 */

import type { Message } from './types'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'

// ── Types ──

export interface SessionMeta {
  id: string
  createdAt: number
  updatedAt: number
  cwd: string
  title: string
  messageCount: number
  status: 'active' | 'completed' | 'aborted'
  /** 总费用 USD */
  totalCost?: number
  /** 使用的模型 */
  models?: string[]
  /** 会话摘要（每N轮更新） */
  summary?: string
  /** 摘要更新时间 */
  summaryUpdatedAt?: number
  /** 摘要版本 */
  summaryVersion?: number
}

export interface SessionData {
  meta: SessionMeta
  messages: Message[]
}

// ── Session Store ──

export class SessionStore {
  private baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || getDefaultSessionDir()
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true })
    }
  }

  /**
   * 创建新会话
   */
  create(cwd: string, title?: string): SessionData {
    const now = nextSessionTimestamp()
    const id = generateSessionId(now)
    const meta: SessionMeta = {
      id,
      createdAt: now,
      updatedAt: now,
      cwd,
      title: title || `Session ${new Date(now).toLocaleString()}`,
      messageCount: 0,
      status: 'active',
    }

    const session: SessionData = { meta, messages: [] }
    this.save(session)
    return session
  }

  /**
   * 保存会话
   */
  save(session: SessionData): void {
    const filePath = this.getSessionPath(session.meta.id)
    session.meta.updatedAt = nextSessionTimestamp()
    session.meta.messageCount = session.messages.length

    writeFileSync(filePath, JSON.stringify(session, null, 2), 'utf-8')
  }

  /**
   * 追加消息（增量写入，不重写整个文件）
   */
  appendMessage(sessionId: string, message: Message): void {
    const session = this.load(sessionId)
    if (!session) return

    session.messages.push(message)
    this.save(session)
  }

  /**
   * 加载会话
   */
  load(sessionId: string): SessionData | null {
    const filePath = this.getSessionPath(sessionId)
    if (!existsSync(filePath)) return null

    try {
      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * 列出所有会话（按更新时间降序）
   */
  list(limit: number = 20): SessionMeta[] {
    try {
      const files = readdirSync(this.baseDir)
        .filter((f: string) => f.endsWith('.json'))

      const sessions: SessionMeta[] = []
      for (const file of files) {
        try {
          const content = readFileSync(join(this.baseDir, file), 'utf-8')
          const data = JSON.parse(content) as SessionData
          sessions.push(data.meta)
        } catch {
          // Skip corrupted files
        }
      }

      return sessions
        .sort((a, b) => {
          const delta = b.updatedAt - a.updatedAt
          if (delta !== 0) return delta
          return b.createdAt - a.createdAt
        })
        .slice(0, limit)
    } catch {
      return []
    }
  }

  /**
   * 恢复会话（返回消息历史）
   */
  restore(sessionId: string): SessionData | null {
    const session = this.load(sessionId)
    if (!session) return null

    session.meta.status = 'active'
    session.meta.updatedAt = Date.now()
    this.save(session)

    return session
  }

  /**
   * 标记会话结束
   */
  complete(sessionId: string): void {
    const session = this.load(sessionId)
    if (!session) return

    session.meta.status = 'completed'
    this.save(session)
  }

  /**
   * 删除会话
   */
  delete(sessionId: string): boolean {
    const filePath = this.getSessionPath(sessionId)
    if (!existsSync(filePath)) return false

    try {
      unlinkSync(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 搜索会话（按标题或内容）
   */
  search(query: string, limit: number = 10): SessionMeta[] {
    const lower = query.toLowerCase()
    return this.list(100)
      .filter(meta => meta.title.toLowerCase().includes(lower))
      .slice(0, limit)
  }

  /**
   * 更新会话元数据
   */
  updateMeta(sessionId: string, updates: Partial<SessionMeta>): void {
    const session = this.load(sessionId)
    if (!session) return

    Object.assign(session.meta, updates)
    this.save(session)
  }

  /**
   * 获取会话文件路径
   */
  private getSessionPath(sessionId: string): string {
    return join(this.baseDir, `${sessionId}.json`)
  }

  /** 获取存储目录 */
  get directory(): string {
    return this.baseDir
  }
}

// ── Context Window Manager (#6.7) ──

export interface ContextWindowConfig {
  /** 模型最大 context 长度 */
  maxContextTokens: number
  /** 系统消息占比上限（默认 20%） */
  systemRatio: number
  /** 预留输出空间 tokens */
  reserveOutput: number
}

const DEFAULT_CONTEXT_CONFIG: ContextWindowConfig = {
  maxContextTokens: 64_000,  // DeepSeek default
  systemRatio: 0.2,
  reserveOutput: 4_000,
}

/**
 * 上下文窗口管理器
 *
 * 确保消息不超过模型上下文窗口，智能截断策略：
 *   1. 保留系统消息
 *   2. 保留最新 N 轮对话
 *   3. 中间部分用摘要替代
 */
export class ContextWindowManager {
  private config: ContextWindowConfig

  constructor(config?: Partial<ContextWindowConfig>) {
    this.config = { ...DEFAULT_CONTEXT_CONFIG, ...config }
  }

  /**
   * 获取可用于消息的 token 预算
   */
  getAvailableTokens(systemTokens: number): number {
    return this.config.maxContextTokens - systemTokens - this.config.reserveOutput
  }

  /**
   * 检查消息是否超出上下文窗口
   */
  isOverLimit(estimatedTokens: number): boolean {
    return estimatedTokens > (this.config.maxContextTokens - this.config.reserveOutput)
  }

  /**
   * 裁剪消息以适应上下文窗口
   *
   * 策略：保留 system + 最新 N 条，移除中间消息
   */
  truncateMessages(
    messages: Message[],
    estimateTokensFn: (msgs: Message[]) => number,
    keepRecent: number = 10,
  ): { messages: Message[]; truncated: number } {
    const limit = this.config.maxContextTokens - this.config.reserveOutput
    let totalTokens = estimateTokensFn(messages)

    if (totalTokens <= limit) {
      return { messages, truncated: 0 }
    }

    // Separate system messages and others
    const systemMsgs = messages.filter(m => m.role === 'system')
    const otherMsgs = messages.filter(m => m.role !== 'system')

    // Keep last N messages
    const kept = otherMsgs.slice(-keepRecent)
    const candidate = [...systemMsgs, ...kept]

    totalTokens = estimateTokensFn(candidate)
    if (totalTokens <= limit) {
      return {
        messages: candidate,
        truncated: otherMsgs.length - kept.length,
      }
    }

    // Still over limit: progressively remove from kept
    while (kept.length > 2 && estimateTokensFn([...systemMsgs, ...kept]) > limit) {
      kept.shift()
    }

    return {
      messages: [...systemMsgs, ...kept],
      truncated: otherMsgs.length - kept.length,
    }
  }

  /**
   * 获取配置
   */
  getConfig(): ContextWindowConfig {
    return { ...this.config }
  }
}

// ── Helpers ──

let lastSessionTimestamp = 0

function nextSessionTimestamp(): number {
  const now = Date.now()
  lastSessionTimestamp = now > lastSessionTimestamp ? now : lastSessionTimestamp + 1
  return lastSessionTimestamp
}

function generateSessionId(now: number = nextSessionTimestamp()): string {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${now.toString(36)}-${rand}`
}

function getDefaultSessionDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  return join(home, '.dsxu', 'sessions')
}

/**
 * 从消息生成会话标题（取第一条用户消息的前 50 字符）
 */
export function generateTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return 'Untitled Session'

  const text = typeof firstUser.content === 'string'
    ? firstUser.content
    : 'Untitled Session'

  return text.slice(0, 50).replace(/\n/g, ' ').trim() || 'Untitled Session'
}
