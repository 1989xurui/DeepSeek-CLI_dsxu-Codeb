/**
 * DeepSeek prompt-cache accounting.
 *
 * This module records upstream usage fields such as prompt_cache_hit_tokens and
 * exposes a small in-memory counter for prefix/cache tuning.
 */

export interface CacheStats {
  hit: number
  miss: number
  ratio(): number
  reset(): void
  snapshot(): { hit: number; miss: number; ratio: number; ts: number }
}

export interface CacheUsage {
  prompt_cache_hit_tokens?: number
  prompt_tokens?: number
}

export class CacheStatsImpl implements CacheStats {
  private _hit = 0
  private _miss = 0
  private _lastResetTime = Date.now()
  private readonly RESET_INTERVAL_MS = 24 * 60 * 60 * 1000

  constructor(private skipDiskLoad = false) {
    if (!skipDiskLoad) {
      this.loadFromDisk()
      this.startResetCheck()
    }
  }

  get hit(): number {
    return this._hit
  }

  get miss(): number {
    return this._miss
  }

  ratio(): number {
    const total = this._hit + this._miss
    return total > 0 ? this._hit / total : 0
  }

  reset(): void {
    this._hit = 0
    this._miss = 0
    this._lastResetTime = Date.now()
    this.saveToDisk()
  }

  snapshot(): { hit: number; miss: number; ratio: number; ts: number } {
    return {
      hit: this._hit,
      miss: this._miss,
      ratio: this.ratio(),
      ts: Date.now(),
    }
  }

  record(usage: CacheUsage): void {
    const hitTokens =
      typeof usage.prompt_cache_hit_tokens === 'number'
        ? usage.prompt_cache_hit_tokens
        : 0
    const totalTokens =
      typeof usage.prompt_tokens === 'number' ? usage.prompt_tokens : 0
    const missTokens = Math.max(0, totalTokens - hitTokens)

    this._miss += missTokens
    this._hit += hitTokens
    this.exportToOtel(hitTokens, missTokens)

    if ((this._hit + this._miss) % 100 === 0) {
      this.saveToDisk()
    }
  }

  private exportToOtel(hitTokens: number, missTokens: number): void {
    try {
      setImmediate(() => {
        const globals = globalThis as typeof globalThis & {
          dsxuTracing?: { getCurrentSpan(): { setAttribute(key: string, value: unknown): void } | undefined }
          dsxuMetrics?: { getMeter(name: string): any }
        }
        const span = globals.dsxuTracing?.getCurrentSpan()
        if (span) {
          span.setAttribute('dsxu.cache.hit_tokens', hitTokens)
          span.setAttribute('dsxu.cache.miss_tokens', missTokens)
          span.setAttribute('dsxu.cache.hit_ratio', this.ratio())
        }

        const meter = globals.dsxuMetrics?.getMeter('dsxu.cache')
        if (meter) {
          const hitCounter = meter.createCounter('cache_hit_tokens', {
            description: 'Cumulative prompt-cache hit tokens',
          })
          const missCounter = meter.createCounter('cache_miss_tokens', {
            description: 'Cumulative prompt-cache miss tokens',
          })
          meter.createObservableGauge(
            'cache_hit_ratio',
            { description: 'Current prompt-cache hit ratio' },
            observableResult => {
              observableResult.observe(this.ratio())
            },
          )

          hitCounter.add(hitTokens)
          missCounter.add(missTokens)
        }
      })
    } catch (error) {
      console.warn('[cache-stats] OTEL export failed:', error)
    }
  }

  private saveToDisk(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const dataDir = path.join(__dirname, '../../../.dsxu')
      const filePath = path.join(dataDir, 'cache-stats.json')

      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }

      fs.writeFileSync(
        filePath,
        JSON.stringify({
          hit: this._hit,
          miss: this._miss,
          lastResetTime: this._lastResetTime,
          savedAt: Date.now(),
        }, null, 2),
        'utf8',
      )
    } catch (error) {
      console.warn('[cache-stats] Failed to save cache stats:', error)
    }
  }

  private loadFromDisk(): void {
    try {
      const fs = require('fs')
      const path = require('path')
      const filePath = path.join(__dirname, '../../../.dsxu/cache-stats.json')

      if (!fs.existsSync(filePath)) return

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      this._hit = data.hit || 0
      this._miss = data.miss || 0
      this._lastResetTime = data.lastResetTime || Date.now()

      if (Date.now() - this._lastResetTime > this.RESET_INTERVAL_MS) {
        this.reset()
      }
    } catch (error) {
      console.warn('[cache-stats] Failed to load cache stats:', error)
    }
  }

  private startResetCheck(): void {
    setInterval(() => {
      if (Date.now() - this._lastResetTime > this.RESET_INTERVAL_MS) {
        console.log('[cache-stats] Auto-resetting cache stats after 24h')
        this.reset()
      }
    }, 60 * 60 * 1000)
  }
}

export const globalCacheStats: CacheStats = new CacheStatsImpl()

export function recordCacheUsage(usage: unknown): void {
  if (!usage || typeof usage !== 'object') return

  const value = usage as CacheUsage
  globalCacheStats.record({
    prompt_cache_hit_tokens:
      typeof value.prompt_cache_hit_tokens === 'number'
        ? value.prompt_cache_hit_tokens
        : undefined,
    prompt_tokens:
      typeof value.prompt_tokens === 'number'
        ? value.prompt_tokens
        : undefined,
  })
}

export interface SelfTuningHook {
  getParams(): Record<string, unknown>
  proposeNext(failure: { ratio: number }): Record<string, unknown> | null
  hasConverged(history: Array<{ ratio: number }>): boolean
}

export const cacheTuningHook: SelfTuningHook = {
  getParams() {
    return {
      currentRatio: globalCacheStats.ratio(),
      hit: globalCacheStats.hit,
      miss: globalCacheStats.miss,
    }
  },

  proposeNext(failure: { ratio: number }) {
    if (failure.ratio < 0.3) {
      return { action: 'rotate_prefix_order' }
    }
    return null
  },

  hasConverged(history: Array<{ ratio: number }>) {
    if (history.length < 3) return false

    const lastThree = history.slice(-3)
    const avg = lastThree.reduce((sum, h) => sum + h.ratio, 0) / lastThree.length
    const variance =
      lastThree.reduce((sum, h) => sum + Math.pow(h.ratio - avg, 2), 0) /
      lastThree.length

    return variance < 0.01
  },
}
