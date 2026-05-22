import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

type CommandResult = {
  id: string
  command: string[]
  status: 'PASS' | 'FAIL'
  exitCode: number | null
  elapsedMs: number
  stdoutTail: string
  stderrTail: string
}

const ROOT = process.cwd()
const GENERATED = join(ROOT, 'docs', 'generated')

const COMMANDS: Array<{ id: string; args: string[]; timeoutMs: number }> = [
  {
    id: 'compact-trust-evidence-line-scroll-resize',
    args: [
      'test',
      'src/components/__tests__/tui-trust-surface.test.tsx',
      'src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts',
      'src/ink/__tests__/render-node-scroll-resize.test.ts',
    ],
    timeoutMs: 120_000,
  },
  {
    id: 'terminal-reliability-pack',
    args: ['test', 'src/dsxu/engine/__tests__/tui-terminal-reliability-pack-v1.test.ts'],
    timeoutMs: 120_000,
  },
  {
    id: 'streaming-and-model-driven-health',
    args: [
      'test',
      'src/dsxu/engine/__tests__/model-driven-tui-long-task-v1.test.ts',
      'src/dsxu/engine/__tests__/streaming-ui-visibility-v1.test.ts',
    ],
    timeoutMs: 120_000,
  },
  {
    id: 'real-pty-long-content-resize-tail',
    args: [
      'test',
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      '-t',
      'long-content TUI output pinned',
      '--timeout',
      '120000',
    ],
    timeoutMs: 180_000,
  },
  {
    id: 'real-pty-permission-review-resize',
    args: [
      'test',
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      '-t',
      'permission review visible',
      '--timeout',
      '120000',
    ],
    timeoutMs: 180_000,
  },
  {
    id: 'real-pty-middle-scrollback-resize',
    args: [
      'test',
      'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts',
      '-t',
      'middle scrollback',
      '--timeout',
      '120000',
    ],
    timeoutMs: 180_000,
  },
]

function tail(text: string, max = 6000): string {
  return text.length <= max ? text : text.slice(text.length - max)
}

function write(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, 'utf8')
}

function runCommand(id: string, args: string[], timeoutMs: number): CommandResult {
  const started = Date.now()
  const result = spawnSync('bun', args, {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    windowsHide: true,
    maxBuffer: 1024 * 1024 * 16,
  })
  const elapsedMs = Date.now() - started
  return {
    id,
    command: ['bun', ...args],
    status: result.status === 0 ? 'PASS' : 'FAIL',
    exitCode: result.status,
    elapsedMs,
    stdoutTail: tail(String(result.stdout ?? '')),
    stderrTail: tail(String(result.stderr ?? '')),
  }
}

function main(): void {
  const results = COMMANDS.map(command => runCommand(command.id, command.args, command.timeoutMs))
  const blockers = results.filter(result => result.status !== 'PASS').map(result => result.id)
  const status = blockers.length === 0 ? 'PASS_V10_FINAL_TUI_TRUST_SURFACE' : 'BLOCKED_V10_FINAL_TUI_TRUST_SURFACE'
  const report = {
    schemaVersion: 'dsxu.v10.final-tui-trust-surface',
    generatedAt: new Date().toISOString(),
    owner: 'TUI Trust Surface / Evidence / Release Claim Binder',
    status,
    publicClaimAllowed: false,
    checks: results,
    blockers,
    coverage: [
      'compact trust status lines',
      'final usage/evidence line suppression',
      'scroll resize anchoring',
      'terminal reliability pack',
      'streaming UI health and auth/progress states',
      'real PTY long-content resize sticky tail',
      'real PTY permission review visibility after resize',
      'real PTY middle scrollback resize anchoring',
    ],
    rule:
      'This is focused TUI trust evidence. It does not replace final six-stage acceptance or live provider benchmark evidence.',
  }
  const jsonPath = join(GENERATED, 'DSXU_V10_FINAL_TUI_TRUST_SURFACE_20260520.json')
  const mdPath = join(ROOT, 'docs', 'DSXU_V10_FINAL_TUI_TRUST_SURFACE_20260520.md')
  write(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  write(mdPath, [
    '# DSXU V10 Final TUI Trust Surface Evidence',
    '',
    `Status: ${status}`,
    '',
    `Public claim allowed: ${String(report.publicClaimAllowed)}`,
    '',
    '| check | status | elapsedMs |',
    '|---|---|---:|',
    ...results.map(result => `| ${result.id} | ${result.status} | ${result.elapsedMs} |`),
    '',
    `Blockers: ${blockers.join(', ') || 'none'}`,
    '',
    'Coverage:',
    ...report.coverage.map(item => `- ${item}`),
    '',
    `Rule: ${report.rule}`,
    '',
  ].join('\n'))
  console.log(JSON.stringify({ status, blockers, outputJson: jsonPath, outputMd: mdPath }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main()
