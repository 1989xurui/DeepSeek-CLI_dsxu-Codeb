import { describe, expect, test } from 'bun:test'
import { buildV18ControlledFailureTaxonomy } from '../controlled-failure-taxonomy'

describe('V18 Controlled Failure Taxonomy V1', () => {
  test('covers permission, timeout, validation, workspace, and repeated verification recovery actions', () => {
    const taxonomy = buildV18ControlledFailureTaxonomy()

    expect(taxonomy.ok).toBe(true)
    expect(taxonomy.sampleCount).toBe(5)
    expect(taxonomy.categories).toEqual([
      'permission',
      'timeout',
      'validation',
      'workspace',
    ])
    expect(taxonomy.actions).toEqual([
      'request_approval',
      'retry',
      'replan',
      'abort',
    ])
    expect(taxonomy.samples.map(sample => sample.id)).toContain(
      'repeated-verification-no-strategy-change',
    )
    expect(taxonomy.missingCategories).toEqual([])
    expect(taxonomy.missingActions).toEqual([])
  })
})
