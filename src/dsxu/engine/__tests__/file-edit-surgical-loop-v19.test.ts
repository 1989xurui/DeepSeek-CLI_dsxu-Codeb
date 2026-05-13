import { randomUUID } from 'crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  utimesSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { describe, expect, test } from 'bun:test'
import { getDsxuFileEditRuntimeProfile } from '../../../tools/FileEditTool/FileEditTool'
import { registerMainlineCoreToolAdapters } from '../engine-tool-adapter'
import { ToolRegistry } from '../tool-registry'
import type { ToolContext } from '../types'

function createContext(cwd: string, withFileHistory = false): ToolContext {
  const messageId = randomUUID()
  return {
    cwd,
    sessionId: `file-edit-v19-${messageId}`,
    gear: 1,
    mainlinePermissionCallback: async request => ({
      behavior: 'allow',
      updatedInput: request.input,
      message: 'allowed by focused Phase 9 replay',
    }),
    ...(withFileHistory
      ? {
          mainlineInitialAppState: {
            fileHistory: {
              snapshots: [{
                messageId,
                trackedFileBackups: {},
                timestamp: new Date(),
              }],
              trackedFiles: new Set(),
              snapshotSequence: 1,
            },
          } as any,
        }
      : {}),
  }
}

function enableSdkFileHistory(cwd: string): () => void {
  const previousCheckpointing = process.env.DSXU_CODE_ENABLE_SDK_FILE_CHECKPOINTING
  const previousConfigDir = process.env.DSXU_CONFIG_DIR
  process.env.DSXU_CODE_ENABLE_SDK_FILE_CHECKPOINTING = '1'
  process.env.DSXU_CONFIG_DIR = join(cwd, '.dsxu-config')
  return () => {
    if (previousCheckpointing === undefined) {
      delete process.env.DSXU_CODE_ENABLE_SDK_FILE_CHECKPOINTING
    } else {
      process.env.DSXU_CODE_ENABLE_SDK_FILE_CHECKPOINTING = previousCheckpointing
    }
    if (previousConfigDir === undefined) {
      delete process.env.DSXU_CONFIG_DIR
    } else {
      process.env.DSXU_CONFIG_DIR = previousConfigDir
    }
  }
}

describe('V19 FileEdit surgical loop contract', () => {
  test('declares the Phase 9 runtime contract on the existing FileEditTool profile', () => {
    const profile = getDsxuFileEditRuntimeProfile()

    expect(profile.safety).toContain('read-before-edit')
    expect(profile.safety).toContain('precise old_string match before mutation')
    expect(profile.safety).toContain('multi-match ambiguity blocks mutation')
    expect(profile.safety).toContain('mtime/user-modified detection')
    expect(profile.safety).toContain('successful edit steers to focused verification')
    expect(profile.safety).toContain('edit-count expectations remain advisory')
    expect(profile.evidence).toContain('source-truth readFileState')
    expect(profile.evidence).toContain('mtime/content staleness check')
    expect(profile.evidence).toContain('ambiguous_old_string preflight state')
    expect(profile.evidence).toContain('fileHistory snapshot')
    expect(profile.evidence).toContain('edit_applied tool_result confirmation')
  })

  test('runs Read/Edit through one mainline surgical lifecycle with source-truth, mtime, multi-match, verification, and fileHistory evidence', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'dsxu-v19-file-edit-'))
    const cleanupEnv = enableSdkFileHistory(cwd)

    try {
      const registry = new ToolRegistry()
      await registerMainlineCoreToolAdapters(registry)

      const calcPath = join(cwd, 'src', 'calc.js')
      mkdirSync(dirname(calcPath), { recursive: true })
      writeFileSync(calcPath, 'export function add(a, b) {\n  return a - b\n}\n', 'utf8')

      const missingReadContext = createContext(cwd)
      const missingRead = await registry.execute('Edit', {
        file_path: calcPath,
        old_string: '  return a - b',
        new_string: '  return a + b',
      }, 'tool-edit-missing-source-truth-v19', missingReadContext)
      expect(missingRead.isError).toBe(true)
      expect(missingRead.content).toContain('DSXU tool state: edit_preflight_required')
      expect(missingRead.content).toContain('blocked=missing_source_truth')

      const historyContext = createContext(cwd, true)
      const read = await registry.execute('Read', {
        file_path: calcPath,
      }, 'tool-read-before-edit-v19', historyContext)
      expect(read.isError).toBe(false)
      expect(read.content).toContain('return a - b')

      const edit = await registry.execute('Edit', {
        file_path: calcPath,
        old_string: '  return a - b',
        new_string: '  return a + b',
      }, 'tool-edit-success-v19', historyContext)
      expect(edit.isError).toBe(false)
      expect(edit.content).toContain('DSXU tool state: edit_applied')
      expect(edit.content).toContain('next=planned_edit_or_verify')
      expect(edit.content).toContain('run the smallest relevant verification command next')
      expect(edit.meta?.fileHistorySnapshotCount).toBe(1)
      expect(edit.meta?.fileHistoryTrackedFileCount).toBe(1)
      expect(readFileSync(calcPath, 'utf8')).toContain('return a + b')

      const stalePath = join(cwd, 'src', 'stale.js')
      writeFileSync(stalePath, 'export const value = 1\n', 'utf8')
      const staleContext = createContext(cwd)
      const staleRead = await registry.execute('Read', {
        file_path: stalePath,
      }, 'tool-read-before-stale-v19', staleContext)
      expect(staleRead.isError).toBe(false)
      writeFileSync(stalePath, 'export const value = 2\n', 'utf8')
      const future = new Date(Date.now() + 5000)
      utimesSync(stalePath, future, future)
      const staleEdit = await registry.execute('Edit', {
        file_path: stalePath,
        old_string: 'export const value = 1',
        new_string: 'export const value = 3',
      }, 'tool-edit-stale-mtime-v19', staleContext)
      expect(staleEdit.isError).toBe(true)
      expect(staleEdit.content).toContain('DSXU tool state: edit_preflight_required')
      expect(staleEdit.content).toContain('blocked=source_changed_since_read')

      const multiPath = join(cwd, 'src', 'multi.js')
      writeFileSync(multiPath, [
        'export function a(item) {',
        '  return item.price',
        '}',
        'export function b(item) {',
        '  return item.price',
        '}',
        '',
      ].join('\n'), 'utf8')
      const multiContext = createContext(cwd)
      const multiRead = await registry.execute('Read', {
        file_path: multiPath,
      }, 'tool-read-before-multi-v19', multiContext)
      expect(multiRead.isError).toBe(false)
      const ambiguous = await registry.execute('Edit', {
        file_path: multiPath,
        old_string: '  return item.price',
        new_string: '  return item.price * item.qty',
      }, 'tool-edit-ambiguous-v19', multiContext)
      expect(ambiguous.isError).toBe(true)
      expect(ambiguous.content).toContain('Found 2 matches')
      expect(ambiguous.content).toContain('DSXU tool state: edit_preflight_failed')
      expect(ambiguous.content).toContain('blocked=ambiguous_old_string')
    } finally {
      cleanupEnv()
    }
  })
})
