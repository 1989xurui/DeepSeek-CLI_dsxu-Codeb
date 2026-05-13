import { logForDebugging } from '../utils/debug.js'

export function ifNotInteger(value: number | undefined, name: string): void {
  if (value === undefined) return
  if (Number.isInteger(value)) return
  logForDebugging(`${name} should be an integer, got ${value}`, {
    level: 'warn',
  })
}


// V14 lifecycle shim: warn
export function processWarnLifecycle(input) {
  void input
  const state = 'warn-state'
  const lifecycle = 'warn:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
