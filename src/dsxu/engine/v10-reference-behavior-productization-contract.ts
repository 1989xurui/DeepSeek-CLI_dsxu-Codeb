export type DSXUV10State =
  | 'ready_to_build'
  | 'evidence_green'
  | 'blocked_by_compatibility'
  | 'requires_product_live'

export type DSXUV10Item = {
  id: string
  objective: string
  referenceBehavior: readonly string[]
  dsxuLanding: readonly string[]
  absorptionRules: readonly string[]
  acceptance: readonly string[]
  state: DSXUV10State
}

export type DSXUV10Contract = {
  runtime: 'DSXU V10 Reference Behavior Productization'
  target: string
  sourceBoundary: {
    referenceRoot: string
    writable: false
    normalizedPathRule: string
  }
  rules: readonly string[]
  items: readonly DSXUV10Item[]
  releaseGate: {
    dryGate: string
    selectedLiveGate: string
    minimumBenchmarkCount: number
  }
}

const queryLoopStopHooks: DSXUV10Item = {
  id: 'V10-1 Query Loop and Stop Hooks Live Recovery',
  objective:
    'Productize reference query-loop recovery and stop-hook sequencing into DSXU live recovery gates for weak-model coding.',
  referenceBehavior: [
    'query.ts',
    'query/stopHooks.ts',
    'Tool.ts',
  ],
  dsxuLanding: [
    'src/dsxu/engine/query-loop.ts',
    'src/dsxu/engine/recovery',
    'src/utils/hooks',
    'src/dsxu/engine/__tests__/v8-stop-hook-runtime-v1.test.ts',
  ],
  absorptionRules: [
    'Absorb fallback retry, failed assistant cleanup, tool-result pairing, max-output recovery, prompt-too-long recovery, and stop-hook sequencing as DSXU contracts.',
    'Do not replace the DSXU query loop wholesale with the reference query loop.',
    'Stop hooks may block unverifiable PASS, but must not run while tool calls are orphaned or unfinished.',
  ],
  acceptance: [
    'default CLI live task proves verifier-before-final after tool completion',
    'hook failure produces PARTIAL or FAIL without spinning the loop',
    'orphan tool_use cannot trigger final PASS or stop-hook completion',
    'max-output and prompt-too-long recovery preserve next action and verification status',
    'v10-product-query-stophook-live runs query recovery and stop-hook runtime tests through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const longTaskMemoryResume: DSXUV10Item = {
  id: 'V10-2 Long Task Compact SessionMemory AutoDream Resume',
  objective:
    'Turn compact, SessionMemory, and AutoDream into a product long-task resume path that continues from bounded hints and rereads source truth.',
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
    'Memory is a hint layer, never source truth.',
    'Compact snapshots must preserve user constraints, changed files, failed commands, permission denials, pending agents, verification status, and next actions.',
    'AutoDream consolidation must lock, throttle, dedupe, and rollback on conflict.',
  ],
  acceptance: [
    'forced compact then resume rereads source files before any Edit',
    'resume continues unfinished work and reaches Run/Verify/PASS in a fixture',
    'AutoDream duplicate consolidation is blocked by lock/throttle evidence',
    'memory extraction never hides failed verification or permission denial state',
    'v10-product-memory-resume-live runs compact, SessionMemory, AutoDream, and verification-state coverage through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const agentSummaryLongRun: DSXUV10Item = {
  id: 'V10-3 AgentSummary Multi-Agent Long Run',
  objective:
    'Make multi-agent long runs safe with scoped workers, permission inheritance, non-overlapping summaries, verifier rejection, and evidence-only parent synthesis.',
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
    'src/dsxu/engine/task-notification-system-v1.ts',
  ],
  absorptionRules: [
    'Only one worker may own a write scope at a time.',
    'Worker tool pools may narrow inherited tools, but may not silently expand permissions.',
    'Parent synthesis must cite worker evidence and may not invent PASS.',
  ],
  acceptance: [
    'default CLI Agent live proves worker tool pool inheritance and permission inheritance',
    'SendMessage correction causes re-verification after verifier rejection',
    'AgentSummary is periodic and non-overlapping',
    'parent synthesis reports PASS/PARTIAL/FAIL only from worker evidence',
    'v10-product-agent-longrun-live runs Agent prompt, worker continuation, notification, AgentSummary, and duplicate-notification tests through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const realMcpHarness: DSXUV10Item = {
  id: 'V10-4 Real MCP Server Harness',
  objective:
    'Move MCP validation from in-process proof to process-backed server semantics with resource, tool, reconnect, error, and redaction coverage.',
  referenceBehavior: [
    'services/mcp',
    'tools/MCPTool',
    'tools/ReadMcpResourceTool',
    'cli/handlers/mcp.tsx',
  ],
  dsxuLanding: [
    'src/services/mcp',
    'src/dsxu/engine/mcp-client.ts',
    'src/dsxu/engine/engine-tool-adapter.ts',
    'src/dsxu/engine/provider-contract.ts',
  ],
  absorptionRules: [
    'Provider credentials must be redacted before model, summary, transcript, and logs.',
    'Reconnect must clear stale tool and resource caches.',
    'Server errors must drive replan, not fake success.',
  ],
  acceptance: [
    'real MCP process supports connect, list resources, read resource, call tool, error, disconnect, and reconnect',
    'credential-like values do not appear in model-visible text, summaries, or logs',
    'dynamic MCP tools remain behind DSXU registry and permission checks',
    'v10-product-real-mcp-process-live runs MCP resource, dynamic tool, recoverable error, reconnect, and redaction tests through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const permissionUsability: DSXUV10Item = {
  id: 'V10-5 Permission Usability Productization',
  objective:
    'Productize external workspace grants and one-chain Bash, PowerShell, and file-edit decisions without weakening deny precedence.',
  referenceBehavior: [
    'utils/permissions',
    'utils/bash',
    'utils/powershell',
    'components/permissions',
    'hooks/toolPermission',
  ],
  dsxuLanding: [
    'src/dsxu/engine/permission-usability.ts',
    'src/dsxu/engine/mainline-tool-adapter.ts',
    'src/tools/BashTool',
    'src/tools/PowerShellTool',
  ],
  absorptionRules: [
    'Do not maintain a second shell safety engine.',
    'External write grants must show normalized scope, source, grant time, expiration, and revocation path.',
    'Deny precedence beats acceptEdits, allowlists, and external grants.',
  ],
  acceptance: [
    'D:/project and /mnt/d/project grants normalize consistently',
    'dependency mutation and network execute are ask or deny by policy',
    'destructive delete is hard deny',
    'Bash, PowerShell, and file edits share one decision chain',
    'v10-product-permission-usability-live runs Windows/WSL scoped grant and expiration filtering tests through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

const providerReplacement: DSXUV10Item = {
  id: 'V10-6 Provider Backend Replacement',
  objective:
    'Replace reference-era provider shells with DSXU-owned provider backend semantics before archiving old shell directories.',
  referenceBehavior: [
    'old control shell',
    'old session shell',
    'old proxy shell',
    'cli/transports',
    'services/remoteManagedSettings',
  ],
  dsxuLanding: [
    'src/dsxu/engine/provider-contract.ts',
    'src/dsxu/engine/provider-backend/local-provider-backend.ts',
    'src/dsxu/engine/provider-alias.ts',
    'src/main.tsx',
    'src/entrypoints/cli.tsx',
  ],
  absorptionRules: [
    'Absorb remote session, event stream, task sync, permission callback, and credential vault semantics only.',
    'Do not absorb legacy auth/cloud shell code into the default DSXU path.',
    'Archive old control/session/proxy shells only after compatibility imports are removed or remapped.',
  ],
  acceptance: [
    'default CLI starts without importing old control/session/proxy shells',
    '--remote, remote-control, and legacy target aliases route through DSXU provider contract or explicit legacy flag',
    'provider event stream records session, permission, task-sync, and remote-blocked events',
    'old shell directories are archived only after import scan and five live smokes are green',
  ],
  state: 'evidence_green',
}

const promptToolDiscipline: DSXUV10Item = {
  id: 'V10-7 Prompt and Tool Discipline Upgrade',
  objective:
    'Rewrite reference tool-selection discipline into DSXU/DeepSeek prompt language with stable cache layout and weak-model anti-patterns.',
  referenceBehavior: [
    'constants/systemPromptSections.ts',
    'constants/prompts.ts',
    'tools/*/prompt.ts',
    'context.ts',
  ],
  dsxuLanding: [
    'src/dsxu/engine/system-prompt.ts',
    'src/dsxu/engine/context-builder.ts',
    'src/tools/*/prompt.ts',
    'src/dsxu/engine/prompt-cache-break-detection.ts',
  ],
  absorptionRules: [
    'Static tool-use guidance must stay before the dynamic prompt boundary.',
    'Volatile session data must stay after stable prompt sections.',
    'Every critical tool prompt must include when to use, when not to use, recovery after failure, and weak-model anti-patterns.',
  ],
  acceptance: [
    'Agent, SendMessage, MCP, ReadMcpResource, LSP, Workflow, Skill, PlanMode, Bash, PowerShell, Read, Edit, Write, Grep, and Glob have DSXU weak-model discipline sections',
    'DeepSeek tool-use examples include failure recovery and wrong-tool counterexamples',
    'prompt cache mutation points are documented and tested',
    'v10-prompt-docs-discipline-v1.test.ts verifies prompt discipline and cache-stable prompt layout',
    'v10-selected-mutation-live cases prove Edit-to-verify closure on mutation fixtures',
  ],
  state: 'evidence_green',
}

const docsLedgerCleanup: DSXUV10Item = {
  id: 'V10-8 Docs Encoding Path Ledger Cleanup',
  objective:
    'Clean V3-V9 tracking docs, path references, and evidence ledger so future audits use the real reference source root and readable UTF-8 text.',
  referenceBehavior: [
    'D:/DSXU-code/reference-input',
  ],
  dsxuLanding: [
    '.dsxu/ops',
    '.dsxu/ops/MAINLINE_LEDGER.md',
    'src/dsxu/engine/__tests__/v10-*',
  ],
  absorptionRules: [
    'Do not edit the original reference source.',
    'Normalize references to the actual source root, not a non-existent src subfolder.',
    'User/model-visible mojibake must be cleaned before comment-only mojibake.',
  ],
  acceptance: [
    'V10 docs state the true reference-root boundary',
    'V3-V9 evidence ledger has no newly introduced mojibake',
    'default visible strings and prompts are prioritized over comments',
    'v10-docs-encoding-ledger-live verifies the docs encoding ledger through the default CLI benchmark path',
  ],
  state: 'evidence_green',
}

export function getDsxuV10Contract(): DSXUV10Contract {
  return {
    runtime: 'DSXU V10 Reference Behavior Productization',
    target:
      'Productize the remaining reference high-value behaviors in DSXU single-mainline form so DeepSeek-class weak models gain stronger recovery, limits, tools, permissions, memory, Agent orchestration, MCP safety, and prompt control.',
    sourceBoundary: {
      referenceRoot: 'D:/DSXU-code/reference-input',
      writable: false,
      normalizedPathRule:
        'The reference root is D:/DSXU-code/reference-input itself; do not assume a src subfolder.',
    },
    rules: [
      'Absorb behavior semantics, not reference provider shells.',
      'Do not create a second runnable system or side runtime.',
      'Do not move old shells until default path and compatibility alias scans prove they are unreachable.',
      'Every live PASS must cite tool, source, or command evidence.',
      'Memory, summaries, and prompts are guidance layers, never replacements for source truth.',
      'Weak-model safeguards must prefer scope fences, explicit verification, and recovery contracts over broad autonomy.',
    ],
    items: [
      queryLoopStopHooks,
      longTaskMemoryResume,
      agentSummaryLongRun,
      realMcpHarness,
      permissionUsability,
      providerReplacement,
      promptToolDiscipline,
      docsLedgerCleanup,
    ],
    releaseGate: {
      dryGate: 'v10-productization',
      selectedLiveGate: 'v10-selected-live',
      minimumBenchmarkCount: 110,
    },
  }
}

export function getDsxuV10Item(id: string): DSXUV10Item | undefined {
  return getDsxuV10Contract().items.find(item => item.id.startsWith(id))
}
