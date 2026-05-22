import { createHash } from 'crypto'
import {
  buildDSXUEditProofEnvelope,
  type DSXUEditProofEnvelope,
  type DSXUVerificationResult,
} from './code-mode-surgical-loop'
import {
  buildDSXUSemanticCodeGraphEvidence,
  type DSXUSemanticCodeGraphEvidence,
} from './blast-radius'

export type PostMutationGateStatus = 'SKIPPED' | 'PASS' | 'FAIL' | 'PARTIAL'

export type PostMutationGateRecord = {
  name: 'static-analysis' | 'post-mutation-verification'
  status: PostMutationGateStatus
  blocking: boolean
  passed: boolean
  issues?: number
  durationMs?: number
  error?: string
}

export type PostMutationLifecycleStage =
  | 'pre-edit'
  | 'mutation'
  | 'static-analysis'
  | 'post-mutation-verification'
  | 'review'
  | 'rollback-availability'
  | 'evidence'

export type PostMutationLifecycleRecord = {
  stage: PostMutationLifecycleStage
  status: PostMutationGateStatus
  visible: true
  blocking: boolean
  summary: string
}

export type PostMutationFinalClaimStatus =
  | 'READY_FOR_FOCUSED_CLAIM'
  | 'NEEDS_FOCUSED_VERIFICATION'
  | 'NEEDS_REVIEW'
  | 'BLOCKED'

export type PostMutationFinalClaimPolicy = {
  status: PostMutationFinalClaimStatus
  allowed: boolean
  reason: string
  requiredEvidence: string[]
}

export type PostMutationVerificationEnvelope = {
  schemaVersion: 'dsxu.post-mutation-verification.v1'
  owner: 'Tool Gate / VerificationKernel'
  filePath: string
  changeType: 'write' | 'edit'
  visibleByDefault: true
  oldContentHash: string | null
  newContentHash: string
  gates: PostMutationGateRecord[]
  lifecycle: PostMutationLifecycleRecord[]
  blockingFailure: boolean
  safeRollbackAvailable: boolean
  rollbackStrategy: 'restore-old-content' | 'manual-review'
  semanticCodeGraph?: DSXUSemanticCodeGraphEvidence
  semanticCodeGraphError?: string
  editProof: DSXUEditProofEnvelope
  reviewRequired: boolean
  finalClaimAllowed: boolean
  finalClaimPolicy: PostMutationFinalClaimPolicy
  nextAction: string
}

export type PostMutationVerificationToolSummary = {
  schemaVersion: 'dsxu.post-mutation-verification-summary.v1'
  owner: 'Tool Gate / VerificationKernel'
  status: PostMutationFinalClaimStatus
  finalClaimAllowed: boolean
  reviewRequired: boolean
  blockingFailure: boolean
  rollbackStrategy: PostMutationVerificationEnvelope['rollbackStrategy']
  editProof: {
    schemaVersion: 'dsxu.edit-proof-envelope.v5'
    claimAllowed: boolean
    verification: 'pass' | 'fail' | 'not_run'
    guardCount: number
  }
  semanticCodeGraph?: {
    schemaVersion: 'dsxu.semantic-code-graph.v5'
    status: 'PASS_SEMANTIC_CODE_GRAPH_READY' | 'NEEDS_SEMANTIC_CODE_GRAPH_REVIEW'
    affectedTestCount: number
    guardCount: number
  }
  nextAction: string
  evidence: string[]
  compactLine: string
}

