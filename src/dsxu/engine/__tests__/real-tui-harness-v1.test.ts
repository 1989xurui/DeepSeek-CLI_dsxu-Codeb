import { describe, expect, test } from 'bun:test'
import { readFile, readdir, stat } from 'fs/promises'
import { runRealTuiExitSmoke } from '../../integration/harness/real-tui-harness'

type RealTuiResult = Awaited<ReturnType<typeof runRealTuiExitSmoke>>

function assertRealTuiPreconditionBlocked(result: RealTuiResult): boolean {
  if (!/Input\/output error/i.test(result.tail ?? '')) return false
  expect(result.ok).toBe(false)
  expect(result.status).toBe('exited')
  expect(result.exitCode).toBe(126)
  expect(result.sawWelcome).toBe(false)
  expect(result.sawPrompt).toBe(false)
  return true
}

describe('real TUI harness V1', () => {
  test('keeps progress and mojibake diagnostics escaped and scanner-friendly', async () => {
    const source = await readFile(
      'src/dsxu/integration/harness/real-tui-harness.ts',
      'utf8',
    )

    expect(source).not.toMatch(/[\ufffd\u951f\u65a4\u62f7\u9225\u9239\u923a\u923b\u9233\u9241\u9242\u9245\u922b\u71f6]/u)
    expect(source).toContain('"\\u2713"')
    expect(source).toContain('"\\ufffd"')
    expect(source).toContain('"\\u9239"')
    expect(source).toContain('ensure_ascii=True')
    expect(source).not.toContain('"\\\\u2713"')
    expect(source).not.toContain('"\\\\ufffd"')
  })

  test(
    'starts the real WSL TUI, observes screen readiness, sends /exit, and exits cleanly',
    async () => {
      const result = await runRealTuiExitSmoke({ timeoutMs: 35_000 })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt || result.sawPermissionDialog, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)
      expect(result.transcriptPath).toBeDefined()
      expect(result.tracePath).toBeDefined()
      expect(result.lifecycleTraceDir).toBeDefined()
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect((await stat(result.transcriptPath!)).size).toBeGreaterThan(0)
      expect((await stat(result.tracePath!)).size).toBeGreaterThan(0)
      expect(await readFile(result.tracePath!, 'utf8')).toContain('"event": "done"')
      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      expect(lifecycleFiles.some(file => file.endsWith('.jsonl'))).toBe(true)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_health_snapshot"')
    },
    50_000,
  )

  test(
    'records transcript and trace for a scripted explicit /exit session',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 35_000,
        scenarioName: 'explicit-exit',
        inputsAfterPrompt: ['/exit'],
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).toContain('"event": "input"')
      expect(trace).toContain('"value": "/exit"')
      expect(trace).toContain('"event": "done"')
      expect((await stat(result.transcriptPath!)).size).toBeGreaterThan(0)
    },
    55_000,
  )

  test(
    'replays a real TUI permission prompt with fixed fallback visibility and lifecycle evidence',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 45_000,
        scenarioName: 'permission-fallback-replay',
        permissionPromptReplay: true,
        inputsAfterPrompt: ['\u001b', '/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sawPermissionReplayMarker, result.tail).toBe(true)
      expect(result.sawPermissionFallbackBar, result.tail).toBe(true)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).toContain('"value": "/exit"')

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_permission_prompt_queued"')
      expect(lifecycleText).toContain('"event":"tui_health_snapshot"')
    },
    65_000,
  )

  test(
    'replays a no-progress stall and records an explicit stuck trace before recovery',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 45_000,
        scenarioName: 'no-progress-stall-replay',
        noProgressReplay: true,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sawNoProgressReplayTrace, result.tail).toBe(true)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sawTuiStallTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_no_progress_replay_started"')
      expect(lifecycleText).toContain('"event":"tui_health_stalled"')
      expect(lifecycleText).toContain('"visibleState":"stuck_no_event"')
      expect(lifecycleText).toContain('"event":"tui_harness_no_progress_replay_recovered"')
    },
    65_000,
  )

  test(
    'real task input either progresses or shows explicit auth block without fake waiting',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 55_000,
        scenarioName: 'model-task-auth-or-progress',
        inputsAfterPrompt: ['Please answer exactly DSXU_TUI_MODEL_TASK_READY.', '/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sentInputCount, result.tail).toBeGreaterThanOrEqual(1)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sawMojibake, result.tail).toBe(false)
      expect(result.sawLoginWarning || result.sawProgress || result.sawPromptAfterTask, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).toContain('DSXU_TUI_MODEL_TASK_READY')
      expect(trace).toContain('"event": "done"')
      if (result.sawLoginWarning) {
        expect(result.tail).toContain('/login')
      }
    },
    75_000,
  )

  test(
    'replays tool-result auto-continue so Skill/tool success does not wait for manual continue',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 65_000,
        scenarioName: 'tool-result-auto-continue-replay',
        autoContinueReplay: true,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sawAutoContinueEnqueuedTrace, result.tail).toBe(true)
      expect(result.sawAutoContinueProcessedTrace, result.tail).toBe(true)
      expect(result.sawAutoContinueSuppressedTrace, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).not.toContain('"value": "continue"')
      expect(trace).not.toContain('"value": "Continue"')

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_auto_continue_replay_queued"')
      expect(lifecycleText).toContain('"event":"tool_result_auto_continue_enqueued"')
      expect(lifecycleText).toContain('"event":"tool_result_auto_continue_processed"')
      expect(lifecycleText).toContain('"gateId":"dsxu_tool_result_auto_continue_gate"')
      expect(lifecycleText).toContain('"owner":"query_loop"')
      expect(lifecycleText).toContain('"transport":"repl_command_queue"')
      expect(lifecycleText).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(lifecycleText).toContain('"nextAction":"submit_hidden_continuation_to_query_loop"')
      expect(lifecycleText).toContain('"phase":"started"')
    },
    85_000,
  )

  test(
    'replays compact resume state through TUI auto-continue without manual continue',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 95_000,
        scenarioName: 'compact-resume-auto-continue-replay',
        resumeReplay: true,
        inputsAfterPrompt: ['\u001b', '/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sawResumeReplayQueuedTrace, result.tail).toBe(true)
      expect(result.sawResumeSourceTruthGateTrace, result.tail).toBe(true)
      expect(result.sawResumeProviderPreflightTrace, result.tail).toBe(true)
      expect(result.sawAutoContinueEnqueuedTrace, result.tail).toBe(true)
      expect(result.sawAutoContinueProcessedTrace, result.tail).toBe(true)
      expect(result.sawAutoContinueSuppressedTrace, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).not.toContain('"value": "continue"')
      expect(trace).not.toContain('"value": "Continue"')

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_resume_replay_queued"')
      expect(lifecycleText).toContain('"sourceTruthRefreshRequired":true')
      expect(lifecycleText).toContain('"failedCommandPreserved":true')
      expect(lifecycleText).toContain('"gateId":"dsxu_recovery_post_compact_source_truth_required"')
      expect(lifecycleText).toContain('"gateClass":"QUALITY_BLOCK"')
      expect(lifecycleText).toContain('"nextAction":"read_source_truth"')
      expect(lifecycleText).toContain('"event":"provider_resume_replay_preflight"')
      expect(lifecycleText).toContain('"boundary":"provider_request_preflight"')
      expect(lifecycleText).toContain('"schemaVersion":"dsxu.compact-recovery.v1"')
      expect(lifecycleText).toContain('"sourceTruthRefreshRequired":true')
      expect(lifecycleText).toContain('"failedCommandPreserved":true')
      expect(lifecycleText).toContain('"verificationStatePreserved":true')
      expect(lifecycleText).toContain('"nextActionPreserved":true')
      expect(lifecycleText).toContain('"experienceStorePackPreserved":true')
      expect(lifecycleText).toContain('"event":"tool_result_auto_continue_enqueued"')
      expect(lifecycleText).toContain('"event":"tool_result_auto_continue_processed"')
      expect(lifecycleText).toContain('"gateId":"dsxu_tool_result_auto_continue_gate"')
      expect(lifecycleText).toContain('"owner":"query_loop"')
      expect(lifecycleText).toContain('"transport":"repl_command_queue"')
      expect(lifecycleText).toContain('"gateClass":"RECOVERY_BLOCK"')
      expect(lifecycleText).toContain('"nextAction":"submit_hidden_continuation_to_query_loop"')
      expect(lifecycleText).toContain('"phase":"started"')
    },
    90_000,
  )

  test(
    'replays a live background task pill with query-diagnostic lifecycle evidence',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 65_000,
        scenarioName: 'background-task-live-replay',
        backgroundTaskReplay: true,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.sawBackgroundTaskReplayTrace, result.tail).toBe(true)
      expect(result.sawBackgroundTaskPillMarker, result.tail).toBe(true)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_background_task_replay_registered"')
      expect(lifecycleText).toContain('"visibleState":"background_task_running"')
      expect(lifecycleText).toContain('"id":"a-dsxu-tui-bg-replay"')
      expect(lifecycleText).toContain('"outputFile"')
      expect(lifecycleText).toContain('"toolUseId":"toolu-dsxu-tui-bg-replay"')
    },
    120_000,
  )

  test(
    'keeps long-content TUI output pinned to the tail through real PTY resize',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 75_000,
        scenarioName: 'long-content-resize-sticky-bottom',
        longContentResizeReplay: true,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.resizeReplayRequested, result.tail).toBe(true)
      expect(result.resizeEventsSent ?? 0, result.tail).toBeGreaterThanOrEqual(4)
      expect(result.sawLongContentResizeQueuedTrace, result.tail).toBe(true)
      expect(result.sawLongContentResizeTailMarker, result.tail).toBe(true)
      expect(result.sawLongContentResizeTailAfterResize, result.tail).toBe(true)
      expect(result.sawPromptAfterResize, result.tail).toBe(true)
      expect(result.sawMojibake, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).toContain('"event": "initial_resize"')
      expect(trace).toContain('"event": "resize"')
      expect(trace).toContain('"event": "resize_sequence_done"')

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_long_content_resize_replay_queued"')
      expect(lifecycleText).toContain('"expectedVisibleState":"sticky_bottom_after_resize"')
    },
    95_000,
  )

  test(
    'keeps DSXU trust proof and evidence compact through real PTY resize',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 85_000,
        scenarioName: 'trust-proof-compact-after-resize',
        longContentResizeReplay: true,
        trustProofReplay: true,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.resizeReplayRequested, result.tail).toBe(true)
      expect(result.resizeEventsSent ?? 0, result.tail).toBeGreaterThanOrEqual(4)
      expect(result.sawLongContentResizeTailAfterResize, result.tail).toBe(true)
      expect(result.sawDsxuTrustReplayMarker, result.tail).toBe(true)
      expect(result.sawDsxuEvidenceLine, result.tail).toBe(false)
      expect(result.sawDsxuTrustLine, result.tail).toBe(true)
      expect(result.sawDsxuTrustLedgerLine, result.tail).toBe(true)
      expect(result.sawDsxuTrustAgentLine, result.tail).toBe(true)
      expect(result.sawDsxuTrustProofLine, result.tail).toBe(true)
      expect(result.sawDsxuTrustProofLineAfterResize, result.tail).toBe(true)
      expect(result.sawDsxuTrustProofFlood, result.tail).toBe(false)
      expect(result.sawMojibake, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_trust_proof_replay_queued"')
      expect(lifecycleText).toContain('"expectedVisibleState":"compact_trust_proof_visible"')
    },
    105_000,
  )

  test(
    'keeps permission review visible after long-content PTY resize',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 85_000,
        scenarioName: 'permission-review-after-long-content-resize',
        permissionPromptReplay: true,
        longContentResizeReplay: true,
        inputsAfterPrompt: ['\u001b', '/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.resizeReplayRequested, result.tail).toBe(true)
      expect(result.resizeEventsSent ?? 0, result.tail).toBeGreaterThanOrEqual(4)
      expect(result.sawLongContentResizeQueuedTrace, result.tail).toBe(true)
      expect(result.sawLongContentResizeTailAfterResize, result.tail).toBe(true)
      expect(result.sawPermissionFallbackBar, result.tail).toBe(true)
      expect(result.sawPermissionDialog, result.tail).toBe(true)
      expect(result.sawPermissionDialogBorder, result.tail).toBe(true)
      expect(result.sawPermissionProceedQuestion, result.tail).toBe(true)
      expect(result.sawPermissionDialogAfterResize, result.tail).toBe(true)
      expect(result.sawPermissionDialogBorderAfterResize, result.tail).toBe(true)
      expect(result.sawMojibake, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const lifecycleFiles = await readdir(result.lifecycleTraceDir!)
      const lifecycleText = (
        await Promise.all(
          lifecycleFiles
            .filter(file => file.endsWith('.jsonl'))
            .map(file => readFile(`${result.lifecycleTraceDir!}/${file}`, 'utf8')),
        )
      ).join('\n')
      expect(lifecycleText).toContain('"event":"tui_harness_permission_prompt_queued"')
      expect(lifecycleText).toContain('"event":"tui_harness_long_content_resize_replay_queued"')
    },
    105_000,
  )

  test(
    'preserves a middle scrollback reading position through real PTY resize',
    async () => {
      const result = await runRealTuiExitSmoke({
        timeoutMs: 85_000,
        scenarioName: 'middle-scrollback-resize-anchor',
        scrollbackResizeReplay: true,
        scrollbackPageUps: 5,
        inputsAfterPrompt: ['/exit'],
        waitForNewPromptBetweenInputs: true,
      })
      if (assertRealTuiPreconditionBlocked(result)) return

      expect(result.sawWelcome, result.tail).toBe(true)
      expect(result.sawPrompt, result.tail).toBe(true)
      expect(result.scrollbackResizeReplayRequested, result.tail).toBe(true)
      expect(result.sawScrollbackResizePositionedTrace, result.tail).toBe(true)
      expect(result.resizeEventsSent ?? 0, result.tail).toBeGreaterThanOrEqual(4)
      expect(result.sawLongContentResizeQueuedTrace, result.tail).toBe(true)
      expect(result.sawScrollbackResizeMiddleAfterResize, result.tail).toBe(true)
      expect(result.sawScrollbackResizeTopAfterResize, result.tail).toBe(false)
      expect(result.sawScrollbackResizeTailAfterResize, result.tail).toBe(false)
      expect(result.sawMojibake, result.tail).toBe(false)
      expect(result.sawTuiHealthTrace, result.tail).toBe(true)
      expect(result.sentExit, result.tail).toBe(true)
      expect(result.status, result.tail).toBe('exited')
      expect(result.exitCode, result.tail).toBe(0)
      expect(result.ok, result.tail).toBe(true)

      const trace = await readFile(result.tracePath!, 'utf8')
      expect(trace).toContain('"event": "scrollback_position_done"')
      expect(trace).toContain('"event": "resize_sequence_done"')
    },
    105_000,
  )
})
