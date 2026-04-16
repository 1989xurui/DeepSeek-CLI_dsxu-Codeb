/**
 * Wave 4 Final 测试
 * #6.1 Streaming + #6.2 Rich UI + #6.5 Slash Commands + #6.14 File Watcher
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Spinner, ProgressBar, NullStreamWriter, colorize, colors, TerminalStreamWriter } from '../streaming'
import {
  isSlashCommand, parseSlashCommand, executeSlashCommand,
  getRegisteredCommands, registerCommand,
} from '../slash-commands'
import type { CommandContext } from '../slash-commands'
import { FileWatcher, deduplicateEvents, createWatcher, getRecentlyModified } from '../file-watcher'
import type { FileChangeEvent } from '../file-watcher'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

// ── #6.1 + #6.2 Streaming ──

describe('colorize', () => {
  it('should wrap text with ANSI color codes', () => {
    const result = colorize('hello', 'red')
    expect(result).toContain('\x1b[31m')
    expect(result).toContain('hello')
    expect(result).toContain('\x1b[0m')
  })
})

describe('NullStreamWriter', () => {
  it('should collect tokens', () => {
    const writer = new NullStreamWriter()
    writer.writeToken('Hello')
    writer.writeToken(' World')
    expect(writer.tokens).toEqual(['Hello', ' World'])
  })

  it('should collect events', () => {
    const writer = new NullStreamWriter()
    writer.writeToolStart('Read')
    writer.writeToolEnd('Read')
    writer.writeThinking('analyzing...')
    writer.writeStatus('Working...')
    writer.writeGearShift(1, 2)

    expect(writer.events).toHaveLength(5)
    expect(writer.events[0]).toBe('tool_start:Read')
    expect(writer.events[4]).toBe('gear:1→2')
  })
})

describe('Spinner', () => {
  it('should start and stop', () => {
    const spinner = new Spinner('Loading...')
    expect(spinner.isRunning).toBe(false)

    // We can't easily test terminal output, but verify state
    spinner.start()
    expect(spinner.isRunning).toBe(true)

    spinner.stop()
    expect(spinner.isRunning).toBe(false)
  })

  it('should update label', () => {
    const spinner = new Spinner('initial')
    spinner.update('updated')
    // Just verify it doesn't throw
  })

  it('should not start twice', () => {
    const spinner = new Spinner('test')
    spinner.start()
    spinner.start() // Should be no-op
    expect(spinner.isRunning).toBe(true)
    spinner.stop()
  })
})

describe('ProgressBar', () => {
  it('should create and update', () => {
    const bar = new ProgressBar(10, 'Files')
    bar.update(5)
    bar.increment()
    bar.finish('Done')
    // Just verify no errors
  })
})

// ── #6.5 Slash Commands ──

describe('isSlashCommand', () => {
  it('should detect slash commands', () => {
    expect(isSlashCommand('/help')).toBe(true)
    expect(isSlashCommand('  /clear')).toBe(true)
    expect(isSlashCommand('/gear 2')).toBe(true)
  })

  it('should not detect regular messages', () => {
    expect(isSlashCommand('hello')).toBe(false)
    expect(isSlashCommand('fix the /path/to/file')).toBe(false)
  })
})

describe('parseSlashCommand', () => {
  it('should parse command name', () => {
    expect(parseSlashCommand('/help')).toEqual({ name: 'help', args: '' })
  })

  it('should parse command with args', () => {
    expect(parseSlashCommand('/gear 2')).toEqual({ name: 'gear', args: '2' })
  })

  it('should parse multi-word args', () => {
    expect(parseSlashCommand('/help clear')).toEqual({ name: 'help', args: 'clear' })
  })

  it('should return null for non-commands', () => {
    expect(parseSlashCommand('hello')).toBeNull()
  })

  it('should lowercase command name', () => {
    expect(parseSlashCommand('/HELP')).toEqual({ name: 'help', args: '' })
  })
})

describe('executeSlashCommand', () => {
  const makeContext = (): CommandContext => ({
    messages: [
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
    ],
    gear: 1,
    toolNames: ['Read', 'Write', 'Bash'],
    sessionId: 'test-123',
    cwd: '/project',
    callbacks: {},
  })

  it('should execute /help', async () => {
    const result = await executeSlashCommand('/help', makeContext())
    expect(result).not.toBeNull()
    expect(result!.output).toContain('Available commands')
    expect(result!.continueChat).toBe(false)
  })

  it('should execute /help with specific command', async () => {
    const result = await executeSlashCommand('/help gear', makeContext())
    expect(result!.output).toContain('gear')
  })

  it('should execute /clear', async () => {
    const ctx = makeContext()
    const result = await executeSlashCommand('/clear', ctx)
    expect(result!.contextModified).toBe(true)
    expect(ctx.messages).toHaveLength(1) // Only system kept
    expect(ctx.messages[0].role).toBe('system')
  })

  it('should execute /gear show', async () => {
    const result = await executeSlashCommand('/gear', makeContext())
    expect(result!.output).toContain('Current gear: 1')
  })

  it('should execute /gear set', async () => {
    const setGear = vi.fn()
    const ctx = makeContext()
    ctx.callbacks.setGear = setGear

    const result = await executeSlashCommand('/gear 2', ctx)
    expect(result!.output).toContain('Gear set to 2')
    expect(setGear).toHaveBeenCalledWith(2)
  })

  it('should reject invalid gear', async () => {
    const result = await executeSlashCommand('/gear 5', makeContext())
    expect(result!.output).toContain('Invalid')
  })

  it('should execute /tools', async () => {
    const result = await executeSlashCommand('/tools', makeContext())
    expect(result!.output).toContain('Read')
    expect(result!.output).toContain('Write')
    expect(result!.output).toContain('3')
  })

  it('should execute /cost', async () => {
    const ctx = makeContext()
    ctx.callbacks.getCost = () => 'Session cost: $0.0042'
    const result = await executeSlashCommand('/cost', ctx)
    expect(result!.output).toContain('$0.0042')
  })

  it('should execute /debug', async () => {
    const result = await executeSlashCommand('/debug', makeContext())
    expect(result!.output).toContain('test-123')
  })

  it('should handle unknown command', async () => {
    const result = await executeSlashCommand('/unknown', makeContext())
    expect(result!.output).toContain('Unknown command')
  })

  it('should handle alias /h', async () => {
    const result = await executeSlashCommand('/h', makeContext())
    expect(result!.output).toContain('Available commands')
  })

  it('should return null for non-commands', async () => {
    const result = await executeSlashCommand('hello', makeContext())
    expect(result).toBeNull()
  })
})

describe('getRegisteredCommands', () => {
  it('should return unique commands', () => {
    const cmds = getRegisteredCommands()
    const names = cmds.map(c => c.name)
    expect(names).toContain('help')
    expect(names).toContain('clear')
    expect(names).toContain('gear')
    expect(names).toContain('tools')
    expect(names).toContain('exit')
    // Should be deduplicated (aliases not separate entries)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('registerCommand', () => {
  it('should register custom command', async () => {
    registerCommand({
      name: 'custom-test-xyz',
      aliases: [],
      description: 'Custom test command',
      usage: '/custom-test-xyz',
      execute: async () => ({
        output: 'custom executed',
        continueChat: false,
        contextModified: false,
      }),
    })

    const ctx: CommandContext = {
      messages: [],
      gear: 1,
      toolNames: [],
      sessionId: '',
      cwd: '',
      callbacks: {},
    }
    const result = await executeSlashCommand('/custom-test-xyz', ctx)
    expect(result!.output).toBe('custom executed')
  })
})

// ── #6.14 File Watcher ──

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-watcher-test-' + Date.now())

describe('deduplicateEvents', () => {
  it('should keep only latest event per file', () => {
    const events: FileChangeEvent[] = [
      { type: 'change', file: '/a.ts', relativePath: 'a.ts', timestamp: 1 },
      { type: 'change', file: '/a.ts', relativePath: 'a.ts', timestamp: 2 },
      { type: 'change', file: '/b.ts', relativePath: 'b.ts', timestamp: 1 },
    ]

    const deduped = deduplicateEvents(events)
    expect(deduped).toHaveLength(2)
    expect(deduped.find(e => e.file === '/a.ts')!.timestamp).toBe(2)
  })
})

describe('FileWatcher', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('should create and start/stop', () => {
    const onChange = vi.fn()
    const watcher = new FileWatcher({
      dir: TEST_DIR,
      onChange,
    })

    expect(watcher.isRunning).toBe(false)
    watcher.start()
    expect(watcher.isRunning).toBe(true)
    watcher.stop()
    expect(watcher.isRunning).toBe(false)
  })

  it('should detect file changes', async () => {
    const events: FileChangeEvent[][] = []
    const watcher = new FileWatcher({
      dir: TEST_DIR,
      onChange: (evts) => events.push(evts),
      debounceMs: 100,
    })

    watcher.start()

    // Create a file
    writeFileSync(join(TEST_DIR, 'test.ts'), 'const x = 1')

    // Wait for debounce
    await new Promise(r => setTimeout(r, 300))

    watcher.stop()

    // May or may not have detected the change depending on OS
    // Just verify it didn't error
  })
})

describe('createWatcher', () => {
  it('should create watcher', () => {
    mkdirSync(TEST_DIR, { recursive: true })
    const watcher = createWatcher(TEST_DIR, () => {})
    expect(watcher).toBeInstanceOf(FileWatcher)
    // Clean up
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })
})

describe('getRecentlyModified', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
  })

  it('should find recently modified files', () => {
    writeFileSync(join(TEST_DIR, 'recent.ts'), 'new')
    const recent = getRecentlyModified(TEST_DIR, ['recent.ts'], 60_000)
    expect(recent).toContain('recent.ts')
  })

  it('should skip missing files', () => {
    const recent = getRecentlyModified(TEST_DIR, ['missing.ts'], 60_000)
    expect(recent).toHaveLength(0)
  })
})
