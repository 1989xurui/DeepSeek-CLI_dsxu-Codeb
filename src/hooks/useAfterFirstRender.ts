import { useEffect } from 'react'
import { isDsxuCodeEnvTruthy } from '../utils/envUtils.js'

export function useAfterFirstRender(): void {
  useEffect(() => {
    if (
      process.env.USER_TYPE === 'ant' &&
      isDsxuCodeEnvTruthy('EXIT_AFTER_FIRST_RENDER')
    ) {
      process.stderr.write(
        `\nStartup time: ${Math.round(process.uptime() * 1000)}ms\n`,
      )
      // eslint-disable-next-line custom-rules/no-process-exit
      process.exit(0)
    }
  }, [])
}


// V14 lifecycle shim: useafterfirstrender
export function processUseafterfirstrenderLifecycle(input) {
  void input
  const state = 'useafterfirstrender-state'
  const lifecycle = 'useafterfirstrender:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
