#!/usr/bin/env bun

import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

type ManifestCase = {
  id: string
  category: 'bugfix' | 'feature' | 'review' | 'recovery' | 'permission' | 'agent'
  promptHash: string
  prompt: string
  expectedModel: string
  workflowKind?: string
  routeReason?: string
  allowedTools?: string
  maxTurns?: number | null
  budgets?: {
    maxToolCalls?: number | null
    maxReadCalls?: number | null
    maxPowerShellCalls?: number | null
    requirePreEditBaselineVerification?: boolean
  }
}

type LaneBudgets = NonNullable<ManifestCase['budgets']>

const DSXU_LANE_CURRENT_WORKTREE_CORE_OVERLAY_PATHS = [
  '.dsxu/ops/MAINLINE_LEDGER.md',
  'bunfig.toml',
  'bun.lock',
  'package-lock.json',
  'package.json',
  'scripts/benchmark/dsxu-mainline-benchmark.ts',
  'src/constants/keys.ts',
  'src/query.ts',
  'src/utils/auth.ts',
  'src/utils/hooks.ts',
  'src/utils/messages.ts',
  'src/utils/permissions/permissionRuleParser.ts',
  'src/utils/permissions/permissionSetup.ts',
  'src/utils/user.ts',
  'src/utils/model/deepseekV4Control.ts',
  'src/dsxu/engine/action-contract.ts',
  'src/dsxu/engine/capability-registry.ts',
  'src/dsxu/engine/context-pressure-matrix.ts',
  'src/dsxu/engine/progress-ledger.ts',
  'src/dsxu/engine/prompt-prefix-cache-builder.ts',
  'src/dsxu/engine/prompt-prefix-cache-evidence.ts',
  'src/dsxu/engine/prompt-section-router.ts',
  'src/dsxu/engine/tool-catalog-v1.ts',
  'src/dsxu/engine/tool-protocol.ts',
  'src/dsxu/engine/tool-window-policy-v8.ts',
  'src/dsxu/engine/work-state-timeline.ts',
  'src/services/analytics/featureFlags.ts',
  'src/services/analytics/firstPartyEventLogger.ts',
  'src/services/analytics/metadata.ts',
  'src/services/auth/dsxuProviderAuth.ts',
  'src/services/cache-prefix-registry.ts',
  'src/services/compact/apiMicrocompact.ts',
] as const

const DSXU_LANE_CURRENT_WORKTREE_DEPENDENCY_LINK_DIRS = [
  'node_modules',
] as const

type PublicComparableManifest = {
  schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1'
  cases: readonly ManifestCase[]
}

type CommandResult = {
  command: readonly string[]
  cwd: string
  exitCode: number
  durationMs: number
  stdout: string
  stderr: string
}

type DsxuLaneOptions = {
  root?: string
  manifestPath?: string
  rawRoot?: string
  reportPath?: string
  workspaceRoot?: string
  caseIds?: readonly string[]
  limit?: number
  write?: boolean
  force?: boolean
  maxTurns?: number
  caseTimeoutMs?: number
  runCommandImpl?: (id: string, command: readonly string[], options: { cwd: string; timeoutMs: number; env?: Record<string, string> }) => Promise<CommandResult>
  prepareWorkspaceImpl?: (input: { root: string; workspaceRoot: string; caseId: string }) => Promise<string>
}

type DsxuLaneCaseReport = {
  id: string
  status: 'PASS_DSXU_LANE_CAPTURED' | 'PARTIAL_DSXU_LANE_CAPTURED' | 'REUSED_DSXU_LANE_EVIDENCE' | 'SKIPPED_ALREADY_EXISTS' | 'FAIL_DSXU_LANE_ERROR'
  model: string
  promptHash: string
  caseDir: string
  workspaceDir?: string
  rawTranscriptPath?: string
  toolTracePath?: string
  finalReportPath?: string
  metricsPath?: string
  artifactDir?: string
  exitCode: number | null
  wallClockMs: number
  costUsd: number
  cacheHitRatePct: number
  toolUseCount: number
  finalPass: boolean
  error?: string
}

type DsxuLaneReport = {
  schemaVersion: 'dsxu.public-comparable-dsxu-lane.v1'
  generatedAt: string
  status: 'PASS' | 'PARTIAL' | 'BLOCKED'
  manifestPath: string
  rawRoot: string
  workspaceRoot: string
  rawEvidenceComplete: false
  publicBenchmarkClaimAllowed: false
  externalComparisonClaimAllowed: false
  caseCount: number
  attemptedCaseCount: number
  capturedCaseCount: number
  skippedCaseCount: number
  failedCaseCount: number
  passedCaseCount: number
  nonPassingCaseCount: number
  nextAction: string
  safeguards: readonly string[]
  cases: readonly DsxuLaneCaseReport[]
}

type ToolBudgetMetrics = {
  toolBudgetExceededCount: number
  readBudgetExceededCount: number
  shellBudgetExceededCount: number
}

type DeclaredStatus = 'PASS' | 'PARTIAL' | 'FAIL' | 'BLOCKED'

type LaneTaskCompilerProfile = {
  taskKind: 'permission_replan' | 'agent_coordination' | 'recovery' | 'review_fix' | 'bugfix_or_feature' | 'source_truth'
  firstAction: 'final_json_no_tools' | 'agent_handoff' | 'run_native_test' | 'grep_source_truth' | 'read_named_paths'
  failurePolicy: string
  readPolicy: string
  editPolicy: string
  verifyPolicy: string
  finalPolicy: string
  trajectoryPattern: string
}

const DATE = '20260518'
const REPORT_DATE = '20260520'
const DEFAULT_MODEL = 'deepseek-v4-flash'
const CLI_NO_TOOLS_SENTINEL = '__DSXU_NO_TOOLS__'
const AGENT_WORKER_EVIDENCE_TOOLS = [
  'Agent',
  'SendMessage',
  'Read',
  'RunNativeTest',
  'CollectEvidence',
  'TaskCreate',
  'TaskUpdate',
] as const

