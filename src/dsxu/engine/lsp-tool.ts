/**
 *
 *
 * 两层实现：
 *
 *
 *
 * Strategy: lightweight on-demand diagnostics.
 *   - 不启动常驻 LSP server（太重）
 *   - 用 tsc --noEmit / eslint 单次调用获取诊断（够用）
 *   - 诊断结果注入 query loop 的消息历史
 *   - 后续可升级为真正的 LSP server（DSXU 模式）
 *
 * 与 DSXU 的区别：
 *   - DSXU: 常驻 LSP server + JSON-RPC + 多 server 路由
 *   - DSXU: on-demand tsc/eslint plus result parsing, with no resident process.
 */

import type { ToolDefinition, ToolContext, Message } from './types'
import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { resolve, relative, extname } from 'path'

const MAX_OUTPUT_CHARS = 30_000

function truncate(s: string, max = MAX_OUTPUT_CHARS): string {
  if (s.length <= max) return s
  return s.slice(0, max) + `\n\n[...truncated, ${s.length - max} chars omitted]`
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function runRipgrep(pattern: string, cwd: string, extraArgs: string[] = []): string {
  const direct = spawnSync('rg', ['-n', pattern, cwd, '--type', 'ts', '--type', 'js', ...extraArgs], {
    cwd,
    timeout: 1_500,
    encoding: 'utf-8',
  })
  if (direct.status === 0 || (direct.stdout && direct.stdout.trim())) {
    return String(direct.stdout || '')
  }

  const shell = spawnSync('bash', ['-c', `rg -n '${pattern}' '${cwd.replace(/\\/g, '/')}' --type ts --type js ${extraArgs.join(' ')} 2>/dev/null`], {
    cwd,
    timeout: 1_500,
    encoding: 'utf-8',
  })
  return String(shell.stdout || '')
}

function parseRipgrepMatchLine(
  line: string,
  cwd: string,
): { file: string; line: number; text: string } | null {
  const match = line.match(/^(.+):(\d+):(.*)$/)
  if (!match) return null

  const file = resolve(cwd, match[1])
  const lineNumber = Number.parseInt(match[2], 10)
  if (!Number.isFinite(lineNumber)) return null

  return {
    file,
    line: lineNumber,
    text: match[3] ?? '',
  }
}

// ── LSP Operations ──

type LSPOperation =
  | 'diagnostics'         // 获取文件/项目诊断
  | 'projectDiagnostics'  // 项目级诊断摘要
  | 'goToDefinition'      // 跳转定义
  | 'findReferences'      // 查找引用
  | 'hover'               // 悬浮信息
  | 'documentSymbol'      // 文件符号列表
  | 'workspaceSymbol'     // 项目级符号搜索
  | 'rename'              // 重命名预览

export const LSPTool: ToolDefinition = {
  name: 'LSP',
  description: `Language Server operations: get diagnostics (errors/warnings), go to definition, find references, hover info, and document symbols. Use for understanding code structure and finding compilation errors.`,
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['diagnostics', 'projectDiagnostics', 'goToDefinition', 'findReferences', 'hover', 'documentSymbol', 'workspaceSymbol', 'rename'],
        description: 'The LSP operation to perform',
      },
      file_path: {
        type: 'string',
        description: 'File path (absolute or relative to project root)',
      },
      line: {
        type: 'number',
        description: 'Line number (1-based). Required for goToDefinition, findReferences, hover.',
      },
      character: {
        type: 'number',
        description: 'Character offset (1-based). Required for goToDefinition, findReferences, hover.',
      },
      query: {
        type: 'string',
        description: 'Symbol query used by workspaceSymbol',
      },
      new_name: {
        type: 'string',
        description: 'New name for rename operation',
      },
    },
    required: ['operation'],
  },
  concurrencySafe: true,
  readOnly: true,
  execute: async (input, ctx) => {
    const operation = input.operation as LSPOperation
    const filePathInput = input.file_path as string | undefined
    const filePath = filePathInput ? resolve(ctx.cwd, filePathInput) : ''
    const line = input.line as number | undefined
    const character = input.character as number | undefined
    const query = input.query as string | undefined
    const newName = input.new_name as string | undefined

    if (operation !== 'workspaceSymbol' && operation !== 'projectDiagnostics') {
      if (!filePathInput) {
        return { content: `file_path is required for operation: ${operation}`, isError: true }
      }
      if (!existsSync(filePath)) {
        return { content: `File not found: ${filePath}`, isError: true }
      }
    }

    try {
      switch (operation) {
        case 'diagnostics':
          return getDiagnostics(filePath, ctx.cwd)
        case 'projectDiagnostics': {
          const diagnosticsText = await collectProjectDiagnostics(ctx.cwd)
          return { content: diagnosticsText ?? 'No project diagnostics found' }
        }
        case 'goToDefinition':
          return goToDefinition(filePath, line ?? 1, character ?? 1, ctx.cwd)
        case 'findReferences':
          return findReferences(filePath, line ?? 1, character ?? 1, ctx.cwd)
        case 'hover':
          return getHoverInfo(filePath, line ?? 1, character ?? 1, ctx.cwd)
        case 'documentSymbol':
          return getDocumentSymbols(filePath, ctx.cwd)
        case 'workspaceSymbol':
          return getWorkspaceSymbols(query ?? '', ctx.cwd)
        case 'rename':
          return renameSymbol(filePath, line ?? 1, character ?? 1, newName ?? '', ctx.cwd)
        default:
          return { content: `Unknown operation: ${operation}`, isError: true }
      }
    } catch (error: any) {
      return { content: `LSP error: ${error.message}`, isError: true }
    }
  },
}

