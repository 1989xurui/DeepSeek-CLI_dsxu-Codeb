import type {
  OwnerGitClosureBoard,
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'

export type DeferredProductId = 'PZ01' | 'PZ02' | 'PZ04' | 'PZ05' | 'PZ06' | 'PZ08'

export type DeferredProductDisposition =
  | 'defer-product-adapter-boundary'
  | 'defer-product-surface-boundary'
  | 'blocked-unknown-product-surface'

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

function deferredProductIdsFromBoard(board: OwnerGitClosureBoard): readonly string[] {
  const lane = board.lanes.find(item => item.id === 'OGC-04')
  const value = lane?.currentEvidence
    .find(item => item.startsWith('deferredProductIds='))
    ?.replace('deferredProductIds=', '')
    .trim()
  if (!value) return []
  return value.split(',').map(item => item.trim()).filter(Boolean)
}

function buildEntry(id: string): DeferredProductAbsorptionEntry {
  if (id in specs) {
    return {
      ...specs[id as DeferredProductId],
      status: 'PARTIAL',
      redlines: [],
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

export function buildDeferredProductAbsorptionRegister(
  board: OwnerGitClosureBoard,
): DeferredProductAbsorptionRegister {
  const entries = deferredProductIdsFromBoard(board).map(buildEntry)
  const unknownDeferredProductCount = entries.filter(entry => entry.disposition === 'blocked-unknown-product-surface').length
  const adapterBoundaryCount = entries.filter(entry => entry.disposition === 'defer-product-adapter-boundary').length
  const productSurfaceBoundaryCount = entries.filter(entry => entry.disposition === 'defer-product-surface-boundary').length
  const standaloneRuntimeCandidateCount = entries.filter(entry => entry.redlines.some(redline => /standalone runtime|unknown/i.test(redline))).length
  const blockers = [
    ...(unknownDeferredProductCount > 0 ? ['deferred product surfaces include unknown owners'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : entries.length > 0
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
      : entries.length > 0
        ? 'deferred-product-owner-review-required'
        : 'deferred-product-absorption-closed',
  }
}
