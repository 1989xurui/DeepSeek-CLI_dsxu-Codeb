/**
 * Blast Radius Analysis 测试
 * #5.1 变更影响分析
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseImports,
  parseExports,
  buildDepGraph,
  computeBlastRadius,
  isTestFile,
  collectSourceFiles,
  BlastRadiusTool,
  quickBlastRadius,
} from '../blast-radius'
import type { ToolContext } from '../types'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join, resolve } from 'path'

let TEST_DIR: string
let ctx: ToolContext

beforeEach(() => {
  TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-blast-test-' + Date.now())
  ctx = { cwd: TEST_DIR, sessionId: 'test', gear: 1 }
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ── parseImports ──

describe('parseImports', () => {
  it('should parse ES module imports', () => {
    const file = join(TEST_DIR, 'main.ts')
    writeFileSync(join(TEST_DIR, 'utils.ts'), 'export const x = 1')
    writeFileSync(file, `
import { foo } from './utils'
import type { Bar } from './types'
import './side-effect'
`)
    // types.ts doesn't exist, so it won't resolve
    writeFileSync(join(TEST_DIR, 'types.ts'), 'export type Bar = string')
    writeFileSync(join(TEST_DIR, 'side-effect.ts'), 'console.log("hi")')

    const imports = parseImports(
      `import { foo } from './utils'\nimport type { Bar } from './types'\nimport './side-effect'`,
      file,
    )
    expect(imports).toContain(resolve(TEST_DIR, 'utils.ts'))
    expect(imports).toContain(resolve(TEST_DIR, 'types.ts'))
    expect(imports).toContain(resolve(TEST_DIR, 'side-effect.ts'))
  })

  it('should parse re-exports', () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), 'export const a = 1')
    const file = join(TEST_DIR, 'index.ts')
    const imports = parseImports(`export { a } from './a'`, file)
    expect(imports).toContain(resolve(TEST_DIR, 'a.ts'))
  })

  it('should parse require()', () => {
    writeFileSync(join(TEST_DIR, 'lib.ts'), 'module.exports = {}')
    const file = join(TEST_DIR, 'app.ts')
    const imports = parseImports(`const lib = require('./lib')`, file)
    expect(imports).toContain(resolve(TEST_DIR, 'lib.ts'))
  })

  it('should skip node_modules imports', () => {
    const file = join(TEST_DIR, 'app.ts')
    const imports = parseImports(`import express from 'express'`, file)
    expect(imports).toHaveLength(0)
  })

  it('should resolve index files', () => {
    const subDir = join(TEST_DIR, 'components')
    mkdirSync(subDir, { recursive: true })
    writeFileSync(join(subDir, 'index.ts'), 'export const Button = "btn"')

    const file = join(TEST_DIR, 'app.ts')
    const imports = parseImports(`import { Button } from './components'`, file)
    expect(imports).toContain(resolve(subDir, 'index.ts'))
  })
})

// ── parseExports ──

describe('parseExports', () => {
  it('should parse named exports', () => {
    const exports = parseExports(`
export function foo() {}
export const bar = 1
export class MyClass {}
export type MyType = string
export interface MyInterface {}
export enum MyEnum { A, B }
    `)
    expect(exports).toContain('foo')
    expect(exports).toContain('bar')
    expect(exports).toContain('MyClass')
    expect(exports).toContain('MyType')
    expect(exports).toContain('MyInterface')
    expect(exports).toContain('MyEnum')
  })

  it('should parse export { ... }', () => {
    const exports = parseExports(`export { alpha, beta as gamma }`)
    expect(exports).toContain('alpha')
    expect(exports).toContain('gamma')
  })

  it('should parse default export', () => {
    const exports = parseExports(`export default function main() {}`)
    expect(exports).toContain('main')
  })

  it('should parse async function exports', () => {
    const exports = parseExports(`export async function fetchData() {}`)
    expect(exports).toContain('fetchData')
  })
})

// ── isTestFile ──

describe('isTestFile', () => {
  it('should detect test files', () => {
    expect(isTestFile('src/app.test.ts')).toBe(true)
    expect(isTestFile('src/app.spec.ts')).toBe(true)
    expect(isTestFile('src/__tests__/app.ts')).toBe(true)
  })

  it('should not detect non-test files', () => {
    expect(isTestFile('src/app.ts')).toBe(false)
    expect(isTestFile('src/utils/helper.ts')).toBe(false)
  })
})

// ── collectSourceFiles ──

describe('collectSourceFiles', () => {
  it('should collect TS files recursively', () => {
    writeFileSync(join(TEST_DIR, 'a.ts'), '')
    writeFileSync(join(TEST_DIR, 'b.tsx'), '')
    mkdirSync(join(TEST_DIR, 'sub'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'sub', 'c.ts'), '')
    writeFileSync(join(TEST_DIR, 'readme.md'), '')  // Should be skipped

    const files = collectSourceFiles(TEST_DIR)
    expect(files.length).toBe(3)
    expect(files.some(f => f.endsWith('a.ts'))).toBe(true)
    expect(files.some(f => f.endsWith('b.tsx'))).toBe(true)
    expect(files.some(f => f.endsWith('c.ts'))).toBe(true)
  })

  it('should skip node_modules', () => {
    mkdirSync(join(TEST_DIR, 'node_modules', 'pkg'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'node_modules', 'pkg', 'index.ts'), '')
    writeFileSync(join(TEST_DIR, 'app.ts'), '')

    const files = collectSourceFiles(TEST_DIR)
    expect(files.length).toBe(1)
  })
})

// ── buildDepGraph ──

describe('buildDepGraph', () => {
  it('should build import/importedBy relationships', () => {
    const utilsPath = join(TEST_DIR, 'utils.ts')
    const mainPath = join(TEST_DIR, 'main.ts')
    const indexPath = join(TEST_DIR, 'index.ts')

    writeFileSync(utilsPath, `export function helper() { return 1 }`)
    writeFileSync(mainPath, `import { helper } from './utils'\nexport const app = helper()`)
    writeFileSync(indexPath, `import { app } from './main'\nconsole.log(app)`)

    const graph = buildDepGraph(TEST_DIR)

    expect(graph.nodes.size).toBe(3)

    const utilsNode = graph.nodes.get(resolve(utilsPath))!
    expect(utilsNode).toBeDefined()
    expect(utilsNode.importedBy.has(resolve(mainPath))).toBe(true)
    expect(utilsNode.exports).toContain('helper')

    const mainNode = graph.nodes.get(resolve(mainPath))!
    expect(mainNode.imports.has(resolve(utilsPath))).toBe(true)
    expect(mainNode.importedBy.has(resolve(indexPath))).toBe(true)
  })
})

// ── computeBlastRadius ──

describe('computeBlastRadius', () => {
  it('should compute direct and transitive dependents', () => {
    const aPath = join(TEST_DIR, 'a.ts')
    const bPath = join(TEST_DIR, 'b.ts')
    const cPath = join(TEST_DIR, 'c.ts')

    writeFileSync(aPath, `export const a = 1`)
    writeFileSync(bPath, `import { a } from './a'\nexport const b = a + 1`)
    writeFileSync(cPath, `import { b } from './b'\nconsole.log(b)`)

    const graph = buildDepGraph(TEST_DIR)
    const result = computeBlastRadius(graph, [resolve(aPath)])

    expect(result.changedFiles).toHaveLength(1)
    expect(result.directDependents).toContain(resolve(bPath))
    expect(result.transitiveDependents).toContain(resolve(cPath))
    expect(result.totalAffected).toBe(3)
  })

  it('should identify affected test files', () => {
    const libPath = join(TEST_DIR, 'lib.ts')
    const testDir = join(TEST_DIR, '__tests__')
    mkdirSync(testDir, { recursive: true })
    const testPath = join(testDir, 'lib.test.ts')

    writeFileSync(libPath, `export function add(a: number, b: number) { return a + b }`)
    writeFileSync(testPath, `import { add } from '../lib'\nconsole.log(add(1, 2))`)

    const graph = buildDepGraph(TEST_DIR)
    const result = computeBlastRadius(graph, [resolve(libPath)])

    expect(result.affectedTests.length).toBeGreaterThan(0)
    expect(result.affectedTests.some(t => t.includes('lib.test.ts'))).toBe(true)
  })

  it('should respect maxDepth', () => {
    // Chain: a → b → c → d → e
    const files = ['a', 'b', 'c', 'd', 'e'].map(n => join(TEST_DIR, `${n}.ts`))
    writeFileSync(files[0], `export const a = 1`)
    writeFileSync(files[1], `import { a } from './a'\nexport const b = a`)
    writeFileSync(files[2], `import { b } from './b'\nexport const c = b`)
    writeFileSync(files[3], `import { c } from './c'\nexport const d = c`)
    writeFileSync(files[4], `import { d } from './d'\nexport const e = d`)

    const graph = buildDepGraph(TEST_DIR)
    const result = computeBlastRadius(graph, [resolve(files[0])], 2)

    // With maxDepth=2, should reach b (depth 1) and c (depth 2) but not d or e
    const allAffected = [...result.directDependents, ...result.transitiveDependents]
    expect(allAffected).toContain(resolve(files[1]))  // b - depth 1
    expect(allAffected).toContain(resolve(files[2]))  // c - depth 2
    expect(allAffected).not.toContain(resolve(files[3]))  // d - depth 3
  })

  it('should handle circular dependencies', () => {
    const aPath = join(TEST_DIR, 'a.ts')
    const bPath = join(TEST_DIR, 'b.ts')

    writeFileSync(aPath, `import { b } from './b'\nexport const a = b + 1`)
    writeFileSync(bPath, `import { a } from './a'\nexport const b = a + 1`)

    const graph = buildDepGraph(TEST_DIR)
    // Should not infinite loop
    const result = computeBlastRadius(graph, [resolve(aPath)])
    expect(result.totalAffected).toBeGreaterThanOrEqual(1)
  })

  it('should find co-located test files', () => {
    const libPath = join(TEST_DIR, 'math.ts')
    const testPath = join(TEST_DIR, 'math.test.ts')

    writeFileSync(libPath, `export const PI = 3.14`)
    writeFileSync(testPath, `import { PI } from './math'\nconsole.log(PI)`)

    const graph = buildDepGraph(TEST_DIR)
    const result = computeBlastRadius(graph, [resolve(libPath)])

    expect(result.affectedTests.some(t => t.includes('math.test.ts'))).toBe(true)
  })
})

// ── BlastRadiusTool ──

describe('BlastRadiusTool', () => {
  it('should have correct metadata', () => {
    expect(BlastRadiusTool.name).toBe('BlastRadius')
    expect(BlastRadiusTool.readOnly).toBe(true)
    expect(BlastRadiusTool.concurrencySafe).toBe(true)
  })

  it('should error on empty changed_files', async () => {
    const result = await BlastRadiusTool.execute({ changed_files: [] }, ctx)
    expect(result.isError).toBe(true)
  })

  it('should error on missing files', async () => {
    const result = await BlastRadiusTool.execute({
      changed_files: ['nonexistent.ts'],
    }, ctx)
    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('should analyze real files', async () => {
    const utilsPath = join(TEST_DIR, 'utils.ts')
    const appPath = join(TEST_DIR, 'app.ts')

    writeFileSync(utilsPath, `export function greet() { return 'hi' }`)
    writeFileSync(appPath, `import { greet } from './utils'\nconsole.log(greet())`)

    const result = await BlastRadiusTool.execute({
      changed_files: ['utils.ts'],
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Blast Radius Analysis')
    expect(result.content).toContain('utils.ts')
    expect(result.content).toContain('app.ts')
    expect(result.meta?.totalAffected).toBeGreaterThanOrEqual(2)
  })
})
