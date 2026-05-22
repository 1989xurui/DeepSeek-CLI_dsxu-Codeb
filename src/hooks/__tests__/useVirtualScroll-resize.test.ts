import { describe, expect, test } from 'bun:test'
import {
  getResizeFrozenRange,
  isEffectivelyStickyScroll,
} from '../useVirtualScroll.js'

describe('useVirtualScroll resize behavior', () => {
  test('does not freeze the old mounted range while sticky to bottom', () => {
    expect(getResizeFrozenRange(true, 2, [10, 30])).toBeNull()
  })

  test('freezes the old range only when the user is reading scrollback', () => {
    expect(getResizeFrozenRange(false, 2, [10, 30])).toEqual([10, 30])
    expect(getResizeFrozenRange(false, 0, [10, 30])).toBeNull()
  })

  test('treats a visually bottom-pinned viewport as sticky even if the flag was broken', () => {
    expect(
      isEffectivelyStickyScroll({
        isSticky: false,
        scrollTop: 198,
        pendingDelta: 0,
        viewportHeight: 20,
        scrollHeight: 220,
      }),
    ).toBe(true)
  })

  test('does not treat an active upward scrollback position as sticky', () => {
    expect(
      isEffectivelyStickyScroll({
        isSticky: false,
        scrollTop: 120,
        pendingDelta: -10,
        viewportHeight: 20,
        scrollHeight: 220,
      }),
    ).toBe(false)
  })
})
