import type { Command } from '../commands.js'
import type { LocalCommandCall } from '../types/command.js'

const MESSAGE =
  'Archived bridge debug injection is disabled. Remote provider aliases are handled by the DSXU provider contract and are blocked on the default local mainline.'

const call: LocalCommandCall = async () => ({
  type: 'text',
  value: MESSAGE,
})

const bridgeKick = {
  type: 'local',
  name: 'bridge-kick',
  description: 'Archived bridge debug command',
  isEnabled: () => false,
  supportsNonInteractive: false,
  load: () => Promise.resolve({ call }),
} satisfies Command

export default bridgeKick