// ── Diagnostics（tsc + eslint） ──

export interface Diagnostic {
  file: string
  line: number
  character: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  code?: string
  source: string
}

function getDiagnostics(filePath: string, cwd: string) {
  const ext = extname(filePath).toLowerCase()
  const diagnostics: Diagnostic[] = []

  // TypeScript diagnostics
  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    diagnostics.push(...getTscDiagnostics(filePath, cwd))
  }

  // ESLint diagnostics (if available)
  const eslintDiags = getEslintDiagnostics(filePath, cwd)
  diagnostics.push(...eslintDiags)

  if (diagnostics.length === 0) {
    return { content: `No diagnostics found for ${relative(cwd, filePath)}` }
  }

  // 按严重度排序：error > warning > info > hint
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2, hint: 3 }
  diagnostics.sort((a, b) => (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3))

  // 限制数量
  const limited = diagnostics.slice(0, 30)
  const formatted = limited.map(d => {
    const rel = relative(cwd, d.file)
    const icon = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️' : 'ℹ️'
    return `${icon} ${rel}:${d.line}:${d.character} [${d.source}${d.code ? ':' + d.code : ''}] ${d.message}`
  }).join('\n')

  const errors = diagnostics.filter(d => d.severity === 'error').length
  const warnings = diagnostics.filter(d => d.severity === 'warning').length

  return {
    content: `Diagnostics: ${errors} errors, ${warnings} warnings, ${diagnostics.length} total\n\n${truncate(formatted)}`,
    meta: { errors, warnings, total: diagnostics.length },
  }
}

function getTscDiagnostics(filePath: string, cwd: string): Diagnostic[] {
  try {
    // 先尝试项目级 tsc
    const result = spawnSync('bash', ['-c', `npx tsc --noEmit --pretty false 2>&1 || true`], {
      cwd,
      timeout: 30_000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 5,
    })

    const output = result.stdout || ''
    return parseTscOutput(output, cwd, filePath)
  } catch {
    return []
  }
}

/** 解析 tsc 输出为 Diagnostic[] */
export function parseTscOutput(output: string, cwd: string, filterFile?: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  // tsc 输出格式: src/file.ts(10,5): error TS2304: Cannot find name 'x'.
  const pattern = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/gm

  let match
  while ((match = pattern.exec(output)) !== null) {
    const file = resolve(cwd, match[1])
    if (filterFile && file !== filterFile) continue

    diagnostics.push({
      file,
      line: parseInt(match[2], 10),
      character: parseInt(match[3], 10),
      severity: match[4] as 'error' | 'warning',
      code: match[5],
      message: match[6].trim(),
      source: 'tsc',
    })
  }

  return diagnostics
}

function getEslintDiagnostics(filePath: string, cwd: string): Diagnostic[] {
  try {
    const result = spawnSync('bash', ['-c', `npx eslint "${filePath}" --format json 2>/dev/null || true`], {
      cwd,
      timeout: 15_000,
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024 * 2,
    })

    const output = (result.stdout || '').trim()
    if (!output || !output.startsWith('[')) return []

    const results = JSON.parse(output)
    const diagnostics: Diagnostic[] = []

    for (const fileResult of results) {
      for (const msg of fileResult.messages || []) {
        diagnostics.push({
          file: fileResult.filePath || filePath,
          line: msg.line || 1,
          character: msg.column || 1,
          severity: msg.severity === 2 ? 'error' : 'warning',
          code: msg.ruleId || undefined,
          message: msg.message,
          source: 'eslint',
        })
      }
    }

    return diagnostics
  } catch {
    return []
  }
}

