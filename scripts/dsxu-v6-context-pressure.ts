import { mkdir, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../src/constants/prompts'
import { asSystemPrompt } from '../src/utils/systemPromptType'
import {
  PERSISTED_OUTPUT_TAG,
  processPreMappedToolResultBlock,
} from '../src/utils/toolResultStorage'
import { buildDSXUContextPressureDecision } from '../src/dsxu/engine/context-pressure-matrix'
import {
  appendLedgerEvent,
  buildDSXUActiveFrame,
  createProgressLedger,
} from '../src/dsxu/engine/progress-ledger'
import { recordDSXUQueryPromptPrefixCacheEvidence } from '../src/dsxu/engine/prompt-prefix-cache-evidence'

const ROOT = process.cwd()
const DATE = '20260519'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_V6_CONTEXT_PRESSURE_${DATE}.json`)
const OUT_MD = join(ROOT, 'docs', `DSXU_V6_CONTEXT_PRESSURE_${DATE}.md`)

function rel(path: string): string {
  return relative(ROOT, path).replace(/[\\/]+/g, '/')
}

function parseLevels(argv: readonly string[]): number[] {
  const flag = argv.find(arg => arg.startsWith('--levels='))
  const raw = flag?.slice('--levels='.length) ?? '70,85,95,99'
  return raw
    .split(',')
    .map(value => Number(value.trim()))
    .filter(value => Number.isFinite(value))
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const levels = parseLevels(process.argv.slice(2))
  const rows = []
  const cacheEvidence = recordDSXUQueryPromptPrefixCacheEvidence({
    systemPrompt: asSystemPrompt([
      'DSXU stable rules: DeepSeek Flash-first route, tool schema, permission policy, and output contract stay fixed.',
      'DSXU stable tool schema: Grep, Read, Bash, Evidence, VerifyPatch.',
      SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
      'current_task=V6 context pressure focused report.',
      'tool_result_preview=bounded preview only; full output lives in artifact.',
    ]),
    workflowKind: 'coding',
    routeReason: 'v6_context_pressure_report',
    model: 'deepseek-v4-flash',
    querySource: 'v6-context-pressure-script',
    turnCount: 1,
  })
  const largeResult = '上下文压力工具输出-'.repeat(900)
  const persisted = await processPreMappedToolResultBlock({
    type: 'tool_result',
    tool_use_id: 'v6-context-pressure-large-tool-result',
    content: largeResult,
  }, 'Bash', 512)
  const persistedContent = String(persisted.content)
  const toolResultArtifacted = persistedContent.startsWith(PERSISTED_OUTPUT_TAG) &&
    persistedContent.includes('Full output saved to:') &&
    persistedContent.length < largeResult.length

  for (const level of levels) {
    const decision = buildDSXUContextPressureDecision({
      tokenUsage: level,
      effectiveWindow: 100,
      postCompact: level >= 85,
      promptTooLongRecovered: level >= 99,
    })
    let ledger = createProgressLedger(`v6-context-pressure-${level}`, 'session-v6-context-pressure', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'task_contract',
      owner: 'Query Loop / PlanGraph / Tool Gate',
      summary: `V6 context/cache strategy at ${level}%`,
      eventId: `contract-v6-context-${level}`,
      evidence: [`context:${level}`],
      metadata: {
        executionContract: {
          goal: 'Keep source truth, verification, and cache evidence visible under context pressure',
          risk: level >= 95 ? 'high' : 'medium',
          visibleTools: ['Grep', 'Read', 'Bash', 'Evidence'],
          verificationLevel: 'affected_tests',
        },
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'edit_proof',
      owner: 'Tool Gate / VerificationKernel',
      summary: 'Pending verification survives compact/cache pressure',
      eventId: `edit-proof-v6-context-${level}`,
      evidence: ['edit-proof:context-pressure'],
      metadata: {
        openObligations: [
          'rerun focused context/cache strategy tests',
          'attach cache evidence before final claim',
        ],
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'cache',
      owner: 'DeepSeek route/cost/cache owner',
      summary: `cache-safe policy ${decision.bucket}`,
      eventId: `cache-v6-context-${level}`,
      evidence: [
        `stablePrefixHash:${cacheEvidence.stablePrefixHash}`,
        `dynamicTailHash:${cacheEvidence.dynamicTailHash}`,
        `cachePolicy:${decision.cachePolicy}`,
        `sourceTruthReread:${decision.sourceTruthReread}`,
      ],
      metadata: {
        cacheEvidence,
        contextDecision: decision,
        toolResultArtifacted,
        toolResultPreviewChars: persistedContent.length,
        toolResultOriginalChars: largeResult.length,
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'tool',
      owner: 'Tool Gate / toolResultStorage',
      summary: toolResultArtifacted
        ? 'Large tool result persisted as artifact preview'
        : 'Large tool result still inflated dynamic tail',
      eventId: `tool-result-v6-context-${level}`,
      evidence: [
        `artifacted:${String(toolResultArtifacted)}`,
        `previewChars:${persistedContent.length}`,
        `originalChars:${largeResult.length}`,
      ],
      metadata: {
        outputChars: persistedContent.length,
        originalOutputChars: largeResult.length,
        artifacted: toolResultArtifacted,
      },
    })
    const activeFrame = buildDSXUActiveFrame({ ledger })
    const blockers = [
      decision.sourceTruthReread !== 'required-before-edit-or-pass'
        ? 'source truth reread obligation missing'
        : '',
      !activeFrame.openObligations.includes('verification required:affected_tests')
        ? 'active frame lost verification obligation'
        : '',
      !activeFrame.openObligations.includes('attach cache evidence before final claim')
        ? 'active frame lost cache evidence obligation'
        : '',
      activeFrame.guards.length > 0
        ? `active frame guards: ${activeFrame.guards.join('; ')}`
        : '',
      !toolResultArtifacted ? 'large tool result was not artifacted' : '',
      cacheEvidence.status !== 'CACHE_PREFIX_READY' ? `cache prefix status=${cacheEvidence.status}` : '',
    ].filter(Boolean)
    rows.push({
      level,
      bucket: decision.bucket,
      risk: decision.risk,
      recommendedAction: decision.recommendedAction,
      cachePolicy: decision.cachePolicy,
      sourceTruthReread: decision.sourceTruthReread,
      activeFrameOpenObligations: activeFrame.openObligations,
      toolResultArtifacted,
      blockers,
    })
  }

  const missingLevels = [70, 85, 95, 99].filter(level => !levels.includes(level))
  const blockers = [
    missingLevels.length > 0 ? `missing required levels: ${missingLevels.join(',')}` : '',
    ...rows.flatMap(row => row.blockers.map(blocker => `${row.level}% ${blocker}`)),
  ].filter(Boolean)
  const status = blockers.length === 0
    ? 'PASS_V6_CONTEXT_PRESSURE_REPORT'
    : 'NEEDS_V6_CONTEXT_PRESSURE_REPAIR'
  const report = {
    schemaVersion: 'dsxu.v6.context-pressure-report.v1',
    generatedAt: new Date().toISOString(),
    status,
    blockers,
    cacheEvidence: {
      status: cacheEvidence.status,
      stablePrefixHash: cacheEvidence.stablePrefixHash,
      dynamicTailHash: cacheEvidence.dynamicTailHash,
      boundaryFound: cacheEvidence.boundaryFound,
      cacheMissBudgetTokens: cacheEvidence.cacheMissBudgetTokens,
    },
    largeToolResult: {
      artifacted: toolResultArtifacted,
      originalChars: largeResult.length,
      previewChars: persistedContent.length,
    },
    rows,
  }
  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  await writeFile(OUT_MD, [
    '# DSXU V6 Context Pressure Report',
    '',
    `- status: \`${status}\``,
    `- levels: \`${levels.join(',')}\``,
    `- cache evidence: \`${cacheEvidence.status}\``,
    `- large tool result artifacted: \`${String(toolResultArtifacted)}\``,
    '',
    '## Rows',
    '',
    '| level | bucket | risk | action | cache policy | blockers |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.level} | ${row.bucket} | ${row.risk} | ${row.recommendedAction} | ${row.cachePolicy} | ${row.blockers.length ? row.blockers.join('; ') : 'none'} |`),
    '',
    '## Blockers',
    '',
    blockers.length === 0 ? '- none' : blockers.map(blocker => `- ${blocker}`).join('\n'),
    '',
  ].join('\n'), 'utf8')

  console.log(status)
  console.log(JSON.stringify({
    levels,
    blockers,
    cacheStatus: cacheEvidence.status,
    toolResultArtifacted,
    outputs: [rel(OUT_JSON), rel(OUT_MD)],
  }, null, 2))
  if (blockers.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
