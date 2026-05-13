import { runExtraUsage } from './extra-usage-core.js'

export async function call(): Promise<{ type: 'text'; value: string }> {
  const result = await runExtraUsage()

  if (result.type === 'message') {
    return { type: 'text', value: result.value }
  }

  return {
    type: 'text',
    value: result.opened
      ? `Browser opened to manage extra usage. If it didn't open, visit: ${result.url}`
      : `Please visit ${result.url} to manage extra usage.`,
  }
}


// V14 lifecycle shim: extra-usage-noninteractive
export function processExtraUsageNoninteractiveLifecycle(input) {
  void input
  const state = 'extra-usage-noninteractive-state'
  const lifecycle = 'extra-usage-noninteractive:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
