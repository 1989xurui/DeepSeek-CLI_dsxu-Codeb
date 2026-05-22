import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { normalizeV18EvidenceJsonText } from './go-stop-decision'

export type CodeTerminalSuite = 'code' | 'terminal'

export type CodeTerminalCase = {
  id: string
  suite: CodeTerminalSuite
  category: string
  status: string
  entryModel?: string | null
  routeModel?: string
  routeReason?: string
  costUSD?: number
  toolCalls?: number
}

export type CodeTerminalRunnerEvidence = {
  ok: boolean
  status: 'DRY_PLAN_READY' | 'DONE_EVIDENCED' | 'BLOCKED'
  generatedAt: string
  evidencePath: string
  sourceReportPath: string
  sourceReportMode: 'dry' | 'live' | 'unknown'
  entryModelMode?: string
  entryModel?: string | null
  code: {
    required: number
    found: number
    pass: number
    missingIds: string[]
    cases: CodeTerminalCase[]
  }
  terminal: {
    required: number
    found: number
    pass: number
    missingIds: string[]
    cases: CodeTerminalCase[]
  }
  routeModels: string[]
  blockers: string[]
  guards: string[]
  nextCommand: {
    dry: string
    live: string
  }
}

type BenchmarkReport = {
  mode?: string
  entryModelMode?: string
  entryModel?: string | null
  cases?: Array<{
    id?: string
    category?: string
    status?: string
    entryModel?: string | null
    routeExpectation?: {
      expectedModel?: string
      routeReason?: string
    }
    metrics?: {
      totalCostUSD?: number
      toolCalls?: number
    }
  }>
}

export const CODE_TERMINAL_CODE_CASE_IDS = [
  'v8-real-bugfix-multifile',
  'v8-real-feature-tests',
  'v8-real-review-fix',
  'v8-real-recovery-failed-test',
  'v8-real-workflow-error-recovery',
  'product-multifile-bugfix-live',
  'product-feature-tests-live',
  'product-review-fix-live',
  'product-workflow-recovery-live',
  'product-compact-resume-edit-live',
] as const

export const CODE_TERMINAL_TERMINAL_CASE_IDS = [
  'permission-deny-replan',
  'compact-state-preservation',
  'powershell-windows-path',
  'grep-glob-tool-choice',
  'todo-task-closeout',
  'permissions-deny-precedence',
  'powershell-encoded-deny',
  'permission-matrix-contract',
  'permission-grant-revoke-live',
  'permission-accept-edits-deny-precedence-live',
] as const

function benchmarkCommand(outDir: string, live: boolean): string {
  return [
    'bun .\\scripts\\benchmark\\dsxu-mainline-benchmark.ts',
    live ? '--live' : '',
    `--out=${outDir}`,
    '--entry-model=auto',
    ...[...CODE_TERMINAL_CODE_CASE_IDS, ...CODE_TERMINAL_TERMINAL_CASE_IDS].map(
      id => `--case=${id}`,
    ),
  ]
    .filter(Boolean)
    .join(' ')
}

function collectCases(
  report: BenchmarkReport,
  suite: CodeTerminalSuite,
  ids: readonly string[],
): CodeTerminalCase[] {
  const byId = new Map((report.cases ?? []).map(item => [item.id, item]))
  return ids.flatMap(id => {
    const item = byId.get(id)
    if (!item) return []
    return [
      {
        id,
        suite,
        category: item.category ?? 'unknown',
        status: item.status ?? 'unknown',
        entryModel: item.entryModel,
        routeModel: item.routeExpectation?.expectedModel,
        routeReason: item.routeExpectation?.routeReason,
        costUSD: item.metrics?.totalCostUSD,
        toolCalls: item.metrics?.toolCalls,
      },
    ]
  })
}

function missingIds(
  cases: readonly CodeTerminalCase[],
  ids: readonly string[],
): string[] {
  const found = new Set(cases.map(item => item.id))
  return ids.filter(id => !found.has(id))
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort()
}

