/**
 * #7.1 CLI Entry Point + #7.2 REPL Loop
 *
 * DSxu 命令行入口：
 *   - 解析命令行参数
 *   - 单次执行模式 (dsxu "fix the bug")
 *   - 交互式 REPL 模式 (dsxu)
 *   - 管道模式 (echo "query" | dsxu)
 */

import type { DSxuConfig } from './config'
import type { Message } from './types'

// ── CLI Argument Parsing ──

export interface CLIArgs {
  /** 查询内容（非交互模式） */
  query?: string
  /** 工作目录 */
  cwd: string
  /** 配置覆盖 */
  configOverrides: Partial<DSxuConfig>
  /** 恢复的会话 ID */
  resumeSession?: string
  /** 是否打印帮助 */
  help: boolean
  /** 是否打印版本 */
  version: boolean
  /** 是否安静模式 */
  quiet: boolean
  /** 是否 REPL 模式 */
  interactive: boolean
  /** 是否管道输入 */
  piped: boolean
  /** 初始档位 */
  gear?: 1 | 2 | 3
  /** 权限模式 */
  permissionMode?: 'default' | 'plan' | 'yolo'
}

/**
 * 解析命令行参数
 */
export function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    cwd: process.cwd(),
    configOverrides: {},
    help: false,
    version: false,
    quiet: false,
    interactive: false,
    piped: false,
  }

  let i = 0
  const positional: string[] = []

  while (i < argv.length) {
    const arg = argv[i]

    switch (arg) {
      case '-h':
      case '--help':
        args.help = true
        break
      case '-v':
      case '--version':
        args.version = true
        break
      case '-q':
      case '--quiet':
        args.quiet = true
        break
      case '-i':
      case '--interactive':
        args.interactive = true
        break
      case '--cwd':
        args.cwd = argv[++i] || process.cwd()
        break
      case '--resume':
        args.resumeSession = argv[++i]
        break
      case '--gear':
        const g = parseInt(argv[++i])
        if (g >= 1 && g <= 3) args.gear = g as 1 | 2 | 3
        break
      case '--yolo':
        args.permissionMode = 'yolo'
        break
      case '--plan':
        args.permissionMode = 'plan'
        break
      case '--max-turns':
        const mt = parseInt(argv[++i])
        if (mt > 0) args.configOverrides = { ...args.configOverrides, engine: { maxTurns: mt } as any }
        break
      case '-p':
      case '--print':
        // Alias for non-interactive + quiet
        args.quiet = true
        break
      default:
        if (!arg.startsWith('-')) {
          positional.push(arg)
        }
    }
    i++
  }

  // Join positional args as query
  if (positional.length > 0) {
    args.query = positional.join(' ')
  }

  return args
}

/**
 * 生成帮助文本
 */
export function getHelpText(): string {
  return `DSxu — DeepSeek-powered coding assistant

Usage:
  dsxu [query]              Run a single query
  dsxu                      Start interactive REPL
  dsxu --resume <id>        Resume a previous session
  echo "query" | dsxu       Pipe input

Options:
  -h, --help                Show this help
  -v, --version             Show version
  -q, --quiet               Minimal output
  -i, --interactive         Force REPL mode
  --cwd <dir>               Set working directory
  --gear <1|2|3>            Set initial gear (1=chat, 2=reasoner, 3=consensus)
  --yolo                    Skip all permission prompts
  --plan                    Plan mode (approve before writes)
  --max-turns <n>           Maximum turns per query
  --resume <id>             Resume session by ID

Slash Commands (in REPL):
  /help                     Show commands
  /clear                    Clear context
  /compact                  Compact context
  /cost                     Show cost
  /gear [1|2|3]             Get/set gear
  /tools                    List tools
  /exit                     Exit`
}

// ── REPL ──

export interface REPLConfig {
  /** 提示符 */
  prompt: string
  /** 多行模式 */
  multiline: boolean
  /** 历史记录大小 */
  historySize: number
  /** 退出命令 */
  exitCommands: string[]
}

export const DEFAULT_REPL_CONFIG: REPLConfig = {
  prompt: 'dsxu> ',
  multiline: true,
  historySize: 100,
  exitCommands: ['/exit', '/quit', '/q'],
}

/**
 * REPL 状态机
 */
export class REPLState {
  private history: string[] = []
  private config: REPLConfig
  private running = false

  constructor(config?: Partial<REPLConfig>) {
    this.config = { ...DEFAULT_REPL_CONFIG, ...config }
  }

  get isRunning(): boolean {
    return this.running
  }

  get prompt(): string {
    return this.config.prompt
  }

  start(): void {
    this.running = true
  }

  stop(): void {
    this.running = false
  }

  /**
   * 添加到历史
   */
  addHistory(input: string): void {
    if (input.trim() && this.history[this.history.length - 1] !== input) {
      this.history.push(input)
      if (this.history.length > this.config.historySize) {
        this.history.shift()
      }
    }
  }

  /**
   * 获取历史
   */
  getHistory(): string[] {
    return [...this.history]
  }

  /**
   * 检查是否是退出命令
   */
  isExitCommand(input: string): boolean {
    return this.config.exitCommands.includes(input.trim().toLowerCase())
  }

  /**
   * 检查是否是多行输入（以 \ 结尾或未闭合的括号/引号）
   */
  isMultilineInput(input: string): boolean {
    if (!this.config.multiline) return false
    if (input.endsWith('\\')) return true

    // Check unclosed brackets/quotes
    let depth = 0
    let inString = false
    let stringChar = ''
    for (const ch of input) {
      if (inString) {
        if (ch === stringChar) inString = false
      } else {
        if (ch === '"' || ch === "'" || ch === '`') {
          inString = true
          stringChar = ch
        } else if (ch === '{' || ch === '(' || ch === '[') depth++
        else if (ch === '}' || ch === ')' || ch === ']') depth--
      }
    }

    return depth > 0 || inString
  }
}
