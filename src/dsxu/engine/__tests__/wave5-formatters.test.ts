/**
 * Wave 5 Formatters + Validators + Init + Plugin 测试
 * #7.6 + #7.12 + #7.13 + #7.14
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  formatTokens, formatCost, formatDuration, formatBytes,
  truncate, formatTable, simplifyMarkdown,
  validateFilePath, validateJSON, checkInjection, sanitizeInput,
  initProject, PluginManager,
} from '../formatters'
import { mkdirSync, existsSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

// ── Formatters ──

describe('formatTokens', () => {
  it('should format thousands', () => {
    expect(formatTokens(1500)).toBe('1.5K')
    expect(formatTokens(50000)).toBe('50.0K')
  })

  it('should format millions', () => {
    expect(formatTokens(1_500_000)).toBe('1.5M')
  })

  it('should format small numbers', () => {
    expect(formatTokens(500)).toBe('500')
  })
})

describe('formatCost', () => {
  it('should format various ranges', () => {
    expect(formatCost(1.5)).toBe('$1.50')
    expect(formatCost(0.05)).toBe('$0.050')
    expect(formatCost(0.0042)).toBe('$0.0042')
  })
})

describe('formatDuration', () => {
  it('should format ms', () => {
    expect(formatDuration(500)).toBe('500ms')
  })

  it('should format seconds', () => {
    expect(formatDuration(3500)).toBe('3.5s')
  })

  it('should format minutes', () => {
    expect(formatDuration(125000)).toBe('2m5s')
  })
})

describe('formatBytes', () => {
  it('should format various sizes', () => {
    expect(formatBytes(500)).toBe('500B')
    expect(formatBytes(1500)).toBe('1.5KB')
    expect(formatBytes(2_500_000)).toBe('2.5MB')
  })
})

describe('truncate', () => {
  it('should truncate long strings', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })

  it('should not truncate short strings', () => {
    expect(truncate('hi', 10)).toBe('hi')
  })

  it('should support custom ellipsis', () => {
    expect(truncate('hello world', 9, '…')).toBe('hello wo…')
  })
})

describe('formatTable', () => {
  it('should format as aligned table', () => {
    const table = formatTable(
      ['Name', 'Age'],
      [['Alice', '30'], ['Bob', '25']],
    )
    expect(table).toContain('Name')
    expect(table).toContain('Alice')
    expect(table).toContain('---')
  })
})

describe('simplifyMarkdown', () => {
  it('should strip formatting', () => {
    const result = simplifyMarkdown('**bold** and *italic* and `code`')
    expect(result).toBe('bold and italic and code')
  })

  it('should strip HTML', () => {
    expect(simplifyMarkdown('<div>hello</div>')).toBe('hello')
  })

  it('should replace code blocks', () => {
    expect(simplifyMarkdown('```js\ncode\n```')).toContain('[code block]')
  })
})

// ── Validators ──

describe('validateFilePath', () => {
  it('should accept paths within cwd', () => {
    const result = validateFilePath('src/app.ts', '/project')
    expect(result.valid).toBe(true)
  })

  it('should reject path traversal', () => {
    const result = validateFilePath('../../etc/passwd', '/project')
    expect(result.valid).toBe(false)
    expect(result.error).toContain('outside')
  })

  it('should reject dangerous extensions', () => {
    const result = validateFilePath('virus.exe', '/project')
    expect(result.valid).toBe(false)
  })
})

describe('validateJSON', () => {
  it('should validate good JSON', () => {
    const result = validateJSON('{"a": 1}')
    expect(result.valid).toBe(true)
    expect(result.parsed).toEqual({ a: 1 })
  })

  it('should reject bad JSON', () => {
    const result = validateJSON('{bad}')
    expect(result.valid).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('checkInjection', () => {
  it('should detect shell metacharacters', () => {
    const result = checkInjection('rm -rf /; echo pwned')
    expect(result.safe).toBe(false)
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('should detect path traversal', () => {
    const result = checkInjection('../../etc/passwd')
    expect(result.safe).toBe(false)
  })

  it('should accept safe input', () => {
    const result = checkInjection('fix the login bug')
    expect(result.safe).toBe(true)
  })

  it('should allow slash commands', () => {
    const result = checkInjection('/help')
    expect(result.safe).toBe(true)
  })
})

describe('sanitizeInput', () => {
  it('should remove null bytes', () => {
    expect(sanitizeInput('hello\0world')).toBe('helloworld')
  })

  it('should normalize line endings', () => {
    expect(sanitizeInput('a\r\nb')).toBe('a\nb')
  })

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello')
  })
})

// ── Init ──

const TEST_INIT_DIR = join(process.env.TEMP || '/tmp', 'dsxu-init-test-' + Date.now())

describe('initProject', () => {
  beforeEach(() => {
    mkdirSync(TEST_INIT_DIR, { recursive: true })
  })

  afterEach(() => {
    try { rmSync(TEST_INIT_DIR, { recursive: true, force: true }) } catch {}
  })

  it('should create .dsxu directory and config', () => {
    const result = initProject(TEST_INIT_DIR)
    expect(result.created).toContain('.dsxu/')
    expect(result.created).toContain('.dsxu/config.json')
    expect(existsSync(join(TEST_INIT_DIR, '.dsxu', 'config.json'))).toBe(true)
  })

  it('should create DSXU.md', () => {
    const result = initProject(TEST_INIT_DIR)
    expect(result.created).toContain('DSXU.md')
    expect(existsSync(join(TEST_INIT_DIR, 'DSXU.md'))).toBe(true)
  })

  it('should skip existing files', () => {
    initProject(TEST_INIT_DIR) // First run
    const result = initProject(TEST_INIT_DIR) // Second run
    expect(result.skipped.length).toBeGreaterThan(0)
    expect(result.created.length).toBe(0)
  })

  it('should force overwrite', () => {
    initProject(TEST_INIT_DIR) // First run
    const result = initProject(TEST_INIT_DIR, true)
    expect(result.created.length).toBeGreaterThan(0)
  })
})

// ── Plugin Manager ──

describe('PluginManager', () => {
  it('should register plugin', () => {
    const pm = new PluginManager()
    pm.register({
      manifest: { name: 'test-plugin', version: '1.0.0', description: 'Test' },
      activate: async () => {},
      deactivate: async () => {},
    })
    expect(pm.size).toBe(1)
  })

  it('should list plugins', () => {
    const pm = new PluginManager()
    pm.register({
      manifest: { name: 'a', version: '1.0', description: 'A' },
      activate: async () => {},
      deactivate: async () => {},
    })
    pm.register({
      manifest: { name: 'b', version: '2.0', description: 'B' },
      activate: async () => {},
      deactivate: async () => {},
    })
    expect(pm.list()).toHaveLength(2)
  })

  it('should activate/deactivate', async () => {
    let active = false
    const pm = new PluginManager()
    pm.register({
      manifest: { name: 'toggle', version: '1.0', description: 'Toggle' },
      activate: async () => { active = true },
      deactivate: async () => { active = false },
    })

    await pm.activate('toggle')
    expect(active).toBe(true)

    await pm.deactivate('toggle')
    expect(active).toBe(false)
  })

  it('should return false for unknown plugin', async () => {
    const pm = new PluginManager()
    expect(await pm.activate('nope')).toBe(false)
    expect(await pm.deactivate('nope')).toBe(false)
  })

  it('should get plugin by name', () => {
    const pm = new PluginManager()
    pm.register({
      manifest: { name: 'my-plugin', version: '1.0', description: 'Test' },
      activate: async () => {},
      deactivate: async () => {},
    })
    expect(pm.get('my-plugin')).toBeDefined()
    expect(pm.get('unknown')).toBeUndefined()
  })
})
