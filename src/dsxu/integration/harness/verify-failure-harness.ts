/**
 * Verify Failure Harness 测试
 * 验证 verify-gate 和 verify-review-chain 的失败捕获
 */

import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Verify Failure Harness', () => {
  beforeEach(() => {
    // 清空默认实例的记录
    const bugBrain = defaultBugBrain as any
    bugBrain.records.clear()
    bugBrain.patterns.clear()
    bugBrain.fixPatterns.clear()
  })

  test('应该捕获 verify-gate 代码格式验证失败', () => {
    const bug = bugBrainHooks.verifyGate.recordVerifyFailure(
      '代码缩进不符合规范',
      {
        code: 'function test() {\nconsole.log("hello")\n}',
        filePath: '/src/test.js',
        rule: 'indent',
        error: new Error('Expected indentation of 2 spaces but found 0')
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('verify-failure')
    expect(bug.source).toBe('verify-gate')
    expect(bug.severity).toBe('medium')
    expect(bug.context.codeSnippet).toContain('function test()')
    expect(bug.context.filePath).toBe('/src/test.js')
    expect(bug.context.errorStack).toContain('Expected indentation')
  })

  test('应该捕获 verify-review-chain 审核失败', () => {
    const bug = bugBrainHooks.verifyReviewChain.recordReviewFailure(
      '代码质量审核未通过',
      {
        reviewStage: 'final',
        reviewerType: 'expert',
        feedback: '代码复杂度过高，需要重构',
        error: new Error('Review score below threshold: 0.6 < 0.8')
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('reviewer-rejection')
    expect(bug.source).toBe('verify-review-chain')
    expect(bug.severity).toBe('medium')
    expect(bug.context.environment?.reviewStage).toBe('final')
    expect(bug.context.userInput).toBe('代码复杂度过高，需要重构')
  })

  test('重复验证失败应该生成模式', () => {
    // 记录多个验证失败
    bugBrainHooks.verifyGate.recordVerifyFailure('格式错误1', { code: 'test1' })
    bugBrainHooks.verifyGate.recordVerifyFailure('格式错误2', { code: 'test2' })
    bugBrainHooks.verifyGate.recordVerifyFailure('格式错误3', { code: 'test3' })

    const patterns = defaultBugBrain.getPatterns()
    expect(patterns.length).toBeGreaterThan(0)

    const verifyPattern = patterns.find(p => p.bugType === 'verify-failure')
    expect(verifyPattern).toBeDefined()
    expect(verifyPattern?.commonSymptoms.length).toBeGreaterThan(0)
    expect(verifyPattern?.frequency).toBe(3)
  })
})