export function buildPostMutationVerificationEnvelope(input: {
  filePath: string
  changeType: 'write' | 'edit'
  oldContent?: string | null
  newContent: string
  gates: PostMutationGateRecord[]
  semanticCodeGraph?: DSXUSemanticCodeGraphEvidence
  semanticCodeGraphError?: string
}): PostMutationVerificationEnvelope {
  const blockingFailure = input.gates.some(gate => gate.status === 'FAIL' && gate.blocking)
  const safeRollbackAvailable = typeof input.oldContent === 'string'
  const failedNonBlocking = input.gates.some(gate => gate.status === 'FAIL' && !gate.blocking)
  const skippedGates = input.gates.some(gate => gate.status === 'SKIPPED')
  const partialGates = input.gates.some(gate => gate.status === 'PARTIAL')
  const hasPostMutationVerification = input.gates.some(
    gate => gate.name === 'post-mutation-verification',
  )
  const postMutationVerificationPassed = input.gates.some(
    gate =>
      gate.name === 'post-mutation-verification' &&
      gate.status === 'PASS' &&
      gate.passed,
  )
  const reviewRequired =
    blockingFailure ||
    failedNonBlocking ||
    skippedGates ||
    partialGates ||
    !hasPostMutationVerification ||
    Boolean(input.semanticCodeGraphError) ||
    input.semanticCodeGraph?.status === 'NEEDS_SEMANTIC_CODE_GRAPH_REVIEW'
  const finalClaimPolicy = buildPostMutationFinalClaimPolicy({
    gates: input.gates,
    blockingFailure,
    failedNonBlocking,
    skippedGates,
    partialGates,
    hasPostMutationVerification,
    postMutationVerificationPassed,
    semanticGraphNeedsReview:
      Boolean(input.semanticCodeGraphError) ||
      input.semanticCodeGraph?.status === 'NEEDS_SEMANTIC_CODE_GRAPH_REVIEW',
  })
  const lifecycle = buildPostMutationLifecycle({
    changeType: input.changeType,
    gates: input.gates,
    blockingFailure,
    safeRollbackAvailable,
    reviewRequired,
    finalClaimPolicy,
  })
  const rollbackStrategy = safeRollbackAvailable ? 'restore-old-content' : 'manual-review'
  const editProof = buildDSXUEditProofEnvelope({
    claim: `${input.changeType} ${input.filePath} through DSXU FileWrite/FileEdit owner`,
    filesChanged: [input.filePath],
    sourceEvidence: [
      ...(safeRollbackAvailable ? [input.filePath] : []),
      ...(input.semanticCodeGraph?.sourceEvidence ?? []),
      ...(input.semanticCodeGraph?.affectedTests ?? []).map(test => `affectedTest:${test}`),
      ...(input.semanticCodeGraphError ? [`semanticGraphError:${input.semanticCodeGraphError}`] : []),
    ],
    commandsRun: input.gates.map(gate => gate.name),
    verification: buildEditProofVerification(input.gates),
    rollbackPoint: safeRollbackAvailable
      ? `oldContentHash:${sha256(input.oldContent ?? '')}`
      : '',
    risk: blockingFailure ? 'high' : reviewRequired ? 'medium' : 'low',
    remainingRisks: finalClaimPolicy.allowed ? [] : finalClaimPolicy.requiredEvidence,
  })

  return {
    schemaVersion: 'dsxu.post-mutation-verification.v1',
    owner: 'Tool Gate / VerificationKernel',
    filePath: input.filePath,
    changeType: input.changeType,
    visibleByDefault: true,
    oldContentHash: safeRollbackAvailable ? sha256(input.oldContent ?? '') : null,
    newContentHash: sha256(input.newContent),
    gates: input.gates,
    lifecycle,
    blockingFailure,
    safeRollbackAvailable,
    rollbackStrategy,
    ...(input.semanticCodeGraph && { semanticCodeGraph: input.semanticCodeGraph }),
    ...(input.semanticCodeGraphError && { semanticCodeGraphError: input.semanticCodeGraphError }),
    editProof,
    reviewRequired,
    finalClaimAllowed: finalClaimPolicy.allowed,
    finalClaimPolicy,
    nextAction: blockingFailure
      ? safeRollbackAvailable
        ? 'review gate errors, restore the previous content if needed, then rerun focused verification'
        : 'review gate errors and manually inspect the newly written file before continuing'
      : reviewRequired
        ? 'show verification envelope, review skipped or partial gates, then attach focused evidence before final claim'
      : 'continue through the normal Tool Gate and final report evidence path',
  }
}

export function buildPostMutationSemanticCodeGraphEvidence(input: {
  repoRoot: string
  filePath: string
}): {
  semanticCodeGraph?: DSXUSemanticCodeGraphEvidence
  semanticCodeGraphError?: string
} {
  try {
    return {
      semanticCodeGraph: buildDSXUSemanticCodeGraphEvidence({
        projectRoot: input.repoRoot,
        changedFiles: [input.filePath],
      }),
    }
  } catch (error) {
    return {
      semanticCodeGraphError: error instanceof Error ? error.message : String(error),
    }
  }
}

export function formatPostMutationVerificationFailure(
  envelope: PostMutationVerificationEnvelope,
): string {
  const failed = envelope.gates
    .filter(gate => gate.status === 'FAIL')
    .map(gate => `${gate.name}: ${gate.error ?? 'failed'}`)
    .join('; ')
  return [
    'DSXU post-mutation verification blocked the tool result.',
    `file=${envelope.filePath}`,
    `owner=${envelope.owner}`,
    `rollback=${envelope.rollbackStrategy}`,
    `failed=${failed || 'unknown'}`,
    `nextAction=${envelope.nextAction}`,
  ].join('\n')
}

