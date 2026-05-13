export type DsxuGovernanceAbsorptionState =
  | 'evidence_green'
  | 'requires_external_runner'
  | 'cleanup_remaining'

export type DsxuGovernanceAbsorptionItem = {
  id: string
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P6'
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  absorptionRules: readonly string[]
  acceptance: readonly string[]
  evidence: readonly string[]
  state: DsxuGovernanceAbsorptionState
}

export type DsxuGovernanceAbsorptionContract = {
  runtime: 'DSXU Reference Governance Absorption Queue'
  target: string
  sourceBoundary: {
    referenceRoot: string
    writable: false
    rule: string
  }
  mainlineRules: readonly string[]
  items: readonly DsxuGovernanceAbsorptionItem[]
  releaseGate: {
    dryGate: string
    liveGate: string
    externalComparison: string
  }
}

const items: readonly DsxuGovernanceAbsorptionItem[] = [
  {
    id: 'P0-1 Query Loop Recovery Deep Absorption',
    priority: 'P0',
    objective:
      'Absorb reference query.ts and query/stopHooks.ts recovery behavior into the DSXU default query-loop contract without replacing the DSXU runtime.',
    referenceBehavior: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
    dsxuLanding: [
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/recovery',
      'src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts',
      'src/dsxu/engine/__tests__/v8-stop-hook-runtime-v1.test.ts',
    ],
    absorptionRules: [
      'failed assistant message cleanup is a DSXU contract, not a file-copy of reference query.ts',
      'tool-result pairing must prevent orphan tool_use from reaching PASS',
      'fallback retry is allowed only when parameters or strategy change',
      'max-output and prompt-too-long conditions must lead to recovery, compact, PARTIAL, or FAIL, never fake PASS',
      'stop hooks run after tool completion and before final PASS, with no spin loop',
    ],
    acceptance: [
      'query recovery bundle tests pass',
      'live recovery gate contains failed cleanup, max-output recovery, compact-after-overflow, and verifier-before-final coverage',
      'failure emits PARTIAL or FAIL instead of fabricated success',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/direct-connect-and-query-contract-v1.test.ts src/dsxu/engine/__tests__/v8-stop-hook-runtime-v1.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P0-2 Long Task Compact SessionMemory AutoDream Productization',
    priority: 'P0',
    objective:
      'Make compact, SessionMemory, AutoDream, and memory extraction preserve long-task state while requiring source reread before edit.',
    referenceBehavior: [
      'services/compact',
      'services/SessionMemory',
      'services/autoDream',
      'services/extractMemories',
    ],
    dsxuLanding: [
      'src/dsxu/engine/compact.ts',
      'src/services/SessionMemory',
      'src/services/autoDream',
      'src/dsxu/engine/memory-pipeline.ts',
    ],
    absorptionRules: [
      'memory is a bounded hint layer and never replaces source or test evidence',
      'compact snapshots preserve failed commands, permission denials, changed files, pending agents, next action, and verification state',
      'AutoDream must lock, throttle, dedupe, and rollback rather than overwrite unverified state',
    ],
    acceptance: [
      'forced compact then resume rereads source before edit',
      'resume can continue unfinished work to Edit, test, and PASS',
      'AutoDream duplicate writes are blocked by lock/throttle evidence',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/v8-memory-resume-v1.test.ts src/dsxu/engine/__tests__/session-memory-mainline-v1.test.ts src/dsxu/engine/__tests__/compact-session-integration.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P0-3 AgentSummary Multi-Agent Long Run',
    priority: 'P0',
    objective:
      'Upgrade Agent into trusted long-task orchestration: scoped workers, inherited permission, evidence-only synthesis, and verifier rejection.',
    referenceBehavior: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: [
      'src/services/AgentSummary/agentSummary.ts',
      'src/tools/AgentTool',
      'src/tools/SendMessageTool',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    absorptionRules: [
      'worker tool pools may narrow inherited tools but cannot silently expand them',
      'permission inheritance cannot grant a worker broader write scope than the parent',
      'multiple agents must not write the same scope without explicit sequencing',
      'parent synthesis can cite only worker tool results, summaries, and verifier evidence',
    ],
    acceptance: [
      'two-worker no-overlap and parent-synthesis contracts are covered',
      'verifier rejects fake PASS and forces correction',
      'SendMessage correction chain remains local-provider/mainline, not legacy control shell',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/v8-agent-long-run-v1.test.ts src/dsxu/engine/__tests__/agent-summary.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P1-1 Tool-use Summary Mechanized Live',
    priority: 'P1',
    objective:
      'Make tool-use summaries help recovery and parent synthesis while redacting credentials and never replacing source truth.',
    referenceBehavior: ['services/toolUseSummary/toolUseSummaryGenerator.ts'],
    dsxuLanding: [
      'src/services/toolUseSummary/toolUseSummaryGenerator.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/compact.ts',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    absorptionRules: [
      'summary includes tool, file, result, failure, and next-step hints',
      'summary redacts tokens, API keys, cookies, authorization headers, and credential-like output',
      'summary is recovery context only and cannot become final evidence',
    ],
    acceptance: [
      'long edit and failure recovery summary tests preserve useful hints',
      'credentials do not enter model prompt, summary, transcript, or log',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/tool-use-summary-governance-v1.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P1-2 Prompt Cache Break Audit',
    priority: 'P1',
    objective:
      'Turn reference cache-section discipline into DSXU stable prompt layout and explicit cache mutation auditing.',
    referenceBehavior: [
      'constants/systemPromptSections.ts',
      'services/api/promptCacheBreakDetection.ts',
      'constants/prompts.ts',
    ],
    dsxuLanding: [
      'src/dsxu/engine/system-prompt.ts',
      'src/dsxu/engine/prompt-cache-break-detection.ts',
      'src/dsxu/engine/__tests__/v10-prompt-docs-discipline-v1.test.ts',
    ],
    absorptionRules: [
      'stable sections precede dynamic session, memory, compact, and MCP sections',
      'dynamic MCP tools, session memory, and compact hints stay after the stable boundary',
      'tool order is stable and any volatile section has a reason',
    ],
    acceptance: [
      'cache-stable layout audit passes',
      'prompt-cache-break-diff-audit fails when dynamic content pollutes the stable prefix',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/prompt-cache-break-detection.test.ts src/dsxu/engine/__tests__/v10-prompt-docs-discipline-v1.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P1-3 Permission Usability Matrix Expansion',
    priority: 'P1',
    objective:
      'Keep one real Bash, PowerShell, and file-edit permission chain while making external scoped grants product-usable.',
    referenceBehavior: [
      'utils/permissions',
      'utils/bash',
      'utils/powershell',
      'tools/BashTool',
      'tools/PowerShellTool',
    ],
    dsxuLanding: [
      'src/dsxu/engine/permission-usability.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
      'src/tools/BashTool',
      'src/tools/PowerShellTool',
    ],
    absorptionRules: [
      'read-only and test/build can be allowlisted when scope is safe',
      'dependency mutation and network execute require ask or deny policy',
      'destructive delete is hard deny',
      'deny precedence beats acceptEdits, callbacks, and external grants',
      'Windows and WSL paths normalize to the same scoped grant',
    ],
    acceptance: [
      'external scoped grant for D:/shooter-game and /mnt/d/shooter-game normalizes consistently',
      'network execute and destructive delete policies are tested',
      'Bash, PowerShell, and file edits share one decision chain',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/v9-permission-usability-v1.test.ts src/dsxu/engine/__tests__/permissions.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P1-4 Real MCP External Server Long Chain',
    priority: 'P1',
    objective:
      'Validate DSXU MCP with process-like server behavior: connect, resources, tool calls, errors, reconnect, stale cache clearing, and credential redaction.',
    referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
    dsxuLanding: [
      'src/services/mcp',
      'src/dsxu/engine/mcp-client.ts',
      'src/dsxu/engine/engine-tool-adapter.ts',
      'src/dsxu/engine/provider-contract.ts',
    ],
    absorptionRules: [
      'dynamic MCP tools enter only through DSXU registry and permission adapters',
      'disconnect and reconnect clear stale resources and tool cache',
      'credentials never enter model, summary, transcript, or logs',
    ],
    acceptance: [
      'local process-backed harness covers connect, list, read, call, error, disconnect, reconnect',
      'third-party external MCP runs are tracked separately and must not be faked without credentials/server config',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/v8-real-mcp-server-v1.test.ts src/dsxu/engine/__tests__/mcp-client.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P2-1 MagicDocs Scoped Update',
    priority: 'P2',
    objective:
      'Absorb reference MagicDocs behavior as a scoped DSXU docs updater, default closed and verifier-bound.',
    referenceBehavior: ['services/MagicDocs/magicDocs.ts', 'services/MagicDocs/prompts.ts'],
    dsxuLanding: ['src/dsxu/engine/magic-docs.ts', 'src/services/MagicDocs'],
    absorptionRules: [
      'MagicDocs is default closed or explicitly scoped',
      'only allowlisted docs may be edited',
      'updates require diff and verifier evidence',
      'out-of-scope user docs are denied',
    ],
    acceptance: [
      'scoped update succeeds only for allowlisted docs',
      'out-of-scope update is denied',
      'verifier evidence is required before PASS',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/magic-docs.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P2-2 History Resume Full Audit',
    priority: 'P2',
    objective:
      'Ensure DSXU resume preserves user intent, tool results, changed files, failures, permission denials, compact summaries, and Agent state.',
    referenceBehavior: ['history.ts', 'services/SessionMemory', 'compact/sessionMemoryCompact.ts'],
    dsxuLanding: [
      'src/history.ts',
      'src/utils/sessionStorage.ts',
      'src/services/SessionMemory',
      'src/dsxu/engine/compact.ts',
    ],
    absorptionRules: [
      'history is replay evidence, not a replacement for current source reads',
      'failed commands and permission denials must survive resume',
      'pending Agent/task state must be visible after resume',
    ],
    acceptance: [
      'history resume preserves tool result shape',
      'resume after compact keeps changed files, failures, and pending work',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/file-history.test.ts src/dsxu/engine/__tests__/session-memory-mainline-v1.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P2-3 Tool Lifecycle Contract Absorption',
    priority: 'P2',
    objective:
      'Absorb reference Tool.ts lifecycle ideas into DSXU adapters: validation, permission, call, result mapping, error normalization, telemetry, and user-visible wording.',
    referenceBehavior: ['Tool.ts'],
    dsxuLanding: [
      'src/dsxu/engine/engine-tool-adapter.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
      'src/dsxu/engine/tool-registry.ts',
      'src/dsxu/engine/tool-bus',
    ],
    absorptionRules: [
      'tools do not each invent incompatible permission/result/error shapes',
      'permission-denied results are normalized and model-actionable',
      'adapter metadata records real tool class calls and evidence',
    ],
    acceptance: [
      'tool lifecycle error normalization test passes',
      'permission denied result shape test passes',
      'tool result injection contract test passes',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/lifecycle-protocol-manager.test.ts src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P2-4 Skills Selection Quality Review',
    priority: 'P2',
    objective:
      'Make SkillTool selection useful for weak models: concise when-to-use, no duplicate invocation, bounded listing cache, and evidence-linked final PASS.',
    referenceBehavior: ['skills', 'tools/SkillTool', 'constants/prompts.ts'],
    dsxuLanding: [
      'src/dsxu/engine/skills-executor.ts',
      'src/dsxu/engine/skills-adapter.ts',
      'src/tools/SkillTool',
    ],
    absorptionRules: [
      'skills are selected only when their when-to-use text matches the task',
      'after a skill is invoked, the model should not repeat it without new evidence',
      'skill output can support but cannot replace final verification evidence',
    ],
    acceptance: [
      'skill selection no-duplicate test passes',
      'skill evidence final PASS relationship is tested',
    ],
    evidence: [
      'bun test src/dsxu/engine/__tests__/skills-selection-v1-clean.test.ts src/dsxu/engine/__tests__/skills-executor.test.ts src/dsxu/engine/__tests__/skills-failure-path.test.ts',
      'benchmark gate: reference-governance-live-core',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P3 Public Cross-Model Evaluation',
    priority: 'P3',
    objective:
      'Convert local DSXU benchmark evidence into a fair external comparison against reference coding workflow, GPT, Gemini, Aider, and Cline.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'services/compact', 'services/mcp'],
    dsxuLanding: [
      '.dsxu/eval/model-comparison-template.json',
      '.dsxu/ops/DSXU-Code-本地阶段测试报告-20260502.md',
      'scripts/benchmark/dsxu-mainline-benchmark.ts',
    ],
    absorptionRules: [
      'do not claim external scores without raw logs from each runner',
      'dry planned cases are never counted as live success',
      'all models use the same repo, prompts, permissions, and scoring fields',
    ],
    acceptance: [
      '30-50 same-task live benchmark set is fixed',
      'each external model has raw logs',
      'report includes pass rate, turns, wall clock, tool misuse, repeated edit, fake PASS, permission violation, recovery success, cost',
    ],
    evidence: [
      '.dsxu/eval/model-comparison-template.json',
      'external runner required: not locally faked',
    ],
    state: 'requires_external_runner',
  },
  {
    id: 'P6-1 Ledger Remaining Historical Cleanup',
    priority: 'P6',
    objective:
      'Prevent old Remaining/blocked sections from misleading future execution while preserving historical evidence.',
    referenceBehavior: ['not applicable: cleanup of DSXU ops ledger'],
    dsxuLanding: [
      '.dsxu/ops/MAINLINE_LEDGER.md',
      '.dsxu/ops/DSXU-Code-V10-reference-Behavior-Productization-Queue.md',
      '.dsxu/ops/DSXU-Code-reference治理能力吸收执行队列.md',
    ],
    absorptionRules: [
      'do not delete historical evidence',
      'add a current state index above older notes',
      'mark superseded historical items by newer pass evidence rather than rewriting history',
    ],
    acceptance: [
      'current state table lists default mainline, V10-7/V10-8, governance absorption, P3 external comparison, and broad P6 cleanup',
      'active ops docs contain no mojibake markers',
    ],
    evidence: [
      '.dsxu/ops/MAINLINE_LEDGER.md',
      '.dsxu/ops/DSXU-Code-reference治理能力吸收执行队列.md',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P6-2 Non-Runtime Encoding Cleanup',
    priority: 'P6',
    objective:
      'Keep user/model-visible strings clean first, then reduce comment-only mojibake without blocking runtime delivery.',
    referenceBehavior: ['not applicable: cleanup of DSXU comments and historical docs'],
    dsxuLanding: ['src/main.tsx', 'src/cli/print.ts', 'src/cli/transports', 'src/cli/handlers/mcp.tsx'],
    absorptionRules: [
      'prompt, error, console output, tool results, and CLI help are fail-fast cleanup targets',
      'comment-only historical mojibake is cleanup_remaining unless it misleads execution',
      'historical records that document a previous mojibake scan may remain with explicit context',
    ],
    acceptance: [
      'default visible runtime strings have no mojibake markers',
      'comment-only cleanup is tracked as broad P6 rather than mainline blocker',
    ],
    evidence: [
      'active ops docs mojibake scan',
      'runtime string scan remains a recurring P6 cleanup task',
    ],
    state: 'cleanup_remaining',
  },
  {
    id: 'P6-3 Legacy Wording Classification',
    priority: 'P6',
    objective:
      'Classify remaining old control/session/auth/remote-managed wording so default paths do not imply the old provider shell is still active.',
    referenceBehavior: ['old control shell', 'old session shell', 'old proxy shell', 'services/auth-compat', 'services/remoteManagedSettings'],
    dsxuLanding: [
      'src/dsxu/engine/provider-contract.ts',
      'src/dsxu/engine/provider-alias.ts',
      'src/dsxu/engine/provider-backend',
      '.dsxu/ops/MAINLINE_LEDGER.md',
    ],
    absorptionRules: [
      'default path wording must say DSXU provider contract, not legacy reference shell',
      'old-control-named DSXU adapters/tests are allowed only when classified as compatibility adapters',
      'legacy paths require explicit legacy flags',
    ],
    acceptance: [
      'default CLI/TUI does not advertise old control/session/auth shell',
      'compatibility wording is marked as explicit legacy or DSXU adapter compatibility',
    ],
    evidence: [
      'provider alias tests',
      'V10 provider replacement contract',
    ],
    state: 'cleanup_remaining',
  },
]

export function getDsxuGovernanceAbsorptionContract(): DsxuGovernanceAbsorptionContract {
  return {
    runtime: 'DSXU Reference Governance Absorption Queue',
    target:
      'Use stronger orchestration, scope limits, tools, permissions, recovery, tests, context control, and live benchmarks to help DeepSeek V4-class models approach reference coding workflow-level complex coding performance.',
    sourceBoundary: {
      referenceRoot: 'D:/DSXU-code/reference-input',
      writable: false,
      rule:
        'Read this folder only as the reference behavior reference. Do not move, edit, or make it a runnable DSXU system.',
    },
    mainlineRules: [
      'DSXU has one default mainline: CLI/TUI -> query -> prompt -> DeepSeek adapter -> src/tools via DSXU adapters -> permission -> session/compact/MCP/LSP/Agent/Workflow.',
      'Absorb reference behavior semantics and prompt discipline, not reference provider shells or legacy auth/cloud runtime.',
      'Any copied or refactored behavior must be renamed and expressed as DSXU contracts, tests, and live gates.',
      'External model comparisons require raw logs and must not be claimed from dry or local-only tests.',
      'P6 cleanup follows proof: do not delete compatibility paths until default-path tests and live smokes prove they are unused.',
    ],
    items,
    releaseGate: {
      dryGate: 'reference-governance-productization',
      liveGate: 'reference-governance-live-core',
      externalComparison: 'DSXU-Code-横向评测报告-YYYYMMDD.md',
    },
  }
}

export function getDsxuGovernanceAbsorptionItem(
  idOrPrefix: string,
): DsxuGovernanceAbsorptionItem | undefined {
  return items.find(item => item.id === idOrPrefix || item.id.startsWith(idOrPrefix))
}
