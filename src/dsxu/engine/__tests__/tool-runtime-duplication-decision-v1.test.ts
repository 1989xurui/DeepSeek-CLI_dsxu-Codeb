import { existsSync } from 'fs'
import { describe, expect, test } from 'bun:test'
import { buildToolRuntimeDirtyReview } from '../tool-runtime-dirty-review-v1'
import { buildToolRuntimeDuplicationDecision } from '../tool-runtime-duplication-decision-v1'
import { buildV18DirtyQuarantineLedger } from '../v18-dirty-quarantine-ledger'
import { runToolRuntimeDuplicationDecisionHarness } from '../../integration/harness/tool-runtime-duplication-decision-v1-harness'

describe('TRR - Tool Runtime Duplication Decision V1', () => {
  test('marks old tool runtime groups as merge, delete-candidate, or keep-adapter decisions', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [
        ' M src/services/toolService.ts',
        ' M src/commands/run.ts',
        ' M src/tools/ShellTool.ts',
        ' M src/tools/AgentTool/AgentTool.tsx',
        ' M src/mcp/client.ts',
      ],
    })
    const review = buildToolRuntimeDirtyReview(ledger)
    const decision = buildToolRuntimeDuplicationDecision(review)

    expect(decision.schemaVersion).toBe('dsxu.tool-runtime-duplication-decision.v1')
    expect(decision.status).toBe('PARTIAL')
    expect(decision.total).toBe(5)
    expect(decision.mergeRequiredCount).toBe(3)
    expect(decision.replaceOrDeleteCandidateCount).toBe(1)
    expect(decision.keepAdapterCount).toBe(1)
    expect(decision.canCloseDuplicationGate).toBe(false)
    expect(decision.mustNotDeleteOrStage).toBe(true)
    expect(decision.batches.find(batch => batch.group === 'commands')?.canDeleteNow).toBe(false)
    expect(decision.batches.find(batch => batch.group === 'commands')?.commandSurfaceDecisions?.some(slice => slice.group === 'query-session-command')).toBe(true)
    expect(decision.unassignedCommandSurfaceCount).toBe(0)
    expect(decision.batches.find(batch => batch.group === 'tools-core')?.toolCoreDecisions?.some(slice => slice.group === 'shell-execution-tool')).toBe(true)
    expect(decision.unassignedToolCoreCount).toBe(0)
    expect(decision.batches.find(batch => batch.group === 'agent-tool')?.agentToolDecisions?.every(slice => slice.canKeepAsSecondAgentRuntime === false)).toBe(true)
    expect(decision.unassignedAgentToolCount).toBe(0)
    expect(decision.batches.find(batch => batch.group === 'external-integration')?.externalIntegrationDecisions?.every(slice => slice.canKeepAsStandaloneRuntime === false)).toBe(true)
    expect(decision.unassignedExternalIntegrationCount).toBe(0)
    expect(decision.batches.every(batch => batch.canKeepAsSeparateRuntime === false)).toBe(true)
    expect(decision.safeguards.join('\n')).toContain('no retained path may keep a second executor')
  })

  test('carries support-service owner slices into duplication decisions', () => {
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
    const decision = buildToolRuntimeDuplicationDecision(review)
    const supportDecision = decision.batches.find(batch => batch.sourceBatchId === 'TRR-01')

    expect(decision.supportServiceDecisionCount).toBe(8)
    expect(decision.highRiskImportUseProofCount).toBe(3)
    expect(decision.forbiddenRuntimeClosureCount).toBe(0)
    expect(decision.supportServiceSharedHelperCount).toBe(1)
    expect(supportDecision?.supportServiceDecisions?.map(slice => slice.sourceSliceId)).toEqual([
      'TRR-01A',
      'TRR-01B',
      'TRR-01C',
      'TRR-01D',
      'TRR-01E',
      'TRR-01F',
      'TRR-01G',
      'TRR-01H',
    ])
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01C')?.requiredProofBeforeClose.join('\n')).toContain('one registry/parser')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01A')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('second permission runtime')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01B')?.mainlineImportUseProof?.allowedConsumerOwners).toContain('Model Router')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01C')?.mainlineImportUseProof?.missingProofBeforeClose.join('\n')).toContain('single skills registry')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01D')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('second prompt owner')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01E')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('side-effect tools')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01F')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('tool execution decisions')
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01G')?.mainlineImportUseProof?.forbiddenBypass.join('\n')).toContain('decide tool execution')
    expect(supportDecision?.supportServiceDecisions?.filter(slice => slice.duplicateSystemRisk === 'high').every(slice => slice.mainlineImportUseProof?.canCloseWithoutImportUseReview === false)).toBe(true)
    expect(supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01H')?.canKeepAsGenericSupportBucket).toBe(false)
    expect(decision.sharedUtilityDecisionCount).toBe(1)
    expect(decision.unassignedSharedHelperCount).toBe(0)
    expect(decision.redlines.join('\n')).not.toContain('shared helper bucket still needs concrete owner assignment')
  })

  test('carries TRR-01H nested shared owner proof into duplication decisions', () => {
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
    const decision = buildToolRuntimeDuplicationDecision(review)
    const supportDecision = decision.batches.find(batch => batch.sourceBatchId === 'TRR-01')
    const sharedDecision = supportDecision?.supportServiceDecisions?.find(slice => slice.sourceSliceId === 'TRR-01H')

    expect(decision.supportServiceSharedHelperCount).toBe(9)
    expect(decision.sharedUtilityDecisionCount).toBe(9)
    expect(decision.unassignedSharedHelperCount).toBe(0)
    expect(sharedDecision?.sharedUtilityDecisions?.map(slice => slice.sourceSliceId)).toEqual([
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
    expect(sharedDecision?.sharedUtilityDecisions?.find(slice => slice.sourceSliceId === 'TRR-01H2')?.requiredProofBeforeClose.join('\n')).toContain('Tool Gate remains')
    expect(sharedDecision?.sharedUtilityDecisions?.every(slice => slice.canKeepAsGenericSupportBucket === false)).toBe(true)
  })

  test('passes only when tool runtime review is closed', () => {
    const ledger = buildV18DirtyQuarantineLedger({
      nowIso: '2026-05-12T00:00:00.000Z',
      lines: [' M src/components/App.tsx'],
    })
    const review = buildToolRuntimeDirtyReview(ledger)
    const decision = buildToolRuntimeDuplicationDecision(review)

    expect(decision.status).toBe('PASS')
    expect(decision.total).toBe(0)
    expect(decision.canCloseDuplicationGate).toBe(true)
    expect(decision.mustNotDeleteOrStage).toBe(false)
    expect(decision.batches).toEqual([])
    expect(decision.nextAction).toBe('duplication-gate-closed')
  })

  test('writes current duplication decision without changing git state', async () => {
    const decision = await runToolRuntimeDuplicationDecisionHarness()

    expect(decision.evidencePath).toContain('tool-runtime-duplication-decision.evidence.json')
    expect(decision.tracePath).toContain('tool-runtime-duplication-decision.trace.json')
    expect(existsSync(decision.evidencePath)).toBe(true)
    expect(existsSync(decision.tracePath)).toBe(true)
    expect(decision.status).toBe('PARTIAL')
    expect(decision.total).toBeGreaterThan(0)
    expect(decision.highDuplicateRiskCount).toBeGreaterThan(0)
    expect(decision.supportServiceDecisionCount).toBeGreaterThanOrEqual(4)
    expect(decision.highRiskImportUseProofCount).toBe(3)
    expect(decision.forbiddenRuntimeClosureCount).toBe(0)
    const highRiskDecisions = decision.batches
      .flatMap(batch => batch.supportServiceDecisions ?? [])
      .filter(decision => ['TRR-01A', 'TRR-01B', 'TRR-01C'].includes(decision.sourceSliceId))
    expect(highRiskDecisions.length).toBe(3)
    expect(highRiskDecisions
      .reduce((sum, decision) => sum + decision.forbiddenRuntimeClosureCount, 0)).toBe(decision.forbiddenRuntimeClosureCount)
    const mediumOwnerDecisions = decision.batches
      .flatMap(batch => batch.supportServiceDecisions ?? [])
      .filter(decision => ['TRR-01D', 'TRR-01E', 'TRR-01F', 'TRR-01G'].includes(decision.sourceSliceId))
    expect(mediumOwnerDecisions.map(decision => decision.mainlineImportUseProof?.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS'])
    expect(mediumOwnerDecisions.reduce((sum, decision) => sum + (decision.mainlineImportUseProof?.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(decision.supportServiceSharedHelperCount).toBeGreaterThan(0)
    expect(decision.sharedUtilityDecisionCount).toBeGreaterThan(0)
    expect(decision.commandSurfaceDecisionCount).toBeGreaterThan(0)
    expect(decision.unassignedCommandSurfaceCount).toBe(0)
    expect(decision.toolCoreDecisionCount).toBeGreaterThan(0)
    expect(decision.unassignedToolCoreCount).toBe(0)
    const toolCoreImportUseDecisions = decision.batches
      .flatMap(batch => batch.toolCoreDecisions ?? [])
      .filter(decision => ['TRR-03A', 'TRR-03B', 'TRR-03C', 'TRR-03D', 'TRR-03E', 'TRR-03F', 'TRR-03G', 'TRR-03H'].includes(decision.sourceSliceId))
    expect(toolCoreImportUseDecisions.map(decision => decision.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS', 'PASS'])
    expect(toolCoreImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(toolCoreImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(decision.agentToolDecisionCount).toBeGreaterThan(0)
    expect(decision.unassignedAgentToolCount).toBe(0)
    const agentToolImportUseDecisions = decision.batches
      .flatMap(batch => batch.agentToolDecisions ?? [])
      .filter(decision => ['TRR-04A', 'TRR-04B', 'TRR-04C', 'TRR-04D', 'TRR-04E'].includes(decision.sourceSliceId))
    expect(agentToolImportUseDecisions.map(decision => decision.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS', 'PASS'])
    expect(agentToolImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(agentToolImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(decision.externalIntegrationDecisionCount).toBeGreaterThan(0)
    expect(decision.unassignedExternalIntegrationCount).toBe(0)
    const externalIntegrationImportUseDecisions = decision.batches
      .flatMap(batch => batch.externalIntegrationDecisions ?? [])
      .filter(decision => ['TRR-05A', 'TRR-05B', 'TRR-05C', 'TRR-05D'].includes(decision.sourceSliceId))
    expect(externalIntegrationImportUseDecisions.map(decision => decision.importUseScan?.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS'])
    expect(externalIntegrationImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.unknownCallerCount ?? 0), 0)).toBe(0)
    expect(externalIntegrationImportUseDecisions.reduce((sum, decision) => sum + (decision.importUseScan?.forbiddenClosureCount ?? 0), 0)).toBe(0)
    expect(decision.batches
      .flatMap(batch => batch.supportServiceDecisions ?? [])
      .find(slice => slice.sourceSliceId === 'TRR-01H')
      ?.sharedUtilityImportUseScan?.scanId).toBe('TRR-01H-shared-runtime-utilities-import-use')
    expect(decision.unassignedSharedHelperCount).toBe(0)
    expect(decision.mustNotDeleteOrStage).toBe(true)
  }, 60_000)
})
