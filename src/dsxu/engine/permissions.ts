/**
 * #18 Permission System — 工具执行权限控制
 *
 * 学 Claude 的权限分层设计，适配 DSxu 三档变速：
 *
 * 三种权限模式：
 *   1. default  — 危险操作需要确认（Bash 写/删、Write 覆盖等）
 *   2. plan     — 只读模式，只允许 Read/Grep/Glob
 *   3. yolo     — 全部放行（用户明确授权）
 *
 * 工具安全分级：
 *   - safe:    Read, Grep, Glob, WebSearch — 无副作用
 *   - write:   Write, Edit, NotebookEdit — 修改文件
 *   - execute: Bash — 任意命令执行
 *   - network: WebFetch — 外部网络访问
 *
 * 与变速器联动：
 *   - 1档 chat:     完整权限检查
 *   - 2档 reasoner:  完整权限检查（更强能力不等于更多权限）
 *   - 3档 CoT-SC:    完整权限检查
 */

import type { ToolDefinition, ToolContext } from './types'

// ── 权限模式 ──

export type PermissionMode = 'default' | 'plan' | 'yolo'

// ── 工具安全等级 ──

export type ToolSafetyLevel = 'safe' | 'write' | 'execute' | 'network'

// ── 权限决定 ──

export type PermissionDecision = 'allow' | 'deny' | 'ask'

export interface PermissionCheckResult {
  decision: PermissionDecision
  reason: string
  /** 建议的用户提示（当 decision = 'ask' 时） */
  prompt?: string
}

// ── 权限规则 ──

export interface PermissionRule {
  /** 工具名（支持 glob：'Bash'、'*'、'Web*'） */
  toolPattern: string
  /** 行为 */
  behavior: PermissionDecision
  /** 可选：命令/路径匹配（Bash 的 command 参数匹配等） */
  contentPattern?: string
  /** 规则来源 */
  source: 'builtin' | 'user' | 'project' | 'session'
}

// ── 安全分级映射 ──

const TOOL_SAFETY_MAP: Record<string, ToolSafetyLevel> = {
  // Safe (read-only, no side effects)
  'Read': 'safe',
  'Grep': 'safe',
  'Glob': 'safe',
  'WebSearch': 'safe',
  'TodoRead': 'safe',

  // Write (file modifications)
  'Write': 'write',
  'Edit': 'write',
  'NotebookEdit': 'write',
  'TodoWrite': 'write',

  // Execute (arbitrary commands)
  'Bash': 'execute',

  // Network (external access)
  'WebFetch': 'network',

  // Skills - 根据技能名称分类
  // 只读技能
  'skill__simplify': 'safe',
  'skill__review-pr': 'safe',
  'skill__pdf': 'safe',

  // 写操作技能
  'skill__commit': 'write',
  'skill__skillify': 'write',
  'skill__update-config': 'write',

  // 默认skill分类
  'skill__*': 'execute', // 默认将skill视为执行类工具
}

/** 获取工具安全等级 */
export function getToolSafetyLevel(toolName: string): ToolSafetyLevel {
  // 首先检查精确匹配
  if (TOOL_SAFETY_MAP[toolName]) {
    return TOOL_SAFETY_MAP[toolName]
  }

  // 检查skill工具的模式匹配
  if (toolName.startsWith('skill__')) {
    // 检查特定的skill模式
    for (const [pattern, level] of Object.entries(TOOL_SAFETY_MAP)) {
      if (pattern.startsWith('skill__') && pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1) // 移除末尾的*
        if (toolName.startsWith(prefix)) {
          return level as ToolSafetyLevel
        }
      }
    }

    // 默认skill分类
    return TOOL_SAFETY_MAP['skill__*'] || 'execute'
  }

  return 'execute'  // 未知工具默认最高限制
}

// ── 危险 Bash 命令检测（学 Claude 的 bashClassifier） ──

const DANGEROUS_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*f|-[a-zA-Z]*r|--force|--recursive)/i,   // rm -rf
  /\bsudo\b/i,                                                   // sudo
  /\bchmod\s+[0-7]{3,4}/i,                                      // chmod
  /\bchown\b/i,                                                  // chown
  /\bdd\s+/i,                                                    // dd
  /\bmkfs\b/i,                                                   // mkfs
  /\bformat\b/i,                                                 // format
  />\s*\/dev\//,                                                  // redirect to /dev/
  /\bcurl\b.*\|\s*(sh|bash)/i,                                   // curl | sh
  /\bwget\b.*\|\s*(sh|bash)/i,                                   // wget | sh
  /\bgit\s+push\s+.*--force/i,                                   // git push --force
  /\bgit\s+reset\s+--hard/i,                                     // git reset --hard
  /\bgit\s+clean\s+-[a-zA-Z]*f/i,                               // git clean -f
  /\bnpm\s+publish/i,                                             // npm publish
  /\bdocker\s+rm/i,                                              // docker rm
  /\bkill\s+-9/i,                                                // kill -9
  /\benv\b.*PASSWORD|TOKEN|SECRET|KEY/i,                          // env vars with secrets
]