// ── Go To Definition（用 grep/AST 近似） ──

function goToDefinition(filePath: string, line: number, character: number, cwd: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  if (line > lines.length) {
    return { content: `Line ${line} out of range (file has ${lines.length} lines)`, isError: true }
  }

  // 提取光标位置的单词
  const lineText = lines[line - 1] || ''
  const word = extractWordAt(lineText, character - 1)

  if (!word) {
    return { content: `No symbol found at ${relative(cwd, filePath)}:${line}:${character}` }
  }

  // 用 grep 搜索定义模式
  const escaped = escapeRegex(word)
  const defPatterns = [
    `(function|const|let|var|class|interface|type|enum)\\s+${escaped}\\b`,
    `export\\s+(default\\s+)?(function|const|let|var|class|interface|type|enum)\\s+${escaped}\\b`,
    `${escaped}\\s*[:=]\\s*(function|\\()`,  // method/property definition
  ]

  const results: string[] = []
  for (const pattern of defPatterns) {
    const raw = runRipgrep(pattern, cwd)
    if (raw.trim()) {
      const lines = raw.trim().split('\n').slice(0, 20)
      for (const item of lines) {
        const parsed = parseRipgrepMatchLine(item, cwd)
        if (!parsed) continue
        results.push(`${relative(cwd, parsed.file)}:${parsed.line}:${parsed.text}`)
      }
    }
    if (results.length > 0) break  // 找到就停
  }

  if (results.length === 0) {
    return { content: `No definition found for "${word}"` }
  }

  return {
    content: `Definition of "${word}":\n\n${truncate(results.join('\n'))}`,
    meta: { symbol: word, resultCount: results.length },
  }
}

// ── Find References ──

function findReferences(filePath: string, line: number, character: number, cwd: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const lineText = lines[line - 1] || ''
  const word = extractWordAt(lineText, character - 1)

  if (!word) {
    return { content: `No symbol found at ${relative(cwd, filePath)}:${line}:${character}` }
  }

  const pattern = `\\b${escapeRegex(word)}\\b`
  const output = runRipgrep(pattern, cwd).trim()
  if (!output) {
    return { content: `No references found for "${word}"` }
  }

  const uniqueLines = Array.from(new Set(output.split('\n').filter(Boolean))).slice(0, 50)
  const refLines = uniqueLines.length

  return {
    content: `References to "${word}" (${refLines} locations):\n\n${truncate(uniqueLines.join('\n'))}`,
    meta: { symbol: word, resultCount: refLines },
  }
}

// ── Hover Info ──

function getHoverInfo(filePath: string, line: number, character: number, cwd: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const lineText = lines[line - 1] || ''
  const word = extractWordAt(lineText, character - 1)

  if (!word) {
    return { content: `No symbol found at ${relative(cwd, filePath)}:${line}:${character}` }
  }

  // 用 tsc --declaration 提取类型信息（近似 hover）
  // 更轻量的方式：直接搜索类型定义
  const defPatterns = [
    `(interface|type)\\s+${word}`,
    `(class)\\s+${word}`,
    `(function)\\s+${word}`,
  ]

  let typeInfo = ''
  for (const pattern of defPatterns) {
    const result = spawnSync('bash', ['-c', `rg -n -A5 '${pattern}' '${cwd.replace(/\\/g, '/')}' --type ts 2>/dev/null | head -20`], {
      cwd,
      timeout: 10_000,
      encoding: 'utf-8',
    })
    if (result.stdout?.trim()) {
      typeInfo = result.stdout.trim()
      break
    }
  }

  // 补充：当前行上下文
  const contextStart = Math.max(0, line - 3)
  const contextEnd = Math.min(lines.length, line + 2)
  const context = lines.slice(contextStart, contextEnd).map((l, i) => {
    const lineNum = contextStart + i + 1
    const marker = lineNum === line ? '→' : ' '
    return `${marker} ${lineNum}\t${l}`
  }).join('\n')

  let result = `Symbol: **${word}** at ${relative(cwd, filePath)}:${line}:${character}\n\n`
  result += `### Context:\n\`\`\`\n${context}\n\`\`\`\n`

  if (typeInfo) {
    result += `\n### Type Definition:\n\`\`\`\n${typeInfo}\n\`\`\`\n`
  }

  return { content: truncate(result), meta: { symbol: word } }
}

