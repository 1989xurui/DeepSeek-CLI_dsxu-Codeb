import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

type CapabilityRecord = {
  id: string
  domain: string
  capability: string
  sheet: 'must' | 'later'
}

type CostLayer = 'direct-cost' | 'indirect-cost' | 'eval-proof' | 'baseline-workflow' | 'deferred-gap'

type CrosswalkRow = CapabilityRecord & {
  historicalStatus: 'PASS' | 'DEFERRED_NOT_PASS'
  costLayer: CostLayer
  contribution: string
  dsxuOwner: string
  ownerEvidence: string[]
  ownerEvidenceExists: boolean
  liveEvidence: string[]
  publicClaimAllowed: boolean
  publicClaim: string
  releaseUse: string
}

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const OUT_JSON = join(GENERATED_DIR, `DSXU_CAPABILITY_COST_CROSSWALK_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_CAPABILITY_COST_CROSSWALK_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_CAPABILITY_COST_CROSSWALK_${DATE}.md`)
const CAPABILITY_WORKBOOK_SOURCE = 'C:\\Users\\h\\Downloads\\DSXU_CLI_V8*_V9.xlsx'

const capabilityRecords: CapabilityRecord[] = [
  { id: 'S00', domain: 'product-scope', capability: 'DSXU CLI = DeepSeek V4 Code/Terminal orchestration enhancer', sheet: 'must' },
  { id: 'S01', domain: 'product-mode', capability: 'Cold Mode', sheet: 'must' },
  { id: 'M01', domain: 'model-adapter', capability: 'DeepSeek V4 Flash/Pro Adapter', sheet: 'must' },
  { id: 'M02', domain: 'model-adapter', capability: 'Thinking Mode / Effort control', sheet: 'must' },
  { id: 'M03', domain: 'model-adapter', capability: 'ReasoningStateManager', sheet: 'must' },
  { id: 'M04', domain: 'model-adapter', capability: 'Tool Calls support', sheet: 'must' },
  { id: 'M05', domain: 'model-adapter', capability: 'JSON Output mode', sheet: 'must' },
  { id: 'M06', domain: 'model-adapter', capability: 'Context Cache hit planning', sheet: 'must' },
  { id: 'C01', domain: 'core-runtime', capability: 'CLI Main Chain', sheet: 'must' },
  { id: 'C03', domain: 'core-runtime', capability: 'Task Timeline Renderer', sheet: 'must' },
  { id: 'C04', domain: 'core-runtime', capability: 'PermissionGate', sheet: 'must' },
  { id: 'C05', domain: 'core-runtime', capability: 'IntentRouter', sheet: 'must' },
  { id: 'C07', domain: 'core-runtime', capability: 'ContextCompiler', sheet: 'must' },
  { id: 'C08', domain: 'core-runtime', capability: 'TokenFirewall', sheet: 'must' },
  { id: 'C09', domain: 'core-runtime', capability: 'CostRouter', sheet: 'must' },
  { id: 'C10', domain: 'core-runtime', capability: 'PlanGraph', sheet: 'must' },
  { id: 'C11', domain: 'core-runtime', capability: 'ToolBus', sheet: 'must' },
  { id: 'C12', domain: 'core-runtime', capability: 'VerificationKernel', sheet: 'must' },
  { id: 'C13', domain: 'core-runtime', capability: 'Snapshot/Rollback', sheet: 'must' },
  { id: 'C14', domain: 'core-runtime', capability: 'FailureTaxonomy', sheet: 'must' },
  { id: 'C15', domain: 'core-runtime', capability: 'TraceLogger', sheet: 'must' },
  { id: 'C16', domain: 'core-runtime', capability: 'CostReporter', sheet: 'must' },
  { id: 'A01', domain: 'code-mode', capability: 'RepoProbe', sheet: 'must' },
  { id: 'A02', domain: 'code-mode', capability: 'RepoIndex', sheet: 'must' },
  { id: 'A03', domain: 'code-mode', capability: 'LSP/AST Locator', sheet: 'must' },
  { id: 'A04', domain: 'code-mode', capability: 'Error Parser', sheet: 'must' },
  { id: 'A05', domain: 'code-mode', capability: 'Bug Locator Ensemble', sheet: 'must' },
  { id: 'A06', domain: 'code-mode', capability: 'CodeContextPack', sheet: 'must' },
  { id: 'A07', domain: 'code-mode', capability: 'Patch Planner', sheet: 'must' },
  { id: 'A08', domain: 'code-mode', capability: 'Unified Diff Generator', sheet: 'must' },
  { id: 'A09', domain: 'code-mode', capability: 'Patch Applier', sheet: 'must' },
  { id: 'A10', domain: 'code-mode', capability: 'Test Runner', sheet: 'must' },
  { id: 'A11', domain: 'code-mode', capability: 'Code RepairLoop', sheet: 'must' },
  { id: 'A15', domain: 'code-mode', capability: 'FinalPatchReport', sheet: 'must' },
  { id: 'A16', domain: 'code-mode', capability: 'Internal Code-10/30 Runner', sheet: 'must' },
  { id: 'B01', domain: 'terminal-mode', capability: 'ShellStateManager', sheet: 'must' },
  { id: 'B02', domain: 'terminal-mode', capability: 'EnvironmentProbe', sheet: 'must' },
  { id: 'B03', domain: 'terminal-mode', capability: 'CommandPlanner', sheet: 'must' },
  { id: 'B04', domain: 'terminal-mode', capability: 'SafeShellExecutor', sheet: 'must' },
  { id: 'B05', domain: 'terminal-mode', capability: 'OutputSummarizer', sheet: 'must' },
  { id: 'B06', domain: 'terminal-mode', capability: 'FileSystemState', sheet: 'must' },
  { id: 'B07', domain: 'terminal-mode', capability: 'CommandVerifier', sheet: 'must' },
  { id: 'B08', domain: 'terminal-mode', capability: 'ScriptSynthesizer', sheet: 'must' },
  { id: 'B09', domain: 'terminal-mode', capability: 'Terminal FailureRepairLoop', sheet: 'must' },
  { id: 'B10', domain: 'terminal-mode', capability: 'TimeoutGuard', sheet: 'must' },
  { id: 'B11', domain: 'terminal-mode', capability: 'ArtifactChecker', sheet: 'must' },
  { id: 'B12', domain: 'terminal-mode', capability: 'TerminalBench Subset Adapter', sheet: 'must' },
  { id: 'B13', domain: 'terminal-mode', capability: 'Internal Terminal-10/30 Runner', sheet: 'must' },
  { id: 'B14', domain: 'terminal-mode', capability: 'TerminalResultPackager', sheet: 'must' },
  { id: 'E01', domain: 'evaluation-reporting', capability: 'Baseline Runner', sheet: 'must' },
  { id: 'E02', domain: 'evaluation-reporting', capability: 'Ablation Runner', sheet: 'must' },
  { id: 'E03', domain: 'evaluation-reporting', capability: 'Cost Eval Reporter', sheet: 'must' },
  { id: 'E04', domain: 'evaluation-reporting', capability: 'Failure Reporter', sheet: 'must' },
  { id: 'E05', domain: 'evaluation-reporting', capability: 'Trace Collector', sheet: 'must' },
  { id: 'E06', domain: 'evaluation-reporting', capability: 'Go/Stop Decision', sheet: 'must' },
  { id: 'R01', domain: 'benchmark-map', capability: 'Terminal-Bench 2.0', sheet: 'must' },
  { id: 'R02', domain: 'benchmark-map', capability: 'Internal Code-30', sheet: 'must' },
  { id: 'S02', domain: 'product-mode', capability: 'BenchMax Mode', sheet: 'later' },
  { id: 'M07', domain: 'model-adapter', capability: 'FIM local completion', sheet: 'later' },
  { id: 'C02', domain: 'core-runtime', capability: 'Interactive Session', sheet: 'later' },
  { id: 'C06', domain: 'core-runtime', capability: 'SkillRouter core edition', sheet: 'later' },
  { id: 'C17', domain: 'core-runtime', capability: 'LocalMemory Lite', sheet: 'later' },
  { id: 'C18', domain: 'core-runtime', capability: 'Anti-Rationalization Guard', sheet: 'later' },
  { id: 'A12', domain: 'code-mode', capability: 'RegressionGuard Lite', sheet: 'later' },
  { id: 'A13', domain: 'code-mode', capability: 'Patch Candidate Search', sheet: 'later' },
  { id: 'A14', domain: 'code-mode', capability: 'Pro Reviewer', sheet: 'later' },
  { id: 'A17', domain: 'code-mode', capability: 'SWE Smoke Runner', sheet: 'later' },
  { id: 'E07', domain: 'evaluation-reporting', capability: 'Mini Report Generator', sheet: 'later' },
  { id: 'R03', domain: 'benchmark-map', capability: 'SWE Pro', sheet: 'later' },
  { id: 'R04', domain: 'benchmark-map', capability: 'SWE Verified', sheet: 'later' },
  { id: 'R05', domain: 'benchmark-map', capability: 'BFCL V4', sheet: 'later' },
  { id: 'R06', domain: 'benchmark-map', capability: 'BrowseComp-Lite', sheet: 'later' },
  { id: 'R07', domain: 'benchmark-map', capability: 'OSWorld-Lite', sheet: 'later' },
  { id: 'R08', domain: 'benchmark-map', capability: 'Toolathlon', sheet: 'later' },
  { id: 'PZ01', domain: 'paused-module', capability: 'OpenClaw Adapter', sheet: 'later' },
  { id: 'PZ02', domain: 'paused-module', capability: 'Hermes Adapter', sheet: 'later' },
  { id: 'PZ03', domain: 'paused-module', capability: 'BrowserExecutor', sheet: 'later' },
  { id: 'PZ04', domain: 'paused-module', capability: 'DesktopExecutor', sheet: 'later' },
  { id: 'PZ05', domain: 'paused-module', capability: 'Application templates', sheet: 'later' },
  { id: 'PZ06', domain: 'paused-module', capability: 'VS Code plugin/API platform', sheet: 'later' },
  { id: 'PZ07', domain: 'paused-module', capability: 'Multi-Agent Swarm/Coordinator', sheet: 'later' },
  { id: 'PZ08', domain: 'paused-module', capability: 'Voice/Buddy/Team/Bridge', sheet: 'later' },
]

