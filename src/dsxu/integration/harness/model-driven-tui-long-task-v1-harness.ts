import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { runRealTuiExitSmoke, type RealTuiHarnessResult } from './real-tui-harness'

export type DsxuModelDrivenTuiLongTaskStatus =
  | 'DONE_EVIDENCED'
  | 'BLOCKED_EVIDENCED'
  | 'FAIL'

export type DsxuModelDrivenTuiLongTaskEvidence = {
  status: DsxuModelDrivenTuiLongTaskStatus
  ok: boolean
  generatedAt: string
  scenarioName: string
  evidencePath: string
  realTui: {
    status: RealTuiHarnessResult['status']
    exitCode: number | null
    sentExit: boolean
    sentInputCount: number
    sawWelcome: boolean
    sawPrompt: boolean
    sawProgress: boolean
    progressMarkerCount: number
    sawPromptAfterTask: boolean
    sawLoginWarning: boolean
    sawMojibake: boolean
    sawTerminalMojibake: boolean
    sawInputEncodingLoss: boolean
    sawTuiHealthTrace: boolean
    sawTuiStallTrace: boolean
    elapsedMs: number
    outputBytes: number
  }
  guarantees: {
    explicitAuthBlock: boolean
    noFakeWaiting: boolean
    noManualContinueLoop: boolean
    providerCompletedTask: boolean
    stageCloseEligible: boolean
  }
  paths: {
    transcriptPath?: string
    tracePath?: string
    lifecycleTraceDir?: string
    lifecycleTraceFiles?: readonly string[]
  }
  blockers: readonly string[]
  nextStep: string
  tail: string
}

export function classifyDsxuModelDrivenTuiLongTask(input: {
  result: RealTuiHarnessResult
  evidencePath?: string
  scenarioName?: string
  nowIso?: string
}): DsxuModelDrivenTuiLongTaskEvidence {
  const result = input.result
  const blockers: string[] = []
  const baseHealthy =
    result.status === 'exited' &&
    result.exitCode === 0 &&
    result.sentExit &&
    result.sawWelcome &&
    result.sawPrompt &&
    result.sawTuiHealthTrace
  const noFakeWaiting =
    baseHealthy &&
    !result.sawTuiStallTrace &&
    !result.sawMojibake &&
    !result.sawTerminalMojibake &&
    !result.sawInputEncodingLoss
  const noManualContinueLoop = result.sentInputCount <= 2
  const explicitAuthBlock = noFakeWaiting && result.sawLoginWarning
  const providerCompletedTask =
    noFakeWaiting &&
    !result.sawLoginWarning &&
    result.sentInputCount >= 2 &&
    (result.sawPromptAfterTask || result.progressMarkerCount >= 2)

  if (!baseHealthy) {
    blockers.push('real TUI did not exit cleanly with visible prompt and health trace')
  }
  if (result.sawTuiStallTrace) blockers.push('TUI emitted a stall trace')
  if (result.sawMojibake || result.sawTerminalMojibake || result.sawInputEncodingLoss) {
    blockers.push('TUI output contained mojibake or input encoding loss')
  }
  if (!noManualContinueLoop) {
    blockers.push('scripted session required more than task input plus /exit')
  }
  if (!result.sawLoginWarning && !providerCompletedTask) {
    blockers.push('provider neither completed the task nor produced an explicit auth block')
  }

  let status: DsxuModelDrivenTuiLongTaskStatus = 'FAIL'
  if (providerCompletedTask && noManualContinueLoop) {
    status = 'DONE_EVIDENCED'
  } else if (explicitAuthBlock && noManualContinueLoop) {
    status = 'BLOCKED_EVIDENCED'
  }

  return {
    status,
    ok: status === 'DONE_EVIDENCED',
    generatedAt: input.nowIso ?? new Date().toISOString(),
    scenarioName: input.scenarioName ?? 'model-driven-long-task-replay-20260507',
    evidencePath:
      input.evidencePath ??
      join(process.cwd(), '.dsxu', 'trace', 'v18-tui', 'model-driven-long-task-replay-20260507.evidence.json'),
    realTui: {
      status: result.status,
      exitCode: result.exitCode,
      sentExit: result.sentExit,
      sentInputCount: result.sentInputCount,
      sawWelcome: result.sawWelcome,
      sawPrompt: result.sawPrompt,
      sawProgress: result.sawProgress,
      progressMarkerCount: result.progressMarkerCount,
      sawPromptAfterTask: result.sawPromptAfterTask,
      sawLoginWarning: result.sawLoginWarning,
      sawMojibake: result.sawMojibake,
      sawTerminalMojibake: result.sawTerminalMojibake,
      sawInputEncodingLoss: result.sawInputEncodingLoss,
      sawTuiHealthTrace: result.sawTuiHealthTrace,
      sawTuiStallTrace: result.sawTuiStallTrace,
      elapsedMs: result.elapsedMs,
      outputBytes: result.outputBytes,
    },
    guarantees: {
      explicitAuthBlock,
      noFakeWaiting,
      noManualContinueLoop,
      providerCompletedTask,
      stageCloseEligible: status === 'DONE_EVIDENCED',
    },
    paths: {
      transcriptPath: result.transcriptPath,
      tracePath: result.tracePath,
      lifecycleTraceDir: result.lifecycleTraceDir,
      lifecycleTraceFiles: result.lifecycleTraceFiles,
    },
    blockers,
    nextStep:
      status === 'DONE_EVIDENCED'
        ? 'Regenerate stage-close readiness; this signal can unlock the 22-case stage-close prerequisite.'
        : status === 'BLOCKED_EVIDENCED'
          ? 'Provide model provider credentials and rerun the same harness; do not count auth-blocked evidence as stage-close green.'
          : 'Inspect transcript, trace, and lifecycle files before changing query-loop or TUI code.',
    tail: result.tail,
  }
}

export async function runDsxuModelDrivenTuiLongTaskHarness(input: {
  evidenceDir?: string
  scenarioName?: string
  timeoutMs?: number
  nowIso?: string
} = {}): Promise<DsxuModelDrivenTuiLongTaskEvidence> {
  const root = process.cwd()
  const evidenceDir = input.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-tui')
  const scenarioName = input.scenarioName ?? 'model-driven-long-task-replay-20260507'
  const evidencePath = join(evidenceDir, `${scenarioName}.evidence.json`)
  await mkdir(evidenceDir, { recursive: true })

  const result = await runRealTuiExitSmoke({
    timeoutMs: input.timeoutMs ?? 90_000,
    scenarioName,
    inputsAfterPrompt: [
      [
        'DSXU V18 model-driven long-task replay:',
        '1. inspect the current task briefly;',
        '2. produce a two-step plan;',
        '3. finish with DSXU_TUI_LONG_TASK_DONE.',
        'Do not perform destructive actions.',
      ].join(' '),
      '/exit',
    ],
    waitForNewPromptBetweenInputs: true,
  })
  const evidence = classifyDsxuModelDrivenTuiLongTask({
    result,
    evidencePath,
    scenarioName,
    nowIso: input.nowIso,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
