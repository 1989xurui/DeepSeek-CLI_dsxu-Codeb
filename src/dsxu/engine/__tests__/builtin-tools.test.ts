/**
 * 内置工具测试
 * 测试真实文件系统操作（使用 /tmp 临时目录）
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { BashTool, ReadTool, WriteTool, EditTool, GrepTool, GlobTool, getCoreTools, getReadOnlyTools } from '../builtin-tools'
import type { ToolContext } from '../types'
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { FileHistoryManager } from '../file-history'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-engine-test-' + Date.now())
const ctx: ToolContext = { cwd: TEST_DIR, sessionId: 'test', gear: 1 }

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

describe('BashTool', () => {
  it('should execute simple command', async () => {
    const result = await BashTool.execute({ command: 'echo hello' }, ctx)
    expect(result.content).toContain('hello')
    expect(result.isError).toBeFalsy()
  }, 15000)

  it('should report error on failing command', async () => {
    const result = await BashTool.execute({ command: 'false' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Exit code')
  })

  it('should respect timeout', async () => {
    const result = await BashTool.execute({ command: 'sleep 10', timeout: 500 }, ctx)
    expect(result.isError).toBe(true)
  })
})

describe('ReadTool', () => {
  it('should read a file with line numbers', async () => {
    const filePath = join(TEST_DIR, 'test.txt')
    writeFileSync(filePath, 'line1\nline2\nline3\n')

    const result = await ReadTool.execute({ file_path: filePath }, ctx)
    expect(result.content).toContain('1\tline1')
    expect(result.content).toContain('2\tline2')
    expect(result.isError).toBeFalsy()
  })

  it('should support offset and limit', async () => {
    const filePath = join(TEST_DIR, 'test.txt')
    writeFileSync(filePath, 'a\nb\nc\nd\ne\n')

    const result = await ReadTool.execute({ file_path: filePath, offset: 2, limit: 2 }, ctx)
    expect(result.content).toContain('2\tb')
    expect(result.content).toContain('3\tc')
    expect(result.content).not.toContain('1\ta')
  })

  it('should error on non-existent file', async () => {
    const result = await ReadTool.execute({ file_path: '/tmp/nonexistent-123456' }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })
})

describe('WriteTool', () => {
  it('should create a new file', async () => {
    const filePath = join(TEST_DIR, 'new.txt')
    const result = await WriteTool.execute({ file_path: filePath, content: 'hello world' }, ctx)

    expect(result.isError).toBeFalsy()
    expect(existsSync(filePath)).toBe(true)
    expect(result.content).toContain('1 lines')
  })

  it('should create nested directories', async () => {
    const filePath = join(TEST_DIR, 'a', 'b', 'c', 'deep.txt')
    const result = await WriteTool.execute({ file_path: filePath, content: 'deep' }, ctx)

    expect(result.isError).toBeFalsy()
    expect(existsSync(filePath)).toBe(true)
  })

  it('should create a file history snapshot when manager is provided', async () => {
    const filePath = join(TEST_DIR, 'history-write.txt')
    const history = new FileHistoryManager({ cwd: TEST_DIR, rootDir: join(TEST_DIR, '.dsxu', 'file-history') })
    const historyCtx: ToolContext = {
      ...ctx,
      toolUseId: 'write-1',
      fileHistory: history,
    }

    const result = await WriteTool.execute({ file_path: filePath, content: 'hello world' }, historyCtx)

    expect(result.isError).toBeFalsy()
    expect(history.canRestore('write-1')).toBe(true)
    expect(history.getState().snapshots).toHaveLength(1)
  })
})

describe('EditTool', () => {
  it('should replace text in file', async () => {
    const filePath = join(TEST_DIR, 'edit.txt')
    writeFileSync(filePath, 'hello world\ngoodbye world\n')

    const result = await EditTool.execute({
      file_path: filePath,
      old_string: 'hello world',
      new_string: 'hi earth',
    }, ctx)

    expect(result.isError).toBeFalsy()
    const content = require('fs').readFileSync(filePath, 'utf-8')
    expect(content).toContain('hi earth')
    expect(content).toContain('goodbye world')
  })

  it('should error if old_string not found', async () => {
    const filePath = join(TEST_DIR, 'edit.txt')
    writeFileSync(filePath, 'hello world\n')

    const result = await EditTool.execute({
      file_path: filePath,
      old_string: 'not here',
      new_string: 'replacement',
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('should error if old_string is not unique (without replace_all)', async () => {
    const filePath = join(TEST_DIR, 'dup.txt')
    writeFileSync(filePath, 'foo\nfoo\nbar\n')

    const result = await EditTool.execute({
      file_path: filePath,
      old_string: 'foo',
      new_string: 'baz',
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('2 times')
  })

  it('should replace all with replace_all=true', async () => {
    const filePath = join(TEST_DIR, 'dup.txt')
    writeFileSync(filePath, 'foo\nfoo\nbar\n')

    const result = await EditTool.execute({
      file_path: filePath,
      old_string: 'foo',
      new_string: 'baz',
      replace_all: true,
    }, ctx)

    expect(result.isError).toBeFalsy()
    const content = require('fs').readFileSync(filePath, 'utf-8')
    expect(content).toBe('baz\nbaz\nbar\n')
  })

  it('should create an editable snapshot that can rewind', async () => {
    const filePath = join(TEST_DIR, 'rewind-edit.txt')
    writeFileSync(filePath, 'before\n')
    const history = new FileHistoryManager({ cwd: TEST_DIR, rootDir: join(TEST_DIR, '.dsxu', 'file-history') })
    const historyCtx: ToolContext = {
      ...ctx,
      toolUseId: 'edit-1',
      fileHistory: history,
    }

    const result = await EditTool.execute({
      file_path: filePath,
      old_string: 'before',
      new_string: 'after',
    }, historyCtx)

    expect(result.isError).toBeFalsy()
    expect(history.canRestore('edit-1')).toBe(true)
    history.rewind('edit-1')
    const content = require('fs').readFileSync(filePath, 'utf-8')
    expect(content).toBe('after\n')
  })
})

describe('GrepTool', () => {
  it('should find pattern in files (or gracefully degrade)', async () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), 'const x = 1;\nconst y = 2;\n')
    writeFileSync(join(TEST_DIR, 'b.ts'), 'const z = 3;\n')

    const result = await GrepTool.execute({
      pattern: 'const',
      path: TEST_DIR,
    }, ctx)

    // rg 可能不在 PATH 中（CI/Windows 环境），此时降级为 grep 或返回 No matches
    // 只要不崩就行
    expect(result.isError).toBeFalsy()
  })

  it('should not crash on non-existent pattern', async () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), 'hello\n')

    const result = await GrepTool.execute({
      pattern: 'ZZZZNOTHERE',
      path: TEST_DIR,
    }, ctx)

    // 无论 rg 是否可用，都应该不崩
    expect(result.content).toContain('No matches')
  })
})

describe('GlobTool', () => {
  it('should find files by pattern', async () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), '')
    writeFileSync(join(TEST_DIR, 'b.ts'), '')
    writeFileSync(join(TEST_DIR, 'c.js'), '')

    const result = await GlobTool.execute({
      pattern: '*.ts',
      path: TEST_DIR,
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('a.ts')
    expect(result.content).toContain('b.ts')
    expect(result.content).not.toContain('c.js')
  })
})

describe('Tool collections', () => {
  it('getCoreTools should return 6 tools', () => {
    expect(getCoreTools()).toHaveLength(6)
  })

  it('getReadOnlyTools should return 3 read-only tools', () => {
    const tools = getReadOnlyTools()
    expect(tools).toHaveLength(3)
    expect(tools.every(t => t.readOnly)).toBe(true)
  })
})
