import { useContext } from 'react'
import {
  type TerminalSize,
  TerminalSizeContext,
} from 'src/ink/components/TerminalSizeContext.js'

export function useTerminalSize(): TerminalSize {
  const size = useContext(TerminalSizeContext)

  if (!size) {
    throw new Error('useTerminalSize must be used within an Ink App component')
  }

  return size
}


// V14 lifecycle shim: useterminalsize
export function processUseterminalsizeLifecycle(input) {
  void input
  const state = 'useterminalsize-state'
  const lifecycle = 'useterminalsize:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
