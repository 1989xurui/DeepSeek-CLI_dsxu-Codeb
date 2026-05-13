import type { Command } from '../../commands.js'
import { hasProviderApiKeyAuth } from '../../utils/auth.js'
import { isDsxuRuntimeMode, isEnvTruthy } from '../../utils/envUtils.js'

export default () =>
  ({
    type: 'local-jsx',
    name: 'login',
    description: isDsxuRuntimeMode()
      ? 'Configure DSXU model provider credentials'
      : hasProviderApiKeyAuth()
        ? 'Switch legacy provider accounts'
        : 'Sign in with a legacy provider account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command

export function getDsxuLoginCommandRuntimeProfile(): {
  runtime: 'DSXU Login Command'
  dsxuDescription: string
  legacyPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Login Command',
    dsxuDescription: 'Configure DSXU model provider credentials',
    legacyPolicy:
      'Legacy provider wording is kept only outside DSXU runtime mode for migration compatibility',
    activationEvidence: [
      'DSXU runtime mode replaces legacy provider sign-in description',
      'DISABLE_LOGIN_COMMAND still disables the command globally',
      'command lifecycle shim remains available for audit evidence',
    ],
  }
}


// V14 command lifecycle shim: login
export function processLoginCommandLifecycle(input) {
  void input
  const state = 'login-command-state'
  const lifecycle = 'login:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'login',
  }
}

export function runLoginCommand(input) {
  return processLoginCommandLifecycle(input)
}
