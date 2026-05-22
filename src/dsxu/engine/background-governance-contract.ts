export type DSXUBackgroundGovernanceItem = {
  id: string
  sourceBehavior: string
  dsxuLanding: readonly string[]
  requiredTests: readonly string[]
  requiredLiveBenchmarks: readonly string[]
  archivalRule: string
}

export type DSXUBackgroundGovernanceContract = {
  runtime: 'DSXU Background Governance V5'
  goal: string
  nonGoals: readonly string[]
  items: readonly DSXUBackgroundGovernanceItem[]
  releaseGate: {
    dryGate: string
    liveGate: string
    minimumBenchmarkCount: number
  }
}

const providerShellReplacement: DSXUBackgroundGovernanceItem = {
  id: 'V5-1 Provider Shell Replacement',
  sourceBehavior:
    'reference control/session/proxy/auth/remoteManagedSettings shells provide remote sessions, event streams, permission callbacks, MCP credential handling, and task synchronization.',
  dsxuLanding: [
    'src/dsxu/engine/provider-contract.ts',
    'src/entrypoints/cli.tsx',
    'src/entrypoints/init.ts',
    'src/services/mcp/dsxuProvider.ts',
    'src/dsxu/engine/__tests__/provider-contract-v1.test.ts',
  ],
  requiredTests: [
    'default CLI path rejects old control/session aliases',
    'archived source loads only behind explicit DSXU legacy flags',
    'remote sessions are blocked until a DSXU-owned remote backend is configured',
    'provider events cover session, tool, permission, remote blocked, and task sync semantics',
    'MCP credential-like values are redacted before model re-entry',
  ],
  requiredLiveBenchmarks: [
    'provider-shell-default-unreachable',
    'real-mcp-resource-redaction',
  ],
  archivalRule:
    'old control/session/proxy shell directories may be archived only after DSXU provider contract tests and live default-path benchmark are green and archived aliases remain explicit-flag-only.',
}

const stopHooks: DSXUBackgroundGovernanceItem = {
  id: 'V5-2 Stop Hooks / Post Sampling Hooks',
  sourceBehavior:
    'reference query/stopHooks.ts and post-sampling hooks run governance work at natural turn boundaries: verifier checks, memory extraction, MagicDocs, and stop-condition handling without infinite loops.',
  dsxuLanding: [
    'src/query.ts',
    'src/utils/hooks/postSamplingHooks.ts',
    'src/utils/hooks/stopHooks.ts',
    'src/services/extractMemories/*',
    'src/services/MagicDocs/*',
    'src/dsxu/engine/__tests__/background-governance-contract-v1.test.ts',
  ],
  requiredTests: [
    'tool completion can schedule verifier, memory, and summary governance work',
    'post-sampling hooks skip unsafe turns that still contain tool calls',
    'stop-hook continuation has an explicit loop guard',
    'hook failure reports PARTIAL/FAIL instead of spinning',
  ],
  requiredLiveBenchmarks: [
    'stop-hook-verify-before-final',
    'query-recovery-contract',
  ],
  archivalRule:
    'No old hook runtime should be restored. Hook behavior must remain a DSXU query-loop contract.',
}

const sessionMemory: DSXUBackgroundGovernanceItem = {
  id: 'V5-3 SessionMemory + AutoDream',
  sourceBehavior:
    'reference services/SessionMemory and services/autoDream preserve long-running task state across compaction and consolidate background memory with throttling and locking.',
  dsxuLanding: [
    'src/services/SessionMemory/*',
    'src/services/autoDream/*',
    'src/dsxu/engine/memory/*',
    'src/dsxu/engine/compact.ts',
    'src/dsxu/engine/__tests__/background-governance-contract-v1.test.ts',
  ],
  requiredTests: [
    'session memory requires token/tool thresholds before extraction',
    'autoDream/consolidation is throttled and lock protected',
    'compact recovery preserves user goal, changed files, failed commands, permission denials, pending tasks, pending agents, verification status, and next actions',
    'resume uses memory as supporting context without replacing source evidence',
  ],
  requiredLiveBenchmarks: [
    'session-memory-resume',
    'long-task-compact-continue',
  ],
  archivalRule:
    'Do not create a second memory store. Session memory and AutoDream semantics must feed the DSXU compact/memory pipeline.',
}

const agentSummary: DSXUBackgroundGovernanceItem = {
  id: 'V5-4 AgentSummary',
  sourceBehavior:
    'reference services/AgentSummary periodically summarizes subagent progress without tools, shares cache-safe params, avoids overlapping timers, and updates parent-visible progress.',
  dsxuLanding: [
    'src/services/AgentSummary/agentSummary.ts',
    'src/tools/AgentTool/*',
    'src/tools/SendMessageTool/*',
    'src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
  ],
  requiredTests: [
    'worker summaries are short, present-tense, evidence-based, and tool-denied',
    'summary timers do not overlap',
    'parent synthesis uses worker evidence and cannot invent PASS',
    'multi-agent duplication is discouraged by prompt and notification evidence',
  ],
  requiredLiveBenchmarks: [
    'agent-summary-parent-synthesis',
    'agent-notification-evidence',
  ],
  archivalRule:
    'Agent summary behavior stays inside DSXU Agent notification and parent synthesis paths.',
}

