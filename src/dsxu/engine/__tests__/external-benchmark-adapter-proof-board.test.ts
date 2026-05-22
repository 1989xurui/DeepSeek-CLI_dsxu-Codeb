import { describe, expect, test } from 'bun:test'
import {
  buildDSXUExternalBenchmarkAdapterProofBoard,
  type DSXUExternalBenchmarkAdapterProofInput,
} from '../external-benchmark-adapter-proof-board'

function partialInput(): DSXUExternalBenchmarkAdapterProofInput {
  return {
    generatedAt: '2026-05-16T00:00:00.000Z',
    benchmark: {
      internalCode10: 'GO_WITH_GUARDS',
      internalCode30: 'STOP',
      publicBenchmark: 'STOP_PUBLIC_BENCH',
      blockers: [],
      guards: ['Internal Code-30 is blocked until at least thirty replayable cases exist'],
    },
    raw: {
      status: 'BLOCKED',
      p12Status: 'BLOCKED',
      p12PairedRawLogCount: 0,
      p12MinimumPairedRawLogsForPass: 14,
      p12ReplayFamilyGapCount: 14,
      mustNotClaimComparisonWin: true,
      nextAction: 'collect-target-reference-raw-logs',
      blockers: ['P12-19: target reference paired raw logs are missing'],
    },
    browser: {
      ok: true,
      blocked: false,
      screenshotBytes: 4096,
      evidencePath: '.dsxu/trace/v18-browser-proof/ep08.json',
      tracePath: '.dsxu/trace/v18-browser-proof/ep08.trace.json',
      browserStrategy: 'chromium-headless-shell-cli',
      completedWithinTimeout: true,
    },
    providerGate: {
      status: 'READY',
      secretLeakDetected: false,
      requiredEnv: ['DSXU_API_KEY', 'DEEPSEEK_API_KEY'],
      evidencePath: '.dsxu/trace/live-provider-gate.json',
    },
    adapterBoundaries: [
      {
        name: 'browser-provider',
        owner: 'DSXU MCP / Browser Adapter Boundary',
        riskControls: ['browser provider is an MCP adapter, not a standalone browser automation runtime'],
        standaloneRuntimeClaim: false,
      },
      {
        name: 'desktop-mcp-import',
        owner: 'DSXU MCP Config Intake Boundary',
        riskControls: ['desktop MCP import is config intake, not MCP connection ownership'],
        standaloneRuntimeClaim: false,
      },
    ],
    sourceEvidence: [
      'src/dsxu/engine/benchmark-readiness.ts',
      'src/dsxu/engine/raw-evidence-readiness-register-v1.ts',
      'src/dsxu/engine/adapters/external-tool-adapter.ts',
    ],
    tests: [
      'src/dsxu/engine/__tests__/benchmark-readiness.test.ts',
      'src/dsxu/engine/__tests__/raw-evidence-readiness-register-v1.test.ts',
      'src/dsxu/engine/__tests__/browser-dev-server-proof-v1.test.ts',
    ],
  }
}

describe('DSXU external benchmark/adapter proof board', () => {
  test('accepts adapter proof while keeping external comparison blocked by missing target raw', () => {
    const board = buildDSXUExternalBenchmarkAdapterProofBoard(partialInput())

    expect(board.status).toBe('PARTIAL_EXTERNAL_ADAPTER_PROOF_TARGET_RAW_BLOCKED')
    expect(board.claimComparisonWinAllowed).toBe(false)
    expect(board.claimPublic90Allowed).toBe(false)
    expect(board.claimFullBrowserRuntimeAllowed).toBe(false)
    expect(board.ownerCoverage).toMatchObject({
      benchmarkGuard: true,
      rawComparisonGuard: true,
      browserProof: true,
      providerGateRedacted: true,
      adapterBoundary: true,
      sourceAndTests: true,
    })
    expect(board.guards).toContain('raw comparison win claim is blocked by raw readiness register')
    expect(board.blockedClaims.join('\n')).toContain('same-task target raw transcripts')
  })

  test('blocks adapter proof when browser proof is missing and provider leaks secrets', () => {
    const input = partialInput()
    input.browser = {
      ...input.browser,
      ok: false,
      blocked: false,
      screenshotBytes: 0,
    }
    input.providerGate = {
      ...input.providerGate,
      secretLeakDetected: true,
    }

    const board = buildDSXUExternalBenchmarkAdapterProofBoard(input)

    expect(board.status).toBe('BLOCKED_EXTERNAL_ADAPTER_PROOF')
    expect(board.guards).toContain('browser proof is missing screenshot/blocked evidence or timed out')
    expect(board.guards).toContain('provider gate evidence leaked a secret')
    expect(board.ownerCoverage.browserProof).toBe(false)
    expect(board.ownerCoverage.providerGateRedacted).toBe(false)
  })

  test('keeps adapter proof ready when target raw is imported but public claim remains stopped', () => {
    const input = partialInput()
    input.raw = {
      status: 'PASS',
      p12Status: 'PASS',
      p12PairedRawLogCount: 14,
      p12MinimumPairedRawLogsForPass: 14,
      p12ReplayFamilyGapCount: 0,
      mustNotClaimComparisonWin: false,
      nextAction: 'rebuild-public-claim-pack-with-paired-raw-boundary',
      blockers: [],
    }

    const board = buildDSXUExternalBenchmarkAdapterProofBoard(input)

    expect(board.status).toBe('READY_EXTERNAL_ADAPTER_PROOF_PUBLIC_CLAIM_BLOCKED')
    expect(board.claimComparisonWinAllowed).toBe(true)
    expect(board.claimPublic90Allowed).toBe(false)
    expect(board.ownerCoverage.adapterBoundary).toBe(true)
    expect(board.blockedClaims.join('\n')).toContain('public 90%')
    expect(board.blockedClaims.join('\n')).toContain('universal external-victory claim')
  })

  test('blocks standalone external runtime claims even when raw proof is available', () => {
    const input = partialInput()
    input.raw = {
      status: 'PASS',
      p12Status: 'PASS',
      p12PairedRawLogCount: 14,
      p12MinimumPairedRawLogsForPass: 14,
      p12ReplayFamilyGapCount: 0,
      mustNotClaimComparisonWin: false,
      nextAction: 'ready-for-delta-review',
      blockers: [],
    }
    input.benchmark.publicBenchmark = 'GO_PUBLIC_BENCH'
    input.adapterBoundaries[0] = {
      ...input.adapterBoundaries[0]!,
      standaloneRuntimeClaim: true,
      riskControls: ['standalone browser executor'],
    }

    const board = buildDSXUExternalBenchmarkAdapterProofBoard(input)

    expect(board.status).toBe('BLOCKED_EXTERNAL_ADAPTER_PROOF')
    expect(board.claimComparisonWinAllowed).toBe(true)
    expect(board.claimPublic90Allowed).toBe(true)
    expect(board.ownerCoverage.adapterBoundary).toBe(false)
    expect(board.guards).toContain('external adapter boundary evidence is missing or claims standalone runtime')
  })
})
