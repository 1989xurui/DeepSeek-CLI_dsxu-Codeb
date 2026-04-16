/**
 * DSxu 步骤级三档变速器（Step-Level GearBox）
 *
 * 与 proxy 的请求级变速器不同，这个在 Query Engine loop 内部运行，
 * 每个 tool result 都能触发升降档判定。
 *
 * 档位策略（Claude 策略版）：
 *   1档 chat：错误 1-3 次 → 留在 1 档自纠错
 *   2档 reasoner：错误 4+ 次 → chat 纠错×3 失败，升 reasoner
 *   3档 CoT-SC：错误 6+ 次 → reasoner 也搞不定
 *
 * S.1 测试驱动：测试结果优先级 > 文本错误匹配
 */

import type { GearState, StepGearBox, ToolResult } from './types'

const GEAR_TIMEOUT = 5 * 60 * 1000  // 5 分钟无新错误 → 重置
const TEST_HISTORY_SIZE = 5

export function createGearBox(): StepGearBox {
  const state: GearState = {
    gear: 1,
    consecutiveErrors: 0,
    lastErrorTs: 0,
    testHistory: [],
  }

  /** 检查是否应该重置（超时） */
  function checkTimeout(): void {
    if (state.lastErrorTs > 0 && (Date.now() - state.lastErrorTs > GEAR_TIMEOUT)) {
      state.consecutiveErrors = 0
      state.gear = 1
    }
  }

  /** 根据连续错误次数决定档位 */
  function updateGear(): void {
    if (state.consecutiveErrors >= 6 && state.gear < 3) {
      const from = state.gear
      state.gear = 3
      console.log(`[GearBox] ⚡ ${from}→3档 CoT-SC（连续失败 ${state.consecutiveErrors} 次）`)
    } else if (state.consecutiveErrors >= 4 && state.gear < 2) {
      state.gear = 2
      console.log(`[GearBox] ⚡ 1→2档 reasoner（chat 自纠错×3 失败）`)
    }
  }

  /** 检测 tool result 是否包含测试输出 */
  function detectTest(result: ToolResult, toolName: string): boolean | null {
    // 只检测 Bash 类工具的输出
    if (!['Bash', 'bash', 'shell', 'terminal'].includes(toolName)) return null

    const text = result.content
    const isTestOutput =
      /\d+ pass/i.test(text) ||
      /\d+ fail/i.test(text) ||
      /Tests?:\s+\d+/i.test(text) ||
      /PASS|FAIL/.test(text) ||
      /npm test|vitest|jest|pytest|bun test/i.test(text) ||
      /[✓✗●]/.test(text)

    if (!isTestOutput) return null

    const failPatterns = [
      /[1-9]\d* fail/i,  // "2 fail" 但不匹配 "0 fail"
      /FAIL\s/,           // "FAIL src/..." 但不匹配 "0 fail"
      /FAILED/i,
      /✗/,
      /exit code [1-9]/i,
      /AssertionError/i,
    ]
    return !failPatterns.some(p => p.test(text))
  }

  return {
    getGear() {
      checkTimeout()
      return state.gear
    },

    getModel() {
      checkTimeout()
      switch (state.gear) {
        case 1: return 'deepseek-chat'
        case 2: return 'deepseek-reasoner'
        case 3: return 'deepseek-reasoner'  // 3档投票逻辑在 loop 层处理
      }
    },

    reportToolResult(result: ToolResult, toolName: string) {
      // S.1: 测试驱动判定 — 物理证据优先
      const testPassed = detectTest(result, toolName)
      if (testPassed !== null) {
        this.reportTestResult(testPassed)
        return
      }

      // 非测试工具：检查是否有错误
      if (result.isError) {
        checkTimeout()
        state.consecutiveErrors++
        state.lastErrorTs = Date.now()
        updateGear()
        console.log(`[GearBox] 工具 ${toolName} 失败, 连续错误 ${state.consecutiveErrors}, 档位 ${state.gear}`)
      } else {
        // 工具成功但不降档（只有测试通过或 LLM 完成才降）
        // 避免"工具执行成功但结果是错的"误判
      }
    },

    reportTestResult(passed: boolean) {
      state.testHistory.push({ passed, ts: Date.now() })
      if (state.testHistory.length > TEST_HISTORY_SIZE) {
        state.testHistory.shift()
      }

      if (passed) {
        console.log(`[GearBox] 🟢 测试通过 → 降回 1 档`)
        state.consecutiveErrors = 0
        state.gear = 1
      } else {
        checkTimeout()
        state.consecutiveErrors++
        state.lastErrorTs = Date.now()
        updateGear()
        console.log(`[GearBox] 🔴 测试失败, 连续错误 ${state.consecutiveErrors}, 档位 ${state.gear}`)
      }
    },

    reportLLMError(error: Error) {
      checkTimeout()
      state.consecutiveErrors++
      state.lastErrorTs = Date.now()
      updateGear()
      console.log(`[GearBox] LLM 错误: ${error.message}, 连续 ${state.consecutiveErrors}, 档位 ${state.gear}`)
    },

    reportSuccess() {
      if (state.gear > 1) {
        console.log(`[GearBox] ✓ 成功，${state.gear}档 → 1档`)
      }
      state.consecutiveErrors = 0
      state.gear = 1
    },

    getState() {
      return { ...state, testHistory: [...state.testHistory] }
    },
  }
}
