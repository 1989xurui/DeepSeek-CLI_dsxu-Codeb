import { resolve } from 'path'
import type { FileHistoryManager } from './file-history'

export interface TransactionManagerConfig {
  enabled?: boolean
  rollbackOnToolError?: boolean
  maxTrackedFilesPerTurn?: number
}

export interface TransactionState {
  active: boolean
  txId: string | null
  trackedFiles: string[]
  startedAt: number | null
}

export class TransactionManager {
  private readonly fileHistory: FileHistoryManager
  private readonly cwd: string
  private readonly config: TransactionManagerConfig
  private txId: string | null = null
  private trackedFiles = new Set<string>()
  private startedAt: number | null = null

  constructor(fileHistory: FileHistoryManager, cwd: string, config?: TransactionManagerConfig) {
    this.fileHistory = fileHistory
    this.cwd = cwd
    this.config = {
      enabled: config?.enabled ?? false,
      rollbackOnToolError: config?.rollbackOnToolError ?? true,
      maxTrackedFilesPerTurn: Math.max(1, config?.maxTrackedFilesPerTurn ?? 32),
    }
  }

  isEnabled(): boolean {
    return this.config.enabled === true
  }

  begin(txId: string): void {
    if (!this.isEnabled()) return
    this.txId = txId
    this.trackedFiles.clear()
    this.startedAt = Date.now()
  }

  track(filePath: string): boolean {
    if (!this.isEnabled()) return false
    if (!this.txId) return false
    if (!filePath || typeof filePath !== 'string') return false
    if (this.trackedFiles.size >= (this.config.maxTrackedFilesPerTurn ?? 32)) return false

    const absolute = resolve(this.cwd, filePath)
    if (this.trackedFiles.has(absolute)) return false

    this.fileHistory.trackEdit(absolute)
    this.trackedFiles.add(absolute)
    return true
  }

  snapshotStart(): void {
    if (!this.isEnabled()) return
    if (!this.txId) return
    this.fileHistory.makeSnapshot(this.txId)
  }

  rollback(): string[] {
    if (!this.isEnabled()) return []
    if (!this.txId) return []
    const changed = this.fileHistory.rewind(this.txId)
    this.clear()
    return changed
  }

  commit(): void {
    if (!this.isEnabled()) return
    this.clear()
  }

  shouldRollbackOnToolError(): boolean {
    return this.config.rollbackOnToolError !== false
  }

  getState(): TransactionState {
    return {
      active: !!this.txId,
      txId: this.txId,
      trackedFiles: Array.from(this.trackedFiles),
      startedAt: this.startedAt,
    }
  }

  private clear(): void {
    this.txId = null
    this.trackedFiles.clear()
    this.startedAt = null
  }
}

