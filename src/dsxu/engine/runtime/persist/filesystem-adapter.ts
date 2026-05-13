/**
 * DUXU Runtime Core - 文件系统持久化适配器
 *
 * 基于文件系统的持久化实现
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs'
import { join, dirname, basename } from 'path'
import type { PersistAdapter, PersistConfig } from './adapter'
import type { Session, SessionFilter } from '../session/model'
import type { Task, TaskFilter } from '../task/model'

/**
 * 文件系统持久化适配器
 */
export class FileSystemPersistAdapter implements PersistAdapter {
  private config: PersistConfig
  private sessionsDir: string
  private tasksDir: string

  constructor(config: PersistConfig) {
    this.config = { ...DEFAULT_PERSIST_CONFIG, ...config }

    // 确保存储路径存在
    const storagePath = this.config.storagePath || '.dsxu/runtime'
    this.sessionsDir = join(storagePath, 'sessions')
    this.tasksDir = join(storagePath, 'tasks')

    this.ensureDirectories()
  }

  private ensureDirectories(): void {
    for (const dir of [this.sessionsDir, this.tasksDir]) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }
    }
  }

  private getSessionPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.json`)
  }

  private getTaskPath(taskId: string): string {
    return join(this.tasksDir, `${taskId}.json`)
  }

  private readJSON<T>(filePath: string): T | null {
    try {
      if (!existsSync(filePath)) {
        return null
      }

      const content = readFileSync(filePath, 'utf-8')
      return JSON.parse(content) as T
    } catch (error) {
      console.error(`读取文件失败: ${filePath}`, error)
      return null
    }
  }

  private writeJSON(filePath: string, data: any): void {
    try {
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      const content = JSON.stringify(data, null, 2)
      writeFileSync(filePath, content, 'utf-8')
    } catch (error) {
      console.error(`写入文件失败: ${filePath}`, error)
      throw error
    }
  }

  // === 会话操作 ===

  async saveSession(session: Session): Promise<void> {
    const filePath = this.getSessionPath(session.id)
    this.writeJSON(filePath, session)
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    const filePath = this.getSessionPath(sessionId)
    return this.readJSON<Session>(filePath)
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const filePath = this.getSessionPath(sessionId)

    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        return true
      }
      return false
    } catch (error) {
      console.error(`删除会话文件失败: ${filePath}`, error)
      return false
    }
  }

  async listSessions(filter?: SessionFilter): Promise<Session[]> {
    try {
      const files = readdirSync(this.sessionsDir)
      const sessions: Session[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const sessionId = basename(file, '.json')
        const session = await this.loadSession(sessionId)

        if (session && this.filterSession(session, filter)) {
          sessions.push(session)
        }
      }

      // 按更新时间倒序排序
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (error) {
      console.error('列出会话失败', error)
      return []
    }
  }

  async countSessions(filter?: SessionFilter): Promise<number> {
    const sessions = await this.listSessions(filter)
    return sessions.length
  }

  // === 任务操作 ===

  async saveTask(task: Task): Promise<void> {
    const filePath = this.getTaskPath(task.id)
    this.writeJSON(filePath, task)
  }

  async loadTask(taskId: string): Promise<Task | null> {
    const filePath = this.getTaskPath(taskId)
    return this.readJSON<Task>(filePath)
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const filePath = this.getTaskPath(taskId)

    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        return true
      }
      return false
    } catch (error) {
      console.error(`删除任务文件失败: ${filePath}`, error)
      return false
    }
  }

  async listTasks(sessionId: string, filter?: TaskFilter): Promise<Task[]> {
    try {
      const files = readdirSync(this.tasksDir)
      const tasks: Task[] = []

      for (const file of files) {
        if (!file.endsWith('.json')) continue

        const taskId = basename(file, '.json')
        const task = await this.loadTask(taskId)

        if (task && task.sessionId === sessionId && this.filterTask(task, filter)) {
          tasks.push(task)
        }
      }

      // 按创建时间倒序排序
      return tasks.sort((a, b) => b.createdAt - a.createdAt)
    } catch (error) {
      console.error('列出任务失败', error)
      return []
    }
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
    this.ensureDirectories()
    console.log(`文件系统持久化适配器已初始化: sessions=${this.sessionsDir}, tasks=${this.tasksDir}`)
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

    for (const session of sessionsToDelete) {
      if (!options?.dryRun) {
        // 先删除关联的任务
        const tasks = await this.listTasks(session.id)
        for (const task of tasks) {
          await this.deleteTask(task.id)
          result.deletedTasks++
        }

        // 再删除会话
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

    // 计算存储大小（简化版）
    let storageSize = 0
    try {
      const calculateDirSize = (dir: string): number => {
        let size = 0
        const files = readdirSync(dir)

        for (const file of files) {
          const filePath = join(dir, file)
          const stats = statSync(filePath)

          if (stats.isDirectory()) {
            size += calculateDirSize(filePath)
          } else {
            size += stats.size
          }
        }

        return size
      }

      storageSize = calculateDirSize(this.sessionsDir) + calculateDirSize(this.tasksDir)
    } catch (error) {
      console.error('计算存储大小失败', error)
    }

    return {
      totalSessions: sessions.length,
      totalTasks,
      storageSize,
      lastBackup: undefined // 文件系统适配器不支持备份
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
}

/**
 * 默认文件系统配置
 */
const DEFAULT_PERSIST_CONFIG: PersistConfig = {
  type: 'filesystem',
  storagePath: '.dsxu/runtime',
  enableCompression: false,
  enableEncryption: false,
  autoCleanup: {
    enabled: true,
    keepLastNDays: 30,
    maxSessions: 100,
    schedule: 'daily'
  }
}