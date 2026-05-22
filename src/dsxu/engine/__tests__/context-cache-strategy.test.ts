import { describe, expect, test } from 'bun:test'
import { SYSTEM_PROMPT_DYNAMIC_BOUNDARY } from '../../../constants/prompts'
import { asSystemPrompt } from '../../../utils/systemPromptType'
import {
  PERSISTED_OUTPUT_TAG,
  processPreMappedToolResultBlock,
} from '../../../utils/toolResultStorage'
import {
  appendLedgerEvent,
  buildDSXUActiveFrame,
  createProgressLedger,
} from '../progress-ledger'
import { buildDSXUContextPressureDecision } from '../context-pressure-matrix'
import { recordDSXUQueryPromptPrefixCacheEvidence } from '../prompt-prefix-cache-evidence'

describe('V6 context and cache strategy', () => {
  test('preserves active-frame obligations across 70/85/95/99 context pressure bands', () => {
    for (const level of [70, 85, 95, 99]) {
      const decision = buildDSXUContextPressureDecision({
        tokenUsage: level,
        effectiveWindow: 100,
        postCompact: level >= 85,
        promptTooLongRecovered: level >= 99,
      })
      let ledger = createProgressLedger(`v6-context-${level}`, 'session-v6-context', 'verify')
      ledger = appendLedgerEvent(ledger, {
        kind: 'task_contract',
        owner: 'Query Loop / PlanGraph / Tool Gate',
        summary: `context pressure ${level}%`,
        eventId: `contract-${level}`,
        evidence: [`context-pressure:${level}`],
        metadata: {
          executionContract: {
            goal: 'Preserve V6 source truth and verification obligations under context pressure',
            risk: level >= 95 ? 'high' : 'medium',
            visibleTools: ['Grep', 'Read', 'Bash', 'Evidence'],
            verificationLevel: 'affected_tests',
          },
        },
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'edit_proof',
        owner: 'Tool Gate / VerificationKernel',
        summary: 'Context pressure must not erase pending verification',
        eventId: `edit-proof-${level}`,
        evidence: ['edit-proof:pending-verification'],
        metadata: {
          openObligations: [
            'rerun focused context/cache strategy tests',
            'attach cache evidence before final claim',
          ],
        },
      })
      ledger = appendLedgerEvent(ledger, {
        kind: 'cache',
        owner: 'DeepSeek route/cost/cache owner',
        summary: `${decision.bucket} cache-safe policy recorded`,
        eventId: `cache-${level}`,
        evidence: [
          `bucket:${decision.bucket}`,
          `cachePolicy:${decision.cachePolicy}`,
          `sourceTruthReread:${decision.sourceTruthReread}`,
        ],
        metadata: {
          contextUsedPercent: decision.contextUsedPercent,
          cachePolicy: decision.cachePolicy,
          recommendedAction: decision.recommendedAction,
          sourceTruthReread: decision.sourceTruthReread,
        },
      })

      const activeFrame = buildDSXUActiveFrame({ ledger })
      expect(decision.sourceTruthReread).toBe('required-before-edit-or-pass')
      expect(activeFrame.openObligations).toContain('verification required:affected_tests')
      expect(activeFrame.openObligations).toContain('rerun focused context/cache strategy tests')
      expect(activeFrame.guards).toEqual([])
    }
  })

  test('records stable prefix and dynamic tail cache evidence without leaking volatile prompt text', () => {
    const evidence = recordDSXUQueryPromptPrefixCacheEvidence({
      systemPrompt: asSystemPrompt([
        'DSXU stable rules: tool schema and model routing policy stay fixed.',
        'DSXU stable output contract: report status, evidence, and risks.',
        SYSTEM_PROMPT_DYNAMIC_BOUNDARY,
        'current_user_request=Fix one context pressure bug.',
        'tool_result_preview=only bounded preview belongs here.',
      ]),
      workflowKind: 'coding',
      routeReason: 'v6_context_cache_strategy',
      model: 'deepseek-v4-flash',
      querySource: 'v6-focused-test',
      turnCount: 4,
    })

    expect(evidence.boundaryFound).toBe(true)
    expect(evidence.status).toBe('CACHE_PREFIX_READY')
    expect(evidence.stablePrefixApproxTokens).toBeGreaterThan(0)
    expect(evidence.dynamicTailApproxTokens).toBeGreaterThan(0)
    expect(evidence.fullPromptHash).not.toBe(evidence.stablePrefixHash)
    expect(JSON.stringify(evidence)).not.toContain('Fix one context pressure bug')
  })

  test('artifacts large tool results before they can inflate the DeepSeek dynamic tail', async () => {
    const largeResult = '工具输出-'.repeat(600)
    const mapped = await processPreMappedToolResultBlock({
      type: 'tool_result',
      tool_use_id: 'v6-context-large-tool-result',
      content: largeResult,
    }, 'Bash', 512)
    const content = String(mapped.content)

    expect(content).toStartWith(PERSISTED_OUTPUT_TAG)
    expect(content).toContain('Full output saved to:')
    expect(content.length).toBeLessThan(largeResult.length)
    expect(content).not.toContain(largeResult)
  })
})
