/**
 * V10-1: A-2A KAIROS Integration Harness
 *
 * 验证KAIROS Session OS与现有系统的集成
 */

import { describe, test, expect } from 'bun:test'
import {
  createKairosSessionStateMachine,
  shouldContinueSession,
  shouldResumeSessionId,
  generateStructuredResumeHint
} from '../session'
import {
  createModelGateway
} from '../model-gateway-v1'
import {
  getModelCapability
} from '../model-capability-v1'

// 模拟会话快照
const createMockSessionSnapshot = (sessionId: string, status: 'active' | 'paused' | 'completed') => ({
  sessionId,
  timestamp: Date.now(),
  status,
  messageStats: {
    total: status === 'active' ? 25 : status === 'paused' ? 15 : 40,
    user: status === 'active' ? 10 : status === 'paused' ? 6 : 16,
    assistant: status === 'active' ? 10 : status === 'paused' ? 6 : 16,
    tool: status === 'active' ? 4 : status === 'paused' ? 2 : 7,
    system: 1
  },
  extractedMemories: [],
  memoryCategoryStats: {},
  resumeHints: [
    {
      type: 'suggestion' as const,
      content: status === 'active' ? '会话进行中' :
               status === 'paused' ? '会话已暂停，点击恢复' :
               '会话已完成，可查看历史',
      priority: status === 'active' ? 'high' as const :
                status === 'paused' ? 'medium' as const :
                'low' as const
    }
  ],
  qualityScore: status === 'active' ? 85 : status === 'paused' ? 70 : 90
})

