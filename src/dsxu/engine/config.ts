/**
 * #6.16 Config System
 *
 * 分层配置：
 *   1. 内置默认值
 *   2. 全局配置 ~/.dsxu/config.json
 *   3. 项目配置 .dsxu/config.json
 *   4. 环境变量覆盖
 *   5. CLI 参数覆盖（最高优先级）
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  getDeepSeekV4DefaultMaxTokens,
} from '../../utils/model/deepseekV4Control'

// ── Types ──

export interface DSxuConfig {
  // API
  api: {
    /** DeepSeek API Key */
    deepseekApiKey?: string
    /** DeepSeek base URL */
    deepseekBaseUrl: string
    /** OpenAI API Key (fallback) */
    openaiApiKey?: string
    /** Ollama base URL (local fallback) */
    ollamaBaseUrl: string
  }

  // Models
  models: {
    /** 1 档模型 */
    chatModel: string
    /** 2 档模型 */
    reasonerModel: string
    /** 最大输出 tokens */
    maxOutputTokens: number
  }

  // Engine
  engine: {
    /** 最大轮次 */
    maxTurns: number
    /** 最大连续错误 */
    maxConsecutiveErrors: number
    /** 自动 compact 阈值 tokens */
    compactThreshold: number
    /** 并行工具执行 */
    parallelTools: boolean
    /** 工具结果缓存 */
    toolCache: boolean
  }

  // Permissions
  permissions: {
    /** 权限模式 */
    mode: 'default' | 'plan' | 'yolo'
    /** 允许的 bash 命令模式 */
    allowedBashPatterns?: string[]
    /** 禁止的 bash 命令模式 */
    deniedBashPatterns?: string[]
  }

  // Budget
  budget: {
    /** 每次会话预算 USD */
    perSession?: number
    /** 每日预算 USD */
    perDay?: number
    /** 每月预算 USD */
    perMonth?: number
  }

  // Rate limiting
  rateLimit: {
    /** 每分钟最大请求数 */
    maxRequestsPerMinute: number
    /** 每分钟最大 tokens */
    maxTokensPerMinute: number
  }

  // Retry
  retry: {
    /** 最大重试次数 */
    maxRetries: number
    /** 基础延迟 ms */
    baseDelay: number
  }

  // UI
  ui: {
    /** 是否显示 thinking */
    showThinking: boolean
    /** 是否显示工具调用详情 */
    showToolCalls: boolean
    /** 是否启用流式输出 */
    streaming: boolean
  }
}

// ── Defaults ──

export const DEFAULT_CONFIG: DSxuConfig = {
  api: {
    deepseekBaseUrl: 'https://api.deepseek.com',
    ollamaBaseUrl: 'http://localhost:11434',
  },
  models: {
    chatModel: DEEPSEEK_V4_FLASH_MODEL,
    reasonerModel: DEEPSEEK_V4_PRO_MODEL,
    maxOutputTokens: getDeepSeekV4DefaultMaxTokens({
      model: DEEPSEEK_V4_FLASH_MODEL,
      workflowKind: 'feature',
      apiMode: 'thinking',
      reasoningEffort: 'high',
    }),
  },
  engine: {
    maxTurns: 50,
    maxConsecutiveErrors: 10,
    compactThreshold: 100_000,
    parallelTools: true,
    toolCache: true,
  },
  permissions: {
    mode: 'default',
  },
  budget: {},
  rateLimit: {
    maxRequestsPerMinute: 30,
    maxTokensPerMinute: 500_000,
  },
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
  },
  ui: {
    showThinking: true,
    showToolCalls: true,
    streaming: true,
  },
}

// ── Config Loading ──

/**
 * 深度合并配置（后者优先）
 */
export function mergeConfig(base: any, override: any): any {
  if (!override) return base
  if (!base) return override

  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key])
    ) {
      result[key] = mergeConfig(base[key], override[key])
    } else if (override[key] !== undefined) {
      result[key] = override[key]
    }
  }
  return result
}

/**
 * 从文件加载配置
 */
