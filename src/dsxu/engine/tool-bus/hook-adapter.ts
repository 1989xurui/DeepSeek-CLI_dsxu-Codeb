/**
 * V14 FROZEN: tool-bus experiment file retained only because Windows ACL
 * blocked physical removal after copying to _deleted_files.
 *
 * Hook系统适配器 - 将现有Hook系统适配到Tool Bus
 */

import type {
  ToolBus,
  ToolBusContext,
  Middleware,
  HookEventMapping,
  ToolBusPlugin,
} from './types'
import { createMiddleware } from './middleware'

// 导入现有的Hook类型（简化版本）
interface HookInput {
  hook_event_name: string
  [key: string]: any
}

interface HookCallback {
  (input: HookInput): Promise<any> | any
}

interface HookConfig {
  enabled?: boolean
  timeoutMs?: number
  [key: string]: any
}

/**
 * Hook适配器配置
 */
export interface HookAdapterConfig {
  /** 是否启用调试日志 */
  debug?: boolean
  /** 默认超时时间（毫秒） */
  defaultTimeoutMs?: number
  /** 是否启用信任检查 */
  enableTrustCheck?: boolean
  /** 是否保持向后兼容 */
  maintainBackwardCompatibility?: boolean
  /** Hook事件到Tool Bus事件的映射 */
  eventMappings?: HookEventMapping[]
}

/**
 * Hook适配器 - 将现有Hook系统桥接到Tool Bus
 */
export class HookAdapter {
  private toolBus: ToolBus
  private config: Required<HookAdapterConfig>
  private registeredHooks: Map<string, HookCallback[]> = new Map()
  private hookConfigs: Map<string, HookConfig> = new Map()
  private eventMappings: Map<string, HookEventMapping> = new Map()

  constructor(toolBus: ToolBus, config?: HookAdapterConfig) {
    this.toolBus = toolBus
    this.config = {
      debug: config?.debug ?? false,
      defaultTimeoutMs: config?.defaultTimeoutMs ?? 30000,
      enableTrustCheck: config?.enableTrustCheck ?? true,
      maintainBackwardCompatibility: config?.maintainBackwardCompatibility ?? true,
      eventMappings: config?.eventMappings ?? this.getDefaultEventMappings(),
    }

    // 初始化事件映射
    this.initializeEventMappings()

    // 注册Hook适配器中间件
    this.registerAdapterMiddleware()

    if (this.config.debug) {
      console.log('[HookAdapter] Initialized with config:', this.config)
    }
  }

  /**
   * 获取默认的事件映射
   */
  private getDefaultEventMappings(): HookEventMapping[] {
    return [
      // 工具相关事件
      { hookEvent: 'PreToolUse', toolBusEvent: 'tool:pre-use' },
      { hookEvent: 'PostToolUse', toolBusEvent: 'tool:post-use' },
      { hookEvent: 'PostToolUseFailure', toolBusEvent: 'tool:post-use-failure' },
      
      // 会话相关事件
      { hookEvent: 'SessionStart', toolBusEvent: 'session:start' },
      { hookEvent: 'SessionEnd', toolBusEvent: 'session:end' },
      
      // 用户交互事件
      { hookEvent: 'UserPromptSubmit', toolBusEvent: 'user:prompt-submit' },
      { hookEvent: 'Notification', toolBusEvent: 'notification' },
      
      // 子智能体事件
      { hookEvent: 'SubagentStart', toolBusEvent: 'subagent:start' },
      { hookEvent: 'SubagentStop', toolBusEvent: 'subagent:stop' },
      
      // 权限事件
      { hookEvent: 'PermissionRequest', toolBusEvent: 'permission:request' },
      { hookEvent: 'PermissionDenied', toolBusEvent: 'permission:denied' },
      
      // 配置事件
      { hookEvent: 'ConfigChange', toolBusEvent: 'config:change' },
      { hookEvent: 'InstructionsLoaded', toolBusEvent: 'instructions:loaded' },
      
      // 文件系统事件
      { hookEvent: 'CwdChanged', toolBusEvent: 'fs:cwd-changed' },
      { hookEvent: 'FileChanged', toolBusEvent: 'fs:file-changed' },
      
      // 工作树事件
      { hookEvent: 'WorktreeCreate', toolBusEvent: 'worktree:create' },
      { hookEvent: 'WorktreeRemove', toolBusEvent: 'worktree:remove' },
      
      // 任务事件
      { hookEvent: 'TaskCreated', toolBusEvent: 'task:created' },
      { hookEvent: 'TaskCompleted', toolBusEvent: 'task:completed' },
      
      // 其他事件
      { hookEvent: 'Stop', toolBusEvent: 'system:stop' },
      { hookEvent: 'StopFailure', toolBusEvent: 'system:stop-failure' },
      { hookEvent: 'PreCompact', toolBusEvent: 'system:pre-compact' },
      { hookEvent: 'PostCompact', toolBusEvent: 'system:post-compact' },
      { hookEvent: 'Setup', toolBusEvent: 'system:setup' },
      { hookEvent: 'TeammateIdle', toolBusEvent: 'system:teammate-idle' },
      { hookEvent: 'Elicitation', toolBusEvent: 'system:elicitation' },
      { hookEvent: 'ElicitationResult', toolBusEvent: 'system:elicitation-result' },
    ]
  }

