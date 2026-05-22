export type Phase12OracleStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'

export type Phase12ScenarioId =
  | 'P12-01'
  | 'P12-04'
  | 'P12-05'
  | 'P12-06-07'
  | 'P12-08'
  | 'P12-09'
  | 'P12-10'
  | 'P12-17'
  | 'P12-19'
  | 'P12-20'

export type Phase12Decision =
  | 'kept-mainline'
  | 'superseded'
  | 'deferred'
  | 'blocked'

export type Phase12ReferenceSemantic = {
  area: string
  sourceAnchors: readonly string[]
  dsxuGate: string
}

export type Phase12Scenario = {
  id: Phase12ScenarioId
  title: string
  status: Phase12OracleStatus
  decision: Phase12Decision
  redline: string
  evidenceTests: readonly string[]
  requiredArtifacts: readonly string[]
  unresolved: readonly string[]
  qualitySignals?: readonly string[]
  referenceSemantics?: readonly Phase12ReferenceSemantic[]
}

export type Phase12OracleSummary = {
  schemaVersion: 'dsxu.phase12-experience-oracle.v1'
  overallStatus: Phase12OracleStatus
  pass: number
  partial: number
  blocked: number
  mustNotClaimDone: boolean
  nextQueue: readonly Phase12ScenarioId[]
  scenarios: readonly Phase12Scenario[]
}

