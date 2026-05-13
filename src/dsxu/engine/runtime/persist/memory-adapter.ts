/**
 * DUXU Runtime Core - 内存持久化适配器
 *
 * 基于内存的持久化实现，主要用于测试和开发环境
 */

import type { PersistAdapter, PersistConfig } from './adapter'
import type { Session, SessionFilter } from '../session/model'
import type { Task, TaskFilter } from '../task/model'

/**
 * 内存持久化适配器
 */
export class MemoryPersistAdapter implements PersistAdapter {
  private config: PersistConfig
  private sessions: Map<string, Session> = new Map()
  private tasks: Map<string, Task> = new Map()
  private sessionTasks: Map<string, Set<string>> = new Map() // sessionId -> taskIds

  constructor(config: PersistConfig) {
    this.config = config
  }

  // === 会话操作 ===

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.id, session)

    // 更新sessionTasks映射
    if (!this.sessionTasks.has(session.id)) {
      this.sessionTasks.set(session.id, new Set())
    }

    // 确保session中的taskIds与映射一致
    const taskSet = this.sessionTasks.get(session.id)!
    for (const taskId of session.taskIds) {
      taskSet.add(taskId)
    }
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    // 先删除关联的任务
    const taskIds = this.sessionTasks.get(sessionId)
    if (taskIds) {
      for (const taskId of taskIds) {
        this.tasks.delete(taskId)
      }
      this.sessionTasks.delete(sessionId)
    }

    return this.sessions.delete(sessionId)
  }

  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    const sessions = Array.from(this.sessions.values())
    return sessions.filter(session => this.filterSession(session, filter))
  }

  async countSessions(filter?: SessionFilter): Promise<number> {
    const sessions = await this.listSessions(filter)
    return sessions.length
  }

  // === 任务操作 ===

  async saveTask(task: Task): Promise<void> {
    this.tasks.set(task.id, task)

    // 更新sessionTasks映射
    if (!this.sessionTasks.has(task.sessionId)) {
      this.sessionTasks.set(task.sessionId, new Set())
    }

    const taskSet = this.sessionTasks.get(task.sessionId)!
    taskSet.add(task.id)

    // 更新关联的会话中的taskIds
    const session = await this.loadSession(task.sessionId)
    if (session && !session.taskIds.includes(task.id)) {
      session.taskIds.push(task.id)
      await this.saveSession(session)
    }
  }

  async loadTask(taskId: string): Promise<Task | null> {
    return this.tasks.get(taskId) || null
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const task = await this.loadTask(taskId)
    if (!task) return false

    // 从sessionTasks映射中移除
    const taskSet = this.sessionTasks.get(task.sessionId)
    if (taskSet) {
      taskSet.delete(taskId)
    }

    // 从关联的会话中移除taskId
    const session = await this.loadSession(task.sessionId)
    if (session) {
      session.taskIds = session.taskIds.filter(id => id !== taskId)
      await this.saveSession(session)
    }

    return this.tasks.delete(taskId)
  }

  async listTasks(sessionId: string, filter?: TaskFilter): Promise<Task[]> {
    const taskIds = this.sessionTasks.get(sessionId)
    if (!taskIds) return []

    const tasks: Task[] = []
    for (const taskId of taskIds) {
      const task = await this.loadTask(taskId)
      if (task && this.filterTask(task, filter)) {
        tasks.push(task)
      }
    }

    return tasks
  }

  async countTasks(sessionId: string, filter?: TaskFilter): Promise<number> {
    const tasks = await this.listTasks(sessionId, filter)
    return tasks.length
  }

  // === 批量操作 ===

  async saveSessions(sessions: Session[]): Promise<void> {
    for (const session of sessions) {
      await this.saveSession(session)
    }
  }

  async saveTasks(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.saveTask(task)
    }
  }

  // === 存储管理 ===

  async initialize(): Promise<void> {
    console.log('内存持久化适配器已初始化')
  }

  async cleanup(options?: {
    olderThan?: number
    maxCount?: number
    dryRun?: boolean
  }): Promise<{ deletedSessions: number; deletedTasks: number; freedSpace?: number }> {
    const result = {
      deletedSessions: 0,
      deletedTasks: 0,
      freedSpace: 0
    }

    // 清理会话
    const sessions = await this.listSessions()
    let sessionsToDelete = sessions

    if (options?.olderThan) {
      sessionsToDelete = sessionsToDelete.filter(s => s.updatedAt < options.olderThan!)
    }

    if (options?.maxCount && sessions.length > options.maxCount) {
      // 保留最新的maxCount个会话
      const sorted = sessions.sort((a, b) => b.updatedAt - a.updatedAt)
      sessionsToDelete = sorted.slice(options.maxCount)
    }

    if (!options?.dryRun) {
      for (const session of sessionsToDelete) {
        await this.deleteSession(session.id)
        result.deletedSessions++
      }
    }

    return result
  }

  async getStats(): Promise<{
    totalSessions: number
    totalTasks: number
    storageSize?: number
    lastBackup?: number
  }> {
    const sessions = await this.listSessions()
    let totalTasks = 0

    for (const session of sessions) {
      const tasks = await this.listTasks(session.id)
      totalTasks += tasks.length
    }

    // 估算内存使用（简化版）
    const storageSize = this.estimateMemoryUsage()

    return {
      totalSessions: sessions.length,
      totalTasks,
      storageSize,
      lastBackup: undefined // 内存适配器不支持备份
    }
  }

  // === 辅助方法 ===

  private filterSession(session: Session, filter?: SessionFilter): boolean {
    if (!filter) return true

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      if (!statuses.includes(session.status)) {
        return false
      }
    }

    if (filter.createdAt) {
      if (filter.createdAt.from && session.createdAt < filter.createdAt.from) {
        return false
      }
      if (filter.createdAt.to && session.createdAt > filter.createdAt.to) {
        return false
      }
    }

    if (filter.updatedAt) {
      if (filter.updatedAt.from && session.updatedAt < filter.updatedAt.from) {
        return false
      }
      if (filter.updatedAt.to && session.updatedAt > filter.updatedAt.to) {
        return false
      }
    }

    if (filter.hasError !== undefined) {
      const hasError = !!session.error
      if (filter.hasError !== hasError) {
        return false
      }
    }

    if (filter.hasTasks !== undefined) {
      const hasTasks = session.taskIds.length > 0
      if (filter.hasTasks !== hasTasks) {
        return false
      }
    }

    return true
  }

  private filterTask(task: Task, filter?: TaskFilter): boolean {
    if (!filter) return true

    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status]
      if (!statuses.includes(task.status)) {
        return false
      }
    }

    if (filter.sessionId && task.sessionId !== filter.sessionId) {
      return false
    }

    if (filter.createdAt) {
      if (filter.createdAt.from && task.createdAt < filter.createdAt.from) {
        return false
      }
      if (filter.createdAt.to && task.createdAt > filter.createdAt.to) {
        return false
      }
    }

    if (filter.updatedAt) {
      if (filter.updatedAt.from && task.updatedAt < filter.updatedAt.from) {
        return false
      }
      if (filter.updatedAt.to && task.updatedAt > filter.updatedAt.to) {
        return false
      }
    }

    if (filter.hasResult !== undefined) {
      const hasResult = !!task.result
      if (filter.hasResult !== hasResult) {
        return false
      }
    }

    if (filter.hasError !== undefined) {
      const hasError = !!task.error
      if (filter.hasError !== hasError) {
        return false
      }
    }

    if (filter.canResume !== undefined) {
      const canResume = !!task.resumePoint
      if (filter.canResume !== canResume) {
        return false
      }
    }

    return true
  }

  private estimateMemoryUsage(): number {
    // 简单估算：每个字符约2字节，加上对象开销
    let totalSize = 0

    for (const session of this.sessions.values()) {
      totalSize += JSON.stringify(session).length * 2
    }

    for (const task of this.tasks.values()) {
      totalSize += JSON.stringify(task).length * 2
    }

    // 加上Map和Set的开销（粗略估算）
    totalSize += (this.sessions.size + this.tasks.size) * 100

    return totalSize
  }

  /**
   * 清空所有数据（测试用）
   */
  clear(): void {
    this.sessions.clear()
    this.tasks.clear()
    this.sessionTasks.clear()
  }
}