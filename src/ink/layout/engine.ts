import type { LayoutNode } from './node.js'
import { createYogaLayoutNode } from './yoga.js'

export function createLayoutNode(): LayoutNode {
  return createYogaLayoutNode()
}


// V14 lifecycle shim: engine
export function processEngineLifecycle(input) {
  void input
  const state = 'engine-state'
  const lifecycle = 'engine:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
