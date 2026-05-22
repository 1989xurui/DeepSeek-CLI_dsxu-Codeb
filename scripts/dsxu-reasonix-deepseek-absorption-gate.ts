import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import {
  buildDSXUReasonixDeepSeekAbsorptionGate,
  type DSXUReasonixAbsorptionMetric,
} from '../src/dsxu/engine/reasonix-deepseek-absorption-gate'

const root = process.cwd()
const generatedPath = join(root, 'docs', 'generated', 'DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.json')
const markdownPath = join(root, 'docs', 'DSXU_REASONIX_DEEPSEEK_ABSORPTION_GATE_20260517.md')

const RDX_F_TUI_SCENARIOS = [
  'long-content-resize-sticky-bottom',
  'permission-review-after-long-content-resize',
  'middle-scrollback-resize-anchor',
] as const

type TraceEvent = Record<string, unknown> & {
  ts?: number
  event?: string
  elapsedMs?: number
  sawMojibake?: boolean
  sawLongContentResizeTailAfterResize?: boolean
  sawPermissionDialogAfterResize?: boolean
  sawScrollbackResizeMiddleAfterResize?: boolean
  sawScrollbackResizeTopAfterResize?: boolean
  sawScrollbackResizeTailAfterResize?: boolean
}

function safeJsonLines(path: string): TraceEvent[] {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => JSON.parse(line) as TraceEvent)
  } catch {
    return []
  }
}

function candidateTuiTraceDirs(): string[] {
  return [
    process.env.DSXU_RDX_TUI_TRACE_DIR,
    join(root, '.dsxu', 'trace', 'v18-tui'),
    '\\\\wsl.localhost\\Ubuntu\\home\\xurui\\.dsxu\\trace\\v18-tui',
  ].filter((dir): dir is string => Boolean(dir && existsSync(dir)))
}

function fileSize(path: string): number {
  try {
    return statSync(path).size
  } catch {
    return 0
  }
}

function directoryFilesSize(path: string): number {
  try {
    return readdirSync(path)
      .map(file => join(path, file))
      .reduce((sum, file) => sum + fileSize(file), 0)
  } catch {
    return 0
  }
}

function scenarioDoneOk(scenario: string, done: TraceEvent | undefined): boolean {
  if (!done || done.event !== 'done' || done.sawMojibake === true) return false
  if (scenario === 'long-content-resize-sticky-bottom') {
    return done.sawLongContentResizeTailAfterResize === true
  }
  if (scenario === 'permission-review-after-long-content-resize') {
    return done.sawPermissionDialogAfterResize === true
  }
  if (scenario === 'middle-scrollback-resize-anchor') {
    return done.sawScrollbackResizeMiddleAfterResize === true &&
      done.sawScrollbackResizeTopAfterResize !== true &&
      done.sawScrollbackResizeTailAfterResize !== true
  }
  return false
}

function collectRdxFTuiMetrics(metrics: readonly DSXUReasonixAbsorptionMetric[]): DSXUReasonixAbsorptionMetric[] {
  const dirs = candidateTuiTraceDirs()
  if (dirs.length === 0) return [...metrics]

  for (const dir of dirs) {
    const scenarioStats = RDX_F_TUI_SCENARIOS.map(scenario => {
      const tracePath = join(dir, `${scenario}.trace.jsonl`)
      const transcriptPath = join(dir, `${scenario}.transcript.txt`)
      const lifecycleDir = join(dir, `${scenario}.lifecycle`)
      const events = existsSync(tracePath) ? safeJsonLines(tracePath) : []
      const firstResize = events.find(event => event.event === 'resize')
      const resizeDone = events.find(event => event.event === 'resize_sequence_done')
      const done = [...events].reverse().find(event => event.event === 'done')
      const resizeLatencyMs =
        typeof firstResize?.ts === 'number' && typeof resizeDone?.ts === 'number'
          ? Math.max(0, Math.round((resizeDone.ts - firstResize.ts) * 1000))
          : undefined
      const artifactBytes = fileSize(tracePath) + fileSize(transcriptPath) + directoryFilesSize(lifecycleDir)
      return {
        scenario,
        ok: scenarioDoneOk(scenario, done),
        resizeLatencyMs,
        artifactBytes,
      }
    })

    if (!scenarioStats.every(stat => stat.ok && typeof stat.resizeLatencyMs === 'number')) {
      continue
    }

    const maxResizeLatencyMs = Math.max(...scenarioStats.map(stat => stat.resizeLatencyMs ?? 0))
    const artifactLogSizeBytes = scenarioStats.reduce((sum, stat) => sum + stat.artifactBytes, 0)
    return metrics.map(metric => {
      if (metric.name === 'tuiRenderResizeLatencyMs') {
        return {
          name: metric.name,
          state: 'measured',
          value: maxResizeLatencyMs,
          unit: 'ms',
          evidence: `RDX-F real TUI PTY resize subset passed 3/3 scenarios from ${dir}; max resize-sequence latency ${maxResizeLatencyMs}ms`,
        } satisfies DSXUReasonixAbsorptionMetric
      }
      if (metric.name === 'artifactLogSizeBytes') {
        return {
          name: metric.name,
          state: 'measured',
          value: artifactLogSizeBytes,
          unit: 'bytes',
          evidence: `RDX-F real TUI trace/transcript/lifecycle artifacts for 3 scenarios from ${dir}`,
        } satisfies DSXUReasonixAbsorptionMetric
      }
      return metric
    })
  }

  return [...metrics]
}

