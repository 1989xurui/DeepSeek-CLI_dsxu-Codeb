export type DsxuProductizationState =
  | 'green'
  | 'green_with_guard'
  | 'blocked_by_compatibility'
  | 'needs_deeper_live'

export type DsxuProductizationItem = {
  id: string
  goal: string
  referenceBehavior: string
  dsxuLanding: readonly string[]
  requiredEvidence: readonly string[]
  liveGate: readonly string[]
  state: DsxuProductizationState
  nextHardening: string
}

export type DsxuProductizationContract = {
  runtime: 'DSXU Productization'
  target: string
  rules: readonly string[]
  items: readonly DsxuProductizationItem[]
  releaseGate: {
    dryGate: string
    liveGate: string
    minimumBenchmarkCount: number
  }
}

const compatibilityAliasRemoval: DsxuProductizationItem = {
  id: 'productization-1 Compatibility Alias Removal',
  goal:
    'Delete, remap, or explicit-legacy-gate every compatibility alias that can still reach reference-era provider shells.',
  referenceBehavior:
    'reference control, session, proxy, auth, and remote-managed settings are reference shells only. DSXU must not make them part of the default product path.',
  dsxuLanding: [
    'src/entrypoints/cli.tsx',
    'src/entrypoints/init.ts',
    'src/main.tsx',
    'src/tools/SendMessageTool/SendMessageTool.ts',
    'src/tools/BriefTool/upload.ts',
  ],
  requiredEvidence: [
    'remote-control and old control aliases are rejected in DSXU_CODE_MODE',
    'SendMessage legacy targets require an explicit legacy control flag',
    'Brief upload requires an explicit legacy control context',
    'old control/session/proxy dynamic imports are remapped to DSXU provider facades or archived aliases',
  ],
  liveGate: ['productization-compatibility-alias-removal'],
  state: 'green_with_guard',
  nextHardening:
    'Keep --remote, remote-control, legacy target fallback, and Brief upload on DSXU provider contract facades; do not restore archived control/session/proxy shell directories.',
}

const realLongLiveSuite: DsxuProductizationItem = {
  id: 'productization-2 Real Long Live Suite',
  goal:
    'Turn smoke and benchmark evidence into a durable long-task product gate with real edits, verification, recovery, compaction, Agent, permission, and MCP participation.',
  referenceBehavior:
    'reference coding workflow quality is sustained by repeated real coding tasks, not only static source checks.',
  dsxuLanding: [
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
    '.dsxu/runs/five-smoke',
    'src/dsxu/engine/compact.ts',
    'src/query.ts',
  ],
  requiredEvidence: [
    'bugfix, feature, review, repo understanding, and recovery live smoke remain tracked',
    'long-task compact state includes changed files, pending tasks, failed commands, permissions, verifier status, and next actions',
    'benchmark failures are classified before product code changes',
  ],
  liveGate: ['productization-real-long-live-suite'],
  state: 'green_with_guard',
  nextHardening:
    'Add mutation live fixtures that require actual Edit/Write/Run/Verify after each provider/tool/prompt change.',
}

const stopHookRuntimeLive: DsxuProductizationItem = {
  id: 'productization-3 StopHook Runtime Live',
  goal:
    'Prove stop hooks and post-sampling hooks run as safe DSXU governance: verifier before final, memory extraction, scoped docs, and PARTIAL/FAIL on hook failure.',
  referenceBehavior:
    'reference query/stopHooks.ts sequences end-of-turn governance and prevents hook-induced infinite loops.',
  dsxuLanding: [
    'src/query.ts',
    'src/query/stopHooks.ts',
    'src/utils/hooks/postSamplingHooks.ts',
    'src/utils/hooks/stopHooks.ts',
  ],
  requiredEvidence: [
    'post-sampling hooks run after completed sampling',
    'stopHookActive prevents retry loops',
    'preventContinuation and hook_stopped states are surfaced',
    'hook failures do not resurrect a second compact/runtime path',
  ],
  liveGate: ['productization-stophook-runtime-live'],
  state: 'green_with_guard',
  nextHardening:
    'Add live fixtures where a hook blocks final output once, then DSXU reports PARTIAL/FAIL instead of spinning.',
}

