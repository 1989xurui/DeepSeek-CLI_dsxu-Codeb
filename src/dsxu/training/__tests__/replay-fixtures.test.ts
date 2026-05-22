import { describe, expect, test } from 'bun:test'
import { buildReplayTrainingFixtures, REPLAY_CATEGORY_SPECS } from '../replay-fixtures'
import { scoreTrainingTrajectory } from '../scorer'
import { buildDatasetValidationReport } from '../validator'

describe('DSXU training replay fixtures', () => {
  test('builds 300 internal synthetic replay fixtures with expected category coverage', () => {
    const fixtures = buildReplayTrainingFixtures()
    const counts = new Map<string, number>()
    for (const fixture of fixtures) counts.set(fixture.category, (counts.get(fixture.category) ?? 0) + 1)

    expect(fixtures).toHaveLength(300)
    for (const spec of REPLAY_CATEGORY_SPECS) {
      expect(counts.get(spec.category)).toBe(spec.count)
    }
  })

  test('matches expected validation status and SEES ranges', () => {
    const fixtures = buildReplayTrainingFixtures()
    const validation = buildDatasetValidationReport({
      inputPath: 'memory',
      strict: true,
      items: fixtures.map(fixture => ({ path: fixture.fixtureId, value: fixture })),
    })
    const scores = fixtures.map(scoreTrainingTrajectory)

    expect(validation.status).toBe('PASS')
    expect(validation.items.every(item => item.expectedMatched)).toBe(true)
    expect(scores.every(score => score.expectedSeesMatched)).toBe(true)
  })
})
