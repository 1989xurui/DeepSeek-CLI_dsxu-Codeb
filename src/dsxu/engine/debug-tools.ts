/**
 * #5.2 插桩优先调试 (Log-Injection First) + #5.3 HDD 假设探针
 *
 * 面对模糊 Bug 的两阶段策略：
 *
 *
 *   1. 在可疑函数插入 console.log
 *   2. 重跑触发错误
 *   3. 分析 Trace → 定位根因
 *   4. 修复后自动清理插桩代码
 *
 *
 *   1. 基于错误+堆栈，生成 3 个假设
 *   2. 每个假设配一个精确探针（命令/检查）
 *   3. 按 confidence 排序执行
 *   4. 命中 → 修复；全未命中 → HITL
 *
 * 这两个作为工具注册到 ToolRegistry，LLM 自动选择使用。
 */

import type { ToolDefinition, ToolContext, ToolOutput } from './types'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, relative } from 'path'
import { spawnSync } from 'child_process'

// ── #5.2 插桩调试工具 ──

interface InstrumentationPoint {
  file: string
  line: number
  originalLine: string
  instrumentedLine: string
  id: string
}

// 全局追踪所有插桩点（用于清理）
const activeInstrumentations: InstrumentationPoint[] = []

export const InjectDebugLoggerTool: ToolDefinition = {
  name: 'InjectDebugLogger',
  description: `Instrument suspicious functions with debug logging. Inserts console.log statements at function entry/exit to trace execution flow. Use when facing vague errors without clear stack traces. Remember to call CleanupDebugLogger after debugging.`,
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string', description: 'File to instrument' },
      function_names: {
        type: 'array',
        items: { type: 'string' },
        description: 'Function names to instrument (e.g., ["handleRequest", "validateInput"])',
      },
      line_numbers: {
        type: 'array',
        items: { type: 'number' },
        description: 'Specific line numbers to add logging after (alternative to function_names)',
      },
    },
    required: ['file_path'],
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (input, ctx) => {
    const filePath = resolve(ctx.cwd, input.file_path as string)
    const funcNames = (input.function_names as string[]) || []
    const lineNums = (input.line_numbers as number[]) || []

    if (!existsSync(filePath)) {
      return { content: `File not found: ${filePath}`, isError: true }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const newInstrumentations: InstrumentationPoint[] = []
      let modified = false

      // Strategy 1: Instrument by function name
      for (const funcName of funcNames) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          // Match function/method declarations
          const funcPattern = new RegExp(`(function\\s+${funcName}|${funcName}\\s*[=(]|${funcName}\\s*:\\s*(async\\s+)?function)`)
          if (funcPattern.test(line)) {
            // Find the opening brace
            let braceIdx = i
            while (braceIdx < lines.length && !lines[braceIdx].includes('{')) braceIdx++
            if (braceIdx < lines.length) {
              const id = `__dsxu_debug_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`
              const logLine = `  console.log('[DSXU_DEBUG:${id}] ENTER ${funcName}', { args: typeof arguments !== 'undefined' ? [...arguments].map(a => typeof a === 'object' ? JSON.stringify(a).slice(0,200) : a) : [] });`

              // Insert after the opening brace
              lines.splice(braceIdx + 1, 0, logLine)
              newInstrumentations.push({
                file: filePath,
                line: braceIdx + 2,
                originalLine: '',
                instrumentedLine: logLine,
                id,
              })
              modified = true
            }
          }
        }
      }

      // Strategy 2: Instrument by line number
      for (const lineNum of lineNums.sort((a, b) => b - a)) {  // Reverse to preserve indices
        if (lineNum < 1 || lineNum > lines.length) continue
        const id = `__dsxu_debug_${Date.now()}_${Math.random().toString(36).slice(2, 4)}`
        const originalLine = lines[lineNum - 1]
        const indent = originalLine.match(/^(\s*)/)?.[1] || ''
        const logLine = `${indent}console.log('[DSXU_DEBUG:${id}] L${lineNum}', { line: ${lineNum} }); // ${id}`

        lines.splice(lineNum, 0, logLine)
        newInstrumentations.push({
          file: filePath,
          line: lineNum + 1,
          originalLine,
          instrumentedLine: logLine,
          id,
        })
        modified = true
      }

      if (!modified) {
        return {
          content: `No instrumentation points found. Try specifying function_names or line_numbers.`,
        }
      }

      // Write modified file
      writeFileSync(filePath, lines.join('\n'), 'utf-8')
      activeInstrumentations.push(...newInstrumentations)

      const summary = newInstrumentations.map(p =>
        `  📍 ${relative(ctx.cwd, p.file)}:${p.line} [${p.id}]`
      ).join('\n')

      return {
        content: `Instrumented ${newInstrumentations.length} points:\n${summary}\n\nNow re-run the failing operation to capture trace output. Look for [DSXU_DEBUG:...] in the output.\n⚠️ Remember to call CleanupDebugLogger when done!`,
        meta: { points: newInstrumentations.length },
      }
    } catch (error: any) {
      return { content: `Instrumentation error: ${error.message}`, isError: true }
    }
  },
}

