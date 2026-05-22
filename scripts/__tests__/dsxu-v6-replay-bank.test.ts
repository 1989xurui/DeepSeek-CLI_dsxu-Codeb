import { describe, expect, test } from 'bun:test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildV6ReplayBank,
  generateV6ReplayBank,
  type V6ReplayCase,
} from '../dsxu-v6-replay-bank'
import { buildV6HitRateReport } from '../dsxu-v6-hit-rate-report'

function caseRow(index: number, overrides: Partial<V6ReplayCase> = {}): V6ReplayCase {
  return {
    id: `case-${index}`,
    category: 'single-file-edit',
    title: `case ${index}`,
    rawTracePath: `.dsxu/trace/v6/case-${index}.jsonl`,
    finalPass: true,
    verifyRequiredRun: true,
    falseClaimCount: 0,
    infiniteLoopCount: 0,
    toolHit: true,
    recoveryPath: index % 5 === 0,
    recoverySuccess: true,
    proAdmissionCount: index % 12 === 0 ? 1 : 0,
    proAdmissionJustifiedCount: index % 12 === 0 ? 1 : 0,
    routeModels: [index % 12 === 0 ? 'deepseek-v4-pro' : 'deepseek-v4-flash'],
    costUsd: 0.001,
    wallClockMs: 30_000,
    cacheHitRatePct: 80,
    toolResultChars: 1000,
    evidenceOk: true,
    evidenceMissing: [],
    ...overrides,
  }
}

describe('dsxu-v6 replay bank and hit-rate report', () => {
  test('passes senior-100 only when the replay bank meets every V6 threshold', () => {
    const cases = Array.from({ length: 100 }, (_, index) => caseRow(index + 1))
    const bank = buildV6ReplayBank({
      generatedAt: '2026-05-19T00:00:00.000Z',
      cases,
    })
    const report = buildV6HitRateReport({
      generatedAt: '2026-05-19T00:00:00.000Z',
      bank,
      sourceReplayBankPath: 'docs/generated/DSXU_V6_REPLAY_BANK_20260519.json',
      minFinalPassPct: 90,
    })

    expect(bank.status).toBe('PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE')
    expect(bank.realModelRun).toBe(false)
    expect(bank.publicClaimStatus).toBe('BLOCKED_PUBLIC_EXTERNAL_CLAIM')
    expect(bank.caseCount).toBe(100)
    expect(bank.finalPassRatePct).toBe(100)
    expect(bank.verifyRequiredRunRatePct).toBe(100)
    expect(bank.falseClaimCount).toBe(0)
    expect(bank.infiniteLoopCount).toBe(0)
    expect(bank.toolHitRatePct).toBe(100)
    expect(bank.recoverySuccessRatePct).toBe(100)
    expect(bank.proEscalationJustifiedPct).toBe(100)
    expect(report.status).toBe('PASS_V6_INTERNAL_REPLAY_HIT_RATE_GATE')
    expect(report.publicClaimStatus).toBe('BLOCKED_PUBLIC_EXTERNAL_CLAIM')
    expect(report.claimBoundary).toContain('not a real live-model ability score')
  })

  test('blocks under-sized or dishonest replay sets instead of claiming V6 hit-rate completion', () => {
    const cases = Array.from({ length: 20 }, (_, index) => caseRow(index + 1, {
      falseClaimCount: index === 0 ? 1 : 0,
      verifyRequiredRun: index !== 1,
    }))
    const bank = buildV6ReplayBank({
      generatedAt: '2026-05-19T00:00:00.000Z',
      cases,
    })
    const report = buildV6HitRateReport({
      generatedAt: '2026-05-19T00:00:00.000Z',
      bank,
      sourceReplayBankPath: 'docs/generated/blocked.json',
      minFinalPassPct: 90,
    })

    expect(bank.status).toBe('BLOCKED_V6_REPLAY_BANK')
    expect(bank.blockers.join('\n')).toContain('need 100 replay cases')
    expect(bank.blockers.join('\n')).toContain('false claims observed')
    expect(report.status).toBe('BLOCKED_V6_INTERNAL_REPLAY_HIT_RATE_GATE')
  })

  test('generated senior replay bank preserves category breadth and recovery/pro admission evidence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsxu-v6-replay-bank-'))
    const bank = await generateV6ReplayBank({
      root,
      generatedAt: '2026-05-19T00:00:00.000Z',
    })
    const categories = new Set(bank.cases.map(item => item.category))

    expect(bank.status).toBe('PASS_V6_INTERNAL_REPLAY_CONTRACT_GATE')
    expect(bank.caseCount).toBe(100)
    expect(categories.size).toBe(10)
    expect(bank.recoveryCaseCount).toBeGreaterThanOrEqual(20)
    expect(bank.proAdmissionCount).toBeGreaterThan(0)
    expect(bank.sourcePacks).toContain('docs/generated/DSXU_V5_REPLAY_BANK_20260519.json')
  })
})
