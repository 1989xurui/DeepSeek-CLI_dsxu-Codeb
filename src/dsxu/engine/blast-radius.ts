/**
 *
 *
 * 给定修改的文件/符号 → 分析波及范围：
 *   1. 解析 TypeScript import/export → 构建依赖图
 *   2. 从变更文件出发 → BFS 找到所有直接/间接依赖者
 *   3. 识别受影响的测试文件
 *   4. 输出优先级排序的影响列表
 *
 * 不依赖 LSIF（太重），用 ripgrep + regex 轻量实现。
 * 注册为 ToolDefinition，LLM 自动选择使用。
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { resolve, relative, dirname, extname, join, basename } from 'path'
import { spawnSync } from 'child_process'

// ── Dependency Graph ──

export interface DepNode {
  /** 文件绝对路径 */
  file: string
  /** 该文件 import 的文件（依赖） */
  imports: Set<string>
  /** 依赖该文件的文件（被依赖者） */
  importedBy: Set<string>
  /** 导出的符号 */
  exports: string[]
}

export interface DepGraph {
  nodes: Map<string, DepNode>
}

/** 支持的文件扩展名 */
const TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

/**
 * 解析文件中的 import 语句，提取被导入的模块路径
 */
export function parseImports(content: string, filePath: string): string[] {
  const dir = dirname(filePath)
  const imports: string[] = []

  // Match: import ... from '...'
  // Match: import '...'
  // Match: export ... from '...'
  // Match: require('...')
  const patterns = [
    /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
    /import\s+['"]([^'"]+)['"]/g,
    /export\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const specifier = match[1]
      // Only resolve relative imports (skip node_modules)
      if (specifier.startsWith('.')) {
        const resolved = resolveImport(dir, specifier)
        if (resolved) {
          imports.push(resolved)
        }
      }
    }
  }

  return [...new Set(imports)]
}

/**
 * 解析文件中的 export 符号名
 */
export function parseExports(content: string): string[] {
  const exports: string[] = []

  // export function/class/const/let/var/type/interface/enum NAME
  const namedPattern = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/g
  let match
  while ((match = namedPattern.exec(content)) !== null) {
    exports.push(match[1])
  }

  // export { Name, Name2 }
  const bracePattern = /export\s*\{([^}]+)\}/g
  while ((match = bracePattern.exec(content)) !== null) {
    const names = match[1].split(',').map(n => {
      const parts = n.trim().split(/\s+as\s+/)
      return (parts[1] || parts[0]).trim()
    }).filter(Boolean)
    exports.push(...names)
  }

  return [...new Set(exports)]
}

/**
 * 解析相对 import 路径 → 绝对文件路径
 */
function resolveImport(fromDir: string, specifier: string): string | null {
  const base = resolve(fromDir, specifier)

  // Try exact path first
  if (existsSync(base) && statSync(base).isFile()) {
    return base
  }

  // Try with extensions
  for (const ext of TS_EXTENSIONS) {
    const withExt = base + ext
    if (existsSync(withExt)) {
      return withExt
    }
  }

  // Try index files
  for (const ext of TS_EXTENSIONS) {
    const indexFile = join(base, `index${ext}`)
    if (existsSync(indexFile)) {
      return indexFile
    }
  }

  return null
}

/**
 * 递归收集项目中的 TS/JS 文件
 */
export function collectSourceFiles(
  dir: string,
  maxDepth: number = 10,
  _depth: number = 0,
): string[] {
  if (_depth > maxDepth) return []

  const results: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      // Skip common non-source directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo'].includes(entry.name)) {
          continue
        }
        results.push(...collectSourceFiles(join(dir, entry.name), maxDepth, _depth + 1))
      } else if (entry.isFile() && TS_EXTENSIONS.includes(extname(entry.name))) {
        results.push(join(dir, entry.name))
      }
    }
  } catch {
    // Permission denied, etc.
  }

  return results
}

/**
 * 构建项目依赖图
 */
