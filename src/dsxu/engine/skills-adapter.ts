/**
 * Skills系统适配器 - 将Skills Command转换为DSxu ToolDefinition
 *
 * 集成Claude Code的Skills系统到DSxu engine，使DSxu能够调用和执行Skills。
 */

import type { Command, ToolUseContext } from '../../types/command'
import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { getBundledSkills } from '../../skills/bundledSkills'
import { SkillsExecutor, createSkillsExecutor, type SkillsExecutorConfig } from './skills-executor'

/**
 * Skills适配器配置
 */
export interface SkillsAdapterConfig {
  /** 是否启用Skills系统 */
  enabled?: boolean
  /** 自动注册Skills */
  autoRegister?: boolean
  /** 排除的Skills名称 */
  excludeSkills?: string[]
  /** Skills执行超时（毫秒） */
  timeout?: number
  /** 是否启用调试日志 */
  debug?: boolean
}

/**
 * Skills执行结果
 */
interface SkillExecutionResult {
  content: string
  isError?: boolean
  meta?: Record<string, any>
}

/**
 * 技能事件类型
 */
export type SkillEventType =
  | 'skill_registered'
  | 'skill_selected'
  | 'skill_executed'
  | 'skill_failed'

/**
 * 技能事件
 */
export interface SkillEvent {
  type: SkillEventType
  skillName: string
  timestamp: number
  data?: Record<string, any>
}

/**
 * 技能事件回调函数
 */
export type SkillEventCallback = (event: SkillEvent) => void

/**
 * Skills系统适配器
 *
 * 将Skills系统的Command转换为DSxu engine的ToolDefinition，
 * 通过适配器模式实现两个系统的无缝集成。
 */
export class SkillsAdapter {
  private skillsLoaded = false
  private config: Required<SkillsAdapterConfig>
  private skillTools: Map<string, ToolDefinition> = new Map()
  private skillsExecutor: SkillsExecutor
  private eventCallbacks: SkillEventCallback[] = []
  private eventHistory: SkillEvent[] = []
  private maxEventHistory = 100

  constructor(config?: SkillsAdapterConfig) {
    this.config = {
      enabled: config?.enabled ?? true,
      autoRegister: config?.autoRegister ?? true,
      excludeSkills: config?.excludeSkills ?? [],
      timeout: config?.timeout ?? 30000, // 30秒超时
      debug: config?.debug ?? false,
    }

    // 初始化Skills执行器
    const executorConfig: SkillsExecutorConfig = {
      mockExecution: false, // 使用真实执行
      mockDelay: 100,
      debug: this.config.debug,
    }
    this.skillsExecutor = createSkillsExecutor(executorConfig)
  }

  /**
   * 将Skills Command转换为DSxu ToolDefinition
   */
  convertSkillToTool(skill: Command): ToolDefinition {
    // 只处理prompt类型的技能
    if (skill.type !== 'prompt') {
      if (this.config.debug) {
        console.warn(`[SkillsAdapter] Unsupported skill type: ${skill.type} for skill ${skill.name}`)
      }
      throw new Error(`Unsupported skill type: ${skill.type}`)
    }

    // 检查是否在排除列表中
    if (this.config.excludeSkills.includes(skill.name)) {
      throw new Error(`Skill ${skill.name} is excluded from registration`)
    }

    const toolName = `skill__${skill.name}`

    if (this.config.debug) {
      console.log(`[SkillsAdapter] Converting skill: ${skill.name} -> ${toolName}`)
    }

    return {
      name: toolName,
      description: `[Skill] ${skill.description}`,
      inputSchema: this.buildInputSchema(skill),
      concurrencySafe: false, // Skills通常需要串行执行
      readOnly: this.isReadOnlySkill(skill),
      isEnabled: skill.isEnabled,
      execute: async (input: Record<string, any>, context: ToolContext): Promise<ToolOutput> => {
        return await this.executeSkill(skill, input, context)
      },
    }
  }