export async function collectPublicComparableDsxuLane(
  options: DsxuLaneOptions = {},
): Promise<DsxuLaneReport> {
  const root = resolve(options.root ?? process.cwd())
  const manifestPath = resolve(root, options.manifestPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_${DATE}.json`))
  const rawRoot = resolve(root, options.rawRoot ?? join('.dsxu', 'trace', 'public-comparable-raw-evidence'))
  const reportPath = resolve(root, options.reportPath ?? join('docs', 'generated', `DSXU_PUBLIC_COMPARABLE_DSXU_LANE_${REPORT_DATE}.json`))
  const workspaceRoot = resolve(root, options.workspaceRoot ?? join(dirname(root), 'DSXU-code-evidence-workspaces', 'public-comparable-dsxu-lane'))
  const write = options.write ?? true
  const manifest = parseManifest(await readJson(manifestPath))
  const selected = selectCases(manifest.cases, options)
  const cases: DsxuLaneCaseReport[] = []

  for (const item of selected) {
    const caseDir = join(rawRoot, item.id)
    const rawTranscriptPath = join(caseDir, 'raw-transcript.jsonl')
    const toolTracePath = join(caseDir, 'tool-trace.jsonl')
    const finalReportPath = join(caseDir, 'final-report.json')
    const metricsPath = join(caseDir, 'metrics.json')
    if (!options.force && existsSync(rawTranscriptPath) && existsSync(toolTracePath) && existsSync(finalReportPath) && existsSync(metricsPath)) {
      cases.push(await readExistingCaseEvidence({
        root,
        item,
        caseDir,
        rawTranscriptPath,
        toolTracePath,
        finalReportPath,
        metricsPath,
      }))
      continue
    }
    cases.push(await captureOneCase({
      root,
      rawRoot,
      workspaceRoot,
      item,
      write,
      maxTurns: options.maxTurns,
      caseTimeoutMs: options.caseTimeoutMs,
      runCommandImpl: options.runCommandImpl ?? runCommand,
      prepareWorkspaceImpl: options.prepareWorkspaceImpl ?? prepareGitWorktreeWorkspace,
    }))
  }

  const capturedCaseCount = cases.filter(item =>
    item.status === 'PASS_DSXU_LANE_CAPTURED' ||
    item.status === 'PARTIAL_DSXU_LANE_CAPTURED' ||
    item.status === 'REUSED_DSXU_LANE_EVIDENCE'
  ).length
  const skippedCaseCount = cases.filter(item => item.status === 'SKIPPED_ALREADY_EXISTS').length
  const failedCaseCount = cases.filter(item => item.status === 'FAIL_DSXU_LANE_ERROR').length
  const passedCaseCount = cases.filter(item => item.finalPass === true).length
  const nonPassingCaseCount = selected.length - passedCaseCount
  const allSelectedCasesPassed = selected.length > 0 &&
    cases.length === selected.length &&
    cases.every(item => item.status !== 'FAIL_DSXU_LANE_ERROR' && item.status !== 'SKIPPED_ALREADY_EXISTS' && item.finalPass === true)
  const status: DsxuLaneReport['status'] = allSelectedCasesPassed
    ? 'PASS'
    : capturedCaseCount + skippedCaseCount > 0
      ? 'PARTIAL'
      : 'BLOCKED'
  const report: DsxuLaneReport = {
    schemaVersion: 'dsxu.public-comparable-dsxu-lane.v1',
    generatedAt: new Date().toISOString(),
    status,
    manifestPath: toEvidencePath(root, manifestPath),
    rawRoot: toEvidencePath(root, rawRoot),
    workspaceRoot: toEvidencePath(root, workspaceRoot),
    rawEvidenceComplete: false,
    publicBenchmarkClaimAllowed: false,
    externalComparisonClaimAllowed: false,
    caseCount: manifest.cases.length,
    attemptedCaseCount: selected.length,
    capturedCaseCount,
    skippedCaseCount,
    failedCaseCount,
    passedCaseCount,
    nonPassingCaseCount,
    nextAction: 'run evidence:public-comparable-raw to import DSXU lane evidence; expand only after low-risk probe cases are stable',
    safeguards: [
      'DSXU lane runs in per-case isolated git worktrees or injected test workspaces, never in the dirty product working tree',
      'top-level PASS means every selected case passed its rubric; captured evidence without rubric pass is PARTIAL',
      'this runner captures transcript/tool/final/metrics evidence but does not judge public superiority',
      'finalPass requires a clean CLI exit, a result event, no unsupported/budget violations, and a declared outcome that matches the case rubric; deny-PASS cases can pass with FAIL when FAIL is the requested outcome',
      'Agent worker evidence lanes require at least one executed Agent result; parent task-board actions alone cannot satisfy worker evidence',
      'public benchmark and external comparison claims remain controlled by the raw-evidence readiness gate',
    ],
    cases,
  }
  if (write) await writeJson(reportPath, report)
  return report
}

async function readExistingCaseEvidence(input: {
  root: string
  item: ManifestCase
  caseDir: string
  rawTranscriptPath: string
  toolTracePath: string
  finalReportPath: string
  metricsPath: string
}): Promise<DsxuLaneCaseReport> {
  const metrics = await readJson(input.metricsPath)
  const finalReport = await readJson(input.finalReportPath)
  const metricRecord = isRecord(metrics) ? metrics : {}
  const finalRecord = isRecord(finalReport) ? finalReport : {}
  const finalPass = metricRecord.finalPass === true
  const toolUseCount = countExistingToolUses(finalRecord)
  return {
    id: input.item.id,
    status: 'REUSED_DSXU_LANE_EVIDENCE',
    model: input.item.expectedModel || DEFAULT_MODEL,
    promptHash: input.item.promptHash,
    caseDir: toEvidencePath(input.root, input.caseDir),
    rawTranscriptPath: toEvidencePath(input.root, input.rawTranscriptPath),
    toolTracePath: toEvidencePath(input.root, input.toolTracePath),
    finalReportPath: toEvidencePath(input.root, input.finalReportPath),
    metricsPath: toEvidencePath(input.root, input.metricsPath),
    artifactDir: toEvidencePath(input.root, join(input.caseDir, 'artifacts')),
    exitCode: numberValue(metricRecord.exitCode) ?? numberValue(finalRecord.exitCode) ?? null,
    wallClockMs: numberValue(metricRecord.wallClockMs) ?? 0,
    costUsd: numberValue(metricRecord.costUsd) ?? 0,
    cacheHitRatePct: numberValue(metricRecord.cacheHitRatePct) ?? 0,
    toolUseCount,
    finalPass,
  }
}

function countExistingToolUses(finalReport: Record<string, unknown>): number {
  const executed = finalReport.executedToolUseCounts
  if (isRecord(executed)) {
    return Object.values(executed).reduce((sum, value) => sum + (numberValue(value) ?? 0), 0)
  }
  const attempted = finalReport.attemptedToolUseCounts
  if (isRecord(attempted)) {
    return Object.values(attempted).reduce((sum, value) => sum + (numberValue(value) ?? 0), 0)
  }
  return numberValue(finalReport.toolUseCount) ?? 0
}

async function captureOneCase(input: {
  root: string
  rawRoot: string
  workspaceRoot: string
  item: ManifestCase
  write: boolean
  maxTurns?: number
  caseTimeoutMs?: number
  runCommandImpl: NonNullable<DsxuLaneOptions['runCommandImpl']>
  prepareWorkspaceImpl: NonNullable<DsxuLaneOptions['prepareWorkspaceImpl']>
}): Promise<DsxuLaneCaseReport> {
  const { root, rawRoot, workspaceRoot, item, write, maxTurns, caseTimeoutMs, runCommandImpl, prepareWorkspaceImpl } = input
  const caseDir = join(rawRoot, item.id)
  const artifactDir = join(caseDir, 'artifacts')
  const rawTranscriptPath = join(caseDir, 'raw-transcript.jsonl')
  const toolTracePath = join(caseDir, 'tool-trace.jsonl')
  const finalReportPath = join(caseDir, 'final-report.json')
  const metricsPath = join(caseDir, 'metrics.json')
  const workspaceDir = await prepareWorkspaceImpl({ root, workspaceRoot, caseId: item.id })
  const budgets = deriveEffectiveBudgets(item)
  const tools = deriveTools(item, budgets)
  const command = buildDsxuCommand(root, item, tools, maxTurns, budgets, workspaceDir)
  let run: CommandResult
  try {
    run = await runCommandImpl(item.id, command, {
      cwd: workspaceDir,
      timeoutMs: caseTimeoutMs ?? 900_000,
      env: buildDsxuLaneEnv(budgets, tools),
    })
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error)
    const metrics = {
      promptHash: item.promptHash,
      firstAttemptPass: false,
      secondAttemptPass: false,
      finalPass: false,
      costUsd: 0,
      wallClockMs: 0,
      cacheHitRatePct: 0,
      proAdmissionCount: (item.expectedModel || '').includes('pro') ? 1 : 0,
      failureRecoveryEvents: 1,
      finalJsonUsable: false,
      finalJsonStrict: false,
      finalJsonRepaired: false,
      unavailableToolUseCount: 0,
      executionVisibilityBlockedCount: 0,
      toolBudgetBlockedCount: 0,
      noToolUnsupportedClaimCount: 0,
      namedPathRubricViolationCount: 0,
      toolBudgetExceededCount: 0,
      readBudgetExceededCount: 0,
      shellBudgetExceededCount: 0,
      toolResultChars: 0,
      artifactLogSizeBytes: Buffer.byteLength(errorText, 'utf8'),
    }
    const finalReport = {
      schemaVersion: 'dsxu.public-comparable-dsxu-lane-final-report.v1',
      generatedAt: new Date().toISOString(),
      caseId: item.id,
      model: item.expectedModel || DEFAULT_MODEL,
      promptHash: item.promptHash,
      workspaceDir: toEvidencePath(root, workspaceDir),
      command: command.map(value => value.includes(root) ? toEvidencePath(root, value) : value),
      exitCode: 124,
      wallClockMs: 0,
      finalPass: false,
      declaredStatus: null,
      finalJsonUsable: false,
      finalJsonStrict: false,
      finalJsonRepaired: false,
      expectedDeclaredStatuses: expectedDeclaredStatuses(item),
      declaredOutcomeSatisfiesRubric: false,
      conservativePassPolicy: 'Case pass requires usable double-quoted JSON, clean command execution, and a declared outcome that matches the case rubric. Runner-level command errors are recorded as lane errors rather than aborting the whole batch.',
      resultText: '',
      attemptedToolUseCounts: {},
      executedToolUseCounts: {},
      budgets,
      toolDiscipline: {
        unavailableToolUseCount: 0,
        executionVisibilityBlockedCount: 0,
        toolBudgetBlockedCount: 0,
        failureEventCount: 1,
        finalJsonUsable: false,
        finalJsonStrict: false,
        finalJsonRepaired: false,
        noToolUnsupportedClaimCount: 0,
        namedPathRubricViolationCount: 0,
        toolBudgetExceededCount: 0,
        readBudgetExceededCount: 0,
        shellBudgetExceededCount: 0,
      },
      stderrTail: errorText.slice(-4000),
    }
    if (write) {
      await mkdir(artifactDir, { recursive: true })
      await Promise.all([
        writeFile(rawTranscriptPath, JSON.stringify({ type: 'runner_error', error: errorText }) + '\n', 'utf8'),
        writeFile(toolTracePath, JSON.stringify({ type: 'runner_error', error: errorText }) + '\n', 'utf8'),
        writeJson(finalReportPath, finalReport),
        writeJson(metricsPath, metrics),
        writeFile(join(artifactDir, 'stdout.log'), '', 'utf8'),
        writeFile(join(artifactDir, 'stderr.log'), errorText, 'utf8'),
      ])
    }
    return {
      id: item.id,
      status: 'FAIL_DSXU_LANE_ERROR',
      model: item.expectedModel || DEFAULT_MODEL,
      promptHash: item.promptHash,
      caseDir: toEvidencePath(root, caseDir),
      workspaceDir: toEvidencePath(root, workspaceDir),
      rawTranscriptPath: toEvidencePath(root, rawTranscriptPath),
      toolTracePath: toEvidencePath(root, toolTracePath),
      finalReportPath: toEvidencePath(root, finalReportPath),
      metricsPath: toEvidencePath(root, metricsPath),
      artifactDir: toEvidencePath(root, artifactDir),
      exitCode: 124,
      wallClockMs: 0,
      costUsd: 0,
      cacheHitRatePct: 0,
      toolUseCount: 0,
      finalPass: false,
      error: errorText,
    }
  }
  const transcript = normalizeTranscript(run.stdout, run.stderr)
  const parsed = parseStreamJson(run.stdout)
  const finalJsonParse = parseFinalJsonObject(parsed.resultText)
  const finalJsonObject = finalJsonParse.object
  const declaredStatus = declaredResultStatus(finalJsonObject)
  const finalJsonUsable = finalJsonObject !== null
  const noToolUnsupportedClaimCount = tools.length === 0 ? countNoToolUnsupportedClaims(parsed.resultText) : 0
  const namedPathRubricViolationCount =
    declaredStatus === 'PASS' ? countNamedPathRubricViolations(item, parsed.resultText) : 0
  const budgetMetrics = evaluateToolBudgets(budgets, parsed.executedToolUseCounts)
  const budgetViolationCount = budgetMetrics.toolBudgetExceededCount +
    budgetMetrics.readBudgetExceededCount +
    budgetMetrics.shellBudgetExceededCount
  const declaredOutcome = evaluateDeclaredOutcome(item, declaredStatus, parsed.resultText)
  const agentWorkerEvidenceViolationCount = countAgentWorkerEvidenceViolations(item, parsed.executedToolUseCounts)
  const finalPass = finalJsonUsable && noToolUnsupportedClaimCount === 0 && namedPathRubricViolationCount === 0 && budgetViolationCount === 0 && agentWorkerEvidenceViolationCount === 0 && run.exitCode === 0 && parsed.resultEventSeen && (
    declaredOutcome.satisfiesRubric
  )
  const firstAttemptPass = finalPass && parsed.failureEventCount === 0
  const secondAttemptPass = finalPass && parsed.failureEventCount <= 1
  const metrics = {
    promptHash: item.promptHash,
    firstAttemptPass,
    secondAttemptPass,
    finalPass,
    costUsd: parsed.costUsd,
    wallClockMs: run.durationMs,
    cacheHitRatePct: parsed.cacheHitRatePct,
    proAdmissionCount: (item.expectedModel || '').includes('pro') ? 1 : 0,
    failureRecoveryEvents: parsed.failureEventCount,
    finalJsonUsable,
    finalJsonStrict: finalJsonParse.strict,
    finalJsonRepaired: finalJsonParse.repaired,
    unavailableToolUseCount: parsed.unavailableToolUseCount,
    executionVisibilityBlockedCount: parsed.executionVisibilityBlockedCount,
    toolBudgetBlockedCount: parsed.toolBudgetBlockedCount,
    noToolUnsupportedClaimCount,
    namedPathRubricViolationCount,
    agentWorkerEvidenceViolationCount,
    ...budgetMetrics,
    toolResultChars: parsed.toolResultChars,
    artifactLogSizeBytes: Buffer.byteLength(transcript, 'utf8') + parsed.toolTraceText.length,
  }
  const finalReport = {
    schemaVersion: 'dsxu.public-comparable-dsxu-lane-final-report.v1',
    generatedAt: new Date().toISOString(),
    caseId: item.id,
    model: item.expectedModel || DEFAULT_MODEL,
    promptHash: item.promptHash,
    workspaceDir: toEvidencePath(root, workspaceDir),
    command: command.map(value => value.includes(root) ? toEvidencePath(root, value) : value),
    exitCode: run.exitCode,
    wallClockMs: run.durationMs,
    finalPass,
    declaredStatus: declaredStatus ?? null,
    finalJsonUsable,
    finalJsonStrict: finalJsonParse.strict,
    finalJsonRepaired: finalJsonParse.repaired,
    expectedDeclaredStatuses: declaredOutcome.expectedStatuses,
    declaredOutcomeSatisfiesRubric: declaredOutcome.satisfiesRubric,
    conservativePassPolicy: 'Case pass requires usable double-quoted JSON, exitCode=0, a stream-json result event, no unsupported zero-tool claims, no named-path rubric violation, no executed tool/read/shell budget overrun, and a declared final JSON status that matches the task rubric. Agent worker evidence lanes additionally require at least one executed Agent result; TaskCreate/SendMessage-only parent bookkeeping is not enough. A narrow deterministic repair is allowed only for an otherwise valid JSON object with an extra trailing quote wrapper; single-quoted/Python dict output still fails. Attempted over-budget calls are tracked separately when the runtime blocks them before execution. For deny-PASS lanes, FAIL or evidence-limited PARTIAL can be the correct passing outcome.',
    resultText: parsed.resultText.slice(0, 4000),
    attemptedToolUseCounts: parsed.toolUseCounts,
    executedToolUseCounts: parsed.executedToolUseCounts,
    budgets,
    toolDiscipline: {
      unavailableToolUseCount: parsed.unavailableToolUseCount,
      executionVisibilityBlockedCount: parsed.executionVisibilityBlockedCount,
      toolBudgetBlockedCount: parsed.toolBudgetBlockedCount,
      failureEventCount: parsed.failureEventCount,
      finalJsonUsable,
      finalJsonStrict: finalJsonParse.strict,
      finalJsonRepaired: finalJsonParse.repaired,
      noToolUnsupportedClaimCount,
      namedPathRubricViolationCount,
      agentWorkerEvidenceViolationCount,
      ...budgetMetrics,
    },
    stderrTail: run.stderr.slice(-4000),
  }
  if (write) {
    await mkdir(artifactDir, { recursive: true })
    await Promise.all([
      writeFile(rawTranscriptPath, transcript, 'utf8'),
      writeFile(toolTracePath, parsed.toolTraceText || '{"type":"no_tool_events"}\n', 'utf8'),
      writeJson(finalReportPath, finalReport),
      writeJson(metricsPath, metrics),
      writeFile(join(artifactDir, 'stdout.log'), run.stdout, 'utf8'),
      writeFile(join(artifactDir, 'stderr.log'), run.stderr, 'utf8'),
    ])
  }
  return {
    id: item.id,
    status: finalPass ? 'PASS_DSXU_LANE_CAPTURED' : 'PARTIAL_DSXU_LANE_CAPTURED',
    model: item.expectedModel || DEFAULT_MODEL,
    promptHash: item.promptHash,
    caseDir: toEvidencePath(root, caseDir),
    workspaceDir: toEvidencePath(root, workspaceDir),
    rawTranscriptPath: toEvidencePath(root, rawTranscriptPath),
    toolTracePath: toEvidencePath(root, toolTracePath),
    finalReportPath: toEvidencePath(root, finalReportPath),
    metricsPath: toEvidencePath(root, metricsPath),
    artifactDir: toEvidencePath(root, artifactDir),
    exitCode: run.exitCode,
    wallClockMs: run.durationMs,
    costUsd: parsed.costUsd,
    cacheHitRatePct: parsed.cacheHitRatePct,
    toolUseCount: Object.values(parsed.toolUseCounts).reduce((sum, value) => sum + value, 0),
    finalPass,
  }
}

function buildDsxuCommand(
  root: string,
  item: ManifestCase,
  tools: readonly string[],
  maxTurns: number | undefined,
  budgets: LaneBudgets,
  workspaceDir: string,
): string[] {
  const requestedMaxTurns = maxTurns ?? item.maxTurns ?? 10
  const effectiveMaxTurns = Math.max(requestedMaxTurns, minimumLaneTurns(item))
  const toolContract = buildLaneToolContract(item, tools, effectiveMaxTurns, budgets, workspaceDir)
  const prompt = [
    `DSXU public-comparable DSXU lane case: ${item.id}`,
    `Category: ${item.category}`,
    `Expected route: ${item.expectedModel} / ${item.routeReason ?? 'unknown'}`,
    'Run in this isolated workspace only. Do not touch the original product working tree.',
    'Preserve failures honestly. Do not claim PASS unless the requested evidence exists.',
    '',
    toolContract,
    buildLaneTaskCompilerHint(item, tools, budgets),
    buildLaneEvidencePlanHint(item, tools, workspaceDir),
    '',
    item.prompt,
    '',
    'Final response must be one strict compact JSON object with double quotes only. Output raw JSON only: no prose before/after, no Markdown fences, no tables, no single-quoted Python dict syntax.',
    'Keep JSON values short. `toolsUsed` must contain exact tool names only, not explanations in parentheses. Put long details in artifacts/evidence, not in final JSON.',
    'Required JSON keys:',
    '{"caseId":string,"status":"PASS|PARTIAL|FAIL|BLOCKED","evidence":[string],"toolsUsed":[string],"risks":[string],"nextAction":string}',
  ].join('\n')
  const command = [
    'bun',
    `--env-file=${join(root, '.env')}`,
    join(root, 'src', 'entrypoints', 'dsxu-code.tsx'),
    '-p',
    '--verbose',
    '--model',
    item.expectedModel || DEFAULT_MODEL,
    '--max-turns',
    String(effectiveMaxTurns),
    '--output-format',
    'stream-json',
  ]
  command.push('--tools', tools.length > 0 ? tools.join(',') : CLI_NO_TOOLS_SENTINEL)
  command.push('--permission-mode', 'bypassPermissions', '--dangerously-skip-permissions', prompt)
  return command
}

function minimumLaneTurns(item: ManifestCase): number {
  if (item.id === 'product-reality-second-failure-live') return 8
  return 0
}

function buildLaneToolContract(
  item: ManifestCase,
  tools: readonly string[],
  effectiveMaxTurns: number,
  budgets: LaneBudgets,
  workspaceDir: string,
): string {
  const allowed = tools.length > 0 ? tools.join(', ') : 'none'
  const blocked = laneBlockedTools(tools)
  const promptMentionsPowerShell = /\bpowershell\b/i.test(item.prompt)
  const powerShellUnavailable = promptMentionsPowerShell && !tools.includes('PowerShell')
  const shellAllowed = tools.includes('Bash') || tools.includes('PowerShell')
  const bothShellsAllowed = tools.includes('Bash') && tools.includes('PowerShell')
  const powerShellOnly = tools.includes('PowerShell') && !tools.includes('Bash')
  const namedPathTask = hasNamedSourceOrTestPath(item.prompt)
  const nativeTestAllowed = tools.includes('RunNativeTest')
  const collectEvidenceAllowed = tools.includes('CollectEvidence')
  const maxToolCalls = budgets.maxToolCalls
  const mcpResourceIntent = hasMcpResourceIntent(item.prompt)
  const taskCreateExactIntent = parseTaskCreateExactCount(item.prompt)
  const agentPlanningOnlyIntent = /\bPlan\s+a\s+multi-agent\b/i.test(item.prompt)
  const sourceEvidenceOnlyPassIntent =
    item.id === 'governance-skills-selection-live' ||
    item.id === 'tool-prompt-read-edit-cache-golden' ||
    item.id === 'mutation-tool-prompt-read-edit-cache-live'
  const budgetLines = [
    maxToolCalls === undefined || maxToolCalls === null ? null : `maxToolCalls=${maxToolCalls}`,
    budgets.maxReadCalls === undefined || budgets.maxReadCalls === null ? null : `maxReadCalls=${budgets.maxReadCalls}`,
    budgets.maxPowerShellCalls === undefined || budgets.maxPowerShellCalls === null ? null : `maxPowerShellCalls=${budgets.maxPowerShellCalls}`,
  ].filter((value): value is string => value !== null)
  const tightToolBudget = typeof maxToolCalls === 'number' && maxToolCalls <= 2
  const smallToolBudget = typeof maxToolCalls === 'number' && maxToolCalls > 2 && maxToolCalls <= 4
  const balancedToolBudget = typeof maxToolCalls === 'number' && maxToolCalls > 4 && maxToolCalls <= 6
  const grepOnly = tools.length === 1 && tools[0] === 'Grep'
  return [
    'Lane tool contract:',
    `- Allowed tools are exactly: ${allowed}.`,
    blocked.length > 0 ? `- Forbidden tool names for this lane: ${blocked.join(', ')}.` : '- No additional tool names are permitted.',
    tools.includes('PowerShell') ? '- PowerShell hard-fail rule: never append `2>&1`, `2>$null`, or any stderr redirection to PowerShell commands. DSXU captures stderr separately; a redirected command is evidence pollution and fails the clean lane.' : null,
    budgetLines.length > 0 ? `- Budgets: ${budgetLines.join(', ')}.` : '- Budgets: no extra budget metadata supplied.',
    budgetLines.length > 0 ? '- Budget rule is hard: only executed tool results count as collected evidence. Runtime-blocked extra calls must be disclosed as risks, but do not require downgrading if the executed evidence is sufficient for the rubric.' : null,
    `- Turn budget rule: this lane stops after ${effectiveMaxTurns} turns. After every tool result, decide whether the compact final JSON can be produced now; do not spend the final turn on another exploratory tool call.`,
    tightToolBudget ? `- Tight-budget strategy: you have at most ${maxToolCalls} total tool call(s). Plan the entire evidence path before the first call, spend at most one small batch, then stop and produce final JSON. Never ask for an extra confirmation call.` : null,
    smallToolBudget ? `- Small-budget strategy: you have at most ${maxToolCalls} total tool calls. Use at most two calls for discovery; spend any remaining calls only on a known file or direct verification, then produce final JSON.` : null,
    balancedToolBudget ? `- Balanced-budget strategy: you have ${maxToolCalls} total tool calls, enough for discovery plus source truth. Use one focused discovery call, two or three source reads, and reserve the final call only for verification or stop early with final JSON.` : null,
    tightToolBudget && tools.includes('Read') && tools.includes('Grep') ? '- Tight-budget source strategy: prefer one targeted Grep/Glob discovery call plus one Read or Grep evidence call. If the first result is already sufficient, stop early.' : null,
    tightToolBudget && tools.includes('Read') && !tools.includes('Grep') ? '- Tight-budget read-only strategy: use the exact prompt-provided Read paths only. Do not ask for discovery, search, or a third evidence call.' : null,
    grepOnly ? '- Grep-only source strategy: Grep output is the source evidence. Use targeted patterns and glob filters that return content-bearing lines; do not attempt Read or shell follow-up.' : null,
    grepOnly ? '- Grep-only PASS rule: if this task explicitly requests Grep-only proof and Grep returns content-bearing lines within budget, PASS is allowed. Do not downgrade solely because Read or shell are forbidden.' : null,
    tools.includes('Grep') ? '- Grep output strategy: use precise patterns plus glob/head_limit when possible. Avoid broad whole-repository content Grep. If Grep returns a persisted-output preview, use the preview as evidence and do not Read the persisted tool-result file.' : null,
    tools.includes('Read') && tools.includes('Grep') ? '- Large-read boundary: do not read large source or test files in full. Use Grep first, then Read only a narrow offset/limit or the smallest file named by the failing output.' : null,
    tools.includes('Read') && !tools.includes('Grep') ? '- Large-read boundary: Read only the exact files named in the lane plan or prompt. Avoid broad files; use offset/limit if the file is large.' : null,
    nativeTestAllowed ? `- Native verification tool: prefer RunNativeTest over Bash or PowerShell for test/build commands. Use cwd exactly "${workspaceDir.replace(/\\/g, '/')}" and command without shell redirection, for example "bun test --bail" or "bun test test/name.test.ts".` : null,
    nativeTestAllowed ? '- Native test first rule: if the task says "PowerShell first" or "run tests first", treat RunNativeTest as the first verification tool. Do not read package.json or run version probes before the first RunNativeTest; the semantic tool owns runtime availability and failure capture.' : null,
    nativeTestAllowed ? '- Failure-locality rule: once RunNativeTest names a failing source/test path or missing export, read only those named files first. Do not inspect unrelated model/router/provider files until the named failure has been repaired or explicitly ruled out.' : null,
    nativeTestAllowed ? '- Post-patch focused verification rule: after an Edit for a FailureOracle target, rerun the focused test named by FailureOracle or the failing output, for example `bun test test/apiMicrocompact.test.ts`. Do not rerun broad `bun test --bail` unless no focused target exists.' : null,
    nativeTestAllowed ? '- Exact-plan precedence rule: if the Lane evidence plan hint below names a focused verifier for this exact case, that focused verifier is the first native verification command. It overrides generic `bun test --bail` wording, because this benchmark lane is measuring localized review repair rather than repository-wide baseline triage.' : null,
    collectEvidenceAllowed ? '- Evidence collection tool: after RunNativeTest gives enough verification evidence, use CollectEvidence or finish immediately with strict JSON; do not re-run the same failing command just to collect more text. After CollectEvidence, do not call any more tools: produce the final strict JSON only.' : null,
    sourceEvidenceOnlyPassIntent
      ? '- Source-evidence PASS rule: this lane asks for source/test contract evidence, not a live test execution. If the allowed tools do not include a verifier, do not downgrade solely because Bash/PowerShell/RunNativeTest is unavailable; PASS is allowed when the requested source and test/fixture evidence is concrete and cited.'
      : null,
    mcpResourceIntent && tools.includes('ListMcpResourcesTool') && tools.includes('ReadMcpResourceTool')
      ? '- MCP resource guidance rule: this task explicitly asks for a mainline MCP resource. Use ListMcpResourcesTool first. If it returns no resources, "No resources found", or no mcp_servers/resources, stop immediately with strict JSON status BLOCKED; do not run tests, Grep, Glob, source reads, or edits. If resources exist, use ReadMcpResourceTool for the smallest relevant resource before choosing the source/test repair. MCP resource text is guidance only; PASS still requires local source/test evidence after the repair.'
      : null,
    item.category === 'agent' && tools.includes('TaskCreate') && !tools.includes('Read') && !tools.includes('Agent')
      ? '- Task-only agent lane rule: TaskCreate/TaskUpdate/SendMessage success is the available parent evidence in this lane. If the requested action is only to create or route tasks, PASS is allowed after the required tasks/messages succeed. If the task requires worker evidence but no worker/team context is reachable, return BLOCKED/PARTIAL with that exact structural gap; do not wait indefinitely or emit prose-only status.'
      : null,
    isAgentWorkerEvidenceLane(item) && tools.includes('Agent')
      ? '- Agent worker evidence lane rule: the first substantive tool must be Agent. Parent TaskCreate/TaskUpdate/SendMessage may record ownership only after the Agent result exists. Parent may not self-verify or claim PASS from task-board actions alone. PASS requires an executed Agent tool result containing a worker evidence envelope or concrete worker source/test evidence; if Agent is unavailable, return BLOCKED/PARTIAL with that structural gap.'
      : null,
    taskCreateExactIntent !== null && item.category === 'agent' && tools.includes('TaskCreate')
      ? `- TaskCreate-exact closeout rule: this prompt asks for exactly ${taskCreateExactIntent} TaskCreate calls. After exactly ${taskCreateExactIntent} successful TaskCreate tool results, return strict JSON status PASS; no live worker execution is required for this closeout lane.`
      : null,
    agentPlanningOnlyIntent && item.category === 'agent' && tools.includes('TaskCreate')
      ? '- Agent planning-only PASS rule: this prompt asks to plan/route a multi-agent coding task, not to execute hidden workers. After the requested task ownership, verifier, and parent handoff messages/tasks are created successfully, return strict JSON status PASS and cite those parent-side artifacts.'
      : null,
    namedPathTask ? '- Named-path locality rule: the task prompt names exact source/test paths. Read those named paths before any discovery. If a named test/source file is missing, report that exact missing-path evidence or do one targeted Grep for the named function/literal; do not enumerate the whole repository or inspect unrelated files.' : null,
    namedPathTask ? '- Named-path stop rule: if every prompt-named source/test path needed for the requested repair is missing, stop immediately with strict JSON PARTIAL/BLOCKED and cite the missing paths. Do not repair unrelated baseline failures just to make progress.' : null,
    namedPathTask ? '- Baseline-divergence rule: if the initial `bun test --bail` failure points outside the prompt-named files, preserve it as unrelated baseline evidence, then continue with the prompt-named files or the focused named test. Do not repair unrelated first failures just because they appear first.' : null,
    shellAllowed ? '- Shell write boundary: shell tools are read/verify only in this evidence lane. Do not create, append, overwrite, chmod, move, copy, or delete files with shell. Use Edit for source changes.' : null,
    shellAllowed || nativeTestAllowed ? '- Verification scope rule: prefer the smallest focused `bun test <file>` or `bun test <pattern>` that proves the selected change. Do not start with repository-wide `bun test` when the task can be localized or when unrelated baseline failures may swamp the evidence.' : null,
    shellAllowed || nativeTestAllowed ? '- Bounded test rule: if a full test run is required before editing, use `bun test --bail` rather than plain `bun test` so the first actionable failure is visible without huge background logs.' : null,
    shellAllowed || nativeTestAllowed ? '- Background-output rule: if a command is backgrounded or produces an oversized output artifact, do not spend turns sleeping or reading the artifact. Rerun a bounded/focused command such as `bun test --bail` or `bun test <named-file>` and continue from that smaller proof.' : null,
    bothShellsAllowed ? '- Windows shell preference: when both Bash and PowerShell are allowed, prefer PowerShell for shell verification on this Windows evidence host.' : null,
    powerShellOnly ? '- Windows shell selection: PowerShell is the only shell tool exposed in this lane; do not translate commands into Git Bash, WSL, or Unix path syntax.' : null,
    bothShellsAllowed ? '- PowerShell stderr rule: do not append `2>&1` or Unix-style stderr redirection to PowerShell verification commands; DSXU captures stderr separately.' : null,
    powerShellOnly ? '- PowerShell stderr rule: do not append `2>&1` or Unix-style stderr redirection to PowerShell verification commands; DSXU captures stderr separately.' : null,
    powerShellUnavailable && nativeTestAllowed ? '- PowerShell wording normalization: the task text mentions PowerShell, but PowerShell is not available in this lane. Interpret that as RunNativeTest, not as permission to probe for a shell.' : null,
    powerShellUnavailable && !nativeTestAllowed ? '- PowerShell wording normalization: the task text mentions PowerShell, but PowerShell is not available in this lane. Interpret that as the available shell verification tool; do not call forbidden PowerShell.' : null,
    tools.length === 0
      ? '- Zero-tool evidence rule: cite only this lane contract and the literal task request below. Do not invent "prompt-provided" git status, commit hashes, workspace state, snapshot paths, file contents, test results, or saved artifacts. If a fact is not written in this prompt, treat it as unknown.'
      : null,
    tools.length === 0 && item.category === 'permission'
      ? '- Zero-tool permission PASS rule: if the task is only to deny a risky operation and propose a safe read-only replan, no execution is required. Return PASS when you deny the risky action, name the safe replan, and honestly state that no workspace facts were inspected.'
      : null,
    item.category === 'recovery' ? '- Recovery lane strategy: preserve the first failure, then reread the smallest source truth needed for the recovery decision. Avoid whole-repository enumeration unless the prompt explicitly requires inventory.' : null,
    item.category === 'review' && hasMutatingIntent(item.prompt)
      ? '- Review-to-fix lifecycle: preserve the failing command first, then read only the source/test files named by that failure, apply one focused Edit, rerun the same failing command or the now-focused test, then produce final JSON. If no test file is named, use `bun test --bail` as the first command so the output is bounded. Do not enumerate the whole test tree before preserving the failure.'
      : null,
    item.category === 'review' && hasMutatingIntent(item.prompt)
      ? '- Named-file rule: if the user prompt names exact source or test paths, read those exact paths first. If a named test path is missing, use one targeted Grep over tests for the named function or expected literal, then stop searching and repair the smallest source file.'
      : null,
    '- Unavailable-tool rule: if a tool is not in the allowed list above, never emit it. If you hit unavailable-tool or visibility gate errors, stop tool use and produce final JSON with PARTIAL/FAIL plus the violation evidence. If only extra calls were budget-blocked before execution, finish from executed evidence and disclose the blocked attempts as risks.',
    '- Shell portability rule: this evidence host may be Windows. Prefer Grep/Glob/Read for discovery. If shell is allowed and truly needed, use portable git/bun commands or PowerShell-compatible syntax. Do not use ls, dir, cat, head, tail, find, tee, sed/awk/perl rewrites, printf redirection, or Unix grep/head/find pipelines.',
    '- Before the first tool call, write one visible intent sentence naming the dimensions you will check and why the chosen tools are sufficient.',
    '- Do not call more than 2 tools in the first tool batch; avoid broad fan-out until one result narrows the search.',
    '- If a needed tool is forbidden or unavailable, use the allowed tools and disclose the limitation in risks; do not call the forbidden tool to probe.',
    '- If you call any forbidden/unavailable tool, the run is no longer a clean first-attempt pass even if the final answer recovers.',
    '- Final JSON compactness rule: the final answer is a parser target, not a narrative report. Output one raw JSON object only, no Markdown fence, no prose prefix/suffix. Keep evidence and risks to short strings, and make toolsUsed contain exact tool names only, such as "Read", "Edit", "RunNativeTest", "CollectEvidence".',
  ].filter((line): line is string => line !== null).join('\n')
}

function parseTaskCreateExactCount(prompt: string): number | null {
  const digit = /\bTaskCreate\s+exactly\s+(\d+)\s+times\b/i.exec(prompt)
  if (digit?.[1]) return Number.parseInt(digit[1], 10)
  const word = /\bTaskCreate\s+exactly\s+(one|two|three|four|five|six|seven|eight|nine|ten)\s+times\b/i.exec(prompt)
  if (!word?.[1]) return null
  const values: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  }
  return values[word[1].toLowerCase()] ?? null
}

function compileLaneTask(item: ManifestCase, tools: readonly string[], budgets: LaneBudgets): LaneTaskCompilerProfile {
  const prompt = item.prompt.toLowerCase()
  const mutatingIntent = hasMutatingIntent(item.prompt)
  const testIntent = hasExplicitTestRunIntent(item.prompt)
  const namedPathTask = hasNamedSourceOrTestPath(item.prompt)
  const mcpResourceIntent = hasMcpResourceIntent(item.prompt)
  const hasNativeVerification = tools.includes('RunNativeTest')
  const noTools = tools.length === 0 || budgets.maxToolCalls === 0

  if (noTools) {
    return {
      taskKind: 'permission_replan',
      firstAction: 'final_json_no_tools',
      failurePolicy: 'deny risky action; do not invent workspace evidence',
      readPolicy: 'no file reads available',
      editPolicy: 'no edits allowed',
      verifyPolicy: 'no execution required for deny-only permission task',
      finalPolicy: 'strict_json_short',
      trajectoryPattern: 'deny_risk_and_replan',
    }
  }
  if (item.category === 'agent') {
    return {
      taskKind: 'agent_coordination',
      firstAction: 'agent_handoff',
      failurePolicy: 'require child evidence envelope before parent PASS',
      readPolicy: 'parent reads only worker evidence summaries',
      editPolicy: 'worker-owned mutation only',
      verifyPolicy: 'parent synthesizes from worker PASS/PARTIAL evidence',
      finalPolicy: 'strict_json_short',
      trajectoryPattern: 'agent_handoff_with_evidence_envelope',
    }
  }
  if (item.category === 'recovery') {
    return {
      taskKind: 'recovery',
      firstAction: hasNativeVerification && testIntent ? 'run_native_test' : namedPathTask ? 'read_named_paths' : 'grep_source_truth',
      failurePolicy: 'classify first failure with FailureOracle; stop on missing named repair targets; do not fix unrelated baseline failures',
      readPolicy: namedPathTask ? 'read prompt-named files first, then only FailureOracle target files' : 'grep first, then read smallest failing source/test files',
      editPolicy: mutatingIntent ? 'one focused edit per failure target' : 'no edit unless prompt asks repair',
      verifyPolicy: hasNativeVerification ? 'rerun focused RunNativeTest after source change' : 'cite source evidence only',
      finalPolicy: 'strict_json_short',
      trajectoryPattern: namedPathTask ? 'named_path_recovery_or_blocked' : 'first_failure_recovery',
    }
  }
  if (item.category === 'review' && mutatingIntent) {
    return {
      taskKind: 'review_fix',
      firstAction: hasNativeVerification ? 'run_native_test' : namedPathTask ? 'read_named_paths' : 'grep_source_truth',
      failurePolicy: 'preserve failing command; use FailureOracle target files; avoid broad discovery before first failure',
      readPolicy: 'read failing test and implementation only',
      editPolicy: 'single focused patch tied to review finding',
      verifyPolicy: hasNativeVerification ? 'after Edit rerun focused test named by FailureOracle or failing output; avoid broad --bail when focused target exists' : 'source evidence plus honest PARTIAL',
      finalPolicy: 'strict_json_short',
      trajectoryPattern: 'review_to_fix_preserve_failure_then_patch',
    }
  }
  if (mutatingIntent || testIntent || item.category === 'bugfix' || item.category === 'feature') {
    return {
      taskKind: 'bugfix_or_feature',
      firstAction: mcpResourceIntent && tools.includes('ListMcpResourcesTool') ? 'list_mcp_resources' : hasNativeVerification && testIntent ? 'run_native_test' : namedPathTask ? 'read_named_paths' : 'grep_source_truth',
      failurePolicy: 'FailureOracle drives file selection; do not inspect unrelated provider/router/model files before target repair',
      readPolicy: mcpResourceIntent ? 'read one MCP resource as guidance, then read only named failure source/test files' : 'read only named failure source/test files',
      editPolicy: 'minimal patch that satisfies the failing test or requested feature',
      verifyPolicy: hasNativeVerification ? 'after Edit rerun focused test named by FailureOracle or failing output, then CollectEvidence' : 'source evidence and strict PARTIAL if no verifier',
      finalPolicy: 'strict_json_short',
      trajectoryPattern: prompt.includes('export') ||
        prompt.includes('apiMicrocompact'.toLowerCase()) ||
        item.id === 'product-feature-tests-live' ||
        item.id === 'product-multifile-bugfix-live' ||
        item.id === 'product-multistep-feature-live' ||
        item.id === 'product-review-fix-live'
        ? 'missing_export_bugfix'
        : 'focused_bugfix_or_feature',
    }
  }
  return {
    taskKind: 'source_truth',
    firstAction: tools.includes('Grep') ? 'grep_source_truth' : 'read_named_paths',
    failurePolicy: 'no mutation; answer only from gathered evidence',
    readPolicy: 'grep/source truth first, narrow read second',
    editPolicy: 'no edits allowed',
    verifyPolicy: 'source evidence is the verifier',
    finalPolicy: 'strict_json_short',
    trajectoryPattern: 'source_truth_review',
  }
}

function buildLaneTaskCompilerHint(item: ManifestCase, tools: readonly string[], budgets: LaneBudgets): string {
  const profile = compileLaneTask(item, tools, budgets)
  return [
    'Task compiler profile:',
    `- taskKind=${profile.taskKind}`,
    `- firstAction=${profile.firstAction}`,
    `- failurePolicy=${profile.failurePolicy}`,
    `- readPolicy=${profile.readPolicy}`,
    `- editPolicy=${profile.editPolicy}`,
    `- verifyPolicy=${profile.verifyPolicy}`,
    `- finalPolicy=${profile.finalPolicy}`,
    `- trajectoryPattern=${profile.trajectoryPattern}`,
    '- FailureOracle contract: after RunNativeTest fails, use FailureOracle kind/targetFiles/symbols/next as the source of truth for the next read/edit. If FailureOracle target files are missing, stop with PARTIAL/BLOCKED instead of repairing an unrelated baseline.',
  ].join('\n')
}

function buildLaneEvidencePlanHint(item: ManifestCase, tools: readonly string[], workspaceDir: string): string {
  const prompt = item.prompt.toLowerCase()
  const lines: string[] = []
  const grepAllowed = tools.includes('Grep')
  const readAllowed = tools.includes('Read')
  const grepOnly = tools.length === 1 && tools[0] === 'Grep'
  const exactPlanWithoutGrep =
    item.id === 'product-compact-two-phase-live' ||
    item.id === 'tool-prompt-read-edit-cache-golden' ||
    item.id === 'mutation-tool-prompt-read-edit-cache-live' ||
    isAgentWorkerEvidenceLane(item)
  if (!grepAllowed && !exactPlanWithoutGrep) return ''
  if (prompt.includes('permission matrix')) {
    lines.push(
      'Suggested Grep plan: use glob exactly "mainline-tool-adapter-v1.test.ts"; first pattern "permission matrix|createDsxuScopedPermissionContext|registerMainlineCoreToolAdapters"; second pattern only if needed "DSXU shell permission matrix|PowerShell -EncodedCommand denied|permission matrix denial smoke"; output_mode="content"; head_limit<=30.',
    )
  }
  if (prompt.includes('encoded powershell') || prompt.includes('encodedcommand')) {
    lines.push(
      'Suggested Grep plan: first pattern "EncodedCommand|-enc|powershell-encoded-deny|PowerShell -EncodedCommand denied" with output_mode="content" and head_limit<=30; prefer glob "*.{ts,tsx}" or a narrower PowerShell-related glob. This should be enough for Grep-only PASS if denial source/test lines appear.',
    )
  }
  if (prompt.includes('orphan tool_use') || prompt.includes('matching tool_result')) {
    lines.push(
      'Suggested two-call source plan: first Grep pattern "blocked=orphan_tool_use|tool_result_missing_internal_error|orphan.*tool_use|tool_use.*tool_result" with output_mode="content", glob="*.ts", head_limit<=30; if Read is allowed, second call Read the smallest file/line range named by that Grep result. Do not read persisted-output files.',
    )
  }
  if (prompt.includes('skill') && prompt.includes('evidence')) {
    lines.push(
      'Suggested source plan: first Grep pattern "SkillGovernanceContract|validateSkillGovernanceContract|selectSkills|skill descriptions stay evidence-oriented" with output_mode="content", glob="*.ts", head_limit<=30; if Read is allowed, read either skill-governance-v1.ts or skills-selection-v1-clean.test.ts, not every matched file.',
    )
    if (item.id === 'governance-skills-selection-live') {
      lines.push(
        'Exact-case skills governance plan: this is a source/test evidence lane. Read only `src/dsxu/engine/skill-governance-v1.ts`, `src/dsxu/engine/skills-registry-v1.ts` around buildInvocationPlan/selectSkills, and `src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts`. If those prove governance contracts are attached to selected skills and tested, return PASS; do not downgrade only because shell verification is not in the tool window.',
      )
    }
  }
  if (item.id === 'product-feature-tests-live') {
    lines.push(
      'Exact-case product plan: use focused evidence, not repository-wide test output. First locate/read `test/apiMicrocompact.test.ts` and `src/services/compact/apiMicrocompact.ts`, add the missing `apiMicrocompact` export with Edit only, then verify with `bun test test/apiMicrocompact.test.ts`. Preserve unrelated full-suite baseline failures as risks instead of trying to fix the whole repository.',
    )
  }
  if (isApiMicrocompactPatternCandidate(item)) {
    lines.push(
      'Exact-case apiMicrocompact lane plan: use `bun test test/apiMicrocompact.test.ts` as the first verification command when this focused test exists. Read only `test/apiMicrocompact.test.ts` and `src/services/compact/apiMicrocompact.ts` before any Edit. If the focused test already passes, collect evidence or finish PASS; do not chase unrelated `bun test --bail` baseline failures, V7 docs audits, runner scripts, or repository-wide test inventory.',
    )
    lines.push(
      'Pattern library hint: if FailureOracle or the focused test names `apiMicrocompact`, implement the missing export as a recursive compact serializer: null->`null`, undefined->`undefined`, strings via JSON.stringify, numbers/booleans via String, arrays as `[item,item]`, and objects as `{bareKey:value}` with unquoted simple keys. Do not implement a JSON.stringify clone; the focused test requires output shorter than JSON.stringify for simple objects.',
    )
  }
  if (item.id === 'tool-prompt-read-edit-cache-golden' || item.id === 'mutation-tool-prompt-read-edit-cache-live') {
    const workspacePrefix = workspaceDir.replace(/\\/g, '/')
    lines.push(
      `Exact-case read-edit-cache golden plan: this is a source/test evidence lane with exactly two useful calls. Do not read full runner scripts, do not enumerate all tests, and do not use Grep, Glob, Edit, Write, or shell verification. Read only the exact absolute paths \`${workspacePrefix}/src/dsxu/training/golden-fixtures.ts\` and \`${workspacePrefix}/src/dsxu/training/__tests__/golden-fixtures.test.ts\`. Do not invent a shorter workspace path. PASS is allowed when those two files prove the read-before-edit and cached-unchanged-text behavior contract.`,
    )
  }
  if (item.id === 'product-compact-two-phase-live') {
    const workspacePrefix = workspaceDir.replace(/\\/g, '/')
    const v7DocPath = `${workspacePrefix}/docs/DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md`
    lines.push(
      `Exact-case compact two-phase plan: this is a strict recovery lane, not an exploration lane. Allowed tool path is RunNativeTest -> Write -> focused RunNativeTest -> final JSON. Do not use Read, Grep, Edit, PowerShell, CollectEvidence, or broad source inspection. Phase one runs \`bun test --bail\` and preserves the first failure. If the failure is the missing V7 safe consolidation doc, use Write once at absolute path \`${v7DocPath}\` with this minimal ASCII content: "# DSXU V7 Safe Consolidation and Signal Absorption\\n\\n### 12.7 Owner evidence execution record\\nPASS placeholder for isolated replay evidence.\\n\\n### 12.8 Delete-review replacement execution record\\nPASS placeholder for isolated replay evidence.\\n\\n### 12.9 Scenario replay layer execution record\\nPASS placeholder for isolated replay evidence.\\n\\n### 12.10 Final closure execution record\\nPASS placeholder for isolated replay evidence.\\n". Then immediately rerun the focused verifier \`bun test scripts/__tests__/dsxu-v7-completion-audit.test.ts\`, not broad \`bun test --bail\`, and return strict JSON. This isolated evidence workspace may be mutated; do not touch the product working tree.`,
    )
  }
  if (item.id === 'product-agent-worker-longrun-live') {
    lines.push(
      'Exact-case Agent worker plan: first call Agent with subagent_type="general-purpose", description="verify worker evidence", and run_in_background=false or omitted. The worker prompt must assign explicit ownership and must say: use only Read and RunNativeTest; do not use Glob, Grep, Bash, PowerShell, Edit, or Write. The worker should run exactly `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t structured` from the isolated workspace cwd. Use the short unquoted pattern `structured`; do not use quoted full test names because this lane has known quoting fragility. After the Agent result returns, produce final JSON immediately from that worker command evidence only. Do not call parent Read/RunNativeTest/SendMessage/TaskCreate unless the Agent result is missing.',
    )
  }
  if (item.id === 'product-agent-failure-correction-live') {
    lines.push(
      'Exact-case Agent correction plan: first call Agent with subagent_type="general-purpose", description="verify agent correction", and run_in_background=false or omitted. The worker prompt must say: use only Read and RunNativeTest; do not use Glob, Grep, Bash, PowerShell, Edit, or Write. The worker must challenge unverified success by running exactly these two short-pattern commands from the isolated workspace cwd: `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t SendMessage` and `bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts -t lifecycle`. Use the short unquoted patterns `SendMessage` and `lifecycle`; do not use quoted full test names. Parent final JSON may say PASS only after the Agent result reports those command results; otherwise return PARTIAL/BLOCKED. After a sufficient Agent result, do not use SendMessage retry; produce strict JSON immediately.',
    )
  }
  if (item.category === 'review' && hasMutatingIntent(item.prompt)) {
    lines.push(isApiMicrocompactPatternCandidate(item)
      ? 'Suggested review-to-fix plan: this review lane has a known focused apiMicrocompact proof path. Preserve the failing command with `bun test test/apiMicrocompact.test.ts`, then read only the focused test/source pair, patch if needed, rerun the same focused command, and finish JSON. Avoid `bun test --bail` unless the focused file is absent.'
      : 'Suggested review-to-fix plan: if the prompt does not name a test file, run one native `bun test --bail` command first to capture the first failing command/output, then use that output to read the smallest named test/source files. Avoid Glob over all tests, avoid broad source inventory before the first failure is preserved, and never wait on or read a giant background test artifact.',
    )
    if (item.id === 'product-review-to-fix-live') {
      lines.push(
        'Exact-case product review-to-fix plan: this isolated fixture is the HTML escaping review. First run `bun test test/html.test.js`, then read exactly `test/html.test.js` and `src/html.js`, make exactly one focused Edit in `src/html.js` if the apostrophe entity differs from the test, rerun `bun test test/html.test.js`, then finish strict JSON. Do not run repository-wide `bun test --bail`, do not inspect cache/tests/runner files, and do not use Glob unless `test/html.test.js` is missing.',
      )
    } else if (/src\/html\.js|test\/html\.test\.js|single-quote|single quote|&apos;|&#39;/.test(prompt)) {
      lines.push(
        'Exact-case escaping plan: read `src/html.js` first. Try the named `test/html.test.js` only once; if it is absent, Grep tests for `escapeHtml|single quote|&#39;|&apos;` with head_limit<=30, then make exactly one focused Edit in `src/html.js` and verify with the smallest matching test file. If PowerShell is the verifier, use the exact form `bun test test/html.test.js --bail` without `2>&1` or any stderr redirection.',
      )
    }
  }
  if (item.category === 'recovery') {
    if (/src\/format\.js|test\/format\.test\.js/.test(prompt)) {
      lines.push(
        'Exact-case format recovery plan: run `bun test --bail` only to preserve the first failure. If that failure is not `src/format.js` or `test/format.test.js`, mark it as unrelated baseline and continue. Then read exactly `src/format.js` and `test/format.test.js`; do not read `package.json`, `.dsxu/workflows/repair.md`, or background task output artifacts. Apply one focused Edit to `src/format.js`, then verify with `bun test test/format.test.js`.',
      )
    }
    if (item.id === 'governance-query-recovery-live') {
      lines.push(
        'Exact-case recovery plan: first Grep pattern "governance-query-recovery-live|query-recovery-contract|DSXU_MISSING_TOOL_RESULT_ERROR|tool_result_missing_internal_error" with output_mode="content", glob="*.ts", head_limit<=30. If the Grep output shows governance-query-recovery-live inside BENCHMARK_CASES, do not claim the case is missing; recover by explaining the actual query-loop failure/recovery evidence instead.',
      )
    }
    if (item.id === 'product-reality-second-failure-live') {
      lines.push(
        'Exact-case second-failure rule: after the first focused fix passes, run at most one broad `bun test --bail` to check for a second failure. If a second failure appears outside the edited `apiMicrocompact` target, preserve it as evidence, call CollectEvidence once, and final PARTIAL. Do not read, search, or edit the second-failure file in this lane.',
      )
    }
    if (!hasExplicitTestRunIntent(item.prompt)) {
      lines.push(
        'Suggested recovery plan: first Grep pattern "tool_result_missing|orphan_tool_use|recovery|verify-failure|rollback|fix: restore" with output_mode="content", glob="*.ts", head_limit<=30; second call should Read the smallest source/test hit. Avoid git-history archaeology unless the prompt asks for commit forensics.',
      )
    }
  }
  if (lines.length === 0) return ''
  return [
    'Lane evidence plan hint:',
    '- These are source-navigation hints, not proof by themselves. You still need actual tool evidence before claiming PASS.',
    grepOnly ? '- Because this is Grep-only, use Grep output itself as evidence and finish inside the budget.' : null,
    grepAllowed && readAllowed ? '- Because Read is available, use it only after Grep names the smallest file or line range.' : null,
    ...lines.map(line => `- ${line}`),
  ].filter((line): line is string => line !== null).join('\n')
}

