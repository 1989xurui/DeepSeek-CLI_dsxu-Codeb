export type NextStageProductizationState =
  | 'evidence_green'
  | 'product_live_required'
  | 'external_runner_required'
  | 'cleanup_remaining'

export type NextStageProductizationItem = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  productRequirement: readonly string[]
  acceptance: readonly string[]
  benchmarkEvidence: readonly string[]
  state: NextStageProductizationState
}

export type NextStageProductizationContract = {
  runtime: 'DSXU Next Stage Productization'
  target: string
  sourceBoundary: {
    referenceRoot: string
    writable: false
  }
  rules: readonly string[]
  items: readonly NextStageProductizationItem[]
  gates: {
    productLive: string
    governanceLive: string
    fullDry: string
    externalComparisonReport: string
  }
}

const items: readonly NextStageProductizationItem[] = [
  {
    id: '1 Real Long Task Product Live Suite',
    objective:
      'Upgrade benchmark evidence from contract-only tests to real scoped product tasks that Read, Edit, Run, Verify, and only then PASS.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'Tool.ts'],
    dsxuLanding: [
      'scripts/benchmark/dsxu-mainline-benchmark.ts',
      'tmp/v8-live-fixtures',
      'src/dsxu/engine/__tests__/next-stage-productization-contract-v1.test.ts',
    ],
    productRequirement: [
      'multi-file bugfix edits a real fixture and reruns tests',
      'feature plus tests edits a real fixture and reruns tests',
      'review fix patches a security bug and reruns tests',
      'compact resume case preserves state then rereads source before edit',
      'permission denial case replans to scoped safe work',
      'Agent, MCP, and Workflow cases remain on DSXU mainline evidence rather than Grep-only checks',
    ],
    acceptance: [
      'product-real-live-suite has product-multifile-bugfix-live, product-feature-tests-live, product-review-fix-live, product-compact-resume-edit-live, product-permission-deny-replan-live, product-agent-worker-longrun-live, product-real-mcp-task-live, and product-workflow-recovery-live',
      'mutation fixture PASS requires command or source evidence and must not be only Grep evidence',
      'failure must be reportable as PARTIAL/FAIL, not fake PASS',
    ],
    benchmarkEvidence: ['benchmark gate: product-real-live-suite'],
    state: 'evidence_green',
  },
  {
    id: '2 Query Loop Mature Recovery',
    objective:
      'Continue absorbing reference query.ts and stopHooks mature loop behavior into DSXU query contracts and edge fixtures.',
    referenceBehavior: ['query.ts', 'query/stopHooks.ts'],
    dsxuLanding: [
      'src/query.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/recovery',
      'src/dsxu/engine/prompt-cache-break-detection.ts',
    ],
    productRequirement: [
      'failed assistant cleanup covers more boundary cases',
      'orphan tool_use and missing tool_result cannot pass',
      'max turns produce honest PARTIAL quality',
      'fallback retry must alter parameters or strategy',
      'compact continuation preserves context and tool-use summary insertion points',
    ],
    acceptance: [
      'query loop replay fixture passes',
      'failed assistant cleanup fixture passes',
      'max turns PARTIAL fixture passes',
      'orphan tool_use deny PASS fixture passes',
      'compact-after-overflow live remains green',
    ],
    benchmarkEvidence: [
      'governance-query-recovery-live',
      'product-compact-resume-edit-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '3 Agent Parent Worker Governance',
    objective:
      'Strengthen DSXU Agent orchestration with worker ownership, inherited permissions, verifier rejection, SendMessage correction, and evidence-only parent synthesis.',
    referenceBehavior: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: [
      'src/tools/AgentTool',
      'src/tools/SendMessageTool',
      'src/services/AgentSummary/agentSummary.ts',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    productRequirement: [
      'two workers cannot write the same scope without sequencing',
      'worker tool pool can narrow but not silently expand',
      'permission inheritance cannot broaden parent authorization',
      'verifier rejects fake PASS and SendMessage correction triggers re-verification',
      'parent synthesis cites worker evidence only',
    ],
    acceptance: [
      'agent-two-worker no-overlap evidence exists',
      'verifier reject fake PASS evidence exists',
      'parent synthesis cannot fabricate worker result',
      'product-agent-worker-longrun-live passes through default CLI benchmark path',
    ],
    benchmarkEvidence: [
      'governance-agent-summary-live',
      'product-agent-worker-longrun-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '4 Compact SessionMemory AutoDream Real Resume',
    objective:
      'Make long-task compact and memory resume behave like product recovery: hints only, source reread, edit, run, verify, PASS.',
    referenceBehavior: ['services/compact', 'services/SessionMemory', 'services/autoDream', 'services/extractMemories'],
    dsxuLanding: [
      'src/dsxu/engine/compact.ts',
      'src/services/SessionMemory',
      'src/services/autoDream',
      'src/dsxu/engine/memory-pipeline.ts',
    ],
    productRequirement: [
      'memory is hint only and cannot replace source truth',
      'failed command, permission denial, changed files, pending task, pending agent, next action, and verification state survive compact',
      'AutoDream dedupe, lock, throttle, and rollback remain active',
    ],
    acceptance: [
      'forced compact -> resume -> reread -> Edit -> test PASS',
      'resume does not rely only on memory',
      'AutoDream does not duplicate or overwrite failure state',
    ],
    benchmarkEvidence: [
      'governance-long-task-memory-live',
      'product-compact-resume-edit-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '5 MCP External Server Long Chain',
    objective:
      'Move MCP confidence from harness-only to external process semantics while preserving credential redaction and stale cache clearing.',
    referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
    dsxuLanding: [
      'src/services/mcp',
      'src/services/mcp/client.ts',
      'src/dsxu/engine/engine-tool-adapter.ts',
    ],
    productRequirement: [
      'start external MCP server process',
      'connect, list resources, read resource, call tool',
      'server error drives recovery',
      'disconnect and reconnect clear stale caches',
      'credential values never enter model, summary, or logs',
    ],
    acceptance: [
      'real-mcp-external-server-live is represented in product live suite',
      'mcp-reconnect-cache-clear-live remains green',
      'mcp-credential-no-log-live remains green',
    ],
    benchmarkEvidence: [
      'governance-real-mcp-process-live',
      'product-real-mcp-task-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '6 Permission Usability Productization',
    objective:
      'Make external directory authorization useful for real projects while preserving deny precedence and one permission chain.',
    referenceBehavior: ['utils/permissions', 'utils/bash', 'utils/powershell', 'tools/BashTool', 'tools/PowerShellTool'],
    dsxuLanding: [
      'src/dsxu/engine/permission-usability.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
      'src/tools/BashTool',
      'src/tools/PowerShellTool',
    ],
    productRequirement: [
      'D:/shooter-game and /mnt/d/shooter-game scoped grants normalize consistently',
      'grant scope is visible and revocable',
      'dependency mutation asks',
      'network execute asks or denies',
      'destructive delete hard denies',
      'acceptEdits cannot override deny precedence',
    ],
    acceptance: [
      'external scoped grant live remains green',
      'dependency mutation ask live remains green',
      'network execute deny live remains green',
      'destructive delete hard deny live remains green',
      'Windows/WSL path normalization live remains green',
    ],
    benchmarkEvidence: [
      'governance-permission-matrix-live',
      'product-permission-deny-replan-live',
    ],
    state: 'evidence_green',
  },
  {
    id: '7 Tool Prompt Strong Discipline Second Pass',
    objective:
      'Move tool prompts from having four discipline sections to using stronger reference-inspired tool choice contrast and recovery examples for weak models.',
    referenceBehavior: ['constants/prompts.ts', 'constants/systemPromptSections.ts', 'tools/*/prompt.ts'],
    dsxuLanding: ['src/tools/**/prompt.ts', 'src/dsxu/engine/system-prompt.ts'],
    productRequirement: [
      'Read/Edit/Write/Grep/Glob/Bash/PowerShell carry explicit tool-choice contrast',
      'Agent, MCP, LSP, Workflow, Skill, Todo, Task prompts prevent fake PASS and duplicate work',
      'Edit success -> verify; Read unchanged -> do not repeat old Edit',
      'Workflow is route contract, not second runtime',
      'MCP credentials never re-enter context',
    ],
    acceptance: [
      'all default tool prompts include strong tool-choice contrast',
      'DeepSeek golden checks cover anti-repeat, Grep vs Glob, Workflow route-only, MCP redaction, and Agent evidence',
    ],
    benchmarkEvidence: ['v10-prompt-tool-discipline-live', 'governance-cache-break-live'],
    state: 'evidence_green',
  },
  {
    id: '8 Provider Shell Replacement and P6 Cleanup',
    objective:
      'Finish broad cleanup only after default-path proof: legacy wording classification, runtime-visible strings, and old audit probe cleanup.',
    referenceBehavior: ['old control shell', 'old session shell', 'old proxy shell', 'services/auth-compat', 'services/remoteManagedSettings'],
    dsxuLanding: [
      'src/dsxu/engine/provider-contract.ts',
      'src/dsxu/engine/provider-alias.ts',
      '.dsxu/ops/MAINLINE_LEDGER.md',
    ],
    productRequirement: [
      'default CLI/TUI does not reference provider-migration shell',
      'old control/session/auth/proxy shells are not model/tool/startup default paths',
      'legacy aliases require explicit legacy flags',
      'five smoke classes remain green after cleanup',
    ],
    acceptance: [
      'default path import scan stays green',
      'legacy wording is classified as DSXU compatibility or explicit legacy',
      'historical Remaining sections are superseded by current state index',
    ],
    benchmarkEvidence: ['governance-ledger-current-state-live'],
    state: 'cleanup_remaining',
  },
  {
    id: '9 Public Cross-Model Evaluation',
    objective:
      'Turn DSXU local scores into a rigorous public comparison with raw logs across external coding-model runners under identical constraints.',
    referenceBehavior: ['query.ts', 'tools/*/prompt.ts', 'services/compact', 'services/mcp'],
    dsxuLanding: [
      '.dsxu/eval/model-comparison-template.json',
      '.dsxu/ops/DSXU-Code-本地阶段测试报告-20260502.md',
      'scripts/benchmark/dsxu-mainline-benchmark.ts',
    ],
    productRequirement: [
      '30-50 same-task live benchmark set is fixed',
      'all model runners use identical repo, limits, permissions, PASS markers, and scoring fields',
      'raw logs are kept for every model',
      'dry planned is never counted as live success',
    ],
    acceptance: [
      'DSXU-Code-横向评测报告-YYYYMMDD.md exists only after external model logs exist',
      'report includes pass rate, turns, wall clock, cost, repeated Edit, tool misuse, fake PASS, permission violation, recovery success, compact/resume success, and Agent success',
    ],
    benchmarkEvidence: ['external runner required; do not fake'],
    state: 'external_runner_required',
  },
]

export function getNextStageProductizationContract(): NextStageProductizationContract {
  return {
    runtime: 'DSXU Next Stage Productization',
    target:
      'Convert reference high-value governance lessons into product-grade DSXU live tasks so DeepSeek V4-class models gain stronger scoped coding, recovery, verification, memory, Agent, MCP, and permission behavior.',
    sourceBoundary: {
      referenceRoot: 'D:/DSXU-code/reference-input',
      writable: false,
    },
    rules: [
      'Keep one DSXU default mainline; do not open a second runtime or shell.',
      'Read the reference source only as reference and never mutate it.',
      'Product live means Read/Edit/Run/Verify/PASS for mutation tasks, not only Grep evidence.',
      'Governance tasks may use focused tests when destructive external behavior would be unsafe.',
      'Public cross-model claims require external runner raw logs.',
    ],
    items,
    gates: {
      productLive: 'product-real-live-suite',
      governanceLive: 'reference-governance-live-core',
      fullDry: 'full-dry-20260502-next-stage-productization',
      externalComparisonReport: 'DSXU-Code-横向评测报告-YYYYMMDD.md',
    },
  }
}

export function getNextStageProductizationItem(
  idOrPrefix: string,
): NextStageProductizationItem | undefined {
  return items.find(item => item.id === idOrPrefix || item.id.startsWith(idOrPrefix))
}
