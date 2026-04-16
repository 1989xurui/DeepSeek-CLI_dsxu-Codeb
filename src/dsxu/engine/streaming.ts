/**
 * #6.1 Streaming Output + #6.2 Rich Terminal UI
 *
 * 流式输出管理：
 *   - 将 LLM token-by-token 输出实时推送到终端
 *   - Progress indicators (spinner/bar)
 *   - 工具调用进度显示
 *   - ANSI 颜色支持
 */

// ── ANSI Colors ──

export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}

export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

// ── Spinner ──

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export class Spinner {
  private frameIdx = 0
  private intervalId: ReturnType<typeof setInterval> | null = null
  private label: string
  private stream: NodeJS.WriteStream

  constructor(label: string = '', stream: NodeJS.WriteStream = process.stderr) {
    this.label = label
    this.stream = stream
  }

  start(label?: string): void {
    if (label) this.label = label
    if (this.intervalId) return

    this.intervalId = setInterval(() => {
      const frame = SPINNER_FRAMES[this.frameIdx % SPINNER_FRAMES.length]
      this.stream.write(`\r${colorize(frame, 'cyan')} ${this.label}`)
      this.frameIdx++
    }, 80)
  }

  update(label: string): void {
    this.label = label
  }

  stop(finalMessage?: string): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.stream.write('\r\x1b[K') // Clear line
    if (finalMessage) {
      this.stream.write(finalMessage + '\n')
    }
  }

  get isRunning(): boolean {
    return this.intervalId !== null
  }
}

// ── Progress Bar ──

export class ProgressBar {
  private current = 0
  private total: number
  private width: number
  private label: string
  private stream: NodeJS.WriteStream

  constructor(
    total: number,
    label: string = '',
    width: number = 30,
    stream: NodeJS.WriteStream = process.stderr,
  ) {
    this.total = total
    this.label = label
    this.width = width
    this.stream = stream
  }

  update(current: number, label?: string): void {
    this.current = Math.min(current, this.total)
    if (label) this.label = label

    const pct = this.total > 0 ? this.current / this.total : 0
    const filled = Math.round(pct * this.width)
    const empty = this.width - filled

    const bar = colorize('█'.repeat(filled), 'green') + colorize('░'.repeat(empty), 'gray')
    const pctStr = `${(pct * 100).toFixed(0)}%`

    this.stream.write(`\r${bar} ${pctStr} ${this.label}`)
  }

  increment(label?: string): void {
    this.update(this.current + 1, label)
  }

  finish(message?: string): void {
    this.stream.write('\r\x1b[K')
    if (message) {
      this.stream.write(message + '\n')
    }
  }
}

// ── Streaming Token Writer ──

export interface StreamWriter {
  /** 写入文本片段 */
  writeToken(token: string): void
  /** 写入工具调用开始 */
  writeToolStart(toolName: string, input: string): void
  /** 写入工具调用结束 */
  writeToolEnd(toolName: string, durationMs: number, isError: boolean): void
  /** 写入思考过程 */
  writeThinking(text: string): void
  /** 写入状态信息 */
  writeStatus(message: string): void
  /** 写入档位变化 */
  writeGearShift(from: number, to: number, reason: string): void
  /** 刷新 */
  flush(): void
}

/**
 * 终端流式输出实现
 */
export class TerminalStreamWriter implements StreamWriter {
  private stream: NodeJS.WriteStream
  private showThinking: boolean
  private showToolCalls: boolean

  constructor(opts?: {
    stream?: NodeJS.WriteStream
    showThinking?: boolean
    showToolCalls?: boolean
  }) {
    this.stream = opts?.stream || process.stdout
    this.showThinking = opts?.showThinking ?? true
    this.showToolCalls = opts?.showToolCalls ?? true
  }

  writeToken(token: string): void {
    this.stream.write(token)
  }

  writeToolStart(toolName: string, input: string): void {
    if (!this.showToolCalls) return
    const truncInput = input.length > 80 ? input.slice(0, 77) + '...' : input
    this.stream.write(
      `\n${colorize('⚡', 'yellow')} ${colorize(toolName, 'bold')}(${colorize(truncInput, 'dim')})\n`,
    )
  }

  writeToolEnd(toolName: string, durationMs: number, isError: boolean): void {
    if (!this.showToolCalls) return
    const icon = isError ? colorize('✗', 'red') : colorize('✓', 'green')
    this.stream.write(
      `${icon} ${toolName} ${colorize(`${durationMs}ms`, 'dim')}\n`,
    )
  }

  writeThinking(text: string): void {
    if (!this.showThinking) return
    this.stream.write(colorize(`💭 ${text.slice(0, 200)}\n`, 'dim'))
  }

  writeStatus(message: string): void {
    this.stream.write(colorize(`ℹ ${message}\n`, 'cyan'))
  }

  writeGearShift(from: number, to: number, reason: string): void {
    const icon = to > from ? '⬆️' : '⬇️'
    this.stream.write(
      `${icon} ${colorize(`Gear ${from}→${to}`, 'yellow')}: ${reason}\n`,
    )
  }

  flush(): void {
    // Node streams auto-flush, but provide the interface
  }
}

/**
 * 无操作 StreamWriter（测试/静默模式用）
 */
export class NullStreamWriter implements StreamWriter {
  readonly tokens: string[] = []
  readonly events: string[] = []

  writeToken(token: string): void { this.tokens.push(token) }
  writeToolStart(name: string): void { this.events.push(`tool_start:${name}`) }
  writeToolEnd(name: string): void { this.events.push(`tool_end:${name}`) }
  writeThinking(text: string): void { this.events.push(`thinking:${text.slice(0, 50)}`) }
  writeStatus(msg: string): void { this.events.push(`status:${msg}`) }
  writeGearShift(from: number, to: number): void { this.events.push(`gear:${from}→${to}`) }
  flush(): void {}
}
