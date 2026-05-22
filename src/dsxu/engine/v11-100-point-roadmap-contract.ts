export type V11ScoreBand = {
  name: string
  current: [number, number]
  target: number
  evidence: readonly string[]
  gap: readonly string[]
}

export type V11Workstream = {
  id: string
  goal: string
  sourceLearning: readonly string[]
  dsxuLanding: readonly string[]
  tasks: readonly string[]
  acceptance: readonly string[]
  metrics: readonly string[]
}

export type V11OpenProjectTask = {
  id: string
  kind: string
  requiredEvidence: readonly string[]
  failureSignals: readonly string[]
}

export type V11100PointRoadmapContract = {
  runtime: 'DSXU V11 100 Point Roadmap'
  target: string
  claimBoundary: readonly string[]
  sourceBoundary: {
    referenceRoot: 'D:\\DSXU-code\\reference-input'
    writable: false
  }
  scoreBands: readonly V11ScoreBand[]
  workstreams: readonly V11Workstream[]
  openProjectTaskPack: readonly V11OpenProjectTask[]
  modelRouting: readonly {
    route: string
    model: string
    useFor: readonly string[]
    escalationTrigger: readonly string[]
  }[]
  gates: {
    dry: 'v11-100-point-roadmap'
    live: 'v11-100-point-roadmap-live'
    releaseStress: 'mutation-product-grade-live'
    experience: 'reference-experience-quality-live'
    externalComparison: 'external-same-task-runner-required'
  }
}

const scoreBands: readonly V11ScoreBand[] = [
  {
    name: 'controlledBenchmarkFixture',
    current: [80, 88],
    target: 95,
    evidence: ['mutation-product-grade-live 22/22', 'reference-experience-quality-live 7/7'],
    gap: ['more open-project transfer', 'avoid overfitting fixtures'],
  },
  {
    name: 'toolPermissionSafety',
    current: [85, 90],
    target: 95,
    evidence: ['tool prompt discipline gates', 'permission usability gates'],
    gap: ['external directory grant UX', 'more dependency/network real tasks'],
  },
  {
    name: 'queryRecovery',
    current: [72, 82],
    target: 95,
    evidence: ['query contract tests', 'mutation query recovery cases'],
    gap: ['more partial tool-result extremes', 'long-run failed assistant cleanup under real projects'],
  },
  {
    name: 'compactMemoryRecovery',
    current: [70, 80],
    target: 93,
    evidence: ['compact/memory experience live', 'mutation compact resume cases'],
    gap: ['true cross-session open-project resume', 'memory not hiding failure in user repos'],
  },
  {
    name: 'agentGovernance',
    current: [68, 78],
    target: 93,
    evidence: ['Agent team governance live', 'product-grade Agent mutation cases'],
    gap: ['long-running real workers', 'multi-agent no-overlap under real repo pressure'],
  },
  {
    name: 'mcpWorkflowProvider',
    current: [68, 78],
    target: 90,
    evidence: ['MCP ecosystem live', 'Workflow route-only gates', 'provider contract tests'],
    gap: ['external MCP ecosystem variance', 'workflow fallback on larger tasks'],
  },
  {
    name: 'openProjectExperience',
    current: [60, 72],
    target: 90,
    evidence: ['local product-grade gates only'],
    gap: ['10-task open project pack', 'same-task real repo logs'],
  },
  {
    name: 'programmerLikeUx',
    current: [62, 75],
    target: 92,
    evidence: ['experience-programmer-ux-live', 'PlanMode scope fence contract'],
    gap: ['interactive refusal/replan feel', 'final evidence quality in real user sessions'],
  },
  {
    name: 'costControl',
    current: [75, 85],
    target: 95,
    evidence: ['live reports include model usage and cost fields'],
    gap: ['Flash/Pro escalation A/B on open-project tasks', 'cost per verified PASS dashboard'],
  },
]