// ── Document Symbols ──

function getDocumentSymbols(filePath: string, cwd: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const symbols: Array<{ name: string; kind: string; line: number }> = []

  // 正则提取常见符号
  const patterns: Array<[RegExp, string]> = [
    [/^\s*export\s+(default\s+)?(class)\s+(\w+)/gm, 'class'],
    [/^\s*export\s+(default\s+)?(interface)\s+(\w+)/gm, 'interface'],
    [/^\s*export\s+(default\s+)?(type)\s+(\w+)/gm, 'type'],
    [/^\s*export\s+(default\s+)?(enum)\s+(\w+)/gm, 'enum'],
    [/^\s*export\s+(default\s+)?(function)\s+(\w+)/gm, 'function'],
    [/^\s*export\s+(default\s+)?(const|let|var)\s+(\w+)/gm, 'variable'],
    [/^\s*(class)\s+(\w+)/gm, 'class'],
    [/^\s*(interface)\s+(\w+)/gm, 'interface'],
    [/^\s*(type)\s+(\w+)\s*=/gm, 'type'],
    [/^\s*(function)\s+(\w+)/gm, 'function'],
  ]

  for (const [regex, kind] of patterns) {
    let match
    regex.lastIndex = 0
    while ((match = regex.exec(content)) !== null) {
      const name = match[match.length - 1]  // 最后一个捕获组是名称
      const line = content.slice(0, match.index).split('\n').length
      // 去重
      if (!symbols.some(s => s.name === name && s.kind === kind)) {
        symbols.push({ name, kind, line })
      }
    }
  }

  symbols.sort((a, b) => a.line - b.line)

  if (symbols.length === 0) {
    return { content: `No symbols found in ${relative(cwd, filePath)}` }
  }

  const formatted = symbols.map(s => {
    const icon = s.kind === 'class' ? '📦' : s.kind === 'function' ? '🔧' :
                 s.kind === 'interface' ? '📋' : s.kind === 'type' ? '📝' :
                 s.kind === 'enum' ? '🔢' : '📌'
    return `  ${icon} ${s.kind} ${s.name} (line ${s.line})`
  }).join('\n')

  return {
    content: `Symbols in ${relative(cwd, filePath)} (${symbols.length}):\n\n${formatted}`,
    meta: { count: symbols.length },
  }
}

function getWorkspaceSymbols(query: string, cwd: string) {
  const q = query.trim()
  if (!q) {
    return { content: 'workspaceSymbol requires non-empty query', isError: true }
  }

  const escaped = escapeRegex(q)
  const patterns = [
    `\\b(class|interface|type|enum|function)\\s+\\w*${escaped}\\w*\\b`,
    `\\b(const|let|var)\\s+\\w*${escaped}\\w*\\b`,
    `\\b\\w*${escaped}\\w*\\b`,
  ]

  let output = ''
  for (const p of patterns) {
    output = runRipgrep(p, cwd).trim()
    if (output) break
  }

  if (!output) {
    return { content: `No workspace symbols found for "${q}"` }
  }

  const lines = Array.from(new Set(output.split('\n').filter(Boolean))).slice(0, 80)
  return {
    content: `Workspace symbols for "${q}" (${lines.length} matches):\n\n${truncate(lines.join('\n'))}`,
    meta: { query: q, resultCount: lines.length },
  }
}

// ── Diagnostics Collector（给 Query Loop 注入） ──

/**
 * 收集项目诊断并格式化为系统消息
 *
 * 在 query loop 中使用：
 *   const diags = await collectProjectDiagnostics(cwd)
 *   if (diags) messages.push({ role: 'system', content: diags })
 */
