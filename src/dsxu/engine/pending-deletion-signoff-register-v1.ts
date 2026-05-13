import type {
  OwnerGitClosureBoard,
  OwnerGitClosureSignoffItem,
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'

export type PendingDeletionSignoffDisposition =
  | 'ready-mainline-replacement-delete-review'
  | 'ready-release-excluded-delete-review'
  | 'ready-old-root-shim-delete-review'
  | 'blocked-missing-replacement-evidence'

export type PendingDeletionSignoffEntry = {
  id: string
  owner: string
  targetOwner: string
  closureDecision: string
  disposition: PendingDeletionSignoffDisposition
  status: OwnerGitClosureStatus
  pathCount: number
  replacementEvidenceStatus: 'VERIFIED_FOR_SIGNOFF' | 'MISSING'
  requiredAction: string
  restorePolicy: string
  forbiddenActions: readonly string[]
  replacementEvidence: readonly string[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type PendingDeletionSignoffReviewPacket = {
  disposition: Exclude<PendingDeletionSignoffDisposition, 'blocked-missing-replacement-evidence'>
  entryCount: number
  pathCount: number
  ids: readonly string[]
  restorePolicies: readonly string[]
  samplePaths: readonly string[]
  reviewDecision: string
  duplicateResolutionPolicy: string
  oldPathPolicy: string
  reviewAction: string
  canReduceGitStatusAfterReview: boolean
}

export type PendingDeletionReviewDecision = 'sign' | 'reject' | 'adjust'

export type PendingDeletionPacketReview = {
  disposition: Exclude<PendingDeletionSignoffDisposition, 'blocked-missing-replacement-evidence'>
  decision: PendingDeletionReviewDecision
  entryCount: number
  pathCount: number
  ids: readonly string[]
  reviewer: string
  reviewedAt: string
  notes: string
}

export type PendingDeletionReviewManifest = {
  schemaVersion: 'dsxu.pending-deletion-review-manifest.v1'
  laneId: 'OGC-02'
  decisions: readonly PendingDeletionPacketReview[]
}

export type PendingDeletionReviewManifestValidation = {
  schemaVersion: 'dsxu.pending-deletion-review-manifest-validation.v1'
  status: OwnerGitClosureStatus
  acceptedDecisions: readonly PendingDeletionPacketReview[]
  rejectedDecisions: readonly {
    index: number
    redlines: readonly string[]
  }[]
  redlines: readonly string[]
}

export type PendingDeletionSignoffRegister = {
  schemaVersion: 'dsxu.pending-deletion-signoff-register.v1'
  status: OwnerGitClosureStatus
  sourceBoardStatus: OwnerGitClosureStatus
  sourcePendingDeletionSignoffItemCount: number
  entryCount: number
  mainlineReplacementDeleteEntryCount: number
  releaseExcludedDeleteEntryCount: number
  oldRootShimDeleteEntryCount: number
  replacementEvidenceVerifiedEntryCount: number
  missingReplacementEvidenceEntryCount: number
  gitReviewRequiredCount: number
  reviewManifestStatus: 'NOT_PROVIDED' | OwnerGitClosureStatus
  signedReviewPacketCount: number
  rejectedReviewPacketCount: number
  adjustRequestedReviewPacketCount: number
  staleReviewPacketCount: number
  unsignedReviewPacketCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  canReduceGitStatusNow: boolean
  entries: readonly PendingDeletionSignoffEntry[]
  reviewPackets: readonly PendingDeletionSignoffReviewPacket[]
  gitReviewExitCriteria: readonly string[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'pending-deletion-git-review-required'
    | 'fix-missing-pending-deletion-evidence'
    | 'apply-pending-deletion-review-decisions'
    | 'pending-deletion-signoff-closed'
}

type PacketReviewState = {
  packet: PendingDeletionSignoffReviewPacket
  decision?: PendingDeletionPacketReview
  staleRedlines: readonly string[]
}

function hasMissingEvidenceRedline(redlines: readonly string[]): boolean {
  return redlines.some(redline => /missing|unknown|no entries|restore policy/i.test(redline))
}

function dispositionForItem(item: OwnerGitClosureSignoffItem): PendingDeletionSignoffDisposition {
  if (item.evidence.length === 0 || hasMissingEvidenceRedline(item.redlines)) {
    return 'blocked-missing-replacement-evidence'
  }
  if (item.decision === 'mainline-replacement-delete') return 'ready-mainline-replacement-delete-review'
  if (item.decision === 'old-root-shim-delete') return 'ready-old-root-shim-delete-review'
  return 'ready-release-excluded-delete-review'
}

function restorePolicyForItem(item: OwnerGitClosureSignoffItem): string {
  if (item.decision === 'mainline-replacement-delete') return 'do-not-restore-old-runtime-shell'
  if (item.decision === 'old-root-shim-delete') return 'do-not-restore-old-root-shim'
  return 'do-not-restore-release-excluded-state'
}

function buildEntry(item: OwnerGitClosureSignoffItem): PendingDeletionSignoffEntry {
  const disposition = dispositionForItem(item)
  const missingEvidence = disposition === 'blocked-missing-replacement-evidence'
  const redlines = [
    ...item.redlines,
    ...(item.evidence.length === 0 ? ['pending deletion replacement evidence is missing'] : []),
  ]

  return {
    id: item.id,
    owner: item.owner,
    targetOwner: item.targetOwner,
    closureDecision: item.decision,
    disposition,
    status: missingEvidence ? 'BLOCKED' : 'PARTIAL',
    pathCount: item.count,
    replacementEvidenceStatus: missingEvidence ? 'MISSING' : 'VERIFIED_FOR_SIGNOFF',
    requiredAction: item.requiredAction,
    restorePolicy: restorePolicyForItem(item),
    forbiddenActions: [
      'do not delete this entry automatically',
      'do not stage this entry automatically',
      'do not restore old paths to make the worktree look cleaner',
      'do not keep old root shims or bridge paths as runtime compatibility layers',
      'do not collapse pending deletion sub-slices into a generic cleanup bucket',
    ],
    replacementEvidence: item.evidence,
    samplePaths: item.samplePaths,
    redlines,
  }
}

function unique(input: readonly string[]): readonly string[] {
  return [...new Set(input)]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDisposition(value: unknown): value is Exclude<PendingDeletionSignoffDisposition, 'blocked-missing-replacement-evidence'> {
  return value === 'ready-mainline-replacement-delete-review' ||
    value === 'ready-release-excluded-delete-review' ||
    value === 'ready-old-root-shim-delete-review'
}

function isReviewDecision(value: unknown): value is PendingDeletionReviewDecision {
  return value === 'sign' || value === 'reject' || value === 'adjust'
}

function parsePacketReview(input: unknown, index: number): {
  decision: PendingDeletionPacketReview | null
  redlines: readonly string[]
} {
  if (!isRecord(input)) return { decision: null, redlines: [`decision ${index}: entry is not an object`] }
  const redlines: string[] = []
  const disposition = isDisposition(input.disposition) ? input.disposition : null
  const decision = isReviewDecision(input.decision) ? input.decision : null
  const entryCount = typeof input.entryCount === 'number' ? input.entryCount : NaN
  const pathCount = typeof input.pathCount === 'number' ? input.pathCount : NaN
  const ids = Array.isArray(input.ids) && input.ids.every(item => typeof item === 'string')
    ? input.ids
    : []
  const reviewer = typeof input.reviewer === 'string' ? input.reviewer : ''
  const reviewedAt = typeof input.reviewedAt === 'string' ? input.reviewedAt : ''
  const notes = typeof input.notes === 'string' ? input.notes : ''

  if (!disposition) redlines.push('missing or invalid disposition')
  if (!decision) redlines.push('missing or invalid decision')
  if (Number.isNaN(entryCount)) redlines.push('missing entryCount')
  if (Number.isNaN(pathCount)) redlines.push('missing pathCount')
  if (ids.length === 0) redlines.push('missing ids')
  if (!reviewer.trim()) redlines.push('missing reviewer')
  if (!reviewedAt.trim()) redlines.push('missing reviewedAt')
  if (!notes.trim()) redlines.push('missing notes')

  if (redlines.length > 0 || !disposition || !decision) return { decision: null, redlines }
  return {
    decision: {
      disposition,
      decision,
      entryCount,
      pathCount,
      ids,
      reviewer,
      reviewedAt,
      notes,
    },
    redlines,
  }
}

export function validatePendingDeletionReviewManifest(input: unknown): PendingDeletionReviewManifestValidation {
  const redlines: string[] = []
  if (!isRecord(input)) {
    return {
      schemaVersion: 'dsxu.pending-deletion-review-manifest-validation.v1',
      status: 'BLOCKED',
      acceptedDecisions: [],
      rejectedDecisions: [{ index: -1, redlines: ['manifest is not an object'] }],
      redlines: ['manifest is not an object'],
    }
  }
  if (input.schemaVersion !== 'dsxu.pending-deletion-review-manifest.v1') {
    redlines.push('manifest schemaVersion mismatch')
  }
  if (input.laneId !== 'OGC-02') redlines.push('manifest laneId must be OGC-02')
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  if (!Array.isArray(input.decisions)) redlines.push('manifest decisions must be an array')
  const parsed = decisions.map((item, index) => ({ index, ...parsePacketReview(item, index) }))
  const acceptedDecisions = parsed
    .map(item => item.decision)
    .filter((item): item is PendingDeletionPacketReview => item !== null)
  const rejectedDecisions = parsed
    .filter(item => item.redlines.length > 0)
    .map(item => ({ index: item.index, redlines: item.redlines }))
  const seen = new Set<PendingDeletionPacketReview['disposition']>()
  for (const decision of acceptedDecisions) {
    if (seen.has(decision.disposition)) redlines.push(`duplicate decision for disposition ${decision.disposition}`)
    seen.add(decision.disposition)
  }
  redlines.push(...rejectedDecisions.flatMap(item => item.redlines.map(line => `decision ${item.index}: ${line}`)))

  return {
    schemaVersion: 'dsxu.pending-deletion-review-manifest-validation.v1',
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    acceptedDecisions,
    rejectedDecisions,
    redlines,
  }
}

function buildReviewPackets(entries: readonly PendingDeletionSignoffEntry[]): readonly PendingDeletionSignoffReviewPacket[] {
  const dispositions: readonly Exclude<PendingDeletionSignoffDisposition, 'blocked-missing-replacement-evidence'>[] = [
    'ready-mainline-replacement-delete-review',
    'ready-release-excluded-delete-review',
    'ready-old-root-shim-delete-review',
  ]

  return dispositions.flatMap(disposition => {
    const packetEntries = entries.filter(entry => entry.disposition === disposition)
    if (packetEntries.length === 0) return []
    return [{
      disposition,
      entryCount: packetEntries.length,
      pathCount: packetEntries.reduce((sum, entry) => sum + entry.pathCount, 0),
      ids: packetEntries.map(entry => entry.id),
      restorePolicies: unique(packetEntries.map(entry => entry.restorePolicy)),
      samplePaths: unique(packetEntries.flatMap(entry => entry.samplePaths)).slice(0, 12),
      reviewDecision: disposition === 'ready-mainline-replacement-delete-review'
        ? 'mainline replacement evidence is verified; deletion state waits for normal Git review'
        : disposition === 'ready-old-root-shim-delete-review'
          ? 'old root shim replacement is verified; keep shim deleted unless owner review proves a distinct current entrypoint'
          : 'release-excluded evidence is verified; keep excluded material out of product runtime and release/export payloads',
      duplicateResolutionPolicy: disposition === 'ready-release-excluded-delete-review'
        ? 'do not merge release-excluded private/history/eval material into product runtime; only retain external evidence records'
        : 'equivalent behavior must be owned by the named current mainline replacement; deleted legacy shells are not compatibility paths',
      oldPathPolicy: disposition === 'ready-old-root-shim-delete-review'
        ? 'old root launchers, proxy shims, and root test scripts must not return as alternate runtime surfaces'
        : disposition === 'ready-mainline-replacement-delete-review'
          ? 'legacy control-plane and bridge shells must not be restored after replacement evidence is verified'
          : 'release-excluded paths must not be restored into clean export, release payload, or product runtime',
      reviewAction: disposition === 'ready-mainline-replacement-delete-review'
        ? 'verify current mainline replacement evidence, then close deletion state through Git review'
        : disposition === 'ready-old-root-shim-delete-review'
          ? 'confirm old root shim replacement and keep shim deleted through Git review'
          : 'confirm release-excluded artifact policy and keep excluded state out of product runtime',
      canReduceGitStatusAfterReview: true,
    }]
  })
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const leftSorted = [...left].sort()
  const rightSorted = [...right].sort()
  return leftSorted.length === rightSorted.length &&
    leftSorted.every((item, index) => item === rightSorted[index])
}

function buildPacketReviewStates(
  packets: readonly PendingDeletionSignoffReviewPacket[],
  manifest?: PendingDeletionReviewManifestValidation,
): readonly PacketReviewState[] {
  return packets.map(packet => {
    const decision = manifest?.acceptedDecisions.find(item => item.disposition === packet.disposition)
    const staleRedlines = decision
      ? [
        ...(decision.entryCount !== packet.entryCount
          ? [`${packet.disposition}: signed entryCount ${decision.entryCount} does not match current ${packet.entryCount}`]
          : []),
        ...(decision.pathCount !== packet.pathCount
          ? [`${packet.disposition}: signed pathCount ${decision.pathCount} does not match current ${packet.pathCount}`]
          : []),
        ...(!sameIds(decision.ids, packet.ids)
          ? [`${packet.disposition}: signed ids do not match current packet ids`]
          : []),
      ]
      : []
    return { packet, decision, staleRedlines }
  })
}

export function buildPendingDeletionSignoffRegister(
  board: OwnerGitClosureBoard,
  options: {
    reviewManifest?: PendingDeletionReviewManifestValidation
  } = {},
): PendingDeletionSignoffRegister {
  const entries = board.signoffItems
    .filter(item => item.laneId === 'OGC-02')
    .map(buildEntry)
  const missingReplacementEvidenceEntryCount = entries
    .filter(entry => entry.replacementEvidenceStatus === 'MISSING').length
  const reviewPackets = buildReviewPackets(entries)
  const packetReviewStates = buildPacketReviewStates(reviewPackets, options.reviewManifest)
  const signedReviewPacketCount = packetReviewStates
    .filter(item => item.decision?.decision === 'sign' && item.staleRedlines.length === 0).length
  const rejectedReviewPacketCount = packetReviewStates
    .filter(item => item.decision?.decision === 'reject').length
  const adjustRequestedReviewPacketCount = packetReviewStates
    .filter(item => item.decision?.decision === 'adjust').length
  const staleReviewPacketCount = packetReviewStates
    .filter(item => item.staleRedlines.length > 0).length
  const unsignedReviewPacketCount = packetReviewStates
    .filter(item => !item.decision).length
  const blockers = [
    ...(missingReplacementEvidenceEntryCount > 0 ? ['pending deletion entries have missing replacement evidence'] : []),
    ...(options.reviewManifest?.status === 'BLOCKED'
      ? options.reviewManifest.redlines.map(redline => `pending deletion review manifest: ${redline}`)
      : []),
    ...packetReviewStates.flatMap(item => item.staleRedlines),
    ...(rejectedReviewPacketCount > 0 ? ['pending deletion review rejected one or more OGC-02 packets'] : []),
    ...(adjustRequestedReviewPacketCount > 0 ? ['pending deletion review requested adjustment for one or more OGC-02 packets'] : []),
  ]
  const allPacketsSigned = reviewPackets.length > 0 &&
    signedReviewPacketCount === reviewPackets.length &&
    unsignedReviewPacketCount === 0 &&
    staleReviewPacketCount === 0
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : allPacketsSigned || entries.length === 0
      ? 'PASS'
      : entries.length > 0
      ? 'PARTIAL'
      : 'PASS'
  const gitReviewRequiredCount = status === 'PASS'
    ? 0
    : packetReviewStates
      .filter(item => item.decision?.decision !== 'sign' || item.staleRedlines.length > 0)
      .reduce((sum, item) => sum + item.packet.entryCount, 0)

  return {
    schemaVersion: 'dsxu.pending-deletion-signoff-register.v1',
    status,
    sourceBoardStatus: board.status,
    sourcePendingDeletionSignoffItemCount: board.pendingDeletionSignoffItemCount,
    entryCount: entries.length,
    mainlineReplacementDeleteEntryCount: entries
      .filter(entry => entry.disposition === 'ready-mainline-replacement-delete-review').length,
    releaseExcludedDeleteEntryCount: entries
      .filter(entry => entry.disposition === 'ready-release-excluded-delete-review').length,
    oldRootShimDeleteEntryCount: entries
      .filter(entry => entry.disposition === 'ready-old-root-shim-delete-review').length,
    replacementEvidenceVerifiedEntryCount: entries
      .filter(entry => entry.replacementEvidenceStatus === 'VERIFIED_FOR_SIGNOFF').length,
    missingReplacementEvidenceEntryCount,
    gitReviewRequiredCount,
    reviewManifestStatus: options.reviewManifest?.status ?? 'NOT_PROVIDED',
    signedReviewPacketCount,
    rejectedReviewPacketCount,
    adjustRequestedReviewPacketCount,
    staleReviewPacketCount,
    unsignedReviewPacketCount,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreReset: status !== 'PASS',
    canReduceGitStatusNow: status === 'PASS',
    entries,
    reviewPackets,
    gitReviewExitCriteria: [
      'every pending deletion entry has verified replacement evidence',
      'normal Git review closes deletion-state files; automation does not delete or stage them',
      'old root shims, bridge paths, proxy shims, and release-excluded artifacts are not restored as compatibility runtimes',
      'review closure may reduce git status only after the deletion lane is explicitly signed off',
    ],
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'pending deletion entries require normal Git review even when replacement evidence is verified',
      'release-excluded state must not be restored to make tests pass',
      'old bridge, proxy, and root shim paths must not be kept as compatibility runtimes',
      'owner-specific pending deletion sub-slices must stay separate until review closure',
    ],
    nextAction: blockers.length > 0
      ? missingReplacementEvidenceEntryCount > 0 || options.reviewManifest?.status === 'BLOCKED' || staleReviewPacketCount > 0
        ? 'fix-missing-pending-deletion-evidence'
        : 'apply-pending-deletion-review-decisions'
      : entries.length > 0
        ? status === 'PASS' ? 'pending-deletion-signoff-closed' : 'pending-deletion-git-review-required'
        : 'pending-deletion-signoff-closed',
  }
}
