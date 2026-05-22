import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, test } from 'bun:test'
import {
  buildAgentRuntimeEvidence,
  createAgentTaskRuntimeMetadata,
  enqueueAgentNotification,
  inferAgentWriteScopeFromPrompt,
  killAsyncAgent,
  registerAsyncAgent,
  renderAgentRuntimeEvidence,
  type LocalAgentTaskState,
} from '../../../tasks/LocalAgentTask/LocalAgentTask'
import { cleanupAgentWorktreeForRuntime } from '../../../tools/AgentTool/AgentTool'
import { runAsyncAgentLifecycle } from '../../../tools/AgentTool/agentToolUtils'
import { AbortError } from '../../../utils/errors'
import { createAssistantMessage } from '../../../utils/messages'
import {
  dequeueAll,
  getCommandQueue,
  resetCommandQueue,
} from '../../../utils/messageQueueManager'
import { resolveDSXUAgentOrchestration } from '../agent-role-router-v1'

function localAgentTask(overrides: Partial<LocalAgentTaskState> = {}): LocalAgentTaskState {
  const prompt = [
    'Objective: tighten Agent runtime evidence.',
    'Scope: src/tools/AgentTool/AgentTool.tsx, src/tasks/LocalAgentTask/LocalAgentTask.tsx',
    'Return verification evidence.',
  ].join('\n')
  return {
    id: 'agent-runtime-mainline-1',
    type: 'local_agent',
    status: 'running',
    description: 'Agent runtime evidence',
    toolUseId: 'tool-agent-runtime',
    startTime: 1,
    outputFile: 'D:/DSXU-code/.dsxu/tasks/agent-runtime-mainline-1.jsonl',
    outputOffset: 0,
    notified: false,
    agentId: 'agent-runtime-mainline-1',
    prompt,
    agentType: 'verification',
    abortController: new AbortController(),
    retrieved: false,
    lastReportedToolCount: 0,
    lastReportedTokenCount: 0,
    isBackgrounded: true,
    pendingMessages: [],
    retain: false,
    diskLoaded: false,
    progress: {
      toolUseCount: 2,
      tokenCount: 128,
    },
    runtime: createAgentTaskRuntimeMetadata({
      owner: 'verification',
      prompt,
      cwd: 'D:/DSXU-code',
      isolation: 'worktree_isolation',
    }),
    ...overrides,
  }
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr || result.stdout}`)
  }
  return String(result.stdout).trim()
}

function makeWorkspaceTempRoot(prefix: string): string {
  const baseDir = join(process.cwd(), 'tmp', 'agent-runtime-mainline-v1-tests')
  mkdirSync(baseDir, { recursive: true })
  return mkdtempSync(join(baseDir, prefix))
}

describe('DSXU Agent runtime mainline V1', () => {
  test('builds task-level runtime evidence for parent synthesis and recovery', () => {
    const evidence = buildAgentRuntimeEvidence(localAgentTask())
    const rendered = renderAgentRuntimeEvidence(evidence)

    expect(evidence).toMatchObject({
      taskId: 'agent-runtime-mainline-1',
      taskType: 'local_agent',
      owner: 'verification',
      cwd: 'D:/DSXU-code',
      isolation: 'worktree_isolation',
      placement: 'background',
      lifecycleState: 'running',
      outputPath: 'D:/DSXU-code/.dsxu/tasks/agent-runtime-mainline-1.jsonl',
      progressEventCount: 2,
      canAbort: true,
      canRecover: true,
      recoverPath: 'send_message_continuation',
    })
    expect(evidence.writeScope).toEqual([
      'src/tools/AgentTool/AgentTool.tsx',
      'src/tasks/LocalAgentTask/LocalAgentTask.tsx',
    ])
    expect(rendered).toContain('<agent_runtime>')
    expect(rendered).toContain('write_scope: src/tools/AgentTool/AgentTool.tsx, src/tasks/LocalAgentTask/LocalAgentTask.tsx')
    expect(rendered).toContain('recover_path: send_message_continuation')
  })

  test('keeps unsafe write prompts from pretending to have a scoped owner', () => {
    expect(inferAgentWriteScopeFromPrompt('Implement the feature and edit whatever is needed.')).toEqual([
      'unspecified-write-scope',
    ])
    expect(inferAgentWriteScopeFromPrompt('Read-only investigate src/query.ts and report findings.')).toEqual([
      'src/query.ts',
    ])
  })

  test('downgrades parallel fanout when write scopes overlap', () => {
    const conflict = resolveDSXUAgentOrchestration({
      taskText: 'parallel implementation with overlapping writers',
      requestedMode: 'parallel_fanout',
      workItems: [
        {
          taskId: 'writer-a',
          objective: 'Patch query loop final gate.',
          readOnly: false,
          ownedFiles: ['src/query.ts'],
          role: 'implementer',
        },
        {
          taskId: 'writer-b',
          objective: 'Patch query loop abort gate.',
          readOnly: false,
          ownedFiles: ['src/query.ts'],
          role: 'implementer',
        },
      ],
    })

    expect(conflict.visibleMode).toBe('serial_worker')
    expect(conflict.maxWorkers).toBe(1)
    expect(conflict.evidence.hasWriteConflict).toBe(true)
    expect(conflict.reasons.join('\n')).toContain('overlapping write scopes block parallel fanout')

    const safeFanout = resolveDSXUAgentOrchestration({
      taskText: 'parallel implementation with isolated writers',
      requestedMode: 'parallel_fanout',
      workItems: [
        {
          taskId: 'writer-a',
          objective: 'Patch Agent tool.',
          readOnly: false,
          ownedFiles: ['src/tools/AgentTool/AgentTool.tsx'],
          role: 'implementer',
        },
        {
          taskId: 'writer-b',
          objective: 'Patch Agent tests.',
          readOnly: false,
          ownedFiles: ['src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts'],
          role: 'verifier',
        },
      ],
    })

    expect(safeFanout.visibleMode).toBe('parallel_fanout')
    expect(safeFanout.evidence.hasWriteConflict).toBe(false)
    expect(safeFanout.evidence.allWriteScopesOwned).toBe(true)
  })

  test('replays background abort with worktree runtime evidence and recovery path', async () => {
    resetCommandQueue()
    const taskId = 'agent-runtime-abort-1'
    const prompt = [
      'Objective: prove abort recovery evidence.',
      'Scope: src/tools/AgentTool/resumeAgent.ts',
      'Return partial evidence if stopped.',
    ].join('\n')
    let appState: any = {
      agentNameRegistry: new Map([['abort-worker', taskId]]),
      speculation: { status: 'idle' },
      tasks: {},
    }
    const setAppState = (updater: (prev: any) => any) => {
      appState = updater(appState)
    }
    const runtime = createAgentTaskRuntimeMetadata({
      owner: 'verification',
      prompt,
      cwd: 'D:/tmp/dsxu-agent-runtime-worktree',
      isolation: 'worktree_isolation',
      recoverPath: 'send_message_continuation',
    })
    const abortController = new AbortController()
    registerAsyncAgent({
      agentId: taskId,
      description: 'Abort runtime replay',
      prompt,
      selectedAgent: { agentType: 'verification' } as any,
      setAppState,
      toolUseId: 'tool-agent-runtime-abort',
      parentAbortController: abortController,
      runtime,
    })

    await runAsyncAgentLifecycle({
      taskId,
      abortController,
      makeStream: async function* () {
        yield createAssistantMessage({
          content: 'PARTIAL: captured abort replay setup before cancellation.',
          usage: {
            input_tokens: 7,
            output_tokens: 4,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
        yield createAssistantMessage({
          content: [
            {
              type: 'tool_use',
              id: 'agent-runtime-abort-read',
              name: 'Read',
              input: { file_path: 'src/tools/AgentTool/resumeAgent.ts' },
            } as any,
          ],
          usage: {
            input_tokens: 9,
            output_tokens: 5,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          } as any,
        })
        abortController.abort()
        throw new AbortError()
      },
      metadata: {
        prompt,
        resolvedAgentModel: 'deepseek-v4-flash',
        isBuiltInAgent: true,
        startTime: Date.now(),
        agentType: 'verification',
        isAsync: true,
        runtimeEvidence: {
          ...runtime,
          taskId,
          taskType: 'local_agent',
          lifecycleState: 'running',
          placement: 'background',
          outputPath: appState.tasks[taskId].outputFile,
          progressEventCount: 0,
          canAbort: true,
          canRecover: true,
        },
      },
      description: 'Abort runtime replay',
      toolUseContext: {
        toolUseId: 'tool-agent-runtime-abort',
        options: { tools: [] },
        getAppState: () => appState,
        setAppState,
        setAppStateForTasks: setAppState,
      } as any,
      rootSetAppState: setAppState,
      agentIdForCleanup: taskId,
      enableSummarization: false,
      getWorktreeResult: async () => ({
        worktreePath: 'D:/tmp/dsxu-agent-runtime-worktree',
        worktreeBranch: 'agent/runtime-abort',
      }),
    })

    const task = appState.tasks[taskId] as LocalAgentTaskState
    const evidence = buildAgentRuntimeEvidence(task)
    const notification = String(getCommandQueue()[0]?.value ?? '')

    expect(task.status).toBe('killed')
    expect(evidence).toMatchObject({
      lifecycleState: 'killed',
      placement: 'background',
      isolation: 'worktree_isolation',
      cwd: 'D:/tmp/dsxu-agent-runtime-worktree',
      recoverPath: 'send_message_continuation',
      canAbort: false,
      canRecover: true,
      progressEventCount: 1,
    })
    expect(evidence.writeScope).toEqual(['src/tools/AgentTool/resumeAgent.ts'])
    expect(notification).toContain('<status>killed</status>')
    expect(notification).toContain('<agent_runtime>')
    expect(notification).toContain('lifecycle_state: killed')
    expect(notification).toContain('recover_path: send_message_continuation')
    expect(notification).toContain('<worktreePath>D:/tmp/dsxu-agent-runtime-worktree</worktreePath>')
    expect(notification).toContain('PARTIAL: captured abort replay setup before cancellation.')
    dequeueAll()
  })

  test('keeps changed worktree after cleanup and exposes retention evidence in notification', async () => {
    resetCommandQueue()
    const tempRoot = makeWorkspaceTempRoot('retain-')
    const repoRoot = join(tempRoot, 'repo')
    const worktreePath = join(tempRoot, 'agent-worktree')
    const branch = 'agent-runtime-retain'
    mkdirSync(repoRoot, { recursive: true })
    try {
      git(repoRoot, ['init'])
      git(repoRoot, ['config', 'user.email', 'dsxu@example.test'])
      git(repoRoot, ['config', 'user.name', 'DSXU Test'])
      writeFileSync(join(repoRoot, 'tracked.txt'), 'base\n')
      git(repoRoot, ['add', 'tracked.txt'])
      git(repoRoot, ['commit', '-m', 'base'])
      const headCommit = git(repoRoot, ['rev-parse', 'HEAD'])
      git(repoRoot, ['worktree', 'add', '-b', branch, worktreePath, 'HEAD'])
      writeFileSync(join(worktreePath, 'tracked.txt'), 'changed by agent\n')

      const cleanupResult = await cleanupAgentWorktreeForRuntime({
        worktreeInfo: {
          worktreePath,
          worktreeBranch: branch,
          headCommit,
          gitRoot: repoRoot,
        },
        agentId: 'agent-runtime-retain-1',
        agentType: 'verification',
        description: 'Changed worktree retention replay',
      })

      expect(cleanupResult).toMatchObject({
        worktreePath,
        worktreeBranch: branch,
        retained: true,
        reason: 'changed',
      })
      expect(existsSync(worktreePath)).toBe(true)

      let appState: any = {
        agentNameRegistry: new Map(),
        speculation: { status: 'idle' },
        tasks: {},
      }
      const setAppState = (updater: (prev: any) => any) => {
        appState = updater(appState)
      }
      const taskId = 'agent-runtime-retain-1'
      const prompt = [
        'Objective: retain changed Agent worktree.',
        'Scope: src/tools/AgentTool/AgentTool.tsx',
        'Return retained worktree evidence.',
      ].join('\n')
      registerAsyncAgent({
        agentId: taskId,
        description: 'Changed worktree retention replay',
        prompt,
        selectedAgent: { agentType: 'verification' } as any,
        setAppState,
        toolUseId: 'tool-agent-runtime-retain',
        runtime: createAgentTaskRuntimeMetadata({
          owner: 'verification',
          prompt,
          cwd: worktreePath,
          isolation: 'worktree_isolation',
          recoverPath: 'send_message_continuation',
        }),
      })
      killAsyncAgent(taskId, setAppState)
      enqueueAgentNotification({
        taskId,
        description: 'Changed worktree retention replay',
        status: 'killed',
        setAppState,
        toolUseId: 'tool-agent-runtime-retain',
        finalMessage: 'PARTIAL: changed worktree retained for recovery.',
        worktreePath: cleanupResult.worktreePath,
        worktreeBranch: cleanupResult.worktreeBranch,
      })

      const notification = String(getCommandQueue()[0]?.value ?? '')
      expect(notification).toContain('<agent_runtime>')
      expect(notification).toContain(`cwd: ${worktreePath}`)
      expect(notification).toContain('isolation: worktree_isolation')
      expect(notification).toContain('recover_path: send_message_continuation')
      expect(notification).toContain(`<worktreePath>${worktreePath}</worktreePath>`)
      expect(notification).toContain(`<worktreeBranch>${branch}</worktreeBranch>`)
      expect(notification).toContain('PARTIAL: changed worktree retained for recovery.')
      dequeueAll()
    } finally {
      try {
        git(repoRoot, ['worktree', 'remove', '--force', worktreePath])
      } catch {
        // Best-effort cleanup for temp test worktree.
      }
      try {
        git(repoRoot, ['branch', '-D', branch])
      } catch {
        // Best-effort cleanup for temp test branch.
      }
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('removes clean worktree after cleanup and suppresses stale recovery path', async () => {
    const tempRoot = makeWorkspaceTempRoot('clean-')
    const repoRoot = join(tempRoot, 'repo')
    const worktreePath = join(tempRoot, 'agent-worktree')
    const branch = 'agent-runtime-clean'
    mkdirSync(repoRoot, { recursive: true })
    try {
      git(repoRoot, ['init'])
      git(repoRoot, ['config', 'user.email', 'dsxu@example.test'])
      git(repoRoot, ['config', 'user.name', 'DSXU Test'])
      writeFileSync(join(repoRoot, 'tracked.txt'), 'base\n')
      git(repoRoot, ['add', 'tracked.txt'])
      git(repoRoot, ['commit', '-m', 'base'])
      const headCommit = git(repoRoot, ['rev-parse', 'HEAD'])
      git(repoRoot, ['worktree', 'add', '-b', branch, worktreePath, 'HEAD'])

      const cleanupResult = await cleanupAgentWorktreeForRuntime({
        worktreeInfo: {
          worktreePath,
          worktreeBranch: branch,
          headCommit,
          gitRoot: repoRoot,
        },
        agentId: 'agent-runtime-clean-1',
        agentType: 'verification',
        description: 'Clean worktree cleanup replay',
      })

      expect(cleanupResult).toMatchObject({
        retained: false,
        reason: 'removed_clean',
      })
      expect(cleanupResult.worktreePath).toBeUndefined()
      expect(cleanupResult.worktreeBranch).toBeUndefined()
      expect(existsSync(worktreePath)).toBe(false)
    } finally {
      try {
        git(repoRoot, ['worktree', 'remove', '--force', worktreePath])
      } catch {
        // Best-effort cleanup for temp test worktree.
      }
      try {
        git(repoRoot, ['branch', '-D', branch])
      } catch {
        // Best-effort cleanup for temp test branch.
      }
      rmSync(tempRoot, { recursive: true, force: true })
    }
  })
})
