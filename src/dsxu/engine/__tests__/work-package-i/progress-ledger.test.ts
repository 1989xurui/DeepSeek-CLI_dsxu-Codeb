import { describe, it, expect } from 'bun:test'
import {
  createProgressLedger,
  updateLedgerState,
  addLedgerStep,
  updateLedgerStep,
  setVerifySummary,
  setReviewSummary,
  markLedgerCompleted,
  getLedgerSummary,
  isLedgerResumable,
  getResumePoint,
  type ProgressLedger,
  type LedgerEntryResult,
  type VerifySummary,
  type ReviewSummary,
  type LedgerStep
} from '../../progress-ledger'

describe('Progress Ledger - 结构定义与基础函数', () => {
  describe('1. createProgressLedger 能创建最小 ledger', () => {
    it('应该创建包含所有必需字段的 ledger', () => {
      const taskId = 'test-task-123'
      const sessionId = 'test-session-456'
      const ledger = createProgressLedger(taskId, sessionId, 'plan')

      // 验证必需字段
      expect(ledger.taskId).toBe(taskId)
      expect(ledger.sessionId).toBe(sessionId)
      expect(ledger.currentState).toBe('plan')
      expect(ledger.previousState).toBeNull()
      expect(ledger.lastResult).toBeNull()
      expect(ledger.version).toBe('1.0.0')

      // 验证时间字段
      expect(ledger.updatedAt).toBeGreaterThan(0)
      expect(ledger.createdAt).toBeGreaterThan(0)
      expect(ledger.updatedAt).toBe(ledger.createdAt) // 创建时应该相同

      // 验证预留字段
      expect(ledger.steps).toEqual([])
      expect(ledger.resumeFrom).toBeUndefined()
      expect(ledger.verifySummary).toBeNull()
      expect(ledger.reviewSummary).toBeNull()

      // 验证基础字段
      expect(ledger.isCompleted).toBe(false)
      expect(ledger.completedAt).toBeUndefined()
      expect(ledger.metadata).toEqual({})
    })

    it('应该支持自定义初始状态', () => {
      const ledger = createProgressLedger('task1', 'session1', 'edit')
      expect(ledger.currentState).toBe('edit')

      const ledger2 = createProgressLedger('task2', 'session2', 'execute')
      expect(ledger2.currentState).toBe('execute')
    })
  })

  describe('2. FSM 状态兼容', () => {
    it('应该与现有 RuntimeState 类型兼容', () => {
      const validStates = ['plan', 'retrieve', 'edit', 'execute', 'verify', 'review', 'commit', 'rollback']

      validStates.forEach(state => {
        const ledger = createProgressLedger('task', 'session', state as any)
        expect(ledger.currentState).toBe(state)
        expect(typeof ledger.currentState).toBe('string')
      })
    })

    it('previousState 应该正确处理状态转移', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      // 更新状态后，previousState 应该记录之前的状态
      const updatedLedger = updateLedgerState(ledger, 'edit')
      expect(updatedLedger.currentState).toBe('edit')
      expect(updatedLedger.previousState).toBe('plan')

      // 再次更新状态
      const updatedLedger2 = updateLedgerState(updatedLedger, 'execute')
      expect(updatedLedger2.currentState).toBe('execute')
      expect(updatedLedger2.previousState).toBe('edit')
    })
  })

  describe('3. 空结构可安全初始化', () => {
    it('steps 应该初始化为空数组', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')
      expect(Array.isArray(ledger.steps)).toBe(true)
      expect(ledger.steps?.length).toBe(0)
    })

    it('resumeFrom 应该初始化为 undefined', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')
      expect(ledger.resumeFrom).toBeUndefined()
    })

    it('verifySummary 和 reviewSummary 应该初始化为 null', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')
      expect(ledger.verifySummary).toBeNull()
      expect(ledger.reviewSummary).toBeNull()
    })

    it('metadata 应该初始化为空对象', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')
      expect(ledger.metadata).toEqual({})
      expect(typeof ledger.metadata).toBe('object')
    })

    it('lastResult 应该初始化为 null', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')
      expect(ledger.lastResult).toBeNull()
    })
  })

  describe('4. 基础辅助函数有效', () => {
    it('updateLedgerState() 应该更新状态并保留结果', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      const result: LedgerEntryResult = {
        type: 'success',
        message: '计划完成',
        timestamp: Date.now()
      }

      const updated = updateLedgerState(ledger, 'edit', result)

      expect(updated.currentState).toBe('edit')
      expect(updated.previousState).toBe('plan')
      expect(updated.lastResult).toEqual(result)
      expect(updated.updatedAt).toBeGreaterThanOrEqual(ledger.updatedAt)
    })

    it('addLedgerStep() 应该添加步骤并更新时间', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      const step: Omit<LedgerStep, 'stepId' | 'startedAt'> = {
        type: 'file_edit',
        state: 'completed',
        result: {
          type: 'success',
          message: '文件编辑完成',
          timestamp: Date.now()
        }
      }

      const updated = addLedgerStep(ledger, step)

      expect(updated.steps?.length).toBe(1)
      expect(updated.steps?.[0].type).toBe('file_edit')
      expect(updated.steps?.[0].state).toBe('completed')
      expect(updated.steps?.[0].stepId).toBeDefined()
      expect(updated.steps?.[0].startedAt).toBeGreaterThan(0)
      expect(updated.updatedAt).toBeGreaterThanOrEqual(ledger.updatedAt)
    })

    it('updateLedgerStep() 应该更新指定步骤', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      // 先添加一个步骤
      const step: Omit<LedgerStep, 'stepId' | 'startedAt'> = {
        type: 'test',
        state: 'running'
      }
      const ledgerWithStep = addLedgerStep(ledger, step)
      const stepId = ledgerWithStep.steps![0].stepId

      // 更新步骤
      const updated = updateLedgerStep(ledgerWithStep, stepId, {
        state: 'completed',
        endedAt: Date.now()
      })

      expect(updated.steps?.[0].state).toBe('completed')
      expect(updated.steps?.[0].endedAt).toBeDefined()
      expect(updated.updatedAt).toBeGreaterThanOrEqual(ledgerWithStep.updatedAt)
    })

    it('setVerifySummary() 应该设置验证摘要', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      const verifySummary: VerifySummary = {
        passed: true,
        score: 85,
        findings: [],
        timestamp: Date.now()
      }

      const updated = setVerifySummary(ledger, verifySummary)

      expect(updated.verifySummary).toEqual(verifySummary)
      expect(updated.updatedAt).toBeGreaterThanOrEqual(ledger.updatedAt)
    })

    it('setReviewSummary() 应该设置审查摘要', () => {
      const ledger = createProgressLedger('task', 'session', 'plan')

      const reviewSummary: ReviewSummary = {
        approved: true,
        score: 90,
        comments: ['代码质量良好'],
        riskLevel: 'low',
        timestamp: Date.now()
      }

      const updated = setReviewSummary(ledger, reviewSummary)

      expect(updated.reviewSummary).toEqual(reviewSummary)
      expect(updated.updatedAt).toBeGreaterThanOrEqual(ledger.updatedAt)
    })

    it('getLedgerSummary() 应该返回摘要信息', () => {
      const ledger = createProgressLedger('task', 'session', 'edit')

      // 添加一些步骤
      let ledgerWithSteps = ledger
      for (let i = 0; i < 3; i++) {
        ledgerWithSteps = addLedgerStep(ledgerWithSteps, {
          type: `step-${i}`,
          state: i < 2 ? 'completed' : 'running'
        })
      }

      const summary = getLedgerSummary(ledgerWithSteps)

      expect(summary.taskId).toBe('task')
      expect(summary.sessionId).toBe('session')
      expect(summary.currentState).toBe('edit')
      expect(summary.isCompleted).toBe(false)
      expect(summary.stepCount).toBe(3)
      expect(summary.completedSteps).toBe(2)
      expect(summary.lastUpdated).toBe(ledgerWithSteps.updatedAt)
    })
  })

  describe('5. 完成态/恢复态逻辑', () => {
    it('markLedgerCompleted() 应该标记账本为完成状态', () => {
      const ledger = createProgressLedger('task', 'session', 'commit')

      const result: LedgerEntryResult = {
        type: 'success',
        message: '任务完成',
        timestamp: Date.now()
      }

      const completed = markLedgerCompleted(ledger, result)

      expect(completed.isCompleted).toBe(true)
      expect(completed.completedAt).toBeDefined()
      expect(completed.completedAt).toBeGreaterThan(0)
      expect(completed.lastResult).toEqual(result)
      expect(completed.updatedAt).toBeGreaterThanOrEqual(ledger.updatedAt)
    })

    it('isLedgerResumable() 应该检查账本是否可恢复', () => {
      // 未完成的账本，没有resumeFrom，不可恢复
      const ledger1 = createProgressLedger('task1', 'session1', 'plan')
      expect(isLedgerResumable(ledger1)).toBe(false)

      // 已完成的账本，不可恢复
      const ledger2 = createProgressLedger('task2', 'session2', 'commit')
      const completedLedger = markLedgerCompleted(ledger2, {
        type: 'success',
        message: '完成',
        timestamp: Date.now()
      })
      expect(isLedgerResumable(completedLedger)).toBe(false)

      // 有resumeFrom的未完成账本，可恢复
      const ledger3: ProgressLedger = {
        ...createProgressLedger('task3', 'session3', 'edit'),
        resumeFrom: 'plan'
      }
      expect(isLedgerResumable(ledger3)).toBe(true)
    })

    it('getResumePoint() 应该返回恢复点', () => {
      // 没有resumeFrom时，返回currentState
      const ledger1 = createProgressLedger('task1', 'session1', 'execute')
      expect(getResumePoint(ledger1)).toBe('execute')

      // 有resumeFrom时，返回resumeFrom
      const ledger2: ProgressLedger = {
        ...createProgressLedger('task2', 'session2', 'verify'),
        resumeFrom: 'edit'
      }
      expect(getResumePoint(ledger2)).toBe('edit')

      // 已完成的账本，返回currentState
      const ledger3 = createProgressLedger('task3', 'session3', 'commit')
      const completedLedger = markLedgerCompleted(ledger3, {
        type: 'success',
        message: '完成',
        timestamp: Date.now()
      })
      expect(getResumePoint(completedLedger)).toBe('commit')
    })
  })
})
