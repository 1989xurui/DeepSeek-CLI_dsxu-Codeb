export type ProductRealityHardeningState =
  | 'live_required'
  | 'external_runner_required'
  | 'cleanup_remaining'

export type ProductRealityHardeningItem = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  requiredBehaviors: readonly string[]
  acceptance: readonly string[]
  benchmarkCases: readonly string[]
  state: ProductRealityHardeningState
}

export type ProductRealityHardeningContract = {
  runtime: 'DSXU Product Reality Hardening'
  sourceBoundary: {
    referenceRoot: string
    writable: false
  }
  target: string
  rules: readonly string[]
  items: readonly ProductRealityHardeningItem[]
  gates: {
    live: string
    dry: string
    externalComparison: string
  }
}

const items: readonly ProductRealityHardeningItem[] = [
  {
    id: 'P0 Real Product Task Scale',
    objective:
      'Move beyond evidence-only checks into real Read/Edit/Run/Verify product tasks with fixture mutations and explicit PASS/PARTIAL/FAIL.',
    referenceBehavior: ['query.ts', 'Tool.ts', 'tools/*/prompt.ts'],
    dsxuLanding: ['scripts/benchmark/dsxu-mainline-benchmark.ts', 'tmp/v8-live-fixtures'],
    requiredBehaviors: [
      'multi-file feature keeps existing tests and adds the missing behavior',
      'review task fixes code instead of only describing the defect',
      'bugfix/recovery task runs a failing test before the fix and reruns after edit',
      'Workflow route can fail or be unavailable and DSXU falls back to scoped manual repair',
      'MCP dirty/error result triggers replan instead of fake PASS',
      'Agent worker long run returns parent synthesis from evidence only',
    ],
    acceptance: [
      'product-reality-large-feature-live passes with fixture mutation and bun test',
      'product-reality-review-fix-live passes with fixture mutation and bun test',
      'product-reality-second-failure-live passes with fixture mutation and bun test',
      'product-reality-workflow-fallback-live passes with fixture mutation and bun test',
    ],
    benchmarkCases: [
      'product-reality-large-feature-live',
      'product-reality-review-fix-live',
      'product-reality-second-failure-live',
      'product-reality-workflow-fallback-live',
    ],
    state: 'live_required',
  },
  {
    id: 'P1 Query Loop Extreme Recovery',
    objective:
      'Continue absorbing reference query.ts, query/stopHooks.ts, and Tool.ts edge recovery into DSXU query contracts.',
    referenceBehavior: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
    dsxuLanding: ['src/query.ts', 'src/dsxu/engine/query-loop.ts', 'src/dsxu/engine/recovery'],
    requiredBehaviors: [
      'mixed tool_use success/failure returns ordered results',
      'misordered or orphan tool_result cannot produce PASS',
      'failed assistant messages are cleaned before retry',
      'max turns produces high-quality PARTIAL',
      'stop hook failure becomes PARTIAL/FAIL without spin',
      'tool summary and compact continuation reduce drift',
    ],
    acceptance: ['product-reality-query-extreme-live passes'],
    benchmarkCases: ['product-reality-query-extreme-live'],
    state: 'live_required',
  },
  {
    id: 'P2 Agent Trusted Team Governance',
    objective:
      'Make Agent behavior closer to trusted team governance: ownership, non-overlap, verifier rejection, SendMessage repair, and evidence-only parent synthesis.',
    referenceBehavior: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: [
      'src/tools/AgentTool/prompt.ts',
      'src/tools/SendMessageTool',
      'src/services/AgentSummary/agentSummary.ts',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    requiredBehaviors: [
      'worker ownership is explicit',
      'multiple Agents do not repeat searches or write the same scope',
      'worker tool pool is narrowed by task',
      'permission inheritance cannot expand authority',
      'verifier rejects fake PASS and parent replans',
      'AgentSummary preserves failures',
    ],
    acceptance: ['product-reality-agent-team-live passes'],
    benchmarkCases: ['product-reality-agent-team-live'],
    state: 'live_required',
  },
  {
    id: 'P3 Compact Memory Cross-Turn Recovery',
    objective:
      'Make compact and memory resume behave as source-grounded hints, never as replacement truth.',
    referenceBehavior: ['services/compact', 'services/SessionMemory', 'services/autoDream', 'services/extractMemories'],
    dsxuLanding: [
      'src/dsxu/engine/compact.ts',
      'src/services/SessionMemory',
      'src/services/autoDream',
      'src/dsxu/engine/memory-pipeline.ts',
    ],
    requiredBehaviors: [
      'forced compact resume rereads source before editing',
      'failed command, permission denial, changed files, pending task/agent, and next action are preserved',
      'AutoDream lock/throttle/dedupe/rollback prevents duplicate or unverified state',
      'summary cannot convert unverified state to PASS',
    ],
    acceptance: ['product-reality-compact-memory-live passes'],
    benchmarkCases: ['product-reality-compact-memory-live'],
    state: 'live_required',
  },
  {
    id: 'P4 Real MCP Ecosystem Chain',
    objective:
      'Keep MCP on a real external-server-style chain with resource read, tool call, reconnect, stale-cache clearing, and redaction.',
    referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
    dsxuLanding: ['src/services/mcp', 'src/dsxu/engine/mcp-client.ts', 'src/dsxu/engine/engine-tool-adapter.ts'],
    requiredBehaviors: [
      'stdio server connect/list/read/call path is covered',
      'timeout and server error trigger replan',
      'reconnect clears stale cache',
      'credential-like values do not enter model, summary, or logs',
    ],
    acceptance: ['product-reality-mcp-ecosystem-live passes'],
    benchmarkCases: ['product-reality-mcp-ecosystem-live'],
    state: 'live_required',
  },
  {
    id: 'P5 Permission Usability',
    objective:
      'Make permissions safe and usable for real external project work without weakening deny precedence.',
    referenceBehavior: ['utils/permissions', 'utils/bash', 'utils/powershell', 'tools/BashTool', 'tools/PowerShellTool'],
    dsxuLanding: ['src/dsxu/engine/permission-usability.ts', 'src/tools/BashTool', 'src/tools/PowerShellTool'],
    requiredBehaviors: [
      'external directory scoped grant supports Windows and WSL paths',
      'grant display, expiration, and revoke are represented',
      'dependency mutation and network download ask',
      'network execute and destructive delete deny or hard deny',
      'acceptEdits cannot override deny precedence',
    ],
    acceptance: ['product-reality-permission-ux-live passes'],
    benchmarkCases: ['product-reality-permission-ux-live'],
    state: 'live_required',
  },
  {
    id: 'P6 Tool Prompt Second-Round Discipline',
    objective:
      'Harden existing prompt discipline into concrete weak-model anti-misuse rules for Read/Edit/Write/Grep/Glob/shell/Agent/MCP/Workflow/Skill.',
    referenceBehavior: ['constants/prompts.ts', 'constants/systemPromptSections.ts', 'tools/*/prompt.ts'],
    dsxuLanding: ['src/tools/**/prompt.ts', 'src/dsxu/engine/system-prompt.ts'],
    requiredBehaviors: [
      'Read does not read directories and does not use cache as proof after edit',
      'Edit success goes to verification and never repeats stale old_string',
      'Write creates scoped new files only',
      'Grep searches content while Glob finds filenames',
      'shell does not bypass dedicated file tools',
      'Workflow is a route contract, not a second runtime',
    ],
    acceptance: ['product-reality-prompt-discipline-live passes'],
    benchmarkCases: ['product-reality-prompt-discipline-live'],
    state: 'live_required',
  },
  {
    id: 'P7 Provider P6 Cleanup',
    objective:
      'Continue cleanup of legacy wording, old control adapter classification, remote/auth text, historical Remaining notes, mojibake comments, audit probes, and temp artifact policy.',
    referenceBehavior: ['old control shell', 'old session shell', 'old proxy shell', 'services/auth-compat', 'services/remoteManagedSettings'],
    dsxuLanding: ['src/dsxu/engine/provider-contract.ts', 'src/dsxu/engine/provider-alias.ts', '.dsxu/ops/MAINLINE_LEDGER.md'],
    requiredBehaviors: [
      'default CLI/TUI import scan remains clean',
      'default tool pool and prompt do not expose old shells',
      'legacy aliases are explicit legacy',
      'five smoke stays green after cleanup',
    ],
    acceptance: ['product-reality-p6-clean-smoke-live passes'],
    benchmarkCases: ['product-reality-p6-clean-smoke-live'],
    state: 'cleanup_remaining',
  },
  {
    id: 'P8 Public Cross-Model Evaluation',
    objective:
      'Prepare but do not fabricate same-task public comparison against reference coding workflow, GPT/Codex, Gemini, Aider, and Cline.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'services/compact', 'services/mcp'],
    dsxuLanding: ['.dsxu/eval/model-comparison-template.json', 'scripts/benchmark/dsxu-mainline-benchmark.ts'],
    requiredBehaviors: [
      '30-50 fixed live benchmarks are selected',
      'external raw logs are required for every compared model',
      'dry planned is never counted as live success',
      'metrics include pass rate, turns, cost, wall clock, repeated Edit, tool misuse, fake PASS, permission violation, recovery, compact resume, and Agent success',
    ],
    acceptance: ['external report is blocked until raw external logs exist'],
    benchmarkCases: ['external-runner-required'],
    state: 'external_runner_required',
  },
]

export function getProductRealityHardeningContract(): ProductRealityHardeningContract {
  return {
    runtime: 'DSXU Product Reality Hardening',
    sourceBoundary: {
      referenceRoot: 'D:/DSXU-code/reference-input',
      writable: false,
    },
    target:
      'Turn staged DSXU evidence into larger product-like tasks and stronger recovery, Agent, memory, MCP, permission, prompt, cleanup, and comparison boundaries while preserving one default mainline.',
    rules: [
      'Do not copy or run reference provider shells.',
      'Do not open V11/V12 or any second runnable system.',
      'Real product live tasks must perform Read/Edit/Run/Verify with fixture file changes and explicit PASS/PARTIAL/FAIL.',
      'Unsafe external effects must be represented by scoped permission/MCP harnesses, not destructive real-world actions.',
      'Public comparison requires same-task external raw logs and cannot be inferred from local DSXU gates.',
    ],
    items,
    gates: {
      live: 'product-reality-hardening-live',
      dry: 'product-reality-hardening',
      externalComparison: 'DSXU-Code-横向评测报告-YYYYMMDD.md',
    },
  }
}

export function getProductRealityHardeningItem(idOrPrefix: string): ProductRealityHardeningItem | undefined {
  return items.find(item => item.id === idOrPrefix || item.id.startsWith(idOrPrefix))
}
