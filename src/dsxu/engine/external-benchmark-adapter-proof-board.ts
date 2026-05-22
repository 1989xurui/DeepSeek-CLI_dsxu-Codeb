export type DSXUExternalProofStatus =
  | 'READY_FOR_EXTERNAL_COMPARISON_PROOF'
  | 'READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED'
  | 'PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED'
  | 'BLOCKED_EXTERNAL_ADAPTER_PROOF'

export type DSXUExternalBenchmarkReadinessInput = {
  internalCode10: 'GO_WITH_GUARDS' | 'STOP'
  internalCode30: 'GO_AFTER_MORE_TASKS' | 'STOP'
  publicBenchmark: 'STOP_PUBLIC_BENCH' | 'GO_PUBLIC_BENCH'
  blockers: string[]
  guards: string[]
}

export type DSXURawComparisonReadinessInput = {
  status: 'PASS' | 'PARTIAL' | 'BLOCKED'
  p12Status: 'PASS' | 'PARTIAL' | 'BLOCKED'
  p12PairedRawLogCount: number
  p12MinimumPairedRawLogsForPass: number
  p12ReplayFamilyGapCount: number
  mustNotClaimComparisonWin: boolean
  nextAction: string
  blockers: string[]
}

export type DSXUBrowserAdapterProofInput = {
  ok: boolean
  blocked: boolean
  screenshotBytes: number
  evidencePath: string
  tracePath: string
  browserStrategy: string
  completedWithinTimeout: boolean
}

export type DSXUProviderGateProofInput = {
  status: 'READY' | 'BLOCKED-EVIDENCED'
  secretLeakDetected: boolean
  requiredEnv: string[]
  evidencePath?: string
}

export type DSXUExternalAdapterBoundaryInput = {
  name: string
  owner: string
  riskControls: string[]
  standaloneRuntimeClaim: boolean
}

export type DSXUExternalBenchmarkAdapterProofInput = {
  generatedAt?: string
  benchmark: DSXUExternalBenchmarkReadinessInput
  raw: DSXURawComparisonReadinessInput
  browser: DSXUBrowserAdapterProofInput
  providerGate: DSXUProviderGateProofInput
  adapterBoundaries: DSXUExternalAdapterBoundaryInput[]
  sourceEvidence: string[]
  tests: string[]
}

export type DSXUExternalBenchmarkAdapterProofBoard = {
  schemaVersion: 'dsxu.external-benchmark-adapter-proof.v1'
  generatedAt: string
  status: DSXUExternalProofStatus
  claimComparisonWinAllowed: boolean
  claimPublic90Allowed: boolean
  claimFullBrowserRuntimeAllowed: boolean
  guards: string[]
  allowedClaims: string[]
  blockedClaims: string[]
  ownerCoverage: {
    benchmarkGuard: boolean
    rawComparisonGuard: boolean
    browserProof: boolean
    providerGateRedacted: boolean
    adapterBoundary: boolean
    sourceAndTests: boolean
  }
  metrics: {
    p12PairedRawLogCount: number
    p12MinimumPairedRawLogsForPass: number
    p12ReplayFamilyGapCount: number
    browserScreenshotBytes: number
    adapterBoundaryCount: number
  }
}

