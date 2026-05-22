#!/usr/bin/env bun

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export type CommandCatalogCategory =
  | 'product-runtime'
  | 'mainline-validation'
  | 'release-only'
  | 'owner-review'
  | 'historical-evidence'
  | 'internal-benchmark'
  | 'live-provider'
  | 'toolchain'
  | 'supporting-utility';

export interface CommandCatalogEntry {
  name: string;
  command: string;
  category: CommandCatalogCategory;
  owner: string;
  publicClaimUse: 'allowed-with-evidence' | 'internal-only' | 'blocked-as-claim' | 'operator-only';
  reason: string;
}

export interface OwnerFocusedVerificationGroup {
  groupId: string;
  owner: string;
  purpose: string;
  testTier: 'mainline' | 'slow' | 'acceptance' | 'live-provider' | 'release-only';
  timeoutBudgetMs: number;
  liveProvider: boolean;
  commands: string[];
  claimBoundary: 'source-test-evidence-only' | 'live-required' | 'release-only';
}

export interface CommandCatalog {
  schemaVersion: 'dsxu.command-catalog.v1';
  generatedAt: string;
  status: 'PASS_DSXU_COMMAND_CATALOG_READY';
  scriptCount: number;
  categorySummary: Record<CommandCatalogCategory, number>;
  mainlineAliases: string[];
  ownerFocusedVerificationGroups: OwnerFocusedVerificationGroup[];
  entries: CommandCatalogEntry[];
  rule: string;
}

export type V4ProductCore =
  | 'provider-plan'
  | 'work-ledger'
  | 'tool-envelope'
  | 'permission-decision'
  | 'verification-envelope'
  | 'recovery-decision'
  | 'agent-evidence'
  | 'trust-ui';

export type V4CapabilityState =
  | 'default-mainline'
  | 'on-demand'
  | 'frozen-experimental'
  | 'replace-delete-candidate'
  | 'release-only';

export interface V4FeatureOwnerEntry {
  id: string;
  capability: string;
  productCore: V4ProductCore;
  state: V4CapabilityState;
  ownerFiles: string[];
  workflowEntry: string;
  acceptanceEvidence: string[];
  claimBoundary: 'public-allowed-with-current-evidence' | 'workflow-only' | 'internal-only' | 'blocked-as-public-claim';
  action: string;
}

export interface V4FeatureOwnerMap {
  schemaVersion: 'dsxu.v4.feature-owner-map.v1';
  generatedAt: string;
  status: 'PASS_DSXU_V4_FEATURE_OWNER_MAP_READY';
  productCores: V4ProductCore[];
  summary: Record<V4CapabilityState, number>;
  entries: V4FeatureOwnerEntry[];
  rule: string;
}

export interface V4FreezeRegisterEntry {
  id: string;
  capability: string;
  defaultStatus: 'default-disabled' | 'frozen' | 'release-gated' | 'owner-review-only';
  productCore: V4ProductCore;
  ownerFiles: string[];
  allowedUse: string;
  blockedUse: string;
  action: string;
}

export interface V4FreezeRegister {
  schemaVersion: 'dsxu.v4.freeze-register.v1';
  generatedAt: string;
  status: 'PASS_DSXU_V4_FREEZE_REGISTER_READY';
  entries: V4FreezeRegisterEntry[];
  rule: string;
}

export interface V4ComplexityRiskEntry {
  riskId: string;
  risk: string;
  riskClass:
    | 'second-runtime'
    | 'second-provider'
    | 'second-toolbus'
    | 'second-agent'
    | 'second-tui'
    | 'claim-inflation'
    | 'script-surface'
    | 'prompt-stack';
  currentOwner: string;
  activeSignals: string[];
  status: 'contained' | 'open' | 'blocked' | 'watch';
  requiredAction: string;
  stage: 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8';
}

export interface V4ComplexityRiskRegister {
  schemaVersion: 'dsxu.v4.complexity-risk-register.v1';
  generatedAt: string;
  status: 'PASS_DSXU_V4_COMPLEXITY_RISK_REGISTER_READY';
  entries: V4ComplexityRiskEntry[];
  rule: string;
}

export interface V4ScriptSurfaceMap {
  schemaVersion: 'dsxu.v4.script-surface-map.v1';
  generatedAt: string;
  status: 'PASS_DSXU_V4_SCRIPT_SURFACE_MAP_READY';
  commandCatalogRef: string;
  categorySummary: Record<CommandCatalogCategory, number>;
  mainlineAliases: string[];
  publicClaimBlockedScripts: string[];
  releaseOnlyScripts: string[];
  liveProviderScripts: string[];
  ownerReviewScripts: string[];
  rule: string;
}

const MAINLINE_ALIASES = [
  'evidence:dashboard',
  'benchmark:swe-bench',
  'health:runtime',
  'cache:warm',
];

const CATEGORY_ORDER: CommandCatalogCategory[] = [
  'product-runtime',
  'mainline-validation',
  'release-only',
  'owner-review',
  'historical-evidence',
  'internal-benchmark',
  'live-provider',
  'toolchain',
  'supporting-utility',
];