export function buildDepGraph(projectRoot: string, files?: string[]): DepGraph {
  const sourceFiles = files || collectSourceFiles(projectRoot)
  const graph: DepGraph = { nodes: new Map() }

  // Phase 1: Parse all files
  for (const file of sourceFiles) {
    try {
      const content = readFileSync(file, 'utf-8')
      const imports = parseImports(content, file)
      const exports = parseExports(content)

      graph.nodes.set(file, {
        file,
        imports: new Set(imports),
        importedBy: new Set(),
        exports,
      })
    } catch {
      // Skip unreadable files
    }
  }

  // Phase 2: Build reverse edges (importedBy)
  for (const [file, node] of graph.nodes) {
    for (const imported of node.imports) {
      const importedNode = graph.nodes.get(imported)
      if (importedNode) {
        importedNode.importedBy.add(file)
      }
    }
  }

  return graph
}

// ── Blast Radius Computation ──

export interface BlastResult {
  /** 变更的源文件 */
  changedFiles: string[]
  /** 直接依赖者（import 了变更文件的） */
  directDependents: string[]
  /** 间接依赖者（传递依赖） */
  transitiveDependents: string[]
  /** 受影响的测试文件 */
  affectedTests: string[]
  /** 影响摘要 */
  summary: string
  /** 总影响文件数 */
  totalAffected: number
}

/**
 * 判断是否为测试文件
 */
export function isTestFile(filePath: string): boolean {
  const name = basename(filePath)
  return (
    name.includes('.test.') ||
    name.includes('.spec.') ||
    name.includes('__tests__') ||
    filePath.includes('__tests__') ||
    filePath.includes('__test__')
  )
}

/**
 * 计算变更的 Blast Radius
 *
 * @param graph 依赖图
 * @param changedFiles 变更的文件列表（绝对路径）
 * @param maxDepth BFS 最大深度（默认 5，防止循环依赖无限展开）
 */
export function computeBlastRadius(
  graph: DepGraph,
  changedFiles: string[],
  maxDepth: number = 5,
): BlastResult {
  const directDependents = new Set<string>()
  const transitiveDependents = new Set<string>()
  const changedSet = new Set(changedFiles)

  // BFS from changed files
  const queue: { file: string; depth: number }[] = []
  const visited = new Set<string>()

  // Initialize with direct dependents
  for (const changed of changedFiles) {
    visited.add(changed)
    const node = graph.nodes.get(changed)
    if (!node) continue

    for (const dep of node.importedBy) {
      if (!changedSet.has(dep)) {
        directDependents.add(dep)
        queue.push({ file: dep, depth: 1 })
      }
    }
  }

  // BFS for transitive dependents
  while (queue.length > 0) {
    const { file, depth } = queue.shift()!
    if (visited.has(file)) continue
    visited.add(file)

    if (depth > 1) {
      transitiveDependents.add(file)
    }

    if (depth >= maxDepth) continue

    const node = graph.nodes.get(file)
    if (!node) continue

    for (const dep of node.importedBy) {
      if (!visited.has(dep) && !changedSet.has(dep)) {
        queue.push({ file: dep, depth: depth + 1 })
      }
    }
  }

  // Identify affected test files
  const allAffected = new Set([...changedFiles, ...directDependents, ...transitiveDependents])
  const affectedTests = [...allAffected].filter(isTestFile)

  // Also find test files that test the changed modules (heuristic: same directory or __tests__ subdir)
  for (const changed of changedFiles) {
    const dir = dirname(changed)
    const baseName = basename(changed).replace(/\.[^.]+$/, '')
    const testDir = join(dir, '__tests__')

    // Check for co-located test file
    for (const ext of TS_EXTENSIONS) {
      const testFile = join(dir, `${baseName}.test${ext}`)
      if (existsSync(testFile) && !affectedTests.includes(testFile)) {
        affectedTests.push(testFile)
      }
      const specFile = join(dir, `${baseName}.spec${ext}`)
      if (existsSync(specFile) && !affectedTests.includes(specFile)) {
        affectedTests.push(specFile)
      }
      // __tests__/ subdir
      const testDirFile = join(testDir, `${baseName}.test${ext}`)
      if (existsSync(testDirFile) && !affectedTests.includes(testDirFile)) {
        affectedTests.push(testDirFile)
      }
    }
  }

  const totalAffected = allAffected.size

  const summary = [
    `Changed: ${changedFiles.length} file(s)`,
    `Direct dependents: ${directDependents.size}`,
    `Transitive dependents: ${transitiveDependents.size}`,
    `Affected tests: ${affectedTests.length}`,
    `Total blast radius: ${totalAffected} file(s)`,
  ].join(' | ')

  return {
    changedFiles,
    directDependents: [...directDependents],
    transitiveDependents: [...transitiveDependents],
    affectedTests,
    summary,
    totalAffected,
  }
}

