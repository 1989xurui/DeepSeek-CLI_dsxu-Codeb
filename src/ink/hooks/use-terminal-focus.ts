import { useContext } from 'react'
import TerminalFocusContext from '../components/TerminalFocusContext.js'

/**
 * Hook to check if the terminal has focus.
 *
 * Uses DECSET 1004 focus reporting - the terminal sends escape sequences
 * when it gains or loses focus. These are handled automatically
 * by Ink and filtered from useInput.
 *
 * @returns true if the terminal is focused (or focus state is unknown)
 */
export function useTerminalFocus(): boolean {
  const { isTerminalFocused } = useContext(TerminalFocusContext)
  return isTerminalFocused
}


// V14 lifecycle shim: use-terminal-focus
export function processUseTerminalFocusLifecycle(input) {
  void input
  const state = 'use-terminal-focus-state'
  const lifecycle = 'use-terminal-focus:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