const SAFE_BASH_PATTERNS = [
  /^\s*(echo|cat|ls|pwd|head|tail|wc|date|whoami)\b/,           // info commands
  /^\s*git\s+(status|log|diff|show|branch)\b/,                   // git read ops
  /^\s*(npm|npx|yarn|pnpm|bun)\s+(test|run|exec)\b/,            // package manager run
  /^\s*(node|bun|deno|python|python3)\s/,                        // script runners
  /^\s*(tsc|vitest|jest|pytest|cargo\s+test)\b/,                 // test runners
  /^\s*(grep|rg|find|fd)\b/,                                     // search commands
]

export function classifyBashCommand(command: string): 'safe' | 'dangerous' | 'unknown' {
  // Check dangerous first
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) return 'dangerous'
  }
  // Check safe
  for (const pattern of SAFE_BASH_PATTERNS) {
    if (pattern.test(command)) return 'safe'
  }
  return 'unknown'
}

// ── Permission Manager ──

export class PermissionManager {
  private mode: PermissionMode
  private rules: PermissionRule[] = []
  /** 会话级别的白名单（用户已批准的操作） */
  private sessionAllowed: Set<string> = new Set()
  /** 需要用户确认时的回调 */
  private askCallback?: (prompt: string) => Promise<boolean>

  constructor(
    mode: PermissionMode = 'default',
    askCallback?: (prompt: string) => Promise<boolean>,
  ) {
    this.mode = mode
    this.askCallback = askCallback
    this.initBuiltinRules()
  }

  /** 初始化内置规则 */
  private initBuiltinRules(): void {
    // Plan 模式：只读工具放行，其余拒绝
    // Default 模式：安全工具放行，写/执行需要确认
    // Yolo 模式：全部放行
    // 内置规则在 checkPermission 中根据 mode 动态判断
  }

  /** 获取当前模式 */
  getMode(): PermissionMode {
    return this.mode
  }

  /** 设置权限模式 */
  setMode(mode: PermissionMode): void {
    this.mode = mode
    console.log(`[Permission] Mode → ${mode}`)
  }

  /** 添加自定义规则 */
  addRule(rule: PermissionRule): void {
    this.rules.push(rule)
  }

  /** 清空会话白名单 */
  clearSessionAllowed(): void {
    this.sessionAllowed.clear()
  }

  /**
   * 检查工具执行权限
   *
   * @param toolName 工具名称
   * @param input 工具输入参数
   * @param context 执行上下文
   * @returns 权限检查结果
   */
  async checkPermission(
    toolName: string,
    input: Record<string, any>,
    context: ToolContext,
  ): Promise<PermissionCheckResult> {
    const safetyLevel = getToolSafetyLevel(toolName)

    // ── Yolo 模式：全部放行 ──
    if (this.mode === 'yolo') {
      return { decision: 'allow', reason: 'yolo mode' }
    }

    // ── Plan 模式：只读放行 ──
    if (this.mode === 'plan') {
      if (safetyLevel === 'safe') {
        return { decision: 'allow', reason: 'read-only tool in plan mode' }
      }
      return {
        decision: 'deny',
        reason: `Tool "${toolName}" is not allowed in plan mode (read-only)`,
      }
    }

    // ── Default 模式 ──

    // 1. 检查自定义规则（优先级最高）
    const ruleResult = this.checkRules(toolName, input)
    if (ruleResult) return ruleResult

    // 2. 会话白名单
    const sessionKey = this.getSessionKey(toolName, input)
    if (this.sessionAllowed.has(sessionKey)) {
      return { decision: 'allow', reason: 'session-approved' }
    }

    // 3. 安全工具直接放行
    if (safetyLevel === 'safe') {
      return { decision: 'allow', reason: 'safe tool' }
    }

    // 4. Skill 工具特殊处理
    if (toolName.startsWith('skill__')) {
      const skillName = toolName.replace('skill__', '')

      // 根据技能安全等级处理
      if (safetyLevel === 'safe') {
        return { decision: 'allow', reason: `safe skill: ${skillName}` }
      }

      // 写操作技能
      if (safetyLevel === 'write') {
        // 检查是否在项目目录内
        const skillArgs = input.args || ''
        // 简单检查：如果技能参数包含文件路径，检查是否在项目目录内
        if (typeof skillArgs === 'string' && this.hasPathUnderCwd(skillArgs, context.cwd)) {
          return { decision: 'allow', reason: `write skill within project: ${skillName}` }
        }
        const prompt = `Skill "${skillName}" may modify files. Allow execution?`
        return await this.handleAsk(prompt, sessionKey)
      }

      // 执行类技能
      if (safetyLevel === 'execute') {
        const prompt = `Skill "${skillName}" will execute commands. Allow execution?`
        return await this.handleAsk(prompt, sessionKey)
      }

      // 网络类技能
      if (safetyLevel === 'network') {
        const prompt = `Skill "${skillName}" will access network. Allow execution?`
        return await this.handleAsk(prompt, sessionKey)
      }
    }

    // 5. Bash 命令特殊处理
    if (toolName === 'Bash' && input.command) {
      const classification = classifyBashCommand(input.command)
      if (classification === 'safe') {
        return { decision: 'allow', reason: 'safe bash command' }
      }
      if (classification === 'dangerous') {
        const prompt = `⚠️ Dangerous command detected:\n  $ ${input.command}\nAllow execution?`
        return await this.handleAsk(prompt, sessionKey)
      }
      // unknown → ask
      const prompt = `Bash command requires confirmation:\n  $ ${input.command}\nAllow?`
      return await this.handleAsk(prompt, sessionKey)
    }

    // 6. Write/Edit 文件操作
    if (safetyLevel === 'write') {
      const filePath = input.file_path || input.path || 'unknown'
      // 在 cwd 内的写操作放行
      if (typeof filePath === 'string' && filePath.startsWith(context.cwd)) {
        return { decision: 'allow', reason: 'write within project directory' }
      }
      const prompt = `File write outside project:\n  ${filePath}\nAllow?`
      return await this.handleAsk(prompt, sessionKey)
    }

    // 7. 网络工具
    if (safetyLevel === 'network') {
      const url = input.url || ''
      // localhost 放行
      if (typeof url === 'string' && (url.includes('localhost') || url.includes('127.0.0.1'))) {
        return { decision: 'allow', reason: 'localhost network access' }
      }
      const prompt = `Network access requested:\n  ${url}\nAllow?`
      return await this.handleAsk(prompt, sessionKey)
    }

    // 8. 未知安全等级 → 拒绝
    return { decision: 'deny', reason: `Unknown safety level for tool "${toolName}"` }
  }