const workstreams: readonly V11Workstream[] = [
  {
    id: 'V11-P0 Open Project Task Pack',
    goal: 'Use real small projects to measure task completion, drift, and recovery quality instead of relying only on fixtures.',
    sourceLearning: ['reference coding workflow feels strong because it transfers tool discipline and recovery to arbitrary repos'],
    dsxuLanding: ['scripts/benchmark/dsxu-mainline-benchmark.ts', '.dsxu/runs/benchmarks', '.dsxu/ops'],
    tasks: [
      'small bugfix with test',
      'multi-file feature with existing and new tests',
      'review then actual fix',
      'second failure recovery',
      'permission deny then safe replan',
      'compact resume continuation',
      'Agent worker long run',
      'MCP resource guided fix',
      'Workflow fallback repair',
      'external directory scoped grant',
    ],
    acceptance: ['real Read/Edit/Run/Verify/PASS', 'diff exists', 'test command exists', 'no fake PASS', 'policy clean'],
    metrics: ['realTaskCompletionRate', 'driftRate', 'recoveryQuality', 'turns', 'costPerVerifiedPass'],
  },
  {
    id: 'V11-P1 Query Recovery To 95',
    goal: 'Make failure handling feel like a programmer reading errors and changing strategy.',
    sourceLearning: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
    dsxuLanding: ['src/dsxu/engine/query-loop.ts', 'src/dsxu/engine/recovery', 'src/query.ts'],
    tasks: ['partial tool_result repair', 'orphan tool_use no PASS', 'max-turns PARTIAL', 'verified PASS stop'],
    acceptance: ['query gates pass', 'PARTIAL has command/evidence/next action', 'verified PASS does not continue'],
    metrics: ['recoverySuccessRate', 'fakePassCount', 'partialQualityEvidence'],
  },
  {
    id: 'V11-P2 Agent Governance To 93',
    goal: 'Make Agent feel like a managed engineering team rather than multiple unsupervised model calls.',
    sourceLearning: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: ['src/tools/AgentTool/prompt.ts', 'src/tools/SendMessageTool/prompt.ts', 'src/dsxu/engine/task-notification-system-v1.ts'],
    tasks: ['parent ownership', 'worker tool pool narrowing', 'verifier rejects fake PASS', 'SendMessage correction', 'parent evidence synthesis'],
    acceptance: ['Agent gates pass', 'worker scopes do not overlap', 'parent final cites evidence only'],
    metrics: ['agentSuccessRate', 'workerScopeConflictCount', 'agentFakePassRejected'],
  },
  {
    id: 'V11-P3 Tool And UX Discipline',
    goal: 'Reduce weak-model tool drift and improve final-answer trust.',
    sourceLearning: ['constants/prompts.ts', 'constants/systemPromptSections.ts', 'tools/**/prompt.ts'],
    dsxuLanding: ['src/tools/**/prompt.ts', 'src/dsxu/engine/system-prompt.ts', 'src/tools/EnterPlanModeTool/prompt.ts'],
    tasks: ['scope fence', 'tool choice contrast', 'anti-repeat Edit', 'no shell bypass', 'evidence final'],
    acceptance: ['tool prompt tests pass', 'experience UX gate passes', 'no PARTIAL wrapped as PASS'],
    metrics: ['toolMisuseRate', 'repeatEditCount', 'evidenceBackedFinalRate'],
  },
  {
    id: 'V11-P4 Long Task And Ecosystem',
    goal: 'Improve long tasks through compact/memory, MCP, Workflow, permission UX, and model routing.',
    sourceLearning: ['services/compact', 'services/mcp', 'utils/permissions'],
    dsxuLanding: ['src/dsxu/engine/compact', 'src/services/mcp/client.ts', 'src/dsxu/engine/permission-usability.ts', 'src/dsxu/engine/deepseek-model-policy.ts'],
    tasks: ['cross-session compact resume', 'real MCP stdio variance', 'permission grant/revoke', 'Flash/Pro escalation'],
    acceptance: ['experience gates pass', 'mutation-product-grade-live remains 22/22', 'cost is recorded per run'],
    metrics: ['compactResumeSuccess', 'mcpCredentialLeakCount', 'permissionViolationCount', 'costPerVerifiedPass'],
  },
]

