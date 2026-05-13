import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runTaskNotificationProcessingHarness } from '../../integration/harness/task-notification-processing-v1-harness'

describe('Task notification processing V1', () => {
  test('auto-processes main-thread task notifications without leaving them in the input queue', async () => {
    const result = await runTaskNotificationProcessingHarness({
      nowIso: '2026-05-07T07:35:00.000+08:00',
    })

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.status).toBe('DONE-EVIDENCED')
    expect(result.acceptance).toMatchObject({
      taskNotificationIsNotEditableInput: true,
      mainThreadNotificationProcessedWhileSubagentNotificationRemains: true,
      executeInputReceivedTaskNotification: true,
      taskNotificationRemovedAfterProcessing: true,
      subagentNotificationDidNotBlockMainThread: true,
      midTurnAttachmentKeepsTaskNotification: true,
      bashCommandNotInQueuedAttachment: true,
    })
    expect(result.trace.map(item => item.event)).toEqual([
      'queued.subagent_then_main',
      'processed.main_thread_notification',
    ])
    expect(result.trace[0]).toMatchObject({
      queueLength: 2,
      processedCount: 0,
    })
    expect(result.trace[1]).toMatchObject({
      queueLength: 1,
      processedCount: 1,
    })
    expect(result.processedCommands).toHaveLength(1)
    expect(result.processedCommands[0]).toMatchObject({
      mode: 'task-notification',
    })
    expect(result.processedCommands[0]?.value).toContain('agent-main-thread')
    expect(result.attachmentSummary).toEqual([
      {
        type: 'queued_command',
        commandMode: 'task-notification',
        promptIncludesNotification: true,
      },
    ])
    expect(existsSync(result.evidencePath)).toBe(true)
    expect(existsSync(result.tracePath)).toBe(true)
  })
})
