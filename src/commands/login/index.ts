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
        ? 'Switch provider migration accounts'
        : 'Sign in with a provider migration account',
    isEnabled: () => !isEnvTruthy(process.env.DISABLE_LOGIN_COMMAND),
    load: () => import('./login.js'),
  }) satisfies Command

export function getDsxuLoginCommandRuntimeProfile(): {
  runtime: 'DSXU Login Command'
  dsxuDescription: string
  providerMigrationPolicy: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Login Command',
    dsxuDescription: 'Configure DSXU model provider credentials',
    providerMigrationPolicy:
      'Provider migration wording is kept only outside DSXU runtime mode',
    activationEvidence: [
      'DSXU runtime mode replaces provider migration sign-in description',
      'DISABLE_LOGIN_COMMAND still disables the command globally',
      'command metadata remains the only login command owner surface',
    ],
  }
}
