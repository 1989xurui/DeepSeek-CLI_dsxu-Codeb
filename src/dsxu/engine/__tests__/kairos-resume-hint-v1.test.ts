/**
 * A-2A: KAIROS Resume Hint 测试
 *
 * 测试要求：
 * 1. ResumeHint 存在
 * 2. continueSession 与 resumeSessionId 至少两种入口能区分
 * 3. resumeHint 不是字符串拼接，而是结构化输出
 * 4. 至少一条恢复提示可被 recovery 或 query-loop 消费
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  type ResumeHint,
  type SessionContinuationDecision,
  type SessionSnapshot,
  type SessionResumeHint,
  shouldContinueSession,
  shouldResumeSessionId,
  generateStructuredResumeHint,
  createKairosSessionStateMachine
} from '../session'

// 模拟活跃会话快照
const mockActiveSessionSnapshot: SessionSnapshot = {
  sessionId: 'test-session-active',
  timestamp: Date.now(),
  status: 'active',
  messageStats: {
    total: 15,
    user: 5,
    assistant: 5,
    tool: 4,
    system: 1
  },
  extractedMemories: [],
  memoryCategoryStats: {
    'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
    'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
  },
  resumeHints: [],
  qualityScore: 85
}

// 模拟暂停会话快照
const mockPausedSessionSnapshot: SessionSnapshot = {
  sessionId: 'test-session-paused',
  timestamp: Date.now(),
  status: 'paused',
  messageStats: {
    total: 8,
    user: 3,
    assistant: 3,
    tool: 1,
    system: 1
  },
  extractedMemories: [],
  memoryCategoryStats: {
    'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
    'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
  },
  resumeHints: [
    {
      type: 'suggestion',
      content: '会话已暂停，点击恢复继续',
      priority: 'medium'
    }
  ],
  qualityScore: 70
}

// 模拟完成会话快照
const mockCompletedSessionSnapshot: SessionSnapshot = {
  sessionId: 'test-session-completed',
  timestamp: Date.now(),
  status: 'completed',
  messageStats: {
    total: 20,
    user: 7,
    assistant: 7,
    tool: 5,
    system: 1
  },
  extractedMemories: [],
  memoryCategoryStats: {
    'bug': 0, 'decision': 0, 'task-state': 0, 'repo-context': 0,
    'recovery-history': 0, 'technical-pattern': 0, 'user-preference': 0
  },
  resumeHints: [
    {
      type: 'suggestion',
      content: '会话已完成，可查看历史记录',
      priority: 'low'
    }
  ],
  qualityScore: 90
}

describe('A-2A: KAIROS Resume Hint 测试', () => {
  test('1. ResumeHint 存在', () => {
    // 测试 ResumeHint 类型定义
    const resumeHint: ResumeHint = {
      type: 'continue',
      content: '继续当前会话',
      priority: 'high',
      suggestedAction: 'continueSession',
      location: {
        timestamp: Date.now(),
        messageIndex: 5,
        filePath: '/test/file.js'
      }
    }

    // 验证结构
    expect(resumeHint.type).toBe('continue')
    expect(resumeHint.content).toBe('继续当前会话')
    expect(resumeHint.priority).toBe('high')
    expect(resumeHint.suggestedAction).toBe('continueSession')
    expect(resumeHint.location).toBeDefined()
    expect(resumeHint.location?.timestamp).toBeGreaterThan(0)
  })

  test('2. continueSession 与 resumeSessionId 至少两种入口能区分', () => {
    // 测试 shouldContinueSession 函数
    const shouldContinueActive = shouldContinueSession(mockActiveSessionSnapshot)
    const shouldContinuePaused = shouldContinueSession(mockPausedSessionSnapshot)
    const shouldContinueCompleted = shouldContinueSession(mockCompletedSessionSnapshot)

    // 活跃会话应该可以继续
    expect(shouldContinueActive).toBe(true)
    // 暂停会话应该可以继续
    expect(shouldContinuePaused).toBe(true)
    // 完成会话不应该继续
    expect(shouldContinueCompleted).toBe(false)

    // 测试 shouldResumeSessionId 函数
    const shouldResumeActive = shouldResumeSessionId(mockActiveSessionSnapshot)
    const shouldResumePaused = shouldResumeSessionId(mockPausedSessionSnapshot)
    const shouldResumeCompleted = shouldResumeSessionId(mockCompletedSessionSnapshot)

    // 活跃会话不应该基于ID恢复（应该继续）
    expect(shouldResumeActive).toBe(false)
    // 暂停会话应该可以基于ID恢复
    expect(shouldResumePaused).toBe(true)
    // 完成会话不应该基于ID恢复
    expect(shouldResumeCompleted).toBe(false)

    // 验证两种入口能区分
    // 活跃会话：continueSession=true, resumeSessionId=false
    expect(shouldContinueActive && !shouldResumeActive).toBe(true)
    // 暂停会话：continueSession=true, resumeSessionId=true
    expect(shouldContinuePaused && shouldResumePaused).toBe(true)
    // 完成会话：continueSession=false, resumeSessionId=false
    expect(!shouldContinueCompleted && !shouldResumeCompleted).toBe(true)
  })

  test('3. resumeHint 不是字符串拼接，而是结构化输出', () => {
    const kairosMachine = createKairosSessionStateMachine('test-session-123')

    // 为不同状态的会话生成检查点
    const activeCheckpoint = kairosMachine.createCheckpoint(mockActiveSessionSnapshot)
    const pausedCheckpoint = kairosMachine.createCheckpoint(mockPausedSessionSnapshot)
    const completedCheckpoint = kairosMachine.createCheckpoint(mockCompletedSessionSnapshot)

    // 验证恢复提示是结构化对象，不是字符串
    expect(typeof activeCheckpoint.resumeState.resumeHint).toBe('object')
    expect(activeCheckpoint.resumeState.resumeHint).not.toBeNull()

    // 验证具体结构
    const activeHint = activeCheckpoint.resumeState.resumeHint
    expect(activeHint.type).toBeDefined()
    expect(typeof activeHint.type).toBe('string')
    expect(activeHint.content).toBeDefined()
    expect(typeof activeHint.content).toBe('string')
    expect(activeHint.priority).toBeDefined()
    expect(typeof activeHint.priority).toBe('string')
    expect(activeHint.suggestedAction).toBeDefined()
    expect(typeof activeHint.suggestedAction).toBe('string')

    // 验证不同状态生成不同的提示
    expect(activeHint.type).toBe('continue')
    expect(activeHint.suggestedAction).toBe('continueSession')

    const pausedHint = pausedCheckpoint.resumeState.resumeHint
    expect(pausedHint.type).toBe('resume')
    expect(pausedHint.suggestedAction).toBe('resumeSessionId')

    const completedHint = completedCheckpoint.resumeState.resumeHint
    expect(completedHint.type).toBe('review')
    expect(completedHint.suggestedAction).toBe('createNewSession')
  })

  test('4. 至少一条恢复提示可被 recovery 或 query-loop 消费', () => {
    // 使用 generateStructuredResumeHint 函数生成恢复提示
    const resumeHint = generateStructuredResumeHint(mockActiveSessionSnapshot, [
      {
        type: 'suggestion',
        content: '检测到未完成的任务',
        priority: 'high'
      }
    ])

    // 验证生成的提示可被消费
    expect(resumeHint).toBeDefined()

    // 验证提示包含消费所需的信息
    expect(resumeHint.type).toBeDefined()
    expect(resumeHint.content).toBeDefined()
    expect(resumeHint.priority).toBeDefined()
    expect(resumeHint.suggestedAction).toBeDefined()

    // 验证提示可以被 recovery 系统消费
    // recovery 系统需要：类型、内容、优先级、建议动作
    const recoveryConsumable = {
      hintType: resumeHint.type,
      message: resumeHint.content,
      priority: resumeHint.priority,
      action: resumeHint.suggestedAction,
      metadata: {
        source: 'kairos',
        timestamp: Date.now()
      }
    }

    expect(recoveryConsumable.hintType).toBe('continue')
    expect(recoveryConsumable.action).toBe('continueSession')
    expect(['low', 'medium', 'high']).toContain(recoveryConsumable.priority)

    // 验证提示可以被 query-loop 消费
    // query-loop 需要：是否应该继续、恢复类型、恢复参数
    const queryLoopConsumable = {
      shouldContinue: resumeHint.suggestedAction === 'continueSession',
      resumeType: resumeHint.type,
      resumeParams: {
        sessionId: mockActiveSessionSnapshot.sessionId,
        action: resumeHint.suggestedAction,
        priority: resumeHint.priority
      }
    }

    expect(queryLoopConsumable.shouldContinue).toBe(true)
    expect(queryLoopConsumable.resumeType).toBe('continue')
    expect(queryLoopConsumable.resumeParams.action).toBe('continueSession')
  })

  test('5. 恢复决策与提示的一致性', () => {
    const kairosMachine = createKairosSessionStateMachine('test-session-consistency')

    // 为活跃会话生成检查点
    const checkpoint = kairosMachine.createCheckpoint(mockActiveSessionSnapshot)

    // 获取恢复决策和提示
    const resumeDecision = checkpoint.resumeState.continuationDecision
    const resumeHint = checkpoint.resumeState.resumeHint

    // 验证决策和提示的一致性
    expect(resumeDecision.decisionType).toBe('continue')
    expect(resumeHint.suggestedAction).toBe('continueSession')

    // 决策类型应该映射到建议动作
    const decisionToActionMap: Record<string, string> = {
      'continue': 'continueSession',
      'resume': 'resumeSessionId',
      'restart': 'createNewSession'
    }

    expect(resumeHint.suggestedAction).toBe(decisionToActionMap[resumeDecision.decisionType])

    // 验证决策包含恢复输入
    expect(resumeDecision.resumeInput).toBeDefined()
    expect(resumeDecision.resumeInput.inputType).toBe('continueSession')
    expect(resumeDecision.resumeInput.sessionId).toBe('test-session-consistency')
  })
})

console.log('✅ kairos-resume-hint-v1.test.ts 测试文件创建完成')