export function buildDSXUExternalBenchmarkAdapterProofBoard(
  input: DSXUExternalBenchmarkAdapterProofInput,
): DSXUExternalBenchmarkAdapterProofBoard {
  const guards: string[] = []
  const browserProofReady =
    (input.browser.ok || input.browser.blocked) &&
    Boolean(input.browser.evidencePath) &&
    Boolean(input.browser.tracePath) &&
    input.browser.completedWithinTimeout
  const browserScreenshotReady = input.browser.ok
    ? input.browser.screenshotBytes > 0
    : input.browser.blocked
  const rawComparisonReady =
    input.raw.status === 'PASS' &&
    input.raw.p12Status === 'PASS' &&
    input.raw.p12PairedRawLogCount >= input.raw.p12MinimumPairedRawLogsForPass &&
    input.raw.p12ReplayFamilyGapCount === 0 &&
    input.raw.mustNotClaimComparisonWin === false
  const publicBenchmarkReady =
    input.benchmark.publicBenchmark === 'GO_PUBLIC_BENCH' &&
    rawComparisonReady
  const adaptersReady =
    input.adapterBoundaries.length > 0 &&
    input.adapterBoundaries.every(adapter =>
      !adapter.standaloneRuntimeClaim &&
      adapter.owner.trim().length > 0 &&
      adapter.riskControls.some(control => /adapter|not a standalone|not a second|Tool Gate|MCP/i.test(control)),
    )

  if (input.benchmark.blockers.length > 0) {
    guards.push(`benchmark readiness blockers: ${input.benchmark.blockers.join('; ')}`)
  }
  if (input.raw.mustNotClaimComparisonWin) {
    guards.push('raw comparison win claim is blocked by raw readiness register')
  }
  if (input.raw.p12PairedRawLogCount < input.raw.p12MinimumPairedRawLogsForPass) {
    guards.push('target-reference paired raw log count is below minimum')
  }
  if (input.raw.p12ReplayFamilyGapCount > 0) {
    guards.push('target-reference paired raw logs do not cover original-side replay families')
  }
  if (!browserProofReady || !browserScreenshotReady) {
    guards.push('browser proof is missing screenshot/blocked evidence or timed out')
  }
  if (input.providerGate.secretLeakDetected) {
    guards.push('provider gate evidence leaked a secret')
  }
  if (!adaptersReady) {
    guards.push('external adapter boundary evidence is missing or claims standalone runtime')
  }
  if (input.sourceEvidence.length === 0) guards.push('missing source evidence')
  if (input.tests.length === 0) guards.push('missing test evidence')

  const ownerCoverage = {
    benchmarkGuard:
      input.benchmark.internalCode10 === 'GO_WITH_GUARDS' &&
      input.benchmark.publicBenchmark === 'STOP_PUBLIC_BENCH',
    rawComparisonGuard:
      input.raw.mustNotClaimComparisonWin === true ||
      rawComparisonReady,
    browserProof: browserProofReady && browserScreenshotReady,
    providerGateRedacted: !input.providerGate.secretLeakDetected,
    adapterBoundary: adaptersReady,
    sourceAndTests: input.sourceEvidence.length > 0 && input.tests.length > 0,
  }
  const localBoundaryReady =
    ownerCoverage.benchmarkGuard &&
    ownerCoverage.rawComparisonGuard &&
    ownerCoverage.browserProof &&
    ownerCoverage.providerGateRedacted &&
    ownerCoverage.adapterBoundary &&
    ownerCoverage.sourceAndTests
  const status: DSXUExternalProofStatus = !localBoundaryReady
    ? 'BLOCKED_EXTERNAL_ADAPTER_PROOF'
    : rawComparisonReady && publicBenchmarkReady
      ? 'READY_FOR_EXTERNAL_COMPARISON_PROOF'
      : rawComparisonReady
        ? 'READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED'
        : input.raw.mustNotClaimComparisonWin
          ? 'PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED'
          : 'BLOCKED_EXTERNAL_ADAPTER_PROOF'
  const blockedClaims = [
    ...(rawComparisonReady
      ? ['Do not broaden imported paired raw comparison evidence into a public 90% or universal external-victory claim.']
      : ['Do not claim external comparison win until same-task target raw transcripts are imported.']),
    'Do not claim public 90% top-tier coding/complex-task ability from adapter proof or internal smoke tests.',
    'Do not claim SWE Verified, Terminal-Bench, OSWorld, Toolathlon, or full browser runtime parity without raw evidence.',
    'Do not claim standalone browser/MCP/IDE runtime outside DSXU Tool Gate and owner boundaries.',
  ]

  return {
    schemaVersion: 'dsxu.external-benchmark-adapter-proof.v1',
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    status,
    claimComparisonWinAllowed: rawComparisonReady,
    claimPublic90Allowed: publicBenchmarkReady,
    claimFullBrowserRuntimeAllowed: false,
    guards,
    allowedClaims: localBoundaryReady
      ? [
        'DSXU may claim internal guarded Code-10/Code-30 style readiness only with explicit STOP boundaries.',
        'DSXU may claim browser/dev-server proof as adapter evidence with screenshot or blocked evidence.',
        'DSXU may claim external integrations as adapter boundaries governed by existing DSXU owners.',
      ]
      : [],
    blockedClaims,
    ownerCoverage,
    metrics: {
      p12PairedRawLogCount: input.raw.p12PairedRawLogCount,
      p12MinimumPairedRawLogsForPass: input.raw.p12MinimumPairedRawLogsForPass,
      p12ReplayFamilyGapCount: input.raw.p12ReplayFamilyGapCount,
      browserScreenshotBytes: input.browser.screenshotBytes,
      adapterBoundaryCount: input.adapterBoundaries.length,
    },
  }
}
