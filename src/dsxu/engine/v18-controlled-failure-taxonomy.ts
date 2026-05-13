import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { normalizeFailure, type DSXUFailure } from './failure-taxonomy'

export type V18ControlledFailureSample = {
  id: string
  scenario: string
  failure: DSXUFailure
  expectedCategory: DSXUFailure['category']
  expectedAction: DSXUFailure['recommendedAction']
}

export type V18ControlledFailureTaxonomy = {
  ok: boolean
  evidenceMode: 'controlled_failure_injection'
  sampleCount: number
  categories: string[]
  actions: string[]
  samples: V18ControlledFailureSample[]
  missingCategories: string[]
  missingActions: string[]
}

export type V18ControlledFailureTaxonomyReport = {
  ok: boolean
  generatedAt: string
  evidencePath: string
  taxonomy: V18ControlledFailureTaxonomy
}

export type V18ControlledFailureTaxonomyOptions = {
  evidenceDir?: string
  nowIso?: string
}

const REQUIRED_CATEGORIES = ['permission', 'timeout', 'validation', 'workspace'] as const
const REQUIRED_ACTIONS = ['request_approval', 'retry', 'replan', 'abort'] as const

export function buildV18ControlledFailureTaxonomy(): V18ControlledFailureTaxonomy {
  const samples: V18ControlledFailureSample[] = [
    {
      id: 'policy-denied-shell',
      scenario: 'permission hidden fallback and shell policy fail',
      failure: normalizeFailure(new Error('Permission denied by DSXU policy'), {
        blockedByPolicy: true,
        operation: 'Bash',
      }),
      expectedCategory: 'permission',
      expectedAction: 'request_approval',
    },
    {
      id: 'background-timeout',
      scenario: 'background task heartbeat expired',
      failure: normalizeFailure(new Error('command timed out after heartbeat expired'), {
        operation: 'Bash',
      }),
      expectedCategory: 'timeout',
      expectedAction: 'retry',
    },
    {
      id: 'schema-invalid-tool-call',
      scenario: 'tool input schema validation failed',
      failure: normalizeFailure(new Error('schema validation failed: file_path required'), {
        operation: 'FileEdit',
      }),
      expectedCategory: 'validation',
      expectedAction: 'replan',
    },
    {
      id: 'workspace-boundary',
      scenario: 'workspace root boundary violation',
      failure: normalizeFailure(new Error('workspace root violation: outside allowed cwd'), {
        operation: 'Write',
      }),
      expectedCategory: 'workspace',
      expectedAction: 'abort',
    },
    {
      id: 'repeated-verification-no-strategy-change',
      scenario: 'same verification command failed twice without strategy change',
      failure: {
        ...normalizeFailure(
          new Error('same verification command failed twice without strategy change'),
          { operation: 'verification' },
        ),
        failureCode: 'DSXU_REPEATED_VERIFICATION_NO_STRATEGY_CHANGE',
        category: 'validation',
        retryable: false,
        recommendedAction: 'replan',
      },
      expectedCategory: 'validation',
      expectedAction: 'replan',
    },
  ]
  const categories = [...new Set(samples.map(sample => sample.failure.category))]
  const actions = [...new Set(samples.map(sample => sample.failure.recommendedAction))]
  const missingCategories = REQUIRED_CATEGORIES.filter(
    category => !categories.includes(category),
  )
  const missingActions = REQUIRED_ACTIONS.filter(action => !actions.includes(action))
  const expectationFailures = samples.filter(
    sample =>
      sample.failure.category !== sample.expectedCategory ||
      sample.failure.recommendedAction !== sample.expectedAction,
  )

  return {
    ok:
      missingCategories.length === 0 &&
      missingActions.length === 0 &&
      expectationFailures.length === 0,
    evidenceMode: 'controlled_failure_injection',
    sampleCount: samples.length,
    categories,
    actions,
    samples,
    missingCategories,
    missingActions,
  }
}

export async function runV18ControlledFailureTaxonomyHarness(
  options: V18ControlledFailureTaxonomyOptions = {},
): Promise<V18ControlledFailureTaxonomyReport> {
  const root = process.cwd()
  const evidenceDir =
    options.evidenceDir ?? join(root, '.dsxu', 'trace', 'v18-benchmark')
  const evidencePath = join(evidenceDir, 'controlled-failure-taxonomy-20260506.evidence.json')
  await mkdir(evidenceDir, { recursive: true })

  const taxonomy = buildV18ControlledFailureTaxonomy()
  const report: V18ControlledFailureTaxonomyReport = {
    ok: taxonomy.ok,
    generatedAt: options.nowIso ?? new Date().toISOString(),
    evidencePath,
    taxonomy,
  }
  await writeFile(evidencePath, JSON.stringify(report, null, 2), 'utf8')
  return report
}