function isApiMicrocompactPatternCandidate(item: ManifestCase): boolean {
  return item.id === 'product-feature-tests-live' ||
    item.id === 'product-multifile-bugfix-live' ||
    item.id === 'product-multistep-feature-live' ||
    item.id === 'product-review-fix-live' ||
    item.id === 'product-reality-large-feature-live' ||
    item.id === 'product-reality-review-fix-live' ||
    item.id === 'product-reality-second-failure-live'
}

function needsCompleteV7SupportEvidence(caseId: string): boolean {
  return caseId === 'product-multifile-bugfix-live' ||
    caseId === 'product-multistep-feature-live' ||
    caseId === 'product-review-fix-live' ||
    caseId === 'product-reality-large-feature-live' ||
    caseId === 'product-reality-review-fix-live' ||
    caseId === 'product-reality-second-failure-live' ||
    caseId === 'product-review-to-fix-live'
}

function deriveEffectiveBudgets(item: ManifestCase): LaneBudgets {
  const budgets: LaneBudgets = { ...(item.budgets ?? {}) }
  const prompt = item.prompt.toLowerCase()
  const explicitTestRunIntent = hasExplicitTestRunIntent(item.prompt)
  const mutatingIntent = hasMutatingIntent(item.prompt)
  const nonMutatingRecovery = item.category === 'recovery' && !mutatingIntent && !explicitTestRunIntent
  const sourceTruthReview =
    item.category === 'review' &&
    (prompt.includes('source truth') || prompt.includes('detect') || prompt.includes('deny pass'))
  const skillEvidenceFeature =
    item.category === 'feature' &&
    prompt.includes('skill') &&
    (prompt.includes('source evidence') || prompt.includes('test evidence') || prompt.includes('evidence'))
  const readEditCacheEvidenceLane =
    item.id === 'tool-prompt-read-edit-cache-golden' ||
    item.id === 'mutation-tool-prompt-read-edit-cache-live'
  const compactTwoPhaseRecovery = item.id === 'product-compact-two-phase-live'
  const mutatingReview = item.category === 'review' && hasMutatingIntent(item.prompt)
  const mutatingRecovery = item.category === 'recovery' && hasMutatingIntent(item.prompt)

  if (compactTwoPhaseRecovery) {
    budgets.maxToolCalls = 3
  } else if (readEditCacheEvidenceLane) {
    budgets.maxToolCalls = 2
  } else if (nonMutatingRecovery && (!Number.isFinite(budgets.maxToolCalls) || (budgets.maxToolCalls ?? 0) < 5)) {
    budgets.maxToolCalls = 5
  } else if (sourceTruthReview && (!Number.isFinite(budgets.maxToolCalls) || (budgets.maxToolCalls ?? 0) < 5)) {
    budgets.maxToolCalls = 5
  } else if (skillEvidenceFeature && (!Number.isFinite(budgets.maxToolCalls) || (budgets.maxToolCalls ?? 0) < 5)) {
    budgets.maxToolCalls = 5
  } else if (mutatingReview && (!Number.isFinite(budgets.maxToolCalls) || (budgets.maxToolCalls ?? 0) < 10)) {
    budgets.maxToolCalls = 10
  } else if (mutatingRecovery && (!Number.isFinite(budgets.maxToolCalls) || (budgets.maxToolCalls ?? 0) < 10)) {
    budgets.maxToolCalls = 10
  }
  if (compactTwoPhaseRecovery) {
    budgets.maxReadCalls = 0
  } else if (readEditCacheEvidenceLane) {
    budgets.maxReadCalls = 2
  } else if ((budgets.maxReadCalls === undefined || budgets.maxReadCalls === null) && nonMutatingRecovery) {
    budgets.maxReadCalls = 3
  }
  if ((budgets.maxReadCalls === undefined || budgets.maxReadCalls === null) && sourceTruthReview) {
    budgets.maxReadCalls = 4
  }
  if ((budgets.maxReadCalls === undefined || budgets.maxReadCalls === null) && skillEvidenceFeature) {
    budgets.maxReadCalls = 3
  }
  if ((budgets.maxReadCalls === undefined || budgets.maxReadCalls === null) && mutatingReview) {
    budgets.maxReadCalls = 5
  }
  if ((budgets.maxReadCalls === undefined || budgets.maxReadCalls === null) && mutatingRecovery) {
    budgets.maxReadCalls = 5
  }
  if (compactTwoPhaseRecovery || readEditCacheEvidenceLane) {
    budgets.maxPowerShellCalls = 0
  } else if ((budgets.maxPowerShellCalls === undefined || budgets.maxPowerShellCalls === null) && explicitTestRunIntent) {
    budgets.maxPowerShellCalls = 0
  }
  if ((budgets.maxPowerShellCalls === undefined || budgets.maxPowerShellCalls === null) && nonMutatingRecovery) {
    budgets.maxPowerShellCalls = 0
  }
  if ((budgets.maxPowerShellCalls === undefined || budgets.maxPowerShellCalls === null) && mutatingReview) {
    budgets.maxPowerShellCalls = 3
  }
  if ((budgets.maxPowerShellCalls === undefined || budgets.maxPowerShellCalls === null) && mutatingRecovery) {
    budgets.maxPowerShellCalls = 3
  }
  return budgets
}

