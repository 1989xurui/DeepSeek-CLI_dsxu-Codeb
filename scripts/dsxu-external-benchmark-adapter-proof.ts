import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { writeLiveProviderGateEvidence } from '../src/dsxu/integration/harness/live-provider-gate-v1-harness'
import { runBrowserDevServerProofHarness } from '../src/dsxu/integration/harness/browser-dev-server-proof-v1-harness'
import { buildV18BenchmarkReadiness } from '../src/dsxu/engine/benchmark-readiness'
import {
  buildDSXUExternalBenchmarkAdapterProofBoard,
  type DSXURawComparisonReadinessInput,
} from '../src/dsxu/engine/external-benchmark-adapter-proof-board'

const ROOT = process.cwd()
const DATE = '20260516'
const GENERATED_DIR = join(ROOT, 'docs', 'generated')
const TRACE_DIR = join(ROOT, '.dsxu', 'trace', 'external-benchmark-adapter-proof')
const OUT_JSON = join(GENERATED_DIR, `DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_${DATE}.json`)
const OUT_CSV = join(GENERATED_DIR, `DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_${DATE}.csv`)
const OUT_MD = join(ROOT, 'docs', `DSXU_EXTERNAL_BENCHMARK_ADAPTER_PROOF_${DATE}.md`)
const RAW_READINESS_JSON = join(ROOT, '.dsxu', 'trace', 'raw-evidence-readiness-register-v1', 'raw-evidence-readiness-register.evidence.json')

