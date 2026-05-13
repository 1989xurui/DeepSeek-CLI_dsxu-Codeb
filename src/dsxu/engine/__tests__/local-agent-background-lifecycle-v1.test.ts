import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runLocalAgentBackgroundLifecycleHarness } from '../../integration/harness/local-agent-background-lifecycle-v1-harness'

describe('Local Agent background lifecycle V1', () => {
  test('marks task completed before worktree/notification embellishment can create fake waiting', async () => {
    const result = await runLocalAgentBackgroundLifecycleHarness({
      nowIso: '2026-05-07T07:10:00.000+08:00',
    })

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.status).toBe('DONE-EVIDENCED')
    expect(result.acceptance).toMatchObject({
      pendingContinuationInjected: true,
      taskCompletedBeforeWorktreeResult: true,
      taskOutputCanUnblockBeforeNotification: true,
      notificationEnqueuedAfterWorktreeResult: true,
      workerEvidencePacketComplete: true,
      notificationCarriesTaskIdAndOutputPath: true,
    })
    expect(result.timeline.map(item => item.event)).toEqual([
      'continuation.drained',
      'worktree.started',
      'worktree.resolved',
      'lifecycle.completed',
    ])
    expect(result.timeline.find(item => item.event === 'worktree.started')).toMatchObject({
      status: 'completed',
      queueLength: 0,
    })
    expect(result.notification).toContain('<task-notification>')
    expect(result.notification).toContain('<status>completed</status>')
    expect(result.notification).toContain('<worktreePath>D:/tmp/dsxu-local-agent-background-lifecycle</worktreePath>')
    expect(result.renderedEvidence).toContain('completion_claim: complete')
    expect(result.renderedEvidence).toContain(
      'bun test src/dsxu/engine/__tests__/local-agent-background-lifecycle-v1.test.ts',
    )
    expect(existsSync(result.evidencePath)).toBe(true)
    expect(existsSync(result.tracePath)).toBe(true)
  })
})
