export type GoalOptimizationArea = {
  id: string
  goal: string
  externalReference: readonly string[]
  dsxuCapabilityBucket: string
  weight: number
  benchmarkCases: readonly string[]
  optimizationSignals: readonly string[]
}

export type GoalDrivenOptimizationContract = {
  runtime: 'DSXU Goal Driven Optimization'
  target: string
  modelAssumption: string
  rules: readonly string[]
  scorecard: readonly GoalOptimizationArea[]
  gates: {
    dry: string
    selectedLive: string
    externalComparison: string
  }
}

const scorecard: readonly GoalOptimizationArea[] = [
  {
    id: 'coding-repair',
    goal: 'Improve real coding repair and feature work, the SWE-bench-like axis.',
    externalReference: ['SWE-bench Verified', 'SWE-rebench style repo bugfix tasks'],
    dsxuCapabilityBucket: 'Bugfix, feature, review-to-fix, failed-test recovery',
    weight: 25,
    benchmarkCases: [
      'product-reality-large-feature-live',
      'product-reality-review-fix-live',
      'product-reality-second-failure-live',
      'product-reality-workflow-fallback-live',
    ],
    optimizationSignals: [
      'fixture file changed',
      'test command ran before and after fix',
      'PASS/PARTIAL/FAIL is explicit',
      'no fake PASS after failing test',
    ],
  },
  {
    id: 'tool-discipline',
    goal: 'Reduce weak-model tool misuse, the Aider-style edit/tool axis.',
    externalReference: ['Aider Polyglot', 'multi-language edit benchmarks'],
    dsxuCapabilityBucket: 'Read/Edit/Write/Grep/Glob/Bash/PowerShell discipline',
    weight: 15,
    benchmarkCases: [
      'tool-prompt-anti-repeat-golden',
      'tool-prompt-read-edit-cache-golden',
      'tool-prompt-shell-bypass-golden',
      'product-reality-prompt-discipline-live',
    ],
    optimizationSignals: [
      'Edit success goes directly to verify',
      'Read unchanged is not used as failure proof after Edit',
      'Grep searches content and Glob finds files',
      'shell does not bypass dedicated file tools',
    ],
  },
  {
    id: 'recovery',
    goal: 'Improve failure recovery and final-state honesty, the Terminal-Bench-style long command axis.',
    externalReference: ['Terminal-Bench', 'agentic terminal task recovery'],
    dsxuCapabilityBucket: 'Query loop recovery, stop hooks, max turns, tool summary',
    weight: 15,
    benchmarkCases: [
      'product-reality-query-extreme-live',
      'query-compact-goal-stability-live',
      'query-max-turns-quality-live',
      'query-tool-summary-recovery-live',
    ],
    optimizationSignals: [
      'mixed tool results do not corrupt state',
      'orphan tool_use cannot PASS',
      'max turns produces useful PARTIAL',
      'PASS stops immediately after verified tests',
    ],
  },
  {
    id: 'agent-governance',
    goal: 'Make Agent behavior trustworthy under weak-model orchestration.',
    externalReference: ['reference coding workflow Agent/Task behavior', 'multi-agent coding assistants'],
    dsxuCapabilityBucket: 'Agent worker, verifier, SendMessage, parent synthesis',
    weight: 15,
    benchmarkCases: [
      'product-reality-agent-team-live',
      'agent-worker-tool-pool-narrow-live',
      'agent-parent-synthesis-evidence-only-live',
      'agent-verifier-reject-parent-replan-live',
    ],
    optimizationSignals: [
      'worker ownership is explicit',
      'tool pool and permission inheritance are narrowed',
      'verifier rejects fake PASS',
      'parent synthesis cites evidence only',
    ],
  },
  {
    id: 'long-context-memory',
    goal: 'Keep long tasks stable through compact and memory.',
    externalReference: ['reference compact/resume/session memory behavior'],
    dsxuCapabilityBucket: 'Compact, SessionMemory, AutoDream, tool-use summary',
    weight: 10,
    benchmarkCases: [
      'product-reality-compact-memory-live',
      'compact-resume-reread-source-live',
      'memory-does-not-hide-failure-live',
      'tool-summary-recovery-contract',
    ],
    optimizationSignals: [
      'memory is hint, not source truth',
      'compact resume rereads source',
      'failed commands and denials survive compact',
      'summary does not convert unverified state to PASS',
    ],
  },
  {
    id: 'permissions',
    goal: 'Make safety usable without letting weak models widen scope.',
    externalReference: ['reference coding workflow permission UX and shell classifiers'],
    dsxuCapabilityBucket: 'Bash/PowerShell/file permissions and scoped grants',
    weight: 10,
    benchmarkCases: [
      'product-reality-permission-ux-live',
      'permission-external-scope-grant-live',
      'permission-network-execute-deny-live',
      'permission-accept-edits-deny-precedence-live',
    ],
    optimizationSignals: [
      'external scoped grants normalize Windows/WSL paths',
      'dependency mutation asks',
      'network execute does not silently run',
      'acceptEdits cannot override deny',
    ],
  },
  {
    id: 'mcp-workflow',
    goal: 'Use external tools without leaking credentials or creating a second runtime.',
    externalReference: ['reference MCP services', 'Workflow/tool ecosystem behavior'],
    dsxuCapabilityBucket: 'MCP server, credential redaction, Workflow route contract',
    weight: 5,
    benchmarkCases: [
      'product-reality-mcp-ecosystem-live',
      'mcp-stale-cache-clear-live',
      'mcp-credential-log-redaction-live',
      'tool-prompt-workflow-not-runtime-golden',
    ],
    optimizationSignals: [
      'MCP credentials do not enter model/summary/log',
      'reconnect clears stale cache',
      'MCP errors trigger replan',
      'Workflow is route contract, not second runtime',
    ],
  },
  {
    id: 'cost-speed',
    goal: 'Keep the low-cost DeepSeek V4 path efficient while improving reliability.',
    externalReference: ['public cost/latency reports for coding agents'],
    dsxuCapabilityBucket: 'turn count, cache stability, repeated Edit reduction, final marker discipline',
    weight: 5,
    benchmarkCases: [
      'v10-cache-stable-layout-live',
      'product-reality-second-failure-live',
      'product-reality-p6-clean-smoke-live',
    ],
    optimizationSignals: [
      'stable prompt prefix remains cacheable',
      'PASS stops immediately',
      'repeated Edit count trends down',
      'live gate cost remains visible in logs',
    ],
  },
]