export function buildCodeTerminalRunnerEvidence(input: {
  generatedAt: string
  evidencePath: string
  sourceReportPath: string
  sourceReport: BenchmarkReport
  outDir: string
}): CodeTerminalRunnerEvidence {
  const sourceReportMode =
    input.sourceReport.mode === 'dry' || input.sourceReport.mode === 'live'
      ? input.sourceReport.mode
      : 'unknown'
  const codeCases = collectCases(input.sourceReport, 'code', CODE_TERMINAL_CODE_CASE_IDS)
  const terminalCases = collectCases(
    input.sourceReport,
    'terminal',
    CODE_TERMINAL_TERMINAL_CASE_IDS,
  )
  const codeMissing = missingIds(codeCases, CODE_TERMINAL_CODE_CASE_IDS)
  const terminalMissing = missingIds(terminalCases, CODE_TERMINAL_TERMINAL_CASE_IDS)
  const blockers: string[] = []
  const guards: string[] = []

  if (codeMissing.length > 0) {
    blockers.push(`missing Code-10 cases: ${codeMissing.join(', ')}`)
  }
  if (terminalMissing.length > 0) {
    blockers.push(`missing Terminal-10 cases: ${terminalMissing.join(', ')}`)
  }
  if (input.sourceReport.entryModelMode !== 'auto') {
    blockers.push('runner entry model must be auto for Flash-first evidence')
  }
  if (input.sourceReport.entryModel !== 'deepseek-v4-flash') {
    blockers.push('runner dry/live entry model is not Flash-first')
  }

  const codePass = codeCases.filter(item => item.status === 'pass').length
  const terminalPass = terminalCases.filter(item => item.status === 'pass').length
  if (sourceReportMode !== 'live') {
    guards.push('dry plan only; no Code-10 or Terminal-10 score can be claimed')
  }
  if (
    sourceReportMode === 'live' &&
    (codePass < CODE_TERMINAL_CODE_CASE_IDS.length ||
      terminalPass < CODE_TERMINAL_TERMINAL_CASE_IDS.length)
  ) {
    blockers.push('live Code-10/Terminal-10 did not fully pass')
  }
  const routeModels = unique(
    [...codeCases, ...terminalCases].flatMap(item =>
      item.routeModel ? [item.routeModel] : [],
    ),
  )
  if (
    !routeModels.includes('deepseek-v4-flash') ||
    !routeModels.includes('deepseek-v4-pro')
  ) {
    blockers.push('runner route plan must include both Flash and Pro nodes')
  }

  const status: CodeTerminalRunnerEvidence['status'] =
    blockers.length > 0
      ? 'BLOCKED'
      : sourceReportMode === 'live'
        ? 'DONE_EVIDENCED'
        : 'DRY_PLAN_READY'

  return {
    ok: status !== 'BLOCKED',
    status,
    generatedAt: input.generatedAt,
    evidencePath: input.evidencePath,
    sourceReportPath: input.sourceReportPath,
    sourceReportMode,
    entryModelMode: input.sourceReport.entryModelMode,
    entryModel: input.sourceReport.entryModel,
    code: {
      required: CODE_TERMINAL_CODE_CASE_IDS.length,
      found: codeCases.length,
      pass: codePass,
      missingIds: codeMissing,
      cases: codeCases,
    },
    terminal: {
      required: CODE_TERMINAL_TERMINAL_CASE_IDS.length,
      found: terminalCases.length,
      pass: terminalPass,
      missingIds: terminalMissing,
      cases: terminalCases,
    },
    routeModels,
    blockers,
    guards,
    nextCommand: {
      dry: benchmarkCommand(input.outDir, false),
      live: benchmarkCommand(input.outDir, true),
    },
  }
}

export async function runCodeTerminalRunnerHarness(options: {
  sourceReportPath?: string
  evidenceDir?: string
  nowIso?: string
  outDir?: string
} = {}): Promise<CodeTerminalRunnerEvidence> {
  const root = process.cwd()
  const outDir =
    options.outDir ?? '.dsxu/runs/v18-code-terminal-10-dry-20260507'
  const sourceReportPath =
    options.sourceReportPath ?? join(root, outDir, 'dry-report.json')
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-eval')
  const evidencePath = join(
    evidenceDir,
    'code-terminal-10-runner-20260507.evidence.json',
  )
  await mkdir(evidenceDir, { recursive: true })
  const sourceReport = JSON.parse(
    normalizeV18EvidenceJsonText(await readFile(sourceReportPath, 'utf8')),
  ) as BenchmarkReport
  const evidence = buildCodeTerminalRunnerEvidence({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    sourceReportPath,
    sourceReport,
    outDir,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
