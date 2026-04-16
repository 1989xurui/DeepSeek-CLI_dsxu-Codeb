/**
 * #7.12 Output Formatters + #7.13 Input Validators + #7.6 Init Command
 *
 * 输出格式化：
 *   - Markdown → 终端（带颜色）
 *   - JSON 美化
 *   - 表格输出
 *   - Token/cost 格式化
 *
 * 输入验证：
 *   - 文件路径验证
 *   - JSON Schema 验证（轻量）
 *   - 安全输入检查
 *
 * 项目初始化：
 *   - 创建 .dsxu/ 目录
 *   - 生成默认配置
 *   - 创建 CLAUDE.md 模板
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve, isAbsolute, extname } from 'path'

// ── Output Formatters ──

/**
 * 格式化 token 数量
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}

/**
 * 格式化费用
 */
export function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`
  if (usd >= 0.01) return `$${usd.toFixed(3)}`
  return `$${usd.toFixed(4)}`
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min}m${sec}s`
}

/**
 * 格式化文件大小
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)}MB`
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)}KB`
  return `${bytes}B`
}

/**
 * 截断字符串
 */
export function truncate(text: string, maxLen: number, ellipsis: string = '...'): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - ellipsis.length) + ellipsis
}

/**
 * 简单表格格式化
 */
export function formatTable(
  headers: string[],
  rows: string[][],
  separator: string = ' | ',
): string {
  const colWidths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0)
    return Math.max(h.length, maxRow)
  })

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join(separator)
  const divider = colWidths.map(w => '-'.repeat(w)).join(separator)
  const dataLines = rows.map(row =>
    row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(separator),
  )

  return [headerLine, divider, ...dataLines].join('\n')
}

/**
 * 简化 Markdown（去掉 HTML、简化标题）
 */
export function simplifyMarkdown(md: string): string {
  return md
    .replace(/<[^>]+>/g, '')  // Strip HTML
    .replace(/^#{1,6}\s+/gm, (match) => '  '.repeat(match.trim().length - 1))
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Bold → plain
    .replace(/\*([^*]+)\*/g, '$1')  // Italic → plain
    .replace(/```[\s\S]*?```/g, '[code block]')  // Code blocks (before inline code!)
    .replace(/`([^`]+)`/g, '$1')  // Inline code → plain
    .trim()
}

// ── Input Validators ──

/**
 * 验证文件路径安全性
 */
export function validateFilePath(
  filePath: string,
  cwd: string,
): { valid: boolean; error?: string; resolved: string } {
  const resolved = isAbsolute(filePath) ? filePath : resolve(cwd, filePath)

  // Check path traversal
  if (!resolved.startsWith(resolve(cwd))) {
    return { valid: false, error: 'Path is outside working directory', resolved }
  }

  // Check dangerous extensions
  const dangerous = ['.exe', '.bat', '.cmd', '.ps1', '.sh', '.dll', '.so']
  if (dangerous.includes(extname(resolved).toLowerCase())) {
    return { valid: false, error: `Potentially dangerous file type: ${extname(resolved)}`, resolved }
  }

  return { valid: true, resolved }
}

/**
 * 验证 JSON 结构（轻量 schema 检查）
 */
export function validateJSON(
  input: string,
): { valid: boolean; parsed?: any; error?: string } {
  try {
    const parsed = JSON.parse(input)
    return { valid: true, parsed }
  } catch (error: any) {
    return { valid: false, error: error.message }
  }
}

/**
 * 检查输入是否包含潜在注入
 */
export function checkInjection(input: string): { safe: boolean; warnings: string[] } {
  const warnings: string[] = []

  // Shell injection patterns
  if (/[;&|`$]/.test(input) && !input.startsWith('/')) {
    warnings.push('Input contains shell metacharacters')
  }

  // Path traversal
  if (input.includes('..')) {
    warnings.push('Input contains path traversal')
  }

  // Null bytes
  if (input.includes('\0')) {
    warnings.push('Input contains null bytes')
  }

  return { safe: warnings.length === 0, warnings }
}

/**
 * 清理用户输入
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/\0/g, '')  // Remove null bytes
    .replace(/\r\n/g, '\n')  // Normalize line endings
    .trim()
}

// ── #7.6 Init Command ──

export interface InitResult {
  created: string[]
  skipped: string[]
}

/**
 * 初始化 DSxu 项目配置
 */
export function initProject(cwd: string, force: boolean = false): InitResult {
  const created: string[] = []
  const skipped: string[] = []

  // Create .dsxu/ directory
  const dsxuDir = join(cwd, '.dsxu')
  if (!existsSync(dsxuDir)) {
    mkdirSync(dsxuDir, { recursive: true })
    created.push('.dsxu/')
  }

  // Create default config
  const configPath = join(dsxuDir, 'config.json')
  if (!existsSync(configPath) || force) {
    writeFileSync(configPath, JSON.stringify({
      engine: {
        maxTurns: 50,
        parallelTools: true,
      },
      permissions: {
        mode: 'default',
      },
    }, null, 2), 'utf-8')
    created.push('.dsxu/config.json')
  } else {
    skipped.push('.dsxu/config.json (exists)')
  }

  // Create CLAUDE.md template
  const claudeMdPath = join(cwd, 'CLAUDE.md')
  if (!existsSync(claudeMdPath) || force) {
    writeFileSync(claudeMdPath, `# Project Rules

## Code Style
- Use TypeScript strict mode
- Prefer const over let
- Use meaningful variable names

## Testing
- Write tests for all new features
- Use vitest as test framework

## Architecture
- Follow existing patterns in the codebase
- Document architectural decisions

## Don'ts
- Don't commit .env files
- Don't skip tests
`, 'utf-8')
    created.push('CLAUDE.md')
  } else {
    skipped.push('CLAUDE.md (exists)')
  }

  // Create .gitignore entry (if .gitignore exists)
  const gitignorePath = join(cwd, '.gitignore')
  if (existsSync(gitignorePath)) {
    const content = require('fs').readFileSync(gitignorePath, 'utf-8')
    if (!content.includes('.dsxu/')) {
      require('fs').appendFileSync(gitignorePath, '\n# DSxu\n.dsxu/\n', 'utf-8')
      created.push('.gitignore (appended)')
    }
  }

  return { created, skipped }
}

// ── #7.14 Plugin System (lightweight) ──

export interface PluginManifest {
  name: string
  version: string
  description: string
  author?: string
  tools?: string[]  // Tool names this plugin provides
}

export interface PluginRegistration {
  manifest: PluginManifest
  activate: () => Promise<void>
  deactivate: () => Promise<void>
}

export class PluginManager {
  private plugins: Map<string, PluginRegistration> = new Map()

  /**
   * 注册插件
   */
  register(plugin: PluginRegistration): void {
    this.plugins.set(plugin.manifest.name, plugin)
  }

  /**
   * 激活插件
   */
  async activate(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name)
    if (!plugin) return false
    await plugin.activate()
    return true
  }

  /**
   * 停用插件
   */
  async deactivate(name: string): Promise<boolean> {
    const plugin = this.plugins.get(name)
    if (!plugin) return false
    await plugin.deactivate()
    return true
  }

  /**
   * 列出所有插件
   */
  list(): PluginManifest[] {
    return [...this.plugins.values()].map(p => p.manifest)
  }

  /**
   * 获取插件
   */
  get(name: string): PluginRegistration | undefined {
    return this.plugins.get(name)
  }

  get size(): number {
    return this.plugins.size
  }
}