export function summarizePostMutationVerificationEnvelope(
  envelope: PostMutationVerificationEnvelope,
): PostMutationVerificationToolSummary {
  const evidence = [
    'schema:dsxu.post-mutation-verification.v1',
    `status:${envelope.finalClaimPolicy.status}`,
    `finalClaimAllowed:${String(envelope.finalClaimAllowed)}`,
    `reviewRequired:${String(envelope.reviewRequired)}`,
    `rollback:${envelope.rollbackStrategy}`,
    `editProof:${envelope.editProof.schemaVersion}:claimAllowed=${String(envelope.editProof.claimAllowed)}`,
    envelope.semanticCodeGraph
      ? `semanticGraph:${envelope.semanticCodeGraph.status}:affectedTests=${envelope.semanticCodeGraph.affectedTests.length}`
      : '',
    envelope.semanticCodeGraphError ? `semanticGraphError:${envelope.semanticCodeGraphError}` : '',
    ...envelope.gates.map(gate =>
      `gate:${gate.name}:${gate.status}:blocking=${String(gate.blocking)}`,
    ),
  ].filter((item): item is string => Boolean(item))
  const compactLine = [
    `DSXU verification=${envelope.finalClaimPolicy.status}`,
    `finalClaimAllowed=${String(envelope.finalClaimAllowed)}`,
    `reviewRequired=${String(envelope.reviewRequired)}`,
    envelope.semanticCodeGraph
      ? `semanticTests=${envelope.semanticCodeGraph.affectedTests.length}`
      : undefined,
    `next=${envelope.nextAction}`,
  ].filter(Boolean).join('; ')

  return {
    schemaVersion: 'dsxu.post-mutation-verification-summary.v1',
    owner: envelope.owner,
    status: envelope.finalClaimPolicy.status,
    finalClaimAllowed: envelope.finalClaimAllowed,
    reviewRequired: envelope.reviewRequired,
    blockingFailure: envelope.blockingFailure,
    rollbackStrategy: envelope.rollbackStrategy,
    editProof: {
      schemaVersion: envelope.editProof.schemaVersion,
      claimAllowed: envelope.editProof.claimAllowed,
      verification: envelope.editProof.verification,
      guardCount: envelope.editProof.guards.length,
    },
    ...(envelope.semanticCodeGraph && {
      semanticCodeGraph: {
        schemaVersion: envelope.semanticCodeGraph.schemaVersion,
        status: envelope.semanticCodeGraph.status,
        affectedTestCount: envelope.semanticCodeGraph.affectedTests.length,
        guardCount: envelope.semanticCodeGraph.guards.length,
      },
    }),
    nextAction: envelope.nextAction,
    evidence,
    compactLine,
  }
}

export function formatPostMutationVerificationToolState(
  summary: PostMutationVerificationToolSummary,
): string {
  const claimWarning = summary.finalClaimAllowed
    ? 'focused final claim may cite this mutation evidence'
    : 'do not claim this mutation is fully verified until focused evidence is attached'
  const semanticState = summary.semanticCodeGraph
    ? ` semanticGraph=${summary.semanticCodeGraph.status}; affectedTests=${summary.semanticCodeGraph.affectedTestCount};`
    : ''
  return [
    `DSXU verification state: ${summary.status}; ${claimWarning}.`,
    `DSXU tool state: post_mutation_verification; finalClaimAllowed=${String(summary.finalClaimAllowed)}; reviewRequired=${String(summary.reviewRequired)}; rollback=${summary.rollbackStrategy};${semanticState} next=${summary.nextAction}.`,
  ].join('\n')
}

