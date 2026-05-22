import { describe, expect, test } from 'bun:test'
import {
  appendLedgerEvent,
  buildLongTaskLedgerProjection,
  createProgressLedger,
} from '../progress-ledger'

describe('V8 long-task work memory projection', () => {
  test('projects task/source/change/failure/claim ledgers into TUI and final report surfaces', () => {
    let ledger = createProgressLedger('v8-long-task', 'session-v8', 'verify')
    ledger = appendLedgerEvent(ledger, {
      kind: 'task_contract',
      owner: 'Query Loop / PlanGraph / Tool Gate',
      summary: 'long_task via flash_max',
      evidence: ['taskType:long_task'],
      metadata: {
        executionContract: {
          risk: 'high',
          visibleTools: ['Read', 'Grep', 'Todo', 'Agent', 'Bash'],
          verificationLevel: 'full',
        },
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'source_evidence',
      owner: 'Source Truth',
      summary: 'read owner file',
      evidence: ['src/dsxu/engine/action-contract.ts:245'],
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'edit_proof',
      owner: 'Tool Gate',
      summary: 'patched V8 classifier',
      metadata: {
        filesChanged: ['src/dsxu/engine/action-contract.ts'],
      },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'stall',
      owner: 'Recovery / GearBox',
      summary: 'verification failed once',
      metadata: { ok: false },
    })
    ledger = appendLedgerEvent(ledger, {
      kind: 'verification',
      owner: 'VerificationKernel',
      summary: 'focused V8 contract tests passed',
      evidence: ['23 pass / 0 fail'],
    })

    const projection = buildLongTaskLedgerProjection(ledger)

    expect(projection.workMemory.task).toEqual(expect.arrayContaining(['v8-long-task', 'long_task via flash_max']))
    expect(projection.workMemory.sourceTruth).toEqual(expect.arrayContaining(['src/dsxu/engine/action-contract.ts:245']))
    expect(projection.workMemory.changes).toEqual(expect.arrayContaining(['patched V8 classifier', 'src/dsxu/engine/action-contract.ts']))
    expect(projection.workMemory.failures).toEqual(expect.arrayContaining(['verification failed once']))
    expect(projection.workMemory.claims).toEqual(expect.arrayContaining(['focused V8 contract tests passed', '23 pass / 0 fail']))
    expect(projection.tuiLines.join('\n')).toContain('Memory: task=')
    expect(projection.finalReportSection.summary.join('\n')).toContain('workMemory=task:')
  })
})
