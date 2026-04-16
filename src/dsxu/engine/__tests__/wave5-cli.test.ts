/**
 * Wave 5 CLI + REPL 测试
 * #7.1 CLI + #7.2 REPL
 */

import { describe, it, expect } from 'vitest'
import { parseArgs, getHelpText, REPLState } from '../cli'

// ── CLI Args ──

describe('parseArgs', () => {
  it('should parse empty args', () => {
    const args = parseArgs([])
    expect(args.help).toBe(false)
    expect(args.query).toBeUndefined()
    expect(args.interactive).toBe(false)
  })

  it('should parse --help', () => {
    expect(parseArgs(['--help']).help).toBe(true)
    expect(parseArgs(['-h']).help).toBe(true)
  })

  it('should parse --version', () => {
    expect(parseArgs(['--version']).version).toBe(true)
    expect(parseArgs(['-v']).version).toBe(true)
  })

  it('should parse query from positional args', () => {
    const args = parseArgs(['fix', 'the', 'bug'])
    expect(args.query).toBe('fix the bug')
  })

  it('should parse --cwd', () => {
    const args = parseArgs(['--cwd', '/my/project'])
    expect(args.cwd).toBe('/my/project')
  })

  it('should parse --gear', () => {
    const args = parseArgs(['--gear', '2'])
    expect(args.gear).toBe(2)
  })

  it('should ignore invalid gear', () => {
    const args = parseArgs(['--gear', '5'])
    expect(args.gear).toBeUndefined()
  })

  it('should parse --yolo', () => {
    const args = parseArgs(['--yolo'])
    expect(args.permissionMode).toBe('yolo')
  })

  it('should parse --plan', () => {
    const args = parseArgs(['--plan'])
    expect(args.permissionMode).toBe('plan')
  })

  it('should parse --resume', () => {
    const args = parseArgs(['--resume', 'abc123'])
    expect(args.resumeSession).toBe('abc123')
  })

  it('should parse --max-turns', () => {
    const args = parseArgs(['--max-turns', '100'])
    expect((args.configOverrides as any).engine?.maxTurns).toBe(100)
  })

  it('should parse combined args', () => {
    const args = parseArgs(['--gear', '3', '--quiet', 'fix auth.ts'])
    expect(args.gear).toBe(3)
    expect(args.quiet).toBe(true)
    expect(args.query).toBe('fix auth.ts')
  })
})

describe('getHelpText', () => {
  it('should contain usage info', () => {
    const help = getHelpText()
    expect(help).toContain('DSxu')
    expect(help).toContain('Usage')
    expect(help).toContain('--help')
    expect(help).toContain('--gear')
    expect(help).toContain('/help')
  })
})

// ── REPL ──

describe('REPLState', () => {
  it('should initialize stopped', () => {
    const repl = new REPLState()
    expect(repl.isRunning).toBe(false)
  })

  it('should start and stop', () => {
    const repl = new REPLState()
    repl.start()
    expect(repl.isRunning).toBe(true)
    repl.stop()
    expect(repl.isRunning).toBe(false)
  })

  it('should have default prompt', () => {
    const repl = new REPLState()
    expect(repl.prompt).toBe('dsxu> ')
  })

  it('should accept custom prompt', () => {
    const repl = new REPLState({ prompt: '>> ' })
    expect(repl.prompt).toBe('>> ')
  })

  it('should manage history', () => {
    const repl = new REPLState()
    repl.addHistory('fix the bug')
    repl.addHistory('add tests')
    expect(repl.getHistory()).toEqual(['fix the bug', 'add tests'])
  })

  it('should not duplicate consecutive history', () => {
    const repl = new REPLState()
    repl.addHistory('fix bug')
    repl.addHistory('fix bug')
    expect(repl.getHistory()).toHaveLength(1)
  })

  it('should skip empty history', () => {
    const repl = new REPLState()
    repl.addHistory('')
    repl.addHistory('  ')
    expect(repl.getHistory()).toHaveLength(0)
  })

  it('should limit history size', () => {
    const repl = new REPLState({ historySize: 3 })
    repl.addHistory('a')
    repl.addHistory('b')
    repl.addHistory('c')
    repl.addHistory('d')
    expect(repl.getHistory()).toEqual(['b', 'c', 'd'])
  })

  it('should detect exit commands', () => {
    const repl = new REPLState()
    expect(repl.isExitCommand('/exit')).toBe(true)
    expect(repl.isExitCommand('/quit')).toBe(true)
    expect(repl.isExitCommand('/q')).toBe(true)
    expect(repl.isExitCommand('hello')).toBe(false)
  })

  it('should detect multiline input', () => {
    const repl = new REPLState()
    expect(repl.isMultilineInput('hello\\')).toBe(true)
    expect(repl.isMultilineInput('{ unclosed')).toBe(true)
    expect(repl.isMultilineInput('"unclosed string')).toBe(true)
    expect(repl.isMultilineInput('complete line')).toBe(false)
    expect(repl.isMultilineInput('{ closed }')).toBe(false)
  })
})