export async function collectProjectDiagnostics(cwd: string): Promise<string | null> {
  try {
    const result = spawnSync('bash', ['-c', 'npx tsc --noEmit --pretty false 2>&1 | head -50'], {
      cwd,
      timeout: 30_000,
      encoding: 'utf-8',
    })

    const output = (result.stdout || '').trim()
    if (!output) return null

    const diagnostics = parseTscOutput(output, cwd)
    if (diagnostics.length === 0) return null

    const errors = diagnostics.filter(d => d.severity === 'error')
    if (errors.length === 0) return null

    const formatted = errors.slice(0, 10).map(d => {
      const rel = relative(cwd, d.file)
      return `${rel}:${d.line}:${d.character} - ${d.code}: ${d.message}`
    }).join('\n')

    return `<diagnostics>\nTypeScript compilation errors (${errors.length}):\n${formatted}\n</diagnostics>`
  } catch {
    return null
  }
}

// ── Helper ──

function extractWordAt(lineText: string, charIndex: number): string {
  if (charIndex < 0 || charIndex >= lineText.length) return ''

  // 找到包含 charIndex 的单词边界
  let start = charIndex
  let end = charIndex

  while (start > 0 && /\w/.test(lineText[start - 1])) start--
  while (end < lineText.length && /\w/.test(lineText[end])) end++

  return lineText.slice(start, end)
}

// ── Rename Preview ──

function renameSymbol(filePath: string, line: number, character: number, newName: string, cwd: string) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const lineText = lines[line - 1] || ''
  const oldName = extractWordAt(lineText, character - 1)

  if (!oldName) {
    return { content: `No symbol found at ${relative(cwd, filePath)}:${line}:${character}` }
  }

  if (!newName || !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(newName)) {
    return { content: `Invalid new name: "${newName}". Must be a valid identifier.`, isError: true }
  }

  if (oldName === newName) {
    return { content: `New name is the same as old name: "${oldName}"` }
  }

  // 1. 查找所有引用（包括定义）
  const pattern = `\\b${escapeRegex(oldName)}\\b`
  const output = runRipgrep(pattern, cwd).trim()

  if (!output) {
    return { content: `No references found for "${oldName}"` }
  }

  // 2. 解析结果，按文件分组
  const references: Record<string, Array<{line: number, text: string}>> = {}
  const linesOutput = output.split('\n').filter(Boolean)

  for (const lineStr of linesOutput) {
    const parsed = parseRipgrepMatchLine(lineStr, cwd)
    if (!parsed) continue

    if (!references[parsed.file]) {
      references[parsed.file] = []
    }

    references[parsed.file].push({ line: parsed.line, text: parsed.text })
  }

  // 3. 生成预览
  const totalChanges = Object.values(references).reduce((sum, arr) => sum + arr.length, 0)
  let preview = `Rename Preview: "${oldName}" → "${newName}"\n`
  preview += `Total changes: ${totalChanges} in ${Object.keys(references).length} files\n\n`

  // 按文件显示更改
  for (const [file, refs] of Object.entries(references)) {
    const relPath = relative(cwd, file)
    preview += `📄 ${relPath} (${refs.length} changes):\n`

    // 对每个引用，显示上下文和替换效果
    for (const ref of refs.slice(0, 5)) { // 每个文件最多显示5个
      const fileContent = readFileSync(file, 'utf-8')
      const fileLines = fileContent.split('\n')
      const contextStart = Math.max(0, ref.line - 2)
      const contextEnd = Math.min(fileLines.length, ref.line + 1)

      for (let i = contextStart; i < contextEnd; i++) {
        const lineNum = i + 1
        const lineText = fileLines[i]
        const isTargetLine = lineNum === ref.line

        if (isTargetLine) {
          // 显示替换效果
          const replaced = lineText.replace(new RegExp(`\\b${escapeRegex(oldName)}\\b`, 'g'), newName)
          preview += `  ${lineNum} → ${replaced}\n`
        } else {
          preview += `  ${lineNum}   ${lineText}\n`
        }
      }
      preview += '\n'
    }

    if (refs.length > 5) {
      preview += `  ... and ${refs.length - 5} more changes in this file\n\n`
    }
  }

  // 4. 显示影响范围摘要
  preview += `\n### Summary\n`
  preview += `- Old name: "${oldName}"\n`
  preview += `- New name: "${newName}"\n`
  preview += `- Files affected: ${Object.keys(references).length}\n`
  preview += `- Total references to rename: ${totalChanges}\n`
  preview += `\nThis is a preview only. To actually rename, you would need to apply these changes.`

  return {
    content: truncate(preview),
    meta: {
      oldName,
      newName,
      filesAffected: Object.keys(references).length,
      totalChanges,
      references: Object.keys(references).map(f => ({
        file: relative(cwd, f),
        count: references[f].length
      }))
    }
  }
}
