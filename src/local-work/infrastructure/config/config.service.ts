/**
 * 配置管理服务 - 支持多环境、热重载、验证
 */

import { z } from 'zod'
import { EventEmitter } from 'events'
import { watch } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readFileSync, existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 配置模式定义
export const ConfigSchema = z.object({
  // 应用配置
  app: z.object({
    name: z.string().default('local-work-engine'),
    version: z.string().default('1.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableDebug: z.boolean().default(false)
  }),

  // 服务器配置
  server: z.object({
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(['*'])
    }),
    rateLimit: z.object({
      enabled: z.boolean().default(true),
      windowMs: z.number().default(15 * 60 * 1000), // 15分钟
      max: z.number().default(100) // 每个IP限制
    })
  }),

  // 数据库配置
  database: z.object({
    url: z.string().url(),
    pool: z.object({
      min: z.number().default(2),
      max: z.number().default(10)
    }),
    migrations: z.object({
      autoRun: z.boolean().default(true),
      tableName: z.string().default('migrations')
    })
  }),

  // 任务引擎配置
  taskEngine: z.object({
    maxConcurrentTasks: z.number().min(1).default(10),
    defaultTimeout: z.number().default(5 * 60 * 1000), // 5分钟
    retryDelay: z.number().default(1000),
    enableMetrics: z.boolean().default(true),
    enableTracing: z.boolean().default(true)
  }),

  // 代理配置
  proxy: z.object({
    baseUrl: z.string().url().default('http://localhost:8082'),
    apiKey: z.string().default('placeholder'),
    timeout: z.number().default(2000),
    pool: z.object({
      min: z.number().default(1),
      max: z.number().default(5),
      idleTimeout: z.number().default(30000)
    }),
    circuitBreaker: z.object({
      enabled: z.boolean().default(true),
      failureThreshold: z.number().default(5),
      resetTimeout: z.number().default(60000)
    })
  }),

  // 监控配置
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metrics: z.object({
      enabled: z.boolean().default(true),
      port: z.number().default(9090),
      path: z.string().default('/metrics')
    }),
    tracing: z.object({
      enabled: z.boolean().default(false),
      serviceName: z.string().default('local-work-engine'),
      exporter: z.enum(['console', 'jaeger', 'otlp']).default('console')
    }),
    logging: z.object({
      format: z.enum(['json', 'pretty']).default('json'),
      output: z.enum(['console', 'file', 'both']).default('console'),
      filePath: z.string().default('./logs/app.log')
    })
  }),

  // 安全配置
  security: z.object({
    encryption: z.object({
      algorithm: z.string().default('aes-256-gcm'),
      key: z.string().min(32).optional()
    }),
    jwt: z.object({
      secret: z.string().min(32).optional(),
      expiresIn: z.string().default('7d')
    }),
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      requestsPerMinute: z.number().default(60)
    })
  }),

  // 缓存配置
  cache: z.object({
    enabled: z.boolean().default(true),
    type: z.enum(['memory', 'redis']).default('memory'),
    redis: z.object({
      url: z.string().url().optional(),
      host: z.string().default('localhost'),
      port: z.number().default(6379),
      password: z.string().optional()
    }),
    ttl: z.number().default(300) // 5分钟
  }),

  // 外部服务
  externalServices: z.object({
    github: z.object({
      apiUrl: z.string().url().default('https://api.github.com'),
      token: z.string().optional()
    }),
    openai: z.object({
      apiUrl: z.string().url().default('https://api.openai.com/v1'),
      apiKey: z.string().optional()
    }),
    deepseek: z.object({
      apiUrl: z.string().url().default('https://api.deepseek.com'),
      apiKey: z.string().optional()
    })
  }),

  // 功能标志
  featureFlags: z.object({
    enableExperimentalFeatures: z.boolean().default(false),
    enableAITools: z.boolean().default(true),
    enableRealTimeUpdates: z.boolean().default(false),
    enableBatchProcessing: z.boolean().default(true)
  })
})

export type Config = z.infer<typeof ConfigSchema>

