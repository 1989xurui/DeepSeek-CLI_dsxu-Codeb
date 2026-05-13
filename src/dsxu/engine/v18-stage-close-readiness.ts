import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision'

export type V18StageCloseArea =
  | 'experience_store'
  | 'agent'
  | 'control_plane'
  | 'tui_terminal'
  | 'cost_cache'
  | 'flash_bare'
  | 'pro_bare'
  | 'benchmax'

export type V18StageCloseSignal = {
  id: string
  area: V18StageCloseArea
  ok: boolean
  evidencePath: string
  summary: string
  requiredFor22Case: boolean
  requiredForProBare: boolean
  requiredForBenchmax: boolean
}

export type V18StageCloseReadiness = {
  status: 'READY_FOR_22_CASE_STAGE_CLOSE' | 'NOT_READY'
  proBare: 'GO_PRO_BARE' | 'STOP_PRO_BARE'
  benchmax: 'GO_BENCHMAX' | 'STOP_BENCHMAX'
  readySignals: number
  totalSignals: number
  blockers: readonly string[]
  guards: readonly string[]
  nextStep: string
}

export type V18StageCloseReadinessReport = {
  ok: boolean
  generatedAt: string
  evidencePath: string
  markdownPath: string
  readiness: V18StageCloseReadiness
  signals: readonly V18StageCloseSignal[]
}

function requiredFailures(
  signals: readonly V18StageCloseSignal[],
  selector: (signal: V18StageCloseSignal) => boolean,
): string[] {
  return signals
    .filter(signal => selector(signal) && !signal.ok)
    .map(signal => `${signal.id}: ${signal.summary}`)
}

export function buildV18StageCloseReadiness(input: {
  signals: readonly V18StageCloseSignal[]
}): V18StageCloseReadiness {
  const blockers22 = requiredFailures(input.signals, signal => signal.requiredFor22Case)
  const blockersPro = requiredFailures(input.signals, signal => signal.requiredForProBare)
  const blockersBenchmax = requiredFailures(input.signals, signal => signal.requiredForBenchmax)
  const readySignals = input.signals.filter(signal => signal.ok).length
  const totalSignals = input.signals.length
  const status =
    blockers22.length === 0 ? 'READY_FOR_22_CASE_STAGE_CLOSE' : 'NOT_READY'
  const proBare =
    blockersPro.length === 0 && status === 'READY_FOR_22_CASE_STAGE_CLOSE'
      ? 'GO_PRO_BARE'
      : 'STOP_PRO_BARE'
  const benchmax =
    blockersBenchmax.length === 0 && proBare === 'GO_PRO_BARE'
      ? 'GO_BENCHMAX'
      : 'STOP_BENCHMAX'
  const blockers = [...new Set([...blockers22, ...blockersPro, ...blockersBenchmax])]
  const guards: string[] = []
  if (status === 'READY_FOR_22_CASE_STAGE_CLOSE') {
    guards.push('Run broad 22-case only once as a stage-close regression, not after every patch.')
  }
  if (proBare === 'STOP_PRO_BARE') {
    guards.push('Do not spend Pro bare baseline budget until Flash bare and stage-close prerequisites are green.')
  }
  if (benchmax === 'STOP_BENCHMAX') {
    guards.push('Do not run BenchMax until Pro bare and BenchMax candidate-search evidence are green.')
  }

  return {
    status,
    proBare,
    benchmax,
    readySignals,
    totalSignals,
    blockers,
    guards,
    nextStep:
      status === 'READY_FOR_22_CASE_STAGE_CLOSE'
        ? 'Run the stage-close 22-case once, then decide Pro bare and BenchMax from measured blockers.'
        : 'Continue closing required focused evidence before broad 22-case or paid baselines.',
  }
}

async function readJson(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    return JSON.parse(normalizeV18EvidenceJsonText(await readFile(path, 'utf8'))) as Record<string, unknown>
  } catch {
    return undefined
  }
}

async function firstExistingPath(paths: readonly string[]): Promise<string> {
  for (const path of paths) {
    if (await readJson(path)) return path
  }
  return paths[0] ?? ''
}