const OWNER_FOCUSED_VERIFICATION_GROUPS: OwnerFocusedVerificationGroup[] = [
  {
    groupId: 'tool-runtime-event-boundary',
    owner: 'Tool Gate / Tool Result Contract owner',
    purpose: 'prove legacy provider tool_result blocks normalize to canonical ToolCallResult, ledger event, and work-state event without a second tool runtime',
    testTier: 'mainline',
    timeoutBudgetMs: 60_000,
    liveProvider: false,
    commands: [
      'bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts',
      'bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts -t "provider"',
      'bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "canonical ToolCallResult"',
    ],
    claimBoundary: 'source-test-evidence-only',
  },
  {
    groupId: 'verification-recovery-ledger',
    owner: 'VerificationKernel / Recovery / GearBox owner',
    purpose: 'prove verification policy, recovery decision, long-task ledger, and final-claim boundary share one evidence projection',
    testTier: 'mainline',
    timeoutBudgetMs: 60_000,
    liveProvider: false,
    commands: [
      'bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts',
      'bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts -t "long-task ledger"',
      'bun test src/dsxu/engine/__tests__/verify-gate.test.ts',
      'bun test src/dsxu/engine/__tests__/query-loop-gate-state-v1.test.ts',
    ],
    claimBoundary: 'source-test-evidence-only',
  },
  {
    groupId: 'mainline-tool-permission-agent-skill',
    owner: 'Tool Gate / Permission / Agent / MCP-Skill owner',
    purpose: 'prove default tools, permission callbacks, agent handoff, MCP/Skill registry, and shell adapters stay on the DSXU mainline',
    testTier: 'mainline',
    timeoutBudgetMs: 60_000,
    liveProvider: false,
    commands: [
      'bun test src/dsxu/engine/__tests__/mainline-tool-adapter-v1.test.ts',
      'bun test src/dsxu/engine/__tests__/agent-runtime-mainline-v1.test.ts src/dsxu/engine/__tests__/skill-governance-contract-v1.test.ts',
    ],
    claimBoundary: 'source-test-evidence-only',
  },
  {
    groupId: 'tui-trust-projection',
    owner: 'TUI work-state / trust projection owner',
    purpose: 'prove visible work-state, compact tool cards, ledger/agent panel, EvidenceLine, context advanced view, and resize behavior consume mainline evidence',
    testTier: 'acceptance',
    timeoutBudgetMs: 180_000,
    liveProvider: false,
    commands: [
      'bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts',
      'bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts',
      'bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts',
      'bun test src/commands/context/__tests__/context-advanced.test.ts',
      'bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts -t "preserves a middle scrollback"',
    ],
    claimBoundary: 'live-required',
  },
  {
    groupId: 'release-trust-evidence',
    owner: 'Evidence / release claim binder owner',
    purpose: 'prove dashboard, command catalog, release gates, public-comparable boundaries, and README claim evidence remain honest',
    testTier: 'release-only',
    timeoutBudgetMs: 180_000,
    liveProvider: false,
    commands: [
      'bun test scripts/__tests__/dsxu-command-catalog.test.ts scripts/__tests__/dsxu-evidence-dashboard.test.ts',
      'bun run scripts/dsxu-command-catalog.ts',
      'bun run evidence:dashboard',
    ],
    claimBoundary: 'release-only',
  },
];

const V4_PRODUCT_CORES: V4ProductCore[] = [
  'provider-plan',
  'work-ledger',
  'tool-envelope',
  'permission-decision',
  'verification-envelope',
  'recovery-decision',
  'agent-evidence',
  'trust-ui',
];