export function loadConfigFile(filePath: string): Partial<DSxuConfig> | null {
  if (!existsSync(filePath)) return null

  try {
    const content = readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

/**
 * 从环境变量加载配置覆盖
 */
export function loadEnvConfig(): Partial<DSxuConfig> {
  const config: any = { api: {}, models: {}, engine: {}, permissions: {}, budget: {} }

  if (process.env.DEEPSEEK_API_KEY) config.api.deepseekApiKey = process.env.DEEPSEEK_API_KEY
  if (process.env.OPENAI_API_KEY) config.api.openaiApiKey = process.env.OPENAI_API_KEY
  if (process.env.DEEPSEEK_BASE_URL) config.api.deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL
  if (process.env.OLLAMA_BASE_URL) config.api.ollamaBaseUrl = process.env.OLLAMA_BASE_URL

  if (process.env.DSXU_MODEL) config.models.chatModel = process.env.DSXU_MODEL
  if (process.env.DSXU_MAX_TURNS) config.engine.maxTurns = parseInt(process.env.DSXU_MAX_TURNS)
  if (process.env.DSXU_PERMISSION_MODE) config.permissions.mode = process.env.DSXU_PERMISSION_MODE

  if (process.env.DSXU_BUDGET_SESSION) config.budget.perSession = parseFloat(process.env.DSXU_BUDGET_SESSION)
  if (process.env.DSXU_BUDGET_DAILY) config.budget.perDay = parseFloat(process.env.DSXU_BUDGET_DAILY)

  return config
}

/**
 * 加载完整配置（分层合并）
 *
 * 优先级：CLI > ENV > project > global > default
 */
export function loadConfig(
  projectDir?: string,
  cliOverrides?: Partial<DSxuConfig>,
): DSxuConfig {
  let config: DSxuConfig = { ...DEFAULT_CONFIG }

  // Layer 1: Global config
  const globalPath = getGlobalConfigPath()
  const globalConfig = loadConfigFile(globalPath)
  if (globalConfig) {
    config = mergeConfig(config, globalConfig)
  }

  // Layer 2: Project config
  if (projectDir) {
    const projectPaths = [
      join(projectDir, '.dsxu', 'config.json'),
      join(projectDir, '.dsxu.json'),
    ]
    for (const p of projectPaths) {
      const projectConfig = loadConfigFile(p)
      if (projectConfig) {
        config = mergeConfig(config, projectConfig)
        break
      }
    }
  }

  // Layer 3: Environment variables
  const envConfig = loadEnvConfig()
  config = mergeConfig(config, envConfig)

  // Layer 4: CLI overrides
  if (cliOverrides) {
    config = mergeConfig(config, cliOverrides)
  }

  return config
}

/**
 * 保存全局配置
 */
export function saveGlobalConfig(config: Partial<DSxuConfig>): void {
  const filePath = getGlobalConfigPath()
  const dir = dirname(filePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8')
}

/**
 * 保存项目配置
 */
export function saveProjectConfig(projectDir: string, config: Partial<DSxuConfig>): void {
  const dir = join(projectDir, '.dsxu')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8')
}

// ── Helpers ──

function getGlobalConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp'
  return join(home, '.dsxu', 'config.json')
}

/**
 * 验证配置有效性
 */
export function validateConfig(config: DSxuConfig): string[] {
  const errors: string[] = []

  if (config.engine.maxTurns < 1) errors.push('engine.maxTurns must be >= 1')
  if (config.engine.maxTurns > 200) errors.push('engine.maxTurns > 200 is not recommended')
  if (config.models.maxOutputTokens < 100) errors.push('models.maxOutputTokens must be >= 100')
  if (config.rateLimit.maxRequestsPerMinute < 1) errors.push('rateLimit.maxRequestsPerMinute must be >= 1')

  if (config.budget.perSession !== undefined && config.budget.perSession <= 0) {
    errors.push('budget.perSession must be > 0')
  }
  if (config.budget.perDay !== undefined && config.budget.perDay <= 0) {
    errors.push('budget.perDay must be > 0')
  }

  return errors
}