  /**
   * 构建输入Schema
   */
  private buildInputSchema(skill: Command): Record<string, any> {
    // 基础Schema，支持args参数
    const schema = {
      type: 'object',
      properties: {
        args: {
          type: 'string',
          description: skill.argumentHint || 'Arguments for the skill',
        },
      },
      required: ['args'],
    }

    // 如果技能有参数定义，可以在这里扩展
    // 目前Skills系统通过argumentHint提供参数提示，但没有结构化参数定义

    return schema
  }

  /**
   * 执行技能
   */
  private async executeSkill(
    skill: Command,
    input: Record<string, any>,
    context: ToolContext
  ): Promise<ToolOutput> {
    const startTime = Date.now()

    try {
      if (this.config.debug) {
        console.log(`[SkillsAdapter] Executing skill: ${skill.name} with args: ${input.args}`)
      }

      // 触发技能选择事件
      this.emitEvent('skill_selected', skill.name, {
        args: input.args,
        context: {
          cwd: context.cwd,
          sessionId: context.sessionId,
          gear: context.gear,
        },
      })

      // 转换上下文
      const skillContext = this.convertContext(context)

      // 生成提示
      const promptBlocks = await skill.getPromptForCommand(
        input.args || '',
        skillContext
      )

      // 执行技能
      const result = await this.executeSkillWithTimeout(
        skill,
        promptBlocks,
        skillContext
      )

      const duration = Date.now() - startTime

      if (this.config.debug) {
        console.log(`[SkillsAdapter] Skill ${skill.name} executed in ${duration}ms`)
      }

      // 触发技能执行事件
      this.emitEvent('skill_executed', skill.name, {
        durationMs: duration,
        success: !result.isError,
        args: input.args,
        resultLength: result.content?.length || 0,
      })

      return {
        content: result.content,
        isError: result.isError || false,
        meta: {
          skill: skill.name,
          type: 'skill',
          durationMs: duration,
          ...result.meta,
        },
      }
    } catch (error: any) {
      const duration = Date.now() - startTime
      console.error(`[SkillsAdapter] Skill execution error (${skill.name}): ${error.message}`)

      // 触发技能失败事件
      this.emitEvent('skill_failed', skill.name, {
        durationMs: duration,
        error: error.message,
        args: input.args,
        stack: error.stack,
      })

      return {
        content: `Skill execution error (${skill.name}): ${error.message}`,
        isError: true,
        meta: {
          skill: skill.name,
          error: error.message,
          durationMs: duration,
          stack: error.stack,
        },
      }
    }
  }