  /** 检查自定义规则 */
  private checkRules(
    toolName: string,
    input: Record<string, any>,
  ): PermissionCheckResult | null {
    for (const rule of this.rules) {
      if (this.matchToolPattern(rule.toolPattern, toolName)) {
        // 如果有内容匹配
        if (rule.contentPattern) {
          const content = input.command || input.file_path || input.url || input.args || ''
          if (typeof content === 'string' && content.includes(rule.contentPattern)) {
            return { decision: rule.behavior, reason: `rule: ${rule.source}` }
          }
        } else {
          return { decision: rule.behavior, reason: `rule: ${rule.source}` }
        }
      }
    }
    return null
  }

  /** 工具名模式匹配 */
  private matchToolPattern(pattern: string, toolName: string): boolean {
    if (pattern === '*') return true
    if (pattern.endsWith('*')) {
      return toolName.startsWith(pattern.slice(0, -1))
    }
    return pattern === toolName
  }

  /** 处理 ask 决定 */
  private async handleAsk(prompt: string, sessionKey: string): Promise<PermissionCheckResult> {
    if (!this.askCallback) {
      // 没有回调 → 默认放行（自治模式）
      return { decision: 'allow', reason: 'no ask callback (autonomous)' }
    }

    const allowed = await this.askCallback(prompt)
    if (allowed) {
      this.sessionAllowed.add(sessionKey)
      return { decision: 'allow', reason: 'user-approved' }
    }
    return { decision: 'deny', reason: 'user-denied', prompt }
  }

  /** 生成会话级别的操作 key */
  private getSessionKey(toolName: string, input: Record<string, any>): string {
    if (toolName === 'Bash') {
      // Bash 按命令前缀分组（如 "git push" → "Bash:git push"）
      const cmd = (input.command || '').split(' ').slice(0, 2).join(' ')
      return `${toolName}:${cmd}`
    }
    if (input.file_path) return `${toolName}:${input.file_path}`
    if (input.url) return `${toolName}:${new URL(input.url).hostname}`
    return toolName
  }

  private hasPathUnderCwd(text: string, cwd: string): boolean {
    const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
    if (!normalizedCwd) return false
    const pathRegex = /([A-Za-z]:)?[\\/][A-Za-z0-9._\-\\/]+/g
    const matches = text.match(pathRegex) ?? []
    for (const raw of matches) {
      const candidate = raw.replace(/\\/g, '/')
      if (candidate === normalizedCwd || candidate.startsWith(`${normalizedCwd}/`)) {
        return true
      }
    }
    return false
  }
}

/**
 * 创建带权限检查的工具执行包装器
 *
 * 在 ToolRegistry.execute() 之前拦截，检查权限
 */
export function withPermissions(
  tool: ToolDefinition,
  permissionManager: PermissionManager,
): ToolDefinition {
  return {
    ...tool,
    execute: async (input, context) => {
      const check = await permissionManager.checkPermission(tool.name, input, context)

      if (check.decision === 'deny') {
        return {
          content: `Permission denied: ${check.reason}`,
          isError: true,
        }
      }

      // allow or ask (already resolved)
      return tool.execute(input, context)
    },
  }
}
