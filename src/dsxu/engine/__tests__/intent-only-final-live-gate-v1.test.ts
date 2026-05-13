import { describe, expect, test } from 'bun:test'
import { buildDsxuIntentOnlyFinalNudge } from '../../../query'

function assistantText(text: string) {
  return {
    type: 'assistant',
    message: {
      role: 'assistant',
      id: 'assistant-intent-only-live',
      content: [
        {
          type: 'text',
          text,
        },
      ],
    },
    uuid: 'assistant-intent-only-live',
  } as any
}

describe('intent-only final live gate V1', () => {
  test('blocks numbered tool-step text that would otherwise wait for user continue', () => {
    const nudge = buildDsxuIntentOnlyFinalNudge([
      assistantText('Step 1: Read `src/pricing.js`.'),
    ])

    expect(nudge).toContain('DSXU intent-only final gate')
    expect(nudge).toContain('emitted no tool call')
    expect(nudge).toContain('Do not wait for the user to type continue')
  })

  test('blocks fraction-style numbered cursor text from live resume runs', () => {
    const nudge = buildDsxuIntentOnlyFinalNudge([
      assistantText('Step 4/6: Edit src/pricing.js.'),
    ])

    expect(nudge).toContain('DSXU intent-only final gate')
  })

  test('blocks verification-intent text without a PowerShell tool call', () => {
    const nudge = buildDsxuIntentOnlyFinalNudge([
      assistantText('Both edits applied. Running verification now.'),
    ])

    expect(nudge).toContain('required_next')
  })

  test('blocks post-edit now-running verification promises from live runner output', () => {
    const nudge = buildDsxuIntentOnlyFinalNudge([
      assistantText('The edit applied successfully. Now running `bun test` to verify.'),
    ])

    expect(nudge).toContain('DSXU intent-only final gate')
    expect(nudge).toContain('Do not wait for the user to type continue')
  })

  test('blocks post-pass add/update promises from Flash live output', () => {
    const nudge = buildDsxuIntentOnlyFinalNudge([
      assistantText([
        'The initial test confirmed the failure.',
        'Now I\'ll add `slugify` to `src/strings.js` with the correct transformation.',
      ].join('\n\n')),
    ])

    expect(nudge).toContain('DSXU intent-only final gate')
  })

  test('does not block explicit terminal status or PASS markers', () => {
    expect(
      buildDsxuIntentOnlyFinalNudge([
        assistantText('PARTIAL: no tool was run because the safe action is blocked.'),
      ]),
    ).toBeNull()
    expect(
      buildDsxuIntentOnlyFinalNudge([
        assistantText('DSXU_BENCH_TRUE_CLI_COMPACT_RESUME_PASS'),
      ]),
    ).toBeNull()
  })
})