export function getGoalDrivenOptimizationContract(): GoalDrivenOptimizationContract {
  return {
    runtime: 'DSXU Goal Driven Optimization',
    target:
      'Use public strong-model benchmark categories as a reference map while optimizing DSXU DeepSeek V4 through orchestration, tools, permissions, recovery, context control, Agent, MCP, Workflow, and live gates toward reference coding workflow-class coding and complex task execution.',
    modelAssumption:
      'DeepSeek V4 is treated as a lower-cost, weaker base model that needs DSXU system constraints to approach reference coding workflow-class coding and complex task execution.',
    rules: [
      'External public scores are reference coordinates, not DSXU scores.',
      'DSXU scores require local DSXU logs; public ranking requires same-task external model raw logs.',
      'Dry planned cases count as coverage only, never success.',
      'Optimization follows log evidence: tool misuse, repeated Edit, fake PASS, permission violation, recovery failure, compact drift, Agent fabrication, MCP leakage, cost, and turns.',
      'All changes must land on the single DSXU default mainline.',
    ],
    scorecard,
    gates: {
      dry: 'goal-driven-optimization',
      selectedLive: 'goal-driven-selected-live',
      externalComparison: 'DSXU-Code-横向评测报告-YYYYMMDD.md',
    },
  }
}

export function getGoalOptimizationArea(id: string): GoalOptimizationArea | undefined {
  return scorecard.find(area => area.id === id)
}