// 配置源
export interface ConfigSource {
  load(): Promise<Partial<Config>>
  watch?(callback: (config: Partial<Config>) => void): () => void
}

// 文件配置源
export class FileConfigSource implements ConfigSource {
  constructor(private filePath: string) {}

  async load(): Promise<Partial<Config>> {
    if (!existsSync(this.filePath)) {
      return {}
    }

    const content = readFileSync(this.filePath, 'utf-8')
    const ext = this.filePath.split('.').pop()?.toLowerCase()

    switch (ext) {
      case 'json':
        return JSON.parse(content)
      case 'yaml':
      case 'yml':
        const yaml = await import('yaml')
        return yaml.parse(content)
      case 'js':
      case 'ts':
        const module = await import(this.filePath)
        return module.default || module
      default:
        throw new Error(`不支持的配置文件格式: ${ext}`)
    }
  }

  watch(callback: (config: Partial<Config>) => void): () => void {
    const watcher = watch(this.filePath, (eventType) => {
      if (eventType === 'change') {
        this.load().then(callback).catch(console.error)
      }
    })

    return () => watcher.close()
  }
}

// 环境变量配置源
export class EnvConfigSource implements ConfigSource {
  private prefix = 'LOCAL_WORK_'

  async load(): Promise<Partial<Config>> {
    const config: Record<string, any> = {}

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(this.prefix)) {
        const configKey = key
          .slice(this.prefix.length)
          .toLowerCase()
          .split('_')
          .map((part, index) =>
            index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)
          )
          .join('')

        this.setNestedValue(config, configKey.split('.'), this.parseValue(value))
      }
    }

    return config
  }

  private parseValue(value: string | undefined): any {
    if (value === undefined) return undefined

    // 尝试解析为JSON
    try {
      return JSON.parse(value)
    } catch {
      // 不是JSON，保持原样
    }

    // 尝试解析为数字
    if (/^\d+$/.test(value)) return parseInt(value, 10)
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value)

    // 布尔值
    if (value.toLowerCase() === 'true') return true
    if (value.toLowerCase() === 'false') return false

    // 字符串
    return value
  }

  private setNestedValue(obj: Record<string, any>, path: string[], value: any): void {
    const lastKey = path.pop()!
    let current = obj

    for (const key of path) {
      if (!current[key]) {
        current[key] = {}
      }
      current = current[key]
    }

    current[lastKey] = value
  }
}

// 配置管理器
export class ConfigManager {
  private config: Config
  private eventEmitter = new EventEmitter()
  private sources: ConfigSource[] = []
  private unwatchCallbacks: Array<() => void> = []

  constructor(defaultConfig?: Partial<Config>) {
    // 加载默认配置
    this.config = this.mergeConfigs(
      ConfigSchema.parse({}),
      defaultConfig || {}
    )
  }

  // 添加配置源
  addSource(source: ConfigSource): void {
    this.sources.push(source)
  }

  // 加载配置
  async load(): Promise<void> {
    let mergedConfig = { ...this.config }

    // 从所有源加载配置
    for (const source of this.sources) {
      try {
        const sourceConfig = await source.load()
        mergedConfig = this.mergeConfigs(mergedConfig, sourceConfig)
      } catch (error) {
        console.error('加载配置源失败:', error)
      }
    }

    // 验证配置
    this.config = ConfigSchema.parse(mergedConfig)

    // 发射配置加载事件
    this.eventEmitter.emit('config:loaded', this.config)
  }

  // 监听配置变化
  watch(): void {
    for (const source of this.sources) {
      if (source.watch) {
        const unwatch = source.watch(async (newConfig) => {
          try {
            const mergedConfig = this.mergeConfigs(this.config, newConfig)
            this.config = ConfigSchema.parse(mergedConfig)
            this.eventEmitter.emit('config:changed', this.config)
          } catch (error) {
            console.error('配置更新失败:', error)
          }
        })
        this.unwatchCallbacks.push(unwatch)
      }
    }
  }

  // 获取配置
  get(): Config {
    return { ...this.config }
  }