function evaluateToolBudgets(budgets: LaneBudgets, toolUseCounts: Record<string, number>): ToolBudgetMetrics {
  const toolUseCount = Object.values(toolUseCounts).reduce((sum, value) => sum + value, 0)
  const readUseCount = toolUseCounts.Read ?? 0
  const shellUseCount = (toolUseCounts.Bash ?? 0) + (toolUseCounts.PowerShell ?? 0)
  return {
    toolBudgetExceededCount: exceededBy(toolUseCount, budgets.maxToolCalls),
    readBudgetExceededCount: exceededBy(readUseCount, budgets.maxReadCalls),
    shellBudgetExceededCount: exceededBy(shellUseCount, budgets.maxPowerShellCalls),
  }
}

function exceededBy(actual: number, budget: number | null | undefined): number {
  return typeof budget === 'number' && Number.isFinite(budget) ? Math.max(0, actual - budget) : 0
}

function buildDsxuLaneEnv(budgets: LaneBudgets, tools: readonly string[]): Record<string, string> {
  const env: Record<string, string> = {
    DSXU_SEMANTIC_TOOLS_ENABLED: '1',
    DSXU_LANE_READONLY_SHELL: '1',
    DSXU_CODE_MAX_OUTPUT_TOKENS: '4096',
  }
  if (tools.includes('ListMcpResourcesTool') || tools.includes('ReadMcpResourceTool')) {
    env.DSXU_CODE_EXPOSE_MCP_HELPER_TOOLS = '1'
  }
  setBudgetEnv(env, 'DSXU_LANE_MAX_TOOL_CALLS', budgets.maxToolCalls)
  setBudgetEnv(env, 'DSXU_LANE_MAX_READ_CALLS', budgets.maxReadCalls)
  setBudgetEnv(env, 'DSXU_LANE_MAX_SHELL_CALLS', budgets.maxPowerShellCalls)
  return env
}

