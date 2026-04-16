import { createHash } from 'crypto'
import { diffLines } from 'diff'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs'
import { chmodSync, copyFileSync } from 'fs'
import { dirname, isAbsolute, join, relative, resolve } from 'path'

export type FileHistoryBackupName = string | null

export interface FileHistoryBackup {
  backupFileName: FileHistoryBackupName
  version: number
  backupTime: string
}

export interface FileHistorySnapshot {
  messageId: string
  trackedFileBackups: Record<string, FileHistoryBackup>
  timestamp: string
}

export interface FileHistoryState {
  snapshots: FileHistorySnapshot[]
  trackedFiles: string[]
  snapshotSequence: number
}

export interface FileHistoryDiffStats {
  filesChanged: string[]
  insertions: number
  deletions: number
}

const MAX_SNAPSHOTS = 100

export class FileHistoryManager {
  private readonly rootDir: string
  private readonly backupDir: string
  private readonly statePath: string
  private readonly cwd: string
  private state: FileHistoryState

  constructor(options?: { rootDir?: string; cwd?: string }) {
    this.cwd = resolve(options?.cwd ?? process.cwd())
    this.rootDir = resolve(options?.rootDir ?? join(this.cwd, '.dsxu', 'file-history'))
    this.backupDir = join(this.rootDir, 'backups')
    this.statePath = join(this.rootDir, 'state.json')

    mkdirSync(this.backupDir, { recursive: true })
    this.state = this.loadState()
  }

  trackEdit(filePath: string): FileHistoryBackup {
    const trackingPath = this.toTrackingPath(filePath)
    const latestSnapshot = this.state.snapshots.at(-1)
    const existingBackup =
      latestSnapshot?.trackedFileBackups[trackingPath] ??
      this.findLatestBackup(trackingPath)

    if (existingBackup) {
      if (!this.state.trackedFiles.includes(trackingPath)) {
        this.state.trackedFiles.push(trackingPath)
        this.persistState()
      }
      return existingBackup
    }

    const backup = this.createBackup(this.toAbsolutePath(trackingPath), 1)
    if (!this.state.trackedFiles.includes(trackingPath)) {
      this.state.trackedFiles.push(trackingPath)
    }
    this.persistState()
    return backup
  }

  makeSnapshot(messageId: string): FileHistorySnapshot {
    const trackedFileBackups: Record<string, FileHistoryBackup> = {}

    for (const trackingPath of this.state.trackedFiles) {
      const filePath = this.toAbsolutePath(trackingPath)
      const latestBackup = this.findLatestBackup(trackingPath)
      const nextVersion = (latestBackup?.version ?? 0) + 1

      if (!latestBackup) {
        trackedFileBackups[trackingPath] = this.createBackup(filePath, 1)
        continue
      }

      if (
        latestBackup.backupFileName !== null &&
        !checkOriginFileChanged(filePath, this.resolveBackupPath(latestBackup.backupFileName))
      ) {
        trackedFileBackups[trackingPath] = latestBackup
        continue
      }

      if (latestBackup.backupFileName === null && !existsSync(filePath)) {
        trackedFileBackups[trackingPath] = latestBackup
        continue
      }

      trackedFileBackups[trackingPath] = this.createBackup(filePath, nextVersion)
    }

    const snapshot: FileHistorySnapshot = {
      messageId,
      trackedFileBackups,
      timestamp: new Date().toISOString(),
    }

    this.state.snapshots.push(snapshot)
    if (this.state.snapshots.length > MAX_SNAPSHOTS) {
      this.state.snapshots = this.state.snapshots.slice(-MAX_SNAPSHOTS)
    }
    this.state.snapshotSequence += 1
    this.persistState()
    return snapshot
  }

