import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildV4RealTaskHitRatePack } from '../dsxu-v4-real-task-hit-rate-pack'

async function writeTrace(root: string, id: string): Promise<{
  tracePath: string
  stdoutPath: string
  stderrPath: string
}> {
  const tracePath = join(root, `${id}.jsonl`)
  const stdoutPath = join(root, `${id}.stdout.log`)
  const stderrPath = join(root, `${id}.stderr.log`)
  const lines = [
    JSON.stringify({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            content: 'failing focused test before repair',
            is_error: true,
          },
        ],
      },
    }),
    JSON.stringify({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            content: '1 pass 0 fail\nDSXU tool state: verification_passed',
            is_error: false,
          },
        ],
      },
    }),
    JSON.stringify({
      type: 'result',
      total_cost_usd: 0.002,
      num_turns: 5,
      usage: {
        input_tokens: 1000,
        cache_read_input_tokens: 700,
        cache_creation_input_tokens: 300,
        output_tokens: 80,
      },
      modelUsage: {
        'deepseek-v4-flash': {
          inputTokens: 1000,
          outputTokens: 80,
          cacheReadInputTokens: 700,
          cacheCreationInputTokens: 300,
          costUSD: 0.002,
        },
      },
    }),
  ]
  await writeFile(tracePath, `${lines.join('\n')}\n`, 'utf8')
  await writeFile(stdoutPath, '1 pass\n', 'utf8')
  await writeFile(stderrPath, '', 'utf8')
  return { tracePath, stdoutPath, stderrPath }
}

function taskRecord(input: {
  id: string
  suite: 'hard' | 'raw'
  tracePath: string
  stdoutPath: string
  stderrPath: string
}) {
  const dsxu = {
    pass: true,
    durationMs: 1000,
    costUSD: 0.002,
    tracePath: input.tracePath,
    toolUseCounts: { Bash: 2, Edit: 1 },
    finalTestExitCode: 0,
    finalTestStdoutPath: input.stdoutPath,
    finalTestStderrPath: input.stderrPath,
  }
  if (input.suite === 'hard') {
    return {
      id: input.id,
      lane: 'repo-swe',
      title: `hard ${input.id}`,
      raw: { pass: false },
      dsxu,
    }
  }
  return {
    id: input.id,
    title: `raw ${input.id}`,
    raw: { pass: false },
    dsxu,
  }
}

async function writeReports(root: string, count: number): Promise<{
  hardReportPath: string
  rawReportPath: string
}> {
  await mkdir(root, { recursive: true })
  const hardTasks = []
  const rawTasks = []
  for (let index = 0; index < count; index += 1) {
    const trace = await writeTrace(root, `case-${index}`)
    const suite = index % 2 === 0 ? 'hard' : 'raw'
    if (suite === 'hard') {
      hardTasks.push(taskRecord({ id: `hard-${index}`, suite, ...trace }))
    } else {
      rawTasks.push(taskRecord({ id: `raw-${index}`, suite, ...trace }))
    }
  }
  const hardReportPath = join(root, 'hard.json')
  const rawReportPath = join(root, 'raw.json')
  await writeFile(hardReportPath, JSON.stringify({ tasks: hardTasks }, null, 2), 'utf8')
  await writeFile(rawReportPath, JSON.stringify({ tasks: rawTasks }, null, 2), 'utf8')
  return { hardReportPath, rawReportPath }
}

describe('dsxu-v4-real-task-hit-rate-pack', () => {
  test('passes only when at least 20 real trace-backed cases are present', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v4-hit-rate-pack-'))
    const reports = await writeReports(root, 20)
    const pack = await buildV4RealTaskHitRatePack({
      hardEngineeringReportPath: reports.hardReportPath,
      rawApiVsDsxuReportPath: reports.rawReportPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(pack.status).toBe('PASS_V4_REAL_TASK_HIT_RATE_PACK')
    expect(pack.caseCount).toBe(20)
    expect(pack.finalPassRatePct).toBe(100)
    expect(pack.cacheHitRatePct).toBe(70)
    expect(pack.failureRecoveryEvents).toBeGreaterThanOrEqual(20)
    expect(pack.cases.every(item => item.evidenceOk)).toBe(true)
  })

  test('blocks short or artifact-missing packs instead of creating a launch claim', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v4-hit-rate-pack-short-'))
    const reports = await writeReports(root, 2)
    const pack = await buildV4RealTaskHitRatePack({
      hardEngineeringReportPath: reports.hardReportPath,
      rawApiVsDsxuReportPath: reports.rawReportPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    expect(pack.status).toBe('BLOCKED_V4_REAL_TASK_HIT_RATE_PACK')
    expect(pack.blockers.join('\n')).toContain('need at least 20 real DSXU task traces')
  })

  test('uses filtered hard-benchmark reruns as newer evidence for the same case id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v4-hit-rate-pack-rerun-'))
    await mkdir(root, { recursive: true })

    const releaseTrace = await writeTrace(root, 'release-claim-evidence-binder')
    const failedRelease = taskRecord({
      id: 'release-claim-evidence-binder',
      suite: 'hard',
      ...releaseTrace,
    })
    failedRelease.dsxu.pass = false
    const passedRelease = taskRecord({
      id: 'release-claim-evidence-binder',
      suite: 'hard',
      ...releaseTrace,
    })

    const rawTasks = []
    for (let index = 0; index < 19; index += 1) {
      const trace = await writeTrace(root, `raw-extra-${index}`)
      rawTasks.push(taskRecord({ id: `raw-extra-${index}`, suite: 'raw', ...trace }))
    }

    const baseHardReportPath = join(root, 'hard-base.json')
    const filteredHardReportPath = join(root, 'hard-filtered-release.json')
    const rawReportPath = join(root, 'raw.json')
    await writeFile(baseHardReportPath, JSON.stringify({ tasks: [failedRelease] }, null, 2), 'utf8')
    await writeFile(filteredHardReportPath, JSON.stringify({ tasks: [passedRelease] }, null, 2), 'utf8')
    await writeFile(rawReportPath, JSON.stringify({ tasks: rawTasks }, null, 2), 'utf8')

    const pack = await buildV4RealTaskHitRatePack({
      hardEngineeringReportPaths: [baseHardReportPath, filteredHardReportPath],
      rawApiVsDsxuReportPath: rawReportPath,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })

    const releaseCase = pack.cases.find(item => item.id === 'release-claim-evidence-binder')
    expect(pack.status).toBe('PASS_V4_REAL_TASK_HIT_RATE_PACK')
    expect(pack.caseCount).toBe(20)
    expect(releaseCase?.finalPass).toBe(true)
    expect(pack.finalPassRatePct).toBe(100)
  })
})