  /**
   * 初始化事件映射
   */
  private initializeEventMappings(): void {
    for (const mapping of this.config.eventMappings) {
      this.eventMappings.set(mapping.hookEvent, mapping)
    }
  }

  /**
   * 注册适配器中间件
   */
  private registerAdapterMiddleware(): void {
    // 注册信任检查中间件
    if (this.config.enableTrustCheck) {
      const trustMiddleware = createMiddleware(
        'hook-trust-check',
        async (context, next) => {
          // 这里应该实现实际的信任检查逻辑
          // 目前是模拟实现
          const requiresTrust = this.requiresTrustCheck(context.event)
          
          if (requiresTrust && !this.hasWorkspaceTrust()) {
            throw new Error(`Workspace trust required for event: ${context.event}`)
          }
          
          await next()
        },
        {
          priority: 1000,
          description: 'Checks workspace trust before executing hooks',
        }
      )
      
      this.toolBus.use(trustMiddleware)
    }

    // 注册Hook执行中间件
    const hookExecutionMiddleware = createMiddleware(
      'hook-execution',
      async (context, next) => {
        // 查找对应的Hook事件
        const hookEvent = this.getHookEventForToolBusEvent(context.event)

        if (!hookEvent) {
          // 不是Hook事件，继续执行
          await next()
          return
        }

        try {
          // 执行Hook回调
          await this.executeHooks(hookEvent, context)

          // 继续执行其他中间件
          await next()
        } catch (error: any) {
          // Hook执行错误，记录日志但不抛出
          // 让外层的metrics-error中间件处理错误
          console.error(`[HookAdapter:Middleware] Hook execution error for ${hookEvent}:`, error.message)
          // 重新抛出错误，让metrics-error中间件处理
          throw error
        }
      },
      {
        priority: 500,
        description: 'Executes registered hooks for Tool Bus events',
        match: '*', // 匹配所有事件
      }
    )
    
    this.toolBus.use(hookExecutionMiddleware)
  }

