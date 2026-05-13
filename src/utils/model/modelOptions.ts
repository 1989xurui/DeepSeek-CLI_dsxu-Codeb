import { getSettings_DEPRECATED } from '../settings/settings.js'
import { isModelAllowed } from './modelAllowlist.js'
import type { ModelSetting } from './model.js'
import {
  DSXU_DEEPSEEK_FLASH_MAX_ALIAS,
  DSXU_DEEPSEEK_FLASH_MODEL,
  DSXU_DEEPSEEK_PRO_MODEL,
  isDSXUCodeMode,
} from './dsxuModel.js'
import {
  getDefaultOptionForUser as getLegacyDefaultOptionForUser,
  getModelOptions as getLegacyProviderModelOptions,
} from '../../dsxu/legacy/model/legacyProviderModelOptions.js'

export type ModelOption = {
  value: ModelSetting
  label: string
  description: string
  descriptionForModel?: string
}

function getDsxuDefaultOptionForUser(): ModelOption {
  return {
    value: null,
    label: 'Default (recommended)',
    description:
      'DeepSeek V4 Flash for most coding work; DSXU upgrades complex review/recovery paths to V4 Pro',
    descriptionForModel: 'Default model (DeepSeek V4 Flash)',
  }
}

export function getDefaultOptionForUser(fastMode = false): ModelOption {
  if (!isDSXUCodeMode()) {
    return getLegacyDefaultOptionForUser(fastMode)
  }
  return getDsxuDefaultOptionForUser()
}

function getDsxuModelOptions(): ModelOption[] {
  return [
    getDsxuDefaultOptionForUser(),
    {
      value: DSXU_DEEPSEEK_FLASH_MODEL,
      label: 'DeepSeek V4 Flash',
      description:
        'Default low-cost coding route with 1M context, tools, FIM, and cache-friendly prompts',
      descriptionForModel:
        'DeepSeek V4 Flash - efficient coding/default workflow model',
    },
    {
      value: DSXU_DEEPSEEK_FLASH_MAX_ALIAS,
      label: 'DeepSeek V4 Flash-MAX',
      description:
        'Flash route with maximum reasoning budget before Pro escalation is justified',
      descriptionForModel:
        'DeepSeek V4 Flash-MAX - high-effort Flash planning and coding route',
    },
    {
      value: DSXU_DEEPSEEK_PRO_MODEL,
      label: 'DeepSeek V4 Pro',
      description:
        'Escalation route for planning, review, failed verification recovery, and high-risk long tasks',
      descriptionForModel:
        'DeepSeek V4 Pro - planning, review, recovery and high-risk coding work',
    },
  ]
}

export function getModelOptions(fastMode = false): ModelOption[] {
  if (!isDSXUCodeMode()) {
    return getLegacyProviderModelOptions(fastMode)
  }
  return filterModelOptionsByAllowlist(getDsxuModelOptions())
}

function filterModelOptionsByAllowlist(options: ModelOption[]): ModelOption[] {
  const settings = getSettings_DEPRECATED() || {}
  if (!settings.availableModels) {
    return options
  }
  return options.filter(
    opt =>
      opt.value === null || (opt.value !== null && isModelAllowed(opt.value)),
  )
}
