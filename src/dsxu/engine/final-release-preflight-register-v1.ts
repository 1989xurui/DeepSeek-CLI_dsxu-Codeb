import type { CleanExportReadiness, CleanExportReadinessStatus } from './clean-export-readiness-v1'
import type { OwnerGitClosureBoard, OwnerGitClosureStatus } from './owner-git-closure-board-v1'
import type { ReleaseClosureBoard, ReleaseClosureBoardStatus } from './release-closure-board-v1'

export type FinalReleasePreflightStageId =
  | 'FRP-01'
  | 'FRP-02'
  | 'FRP-03'
  | 'FRP-04'
  | 'FRP-05'
  | 'FRP-06'

export type FinalReleasePreflightStatus = OwnerGitClosureStatus

export type FinalReleasePreflightStage = {
  id: FinalReleasePreflightStageId
  name: string
  status: FinalReleasePreflightStatus
  owner: string
  requiredAction: string
  evidence: readonly string[]
  redlines: readonly string[]
}

export type FinalReleasePreflightClosureStep = {
  order: number
  stageId: FinalReleasePreflightStageId
  name: string
  status: FinalReleasePreflightStatus
  executionMeaning: string
  canReduceGitStatusAtThisStep: boolean
}

export type FinalReleasePreflightGitStatusGate = {
  currentDirtyTotal: number
  canReduceGitStatusNow: boolean
  blockedBy: readonly string[]
  allowedReductionAfter: readonly string[]
}

export type FinalReleasePreflightRegister = {
  schemaVersion: 'dsxu.final-release-preflight-register.v1'
  status: FinalReleasePreflightStatus
  planObjective: string
  executionMeaning: readonly string[]
  sourceBoardStatus: OwnerGitClosureStatus
  cleanExportStatus: CleanExportReadinessStatus
  releaseClosureStatus: ReleaseClosureBoardStatus
  stageCount: number
  pass: number
  partial: number
  blocked: number
  canRunFocusedVerification: boolean
  canRunFinalComprehensiveTests: boolean
  canCreateCleanExport: boolean
  boardAuthorizesMutation: false
  mustNotStageDeleteRestoreResetExport: boolean
  stages: readonly FinalReleasePreflightStage[]
  closureSequence: readonly FinalReleasePreflightClosureStep[]
  gitStatusReductionGate: FinalReleasePreflightGitStatusGate
  releaseBlockers: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'owner-git-review-required'
    | 'pending-deletion-review-required'
    | 'collect-target-reference-raw-logs'
    | 'deferred-product-or-workspace-review-required'
    | 'keep-focused-verification-only'
    | 'prepare-final-release-tests'
}

function releaseStatusToPreflight(status: ReleaseClosureBoardStatus): FinalReleasePreflightStatus {
  if (status === 'READY_FOR_ACTUAL_CLEANUP') return 'PASS'
  if (status === 'PRECHECK_PARTIAL') return 'PARTIAL'
  return 'BLOCKED'
}

function stageStatus(redlines: readonly string[], partial: boolean): FinalReleasePreflightStatus {
  if (redlines.length > 0) return 'BLOCKED'
  return partial ? 'PARTIAL' : 'PASS'
}

function laneStatus(board: OwnerGitClosureBoard, id: string): OwnerGitClosureStatus {
  return board.lanes.find(lane => lane.id === id)?.status ?? 'BLOCKED'
}

function laneEvidence(board: OwnerGitClosureBoard, id: string): readonly string[] {
  return board.lanes.find(lane => lane.id === id)?.currentEvidence ?? []
}

function laneRedlines(board: OwnerGitClosureBoard, id: string): readonly string[] {
  return board.lanes.find(lane => lane.id === id)?.redlines ?? ['missing OGC lane']
}