function buildEditProofVerification(
  gates: readonly PostMutationGateRecord[],
): DSXUVerificationResult | 'not_run' {
  const verifyGate = gates.find(gate => gate.name === 'post-mutation-verification')
  if (!verifyGate) return 'not_run'
  return {
    command: ['post-mutation-verification'],
    exitCode: verifyGate.passed ? 0 : 1,
    stdout: `${verifyGate.name}:${verifyGate.status}`,
    stderr: verifyGate.error ?? '',
    passed: verifyGate.passed,
    failureType: verifyGate.passed ? 'UNKNOWN' : 'TEST',
  }
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function buildPostMutationLifecycle(input: {
  changeType: 'write' | 'edit'
  gates: PostMutationGateRecord[]
  blockingFailure: boolean
  safeRollbackAvailable: boolean
  reviewRequired: boolean
  finalClaimPolicy: PostMutationFinalClaimPolicy
}): PostMutationLifecycleRecord[] {
  const staticGate = input.gates.find(gate => gate.name === 'static-analysis')
  const verifyGate = input.gates.find(gate => gate.name === 'post-mutation-verification')
  return [
    {
      stage: 'pre-edit',
      status: 'PASS',
      visible: true,
      blocking: false,
      summary: `${input.changeType} request entered FileWrite/FileEdit owner`,
    },
    {
      stage: 'mutation',
      status: input.blockingFailure ? 'PARTIAL' : 'PASS',
      visible: true,
      blocking: false,
      summary: 'file mutation completed before post-mutation gates were evaluated',
    },
    {
      stage: 'static-analysis',
      status: staticGate?.status ?? 'SKIPPED',
      visible: true,
      blocking: Boolean(staticGate?.blocking),
      summary: staticGate
        ? `static analysis ${staticGate.status.toLowerCase()}${staticGate.issues !== undefined ? ` issues=${staticGate.issues}` : ''}`
        : 'static analysis gate not configured for this mutation',
    },
    {
      stage: 'post-mutation-verification',
      status: verifyGate?.status ?? 'SKIPPED',
      visible: true,
      blocking: Boolean(verifyGate?.blocking),
      summary: verifyGate
        ? `post-mutation verification ${verifyGate.status.toLowerCase()}`
        : 'post-mutation verification gate not configured for this mutation',
    },
    {
      stage: 'review',
      status: input.reviewRequired ? 'PARTIAL' : 'PASS',
      visible: true,
      blocking: false,
      summary: input.reviewRequired
        ? 'manual or focused review is required before final claim'
        : 'no skipped, partial, or failed gates require review',
    },
    {
      stage: 'rollback-availability',
      status: input.safeRollbackAvailable ? 'PASS' : 'PARTIAL',
      visible: true,
      blocking: false,
      summary: input.safeRollbackAvailable
        ? 'previous content hash is available for rollback review'
        : 'new file has no old content; rollback requires manual review',
    },
    {
      stage: 'evidence',
      status: input.finalClaimPolicy.allowed ? 'PASS' : 'PARTIAL',
      visible: true,
      blocking: false,
      summary: `post-mutation verification envelope recorded; finalClaim=${input.finalClaimPolicy.status}`,
    },
  ]
}

function buildPostMutationFinalClaimPolicy(input: {
  gates: PostMutationGateRecord[]
  blockingFailure: boolean
  failedNonBlocking: boolean
  skippedGates: boolean
  partialGates: boolean
  hasPostMutationVerification: boolean
  postMutationVerificationPassed: boolean
  semanticGraphNeedsReview?: boolean
}): PostMutationFinalClaimPolicy {
  if (input.blockingFailure) {
    return {
      status: 'BLOCKED',
      allowed: false,
      reason: 'A blocking post-mutation gate failed.',
      requiredEvidence: [
        'Fix the blocking issue.',
        'Rerun focused static analysis or native verification.',
        'Attach the latest passing Tool Gate evidence.',
      ],
    }
  }

  if (input.failedNonBlocking || input.skippedGates || input.partialGates) {
    return {
      status: 'NEEDS_REVIEW',
      allowed: false,
      reason: 'The mutation still has skipped, partial, or non-blocking failed gate evidence.',
      requiredEvidence: [
        'Review skipped or partial gates.',
        'Attach focused evidence or explicitly keep the final claim limited.',
      ],
    }
  }

  if (input.semanticGraphNeedsReview) {
    return {
      status: 'NEEDS_REVIEW',
      allowed: false,
      reason: 'The mutation has no ready Semantic Code Graph source/test selection evidence.',
      requiredEvidence: [
        'Review the Semantic Code Graph guards.',
        'Attach affected-test or owner-review evidence before final claim.',
      ],
    }
  }

  if (!input.hasPostMutationVerification || !input.postMutationVerificationPassed) {
    return {
      status: 'NEEDS_FOCUSED_VERIFICATION',
      allowed: false,
      reason: 'The mutation has no passing post-mutation verification evidence.',
      requiredEvidence: [
        'Run the focused native test, lint, typecheck, or build command.',
        'Record the verification result in the Tool Gate envelope.',
      ],
    }
  }

  if (input.gates.length > 0 && input.gates.every(gate => gate.status === 'PASS' && gate.passed)) {
    return {
      status: 'READY_FOR_FOCUSED_CLAIM',
      allowed: true,
      reason: 'All recorded post-mutation gates passed with focused verification evidence.',
      requiredEvidence: [],
    }
  }

  return {
    status: 'NEEDS_REVIEW',
    allowed: false,
    reason: 'The mutation evidence is not complete enough for a final claim.',
    requiredEvidence: ['Review the Tool Gate envelope before finalizing.'],
  }
}
