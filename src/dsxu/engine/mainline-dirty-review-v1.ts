import type {
  V18DirtyLedgerEntry,
  V18DirtyQuarantineLedger,
} from './v18-dirty-quarantine-ledger'
import { DSXU_RELEASE_GATE_TESTS } from './release-test-gate'

const LEGACY_PRODUCT = ['cl', 'aude'].join('')
const LEGACY_PRODUCT_PATTERN = new RegExp(LEGACY_PRODUCT, 'gi')
const LEGACY_PRODUCT_TOOLS_BRIDGE = `${LEGACY_PRODUCT}-tools-bridge`

export type MainlineDirtyReviewStatus = 'PASS' | 'PARTIAL' | 'BLOCKED'
export type MainlineDirtyReviewBatchId =
  | 'MDR-01'
  | 'MDR-02'
  | 'MDR-03'
  | 'MDR-04'
  | 'MDR-05'
  | 'MDR-06'
  | 'MDR-07'
  | 'MDR-08'
  | 'MDR-99'

type ReplacementEvidenceStatus = 'VERIFIED_FOR_REVIEW' | 'MISSING'
type OwnerEvidenceStatus = 'VERIFIED_FOR_REVIEW' | 'MISSING' | 'NOT_REQUIRED'

type ReplacementEvidenceCheck = {
  name: string
  status: 'FOUND' | 'MISSING'
  matchedEvidence: string | null
}

export type MainlineDirtyOwnerSlice = {
  id: string
  parentId: MainlineDirtyReviewBatchId
  group: string
  count: number
  owner: string
  targetOwner: string
  semanticDecision: 'map-to-mainline-owner' | 'review-before-keep' | 'replace-delete-candidate'
  requiredAction: string
  focusedVerification: readonly string[]
  ownerEvidence: readonly string[]
  ownerEvidenceStatus: OwnerEvidenceStatus
  ownerEvidenceChecks: readonly ReplacementEvidenceCheck[]
  missingOwnerEvidence: readonly string[]
  replacementEvidence: readonly string[]
  replacementEvidenceStatus: ReplacementEvidenceStatus
  replacementEvidenceChecks: readonly ReplacementEvidenceCheck[]
  missingReplacementEvidence: readonly string[]
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type MainlineDirtyReviewBatch = {
  id: MainlineDirtyReviewBatchId
  group: string
  count: number
  modifiedCount: number
  deletedCount: number
  untrackedCount: number
  owner: string
  status: MainlineDirtyReviewStatus
  risk: 'high' | 'medium' | 'low'
  requiredAction: string
  focusedVerification: readonly string[]
  ownerSlices: readonly MainlineDirtyOwnerSlice[]
  canAutoClose: boolean
  samplePaths: readonly string[]
  redlines: readonly string[]
}

export type MainlineDirtyReview = {
  schemaVersion: 'dsxu.mainline-dirty-review.v1'
  status: MainlineDirtyReviewStatus
  total: number
  batchCount: number
  ownerSliceCount: number
  reviewBeforeKeepCount: number
  replaceDeleteCandidateCount: number
  engineTestOwnerSliceCount: number
  engineTestOwnerEvidenceVerifiedCount: number
  engineTestOwnerMissingEvidenceCount: number
  toolsConfigOwnerSliceCount: number
  toolsConfigOwnerEvidenceVerifiedCount: number
  toolsConfigOwnerMissingEvidenceCount: number
  replaceDeleteEvidenceVerifiedCount: number
  replaceDeleteMissingEvidenceCount: number
  pass: number
  partial: number
  blocked: number
  highRiskBatchCount: number
  legacyMainlineReviewStatus: 'PASS' | 'PARTIAL' | 'BLOCKED' | 'NOT_RUN'
  legacyMainlineReviewBatchCount: number
  canCloseMainlineDirtyGate: boolean
  mustNotStageOrRestore: boolean
  batches: readonly MainlineDirtyReviewBatch[]
  redlines: readonly string[]
  safeguards: readonly string[]
  nextAction:
    | 'split-legacy-mainline'
    | 'review-engine-and-tests'
    | 'review-tools-and-config'
    | 'review-owner-git-closure'
    | 'mainline-gate-closed'
}

const groupOrder = [
  'legacy-mainline',
  'dsxu-engine',
  'dsxu-engine-tests',
  'tools',
  'root-config',
  'dsxu-product-surface',
  'test-fixtures',
  'dsxu-other',
  'other-mainline',
] as const

type MainlineDirtyGroup = typeof groupOrder[number]

const ownerSliceOrder: Record<string, number> = {
  'legacy-bridge-command-surface': 5,
  'legacy-command-registry-owner': 6,
  'engine-analyzers': 10,
  'engine-support-contracts': 20,
  'phase12-eval-engine': 30,
  'release-hygiene-engine': 40,
  'runtime-contract-engine': 50,
  'deleted-legacy-bridge-runtime': 60,
  'deleted-opportunity-cli': 70,
  'deleted-opportunity-data-sources': 80,
  'deleted-opportunity-discovery': 90,
  'deleted-full-absorb-planner': 100,
  'deleted-memory-chain-runtime': 110,
  'deleted-sidecar-experiment-runtime': 120,
  'compat-wrapper-runtime-shim': 130,
  'open-source-core-runtime-shim': 140,
  'provider-backend-adapter-boundary': 150,
  'permission-tool-gate-owner': 160,
  'model-router-cost-api-owner': 170,
  'agent-context-tests': 200,
  'deleted-backup-test-candidate': 210,
  'engine-unit-tests': 220,
  'phase12-eval-tests': 230,
  'release-hygiene-tests': 240,
  'runtime-contract-tests': 250,
  'deleted-proxy-integration-tests': 260,
  'deleted-tool-result-normalization-test': 270,
  'minimal-recovery-test-shims': 280,
  'example-lifecycle-test-shim': 290,
  'full-absorb-test-shim': 300,
  'legacy-wave-test-shims': 310,
  'legacy-recovery-test-shims': 320,
  'legacy-coordinator-test-shims': 330,
  'kairos-session-subcontract-shims': 340,
}

function sortOwnerSliceGroups(left: string, right: string): number {
  return (ownerSliceOrder[left] ?? 1000) - (ownerSliceOrder[right] ?? 1000) || left.localeCompare(right)
}

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^"|"$/g, '')
}

