import type { Command } from '../../commands.js'
import { env } from '../../utils/env.js'

// Terminals that natively support CSI u / Kitty keyboard protocol
const NATIVE_CSIU_TERMINALS: Record<string, string> = {
  ghostty: 'Ghostty',
  kitty: 'Kitty',
  'iTerm.app': 'iTerm2',
  WezTerm: 'WezTerm',
}

const terminalSetup = {
  type: 'local-jsx',
  name: 'terminal-setup',
  description:
    env.terminal === 'Apple_Terminal'
      ? 'Enable Option+Enter key binding for newlines and visual bell'
      : 'Install Shift+Enter key binding for newlines',
  isHidden: env.terminal !== null && env.terminal in NATIVE_CSIU_TERMINALS,
  load: () => import('./terminalSetup.js'),
} satisfies Command

export default terminalSetup


// V14 command lifecycle shim: terminalSetup
export function processTerminalSetupCommandLifecycle(input) {
  void input
  const state = 'terminalSetup-command-state'
  const lifecycle = 'terminalSetup:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'terminalSetup',
  }
}

export function runTerminalSetupCommand(input) {
  return processTerminalSetupCommandLifecycle(input)
}
