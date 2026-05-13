/**
 * A-2A: KAIROS Session Snapshot 测试
 *
 * 测试要求：
 * 1. SessionCheckpoint 结构存在
 * 2. PersistentSessionState 结构存在
 * 3. snapshot 输出是结构化的
 * 4. 至少一条快照结果可被 session 持有
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import {
  type SessionCheckpoint,
  type PersistentSessionState,
  type SessionSnapshot,
  type SessionResumeHint,
  createKairosSessionStateMachine
} from '../session'

// 模拟会话快照
const mockSessionSnapshot: SessionSnapshot = {
  sessionId: 'test-session-123',
  timestamp: Date.now(),
  status: 'active',
  messageStats: {
    total: 10,
    user: 3,
    assistant: 3,
    tool: 3,
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
      content: '建议进行上下文压缩',
      priority: 'medium'
    }
  ],
  qualityScore: 80
}

describe('A-2A: KAIROS Session Snapshot 测试', () => {
  test('1. SessionCheckpoint 结构存在', () => {
    // 测试类型定义
    const checkpoint: SessionCheckpoint = {
      checkpointId: 'checkpoint-123',
      sessionId: 'test-session-123',
      timestamp: Date.now(),
      snapshot: mockSessionSnapshot,
      resumeState: {
        canContinue: true,
        resumeHint: {
          type: 'continue',
          content: '继续会话',
          priority: 'high',
          suggestedAction: 'continueSession'
        },
        continuationDecision: {
          decisionType: 'continue',
          sessionId: 'test-session-123',
          resumeInput: {
            inputType: 'continueSession',
            sessionId: 'test-session-123',
            params: {
              fromCheckpoint: false,
              restoreFileState: true,
              restoreMemories: true
            }
          },
          confidence: 0.9,
          reason: '会话处于活跃状态'
        }
      },
      metadata: {
        generatedBy: 'test',
        version: '1.0'
      }
    }

    // 验证结构
    expect(checkpoint.checkpointId).toBe('checkpoint-123')
    expect(checkpoint.sessionId).toBe('test-session-123')
    expect(checkpoint.timestamp).toBeGreaterThan(0)
    expect(checkpoint.snapshot).toBeDefined()
    expect(checkpoint.resumeState).toBeDefined()
    expect(checkpoint.resumeState.canContinue).toBe(true)
    expect(checkpoint.resumeState.resumeHint).toBeDefined()
    expect(checkpoint.resumeState.continuationDecision).toBeDefined()
    expect(checkpoint.metadata).toBeDefined()
  })

  test('2. PersistentSessionState 结构存在', () => {
    // 测试类型定义
    const persistentState: PersistentSessionState = {
      sessionId: 'test-session-123',
      lastActivityTime: Date.now(),
      sessionState: 'active',
      checkpoints: [
        {
          checkpointId: 'checkpoint-1',
          sessionId: 'test-session-123',
          timestamp: Date.now() - 10000,
          snapshot: mockSessionSnapshot,
          resumeState: {
            canContinue: true,
            resumeHint: {
              type: 'continue',
              content: '继续会话',
              priority: 'high',
              suggestedAction: 'continueSession'
            },
            continuationDecision: {
              decisionType: 'continue',
              sessionId: 'test-session-123',
              resumeInput: {
                inputType: 'continueSession',
                sessionId: 'test-session-123',
                params: {
                  fromCheckpoint: false,
                  restoreFileState: true,
                  restoreMemories: true
                }
              },
              confidence: 0.9,
              reason: '会话处于活跃状态'
            }
          },
          metadata: {}
        }
      ],
      currentCheckpointId: 'checkpoint-1',
      resumeHistory: [
        {
          timestamp: Date.now() - 5000,
          checkpointId: 'checkpoint-1',
          resumeType: 'continue',
          success: true
        }
      ]
    }

    // 验证结构
    expect(persistentState.sessionId).toBe('test-session-123')
    expect(persistentState.lastActivityTime).toBeGreaterThan(0)
    expect(persistentState.sessionState).toBe('active')
    expect(persistentState.checkpoints).toBeInstanceOf(Array)
    expect(persistentState.checkpoints.length).toBe(1)
    expect(persistentState.currentCheckpointId).toBe('checkpoint-1')
    expect(persistentState.resumeHistory).toBeInstanceOf(Array)
  })

  test('3. snapshot 输出是结构化的', () => {
    const kairosMachine = createKairosSessionStateMachine('test-session-123')
    const checkpoint = kairosMachine.createCheckpoint(mockSessionSnapshot)

    // 验证快照输出是结构化的，不是字符串
    expect(typeof checkpoint).toBe('object')
    expect(checkpoint).not.toBeNull()

    // 验证具体结构
    expect(checkpoint.checkpointId).toBeDefined()
    expect(typeof checkpoint.checkpointId).toBe('string')
    expect(checkpoint.checkpointId.startsWith('checkpoint-')).toBe(true)

    expect(checkpoint.snapshot).toBeDefined()
    expect(typeof checkpoint.snapshot).toBe('object')
    expect(checkpoint.snapshot.sessionId).toBe('test-session-123')

    expect(checkpoint.resumeState).toBeDefined()
    expect(typeof checkpoint.resumeState).toBe('object')
    expect(checkpoint.resumeState.canContinue).toBeDefined()
    expect(typeof checkpoint.resumeState.canContinue).toBe('boolean')

    expect(checkpoint.metadata).toBeDefined()
    expect(typeof checkpoint.metadata).toBe('object')
    expect(checkpoint.metadata.generatedBy).toBe('kairos-v1')
  })

  test('4. 至少一条快照结果可被 session 持有', () => {
    const kairosMachine = createKairosSessionStateMachine('test-session-123')

    // 创建检查点
    const checkpoint = kairosMachine.createCheckpoint(mockSessionSnapshot)

    // 更新持久化状态
    const persistentState = kairosMachine.updatePersistentState(checkpoint)

    // 验证快照可被session持有
    expect(persistentState.checkpoints.length).toBe(1)
    expect(persistentState.checkpoints[0].checkpointId).toBe(checkpoint.checkpointId)
    expect(persistentState.currentCheckpointId).toBe(checkpoint.checkpointId)
    expect(persistentState.sessionState).toBe('active')

    // 验证可以从session中检索
    const retrievedCheckpoint = persistentState.checkpoints.find(
      cp => cp.checkpointId === checkpoint.checkpointId
    )
    expect(retrievedCheckpoint).toBeDefined()
    expect(retrievedCheckpoint?.snapshot.sessionId).toBe('test-session-123')
  })

  test('5. KAIROS 状态机基本功能', () => {
    const kairosMachine = createKairosSessionStateMachine('test-session-456')

    // 测试创建检查点
    const checkpoint = kairosMachine.createCheckpoint(mockSessionSnapshot)
    expect(checkpoint).toBeDefined()
    expect(checkpoint.sessionId).toBe('test-session-456')

    // 测试更新持久化状态
    const persistentState = kairosMachine.updatePersistentState(checkpoint)
    expect(persistentState.checkpoints.length).toBe(1)

    // 测试获取恢复决策
    const resumeDecision = kairosMachine.getResumeDecision()
    expect(resumeDecision).toBeDefined()
    expect(resumeDecision?.decisionType).toBe('continue')

    // 测试获取恢复提示
    const resumeHint = kairosMachine.getResumeHint()
    expect(resumeHint).toBeDefined()
    expect(resumeHint?.type).toBe('continue')
  })
})

console.log('✅ kairos-session-snapshot-v1.test.ts 测试文件创建完成')
