import { describe, expect, test } from 'bun:test'
import {
  buildCompactRecoverySnapshot,
  renderCompactRecoverySnapshot,
  renderCompactRecoverySchemaContract,
} from '../compact'
import {
  getDsxuSessionMemoryPromptRuntimeProfile,
  truncateSessionMemoryForCompact,
} from '../../../services/SessionMemory/prompts'
import { getDsxuSessionMemoryRuntimeProfile } from '../../../services/SessionMemory/sessionMemory'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('DSXU V8 memory resume contract', () => {
  test('compact recovery snapshot preserves unfinished work and requires source reread before continuing', () => {
    const snapshot = buildCompactRecoverySnapshot({
      primaryRequest: 'Finish the scoped mutation task after compact.',
      userInstructions: ['Work only inside tmp/v8-live-fixtures/current-case'],
      changedFiles: ['tmp/v8-live-fixtures/current-case/src/cart.js'],
      pendingTasks: ['rerun bun test after verifying cart.js on disk'],
      pendingAgents: ['verification-agent-1'],
      failedCommands: ['bun test -> Expected 32, Received 14'],
      permissionDenials: ['Edit outside fixture denied'],
      recoveryDecisions: ['Use source file reread, not memory text, before next Edit'],
      verificationStatus: 'partial',
      nextActions: [
        'Read tmp/v8-live-fixtures/current-case/src/cart.js',
        'Run bun test in the fixture',
      ],
    })

    const rendered = renderCompactRecoverySnapshot(snapshot)
    const contract = renderCompactRecoverySchemaContract()

    expect(rendered).toContain('dsxu.compact-recovery.v1')
    expect(rendered).toContain('verificationStatus')
    expect(rendered).toContain('partial')
    expect(rendered).toContain('Use source file reread')
    expect(rendered).not.toContain('"verificationStatus": "pass"')
    expect(contract).toContain('Do not drop user constraints')
  })

  test('SessionMemory profile remains a bounded hint layer, not a replacement for source evidence', () => {
    const runtime = getDsxuSessionMemoryRuntimeProfile()
    const prompt = getDsxuSessionMemoryPromptRuntimeProfile()

    expect(runtime.extractionPolicy).toContain('Read/Edit only')
    expect(runtime.activationEvidence.join('\n')).toContain('post-sampling hook')
    expect(prompt.activationEvidence.join('\n')).toContain('section analysis keeps notes bounded')
    expect(prompt.tokenBudgets.maxTotalSessionMemoryTokens).toBeGreaterThan(0)
  })

  test('oversized session memory is truncated before compact resume use', () => {
    const largeMemory = [
      '# Current State',
      'A'.repeat(40_000),
      '# Important Files',
      'tmp/v8-live-fixtures/current-case/src/cart.js',
      '# Open Questions',
      'Need to rerun bun test.',
    ].join('\n')

    const result = truncateSessionMemoryForCompact(largeMemory)

    expect(result.truncatedContent.length).toBeLessThan(largeMemory.length)
    expect(result.wasTruncated).toBe(true)
    expect(result.truncatedContent).toContain('Current State')
  })

  test('AutoDream uses lock, scan throttle, and rollback so resume memory cannot duplicate background work', () => {
    const autoDream = readFileSync(
      join(process.cwd(), 'src/services/autoDream/autoDream.ts'),
      'utf8',
    )
    const lock = readFileSync(
      join(process.cwd(), 'src/services/autoDream/consolidationLock.ts'),
      'utf8',
    )

    expect(autoDream).toContain('SESSION_SCAN_INTERVAL_MS')
    expect(autoDream).toContain('lastSessionScanAt')
    expect(autoDream).toContain('tryAcquireConsolidationLock()')
    expect(autoDream).toContain('rollbackConsolidationLock(priorMtime)')
    expect(autoDream).toContain('sessionIds = sessionIds.filter(id => id !== currentSession)')
    expect(lock).toContain('HOLDER_STALE_MS')
    expect(lock).toContain('isProcessRunning(holderPid)')
    expect(lock).toContain('Two reclaimers both write')
    expect(lock).toContain('priorMtime')
  })

  test('SessionMemory and compact resume keep verification state explicit before continuation', () => {
    const runtime = getDsxuSessionMemoryRuntimeProfile()
    const snapshot = renderCompactRecoverySnapshot(buildCompactRecoverySnapshot({
      primaryRequest: 'Continue after resume.',
      userInstructions: ['Never treat memory as source truth.'],
      changedFiles: ['tmp/v8-live-fixtures/resume/src/index.js'],
      pendingTasks: ['read source file before edit'],
      pendingAgents: [],
      failedCommands: ['bun test failed before compact'],
      permissionDenials: ['network execute denied'],
      recoveryDecisions: ['retry with local fixture command'],
      verificationStatus: 'fail',
      nextActions: ['Read tmp/v8-live-fixtures/resume/src/index.js', 'Run bun test'],
    }))

    expect(runtime.triggerSignals.join('\n')).toContain('auto-compact enabled state')
    expect(snapshot).toContain('"verificationStatus": "fail"')
    expect(snapshot).toContain('read source file before edit')
    expect(snapshot).toContain('network execute denied')
    expect(snapshot).not.toContain('"verificationStatus": "pass"')
  })
})
