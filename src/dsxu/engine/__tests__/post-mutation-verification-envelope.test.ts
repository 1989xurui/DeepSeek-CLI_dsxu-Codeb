import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildPostMutationVerificationEnvelope,
  buildPostMutationSemanticCodeGraphEvidence,
  formatPostMutationVerificationFailure,
  formatPostMutationVerificationToolState,
  summarizePostMutationVerificationEnvelope,
} from '../post-mutation-verification-envelope'
import { FileEditTool } from '../../../tools/FileEditTool/FileEditTool'
import { FileWriteTool } from '../../../tools/FileWriteTool/FileWriteTool'

describe('DSXU post-mutation verification envelope', () => {
  test('binds write/edit gate failures to Tool Gate and VerificationKernel owner evidence', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/sample.ts',
      changeType: 'edit',
      oldContent: 'export const value = 1',
      newContent: 'export const value = 2',
      gates: [
        {
          name: 'static-analysis',
          status: 'FAIL',
          blocking: true,
          passed: false,
          issues: 1,
          error: 'critical issue',
        },
        {
          name: 'post-mutation-verification',
          status: 'PARTIAL',
          blocking: false,
          passed: true,
        },
      ],
    })

    expect(envelope.owner).toBe('Tool Gate / VerificationKernel')
    expect(envelope.blockingFailure).toBe(true)
    expect(envelope.safeRollbackAvailable).toBe(true)
    expect(envelope.rollbackStrategy).toBe('restore-old-content')
    expect(envelope.visibleByDefault).toBe(true)
    expect(envelope.reviewRequired).toBe(true)
    expect(envelope.finalClaimAllowed).toBe(false)
    expect(envelope.finalClaimPolicy.status).toBe('BLOCKED')
    expect(envelope.editProof.schemaVersion).toBe('dsxu.edit-proof-envelope.v5')
    expect(envelope.editProof.verification).toBe('pass')
    expect(envelope.editProof.claimAllowed).toBe(false)
    expect(envelope.finalClaimPolicy.requiredEvidence.join('\n')).toContain('Rerun focused')
    expect(envelope.lifecycle.map(item => item.stage)).toEqual([
      'pre-edit',
      'mutation',
      'static-analysis',
      'post-mutation-verification',
      'review',
      'rollback-availability',
      'evidence',
    ])
    expect(envelope.lifecycle.every(item => item.visible)).toBe(true)
    expect(envelope.oldContentHash).toHaveLength(64)
    expect(envelope.newContentHash).toHaveLength(64)
    expect(formatPostMutationVerificationFailure(envelope)).toContain('critical issue')
  })

  test('does not claim automatic rollback for new writes without old content', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/new.ts',
      changeType: 'write',
      oldContent: null,
      newContent: 'export const created = true',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: false,
          passed: true,
        },
      ],
    })

    expect(envelope.blockingFailure).toBe(false)
    expect(envelope.safeRollbackAvailable).toBe(false)
    expect(envelope.rollbackStrategy).toBe('manual-review')
    expect(envelope.visibleByDefault).toBe(true)
    expect(envelope.finalClaimAllowed).toBe(false)
    expect(envelope.editProof.verification).toBe('not_run')
    expect(envelope.editProof.claimAllowed).toBe(false)
    expect(envelope.reviewRequired).toBe(true)
    expect(envelope.finalClaimPolicy.status).toBe('NEEDS_FOCUSED_VERIFICATION')
    expect(envelope.lifecycle.find(item => item.stage === 'rollback-availability')?.status).toBe('PARTIAL')
    expect(envelope.lifecycle.find(item => item.stage === 'evidence')?.summary).toContain(
      'NEEDS_FOCUSED_VERIFICATION',
    )
  })

  test('keeps skipped gates visible instead of pretending edit verification is complete', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/skipped.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'SKIPPED',
          blocking: false,
          passed: true,
        },
        {
          name: 'post-mutation-verification',
          status: 'PARTIAL',
          blocking: false,
          passed: true,
          error: 'lint-only verification recorded',
        },
      ],
    })

    expect(envelope.blockingFailure).toBe(false)
    expect(envelope.reviewRequired).toBe(true)
    expect(envelope.finalClaimAllowed).toBe(false)
    expect(envelope.finalClaimPolicy.status).toBe('NEEDS_REVIEW')
    expect(envelope.nextAction).toContain('review skipped or partial gates')
    expect(envelope.lifecycle.find(item => item.stage === 'static-analysis')?.status).toBe('SKIPPED')
    expect(envelope.lifecycle.find(item => item.stage === 'post-mutation-verification')?.status).toBe('PARTIAL')
  })

  test('surfaces non-final verification state in FileWrite/FileEdit tool results', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/not-yet-verified.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: false,
          passed: true,
        },
        {
          name: 'post-mutation-verification',
          status: 'PARTIAL',
          blocking: false,
          passed: true,
          error: 'post-mutation verification only',
        },
      ],
    })
    const summary = summarizePostMutationVerificationEnvelope(envelope)

    expect(summary.editProof).toEqual({
      schemaVersion: 'dsxu.edit-proof-envelope.v5',
      claimAllowed: false,
      verification: 'pass',
      guardCount: expect.any(Number),
    })
    expect(summary.evidence.join('\n')).toContain('editProof:dsxu.edit-proof-envelope.v5')
    expect(formatPostMutationVerificationToolState(summary)).toContain(
      'finalClaimAllowed=false',
    )

    const editResult = FileEditTool.mapToolResultToToolResultBlockParam({
      filePath: 'src/not-yet-verified.ts',
      oldString: 'old',
      newString: 'new',
      originalFile: 'old',
      structuredPatch: [],
      userModified: false,
      replaceAll: false,
      postMutationVerification: summary,
    } as never, 'toolu-edit-v4-verification')
    const writeResult = FileWriteTool.mapToolResultToToolResultBlockParam({
      type: 'update',
      filePath: 'src/not-yet-verified.ts',
      content: 'new',
      structuredPatch: [],
      originalFile: 'old',
      postMutationVerification: summary,
    } as never, 'toolu-write-v4-verification')

    expect(String(editResult.content)).toContain('DSXU verification state: NEEDS_REVIEW')
    expect(String(editResult.content)).toContain('do not claim this mutation is fully verified')
    expect(String(writeResult.content)).toContain('DSXU verification state: NEEDS_REVIEW')
    expect(String(writeResult.content)).toContain('finalClaimAllowed=false')
  })

  test('allows a focused final claim only when post-mutation verification evidence passes', () => {
    const envelope = buildPostMutationVerificationEnvelope({
      filePath: 'src/verified.ts',
      changeType: 'edit',
      oldContent: 'old',
      newContent: 'new',
      gates: [
        {
          name: 'static-analysis',
          status: 'PASS',
          blocking: true,
          passed: true,
          issues: 0,
        },
        {
          name: 'post-mutation-verification',
          status: 'PASS',
          blocking: true,
          passed: true,
          durationMs: 128,
        },
      ],
    })

    expect(envelope.reviewRequired).toBe(false)
    expect(envelope.blockingFailure).toBe(false)
    expect(envelope.finalClaimAllowed).toBe(true)
    expect(envelope.editProof.claimAllowed).toBe(true)
    expect(envelope.editProof.verification).toBe('pass')
    expect(envelope.finalClaimPolicy).toEqual({
      status: 'READY_FOR_FOCUSED_CLAIM',
      allowed: true,
      reason: 'All recorded post-mutation gates passed with focused verification evidence.',
      requiredEvidence: [],
    })
    expect(envelope.lifecycle.find(item => item.stage === 'evidence')?.status).toBe('PASS')
  })

  test('folds Semantic Code Graph affected-test selection into edit proof and tool state', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsxu-v5-semantic-edit-'))
    try {
      const src = join(root, 'src')
      mkdirSync(src, { recursive: true })
      const sourceFile = join(src, 'math.ts')
      const testFile = join(src, 'math.test.ts')
      writeFileSync(sourceFile, 'export function add(a: number, b: number) { return a + b }\n')
      writeFileSync(testFile, "import { add } from './math'\nconsole.log(add(1, 2))\n")

      const semantic = buildPostMutationSemanticCodeGraphEvidence({
        repoRoot: root,
        filePath: sourceFile,
      })
      expect(semantic.semanticCodeGraph?.status).toBe('PASS_SEMANTIC_CODE_GRAPH_READY')
      expect(semantic.semanticCodeGraph?.affectedTests).toContain(testFile)

      const envelope = buildPostMutationVerificationEnvelope({
        filePath: sourceFile,
        changeType: 'edit',
        oldContent: 'old',
        newContent: 'new',
        semanticCodeGraph: semantic.semanticCodeGraph,
        semanticCodeGraphError: semantic.semanticCodeGraphError,
        gates: [
          {
            name: 'static-analysis',
            status: 'PASS',
            blocking: true,
            passed: true,
          },
          {
            name: 'post-mutation-verification',
            status: 'PASS',
            blocking: true,
            passed: true,
          },
        ],
      })
      const summary = summarizePostMutationVerificationEnvelope(envelope)

      expect(envelope.semanticCodeGraph?.affectedTests).toContain(testFile)
      expect(envelope.editProof.sourceEvidence.join('\n')).toContain('affectedTests:1')
      expect(summary.semanticCodeGraph?.affectedTestCount).toBe(1)
      expect(summary.evidence.join('\n')).toContain('semanticGraph:PASS_SEMANTIC_CODE_GRAPH_READY')
      expect(formatPostMutationVerificationToolState(summary)).toContain('affectedTests=1')
      expect(envelope.finalClaimAllowed).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