  /**
   * 注册Hook回调
   */
  registerHook(hookEvent: string, callback: HookCallback, config?: HookConfig): string {
    const hookId = `hook-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    // 获取或创建Hook配置
    const hookConfig: HookConfig = {
      enabled: true,
      timeoutMs: this.config.defaultTimeoutMs,
      ...config,
    }
    
    // 存储Hook回调
    const hooks = this.registeredHooks.get(hookEvent) || []
    hooks.push(callback)
    this.registeredHooks.set(hookEvent, hooks)
    
    // 存储Hook配置
    this.hookConfigs.set(hookId, hookConfig)
    
    if (this.config.debug) {
      console.log(`[HookAdapter] Registered hook: ${hookId} for event: ${hookEvent}`)
    }
    
    return hookId
  }

  /**
   * 移除Hook回调
   */
  unregisterHook(hookEvent: string, hookId: string): boolean {
    // 这里简化实现，实际应该根据hookId移除特定的回调
    const hooks = this.registeredHooks.get(hookEvent)
    if (!hooks) return false
    
    // 移除配置
    const configRemoved = this.hookConfigs.delete(hookId)
    
    if (this.config.debug) {
      console.log(`[HookAdapter] Unregistered hook: ${hookId} from event: ${hookEvent}`)
    }
    
    return configRemoved
  }

  /**
   * 执行Hook回调
   */
  private async executeHooks(hookEvent: string, context: ToolBusContext): Promise<void> {
    const hooks = this.registeredHooks.get(hookEvent)
    if (!hooks || hooks.length === 0) {
      return
    }
    
    // 转换上下文为Hook输入
    const hookInput = this.convertContextToHookInput(context, hookEvent)
    
    // 执行所有Hook回调
    for (const callback of hooks) {
      try {
        await this.executeHookWithTimeout(callback, hookInput, hookEvent)
      } catch (error: any) {
        console.error(`[HookAdapter] Hook execution error for ${hookEvent}:`, error)
        // 继续执行其他Hook回调
      }
    }
  }

  /**
   * 带超时的Hook执行
   */
  private async executeHookWithTimeout(
    callback: HookCallback,
    hookInput: HookInput,
    hookEvent: string
  ): Promise<any> {
    const hookConfig = this.getHookConfigForEvent(hookEvent)
    const timeoutMs = hookConfig?.timeoutMs || this.config.defaultTimeoutMs
    
    if (timeoutMs <= 0) {
      return await callback(hookInput)
    }
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Hook execution timeout (${timeoutMs}ms) for event: ${hookEvent}`))
      }, timeoutMs)
    })
    
    const executionPromise = callback(hookInput)
    
    return await Promise.race([executionPromise, timeoutPromise])
  }

  /**
   * 转换Tool Bus上下文为Hook输入
   */
  private convertContextToHookInput(context: ToolBusContext, hookEvent: string): HookInput {
    const mapping = this.eventMappings.get(hookEvent)
    
    // 基本Hook输入
    const hookInput: HookInput = {
      hook_event_name: hookEvent,
      timestamp: context.metadata.timestamp,
      session_id: context.metadata.sessionId,
      cwd: context.metadata.cwd,
      ...context.data,
    }
    
    // 应用数据转换（如果有）
    if (mapping?.transformData) {
      return mapping.transformData(hookInput)
    }
    
    return hookInput
  }

  /**
   * 获取Tool Bus事件对应的Hook事件
   */
  private getHookEventForToolBusEvent(toolBusEvent: string): string | null {
    for (const [hookEvent, mapping] of this.eventMappings.entries()) {
      if (mapping.toolBusEvent === toolBusEvent) {
        return hookEvent
      }
    }
    
    // 检查是否直接匹配（保持向后兼容）
    if (this.registeredHooks.has(toolBusEvent)) {
      return toolBusEvent
    }
    
    return null
  }

  /**
   * 获取Hook事件的配置
   */
  private getHookConfigForEvent(hookEvent: string): HookConfig | undefined {
    // 这里简化实现，实际应该根据具体Hook返回配置
    // 目前返回第一个找到的配置
    for (const config of this.hookConfigs.values()) {
      return config
    }
    
    return undefined
  }

  /**
   * 检查事件是否需要信任检查
   */
  private requiresTrustCheck(event: string): boolean {
    // 需要信任检查的事件列表
    const trustedEvents = [
      'PreToolUse',
      'PostToolUse',
      'SessionStart',
      'UserPromptSubmit',
      'FileChanged',
    ]
    
    return trustedEvents.includes(event)
  }

  /**
   * 检查是否有工作区信任
   */
  private hasWorkspaceTrust(): boolean {
    // 这里应该实现实际的信任检查逻辑
    // 目前返回true以保持兼容性
    return true
  }

  /**
   * 触发Hook事件（向后兼容）
   */
  async triggerHook(hookEvent: string, data: any, metadata?: Partial<ToolBusContext['metadata']>): Promise<any> {
    if (this.config.debug) {
      console.log(`[HookAdapter] Triggering hook: ${hookEvent}`, data)
    }

    // 获取对应的Tool Bus事件
    const mapping = this.eventMappings.get(hookEvent)
    const toolBusEvent = mapping?.toolBusEvent || hookEvent

    // 检查事件是否已迁移到Tool Bus（有匹配的中间件）
    const hasToolBusMiddlewares = this.toolBus.hasMiddlewaresFor(toolBusEvent)

    if (hasToolBusMiddlewares) {
      // 事件已迁移到Tool Bus：只走Tool Bus执行路径，禁止触发旧emit
      if (this.config.debug) {
        console.log(`[HookAdapter] Event ${hookEvent} migrated to Tool Bus, using toolBus.execute only`)
      }
      // 只走Tool Bus执行，直接返回
      return await this.toolBus.emit(toolBusEvent, data, metadata)
    } else {
      // 事件未迁移：走旧兼容逻辑
      if (this.config.debug) {
        console.warn(`[HookAdapter] Event ${hookEvent} not migrated to Tool Bus, using legacy compatibility path`)
      }

      // 触发Tool Bus事件（可能没有中间件处理）
      const result = await this.toolBus.emit(toolBusEvent, data, metadata)

      // 保持向后兼容：直接执行注册的Hook回调
      if (this.config.maintainBackwardCompatibility) {
        const hooks = this.registeredHooks.get(hookEvent)
        if (hooks && hooks.length > 0) {
          const hookInput = this.convertContextToHookInput(result.finalContext, hookEvent)

          for (const callback of hooks) {
            try {
              await callback(hookInput)
            } catch (error: any) {
              console.error(`[HookAdapter] Legacy hook execution error for ${hookEvent}:`, error)
            }
          }
        }
      }

      return result
    }
  }

  /**
   * 获取所有注册的Hook事件
   */
  getRegisteredHookEvents(): string[] {
    return Array.from(this.registeredHooks.keys())
  }

  /**
   * 获取Hook事件映射
   */
  getEventMappings(): HookEventMapping[] {
    return Array.from(this.eventMappings.values())
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<HookAdapterConfig>): void {
    Object.assign(this.config, config)
    
    // 重新初始化事件映射
    if (config.eventMappings) {
      this.eventMappings.clear()
      this.initializeEventMappings()
    }
    
    if (this.config.debug) {
      console.log('[HookAdapter] Config updated:', config)
    }
  }

  /**
   * 获取适配器状态
   */
  getStatus() {
    return {
      enabled: true,
      registeredHookEvents: this.getRegisteredHookEvents().length,
      eventMappings: this.eventMappings.size,
      config: this.config,
    }
  }
}