function collectHardBenchmarkMetrics(metrics: readonly DSXUReasonixAbsorptionMetric[]): DSXUReasonixAbsorptionMetric[] {
  const benchmarkPath = join(
    root,
    'docs',
    'generated',
    'DSXU_HARD_ENGINEERING_BENCHMARK_20260517_deepseek-route-cost-cache.json',
  )
  if (!existsSync(benchmarkPath)) return [...metrics]

  try {
    const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
      status?: string
      totalTasks?: number
      rawAverageScore?: number
      dsxuAverageScore?: number
      rawTotalCostUSD?: number
      dsxuTotalCostUSD?: number
      tasks?: Array<{
        id?: string
        raw?: { durationMs?: number; score?: number; pass?: boolean }
        dsxu?: { durationMs?: number; score?: number; pass?: boolean; tracePath?: string }
      }>
    }
    const task = benchmark.tasks?.find(item => item.id === 'deepseek-route-cost-cache')
    if (
      benchmark.status !== 'PASS_DSXU_HARD_ENGINEERING_LIFT' ||
      task?.dsxu?.pass !== true ||
      typeof task.dsxu.durationMs !== 'number'
    ) {
      return [...metrics]
    }
    return metrics.map(metric => {
      if (metric.name !== 'wallClockMs') return metric
      return {
        name: metric.name,
        state: 'measured',
        value: task.dsxu.durationMs,
        unit: 'ms',
        evidence: `DeepSeek runtime hard engineering benchmark deepseek-route-cost-cache: raw score ${task.raw?.score ?? 'n/a'} -> DSXU score ${task.dsxu.score ?? 'n/a'}, DSXU wall-clock ${task.dsxu.durationMs}ms, trace ${task.dsxu.tracePath ?? benchmarkPath}`,
      } satisfies DSXUReasonixAbsorptionMetric
    })
  } catch {
    return [...metrics]
  }
}

const baseGate = buildDSXUReasonixDeepSeekAbsorptionGate({
  generatedAt: '2026-05-17T00:00:00.000Z',
})
const gate = buildDSXUReasonixDeepSeekAbsorptionGate({
  generatedAt: '2026-05-17T00:00:00.000Z',
  metrics: collectHardBenchmarkMetrics(collectRdxFTuiMetrics(baseGate.metrics)),
})

function writeText(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, 'utf8')
}

function table(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const markdown = [
  '# DSXU Reasonix DeepSeek Absorption Gate - 20260517',
  '',
  `Status: \`${gate.status}\``,
  '',
  'This evidence pack records the first V26 Reasonix execution packet. It is an acceptance gate only: no runtime path, provider, TUI, MCP/Skill registry, Tool Gate, or query loop is replaced.',
  '',
  '## Metrics',
  '',
  table(
    ['metric', 'state', 'value', 'evidence'],
    gate.metrics.map(metric => [
      `\`${metric.name}\``,
      `\`${metric.state}\``,
      metric.value === undefined ? '' : `${metric.value}${metric.unit ? ` ${metric.unit}` : ''}`,
      metric.evidence,
    ]),
  ),
  '',
  '## Packets',
  '',
  table(
    ['packet', 'owner', 'status', 'next action'],
    gate.packets.map(packet => [
      `\`${packet.packet}\``,
      packet.owner,
      `\`${packet.status}\``,
      packet.nextAction,
    ]),
  ),
  '',
  '## Guards',
  '',
  ...gate.guards.map(guard => `- ${guard}`),
  '',
  '## Next Packets',
  '',
  ...gate.nextPackets.map(packet => `- ${packet}`),
  '',
].join('\n')

writeText(generatedPath, `${JSON.stringify(gate, null, 2)}\n`)
writeText(markdownPath, markdown)

console.log(JSON.stringify({
  status: gate.status,
  generatedPath,
  markdownPath,
  metricCount: gate.metrics.length,
  openPacketCount: gate.packets.filter(packet => packet.status !== 'implemented_baseline').length,
}, null, 2))