export const CleanupDebugLoggerTool: ToolDefinition = {
  name: 'CleanupDebugLogger',
  description: 'Remove all debug instrumentation inserted by InjectDebugLogger. Call this after debugging is complete.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  concurrencySafe: false,
  readOnly: false,
  execute: async (_input, ctx) => {
    if (activeInstrumentations.length === 0) {
      return { content: 'No active instrumentations to clean up.' }
    }

    // Group by file
    const byFile = new Map<string, InstrumentationPoint[]>()
    for (const p of activeInstrumentations) {
      const existing = byFile.get(p.file) || []
      existing.push(p)
      byFile.set(p.file, existing)
    }

    let cleaned = 0
    for (const [filePath, points] of byFile) {
      try {
        let content = readFileSync(filePath, 'utf-8')

        // Remove lines containing our debug markers
        for (const p of points) {
          content = content.split('\n').filter(line => !line.includes(p.id)).join('\n')
          cleaned++
        }

        writeFileSync(filePath, content, 'utf-8')
      } catch (error: any) {
        console.warn(`[DebugLogger] Cleanup failed for ${filePath}: ${error.message}`)
      }
    }

    activeInstrumentations.length = 0  // Clear all

    return {
      content: `Cleaned up ${cleaned} instrumentation points across ${byFile.size} file(s).`,
      meta: { cleaned },
    }
  },
}

/** 获取活跃插桩数 */
export function getActiveInstrumentationCount(): number {
  return activeInstrumentations.length
}

/** 重置（测试用） */
export function resetInstrumentations(): void {
  activeInstrumentations.length = 0
}

// ── #5.3 HDD 假设探针工具 ──

export interface Hypothesis {
  id: number
  description: string
  confidence: number
  probe: string  // 验证命令
  expected: string  // 预期输出模式
}

export const HypothesisDebugTool: ToolDefinition = {
  name: 'HypothesisDebug',
  description: `Hypothesis-Driven Debugging: Generate and test 3 hypotheses about a bug's root cause. Each hypothesis has a probe command to verify it. Use when you have error + stack trace but the cause spans 3+ files.`,
  inputSchema: {
    type: 'object',
    properties: {
      error_message: { type: 'string', description: 'The error message or stack trace' },
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string', description: 'What might be causing the error' },
            confidence: { type: 'number', description: 'Confidence 0-1' },
            probe: { type: 'string', description: 'Bash command to test this hypothesis' },
            expected: { type: 'string', description: 'What to look for in probe output to confirm' },
          },
          required: ['description', 'probe', 'expected'],
        },
        description: '3 hypotheses sorted by confidence (highest first)',
      },
    },
    required: ['error_message', 'hypotheses'],
  },
  concurrencySafe: false,
  readOnly: true,
  execute: async (input, ctx) => {
    const errorMessage = input.error_message as string
    const hypotheses = (input.hypotheses as any[]) || []

    if (hypotheses.length === 0) {
      return { content: 'No hypotheses provided.', isError: true }
    }

    // Sort by confidence
    const sorted = [...hypotheses]
      .map((h, i) => ({ ...h, id: i + 1, confidence: h.confidence ?? 0.5 }))
      .sort((a, b) => b.confidence - a.confidence)

    const results: string[] = []
    let hitHypothesis: any = null

    for (const hyp of sorted) {
      results.push(`\n### Hypothesis ${hyp.id} (confidence: ${(hyp.confidence * 100).toFixed(0)}%)`)
      results.push(`**Theory**: ${hyp.description}`)
      results.push(`**Probe**: \`${hyp.probe}\``)

      // Execute probe
      try {
        const probeResult = spawnSync('bash', ['-c', hyp.probe], {
          cwd: ctx.cwd,
          timeout: 30_000,
          encoding: 'utf-8',
          maxBuffer: 1024 * 1024,
        })

        const output = ((probeResult.stdout || '') + '\n' + (probeResult.stderr || '')).trim()
        const exitCode = probeResult.status ?? -1

        results.push(`**Output** (exit ${exitCode}):`)
        results.push('```')
        results.push(output.slice(0, 2000))
        results.push('```')

        // Check if expected pattern matches
        const expectedPattern = hyp.expected as string
        const matched = output.toLowerCase().includes(expectedPattern.toLowerCase()) ||
                       new RegExp(expectedPattern, 'i').test(output)

        if (matched) {
          results.push(`✅ **HIT** — Probe output matches expected pattern: "${expectedPattern}"`)
          hitHypothesis = hyp
          break  // Stop at first hit
        } else {
          results.push(`❌ **MISS** — Expected "${expectedPattern}" not found in output`)
        }
      } catch (error: any) {
        results.push(`⚠️ Probe execution failed: ${error.message}`)
      }
    }

    // Summary
    results.push('\n---')
    if (hitHypothesis) {
      results.push(`\n## 🎯 Root Cause Identified`)
      results.push(`Hypothesis ${hitHypothesis.id} confirmed: ${hitHypothesis.description}`)
      results.push(`\nProceed to fix based on this diagnosis.`)
    } else {
      results.push(`\n## ❓ No Hypothesis Confirmed`)
      results.push(`All ${sorted.length} hypotheses were tested but none matched.`)
      results.push(`Consider: (1) revisiting assumptions, (2) using InjectDebugLogger for more data, (3) escalating to human review.`)
    }

    return {
      content: `# Hypothesis-Driven Debug Results\n\n**Error**: ${errorMessage.slice(0, 500)}\n${results.join('\n')}`,
      meta: {
        hit: hitHypothesis ? hitHypothesis.id : null,
        tested: sorted.length,
      },
    }
  },
}

// ── 深水区工具注册 ──

/** 获取深水区调试工具 */
export function getDebugTools(): ToolDefinition[] {
  return [InjectDebugLoggerTool, CleanupDebugLoggerTool, HypothesisDebugTool]
}
