/**
 * #7.5 Update Checker + #7.7 Doctor Command + #7.8 Auth Management
 *
 * 系统健康检查和环境验证：
 *   - 检查 API key 是否有效
 *   - 检查依赖工具（git, rg, node）
 *   - 检查配置完整性
 *   - 版本管理
 */

import { spawnSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Types ──

export interface HealthCheck {
  name: string
  status: 'pass' | 'fail' | 'warn'
  message: string
  fix?: string
}

export interface DoctorReport {
  checks: HealthCheck[]
  passCount: number
  failCount: number
  warnCount: number
  healthy: boolean
}

// ── Health Checks ──

/**
 * 检查命令是否可用
 */
export function checkCommand(name: string, versionArg: string = '--version'): HealthCheck {
  try {
    const result = spawnSync(name, [versionArg], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (result.status === 0) {
      const version = (result.stdout || '').trim().split('\n')[0].slice(0, 80)
      return { name, status: 'pass', message: version }
    }
    return { name, status: 'fail', message: `Exit code ${result.status}`, fix: `Install ${name}` }
  } catch {
    return { name, status: 'fail', message: 'Not found', fix: `Install ${name}` }
  }
}

/**
 * 检查 API key 是否设置
 */
export function checkApiKey(envVar: string, label: string): HealthCheck {
  const key = process.env[envVar]
  if (!key) {
    return {
      name: label,
      status: 'fail',
      message: `${envVar} not set`,
      fix: `Set ${envVar} environment variable`,
    }
  }
  // Mask key for display
  const masked = key.slice(0, 4) + '...' + key.slice(-4)
  return { name: label, status: 'pass', message: `Configured (${masked})` }
}

/**
 * 检查 URL 是否可达
 */
export async function checkEndpoint(url: string, label: string): Promise<HealthCheck> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    if (response.ok || response.status === 405) {
      return { name: label, status: 'pass', message: `Reachable (${response.status})` }
    }
    return { name: label, status: 'warn', message: `Status ${response.status}` }
  } catch (error: any) {
    return { name: label, status: 'fail', message: error.message, fix: `Check network or URL: ${url}` }
  }
}

/**
 * 检查项目配置
 */
export function checkProjectConfig(cwd: string): HealthCheck {
  const paths = [
    join(cwd, '.dsxu', 'config.json'),
    join(cwd, '.dsxu.json'),
    join(cwd, 'CLAUDE.md'),
    join(cwd, '.claudemd'),
  ]

  const found = paths.filter(p => existsSync(p))
  if (found.length > 0) {
    return {
      name: 'Project config',
      status: 'pass',
      message: `Found: ${found.map(p => p.replace(cwd, '.')).join(', ')}`,
    }
  }
  return {
    name: 'Project config',
    status: 'warn',
    message: 'No project config found',
    fix: 'Create .dsxu/config.json or CLAUDE.md for project-specific settings',
  }
}

/**
 * 检查 Node.js 版本
 */
export function checkNodeVersion(): HealthCheck {
  const version = process.version
  const major = parseInt(version.slice(1))

  if (major >= 18) {
    return { name: 'Node.js', status: 'pass', message: version }
  }
  if (major >= 16) {
    return { name: 'Node.js', status: 'warn', message: `${version} (recommended >= 18)` }
  }
  return {
    name: 'Node.js',
    status: 'fail',
    message: `${version} (required >= 16)`,
    fix: 'Upgrade Node.js to v18+',
  }
}

/**
 * 运行全部健康检查
 */
export async function runDoctor(cwd: string): Promise<DoctorReport> {
  const checks: HealthCheck[] = []

  // System tools
  checks.push(checkNodeVersion())
  checks.push(checkCommand('git'))
  checks.push(checkCommand('rg', '--version'))

  // API keys
  checks.push(checkApiKey('DEEPSEEK_API_KEY', 'DeepSeek API Key'))
  checks.push(checkApiKey('OPENAI_API_KEY', 'OpenAI API Key (optional)'))

  // Project
  checks.push(checkProjectConfig(cwd))

  const passCount = checks.filter(c => c.status === 'pass').length
  const failCount = checks.filter(c => c.status === 'fail').length
  const warnCount = checks.filter(c => c.status === 'warn').length

  return {
    checks,
    passCount,
    failCount,
    warnCount,
    healthy: failCount === 0,
  }
}

/**
 * 格式化 doctor 报告
 */
export function formatDoctorReport(report: DoctorReport): string {
  const lines = ['DSxu Health Check\n']

  for (const check of report.checks) {
    const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌'
    lines.push(`  ${icon} ${check.name}: ${check.message}`)
    if (check.fix) {
      lines.push(`     Fix: ${check.fix}`)
    }
  }

  lines.push('')
  lines.push(`${report.passCount} passed, ${report.warnCount} warnings, ${report.failCount} failed`)
  lines.push(report.healthy ? '✅ System healthy' : '❌ Issues found — fix failures above')

  return lines.join('\n')
}

// ── Version ──

export const VERSION = '0.1.0'

export function getVersionInfo(): string {
  return `DSxu v${VERSION} (Node ${process.version})`
}

// ── Auth ──

export interface AuthConfig {
  deepseekApiKey?: string
  openaiApiKey?: string
}

/**
 * 从环境变量获取认证信息
 */
export function getAuth(): AuthConfig {
  return {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  }
}

/**
 * 验证 API key 格式（基础检查）
 */
export function validateApiKey(key: string, provider: 'deepseek' | 'openai'): boolean {
  if (!key || key.length < 10) return false

  if (provider === 'deepseek') {
    return key.startsWith('sk-') && key.length >= 20
  }
  if (provider === 'openai') {
    return key.startsWith('sk-') && key.length >= 20
  }
  return true
}
