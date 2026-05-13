import type {
  OwnerGitClosureBoard,
  OwnerGitClosureSignoffItem,
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'

export type OwnerGitSignoffDisposition =
  | 'ready-mainline-owner-signoff'
  | 'ready-replace-delete-review'
  | 'blocked-missing-evidence'

export type OwnerGitSignoffEntry = {
  id: string
  owner: string
  targetOwner: string
  decision: string
  disposition: OwnerGitSignoffDisposition
  status: OwnerGitClosureStatus
  pathCount: number
  evidenceStatus: 'VERIFIED_FOR_SIGNOFF' | 'MISSING'
  requiredAction: string
  forbiddenActions: readonly string[]
  evidence: readonly string[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type OwnerGitSignoffReviewPacket = {
  disposition: Exclude<OwnerGitSignoffDisposition, 'blocked-missing-evidence'>
  entryCount: number
  pathCount: number
  ids: readonly string[]
  targetOwners: readonly string[]
  samplePaths: readonly string[]
  reviewDecision: string
  duplicateResolutionPolicy: string
  oldPathPolicy: string
  reviewAction: string
  canReduceGitStatusAfterReview: boolean
}

export type OwnerGitSignoffReviewDecision = 'sign' | 'reject' | 'adjust'

export type OwnerGitSignoffPacketReview = {
  disposition: Exclude<OwnerGitSignoffDisposition, 'blocked-missing-evidence'>
  decision: OwnerGitSignoffReviewDecision
  entryCount: number
  pathCount: number
  ids: readonly string[]
  reviewer: string
  reviewedAt: string
  notes: string
}

export type OwnerGitSignoffReviewManifest = {
  schemaVersion: 'dsxu.owner-git-signoff-review-manifest.v1'
  laneId: 'OGC-01'
  decisions: readonly OwnerGitSignoffPacketReview[]
}

export type OwnerGitSignoffReviewManifestValidation = {
  schemaVersion: 'dsxu.owner-git-signoff-review-manifest-validation.v1'
  status: OwnerGitClosureStatus
  acceptedDecisions: readonly OwnerGitSignoffPacketReview[]
  rejectedDecisions: readonly {
    index: number
    redlines: readonly string[]
  }[]
  redlines: readonly string[]
}

export type OwnerGitSignoffRegister = {
  schemaVersion: 'dsxu.owner-git-signoff-register.v1'
  status: OwnerGitClosureStatus
  sourceBoardStatus: OwnerGitClosureStatus
  sourceDirtyTotal: number
  entryCount: number
  mainlineKeepEntryCount: number
  replaceDeleteEntryCount: number
  evidenceVerifiedEntryCount: number
  missingEvidenceEntryCount: number
  ownerSignoffRequiredCount: number
  reviewManifestStatus: 'NOT_PROVIDED' | OwnerGitClosureStatus
  signedReviewPacketCount: number
  rejectedReviewPacketCount: number
  adjustRequestedReviewPacketCount: number
  staleReviewPacketCount: number
  unsignedReviewPacketCount: number
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreReset: boolean
  canReduceGitStatusNow: boolean
  entries: readonly OwnerGitSignoffEntry[]
  reviewPackets: readonly OwnerGitSignoffReviewPacket[]
  gitReviewExitCriteria: readonly string[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'owner-signoff-required'
    | 'fix-missing-signoff-evidence'
    | 'apply-owner-review-decisions'
    | 'mainline-owner-signoff-closed'
}

type PacketReviewState = {
  packet: OwnerGitSignoffReviewPacket
  decision?: OwnerGitSignoffPacketReview
  staleRedlines: readonly string[]
}

function hasMissingEvidenceRedline(redlines: readonly string[]): boolean {
  return redlines.some(redline => /missing|unknown|no entries/i.test(redline))
}

function dispositionForItem(item: OwnerGitClosureSignoffItem): OwnerGitSignoffDisposition {
  if (item.evidence.length === 0 || hasMissingEvidenceRedline(item.redlines)) {
    return 'blocked-missing-evidence'
  }
  if (item.decision.includes('replace-delete')) return 'ready-replace-delete-review'
  return 'ready-mainline-owner-signoff'
}

function buildEntry(item: OwnerGitClosureSignoffItem): OwnerGitSignoffEntry {
  const disposition = dispositionForItem(item)
  const missingEvidence = disposition === 'blocked-missing-evidence'
  const redlines = [
    ...item.redlines,
    ...(item.evidence.length === 0 ? ['signoff evidence is missing'] : []),
  ]

  return {
    id: item.id,
    owner: item.owner,
    targetOwner: item.targetOwner,
    decision: item.decision,
    disposition,
    status: missingEvidence ? 'BLOCKED' : 'PARTIAL',
    pathCount: item.count,
    evidenceStatus: missingEvidence ? 'MISSING' : 'VERIFIED_FOR_SIGNOFF',
    requiredAction: item.requiredAction,
    forbiddenActions: [
      'do not stage this entry automatically',
      'do not restore old paths to reduce dirty count',
      'do not keep replace/delete candidates as compatibility runtime paths',
      'do not collapse owner-specific entries into a generic cleanup bucket',
    ],
    evidence: item.evidence,
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

function isDisposition(value: unknown): value is Exclude<OwnerGitSignoffDisposition, 'blocked-missing-evidence'> {
  return value === 'ready-mainline-owner-signoff' || value === 'ready-replace-delete-review'
}

function isReviewDecision(value: unknown): value is OwnerGitSignoffReviewDecision {
  return value === 'sign' || value === 'reject' || value === 'adjust'
}

function parsePacketReview(input: unknown, index: number): {
  decision: OwnerGitSignoffPacketReview | null
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

export function validateOwnerGitSignoffReviewManifest(
  input: unknown,
): OwnerGitSignoffReviewManifestValidation {
  const redlines: string[] = []
  if (!isRecord(input)) {
    return {
      schemaVersion: 'dsxu.owner-git-signoff-review-manifest-validation.v1',
      status: 'BLOCKED',
      acceptedDecisions: [],
      rejectedDecisions: [{ index: -1, redlines: ['manifest is not an object'] }],
      redlines: ['manifest is not an object'],
    }
  }
  if (input.schemaVersion !== 'dsxu.owner-git-signoff-review-manifest.v1') {
    redlines.push('manifest schemaVersion mismatch')
  }
  if (input.laneId !== 'OGC-01') redlines.push('manifest laneId must be OGC-01')
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  if (!Array.isArray(input.decisions)) redlines.push('manifest decisions must be an array')
  const parsed = decisions.map((item, index) => ({ index, ...parsePacketReview(item, index) }))
  const acceptedDecisions = parsed
    .map(item => item.decision)
    .filter((item): item is OwnerGitSignoffPacketReview => item !== null)
  const rejectedDecisions = parsed
    .filter(item => item.redlines.length > 0)
    .map(item => ({ index: item.index, redlines: item.redlines }))
  const seen = new Set<OwnerGitSignoffPacketReview['disposition']>()
  for (const decision of acceptedDecisions) {
    if (seen.has(decision.disposition)) redlines.push(`duplicate decision for disposition ${decision.disposition}`)
    seen.add(decision.disposition)
  }
  redlines.push(...rejectedDecisions.flatMap(item => item.redlines.map(line => `decision ${item.index}: ${line}`)))

  return {
    schemaVersion: 'dsxu.owner-git-signoff-review-manifest-validation.v1',
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    acceptedDecisions,
    rejectedDecisions,
    redlines,
  }
}

function buildReviewPackets(entries: readonly OwnerGitSignoffEntry[]): readonly OwnerGitSignoffReviewPacket[] {
  const dispositions: readonly Exclude<OwnerGitSignoffDisposition, 'blocked-missing-evidence'>[] = [
    'ready-mainline-owner-signoff',
    'ready-replace-delete-review',
  ]

  return dispositions.flatMap(disposition => {
    const packetEntries = entries.filter(entry => entry.disposition === disposition)
    if (packetEntries.length === 0) return []
    return [{
      disposition,
      entryCount: packetEntries.length,
      pathCount: packetEntries.reduce((sum, entry) => sum + entry.pathCount, 0),
      ids: packetEntries.map(entry => entry.id),
      targetOwners: unique(packetEntries.map(entry => entry.targetOwner)),
      samplePaths: unique(packetEntries.flatMap(entry => entry.samplePaths)).slice(0, 12),
      reviewDecision: disposition === 'ready-mainline-owner-signoff'
        ? 'keep only after named mainline owner signoff confirms the paths belong to the target owner'
        : 'treat as replace/delete unless owner review proves distinct mainline behavior that must be absorbed',
      duplicateResolutionPolicy: disposition === 'ready-mainline-owner-signoff'
        ? 'do not keep a duplicate runtime or owner path; equivalent behavior must remain in the named original owner'
        : 'merge equivalent behavior into the original owner, then close the duplicate or old source through normal Git review',
      oldPathPolicy: disposition === 'ready-mainline-owner-signoff'
        ? 'no old compatibility path may be restored only to lower dirty count'
        : 'old paths stay replace/delete candidates; do not restore them as compatibility runtime, provider, MCP, skill, or tool surfaces',
      reviewAction: disposition === 'ready-mainline-owner-signoff'
        ? 'owner signs mainline keep slices; keep only named mainline owners'
        : 'owner reviews replace/delete candidates; merge equivalent behavior into original owner or close candidate through Git review',
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
  packets: readonly OwnerGitSignoffReviewPacket[],
  manifest?: OwnerGitSignoffReviewManifestValidation,
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

export function buildOwnerGitSignoffRegister(
  board: OwnerGitClosureBoard,
  options: {
    reviewManifest?: OwnerGitSignoffReviewManifestValidation
  } = {},
): OwnerGitSignoffRegister {
  const entries = board.signoffItems
    .filter(item => item.laneId === 'OGC-01')
    .map(buildEntry)
  const missingEvidenceEntryCount = entries.filter(entry => entry.evidenceStatus === 'MISSING').length
  const replaceDeleteEntryCount = entries.filter(entry => entry.disposition === 'ready-replace-delete-review').length
  const mainlineKeepEntryCount = entries.filter(entry => entry.disposition === 'ready-mainline-owner-signoff').length
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
    ...(missingEvidenceEntryCount > 0 ? ['owner signoff entries have missing evidence'] : []),
    ...(options.reviewManifest?.status === 'BLOCKED'
      ? options.reviewManifest.redlines.map(redline => `owner review manifest: ${redline}`)
      : []),
    ...packetReviewStates.flatMap(item => item.staleRedlines),
    ...(rejectedReviewPacketCount > 0 ? ['owner review rejected one or more OGC-01 packets'] : []),
    ...(adjustRequestedReviewPacketCount > 0 ? ['owner review requested adjustment for one or more OGC-01 packets'] : []),
  ]
  const allPacketsSigned = reviewPackets.length > 0 &&
    signedReviewPacketCount === reviewPackets.length &&
    unsignedReviewPacketCount === 0 &&
    staleReviewPacketCount === 0
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : allPacketsSigned || (entries.length === 0 && board.dirtySummary.total === 0)
      ? 'PASS'
      : entries.length > 0 || board.dirtySummary.total > 0
      ? 'PARTIAL'
      : 'PASS'
  const ownerSignoffRequiredCount = status === 'PASS'
    ? 0
    : packetReviewStates
      .filter(item => item.decision?.decision !== 'sign' || item.staleRedlines.length > 0)
      .reduce((sum, item) => sum + item.packet.entryCount, 0)

  return {
    schemaVersion: 'dsxu.owner-git-signoff-register.v1',
    status,
    sourceBoardStatus: board.status,
    sourceDirtyTotal: board.dirtySummary.total,
    entryCount: entries.length,
    mainlineKeepEntryCount,
    replaceDeleteEntryCount,
    evidenceVerifiedEntryCount: entries.filter(entry => entry.evidenceStatus === 'VERIFIED_FOR_SIGNOFF').length,
    missingEvidenceEntryCount,
    ownerSignoffRequiredCount,
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
      'every mainline keep entry has a named owner signoff',
      'every replace/delete candidate is either merged into the original owner or closed through normal Git review',
      'no entry is restored only to reduce dirty count',
      'no compatibility runtime path remains as a holding pattern',
      'review closure may reduce git status only after owner signoff is explicit',
    ],
    blockers,
    safeguards: [
      'register is evidence-only and does not stage, delete, restore, reset, move, commit, or export files',
      'mainline keep entries require owner signoff even when evidence is verified',
      'replace/delete candidates require normal Git review and must not be restored as runtime compatibility paths',
      'owner-specific decisions must stay separate; generic cleanup is not an acceptable closure state',
    ],
    nextAction: blockers.length > 0
      ? missingEvidenceEntryCount > 0 || options.reviewManifest?.status === 'BLOCKED' || staleReviewPacketCount > 0
        ? 'fix-missing-signoff-evidence'
        : 'apply-owner-review-decisions'
      : entries.length > 0 || board.dirtySummary.total > 0
        ? status === 'PASS' ? 'mainline-owner-signoff-closed' : 'owner-signoff-required'
        : 'mainline-owner-signoff-closed',
  }
}