/**
 * Hook适配器插件 - 将HookAdapter作为Tool Bus插件
 */
export function createHookAdapterPlugin(config?: HookAdapterConfig): ToolBusPlugin {
  let hookAdapter: HookAdapter | null = null
  
  return {
    name: 'hook-adapter',
    version: '1.0.0',
    
    initialize: async (toolBus: ToolBus) => {
      hookAdapter = new HookAdapter(toolBus, config)
      
      // 注册一些示例Hook（实际使用时应该从配置加载）
      if (config?.debug) {
        hookAdapter.registerHook('PreToolUse', async (input) => {
          console.log('[HookAdapter:Example] PreToolUse hook executed:', input)
          return { continue: true }
        })
        
        hookAdapter.registerHook('SessionStart', async (input) => {
          console.log('[HookAdapter:Example] SessionStart hook executed:', input)
          return { welcomeMessage: 'Session started successfully' }
        })
      }
      
      return hookAdapter
    },
    
    destroy: async () => {
      hookAdapter = null
    },
    
    // 通过中间件暴露Hook适配器功能
    middlewares: [
      createMiddleware(
        'hook-adapter-bridge',
        async (context, next) => {
          // 这里可以添加Hook适配器的特定逻辑
          await next()
        },
        {
          priority: 100,
          description: 'Bridge between Tool Bus and legacy hook system',
        }
      ),
    ],
  }
}

/**
 * 创建Hook适配器实例
 */
export function createHookAdapter(toolBus: ToolBus, config?: HookAdapterConfig): HookAdapter {
  return new HookAdapter(toolBus, config)
}