export function buildFinalReleasePreflightRegister(input: {
  board: OwnerGitClosureBoard
  cleanExport: CleanExportReadiness
  releaseClosure: ReleaseClosureBoard
}): FinalReleasePreflightRegister {
  const { board, cleanExport, releaseClosure } = input
  const ownerStatus = laneStatus(board, 'OGC-01')
  const pendingStatus = laneStatus(board, 'OGC-02')
  const rawStatus = laneStatus(board, 'OGC-03')
  const productStatus = laneStatus(board, 'OGC-04')
  const workspaceStatus = laneStatus(board, 'OGC-05')
  const releaseStatus = laneStatus(board, 'OGC-06')
  const releaseClosurePreflightStatus = releaseStatusToPreflight(releaseClosure.status)
  const rawEvidence = laneEvidence(board, 'OGC-03')
  const rawRedlines = laneRedlines(board, 'OGC-03')

  const stages: FinalReleasePreflightStage[] = [
    {
      id: 'FRP-01',
      name: 'owner and git signoff',
      status: ownerStatus,
      owner: 'Owner / Git Review',
      requiredAction: ownerStatus === 'PASS'
        ? 'owner dirty signoff is closed'
        : 'complete owner/Git signoff for mainline keep and replace/delete candidates before final tests',
      evidence: laneEvidence(board, 'OGC-01'),
      redlines: laneRedlines(board, 'OGC-01'),
    },
    {
      id: 'FRP-02',
      name: 'pending deletion review',
      status: pendingStatus,
      owner: 'Release / Git Review',
      requiredAction: pendingStatus === 'PASS'
        ? 'pending deletion review is closed'
        : 'close pending deletion entries through normal Git review with replacement evidence',
      evidence: laneEvidence(board, 'OGC-02'),
      redlines: laneRedlines(board, 'OGC-02'),
    },
    {
      id: 'FRP-03',
      name: 'raw target reference evidence',
      status: rawStatus,
      owner: 'Phase 12 / Eval Evidence',
      requiredAction: rawStatus === 'PASS'
        ? 'raw comparison evidence is complete'
        : 'collect real same-task target-reference raw logs and close original-side family backlog slots before final comparison or release claims',
      evidence: rawEvidence,
      redlines: rawRedlines,
    },
    {
      id: 'FRP-04',
      name: 'product and workspace policy',
      status: stageStatus(
        [...laneRedlines(board, 'OGC-04'), ...laneRedlines(board, 'OGC-05')],
        productStatus !== 'PASS' || workspaceStatus !== 'PASS',
      ),
      owner: 'Product Runtime Owners / Workspace Hygiene',
      requiredAction: productStatus === 'PASS' && workspaceStatus === 'PASS'
        ? 'product absorption and workspace artifact policy are closed'
        : 'finish deferred product owner review and workspace artifact policy before release closure',
      evidence: [...laneEvidence(board, 'OGC-04'), ...laneEvidence(board, 'OGC-05')],
      redlines: [...laneRedlines(board, 'OGC-04'), ...laneRedlines(board, 'OGC-05')],
    },
    {
      id: 'FRP-05',
      name: 'focused verification boundary',
      status: 'PASS',
      owner: 'Verification',
      requiredAction: 'focused verification may continue for changed evidence registers, but full final tests wait for upstream release gates',
      evidence: [
        'focused verification is allowed for local code/report changes',
        'final comprehensive tests are not a substitute for owner/raw/export closure',
      ],
      redlines: [],
    },
    {
      id: 'FRP-06',
      name: 'clean export and release closure',
      status: stageStatus(
        [
          ...cleanExport.releaseBlockers.map(blocker => `clean export: ${blocker}`),
          ...releaseClosure.releaseBlockers.map(blocker => `release closure: ${blocker}`),
          ...laneRedlines(board, 'OGC-06'),
        ],
        cleanExport.status !== 'PASS' || releaseClosurePreflightStatus !== 'PASS' || releaseStatus !== 'PASS',
      ),
      owner: 'Release',
      requiredAction: cleanExport.status === 'PASS' && releaseClosurePreflightStatus === 'PASS' && releaseStatus === 'PASS'
        ? 'prepare final comprehensive tests and clean export artifact'
        : 'keep clean export and final comprehensive tests blocked until all upstream gates are PASS',
      evidence: [
        `cleanExportStatus=${cleanExport.status}`,
        `releaseClosureStatus=${releaseClosure.status}`,
        `canCreateCleanExport=${cleanExport.canCreateCleanExport}`,
        `canPerformActualCleanup=${releaseClosure.canPerformActualCleanup}`,
      ],
      redlines: [
        ...cleanExport.releaseBlockers.map(blocker => `clean export: ${blocker}`),
        ...releaseClosure.releaseBlockers.map(blocker => `release closure: ${blocker}`),
        ...laneRedlines(board, 'OGC-06'),
      ],
    },
  ]

  const pass = stages.filter(stage => stage.status === 'PASS').length
  const partial = stages.filter(stage => stage.status === 'PARTIAL').length
  const blocked = stages.filter(stage => stage.status === 'BLOCKED').length
  const releaseBlockers = stages.flatMap(stage => stage.redlines.map(redline => `${stage.id}: ${redline}`))
  const canRunFinalComprehensiveTests = blocked === 0 && partial === 0 && cleanExport.canCreateCleanExport && releaseClosure.canPerformActualCleanup
  const status: FinalReleasePreflightStatus = blocked > 0
    ? 'BLOCKED'
    : partial > 0
      ? 'PARTIAL'
      : 'PASS'
  const gitStatusBlockedBy = [
    ...(rawStatus !== 'PASS'
      ? rawRedlines.length > 0
        ? rawRedlines.map(redline => `P12-19 raw evidence: ${redline}`)
        : ['P12-19 target-reference raw evidence is not PASS']
      : []),
    ...(ownerStatus !== 'PASS' ? ['owner/Git signoff for mainline keep and replace/delete candidates is not closed'] : []),
    ...(pendingStatus !== 'PASS' ? ['pending deletion Git review is not closed'] : []),
    ...(workspaceStatus !== 'PASS' ? ['workspace artifact policy or permission residues still require review'] : []),
    ...(releaseStatus !== 'PASS' || cleanExport.status !== 'PASS' || releaseClosurePreflightStatus !== 'PASS'
      ? ['final release and clean export gates are not closed']
      : []),
  ]
  const canReduceGitStatusNow = gitStatusBlockedBy.length === 0 && canRunFinalComprehensiveTests
  const closureSequence: FinalReleasePreflightClosureStep[] = [
    {
      order: 1,
      stageId: 'FRP-03',
      name: 'P12-19 target raw logs',
      status: rawStatus,
      executionMeaning: 'collect and import real same-task target-reference raw logs with original-side RT family coverage; templates, DSXU self-logs, generic paired logs, and dry plans do not count',
      canReduceGitStatusAtThisStep: false,
    },
    {
      order: 2,
      stageId: 'FRP-01',
      name: 'owner/Git signoff',
      status: ownerStatus,
      executionMeaning: 'sign off mainline keep owners and replace/delete candidates before any Git state reduction',
      canReduceGitStatusAtThisStep: ownerStatus === 'PASS' && rawStatus === 'PASS',
    },
    {
      order: 3,
      stageId: 'FRP-02',
      name: 'pending deletion Git review',
      status: pendingStatus,
      executionMeaning: 'close deletion-state files only through normal Git review with replacement evidence',
      canReduceGitStatusAtThisStep: pendingStatus === 'PASS' && ownerStatus === 'PASS' && rawStatus === 'PASS',
    },
    {
      order: 4,
      stageId: 'FRP-04',
      name: 'permission residue and workspace policy',
      status: stages.find(stage => stage.id === 'FRP-04')?.status ?? 'BLOCKED',
      executionMeaning: 'keep local artifacts release-excluded and resolve permission-blocked residues externally or by explicit review',
      canReduceGitStatusAtThisStep: false,
    },
    {
      order: 5,
      stageId: 'FRP-06',
      name: 'final tests and clean export',
      status: stages.find(stage => stage.id === 'FRP-06')?.status ?? 'BLOCKED',
      executionMeaning: 'run final comprehensive tests and create clean export only after upstream gates are PASS',
      canReduceGitStatusAtThisStep: canReduceGitStatusNow,
    },
  ]

  return {
    schemaVersion: 'dsxu.final-release-preflight-register.v1',
    status,
    planObjective: 'original-side owner closure before final tests and clean export',
    executionMeaning: [
      'equivalent duplicate behavior is merged into the original owner or remains a replace/delete candidate',
      'different behavior is mapped to a named mainline owner before keep',
      'Git status reduction is a signed review outcome, not a cleanup shortcut',
      'P12-19 target-reference raw logs and original-side family backlog slots are the first hard release blocker',
    ],
    sourceBoardStatus: board.status,
    cleanExportStatus: cleanExport.status,
    releaseClosureStatus: releaseClosure.status,
    stageCount: stages.length,
    pass,
    partial,
    blocked,
    canRunFocusedVerification: true,
    canRunFinalComprehensiveTests,
    canCreateCleanExport: canRunFinalComprehensiveTests,
    boardAuthorizesMutation: false,
    mustNotStageDeleteRestoreResetExport: !canRunFinalComprehensiveTests,
    stages,
    closureSequence,
    gitStatusReductionGate: {
      currentDirtyTotal: board.dirtySummary.total,
      canReduceGitStatusNow,
      blockedBy: gitStatusBlockedBy,
      allowedReductionAfter: [
        'P12-19 target-reference raw logs are imported with original-side family coverage and delta evidence is reviewable',
        'owner/Git signoff closes mainline keep and replace/delete candidates',
        'pending deletion Git review closes deletion-state files',
        'permission-blocked residues are externally resolved or explicitly signed off',
        'final release and clean export gates are PASS',
      ],
    },
    releaseBlockers,
    safeguards: [
      'preflight is evidence-only and does not stage, delete, restore, reset, export, archive, or commit files',
      'focused verification is allowed for changed evidence code, but final comprehensive tests stay last',
      'clean export cannot be created while owner/Git, pending deletion, raw evidence, product, or workspace lanes are open',
      'final test success cannot override missing target raw logs or unsigned dirty/deletion work',
    ],
    nextAction: rawStatus === 'BLOCKED'
      ? 'collect-target-reference-raw-logs'
      : releaseStatus === 'BLOCKED'
        ? 'keep-focused-verification-only'
        : ownerStatus !== 'PASS'
          ? 'owner-git-review-required'
          : pendingStatus !== 'PASS'
            ? 'pending-deletion-review-required'
            : productStatus !== 'PASS' || workspaceStatus !== 'PASS'
              ? 'deferred-product-or-workspace-review-required'
              : canRunFinalComprehensiveTests
                ? 'prepare-final-release-tests'
                : 'keep-focused-verification-only',
  }
}
