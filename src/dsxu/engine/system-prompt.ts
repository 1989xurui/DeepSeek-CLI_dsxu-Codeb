/**
 * #6.6 System Prompt Builder
 *
 * 动态构建系统提示词：
 *   1. 基础角色定义
 *   2. 工具说明注入
 *   3. 项目上下文（.claudemd / CLAUDE.md）
 *   4. 用户偏好
 *   5. 当前任务约束
 *
 * 支持缓存友好的分层结构（L1 前缀不变 → 高 cache hit）
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

// ── Types ──

export interface PromptSection {
  id: string
  content: string
  priority: number  // Higher = more important
  cacheable: boolean  // If true, placed in L1 prefix
}

export interface SystemPromptConfig {
  /** 项目根目录 */
  cwd: string
  /** 用户自定义规则 */
  userRules?: string
  /** 当前档位 */
  gear?: 1 | 2 | 3
  /** 可用工具名列表 */
  toolNames?: string[]
  /** 额外上下文（动态变化，不缓存） */
  dynamicContext?: string
  /** CLAUDE.md 路径覆盖 */
  claudeMdPath?: string
}

// ── Core Prompt Sections ──

const BASE_IDENTITY = `You are DSxu, an expert software engineering assistant powered by DeepSeek. You help users with coding tasks by reading, writing, and analyzing code.

Key capabilities:
- Read and understand codebases
- Write, edit, and refactor code
- Run tests and fix bugs
- Search files and grep for patterns
- Execute bash commands
- Analyze architecture and design

You are direct, concise, and accurate. You prefer to show code rather than explain at length. When uncertain, you say so honestly.`

const GEAR_PROMPTS: Record<number, string> = {
  1: `\nMode: Standard. Respond concisely. Self-correct up to 3 times before escalating.`,
  2: `\nMode: Reasoning. Think step-by-step. Analyze the problem deeply before acting.`,
  3: `\nMode: Consensus. Generate multiple approaches and select the best one with justification.`,
}

const TOOL_USAGE_GUIDE = `\nWhen using tools:
- Read files before editing them
- Use Grep to search, not Bash grep
- Run tests after making changes
- Prefer small, targeted edits over full rewrites
- Ask the user when uncertain about requirements`

// ── Builder ──

export class SystemPromptBuilder {
  private sections: PromptSection[] = []

  constructor() {
    // Add base identity (always first, cacheable)
    this.addSection({
      id: 'identity',
      content: BASE_IDENTITY,
      priority: 100,
      cacheable: true,
    })

    this.addSection({
      id: 'tool-guide',
      content: TOOL_USAGE_GUIDE,
      priority: 90,
      cacheable: true,
    })
  }

  /**
   * 添加提示词段落
   */
  addSection(section: PromptSection): this {
    // Replace if same id exists
    const idx = this.sections.findIndex(s => s.id === section.id)
    if (idx >= 0) {
      this.sections[idx] = section
    } else {
      this.sections.push(section)
    }
    return this
  }

  /**
   * 移除段落
   */
  removeSection(id: string): this {
    this.sections = this.sections.filter(s => s.id !== id)
    return this
  }

  /**
   * 从项目配置文件加载规则（CLAUDE.md / .claudemd）
   */
  loadProjectRules(cwd: string, customPath?: string): this {
    const paths = customPath
      ? [customPath]
      : [
          join(cwd, 'CLAUDE.md'),
          join(cwd, '.claudemd'),
          join(cwd, '.claude', 'rules.md'),
        ]

    for (const path of paths) {
      if (existsSync(path)) {
        try {
          const content = readFileSync(path, 'utf-8').trim()
          if (content) {
            this.addSection({
              id: 'project-rules',
              content: `\n## Project Rules\n${content}`,
              priority: 80,
              cacheable: true,
            })
            break
          }
        } catch {
          // Skip unreadable files
        }
      }
    }

    return this
  }

  /**
   * 设置档位
   */
  setGear(gear: 1 | 2 | 3): this {
    this.addSection({
      id: 'gear',
      content: GEAR_PROMPTS[gear] || '',
      priority: 70,
      cacheable: false,  // Gear changes per turn
    })
    return this
  }

  /**
   * 设置工具列表
   */
  setTools(toolNames: string[]): this {
    if (toolNames.length > 0) {
      // 分离普通工具和skill工具
      const regularTools: string[] = []
      const skillTools: string[] = []

      for (const toolName of toolNames) {
        if (toolName.startsWith('skill__')) {
          skillTools.push(toolName.replace('skill__', ''))
        } else {
          regularTools.push(toolName)
        }
      }

      let content = ''

      if (regularTools.length > 0) {
        content += `\nAvailable tools: ${regularTools.join(', ')}`
      }

      if (skillTools.length > 0) {
        content += `\n\nAvailable skills: ${skillTools.join(', ')}`
        content += `\nSkills are specialized capabilities that can be invoked like tools.`
        content += `\nExample: Use "skill__commit" to create git commits, "skill__simplify" to review code.`
      }

      this.addSection({
        id: 'tools',
        content,
        priority: 60,
        cacheable: true,
      })
    }
    return this
  }

  /**
   * 设置用户自定义规则
   */
  setUserRules(rules: string): this {
    if (rules.trim()) {
      this.addSection({
        id: 'user-rules',
        content: `\n## User Preferences\n${rules}`,
        priority: 75,
        cacheable: true,
      })
    }
    return this
  }

  /**
   * 设置动态上下文
   */
  setDynamicContext(context: string): this {
    if (context.trim()) {
      this.addSection({
        id: 'dynamic-context',
        content: `\n## Current Context\n${context}`,
        priority: 50,
        cacheable: false,
      })
    }
    return this
  }

  /**
   * 构建最终系统提示词
   */
  build(): string {
    return this.sections
      .sort((a, b) => b.priority - a.priority)
      .map(s => s.content)
      .join('\n')
  }

  /**
   * 构建分层提示词（分离 cacheable 和 dynamic）
   */
  buildLayered(): { l1Prefix: string; l2Dynamic: string } {
    const sorted = [...this.sections].sort((a, b) => b.priority - a.priority)

    const l1 = sorted.filter(s => s.cacheable).map(s => s.content).join('\n')
    const l2 = sorted.filter(s => !s.cacheable).map(s => s.content).join('\n')

    return { l1Prefix: l1, l2Dynamic: l2 }
  }

  /**
   * 获取所有段落
   */
  getSections(): PromptSection[] {
    return [...this.sections]
  }

  /**
   * 获取段落数
   */
  get sectionCount(): number {
    return this.sections.length
  }
}

/**
 * 快速构建系统提示词
 */
export function buildSystemPrompt(config: SystemPromptConfig): string {
  const builder = new SystemPromptBuilder()
    .loadProjectRules(config.cwd, config.claudeMdPath)

  if (config.gear) builder.setGear(config.gear)
  if (config.toolNames) builder.setTools(config.toolNames)
  if (config.userRules) builder.setUserRules(config.userRules)
  if (config.dynamicContext) builder.setDynamicContext(config.dynamicContext)

  return builder.build()
}
