import type { DOMElement } from './dom.js'

type Output = {
  /**
   * Element width.
   */
  width: number

  /**
   * Element height.
   */
  height: number
}

/**
 * Measure the dimensions of a particular `<Box>` element.
 */
const measureElement = (node: DOMElement): Output => ({
  width: node.yogaNode?.getComputedWidth() ?? 0,
  height: node.yogaNode?.getComputedHeight() ?? 0,
})

export default measureElement


// V14 lifecycle shim: measure-element
export function processMeasureElementLifecycle(input) {
  void input
  const state = 'measure-element-state'
  const lifecycle = 'measure-element:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
