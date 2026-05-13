import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildPermissionToolGateImportUseScan, buildProductCompatAdapterImportUseScan, buildSharedUtilityImportUseScan, buildToolRuntimeDirtyReview } from '../tool-runtime-dirty-review-v1'
import { buildV18DirtyQuarantineLedger } from '../v18-dirty-quarantine-ledger'
import { runToolRuntimeDirtyReviewHarness } from '../../integration/harness/tool-runtime-dirty-review-v1-harness'

describe('LMR-01 - Tool Runtime Dirty Review V1', () => {
  test('splits legacy tool runtime into single-mainline mapping groups', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/services/toolService.ts',
        ' M src/commands/run.ts',
        ' M src/tools/ShellTool.ts',
        ' M src/tools/AgentTool/AgentTool.tsx',
        ' M src/mcp/client.ts',
        ' M src/components/App.tsx',
      ],
    })
    const review = buildToolRuntimeDirtyReview(ledger)

    expect(review.schemaVersion).toBe('dsxu.tool-runtime-dirty-review.v1')
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBe(5)
    expect(review.canCloseToolRuntimeGate).toBe(false)
    expect(review.mustNotStageOrRestore).toBe(true)
    expect(review.batches.map(batch => batch.id)).toEqual(['TRR-01', 'TRR-02', 'TRR-03', 'TRR-04', 'TRR-05'])
    expect(review.batches.find(batch => batch.id === 'TRR-01')?.duplicateSystemRisk).toBe('high')
    expect(review.batches.find(batch => batch.id === 'TRR-04')?.requiredAction).toContain('serial_worker')
    expect(review.batches.find(batch => batch.id === 'TRR-02')?.commandSurfaceSlices?.some(slice => slice.group === 'query-session-command')).toBe(true)
    expect(review.commandSurfaceUnassignedCount).toBe(0)
    expect(review.batches.find(batch => batch.id === 'TRR-03')?.toolCoreSlices?.some(slice => slice.group === 'shell-execution-tool')).toBe(true)
    expect(review.toolCoreUnassignedCount).toBe(0)
    expect(review.batches.find(batch => batch.id === 'TRR-04')?.agentToolSlices?.some(slice => slice.group === 'agent-entry-lifecycle')).toBe(true)
    expect(review.agentToolUnassignedCount).toBe(0)
    expect(review.batches.find(batch => batch.id === 'TRR-05')?.externalIntegrationSlices?.some(slice => slice.group === 'product-compat-adapter')).toBe(true)
    expect(review.externalIntegrationUnassignedCount).toBe(0)
    expect(review.safeguards.join('\n')).toContain('second executor')
    expect(review.nextAction).toBe('collapse-support-services')
  })

  test('splits TRR-01 support services into concrete mainline owner slices', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/permissions/check.ts',
        ' M src/services/api/dsxu.ts',
        ' M src/services/mcp/client.ts',
        ' M src/services/compact/snapshot.ts',
        ' M src/services/static-analysis/parsers/semgrep.ts',
        ' M src/hooks/notifs/usePermission.tsx',
        ' M src/services/analytics/events.ts',
        ' M src/utils/array.ts',
      ],
    })
    const review = buildToolRuntimeDirtyReview(ledger)
    const supportBatch = review.batches.find(batch => batch.id === 'TRR-01')

    expect(review.total).toBe(8)
    expect(review.supportServiceSliceCount).toBe(8)
    expect(review.supportServiceHighRiskSliceCount).toBe(3)
    expect(review.supportServiceHighRiskProofCount).toBe(3)
    expect(review.supportServiceSharedHelperCount).toBe(1)
    expect(supportBatch?.supportSlices?.map(slice => slice.id)).toEqual([
      'TRR-01A',
      'TRR-01B',
      'TRR-01C',
      'TRR-01D',
      'TRR-01E',
      'TRR-01F',
      'TRR-01G',
      'TRR-01H',
    ])
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01A')?.targetMainline).toContain('tool-gate-v1')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01A')?.mainlineImportUseProof?.requiredMainlineOwner).toContain('tool-gate-v1')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01B')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('second provider runtime loop')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01C')?.mainlineImportUseProof?.allowedConsumerOwners).toContain('Skill registry')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01D')?.mainlineImportUseProof?.requiredMainlineOwner).toContain('Context Owner Rule')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01E')?.mainlineImportUseProof?.requiredMainlineOwner).toContain('source truth')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01F')?.mainlineImportUseProof?.requiredMainlineOwner).toContain('visible-state')
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01G')?.mainlineImportUseProof?.requiredMainlineOwner).toContain('diagnostics')
    expect(supportBatch?.supportSlices?.filter(slice => slice.duplicateSystemRisk === 'high').every(slice => slice.mainlineImportUseProof?.canCloseWithoutImportUseReview === false)).toBe(true)
    expect(supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01F')?.owner).toBe('Product Surface Visible State')
    expect(review.supportServiceSharedOwnerSliceCount).toBe(1)
    expect(review.supportServiceUnassignedSharedHelperCount).toBe(0)
    expect(review.redlines.join('\n')).not.toContain('shared helper bucket still needs concrete owner assignment')
  })

  test('splits TRR-01H shared helpers by import/use owner instead of keeping a generic bucket', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/services/oauth/client.ts',
        ' M src/utils/execFileNoThrow.ts',
        ' M src/utils/path.ts',
        ' M src/utils/cron.ts',
        ' M src/utils/http.ts',
        ' M src/utils/ansiToPng.ts',
        ' M src/utils/processUserInput/processUserInput.ts',
        ' M src/services/embedding/store.ts',
        ' M src/services/__tests__/sampling-policy.test.ts',
      ],
    })
    const review = buildToolRuntimeDirtyReview(ledger)
    const supportBatch = review.batches.find(batch => batch.id === 'TRR-01')
    const sharedSlice = supportBatch?.supportSlices?.find(slice => slice.id === 'TRR-01H')

    expect(review.total).toBe(9)
    expect(review.supportServiceSharedHelperCount).toBe(9)
    expect(review.supportServiceSharedOwnerSliceCount).toBe(9)
    expect(review.supportServiceUnassignedSharedHelperCount).toBe(0)
    expect(sharedSlice?.canKeepAsGenericSupportBucket).toBe(false)
    expect(sharedSlice?.sharedUtilitySlices?.map(slice => slice.id)).toEqual([
      'TRR-01H1',
      'TRR-01H2',
      'TRR-01H3',
      'TRR-01H4',
      'TRR-01H5',
      'TRR-01H6',
      'TRR-01H7',
      'TRR-01H8',
      'TRR-01H9',
    ])
    expect(sharedSlice?.sharedUtilitySlices?.find(slice => slice.id === 'TRR-01H2')?.targetMainline).toContain('tool lifecycle')
    expect(sharedSlice?.sharedUtilitySlices?.find(slice => slice.id === 'TRR-01H7')?.owner).toBe('Input / Command Adapter')
    expect(review.redlines.join('\n')).not.toContain('TRR-01H')
  })

  test('classifies TRR-01H shared utility import/use callers by concrete owner', () => {
    const scan = buildSharedUtilityImportUseScan([
      {
        callerPath: 'src/utils/execFileNoThrow.ts',
        symbol: 'execFileNoThrow',
        lineNumber: 12,
        evidence: 'export async function execFileNoThrow(...)',
      },
      {
        callerPath: 'src/tools/BashTool/BashTool.tsx',
        symbol: 'execFileNoThrow',
        lineNumber: 33,
        evidence: "import { execFileNoThrow } from '../../utils/execFileNoThrow.js'",
      },
      {
        callerPath: 'src/utils/processUserInput/processUserInput.ts',
        symbol: 'processUserInput',
        lineNumber: 20,
        evidence: 'export async function processUserInput(...)',
      },
      {
        callerPath: 'src/services/oauth/client.ts',
        symbol: 'authFileDescriptor',
        lineNumber: 8,
        evidence: "import { getAuthFileDescriptor } from '../../utils/authFileDescriptor.js'",
      },
      {
        callerPath: 'src/components/terminal/TerminalFrame.tsx',
        symbol: 'ansiToPng',
        lineNumber: 11,
        evidence: "import { ansiToPng } from '../../utils/ansiToPng.js'",
      },
    ])

    expect(scan.scanId).toBe('TRR-01H-shared-runtime-utilities-import-use')
    expect(scan.status).toBe('PASS')
    expect(scan.totalCallerCount).toBe(5)
    expect(scan.forbiddenCallerCount).toBe(0)
    expect(scan.unknownCallerCount).toBe(0)
    expect(scan.ownerCounts.map(count => count.owner)).toContain('process-tool-lifecycle')
    expect(scan.ownerCounts.map(count => count.owner)).toContain('input-command-facade')
    expect(scan.ownerCounts.map(count => count.owner)).toContain('auth-control-plane')
    expect(scan.ownerCounts.map(count => count.owner)).toContain('render-evidence-projection')
  })

  test('classifies TRR-01A permission import/use callers and flags second permission runtime candidates', () => {
    const scan = buildPermissionToolGateImportUseScan([
      {
        callerPath: 'src/services/tools/toolExecution.ts',
        symbol: 'startSpeculativeClassifierCheck',
        lineNumber: 40,
        evidence: "import { startSpeculativeClassifierCheck } from '../../tools/BashTool/bashPermissions.js'",
      },
      {
        callerPath: 'src/tools/BashTool/BashTool.tsx',
        symbol: 'SandboxManager',
        lineNumber: 34,
        evidence: "import { SandboxManager } from '../../utils/sandbox/sandbox-adapter.js'",
      },
      {
        callerPath: 'src/cli/structuredIO.ts',
        symbol: 'hasPermissionsToUseTool',
        lineNumber: 38,
        evidence: "import { hasPermissionsToUseTool } from 'src/utils/permissions/permissions.js'",
      },
      {
        callerPath: 'src/components/permissions/PermissionRequest.tsx',
        symbol: 'applyPermissionUpdate',
        lineNumber: 12,
        evidence: "import { applyPermissionUpdate } from '../../utils/permissions/PermissionUpdate.js'",
      },
      {
        callerPath: 'src/dsxu/engine/permissions.ts',
        symbol: 'PermissionManager',
        lineNumber: 113,
        evidence: 'export class PermissionManager',
      },
      {
        callerPath: 'src/dsxu/engine/runtime-core.ts',
        symbol: 'PermissionManager',
        lineNumber: 3629,
        evidence: 'const permissionManager = new permissionsModule.PermissionManager(',
      },
    ])

    expect(scan.totalCallerCount).toBe(6)
    expect(scan.allowedCallerCount).toBe(4)
    expect(scan.forbiddenCallerCount).toBe(2)
    expect(scan.unknownCallerCount).toBe(0)
    expect(scan.status).toBe('BLOCKED')
    expect(scan.findings.find(finding => finding.callerPath === 'src/dsxu/engine/permissions.ts')?.owner).toBe('forbidden-second-permission-runtime')
    expect(scan.findings.find(finding => finding.callerPath === 'src/dsxu/engine/runtime-core.ts')?.owner).toBe('forbidden-second-permission-runtime')
  })

  test('flags runtime-core bridge compatibility exports as TRR-05D standalone runtime candidates', () => {
    const scan = buildProductCompatAdapterImportUseScan([
      {
        callerPath: 'src/dsxu/engine/runtime-core.ts',
        symbol: 'createDSXUBridgeBatchMainlineRuntime',
        lineNumber: 3208,
        evidence: 'export function createDSXUBridgeBatchMainlineRuntime() {',
      },
      {
        callerPath: 'src/dsxu/engine/runtime-core.ts',
        symbol: 'provider-backend/dsxu-provider-compat',
        lineNumber: 3209,
        evidence: "const bridgeApiModule = require('./provider-backend/dsxu-provider-compat');",
      },
      {
        callerPath: 'src/moreright/adapter.ts',
        symbol: 'MoreRight',
        lineNumber: 8,
        evidence: 'export const MoreRight = {}',
      },
    ])

    expect(scan.scanId).toBe('TRR-05D-product-compat-adapter-import-use')
    expect(scan.status).toBe('BLOCKED')
    expect(scan.forbiddenCallerCount).toBe(1)
    expect(scan.unknownCallerCount).toBe(0)
    expect(scan.findings.find(finding => finding.callerPath === 'src/dsxu/engine/runtime-core.ts')?.owner).toBe('forbidden-standalone-external-runtime')
    expect(scan.findings.find(finding => finding.callerPath === 'src/dsxu/engine/runtime-core.ts')?.forbiddenClosure?.disposition).toBe('migrate-to-mainline-owner')
  })

  test('passes only when no tool runtime entries remain', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [' M src/components/App.tsx'],
    })
    const review = buildToolRuntimeDirtyReview(ledger)

    expect(review.status).toBe('PASS')
    expect(review.total).toBe(0)
    expect(review.importUseUnknownCallerCount).toBe(0)
    expect(review.importUseForbiddenClosureCount).toBe(0)
    expect(review.canCloseToolRuntimeGate).toBe(true)
    expect(review.mustNotStageOrRestore).toBe(false)
    expect(review.batches).toEqual([])
    expect(review.nextAction).toBe('tool-runtime-gate-closed')
  })

  test('writes current tool runtime review without changing git state', async () => {
    const review = await runToolRuntimeDirtyReviewHarness()

    expect(review.evidencePath).toContain('tool-runtime-dirty-review.evidence.json')
    expect(review.tracePath).toContain('tool-runtime-dirty-review.trace.json')
    expect(existsSync(review.evidencePath)).toBe(true)
    expect(existsSync(review.tracePath)).toBe(true)
    expect(review.status).toBe('PARTIAL')
    expect(review.total).toBeGreaterThan(0)
    expect(review.importUseUnknownCallerCount).toBe(0)
    expect(review.importUseForbiddenClosureCount).toBe(0)
    expect(review.nextAction).toBe('collapse-support-services')
    expect(review.batches.length).toBeGreaterThanOrEqual(4)
    expect(review.highDuplicateRiskBatchCount).toBeGreaterThanOrEqual(1)
    expect(review.supportServiceSliceCount).toBeGreaterThanOrEqual(4)
    expect(review.supportServiceSharedHelperCount).toBeGreaterThan(0)
    expect(review.supportServiceHighRiskProofCount).toBe(3)
    expect(review.supportServiceSharedOwnerSliceCount).toBeGreaterThan(0)
    expect(review.supportServiceUnassignedSharedHelperCount).toBe(0)
    expect(review.commandSurfaceSliceCount).toBeGreaterThan(0)
    expect(review.commandSurfaceUnassignedCount).toBe(0)
    expect(review.toolCoreSliceCount).toBeGreaterThan(0)
    expect(review.toolCoreUnassignedCount).toBe(0)
    expect(review.agentToolSliceCount).toBeGreaterThan(0)
    expect(review.agentToolUnassignedCount).toBe(0)
    expect(review.externalIntegrationSliceCount).toBeGreaterThan(0)
    expect(review.externalIntegrationUnassignedCount).toBe(0)
    const permissionSlice = review.batches
      .flatMap(batch => batch.supportSlices ?? [])
      .find(slice => slice.id === 'TRR-01A')
    const providerSlice = review.batches
      .flatMap(batch => batch.supportSlices ?? [])
      .find(slice => slice.id === 'TRR-01B')
    const mcpSkillSlice = review.batches
      .flatMap(batch => batch.supportSlices ?? [])
      .find(slice => slice.id === 'TRR-01C')
    const mediumOwnerSlices = review.batches
      .flatMap(batch => batch.supportSlices ?? [])
      .filter(slice => ['TRR-01D', 'TRR-01E', 'TRR-01F', 'TRR-01G'].includes(slice.id))
    const sharedUtilitySlice = review.batches
      .flatMap(batch => batch.supportSlices ?? [])
      .find(slice => slice.id === 'TRR-01H')
    const toolCoreImportUseSlices = review.batches
      .flatMap(batch => batch.toolCoreSlices ?? [])
      .filter(slice => ['TRR-03A', 'TRR-03B', 'TRR-03C', 'TRR-03D', 'TRR-03E', 'TRR-03F', 'TRR-03G', 'TRR-03H'].includes(slice.id))
    const agentToolImportUseSlices = review.batches
      .flatMap(batch => batch.agentToolSlices ?? [])
      .filter(slice => ['TRR-04A', 'TRR-04B', 'TRR-04C', 'TRR-04D', 'TRR-04E'].includes(slice.id))
    const externalIntegrationImportUseSlices = review.batches
      .flatMap(batch => batch.externalIntegrationSlices ?? [])
      .filter(slice => ['TRR-05A', 'TRR-05B', 'TRR-05C', 'TRR-05D'].includes(slice.id))
    expect(permissionSlice?.mainlineImportUseProof?.importUseScan?.totalCallerCount).toBeGreaterThan(0)
    expect(permissionSlice?.mainlineImportUseProof?.importUseScan?.status).toBe('PASS')
    expect(permissionSlice?.mainlineImportUseProof?.importUseScan?.forbiddenCallerCount).toBe(0)
    expect(permissionSlice?.mainlineImportUseProof?.importUseScan?.unknownCallerCount).toBe(0)
    expect(providerSlice?.mainlineImportUseProof?.importUseScan?.scanId).toBe('TRR-01B-provider-cost-import-use')
    expect(providerSlice?.mainlineImportUseProof?.importUseScan?.status).toBe('PASS')
    expect(providerSlice?.mainlineImportUseProof?.importUseScan?.forbiddenCallerCount).toBe(0)
    expect(providerSlice?.mainlineImportUseProof?.importUseScan?.unknownCallerCount).toBe(0)
    expect(mcpSkillSlice?.mainlineImportUseProof?.importUseScan?.scanId).toBe('TRR-01C-mcp-skill-registry-import-use')
    expect(mcpSkillSlice?.mainlineImportUseProof?.importUseScan?.status).toBe('PASS')
    expect(mcpSkillSlice?.mainlineImportUseProof?.importUseScan?.forbiddenCallerCount).toBe(0)
    expect(mcpSkillSlice?.mainlineImportUseProof?.importUseScan?.unknownCallerCount).toBe(0)
    expect(mediumOwnerSlices.map(slice => slice.mainlineImportUseProof?.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS'])
    expect(mediumOwnerSlices.reduce((sum, slice) => sum + (slice.mainlineImportUseProof?.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(mediumOwnerSlices.reduce((sum, slice) => sum + (slice.mainlineImportUseProof?.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(sharedUtilitySlice?.sharedUtilityImportUseScan?.scanId).toBe('TRR-01H-shared-runtime-utilities-import-use')
    expect(sharedUtilitySlice?.sharedUtilityImportUseScan?.totalCallerCount).toBeGreaterThan(0)
    expect(sharedUtilitySlice?.sharedUtilityImportUseScan?.forbiddenClosureCount).toBe(0)
    expect(toolCoreImportUseSlices.map(slice => slice.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS'])
    expect(toolCoreImportUseSlices.map(slice => slice.importUseScan?.scanId)).toEqual([
      'TRR-03A-shell-execution-tool-import-use',
      'TRR-03B-file-source-tool-import-use',
      'TRR-03C-mcp-skill-resource-tool-import-use',
      'TRR-03D-plan-task-workflow-tool-import-use',
      'TRR-03E-worktree-config-control-tool-import-use',
      'TRR-03F-web-network-tool-import-use',
      'TRR-03G-evidence-output-tool-import-use',
      'TRR-03H-test-compat-tool-import-use',
    ])
    expect(toolCoreImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(toolCoreImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(agentToolImportUseSlices.map(slice => slice.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS'])
    expect(agentToolImportUseSlices.map(slice => slice.importUseScan?.scanId)).toEqual([
      'TRR-04A-agent-entry-lifecycle-import-use',
      'TRR-04B-agent-execution-runner-import-use',
      'TRR-04C-agent-registry-prompt-import-use',
      'TRR-04D-agent-memory-context-import-use',
      'TRR-04E-agent-visible-state-import-use',
    ])
    expect(agentToolImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(agentToolImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(externalIntegrationImportUseSlices.map(slice => slice.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS'])
    expect(externalIntegrationImportUseSlices.map(slice => slice.importUseScan?.scanId)).toEqual([
      'TRR-05A-native-runtime-adapter-import-use',
      'TRR-05B-plugin-bundle-adapter-import-use',
      'TRR-05C-direct-connect-server-adapter-import-use',
      'TRR-05D-product-compat-adapter-import-use',
    ])
    expect(externalIntegrationImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(externalIntegrationImportUseSlices.reduce((sum, slice) => sum + (slice.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(review.batches.find(batch => batch.id === 'TRR-02')?.commandSurfaceSlices?.some(slice => slice.canKeepAsGenericCommandBucket === false)).toBe(true)
    expect(review.duplicationDecisionStatus).toBe('PARTIAL')
    expect(review.duplicationDecisionBatchCount).toBeGreaterThanOrEqual(4)
    expect(review.mustNotStageOrRestore).toBe(true)
  }, 60_000)
})
