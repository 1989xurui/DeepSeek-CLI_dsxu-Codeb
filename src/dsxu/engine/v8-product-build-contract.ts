export type DSXUV8State =
  | 'planned'
  | 'ready_to_build'
  | 'evidence_green'
  | 'blocked_by_compatibility'
  | 'requires_real_live'

export type DSXUV8Item = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  buildTasks: readonly string[]
  acceptance: readonly string[]
  state: DSXUV8State
}

export type DSXUV8ProductBuildContract = {
  runtime: 'DSXU V8 Product Build'
  target: string
  rules: readonly string[]
  items: readonly DSXUV8Item[]
  releaseGate: {
    dryGate: string
    mutationLiveGate: string
    minimumBenchmarkCount: number
  }
}

const providerBackend: DSXUV8Item = {
  id: 'V8-1 Provider Backend Replacement',
  objective:
    'Replace reference-era provider shells with DSXU-owned remote session, event stream, permission callback, task sync, and credential vault contracts.',
  referenceBehavior: [
    'old control shell',
    'old session shell',
    'old proxy shell',
    'services/auth-compat',
    'services/remoteManagedSettings',
  ],
  dsxuLanding: [
    'src/dsxu/engine/provider-contract.ts',
    'src/dsxu/engine/provider-alias.ts',
    'src/dsxu/engine/provider-backend/local-provider-backend.ts',
    'src/dsxu/engine/provider-backend/*',
    'src/entrypoints/cli.tsx',
    'src/main.tsx',
    'src/tools/SendMessageTool/SendMessageTool.ts',
  ],
  buildTasks: [
    'Add DSXU local provider backend with durable event stream.',
    'Add DSXU disabled remote backend that returns typed blocked results.',
    'Add provider credential vault facade for MCP/provider secrets.',
    'Route --remote, remote-control, and legacy target selectors through DSXU provider contract or legacy-flag-only shims.',
    'Keep old shell directories archived after dynamic imports are remapped to DSXU provider facades.',
  ],
  acceptance: [
    'default CLI never imports old control/session/proxy/auth shells',
    'legacy flags do not import archived shell directories on the default source path',
    'provider event stream records session, tool, permission, task sync, and remote blocked events',
    'MCP/provider credentials are redacted before model, summary, and logs',
  ],
  state: 'evidence_green',
}

const mutationLiveSuite: DSXUV8Item = {
  id: 'V8-2 Real Mutation Live Suite',
  objective:
    'Upgrade scoped evidence benchmarks into real product tasks that perform Read/Edit/Write/Run/Verify/PASS.',
  referenceBehavior: [
    'query.ts',
    'Tool.ts',
    'tools/*/prompt.ts',
  ],
  dsxuLanding: [
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
    'tmp/v8-live-fixtures',
    '.dsxu/runs/benchmarks',
    '.dsxu/runs/five-smoke',
  ],
  buildTasks: [
    'Add multifile bugfix fixture.',
    'Add feature-with-tests fixture.',
    'Add review-then-fix fixture.',
    'Add compact-resume-edit fixture.',
    'Add permission-deny-replan fixture.',
    'Add workflow-error-recovery fixture.',
  ],
  acceptance: [
    'each mutation live case edits or writes only its fixture scope',
    'each case runs the smallest verification command',
    'final output contains PASS only after verification evidence',
    'PARTIAL is allowed only for explicit environment limits',
  ],
  state: 'evidence_green',
}

