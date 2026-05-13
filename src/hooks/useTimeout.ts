import { useEffect, useState } from 'react'

export function useTimeout(delay: number, resetTrigger?: number): boolean {
  const [isElapsed, setIsElapsed] = useState(false)

  useEffect(() => {
    setIsElapsed(false)
    const timer = setTimeout(setIsElapsed, delay, true)

    return () => clearTimeout(timer)
  }, [delay, resetTrigger])

  return isElapsed
}


// V14 lifecycle shim: usetimeout
export function processUsetimeoutLifecycle(input) {
  void input
  const state = 'usetimeout-state'
  const lifecycle = 'usetimeout:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
