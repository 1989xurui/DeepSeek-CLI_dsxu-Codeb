/**
 * #7.10 Task Queue + #7.11 Workspace Manager
 *
 * 任务队列：
 *   - 顺序/并行任务执行
 *   - 优先级排序
 *   - 依赖关系
 *   - 取消/重试
 *
 * 工作空间管理：
 *   - 多项目支持
 *   - 工作空间切换
 *   - 项目发现
 */

import { existsSync, readdirSync, statSync } from 'fs'
import { join, basename, resolve } from 'path'

// ── Task Queue ──

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface Task<T = any> {
  id: string
  name: string
  status: TaskStatus
  priority: number  // Higher = run first
  createdAt: number
  startedAt?: number
  completedAt?: number
  result?: T
  error?: string
  /** 依赖的任务 ID */
  dependsOn?: string[]
  /** 执行函数 */
  execute: () => Promise<T>
  /** 重试次数 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 重试延迟（毫秒） */
  retryDelay: number
}

export class TaskQueue<T = any> {
  private tasks: Map<string, Task<T>> = new Map()
  private running = false
  private concurrency: number
  private activeCount = 0

  constructor(concurrency: number = 1) {
    this.concurrency = concurrency
  }

  /**
   * 添加任务
   */
  add(
    name: string,
    execute: () => Promise<T>,
    opts?: { priority?: number; dependsOn?: string[]; maxRetries?: number; retryDelay?: number },
  ): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const task: Task<T> = {
      id,
      name,
      status: 'pending',
      priority: opts?.priority ?? 0,
      createdAt: Date.now(),
      dependsOn: opts?.dependsOn,
      execute,
      retryCount: 0,
      maxRetries: opts?.maxRetries ?? 0,
      retryDelay: opts?.retryDelay ?? 1000,
    }

    this.tasks.set(id, task)
    return id
  }

  /**
   * 启动队列处理
   */
  async start(): Promise<void> {
    if (this.running) return
    this.running = true

    while (this.running) {
      const next = this.getNextTask()
      if (!next) {
        // Check if all done
        const pending = this.getPending()
        if (pending.length === 0) break

        // Wait for running tasks
        await new Promise(r => setTimeout(r, 100))
        continue
      }

      if (this.activeCount >= this.concurrency) {
        await new Promise(r => setTimeout(r, 50))
        continue
      }

      // Execute task
      this.executeTask(next)
    }

    this.running = false
  }

  /**
   * 停止队列
   */
  stop(): void {
    this.running = false
  }

  /**
   * 取消任务
   */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'pending') return false
    task.status = 'cancelled'
    return true
  }

  /**
   * 恢复失败的任务
   */
  retry(taskId: string, newExecute?: () => Promise<T>): boolean {
    const task = this.tasks.get(taskId)
    if (!task || task.status !== 'failed') return false

    task.status = 'pending'
    task.retryCount = 0
    task.error = undefined
    if (newExecute) {
      task.execute = newExecute
    }
    return true
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): Task<T> | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task<T>[] {
    return [...this.tasks.values()]
  }

  /**
   * 获取待执行任务
   */
  getPending(): Task<T>[] {
    return [...this.tasks.values()].filter(t => t.status === 'pending')
  }

  /**
   * 获取完成的任务
   */
  getCompleted(): Task<T>[] {
    return [...this.tasks.values()].filter(t => t.status === 'completed')
  }

  get size(): number {
    return this.tasks.size
  }

  get pendingCount(): number {
    return this.getPending().length
  }

  /**
   * 获取下一个可执行的任务
   * 优先级+依赖同时存在时顺序稳定：先按依赖满足情况，再按优先级，最后按创建时间
   */
  private getNextTask(): Task<T> | null {
    const pending = this.getPending()
      .filter(t => this.areDependenciesMet(t))
      .sort((a, b) => {
        // 首先按优先级（高优先级先执行）
        if (a.priority !== b.priority) {
          return b.priority - a.priority
        }
        // 然后按创建时间（先创建的先执行）
        return a.createdAt - b.createdAt
      })

    return pending[0] || null
  }

  /**
   * 检查依赖是否满足
   */
  private areDependenciesMet(task: Task<T>): boolean {
    if (!task.dependsOn?.length) return true
    return task.dependsOn.every(depId => {
      const dep = this.tasks.get(depId)
      return dep && dep.status === 'completed'
    })
  }

  /**
   * 执行单个任务（带重试机制）
   */
  private async executeTask(task: Task<T>): Promise<void> {
    task.status = 'running'
    task.startedAt = Date.now()
    this.activeCount++

    try {
      task.result = await task.execute()
      task.status = 'completed'
    } catch (error: any) {
      // 检查是否需要重试
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        task.status = 'pending'
        task.error = `Retry ${task.retryCount}/${task.maxRetries}: ${error.message}`

        // 延迟后重新加入队列
        setTimeout(() => {
          if (this.tasks.has(task.id)) {
            task.startedAt = undefined
            task.completedAt = undefined
          }
        }, task.retryDelay)
      } else {
        task.status = 'failed'
        task.error = error.message
      }
    } finally {
      if (task.status !== 'pending') {
        task.completedAt = Date.now()
      }
      this.activeCount--
    }
  }

  reset(): void {
    this.tasks.clear()
    this.running = false
    this.activeCount = 0
  }
}

