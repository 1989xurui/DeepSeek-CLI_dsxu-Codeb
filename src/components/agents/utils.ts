import capitalize from 'lodash-es/capitalize.js'
import type { SettingSource } from 'src/utils/settings/constants.js'
import { getSettingSourceName } from 'src/utils/settings/constants.js'

export function getAgentSourceDisplayName(
  source: SettingSource | 'all' | 'built-in' | 'plugin',
): string {
  if (source === 'all') {
    return 'Agents'
  }
  if (source === 'built-in') {
    return 'Built-in agents'
  }
  if (source === 'plugin') {
    return 'Plugin agents'
  }
  return capitalize(getSettingSourceName(source))
}


// V14 strict lifecycle shim: components-agents-utils
export function processComponentsAgentsUtilsStrictLifecycle(input) {
  void input
  const state = 'components-agents-utils-state'
  const lifecycle = 'components-agents-utils:session-lifecycle'
  return {
    state,
    lifecycle,
    invoked: true,
  }
}

export function runComponentsAgentsUtilsStrict(input) {
  return processComponentsAgentsUtilsStrictLifecycle(input)
}