const stopHooksRuntime: DSXUV8Item = {
  id: 'V8-3 StopHook Product Runtime',
  objective:
    'Make stop hooks real product governance for verifier, memory extraction, scoped MagicDocs, failure-to-PARTIAL, and no-loop behavior.',
  referenceBehavior: [
    'query/stopHooks.ts',
    'services/MagicDocs',
    'services/extractMemories',
  ],
  dsxuLanding: [
    'src/query.ts',
    'src/query/stopHooks.ts',
    'src/utils/hooks/postSamplingHooks.ts',
    'src/utils/hooks/stopHooks.ts',
  ],
  buildTasks: [
    'Add verifier-before-final hook fixture.',
    'Add memory extraction after long task fixture.',
    'Add scoped MagicDocs idle-turn fixture.',
    'Add hook failure PARTIAL/FAIL fixture.',
    'Add no-loop regression where one hook blocks then stops.',
  ],
  acceptance: [
    'hooks never run while tool_use lacks matching tool_result',
    'hook failures surface PARTIAL/FAIL instead of spinning',
    'MagicDocs writes only allowlisted docs with Edit',
    'verifier hook can prevent unverified PASS',
  ],
  state: 'evidence_green',
}

const sessionMemoryResume: DSXUV8Item = {
  id: 'V8-4 SessionMemory AutoDream Resume',
  objective:
    'Prove long-task memory extraction, AutoDream consolidation, compaction, and resume can continue unfinished work without replacing source evidence.',
  referenceBehavior: [
    'services/SessionMemory',
    'services/autoDream',
    'services/compact',
  ],
  dsxuLanding: [
    'src/services/SessionMemory',
    'src/services/autoDream',
    'src/dsxu/engine/compact.ts',
    'src/dsxu/engine/memory/*',
  ],
  buildTasks: [
    'Add forced compact/resume fixture.',
    'Record user goal, changed files, failed commands, permission denials, pending tasks, pending agents, and verification status.',
    'Add AutoDream duplicate consolidation fixture.',
    'Add lock/throttle regression.',
  ],
  acceptance: [
    'resume uses memory as hints and rereads source evidence before editing',
    'AutoDream does not run overlapping consolidations',
    'compact snapshot survives continuation',
    'verifier confirms the resumed task completes',
  ],
  state: 'evidence_green',
}

const agentLongRun: DSXUV8Item = {
  id: 'V8-5 Agent Long-Run Suite',
  objective:
    'Harden Agent workers for multi-agent no-overlap, scoped tool pools, permission inheritance, fake-PASS rejection, AgentSummary, and SendMessage repair.',
  referenceBehavior: [
    'services/AgentSummary',
    'coordinator',
    'tools/AgentTool',
    'tools/SendMessageTool',
  ],
  dsxuLanding: [
    'src/tools/AgentTool/prompt.ts',
    'src/tools/AgentTool/*',
    'src/tools/SendMessageTool/*',
    'src/services/AgentSummary/agentSummary.ts',
  ],
  buildTasks: [
    'Add two-worker no-overlap fixture.',
    'Add worker tool-pool narrowing fixture.',
    'Add worker permission inheritance fixture.',
    'Add verifier rejects fake PASS fixture.',
    'Add AgentSummary periodic long-run fixture.',
  ],
  acceptance: [
    'parent synthesis cites worker evidence only',
    'worker cannot exceed inherited tool/permission boundaries',
    'SendMessage correction reaches the running worker',
    'verifier rejection causes replan instead of final PASS',
  ],
  state: 'evidence_green',
}

const realMcpServer: DSXUV8Item = {
  id: 'V8-6 Real MCP Server Harness',
  objective:
    'Run a real local MCP server through connect, list resources, read resource, call tool, disconnect/reconnect, server error, and credential redaction.',
  referenceBehavior: [
    'services/mcp',
    'tools/MCPTool',
    'tools/ReadMcpResourceTool',
  ],
  dsxuLanding: [
    'src/services/mcp',
    'src/tools/MCPTool',
    'src/tools/ReadMcpResourceTool',
    'scripts/benchmark/fixtures/mcp-server',
  ],
  buildTasks: [
    'Add local fake MCP server fixture.',
    'Add resource read and tool call live case.',
    'Add disconnect/reconnect or server error case.',
    'Inject fake credentials and verify redaction in model context, summary prompt, and logs.',
  ],
  acceptance: [
    'real MCP server receives calls',
    'resource and tool result are returned through DSXU adapter',
    'credential values do not appear in model/tool summary/log outputs',
    'error shape drives replan instead of fake success',
  ],
  state: 'evidence_green',
}