  rewind(messageId: string): string[] {
    const targetSnapshot = this.findSnapshot(messageId)
    if (!targetSnapshot) {
      throw new Error(`Snapshot for ${messageId} not found`)
    }

    const filesChanged: string[] = []
    for (const trackingPath of this.state.trackedFiles) {
      const filePath = this.toAbsolutePath(trackingPath)
      const targetBackup = targetSnapshot.trackedFileBackups[trackingPath]
      const backupFileName =
        targetBackup?.backupFileName ?? this.getFirstBackupFileName(trackingPath)

      if (backupFileName === undefined) {
        continue
      }

      if (backupFileName === null) {
        if (existsSync(filePath)) {
          unlinkSync(filePath)
          filesChanged.push(filePath)
        }
        continue
      }

      const backupPath = this.resolveBackupPath(backupFileName)
      if (checkOriginFileChanged(filePath, backupPath)) {
        this.restoreBackup(filePath, backupPath)
        filesChanged.push(filePath)
      }
    }

    return filesChanged
  }

  canRestore(messageId: string): boolean {
    return !!this.findSnapshot(messageId)
  }

  hasAnyChanges(messageId: string): boolean {
    const targetSnapshot = this.findSnapshot(messageId)
    if (!targetSnapshot) return false

    for (const trackingPath of this.state.trackedFiles) {
      const filePath = this.toAbsolutePath(trackingPath)
      const targetBackup = targetSnapshot.trackedFileBackups[trackingPath]
      const backupFileName =
        targetBackup?.backupFileName ?? this.getFirstBackupFileName(trackingPath)

      if (backupFileName === undefined) continue
      if (backupFileName === null) {
        if (existsSync(filePath)) return true
        continue
      }
      if (checkOriginFileChanged(filePath, this.resolveBackupPath(backupFileName))) {
        return true
      }
    }

    return false
  }

  getDiffStats(messageId: string): FileHistoryDiffStats | undefined {
    const targetSnapshot = this.findSnapshot(messageId)
    if (!targetSnapshot) return undefined

    const filesChanged: string[] = []
    let insertions = 0
    let deletions = 0

    for (const trackingPath of this.state.trackedFiles) {
      const filePath = this.toAbsolutePath(trackingPath)
      const targetBackup = targetSnapshot.trackedFileBackups[trackingPath]
      const backupFileName =
        targetBackup?.backupFileName ?? this.getFirstBackupFileName(trackingPath)

      if (backupFileName === undefined) continue
      if (backupFileName === null) {
        if (existsSync(filePath)) {
          const stats = computeDiffStatsForFile(filePath, undefined)
          filesChanged.push(filePath)
          insertions += stats.insertions
          deletions += stats.deletions
        }
        continue
      }

      const backupPath = this.resolveBackupPath(backupFileName)
      if (!checkOriginFileChanged(filePath, backupPath)) {
        continue
      }

      const stats = computeDiffStatsForFile(filePath, backupPath)
      if (stats.insertions || stats.deletions) {
        filesChanged.push(filePath)
        insertions += stats.insertions
        deletions += stats.deletions
      }
    }

    return { filesChanged, insertions, deletions }
  }

  getState(): FileHistoryState {
    return {
      snapshots: this.state.snapshots.map(snapshot => ({
        ...snapshot,
        trackedFileBackups: { ...snapshot.trackedFileBackups },
      })),
      trackedFiles: [...this.state.trackedFiles],
      snapshotSequence: this.state.snapshotSequence,
    }
  }

  listSnapshots(): Array<{ messageId: string; timestamp: string; trackedFileCount: number }> {
    return this.state.snapshots.map(snapshot => ({
      messageId: snapshot.messageId,
      timestamp: snapshot.timestamp,
      trackedFileCount: Object.keys(snapshot.trackedFileBackups).length,
    }))
  }

  private loadState(): FileHistoryState {
    if (!existsSync(this.statePath)) {
      return { snapshots: [], trackedFiles: [], snapshotSequence: 0 }
    }

    try {
      const raw = JSON.parse(readFileSync(this.statePath, 'utf-8')) as FileHistoryState
      return {
        snapshots: raw.snapshots ?? [],
        trackedFiles: raw.trackedFiles ?? [],
        snapshotSequence: raw.snapshotSequence ?? raw.snapshots?.length ?? 0,
      }
    } catch {
      return { snapshots: [], trackedFiles: [], snapshotSequence: 0 }
    }
  }

