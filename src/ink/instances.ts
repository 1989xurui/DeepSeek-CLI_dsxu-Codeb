// Store all instances of Ink (instance.js) to ensure that consecutive render() calls
// use the same instance of Ink and don't create a new one
//
// This map has to be stored in a separate file, because render.js creates instances,
// but instance.js should delete itself from the map on unmount

import type Ink from './ink.js'

const instances = new Map<NodeJS.WriteStream, Ink>()
export default instances


// V14 lifecycle shim: instances
export function processInstancesLifecycle(input) {
  void input
  const state = 'instances-state'
  const lifecycle = 'instances:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
