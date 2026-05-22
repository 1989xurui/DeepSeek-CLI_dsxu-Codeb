import { describe, expect, test } from 'bun:test'
import {
  buildDefaultDSXUFeatureDeletionTaskPack,
  validateDSXUFeatureDeletionTaskPack,
} from '../feature-deletion-benchmark'

describe('DSXU V10 feature deletion benchmark pack', () => {
  test('builds a five-case internal product-evidence task pack', () => {
    const pack = buildDefaultDSXUFeatureDeletionTaskPack('2026-05-20T00:00:00.000Z')
    const board = validateDSXUFeatureDeletionTaskPack(pack)

    expect(pack.cases).toHaveLength(5)
    expect(board.status).toBe('PASS_V10_FEATURE_DELETION_TASK_PACK_READY')
    expect(board.publicClaimAllowed).toBe(false)
    expect(board.rows.every(row => row.status === 'PASS')).toBe(true)
    expect(new Set(pack.cases.map(item => item.category)).size).toBe(5)
  })

  test('fails incomplete cases instead of turning them into benchmark claims', () => {
    const pack = buildDefaultDSXUFeatureDeletionTaskPack('2026-05-20T00:00:00.000Z')
    const board = validateDSXUFeatureDeletionTaskPack({
      ...pack,
      cases: [{
        ...pack.cases[0],
        expectedVerificationCommands: [],
      }],
    })

    expect(board.status).toBe('FAIL_V10_FEATURE_DELETION_TASK_PACK_READY')
    expect(board.publicClaimAllowed).toBe(false)
    expect(board.blockers.join('|')).toContain('missing verification command')
  })
})
