import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import {
  buildAgentContinuationMessageText,
  drainPendingAgentContinuationMessages,
} from '../../../tasks/LocalAgentTask/LocalAgentTask'
import {
  renderAgentEvidencePacket,
  runAsyncAgentLifecycle,
} from '../../../tools/AgentTool/agentToolUtils'
import { createAssistantMessage } from '../../../utils/messages'
import {
  dequeueAll,
  getCommandQueue,
  resetCommandQueue,
} from '../../../utils/messageQueueManager'

export type LocalAgentBackgroundLifecycleEvidence = {
  ok: boolean
  status: 'DONE-EVIDENCED' | 'FAILED-EVIDENCED'
  generatedAt: string
  evidencePath: string
  tracePath: string
  taskId: string
  acceptance: {
    pendingContinuationInjected: boolean
    taskCompletedBeforeWorktreeResult: boolean
    taskOutputCanUnblockBeforeNotification: boolean
    notificationEnqueuedAfterWorktreeResult: boolean
    workerEvidencePacketComplete: boolean
    notificationCarriesTaskIdAndOutputPath: boolean
  }
  timeline: Array<{
    event: string
    status?: string
    queueLength?: number
    timestamp: number
  }>
  evidencePacket?: unknown
  renderedEvidence?: string
  notification?: string
  error?: string
}

function createLocalAgentAppState(
  agentId: string,
  pendingMessages: string[] = [],
) {
  return {
    agentNameRegistry: new Map([['verifier', agentId]]),
    speculation: { status: 'idle' },
    tasks: {
      [agentId]: {
        id: agentId,
        type: 'local_agent',
        status: 'running',
        description: 'V18 local Agent background lifecycle harness',
        prompt: 'Verify DSXU local agent background lifecycle.',
        agentType: 'worker',
        pendingMessages,
        isBackgrounded: true,
        retrieved: false,
        lastReportedToolCount: 0,
        lastReportedTokenCount: 0,
        startTime: Date.now(),
      },
    },
  } as any
}

function taskStatus(appState: any, taskId: string): string | undefined {
  return appState.tasks?.[taskId]?.status
}

function traceEvent(
  timeline: LocalAgentBackgroundLifecycleEvidence['timeline'],
  event: string,
  appState: any,
  taskId: string,
) {
  timeline.push({
    event,
    status: taskStatus(appState, taskId),
    queueLength: getCommandQueue().length,
    timestamp: Date.now(),
  })
}

