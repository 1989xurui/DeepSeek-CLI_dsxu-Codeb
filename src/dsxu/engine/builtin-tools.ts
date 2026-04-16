/**
 * DSxu 鍐呯疆宸ュ叿闆?鈥?Query Engine 鐨?鎵嬭剼"
 *
 * 6 涓牳蹇冨伐鍏凤紝瑕嗙洊 80% 鏃ュ父缂栫爜鎿嶄綔锛? *   Bash  鈥?鎵ц鍛戒护锛堟祴璇曘€乬it銆佹瀯寤虹瓑锛? *   Read  鈥?璇绘枃浠? *   Write 鈥?鍐欐枃浠讹紙鏂板缓/瀹屾暣閲嶅啓锛? *   Edit  鈥?缂栬緫鏂囦欢锛堢簿纭浛鎹級
 *   Grep  鈥?鎼滅储鍐呭锛堝熀浜?ripgrep锛? *   Glob  鈥?鎼滅储鏂囦欢鍚嶏紙glob 妯″紡锛? *
 * 璁捐鍘熷垯锛? * - 杞婚噺鐩存帴锛氱洿鎺ヨ皟 Bun/Node API锛屼笉濂楀３ Claude 鐨勯噸閲忕骇 Tool
 * - 骞跺彂鏍囪锛氳宸ュ叿 concurrencySafe=true锛屽啓宸ュ叿 false
 * - 杈撳嚭鎴柇锛氶槻姝㈣秴闀胯緭鍑烘拺鐖?LLM context
 */

import type { ToolDefinition } from './types'
import { execSync, spawnSync } from 'child_process'
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { resolve, dirname } from 'path'

const MAX_OUTPUT_CHARS = 30_000  // 闃茶緭鍑烘拺鐖嗕笂涓嬫枃

