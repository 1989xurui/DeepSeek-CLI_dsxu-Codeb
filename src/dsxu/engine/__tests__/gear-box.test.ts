import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGearBox } from '../gear-box'
import { DEEPSEEK_V4_FLASH_MODEL, DEEPSEEK_V4_PRO_MODEL } from '../../../utils/model/deepseekV4Control'

describe('GearBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should start at gear 1', () => {
    const gearBox = createGearBox()
    expect(gearBox.getGear()).toBe(1)
    expect(gearBox.getModel()).toBe(DEEPSEEK_V4_FLASH_MODEL)
  })

  it('should upgrade to gear 2 after 4 consecutive errors', () => {
    const gearBox = createGearBox()

    // 模拟3次错误 - 应该保持在1档
    for (let i = 0; i < 3; i++) {
      gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    }
    expect(gearBox.getGear()).toBe(1)

    // 第4次错误 - 应该升到2档
    gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    expect(gearBox.getGear()).toBe(2)
    expect(gearBox.getModel()).toBe(DEEPSEEK_V4_PRO_MODEL)
  })

  it('should upgrade to gear 3 after 6 consecutive errors', () => {
    const gearBox = createGearBox()

    // 模拟5次错误 - 应该升到2档
    for (let i = 0; i < 5; i++) {
      gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    }
    expect(gearBox.getGear()).toBe(2)

    // 第6次错误 - 应该升到3档
    gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    expect(gearBox.getGear()).toBe(3)
    expect(gearBox.getModel()).toBe(DEEPSEEK_V4_PRO_MODEL)
  })

  it('should reset to gear 1 when test passes', () => {
    const gearBox = createGearBox()

    // 升到2档
    for (let i = 0; i < 4; i++) {
      gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    }
    expect(gearBox.getGear()).toBe(2)

    // 测试通过 - 应该降回1档
    gearBox.reportTestResult(true)
    expect(gearBox.getGear()).toBe(1)
  })

  it('should detect test output from Bash tools', () => {
    const gearBox = createGearBox()
    const consoleSpy = vi.spyOn(console, 'log')

    // 模拟测试失败输出
    gearBox.reportToolResult({
      isError: false,
      content: 'Tests: 2 pass, 1 fail'
    }, 'Bash')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test failed')
    )

    // 模拟测试通过输出
    gearBox.reportToolResult({
      isError: false,
      content: 'Tests: 3 pass, 0 fail'
    }, 'Bash')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('test passed')
    )
  })

  it('should reset after timeout', () => {
    const gearBox = createGearBox()

    // 升到2档
    for (let i = 0; i < 4; i++) {
      gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    }
    expect(gearBox.getGear()).toBe(2)

    // 前进5分钟 + 1秒（超过超时时间）
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000)

    // 应该重置到1档
    expect(gearBox.getGear()).toBe(1)
  })

  it('should report LLM errors', () => {
    const gearBox = createGearBox()
    const consoleSpy = vi.spyOn(console, 'log')

    gearBox.reportLLMError(new Error('LLM timeout'), 'call-123')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('LLM error')
    )
    expect(gearBox.getGear()).toBe(1) // 1次错误不会升档
  })

  it('should report success and reset', () => {
    const gearBox = createGearBox()

    // 升到2档
    for (let i = 0; i < 4; i++) {
      gearBox.reportToolResult({ isError: true, content: 'error' }, 'Bash')
    }
    expect(gearBox.getGear()).toBe(2)

    // 报告成功 - 应该重置
    gearBox.reportSuccess()
    expect(gearBox.getGear()).toBe(1)
  })

  it('should maintain test history', () => {
    const gearBox = createGearBox()

    // 添加一些测试结果
    gearBox.reportTestResult(true)
    gearBox.reportTestResult(false)
    gearBox.reportTestResult(true)

    const state = gearBox.getState()
    expect(state.testHistory).toHaveLength(3)
    expect(state.testHistory[0].passed).toBe(true)
    expect(state.testHistory[1].passed).toBe(false)
    expect(state.testHistory[2].passed).toBe(true)
  })

  it('should limit test history size', () => {
    const gearBox = createGearBox()

    // 添加超过限制的测试结果
    for (let i = 0; i < 10; i++) {
      gearBox.reportTestResult(true)
    }

    const state = gearBox.getState()
    expect(state.testHistory).toHaveLength(5) // TEST_HISTORY_SIZE = 5
  })

  it('should consume VerifyGate summaries through GearBox without a recovery bridge', () => {
    const gearBox = createGearBox()

    const decision = gearBox.reportVerificationSummary(
      {
        passed: false,
        score: 0,
        findings: [
          {
            severity: 'P1',
            title: 'Verification evidence is missing',
            detail: 'File mutation happened, but no native verification command was recorded.',
          },
        ],
      },
      {
        policy: 'block',
        failedAttemptsSinceProgress: 2,
        command: 'bun test src/example.test.ts',
      },
    )

    expect(decision).toMatchObject({
      action: 'replan',
      reason: 'verify-failure',
      metadata: {
        missingEvidence: true,
        command: 'bun test src/example.test.ts',
        sourceRecoveryDecisionTable: true,
      },
    })
    expect(decision?.metadata?.stallDecision).toMatchObject({
      schemaVersion: 'dsxu.stall-recovery-decision.v1',
      owner: 'Recovery / GearBox',
      reason: 'repeated_verification_failure',
      action: 'replan',
    })
    expect(gearBox.getState().lastRecoveryDecision).toBe(decision)
    expect(gearBox.getGear()).toBeGreaterThanOrEqual(2)

    const passDecision = gearBox.reportVerificationSummary({
      passed: true,
      score: 100,
      findings: [],
    })

    expect(passDecision).toBeNull()
    expect(gearBox.getState().lastRecoveryDecision).toBeUndefined()
    expect(gearBox.getGear()).toBe(1)
  })
})
