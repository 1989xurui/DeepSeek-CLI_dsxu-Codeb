export type DSXUV9State =
  | 'ready_to_build'
  | 'evidence_green'
  | 'blocked_by_compatibility'
  | 'requires_release_live'

export type DSXUV9Item = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  absorptionRules: readonly string[]
  acceptance: readonly string[]
  state: DSXUV9State
}

export type DSXUV9CompletionContract = {
  runtime: 'DSXU V9 Reference High-Value Behavior Completion'
  target: string
  rules: readonly string[]
  items: readonly DSXUV9Item[]
  releaseGate: {
    dryGate: string
    selectedLiveGate: string
    minimumBenchmarkCount: number
  }
}

const providerShellFinal: DSXUV9Item = {
  id: 'V9-1 Provider Shell Replacement Final',
  objective:
    'Finish replacing reference-era control/session/proxy/auth provider shells with DSXU-owned local/remote-provider contracts and archive old shells only after default paths prove unreachable.',
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
    'src/services/bridge/dsxuLocalProviderBackend.ts',
    'src/entrypoints/cli.tsx',
    'src/main.tsx',
  ],
  absorptionRules: [
    'Absorb remote-session, event-stream, permission-callback, task-sync, and credential-vault semantics only.',
    'Do not import old control/session/proxy shells on default DSXU_CODE_MODE=1 CLI/TUI paths.',
    'Archived old shells must remain outside the default source tree; archived aliases route through DSXU provider contract.',
  ],
  acceptance: [
    'remote-control, rc, remote, sync, and legacy target aliases resolve through DSXU provider contract in default mode',
    'provider events include session, tool, permission, task sync, and remote blocked records',
    'provider credentials are redacted before model, tool summary, transcript, and logs',
    'old shell directories are archived after explicit archived imports are gone and live smoke is green',
  ],
  state: 'evidence_green',
}