// ── Workspace Manager ──

export interface WorkspaceInfo {
  path: string
  name: string
  hasGit: boolean
  hasConfig: boolean
  hasPackageJson: boolean
  lastModified: number
}

export class WorkspaceManager {
  private workspaces: Map<string, WorkspaceInfo> = new Map()
  private currentWorkspace?: string

  /**
   * 添加工作空间
   */
  add(path: string): WorkspaceInfo {
    const info = analyzeWorkspace(path)
    this.workspaces.set(path, info)
    if (!this.currentWorkspace) {
      this.currentWorkspace = path
    }
    return info
  }

  /**
   * 切换当前工作空间
   */
  switchTo(path: string): boolean {
    if (this.workspaces.has(path)) {
      this.currentWorkspace = path
      return true
    }
    return false
  }

  /**
   * 获取当前工作空间
   */
  getCurrent(): WorkspaceInfo | undefined {
    if (!this.currentWorkspace) return undefined
    return this.workspaces.get(this.currentWorkspace)
  }

  /**
   * 列出所有工作空间
   */
  list(): WorkspaceInfo[] {
    return [...this.workspaces.values()]
  }

  /**
   * 移除工作空间
   */
  remove(path: string): boolean {
    const removed = this.workspaces.delete(path)
    if (this.currentWorkspace === path) {
      this.currentWorkspace = this.workspaces.keys().next().value
    }
    return removed
  }

  get size(): number {
    return this.workspaces.size
  }

  get currentPath(): string | undefined {
    return this.currentWorkspace
  }
}

/**
 * 分析工作空间
 */
export function analyzeWorkspace(dir: string): WorkspaceInfo {
  const absDir = resolve(dir)
  let lastModified = 0

  try {
    lastModified = statSync(absDir).mtimeMs
  } catch {}

  return {
    path: absDir,
    name: basename(absDir),
    hasGit: existsSync(join(absDir, '.git')),
    hasConfig: existsSync(join(absDir, '.dsxu')) || existsSync(join(absDir, '.dsxu.json')),
    hasPackageJson: existsSync(join(absDir, 'package.json')),
    lastModified,
  }
}

/**
 * 发现子目录中的项目
 */
export function discoverProjects(parentDir: string, maxDepth: number = 2): WorkspaceInfo[] {
  const projects: WorkspaceInfo[] = []

  function scan(dir: string, depth: number): void {
    if (depth > maxDepth) return

    try {
      // Check if this dir is a project
      if (
        existsSync(join(dir, 'package.json')) ||
        existsSync(join(dir, '.git')) ||
        existsSync(join(dir, '.dsxu'))
      ) {
        projects.push(analyzeWorkspace(dir))
        return // Don't scan subdirs of projects
      }

      // Scan subdirectories
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue
        scan(join(dir, entry.name), depth + 1)
      }
    } catch {}
  }

  scan(parentDir, 0)
  return projects
}
