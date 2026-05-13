/**
 * Review Failure Harness 测试
 * 验证 reviewer-subagent 的失败捕获和分类
 */

import { bugBrainHooks } from '../../../dsxu/engine/bug-brain/integration'
import { defaultBugBrain } from '../../../dsxu/engine/bug-brain/index'

describe('Review Failure Harness', () => {
  beforeEach(() => {
    // 清空默认实例的记录
    const bugBrain = defaultBugBrain as any
    bugBrain.records.clear()
    bugBrain.patterns.clear()
    bugBrain.fixPatterns.clear()
  })

  test('应该捕获 reviewer-subagent 代码质量拒绝', () => {
    const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
      '代码可读性不足',
      {
        subagentType: 'code-quality',
        criteria: ['readability', 'maintainability', 'complexity'],
        score: 0.65,
        threshold: 0.8,
        error: new Error('Score 0.65 < threshold 0.8')
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('reviewer-rejection')
    expect(bug.source).toBe('reviewer-subagent')
    expect(bug.severity).toBe('low')
    expect(bug.context.environment?.subagentType).toBe('code-quality')
    expect(bug.context.environment?.score).toBe(0.65)
  })

  test('应该捕获 reviewer-subagent 测试覆盖率拒绝', () => {
    const bug = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
      '测试覆盖率不足',
      {
        subagentType: 'test-coverage',
        criteria: ['unit-test', 'integration-test', 'edge-cases'],
        score: 0.7,
        threshold: 0.9,
      }
    )

    expect(bug).toBeDefined()
    expect(bug.type).toBe('reviewer-rejection')
    expect(bug.context.environment?.subagentType).toBe('test-coverage')
  })

  test('应该为相似审核拒绝提供分析', () => {
    const bug1 = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
      '拒绝1',
      { subagentType: 'code-quality' }
    )
    const bug2 = bugBrainHooks.reviewerSubagent.recordReviewerRejection(
      '拒绝2',
      { subagentType: 'code-quality' }
    )

    const analysis = defaultBugBrain.analyzeBug(bug1.id)
    expect(analysis).toBeDefined()
    expect(analysis?.similarBugs?.length).toBe(1)
    expect(analysis?.similarBugs?.[0].id).toBe(bug2.id)
  })

  test('重复审核拒绝应该生成修复模式', () => {
    // 记录多个审核拒绝
    bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝1', {})
    bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝2', {})
    bugBrainHooks.reviewerSubagent.recordReviewerRejection('拒绝3', {})

    const patterns = defaultBugBrain.getPatterns()
    expect(patterns.length).toBeGreaterThan(0)

    const fixPatterns = defaultBugBrain.getFixPatterns()
    expect(fixPatterns.length).toBeGreaterThan(0)

    const fixPattern = fixPatterns[0]
    expect(fixPattern.steps.length).toBeGreaterThan(0)
    expect(fixPattern.prerequisites.length).toBeGreaterThan(0)
  })
})