import { useContext } from 'react'
import StdinContext from '../components/StdinContext.js'

/**
 * `useStdin` is a React hook, which exposes stdin stream.
 */
const useStdin = () => useContext(StdinContext)
export default useStdin


// V14 lifecycle shim: use-stdin
export function processUseStdinLifecycle(input) {
  void input
  const state = 'use-stdin-state'
  const lifecycle = 'use-stdin:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