  /**
   * 带超时的技能执行
   */
  private async executeSkillWithTimeout(
    skill: Command,
    promptBlocks: any[],
    context: ToolUseContext
  ): Promise<SkillExecutionResult> {
    if (this.config.timeout <= 0) {
      return await this.executeSkillPrompt(promptBlocks, context)
    }

    const timeoutPromise = new Promise<SkillExecutionResult>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Skill execution timeout (${this.config.timeout}ms)`))
      }, this.config.timeout)
    })

    const executionPromise = this.executeSkillPrompt(promptBlocks, context)

    return await Promise.race([executionPromise, timeoutPromise])
  }

  /**
   * 转换DSxu上下文为Skills上下文
   */
  private convertContext(context: ToolContext): ToolUseContext {
    // 创建简化的ToolUseContext
    // 注意：这是一个最小实现，实际使用时可能需要更完整的上下文转换
    return {
      options: {
        commands: [], // 需要从Skills系统获取
        debug: this.config.debug,
        mainLoopModel: 'deepseek-chat',
        tools: {}, // 需要从Skills系统获取
        verbose: false,
        thinkingConfig: { enabled: false },
        mcpClients: [],
        mcpResources: {},
        isNonInteractiveSession: false,
        agentDefinitions: { agents: [] },
      },
      abortController: new AbortController(),
      readFileState: {
        get: () => undefined,
        set: () => {},
        clear: () => {},
      },
      getAppState: () => ({
        messages: [],
        cwd: context.cwd,
        sessionId: context.sessionId,
      }),
      setAppState: () => {},
      cwd: context.cwd,
      sessionId: context.sessionId,
      // 添加其他必要的字段
      setToolJSX: undefined,
      addNotification: undefined,
      appendSystemMessage: undefined,
      handleElicitation: undefined,
      setAppStateForTasks: undefined,
    } as ToolUseContext
  }

  /**
   * 执行技能提示
   */
  private async executeSkillPrompt(
    promptBlocks: any[],
    context: ToolUseContext
  ): Promise<SkillExecutionResult> {
    if (this.config.debug) {
      console.log(`[SkillsAdapter] Executing skill prompt with ${promptBlocks.length} blocks`)
    }

    // 从提示块中提取技能名称和参数
    // 注意：这是一个简化实现，实际需要从promptBlocks中解析更多信息
    const skillInfo = this.extractSkillInfoFromPrompt(promptBlocks)

    // 使用Skills执行器执行技能
    const result = await this.skillsExecutor.execute(
      skillInfo.name,
      skillInfo.args,
      context
    )

    return result
  }

  /**
   * 从提示块中提取技能信息
   */
  private extractSkillInfoFromPrompt(promptBlocks: any[]): { name: string; args: string } {
    // 这是一个简化实现，实际需要更复杂的解析逻辑
    // 目前假设第一个文本块包含技能信息

    const textBlocks = promptBlocks.filter(block => block.type === 'text')
    if (textBlocks.length === 0) {
      return { name: 'unknown', args: '' }
    }

    const firstText = textBlocks[0].text

    // 简单解析：查找技能名称和参数
    // 实际实现需要更复杂的解析逻辑
    let skillName = 'unknown'
    let args = ''

    // 尝试从文本中提取技能名称
    const skillMatch = firstText.match(/skill(?:ify)?|commit|review-pr|debug|simplify/i)
    if (skillMatch) {
      skillName = skillMatch[0].toLowerCase()
    }

    // 尝试从文本中提取参数
    const argsMatch = firstText.match(/args?:?\s*["']?([^"'\n]+)["']?/i)
    if (argsMatch) {
      args = argsMatch[1].trim()
    }

    if (this.config.debug) {
      console.log(`[SkillsAdapter] Extracted skill info: name=${skillName}, args=${args}`)
    }

    return { name: skillName, args }
  }

  /**
   * 判断技能是否只读
   */
  private isReadOnlySkill(skill: Command): boolean {
    if (skill.type !== 'prompt') return true

    // 根据allowedTools判断
    const allowedTools = skill.allowedTools || []
    const writeTools = ['Write', 'Edit', 'Bash']

    const hasWriteTool = allowedTools.some(tool =>
      writeTools.some(writeTool => tool.includes(writeTool))
    )

    return !hasWriteTool
  }

  /**
   * 注册所有Skills到ToolRegistry
   */
  registerAllSkills(): ToolDefinition[] {
    if (this.skillsLoaded) {
      if (this.config.debug) {
        console.log('[SkillsAdapter] Skills already loaded, skipping')
      }
      return Array.from(this.skillTools.values())
    }

    if (!this.config.enabled) {
      if (this.config.debug) {
        console.log('[SkillsAdapter] Skills system is disabled')
      }
      return []
    }

    try {
      const skills = getBundledSkills()

      if (this.config.debug) {
        console.log(`[SkillsAdapter] Found ${skills.length} bundled skills`)
      }

      skills
        .filter(skill => {
          // 过滤非prompt类型的技能
          if (skill.type !== 'prompt') {
            if (this.config.debug) {
              console.log(`[SkillsAdapter] Skipping non-prompt skill: ${skill.name} (type: ${skill.type})`)
            }
            return false
          }

          // 过滤排除的技能
          if (this.config.excludeSkills.includes(skill.name)) {
            if (this.config.debug) {
              console.log(`[SkillsAdapter] Skipping excluded skill: ${skill.name}`)
            }
            return false
          }

          // 检查技能是否启用
          if (skill.isEnabled && !skill.isEnabled()) {
            if (this.config.debug) {
              console.log(`[SkillsAdapter] Skipping disabled skill: ${skill.name}`)
            }
            return false
          }

          return true
        })
        .map(skill => {
          try {
            const tool = this.convertSkillToTool(skill)
            this.skillTools.set(tool.name, tool)
            return tool
          } catch (error: any) {
            console.warn(`[SkillsAdapter] Failed to convert skill ${skill.name}: ${error.message}`)
            return null
          }
        })
        .filter((tool): tool is ToolDefinition => tool !== null)

      const dedupedTools = Array.from(this.skillTools.values())

      this.skillsLoaded = true

      // 触发技能注册事件
      dedupedTools.forEach(tool => {
        const skillName = tool.name.replace('skill__', '')
        this.emitEvent('skill_registered', skillName, {
          toolName: tool.name,
          description: tool.description,
          readOnly: tool.readOnly,
        })
      })

      if (this.config.debug) {
        console.log(`[SkillsAdapter] Successfully converted ${dedupedTools.length} skills to tools`)
        console.log(`[SkillsAdapter] Tool names: ${dedupedTools.map(t => t.name).join(', ')}`)
      }

      return dedupedTools
    } catch (error: any) {
      console.error(`[SkillsAdapter] Failed to register skills: ${error.message}`)
      return []
    }
  }

  /**
   * 获取已注册的技能工具
   */
  getSkillTools(): ToolDefinition[] {
    return Array.from(this.skillTools.values())
  }

  /**
   * 获取特定技能工具
   */
  getSkillTool(skillName: string): ToolDefinition | undefined {
    const toolName = `skill__${skillName}`
    return this.skillTools.get(toolName)
  }

  /**
   * 检查技能是否已注册
   */
  hasSkill(skillName: string): boolean {
    const toolName = `skill__${skillName}`
    return this.skillTools.has(toolName)
  }

  /**
   * 获取适配器状态
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      skillsLoaded: this.skillsLoaded,
      skillCount: this.skillTools.size,
      config: this.config,
    }
  }

  /**
   * 触发技能事件
   */
  private emitEvent(type: SkillEventType, skillName: string, data?: Record<string, any>): void {
    const event: SkillEvent = {
      type,
      skillName,
      timestamp: Date.now(),
      data,
    }

    // 添加到历史记录
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxEventHistory)
    }

    // 调用所有回调
    for (const callback of this.eventCallbacks) {
      try {
        callback(event)
      } catch (error) {
        console.error(`[SkillsAdapter] Event callback error: ${error}`)
      }
    }

    if (this.config.debug) {
      console.log(`[SkillsAdapter Event] ${type}: ${skillName}`, data || '')
    }
  }

  /**
   * 注册事件回调
   */
  onEvent(callback: SkillEventCallback): void {
    this.eventCallbacks.push(callback)
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): SkillEvent[] {
    const events = [...this.eventHistory]
    if (limit && limit > 0) {
      return events.slice(-limit)
    }
    return events
  }

  /**
   * 获取技能状态（增强版）
   */
  getStatus() {
    const skillNames = Array.from(this.skillTools.keys()).map(name => name.replace('skill__', ''))

    // 截断显示技能名称列表
    const truncatedNames = skillNames.length > 10
      ? [...skillNames.slice(0, 10), `...and ${skillNames.length - 10} more`]
      : skillNames

    return {
      enabled: this.config.enabled,
      skillsLoaded: this.skillsLoaded,
      skillCount: this.skillTools.size,
      skillNames: truncatedNames,
      recentEvents: this.getEventHistory(5),
      config: this.config,
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SkillsAdapterConfig>): void {
    const oldEnabled = this.config.enabled
    Object.assign(this.config, config)

    if (oldEnabled && !this.config.enabled) {
      // 从启用变为禁用，清空已加载的技能
      this.skillTools.clear()
      this.skillsLoaded = false
    }

    if (this.config.debug) {
      console.log(`[SkillsAdapter] Config updated:`, config)
    }
  }
}

/**
 * 创建默认的Skills适配器
 */
export function createSkillsAdapter(config?: SkillsAdapterConfig): SkillsAdapter {
  return new SkillsAdapter(config)
}
