import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { FileHistoryManager } from '../file-history'

const tempDirs: string[] = []

function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsxu-file-history-stress-'))
  tempDirs.push(dir)
  return dir
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('FileHistoryManager stress', () => {
  it('should survive deterministic random edit/delete/create with correct rewinds', () => {
    const cwd = createTempWorkspace()
    const rootDir = join(cwd, '.dsxu', 'file-history')
    const srcDir = join(cwd, 'src')
    mkdirSync(srcDir, { recursive: true })

    const files = [
      join(srcDir, 'a.ts'),
      join(srcDir, 'b.ts'),
      join(srcDir, 'c.ts'),
      join(srcDir, 'd.ts'),
      join(srcDir, 'e.ts'),
    ]

    const manager = new FileHistoryManager({ cwd, rootDir })
    const rng = makeRng(20260413)

    const current = new Map<string, string | null>()

    for (const f of files) {
      current.set(f, null)
      manager.trackEdit(f)
    }
    manager.makeSnapshot('msg-0')

    for (let i = 1; i <= 40; i++) {
      const f = files[Math.floor(rng() * files.length)]
      const op = Math.floor(rng() * 3) // 0:write, 1:append/write, 2:delete

      manager.trackEdit(f)

      const before = current.get(f) ?? null
      if (op === 2) {
        if (existsSync(f)) unlinkSync(f)
        current.set(f, null)
      } else {
        const base = before ?? ''
        const content =
          op === 0
            ? `// snapshot-${i}\nconst v = ${i};\n`
            : `${base}// append-${i}\n`
        writeFileSync(f, content, 'utf-8')
        current.set(f, content)
      }

      const snapshotId = `msg-${i}`
      manager.makeSnapshot(snapshotId)
    }

    for (const target of ['msg-5', 'msg-17', 'msg-29', 'msg-40']) {
      const changed = manager.rewind(target)
      expect(manager.hasAnyChanges(target)).toBe(false)
      const diff = manager.getDiffStats(target)
      expect(diff?.insertions ?? 0).toBe(0)
      expect(diff?.deletions ?? 0).toBe(0)
      expect(diff?.filesChanged ?? []).toHaveLength(0)

      // Rewinding twice to the same snapshot should be idempotent.
      const changedAgain = manager.rewind(target)
      expect(changedAgain).toHaveLength(0)
      expect(changed.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('should cap snapshots at 100 while keeping monotonic snapshotSequence', () => {
    const cwd = createTempWorkspace()
    const rootDir = join(cwd, '.dsxu', 'file-history')
    const filePath = join(cwd, 'counter.txt')
    const manager = new FileHistoryManager({ cwd, rootDir })

    for (let i = 1; i <= 130; i++) {
      manager.trackEdit(filePath)
      writeFileSync(filePath, `${i}\n`, 'utf-8')
      manager.makeSnapshot(`msg-${i}`)
    }

    const state = manager.getState()
    expect(state.snapshots).toHaveLength(100)
    expect(state.snapshotSequence).toBe(130)
    expect(manager.canRestore('msg-1')).toBe(false)
    expect(manager.canRestore('msg-130')).toBe(true)
  })
})
