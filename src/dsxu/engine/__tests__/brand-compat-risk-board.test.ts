import { describe, expect, test } from 'bun:test'
import {
  classifyDSXUBrandCompatOccurrence,
  collectDSXUBrandCompatOccurrences,
} from '../brand-compat-risk-board'

describe('DSXU brand compatibility risk board', () => {
  test('blocks reference-brand tokens on public release surfaces', () => {
    const product = ['cl', 'aude'].join('')
    const occurrence = classifyDSXUBrandCompatOccurrence({
      path: 'README.md',
      line: 12,
      kind: 'reference-brand-token',
      match: product,
    })

    expect(occurrence.disposition).toBe('public-surface-blocker')
    expect(occurrence.match).toBe('[reference-token]')
  })

  test('keeps provider compatibility tokens inside DSXU-owned boundaries', () => {
    const occurrence = classifyDSXUBrandCompatOccurrence({
      path: 'src/utils/model/providerMigration/modelAlias.ts',
      line: 7,
      kind: 'provider-migration-token',
      match: 'providerMigration',
    })

    expect(occurrence.disposition).toBe('allowed-provider-compat-boundary')
  })

  test('classifies USER_TYPE gates as build-time review debt instead of public blockers', () => {
    const board = collectDSXUBrandCompatOccurrences({
      files: [
        {
          path: 'src/constants/betas.ts',
          content: "if (process.env.USER_TYPE === 'ant') enabled.push('internal')",
        },
        {
          path: 'docs/BENCHMARK.md',
          content: 'DSXU benchmark truth only.',
        },
      ],
      generatedAt: '2026-05-17T00:00:00.000Z',
    })

    expect(board.status).toBe('DONE_EVIDENCED')
    expect(board.publicSurfaceBlockerCount).toBe(0)
    expect(board.buildTimeDceReviewCount).toBe(1)
    expect(board.occurrences[0]?.match).toContain('[legacy-user-type]')
  })

  test('excludes its own generated board so repeated evidence generation is stable', () => {
    const board = collectDSXUBrandCompatOccurrences({
      files: [
        {
          path: 'docs/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.md',
          content: 'provider-migration reference text from the previous generated board',
        },
        {
          path: 'docs/generated/DSXU_BRAND_COMPAT_RISK_BOARD_20260517.json',
          content: '{"match":"provider-migration"}',
        },
      ],
      generatedAt: '2026-05-17T00:00:00.000Z',
    })

    expect(board.occurrenceCount).toBe(0)
  })
})
