import { describe, it, expect } from 'bun:test'
import {
  createEpisode,
  updateEpisodeState,
  addToolEvent,
  updateEpisodeOutcome,
  addNoteToEpisode,
  isEpisodeCompleted,
  getEpisodeDuration,
  type Episode,
  type RuntimeStateEvent,
  type ToolEvent,
  type EpisodeOutcome
} from '../../episode-memory'

describe('9A-D: Episode Memory 核心结构定义验证', () => {
  describe('1. createEpisode 能创建最小 episode', () => {
    it('应该创建包含所有必需字段的最小 episode', () => {
      const options = {
        taskId: 'test-task-001',
        sessionId: 'test-session-001',
        notes: ['测试备注1', '测试备注2'],
        metadata: {
          tags: ['test', 'episode'],
          custom: { priority: 'high' }
        }
      }

      const episode = createEpisode(options)

      // 验证必需字段存在
      expect(episode.episodeId).toBeDefined()
      expect(episode.episodeId).toMatch(/^episode-\d+-[a-z0-9]+$/)
      expect(episode.taskId).toBe('test-task-001')
      expect(episode.sessionId).toBe('test-session-001')
      expect(Array.isArray(episode.states)).toBe(true)
      expect(episode.states.length).toBe(0)
      expect(Array.isArray(episode.toolEvents)).toBe(true)
      expect(episode.toolEvents.length).toBe(0)
      expect(episode.finalOutcome).toBe('success')
      expect(episode.startedAt).toBeGreaterThan(0)
      expect(episode.completedAt).toBeGreaterThan(0)
      expect(episode.startedAt).toBe(episode.completedAt) // 初始时相同

      console.log('创建的最小 episode:', {
        episodeId: episode.episodeId,
        taskId: episode.taskId,
        sessionId: episode.sessionId,
        finalOutcome: episode.finalOutcome,
        startedAt: new Date(episode.startedAt).toISOString(),
        statesCount: episode.states.length,
        toolEventsCount: episode.toolEvents.length
      })
    })

    it('应该支持初始状态和工具事件', () => {
      const initialState: RuntimeStateEvent[] = [
        {
          type: 'initialized',
          value: { status: 'ready' },
          timestamp: Date.now(),
          context: { source: 'test' }
        }
      ]

      const initialToolEvents: ToolEvent[] = [
        {
          eventId: 'tool-event-001',
          toolName: 'FileEdit',
          type: 'tool_call',
          input: { filePath: 'test.ts' },
          timestamp: Date.now(),
          success: true
        }
      ]

      const episode = createEpisode({
        taskId: 'task-with-initial',
        sessionId: 'session-with-initial',
        initialState,
        initialToolEvents
      })

      expect(episode.states.length).toBe(1)
      expect(episode.states[0].type).toBe('initialized')
      expect(episode.states[0].context?.source).toBe('test')

      expect(episode.toolEvents.length).toBe(1)
      expect(episode.toolEvents[0].eventId).toBe('tool-event-001')
      expect(episode.toolEvents[0].toolName).toBe('FileEdit')
      expect(episode.toolEvents[0].type).toBe('tool_call')
    })
  })

  describe('2. episode event 结构有效', () => {
    it('RuntimeStateEvent 结构合法', () => {
      const stateEvent: RuntimeStateEvent = {
        type: 'progress',
        value: { percentage: 50, message: '处理中' },
        timestamp: Date.now(),
        context: { step: 2, totalSteps: 5 }
      }

      expect(stateEvent.type).toBe('progress')
      expect(stateEvent.value.percentage).toBe(50)
      expect(stateEvent.timestamp).toBeGreaterThan(0)
      expect(stateEvent.context?.step).toBe(2)

      // 验证可放入 episode 中
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })
      const updatedEpisode = updateEpisodeState(episode, stateEvent)

      expect(updatedEpisode.states.length).toBe(1)
      expect(updatedEpisode.states[0]).toEqual(stateEvent)
    })

    it('ToolEvent 结构合法', () => {
      const toolEvent: ToolEvent = {
        eventId: 'test-tool-event-001',
        toolName: 'Bash',
        type: 'tool_result',
        input: { command: 'ls -la' },
        output: { stdout: 'file1.txt\nfile2.txt', stderr: '', exitCode: 0 },
        timestamp: Date.now(),
        durationMs: 150,
        success: true
      }

      expect(toolEvent.eventId).toBe('test-tool-event-001')
      expect(toolEvent.toolName).toBe('Bash')
      expect(toolEvent.type).toBe('tool_result')
      expect(toolEvent.input?.command).toBe('ls -la')
      expect(toolEvent.output?.stdout).toContain('file1.txt')
      expect(toolEvent.timestamp).toBeGreaterThan(0)
      expect(toolEvent.durationMs).toBe(150)
      expect(toolEvent.success).toBe(true)

      // 验证可放入 episode 中
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })
      const updatedEpisode = addToolEvent(episode, toolEvent)

      expect(updatedEpisode.toolEvents.length).toBe(1)
      expect(updatedEpisode.toolEvents[0]).toEqual(toolEvent)
    })

    it('支持不同的 ToolEvent 类型', () => {
      const eventTypes: Array<ToolEvent['type']> = [
        'tool_call',
        'tool_result',
        'tool_error',
        'tool_skipped'
      ]

      eventTypes.forEach(eventType => {
        const toolEvent: ToolEvent = {
          eventId: `event-${eventType}`,
          toolName: 'TestTool',
          type: eventType,
          timestamp: Date.now()
        }

        expect(toolEvent.type).toBe(eventType)

        if (eventType === 'tool_error') {
          toolEvent.error = '测试错误'
          toolEvent.success = false
          expect(toolEvent.error).toBe('测试错误')
          expect(toolEvent.success).toBe(false)
        }
      })
    })
  })

  describe('3. 基础辅助函数有效', () => {
    it('updateEpisodeState() 应该添加状态并更新元数据', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })

      const originalUpdatedAt = episode.metadata.updatedAt

      // 等待一小段时间确保时间戳不同
      Bun.sleepSync(10)

      const newState: RuntimeStateEvent = {
        type: 'state_update',
        value: { newValue: 'updated' },
        timestamp: Date.now()
      }

      const updatedEpisode = updateEpisodeState(episode, newState)

      expect(updatedEpisode.states.length).toBe(1)
      expect(updatedEpisode.states[0]).toEqual(newState)
      expect(updatedEpisode.metadata.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })

    it('addToolEvent() 应该添加工具事件并更新元数据', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })

      const originalUpdatedAt = episode.metadata.updatedAt

      Bun.sleepSync(10)

      const toolEvent: ToolEvent = {
        eventId: 'test-event',
        toolName: 'FileEdit',
        type: 'tool_call',
        timestamp: Date.now()
      }

      const updatedEpisode = addToolEvent(episode, toolEvent)

      expect(updatedEpisode.toolEvents.length).toBe(1)
      expect(updatedEpisode.toolEvents[0]).toEqual(toolEvent)
      expect(updatedEpisode.metadata.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })

    it('updateEpisodeOutcome() 应该更新最终结果和完成时间', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })

      const originalCompletedAt = episode.completedAt
      const outcomes: EpisodeOutcome[] = ['success', 'rollback', 'failed', 'aborted', 'timeout', 'max_errors', 'max_turns']

      outcomes.forEach(outcome => {
        Bun.sleepSync(10)

        const updatedEpisode = updateEpisodeOutcome(episode, outcome)

        expect(updatedEpisode.finalOutcome).toBe(outcome)
        expect(updatedEpisode.completedAt).toBeGreaterThan(originalCompletedAt)
        expect(updatedEpisode.completedAt).toBeGreaterThan(updatedEpisode.startedAt)
      })
    })

    it('addNoteToEpisode() 应该添加备注并更新元数据', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session',
        notes: ['初始备注']
      })

      const originalUpdatedAt = episode.metadata.updatedAt
      const originalNotesCount = episode.notes?.length || 0

      Bun.sleepSync(10)

      const updatedEpisode = addNoteToEpisode(episode, '新增备注')

      expect(updatedEpisode.notes?.length).toBe(originalNotesCount + 1)
      expect(updatedEpisode.notes).toContain('初始备注')
      expect(updatedEpisode.notes).toContain('新增备注')
      expect(updatedEpisode.metadata.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
  })

  describe('4. 完成态 / 时长逻辑有效', () => {
    it('isEpisodeCompleted() 应该正确判断完成状态', () => {
      // 初始状态 - 未完成（startedAt === completedAt）
      const initialEpisode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })
      expect(isEpisodeCompleted(initialEpisode)).toBe(false)

      // 等待一小段时间确保时间戳不同
      Bun.sleepSync(10)

      // 更新为完成状态
      const completedEpisode = updateEpisodeOutcome(initialEpisode, 'success')
      expect(isEpisodeCompleted(completedEpisode)).toBe(true)
      expect(completedEpisode.completedAt).toBeGreaterThan(completedEpisode.startedAt)
    })

    it('getEpisodeDuration() 应该计算正确的持续时间', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })

      // 初始状态 - 持续时间应该很小（接近0）
      const initialDuration = getEpisodeDuration(episode)
      expect(initialDuration).toBeGreaterThanOrEqual(0)
      expect(initialDuration).toBeLessThan(100) // 应该很小

      // 模拟一段时间后
      Bun.sleepSync(100)
      const durationAfterSleep = getEpisodeDuration(episode)
      expect(durationAfterSleep).toBeGreaterThanOrEqual(100)

      // 完成后的持续时间
      const completedEpisode = updateEpisodeOutcome(episode, 'success')
      const finalDuration = getEpisodeDuration(completedEpisode)
      expect(finalDuration).toBeGreaterThan(0)
      expect(finalDuration).toBe(completedEpisode.completedAt - completedEpisode.startedAt)
    })

    it('不同 outcome 应该正确设置 completedAt', () => {
      const testOutcomes: EpisodeOutcome[] = ['failed', 'aborted', 'timeout']

      testOutcomes.forEach(outcome => {
        // 为每个 outcome 创建新的 episode
        const episode = createEpisode({
          taskId: `test-task-${outcome}`,
          sessionId: 'test-session'
        })

        // 等待一小段时间确保时间戳不同
        Bun.sleepSync(10)

        const updatedEpisode = updateEpisodeOutcome(episode, outcome)

        expect(updatedEpisode.finalOutcome).toBe(outcome)
        expect(updatedEpisode.completedAt).toBeGreaterThan(updatedEpisode.startedAt)
        expect(isEpisodeCompleted(updatedEpisode)).toBe(true)
      })
    })
  })

  describe('5. 预留字段可安全初始化', () => {
    it('预留字段应该可安全存在或缺省', () => {
      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session'
      })

      // 验证预留字段存在且类型正确
      expect(episode.slices).toBeUndefined() // 或空数组
      expect(episode.verifySummary).toBeUndefined()
      expect(episode.reviewSummary).toBeUndefined()
      expect(episode.defaultChainResult).toBeUndefined()
      expect(Array.isArray(episode.notes)).toBe(true)
      expect(episode.metadata).toBeDefined()

      // 验证 metadata 结构
      expect(episode.metadata.createdAt).toBeGreaterThan(0)
      expect(episode.metadata.updatedAt).toBeGreaterThan(0)
      expect(episode.metadata.version).toBe('1.0.0')
      expect(Array.isArray(episode.metadata.tags)).toBe(true)
      expect(episode.metadata.tags?.length).toBe(0)
      expect(episode.metadata.custom).toBeUndefined()

      console.log('预留字段验证:', {
        hasSlices: episode.slices !== undefined,
        hasVerifySummary: episode.verifySummary !== undefined,
        hasReviewSummary: episode.reviewSummary !== undefined,
        hasDefaultChainResult: episode.defaultChainResult !== undefined,
        notesCount: episode.notes?.length || 0,
        metadata: {
          createdAt: new Date(episode.metadata.createdAt).toISOString(),
          version: episode.metadata.version,
          tagsCount: episode.metadata.tags?.length || 0
        }
      })
    })

    it('应该支持自定义 metadata', () => {
      const customMetadata = {
        tags: ['urgent', 'debug'],
        custom: {
          environment: 'test',
          userId: 'user-123',
          extra: { nested: 'value' }
        }
      }

      const episode = createEpisode({
        taskId: 'test-task',
        sessionId: 'test-session',
        metadata: customMetadata
      })

      expect(episode.metadata.tags).toEqual(['urgent', 'debug'])
      expect(episode.metadata.custom?.environment).toBe('test')
      expect(episode.metadata.custom?.userId).toBe('user-123')
      expect(episode.metadata.custom?.extra.nested).toBe('value')
    })

    it('notes 字段应该正确处理', () => {
      // 测试无 notes
      const episode1 = createEpisode({
        taskId: 'test-task-1',
        sessionId: 'test-session-1'
      })
      expect(Array.isArray(episode1.notes)).toBe(true)
      expect(episode1.notes?.length).toBe(0)

      // 测试有 notes
      const episode2 = createEpisode({
        taskId: 'test-task-2',
        sessionId: 'test-session-2',
        notes: ['备注1', '备注2']
      })
      expect(episode2.notes).toEqual(['备注1', '备注2'])

      // 测试添加 notes
      const episode3 = addNoteToEpisode(episode2, '备注3')
      expect(episode3.notes).toEqual(['备注1', '备注2', '备注3'])
    })
  })
})
