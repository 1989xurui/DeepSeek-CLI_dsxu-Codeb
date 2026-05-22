export type HighPressureAbsorptionState =
  | 'evidence_green'
  | 'external_runner_required'
  | 'cleanup_remaining'

export type HighPressureAbsorptionItem = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  stressBehaviors: readonly string[]
  acceptance: readonly string[]
  benchmarkCases: readonly string[]
  state: HighPressureAbsorptionState
}

export type HighPressureAbsorptionContract = {
  runtime: 'DSXU High Pressure reference Absorption'
  target: string
  sourceBoundary: {
    referenceRoot: string
    writable: false
  }
  rules: readonly string[]
  items: readonly HighPressureAbsorptionItem[]
  gates: {
    live: string
    dry: string
    externalComparison: string
  }
}

const items: readonly HighPressureAbsorptionItem[] = [
  {
    id: '1 Query Loop Stress Recovery',
    objective:
      'Deepen reference query.ts, query/stopHooks.ts, and Tool.ts recovery lessons into DSXU edge recovery contracts.',
    referenceBehavior: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
    dsxuLanding: [
      'src/query.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/recovery',
      'src/dsxu/engine/prompt-cache-break-detection.ts',
    ],
    stressBehaviors: [
      'partial multi-tool batches return mixed success/failure tool results in order',
      'misordered or missing tool_result cannot produce PASS',
      'failed assistant messages are cleaned before retry',
      'stop hook failure can block final or force PARTIAL/FAIL without spinning',
      'max turns produces high-quality PARTIAL with verified/unverified scope',
      'tool summary and compact continuation reduce drift after recovery',
    ],
    acceptance: [
      'query-partial-tool-result-live passes',
      'query-stop-hook-failure-partial-live passes',
      'query-max-turns-quality-live passes',
      'query-tool-summary-recovery-live passes',
      'query-compact-goal-stability-live passes',
    ],
    benchmarkCases: [
      'query-partial-tool-result-live',
      'query-stop-hook-failure-partial-live',
      'query-max-turns-quality-live',
      'query-tool-summary-recovery-live',
      'query-compact-goal-stability-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '2 Harder Product Live Suite',
    objective:
      'Raise product live tasks beyond small fixtures into multi-step feature, review-to-fix, second-failure recovery, compact two-phase, Agent correction, Workflow fallback, and MCP dirty-result recovery.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'Tool.ts'],
    dsxuLanding: ['scripts/benchmark/dsxu-mainline-benchmark.ts', 'tmp/v8-live-fixtures'],
    stressBehaviors: [
      'feature task edits source and may add or preserve tests',
      'review task identifies and fixes the defect',
      'recovery task starts with a failing test and may see a second failure before PASS',
      'compact two-phase task must preserve failed command and reread before edit',
      'Agent worker correction uses SendMessage/verifier evidence',
      'Workflow first route can fail and fallback to manual repair',
      'MCP dirty/error result must trigger replan instead of fake PASS',
    ],
    acceptance: [
      'product-multistep-feature-live passes',
      'product-review-to-fix-live passes',
      'product-second-failure-recovery-live passes',
      'product-compact-two-phase-live passes',
      'product-agent-failure-correction-live passes',
    ],
    benchmarkCases: [
      'product-multistep-feature-live',
      'product-review-to-fix-live',
      'product-second-failure-recovery-live',
      'product-compact-two-phase-live',
      'product-agent-failure-correction-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '3 Agent Team Governance',
    objective:
      'Upgrade Agent from runnable worker to team governance with ownership, non-overlap, verifier rejection, SendMessage correction, and evidence-only parent synthesis.',
    referenceBehavior: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: [
      'src/tools/AgentTool/prompt.ts',
      'src/tools/SendMessageTool/prompt.ts',
      'src/services/AgentSummary/agentSummary.ts',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    stressBehaviors: [
      'parent assigns clear worker ownership',
      'workers cannot write same file scope concurrently',
      'verifier rejects fake PASS and parent must replan via SendMessage',
      'AgentSummary preserves failures and cannot overwrite them',
      'parent synthesis cites worker evidence only',
      'worker tool pool narrows by task',
    ],
    acceptance: [
      'agent-two-worker-scope-conflict-live passes',
      'agent-verifier-reject-parent-replan-live passes',
      'agent-summary-no-fake-pass-live passes',
      'agent-parent-synthesis-evidence-only-live passes',
      'agent-worker-tool-pool-narrow-live passes',
    ],
    benchmarkCases: [
      'agent-two-worker-scope-conflict-live',
      'agent-verifier-reject-parent-replan-live',
      'agent-summary-no-fake-pass-live',
      'agent-parent-synthesis-evidence-only-live',
      'agent-worker-tool-pool-narrow-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '4 Memory Compact Cross-Turn Resume',
    objective:
      'Make SessionMemory, compact, AutoDream, and extractMemories preserve failure state across resume without replacing source truth.',
    referenceBehavior: ['services/compact', 'services/SessionMemory', 'services/autoDream', 'services/extractMemories'],
    dsxuLanding: [
      'src/dsxu/engine/compact.ts',
      'src/services/SessionMemory',
      'src/services/autoDream',
      'src/services/extractMemories',
    ],
    stressBehaviors: [
      'failure writes bounded memory',
      'compact then resume requires source Read before edit',
      'AutoDream dedupe/rollback/lock prevents duplicate state',
      'memory cannot hide failed command or permission denial',
      'summary cannot convert unverified state to PASS',
    ],
    acceptance: [
      'memory-resume-after-real-failure-live passes',
      'compact-resume-two-edit-live passes',
      'autodream-no-duplicate-state-live passes',
      'memory-does-not-hide-failure-live passes',
      'compact-resume-reread-source-live passes',
    ],
    benchmarkCases: [
      'memory-resume-after-real-failure-live',
      'compact-resume-two-edit-live',
      'autodream-no-duplicate-state-live',
      'memory-does-not-hide-failure-live',
      'compact-resume-reread-source-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '5 MCP Stdio Ecosystem Recovery',
    objective:
      'Extend MCP from process-style harness to stdio/ecosystem semantics: resource, tool, reconnect, timeout, stale cache, and redaction.',
    referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
    dsxuLanding: [
      'src/services/mcp',
      'src/services/mcp/client.ts',
      'src/dsxu/engine/engine-tool-adapter.ts',
    ],
    stressBehaviors: [
      'stdio MCP server connect/list/read/call',
      'tool errors drive replan',
      'timeout and reconnect clear stale cache',
      'credential-like values do not enter model, summary, or logs',
    ],
    acceptance: [
      'mcp-stdio-server-live passes',
      'mcp-tool-error-replan-live passes',
      'mcp-timeout-reconnect-live passes',
      'mcp-credential-log-redaction-live passes',
      'mcp-stale-cache-clear-live passes',
    ],
    benchmarkCases: [
      'mcp-stdio-server-live',
      'mcp-tool-error-replan-live',
      'mcp-timeout-reconnect-live',
      'mcp-credential-log-redaction-live',
      'mcp-stale-cache-clear-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '6 Permission UX Productization',
    objective:
      'Make external project authorization understandable and usable while preserving deny precedence and one permission chain.',
    referenceBehavior: ['utils/permissions', 'utils/bash', 'utils/powershell', 'tools/BashTool', 'tools/PowerShellTool'],
    dsxuLanding: [
      'src/dsxu/engine/permission-usability.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
      'src/tools/BashTool',
      'src/tools/PowerShellTool',
    ],
    stressBehaviors: [
      'grant, display, expire, and revoke external workspace scope',
      'dependency install asks instead of silently running',
      'network download and network execute are separated',
      'destructive delete is hard deny',
      'acceptEdits cannot override deny precedence',
      'Windows/WSL paths display one normalized scope',
    ],
    acceptance: [
      'permission-grant-revoke-live passes',
      'permission-dependency-install-ask-live passes',
      'permission-network-download-ask-live passes',
      'permission-network-execute-deny-live passes',
      'permission-accept-edits-deny-precedence-live passes',
      'permission-external-scope-grant-live passes',
    ],
    benchmarkCases: [
      'permission-grant-revoke-live',
      'permission-dependency-install-ask-live',
      'permission-network-download-ask-live',
      'permission-network-execute-deny-live',
      'permission-accept-edits-deny-precedence-live',
      'permission-external-scope-grant-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '7 Tool Prompt Strong Constraints',
    objective:
      'Turn complete tool prompts into stricter reference-inspired weak-model constraints for tool choice, anti-repeat, shell bypass, and Agent evidence.',
    referenceBehavior: ['constants/prompts.ts', 'constants/systemPromptSections.ts', 'tools/*/prompt.ts'],
    dsxuLanding: ['src/tools/**/prompt.ts', 'src/dsxu/engine/system-prompt.ts'],
    stressBehaviors: [
      'Read does not read directories or use cache as verification',
      'Edit success immediately triggers verification and never repeats stale old_string',
      'Write creates scoped files and does not overwrite uncertain existing files',
      'Grep searches content while Glob searches filenames',
      'Bash/PowerShell do not bypass file tools',
      'Agent/Workflow/MCP/Skill prompts prevent fake PASS and repeated work',
    ],
    acceptance: [
      'tool-prompt-anti-repeat-golden passes',
      'tool-prompt-read-edit-cache-golden passes',
      'tool-prompt-shell-bypass-golden passes',
      'tool-prompt-agent-evidence-golden passes',
      'tool-prompt-workflow-not-runtime-golden passes',
    ],
    benchmarkCases: [
      'tool-prompt-anti-repeat-golden',
      'tool-prompt-read-edit-cache-golden',
      'tool-prompt-shell-bypass-golden',
      'tool-prompt-agent-evidence-golden',
      'tool-prompt-workflow-not-runtime-golden',
    ],
    state: 'evidence_green',
  },
  {
    id: '8 Provider P6 Cleanliness',
    objective:
      'Continue P6 cleanup without breaking compatibility: classify legacy wording, old-control-named adapters, historical Remaining, mojibake comments, audit probes, and temp artifacts.',
    referenceBehavior: ['old control shell', 'old session shell', 'old proxy shell', 'services/auth-compat', 'services/remoteManagedSettings'],
    dsxuLanding: [
      'src/dsxu/engine/provider-contract.ts',
      'src/dsxu/engine/provider-alias.ts',
      '.dsxu/ops/MAINLINE_LEDGER.md',
    ],
    stressBehaviors: [
      'default CLI/TUI import scan proves old shell unreachable',
      'default tool pool and prompt do not advertise archived shell',
      'legacy aliases remain explicit legacy flags',
      'five smoke classes stay green after cleanup',
    ],
    acceptance: [
      'default-cli-import-scan-live passes',
      'default-tool-pool-scan-live passes',
      'default-prompt-scan-live passes',
      'five-smoke-rerun-live passes',
    ],
    benchmarkCases: [
      'default-cli-import-scan-live',
      'default-tool-pool-scan-live',
      'default-prompt-scan-live',
      'five-smoke-rerun-live',
    ],
    state: 'cleanup_remaining',
  },
  {
    id: '9 Public Cross-Model Evaluation',
    objective:
      'Prepare public DSXU vs external coding-model runner evaluation with raw logs and identical constraints.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'services/compact', 'services/mcp'],
    dsxuLanding: [
      '.dsxu/eval/model-comparison-template.json',
      'scripts/benchmark/dsxu-mainline-benchmark.ts',
      '.dsxu/ops/DSXU-Code-本地阶段测试报告-20260502.md',
    ],
    stressBehaviors: [
      '30-50 fixed same-task live benchmark set',
      'DSXU DeepSeek V4 and reference coding workflow-class external coding-model runner raw logs under identical constraints',
      'pass rate, turns, cost, wall clock, repeated edit, tool misuse, fake PASS, permission violation, recovery, compact resume, and Agent success',
    ],
    acceptance: [
      'DSXU-Code-横向评测报告-YYYYMMDD.md is not emitted until external raw logs exist',
      'dry planned cases are not counted as live success',
    ],
    benchmarkCases: ['external-runner-required'],
    state: 'external_runner_required',
  },
]

export function getHighPressureAbsorptionContract(): HighPressureAbsorptionContract {
  return {
    runtime: 'DSXU High Pressure reference Absorption',
    target:
      'Push DSXU from staged product live into high-pressure recovery, long-task, Agent, MCP, permission, prompt, and cleanup gates while keeping one default mainline for DeepSeek V4-class models.',
    sourceBoundary: {
      referenceRoot: 'D:/DSXU-code/reference-input',
      writable: false,
    },
    rules: [
      'No V11/V12 runtime and no second runnable shell; keep one default mainline.',
      'reference source remains read-only reference.',
      'High-pressure product tasks must prefer real fixture mutation and command verification over Grep-only proof.',
      'Unsafe external effects are represented by focused DSXU tests and permission/MCP harnesses.',
      'Public model comparison requires external raw logs and cannot be inferred from local DSXU gates.',
    ],
    items,
    gates: {
      live: 'high-pressure-reference-absorption-live',
      dry: 'high-pressure-reference-absorption',
      externalComparison: 'DSXU-Code-横向评测报告-YYYYMMDD.md',
    },
  }
}

export function getHighPressureAbsorptionItem(idOrPrefix: string): HighPressureAbsorptionItem | undefined {
  return items.find(item => item.id === idOrPrefix || item.id.startsWith(idOrPrefix))
}
