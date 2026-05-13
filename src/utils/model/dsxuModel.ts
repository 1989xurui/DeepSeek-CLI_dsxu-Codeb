import {
  DEEPSEEK_V4_FLASH_MODEL,
  DEEPSEEK_V4_PRO_MODEL,
  isDeepSeekV4ModelLike,
  normalizeDeepSeekV4Model,
} from './deepseekV4Control.js'
import { resolveLegacyModelCompat } from './legacyModelCompat.js'

export const DSXU_DEEPSEEK_FLASH_MODEL = DEEPSEEK_V4_FLASH_MODEL
export const DSXU_DEEPSEEK_PRO_MODEL = DEEPSEEK_V4_PRO_MODEL
export const DSXU_DEEPSEEK_FLASH_MAX_ALIAS = 'flash-max' as const

export function isDSXUCodeMode(): boolean {
  return process.env.DSXU_CODE_MODE === '1'
}

export function getDSXUDefaultModel(): string {
  return process.env.DSXU_DEFAULT_MODEL || DSXU_DEEPSEEK_FLASH_MODEL
}

export function getDSXUReasoningModel(): string {
  return process.env.DSXU_REASONING_MODEL || DSXU_DEEPSEEK_PRO_MODEL
}

export function parseDSXUModelAlias(modelInput: string): string {
  const normalized = modelInput.trim().toLowerCase()
  const legacyCompat = resolveLegacyModelCompat(normalized)
  if (legacyCompat) return legacyCompat.model
  if (normalized === 'deepseek') return DSXU_DEEPSEEK_FLASH_MODEL
  if (normalized === DSXU_DEEPSEEK_FLASH_MAX_ALIAS) return DSXU_DEEPSEEK_FLASH_MODEL
  return isDeepSeekV4ModelLike(normalized) ? normalizeDeepSeekV4Model(normalized) : modelInput
}

export function renderDSXUModelName(model: string): string | null {
  const legacyCompat = resolveLegacyModelCompat(model)
  if (
    model.trim().toLowerCase() === DSXU_DEEPSEEK_FLASH_MAX_ALIAS ||
    legacyCompat?.publicAlias === DSXU_DEEPSEEK_FLASH_MAX_ALIAS
  ) {
    return 'DeepSeek V4 Flash-MAX'
  }
  const resolved = parseDSXUModelAlias(model)
  if (resolved === DSXU_DEEPSEEK_FLASH_MODEL) {
    return 'DeepSeek V4 Flash'
  }
  if (resolved === DSXU_DEEPSEEK_PRO_MODEL) {
    return 'DeepSeek V4 Pro'
  }
  return null
}