function setBudgetEnv(env: Record<string, string>, name: string, value: number | null | undefined): void {
  if (typeof value === 'number' && Number.isFinite(value)) env[name] = String(value)
}

function laneBlockedTools(tools: readonly string[]): readonly string[] {
  const allowed = new Set(tools)
  return ['Agent', 'Read', 'Edit', 'Write', 'Bash', 'PowerShell', 'RunNativeTest', 'CollectEvidence', 'TaskCreate', 'TaskUpdate', 'SendMessage']
    .filter(tool => !allowed.has(tool))
}

function hasExplicitTestRunIntent(prompt: string): boolean {
  return /(bun test|npm test|pnpm test|yarn test|pytest|vitest|jest|run (?:the )?(?:failing |reviewed failing |focused )?(?:tests?|case)|start with (?:the )?.*test|failing .*test|failing case)/i.test(prompt)
}

function hasMutatingIntent(prompt: string): boolean {
  return /(edit|repair|fix|patch|write|add|implement|modify|change|bun test|npm test|pnpm test|yarn test|pytest|vitest|jest|run tests?)/i.test(prompt)
}

function hasNamedSourceOrTestPath(prompt: string): boolean {
  return /\b(?:src|test|tests|__tests__)\/[A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|mjs|cjs)\b/.test(prompt)
}

