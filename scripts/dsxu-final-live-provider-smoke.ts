import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type Json = Record<string, any>

function hasArg(name: string): boolean {
  return process.argv.includes(name)
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function runV8ProviderSmoke(live: boolean): {
  exitCode: number
  stdout: string
  stderr: string
} {
  const result = Bun.spawnSync({
    cmd: ['bun', 'run', 'scripts/dsxu-v8-live-provider-smoke.ts', ...(live ? ['--live'] : [])],
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
  const live = hasArg('--live')
  const run = runV8ProviderSmoke(live)
  const sourceJson = join(process.cwd(), 'docs', 'generated', 'DSXU_V8_LIVE_PROVIDER_SMOKE_20260520.json')
  const source = readJson(sourceJson)
  const checks = Array.isArray(source?.checks) ? source.checks : []
  const failed = checks.filter((check: Json) => check.status === 'FAIL')
  const skipped = checks.filter((check: Json) => check.status === 'SKIP')
  const blockers = [
    run.exitCode !== 0 ? `v8-provider-script-exit:${run.exitCode}` : '',
    source?.status !== 'PASS_V8_PROVIDER_SMOKE_CONTRACT' ? `source:${source?.status ?? 'MISSING'}` : '',
    source?.publicClaimAllowed === true ? 'source unexpectedly allows public claim' : '',
    failed.length > 0 ? `failed-checks:${failed.map((check: Json) => check.id).join('|')}` : '',
  ].filter(Boolean)
  const report = {
    schemaVersion: 'dsxu.final-live-provider-smoke.v10',
    generatedAt: new Date().toISOString(),
    owner: 'DeepSeek Provider Contract / Release Claim Binder',
    mode: live ? 'live' : 'dry-run',
    status: blockers.length === 0 ? 'PASS_V10_FINAL_PROVIDER_SMOKE' : 'FAIL_V10_FINAL_PROVIDER_SMOKE',
    publicClaimAllowed: false,
    sourceStatus: source?.status ?? 'MISSING',
    sourceMode: source?.mode ?? 'MISSING',
    sourceJson,
    checkCount: checks.length,
    skippedCheckCount: skipped.length,
    failedCheckCount: failed.length,
    stdoutPreview: run.stdout.slice(0, 800),
    stderrPreview: run.stderr.slice(0, 800),
    blockers,
    rule:
      'Provider smoke validates DeepSeek request/response contract shape. Dry-run proves request projection; live mode proves one real provider call when a key is explicitly available. Neither mode is a benchmark.',
  }
  const suffix = live ? 'LIVE' : 'DRY'
  const jsonPath = join(process.cwd(), 'docs', 'generated', `DSXU_V10_FINAL_PROVIDER_SMOKE_${suffix}_20260520.json`)
  const mdPath = join(process.cwd(), 'docs', `DSXU_V10_FINAL_PROVIDER_SMOKE_${suffix}_20260520.md`)
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final Provider Smoke',
    '',
    `Status: ${report.status}`,
    '',
    `Mode: ${report.mode}`,
    '',
    `Source status: ${report.sourceStatus}`,
    '',
    `Checks: ${report.checkCount}, skipped: ${report.skippedCheckCount}, failed: ${report.failedCheckCount}`,
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status: report.status, mode: report.mode, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
