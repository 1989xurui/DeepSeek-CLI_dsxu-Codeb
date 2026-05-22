import { describe, expect, test } from 'bun:test'
import { buildGoldenTrainingFixtures } from '../golden-fixtures'
import { scoreTrainingTrajectory } from '../scorer'
import { buildDatasetValidationReport } from '../validator'

describe('DSXU training golden fixtures', () => {
  test('builds 60 fixtures across six categories', () => {
    const fixtures = buildGoldenTrainingFixtures()
    const categories = new Set(fixtures.map(fixture => fixture.category))

    expect(fixtures).toHaveLength(60)
    expect(categories).toEqual(new Set([
      'basic-edit',
      'multi-file',
      'verification',
      'recovery',
      'long-task',
      'anti-cheat',
    ]))
  })

  test('matches expected validation status and score range', () => {
    const fixtures = buildGoldenTrainingFixtures()
    const validation = buildDatasetValidationReport({
      inputPath: 'memory',
      strict: true,
      items: fixtures.map(fixture => ({ path: fixture.fixtureId, value: fixture })),
    })
    const scores = fixtures.map(scoreTrainingTrajectory)

    expect(validation.status).toBe('PASS')
    expect(validation.sampleCount).toBe(60)
    expect(validation.items.every(item => item.expectedMatched)).toBe(true)
    expect(scores.every(score => score.expectedSeesMatched)).toBe(true)
  })
})
