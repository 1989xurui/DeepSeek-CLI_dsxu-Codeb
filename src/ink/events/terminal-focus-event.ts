import { Event } from './event.js'

export type TerminalFocusEventType = 'terminalfocus' | 'terminalblur'

/**
 * Event fired when the terminal window gains or loses focus.
 *
 * Uses DECSET 1004 focus reporting - the terminal sends:
 * - CSI I (\x1b[I) when the terminal gains focus
 * - CSI O (\x1b[O) when the terminal loses focus
 */
export class TerminalFocusEvent extends Event {
  readonly type: TerminalFocusEventType

  constructor(type: TerminalFocusEventType) {
    super()
    this.type = type
  }
}


// V14 lifecycle shim: terminal-focus-event
export function processTerminalFocusEventLifecycle(input) {
  void input
  const state = 'terminal-focus-event-state'
  const lifecycle = 'terminal-focus-event:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
