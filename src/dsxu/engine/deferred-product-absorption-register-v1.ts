import type {
  OwnerGitClosureBoard,
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'

export type DeferredProductId = 'PZ01' | 'PZ02' | 'PZ04' | 'PZ05' | 'PZ06' | 'PZ08'

export type DeferredProductDisposition =
  | 'defer-product-adapter-boundary'
  | 'defer-product-surface-boundary'
  | 'blocked-unknown-product-surface'

export type DeferredProductAbsorptionReviewDecision = 'defer' | 'reject' | 'adjust'

export type DeferredProductAbsorptionReview = {
  productId: string
  decision: DeferredProductAbsorptionReviewDecision
  reviewer: string
  reviewedAt: string
  mainlineOwner: string
  boundary: string
  notes: string
}

export type DeferredProductAbsorptionReviewManifest = {
  schemaVersion: 'dsxu.deferred-product-absorption-review-manifest.v1'
  laneId: 'OGC-04'
  decisions: readonly DeferredProductAbsorptionReview[]
}

export type DeferredProductAbsorptionReviewManifestValidation = {
  schemaVersion: 'dsxu.deferred-product-absorption-review-manifest-validation.v1'
  status: OwnerGitClosureStatus
  acceptedDecisions: readonly DeferredProductAbsorptionReview[]
  rejectedDecisions: readonly {
    index: number
    redlines: readonly string[]
  }[]
  redlines: readonly string[]
}

export type DeferredProductAbsorptionReviewState = {
  status: OwnerGitClosureStatus | 'NOT_PROVIDED'
  signedCount: number
  rejectedCount: number
  adjustRequestedCount: number
  staleCount: number
  unsignedCount: number
  redlines: readonly string[]
}

export type DeferredProductAbsorptionEntry = {
  id: string
  status: OwnerGitClosureStatus
  owner: string
  disposition: DeferredProductDisposition
  mainlineOwner: string
  boundary: string
  requiredAction: string
  forbiddenActions: readonly string[]
  evidenceRequired: readonly string[]
  redlines: readonly string[]
}

export type DeferredProductAbsorptionRegister = {
  schemaVersion: 'dsxu.deferred-product-absorption-register.v1'
  status: OwnerGitClosureStatus
  sourceBoardStatus: OwnerGitClosureStatus
  entryCount: number
  knownDeferredProductCount: number
  unknownDeferredProductCount: number
  adapterBoundaryCount: number
  productSurfaceBoundaryCount: number
  standaloneRuntimeCandidateCount: number
  reviewManifestStatus: OwnerGitClosureStatus | 'NOT_PROVIDED'
  reviewSignedCount: number
  reviewRejectedCount: number
  reviewAdjustRequestedCount: number
  reviewStaleCount: number
  reviewUnsignedCount: number
  boardAuthorizesMutation: false
  mustNotImplementRuntimeShortcut: boolean
  entries: readonly DeferredProductAbsorptionEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'deferred-product-owner-review-required'
    | 'fix-unknown-deferred-product-surface'
    | 'deferred-product-absorption-closed'
}

const specs: Record<DeferredProductId, Omit<DeferredProductAbsorptionEntry, 'status' | 'redlines'>> = {
  PZ01: {
    id: 'PZ01',
    owner: 'OpenClaw Adapter Owner',
    disposition: 'defer-product-adapter-boundary',
    mainlineOwner: 'Control Plane / Provider Adapter Owner',
    boundary: 'provider/control-plane adapter with hooks into existing permission, tool lifecycle, and evidence owners',
    requiredAction: 'keep OpenClaw as deferred adapter boundary until it can reuse the original provider/control-plane path',
    forbiddenActions: [
      'do not create a second executor',
      'do not bypass Permission / Tool Gate',
      'do not keep a compatibility runtime as product code',
    ],
    evidenceRequired: [
      'adapter contract',
      'permission bridge trace',
      'tool lifecycle trace',
      'evidence projection trace',
    ],
  },
  PZ02: {
    id: 'PZ02',
    owner: 'Hermes Adapter Owner',
    disposition: 'defer-product-adapter-boundary',
    mainlineOwner: 'Tool Lifecycle / Tool Adapter Contract Owner',
    boundary: 'tool adapter contract only; calls must enter the existing ToolBus lifecycle',
    requiredAction: 'keep Hermes as deferred tool adapter boundary until the main ToolBus contract owns invocation and evidence',
    forbiddenActions: [
      'do not create a second tool runtime',
      'do not create a second skill registry',
      'do not bypass ToolBus result ownership',
    ],
    evidenceRequired: [
      'tool adapter contract evidence',
      'ToolBus invocation trace',
      'skill registry resolution trace',
    ],
  },
  PZ04: {
    id: 'PZ04',
    owner: 'DesktopExecutor Owner',
    disposition: 'defer-product-surface-boundary',
    mainlineOwner: 'Control Plane + Permission + Evidence Owner',
    boundary: 'desktop/OS action surface behind the existing control-plane permission and evidence path',
    requiredAction: 'keep DesktopExecutor deferred until desktop actions are owned by control-plane permission and auditable evidence',
    forbiddenActions: [
      'do not create standalone desktop executor runtime',
      'do not hide permission prompts',
      'do not perform OS actions without visible evidence',
    ],
    evidenceRequired: [
      'control-plane permission trace',
      'visible state projection',
      'action evidence pack',
    ],
  },
  PZ05: {
    id: 'PZ05',
    owner: 'App Suite Extensions Owner',
    disposition: 'defer-product-surface-boundary',
    mainlineOwner: 'Skills + ToolBus + Control Plane Owner',
    boundary: 'application workflow templates routed through skills, ToolBus, and control-plane owners',
    requiredAction: 'absorb app suite extensions through existing skills/tool/control-plane owners only after workflow evidence exists',
    forbiddenActions: [
      'do not create app-specific runtime shells',
      'do not duplicate skill selection',
      'do not bypass tool permission or evidence recording',
    ],
    evidenceRequired: [
      'skill governance entry',
      'ToolBus trace',
      'control-plane state trace',
      'workflow final report',
    ],
  },
  PZ06: {
    id: 'PZ06',
    owner: 'VS Code Plugin / API Bridge Owner',
    disposition: 'defer-product-surface-boundary',
    mainlineOwner: 'Query Loop + Tool Lifecycle + Permission + Evidence Owner',
    boundary: 'IDE/API product entrance that reuses the same query-loop, tool lifecycle, permission, context, and evidence owners',
    requiredAction: 'design PZ06 as product entrance only; implementation must call original DSXU mainline owners',
    forbiddenActions: [
      'do not create a second query loop',
      'do not create a second permission runtime',
      'do not create an IDE-only tool executor',
      'do not fork evidence schema',
    ],
    evidenceRequired: [
      'query-loop handoff trace',
      'permission/tool lifecycle trace',
      'context source-truth trace',
      'evidence pack',
    ],
  },
  PZ08: {
    id: 'PZ08',
    owner: 'Voice/Buddy/Team/Bridge Owner',
    disposition: 'defer-product-surface-boundary',
    mainlineOwner: 'Interaction Surface + Query Loop Owner',
    boundary: 'interaction layer only; product value must be proven by better recovery, collaboration, or task success evidence',
    requiredAction: 'keep PZ08 deferred until it proves task success or recovery value through the existing query-loop/evidence path',
    forbiddenActions: [
      'do not create a second agent orchestrator',
      'do not create a team/buddy runtime outside parent synthesis',
      'do not accept collaboration UI without task-success evidence',
    ],
    evidenceRequired: [
      'task success delta',
      'recovery trace',
      'parent synthesis evidence',
      'visible state transcript',
    ],
  },
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isReviewDecision(value: unknown): value is DeferredProductAbsorptionReviewDecision {
  return value === 'defer' || value === 'reject' || value === 'adjust'
}

function parseReviewDecision(input: unknown, index: number): {
  decision: DeferredProductAbsorptionReview | null
  redlines: readonly string[]
} {
  if (!isRecord(input)) return { decision: null, redlines: [`decision ${index}: entry is not an object`] }
  const redlines: string[] = []
  const productId = typeof input.productId === 'string' ? input.productId : ''
  const decision = isReviewDecision(input.decision) ? input.decision : null
  const reviewer = typeof input.reviewer === 'string' ? input.reviewer : ''
  const reviewedAt = typeof input.reviewedAt === 'string' ? input.reviewedAt : ''
  const mainlineOwner = typeof input.mainlineOwner === 'string' ? input.mainlineOwner : ''
  const boundary = typeof input.boundary === 'string' ? input.boundary : ''
  const notes = typeof input.notes === 'string' ? input.notes : ''

  if (!productId.trim()) redlines.push('missing productId')
  if (!decision) redlines.push('missing or invalid decision')
  if (!reviewer.trim()) redlines.push('missing reviewer')
  if (!reviewedAt.trim()) redlines.push('missing reviewedAt')
  if (!mainlineOwner.trim()) redlines.push('missing mainlineOwner')
  if (!boundary.trim()) redlines.push('missing boundary')
  if (!notes.trim()) redlines.push('missing notes')
  if (redlines.length > 0 || !decision) return { decision: null, redlines }
  return {
    decision: {
      productId,
      decision,
      reviewer,
      reviewedAt,
      mainlineOwner,
      boundary,
      notes,
    },
    redlines,
  }
}

export function validateDeferredProductAbsorptionReviewManifest(
  input: unknown,
): DeferredProductAbsorptionReviewManifestValidation {
  const redlines: string[] = []
  if (!isRecord(input)) {
    return {
      schemaVersion: 'dsxu.deferred-product-absorption-review-manifest-validation.v1',
      status: 'BLOCKED',
      acceptedDecisions: [],
      rejectedDecisions: [{ index: -1, redlines: ['manifest is not an object'] }],
      redlines: ['manifest is not an object'],
    }
  }
  if (input.schemaVersion !== 'dsxu.deferred-product-absorption-review-manifest.v1') {
    redlines.push('manifest schemaVersion mismatch')
  }
  if (input.laneId !== 'OGC-04') redlines.push('manifest laneId must be OGC-04')
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  if (!Array.isArray(input.decisions)) redlines.push('manifest decisions must be an array')
  const parsed = decisions.map((item, index) => ({ index, ...parseReviewDecision(item, index) }))
  const acceptedDecisions = parsed
    .map(item => item.decision)
    .filter((item): item is DeferredProductAbsorptionReview => item !== null)
  const rejectedDecisions = parsed
    .filter(item => item.redlines.length > 0)
    .map(item => ({ index: item.index, redlines: item.redlines }))
  const seen = new Set<string>()
  for (const decision of acceptedDecisions) {
    if (seen.has(decision.productId)) redlines.push(`duplicate decision for product ${decision.productId}`)
    seen.add(decision.productId)
  }
  redlines.push(...rejectedDecisions.flatMap(item => item.redlines.map(line => `decision ${item.index}: ${line}`)))

  return {
    schemaVersion: 'dsxu.deferred-product-absorption-review-manifest-validation.v1',
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    acceptedDecisions,
    rejectedDecisions,
    redlines,
  }
}

function deferredProductIdsFromBoard(board: OwnerGitClosureBoard): readonly string[] {
  const lane = board.lanes.find(item => item.id === 'OGC-04')
  const value = lane?.currentEvidence
    .find(item => item.startsWith('deferredProductIds='))
    ?.replace('deferredProductIds=', '')
    .trim()
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function reviewRedlines(
  id: DeferredProductId,
  reviewManifest?: DeferredProductAbsorptionReviewManifestValidation,
): readonly string[] {
  const decision = reviewManifest?.acceptedDecisions.find(item => item.productId === id)
  if (!decision) return []
  const spec = specs[id]
  return [
    ...(decision.mainlineOwner !== spec.mainlineOwner
      ? [`${id}: reviewed mainlineOwner does not match current owner mapping`]
      : []),
    ...(decision.boundary !== spec.boundary
      ? [`${id}: reviewed boundary does not match current boundary mapping`]
      : []),
    ...(decision.decision === 'reject' ? [`${id}: deferred product owner review rejected this surface`] : []),
    ...(decision.decision === 'adjust' ? [`${id}: deferred product owner review requested adjustment`] : []),
  ]
}

function buildEntry(
  id: string,
  reviewManifest?: DeferredProductAbsorptionReviewManifestValidation,
): DeferredProductAbsorptionEntry {
  if (id in specs) {
    const decision = reviewManifest?.acceptedDecisions.find(item => item.productId === id)
    const redlines = reviewRedlines(id as DeferredProductId, reviewManifest)
    return {
      ...specs[id as DeferredProductId],
      status: redlines.length > 0
        ? 'BLOCKED'
        : decision?.decision === 'defer'
          ? 'PASS'
          : 'PARTIAL',
      redlines,
    }
  }

  return {
    id,
    status: 'BLOCKED',
    owner: 'Unknown Product Surface Owner',
    disposition: 'blocked-unknown-product-surface',
    mainlineOwner: 'unknown',
    boundary: 'unknown',
    requiredAction: 'map this deferred product surface to a named original-side owner before any implementation',
    forbiddenActions: [
      'do not implement unknown product surface',
      'do not create standalone runtime',
      'do not use a generic adapter bucket',
    ],
    evidenceRequired: ['owner mapping', 'mainline boundary', 'forbidden runtime review'],
    redlines: ['unknown deferred product surface'],
  }
}

export function buildDeferredProductAbsorptionReviewState(
  deferredProductIds: readonly string[],
  reviewManifest?: DeferredProductAbsorptionReviewManifestValidation,
): DeferredProductAbsorptionReviewState {
  if (!reviewManifest) {
    return {
      status: 'NOT_PROVIDED',
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      staleCount: 0,
      unsignedCount: deferredProductIds.length,
      redlines: [],
    }
  }
  if (reviewManifest.status === 'BLOCKED') {
    return {
      status: 'BLOCKED',
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      staleCount: 0,
      unsignedCount: deferredProductIds.length,
      redlines: reviewManifest.redlines,
    }
  }
  const states = deferredProductIds.map(id => {
    const decision = reviewManifest.acceptedDecisions.find(item => item.productId === id)
    const stale = id in specs
      ? reviewRedlines(id as DeferredProductId, reviewManifest)
          .some(redline => /does not match/.test(redline))
      : false
    return { id, decision, stale }
  })
  const signedCount = states.filter(item => item.decision?.decision === 'defer' && !item.stale).length
  const rejectedCount = states.filter(item => item.decision?.decision === 'reject').length
  const adjustRequestedCount = states.filter(item => item.decision?.decision === 'adjust').length
  const staleCount = states.filter(item => item.stale).length
  const unsignedCount = states.filter(item => !item.decision).length
  const redlines = [
    ...states.flatMap(item => item.id in specs
      ? reviewRedlines(item.id as DeferredProductId, reviewManifest)
      : []),
  ]
  const status = signedCount === deferredProductIds.length &&
    rejectedCount === 0 &&
    adjustRequestedCount === 0 &&
    staleCount === 0 &&
    unsignedCount === 0
    ? 'PASS'
    : rejectedCount > 0 || adjustRequestedCount > 0 || staleCount > 0
      ? 'BLOCKED'
      : 'PARTIAL'

  return {
    status,
    signedCount,
    rejectedCount,
    adjustRequestedCount,
    staleCount,
    unsignedCount,
    redlines,
  }
}

export function buildDeferredProductAbsorptionRegister(
  board: OwnerGitClosureBoard,
  options: {
    reviewManifest?: DeferredProductAbsorptionReviewManifestValidation
  } = {},
): DeferredProductAbsorptionRegister {
  const deferredProductIds = deferredProductIdsFromBoard(board)
  const entries = deferredProductIds.map(id => buildEntry(id, options.reviewManifest))
  const reviewState = buildDeferredProductAbsorptionReviewState(deferredProductIds, options.reviewManifest)
  const unknownDeferredProductCount = entries.filter(entry => entry.disposition === 'blocked-unknown-product-surface').length
  const adapterBoundaryCount = entries.filter(entry => entry.disposition === 'defer-product-adapter-boundary').length
  const productSurfaceBoundaryCount = entries.filter(entry => entry.disposition === 'defer-product-surface-boundary').length
  const standaloneRuntimeCandidateCount = entries.filter(entry => entry.redlines.some(redline => /standalone runtime|unknown/i.test(redline))).length
  const blockers = [
    ...(unknownDeferredProductCount > 0 ? ['deferred product surfaces include unknown owners'] : []),
    ...(reviewState.status === 'BLOCKED' ? reviewState.redlines : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.some(entry => entry.status === 'PARTIAL') || reviewState.status === 'PARTIAL' || reviewState.status === 'NOT_PROVIDED'
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.deferred-product-absorption-register.v1',
    status,
    sourceBoardStatus: board.status,
    entryCount: entries.length,
    knownDeferredProductCount: entries.length - unknownDeferredProductCount,
    unknownDeferredProductCount,
    adapterBoundaryCount,
    productSurfaceBoundaryCount,
    standaloneRuntimeCandidateCount,
    reviewManifestStatus: reviewState.status,
    reviewSignedCount: reviewState.signedCount,
    reviewRejectedCount: reviewState.rejectedCount,
    reviewAdjustRequestedCount: reviewState.adjustRequestedCount,
    reviewStaleCount: reviewState.staleCount,
    reviewUnsignedCount: reviewState.unsignedCount,
    boardAuthorizesMutation: false,
    mustNotImplementRuntimeShortcut: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not implement product surfaces',
      'deferred product surfaces must map to original-side owners before implementation',
      'adapter labels are boundaries only, never product runtime holding paths',
      'unknown or generic product buckets are blocked until owner mapping exists',
    ],
    nextAction: blockers.length > 0
      ? 'fix-unknown-deferred-product-surface'
      : status === 'PARTIAL'
        ? 'deferred-product-owner-review-required'
        : 'deferred-product-absorption-closed',
  }
}
