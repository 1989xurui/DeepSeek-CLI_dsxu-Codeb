export type ReferenceExperienceQualityState =
  | 'evidence_green'
  | 'needs_open_project_live'
  | 'external_comparison_required'

export type ReferenceExperienceQualityItem = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  behaviorContract: readonly string[]
  acceptance: readonly string[]
  benchmarkCases: readonly string[]
  metrics: readonly string[]
  state: ReferenceExperienceQualityState
}

export type ReferenceExperienceQualityContract = {
  runtime: 'DSXU Reference Experience Quality Absorption'
  target: string
  sourceBoundary: {
    referenceRoot: 'D:\\DSXU-code\\reference-input'
    writable: false
  }
  oneMainlineRules: readonly string[]
  scoreFocus: readonly string[]
  items: readonly ReferenceExperienceQualityItem[]
  gates: {
    live: 'reference-experience-quality-live'
    dry: 'reference-experience-quality'
    releaseStress: 'mutation-product-grade-live'
    externalComparison: 'external-same-task-runner-required'
  }
}

const items: readonly ReferenceExperienceQualityItem[] = [
  {
    id: 'P1 Query Loop Programmer Recovery',
    objective:
      'Absorb reference query.ts, query/stopHooks.ts, and Tool.ts behavior so DSXU recovers like a careful programmer rather than retrying blindly.',
    referenceBehavior: ['query.ts', 'query/stopHooks.ts', 'Tool.ts'],
    dsxuLanding: [
      'src/query.ts',
      'src/dsxu/engine/query-loop.ts',
      'src/dsxu/engine/recovery',
      'src/dsxu/engine/prompt-cache-break-detection.ts',
    ],
    behaviorContract: [
      'mixed tool_use batches inject every success and failure as paired tool_result content',
      'orphan tool_use or missing tool_result cannot produce PASS',
      'failed assistant cleanup removes unusable assistant tool_use before retry',
      'max turns returns high-quality PARTIAL with verified scope, failed command, and next action',
      'verified PASS stops further exploration immediately',
      'compact continuation rereads source and preserves the original goal',
      'stop hook failure becomes PARTIAL/FAIL without a loop',
    ],
    acceptance: [
      'query recovery contract tests pass',
      'mutation query recovery cases pass with no disallowed tools',
      '22-case product-grade stress remains policy clean',
    ],
    benchmarkCases: [
      'experience-query-loop-programmer-recovery-live',
      'mutation-query-partial-tool-result-repair-live',
      'mutation-query-orphan-tool-use-deny-pass-live',
      'mutation-query-max-turns-partial-quality-live',
      'mutation-query-stop-hook-failure-partial-live',
    ],
    metrics: [
      'recoverySuccessRate',
      'fakePassCount',
      'orphanToolUseCount',
      'partialQualityEvidence',
      'verifiedPassStopRate',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P2 Agent Team Governance',
    objective:
      'Move Agent from runnable worker to team governance: parent owns scope, workers own disjoint files, verifier owns PASS evidence.',
    referenceBehavior: ['services/AgentSummary', 'tools/AgentTool', 'tools/SendMessageTool', 'coordinator'],
    dsxuLanding: [
      'src/tools/AgentTool/prompt.ts',
      'src/tools/SendMessageTool/prompt.ts',
      'src/services/AgentSummary/agentSummary.ts',
      'src/dsxu/engine/task-notification-system-v1.ts',
    ],
    behaviorContract: [
      'parent assigns explicit ownership before worker execution',
      'worker tool pool is dynamically narrowed and cannot expand parent permission',
      'multiple workers cannot edit the same scope',
      'verifier rejects fake PASS and forces SendMessage correction or parent fallback',
      'parent synthesis cites worker evidence only',
      'AgentSummary preserves failure state and cannot overwrite it with success',
    ],
    acceptance: [
      'agent governance tests pass',
      'Agent mutation cases pass with no Glob/Bash/Write drift',
      'parent final is evidence-only',
    ],
    benchmarkCases: [
      'experience-agent-team-governance-live',
      'mutation-agent-real-worker-edit-live',
      'mutation-agent-sendmessage-correction-real-live',
      'mutation-agent-two-worker-no-overlap-real-live',
      'mutation-agent-parent-synthesis-evidence-real-live',
    ],
    metrics: [
      'workerScopeConflictCount',
      'agentFakePassRejected',
      'sendMessageCorrectionSuccess',
      'parentEvidenceCitationRate',
      'agentDisallowedToolUse',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P3 Tool Prompt Strong Discipline',
    objective:
      'Make every default tool prompt carry reference-like selection discipline adapted for DeepSeek weak-model failure modes.',
    referenceBehavior: ['constants/prompts.ts', 'constants/systemPromptSections.ts', 'tools/**/prompt.ts'],
    dsxuLanding: ['src/tools/**/prompt.ts', 'src/dsxu/engine/system-prompt.ts', 'src/dsxu/engine/tool-registry-v1.ts'],
    behaviorContract: [
      'each default tool states when to use, when not to use, recovery after failure, weak-model anti-pattern, and verification evidence',
      'Read/Edit/Write/Grep/Glob are contrasted so shell fallback is not the default',
      'Bash and PowerShell do not bypass file tools or permission gates',
      'Workflow is route guidance, not a second runtime',
      'MCP credentials never re-enter prompt, summary, or logs',
      'SkillTool avoids duplicate invocation and requires evidence before final PASS',
    ],
    acceptance: [
      'all-tool prompt discipline static test passes',
      'DeepSeek tool-choice golden tests pass',
      'product-grade stress has no Bash/Glob/Write drift',
    ],
    benchmarkCases: [
      'experience-tool-prompt-strong-discipline-live',
      'v10-prompt-tool-discipline-live',
      'mutation-tool-prompt-read-edit-cache-live',
    ],
    metrics: [
      'toolMisuseRate',
      'shellBypassCount',
      'repeatEditCount',
      'readCacheConfusionCount',
      'workflowSecondRuntimeCount',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P4 Compact Memory Product Resume',
    objective:
      'Productize compact, SessionMemory, AutoDream, and extractMemories so long tasks resume without treating memory as source truth.',
    referenceBehavior: ['services/compact', 'services/SessionMemory', 'services/autoDream', 'services/extractMemories'],
    dsxuLanding: [
      'src/dsxu/engine/compact',
      'src/services/SessionMemory',
      'src/services/autoDream',
      'src/dsxu/engine/memory-pipeline.ts',
    ],
    behaviorContract: [
      'compact preserves failed command, changed files, permission denial, pending task/agent, and next action',
      'memory is a hint, never source truth',
      'resume rereads source before Edit',
      'AutoDream locks, throttles, dedupes, and rolls back unsafe state',
      'unverified state cannot be summarized as PASS',
    ],
    acceptance: [
      'compact and memory tests pass',
      'compact resume mutation cases pass',
      'source reread after memory is required in prompts and tests',
    ],
    benchmarkCases: [
      'experience-compact-memory-product-live',
      'mutation-compact-cross-run-resume-live',
      'mutation-session-memory-failure-resume-live',
      'mutation-autodream-dedupe-rollback-live',
    ],
    metrics: [
      'compactResumeSuccess',
      'sourceRereadAfterResume',
      'memoryHidesFailureCount',
      'autodreamDuplicateCount',
      'pendingTaskPreservation',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P5 Permission Usability',
    objective:
      'Keep one real permission chain while making external directory grants, Windows/WSL paths, dependency asks, and deny precedence usable.',
    referenceBehavior: ['utils/permissions', 'utils/bash', 'utils/powershell', 'components/permissions'],
    dsxuLanding: [
      'src/dsxu/engine/permission-usability.ts',
      'src/dsxu/engine/mainline-tool-adapter.ts',
      'src/tools/BashTool',
      'src/tools/PowerShellTool',
    ],
    behaviorContract: [
      'external scoped grant displays normalized Windows and WSL scope',
      'revoked scope immediately blocks future writes',
      'dependency mutation asks instead of silently running',
      'network download and network execute are separated',
      'destructive delete is hard deny',
      'acceptEdits cannot override deny precedence',
    ],
    acceptance: [
      'permission usability tests pass',
      'permission mutation cases pass',
      'external project authorization is scoped and revocable',
    ],
    benchmarkCases: [
      'experience-permission-ux-live',
      'mutation-permission-external-scoped-grant-live',
      'mutation-permission-grant-revoke-live',
      'mutation-permission-dependency-ask-live',
      'mutation-permission-network-execute-deny-live',
    ],
    metrics: [
      'permissionViolationCount',
      'grantRevokeSuccess',
      'dependencyAskRate',
      'networkExecuteDenied',
      'denyPrecedencePassRate',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P6 MCP Real Ecosystem',
    objective:
      'Move MCP beyond mock proof toward real stdio ecosystem behavior: resource, tool call, timeout, reconnect, stale cache, and redaction.',
    referenceBehavior: ['services/mcp', 'tools/MCPTool', 'tools/ReadMcpResourceTool'],
    dsxuLanding: ['src/services/mcp', 'src/services/mcp/client.ts', 'src/dsxu/engine/engine-tool-adapter.ts'],
    behaviorContract: [
      'stdio MCP server can connect, list resources, read resources, and call tools',
      'tool errors and dirty data trigger replan',
      'timeout and reconnect clear stale cache',
      'credential-like values do not enter model, summary, or log',
      'dynamic MCP tools stay behind deterministic cache-stable ordering',
    ],
    acceptance: [
      'real MCP server tests pass',
      'MCP mutation cases pass',
      'credential redaction log test passes',
    ],
    benchmarkCases: [
      'experience-mcp-real-ecosystem-live',
      'mutation-real-mcp-resource-guided-fix-live',
      'mutation-real-mcp-tool-error-replan-live',
      'mutation-real-mcp-reconnect-cache-clear-live',
      'mutation-real-mcp-credential-redaction-live',
    ],
    metrics: [
      'mcpConnectSuccess',
      'mcpReconnectSuccess',
      'mcpCredentialLeakCount',
      'mcpDirtyDataReplanRate',
      'mcpStaleCacheClearCount',
    ],
    state: 'evidence_green',
  },
  {
    id: 'P7 Programmer-Like UX',
    objective:
      'Make DSXU feel like a careful programmer: scope first, explain strategy changes, stay calm on failure, prove completion, and never wrap PARTIAL as PASS.',
    referenceBehavior: ['constants/prompts.ts', 'query.ts', 'Tool.ts', 'tools/**/prompt.ts'],
    dsxuLanding: [
      'src/dsxu/engine/system-prompt.ts',
      'src/tools/EnterPlanModeTool/prompt.ts',
      'src/tools/ExitPlanModeTool/prompt.ts',
      'src/dsxu/engine/query-loop.ts',
    ],
    behaviorContract: [
      'task start naturally narrows scope, files, tools, and acceptance',
      'strategy changes cite evidence instead of wandering',
      'failures read error output before retry',
      'completion includes test/source/tool evidence',
      'unverified work is reported as unverified',
      'PARTIAL is never packaged as PASS',
      'user refusal causes replan, not repeated same call',
    ],
    acceptance: [
      'PlanMode scope fence tests pass',
      'experience UX benchmark passes',
      'local report tracks task completion, drift, and recovery quality',
    ],
    benchmarkCases: ['experience-programmer-ux-live'],
    metrics: [
      'realTaskCompletionRate',
      'driftRate',
      'recoveryQuality',
      'evidenceBackedFinalRate',
      'unverifiedHonestyRate',
    ],
    state: 'needs_open_project_live',
  },
]

export function getReferenceExperienceQualityContract(): ReferenceExperienceQualityContract {
  return {
    runtime: 'DSXU Reference Experience Quality Absorption',
    target:
      'Raise DSXU DeepSeek V4 coding experience by absorbing reference coding workflow programmer-like recovery, planning, tool discipline, memory, permission, MCP, and final-evidence behavior into the single DSXU mainline.',
    sourceBoundary: {
      referenceRoot: 'D:\\DSXU-code\\reference-input',
      writable: false,
    },
    oneMainlineRules: [
      'reference source is read-only reference and is never modified by DSXU absorption work',
      'no reference bridge, remote, OAuth, or provider shell is restored as default runtime',
      'all behavior lands in the single DSXU mainline, tool prompts, contracts, and benchmark gates',
      'V-series documents are acceptance queues, not additional runnable systems',
      'external model superiority is not claimed without same-task raw logs',
    ],
    scoreFocus: [
      'realTaskCompletionRate',
      'driftRate',
      'recoveryQuality',
      'toolMisuseRate',
      'fakePassCount',
      'permissionViolationCount',
      'costPerVerifiedPass',
    ],
    items,
    gates: {
      live: 'reference-experience-quality-live',
      dry: 'reference-experience-quality',
      releaseStress: 'mutation-product-grade-live',
      externalComparison: 'external-same-task-runner-required',
    },
  }
}

export function getReferenceExperienceQualityItem(prefix: string): ReferenceExperienceQualityItem | undefined {
  return items.find(item => item.id.startsWith(prefix))
}
