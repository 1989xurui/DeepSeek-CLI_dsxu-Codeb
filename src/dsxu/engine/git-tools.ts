/**
 * #6.13 Git Integration + #6.15 Diff Viewer
 *
 * Git 操作工具集：
 *   - git status / diff / log / blame
 *   - Structured diff parsing
 *   - Commit 辅助
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { spawnSync } from 'child_process'

// ── Git Command Executor ──

export interface GitResult {
  stdout: string
  stderr: string
  exitCode: number
  success: boolean
}

export function runGit(args: string[], cwd: string, timeout: number = 15_000): GitResult {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    timeout,
    maxBuffer: 5 * 1024 * 1024,
  })

  return {
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    exitCode: result.status ?? -1,
    success: result.status === 0,
  }
}

// ── Diff Parsing ──

export interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  oldLineNo?: number
  newLineNo?: number
}

export interface FileDiff {
  file: string
  oldFile?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: DiffHunk[]
  additions: number
  deletions: number
}

/**
 * 解析 git diff 输出为结构化数据
 */
export function parseDiff(diffOutput: string): FileDiff[] {
  const files: FileDiff[] = []
  const fileParts = diffOutput.split(/^diff --git /m).filter(Boolean)

  for (const part of fileParts) {
    const lines = part.split('\n')
    const headerMatch = lines[0]?.match(/a\/(.+?)\s+b\/(.+)/)
    if (!headerMatch) continue

    const oldFile = headerMatch[1]
    const newFile = headerMatch[2]

    let status: FileDiff['status'] = 'modified'
    if (part.includes('new file mode')) status = 'added'
    else if (part.includes('deleted file mode')) status = 'deleted'
    else if (part.includes('rename from')) status = 'renamed'

    const hunks: DiffHunk[] = []
    let currentHunk: DiffHunk | null = null
    let oldLine = 0
    let newLine = 0

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (hunkMatch) {
        currentHunk = {
          oldStart: parseInt(hunkMatch[1]),
          oldCount: parseInt(hunkMatch[2] || '1'),
          newStart: parseInt(hunkMatch[3]),
          newCount: parseInt(hunkMatch[4] || '1'),
          lines: [],
        }
        hunks.push(currentHunk)
        oldLine = currentHunk.oldStart
        newLine = currentHunk.newStart
        continue
      }

      if (!currentHunk) continue

      if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.lines.push({
          type: 'add',
          content: line.slice(1),
          newLineNo: newLine++,
        })
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.lines.push({
          type: 'remove',
          content: line.slice(1),
          oldLineNo: oldLine++,
        })
      } else if (line.startsWith(' ')) {
        currentHunk.lines.push({
          type: 'context',
          content: line.slice(1),
          oldLineNo: oldLine++,
          newLineNo: newLine++,
        })
      }
    }

    const additions = hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'add').length, 0)
    const deletions = hunks.reduce((sum, h) => sum + h.lines.filter(l => l.type === 'remove').length, 0)

    files.push({
      file: newFile,
      oldFile: oldFile !== newFile ? oldFile : undefined,
      status,
      hunks,
      additions,
      deletions,
    })
  }

  return files
}

/**
 * 格式化 diff 为可读文本（带颜色标记）
 */
export function formatDiff(diffs: FileDiff[]): string {
  const lines: string[] = []

  for (const diff of diffs) {
    lines.push(`\n📄 ${diff.file} (${diff.status}) [+${diff.additions} -${diff.deletions}]`)

    for (const hunk of diff.hunks) {
      lines.push(`  @@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@`)
      for (const line of hunk.lines) {
        const prefix = line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '
        lines.push(`  ${prefix}${line.content}`)
      }
    }
  }

  return lines.join('\n')
}

// ── Git Tool ──

export const GitTool: ToolDefinition = {
  name: 'Git',
  description: `Execute git operations: status, diff, log, blame, show. Use for version control tasks. Does NOT support destructive operations (push --force, reset --hard).`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['status', 'diff', 'log', 'blame', 'show', 'branch', 'stash-list'],
        description: 'Git operation to perform',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional arguments',
      },
    },
    required: ['operation'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    const op = input.operation as string
    const args = (input.args as string[]) || []

    // Safety: block destructive operations
    const allArgs = [op, ...args].join(' ')
    if (/push\s+--force|reset\s+--hard|clean\s+-f|checkout\s+--\s*\./i.test(allArgs)) {
      return { content: 'Destructive git operation blocked for safety.', isError: true }
    }

    const gitArgs: string[] = []

    switch (op) {
      case 'status':
        gitArgs.push('status', '--short', ...args)
        break
      case 'diff':
        gitArgs.push('diff', ...args)
        break
      case 'log':
        gitArgs.push('log', '--oneline', '-20', ...args)
        break
      case 'blame':
        gitArgs.push('blame', ...args)
        break
      case 'show':
        gitArgs.push('show', '--stat', ...args)
        break
      case 'branch':
        gitArgs.push('branch', '-vv', ...args)
        break
      case 'stash-list':
        gitArgs.push('stash', 'list', ...args)
        break
      default:
        return { content: `Unknown git operation: ${op}`, isError: true }
    }

    const result = runGit(gitArgs, ctx.cwd)

    if (!result.success && result.stderr) {
      // Not a git repo is common, not an error per se
      if (result.stderr.includes('not a git repository')) {
        return { content: 'Not a git repository. Initialize with `git init`.', isError: true }
      }
      return { content: `git ${op} failed: ${result.stderr}`, isError: true }
    }

    let content = result.stdout || '(no output)'

    // For diff, add structured summary
    if (op === 'diff' && result.stdout) {
      const diffs = parseDiff(result.stdout)
      const totalAdd = diffs.reduce((s, d) => s + d.additions, 0)
      const totalDel = diffs.reduce((s, d) => s + d.deletions, 0)
      content = `${diffs.length} file(s) changed, +${totalAdd} -${totalDel}\n\n${result.stdout}`
    }

    return {
      content,
      meta: op === 'diff' ? { files: parseDiff(result.stdout).length } : undefined,
    }
  },
}

/**
 * 获取当前 git 状态摘要（用于系统提示词注入）
 */
export function getGitContext(cwd: string): string | null {
  const branch = runGit(['branch', '--show-current'], cwd)
  if (!branch.success) return null

  const status = runGit(['status', '--short'], cwd)
  const lines = [
    `Git branch: ${branch.stdout}`,
  ]

  if (status.stdout) {
    const changed = status.stdout.split('\n').length
    lines.push(`Changed files: ${changed}`)
  }

  return lines.join('\n')
}