// ── Tool Definition ──

export const BlastRadiusTool: ToolDefinition = {
  name: 'BlastRadius',
  description: `Analyze the blast radius of code changes. Given modified files, computes which other files are affected (direct and transitive dependents) and which test files should be run. Use before committing changes to understand impact scope.`,
  inputSchema: {
    type: 'object',
    properties: {
      changed_files: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of changed file paths (relative to project root)',
      },
      max_depth: {
        type: 'number',
        description: 'Maximum BFS depth for transitive analysis (default: 5)',
      },
    },
    required: ['changed_files'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    const changedPaths = (input.changed_files as string[]) || []
    const maxDepth = (input.max_depth as number) || 5

    if (changedPaths.length === 0) {
      return { content: 'No changed files specified.', isError: true }
    }

    // Resolve to absolute paths
    const changedFiles = changedPaths.map(p => resolve(ctx.cwd, p))

    // Validate files exist
    const missing = changedFiles.filter(f => !existsSync(f))
    if (missing.length > 0) {
      return {
        content: `Files not found: ${missing.map(f => relative(ctx.cwd, f)).join(', ')}`,
        isError: true,
      }
    }

    try {
      // Build dependency graph
      const graph = buildDepGraph(ctx.cwd)

      // Compute blast radius
      const result = computeBlastRadius(graph, changedFiles, maxDepth)

      // Format output
      const lines: string[] = []
      lines.push(`# Blast Radius Analysis\n`)
      lines.push(`## Changed Files (${result.changedFiles.length})`)
      for (const f of result.changedFiles) {
        lines.push(`  📝 ${relative(ctx.cwd, f)}`)
      }

      if (result.directDependents.length > 0) {
        lines.push(`\n## Direct Dependents (${result.directDependents.length})`)
        for (const f of result.directDependents) {
          lines.push(`  ⚡ ${relative(ctx.cwd, f)}`)
        }
      }

      if (result.transitiveDependents.length > 0) {
        lines.push(`\n## Transitive Dependents (${result.transitiveDependents.length})`)
        for (const f of result.transitiveDependents) {
          lines.push(`  🔗 ${relative(ctx.cwd, f)}`)
        }
      }

      if (result.affectedTests.length > 0) {
        lines.push(`\n## Affected Tests (${result.affectedTests.length})`)
        for (const f of result.affectedTests) {
          lines.push(`  🧪 ${relative(ctx.cwd, f)}`)
        }
        lines.push(`\nRecommended: run these test files to verify changes.`)
      }

      lines.push(`\n---\n${result.summary}`)

      return {
        content: lines.join('\n'),
        meta: {
          totalAffected: result.totalAffected,
          directDependents: result.directDependents.length,
          transitiveDependents: result.transitiveDependents.length,
          affectedTests: result.affectedTests.length,
        },
      }
    } catch (error: any) {
      return { content: `Blast radius analysis failed: ${error.message}`, isError: true }
    }
  },
}

/**
 *
 * 适合单文件变更场景
 */
export function quickBlastRadius(
  cwd: string,
  changedFile: string,
): { dependents: string[]; testFiles: string[] } {
  const relPath = relative(cwd, changedFile)
  const baseName = basename(changedFile).replace(/\.[^.]+$/, '')

  // Use ripgrep to find files that import this module
  const result = spawnSync('rg', [
    '--files-with-matches',
    '--type', 'ts',
    '--type', 'js',
    `from\\s+['\"].*${baseName}['\"]`,
    cwd,
  ], {
    encoding: 'utf-8',
    timeout: 15_000,
    maxBuffer: 1024 * 1024,
  })

  const output = (result.stdout || '').trim()
  const dependents = output
    ? output.split('\n').filter(f => f !== changedFile && f !== relPath)
    : []

  const testFiles = dependents.filter(isTestFile)

  return { dependents, testFiles }
}
