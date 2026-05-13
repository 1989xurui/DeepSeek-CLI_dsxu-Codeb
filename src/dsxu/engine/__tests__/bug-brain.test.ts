/**
 * Bug Brain 核心功能测试
 */

import { BugBrain } from '../bug-brain'
import { BugCategory, BugSeverity, BugSource } from '../bug-brain/types'

describe('BugBrain', () => {
  let bugBrain: BugBrain

  beforeEach(() => {
    bugBrain = new BugBrain({
      debug: false,
      autoClassify: true,
      patternDetectionThreshold: 2,
    })
  })

  describe('基础功能', () => {
    test('应该能够记录bug', () => {
      const bug = bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '验证失败：代码格式不符合规范',
        {
          codeSnippet: 'const x = 1',
          filePath: '/test/file.ts',
        }
      )

      expect(bug).toBeDefined()
      expect(bug.id).toBeDefined()
      expect(bug.type).toBe('verify-failure')
      expect(bug.severity).toBe('medium')
      expect(bug.source).toBe('verify-gate')
      expect(bug.description).toBe('验证失败：代码格式不符合规范')
      expect(bug.timestamp).toBeGreaterThan(0)
    })

    test('应该能够获取记录的bug', () => {
      const bug = bugBrain.recordBug(
        'tool-failure',
        'high',
        'tool-execution',
        '工具执行超时',
        {
          errorStack: 'TimeoutError: 执行超时',
        }
      )

      const retrieved = bugBrain.getBug(bug.id)
      expect(retrieved).toEqual(bug)
    })

    test('应该返回所有bug', () => {
      bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '验证失败1',
        {}
      )
      bugBrain.recordBug(
        'reviewer-rejection',
        'low',
        'reviewer-subagent',
        '审核拒绝1',
        {}
      )

      const allBugs = bugBrain.getAllBugs()
      expect(allBugs).toHaveLength(2)
    })
  })

  describe('自动分类', () => {
    test('应该自动分类包含verify关键词的bug', () => {
      const bug = bugBrain.recordBug(
        'other',
        'medium',
        'unknown',
        'verify检查失败，代码不符合规范',
        {}
      )

      expect(bug.type).toBe('verify-failure')
    })

    test('应该自动分类包含review关键词的bug', () => {
      const bug = bugBrain.recordBug(
        'other',
        'low',
        'unknown',
        'reviewer拒绝了修改',
        {}
      )

      expect(bug.type).toBe('reviewer-rejection')
    })

    test('应该自动分类包含tool关键词的bug', () => {
      const bug = bugBrain.recordBug(
        'other',
        'high',
        'unknown',
        'tool执行失败',
        {}
      )

      expect(bug.type).toBe('tool-failure')
    })

    test('应该自动分类包含context关键词的bug', () => {
      const bug = bugBrain.recordBug(
        'other',
        'medium',
        'unknown',
        'context信息不足',
        {}
      )

      expect(bug.type).toBe('context-insufficiency')
    })
  })

  describe('模式检测', () => {
    test('应该检测重复出现的bug模式', () => {
      // 记录多个相同类型的bug
      bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '验证失败：代码格式错误',
        {}
      )
      bugBrain.recordBug(
        'verify-failure',
        'high',
        'verify-gate',
        '验证失败：缺少必要注释',
        {}
      )
      bugBrain.recordBug(
        'verify-failure',
        'low',
        'verify-review-chain',
        '验证失败：命名不规范',
        {}
      )

      const patterns = bugBrain.getPatterns()
      expect(patterns).toHaveLength(1)

      const pattern = patterns[0]
      expect(pattern.bugType).toBe('verify-failure')
      expect(pattern.frequency).toBe(3)
      expect(pattern.commonSymptoms.length).toBeGreaterThan(0)
    })

    test('应该为模式生成修复模式', () => {
      bugBrain.recordBug(
        'tool-failure',
        'high',
        'tool-execution',
        '工具执行失败',
        {}
      )
      bugBrain.recordBug(
        'tool-failure',
        'medium',
        'tool-execution',
        '工具执行错误',
        {}
      )
      bugBrain.recordBug(
        'tool-failure',
        'low',
        'tool-execution',
        '工具执行问题',
        {}
      )

      const fixPatterns = bugBrain.getFixPatterns()
      expect(fixPatterns.length).toBeGreaterThan(0)

      const fixPattern = fixPatterns[0]
      expect(fixPattern.bugPatternId).toBeDefined()
      expect(fixPattern.steps).toBeDefined()
      expect(fixPattern.steps.length).toBeGreaterThan(0)
    })
  })

  describe('Bug分析', () => {
    test('应该能够分析bug并提供建议', () => {
      const bug = bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '验证失败',
        {}
      )

      const analysis = bugBrain.analyzeBug(bug.id)
      expect(analysis).toBeDefined()
      expect(analysis?.bugRecord).toEqual(bug)
      expect(analysis?.confidence).toBeGreaterThan(0)
    })

    test('应该为相似bug提供分析', () => {
      const bug1 = bugBrain.recordBug(
        'reviewer-rejection',
        'low',
        'reviewer-subagent',
        '审核拒绝：代码质量不足',
        {}
      )
      const bug2 = bugBrain.recordBug(
        'reviewer-rejection',
        'medium',
        'reviewer-subagent',
        '审核拒绝：测试覆盖率低',
        {}
      )

      const analysis = bugBrain.analyzeBug(bug1.id)
      expect(analysis?.similarBugs).toHaveLength(1)
      expect(analysis?.similarBugs?.[0].id).toBe(bug2.id)
    })
  })

  describe('统计信息', () => {
    test('应该提供准确的统计信息', () => {
      bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '验证失败1',
        {}
      )
      bugBrain.recordBug(
        'verify-failure',
        'high',
        'verify-gate',
        '验证失败2',
        {}
      )
      bugBrain.recordBug(
        'tool-failure',
        'low',
        'tool-execution',
        '工具失败',
        {}
      )

      const stats = bugBrain.getStatistics()

      expect(stats.totalBugs).toBe(3)
      expect(stats.byCategory['verify-failure']).toBe(2)
      expect(stats.byCategory['tool-failure']).toBe(1)
      expect(stats.bySeverity.medium).toBe(1)
      expect(stats.bySeverity.high).toBe(1)
      expect(stats.bySeverity.low).toBe(1)
      expect(stats.bySource['verify-gate']).toBe(2)
      expect(stats.bySource['tool-execution']).toBe(1)
    })
  })

  describe('清理功能', () => {
    test('应该能够清理旧记录', () => {
      const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000 // 31天前

      // 模拟旧记录
      const oldBug = bugBrain.recordBug(
        'verify-failure',
        'medium',
        'verify-gate',
        '旧bug',
        {}
      )

      // 修改时间戳为旧时间
      Object.defineProperty(oldBug, 'timestamp', { value: oldTimestamp })

      bugBrain.recordBug(
        'tool-failure',
        'high',
        'tool-execution',
        '新bug',
        {}
      )

      bugBrain.cleanup(30) // 清理30天前的记录

      const allBugs = bugBrain.getAllBugs()
      expect(allBugs).toHaveLength(1)
      expect(allBugs[0].description).toBe('新bug')
    })
  })
})