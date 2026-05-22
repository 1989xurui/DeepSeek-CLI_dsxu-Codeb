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
  appendLedgerEvent,
  buildDSXUActiveFrame,
  buildDurableLedgerRecoveryProof,
  buildLongTaskLedgerProjection,
  buildRuntimeEventSchemaConsumptionProof,
  decideStallRecovery,
  projectFailureRecoveryDecision,
  projectVerificationRecoveryDecision,
  projectToolCallResultToLedgerEvent,
  recordFailureRecoveryDecision,
  recordVerificationRecoveryDecision,
  recordStallDecision,
  RECOVERY_DECISION_TABLE,
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
      expect(summary.eventCount).toBe(0)
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

  describe('6. 长任务事件账本与停滞恢复决策', () => {
    it('appendLedgerEvent() 应该把工具、验证、成本证据写入同一个任务账本', () => {
      const ledger = createProgressLedger('task-long', 'session-long', 'execute')
      const withToolEvent = appendLedgerEvent(ledger, {
        kind: 'tool',
        owner: 'Tool Gate',
        summary: 'Edit completed with post-mutation envelope',
        turnId: 'turn-1',
        toolUseId: 'toolu-edit-1',
        evidence: ['envelope:dsxu.post-mutation-verification.v1'],
      })
      const withCostEvent = appendLedgerEvent(withToolEvent, {
        kind: 'cost-cache',
        owner: 'DeepSeek Model Router / Cost Evidence',
        summary: 'Flash route cost recorded',
        modelCallId: 'model-call-1',
        evidence: ['model:deepseek-v4-flash', 'costUsd:0.001'],
      })

      expect(withCostEvent.events?.length).toBe(2)
      expect(withCostEvent.events?.[0].schemaVersion).toBe('dsxu.runtime-event.v1')
      expect(withCostEvent.events?.[0].taskId).toBe('task-long')
      expect(withCostEvent.events?.[0].toolUseId).toBe('toolu-edit-1')
      expect(withCostEvent.events?.[1].modelCallId).toBe('model-call-1')
      expect(getLedgerSummary(withCostEvent).eventCount).toBe(2)
    })

    it('decideStallRecovery() 应该把 no-progress 信号变成明确恢复动作', () => {
      const decision = decideStallRecovery({
        signals: [
          {
            kind: 'repeated_read',
            count: 3,
            severity: 'medium',
            evidence: ['same file range read 3 times'],
          },
          {
            kind: 'repeated_verification_failure',
            count: 2,
            severity: 'high',
            evidence: ['bun test failed twice'],
          },
        ],
      })

      expect(decision.schemaVersion).toBe('dsxu.stall-recovery-decision.v1')
      expect(decision.owner).toBe('Recovery / GearBox')
      expect(decision.reason).toBe('repeated_verification_failure')
      expect(decision.action).toBe('replan')
      expect(decision.nextAction).toContain('failing assertion')
      expect(decision.evidence).toContain('bun test failed twice')
    })

    it('RECOVERY_DECISION_TABLE should cover every stall signal with one default action', () => {
      const signals = [
        'repeated_read',
        'no_diff',
        'repeated_verification_failure',
        'tool_failure',
        'validation_failure',
        'timeout',
        'workspace_boundary',
        'model_failure',
        'context_pressure',
        'cost_pressure',
        'agent_timeout',
        'permission_loop',
        'tool_result_growth',
      ]

      expect(RECOVERY_DECISION_TABLE.map(row => row.signal)).toEqual(signals)
      expect(RECOVERY_DECISION_TABLE.every(row => row.ledgerEventRequired)).toBe(true)
      expect(RECOVERY_DECISION_TABLE.every(row => row.finalClaimAllowed === false)).toBe(true)
    })

    it('recordStallDecision() 应该让长任务可恢复而不是继续无进展循环', () => {
      const ledger = createProgressLedger('task-stall', 'session-stall', 'verify')
      const decision = decideStallRecovery({
        signals: [
          {
            kind: 'permission_loop',
            count: 2,
            severity: 'critical',
            evidence: ['same approval request repeated twice'],
          },
        ],
      })
      const updated = recordStallDecision(ledger, decision)

      expect(updated.stallDecision?.action).toBe('ask-human')
      expect(updated.resumeFrom).toBe('verify')
      expect(isLedgerResumable(updated)).toBe(true)
      expect(getLedgerSummary(updated).lastStallAction).toBe('ask-human')
      expect(updated.events?.at(-1)?.kind).toBe('stall')
    })

    it('projectVerificationRecoveryDecision() should use one source for verification, recovery, ledger, and final claim', () => {
      const ledger = createProgressLedger('task-verify-recovery', 'session-verify', 'verify')
      const projection = projectVerificationRecoveryDecision({
        verification: {
          passed: false,
          score: 52,
          findings: [
            {
              severity: 'P1',
              title: 'Focused test failed twice',
              detail: 'cart.test.ts still fails',
              suggestion: 'replan before final claim',
            },
          ],
          timestamp: Date.now(),
        },
        onFailure: 'block',
        failedAttemptsSinceProgress: 2,
        command: 'bun test cart.test.ts',
        taskId: 'task-verify-recovery',
        turnId: 'turn-verify-1',
      })

      expect(projection.schemaVersion).toBe(
        'dsxu.verification-recovery-projection.v1',
      )
      expect(projection.policy).toBe('blocking')
      expect(projection.finalClaimAllowed).toBe(false)
      expect(projection.verificationEvent).toMatchObject({
        kind: 'verification',
        owner: 'VerificationKernel',
        taskId: 'task-verify-recovery',
        turnId: 'turn-verify-1',
      })
      expect(projection.verificationEvent.evidence).toContain(
        'schema:VerifySummary',
      )
      expect(projection.recoveryDecision).toMatchObject({
        schemaVersion: 'dsxu.stall-recovery-decision.v1',
        owner: 'Recovery / GearBox',
        reason: 'repeated_verification_failure',
        action: 'replan',
      })

      const updated = recordVerificationRecoveryDecision(ledger, projection)
      expect(updated.verifySummary?.passed).toBe(false)
      expect(updated.events?.map(event => event.kind)).toEqual([
        'verification',
        'recovery',
        'stall',
      ])
      expect(getLedgerSummary(updated).lastStallAction).toBe('replan')
      expect(buildLongTaskLedgerProjection(updated).finalClaimAllowed).toBe(false)
    })

    it('projectFailureRecoveryDecision() should route normalized failures through the same recovery table and ledger', () => {
      const ledger = createProgressLedger('task-failure-recovery', 'session-failure', 'execute')
      const permissionProjection = projectFailureRecoveryDecision({
        error: new Error('permission denied by policy'),
        blockedByPolicy: true,
        operation: 'Bash',
        taskId: 'task-failure-recovery',
        turnId: 'turn-failure-1',
        evidence: ['tool:Bash'],
      })
      const workspaceProjection = projectFailureRecoveryDecision({
        error: new Error('workspace root boundary violation'),
        operation: 'FileEdit',
        taskId: 'task-failure-recovery',
        turnId: 'turn-failure-2',
      })

      expect(permissionProjection.schemaVersion).toBe('dsxu.failure-recovery-projection.v1')
      expect(permissionProjection.failure.category).toBe('permission')
      expect(permissionProjection.recoveryDecision.reason).toBe('permission_loop')
      expect(permissionProjection.recoveryDecision.action).toBe('ask-human')
      expect(permissionProjection.finalClaimAllowed).toBe(false)
      expect(workspaceProjection.failure.category).toBe('workspace')
      expect(workspaceProjection.recoveryDecision.reason).toBe('workspace_boundary')
      expect(workspaceProjection.recoveryDecision.action).toBe('abort')

      const updated = recordFailureRecoveryDecision(ledger, permissionProjection)
      expect(updated.events?.map(event => event.kind)).toEqual(['recovery', 'stall'])
      expect(updated.stallDecision?.action).toBe('ask-human')
      expect(isLedgerResumable(updated)).toBe(true)
      expect(buildLongTaskLedgerProjection(updated).finalClaimAllowed).toBe(false)
    })

    it('buildLongTaskLedgerProjection() should project ledger/stall into TUI and final report state', () => {
      let ledger = createProgressLedger('task-projection', 'session-projection', 'verify')
      ledger = appendLedgerEvent(ledger, projectToolCallResultToLedgerEvent({
        callId: 'toolu-verify-1',
        toolName: 'Bash',
        result: {
          ok: false,
          outputText: 'test failed',
          events: [],
          error: {
            type: 'EXECUTION_FAILED',
            message: 'test failed',
            retryable: true,
          },
          metadata: {
            duration: 42,
            executorKind: 'dsxu_native',
            usedBridge: false,
          },
        },
      }))
      const decision = decideStallRecovery({
        signals: [
          {
            kind: 'repeated_verification_failure',
            count: 2,
            severity: 'high',
            evidence: ['same focused test failed twice'],
          },
        ],
      })
      ledger = recordStallDecision(ledger, decision)

      const projection = buildLongTaskLedgerProjection(ledger)

      expect(projection.schemaVersion).toBe('dsxu.long-task-ledger-projection.v1')
      expect(projection.tuiLines.join('\n')).toContain('LongTask: task=task-projection')
      expect(projection.tuiLines.join('\n')).toContain('Stall: repeated_verification_failure -> replan')
      expect(projection.finalReportSection.status).toBe('recoverable')
      expect(projection.finalReportSection.summary.join('\n')).toContain('finalClaimAllowed=false')
      expect(projection.finalReportSection.evidence).toContain('same focused test failed twice')
      expect(projection.finalClaimAllowed).toBe(false)
    })

    it('buildDurableLedgerRecoveryProof() should prove failed verification resumes from the ledger instead of a side channel', () => {
      let ledger = createProgressLedger('task-durable-proof', 'session-durable-proof', 'verify')
      const projection = projectVerificationRecoveryDecision({
        verification: {
          passed: false,
          score: 47,
          findings: [
            {
              severity: 'P1',
              title: 'Resize regression still fails',
              detail: 'TUI viewport test failed after two attempts',
              suggestion: 'replan around scroll anchoring before final claim',
            },
          ],
          timestamp: Date.now(),
        },
        onFailure: 'block',
        failedAttemptsSinceProgress: 2,
        command: 'bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t resize',
        owner: 'VerificationKernel',
        evidence: ['tui-resize-regression:failed-twice'],
      })
      ledger = recordVerificationRecoveryDecision(ledger, projection)

      const proof = buildDurableLedgerRecoveryProof(ledger)

      expect(proof.schemaVersion).toBe('dsxu.durable-ledger-recovery-proof.v1')
      expect(proof.status).toBe('PASS_DURABLE_LEDGER_RECOVERY_READY')
      expect(proof.resumeSource).toBe('progress-ledger')
      expect(proof.finalClaimAllowed).toBe(false)
      expect(proof.guards).toEqual([])
      expect(proof.tuiLine).toContain('resumeSource=progress-ledger')
      expect(proof.finalReportSection.summary.join('\n')).toContain(
        'finalClaimAllowed=false',
      )
      expect(proof.evidence).toContain('tui-resize-regression:failed-twice')
    })

    it('buildDSXUActiveFrame() should keep only current task memory and open obligations', () => {
      let ledger = createProgressLedger('task-active-frame', 'session-active-frame', 'edit')
      ledger = appendLedgerEvent(ledger, {
        kind: 'task_contract',
        owner: 'Query Loop / PlanGraph / Tool Gate',
        summary: 'single_file_edit plan_execute_verify via flash',
        evidence: ['contract:execution-contract-active-frame'],
        metadata: {
          executionContract: {
            goal: 'Patch checkout validation',
            risk: 'medium',
            visibleTools: ['Read', 'Edit', 'Bash', 'Grep'],
            verificationLevel: 'affected_tests',
            fallbackPolicy: 'retry',
          },
        },
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'source_evidence',
        owner: 'Source Truth Repair',
        summary: 'Read checkout owner source',
        evidence: ['src/checkout.ts', 'src/checkout.test.ts', 'validation branch located'],
        metadata: {
          filesRead: ['src/checkout.ts', 'src/checkout.test.ts'],
        },
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'edit_proof',
        owner: 'Tool Gate',
        summary: 'Scoped edit proof recorded',
        evidence: ['edit-proof:checkout-validation'],
        metadata: {
          filesChanged: ['src/checkout.ts'],
          openObligations: ['run affected checkout test'],
        },
      })

      const frame = buildDSXUActiveFrame({ ledger })

      expect(frame.schemaVersion).toBe('dsxu.active-frame.v5')
      expect(frame.owner).toBe('PlanGraph / Work-State')
      expect(frame.task).toBe('Patch checkout validation')
      expect(frame.phase).toBe('edit')
      expect(frame.confirmedFacts.length).toBeLessThanOrEqual(8)
      expect(frame.filesRead).toEqual(['src/checkout.ts', 'src/checkout.test.ts'])
      expect(frame.filesChanged).toEqual(['src/checkout.ts'])
      expect(frame.openObligations).toEqual([
        'verification required:affected_tests',
        'run affected checkout test',
      ])
      expect(frame.nextAllowedActions).toEqual(expect.arrayContaining(['tool:Edit', 'record edit proof']))
      expect(frame.guards).toEqual([])
    })

    it('buildRuntimeEventSchemaConsumptionProof() should require all default runtime event kinds in one ledger stream', () => {
      let ledger = createProgressLedger('task-runtime-events', 'session-runtime-events', 'plan')
      ledger = appendLedgerEvent(ledger, {
        kind: 'goal',
        owner: 'Query Loop',
        summary: 'Goal accepted',
        evidence: ['goal:user-request'],
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'plan',
        owner: 'PlanGraph',
        summary: 'Plan created',
        evidence: ['plan:owner-focused'],
      })
      ledger = appendLedgerEvent(ledger, projectToolCallResultToLedgerEvent({
        callId: 'toolu-edit',
        toolName: 'FileEdit',
        result: {
          ok: true,
          outputText: 'edit applied',
          events: [],
          metadata: {
            duration: 25,
            executorKind: 'dsxu_native',
            usedBridge: false,
          },
        },
      }))
      ledger = appendLedgerEvent(ledger, {
        kind: 'verification',
        owner: 'VerificationKernel',
        summary: 'Focused verification passed',
        evidence: ['verify:focused-pass'],
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'recovery',
        owner: 'Recovery / GearBox',
        summary: 'No recovery needed',
        evidence: ['recovery:none'],
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'evidence',
        owner: 'Evidence / Release Claim Binder',
        summary: 'Final evidence packet linked',
        evidence: ['evidence:final-report-section'],
      })

      const proof = buildRuntimeEventSchemaConsumptionProof({
        events: ledger.events ?? [],
      })

      expect(proof.status).toBe('PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION')
      expect(proof.missingKinds).toEqual([])
      expect(proof.invalidEvents).toEqual([])
      expect(proof.compactPanelLines.join('\n')).toContain('missing=none')
      expect(proof.finalReportSection.status).toBe('ready')
      expect(proof.finalReportSection.evidence).toContain(
        'evidence:final-report-section',
      )
    })

    it('buildRuntimeEventSchemaConsumptionProof() should expose missing event kinds instead of letting final evidence pass silently', () => {
      const ledger = appendLedgerEvent(
        createProgressLedger('task-runtime-gap', 'session-runtime-gap', 'verify'),
        {
          kind: 'verification',
          owner: 'VerificationKernel',
          summary: 'Focused verification exists without plan/tool evidence',
          evidence: ['verify:orphan'],
        },
      )
      const proof = buildRuntimeEventSchemaConsumptionProof({
        events: ledger.events ?? [],
        requiredKinds: ['plan', 'tool', 'verification', 'evidence'],
      })

      expect(proof.status).toBe('NEEDS_RUNTIME_EVENT_SCHEMA_CONSUMPTION_REVIEW')
      expect(proof.missingKinds).toEqual(['plan', 'tool', 'evidence'])
      expect(proof.guards).toContain('missing runtime event kind:plan')
      expect(proof.finalReportSection.status).toBe('needs-evidence')
    })
  })
})
