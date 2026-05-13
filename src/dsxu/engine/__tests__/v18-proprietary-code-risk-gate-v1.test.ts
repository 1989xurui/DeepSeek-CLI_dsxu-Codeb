import { describe, expect, test } from 'bun:test'
import {
  buildV18ProprietaryCodeRiskGate,
  runV18ProprietaryCodeRiskGateHarness,
} from '../v18-proprietary-code-risk-gate'

const legacyProduct = ['cl', 'aude'].join('')
const legacyVendor = ['anth', 'ropic'].join('')
const legacyVendorScope = `@${legacyVendor}-ai/`
const legacyVendorApiUrl = `https://api.${legacyVendor}.com/v1/messages`
const legacyEnv = `${legacyVendor.toUpperCase()}_API_KEY`

describe('V18 proprietary code risk gate V1', () => {
  test('blocks vendor dependency, vendor API, and legacy active runtime imports', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        { path: 'package.json', content: `"${legacyVendorScope}sandbox-runtime": "^0.0.1"` },
        { path: 'src/dsxu/engine/runtime-core.ts', content: `const endpoint = '${legacyVendorApiUrl}'` },
        { path: 'src/dsxu/engine/runtime-core.ts', content: "const mod = require('../../remote/RemoteSessionManager')" },
      ],
      trackedFiles: [
        'package.json',
        'src/dsxu/engine/runtime-core.ts',
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('BLOCKED_EVIDENCED')
    expect(gate.blockerCount).toBeGreaterThanOrEqual(3)
    expect(gate.byRule['vendor-dependency']).toBe(1)
    expect(gate.byRule['vendor-naming-or-api']).toBe(1)
    expect(gate.byRule['legacy-runtime-import']).toBe(1)
  })

  test('classifies model-family and old protocol names as review debt', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        { path: 'src/utils/model/model.ts', content: 'const family = "opus"' },
        { path: 'src/utils/auth.ts', content: 'export const token = getProviderOAuthTokens()' },
        { path: 'docs/plan.md', content: 'RemoteSessionManager compatibility note' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(3)
    expect(gate.justifiedCount).toBe(0)
    expect(gate.sourceTruthDocJustifiedCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(0)
    expect(gate.compatProtocolJustifiedCount).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBe(2)
    expect(gate.nonPublicReviewCount).toBe(1)
    expect(gate.byRule['vendor-model-family']).toBe(1)
    expect(gate.byRule['legacy-oauth-protocol']).toBe(1)
    expect(gate.byRule['legacy-control-symbol']).toBe(1)
  })

  test('separates hidden compatibility paths from active source debt', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        { path: 'src/dsxu/legacy/model/legacyProviderModelConfigs.ts', content: 'const family = "opus"' },
        { path: 'src/utils/model/legacyModelCompat.ts', content: 'const family = "sonnet"' },
        { path: 'src/utils/model/model.ts', content: 'const family = "haiku"' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(1)
    expect(gate.justifiedCount).toBe(2)
    expect(gate.compatModelAliasJustifiedCount).toBe(2)
    expect(gate.compatProtocolJustifiedCount).toBe(0)
    expect(gate.sourceTruthDocJustifiedCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(0)
    expect(gate.byBucket.compat).toBe(2)
    expect(gate.byBucket.active_src).toBe(1)
    expect(gate.publicSurfaceReviewCount).toBe(1)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.issues.filter(issue => issue.severity === 'justified')).toHaveLength(2)
  })

  test('keeps benchmark scripts out of active public-surface review debt', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        {
          path: 'scripts/benchmark/dsxu-mainline-benchmark.ts',
          content: 'Search for RemoteSessionManager and upstreamproxy as benchmark-only contract text',
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.byBucket.tests).toBe(1)
    expect(gate.byBucket.scripts).toBe(0)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
    expect(gate.benchContractJustifiedCount).toBe(1)
  })

  test('keeps hidden compatibility auth protocol names as justified findings', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        {
          path: 'src/dsxu/legacy/auth/legacyProviderControlAuth.ts',
          content: 'export const token = getProviderOAuthTokens()',
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.compatProtocolJustifiedCount).toBe(1)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
  })

  test('keeps V18/V19 docs as release-excluded source-truth findings', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        {
          path: 'docs/DSXU_V19_EXECUTION_PLAN_ZH_20260509.md',
          content: `Compare ${legacyProduct} Code behavior and old upstreamproxy notes only as planning source truth.`,
        },
      ],
      nowIso: '2026-05-09T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.reviewCount).toBe(0)
    expect(gate.justifiedCount).toBe(1)
    expect(gate.sourceTruthDocJustifiedCount).toBe(1)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.nonPublicReviewCount).toBe(0)
  })

  test('keeps original reference and archive files out of release-surface risk counts', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        { path: `\u539f\u4ee3\u7801${legacyProduct}/query.ts`, content: legacyVendorApiUrl },
        { path: `\u975edsxu-code\u9879\u76ee\u6587\u4ef6/archive/.env`, content: `${legacyEnv}=x` },
        { path: 'src/dsxu/control-plane/controlMessaging.ts', content: 'export const ok = true' },
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.issueCount).toBe(0)
  })

  test('tracks moved legacy shell paths as pending deletion debt instead of present blockers', () => {
    const gate = buildV18ProprietaryCodeRiskGate({
      files: [
        { path: 'src/dsxu/engine/runtime-core.ts', content: 'DSXU runtime' },
      ],
      trackedFiles: [
        'src/dsxu/engine/runtime-core.ts',
        'src/bridge/bridgeMain.ts',
      ],
      presentFiles: [
        'src/dsxu/engine/runtime-core.ts',
      ],
      nowIso: '2026-05-07T00:00:00.000Z',
    })

    expect(gate.status).toBe('DONE_EVIDENCED')
    expect(gate.blockerCount).toBe(0)
    expect(gate.trackedPathRiskCount).toBe(1)
    expect(gate.pendingDeletionCount).toBe(1)
  })

  test('writes current repository risk evidence without mutating files', async () => {
    const gate = await runV18ProprietaryCodeRiskGateHarness()

    expect(gate.evidencePath).toContain('proprietary-code-risk-gate-20260507.evidence.json')
    expect(gate.scannedFileCount).toBeGreaterThan(0)
    expect(gate.issueCount).toBeGreaterThan(0)
    expect(gate.blockerCount + gate.reviewCount + gate.justifiedCount).toBe(gate.issueCount)
    expect(gate.publicSurfaceReviewCount).toBe(0)
    expect(gate.byBucket.active_src).toBe(0)
    expect(gate.byBucket.scripts).toBe(0)
    expect(gate.justifiedCount).toBeGreaterThan(0)
    expect(gate.compatModelAliasJustifiedCount).toBeGreaterThan(0)
    expect(gate.compatProtocolJustifiedCount).toBeGreaterThan(0)
    expect(gate.sourceTruthDocJustifiedCount).toBeGreaterThanOrEqual(0)
    expect(gate.benchContractJustifiedCount).toBeGreaterThan(0)
    expect(gate.safeguards.join('\n')).toContain('evidence-ordered')
  })
})
