export type DSXUReplaceDeleteReference = {
  path: string
  line?: number
  excerpt: string
  kind: 'runtime' | 'test' | 'doc' | 'generated-evidence'
}

export type DSXUReplaceDeleteCandidate = {
  path: string
  currentOwner: string
  proposedOwner: string
  reason: string
  runtimeReferences: readonly DSXUReplaceDeleteReference[]
  testReferences: readonly DSXUReplaceDeleteReference[]
  docReferences: readonly DSXUReplaceDeleteReference[]
  replacementEvidence: readonly string[]
  publicClaimAllowed: boolean
}

export type DSXUReplaceDeleteOwnerReviewInput = {
  packetId: string
  title: string
  targetOwner: string
  replacementOwner: string
  candidates: readonly DSXUReplaceDeleteCandidate[]
  rule: string
}

export type DSXUReplaceDeleteOwnerReview = {
  schemaVersion: 'dsxu.replace-delete-owner-review.v1'
  packetId: string
  title: string
  targetOwner: string
  replacementOwner: string
  status:
    | 'READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW'
    | 'BLOCKED_BY_RUNTIME_REFERENCES'
    | 'BLOCKED_BY_MISSING_REPLACEMENT_EVIDENCE'
    | 'BLOCKED_BY_PUBLIC_CLAIM'
  candidateCount: number
  runtimeReferenceCount: number
  testReferenceCount: number
  docReferenceCount: number
  replacementEvidenceCount: number
  candidates: readonly DSXUReplaceDeleteCandidate[]
  guards: readonly string[]
  nextAction: string
  rule: string
}

export function buildDSXUReplaceDeleteOwnerReview(
  input: DSXUReplaceDeleteOwnerReviewInput,
): DSXUReplaceDeleteOwnerReview {
  const runtimeReferenceCount = input.candidates.reduce(
    (sum, candidate) => sum + candidate.runtimeReferences.length,
    0,
  )
  const testReferenceCount = input.candidates.reduce(
    (sum, candidate) => sum + candidate.testReferences.length,
    0,
  )
  const docReferenceCount = input.candidates.reduce(
    (sum, candidate) => sum + candidate.docReferences.length,
    0,
  )
  const replacementEvidenceCount = new Set(
    input.candidates.flatMap(candidate => candidate.replacementEvidence),
  ).size
  const hasPublicClaim = input.candidates.some(candidate => candidate.publicClaimAllowed)
  const guards = [
    ...(runtimeReferenceCount > 0
      ? [`${runtimeReferenceCount} runtime reference(s) still point to the old owner`]
      : []),
    ...(replacementEvidenceCount === 0 ? ['missing replacement owner evidence'] : []),
    ...(hasPublicClaim ? ['candidate still allows public claim'] : []),
  ]
  const status = runtimeReferenceCount > 0
    ? 'BLOCKED_BY_RUNTIME_REFERENCES'
    : replacementEvidenceCount === 0
      ? 'BLOCKED_BY_MISSING_REPLACEMENT_EVIDENCE'
      : hasPublicClaim
        ? 'BLOCKED_BY_PUBLIC_CLAIM'
        : 'READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW'

  const readyNextAction = testReferenceCount > 0
    ? 'owner/Git may approve replacement deletion or keep this packet as test-only compatibility; do not stage/delete without explicit owner/Git mutation authorization'
    : 'owner/Git may approve replacement deletion or keep this packet as historical source only; do not stage/delete without explicit owner/Git mutation authorization'

  return {
    schemaVersion: 'dsxu.replace-delete-owner-review.v1',
    packetId: input.packetId,
    title: input.title,
    targetOwner: input.targetOwner,
    replacementOwner: input.replacementOwner,
    status,
    candidateCount: input.candidates.length,
    runtimeReferenceCount,
    testReferenceCount,
    docReferenceCount,
    replacementEvidenceCount,
    candidates: input.candidates,
    guards,
    nextAction:
      status === 'READY_FOR_OWNER_GIT_REPLACE_DELETE_REVIEW'
        ? readyNextAction
        : 'resolve guards before any owner/Git replace-delete approval',
    rule: input.rule,
  }
}