function nested(record: Record<string, unknown> | undefined, path: readonly string[]): unknown {
  let current: unknown = record
  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

function statusOk(record: Record<string, unknown> | undefined): boolean {
  if (!record) return false
  if (record.ok === true) return true
  if (record.status === 'DONE_EVIDENCED' || record.status === 'DONE-EVIDENCED') return true
  return false
}

function liveReportAllGreen(record: Record<string, unknown> | undefined, minCases: number): boolean {
  const total = Number(record?.total ?? nested(record, ['summary', 'totalCases']) ?? 0)
  const pass = Number(nested(record, ['summary', 'pass']) ?? 0)
  const fail = Number(nested(record, ['summary', 'fail']) ?? 0)
  const policyFail = Number(nested(record, ['summary', 'policyFail']) ?? 0)
  const timedOut = Number(nested(record, ['summary', 'timedOut']) ?? 0)
  return total >= minCases && pass === total && fail === 0 && policyFail === 0 && timedOut === 0
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function liveReportBaselineGreen(
  record: Record<string, unknown> | undefined,
  minCases: number,
  variant: 'flash_bare' | 'pro_bare' | 'benchmax',
): boolean {
  if (!liveReportAllGreen(record, minCases)) return false

  const modelsUsed = stringArray(nested(record, ['summary', 'modelsUsed']))
  if (variant === 'flash_bare') {
    return (
      record?.baselineProfile === 'model_forced_bare' &&
      record.entryModelMode === 'flash' &&
      record.entryModel === 'deepseek-v4-flash' &&
      record.semanticToolsEnabled === false &&
      modelsUsed.includes('deepseek-v4-flash') &&
      !modelsUsed.includes('deepseek-v4-pro')
    )
  }

  if (variant === 'pro_bare') {
    return (
      record?.baselineProfile === 'model_forced_bare' &&
      record.entryModelMode === 'pro' &&
      record.entryModel === 'deepseek-v4-pro' &&
      record.semanticToolsEnabled === false &&
      modelsUsed.includes('deepseek-v4-pro') &&
      !modelsUsed.includes('deepseek-v4-flash')
    )
  }

  const candidateCount = Number(
    record?.benchmaxCandidateCount ??
      nested(record, ['summary', 'benchmaxCandidateCount']) ??
      0,
  )
  return (
    record?.baselineProfile === 'benchmax' &&
    record.benchMode === 'benchmax' &&
    candidateCount >= 2
  )
}

async function signalFromEvidence(input: {
  id: string
  area: V18StageCloseArea
  evidencePath: string
  summary: string
  requiredFor22Case: boolean
  requiredForProBare: boolean
  requiredForBenchmax: boolean
  mode?: 'status' | 'live-report-10' | 'flash-bare-code10' | 'pro-bare-code10' | 'benchmax-code10'
}): Promise<V18StageCloseSignal> {
  const record = await readJson(input.evidencePath)
  const ok =
    input.mode === 'live-report-10'
      ? liveReportAllGreen(record, 10)
      : input.mode === 'flash-bare-code10'
        ? liveReportBaselineGreen(record, 10, 'flash_bare')
        : input.mode === 'pro-bare-code10'
          ? liveReportBaselineGreen(record, 10, 'pro_bare')
          : input.mode === 'benchmax-code10'
            ? liveReportBaselineGreen(record, 10, 'benchmax')
            : statusOk(record)
  return {
    id: input.id,
    area: input.area,
    ok,
    evidencePath: input.evidencePath,
    summary: ok ? input.summary : `${input.summary}; missing or not green`,
    requiredFor22Case: input.requiredFor22Case,
    requiredForProBare: input.requiredForProBare,
    requiredForBenchmax: input.requiredForBenchmax,
  }
}

function renderMarkdown(report: V18StageCloseReadinessReport): string {
  return [
    '# DSXU V18 Stage-Close Readiness',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Decision',
    '',
    `- 22-case stage close: ${report.readiness.status}`,
    `- Pro bare: ${report.readiness.proBare}`,
    `- BenchMax: ${report.readiness.benchmax}`,
    `- Signals: ${report.readiness.readySignals}/${report.readiness.totalSignals}`,
    '',
    '## Blockers',
    '',
    ...(report.readiness.blockers.length > 0
      ? report.readiness.blockers.map(blocker => `- ${blocker}`)
      : ['- None']),
    '',
    '## Guards',
    '',
    ...report.readiness.guards.map(guard => `- ${guard}`),
    '',
    '## Signals',
    '',
    ...report.signals.map(signal =>
      `- ${signal.ok ? 'PASS' : 'FAIL'} ${signal.id} [${signal.area}]: ${signal.summary} (${signal.evidencePath})`,
    ),
    '',
    '## Next',
    '',
    report.readiness.nextStep,
    '',
  ].join('\n')
}

export async function runV18StageCloseReadinessHarness(input: {
  evidenceDir?: string
  markdownPath?: string
  nowIso?: string
} = {}): Promise<V18StageCloseReadinessReport> {
  const root = process.cwd()
  const evidenceDir = input.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-stage-close')
  const evidencePath = join(evidenceDir, 'stage-close-readiness-20260507.evidence.json')
  const markdownPath =
    input.markdownPath ?? join(root, 'docs', 'DSXU_V18_STAGE_CLOSE_READINESS_20260507.md')
  await mkdir(evidenceDir, { recursive: true })
  await mkdir(dirname(markdownPath), { recursive: true })

  const modelDrivenTuiEvidencePath = await firstExistingPath([
    join(root, '.dsxu/trace/v18-tui/model-driven-long-task-replay-20260508-dsxu-api-key-auth.evidence.json'),
    join(root, '.dsxu/trace/v18-tui/model-driven-long-task-replay-20260508-forwarded-env.evidence.json'),
    join(root, '.dsxu/trace/v18-tui/model-driven-long-task-replay-20260508.evidence.json'),
    join(root, '.dsxu/trace/v18-tui/model-driven-long-task-replay-20260507.evidence.json'),
  ])
  const flashBareCode10Path = await firstExistingPath([
    join(root, '.dsxu/runs/v18-eval-baseline-20260508-current-flash-bare-code/live-report.json'),
    join(root, '.dsxu/runs/v18-eval-flash-bare-code-final4-20260507-1800/live-report.json'),
    join(root, '.dsxu/runs/v18-eval-flash-bare-code-protocol-fix2-20260507-1616/live-report.json'),
    join(root, '.dsxu/runs/v18-eval-flash-bare-code-final3-20260507-1735/live-report.json'),
  ])

  const signals = await Promise.all([
    signalFromEvidence({
      id: 'persistent-smooth-resume',
      area: 'experience_store',
      evidencePath: join(root, '.dsxu/trace/v18-experience-store/persistent-smooth-resume-20260507.json'),
      summary: 'persistent ExperienceStore reload feeds source-truth guarded smooth resume',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'agent-live-report-replay',
      area: 'agent',
      evidencePath: join(root, '.dsxu/trace/v18-agent/agent-live-report-replay-final4-20260507.evidence.json'),
      summary: 'Agent stays in serial worker / parallel fanout with parent final evidence gate',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'control-plane-cp12',
      area: 'control_plane',
      evidencePath: join(root, '.dsxu/trace/v18-control-plane/control-plane-stage-acceptance-v1.evidence.json'),
      summary: 'Control Plane CP12 stage acceptance is green',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'remote-network-workflow',
      area: 'control_plane',
      evidencePath: join(root, '.dsxu/trace/v18-remote/remote-network-workflow-v1.evidence.json'),
      summary: 'remote/network replay covers permission, task, verification, reconnect, cancel, and network allowlist',
      requiredFor22Case: false,
      requiredForProBare: false,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'tui-terminal-reliability',
      area: 'tui_terminal',
      evidencePath: join(root, '.dsxu/trace/v18-tui-terminal/tui-terminal-reliability-pack.json'),
      summary: 'TUI/terminal reliability pack is green',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'wsl-workspace-health',
      area: 'tui_terminal',
      evidencePath: join(root, '.dsxu/trace/v18-tui/wsl-workspace-health-20260507.evidence.json'),
      summary: 'WSL can read the DSXU workspace, entrypoint, Bun, and Python before real TUI replay',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'model-driven-tui-long-task',
      area: 'tui_terminal',
      evidencePath: modelDrivenTuiEvidencePath,
      summary: 'model-driven long task replay proves the real TUI does not require repeated user continue',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
    }),
    signalFromEvidence({
      id: 'flash-bare-code10-final4',
      area: 'flash_bare',
      evidencePath: flashBareCode10Path,
      summary: 'Flash bare Code-10 final4 is green with no policy fail',
      requiredFor22Case: true,
      requiredForProBare: true,
      requiredForBenchmax: true,
      mode: 'flash-bare-code10',
    }),
    signalFromEvidence({
      id: 'pro-bare-code10',
      area: 'pro_bare',
      evidencePath: join(root, '.dsxu/runs/v18-eval-pro-bare-code-20260507/live-report.json'),
      summary: 'Pro bare Code-10 measured under same protocol',
      requiredFor22Case: false,
      requiredForProBare: true,
      requiredForBenchmax: true,
      mode: 'pro-bare-code10',
    }),
    signalFromEvidence({
      id: 'benchmax-code10',
      area: 'benchmax',
      evidencePath: join(root, '.dsxu/runs/v18-eval-benchmax-code-20260507/live-report.json'),
      summary: 'BenchMax Code-10 measured with candidate search',
      requiredFor22Case: false,
      requiredForProBare: false,
      requiredForBenchmax: true,
      mode: 'benchmax-code10',
    }),
  ])
  const readiness = buildV18StageCloseReadiness({ signals })
  const report: V18StageCloseReadinessReport = {
    ok: readiness.status === 'READY_FOR_22_CASE_STAGE_CLOSE',
    generatedAt: input.nowIso ?? new Date().toISOString(),
    evidencePath,
    markdownPath,
    readiness,
    signals,
  }
  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')
  return report
}
