import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { getV18LiveDeepSeekBenchmarkGate } from './live-deepseek-benchmark-gate'

export type V18GoStopSignal = {
  id: string
  ok: boolean
  evidencePath: string
  summary: string
  requiredForLocal: boolean
  requiredForPublicBenchmark: boolean
}

export type V18GoStopDecision = {
  localPhaseH: 'GO_LOCAL_PHASE_H' | 'STOP_LOCAL'
  publicBenchmark: 'GO_PUBLIC_BENCH' | 'STOP_PUBLIC_BENCH'
  releaseEvidence: boolean
  localReadySignals: number
  localRequiredSignals: number
  publicReadySignals: number
  publicRequiredSignals: number
  failures: string[]
  blockers: string[]
  nextStep: string
}

export type V18GoStopDecisionReport = {
  ok: boolean
  generatedAt: string
  evidencePath: string
  markdownPath: string
  decision: V18GoStopDecision
  signals: V18GoStopSignal[]
  liveBenchmarkGate: ReturnType<typeof getV18LiveDeepSeekBenchmarkGate>
}

export type V18GoStopDecisionHarnessOptions = {
  evidenceDir?: string
  markdownPath?: string
  nowIso?: string
}

function requiredFailures(
  signals: readonly V18GoStopSignal[],
  selector: (signal: V18GoStopSignal) => boolean,
): string[] {
  return signals
    .filter(signal => selector(signal) && !signal.ok)
    .map(signal => `${signal.id}: ${signal.summary}`)
}

export function buildV18GoStopDecision(input: {
  signals: readonly V18GoStopSignal[]
  liveBenchmarkGate: ReturnType<typeof getV18LiveDeepSeekBenchmarkGate>
}): V18GoStopDecision {
  const localFailures = requiredFailures(
    input.signals,
    signal => signal.requiredForLocal,
  )
  const publicFailures = requiredFailures(
    input.signals,
    signal => signal.requiredForPublicBenchmark,
  )
  const localRequiredSignals = input.signals.filter(
    signal => signal.requiredForLocal,
  ).length
  const publicRequiredSignals = input.signals.filter(
    signal => signal.requiredForPublicBenchmark,
  ).length
  const localReadySignals = input.signals.filter(
    signal => signal.requiredForLocal && signal.ok,
  ).length
  const publicReadySignals = input.signals.filter(
    signal => signal.requiredForPublicBenchmark && signal.ok,
  ).length
  const liveGateBlocksPublic =
    input.liveBenchmarkGate.status !== 'ready' ||
    input.liveBenchmarkGate.releaseEvidence !== true
  const blockers = [
    ...localFailures,
    ...publicFailures,
    ...(liveGateBlocksPublic
      ? [
          `live-benchmark-gate: ${input.liveBenchmarkGate.reason ?? input.liveBenchmarkGate.evidenceMode}`,
        ]
      : []),
  ]
  const localPhaseH =
    localFailures.length === 0 ? 'GO_LOCAL_PHASE_H' : 'STOP_LOCAL'
  const publicBenchmark =
    localPhaseH === 'GO_LOCAL_PHASE_H' &&
    publicFailures.length === 0 &&
    !liveGateBlocksPublic
      ? 'GO_PUBLIC_BENCH'
      : 'STOP_PUBLIC_BENCH'

  return {
    localPhaseH,
    publicBenchmark,
    releaseEvidence:
      localPhaseH === 'GO_LOCAL_PHASE_H' &&
      publicBenchmark === 'GO_PUBLIC_BENCH',
    localReadySignals,
    localRequiredSignals,
    publicReadySignals,
    publicRequiredSignals,
    failures: [...new Set([...localFailures, ...publicFailures])],
    blockers: [...new Set(blockers)],
    nextStep:
      publicBenchmark === 'GO_PUBLIC_BENCH'
        ? 'Run the paid public benchmark smoke with model/cost evidence and failure taxonomy.'
        : localPhaseH === 'GO_LOCAL_PHASE_H'
          ? 'Continue local Phase H readiness: collect multi-task cost/failure taxonomy before public benchmark spend.'
          : 'Stop and repair local required evidence before any Remote/BenchMax expansion.',
  }
}

function evidenceOk(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (record.ok === false) return false
  if (record.ok === true) return true
  if (record.status === 'DONE-EVIDENCED') return true
  if (record.status === 'PASS') return true
  return true
}

export function normalizeV18EvidenceJsonText(text: string): string {
  const trimmed = text
    .replace(/^\uFEFF/, '')
    .trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return trimmed
  const firstJsonStart = Math.min(
    ...[trimmed.indexOf('{'), trimmed.indexOf('[')].filter(index => index >= 0),
  )
  return Number.isFinite(firstJsonStart) && firstJsonStart > 0 && firstJsonStart <= 8
    ? trimmed.slice(firstJsonStart).trimStart()
    : trimmed
}