const sessionMemoryResume: DsxuProductizationItem = {
  id: 'productization-4 SessionMemory Resume',
  goal:
    'Prove SessionMemory and AutoDream help long-task resume while source files remain the authority.',
  referenceBehavior:
    'reference SessionMemory and AutoDream preserve task state with thresholds, locks, throttles, and consolidation.',
  dsxuLanding: [
    'src/services/SessionMemory/sessionMemory.ts',
    'src/services/autoDream/autoDream.ts',
    'src/services/autoDream/consolidationLock.ts',
    'src/dsxu/engine/compact.ts',
  ],
  requiredEvidence: [
    'token and tool-call thresholds exist',
    'AutoDream consolidation is lock protected',
    'compact state preserves resume-critical fields',
    'memory is supporting context and cannot replace source evidence',
  ],
  liveGate: ['productization-session-memory-resume'],
  state: 'green_with_guard',
  nextHardening:
    'Run forced compact/resume tasks where the second turn must continue an unfinished edit and verify the result.',
}

const agentLongRunGovernance: DsxuProductizationItem = {
  id: 'productization-5 Agent Long-Run Governance',
  goal:
    'Strengthen multi-agent governance: no duplicated work, inherited tool/permission boundaries, verifier rejection of fake PASS, and parent synthesis from evidence.',
  referenceBehavior:
    'reference AgentSummary and coordinator behavior keep parent tasks informed without letting child summaries become fabricated final proof.',
  dsxuLanding: [
    'src/tools/AgentTool/prompt.ts',
    'src/tools/SendMessageTool/SendMessageTool.ts',
    'src/services/AgentSummary/agentSummary.ts',
    'src/query.ts',
  ],
  requiredEvidence: [
    'Agent prompt includes DSXU handoff package and no invented PASS rule',
    'SendMessage continuation reaches running local Agent context',
    'AgentSummary is tool-denied and prevents overlapping summaries',
    'task notification contains result, usage, tool count, and worktree evidence',
  ],
  liveGate: ['productization-agent-long-run-governance'],
  state: 'green_with_guard',
  nextHardening:
    'Add two-worker no-overlap and verifier-rejects-fake-pass mutation/live fixtures.',
}

const realMcpHarness: DsxuProductizationItem = {
  id: 'productization-6 Real MCP Server Harness',
  goal:
    'Keep MCP on a real connection/resource/tool/error/redaction path without provider auth shell leakage.',
  referenceBehavior:
    'reference MCP service behavior is valuable for connection, reconnect, resource read, dynamic tools, and credential protection.',
  dsxuLanding: [
    'src/services/mcp',
    'src/tools/MCPTool',
    'src/tools/ReadMcpResourceTool',
    'src/dsxu/engine/engine-tool-adapter.ts',
    'src/dsxu/engine/provider-contract.ts',
  ],
  requiredEvidence: [
    'dynamic MCP tools execute through the DSXU mainline adapter',
    'ReadMcpResource executes through injected DSXU MCP client context',
    'MCP results are redacted before model re-entry',
    'tool-use summary redaction covers MCP-derived secrets',
  ],
  liveGate: ['productization-real-mcp-server-harness'],
  state: 'green_with_guard',
  nextHardening:
    'Run a local MCP server with resource read, tool call, reconnect/error, and credential redaction in one live fixture.',
}

const permissionUsabilityMatrix: DsxuProductizationItem = {
  id: 'productization-7 Permission Usability Matrix',
  goal:
    'Make permissions safe and usable: read-only allowed, test/build explicit, mutation/network/destructive/hidden paths controlled, and deny precedence absolute.',
  referenceBehavior:
    'reference permissions, bash, and PowerShell classifiers contain safety patterns that DSXU should keep turning into one decision chain.',
  dsxuLanding: [
    'src/utils/permissions',
    'src/utils/bash',
    'src/utils/powershell',
    'src/dsxu/engine/mainline-tool-adapter.ts',
    'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
  ],
  requiredEvidence: [
    'read-only, test/build, file write, dependency mutation, network execute, destructive delete, hidden paths, acceptEdits, and Windows/WSL paths are covered',
    'hard deny dominates callbacks and acceptEdits',
    'Bash and PowerShell share the same adapter permission path',
  ],
  liveGate: ['productization-permission-usability-matrix'],
  state: 'green_with_guard',
  nextHardening:
    'Define a project-local test/build allowlist so safe verification is not unnecessarily fail-closed.',
}

