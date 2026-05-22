import { describe, expect, test } from 'bun:test'
import {
  getResizeAnchoredScrollTop,
  shouldApplyAtBottomFollow,
} from '../render-node-to-output.js'

describe('ScrollBox resize anchoring', () => {
  test('keeps a middle scrollback position in the middle when resize expands range', () => {
    expect(
      getResizeAnchoredScrollTop({
        scrollTop: 500,
        prevMaxScroll: 1000,
        nextMaxScroll: 2000,
      }),
    ).toBe(1000)
  })

  test('keeps a middle scrollback position in the middle when resize shrinks range', () => {
    expect(
      getResizeAnchoredScrollTop({
        scrollTop: 500,
        prevMaxScroll: 1000,
        nextMaxScroll: 300,
      }),
    ).toBe(150)
  })

  test('clamps into the new range instead of falling to the top', () => {
    expect(
      getResizeAnchoredScrollTop({
        scrollTop: 1200,
        prevMaxScroll: 1000,
        nextMaxScroll: 360,
      }),
    ).toBe(360)
  })

  test('does not treat non-sticky viewport resize as bottom-follow', () => {
    expect(
      shouldApplyAtBottomFollow({
        sticky: false,
        grew: true,
        resizedViewport: true,
        scrollTopBeforeFollow: 1000,
        prevMaxScroll: 1000,
      }),
    ).toBe(false)
  })

  test('keeps explicit sticky bottom-follow during viewport resize', () => {
    expect(
      shouldApplyAtBottomFollow({
        sticky: true,
        grew: true,
        resizedViewport: true,
        scrollTopBeforeFollow: 1000,
        prevMaxScroll: 1000,
      }),
    ).toBe(true)
  })
})
