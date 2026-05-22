import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildDSXUCapabilityRegistry,
  compileDSXUCapabilityActivationPlan,
  getDSXUCapabilityEntry,
  resolveDSXUToolCapabilityExposure,
} from '../capability-registry'
import {
  buildToolResultContractConsumptionBoard,
  ensureCanonicalToolCallResult,
  type ToolCallResult,
} from '../tool-protocol'

describe('V6 tool protocol ownership', () => {
  test('marks legacy ToolBus as non-default and claim-blocked', () => {
    const registry = buildDSXUCapabilityRegistry()
    const legacy = getDSXUCapabilityEntry(registry, 'tool-bus.legacy')

    expect(legacy).toMatchObject({
      owner: 'Tool Protocol Governance',
      exposure: 'legacy',
      claimPolicy: 'claim_blocked',
    })
    expect(legacy?.sourcePaths).toContain('src/dsxu/engine/tool-bus/index.ts')
    expect(resolveDSXUToolCapabilityExposure('LegacyToolBus', registry)).toBe('legacy')
    expect(resolveDSXUToolCapabilityExposure('ToolBusExecutor', registry)).toBe('legacy')
  })

  test('blocks explicit legacy ToolBus activation from the V6 default chain', () => {
    const plan = compileDSXUCapabilityActivationPlan({
      taskType: 'single_file_edit',
      explicitCapabilityIds: ['tool-bus.legacy'],
    })

    expect(plan.activeCapabilityIds).not.toContain('tool-bus.legacy')
    expect(plan.blockedCapabilityIds).toContain('tool-bus.legacy')
    expect(plan.guards).toContain('blocked non-default capability:tool-bus.legacy:legacy')
  })

  test('keeps query loop and Tool View off the legacy ToolBus import path', () => {
    const repoRoot = join(import.meta.dir, '..', '..', '..', '..')
    const queryLoop = readFileSync(join(repoRoot, 'src/dsxu/engine/query-loop.ts'), 'utf8')
    const toolView = readFileSync(join(repoRoot, 'src/dsxu/engine/tool-catalog-v1.ts'), 'utf8')
    const defaultPath = `${queryLoop}\n${toolView}`

    expect(defaultPath).not.toMatch(/from ['"]\.\/tool-bus(?:\/index)?['"]/)
    expect(defaultPath).not.toMatch(/from ['"]\.\/tool-bus\//)
    expect(defaultPath).toContain('compileDSXUToolView')
    expect(defaultPath).toContain('resolveDSXUToolCapabilityExposure')
  })

  test('keeps ToolCallResult as the canonical owner contract', () => {
    const result: ToolCallResult = {
      ok: true,
      outputText: 'ok',
      events: [],
      metadata: {
        duration: 12,
        executorKind: 'dsxu_native',
        usedBridge: false,
      },
    }
    const canonical = ensureCanonicalToolCallResult(result)
    const board = buildToolResultContractConsumptionBoard({
      result,
      boundaryKind: 'native',
      consumers: [
        {
          consumer: 'work-state',
          owner: 'Tool Gate',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['work-state:tool-result-contract'],
        },
        {
          consumer: 'ledger',
          owner: 'Tool Gate',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['ledger:tool-result-contract'],
        },
        {
          consumer: 'recovery',
          owner: 'Recovery',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['recovery:tool-result-contract'],
        },
        {
          consumer: 'tui',
          owner: 'TUI Trust Surface',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['tui:tool-result-contract'],
        },
        {
          consumer: 'final-report',
          owner: 'Final Report',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['final-report:tool-result-contract'],
        },
        {
          consumer: 'release-evidence',
          owner: 'Release Claim Binder',
          usesCanonicalResult: true,
          canonicalResultSchema: 'dsxu.tool-call-result.v1',
          runtimeEventSchema: 'dsxu.runtime-event.v1',
          evidenceIds: ['release-evidence:tool-result-contract'],
        },
      ],
    })

    expect(canonical.schemaVersion).toBe('dsxu.tool-call-result.v1')
    expect(board.status).toBe('PASS_TOOL_RESULT_CONTRACT_CONSUMPTION')
    expect(board.missingConsumers).toEqual([])
    expect(board.finalReportSection.status).toBe('ready')
  })
})
