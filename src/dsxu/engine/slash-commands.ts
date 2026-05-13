/**
 * #6.5 Slash Commands
 *
 * 类似 DSXU Code 的斜杠命令系统：
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

// ── Types ──

export interface SlashCommand {
  name: string
  aliases: string[]
  description: string
  usage: string
  execute: (args: string, context: CommandContext) => Promise<CommandResult>
}

export interface CommandContext {
  /** 当前消息列表（可修改） */
  messages: any[]
  /** 当前档位 */
  gear: number
  /** 工具名列表 */
  toolNames: string[]
  /** 会话 ID */
  sessionId: string
  /** 工作目录 */
  cwd: string
  /** 回调函数 */
  callbacks: {
    setGear?: (gear: 1 | 2 | 3) => void
    compact?: () => Promise<any>
    getCost?: () => string
    getDebugInfo?: () => string
    exit?: () => void
  }
}

export interface CommandResult {
  /** 显示给用户的消息 */
  output: string
  /** 是否应该继续对话（false = 拦截，不发给 LLM） */
  continueChat: boolean
  /** 是否修改了上下文 */
  contextModified: boolean
}

// ── Command Registry ──

const commands: Map<string, SlashCommand> = new Map()

function register(cmd: SlashCommand): void {
  commands.set(cmd.name, cmd)
  for (const alias of cmd.aliases) {
    commands.set(alias, cmd)
  }
}

// ── Built-in Commands ──

register({
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  usage: '/help [command]',
  execute: async (args, ctx) => {
    if (args) {
      const cmd = commands.get(args)
      if (cmd) {
        return {
          output: `${cmd.name}: ${cmd.description}\nUsage: ${cmd.usage}`,
          continueChat: false,
          contextModified: false,
        }
      }
      return { output: `Unknown command: ${args}`, continueChat: false, contextModified: false }
    }

    const uniqueCmds = new Map<string, SlashCommand>()
    for (const [, cmd] of commands) {
      uniqueCmds.set(cmd.name, cmd)
    }

    const lines = ['Available commands:\n']
    for (const [, cmd] of uniqueCmds) {
      const aliases = cmd.aliases.length > 0 ? ` (${cmd.aliases.map(a => '/' + a).join(', ')})` : ''
      lines.push(`  /${cmd.name}${aliases} — ${cmd.description}`)
    }

    return { output: lines.join('\n'), continueChat: false, contextModified: false }
  },
})

register({
  name: 'clear',
  aliases: [],
  description: 'Clear conversation context (keep system prompt)',
  usage: '/clear',
  execute: async (_args, ctx) => {
    const systemMsgs = ctx.messages.filter((m: any) => m.role === 'system')
    ctx.messages.length = 0
    ctx.messages.push(...systemMsgs)

    return {
      output: 'Context cleared. System prompt preserved.',
      continueChat: false,
      contextModified: true,
    }
  },
})

register({
  name: 'compact',
  aliases: [],
  description: 'Manually compact conversation context',
  usage: '/compact',
  execute: async (_args, ctx) => {
    if (ctx.callbacks.compact) {
      try {
        const result = await ctx.callbacks.compact()
        return {
          output: `Compacted: ${result?.wasCompacted ? 'reduced context' : 'no compaction needed'}`,
          continueChat: false,
          contextModified: true,
        }
      } catch (e: any) {
        return { output: `Compact failed: ${e.message}`, continueChat: false, contextModified: false }
      }
    }
    return { output: 'Compact not available', continueChat: false, contextModified: false }
  },
})

register({
  name: 'cost',
  aliases: [],
  description: 'Show current session cost',
  usage: '/cost',
  execute: async (_args, ctx) => {
    const cost = ctx.callbacks.getCost?.() || 'Cost tracking not available'
    return { output: cost, continueChat: false, contextModified: false }
  },
})

register({
  name: 'gear',
  aliases: ['g'],
  description: 'Show or set current gear (1/2/3)',
  usage: '/gear [1|2|3]',
  execute: async (args, ctx) => {
    if (args) {
      const g = parseInt(args)
      if (g >= 1 && g <= 3) {
        ctx.callbacks.setGear?.(g as 1 | 2 | 3)
        return { output: `Gear set to ${g}`, continueChat: false, contextModified: false }
      }
      return { output: 'Invalid gear. Use 1, 2, or 3.', continueChat: false, contextModified: false }
    }
    return {
      output: `Current gear: ${ctx.gear}\n  1 = Standard (chat)\n  2 = Reasoning\n  3 = Consensus (CoT-SC)`,
      continueChat: false,
      contextModified: false,
    }
  },
})

register({
  name: 'tools',
  aliases: ['t'],
  description: 'List available tools',
  usage: '/tools',
  execute: async (_args, ctx) => {
    if (ctx.toolNames.length === 0) {
      return { output: 'No tools registered.', continueChat: false, contextModified: false }
    }
    return {
      output: `Available tools (${ctx.toolNames.length}):\n${ctx.toolNames.map(n => `  • ${n}`).join('\n')}`,
      continueChat: false,
      contextModified: false,
    }
  },
})

register({
  name: 'debug',
  aliases: [],
  description: 'Show debug information',
  usage: '/debug',
  execute: async (_args, ctx) => {
    const info = ctx.callbacks.getDebugInfo?.() || [
      `Session: ${ctx.sessionId}`,
      `CWD: ${ctx.cwd}`,
      `Gear: ${ctx.gear}`,
      `Messages: ${ctx.messages.length}`,
      `Tools: ${ctx.toolNames.length}`,
    ].join('\n')

    return { output: info, continueChat: false, contextModified: false }
  },
})

register({
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit DSxu',
  usage: '/exit',
  execute: async (_args, ctx) => {
    ctx.callbacks.exit?.()
    return { output: 'Goodbye!', continueChat: false, contextModified: false }
  },
})

// ── Public API ──

/**
 * 检查输入是否是斜杠命令
 */
export function isSlashCommand(input: string): boolean {
  return input.trimStart().startsWith('/')
}

/**
 * 解析斜杠命令
 */
export function parseSlashCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith('/')) return null

  const match = trimmed.match(/^\/(\S+)\s*(.*)$/)
  if (!match) return null

  return { name: match[1].toLowerCase(), args: match[2].trim() }
}

/**
 * 执行斜杠命令
 */
export async function executeSlashCommand(
  input: string,
  context: CommandContext,
): Promise<CommandResult | null> {
  const parsed = parseSlashCommand(input)
  if (!parsed) return null

  const cmd = commands.get(parsed.name)
  if (!cmd) {
    return {
      output: `Unknown command: /${parsed.name}. Type /help for available commands.`,
      continueChat: false,
      contextModified: false,
    }
  }

  return cmd.execute(parsed.args, context)
}

/**
 * 获取所有注册的命令（去重）
 */
export function getRegisteredCommands(): SlashCommand[] {
  const unique = new Map<string, SlashCommand>()
  for (const [, cmd] of commands) {
    unique.set(cmd.name, cmd)
  }
  return [...unique.values()]
}

/**
 * 注册自定义命令
 */
export function registerCommand(cmd: SlashCommand): void {
  register(cmd)
}