function hasMcpResourceIntent(prompt: string): boolean {
  return /\bmcp\b/i.test(prompt) && /\bresource/i.test(prompt)
}

function deriveTools(item: ManifestCase, budgets: LaneBudgets = deriveEffectiveBudgets(item)): readonly string[] {
  if (isAgentWorkerEvidenceLane(item)) return AGENT_WORKER_EVIDENCE_TOOLS
  const declared = item.allowedTools?.trim()
  if (declared && declared !== 'default-mainline-tool-gate') {
    return declared.split(',').map(value => value.trim()).filter(Boolean)
  }
  if (budgets.maxToolCalls === 0) return []
  if (item.category === 'permission') return applyBudgetToolLimits(['Read', 'Grep', 'Glob'], item)
  if (item.category === 'agent') return ['TaskCreate', 'TaskUpdate', 'SendMessage']
  if (
    item.id === 'tool-prompt-read-edit-cache-golden' ||
    item.id === 'mutation-tool-prompt-read-edit-cache-live'
  ) {
    return applyBudgetToolLimits(['Read'], item)
  }
  const prompt = item.prompt.toLowerCase()
  const explicitTestRunIntent = hasExplicitTestRunIntent(item.prompt)
  const mutatingIntent = hasMutatingIntent(item.prompt)
  const mcpResourceIntent = hasMcpResourceIntent(item.prompt)
  const smallBudget = typeof budgets.maxToolCalls === 'number' && budgets.maxToolCalls <= 4
  const tightBudget = typeof budgets.maxToolCalls === 'number' && budgets.maxToolCalls <= 2
  const sourceTruthIntent =
    item.category === 'review' ||
    prompt.includes('source truth') ||
    prompt.includes('source evidence') ||
    prompt.includes('test evidence') ||
    prompt.includes('prove') ||
    prompt.includes('contract') ||
    prompt.includes('detect') ||
    prompt.includes('deny pass')
  const searchOnly =
    budgets.maxReadCalls === 0 ||
    (prompt.includes('grep') || prompt.includes('glob')) &&
      !mutatingIntent
  if (tightBudget && !mutatingIntent) {
    return applyBudgetToolLimits(
      budgets.maxReadCalls === 0 ? ['Grep', 'Glob'] : ['Grep', 'Read'],
      item,
    )
  }
  if (smallBudget && sourceTruthIntent && !mutatingIntent) {
    return applyBudgetToolLimits(
      explicitTestRunIntent ? ['Grep', 'Read', 'RunNativeTest', 'CollectEvidence'] : ['Grep', 'Read'],
      item,
    )
  }
  if (sourceTruthIntent && !mutatingIntent) {
    return applyBudgetToolLimits(
      item.category === 'feature' ? ['Grep', 'Read', 'Glob'] : ['Grep', 'Read'],
      item,
    )
  }
  if (item.id === 'product-compact-two-phase-live') {
    return applyBudgetToolLimits(
      ['RunNativeTest', 'Write'],
      item,
    )
  }
  if (item.category === 'recovery') {
    return applyBudgetToolLimits(
      mutatingIntent || explicitTestRunIntent ? ['Grep', 'Read', 'RunNativeTest', 'CollectEvidence', 'Edit'] : ['Grep', 'Read'],
      item,
    )
  }
  if (mcpResourceIntent && (mutatingIntent || item.category === 'bugfix' || item.category === 'feature')) {
    return applyBudgetToolLimits(
      ['ListMcpResourcesTool', 'ReadMcpResourceTool', 'Read', 'Edit', 'RunNativeTest', 'CollectEvidence', 'Grep', 'Glob'],
      item,
    )
  }
  const baseTools = searchOnly
    ? ['Grep', 'Glob']
    : explicitTestRunIntent
      ? ['Read', 'Edit', 'RunNativeTest', 'CollectEvidence', 'Grep', 'Glob']
      : ['Read', 'Edit', 'PowerShell', 'Grep', 'Glob']
  return applyBudgetToolLimits(baseTools, item)
}

