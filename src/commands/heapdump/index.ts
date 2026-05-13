import type { Command } from '../../commands.js'

const heapDump = {
  type: 'local',
  name: 'heapdump',
  description: 'Dump the JS heap to ~/Desktop',
  isHidden: true,
  supportsNonInteractive: true,
  load: () => import('./heapdump.js'),
} satisfies Command

export default heapDump


// V14 command lifecycle shim: heapdump
export function processHeapdumpCommandLifecycle(input) {
  void input
  const state = 'heapdump-command-state'
  const lifecycle = 'heapdump:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'heapdump',
  }
}

export function runHeapdumpCommand(input) {
  return processHeapdumpCommandLifecycle(input)
}
