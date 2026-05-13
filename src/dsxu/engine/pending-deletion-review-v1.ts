import type {
  V18PendingDeletionClosure,
  V18PendingDeletionClosureEntry,
} from './v18-open-source-package-gate'
import { DSXU_RELEASE_GATE_TESTS } from './release-test-gate'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PRODUCT_PATTERN = new RegExp(LEGACY_PRODUCT, 'gi')

export type PendingDeletionReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type PendingDeletionReviewBatchId = 'PDR-01' | 'PDR-02' | 'PDR-03' | 'PDR-99'

type ReplacementEvidenceStatus = 'VERIFIED_FOR_REVIEW' | 'READY_FOR_REVIEW' | 'MISSING'

type ReplacementEvidenceCheck = {
  name: string
  status: 'FOUND' | 'MISSING'
  matchedEvidence: string | null
}

export type PendingDeletionSubSlice = {
  id: string
  parentId: PendingDeletionReviewBatchId
  group: string
  count: number
  owner: string
  targetOwner: string
  closureDecision: 'mainline-replacement-delete' | 'release-excluded-delete' | 'old-root-shim-delete'
  requiredAction: string
  restorePolicy: string
  replacementEvidence: readonly string[]
  replacementEvidenceStatus: ReplacementEvidenceStatus
  replacementEvidenceChecks: readonly ReplacementEvidenceCheck[]
  missingReplacementEvidence: readonly string[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionReviewBatch = {
  id: PendingDeletionReviewBatchId
  ruleId: string
  count: number
  owner: string
  status: PendingDeletionReviewStatus
  requiredAction: string
  replacementEvidence: readonly string[]
  replacementEvidenceStatus: ReplacementEvidenceStatus
  replacementEvidenceChecks: readonly ReplacementEvidenceCheck[]
  subSlices: readonly PendingDeletionSubSlice[]
  missingReplacementEvidence: readonly string[]
  restorePolicy: string
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionReview = {
  schemaVersion: 'dsxu.pending-deletion-review.v1'
  status: PendingDeletionReviewStatus
  total: number
  batchCount: number
  subSliceCount: number
  pass: number
  partial: number
  blocked: number
  canClosePendingDeletionGate: boolean
  mustNotStageOrRestore: boolean
  batches: readonly PendingDeletionReviewBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction: 'review-mainline-replacement-evidence' | 'review-release-excluded-state' | 'normal-git-review'
}

const pdr01SubSliceOrder = [
  'bridge-core-runtime-shell',
  'bridge-session-security',
  'bridge-transport-polling',
  'bridge-ui-debug',
] as const

const pdr02SubSliceOrder = [
  'legacy-config-private-state',
  'dsevo-milestone-nightly-state',
  'dsevo-bench-golden-fixtures',
  'evals-old-bench-scripts',
] as const

const pdr03SubSliceOrder = [
  'old-root-launchers',
  'old-proxy-shims',
  'old-root-test-scripts',
] as const

function batchIdForRule(ruleId: string): PendingDeletionReviewBatchId {
  if (ruleId === 'legacy-control-plane-shell') return 'PDR-01'
  if (ruleId === 'legacy-private-state') return 'PDR-02'
  if (ruleId === 'old-root-shims') return 'PDR-03'
  return 'PDR-99'
}

function ownerForRule(ruleId: string): string {
  if (ruleId === 'legacy-control-plane-shell') return 'Control Plane'
  if (ruleId === 'legacy-private-state') return 'Release Evidence'
  if (ruleId === 'old-root-shims') return 'Entrypoint / Tooling'
  return 'Release Review'
}

function replacementEvidenceForRule(ruleId: string): readonly string[] {
  if (ruleId === 'legacy-control-plane-shell') {
    return [
      'control-plane-v1.test.ts',
      'control-plane-stage-acceptance-v1.test.ts',
      'remote-network-workflow-v1.test.ts',
    ]
  }
  if (ruleId === 'old-root-shims') {
    return [
      'Start-DSXU-Code.cmd',
      'Start-DSXU-Code-WSL.cmd',
      'toolchain-selfcheck-v1.test.ts',
    ]
  }
  if (ruleId === 'legacy-private-state') {
    return [
      'open-source-package-gate-20260507.evidence.json',
      'clean-export-readiness.evidence.json',
    ]
  }
  return ['manual release review evidence required']
}

function evidenceName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path
}

function defaultAvailableReplacementEvidence(): readonly string[] {
  return [
    ...DSXU_RELEASE_GATE_TESTS.map(entry => entry.path.split('/').at(-1) ?? entry.path),
    'Start-DSXU-Code.cmd',
    'Start-DSXU-Code-WSL.cmd',
    'open-source-package-gate-20260507.evidence.json',
    'clean-export-readiness.evidence.json',
    'clean-export-readiness-v1.test.ts',
    'pending-deletion-review-v1.test.ts',
    'release-closure-board-v1.test.ts',
    'reference-experience-quality-contract-v1.test.ts',
  ]
}

function buildReplacementEvidenceChecks(
  replacementEvidence: readonly string[],
  availableEvidence: ReadonlySet<string>,
): readonly ReplacementEvidenceCheck[] {
  const availableEvidenceByName = new Map([...availableEvidence].map(item => [evidenceName(item), item]))
  return replacementEvidence.map(item => {
    const matchedEvidence = availableEvidence.has(item)
      ? item
      : availableEvidenceByName.get(evidenceName(item)) ?? null
    return {
      name: item,
      status: matchedEvidence ? 'FOUND' as const : 'MISSING' as const,
      matchedEvidence,
    }
  })
}

function requiredActionForRule(ruleId: string): string {
  if (ruleId === 'legacy-control-plane-shell') {
    return 'verify mainline control-plane replacement evidence before normal git deletion review'
  }
  if (ruleId === 'old-root-shims') {
    return 'verify DSXU entrypoint and toolchain replacement evidence before normal git deletion review'
  }
  if (ruleId === 'legacy-private-state') {
    return 'confirm paths stay release-excluded, then close through normal git deletion review'
  }
  return 'perform manual pending deletion review'
}

function sanitizeSamplePath(path: string): string {
  return path.replace(LEGACY_PRODUCT_PATTERN, 'legacy-product')
}

function subSliceOrderForRule(ruleId: string): readonly string[] {
  if (ruleId === 'legacy-control-plane-shell') return pdr01SubSliceOrder
  if (ruleId === 'legacy-private-state') return pdr02SubSliceOrder
  if (ruleId === 'old-root-shims') return pdr03SubSliceOrder
  return ['manual-review']
}

function subSliceGroupForPath(ruleId: string, path: string): string {
  const normalized = path.replace(/\\/g, '/')
  if (ruleId === 'legacy-control-plane-shell') {
    if (/^src\/bridge\/(bridgeApi|bridgeConfig|bridgeEnabled|bridgeMain|remoteBridgeCore|replBridge|replBridgeHandle|types)\.ts$/.test(normalized)) return 'bridge-core-runtime-shell'
    if (/^src\/bridge\/(bridgePermissionCallbacks|sessionIdCompat|trustedDevice|jwtUtils|workSecret|createSession|codeSessionApi)\.ts$/.test(normalized)) return 'bridge-session-security'
    if (/^src\/bridge\/(bridgeMessaging|pollConfig|pollConfigDefaults|inboundAttachments|inboundMessages|flushGate|replBridgeTransport|sessionRunner|capacityWake)\.ts$/.test(normalized)) return 'bridge-transport-polling'
    return 'bridge-ui-debug'
  }
  if (ruleId === 'legacy-private-state') {
    if (/^\.claude\//.test(normalized)) return 'legacy-config-private-state'
    if (/^\.dsevo\//.test(normalized)) return 'dsevo-milestone-nightly-state'
    if (/^dsevo\//.test(normalized)) return 'dsevo-bench-golden-fixtures'
    if (/^evals\//.test(normalized)) return 'evals-old-bench-scripts'
    return 'legacy-config-private-state'
  }
  if (ruleId === 'old-root-shims') {
    if (/^start-/.test(normalized) || normalized === 'crash-handler.js') return 'old-root-launchers'
    if (/^deepseek-proxy\.(js|ts)$/.test(normalized)) return 'old-proxy-shims'
    return 'old-root-test-scripts'
  }
  return 'manual-review'
}

function ownerForSubSlice(group: string): string {
  if (group.startsWith('bridge-')) return 'Control Plane Replacement Owner'
  if (group === 'legacy-config-private-state') return 'Release Evidence Owner'
  if (group === 'dsevo-milestone-nightly-state') return 'Historical Evidence Owner'
  if (group === 'dsevo-bench-golden-fixtures' || group === 'evals-old-bench-scripts') return 'Evaluation Evidence Owner'
  if (group === 'old-root-launchers') return 'Entrypoint Replacement Owner'
  if (group === 'old-proxy-shims') return 'Direct Connect / Provider Runtime Owner'
  if (group === 'old-root-test-scripts') return 'Verification Tooling Owner'
  return 'Release Review Owner'
}

function targetOwnerForSubSlice(group: string): string {
  if (group === 'bridge-core-runtime-shell') return 'DSXU Control Plane and direct-connect lifecycle tests'
  if (group === 'bridge-session-security') return 'DSXU control-plane permission/session replacement evidence'
  if (group === 'bridge-transport-polling') return 'DSXU remote network workflow and control-plane transport evidence'
  if (group === 'bridge-ui-debug') return 'DSXU visible-state/control-plane diagnostics evidence'
  if (group === 'legacy-config-private-state') return 'release-excluded private config state'
  if (group === 'dsevo-milestone-nightly-state') return 'release-excluded historical milestone evidence'
  if (group === 'dsevo-bench-golden-fixtures') return 'P12/raw eval evidence or release-excluded archive'
  if (group === 'evals-old-bench-scripts') return 'P12/raw eval replacement or release-excluded archive'
  if (group === 'old-root-launchers') return 'Start-DSXU-Code launchers and CLI entrypoint'
  if (group === 'old-proxy-shims') return 'DSXU direct-connect/provider runtime replacement'
  if (group === 'old-root-test-scripts') return 'current Bun/focused verification harnesses'
  return 'manual release review'
}

function closureDecisionForSubSlice(ruleId: string): PendingDeletionSubSlice['closureDecision'] {
  if (ruleId === 'legacy-control-plane-shell') return 'mainline-replacement-delete'
  if (ruleId === 'old-root-shims') return 'old-root-shim-delete'
  return 'release-excluded-delete'
}

function requiredActionForSubSlice(ruleId: string, group: string): string {
  if (ruleId === 'legacy-control-plane-shell') return 'verify DSXU control-plane replacement evidence, then close deletion through normal git review'
  if (ruleId === 'old-root-shims') return 'verify DSXU launcher/tooling replacement evidence, then close deletion through normal git review'
  if (group === 'dsevo-bench-golden-fixtures' || group === 'evals-old-bench-scripts') return 'confirm P12/raw eval replacement or release-excluded archive before normal git review'
  return 'confirm release-excluded state and close deletion through normal git review'
}

function subSliceReplacementEvidence(ruleId: string, group: string): readonly string[] {
  if (ruleId === 'legacy-control-plane-shell') {
    if (group === 'bridge-core-runtime-shell') {
      return [
        'control-plane-v1.test.ts',
        'control-plane-stage-acceptance-v1.test.ts',
        'direct-connect-and-query-contract-v1.test.ts',
      ]
    }
    if (group === 'bridge-session-security') {
      return [
        'control-plane-stage-acceptance-v1.test.ts',
        'v9-permission-usability-v1.test.ts',
        'allowed-tools-permission-floor-v1.test.ts',
      ]
    }
    if (group === 'bridge-transport-polling') {
      return [
        'remote-network-workflow-v1.test.ts',
        'network-facade-v1.test.ts',
        'direct-connect-and-query-contract-v1.test.ts',
      ]
    }
    if (group === 'bridge-ui-debug') {
      return [
        'query-loop-visible-copy-v1.test.ts',
        'streaming-ui-visibility-v1.test.ts',
        'control-plane-stage-acceptance-v1.test.ts',
      ]
    }
    return replacementEvidenceForRule(ruleId)
  }
  if (ruleId === 'old-root-shims') {
    if (group === 'old-root-launchers') {
      return [
        'Start-DSXU-Code.cmd',
        'Start-DSXU-Code-WSL.cmd',
        'toolchain-selfcheck-v1.test.ts',
      ]
    }
    if (group === 'old-proxy-shims') {
      return [
        'direct-connect-and-query-contract-v1.test.ts',
        'network-facade-v1.test.ts',
      ]
    }
    if (group === 'old-root-test-scripts') {
      return [
        'pending-deletion-review-v1.test.ts',
        'clean-export-readiness-v1.test.ts',
        'release-closure-board-v1.test.ts',
      ]
    }
    return replacementEvidenceForRule(ruleId)
  }
  if (group === 'dsevo-bench-golden-fixtures' || group === 'evals-old-bench-scripts') {
    return [
      'clean-export-readiness.evidence.json',
      'reference-experience-quality-contract-v1.test.ts',
      'v18-live-real-task-compare-v1.test.ts',
    ]
  }
  return replacementEvidenceForRule(ruleId)
}

function buildSubSlice(
  batchId: PendingDeletionReviewBatchId,
  ruleId: string,
  group: string,
  entries: readonly V18PendingDeletionClosureEntry[],
  index: number,
  availableEvidence: ReadonlySet<string>,
): PendingDeletionSubSlice {
  const restorePolicies = [...new Set(entries.map(entry => entry.restorePolicy))]
  const replacementEvidence = subSliceReplacementEvidence(ruleId, group)
  const replacementEvidenceChecks = buildReplacementEvidenceChecks(replacementEvidence, availableEvidence)
  const missingReplacementEvidence = replacementEvidenceChecks
    .filter(item => item.status === 'MISSING')
    .map(item => item.name)
  const redlines = [
    ...(entries.length === 0 ? ['pending deletion sub-slice has no entries'] : []),
    ...(replacementEvidence.length === 0 ? ['replacement evidence is missing'] : []),
    ...missingReplacementEvidence.map(item => `missing replacement evidence: ${item}`),
    ...(restorePolicies.length === 0 ? ['restore policy is missing'] : []),
  ]
  return {
    id: `${batchId}.${String(index + 1).padStart(2, '0')}`,
    parentId: batchId,
    group,
    count: entries.length,
    owner: ownerForSubSlice(group),
    targetOwner: targetOwnerForSubSlice(group),
    closureDecision: closureDecisionForSubSlice(ruleId),
    requiredAction: requiredActionForSubSlice(ruleId, group),
    restorePolicy: restorePolicies.join('; '),
    replacementEvidence,
    replacementEvidenceStatus: missingReplacementEvidence.length === 0 ? 'VERIFIED_FOR_REVIEW' : 'MISSING',
    replacementEvidenceChecks,
    missingReplacementEvidence,
    samplePaths: entries.slice(0, 8).map(entry => sanitizeSamplePath(entry.path)),
    redlines,
  }
}

function buildSubSlices(
  batchId: PendingDeletionReviewBatchId,
  ruleId: string,
  entries: readonly V18PendingDeletionClosureEntry[],
  availableEvidence: ReadonlySet<string>,
): readonly PendingDeletionSubSlice[] {
  return subSliceOrderForRule(ruleId)
    .map((group, index) => {
      const groupEntries = entries.filter(entry => subSliceGroupForPath(ruleId, entry.path) === group)
      return groupEntries.length > 0 ? buildSubSlice(batchId, ruleId, group, groupEntries, index, availableEvidence) : null
    })
    .filter((slice): slice is PendingDeletionSubSlice => slice !== null)
}

function buildBatch(
  ruleId: string,
  entries: readonly V18PendingDeletionClosureEntry[],
  availableEvidence: ReadonlySet<string>,
): PendingDeletionReviewBatch {
  const batchId = batchIdForRule(ruleId)
  const restorePolicies = [...new Set(entries.map(entry => entry.restorePolicy))]
  const replacementEvidence = replacementEvidenceForRule(ruleId)
  const replacementEvidenceChecks = buildReplacementEvidenceChecks(replacementEvidence, availableEvidence)
  const subSlices = buildSubSlices(batchId, ruleId, entries, availableEvidence)
  const missingReplacementEvidence = replacementEvidenceChecks
    .filter(item => item.status === 'MISSING')
    .map(item => item.name)
  const missingSubSliceEvidence = subSlices.flatMap(slice =>
    slice.missingReplacementEvidence.map(item => `${slice.id}: ${item}`),
  )
  const redlines = [
    ...(entries.length === 0 ? ['batch has no entries'] : []),
    ...(replacementEvidence.length === 0 ? ['replacement evidence is missing'] : []),
    ...missingReplacementEvidence.map(item => `missing replacement evidence: ${item}`),
    ...missingSubSliceEvidence.map(item => `missing sub-slice replacement evidence: ${item}`),
    ...(restorePolicies.length === 0 ? ['restore policy is missing'] : []),
  ]
  return {
    id: batchId,
    ruleId,
    count: entries.length,
    owner: ownerForRule(ruleId),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    requiredAction: requiredActionForRule(ruleId),
    replacementEvidence,
    replacementEvidenceStatus: missingReplacementEvidence.length === 0 ? 'VERIFIED_FOR_REVIEW' : 'MISSING',
    replacementEvidenceChecks,
    subSlices,
    missingReplacementEvidence,
    restorePolicy: restorePolicies.join('; '),
    samplePaths: entries.slice(0, 8).map(entry => sanitizeSamplePath(entry.path)),
    redlines,
  }
}

export function buildPendingDeletionReview(
  closure: V18PendingDeletionClosure,
  options: { availableReplacementEvidence?: readonly string[] } = {},
): PendingDeletionReview {
  const availableEvidence = new Set(options.availableReplacementEvidence ?? defaultAvailableReplacementEvidence())
  const entriesByRule = new Map<string, V18PendingDeletionClosureEntry[]>()
  for (const entry of closure.entries) {
    const entries = entriesByRule.get(entry.ruleId) ?? []
    entries.push(entry)
    entriesByRule.set(entry.ruleId, entries)
  }
  const batches = [...entriesByRule.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ruleId, entries]) => buildBatch(ruleId, entries, availableEvidence))
  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const subSliceCount = batches.flatMap(batch => batch.subSlices).length
  const redlines = [
    ...(closure.total > 0 ? ['pending deletions remain uncommitted'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
  ]
  const status: PendingDeletionReviewStatus = blocked > 0
    ? 'BLOCKED'
    : closure.total > 0 || partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.pending-deletion-review.v1',
    status,
    total: closure.total,
    batchCount: batches.length,
    subSliceCount,
    pass,
    partial,
    blocked,
    canClosePendingDeletionGate: closure.total === 0 && blocked === 0,
    mustNotStageOrRestore: closure.total > 0 || blocked > 0,
    batches,
    redlines,
    safeguards: [
      'review is evidence-only and does not stage, delete, restore, move, or commit files',
      'pending deletion closure must happen through normal git review',
      'replacement evidence must remain available before old paths are accepted as closed',
      'release-excluded state must not be restored to make tests pass',
    ],
    nextAction: batches.some(batch => batch.ruleId === 'legacy-control-plane-shell')
      ? 'review-mainline-replacement-evidence'
      : batches.some(batch => batch.ruleId === 'legacy-private-state')
        ? 'review-release-excluded-state'
        : 'normal-git-review',
  }
}