const deferredIds = new Set(['R01', 'R02', 'S02', 'R04', 'R05', 'R06', 'PZ01', 'PZ02', 'PZ04', 'PZ05', 'PZ06', 'PZ08'])
const directCostIds = new Set(['S01', 'M01', 'M02', 'M03', 'M06', 'C07', 'C08', 'C09', 'C16', 'C17', 'M07', 'A14'])
const indirectCostIds = new Set(['C02', 'C03', 'C04', 'C05', 'C06', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C18', 'A06', 'A10', 'A11', 'A12', 'B05', 'B07', 'B09', 'B10', 'B14'])
const evalProofIds = new Set(['A16', 'A17', 'B12', 'B13', 'E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'R03', 'R07', 'R08'])

function costLayerFor(id: string): CostLayer {
  if (deferredIds.has(id)) return 'deferred-gap'
  if (directCostIds.has(id)) return 'direct-cost'
  if (indirectCostIds.has(id)) return 'indirect-cost'
  if (evalProofIds.has(id)) return 'eval-proof'
  return 'baseline-workflow'
}

function ownerFor(row: CapabilityRecord): { dsxuOwner: string; ownerEvidence: string[] } {
  if (row.domain === 'model-adapter') {
    return {
      dsxuOwner: 'DeepSeek runtime / model-cost-cache owner',
      ownerEvidence: [
        'src/utils/model/deepseekV4CostRouter.ts',
        'src/utils/model/deepseekV4Control.ts',
        'src/services/api/deepseek-adapter.ts',
        'src/services/api/deepseek-trajectory-store.ts',
      ],
    }
  }
  if (row.domain === 'core-runtime' || row.domain === 'product-mode' || row.domain === 'product-scope') {
    return {
      dsxuOwner: 'Query loop / work-state / runtime owner',
      ownerEvidence: [
        'src/QueryEngine.ts',
        'src/query.ts',
        'src/dsxu/engine/work-state-timeline.ts',
        'src/dsxu/engine/code-mode-surgical-loop.ts',
      ],
    }
  }
  if (row.domain === 'code-mode') {
    return {
      dsxuOwner: 'Code-mode repair / patch / verification owner',
      ownerEvidence: [
        'src/dsxu/engine/code-mode-surgical-loop.ts',
        'src/dsxu/engine/__tests__/query-engine-recovery-mainline-v1.test.ts',
        'src/dsxu/engine/__tests__/product-runtime-owner-map-v1.test.ts',
      ],
    }
  }
  if (row.domain === 'terminal-mode') {
    return {
      dsxuOwner: 'Tool/terminal lifecycle owner',
      ownerEvidence: [
        'src/Tool.ts',
        'src/tools/BashTool/BashTool.tsx',
        'src/tools/PowerShellTool/PowerShellTool.tsx',
        'src/services/tools/toolOrchestration.ts',
      ],
    }
  }
  if (row.domain === 'evaluation-reporting' || row.domain === 'benchmark-map') {
    return {
      dsxuOwner: 'Evidence / benchmark / public challenge owner',
      ownerEvidence: [
        'scripts/dsxu-v24-public-challenge-package.ts',
        'scripts/dsxu-v24-product-benchmark-data-pack.ts',
        'scripts/dsxu-v24-six-stage-final-tests.ts',
      ],
    }
  }
  return {
    dsxuOwner: 'Deferred ecosystem boundary owner',
    ownerEvidence: [
      'docs/DSXU_V26_MASTER_PLAN_20260515.md',
      'src/dsxu/engine/public-surface-clean-gate.ts',
    ],
  }
}

function contributionFor(row: CapabilityRecord, layer: CostLayer): string {
  if (layer === 'deferred-gap') return 'Not counted as PASS; remains a raw-evidence or product-surface gap.'
  if (layer === 'direct-cost') {
    if (row.id === 'M06') return 'Keeps stable prefix/cache planning visible; the current mainline now wires no-Read source capsule and cache attribution into public challenge.'
    if (row.id === 'C07') return 'Compiles source truth into compact capsules so DeepSeek Flash does not repeatedly ingest full files.'
    if (row.id === 'C08') return 'Limits large tool-result feedback and forces raw-read fallback to be bounded and attributable.'
    if (row.id === 'C09') return 'Keeps Flash as default and admits Pro only with explicit route evidence.'
    if (row.id === 'C16') return 'Turns usage/cache/cost into reportable product metrics instead of hidden logs.'
    return 'Directly reduces spend or controls expensive model/tool behavior in the main workflow.'
  }
  if (layer === 'indirect-cost') return 'Reduces wasted turns through visible state, permission gating, verification, repair loops, and bounded context.'
  if (layer === 'eval-proof') return 'Proves cost/quality with raw traces, public challenge runs, ablation, and go/stop reports.'
  return 'Supports the coding/terminal workflow; useful as product capability, but not a standalone cost optimization claim.'
}

function liveEvidenceFor(layer: CostLayer): string[] {
  if (layer === 'deferred-gap') return ['docs/DSXU_V26_MASTER_PLAN_20260515.md#deferred-gap']
  if (layer === 'direct-cost') {
    return [
      'docs/generated/DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json',
      'docs/generated/DSXU_V26_PUBLIC_CHALLENGE_STABLE_EVIDENCE_PACK_20260515.json',
      '.dsxu/trace/v24-public-challenge-package/*.trajectory.jsonl',
    ]
  }
  if (layer === 'eval-proof') {
    return [
      'docs/generated/DSXU_V24_PRODUCT_BENCHMARK_DATA_PACK_20260515.json',
      'docs/generated/DSXU_V24_SIX_STAGE_FINAL_TESTS_20260515.json',
    ]
  }
  return [
    'docs/generated/DSXU_V24_C2_LOOP_REAL_ACCEPTANCE_20260515.json',
    'docs/generated/DSXU_V26_C2_OWNER_IMPLEMENTATION_ACCEPTANCE_20260515.json',
  ]
}

function buildRow(row: CapabilityRecord): CrosswalkRow {
  const layer = costLayerFor(row.id)
  const owner = ownerFor(row)
  const ownerEvidenceExists = owner.ownerEvidence.some(path => existsSync(join(ROOT, path)))
  const pass = layer !== 'deferred-gap'
  return {
    ...row,
    historicalStatus: pass ? 'PASS' : 'DEFERRED_NOT_PASS',
    costLayer: layer,
    contribution: contributionFor(row, layer),
    dsxuOwner: owner.dsxuOwner,
    ownerEvidence: owner.ownerEvidence,
    ownerEvidenceExists,
    liveEvidence: liveEvidenceFor(layer),
    publicClaimAllowed: pass && (layer === 'direct-cost' || layer === 'indirect-cost' || layer === 'eval-proof'),
    publicClaim: pass
      ? `${row.id} can support a DSXU-owned ${layer} claim when cited with owner evidence and latest live/public-challenge metrics.`
      : `${row.id} must stay out of PASS/product-claim copy until raw evidence or product implementation closes the deferred gap.`,
    releaseUse: pass
      ? 'Allowed as DSXU-owned release-candidate capability evidence; public benchmark superiority still requires fixed raw comparison.'
      : 'Blocked from release claims except as an explicitly deferred roadmap/gap item.',
  }
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('; ') : String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function markdownTable(rows: readonly Record<string, unknown>[], columns: readonly string[]): string {
  return [
    `| ${columns.join(' | ')} |`,
    `| ${columns.map(() => '---').join(' | ')} |`,
    ...rows.map(row => `| ${columns.map(column => String(row[column] ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')).join(' | ')} |`),
  ].join('\n')
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  const rows = capabilityRecords.map(buildRow)
  const byLayer = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.costLayer] = (acc[row.costLayer] ?? 0) + 1
    return acc
  }, {})
  const publicChallenge = await readJson(join(GENERATED_DIR, 'DSXU_V24_PUBLIC_CHALLENGE_PACKAGE_20260515.json'))
  const summary = {
    schemaVersion: 'dsxu.capability-cost-crosswalk.v1',
    generatedAt: new Date().toISOString(),
    capabilityWorkbookSource: CAPABILITY_WORKBOOK_SOURCE,
    totalRows: rows.length,
    passRows: rows.filter(row => row.historicalStatus === 'PASS').length,
    deferredRows: rows.filter(row => row.historicalStatus === 'DEFERRED_NOT_PASS').length,
    publicClaimAllowedRows: rows.filter(row => row.publicClaimAllowed).length,
    byLayer,
    publicChallengeScoreFloor: publicChallenge?.scoreFloor ?? null,
    publicChallengeCacheHitRatePct: (publicChallenge?.flashCacheSummary as Record<string, unknown> | undefined)?.cacheHitRatePct ?? null,
    publicChallengeToolResultChars: (publicChallenge?.flashCacheSummary as Record<string, unknown> | undefined)?.toolResultChars ?? null,
    decision: 'Historical capability/cost claims are usable only when tied to DSXU owner evidence plus latest public challenge route/cost/cache/trajectory evidence; deferred rows remain blocked.',
  }
  await writeFile(OUT_JSON, `${JSON.stringify({ summary, rows }, null, 2)}\n`, 'utf8')

  const columns = ['id', 'domain', 'capability', 'historicalStatus', 'costLayer', 'dsxuOwner', 'ownerEvidenceExists', 'publicClaimAllowed', 'contribution']
  await writeFile(OUT_CSV, [
    columns.join(','),
    ...rows.map(row => columns.map(column => csvCell(row[column as keyof CrosswalkRow])).join(',')),
  ].join('\n') + '\n', 'utf8')

  const md = [
    '# DSXU Capability Cost Crosswalk - 20260516',
    '',
    `Source workbook: \`${CAPABILITY_WORKBOOK_SOURCE}\``,
    '',
    '## Summary',
    '',
    markdownTable([summary], ['totalRows', 'passRows', 'deferredRows', 'publicClaimAllowedRows', 'publicChallengeScoreFloor', 'publicChallengeCacheHitRatePct', 'publicChallengeToolResultChars']),
    '',
    '## Layer Counts',
    '',
    markdownTable(Object.entries(byLayer).map(([layer, count]) => ({ layer, count })), ['layer', 'count']),
    '',
    '## Public Claim Rule',
    '',
    summary.decision,
    '',
    '## Crosswalk',
    '',
    markdownTable(rows.map(row => ({
      id: row.id,
      domain: row.domain,
      capability: row.capability,
      status: row.historicalStatus,
      layer: row.costLayer,
      owner: row.dsxuOwner,
      evidenceExists: row.ownerEvidenceExists,
      publicClaim: row.publicClaimAllowed,
      contribution: row.contribution,
    })), ['id', 'domain', 'capability', 'status', 'layer', 'owner', 'evidenceExists', 'publicClaim', 'contribution']),
    '',
  ].join('\n')
  await writeFile(OUT_MD, md, 'utf8')

  process.stdout.write(JSON.stringify({
    status: 'PASS_DSXU_CAPABILITY_COST_CROSSWALK_GENERATED',
    outputJson: OUT_JSON,
    outputCsv: OUT_CSV,
    outputMd: OUT_MD,
    summary,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
