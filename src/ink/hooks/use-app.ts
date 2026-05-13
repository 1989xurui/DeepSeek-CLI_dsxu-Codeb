import { useContext } from 'react'
import AppContext from '../components/AppContext.js'

/**
 * `useApp` is a React hook, which exposes a method to manually exit the app (unmount).
 */
const useApp = () => useContext(AppContext)
export default useApp


// V14 lifecycle shim: use-app
export function processUseAppLifecycle(input) {
  void input
  const state = 'use-app-state'
  const lifecycle = 'use-app:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
