import {
  checkOpus1mAccess,
  checkSonnet1mAccess,
} from '../../../utils/model/check1mAccess.js'
import { isOpus1mMergeEnabled } from './legacyProviderModel.js'

export function isCompatHighCapacity1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkOpus1mAccess() &&
    !isOpus1mMergeEnabled() &&
    normalized.includes('opus') &&
    normalized.includes('[1m]')
  )
}

export function isCompatCoding1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkSonnet1mAccess() &&
    (normalized.includes('sonnet[1m]') ||
      normalized.includes('sonnet-4-6[1m]'))
  )
}

export function isCompatExtraUsageMergeEnabled(): boolean {
  return isOpus1mMergeEnabled()
}

export type CompatContextUpgradeSuggestion = {
  alias: string
  name: string
  multiplier: number
}

export function getCompatContextUpgradeSuggestion(
  currentModelSetting: string | null | undefined,
): CompatContextUpgradeSuggestion | null {
  if (currentModelSetting === 'opus' && checkOpus1mAccess()) {
    return {
      alias: 'flash-max',
      name: 'DeepSeek V4 1M context route',
      multiplier: 5,
    }
  }
  if (currentModelSetting === 'sonnet' && checkSonnet1mAccess()) {
    return {
      alias: 'flash',
      name: 'DeepSeek V4 1M context route',
      multiplier: 5,
    }
  }
  return null
}
