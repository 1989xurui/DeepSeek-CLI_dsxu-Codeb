import { describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(join(root, dir))) {
    const full = join(dir, entry)
    const stat = statSync(join(root, full))
    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      walk(full, acc)
      continue
    }
    if (/\.(ts|tsx)$/.test(entry)) acc.push(full.replace(/\\/g, '/'))
  }
  return acc
}

function importsDsxuEngineRuntime(text: string): boolean {
  return /from ['"].*dsxu\/engine\/(?:query-loop|index)(?:\.js|\.ts)?['"]/.test(text) ||
    /from ['"].*\/dsxu\/engine(?:\.js|\.ts)?['"]/.test(text)
}

describe('product runtime owner map V1', () => {
  test('product entry path runs through root QueryEngine and root query loop', () => {
    const entrypoint = read('src/entrypoints/dsxu-code.tsx')
    const print = read('src/cli/print.ts')
    const sdkEngine = read('src/QueryEngine.ts')
    const rootQuery = read('src/query.ts')

    expect(entrypoint).toContain("await import('./cli.tsx')")
    expect(print).toContain("import { ask } from 'src/QueryEngine.js'")
    expect(sdkEngine).toContain("import { query } from './query.js'")
    expect(sdkEngine).toContain('const engine = new QueryEngine({')
    expect(rootQuery).toContain('async function* queryLoop')
    expect(rootQuery).toContain('runTools')
    expect(rootQuery).toContain('handleStopHooks')
    expect(rootQuery).toContain('buildDsxuFinalGateState')
  })

  test('CLI, TUI, and service entry files do not import the DSXU engine harness loop', () => {
    const productFiles = [
      'src/entrypoints/dsxu-code.tsx',
      'src/entrypoints/cli.tsx',
      'src/cli/print.ts',
      'src/main.tsx',
      'src/query.ts',
      'src/QueryEngine.ts',
      ...walk('src/services'),
      ...walk('src/tools'),
      ...walk('src/components'),
    ]
    const offenders = productFiles
      .filter(path => importsDsxuEngineRuntime(read(path)))
      .map(path => relative(root, join(root, path)).replace(/\\/g, '/'))

    expect(offenders).toEqual([])
  })

  test('DSXU engine query-loop remains scoped to harness, contracts, and engine package tests', () => {
    const files = [
      ...walk('src'),
      ...walk('scripts'),
    ]
    const importers = files
      .filter(path => /from ['"].*query-loop(?:\.js|\.ts)?['"]/.test(read(path)))
      .map(path => path.replace(/\\/g, '/'))
      .sort()

    const disallowed = importers.filter(path =>
      !path.startsWith('scripts/') &&
      !path.startsWith('src/dsxu/engine/') &&
      !path.startsWith('src/dsxu/integration/harness/') &&
      !path.startsWith('src/dsxu/training/'),
    )

    expect(importers).toContain('src/dsxu/engine/index.ts')
    expect(importers).toContain('src/dsxu/engine/forked-agent.ts')
    expect(disallowed).toEqual([])
  })
})
