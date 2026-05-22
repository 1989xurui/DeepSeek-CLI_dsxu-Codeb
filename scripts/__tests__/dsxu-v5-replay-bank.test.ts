import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { buildV5ReplayBankIntake } from '../dsxu-v5-replay-bank'

async function writeTrace(path: string, nativeV5: boolean): Promise<void> {
  const nativeBlocks = nativeV5
    ? [
      JSON.stringify({ type: 'dsxu.execution-contract.v5', task_contract: { id: 'contract', routeDecision: { model: 'deepseek-v4-flash' } } }),
      JSON.stringify({ type: 'dsxu.prompt-hash', promptHash: 'p', stablePrefixHash: 's', dynamicTailHash: 'd' }),
      JSON.stringify({ type: 'dsxu.edit-proof-envelope.v5', editProof: { verified: true } }),
    ]
    : []
  await writeFile(path, [
    JSON.stringify({
      type: 'system',
      subtype: 'init',
      model: 'deepseek-v4-flash',
      tools: ['Read', 'Edit', 'Grep', 'Bash'],
    }),
    ...nativeBlocks,
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'Read', input: { file_path: 'src/app.ts' } },
          { type: 'tool_use', name: 'Edit', input: { file_path: 'src/app.ts' } },
          { type: 'tool_result', content: 'ok' },
        ],
      },
    }),
    JSON.stringify({ type: 'result', usage: { input_tokens: 10, output_tokens: 2 } }),
    '',
  ].join('\n'), 'utf8')
}

async function writePack(root: string, nativeV5: boolean, count = 20): Promise<string> {
  const generatedDir = join(root, 'docs', 'generated')
  const traceDir = join(root, '.dsxu', 'trace', 'v5')
  const logDir = join(root, '.dsxu', 'trace', 'v5-logs')
  await mkdir(generatedDir, { recursive: true })
  await mkdir(traceDir, { recursive: true })
  await mkdir(logDir, { recursive: true })

  const cases = []
  for (let index = 0; index < count; index += 1) {
    const id = `case-${index + 1}`
    const tracePath = join(traceDir, `${id}.jsonl`)
    const stdoutPath = join(logDir, `${id}.stdout.log`)
    const stderrPath = join(logDir, `${id}.stderr.log`)
    await writeTrace(tracePath, nativeV5)
    await writeFile(stdoutPath, 'pass\n', 'utf8')
    await writeFile(stderrPath, '', 'utf8')
    cases.push({
      id,
      suite: index % 2 === 0 ? 'hard-engineering' : 'raw-api-vs-dsxu',
      category: index % 2 === 0 ? 'repo-swe' : 'workflow-lift',
      title: `Replay case ${index + 1}`,
      finalPass: true,
      rawBaselinePass: false,
      recoveryAfterBaselineFailure: true,
      routeModels: ['deepseek-v4-flash'],
      proAdmissionCount: 0,
      failureRecoveryEvents: 1,
      toolUseCount: 2,
      rawTranscriptPath: `.dsxu/trace/v5/${id}.jsonl`,
      finalTestStdoutPath: `.dsxu/trace/v5-logs/${id}.stdout.log`,
      finalTestStderrPath: `.dsxu/trace/v5-logs/${id}.stderr.log`,
      evidenceOk: true,
      evidenceMissing: [],
    })
  }

  const packPath = join(generatedDir, 'DSXU_V4_REAL_TASK_HIT_RATE_PACK_20260519.json')
  await writeFile(packPath, JSON.stringify({
    schemaVersion: 'dsxu.v4.real-task-hit-rate-pack.v1',
    generatedAt: '2026-05-19T00:00:00.000Z',
    status: 'PASS_V4_REAL_TASK_HIT_RATE_PACK',
    caseCount: cases.length,
    cases,
  }, null, 2), 'utf8')
  return packPath
}