  // 获取配置值
  getValue<T>(path: string): T | undefined {
    const keys = path.split('.')
    let value: any = this.config

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return undefined
      }
    }

    return value as T
  }

  // 设置配置值（运行时）
  setValue(path: string, value: any): void {
    const keys = path.split('.')
    const lastKey = keys.pop()!
    let current: any = this.config

    for (const key of keys) {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {}
      }
      current = current[key]
    }

    current[lastKey] = value
    this.eventEmitter.emit('config:updated', { path, value })
  }

  // 订阅配置事件
  on(event: 'config:loaded' | 'config:changed' | 'config:updated',
     handler: (config: Config | { path: string; value: any }) => void): () => void {
    this.eventEmitter.on(event, handler)
    return () => this.eventEmitter.off(event, handler)
  }

  // 合并配置
  private mergeConfigs(base: any, override: any): any {
    const result = { ...base }

    for (const key in override) {
      if (override[key] === null || override[key] === undefined) {
        continue
      }

      if (typeof override[key] === 'object' && !Array.isArray(override[key]) &&
          typeof result[key] === 'object' && !Array.isArray(result[key])) {
        // 递归合并对象
        result[key] = this.mergeConfigs(result[key], override[key])
      } else {
        // 直接覆盖
        result[key] = override[key]
      }
    }

    return result
  }

  // 生成配置文档
  generateDocumentation(): string {
    const config = this.config
    const lines: string[] = []

    lines.push('# 配置文档')
    lines.push('')
    lines.push('## 环境变量')
    lines.push('')
    lines.push('所有配置都可以通过环境变量覆盖，格式为：')
    lines.push('`LOCAL_WORK_<SECTION>_<KEY>=<VALUE>`')
    lines.push('')
    lines.push('例如：')
    lines.push('- `LOCAL_WORK_APP_ENVIRONMENT=production`')
    lines.push('- `LOCAL_WORK_SERVER_PORT=8080`')
    lines.push('- `LOCAL_WORK_DATABASE_URL=postgresql://...`')
    lines.push('')
    lines.push('## 当前配置')
    lines.push('')

    this.generateSectionDocumentation(lines, config, '')

    return lines.join('\n')
  }

  private generateSectionDocumentation(lines: string[], obj: any, prefix: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key
      const envVar = `LOCAL_WORK_${fullPath.toUpperCase().replace(/\./g, '_')}`

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`### ${fullPath}`)
        lines.push('')
        this.generateSectionDocumentation(lines, value, fullPath)
      } else {
        lines.push(`- **${fullPath}**`)
        lines.push(`  - 环境变量: \`${envVar}\``)
        lines.push(`  - 类型: ${typeof value}`)
        lines.push(`  - 默认值: \`${JSON.stringify(value)}\``)
        lines.push('')
      }
    }
  }

  // 清理
  cleanup(): void {
    for (const unwatch of this.unwatchCallbacks) {
      unwatch()
    }
    this.unwatchCallbacks = []
    this.eventEmitter.removeAllListeners()
  }
}

// 全局配置实例
let globalConfigManager: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new ConfigManager()

    // 添加默认配置源
    const configDir = join(process.cwd(), 'config')

    // 1. 环境特定配置文件
    const env = process.env.NODE_ENV || 'development'
    const envConfigFile = join(configDir, `${env}.json`)
    if (existsSync(envConfigFile)) {
      globalConfigManager.addSource(new FileConfigSource(envConfigFile))
    }

    // 2. 默认配置文件
    const defaultConfigFile = join(configDir, 'default.json')
    if (existsSync(defaultConfigFile)) {
      globalConfigManager.addSource(new FileConfigSource(defaultConfigFile))
    }

    // 3. 本地覆盖文件（不提交到版本控制）
    const localConfigFile = join(configDir, 'local.json')
    if (existsSync(localConfigFile)) {
      globalConfigManager.addSource(new FileConfigSource(localConfigFile))
    }

    // 4. 环境变量
    globalConfigManager.addSource(new EnvConfigSource())
  }

  return globalConfigManager
}