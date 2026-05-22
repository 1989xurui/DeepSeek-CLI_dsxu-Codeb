import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

type CommandSpec = {
  id: string
  purpose: string
  command: string[]
  timeoutMs: number
  cwd: string
  stdin?: string
  envMode?: 'current' | 'without-provider-secrets'
  expectedExitCodes?: number[]
  requiredStdoutIncludes?: string[]
}

type CommandResult = {
  id: string
  purpose: string
  command: string[]
  cwd: string
  exitCode: number
  passed: boolean
  durationMs: number
  stdoutPath: string
  stderrPath: string
  stdoutTail: string
  stderrTail: string
}

const ROOT = process.cwd()
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'v24-fresh-install-release-smoke')
const ISOLATED_CONFIG_DIR = join(TRACE_DIR, `isolated-config-${safeTime()}`)
const CLEAN_EXPORT_REPORT = join(GENERATED_DIR, 'DSXU_V24_CLEAN_EXPORT_ARTIFACT_20260515.json')
const OUT_JSON = join(GENERATED_DIR, 'DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.json')
const OUT_MD = join(ROOT, 'docs', 'DSXU_V24_FRESH_INSTALL_RELEASE_SMOKE_20260515.md')

function safeTime(): string {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function tail(text: string, max = 2_500): string {
  return text.length <= max ? text : text.slice(-max)
}

function commandEnv(mode: CommandSpec['envMode'] = 'current'): Record<string, string | undefined> {
  const env = {
    ...process.env,
    DSXU_CODE_MODE: '1',
    DSXU_PRODUCT_NAME: 'DSXU Code',
    DSXU_MODEL_PROVIDER: process.env.DSXU_MODEL_PROVIDER ?? 'deepseek',
    DSXU_MODEL_GATEWAY: process.env.DSXU_MODEL_GATEWAY ?? 'direct',
  }
  if (mode === 'without-provider-secrets') {
    env.DSXU_CONFIG_DIR = ISOLATED_CONFIG_DIR
    delete env.DSXU_API_KEY
    delete env.DEEPSEEK_API_KEY
    delete env.DSXU_DEEPSEEK_API_KEY
    delete env.LITELLM_API_KEY
    delete env.LITELLM_BASE_URL
  }
  return env
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')) as Record<string, unknown>
}

async function runCommand(spec: CommandSpec): Promise<CommandResult> {
  const startedAt = Date.now()
  const base = `${spec.id}-${safeTime()}`
  const stdoutPath = join(TRACE_DIR, `${base}.stdout.log`)
  const stderrPath = join(TRACE_DIR, `${base}.stderr.log`)
  await mkdir(dirname(stdoutPath), { recursive: true })
  const proc = Bun.spawn(spec.command, {
    cwd: spec.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: spec.stdin === undefined ? 'ignore' : 'pipe',
    env: commandEnv(spec.envMode),
  })
  if (spec.stdin !== undefined) {
    proc.stdin.write(spec.stdin)
    proc.stdin.end()
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<number>(resolve => {
    timer = setTimeout(() => {
      proc.kill()
      resolve(124)
    }, spec.timeoutMs)
  })
  const exitCode = await Promise.race([proc.exited, timeout])
  if (timer) clearTimeout(timer)
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  await Promise.all([
    writeFile(stdoutPath, stdout, 'utf8'),
    writeFile(stderrPath, stderr, 'utf8'),
  ])
  const expectedExitCodes = spec.expectedExitCodes ?? [0]
  const stdoutChecksPass = (spec.requiredStdoutIncludes ?? []).every(text => stdout.includes(text))
  return {
    id: spec.id,
    purpose: spec.purpose,
    command: spec.command,
    cwd: spec.cwd,
    exitCode,
    passed: expectedExitCodes.includes(exitCode) && stdoutChecksPass,
    durationMs: Date.now() - startedAt,
    stdoutPath,
    stderrPath,
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  }
}

function mdTable(results: CommandResult[]): string {
  const headers = ['id', 'passed', 'exitCode', 'durationMs', 'stdout', 'stderr']
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...results.map(result => `| ${[
      result.id,
      String(result.passed),
      String(result.exitCode),
      String(result.durationMs),
      result.stdoutPath,
      result.stderrPath,
    ].join(' | ')} |`),
  ].join('\n')
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(TRACE_DIR, { recursive: true })
  const exportReport = await readJson(CLEAN_EXPORT_REPORT)
  if (exportReport.status !== 'PASS_CLEAN_EXPORT_ARTIFACT_CREATED') {
    throw new Error(`fresh install smoke blocked: clean export artifact is not PASS (${String(exportReport.status)})`)
  }
  const exportDir = String(exportReport.exportDir ?? '')
  if (!exportDir) throw new Error('fresh install smoke blocked: exportDir missing from clean export report')

  const commands: CommandSpec[] = [
    {
      id: 'fresh-bun-install',
      purpose: 'install dependencies from clean export without source node_modules',
      command: ['bun', 'install', '--frozen-lockfile'],
      timeoutMs: 900_000,
      cwd: exportDir,
    },
    {
      id: 'product-help',
      purpose: 'product CLI help from clean export',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', '--help'],
      timeoutMs: 120_000,
      cwd: exportDir,
    },
    {
      id: 'slash-help-print',
      purpose: 'slash /help dispatcher from clean export print mode',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', '-p', '/help', '--output-format', 'json'],
      timeoutMs: 120_000,
      cwd: exportDir,
      requiredStdoutIncludes: ['DSXU Code available commands'],
    },
    {
      id: 'auth-login-no-key-guidance',
      purpose: 'first-run missing-key guidance without bundling provider secrets',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', 'auth', 'login'],
      timeoutMs: 120_000,
      cwd: exportDir,
      envMode: 'without-provider-secrets',
      requiredStdoutIncludes: ['Configure DSXU model access with DSXU_API_KEY'],
    },
    {
      id: 'auth-login-key-wizard-stdin',
      purpose: 'first-run key wizard stdin path saves a DSXU managed local key without echoing the key',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', 'auth', 'login', '--api-key-stdin'],
      stdin: 'sk-test-v26-key-123_ABC\n',
      timeoutMs: 120_000,
      cwd: exportDir,
      envMode: 'without-provider-secrets',
      requiredStdoutIncludes: ['DSXU model access saved from stdin'],
    },
    {
      id: 'product-doctor',
      purpose: 'product doctor command from clean export',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', 'doctor'],
      timeoutMs: 180_000,
      cwd: exportDir,
    },
    {
      id: 'mcp-doctor-json',
      purpose: 'MCP doctor JSON command from clean export',
      command: ['bun', './src/entrypoints/dsxu-code.tsx', 'mcp', 'doctor', '--json'],
      timeoutMs: 180_000,
      cwd: exportDir,
    },
    {
      id: 'fresh-provider-gate',
      purpose: 'provider readiness gate from clean export',
      command: ['bun', 'run', 'live:provider-gate'],
      timeoutMs: 180_000,
      cwd: exportDir,
    },
  ]

  const results: CommandResult[] = []
  for (const spec of commands) {
    results.push(await runCommand(spec))
  }
  const failed = results.filter(result => !result.passed)
  const status = failed.length === 0
    ? 'PASS_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE'
    : 'FAIL_FRESH_INSTALL_HELP_DOCTOR_PROVIDER_SMOKE'
  const report = {
    schemaVersion: 'dsxu.v24.fresh-install-release-smoke.v1',
    generatedAt: new Date().toISOString(),
    status,
    repoRoot: ROOT,
    exportDir,
    zipPath: exportReport.zipPath ?? null,
    commandCount: results.length,
    passedCommandCount: results.filter(result => result.passed).length,
    failedCommandCount: failed.length,
    failedCommands: failed.map(result => result.id),
    evidenceRule:
      'This smoke runs from the clean export directory after a fresh dependency install. It does not stage, commit, delete, reset, or mutate source workspace files.',
    results,
  }
  const md = [
    '# DSXU V24 Fresh Install Release Smoke - 2026-05-15',
    '',
    `Status: ${status}`,
    '',
    `Export dir: ${exportDir}`,
    '',
    `Commands: ${report.passedCommandCount}/${report.commandCount}`,
    '',
    '## Command Evidence',
    '',
    mdTable(results),
    '',
    '## Rule',
    '',
    report.evidenceRule,
    '',
  ].join('\n')
  await Promise.all([
    writeFile(OUT_JSON, JSON.stringify(report, null, 2) + '\n'),
    writeFile(OUT_MD, md, 'utf8'),
  ])
  console.log(JSON.stringify({
    status,
    passedCommandCount: report.passedCommandCount,
    failedCommandCount: report.failedCommandCount,
    failedCommands: report.failedCommands,
    outputJson: OUT_JSON,
    outputMd: OUT_MD,
  }, null, 2))
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
