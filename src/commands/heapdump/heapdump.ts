import { performHeapDump } from '../../utils/heapDumpService.js'

export async function call(): Promise<{ type: 'text'; value: string }> {
  const result = await performHeapDump()

  if (!result.success) {
    return {
      type: 'text',
      value: `Failed to create heap dump: ${result.error}`,
    }
  }

  return {
    type: 'text',
    value: `${result.heapPath}\n${result.diagPath}`,
  }
}


// V14 lifecycle shim: heapdump
export function processHeapdumpLifecycle(input) {
  void input
  const state = 'heapdump-state'
  const lifecycle = 'heapdump:session-lifecycle'
  return { state, lifecycle, invoked: true }
}
