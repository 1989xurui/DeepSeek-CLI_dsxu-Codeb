import type {
  V18DirtyLedgerCategory,
  V18DirtyLedgerEntry,
  V18DirtyQuarantineLedger,
} from './v18-dirty-quarantine-ledger'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PRODUCT_PATTERN = new RegExp(LEGACY_PRODUCT, 'gi')

export type DirtyWorktreeReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type DirtyWorktreeReviewBatchId =
  | 'DWR-01'
  | 'DWR-02'
  | 'DWR-03'
  | 'DWR-04'
  | 'DWR-05'
  | 'DWR-99'

export type DirtyWorktreeReviewBatch = {
  id: DirtyWorktreeReviewBatchId
  category: V18DirtyLedgerCategory
  count: number
  deletedCount: number
  untrackedCount: number
  owner: string
  status: DirtyWorktreeReviewStatus
  closurePolicy: string
  requiredAction: string
  canAutoClose: boolean
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type DirtyWorktreeReview = {
  schemaVersion: 'dsxu.dirty-worktree-review.v1'
  status: DirtyWorktreeReviewStatus
  total: number
  batchCount: number
  pass: number
  partial: number
  blocked: number
  unknownDirtyCount: number
  mainlineDirtyReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  mainlineDirtyReviewBatchCount: number
  canCloseDirtyGate: boolean
  mustNotStageOrRestore: boolean
  batches: readonly DirtyWorktreeReviewBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction: 'normal-mainline-review' | 'review-evidence-and-quarantine' | 'classify-unknown-dirty' | 'dirty-gate-closed'
}

const categoryOrder: readonly V18DirtyLedgerCategory[] = [
  'mainline_active',
  'v18_plan_or_evidence',
  'toolchain_or_runtime',
  'legacy_quarantine_delete',
  'side_path_or_archive',
  'unknown',
]

function batchIdForCategory(category: V18DirtyLedgerCategory): DirtyWorktreeReviewBatchId {
  if (category === 'mainline_active') return 'DWR-01'
  if (category === 'v18_plan_or_evidence') return 'DWR-02'
  if (category === 'toolchain_or_runtime') return 'DWR-03'
  if (category === 'legacy_quarantine_delete') return 'DWR-04'
  if (category === 'side_path_or_archive') return 'DWR-05'
  return 'DWR-99'
}

function ownerForCategory(category: V18DirtyLedgerCategory): string {
  if (category === 'mainline_active') return 'Mainline Code Review'
  if (category === 'v18_plan_or_evidence') return 'Audit Evidence'
  if (category === 'toolchain_or_runtime') return 'Toolchain'
  if (category === 'legacy_quarantine_delete') return 'Release Quarantine'
  if (category === 'side_path_or_archive') return 'Archive Review'
  return 'Manual Classification'
}

function closurePolicyForCategory(category: V18DirtyLedgerCategory): string {
  if (category === 'mainline_active') return 'review, test, then intentionally stage through normal change review'
  if (category === 'v18_plan_or_evidence') return 'preserve or archive only after current audit references are stable'
  if (category === 'toolchain_or_runtime') return 'verify toolchain tests before accepting release impact'
  if (category === 'legacy_quarantine_delete') return 'confirm replacement evidence and close through normal deletion review'
  if (category === 'side_path_or_archive') return 'keep release-excluded until archive policy is signed off'
  return 'classify owner and release impact before any release claim'
}

function requiredActionForCategory(category: V18DirtyLedgerCategory): string {
  if (category === 'mainline_active') return 'split mainline edits into intentional review groups'
  if (category === 'v18_plan_or_evidence') return 'link evidence paths from the merged audit before archive decisions'
  if (category === 'toolchain_or_runtime') return 'run focused toolchain or runtime checks before close'
  if (category === 'legacy_quarantine_delete') return 'verify replacement evidence before normal deletion review'
  if (category === 'side_path_or_archive') return 'confirm release exclusion and archive owner'
  return 'classify unknown dirty paths'
}

function sanitizePath(path: string): string {
  return path.replace(LEGACY_PRODUCT_PATTERN, 'legacy-product')
}

function buildBatch(
  category: V18DirtyLedgerCategory,
  entries: readonly V18DirtyLedgerEntry[],
): DirtyWorktreeReviewBatch {
  const redlines = [
    ...(entries.length === 0 ? ['batch has no entries'] : []),
    ...(category === 'unknown' && entries.length > 0 ? ['unknown dirty paths remain'] : []),
  ]
  return {
    id: batchIdForCategory(category),
    category,
    count: entries.length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: ownerForCategory(category),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    closurePolicy: closurePolicyForCategory(category),
    requiredAction: requiredActionForCategory(category),
    canAutoClose: false,
    samplePaths: entries.slice(0, 10).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

export function buildDirtyWorktreeReview(ledger: V18DirtyQuarantineLedger): DirtyWorktreeReview {
  const batches = categoryOrder
    .map(category => {
      const entries = ledger.entries.filter(entry => entry.category === category)
      return entries.length > 0 ? buildBatch(category, entries) : null
    })
    .filter((batch): batch is DirtyWorktreeReviewBatch => batch !== null)
  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const redlines = [
    ...(ledger.total > 0 ? ['dirty worktree remains open'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
  ]
  const status: DirtyWorktreeReviewStatus = blocked > 0
    ? 'BLOCKED'
    : ledger.total > 0 || partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.dirty-worktree-review.v1',
    status,
    total: ledger.total,
    batchCount: batches.length,
    pass,
    partial,
    blocked,
    unknownDirtyCount: ledger.countsByCategory.unknown,
    mainlineDirtyReviewStatus: 'NOT_RUN',
    mainlineDirtyReviewBatchCount: 0,
    canCloseDirtyGate: ledger.total === 0 && blocked === 0,
    mustNotStageOrRestore: ledger.total > 0 || blocked > 0,
    batches,
    redlines,
    safeguards: [
      'review is evidence-only and does not stage, delete, restore, move, reset, or commit files',
      'dirty review is a release hygiene gate, not a product capability score',
      'mainline edits require normal review and focused verification before close',
      'quarantine and archive batches stay release-excluded until signed off',
    ],
    nextAction: ledger.countsByCategory.unknown > 0
      ? 'classify-unknown-dirty'
      : ledger.countsByCategory.mainline_active > 0
        ? 'normal-mainline-review'
        : ledger.total > 0
          ? 'review-evidence-and-quarantine'
          : 'dirty-gate-closed',
  }
}
