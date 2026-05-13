import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { TASK_NOTIFICATION_TAG } from '../../../constants/xml'
import type { QueuedCommand } from '../../../types/textInputTypes'
import { getQueuedCommandAttachments } from '../../../utils/attachments'
import {
  dequeueAll,
  enqueuePendingNotification,
  getCommandQueue,
  isQueuedCommandEditable,
  isQueuedCommandVisible,
  resetCommandQueue,
} from '../../../utils/messageQueueManager'
import { processQueueIfReady } from '../../../utils/queueProcessor'

export type TaskNotificationProcessingEvidence = {
  ok: boolean
  status: 'DONE-EVIDENCED' | 'FAILED-EVIDENCED'
  generatedAt: string
  evidencePath: string
  tracePath: string
  acceptance: {
    taskNotificationIsNotEditableInput: boolean
    mainThreadNotificationProcessedWhileSubagentNotificationRemains: boolean
    executeInputReceivedTaskNotification: boolean
    taskNotificationRemovedAfterProcessing: boolean
    subagentNotificationDidNotBlockMainThread: boolean
    midTurnAttachmentKeepsTaskNotification: boolean
    bashCommandNotInQueuedAttachment: boolean
  }
  trace: Array<{
    event: string
    queueLength: number
    processedCount: number
    modes: string[]
  }>
  processedCommands: Array<{
    mode: string
    value: string
    agentId?: string
  }>
  attachmentSummary: Array<{
    type: string
    commandMode?: string
    promptIncludesNotification: boolean
  }>
  error?: string
}

function notificationXml(input: {
  taskId: string
  summary: string
  status?: 'completed' | 'failed' | 'killed'
}): string {
  return [
    `<${TASK_NOTIFICATION_TAG}>`,
    `<task-id>${input.taskId}</task-id>`,
    '<output-file>D:/tmp/dsxu-task-notification.output</output-file>',
    `<status>${input.status ?? 'completed'}</status>`,
    `<summary>${input.summary}</summary>`,
    `</${TASK_NOTIFICATION_TAG}>`,
  ].join('\n')
}

function traceEvent(
  trace: TaskNotificationProcessingEvidence['trace'],
  event: string,
  processedCommands: QueuedCommand[],
) {
  const queue = getCommandQueue()
  trace.push({
    event,
    queueLength: queue.length,
    processedCount: processedCommands.length,
    modes: queue.map(command => command.mode),
  })
}

