import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  runRealTuiExitSmoke,
  type RealTuiHarnessOptions,
  type RealTuiHarnessResult,
} from '../src/dsxu/integration/harness/real-tui-harness'

type ScenarioCheck = {
  id: string
  pass: boolean
  evidence: string[]
}

type ScenarioReport = {
  id: string
  status: 'PASS' | 'FAIL' | 'BLOCKED'
  required: boolean
  checks: ScenarioCheck[]
  blockers: string[]
  result: Pick<
    RealTuiHarnessResult,
    | 'status'
    | 'exitCode'
    | 'sentExit'
    | 'sawWelcome'
    | 'sawPrompt'
    | 'sawLongContentResizeMarker'
    | 'sawLongContentResizeTailMarker'
    | 'sawLongContentResizeTailAfterResize'
    | 'sawPromptAfterResize'
    | 'sawLongContentResizeQueuedTrace'
    | 'sawScrollbackResizeMiddleAfterResize'
    | 'sawScrollbackResizeTopAfterResize'
    | 'sawScrollbackResizeTailAfterResize'
    | 'sawScrollbackResizePositionedTrace'
    | 'sawPermissionDialogAfterResize'
    | 'sawPermissionDialogBorderAfterResize'
    | 'sawDsxuTrustProofLineAfterResize'
    | 'sawDsxuTrustProofFlood'
    | 'resizeEventsSent'
    | 'scrollbackPageUpsSent'
    | 'sawTerminalMojibake'
    | 'sawInputEncodingLoss'
    | 'transcriptPath'
    | 'tracePath'
    | 'lifecycleTraceDir'
    | 'elapsedMs'
    | 'error'
  >
}

type AcceptanceReport = {
  schemaVersion: 'dsxu.v6.pty-tui-acceptance.v1'
  generatedAt: string
  owner: 'TUI Trust Surface / PTY Harness'
  status: 'PASS_V6_PTY_TUI_ACCEPTANCE' | 'BLOCKED_V6_PTY_TUI_ACCEPTANCE'
  claimBoundary: string
  scenarios: ScenarioReport[]
  blockers: string[]
}

const ROOT = process.cwd()
const DATE = '20260519'
const EVIDENCE_DIR = join(ROOT, '.dsxu', 'trace', 'v6-pty-tui-acceptance')
const OUT_JSON = join(ROOT, 'docs', 'generated', `DSXU_V6_PTY_TUI_ACCEPTANCE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_PTY_TUI_ACCEPTANCE_${DATE}.md`)

function rel(path?: string): string {
  return path ? relative(ROOT, path).replace(/\\/g, '/') : ''
}

function check(id: string, pass: boolean, evidence: string[]): ScenarioCheck {
  return { id, pass, evidence }
}

function commonChecks(result: RealTuiHarnessResult): ScenarioCheck[] {
  return [
    check('exited-cleanly', result.status === 'exited' && result.exitCode === 0, [
      `status=${result.status}`,
      `exitCode=${String(result.exitCode)}`,
    ]),
    check('sent-exit', result.sentExit, [`sentExit=${result.sentExit}`]),
    check('welcome-and-prompt-visible', result.sawWelcome && result.sawPrompt, [
      `sawWelcome=${result.sawWelcome}`,
      `sawPrompt=${result.sawPrompt}`,
    ]),
    check('no-terminal-mojibake', !result.sawTerminalMojibake && !result.sawInputEncodingLoss, [
      `sawTerminalMojibake=${result.sawTerminalMojibake}`,
      `sawInputEncodingLoss=${result.sawInputEncodingLoss}`,
    ]),
    check('artifacts-present', Boolean(result.transcriptPath && result.tracePath && result.lifecycleTraceDir), [
      `transcript=${rel(result.transcriptPath)}`,
      `trace=${rel(result.tracePath)}`,
      `lifecycle=${rel(result.lifecycleTraceDir)}`,
    ]),
  ]
}

function modalChecks(result: RealTuiHarnessResult): ScenarioCheck[] {
  return [
    check('modal-session-alive', result.status === 'timeout' || result.status === 'exited', [
      `status=${result.status}`,
      `exitCode=${String(result.exitCode)}`,
    ]),
    check('sent-exit-or-modal-held-input', result.sentExit || Boolean(result.sawPermissionDialogAfterResize), [
      `sentExit=${result.sentExit}`,
      `sawPermissionDialogAfterResize=${result.sawPermissionDialogAfterResize}`,
    ]),
    check('welcome-visible-before-modal', result.sawWelcome, [`sawWelcome=${result.sawWelcome}`]),
    check('no-terminal-mojibake', !result.sawTerminalMojibake && !result.sawInputEncodingLoss, [
      `sawTerminalMojibake=${result.sawTerminalMojibake}`,
      `sawInputEncodingLoss=${result.sawInputEncodingLoss}`,
    ]),
    check('artifacts-present', Boolean(result.transcriptPath && result.tracePath && result.lifecycleTraceDir), [
      `transcript=${rel(result.transcriptPath)}`,
      `trace=${rel(result.tracePath)}`,
      `lifecycle=${rel(result.lifecycleTraceDir)}`,
    ]),
  ]
}

