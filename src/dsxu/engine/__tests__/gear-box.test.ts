import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGearBox } from '../gear-box'

describe('GearBox', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start at gear 1', () => {
    const gearBox = createGearBox()
    expect(gearBox.getGear()).toBe(1)
    expect(gearBox.getModel()).toBe('deepseek-chat')
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
    expect(gearBox.getModel()).toBe('deepseek-reasoner')
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
    expect(gearBox.getModel()).toBe('deepseek-reasoner') // 3档也是reasoner
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
      expect.stringContaining('测试失败')
    )

    // 模拟测试通过输出
    gearBox.reportToolResult({
      isError: false,
      content: 'Tests: 3 pass, 0 fail'
    }, 'Bash')

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('测试通过')
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
      expect.stringContaining('LLM 错误')
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
})