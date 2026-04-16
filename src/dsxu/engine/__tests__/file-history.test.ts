import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  checkOriginFileChanged,
  computeDiffStatsForFile,
  FileHistoryManager,
  getBackupFileName,
} from '../file-history'

const tempDirs: string[] = []

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsxu-file-history-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('FileHistoryManager', () => {
  it('should snapshot and rewind an edited file', () => {
    const cwd = createTempWorkspace()
    const rootDir = join(cwd, '.dsxu', 'file-history')
    const filePath = join(cwd, 'src', 'demo.ts')
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(filePath, 'const value = 1;\n')

    const manager = new FileHistoryManager({ cwd, rootDir })
    manager.trackEdit(filePath)

    writeFileSync(filePath, 'const value = 2;\n')
    manager.makeSnapshot('msg-1')

    writeFileSync(filePath, 'const value = 3;\n')
    manager.makeSnapshot('msg-2')

    expect(manager.canRestore('msg-1')).toBe(true)
    expect(manager.hasAnyChanges('msg-1')).toBe(true)

    const changed = manager.rewind('msg-1')
    expect(changed).toContain(filePath)
    expect(readFileSync(filePath, 'utf-8')).toBe('const value = 2;\n')
  })

  it('should delete a file that did not exist at the target snapshot', () => {
    const cwd = createTempWorkspace()
    const rootDir = join(cwd, '.dsxu', 'file-history')
    const filePath = join(cwd, 'new-file.txt')

    const manager = new FileHistoryManager({ cwd, rootDir })
    manager.trackEdit(filePath)
    manager.makeSnapshot('before-create')

    writeFileSync(filePath, 'created later\n')
    manager.makeSnapshot('after-create')

    expect(existsSync(filePath)).toBe(true)
    manager.rewind('before-create')
    expect(existsSync(filePath)).toBe(false)
  })

  it('should persist state to disk', () => {
    const cwd = createTempWorkspace()
    const rootDir = join(cwd, '.dsxu', 'file-history')
    const filePath = join(cwd, 'note.txt')
    writeFileSync(filePath, 'hello\n')

    const manager = new FileHistoryManager({ cwd, rootDir })
    manager.trackEdit(filePath)
    manager.makeSnapshot('msg-1')

    const restored = new FileHistoryManager({ cwd, rootDir })
    expect(restored.canRestore('msg-1')).toBe(true)
    expect(restored.getState().snapshots).toHaveLength(1)
  })
})

describe('file history helpers', () => {
  it('should compute backup file names deterministically', () => {
    const cwd = createTempWorkspace()
    const filePath = join(cwd, 'demo.ts')
    expect(getBackupFileName(filePath, 1)).toBe(getBackupFileName(filePath, 1))
    expect(getBackupFileName(filePath, 1)).not.toBe(getBackupFileName(filePath, 2))
  })

  it('should detect file changes against a backup', () => {
    const cwd = createTempWorkspace()
    const filePath = join(cwd, 'demo.ts')
    const backupPath = join(cwd, 'demo.bak')
    writeFileSync(filePath, 'a\n')
    writeFileSync(backupPath, 'a\n')
    expect(checkOriginFileChanged(filePath, backupPath)).toBe(false)

    writeFileSync(filePath, 'b\n')
    expect(checkOriginFileChanged(filePath, backupPath)).toBe(true)
  })

  it('should compute diff stats for a changed file', () => {
    const cwd = createTempWorkspace()
    const filePath = join(cwd, 'demo.ts')
    const backupPath = join(cwd, 'demo.bak')
    writeFileSync(filePath, 'a\nb\nc\n')
    writeFileSync(backupPath, 'a\nx\n')

    const stats = computeDiffStatsForFile(filePath, backupPath)
    expect(stats.filesChanged).toEqual([filePath])
    expect(stats.insertions).toBeGreaterThan(0)
    expect(stats.deletions).toBeGreaterThan(0)
  })
})
