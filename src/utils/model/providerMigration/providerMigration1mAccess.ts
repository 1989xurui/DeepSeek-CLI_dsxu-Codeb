import {
  checkOpus1mAccess,
  checkSonnet1mAccess,
} from '../check1mAccess.js'
import { isOpus1mMergeEnabled } from './providerMigrationModel.js'

export function isArchivedHighCapacity1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkOpus1mAccess() &&
    !isOpus1mMergeEnabled() &&
    normalized.includes('opus') &&
    normalized.includes('[1m]')
  )
}

export function isArchivedCoding1mUnavailable(model: string): boolean {
  const normalized = model.toLowerCase()
  return (
    !checkSonnet1mAccess() &&
    (normalized.includes('sonnet[1m]') ||
      normalized.includes('sonnet-4-6[1m]'))
  )
}

export function isArchivedExtraUsageMergeEnabled(): boolean {
  return isOpus1mMergeEnabled()
}

export type ArchivedContextUpgradeSuggestion = {
  alias: string
  name: string
  multiplier: number
}

export function getArchivedContextUpgradeSuggestion(
  currentModelSetting: string | null | undefined,
): ArchivedContextUpgradeSuggestion | null {
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

export const isProviderMigrationHighCapacity1mUnavailable =
  isArchivedHighCapacity1mUnavailable
export const isProviderMigrationCoding1mUnavailable =
  isArchivedCoding1mUnavailable
export const isProviderMigrationExtraUsageMergeEnabled =
  isArchivedExtraUsageMergeEnabled
export type ProviderMigrationContextUpgradeSuggestion =
  ArchivedContextUpgradeSuggestion
export const getProviderMigrationContextUpgradeSuggestion =
  getArchivedContextUpgradeSuggestion