const permissionUsability: DSXUV8Item = {
  id: 'V8-7 Permission Usability',
  objective:
    'Make permission policy safe and useful for coding: test/build allowlist, scoped external writes, dependency mutation ask, network execute controls, destructive hard deny, and Windows/WSL path coverage.',
  referenceBehavior: [
    'utils/permissions',
    'utils/bash',
    'utils/powershell',
  ],
  dsxuLanding: [
    'src/utils/permissions',
    'src/utils/bash',
    'src/utils/powershell',
    'src/dsxu/engine/mainline-tool-adapter.ts',
    'src/dsxu/engine/permission-usability.ts',
  ],
  buildTasks: [
    'Define project-local test/build allowlist.',
    'Define external workspace write grants such as D:/shooter-game and /mnt/d/shooter-game.',
    'Add dependency mutation ask policy.',
    'Add network download/execute strong ask or deny policy.',
    'Expand Windows/WSL path parser fixtures.',
  ],
  acceptance: [
    'safe project tests can run without accidental fail-close',
    'external writes require explicit scoped grant',
    'destructive delete and hidden/sensitive paths remain hard-deny',
    'PowerShell and Bash share one DSXU permission decision chain',
  ],
  state: 'evidence_green',
}

const docsCleanup: DSXUV8Item = {
  id: 'V8-8 Encoding and Docs Cleanup',
  objective:
    'Clean V3-V7 documents, ledger mojibake, and default-visible text without breaking compatibility aliases.',
  referenceBehavior: [
    'not applicable',
  ],
  dsxuLanding: [
    '.dsxu/ops',
    '.dsxu/ops/MAINLINE_LEDGER.md',
    'src/main.tsx',
    'src/entrypoints/*',
  ],
  buildTasks: [
    'Normalize V3-V7 docs to clean UTF-8 display.',
    'Clean MAINLINE_LEDGER mojibake in new sections first.',
    'Sweep user/model-visible runtime strings.',
    'Leave non-default legacy comments lower priority unless they affect docs.',
  ],
  acceptance: [
    'V8 docs render readable Chinese and ASCII paths',
    'default-visible strings contain DSXU-owned wording',
    'compatibility aliases are not broken by wording cleanup',
  ],
  state: 'ready_to_build',
}

export function getDsxuV8ProductBuildContract(): DSXUV8ProductBuildContract {
  return {
    runtime: 'DSXU V8 Product Build',
    target:
      'Turn DSXU from evidence-green into product-grade DeepSeek coding agent behavior by building provider replacement, mutation live suites, real hooks, memory resume, Agent long-run, real MCP, permission usability, and documentation cleanup.',
    rules: [
      'Do not mark a real product capability complete from Grep-only evidence.',
      'Do not move old provider shells until compatibility imports are removed or remapped.',
      'Every mutation live case must edit/write inside an explicit fixture scope.',
      'Every PASS marker must follow verification evidence.',
      'Memory and summaries are hints, never substitutes for source evidence.',
    ],
    items: [
      providerBackend,
      mutationLiveSuite,
      stopHooksRuntime,
      sessionMemoryResume,
      agentLongRun,
      realMcpServer,
      permissionUsability,
      docsCleanup,
    ],
    releaseGate: {
      dryGate: 'v8-product-build',
      mutationLiveGate: 'v8-mutation-live',
      minimumBenchmarkCount: 92,
    },
  }
}

export function getDsxuV8Item(id: string): DSXUV8Item | undefined {
  return getDsxuV8ProductBuildContract().items.find(item => item.id.startsWith(id))
}