async function readEvidenceSignal(input: {
  id: string
  path: string
  summary: string
  requiredForLocal: boolean
  requiredForPublicBenchmark: boolean
}): Promise<V18GoStopSignal> {
  try {
    const text = normalizeV18EvidenceJsonText(await readFile(input.path, 'utf8'))
    const parsed = JSON.parse(text) as unknown
    return {
      id: input.id,
      ok: evidenceOk(parsed),
      evidencePath: input.path,
      summary: input.summary,
      requiredForLocal: input.requiredForLocal,
      requiredForPublicBenchmark: input.requiredForPublicBenchmark,
    }
  } catch (error) {
    return {
      id: input.id,
      ok: false,
      evidencePath: input.path,
      summary: `${input.summary}; missing or unreadable evidence: ${
        error instanceof Error ? error.message : String(error)
      }`,
      requiredForLocal: input.requiredForLocal,
      requiredForPublicBenchmark: input.requiredForPublicBenchmark,
    }
  }
}

function renderMarkdown(report: V18GoStopDecisionReport): string {
  const lines = [
    '# DSXU V18 Go/Stop Decision',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Decision',
    '',
    `- Local Phase H: ${report.decision.localPhaseH}`,
    `- Public Benchmark: ${report.decision.publicBenchmark}`,
    `- Release Evidence: ${report.decision.releaseEvidence}`,
    `- Local signals: ${report.decision.localReadySignals}/${report.decision.localRequiredSignals}`,
    `- Public benchmark signals: ${report.decision.publicReadySignals}/${report.decision.publicRequiredSignals}`,
    '',
    '## Blockers',
    '',
    ...(report.decision.blockers.length > 0
      ? report.decision.blockers.map(blocker => `- ${blocker}`)
      : ['- None']),
    '',
    '## Signals',
    '',
    ...report.signals.map(signal =>
      `- ${signal.ok ? 'PASS' : 'FAIL'} ${signal.id}: ${signal.summary} (${signal.evidencePath})`,
    ),
    '',
    '## Next Step',
    '',
    report.decision.nextStep,
    '',
  ]
  return lines.join('\n')
}

export async function runV18GoStopDecisionHarness(
  options: V18GoStopDecisionHarnessOptions = {},
): Promise<V18GoStopDecisionReport> {
  const root = process.cwd()
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-readiness')
  const evidencePath = join(evidenceDir, 'go-stop-decision-20260506.evidence.json')
  const markdownPath =
    options.markdownPath ?? join(root, 'docs', 'DSXU_V18_GO_STOP_DECISION_20260506.md')
  const generatedAt = options.nowIso ?? new Date().toISOString()
  await mkdir(evidenceDir, { recursive: true })

  const signals = await Promise.all([
    readEvidenceSignal({
      id: 'real-tui-terminal-pack',
      path: join(
        root,
        '.dsxu/trace/v18-tui-terminal/real-tui-terminal-pack-validation-20260506.evidence.json',
      ),
      summary: 'real TUI harness captured screen/transcript/trace style evidence',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'toolchain-internal-pack',
      path: join(
        root,
        '.dsxu/trace/v18-toolchain/internal-toolchain-repair-20260506.evidence.json',
      ),
      summary: 'DSXU-owned WSL/Windows toolchain and ripgrep repair evidence exists',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'experience-store-planning-pack',
      path: join(
        root,
        '.dsxu/trace/v18-experience-store/experience-planning-pack-20260506.evidence.json',
      ),
      summary: 'ExperienceStore planning lanes are read-only and source-truth guarded',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'agent-evidence-simplification',
      path: join(
        root,
        '.dsxu/trace/v18-agent/agent-orchestration-mode-20260506.evidence.json',
      ),
      summary: 'Agent mode reduced to serial worker or parallel fanout with parent evidence gates',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'control-plane-stage-acceptance',
      path: join(
        root,
        '.dsxu/trace/v18-control-plane/control-plane-stage-acceptance-v1.evidence.json',
      ),
      summary: 'Control Plane CP12 stage acceptance evidence is present',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'remote-network-workflow',
      path: join(
        root,
        '.dsxu/trace/v18-remote/remote-network-workflow-v1.evidence.json',
      ),
      summary: 'Remote/Network replay covers permission, task, verification, reconnect/cancel, and allowlist relay',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'cost-router-generalization',
      path: join(
        root,
        '.dsxu/trace/v18-cost-router/complex-planning-route-generalization-20260506.evidence.json',
      ),
      summary: 'CostRouter generalizes complex first-turn Pro planning beyond website tasks',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
    readEvidenceSignal({
      id: 'real-task-pack-core',
      path: join(
        root,
        '.dsxu/trace/v18-stage-close/real-task-pack-core-live-20260506.evidence.json',
      ),
      summary: 'Core real task pack has replay evidence and failure taxonomy input',
      requiredForLocal: true,
      requiredForPublicBenchmark: true,
    }),
  ])
  const liveBenchmarkGate = getV18LiveDeepSeekBenchmarkGate()
  const decision = buildV18GoStopDecision({ signals, liveBenchmarkGate })
  const report: V18GoStopDecisionReport = {
    ok: decision.localPhaseH === 'GO_LOCAL_PHASE_H',
    generatedAt,
    evidencePath,
    markdownPath,
    decision,
    signals,
    liveBenchmarkGate,
  }

  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  await writeFile(markdownPath, renderMarkdown(report), 'utf8')
  return report
}