const V4_FEATURE_OWNER_ENTRIES: V4FeatureOwnerEntry[] = [
  {
    id: 'V4-F01',
    capability: 'DeepSeek V4 model capability facts',
    productCore: 'provider-plan',
    state: 'default-mainline',
    ownerFiles: ['src/utils/model/deepseekV4Control.ts', 'src/dsxu/engine/model-capability-v1.ts', 'src/dsxu/engine/model-config.ts'],
    workflowEntry: 'query-loop/provider plan',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/model-capability-v1.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Keep as canonical model/context/thinking/FIM/cost/cache fact owner.',
  },
  {
    id: 'V4-F02',
    capability: 'DeepSeek request body construction',
    productCore: 'provider-plan',
    state: 'default-mainline',
    ownerFiles: ['src/services/api/deepseek-adapter.ts', 'src/utils/model/deepseekV4Control.ts'],
    workflowEntry: 'api-service/provider adapter',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'P1 must keep every chat/tool/thinking request behind the canonical provider helper.',
  },
  {
    id: 'V4-F03',
    capability: 'Flash-first route, Flash-MAX/Pro admission',
    productCore: 'provider-plan',
    state: 'default-mainline',
    ownerFiles: ['src/utils/model/deepseekV4CostRouter.ts', 'src/dsxu/engine/model-routing-control.ts', 'src/dsxu/engine/deepseek-model-policy.ts'],
    workflowEntry: 'route/cost/cache owner',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/real-task-route-plan.test.ts', 'bun test src/dsxu/engine/__tests__/deepseek-cost-quality-board.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Default Flash; require explicit evidence for Flash-MAX/Pro admission.',
  },
  {
    id: 'V4-F04',
    capability: 'Usage, cost, and cache trajectory',
    productCore: 'provider-plan',
    state: 'default-mainline',
    ownerFiles: ['src/services/api/deepseek-trajectory-store.ts', 'src/dsxu/engine/final-report-usage-evidence.ts', 'src/dsxu/engine/cost-cache-live-task-evidence.ts'],
    workflowEntry: 'final report / evidence dashboard',
    acceptanceEvidence: ['bun test src/services/api/deepseek-trajectory-store.test.ts', 'bun test src/dsxu/engine/__tests__/cost-cache-live-task-evidence.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Project route/cost/cache into ledger, Trust UI, and release evidence.',
  },
  {
    id: 'V4-F05',
    capability: 'Cache-first stable prefix and dynamic tail',
    productCore: 'provider-plan',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/prompt-prefix-cache-builder.ts', 'src/dsxu/engine/prompt-prefix-cache-evidence.ts', 'src/dsxu/engine/route-cache-dynamic-tail.ts'],
    workflowEntry: 'DeepSeek route/cost/cache owner',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/prompt-prefix-cache-builder.test.ts', 'bun test src/dsxu/engine/__tests__/route-cache-dynamic-tail.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P2 must preserve source truth while reducing prompt drift.',
  },
  {
    id: 'V4-F06',
    capability: 'Cache warmer',
    productCore: 'provider-plan',
    state: 'on-demand',
    ownerFiles: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
    workflowEntry: 'operator dry-run',
    acceptanceEvidence: ['bun run scripts/dsxu-cache-warm.ts --dry-run'],
    claimBoundary: 'internal-only',
    action: 'Keep dry-run by default; no startup background provider call without performance evidence.',
  },
  {
    id: 'V4-F07',
    capability: 'Progress ledger and runtime event proof',
    productCore: 'work-ledger',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/progress-ledger.ts', 'src/dsxu/engine/work-state-timeline.ts'],
    workflowEntry: 'query-loop/tool/recovery/final report',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/work-package-i/progress-ledger.test.ts', 'bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P5/P7 must make tool, verification, recovery, route, and agent events consume the same ledger shape.',
  },
  {
    id: 'V4-F08',
    capability: 'Long task resume and checkpoint state',
    productCore: 'work-ledger',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/progress-ledger.ts', 'src/coordinator/persist.ts', 'src/QueryEngine.ts'],
    workflowEntry: 'long task query-loop/coordinator',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/memory-resume.test.ts', 'bun test src/dsxu/engine/__tests__/work-package-i/query-loop-progress-ledger.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'Keep one durable task ledger; do not keep separate visible-state and recovery ledgers.',
  },
  {
    id: 'V4-F09',
    capability: 'Work-state timeline',
    productCore: 'work-ledger',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/work-state-timeline.ts', 'src/query.ts'],
    workflowEntry: 'TUI/CLI/final report projection',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/work-state-timeline.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Use as projection source; do not create another UI state runtime.',
  },
  {
    id: 'V4-F10',
    capability: 'Canonical ToolCallResult',
    productCore: 'tool-envelope',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/tool-protocol.ts', 'src/dsxu/engine/tool-protocol-integration.ts'],
    workflowEntry: 'Tool Gate',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P4 must keep provider/MCP/legacy shapes normalized before ledger/recovery/TUI.',
  },
  {
    id: 'V4-F11',
    capability: 'Tool runtime event boundary',
    productCore: 'tool-envelope',
    state: 'default-mainline',
    ownerFiles: ['src/services/tools/toolLifecycle.ts', 'src/services/tools/toolExecution.ts'],
    workflowEntry: 'tool execution lifecycle',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'Fold tool execution into ToolCallResult + ledger + work-state event; no second tool runtime.',
  },
  {
    id: 'V4-F12',
    capability: 'Large tool result artifact and compact card',
    productCore: 'tool-envelope',
    state: 'default-mainline',
    ownerFiles: ['src/utils/toolResultStorage.ts', 'src/components/messages/UserToolResultMessage/utils.tsx'],
    workflowEntry: 'tool result display/final report',
    acceptanceEvidence: ['bun test src/components/messages/UserToolResultMessage/__tests__/utils.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Keep long output out of chat body; expose preview, risk, and artifact path.',
  },
  {
    id: 'V4-F13',
    capability: 'Legacy ToolBus',
    productCore: 'tool-envelope',
    state: 'frozen-experimental',
    ownerFiles: ['src/dsxu/engine/tool-bus', 'src/dsxu/engine/__tests__/wave5-telemetry.test.ts'],
    workflowEntry: 'historical tests only',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/tool-protocol/consistency.test.ts'],
    claimBoundary: 'blocked-as-public-claim',
    action: 'Freeze as historical/owner-review surface; new callers must use ToolCallResult boundary.',
  },
  {
    id: 'V4-F14',
    capability: 'Permission gate and product-core guard',
    productCore: 'permission-decision',
    state: 'default-mainline',
    ownerFiles: ['src/utils/permissions/filesystem.ts', 'src/dsxu/engine/workspace-policy.ts'],
    workflowEntry: 'FileEdit/FileWrite/shell/agent tool gates',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/product-core-guard.test.ts', 'bun test src/tools/__tests__/tool-permission-owner-gate.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Every side-effect must route through permission decision evidence.',
  },
  {
    id: 'V4-F15',
    capability: 'Shell and command risk permission',
    productCore: 'permission-decision',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/shell-gate.ts', 'src/dsxu/engine/adapters/bash-adapter.ts'],
    workflowEntry: 'terminal/tool execution',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/terminal-hit-rate.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'Keep command purpose, risk, cwd/env, exit code, and output preview visible.',
  },
  {
    id: 'V4-F16',
    capability: 'Owner/Git mutation and deletion review',
    productCore: 'permission-decision',
    state: 'on-demand',
    ownerFiles: ['scripts/dsxu-owner-git-mutation-preflight.ts', 'src/dsxu/engine/replace-delete-owner-review.ts'],
    workflowEntry: 'owner review packet',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/replace-delete-owner-review.test.ts'],
    claimBoundary: 'internal-only',
    action: 'Keep deletion/stage/commit decisions outside automatic runtime mutation.',
  },
  {
    id: 'V4-F17',
    capability: 'Post-mutation verification envelope',
    productCore: 'verification-envelope',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/post-mutation-verification-envelope.ts', 'src/coordinator/tdd-gate/post-write-hook.ts'],
    workflowEntry: 'FileEdit/FileWrite post mutation',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/post-mutation-verification-envelope.test.ts', 'bun test src/coordinator/tdd-gate/__tests__/gate.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P3 must keep PASS/PARTIAL/SKIPPED/FAIL visible after every mutation.',
  },
  {
    id: 'V4-F18',
    capability: 'Static analysis post-mutation envelope',
    productCore: 'verification-envelope',
    state: 'default-mainline',
    ownerFiles: ['src/services/static-analysis/tool-gate.ts', 'src/services/static-analysis/__tests__/bridge.test.ts'],
    workflowEntry: 'FileEdit/FileWrite post mutation',
    acceptanceEvidence: ['bun test src/services/static-analysis/__tests__/bridge.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'Keep static analysis inside verification evidence, not as a second permission runtime.',
  },
  {
    id: 'V4-F19',
    capability: 'Six-stage final test gate',
    productCore: 'verification-envelope',
    state: 'release-only',
    ownerFiles: ['scripts/dsxu-v24-six-stage-final-tests.ts'],
    workflowEntry: 'release gate',
    acceptanceEvidence: ['bun run test:six-stage-final'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Use for final release proof only; do not replace feature acceptance.',
  },
  {
    id: 'V4-F20',
    capability: 'Recovery GearBox and decision state',
    productCore: 'recovery-decision',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/gear-box.ts', 'src/dsxu/engine/recovery/index.ts'],
    workflowEntry: 'query-loop failure handling',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/gear-box.test.ts', 'bun test src/dsxu/engine/__tests__/gear-box-recovery-link-v1.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P5 must make retry/replan/rollback/abort come from one decision table.',
  },
  {
    id: 'V4-F21',
    capability: 'Failure taxonomy',
    productCore: 'recovery-decision',
    state: 'default-mainline',
    ownerFiles: ['src/dsxu/engine/controlled-failure-taxonomy.ts', 'src/dsxu/engine/recovery'],
    workflowEntry: 'verification/tool/provider failure handling',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/controlled-failure-taxonomy.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'Normalize failures into retry/replan/rollback/ask-human/abort/escalate-model.',
  },
  {
    id: 'V4-F22',
    capability: 'Multiple recovery planners',
    productCore: 'recovery-decision',
    state: 'frozen-experimental',
    ownerFiles: ['src/dsxu/engine/recovery/recovery-planner.ts', 'src/dsxu/engine/recovery/recovery-planner-v3.ts'],
    workflowEntry: 'historical compatibility tests',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/recovery-mainline-v3.test.ts'],
    claimBoundary: 'blocked-as-public-claim',
    action: 'Freeze variants; P5 must expose one mainline Recovery Decision Table.',
  },
  {
    id: 'V4-F23',
    capability: 'Agent serial worker and parallel fanout evidence',
    productCore: 'agent-evidence',
    state: 'default-mainline',
    ownerFiles: ['src/tools/AgentTool', 'src/dsxu/engine/agent-mcp-skill-boundary-board.ts'],
    workflowEntry: 'AgentTool evidence handoff',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/agent-orchestration-mode-v1.test.ts', 'bun test src/dsxu/engine/__tests__/agent-parent-final-gate-replay-v1.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Agent may hand off evidence only; parent owns final claim.',
  },
  {
    id: 'V4-F24',
    capability: 'Swarm/team/forked branch systems',
    productCore: 'agent-evidence',
    state: 'frozen-experimental',
    ownerFiles: ['src/utils/swarm', 'src/utils/forkedAgent.ts', 'src/tools/AgentTool/forkSubagent.ts'],
    workflowEntry: 'disabled or explicit owner-review only',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts'],
    claimBoundary: 'blocked-as-public-claim',
    action: 'Do not make swarm/forked branches default; reduce to serial worker or disjoint fanout.',
  },
  {
    id: 'V4-F25',
    capability: 'MCP/Skill registry boundary',
    productCore: 'agent-evidence',
    state: 'default-mainline',
    ownerFiles: ['src/commands/mcp', 'src/tools/AgentTool/prompt.ts', 'src/dsxu/engine/skills-adapter.ts'],
    workflowEntry: 'Tool Gate / registry',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/agent-mcp-skill-boundary-board.test.ts', 'bun run scripts/dsxu-agent-mcp-skill-boundary-acceptance.ts'],
    claimBoundary: 'workflow-only',
    action: 'MCP/Skill is a governed tool boundary, not a standalone runtime.',
  },
  {
    id: 'V4-F26',
    capability: 'Trust footer and compact state',
    productCore: 'trust-ui',
    state: 'default-mainline',
    ownerFiles: ['src/components/PromptInput', 'src/components/messages', 'src/query.ts'],
    workflowEntry: 'Ink TUI / CLI display',
    acceptanceEvidence: ['bun test src/components/PromptInput/__tests__/PromptInputFooter-trust.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P7 must keep route/verification/cost/cache/blocked state short and non-repetitive.',
  },
  {
    id: 'V4-F27',
    capability: 'EvidenceLine suppression from normal chat',
    productCore: 'trust-ui',
    state: 'default-mainline',
    ownerFiles: ['src/components/messages/SystemTextMessage.tsx'],
    workflowEntry: 'TUI message rendering',
    acceptanceEvidence: ['bun test src/components/messages/__tests__/SystemTextMessage-evidence-line.test.ts'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'Keep final usage evidence in trust/report surfaces, not duplicated as chat text.',
  },
  {
    id: 'V4-F28',
    capability: 'Real TUI resize and long output harness',
    productCore: 'trust-ui',
    state: 'default-mainline',
    ownerFiles: ['src/screens/REPL.tsx', 'src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts'],
    workflowEntry: 'TUI acceptance harness',
    acceptanceEvidence: ['bun test src/dsxu/engine/__tests__/real-tui-harness-v1.test.ts'],
    claimBoundary: 'workflow-only',
    action: 'P7 must keep resize, permission dialog, long output, and tail pin behavior stable.',
  },
  {
    id: 'V4-F29',
    capability: 'Evidence dashboard and release claim binder',
    productCore: 'trust-ui',
    state: 'release-only',
    ownerFiles: ['scripts/dsxu-evidence-dashboard.ts', 'docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json'],
    workflowEntry: 'release evidence workbench',
    acceptanceEvidence: ['bun run evidence:dashboard'],
    claimBoundary: 'public-allowed-with-current-evidence',
    action: 'P8 must only publish claims backed by current source/test/live/raw/cost evidence.',
  },
  {
    id: 'V4-F30',
    capability: 'V-series historical evidence scripts',
    productCore: 'trust-ui',
    state: 'release-only',
    ownerFiles: ['scripts/dsxu-v20-*', 'scripts/dsxu-v24-*', 'scripts/dsxu-v26-*'],
    workflowEntry: 'historical evidence only',
    acceptanceEvidence: ['bun run scripts/dsxu-command-catalog.ts'],
    claimBoundary: 'internal-only',
    action: 'Keep as evidence inputs; do not expose as product runtime or GitHub feature claims.',
  },
];

const V4_FREEZE_REGISTER_ENTRIES: V4FreezeRegisterEntry[] = [
  {
    id: 'V4-FRZ-01',
    capability: 'Voting / consensus panel',
    defaultStatus: 'frozen',
    productCore: 'agent-evidence',
    ownerFiles: ['src/coordinator/voting'],
    allowedUse: 'Historical evidence or explicit research-only owner review.',
    blockedUse: 'Default coding workflow, public capability claim, or automatic model debate.',
    action: 'Keep out of default chain; reduce any needed disagreement to Pro admission evidence.',
  },
  {
    id: 'V4-FRZ-02',
    capability: 'Forked agent counterfactual branch',
    defaultStatus: 'default-disabled',
    productCore: 'agent-evidence',
    ownerFiles: ['src/utils/forkedAgent.ts', 'src/tools/AgentTool/forkSubagent.ts'],
    allowedUse: 'Explicit AgentTool worker/fanout with owner scope and evidence packet.',
    blockedUse: 'Autonomous branch tree, hidden second query loop, or parent PASS without evidence.',
    action: 'Fold accepted use into Agent Evidence Handoff; freeze branch fantasy paths.',
  },
  {
    id: 'V4-FRZ-03',
    capability: 'Swarm / team mesh',
    defaultStatus: 'default-disabled',
    productCore: 'agent-evidence',
    ownerFiles: ['src/utils/swarm', 'src/screens/REPL.tsx'],
    allowedUse: 'Existing compatibility code only when explicitly enabled and permission-visible.',
    blockedUse: 'Default coding runtime, manager mesh, agent-of-agents, or public swarm claim.',
    action: 'Keep default route to serial worker or disjoint fanout evidence.',
  },
  {
    id: 'V4-FRZ-04',
    capability: 'Legacy ToolBus',
    defaultStatus: 'frozen',
    productCore: 'tool-envelope',
    ownerFiles: ['src/dsxu/engine/tool-bus', 'src/dsxu/engine/__tests__/wave5-telemetry.test.ts'],
    allowedUse: 'Historical tests and owner-review migration evidence.',
    blockedUse: 'New tool caller or second tool runtime.',
    action: 'All new outputs must normalize to ToolCallResult at Tool Gate.',
  },
  {
    id: 'V4-FRZ-05',
    capability: 'Multiple recovery planner variants',
    defaultStatus: 'frozen',
    productCore: 'recovery-decision',
    ownerFiles: ['src/dsxu/engine/recovery/recovery-planner.ts', 'src/dsxu/engine/recovery/recovery-planner-v3.ts'],
    allowedUse: 'Compatibility tests proving mainline export points at the accepted decision table.',
    blockedUse: 'Parallel recovery stacks with conflicting retry/replan decisions.',
    action: 'P5 owns consolidation into one Recovery Decision Table.',
  },
  {
    id: 'V4-FRZ-06',
    capability: 'Multiple prompt stacks',
    defaultStatus: 'frozen',
    productCore: 'provider-plan',
    ownerFiles: ['src/dsxu/engine/prompt-stack-v1.ts', 'src/dsxu/engine/prompt-processing-v1.ts', 'src/dsxu/engine/system-prompt-builder-v1.ts'],
    allowedUse: 'Source evidence for prompt slimming and cache-safe discipline.',
    blockedUse: 'Layered prompt accumulation in default query path.',
    action: 'P2 owns stable prefix / dynamic tail; prompt policy belongs in runtime gates.',
  },
  {
    id: 'V4-FRZ-07',
    capability: 'MCP/Skill standalone runtime',
    defaultStatus: 'default-disabled',
    productCore: 'agent-evidence',
    ownerFiles: ['src/commands/mcp', 'src/dsxu/engine/skills-adapter.ts'],
    allowedUse: 'Registry-governed tool boundary through DSXU Tool Gate.',
    blockedUse: 'External server or skill owning runtime, permission, or provider routing.',
    action: 'P6 keeps MCP/Skill as registry/tool boundary with owner proof.',
  },
  {
    id: 'V4-FRZ-08',
    capability: 'Background provider cache warmer',
    defaultStatus: 'default-disabled',
    productCore: 'provider-plan',
    ownerFiles: ['src/services/cache-warmer.ts', 'scripts/dsxu-cache-warm.ts'],
    allowedUse: 'Dry-run or explicit long-session operator action.',
    blockedUse: 'Startup background DeepSeek calls or hidden cost generation.',
    action: 'Keep dry-run default until P2 has performance evidence.',
  },
  {
    id: 'V4-FRZ-09',
    capability: 'Internal smoke as public benchmark',
    defaultStatus: 'release-gated',
    productCore: 'trust-ui',
    ownerFiles: ['scripts/dsxu-swe-bench-runner.ts', 'scripts/dsxu-evidence-dashboard.ts'],
    allowedUse: 'Internal regression and dashboard input with smoke label.',
    blockedUse: 'Formal SWE-bench or external victory claim without raw paired evidence.',
    action: 'P8 final claim gate controls public wording.',
  },
  {
    id: 'V4-FRZ-10',
    capability: 'Generic package entrypoint expansion',
    defaultStatus: 'owner-review-only',
    productCore: 'trust-ui',
    ownerFiles: ['package.json', 'scripts/dsxu-command-catalog.ts'],
    allowedUse: 'Owner-reviewed mainline alias, release-only command, or internal evidence command.',
    blockedUse: 'New product surface without owner classification.',
    action: 'P0 command catalog must classify every script and block claim leakage.',
  },
];

const V4_COMPLEXITY_RISK_ENTRIES: V4ComplexityRiskEntry[] = [
  {
    riskId: 'V4-R01',
    risk: 'Second provider request body builder can drift from DeepSeek thinking/tool contract.',
    riskClass: 'second-provider',
    currentOwner: 'Provider Plan owner',
    activeSignals: ['src/services/api/deepseek-adapter.ts', 'src/dsxu/engine/api-service.ts', 'src/dsxu/engine/model-gateway-v1.ts'],
    status: 'open',
    requiredAction: 'P1 must prove all DeepSeek chat/tool/thinking bodies route through canonical owner helper.',
    stage: 'P1',
  },
  {
    riskId: 'V4-R02',
    risk: 'Legacy ToolBus and canonical ToolCallResult can coexist as competing contracts.',
    riskClass: 'second-toolbus',
    currentOwner: 'Tool Envelope owner',
    activeSignals: ['src/dsxu/engine/tool-protocol.ts', 'src/dsxu/engine/tool-bus', 'src/services/tools/toolLifecycle.ts'],
    status: 'watch',
    requiredAction: 'P4 must keep legacy/provider/MCP shapes normalized at Tool Gate before ledger/recovery/TUI.',
    stage: 'P4',
  },
  {
    riskId: 'V4-R03',
    risk: 'Swarm/forked agent paths can become a second agent orchestrator.',
    riskClass: 'second-agent',
    currentOwner: 'Agent Evidence Handoff owner',
    activeSignals: ['src/tools/AgentTool', 'src/utils/swarm', 'src/utils/forkedAgent.ts'],
    status: 'contained',
    requiredAction: 'P6 must keep agent modes to serial worker or disjoint fanout evidence packets.',
    stage: 'P6',
  },
  {
    riskId: 'V4-R04',
    risk: 'TUI can render separate local state instead of consuming work-state/ledger evidence.',
    riskClass: 'second-tui',
    currentOwner: 'Trust UI owner',
    activeSignals: ['src/screens/REPL.tsx', 'src/components/PromptInput', 'src/components/messages', 'src/query.ts'],
    status: 'open',
    requiredAction: 'P7 must prove TUI/CLI/stream-json/final report consume the same compact projection.',
    stage: 'P7',
  },
  {
    riskId: 'V4-R05',
    risk: 'Multiple prompt stacks can inflate prompt and break DeepSeek prefix cache.',
    riskClass: 'prompt-stack',
    currentOwner: 'DeepSeek route/cost/cache owner',
    activeSignals: ['src/dsxu/engine/prompt-prefix-cache-builder.ts', 'src/dsxu/engine/prompt-processing-v1.ts', 'src/dsxu/engine/system-prompt-builder-v1.ts'],
    status: 'open',
    requiredAction: 'P2 must lock stable prefix, move volatile runtime facts to dynamic tail, and explain cache epoch changes.',
    stage: 'P2',
  },
  {
    riskId: 'V4-R06',
    risk: 'Package script surface is too large for public product claims.',
    riskClass: 'script-surface',
    currentOwner: 'Evidence / release claim binder owner',
    activeSignals: ['package.json', 'scripts/dsxu-command-catalog.ts'],
    status: 'contained',
    requiredAction: 'P0 command catalog classifies product-runtime, validation, release-only, owner-review, live-provider, historical evidence, and utilities.',
    stage: 'P0',
  },
  {
    riskId: 'V4-R07',
    risk: 'Mock/internal smoke can be promoted into a public 90/95 or formal benchmark claim.',
    riskClass: 'claim-inflation',
    currentOwner: 'Evidence / release claim binder owner',
    activeSignals: ['scripts/dsxu-evidence-dashboard.ts', 'docs/generated/DSXU_EVIDENCE_DASHBOARD_20260518.json', 'README.md'],
    status: 'open',
    requiredAction: 'P8 must require comparable raw transcript, tool trace, cost/cache, and failure-recovery evidence before public claim.',
    stage: 'P8',
  },
  {
    riskId: 'V4-R08',
    risk: 'Recovery variants can disagree on retry/replan/rollback/abort.',
    riskClass: 'second-runtime',
    currentOwner: 'Recovery Decision owner',
    activeSignals: ['src/dsxu/engine/gear-box.ts', 'src/dsxu/engine/recovery', 'src/query.ts'],
    status: 'open',
    requiredAction: 'P5 must expose one Recovery Decision Table and write decisions into ledger/TUI/final report.',
    stage: 'P5',
  },
  {
    riskId: 'V4-R09',
    risk: 'Verification can remain advisory while final answer says PASS.',
    riskClass: 'second-runtime',
    currentOwner: 'Verification Envelope owner',
    activeSignals: ['src/coordinator/tdd-gate/post-write-hook.ts', 'src/services/static-analysis/tool-gate.ts', 'src/dsxu/engine/post-mutation-verification-envelope.ts'],
    status: 'open',
    requiredAction: 'P3 must make mutation verification envelope visible and final claim gate reject unverified PASS.',
    stage: 'P3',
  },
];

export function classifyScript(name: string, command: string): Omit<CommandCatalogEntry, 'name' | 'command'> {
  if (name === 'dsxu' || name === 'dsxu-code' || name === 'start') {
    return {
      category: 'product-runtime',
      owner: 'CLI/TUI product runtime owner',
      publicClaimUse: 'allowed-with-evidence',
      reason: 'product launch surface; behavior must project through DSXU main query loop and work-state',
    };
  }

  if (MAINLINE_ALIASES.includes(name) || name === 'test:six-stage-final' || name === 'acceptance:senior-coding-window') {
    return {
      category: 'mainline-validation',
      owner: ownerForMainlineAlias(name),
      publicClaimUse: 'allowed-with-evidence',
      reason: 'mainline validation alias; claim text must cite generated evidence output',
    };
  }

  if (name.startsWith('release:') || name.startsWith('clean-export:') || name.startsWith('commercial-ip:')) {
    return {
      category: 'release-only',
      owner: 'Release / clean export / compliance owner',
      publicClaimUse: 'operator-only',
      reason: 'release gate command; not a product capability claim by itself',
    };
  }

  if (name.startsWith('owner-git:') || name.startsWith('acl:') || name.startsWith('p12:')) {
    return {
      category: 'owner-review',
      owner: 'Owner/Git review and external input owner',
      publicClaimUse: 'blocked-as-claim',
      reason: 'closure or external-input workflow; must not be promoted to a user-facing feature claim',
    };
  }

  if (name.startsWith('live:')) {
    return {
      category: 'live-provider',
      owner: 'DeepSeek provider live gate owner',
      publicClaimUse: 'allowed-with-evidence',
      reason: 'live provider proof; evidence must redact secrets and distinguish model lane/cost/cache',
    };
  }

  if (name.startsWith('benchmark:')) {
    return {
      category: 'internal-benchmark',
      owner: 'Evidence / benchmark owner',
      publicClaimUse: 'internal-only',
      reason: 'benchmark runner; public comparison claim requires real paired raw evidence and claim binder approval',
    };
  }

  if (
    name.startsWith('v20:') ||
    name.startsWith('v24:') ||
    name.startsWith('v26:') ||
    name.startsWith('capability:') ||
    name.startsWith('reference:') ||
    name.startsWith('evidence:')
  ) {
    return {
      category: 'historical-evidence',
      owner: 'Evidence / release claim binder owner',
      publicClaimUse: 'internal-only',
      reason: 'historical or generated evidence command; may feed dashboard but is not a separate product surface',
    };
  }

  if (name.startsWith('toolchain:') || name === 'prebuild' || name === 'lint-schema') {
    return {
      category: 'toolchain',
      owner: 'Toolchain / schema owner',
      publicClaimUse: 'operator-only',
      reason: 'developer maintenance command; keep outside product capability claims',
    };
  }

  if (name.startsWith('acceptance:') || name.startsWith('test:')) {
    return {
      category: 'mainline-validation',
      owner: 'Acceptance / verification owner',
      publicClaimUse: 'allowed-with-evidence',
      reason: 'validation command; output can support claims only when raw evidence is generated and current',
    };
  }

  return {
    category: command.includes('bun run scripts/')
      ? 'supporting-utility'
      : 'toolchain',
    owner: 'Supporting script owner',
    publicClaimUse: 'operator-only',
    reason: 'not part of the four mainline aliases; use only through owner-specific evidence',
  };
}

export function buildCommandCatalog(scripts: Record<string, string>, generatedAt = new Date().toISOString()): CommandCatalog {
  const entries = Object.entries(scripts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, command]) => ({
      name,
      command,
      ...classifyScript(name, command),
    }));

  return {
    schemaVersion: 'dsxu.command-catalog.v1',
    generatedAt,
    status: 'PASS_DSXU_COMMAND_CATALOG_READY',
    scriptCount: entries.length,
    categorySummary: summarizeCategories(entries),
    mainlineAliases: MAINLINE_ALIASES,
    ownerFocusedVerificationGroups: OWNER_FOCUSED_VERIFICATION_GROUPS,
    entries,
    rule:
      'Package scripts are cataloged by owner and claim boundary. Historical, owner-review, release-only, smoke, and live-provider commands must not be promoted into GitHub product claims without current source/test/live/raw/cost evidence.',
  };
}

export function buildV4FeatureOwnerMap(generatedAt = new Date().toISOString()): V4FeatureOwnerMap {
  return {
    schemaVersion: 'dsxu.v4.feature-owner-map.v1',
    generatedAt,
    status: 'PASS_DSXU_V4_FEATURE_OWNER_MAP_READY',
    productCores: V4_PRODUCT_CORES,
    summary: summarizeFeatureStates(V4_FEATURE_OWNER_ENTRIES),
    entries: V4_FEATURE_OWNER_ENTRIES,
    rule:
      'Every V4 capability must map to exactly one of the eight product cores. Experimental, release-only, and replace/delete candidates are not public product claims and must not become new mainline/runtime/provider/tool/agent/TUI surfaces.',
  };
}

export function buildV4FreezeRegister(generatedAt = new Date().toISOString()): V4FreezeRegister {
  return {
    schemaVersion: 'dsxu.v4.freeze-register.v1',
    generatedAt,
    status: 'PASS_DSXU_V4_FREEZE_REGISTER_READY',
    entries: V4_FREEZE_REGISTER_ENTRIES,
    rule:
      'Frozen capabilities may only appear through explicit owner review, compatibility evidence, or release-gated proof. They must not become default coding workflow, GitHub public claims, or hidden second runtimes.',
  };
}

export function buildV4ComplexityRiskRegister(generatedAt = new Date().toISOString()): V4ComplexityRiskRegister {
  return {
    schemaVersion: 'dsxu.v4.complexity-risk-register.v1',
    generatedAt,
    status: 'PASS_DSXU_V4_COMPLEXITY_RISK_REGISTER_READY',
    entries: V4_COMPLEXITY_RISK_ENTRIES,
    rule:
      'Complexity risks are controlled by folding work into the existing V4 product core owners. A risk marked contained still requires later-stage focused acceptance before release claims.',
  };
}

export function buildV4ScriptSurfaceMap(catalog: CommandCatalog, generatedAt = catalog.generatedAt): V4ScriptSurfaceMap {
  return {
    schemaVersion: 'dsxu.v4.script-surface-map.v1',
    generatedAt,
    status: 'PASS_DSXU_V4_SCRIPT_SURFACE_MAP_READY',
    commandCatalogRef: 'docs/generated/DSXU_COMMAND_CATALOG_20260518.json',
    categorySummary: catalog.categorySummary,
    mainlineAliases: catalog.mainlineAliases,
    publicClaimBlockedScripts: catalog.entries
      .filter(entry => entry.publicClaimUse === 'blocked-as-claim')
      .map(entry => entry.name),
    releaseOnlyScripts: catalog.entries
      .filter(entry => entry.category === 'release-only')
      .map(entry => entry.name),
    liveProviderScripts: catalog.entries
      .filter(entry => entry.category === 'live-provider')
      .map(entry => entry.name),
    ownerReviewScripts: catalog.entries
      .filter(entry => entry.category === 'owner-review')
      .map(entry => entry.name),
    rule:
      'The script surface map is a projection of the command catalog. It does not create package entrypoints; it prevents historical, owner-review, release-only, live-provider, and smoke scripts from being described as default product features.',
  };
}

function summarizeCategories(entries: CommandCatalogEntry[]): Record<CommandCatalogCategory, number> {
  const summary = Object.fromEntries(CATEGORY_ORDER.map(category => [category, 0])) as Record<CommandCatalogCategory, number>;
  for (const entry of entries) {
    summary[entry.category] += 1;
  }
  return summary;
}

function summarizeFeatureStates(entries: V4FeatureOwnerEntry[]): Record<V4CapabilityState, number> {
  const states: V4CapabilityState[] = [
    'default-mainline',
    'on-demand',
    'frozen-experimental',
    'replace-delete-candidate',
    'release-only',
  ];
  const summary = Object.fromEntries(states.map(state => [state, 0])) as Record<V4CapabilityState, number>;
  for (const entry of entries) {
    summary[entry.state] += 1;
  }
  return summary;
}

function ownerForMainlineAlias(name: string): string {
  if (name === 'evidence:dashboard') return 'Evidence / release claim binder owner';
  if (name === 'benchmark:swe-bench') return 'Evidence / internal SWE-bench owner';
  if (name === 'health:runtime') return 'Doctor / release preflight owner';
  if (name === 'cache:warm') return 'DeepSeek route/cost/cache owner';
  if (name === 'acceptance:senior-coding-window') return 'Senior coding live acceptance owner';
  return 'Acceptance / verification owner';
}

function renderMarkdown(catalog: CommandCatalog): string {
  const rows = catalog.entries.map(entry => [
    entry.name,
    entry.category,
    entry.owner,
    entry.publicClaimUse,
    entry.reason.replace(/\|/g, '/'),
  ]);
  return [
    '# DSXU Command Catalog - 2026-05-18',
    '',
    `Status: ${catalog.status}`,
    '',
    `Script count: ${catalog.scriptCount}`,
    '',
    '## Mainline Aliases',
    '',
    ...catalog.mainlineAliases.map(alias => `- ${alias}`),
    '',
    '## Owner-Focused Verification Groups',
    '',
    '| group | owner | testTier | timeoutBudgetMs | liveProvider | claimBoundary | purpose | commands |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...catalog.ownerFocusedVerificationGroups.map(group =>
      `| ${group.groupId} | ${group.owner} | ${group.testTier} | ${group.timeoutBudgetMs} | ${String(group.liveProvider)} | ${group.claimBoundary} | ${group.purpose.replace(/\|/g, '/')} | ${group.commands.map(command => `\`${command}\``).join('<br>')} |`,
    ),
    '',
    '## Category Summary',
    '',
    '| category | count |',
    '| --- | --- |',
    ...CATEGORY_ORDER.map(category => `| ${category} | ${catalog.categorySummary[category]} |`),
    '',
    '## Command Boundaries',
    '',
    '| script | category | owner | publicClaimUse | reason |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Rule',
    '',
    catalog.rule,
    '',
  ].join('\n');
}

function renderV4FeatureOwnerMapMarkdown(map: V4FeatureOwnerMap): string {
  return [
    '# DSXU V4 Feature Owner Map - 2026-05-18',
    '',
    `Status: ${map.status}`,
    '',
    '## Product Cores',
    '',
    ...map.productCores.map(core => `- ${core}`),
    '',
    '## Summary',
    '',
    '| state | count |',
    '| --- | --- |',
    ...Object.entries(map.summary).map(([state, count]) => `| ${state} | ${count} |`),
    '',
    '## Owner Map',
    '',
    '| id | capability | productCore | state | workflowEntry | claimBoundary | action | ownerFiles | evidence |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...map.entries.map(entry =>
      `| ${entry.id} | ${entry.capability} | ${entry.productCore} | ${entry.state} | ${entry.workflowEntry} | ${entry.claimBoundary} | ${entry.action.replace(/\|/g, '/')} | ${entry.ownerFiles.map(file => `\`${file}\``).join('<br>')} | ${entry.acceptanceEvidence.map(command => `\`${command}\``).join('<br>')} |`,
    ),
    '',
    '## Rule',
    '',
    map.rule,
    '',
  ].join('\n');
}

function renderV4FreezeRegisterMarkdown(register: V4FreezeRegister): string {
  return [
    '# DSXU V4 Freeze Register - 2026-05-18',
    '',
    `Status: ${register.status}`,
    '',
    '| id | capability | productCore | defaultStatus | allowedUse | blockedUse | action | ownerFiles |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...register.entries.map(entry =>
      `| ${entry.id} | ${entry.capability} | ${entry.productCore} | ${entry.defaultStatus} | ${entry.allowedUse.replace(/\|/g, '/')} | ${entry.blockedUse.replace(/\|/g, '/')} | ${entry.action.replace(/\|/g, '/')} | ${entry.ownerFiles.map(file => `\`${file}\``).join('<br>')} |`,
    ),
    '',
    '## Rule',
    '',
    register.rule,
    '',
  ].join('\n');
}

function renderV4ComplexityRiskRegisterMarkdown(register: V4ComplexityRiskRegister): string {
  return [
    '# DSXU V4 Complexity Risk Register - 2026-05-18',
    '',
    `Status: ${register.status}`,
    '',
    '| riskId | riskClass | status | stage | currentOwner | risk | requiredAction | activeSignals |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...register.entries.map(entry =>
      `| ${entry.riskId} | ${entry.riskClass} | ${entry.status} | ${entry.stage} | ${entry.currentOwner} | ${entry.risk.replace(/\|/g, '/')} | ${entry.requiredAction.replace(/\|/g, '/')} | ${entry.activeSignals.map(signal => `\`${signal}\``).join('<br>')} |`,
    ),
    '',
    '## Rule',
    '',
    register.rule,
    '',
  ].join('\n');
}

function renderV4ScriptSurfaceMapMarkdown(surfaceMap: V4ScriptSurfaceMap): string {
  return [
    '# DSXU V4 Script Surface Map - 2026-05-18',
    '',
    `Status: ${surfaceMap.status}`,
    '',
    `Command catalog: \`${surfaceMap.commandCatalogRef}\``,
    '',
    '## Category Summary',
    '',
    '| category | count |',
    '| --- | --- |',
    ...CATEGORY_ORDER.map(category => `| ${category} | ${surfaceMap.categorySummary[category]} |`),
    '',
    '## Mainline Aliases',
    '',
    ...surfaceMap.mainlineAliases.map(alias => `- ${alias}`),
    '',
    '## Public Claim Blocked Scripts',
    '',
    ...(surfaceMap.publicClaimBlockedScripts.length > 0
      ? surfaceMap.publicClaimBlockedScripts.map(script => `- ${script}`)
      : ['- none']),
    '',
    '## Release Only Scripts',
    '',
    ...(surfaceMap.releaseOnlyScripts.length > 0
      ? surfaceMap.releaseOnlyScripts.map(script => `- ${script}`)
      : ['- none']),
    '',
    '## Live Provider Scripts',
    '',
    ...(surfaceMap.liveProviderScripts.length > 0
      ? surfaceMap.liveProviderScripts.map(script => `- ${script}`)
      : ['- none']),
    '',
    '## Owner Review Scripts',
    '',
    ...(surfaceMap.ownerReviewScripts.length > 0
      ? surfaceMap.ownerReviewScripts.map(script => `- ${script}`)
      : ['- none']),
    '',
    '## Rule',
    '',
    surfaceMap.rule,
    '',
  ].join('\n');
}

async function main(): Promise<void> {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { scripts?: Record<string, string> };
  const catalog = buildCommandCatalog(packageJson.scripts ?? {});
  const featureOwnerMap = buildV4FeatureOwnerMap(catalog.generatedAt);
  const freezeRegister = buildV4FreezeRegister(catalog.generatedAt);
  const complexityRiskRegister = buildV4ComplexityRiskRegister(catalog.generatedAt);
  const scriptSurfaceMap = buildV4ScriptSurfaceMap(catalog);
  const outJson = join('docs', 'generated', 'DSXU_COMMAND_CATALOG_20260518.json');
  const outMd = join('docs', 'DSXU_COMMAND_CATALOG_20260518.md');
  const outFeatureJson = join('docs', 'generated', 'DSXU_V4_FEATURE_OWNER_MAP_20260518.json');
  const outFeatureMd = join('docs', 'DSXU_V4_FEATURE_OWNER_MAP_20260518.md');
  const outFreezeJson = join('docs', 'generated', 'DSXU_V4_FREEZE_REGISTER_20260518.json');
  const outFreezeMd = join('docs', 'DSXU_V4_FREEZE_REGISTER_20260518.md');
  const outRiskJson = join('docs', 'generated', 'DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.json');
  const outRiskMd = join('docs', 'DSXU_V4_COMPLEXITY_RISK_REGISTER_20260518.md');
  const outSurfaceJson = join('docs', 'generated', 'DSXU_V4_SCRIPT_SURFACE_MAP_20260518.json');
  const outSurfaceMd = join('docs', 'DSXU_V4_SCRIPT_SURFACE_MAP_20260518.md');
  await mkdir(dirname(outJson), { recursive: true });
  await writeFile(outJson, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  await writeFile(outMd, renderMarkdown(catalog), 'utf8');
  await writeFile(outFeatureJson, JSON.stringify(featureOwnerMap, null, 2) + '\n', 'utf8');
  await writeFile(outFeatureMd, renderV4FeatureOwnerMapMarkdown(featureOwnerMap), 'utf8');
  await writeFile(outFreezeJson, JSON.stringify(freezeRegister, null, 2) + '\n', 'utf8');
  await writeFile(outFreezeMd, renderV4FreezeRegisterMarkdown(freezeRegister), 'utf8');
  await writeFile(outRiskJson, JSON.stringify(complexityRiskRegister, null, 2) + '\n', 'utf8');
  await writeFile(outRiskMd, renderV4ComplexityRiskRegisterMarkdown(complexityRiskRegister), 'utf8');
  await writeFile(outSurfaceJson, JSON.stringify(scriptSurfaceMap, null, 2) + '\n', 'utf8');
  await writeFile(outSurfaceMd, renderV4ScriptSurfaceMapMarkdown(scriptSurfaceMap), 'utf8');
  console.log(JSON.stringify({
    status: catalog.status,
    scriptCount: catalog.scriptCount,
    categorySummary: catalog.categorySummary,
    outputJson: outJson,
    outputMd: outMd,
    v4: {
      featureOwnerMap: {
        status: featureOwnerMap.status,
        entries: featureOwnerMap.entries.length,
        outputJson: outFeatureJson,
        outputMd: outFeatureMd,
      },
      freezeRegister: {
        status: freezeRegister.status,
        entries: freezeRegister.entries.length,
        outputJson: outFreezeJson,
        outputMd: outFreezeMd,
      },
      complexityRiskRegister: {
        status: complexityRiskRegister.status,
        entries: complexityRiskRegister.entries.length,
        outputJson: outRiskJson,
        outputMd: outRiskMd,
      },
      scriptSurfaceMap: {
        status: scriptSurfaceMap.status,
        outputJson: outSurfaceJson,
        outputMd: outSurfaceMd,
      },
    },
  }, null, 2));
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