function summarizeResult(result: RealTuiHarnessResult): ScenarioReport['result'] {
  return {
    status: result.status,
    exitCode: result.exitCode,
    sentExit: result.sentExit,
    sawWelcome: result.sawWelcome,
    sawPrompt: result.sawPrompt,
    sawLongContentResizeMarker: result.sawLongContentResizeMarker,
    sawLongContentResizeTailMarker: result.sawLongContentResizeTailMarker,
    sawLongContentResizeTailAfterResize: result.sawLongContentResizeTailAfterResize,
    sawPromptAfterResize: result.sawPromptAfterResize,
    sawLongContentResizeQueuedTrace: result.sawLongContentResizeQueuedTrace,
    sawScrollbackResizeMiddleAfterResize: result.sawScrollbackResizeMiddleAfterResize,
    sawScrollbackResizeTopAfterResize: result.sawScrollbackResizeTopAfterResize,
    sawScrollbackResizeTailAfterResize: result.sawScrollbackResizeTailAfterResize,
    sawScrollbackResizePositionedTrace: result.sawScrollbackResizePositionedTrace,
    sawPermissionDialogAfterResize: result.sawPermissionDialogAfterResize,
    sawPermissionDialogBorderAfterResize: result.sawPermissionDialogBorderAfterResize,
    sawDsxuTrustProofLineAfterResize: result.sawDsxuTrustProofLineAfterResize,
    sawDsxuTrustProofFlood: result.sawDsxuTrustProofFlood,
    resizeEventsSent: result.resizeEventsSent,
    scrollbackPageUpsSent: result.scrollbackPageUpsSent,
    sawTerminalMojibake: result.sawTerminalMojibake,
    sawInputEncodingLoss: result.sawInputEncodingLoss,
    transcriptPath: result.transcriptPath,
    tracePath: result.tracePath,
    lifecycleTraceDir: result.lifecycleTraceDir,
    elapsedMs: result.elapsedMs,
    error: result.error,
  }
}

async function runScenario(input: {
  id: string
  required?: boolean
  options: RealTuiHarnessOptions
  extraChecks: (result: RealTuiHarnessResult) => ScenarioCheck[]
  modalScenario?: boolean
}): Promise<ScenarioReport> {
  const result = await runRealTuiExitSmoke({
    root: '/mnt/d/DSXU-code',
    evidenceDir: '/mnt/d/DSXU-code/.dsxu/trace/v6-pty-tui-acceptance',
    timeoutMs: 75_000,
    scenarioName: input.id,
    ...input.options,
  })
  const checks = [
    ...(input.modalScenario ? modalChecks(result) : commonChecks(result)),
    ...input.extraChecks(result),
  ]
  const blockers = checks.filter(item => !item.pass).map(item => item.id)
  return {
    id: input.id,
    status: result.status === 'spawn_failed'
      ? 'BLOCKED'
      : blockers.length === 0
        ? 'PASS'
        : 'FAIL',
    required: input.required ?? true,
    checks,
    blockers,
    result: summarizeResult(result),
  }
}

