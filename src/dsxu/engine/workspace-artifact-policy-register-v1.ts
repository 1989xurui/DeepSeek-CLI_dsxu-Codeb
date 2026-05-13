import type {
  OwnerGitClosureBoard,
  OwnerGitClosureStatus,
} from './owner-git-closure-board-v1'

export type WorkspaceArtifactPolicyEntryKind =
  | 'local-vcs-store'
  | 'local-dependency-cache'
  | 'evidence-store'
  | 'owner-review-surface'
  | 'pending-deletion-surface'
  | 'permission-external-closure'

export type WorkspaceArtifactPolicyEntry = {
  id: string
  kind: WorkspaceArtifactPolicyEntryKind
  owner: string
  status: OwnerGitClosureStatus
  count: number
  releasePolicy: 'exclude-from-release-export' | 'owner-review-required' | 'git-review-required' | 'external-permission-closure'
  sourcePolicy: 'keep-local' | 'review-before-keep' | 'review-before-delete' | 'external-closure-only'
  requiredAction: string
  forbiddenActions: readonly string[]
  evidenceRequired: readonly string[]
  redlines: readonly string[]
}

export type WorkspacePermissionResidueClosureDecision = 'sign' | 'reject' | 'adjust'

export type WorkspacePermissionResidueClosure = {
  residueId: string
  sourcePath: string
  decision: WorkspacePermissionResidueClosureDecision
  reviewer: string
  reviewedAt: string
  notes: string
}

export type WorkspacePermissionResidueClosureManifest = {
  schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest.v1'
  laneId: 'OGC-05'
  decisions: readonly WorkspacePermissionResidueClosure[]
}

export type WorkspacePermissionResidueClosureManifestValidation = {
  schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest-validation.v1'
  status: OwnerGitClosureStatus
  acceptedDecisions: readonly WorkspacePermissionResidueClosure[]
  rejectedDecisions: readonly {
    index: number
    redlines: readonly string[]
  }[]
  redlines: readonly string[]
}

export type WorkspaceArtifactPolicyRegister = {
  schemaVersion: 'dsxu.workspace-artifact-policy-register.v1'
  status: OwnerGitClosureStatus
  sourceBoardStatus: OwnerGitClosureStatus
  entryCount: number
  localArtifactEntryCount: number
  ownerReviewEntryCount: number
  pendingDeletionEntryCount: number
  permissionExternalClosureEntryCount: number
  permissionResidueClosureManifestStatus: 'NOT_PROVIDED' | OwnerGitClosureStatus
  permissionResidueSignedCount: number
  permissionResidueRejectedCount: number
  permissionResidueAdjustRequestedCount: number
  permissionResidueStaleCount: number
  permissionResidueUnsignedCount: number
  releaseExcludedEntryCount: number
  unresolvedWorkspacePolicyCount: number
  boardAuthorizesMutation: false
  mustNotCleanOrDelete: boolean
  entries: readonly WorkspaceArtifactPolicyEntry[]
  blockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'workspace-owner-review-required'
    | 'fix-unresolved-workspace-policy'
    | 'workspace-artifact-policy-closed'
}

export const WORKSPACE_PERMISSION_BLOCKED_RESIDUES = [
  {
    residueId: 'source-permission-blocked-dsevo',
    sourcePath: 'D:\\DSXU-code\\非dsxu-code项目文件\\.dsevo',
  },
  {
    residueId: 'source-permission-blocked-mainline-cleanup-sidecars',
    sourcePath: 'D:\\DSXU-code\\非dsxu-code项目文件\\mainline-cleanup-20260430-v3-sidecars',
  },
  {
    residueId: 'source-permission-blocked-v18-history',
    sourcePath: 'D:\\DSXU-code\\非dsxu-code项目文件\\v18-cleanup-20260507-dsxu-history',
  },
  {
    residueId: 'source-permission-blocked-old-128k',
    sourcePath: 'D:\\DSXU-code\\非dsxu-code项目文件\\旧的128K',
  },
  {
    residueId: 'source-permission-blocked-isolation-root',
    sourcePath: 'D:\\DSXU-code\\隔离处理',
  },
] as const