function groupForPath(path: string): MainlineDirtyGroup {
  const normalized = normalizedPath(path)
  if (/^src\/dsxu\/engine\/__tests__\//.test(normalized)) return 'dsxu-engine-tests'
  if (/^src\/dsxu\/engine\//.test(normalized)) return 'dsxu-engine'
  if (/^(src\/dsxu\/tools|src\/tools)\//.test(normalized)) return 'tools'
  if (/^src\/dsxu\/(control-plane|integration\/harness|cost|memory|context|skills|runtime|agent|agents)\//.test(normalized)) return 'dsxu-product-surface'
  if (/^src\/dsxu\//.test(normalized)) return 'dsxu-other'
  if (/^src\//.test(normalized)) return 'legacy-mainline'
  if (/^(package(-lock)?\.json|bun\.lock|bunfig\.toml|tsconfig\.json|preload\.ts|README\.md|\.env\.example|\.gitignore)$/.test(normalized)) return 'root-config'
  if (/^(test|fixtures)\//.test(normalized)) return 'test-fixtures'
  return 'other-mainline'
}

function idForGroup(group: MainlineDirtyGroup): MainlineDirtyReviewBatchId {
  if (group === 'legacy-mainline') return 'MDR-01'
  if (group === 'dsxu-engine') return 'MDR-02'
  if (group === 'dsxu-engine-tests') return 'MDR-03'
  if (group === 'tools') return 'MDR-04'
  if (group === 'root-config') return 'MDR-05'
  if (group === 'dsxu-product-surface') return 'MDR-06'
  if (group === 'test-fixtures') return 'MDR-07'
  if (group === 'dsxu-other') return 'MDR-08'
  return 'MDR-99'
}

function ownerForGroup(group: MainlineDirtyGroup): string {
  if (group === 'legacy-mainline') return 'Legacy Mainline Migration'
  if (group === 'dsxu-engine') return 'DSXU Engine'
  if (group === 'dsxu-engine-tests') return 'DSXU Verification'
  if (group === 'tools') return 'Tool Mainline'
  if (group === 'root-config') return 'Workspace Tooling'
  if (group === 'dsxu-product-surface') return 'Product Surface'
  if (group === 'test-fixtures') return 'Test Fixtures'
  if (group === 'dsxu-other') return 'DSXU Mainline'
  return 'Manual Mainline Review'
}

function riskForGroup(group: MainlineDirtyGroup): MainlineDirtyReviewBatch['risk'] {
  if (group === 'legacy-mainline' || group === 'dsxu-engine' || group === 'tools') return 'high'
  if (group === 'dsxu-engine-tests' || group === 'root-config' || group === 'dsxu-product-surface') return 'medium'
  return 'low'
}

function requiredActionForGroup(group: MainlineDirtyGroup): string {
  if (group === 'legacy-mainline') return 'split legacy mainline migration into owner-reviewed slices before any stage'
  if (group === 'dsxu-engine') return 'review engine contract changes with focused unit evidence'
  if (group === 'dsxu-engine-tests') return 'keep tests paired with their engine or release gate owner'
  if (group === 'tools') return 'verify tool lifecycle, permission, and evidence behavior before close'
  if (group === 'root-config') return 'review package, runtime, and startup config as one release-impact group'
  if (group === 'dsxu-product-surface') return 'review product-surface changes against query-loop, permission, and evidence contracts'
  if (group === 'test-fixtures') return 'confirm fixtures match current test contracts'
  if (group === 'dsxu-other') return 'assign DSXU owner and focused verification before close'
  return 'classify mainline owner before release claims'
}

function focusedVerificationForGroup(group: MainlineDirtyGroup): readonly string[] {
  if (group === 'legacy-mainline') return ['manual-owner-review', 'release-surface-policy-check']
  if (group === 'dsxu-engine') return ['bun test src/dsxu/engine/__tests__/<owner>.test.ts']
  if (group === 'dsxu-engine-tests') return ['bun test affected engine test files']
  if (group === 'tools') return ['bun test src/dsxu/engine/__tests__/tool-lifecycle-contract-v1.test.ts']
  if (group === 'root-config') return ['bun install --dry-run policy review', 'bun test src/dsxu/engine/__tests__/toolchain-selfcheck-v1.test.ts']
  if (group === 'dsxu-product-surface') return ['bun test product-surface focused owner tests']
  if (group === 'test-fixtures') return ['bun test fixture owner tests']
  if (group === 'dsxu-other') return ['bun test focused owner tests']
  return ['manual classification required']
}

function sanitizePath(path: string): string {
  return path.replace(LEGACY_PRODUCT_PATTERN, 'legacy-product')
}

function evidenceName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path
}

function defaultAvailableReplacementEvidence(): readonly string[] {
  return [
    ...DSXU_RELEASE_GATE_TESTS.map(entry => evidenceName(entry.path)),
    'task-analyzer.test.ts',
    'quality-gate-mainline-v1.test.ts',
    'api-service.test.ts',
    'deepseek-v4-control-v1.test.ts',
    'phase12-raw-comparison-v1.test.ts',
    'phase12-experience-oracle-v1.test.ts',
    'reference-experience-quality-contract-v1.test.ts',
    'clean-export-readiness-v1.test.ts',
    'release-closure-board-v1.test.ts',
    'v18-release-provenance-gate-v1.test.ts',
    'tool-runtime-dirty-review-v1.test.ts',
    'tool-runtime-duplication-decision-v1.test.ts',
    'control-plane-v1.test.ts',
    'provider-contract-v1.test.ts',
    'remote-lifecycle-v1.test.ts',
    'permissions.test.ts',
    'network-facade-v1.test.ts',
    'agent-runtime-mainline-v1.test.ts',
    'agent-parent-final-gate-replay-v1.test.ts',
    'local-agent-background-lifecycle-v1.test.ts',
    'file-edit-adapter-atomic-v1.test.ts',
    'edit-convergence-gate-v1.test.ts',
    'c05-tool-compat-absorption-clean.test.ts',
    'mainline-tool-adapter-v1.test.ts',
    'bash-adapter-safety-v1.test.ts',
    'powershell-parser-lifecycle-v1.test.ts',
    'task-runtime-mainline-v1-clean.test.ts',
    'task-lifecycle-v1-clean.test.ts',
    'task-notification-processing-v1.test.ts',
    'tool-lifecycle-contract-v1.test.ts',
    'tool-mainline-v1-clean.test.ts',
    'tool-batch-gate-classification-v1.test.ts',
    'tool-evidence-pack-contract-v1.test.ts',
    'query-loop-visible-copy-v1.test.ts',
    'visible-ui-copy-pack-v1.test.ts',
    'v18-open-source-package-gate-v1.test.ts',
    'release-test-gate-v1.test.ts',
    'release-surface-v1.test.ts',
    'wsl-workspace-health-v1.test.ts',
    'v19-cost-cache-live-task-evidence-v1.test.ts',
    'phase12-live-cost-matrix-v1.test.ts',
    'real-task-replay-suite-v1.test.ts',
    'owner-git-closure-board-v1.test.ts',
    'deferred-product-absorption-register-v1.test.ts',
    'proxy-budget-guard.test.ts',
    'recovery-runtime-v3.test.ts',
    'recovery-query-loop-v3.test.ts',
    'recovery-mainline-v3.test.ts',
    'lifecycle-protocol-manager.test.ts',
    'memory-session-integration.test.ts',
    'model-config.test.ts',
    'source-encoding-boundary-v1.test.ts',
    'coordinator-mainline-v4-strong.test.ts',
    'coordinator-state-model-v4-alignment.test.ts',
    'coordinator-lifecycle-v5-clean.test.ts',
    'coordinator-visible-copy-v1.test.ts',
    'kairos-session-mainline-v1.test.ts',
    'compact-resume-replay-v1.test.ts',
    'hitl.test.ts',
    'integration.test.ts',
    'harness-integration.test.ts',
    'tdd-verify-tdd.test.ts',
    'apiMicrocompact.test.ts',
    'allowed-tools-permission-floor-v1.test.ts',
    'mainline-dirty-review-v1.test.ts',
    'evo-engine.test.ts',
    'engine.test.ts',
    'context-owner-rule-contract-v1.test.ts',
    'session-memory-mainline-v1.test.ts',
  ]
}

function buildReplacementEvidenceChecks(
  replacementEvidence: readonly string[],
  availableEvidence: ReadonlySet<string>,
): readonly ReplacementEvidenceCheck[] {
  const availableEvidenceByName = new Map([...availableEvidence].map(item => [evidenceName(item), item]))
  return replacementEvidence.map(item => {
    const matchedEvidence = availableEvidence.has(item)
      ? item
      : availableEvidenceByName.get(evidenceName(item)) ?? null
    return {
      name: item,
      status: matchedEvidence ? 'FOUND' as const : 'MISSING' as const,
      matchedEvidence,
    }
  })
}

function ownerSliceGroupForPath(batchGroup: MainlineDirtyGroup, path: string): string {
  const normalized = normalizedPath(path)
  const basename = normalized.split('/').at(-1) ?? normalized
  if (batchGroup === 'legacy-mainline') {
    if (/^src\/commands\/bridge(?:\/|$)/.test(normalized) || /^src\/commands\/bridge-kick\.ts$/.test(normalized)) return 'legacy-bridge-command-surface'
    if (/^src\/commands\.ts$/.test(normalized)) return 'legacy-command-registry-owner'
    return 'legacy-mainline'
  }
  if (batchGroup === 'dsxu-engine') {
    if (/^src\/dsxu\/engine\/analyzers\//.test(normalized)) return 'engine-analyzers'
    if (new RegExp(`^src\\/dsxu\\/engine\\/(${LEGACY_PRODUCT_TOOLS_BRIDGE}|legacy-full-bridge|query-engine-extensions)\\.ts$`).test(normalized)) return 'deleted-legacy-bridge-runtime'
    if (/^src\/dsxu\/engine\/(cli-integration|coding-cli)\.ts$/.test(normalized)) return 'deleted-opportunity-cli'
    if (/^src\/dsxu\/engine\/data-sources\//.test(normalized)) return 'deleted-opportunity-data-sources'
    if (/^src\/dsxu\/engine\/(opportunity-discovery|task-runner)\.ts$/.test(normalized) || /^src\/dsxu\/engine\/reporters\//.test(normalized)) return 'deleted-opportunity-discovery'
    if (/^src\/dsxu\/engine\/full-absorb(-executor)?\.ts$/.test(normalized)) return 'deleted-full-absorb-planner'
    if (/^src\/dsxu\/engine\/memory-chain(-types)?\.ts$/.test(normalized)) return 'deleted-memory-chain-runtime'
    if (/^src\/dsxu\/engine\/(parallel-speculation|voice-extension)\.ts$/.test(normalized)) return 'deleted-sidecar-experiment-runtime'
    if (/^src\/dsxu\/engine\/dsxu-mainline-compat-wrappers\.ts$/.test(normalized)) return 'compat-wrapper-runtime-shim'
    if (/^src\/dsxu\/engine\/open-source-core\.ts$/.test(normalized)) return 'open-source-core-runtime-shim'
    if (/^src\/dsxu\/engine\/provider-backend(?:\/|$)/.test(normalized)) return 'provider-backend-adapter-boundary'
    if (/^src\/dsxu\/engine\/permissions\.ts$/.test(normalized)) return 'permission-tool-gate-owner'
    if (/^src\/dsxu\/engine\/api-service\.ts$/.test(normalized)) return 'model-router-cost-api-owner'
    if (/(release|clean-export|dirty|closure|provenance|package|gate|ledger)/i.test(basename)) return 'release-hygiene-engine'
    if (/(phase12|oracle|experience|reference|replay|quality|eval)/i.test(basename)) return 'phase12-eval-engine'
    if (/(tool|permission|runtime|agent|context|memory|cost|mcp|skill|model|query|control|network)/i.test(basename)) return 'runtime-contract-engine'
    return 'engine-support-contracts'
  }
  if (batchGroup === 'dsxu-engine-tests') {
    if (/\.(backup|bak)$/i.test(normalized)) return 'deleted-backup-test-candidate'
    if (/^src\/dsxu\/engine\/__tests__\/(kill-switch-integration|proxy-integration)\.test\.ts$/.test(normalized)) return 'deleted-proxy-integration-tests'
    if (/^src\/dsxu\/engine\/__tests__\/tool-result-normalization\.test\.ts$/.test(normalized)) return 'deleted-tool-result-normalization-test'
    if (/^src\/dsxu\/engine\/__tests__\/recovery-.*-minimal\.test\.ts$/.test(normalized)) return 'minimal-recovery-test-shims'
    if (/^src\/dsxu\/engine\/__tests__\/lifecycle-integration\.example\.ts$/.test(normalized)) return 'example-lifecycle-test-shim'
    if (/^src\/dsxu\/engine\/__tests__\/full-absorb\.test\.ts$/.test(normalized)) return 'full-absorb-test-shim'
    if (/^src\/dsxu\/engine\/__tests__\/wave\d+(?:-[^.]+)?\.test\.ts$/.test(normalized)) return 'legacy-wave-test-shims'
    if (/^src\/dsxu\/engine\/__tests__\/recovery-(decision|integration|planner)\.test\.ts$/.test(normalized)) return 'legacy-recovery-test-shims'
    if (/^src\/dsxu\/engine\/__tests__\/coordinator-(lifecycle-v1|mainline-v3-clean|mode-and-bridge-v1-clean|role-routing(?:-parity)?-v1|state-model-v[12](?:-clean)?)\.test\.ts$/.test(normalized)) return 'legacy-coordinator-test-shims'
    if (/^src\/dsxu\/engine\/__tests__\/(A-2A-kairos-integration-harness|kairos-resume-hint-v1|kairos-session-snapshot-v1)\.test\.ts$/.test(normalized)) return 'kairos-session-subcontract-shims'
    if (/(release|clean-export|dirty|closure|provenance|package|gate|ledger)/i.test(basename)) return 'release-hygiene-tests'
    if (/(tool|permission|runtime|agenttool|mcp|skill|model|query|control|network)/i.test(basename)) return 'runtime-contract-tests'
    if (/(phase12|oracle|experience|reference|replay|quality|live|raw|eval)/i.test(basename)) return 'phase12-eval-tests'
    if (/(agent|context|memory|compact|coordinator)/i.test(basename)) return 'agent-context-tests'
    return 'engine-unit-tests'
  }
  if (batchGroup === 'tools') {
    if (/AgentTool/i.test(normalized)) return 'agent-tool-owner'
    if (/(Bash|PowerShell|Shell|Execution)/i.test(normalized)) return 'shell-adapter-owner'
    if (/(Notebook|File|Edit|Write|Read)/i.test(normalized)) return 'file-edit-tool-owner'
    if (/(Todo|Task)/i.test(normalized)) return 'task-tool-owner'
    if (/(UI|Display|Render)/i.test(normalized)) return 'tool-visible-projection'
    return 'tool-lifecycle-owner'
  }
  if (batchGroup === 'root-config') {
    if (/^(package(-lock)?\.json|bun\.lock|bunfig\.toml)$/.test(normalized)) return 'package-runtime-config'
    if (/^(README\.md|\.env\.example|\.gitignore)$/.test(normalized)) return 'release-root-policy'
    return 'startup-compile-config'
  }
  if (batchGroup === 'dsxu-product-surface') {
    if (/^src\/dsxu\/cost\//.test(normalized)) return 'cost-evidence-surface'
    if (/^src\/dsxu\/control-plane\//.test(normalized)) return 'control-plane-product-surface'
    if (/^src\/dsxu\/integration\/harness\//.test(normalized)) return 'evidence-harness-surface'
    return 'product-surface-owner'
  }
  if (batchGroup === 'test-fixtures') {
    if (/^fixtures\//.test(normalized)) return 'fixture-data-contracts'
    return 'root-test-harness'
  }
  if (batchGroup === 'dsxu-other') {
    if (/^src\/dsxu\/hitl\//.test(normalized)) return 'hitl-control-surface'
    if (/^src\/dsxu\/integration\//.test(normalized)) return 'integration-entrypoint'
    if (/^src\/dsxu\/msa\//.test(normalized)) return 'msa-experiment-review'
    return 'dsxu-other-owner'
  }
  return batchGroup
}

function ownerForOwnerSlice(group: string): string {
  if (group === 'legacy-bridge-command-surface') return 'Bridge Command Replacement Owner'
  if (group === 'legacy-command-registry-owner') return 'Command Registry Owner'
  if (group === 'engine-analyzers') return 'Engine Analysis Owner'
  if (group === 'deleted-legacy-bridge-runtime') return 'Control Plane / Tool Runtime Replacement Owner'
  if (group === 'deleted-opportunity-cli') return 'Entrypoint / Automation Replacement Owner'
  if (group === 'deleted-opportunity-data-sources') return 'External Integration Replacement Owner'
  if (group === 'deleted-opportunity-discovery') return 'Task Runtime Replacement Owner'
  if (group === 'deleted-full-absorb-planner') return 'Absorption Planning Replacement Owner'
  if (group === 'deleted-memory-chain-runtime') return 'Context / Memory Runtime Replacement Owner'
  if (group === 'deleted-sidecar-experiment-runtime') return 'Sidecar Experiment Replacement Owner'
  if (group === 'compat-wrapper-runtime-shim') return 'Compatibility Runtime Replacement Owner'
  if (group === 'open-source-core-runtime-shim') return 'Task Runtime Replacement Owner'
  if (group === 'provider-backend-adapter-boundary') return 'Provider Adapter Boundary Owner'
  if (group === 'permission-tool-gate-owner') return 'Permission / Tool Gate Owner'
  if (group === 'model-router-cost-api-owner') return 'Model Router / Cost API Owner'
  if (group === 'deleted-proxy-integration-tests') return 'Proxy / Network Verification Replacement Owner'
  if (group === 'deleted-tool-result-normalization-test') return 'Tool Result Evidence Replacement Owner'
  if (group === 'minimal-recovery-test-shims') return 'Recovery Verification Replacement Owner'
  if (group === 'example-lifecycle-test-shim') return 'Tool Lifecycle Verification Replacement Owner'
  if (group === 'full-absorb-test-shim') return 'Absorption Planning Verification Replacement Owner'
  if (group === 'legacy-wave-test-shims') return 'Legacy Wave Verification Replacement Owner'
  if (group === 'legacy-recovery-test-shims') return 'Recovery Verification Replacement Owner'
  if (group === 'legacy-coordinator-test-shims') return 'Coordinator Verification Replacement Owner'
  if (group === 'kairos-session-subcontract-shims') return 'Session / Resume Verification Replacement Owner'
  if (group === 'release-hygiene-engine') return 'Release Hygiene Owner'
  if (group === 'phase12-eval-engine') return 'Phase 12 / Eval Owner'
  if (group === 'runtime-contract-engine') return 'Runtime Contract Owner'
  if (group === 'engine-support-contracts') return 'Engine Support Owner'
  if (group === 'deleted-backup-test-candidate') return 'Verification Cleanup Owner'
  if (group === 'release-hygiene-tests') return 'Release Verification Owner'
  if (group === 'runtime-contract-tests') return 'Runtime Verification Owner'
  if (group === 'phase12-eval-tests') return 'Phase 12 Verification Owner'
  if (group === 'agent-context-tests') return 'Agent / Context Verification Owner'
  if (group === 'engine-unit-tests') return 'Engine Unit Verification Owner'
  if (group === 'agent-tool-owner') return 'Agent Tool Owner'
  if (group === 'shell-adapter-owner') return 'Bash / PowerShell Adapter Owner'
  if (group === 'file-edit-tool-owner') return 'File Edit Tool Owner'
  if (group === 'task-tool-owner') return 'Task Tool Owner'
  if (group === 'tool-visible-projection') return 'Tool Visible-State Owner'
  if (group === 'tool-lifecycle-owner') return 'Tool Lifecycle Owner'
  if (group === 'package-runtime-config') return 'Package Runtime Owner'
  if (group === 'release-root-policy') return 'Release Surface Owner'
  if (group === 'startup-compile-config') return 'Startup / Compile Owner'
  if (group === 'cost-evidence-surface') return 'Cost Evidence Owner'
  if (group === 'control-plane-product-surface') return 'Control Plane Owner'
  if (group === 'evidence-harness-surface') return 'Evidence Harness Owner'
  if (group === 'fixture-data-contracts') return 'Fixture Contract Owner'
  if (group === 'root-test-harness') return 'Root Test Harness Owner'
  if (group === 'hitl-control-surface') return 'HITL Control Owner'
  if (group === 'integration-entrypoint') return 'Integration Entrypoint Owner'
  if (group === 'msa-experiment-review') return 'MSA Experiment Owner'
  return 'Mainline Owner Review'
}

function targetOwnerForOwnerSlice(group: string): string {
  if (group === 'legacy-bridge-command-surface') return 'DSXU provider contract alias block, visible projection, and tool runtime dirty review'
  if (group === 'legacy-command-registry-owner') return 'single command registry, provider alias block projection, and ToolBus command surface'
  if (group === 'deleted-backup-test-candidate') return 'current focused verification files only'
  if (group === 'engine-analyzers') return 'current task analyzer and quality gate mainline'
  if (group === 'deleted-legacy-bridge-runtime') return 'single Tool Gate, control-plane, and tool lifecycle runtime'
  if (group === 'deleted-opportunity-cli') return 'current Start-DSXU-Code launcher and automation/task lifecycle'
  if (group === 'deleted-opportunity-data-sources') return 'external integration adapter boundary and P12/raw evidence mainline'
  if (group === 'deleted-opportunity-discovery') return 'current task runtime and evidence/report pipeline'
  if (group === 'deleted-full-absorb-planner') return 'owner Git closure board and deferred product absorption mainline'
  if (group === 'deleted-memory-chain-runtime') return 'single context/session memory owner'
  if (group === 'deleted-sidecar-experiment-runtime') return 'agent/query-loop sidecar governance owner'
  if (group === 'compat-wrapper-runtime-shim') return 'tool mainline adapter, provider contract, and command owner entrypoints'
  if (group === 'open-source-core-runtime-shim') return 'current task runtime, task lifecycle, and release package gate mainline'
  if (group === 'provider-backend-adapter-boundary') return 'provider contract, control-plane, and remote lifecycle adapter boundary'
  if (group === 'permission-tool-gate-owner') return 'single Tool Gate, Bash/PowerShell adapters, and control-plane permission bridge'
  if (group === 'model-router-cost-api-owner') return 'DeepSeek V4 model router, API fallback boundary, and cost evidence owner'
  if (group === 'deleted-proxy-integration-tests') return 'proxy budget guard, network facade, and direct-connect verification mainline'
  if (group === 'deleted-tool-result-normalization-test') return 'direct-connect tool-result mapping and evidence-pack mainline'
  if (group === 'minimal-recovery-test-shims') return 'full recovery runtime, query-loop, and scenario verification mainline'
  if (group === 'example-lifecycle-test-shim') return 'tool lifecycle protocol manager and lifecycle contract mainline'
  if (group === 'full-absorb-test-shim') return 'owner Git closure board and deferred product absorption verification mainline'
  if (group === 'legacy-wave-test-shims') return 'current focused cost/cache, session/memory, config, doctor, and formatter verification mainline'
  if (group === 'legacy-recovery-test-shims') return 'full recovery runtime, query-loop, and scenario verification mainline'
  if (group === 'legacy-coordinator-test-shims') return 'coordinator v4/v5 mainline, state alignment, lifecycle, and visible-copy verification'
  if (group === 'kairos-session-subcontract-shims') return 'Kairos session mainline, compact/resume replay, and session memory verification'
  if (group === 'engine-support-contracts') return 'engine support contracts and core service owner'
  if (group === 'agent-context-tests') return 'agent, context, compact/resume, and session memory verification mainline'
  if (group === 'engine-unit-tests') return 'engine API, service, formatter, and core unit verification mainline'
  if (group === 'msa-experiment-review') return 'deleted MSA experiment source; current DSXU memory/context owners are the replacement path'
  if (group.includes('release')) return 'release closure, clean export, and provenance mainline'
  if (group.includes('phase12') || group.includes('eval')) return 'Phase 12 raw/replay/eval evidence mainline'
  if (group.includes('runtime') || group.includes('tool') || group.includes('adapter')) return 'single runtime/tool lifecycle mainline'
  if (group.includes('control-plane')) return 'single DSXU control-plane owner'
  if (group.includes('cost')) return 'model router and cost evidence owner'
  if (group.includes('fixture')) return 'current test fixture contract'
  return 'named DSXU mainline owner'
}

function allEntriesDeleted(entries: readonly V18DirtyLedgerEntry[]): boolean {
  return entries.length > 0 && entries.every(entry => entry.status.includes('D'))
}

function semanticDecisionForOwnerSlice(
  group: string,
  entries: readonly V18DirtyLedgerEntry[],
): MainlineDirtyOwnerSlice['semanticDecision'] {
  if (group === 'deleted-backup-test-candidate') return 'replace-delete-candidate'
  if (group === 'msa-experiment-review') return 'replace-delete-candidate'
  if (group === 'legacy-bridge-command-surface') return 'replace-delete-candidate'
  if ([
    'engine-analyzers',
    'deleted-legacy-bridge-runtime',
    'deleted-opportunity-cli',
    'deleted-opportunity-data-sources',
    'deleted-opportunity-discovery',
    'deleted-full-absorb-planner',
    'deleted-memory-chain-runtime',
    'deleted-sidecar-experiment-runtime',
    'compat-wrapper-runtime-shim',
    'open-source-core-runtime-shim',
    'deleted-proxy-integration-tests',
    'deleted-tool-result-normalization-test',
    'minimal-recovery-test-shims',
    'example-lifecycle-test-shim',
    'full-absorb-test-shim',
    'legacy-wave-test-shims',
    'legacy-recovery-test-shims',
    'legacy-coordinator-test-shims',
    'kairos-session-subcontract-shims',
    'hitl-control-surface',
  ].includes(group) && (
    allEntriesDeleted(entries) ||
    group === 'minimal-recovery-test-shims' ||
    group === 'example-lifecycle-test-shim' ||
    group === 'full-absorb-test-shim' ||
    group === 'legacy-wave-test-shims' ||
    group === 'legacy-recovery-test-shims' ||
    group === 'legacy-coordinator-test-shims' ||
    group === 'kairos-session-subcontract-shims' ||
    group === 'compat-wrapper-runtime-shim' ||
    group === 'open-source-core-runtime-shim'
  )) {
    return 'replace-delete-candidate'
  }
  return 'map-to-mainline-owner'
}

function requiredActionForOwnerSlice(
  group: string,
  decision: MainlineDirtyOwnerSlice['semanticDecision'],
): string {
  if (group === 'engine-analyzers' && decision === 'replace-delete-candidate') {
    return 'close deleted engine analyzer source through normal git review; current task analyzer and quality gate evidence are the replacement path'
  }
  if (group === 'legacy-bridge-command-surface' && decision === 'replace-delete-candidate') {
    return 'close archived legacy bridge command surface through normal git review; DSXU provider contract alias block and tool-runtime dirty review are the replacement path'
  }
  if (group === 'legacy-command-registry-owner') {
    return 'review command registry removal of legacy bridge registration against provider contract and tool runtime owner evidence'
  }
  if (group === 'hitl-control-surface' && decision === 'replace-delete-candidate') {
    return 'close deleted HITL entrypoint through normal git review; current HITL test and permission floor evidence are the replacement path'
  }
  if (group === 'deleted-legacy-bridge-runtime' && decision === 'replace-delete-candidate') {
    return 'close deleted legacy bridge/query extension runtime through normal git review; current Tool Gate, control-plane, and tool lifecycle evidence are the replacement path'
  }
  if (group === 'deleted-opportunity-cli' && decision === 'replace-delete-candidate') {
    return 'close deleted opportunity CLI entrypoints through normal git review; current launcher and task lifecycle evidence are the replacement path'
  }
  if (group === 'deleted-opportunity-data-sources' && decision === 'replace-delete-candidate') {
    return 'close deleted opportunity data sources through normal git review; external integration and P12/raw evidence are the replacement path'
  }
  if (group === 'deleted-opportunity-discovery' && decision === 'replace-delete-candidate') {
    return 'close deleted opportunity discovery runner/reporting through normal git review; current task runtime and evidence pipeline are the replacement path'
  }
  if (group === 'deleted-full-absorb-planner' && decision === 'replace-delete-candidate') {
    return 'close deleted full-absorb planner through normal git review; owner Git closure and deferred absorption registers are the replacement path'
  }
  if (group === 'deleted-memory-chain-runtime' && decision === 'replace-delete-candidate') {
    return 'close deleted memory-chain runtime through normal git review; current context/session memory evidence is the replacement path'
  }
  if (group === 'deleted-sidecar-experiment-runtime' && decision === 'replace-delete-candidate') {
    return 'close deleted sidecar experiment runtime through normal git review; current agent/query-loop governance evidence is the replacement path'
  }
  if (group === 'compat-wrapper-runtime-shim' && decision === 'replace-delete-candidate') {
    return 'close DSXU mainline compatibility wrapper through normal git review; current tool adapter, provider contract, and command-owner entrypoints are the replacement path'
  }
  if (group === 'open-source-core-runtime-shim' && decision === 'replace-delete-candidate') {
    return 'close open-source-core task graph/scheduler support through normal git review; current task runtime, lifecycle, and release package evidence are the replacement path'
  }
  if (group === 'deleted-proxy-integration-tests' && decision === 'replace-delete-candidate') {
    return 'close deleted proxy integration tests through normal git review; current proxy budget guard, network facade, and direct-connect evidence are the replacement path'
  }
  if (group === 'deleted-tool-result-normalization-test' && decision === 'replace-delete-candidate') {
    return 'close deleted tool-result normalization test through normal git review; current direct-connect tool-result mapping and evidence-pack tests are the replacement path'
  }
  if (group === 'minimal-recovery-test-shims' && decision === 'replace-delete-candidate') {
    return 'close minimal recovery test shims through normal git review; current full recovery runtime, query-loop, and scenario tests are the replacement path'
  }
  if (group === 'example-lifecycle-test-shim' && decision === 'replace-delete-candidate') {
    return 'close lifecycle example test shim through normal git review; current lifecycle protocol manager and tool lifecycle contract tests are the replacement path'
  }
  if (group === 'full-absorb-test-shim' && decision === 'replace-delete-candidate') {
    return 'close full-absorb test shim through normal git review; current owner Git closure and deferred absorption tests are the replacement path'
  }
  if (group === 'legacy-wave-test-shims' && decision === 'replace-delete-candidate') {
    return 'close legacy wave aggregation tests through normal git review; current focused cost/cache, session/memory, config, doctor, and formatter tests are the replacement path'
  }
  if (group === 'legacy-recovery-test-shims' && decision === 'replace-delete-candidate') {
    return 'close legacy recovery aggregation tests through normal git review; current recovery v3 runtime, query-loop, and mainline tests are the replacement path'
  }
  if (group === 'legacy-coordinator-test-shims' && decision === 'replace-delete-candidate') {
    return 'close legacy coordinator aggregation tests through normal git review; current coordinator v4/v5 mainline, state alignment, lifecycle, and visible-copy tests are the replacement path'
  }
  if (group === 'kairos-session-subcontract-shims' && decision === 'replace-delete-candidate') {
    return 'close Kairos session subcontract shims through normal git review; current Kairos mainline, compact/resume replay, and session-memory tests are the replacement path'
  }
  if (group === 'msa-experiment-review') return 'close deleted MSA experiment source through normal git review; do not restore it as a second memory/context runtime'
  if (decision === 'replace-delete-candidate') return 'confirm current focused test replaces this backup before normal git review'
  if (decision === 'review-before-keep') return 'prove current DSXU owner value before keep; otherwise mark replace/delete candidate'
  return 'map to named mainline owner and verify no duplicate runtime or owner path is introduced'
}

function focusedVerificationForOwnerSlice(group: string): readonly string[] {
  if (group === 'legacy-bridge-command-surface') return ['bun test src/dsxu/engine/__tests__/tool-runtime-dirty-review-v1.test.ts', 'bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts']
  if (group === 'legacy-command-registry-owner') return ['bun test src/dsxu/engine/__tests__/tool-runtime-dirty-review-v1.test.ts', 'bun test src/dsxu/engine/__tests__/provider-contract-v1.test.ts']
  if (group === 'deleted-backup-test-candidate') return ['bun test current paired focused test', 'normal git review for backup deletion']
  if (group === 'msa-experiment-review') return ['bun test src/dsxu/engine/__tests__/context-owner-rule-contract-v1.test.ts', 'bun test src/dsxu/engine/__tests__/session-memory-mainline-v1.test.ts']
  if (group.startsWith('deleted-')) return ['normal git review for deleted source replacement evidence']
  if (group.includes('release')) return ['bun test src/dsxu/engine/__tests__/clean-export-readiness-v1.test.ts', 'bun test src/dsxu/engine/__tests__/release-closure-board-v1.test.ts']
  if (group.includes('phase12') || group.includes('eval')) return ['bun test src/dsxu/engine/__tests__/phase12-raw-comparison-v1.test.ts', 'bun test src/dsxu/engine/__tests__/phase12-experience-oracle-v1.test.ts']
  if (group.includes('runtime') || group.includes('tool') || group.includes('adapter')) return ['bun test src/dsxu/engine/__tests__/tool-runtime-dirty-review-v1.test.ts']
  if (group.includes('control-plane')) return ['bun test src/dsxu/engine/__tests__/control-plane-v1.test.ts']
  if (group.includes('cost')) return ['bun test src/dsxu/engine/__tests__/v17-live-cost-matrix-v1.test.ts']
  return ['bun test focused owner tests']
}

function replacementEvidenceForOwnerSlice(
  group: string,
  decision: MainlineDirtyOwnerSlice['semanticDecision'],
): readonly string[] {
  if (group === 'engine-analyzers' && decision === 'replace-delete-candidate') {
    return ['task-analyzer.test.ts', 'quality-gate-mainline-v1.test.ts']
  }
  if (group === 'legacy-bridge-command-surface' && decision === 'replace-delete-candidate') {
    return ['tool-runtime-dirty-review-v1.test.ts', 'provider-contract-v1.test.ts']
  }
  if (group === 'hitl-control-surface' && decision === 'replace-delete-candidate') {
    return ['hitl.test.ts', 'allowed-tools-permission-floor-v1.test.ts']
  }
  if (group === 'deleted-legacy-bridge-runtime' && decision === 'replace-delete-candidate') {
    return ['tool-runtime-dirty-review-v1.test.ts', 'control-plane-v1.test.ts', 'tool-lifecycle-contract-v1.test.ts']
  }
  if (group === 'deleted-opportunity-cli' && decision === 'replace-delete-candidate') {
    return ['toolchain-selfcheck-v1.test.ts', 'task-runtime-mainline-v1-clean.test.ts']
  }
  if (group === 'deleted-opportunity-data-sources' && decision === 'replace-delete-candidate') {
    return ['network-facade-v1.test.ts', 'direct-connect-and-query-contract-v1.test.ts', 'phase12-raw-comparison-v1.test.ts']
  }
  if (group === 'deleted-opportunity-discovery' && decision === 'replace-delete-candidate') {
    return ['task-runtime-mainline-v1-clean.test.ts', 'tool-evidence-pack-contract-v1.test.ts', 'real-task-replay-suite-v1.test.ts']
  }
  if (group === 'deleted-full-absorb-planner' && decision === 'replace-delete-candidate') {
    return ['owner-git-closure-board-v1.test.ts', 'deferred-product-absorption-register-v1.test.ts']
  }
  if (group === 'deleted-memory-chain-runtime' && decision === 'replace-delete-candidate') {
    return ['context-owner-rule-contract-v1.test.ts', 'session-memory-mainline-v1.test.ts']
  }
  if (group === 'deleted-sidecar-experiment-runtime' && decision === 'replace-delete-candidate') {
    return ['agent-runtime-mainline-v1.test.ts', 'query-loop-visible-copy-v1.test.ts']
  }
  if (group === 'compat-wrapper-runtime-shim' && decision === 'replace-delete-candidate') {
    return ['c05-tool-compat-absorption-clean.test.ts', 'mainline-tool-adapter-v1.test.ts', 'provider-contract-v1.test.ts', 'tool-mainline-v1-clean.test.ts']
  }
  if (group === 'open-source-core-runtime-shim' && decision === 'replace-delete-candidate') {
    return ['task-runtime-mainline-v1-clean.test.ts', 'task-lifecycle-v1-clean.test.ts', 'v18-open-source-package-gate-v1.test.ts']
  }
  if (group === 'deleted-proxy-integration-tests' && decision === 'replace-delete-candidate') {
    return ['proxy-budget-guard.test.ts', 'network-facade-v1.test.ts', 'direct-connect-and-query-contract-v1.test.ts']
  }
  if (group === 'deleted-tool-result-normalization-test' && decision === 'replace-delete-candidate') {
    return ['direct-connect-and-query-contract-v1.test.ts', 'tool-evidence-pack-contract-v1.test.ts']
  }
  if (group === 'minimal-recovery-test-shims' && decision === 'replace-delete-candidate') {
    return ['recovery-runtime-v3.test.ts', 'recovery-query-loop-v3.test.ts', 'recovery-mainline-v3.test.ts']
  }
  if (group === 'example-lifecycle-test-shim' && decision === 'replace-delete-candidate') {
    return ['lifecycle-protocol-manager.test.ts', 'tool-lifecycle-contract-v1.test.ts']
  }
  if (group === 'full-absorb-test-shim' && decision === 'replace-delete-candidate') {
    return ['owner-git-closure-board-v1.test.ts', 'deferred-product-absorption-register-v1.test.ts']
  }
  if (group === 'legacy-wave-test-shims' && decision === 'replace-delete-candidate') {
    return [
      'v19-cost-cache-live-task-evidence-v1.test.ts',
      'memory-session-integration.test.ts',
      'model-config.test.ts',
      'toolchain-selfcheck-v1.test.ts',
      'source-encoding-boundary-v1.test.ts',
    ]
  }
  if (group === 'legacy-recovery-test-shims' && decision === 'replace-delete-candidate') {
    return ['recovery-runtime-v3.test.ts', 'recovery-query-loop-v3.test.ts', 'recovery-mainline-v3.test.ts']
  }
  if (group === 'legacy-coordinator-test-shims' && decision === 'replace-delete-candidate') {
    return [
      'coordinator-mainline-v4-strong.test.ts',
      'coordinator-state-model-v4-alignment.test.ts',
      'coordinator-lifecycle-v5-clean.test.ts',
      'coordinator-visible-copy-v1.test.ts',
    ]
  }
  if (group === 'kairos-session-subcontract-shims' && decision === 'replace-delete-candidate') {
    return [
      'kairos-session-mainline-v1.test.ts',
      'compact-resume-replay-v1.test.ts',
      'session-memory-mainline-v1.test.ts',
    ]
  }
  if (group === 'deleted-backup-test-candidate') return ['engine.test.ts']
  if (group === 'msa-experiment-review') {
    return [
      'context-owner-rule-contract-v1.test.ts',
      'session-memory-mainline-v1.test.ts',
    ]
  }
  return []
}

function ownerEvidenceForOwnerSlice(group: string): readonly string[] {
  if (group === 'legacy-bridge-command-surface') return ['tool-runtime-dirty-review-v1.test.ts', 'provider-contract-v1.test.ts']
  if (group === 'legacy-command-registry-owner') return ['tool-runtime-dirty-review-v1.test.ts', 'provider-contract-v1.test.ts']
  if (group === 'engine-analyzers') return ['task-analyzer.test.ts', 'quality-gate-mainline-v1.test.ts']
  if (group === 'deleted-legacy-bridge-runtime') return ['tool-runtime-dirty-review-v1.test.ts', 'control-plane-v1.test.ts', 'tool-lifecycle-contract-v1.test.ts']
  if (group === 'deleted-opportunity-cli') return ['toolchain-selfcheck-v1.test.ts', 'task-runtime-mainline-v1-clean.test.ts']
  if (group === 'deleted-opportunity-data-sources') return ['network-facade-v1.test.ts', 'direct-connect-and-query-contract-v1.test.ts', 'phase12-raw-comparison-v1.test.ts']
  if (group === 'deleted-opportunity-discovery') return ['task-runtime-mainline-v1-clean.test.ts', 'tool-evidence-pack-contract-v1.test.ts', 'real-task-replay-suite-v1.test.ts']
  if (group === 'deleted-full-absorb-planner') return ['owner-git-closure-board-v1.test.ts', 'deferred-product-absorption-register-v1.test.ts']
  if (group === 'deleted-memory-chain-runtime') return ['context-owner-rule-contract-v1.test.ts', 'session-memory-mainline-v1.test.ts']
  if (group === 'deleted-sidecar-experiment-runtime') return ['agent-runtime-mainline-v1.test.ts', 'query-loop-visible-copy-v1.test.ts']
  if (group === 'compat-wrapper-runtime-shim') return ['c05-tool-compat-absorption-clean.test.ts', 'mainline-tool-adapter-v1.test.ts', 'provider-contract-v1.test.ts', 'tool-mainline-v1-clean.test.ts']
  if (group === 'open-source-core-runtime-shim') return ['task-runtime-mainline-v1-clean.test.ts', 'task-lifecycle-v1-clean.test.ts', 'v18-open-source-package-gate-v1.test.ts']
  if (group === 'provider-backend-adapter-boundary') return ['provider-contract-v1.test.ts', 'control-plane-v1.test.ts', 'remote-lifecycle-v1.test.ts']
  if (group === 'permission-tool-gate-owner') return ['permissions.test.ts', 'allowed-tools-permission-floor-v1.test.ts', 'tool-runtime-dirty-review-v1.test.ts', 'bash-adapter-safety-v1.test.ts', 'powershell-parser-lifecycle-v1.test.ts']
  if (group === 'model-router-cost-api-owner') return ['api-service.test.ts', 'deepseek-v4-control-v1.test.ts', 'v19-cost-cache-live-task-evidence-v1.test.ts', 'phase12-live-cost-matrix-v1.test.ts']
  if (group === 'deleted-proxy-integration-tests') return ['proxy-budget-guard.test.ts', 'network-facade-v1.test.ts', 'direct-connect-and-query-contract-v1.test.ts']
  if (group === 'deleted-tool-result-normalization-test') return ['direct-connect-and-query-contract-v1.test.ts', 'tool-evidence-pack-contract-v1.test.ts']
  if (group === 'minimal-recovery-test-shims') return ['recovery-runtime-v3.test.ts', 'recovery-query-loop-v3.test.ts', 'recovery-mainline-v3.test.ts']
  if (group === 'example-lifecycle-test-shim') return ['lifecycle-protocol-manager.test.ts', 'tool-lifecycle-contract-v1.test.ts']
  if (group === 'full-absorb-test-shim') return ['owner-git-closure-board-v1.test.ts', 'deferred-product-absorption-register-v1.test.ts']
  if (group === 'legacy-wave-test-shims') {
    return [
      'v19-cost-cache-live-task-evidence-v1.test.ts',
      'memory-session-integration.test.ts',
      'model-config.test.ts',
      'toolchain-selfcheck-v1.test.ts',
      'source-encoding-boundary-v1.test.ts',
    ]
  }
  if (group === 'legacy-recovery-test-shims') return ['recovery-runtime-v3.test.ts', 'recovery-query-loop-v3.test.ts', 'recovery-mainline-v3.test.ts']
  if (group === 'legacy-coordinator-test-shims') {
    return [
      'coordinator-mainline-v4-strong.test.ts',
      'coordinator-state-model-v4-alignment.test.ts',
      'coordinator-lifecycle-v5-clean.test.ts',
      'coordinator-visible-copy-v1.test.ts',
    ]
  }
  if (group === 'kairos-session-subcontract-shims') {
    return [
      'kairos-session-mainline-v1.test.ts',
      'compact-resume-replay-v1.test.ts',
      'session-memory-mainline-v1.test.ts',
    ]
  }
  if (group === 'engine-support-contracts') return ['engine.test.ts', 'quality-gate-mainline-v1.test.ts']
  if (group === 'phase12-eval-engine') {
    return [
      'phase12-raw-comparison-v1.test.ts',
      'phase12-experience-oracle-v1.test.ts',
      'reference-experience-quality-contract-v1.test.ts',
    ]
  }
  if (group === 'release-hygiene-engine') {
    return [
      'clean-export-readiness-v1.test.ts',
      'release-closure-board-v1.test.ts',
      'v18-release-provenance-gate-v1.test.ts',
    ]
  }
  if (group === 'runtime-contract-engine') {
    return [
      'tool-runtime-dirty-review-v1.test.ts',
      'tool-runtime-duplication-decision-v1.test.ts',
      'control-plane-v1.test.ts',
      'network-facade-v1.test.ts',
    ]
  }
  if (group === 'agent-context-tests') {
    return [
      'agent-runtime-mainline-v1.test.ts',
      'context-owner-rule-contract-v1.test.ts',
      'session-memory-mainline-v1.test.ts',
    ]
  }
  if (group === 'engine-unit-tests') return ['engine.test.ts', 'evo-engine.test.ts']
  if (group === 'phase12-eval-tests') return ['phase12-raw-comparison-v1.test.ts', 'phase12-experience-oracle-v1.test.ts']
  if (group === 'release-hygiene-tests') return ['mainline-dirty-review-v1.test.ts', 'clean-export-readiness-v1.test.ts', 'release-closure-board-v1.test.ts']
  if (group === 'runtime-contract-tests') return ['tool-runtime-dirty-review-v1.test.ts', 'control-plane-v1.test.ts', 'allowed-tools-permission-floor-v1.test.ts']
  if (group === 'agent-tool-owner') {
    return [
      'agent-runtime-mainline-v1.test.ts',
      'agent-parent-final-gate-replay-v1.test.ts',
      'local-agent-background-lifecycle-v1.test.ts',
    ]
  }
  if (group === 'file-edit-tool-owner') {
    return [
      'file-edit-adapter-atomic-v1.test.ts',
      'edit-convergence-gate-v1.test.ts',
      'mainline-tool-adapter-v1.test.ts',
    ]
  }
  if (group === 'shell-adapter-owner') {
    return [
      'bash-adapter-safety-v1.test.ts',
      'powershell-parser-lifecycle-v1.test.ts',
      'allowed-tools-permission-floor-v1.test.ts',
    ]
  }
  if (group === 'task-tool-owner') {
    return [
      'task-runtime-mainline-v1-clean.test.ts',
      'task-lifecycle-v1-clean.test.ts',
      'task-notification-processing-v1.test.ts',
    ]
  }
  if (group === 'tool-lifecycle-owner') {
    return [
      'tool-lifecycle-contract-v1.test.ts',
      'tool-mainline-v1-clean.test.ts',
      'tool-batch-gate-classification-v1.test.ts',
    ]
  }
  if (group === 'tool-visible-projection') {
    return [
      'tool-evidence-pack-contract-v1.test.ts',
      'query-loop-visible-copy-v1.test.ts',
      'visible-ui-copy-pack-v1.test.ts',
    ]
  }
  if (group === 'package-runtime-config') {
    return [
      'v18-open-source-package-gate-v1.test.ts',
      'toolchain-selfcheck-v1.test.ts',
      'release-test-gate-v1.test.ts',
    ]
  }
  if (group === 'release-root-policy') {
    return [
      'release-surface-v1.test.ts',
      'clean-export-readiness-v1.test.ts',
      'v18-release-provenance-gate-v1.test.ts',
    ]
  }
  if (group === 'startup-compile-config') return ['toolchain-selfcheck-v1.test.ts', 'wsl-workspace-health-v1.test.ts']
  if (group === 'control-plane-product-surface') return ['control-plane-v1.test.ts', 'control-plane-stage-acceptance-v1.test.ts']
  if (group === 'cost-evidence-surface') return ['v19-cost-cache-live-task-evidence-v1.test.ts', 'phase12-live-cost-matrix-v1.test.ts']
  if (group === 'evidence-harness-surface') return ['real-task-replay-suite-v1.test.ts', 'phase12-raw-comparison-v1.test.ts', 'clean-export-readiness-v1.test.ts']
  if (group === 'root-test-harness') return ['tdd-verify-tdd.test.ts', 'apiMicrocompact.test.ts', 'quality-gate-mainline-v1.test.ts']
  if (group === 'fixture-data-contracts') return ['tdd-verify-tdd.test.ts', 'apiMicrocompact.test.ts', 'quality-gate-mainline-v1.test.ts']
  if (group === 'dsxu-other-owner') return ['network-facade-v1.test.ts', 'release-surface-v1.test.ts']
  if (group === 'hitl-control-surface') return ['hitl.test.ts', 'allowed-tools-permission-floor-v1.test.ts']
  if (group === 'integration-entrypoint') return ['integration.test.ts', 'harness-integration.test.ts', 'real-task-replay-suite-v1.test.ts']
  return []
}

function buildOwnerSlices(
  batchId: MainlineDirtyReviewBatchId,
  group: MainlineDirtyGroup,
  entries: readonly V18DirtyLedgerEntry[],
  availableReplacementEvidence: ReadonlySet<string>,
): readonly MainlineDirtyOwnerSlice[] {
  const sliceEntries = group === 'legacy-mainline'
    ? entries.filter(entry => ownerSliceGroupForPath(group, entry.path) !== 'legacy-mainline')
    : entries
  const groups = [...new Set(sliceEntries.map(entry => ownerSliceGroupForPath(group, entry.path)))]
    .sort(sortOwnerSliceGroups)
  return groups.map((sliceGroup, index) => {
    const currentSliceEntries = sliceEntries.filter(entry => ownerSliceGroupForPath(group, entry.path) === sliceGroup)
    const decision = semanticDecisionForOwnerSlice(sliceGroup, currentSliceEntries)
    const ownerEvidence = ownerEvidenceForOwnerSlice(sliceGroup)
    const ownerEvidenceChecks = buildReplacementEvidenceChecks(ownerEvidence, availableReplacementEvidence)
    const missingOwnerEvidence = ownerEvidenceChecks
      .filter(item => item.status === 'MISSING')
      .map(item => item.name)
    const replacementEvidence = replacementEvidenceForOwnerSlice(sliceGroup, decision)
    const replacementEvidenceChecks = buildReplacementEvidenceChecks(replacementEvidence, availableReplacementEvidence)
    const missingReplacementEvidence = replacementEvidenceChecks
      .filter(item => item.status === 'MISSING')
      .map(item => item.name)
    return {
      id: `${batchId}.${String(index + 1).padStart(2, '0')}`,
      parentId: batchId,
      group: sliceGroup,
      count: currentSliceEntries.length,
      owner: ownerForOwnerSlice(sliceGroup),
      targetOwner: targetOwnerForOwnerSlice(sliceGroup),
      semanticDecision: decision,
      requiredAction: requiredActionForOwnerSlice(sliceGroup, decision),
      focusedVerification: focusedVerificationForOwnerSlice(sliceGroup),
      ownerEvidence,
      ownerEvidenceStatus: ownerEvidence.length === 0
        ? 'NOT_REQUIRED'
        : missingOwnerEvidence.length === 0
          ? 'VERIFIED_FOR_REVIEW'
          : 'MISSING',
      ownerEvidenceChecks,
      missingOwnerEvidence,
      replacementEvidence,
      replacementEvidenceStatus: missingReplacementEvidence.length === 0 ? 'VERIFIED_FOR_REVIEW' : 'MISSING',
      replacementEvidenceChecks,
      missingReplacementEvidence,
      samplePaths: currentSliceEntries.slice(0, 8).map(entry => sanitizePath(entry.path)),
      redlines: [
        ...(decision === 'map-to-mainline-owner' ? [] : [`${decision} requires explicit owner review before keep`]),
        ...missingOwnerEvidence.map(item => `missing owner evidence: ${item}`),
        ...missingReplacementEvidence.map(item => `missing replacement evidence: ${item}`),
      ],
    }
  })
}

function buildBatch(
  group: MainlineDirtyGroup,
  entries: readonly V18DirtyLedgerEntry[],
  availableReplacementEvidence: ReadonlySet<string>,
): MainlineDirtyReviewBatch {
  const batchId = idForGroup(group)
  const ownerSlices = buildOwnerSlices(batchId, group, entries, availableReplacementEvidence)
  const redlines = entries.length === 0 ? ['batch has no entries'] : []
  return {
    id: batchId,
    group,
    count: entries.length,
    modifiedCount: entries.filter(entry => entry.status.includes('M')).length,
    deletedCount: entries.filter(entry => entry.status.includes('D')).length,
    untrackedCount: entries.filter(entry => entry.status.includes('?')).length,
    owner: ownerForGroup(group),
    status: redlines.length > 0 ? 'BLOCKED' : 'PARTIAL',
    risk: riskForGroup(group),
    requiredAction: requiredActionForGroup(group),
    focusedVerification: focusedVerificationForGroup(group),
    ownerSlices,
    canAutoClose: false,
    samplePaths: entries.slice(0, 10).map(entry => sanitizePath(entry.path)),
    redlines,
  }
}

export function buildMainlineDirtyReview(
  ledger: V18DirtyQuarantineLedger,
  options: {
    availableReplacementEvidence?: readonly string[]
    legacyMainlineReviewStatus?: MainlineDirtyReview['legacyMainlineReviewStatus']
    legacyMainlineReviewBatchCount?: number
  } = {},
): MainlineDirtyReview {
  const availableReplacementEvidence = new Set(options.availableReplacementEvidence ?? defaultAvailableReplacementEvidence())
  const mainlineEntries = ledger.entries.filter(entry => entry.category === 'mainline_active')
  const batches = groupOrder
    .map(group => {
      const entries = mainlineEntries.filter(entry => groupForPath(entry.path) === group)
      return entries.length > 0 ? buildBatch(group, entries, availableReplacementEvidence) : null
    })
    .filter((batch): batch is MainlineDirtyReviewBatch => batch !== null)
  const pass = batches.filter(batch => batch.status === 'PASS').length
  const partial = batches.filter(batch => batch.status === 'PARTIAL').length
  const blocked = batches.filter(batch => batch.status === 'BLOCKED').length
  const highRiskBatchCount = batches.filter(batch => batch.risk === 'high').length
  const ownerSlices = batches.flatMap(batch => batch.ownerSlices)
  const reviewBeforeKeepCount = ownerSlices.filter(slice => slice.semanticDecision === 'review-before-keep').length
  const replaceDeleteCandidateCount = ownerSlices.filter(slice => slice.semanticDecision === 'replace-delete-candidate').length
  const engineTestOwnerSlices = ownerSlices.filter(slice =>
    (slice.parentId === 'MDR-02' || slice.parentId === 'MDR-03') &&
    slice.semanticDecision === 'map-to-mainline-owner',
  )
  const engineTestOwnerSliceCount = engineTestOwnerSlices.length
  const engineTestOwnerEvidenceVerifiedCount = engineTestOwnerSlices
    .filter(slice => slice.ownerEvidenceStatus === 'VERIFIED_FOR_REVIEW').length
  const engineTestOwnerMissingEvidenceCount = engineTestOwnerSlices
    .filter(slice => slice.ownerEvidenceStatus === 'MISSING').length
  const toolsConfigOwnerSlices = ownerSlices.filter(slice =>
    ['MDR-04', 'MDR-05', 'MDR-06', 'MDR-07', 'MDR-08'].includes(slice.parentId) &&
    slice.semanticDecision === 'map-to-mainline-owner',
  )
  const toolsConfigOwnerSliceCount = toolsConfigOwnerSlices.length
  const toolsConfigOwnerEvidenceVerifiedCount = toolsConfigOwnerSlices
    .filter(slice => slice.ownerEvidenceStatus === 'VERIFIED_FOR_REVIEW').length
  const toolsConfigOwnerMissingEvidenceCount = toolsConfigOwnerSlices
    .filter(slice => slice.ownerEvidenceStatus === 'MISSING').length
  const replaceDeleteCandidates = ownerSlices.filter(slice => slice.semanticDecision === 'replace-delete-candidate')
  const replaceDeleteEvidenceVerifiedCount = replaceDeleteCandidates.filter(slice => slice.replacementEvidenceStatus === 'VERIFIED_FOR_REVIEW').length
  const replaceDeleteMissingEvidenceCount = replaceDeleteCandidates.filter(slice => slice.replacementEvidenceStatus === 'MISSING').length
  const legacyMainlineReviewStatus = options.legacyMainlineReviewStatus ?? 'NOT_RUN'
  const legacyMainlineReviewBatchCount = options.legacyMainlineReviewBatchCount ?? 0
  const legacyMainlineReviewAttached = legacyMainlineReviewStatus !== 'NOT_RUN'
  const redlines = [
    ...(mainlineEntries.length > 0 ? ['mainline dirty entries remain open'] : []),
    ...batches.flatMap(batch => batch.redlines.map(redline => `${batch.id}: ${redline}`)),
  ]
  const status: MainlineDirtyReviewStatus = blocked > 0
    ? 'BLOCKED'
    : mainlineEntries.length > 0 || partial > 0
      ? 'PARTIAL'
      : 'PASS'

  return {
    schemaVersion: 'dsxu.mainline-dirty-review.v1',
    status,
    total: mainlineEntries.length,
    batchCount: batches.length,
    ownerSliceCount: ownerSlices.length,
    reviewBeforeKeepCount,
    replaceDeleteCandidateCount,
    engineTestOwnerSliceCount,
    engineTestOwnerEvidenceVerifiedCount,
    engineTestOwnerMissingEvidenceCount,
    toolsConfigOwnerSliceCount,
    toolsConfigOwnerEvidenceVerifiedCount,
    toolsConfigOwnerMissingEvidenceCount,
    replaceDeleteEvidenceVerifiedCount,
    replaceDeleteMissingEvidenceCount,
    pass,
    partial,
    blocked,
    highRiskBatchCount,
    legacyMainlineReviewStatus,
    legacyMainlineReviewBatchCount,
    canCloseMainlineDirtyGate: mainlineEntries.length === 0 && blocked === 0,
    mustNotStageOrRestore: mainlineEntries.length > 0 || blocked > 0,
    batches,
    redlines,
    safeguards: [
      'review is evidence-only and does not stage, delete, restore, move, reset, or commit files',
      'mainline dirty batches must be closed by owner-reviewed change groups',
      'tests are evidence only; they do not authorize staging unrelated files',
      'large legacy-mainline batches must be split before release claims',
    ],
    nextAction: batches.some(batch => batch.group === 'legacy-mainline') && !legacyMainlineReviewAttached
      ? 'split-legacy-mainline'
      : engineTestOwnerMissingEvidenceCount > 0
        ? 'review-engine-and-tests'
        : toolsConfigOwnerMissingEvidenceCount > 0
          ? 'review-tools-and-config'
        : batches.length > 0
          ? replaceDeleteCandidateCount > 0 || legacyMainlineReviewAttached
            ? 'review-owner-git-closure'
            : 'review-tools-and-config'
          : 'mainline-gate-closed',
  }
}
