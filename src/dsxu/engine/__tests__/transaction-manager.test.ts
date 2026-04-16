import { afterEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { FileHistoryManager } from '../file-history'
import { TransactionManager } from '../transaction-manager'

const tempDirs: string[] = []

function createWorkspace(): string {
  const cwd = mkdtempSync(join(tmpdir(), 'dsxu-transaction-'))
  tempDirs.push(cwd)
  return cwd
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('TransactionManager', () => {
  it('should rollback tracked file to transaction start snapshot', () => {
    const cwd = createWorkspace()
    const filePath = join(cwd, 'src', 'demo.ts')
    mkdirSync(join(cwd, 'src'), { recursive: true })
    writeFileSync(filePath, 'const v = 1;\n')

    const fileHistory = new FileHistoryManager({
      cwd,
      rootDir: join(cwd, '.dsxu', 'file-history'),
    })
    const tx = new TransactionManager(fileHistory, cwd, { enabled: true })

    tx.begin('tx-1')
    tx.track(filePath)
    tx.snapshotStart()
    writeFileSync(filePath, 'const v = 2;\n')

    const changed = tx.rollback()
    expect(changed).toContain(filePath)
    expect(readFileSync(filePath, 'utf-8')).toBe('const v = 1;\n')
  })

  it('should keep file changes after commit', () => {
    const cwd = createWorkspace()
    const filePath = join(cwd, 'demo.txt')
    writeFileSync(filePath, 'a\n')

    const fileHistory = new FileHistoryManager({
      cwd,
      rootDir: join(cwd, '.dsxu', 'file-history'),
    })
    const tx = new TransactionManager(fileHistory, cwd, { enabled: true })

    tx.begin('tx-2')
    tx.track(filePath)
    tx.snapshotStart()
    writeFileSync(filePath, 'b\n')
    tx.commit()

    expect(readFileSync(filePath, 'utf-8')).toBe('b\n')
    expect(tx.getState().active).toBe(false)
  })

  it('should enforce maxTrackedFilesPerTurn', () => {
    const cwd = createWorkspace()
    const fileHistory = new FileHistoryManager({
      cwd,
      rootDir: join(cwd, '.dsxu', 'file-history'),
    })
    const tx = new TransactionManager(fileHistory, cwd, {
      enabled: true,
      maxTrackedFilesPerTurn: 1,
    })

    tx.begin('tx-3')
    expect(tx.track('a.ts')).toBe(true)
    expect(tx.track('b.ts')).toBe(false)
    expect(tx.getState().trackedFiles).toHaveLength(1)
  })
})