function laneCount(board: OwnerGitClosureBoard, key: string): number {
  const lane = board.lanes.find(item => item.id === 'OGC-05')
  const value = lane?.currentEvidence
    .find(item => item.startsWith(`${key}=`))
    ?.replace(`${key}=`, '')
    .trim()
  return value ? Number(value) : 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDecision(value: unknown): value is WorkspacePermissionResidueClosureDecision {
  return value === 'sign' || value === 'reject' || value === 'adjust'
}

function parsePermissionResidueClosure(input: unknown, index: number): {
  decision: WorkspacePermissionResidueClosure | null
  redlines: readonly string[]
} {
  if (!isRecord(input)) return { decision: null, redlines: [`decision ${index}: entry is not an object`] }
  const redlines: string[] = []
  const residueId = typeof input.residueId === 'string' ? input.residueId : ''
  const sourcePath = typeof input.sourcePath === 'string' ? input.sourcePath : ''
  const decision = isDecision(input.decision) ? input.decision : null
  const reviewer = typeof input.reviewer === 'string' ? input.reviewer : ''
  const reviewedAt = typeof input.reviewedAt === 'string' ? input.reviewedAt : ''
  const notes = typeof input.notes === 'string' ? input.notes : ''

  if (!residueId.trim()) redlines.push('missing residueId')
  if (!sourcePath.trim()) redlines.push('missing sourcePath')
  if (!decision) redlines.push('missing or invalid decision')
  if (!reviewer.trim()) redlines.push('missing reviewer')
  if (!reviewedAt.trim()) redlines.push('missing reviewedAt')
  if (!notes.trim()) redlines.push('missing notes')
  if (redlines.length > 0 || !decision) return { decision: null, redlines }
  return {
    decision: {
      residueId,
      sourcePath,
      decision,
      reviewer,
      reviewedAt,
      notes,
    },
    redlines,
  }
}

export function validateWorkspacePermissionResidueClosureManifest(
  input: unknown,
): WorkspacePermissionResidueClosureManifestValidation {
  const redlines: string[] = []
  if (!isRecord(input)) {
    return {
      schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest-validation.v1',
      status: 'BLOCKED',
      acceptedDecisions: [],
      rejectedDecisions: [{ index: -1, redlines: ['manifest is not an object'] }],
      redlines: ['manifest is not an object'],
    }
  }
  if (input.schemaVersion !== 'dsxu.workspace-permission-residue-closure-manifest.v1') {
    redlines.push('manifest schemaVersion mismatch')
  }
  if (input.laneId !== 'OGC-05') redlines.push('manifest laneId must be OGC-05')
  const decisions = Array.isArray(input.decisions) ? input.decisions : []
  if (!Array.isArray(input.decisions)) redlines.push('manifest decisions must be an array')
  const parsed = decisions.map((item, index) => ({ index, ...parsePermissionResidueClosure(item, index) }))
  const acceptedDecisions = parsed
    .map(item => item.decision)
    .filter((item): item is WorkspacePermissionResidueClosure => item !== null)
  const rejectedDecisions = parsed
    .filter(item => item.redlines.length > 0)
    .map(item => ({ index: item.index, redlines: item.redlines }))
  const seen = new Set<string>()
  for (const decision of acceptedDecisions) {
    if (seen.has(decision.residueId)) redlines.push(`duplicate decision for residue ${decision.residueId}`)
    seen.add(decision.residueId)
  }
  redlines.push(...rejectedDecisions.flatMap(item => item.redlines.map(line => `decision ${item.index}: ${line}`)))

  return {
    schemaVersion: 'dsxu.workspace-permission-residue-closure-manifest-validation.v1',
    status: redlines.length > 0 ? 'BLOCKED' : 'PASS',
    acceptedDecisions,
    rejectedDecisions,
    redlines,
  }
}

function buildStaticLocalEntries(): WorkspaceArtifactPolicyEntry[] {
  return [
    {
      id: 'workspace.git-store',
      kind: 'local-vcs-store',
      owner: 'Git / Workspace Local State',
      status: 'PASS',
      count: 1,
      releasePolicy: 'exclude-from-release-export',
      sourcePolicy: 'keep-local',
      requiredAction: 'keep .git as local repository state; do not treat it as source cleanup or release payload',
      forbiddenActions: [
        'do not delete .git during source cleanup',
        'do not include .git in clean export',
        'do not use git history size as source dirty closure',
      ],
      evidenceRequired: ['release exclusion policy', 'clean export ignore evidence'],
      redlines: [],
    },
    {
      id: 'workspace.node-modules',
      kind: 'local-dependency-cache',
      owner: 'Local Test / Build Dependency Cache',
      status: 'PASS',
      count: 1,
      releasePolicy: 'exclude-from-release-export',
      sourcePolicy: 'keep-local',
      requiredAction: 'keep node_modules for local tests and builds while excluding it from release/export',
      forbiddenActions: [
        'do not classify node_modules as source code',
        'do not include node_modules in clean export',
        'do not delete local dependencies as evidence closure',
      ],
      evidenceRequired: ['release exclusion policy', 'local test dependency note'],
      redlines: [],
    },
    {
      id: 'workspace.dsxu-evidence',
      kind: 'evidence-store',
      owner: 'DSXU Evidence Store',
      status: 'PASS',
      count: 1,
      releasePolicy: 'exclude-from-release-export',
      sourcePolicy: 'keep-local',
      requiredAction: 'keep .dsxu as evidence store while excluding it from release/export; trace/runs may be referenced by reports and tests',
      forbiddenActions: [
        'do not move .dsxu wholesale while reports reference it',
        'do not include .dsxu in release/export',
        'do not delete evidence directories during closure automation',
      ],
      evidenceRequired: ['trace references', 'release exclusion policy', 'report references'],
      redlines: [],
    },
  ]
}

export function buildWorkspaceArtifactPolicyRegister(
  board: OwnerGitClosureBoard,
  options: {
    permissionResidueClosureManifest?: WorkspacePermissionResidueClosureManifestValidation
  } = {},
): WorkspaceArtifactPolicyRegister {
  const untrackedCount = laneCount(board, 'untrackedCount')
  const deletedCount = laneCount(board, 'deletedCount')
  const permissionBlockedResidualCount = laneCount(board, 'permissionBlockedResidualCount')
  const expectedResidues = WORKSPACE_PERMISSION_BLOCKED_RESIDUES.slice(0, permissionBlockedResidualCount)
  const permissionClosureStates = expectedResidues.map(residue => {
    const decision = options.permissionResidueClosureManifest?.acceptedDecisions
      .find(item => item.residueId === residue.residueId)
    const staleRedlines = decision
      ? [
          ...(decision.sourcePath !== residue.sourcePath
            ? [`${residue.residueId}: signed sourcePath does not match current residue path`]
            : []),
        ]
      : []
    return { residue, decision, staleRedlines }
  })
  const permissionResidueSignedCount = permissionClosureStates
    .filter(item => item.decision?.decision === 'sign' && item.staleRedlines.length === 0).length
  const permissionResidueRejectedCount = permissionClosureStates
    .filter(item => item.decision?.decision === 'reject').length
  const permissionResidueAdjustRequestedCount = permissionClosureStates
    .filter(item => item.decision?.decision === 'adjust').length
  const permissionResidueStaleCount = permissionClosureStates
    .filter(item => item.staleRedlines.length > 0).length
  const permissionResidueUnsignedCount = permissionClosureStates
    .filter(item => !item.decision).length
  const permissionResiduesClosed = permissionBlockedResidualCount > 0 &&
    permissionResidueSignedCount === permissionBlockedResidualCount &&
    permissionResidueUnsignedCount === 0 &&
    permissionResidueStaleCount === 0 &&
    permissionResidueRejectedCount === 0 &&
    permissionResidueAdjustRequestedCount === 0
  const dynamicEntries: WorkspaceArtifactPolicyEntry[] = [
    ...(untrackedCount > 0
      ? [{
          id: 'workspace.untracked-owner-review',
          kind: 'owner-review-surface' as const,
          owner: 'Owner / Git Review',
          status: 'PARTIAL' as const,
          count: untrackedCount,
          releasePolicy: 'owner-review-required' as const,
          sourcePolicy: 'review-before-keep' as const,
          requiredAction: 'review untracked paths by real owner/use evidence before keep, merge, or ignore decision',
          forbiddenActions: [
            'do not collapse untracked paths into a generic cleanup bucket',
            'do not stage untracked paths automatically',
            'do not delete untracked paths as workspace cleanup',
          ],
          evidenceRequired: ['owner mapping', 'import/use evidence', 'release/export decision'],
          redlines: [],
        }]
      : []),
    ...(deletedCount > 0
      ? [{
          id: 'workspace.deleted-pending-review',
          kind: 'pending-deletion-surface' as const,
          owner: 'Release / Git Review',
          status: 'PARTIAL' as const,
          count: deletedCount,
          releasePolicy: 'git-review-required' as const,
          sourcePolicy: 'review-before-delete' as const,
          requiredAction: 'close tracked deletions only through normal Git review with replacement evidence',
          forbiddenActions: [
            'do not restore old paths to reduce dirty count',
            'do not delete additional paths automatically',
            'do not keep old shims as compatibility runtime',
          ],
          evidenceRequired: ['replacement evidence', 'owner signoff', 'rollback note'],
          redlines: [],
        }]
      : []),
    ...(permissionBlockedResidualCount > 0
      ? [{
          id: 'workspace.permission-blocked-residues',
          kind: 'permission-external-closure' as const,
          owner: 'External Permission / Ownership Closure',
          status: permissionResiduesClosed ? 'PASS' as const : 'PARTIAL' as const,
          count: permissionBlockedResidualCount,
          releasePolicy: 'external-permission-closure' as const,
          sourcePolicy: 'external-closure-only' as const,
          requiredAction: 'resolve permission-blocked residues externally; local automation cannot force ownership or deletion',
          forbiddenActions: [
            'do not force-delete permission-blocked residues',
            'do not change ownership silently',
            'do not claim clean export readiness while residues remain unresolved',
          ],
          evidenceRequired: ['external copy or record', 'permission blocker note', 'owner closure record'],
          redlines: [
            ...(options.permissionResidueClosureManifest?.status === 'BLOCKED'
              ? options.permissionResidueClosureManifest.redlines.map(redline => `permission residue closure manifest: ${redline}`)
              : []),
            ...permissionClosureStates.flatMap(item => item.staleRedlines),
            ...(permissionResidueRejectedCount > 0 ? ['permission residue closure rejected one or more residues'] : []),
            ...(permissionResidueAdjustRequestedCount > 0 ? ['permission residue closure requested adjustment for one or more residues'] : []),
          ],
        }]
      : []),
  ]
  const entries = [...buildStaticLocalEntries(), ...dynamicEntries]
  const unresolvedWorkspacePolicyCount = entries.filter(entry => entry.redlines.length > 0).length
  const partialWorkspacePolicyCount = entries.filter(entry => entry.status === 'PARTIAL').length
  const blockers = [
    ...(unresolvedWorkspacePolicyCount > 0 ? ['workspace artifact entries have unresolved policy redlines'] : []),
  ]
  const status: OwnerGitClosureStatus = blockers.length > 0
    ? 'BLOCKED'
    : partialWorkspacePolicyCount > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.workspace-artifact-policy-register.v1',
    status,
    sourceBoardStatus: board.status,
    entryCount: entries.length,
    localArtifactEntryCount: entries.filter(entry => ['local-vcs-store', 'local-dependency-cache', 'evidence-store'].includes(entry.kind)).length,
    ownerReviewEntryCount: entries.filter(entry => entry.kind === 'owner-review-surface').length,
    pendingDeletionEntryCount: entries.filter(entry => entry.kind === 'pending-deletion-surface').length,
    permissionExternalClosureEntryCount: entries.filter(entry => entry.kind === 'permission-external-closure').length,
    permissionResidueClosureManifestStatus: options.permissionResidueClosureManifest?.status ?? 'NOT_PROVIDED',
    permissionResidueSignedCount,
    permissionResidueRejectedCount,
    permissionResidueAdjustRequestedCount,
    permissionResidueStaleCount,
    permissionResidueUnsignedCount,
    releaseExcludedEntryCount: entries.filter(entry => entry.releasePolicy === 'exclude-from-release-export').length,
    unresolvedWorkspacePolicyCount,
    boardAuthorizesMutation: false,
    mustNotCleanOrDelete: status !== 'PASS',
    entries,
    blockers,
    safeguards: [
      'register is evidence-only and does not delete, move, stage, restore, reset, chmod, chown, or export files',
      'local artifact directories are not source code and remain excluded from clean export',
      'dirty source and pending deletion paths require owner/Git review rather than cleanup automation',
      'permission-blocked residues are external closure items and cannot be solved by force cleanup',
    ],
    nextAction: blockers.length > 0
      ? 'fix-unresolved-workspace-policy'
      : partialWorkspacePolicyCount > 0
        ? 'workspace-owner-review-required'
        : 'workspace-artifact-policy-closed',
  }
}