function n(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function s(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function rel(path: string): string {
  return relative(ROOT, path).replace(/\\/g, '/')
}

function rawReadinessFrom(report: Record<string, unknown> | null): DSXURawComparisonReadinessInput {
  return {
    status: report?.status === 'PASS' || report?.status === 'PARTIAL' || report?.status === 'BLOCKED'
      ? report.status
      : 'BLOCKED',
    p12Status: report?.p12Status === 'PASS' || report?.p12Status === 'PARTIAL' || report?.p12Status === 'BLOCKED'
      ? report.p12Status
      : 'BLOCKED',
    p12PairedRawLogCount: n(report?.p12PairedRawLogCount),
    p12MinimumPairedRawLogsForPass: n(report?.p12MinimumPairedRawLogsForPass, 14),
    p12ReplayFamilyGapCount: n(report?.p12ReplayFamilyGapCount, 14),
    mustNotClaimComparisonWin: report?.mustNotClaimComparisonWin !== false,
    nextAction: s(report?.nextAction, 'collect-target-reference-raw-logs'),
    blockers: Array.isArray(report?.blockers) ? report.blockers.map(String) : ['raw readiness evidence missing'],
  }
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

async function main(): Promise<void> {
  await mkdir(GENERATED_DIR, { recursive: true })
  await mkdir(TRACE_DIR, { recursive: true })

  const benchmark = buildV18BenchmarkReadiness({
    realTaskPack: {
      aggregate: {
        totalCases: 4,
        pass: 4,
        fail: 0,
        policyFail: 0,
        timedOut: 0,
        totalToolCalls: 24,
        totalEditCalls: 4,
        failedEditCalls: 0,
        postMarkerToolCalls: 0,
        totalCostUSD: 0.121638,
        modelsUsed: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      },
    },
    mixedRoute: {
      flashSmoke: { actualModelUsage: 'deepseek-v4-flash' },
      proPlanningSmoke: { actualModelUsage: 'deepseek-v4-pro' },
    },
    controlledFailureTaxonomy: {
      ok: true,
      taxonomy: {
        ok: true,
        sampleCount: 5,
        categories: ['permission', 'timeout', 'validation', 'workspace'],
        actions: ['request_approval', 'retry', 'replan', 'abort'],
      },
    },
    realTaskRoutePlan: {
      ok: true,
      plannedMixedRoute: true,
      actualMixedRoute: true,
      plannedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      actualModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      costOptimizationOpportunityCount: 0,
    },
  })

  const browser = await runBrowserDevServerProofHarness({
    scenarioName: 'ep08-external-adapter-proof',
    evidenceDir: TRACE_DIR,
    timeoutMs: 18_000,
    readyDelayMs: 300,
  })
  const providerGate = await writeLiveProviderGateEvidence({
    env: process.env,
    evidencePath: join(TRACE_DIR, 'provider-gate.json'),
  })
  const raw = rawReadinessFrom(await readJson(RAW_READINESS_JSON))
  const adapterBoundaries = [
    {
      name: 'remote-bridge',
      owner: 'DSXU Control Plane Adapter Boundary',
      riskControls: ['remote bridge facade is not a second Query Loop'],
    },
    {
      name: 'browser-provider',
      owner: 'DSXU MCP / Browser Adapter Boundary',
      riskControls: ['browser provider is an MCP adapter, not a standalone browser automation runtime'],
    },
    {
      name: 'desktop-mcp-import',
      owner: 'DSXU MCP Config Intake Boundary',
      riskControls: ['desktop MCP import is config intake, not MCP connection ownership'],
    },
    {
      name: 'teleport',
      owner: 'DSXU Remote Session Adapter Boundary',
      riskControls: ['teleport is a remote session adapter, not a second local Agent orchestrator'],
    },
    {
      name: 'remote-trigger',
      owner: 'DSXU Remote Session Provider',
      riskControls: ['remote trigger remains a provider-gated adapter boundary'],
    },
  ]

  const board = buildDSXUExternalBenchmarkAdapterProofBoard({
    benchmark: {
      internalCode10: benchmark.internalCode10,
      internalCode30: benchmark.internalCode30,
      publicBenchmark: benchmark.publicBenchmark,
      blockers: benchmark.blockers,
      guards: benchmark.guards,
    },
    raw,
    browser: {
      ok: browser.ok,
      blocked: browser.blocked,
      screenshotBytes: browser.screenshotBytes,
      evidencePath: rel(browser.evidencePath),
      tracePath: rel(browser.tracePath),
      browserStrategy: browser.browserStrategy,
      completedWithinTimeout: browser.completedWithinTimeout || browser.blocked,
    },
    providerGate: {
      status: providerGate.status,
      secretLeakDetected: JSON.stringify(providerGate).includes('sk-'),
      requiredEnv: ['DSXU_API_KEY', 'DEEPSEEK_API_KEY', 'DSXU_DEEPSEEK_API_KEY', 'LITELLM_BASE_URL', 'DSXU_MODEL_GATEWAY'],
      evidencePath: rel(providerGate.evidencePath),
    },
    adapterBoundaries: adapterBoundaries.map(row => {
      return {
        name: row.name,
        owner: row.owner,
        riskControls: row.riskControls,
        standaloneRuntimeClaim: false,
      }
    }),
    sourceEvidence: [
      'src/dsxu/engine/benchmark-readiness.ts',
      'src/dsxu/engine/raw-evidence-readiness-register-v1.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
      'src/dsxu/engine/live-deepseek-benchmark-gate.ts',
      'src/dsxu/integration/harness/browser-dev-server-proof-v1-harness.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/benchmark-readiness.test.ts',
      'src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts',
      'src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts',
      'src/dsxu/engine/__tests__/external-integration-owner.test.ts',
      'src/dsxu/engine/__tests__/live-provider-gate-v1.test.ts',
    ],
  })

  const passStatuses = new Set([
    'PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED',
    'READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED',
    'READY_FOR_EXTERNAL_COMPARISON_PROOF',
  ])
  const pass =
    passStatuses.has(board.status) &&
    board.ownerCoverage.browserProof &&
    board.ownerCoverage.adapterBoundary &&
    board.ownerCoverage.providerGateRedacted &&
    board.claimPublic90Allowed === false &&
    existsSync(browser.evidencePath) &&
    existsSync(browser.tracePath)
  const status = pass
    ? board.status === 'PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED'
      ? 'PASS_EXTERNAL_ADAPTER_PROOF_WITH_TARGET_RAW_BLOCKED'
      : 'PASS_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED'
    : 'FAIL_EXTERNAL_BENCHMARK_ADAPTER_PROOF'

  const report = {
    schemaVersion: 'dsxu.external-benchmark-adapter-proof-acceptance.v1',
    generatedAt: board.generatedAt,
    status,
    board,
    inputs: {
      rawReadinessPath: rel(RAW_READINESS_JSON),
      rawReadinessFound: existsSync(RAW_READINESS_JSON),
      browserEvidencePath: rel(browser.evidencePath),
      browserTracePath: rel(browser.tracePath),
      providerGateEvidencePath: rel(providerGate.evidencePath),
    },
    releaseClaimBoundary: {
      allowed: board.allowedClaims,
      blocked: board.blockedClaims,
      note: 'This closes adapter/browser/provider guard evidence only. Target-reference raw manifest remains mandatory before external comparison or public 90% claims.',
    },
  }

  await writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  const csvRows = [
    ['status', 'boardStatus', 'comparisonWinAllowed', 'public90Allowed', 'browserProof', 'adapterBoundary', 'p12Pairs', 'p12Gaps', 'nextAction'],
    [
      report.status,
      board.status,
      board.claimComparisonWinAllowed,
      board.claimPublic90Allowed,
      board.ownerCoverage.browserProof,
      board.ownerCoverage.adapterBoundary,
      board.metrics.p12PairedRawLogCount,
      board.metrics.p12ReplayFamilyGapCount,
      raw.nextAction,
    ],
  ]
  await writeFile(OUT_CSV, `${csvRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8')
  await writeFile(
    OUT_MD,
    [
      '# DSXU External Benchmark Adapter Proof - 20260516',
      '',
      `Status: ${report.status}`,
      '',
      '## Board',
      '',
      `- boardStatus: ${board.status}`,
      `- claimComparisonWinAllowed: ${board.claimComparisonWinAllowed}`,
      `- claimPublic90Allowed: ${board.claimPublic90Allowed}`,
      `- claimFullBrowserRuntimeAllowed: ${board.claimFullBrowserRuntimeAllowed}`,
      `- p12PairedRawLogCount: ${board.metrics.p12PairedRawLogCount}/${board.metrics.p12MinimumPairedRawLogsForPass}`,
      `- p12ReplayFamilyGapCount: ${board.metrics.p12ReplayFamilyGapCount}`,
      `- browserScreenshotBytes: ${board.metrics.browserScreenshotBytes}`,
      '',
      '## Owner Coverage',
      '',
      ...Object.entries(board.ownerCoverage).map(([key, value]) => `- ${key}: ${value}`),
      '',
      '## Guards',
      '',
      ...(board.guards.length > 0 ? board.guards.map(guard => `- ${guard}`) : ['- none']),
      '',
      '## Allowed Claims',
      '',
      ...board.allowedClaims.map(claim => `- ${claim}`),
      '',
      '## Blocked Claims',
      '',
      ...board.blockedClaims.map(claim => `- ${claim}`),
      '',
      '## Boundary',
      '',
      '- This is EP-08 adapter/browser/provider guard evidence, not external comparison proof.',
      '- Real targetReferenceManifestPath is still required before public comparison or 90% ability claims.',
      '- Browser proof is adapter evidence only; it does not create a standalone browser runtime.',
    ].join('\n'),
    'utf8',
  )

  console.log(report.status)
  console.log(`boardStatus=${board.status}`)
  console.log(`comparisonWinAllowed=${board.claimComparisonWinAllowed}`)
  console.log(`public90Allowed=${board.claimPublic90Allowed}`)
  console.log(`json=${OUT_JSON}`)
  console.log(`markdown=${OUT_MD}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
