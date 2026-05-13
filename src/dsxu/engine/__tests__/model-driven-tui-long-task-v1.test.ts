import { describe, expect, test } from 'bun:test'
import {
  classifyDsxuModelDrivenTuiLongTask,
  type DsxuModelDrivenTuiLongTaskEvidence,
} from '../../integration/harness/model-driven-tui-long-task-v1-harness'
import type { RealTuiHarnessResult } from '../../integration/harness/real-tui-harness'

function result(input: Partial<RealTuiHarnessResult> = {}): RealTuiHarnessResult {
  return {
    ok: true,
    status: 'exited',
    exitCode: 0,
    sentExit: true,
    sawWelcome: true,
    sawPrompt: true,
    sawProgress: true,
    progressMarkerCount: 2,
    sawLoginWarning: false,
    sawMojibake: false,
    sawTerminalMojibake: false,
    sawInputEncodingLoss: false,
    sentInputCount: 2,
    sawPromptAfterTask: true,
    sawPermissionFallbackBar: false,
    sawPermissionReplayMarker: false,
    sawAutoContinueReplayMarker: false,
    sawResumeReplayMarker: false,
    sawResumeReplayQueuedTrace: false,
    sawAutoContinueEnqueuedTrace: false,
    sawAutoContinueSuppressedTrace: false,
    sawTuiHealthTrace: true,
    sawTuiStallTrace: false,
    outputBytes: 2048,
    elapsedMs: 12_000,
    tail: 'DSXU_TUI_LONG_TASK_DONE',
    transcriptPath: '/tmp/transcript.txt',
    tracePath: '/tmp/trace.jsonl',
    lifecycleTraceDir: '/tmp/lifecycle',
    lifecycleTraceFiles: ['/tmp/lifecycle/dsxu-lifecycle-1.jsonl'],
    ...input,
  }
}

function classify(input: Partial<RealTuiHarnessResult>): DsxuModelDrivenTuiLongTaskEvidence {
  return classifyDsxuModelDrivenTuiLongTask({
    result: result(input),
    evidencePath: '.dsxu/trace/v18-tui/model-driven-long-task-replay-20260507.evidence.json',
    nowIso: '2026-05-07T10:00:00.000Z',
  })
}

describe('model-driven TUI long task V1', () => {
  test('counts a completed provider task as stage-close eligible only with health trace and no manual continue loop', () => {
    const evidence = classify({})

    expect(evidence.status).toBe('DONE_EVIDENCED')
    expect(evidence.ok).toBe(true)
    expect(evidence.guarantees.stageCloseEligible).toBe(true)
    expect(evidence.guarantees.noFakeWaiting).toBe(true)
    expect(evidence.guarantees.noManualContinueLoop).toBe(true)
  })

  test('records explicit auth blocks as evidence but keeps stage-close closed', () => {
    const evidence = classify({
      sawLoginWarning: true,
      sawPromptAfterTask: true,
      tail: 'Not logged in. Run /login',
    })

    expect(evidence.status).toBe('BLOCKED_EVIDENCED')
    expect(evidence.ok).toBe(false)
    expect(evidence.guarantees.explicitAuthBlock).toBe(true)
    expect(evidence.guarantees.stageCloseEligible).toBe(false)
    expect(evidence.nextStep).toContain('Provide model provider credentials')
  })

  test('fails hidden stalls, mojibake, and repeated manual continue loops', () => {
    expect(classify({ sawTuiStallTrace: true }).status).toBe('FAIL')
    expect(classify({ sawMojibake: true }).status).toBe('FAIL')
    expect(classify({ sentInputCount: 5 }).status).toBe('FAIL')
  })

  test('does not treat a clean shell exit as provider completion when the task never progressed', () => {
    const evidence = classify({
      sawProgress: false,
      progressMarkerCount: 0,
      sawPromptAfterTask: false,
      tail: 'plain prompt returned',
    })

    expect(evidence.status).toBe('FAIL')
    expect(evidence.blockers).toContain(
      'provider neither completed the task nor produced an explicit auth block',
    )
  })
})
