// Shared frame interval for render throttling and animations (~60fps)
export const FRAME_INTERVAL_MS = 16


// V14 strict lifecycle shim: ink-constants
export function processInkConstantsStrictLifecycle(input) {
  void input
  const state = 'ink-constants-state'
  const lifecycle = 'ink-constants:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runInkConstantsStrict(input) {
  return processInkConstantsStrictLifecycle(input)
}