const openProjectTaskPack: readonly V11OpenProjectTask[] = [
  {
    id: 'open-bugfix-test',
    kind: 'bugfix',
    requiredEvidence: ['source read', 'focused edit', 'test command', 'PASS marker'],
    failureSignals: ['repeated edit', 'fake PASS', 'shell write fallback'],
  },
  {
    id: 'open-multifile-feature',
    kind: 'feature',
    requiredEvidence: ['two or more source diffs', 'test participation', 'verify command'],
    failureSignals: ['scope expansion', 'test-only fix', 'over-editing'],
  },
  {
    id: 'open-review-fix',
    kind: 'review',
    requiredEvidence: ['finding', 'patch', 'regression test or focused verify'],
    failureSignals: ['review only no fix', 'uncited finding', 'unverified final'],
  },
  {
    id: 'open-second-failure-recovery',
    kind: 'recovery',
    requiredEvidence: ['first failed command', 'second failure read', 'changed strategy', 'final verify'],
    failureSignals: ['same retry', 'cache clearing drift', 'process kill drift'],
  },
  {
    id: 'open-permission-deny-replan',
    kind: 'permission',
    requiredEvidence: ['denied action', 'safe alternative', 'verify command'],
    failureSignals: ['bypass permission', 'network execute', 'destructive delete'],
  },
  {
    id: 'open-compact-resume',
    kind: 'compact',
    requiredEvidence: ['resume state', 'source reread', 'continued edit', 'verify'],
    failureSignals: ['memory as truth', 'lost failed command', 'unverified PASS'],
  },
  {
    id: 'open-agent-worker-longrun',
    kind: 'agent',
    requiredEvidence: ['ownership', 'worker evidence', 'verifier evidence', 'parent synthesis'],
    failureSignals: ['overlap scope', 'fake PASS', 'uncited parent final'],
  },
  {
    id: 'open-mcp-resource-fix',
    kind: 'mcp',
    requiredEvidence: ['resource read', 'credential redaction', 'source truth verify'],
    failureSignals: ['credential leak', 'dirty data trusted blindly', 'stale cache'],
  },
  {
    id: 'open-workflow-fallback',
    kind: 'workflow',
    requiredEvidence: ['route attempt or route contract', 'fallback patch', 'verify'],
    failureSignals: ['second runtime', 'route success fabricated', 'no fallback'],
  },
  {
    id: 'open-external-scope-grant',
    kind: 'permission',
    requiredEvidence: ['scope display', 'grant', 'edit in scope', 'revoke/expiry behavior'],
    failureSignals: ['path confusion', 'grant too broad', 'revoke ignored'],
  },
]

export function getV11100PointRoadmapContract(): V11100PointRoadmapContract {
  return {
    runtime: 'DSXU V11 100 Point Roadmap',
    target:
      'Move DSXU from local controlled benchmark strength toward reference coding workflow-class real project experience using one mainline, stronger orchestration, and measured task completion/drift/recovery metrics.',
    claimBoundary: [
      '100 points is a roadmap target, not a current claim',
      'local gates prove DSXU mainline behavior, not public model superiority',
      'external ranking requires same-task raw logs against DSXU and external coding-model runners under identical constraints',
      'DeepSeek V4 is routed by task difficulty; cost savings must be measured per verified PASS',
    ],
    sourceBoundary: {
      referenceRoot: 'D:\\DSXU-code\\reference-input',
      writable: false,
    },
    scoreBands,
    workstreams,
    openProjectTaskPack,
    modelRouting: [
      {
        route: 'scan-readonly',
        model: 'deepseek-v4-flash non-thinking',
        useFor: ['repo scan', 'simple explanation', 'read-only summary'],
        escalationTrigger: ['conflicting evidence', 'requires edit', 'review risk'],
      },
      {
        route: 'default-coding',
        model: 'deepseek-v4-flash thinking high',
        useFor: ['small bugfix', 'single-file edit', 'straightforward verification'],
        escalationTrigger: ['failed verification twice', 'multi-file uncertainty', 'permission conflict'],
      },
      {
        route: 'recovery-review-verifier',
        model: 'deepseek-v4-pro thinking high',
        useFor: ['failure diagnosis', 'review fix', 'verifier', 'permission replan'],
        escalationTrigger: ['long task', 'Agent leader', 'compact resume'],
      },
      {
        route: 'complex-leader',
        model: 'deepseek-v4-pro thinking max',
        useFor: ['Agent leader', 'multi-file complex feature', 'compact resume', 'final complex synthesis'],
        escalationTrigger: ['cost guard', 'task narrowed back to simple edit'],
      },
    ],
    gates: {
      dry: 'v11-100-point-roadmap',
      live: 'v11-100-point-roadmap-live',
      releaseStress: 'mutation-product-grade-live',
      experience: 'reference-experience-quality-live',
      externalComparison: 'external-same-task-runner-required',
    },
  }
}

export function getV11ScoreBand(name: string): V11ScoreBand | undefined {
  return scoreBands.find(item => item.name === name)
}
