export const REAL_TASK_REPLAY_P12_SLOT_IDS = [
  'RT-01',
  'RT-01-additional-2',
  'RT-01-additional-3',
  'RT-02-additional-1',
  'RT-02-additional-2',
  'RT-03-additional-1',
  'RT-03-additional-2',
  'RT-04',
  'RT-04-additional-2',
  'RT-05-additional-1',
  'RT-06-additional-1',
  'RT-07',
  'RT-07-additional-2',
  'RT-08',
] as const

export type RealTaskReplayId = (typeof REAL_TASK_REPLAY_P12_SLOT_IDS)[number]
export type RealTaskReplayStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type RealTaskReplayEvidenceChecklist = {
  baseline: boolean
  context: boolean
  execution: boolean
  recovery: boolean
  verification: boolean
  cost: boolean
  final: boolean
}

export type RealTaskReplayCase = {
  id: RealTaskReplayId
  title: string
  target: string
  evidence: RealTaskReplayEvidenceChecklist
  artifactPaths: readonly string[]
  metrics: Record<string, number | string | boolean | null>
  risks: readonly string[]
}

export type RealTaskReplayCaseResult = RealTaskReplayCase & {
  status: RealTaskReplayStatus
  missingEvidence: readonly (keyof RealTaskReplayEvidenceChecklist)[]
}

export type RealTaskReplaySuiteResult = {
  schemaVersion: 'dsxu.real-task-replay-suite.v1'
  status: RealTaskReplayStatus
  caseCount: number
  pass: number
  partial: number
  blocked: number
  mustNotClaimReleaseReady: boolean
  cases: readonly RealTaskReplayCaseResult[]
  requiredArtifacts: readonly string[]
  redlines: readonly string[]
}

export function evaluateRealTaskReplayCase(input: RealTaskReplayCase): RealTaskReplayCaseResult {
  const missingEvidence = (Object.keys(input.evidence) as Array<keyof RealTaskReplayEvidenceChecklist>)
    .filter(key => input.evidence[key] !== true)
  const status: RealTaskReplayStatus =
    input.risks.some(risk => /fake pass|missing|unverified|blocked/i.test(risk)) || missingEvidence.length > 0
      ? 'BLOCKED'
      : input.risks.length > 0
        ? 'PARTIAL'
        : 'PASS'
  return {
    ...input,
    status,
    missingEvidence,
  }
}

export function buildRealTaskReplaySuite(
  cases: readonly RealTaskReplayCase[],
): RealTaskReplaySuiteResult {
  const evaluated = cases.map(evaluateRealTaskReplayCase)
  const pass = evaluated.filter(item => item.status === 'PASS').length
  const partial = evaluated.filter(item => item.status === 'PARTIAL').length
  const blocked = evaluated.filter(item => item.status === 'BLOCKED').length
  return {
    schemaVersion: 'dsxu.real-task-replay-suite.v1',
    status: blocked > 0 ? 'BLOCKED' : partial > 0 ? 'PARTIAL' : 'PASS',
    caseCount: evaluated.length,
    pass,
    partial,
    blocked,
    mustNotClaimReleaseReady: true,
    cases: evaluated,
    requiredArtifacts: [...new Set(evaluated.flatMap(item => item.artifactPaths))],
    redlines: evaluated.flatMap(item => [
      ...item.missingEvidence.map(field => `${item.id}: missing ${field} evidence`),
      ...item.risks.map(risk => `${item.id}: ${risk}`),
    ]),
  }
}