export async function runTaskNotificationProcessingHarness(options: {
  evidenceDir?: string
  nowIso?: string
} = {}): Promise<TaskNotificationProcessingEvidence> {
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-tui-terminal')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(
    evidenceDir,
    'task-notification-processing.evidence.json',
  )
  const tracePath = join(
    evidenceDir,
    'task-notification-processing.trace.json',
  )
  const trace: TaskNotificationProcessingEvidence['trace'] = []
  const processedCommands: QueuedCommand[] = []

  try {
    resetCommandQueue()
    const subagentNotification: QueuedCommand = {
      mode: 'task-notification',
      value: notificationXml({
        taskId: 'agent-subthread-only',
        summary: 'subagent-only notification',
      }),
      agentId: 'agent-subthread',
      priority: 'later',
    }
    const mainNotification: QueuedCommand = {
      mode: 'task-notification',
      value: notificationXml({
        taskId: 'agent-main-thread',
        summary: 'main-thread notification',
      }),
      priority: 'later',
    }
    enqueuePendingNotification(subagentNotification)
    enqueuePendingNotification(mainNotification)
    traceEvent(trace, 'queued.subagent_then_main', processedCommands)

    const taskNotificationIsNotEditableInput =
      !isQueuedCommandEditable(mainNotification) &&
      !isQueuedCommandVisible(mainNotification)

    const processResult = processQueueIfReady({
      executeInput: async commands => {
        processedCommands.push(...commands)
      },
    })
    traceEvent(trace, 'processed.main_thread_notification', processedCommands)

    const remaining = getCommandQueue()
    const executeInputReceivedTaskNotification =
      processResult.processed &&
      processedCommands.length === 1 &&
      processedCommands[0]?.mode === 'task-notification' &&
      String(processedCommands[0]?.value).includes('agent-main-thread')
    const taskNotificationRemovedAfterProcessing =
      remaining.length === 1 &&
      remaining[0]?.agentId === 'agent-subthread' &&
      !String(remaining[0]?.value).includes('agent-main-thread')
    const subagentNotificationDidNotBlockMainThread =
      executeInputReceivedTaskNotification && taskNotificationRemovedAfterProcessing

    const attachments = await getQueuedCommandAttachments([
      {
        mode: 'task-notification',
        value: notificationXml({
          taskId: 'agent-mid-turn',
          summary: 'mid-turn notification',
        }),
      },
      {
        mode: 'bash',
        value: 'echo should-not-be-inline-attachment',
      },
    ] as QueuedCommand[])
    const attachmentSummary = attachments.map(attachment => ({
      type: attachment.type,
      commandMode:
        attachment.type === 'queued_command' ? attachment.commandMode : undefined,
      promptIncludesNotification:
        attachment.type === 'queued_command' &&
        typeof attachment.prompt === 'string' &&
        attachment.prompt.includes(`<${TASK_NOTIFICATION_TAG}>`),
    }))
    const midTurnAttachmentKeepsTaskNotification =
      attachmentSummary.length === 1 &&
      attachmentSummary[0]?.type === 'queued_command' &&
      attachmentSummary[0]?.commandMode === 'task-notification' &&
      attachmentSummary[0]?.promptIncludesNotification === true
    const bashCommandNotInQueuedAttachment =
      attachments.every(
        attachment =>
          attachment.type !== 'queued_command' ||
          attachment.commandMode !== 'bash',
      )

    const acceptance = {
      taskNotificationIsNotEditableInput,
      mainThreadNotificationProcessedWhileSubagentNotificationRemains:
        executeInputReceivedTaskNotification,
      executeInputReceivedTaskNotification,
      taskNotificationRemovedAfterProcessing,
      subagentNotificationDidNotBlockMainThread,
      midTurnAttachmentKeepsTaskNotification,
      bashCommandNotInQueuedAttachment,
    }
    const ok = Object.values(acceptance).every(Boolean)
    const evidence: TaskNotificationProcessingEvidence = {
      ok,
      status: ok ? 'DONE-EVIDENCED' : 'FAILED-EVIDENCED',
      generatedAt: options.nowIso ?? new Date().toISOString(),
      evidencePath,
      tracePath,
      acceptance,
      trace,
      processedCommands: processedCommands.map(command => ({
        mode: command.mode,
        value: typeof command.value === 'string' ? command.value : '[blocks]',
        agentId: command.agentId,
      })),
      attachmentSummary,
    }
    await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8')
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    dequeueAll()
    return evidence
  } catch (error) {
    const evidence: TaskNotificationProcessingEvidence = {
      ok: false,
      status: 'FAILED-EVIDENCED',
      generatedAt: options.nowIso ?? new Date().toISOString(),
      evidencePath,
      tracePath,
      acceptance: {
        taskNotificationIsNotEditableInput: false,
        mainThreadNotificationProcessedWhileSubagentNotificationRemains: false,
        executeInputReceivedTaskNotification: false,
        taskNotificationRemovedAfterProcessing: false,
        subagentNotificationDidNotBlockMainThread: false,
        midTurnAttachmentKeepsTaskNotification: false,
        bashCommandNotInQueuedAttachment: false,
      },
      trace,
      processedCommands: [],
      attachmentSummary: [],
      error: error instanceof Error ? error.message : String(error),
    }
    await writeFile(tracePath, `${JSON.stringify(trace, null, 2)}\n`, 'utf8')
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8')
    dequeueAll()
    return evidence
  }
}