const magicDocs: DSXUBackgroundGovernanceItem = {
  id: 'V5-5 MagicDocs',
  sourceBehavior:
    'reference services/MagicDocs updates marked markdown documents after idle turns using a scoped subagent and Edit-only allowlist.',
  dsxuLanding: [
    'src/services/MagicDocs/*',
    'src/utils/dsxuInstructions.ts',
    'src/dsxu/engine/__tests__/background-governance-contract-v1.test.ts',
  ],
  requiredTests: [
    'MagicDocs is default-off or scoped to explicit MAGIC DOC headers',
    'only Edit is allowed and only for the tracked document path',
    'updates run after idle turns, not while tool calls are active',
    'the verifier sees a diff and PASS/PARTIAL/FAIL evidence',
  ],
  requiredLiveBenchmarks: [
    'magic-docs-scoped-update',
  ],
  archivalRule:
    'MagicDocs must not become an always-on document writer. It remains scoped and DSXU-owned.',
}

const promptSuggestionTips: DSXUBackgroundGovernanceItem = {
  id: 'V5-6 PromptSuggestion / Tips',
  sourceBehavior:
    'reference PromptSuggestion and tips guide users without altering the core model prompt or tool pool.',
  dsxuLanding: [
    'src/services/PromptSuggestion/*',
    'src/services/tips/*',
    'src/components/PromptInput/*',
    'src/components/Spinner.tsx',
  ],
  requiredTests: [
    'suggestions are disabled in non-interactive sessions',
    'suggestions do not enter the system prompt cache prefix',
    'tips do not alter default model-visible tools',
    'plan mode, pending permission, elicitation, and rate-limit states suppress suggestions',
  ],
  requiredLiveBenchmarks: [
    'prompt-suggestion-cache-isolation',
  ],
  archivalRule:
    'These are UI guidance features, not core execution. They must never create a second runtime path.',
}

const longTaskBenchmark: DSXUBackgroundGovernanceItem = {
  id: 'V5-7 True Long-Task Benchmark',
  sourceBehavior:
    'reference quality comes from repeated long-task evidence: compaction, recovery, agent synthesis, permission recovery, and final verification over many turns.',
  dsxuLanding: [
    'scripts/benchmark/dsxu-mainline-benchmark.ts',
    '.dsxu/ops/MAINLINE_LEDGER.md',
    '.dsxu/ops/DSXU-Code-V5-后台治理能力吸收队列.md',
  ],
  requiredTests: [
    'benchmark suite has at least 60 planned cases',
    'V5 gate includes provider, stop-hook, session-memory, agent-summary, MagicDocs, MCP redaction, and long-task compact cases',
    'live failures are classified as product gap, prompt too broad, environment issue, or missing marker despite evidence',
  ],
  requiredLiveBenchmarks: [
    'long-task-compact-continue',
    'agent-summary-parent-synthesis',
    'stop-hook-verify-before-final',
    'real-mcp-resource-redaction',
    'provider-shell-default-unreachable',
    'session-memory-resume',
    'magic-docs-scoped-update',
  ],
  archivalRule:
    'P6 residual cleanup can expand only after the V5 long-task gate is green.',
}

export function getDsxuBackgroundGovernanceV5Contract(): DSXUBackgroundGovernanceContract {
  return {
    runtime: 'DSXU Background Governance V5',
    goal:
      'Absorb reference background governance behavior into the single DSXU DeepSeek mainline without copying provider shells or adding a second runnable system.',
    nonGoals: [
      'Do not import reference auth, remote service wrappers, or provider shells into the default path.',
      'Do not judge completion by file presence or matching names.',
      'Do not allow background governance to write files outside explicit scope.',
      'Do not let UI tips or prompt suggestions mutate the system prompt cache prefix.',
    ],
    items: [
      providerShellReplacement,
      stopHooks,
      sessionMemory,
      agentSummary,
      magicDocs,
      promptSuggestionTips,
      longTaskBenchmark,
    ],
    releaseGate: {
      dryGate: 'background-governance-v5',
      liveGate: 'background-governance-v5',
      minimumBenchmarkCount: 60,
    },
  }
}

export function getDsxuBackgroundGovernanceV5Item(id: string): DSXUBackgroundGovernanceItem | undefined {
  return getDsxuBackgroundGovernanceV5Contract().items.find(item => item.id.startsWith(id))
}