export const PHASE12_EXPERIENCE_ORACLE: readonly Phase12Scenario[] = [
  {
    id: 'P12-01',
    title: 'same-window old topic isolation',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'background or old topic output must not enter a fresh human turn',
    evidenceTests: ['same-window-topic-boundary-v1.test.ts'],
    requiredArtifacts: ['query turn replay', 'deferred command queue evidence'],
    unresolved: [],
  },
  {
    id: 'P12-04',
    title: 'file existence and source-truth guard',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'do not claim a path exists after repeated not-found evidence',
    evidenceTests: [
      'same-window-topic-boundary-v1.test.ts',
      'experience-store-source-truth-conflict-v1.test.ts',
    ],
    requiredArtifacts: ['not-found replay', 'source-truth conflict evidence'],
    unresolved: [],
  },
  {
    id: 'P12-05',
    title: 'visible permission wait and recovery',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'permission wait must have visible state, audit trace, or explicit error',
    evidenceTests: [
      'tui-permission-fallback-health-v1.test.ts',
      'streaming-ui-visibility-v1.test.ts',
      'real-tui-harness-v1.test.ts',
    ],
    requiredArtifacts: ['visible fallback trace', 'TUI lifecycle trace'],
    unresolved: [],
  },
  {
    id: 'P12-06-07',
    title: 'tool refusal recovery and no self-talk',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'tool refusal must produce a recovery path or honest blocked result',
    evidenceTests: [
      'mainline-tool-adapter-v1.test.ts',
      'v12-prompt-governance-v1.test.ts',
      'intent-only-final-live-gate-v1.test.ts',
    ],
    requiredArtifacts: ['tool state cursor', 'recovery nudge'],
    unresolved: [],
  },
  {
    id: 'P12-08',
    title: 'compact and resume continuity',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'resume must preserve source truth, failed command, permission denial, and pending agent state',
    evidenceTests: [
      'compact-resume-replay-v1.test.ts',
      'smooth-resume-live-task-v1.test.ts',
      'experience-store-source-truth-conflict-v1.test.ts',
    ],
    requiredArtifacts: ['compact recovery snapshot', 'resume replay evidence'],
    unresolved: [],
  },
  {
    id: 'P12-09',
    title: 'background agent completion and notification ordering',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'background work must not create fake waiting after task output is complete',
    evidenceTests: ['local-agent-background-lifecycle-v1.test.ts'],
    requiredArtifacts: ['agent lifecycle trace', 'worker evidence packet'],
    unresolved: [],
  },
  {
    id: 'P12-20',
    title: 'complex coding process with senior-programmer evidence',
    status: 'PASS',
    decision: 'kept-mainline',
    redline:
      'complex coding tasks must prove evidence-driven localization, bounded context, repair, verification, and final report instead of score-only success',
    evidenceTests: [
      'phase12-reference-semantic-exam-v1.test.ts',
      'phase12-senior-programmer-experience-v1.test.ts',
      'code-mode-surgical-loop-v1.test.ts',
    ],
    requiredArtifacts: ['real fixture repo trace', 'final patch report', 'cost evidence'],
    unresolved: [],
    qualitySignals: [
      'baseline failure before edit',
      'localized source/test/regression files',
      'bounded context pack before patch',
      'patch failure becomes repair plan',
      'focused verification and regression guard',
      'final report cites verification and cost evidence',
      'safe parallel work remains ordered while mutating work is serialized',
      'background or delegated work cannot be guessed before notification evidence',
      'compact recovery preserves current user intent, errors, files, and next action',
      'weak-model routes must externalize process evidence instead of relying on hidden reasoning',
    ],
    referenceSemantics: [
      {
        area: 'streaming tool orchestration',
        sourceAnchors: ['services/tools/StreamingToolExecutor.ts'],
        dsxuGate:
          'safe tools may overlap, mutating tools are exclusive, progress is visible, errors produce ordered synthetic results',
      },
      {
        area: 'tool execution and permission recovery',
        sourceAnchors: ['services/tools/toolExecution.ts', 'tools/BashTool/bashPermissions.ts'],
        dsxuGate:
          'permission, hook, retry, rejection, and error states remain explicit and do not become silent self-talk',
      },
      {
        area: 'read-before-edit and exact patching',
        sourceAnchors: ['tools/FileReadTool/prompt.ts', 'tools/FileEditTool/prompt.ts'],
        dsxuGate:
          'source truth must be read before edit, and patch plans must be narrow, unique, and verified',
      },
      {
        area: 'complex task progress',
        sourceAnchors: ['tools/TodoWriteTool/prompt.ts'],
        dsxuGate:
          'complex work exposes one active step, does not mark partial work complete, and keeps blockers visible',
      },
      {
        area: 'agent delegation',
        sourceAnchors: ['tools/AgentTool/prompt.ts'],
        dsxuGate:
          'delegated work is scoped, background results are not fabricated, and parent synthesis waits for evidence',
      },
      {
        area: 'compact and resume',
        sourceAnchors: ['services/compact/prompt.ts', 'query.ts'],
        dsxuGate:
          'resume preserves user intent, files, errors, decisions, pending work, and the direct next step',
      },
    ],
  },
  {
    id: 'P12-10',
    title: 'multi-window permission preemption',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'multi-window permission handoff cannot preempt the active human turn',
    evidenceTests: [
      'phase12-product-window-oracle-v1.test.ts',
      'control-plane-stage-acceptance-v1.test.ts',
      'remote-network-workflow-v1.test.ts',
    ],
    requiredArtifacts: [
      'multi-window replay transcript',
      'permission handoff trace',
      'background notification ordering trace',
      'compact resume owner rule evidence',
    ],
    unresolved: [],
  },
  {
    id: 'P12-17',
    title: 'live cost and routing evidence',
    status: 'PASS',
    decision: 'kept-mainline',
    redline: 'cost routing must use real adapter usage instead of planned estimates',
    evidenceTests: [
      'phase12-live-cost-matrix-v1.test.ts',
      'final-report-usage-evidence-v1.test.ts',
      'cost-cache-live-task-evidence-v1.test.ts',
      'deepseek-v4-control-v1.test.ts',
    ],
    requiredArtifacts: [
      'adapter usage record',
      'live provider usage record',
      'route cost report',
      'final report modelCostEvidence',
    ],
    unresolved: [],
  },
  {
    id: 'P12-19',
    title: 'black-box comparison replay',
    status: 'PARTIAL',
    decision: 'deferred',
    redline: 'external comparison requires same-task raw logs and cannot use dry plans as ranking evidence',
    evidenceTests: [
      'phase12-raw-comparison-v1.test.ts',
      'product-reality-hardening-contract-v1.test.ts',
      'reference-governance-absorption-contract-v1.test.ts',
      'goal-driven-optimization-contract-v1.test.ts',
    ],
    requiredArtifacts: ['same-task raw external logs', 'delta report'],
    unresolved: ['requires external runner evidence before any public comparison claim'],
  },
] as const

export function buildPhase12ExperienceOracle(
  scenarios: readonly Phase12Scenario[] = PHASE12_EXPERIENCE_ORACLE,
): Phase12OracleSummary {
  const pass = scenarios.filter(scenario => scenario.status === 'PASS').length
  const partial = scenarios.filter(scenario => scenario.status === 'PARTIAL').length
  const blocked = scenarios.filter(scenario => scenario.status === 'BLOCKED').length
  const nextQueue = scenarios
    .filter(scenario => scenario.status !== 'PASS')
    .map(scenario => scenario.id)

  return {
    schemaVersion: 'dsxu.phase12-experience-oracle.v1',
    overallStatus: blocked > 0 ? 'BLOCKED' : partial > 0 ? 'PARTIAL' : 'PASS',
    pass,
    partial,
    blocked,
    mustNotClaimDone: partial > 0 || blocked > 0,
    nextQueue,
    scenarios,
  }
}