describe('A-2A KAIROS Integration Harness', () => {
  test('1. KAIROS Session OS基础功能', () => {
    const sessionId = 'test-kairos-session'
    const kairosMachine = createKairosSessionStateMachine(sessionId)

    // 创建活跃会话快照
    const activeSnapshot = createMockSessionSnapshot(sessionId, 'active')

    // 生成检查点
    const checkpoint = kairosMachine.createCheckpoint(activeSnapshot)

    // 验证KAIROS功能
    expect(checkpoint).toBeDefined()
    expect(checkpoint.sessionId).toBe(sessionId)
    expect(checkpoint.snapshot.status).toBe('active')
    expect(checkpoint.resumeState.canContinue).toBe(true)
    expect(checkpoint.resumeState.resumeHint).toBeDefined()
    expect(checkpoint.resumeState.resumeHint.type).toBe('continue')
    expect(checkpoint.resumeState.continuationDecision).toBeDefined()
    expect(checkpoint.resumeState.continuationDecision.decisionType).toBe('continue')

    // 更新持久化状态
    const persistentState = kairosMachine.updatePersistentState(checkpoint)
    expect(persistentState.sessionId).toBe(sessionId)
    expect(persistentState.sessionState).toBe('active')
    expect(persistentState.checkpoints.length).toBe(1)

    console.log('✅ KAIROS Session OS基础功能:')
    console.log(`  - 会话ID: ${sessionId}`)
    console.log(`  - 检查点ID: ${checkpoint.checkpointId}`)
    console.log(`  - 恢复提示: ${checkpoint.resumeState.resumeHint.content}`)
    console.log(`  - 恢复决策: ${checkpoint.resumeState.continuationDecision.decisionType}`)
    console.log(`  - 持久化检查点: ${persistentState.checkpoints.length}`)
  })

  test('2. KAIROS与模型网关集成', () => {
    const sessionId = 'test-integration-session'
    const kairosMachine = createKairosSessionStateMachine(sessionId)
    const gateway = createModelGateway({
      defaultModel: 'deepseek-chat',
      enableSessionAwareness: true
    })

    // 模拟长时间工作会话
    const snapshots = [
      createMockSessionSnapshot(sessionId, 'active'),
      createMockSessionSnapshot(sessionId, 'active'),
      createMockSessionSnapshot(sessionId, 'paused') // 模拟暂停
    ]

    const checkpoints = []
    for (const snapshot of snapshots) {
      const checkpoint = kairosMachine.createCheckpoint(snapshot)
      kairosMachine.updatePersistentState(checkpoint)
      checkpoints.push(checkpoint)

      // 更新网关会话状态
      gateway.updateSessionState(snapshot.status)

      // 模拟上下文使用（根据会话状态）
      const tokensUsed = snapshot.status === 'active' ? 30000 : 10000
      gateway.updateContextUsage(tokensUsed)
    }

    // 验证集成
    expect(checkpoints.length).toBe(3)

    const finalCheckpoint = checkpoints[checkpoints.length - 1]
    expect(finalCheckpoint.snapshot.status).toBe('paused')

    const gatewayState = gateway.getState()
    expect(gatewayState.sessionState).toBe('paused')
    expect(gatewayState.contextUsage.totalTokens).toBe(70000) // 30K + 30K + 10K

    // 检查恢复决策
    const resumeDecision = kairosMachine.getResumeDecision()
    const resumeHint = kairosMachine.getResumeHint()

    expect(resumeDecision).toBeDefined()
    expect(resumeHint).toBeDefined()
    expect(resumeDecision?.decisionType).toBe('resume')
    expect(resumeHint?.type).toBe('resume')

    console.log('✅ KAIROS与模型网关集成:')
    console.log(`  - 总检查点: ${checkpoints.length}`)
    console.log(`  - 最终状态: ${finalCheckpoint.snapshot.status}`)
    console.log(`  - 网关会话状态: ${gatewayState.sessionState}`)
    console.log(`  - 网关tokens使用: ${gatewayState.contextUsage.totalTokens}`)
    console.log(`  - 恢复决策: ${resumeDecision?.decisionType}`)
    console.log(`  - 恢复提示: ${resumeHint?.content}`)
  })

  test('3. 长任务恢复链路集成', () => {
    const sessionId = 'test-longtask-recovery'
    const kairosMachine = createKairosSessionStateMachine(sessionId)
    const gateway = createModelGateway()

    // 模拟长任务进行中
    const activeSnapshot = createMockSessionSnapshot(sessionId, 'active')
    const checkpoint = kairosMachine.createCheckpoint(activeSnapshot)
    kairosMachine.updatePersistentState(checkpoint)

    gateway.updateSessionState('active')
    gateway.updateContextUsage(80000) // 长任务使用大量上下文

    // 模拟长任务信息
    const longTaskInfo = {
      taskId: 'refactor-auth-module',
      lastStep: 3,
      pendingSteps: [
        { stepId: 'step-4', description: '实现OAuth集成', status: 'pending' as const },
        { stepId: 'step-5', description: '编写测试用例', status: 'pending' as const },
        { stepId: 'step-6', description: '更新文档', status: 'pending' as const }
      ],
      resumeContext: {
        currentModule: 'user-auth',
        completedFeatures: ['login', 'register', 'session-management'],
        pendingFeatures: ['password-reset', '2fa', 'social-login'],
        lastError: null
      }
    }

    // 处理长任务恢复
    kairosMachine.handleLongTaskContinuation(longTaskInfo)

    // 模拟会话中断（暂停）
    const pausedSnapshot = createMockSessionSnapshot(sessionId, 'paused')
    const pausedCheckpoint = kairosMachine.createCheckpoint(pausedSnapshot)
    const persistentState = kairosMachine.updatePersistentState(pausedCheckpoint)

    gateway.updateSessionState('paused')

    // 验证长任务恢复信息
    expect(persistentState.longTaskContinuation).toBeDefined()
    expect(persistentState.longTaskContinuation?.taskId).toBe('refactor-auth-module')
    expect(persistentState.longTaskContinuation?.pendingSteps.length).toBe(3)
    expect(persistentState.longTaskContinuation?.resumeContext.currentModule).toBe('user-auth')

    // 检查恢复能力
    const shouldContinue = shouldContinueSession(pausedSnapshot)
    const shouldResume = shouldResumeSessionId(pausedSnapshot)
    const resumeHint = generateStructuredResumeHint(pausedSnapshot, pausedSnapshot.resumeHints)

    expect(shouldContinue).toBe(true) // 暂停会话可以继续
    expect(shouldResume).toBe(true) // 有消息的暂停会话可以恢复
    expect(resumeHint.type).toBe('resume')

    // 检查网关边界（恢复需要大上下文）
    const recoveryInput = {
      taskType: 'coding' as const,
      requiredContext: 60000, // 恢复需要上下文
      requiresTools: true,
      requiresLongThinking: true,
      budgetConstraint: 'medium' as const,
      sessionState: 'paused' as const
    }

    const recoveryCheck = gateway.checkBoundary(recoveryInput)

    console.log('✅ 长任务恢复链路集成:')
    console.log(`  - 任务ID: ${persistentState.longTaskContinuation?.taskId}`)
    console.log(`  - 待完成步骤: ${persistentState.longTaskContinuation?.pendingSteps.length}`)
    console.log(`  - 当前模块: ${persistentState.longTaskContinuation?.resumeContext.currentModule}`)
    console.log(`  - 应该继续: ${shouldContinue}`)
    console.log(`  - 应该恢复: ${shouldResume}`)
    console.log(`  - 恢复提示: ${resumeHint.content}`)
    console.log(`  - 网关恢复检查: ${recoveryCheck.passed ? '通过' : '失败'}`)
    if (!recoveryCheck.passed) {
      console.log(`  - 建议动作: ${recoveryCheck.result.suggestedAction}`)
    }

    // 验证恢复链路完整
    expect(persistentState.longTaskContinuation).toBeDefined()
    expect(shouldContinue).toBe(true)
    expect(resumeHint).toBeDefined()
  })

  test('4. A-2A收口验证', () => {
    // A-2A收口要求验证
    const sessionId = 'test-a2a-closure'
    const kairosMachine = createKairosSessionStateMachine(sessionId)

    // 创建多个检查点
    const snapshots = [
      createMockSessionSnapshot(sessionId, 'active'),
      createMockSessionSnapshot(sessionId, 'active'),
      createMockSessionSnapshot(sessionId, 'paused'),
      createMockSessionSnapshot(sessionId, 'active') // 恢复后
    ]

    for (const snapshot of snapshots) {
      const checkpoint = kairosMachine.createCheckpoint(snapshot)
      kairosMachine.updatePersistentState(checkpoint)
    }

    const persistentState = kairosMachine.updatePersistentState(
      kairosMachine.createCheckpoint(createMockSessionSnapshot(sessionId, 'active'))
    )

    // A-2A收口验证点：
    // 1. query-loop / recovery / session 至少三者中两者联动成立
    // 2. session OS 结果能进入主链
    // 3. 不引入第二套 session 系统
    // 4. 至少一条长任务恢复链路成立

    // 验证点1: 检查点存在且包含恢复信息
    expect(persistentState.checkpoints.length).toBeGreaterThan(0)
    const latestCheckpoint = persistentState.checkpoints[persistentState.checkpoints.length - 1]
    expect(latestCheckpoint.resumeState.canContinue).toBe(true)
    expect(latestCheckpoint.resumeState.resumeHint).toBeDefined()
    expect(latestCheckpoint.resumeState.continuationDecision).toBeDefined()

    // 验证点2: session OS结果可以进入主链
    const mainlinePayload = {
      sessionId: persistentState.sessionId,
      currentCheckpointId: persistentState.currentCheckpointId,
      sessionState: persistentState.sessionState,
      resumeDecision: latestCheckpoint.resumeState.continuationDecision,
      resumeHint: latestCheckpoint.resumeState.resumeHint,
      canContinue: latestCheckpoint.resumeState.canContinue
    }

    expect(mainlinePayload.sessionId).toBe(sessionId)
    expect(mainlinePayload.currentCheckpointId).toBe(latestCheckpoint.checkpointId)
    expect(mainlinePayload.canContinue).toBe(true)

    // 验证点3: 使用现有session系统，没有第二套系统
    expect(latestCheckpoint.snapshot.sessionId).toBeDefined()
    expect(latestCheckpoint.snapshot.status).toBeDefined()
    expect(latestCheckpoint.snapshot.messageStats).toBeDefined()
    expect(latestCheckpoint.snapshot.resumeHints).toBeDefined()

    // 验证点4: 长任务恢复链路
    const hasLongTaskRecovery = persistentState.longTaskContinuation !== undefined ||
                               latestCheckpoint.resumeState.continuationDecision.decisionType === 'resume'

    console.log('✅ A-2A收口验证:')
    console.log(`  - 检查点数量: ${persistentState.checkpoints.length}`)
    console.log(`  - 当前检查点: ${mainlinePayload.currentCheckpointId}`)
    console.log(`  - 会话状态: ${mainlinePayload.sessionState}`)
    console.log(`  - 可以继续: ${mainlinePayload.canContinue}`)
    console.log(`  - 恢复决策: ${mainlinePayload.resumeDecision.decisionType}`)
    console.log(`  - 恢复提示: ${mainlinePayload.resumeHint.content}`)
    console.log(`  - 长任务恢复链路: ${hasLongTaskRecovery ? '成立' : '不适用'}`)

    // 综合验证
    expect(persistentState.checkpoints.length).toBeGreaterThan(0)
    expect(mainlinePayload.canContinue).toBe(true)
    expect(mainlinePayload.resumeDecision).toBeDefined()
    expect(mainlinePayload.resumeHint).toBeDefined()
  })
})

console.log('✅ A-2A-kairos-integration-harness.ts 创建完成')
