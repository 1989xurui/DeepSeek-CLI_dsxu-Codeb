import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..', '..', '..', '..')
const UI_ROOTS = ['src/components', 'src/hooks', 'src/ink', 'src/screens', 'src/buddy']
const SHARED_ROOTS = ['src/utils', 'src/services']

function collectSourceFiles(root: string, files: string[] = []): string[] {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) {
      collectSourceFiles(path, files)
      continue
    }
    if (entry.isFile() && /\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(path)
    }
  }
  return files
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).replace(/\\/g, '/')
}

function sourceFiles(roots: string[]): string[] {
  return roots.flatMap(root => collectSourceFiles(join(REPO_ROOT, root)))
}

describe('V20 visible-state and shared utility owner evidence', () => {
  test('keeps UI/TUI as projection and interaction surfaces, not product runtimes', () => {
    const forbiddenRuntimePatterns = [
      /\bruntime-core\b/,
      /\bprovider-backend\b/,
      /from\s+['"][^'"]*mcp-client['"]/,
      /\bnew\s+MCPManager\b/,
      /\bnew\s+MCPConnection\b/,
      /\bregisterMainlineCoreToolAdapters\b/,
      /\bregisterMCPFromMainlineClients\b/,
      /\bqueryLoop\b/,
    ]
    const offenders = sourceFiles(UI_ROOTS).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      return forbiddenRuntimePatterns.some(pattern => pattern.test(source))
        ? [repoPath(path)]
        : []
    })

    expect(offenders).toEqual([])
  })

  test('limits UI process execution to the REPL tmux detach projection', () => {
    const processImportFiles = sourceFiles(UI_ROOTS).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      return /from\s+['"]child_process['"]|require\(['"]child_process['"]\)/.test(source)
        ? [repoPath(path)]
        : []
    })

    expect(processImportFiles).toEqual(['src/screens/REPL.tsx'])

    const replSource = readFileSync(join(REPO_ROOT, 'src/screens/REPL.tsx'), 'utf8')
    expect(replSource).toContain("spawnSync('tmux', ['detach-client']")
    expect(replSource).not.toMatch(/\bexec\s*\(/)
    expect(replSource).not.toMatch(/\bspawn\s*\(/)
  })

  test('keeps UI model and browser-provider calls inside named owner boundaries', () => {
    const directModelCallers = sourceFiles(UI_ROOTS).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      return source.includes('queryModelWithoutStreaming')
        ? [repoPath(path)]
        : []
    })
    expect(directModelCallers).toEqual(['src/components/agents/generateAgent.ts'])

    const generateAgent = readFileSync(
      join(REPO_ROOT, 'src/components/agents/generateAgent.ts'),
      'utf8',
    )
    expect(generateAgent).toContain("querySource: 'agent_creation'")
    expect(generateAgent).toContain('tools: []')
    expect(generateAgent).toContain('getEmptyToolPermissionContext')

    const browserProvider = readFileSync(
      join(REPO_ROOT, 'src/hooks/usePromptsFromDsxuBrowserProvider.tsx'),
      'utf8',
    )
    expect(browserProvider).toContain('callIdeRpc("set_permission_mode"')
    expect(browserProvider).toContain('toolPermissionMode === "bypassPermissions"')
    expect(browserProvider).toContain('DSXU_BROWSER_PROVIDER_MCP_SERVER_NAME')
  })

  test('keeps shared utilities away from retired DSXU engine runtimes', () => {
    const forbiddenSharedPatterns = [
      /\bruntime-core\b/,
      /\bprovider-backend\b/,
      /from\s+['"][^'"]*mcp-client['"]/,
      /\blegacyProvider\b/,
      /\blegacyRemoteMcpProvider\b/,
      /\blegacyRemoteTriggerProvider\b/,
      /\blegacyModelCompat\b/,
      /\bconnectMCPFromConfig\b/,
      /\ballowMainlineToolFallback\b/,
    ]
    const offenders = sourceFiles(SHARED_ROOTS).flatMap(path => {
      const source = readFileSync(path, 'utf8')
      return forbiddenSharedPatterns.some(pattern => pattern.test(source))
        ? [repoPath(path)]
        : []
    })

    expect(offenders).toEqual([])
  })
})
