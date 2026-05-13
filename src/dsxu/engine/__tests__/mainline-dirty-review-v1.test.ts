import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildMainlineDirtyReview } from '../mainline-dirty-review-v1'
import { buildV18DirtyQuarantineLedger } from '../v18-dirty-quarantine-ledger'
import { runMainlineDirtyReviewHarness } from '../../integration/harness/mainline-dirty-review-v1-harness'

describe('DWR-01 - Mainline Dirty Review V1', () => {
  test('splits mainline dirty entries into owner review groups', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/QueryEngine.ts',
        ' M src/dsxu/engine/runtime-core.ts',
        ' M src/dsxu/engine/release-test-gate.ts',
        '?? src/dsxu/engine/__tests__/release-test-gate.test.ts',
        ' M src/tools/ShellTool.ts',
        ' M package.json',
        '?? fixtures/sample.json',
        ' M src/dsxu/control-plane/controlMain.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)

    expect(review.schemaVersion).toBe('dsxu.mainline-dirty-review.v1')
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(8)
    expect(review.ownerSliceCount).toBeGreaterThanOrEqual(6)
    expect(review.engineTestOwnerSliceCount).toBe(3)
    expect(review.engineTestOwnerEvidenceVerifiedCount).toBe(3)
    expect(review.engineTestOwnerMissingEvidenceCount).toBe(0)
    expect(review.toolsConfigOwnerSliceCount).toBe(4)
    expect(review.toolsConfigOwnerEvidenceVerifiedCount).toBe(4)
    expect(review.toolsConfigOwnerMissingEvidenceCount).toBe(0)
    expect(review.replaceDeleteCandidateCount).toBe(0)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(0)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(review.canCloseMainlineDirtyGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.map(batch => batch.id)).toEqual([
      'MDR-01',
      'MDR-02',
      'MDR-03',
      'MDR-04',
      'MDR-05',
      'MDR-06',
      'MDR-07',
    ])
    expect(review.batches.find(batch => batch.id === 'MDR-01')?.risk).toBe('high')
    expect(review.batches.find(batch => batch.id === 'MDR-02')?.focusedVerification.join('\n')).toContain('bun test')
    expect(review.batches.find(batch => batch.id === 'MDR-02')?.ownerSlices.map(slice => slice.group)).toContain('runtime-contract-engine')
    expect(review.batches.find(batch => batch.id === 'MDR-02')?.ownerSlices.find(slice => slice.group === 'runtime-contract-engine')?.ownerEvidence).toContain('tool-runtime-dirty-review-v1.test.ts')
    expect(review.batches.find(batch => batch.id === 'MDR-02')?.ownerSlices.find(slice => slice.group === 'runtime-contract-engine')?.ownerEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(review.batches.find(batch => batch.id === 'MDR-04')?.ownerSlices.map(slice => slice.group)).toContain('shell-adapter-owner')
    expect(review.batches.find(batch => batch.id === 'MDR-04')?.ownerSlices.find(slice => slice.group === 'shell-adapter-owner')?.ownerEvidence).toContain('bash-adapter-safety-v1.test.ts')
    expect(review.batches.find(batch => batch.id === 'MDR-05')?.ownerSlices.map(slice => slice.group)).toContain('package-runtime-config')
    expect(review.batches.every(batch => batch.canAutoClose === false)).toBe(true)
    expect(review.nextAction).toBe('split-legacy-mainline')
  })

  test('marks backup tests and deleted MSA experiment source as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/engine.test.ts.backup',
        ' M src/dsxu/msa/embedding-ollama.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)

    expect(review.ownerSliceCount).toBe(2)
    expect(review.replaceDeleteCandidateCount).toBe(2)
    expect(review.reviewBeforeKeepCount).toBe(0)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(2)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slices.find(slice => slice.group === 'deleted-backup-test-candidate')?.semanticDecision).toBe('replace-delete-candidate')
    expect(slices.find(slice => slice.group === 'deleted-backup-test-candidate')?.replacementEvidence).toEqual(['engine.test.ts'])
    expect(slices.find(slice => slice.group === 'deleted-backup-test-candidate')?.replacementEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(slices.find(slice => slice.group === 'msa-experiment-review')?.semanticDecision).toBe('replace-delete-candidate')
    expect(slices.find(slice => slice.group === 'msa-experiment-review')?.requiredAction).toContain('do not restore it as a second memory/context runtime')
    expect(slices.find(slice => slice.group === 'msa-experiment-review')?.replacementEvidenceChecks.every(item => item.status === 'FOUND')).toBe(true)
  })

  test('marks archived legacy bridge command surface as replace/delete candidate', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/commands.ts',
        ' M src/commands/bridge-kick.ts',
        ' M src/commands/bridge/index.ts',
        ' M src/commands/bridge/bridge.tsx',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches.flatMap(batch => batch.ownerSlices).find(item => item.group === 'legacy-bridge-command-surface')
    const registrySlice = review.batches.flatMap(batch => batch.ownerSlices).find(item => item.group === 'legacy-command-registry-owner')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(registrySlice?.semanticDecision).toBe('map-to-mainline-owner')
    expect(registrySlice?.ownerEvidence).toEqual(['tool-runtime-dirty-review-v1.test.ts', 'provider-contract-v1.test.ts'])
    expect(registrySlice?.ownerEvidenceStatus).toBe('VERIFIED_FOR_REVIEW')
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.targetOwner).toContain('DSXU provider contract alias block')
    expect(slice?.requiredAction).toContain('close archived legacy bridge command surface')
    expect(slice?.replacementEvidence).toEqual(['tool-runtime-dirty-review-v1.test.ts', 'provider-contract-v1.test.ts'])
    expect(slice?.replacementEvidenceChecks.every(item => item.status === 'FOUND')).toBe(true)
  })

  test('marks deleted analyzer and HITL entrypoint slices as replace/delete candidates with current owner evidence', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' D src/dsxu/engine/analyzers/classification-analyzer.ts',
        ' D src/dsxu/engine/analyzers/filtering-analyzer.ts',
        ' D src/dsxu/engine/analyzers/scoring-analyzer.ts',
        ' D src/dsxu/hitl/index.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const analyzerSlice = slices.find(slice => slice.group === 'engine-analyzers')
    const hitlSlice = slices.find(slice => slice.group === 'hitl-control-surface')

    expect(review.replaceDeleteCandidateCount).toBe(2)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(2)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(analyzerSlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(analyzerSlice?.requiredAction).toContain('current task analyzer and quality gate evidence')
    expect(analyzerSlice?.replacementEvidence).toEqual(['task-analyzer.test.ts', 'quality-gate-mainline-v1.test.ts'])
    expect(hitlSlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(hitlSlice?.requiredAction).toContain('current HITL test and permission floor evidence')
    expect(hitlSlice?.replacementEvidence).toEqual(['hitl.test.ts', 'allowed-tools-permission-floor-v1.test.ts'])
  })

  test('marks deleted legacy engine sidecar runtimes as replace/delete candidates instead of engine support keep', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' D src/dsxu/engine/claude-tools-bridge.ts',
        ' D src/dsxu/engine/legacy-full-bridge.ts',
        ' D src/dsxu/engine/query-engine-extensions.ts',
        ' D src/dsxu/engine/cli-integration.ts',
        ' D src/dsxu/engine/coding-cli.ts',
        ' D src/dsxu/engine/data-sources/github-source.ts',
        ' D src/dsxu/engine/data-sources/market-source.ts',
        ' D src/dsxu/engine/opportunity-discovery.ts',
        ' D src/dsxu/engine/task-runner.ts',
        ' D src/dsxu/engine/reporters/daily-markdown-reporter.ts',
        ' D src/dsxu/engine/full-absorb.ts',
        ' D src/dsxu/engine/full-absorb-executor.ts',
        ' D src/dsxu/engine/memory-chain.ts',
        ' D src/dsxu/engine/memory-chain-types.ts',
        ' D src/dsxu/engine/parallel-speculation.ts',
        ' D src/dsxu/engine/voice-extension.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const groups = slices.map(slice => slice.group)

    expect(review.replaceDeleteCandidateCount).toBe(7)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(7)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(groups).not.toContain('engine-support-contracts')
    expect(groups).toContain('deleted-legacy-bridge-runtime')
    expect(groups).toContain('deleted-opportunity-cli')
    expect(groups).toContain('deleted-opportunity-data-sources')
    expect(groups).toContain('deleted-opportunity-discovery')
    expect(groups).toContain('deleted-full-absorb-planner')
    expect(groups).toContain('deleted-memory-chain-runtime')
    expect(groups).toContain('deleted-sidecar-experiment-runtime')
    expect(slices.find(slice => slice.group === 'deleted-legacy-bridge-runtime')?.targetOwner).toContain('Tool Gate')
    expect(slices.find(slice => slice.group === 'deleted-full-absorb-planner')?.requiredAction).toContain('deferred absorption')
    expect(slices.every(slice => slice.semanticDecision === 'replace-delete-candidate')).toBe(true)
  })

  test('marks deleted proxy and tool-result legacy tests as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' D src/dsxu/engine/__tests__/kill-switch-integration.test.ts',
        ' D src/dsxu/engine/__tests__/proxy-integration.test.ts',
        ' D src/dsxu/engine/__tests__/tool-result-normalization.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const proxySlice = slices.find(slice => slice.group === 'deleted-proxy-integration-tests')
    const toolResultSlice = slices.find(slice => slice.group === 'deleted-tool-result-normalization-test')

    expect(review.replaceDeleteCandidateCount).toBe(2)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(2)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(proxySlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(proxySlice?.replacementEvidence).toEqual([
      'proxy-budget-guard.test.ts',
      'network-facade-v1.test.ts',
      'direct-connect-and-query-contract-v1.test.ts',
    ])
    expect(toolResultSlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(toolResultSlice?.replacementEvidence).toEqual([
      'direct-connect-and-query-contract-v1.test.ts',
      'tool-evidence-pack-contract-v1.test.ts',
    ])
  })

  test('marks minimal recovery and lifecycle example test shims as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/recovery-decision-v3-minimal.test.ts',
        '?? src/dsxu/engine/__tests__/recovery-integration-v3-minimal.test.ts',
        '?? src/dsxu/engine/__tests__/recovery-planner-v3-minimal.test.ts',
        '?? src/dsxu/engine/__tests__/lifecycle-integration.example.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const recoverySlice = slices.find(slice => slice.group === 'minimal-recovery-test-shims')
    const lifecycleSlice = slices.find(slice => slice.group === 'example-lifecycle-test-shim')

    expect(review.replaceDeleteCandidateCount).toBe(2)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(2)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(recoverySlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(recoverySlice?.count).toBe(3)
    expect(recoverySlice?.replacementEvidence).toEqual([
      'recovery-runtime-v3.test.ts',
      'recovery-query-loop-v3.test.ts',
      'recovery-mainline-v3.test.ts',
    ])
    expect(lifecycleSlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(lifecycleSlice?.replacementEvidence).toEqual([
      'lifecycle-protocol-manager.test.ts',
      'tool-lifecycle-contract-v1.test.ts',
    ])
  })

  test('marks full-absorb test shim as replace/delete candidate with absorption evidence', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/__tests__/full-absorb.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'full-absorb-test-shim')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.replacementEvidence).toEqual([
      'owner-git-closure-board-v1.test.ts',
      'deferred-product-absorption-register-v1.test.ts',
    ])
  })

  test('marks legacy wave aggregation tests as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/__tests__/wave2.test.ts',
        ' M src/dsxu/engine/__tests__/wave4-core.test.ts',
        ' M src/dsxu/engine/__tests__/wave4-extended.test.ts',
        ' M src/dsxu/engine/__tests__/wave5-doctor.test.ts',
        ' M src/dsxu/engine/__tests__/wave5-formatters.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'legacy-wave-test-shims')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.count).toBe(5)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.replacementEvidence).toEqual([
      'v19-cost-cache-live-task-evidence-v1.test.ts',
      'memory-session-integration.test.ts',
      'model-config.test.ts',
      'toolchain-selfcheck-v1.test.ts',
      'source-encoding-boundary-v1.test.ts',
    ])
  })

  test('marks legacy recovery aggregation tests as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/recovery-decision.test.ts',
        '?? src/dsxu/engine/__tests__/recovery-integration.test.ts',
        '?? src/dsxu/engine/__tests__/recovery-planner.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'legacy-recovery-test-shims')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.count).toBe(3)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.replacementEvidence).toEqual([
      'recovery-runtime-v3.test.ts',
      'recovery-query-loop-v3.test.ts',
      'recovery-mainline-v3.test.ts',
    ])
  })

  test('marks legacy coordinator aggregation tests as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/coordinator-lifecycle-v1.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-mainline-v3-clean.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-mode-and-bridge-v1-clean.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-role-routing-parity-v1.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-role-routing-v1.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-state-model-v1.test.ts',
        '?? src/dsxu/engine/__tests__/coordinator-state-model-v2-clean.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'legacy-coordinator-test-shims')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.count).toBe(7)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.replacementEvidence).toEqual([
      'coordinator-mainline-v4-strong.test.ts',
      'coordinator-state-model-v4-alignment.test.ts',
      'coordinator-lifecycle-v5-clean.test.ts',
      'coordinator-visible-copy-v1.test.ts',
    ])
  })

  test('marks Kairos session subcontract shims as replace/delete candidates', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/A-2A-kairos-integration-harness.test.ts',
        '?? src/dsxu/engine/__tests__/kairos-resume-hint-v1.test.ts',
        '?? src/dsxu/engine/__tests__/kairos-session-snapshot-v1.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'kairos-session-subcontract-shims')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.count).toBe(3)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.replacementEvidence).toEqual([
      'kairos-session-mainline-v1.test.ts',
      'compact-resume-replay-v1.test.ts',
      'session-memory-mainline-v1.test.ts',
    ])
  })

  test('marks DSXU mainline compatibility wrapper as replace/delete candidate', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/dsxu-mainline-compat-wrappers.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(item => item.group === 'compat-wrapper-runtime-shim')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(slice?.semanticDecision).toBe('replace-delete-candidate')
    expect(slice?.targetOwner).toContain('provider contract')
    expect(slice?.replacementEvidence).toEqual([
      'c05-tool-compat-absorption-clean.test.ts',
      'mainline-tool-adapter-v1.test.ts',
      'provider-contract-v1.test.ts',
      'tool-mainline-v1-clean.test.ts',
    ])
  })

  test('marks open-source core scheduler support as replace/delete and provider backend as adapter boundary', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/open-source-core.ts',
        '?? src/dsxu/engine/provider-backend/',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const openSourceSlice = slices.find(item => item.group === 'open-source-core-runtime-shim')
    const providerBackendSlice = slices.find(item => item.group === 'provider-backend-adapter-boundary')

    expect(review.replaceDeleteCandidateCount).toBe(1)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(openSourceSlice?.semanticDecision).toBe('replace-delete-candidate')
    expect(openSourceSlice?.replacementEvidence).toEqual([
      'task-runtime-mainline-v1-clean.test.ts',
      'task-lifecycle-v1-clean.test.ts',
      'v18-open-source-package-gate-v1.test.ts',
    ])
    expect(providerBackendSlice?.semanticDecision).toBe('map-to-mainline-owner')
    expect(providerBackendSlice?.targetOwner).toContain('adapter boundary')
    expect(providerBackendSlice?.ownerEvidence).toEqual([
      'provider-contract-v1.test.ts',
      'control-plane-v1.test.ts',
      'remote-lifecycle-v1.test.ts',
    ])
  })

  test('maps permissions and API service to named mainline owners', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/permissions.ts',
        ' M src/dsxu/engine/api-service.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger)
    const slices = review.batches.flatMap(batch => batch.ownerSlices)
    const permissionSlice = slices.find(item => item.group === 'permission-tool-gate-owner')
    const apiSlice = slices.find(item => item.group === 'model-router-cost-api-owner')

    expect(review.replaceDeleteCandidateCount).toBe(0)
    expect(permissionSlice?.semanticDecision).toBe('map-to-mainline-owner')
    expect(permissionSlice?.targetOwner).toContain('single Tool Gate')
    expect(permissionSlice?.ownerEvidence).toContain('allowed-tools-permission-floor-v1.test.ts')
    expect(apiSlice?.semanticDecision).toBe('map-to-mainline-owner')
    expect(apiSlice?.targetOwner).toContain('DeepSeek V4 model router')
    expect(apiSlice?.ownerEvidence).toContain('deepseek-v4-control-v1.test.ts')
  })

  test('blocks replace/delete candidates when replacement evidence is unavailable', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        '?? src/dsxu/engine/__tests__/engine.test.ts.backup',
        ' D src/dsxu/msa/index.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger, {
      availableReplacementEvidence: ['engine.test.ts'],
    })
    const msaSlice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(slice => slice.group === 'msa-experiment-review')

    expect(review.replaceDeleteCandidateCount).toBe(2)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(1)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(1)
    expect(msaSlice?.replacementEvidenceStatus).toBe('MISSING')
    expect(msaSlice?.missingReplacementEvidence).toContain('context-owner-rule-contract-v1.test.ts')
  })

  test('blocks engine/test owner slices when owner evidence is unavailable', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/dsxu/engine/runtime-core.ts',
        '?? src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts',
      ],
    })
    const review = buildMainlineDirtyReview(ledger, {
      availableReplacementEvidence: ['engine.test.ts'],
      legacyMainlineReviewStatus: 'PARTIAL',
      legacyMainlineReviewBatchCount: 6,
    })
    const runtimeSlice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(slice => slice.group === 'runtime-contract-engine')

    expect(review.engineTestOwnerSliceCount).toBe(2)
    expect(review.engineTestOwnerEvidenceVerifiedCount).toBe(0)
    expect(review.engineTestOwnerMissingEvidenceCount).toBe(2)
    expect(review.nextAction).toBe('review-engine-and-tests')
    expect(runtimeSlice?.ownerEvidenceStatus).toBe('MISSING')
    expect(runtimeSlice?.missingOwnerEvidence).toContain('tool-runtime-dirty-review-v1.test.ts')
  })

  test('blocks tool/config owner slices when owner evidence is unavailable', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/tools/BashTool/BashTool.tsx',
        ' M package.json',
      ],
    })
    const review = buildMainlineDirtyReview(ledger, {
      availableReplacementEvidence: ['engine.test.ts'],
      legacyMainlineReviewStatus: 'PARTIAL',
      legacyMainlineReviewBatchCount: 6,
    })
    const shellSlice = review.batches
      .flatMap(batch => batch.ownerSlices)
      .find(slice => slice.group === 'shell-adapter-owner')

    expect(review.toolsConfigOwnerSliceCount).toBe(2)
    expect(review.toolsConfigOwnerEvidenceVerifiedCount).toBe(0)
    expect(review.toolsConfigOwnerMissingEvidenceCount).toBe(2)
    expect(review.nextAction).toBe('review-tools-and-config')
    expect(shellSlice?.ownerEvidenceStatus).toBe('MISSING')
    expect(shellSlice?.missingOwnerEvidence).toContain('bash-adapter-safety-v1.test.ts')
  })

  test('passes only when no mainline dirty entries remain', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: ['?? docs/DSXU_V18_PROGRESS_20260506.md'],
    })
    const review = buildMainlineDirtyReview(ledger)

    expect(review.status).toBe('PASS')
    expect(review.total).toBe(0)
    expect(review.ownerSliceCount).toBe(0)
    expect(review.engineTestOwnerSliceCount).toBe(0)
    expect(review.engineTestOwnerEvidenceVerifiedCount).toBe(0)
    expect(review.engineTestOwnerMissingEvidenceCount).toBe(0)
    expect(review.toolsConfigOwnerSliceCount).toBe(0)
    expect(review.toolsConfigOwnerEvidenceVerifiedCount).toBe(0)
    expect(review.toolsConfigOwnerMissingEvidenceCount).toBe(0)
    expect(review.replaceDeleteCandidateCount).toBe(0)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(0)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(review.canCloseMainlineDirtyGate).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(false)
    expect(review.batches).toEqual([])
    expect(review.nextAction).toBe('mainline-gate-closed')
  })

  test('writes current mainline dirty review without changing git state', async () => {
    const review = await runMainlineDirtyReviewHarness()

    expect(review.evidencePath).toContain('mainline-dirty-review.evidence.json')
    expect(review.tracePath).toContain('mainline-dirty-review.trace.json')
    expect(existsSync(review.evidencePath)).toBe(true)
    expect(existsSync(review.tracePath)).toBe(true)
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBeGreaterThan(0)
    expect(review.batches.length).toBeGreaterThanOrEqual(5)
    expect(review.ownerSliceCount).toBeGreaterThan(10)
    expect(review.engineTestOwnerSliceCount).toBeGreaterThan(8)
    expect(review.engineTestOwnerEvidenceVerifiedCount).toBe(review.engineTestOwnerSliceCount)
    expect(review.engineTestOwnerMissingEvidenceCount).toBe(0)
    expect(review.toolsConfigOwnerSliceCount).toBeGreaterThan(10)
    expect(review.toolsConfigOwnerEvidenceVerifiedCount).toBe(review.toolsConfigOwnerSliceCount)
    expect(review.toolsConfigOwnerMissingEvidenceCount).toBe(0)
    expect(review.reviewBeforeKeepCount).toBe(0)
    expect(review.replaceDeleteCandidateCount).toBeGreaterThanOrEqual(2)
    expect(review.replaceDeleteEvidenceVerifiedCount).toBe(review.replaceDeleteCandidateCount)
    expect(review.replaceDeleteMissingEvidenceCount).toBe(0)
    expect(review.highRiskBatchCount).toBeGreaterThanOrEqual(1)
    expect(review.legacyMainlineReviewStatus).toBe('PARTIAL')
    expect(review.legacyMainlineReviewBatchCount).toBeGreaterThanOrEqual(3)
    expect(review.nextAction).toBe('review-owner-git-closure')
    expect(review.mustNotStageOrRestore).toBe(true)
  }, 60_000)
})