async function writeNativePack(root: string, count = 20): Promise<string> {
  const generatedDir = join(root, 'docs', 'generated')
  const traceDir = join(root, '.dsxu', 'trace', 'v5-native')
  await mkdir(generatedDir, { recursive: true })
  await mkdir(traceDir, { recursive: true })
  const cases = []
  for (let index = 0; index < count; index += 1) {
    const id = `native-${index + 1}`
    const tracePath = join(traceDir, `${id}.jsonl`)
    await writeTrace(tracePath, true)
    cases.push({
      id,
      layer: (['L1', 'L2', 'L3', 'L4', 'L5'] as const)[index % 5],
      category: 'native-v5',
      title: `Native V5 case ${index + 1}`,
      rawTracePath: `.dsxu/trace/v5-native/${id}.jsonl`,
      finalPass: true,
      recoveryPath: true,
      evidenceOk: true,
    })
  }
  const packPath = join(generatedDir, 'DSXU_V5_NATIVE_REPLAY_SUBSET_20260519.json')
  await writeFile(packPath, JSON.stringify({
    schemaVersion: 'dsxu.v5.native-replay-subset.v1',
    generatedAt: '2026-05-19T00:00:00.000Z',
    status: 'PASS_V5_NATIVE_REPLAY_SUBSET_GENERATED',
    caseCount: cases.length,
    claimBoundary: 'internal native V5 replay only',
    cases,
  }, null, 2), 'utf8')
  return packPath
}

describe('dsxu-v5-replay-bank strict intake', () => {
  test('passes only when twenty traces carry native V5 contract, prompt hash, edit proof, and raw artifacts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v5-replay-bank-pass-'))
    const packPath = await writePack(root, true)

    const intake = await buildV5ReplayBankIntake({
      root,
      sourcePackPath: packPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(intake.status).toBe('PASS_V5_REPLAY_BANK_REQUIRED_SUBSET')
    expect(intake.bank.status).toBe('PASS_V5_REPLAY_BANK_READY')
    expect(intake.bank.requiredSubsetReady).toBe(true)
    expect(intake.nativeV5ReadyCount).toBe(20)
    expect(intake.projectedLegacyCaseCount).toBe(0)
    expect(intake.blockers).toEqual([])
  })

  test('blocks projected legacy traces instead of treating old V4 evidence as V5 standard completion', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v5-replay-bank-blocked-'))
    const packPath = await writePack(root, false)

    const intake = await buildV5ReplayBankIntake({
      root,
      sourcePackPath: packPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(intake.status).toBe('BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET')
    expect(intake.bank.status).toBe('NEEDS_V5_REPLAY_BANK_EVIDENCE')
    expect(intake.nativeV5ReadyCount).toBe(0)
    expect(intake.projectedLegacyCaseCount).toBe(20)
    expect(intake.audits[0]?.missingNativeFields).toEqual([
      'executionContract',
      'promptHash',
      'editProof',
    ])
    expect(intake.blockers.join('\n')).toContain('20-case V5 required subset is not ready')
  })

  test('blocks traces whose V5 contract route disagrees with the actual stream-json model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v5-replay-bank-route-mismatch-'))
    const packPath = await writePack(root, true)
    const tracePath = join(root, '.dsxu', 'trace', 'v5', 'case-1.jsonl')
    await writeFile(tracePath, [
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        model: 'deepseek-v4-flash',
        tools: ['Read', 'Edit', 'Grep', 'Bash'],
      }),
      JSON.stringify({ type: 'dsxu.execution-contract.v5', task_contract: { routeDecision: { model: 'deepseek-v4-pro' } } }),
      JSON.stringify({ type: 'dsxu.prompt-hash', promptHash: 'p', stablePrefixHash: 's', dynamicTailHash: 'd' }),
      JSON.stringify({ type: 'dsxu.edit-proof-envelope.v5', editProof: { verified: true } }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Read', input: {} }, { type: 'tool_result', content: 'ok' }] },
      }),
      JSON.stringify({ type: 'result', usage: { input_tokens: 10, output_tokens: 2 } }),
      '',
    ].join('\n'), 'utf8')

    const intake = await buildV5ReplayBankIntake({
      root,
      sourcePackPath: packPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(intake.status).toBe('BLOCKED_V5_REPLAY_BANK_REQUIRED_SUBSET')
    expect(intake.audits[0]?.missingStandardFields).toContain('route')
    expect(intake.bank.redlines).toContain('case-1: missing route')
  })

  test('accepts native V5 replay subset manifests without wrapping them as V4 hit-rate evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v5-native-replay-bank-'))
    const packPath = await writeNativePack(root)

    const intake = await buildV5ReplayBankIntake({
      root,
      sourcePackPath: packPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(intake.status).toBe('PASS_V5_REPLAY_BANK_REQUIRED_SUBSET')
    expect(intake.sourcePackSchemaVersion).toBe('dsxu.v5.native-replay-subset.v1')
    expect(intake.claimBoundary).toContain('not a public benchmark score')
    expect(intake.bank.acceptedCount).toBe(20)
    expect(intake.projectedLegacyCaseCount).toBe(0)
  })
})
