import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  buildDSXUV8ToolWindowABReport,
  createDSXUV8MockToolWindowABSamples,
  type DSXUV8ToolWindowABResultLevel,
  type DSXUV8ToolWindowABSample,
} from '../src/dsxu/engine/tool-window-ab-v8'
import type { DSXUV8ToolWindowProfile } from '../src/dsxu/engine/tool-window-policy-v8'

type CliOptions = {
  profiles: DSXUV8ToolWindowProfile[]
  windows: number[]
  suite: string
  resultLevel: DSXUV8ToolWindowABResultLevel
  replayPath?: string
}

const DEFAULT_PROFILES: DSXUV8ToolWindowProfile[] = [
  'single_file_edit',
  'debug',
  'long_task',
]

const DEFAULT_WINDOWS = [8, 12, 16, 20, 24, 27]

function getArg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0) return process.argv[index + 1]
  const inline = process.argv.find(arg => arg.startsWith(`--${name}=`))
  return inline?.slice(name.length + 3)
}

function parseCsv<T extends string>(value: string | undefined, fallback: readonly T[]): T[] {
  if (!value) return [...fallback]
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean) as T[]
}

function parseNumberCsv(value: string | undefined, fallback: readonly number[]): number[] {
  if (!value) return [...fallback]
  return value
    .split(',')
    .map(item => Number(item.trim()))
    .filter(value => Number.isFinite(value) && value >= 0)
}

function parseOptions(): CliOptions {
  return {
    profiles: parseCsv(getArg('profiles'), DEFAULT_PROFILES),
    windows: parseNumberCsv(getArg('windows'), DEFAULT_WINDOWS),
    suite: getArg('suite') ?? 'mock-v8-smoke',
    resultLevel: (getArg('result-level') as DSXUV8ToolWindowABResultLevel | undefined) ?? 'mock',
    replayPath: getArg('replay'),
  }
}

function readReplaySamples(path: string): DSXUV8ToolWindowABSample[] {
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (!Array.isArray(parsed)) {
    throw new Error(`Replay file must be an array of DSXU V8 AB samples: ${path}`)
  }
  return parsed as DSXUV8ToolWindowABSample[]
}

function toCsv(report: ReturnType<typeof buildDSXUV8ToolWindowABReport>): string {
  const header = [
    'profile',
    'window',
    'sampleCount',
    'passAt1',
    'verifiedCompletionRate',
    'costToVerifiedCompletion',
    'medianLatencyMs',
    'toolMisuseRate',
    'invalidToolCallRate',
    'toolStarvationRate',
    'falsePassRate',
    'contextGrowthTokens',
    'guards',
  ]
  const rows = report.results.map(result => [
    result.profile,
    String(result.window),
    String(result.sampleCount),
    String(result.passAt1),
    String(result.verifiedCompletionRate),
    String(result.costToVerifiedCompletion),
    String(result.medianLatencyMs),
    String(result.toolMisuseRate),
    String(result.invalidToolCallRate),
    String(result.toolStarvationRate),
    String(result.falsePassRate),
    String(result.contextGrowthTokens),
    result.guards.join('|'),
  ])
  return [header, ...rows].map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
}

function toMarkdown(report: ReturnType<typeof buildDSXUV8ToolWindowABReport>): string {
  const lines = [
    '# DSXU V8 Tool Window AB Report',
    '',
    `- suite: ${report.suite}`,
    `- resultLevel: ${report.resultLevel}`,
    `- publicClaimAllowed: ${String(report.publicClaimAllowed)}`,
    `- generatedAt: ${report.generatedAt}`,
    '',
    '## Selection',
    '',
    '| profile | selectedWindow | reason |',
    '|---|---:|---|',
    ...report.selection.map(item => `| ${item.profile} | ${item.selectedWindow} | ${item.reason} |`),
    '',
    '## Results',
    '',
    '| profile | window | pass@1 | verified | cost | latencyMs | starvation | misuse | invalid | falsePass | guards |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...report.results.map(result =>
      `| ${result.profile} | ${result.window} | ${result.passAt1} | ${result.verifiedCompletionRate} | ${result.costToVerifiedCompletion} | ${result.medianLatencyMs} | ${result.toolStarvationRate} | ${result.toolMisuseRate} | ${result.invalidToolCallRate} | ${result.falsePassRate} | ${result.guards.join('<br>')} |`,
    ),
    '',
    '## Blocked Claims',
    '',
    ...(report.blockedClaims.length > 0 ? report.blockedClaims.map(claim => `- ${claim}`) : ['- none']),
    '',
  ]
  return lines.join('\n')
}

function writeOutput(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const options = parseOptions()
const samples = options.replayPath
  ? readReplaySamples(options.replayPath)
  : createDSXUV8MockToolWindowABSamples({
      profiles: options.profiles,
      windows: options.windows,
      suite: options.suite,
    })
const report = buildDSXUV8ToolWindowABReport({
  suite: options.suite,
  resultLevel: options.replayPath ? options.resultLevel : 'mock',
  samples,
})

const generatedRoot = join('docs', 'generated')
const baseName = 'DSXU_V8_TOOL_WINDOW_AB_20260519'
writeOutput(join(generatedRoot, `${baseName}.json`), `${JSON.stringify(report, null, 2)}\n`)
writeOutput(join(generatedRoot, `${baseName}.csv`), `${toCsv(report)}\n`)
writeOutput(join('docs', `${baseName}.md`), toMarkdown(report))

console.log(JSON.stringify({
  status: 'PASS_DSXU_V8_TOOL_WINDOW_AB_REPORT',
  suite: report.suite,
  resultLevel: report.resultLevel,
  publicClaimAllowed: report.publicClaimAllowed,
  profiles: report.profiles.length,
  windows: report.windows.length,
  results: report.results.length,
}, null, 2))
