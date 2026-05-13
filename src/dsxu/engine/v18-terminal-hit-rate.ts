import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { normalizeV18EvidenceJsonText } from './v18-go-stop-decision'

export type V18TerminalCommandSignal = {
  command: string
  result: string
  classification: 'useful_evidence' | 'no_output_probe' | 'denied_probe' | 'failed_probe' | 'other'
}

export type V18TerminalHitRateEvidence = {
  ok: boolean
  status: 'PARTIAL_TERMINAL_HIT_RATE' | 'DONE_EVIDENCED' | 'BLOCKED'
  generatedAt: string
  evidencePath: string
  sourceReportPath: string
  sourceStreamPath: string
  caseId: string
  budget: {
    targetPowerShellCalls: number
    actualPowerShellCalls: number
    withinBudget: boolean
  }
  signals: {
    usefulEvidence: number
    noOutputProbes: number
    deniedProbes: number
    failedProbes: number
    wastedCommandCount: number
    commands: V18TerminalCommandSignal[]
  }
  blockers: string[]
  guards: string[]
  recommendations: string[]
}

type BenchmarkReport = {
  cases?: Array<{
    id?: string
    status?: string
    metrics?: {
      powerShellCalls?: number
    }
  }>
}

type JsonLine = {
  type?: string
  message?: {
    content?: unknown
  }
}

type ToolUse = {
  id: string
  name: string
  input?: {
    command?: string
  }
}

type ToolResult = {
  tool_use_id: string
  content?: string
  is_error?: boolean
}

const TERMINAL_PATH_INSPECT_BUDGET = 4

function parseJsonLines(jsonl: string): JsonLine[] {
  return jsonl
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .flatMap(line => {
      try {
        return [JSON.parse(line) as JsonLine]
      } catch {
        return []
      }
    })
}

function contentBlocks(line: JsonLine): unknown[] {
  const content = line.message?.content
  return Array.isArray(content) ? content : []
}

function getToolUse(block: unknown): ToolUse | null {
  if (!block || typeof block !== 'object') return null
  const candidate = block as Partial<ToolUse> & { type?: string }
  if (candidate.type !== 'tool_use') return null
  if (candidate.name !== 'PowerShell') return null
  if (typeof candidate.id !== 'string') return null
  return {
    id: candidate.id,
    name: candidate.name,
    input: candidate.input,
  }
}

function getToolResult(block: unknown): ToolResult | null {
  if (!block || typeof block !== 'object') return null
  const candidate = block as Partial<ToolResult> & { type?: string }
  if (candidate.type !== 'tool_result') return null
  if (typeof candidate.tool_use_id !== 'string') return null
  return {
    tool_use_id: candidate.tool_use_id,
    content: typeof candidate.content === 'string' ? candidate.content : '',
    is_error: candidate.is_error,
  }
}

function classifyPowerShellCommand(
  command: string,
  result: string,
): V18TerminalCommandSignal['classification'] {
  if (
    /PowerShell commands must not use local file-read/i.test(result) ||
    /\bGet-ChildItem\b/i.test(command)
  ) {
    return 'denied_probe'
  }
  if (/\(PowerShell completed with no output\)/i.test(result)) {
    return 'no_output_probe'
  }
  if (/Exit code\s+[1-9]/i.test(result) || /Could not find item/i.test(result)) {
    return 'failed_probe'
  }
  if (
    /\bTrue\b/.test(result) ||
    /\bFullName\s*:/i.test(result) ||
    /\bPowerShell edition:/i.test(result) ||
    /\bVersion:/i.test(result) ||
    /\bD:\\/i.test(result)
  ) {
    return 'useful_evidence'
  }
  return 'other'
}