function renderMarkdown(report: AcceptanceReport): string {
  return [
    '# DSXU V6 PTY/TUI Acceptance',
    '',
    `- status: \`${report.status}\``,
    `- owner: \`${report.owner}\``,
    `- claimBoundary: ${report.claimBoundary}`,
    '',
    '## Scenarios',
    '',
    '| scenario | status | blockers | evidence |',
    '|---|---|---|---|',
    ...report.scenarios.map(scenario => [
      scenario.id,
      scenario.status,
      scenario.blockers.length === 0 ? 'none' : scenario.blockers.join('<br>'),
      [
        `transcript=${rel(scenario.result.transcriptPath)}`,
        `trace=${rel(scenario.result.tracePath)}`,
        `resizeEvents=${scenario.result.resizeEventsSent ?? 0}`,
        `elapsedMs=${scenario.result.elapsedMs}`,
      ].join('<br>'),
    ]).map(cols => `| ${cols.join(' | ')} |`),
    '',
    '## Blockers',
    '',
    report.blockers.length === 0 ? '- none' : report.blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(join(ROOT, 'docs', 'generated'), { recursive: true })
  await mkdir(EVIDENCE_DIR, { recursive: true })

  const resizeSequence = [
    { rows: 18, cols: 80, afterMs: 250 },
    { rows: 36, cols: 150, afterMs: 300 },
    { rows: 12, cols: 58, afterMs: 300 },
    { rows: 30, cols: 118, afterMs: 450 },
  ]

  const scenarios: ScenarioReport[] = []
  scenarios.push(await runScenario({
    id: 'v6-long-content-sticky-bottom-resize',
    options: {
      longContentResizeReplay: true,
      resizeSequence,
      inputsAfterPrompt: ['/exit'],
      waitForNewPromptBetweenInputs: false,
    },
    extraChecks: result => [
      check('resize-events-sent', (result.resizeEventsSent ?? 0) >= 4, [`resizeEventsSent=${result.resizeEventsSent ?? 0}`]),
      check('tail-marker-observed', Boolean(result.sawLongContentResizeTailMarker), [`sawLongContentResizeTailMarker=${result.sawLongContentResizeTailMarker}`]),
      check('tail-visible-after-resize', Boolean(result.sawLongContentResizeTailAfterResize), [`sawLongContentResizeTailAfterResize=${result.sawLongContentResizeTailAfterResize}`]),
      check('prompt-visible-after-resize', Boolean(result.sawPromptAfterResize), [`sawPromptAfterResize=${result.sawPromptAfterResize}`]),
      check('resize-queued-trace', Boolean(result.sawLongContentResizeQueuedTrace), [`sawLongContentResizeQueuedTrace=${result.sawLongContentResizeQueuedTrace}`]),
    ],
  }))

  scenarios.push(await runScenario({
    id: 'v6-scrollback-resize-position',
    options: {
      scrollbackResizeReplay: true,
      scrollbackPageUps: 8,
      resizeSequence,
      inputsAfterPrompt: ['/exit'],
      waitForNewPromptBetweenInputs: false,
    },
    extraChecks: result => [
      check('scrollback-position-trace', Boolean(result.sawScrollbackResizePositionedTrace), [`sawScrollbackResizePositionedTrace=${result.sawScrollbackResizePositionedTrace}`]),
      check('middle-visible-after-resize', Boolean(result.sawScrollbackResizeMiddleAfterResize), [`sawScrollbackResizeMiddleAfterResize=${result.sawScrollbackResizeMiddleAfterResize}`]),
      check('not-forced-to-top-or-tail-only', Boolean(result.sawScrollbackResizeMiddleAfterResize && !result.sawScrollbackResizeTopAfterResize), [
        `sawTop=${result.sawScrollbackResizeTopAfterResize}`,
        `sawMiddle=${result.sawScrollbackResizeMiddleAfterResize}`,
        `sawTail=${result.sawScrollbackResizeTailAfterResize}`,
      ]),
    ],
  }))

  scenarios.push(await runScenario({
    id: 'v6-permission-dialog-after-resize',
    modalScenario: true,
    options: {
      permissionPromptReplay: true,
      longContentResizeReplay: true,
      resizeSequence,
      inputsAfterPrompt: ['/exit'],
      waitForNewPromptBetweenInputs: false,
    },
    extraChecks: result => [
      check('permission-dialog-visible-after-resize', Boolean(result.sawPermissionDialogAfterResize), [`sawPermissionDialogAfterResize=${result.sawPermissionDialogAfterResize}`]),
      check('permission-dialog-border-after-resize', Boolean(result.sawPermissionDialogBorderAfterResize), [`sawPermissionDialogBorderAfterResize=${result.sawPermissionDialogBorderAfterResize}`]),
    ],
  }))

  scenarios.push(await runScenario({
    id: 'v6-trust-proof-after-resize',
    options: {
      trustProofReplay: true,
      longContentResizeReplay: true,
      resizeSequence,
      inputsAfterPrompt: ['/exit'],
      waitForNewPromptBetweenInputs: false,
    },
    extraChecks: result => [
      check('trust-proof-line-after-resize', Boolean(result.sawDsxuTrustProofLineAfterResize), [`sawDsxuTrustProofLineAfterResize=${result.sawDsxuTrustProofLineAfterResize}`]),
      check('trust-proof-not-flooded', !result.sawDsxuTrustProofFlood, [`sawDsxuTrustProofFlood=${result.sawDsxuTrustProofFlood}`]),
    ],
  }))

  const blockers = scenarios.flatMap(scenario =>
    scenario.required && scenario.status !== 'PASS'
      ? scenario.blockers.map(blocker => `${scenario.id}:${blocker}`)
      : [],
  )
  const report: AcceptanceReport = {
    schemaVersion: 'dsxu.v6.pty-tui-acceptance.v1',
    generatedAt: new Date().toISOString(),
    owner: 'TUI Trust Surface / PTY Harness',
    status: blockers.length === 0
      ? 'PASS_V6_PTY_TUI_ACCEPTANCE'
      : 'BLOCKED_V6_PTY_TUI_ACCEPTANCE',
    claimBoundary: 'This is real PTY harness acceptance for resize, scrollback, permission dialog, and compact trust evidence. It is not a visual/manual product signoff by itself.',
    scenarios,
    blockers,
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, renderMarkdown(report), 'utf8')
  console.log(JSON.stringify({
    status: report.status,
    blockers: report.blockers,
    scenarios: report.scenarios.map(scenario => ({
      id: scenario.id,
      status: scenario.status,
      blockers: scenario.blockers,
    })),
    outputs: {
      json: rel(OUT_JSON),
      markdown: rel(OUT_MD),
    },
  }, null, 2))
  if (report.status !== 'PASS_V6_PTY_TUI_ACCEPTANCE') process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