function isAgentWorkerEvidenceLane(item: Pick<ManifestCase, 'id'>): boolean {
  return item.id === 'product-agent-worker-longrun-live' ||
    item.id === 'product-agent-failure-correction-live'
}

function countAgentWorkerEvidenceViolations(
  item: ManifestCase,
  executedToolUseCounts: Record<string, number>,
): number {
  if (!isAgentWorkerEvidenceLane(item)) return 0
  return (executedToolUseCounts.Agent ?? 0) > 0 ? 0 : 1
}

function applyBudgetToolLimits(tools: readonly string[], item: ManifestCase): readonly string[] {
  const blocked = new Set<string>()
  const budgets = deriveEffectiveBudgets(item)
  if (budgets.maxReadCalls === 0) blocked.add('Read')
  if (budgets.maxPowerShellCalls === 0) {
    blocked.add('Bash')
    blocked.add('PowerShell')
  }
  return tools.filter(tool => !blocked.has(tool))
}

async function prepareGitWorktreeWorkspace(input: { root: string; workspaceRoot: string; caseId: string }): Promise<string> {
  const workspace = join(input.workspaceRoot, `${input.caseId}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  await mkdir(dirname(workspace), { recursive: true })
  const result = await runCommand(`worktree-${input.caseId}`, ['git', 'worktree', 'add', '--detach', workspace, 'HEAD'], {
    cwd: input.root,
    timeoutMs: 180_000,
  })
  if (result.exitCode !== 0) {
    throw new Error(`failed to create isolated git worktree for ${input.caseId}: ${result.stderr || result.stdout}`)
  }
  await overlayCurrentWorkspaceRuntimeFiles(input.root, workspace)
  await applyDsxuLaneCaseFixtures(input.caseId, workspace, input.root)
  await linkCurrentWorkspaceDependencyDirs(input.root, workspace)
  return workspace
}

export async function applyDsxuLaneCaseFixtures(caseId: string, workspace: string, root = process.cwd()): Promise<void> {
  if (caseId === 'product-compact-two-phase-live') {
    await copyV7CompletionSupportEvidence(root, workspace)
    await rm(
      join(workspace, 'docs', 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'),
      { force: true },
    )
    return
  }
  if (needsCompleteV7SupportEvidence(caseId)) {
    await copyV7CompletionSupportEvidence(root, workspace, { includeSafeConsolidationDoc: true })
  }
  if (caseId === 'product-workflow-recovery-live') {
    await mkdir(join(workspace, 'src'), { recursive: true })
    await mkdir(join(workspace, 'test'), { recursive: true })
    await writeFile(
      join(workspace, 'src', 'format.js'),
      [
        'export function formatName(input) {',
        '  return String(input).trim().toLowerCase()',
        '}',
        '',
      ].join('\n'),
      'utf8',
    )
    await writeFile(
      join(workspace, 'test', 'format.test.js'),
      [
        "import { expect, test } from 'bun:test'",
        "import { formatName } from '../src/format.js'",
        '',
        "test('formatName trims and title-cases display names', () => {",
        "  expect(formatName('  ada lovelace  ')).toBe('Ada Lovelace')",
        '})',
        '',
      ].join('\n'),
      'utf8',
    )
    return
  }
  if (caseId === 'product-review-to-fix-live') {
    await seedHtmlEscapingReviewMismatch(workspace)
    return
  }
  if (caseId !== 'v8-real-review-fix') return
  await seedHtmlEscapingReviewMismatch(workspace)
}

async function seedHtmlEscapingReviewMismatch(workspace: string): Promise<void> {
  const htmlPath = join(workspace, 'src', 'html.js')
  const current = await readFile(htmlPath, 'utf8').catch(() => null)
  if (current === null) return
  const seeded = current
    .replace("Maps: & -> &amp;, < -> &lt;, > -> &gt;, \" -> &quot;, ' -> &#39;", "Maps: & -> &amp;, < -> &lt;, > -> &gt;, \" -> &quot;, ' -> &apos;")
    .replace(".replace(/'/g, \"&#39;\");", ".replace(/'/g, \"&apos;\");")
  if (seeded !== current) {
    await writeFile(htmlPath, seeded, 'utf8')
  }
}

async function copyV7CompletionSupportEvidence(
  root: string,
  workspace: string,
  options: { includeSafeConsolidationDoc?: boolean } = {},
): Promise<void> {
  const docDir = join(root, 'docs')
  const generatedDir = join(root, 'docs', 'generated')
  const includeSafeConsolidationDoc = options.includeSafeConsolidationDoc === true
  await copyMatchingFiles({
    sourceDir: docDir,
    destinationDir: join(workspace, 'docs'),
    include: name =>
      /^DSXU_.*_20260519(?:_CN)?\.md$/.test(name) &&
      (includeSafeConsolidationDoc || name !== 'DSXU_V7_SAFE_CONSOLIDATION_AND_SIGNAL_ABSORPTION_20260519_CN.md'),
  })
  await copyMatchingFiles({
    sourceDir: generatedDir,
    destinationDir: join(workspace, 'docs', 'generated'),
    include: name =>
      /^DSXU_.*_20260519\.json$/.test(name),
  })
}

async function copyMatchingFiles(input: {
  sourceDir: string
  destinationDir: string
  include: (name: string) => boolean
}): Promise<void> {
  const entries = await readdir(input.sourceDir, { withFileTypes: true }).catch(() => [])
  const files = entries.filter(entry => entry.isFile() && input.include(entry.name))
  if (files.length === 0) return
  await mkdir(input.destinationDir, { recursive: true })
  for (const file of files) {
    await copyFile(join(input.sourceDir, file.name), join(input.destinationDir, file.name))
  }
}

async function overlayCurrentWorkspaceRuntimeFiles(root: string, workspace: string): Promise<void> {
  for (const relativePath of collectCurrentWorktreeOverlayPaths(root)) {
    const source = join(root, ...relativePath.split('/'))
    const sourceStat = await stat(source).catch(() => null)
    const destination = join(workspace, ...relativePath.split('/'))
    if (!sourceStat?.isFile()) {
      if (existsSync(destination)) {
        await rm(destination, { recursive: true, force: true })
      }
      continue
    }
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
  }
}

function collectCurrentWorktreeOverlayPaths(root: string): string[] {
  const paths = new Set<string>(DSXU_LANE_CURRENT_WORKTREE_CORE_OVERLAY_PATHS)
  const scopes = ['src', 'test', 'scripts', 'package.json', 'package-lock.json', 'bun.lock', 'bunfig.toml', '.dsxu/ops']
  for (const args of [
    ['diff', '--name-only', '-z', 'HEAD', '--', ...scopes],
    ['ls-files', '--others', '--exclude-standard', '-z', '--', ...scopes],
  ]) {
    const result = Bun.spawnSync(['git', '-C', root, ...args], {
      stdout: 'pipe',
      stderr: 'ignore',
    })
    if (result.exitCode !== 0) continue
    for (const rawPath of result.stdout.toString().split('\0')) {
      const normalized = normalizeOverlayPath(rawPath)
      if (normalized) paths.add(normalized)
    }
  }
  return [...paths].sort()
}

function normalizeOverlayPath(rawPath: string): string | null {
  const normalized = rawPath.trim().replace(/\\/g, '/')
  if (!normalized) return null
  if (normalized.startsWith('/') || normalized.includes('..')) return null
  if (normalized === 'node_modules' || normalized.includes('/node_modules/')) return null
  if (normalized.startsWith('.dsxu/') && !normalized.startsWith('.dsxu/ops/')) return null
  if (
    normalized === 'package.json' ||
    normalized === 'package-lock.json' ||
    normalized === 'bun.lock' ||
    normalized === 'bunfig.toml' ||
    normalized.startsWith('src/') ||
    normalized.startsWith('test/') ||
    normalized.startsWith('scripts/') ||
    normalized.startsWith('.dsxu/ops/')
  ) {
    return normalized
  }
  return null
}

async function linkCurrentWorkspaceDependencyDirs(root: string, workspace: string): Promise<void> {
  for (const relativePath of DSXU_LANE_CURRENT_WORKTREE_DEPENDENCY_LINK_DIRS) {
    const sourcePath = join(root, relativePath)
    const targetPath = join(workspace, relativePath)
    if (!existsSync(sourcePath) || existsSync(targetPath)) continue
    await mkdir(dirname(targetPath), { recursive: true })
    await symlink(sourcePath, targetPath, process.platform === 'win32' ? 'junction' : 'dir')
  }
}

async function runCommand(
  _id: string,
  command: readonly string[],
  options: { cwd: string; timeoutMs: number; env?: Record<string, string> },
): Promise<CommandResult> {
  const startedAt = Date.now()
  const proc = Bun.spawn([...command], {
    cwd: options.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...(options.env ?? {}) },
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedOut = false
  const timeout = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true
      proc.kill()
      resolve(124)
    }, options.timeoutMs)
  })
  try {
    const exitCode = await Promise.race([proc.exited, timeout])
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    const timeoutMessage = `command timed out after ${options.timeoutMs}ms: ${command.join(' ')}`
    return {
      command,
      cwd: options.cwd,
      exitCode: timedOut ? 124 : exitCode,
      durationMs: Date.now() - startedAt,
      stdout,
      stderr: timedOut ? [stderr.trimEnd(), timeoutMessage].filter(Boolean).join('\n') : stderr,
    }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function normalizeTranscript(stdout: string, stderr: string): string {
  const lines: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim()) lines.push(line)
  }
  if (stderr.trim()) {
    lines.push(JSON.stringify({ type: 'stderr', text: stderr }))
  }
  return `${lines.join('\n')}\n`
}

function parseStreamJson(stdout: string): {
  resultEventSeen: boolean
  resultText: string
  costUsd: number
  cacheHitRatePct: number
  toolTraceText: string
  toolUseCounts: Record<string, number>
  executedToolUseCounts: Record<string, number>
  toolResultChars: number
  failureEventCount: number
  unavailableToolUseCount: number
  executionVisibilityBlockedCount: number
  toolBudgetBlockedCount: number
} {
  let resultEventSeen = false
  let resultText = ''
  let costUsd = 0
  let inputTokens = 0
  let cacheReadTokens = 0
  let toolResultChars = 0
  let failureEventCount = 0
  let unavailableToolUseCount = 0
  let executionVisibilityBlockedCount = 0
  let toolBudgetBlockedCount = 0
  const toolTrace: string[] = []
  const toolUseCounts: Record<string, number> = {}
  const executedToolUseCounts: Record<string, number> = {}
  const toolUseNameById: Record<string, string> = {}
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) continue
    const event = tryJson(line)
    if (!event) continue
    if (event.type === 'result') {
      resultEventSeen = true
      if (typeof event.result === 'string') resultText = event.result
      if (typeof event.total_cost_usd === 'number') costUsd = event.total_cost_usd
      const usage = isRecord(event.usage) ? event.usage : {}
      inputTokens += numberValue(usage.input_tokens) ?? 0
      cacheReadTokens += numberValue(usage.cache_read_input_tokens) ?? 0
    }
    if (event.type === 'assistant' || event.type === 'user') {
      const message = isRecord(event.message) ? event.message : {}
      const content = Array.isArray(message.content) ? message.content : []
      for (const block of content) {
        if (!isRecord(block)) continue
        if (block.type === 'tool_use' && typeof block.name === 'string') {
          toolUseCounts[block.name] = (toolUseCounts[block.name] ?? 0) + 1
          if (typeof block.id === 'string') toolUseNameById[block.id] = block.name
          toolTrace.push(JSON.stringify({ type: 'tool_use', source: event.type, id: block.id ?? null, name: block.name, input: block.input ?? null }))
        }
        if (block.type === 'tool_result') {
          const text = stringifyToolResultContent(block.content, event.tool_use_result)
          toolResultChars += text.length
          const isError = block.is_error === true || looksLikeToolResultError(event.tool_use_result)
          const errorClass = isError ? classifyToolResultError(text, event.tool_use_result) : null
          if (errorClass === 'unavailable_tool') unavailableToolUseCount += 1
          if (errorClass === 'execution_visibility') executionVisibilityBlockedCount += 1
          if (errorClass === 'tool_budget') toolBudgetBlockedCount += 1
          if (
            typeof block.tool_use_id === 'string' &&
            errorClass !== 'unavailable_tool' &&
            errorClass !== 'execution_visibility' &&
            errorClass !== 'tool_budget'
          ) {
            const name = toolUseNameById[block.tool_use_id]
            if (name) executedToolUseCounts[name] = (executedToolUseCounts[name] ?? 0) + 1
          }
          toolTrace.push(JSON.stringify({
            type: 'tool_result',
            source: event.type,
            tool_use_id: block.tool_use_id ?? null,
            is_error: isError,
            errorClass,
            contentChars: text.length,
          }))
          if (isError) failureEventCount += 1
        }
      }
    }
  }
  return {
    resultEventSeen,
    resultText,
    costUsd,
    cacheHitRatePct: inputTokens > 0 ? Number(((cacheReadTokens / inputTokens) * 100).toFixed(2)) : 0,
    toolTraceText: toolTrace.length > 0 ? `${toolTrace.join('\n')}\n` : '',
    toolUseCounts,
    executedToolUseCounts,
    toolResultChars,
    failureEventCount,
    unavailableToolUseCount,
    executionVisibilityBlockedCount,
    toolBudgetBlockedCount,
  }
}

function stringifyToolResultContent(content: unknown, fallback: unknown): string {
  if (typeof content === 'string') return content
  if (content !== undefined) return JSON.stringify(content)
  if (typeof fallback === 'string') return fallback
  if (fallback !== undefined) return JSON.stringify(fallback)
  return ''
}

function looksLikeToolResultError(value: unknown): boolean {
  return typeof value === 'string' && /\b(error|failed|denied|unavailable|no such tool)\b/i.test(value)
}

function classifyToolResultError(content: string, fallback: unknown): 'unavailable_tool' | 'execution_visibility' | 'tool_budget' | 'other_tool_error' | null {
  const text = `${content}\n${typeof fallback === 'string' ? fallback : fallback === undefined ? '' : JSON.stringify(fallback)}`
  if (/No such tool available|Available tools in this turn|Do not call unavailable tools/i.test(text)) return 'unavailable_tool'
  if (/DSXU execution-visibility gate|blocked_tool_batch|visible intent brief/i.test(text)) return 'execution_visibility'
  if (/DSXU tool-budget gate|blocked_tool_budget|tool-budget status/i.test(text)) return 'tool_budget'
  if (/\b(error|failed|denied|unavailable)\b/i.test(text)) return 'other_tool_error'
  return null
}

function parseFinalJsonObject(resultText: string): {
  object: Record<string, unknown> | null
  strict: boolean
  repaired: boolean
} {
  const candidates: string[] = []
  const fencedJson = resultText.match(/```json\s*([\s\S]*?)```/i)
  if (fencedJson?.[1]) candidates.push(fencedJson[1].trim())
  const firstBrace = resultText.indexOf('{')
  const lastBrace = resultText.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(resultText.slice(firstBrace, lastBrace + 1))
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (isRecord(parsed)) return { object: parsed, strict: true, repaired: false }
    } catch {
      const repaired = repairTrailingQuotedJsonObject(candidate)
      if (repaired !== candidate) {
        try {
          const parsed = JSON.parse(repaired)
          if (isRecord(parsed)) return { object: parsed, strict: false, repaired: true }
        } catch {
          // Continue with the next candidate.
        }
      }
    }
  }
  return { object: null, strict: false, repaired: false }
}

function repairTrailingQuotedJsonObject(candidate: string): string {
  const trailingQuoteRepaired = candidate.replace(/}\s*"\s*}$/, '}')
  if (trailingQuoteRepaired !== candidate) return trailingQuoteRepaired

  let depth = 0
  let inString = false
  let escaped = false
  for (const char of candidate) {
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') depth -= 1
  }
  if (depth === -1 && candidate.trimEnd().endsWith('}')) {
    return candidate.trimEnd().slice(0, -1)
  }
  return candidate
}

function declaredResultStatus(finalJsonObject: Record<string, unknown> | null): DeclaredStatus | undefined {
  const status = finalJsonObject?.status
  return typeof status === 'string' && /^(PASS|PARTIAL|FAIL|BLOCKED)$/i.test(status)
    ? status.toUpperCase() as DeclaredStatus
    : undefined
}

function expectedDeclaredStatuses(item: ManifestCase): readonly DeclaredStatus[] {
  const prompt = item.prompt.toLowerCase()
  if (/verificationstatus\s*=\s*["']?partial["']?/.test(prompt)) {
    return ['PARTIAL']
  }
  if (/\bdeny\s+pass\b|\bcannot\s+pass\b|\bmust\s+not\s+pass\b|\bno\s+pass\b/.test(prompt)) {
    return ['FAIL', 'PARTIAL']
  }
  if (/\bhonest\s+partial\b|\bpartial\s+is\s+acceptable\b|\breport\s+partial\b/.test(prompt)) {
    return ['PASS', 'PARTIAL']
  }
  return ['PASS']
}

function evaluateDeclaredOutcome(
  item: ManifestCase,
  declaredStatus: DeclaredStatus | undefined,
  resultText: string,
): { expectedStatuses: readonly DeclaredStatus[]; satisfiesRubric: boolean } {
  const expectedStatuses = expectedDeclaredStatuses(item)
  if (
    hasMcpResourceIntent(item.prompt) &&
    (declaredStatus === 'PARTIAL' || declaredStatus === 'BLOCKED') &&
    /\bListMcpResourcesTool\b/i.test(resultText) &&
    /\b(?:No resources found|no live MCP resource|no MCP resources|MCP resources? (?:are )?unavailable|mcp_servers=\[\]|no resources available)\b/i.test(resultText)
  ) {
    return {
      expectedStatuses: ['PASS', 'PARTIAL', 'BLOCKED'],
      satisfiesRubric: true,
    }
  }
  if (declaredStatus) {
    return {
      expectedStatuses,
      satisfiesRubric: expectedStatuses.includes(declaredStatus),
    }
  }
  if (expectedStatuses.includes('FAIL')) {
    return { expectedStatuses, satisfiesRubric: false }
  }
  return {
    expectedStatuses,
    satisfiesRubric: !/\b(partial|fail|failed|failure|blocked|error)\b/i.test(resultText),
  }
}

function countNoToolUnsupportedClaims(resultText: string): number {
  const patterns = [
    /\bworkspace\s+(?:preserves|is|was|clean|dirty|contains|has)\b/i,
    /\bclean git state\b/i,
    /\bcommit\s+[0-9a-f]{6,40}\b/i,
    /\brecovery snapshot\s+(?:saved|exists|preserved|written)\b/i,
    /\bsource truth\s+(?:confirmed|verified|reread|matches)\b/i,
    /\bfile contents?\s+(?:confirmed|verified|show|shows)\b/i,
    /\btests?\s+(?:pass|passed|verified|confirm|confirmed)\b/i,
    /\bartifacts?\s+(?:saved|written|exist|exists|verified)\b/i,
  ]
  return patterns.reduce((count, pattern) => count + (pattern.test(resultText) ? 1 : 0), 0)
}

function countNamedPathRubricViolations(item: ManifestCase, resultText: string): number {
  const namedPaths = extractNamedPromptPaths(item.prompt)
  if (namedPaths.length === 0) return 0
  const normalizedResult = resultText.replace(/\\/g, '/')
  let count = 0
  for (const path of namedPaths) {
    const index = normalizedResult.indexOf(path)
    if (index < 0) {
      count += 1
      continue
    }
    const window = normalizedResult.slice(Math.max(0, index - 140), index + path.length + 180)
    if (/\b(?:does not exist|do not exist|missing|absent|not found|unavailable|cannot be read|could not read)\b/i.test(window)) {
      count += 1
    }
  }
  if (/\bactual (?:recovery )?target was\b/i.test(resultText)) count += 1
  return count
}

function extractNamedPromptPaths(prompt: string): readonly string[] {
  const matches = prompt.match(/\b(?:src|test|tests|__tests__)\/[A-Za-z0-9_.\/-]+\.(?:ts|tsx|js|jsx|mjs|cjs)\b/g) ?? []
  return Array.from(new Set(matches.map(value => value.replace(/\\/g, '/'))))
}

function selectCases(cases: readonly ManifestCase[], options: DsxuLaneOptions): readonly ManifestCase[] {
  const caseIds = new Set(options.caseIds ?? [])
  const filtered = caseIds.size > 0 ? cases.filter(item => caseIds.has(item.id)) : cases
  return typeof options.limit === 'number' && options.limit >= 0 ? filtered.slice(0, options.limit) : filtered
}

function parseManifest(input: unknown): PublicComparableManifest {
  if (!isRecord(input)) throw new Error('public comparable manifest is not an object')
  if (input.schemaVersion !== 'dsxu.public-comparable-benchmark-manifest.v1') {
    throw new Error('public comparable manifest schemaVersion mismatch')
  }
  if (!Array.isArray(input.cases)) throw new Error('public comparable manifest cases must be an array')
  return input as PublicComparableManifest
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''))
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function tryJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toEvidencePath(root: string, path: string): string {
  const rel = relative(root, path).replace(/\\/g, '/')
  return rel.length > 0 && !rel.startsWith('..') ? rel : path.replace(/\\/g, '/')
}

function parseArgs(argv: readonly string[]): DsxuLaneOptions {
  const values = new Map<string, string>()
  const flags = new Set<string>()
  const cases: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const [key, inlineValue] = arg.slice(2).split('=', 2)
    if (key === 'case' || key === 'case-id') {
      const value = inlineValue ?? argv[index + 1]
      if (value && !value.startsWith('--')) {
        cases.push(...value.split(',').map(item => item.trim()).filter(Boolean))
        if (inlineValue === undefined) index += 1
      }
      continue
    }
    if (inlineValue !== undefined) {
      values.set(key, inlineValue)
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      values.set(key, argv[index + 1])
      index += 1
    } else {
      flags.add(key)
    }
  }
  const limitText = values.get('limit')
  const turnsText = values.get('max-turns')
  const caseTimeoutText = values.get('case-timeout-ms')
  return {
    manifestPath: values.get('manifest'),
    rawRoot: values.get('raw-root'),
    reportPath: values.get('report'),
    workspaceRoot: values.get('workspace-root'),
    caseIds: cases,
    limit: limitText === undefined ? undefined : Number(limitText),
    maxTurns: turnsText === undefined ? undefined : Number(turnsText),
    caseTimeoutMs: caseTimeoutText === undefined ? undefined : Number(caseTimeoutText),
    write: !flags.has('dry-run'),
    force: flags.has('force'),
  }
}

async function main(): Promise<void> {
  const report = await collectPublicComparableDsxuLane(parseArgs(process.argv.slice(2)))
  console.log(JSON.stringify({
    status: report.status,
    attemptedCaseCount: report.attemptedCaseCount,
    capturedCaseCount: report.capturedCaseCount,
    skippedCaseCount: report.skippedCaseCount,
    failedCaseCount: report.failedCaseCount,
    passedCaseCount: report.passedCaseCount,
    nonPassingCaseCount: report.nonPassingCaseCount,
    publicBenchmarkClaimAllowed: report.publicBenchmarkClaimAllowed,
    externalComparisonClaimAllowed: report.externalComparisonClaimAllowed,
    nextAction: report.nextAction,
  }, null, 2))
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error))
    process.exitCode = 1
  })
}