function truncate(s: string, max = MAX_OUTPUT_CHARS): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n\n[...truncated, ${s.length - max} chars omitted]`
}

interface ShellRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

function runCommand(command: string, cwd: string, timeout: number): ShellRunResult {
  const runWithBash = () => spawnSync('bash', ['-c', command], {
    cwd,
    timeout,
    maxBuffer: 1024 * 1024 * 10,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  let result = runWithBash()
  const bashUnavailable = !!result.error && (
    result.error.message.includes('ENOENT') || result.error.message.includes('not found')
  )

  if (bashUnavailable && process.platform === 'win32') {
    result = spawnSync('powershell', ['-NoProfile', '-Command', command], {
      cwd,
      timeout,
      maxBuffer: 1024 * 1024 * 10,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }

  const stdout = (result.stdout || '').trimEnd()
  const stderr = (result.stderr || '').trimEnd()
  const exitCode = result.status ?? -1
  return { stdout, stderr, exitCode }
}

// 鈹€鈹€ Bash 鈹€鈹€

export const BashTool: ToolDefinition = {
  name: 'Bash',
  description: 'Execute a bash command and return its output. Use for running tests, git commands, builds, etc.',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command to execute' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default 120000, max 600000)' },
    },
    required: ['command'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, ctx) => {
    const command = input.command as string
    const timeout = Math.min((input.timeout as number) || 120_000, 600_000)

    // Optional WSL-only mode. Default allows Windows fallback for test/dev compatibility.
    const enforceWslOnly = process.env.DSXU_ENFORCE_WSL === '1'
    if (enforceWslOnly && process.platform === 'win32' && !process.env.WSL_DISTRO_NAME) {
      return {
        content: 'Bash tool is WSL-only. Please run DSXU inside WSL (e.g. wsl -d Ubuntu --cd /mnt/d/DSXU-code).',
        isError: true,
        meta: { exitCode: 127, command },
      }
    }

    try {
      const { stdout, stderr, exitCode } = runCommand(command, ctx.cwd, timeout)

      let output = stdout
      if (stderr) output += (output ? '\n' : '') + stderr
      if (exitCode !== 0) output += `\nExit code ${exitCode}`

      return {
        content: truncate(output || '(no output)'),
        isError: exitCode !== 0,
        meta: { exitCode, command },
      }
    } catch (error: any) {
      return {
        content: `Command failed: ${error.message}`,
        isError: true,
      }
    }
  },
}

// 鈹€鈹€ Read 鈹€鈹€

export const ReadTool: ToolDefinition = {
  name: 'Read',
  description: 'Read a file from the filesystem. Returns content with line numbers.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to read' },
      offset: { type: 'number', description: 'Line number to start reading from (1-based)' },
      limit: { type: 'number', description: 'Number of lines to read' },
    },
    required: ['file_path'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input) => {
    const filePath = resolve(input.file_path as string)

    try {
      if (!existsSync(filePath)) {
        return { content: `File not found: ${filePath}`, isError: true }
      }

      const stat = statSync(filePath)
      if (stat.isDirectory()) {
        return { content: `Path is a directory, not a file: ${filePath}`, isError: true }
      }

      const raw = readFileSync(filePath, 'utf-8')
      const lines = raw.split('\n')
      const offset = Math.max(1, (input.offset as number) || 1)
      const limit = (input.limit as number) || lines.length
      const selected = lines.slice(offset - 1, offset - 1 + limit)

      // cat -n 鏍煎紡锛氳鍙?+ tab + 鍐呭
      const numbered = selected.map((line, i) => `${offset + i}\t${line}`).join('\n')

      return { content: truncate(numbered) }
    } catch (error: any) {
      return { content: `Read error: ${error.message}`, isError: true }
    }
  },
}

// 鈹€鈹€ Write 鈹€鈹€

export const WriteTool: ToolDefinition = {
  name: 'Write',
  description: 'Write content to a file. Creates new file or overwrites existing. Use Edit for modifications.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file to write' },
      content: { type: 'string', description: 'The content to write' },
    },
    required: ['file_path', 'content'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, ctx) => {
    const filePath = resolve(input.file_path as string)
    const content = input.content as string

    try {
      ctx.fileHistory?.trackEdit(filePath)

      // 纭繚鐩綍瀛樺湪
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        const { mkdirSync } = await import('fs')
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(filePath, content, 'utf-8')
      if (ctx.fileHistory && ctx.toolUseId) {
        ctx.fileHistory.makeSnapshot(ctx.toolUseId)
      }
      const lines = content.split('\n').length
      return { content: `Successfully wrote ${lines} lines to ${filePath}` }
    } catch (error: any) {
      return { content: `Write error: ${error.message}`, isError: true }
    }
  },
}

// 鈹€鈹€ Edit 鈹€鈹€

export const EditTool: ToolDefinition = {
  name: 'Edit',
  description: 'Perform exact string replacement in a file. old_string must be unique in the file.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'Absolute path to the file' },
      old_string: { type: 'string', description: 'The exact text to find and replace' },
      new_string: { type: 'string', description: 'The replacement text' },
      replace_all: { type: 'boolean', description: 'Replace all occurrences (default false)' },
    },
    required: ['file_path', 'old_string', 'new_string'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, ctx) => {
    const filePath = resolve(input.file_path as string)
    const oldStr = input.old_string as string
    const newStr = input.new_string as string
    const replaceAll = input.replace_all as boolean ?? false

    try {
      if (!existsSync(filePath)) {
        return { content: `File not found: ${filePath}`, isError: true }
      }

      ctx.fileHistory?.trackEdit(filePath)
      let content = readFileSync(filePath, 'utf-8')

      if (!content.includes(oldStr)) {
        return {
          content: `old_string not found in ${filePath}. Make sure it matches exactly (including whitespace and indentation).`,
          isError: true,
        }
      }

      // Check uniqueness when replace_all is false.
      if (!replaceAll) {
        const count = content.split(oldStr).length - 1
        if (count > 1) {
          return {
            content: `old_string found ${count} times in ${filePath}. Use replace_all=true or provide more context to make it unique.`,
            isError: true,
          }
        }
      }

      if (replaceAll) {
        content = content.split(oldStr).join(newStr)
      } else {
        content = content.replace(oldStr, newStr)
      }

      writeFileSync(filePath, content, 'utf-8')
      if (ctx.fileHistory && ctx.toolUseId) {
        ctx.fileHistory.makeSnapshot(ctx.toolUseId)
      }

      const oldLines = oldStr.split('\n').length
      const newLines = newStr.split('\n').length
      return {
        content: `Successfully edited ${filePath}: replaced ${oldLines} lines with ${newLines} lines${replaceAll ? ' (all occurrences)' : ''}`,
      }
    } catch (error: any) {
      return { content: `Edit error: ${error.message}`, isError: true }
    }
  },
}

// 鈹€鈹€ Grep 鈹€鈹€

export const GrepTool: ToolDefinition = {
  name: 'Grep',
  description: 'Search file contents using regex patterns (powered by ripgrep). Returns matching lines or file paths.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Regex pattern to search for' },
      path: { type: 'string', description: 'File or directory to search (defaults to cwd)' },
      glob: { type: 'string', description: 'Glob pattern to filter files (e.g., "*.ts")' },
      output_mode: {
        type: 'string',
        enum: ['content', 'files_with_matches', 'count'],
        description: 'Output mode (default: files_with_matches)',
      },
      context: { type: 'number', description: 'Lines of context around matches' },
    },
    required: ['pattern'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    const pattern = input.pattern as string
    const searchPath = resolve(ctx.cwd, (input.path as string) || '.')
    const outputMode = (input.output_mode as string) || 'files_with_matches'
    const contextLines = input.context as number

    try {
      const args = ['--no-heading', '--color=never']

      if (outputMode === 'files_with_matches') args.push('-l')
      else if (outputMode === 'count') args.push('-c')
      else args.push('-n')

      if (contextLines) args.push(`-C${contextLines}`)
      if (input.glob) args.push(`--glob=${input.glob}`)

      // First choice: native rg invocation.
      const native = spawnSync('rg', [...args, pattern, searchPath], {
        cwd: ctx.cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024 * 5,
        encoding: 'utf-8',
      })
      const nativeOutput = (native.stdout || '').trimEnd()
      if (native.status === 0 && nativeOutput) return { content: truncate(nativeOutput) }
      if (native.status === 1) return { content: 'No matches found.' }

      // Fallback: run rg through bash shell.
      const escapedPattern = pattern.replace(/'/g, "'\\''")
      const escapedPath = searchPath.replace(/\\/g, '/')
      const shellArgs = args.map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ')
      const cmd = `rg ${shellArgs} '${escapedPattern}' '${escapedPath}'`

      const shellResult = spawnSync('bash', ['-c', cmd], {
        cwd: ctx.cwd,
        timeout: 30_000,
        maxBuffer: 1024 * 1024 * 5,
        encoding: 'utf-8',
      })

      const output = (shellResult.stdout || '').trimEnd()
      if (!output) return { content: 'No matches found.' }
      return { content: truncate(output) }
    } catch (error: any) {
      if (error.status === 1) return { content: 'No matches found.' }

      // Final fallback: grep via bash.
      try {
        const escapedPath2 = searchPath.replace(/\\/g, '/')
        const result2 = spawnSync('bash', ['-c', `grep -rn '${pattern}' '${escapedPath2}'`], {
          cwd: ctx.cwd,
          timeout: 30_000,
          encoding: 'utf-8',
        })
        const out2 = (result2.stdout || '').trimEnd()
        return { content: truncate(out2 || 'No matches found.') }
      } catch {
        return { content: 'No matches found.' }
      }
    }
  },
}
// 鈹€鈹€ Glob 鈹€鈹€

export const GlobTool: ToolDefinition = {
  name: 'Glob',
  description: 'Find files matching a glob pattern. Returns file paths sorted by modification time.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.test.ts")' },
      path: { type: 'string', description: 'Directory to search in (defaults to cwd)' },
    },
    required: ['pattern'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    const pattern = input.pattern as string
    const searchPath = resolve(ctx.cwd, (input.path as string) || '.')

    try {
      // 浣跨敤 Bun 鐨?glob 鎴栭檷绾?find
      const { Glob } = await import('bun')
      const glob = new Glob(pattern)
      const files: string[] = []

      for await (const file of glob.scan({ cwd: searchPath, absolute: false })) {
        files.push(file)
        if (files.length >= 200) break  // hard limit
      }

      if (files.length === 0) return { content: 'No files found.' }

      return {
        content: `Found ${files.length} file(s):\n${files.join('\n')}`,
        meta: { count: files.length },
      }
    } catch (error: any) {
      return { content: `Glob error: ${error.message}`, isError: true }
    }
  },
}

// 鈹€鈹€ 娉ㄥ唽鎵€鏈夋牳蹇冨伐鍏?鈹€鈹€

/** 鑾峰彇鍏ㄩ儴 6 涓牳蹇冨伐鍏?*/
export function getCoreTools(): ToolDefinition[] {
  return [BashTool, ReadTool, WriteTool, EditTool, GrepTool, GlobTool]
}

/** 鍙幏鍙栧彧璇诲伐鍏凤紙鐢ㄤ簬鍙楅檺妯″紡锛?*/
export function getReadOnlyTools(): ToolDefinition[] {
  return [ReadTool, GrepTool, GlobTool]
}

