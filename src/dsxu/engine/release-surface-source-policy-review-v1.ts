import type { V18OpenSourceCleanExportManifestEntry } from './open-source-package-gate'

export type ReleaseSurfaceSourcePolicyReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_PROVIDED'

export type ReleaseSurfaceSourcePolicyDecision =
  | 'rewrite-for-clean-export'
  | 'exclude-from-clean-export'
  | 'reject'
  | 'adjust'

export type ReleaseSurfaceSourcePolicyReviewDecision = {
  path: string
  releasePolicy: 'rewrite-or-exclude'
  provenance?: string
  decision: ReleaseSurfaceSourcePolicyDecision
  owner: string
  rationale: string
  exportInstruction: string
  evidence: readonly string[]
}

export type ReleaseSurfaceSourcePolicyReviewManifest = {
  schemaVersion: 'dsxu.release-surface-source-policy-review.v1'
  reviewId: string
  generatedAt: string
  decisions: readonly ReleaseSurfaceSourcePolicyReviewDecision[]
}

export type ReleaseSurfaceSourcePolicyReviewState = {
  schemaVersion: 'dsxu.release-surface-source-policy-review-state.v1'
  status: ReleaseSurfaceSourcePolicyReviewStatus
  requiredCount: number
  reviewedCount: number
  signedCount: number
  rejectedCount: number
  adjustRequestedCount: number
  missingPaths: readonly string[]
  stalePaths: readonly string[]
  acceptedDecisions: readonly ReleaseSurfaceSourcePolicyReviewDecision[]
  redlines: readonly string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function asEvidence(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
}

function parseManifest(input: unknown): {
  manifest?: ReleaseSurfaceSourcePolicyReviewManifest
  redlines: readonly string[]
} {
  if (!isRecord(input)) return { redlines: ['source policy review manifest must be an object'] }
  if (input.schemaVersion !== 'dsxu.release-surface-source-policy-review.v1') {
    return { redlines: ['source policy review manifest schemaVersion is invalid'] }
  }
  const reviewId = asString(input.reviewId)
  const generatedAt = asString(input.generatedAt)
  if (!reviewId) return { redlines: ['source policy review manifest reviewId is missing'] }
  if (!generatedAt) return { redlines: ['source policy review manifest generatedAt is missing'] }
  if (!Array.isArray(input.decisions)) {
    return { redlines: ['source policy review manifest decisions must be an array'] }
  }

  const decisions: ReleaseSurfaceSourcePolicyReviewDecision[] = []
  const redlines: string[] = []
  for (const [index, rawDecision] of input.decisions.entries()) {
    if (!isRecord(rawDecision)) {
      redlines.push(`decision ${index} must be an object`)
      continue
    }
    const path = asString(rawDecision.path)
    const owner = asString(rawDecision.owner)
    const rationale = asString(rawDecision.rationale)
    const exportInstruction = asString(rawDecision.exportInstruction)
    const evidence = asEvidence(rawDecision.evidence)
    const decision = rawDecision.decision
    if (!path) redlines.push(`decision ${index} path is missing`)
    if (rawDecision.releasePolicy !== 'rewrite-or-exclude') {
      redlines.push(`${path ?? `decision ${index}`}: releasePolicy must be rewrite-or-exclude`)
    }
    if (
      decision !== 'rewrite-for-clean-export' &&
      decision !== 'exclude-from-clean-export' &&
      decision !== 'reject' &&
      decision !== 'adjust'
    ) {
      redlines.push(`${path ?? `decision ${index}`}: decision is invalid`)
    }
    if (!owner) redlines.push(`${path ?? `decision ${index}`}: owner is missing`)
    if (!rationale) redlines.push(`${path ?? `decision ${index}`}: rationale is missing`)
    if (!exportInstruction) redlines.push(`${path ?? `decision ${index}`}: exportInstruction is missing`)
    if (evidence.length === 0) redlines.push(`${path ?? `decision ${index}`}: evidence is missing`)
    if (!path || !owner || !rationale || !exportInstruction || evidence.length === 0) continue
    if (
      rawDecision.releasePolicy !== 'rewrite-or-exclude' ||
      (
        decision !== 'rewrite-for-clean-export' &&
        decision !== 'exclude-from-clean-export' &&
        decision !== 'reject' &&
        decision !== 'adjust'
      )
    ) {
      continue
    }
    decisions.push({
      path: normalizePath(path),
      releasePolicy: 'rewrite-or-exclude',
      provenance: typeof rawDecision.provenance === 'string' ? rawDecision.provenance : undefined,
      decision,
      owner,
      rationale,
      exportInstruction,
      evidence,
    })
  }

  if (redlines.length > 0) return { redlines }
  return {
    manifest: {
      schemaVersion: 'dsxu.release-surface-source-policy-review.v1',
      reviewId,
      generatedAt,
      decisions,
    },
    redlines: [],
  }
}

export function buildReleaseSurfaceSourcePolicyReviewState(
  rewriteOrExcludeEntries: readonly V18OpenSourceCleanExportManifestEntry[],
  input: unknown | null,
): ReleaseSurfaceSourcePolicyReviewState {
  const requiredEntries = rewriteOrExcludeEntries
    .filter(entry => entry.releasePolicy === 'rewrite-or-exclude')
    .map(entry => ({
      ...entry,
      path: normalizePath(entry.path),
    }))
  if (requiredEntries.length === 0) {
    return {
      schemaVersion: 'dsxu.release-surface-source-policy-review-state.v1',
      status: 'PASS',
      requiredCount: 0,
      reviewedCount: 0,
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      missingPaths: [],
      stalePaths: [],
      acceptedDecisions: [],
      redlines: [],
    }
  }
  if (!input) {
    return {
      schemaVersion: 'dsxu.release-surface-source-policy-review-state.v1',
      status: 'NOT_PROVIDED',
      requiredCount: requiredEntries.length,
      reviewedCount: 0,
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      missingPaths: requiredEntries.map(entry => entry.path),
      stalePaths: [],
      acceptedDecisions: [],
      redlines: [],
    }
  }

  const parsed = parseManifest(input)
  if (!parsed.manifest) {
    return {
      schemaVersion: 'dsxu.release-surface-source-policy-review-state.v1',
      status: 'BLOCKED',
      requiredCount: requiredEntries.length,
      reviewedCount: 0,
      signedCount: 0,
      rejectedCount: 0,
      adjustRequestedCount: 0,
      missingPaths: requiredEntries.map(entry => entry.path),
      stalePaths: [],
      acceptedDecisions: [],
      redlines: parsed.redlines,
    }
  }

  const requiredByPath = new Map(requiredEntries.map(entry => [entry.path, entry]))
  const decisionsByPath = new Map<string, ReleaseSurfaceSourcePolicyReviewDecision>()
  const duplicatePaths = new Set<string>()
  for (const decision of parsed.manifest.decisions) {
    if (decisionsByPath.has(decision.path)) duplicatePaths.add(decision.path)
    decisionsByPath.set(decision.path, decision)
  }

  const missingPaths = requiredEntries
    .filter(entry => !decisionsByPath.has(entry.path))
    .map(entry => entry.path)
  const stalePaths = parsed.manifest.decisions
    .filter(decision => !requiredByPath.has(decision.path))
    .map(decision => decision.path)
  const acceptedDecisions = requiredEntries
    .map(entry => decisionsByPath.get(entry.path))
    .filter((decision): decision is ReleaseSurfaceSourcePolicyReviewDecision => Boolean(decision))
  const rejectedCount = acceptedDecisions.filter(decision => decision.decision === 'reject').length
  const adjustRequestedCount = acceptedDecisions.filter(decision => decision.decision === 'adjust').length
  const signedCount = acceptedDecisions.filter(
    decision => decision.decision === 'rewrite-for-clean-export' || decision.decision === 'exclude-from-clean-export',
  ).length
  const redlines = [
    ...Array.from(duplicatePaths).map(path => `${path}: duplicate source policy review decision`),
    ...stalePaths.map(path => `${path}: source policy review decision does not match current rewrite-or-exclude surface`),
    ...acceptedDecisions.flatMap(decision => decision.decision === 'reject'
      ? [`${decision.path}: source policy review rejected export policy`]
      : []),
    ...acceptedDecisions.flatMap(decision => decision.decision === 'adjust'
      ? [`${decision.path}: source policy review requested adjustment before export`]
      : []),
  ]
  const status: ReleaseSurfaceSourcePolicyReviewStatus = redlines.length > 0
    ? 'BLOCKED'
    : missingPaths.length > 0
      ? 'PARTIAL'
      : signedCount === requiredEntries.length
        ? 'PASS'
        : 'PARTIAL'

  return {
    schemaVersion: 'dsxu.release-surface-source-policy-review-state.v1',
    status,
    requiredCount: requiredEntries.length,
    reviewedCount: acceptedDecisions.length,
    signedCount,
    rejectedCount,
    adjustRequestedCount,
    missingPaths,
    stalePaths,
    acceptedDecisions,
    redlines,
  }
}
