import type { QueryEngineConfig } from './types'

export interface LegacyBridgeResult {
  name: string
  connected: boolean
  detail: string
}

export async function connectLegacyFullAbsorbBridges(config: QueryEngineConfig): Promise<LegacyBridgeResult[]> {
  const results: LegacyBridgeResult[] = []

  const telemetryTrack = (type: string, data: Record<string, any>) => {
    config.telemetry?.collector?.track(type, data)
  }

  // analytics
  try {
    const analytics = await import('../../services/analytics/index.js')
    if (typeof analytics.attachAnalyticsSink === 'function') {
      analytics.attachAnalyticsSink({
        logEvent: (eventName: string, metadata: Record<string, any>) => {
          telemetryTrack('legacy_analytics_event', { eventName, ...metadata })
        },
        logEventAsync: async (eventName: string, metadata: Record<string, any>) => {
          telemetryTrack('legacy_analytics_event_async', { eventName, ...metadata })
        },
      })
      results.push({ name: 'analytics', connected: true, detail: 'attachAnalyticsSink connected to engine telemetry collector' })
    } else {
      results.push({ name: 'analytics', connected: false, detail: 'attachAnalyticsSink not found' })
    }
  } catch (e: any) {
    results.push({ name: 'analytics', connected: false, detail: String(e?.message ?? e) })
  }

  // extractMemories
  try {
    const mod = await import('../../services/extractMemories/extractMemories.js')
    if (typeof mod.initExtractMemories === 'function') {
      results.push({ name: 'extractMemories', connected: true, detail: 'initExtractMemories API detected' })
    } else {
      results.push({ name: 'extractMemories', connected: false, detail: 'initExtractMemories not found' })
    }
  } catch (e: any) {
    results.push({ name: 'extractMemories', connected: false, detail: String(e?.message ?? e) })
  }

  // SessionMemory
  try {
    const mod = await import('../../services/SessionMemory/sessionMemory.js')
    if (typeof mod.initSessionMemory === 'function') {
      results.push({ name: 'sessionMemory', connected: true, detail: 'initSessionMemory API detected' })
    } else {
      results.push({ name: 'sessionMemory', connected: false, detail: 'initSessionMemory not found' })
    }
  } catch (e: any) {
    results.push({ name: 'sessionMemory', connected: false, detail: String(e?.message ?? e) })
  }

  // autoDream
  try {
    const mod = await import('../../services/autoDream/autoDream.js')
    if (typeof mod.initAutoDream === 'function') {
      results.push({ name: 'autoDream', connected: true, detail: 'initAutoDream API detected' })
    } else {
      results.push({ name: 'autoDream', connected: false, detail: 'initAutoDream not found' })
    }
  } catch (e: any) {
    results.push({ name: 'autoDream', connected: false, detail: String(e?.message ?? e) })
  }

  // MagicDocs
  try {
    const mod = await import('../../services/MagicDocs/magicDocs.js')
    if (typeof mod.initMagicDocs === 'function') {
      results.push({ name: 'magicDocs', connected: true, detail: 'initMagicDocs API detected' })
    } else {
      results.push({ name: 'magicDocs', connected: false, detail: 'initMagicDocs not found' })
    }
  } catch (e: any) {
    results.push({ name: 'magicDocs', connected: false, detail: String(e?.message ?? e) })
  }

  // settingsSync
  try {
    const mod = await import('../../services/settingsSync/index.js')
    if (typeof mod.downloadUserSettings === 'function') {
      results.push({ name: 'settingsSync', connected: true, detail: 'downloadUserSettings API detected' })
    } else {
      results.push({ name: 'settingsSync', connected: false, detail: 'downloadUserSettings not found' })
    }
  } catch (e: any) {
    results.push({ name: 'settingsSync', connected: false, detail: String(e?.message ?? e) })
  }

  // plugins
  try {
    const mod = await import('../../services/plugins/pluginOperations.js')
    const ops = mod as Record<string, any>
    const pluginFns = ['installPluginOp', 'uninstallPluginOp', 'enablePluginOp', 'disablePluginOp'].filter(
      key => typeof ops[key] === 'function',
    )
    if (pluginFns.length > 0) {
      results.push({ name: 'plugins', connected: true, detail: `plugin operation API detected: ${pluginFns.join(', ')}` })
    } else {
      results.push({ name: 'plugins', connected: false, detail: 'no plugin operation API found' })
    }
  } catch (e: any) {
    results.push({ name: 'plugins', connected: false, detail: String(e?.message ?? e) })
  }

  // hooks
  try {
    const mod = await import('../../utils/hooks/fileChangedWatcher.js')
    if (typeof mod.initializeFileChangedWatcher === 'function') {
      results.push({ name: 'hooks', connected: true, detail: 'initializeFileChangedWatcher API detected' })
    } else {
      results.push({ name: 'hooks', connected: false, detail: 'initializeFileChangedWatcher not found' })
    }
  } catch (e: any) {
      results.push({ name: 'hooks', connected: false, detail: String(e?.message ?? e) })
  }

  // prompt cache break detection
  try {
    const mod = await import('../../services/api/promptCacheBreakDetection.js')
    const hasRecord = typeof (mod as Record<string, any>).recordPromptState === 'function'
    const hasCheck = typeof (mod as Record<string, any>).checkResponseForCacheBreak === 'function'
    if (hasRecord && hasCheck) {
      results.push({
        name: 'promptCacheBreakDetection',
        connected: true,
        detail: 'recordPromptState + checkResponseForCacheBreak detected',
      })
    } else {
      results.push({
        name: 'promptCacheBreakDetection',
        connected: false,
        detail: 'required API not fully detected',
      })
    }
  } catch (e: any) {
    results.push({ name: 'promptCacheBreakDetection', connected: false, detail: String(e?.message ?? e) })
  }

  // file history
  try {
    const mod = await import('../../utils/fileHistory.js')
    const ops = mod as Record<string, any>
    const hasTrack = typeof ops.fileHistoryTrackEdit === 'function'
    const hasRewind = typeof ops.fileHistoryRewind === 'function'
    if (hasTrack && hasRewind) {
      results.push({
        name: 'fileHistory',
        connected: true,
        detail: 'fileHistoryTrackEdit + fileHistoryRewind detected',
      })
    } else {
      results.push({
        name: 'fileHistory',
        connected: false,
        detail: 'required fileHistory API not fully detected',
      })
    }
  } catch (e: any) {
    results.push({ name: 'fileHistory', connected: false, detail: String(e?.message ?? e) })
  }

  // memdir
  try {
    const mod = await import('../../memdir/memdir.js')
    const ops = mod as Record<string, any>
    const hasLoad = typeof ops.loadMemoryPrompt === 'function'
    const hasBuild = typeof ops.buildMemoryPrompt === 'function'
    if (hasLoad && hasBuild) {
      results.push({
        name: 'memdir',
        connected: true,
        detail: 'loadMemoryPrompt + buildMemoryPrompt detected',
      })
    } else {
      results.push({
        name: 'memdir',
        connected: false,
        detail: 'required memdir API not fully detected',
      })
    }
  } catch (e: any) {
    results.push({ name: 'memdir', connected: false, detail: String(e?.message ?? e) })
  }

  return results
}
