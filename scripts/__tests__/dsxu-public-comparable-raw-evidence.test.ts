import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  collectPublicComparableRawEvidence,
  scaffoldPublicComparableRawEvidenceCollection,
} from '../dsxu-public-comparable-raw-evidence'

describe('dsxu-public-comparable-raw-evidence', () => {
  test('imports a complete fixed-case raw evidence directory without allowing external comparison', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, [{
      id: 'case-1',
      category: 'feature',
      expectedModel: 'deepseek-v4-flash',
      promptHash: 'hash-case-1',
    }])
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    await mkdir(join(caseDir, 'artifacts'), { recursive: true })
    await Promise.all([
      writeFile(join(caseDir, 'raw-transcript.jsonl'), '{"role":"assistant"}\n', 'utf8'),
      writeFile(join(caseDir, 'tool-trace.jsonl'), '{"tool":"Read"}\n', 'utf8'),
      writeFile(join(caseDir, 'raw-api-response.json'), '{"answer":"baseline"}\n', 'utf8'),
      writeFile(join(caseDir, 'final-report.md'), '# pass\n', 'utf8'),
      writeFile(join(caseDir, 'artifacts', 'stdout.log'), 'ok\n', 'utf8'),
      writeFile(join(caseDir, 'metrics.json'), JSON.stringify({
        promptHash: 'hash-case-1',
        firstAttemptPass: true,
        secondAttemptPass: true,
        finalPass: true,
        costUsd: 0.01,
        wallClockMs: 1234,
        cacheHitRatePct: 67,
        proAdmissionCount: 0,
        failureRecoveryEvents: 0,
        unavailableToolUseCount: 0,
        executionVisibilityBlockedCount: 0,
        noToolUnsupportedClaimCount: 0,
        toolBudgetExceededCount: 0,
        readBudgetExceededCount: 0,
        shellBudgetExceededCount: 0,
      }), 'utf8'),
    ])

    const outputPath = join(root, 'docs', 'generated', 'raw.json')
    const report = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath,
      reportPath: join(root, 'docs', 'generated', 'report.json'),
    })
    const rawManifest = JSON.parse(await readFile(outputPath, 'utf8'))

    expect(report).toMatchObject({
      status: 'PASS',
      importedCaseCount: 1,
      readyCaseCount: 1,
      missingCaseCount: 0,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
      rawManifestWritten: true,
    })
    expect(rawManifest.cases[0]).toMatchObject({
      id: 'case-1',
      promptHash: 'hash-case-1',
      rawTranscriptPath: '.dsxu/trace/public-comparable-raw-evidence/case-1/raw-transcript.jsonl',
      toolTracePath: '.dsxu/trace/public-comparable-raw-evidence/case-1/tool-trace.jsonl',
      rawApiResponsePath: '.dsxu/trace/public-comparable-raw-evidence/case-1/raw-api-response.json',
      finalPass: true,
    })
    expect(rawManifest.cases[0].toolResultChars).toBeGreaterThan(0)
    expect(rawManifest.cases[0].artifactLogSizeBytes).toBeGreaterThan(0)
  })

  test('does not write a raw manifest when no recognized raw artifacts exist', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, [{
      id: 'case-1',
      category: 'bugfix',
      expectedModel: 'deepseek-v4-flash',
      promptHash: 'hash-case-1',
    }])
    const outputPath = join(root, 'docs', 'generated', 'raw.json')
    const reportPath = join(root, 'docs', 'generated', 'report.json')

    const report = await collectPublicComparableRawEvidence({ root, manifestPath, outputPath, reportPath })

    expect(report).toMatchObject({
      status: 'BLOCKED',
      importedCaseCount: 0,
      readyCaseCount: 0,
      missingCaseCount: 1,
      publicBenchmarkClaimAllowed: false,
      rawManifestWritten: false,
    })
    expect(existsSync(outputPath)).toBe(false)
    expect(JSON.parse(await readFile(reportPath, 'utf8')).cases[0].redlines).toContain('raw evidence case is missing')
  })

  test('scaffolds collection work orders without creating importable raw evidence', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, [{
      id: 'case-1',
      category: 'bugfix',
      expectedModel: 'deepseek-v4-flash',
      promptHash: 'hash-case-1',
    }])
    const outputPath = join(root, 'docs', 'generated', 'raw.json')
    const collectionReportPath = join(root, 'docs', 'generated', 'collection-pack.json')

    const collectionPack = await scaffoldPublicComparableRawEvidenceCollection({
      root,
      manifestPath,
      outputPath,
      collectionReportPath,
    })
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    const workOrder = JSON.parse(await readFile(join(caseDir, 'work-order.json'), 'utf8'))
    const metricsTemplate = JSON.parse(await readFile(join(caseDir, 'metrics.template.json'), 'utf8'))
    const readme = await readFile(join(caseDir, 'README.md'), 'utf8')
    const importReport = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath,
      reportPath: join(root, 'docs', 'generated', 'report.json'),
    })

    expect(collectionPack).toMatchObject({
      status: 'READY_COLLECTION_PACK_NO_RAW_EVIDENCE',
      createdCaseCount: 1,
      rawEvidenceWritten: false,
      publicBenchmarkClaimAllowed: false,
    })
    expect(workOrder).toMatchObject({
      schemaVersion: 'dsxu.public-comparable-collection-work-order.v1',
      id: 'case-1',
      promptHashExpected: 'hash-case-1',
      requiredOutputFiles: {
        targetReferenceTranscript: [
          'target-reference-transcript.jsonl',
          'target-reference.raw.jsonl',
          'target.raw.jsonl',
          'reference-transcript.jsonl',
        ],
      },
    })
    expect(workOrder.executionRules).toContain('Run the same-task target/reference lane before writing target-reference transcript artifacts.')
    expect(workOrder.executionRules).toContain('Do not claim external comparison until targetReferenceTranscriptPath is present for this exact case.')
    expect(readme).toContain('Required only before external target/reference comparison claims:')
    expect(readme).toContain('same-task target/reference transcript')
    expect(readme).toContain('placeholders, summaries, or DSXU self-runs do not count')
    expect(metricsTemplate).toMatchObject({
      schemaVersion: 'dsxu.public-comparable-metrics-template.v1',
      templateOnly: true,
      promptHash: 'hash-case-1',
    })
    expect(existsSync(join(caseDir, 'metrics.json'))).toBe(false)
    expect(existsSync(join(caseDir, 'raw-transcript.jsonl'))).toBe(false)
    expect(importReport).toMatchObject({
      status: 'BLOCKED',
      importedCaseCount: 0,
      rawManifestWritten: false,
      publicBenchmarkClaimAllowed: false,
    })
    expect(existsSync(outputPath)).toBe(false)
    expect(JSON.parse(await readFile(collectionReportPath, 'utf8')).rawEvidenceWritten).toBe(false)
  })

  test('keeps imported artifacts partial when the evidence promptHash is absent or mismatched', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, [{
      id: 'case-1',
      category: 'review',
      expectedModel: 'deepseek-v4-pro',
      promptHash: 'fixed-prompt-hash',
    }])
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    await mkdir(join(caseDir, 'artifacts'), { recursive: true })
    await Promise.all([
      writeFile(join(caseDir, 'raw-transcript.jsonl'), '{}\n', 'utf8'),
      writeFile(join(caseDir, 'tool-trace.jsonl'), '{}\n', 'utf8'),
      writeFile(join(caseDir, 'raw-api-response.json'), '{}\n', 'utf8'),
      writeFile(join(caseDir, 'final-report.md'), 'partial\n', 'utf8'),
      writeFile(join(caseDir, 'metrics.json'), JSON.stringify({
        promptHash: 'wrong-prompt-hash',
        firstAttemptPass: true,
        secondAttemptPass: true,
        finalPass: true,
        costUsd: 0.01,
        wallClockMs: 100,
        cacheHitRatePct: 50,
        proAdmissionCount: 1,
        failureRecoveryEvents: [],
        unavailableToolUseCount: 0,
        executionVisibilityBlockedCount: 0,
        noToolUnsupportedClaimCount: 0,
        toolBudgetExceededCount: 0,
        readBudgetExceededCount: 0,
        shellBudgetExceededCount: 0,
        toolResultChars: 12,
        artifactLogSizeBytes: 1,
      }), 'utf8'),
    ])

    const report = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath: join(root, 'docs', 'generated', 'raw.json'),
      reportPath: join(root, 'docs', 'generated', 'report.json'),
    })

    expect(report).toMatchObject({
      status: 'PARTIAL',
      importedCaseCount: 1,
      readyCaseCount: 0,
      partialCaseCount: 1,
      publicBenchmarkClaimAllowed: false,
      rawManifestWritten: true,
    })
    expect(report.cases[0]?.redlines).toContain('public comparable raw evidence promptHash mismatch')
  })

  test('keeps external comparison blocked when target reference transcript is a DSXU self-copy', async () => {
    const root = await createRoot()
    const manifestPath = await writeManifest(root, [{
      id: 'case-1',
      category: 'review',
      expectedModel: 'deepseek-v4-flash',
      promptHash: 'hash-case-1',
    }])
    const caseDir = join(root, '.dsxu', 'trace', 'public-comparable-raw-evidence', 'case-1')
    await mkdir(join(caseDir, 'artifacts'), { recursive: true })
    await Promise.all([
      writeFile(join(caseDir, 'raw-transcript.jsonl'), '{"side":"dsxu"}\n', 'utf8'),
      writeFile(join(caseDir, 'target-reference-transcript.jsonl'), '{"side":"dsxu"}\n', 'utf8'),
      writeFile(join(caseDir, 'tool-trace.jsonl'), '{"tool":"Read"}\n', 'utf8'),
      writeFile(join(caseDir, 'raw-api-response.json'), '{"side":"raw-api"}\n', 'utf8'),
      writeFile(join(caseDir, 'final-report.json'), '{"status":"pass"}\n', 'utf8'),
      writeFile(join(caseDir, 'artifacts', 'stdout.log'), 'ok\n', 'utf8'),
      writeFile(join(caseDir, 'metrics.json'), JSON.stringify({
        promptHash: 'hash-case-1',
        firstAttemptPass: true,
        secondAttemptPass: true,
        finalPass: true,
        costUsd: 0.01,
        wallClockMs: 1234,
        cacheHitRatePct: 67,
        proAdmissionCount: 0,
        failureRecoveryEvents: 0,
        unavailableToolUseCount: 0,
        executionVisibilityBlockedCount: 0,
        noToolUnsupportedClaimCount: 0,
        toolBudgetExceededCount: 0,
        readBudgetExceededCount: 0,
        shellBudgetExceededCount: 0,
      }), 'utf8'),
    ])

    const report = await collectPublicComparableRawEvidence({
      root,
      manifestPath,
      outputPath: join(root, 'docs', 'generated', 'raw.json'),
      reportPath: join(root, 'docs', 'generated', 'report.json'),
    })

    expect(report).toMatchObject({
      status: 'PASS',
      importedCaseCount: 1,
      readyCaseCount: 1,
      publicBenchmarkClaimAllowed: true,
      externalComparisonClaimAllowed: false,
    })
    expect(report.cases[0]?.missingExternalTargetFields).toEqual([])
    expect(report.cases[0]?.externalTargetRedlines).toContain(
      'public comparable external target reference transcript is byte-identical to DSXU raw transcript',
    )
  })
})

async function createRoot(): Promise<string> {
  const root = join(tmpdir(), `dsxu-public-comparable-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  await mkdir(root, { recursive: true })
  return root
}

async function writeManifest(
  root: string,
  cases: Array<{ id: string; category: string; expectedModel: string; promptHash: string }>,
): Promise<string> {
  const manifestPath = join(root, 'docs', 'generated', 'manifest.json')
  await mkdir(join(root, 'docs', 'generated'), { recursive: true })
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 'dsxu.public-comparable-benchmark-manifest.v1',
    status: 'PASS_PUBLIC_COMPARABLE_BENCHMARK_MANIFEST_READY',
    caseCount: cases.length,
    cases,
  }), 'utf8')
  return manifestPath
}
