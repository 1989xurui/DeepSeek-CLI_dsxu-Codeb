import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Json = Record<string, any>

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function runV8LongTask(): {
  exitCode: number
  stdout: string
  stderr: string
} {
  const result = Bun.spawnSync({
    cmd: ['bun', 'run', 'scripts/dsxu-v8-long-task-ledger-replay.ts'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    exitCode: result.exitCode ?? 1,
    stdout: new TextDecoder().decode(result.stdout ?? new Uint8Array()),
    stderr: new TextDecoder().decode(result.stderr ?? new Uint8Array()),
  }
}

function readJson(path: string): Json | undefined {
  if (!existsSync(path)) return undefined
  return JSON.parse(readFileSync(path, 'utf8')) as Json
}

function main(): void {
  const run = runV8LongTask()
  const sourceJson = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_LONG_TASK_LEDGER_REPLAY_20260520.json')
  const source = readJson(sourceJson)
  const tuiLines = Array.isArray(source?.projection?.tuiLines) ? source.projection.tuiLines : []
  const blockers = [
    run.exitCode !== 0 ? `v8-long-task-script-exit:${run.exitCode}` : '',
    source?.status !== 'PASS_V8_LONG_TASK_LEDGER_REPLAY' ? `source:${source?.status ?? 'MISSING'}` : '',
    source?.publicClaimAllowed === true ? 'source unexpectedly allows public claim' : '',
    source?.projection?.finalClaimAllowed === true ? 'long-task projection unexpectedly allows final claim after blocked verification' : '',
    tuiLines.length === 0 ? 'missing compact TUI projection lines' : '',
    source?.runtimeProof?.status !== 'PASS_RUNTIME_EVENT_SCHEMA_CONSUMPTION'
      ? `runtimeProof:${source?.runtimeProof?.status ?? 'MISSING'}`
      : '',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.final-long-task-replay.v10',
    generatedAt: new Date().toISOString(),
    owner: 'PlanGraph / Work-State / Recovery / Evidence',
    status: blockers.length === 0 ? 'PASS_V10_FINAL_LONG_TASK_REPLAY' : 'FAIL_V10_FINAL_LONG_TASK_REPLAY',
    publicClaimAllowed: false,
    sourceStatus: source?.status ?? 'MISSING',
    sourceJson,
    stdoutPreview: run.stdout.slice(0, 800),
    stderrPreview: run.stderr.slice(0, 800),
    projectionStatus: source?.projection?.finalReportSection?.status,
    durableProofStatus: source?.durableProof?.status,
    runtimeProofStatus: source?.runtimeProof?.status,
    tuiLines,
    blockers,
    rule:
      'V10 final long-task replay reuses the V8 ledger owner output and only upgrades evidence aggregation. It is not a new execution runtime.',
  }
  const jsonPath = join(process.cwd(), 'docs', 'generated', 'DSXU_V10_FINAL_LONG_TASK_REPLAY_20260520.json')
  const mdPath = join(process.cwd(), 'docs', 'DSXU_V10_FINAL_LONG_TASK_REPLAY_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Long Task Replay',
    '',
    `Status: ${report.status}`,
    '',
    `Source status: ${report.sourceStatus}`,
    '',
    `Projection status: ${report.projectionStatus ?? 'MISSING'}`,
    '',
    `Runtime proof: ${report.runtimeProofStatus ?? 'MISSING'}`,
    '',
    '## Compact TUI Lines',
    '',
    ...tuiLines.map((line: string) => `- ${line}`),
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status: report.status, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
