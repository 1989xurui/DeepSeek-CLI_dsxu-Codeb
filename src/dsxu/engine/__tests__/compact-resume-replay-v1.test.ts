import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { runCompactResumeReplayHarness } from '../../integration/harness/compact-resume-replay-v1-harness'

describe('compact resume replay V1', () => {
  test('preserves compact recovery evidence and resumes through source truth before verification', async () => {
    const result = await runCompactResumeReplayHarness()

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true)
    expect(result.schemaVersion).toBe('dsxu.compact-recovery.v1')
    expect(result.renderedSnapshot).toContain('<dsxu_compact_recovery_snapshot>')
    expect(result.events).toEqual([
      'fixture_created',
      'compact_snapshot_rendered',
      'resume_plan_created',
      'source_truth_reread',
      'source_edited_after_resume',
      'focused_verify_passed',
    ])
    expect(result.readBeforeEdit).toBe(true)
    expect(result.verifiedAfterResume).toBe(true)
    expect(result.mayClaimPassBeforeVerify).toBe(false)
    expect(result.sourceTruthRefreshRequired).toBe(true)
    expect(result.preservedUserInstructions).toBe(true)
    expect(result.preservedFailedCommand).toBe(true)
    expect(result.preservedPermissionDenial).toBe(true)
    expect(result.preservedPendingAgent).toBe(true)
    expect(`${result.stdout}\n${result.stderr}`).toContain('1 pass')
    expect(existsSync(result.tracePath)).toBe(true)
    expect(existsSync(result.evidencePath)).toBe(true)
  })
})
