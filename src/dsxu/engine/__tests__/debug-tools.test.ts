/**
 * 深水区调试工具测试
 * #5.2 InjectDebugLogger + CleanupDebugLogger
 * #5.3 HypothesisDebug
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  InjectDebugLoggerTool,
  CleanupDebugLoggerTool,
  HypothesisDebugTool,
  getDebugTools,
  getActiveInstrumentationCount,
  resetInstrumentations,
} from '../debug-tools'
import type { ToolContext } from '../types'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'

const TEST_DIR = join(process.env.TEMP || '/tmp', 'dsxu-debug-test-' + Date.now())
const ctx: ToolContext = { cwd: TEST_DIR, sessionId: 'test', gear: 1 }

beforeEach(() => {
  mkdirSync(TEST_DIR, { recursive: true })
  resetInstrumentations()
})

afterEach(() => {
  try { rmSync(TEST_DIR, { recursive: true, force: true }) } catch {}
})

// ── InjectDebugLogger ──

describe('InjectDebugLoggerTool', () => {
  it('should instrument function by name', async () => {
    const filePath = join(TEST_DIR, 'app.ts')
    writeFileSync(filePath, `function handleRequest(req) {
  const data = parse(req)
  return respond(data)
}`)

    const result = await InjectDebugLoggerTool.execute({
      file_path: 'app.ts',
      function_names: ['handleRequest'],
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Instrumented 1 points')
    expect(result.content).toContain('DSXU_DEBUG')

    const modified = readFileSync(filePath, 'utf-8')
    expect(modified).toContain('DSXU_DEBUG')
    expect(modified).toContain('ENTER handleRequest')
    expect(getActiveInstrumentationCount()).toBe(1)
  })

  it('should instrument by line number', async () => {
    const filePath = join(TEST_DIR, 'app.ts')
    writeFileSync(filePath, `const x = 1
const y = 2
const z = x + y
console.log(z)`)

    const result = await InjectDebugLoggerTool.execute({
      file_path: 'app.ts',
      line_numbers: [2, 3],
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Instrumented 2 points')
    expect(getActiveInstrumentationCount()).toBe(2)
  })

  it('should handle file not found', async () => {
    const result = await InjectDebugLoggerTool.execute({
      file_path: 'nonexistent.ts',
      function_names: ['foo'],
    }, ctx)

    expect(result.isError).toBe(true)
    expect(result.content).toContain('not found')
  })

  it('should handle no match', async () => {
    const filePath = join(TEST_DIR, 'empty.ts')
    writeFileSync(filePath, 'const x = 1\n')

    const result = await InjectDebugLoggerTool.execute({
      file_path: 'empty.ts',
      function_names: ['nonexistentFunction'],
    }, ctx)

    expect(result.content).toContain('No instrumentation points')
  })
})

// ── CleanupDebugLogger ──

describe('CleanupDebugLoggerTool', () => {
  it('should clean up all instrumentations', async () => {
    const filePath = join(TEST_DIR, 'app.ts')
    writeFileSync(filePath, `function foo() {
  return 1
}`)

    // Instrument first
    await InjectDebugLoggerTool.execute({
      file_path: 'app.ts',
      function_names: ['foo'],
    }, ctx)

    expect(getActiveInstrumentationCount()).toBe(1)

    // Cleanup
    const result = await CleanupDebugLoggerTool.execute({}, ctx)
    expect(result.content).toContain('Cleaned up 1')
    expect(getActiveInstrumentationCount()).toBe(0)

    // Verify file is clean
    const cleaned = readFileSync(filePath, 'utf-8')
    expect(cleaned).not.toContain('DSXU_DEBUG')
  })

  it('should handle nothing to clean', async () => {
    const result = await CleanupDebugLoggerTool.execute({}, ctx)
    expect(result.content).toContain('No active instrumentations')
  })
})

// ── HypothesisDebug ──

describe('HypothesisDebugTool', () => {
  it('should execute probes and detect hit', async () => {
    const result = await HypothesisDebugTool.execute({
      error_message: 'TypeError: Cannot read property x of undefined',
      hypotheses: [
        {
          description: 'Variable x is not initialized',
          confidence: 0.8,
          probe: 'echo "undefined variable x found"',
          expected: 'undefined variable',
        },
        {
          description: 'Wrong import path',
          confidence: 0.5,
          probe: 'echo "imports look fine"',
          expected: 'wrong import',
        },
      ],
    }, ctx)

    expect(result.isError).toBeFalsy()
    expect(result.content).toContain('Root Cause Identified')
    expect(result.content).toContain('HIT')
    expect(result.meta?.hit).toBe(1)
  })

  it('should report all misses', async () => {
    const result = await HypothesisDebugTool.execute({
      error_message: 'Mystery error',
      hypotheses: [
        {
          description: 'Hypothesis A',
          confidence: 0.6,
          probe: 'echo "nothing here"',
          expected: 'specific_pattern_xyz',
        },
        {
          description: 'Hypothesis B',
          confidence: 0.4,
          probe: 'echo "also nothing"',
          expected: 'another_specific_thing',
        },
      ],
    }, ctx)

    expect(result.content).toContain('No Hypothesis Confirmed')
    expect(result.content).toContain('MISS')
    expect(result.meta?.hit).toBeNull()
    expect(result.meta?.tested).toBe(2)
  })

  it('should sort by confidence', async () => {
    const result = await HypothesisDebugTool.execute({
      error_message: 'Error',
      hypotheses: [
        { description: 'Low', confidence: 0.2, probe: 'echo low', expected: 'xxx' },
        { description: 'High', confidence: 0.9, probe: 'echo "high match"', expected: 'high match' },
      ],
    }, ctx)

    // High confidence should be tested first and hit
    expect(result.content).toContain('HIT')
    expect(result.meta?.hit).toBeDefined()
  })

  it('should handle empty hypotheses', async () => {
    const result = await HypothesisDebugTool.execute({
      error_message: 'Error',
      hypotheses: [],
    }, ctx)

    expect(result.isError).toBe(true)
  })
})

// ── Collection ──

describe('getDebugTools', () => {
  it('should return 3 debug tools', () => {
    const tools = getDebugTools()
    expect(tools).toHaveLength(3)
    expect(tools.map(t => t.name)).toEqual(['InjectDebugLogger', 'CleanupDebugLogger', 'HypothesisDebug'])
  })
})
