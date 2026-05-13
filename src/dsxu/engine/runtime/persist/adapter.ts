/**
 * DUXU Runtime Core - 持久化适配器接口
 *
 * 统一持久化层接口，支持多种存储后端
 *
 * 冻结接口：窗口B/C只能消费，不得修改主定义
 */

import type { Session, SessionFilter } from '../session/model'
import type { Task, TaskFilter } from '../task/model'

/**
 * 持久化适配器接口
 *
 * 定义统一的持久化操作，支持会话和任务的存储、加载、查询
 */
export interface PersistAdapter {
  // === 会话操作 ===

  /**
   * 保存会话
   */
  saveSession(session: Session): Promise<void>

  /**
   * 加载会话
   */
  loadSession(sessionId: string): Promise<Session | null>

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): Promise<boolean>

  /**
   * 列出会话
   */
  listSessions(filter?: SessionFilter): Promise<Session[]>

  /**
   * 统计会话数量
   */
  countSessions(filter?: SessionFilter): Promise<number>

  // === 任务操作 ===

  /**
   * 保存任务
   */
  saveTask(task: Task): Promise<void>

  /**
   * 加载任务
   */
  loadTask(taskId: string): Promise<Task | null>

  /**
   * 删除任务
   */
  deleteTask(taskId: string): Promise<boolean>

  /**
   * 列出任务
   */
  listTasks(sessionId: string, filter?: TaskFilter): Promise<Task[]>

  /**
   * 统计任务数量
   */
  countTasks(sessionId: string, filter?: TaskFilter): Promise<number>

  // === 批量操作 ===

  /**
   * 批量保存会话
   */
  saveSessions(sessions: Session[]): Promise<void>

  /**
   * 批量保存任务
   */
  saveTasks(tasks: Task[]): Promise<void>

  // === 存储管理 ===

  /**
   * 初始化存储
   */
  initialize(): Promise<void>

  /**
   * 清理存储
   */
  cleanup(options?: {
    olderThan?: number // DSXU comment sanitized.
    maxCount?: number // DSXU comment sanitized.
    dryRun?: boolean // DSXU comment sanitized.
  }): Promise<{
    deletedSessions: number
    deletedTasks: number
    freedSpace?: number
  }>

  /**
   * 获取存储统计信息
   */
  getStats(): Promise<{
    totalSessions: number
    totalTasks: number
    storageSize?: number
    lastBackup?: number
  }>
}

/**
 * 持久化配置
 */
export interface PersistConfig {
  /** 存储类型 */
  type: 'filesystem' | 'memory' | 'database'

  /** 存储路径（文件系统类型需要） */
  storagePath?: string

  /** 内存限制（内存类型需要） */
  memoryLimit?: number

  /** 数据库连接配置（数据库类型需要） */
  databaseConfig?: Record<string, any>

  /** 是否启用压缩 */
  enableCompression?: boolean

  /** 是否启用加密 */
  enableEncryption?: boolean

  /** 加密密钥（如启用加密） */
  encryptionKey?: string

  /** 自动清理配置 */
  autoCleanup?: {
    enabled: boolean
    keepLastNDays: number
    maxSessions: number
    schedule: 'daily' | 'weekly' | 'monthly'
  }
}

/**
 * 持久化工厂函数
 */
export function createPersistAdapter(config: PersistConfig): PersistAdapter {
  switch (config.type) {
    case 'filesystem':
      // 延迟导入，避免循环依赖
      const { FileSystemPersistAdapter } = require('./filesystem-adapter')
      return new FileSystemPersistAdapter(config)

    case 'memory':
      const { MemoryPersistAdapter } = require('./memory-adapter')
      return new MemoryPersistAdapter(config)

    case 'database':
      throw new Error('数据库持久化适配器尚未实现')

    default:
      throw new Error(`不支持的持久化类型: ${config.type}`)
  }
}

/**
 * 默认持久化配置
 */
export const DEFAULT_PERSIST_CONFIG: PersistConfig = {
  type: 'filesystem',
  storagePath: '.dsxu/runtime',
  enableCompression: true,
  enableEncryption: false,
  autoCleanup: {
    enabled: true,
    keepLastNDays: 30,
    maxSessions: 100,
    schedule: 'daily'
  }
}