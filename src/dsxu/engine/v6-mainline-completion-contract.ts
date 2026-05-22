export type DSXUV6CompletionState =
  | 'green'
  | 'green_with_guard'
  | 'blocked_by_compatibility'

export type DSXUV6CompletionItem = {
  id: string
  goal: string
  referenceBehavior: string
  dsxuLanding: readonly string[]
  requiredEvidence: readonly string[]
  liveGate: readonly string[]
  state: DSXUV6CompletionState
  archiveDecision: string
}

export type DSXUV6MainlineCompletionContract = {
  runtime: 'DSXU V6 Mainline Completion'
  target: string
  rules: readonly string[]
  items: readonly DSXUV6CompletionItem[]
  releaseGate: {
    dryGate: string
    liveGate: string
    minimumBenchmarkCount: number
  }
}

const providerReplacement: DSXUV6CompletionItem = {
  id: 'V6-1 Provider Replacement Signoff',
  goal:
    'Turn provider shell replacement from a semantic contract into a release signoff for local identity, remote session blocking, event stream, permission callback, MCP credential filtering, and task synchronization.',
  referenceBehavior:
    'old control, session, proxy, auth, and managed-settings shells are reference-only; DSXU absorbs the provider semantics and keeps the old shell out of the default path.',
  dsxuLanding: [
    'src/dsxu/engine/provider-contract.ts',
    'src/entrypoints/cli.tsx',
    'src/entrypoints/init.ts',
    'src/main.tsx',
    'src/tools/SendMessageTool/SendMessageTool.ts',
    'src/tools/BriefTool/upload.ts',
  ],
  requiredEvidence: [
    'default CLI starts through DSXU local provider mode',
    'remote-control and old control aliases are rejected in DSXU_CODE_MODE',
    'provider-migration auth and remote managed settings load only behind explicit provider-migration gates',
    'old proxy shell is archived and not imported by default init',
    'SendMessage legacy targets are legacy-only; provider: uses DSXU provider backend',
    'provider shell archival is complete after import scan and five live smokes',
  ],
  liveGate: [
    'provider-shell-default-unreachable',
    'v6-provider-replacement-signoff',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'old control/session/proxy shell directories are archived; remaining P6 work is residual comments, old contracts, and non-default legacy wording.',
}

const realLongTaskHarness: DSXUV6CompletionItem = {
  id: 'V6-2 Real Long Task Harness',
  goal:
    'Promote long-task validation from scoped Grep checks to real CLI tasks with edit, verify, recovery, compaction, Agent, and final PASS/PARTIAL/FAIL evidence.',
  referenceBehavior:
    'reference quality loop repeatedly validates bugfix, feature, review, repo understanding, and recovery tasks over long context and tool batches.',
  dsxuLanding: [
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
    '.dsxu/runs/five-smoke',
    'src/dsxu/engine/compact.ts',
    'src/query.ts',
  ],
  requiredEvidence: [
    'five real smoke tasks stay green after prompt/tool/permission/provider changes',
    'long-task compact continuation preserves goals, files, failures, permissions, verifier state, and next actions',
    'live failures are classified as product gap, prompt too broad, environment issue, or marker gap',
  ],
  liveGate: [
    'long-task-compact-continue',
    'v6-real-long-task-harness',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'No archival decision depends on this alone; it is a release gate before broad P6 cleanup.',
}

const stopHookRuntime: DSXUV6CompletionItem = {
  id: 'V6-3 Stop Hook Runtime Integration',
  goal:
    'Use stop hooks and post-sampling hooks as DSXU query-loop governance for verifier, memory, summary, MagicDocs, and safe stop conditions without infinite loops.',
  referenceBehavior:
    'query/stopHooks.ts provides end-of-turn governance; DSXU keeps the behavior as a query-loop contract instead of restoring another runtime.',
  dsxuLanding: [
    'src/query.ts',
    'src/query/stopHooks.ts',
    'src/utils/hooks/postSamplingHooks.ts',
    'src/utils/hooks/stopHooks.ts',
  ],
  requiredEvidence: [
    'tool-result pairing completes before post-sampling hooks',
    'stopHookActive prevents stop-hook retry loops',
    'hook blocking returns PARTIAL/FAIL evidence instead of spinning',
    'hook failures do not re-enable old reactiveCompact/contextCollapse paths',
  ],
  liveGate: [
    'stop-hook-verify-before-final',
    'v6-stop-hook-runtime',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'No old hook runtime should be archived into DSXU; keep only DSXU query-loop governance.',
}

const sessionMemoryResume: DSXUV6CompletionItem = {
  id: 'V6-4 SessionMemory Resume',
  goal:
    'Make SessionMemory and AutoDream support long-task resume without replacing source evidence.',
  referenceBehavior:
    'services/SessionMemory and services/autoDream preserve task state and consolidate memory with thresholds, locks, and throttles.',
  dsxuLanding: [
    'src/services/SessionMemory',
    'src/services/autoDream',
    'src/dsxu/engine/compact.ts',
  ],
  requiredEvidence: [
    'SessionMemory uses token/tool thresholds',
    'AutoDream has lock and throttle protection',
    'compact recovery preserves the resume-critical state',
    'memory is supporting context, not a substitute for reading source evidence',
  ],
  liveGate: [
    'session-memory-resume',
    'v6-session-memory-resume',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'Do not introduce another memory store; keep the behavior inside DSXU memory and compact schema.',
}

const mcpRealServerGate: DSXUV6CompletionItem = {
  id: 'V6-5 MCP Real Server Gate',
  goal:
    'Require MCP connection, resource read, dynamic tool calls, reconnect/error shape, and credential redaction before model re-entry.',
  referenceBehavior:
    'services/mcp contains mature connection/resource semantics, but provider auth shell behavior is excluded.',
  dsxuLanding: [
    'src/services/mcp',
    'src/tools/MCPTool',
    'src/tools/ReadMcpResourceTool',
    'src/dsxu/engine/engine-tool-adapter.ts',
    'src/dsxu/engine/provider-contract.ts',
  ],
  requiredEvidence: [
    'dynamic MCP tool results are redacted before the next model turn',
    'ReadMcpResource uses the DSXU mainline adapter',
    'real MCP resource redaction live gate is green',
    'provider auth is not required by the default MCP path',
  ],
  liveGate: [
    'real-mcp-resource-redaction',
    'mcp-dynamic-credential-live-contract',
    'v6-mcp-real-server-gate',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'Provider shell pieces can be archived only after MCP credential flow stays green without old auth wrappers.',
}

const permissionUsability: DSXUV6CompletionItem = {
  id: 'V6-6 Permission Usability Policy',
  goal:
    'Move the permission matrix from safe but blunt fail-close behavior toward a usable allow/ask/deny policy for weak-model coding tasks.',
  referenceBehavior:
    'utils/permissions, utils/bash, and utils/powershell provide safety classification patterns worth continuing to DSXU-ize.',
  dsxuLanding: [
    'src/utils/permissions',
    'src/utils/bash',
    'src/utils/powershell',
    'src/dsxu/engine/mainline-tool-adapter.ts',
    'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
  ],
  requiredEvidence: [
    'read-only commands are usable',
    'test/build policy is explicit instead of accidental',
    'dependency mutation, network execution, destructive delete, and hidden/sensitive paths fail closed or ask',
    'hard deny dominates callbacks and acceptEdits',
    'Windows/WSL mixed paths share the same decision chain',
  ],
  liveGate: [
    'permissions-deny-precedence',
    'permission-matrix-contract',
    'v6-permission-usability-policy',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'Archive old shell gates only after the DSXU permission matrix is the single source of truth in default tool execution.',
}

const promptBehavior: DSXUV6CompletionItem = {
  id: 'V6-7 Prompt Behavior Evaluation',
  goal:
    'Evaluate prompt quality by weak-model behavior, not by text presence alone: correct tool choice, no repeated edits, scoped plans, recovery, and verified final reporting.',
  referenceBehavior:
    'reference tool prompts are valuable because they shape tool choice and recovery behavior; DSXU rewrites them for DeepSeek rather than copying names.',
  dsxuLanding: [
    'src/constants/prompts.ts',
    'src/tools/*/prompt.ts',
    'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
  ],
  requiredEvidence: [
    'tool prompts include when to use, when not to use, recovery, and weak-model anti-patterns',
    'PlanMode limits scope and requires acceptance criteria',
    'Edit/Write success steers to verification instead of repeated stale calls',
    'Agent and SendMessage prompts preserve worker continuation and verifier evidence',
  ],
  liveGate: [
    'tool-prompt-full-discipline',
    'planmode-scope-contract',
    'edit-anti-repeat-loop',
    'v6-prompt-behavior-evaluation',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'No shell archival depends on prompt text alone; behavior evidence must remain green.',
}

const finalP6Archive: DSXUV6CompletionItem = {
  id: 'V6-8 Final P6 Archive',
  goal:
    'Archive only proven-unused provider shells and side paths after default CLI, provider, MCP, Agent, permission, and long-task gates are green.',
  referenceBehavior:
    'reference provider shells are reference material, not DSXU default product shells.',
  dsxuLanding: [
    'archived control shell directory',
    'archived session shell directory',
    'archived proxy shell directory',
    'src/services/auth-compat',
    'src/services/remoteManagedSettings',
    'D:/DSXU-code/non-dsxu-code-project-files',
  ],
  requiredEvidence: [
    'default CLI does not import or execute old shells',
    'provider-migration aliases are either removed, remapped, or provider-migration-flag-only',
    'moving a directory will not break build, dynamic import, tests, or explicit legacy mode expectations',
    'current evidence proves old control/session/proxy shell directories are archived from the active source tree',
  ],
  liveGate: [
    'provider-shell-default-unreachable',
    'v6-final-archive-readiness',
  ],
  state: 'green_with_guard',
  archiveDecision:
    'Provider shell directories have been moved to the non-DSXU archive after provider-migration aliases were remapped to DSXU provider facades and five selected live smokes passed.',
}

export function getDsxuV6MainlineCompletionContract(): DSXUV6MainlineCompletionContract {
  return {
    runtime: 'DSXU V6 Mainline Completion',
    target:
      'Raise DSXU on DeepSeek V4-class weaker models by converting reference governance behavior into one DSXU default CLI mainline with stronger orchestration, constraints, tools, permissions, recovery, testing, and context control.',
    rules: [
      'Evidence beats filename matching.',
      'Do not modify the read-only original reference behavior tree.',
      'Do not copy provider shells into the default DSXU runtime.',
      'Do not reintroduce compatibility shells after imports, dynamic paths, and legacy flags are signed off.',
      'Live benchmark failures must be classified before changing product code.',
    ],
    items: [
      providerReplacement,
      realLongTaskHarness,
      stopHookRuntime,
      sessionMemoryResume,
      mcpRealServerGate,
      permissionUsability,
      promptBehavior,
      finalP6Archive,
    ],
    releaseGate: {
      dryGate: 'v6-mainline-completion',
      liveGate: 'v6-mainline-completion',
      minimumBenchmarkCount: 69,
    },
  }
}

export function getDsxuV6CompletionItem(id: string): DSXUV6CompletionItem | undefined {
  return getDsxuV6MainlineCompletionContract().items.find(item => item.id.startsWith(id))
}