export function buildV18TerminalHitRateEvidence(input: {
  generatedAt: string
  evidencePath: string
  sourceReportPath: string
  sourceReport: BenchmarkReport
  sourceStreamPath: string
  streamJsonl: string
  caseId?: string
}): V18TerminalHitRateEvidence {
  const caseId = input.caseId ?? 'powershell-windows-path'
  const reportCase = input.sourceReport.cases?.find(item => item.id === caseId)
  const toolUses = new Map<string, string>()
  const commands: V18TerminalCommandSignal[] = []

  for (const line of parseJsonLines(input.streamJsonl)) {
    for (const block of contentBlocks(line)) {
      const toolUse = getToolUse(block)
      if (toolUse?.input?.command) {
        toolUses.set(toolUse.id, toolUse.input.command)
        continue
      }
      const result = getToolResult(block)
      if (!result) continue
      const command = toolUses.get(result.tool_use_id)
      if (!command) continue
      commands.push({
        command,
        result: result.content ?? '',
        classification: classifyPowerShellCommand(command, result.content ?? ''),
      })
    }
  }

  const actualPowerShellCalls =
    reportCase?.metrics?.powerShellCalls ?? commands.length
  const usefulEvidence = commands.filter(
    item => item.classification === 'useful_evidence',
  ).length
  const noOutputProbes = commands.filter(
    item => item.classification === 'no_output_probe',
  ).length
  const deniedProbes = commands.filter(
    item => item.classification === 'denied_probe',
  ).length
  const failedProbes = commands.filter(
    item => item.classification === 'failed_probe',
  ).length
  const wastedCommandCount = noOutputProbes + deniedProbes + failedProbes
  const blockers: string[] = []
  const guards: string[] = []
  const recommendations: string[] = []

  if (actualPowerShellCalls > TERMINAL_PATH_INSPECT_BUDGET) {
    blockers.push(
      `PowerShell calls exceed path-inspection budget: ${actualPowerShellCalls}/${TERMINAL_PATH_INSPECT_BUDGET}`,
    )
  }
  if (deniedProbes > 0) {
    blockers.push('terminal stream includes permission-denied directory/content probe')
    recommendations.push(
      'After a local-read/directory-listing denial, converge to final/PARTIAL or an already-known exact path; do not continue broad shell discovery.',
    )
  }
  if (noOutputProbes > 0) {
    blockers.push('terminal stream includes a no-output metadata probe')
    recommendations.push(
      'For Windows path metadata, prefer one exact LiteralPath/Format-List command over retrying multiple projection shapes.',
    )
  }
  if (failedProbes > 0) {
    guards.push('terminal stream includes a failed path probe after useful evidence')
    recommendations.push(
      'Do not probe optional child paths such as .git unless the user requested that child path explicitly.',
    )
  }

  const status: V18TerminalHitRateEvidence['status'] =
    blockers.length > 0 ? 'PARTIAL_TERMINAL_HIT_RATE' : 'DONE_EVIDENCED'

  return {
    ok: blockers.length === 0,
    status,
    generatedAt: input.generatedAt,
    evidencePath: input.evidencePath,
    sourceReportPath: input.sourceReportPath,
    sourceStreamPath: input.sourceStreamPath,
    caseId,
    budget: {
      targetPowerShellCalls: TERMINAL_PATH_INSPECT_BUDGET,
      actualPowerShellCalls,
      withinBudget: actualPowerShellCalls <= TERMINAL_PATH_INSPECT_BUDGET,
    },
    signals: {
      usefulEvidence,
      noOutputProbes,
      deniedProbes,
      failedProbes,
      wastedCommandCount,
      commands,
    },
    blockers,
    guards,
    recommendations,
  }
}

export async function runV18TerminalHitRateHarness(options: {
  sourceReportPath?: string
  sourceStreamPath?: string
  evidenceDir?: string
  nowIso?: string
  caseId?: string
} = {}): Promise<V18TerminalHitRateEvidence> {
  const root = process.cwd()
  const sourceReportPath =
    options.sourceReportPath ??
    join(root, '.dsxu/runs/v18-edit-convergence-gate-live-smoke-20260507/live-report.json')
  const sourceStreamPath =
    options.sourceStreamPath ??
    join(
      root,
      '.dsxu/runs/v18-edit-convergence-gate-live-smoke-20260507/powershell-windows-path.stream.jsonl',
    )
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-eval')
  const evidencePath = join(
    evidenceDir,
    'terminal-hit-rate-20260507.evidence.json',
  )
  await mkdir(evidenceDir, { recursive: true })
  const sourceReport = JSON.parse(
    normalizeV18EvidenceJsonText(await readFile(sourceReportPath, 'utf8')),
  ) as BenchmarkReport
  const evidence = buildV18TerminalHitRateEvidence({
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    sourceReportPath,
    sourceReport,
    sourceStreamPath,
    streamJsonl: await readFile(sourceStreamPath, 'utf8'),
    caseId: options.caseId,
  })
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2), 'utf8')
  return evidence
}
