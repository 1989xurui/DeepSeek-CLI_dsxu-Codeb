import {
  getDsxuCodeEnv,
  isDsxuCodeEnvTruthy,
  isEnvDefinedFalsy,
  isEnvTruthy,
} from '../../utils/envUtils.js'

export const REPL_TOOL_NAME = 'REPL'

/**
 * REPL mode is default-on for interactive CLI agents (opt out with
 * DSXU_CODE_REPL=0). The archived DSXU_REPL_MODE=1 also forces it on.
 *
 * SDK entrypoints (sdk-ts, sdk-py, sdk-cli) are NOT defaulted on — SDK
 * consumers script direct tool calls (Bash, Read, etc.) and REPL mode
 * hides those tools. USER_TYPE is a build-time --define, so the ant-native
 * binary would otherwise force REPL mode on every SDK subprocess regardless
 * of the env the caller passes.
 */
export function isReplModeEnabled(): boolean {
  if (isEnvDefinedFalsy(getDsxuCodeEnv('REPL'))) return false
  if (
    isDsxuCodeEnvTruthy('REPL_MODE') ||
    isEnvTruthy(process.env.DSXU_REPL_MODE) ||
    isDsxuCodeEnvTruthy('REPL')
  ) {
    return true
  }
  return (
    process.env.USER_TYPE === 'ant' &&
    getDsxuCodeEnv('ENTRYPOINT') === 'cli'
  )
}

/**
 * Tools that are only accessible via REPL when REPL mode is enabled.
 * When REPL mode is on, these tools are hidden from DSXU's direct use,
 * forcing DSXU to use REPL for batch operations.
 */
export const REPL_ONLY_TOOLS = new Set([
  'Read',
  'Write',
  'Edit',
  'Glob',
  'Grep',
  'Bash',
  'NotebookEdit',
  'Agent',
])
