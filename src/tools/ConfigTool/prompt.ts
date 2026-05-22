 import { feature } from 'bun:bundle'
import { isDsxuRuntimeMode } from '../../utils/envUtils.js'
import { getModelOptions } from '../../utils/model/modelOptions.js'
import { isVoiceFeatureFlagEnabled } from '../../voice/voiceModeEnabled.js'
import {
  getOptionsForSetting,
  SUPPORTED_SETTINGS,
} from './supportedSettings.js'

export const DESCRIPTION = isDsxuRuntimeMode()
  ? 'Get or set DSXU Code configuration settings.'
  : 'Get or set DSXU Code configuration settings.'

/**
 * Generate the prompt documentation from the registry
 */
export function generatePrompt(): string {
  const productName = isDsxuRuntimeMode() ? 'DSXU Code' : 'DSXU Code'
  const globalConfigPath = isDsxuRuntimeMode()
    ? '~/.dsxu.json'
    : '~/.dsxu.json'
  const globalSettings: string[] = []
  const projectSettings: string[] = []

  for (const [key, config] of Object.entries(SUPPORTED_SETTINGS)) {
    // Skip model - it gets its own section with dynamic options
    if (key === 'model') continue
    // Voice settings are registered at build-time but gated by feature flag provider
    // at runtime. Hide from model prompt when the kill-switch is on.
    if (
      feature('VOICE_MODE') &&
      key === 'voiceEnabled' &&
      !isVoiceFeatureFlagEnabled()
    )
      continue

    const options = getOptionsForSetting(key)
    let line = `- ${key}`

    if (options) {
      line += `: ${options.map(o => `"${o}"`).join(', ')}`
    } else if (config.type === 'boolean') {
      line += `: true/false`
    }

    line += ` - ${config.description}`

    if (config.source === 'global') {
      globalSettings.push(line)
    } else {
      projectSettings.push(line)
    }
  }

  const modelSection = generateModelSection()

  return `Get or set ${productName} configuration settings.

  View or change ${productName} settings. Use when the user requests configuration changes, asks about current settings, or when adjusting a setting would benefit them.


## Usage
- **Get current value:** Omit the "value" parameter
- **Set new value:** Include the "value" parameter

## Configurable settings list
The following settings are available for you to change:

### Global Settings (stored in ${globalConfigPath})
${globalSettings.join('\n')}

### Project Settings (stored in settings.json)
${projectSettings.join('\n')}

${modelSection}
## DSXU weak-model discipline
- When to use: inspect or change configuration only when the user asks, when a setting directly blocks the task, or when a safe configuration change is explicitly beneficial.
- When not to use: do not change model, permissions, telemetry, tools, or project settings as a workaround for failed implementation or without user intent.
- Recovery after failure: if a setting is unavailable or invalid, report the exact setting and valid options instead of guessing another key.
- Weak-model anti-pattern: do not silently widen permissions, switch models, enable remote/archived features, or mutate project settings to make a benchmark pass.
- Verification / evidence: after a change, cite the setting name, scope, value, and the read-back or command evidence confirming it.

## Examples
- Get theme: { "setting": "theme" }
- Set dark theme: { "setting": "theme", "value": "dark" }
- Enable vim mode: { "setting": "editorMode", "value": "vim" }
- Enable verbose: { "setting": "verbose", "value": true }
- Change model: { "setting": "model", "value": "pro" }
- Change permission mode: { "setting": "permissions.defaultMode", "value": "plan" }
`
}

function generateModelSection(): string {
  try {
    const options = getModelOptions()
    const lines = options.map(o => {
      const value = o.value === null ? 'null/"default"' : `"${o.value}"`
      return `  - ${value}: ${o.descriptionForModel ?? o.description}`
    })
    return `## Model
- model - Override the default model. Available options:
${lines.join('\n')}`
  } catch {
    return `## Model
- model - Override the default model (flash, flash-max, pro, coder, planner, reviewer, recovery, inherit, or full DSXU model ID)`
  }
}

export function getDsxuConfigPromptRuntimeProfile(): {
  runtime: 'DSXU Config Prompt'
  description: string
  globalConfigPath: string
  activationEvidence: readonly string[]
} {
  return {
    runtime: 'DSXU Config Prompt',
    description: DESCRIPTION,
    globalConfigPath: '~/.dsxu.json',
    activationEvidence: [
      'generatePrompt renders product name from DSXU runtime mode',
      'global settings path is ~/.dsxu.json in DSXU mode',
      'supported settings are generated from SUPPORTED_SETTINGS registry',
      'model options are dynamically generated from DSXU model registry',
    ],
  }
}
