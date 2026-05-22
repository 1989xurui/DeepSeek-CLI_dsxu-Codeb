import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export type C16ShellAuditEntry = {
  path: string
  category: 'shell-core' | 'shell-ui' | 'non-shell'
  inScope: boolean
  status: 'completed' | 'partial' | 'missing' | 'out-of-scope'
}

export type C16ShellAuditMatrix = {
  totalSourceFiles: number
  entries: C16ShellAuditEntry[]
}

export function getC16ShellAuditMatrix(root = process.cwd()): C16ShellAuditMatrix {
  const sourceRoot = join(root, 'src')
  const files = listSourceFiles(sourceRoot).map((file) => relative(root, file).replaceAll('\\', '/'))
  const entries = files.map((file): C16ShellAuditEntry => {
    const isShellUi = /(^|\/)(ui|tui|terminal)(\/|$)/i.test(file)
    const isShellCore = /(shell|bash|powershell|terminal)/i.test(file)
    if (isShellUi) {
      return { path: file, category: 'shell-ui', inScope: false, status: 'out-of-scope' }
    }
    if (!isShellCore) {
      return { path: file, category: 'non-shell', inScope: false, status: 'out-of-scope' }
    }
    return {
      path: file,
      category: 'shell-core',
      inScope: true,
      status: file.includes('adapter') || file.includes('Tool') ? 'completed' : 'partial',
    }
  })
  return {
    totalSourceFiles: entries.length,
    entries,
  }
}

export function summarizeC16ShellAudit(matrix: C16ShellAuditMatrix) {
  const inScope = matrix.entries.filter((entry) => entry.inScope)
  const outOfScopeSourceFiles = matrix.entries.length - inScope.length
  const completed = inScope.filter((entry) => entry.status === 'completed').length
  const partial = inScope.filter((entry) => entry.status === 'partial').length
  const missing = inScope.filter((entry) => entry.status === 'missing').length
  const conversionRate = inScope.length === 0 ? 100 : (completed / inScope.length) * 100
  return {
    totalSourceFiles: matrix.totalSourceFiles,
    inScopeSourceFiles: inScope.length,
    outOfScopeSourceFiles,
    completed,
    partial,
    missing,
    conversionRate,
    is100: conversionRate === 100,
  }
}

function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry) && !entry.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}
