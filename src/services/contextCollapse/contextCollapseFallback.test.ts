import { describe, expect, test } from 'bun:test'
import {
  applyCollapsesIfNeeded,
  getStats,
  initContextCollapse,
  isContextCollapseEnabled,
  isWithheldPromptTooLong,
  recoverFromOverflow,
  resetContextCollapse,
  subscribe,
} from './index'
import { projectView } from './operations'
import { restoreFromEntries } from './persist'

describe('DSXU context-collapse runtime guard', () => {
  test('keeps context-collapse disabled and leaves autocompact as owner', () => {
    expect(isContextCollapseEnabled()).toBe(false)
    expect(getStats().health.disabledReason).toContain('autocompact')
  })

  test('preserves messages across query, overflow, and context command projections', async () => {
    const messages = [
      { type: 'user', uuid: 'u1', message: { content: 'hello' } },
      { type: 'assistant', uuid: 'a1', message: { content: 'world' } },
    ]

    await expect(applyCollapsesIfNeeded(messages)).resolves.toMatchObject({
      messages,
      committed: 0,
      staged: 0,
    })
    expect(recoverFromOverflow(messages)).toEqual({
      messages,
      committed: 0,
    })
    expect(projectView(messages)).toBe(messages)
  })

  test('does not withhold prompt-too-long recovery messages without an active collapse owner', () => {
    expect(isWithheldPromptTooLong()).toBe(false)
  })

  test('supports setup, resume restore, reset, and token warning subscriptions without runtime crashes', () => {
    let notifications = 0
    const unsubscribe = subscribe(() => {
      notifications += 1
    })

    initContextCollapse()
    restoreFromEntries([], undefined)
    resetContextCollapse()
    unsubscribe()
    resetContextCollapse()

    expect(notifications).toBe(3)
  })
})
