/**
 * #7.3 Telemetry + #7.4 Error Reporting + #7.9 Notification System
 *
 * 本地遥测和错误跟踪（不上报外部服务）：
 *   - 记录关键事件（会话启动、工具使用、错误、费用）
 *   - 错误聚合和去重
 *   - 通知队列（非阻塞用户提示）
 */

// ── Telemetry Events ──

export interface TelemetryEvent {
  type: string
  timestamp: number
  sessionId: string
  data: Record<string, any>
}

export interface TransactionTelemetrySummary {
  startedCount: number
  committedCount: number
  rolledBackCount: number
  rolledBackFiles: number
}

export class TelemetryCollector {
  private events: TelemetryEvent[] = []
  private sessionId: string
  private enabled: boolean
  private maxEvents: number

  constructor(sessionId: string, enabled: boolean = true, maxEvents: number = 1000) {
    this.sessionId = sessionId
    this.enabled = enabled
    this.maxEvents = maxEvents
  }

  /**
   * 记录事件
   */
  track(type: string, data: Record<string, any> = {}): void {
    if (!this.enabled) return

    this.events.push({
      type,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      data,
    })

    // Evict old events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  /**
   * 获取事件统计
   */
  getSummary(): Record<string, number> {
    const counts: Record<string, number> = {}
    for (const e of this.events) {
      counts[e.type] = (counts[e.type] || 0) + 1
    }
    return counts
  }

  /**
   * 事务相关统计摘要
   */
  getTransactionSummary(): TransactionTelemetrySummary {
    const summary: TransactionTelemetrySummary = {
      startedCount: 0,
      committedCount: 0,
      rolledBackCount: 0,
      rolledBackFiles: 0,
    }

    for (const e of this.events) {
      if (e.type === 'transaction_started') {
        summary.startedCount += 1
      } else if (e.type === 'transaction_committed') {
        summary.committedCount += 1
      } else if (e.type === 'transaction_rolled_back') {
        summary.rolledBackCount += 1
        const files =
          typeof e.data.filesChangedCount === 'number'
            ? e.data.filesChangedCount
            : Array.isArray(e.data.filesChanged)
              ? e.data.filesChanged.length
              : 0
        summary.rolledBackFiles += files
      }
    }

    return summary
  }

  /**
   * 获取指定类型事件
   */
  getEvents(type?: string): TelemetryEvent[] {
    if (!type) return [...this.events]
    return this.events.filter(e => e.type === type)
  }

  /**
   * 获取会话持续时间
   */
  getSessionDuration(): number {
    if (this.events.length < 2) return 0
    return this.events[this.events.length - 1].timestamp - this.events[0].timestamp
  }

  get size(): number {
    return this.events.length
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  reset(): void {
    this.events = []
  }
}

// ── Error Reporting ──

export interface ErrorReport {
  message: string
  stack?: string
  context: string
  timestamp: number
  count: number
  firstSeen: number
  lastSeen: number
}

export class ErrorReporter {
  private errors: Map<string, ErrorReport> = new Map()
  private maxErrors: number

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors
  }

  /**
   * 报告错误（自动去重聚合）
   */
  report(error: Error | string, context: string = 'unknown'): void {
    const message = typeof error === 'string' ? error : error.message
    const stack = typeof error === 'string' ? undefined : error.stack
    const key = `${context}:${message}`
    const now = Date.now()

    const existing = this.errors.get(key)
    if (existing) {
      existing.count++
      existing.lastSeen = now
    } else {
      // Evict oldest if at capacity
      if (this.errors.size >= this.maxErrors) {
        const oldest = [...this.errors.entries()]
          .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0]
        if (oldest) this.errors.delete(oldest[0])
      }

      this.errors.set(key, {
        message,
        stack,
        context,
        timestamp: now,
        count: 1,
        firstSeen: now,
        lastSeen: now,
      })
    }
  }

  /**
   * 获取所有错误（按频率排序）
   */
  getErrors(): ErrorReport[] {
    return [...this.errors.values()].sort((a, b) => b.count - a.count)
  }

  /**
   * 获取最常见的错误
   */
  getTopErrors(n: number = 5): ErrorReport[] {
    return this.getErrors().slice(0, n)
  }

  /**
   * 获取错误总数
   */
  get totalCount(): number {
    return [...this.errors.values()].reduce((sum, e) => sum + e.count, 0)
  }

  get uniqueCount(): number {
    return this.errors.size
  }

  /**
   * 格式化错误报告
   */
  formatReport(): string {
    const errors = this.getErrors()
    if (errors.length === 0) return 'No errors recorded.'

    const lines = [`Error Report (${this.totalCount} total, ${this.uniqueCount} unique):\n`]
    for (const err of errors.slice(0, 10)) {
      lines.push(`  [${err.count}x] ${err.context}: ${err.message}`)
      if (err.count > 1) {
        lines.push(`       First: ${new Date(err.firstSeen).toISOString()}, Last: ${new Date(err.lastSeen).toISOString()}`)
      }
    }
    return lines.join('\n')
  }

  reset(): void {
    this.errors.clear()
  }
}

// ── Notification System ──

export type NotificationLevel = 'info' | 'warning' | 'error' | 'success'

export interface Notification {
  id: string
  level: NotificationLevel
  message: string
  timestamp: number
  read: boolean
  action?: string  // Optional action label
}

export class NotificationManager {
  private notifications: Notification[] = []
  private maxNotifications: number
  private onNotify?: (notification: Notification) => void

  constructor(maxNotifications: number = 50, onNotify?: (n: Notification) => void) {
    this.maxNotifications = maxNotifications
    this.onNotify = onNotify
  }

  /**
   * 添加通知
   */
  notify(level: NotificationLevel, message: string, action?: string): Notification {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level,
      message,
      timestamp: Date.now(),
      read: false,
      action,
    }

    this.notifications.push(notification)

    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(-this.maxNotifications)
    }

    this.onNotify?.(notification)
    return notification
  }

  info(message: string): Notification { return this.notify('info', message) }
  warn(message: string): Notification { return this.notify('warning', message) }
  error(message: string): Notification { return this.notify('error', message) }
  success(message: string): Notification { return this.notify('success', message) }

  /**
   * 标记已读
   */
  markRead(id: string): void {
    const n = this.notifications.find(n => n.id === id)
    if (n) n.read = true
  }

  markAllRead(): void {
    for (const n of this.notifications) n.read = true
  }

  /**
   * 获取未读通知
   */
  getUnread(): Notification[] {
    return this.notifications.filter(n => !n.read)
  }

  /**
   * 获取所有通知
   */
  getAll(): Notification[] {
    return [...this.notifications]
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length
  }

  get size(): number {
    return this.notifications.length
  }

  reset(): void {
    this.notifications = []
  }
}