  private persistState(): void {
    mkdirSync(this.rootDir, { recursive: true })
    writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8')
  }

  private createBackup(filePath: string, version: number): FileHistoryBackup {
    if (!existsSync(filePath)) {
      return {
        backupFileName: null,
        version,
        backupTime: new Date().toISOString(),
      }
    }

    const backupFileName = getBackupFileName(filePath, version)
    const backupPath = this.resolveBackupPath(backupFileName)
    mkdirSync(dirname(backupPath), { recursive: true })
    copyFileSync(filePath, backupPath)
    chmodSync(backupPath, statSync(filePath).mode)

    return {
      backupFileName,
      version,
      backupTime: new Date().toISOString(),
    }
  }

  private restoreBackup(filePath: string, backupPath: string): void {
    mkdirSync(dirname(filePath), { recursive: true })
    copyFileSync(backupPath, filePath)
    chmodSync(filePath, statSync(backupPath).mode)
  }

  private findSnapshot(messageId: string): FileHistorySnapshot | undefined {
    return [...this.state.snapshots].reverse().find(snapshot => snapshot.messageId === messageId)
  }

  private findLatestBackup(trackingPath: string): FileHistoryBackup | undefined {
    for (let i = this.state.snapshots.length - 1; i >= 0; i -= 1) {
      const backup = this.state.snapshots[i].trackedFileBackups[trackingPath]
      if (backup) return backup
    }
    return undefined
  }

  private getFirstBackupFileName(trackingPath: string): FileHistoryBackupName | undefined {
    for (const snapshot of this.state.snapshots) {
      const backup = snapshot.trackedFileBackups[trackingPath]
      if (backup && backup.version === 1) {
        return backup.backupFileName
      }
    }
    return undefined
  }

  private toTrackingPath(filePath: string): string {
    const absolute = resolve(filePath)
    return absolute.startsWith(this.cwd) ? relative(this.cwd, absolute) : absolute
  }

  private toAbsolutePath(trackingPath: string): string {
    return isAbsolute(trackingPath) ? trackingPath : resolve(this.cwd, trackingPath)
  }

  private resolveBackupPath(backupFileName: string): string {
    return join(this.backupDir, backupFileName)
  }
}

export function getBackupFileName(filePath: string, version: number): string {
  const fileNameHash = createHash('sha256')
    .update(resolve(filePath))
    .digest('hex')
    .slice(0, 16)
  return `${fileNameHash}@v${version}`
}

export function checkOriginFileChanged(originalFile: string, backupPath: string): boolean {
  const originalExists = existsSync(originalFile)
  const backupExists = existsSync(backupPath)

  if (originalExists !== backupExists) return true
  if (!originalExists && !backupExists) return false

  const originalStats = statSync(originalFile)
  const backupStats = statSync(backupPath)

  if (originalStats.mode !== backupStats.mode || originalStats.size !== backupStats.size) {
    return true
  }

  if (originalStats.mtimeMs < backupStats.mtimeMs) {
    return false
  }

  return readFileSync(originalFile, 'utf-8') !== readFileSync(backupPath, 'utf-8')
}

export function computeDiffStatsForFile(
  originalFile: string,
  backupPath?: string,
): FileHistoryDiffStats {
  const originalContent = existsSync(originalFile) ? readFileSync(originalFile, 'utf-8') : ''
  const backupContent =
    backupPath && existsSync(backupPath) ? readFileSync(backupPath, 'utf-8') : ''

  if (!originalContent && !backupContent) {
    return { filesChanged: [], insertions: 0, deletions: 0 }
  }

  const changes = diffLines(originalContent, backupContent)
  let insertions = 0
  let deletions = 0

  for (const change of changes) {
    if (change.added) insertions += change.count ?? 0
    if (change.removed) deletions += change.count ?? 0
  }

  return {
    filesChanged: [originalFile],
    insertions,
    deletions,
  }
}
