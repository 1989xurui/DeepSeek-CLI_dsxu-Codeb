/**
 * LSP Tool 测试
 *
 * 策略：
 * - parseTscOutput: 纯逻辑，不需要 tsc
 * - documentSymbol: 纯正则，读内存中的文件
 * - diagnostics/goToDefinition/findReferences: 需要 bash+rg，CI 可能没有 → 容错
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LSPTool, parseTscOutput, collectProjectDiagnostics } from '../lsp-tool'
import type { ToolContext } from '../types'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-lsp-test-' + Date.now())
const ctx: ToolContext = { cwd: TEST_DIR, sessionId: 'test', gear: 1 }

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ── parseTscOutput ──

describe('parseTscOutput', () => {
  it('should parse tsc error output', () => {
    const output = `src/auth.ts(10,5): error TS2304: Cannot find name 'user'.
src/auth.ts(15,3): error TS2322: Type 'string' is not assignable to type 'number'.
src/index.ts(2,1): error TS2307: Cannot find module './missing'.`

    const diags = parseTscOutput(output, '/project')
    expect(diags).toHaveLength(3)

    expect(diags[0].line).toBe(10)
    expect(diags[0].character).toBe(5)
    expect(diags[0].severity).toBe('error')
    expect(diags[0].code).toBe('TS2304')
    expect(diags[0].message).toBe("Cannot find name 'user'.")
    expect(diags[0].source).toBe('tsc')
  })

  it('should filter by file path', () => {
    const { resolve } = require('path')
    const cwd = resolve(TEST_DIR)
    const output = `src/a.ts(1,1): error TS0001: Error A.
src/b.ts(1,1): error TS0002: Error B.`

    const filterPath = resolve(cwd, 'src/a.ts')
    const diags = parseTscOutput(output, cwd, filterPath)
    expect(diags).toHaveLength(1)
    expect(diags[0].message).toBe('Error A.')
  })

  it('should return empty for clean output', () => {
    const diags = parseTscOutput('', '/project')
    expect(diags).toHaveLength(0)
  })

  it('should handle multiple errors in same file', () => {
    const output = `file.ts(1,1): error TS1001: Err1.
file.ts(2,1): error TS1002: Err2.
file.ts(3,1): error TS1003: Err3.`

    const diags = parseTscOutput(output, '/project')
    expect(diags).toHaveLength(3)
    expect(diags.map(d => d.code)).toEqual(['TS1001', 'TS1002', 'TS1003'])
  })
})

// ── documentSymbol ──

describe('LSPTool — documentSymbol', () => {
  it('should extract symbols from TypeScript file', async () => {
    const filePath = join(TEST_DIR, 'symbols.ts')
    writeFileSync(filePath, `
export interface User {
  name: string
  age: number
}

export class AuthService {
  login() {}
}

export function validateEmail(email: string): boolean {
  return email.includes('@')
}

export type UserRole = 'admin' | 'user'

export const MAX_RETRIES = 3

enum Status {
  Active,
  Inactive,
}
`)

    const result = await LSPTool.execute({
      operation: 'documentSymbol',
      file_path: filePath,
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('User')
    expect(result.content).toContain('AuthService')
    expect(result.content).toContain('validateEmail')
    expect(result.content).toContain('UserRole')
    expect(result.content).toContain('MAX_RETRIES')
    expect(result.content).toContain('interface')
    expect(result.content).toContain('class')
    expect(result.content).toContain('function')
  })

  it('should handle empty file', async () => {
    const filePath = join(TEST_DIR, 'empty.ts')
    writeFileSync(filePath, '// no symbols here\n')

    const result = await LSPTool.execute({
      operation: 'documentSymbol',
      file_path: filePath,
    }, ctx)

    expect(result.content).toContain('No symbols')
  })
})

// ── hover ──

describe('LSPTool — hover', () => {
  it('should return context around cursor', async () => {
    const filePath = join(TEST_DIR, 'hover.ts')
    writeFileSync(filePath, `const x = 1
const y = 2
function add(a: number, b: number): number {
  return a + b
}
const z = add(x, y)
`)

    const result = await LSPTool.execute({
      operation: 'hover',
      file_path: filePath,
      line: 3,
      character: 10,
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('add')
    expect(result.content).toContain('Context')
  }, 15000)
})

// ── Error cases ──

describe('LSPTool — error handling', () => {
  it('should error on non-existent file', async () => {
    const result = await LSPTool.execute({
      operation: 'documentSymbol',
      file_path: '/nonexistent/file.ts',
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('should handle unknown operation', async () => {
    const filePath = join(TEST_DIR, 'test.ts')
    writeFileSync(filePath, 'const x = 1\n')

    const result = await LSPTool.execute({
      operation: 'unknownOp',
      file_path: filePath,
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Unknown operation')
  })

  it('should require file_path for non-workspace operations', async () => {
    const result = await LSPTool.execute({
      operation: 'documentSymbol',
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('file_path is required')
  })
})

// ── goToDefinition (requires rg, may skip in CI) ──

describe('LSPTool — goToDefinition', () => {
  it('should find definition via grep (or degrade gracefully)', async () => {
    const filePath = join(TEST_DIR, 'main.ts')
    writeFileSync(filePath, `import { User } from './types'
const u: User = { name: 'test' }
`)
    writeFileSync(join(TEST_DIR, 'types.ts'), `export interface User {
  name: string
}
`)

    const result = await LSPTool.execute({
      operation: 'goToDefinition',
      file_path: filePath,
      line: 2,
      character: 8,  // 'User'
    }, ctx)

    // May or may not find definition depending on whether rg is available
    expect(result.isError).toBeFalsy()
  })
})

// ── findReferences ──

describe('LSPTool — findReferences', () => {
  it('should find references via grep (or degrade gracefully)', async () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), `export const FOO = 'bar'\n`)
    writeFileSync(join(TEST_DIR, 'b.ts'), `import { FOO } from './a'\nconsole.log(FOO)\n`)

    const result = await LSPTool.execute({
      operation: 'findReferences',
      file_path: join(TEST_DIR, 'a.ts'),
      line: 1,
      character: 14,  // 'FOO'
    }, ctx)

    expect(result.isError).toBeFalsy()
  })
})

describe('LSPTool — workspaceSymbol', () => {
  it('should search symbols across workspace', async () => {
    writeFileSync(join(TEST_DIR, 'sym-a.ts'), `export class UserRepo {}\nexport const makeUser = () => ({})\n`)
    writeFileSync(join(TEST_DIR, 'sym-b.ts'), `interface UserModel { id: string }\nconst UserService = {}\n`)

    const result = await LSPTool.execute({
      operation: 'workspaceSymbol',
      query: 'User',
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(
      result.content.includes('Workspace symbols') ||
      result.content.includes('No workspace symbols found')
    ).toBe(true)
  })
})

// ── rename ──

describe('LSPTool — rename', () => {
  it('should preview rename operation (or handle no references gracefully)', async () => {
    const filePath = join(TEST_DIR, 'rename.ts')
    writeFileSync(filePath, `const oldName = 'value'
function useOldName() {
  return oldName + ' suffix'
}
console.log(oldName)
`)

    const result = await LSPTool.execute({
      operation: 'rename',
      file_path: filePath,
      line: 1,
      character: 7,  // 'oldName'
      new_name: 'newName',
    }, ctx)

    expect(result.isError).toBeFalsy()
    // 可能找到引用（显示预览）或没找到（显示"No references found"）
    // 两种结果都有效，取决于rg是否可用
    expect(
      result.content.includes('Rename Preview') ||
      result.content.includes('No references found')
    ).toBe(true)
  })

  it('should handle invalid new name', async () => {
    const filePath = join(TEST_DIR, 'invalid.ts')
    writeFileSync(filePath, 'const x = 1\n')

    const result = await LSPTool.execute({
      operation: 'rename',
      file_path: filePath,
      line: 1,
      character: 7,
      new_name: '123invalid', // 无效的标识符
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Invalid new name')
  })

  it('should handle same name', async () => {
    const filePath = join(TEST_DIR, 'same.ts')
    writeFileSync(filePath, 'const x = 1\n')

    const result = await LSPTool.execute({
      operation: 'rename',
      file_path: filePath,
      line: 1,
      character: 7,
      new_name: 'x', // 同名
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('same as old name')
  })

  it('should handle missing symbol', async () => {
    const filePath = join(TEST_DIR, 'missing.ts')
    writeFileSync(filePath, '// no symbol here\n')

    const result = await LSPTool.execute({
      operation: 'rename',
      file_path: filePath,
      line: 1,
      character: 1,
      new_name: 'newName',
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('No symbol found')
  })
})

// ── collectProjectDiagnostics ──

describe('collectProjectDiagnostics', () => {
  it('should return null for clean project (or no tsc)', async () => {
    // Empty dir → tsc won't find tsconfig → returns null
    const result = await collectProjectDiagnostics(TEST_DIR)
    // Either null (no tsc) or null (no errors) or a string (errors found)
    // All are valid — we just test it doesn't throw
    expect(typeof result === 'string' || result === null).toBe(true)
  })
})

describe('LSPTool — projectDiagnostics', () => {
  it('should run project-level diagnostics without file_path', async () => {
    const result = await LSPTool.execute({
      operation: 'projectDiagnostics',
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(typeof result.content).toBe('string')
  })
})