const queryLoopLiveRecovery: DSXUV9Item = {
  id: 'V9-2 Query Loop Live Recovery',
  objective:
    'Turn reference query loop recovery behavior into DSXU contracts and real CLI recovery gates for weak-model operation.',
  referenceBehavior: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
  dsxuLanding: [
    'src/query.ts',
    'src/dsxu/engine/query-loop.ts',
    'src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts',
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
  ],
  absorptionRules: [
    'Absorb behavior by contract: tool-result pairing, fallback retry, max-output recovery, compact recovery, failed assistant cleanup, and stop-hook sequencing.',
    'Do not replace DSXU query loop wholesale with upstream code.',
    'Every PASS must follow tool or source verification evidence.',
  ],
  acceptance: [
    'fallback retry and failed assistant cleanup have focused tests',
    'orphan tool_use cannot trigger final PASS or stop-hook completion',
    'max-output/prompt-too-long recovery produces PARTIAL or compact continuation',
    'selected live recovery gate passes',
    'v10-product-query-stophook-live is now part of the selected live gate and runs through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const longTaskMemoryResume: DSXUV9Item = {
  id: 'V9-3 Long Task Memory Resume',
  objective:
    'Productize SessionMemory, AutoDream, compact recovery, and resume so long tasks continue from memory hints while rereading source truth.',
  referenceBehavior: [
    'services/SessionMemory',
    'services/autoDream',
    'services/compact',
  ],
  dsxuLanding: [
    'src/services/SessionMemory',
    'src/services/autoDream',
    'src/dsxu/engine/compact.ts',
    'src/dsxu/engine/__tests__/v8-memory-resume-v1.test.ts',
  ],
  absorptionRules: [
    'Memory is a bounded hint layer, never source truth.',
    'AutoDream must dedupe and lock/throttle background consolidation.',
    'Resume must reread files before edit and verify before PASS.',
  ],
  acceptance: [
    'forced compact/resume fixture preserves goal, changed files, failed commands, permission denials, pending agents, and verification state',
    'AutoDream duplicate consolidation is blocked by lock/throttle',
    'resume after compact performs Read/Edit/Run/Verify/PASS in a fixture',
    'v10-product-memory-resume-live is now part of the selected live gate and runs through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const agentSummaryParentSynthesis: DSXUV9Item = {
  id: 'V9-4 AgentSummary Parent Synthesis',
  objective:
    'Make multi-agent long runs safe for weak models with no-overlap ownership, scoped tool pools, permission inheritance, verifier rejection, and evidence-only parent synthesis.',
  referenceBehavior: [
    'services/AgentSummary',
    'tools/AgentTool',
    'tools/SendMessageTool',
    'coordinator',
  ],
  dsxuLanding: [
    'src/services/AgentSummary/agentSummary.ts',
    'src/tools/AgentTool',
    'src/tools/SendMessageTool',
    'src/dsxu/engine/__tests__/v8-agent-long-run-v1.test.ts',
  ],
  absorptionRules: [
    'Parent synthesis must cite worker evidence only.',
    'A verifier rejection must cause replan, not final PASS.',
    'Only one worker owns a write scope at a time.',
  ],
  acceptance: [
    'worker tool pool is dynamically narrowed',
    'worker permission context is inherited and cannot expand silently',
    'AgentSummary does not overlap summaries',
    'default CLI Agent live gate proves worker plus verifier behavior',
    'v10-product-agent-longrun-live is now part of the selected live gate and runs through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const realMcpProcess: DSXUV9Item = {
  id: 'V9-5 Real MCP Server Process',
  objective:
    'Upgrade MCP proof from in-process server to process-backed server semantics: connect, list, read, tool call, error, reconnect, and credential redaction.',
  referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
  dsxuLanding: [
    'src/services/mcp',
    'src/tools/MCPTool',
    'src/tools/ReadMcpResourceTool',
    'src/dsxu/engine/__tests__/v8-real-mcp-server-v1.test.ts',
  ],
  absorptionRules: [
    'Do not expose provider credentials to model, summary, transcript, or logs.',
    'MCP server errors must drive replan, not fake success.',
    'Reconnect must clear stale tool/resource caches.',
  ],
  acceptance: [
    'real MCP server receives resource and tool calls',
    'disconnect/reconnect clears stale cache',
    'credential values are redacted everywhere model-visible',
    'v10-product-real-mcp-process-live is now part of the selected live gate and runs through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const permissionUsabilityMatrix: DSXUV9Item = {
  id: 'V9-6 Permission Usability Matrix',
  objective:
    'Make external project authorization product-usable while preserving one DSXU permission chain for Bash, PowerShell, and file edits.',
  referenceBehavior: ['utils/permissions', 'utils/bash', 'utils/powershell'],
  dsxuLanding: [
    'src/utils/permissions',
    'src/utils/bash',
    'src/utils/powershell',
    'src/dsxu/engine/permission-usability.ts',
  ],
  absorptionRules: [
    'Do not maintain a second shell safety engine.',
    'External writes require explicit scoped grants with visible scope.',
    'Dependency mutation and network execute must ask or deny by policy.',
  ],
  acceptance: [
    'D:/shooter-game and /mnt/d/shooter-game style grants normalize consistently',
    'grant snapshot shows scope, source, and expiration',
    'deny precedence beats acceptEdits and grants',
    'Bash, PowerShell, and file edits share one decision chain',
  ],
  state: 'evidence_green',
}

const benchmarkHundred: DSXUV9Item = {
  id: 'V9-7 Real Product Benchmark 100+',
  objective:
    'Raise the benchmark suite from V8 92 cases to 100+ and keep selected live gates for mutation, recovery, Agent, MCP, compact resume, and permission denial.',
  referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'services/mcp', 'services/compact'],
  dsxuLanding: ['scripts/benchmark/dsxu-mainline-benchmark.ts', '.dsxu/runs/benchmarks'],
  absorptionRules: [
    'Benchmarks must encode product behavior, not just file-name evidence.',
    'Live mutation cases must edit only fixture scopes.',
    'Selected live gates stay release blockers.',
  ],
  acceptance: [
    'full dry benchmark has at least 100 cases',
    'selected V9 live gate includes mutation, recovery, Agent, MCP, compact resume, and permission-deny cases',
    'live failures feed prompt/tool/permission hardening instead of being ignored',
    'full dry benchmark has 117 cases after product-live queue integration',
  ],
  state: 'evidence_green',
}

export function getDsxuV9CompletionContract(): DSXUV9CompletionContract {
  return {
    runtime: 'DSXU V9 Reference High-Value Behavior Completion',
    target:
      'Complete the remaining DSXU single-mainline work by absorbing reference high-value behavior into DSXU provider replacement, recovery, memory resume, Agent synthesis, MCP process handling, permission usability, and 100+ benchmark gates.',
    rules: [
      'Reference D:/DSXU-code/original reference source read-only; absorb behavior semantics, not shells.',
      'Do not move archived shells until default and archived aliases are proven remapped or deleted.',
      'Do not mark Grep-only evidence as product live completion.',
      'Every weak-model live PASS must cite verification evidence.',
      'Memory and summaries are hints, never replacements for source files or command output.',
    ],
    items: [
      providerShellFinal,
      queryLoopLiveRecovery,
      longTaskMemoryResume,
      agentSummaryParentSynthesis,
      realMcpProcess,
      permissionUsabilityMatrix,
      benchmarkHundred,
    ],
    releaseGate: {
      dryGate: 'v9-completion',
      selectedLiveGate: 'v9-selected-live',
      minimumBenchmarkCount: 100,
    },
  }
}

export function getDsxuV9Item(id: string): DSXUV9Item | undefined {
  return getDsxuV9CompletionContract().items.find(item => item.id.startsWith(id))
}
