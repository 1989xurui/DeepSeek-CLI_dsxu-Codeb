import type { Command } from '../../commands.js'
import { getUsableApiKey } from '../../utils/authPortable.js'
import { isEnvTruthy } from '../../utils/envUtils.js'

function hasDsxuLimitProvider(): boolean {
  return (
    isEnvTruthy(process.env.DSXU_ENABLE_RATE_LIMIT_OPTIONS) ||
    getUsableApiKey(
      process.env.DSXU_API_KEY,
      process.env.DSXU_DEEPSEEK_API_KEY,
      process.env.DEEPSEEK_API_KEY,
      process.env.LITELLM_API_KEY,
    ) !== undefined ||
    process.env.LITELLM_BASE_URL !== undefined
  )
}

const rateLimitOptions = {
  type: 'local-jsx',
  name: 'rate-limit-options',
  description: 'Show DSXU cost and limit recovery options when a provider budget is reached',
  isEnabled: () => {
    if (!hasDsxuLimitProvider()) {
      return false
    }

    return true
  },
  isHidden: true, // Hidden from help - only used internally
  load: () => import('./rate-limit-options.js'),
} satisfies Command

export default rateLimitOptions


// V14 command lifecycle shim: rate-limit-options
export function processRateLimitOptionsCommandLifecycle(input) {
  void input
  const state = 'rate-limit-options-command-state'
  const lifecycle = 'rate-limit-options:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
    commandId: 'rate-limit-options',
  }
}

export function runRateLimitOptionsCommand(input) {
  return processRateLimitOptionsCommandLifecycle(input)
}