export async function runLocalAgentBackgroundLifecycleHarness(options: {
  evidenceDir?: string
  nowIso?: string
} = {}): Promise<LocalAgentBackgroundLifecycleEvidence> {
  const evidenceDir =
    options.evidenceDir ?? join(process.cwd(), '.dsxu', 'trace', 'v18-agent')
  await mkdir(evidenceDir, { recursive: true })
  const evidencePath = join(
    evidenceDir,
    'local-agent-background-lifecycle.evidence.json',
  )
  const tracePath = join(
    evidenceDir,
    'local-agent-background-lifecycle.trace.json',
  )
  const taskId = `agent-bg-lifecycle-${Date.now()}`
  const timeline: LocalAgentBackgroundLifecycleEvidence['timeline'] = []
  resetCommandQueue()
  let appState: any = createLocalAgentAppState(taskId, [
    'VERIFIER FAIL: rerun the lifecycle proof after fixing notification ordering.',
  ])
  const setAppState = (updater: (prev: any) => any) => {
    appState = updater(appState)
  }
  const toolUseContext: any = {
    toolUseId: 'tool-agent-bg-lifecycle',
    options: { tools: [] },
    getAppState: () => appState,
    setAppState,
    setAppStateForTasks: setAppState,
  }
  const pendingContinuations = drainPendingAgentContinuationMessages(
    taskId,
    () => appState,
    setAppState,
  )
  const pendingContinuationInjected =
    pendingContinuations.length === 1 &&
    String(pendingContinuations[0]?.message.content).includes(
      'DSXU SendMessage continuation',
    ) &&
    buildAgentContinuationMessageText('sample').includes(
      'Continue the current task',
    )
  traceEvent(timeline, 'continuation.drained', appState, taskId)

  let releaseWorktree!: () => void
  const worktreeCanReturn = new Promise<void>(resolve => {
    releaseWorktree = resolve
  })
  let worktreeStarted!: () => void
  const worktreeStartedSignal = new Promise<void>(resolve => {
    worktreeStarted = resolve
  })
  let statusAtWorktreeStart: string | undefined
  let queueLengthAtWorktreeStart = -1

  try {
    const verificationCommand =
      'bun test src/dsxu/engine/__tests__/local-agent-background-lifecycle-v1.test.ts'
    const lifecycle = runAsyncAgentLifecycle({
      taskId,
      abortController: new AbortController(),
      makeStream: async function* () {
        yield createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'worker-read-lifecycle',
              name: 'Read',
              input: { file_path: 'src/query.ts' },
            } as any,
          ],
          usage: {
            input_tokens: 9,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
        yield createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'worker-verify-lifecycle',
              name: 'PowerShell',
              input: { command: verificationCommand },
            } as any,
          ],
          usage: {
            input_tokens: 12,
            output_tokens: 8,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
        yield {
          type: 'user',
          message: {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'worker-verify-lifecycle',
                content: `${verificationCommand}\n1 pass\n0 fail\n4 expect() calls`,
              },
            ],
          },
        } as any
        yield createAssistantMessage({
          content: [
            'PASS: local Agent background lifecycle proved completion before notification embellishment.',
            `Tests passed: ${verificationCommand}`,
            'Residual risk: None.',
          ].join('\n'),
          usage: {
            input_tokens: 10,
            output_tokens: 14,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
      },
      metadata: {
        prompt: 'Run local Agent background lifecycle harness',
        resolvedAgentModel: 'deepseek-v4-flash',
        isBuiltInAgent: true,
        startTime: Date.now(),
        agentType: 'verification',
        isAsync: true,
      },
      description: 'Verify local Agent background lifecycle',
      toolUseContext,
      rootSetAppState: setAppState,
      agentIdForCleanup: taskId,
      enableSummarization: false,
      getWorktreeResult: async () => {
        statusAtWorktreeStart = taskStatus(appState, taskId)
        queueLengthAtWorktreeStart = getCommandQueue().length
        traceEvent(timeline, 'worktree.started', appState, taskId)
        worktreeStarted()
        await worktreeCanReturn
        traceEvent(timeline, 'worktree.resolved', appState, taskId)
        return {
          worktreePath: 'D:/tmp/dsxu-local-agent-background-lifecycle',
          worktreeBranch: 'agent/background-lifecycle',
        }
      },
    })

    await worktreeStartedSignal
    const taskCompletedBeforeWorktreeResult =
      statusAtWorktreeStart === 'completed'
    const taskOutputCanUnblockBeforeNotification =
      taskStatus(appState, taskId) === 'completed' &&
      queueLengthAtWorktreeStart === 0
    releaseWorktree()
    await lifecycle
    traceEvent(timeline, 'lifecycle.completed', appState, taskId)

    const queued = getCommandQueue()
    const notification = String(queued[0]?.value ?? '')
    const evidencePacket = appState.tasks[taskId]?.result?.evidencePacket
    const renderedEvidence = evidencePacket
      ? renderAgentEvidencePacket(evidencePacket)
      : ''
    const acceptance = {
      pendingContinuationInjected,
      taskCompletedBeforeWorktreeResult,
      taskOutputCanUnblockBeforeNotification,
      notificationEnqueuedAfterWorktreeResult:
        queued.length === 1 &&
        notification.includes('<task-notification>') &&
        notification.includes('<status>completed</status>'),
      workerEvidencePacketComplete:
        evidencePacket?.completion_claim === 'complete' &&
        evidencePacket?.tests_passed?.includes(verificationCommand),
      notificationCarriesTaskIdAndOutputPath:
        notification.includes(`<task-id>${taskId}</task-id>`) &&
        notification.includes('<output-file>') &&
        notification.includes('<worktreePath>D:/tmp/dsxu-local-agent-background-lifecycle</worktreePath>'),
    }
    const ok = Object.values(acceptance).every(Boolean)
    const result: LocalAgentBackgroundLifecycleEvidence = {
      ok,
      status: ok ? 'DONE-EVIDENCED' : 'FAILED-EVIDENCED',
      generatedAt: options.nowIso ?? new Date().toISOString(),
      evidencePath,
      tracePath,
      taskId,
      acceptance,
      timeline,
      evidencePacket,
      renderedEvidence,
      notification,
    }
    await writeFile(tracePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8')
    await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    dequeueAll()
    return result
  } catch (error) {
    const result: LocalAgentBackgroundLifecycleEvidence = {
      ok: false,
      status: 'FAILED-EVIDENCED',
      generatedAt: options.nowIso ?? new Date().toISOString(),
      evidencePath,
      tracePath,
      taskId,
      acceptance: {
        pendingContinuationInjected,
        taskCompletedBeforeWorktreeResult: false,
        taskOutputCanUnblockBeforeNotification: false,
        notificationEnqueuedAfterWorktreeResult: false,
        workerEvidencePacketComplete: false,
        notificationCarriesTaskIdAndOutputPath: false,
      },
      timeline,
      error: error instanceof Error ? error.message : String(error),
    }
    await writeFile(tracePath, `${JSON.stringify(timeline, null, 2)}\n`, 'utf8')
    await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    dequeueAll()
    return result
  }
}
