/**
 * #6.14 File Watcher
 *
 * 监视文件变化：
 *   - 检测代码修改 → 触发 lint/test
 *   - 检测 config 变化 → 重新加载
 *   - Debounce 防抖
 *   - Pattern-based 过滤
 */

import { watch, FSWatcher, statSync, existsSync } from 'fs'
import { join, relative, extname } from 'path'

// ── Types ──

export interface FileChangeEvent {
  type: 'change' | 'rename'
  file: string
  relativePath: string
  timestamp: number
}

export interface WatcherConfig {
  /** 监视目录 */
  dir: string
  /** 监视的文件模式（glob-like） */
  patterns?: string[]
  /** 忽略的目录 */
  ignoreDirs?: string[]
  /** 防抖延迟 ms */
  debounceMs?: number
  /** 变化回调 */
  onChange: (events: FileChangeEvent[]) => void
}

// ── File Watcher ──

export class FileWatcher {
  private watchers: FSWatcher[] = []
  private config: Required<WatcherConfig>
  private pendingEvents: FileChangeEvent[] = []
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private running = false

  constructor(config: WatcherConfig) {
    this.config = {
      dir: config.dir,
      patterns: config.patterns || ['*.ts', '*.tsx', '*.js', '*.jsx', '*.json'],
      ignoreDirs: config.ignoreDirs || ['node_modules', '.git', 'dist', 'build', 'coverage'],
      debounceMs: config.debounceMs ?? 300,
      onChange: config.onChange,
    }
  }

  /**
   * 开始监视
   */
  start(): void {
    if (this.running) return
    this.running = true

    try {
      const watcher = watch(this.config.dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return

        // Check ignore patterns
        const parts = filename.split(/[/\\]/)
        if (parts.some(p => this.config.ignoreDirs.includes(p))) return

        // Check file extension
        const ext = extname(filename)
        if (!this.matchesPatterns(filename, ext)) return

        const event: FileChangeEvent = {
          type: eventType as 'change' | 'rename',
          file: join(this.config.dir, filename),
          relativePath: filename,
          timestamp: Date.now(),
        }

        this.pendingEvents.push(event)
        this.scheduleBatch()
      })

      this.watchers.push(watcher)
    } catch (error: any) {
      console.warn(`[FileWatcher] Failed to start: ${error.message}`)
    }
  }

  /**
   * 停止监视
   */
  stop(): void {
    this.running = false
    for (const w of this.watchers) {
      try { w.close() } catch {}
    }
    this.watchers = []
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.pendingEvents = []
  }

  /**
   * 是否正在运行
   */
  get isRunning(): boolean {
    return this.running
  }

  /**
   * 防抖批处理
   */
  private scheduleBatch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    this.debounceTimer = setTimeout(() => {
      if (this.pendingEvents.length > 0) {
        // Deduplicate by file path
        const uniqueEvents = deduplicateEvents(this.pendingEvents)
        this.pendingEvents = []

        try {
          this.config.onChange(uniqueEvents)
        } catch (error: any) {
          console.warn(`[FileWatcher] onChange error: ${error.message}`)
        }
      }
    }, this.config.debounceMs)
  }

  /**
   * 检查文件是否匹配监视模式
   */
  private matchesPatterns(filename: string, ext: string): boolean {
    for (const pattern of this.config.patterns) {
      if (pattern.startsWith('*.')) {
        const patternExt = pattern.slice(1) // e.g., ".ts"
        if (ext === patternExt) return true
      } else if (filename.includes(pattern)) {
        return true
      }
    }
    return false
  }
}

/**
 * 去重文件变化事件（同一文件只保留最新事件）
 */
export function deduplicateEvents(events: FileChangeEvent[]): FileChangeEvent[] {
  const map = new Map<string, FileChangeEvent>()
  for (const event of events) {
    map.set(event.file, event)
  }
  return [...map.values()]
}

/**
 * 创建一个简单的 file watcher（便捷函数）
 */
export function createWatcher(
  dir: string,
  onChange: (events: FileChangeEvent[]) => void,
  patterns?: string[],
): FileWatcher {
  return new FileWatcher({ dir, onChange, patterns })
}

/**
 * 获取最近修改的文件
 */
export function getRecentlyModified(dir: string, files: string[], sinceMs: number = 60_000): string[] {
  const cutoff = Date.now() - sinceMs
  return files.filter(file => {
    try {
      const full = join(dir, file)
      if (!existsSync(full)) return false
      const stat = statSync(full)
      return stat.mtimeMs > cutoff
    } catch {
      return false
    }
  })
}
