/**
 * Wave 5 Doctor + Auth 测试
 * #7.5 + #7.7 + #7.8
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  checkCommand, checkApiKey, checkProjectConfig, checkNodeVersion,
  runDoctor, formatDoctorReport, getVersionInfo, validateApiKey, getAuth,
} from '../doctor'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-doctor-test-' + Date.now())

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

describe('checkCommand', () => {
  it('should pass for git', () => {
    const result = checkCommand('git')
    expect(result.status).toBe('pass')
    expect(result.message).toContain('git')
  })

  it('should pass for node', () => {
    const result = checkCommand('node')
    expect(result.status).toBe('pass')
  })

  it('should fail for nonexistent command', () => {
    const result = checkCommand('nonexistent_cmd_xyz_12345')
    expect(result.status).toBe('fail')
  })
})

describe('checkApiKey', () => {
  it('should detect set API key', () => {
    const orig = process.env.DEEPSEEK_API_KEY
    process.env.DEEPSEEK_API_KEY = 'sk-test1234567890abcdef'
    const result = checkApiKey('DEEPSEEK_API_KEY', 'DeepSeek')
    expect(result.status).toBe('pass')
    expect(result.message).toContain('sk-t')
    if (orig !== undefined) process.env.DEEPSEEK_API_KEY = orig
    else delete process.env.DEEPSEEK_API_KEY
  })

  it('should fail for missing API key', () => {
    const result = checkApiKey('NONEXISTENT_KEY_XYZ', 'Test')
    expect(result.status).toBe('fail')
  })
})

describe('checkProjectConfig', () => {
  it('should pass when config exists', () => {
    mkdirSync(join(TEST_DIR, '.dsxu'), { recursive: true })
    writeFileSync(join(TEST_DIR, '.dsxu', 'config.json'), '{}')
    const result = checkProjectConfig(TEST_DIR)
    expect(result.status).toBe('pass')
  })

  it('should pass for DSXU.md', () => {
    writeFileSync(join(TEST_DIR, 'DSXU.md'), '# Rules')
    const result = checkProjectConfig(TEST_DIR)
    expect(result.status).toBe('pass')
  })

  it('should warn when no config', () => {
    const result = checkProjectConfig(TEST_DIR)
    expect(result.status).toBe('warn')
  })
})

describe('checkNodeVersion', () => {
  it('should pass for current Node', () => {
    const result = checkNodeVersion()
    expect(result.status).toBe('pass')
    expect(result.message).toContain('v')
  })
})

describe('runDoctor', () => {
  it('should run all checks', async () => {
    const report = await runDoctor(TEST_DIR)
    expect(report.checks.length).toBeGreaterThan(0)
    expect(report.passCount + report.failCount + report.warnCount).toBe(report.checks.length)
  })
})

describe('formatDoctorReport', () => {
  it('should format report', async () => {
    const report = await runDoctor(TEST_DIR)
    const formatted = formatDoctorReport(report)
    expect(formatted).toContain('Health Check')
    expect(formatted).toContain('passed')
  })
})

describe('getVersionInfo', () => {
  it('should return version string', () => {
    const info = getVersionInfo()
    expect(info).toContain('DSxu')
    expect(info).toContain('Node')
  })
})

describe('validateApiKey', () => {
  it('should validate DeepSeek key format', () => {
    expect(validateApiKey('sk-abcdefghijklmnopqrst', 'deepseek')).toBe(true)
    expect(validateApiKey('short', 'deepseek')).toBe(false)
    expect(validateApiKey('', 'deepseek')).toBe(false)
  })

  it('should validate OpenAI key format', () => {
    expect(validateApiKey('sk-abcdefghijklmnopqrst', 'openai')).toBe(true)
    expect(validateApiKey('invalid', 'openai')).toBe(false)
  })
})

describe('getAuth', () => {
  it('should read from env vars', () => {
    const auth = getAuth()
    // Just verify it returns an object
    expect(auth).toHaveProperty('deepseekApiKey')
    expect(auth).toHaveProperty('openaiApiKey')
  })
})