const promptBehaviorEvaluation: DsxuProductizationItem = {
  id: 'productization-8 Prompt Behavior Evaluation',
  goal:
    'Evaluate prompts by behavior under DeepSeek: correct tool choice, no repeated stale edits, scoped PlanMode, Agent continuation, Workflow recovery, and verified final reporting.',
  referenceBehavior:
    'reference tool prompts are valuable because they shape model behavior; DSXU must measure the behavior, not just the text.',
  dsxuLanding: [
    'src/constants/prompts.ts',
    'src/tools/AgentTool/prompt.ts',
    'src/tools/EnterPlanModeTool/prompt.ts',
    'src/tools/*/prompt.ts',
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
  ],
  requiredEvidence: [
    'DSXU DeepSeek Tool-Use Contract remains in the cache-stable prefix',
    'PlanMode includes scope fence, read-only phase, implementation plan, and acceptance',
    'Edit/Write tool results steer to verification',
    'Agent and SendMessage prompts preserve continuation and verifier evidence',
  ],
  liveGate: ['productization-prompt-behavior-evaluation'],
  state: 'green_with_guard',
  nextHardening:
    'Add adversarial live prompts that tempt Glob/Grep misuse, stale Edit repetition, AskUserQuestion misuse, and fake PASS.',
}

const finalResidualArchive: DsxuProductizationItem = {
  id: 'productization-9 Final Residual Archive',
  goal:
    'Move only files proven unused by default DSXU and not required by archived aliases.',
  referenceBehavior:
    'reference provider shells should remain reference/legacy only, not DSXU default product code.',
  dsxuLanding: [
    'archived control shell directory',
    'archived session shell directory',
    'archived proxy shell directory',
    'src/services/auth-compat',
    'src/services/remoteManagedSettings',
    'D:/DSXU-code/non-dsxu-code-project-files',
  ],
  requiredEvidence: [
    'current old shell directories are default-unreachable',
    'current old shell directories are archived outside the active src tree',
    'alias removal/remap is complete for the provider shell directories',
  ],
  liveGate: ['productization-final-residual-archive'],
  state: 'green_with_guard',
  nextHardening:
    'Continue broad P6 cleanup of legacy comments, old audit probes, and non-default wording without restoring old shell directories.',
}

const releaseGate: DsxuProductizationItem = {
  id: 'productization-10 Release Gate',
  goal:
    'Make earlier mainline gates, five smoke tasks, CLI smoke, and selected live long-task gates the release standard.',
  referenceBehavior:
    'reference-level quality comes from continuous regression gates and real task evidence.',
  dsxuLanding: [
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
    '.dsxu/ops/MAINLINE_LEDGER.md',
    '.dsxu/runs/benchmarks',
    '.dsxu/runs/five-smoke',
  ],
  requiredEvidence: [
    'productization gate exists',
    'benchmark suite is at least 79 cases',
    'productization live gate is green',
    'CLI version smoke is green',
  ],
  liveGate: ['productization-release-gate'],
  state: 'green_with_guard',
  nextHardening:
    'Promote selected mutation live tasks to mandatory CI/release checks when environment cost is acceptable.',
}

export function getDsxuProductizationContract(): DsxuProductizationContract {
  return {
    runtime: 'DSXU Productization',
    target:
      'Move DSXU from contract-green to product-grade DeepSeek coding agent behavior through real long-task gates, hook/memory/agent/MCP/permission/prompt hardening, and conservative archive signoff.',
    rules: [
      'One DSXU default CLI mainline only.',
      'The original reference source remains read-only reference material.',
      'Behavior must land in DSXU-owned code, tests, prompts, contracts, or benchmarks.',
      'Archive only after archived imports and dynamic legacy paths are removed or remapped.',
      'A live benchmark may be scoped, but product release requires mutation/live tasks over time.',
    ],
    items: [
      compatibilityAliasRemoval,
      realLongLiveSuite,
      stopHookRuntimeLive,
      sessionMemoryResume,
      agentLongRunGovernance,
      realMcpHarness,
      permissionUsabilityMatrix,
      promptBehaviorEvaluation,
      finalResidualArchive,
      releaseGate,
    ],
    releaseGate: {
      dryGate: 'productization',
      liveGate: 'productization',
      minimumBenchmarkCount: 79,
    },
  }
}

export function getDsxuProductizationItem(id: string): DsxuProductizationItem | undefined {
  return getDsxuProductizationContract().items.find(item => item.id.startsWith(id))
}
