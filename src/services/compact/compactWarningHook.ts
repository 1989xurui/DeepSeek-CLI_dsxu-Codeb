import { useSyncExternalStore } from 'react'
import { compactWarningStore } from './compactWarningState.js'

/**
 * React hook to subscribe to compact warning suppression state.
 *
 * Lives in its own file so that compactWarningState.ts stays React-free:
 * microCompact.ts imports the pure state functions, and pulling React into
 * that module graph would drag it into the print-mode startup path.
 */
export function useCompactWarningSuppression(): boolean {
  return useSyncExternalStore(
    compactWarningStore.subscribe,
    compactWarningStore.getState,
  )
}


// V14 lifecycle shim: compactwarninghook
export function processCompactwarninghookLifecycle(input) {
  void input
  const state = 'compactwarninghook-state'
  const lifecycle = 'compactwarninghook:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
